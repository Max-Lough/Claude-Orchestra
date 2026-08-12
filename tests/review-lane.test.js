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
    console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/\n/g, '\n        ') : ''));
  }
}

function section(title) {
  console.log('\n' + title);
}

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
        CODEX_BIN: STUB,
        ORCHESTRA_REVIEW_IDLE_MS: '0',
        ORCHESTRA_REVIEW_MODEL: 'gpt-5.6-sol',
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

// ---------------------------------------------------------------- the tests

section('1. LIVE mode reproduces the field failure (the checker can fail)');
{
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

section('2. PINNED mode: the engine reviews a clean checkout of the commit');
{
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

section('4. Teardown leaks nothing after a forced mid-review kill');
{
  // SIGTERM: the runner's own handler must clean up.
  const fx = makeDirtyRepo();
  const child = spawn(
    process.execPath,
    [RUNNER, '--work-order', fx.wo, '--executor-report', fx.er, '--head-ref', fx.head],
    {
      cwd: fx.repo,
      env: Object.assign({}, process.env, {
        CLAUDE_PROJECT_DIR: fx.repo,
        CODEX_BIN: STUB,
        ORCHESTRA_REVIEW_IDLE_MS: '0',
        STUB_CODEX_SLEEP_MS: '60000',
      }),
      stdio: 'ignore',
    }
  );
  const killed = (async () => {
    // Wait for the worktree to actually exist, then kill mid-review.
    for (let i = 0; i < 100; i++) {
      if (worktreeLines(fx.repo).length > 1) return true;
      await new Promise((res) => setTimeout(res, 100));
    }
    return false;
  })();

  killed.then((registered) => {
    check('worktree was live before the kill (kill is meaningful)', registered);
    child.kill('SIGTERM');
    child.on('exit', () => {
      // The stubbed codex is a separate process holding no lock; git's records
      // are what matter.
      setTimeout(() => {
        check(
          'SIGTERM: git worktree list is clean',
          worktreeLines(fx.repo).length === 1,
          worktreeLines(fx.repo).join('\n')
        );
        runSigkillCase();
      }, 300);
    });
  });

  // SIGKILL runs no handler by design — the next run's sweep is what reclaims
  // the orphan, so that is what gets tested.
  function runSigkillCase() {
    const fx2 = makeDirtyRepo();
    const c2 = spawn(
      process.execPath,
      [RUNNER, '--work-order', fx2.wo, '--executor-report', fx2.er, '--head-ref', fx2.head],
      {
        cwd: fx2.repo,
        env: Object.assign({}, process.env, {
          CLAUDE_PROJECT_DIR: fx2.repo,
          CODEX_BIN: STUB,
          ORCHESTRA_REVIEW_IDLE_MS: '0',
          STUB_CODEX_SLEEP_MS: '60000',
        }),
        stdio: 'ignore',
      }
    );
    (async () => {
      for (let i = 0; i < 100; i++) {
        if (worktreeLines(fx2.repo).length > 1) break;
        await new Promise((res) => setTimeout(res, 100));
      }
      c2.kill('SIGKILL');
      await new Promise((res) => c2.on('exit', res));
      await new Promise((res) => setTimeout(res, 200));
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
      finish();
    })();
  }
}

// ------------------------------------------------------- synchronous section
// Everything below runs before the async block above completes; results are
// tallied together in finish().

section('5. A failed review never claims OpenAI produced it');
{
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

section('6. Inert reviews get the 600000ms floor');
{
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

section('7. Git config isolation reaches the engine, not just the runner');
{
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
  check(
    'without isolation git chokes on the unreadable global path',
    complains.test(off.stdout || ''),
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

section('8. The scratch root is never inside the repository');
{
  const fx = makeDirtyRepo();
  const r = runReview(fx, ['--head-ref', fx.head]);
  const cwd = field(r.stdout || '', 'CWD');
  check(
    'the worktree lives outside the project tree',
    cwd && path.relative(fx.repo, cwd).startsWith('..'),
    'worktree: ' + cwd + '\nproject: ' + fx.repo
  );

  // An unwritable configured root must fall back rather than fail the review.
  const bad = path.join(fx.root, 'not-writable', 'nope');
  fs.mkdirSync(path.join(fx.root, 'not-writable'), { recursive: true });
  fs.chmodSync(path.join(fx.root, 'not-writable'), 0o500);
  const fb = runReview(fx, ['--head-ref', fx.head, '--worktree-root', bad]);
  const usable = /VERDICT: APPROVE/.test(fb.stdout || '');
  // Running as root defeats the permission bit; only assert when it bites.
  if (/scratch root fell back/.test(fb.stdout || '')) {
    check('an unwritable scratch root falls back instead of failing', usable, (fb.stdout || '').slice(0, 400));
  } else {
    check('configured scratch root was usable (fallback path not exercised here)', usable,
      (fb.stdout || '').slice(0, 400));
  }
  fs.chmodSync(path.join(fx.root, 'not-writable'), 0o700);
}

section('9. Pinned mode skips the idle precheck (immutable checkout)');
{
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
  const churnStopped = new Promise((res) => churn.on('exit', res));
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
  cleanups.push(() => churnStopped);
}

section('10. Bad refs fail honestly instead of reviewing the wrong thing');
{
  const fx = makeDirtyRepo();
  const r = runReview(fx, ['--head-ref', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef']);
  const out = r.stdout || '';
  check('unresolvable --head-ref is REVIEW_UNAVAILABLE', /VERDICT: REVIEW_UNAVAILABLE/.test(out), out.slice(0, 300));
  check('it does not silently fall back to the live tree', !/STUB REPORT/.test(out), out.slice(0, 300));
  check('and it does not claim OpenAI produced anything', !/^REVIEW ENGINE: OpenAI/m.test(out), out.split('\n')[0]);
  check('no worktree is left behind', worktreeLines(fx.repo).length === 1, worktreeLines(fx.repo).join('\n'));
}

section('11. A scratch root inside the repository is refused, not used');
{
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
