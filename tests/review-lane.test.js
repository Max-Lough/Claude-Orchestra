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

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

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
        CODEX_BIN: STUB,
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
  child.kill('SIGTERM');
  await new Promise((res) => child.on('exit', res));
  await sleep(300);
  check(
    'SIGTERM: git worktree list is clean',
    worktreeLines(fx.repo).length === 1,
    worktreeLines(fx.repo).join('\n')
  );

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
        CODEX_BIN: STUB,
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
  // makes this case flaky rather than strict.
  await sleep(250);
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
  fs.mkdirSync(installDir, { recursive: true });
  const fakeBin = path.join(installDir, 'codex-stub.js');
  fs.copyFileSync(STUB, fakeBin);
  fs.chmodSync(fakeBin, 0o755);

  writeProjectConfig(fx, { helperSiblings: ['codex-command-runner.exe', 'codex-resources'] });

  const missing = runReview(fx, ['--head-ref', fx.head], { CODEX_BIN: fakeBin });
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

  const repaired = runReview(fx, ['--head-ref', fx.head], { CODEX_BIN: fakeBin });
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
  const after = runReview(fx, ['--head-ref', fx.head], { CODEX_BIN: fakeBin });
  check(
    'a complete install reports the siblings as present',
    /helper siblings present: codex-command-runner\.exe, codex-resources/.test(after.stdout || ''),
    (after.stdout || '').slice(0, 900)
  );

  // Projects that know they need the helpers can make it a hard stop.
  const fx2 = makeDirtyRepo();
  const installDir2 = path.join(fx2.root, 'OpenAI', 'Codex', 'bin', 'ffff0000');
  fs.mkdirSync(installDir2, { recursive: true });
  const fakeBin2 = path.join(installDir2, 'codex-stub.js');
  fs.copyFileSync(STUB, fakeBin2);
  fs.chmodSync(fakeBin2, 0o755);
  writeProjectConfig(fx2, {
    helperSiblings: ['codex-command-runner.exe'],
    requireHelperSiblings: true,
  });
  const hard = runReview(fx2, ['--head-ref', fx2.head], { CODEX_BIN: fakeBin2 });
  check(
    'requireHelperSiblings turns a missing helper into a refusal',
    /VERDICT: REVIEW_UNAVAILABLE/.test(hard.stdout || '') &&
      /missing required helper files/.test(hard.stdout || ''),
    (hard.stdout || '').slice(0, 700)
  );

  // The old layout still resolves as a known layout, not as "unknown".
  const fx3 = makeDirtyRepo();
  const oldDir = path.join(fx3.root, '.codex', 'packages', 'standalone', 'current', 'bin');
  fs.mkdirSync(oldDir, { recursive: true });
  const oldBin = path.join(oldDir, 'codex-stub.js');
  fs.copyFileSync(STUB, oldBin);
  fs.chmodSync(oldBin, 0o755);
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
}

main().then(finish, (e) => {
  check('the suite ran to completion', false, (e && e.stack) || e);
  finish();
});
