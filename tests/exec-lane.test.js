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
  section('1. Standard tier: defaults, attribution, and the relayed report');
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
    'standard tier defaults to the Terra model',
    field(out, 'MODEL') === 'gpt-5.6-terra' && /model: gpt-5\.6-terra \(default\)/.test(out),
    'MODEL: ' + field(out, 'MODEL') + ' — ' + out.split('\n')[0]
  );
  check(
    'standard tier passes no reasoning-effort override',
    field(out, 'CONFIG_OVERRIDES') === '(none)',
    'CONFIG_OVERRIDES: ' + field(out, 'CONFIG_OVERRIDES')
  );
  check(
    'the sandbox is workspace-write (an executor must write)',
    field(out, 'SANDBOX') === 'workspace-write',
    'SANDBOX: ' + field(out, 'SANDBOX')
  );
  check('the header names the tier', /tier: standard/.test(out.split('\n')[0]), out.split('\n')[0]);
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
  section('2. Heavy tier: Sol, high effort, declared in the header');
  const fx = makeRepo();
  const r = runExec(fx, ['--tier', 'heavy']);
  const out = r.stdout || '';
  check(
    'heavy tier defaults to the Sol model',
    field(out, 'MODEL') === 'gpt-5.6-sol' && /model: gpt-5\.6-sol \(default\)/.test(out),
    'MODEL: ' + field(out, 'MODEL')
  );
  check(
    'heavy tier pins high reasoning effort as a config value, not prose',
    field(out, 'CONFIG_OVERRIDES') === 'model_reasoning_effort=high',
    'CONFIG_OVERRIDES: ' + field(out, 'CONFIG_OVERRIDES')
  );
  check('the header names the tier', /tier: heavy/.test(out.split('\n')[0]) &&
    /effort: high/.test(out.split('\n')[0]), out.split('\n')[0]);

  // A typo'd tier value must fall to the SAFE tier, not the expensive one.
  const typo = runExec(fx, ['--tier', 'heayv']);
  check(
    'an unrecognised tier value runs standard, not heavy',
    /tier: standard/.test((typo.stdout || '').split('\n')[0]),
    (typo.stdout || '').split('\n')[0]
  );
}

function case3() {
  section('3. Settings resolve flag > env > orchestra.json > default, and say so');
  const fx = makeRepo();
  writeProjectConfig(fx, {
    codex: { execModel: 'gpt-5.6-luna', execTimeoutMs: 1234567 },
  });
  const cfg = runExec(fx, []);
  check(
    'orchestra.json supplies the model and is credited',
    field(cfg.stdout || '', 'MODEL') === 'gpt-5.6-luna' &&
      /model: gpt-5\.6-luna \(orchestra\.json\)/.test(cfg.stdout || ''),
    (cfg.stdout || '').split('\n')[0]
  );
  check(
    'orchestra.json supplies the timeout and is credited',
    /timeout: 1234567ms \(orchestra\.json\)/.test(cfg.stdout || ''),
    (cfg.stdout || '').split('\n')[0]
  );

  const env = runExec(fx, [], { ORCHESTRA_EXEC_MODEL: 'gpt-5.6-env' });
  check(
    'the environment outranks orchestra.json',
    field(env.stdout || '', 'MODEL') === 'gpt-5.6-env' &&
      /model: gpt-5\.6-env \(env\)/.test(env.stdout || ''),
    (env.stdout || '').split('\n')[0]
  );

  const flag = runExec(fx, ['--model', 'gpt-5.6-flag'], { ORCHESTRA_EXEC_MODEL: 'gpt-5.6-env' });
  check(
    'a flag outranks everything',
    field(flag.stdout || '', 'MODEL') === 'gpt-5.6-flag' &&
      /model: gpt-5\.6-flag \(flag\)/.test(flag.stdout || ''),
    (flag.stdout || '').split('\n')[0]
  );

  // The heavy tier reads its OWN keys, not the standard tier's.
  const fx2 = makeRepo();
  writeProjectConfig(fx2, { codex: { execModel: 'gpt-5.6-luna', execHeavyModel: 'gpt-5.6-sol-pinned' } });
  const heavy = runExec(fx2, ['--tier', 'heavy']);
  check(
    'heavy tier resolves execHeavyModel, not execModel',
    field(heavy.stdout || '', 'MODEL') === 'gpt-5.6-sol-pinned',
    'MODEL: ' + field(heavy.stdout || '', 'MODEL')
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
  const fx = makeRepo();
  const installDir = path.join(fx.root, 'OpenAI', 'Codex', 'bin', 'abc123');
  const fakeBin = makeStubBin(installDir, 'codex-stub');
  const r = runExec(fx, [], { CODEX_BIN: fakeBin });
  const out = r.stdout || '';
  const first = field(out, 'PATH_FIRST');
  const same = (a, b) =>
    process.platform === 'win32'
      ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
      : path.resolve(a) === path.resolve(b);
  check(
    'the resolved install directory is FIRST on the engine\'s PATH',
    first && same(first, installDir),
    'PATH_FIRST: ' + first + '\ninstall dir: ' + installDir
  );

  // ...and it is not added twice when it is already leading — a PATH that
  // grows by one copy of the same directory per run is its own bug.
  const already = runExec(fx, [], {
    CODEX_BIN: fakeBin,
    PATH: installDir + path.delimiter + (process.env.PATH || ''),
    Path: installDir + path.delimiter + (process.env.PATH || ''),
  });
  const aout = already.stdout || '';
  const parts = (field(aout, 'PATH_FULL') || '').split(path.delimiter).filter(Boolean);
  const dupes = parts.filter((p) => {
    try {
      return same(p, installDir);
    } catch (_) {
      return false;
    }
  });
  check(
    'an install directory already on PATH is not prepended a second time',
    dupes.length === 1,
    'occurrences: ' + dupes.length + ' in ' + parts.slice(0, 4).join(path.delimiter)
  );
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
  case3();
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
}

main().then(finish, (e) => {
  check('the suite ran to completion', false, (e && e.stack) || e);
  finish();
});
