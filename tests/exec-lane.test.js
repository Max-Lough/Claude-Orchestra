#!/usr/bin/env node
/**
 * Exec-lane tests for packs/codex/hooks/orchestra-exec.js.
 *
 *   node tests/exec-lane.test.js
 *
 * No dependencies, no test framework — plain node and git, same as the
 * review-lane suite. The real Codex CLI is replaced by
 * tests/fixtures/stub-codex.js, which reports what the engine SAW (directory,
 * model, sandbox, config overrides, git identity, brief markers) rather than
 * executing anything; the assertions below are about the state and settings
 * the engine was handed, and about what the runner reports when the engine
 * dies.
 *
 * The exit-code discipline is inherited from the review-lane suite verbatim:
 * a failure sets the exit code the moment it exists, an `exit` handler
 * enforces it, and a suite that recorded no checks fails on that basis alone.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
// Defaults to the master copy. Point ORCHESTRA_TEST_EXEC_RUNNER at a project's
// installed .claude/hooks/orchestra-exec.js to check what actually shipped.
const RUNNER =
  process.env.ORCHESTRA_TEST_EXEC_RUNNER ||
  path.join(MASTER, 'packs', 'codex', 'hooks', 'orchestra-exec.js');
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

// A small committed repository plus a work-order file. Identity is passed
// per-commit (-c) rather than written into the repo's local config, so the
// git-identity-seeding case can prove the runner's scratch config — not the
// fixture's local one — is what the engine reads.
function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-exec-test-'));
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'project');
  fs.mkdirSync(repo);

  git(['init', '-q', '-b', 'main'], repo);
  git(['config', 'commit.gpgsign', 'false'], repo);
  fs.writeFileSync(path.join(repo, 'app.js'), 'function add(a, b) { return a + b; }\n');
  git(['add', '-A'], repo);
  git(
    ['-c', 'user.email=test@example.com', '-c', 'user.name=Orchestra Test', 'commit', '-qm', 'base'],
    repo
  );

  const wo = path.join(root, 'work-order.txt');
  fs.writeFileSync(wo, 'Add a subtract(a, b) function to app.js and run node --check on it.\n');
  return { root, repo, wo };
}

function writeProjectConfig(fx, cfg) {
  const dir = path.join(fx.repo, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'orchestra.json'), JSON.stringify(cfg, null, 2));
}

function runExec(fx, extraArgs, extraEnv, opts) {
  const args = [RUNNER, '--work-order', fx.wo].concat(extraArgs || []);
  // A suite run INSIDE a review or exec lane inherits that runner's
  // GIT_CONFIG_GLOBAL (Astra hit two environment-dependent failures this way
  // while reviewing 3.3.0); a case that wants the variable sets it itself.
  const base = Object.assign({}, process.env);
  delete base.GIT_CONFIG_GLOBAL;
  return spawnSync(process.execPath, args, {
    cwd: (opts && opts.cwd) || fx.repo,
    encoding: 'utf8',
    timeout: 120000,
    env: Object.assign(
      base,
      {
        CLAUDE_PROJECT_DIR: fx.repo,
        CODEX_BIN: STUB_BIN,
        CODEX_HOME: CLEAN_CODEX_HOME,
        ORCHESTRA_EXEC_IDLE_MS: '0',
        // The executor report shape, so the runner's missing-STATUS note is
        // exercised deliberately (case 8) rather than on every case.
        STUB_CODEX_FIRST_LINE: 'STATUS: DONE',
      },
      extraEnv || {}
    ),
  });
}

function field(out, name) {
  const m = new RegExp('^' + name + ': (.*)$', 'm').exec(out);
  return m ? m[1].trim() : '';
}

// Same platform plumbing as the review-lane suite: Windows cannot
// CreateProcess a `.js` file, so the "codex binary" there is a `.cmd` shim.
function makeStubBin(dir, base) {
  fs.mkdirSync(dir, { recursive: true });
  if (process.platform !== 'win32') {
    const dest = path.join(dir, base + '.js');
    fs.copyFileSync(STUB, dest);
    fs.chmodSync(dest, 0o755);
    return dest;
  }
  const dest = path.join(dir, base + '.cmd');
  fs.writeFileSync(
    dest,
    '@echo off\r\nnode "' + STUB + '" %*\r\nexit /b %ERRORLEVEL%\r\n',
    'utf8'
  );
  return dest;
}

const STUB_BIN = (() => {
  if (process.platform !== 'win32') return STUB;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-exec-stubbin-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return makeStubBin(dir, 'codex');
})();

// An empty CODEX_HOME by default: the runner reads the user's Codex config to
// decide which MCP servers to disable, and the developer's real ~/.codex must
// never leak into the exact override lists asserted below. Case 21 points at
// a fixture config on purpose.
const CLEAN_CODEX_HOME = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-exec-codex-home-'));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
})();

// ---------------------------------------------------------------- the tests

function case1() {
  section('1. Default Sol/high path: defaults, attribution, and the relayed report');
  const fx = makeRepo();
  const r = runExec(fx, []);
  const out = r.stdout || '';
  check(
    'a real report is attributed to the engine',
    /^EXEC ENGINE: OpenAI via Codex CLI \(/m.test(out),
    out.split('\n')[0]
  );
  check('the engine ran in the live working tree', field(out, 'CWD') !== '' &&
    path.resolve(field(out, 'CWD')) === path.resolve(fx.repo),
    'CWD: ' + field(out, 'CWD'));
  check(
    'the default model is Sol',
    field(out, 'MODEL') === 'gpt-5.6-sol' && /model: gpt-5\.6-sol \(default\)/.test(out),
    'MODEL: ' + field(out, 'MODEL') + ' — ' + out.split('\n')[0]
  );
  check(
    'the default effort is high, pinned as a config value, not prose',
    field(out, 'CONFIG_OVERRIDES') === 'model_reasoning_effort=high | features.hooks=false | project_doc_max_bytes=0 | features.apps=false' &&
      /effort: high/.test(out.split('\n')[0]),
    'CONFIG_OVERRIDES: ' + field(out, 'CONFIG_OVERRIDES') + ' — ' + out.split('\n')[0]
  );
  check(
    'the sandbox is workspace-write (an executor must write)',
    field(out, 'SANDBOX') === 'workspace-write',
    'SANDBOX: ' + field(out, 'SANDBOX')
  );
  check(
    'a co-installed Codex-Orchestra cannot recast the external executor as its Director',
    field(out, 'ORCHESTRA_ROLE') === 'executor-codex-external' &&
      field(out, 'CONFIG_OVERRIDES').includes('features.hooks=false') &&
      field(out, 'CONFIG_OVERRIDES').includes('project_doc_max_bytes=0'),
    'ORCHESTRA_ROLE: ' + field(out, 'ORCHESTRA_ROLE') + ' CONFIG_OVERRIDES: ' + field(out, 'CONFIG_OVERRIDES')
  );
  const hostile = runExec(fx, [], {
    ORCHESTRA_EXEC_ARGS: '-c features.hooks=true -c project_doc_max_bytes=65536',
  });
  const hostileOverrides = field(hostile.stdout || '', 'CONFIG_OVERRIDES').split(' | ');
  check(
    'user-supplied executor args cannot undo the coexistence boundary',
    hostileOverrides.slice(-3).join(' | ') === 'features.hooks=false | project_doc_max_bytes=0 | features.apps=false',
    'CONFIG_OVERRIDES: ' + hostileOverrides.join(' | ')
  );
  check(
    'there is no selectable tier: the header names no tier at all',
    !/\btier:/.test(out.split('\n')[0]),
    out.split('\n')[0]
  );
  check(
    'the header states execution is never auto-retried',
    /attempts: 1 \(execution is never auto-retried\)/.test(out),
    out.split('\n')[0]
  );
  check('the work order reached the engine', /WORK ORDER/.test(field(out, 'BRIEF_MARKERS')),
    'BRIEF_MARKERS: ' + field(out, 'BRIEF_MARKERS'));
  check('the engine\'s report is relayed', /STATUS: DONE/.test(out) && /STUB REPORT/.test(out),
    out.slice(0, 300));
  check(
    'a clean run audits as no source changes',
    /TREE AUDIT: no source paths changed/.test(out),
    out.slice(-500)
  );
}

function case2() {
  section('2. Explicit override precedence for model and effort: flag > env > config > default');
  const fx = makeRepo();
  writeProjectConfig(fx, {
    codex: { execHeavyModel: 'gpt-5.6-sol-pinned', execTimeoutMs: 1234567 },
  });
  const cfg = runExec(fx, []);
  check(
    'orchestra.json (codex.execHeavyModel) supplies the model and is credited',
    field(cfg.stdout || '', 'MODEL') === 'gpt-5.6-sol-pinned' &&
      /model: gpt-5\.6-sol-pinned \(orchestra\.json\)/.test(cfg.stdout || ''),
    (cfg.stdout || '').split('\n')[0]
  );
  check(
    'orchestra.json supplies the timeout and is credited',
    /timeout: 1234567ms \(orchestra\.json\)/.test(cfg.stdout || ''),
    (cfg.stdout || '').split('\n')[0]
  );

  const env = runExec(fx, [], { ORCHESTRA_EXEC_HEAVY_MODEL: 'gpt-5.6-env' });
  check(
    'the environment outranks orchestra.json',
    field(env.stdout || '', 'MODEL') === 'gpt-5.6-env' &&
      /model: gpt-5\.6-env \(env\)/.test(env.stdout || ''),
    (env.stdout || '').split('\n')[0]
  );

  const flag = runExec(fx, ['--model', 'gpt-5.6-flag'], { ORCHESTRA_EXEC_HEAVY_MODEL: 'gpt-5.6-env' });
  check(
    'a flag outranks everything',
    field(flag.stdout || '', 'MODEL') === 'gpt-5.6-flag' &&
      /model: gpt-5\.6-flag \(flag\)/.test(flag.stdout || ''),
    (flag.stdout || '').split('\n')[0]
  );

  // Same chain for effort (the header prints the value only, no source tag).
  const fx2 = makeRepo();
  writeProjectConfig(fx2, { codex: { execHeavyEffort: 'medium' } });
  const effortCfg = runExec(fx2, []);
  check(
    'orchestra.json (codex.execHeavyEffort) supplies the effort',
    field(effortCfg.stdout || '', 'CONFIG_OVERRIDES') === 'model_reasoning_effort=medium | features.hooks=false | project_doc_max_bytes=0 | features.apps=false' &&
      /effort: medium/.test((effortCfg.stdout || '').split('\n')[0]),
    (effortCfg.stdout || '').split('\n')[0]
  );
  const effortEnv = runExec(fx2, [], { ORCHESTRA_EXEC_HEAVY_EFFORT: 'low' });
  check(
    'the environment outranks orchestra.json for effort',
    /effort: low/.test((effortEnv.stdout || '').split('\n')[0]),
    (effortEnv.stdout || '').split('\n')[0]
  );
  const effortFlag = runExec(fx2, ['--effort', 'xhigh'], { ORCHESTRA_EXEC_HEAVY_EFFORT: 'low' });
  check(
    'a flag outranks everything for effort',
    /effort: xhigh/.test((effortFlag.stdout || '').split('\n')[0]),
    (effortFlag.stdout || '').split('\n')[0]
  );

  // --tier is not a recognised flag any more: there is no selectable tier. A
  // stray "--tier heavy" is silently ignored (unrecognised flags are), so
  // settings already resolved from orchestra.json above (fx) are unaffected.
  const tiered = runExec(fx, ['--tier', 'heavy']);
  const tout = tiered.stdout || '';
  check(
    '--tier is rejected as an unknown flag: does not select a model of its own',
    field(tout, 'MODEL') === 'gpt-5.6-sol-pinned' &&
      /model: gpt-5\.6-sol-pinned \(orchestra\.json\)/.test(tout.split('\n')[0]),
    'MODEL: ' + field(tout, 'MODEL') + ' — ' + tout.split('\n')[0]
  );
  check(
    '--tier leaves no tier line in the header',
    !/\btier:/.test(tout.split('\n')[0]),
    tout.split('\n')[0]
  );
}

function case4() {
  section('4. A failed run never claims OpenAI executed anything');
  const fx = makeRepo();
  const missing = path.join(fx.root, 'no-such-codex-binary');
  const r = runExec(fx, [], { CODEX_BIN: missing });
  const out = r.stdout || '';
  check('the run failed as intended', /STATUS: EXEC_UNAVAILABLE/.test(out), out.slice(0, 300));
  check(
    'header does NOT attribute the report to OpenAI',
    !/^EXEC ENGINE: OpenAI/m.test(out),
    out.split('\n').slice(0, 3).join('\n')
  );
  check('header names no engine at all', /^EXEC ENGINE: NONE/m.test(out), out.split('\n')[0]);
  check(
    'the attempt is still recorded for diagnosis',
    /^ATTEMPTED: OpenAI via Codex CLI \(/m.test(out),
    out.split('\n').slice(0, 3).join('\n')
  );
  check(
    'the body warns against treating the order as executed',
    /Do NOT treat this order as executed/.test(out),
    out.slice(-500)
  );
}

function case5() {
  section('5. Execution is never auto-retried — one attempt, honest finality');
  const fx = makeRepo();
  const counter = path.join(fx.root, 'attempts.txt');
  // The same knob that makes the REVIEW runner retry-and-succeed must leave
  // the EXEC runner failed after ONE launch: a retry here would re-run an
  // order against a tree the dead attempt may have half-edited.
  const r = runExec(fx, [], {
    STUB_CODEX_FAIL_UNTIL_ATTEMPT: '1',
    STUB_CODEX_ATTEMPT_FILE: counter,
    STUB_CODEX_EXIT: '143',
    STUB_CODEX_STDERR: 'codex: stream closed unexpectedly\n{"Authorization":"Basic dXNlcjpwYXNz"} TOKEN=exec-secret ssh://alice:hunter2@example.test SK-ANT-UPPERCASE99',
  });
  const out = r.stdout || '';
  check('the failure is the outcome', /STATUS: EXEC_UNAVAILABLE/.test(out), out.slice(0, 400));
  check(
    'the engine really was launched exactly once',
    fs.readFileSync(counter, 'utf8').trim() === '1',
    'attempt counter: ' + fs.readFileSync(counter, 'utf8').trim()
  );
  check(
    'finality says one attempt and why there is no second',
    /FINALITY: this runner made one engine attempt/.test(out) &&
      /never auto-retried/.test(out),
    out
  );
  check(
    'a 143 exit is named as signal-class and not blamed on the runner',
    /status 143 \(SIGTERM-class: 128\+15\)/.test(out) && /killed by:\s+NOT this runner/.test(out),
    out.slice(-1200)
  );
  check(
    "codex's last words on stderr are quoted",
    /codex stderr \(last 25 lines\):[\s\S]*stream closed unexpectedly/.test(out),
    out.slice(-1200)
  );
  check(
    'exec diagnostics redact every supported credential shape',
    !/dXNlcjpwYXNz|exec-secret|alice:hunter2|SK-ANT-UPPERCASE99/i.test(out) &&
      (out.match(/\[REDACTED\]/g) || []).length >= 4,
    out.slice(-1600)
  );

  // A timeout the runner itself enforced says so, by name.
  const fx2 = makeRepo();
  const t = runExec(fx2, ['--timeout-ms', '1500'], { STUB_CODEX_SLEEP_MS: '20000' });
  const tout = t.stdout || '';
  check(
    'a runner-enforced timeout is attributed to the runner',
    /killed by:\s+THIS RUNNER — its own 1500ms timer fired/.test(tout),
    tout.slice(0, 1200)
  );
  check('and says where the cap came from', /cap from: flag/.test(tout), tout.slice(0, 600));
}

function case6() {
  section('6. The tree audit measures what the engine actually changed');
  const fx = makeRepo();
  const r = runExec(fx, [], {
    STUB_CODEX_TOUCH: 'src/new-feature.js,build/out.o,node_modules/dep/index.js',
  });
  const out = r.stdout || '';
  check(
    'source paths the engine created are listed',
    /TREE AUDIT: 1 path\(s\) changed while the engine ran/.test(out) &&
      /appeared: src\/new-feature\.js/.test(out),
    out.slice(-800)
  );
  check(
    'generated build/cache churn is counted separately, not listed as source',
    /\+2 further path\(s\) matching the generated build\/engine-churn allowlist/.test(out) &&
      !/appeared: build\/out\.o/.test(out),
    out.slice(-800)
  );
  check(
    'the audit tells the reader to hold CHANGES against it',
    /Hold the CHANGES section above against this list/.test(out),
    out.slice(-400)
  );

  // The audit still prints when the engine DIES — the debris is exactly what
  // the Director needs before deciding what a re-dispatch starts from. The
  // stub mutates the tree and then exits silently, modelling a half-dead run.
  const fx2 = makeRepo();
  const silent = runExec(fx2, [], {
    STUB_CODEX_TOUCH: 'src/half-finished.js',
    STUB_CODEX_SILENT: '1',
  });
  const sout = silent.stdout || '';
  check(
    'a failed run still carries the tree audit of what was left behind',
    /STATUS: EXEC_UNAVAILABLE/.test(sout) && /TREE AUDIT/.test(sout) &&
      /appeared: src\/half-finished\.js/.test(sout),
    sout.slice(-900)
  );

  // A non-zero exit AFTER a report was written keeps the report (the engine's
  // output is the product, not its exit code) — and says so in the preflight.
  const fx3 = makeRepo();
  const dead = runExec(fx3, [], { STUB_CODEX_EXIT: '143' });
  const dout = dead.stdout || '';
  check(
    'a non-zero exit that still wrote a report keeps the report',
    /STATUS: DONE/.test(dout) && /but a final report had already been written/.test(dout),
    dout.slice(0, 600)
  );
}

function case7() {
  section('7. Idle precheck: the runner refuses to execute into a moving tree');
  const fx = makeRepo();
  const churn = spawn(
    process.execPath,
    ['-e', 'const fs=require("fs");setInterval(()=>{try{fs.appendFileSync(process.argv[1],"x")}catch(e){}},50)',
      path.join(fx.repo, 'churn.txt')],
    { stdio: 'ignore' }
  );
  const busy = runExec(fx, [], { ORCHESTRA_EXEC_IDLE_MS: '400' });
  check(
    'a moving tree is refused',
    /STATUS: EXEC_UNAVAILABLE/.test(busy.stdout || '') &&
      /working tree is not idle/.test(busy.stdout || ''),
    (busy.stdout || '').slice(0, 400)
  );
  churn.kill('SIGKILL');
}

function case8() {
  section('8. A report without a STATUS line is flagged, never upgraded');
  const fx = makeRepo();
  const r = runExec(fx, [], { STUB_CODEX_FIRST_LINE: 'VERDICT: APPROVE' });
  const out = r.stdout || '';
  check(
    'the runner appends its note instead of inventing a status',
    /RUNNER NOTE: the engine's report carries no STATUS:/.test(out) &&
      /Treat this order as PARTIAL/.test(out),
    out.slice(-600)
  );
  const ok = runExec(fx, []);
  check(
    'a report that carries a STATUS line gets no note',
    !/RUNNER NOTE/.test(ok.stdout || ''),
    (ok.stdout || '').slice(-400)
  );
}

function case9() {
  section('9. Stage-a probe catches a dead engine before the tree is touched');
  const fx = makeRepo();
  const r = runExec(fx, [], { STUB_CODEX_PROBE_EXIT: '1' });
  const out = r.stdout || '';
  check(
    'a failing probe refuses the order',
    /STATUS: EXEC_UNAVAILABLE/.test(out) && /failed a trivial echo/.test(out),
    out.slice(0, 700)
  );
  check(
    'the order itself was never attempted',
    !/STUB REPORT/.test(out) && /The order was NOT attempted/.test(out),
    out.slice(0, 900)
  );
  const off = runExec(fx, ['--no-probe'], { STUB_CODEX_PROBE_EXIT: '1' });
  check(
    '--no-probe skips it entirely',
    /STATUS: DONE/.test(off.stdout || '') && !/auth\/exec probe/.test(off.stdout || ''),
    (off.stdout || '').slice(0, 500)
  );
}

function case10() {
  section('10. Git isolation carries the user\'s identity, so ordered commits work');
  const fx = makeRepo();
  const fakeHome = path.join(fx.root, 'home');
  fs.mkdirSync(fakeHome, { recursive: true });
  fs.writeFileSync(
    path.join(fakeHome, '.gitconfig'),
    '[user]\n\tname = Fielded Identity\n\temail = fielded@example.com\n'
  );
  const homeEnv = {
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    XDG_CONFIG_HOME: path.join(fakeHome, '.config'),
  };
  const on = runExec(fx, [], homeEnv);
  const out = on.stdout || '';
  check(
    'the engine sees an isolated global git config',
    field(out, 'GIT_CONFIG_GLOBAL') !== '(unset)',
    'GIT_CONFIG_GLOBAL: ' + field(out, 'GIT_CONFIG_GLOBAL')
  );
  check(
    'and the user\'s identity was seeded into it',
    field(out, 'GIT_USER_NAME') === 'Fielded Identity',
    'GIT_USER_NAME: ' + field(out, 'GIT_USER_NAME')
  );
  const off = runExec(fx, [], Object.assign({}, homeEnv, { ORCHESTRA_EXEC_GIT_ISOLATION: '0' }));
  check(
    'with isolation off, no scratch config is injected',
    field(off.stdout || '', 'GIT_CONFIG_GLOBAL') === '(unset)',
    'GIT_CONFIG_GLOBAL: ' + field(off.stdout || '', 'GIT_CONFIG_GLOBAL')
  );
}

function case11() {
  section('11. Prohibitions reach the brief as hard constraints');
  const fx = makeRepo();
  writeProjectConfig(fx, { codex: { doNotRun: ['godot'] } });
  const r = runExec(fx, ['--forbid', 'terraform apply']);
  const out = r.stdout || '';
  check(
    'the prohibition block reached the engine',
    /PROHIBITED COMMANDS/.test(field(out, 'BRIEF_MARKERS')),
    'BRIEF_MARKERS: ' + field(out, 'BRIEF_MARKERS')
  );
  check(
    'the header counts them (config + flag, deduped)',
    /prohibited commands: 2/.test(out.split('\n')[0]),
    out.split('\n')[0]
  );

  // ...and the verification manifest is injected where one exists.
  const fx2 = makeRepo();
  writeProjectConfig(fx2, { verification: { full: 'npm test' } });
  const m = runExec(fx2, []);
  check(
    'the verification manifest reaches the brief',
    /VERIFICATION MANIFEST/.test(field(m.stdout || '', 'BRIEF_MARKERS')),
    'BRIEF_MARKERS: ' + field(m.stdout || '', 'BRIEF_MARKERS')
  );
  // Zero is a number the Director needs: an order whose prose forbade
  // something, dispatched with no flag, reads as "prohibited commands: 0" here
  // rather than as silence.
  check(
    'the count is stated even when nothing is prohibited',
    /prohibited commands: 0/.test((m.stdout || '').split('\n')[0]),
    (m.stdout || '').split('\n')[0]
  );

  // A codex key written one level too high is inert. It used to be inert AND
  // invisible, which is how a project "sets" a timeout and keeps getting the
  // default.
  const fx3 = makeRepo();
  fs.mkdirSync(path.join(fx3.repo, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(fx3.repo, '.claude', 'orchestra.json'),
    JSON.stringify({ execTimeoutMs: 1800000, codex: {} }, null, 2)
  );
  const mis = runExec(fx3, []).stdout || '';
  check(
    'a misplaced codex key is named as ignored in the header',
    /execTimeoutMs/.test(mis) && /TOP LEVEL/.test(mis),
    mis.split('\n').slice(0, 10).join('\n')
  );
}

function case12() {
  section('12. Guard rails: read-only dry runs, missing orders, directed worktrees');
  const fx = makeRepo();
  const dry = runExec(fx, [], { ORCHESTRA_EXEC_SANDBOX: 'read-only' });
  check(
    'a read-only sandbox is honoured and loudly labelled a dry run',
    field(dry.stdout || '', 'SANDBOX') === 'read-only' &&
      /PREFLIGHT: sandbox is read-only/.test(dry.stdout || '') &&
      /dry run, not an execution/.test(dry.stdout || ''),
    (dry.stdout || '').slice(0, 700)
  );

  const empty = { repo: fx.repo, root: fx.root, wo: path.join(fx.root, 'missing-order.txt') };
  const none = runExec(empty, []);
  check(
    'a missing work order refuses before touching anything',
    /STATUS: EXEC_UNAVAILABLE/.test(none.stdout || '') && /no work order/.test(none.stdout || ''),
    (none.stdout || '').slice(0, 400)
  );

  // --cd points the engine at a Director-prepared worktree instead.
  const other = path.join(fx.root, 'elsewhere');
  fs.mkdirSync(other);
  git(['init', '-q', '-b', 'main'], other);
  fs.writeFileSync(path.join(other, 'x.js'), 'x\n');
  git(['add', '-A'], other);
  git(['-c', 'user.email=t@e.com', '-c', 'user.name=T', 'commit', '-qm', 'base'], other);
  const cd = runExec(fx, ['--cd', other]);
  check(
    'a directed worktree is used and labelled',
    path.resolve(field(cd.stdout || '', 'CWD')) === path.resolve(other) &&
      /tree: directed worktree/.test((cd.stdout || '').split('\n')[0]),
    'CWD: ' + field(cd.stdout || '', 'CWD') + ' — ' + (cd.stdout || '').split('\n')[0]
  );

  // FIX (field, 2026-09-07): the Agent tool's `isolation: "worktree"` put the
  // launcher in a worktree the runner cannot see (the MCP server runs at the
  // repo root), so launchers now pass their own cwd as `cd` on every call —
  // including when that cwd IS the live tree. `cd` pointing at the project
  // dir, spelled with forward slashes and (on win32) different case, must
  // still resolve to "live working tree", not read as a second, directed one.
  const slashVariant = fx.repo.split(path.sep).join('/');
  const cdSlash = runExec(fx, ['--cd', slashVariant]);
  check(
    '`cd` equal to the live tree (forward slashes) is labelled live, not directed',
    /tree: live working tree/.test((cdSlash.stdout || '').split('\n')[0]),
    (cdSlash.stdout || '').split('\n')[0]
  );
  if (process.platform === 'win32') {
    const caseVariant = fx.repo.toUpperCase();
    const cdCase = runExec(fx, ['--cd', caseVariant]);
    check(
      '`cd` equal to the live tree (different case, win32) is labelled live, not directed',
      /tree: live working tree/.test((cdCase.stdout || '').split('\n')[0]),
      (cdCase.stdout || '').split('\n')[0]
    );
  }
}

function case13() {
  section('13. The Codex install directory leads the engine\'s PATH');

  // Both lanes drive the SAME Codex install, and the failure this guards is
  // silent in both: `codex-windows-sandbox-setup.exe` is resolved by NAME, so
  // an install directory that is not itself on PATH can leave the sandbox
  // unestablished — the engine runs and produces nothing (the review lane lost
  // six days to exactly that, 2026-08-12 → 08-18). Carried into the exec
  // runner in v1.6.0; asserted here so it cannot regress independently.
  //
  // Compare SYMLINK-RESOLVED, and note why: the runner resolves CODEX_BIN to
  // its real path on purpose (a link breaks Codex's own sibling lookup), so
  // the directory it hands the engine is the realpath. On macOS `os.tmpdir()`
  // is `/var/folders/…`, a symlink to `/private/var/folders/…` — so a fixture
  // path and the runner's answer are the same directory spelled two ways, and
  // `path.resolve`, which does not follow links, calls them different. That is
  // what failed this case on all three macOS runners while Linux and Windows
  // passed; the runner was right and the assertion was wrong.
  const real = (p) => {
    try {
      return fs.realpathSync(p);
    } catch (_) {
      return path.resolve(p); // not on disk — compare as written
    }
  };
  const same = (a, b) =>
    process.platform === 'win32'
      ? real(a).toLowerCase() === real(b).toLowerCase()
      : real(a) === real(b);

  const fx = makeRepo();
  const installDir = path.join(fx.root, 'OpenAI', 'Codex', 'bin', 'abc123');
  const fakeBin = makeStubBin(installDir, 'codex-stub');
  const r = runExec(fx, [], { CODEX_BIN: fakeBin });
  const out = r.stdout || '';
  const first = field(out, 'PATH_FIRST');
  check(
    'the resolved install directory is FIRST on the engine\'s PATH',
    !!first && same(first, installDir),
    'PATH_FIRST: ' + first + '\ninstall dir: ' + installDir + ' (realpath: ' + real(installDir) + ')'
  );

  // ...and it is not added twice when it is already leading. The runner
  // compares PATH entries with `path.resolve`, exactly as the review runner
  // does — the two copies of this fix are kept identical on purpose — so the
  // spelling injected here is the RESOLVED one, which is what the runner will
  // be comparing against. Injecting the unresolved spelling would leave the
  // dedup branch untaken and the check passing without proving anything.
  const resolvedInstall = real(installDir);
  const injected = resolvedInstall + path.delimiter + (process.env.PATH || '');
  const already = runExec(fx, [], { CODEX_BIN: fakeBin, PATH: injected, Path: injected });
  const parts = (field(already.stdout || '', 'PATH_FULL') || '')
    .split(path.delimiter)
    .filter(Boolean);
  const dupes = parts.filter((p) => same(p, resolvedInstall));
  check(
    'an install directory already leading PATH is not prepended a second time',
    dupes.length === 1,
    'occurrences: ' + dupes.length + ' of ' + resolvedInstall +
      '\nPATH head: ' + parts.slice(0, 3).join(path.delimiter)
  );
}

function case14() {
  section('14. Report integrity: the engine must echo this run\'s token');
  const fx = makeRepo();
  const r1 = runExec(fx, []);
  const out1 = r1.stdout || '';
  check(
    'the header carries a per-run nonce',
    /^RUN NONCE: [0-9a-f]{16}$/m.test(out1),
    out1.split('\n').slice(0, 4).join('\n')
  );
  check(
    'a faithful echo is verified in the output',
    /REPORT INTEGRITY: verified — the engine echoed run token [0-9a-f]{16}/.test(out1),
    out1.slice(-400)
  );
  check(
    'the audit states its in-process provenance',
    /never from engine or session artifacts/.test(out1),
    out1.slice(-600)
  );
  const r2 = runExec(fx, []);
  const nonce = (o) => (/^RUN NONCE: ([0-9a-f]{16})$/m.exec(o) || [])[1] || '';
  check(
    'two runs carry two different nonces',
    nonce(out1) && nonce(r2.stdout || '') && nonce(out1) !== nonce(r2.stdout || ''),
    nonce(out1) + ' vs ' + nonce(r2.stdout || '')
  );

  // A report that cannot echo the token — the stale-replay signature — is
  // refused, shown only as labelled untrusted text, and never STATUS: DONE.
  const omit = runExec(fx, [], { STUB_CODEX_OMIT_NONCE: '1' });
  const oout = omit.stdout || '';
  check(
    'a report without the token is EXEC_UNAVAILABLE, not DONE',
    /STATUS: EXEC_UNAVAILABLE/.test(oout) &&
      /report integrity check failed/.test(oout) &&
      !/^EXEC ENGINE: OpenAI/m.test(oout),
    oout.slice(0, 600)
  );
  check(
    'the discarded report is still shown, labelled untrusted',
    /UNVERIFIED ENGINE OUTPUT/.test(oout) && /STUB REPORT/.test(oout),
    oout.slice(-900)
  );

  // The right shape with the WRONG token — a previous run's report — is
  // equally refused: the token is per-run, not per-format.
  const stale = runExec(fx, [], { STUB_CODEX_NONCE_VALUE: 'deadbeefdeadbeef' });
  check(
    'a previous run\'s token is refused like a missing one',
    /STATUS: EXEC_UNAVAILABLE/.test(stale.stdout || '') &&
      /report integrity check failed/.test(stale.stdout || ''),
    (stale.stdout || '').slice(0, 600)
  );
}

function case15() {
  section('15. Fresh-session enforcement: resume-prone args never launch');
  const fx = makeRepo();
  const counter = path.join(fx.root, 'attempts.txt');
  const r = runExec(fx, [], {
    ORCHESTRA_EXEC_ARGS: 'resume --last',
    STUB_CODEX_ATTEMPT_FILE: counter,
  });
  const out = r.stdout || '';
  check(
    'resume-prone ORCHESTRA_EXEC_ARGS are refused',
    /STATUS: EXEC_UNAVAILABLE/.test(out) &&
      /would resume a previous Codex session/.test(out),
    out.slice(0, 500)
  );
  check(
    'the engine (and even the probe) was never launched',
    !fs.existsSync(counter),
    'attempt counter exists: ' + fs.existsSync(counter)
  );
  check(
    'the refusal names the offending tokens',
    /resume, --last/.test(out),
    out.slice(0, 800)
  );
}

function case16() {
  section('16. Report/audit contradiction: claimed edits that never happened');
  const fx = makeRepo();
  const lie = runExec(fx, [], {
    STUB_CODEX_CLAIM_CHANGES: 'src/app.js:12 — added a flag,src/other.js — new helper',
  });
  const lout = lie.stdout || '';
  check(
    'claiming edits against an untouched tree is EXEC_UNAVAILABLE',
    /STATUS: EXEC_UNAVAILABLE/.test(lout) &&
      /claims edits the runner measured as never happening/.test(lout),
    lout.slice(0, 700)
  );
  check(
    'the contradiction shows both sides: the claims and the still-clean audit',
    /src\/app\.js:12/.test(lout) && /TREE AUDIT: no source paths changed/.test(lout),
    lout.slice(0, 1200)
  );

  // The same claim WITH a real matching edit passes — the check is about
  // contradiction, not about the presence of a CHANGES section.
  const fx2 = makeRepo();
  const honest = runExec(fx2, [], {
    STUB_CODEX_CLAIM_CHANGES: 'src/new-feature.js — created',
    STUB_CODEX_TOUCH: 'src/new-feature.js',
  });
  check(
    'the same claim with a real edit is relayed as a verified report',
    /STATUS: DONE/.test(honest.stdout || '') &&
      /REPORT INTEGRITY: verified/.test(honest.stdout || ''),
    (honest.stdout || '').slice(0, 500)
  );

  // A read-only dry run cannot land an edit by design, so its claims are not
  // held against the (necessarily untouched) tree.
  const fx3 = makeRepo();
  const dry = runExec(fx3, [], {
    ORCHESTRA_EXEC_SANDBOX: 'read-only',
    STUB_CODEX_CLAIM_CHANGES: 'src/app.js — would change',
  });
  check(
    'a read-only dry run skips the contradiction check',
    /STATUS: DONE/.test(dry.stdout || '') && !/EXEC_UNAVAILABLE/.test(dry.stdout || ''),
    (dry.stdout || '').slice(0, 500)
  );
}

function case17() {
  section('17. Launcher protocol: shell transport gone, MCP tool wiring structural');
  // The shell pipeline (heredoc-to-scratch, run tokens, ORCHESTRA_RUNNER_DONE
  // sentinels, background-and-poll, stdout scraping) produced the majority of
  // the lane's recorded field failures — including the 2026-08-19 stale-report
  // replay. The launchers now make ONE typed MCP tool call instead, and these
  // checks pin the replacement: no transport machinery may reappear in a
  // profile, and the tools frontmatter must make shelling out structurally
  // impossible rather than merely discouraged.
  const launchers = [
    ['packs/codex/agents/executor-codex-heavy.md', 'mcp__orchestra-engine__orchestra_exec'],
    ['packs/codex/agents/executor-codex-principal.md', 'mcp__orchestra-engine__orchestra_exec'],
    ['packs/codex/agents/reviewer-codex.md', 'mcp__orchestra-engine__orchestra_review'],
  ];
  for (const [rel, tool] of launchers) {
    const text = fs.readFileSync(path.join(MASTER, rel), 'utf8');
    const toolsLine = (/^tools: (.*)$/m.exec(text) || [])[1] || '';
    check(
      rel + ': tools frontmatter grants the lane\'s MCP tool',
      toolsLine.split(',').map((s) => s.trim()).includes(tool),
      'tools: ' + toolsLine
    );
    check(
      rel + ': tools frontmatter grants no shell (shelling out is structurally impossible)',
      !/\b(Bash|PowerShell)\b/.test(toolsLine),
      'tools: ' + toolsLine
    );
    check(
      rel + ': no shell-transport machinery remains (sentinels, output files, background polling)',
      !/ORCHESTRA_RUNNER_DONE|\$OUT|run_in_background|mktemp/.test(text),
      (text.match(/ORCHESTRA_RUNNER_DONE|\$OUT|run_in_background|mktemp/g) || []).join(', ')
    );
    check(
      rel + ': the one-call law survives the rewrite',
      /[Oo]ne call|calls? the .* tool once|\*\*one\*\* call/i.test(text),
      'no one-call language found'
    );
  }
}

// The second Codex executor rung. The lane is now two profiles behind one
// runner, and the whole safety story rests on three properties: the default is
// unchanged (a run that names no profile is the run this file always made),
// each rung reads only its OWN env vars and config keys (pinning one may never
// move the other), and a profile that does not exist can never silently run
// the other engine while a launcher relays the report as that engine's work.
function case18() {
  section('18. Two executor rungs: profile selection, key isolation, unknown-profile alarm');

  const fx = makeRepo();

  const dflt = runExec(fx, []);
  check(
    'no --profile is the heavy rung, unchanged: Sol at high effort',
    field(dflt.stdout || '', 'MODEL') === 'gpt-5.6-sol' &&
      /profile: heavy, model: gpt-5\.6-sol \(default\), effort: high/.test(dflt.stdout || ''),
    (dflt.stdout || '').split('\n')[0]
  );

  const principal = runExec(fx, ['--profile', 'principal']);
  const pout = principal.stdout || '';
  check(
    '--profile principal is GPT-6 Astra at xhigh effort',
    field(pout, 'MODEL') === 'gpt-6-astra' &&
      /profile: principal, model: gpt-6-astra \(default\), effort: xhigh/.test(pout),
    pout.split('\n')[0]
  );
  check(
    'the principal rung reaches the engine as a real run, not a refusal',
    /STATUS: DONE/.test(pout) && /^EXEC ENGINE: OpenAI/m.test(pout),
    pout.slice(0, 300)
  );
  check(
    'no model/effort override: no PREFLIGHT note about running off-default',
    !/PREFLIGHT:.*is running (model|effort)/.test(pout),
    (pout.match(/^PREFLIGHT:.*$/gm) || []).join(' | ') || '(no PREFLIGHT lines)'
  );
  check(
    'the principal rung sends its effort to codex, not just to the header',
    field(pout, 'CONFIG_OVERRIDES') ===
      'model_reasoning_effort=xhigh | features.hooks=false | project_doc_max_bytes=0 | features.apps=false',
    'CONFIG_OVERRIDES: ' + field(pout, 'CONFIG_OVERRIDES')
  );

  // Key isolation, both directions. A project that pins the heavy rung has
  // said nothing about the principal rung, and vice versa.
  const pinnedHeavy = makeRepo();
  writeProjectConfig(pinnedHeavy, {
    codex: { execHeavyModel: 'sol-pinned', execHeavyEffort: 'medium' },
  });
  const heavyKeysOnPrincipal = runExec(pinnedHeavy, ['--profile', 'principal']);
  check(
    'codex.execHeavyModel/Effort do not leak into the principal rung',
    field(heavyKeysOnPrincipal.stdout || '', 'MODEL') === 'gpt-6-astra' &&
      /effort: xhigh/.test((heavyKeysOnPrincipal.stdout || '').split('\n')[0]),
    (heavyKeysOnPrincipal.stdout || '').split('\n')[0]
  );

  const pinnedPrincipal = makeRepo();
  writeProjectConfig(pinnedPrincipal, {
    codex: { execPrincipalModel: 'astra-pinned', execPrincipalEffort: 'max' },
  });
  const principalKeysOnHeavy = runExec(pinnedPrincipal, []);
  check(
    'codex.execPrincipalModel/Effort do not leak into the heavy rung',
    field(principalKeysOnHeavy.stdout || '', 'MODEL') === 'gpt-5.6-sol' &&
      /effort: high/.test((principalKeysOnHeavy.stdout || '').split('\n')[0]),
    (principalKeysOnHeavy.stdout || '').split('\n')[0]
  );
  const principalPinned = runExec(pinnedPrincipal, ['--profile', 'principal']);
  check(
    'codex.execPrincipalModel/Effort DO supply the principal rung, and are credited',
    field(principalPinned.stdout || '', 'MODEL') === 'astra-pinned' &&
      /model: astra-pinned \(orchestra\.json\), effort: max/.test(principalPinned.stdout || ''),
    (principalPinned.stdout || '').split('\n')[0]
  );

  // Same isolation for the environment.
  const envCross = runExec(fx, ['--profile', 'principal'], {
    ORCHESTRA_EXEC_HEAVY_MODEL: 'sol-from-env',
  });
  check(
    'ORCHESTRA_EXEC_HEAVY_MODEL does not reach the principal rung',
    field(envCross.stdout || '', 'MODEL') === 'gpt-6-astra',
    (envCross.stdout || '').split('\n')[0]
  );
  const envPrincipal = runExec(fx, ['--profile', 'principal'], {
    ORCHESTRA_EXEC_PRINCIPAL_MODEL: 'astra-from-env',
    ORCHESTRA_EXEC_PRINCIPAL_EFFORT: 'high',
  });
  check(
    'ORCHESTRA_EXEC_PRINCIPAL_* supply the principal rung and are credited',
    field(envPrincipal.stdout || '', 'MODEL') === 'astra-from-env' &&
      /model: astra-from-env \(env\), effort: high/.test(envPrincipal.stdout || ''),
    (envPrincipal.stdout || '').split('\n')[0]
  );
  const envOnHeavy = runExec(fx, [], { ORCHESTRA_EXEC_PRINCIPAL_MODEL: 'astra-from-env' });
  check(
    'ORCHESTRA_EXEC_PRINCIPAL_MODEL does not reach the heavy rung',
    field(envOnHeavy.stdout || '', 'MODEL') === 'gpt-5.6-sol',
    (envOnHeavy.stdout || '').split('\n')[0]
  );

  // An unknown rung must never quietly become the other one. "astra" is the
  // near-miss a human would actually type for the principal rung, so it is the
  // one worth pinning.
  const bogus = runExec(fx, ['--profile', 'astra']);
  const bout = bogus.stdout || '';
  check(
    'an unknown --profile falls back to heavy rather than inventing an engine',
    field(bout, 'MODEL') === 'gpt-5.6-sol' && /profile: heavy/.test(bout),
    bout.split('\n')[0]
  );
  check(
    'an unknown --profile is announced in PREFLIGHT, naming what did not exist',
    /^PREFLIGHT: unknown --profile "astra"/m.test(bout) &&
      /known profiles: heavy, principal/.test(bout),
    (bout.match(/^PREFLIGHT:.*$/m) || ['no PREFLIGHT line'])[0]
  );

  // A profile is still only a pair of defaults: an explicit flag outranks it,
  // exactly as it outranks env and config on the heavy rung (case 2).
  const flagOverPrincipal = runExec(fx, ['--profile', 'principal', '--model', 'gpt-6-flag']);
  const fopOut = flagOverPrincipal.stdout || '';
  check(
    'an explicit --model still outranks the profile default',
    field(fopOut, 'MODEL') === 'gpt-6-flag' &&
      /profile: principal, model: gpt-6-flag \(flag\)/.test(fopOut),
    fopOut.split('\n')[0]
  );
  // FIX (field, 2026-09-07): WO-4A round 7 ran gpt-5.6-sol (default) at high
  // effort under an Astra launcher because the launcher dropped its fields —
  // a PREFLIGHT note now flags a principal run on a non-default model/effort,
  // so a pin and a dropped field never look the same from the header.
  check(
    'a principal launch on a non-default model gets a PREFLIGHT note naming the pin',
    /PREFLIGHT: profile principal is running model "gpt-6-flag" \(flag\), not its default gpt-6-astra/.test(fopOut),
    (fopOut.match(/^PREFLIGHT:.*$/gm) || []).join(' | ')
  );
  check(
    'the same run\'s effort is still the default, so no effort PREFLIGHT note fires',
    !/PREFLIGHT:.*is running effort/.test(fopOut),
    (fopOut.match(/^PREFLIGHT:.*$/gm) || []).join(' | ')
  );

  // The note is specific to the principal profile: an override on the heavy
  // rung must never trigger it.
  const flagOverHeavy = runExec(fx, ['--model', 'gpt-6-flag']);
  check(
    'the same override on the heavy profile gets no PREFLIGHT note',
    !/PREFLIGHT:.*is running (model|effort)/.test(flagOverHeavy.stdout || ''),
    (flagOverHeavy.stdout || '').match(/^PREFLIGHT:.*$/gm) || []
  );
}

// The executor ladder is doctrine, not code — it lives in prose the Director
// reads at PLAN time, so nothing mechanical stops it from drifting back. These
// checks pin the three claims that make the ladder work, in the files that
// actually carry them. The failure they guard against is silent: a reworded
// agent description that quietly re-promotes a demoted profile would change
// where every escalated order goes, with no test red and no runtime error.
function case19() {
  section('19. Executor ladder doctrine: Astra on top, Fable and Sol demoted');

  const read = (rel) => fs.readFileSync(path.join(MASTER, rel), 'utf8');
  const frontmatter = (rel) => (/^description: (.*)$/m.exec(read(rel)) || [])[1] || '';

  // 1. The demoted profiles must SAY they are demoted, in the description —
  //    that string is what the Director's agent picker actually sees.
  for (const rel of [
    'agents/executor-principal.md',
    'agents/executor-principal-xhigh.md',
    'packs/codex/agents/executor-codex-heavy.md',
  ]) {
    const d = frontmatter(rel);
    check(
      rel + ': description declares USER REQUEST ONLY',
      /USER REQUEST ONLY/.test(d),
      d.slice(0, 200)
    );
    check(
      rel + ': description does not claim to be the top rung of the ladder',
      !/\bthe top rung of the default\b|\bTOP RUNG OF THE DEFAULT\b/.test(d),
      d.slice(0, 200)
    );
  }

  // 2. The Astra launcher must claim the top rung, and name the ladder that
  //    reaches it. A launcher that does not know it is the escalation target
  //    cannot tell the Director that a failure here is a plan problem.
  const astra = read('packs/codex/agents/executor-codex-principal.md');
  check(
    'executor-codex-principal declares itself the default ladder\'s top rung',
    /TOP RUNG OF THE DEFAULT EXECUTOR LADDER/.test(astra) &&
      /top rung of the default executor ladder/i.test(astra),
    astra.slice(0, 400)
  );
  check(
    'executor-codex-principal names the full ladder that reaches it',
    /`executor`[^\n]*`executor-heavy`[^\n]*you/.test(astra),
    (astra.match(/^You are the \*\*top rung.*$/m) || ['no ladder line'])[0].slice(0, 200)
  );
  check(
    'executor-codex-principal knows nothing is above it',
    /There is no rung above you/.test(astra),
    'the no-higher-rung line is missing'
  );

  // 3. The Opus heavy profiles must NOT claim to be the top tier: that stale
  //    line (true before 3.1.0, false since) tells the rung directly below the
  //    escalation target that there is nowhere to escalate to.
  for (const rel of ['agents/executor-heavy.md', 'agents/executor-heavy-xhigh.md']) {
    const t = read(rel);
    check(
      rel + ': does not claim to be the top execution tier',
      !/You are the top execution tier/.test(t) &&
        !/there is no higher tier to re-send the order to/.test(t),
      (t.match(/^.*top execution tier.*$/m) || ['ok'])[0].slice(0, 200)
    );
    check(
      rel + ': names the principal rung as where a dead end escalates',
      /executor-codex-principal/.test(t),
      'the heavy profile never names its escalation target'
    );
  }

  // 4. The default rung and the tight-spec rung. The failure this guards is
  //    the one the owner actually observed in the field: Sonnet given orders
  //    that needed judgment about what they meant. That is a routing default,
  //    so it lives in frontmatter, and frontmatter drifts silently.
  const execFm = read('agents/executor.md');
  check(
    'executor is Opus at medium effort — the default rung',
    /^model: opus$/m.test(execFm) && /^effort: medium$/m.test(execFm),
    (execFm.match(/^(model|effort): .*$/gm) || []).join(' | ')
  );
  check(
    'executor declares itself THE DEFAULT EXECUTOR',
    /THE DEFAULT EXECUTOR/.test(frontmatter('agents/executor.md')),
    frontmatter('agents/executor.md').slice(0, 160)
  );
  const mech = read('agents/executor-mechanical.md');
  check(
    'executor-mechanical is Sonnet at high effort',
    /^model: sonnet$/m.test(mech) && /^effort: high$/m.test(mech),
    (mech.match(/^(model|effort): .*$/gm) || []).join(' | ')
  );
  check(
    'executor-mechanical is reserved by SPEC TIGHTNESS, not task size',
    /RESERVED for orders that are routine and mechanical, or whose goal and instructions are airtight/.test(
      frontmatter('agents/executor-mechanical.md')
    ),
    frontmatter('agents/executor-mechanical.md').slice(0, 200)
  );
  check(
    'executor-mechanical keeps the full executor law, including Blocked beats guessed',
    /\*\*Blocked beats guessed\.\*\*/.test(mech) && /STATUS: DONE \| PARTIAL \| BLOCKED \| CHECKPOINT/.test(mech),
    'the shared executor law did not survive into the mechanical rung'
  );
  check(
    'executor-mechanical treats a mis-routed vague order as BLOCKED, not something to widen',
    /mis-routed/.test(mech) && /Never widen a vague order/.test(mech),
    'the mis-routing escape hatch is missing'
  );

  // 4. ORCHESTRA.md is the Director's own copy of the ladder. Pin the two
  //    claims an order's routing actually turns on.
  const protocol = read('ORCHESTRA.md');
  check(
    'ORCHESTRA.md makes executor (Opus medium) the default rung',
    /`executor` \(Opus, medium\) is the default/.test(protocol),
    (protocol.match(/^\*\*Executor steering\.\*\*.*$/m) || ['no steering line'])[0].slice(0, 300)
  );
  check(
    'ORCHESTRA.md routes by thinking difficulty, not diff size',
    /Route by how hard the thinking is, not by how big the diff is/.test(protocol) &&
      /Sonnet is not the small-task rung; it is the tight-spec rung/.test(protocol),
    'the route-by-thinking rule is missing — this is the rule that keeps Sonnet from being overloaded'
  );
  check(
    'ORCHESTRA.md still escalates across the vendor line to Astra',
    /double bounce at the heavy tier escalates straight to Astra/.test(protocol),
    'the vendor-crossing escalation sentence is missing'
  );
  check(
    'ORCHESTRA.md marks the Fable and Sol executors user-request-only',
    /\*\*Everything else on the bench is user request only\*\*/.test(protocol) &&
      /`executor-principal`, `executor-principal-xhigh`\) and the Sol executor/.test(protocol),
    'the user-request-only paragraph is missing or reworded'
  );
  check(
    'ORCHESTRA.md 3.5 carries the full five-rung escalation ladder',
    /`executor-mechanical` → `executor` → `executor-heavy` → `executor-heavy-xhigh` → `executor-codex-principal`/.test(protocol),
    (protocol.match(/^5\. \*\*Escalate.*$/m) || ['no rule 5'])[0].slice(0, 300)
  );
  check(
    'ORCHESTRA.md requires the Astra-unavailable substitution to be announced',
    /When the Astra rung is unavailable/.test(protocol) &&
      /escalate to `executor-principal` instead/.test(protocol),
    'the unavailable-rung fallback rule is missing'
  );
}

// The principal rung's charter has to reach the ENGINE, not just the launcher.
// The Astra launcher tells the Director that the report will carry a DECISIONS
// section and that the order is goal-shaped; before this, nothing in the brief
// asked the engine for either, so the launcher was promising a section on
// behalf of a model that had never been told to write it. These checks pin the
// charter to the profile that earns it, and pin its ABSENCE on the rung that
// does not — a heavy order is step-shaped and must not be told otherwise.
function case20() {
  section('20. The principal charter reaches the engine, and only on the principal rung');

  const fx = makeRepo();

  const heavy = runExec(fx, []);
  const heavyMarkers = field(heavy.stdout || '', 'BRIEF_MARKERS');
  check(
    'a heavy order is NOT given the principal charter',
    !/THIS IS A PRINCIPAL ORDER/.test(heavyMarkers),
    'BRIEF_MARKERS: ' + heavyMarkers
  );
  check(
    'a heavy order is NOT asked for a DECISIONS section',
    !/DECISIONS/.test(heavyMarkers),
    'BRIEF_MARKERS: ' + heavyMarkers
  );
  check(
    'the heavy brief still carries the shared executor law and the work order',
    /WORK ORDER/.test(heavyMarkers),
    'BRIEF_MARKERS: ' + heavyMarkers
  );

  const principal = runExec(fx, ['--profile', 'principal']);
  const pMarkers = field(principal.stdout || '', 'BRIEF_MARKERS');
  check(
    'a principal order IS given the goal-shaped charter',
    /THIS IS A PRINCIPAL ORDER/.test(pMarkers),
    'BRIEF_MARKERS: ' + pMarkers
  );
  check(
    'a principal order IS asked for a DECISIONS section — the launcher promises it',
    /DECISIONS/.test(pMarkers),
    'BRIEF_MARKERS: ' + pMarkers
  );
  check(
    'the principal brief still carries the shared executor law and the work order',
    /WORK ORDER/.test(pMarkers),
    'BRIEF_MARKERS: ' + pMarkers
  );
  check(
    'the principal run still produces a normal report — the charter did not break the contract',
    /STATUS: DONE/.test(principal.stdout || '') &&
      /REPORT INTEGRITY: verified/.test(principal.stdout || ''),
    (principal.stdout || '').slice(-400)
  );

  // The charter is text the engine reads, so pin its load-bearing clauses in
  // the runner source rather than only its presence in the brief.
  const runnerSrc = fs.readFileSync(RUNNER, 'utf8');
  for (const [label, re] of [
    ['goal-shaped, not step-shaped', /goal-shaped, not step-shaped/],
    ['boundaries are the scope, not a file list', /not a file[\s\S]{0,40}list/],
    ['decide the routine, ask about the material', /Decide the routine, ask about the material/],
    ['recon before you build', /Recon before you build/],
    ['surface the coupling', /Surface the coupling/],
    ['a wrong goal is BLOCKED, never a silent substitution', /never a silent substitution/],
  ]) {
    check('principal charter states: ' + label, re.test(runnerSrc), 'clause missing from the brief');
  }
}

// ------------------------------------------------------------------ driver

// 21. FIX (field, 2026-09-06): three failures with one root — the scratch git
//     config REPLACED the user's global config, which dropped the credential
//     helper (a sandboxed `git fetch` died on "could not read Username") and
//     the LFS filters (15 untouched PNGs read as modified, and Astra refused a
//     "clean tree" precondition twice). The same campaign found the engine
//     could not tell pre-existing dirt from its own, and that a Codex config
//     declaring a same-vendor MCP turned a cross-vendor run into delegation.
function case21() {
  section('21. Global git config carries across; tree state and MCP isolation reach the engine');
  const fx = makeRepo();
  const globalCfg = path.join(fx.root, 'global-gitconfig');
  fs.writeFileSync(
    globalCfg,
    '[user]\n\tname = Global Person\n\temail = g@example.com\n' +
      '[credential]\n\thelper = orchestra-test-helper\n' +
      '[filter "lfs"]\n\tclean = git-lfs clean -- %f\n\tsmudge = git-lfs smudge -- %f\n' +
      '\tprocess = git-lfs filter-process\n'
  );
  // Pre-existing dirt: a harness-owned untracked file and a modified tracked file.
  fs.mkdirSync(path.join(fx.repo, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(fx.repo, '.claude', 'settings.local.json'), '{}\n');
  fs.appendFileSync(path.join(fx.repo, 'app.js'), '// edited before the run\n');
  // A Codex config with two bare-named servers (one declared only through a
  // subsection) and one quoted name that -c cannot address.
  const codexHome = path.join(fx.root, 'codex-home');
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(
    path.join(codexHome, 'config.toml'),
    'model = "gpt-5.6-sol"\n\n[mcp_servers.alpha]\ncommand = "node"\n\n' +
      '[mcp_servers.beta.env]\nX = "1"\n\n[mcp_servers."odd name"]\ncommand = "node"\n'
  );
  const r = runExec(fx, [], { GIT_CONFIG_GLOBAL: globalCfg, CODEX_HOME: codexHome });
  const out = r.stdout || '';
  const head = out.split('\n')[0];
  check(
    'the engine sees the user\'s credential helper through the scratch config',
    field(out, 'GIT_CREDENTIAL_HELPER') === 'orchestra-test-helper',
    'GIT_CREDENTIAL_HELPER: ' + field(out, 'GIT_CREDENTIAL_HELPER')
  );
  check(
    'the engine sees the LFS clean filter (an LFS-tracked tree no longer reads as modified)',
    field(out, 'GIT_LFS_CLEAN') === 'git-lfs clean -- %f',
    'GIT_LFS_CLEAN: ' + field(out, 'GIT_LFS_CLEAN')
  );
  check(
    'identity still carries',
    field(out, 'GIT_USER_NAME') === 'Global Person',
    'GIT_USER_NAME: ' + field(out, 'GIT_USER_NAME')
  );
  check(
    'isolation is still on: the engine reads a scratch config, not the real one',
    field(out, 'GIT_CONFIG_GLOBAL') !== '(unset)' &&
      path.resolve(field(out, 'GIT_CONFIG_GLOBAL')) !== path.resolve(globalCfg),
    'GIT_CONFIG_GLOBAL: ' + field(out, 'GIT_CONFIG_GLOBAL')
  );
  const markers = field(out, 'BRIEF_MARKERS');
  check('the pre-existing dirty set reaches the brief', /TREE STATE BEFORE YOU STARTED/.test(markers), markers);
  check('harness-owned files are named as such', /harness-owned session files/.test(markers), markers);
  check('the credential caveat is part of the git rule', /may carry no GitHub credentials/.test(markers), markers);
  const overrides = field(out, 'CONFIG_OVERRIDES');
  check(
    'bare-named MCP servers are disabled by name, subsection-only declarations included',
    overrides.includes('mcp_servers.alpha.enabled=false') &&
      overrides.includes('mcp_servers.beta.enabled=false') &&
      overrides.includes('features.apps=false'),
    overrides
  );
  check('a quoted name is never addressed through -c (it would create a half-entry)', !/odd/.test(overrides), overrides);
  check(
    'the header states the MCP posture, including what could not be addressed',
    /mcp: stripped \(2 server\(s\) disabled, apps connector off, 1 not addressable\)/.test(head),
    head
  );
  check('the unaddressable name is reported in preflight', /"odd name"/.test(out), out.slice(0, 1500));

  // A project-level .codex/config.toml is named, never touched: Codex loads it
  // only for a trusted project, and disabling a server it has not loaded
  // would kill the run on config validation.
  fs.mkdirSync(path.join(fx.repo, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(fx.repo, '.codex', 'config.toml'), '[mcp_servers.proj]\ncommand = "node"\n');
  const p = runExec(fx, [], { CODEX_HOME: codexHome }).stdout || '';
  check(
    'a project-level MCP server is named in preflight and not disabled',
    /declares 1 MCP server\(s\) \(proj\)/.test(p) && !/mcp_servers\.proj/.test(field(p, 'CONFIG_OVERRIDES')),
    p.slice(0, 1500)
  );

  // inherit, from config and outranked by env.
  writeProjectConfig(fx, { codex: { engineMcp: 'inherit' } });
  const inh = runExec(fx, [], { CODEX_HOME: codexHome }).stdout || '';
  check(
    'engineMcp: inherit leaves the engine\'s MCP config alone',
    /mcp: inherited/.test(inh.split('\n')[0]) && !/features\.apps=false|mcp_servers\./.test(field(inh, 'CONFIG_OVERRIDES')),
    inh.split('\n')[0] + ' — ' + field(inh, 'CONFIG_OVERRIDES')
  );
  const env = runExec(fx, [], { CODEX_HOME: codexHome, ORCHESTRA_EXEC_MCP: 'strip' }).stdout || '';
  check('the env var outranks the config', /mcp: stripped/.test(env.split('\n')[0]), env.split('\n')[0]);

  // Astra's review of the first cut (2026-09-06): every other TOML shape a
  // server can be declared in went unseen and the header claimed a clean
  // strip. Each shape is a fixture now.
  writeProjectConfig(fx, { codex: {} });
  const shapes = [
    ['inline table', 'mcp_servers = { delta = { command = "node" }, "e f" = { url = "http://x" }, zeta.command = "y" }\n',
      ['delta', 'zeta'], ['e f']],
    ['[mcp_servers] table', 'x = 1\n[mcp_servers]\nclaude = { command = "node" }\ngamma.command = "node"\n[other]\nz = { a = 1 }\n',
      ['claude', 'gamma'], []],
    ['top-level dotted keys', 'mcp_servers.eps.command = "node"\nmcp_servers."q r".url = "http://x"\n',
      ['eps'], ['q r']],
    ['multi-line inline table', 'mcp_servers = {\n  multi = { command = "node" },\n  two = { command = "x" }\n}\n',
      ['multi', 'two'], []],
    // Astra, round 2: a quoted ROOT key is valid TOML too.
    ['a quoted root key', '["mcp_servers".rooted]\ncommand = "node"\n', ['rooted'], []],
    // Astra, round 2: a header inside a multi-line string is prose, not a
    // server — disabling it would create a transport-less half-entry.
    ['a real header beside a header quoted in a multi-line string',
      'developer_instructions = """\nExample:\n[mcp_servers.example]\ncommand = "x"\n"""\n[mcp_servers.genuine]\ncommand = "node"\n',
      ['genuine'], []],
    // Astra, round 3: `"plain"` decodes to the same key as `plain`, so it is
    // addressable; and a `"""` inside a comment opens no string.
    ['a quoted but bare-safe name', '[mcp_servers."plain"]\ncommand = "node"\n', ['plain'], []],
    ['a triple quote inside a comment', '[mcp_servers.first]\ncommand = "first" # """\n[mcp_servers.second]\ncommand = "node"\n',
      ['first', 'second'], []],
    // Astra, round 4: a `'''` inside an ordinary string is content, and a
    // basic-string key carries TOML escapes.
    ['a triple quote inside an ordinary string',
      '[mcp_servers.other]\ncommand = "x"\ndeveloper_instructions = "Use \'\'\' as the SQL example"\n[mcp_servers.claude]\ncommand = "node"\n',
      ['other', 'claude'], []],
    ['an escaped basic-string key', '[mcp_servers."clau\\u0064e"]\ncommand = "node"\n', ['claude'], []],
  ];
  for (const [label, toml, wantBare, wantQuoted] of shapes) {
    const h = path.join(fx.root, 'codex-home-' + wantBare[0]);
    fs.mkdirSync(h, { recursive: true });
    fs.writeFileSync(path.join(h, 'config.toml'), toml);
    const o = runExec(fx, [], { CODEX_HOME: h }).stdout || '';
    const ov = field(o, 'CONFIG_OVERRIDES');
    check(
      'servers declared as ' + label + ' are disabled by name',
      wantBare.every((n) => ov.includes('mcp_servers.' + n + '.enabled=false')) &&
        !/mcp_servers\.(command|url|env)\./.test(ov) &&
        new RegExp('mcp: stripped \\(' + wantBare.length + ' server\\(s\\) disabled').test(o.split('\n')[0]) &&
        wantQuoted.every((q) => o.includes(JSON.stringify(q))),
      o.split('\n')[0] + ' — ' + ov
    );
  }
  const quotedHome = path.join(fx.root, 'codex-home-genuine');
  const qo = runExec(fx, [], { CODEX_HOME: quotedHome }).stdout || '';
  check(
    'the header quoted inside the multi-line string was NOT turned into a server',
    !/mcp_servers\.example/.test(field(qo, 'CONFIG_OVERRIDES')) && /mcp: stripped \(1 server/.test(qo.split('\n')[0]),
    qo.split('\n')[0] + ' — ' + field(qo, 'CONFIG_OVERRIDES')
  );

  // Astra, round 2: an LFS filter value with a quoted Windows path was copied
  // bare into the scratch config — a "bad config line" that broke every
  // later git command. Quoted and escaped, it survives the round trip.
  const lfsCfg = path.join(fx.root, 'global-gitconfig-lfs');
  fs.writeFileSync(
    lfsCfg,
    '[filter "lfs"]\n\tclean = "\\"C:\\\\Program Files\\\\Git LFS\\\\git-lfs.exe\\" clean -- %f"\n' +
      '\tsmudge = git-lfs smudge -- %f\n'
  );
  const lq = runExec(fx, [], { GIT_CONFIG_GLOBAL: lfsCfg, CODEX_HOME: quotedHome }).stdout || '';
  check(
    'an LFS filter value with a quoted path survives the explicit copy (git still reads the scratch config)',
    field(lq, 'GIT_LFS_CLEAN') === '"C:\\Program Files\\Git LFS\\git-lfs.exe" clean -- %f' &&
      /^EXEC ENGINE: OpenAI/.test(lq),
    'GIT_LFS_CLEAN: ' + field(lq, 'GIT_LFS_CLEAN') + ' — ' + lq.split('\n')[0]
  );

  // Astra, round 3: an `[include]` of the user's global config made git exit
  // 128 when the sandbox could not open it. The config is COPIED now, and a
  // relative include inside it still resolves against the file it came from.
  const gdir = path.join(fx.root, 'gcopy');
  fs.mkdirSync(gdir, { recursive: true });
  fs.writeFileSync(path.join(gdir, 'extra.inc'), '[credential]\n\thelper = included-helper\n');
  // Astra, round 4: the value ends at the closing quote, and a trailing
  // comment is never folded into the path.
  fs.writeFileSync(path.join(gdir, 'gitconfig'), '[include]\n\tpath = "extra.inc" # shared credentials\n');
  const cp = runExec(fx, [], { GIT_CONFIG_GLOBAL: path.join(gdir, 'gitconfig'), CODEX_HOME: quotedHome }).stdout || '';
  const scratchCfg = field(cp, 'GIT_CONFIG_GLOBAL');
  check(
    'the global config is copied, and a quoted relative include with a trailing comment still resolves',
    field(cp, 'GIT_CREDENTIAL_HELPER') === 'included-helper' &&
      path.resolve(scratchCfg) !== path.resolve(path.join(gdir, 'gitconfig')),
    'GIT_CREDENTIAL_HELPER: ' + field(cp, 'GIT_CREDENTIAL_HELPER') + ' GIT_CONFIG_GLOBAL: ' + scratchCfg
  );
  // Astra, round 4: `[includeIf "gitdir:./x/"]` is relative to the config
  // file it sits in; copied elsewhere, the condition must be rebased too.
  // The global config sits in fx.root and the fixture repo is <root>/project.
  fs.writeFileSync(path.join(fx.root, 'cond.inc'), '[credential]\n\thelper = cond-helper\n');
  fs.writeFileSync(path.join(fx.root, 'gitconfig-cond'), '[includeIf "gitdir:./project/"]\n\tpath = cond.inc\n');
  const ci = runExec(fx, [], { GIT_CONFIG_GLOBAL: path.join(fx.root, 'gitconfig-cond'), CODEX_HOME: quotedHome }).stdout || '';
  check(
    'a relative includeIf gitdir condition is resolved by git for the copy',
    field(ci, 'GIT_CREDENTIAL_HELPER') === 'cond-helper',
    'GIT_CREDENTIAL_HELPER: ' + field(ci, 'GIT_CREDENTIAL_HELPER')
  );
  // Astra, round 6: a `hasconfig:remote.*.url:` condition needs the
  // repository's own remotes, which a `--global`-only query never sees. The
  // config is resolved across every scope in the engine's tree, and only the
  // system + global entries are carried.
  git(['remote', 'add', 'origin', 'https://example.com/team/repo.git'], fx.repo);
  fs.writeFileSync(path.join(fx.root, 'remote.inc'), '[credential]\n\thelper = remote-helper\n');
  fs.writeFileSync(
    path.join(fx.root, 'gitconfig-remote'),
    '[credential]\n\thelper = first\n[credential "https://x"]\n\thelper = ""\n[credential]\n\thelper = second\n' +
      '[includeIf "hasconfig:remote.*.url:https://example.com/**"]\n\tpath = remote.inc\n'
  );
  const hc = runExec(fx, [], { GIT_CONFIG_GLOBAL: path.join(fx.root, 'gitconfig-remote'), CODEX_HOME: quotedHome }).stdout || '';
  check(
    'a hasconfig:remote include resolves against the repository, and helper order survives the copy',
    field(hc, 'GIT_CREDENTIAL_HELPER') === 'remote-helper' &&
      // A system-scope helper (Git for Windows ships credential.helper = manager)
      // may legitimately precede these: the system entries are carried too.
      field(hc, 'GIT_CREDENTIAL_HELPERS').endsWith('first | second | remote-helper'),
    'GIT_CREDENTIAL_HELPER: ' + field(hc, 'GIT_CREDENTIAL_HELPER') + ' GIT_CREDENTIAL_HELPERS: ' + field(hc, 'GIT_CREDENTIAL_HELPERS')
  );
  git(['remote', 'remove', 'origin'], fx.repo);

  const opaqueHome = path.join(fx.root, 'codex-home-opaque');
  fs.mkdirSync(opaqueHome, { recursive: true });
  fs.writeFileSync(path.join(opaqueHome, 'config.toml'), '[mcp_servers]\n# nothing this reader understands\n= broken\n');
  const op = runExec(fx, [], { CODEX_HOME: opaqueHome }).stdout || '';
  check(
    'a config that mentions mcp_servers in an unreadable shape is reported, not claimed clean',
    /mcp: stripped \(0 server\(s\) disabled/.test(op.split('\n')[0]) && /could not read/.test(op),
    op.slice(0, 1200)
  );
  check(
    'without `codex mcp list --json` the runner says the names came from its own TOML reader',
    /own TOML reader/.test(op),
    op.slice(0, 1200)
  );

  // The authority is Codex itself: `codex mcp list --json` names every server
  // it loaded, decoded, with its enabled state. Enabled ones are disabled by
  // name; an already-disabled one is left alone; a name that needs quoting is
  // still unaddressable; and the TOML reader is not consulted at all.
  const live = runExec(fx, [], {
    CODEX_HOME: opaqueHome,
    STUB_CODEX_MCP_JSON: '[{"name":"live_one","enabled":true},{"name":"off","enabled":false},{"name":"odd name","enabled":true}]',
  }).stdout || '';
  const lov = field(live, 'CONFIG_OVERRIDES');
  check(
    'server names come from `codex mcp list --json` when Codex answers, already-disabled ones included',
    lov.includes('mcp_servers.live_one.enabled=false') && lov.includes('mcp_servers.off.enabled=false') &&
      /mcp: stripped \(2 server\(s\) disabled, apps connector off, 1 not addressable\)/.test(live.split('\n')[0]) &&
      !/own TOML reader/.test(live) && !/could not read/.test(live),
    live.split('\n')[0] + ' — ' + lov
  );
  // Astra, round 5: a user extra arg re-enabling a server the runner had
  // skipped as "already disabled" reached the engine unopposed. Every known
  // server gets its override, and ours come last.
  const hostileMcp = runExec(fx, [], {
    CODEX_HOME: opaqueHome,
    STUB_CODEX_MCP_JSON: '[{"name":"off","enabled":false}]',
    ORCHESTRA_EXEC_ARGS: '-c mcp_servers.off.enabled=true',
  }).stdout || '';
  const hov = field(hostileMcp, 'CONFIG_OVERRIDES').split(' | ');
  check(
    'a user extra arg cannot re-enable a server: the disabling override comes after it',
    hov.lastIndexOf('mcp_servers.off.enabled=false') > hov.indexOf('mcp_servers.off.enabled=true'),
    hov.join(' | ')
  );

  // Astra, same review: git resolves its global config from HOME first, and
  // os.homedir() on Windows is USERPROFILE — with the two apart, the include
  // pointed at the wrong file and the credential helper was gone again.
  const homeDir = path.join(fx.root, 'home');
  const profileDir = path.join(fx.root, 'profile');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(homeDir, '.gitconfig'), '[credential]\n\thelper = home-test-helper\n');
  fs.writeFileSync(path.join(profileDir, '.gitconfig'), '[credential]\n\thelper = profile-helper\n');
  const hp = runExec(fx, [], { HOME: homeDir, USERPROFILE: profileDir }).stdout || '';
  check(
    'the include follows git\'s own precedence: HOME before USERPROFILE',
    field(hp, 'GIT_CREDENTIAL_HELPER') === 'home-test-helper',
    'GIT_CREDENTIAL_HELPER: ' + field(hp, 'GIT_CREDENTIAL_HELPER')
  );
}

// 22. FIX (field, 2026-09-07): WO-7A round 1 — the engine's CHANGES section
//     named a `git checkout -B` (a ref/branch op, no file edit) in an
//     otherwise valid BLOCKED report, and the report/audit contradiction
//     check (case 16) discarded the whole report over it. A claim whose head
//     names no file must never be held against the tree audit, and the audit
//     now measures the branch alongside HEAD so a checkout that only moves
//     the branch reads as a measured change, not "nothing happened".
function case22() {
  section('22. Ref/branch claims are not edits; the audit measures the branch too');

  // The field shape exactly: a branch/ref claim, nothing else, tree untouched.
  const fx = makeRepo();
  const branchOnly = runExec(fx, [], {
    STUB_CODEX_CLAIM_CHANGES: 'Created branch `wo7a` at HEAD daf549ba',
  });
  const bOut = branchOnly.stdout || '';
  check(
    'a branch/ref claim alone is relayed, not discarded as a contradiction',
    /STATUS: DONE/.test(bOut) &&
      !/EXEC_UNAVAILABLE/.test(bOut) &&
      /REPORT INTEGRITY: verified/.test(bOut),
    bOut.slice(0, 500)
  );

  // Same claim, but the status is BLOCKED — the actual field shape, where
  // discarding the report also discarded the real finding.
  const fx2 = makeRepo();
  const branchBlocked = runExec(fx2, [], {
    STUB_CODEX_FIRST_LINE: 'STATUS: BLOCKED',
    STUB_CODEX_CLAIM_CHANGES: 'Created branch `wo7a` at HEAD daf549ba',
  });
  const bbOut = branchBlocked.stdout || '';
  check(
    'a BLOCKED report with only a branch claim is relayed intact',
    /STATUS: BLOCKED/.test(bbOut) &&
      !/EXEC_UNAVAILABLE/.test(bbOut) &&
      /REPORT INTEGRITY: verified/.test(bbOut),
    bbOut.slice(0, 500)
  );

  // A mix: one branch line (no evidence of an edit) plus one real path-shaped
  // claim, tree still untouched. The contradiction must still fire — but the
  // failure text names only the path claim, never the branch line.
  const fx3 = makeRepo();
  const mixed = runExec(fx3, [], {
    STUB_CODEX_CLAIM_CHANGES:
      'Created branch `wo7a` at HEAD daf549ba,src/app.js:12 — added a flag',
  });
  const mOut = mixed.stdout || '';
  const mFailureText = mOut.split('--- UNVERIFIED ENGINE OUTPUT')[0];
  check(
    'a mix of a branch line and a real path claim against an untouched tree still fails',
    /STATUS: EXEC_UNAVAILABLE/.test(mOut) &&
      /claims edits the runner measured as never happening/.test(mOut),
    mOut.slice(0, 700)
  );
  check(
    'the failure text names the path claim',
    /src\/app\.js:12/.test(mFailureText),
    mFailureText.slice(0, 1200)
  );
  check(
    'the failure text does not hold the branch line against the audit',
    !/Created branch/.test(mFailureText),
    mFailureText.slice(0, 1200)
  );

  // The stub actually creates a branch (`git checkout -B`, no file edits),
  // claiming only the branch line: relayed, and the TREE AUDIT names the
  // branch change (same commit, different branch — HEAD alone would miss it).
  const fx4 = makeRepo();
  const realBranch = runExec(fx4, [], {
    STUB_CODEX_BRANCH: 'wo7a',
    STUB_CODEX_CLAIM_CHANGES: 'Created branch `wo7a` — checked out at the same commit',
  });
  const rOut = realBranch.stdout || '';
  check(
    'a real branch-only change (no file edits) is relayed as a verified report',
    /STATUS: DONE/.test(rOut) && /REPORT INTEGRITY: verified/.test(rOut),
    rOut.slice(0, 500)
  );
  check(
    'the TREE AUDIT names the branch change',
    /branch: main → wo7a/.test(rOut),
    rOut.slice(0, 1500)
  );

  // Case 16's assertions must still pass unchanged: path-shaped claims are
  // still held against the audit exactly as before.
  const fx5 = makeRepo();
  const lie = runExec(fx5, [], {
    STUB_CODEX_CLAIM_CHANGES: 'src/app.js:12 — added a flag,src/other.js — new helper',
  });
  const lout = lie.stdout || '';
  check(
    'case 16 unaffected: claiming path-shaped edits against an untouched tree is still EXEC_UNAVAILABLE',
    /STATUS: EXEC_UNAVAILABLE/.test(lout) &&
      /claims edits the runner measured as never happening/.test(lout),
    lout.slice(0, 700)
  );

  // FIX (Sol review, 2026-09-07), finding 1: a claim head with no separator
  // is prose, not a path, even when the prose contains a `/` (from the
  // branch name it names). Against an untouched tree, this must be relayed.
  const fx6 = makeRepo();
  const proseHead = runExec(fx6, [], {
    STUB_CODEX_CLAIM_CHANGES: 'Created branch `feature/foo` at HEAD deadbeef',
  });
  const pOut = proseHead.stdout || '';
  check(
    'a whitespace-prose claim head naming a branch (with a slash inside it) is relayed, not misread as a path',
    /STATUS: DONE/.test(pOut) &&
      !/EXEC_UNAVAILABLE/.test(pOut) &&
      /REPORT INTEGRITY: verified/.test(pOut),
    pOut.slice(0, 500)
  );

  // FIX (Sol review, 2026-09-07), finding 1(c): a single-token head that IS
  // path-shaped by the separator rule (`feature/foo` contains `/`) but names
  // a ref the run actually created — WITHOUT checking it out, so HEAD and
  // branch both stay put and only the ref-exclusion can save the report.
  const fx7 = makeRepo();
  const refHead = runExec(fx7, [], {
    STUB_CODEX_BRANCH_NO_CHECKOUT: 'feature/foo',
    STUB_CODEX_CLAIM_CHANGES: '`feature/foo` — created branch',
  });
  const rhOut = refHead.stdout || '';
  check(
    'a single-token claim head that names a real (uncheckedout) branch is excluded via the ref set, not treated as a path',
    /STATUS: DONE/.test(rhOut) &&
      !/EXEC_UNAVAILABLE/.test(rhOut) &&
      /REPORT INTEGRITY: verified/.test(rhOut),
    rhOut.slice(0, 500)
  );

  // FIX (Sol review, 2026-09-07), finding 1(b): a version-like tag head must
  // not be misclassified as a path extension (the digit-only ".3" of
  // "v1.2.3" has no letter). The stub also creates the tag for real, so the
  // ref-exclusion path is exercised too.
  const fx8 = makeRepo();
  const tagHead = runExec(fx8, [], {
    STUB_CODEX_TAG: 'v1.2.3',
    STUB_CODEX_CLAIM_CHANGES: 'v1.2.3 — created tag',
  });
  const tOut = tagHead.stdout || '';
  check(
    'a version-like tag claim head is relayed, not misread as a file extension',
    /STATUS: DONE/.test(tOut) &&
      !/EXEC_UNAVAILABLE/.test(tOut) &&
      /REPORT INTEGRITY: verified/.test(tOut),
    tOut.slice(0, 500)
  );

  // Re-assert case 16's shape with the ref set populated (a real branch
  // exists), so the ref-exclusion cannot go blind and swallow a genuine
  // path-shaped claim just because refs happen to be present this run.
  const fx9 = makeRepo();
  const realPathStillLies = runExec(fx9, [], {
    STUB_CODEX_BRANCH_NO_CHECKOUT: 'some-ref',
    STUB_CODEX_CLAIM_CHANGES: 'src/app.js:12 — added a flag',
  });
  const rplOut = realPathStillLies.stdout || '';
  check(
    'a real path-shaped claim against an untouched tree is still EXEC_UNAVAILABLE even when a ref set is present',
    /STATUS: EXEC_UNAVAILABLE/.test(rplOut) &&
      /claims edits the runner measured as never happening/.test(rplOut),
    rplOut.slice(0, 700)
  );

  // FIX (Sol review, 2026-09-07), finding 2: a real branch move (measured
  // change) alongside an UNPROVEN path claim — no file was actually edited.
  // The branch move alone disables the untouched-tree contradiction, exactly
  // as HEAD moving would; this pins the `before.branch === after.branch`
  // clause in treeUntouched (removing it makes this EXEC_UNAVAILABLE).
  const fx10 = makeRepo();
  const branchMoveWithFalsePathClaim = runExec(fx10, [], {
    STUB_CODEX_BRANCH: 'wo7a',
    STUB_CODEX_CLAIM_CHANGES: 'src/app.js:12 — added a flag',
  });
  const bmOut = branchMoveWithFalsePathClaim.stdout || '';
  check(
    'a real branch move relays the report even though the accompanying path claim was never made real (branch-equality clause pin)',
    /STATUS: DONE/.test(bmOut) &&
      !/EXEC_UNAVAILABLE/.test(bmOut) &&
      /REPORT INTEGRITY: verified/.test(bmOut),
    bmOut.slice(0, 500)
  );
  check(
    'the TREE AUDIT names the branch move in the pin scenario',
    /branch: main → wo7a/.test(bmOut),
    bmOut.slice(0, 1500)
  );

  // FIX (Sol review round 2, 2026-09-07): refNames() read only the SHORT ref
  // name, so a CHANGES claim naming the FULL ref (`refs/heads/feature/foo`,
  // as a run reporting on a branch it created might) matched nothing in the
  // exclusion set — isPathShaped counts it path-shaped on its embedded `/`,
  // and a genuinely valid report was rejected as contradicting an untouched
  // tree. Same fixture shape as fx7 (branch created, never checked out), but
  // the claim spells the ref in full.
  const fx11 = makeRepo();
  const fullRefHead = runExec(fx11, [], {
    STUB_CODEX_BRANCH_NO_CHECKOUT: 'feature/foo',
    STUB_CODEX_CLAIM_CHANGES: 'refs/heads/feature/foo — created',
  });
  const frOut = fullRefHead.stdout || '';
  check(
    'a full ref name (refs/heads/<branch>) claim head is excluded via the ref set, not treated as a path',
    /STATUS: DONE/.test(frOut) &&
      !/EXEC_UNAVAILABLE/.test(frOut) &&
      /REPORT INTEGRITY: verified/.test(frOut),
    frOut.slice(0, 500)
  );

  // FIX (Sol review round 3, 2026-09-07), finding 2(a): `refname:short` drops
  // the trailing `/HEAD` off a remote-tracking HEAD, so
  // `refs/remotes/origin/HEAD` shortens to `origin` — the conventional
  // `origin/HEAD` spelling a claim would actually use matched neither the
  // full nor the short form. `refname:lstrip=2` (added to refNames' format)
  // yields `origin/HEAD` too, so this must now be excluded and relayed.
  const fx12 = makeRepo();
  git(['remote', 'add', 'origin', fx12.repo], fx12.repo);
  git(['update-ref', 'refs/remotes/origin/HEAD', 'HEAD'], fx12.repo);
  const originHead = runExec(fx12, [], {
    STUB_CODEX_CLAIM_CHANGES: 'origin/HEAD — updated',
  });
  const ohOut = originHead.stdout || '';
  check(
    'an origin/HEAD claim head is excluded via the lstrip=2 ref spelling, not treated as a path',
    /STATUS: DONE/.test(ohOut) &&
      !/EXEC_UNAVAILABLE/.test(ohOut) &&
      /REPORT INTEGRITY: verified/.test(ohOut),
    ohOut.slice(0, 500)
  );

  // FIX (Sol review round 3, 2026-09-07), finding 2(b): a head that STARTS
  // WITH `refs/` is a ref by construction — that namespace prefix is git's
  // own, never a real repo-relative file path — so it is excluded even when
  // the ref never actually exists (nothing in refNames' set names it). No
  // tag `v9` is created here at all; only the `refs/` prefix rule can save
  // this report.
  const fx13 = makeRepo();
  const nonexistentTagRef = runExec(fx13, [], {
    STUB_CODEX_CLAIM_CHANGES: 'refs/tags/v9 — created',
  });
  const ntOut = nonexistentTagRef.stdout || '';
  check(
    'a refs/tags/<name> claim head is excluded on its refs/ prefix alone, even when that ref does not exist',
    /STATUS: DONE/.test(ntOut) &&
      !/EXEC_UNAVAILABLE/.test(ntOut) &&
      /REPORT INTEGRITY: verified/.test(ntOut),
    ntOut.slice(0, 500)
  );

  // The refs/ prefix rule must not swallow a genuine path claim: with a real
  // origin/HEAD ref present (same fixture shape as fx12), a false path claim
  // against an untouched tree is still EXEC_UNAVAILABLE.
  const fx14 = makeRepo();
  git(['remote', 'add', 'origin', fx14.repo], fx14.repo);
  git(['update-ref', 'refs/remotes/origin/HEAD', 'HEAD'], fx14.repo);
  const stillLiesWithRemote = runExec(fx14, [], {
    STUB_CODEX_CLAIM_CHANGES: 'src/app.js:12 — added a flag',
  });
  const slwrOut = stillLiesWithRemote.stdout || '';
  check(
    'a real path-shaped claim against an untouched tree is still EXEC_UNAVAILABLE when a remote-tracking HEAD ref is present',
    /STATUS: EXEC_UNAVAILABLE/.test(slwrOut) &&
      /claims edits the runner measured as never happening/.test(slwrOut),
    slwrOut.slice(0, 700)
  );
}

function case23() {
  section('23. restoreHelpers() does not copy a helpersDir entry the install\'s manifest already carries');

  // FIX (field, 2026-09-07): mirrors review-lane case 22's manifest
  // sub-fixture. A stale helpersDir kit must never re-inject a helper name —
  // or the codex-resources\ directory itself — that the install's own
  // codex-package.json already declares a resources directory for; a size
  // difference against helpersDir is not a reason to prefer the older kit.
  // This runner (orchestra-exec.js) is the one the 2026-09-07 15:48 field
  // failure actually happened in: a stale helpersDir kit copied its whole
  // contents, codex-resources\ subtree included, into a live install's bin\.
  const fx = makeRepo();
  const release = path.join(fx.root, 'release');
  const installDir = path.join(release, 'bin');
  const bin = makeStubBin(installDir, 'codex-stub');
  fs.writeFileSync(
    path.join(release, 'codex-package.json'),
    JSON.stringify({ layoutVersion: 1, resourcesDir: 'codex-resources' }) + '\n'
  );
  const resources = path.join(release, 'codex-resources');
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(path.join(resources, 'codex-command-runner.exe'), 'MZ current\n');
  fs.writeFileSync(path.join(resources, 'codex-windows-sandbox-setup.exe'), 'MZ current\n');

  // The stale kit: both helper names (a version skew if copied in), a
  // codex-resources\ subtree of junk (must never be walked into or copied —
  // the declared resources directory IS codex-resources, whole), and one
  // genuinely new file the manifest carries nowhere.
  const helpersDir = path.join(fx.root, 'helpers-kit-manifest');
  fs.mkdirSync(helpersDir, { recursive: true });
  fs.writeFileSync(path.join(helpersDir, 'codex-command-runner.exe'), 'MZ STALE-0147-ERA\n');
  fs.writeFileSync(path.join(helpersDir, 'codex-windows-sandbox-setup.exe'), 'MZ STALE-0147-ERA\n');
  const helpersResources = path.join(helpersDir, 'codex-resources');
  fs.mkdirSync(helpersResources, { recursive: true });
  fs.writeFileSync(path.join(helpersResources, 'junk.txt'), 'junk\n');
  fs.writeFileSync(path.join(helpersDir, 'known-good-extra.txt'), 'genuinely new\n');
  writeProjectConfig(fx, { codex: { helpersDir } });

  const r = runExec(fx, [], { CODEX_BIN: bin });
  const out = r.stdout || '';
  check(
    'the exec runner does not copy the manifest-carried helper names or directory into the install',
    !fs.existsSync(path.join(installDir, 'codex-command-runner.exe')) &&
      !fs.existsSync(path.join(installDir, 'codex-windows-sandbox-setup.exe')) &&
      !fs.existsSync(path.join(installDir, 'codex-resources')),
    fs.readdirSync(installDir).join(', ')
  );
  check(
    'the exec runner still copies the genuinely new helpersDir file',
    fs.existsSync(path.join(installDir, 'known-good-extra.txt')),
    fs.readdirSync(installDir).join(', ')
  );
  check(
    'the PREFLIGHT names all three manifest-carried entries as not copied',
    /PREFLIGHT: helpersDir: 3 entries not copied/.test(out) &&
      /codex-command-runner\.exe/.test(out) &&
      /codex-windows-sandbox-setup\.exe/.test(out) &&
      /codex-resources/.test(out) &&
      /declared resources directory/.test(out),
    (out.match(/^PREFLIGHT:.*$/gm) || []).join(' | ')
  );

  // FIX (Sol review round 2, 2026-09-07): the declared-name compare
  // (carriedByPackage/sameName) was case-sensitive, so a helpersDir entry
  // spelled in a different case than the manifest's declared name went
  // unmatched on Windows and was reinjected — exactly the stale-kit route
  // this whole check exists to close. A separate fixture, spelled ONLY in the
  // differing case, is required: on Windows `codex-resources` and
  // `CODEX-RESOURCES` are the SAME directory entry (case-preserving, not
  // case-sensitive), so this cannot be exercised by adding to the fixture
  // above without colliding with it.
  const fxCase = makeRepo();
  const releaseCase = path.join(fxCase.root, 'release');
  const installDirCase = path.join(releaseCase, 'bin');
  const binCase = makeStubBin(installDirCase, 'codex-stub');
  fs.writeFileSync(
    path.join(releaseCase, 'codex-package.json'),
    JSON.stringify({ layoutVersion: 1, resourcesDir: 'codex-resources' }) + '\n'
  );
  const resourcesCase = path.join(releaseCase, 'codex-resources');
  fs.mkdirSync(resourcesCase, { recursive: true });
  fs.writeFileSync(path.join(resourcesCase, 'codex-command-runner.exe'), 'MZ current\n');

  const helpersDirCase = path.join(fxCase.root, 'helpers-kit-case');
  fs.mkdirSync(helpersDirCase, { recursive: true });
  // A directory entry spelled in a different case than the declared
  // `codex-resources`, and a file entry spelled in a different case than the
  // packaged `codex-command-runner.exe`.
  const helpersResourcesCaseDir = path.join(helpersDirCase, 'CODEX-RESOURCES');
  fs.mkdirSync(helpersResourcesCaseDir, { recursive: true });
  fs.writeFileSync(path.join(helpersResourcesCaseDir, 'junk.txt'), 'junk\n');
  fs.writeFileSync(path.join(helpersDirCase, 'CODEX-COMMAND-RUNNER.EXE'), 'MZ STALE-CASE\n');
  writeProjectConfig(fxCase, { codex: { helpersDir: helpersDirCase } });

  const rCase = runExec(fxCase, [], { CODEX_BIN: binCase });
  const outCase = rCase.stdout || '';
  // On Windows this must fold case and skip both entries, same as the exact-
  // case fixture above. POSIX filesystems are case-sensitive, so
  // `CODEX-RESOURCES`/`CODEX-COMMAND-RUNNER.EXE` are genuinely distinct names
  // there and the compare does not apply — nothing to assert on that
  // platform beyond "the runner didn't crash".
  check(
    'on Windows, a helpersDir entry spelled in a different case than the manifest declares is still recognised as carried and skipped',
    process.platform === 'win32'
      ? !fs.existsSync(path.join(installDirCase, 'CODEX-RESOURCES')) &&
        !fs.existsSync(path.join(installDirCase, 'CODEX-COMMAND-RUNNER.EXE')) &&
        /PREFLIGHT: helpersDir: 2 entries not copied/.test(outCase) &&
        /CODEX-RESOURCES/.test(outCase) &&
        /CODEX-COMMAND-RUNNER\.EXE/.test(outCase)
      : true,
    process.platform === 'win32'
      ? (outCase.match(/^PREFLIGHT:.*$/gm) || []).join(' | ')
      : '(skipped — case folding is Windows-only; not applicable on ' + process.platform + ')'
  );
}

function finish() {
  for (const c of cleanups) {
    try {
      c();
    } catch (_) {
      /* best effort */
    }
  }
  console.log('\n' + (failures ? 'FAILED' : 'OK') + ' — ' + passes + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
}

async function main() {
  case1();
  case2();
  case4();
  case5();
  case6();
  case7();
  case8();
  case9();
  case10();
  case11();
  case12();
  case13();
  case14();
  case15();
  case16();
  case17();
  case18();
  case19();
  case20();
  case21();
  case22();
  case23();
}

main().then(finish, (e) => {
  check('the suite ran to completion', false, (e && e.stack) || e);
  finish();
});
