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
  return spawnSync(process.execPath, args, {
    cwd: (opts && opts.cwd) || fx.repo,
    encoding: 'utf8',
    timeout: 120000,
    env: Object.assign(
      {},
      process.env,
      {
        CLAUDE_PROJECT_DIR: fx.repo,
        CODEX_BIN: STUB_BIN,
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
    field(out, 'CONFIG_OVERRIDES') === 'model_reasoning_effort=high | features.hooks=false | project_doc_max_bytes=0' &&
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
    hostileOverrides.slice(-2).join(' | ') === 'features.hooks=false | project_doc_max_bytes=0',
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
    field(effortCfg.stdout || '', 'CONFIG_OVERRIDES') === 'model_reasoning_effort=medium | features.hooks=false | project_doc_max_bytes=0' &&
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
    STUB_CODEX_STDERR: 'codex: stream closed unexpectedly',
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

// ------------------------------------------------------------------ driver

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
}

main().then(finish, (e) => {
  check('the suite ran to completion', false, (e && e.stack) || e);
  finish();
});
