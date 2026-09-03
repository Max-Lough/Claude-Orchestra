#!/usr/bin/env node
'use strict';
/*
 * orchestra-engine — MCP server for the Orchestra codex pack (3.0).
 *
 * A thin stdio MCP server exposing exactly four tools — orchestra_review,
 * orchestra_exec, orchestra_crossplan, orchestra_doctor — each translating
 * validated inputs into runner arguments, running the runner (review / exec /
 * cross-compare / doctor) to completion, and relaying its stdout verbatim as
 * the tool result. This replaces the shell transport — heredoc-to-scratch,
 * run tokens, sentinels, background-and-poll, stdout scraping — that
 * produced the majority of the codex lane's recorded field failures (see
 * failure forensics, 2026-08-26: TRANSPORT ≈53%).
 *
 * There is no ticket, casting, roster, pin, bridge, or manifest concept here.
 * A caller passes validated inputs; the server passes them straight to the
 * runner and relays whatever the runner reports.
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
    // Default matches orchestra-review.js's own runner default (1800000ms).
    return num(process.env.ORCHESTRA_REVIEW_TIMEOUT_MS) || num(cfg.reviewTimeoutMs) || 1800000;
  }
  if (lane === 'exec') {
    return num(process.env.ORCHESTRA_EXEC_TIMEOUT_MS) || num(cfg.execTimeoutMs) || 1800000;
  }
  return num(process.env.ORCHESTRA_CROSSPLAN_TIMEOUT_MS) || num(cfg.crossplanTimeoutMs) || 900000; // crossplan
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
  return capMs + 300000; // crossplan — one attempt, plus probe margin
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

// The server's own voice. Prefixed so it can never be read as engine output,
// attributes no cause it did not measure, and names no engine. Returns the
// composed text (not just sends it) so every caller builds it exactly once.
function composeTransportText(lines) {
  return ['MCP TRANSPORT ERROR (orchestra-engine server, not the engine):', ...lines].join('\n');
}

function transportError(id, lines) {
  textResult(id, composeTransportText(lines), true);
}

/* --------------------------------------------------- model/effort ids -- */

// A caller may pass a ROSTER display name ("GPT-5.6 Sol"); the Codex CLI
// wants the model id ("gpt-5.6-sol"). Shakedown 2026-09-02 (PL-18 root
// cause, corrected): forwarding a display name verbatim as `--model` made
// Codex answer 400 with an entitlement-shaped message for what was actually
// a name-shape defect. Anything already id-shaped passes through unchanged;
// unknown display names fall back to lower-case with spaces hyphenated,
// which is the id convention for every OpenAI model name.
const CODEX_MODEL_IDS = {
  'gpt-5.6 sol': 'gpt-5.6-sol',
};
function codexModelId(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  if (!/\s/.test(s)) return s;
  const key = s.toLowerCase();
  return CODEX_MODEL_IDS[key] || key.replace(/\s+/g, '-');
}
// Same shape defect for EFFORT (shakedown 2026-09-02, Tug of War A2): a
// caller-supplied `med` must become Codex's `medium` (its
// model_reasoning_effort field accepts only the long spelling); every other
// effort level (none/low/high/xhigh/max) is already Codex's own spelling.
const CODEX_EFFORTS = { med: 'medium' };
function codexEffort(level) {
  const s = String(level || '').trim().toLowerCase();
  if (!s) return null;
  return CODEX_EFFORTS[s] || s;
}

/* ------------------------------------------------- in-flight run registry -- */

// JSON-RPC request id -> the run it started. Populated at spawn, cleared in the
// child's 'close' handler so it cannot leak. Without it the server had no way
// back from a request id to the process it started, so `notifications/cancelled`
// had nothing to act on and was discarded — a "stopped" call kept running.
const IN_FLIGHT = new Map();

// Every request id this server has DISPATCHED A TOOL CALL for, JSON type
// included — recorded when the call arrives, not when a process starts, so a
// call that dies in argument validation still counts as an id used here. The
// loose match in lookupRun consults it; see there for why. Capped oldest-first:
// a session's request ids are few and short, but nothing here may grow without
// bound.
const SEEN_IDS = new Set();
const SEEN_ORDER = [];
const SEEN_CAP = 4096;
const idKey = (v) => `${typeof v}:${String(v)}`;

function rememberId(id) {
  const k = idKey(id);
  if (SEEN_IDS.has(k)) return;
  SEEN_IDS.add(k);
  SEEN_ORDER.push(k);
  while (SEEN_ORDER.length > SEEN_CAP) SEEN_IDS.delete(SEEN_ORDER.shift());
}

function lookupRun(requestId) {
  if (IN_FLIGHT.has(requestId)) return IN_FLIGHT.get(requestId);

  // Loose match, for a client that echoes an id back with a different JSON type
  // (request id 7, cancellation "7"). Allowed ONLY when this exact id-and-type
  // was never used by a tool call here. The exact lookup above misses for any
  // id no longer in flight — one whose run finished, AND one whose call never
  // started a run at all (bad arguments, unknown tool, missing runner) — so
  // without this guard a late cancellation naming a spent numeric 1 would alias
  // onto a still-running string "1" and kill an unrelated run.
  if (SEEN_IDS.has(idKey(requestId))) {
    process.stderr.write(`MCP TRANSPORT: refused a loose id match cancelling ${idKey(requestId)} — that id belongs to a different call here.\n`);
    return undefined;
  }
  let hit;
  for (const [k, v] of IN_FLIGHT) {
    if (String(k) !== String(requestId)) continue;
    if (hit) return undefined; // more than one loose candidate: never guess
    hit = v;
  }
  return hit;
}

const KILL_GRACE_MS = 3000;        // POSIX SIGTERM -> SIGKILL escalation window
const TASKKILL_TIMEOUT_MS = 5000;  // taskkill answers in milliseconds or not at all

// Kill the runner AND everything it spawned. The runners drive the Codex CLI
// with spawnSync, so the engine is a GRANDCHILD of this server (on Windows a
// great-grandchild, behind a cmd.exe shim): killing the direct child leaves
// `codex` running (in the exec lane, still editing a workspace-write tree), and
// the runner cannot help — its event loop is blocked inside spawnSync, so a
// signal handler there could never fire.
//   Windows: taskkill /T walks the OS process tree.
//   POSIX:   the runner leads its own process group (spawn detached), so the
//            group is signalled as one, SIGTERM then SIGKILL.
// Always records what it actually did in run.killOutcome / run.treeConfirmed:
// the transport reports the outcome it measured, never a kill it assumed.
// `immediate` is for teardown, where no timer can fire and there is nothing to
// be polite about.
function killTree(run, immediate) {
  const child = run && run.child;
  if (!child || !child.pid) return;
  if (child.exitCode !== null || child.signalCode !== null) {
    // Raced with the run ending on its own. Say so — claiming a kill that never
    // happened is a false statement in the transport's authoritative voice.
    if (!run.killOutcome) {
      run.killOutcome = 'the runner had already exited on its own; there was nothing left to kill';
      run.treeConfirmed = true;
    }
    return;
  }
  const pid = child.pid;

  if (process.platform === 'win32') {
    let ok = false, detail = '';
    try {
      const r = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'],
        { windowsHide: true, timeout: TASKKILL_TIMEOUT_MS, encoding: 'utf8' });
      // spawnSync REPORTS failure rather than throwing: a missing taskkill, a
      // non-zero status and a timeout all arrive in the result object. Not
      // reading it is how a failed tree-kill gets reported as a successful one.
      if (r.error) detail = `taskkill could not run: ${r.error.message}`;
      else if (r.status !== 0) {
        const firstLine = String(r.stderr || '').trim().split(/\r?\n/)[0];
        detail = `taskkill exited ${r.status}${firstLine ? ': ' + firstLine : ''}`;
      } else ok = true;
    } catch (e) {
      detail = `taskkill threw: ${e.message}`;
    }
    try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
    run.treeConfirmed = ok;
    run.killOutcome = ok
      ? `taskkill /PID ${pid} /T /F killed the process tree`
      : `taskkill /T /F did NOT confirm the kill (${detail}); only the direct runner process could be signalled`;
    return;
  }

  const signalGroup = (sig) => {
    try { process.kill(-pid, sig); return true; } catch (e) {
      if (e && e.code === 'ESRCH') return true; // the whole group is already gone
      try { child.kill(sig); } catch (__) { /* already gone */ }
      return false;
    }
  };

  if (immediate) {
    const ok = signalGroup('SIGKILL');
    run.treeConfirmed = ok;
    run.killOutcome = ok
      ? `SIGKILL to process group ${pid}`
      : `the process group could not be signalled; only the direct runner process was`;
    return;
  }

  const grouped = signalGroup('SIGTERM');
  run.treeConfirmed = grouped;
  run.killOutcome = grouped
    ? `SIGTERM to process group ${pid}, SIGKILL escalation armed (${KILL_GRACE_MS}ms)`
    : `the process group could not be signalled; only the direct runner process was — a descendant engine may survive`;

  // The escalation is armed once and is NEVER cleared — not by the runner's own
  // 'close', not by anything. The runner dies on SIGTERM within milliseconds; a
  // descendant that ignores or slow-handles SIGTERM outlives it, so clearing
  // this timer when the runner closes would disarm the sweep in precisely the
  // case it exists for. It is unref'd, so an armed sweep never holds the server
  // open, and signalling a group with no members is a harmless ESRCH.
  if (!run.killTimer) {
    run.killTimer = setTimeout(() => signalGroup('SIGKILL'), KILL_GRACE_MS);
    if (typeof run.killTimer.unref === 'function') run.killTimer.unref();
  }
}

// A client asked to cancel a request. If it is still in flight, kill its whole
// process tree; the child's 'close' handler then resolves the request the same
// way the kill-backstop does, so the caller gets a coherent MCP TRANSPORT
// result instead of a hang.
function cancelRun(requestId, reason) {
  const run = lookupRun(requestId);
  if (!run) return; // already finished, or never one of ours — nothing to do
  run.cancelled = true;
  run.cancelReason = (typeof reason === 'string' && reason.trim()) ? reason.trim() : '';
  killTree(run);
}

// Teardown. Nothing this server started may outlive it: the POSIX detach above
// takes the runner out of the server's process group, so a terminal's
// SIGINT/SIGHUP no longer reaches the runner and the engine on its own — the
// server has to pass it on. Runs on paths where no timer can fire ('exit' in
// particular), so it signals with SIGKILL immediately rather than arming an
// escalation nothing would ever run.
function drainInFlight() {
  for (const run of IN_FLIGHT.values()) {
    try { killTree(run, true); } catch (_) { /* best effort; we are leaving */ }
  }
  IN_FLIGHT.clear();
}
process.on('exit', drainInFlight); // also covers stdin 'end', which exits through here
// Handling these replaces the default disposition, so the server now exits 0 on
// a signal where it previously exited 128+signal. Nothing reads this process's
// exit code (it is an MCP stdio server, not a runner whose status is a verdict),
// and draining is worth more than the code.
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  try {
    process.on(sig, () => { drainInFlight(); process.exit(0); });
  } catch (_) { /* signal not supported on this platform */ }
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
      // POSIX only: lead a process group, so killTree can signal the runner AND
      // the engine it blocks on as one unit. Windows walks the tree with
      // taskkill /T instead and needs no detach. stdio stays piped either way,
      // and the child is never unref'd, so the run's lifecycle is unchanged.
      detached: process.platform !== 'win32',
    });
  } catch (e) {
    transportError(id, [`the runner process could not be spawned: ${e.message}`]);
    return;
  }

  const run = { child, cancelled: false, cancelReason: '', killTimer: null, killOutcome: '', treeConfirmed: false };
  if (id !== undefined && id !== null) IN_FLIGHT.set(id, run); // rememberId happens at dispatch, not here

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
    // The tree, not the child: the runner blocks on the engine via spawnSync,
    // so a direct-child kill leaves the engine running (the same defect that
    // made cancellation silent).
    killTree(run);
  }, killAfter);

  child.on('error', (e) => {
    clearTimeout(backstopTimer); if (progressTimer) clearInterval(progressTimer);
    if (id !== undefined && id !== null) IN_FLIGHT.delete(id);
    // A cancellation already owns this request's answer. Staying silent here
    // keeps ONE response on one JSON-RPC id, and lets the 'close' handler
    // deliver the accurate one instead of a misleading "failed to launch"
    // ahead of it. run.killTimer is deliberately NOT cleared — see killTree.
    if (run.cancelled) return;
    transportError(id, [`the runner process failed to launch or crashed at the OS level: ${e.message}`]);
  });

  child.on('close', (code, signal) => {
    clearTimeout(backstopTimer); if (progressTimer) clearInterval(progressTimer);
    // Registry cleanup lives HERE and only here: node emits 'close' after
    // 'error' in every case, including a spawn that failed at the OS level, so
    // this always runs. run.killTimer is deliberately left armed (see killTree)
    // — the SIGKILL sweep must outlive the runner it was armed for.
    if (id !== undefined && id !== null) IN_FLIGHT.delete(id);
    const elapsed = Date.now() - started;
    const tail = (s, n) => (s.length > n ? '…' + s.slice(-n) : s);
    const unconfirmed = 'WARNING: this server could NOT confirm the whole process tree died. A descendant ' +
      'engine process may still be running — and in the exec lane, still editing the tree. Look for a stray ' +
      'engine process before starting another run.';

    if (run.cancelled) {
      // The MCP spec says a receiver SHOULD NOT respond to a cancelled request.
      // Answering anyway is deliberate: a client that has moved on ignores an
      // unmatched id, while one still waiting would otherwise hang until its
      // own timeout with no idea what became of the run.
      const lines = [
        `the ${lane} run was CANCELLED by the client (notifications/cancelled) after ${elapsed}ms` +
          (run.cancelReason ? ` — reason: ${run.cancelReason}` : '') +
          `. THIS SERVER stopped the runner and the engine below it: ${run.killOutcome || 'no kill was required'}.`,
        'No report exists for this call: the run was stopped, not completed. Treat it exactly as an ' +
          'unavailable lane — nothing the engine may have produced is a result.',
        'The engine was killed mid-flight, so whatever it had already written stands: the WORKING TREE MAY BE ' +
          'HALF-EDITED and no TREE AUDIT exists for this run. Audit the tree before proceeding.',
      ];
      if (!run.treeConfirmed) lines.push(unconfirmed);
      lines.push(`runner stdout tail:\n${tail(out, 4000) || '(empty)'}`);
      lines.push(`runner stderr tail:\n${tail(err, 2000) || '(empty)'}`);
      transportError(id, lines);
      return;
    }

    if (backstopFired) {
      const lines = [
        `the ${lane} runner exceeded the server's kill-backstop (${killAfter}ms; runner cap ${capMs}ms) and was killed by THIS SERVER after ${elapsed}ms.`,
        'This is a runner-process anomaly: the runner\'s own timer should always fire first.',
        `how it was stopped: ${run.killOutcome || 'no kill was required'}.`,
      ];
      if (!run.treeConfirmed) lines.push(unconfirmed);
      lines.push(`runner stdout tail:\n${tail(out, 4000) || '(empty)'}`);
      lines.push(`runner stderr tail:\n${tail(err, 2000) || '(empty)'}`);
      transportError(id, lines);
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
      const lines = [
        `the runner exited abnormally (code=${code}, signal=${signal || 'none'}) after ${elapsed}ms — the runners exit 0 on every report path, so this output is NOT a runner report.`,
        `captured stdout${outTruncated ? ' (truncated)' : ''}:\n${out || '(empty)'}`,
        `captured stderr${errTruncated ? ' (truncated)' : ''}:\n${tail(err, 4000) || '(empty)'}`,
      ];
      transportError(id, lines);
      return;
    }

    if (!out.trim()) {
      const lines = [
        `the runner exited 0 after ${elapsed}ms but wrote nothing to stdout — no report exists for this call.`,
        `stderr tail:\n${tail(err, 4000) || '(empty)'}`,
      ];
      transportError(id, lines);
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
      let workOrder, executorReport;
      try {
        workOrder = requireString(a, 'work_order');
        executorReport = requireString(a, 'executor_report');
      } catch (e) {
        textResult(id, String(e && e.message ? e.message : e), true);
        return;
      }
      const dir = makeRunDir('review');
      const args = [
        '--work-order', writeInput(dir, 'work-order.txt', workOrder),
        '--executor-report', writeInput(dir, 'executor-report.txt', executorReport),
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
      'this ONCE per work order and relay a STATUS: EXEC_UNAVAILABLE as-is. Default model gpt-5.6-sol at high ' +
      'reasoning effort — this is the exceptional-order executor, never routine work; model/effort overrides ' +
      'are for an explicit exceptional order, never a launcher\'s own judgment.',
    inputSchema: {
      type: 'object',
      properties: {
        work_order: { type: 'string', description: 'The FULL execution work order — goal, scope, constraints, context, verification expectations — verbatim.' },
        timeout_ms: { type: 'number', description: 'Wall-clock cap, only when the order names one. Default 1800000 — budget a build plus a suite.' },
        forbid: { type: 'array', items: { type: 'string' }, description: 'Specific commands the executor must not run.' },
        cd: { type: 'string', description: 'Isolated worktree directory to execute in, only when the order names one.' },
        model: { type: 'string', description: 'Pin a specific model for this run, only when the order names one.' },
        effort: { type: 'string', description: 'Reasoning effort override, only when the order names one.' },
      },
      required: ['work_order'],
    },
    handler(id, a, progressToken) {
      let workOrder;
      try {
        workOrder = requireString(a, 'work_order');
      } catch (e) {
        textResult(id, String(e && e.message ? e.message : e), true);
        return;
      }
      const callerModel = typeof a.model === 'string' && a.model.trim() ? a.model.trim() : null;
      const callerEffort = typeof a.effort === 'string' && a.effort.trim() ? a.effort.trim() : null;
      const effectiveModel = codexModelId(callerModel);
      const effectiveEffort = codexEffort(callerEffort);

      const dir = makeRunDir('exec');
      const args = ['--work-order', writeInput(dir, 'work-order.txt', workOrder)];
      if (num(a.timeout_ms)) args.push('--timeout-ms', String(num(a.timeout_ms)));
      pushForbids(args, a.forbid);
      if (typeof a.cd === 'string' && a.cd.trim()) args.push('--cd', a.cd);
      if (effectiveModel) args.push('--model', effectiveModel);
      if (effectiveEffort) args.push('--effort', effectiveEffort);
      runRunner(id, 'exec', args, progressToken);
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
      if (typeof a.effort === 'string' && a.effort.trim()) args.push('--effort', codexEffort(a.effort));
      if (typeof a.model === 'string' && a.model.trim()) args.push('--model', a.model);
      if (num(a.timeout_ms)) args.push('--timeout-ms', String(num(a.timeout_ms)));
      runRunner(id, 'crossplan', args, progressToken);
    },
  },
  {
    name: 'orchestra_doctor',
    description:
      'Check the Codex install without spending a review: resolves the real codex binary, names the install ' +
      'layout, verifies the helper files that must sit directly beside it, and prints the exact copy command ' +
      'for anything missing. Read-only by default; pass repair=true to let it restore helper files from ' +
      'codex.helpersDir. The result starts with DOCTOR EXIT CODE: 0 (a review would find a complete install) ' +
      'or 1 (it would not, and the output says why). Pass live=true to also prove the exec-lane round-trip ' +
      'with a real no-op engine run.',
    inputSchema: {
      type: 'object',
      properties: {
        live: { type: 'boolean', description: 'Also run the live no-op engine probe (--doctor --live). Slower; spends a real engine call.' },
        repair: { type: 'boolean', description: 'Let the doctor copy missing/changed helper files in from codex.helpersDir. Default false (read-only) — this mutates the Codex install on the user\'s machine, so only pass true on the Director\'s or user\'s say-so.' },
      },
    },
    handler(id, a, progressToken) {
      const args = ['--doctor'];
      if (!(a && a.repair === true)) args.push('--no-repair');
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
          serverInfo: { name: 'orchestra-engine', version: '3.0.0' },
        },
      });
      return;
    }
    if (method === 'notifications/initialized') return;
    if (method === 'notifications/cancelled') {
      // A cancellation is the ONLY thing that can stop a run early. The runner
      // cannot honour one itself (it is blocked inside spawnSync), and the MCP
      // server is session-scoped — not a child of the calling agent — so
      // nothing downstream dies when that agent is stopped. Discarding this
      // notification is what let a "stopped" call keep editing the tree.
      const requestId = params && params.requestId;
      if (requestId !== undefined && requestId !== null) cancelRun(requestId, params && params.reason);
      return;
    }
    if (method === 'ping') { send({ jsonrpc: '2.0', id, result: {} }); return; }
    if (method === 'tools/list') {
      send({
        jsonrpc: '2.0', id,
        result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
      });
      return;
    }
    if (method === 'tools/call') {
      // Remember the id HERE, at dispatch — before anything can fail. A call
      // that never reaches a spawn (unknown tool, bad arguments, missing runner)
      // has still USED this id, so a later cancellation naming it must never be
      // allowed to loose-match onto a different, live run.
      if (id !== undefined && id !== null) rememberId(id);
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
