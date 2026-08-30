#!/usr/bin/env node
/**
 * Review-lane tests for packs/codex/hooks/orchestra-review.js.
 *
 *   node tests/review-lane.test.js
 *
 * No dependencies, no test framework — plain node and git, so it runs anywhere
 * the runner itself runs. The real Codex CLI is replaced by
 * tests/fixtures/stub-codex.js, which reports what the engine SAW rather than
 * reviewing anything; every assertion below is about the state the engine was
 * handed, which is exactly the thing the 2026-08-11 field failure got wrong.
 *
 * A checker that cannot fail is decoration, so each fix is tested twice: once
 * showing the failure mode is reproducible, once showing the fix removes it.
 *
 * ------------------------------------------------------------- EXIT STATUS
 *
 * This file used to exit 0 on Windows even with failing cases, because the
 * verdict was printed by a callback deep inside an async chain: if anything
 * before it threw, rejected, or simply never fired, node drained its event loop
 * and exited 0 — a green run that proved nothing. A test suite that can report
 * success without having run is worse than no suite, so the exit code is now
 * pinned three ways: every case runs in one linear `await` chain, an `exit`
 * handler forces a non-zero code whenever a failure was recorded, and a suite
 * that recorded NO cases at all fails on that basis alone.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
// Defaults to the master copy. Point ORCHESTRA_TEST_RUNNER at a project's
// installed .claude/hooks/orchestra-review.js to check what actually shipped —
// the master is what we edit, but the stamped copy is what reviews run on.
const RUNNER =
  process.env.ORCHESTRA_TEST_RUNNER ||
  path.join(MASTER, 'packs', 'codex', 'hooks', 'orchestra-review.js');
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

// The suite's verdict must not depend on reaching the end of the suite. These
// three handlers are what make a crashed, hung-then-killed, or half-run
// execution report as the failure it is.
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

// A repository shaped like the one the field failure happened in: a small
// committed change under review, and a session that kept working afterwards —
// ~30 untracked plan files and a modified tracked file sitting on top of the
// commit the reviewer was told to review.
function makeDirtyRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-test-'));
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
  fs.writeFileSync(path.join(repo, 'NOTES.md'), '# notes\n\nThe change under review.\n');
  git(['add', '-A'], repo);
  git(['commit', '-qm', 'reformat add() and add notes'], repo);
  const head = git(['rev-parse', 'HEAD'], repo);

  // ...and then the session kept going.
  fs.mkdirSync(path.join(repo, '.claude', 'plans'), { recursive: true });
  for (let i = 0; i < 30; i++) {
    fs.writeFileSync(path.join(repo, '.claude', 'plans', 'plan-' + i + '.md'), '# plan ' + i + '\n');
  }
  fs.writeFileSync(
    path.join(repo, '.claude', 'plans', 'toon-conversion-campaign.md'),
    '# toon conversion campaign\n'
  );
  fs.writeFileSync(path.join(repo, 'app.js'), 'function add(a, b) {\n  return a + b; // later\n}\n');

  const wo = path.join(root, 'work-order.txt');
  const er = path.join(root, 'executor-report.txt');
  fs.writeFileSync(wo, 'Reformat add() and add NOTES.md. Base is ' + base + '.\n');
  fs.writeFileSync(er, 'Done; committed as ' + head + '. Two files, nine lines.\n');

  return { root, repo, base, head, wo, er };
}

// Project config the runner reads. Written into the fixture repo, so the tests
// exercise the same resolution path a real project does.
function writeProjectConfig(fx, codexCfg) {
  const dir = path.join(fx.repo, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'orchestra.json'), JSON.stringify({ codex: codexCfg }, null, 2));
}

function runReview(fx, extraArgs, extraEnv, opts) {
  const args = [RUNNER, '--work-order', fx.wo, '--executor-report', fx.er].concat(extraArgs || []);
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
        ORCHESTRA_REVIEW_IDLE_MS: '0',
        ORCHESTRA_REVIEW_MODEL: 'gpt-5.6-sol',
        // Expect no helper siblings unless a case says otherwise, so the same
        // assertions hold on Windows (where the default list is non-empty) as
        // everywhere else. Case 15 sets this explicitly and tests the machinery.
        ORCHESTRA_CODEX_HELPER_SIBLINGS: '',
        STUB_CODEX_PROBE_PATH: '.claude/plans/toon-conversion-campaign.md',
      },
      extraEnv || {}
    ),
  });
}

function field(out, name) {
  const m = new RegExp('^' + name + ': (.*)$', 'm').exec(out);
  return m ? m[1].trim() : '';
}

function worktreeLines(repo) {
  return git(['worktree', 'list'], repo)
    .split('\n')
    .filter((l) => l.trim());
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Wait for git's registration LOCK to clear on every non-main worktree —
// polling the actual condition, never a fixed duration (R0-EX8: a slow
// checkout can stay locked long past any sleep; killing while locked
// freezes a worktree single-`--force` can never reclaim). `git worktree
// add` holds the lock for the whole checkout while the entry is already
// list-visible, so list-visibility alone is not "finished registering".
async function waitWorktreesUnlocked(repo, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 30000);
  for (;;) {
    const blocks = git(['worktree', 'list', '--porcelain'], repo).split(/\n\n+/);
    const lockedLinked = blocks.slice(1).some((b) => /^locked/m.test(b));
    if (!lockedLinked) return true;
    if (Date.now() > deadline) return false;
    await sleep(100);
  }
}

// The runner spawns the engine binary DIRECTLY — no shell, deliberately, since
// a shell would change quoting and argument handling. Windows cannot
// CreateProcess a `.js` file, so there the "codex binary" handed to the runner
// is a `.cmd` shim that invokes node on the stub. Everywhere else the stub is
// executable and is handed over as-is. Same stub, same behaviour, one layer of
// platform plumbing.
// `--doctor` takes no work order — that is half its point, so the helper does
// not pass one. CODEX_HOME points at an empty fixture directory by default so
// the developer's real ~/.codex (session history, config) can never leak into
// the doctor's stale-session hazard report and flip a check.
const CLEAN_CODEX_HOME = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-codex-home-'));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
})();

function runDoctor(fx, extraEnv, extraArgs) {
  return spawnSync(process.execPath, [RUNNER, '--doctor'].concat(extraArgs || []), {
    cwd: fx.repo,
    encoding: 'utf8',
    timeout: 240000,
    env: Object.assign(
      {},
      process.env,
      {
        CLAUDE_PROJECT_DIR: fx.repo,
        CODEX_BIN: STUB_BIN,
        ORCHESTRA_CODEX_HELPER_SIBLINGS: '',
        CODEX_HOME: CLEAN_CODEX_HOME,
        ORCHESTRA_EXEC_ARGS: '',
        ORCHESTRA_REVIEW_ARGS: '',
      },
      extraEnv || {}
    ),
  });
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
  fs.writeFileSync(
    dest,
    '@echo off\r\nnode "' + STUB + '" %*\r\nexit /b %ERRORLEVEL%\r\n',
    'utf8'
  );
  return dest;
}

// The default engine binary for every test that doesn't build its own install.
const STUB_BIN = (() => {
  if (process.platform !== 'win32') return STUB;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-stubbin-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return makeStubBin(dir, 'codex');
})();

// On Windows a "graceful" kill is not graceful: child.kill('SIGTERM') maps to
// TerminateProcess, so no handler in the target runs, whatever it registered.
// Every kill there is therefore the SIGKILL case, and the sweep — not the
// runner's own teardown — is what reclaims the worktree.
const KILL_RUNS_HANDLERS = process.platform !== 'win32';

// ---------------------------------------------------------------- the tests

function case1() {
  section('1. LIVE mode reproduces the field failure (the checker can fail)');
  const fx = makeDirtyRepo();
  const r = runReview(fx, ['--tier', 'inert', '--no-tests']);
  const out = r.stdout || '';
  check(
    'engine sees the session\'s uncommitted files',
    parseInt(field(out, 'DIRTY_COUNT'), 10) > 30,
    'DIRTY_COUNT: ' + field(out, 'DIRTY_COUNT')
  );
  check(
    'pinned-path lookup fails exactly as it did in the field',
    /exists on disk, but not in/.test(field(out, 'PROBE_STDERR')),
    'PROBE_STDERR: ' + field(out, 'PROBE_STDERR')
  );
}

function case2and3() {
  section('2. PINNED mode: the engine reviews a clean checkout of the commit');
  const fx = makeDirtyRepo();
  const r = runReview(fx, [
    '--tier', 'inert', '--no-tests',
    '--base-ref', fx.base, '--head-ref', fx.head,
  ]);
  const out = r.stdout || '';
  check('review still produced a verdict', /^VERDICT: APPROVE$/m.test(out), out.slice(0, 400));
  check(
    'engine ran outside the project directory',
    field(out, 'CWD') !== '' && path.resolve(field(out, 'CWD')) !== path.resolve(fx.repo),
    'CWD: ' + field(out, 'CWD') + ' (project: ' + fx.repo + ')'
  );
  check('checkout is clean', field(out, 'DIRTY_COUNT') === '0', 'DIRTY_COUNT: ' + field(out, 'DIRTY_COUNT'));
  check('checkout is at the pinned SHA', field(out, 'HEAD') === fx.head, 'HEAD: ' + field(out, 'HEAD'));
  check(
    'the field failure is gone — no "exists on disk, but not in"',
    !/exists on disk, but not in/.test(out),
    field(out, 'PROBE_STDERR')
  );
  check(
    'the base ref still resolves from inside the worktree',
    field(out, 'DIFF_STATUS') === '0' && /app\.js/.test(field(out, 'DIFF_STDOUT')),
    'DIFF_STATUS: ' + field(out, 'DIFF_STATUS') + ' DIFF_STDOUT: ' + field(out, 'DIFF_STDOUT')
  );
  check(
    'header records which checkout produced the verdict',
    /checkout: pinned worktree @ /.test(out),
    out.split('\n')[0]
  );
  check(
    'the project working tree was left untouched',
    git(['status', '--porcelain', '--untracked-files=all'], fx.repo).split('\n').filter(Boolean).length === 32,
    git(['status', '--porcelain', '--untracked-files=all'], fx.repo)
  );

  section('3. Teardown leaks nothing after a successful review');
  check(
    'git worktree list shows only the main checkout',
    worktreeLines(fx.repo).length === 1,
    worktreeLines(fx.repo).join('\n')
  );
  check(
    'the scratch worktree directory is gone from disk',
    !fs.existsSync(field(out, 'CWD')),
    'still present: ' + field(out, 'CWD')
  );
}

async function case4() {
  section('4. Teardown leaks nothing after a forced mid-review kill');

  // SIGTERM: the runner's own handler must clean up.
  const fx = makeDirtyRepo();
  const child = spawn(
    process.execPath,
    [RUNNER, '--work-order', fx.wo, '--executor-report', fx.er, '--head-ref', fx.head],
    {
      cwd: fx.repo,
      env: Object.assign({}, process.env, {
        CLAUDE_PROJECT_DIR: fx.repo,
        CODEX_BIN: STUB_BIN,
        ORCHESTRA_REVIEW_IDLE_MS: '0',
        STUB_CODEX_SLEEP_MS: '60000',
      }),
      stdio: 'ignore',
    }
  );
  let registered = false;
  for (let i = 0; i < 150; i++) {
    if (worktreeLines(fx.repo).length > 1) {
      registered = true;
      break;
    }
    await sleep(100);
  }
  check('worktree was live before the kill (kill is meaningful)', registered);
  // Let `worktree add` finish its checkout before pulling the plug. Until it
  // does, `git worktree list` already shows the entry (registration is
  // visible before the files are), but git itself holds it LOCKED for that
  // whole window — proven by polling `list` during a slow add on this
  // machine, which showed "locked" on every sample until the checkout
  // finished. `runGit`'s worktree-add is a direct (non-shell) child of the
  // runner, so it dies with it; kill during that window freezes the entry
  // mid-checkout, still locked, forever. And a LOCKED worktree cannot be
  // swept by anything downstream: sweepStaleScratch and teardownScratch both
  // remove with a single `--force`, which git flatly refuses on a locked
  // worktree ("cannot remove a locked working tree ... use 'remove -f -f' to
  // override") — no amount of waiting or re-running the sweep changes that.
  // So this wait is not pacing a flaky assertion; it is the difference
  // between "killed mid-review" (recoverable, what this case tests) and
  // "killed mid-registration" (unrecoverable by design, a different case).
  // R0-EX8: wait on the LOCK CONDITION itself, never a fixed duration — a
  // slow checkout stays locked long past any sleep.
  check('checkout finished registering (lock cleared) before the SIGTERM', await waitWorktreesUnlocked(fx.repo, 30000));
  child.kill('SIGTERM');
  await new Promise((res) => child.on('exit', res));
  await sleep(300);
  if (KILL_RUNS_HANDLERS) {
    check(
      'SIGTERM: the runner\'s own handler cleaned up — git worktree list is clean',
      worktreeLines(fx.repo).length === 1,
      worktreeLines(fx.repo).join('\n')
    );
  } else {
    // Windows has no POSIX signals: kill('SIGTERM') is TerminateProcess, so no
    // handler in the runner can possibly run. Asserting a clean list here would
    // be asserting something the platform makes impossible; the honest property
    // is that the orphan survives and the sweep (below) is what reclaims it.
    check(
      'SIGTERM on Windows terminates outright, leaving the orphan for the sweep',
      worktreeLines(fx.repo).length > 1,
      worktreeLines(fx.repo).join('\n')
    );
    const swept = runReview(fx, ['--head-ref', fx.head]);
    check(
      'and a later run reclaims it',
      worktreeLines(fx.repo).length === 1,
      (swept.stdout || '').slice(0, 400) + '\n' + worktreeLines(fx.repo).join('\n')
    );
  }

  // SIGKILL runs no handler by design — the next run's sweep is what reclaims
  // the orphan, so that is what gets tested.
  const fx2 = makeDirtyRepo();
  const c2 = spawn(
    process.execPath,
    [RUNNER, '--work-order', fx2.wo, '--executor-report', fx2.er, '--head-ref', fx2.head],
    {
      cwd: fx2.repo,
      env: Object.assign({}, process.env, {
        CLAUDE_PROJECT_DIR: fx2.repo,
        CODEX_BIN: STUB_BIN,
        ORCHESTRA_REVIEW_IDLE_MS: '0',
        STUB_CODEX_SLEEP_MS: '60000',
      }),
      stdio: 'ignore',
    }
  );
  let registered2 = false;
  for (let i = 0; i < 300; i++) {
    if (worktreeLines(fx2.repo).length > 1) {
      registered2 = true;
      break;
    }
    await sleep(100);
  }
  // Let `worktree add` finish its checkout before pulling the plug, so the case
  // under test is "killed mid-review", not "killed mid-registration" — the
  // latter is a different (and much rarer) shape, and testing it by accident
  // makes this case flaky rather than strict. R0-EX8: wait on the lock
  // condition itself, never a fixed duration.
  check('checkout finished registering (lock cleared) before the SIGKILL', await waitWorktreesUnlocked(fx2.repo, 30000));
  check('SIGKILL: the worktree was live before the kill', registered2, 'never registered within 30s');
  c2.kill('SIGKILL');
  await new Promise((res) => c2.on('exit', res));
  await sleep(200);
  check(
    'SIGKILL leaves an orphan (so the sweep has something to prove)',
    worktreeLines(fx2.repo).length > 1,
    worktreeLines(fx2.repo).join('\n')
  );
  const r = runReview(fx2, ['--head-ref', fx2.head]);
  check(
    'the next run sweeps the orphan and leaves only its own',
    worktreeLines(fx2.repo).length === 1,
    (r.stdout || '').split('\n').slice(0, 6).join('\n') + '\n' + worktreeLines(fx2.repo).join('\n')
  );
  check(
    'the sweep is reported, not silent',
    /reclaimed \d+ abandoned review worktree/.test(r.stdout || ''),
    (r.stdout || '').slice(0, 600)
  );
}

function case5() {
  section('5. A failed review never claims OpenAI produced it');
  const fx = makeDirtyRepo();
  const missing = path.join(fx.root, 'no-such-codex-binary');
  const r = runReview(fx, [], { CODEX_BIN: missing });
  const out = r.stdout || '';
  check('the run failed as intended', /VERDICT: REVIEW_UNAVAILABLE/.test(out), out.slice(0, 300));
  check(
    'header does NOT attribute the report to OpenAI',
    !/^REVIEW ENGINE: OpenAI/m.test(out),
    out.split('\n').slice(0, 3).join('\n')
  );
  check(
    'header names no engine at all',
    /^REVIEW ENGINE: NONE/m.test(out),
    out.split('\n')[0]
  );
  check(
    'the attempt is still recorded for diagnosis',
    /^ATTEMPTED: OpenAI via Codex CLI \(/m.test(out),
    out.split('\n').slice(0, 3).join('\n')
  );
  check(
    'the body warns against attributing a later verdict to the engine',
    /nothing below this line came\s+from an OpenAI model/.test(out),
    out.slice(-500)
  );

  // ...and the success path still attributes correctly.
  const ok = runReview(fx, []);
  check(
    'a real verdict IS attributed to the engine',
    /^REVIEW ENGINE: OpenAI via Codex CLI \(/m.test(ok.stdout || ''),
    (ok.stdout || '').split('\n')[0]
  );
}

function case6() {
  section('6. Inert reviews get the 600000ms floor');
  const fx = makeDirtyRepo();
  const flagged = runReview(fx, ['--tier', 'inert', '--timeout-ms', '300000']);
  check(
    'a launcher flag below the floor is raised, and says so',
    /timeout: 600000ms \(flag 300000ms → raised to the 600000ms inert floor\)/.test(flagged.stdout || ''),
    (flagged.stdout || '').split('\n')[0]
  );

  const full = runReview(fx, ['--timeout-ms', '300000']);
  check(
    'a full-depth review keeps the cap it was given',
    /timeout: 300000ms \(flag\)/.test(full.stdout || ''),
    (full.stdout || '').split('\n')[0]
  );

  const userSet = runReview(fx, ['--tier', 'inert'], { ORCHESTRA_REVIEW_TIMEOUT_MS: '120000' });
  check(
    'a cap the user set is honoured, not overridden',
    /timeout: 120000ms \(env, below the 600000ms inert floor — expect a timeout\)/.test(userSet.stdout || ''),
    (userSet.stdout || '').split('\n')[0]
  );

  const dflt = runReview(fx, ['--tier', 'inert']);
  check(
    'the default already clears the floor',
    /timeout: 600000ms \(default\)/.test(dflt.stdout || ''),
    (dflt.stdout || '').split('\n')[0]
  );
}

function case7() {
  section('7. Git config isolation reaches the engine, not just the runner');
  const fx = makeDirtyRepo();

  // Make git's default global excludesFile path unusable, the way a sandboxed
  // user's HOME is: the path resolves but cannot be read as a file. The exact
  // wording is git-version- and platform-dependent (Windows reported "unable to
  // access '<home>/.config/git/ignore': Permission denied"; this git says
  // "cannot use ... as an exclude file"), so match the path, not the phrasing.
  const fakeHome = path.join(fx.root, 'home');
  fs.mkdirSync(path.join(fakeHome, '.config', 'git', 'ignore'), { recursive: true });
  const homeEnv = { HOME: fakeHome, XDG_CONFIG_HOME: path.join(fakeHome, '.config') };
  const complains = /(unable to access|cannot use)[^\n]*[\/\\]git[\/\\]ignore/;

  const off = runReview(fx, ['--head-ref', fx.head],
    Object.assign({}, homeEnv, { ORCHESTRA_REVIEW_GIT_ISOLATION: '0' }));
  // The NEGATIVE CONTROL: with isolation off, git should complain about the
  // unreadable global path, proving the positive assertions below aren't
  // passing vacuously. Whether it complains is git-build- and platform-
  // specific — Git for Windows resolves HOME/XDG differently and stayed quiet
  // in CI — so where the control does not reproduce, say that explicitly
  // rather than fail the runner for its platform's diagnostics, and rather
  // than let a silent pass imply a proof that did not happen.
  const controlReproduced = complains.test(off.stdout || '');
  check(
    controlReproduced
      ? 'without isolation git chokes on the unreadable global path'
      : 'negative control INCONCLUSIVE on this platform: git did not complain even with ' +
        'isolation off, so the checks below prove isolation is wired, not that it silences ' +
        'this git',
    true,
    'IGNORE_PROBE_STDERR: ' + field(off.stdout || '', 'IGNORE_PROBE_STDERR') +
      ' STATUS_STDERR: ' + field(off.stdout || '', 'STATUS_STDERR')
  );

  const on = runReview(fx, ['--head-ref', fx.head], homeEnv);
  const out = on.stdout || '';
  check(
    'with isolation the complaint is gone from every git the engine ran',
    !complains.test(out),
    'IGNORE_PROBE_STDERR: ' + field(out, 'IGNORE_PROBE_STDERR') +
      ' STATUS_STDERR: ' + field(out, 'STATUS_STDERR')
  );
  check(
    'the engine child inherits GIT_CONFIG_GLOBAL',
    field(out, 'GIT_CONFIG_GLOBAL') !== '(unset)' && fs.existsSync(field(out, 'GIT_CONFIG_GLOBAL')) === false,
    'GIT_CONFIG_GLOBAL: ' + field(out, 'GIT_CONFIG_GLOBAL') + ' (expected: set, and torn down after the run)'
  );
  check(
    'the engine child inherits GIT_CONFIG_NOSYSTEM',
    field(out, 'GIT_CONFIG_NOSYSTEM') === '1',
    'GIT_CONFIG_NOSYSTEM: ' + field(out, 'GIT_CONFIG_NOSYSTEM')
  );
}

function case8() {
  section('8. The scratch root is never inside the repository');
  const fx = makeDirtyRepo();
  const r = runReview(fx, ['--head-ref', fx.head]);
  const cwd = field(r.stdout || '', 'CWD');
  check(
    'the worktree lives outside the project tree',
    cwd && path.relative(fx.repo, cwd).startsWith('..'),
    'worktree: ' + cwd + '\nproject: ' + fx.repo
  );
}

function case9() {
  section('9. Pinned mode skips the idle precheck (immutable checkout)');
  const fx = makeDirtyRepo();
  // A tree that is genuinely moving: LIVE mode must refuse, PINNED must not
  // care, because the commit it reads cannot move. The churn has to run in
  // another PROCESS — runReview is synchronous and would starve a timer in
  // this one, which would make the check pass for the wrong reason.
  const churn = spawn(
    process.execPath,
    ['-e', 'const fs=require("fs");setInterval(()=>{try{fs.appendFileSync(process.argv[1],"x")}catch(e){}},50)',
      path.join(fx.repo, 'churn.txt')],
    { stdio: 'ignore' }
  );
  const live = runReview(fx, [], { ORCHESTRA_REVIEW_IDLE_MS: '400' });
  check(
    'LIVE mode refuses a moving tree',
    /working tree is not idle/.test(live.stdout || ''),
    (live.stdout || '').slice(0, 300)
  );
  const pinned = runReview(fx, ['--head-ref', fx.head], { ORCHESTRA_REVIEW_IDLE_MS: '400' });
  check(
    'PINNED mode reviews anyway',
    /VERDICT: APPROVE/.test(pinned.stdout || '') && field(pinned.stdout || '', 'DIRTY_COUNT') === '0',
    (pinned.stdout || '').slice(0, 300)
  );
  churn.kill('SIGKILL');
}

function case10() {
  section('10. Bad refs fail honestly instead of reviewing the wrong thing');
  const fx = makeDirtyRepo();
  const r = runReview(fx, ['--head-ref', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef']);
  const out = r.stdout || '';
  check('unresolvable --head-ref is REVIEW_UNAVAILABLE', /VERDICT: REVIEW_UNAVAILABLE/.test(out), out.slice(0, 300));
  check('it does not silently fall back to the live tree', !/STUB REPORT/.test(out), out.slice(0, 300));
  check('and it does not claim OpenAI produced anything', !/^REVIEW ENGINE: OpenAI/m.test(out), out.split('\n')[0]);
  check('no worktree is left behind', worktreeLines(fx.repo).length === 1, worktreeLines(fx.repo).join('\n'));
}

function case11() {
  section('11. A scratch root inside the repository is refused, not used');
  const fx = makeDirtyRepo();
  const inside = path.join(fx.repo, 'scratch');
  const r = runReview(fx, ['--head-ref', fx.head, '--worktree-root', inside]);
  const out = r.stdout || '';
  check(
    'the review refuses rather than writing into the tree under review',
    /VERDICT: REVIEW_UNAVAILABLE/.test(out) && /scratch directory is inside the repository/.test(out),
    out.slice(0, 400)
  );
  check('no engine attribution on that refusal', !/^REVIEW ENGINE: OpenAI/m.test(out), out.split('\n')[0]);
  check('no worktree was created', worktreeLines(fx.repo).length === 1, worktreeLines(fx.repo).join('\n'));

  // ...and the same refusal must survive a SYMLINKED path to the same place.
  // This is the macOS shape, found by CI the hour it existed: `os.tmpdir()`
  // there is `/var/folders/…`, a symlink to `/private/var/folders/…`, so git
  // reports the repository at one string and the runner built its scratch path
  // from another. Compared raw, a directory plainly inside the repository
  // answered "outside" — and the review wrote its worktree into the tree it was
  // reviewing, which is the exact condition pinned mode exists to remove.
  // Reproduced here on every platform rather than left to one runner's quirk.
  const fx2 = makeDirtyRepo();
  const link = path.join(fx2.root, 'link-to-root');
  let linked = true;
  try {
    fs.symlinkSync(fx2.root, link, 'dir');
  } catch (_) {
    linked = false; // Windows without developer mode / privilege
  }
  if (!linked) {
    check('symlinked-path refusal (SKIPPED — this platform would not create a symlink)', true);
  } else {
    const viaLink = path.join(link, 'project', 'scratch');
    const r2 = runReview(fx2, ['--head-ref', fx2.head, '--worktree-root', viaLink]);
    const out2 = r2.stdout || '';
    check(
      'a scratch root reached through a symlink is still recognised as inside the repo',
      /VERDICT: REVIEW_UNAVAILABLE/.test(out2) && /scratch directory is inside the repository/.test(out2),
      out2.slice(0, 500)
    );
    check(
      'and nothing was written into the repository under review',
      !fs.existsSync(path.join(fx2.repo, 'scratch')),
      'the review created ' + path.join(fx2.repo, 'scratch')
    );
  }
}

// -------------------------------------------------- round 2 (2026-08-12 gate)

function case12() {
  section('12. Failure attribution: who killed the engine, and after how long');

  // (a) The field's exit-143: a signal-class death the runner did NOT cause.
  const fx = makeDirtyRepo();
  const r = runReview(fx, ['--head-ref', fx.head, '--no-retry'], {
    STUB_CODEX_SILENT: '1',
    STUB_CODEX_EXIT: '143',
    STUB_CODEX_STDERR: 'codex: stream closed unexpectedly',
  });
  const out = r.stdout || '';
  check(
    'a 143 exit is named as signal-class, not left as a bare number',
    /status 143 \(SIGTERM-class: 128\+15\)/.test(out),
    out.slice(0, 900)
  );
  check(
    'the report says the runner did NOT send the kill',
    /killed by:\s+NOT this runner/.test(out),
    out
  );
  check(
    'elapsed is reported against the configured cap',
    /elapsed:\s+ran for .* of the \d+ms cap/.test(out),
    out
  );
  check(
    "codex's last words on stderr are quoted",
    /codex stderr \(last 25 lines\):[\s\S]*stream closed unexpectedly/.test(out),
    out
  );
  check(
    'no generic cause list is offered for a kill nobody diagnosed as self-inflicted',
    !/candidate causes for a self-chosen non-zero exit/.test(out),
    out
  );

  // (b) A timeout the runner itself enforced must say so — and must NOT offer
  // the "maybe it's auth, maybe it's your flags" list, none of which ended it.
  const fx2 = makeDirtyRepo();
  const t = runReview(fx2, ['--head-ref', fx2.head, '--timeout-ms', '1500'], {
    STUB_CODEX_SLEEP_MS: '20000',
  });
  const tout = t.stdout || '';
  check(
    'a runner-enforced timeout is attributed to the runner, by name',
    /killed by:\s+THIS RUNNER — its own 1500ms timer fired/.test(tout),
    tout.slice(0, 1200)
  );
  check(
    'the timeout report does not blame auth, flags, or the sandbox',
    !/candidate causes for a self-chosen non-zero exit/.test(tout) &&
      !/not authenticated \(set OPENAI_API_KEY/.test(tout.split('ATTEMPT LOG')[0]),
    tout
  );
  check(
    'a runner-enforced timeout is not retried',
    /this runner made 1 engine attempt/.test(tout),
    tout
  );
  check(
    'and it still says where the cap actually came from',
    /cap from: flag/.test(tout),
    tout.slice(0, 600)
  );
}

function case13() {
  section('13. Retry is the runner\'s job, and the chain is ONE outcome');

  // The checker can fail: with retries off, the field failure stands.
  const fx0 = makeDirtyRepo();
  const counter0 = path.join(fx0.root, 'attempts0.txt');
  const single = runReview(fx0, ['--head-ref', fx0.head, '--no-retry'], {
    STUB_CODEX_FAIL_UNTIL_ATTEMPT: '1',
    STUB_CODEX_ATTEMPT_FILE: counter0,
  });
  check(
    'without a retry, a one-off engine death is the whole review',
    /VERDICT: REVIEW_UNAVAILABLE/.test(single.stdout || ''),
    (single.stdout || '').slice(0, 400)
  );

  // ...and with the default single retry, the same stub yields a real verdict.
  const fx = makeDirtyRepo();
  const counter = path.join(fx.root, 'attempts.txt');
  const r = runReview(fx, ['--head-ref', fx.head], {
    STUB_CODEX_FAIL_UNTIL_ATTEMPT: '1',
    STUB_CODEX_ATTEMPT_FILE: counter,
  });
  const out = r.stdout || '';
  check(
    'the retry produced a real verdict',
    /^VERDICT: APPROVE$/m.test(out),
    out.slice(0, 800)
  );
  check(
    'it was the SECOND attempt that produced it',
    field(out, 'ATTEMPT') === '2',
    'ATTEMPT: ' + field(out, 'ATTEMPT')
  );
  check(
    'the retry ran in a fresh scratch directory, not the failed one',
    /attempt-2/.test(field(out, 'CWD')),
    'CWD: ' + field(out, 'CWD')
  );
  check(
    'no REVIEW_UNAVAILABLE was emitted while an attempt was still possible',
    !/REVIEW_UNAVAILABLE/.test(out),
    out.slice(0, 600)
  );
  check(
    'exactly one VERDICT line is reported for the review',
    (out.match(/^VERDICT: /gm) || []).length === 1,
    (out.match(/^VERDICT: .*/gm) || []).join(' | ')
  );
  check(
    'the chain is stated as one outcome, with the attempt count',
    /ATTEMPT CHAIN: 2 attempts, ONE outcome/.test(out),
    out.slice(0, 900)
  );
  check(
    'the failed attempt is still diagnosable from the successful report',
    /ATTEMPT LOG/.test(out) && /ATTEMPT 1 of 2/.test(out),
    out.slice(-1200)
  );

  // Both attempts failing: one report, exhausted chain, explicit finality.
  const fx2 = makeDirtyRepo();
  const counter2 = path.join(fx2.root, 'attempts2.txt');
  const both = runReview(fx2, ['--head-ref', fx2.head], {
    STUB_CODEX_FAIL_UNTIL_ATTEMPT: '9',
    STUB_CODEX_ATTEMPT_FILE: counter2,
  });
  const bout = both.stdout || '';
  check(
    'an exhausted chain reports REVIEW_UNAVAILABLE exactly once',
    (bout.match(/VERDICT: REVIEW_UNAVAILABLE/g) || []).length === 1,
    bout.slice(0, 400)
  );
  check(
    'and states that no further attempt is coming',
    /FINALITY: this runner made 2 engine attempts and will make no more/.test(bout),
    bout
  );
  check(
    'both attempts are attributed individually',
    /ATTEMPT 1 of 2/.test(bout) && /ATTEMPT 2 of 2/.test(bout),
    bout.slice(-1500)
  );
  check(
    'the engine really was launched twice',
    fs.readFileSync(counter2, 'utf8').trim() === '2',
    'attempt counter: ' + fs.readFileSync(counter2, 'utf8').trim()
  );
}

function case14() {
  section('14. Stage-a probe catches a dead engine before the review budget');

  const fx = makeDirtyRepo();
  const r = runReview(fx, ['--head-ref', fx.head], { STUB_CODEX_PROBE_EXIT: '1' });
  const out = r.stdout || '';
  check(
    'a failing probe refuses the review',
    /VERDICT: REVIEW_UNAVAILABLE/.test(out) && /failed a trivial echo/.test(out),
    out.slice(0, 700)
  );
  check(
    'the review itself was never attempted',
    !/STUB REPORT/.test(out) && /The review was NOT attempted/.test(out),
    out.slice(0, 900)
  );
  check(
    'no worktree was materialized for a review that never ran',
    worktreeLines(fx.repo).length === 1,
    worktreeLines(fx.repo).join('\n')
  );

  const ok = runReview(fx, ['--head-ref', fx.head]);
  check(
    'a passing probe is recorded in the header',
    /PREFLIGHT: auth\/exec probe: ok/.test(ok.stdout || ''),
    (ok.stdout || '').slice(0, 700)
  );

  const off = runReview(fx, ['--head-ref', fx.head, '--no-probe'], { STUB_CODEX_PROBE_EXIT: '1' });
  check(
    '--no-probe skips it entirely (the probe is not a new hard dependency)',
    /VERDICT: APPROVE/.test(off.stdout || '') && !/auth\/exec probe/.test(off.stdout || ''),
    (off.stdout || '').slice(0, 500)
  );
}

function case15() {
  section('15. Install layout + helper siblings are verified, not assumed');

  // A fake install in the NEW layout Codex relocated itself to:
  //   <...>/OpenAI/Codex/bin/<hash>/codex
  const fx = makeDirtyRepo();
  const binRoot = path.join(fx.root, 'AppData', 'Local', 'OpenAI', 'Codex', 'bin');
  const installDir = path.join(binRoot, 'a1b2c3d4');
  const fakeBin = makeStubBin(installDir, 'codex-stub');

  writeProjectConfig(fx, { helperSiblings: ['codex-command-runner.exe', 'codex-resources'] });

  // Isolate the repair search from the REAL machine: the runner's known-good
  // hunt walks home-derived paths (~/.codex/...), so a genuine install on
  // the test machine that happens to carry the helpers would silently repair
  // the "missing" fixture and flip these assertions (observed the moment
  // this machine's Codex install was fixed by hand).
  const iso = { HOME: fx.root, USERPROFILE: fx.root, CODEX_HOME: path.join(fx.root, '.codex') };
  const wantHelpers = Object.assign({ ORCHESTRA_CODEX_HELPER_SIBLINGS: 'codex-command-runner.exe,codex-resources' }, iso);
  const missing = runReview(fx, ['--head-ref', fx.head], Object.assign({ CODEX_BIN: fakeBin }, wantHelpers));
  const mout = missing.stdout || '';
  check(
    'the new install layout is detected and named',
    /codex install layout: appdata-versioned/.test(mout),
    mout.slice(0, 700)
  );
  check(
    'missing helper siblings are named exactly, not hinted at',
    /MISSING FROM THE CODEX INSTALL: codex-command-runner\.exe, codex-resources/.test(mout),
    mout.slice(0, 900)
  );
  check(
    'the report says where it looked for known-good copies',
    /Searched for known-good copies in: /.test(mout),
    mout.slice(0, 1200)
  );
  check(
    'a missing helper does not, by itself, block the review',
    /VERDICT: APPROVE/.test(mout),
    mout.slice(0, 400)
  );

  // A previous version left next door is exactly what a self-update leaves
  // behind — the runner should repair from it.
  const oldVersion = path.join(binRoot, 'old00000');
  fs.mkdirSync(path.join(oldVersion, 'codex-resources'), { recursive: true });
  fs.writeFileSync(path.join(oldVersion, 'codex-command-runner.exe'), 'MZ fake\n');
  fs.writeFileSync(path.join(oldVersion, 'codex-resources', 'r.dat'), 'resource\n');

  const repaired = runReview(fx, ['--head-ref', fx.head], Object.assign({ CODEX_BIN: fakeBin }, wantHelpers));
  const rout = repaired.stdout || '';
  check(
    'helpers are repaired from a sibling version of the same layout',
    /helper siblings repaired next to the resolved binary: codex-command-runner\.exe/.test(rout),
    rout.slice(0, 900)
  );
  check(
    'the repaired files really landed next to the resolved binary',
    fs.existsSync(path.join(installDir, 'codex-command-runner.exe')) &&
      fs.existsSync(path.join(installDir, 'codex-resources', 'r.dat')),
    fs.readdirSync(installDir).join(', ')
  );
  const after = runReview(fx, ['--head-ref', fx.head], Object.assign({ CODEX_BIN: fakeBin }, wantHelpers));
  check(
    'a complete install reports the siblings as present',
    /helper siblings present: codex-command-runner\.exe, codex-resources/.test(after.stdout || ''),
    (after.stdout || '').slice(0, 900)
  );

  // Projects that know they need the helpers can make it a hard stop.
  const fx2 = makeDirtyRepo();
  const installDir2 = path.join(fx2.root, 'OpenAI', 'Codex', 'bin', 'ffff0000');
  const fakeBin2 = makeStubBin(installDir2, 'codex-stub');
  writeProjectConfig(fx2, {
    helperSiblings: ['codex-command-runner.exe'],
    requireHelperSiblings: true,
  });
  const hard = runReview(fx2, ['--head-ref', fx2.head], {
    CODEX_BIN: fakeBin2,
    ORCHESTRA_CODEX_HELPER_SIBLINGS: 'codex-command-runner.exe',
    HOME: fx2.root, USERPROFILE: fx2.root, CODEX_HOME: path.join(fx2.root, '.codex'),
  });
  check(
    'requireHelperSiblings turns a missing helper into a refusal',
    /VERDICT: REVIEW_UNAVAILABLE/.test(hard.stdout || '') &&
      /missing required helper files/.test(hard.stdout || ''),
    (hard.stdout || '').slice(0, 700)
  );

  // The old layout still resolves as a known layout, not as "unknown".
  const fx3 = makeDirtyRepo();
  const oldDir = path.join(fx3.root, '.codex', 'packages', 'standalone', 'current', 'bin');
  const oldBin = makeStubBin(oldDir, 'codex-stub');
  const oldRun = runReview(fx3, ['--head-ref', fx3.head], { CODEX_BIN: oldBin });
  check(
    'the previous install layout is still recognised',
    /codex install layout: codex-standalone/.test(oldRun.stdout || ''),
    (oldRun.stdout || '').slice(0, 700)
  );
}

function case16() {
  section('16. The integrity warning means something again');

  // (a) Engine churn — the Godot first-import case: 180+ generated sidecars.
  const fx = makeDirtyRepo();
  const churn = ['.godot/imported/icon.png-abc.ctex', 'art/icon.png.import', 'build/out.o'];
  const engine = runReview(fx, ['--head-ref', fx.head], { STUB_CODEX_TOUCH: churn.join(',') });
  const eout = engine.stdout || '';
  check(
    'generated-artifact churn does NOT raise the integrity alarm',
    !/INTEGRITY WARNING/.test(eout),
    eout.slice(-900)
  );
  check(
    'but it is still reported, so suppression is visible rather than silent',
    /INTEGRITY NOTE: 3 path\(s\) changed/.test(eout),
    eout.slice(-900)
  );

  // (b) The thing the check exists for: a reviewer writing source.
  const fx2 = makeDirtyRepo();
  const real = runReview(fx2, ['--head-ref', fx2.head], {
    STUB_CODEX_TOUCH: 'src/sneaky-fix.js,art/icon.png.import',
  });
  const rout = real.stdout || '';
  check(
    'a source-file mutation still raises the warning',
    /⚠ INTEGRITY WARNING/.test(rout) && /1 path\(s\) that are NOT expected/.test(rout),
    rout.slice(-1200)
  );
  check(
    'the warning names the offending path instead of dumping two fingerprints',
    /appeared: src\/sneaky-fix\.js/.test(rout) && !/--- before ---/.test(rout),
    rout.slice(-1200)
  );
  check(
    'the allowlisted path is counted, not hidden',
    /1 further changed path\(s\) matched the expected-churn allowlist/.test(rout),
    rout.slice(-1200)
  );

  // (c) A project whose churn is NOT on the default list configures it away.
  const fx3 = makeDirtyRepo();
  writeProjectConfig(fx3, { integrityIgnore: ['*.generated.txt'] });
  const cfg = runReview(fx3, ['--head-ref', fx3.head], {
    STUB_CODEX_TOUCH: 'assets/thing.generated.txt',
  });
  check(
    'integrityIgnore extends the allowlist',
    !/INTEGRITY WARNING/.test(cfg.stdout || '') && /INTEGRITY NOTE/.test(cfg.stdout || ''),
    (cfg.stdout || '').slice(-800)
  );

  // (d) The warmup runs BEFORE the baseline, so first-open churn never even
  // enters the comparison — the option that fixes the class rather than
  // allowlisting it.
  const fx4 = makeDirtyRepo();
  const warm = runReview(fx4, [
    '--head-ref', fx4.head,
    '--warmup-cmd', 'node -e "require(\'fs\').writeFileSync(\'warmed-source.js\',\'x\')"',
  ]);
  const wout = warm.stdout || '';
  check(
    'the warmup ran, and says so',
    /PREFLIGHT: warmup .* completed/.test(wout),
    wout.slice(0, 900)
  );
  check(
    'files the warmup created are not blamed on the reviewer',
    !/INTEGRITY/.test(wout),
    // The stub's own DIRTY_PATHS still lists the file — that is the engine
    // reporting what it saw, which is correct. What must be absent is any
    // integrity finding about it.
    wout.slice(-900)
  );
  // ...and a warmup is never allowed to run in the user's real working tree:
  // it writes, and a review must not write into the tree it is reviewing.
  const fx4b = makeDirtyRepo();
  const liveWarm = runReview(fx4b, [
    '--warmup-cmd', 'node -e "require(\'fs\').writeFileSync(\'must-not-exist.txt\',\'x\')"',
  ]);
  check(
    'a warmup is refused in LIVE mode, and says why',
    /warmup command NOT run: this is a live-tree review/.test(liveWarm.stdout || ''),
    (liveWarm.stdout || '').slice(0, 900)
  );
  check(
    'the live working tree really was not written to',
    !fs.existsSync(path.join(fx4b.repo, 'must-not-exist.txt')),
    'the warmup wrote into the project under review'
  );

  // ...and the same file created by the ENGINE instead is still caught, so the
  // warmup narrows the baseline without blinding the check.
  const fx5 = makeDirtyRepo();
  const noWarm = runReview(fx5, ['--head-ref', fx5.head], {
    STUB_CODEX_TOUCH: 'warmed-source.js',
  });
  check(
    'the same path written by the reviewer IS caught (warmup is not a blanket mute)',
    /⚠ INTEGRITY WARNING/.test(noWarm.stdout || '') &&
      /appeared: warmed-source\.js/.test(noWarm.stdout || ''),
    (noWarm.stdout || '').slice(-900)
  );
}

function case17() {
  section('17. A configured scratch root is honoured or refused — never swapped');

  // Unwritable in a way that bites even as root: the parent is a FILE, so
  // mkdir fails with ENOTDIR regardless of privilege.
  const fx = makeDirtyRepo();
  const blocker = path.join(fx.root, 'blocker');
  fs.writeFileSync(blocker, 'not a directory\n');
  const bad = path.join(blocker, 'scratch');

  const r = runReview(fx, ['--head-ref', fx.head, '--worktree-root', bad]);
  const out = r.stdout || '';
  check(
    'an unusable configured root fails the review instead of falling back',
    /VERDICT: REVIEW_UNAVAILABLE/.test(out) && /no writable scratch directory/.test(out),
    out.slice(0, 700)
  );
  check(
    'the refusal says the configured root is never silently swapped',
    /a configured root is never silently swapped/.test(out) && /\(flag\)/.test(out),
    out.slice(0, 900)
  );
  check(
    'no review ran against some other directory',
    !/STUB REPORT/.test(out),
    out.slice(0, 500)
  );

  // Same via orchestra.json — the durable place projects actually set it.
  const fx2 = makeDirtyRepo();
  const blocker2 = path.join(fx2.root, 'blocker2');
  fs.writeFileSync(blocker2, 'not a directory\n');
  writeProjectConfig(fx2, { worktreeRoot: path.join(blocker2, 'scratch') });
  const cfg = runReview(fx2, ['--head-ref', fx2.head]);
  check(
    'a worktreeRoot from orchestra.json is equally mandatory',
    /VERDICT: REVIEW_UNAVAILABLE/.test(cfg.stdout || '') && /\(orchestra\.json\)/.test(cfg.stdout || ''),
    (cfg.stdout || '').slice(0, 800)
  );

  // A usable configured root is used, and the review proceeds normally.
  const fx3 = makeDirtyRepo();
  const good = path.join(fx3.root, 'scratch-root');
  const ok = runReview(fx3, ['--head-ref', fx3.head, '--worktree-root', good]);
  check(
    'a writable configured root is used as given',
    /VERDICT: APPROVE/.test(ok.stdout || '') &&
      path.resolve(field(ok.stdout || '', 'CWD')).startsWith(path.resolve(good)),
    'CWD: ' + field(ok.stdout || '', 'CWD') + ' (configured root: ' + good + ')'
  );
}

function case18() {
  section('18. The suite itself fails loudly (exit code is not decoration)');
  const probe = spawnSync(
    process.execPath,
    ['-e',
      'process.on("exit",()=>{process.exitCode=1});' +
      'Promise.reject(new Error("boom"))'],
    { encoding: 'utf8' }
  );
  check(
    'node honours an exit code set from an exit handler (the mechanism this suite relies on)',
    probe.status === 1,
    'status: ' + probe.status
  );
}

function case19() {
  section('19. A helper that is present but MISPLACED is found, named, and repaired');

  // The 2026-08-18 field failure, exactly: a repair session put
  // codex-windows-sandbox-setup.exe INSIDE codex-resources\\ instead of beside
  // codex.exe. Codex resolves that helper by name, so the review no-opped —
  // while the preflight reported the install as healthy, because the two names
  // it checked were both there.
  const SIBS = 'codex-command-runner.exe,codex-resources,codex-windows-sandbox-setup.exe';
  const nest = (installDir) => {
    fs.mkdirSync(path.join(installDir, 'codex-resources'), { recursive: true });
    fs.writeFileSync(path.join(installDir, 'codex-command-runner.exe'), 'MZ fake\n');
    fs.writeFileSync(
      path.join(installDir, 'codex-resources', 'codex-windows-sandbox-setup.exe'),
      'MZ fake sandbox setup\n'
    );
  };

  // (a) THE OLD BEHAVIOUR, reproduced: a check that never names the sandbox
  // helper calls this install complete. This is the report the broken lane got.
  const fx0 = makeDirtyRepo();
  const install0 = path.join(fx0.root, 'OpenAI', 'Codex', 'bin', 'aaaa1111');
  const bin0 = makeStubBin(install0, 'codex-stub');
  nest(install0);
  const blind = runReview(fx0, ['--head-ref', fx0.head], {
    CODEX_BIN: bin0,
    ORCHESTRA_CODEX_HELPER_SIBLINGS: 'codex-command-runner.exe,codex-resources',
  });
  check(
    'a sibling list that omits the sandbox helper calls the broken install healthy',
    /helper siblings present: codex-command-runner\.exe, codex-resources/.test(blind.stdout || '') &&
      !fs.existsSync(path.join(install0, 'codex-windows-sandbox-setup.exe')),
    (blind.stdout || '').slice(0, 800)
  );

  // (b) THE FIX: named in the list, found where it actually is, copied up.
  const fx = makeDirtyRepo();
  const installDir = path.join(fx.root, 'OpenAI', 'Codex', 'bin', 'bbbb2222');
  const fakeBin = makeStubBin(installDir, 'codex-stub');
  nest(installDir);
  const fixed = runReview(fx, ['--head-ref', fx.head], {
    CODEX_BIN: fakeBin,
    ORCHESTRA_CODEX_HELPER_SIBLINGS: SIBS,
  });
  const fout = fixed.stdout || '';
  check(
    'the misplaced helper is repaired, not merely reported',
    fs.existsSync(path.join(installDir, 'codex-windows-sandbox-setup.exe')),
    fs.readdirSync(installDir).join(', ')
  );
  check(
    'the report says it was MISPLACED, not that it was missing',
    /codex-windows-sandbox-setup\.exe \(was MISPLACED inside the install at /.test(fout) &&
      !/MISSING FROM THE CODEX INSTALL/.test(fout),
    fout.slice(0, 1200)
  );
  check(
    'the repair does not cost the review',
    /VERDICT: APPROVE/.test(fout),
    fout.slice(0, 400)
  );
  const again = runReview(fx, ['--head-ref', fx.head], {
    CODEX_BIN: fakeBin,
    ORCHESTRA_CODEX_HELPER_SIBLINGS: SIBS,
  });
  check(
    'the next run finds a complete install (the repair persisted)',
    /helper siblings present: .*codex-windows-sandbox-setup\.exe/.test(again.stdout || ''),
    (again.stdout || '').slice(0, 900)
  );

  // (c) A DIRECTORY named like the executable satisfies existsSync and launches
  // nothing — the presence check has to be about kind, not just name.
  const fx2 = makeDirtyRepo();
  const installDir2 = path.join(fx2.root, 'OpenAI', 'Codex', 'bin', 'cccc3333');
  const bin2 = makeStubBin(installDir2, 'codex-stub');
  fs.mkdirSync(path.join(installDir2, 'codex-windows-sandbox-setup.exe'), { recursive: true });
  const wrongKind = runReview(fx2, ['--head-ref', fx2.head], {
    CODEX_BIN: bin2,
    ORCHESTRA_CODEX_HELPER_SIBLINGS: 'codex-windows-sandbox-setup.exe',
  });
  const wout = wrongKind.stdout || '';
  check(
    'a directory of the right name does not count as the executable',
    /MISSING FROM THE CODEX INSTALL: codex-windows-sandbox-setup\.exe/.test(wout),
    wout.slice(0, 900)
  );
  check(
    'the report explains what this particular absence costs',
    /resolves this helper BY NAME/.test(wout),
    wout.slice(0, 1400)
  );

  // (d) The install directory is on the engine's PATH, because that is how
  // Codex finds the helper it resolves by name. Compared case-insensitively on
  // Windows, where realpath may hand back a different case than the caller used.
  const mentions = (text, dir) =>
    process.platform === 'win32'
      ? String(text).toLowerCase().includes(String(dir).toLowerCase())
      : String(text).includes(String(dir));
  check(
    'the engine is launched with the Codex install directory first on PATH',
    mentions(again.stdout || '', 'PATH_FIRST: ' + fs.realpathSync(installDir)),
    (again.stdout || '').split('\n').filter((l) => /PATH_FIRST/.test(l)).join(' | ')
  );

  // (e) --doctor: the same check, reachable without running a review.
  const broken = runDoctor(fx2, {
    CODEX_BIN: bin2,
    ORCHESTRA_CODEX_HELPER_SIBLINGS: 'codex-windows-sandbox-setup.exe',
  });
  const bout = broken.stdout || '';
  check(
    'the doctor reports a broken install with a non-zero exit',
    broken.status === 1 && /NEEDS ATTENTION/.test(bout),
    'status=' + broken.status + '\n' + bout.slice(0, 900)
  );
  check(
    'the doctor prints a copy command for the file to place, in the right directory',
    new RegExp('(cp -R|copy) "').test(bout) && mentions(bout, fs.realpathSync(installDir2)),
    bout.slice(0, 1400)
  );
  const healthy = runDoctor(fx, {
    CODEX_BIN: fakeBin,
    ORCHESTRA_CODEX_HELPER_SIBLINGS: SIBS,
  });
  check(
    'a complete install passes the doctor with exit 0, and no work order was needed',
    healthy.status === 0 && /OK — a review would find this install complete/.test(healthy.stdout || ''),
    'status=' + healthy.status + '\n' + (healthy.stdout || '').slice(0, 900)
  );
  const noCodex = runDoctor(fx, { CODEX_BIN: path.join(fx.root, 'no-such-codex') });
  check(
    'a Codex that cannot be resolved is a failed check, not a clean bill of health',
    noCodex.status === 1 && /could not be resolved/.test(noCodex.stdout || ''),
    'status=' + noCodex.status + '\n' + (noCodex.stdout || '').slice(0, 700)
  );
}

function case20() {
  section('20. The doctor names stale-session hazards and self-tests the exec nonce');
  const fx = makeDirtyRepo();

  // Resume-prone env: the exact tokens the exec runner refuses to launch with.
  const env = runDoctor(fx, { ORCHESTRA_EXEC_ARGS: 'resume --last' });
  check(
    'resume-prone ORCHESTRA_EXEC_ARGS are NEEDS ATTENTION with a non-zero exit',
    env.status === 1 &&
      /NEEDS ATTENTION/.test(env.stdout || '') &&
      /session-resuming token/.test(env.stdout || ''),
    'status=' + env.status + '\n' + (env.stdout || '').slice(0, 1200)
  );

  // Resume-prone Codex config: a config.toml line that would resume threads.
  const badHome = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-codex-home-'));
  cleanups.push(() => fs.rmSync(badHome, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(badHome, 'config.toml'),
    '# codex config\nexperimental_resume = "/tmp/last-thread"\n',
    'utf8'
  );
  const cfg = runDoctor(fx, { CODEX_HOME: badHome });
  check(
    'a resume-prone config.toml line is flagged, with file and line',
    cfg.status === 1 && /config\.toml:2 looks resume-prone/.test(cfg.stdout || ''),
    'status=' + cfg.status + '\n' + (cfg.stdout || '').slice(0, 1200)
  );

  // Session artifacts alone are a note, not a failure: the runners never
  // resume, so history is harmless until a resume-prone config appears.
  const histHome = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-codex-home-'));
  cleanups.push(() => fs.rmSync(histHome, { recursive: true, force: true }));
  fs.mkdirSync(path.join(histHome, 'sessions', '2026', '08'), { recursive: true });
  fs.writeFileSync(path.join(histHome, 'sessions', '2026', '08', 'rollout-1.jsonl'), '{}\n');
  fs.writeFileSync(path.join(histHome, 'sessions', '2026', '08', 'rollout-2.jsonl'), '{}\n');
  const hist = runDoctor(fx, { CODEX_HOME: histHome });
  check(
    'session artifacts alone are an informational note with exit 0',
    hist.status === 0 && /2 session artifact file\(s\)/.test(hist.stdout || ''),
    'status=' + hist.status + '\n' + (hist.stdout || '').slice(0, 1200)
  );
  check(
    'the plain doctor points at --live instead of spending a model call',
    /Add --live/.test(hist.stdout || ''),
    (hist.stdout || '').slice(-600)
  );

  // --live: the nonce round-trip through the sibling exec runner, against the
  // stub engine. A faithful echo self-tests ok; a broken echo fails loudly.
  const live = runDoctor(fx, { STUB_CODEX_FIRST_LINE: 'STATUS: DONE' }, ['--live']);
  check(
    'the --live no-op order round-trips the report-integrity token',
    live.status === 0 &&
      /report-integrity self-test: ok/.test(live.stdout || ''),
    'status=' + live.status + '\n' + (live.stdout || '').slice(-1200)
  );
  const liveBroken = runDoctor(
    fx,
    { STUB_CODEX_FIRST_LINE: 'STATUS: DONE', STUB_CODEX_OMIT_NONCE: '1' },
    ['--live']
  );
  check(
    'a broken nonce echo fails the --live self-test with a non-zero exit',
    liveBroken.status === 1 &&
      /report-integrity self-test: FAILED/.test(liveBroken.stdout || ''),
    'status=' + liveBroken.status + '\n' + (liveBroken.stdout || '').slice(-1200)
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
  case2and3();
  await case4();
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
}

main().then(finish, (e) => {
  check('the suite ran to completion', false, (e && e.stack) || e);
  finish();
});
