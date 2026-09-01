#!/usr/bin/env node
'use strict';
/*
 * orchestra-engine — MCP server for the Orchestra codex pack.
 *
 * Exposes the three runners (review / exec / cross-compare) plus
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

/* -------------------------------------------------- WO-14b leg 4: bridge -- */

// bridge/runtime.js ships two places: the source tree (ROOT/bridge/) and,
// after install.js --roster new, the installed copy
// (ROOT/.claude/orchestra/bridge/). Installed is checked first since that is
// where a real installed project keeps it; the source-tree path is what
// tests (and this repo's own dev loop) use.
function loadBridgeRuntime() {
  for (const p of [
    path.join(ROOT, '.claude', 'orchestra', 'bridge', 'runtime.js'),
    path.join(ROOT, 'bridge', 'runtime.js'),
  ]) {
    if (fs.existsSync(p)) {
      try { return require(p); } catch (_) { return null; }
    }
  }
  return null;
}

// bridge/manifest.js ships alongside runtime.js in both layouts (see
// loadBridgeRuntime above) — same two candidate paths, same load-or-null
// contract.
function loadBridgeManifestModule() {
  for (const p of [
    path.join(ROOT, '.claude', 'orchestra', 'bridge', 'manifest.js'),
    path.join(ROOT, 'bridge', 'manifest.js'),
  ]) {
    if (fs.existsSync(p)) {
      try { return require(p); } catch (_) { return null; }
    }
  }
  return null;
}

// WO-14b leg 4 fix round (item 3): an install footprint that survives even
// when the manifest itself, or bridge/manifest.js, cannot be read at all —
// mirrored verbatim in bridge/manifest.js's own hasRosterNewFingerprint();
// the two must never diverge. Independent of (never delegated to) the
// bridge module, since the whole point is covering the case where THAT
// module cannot be loaded.
const ROSTER_ROLE_FILENAMES = [
  'architect.md', 'builder.md', 'builder-openai.md', 'conductor.md', 'data-engineer.md',
  'investigator.md', 'red-team.md', 'reviewer-anthropic.md', 'reviewer-openai.md', 'sweeper.md',
  'test-designer-vs-anthropic.md', 'test-designer-vs-openai.md',
];
const MANIFEST_FINGERPRINT_KEYS = ['projectId', 'installedFiles', 'installedPermissions', 'installedHooks', 'rosterGeneration'];

function hasRosterNewFingerprint(dir) {
  if (fs.existsSync(path.join(dir, '.claude', 'orchestra'))) return true;
  if (fs.existsSync(path.join(dir, 'ORCHESTRA-CONDUCTOR.md'))) return true;
  try {
    const entries = fs.readdirSync(path.join(dir, '.claude', 'agents'));
    if (entries.some((f) => ROSTER_ROLE_FILENAMES.includes(f))) return true;
  } catch (_) { /* no agents dir, or unreadable */ }
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'orchestra.json'), 'utf8'));
    if (raw && typeof raw === 'object' && MANIFEST_FINGERPRINT_KEYS.some((k) => Object.prototype.hasOwnProperty.call(raw, k))) return true;
  } catch (_) { /* missing/unreadable/invalid — no fingerprint from this source */ }
  return false;
}

// Item 10 (owner amendment, roster/wo14b-finish-plan.md): under roster:new,
// every lane that can invoke the engine WITHOUT any ticket binding at all
// (orchestra_crossplan — no ticket concept exists for it; orchestra_doctor's
// --live probe — a real, if no-op, engine invocation) must refuse outright
// rather than spend an unticketed engine call. Legacy is unaffected (today's
// behaviour, unchanged).
function rosterIsNewAtRoot() {
  return readOrchestraManifest(ROOT).roster === 'new';
}

// WO-14b repair A item 3 (oracle-deferred canary): resolves a `cd` argument
// to an absolute path for the ONE thing this file still uses it for — the
// CD_NOT_SUPPORTED cross-project check in requireEngineTicket() below.
// Ticket enforcement itself is evaluated against ROOT only (see there).
function resolveCdTarget(cdArg) {
  const p = path.isAbsolute(cdArg) ? cdArg : path.join(ROOT, cdArg);
  try { return fs.realpathSync(p); } catch (_) { return path.resolve(p); }
}

// WO-14b leg 4b: goes through bridge/manifest.js's readTrustedManifest()
// exactly as bridge/runtime.js's own createRuntime() does — the manifest's
// OWN roster field is never trusted without a matching owner pin (see
// bridge/manifest.js and roster/wo14b-leg3-redteam-1.md's [HIGH] finding).
// Returns readTrustedManifest()'s shape ({manifest, trusted, roster,
// rosterGeneration, seats, reason}); a missing bridge/manifest.js (an
// installed project pre-dating leg 4b) degrades to the unpinned/legacy shape
// rather than throwing — item 3's fingerprint gate in requireEngineTicket()
// below is what keeps that degrade from silently skipping enforcement.
function readOrchestraManifest(dir) {
  const mod = loadBridgeManifestModule();
  if (!mod) return { manifest: {}, trusted: false, roster: 'legacy', rosterGeneration: null, seats: {}, reason: 'unpinned' };
  try {
    return mod.readTrustedManifest({ projectDir: dir });
  } catch (e) {
    return {
      manifest: {}, trusted: false, roster: 'legacy', rosterGeneration: null, seats: {},
      reason: 'readTrustedManifest() threw: ' + (e && e.message ? e.message : String(e)),
    };
  }
}

// Item 2 (the two-pass fix), item 3 (server's own project only), item 5
// (role+vendor bound), item 6 (caller-declared casting, comparison only):
// records the engine's enginePass() on an already-LAUNCHED ticket bound to
// `phase` ('exec'|'review') before ANY codex spawn — NEVER consume() (the
// Agent tool's own Pre/PostToolUse hooks already carried the launcher's
// ticket OPEN -> CONSUMED -> LAUNCHED before the launcher ever reaches this
// server). Returns { ok:true, runtime, consumed } to proceed, or
// { ok:false } after already sending the typed TICKET_REQUIRED/
// TICKET_MISMATCH/TICKET_REPLAY/TICKET_EXPIRED/CASTING_MISMATCH/
// CD_NOT_SUPPORTED result — the caller must return immediately without
// calling runRunner.
//
// Item 3 (oracle-deferred canary): a prior version rooted enforcement at
// `cd`'s own target directory — meant to let a legacy-rooted server ticket
// an execution into a trusted roster:new `cd` target, but in practice it
// could load neither that target's bridge modules (never installed at
// ROOT) nor bind its ticket, so a genuinely valid ticket still came back
// TICKET_REQUIRED. Building real cross-project module loading is out of
// this repair's scope (no new cross-project runner — see the order's
// forbidden list); enforcement is evaluated against THIS SERVER'S OWN
// project (ROOT) only, and a `cd` that actually leaves ROOT is refused
// outright with a typed CD_NOT_SUPPORTED — whenever ROOT is roster:new
// (it already enforces, just never against a directory that isn't itself)
// OR the cd target itself carries a roster:new fingerprint (a legacy
// server must not become a side door around a trusted roster:new
// project's own enforcement) — rather than silently mis-enforcing (or, for
// a legacy ROOT with a roster:new cd target, silently NOT enforcing at
// all). Under roster:legacy with an unfingerprinted cd (or none) this is a
// no-op pass-through — BUT
// only when ROOT carries no roster:new install fingerprint at all. A
// fingerprint present (the manifest itself, or bridge/manifest.js, is
// missing/unloadable/untrusted while the rest of a roster:new install
// still stands) fails closed to typed TICKET_REQUIRED instead of silently
// invoking codex — UNLESS the manifest is itself a TRUSTED explicit
// legacy manifest (a pin corroborates it, e.g. after a legitimate
// new->legacy flip that leaves the runtime directory behind): a trusted
// manifest's own word is never second-guessed by this filesystem
// heuristic (item 2).
function requireEngineTicket(id, phase, ticketId, role, cdArg, callerCasting) {
  const manifest = readOrchestraManifest(ROOT);
  if (typeof cdArg === 'string' && cdArg.trim()) {
    const cdTarget = resolveCdTarget(cdArg);
    // Refuse whenever ticket enforcement could plausibly apply to a
    // genuinely cross-project `cd` — either THIS server's own root is
    // roster:new (so it already enforces, just never against a directory
    // that isn't itself), or the cd TARGET carries a roster:new install
    // fingerprint of its own (a legacy-rooted server must not become a
    // side door into a trusted roster:new project's ticket enforcement —
    // this is exactly the gap the review's cd-scoped probe found). A cd
    // into an ordinary legacy directory, from an ordinary legacy server,
    // is unaffected — the common case (an isolated worktree) still works.
    if (cdTarget !== ROOT && (manifest.roster === 'new' || hasRosterNewFingerprint(cdTarget))) {
      textResult(id, 'CD_NOT_SUPPORTED: this server enforces engine tickets against its own project ' +
        '(' + ROOT + ') only — a cross-project cd (' + cdArg + ') that may itself require ticket ' +
        'enforcement is not supported.', true);
      return { ok: false };
    }
  }
  if (manifest.roster !== 'new') {
    if (!manifest.trusted && hasRosterNewFingerprint(ROOT)) {
      textResult(id, 'TICKET_REQUIRED: ' + ROOT + ' carries a roster:new install fingerprint but the manifest/bridge ' +
        'could not establish roster:new — refusing to invoke codex without ticket enforcement (fail closed).', true);
      return { ok: false };
    }
    return { ok: true, skip: true };
  }
  const bridge = loadBridgeRuntime();
  if (!bridge) {
    textResult(id, 'TICKET_REQUIRED: this project runs roster:new but the bridge runtime ' +
      '(bridge/runtime.js or .claude/orchestra/bridge/runtime.js) could not be loaded — ' +
      'refusing to invoke codex without ticket enforcement.', true);
    return { ok: false };
  }
  const runtime = bridge.createRuntime({ projectDir: ROOT });
  try {
    const consumed = runtime.ticketFor(phase, { id: ticketId, role, casting: callerCasting });
    return { ok: true, runtime, consumed };
  } catch (e) {
    const code = (e && e.code) || 'TICKET_REQUIRED';
    textResult(id, code + ': ' + (e && e.message ? e.message : String(e)), true);
    return { ok: false };
  }
}
// Item 7: orchestra_dispatch's MCP input schema IS the dispatch-request
// schema at top level — no `{request: {...}}` wrapper. Loaded the same
// installed-then-source-tree way as the bridge modules above; a resolver
// failure degrades to a permissive generic object schema rather than
// throwing (bridge/runtime.js's own dispatch() still enforces the real
// schema at call time regardless of what tools/list advertises).
function loadDispatchRequestSchema() {
  for (const p of [
    path.join(ROOT, '.claude', 'orchestra', 'registry', 'schemas', 'dispatch-request.schema.json'),
    path.join(ROOT, 'registry', 'schemas', 'dispatch-request.schema.json'),
  ]) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { /* fall through */ }
    }
  }
  return null;
}
const DISPATCH_REQUEST_SCHEMA = loadDispatchRequestSchema();
const DISPATCH_INPUT_SCHEMA = DISPATCH_REQUEST_SCHEMA
  ? {
      type: 'object',
      properties: DISPATCH_REQUEST_SCHEMA.properties,
      required: DISPATCH_REQUEST_SCHEMA.required,
      additionalProperties: false,
    }
  : { type: 'object', properties: {}, additionalProperties: true };

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
    return num(process.env.ORCHESTRA_REVIEW_TIMEOUT_MS) || num(cfg.reviewTimeoutMs) || 600000;
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
// composed text (not just sends it) so callers that also need it for ticket
// bookkeeping (see bindTicket below) build it exactly once.
function composeTransportText(lines) {
  return ['MCP TRANSPORT ERROR (orchestra-engine server, not the engine):', ...lines].join('\n');
}

function transportError(id, lines) {
  textResult(id, composeTransportText(lines), true);
}

/* --------------------------------------- WO-14b leg 4b: engine ticketing -- */

// Pull the RUN NONCE / served-model header fields a runner report exposes,
// for binding the engine ticket lifecycle (see bindTicket in runRunner()
// below). Neither field is guaranteed present:
//   - orchestra-exec.js prints "RUN NONCE: <hex>" in EVERY header
//     (headerTail(), success and failure paths alike).
//   - orchestra-review.js deliberately prints NO run nonce and NO
//     served_model line at all (its own header.js comment: Codex CLI's
//     --json event stream carries no server-confirmed model field, so
//     inventing one would be "the requested model echoed back" — exactly
//     the kind of unverifiable claim this file's reports refuse to make).
// A missing/absent match returns null; callers supply their own fallback.
function extractRunNonce(text) {
  const m = /RUN NONCE: ([0-9a-f]+)/.exec(String(text || ''));
  return m ? m[1] : null;
}
function extractReportedModel(text) {
  const m = /model:\s*([^,()\n]+)/.exec(String(text || ''));
  return m ? m[1].trim() : null;
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

// ticketBinding: { runtime, id, dir } — set by orchestra_review/orchestra_exec
// ONLY when requireEngineTicket() actually consumed a ticket for this call
// (roster:new; undefined under legacy or for the ungated crossplan/doctor
// lanes). Binds the CONSUMED ticket through this run's outcome:
//   - success / nonzero-exit / empty-output: launch() then resolve() — the
//     run genuinely happened (codex was invoked and produced SOME captured
//     output, even if it was a transport-class failure), so the ticket
//     records who ran (agent_id 'codex:'+the run's nonce, or a synthesized
//     one when the header carries none — see extractRunNonce above) and
//     what it said (the exact text this tool call is about to return).
//   - cancelled / backstop: denied('engine-cancelled'|'engine-backstop', ...)
//     only — the ticket is left CONSUMED/never-LAUNCHED (or LAUNCHED but
//     never RESOLVED, if a nonce did surface before the kill) for its own
//     TTL to expire, per the order: "leave the ticket for expiry".
//   - spawn never happened at all (runner missing, spawn() threw, or the
//     OS-level 'error' event) — no codex process, and so no nonce, ever
//     existed. Treated the same as cancelled/backstop (denied()-only, left
//     for expiry) rather than fabricating a launch/resolve for a run that
//     never occurred; this is an extension of the order's five named
//     branches, documented here because the order does not name it.
// Every call is best-effort: a TicketTransitionError/TicketStoreError here
// (e.g. the ticket already expired) is caught and never allowed to affect
// the MCP response already sent, and never fabricates success.
function bindTicket(ticketBinding, branch, text, reason) {
  if (!ticketBinding) return;
  // Idempotence guard: node emits 'close' after 'error' even for a runner
  // that failed at the OS level (see the comment above the 'close' handler),
  // so a spawn-error branch's bindTicket() call must not be followed by a
  // second, contradictory one from 'close' re-deriving a different branch
  // for the same run. Whichever fires first wins; the ticket is bound once.
  if (ticketBinding._bound) return;
  ticketBinding._bound = true;
  const { runtime, id: ticketId, dir } = ticketBinding;
  try {
    if (branch === 'cancelled' || branch === 'backstop' || branch === 'spawn-error') {
      try {
        runtime.denied(ticketId, 'engine-' + branch, reason || branch);
      } catch (e) {
        process.stderr.write(`MCP TRANSPORT: engine ticket ${ticketId} denied()-bookkeeping failed (${branch}): ${e && e.message}\n`);
      }
      return;
    }
    // success / nonzero-exit / empty-output: the run happened (or at least a
    // process ran to completion). WO-14b leg 4 fix round (item 2): the
    // ticket is already LAUNCHED (via the Agent tool's own Pre/PostToolUse
    // hooks on the launcher's own spawn, BEFORE this server was ever
    // called) — bind the engine's own verbatim report via engineResult(),
    // never launch()/resolve() here. The ticket's real terminal RESOLVED
    // transition still comes from the launcher's own SubagentStop.
    try {
      runtime.engineResult(ticketId, { report: text, run_log: dir });
      // Item 7: the engine-reported identity, never invented — router/
      // tickets.js's ticket schema has no field for it (this repair does
      // not add one; see bridge/runtime.js's enginePass() call, which
      // records 'UNKNOWN' rather than a fabricated pre-run nonce), so the
      // server's own diagnostic stream is where it is recorded: extracted
      // verbatim from the runner's own report text, 'UNKNOWN' when the
      // header carries neither field, never a launcher identity.
      const runNonce = extractRunNonce(text) || 'UNKNOWN';
      const reportedModel = extractReportedModel(text) || 'UNKNOWN';
      process.stderr.write(`MCP TRANSPORT: engine ticket ${ticketId} identity — run_nonce=${runNonce} model=${reportedModel}\n`);
    } catch (e) {
      process.stderr.write(`MCP TRANSPORT: engine ticket ${ticketId} engineResult()-bookkeeping failed (${branch}): ${e && e.message}\n`);
    }
  } catch (e) {
    // Never let ticket bookkeeping affect (or throw out of) the completion
    // handler — the MCP response to the caller is already authoritative.
    process.stderr.write(`MCP TRANSPORT: engine ticket ${ticketId} bookkeeping threw (${branch}): ${e && e.message}\n`);
  }
}

function runRunner(id, lane, args, progressToken, extraEnv, prefixText, ticketBinding) {
  const runner = RUNNERS[lane === 'doctor' ? 'review' : lane];
  if (!fs.existsSync(runner)) {
    bindTicket(ticketBinding, 'spawn-error', null, 'runner not found at ' + runner);
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
    bindTicket(ticketBinding, 'spawn-error', null, 'spawn() threw: ' + e.message);
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
    bindTicket(ticketBinding, 'spawn-error', null, 'OS-level error: ' + e.message);
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
      // Ticket bookkeeping runs BEFORE the response is sent (not after): the
      // response reaches the caller over a separate pipe the moment it is
      // written, and a caller/test that reacts immediately (closing the
      // session, querying the ticket) must never be able to observe a report
      // whose ticket lifecycle hasn't landed yet.
      bindTicket(ticketBinding, 'cancelled', null,
        `cancelled after ${elapsed}ms` + (run.cancelReason ? ` — ${run.cancelReason}` : ''));
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
      bindTicket(ticketBinding, 'backstop', null,
        `killed by the server's kill-backstop after ${elapsed}ms (backstop ${killAfter}ms, runner cap ${capMs}ms)`);
      transportError(id, lines);
      return;
    }

    if (lane === 'doctor') {
      // --doctor is the one runner mode whose exit code is meaningful.
      const text = `DOCTOR EXIT CODE: ${code}\n` + out + (err ? `\n[doctor stderr]\n${err}` : '') + (prefixText ? `\n${prefixText}` : '');
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
      bindTicket(ticketBinding, 'nonzero-exit', composeTransportText(lines), `runner exited code=${code} signal=${signal || 'none'}`);
      transportError(id, lines);
      return;
    }

    if (!out.trim()) {
      const lines = [
        `the runner exited 0 after ${elapsed}ms but wrote nothing to stdout — no report exists for this call.`,
        `stderr tail:\n${tail(err, 4000) || '(empty)'}`,
      ];
      bindTicket(ticketBinding, 'empty-output', composeTransportText(lines), 'runner exited 0 with empty stdout');
      transportError(id, lines);
      return;
    }

    let text = out;
    if (outTruncated) text += '\n\nMCP TRANSPORT NOTE: runner stdout exceeded the 4MB capture cap and was truncated.';
    bindTicket(ticketBinding, 'success', text, null);
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
        ticket: { type: 'string', description: 'roster:new only: the reviewer ticket this call is bound to. Under roster:new a missing or mismatched ticket is refused (TICKET_REQUIRED/TICKET_MISMATCH) WITHOUT invoking codex. Ignored under legacy.' },
        role: { type: 'string', description: 'roster:new only: the ROLE=<role> value from the launcher\'s own Agent-prompt header — must match the ticket\'s own recorded role exactly, else TICKET_MISMATCH. Required whenever `ticket` is supplied.' },
      },
      required: ['work_order', 'executor_report'],
    },
    handler(id, a, progressToken) {
      // Item 4: argument-shape validation completes BEFORE
      // requireEngineTicket() is called — that call is what commits
      // enginePass() on the ticket, and a parameter error must never leave
      // a ticket LAUNCHED-with-engine_pass-set for a run that never
      // happened (a corrected retry would then see a false TICKET_REPLAY,
      // even though codex was never invoked).
      let workOrder, executorReport;
      try {
        workOrder = requireString(a, 'work_order');
        executorReport = requireString(a, 'executor_report');
      } catch (e) {
        textResult(id, String(e && e.message ? e.message : e), true);
        return;
      }
      // roster:new: records enginePass() on the reviewer ticket named by
      // `ticket`+`role` BEFORE any spawn (never consume() — see
      // requireEngineTicket()'s own comment) — a missing/mismatched/replayed
      // ticket returns typed TICKET_REQUIRED/TICKET_MISMATCH/TICKET_REPLAY
      // and never reaches runRunner (codex is never invoked). WO-14b leg 4
      // binds the engine's own report via engineResult() once the runner
      // completes — see bindTicket() in runRunner() above and
      // bridge/README.md "engine ticket lifecycle".
      const gated = requireEngineTicket(id, 'review', a && a.ticket, a && a.role);
      if (!gated.ok) return;
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
      const ticketBinding = (gated.runtime && gated.consumed) ? { runtime: gated.runtime, id: gated.consumed.id, dir } : undefined;
      runRunner(id, 'review', args, progressToken, undefined, undefined, ticketBinding);
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
        ticket: { type: 'string', description: 'roster:new only: the implementation/Q0 ticket this call is bound to. Under roster:new a missing or mismatched ticket is refused (TICKET_REQUIRED/TICKET_MISMATCH) WITHOUT invoking codex. Ignored under legacy.' },
        role: { type: 'string', description: 'roster:new only: the ROLE=<role> value from the launcher\'s own Agent-prompt header — must match the ticket\'s own recorded role exactly, else TICKET_MISMATCH. Required whenever `ticket` is supplied.' },
      },
      required: ['work_order'],
    },
    handler(id, a, progressToken) {
      // Item 4: work_order's own shape validation, before requireEngineTicket()
      // commits enginePass() — see orchestra_review's identical comment above.
      let workOrder;
      try {
        workOrder = requireString(a, 'work_order');
      } catch (e) {
        textResult(id, String(e && e.message ? e.message : e), true);
        return;
      }
      const callerModel = typeof a.model === 'string' && a.model.trim() ? a.model.trim() : null;
      const callerEffort = typeof a.effort === 'string' && a.effort.trim() ? a.effort.trim() : null;

      // See orchestra_review's handler comment — same roster:new ticket
      // gate, phase 'exec' (accepts an implementation or q0 ticket). Item 3:
      // `cd` is no longer the enforcement target — enforcement is always
      // against this server's own project; a genuinely cross-project `cd`
      // under roster:new is refused (CD_NOT_SUPPORTED) inside
      // requireEngineTicket() itself. Item 6: model/effort the caller
      // supplied are passed through for comparison ONLY — requireEngineTicket()
      // (via bridge/runtime.js's requireTicket()) refuses CASTING_MISMATCH,
      // zero invocations, before this call returns, if they disagree with
      // the ticket's own casting.
      const gated = requireEngineTicket(id, 'exec', a && a.ticket, a && a.role, a && a.cd, { model: callerModel, effort: callerEffort });
      if (!gated.ok) return;

      // Item 6: under a ticketed (roster:new) call the invocation's model
      // and effort ALWAYS come from the ticket's own casting — never the
      // caller. A caller-supplied value that disagreed already returned
      // CASTING_MISMATCH above (zero invocations); one that agreed, or was
      // never supplied, falls through to here. Legacy/unticketed calls
      // (gated.skip) have no ticket to source from, so the caller's own
      // values (if any) are used exactly as before.
      const effectiveModel = gated.consumed ? (gated.consumed.casting && gated.consumed.casting.model) || null : callerModel;
      const effectiveEffort = gated.consumed ? (gated.consumed.casting && gated.consumed.casting.effort) || null : callerEffort;

      const dir = makeRunDir('exec');
      const args = ['--work-order', writeInput(dir, 'work-order.txt', workOrder)];
      if (a.tier === 'heavy') args.push('--tier', 'heavy');
      if (num(a.timeout_ms)) args.push('--timeout-ms', String(num(a.timeout_ms)));
      pushForbids(args, a.forbid);
      if (typeof a.cd === 'string' && a.cd.trim()) args.push('--cd', a.cd);
      if (effectiveModel) args.push('--model', effectiveModel);
      if (effectiveEffort) args.push('--effort', effectiveEffort);
      const ticketBinding = (gated.runtime && gated.consumed) ? { runtime: gated.runtime, id: gated.consumed.id, dir } : undefined;
      runRunner(id, 'exec', args, progressToken, undefined, undefined, ticketBinding);
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
      // Item 10: orchestra_crossplan has no ticket concept at all — under
      // roster:new, every lane that can invoke the engine must be bound to
      // a ticket or refuse outright; this one refuses.
      if (rosterIsNewAtRoot()) {
        textResult(id, 'UNSUPPORTED: orchestra_crossplan has no ticket binding and is refused under roster:new.', true);
        return;
      }
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
    name: 'orchestra_dispatch',
    description:
      'WO-14b leg 4: validate a pre-dispatch request (this tool\'s own inputSchema IS ' +
      'registry/schemas/dispatch-request.schema.json — pass the request fields at the top level, no `request` ' +
      'wrapper) against the activation runtime, read one fresh Quartermaster snapshot, route it, and return the ' +
      'runtime\'s dispatch() result verbatim — on success, the issued implementation/Q0 tickets and the spawn ' +
      'instruction; otherwise the router\'s typed outcome (GATED, DISABLED, FORBIDDEN, WAIT, blocked:"Q0", ' +
      'RETIRED_WORKFLOW) or a typed P0_UNAVAILABLE/INVALID_REQUEST/STORE_UNAVAILABLE/ROUTING_LOG_UNAVAILABLE. ' +
      'roster:new only — under legacy this returns a typed refusal rather than dispatching.',
    inputSchema: DISPATCH_INPUT_SCHEMA,
    handler(id, a) {
      const bridge = loadBridgeRuntime();
      if (!bridge) {
        transportError(id, ['the bridge runtime (bridge/runtime.js or .claude/orchestra/bridge/runtime.js) could not be loaded']);
        return;
      }
      let result;
      try {
        const runtime = bridge.createRuntime({ projectDir: ROOT });
        result = runtime.dispatch(a || {});
      } catch (e) {
        transportError(id, ['orchestra_dispatch failed: ' + (e && e.message ? e.message : String(e))]);
        return;
      }
      textResult(id, JSON.stringify(result, null, 2), result && result.ok === false);
    },
  },
  {
    name: 'orchestra_close',
    description:
      'WO-14b leg 5: two-stage ticket closure. On a RESOLVED implementation ticket, validates the bound ' +
      'executor report and runs verifier.runVerification against it; on PASS, issues the computed opposite-' +
      'family reviewer ticket and returns stage REVIEW_PENDING. On a RESOLVED reviewer ticket, parses its ' +
      'mandatory trailing verdict-json block, constructs the verdict audit deterministically from replayed ' +
      'citation evidence and dispatcher-owned family facts, and CLOSES both tickets only for a genuinely ' +
      'closing verdict (APPROVE, cross-family, audit-valid, no blocking finding). On a RESOLVED Investigator ' +
      'ticket (class I0/N0/N1/N2/M0 — read-only recon, PL-10), validates the bound I0 VERDICT line, writes the ' +
      'casting record and CLOSES it directly (stage RECON_CLOSED): no Verifier, no reviewer. Returns bridge/runtime.js\'s ' +
      'close() result verbatim — every non-closing outcome is a typed NOT_CLOSED with a reason, never an ' +
      'exception. Never accepts a caller-supplied report or verdict — only the ticket id; the bound report is ' +
      'the one the host recorded at SubagentStop (or the engine run log for codex tickets).',
    inputSchema: {
      type: 'object',
      properties: {
        ticket: { type: 'string', description: 'The ticket id to close (an implementation or reviewer ticket already RESOLVED).' },
      },
      required: ['ticket'],
    },
    handler(id, a) {
      const bridge = loadBridgeRuntime();
      if (!bridge) {
        transportError(id, ['the bridge runtime (bridge/runtime.js or .claude/orchestra/bridge/runtime.js) could not be loaded']);
        return;
      }
      let result;
      try {
        const runtime = bridge.createRuntime({ projectDir: ROOT });
        result = runtime.close((a && a.ticket) || '');
      } catch (e) {
        transportError(id, ['orchestra_close failed: ' + (e && e.message ? e.message : String(e))]);
        return;
      }
      textResult(id, JSON.stringify(result, null, 2), result && result.ok === false);
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
      'also prove the exec-lane nonce round-trip with a real no-op engine run. Also reports the WO-14b bridge ' +
      'state — manifest roster, roster generation, ticket store health, and the count of open tickets.',
    inputSchema: {
      type: 'object',
      properties: {
        live: { type: 'boolean', description: 'Also run the live no-op engine probe (--doctor --live). Slower; spends a real engine call.' },
      },
    },
    handler(id, a, progressToken) {
      // Item 10: --live spends a real (if no-op) engine invocation with no
      // ticket binding — refused under roster:new. Plain --doctor (no live
      // probe) never invokes the engine at all and is unaffected.
      if (a && a.live && rosterIsNewAtRoot()) {
        textResult(id, 'UNSUPPORTED: orchestra_doctor live=true has no ticket binding and is refused under roster:new.', true);
        return;
      }
      const args = ['--doctor'];
      if (a && a.live) args.push('--live');
      const bridge = loadBridgeRuntime();
      let bridgeLine = 'BRIDGE: not available (bridge/runtime.js not found — leg 4 not installed/copied)';
      if (bridge) {
        try {
          const d = bridge.createRuntime({ projectDir: ROOT }).doctor();
          bridgeLine = 'BRIDGE: roster=' + d.roster + ' rosterGeneration=' + d.rosterGeneration +
            ' store=' + (d.store.ok ? 'ok' : 'UNAVAILABLE (' + d.store.error + ')') +
            ' openTickets=' + (d.openTickets === null ? 'n/a' : d.openTickets);
        } catch (e) {
          bridgeLine = 'BRIDGE: doctor() failed: ' + (e && e.message ? e.message : String(e));
        }
      }
      runRunner(id, 'doctor', args, progressToken, undefined, bridgeLine);
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
          serverInfo: { name: 'orchestra-engine', version: '2.0.0' },
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
