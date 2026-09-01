#!/usr/bin/env node
/**
 * MCP-lane tests — the orchestra-engine MCP server.
 *
 * The server is the transport that replaced the launcher shell pipeline
 * (heredoc-to-scratch, run tokens, sentinels, background-and-poll, stdout
 * scraping). These tests prove the replacement's own contract:
 *
 *   - a tool call returns the RUNNER'S stdout verbatim, never a rewrite;
 *   - everything the server says in its own voice is prefixed MCP TRANSPORT
 *     and marked isError, so it can never be read as engine output;
 *   - a runner that exits non-zero, writes nothing, or wedges is reported as
 *     the transport anomaly it is — with the evidence attached — instead of
 *     being retried, papered over, or promoted to a report.
 *
 * No dependencies, no test framework — plain node and git, like the other
 * lanes. The engine is the same stub the review/exec lanes use, injected via
 * CODEX_BIN.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
// Defaults to the master copy. Point ORCHESTRA_TEST_MCP_SERVER at a project's
// installed .claude/hooks/orchestra-engine-mcp.js to check what shipped.
const SERVER =
  process.env.ORCHESTRA_TEST_MCP_SERVER ||
  path.join(MASTER, 'packs', 'codex', 'hooks', 'orchestra-engine-mcp.js');
const HOOKS_DIR = path.join(MASTER, 'packs', 'codex', 'hooks');
const STUB = path.join(__dirname, 'fixtures', 'stub-codex.js');

let failures = 0;
let passes = 0;
const cleanups = [];

function check(name, ok, detail) {
  if (ok) {
    passes++;
    console.log('  PASS  ' + name);
  } else {
    failures++;
    process.exitCode = 1; // set the moment a failure exists, not at the end
    console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/\n/g, '\n        ') : ''));
  }
}

function section(title) {
  console.log('\n' + title);
}

process.on('exit', () => {
  if (failures > 0) process.exitCode = 1;
  else if (passes === 0) {
    console.log('\nFAILED — no checks ran at all (the suite did not execute)');
    process.exitCode = 1;
  }
});
process.on('unhandledRejection', (e) => {
  check('no unhandled rejection in the suite', false, (e && e.stack) || e);
  finish();
});
process.on('uncaughtException', (e) => {
  check('no uncaught exception in the suite', false, (e && e.stack) || e);
  finish();
});

// ------------------------------------------------------------------ fixtures

function git(args, cwd) {
  const r = spawnSync('git', ['-C', cwd].concat(args), { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error('git ' + args.join(' ') + ' failed in ' + cwd + ':\n' + (r.stderr || ''));
  }
  return (r.stdout || '').trim();
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-test-'));
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'project');
  fs.mkdirSync(repo);

  git(['init', '-q', '-b', 'main'], repo);
  git(['config', 'user.email', 'test@example.com'], repo);
  git(['config', 'user.name', 'Orchestra Test'], repo);
  git(['config', 'commit.gpgsign', 'false'], repo);

  fs.writeFileSync(path.join(repo, 'app.js'), 'function add(a, b) { return a + b; }\n');
  git(['add', '-A'], repo);
  git(['commit', '-qm', 'base'], repo);
  const base = git(['rev-parse', 'HEAD'], repo);

  fs.writeFileSync(path.join(repo, 'app.js'), 'function add(a, b) {\n  return a + b;\n}\n');
  git(['add', '-A'], repo);
  git(['commit', '-qm', 'reformat add()'], repo);
  const head = git(['rev-parse', 'HEAD'], repo);

  return { root, repo, base, head };
}

function makeStubBin(dir, base) {
  fs.mkdirSync(dir, { recursive: true });
  if (process.platform !== 'win32') {
    const dest = path.join(dir, base + '.js');
    fs.copyFileSync(STUB, dest);
    fs.chmodSync(dest, 0o755);
    return dest;
  }
  const dest = path.join(dir, base + '.cmd');
  fs.writeFileSync(dest, '@echo off\r\nnode "' + STUB + '" %*\r\nexit /b %ERRORLEVEL%\r\n', 'utf8');
  return dest;
}

const STUB_BIN = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-stubbin-'));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return makeStubBin(d, 'codex');
})();

const CLEAN_CODEX_HOME = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-codex-home-'));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
})();

// A directory standing in for a broken install target: hooks dir with no
// runners in it (case: runner not found), plus fixture "runners" with
// deliberately anomalous behavior (non-zero exit, empty stdout, wedge).
const FIXTURE_RUNNERS = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-fixture-runners-'));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  fs.mkdirSync(path.join(d, 'empty'));
  const bad = path.join(d, 'bad');
  fs.mkdirSync(bad);
  fs.writeFileSync(
    path.join(bad, 'orchestra-review.js'),
    'process.stdout.write("half a report, then death\\n"); process.exit(3);\n'
  );
  fs.writeFileSync(
    path.join(bad, 'orchestra-exec.js'),
    'process.exit(0);\n' // exit 0, no stdout at all
  );
  fs.writeFileSync(
    path.join(bad, 'orchestra-crossplan.js'),
    'setInterval(() => {}, 1000); // wedge forever; the backstop must fire\n'
  );

  // A wedge shaped like the REAL runners: it records its own pid, then blocks
  // its event loop inside spawnSync on a grandchild that records its pid and
  // wedges — exactly how orchestra-crossplan.js / orchestra-exec.js drive the
  // Codex CLI. Killing only the server's direct child leaves the grandchild
  // alive, which is the bug the cancellation path has to close.
  //
  // The grandchild IGNORES SIGTERM. That is the whole point: on POSIX the
  // runner dies on the group's SIGTERM within milliseconds, so a grandchild
  // that dies on the same signal proves nothing — the test would pass whether
  // or not the SIGKILL escalation survives the runner's exit. A SIGTERM-deaf
  // grandchild can only die by escalation, which is what makes case 9 a real
  // regression test for it. On Windows taskkill /T /F ignores the handler.
  const tree = path.join(d, 'tree');
  fs.mkdirSync(tree);
  const ENGINE_SRC =
    'process.on("SIGTERM", () => {});' +
    'require("fs").writeFileSync(process.env.ORCHESTRA_TEST_ENGINE_PIDFILE, String(process.pid));' +
    'setInterval(() => {}, 1000);';
  fs.writeFileSync(
    path.join(tree, 'orchestra-crossplan.js'),
    [
      'const fs = require("fs");',
      'const { spawnSync } = require("child_process");',
      'fs.writeFileSync(process.env.ORCHESTRA_TEST_RUNNER_PIDFILE, String(process.pid));',
      'spawnSync(process.execPath, ["-e", ' + JSON.stringify(ENGINE_SRC) + '], { stdio: "ignore" });',
      '',
    ].join('\n')
  );

  return { empty: path.join(d, 'empty'), bad, tree };
})();

// Is a pid still around? EPERM means it exists but is not ours to signal.
function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(fn, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    let v;
    try { v = fn(); } catch (_) { v = null; }
    if (v) return v;
    if (Date.now() > deadline) return null;
    await sleep(50);
  }
}

// ------------------------------------------------------------- MCP client

// Minimal newline-delimited JSON-RPC client over the server's stdio. One
// session per case keeps env variation independent.
function mcpSession(opts) {
  const fx = opts.fx;
  const child = spawn(process.execPath, [SERVER], {
    cwd: fx.repo,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: Object.assign(
      {},
      process.env,
      {
        ORCHESTRA_MCP_ROOT: fx.repo,
        ORCHESTRA_MCP_HOOKS_DIR: opts.hooksDir || HOOKS_DIR,
        CLAUDE_PROJECT_DIR: fx.repo,
        CODEX_BIN: STUB_BIN,
        // orchestra-review.js now refuses a CODEX_BIN resolving into tests/fixtures (or a shim pointing at it) unless this is set.
        ORCHESTRA_ALLOW_STUB_ENGINE: '1',
        CODEX_HOME: CLEAN_CODEX_HOME,
        ORCHESTRA_REVIEW_IDLE_MS: '0',
        ORCHESTRA_EXEC_IDLE_MS: '0',
        ORCHESTRA_REVIEW_MODEL: 'gpt-5.6-sol',
        ORCHESTRA_CODEX_HELPER_SIBLINGS: '',
        ORCHESTRA_EXEC_ARGS: '',
        ORCHESTRA_REVIEW_ARGS: '',
      },
      opts.env || {}
    ),
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  const pending = new Map();
  const notifications = [];
  let buf = '';
  let nextId = 1;
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      } else if (msg.method) {
        notifications.push(msg);
      }
    }
  });

  // Send a request under a caller-chosen id — the only way to put a STRING id
  // on the wire, which the id-aliasing cases below need.
  function rpcWithId(id, method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error('no response to ' + method + ' (id ' + JSON.stringify(id) + ') within ' +
          (timeoutMs || 120000) + 'ms; server stderr:\n' + stderr)),
        timeoutMs || 120000
      );
      pending.set(id, (msg) => { clearTimeout(t); resolve(msg); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
    });
  }

  function rpc(method, params, timeoutMs) {
    return rpcWithId(nextId++, method, params, timeoutMs);
  }

  // Fire-and-forget: notifications carry no id and get no response.
  function notify(method, params) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params: params || {} }) + '\n');
  }

  // The id the NEXT rpc() call will use — the only way to name a request in a
  // notifications/cancelled before its response arrives.
  function peekNextId() { return nextId; }

  async function start() {
    const init = await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-lane-test', version: '0' },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return init;
  }

  function close() {
    try { child.stdin.end(); } catch (_) { /* already closed */ }
    try { child.kill(); } catch (_) { /* already gone */ }
  }
  cleanups.push(close);

  return { rpc, rpcWithId, notify, peekNextId, start, close, notifications, stderrText: () => stderr };
}

function resultText(msg) {
  const c = msg && msg.result && msg.result.content;
  return Array.isArray(c) && c[0] && typeof c[0].text === 'string' ? c[0].text : '';
}

function field(out, name) {
  const m = new RegExp('^' + name + ': (.*)$', 'm').exec(out);
  return m ? m[1].trim() : '';
}

const WORK_ORDER = 'Reformat add(). Scope: app.js only.';
const EXEC_REPORT = 'STATUS: DONE — reformatted add(), committed.';

// ------------------------------------------------------------------- cases

// 1. The handshake and the tool surface: five tools, correct requireds. A
//    launcher can only call what tools/list advertises, so the surface IS the
//    lane's API.
async function case1() {
  section('1. handshake and tool surface');
  const fx = makeRepo();
  const s = mcpSession({ fx });
  const init = await s.start();
  check('initialize returns serverInfo.name orchestra-engine',
    init.result && init.result.serverInfo && init.result.serverInfo.name === 'orchestra-engine',
    JSON.stringify(init));
  const list = await s.rpc('tools/list');
  const tools = (list.result && list.result.tools) || [];
  const names = tools.map((t) => t.name).sort();
  check('tools/list names the six lanes (WO-14b leg 5: + orchestra_close)',
    JSON.stringify(names) === JSON.stringify(['orchestra_close', 'orchestra_crossplan', 'orchestra_dispatch', 'orchestra_doctor', 'orchestra_exec', 'orchestra_review']),
    JSON.stringify(names));
  const review = tools.find((t) => t.name === 'orchestra_review');
  check('orchestra_review requires work_order and executor_report',
    review && JSON.stringify((review.inputSchema.required || []).sort()) === JSON.stringify(['executor_report', 'work_order']),
    review && JSON.stringify(review.inputSchema.required));
  const unknown = await s.rpc('tools/call', { name: 'orchestra_bogus', arguments: {} });
  check('unknown tool is a JSON-RPC error, not a fake report',
    unknown.error && unknown.error.code === -32602, JSON.stringify(unknown));
  s.close();
}

// 2. The review lane end to end against the stub engine: the tool result is
//    the runner's report verbatim — header provenance, verdict, stub fields —
//    with isError false. This is the call a launcher makes.
async function case2() {
  section('2. orchestra_review relays the runner report verbatim (live tree)');
  const fx = makeRepo();
  const s = mcpSession({ fx });
  await s.start();
  const res = await s.rpc('tools/call', {
    name: 'orchestra_review',
    arguments: { work_order: WORK_ORDER, executor_report: EXEC_REPORT, timeout_ms: 60000 },
  }, 180000);
  const text = resultText(res);
  check('call is not an error', !(res.result && res.result.isError), text.slice(0, 400));
  check('header attributes the engine', /REVIEW ENGINE: OpenAI via Codex CLI/.test(text), text.slice(0, 400));
  check('header names the live checkout', /checkout: live working tree/.test(text), text.slice(0, 600));
  check('the verdict line is the stub\'s', field(text, 'VERDICT') === 'APPROVE', field(text, 'VERDICT'));
  check('the stub actually ran in the repo', field(text, 'HEAD') === fx.head, field(text, 'HEAD'));
  check('no MCP TRANSPORT prefix on a clean relay', !/MCP TRANSPORT/.test(text), text.slice(0, 400));
  s.close();
}

// 3. A pinned review: refs passed as arguments reach the runner as flags —
//    the header proves the checkout, the stub proves which commit it saw.
async function case3() {
  section('3. orchestra_review pins the checkout when refs are passed');
  const fx = makeRepo();
  // Session debris on top of the reviewed commit — the reason pinning exists.
  fs.writeFileSync(path.join(fx.repo, 'app.js'), 'function add(a, b) {\n  return a + b; // later\n}\n');
  const s = mcpSession({ fx });
  await s.start();
  const res = await s.rpc('tools/call', {
    name: 'orchestra_review',
    arguments: {
      work_order: WORK_ORDER, executor_report: EXEC_REPORT,
      base_ref: fx.base, head_ref: fx.head, timeout_ms: 60000,
    },
  }, 180000);
  const text = resultText(res);
  check('header names a pinned worktree', /checkout: pinned worktree @/.test(text), text.slice(0, 600));
  check('the stub saw the pinned commit', field(text, 'HEAD') === fx.head, field(text, 'HEAD'));
  check('the pinned tree was clean', field(text, 'DIRTY_COUNT') === '0', field(text, 'DIRTY_COUNT'));
  s.close();
}

// 4. The exec lane end to end: tree audit, nonce round-trip, STATUS relay.
async function case4() {
  section('4. orchestra_exec relays report, TREE AUDIT, and REPORT INTEGRITY');
  const fx = makeRepo();
  const s = mcpSession({
    fx,
    env: { STUB_CODEX_FIRST_LINE: 'STATUS: DONE', STUB_CODEX_TOUCH: 'hello-from-exec.txt' },
  });
  await s.start();
  const res = await s.rpc('tools/call', {
    name: 'orchestra_exec',
    arguments: { work_order: 'Create hello-from-exec.txt.', timeout_ms: 60000 },
  }, 180000);
  const text = resultText(res);
  check('call is not an error', !(res.result && res.result.isError), text.slice(0, 400));
  check('header attributes the engine', /EXEC ENGINE: OpenAI via Codex CLI/.test(text), text.slice(0, 400));
  check('STATUS is the engine\'s', field(text, 'STATUS') === 'DONE', field(text, 'STATUS'));
  check('TREE AUDIT counted the stub\'s edit', /TREE AUDIT: 1 path/.test(text), text.slice(0, 1200));
  check('REPORT INTEGRITY verified the nonce', /REPORT INTEGRITY: verified/.test(text), text.slice(-600));
  check('the file really landed in the live tree',
    fs.existsSync(path.join(fx.repo, 'hello-from-exec.txt')), 'hello-from-exec.txt missing');
  s.close();
}

// 5. The doctor: exit code is the one meaningful runner exit, so the server
//    surfaces it as data on the first line instead of swallowing it.
async function case5() {
  section('5. orchestra_doctor surfaces the exit code as data');
  const fx = makeRepo();
  const s = mcpSession({ fx });
  await s.start();
  const res = await s.rpc('tools/call', { name: 'orchestra_doctor', arguments: {} }, 240000);
  const text = resultText(res);
  const code = field(text, 'DOCTOR EXIT CODE');
  check('result begins with DOCTOR EXIT CODE', /^DOCTOR EXIT CODE: \d+/.test(text), text.slice(0, 200));
  check('a clean stub install passes (exit 0, isError false)',
    code === '0' && !(res.result && res.result.isError), 'code=' + code + '\n' + text.slice(0, 800));
  s.close();
}

// 6. The server's own voice. Bad arguments, a missing runner, an abnormal
//    exit, an empty stdout, a wedged process — every one is MCP TRANSPORT +
//    isError, includes the evidence, and never wears an engine's header.
async function case6() {
  section('6. transport anomalies speak as MCP TRANSPORT, never as a report');
  const fx = makeRepo();

  const s1 = mcpSession({ fx });
  await s1.start();
  const bad = await s1.rpc('tools/call', {
    name: 'orchestra_review', arguments: { work_order: 'wo only' },
  });
  check('missing required param → transport error naming the param',
    bad.result && bad.result.isError && /executor_report/.test(resultText(bad)), resultText(bad).slice(0, 300));
  s1.close();

  const s2 = mcpSession({ fx, hooksDir: FIXTURE_RUNNERS.empty });
  await s2.start();
  const gone = await s2.rpc('tools/call', {
    name: 'orchestra_review', arguments: { work_order: 'w', executor_report: 'e' },
  });
  const goneText = resultText(gone);
  check('missing runner → transport error naming the path and the install hint',
    gone.result && gone.result.isError && /was not found at/.test(goneText) && /--packs codex/.test(goneText),
    goneText.slice(0, 400));
  s2.close();

  // The 3s backstop lives on THIS session only — every other case's runner
  // must be allowed its real runtime.
  const s3 = mcpSession({ fx, hooksDir: FIXTURE_RUNNERS.bad, env: { ORCHESTRA_MCP_BACKSTOP_MS: '3000' } });
  await s3.start();
  const abnormal = await s3.rpc('tools/call', {
    name: 'orchestra_review', arguments: { work_order: 'w', executor_report: 'e' },
  });
  const abText = resultText(abnormal);
  check('non-zero runner exit → transport error with the code and the captured output',
    abnormal.result && abnormal.result.isError && /code=3/.test(abText) && /half a report, then death/.test(abText),
    abText.slice(0, 500));
  check('abnormal output is labelled NOT a runner report', /NOT a runner report/.test(abText), abText.slice(0, 500));

  const silent = await s3.rpc('tools/call', {
    name: 'orchestra_exec', arguments: { work_order: 'w' },
  });
  check('exit-0-with-empty-stdout → transport error saying no report exists',
    silent.result && silent.result.isError && /wrote nothing to stdout/.test(resultText(silent)),
    resultText(silent).slice(0, 300));

  const wedged = await s3.rpc('tools/call', {
    name: 'orchestra_crossplan',
    arguments: { phase: 'draft', brief: 'b', out_path: 'wedged.md' },
  }, 60000);
  // ORCHESTRA_MCP_BACKSTOP_MS below caps the wedge at 3s.
  check('a wedged runner is killed by the backstop and attributed to THIS SERVER',
    wedged.result && wedged.result.isError && /kill-backstop/.test(resultText(wedged)) && /killed by THIS SERVER/.test(resultText(wedged)),
    resultText(wedged).slice(0, 400));
  s3.close();
}

// 7. Progress notifications flow when (and only when) the client sends a
//    progressToken — the spec's mechanism for a client that resets its
//    timeout on progress, which is what makes multi-hour chains safe.
async function case7() {
  section('7. progress notifications follow the client\'s token');
  const fx = makeRepo();
  const s = mcpSession({
    fx,
    env: { STUB_CODEX_SLEEP_MS: '2500', ORCHESTRA_MCP_PROGRESS_MS: '500' },
  });
  await s.start();
  const res = await s.rpc('tools/call', {
    name: 'orchestra_review',
    arguments: { work_order: WORK_ORDER, executor_report: EXEC_REPORT, timeout_ms: 60000 },
    _meta: { progressToken: 'tok-42' },
  }, 180000);
  check('the call still completed', /VERDICT: APPROVE/.test(resultText(res)), resultText(res).slice(0, 300));
  const progress = s.notifications.filter(
    (n) => n.method === 'notifications/progress' && n.params && n.params.progressToken === 'tok-42'
  );
  check('at least one progress notification carried the token', progress.length >= 1, JSON.stringify(s.notifications.slice(0, 3)));
  s.close();

  const s2 = mcpSession({ fx, env: { STUB_CODEX_SLEEP_MS: '1200', ORCHESTRA_MCP_PROGRESS_MS: '300' } });
  await s2.start();
  await s2.rpc('tools/call', {
    name: 'orchestra_review',
    arguments: { work_order: WORK_ORDER, executor_report: EXEC_REPORT, timeout_ms: 60000 },
  }, 180000);
  check('no token, no progress noise',
    s2.notifications.filter((n) => n.method === 'notifications/progress').length === 0,
    JSON.stringify(s2.notifications.slice(0, 3)));
  s2.close();
}

// 8. The cross-compare lane: a draft phase produces a document saved to
//    out_path with the integrity line stripped; wrong attachments degrade in
//    the RUNNER's grammar (CROSSPLAN_UNAVAILABLE, isError false); a missing
//    attachment file is a transport error before any spawn; and a report that
//    cannot echo this run's token is refused and NOT saved.
async function case8() {
  section('8. orchestra_crossplan saves the document and enforces integrity');
  const fx = makeRepo();
  const OUT = '.claude/plans/cross-compare/test/plan-b-v1.md';

  const s = mcpSession({ fx });
  await s.start();
  const res = await s.rpc('tools/call', {
    name: 'orchestra_crossplan',
    arguments: { phase: 'draft', brief: 'GOAL: reformat add().', out_path: OUT, timeout_ms: 60000 },
  }, 180000);
  const text = resultText(res);
  check('call is not an error', !(res.result && res.result.isError), text.slice(0, 400));
  check('header attributes the engine', /CROSSPLAN ENGINE: OpenAI via Codex CLI/.test(text), text.slice(0, 400));
  check('header names the saved document', /DOCUMENT SAVED: /.test(text), text.slice(0, 600));
  check('the engine ran read-only', field(text, 'SANDBOX') === 'read-only', field(text, 'SANDBOX'));
  check('the default effort reached the engine as a config override',
    /model_reasoning_effort=high/.test(field(text, 'CONFIG_OVERRIDES')), field(text, 'CONFIG_OVERRIDES'));
  check('REPORT INTEGRITY verified the nonce', /REPORT INTEGRITY: verified/.test(text), text.slice(-400));
  const saved = fs.existsSync(path.join(fx.repo, OUT)) ? fs.readFileSync(path.join(fx.repo, OUT), 'utf8') : '';
  check('the document landed at out_path', !!saved.trim(), OUT + ' missing or empty');
  check('the integrity line was stripped before saving', !/REPORT INTEGRITY/.test(saved), saved.slice(-200));

  const wrong = await s.rpc('tools/call', {
    name: 'orchestra_crossplan',
    arguments: { phase: 'critique', brief: 'b', out_path: '.claude/plans/cross-compare/test/c.md' },
  }, 120000);
  const wrongText = resultText(wrong);
  check('a phase missing its attachments degrades in the runner\'s grammar, not the server\'s',
    !(wrong.result && wrong.result.isError) && /STATUS: CROSSPLAN_UNAVAILABLE/.test(wrongText) &&
      /CROSSPLAN ENGINE: NONE/.test(wrongText),
    wrongText.slice(0, 400));

  const missing = await s.rpc('tools/call', {
    name: 'orchestra_crossplan',
    arguments: {
      phase: 'revise', brief: 'b', out_path: '.claude/plans/cross-compare/test/v2.md',
      own_plan_path: OUT, critique_path: '.claude/plans/cross-compare/no-such-critique.md',
    },
  });
  check('a missing attachment file is a transport error before any spawn',
    missing.result && missing.result.isError && /MCP TRANSPORT ERROR/.test(resultText(missing)),
    resultText(missing).slice(0, 300));
  s.close();

  const s2 = mcpSession({ fx, env: { STUB_CODEX_OMIT_NONCE: '1' } });
  await s2.start();
  const STALE_OUT = '.claude/plans/cross-compare/test/stale.md';
  const stale = await s2.rpc('tools/call', {
    name: 'orchestra_crossplan',
    arguments: { phase: 'draft', brief: 'GOAL: anything.', out_path: STALE_OUT, timeout_ms: 60000 },
  }, 180000);
  const staleText = resultText(stale);
  check('a report without this run\'s token is refused as CROSSPLAN_UNAVAILABLE',
    !(stale.result && stale.result.isError) && /STATUS: CROSSPLAN_UNAVAILABLE/.test(staleText) &&
      /integrity check failed/.test(staleText),
    staleText.slice(0, 600));
  check('the refused document was NOT saved to out_path',
    !fs.existsSync(path.join(fx.repo, STALE_OUT)), STALE_OUT + ' exists');
  s2.close();
}

// 9. Cancellation. Stopping a codex-lane call must stop the ENGINE, not just
//    the request: the server keeps an id -> child registry, a
//    notifications/cancelled kills the whole process tree (the runner AND the
//    grandchild it blocks on inside spawnSync), and the request is resolved in
//    the server's own MCP TRANSPORT voice instead of hanging until the
//    backstop. Before this existed the notification was discarded outright and
//    a "stopped" run kept editing the tree for the rest of its timeout.
async function case9() {
  section('9. notifications/cancelled kills the in-flight process TREE');
  const fx = makeRepo();
  const pidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-cancel-'));
  cleanups.push(() => fs.rmSync(pidDir, { recursive: true, force: true }));
  const runnerPidFile = path.join(pidDir, 'runner.pid');
  const enginePidFile = path.join(pidDir, 'engine.pid');
  const readPid = (p) => { try { return Number(fs.readFileSync(p, 'utf8').trim()) || 0; } catch (_) { return 0; } };

  // Every pid any wedge in this case ever reported, so nothing survives the
  // suite however the case ends. The fixture's grandchild ignores SIGTERM, so
  // reap with SIGKILL.
  const seenPids = [];
  cleanups.push(() => {
    for (const pid of seenPids) { try { process.kill(pid, 'SIGKILL'); } catch (_) { /* gone */ } }
  });

  // No backstop override anywhere in this case: crossplan's default backstop is
  // 20 minutes away, so anything that resolves in seconds did so because
  // cancellation worked — not because the old kill-backstop caught it.
  const s = mcpSession({
    fx,
    hooksDir: FIXTURE_RUNNERS.tree,
    env: {
      ORCHESTRA_TEST_RUNNER_PIDFILE: runnerPidFile,
      ORCHESTRA_TEST_ENGINE_PIDFILE: enginePidFile,
    },
  });
  await s.start();

  const WEDGE_ARGS = { name: 'orchestra_crossplan', arguments: { phase: 'draft', brief: 'b', out_path: 'cancelled.md' } };

  // Start a wedged run and wait until both its processes exist. `id` may be any
  // JSON-RPC id; omit it to take the session's next numeric one.
  async function startWedge(id) {
    for (const f of [runnerPidFile, enginePidFile]) { try { fs.rmSync(f, { force: true }); } catch (_) { /* fine */ } }
    const rid = id === undefined ? s.peekNextId() : id;
    const promise = (id === undefined
      ? s.rpc('tools/call', WEDGE_ARGS, 45000)
      : s.rpcWithId(id, 'tools/call', WEDGE_ARGS, 45000)
    ).then((m) => ({ ok: true, m }), (e) => ({ ok: false, e }));
    const up = await waitFor(() => (readPid(runnerPidFile) && readPid(enginePidFile)) ? true : null, 30000);
    const runnerPid = readPid(runnerPidFile);
    const enginePid = readPid(enginePidFile);
    for (const pid of [runnerPid, enginePid]) if (pid) seenPids.push(pid);
    return { id: rid, promise, up, runnerPid, enginePid };
  }

  // --- 9a. the crux: a cancelled run's whole tree dies, and the request answers.
  const w = await startWedge();
  check('the wedged runner and its SIGTERM-ignoring grandchild both started', !!w.up,
    'runner=' + w.runnerPid + ' engine=' + w.enginePid);
  check('the grandchild engine is a DIFFERENT process from the runner',
    !!w.runnerPid && !!w.enginePid && w.runnerPid !== w.enginePid,
    'runner=' + w.runnerPid + ' engine=' + w.enginePid);

  s.notify('notifications/cancelled', { requestId: w.id, reason: 'stopped by the user' });

  const res = await w.promise;
  check('the cancelled request is RESOLVED, not left hanging', res.ok,
    res.ok ? '' : String((res.e && res.e.message) || res.e).slice(0, 300));
  const text = res.ok ? resultText(res.m) : '';
  check('the resolution is the server\'s own MCP TRANSPORT voice, marked isError',
    res.ok && res.m.result && res.m.result.isError === true && /^MCP TRANSPORT ERROR/.test(text),
    text.slice(0, 300));
  check('the resolution says the run was cancelled and no report exists',
    /CANCELLED by the client/.test(text) && /No report exists for this call/.test(text), text.slice(0, 400));
  check('the cancellation reason is carried through', /stopped by the user/.test(text), text.slice(0, 400));
  check('it is NOT mislabelled as the kill-backstop', !/kill-backstop/.test(text), text.slice(0, 400));
  // A killed engine leaves no TREE AUDIT, so the caller has to be told the tree
  // is unaudited — that is the one sentence a launcher must relay upward.
  check('the resolution warns the working tree may be half-edited and unaudited',
    /WORKING TREE MAY BE HALF-EDITED/.test(text) && /Audit the tree/.test(text), text.slice(0, 900));
  // The transport must describe the kill it actually performed, never assume one.
  check('the resolution names the mechanism that actually stopped the tree',
    process.platform === 'win32'
      ? /taskkill \/PID \d+ \/T \/F killed the process tree/.test(text)
      : /SIGTERM to process group \d+, SIGKILL escalation armed/.test(text),
    text.slice(0, 900));
  check('a confirmed tree-kill carries no could-NOT-confirm warning',
    !/could NOT confirm/.test(text), text.slice(0, 900));

  // The crux. The grandchild ignores SIGTERM, so on POSIX it can ONLY die by the
  // SIGKILL escalation surviving the runner's own exit — the defect that shipped
  // green the first time round. Poll: escalation is 3s, taskkill reaps async.
  const engineGone = await waitFor(() => (!alive(w.enginePid) ? true : null), 20000);
  check('the SIGTERM-ignoring grandchild ENGINE was killed (escalation survives the runner\'s exit)',
    !!engineGone, 'engine pid ' + w.enginePid + ' still alive 20s after cancellation');
  const runnerGone = await waitFor(() => (!alive(w.runnerPid) ? true : null), 20000);
  check('the runner process was killed', !!runnerGone, 'runner pid ' + w.runnerPid + ' still alive');

  // --- 9b. a client that echoes the id with a different JSON type still cancels.
  const echo = await startWedge();
  check('the loose-match wedge started', !!echo.up, 'runner=' + echo.runnerPid);
  s.notify('notifications/cancelled', { requestId: String(echo.id), reason: 'string echo of a numeric id' });
  const echoRes = await echo.promise;
  check('a cancellation echoing a numeric id AS A STRING still cancels the right run',
    echoRes.ok && /CANCELLED by the client/.test(resultText(echoRes.m)),
    echoRes.ok ? resultText(echoRes.m).slice(0, 200) : String((echoRes.e && echoRes.e.message) || echoRes.e).slice(0, 200));
  await waitFor(() => (!alive(echo.enginePid) ? true : null), 20000);

  // --- 9c. ...but a RETIRED id must never alias onto a live one. Sequence:
  // numeric N ran and finished (9a); a different request now holds the string
  // id "N"; a late cancellation for numeric N must kill NOTHING.
  const victim = await startWedge(String(w.id));
  check('a second run is in flight under the STRING form of a completed id', !!victim.up,
    'runner=' + victim.runnerPid);
  s.notify('notifications/cancelled', { requestId: w.id, reason: 'late cancel of the completed numeric id' });
  const raced = await Promise.race([victim.promise, sleep(6000).then(() => 'still-running')]);
  check('a completed numeric id does NOT cancel the live run holding its string form',
    raced === 'still-running',
    'the unrelated run was resolved: ' + (raced === 'still-running' ? '' : JSON.stringify(raced).slice(0, 300)));
  check('...and that run\'s engine is untouched', alive(victim.enginePid),
    'engine pid ' + victim.enginePid + ' was killed by an aliased cancellation');

  // Its own id still stops it — the guard narrows the match, it does not break it.
  s.notify('notifications/cancelled', { requestId: String(w.id), reason: 'its own id' });
  const victimRes = await victim.promise;
  check('the run stops when cancelled under its OWN id',
    victimRes.ok && /CANCELLED by the client/.test(resultText(victimRes.m)),
    victimRes.ok ? resultText(victimRes.m).slice(0, 200) : String((victimRes.e && victimRes.e.message) || victimRes.e).slice(0, 200));
  const victimGone = await waitFor(() => (!alive(victim.enginePid) ? true : null), 20000);
  check('its engine dies too', !!victimGone, 'engine pid ' + victim.enginePid + ' still alive');

  // --- 9e. the same wrong-run kill through the PRE-SPAWN door. An id whose call
  // died in argument validation never started a process — but it was still an id
  // used here, so it must not be loose-matchable onto a live run either. This is
  // why the id is remembered at DISPATCH rather than after a successful spawn.
  const preSpawnId = s.peekNextId();
  const badArgs = await s.rpc('tools/call', {
    name: 'orchestra_crossplan',
    arguments: { phase: 'draft', out_path: 'never-spawned.md' }, // no brief: fails requireString
  }, 30000);
  check('a tools/call that fails argument validation never reaches a spawn',
    badArgs.result && badArgs.result.isError &&
      /could not be started/.test(resultText(badArgs)) && /brief/.test(resultText(badArgs)),
    resultText(badArgs).slice(0, 300));

  const victim2 = await startWedge(String(preSpawnId));
  check('a run is in flight under the STRING form of that pre-spawn-failed id', !!victim2.up,
    'runner=' + victim2.runnerPid);
  s.notify('notifications/cancelled', { requestId: preSpawnId, reason: 'late cancel of an id that never spawned' });
  const raced2 = await Promise.race([victim2.promise, sleep(6000).then(() => 'still-running')]);
  check('an id that failed BEFORE spawn cannot cancel the live run holding its string form',
    raced2 === 'still-running',
    'the unrelated run was resolved: ' + (raced2 === 'still-running' ? '' : JSON.stringify(raced2).slice(0, 300)));
  check('...and that run\'s engine is untouched too', alive(victim2.enginePid),
    'engine pid ' + victim2.enginePid + ' was killed by an aliased cancellation');
  // A refusal that says nothing anywhere is a refusal nobody can diagnose in
  // the field. It belongs on stderr — stdout is the JSON-RPC channel.
  check('a refused loose match leaves a diagnosable note on the server\'s stderr',
    /refused a loose id match/.test(s.stderrText()), JSON.stringify(s.stderrText().slice(-300)));

  s.notify('notifications/cancelled', { requestId: String(preSpawnId), reason: 'its own id' });
  const v2res = await victim2.promise;
  check('...and it still stops under its OWN id',
    v2res.ok && /CANCELLED by the client/.test(resultText(v2res.m)),
    v2res.ok ? resultText(v2res.m).slice(0, 200) : String((v2res.e && v2res.e.message) || v2res.e).slice(0, 200));
  await waitFor(() => (!alive(victim2.enginePid) ? true : null), 20000);

  // --- 9d. registry hygiene: entries are gone, so repeats and nonsense are no-ops.
  s.notify('notifications/cancelled', { requestId: w.id, reason: 'again' });
  s.notify('notifications/cancelled', { requestId: 987654, reason: 'never existed' });
  s.notify('notifications/cancelled', {});
  s.notify('notifications/initialized', {});
  const pong = await s.rpc('ping', {}, 10000);
  check('the server survives repeat/unknown/malformed cancellations and initialized',
    pong.result && !pong.error, JSON.stringify(pong).slice(0, 200));
  s.close();
}

// 10. WO-14b leg 4b: the engine ticket lifecycle under roster:new. A temp
//     project pinned as roster:new (owner pin + hash-matching manifest),
//     wired with the same .claude/orchestra/{bridge,router,registry,
//     verifier,quartermaster}/ substrate layout install.js --roster new
//     produces, so requireEngineTicket()'s loadBridgeRuntime()/
//     loadBridgeManifestModule() resolve for real (not the source-tree
//     fallback the other cases exercise). Drives orchestra_exec over stdio
//     against a real router/tickets.js store: unticketed, a valid
//     exec-phase ticket, and a reviewer-kind ticket used for phase 'exec'.
async function case10() {
  section("10. WO-14b leg 4b: engine ticket lifecycle under roster:new (TICKET_REQUIRED / consumed+RESOLVED / TICKET_MISMATCH)");
  const fx = makeRepo();

  // Lay out the installed-copy substrate under .claude/orchestra/ — the FIRST
  // candidate loadBridgeRuntime()/loadBridgeManifestModule() check.
  const orchestraDir = path.join(fx.repo, '.claude', 'orchestra');
  for (const sub of ['bridge', 'router', 'registry', 'verifier', 'quartermaster']) {
    fs.cpSync(path.join(MASTER, sub), path.join(orchestraDir, sub), { recursive: true });
  }

  const manifestPath = path.join(fx.repo, '.claude', 'orchestra.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: {} }, null, 2));

  // Owner pin (bridge/manifest.js's contract): PIN_DIR/<sha256(realpath(project))>.json
  // carrying manifestSha256 of the manifest file's own bytes.
  const pinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-pins-'));
  cleanups.push(() => fs.rmSync(pinDir, { recursive: true, force: true }));
  const manifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
  const pinHash = crypto.createHash('sha256').update(fs.realpathSync(fx.repo)).digest('hex');
  fs.writeFileSync(path.join(pinDir, pinHash + '.json'), JSON.stringify({
    projectDir: fx.repo, manifestSha256, roster: 'new', rosterGeneration: 1, seats: {},
    writtenAt: new Date().toISOString(), by: 'mcp-lane.test.js case10 fixture',
  }));

  const T = require(path.join(MASTER, 'router', 'tickets.js'));
  const store = T.createTicketStore({ dir: path.join(orchestraDir, 'tickets'), init: true });
  const CFG_HASH = crypto.createHash('sha256').update('mcp-lane case10 fixture').digest('hex');
  function issueTicket(overrides) {
    return T.issue(store, Object.assign({
      kind: 'implementation', task_id: 'mcp-lane-case10', class: 'E2', role: 'codex-exec',
      rung: 'primary', casting: { vendor: 'openai', model: 'gpt-5.6-terra', effort: 'med' },
      author_family: 'openai', config_hash: CFG_HASH,
    }, overrides || {}));
  }

  // STUB_CODEX_ATTEMPT_FILE doubles as an invocation counter here: the stub
  // increments it on EVERY invocation (probe or real), so "the file was never
  // created/incremented" is exactly "codex was never invoked".
  function makeAttemptFile() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-attempts-'));
    cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
    return path.join(d, 'attempts');
  }
  function invocationCount(f) {
    try { return parseInt(fs.readFileSync(f, 'utf8').trim(), 10) || 0; } catch (_) { return 0; }
  }

  // --- 10a. no ticket at all -> TICKET_REQUIRED, codex never invoked.
  {
    const af = makeAttemptFile();
    const s = mcpSession({ fx, env: { ORCHESTRA_PIN_DIR: pinDir, STUB_CODEX_ATTEMPT_FILE: af } });
    await s.start();
    const res = await s.rpc('tools/call', { name: 'orchestra_exec', arguments: { work_order: 'do the thing' } });
    const text = resultText(res);
    check('no ticket under roster:new -> TICKET_REQUIRED',
      res.result && res.result.isError && /^TICKET_REQUIRED:/.test(text), text.slice(0, 300));
    s.close();
    check('no ticket -> the stub was never invoked', invocationCount(af) === 0, 'invocations=' + invocationCount(af));
  }

  // --- 10b. a valid exec-phase ticket -> stub invoked once, ticket ends
  //     RESOLVED with launched.agent_id === 'codex:' + the report's own nonce.
  {
    const af = makeAttemptFile();
    const ticket = issueTicket();
    const s = mcpSession({ fx, env: { ORCHESTRA_PIN_DIR: pinDir, STUB_CODEX_ATTEMPT_FILE: af } });
    await s.start();
    const res = await s.rpc('tools/call', {
      name: 'orchestra_exec', arguments: { work_order: 'do the thing', ticket: ticket.id },
    }, 180000);
    const text = resultText(res);
    check('valid exec ticket -> not a transport error', !(res.result && res.result.isError), text.slice(0, 400));
    check('valid exec ticket -> the stub was invoked exactly once', invocationCount(af) === 1, 'invocations=' + invocationCount(af));
    const nonceMatch = /RUN NONCE: ([0-9a-f]+)/.exec(text);
    check('the exec runner\'s own header carries a RUN NONCE', !!nonceMatch, text.slice(0, 500));
    s.close();
    const after = T.get(store, ticket.id);
    check('the ticket ends RESOLVED', after && after.status === 'RESOLVED', after && after.status);
    check("launched.agent_id is 'codex:' + the report's own nonce",
      !!(after && after.launched && nonceMatch && after.launched.agent_id === 'codex:' + nonceMatch[1]),
      after && after.launched && after.launched.agent_id);
    check('resolved.last_assistant_message is the exact report text relayed to the caller',
      !!(after && after.resolved && after.resolved.last_assistant_message === text),
      after && after.resolved && after.resolved.last_assistant_message.slice(0, 200));
  }

  // --- 10c. a reviewer-kind ticket used for phase 'exec' -> TICKET_MISMATCH,
  //     zero invocations, the ticket is never consumed.
  {
    const af = makeAttemptFile();
    const reviewerTicket = issueTicket({ kind: 'reviewer', role: 'codex-review' });
    const s = mcpSession({ fx, env: { ORCHESTRA_PIN_DIR: pinDir, STUB_CODEX_ATTEMPT_FILE: af } });
    await s.start();
    const res = await s.rpc('tools/call', {
      name: 'orchestra_exec', arguments: { work_order: 'do the thing', ticket: reviewerTicket.id },
    });
    const text = resultText(res);
    check('a reviewer ticket used for phase exec -> TICKET_MISMATCH',
      res.result && res.result.isError && /^TICKET_MISMATCH:/.test(text), text.slice(0, 300));
    s.close();
    check('wrong-phase ticket -> the stub was never invoked', invocationCount(af) === 0, 'invocations=' + invocationCount(af));
    const after = T.get(store, reviewerTicket.id);
    check('the mismatched ticket stays OPEN (never consumed)', after && after.status === 'OPEN', after && after.status);
  }
}

// 11. WO-14b leg 5: orchestra_close — NOT_CLOSED on a non-RESOLVED ticket, and
//    CLOSED end-to-end (close #1 PASS -> REVIEW_PENDING -> synthetic APPROVE
//    verdict -> close #2 CLOSED) driven entirely over the MCP stdio tool.
async function case11() {
  section('11. WO-14b leg 5: orchestra_close');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-mcp-close-'));
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'project');
  fs.mkdirSync(repo);
  git(['init', '-q', '-b', 'main'], repo);
  git(['config', 'user.email', 'test@example.com'], repo);
  git(['config', 'user.name', 'Orchestra Test'], repo);
  git(['config', 'commit.gpgsign', 'false'], repo);
  fs.mkdirSync(path.join(repo, '.claude'));
  // The verifier manifest (commands/coverage/versions) lives at the BASE
  // commit only — close #1 passes manifestRef = the base ref (ruling 1a: the
  // manifest is pinned OUTSIDE the audited commit), never the head tree.
  fs.writeFileSync(path.join(repo, '.claude', 'orchestra.json'), JSON.stringify({
    commands: [{ command: 'node -e "process.exit(0)"' }], coverage: 'complete', versions: [],
  }, null, 2));
  fs.writeFileSync(path.join(repo, 'lib.js'), 'module.exports = { ok: true };\n');
  git(['add', '-A'], repo);
  git(['commit', '-qm', 'base'], repo);
  fs.writeFileSync(path.join(repo, 'feature.js'), 'module.exports = { feature: true };\n');
  git(['add', '-A'], repo);
  git(['commit', '-qm', 'add feature'], repo);
  const closeHead = git(['rev-parse', 'HEAD'], repo);

  // Installed-copy substrate under .claude/orchestra/ so loadBridgeRuntime()
  // (ORCHESTRA_MCP_ROOT === repo below) can require bridge/runtime.js.
  const orchestraDir = path.join(repo, '.claude', 'orchestra');
  for (const sub of ['bridge', 'router', 'registry', 'verifier', 'quartermaster']) {
    fs.cpSync(path.join(MASTER, sub), path.join(orchestraDir, sub), { recursive: true });
  }
  const readingsFile = path.join(repo, '.claude', 'orchestra-pool-readings.jsonl');
  fs.writeFileSync(readingsFile, ['AU-all', 'AU-opus', 'AU-fable', 'OU'].map((bucket) => JSON.stringify({
    ts: new Date().toISOString(), kind: 'reading', bucket, remainingFraction: 0.95, source: 'mcp-lane.test.js case11 fixture',
  })).join('\n') + '\n');

  const T = require(path.join(MASTER, 'router', 'tickets.js'));
  const store = T.createTicketStore({ dir: path.join(orchestraDir, 'tickets'), init: true });
  const CFG_HASH = crypto.createHash('sha256').update('mcp-lane case11 fixture').digest('hex');

  function issueImpl(overrides) {
    return T.issue(store, Object.assign({
      kind: 'implementation', task_id: 'mcp-close-task', class: 'E2', role: 'builder',
      rung: 'dense', tier: null, casting: { vendor: 'anthropic', model: 'claude-sonnet-5', effort: 'high' },
      author_family: 'anthropic', config_hash: CFG_HASH,
    }, overrides || {}));
  }
  function driveToResolved(ticketId, role, message, servedModel) {
    T.consume(store, ticketId, { tool_use_id: 'tu-' + ticketId, role });
    T.launch(store, ticketId, { agent_id: 'agent-' + ticketId, served_model: servedModel || 'claude-sonnet-5-20260101' });
    return T.resolve(store, ticketId, {
      agent_id: 'agent-' + ticketId, last_assistant_message: message,
      agent_transcript_path: path.join(root, 'transcript-' + ticketId + '.jsonl'),
    });
  }
  function bandCReport(status, commit) {
    return [
      'STATUS: ' + status, 'COMMIT: ' + commit, '',
      'CHANGES', '- feature.js:1 — added feature', '',
      'VERIFICATION', '- node -e "process.exit(0)" -> exit 0', '',
      'DEVIATIONS', '- none', '', 'CONCERNS', '- none', '',
    ].join('\n');
  }
  function verdictBlock(obj) { return '```verdict-json\n' + JSON.stringify(obj, null, 2) + '\n```\n'; }
  function approveVerdict(overrides) {
    return Object.assign({
      verdict: 'APPROVE', findings: [],
      claims_checked: [{ claim: 'change compiles', result: 'CONFIRMED', how: 'ran node -e' }],
      refutation_duty: { present: true, what_was_tried: 'considered a no-op alternative; rejected' },
      citation_replay: [{ citation: 'trivial pass', command: 'node -e "process.exit(0)"', result: 'MATCH' }],
      served_model: 'gpt-5.6-sol', run_nonce: null, review: { cross_family: null },
    }, overrides || {});
  }
  function writeRoutingEvent(ticketId, request) {
    const file = path.join(orchestraDir, 'tickets', 'routing.events.jsonl');
    fs.appendFileSync(file, JSON.stringify({ request, outcome: { tickets: { implementation: { id: ticketId } } } }) + '\n');
  }

  const s = mcpSession({ fx: { repo } });
  await s.start();

  // --- 11a. NOT_CLOSED on a non-RESOLVED ticket.
  {
    const openTicket = issueImpl();
    const res = await s.rpc('tools/call', { name: 'orchestra_close', arguments: { ticket: openTicket.id } });
    const text = resultText(res);
    check('orchestra_close on a non-RESOLVED ticket -> NOT_CLOSED (RESOLVED required)',
      /"outcome":\s*"NOT_CLOSED"/.test(text) && /RESOLVED/.test(text), text.slice(0, 400));
  }

  // --- 11b. CLOSED end-to-end: PASS -> REVIEW_PENDING -> synthetic APPROVE verdict -> CLOSED.
  {
    const impl = issueImpl();
    writeRoutingEvent(impl.id, { risk: 'T2', class: 'E2' });
    driveToResolved(impl.id, 'builder', bandCReport('DONE', closeHead), 'claude-sonnet-5-20260101');
    const r1 = await s.rpc('tools/call', { name: 'orchestra_close', arguments: { ticket: impl.id } });
    const t1 = resultText(r1);
    check('close #1 over MCP -> REVIEW_PENDING', /"stage":\s*"REVIEW_PENDING"/.test(t1), t1.slice(0, 500));
    let parsed1;
    try { parsed1 = JSON.parse(t1); } catch (_) { parsed1 = null; }
    const reviewerId = parsed1 && parsed1.reviewer_ticket && parsed1.reviewer_ticket.id;
    check('close #1 issued a reviewer ticket id', !!reviewerId, t1.slice(0, 500));
    if (reviewerId) {
      driveToResolved(reviewerId, 'reviewer-openai',
        'REVIEW ENGINE: OpenAI via Codex CLI\nREVIEW RUN NONCE: nonce-mcp-case11\n\n' +
          verdictBlock(approveVerdict({ run_nonce: 'nonce-mcp-case11' })),
        'UNKNOWN');
      const r2 = await s.rpc('tools/call', { name: 'orchestra_close', arguments: { ticket: reviewerId } });
      const t2 = resultText(r2);
      check('close #2 over MCP -> CLOSED', /"outcome":\s*"CLOSED"/.test(t2) && /"ok":\s*true/.test(t2), t2.slice(0, 500));
      check('both tickets transitioned to CLOSED on disk',
        T.get(store, impl.id).status === 'CLOSED' && T.get(store, reviewerId).status === 'CLOSED');
    }
  }

  s.close();
}

// ------------------------------------------------------------------- driver

function finish() {
  for (const fn of cleanups.splice(0)) {
    try { fn(); } catch (_) { /* best effort */ }
  }
  console.log(failures ? '\nFAILED — ' + passes + ' passed, ' + failures + ' failed' : '\nOK — ' + passes + ' passed');
  process.exit(failures ? 1 : 0);
}

async function main() {
  await case1();
  await case2();
  await case3();
  await case4();
  await case5();
  await case6();
  await case7();
  await case8();
  await case9();
  await case10();
  await case11();
}

main().then(finish, (e) => {
  check('suite ran to completion', false, (e && e.stack) || e);
  finish();
});
