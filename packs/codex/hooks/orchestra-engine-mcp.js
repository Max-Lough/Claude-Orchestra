#!/usr/bin/env node
'use strict';
/*
 * orchestra-engine — MCP server for the Orchestra codex pack.
 *
 * Exposes the four runners (review / exec / deep-plan / cross-compare) plus
 * the install doctor as typed MCP tools, so a launcher agent makes ONE
 * blocking tool call and receives the runner's report as data. This replaces the shell
 * transport — heredoc-to-scratch, run tokens, sentinels, background-and-poll,
 * stdout scraping — that produced the majority of the codex lane's recorded
 * field failures (see failure forensics, 2026-08-26: TRANSPORT ≈53%).
 *
 * The server is a transport, not a judge. It relays the runner's stdout
 * verbatim as the tool result and never rewrites, summarizes, or reinterprets
 * it. The runners keep every guarantee they already make: exit 0 always
 * (doctor excepted), engine-less failure headers, runner-owned retries,
 * *_UNAVAILABLE sentinels. Anything the server itself has to say is prefixed
 * `MCP TRANSPORT` so it can never be mistaken for engine output.
 *
 * Transport: stdio, newline-delimited JSON-RPC 2.0 (the MCP stdio framing).
 * Zero dependencies, CommonJS (hooks/package.json pins "type": "commonjs").
 *
 * Registration (done by install.js when the codex pack is selected):
 *   .mcp.json → { "mcpServers": { "orchestra-engine": {
 *                   "command": "node",
 *                   "args": [".claude/hooks/orchestra-engine-mcp.js"] } } }
 *
 * Env:
 *   ORCHESTRA_MCP_HOOKS_DIR   override the runners' directory (tests only;
 *                             default: this file's own directory)
 *   ORCHESTRA_MCP_ROOT        override the project root (tests only)
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/* ---------------------------------------------------------------- roots -- */

function resolveRoot() {
  if (process.env.ORCHESTRA_MCP_ROOT) return path.resolve(process.env.ORCHESTRA_MCP_ROOT);
  // Claude Code launches .mcp.json servers with cwd = the project directory,
  // but resolve through git so a server launched from a subdirectory still
  // finds the repo root the work orders describe.
  try {
    const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 15000, windowsHide: true,
    });
    if (r.status === 0 && r.stdout.trim()) return path.resolve(r.stdout.trim());
  } catch (_) { /* fall through */ }
  return process.cwd();
}

const ROOT = resolveRoot();
const HOOKS_DIR = process.env.ORCHESTRA_MCP_HOOKS_DIR
  ? path.resolve(process.env.ORCHESTRA_MCP_HOOKS_DIR)
  : __dirname;
const SCRATCH_BASE = path.join(ROOT, '.claude', 'scratch', 'mcp');

const RUNNERS = {
  review: path.join(HOOKS_DIR, 'orchestra-review.js'),
  exec: path.join(HOOKS_DIR, 'orchestra-exec.js'),
  deepplan: path.join(HOOKS_DIR, 'orchestra-deepplan.js'),
  crossplan: path.join(HOOKS_DIR, 'orchestra-crossplan.js'),
};

/* ---------------------------------------------------------- config reads -- */

function readCodexConfig() {
  try {
    const p = path.join(ROOT, '.claude', 'orchestra.json');
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (parsed && typeof parsed === 'object' && parsed.codex && typeof parsed.codex === 'object')
      ? parsed.codex : {};
  } catch (_) { return {}; }
}

function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; }

// The effective wall-clock cap the RUNNER will apply, resolved the same way
// the runner resolves it (flag > env > orchestra.json > default), so the
// server's kill-backstop can sit safely above it instead of guessing.
function effectiveCapMs(lane, timeoutMsArg) {
  if (num(timeoutMsArg)) return num(timeoutMsArg);
  const cfg = readCodexConfig();
  if (lane === 'review') {
    return num(process.env.ORCHESTRA_REVIEW_TIMEOUT_MS) || num(cfg.reviewTimeoutMs) || 600000;
  }
  if (lane === 'exec') {
    return num(process.env.ORCHESTRA_EXEC_TIMEOUT_MS) || num(cfg.execTimeoutMs) || 1800000;
  }
  if (lane === 'crossplan') {
    return num(process.env.ORCHESTRA_CROSSPLAN_TIMEOUT_MS) || num(cfg.crossplanTimeoutMs) || 900000;
  }
  return num(process.env.ORCHESTRA_DEEPPLAN_TIMEOUT_MS) || 900000; // deepplan
}

// The backstop covers the runner's WHOLE chain, not one attempt: a review may
// legally spend (1 + retries) x cap, plus probe and warmup. It exists only to
// catch a wedged runner process — the runner's own timers are the real cap.
function backstopMs(lane, capMs) {
  if (num(process.env.ORCHESTRA_MCP_BACKSTOP_MS)) return num(process.env.ORCHESTRA_MCP_BACKSTOP_MS); // tests only
  const cfg = readCodexConfig();
  if (lane === 'review') {
    let retries = num(process.env.ORCHESTRA_REVIEW_RETRIES);
    if (retries === undefined) retries = num(cfg.reviewRetries);
    if (retries === undefined) retries = 1;
    retries = Math.min(retries, 3);
    const warmup = num(process.env.ORCHESTRA_REVIEW_WARMUP_TIMEOUT_MS) || num(cfg.worktreeWarmupTimeoutMs) || 300000;
    return capMs * (1 + retries) + warmup + 300000;
  }
  if (lane === 'exec') return capMs + 300000; // never auto-retried
  if (lane === 'crossplan') return capMs + 300000; // one attempt, plus probe margin
  return capMs + 120000; // deepplan
}

/* ------------------------------------------------------------- scratch -- */

let runSeq = 0;
function makeRunDir(lane) {
  const id = `${lane}-${process.pid}-${Date.now().toString(36)}-${++runSeq}`;
  const dir = path.join(SCRATCH_BASE, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sweepStaleRunDirs() {
  // Best-effort: clear run dirs older than 7 days left by hard kills.
  try {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const name of fs.readdirSync(SCRATCH_BASE)) {
      const p = path.join(SCRATCH_BASE, name);
      try {
        if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { recursive: true, force: true });
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
}

/* ------------------------------------------------------------ transport -- */

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

function textResult(id, text, isError) {
  send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: !!isError } });
}

function transportError(id, lines) {
  // The server's own voice. Prefixed so it can never be read as engine
  // output, attributes no cause it did not measure, and names no engine.
  textResult(id, ['MCP TRANSPORT ERROR (orchestra-engine server, not the engine):', ...lines].join('\n'), true);
}

/* --------------------------------------------------------- runner spawn -- */

const OUTPUT_CAP = 4 * 1024 * 1024; // per stream; a runner report is a few KB

function runRunner(id, lane, args, progressToken, extraEnv) {
  const runner = RUNNERS[lane === 'doctor' ? 'review' : lane];
  if (!fs.existsSync(runner)) {
    transportError(id, [
      `the ${lane} runner was not found at ${runner}`,
      `hooks dir: ${HOOKS_DIR}`,
      'The codex pack may not be installed in this project (node install.js <project> --packs codex).',
    ]);
    return;
  }

  const capMs = lane === 'doctor' ? 0 : effectiveCapMs(lane, argValue(args, '--timeout-ms'));
  const killAfter = lane === 'doctor' ? 600000 : backstopMs(lane, capMs);

  let child;
  try {
    child = spawn(process.execPath, [runner, ...args], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: ROOT }, extraEnv || {}),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (e) {
    transportError(id, [`the runner process could not be spawned: ${e.message}`]);
    return;
  }

  let out = '', err = '', outTruncated = false, errTruncated = false;
  child.stdout.on('data', (d) => {
    if (out.length < OUTPUT_CAP) out += d.toString(); else outTruncated = true;
  });
  child.stderr.on('data', (d) => {
    if (err.length < OUTPUT_CAP) err += d.toString(); else errTruncated = true;
  });

  const started = Date.now();

  // MCP progress notifications: emitted only when the client asked for them
  // (a progressToken in _meta). Lets a client that resets its timeout on
  // progress hold arbitrarily long runner chains.
  let progressTimer = null;
  const progressEvery = num(process.env.ORCHESTRA_MCP_PROGRESS_MS) || 30000; // override is tests-only
  if (progressToken !== undefined && progressToken !== null) {
    progressTimer = setInterval(() => {
      send({
        jsonrpc: '2.0', method: 'notifications/progress',
        params: {
          progressToken,
          progress: Math.floor((Date.now() - started) / 1000),
          message: `${lane} runner in progress — ${Math.floor((Date.now() - started) / 1000)}s elapsed` +
            (capMs ? ` (runner cap ${capMs}ms; the runner owns the clock)` : ''),
        },
      });
    }, progressEvery);
  }

  let backstopFired = false;
  const backstopTimer = setTimeout(() => {
    backstopFired = true;
    try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
  }, killAfter);

  child.on('error', (e) => {
    clearTimeout(backstopTimer); if (progressTimer) clearInterval(progressTimer);
    transportError(id, [`the runner process failed to launch or crashed at the OS level: ${e.message}`]);
  });

  child.on('close', (code, signal) => {
    clearTimeout(backstopTimer); if (progressTimer) clearInterval(progressTimer);
    const elapsed = Date.now() - started;
    const tail = (s, n) => (s.length > n ? '…' + s.slice(-n) : s);

    if (backstopFired) {
      transportError(id, [
        `the ${lane} runner exceeded the server's kill-backstop (${killAfter}ms; runner cap ${capMs}ms) and was killed by THIS SERVER after ${elapsed}ms.`,
        'This is a runner-process anomaly: the runner\'s own timer should always fire first.',
        `runner stdout tail:\n${tail(out, 4000) || '(empty)'}`,
        `runner stderr tail:\n${tail(err, 2000) || '(empty)'}`,
      ]);
      return;
    }

    if (lane === 'doctor') {
      // --doctor is the one runner mode whose exit code is meaningful.
      const text = `DOCTOR EXIT CODE: ${code}\n` + out + (err ? `\n[doctor stderr]\n${err}` : '');
      textResult(id, text, code !== 0);
      return;
    }

    if (code !== 0 || signal) {
      // The runners exit 0 on every report path; anything else is a
      // transport-class anomaly. Everything the process wrote is included,
      // clearly labelled — shown, never promoted to a report.
      transportError(id, [
        `the runner exited abnormally (code=${code}, signal=${signal || 'none'}) after ${elapsed}ms — the runners exit 0 on every report path, so this output is NOT a runner report.`,
        `captured stdout${outTruncated ? ' (truncated)' : ''}:\n${out || '(empty)'}`,
        `captured stderr${errTruncated ? ' (truncated)' : ''}:\n${tail(err, 4000) || '(empty)'}`,
      ]);
      return;
    }

    if (!out.trim()) {
      transportError(id, [
        `the runner exited 0 after ${elapsed}ms but wrote nothing to stdout — no report exists for this call.`,
        `stderr tail:\n${tail(err, 4000) || '(empty)'}`,
      ]);
      return;
    }

    let text = out;
    if (outTruncated) text += '\n\nMCP TRANSPORT NOTE: runner stdout exceeded the 4MB capture cap and was truncated.';
    textResult(id, text, false);
  });
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

/* -------------------------------------------------------- tool handlers -- */

function requireString(a, name) {
  const v = a[name];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`missing required string parameter: ${name}`);
  return v;
}

function writeInput(dir, name, content) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function pushForbids(args, forbid) {
  if (Array.isArray(forbid)) for (const f of forbid) if (typeof f === 'string' && f.trim()) args.push('--forbid', f);
}

const TOOLS = [
  {
    name: 'orchestra_review',
    description:
      'Run the Orchestra cross-vendor review runner (an OpenAI model driven by the Codex CLI reads the diff, ' +
      'reruns verification, and returns a verdict). Blocks until the runner\'s whole attempt chain finishes and ' +
      'returns the complete Orchestra-format report verbatim — header (engine provenance, cap, checkout), ' +
      'VERDICT line, findings, any ATTEMPT LOG. The runner owns retries and timeouts: call this ONCE per review ' +
      'and never re-call after a REVIEW_UNAVAILABLE (its FINALITY line is final). Pass head_ref (and base_ref) ' +
      'whenever the change is committed — the runner then reviews a pinned throwaway checkout instead of the ' +
      'live tree; pass warmup_cmd (e.g. an install command) with every pinned review of a project that needs ' +
      'dependencies present to build or test.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string', description: 'The execution work order the change answered (the intent), verbatim.' },
        executor_report: { type: 'string', description: 'The executor\'s full report (the claim), verbatim.' },
        base_ref: { type: 'string', description: 'Commit the change is measured FROM (with head_ref).' },
        head_ref: { type: 'string', description: 'Commit under review. Always pass when the change is committed — pins the review to a clean checkout.' },
        tier: { type: 'string', enum: ['inert'], description: 'Pass "inert" ONLY when the Director\'s order explicitly declares TIER: inert. Full depth is the default.' },
        timeout_ms: { type: 'number', description: 'Wall-clock cap per attempt, only when the order names one. Default/inert floor is 600000.' },
        no_tests: { type: 'boolean', description: 'Hard-forbid running the suite/build/app (order says so). Affected claims come back UNVERIFIED (prohibited).' },
        forbid: { type: 'array', items: { type: 'string' }, description: 'Specific commands the reviewer must not execute.' },
        warmup_cmd: { type: 'string', description: 'Command run unsandboxed in the fresh pinned checkout before the integrity baseline (e.g. "pnpm install"). Pinned reviews only.' },
      },
      required: ['work_order', 'executor_report'],
    },
    handler(id, a, progressToken) {
      const dir = makeRunDir('review');
      const args = [
        '--work-order', writeInput(dir, 'work-order.txt', requireString(a, 'work_order')),
        '--executor-report', writeInput(dir, 'executor-report.txt', requireString(a, 'executor_report')),
      ];
      if (a.base_ref) args.push('--base-ref', String(a.base_ref));
      if (a.head_ref) args.push('--head-ref', String(a.head_ref));
      if (a.tier === 'inert') args.push('--tier', 'inert');
      if (num(a.timeout_ms)) args.push('--timeout-ms', String(num(a.timeout_ms)));
      if (a.no_tests) args.push('--no-tests');
      pushForbids(args, a.forbid);
      if (typeof a.warmup_cmd === 'string' && a.warmup_cmd.trim()) args.push('--warmup-cmd', a.warmup_cmd);
      runRunner(id, 'review', args, progressToken);
    },
  },
  {
    name: 'orchestra_exec',
    description:
      'Run the Orchestra cross-vendor execution runner (an OpenAI model driven by the Codex CLI edits the LIVE ' +
      'working tree, runs verification, and reports in the Orchestra executor format). Blocks until done and ' +
      'returns the full report verbatim — header, STATUS line, report body, TREE AUDIT, REPORT INTEGRITY. ' +
      'Execution is deliberately NEVER auto-retried (a half-dead engine may have half-edited the tree): call ' +
      'this ONCE per work order and relay a STATUS: EXEC_UNAVAILABLE as-is. tier "heavy" selects the flagship ' +
      'model at high reasoning effort — a Director routing decision, never a launcher\'s.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string', description: 'The FULL execution work order — goal, scope, constraints, context, verification expectations — verbatim.' },
        tier: { type: 'string', enum: ['standard', 'heavy'], description: 'Execution tier. Default standard. "heavy" only when the Director routed the order to the heavy executor.' },
        timeout_ms: { type: 'number', description: 'Wall-clock cap, only when the order names one. Default 1800000 — budget a build plus a suite.' },
        forbid: { type: 'array', items: { type: 'string' }, description: 'Specific commands the executor must not run.' },
        cd: { type: 'string', description: 'Isolated worktree directory to execute in, only when the order names one.' },
        model: { type: 'string', description: 'Pin a specific model for this run, only when the order names one.' },
        effort: { type: 'string', description: 'Reasoning effort override, only when the order names one.' },
      },
      required: ['work_order'],
    },
    handler(id, a, progressToken) {
      const dir = makeRunDir('exec');
      const args = ['--work-order', writeInput(dir, 'work-order.txt', requireString(a, 'work_order'))];
      if (a.tier === 'heavy') args.push('--tier', 'heavy');
      if (num(a.timeout_ms)) args.push('--timeout-ms', String(num(a.timeout_ms)));
      pushForbids(args, a.forbid);
      if (typeof a.cd === 'string' && a.cd.trim()) args.push('--cd', a.cd);
      if (typeof a.model === 'string' && a.model.trim()) args.push('--model', a.model);
      if (typeof a.effort === 'string' && a.effort.trim()) args.push('--effort', a.effort);
      runRunner(id, 'exec', args, progressToken);
    },
  },
  {
    name: 'orchestra_deepplan',
    description:
      'Run the Orchestra deep-plan runner: sends the current plan file plus the Director\'s round brief to the ' +
      'OpenAI planning counterpart and returns its verdict verbatim — VERDICT: APPROVE, or VERDICT: REVISE with ' +
      'a numbered CRITIQUE and complete UPDATED PLAN (also saved to the path on the RESPONSE SAVED header line). ' +
      'Blocks until done (default cap 900000 ms; max-effort consultations routinely use most of it). At most two ' +
      'calls per round; relay a DEEPPLAN_UNAVAILABLE as-is after the second.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_path: { type: 'string', description: 'Path to the plan markdown file (normally under .claude/plans/), relative to the project root or absolute.' },
        brief: { type: 'string', description: 'The Director\'s round brief — goal, constraints, recon facts, prior-round dispositions — verbatim.' },
        round: { type: 'number', description: 'Round number (1-based).' },
        effort: { type: 'string', description: 'Reasoning effort, only when the order names one (default max).' },
        model: { type: 'string', description: 'Model id, only when the order names one (default gpt-5.6-sol).' },
        timeout_ms: { type: 'number', description: 'Wall-clock cap, only when the order names one (default 900000).' },
        max_tokens: { type: 'number', description: 'Output/reasoning token cap, only when the order names one (default 64000).' },
      },
      required: ['plan_path', 'brief', 'round'],
    },
    handler(id, a, progressToken) {
      const dir = makeRunDir('deepplan');
      const planPath = path.isAbsolute(String(a.plan_path || ''))
        ? String(a.plan_path)
        : path.join(ROOT, requireString(a, 'plan_path'));
      if (!fs.existsSync(planPath)) throw new Error(`plan file not found: ${planPath}`);
      const args = [
        '--plan', planPath,
        '--brief', writeInput(dir, 'brief.txt', requireString(a, 'brief')),
        '--round', String(Math.max(1, Math.floor(Number(a.round) || 1))),
      ];
      if (typeof a.effort === 'string' && a.effort.trim()) args.push('--effort', a.effort);
      if (typeof a.model === 'string' && a.model.trim()) args.push('--model', a.model);
      if (num(a.timeout_ms)) args.push('--timeout-ms', String(num(a.timeout_ms)));
      if (num(a.max_tokens)) args.push('--max-tokens', String(num(a.max_tokens)));
      runRunner(id, 'deepplan', args, progressToken);
    },
  },
  {
    name: 'orchestra_crossplan',
    description:
      'Run one phase of the Orchestra cross-compare planning lane: an OpenAI model driven by the Codex CLI, ' +
      'READ-ONLY in the project tree, acting as one of two independent architects. phase "draft" writes a plan ' +
      'from the shared brief; "critique" critiques the rival plan (own_plan_path + rival_plan_path required); ' +
      '"revise" produces plan v2 from own_plan_path + critique_path with a disposition per finding. The produced ' +
      'document is saved to out_path and returned verbatim under a provenance header (DOCUMENT SAVED line). ' +
      'Blocks until done (default cap 900000 ms; high-effort recon plus a full document routinely uses most of ' +
      'it). One call per phase; relay a STATUS: CROSSPLAN_UNAVAILABLE as-is — re-dispatch only on the ' +
      'Director\'s say-so (the lane is read-only, so a re-dispatch is safe once the condition is fixed).',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', enum: ['draft', 'critique', 'revise'], description: 'Which consultation phase to run.' },
        brief: { type: 'string', description: 'The Director\'s SHARED brief — goal, done-criteria, constraints, GROUND TRUTH scope — verbatim, identical to what the other architect received.' },
        out_path: { type: 'string', description: 'Where the produced document is written (normally under .claude/plans/cross-compare/<slug>/), relative to the project root or absolute.' },
        own_plan_path: { type: 'string', description: 'This architect\'s own current plan file. Required for critique and revise.' },
        rival_plan_path: { type: 'string', description: 'The rival architect\'s plan file under critique. Required for critique only.' },
        critique_path: { type: 'string', description: 'The critique this architect\'s plan received. Required for revise only.' },
        effort: { type: 'string', description: 'Reasoning effort, only when the order names one (default high).' },
        model: { type: 'string', description: 'Model id, only when the order names one (default gpt-5.6-sol).' },
        timeout_ms: { type: 'number', description: 'Wall-clock cap, only when the order names one (default 900000).' },
      },
      required: ['phase', 'brief', 'out_path'],
    },
    handler(id, a, progressToken) {
      const dir = makeRunDir('crossplan');
      const resolve = (p) => (path.isAbsolute(String(p)) ? String(p) : path.join(ROOT, String(p)));
      const args = [
        '--phase', requireString(a, 'phase'),
        '--brief', writeInput(dir, 'brief.txt', requireString(a, 'brief')),
        '--out', resolve(requireString(a, 'out_path')),
      ];
      for (const [key, flag] of [
        ['own_plan_path', '--own-plan'],
        ['rival_plan_path', '--rival-plan'],
        ['critique_path', '--critique'],
      ]) {
        if (typeof a[key] === 'string' && a[key].trim()) {
          const p = resolve(a[key].trim());
          if (!fs.existsSync(p)) throw new Error(`${key} not found: ${p}`);
          args.push(flag, p);
        }
      }
      if (typeof a.effort === 'string' && a.effort.trim()) args.push('--effort', a.effort);
      if (typeof a.model === 'string' && a.model.trim()) args.push('--model', a.model);
      if (num(a.timeout_ms)) args.push('--timeout-ms', String(num(a.timeout_ms)));
      runRunner(id, 'crossplan', args, progressToken);
    },
  },
  {
    name: 'orchestra_doctor',
    description:
      'Check the Codex install without spending a review: resolves the real codex binary, names the install ' +
      'layout, verifies the helper files that must sit directly beside it, repairs what it can (NOTE: repair ' +
      'copies files into the install on the user\'s machine — run this only on the Director\'s or user\'s say-so), ' +
      'and prints the exact copy command for anything it cannot. The result starts with DOCTOR EXIT CODE: 0 ' +
      '(a review would find a complete install) or 1 (it would not, and the output says why). Pass live=true to ' +
      'also prove the exec-lane nonce round-trip with a real no-op engine run.',
    inputSchema: {
      type: 'object',
      properties: {
        live: { type: 'boolean', description: 'Also run the live no-op engine probe (--doctor --live). Slower; spends a real engine call.' },
      },
    },
    handler(id, a, progressToken) {
      const args = ['--doctor'];
      if (a && a.live) args.push('--live');
      runRunner(id, 'doctor', args, progressToken);
    },
  },
];

/* ------------------------------------------------------------- protocol -- */

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (line) handleMessage(line);
  }
});
process.stdin.on('end', () => process.exit(0));

function handleMessage(line) {
  let msg;
  try { msg = JSON.parse(line); } catch (_) { return; }
  const { id, method, params } = msg;

  try {
    if (method === 'initialize') {
      sweepStaleRunDirs();
      send({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: (params && params.protocolVersion) || '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'orchestra-engine', version: '1.11.0' },
        },
      });
      return;
    }
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
    if (method === 'ping') { send({ jsonrpc: '2.0', id, result: {} }); return; }
    if (method === 'tools/list') {
      send({
        jsonrpc: '2.0', id,
        result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
      });
      return;
    }
    if (method === 'tools/call') {
      const tool = TOOLS.find((t) => t.name === (params && params.name));
      if (!tool) {
        send({ jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool: ${params && params.name}` } });
        return;
      }
      const progressToken = params && params._meta && params._meta.progressToken;
      try {
        tool.handler(id, (params && params.arguments) || {}, progressToken);
      } catch (e) {
        // Bad arguments or pre-spawn failure: a tool-level error, not a report.
        transportError(id, [`the call could not be started: ${e.message}`]);
      }
      return;
    }
    if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
    }
  } catch (e) {
    if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32603, message: `internal error: ${e.message}` } });
    }
  }
}
