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
    path.join(bad, 'orchestra-deepplan.js'),
    'setInterval(() => {}, 1000); // wedge forever; the backstop must fire\n'
  );
  return { empty: path.join(d, 'empty'), bad };
})();

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

  function rpc(method, params, timeoutMs) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error('no response to ' + method + ' within ' + (timeoutMs || 120000) + 'ms; server stderr:\n' + stderr)),
        timeoutMs || 120000
      );
      pending.set(id, (msg) => { clearTimeout(t); resolve(msg); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
    });
  }

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

  return { rpc, start, close, notifications, stderrText: () => stderr };
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
  check('tools/list names the five lanes',
    JSON.stringify(names) === JSON.stringify(['orchestra_crossplan', 'orchestra_deepplan', 'orchestra_doctor', 'orchestra_exec', 'orchestra_review']),
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

// 5. The deep-plan lane degrades inside the RUNNER's grammar, not the
//    server's: no API key → DEEPPLAN_UNAVAILABLE relayed with isError false —
//    the transport worked; the engine was unavailable. Those are different
//    facts and the result must keep them different.
async function case5() {
  section('5. orchestra_deepplan relays DEEPPLAN_UNAVAILABLE as a report, not a transport error');
  const fx = makeRepo();
  fs.mkdirSync(path.join(fx.repo, '.claude', 'plans'), { recursive: true });
  fs.writeFileSync(path.join(fx.repo, '.claude', 'plans', 'plan.md'), '# plan\n\n1. do the thing\n');
  const s = mcpSession({ fx, env: { OPENAI_API_KEY: '' } });
  await s.start();
  const res = await s.rpc('tools/call', {
    name: 'orchestra_deepplan',
    arguments: { plan_path: '.claude/plans/plan.md', brief: 'Round 1 brief.', round: 1 },
  }, 120000);
  const text = resultText(res);
  check('call is not a transport error', !(res.result && res.result.isError), text.slice(0, 400));
  check('the runner\'s own sentinel is relayed', /VERDICT: DEEPPLAN_UNAVAILABLE/.test(text), text.slice(0, 600));
  check('failure header names no engine', /DEEP-PLAN ENGINE: NONE/.test(text), text.slice(0, 400));
  const missing = await s.rpc('tools/call', {
    name: 'orchestra_deepplan',
    arguments: { plan_path: '.claude/plans/no-such-plan.md', brief: 'b', round: 1 },
  });
  check('a missing plan file is a transport error before any spawn',
    missing.result && missing.result.isError && /MCP TRANSPORT ERROR/.test(resultText(missing)),
    resultText(missing).slice(0, 300));
  s.close();
}

// 6. The doctor: exit code is the one meaningful runner exit, so the server
//    surfaces it as data on the first line instead of swallowing it.
async function case6() {
  section('6. orchestra_doctor surfaces the exit code as data');
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

// 7. The server's own voice. Bad arguments, a missing runner, an abnormal
//    exit, an empty stdout, a wedged process — every one is MCP TRANSPORT +
//    isError, includes the evidence, and never wears an engine's header.
async function case7() {
  section('7. transport anomalies speak as MCP TRANSPORT, never as a report');
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
    name: 'orchestra_deepplan',
    arguments: { plan_path: 'app.js', brief: 'b', round: 1 },
  }, 60000);
  // ORCHESTRA_MCP_BACKSTOP_MS below caps the wedge at 3s.
  check('a wedged runner is killed by the backstop and attributed to THIS SERVER',
    wedged.result && wedged.result.isError && /kill-backstop/.test(resultText(wedged)) && /killed by THIS SERVER/.test(resultText(wedged)),
    resultText(wedged).slice(0, 400));
  s3.close();
}

// 8. Progress notifications flow when (and only when) the client sends a
//    progressToken — the spec's mechanism for a client that resets its
//    timeout on progress, which is what makes multi-hour chains safe.
async function case8() {
  section('8. progress notifications follow the client\'s token');
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

// 9. The cross-compare lane: a draft phase produces a document saved to
//    out_path with the integrity line stripped; wrong attachments degrade in
//    the RUNNER's grammar (CROSSPLAN_UNAVAILABLE, isError false); a missing
//    attachment file is a transport error before any spawn; and a report that
//    cannot echo this run's token is refused and NOT saved.
async function case9() {
  section('9. orchestra_crossplan saves the document and enforces integrity');
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
}

main().then(finish, (e) => {
  check('suite ran to completion', false, (e && e.stack) || e);
  finish();
});
