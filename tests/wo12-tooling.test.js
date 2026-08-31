#!/usr/bin/env node
/**
 * WO-12 tooling tests — build-corpus.js, run-lane.js, score.js,
 * assemble-key.js (`plans/cross-compare/agent-role-architecture/wo12/`).
 *
 *   node tests/wo12-tooling.test.js
 *
 * No dependencies, no test framework, no real codex/engine invocation
 * anywhere in this file — run-lane.js is only ever exercised with a STUB
 * runner script (a few lines of node that print a VERDICT block) and a
 * stubbed quartermaster command (WO12_QM_CMD), same pattern as
 * tests/review-lane.test.js's stub-codex.js. Nothing here bills allowance,
 * touches a real readings file, or reaches a network.
 *
 * Round 2 (`roster/wo12-r0-review-anthropic-1.md`): every CRITICAL, MAJOR and
 * MINOR in that record has at least one check here, and each such check names
 * the finding it closes. The round-1 suite pinned two of the holes as intended
 * behaviour (the fail-open P0 gate's two happy paths, and the unconditional
 * `Commit subject:` leakage exemption); those pins are gone, replaced by
 * checks that fail if the hole comes back.
 *
 * Same exit-code discipline as the other suites: every failure sets
 * process.exitCode immediately, an `exit` handler enforces non-zero on any
 * recorded failure OR on a suite that ran no checks at all, and uncaught
 * exceptions/rejections are caught and reported as failures rather than
 * silently exiting green.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const WO12 = path.join(MASTER, 'plans', 'cross-compare', 'agent-role-architecture', 'wo12');
const BUILD_CORPUS = path.join(WO12, 'build-corpus.js');
const RUN_LANE = path.join(WO12, 'run-lane.js');
const SCORE = path.join(WO12, 'score.js');
const ASSEMBLE_KEY = path.join(WO12, 'assemble-key.js');

const buildCorpusLib = require(BUILD_CORPUS);
const runLaneLib = require(RUN_LANE);
const scoreLib = require(SCORE);
const assembleKeyLib = require(ASSEMBLE_KEY);

let failures = 0;
let passes = 0;
const cleanups = [];

// ------------------------------------------------- working-tree guard (round 5)
//
// No check in this suite may write into the repository. Round-5 incident: §8
// drove `run-lane.js --override-p0`, which appended to a FIXED repo path
// (`wo12/p0-overrides.log`); the save/restore that hid it lived in
// `process.on('exit')`, which does not run when the suite is killed by a
// SIGTERM from `timeout`, so an interrupted run left an untracked file behind.
//
// `git status --porcelain` over wo12/ is captured HERE, before any section
// runs, and compared at the end. Comparing start-to-end rather than requiring a
// clean tree is deliberate: the corpus legitimately carries other agents'
// uncommitted work, and this guard is about what THIS SUITE does.
function wo12PorcelainStatus() {
  const r = spawnSync('git', ['-C', MASTER, 'status', '--porcelain', '--',
    'plans/cross-compare/agent-role-architecture/wo12'], { encoding: 'utf8' });
  if (r.status !== 0) return null; // not a git checkout: the guard reports that and skips
  return (r.stdout || '').split(/\r?\n/).filter(Boolean).sort().join('\n');
}
const WO12_STATUS_AT_START = wo12PorcelainStatus();

function check(name, ok, detail) {
  if (ok) {
    passes++;
    console.log('  PASS  ' + name);
  } else {
    failures++;
    process.exitCode = 1;
    console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/\n/g, '\n        ') : ''));
  }
}
function section(title) { console.log('\n' + title); }
function finish() { process.exit(failures > 0 ? 1 : 0); }

process.on('exit', () => {
  for (const fn of cleanups) { try { fn(); } catch (e) { /* best effort */ } }
  if (failures > 0) process.exitCode = 1;
  else if (passes === 0) {
    console.log('\nFAILED — no checks ran at all (the suite did not execute)');
    process.exitCode = 1;
  }
});
process.on('unhandledRejection', (e) => { check('no unhandled rejection in the suite', false, (e && e.stack) || e); finish(); });
process.on('uncaughtException', (e) => { check('no uncaught exception in the suite', false, (e && e.stack) || e); finish(); });

// ------------------------------------------------------------------ helpers

function git(args, cwd) {
  const r = spawnSync('git', ['-C', cwd].concat(args), { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed in ' + cwd + ':\n' + (r.stderr || ''));
  return (r.stdout || '').trim();
}
function gitRaw(args, cwd) {
  return spawnSync('git', ['-C', cwd].concat(args), { encoding: 'utf8' });
}

function tmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(() => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ } });
  return d;
}

const REAL_SUBJECT = 'fixture: widen the adder and pin the regression';
const REAL_BODY_TAIL = [
  '',
  'The old signature silently truncated on the third argument; this widens it',
  'and pins the behaviour in the suite.',
  '',
  'Co-Authored-By: A Fixture Author <fixture@example.invalid>',
].join('\n');
const REAL_MESSAGE = REAL_SUBJECT + '\n' + REAL_BODY_TAIL + '\n';

// A minimal source repo this suite fully controls, standing in for "THIS
// repository" that build-corpus.js clones from. Two commits: `base` (the
// parent P) and `commit` (the real commit C, with a multi-paragraph body and a
// trailer, so the round-2 metadata assertions have something to compare).
function makeSourceRepo() {
  const dir = tmpDir('wo12-src-');
  git(['init', '-q', '-b', 'main'], dir);
  git(['config', 'user.email', 'wo12-test@example.com'], dir);
  git(['config', 'user.name', 'WO-12 Test'], dir);
  git(['config', 'commit.gpgsign', 'false'], dir);
  fs.writeFileSync(path.join(dir, 'app.js'), 'function add(a, b) {\n  return a + b;\n}\n');
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', 'base commit for wo12 test'], dir);
  const base = git(['rev-parse', 'HEAD'], dir);

  fs.writeFileSync(path.join(dir, 'app.js'), 'function add(a, b, c) {\n  return a + b + (c || 0);\n}\n');
  git(['add', '-A'], dir);
  const msgFile = path.join(dir, '.wo12-msg.txt');
  fs.writeFileSync(msgFile, REAL_MESSAGE, 'utf8');
  const r = spawnSync('git', ['-C', dir, 'commit', '-q', '--cleanup=verbatim', '-F', msgFile], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      GIT_AUTHOR_NAME: 'A Fixture Author', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_AUTHOR_DATE: '2026-01-02T03:04:05-08:00',
      GIT_COMMITTER_NAME: 'A Fixture Committer', GIT_COMMITTER_EMAIL: 'committer@example.invalid',
      GIT_COMMITTER_DATE: '2026-01-02T03:04:06-08:00',
    }),
  });
  if (r.status !== 0) throw new Error('fixture commit failed: ' + (r.stderr || ''));
  fs.rmSync(msgFile, { force: true });
  const commit = git(['rev-parse', 'HEAD'], dir);
  return { dir, base, commit };
}

// Produces a unified diff (base -> mutated working tree) against the BASE
// commit, then restores the working tree so the source repo is left clean.
function makePatchAgainstBase(repo, mutate) {
  git(['checkout', '-q', '--detach', repo.base], repo.dir);
  mutate(repo.dir);
  const diff = spawnSync('git', ['-C', repo.dir, 'diff'], { encoding: 'utf8' }).stdout;
  spawnSync('git', ['-C', repo.dir, 'checkout', '--', '.'], { encoding: 'utf8' });
  git(['checkout', '-q', 'main'], repo.dir);
  return diff;
}

function writeKey(dir, artifacts) {
  const p = path.join(dir, 'key.json');
  fs.writeFileSync(p, JSON.stringify({ version: 1, artifacts }, null, 2), 'utf8');
  return p;
}

// Quote-wraps a path for a whitespace-split command string (WO12_QM_CMD),
// since process.execPath can itself contain spaces (a Program Files install).
function q(p) { return '"' + p + '"'; }

function writeStub(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body, 'utf8');
  return p;
}

// §2.4's X-Terra lane config, for direct runOneAttempt calls.
const LANE_TERRA = { model: 'gpt-5.6-terra', args: '-c model_reasoning_effort=medium' };

// A terminal attempt that produced a real verdict. Round 3: a prior phase
// counts as complete only when its records carry usable verdicts, not merely
// rows (`checkPhaseOrder`), and resume treats such a record as done.
const DONE_ATTEMPT = [{
  wallMs: 1, verdict: 'APPROVE', status: 'COMPLETED', unavailable: false, unavailableReason: null,
  engineHeader: 'REVIEW ENGINE: codex model: gpt-5.6-terra', integrityWarning: false,
  stdout: 'VERDICT: APPROVE\n\nFINDINGS\n- none\n',
}];

/** A stub `quartermaster --state` that prints `json` on stdout and exits 0. */
function qmStubJson(dir, name, json) {
  return writeStub(dir, name,
    'process.stdout.write(' + JSON.stringify(JSON.stringify(json, null, 2)) + ');\n');
}

/** The OU bucket shape `bucketState()` actually publishes. */
function ouState(remainingFraction, extra) {
  const state = { remainingFraction };
  const bucket = Object.assign({ state, belowReserve: false }, extra || {});
  return {
    'AU-opus': { state: { remainingFraction: 0.9 }, belowReserve: false },
    'AU-sonnet': { state: { remainingFraction: 0.9 }, belowReserve: false },
    'AU-fable': { state: { remainingFraction: 0.9 }, belowReserve: false },
    OU: bucket,
  };
}

function runLane(args, env) {
  return spawnSync(process.execPath, [RUN_LANE].concat(args), {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: Object.assign({}, process.env, env || {}),
  });
}

// A one-artifact control corpus in `dir`, wired to `repo`. Returns the paths
// run-lane needs.
function miniLaneCorpus(repo, phase) {
  const dir = tmpDir('wo12-lane-');
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [{
    id: 'sdc-001', kind: 'control', phase: phase === undefined ? 0 : phase, variant: 'V1',
    base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }];
  fs.writeFileSync(path.join(briefs, 'sdc-001.wo.txt'), 'work order\n');
  fs.writeFileSync(path.join(briefs, 'sdc-001.er.txt'), 'executor report\n');
  return { dir, briefs, keyPath: writeKey(dir, artifacts), artifacts };
}

// ================================================================ build-corpus

section('1. build-corpus.js — reproducibility across DIFFERENT local git config (round-2 MAJOR 12)');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-repro-');
  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  return a - b;\n}\n');
  });
  check('patch is non-empty', patch.trim().length > 0, patch);
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  const keyPath = writeKey(work, [{
    id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1',
    base: repo.base, commit: repo.commit, subject: REAL_SUBJECT,
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: [] },
  }]);

  // Two GLOBAL git configs that disagree on exactly the settings the round-1
  // materializer left unpinned. Same (base, patch) pair; the head sha must not
  // move.
  function globalConfig(name, body) {
    const f = path.join(work, name);
    fs.writeFileSync(f, body, 'utf8');
    return f;
  }
  const cfgA = globalConfig('gitconfig-a', '[core]\n\tautocrlf = true\n\teol = crlf\n[user]\n\tname = Machine A\n\temail = a@example.invalid\n');
  const cfgB = globalConfig('gitconfig-b', '[core]\n\tautocrlf = false\n\teol = lf\n[user]\n\tname = Machine B\n\temail = b@example.invalid\n');

  function build(cloneRoot, cfg) {
    return spawnSync(process.execPath, [
      BUILD_CORPUS, '--id', 'sdc-001', '--key', keyPath, '--corpus-dir', work, '--patches-dir', work,
      '--source-repo', repo.dir, '--clone-root', cloneRoot,
    ], { encoding: 'utf8', env: Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: cfg }) });
  }
  const r1 = build(path.join(work, 'clone-a'), cfgA);
  const r2 = build(path.join(work, 'clone-b'), cfgB);
  check('build under git config A exits 0', r1.status === 0, r1.stderr);
  check('build under git config B exits 0', r2.status === 0, r2.stderr);
  let out1 = null, out2 = null;
  try { out1 = JSON.parse((r1.stdout || '').trim().split('\n').pop()); } catch (e) { /* reported below */ }
  try { out2 = JSON.parse((r2.stdout || '').trim().split('\n').pop()); } catch (e) { /* reported below */ }
  check('both invocations print parseable JSON', !!out1 && !!out2, (r1.stdout || '') + '|' + (r2.stdout || ''));
  if (out1 && out2) {
    check('MAJOR 12: the head sha is REPRODUCIBLE across clones with autocrlf=true vs false and different user.name',
      out1.head === out2.head, 'A head=' + out1.head + ' B head=' + out2.head);
    check('the variant head differs from the base (a real commit was made)', out1.head !== repo.base);

    // CRITICAL 2: the seeded head must carry the REAL commit C's identity and
    // full message body — the round-1 "WO-12 seeder <wo12@orchestra.local>",
    // its constant future date and its one-line message were a 100%/100% tell
    // in `git log -1`.
    const cloneA = path.join(work, 'clone-a');
    const meta = git(['log', '-1', '--format=%an|%ae|%aI|%cn|%ce|%cI', out1.head], cloneA);
    const realMeta = git(['log', '-1', '--format=%an|%ae|%aI|%cn|%ce|%cI', repo.commit], repo.dir);
    check('CRITICAL 2: the seeded head carries the REAL commit\'s author/committer names, emails and dates',
      meta === realMeta, 'variant=' + meta + '\nreal    =' + realMeta);
    const body = spawnSync('git', ['-C', cloneA, 'cat-file', 'commit', out1.head], { encoding: 'utf8' }).stdout;
    const variantMsg = body.slice(body.indexOf('\n\n') + 2);
    check('CRITICAL 2: the seeded head carries the REAL commit\'s FULL message body, byte-for-byte (trailer included)',
      variantMsg === REAL_MESSAGE, JSON.stringify(variantMsg) + ' !== ' + JSON.stringify(REAL_MESSAGE));
    check('CRITICAL 2: the message is NOT a one-line subject (the round-1 shape)',
      variantMsg.split('\n').length > 3 && /Co-Authored-By:/.test(variantMsg), JSON.stringify(variantMsg));
    check('CRITICAL 2: no "WO-12 seeder" identity survives anywhere in the head\'s metadata',
      !/WO-12 seeder|wo12@orchestra\.local/.test(meta + variantMsg), meta);
  }
}

section('2. build-corpus.js — fail-closed on a patch that will not apply, and on an empty patch');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-badpatch-');
  fs.writeFileSync(path.join(work, 'sdc-001.patch'),
    'diff --git a/nope.js b/nope.js\n--- a/nope.js\n+++ b/nope.js\n@@ -1,1 +1,1 @@\n-nothing\n+something\n', 'utf8');
  const keyPath = writeKey(work, [{
    id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }]);
  const r = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'sdc-001', '--key', keyPath,
    '--corpus-dir', work, '--patches-dir', work, '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')],
  { encoding: 'utf8' });
  check('exits non-zero on an unapplyable patch', r.status !== 0, 'status=' + r.status);
  check('error names the failure as a patch-apply problem', /patch failed to apply/i.test(r.stderr || ''), r.stderr);

  const work2 = tmpDir('wo12-emptypatch-');
  fs.writeFileSync(path.join(work2, 'sdc-002.patch'), '', 'utf8');
  let threw = null;
  try {
    const clone = path.join(work2, 'clone');
    buildCorpusLib.ensureClone(repo.dir, clone);
    buildCorpusLib.materializeArtifact(
      { id: 'sdc-002', kind: 'seeded', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT },
      clone, work2, {});
  } catch (e) { threw = e; }
  check('materializeArtifact throws on an empty patch file', !!threw, threw && threw.message);
  check('the empty-patch failure is a fail-closed refusal, not a silent no-op commit',
    !!threw && /(staged diff is EMPTY|patch failed to apply)/i.test(threw.message), threw && threw.message);
}

section('3. build-corpus.js — control artifacts are the real commit, unmodified');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-control-');
  const keyPath = writeKey(work, [{
    id: 'sdc-001', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }]);
  const r = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'sdc-001', '--key', keyPath,
    '--corpus-dir', work, '--patches-dir', work, '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')],
  { encoding: 'utf8' });
  check('control materialization exits 0', r.status === 0, r.stderr);
  let out = null;
  try { out = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { /* reported */ }
  check('control head is exactly the real commit sha (no re-commit)', !!out && out.head === repo.commit, JSON.stringify(out));
}

section('4. build-corpus.js — CRITICAL 3: the sanitized run clone cannot reach the answer key');
{
  const repo = makeSourceRepo();
  // Put a stand-in answer key in the source repo's history: the real corpus's
  // key.json lives on a branch the run clone must not be able to walk to.
  const keyRel = 'plans/cross-compare/agent-role-architecture/wo12/corpus/key.json';
  fs.mkdirSync(path.join(repo.dir, path.dirname(keyRel)), { recursive: true });
  const keyBody = '{\n  "version": 1,\n  "artifacts": [ { "id": "sdc-001", "kind": "seeded" } ]\n}\n';
  fs.writeFileSync(path.join(repo.dir, keyRel), keyBody, 'utf8');
  git(['add', '-A'], repo.dir);
  git(['commit', '-q', '-m', 'add the sealed key (must be unreachable from a run clone)'], repo.dir);
  const keyCommit = git(['rev-parse', 'HEAD'], repo.dir);
  const keyBlob = git(['hash-object', path.join(repo.dir, keyRel)], repo.dir);

  const work = tmpDir('wo12-sanitize-');
  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  return a * b;\n}\n');
  });
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  const artifacts = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null },
  ];
  const keyPath = writeKey(work, artifacts);
  const clone = path.join(work, 'clone');
  buildCorpusLib.ensureClone(repo.dir, clone);

  for (const a of artifacts) {
    const runDir = path.join(work, 'run', a.id);
    const mat = buildCorpusLib.materializeArtifact(a, clone, work, { keyBlobSha: keyBlob, runCloneDir: runDir });
    check(a.kind + ' artifact produced a sanitized run clone', mat.runCloneDir === runDir, JSON.stringify(mat));
    check(a.kind + ': `git for-each-ref` in the run clone is EMPTY', git(['for-each-ref'], runDir) === '', git(['for-each-ref'], runDir));
    check(a.kind + ': `git rev-parse HEAD` still works and IS the pinned head',
      git(['rev-parse', 'HEAD'], runDir) === mat.head);
    check(a.kind + ': nothing is reachable beyond the pinned head\'s ancestry (rev-list --all === rev-list HEAD)',
      git(['rev-list', '--all'], runDir) === git(['rev-list', 'HEAD'], runDir));
    const catKey = gitRaw(['cat-file', '-e', keyBlob], runDir);
    check(a.kind + ': CRITICAL 3 — the answer key\'s BLOB is absent from the run clone\'s object store', catKey.status !== 0,
      'git cat-file -e ' + keyBlob + ' exited ' + catKey.status);
    const showOrigin = gitRaw(['show', 'origin/HEAD:' + keyRel], runDir);
    check(a.kind + ': CRITICAL 3 — `git show origin/HEAD:<key.json>` FAILS (no remote-tracking ref survives)',
      showOrigin.status !== 0 && !/artifacts/.test(showOrigin.stdout || ''), (showOrigin.stdout || '') + (showOrigin.stderr || ''));
    const showCommit = gitRaw(['show', keyCommit + ':' + keyRel], runDir);
    check(a.kind + ': CRITICAL 3 — `git show <the key commit>:<key.json>` FAILS (the object was pruned)',
      showCommit.status !== 0 && !/artifacts/.test(showCommit.stdout || ''), (showCommit.stdout || '') + (showCommit.stderr || ''));
    check(a.kind + ': no dangling `refs/remotes/*/HEAD` symref warning is emitted (that warning is itself a tell)',
      !/dangling symref/i.test(gitRaw(['status', '--short'], runDir).stderr || ''),
      gitRaw(['status', '--short'], runDir).stderr);
  }

  // Both kinds present identically: same ref state, same reachability shape.
  check('CRITICAL 3: seeded and control run clones present IDENTICALLY (both refless)',
    git(['for-each-ref'], path.join(work, 'run', 'sdc-001')) === git(['for-each-ref'], path.join(work, 'run', 'sdc-002')));
}

section('5. build-corpus.js — clone reuse is verified, and a stale materialized.json cannot survive a partial --all');
{
  const repoA = makeSourceRepo();
  const repoB = makeSourceRepo();
  const work = tmpDir('wo12-reuse-');
  const clone = path.join(work, 'clone');
  buildCorpusLib.ensureClone(repoA.dir, clone);
  let threw = null;
  try { buildCorpusLib.ensureClone(repoB.dir, clone); } catch (e) { threw = e; }
  check('MINOR: reusing a --clone-root whose origin is a DIFFERENT repository is refused',
    !!threw && /its `origin` is/.test(threw.message), threw && threw.message);
  // The nesting guard must hold however the SAME directory is spelled. This
  // failed on every macOS and Windows CI runner while passing on Ubuntu and
  // locally, because the destination does not exist yet: `fs.realpathSync`
  // threw on it and the old code fell back to the unresolved path, so the
  // source was compared in the resolved namespace and the child in the
  // unresolved one. macOS reaches os.tmpdir() through `/var -> /private/var`;
  // the Windows runner's TEMP is the 8.3 short name `C:\Users\RUNNER~1\...`.
  // Ubuntu's `/tmp` has nothing to resolve, which is why it never showed.
  //
  // `spellings` collects every alias of repoA.dir this platform can produce,
  // and the guard is asserted for every (source spelling x destination
  // spelling) pair — including the mixed pairs, which are the exact CI shape.
  const spellings = [{ label: 'as given', p: repoA.dir }];
  {
    const realA = fs.realpathSync.native ? fs.realpathSync.native(repoA.dir) : fs.realpathSync(repoA.dir);
    if (realA.toLowerCase() !== repoA.dir.toLowerCase()) spellings.push({ label: 'realpath', p: realA });
  }
  // A symlink/junction alias — the macOS `/var` shape, creatable everywhere.
  {
    const linkDir = tmpDir('wo12-alias-');
    const link = path.join(linkDir, 'aliased-src');
    let made = false;
    try { fs.symlinkSync(repoA.dir, link, 'junction'); made = true; }
    catch (e) {
      try { fs.symlinkSync(repoA.dir, link, 'dir'); made = true; } catch (e2) { made = false; }
    }
    if (made && fs.existsSync(link)) spellings.push({ label: 'symlink/junction alias', p: link });
    check('a symlink/junction alias of the source repo could be created for this check', made, 'links unavailable on this platform/permissions');
  }
  // The Windows 8.3 short name — the `RUNNER~1` shape.
  if (process.platform === 'win32') {
    const r = spawnSync('cmd.exe', ['/d', '/c', 'for %I in ("' + repoA.dir + '") do @echo %~sI'],
      { encoding: 'utf8', windowsVerbatimArguments: true });
    const short = ((r.stdout || '').trim().split(/\r?\n/).pop() || '').trim();
    if (r.status === 0 && short && short.toLowerCase() !== repoA.dir.toLowerCase() && fs.existsSync(short)) {
      spellings.push({ label: '8.3 short name', p: short });
    }
  }
  check('more than one spelling of the source repo is under test on this platform',
    spellings.length >= 2, spellings.map((s) => s.label).join(', '));

  for (const src of spellings) {
    for (const dst of spellings) {
      let nested = null;
      try { buildCorpusLib.ensureClone(src.p, path.join(dst.p, 'inner')); } catch (e) { nested = e; }
      check('a clone nested INSIDE the source repository is refused (source ' + src.label + ' -> destination ' + dst.label + ')',
        !!nested && /INSIDE the source repository/.test(nested.message),
        'src=' + src.p + '\ndst=' + path.join(dst.p, 'inner') + '\n' + (nested ? nested.message : '(NOT REFUSED — a nested clone would have been created)'));
      check('…and no nested clone was created (source ' + src.label + ' -> destination ' + dst.label + ')',
        !fs.existsSync(path.join(dst.p, 'inner')), path.join(dst.p, 'inner'));
    }
  }

  // The same directory, spelled two ways, is not "inside" itself.
  for (const s of spellings) {
    let same = null;
    try { buildCorpusLib.ensureClone(repoA.dir, s.p); } catch (e) { same = e; }
    check('cloning INTO the source repository itself is refused (' + s.label + ')',
      !!same && /INSIDE the source repository/.test(same.message), same && same.message);
  }

  // The helpers, directly: both sides resolve even when the child is absent.
  // Every path below is built with path.join from a REAL directory, never from
  // a hardcoded literal — a `'C:\\A\\Repo'` literal is a single relative
  // segment on POSIX, where `\` is not a separator, which is precisely how the
  // round-3 version of this block passed on Windows and failed on macOS.
  {
    const absent = path.join(repoA.dir, 'does', 'not', 'exist', 'yet');
    const resolvedParent = buildCorpusLib.realResolve(repoA.dir);
    const resolvedAbsent = buildCorpusLib.realResolve(absent);
    check('realResolve resolves a path that does not exist yet, via its nearest existing ancestor',
      buildCorpusLib.isInside(resolvedParent, resolvedAbsent), resolvedParent + ' vs ' + resolvedAbsent);
    check('realResolve keeps the non-existent remainder intact',
      resolvedAbsent.endsWith(path.join('does', 'not', 'exist', 'yet')), resolvedAbsent);

    const holder = path.dirname(repoA.dir);
    const repo = path.join(holder, 'repo');
    check('isInside is false for a sibling whose name merely shares a prefix',
      buildCorpusLib.isInside(repo, path.join(holder, 'repo-backup')) === false);
    check('isInside is false for the same directory', buildCorpusLib.isInside(repo, repo) === false);
    check('isInside is true for a real child', buildCorpusLib.isInside(repo, path.join(repo, 'child')) === true);
    check('isInside does not mistake a directory named "..config" for an escape',
      buildCorpusLib.isInside(repo, path.join(repo, '..config')) === true);
  }

  // Case semantics are decided by an EMPIRICAL probe of the filesystem, not by
  // process.platform: macOS is case-insensitive on default APFS but sensitive
  // on an APFSX volume, and Linux mounts exFAT/NTFS/ciopfs that fold case. The
  // case-variant spelling below is built from a directory that EXISTS, so a
  // case-insensitive filesystem can actually resolve it.
  {
    const parent = path.dirname(repoA.dir);
    const base = path.basename(repoA.dir);
    const variantBase = base === base.toLowerCase() ? base.toUpperCase() : base.toLowerCase();
    check('the source repo\'s basename has letters to case-swap', variantBase !== base, base);
    const variant = path.join(parent, variantBase);
    const variantChild = path.join(variant, 'inner');

    const insensitive = buildCorpusLib.isCaseInsensitiveFs(repoA.dir);
    check('the case-sensitivity probe returns a boolean for this filesystem', typeof insensitive === 'boolean', String(insensitive));
    // Cross-check the probe against the filesystem directly: does the
    // case-variant spelling of an existing directory actually resolve?
    let variantResolves = false;
    try { fs.statSync(variant); variantResolves = true; } catch (e) { variantResolves = false; }
    check('the probe agrees with a direct stat of the case-variant spelling',
      insensitive === variantResolves, 'probe=' + insensitive + ' stat(' + variant + ')=' + variantResolves);

    check('isInside on a case-variant spelling matches the probe, whatever the platform',
      buildCorpusLib.isInside(repoA.dir, variantChild) === insensitive,
      'probe=' + insensitive + ' isInside=' + buildCorpusLib.isInside(repoA.dir, variantChild));
    check('samePath on a case-variant spelling matches the probe',
      buildCorpusLib.samePath(repoA.dir, variant) === insensitive,
      'probe=' + insensitive + ' samePath=' + buildCorpusLib.samePath(repoA.dir, variant));
    check('ensureClone\'s nesting guard follows the probe on a case-variant destination', (() => {
      let threw = null;
      try { buildCorpusLib.ensureClone(repoA.dir, variantChild); } catch (e) { threw = e; }
      const refusedForNesting = !!threw && /INSIDE the source repository/.test(threw.message);
      try { fs.rmSync(variantChild, { recursive: true, force: true }); } catch (e) { /* best effort */ }
      return refusedForNesting === insensitive;
    })(), 'probe=' + insensitive);

    // Both simulated filesystems, via the env overrides. The override is
    // consulted before the cache, so no flush is needed between modes.
    const withEnv = (name, value, fn) => {
      const old = process.env[name];
      process.env[name] = value;
      try { return fn(); } finally { if (old === undefined) delete process.env[name]; else process.env[name] = old; }
    };
    withEnv('WO12_FORCE_CASE_SENSITIVE', '1', () => {
      check('SIMULATED case-SENSITIVE fs: a case-variant spelling is NOT inside',
        buildCorpusLib.isInside(repoA.dir, variantChild) === false);
      check('SIMULATED case-SENSITIVE fs: samePath distinguishes the two spellings',
        buildCorpusLib.samePath(repoA.dir, variant) === false);
      check('SIMULATED case-SENSITIVE fs: an exact-case child is still inside',
        buildCorpusLib.isInside(repoA.dir, path.join(repoA.dir, 'inner')) === true);
    });
    withEnv('WO12_FORCE_CASE_INSENSITIVE', '1', () => {
      check('SIMULATED case-INSENSITIVE fs: a case-variant spelling IS inside',
        buildCorpusLib.isInside(repoA.dir, variantChild) === true);
      check('SIMULATED case-INSENSITIVE fs: samePath folds the two spellings',
        buildCorpusLib.samePath(repoA.dir, variant) === true);
      check('SIMULATED case-INSENSITIVE fs: a genuinely different sibling is still outside',
        buildCorpusLib.isInside(repoA.dir, path.join(parent, base + '-other', 'inner')) === false);
    });
    check('the override is consulted before the cache, so the natural probe is unchanged afterwards',
      buildCorpusLib.isCaseInsensitiveFs(repoA.dir) === insensitive);
  }

  // The probe itself, on inputs whose answer is known independently.
  {
    check('swapCase toggles letters and leaves everything else alone',
      buildCorpusLib.swapCase('Wo12-Src_9') === 'wO12-sRC_9', buildCorpusLib.swapCase('Wo12-Src_9'));
    check('nearestExistingDir walks up to a directory that exists',
      buildCorpusLib.nearestExistingDir(path.join(repoA.dir, 'a', 'b', 'c')) === buildCorpusLib.nearestExistingDir(repoA.dir),
      buildCorpusLib.nearestExistingDir(path.join(repoA.dir, 'a', 'b', 'c')));
    check('nearestExistingDir on an existing directory returns it', buildCorpusLib.nearestExistingDir(repoA.dir) === path.resolve(repoA.dir));
    // A directory whose real casing we control, checked against a direct stat.
    const probeRoot = tmpDir('wo12-CaseProbe-');
    const mixed = path.join(probeRoot, 'MiXeDcAsE');
    fs.mkdirSync(mixed);
    let lowerResolves = false;
    try { fs.statSync(path.join(probeRoot, 'mixedcase')); lowerResolves = true; } catch (e) { lowerResolves = false; }
    buildCorpusLib.resetCaseProbeCache();
    check('the probe on a freshly created mixed-case directory matches a direct stat',
      buildCorpusLib.isCaseInsensitiveFs(mixed) === lowerResolves,
      'probe=' + buildCorpusLib.isCaseInsensitiveFs(mixed) + ' stat(lowercased)=' + lowerResolves);
    buildCorpusLib.resetCaseProbeCache();
  }

  // --all: a stale materialized.json must not outlive a failing run.
  const work2 = tmpDir('wo12-all-');
  const stale = path.join(work2, 'materialized.json');
  fs.writeFileSync(stale, '[{"id":"STALE"}]\n', 'utf8');
  const keyPath = writeKey(work2, [
    { id: 'sdc-001', kind: 'control', phase: 0, variant: 'V1', base: repoA.base, commit: repoA.commit, subject: REAL_SUBJECT, seed: null },
    { id: 'sdc-002', kind: 'seeded', phase: 0, variant: 'V1', base: repoA.base, commit: repoA.commit, subject: REAL_SUBJECT, seed: null },
  ]);
  const r = spawnSync(process.execPath, [BUILD_CORPUS, '--all', '--key', keyPath, '--corpus-dir', work2,
    '--patches-dir', work2, '--source-repo', repoA.dir, '--clone-root', path.join(work2, 'clone')], { encoding: 'utf8' });
  check('--all fails closed when a seeded artifact has no patch', r.status !== 0, r.stderr);
  check('MINOR: the stale materialized.json is GONE after a partial --all, not left misleading the next reader',
    !fs.existsSync(stale), 'still present: ' + (fs.existsSync(stale) ? fs.readFileSync(stale, 'utf8') : ''));
}

// ==================================================================== run-lane

section('6. run-lane.js — CRITICAL 1: the P0 gate FAILS CLOSED on every non-positive signal');
{
  const repo = makeSourceRepo();
  const corpus = miniLaneCorpus(repo);
  const stubs = tmpDir('wo12-qm-');
  const baseArgs = [
    '--lane', 'X-Terra', '--phase', '0', '--yes',
    '--key', corpus.keyPath, '--briefs-dir', corpus.briefs, '--patches-dir', corpus.dir,
    '--source-repo', repo.dir, '--results-dir', corpus.dir,
    '--runner', path.join(stubs, 'never-invoked.js'),
  ];
  fs.writeFileSync(path.join(stubs, 'never-invoked.js'), 'throw new Error("the runner must never be reached in a refusal test");\n');

  function expectRefusal(label, qmCmd, finding, extraArgs) {
    const r = runLane(baseArgs.concat(extraArgs || []), { WO12_QM_CMD: qmCmd });
    check(label + ' → REFUSED', r.status !== 0, 'status=' + r.status + '\n' + (r.stdout || '').slice(-500));
    check(label + ' → the refusal names the P0 gate and quotes the quartermaster output',
      /P0 gate/.test(r.stderr || '') && /quartermaster --state \(verbatim\)/.test(r.stdout || ''),
      (r.stderr || '') + '\n---\n' + (r.stdout || '').slice(0, 600));
    if (finding) check(label + ' → ' + finding, true);
    return r;
  }

  // (a) the quartermaster could not even be loaded — the round-1 gate printed
  // the stack trace and BILLED THE REVIEW.
  expectRefusal('CRITICAL 1(a) MODULE_NOT_FOUND quartermaster',
    q(process.execPath) + ' ' + q(path.join(stubs, 'does-not-exist.js')));

  // (b) exit 0 with output that is not the state JSON.
  writeStub(stubs, 'garbage.js', 'process.stdout.write("everything is fine, honest\\n");\n');
  expectRefusal('CRITICAL 1(b) exit 0 with unparseable output',
    q(process.execPath) + ' ' + q(path.join(stubs, 'garbage.js')));

  // (c) non-zero exit — including the round-1 "REFUSED for some OTHER bucket"
  // wording, which the round-1 gate read as OU-clear.
  writeStub(stubs, 'refused-au.js',
    'process.stderr.write("quartermaster: bucket state FAILS CLOSED\\n\\nREFUSED for AU-opus: no recorded reading.\\n");\nprocess.exit(1);\n');
  expectRefusal('CRITICAL 1(c) non-zero exit refusing a DIFFERENT bucket (round-1 read this as OU-clear)',
    q(process.execPath) + ' ' + q(path.join(stubs, 'refused-au.js')));

  writeStub(stubs, 'refused-ou.js',
    'process.stderr.write("REFUSED for OU: no recorded reading.\\n");\nprocess.exit(1);\n');
  expectRefusal('CRITICAL 1(c2) non-zero exit refusing OU itself',
    q(process.execPath) + ' ' + q(path.join(stubs, 'refused-ou.js')));

  // (d) exit 0, valid JSON, but no OU bucket.
  qmStubJson(stubs, 'no-ou.js', { 'AU-opus': { state: { remainingFraction: 0.9 }, belowReserve: false } });
  expectRefusal('CRITICAL 1(d) exit 0 with valid JSON carrying NO OU bucket',
    q(process.execPath) + ' ' + q(path.join(stubs, 'no-ou.js')));

  // (e) OU present but its remainingFraction is not a number.
  qmStubJson(stubs, 'bad-fraction.js', ouState('lots'));
  expectRefusal('CRITICAL 1(e) OU.state.remainingFraction is not a number in [0,1]',
    q(process.execPath) + ' ' + q(path.join(stubs, 'bad-fraction.js')));

  // (f) Amber (below the 40% ladder threshold) with NO live confirmation.
  qmStubJson(stubs, 'amber.js', ouState(0.30));
  const rAmber = expectRefusal('CRITICAL 1(f) OU Amber with no owner confirmation (§2.6 Amber arm)',
    q(process.execPath) + ' ' + q(path.join(stubs, 'amber.js')));
  check('the Amber refusal names the confirmation §2.6 requires',
    /quartermasterConfirmation/.test(rAmber.stderr || '') && /Amber requires the owner/.test(rAmber.stderr || ''), rAmber.stderr);

  // (g) Orange / Red / Exhausted.
  qmStubJson(stubs, 'orange.js', ouState(0.12));
  expectRefusal('CRITICAL 1(g) OU Orange', q(process.execPath) + ' ' + q(path.join(stubs, 'orange.js')));
  qmStubJson(stubs, 'exhausted.js', ouState(0.0, { state: { remainingFraction: 0, exhausted: true } }));
  expectRefusal('CRITICAL 1(g2) OU Exhausted', q(process.execPath) + ' ' + q(path.join(stubs, 'exhausted.js')));
  qmStubJson(stubs, 'throttled.js', { OU: { state: { remainingFraction: 0.85, throttleObserved: true }, belowReserve: false } });
  expectRefusal('CRITICAL 1(g3) OU Green fraction but a throttle observed (the router classifies that Red)',
    q(process.execPath) + ' ' + q(path.join(stubs, 'throttled.js')));

  // (h) THE POSITIVE PATHS. Green, and Amber+confirmation, must get PAST the
  // P0 gate — and then stop on --yes, which proves the gate itself passed.
  qmStubJson(stubs, 'green.js', ouState(0.85));
  const noYes = baseArgs.filter((a) => a !== '--yes');
  const rGreen = runLane(noYes, { WO12_QM_CMD: q(process.execPath) + ' ' + q(path.join(stubs, 'green.js')) });
  check('CRITICAL 1(h) OU Green PASSES the P0 gate (the refusal is about --yes, not P0)',
    rGreen.status !== 0 && /bill real OpenAI allowance/i.test(rGreen.stderr || '') && !/P0 gate/.test(rGreen.stderr || ''),
    rGreen.stderr);
  check('the Green run reports OU\'s ladder state on stdout', /P0: OU Green/.test(rGreen.stdout || ''), (rGreen.stdout || '').slice(-400));

  qmStubJson(stubs, 'amber-confirmed.js', ouState(0.30, { quartermasterConfirmation: true }));
  const rAmberOk = runLane(noYes, { WO12_QM_CMD: q(process.execPath) + ' ' + q(path.join(stubs, 'amber-confirmed.js')) });
  check('CRITICAL 1(h2) OU Amber WITH a live quartermasterConfirmation passes the P0 gate',
    rAmberOk.status !== 0 && /bill real OpenAI allowance/i.test(rAmberOk.stderr || '') && !/P0 gate/.test(rAmberOk.stderr || ''),
    rAmberOk.stderr);
  check('the confirmed-Amber run says the owner confirmation is live',
    /owner confirmation live/.test(rAmberOk.stdout || ''), (rAmberOk.stdout || '').slice(-400));
}

section('7. run-lane.js — §2.6 projected-draw check (MAJOR 11)');
{
  const repo = makeSourceRepo();
  const corpus = miniLaneCorpus(repo, 1);
  const stubs = tmpDir('wo12-draw-');
  const green = qmStubJson(stubs, 'green.js', ouState(0.85));
  const greenWithReserve = qmStubJson(stubs, 'green-reserve.js',
    Object.assign({ requiredReserve: 0.08 }, ouState(0.85)));
  const tightReserve = qmStubJson(stubs, 'tight.js',
    Object.assign({ requiredReserve: 0.5 }, ouState(0.55)));
  const args = (extra) => [
    '--lane', 'X-Terra', '--phase', '1',
    '--key', corpus.keyPath, '--briefs-dir', corpus.briefs, '--patches-dir', corpus.dir,
    '--source-repo', repo.dir, '--results-dir', corpus.dir, '--runner', path.join(stubs, 'nope.js'),
  ].concat(extra || []);

  const rNoDraw = runLane(args(), { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('MAJOR 11: phase 1 WITHOUT --draw-per-review is refused', rNoDraw.status !== 0 && /--draw-per-review .* is REQUIRED for phase 1/.test(rNoDraw.stderr || ''), rNoDraw.stderr);

  const rNoReserve = runLane(args(['--draw-per-review', '0.001']), { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('phase 1 with a draw but NO requiredReserve in the state JSON is refused, and says exactly why',
    rNoReserve.status !== 0 && /carries no `requiredReserve` figure/.test(rNoReserve.stderr || ''), rNoReserve.stderr);

  const rBreach = runLane(args(['--draw-per-review', '0.05']), { WO12_QM_CMD: q(process.execPath) + ' ' + q(tightReserve) });
  check('MAJOR 11: a projected draw that would breach the reserve is refused',
    rBreach.status !== 0 && /projected draw breaches the reserve/.test(rBreach.stderr || ''), rBreach.stderr);

  const rOk = runLane(args(['--draw-per-review', '0.001']), { WO12_QM_CMD: q(process.execPath) + ' ' + q(greenWithReserve) });
  check('a projected draw that stays above the reserve passes the P0 gate (stops on --yes instead)',
    rOk.status !== 0 && /bill real OpenAI allowance/i.test(rOk.stderr || '') && !/P0 gate/.test(rOk.stderr || ''), rOk.stderr);
  check('the passing run prints the projected remaining fraction', /projected remaining/.test(rOk.stdout || ''), (rOk.stdout || '').slice(-400));

  // Phase 0 measures the draw, so it must NOT require the flag.
  const corpus0 = miniLaneCorpus(repo, 0);
  const r0 = runLane([
    '--lane', 'X-Terra', '--phase', '0',
    '--key', corpus0.keyPath, '--briefs-dir', corpus0.briefs, '--patches-dir', corpus0.dir,
    '--source-repo', repo.dir, '--results-dir', corpus0.dir, '--runner', path.join(stubs, 'nope.js'),
  ], { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('phase 0 does NOT require --draw-per-review (it is the run that measures it)',
    r0.status !== 0 && /bill real OpenAI allowance/i.test(r0.stderr || '') && !/draw-per-review/.test(r0.stderr || ''), r0.stderr);

  // Unit: the two arithmetic branches.
  const qm = { remainingFraction: 0.5, requiredReserve: 0.2 };
  const tight = runLaneLib.checkProjectedDraw(qm, 1, 24, 0.01, 2);
  check('checkProjectedDraw: 0.5 − 48×0.01 = 0.02 < 0.2 → refuses', tight.ok === false && /breaches the reserve/.test(tight.refusal));
  const loose = runLaneLib.checkProjectedDraw(qm, 1, 24, 0.001, 2);
  check('checkProjectedDraw: 0.5 − 48×0.001 = 0.452 ≥ 0.2 → proceeds', loose.ok === true && Math.abs(loose.projectedRemaining - 0.452) < 1e-9, JSON.stringify(loose));
  check('checkProjectedDraw counts the WHOLE PHASE across both X-lanes (24 artifacts × 2 = 48 reviews)',
    loose.projectedReviews === 48, String(loose.projectedReviews));
}

section('8. run-lane.js — --override-p0 is loud, ledgered, and stamped (MINOR 8)');
{
  const repo = makeSourceRepo();
  const corpus = miniLaneCorpus(repo);
  const stubs = tmpDir('wo12-override-');
  const runner = writeStub(stubs, 'stub-runner.js',
    'process.stdout.write("REVIEW ENGINE: codex model: gpt-5.6-terra\\n\\nVERDICT: APPROVE\\n\\nFINDINGS\\n- none\\n");\n');
  const refused = writeStub(stubs, 'refused.js', 'process.stderr.write("REFUSED for OU: no recorded reading.\\n");\nprocess.exit(1);\n');
  // The ledger follows --results-dir, so it lands in this test's own temp
  // directory and the repository is never touched. Round-5 incident: it used to
  // be written to a FIXED path inside the repo (`wo12/p0-overrides.log`), and
  // this check's save/restore lived in `process.on('exit')` — which does not
  // run when the suite is killed by a SIGTERM from `timeout`. An interrupted
  // run therefore left an untracked file in the live tree. No save/restore is
  // needed now: nothing outside the temp dir is written in the first place.
  const overrideLog = path.join(corpus.dir, runLaneLib.OVERRIDE_LOG_BASENAME);
  const repoOverrideLog = path.join(WO12, runLaneLib.OVERRIDE_LOG_BASENAME);
  const repoLogBefore = fs.existsSync(repoOverrideLog);

  const r = runLane([
    '--lane', 'X-Terra', '--phase', '0', '--yes', '--override-p0', 'owner: OU reading recorded manually, see /status',
    '--key', corpus.keyPath, '--briefs-dir', corpus.briefs, '--patches-dir', corpus.dir,
    '--source-repo', repo.dir, '--results-dir', corpus.dir,
    '--clone-root', path.join(corpus.dir, 'clone'), '--run-clone-root', path.join(corpus.dir, 'run'),
    '--runner', runner,
  ], { WO12_QM_CMD: q(process.execPath) + ' ' + q(refused) });

  check('an overridden run completes', r.status === 0, (r.stderr || '') + '\n' + (r.stdout || '').slice(-800));
  check('MINOR 8(a): the override prints a LOUD banner', /P0 GATE OVERRIDDEN — OWNER USE ONLY/.test(r.stdout || ''), (r.stdout || '').slice(0, 1500));
  check('the banner quotes what the gate actually said', /the gate said:/.test(r.stdout || ''), (r.stdout || '').slice(0, 1500));
  check('MINOR 8(b): the override is appended to <results-dir>/p0-overrides.log', fs.existsSync(overrideLog), overrideLog);
  check('round-5 incident: the ledger is NOT written to the repository\'s wo12/ directory',
    fs.existsSync(repoOverrideLog) === repoLogBefore, repoOverrideLog + ' appeared during this check');
  check('the run reports where it ledgered, and it is the temp dir', (() => {
    const m = /ledgered in (.+)/.exec(r.stdout || '');
    return !!m && path.resolve(m[1].trim()) === path.resolve(overrideLog);
  })(), (r.stdout || '').slice(0, 1500));

  // --override-log names the ledger outright.
  {
    const corpus2 = miniLaneCorpus(repo);
    const explicit = path.join(corpus2.dir, 'nested', 'ledger.log');
    const r2 = runLane([
      '--lane', 'X-Terra', '--phase', '0', '--yes', '--override-p0', 'owner: explicit ledger path',
      '--key', corpus2.keyPath, '--briefs-dir', corpus2.briefs, '--patches-dir', corpus2.dir,
      '--source-repo', repo.dir, '--results-dir', corpus2.dir, '--override-log', explicit,
      '--clone-root', path.join(corpus2.dir, 'clone'), '--run-clone-root', path.join(corpus2.dir, 'run'),
      '--runner', runner,
    ], { WO12_QM_CMD: q(process.execPath) + ' ' + q(refused) });
    check('--override-log writes the ledger exactly where it is told', r2.status === 0 && fs.existsSync(explicit),
      (r2.stderr || '') + ' | ' + explicit);
    check('…creating intermediate directories', fs.existsSync(path.dirname(explicit)));
  }
  if (fs.existsSync(overrideLog)) {
    const lines = fs.readFileSync(overrideLog, 'utf8').trim().split('\n').filter(Boolean);
    let last = null;
    try { last = JSON.parse(lines[lines.length - 1]); } catch (e) { /* reported */ }
    check('the ledger line carries the reason, a timestamp, the lane and the phase',
      !!last && /OU reading recorded manually/.test(last.reason) && !!last.at && last.lane === 'X-Terra' && last.phase === 0,
      JSON.stringify(last));
  }
  const resultsFile = path.join(corpus.dir, 'results-X-Terra-phase0.json');
  check('the results file was written', fs.existsSync(resultsFile), resultsFile);
  if (fs.existsSync(resultsFile)) {
    const recs = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    check('MINOR 8(c): every results record carries the p0Override reason and timestamp',
      recs.length === 1 && !!recs[0].p0Override && /OU reading recorded manually/.test(recs[0].p0Override.reason) && !!recs[0].p0Override.at,
      JSON.stringify(recs[0] && recs[0].p0Override));
    check('the record carries the lane\'s EXPECTED model, for score.js\'s identity gate',
      recs[0].expectedModel === 'gpt-5.6-terra', JSON.stringify(recs[0].expectedModel));
  }

  // The runner's cwd must have been a SANITIZED clone, not the build clone.
  const runClone = path.join(corpus.dir, 'run', 'sdc-001');
  check('CRITICAL 3: run-lane pointed the runner at the SANITIZED clone', fs.existsSync(path.join(runClone, '.git')), runClone);
  if (fs.existsSync(path.join(runClone, '.git'))) {
    check('CRITICAL 3: that clone has no refs at all', git(['for-each-ref'], runClone) === '', git(['for-each-ref'], runClone));
  }
  check('the build clone (which still has refs) was NOT the runner\'s cwd',
    git(['for-each-ref'], path.join(corpus.dir, 'clone')) !== '', 'build clone unexpectedly refless');
}

section('9. run-lane.js — --dry-run, empty phase, and the inert-override note');
{
  const repo = makeSourceRepo();
  const corpus = miniLaneCorpus(repo);
  const common = ['--phase', '0', '--dry-run', '--key', corpus.keyPath, '--briefs-dir', corpus.briefs,
    '--source-repo', repo.dir, '--results-dir', corpus.dir, '--runner', path.join(corpus.dir, 'x.js')];
  const rSol = runLane(['--lane', 'X-Sol'].concat(common));
  check('X-Sol dry-run exits 0', rSol.status === 0, rSol.stderr);
  check('X-Sol dry-run names the right model', /ORCHESTRA_REVIEW_MODEL=gpt-5\.6-sol\b/.test(rSol.stdout || ''), rSol.stdout);
  check('X-Sol dry-run names the right effort args', /model_reasoning_effort=high/.test(rSol.stdout || ''), rSol.stdout);
  check('X-Sol dry-run never invokes the Quartermaster gate', !/quartermaster --state/i.test(rSol.stdout || ''), rSol.stdout);
  check('dry-run says the runner\'s cwd is a SANITIZED clone', /sanitized run clone/.test(rSol.stdout || ''), rSol.stdout);

  const rTerra = runLane(['--lane', 'X-Terra'].concat(common));
  check('X-Terra dry-run names the right model', /ORCHESTRA_REVIEW_MODEL=gpt-5\.6-terra\b/.test(rTerra.stdout || ''), rTerra.stdout);
  check('X-Terra dry-run names the right effort args', /model_reasoning_effort=medium/.test(rTerra.stdout || ''), rTerra.stdout);

  const rOverride = runLane(['--lane', 'X-Sol', '--override-p0', 'x'].concat(common));
  check('MINOR 8(d): --dry-run says --override-p0 is INERT rather than accepting it silently',
    /--override-p0 is INERT under --dry-run/.test(rOverride.stdout || ''), rOverride.stdout);

  const rEmpty = runLane(['--lane', 'X-Sol', '--phase', '3', '--dry-run', '--key', corpus.keyPath,
    '--briefs-dir', corpus.briefs, '--source-repo', repo.dir, '--runner', path.join(corpus.dir, 'x.js')]);
  check('refuses cleanly on an empty phase selection', rEmpty.status !== 0, 'status=' + rEmpty.status);

  // NIT: a seeded dry-run prints commands an owner can actually re-run.
  const seededCorpus = (() => {
    const dir = tmpDir('wo12-dryseed-');
    const briefs = path.join(dir, 'briefs');
    fs.mkdirSync(briefs, { recursive: true });
    fs.writeFileSync(path.join(briefs, 'sdc-001.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, 'sdc-001.er.txt'), 'er\n');
    return { dir, briefs, keyPath: writeKey(dir, [{ id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null }]) };
  })();
  const rSeed = runLane(['--lane', 'X-Sol', '--phase', '0', '--dry-run', '--key', seededCorpus.keyPath,
    '--briefs-dir', seededCorpus.briefs, '--source-repo', repo.dir, '--runner', path.join(seededCorpus.dir, 'x.js')]);
  check('NIT: a seeded dry-run prints the build-corpus command that produces the head, not an unusable placeholder',
    /build-corpus\.js.*--id sdc-001/.test(rSeed.stdout || '') && !/materialized at run time/.test(rSeed.stdout || ''), rSeed.stdout);
}

section('10. run-lane.js — appendResult durability (MAJOR 2)');
{
  const dir = tmpDir('wo12-append-');
  const f = path.join(dir, 'results-X-Terra-phase0.json');
  check('appendResult writes the first record', runLaneLib.appendResult(f, { id: 'a' }) === 1);
  check('appendResult appends the second', runLaneLib.appendResult(f, { id: 'b' }) === 2);
  check('no .tmp file is left behind (temp + atomic rename)', !fs.existsSync(f + '.tmp'));

  // A crash mid-write leaves a truncated file. The round-1 code reset it to []
  // and silently destroyed every prior billed review.
  const good = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, good.slice(0, Math.floor(good.length / 2)), 'utf8');
  let threw = null;
  try { runLaneLib.appendResult(f, { id: 'c' }); } catch (e) { threw = e; }
  check('MAJOR 2: appendResult REFUSES on a corrupt existing results file', !!threw && threw.wo12ResultsCorrupt === true, threw && threw.message);
  check('MAJOR 2: the corrupt file is NOT overwritten', fs.readFileSync(f, 'utf8') === good.slice(0, Math.floor(good.length / 2)));
  const sideFiles = fs.readdirSync(dir).filter((n) => n.indexOf('.corrupt-') !== -1);
  check('MAJOR 2: a copy is side-filed so the evidence is not lost', sideFiles.length === 1, sideFiles.join(', '));
  check('the refusal explains that the file records already-billed reviews',
    !!threw && /already billed/.test(threw.message), threw && threw.message);
}

section('11. run-lane.js — verdict classification and engine-header extraction (MAJOR 1, MAJOR 10)');
{
  const c = runLaneLib.classifyVerdict;
  check('MAJOR 10: "REVIEW_UNAVAILABLE" is UNAVAILABLE', c('REVIEW_UNAVAILABLE') === 'UNAVAILABLE');
  check('MAJOR 10: a bare leading "UNAVAILABLE" is UNAVAILABLE', c('UNAVAILABLE — engine down') === 'UNAVAILABLE');
  check('MAJOR 10: "APPROVE — the cache path is correct when the engine is unavailable" is COMPLETED, not UNAVAILABLE',
    c('APPROVE — the cache path is correct when the engine is unavailable') === 'COMPLETED');
  check('MAJOR 10: "REVISE — the retry is unavailable on Windows" is COMPLETED', c('REVISE — the retry is unavailable on Windows') === 'COMPLETED');
  check('plain APPROVE is COMPLETED', c('APPROVE') === 'COMPLETED');

  const e = runLaneLib.extractEngineHeader;
  check('a real REVIEW ENGINE header is extracted', e('REVIEW ENGINE: codex model: gpt-5.6-terra\nVERDICT: APPROVE') === 'REVIEW ENGINE: codex model: gpt-5.6-terra');
  check('MAJOR 1: reviewer PROSE containing "model:" mid-line does NOT fabricate an identity',
    e('VERDICT: REVISE\n\nFINDINGS\n- the config sets model: gpt-4 in a comment, which is stale\n') === null,
    JSON.stringify(e('VERDICT: REVISE\n\nFINDINGS\n- the config sets model: gpt-4 in a comment, which is stale\n')));
  check('an anchored `model:` FIELD line is still accepted as a fallback',
    e('served_model: gpt-5.6-sol\nVERDICT: APPROVE') === 'served_model: gpt-5.6-sol');
  check('no header at all yields null', e('VERDICT: APPROVE\n') === null);
}

section('12. run-lane.js — INTEGRITY WARNING is read across BOTH streams (MAJOR 9)');
{
  const dir = tmpDir('wo12-integrity-');
  const onStderr = writeStub(dir, 'stderr-warn.js',
    'process.stderr.write("INTEGRITY WARNING: the tree under review was modified\\n");\nprocess.stdout.write("VERDICT: APPROVE\\n");\n');
  const clean = writeStub(dir, 'clean.js', 'process.stdout.write("VERDICT: APPROVE\\n");\n');
  const lane = { model: 'gpt-5.6-terra', args: '-c model_reasoning_effort=medium' };
  const a = runLaneLib.runOneAttempt(onStderr, 'wo', 'er', 'base', 'head', dir, 5000, lane);
  check('MAJOR 9: an INTEGRITY WARNING on STDERR sets integrityWarning', a.integrityWarning === true, JSON.stringify(a));
  check('the stderr text is still preserved verbatim in the record', /INTEGRITY WARNING/.test(a.stdout), a.stdout);
  const b = runLaneLib.runOneAttempt(clean, 'wo', 'er', 'base', 'head', dir, 5000, lane);
  check('a clean run does not set integrityWarning', b.integrityWarning === false, JSON.stringify(b));
}

section('13. run-lane.js — §2.6 phase-0 stop condition (MAJOR 11)');
{
  const repo = makeSourceRepo();
  const dir = tmpDir('wo12-stop-');
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [];
  for (let i = 1; i <= 5; i++) {
    const id = 'sdc-00' + i;
    artifacts.push({ id, kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  const keyPath = writeKey(dir, artifacts);
  const stubs = tmpDir('wo12-stopstub-');
  const runner = writeStub(stubs, 'unavailable.js', 'process.stdout.write("VERDICT: REVIEW_UNAVAILABLE\\n");\n');
  const green = qmStubJson(stubs, 'green.js', ouState(0.85));
  const r = runLane([
    '--lane', 'X-Terra', '--phase', '0', '--yes',
    '--key', keyPath, '--briefs-dir', briefs, '--patches-dir', dir, '--source-repo', repo.dir,
    '--results-dir', dir, '--clone-root', path.join(dir, 'clone'), '--run-clone-root', path.join(dir, 'run'),
    '--runner', runner,
  ], { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('MAJOR 11: phase 0 HALTS once UNAVAILABLE exceeds 2', r.status !== 0 && /HALTING phase 0/.test(r.stderr || ''), (r.stderr || '') + (r.stdout || '').slice(-400));
  check('the halt names the §2.6 stop condition and the escalation', /2\.6 stop condition/.test(r.stderr || '') && /Escalate the fault/.test(r.stderr || ''), r.stderr);
  const resultsFile = path.join(dir, 'results-X-Terra-phase0.json');
  if (fs.existsSync(resultsFile)) {
    const recs = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    check('the artifacts already run before the halt ARE recorded (never re-billed)', recs.length === 3, 'recorded ' + recs.length);
    check('each UNAVAILABLE artifact was retried exactly once (§2.5 Stability)', recs.every((x) => x.attempts.length === 2), JSON.stringify(recs.map((x) => x.attempts.length)));
  } else {
    check('the results file exists after the halt', false, resultsFile);
  }
}

// ======================================================================= score

section('14. score.js — hit logic: file+line, ±3 tolerance boundaries, severity floor (MAJOR 7)');
{
  const seed = { locator: { file: 'quartermaster/quartermaster.js', lines: [100, 110], symbol: 'analyze' } };
  const hit = scoreLib.evaluateSeedHit(seed, ['[MAJOR] quartermaster/quartermaster.js:105 — bad'], {});
  check('an exact in-range TAGGED citation is a hit', hit.hit === true && hit.via === 'line', JSON.stringify(hit));
  check('a citation exactly at the +3 boundary (113) is a hit',
    scoreLib.evaluateSeedHit(seed, ['[MAJOR] quartermaster/quartermaster.js:113 — bad'], {}).hit === true);
  check('a citation one past the +3 boundary (114) is a miss',
    scoreLib.evaluateSeedHit(seed, ['[MAJOR] quartermaster/quartermaster.js:114 — bad'], {}).hit === false);
  check('a citation exactly at the -3 boundary (97) is a hit',
    scoreLib.evaluateSeedHit(seed, ['[MAJOR] quartermaster/quartermaster.js:97 — bad'], {}).hit === true);
  check('a citation to a DIFFERENT file is a miss',
    scoreLib.evaluateSeedHit(seed, ['[MAJOR] router/router.js:105 — bad'], {}).hit === false);
  check('a symbol named with no file citation at all is a miss',
    scoreLib.evaluateSeedHit(seed, ['[MAJOR] analyze() is wrong somewhere'], {}).hit === false);
  const symbolHit = scoreLib.evaluateSeedHit(seed, ['[CRITICAL] quartermaster/quartermaster.js:900 — analyze() re-validates nothing'], {});
  check('a far-off line citation still hits via the symbol name', symbolHit.hit === true && symbolHit.via === 'symbol', JSON.stringify(symbolHit));

  // MAJOR 7: the severity floor.
  const untagged = scoreLib.evaluateSeedHit(seed, ['quartermaster/quartermaster.js:105 something odd here'], {});
  check('MAJOR 7: an UNTAGGED block is NOT a hit (§2.5\'s "severity ≥ MINOR" floor)', untagged.hit === false, JSON.stringify(untagged));
  check('MAJOR 7: the untagged block is reported as a near miss with reason "severity", not lost',
    untagged.nearMisses.length === 1 && untagged.nearMisses[0].reason === 'severity', JSON.stringify(untagged.nearMisses));
  check('a MINOR tag is enough to clear the floor',
    scoreLib.evaluateSeedHit(seed, ['[MINOR] quartermaster/quartermaster.js:105 — small'], {}).hit === true);
  check('"- none" produces zero finding blocks', scoreLib.splitFindingBlocks('- none').length === 0);
}

section('15. score.js — strict paths are the DEFAULT; basename-only is a near miss (MAJOR 6)');
{
  const seed = { locator: { file: 'quartermaster/quartermaster.js', lines: [556, 559], symbol: 'analyze' } };
  const crossFile = ['[MAJOR] tests/quartermaster.js:557 — an unrelated test file, same basename'];
  const strict = scoreLib.evaluateSeedHit(seed, crossFile, {});
  check('MAJOR 6: by DEFAULT, a different file with the same basename is NOT a hit', strict.hit === false, JSON.stringify(strict));
  check('MAJOR 6: it is reported as a basename-only NEAR MISS instead',
    strict.nearMisses.length === 1 && strict.nearMisses[0].reason === 'path' && strict.nearMisses[0].pathMatchKind === 'basename-only',
    JSON.stringify(strict.nearMisses));
  const lenient = scoreLib.evaluateSeedHit(seed, crossFile, { lenientPaths: true });
  check('--lenient-paths restores the round-1 behaviour, opt-in', lenient.hit === true && lenient.pathMatchKind === 'basename-only', JSON.stringify(lenient));
  const bare = scoreLib.evaluateSeedHit(seed, ['[MAJOR] `quartermaster.js` lines 556-559 — bare filename'], {});
  check('a bare filename with no path is likewise not a hit by default', bare.hit === false, JSON.stringify(bare));
  check('classifyFileMatch still labels the two tiers correctly',
    scoreLib.classifyFileMatch('quartermaster/quartermaster.js', 'quartermaster/quartermaster.js') === 'exact-path' &&
    scoreLib.classifyFileMatch('quartermaster.js', 'quartermaster/quartermaster.js') === 'basename-only' &&
    scoreLib.classifyFileMatch('router/router.js', 'quartermaster/quartermaster.js') === null);
  check('a relative-vs-repo-root path suffix is still an exact-path match',
    scoreLib.classifyFileMatch('./quartermaster/quartermaster.js', 'quartermaster/quartermaster.js') === 'exact-path');
  check('parseArgs: --lenient-paths is off by default', scoreLib.parseArgs([]).lenientPaths === false);
  check('parseArgs: --lenient-paths turns it on', scoreLib.parseArgs(['--lenient-paths']).lenientPaths === true);
}

section('16. score.js — findings-section parsing accepts markdown headers (MINOR 1)');
{
  const md = '## FINDINGS\n\n- [CRITICAL] quartermaster/quartermaster.js:557 — analyze() re-validates nothing\n\n## CLAIMS CHECKED\n- "x" → CONFIRMED\n';
  const section1 = scoreLib.extractFindingsSection(md);
  check('MINOR 1: a `## FINDINGS` header is recognized', /CRITICAL/.test(section1), JSON.stringify(section1));
  check('MINOR 1: a `## CLAIMS CHECKED` terminator ends the section', !/CONFIRMED/.test(section1), JSON.stringify(section1));
  const bare = scoreLib.extractFindingsSection('FINDINGS\n- [MAJOR] a/b.js:5 — x\n\nNITS\n- y\n');
  check('the runner\'s own BARE headers still work', /MAJOR/.test(bare) && !/- y/.test(bare), JSON.stringify(bare));
  check('a verdict with no FINDINGS section at all yields empty', scoreLib.extractFindingsSection('VERDICT: APPROVE\n') === '');
}

section('17. score.js — liberal citation parsing and Wilson anchors');
{
  const cites = scoreLib.parseCitations('[MAJOR] `router/router.js` at lines 120-130 — and also verifier/checkout.js:44');
  check('backticked "path ... lines N-M" is parsed', cites.some((c) => c.file === 'router/router.js' && c.lineStart === 120 && c.lineEnd === 130), JSON.stringify(cites));
  check('plain path:line is parsed', cites.some((c) => c.file === 'verifier/checkout.js' && c.lineStart === 44), JSON.stringify(cites));
  check('NIT: the proximity window is a named constant, not a magic number', scoreLib.PROXIMITY_WINDOW === 80, String(scoreLib.PROXIMITY_WINDOW));

  function pctRange(w) { return (w.lo * 100).toFixed(2) + '-' + (w.hi * 100).toFixed(2); }
  const anchors = [
    ['20/20', scoreLib.wilson(20, 20), 83.89, 100],
    ['19/20', scoreLib.wilson(19, 20), 76.39, 99.11],
    ['18/20', scoreLib.wilson(18, 20), 69.90, 97.21],
    ['12/12', scoreLib.wilson(12, 12), 75.75, 100],
    ['8/8', scoreLib.wilson(8, 8), 67.56, 100],
    ['6/8', scoreLib.wilson(6, 8), 40.93, 92.85],
  ];
  for (const [label, w, lo, hi] of anchors) {
    check('Wilson ' + label + ' reproduces the protocol §1 anchor', Math.abs(w.lo * 100 - lo) < 0.01 && Math.abs(w.hi * 100 - hi) < 0.01, label + ' = ' + pctRange(w));
  }
  check('wilson(x, 0) is n/a, never a divide-by-zero', scoreLib.wilson(0, 0).p === null);
}

section('18. score.js — identity gate compares the SERVED model to the lane\'s (MAJOR 1)');
{
  check('a Terra run served by the flagship is MISMATCHED, not "identity known"',
    scoreLib.classifyIdentity('REVIEW ENGINE: codex model: gpt-5.6-sol', 'gpt-5.6-terra') === 'MISMATCHED');
  check('a Terra run served by Terra is MATCHED',
    scoreLib.classifyIdentity('REVIEW ENGINE: codex model: gpt-5.6-terra', 'gpt-5.6-terra') === 'MATCHED');
  check('REVIEW ENGINE: NONE is UNKNOWN', scoreLib.classifyIdentity('REVIEW ENGINE: NONE', 'gpt-5.6-terra') === 'UNKNOWN');
  check('no header at all is UNKNOWN', scoreLib.classifyIdentity(null, 'gpt-5.6-terra') === 'UNKNOWN');
  // Round 7 CRITICAL 1: `model:` is the REQUESTED model, not the served one, so
  // it is deliberately NOT read as served evidence any more. Only a parsed
  // `served_model:` field counts.
  check('round 7: `model:` is NOT read as a served model',
    scoreLib.extractServedModel('REVIEW ENGINE: codex model: gpt-5.6-sol') === null);
  check('round 7: a `served_model:` field IS read',
    scoreLib.extractServedModel('REVIEW ENGINE: codex (served_model: gpt-5.6-sol)') === 'gpt-5.6-sol');
  check('§2.4\'s lane table is available as the expected-model fallback',
    scoreLib.LANE_EXPECTED_MODEL['X-Terra'] === 'gpt-5.6-terra' && scoreLib.LANE_EXPECTED_MODEL['X-Sol'] === 'gpt-5.6-sol');

  // §3.1 item 5's remedy: re-run once, then EXCLUDE from both lanes.
  const scored = [
    { id: 'x1', lane: 'X-Terra', finalStatus: 'COMPLETED', identity: 'MISMATCHED', attemptCount: 2, servedModel: 'gpt-5.6-sol', expectedModel: 'gpt-5.6-terra' },
    { id: 'x2', lane: 'X-Terra', finalStatus: 'COMPLETED', identity: 'UNKNOWN', attemptCount: 1, servedModel: null, expectedModel: 'gpt-5.6-terra' },
    { id: 'x3', lane: 'X-Terra', finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1, servedModel: 'gpt-5.6-terra', expectedModel: 'gpt-5.6-terra' },
  ];
  const ex = scoreLib.identityExclusions(scored);
  // Round-5: exclusion is §3.1 item 5's remedy for IDENTITY_UNKNOWN — a served
  // model that could not be ESTABLISHED. A MISMATCH was established and was
  // wrong; excluding it would let a wholly mis-served lane read PASS with the
  // exclusions listed underneath.
  check('round-5: a MISMATCH is never excluded — it stays counted and fails the gate',
    ex.excludedIds.indexOf('x1') === -1 && ex.pendingRerunIds.indexOf('x1') === -1, JSON.stringify(ex));
  check('MAJOR 1: an artifact whose identity is UNKNOWN and un-re-run is PENDING', ex.pendingRerunIds.join(',') === 'x2', JSON.stringify(ex.pendingRerunIds));
  check('an UNKNOWN artifact still unresolved AFTER the re-run IS excluded', (() => {
    const rerun = [{ id: 'x4', lane: 'X-Terra', finalStatus: 'COMPLETED', identity: 'UNKNOWN', attemptCount: 2, servedModel: null, expectedModel: 'gpt-5.6-terra' }];
    return scoreLib.identityExclusions(rerun).excludedIds.join(',') === 'x4';
  })());
  check('a matched artifact is neither', ex.excludedIds.indexOf('x3') === -1 && ex.pendingRerunIds.indexOf('x3') === -1);
}

section('19. score.js — false-blocker numerator is MAJOR/CRITICAL, on controls, both-NOISE (MAJOR 5)');
{
  const artifacts = [];
  for (let i = 1; i <= 30; i++) artifacts.push({ id: 'sd-' + i, kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } });
  for (let i = 1; i <= 54; i++) artifacts.push({ id: 'ct-' + i, kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null });
  const key = { version: 1, artifacts };
  const scored = [];
  for (const lane of ['X-Sol', 'X-Terra']) {
    artifacts.forEach((a, idx) => scored.push({
      id: a.id, lane, phase: 0, variant: 'V1', order: idx, kind: a.kind, type: a.seed ? 'CV' : null,
      severity: a.seed ? 'MAJOR' : null, hit: false, nearMisses: [], unavailableFinal: false, integrityWarning: false,
      expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane], servedModel: scoreLib.LANE_EXPECTED_MODEL[lane],
      identity: 'MATCHED', identityKnown: true, identityMismatch: false, identityUnknown: false,
      emptyFindingsSection: false, finalStatus: 'COMPLETED', attemptCount: 1, sourceFile: 'x',
    }));
  }
  const adjudication = [
    // Should COUNT: MAJOR, on a control, NOISE/NOISE.
    { id: 'ct-1', lane: 'X-Terra', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — x', verdict: 'NOISE', second: 'NOISE' },
    { id: 'ct-2', lane: 'X-Terra', severity: 'CRITICAL', finding: '[CRITICAL] a.js:1 — x', verdict: 'NOISE', second: 'NOISE' },
    // Should NOT count: a MINOR nit on a control.
    { id: 'ct-3', lane: 'X-Terra', severity: 'MINOR', finding: '[MINOR] a.js:1 — nit', verdict: 'NOISE', second: 'NOISE' },
    // Should NOT count: a MAJOR on a SEEDED artifact.
    { id: 'sd-1', lane: 'X-Terra', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — x', verdict: 'NOISE', second: 'NOISE' },
    // Should NOT count: only one adjudicator said NOISE.
    { id: 'ct-4', lane: 'X-Terra', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — x', verdict: 'NOISE', second: 'DEBATABLE' },
    // Should NOT count: the other lane.
    { id: 'ct-5', lane: 'X-Sol', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — x', verdict: 'NOISE', second: 'NOISE' },
  ];
  const g = scoreLib.gate12f(scored, key, adjudication, scoreLib.identityExclusions(scored));
  const item3 = g.items.find((i) => i.n === 3);
  check('MAJOR 5: the numerator counts exactly the 2 MAJOR/CRITICAL NOISE/NOISE findings ON CONTROLS',
    /^2 MAJOR\/CRITICAL NOISE\/NOISE finding\(s\) on controls \/ 54 control/.test(item3.detail), item3.detail);
  check('MAJOR 5: 2/54 = 3.7% PASSES the ≤10% gate', item3.status === 'PASS', item3.status + ' — ' + item3.detail);
  check('MAJOR 5: the detail discloses how many NOISE/NOISE adjudications were dropped and why',
    /of 4 NOISE\/NOISE adjudication\(s\) on this lane, 3 were on controls/.test(item3.detail), item3.detail);
  check('the corpus is judged complete on what was RECORDED (84 per lane)', g.complete === true, JSON.stringify({ complete: g.complete }));
}

section('20. score.js — construction-suspect list needs BOTH families (MAJOR 8) and the §3.2 fall-through wording (MINOR 7)');
{
  const artifacts = [];
  for (let i = 1; i <= 6; i++) artifacts.push({ id: 'sd-' + i, kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } });
  const key = { version: 1, artifacts };
  const xOnly = artifacts.map((a, i) => ({ id: a.id, lane: 'X-Terra', kind: 'seeded', hit: i < 2, order: i, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1 }));
  const dX = scoreLib.gate12d(xOnly, key, { excludedIds: [] });
  check('MAJOR 8: with only X-lanes loaded, the construction-suspect list is WITHHELD, not published',
    dX.suspects === null && /NOT COMPUTED/.test(dX.suspectsWithheldReason), JSON.stringify(dX.suspects));
  check('MAJOR 8: the withheld reason quotes §2.5\'s actual definition', /neither X-lane nor ANY S-lane/.test(dX.suspectsWithheldReason), dX.suspectsWithheldReason);

  const both = xOnly.concat(artifacts.map((a, i) => ({ id: a.id, lane: 'S-Opus', kind: 'seeded', hit: i < 2, order: i, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1 })));
  const dBoth = scoreLib.gate12d(both, key, { excludedIds: [] });
  check('MAJOR 8: with both families present, the list IS computed', Array.isArray(dBoth.suspects) && dBoth.suspects.length === 4, JSON.stringify(dBoth.suspects));

  // MINOR 7: gain >= 2 but no X-only TYPE.
  const gainNoType = artifacts.map((a, i) => ({ id: a.id, lane: 'X-Terra', kind: 'seeded', hit: true, order: i, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1 }))
    .concat(artifacts.map((a, i) => ({ id: a.id, lane: 'S-Opus', kind: 'seeded', hit: i < 3, order: i, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1 })));
  const dGain = scoreLib.gate12d(gainNoType, key, { excludedIds: [] });
  check('a +3 gain WITH an X-only type reads as complementarity observed', /complementarity observed/.test(dGain.reading), dGain.reading);

  const nullResult = artifacts.map((a, i) => ({ id: a.id, lane: 'X-Terra', kind: 'seeded', hit: i < 3, order: i, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1 }))
    .concat(artifacts.map((a, i) => ({ id: a.id, lane: 'S-Opus', kind: 'seeded', hit: i < 3, order: i, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1 })));
  const dNull = scoreLib.gate12d(nullResult, key, { excludedIds: [] });
  check('a gap of 0 reads as a null result that never relaxes the mandatory set',
    /null result/.test(dNull.reading) && /never relaxes the mandatory set/.test(dNull.reading), dNull.reading);
  check('MINOR 7: the fall-through branch no longer misstates which half of §3.2 failed',
    !/below the \+2 complementarity threshold and outside/.test(dGain.reading + dNull.reading));
}

section('21. score.js — end-to-end CLI over a synthetic corpus');
{
  const dir = tmpDir('wo12-score-cli-');
  const artifacts = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'CRITICAL', locator: { file: 'quartermaster/quartermaster.js', lines: [100, 110], symbol: 'analyze' }, consequence: '', rationale: '', hazard_terms: [] } },
    { id: 'sdc-002', kind: 'seeded', phase: 0, variant: 'V2', base: 'b', commit: 'c', subject: 's', seed: { type: 'RC', severity: 'MAJOR', locator: { file: 'router/router.js', lines: [10, 12], symbol: 'route' }, consequence: '', rationale: '', hazard_terms: [] } },
    { id: 'sdc-003', kind: 'control', phase: 0, variant: 'V3', base: 'b', commit: 'c', subject: 's', seed: null },
  ];
  const keyPath = writeKey(dir, artifacts);
  function rec(id, lane, stdout, extra) {
    return Object.assign({
      id, lane, phase: 0, variant: 'V1', base: 'b', head: 'h', expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane],
      attempts: [{ wallMs: 1, verdict: 'REVISE', status: 'COMPLETED', engineHeader: 'REVIEW ENGINE: codex model: ' + scoreLib.LANE_EXPECTED_MODEL[lane], integrityWarning: false, stdout }],
    }, extra || {});
  }
  const hitOut = 'REVIEW ENGINE: codex model: gpt-5.6-terra\nVERDICT: REVISE\n\nFINDINGS\n- [CRITICAL] quartermaster/quartermaster.js:105 — analyze() is wrong\n\nCLAIMS CHECKED\n- none\n';
  const missOut = 'REVIEW ENGINE: codex model: gpt-5.6-terra\nVERDICT: APPROVE\n\nFINDINGS\n- none\n\nCLAIMS CHECKED\n- none\n';
  fs.writeFileSync(path.join(dir, 'results-X-Terra-phase0.json'), JSON.stringify([
    rec('sdc-001', 'X-Terra', hitOut), rec('sdc-002', 'X-Terra', missOut), rec('sdc-003', 'X-Terra', missOut),
  ], null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'results-X-Sol-phase0.json'), JSON.stringify([
    rec('sdc-001', 'X-Sol', hitOut.replace(/terra/g, 'sol')), rec('sdc-002', 'X-Sol', missOut.replace(/terra/g, 'sol')), rec('sdc-003', 'X-Sol', missOut.replace(/terra/g, 'sol')),
  ], null, 2), 'utf8');

  const r = spawnSync(process.execPath, [SCORE, '--key', keyPath, '--results-dir', dir, '--out', path.join(dir, 'score-output.json')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('score.js exits 0 on a scoring run', r.status === 0, r.stderr);
  check('the markdown report is printed', /# WO-12 SDC score report/.test(r.stdout || ''), (r.stdout || '').slice(0, 300));
  check('the report discloses that strict paths are the default', /Strict paths \(the DEFAULT since round 2\)/.test(r.stdout || ''));
  check('the NEAR MISSES table is present', /## NEAR MISSES/.test(r.stdout || ''));
  check('the identity table names the lane\'s expected model', /expected model/.test(r.stdout || '') && /gpt-5\.6-terra/.test(r.stdout || ''));
  check('the construction-suspect list is withheld with only X-lanes loaded', /NOT COMPUTED/.test(r.stdout || ''), (r.stdout || '').slice(-2000));
  const out = JSON.parse(fs.readFileSync(path.join(dir, 'score-output.json'), 'utf8'));
  check('score-output.json records strictPaths: true by default', out.strictPaths === true && out.lenientPaths === false, JSON.stringify({ s: out.strictPaths, l: out.lenientPaths }));
  check('recall is 1/2 on each X-lane', out.recallByLane['X-Terra'].hits === 1 && out.recallByLane['X-Terra'].n === 2, JSON.stringify(out.recallByLane['X-Terra']));
  check('identity is MATCHED for every completed run', out.identityByLane['X-Terra'].matched === 3 && out.identityByLane['X-Terra'].count === 0, JSON.stringify(out.identityByLane['X-Terra']));
  check('the exclusion block is present and empty', out.identityExclusions.excludedIds.length === 0 && out.identityExclusions.pendingRerunIds.length === 0);

  // An unreadable results file is reported, not fatal.
  fs.writeFileSync(path.join(dir, 'results-X-Broken-phase0.json'), '{not json', 'utf8');
  const r2 = spawnSync(process.execPath, [SCORE, '--key', keyPath, '--results-dir', dir, '--out', path.join(dir, 'score-output-2.json')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('an unreadable results file is reported, and score.js still exits 0', r2.status === 0 && /UNREADABLE RESULTS FILES/.test(r2.stdout || ''), r2.stderr);
}

// ================================================================ assemble-key

section('22. assemble-key.js — lint precision: whole tokens, case-sensitive proper nouns (coordinator ruling)');
{
  const clean = ['invariant violation', 'resolve the path', 'terrain map', 'consoles are attached', 'a solution emerged',
    'proceeded to the next step', 'lunar phases', 'the terrarium', 'best-effort cleanup', 'a console'];
  for (const t of clean) {
    check('clean: ' + JSON.stringify(t) + ' trips NO leakage term', assembleKeyLib.findLeakageTerm(t) === null, String(assembleKeyLib.findLeakageTerm(t)));
    check('clean: ' + JSON.stringify(t) + ' trips NO vendor term', assembleKeyLib.findVendorTerm(t) === null, String(assembleKeyLib.findVendorTerm(t)));
  }
  const leaks = [['variant V2', 'variant V<n>'], ['the seed', 'seed'], ['seeded artifacts', 'seed'], ['a defect', 'defect'],
    ['injection point', 'inject'], ['the answer key', 'answer key'], ['control artifact', 'control artifact'],
    ['locator.file', 'locator'], ['hazard_terms', 'hazard_terms'], ['WO-12 corpus', 'wo-12'], ['wo12 note', 'wo-12']];
  for (const [t, term] of leaks) {
    check('leak: ' + JSON.stringify(t) + ' is caught as ' + term, assembleKeyLib.findLeakageTerm(t) === term, String(assembleKeyLib.findLeakageTerm(t)));
  }
  const vendors = [['Sol · high', 'Sol'], ['Claude Sonnet 5', 'Claude'], ['Terra medium', 'Terra'], ['Luna xhigh', 'Luna'],
    ['produced by Codex', 'Codex'], ['GPT-5.6', 'GPT'], ['an Anthropic model', 'Anthropic'], ['xhigh', 'xhigh'],
    ['a medium-effort executor', 'effort (casting)'], ['$0.02/1k', 'price ($)'], ['the pricing table', 'price']];
  for (const [t, term] of vendors) {
    check('vendor: ' + JSON.stringify(t) + ' is caught as ' + term, assembleKeyLib.findVendorTerm(t) === term, String(assembleKeyLib.findVendorTerm(t)));
  }
}

section('23. assemble-key.js — the leakage exemption is EQUALITY, not a prefix (MAJOR 4)');
{
  const subject = 'WO-12 corpora: seeded-defect corpus SEALED';
  check('the exact Commit subject line for THIS artifact is exempt',
    assembleKeyLib.isSubjectLine('Commit subject:      ' + subject, subject) === true);
  check('MAJOR 4: a line that merely BEGINS with "Commit subject:" is NOT exempt',
    assembleKeyLib.isSubjectLine('Commit subject: seed defect injected locator hazard_terms', subject) === false);
  check('MAJOR 4: a bare line that is a SUBSTRING of the subject is NOT exempt (the round-1 second hole)',
    assembleKeyLib.isSubjectLine('seeded-defect', subject) === false);

  const findings = [];
  assembleKeyLib.leakageLint('t.txt',
    'Commit subject:      ' + subject + '\nCommit subject: seed defect injected\nordinary prose\n', subject, findings);
  check('MAJOR 4: the real subject line passes and the impostor line is caught', findings.length === 1 && /t\.txt:2/.test(findings[0]), JSON.stringify(findings));
}

section('24. assemble-key.js — the vendor lint covers the WHOLE brief, not one sentence (MAJOR 5)');
{
  const artifact = { id: 'sdc-001', variant: 'V1', subject: 'an ordinary subject', base: 'b' };
  const head = 'a'.repeat(40);
  const bodyNamesVendor = 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + head + '. An executor produced this change.\n\nCLAIMS:\nThe path is no longer weaker than the Codex path.\n\nVerify the diff on its own merits.\n';
  const f1 = [];
  assembleKeyLib.vendorLint('sdc-001.er.txt', bodyNamesVendor, artifact, head, f1);
  check('MAJOR 5: a V1 report naming a vendor OUTSIDE the author sentence is now caught',
    f1.length === 1 && /"Codex"/.test(f1[0]), JSON.stringify(f1));

  const f2 = [];
  assembleKeyLib.vendorLint('sdc-001.er.txt',
    'CLAIMS:\nA medium-effort executor at $0.02/1k produced the change.\n', artifact, head, f2);
  check('MAJOR 5: effort AND price terms are now checked (they were unenforced in round 1)',
    f2.length >= 1 && /effort|price/.test(f2.join(' ')), JSON.stringify(f2));

  // V2's author line names the casting ON PURPOSE — that is the 12h factor.
  const v2 = { id: 'sdc-002', variant: 'V2', subject: 'an ordinary subject', base: 'b' };
  const v2er = assembleKeyLib.renderExecutorReport(v2, head, { order: '', claims: 'We widened the adder and pinned the regression in the suite; the run is green.' }, 'code');
  const f3 = [];
  assembleKeyLib.vendorLint('sdc-002.er.txt', v2er, v2, head, f3);
  check('the V2 author line is exempt (identity-visible by design), and nothing else in the V2 report is',
    f3.length === 0, JSON.stringify(f3));
  const f4 = [];
  assembleKeyLib.vendorLint('sdc-002.er.txt', v2er.replace('Verify the diff', 'Codex should verify the diff'), v2, head, f4);
  check('a vendor word elsewhere in a V2 report is still caught', f4.length === 1 && /"Codex"/.test(f4[0]), JSON.stringify(f4));
}

section('25. assemble-key.js — generated briefs and the structural-tell lint (CRITICAL 4)');
{
  const head = 'b'.repeat(40);
  const base = 'c'.repeat(40);
  const content = {
    order: Array(90).fill('word').join(' '),
    claims: Array(50).fill('claim').join(' '),
  };
  const mk = (id, kind, variant) => ({ id, kind, variant, base, subject: 'an ordinary subject', phase: 0 });

  const rows = [];
  for (const [id, kind, variant] of [['g1', 'seeded', 'V1'], ['g2', 'control', 'V1'], ['g3', 'seeded', 'V2'], ['g4', 'control', 'V2'], ['g5', 'seeded', 'V3'], ['g6', 'control', 'V3']]) {
    const a = mk(id, kind, variant);
    const b = assembleKeyLib.generateBriefs(a, head, content, 'code');
    rows.push({ id, kind, variant, baseKind: 'code', head, wo: b.wo, er: b.er, orderWords: 90, claimsWords: 50, woSkeleton: assembleKeyLib.skeletonize(b.wo, a, head), erSkeleton: assembleKeyLib.skeletonize(b.er, a, head) });
  }
  const clean = [];
  assembleKeyLib.structuralTellLint(rows, clean);
  assembleKeyLib.lintKindSymmetry(rows, clean);
  check('CRITICAL 4: generated briefs pass the structural-tell lint (one WO skeleton, one ER skeleton per variant)', clean.length === 0, JSON.stringify(clean));
  check('CRITICAL 4: all six work orders reduce to ONE skeleton', new Set(rows.map((r) => r.woSkeleton)).size === 1);
  check('a seeded and a control brief of the same variant are byte-identical apart from prose/shas',
    rows[0].erSkeleton === rows[1].erSkeleton && rows[4].erSkeleton === rows[5].erSkeleton);

  // The round-1 failure, re-created: a seeded work order carrying an extra
  // ORDER/CONSTRAINT block the controls do not have.
  const tampered = rows.map((r) => Object.assign({}, r));
  tampered[0].woSkeleton = tampered[0].woSkeleton + '\nCONSTRAINT:\n<ORDER>';
  const bad1 = [];
  assembleKeyLib.structuralTellLint(tampered, bad1);
  check('CRITICAL 4: an extra section on ONE work order is caught as a structural tell', bad1.length >= 1 && /work orders reduce to 2 DIFFERENT line skeletons/.test(bad1.join(' ')), JSON.stringify(bad1));

  // A shape carried only by seeds, within one variant.
  const oneSided = rows.map((r) => Object.assign({}, r));
  oneSided[0].erSkeleton = oneSided[0].erSkeleton + '\nEXTRA CLAIMS BLOCK';
  const bad2 = [];
  assembleKeyLib.structuralTellLint(oneSided, bad2);
  check('CRITICAL 4: a skeleton carried by only ONE population is caught', /carried ONLY by/.test(bad2.join(' ')), JSON.stringify(bad2));

  // KIND symmetry: a KIND that only controls carry re-creates the round-1
  // type-derived-hazard tell in a new coat.
  const skewed = rows.map((r) => Object.assign({}, r, { baseKind: r.kind === 'control' ? 'docs' : 'code' }));
  const bad3 = [];
  assembleKeyLib.lintKindSymmetry(skewed, bad3);
  check('CRITICAL 4: a KIND carried by only one population is caught (a KIND-derived hazard list would identify it)',
    bad3.length === 2 && /identifies the population/.test(bad3.join(' ')), JSON.stringify(bad3));
}

section('26. assemble-key.js — hazard lists come from the CLOSED vocabulary, keyed by KIND (CRITICAL 4)');
{
  const a = { id: 'sdc-001', variant: 'V3', subject: 'an ordinary subject', base: 'x'.repeat(40) };
  const head = 'y'.repeat(40);
  const content = { order: Array(80).fill('word').join(' '), claims: Array(40).fill('claim').join(' ') };
  const er = assembleKeyLib.renderExecutorReport(a, head, content, 'code');
  const ok = [];
  assembleKeyLib.hazardLint('sdc-001.er.txt', er, 'code', 'V3', ok);
  check('a generated V3 report passes the hazard lint', ok.length === 0, JSON.stringify(ok));
  check('the hazard lines are VARIANTS.md v2\'s KIND=code list, verbatim and in order',
    assembleKeyLib.HAZARD_VOCABULARY.code.every((h) => er.indexOf('- ' + h + '\n') !== -1 || er.indexOf('- ' + h) !== -1), er);

  const typeDerived = er.replace(assembleKeyLib.HAZARD_VOCABULARY.code[0], 'check every stated constraint in the order against the diff');
  const bad = [];
  assembleKeyLib.hazardLint('sdc-001.er.txt', typeDerived, 'code', 'V3', bad);
  check('CRITICAL 4: a TYPE-derived hazard line (the round-1 100%-precision tell) is rejected',
    bad.some((f) => /OUTSIDE VARIANTS\.md v2's closed vocabulary/.test(f)), JSON.stringify(bad));

  const wrongKind = [];
  assembleKeyLib.hazardLint('sdc-001.er.txt', er, 'docs', 'V3', wrongKind);
  check('a hazard list that is not this artifact\'s KIND list is rejected', wrongKind.length >= 1, JSON.stringify(wrongKind));

  const v1 = { id: 'sdc-002', variant: 'V1', subject: 's', base: 'x'.repeat(40) };
  const v1er = assembleKeyLib.renderExecutorReport(v1, head, content, 'code');
  const v1f = [];
  assembleKeyLib.hazardLint('sdc-002.er.txt', v1er, 'code', 'V1', v1f);
  check('a V1 report carries no hazard block and passes', v1f.length === 0 && v1er.indexOf(assembleKeyLib.HAZARD_HEADER) === -1, JSON.stringify(v1f));
  const v1bad = [];
  assembleKeyLib.hazardLint('sdc-002.er.txt', v1er + '\n' + assembleKeyLib.HAZARD_HEADER + '\n- x\n', 'code', 'V1', v1bad);
  check('a hazard block on a NON-V3 artifact is caught', v1bad.length === 1 && /only V3 may/.test(v1bad[0]), JSON.stringify(v1bad));
}

section('27. assemble-key.js — word bands are enforced on EVERY artifact (VARIANTS.md v2)');
{
  const f1 = [];
  assembleKeyLib.wordBandLint('sdc-001', { order: Array(90).fill('w').join(' '), claims: Array(50).fill('c').join(' ') }, f1);
  check('an in-band content file passes', f1.length === 0, JSON.stringify(f1));
  const f2 = [];
  assembleKeyLib.wordBandLint('sdc-002', { order: Array(59).fill('w').join(' '), claims: Array(50).fill('c').join(' ') }, f2);
  check('order at 59 words (one below the floor) fails', f2.length === 1 && /59 words/.test(f2[0]), JSON.stringify(f2));
  const f3 = [];
  assembleKeyLib.wordBandLint('sdc-003', { order: Array(161).fill('w').join(' '), claims: Array(101).fill('c').join(' ') }, f3);
  check('order at 161 and claims at 101 (one above each ceiling) both fail', f3.length === 2, JSON.stringify(f3));
  const f4 = [];
  assembleKeyLib.wordBandLint('sdc-004', { order: Array(60).fill('w').join(' '), claims: Array(30).fill('c').join(' ') }, f4);
  check('the floors themselves (60 / 30) are inclusive', f4.length === 0, JSON.stringify(f4));
  const f5 = [];
  assembleKeyLib.wordBandLint('sdc-005', { order: Array(160).fill('w').join(' '), claims: Array(100).fill('c').join(' ') }, f5);
  check('the ceilings themselves (160 / 100) are inclusive', f5.length === 0, JSON.stringify(f5));
}

section('28. assemble-key.js — seed.json disagreeing with its base-pool slot is a hard failure naming both');
{
  const dir = tmpDir('wo12-seedmismatch-');
  const pool = { slots: [{ id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b'.repeat(40), commit: 'c'.repeat(40), subject: 's', seed_slot: { type: 'CV', target_severity: 'MAJOR' } }] };
  fs.writeFileSync(path.join(dir, 'sdc-001.seed.json'), JSON.stringify({
    id: 'sdc-001', base: 'b'.repeat(40), commit: 'c'.repeat(40), phase: 0, variant: 'V2',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: 'x', rationale: 'y', hazard_terms: [] },
  }), 'utf8');
  let threw = null;
  try { assembleKeyLib.buildKeyAndNotes(pool, { corpusDir: dir }); } catch (e) { threw = e; }
  check('a variant mismatch between seed.json and base-pool.json is a hard failure',
    !!threw && /disagrees with base-pool\.json/.test(threw.message), threw && threw.message);
  check('the failure names BOTH records\' values', !!threw && /seed\.json=V2/.test(threw.message) && /base-pool slot=V1/.test(threw.message), threw && threw.message);
}

section('29. assemble-key.js — computeTallies against protocol §2.2/§2.3/§2.6/§2.7 targets');
{
  function mkKey(seedSpecs, controlCount) {
    const artifacts = [];
    seedSpecs.forEach((s, i) => artifacts.push({ id: 's' + i, kind: 'seeded', phase: s.phase, variant: s.variant, base: 'b', commit: 'c', subject: 'x', seed: { type: s.type, severity: s.severity, locator: {}, consequence: '', rationale: '', hazard_terms: [] } }));
    for (let i = 0; i < controlCount; i++) artifacts.push({ id: 'c' + i, kind: 'control', phase: 0, variant: VARIANT_CYCLE[i % 3], base: 'b', commit: 'c', subject: 'x', seed: null });
    return { version: 1, artifacts };
  }
  const VARIANT_CYCLE = ['V1', 'V2', 'V3'];
  const specs = [];
  const TYPES = assembleKeyLib.TYPES;
  TYPES.forEach((t, ti) => {
    for (let k = 0; k < 5; k++) {
      specs.push({ type: t, severity: k === 0 ? 'CRITICAL' : 'MAJOR', variant: VARIANT_CYCLE[(ti + k) % 3], phase: k === 0 ? 0 : (k % 3) + 1 });
    }
  });
  const t = assembleKeyLib.computeTallies(mkKey(specs, 54));
  check('30 seeds, 6 types x 5', t.seededCount === 30 && TYPES.every((x) => t.byType[x] === 5), JSON.stringify(t.byType));
  check('6 CRITICAL, 24 MAJOR, 0 MINOR', t.severityCounts.CRITICAL === 6 && t.severityCounts.MAJOR === 24 && t.severityCounts.MINOR === 0, JSON.stringify(t.severityCounts));
  check('CRITICAL in all six types (§2.2 wants ≥4)', t.criticalTypes.length === 6, JSON.stringify(t.criticalTypes));
  check('a corpus that MISSES a target produces a WARNING, never a failure',
    assembleKeyLib.computeTallies(mkKey(specs.slice(0, 29), 54)).warnings.length > 0);
  check('the tallies table renders', /Total: 84 \(30 seeded \+ 54 control\)/.test(assembleKeyLib.renderTalliesTable(t)));
}

section('30. assemble-key.js — the legacy brief importer strips templates and invents nothing');
{
  const wo = [
    'REVIEW PACKET — review a completed, already-merged change.',
    '',
    'Change under review: commit ' + 'a'.repeat(40),
    'Base (its parent):   ' + 'b'.repeat(40),
    'Commit subject:      a real subject',
    '',
    'Intent: the commit message above is the work order this change claims to',
    'implement. In full, the order was:',
    '',
    '  Do the specific thing the order asked for, in the specific way it asked.',
    '',
    '  Constraint: do not touch the adjacent module.',
    '',
    'Audit the diff between base and head against that stated intent:',
    'correctness, unexplained changes, and concrete failure scenarios.',
  ].join('\n');
  const order = assembleKeyLib.importOrderFromWorkOrder(wo);
  check('the importer keeps the real order prose', /Do the specific thing the order asked for/.test(order), order);
  check('the importer keeps the constraint paragraph (a seed\'s substance)', /Constraint: do not touch the adjacent module/.test(order), order);
  check('the importer strips the REVIEW PACKET header', !/REVIEW PACKET/.test(order), order);
  check('the importer strips the sha lines', !/[0-9a-f]{40}/.test(order), order);
  check('the importer strips the "Intent:" boilerplate', !/Intent:/.test(order) && !/In full, the order was/.test(order), order);
  check('the importer strips the trailing "Audit the diff" paragraph', !/Audit the diff/.test(order), order);

  const plainWo = [
    'REVIEW PACKET — review a completed, already-merged change.',
    '',
    'Change under review: commit ' + 'a'.repeat(40),
    'Base (its parent):   ' + 'b'.repeat(40),
    'Commit subject:      a real subject',
    '',
    'Intent: the commit message above is the work order this change claims to',
    'implement. Audit the diff between base and head against that stated',
    'intent: correctness, unexplained changes, and concrete failure scenarios.',
  ].join('\n');
  check('a plain round-1 work order yields EMPTY order prose — nothing is invented',
    assembleKeyLib.importOrderFromWorkOrder(plainWo) === '', JSON.stringify(assembleKeyLib.importOrderFromWorkOrder(plainWo)));

  const erInline = [
    'EXECUTOR REPORT:',
    'STATUS: DONE. The change is commit ' + 'a'.repeat(40) + '.',
    'An executor produced this change. The window is now 48h and the keys were',
    'added additively. Beyond that, no fresh executor claims exist beyond the',
    'commit message. Verify the diff on its own merits.',
  ].join('\n');
  const claimsInline = assembleKeyLib.importClaimsFromExecutorReport(erInline);
  check('inline claims after the author sentence are kept', /The window is now 48h and the keys were added additively/.test(claimsInline), claimsInline);
  check('the STATUS/commit/author/"no fresh claims"/"Verify" boilerplate is all stripped',
    !/STATUS|produced this change|no fresh executor claims|Verify the diff|EXECUTOR REPORT/.test(claimsInline), claimsInline);
  check('no 40-hex sha survives into the claims prose', !/[0-9a-f]{40}/.test(claimsInline), claimsInline);

  const erPlain = [
    'EXECUTOR REPORT:',
    'STATUS: DONE. The change is commit ' + 'a'.repeat(40) + '. An executor produced this',
    'change; no fresh executor claims exist beyond the commit message. Verify',
    'the diff on its own merits.',
  ].join('\n');
  check('a plain round-1 executor report yields EMPTY claims prose — nothing is invented',
    assembleKeyLib.importClaimsFromExecutorReport(erPlain) === '', JSON.stringify(assembleKeyLib.importClaimsFromExecutorReport(erPlain)));

  const erHazard = erInline + '\n\n' + assembleKeyLib.HAZARD_HEADER + '\n- check for unrequested mutation outside the stated scope\n';
  check('the hazard block is never mined for claims prose',
    !/check for unrequested mutation/.test(assembleKeyLib.importClaimsFromExecutorReport(erHazard)),
    assembleKeyLib.importClaimsFromExecutorReport(erHazard));

  const erBullets = [
    'EXECUTOR REPORT:',
    'STATUS: DONE. The change is commit ' + 'a'.repeat(40) + '.',
    'An executor produced this change; the executor\'s own claims for it follow.',
    'Verify the diff on its own merits.',
    '',
    'CLAIMS:',
    '- Item 1 done. The resolver now normalizes the path.',
    '- Item 2 done. The regression is pinned.',
  ].join('\n');
  const bulletClaims = assembleKeyLib.importClaimsFromExecutorReport(erBullets);
  check('a CLAIMS: bullet list is mined, header dropped, bullets kept',
    /Item 1 done/.test(bulletClaims) && /Item 2 done/.test(bulletClaims) && !/^CLAIMS/.test(bulletClaims), bulletClaims);
}

section('31. assemble-key.js — a missing content file is a hard failure, and --check-only lists it');
{
  const dir = tmpDir('wo12-content-missing-');
  const contentDir = path.join(dir, 'content');
  fs.mkdirSync(contentDir, { recursive: true });
  const pool = {
    slots: [
      { id: 'sdc-001', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: null },
      { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: null },
    ],
  };
  fs.writeFileSync(path.join(contentDir, 'sdc-001.json'), JSON.stringify({ order: 'x', claims: 'y' }), 'utf8');
  const missing = assembleKeyLib.checkRequirements(pool, { corpusDir: dir, briefsDir: path.join(dir, 'briefs'), contentDir });
  check('a missing content file is reported as missing', missing.length === 1 && /sdc-002.*content\/sdc-002\.json/.test(missing[0]), JSON.stringify(missing));
  check('an absent BRIEF is NOT an input error any more (briefs are generated)', !missing.some((m) => /\.wo\.txt|\.er\.txt/.test(m)), JSON.stringify(missing));
}

section('32. assemble-key.js — end-to-end: generation, lints-before-write, and refusal of hand-edited briefs');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-assemble-e2e-');
  const contentDir = path.join(work, 'content');
  const briefsDir = path.join(work, 'briefs');
  fs.mkdirSync(contentDir, { recursive: true });

  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  return a - b;\n}\n');
  });
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(work, 'sdc-001.seed.json'), JSON.stringify({
    id: 'sdc-001', base: repo.base, commit: repo.commit, phase: 0, variant: 'V1',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');

  const slots = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
    { id: 'sdc-003', kind: 'seeded', phase: 0, variant: 'V3', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'sdc-004', kind: 'control', phase: 0, variant: 'V3', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
  ];
  fs.copyFileSync(path.join(work, 'sdc-001.patch'), path.join(work, 'sdc-003.patch'));
  fs.writeFileSync(path.join(work, 'sdc-003.seed.json'), JSON.stringify({
    id: 'sdc-003', base: repo.base, commit: repo.commit, phase: 0, variant: 'V3',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');
  const poolPath = path.join(work, 'base-pool.json');
  fs.writeFileSync(poolPath, JSON.stringify({ slots }, null, 2), 'utf8');

  const goodOrder = Array(80).fill('the order asks for a specific bounded change').join(' ').split(' ').slice(0, 90).join(' ');
  const goodClaims = Array(40).fill('the change was made and the suite is green').join(' ').split(' ').slice(0, 45).join(' ');
  for (const s of slots) fs.writeFileSync(path.join(contentDir, s.id + '.json'), JSON.stringify({ order: goodOrder, claims: goodClaims }, null, 2), 'utf8');

  const cliArgs = ['--pool', poolPath, '--corpus-dir', work, '--briefs-dir', briefsDir, '--content-dir', contentDir,
    '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')];

  const r = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('a full assembly exits 0', r.status === 0, (r.stderr || '') + '\n' + (r.stdout || ''));
  check('it reports generating 8 brief files for 4 artifacts', /generated 8 brief file\(s\)/.test(r.stdout || ''), r.stdout);
  check('key.json was written', fs.existsSync(path.join(work, 'key.json')));
  check('CONSTRUCTION.md was written', fs.existsSync(path.join(work, 'CONSTRUCTION.md')));
  check('every brief was generated', slots.every((s) => fs.existsSync(path.join(briefsDir, s.id + '.wo.txt')) && fs.existsSync(path.join(briefsDir, s.id + '.er.txt'))));
  const md = fs.readFileSync(path.join(work, 'CONSTRUCTION.md'), 'utf8');
  check('CONSTRUCTION.md carries the LENGTH REPORT (mean ± sd, seeds vs controls)',
    /## Brief length report/.test(md) && /\| seeded \| .*±/.test(md) && /\| control \| .*±/.test(md), md.slice(0, 2500));
  check('CONSTRUCTION.md records the structural-tell lint result', /## Structural-tell lint result/.test(md) && /must be 1/.test(md));
  check('round-1 MINOR: CONSTRUCTION.md discloses cross-artifact base/subject collisions',
    /## Cross-artifact base\/subject collisions/.test(md) && /collision group\(s\)/.test(md), md.slice(md.indexOf('## Cross-artifact'), md.indexOf('## Cross-artifact') + 900));

  // The generated briefs must be structurally indistinguishable.
  const woSeed = fs.readFileSync(path.join(briefsDir, 'sdc-001.wo.txt'), 'utf8');
  const woCtl = fs.readFileSync(path.join(briefsDir, 'sdc-002.wo.txt'), 'utf8');
  check('CRITICAL 4: a seeded and a control work order have the same line count and shape',
    woSeed.split('\n').length === woCtl.split('\n').length, woSeed.split('\n').length + ' vs ' + woCtl.split('\n').length);
  const erSeedV3 = fs.readFileSync(path.join(briefsDir, 'sdc-003.er.txt'), 'utf8');
  const erCtlV3 = fs.readFileSync(path.join(briefsDir, 'sdc-004.er.txt'), 'utf8');
  check('CRITICAL 4: a seeded and a control V3 report carry the SAME hazard checklist',
    erSeedV3.slice(erSeedV3.indexOf(assembleKeyLib.HAZARD_HEADER)) === erCtlV3.slice(erCtlV3.indexOf(assembleKeyLib.HAZARD_HEADER)));

  // --check-only on a clean tree.
  const rCheck = spawnSync(process.execPath, [ASSEMBLE_KEY, '--check-only'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('--check-only on a freshly assembled corpus exits 0', rCheck.status === 0, (rCheck.stderr || '') + (rCheck.stdout || ''));
  check('--check-only confirms every brief matches generation', /every brief on disk matches generation exactly/.test(rCheck.stdout || ''), rCheck.stdout);

  // A HAND-EDITED brief is refused: --check-only names it as drift.
  const tamper = path.join(briefsDir, 'sdc-001.wo.txt');
  fs.writeFileSync(tamper, fs.readFileSync(tamper, 'utf8') + '\nCONSTRAINT: do not touch the adjacent module.\n', 'utf8');
  const rDrift = spawnSync(process.execPath, [ASSEMBLE_KEY, '--check-only'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('CRITICAL 4: --check-only reports a hand-edited brief as DRIFT that will be overwritten',
    /sdc-001\.wo\.txt/.test(rDrift.stdout || '') && /DIFFER from generation/.test(rDrift.stdout || ''), rDrift.stdout);
  const rFix = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('a re-run REGENERATES the hand-edited brief', rFix.status === 0 && !/CONSTRAINT: do not touch/.test(fs.readFileSync(tamper, 'utf8')), fs.readFileSync(tamper, 'utf8'));

  // MAJOR 3: lints run BEFORE key.json is written.
  const keyBefore = fs.readFileSync(path.join(work, 'key.json'), 'utf8');
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'),
    JSON.stringify({ order: goodOrder + ' The Codex path is now stronger.', claims: goodClaims }, null, 2), 'utf8');
  const rLint = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('MAJOR 3: a lint failure REFUSES the whole assembly', rLint.status !== 0 && /assembly REFUSED/.test(rLint.stderr || ''), rLint.stderr);
  check('MAJOR 3: the lint failure names the offending vendor term and file', /"Codex"/.test(rLint.stderr || '') && /sdc-002/.test(rLint.stderr || ''), rLint.stderr);
  check('MAJOR 3: key.json is UNCHANGED — the lints ran before it was sealed',
    fs.readFileSync(path.join(work, 'key.json'), 'utf8') === keyBefore);
  check('MAJOR 3: no .tmp file is left behind by the refusal', !fs.existsSync(path.join(work, 'key.json.tmp')));

  // A word-band failure is likewise all-or-nothing.
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'), JSON.stringify({ order: 'too short', claims: goodClaims }, null, 2), 'utf8');
  const rBand = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('a word-band violation refuses the assembly and names the band', rBand.status !== 0 && /outside the 60–160 band/.test(rBand.stderr || ''), rBand.stderr);
  check('key.json is still unchanged after the word-band refusal', fs.readFileSync(path.join(work, 'key.json'), 'utf8') === keyBefore);
}

section('33. assemble-key.js — --import-legacy-briefs never overwrites an existing content file');
{
  const work = tmpDir('wo12-import-');
  const contentDir = path.join(work, 'content');
  const briefsDir = path.join(work, 'briefs');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(briefsDir, { recursive: true });
  const slots = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: null },
  ];
  fs.writeFileSync(path.join(briefsDir, 'sdc-001.wo.txt'),
    'REVIEW PACKET — review a completed, already-merged change.\n\nCommit subject:      s\n\nORDER:\n\nDo the bounded thing.\n\nAudit the diff between base and head against that stated intent.\n', 'utf8');
  fs.writeFileSync(path.join(briefsDir, 'sdc-001.er.txt'),
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'a'.repeat(40) + '. An executor produced this change. It was done and verified.\n', 'utf8');
  // A control content file another agent is writing concurrently.
  const guarded = path.join(contentDir, 'sdc-002.json');
  fs.writeFileSync(guarded, JSON.stringify({ order: 'CONTROL PROSE FROM ANOTHER AGENT', claims: 'ALSO THEIRS' }), 'utf8');

  const paths = { contentDir, briefsDir, corpusDir: work, importReportPath: path.join(contentDir, 'IMPORT-REPORT.md') };
  const result = assembleKeyLib.importLegacyBriefs({ slots }, paths);
  check('only SEEDED slots are imported', result.written.length === 1 && result.written[0].id === 'sdc-001', JSON.stringify(result.written));
  check('a control content file written by another agent is untouched',
    JSON.parse(fs.readFileSync(guarded, 'utf8')).order === 'CONTROL PROSE FROM ANOTHER AGENT');
  check('an out-of-band import is written anyway and FLAGGED, never dropped',
    fs.existsSync(path.join(contentDir, 'sdc-001.json')) && result.flagged.length === 1, JSON.stringify(result.flagged));

  // Re-running must not overwrite what it just wrote.
  fs.writeFileSync(path.join(contentDir, 'sdc-001.json'), JSON.stringify({ order: 'HAND REVISED', claims: 'HAND REVISED' }), 'utf8');
  const again = assembleKeyLib.importLegacyBriefs({ slots }, paths);
  check('a second import leaves a hand-revised file alone', again.written.length === 0 && again.skippedExisting.indexOf('sdc-001') !== -1, JSON.stringify(again));
  check('the revised prose survives', JSON.parse(fs.readFileSync(path.join(contentDir, 'sdc-001.json'), 'utf8')).order === 'HAND REVISED');

  const report = assembleKeyLib.renderImportReport(result, { slots });
  check('the import report names the files needing a pass', /## Needing a human\/agent pass/.test(report) && /sdc-001/.test(report), report.slice(0, 1200));
}

// ============================ cross-vendor R0 record (openai-2) additions

section('34. build-corpus.js — i18n.commitEncoding cannot move the head sha (openai-2 MAJOR build-corpus.js:196)');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-i18n-');
  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  // café naïve résumé\n  return a + b;\n}\n');
  });
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  const keyPath = writeKey(work, [{
    id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }]);
  function build(cloneRoot, encoding) {
    const cfg = path.join(work, 'gitconfig-' + encoding.replace(/[^a-z0-9]/gi, ''));
    fs.writeFileSync(cfg, '[i18n]\n\tcommitEncoding = ' + encoding + '\n\tlogOutputEncoding = ' + encoding + '\n', 'utf8');
    return spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'sdc-001', '--key', keyPath, '--corpus-dir', work,
      '--patches-dir', work, '--source-repo', repo.dir, '--clone-root', cloneRoot],
    { encoding: 'utf8', env: Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: cfg }) });
  }
  const rUtf = build(path.join(work, 'clone-utf8'), 'UTF-8');
  const rIso = build(path.join(work, 'clone-iso'), 'ISO-8859-1');
  check('build under i18n.commitEncoding=UTF-8 exits 0', rUtf.status === 0, rUtf.stderr);
  check('build under i18n.commitEncoding=ISO-8859-1 exits 0', rIso.status === 0, rIso.stderr);
  let a = null, b = null;
  try { a = JSON.parse((rUtf.stdout || '').trim().split('\n').pop()); } catch (e) { /* reported */ }
  try { b = JSON.parse((rIso.stdout || '').trim().split('\n').pop()); } catch (e) { /* reported */ }
  check('openai-2 MAJOR build-corpus.js:196: UTF-8 and ISO-8859-1 produce the SAME head sha',
    !!a && !!b && a.head === b.head, 'utf8=' + (a && a.head) + ' iso=' + (b && b.head));
  check('the encoding pins are in GIT_PINS', buildCorpusLib.GIT_PINS.join(' ').indexOf('i18n.commitEncoding=utf-8') !== -1,
    buildCorpusLib.GIT_PINS.join(' '));
}

section('35. run-lane.js — phases run IN ORDER (openai-2 MAJOR run-lane.js:382)');
{
  const repo = makeSourceRepo();
  const dir = tmpDir('wo12-order-');
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [];
  for (const [id, phase] of [['sdc-001', 0], ['sdc-002', 0], ['sdc-003', 1]]) {
    artifacts.push({ id, kind: 'control', phase, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  const keyPath = writeKey(dir, artifacts);
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const stubs = tmpDir('wo12-orderstub-');
  const green = qmStubJson(stubs, 'green.js', Object.assign({ requiredReserve: 0.08 }, ouState(0.85)));

  const args = ['--lane', 'X-Terra', '--phase', '1', '--draw-per-review', '0.0001',
    '--key', keyPath, '--briefs-dir', briefs, '--patches-dir', dir, '--source-repo', repo.dir,
    '--results-dir', dir, '--runner', path.join(stubs, 'nope.js')];

  const rNoPhase0 = runLane(args, { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('openai-2 MAJOR run-lane.js:382: phase 1 refuses when phase 0 has never run',
    rNoPhase0.status !== 0 && /phase order/.test(rNoPhase0.stderr || '') && /phase 0/.test(rNoPhase0.stderr || ''), rNoPhase0.stderr);

  fs.writeFileSync(path.join(dir, 'results-X-Terra-phase0.json'), JSON.stringify([{ id: 'sdc-001' }], null, 2), 'utf8');
  const rPartial = runLane(args, { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('phase 1 refuses when phase 0 is only PARTIALLY recorded, and names what is missing',
    rPartial.status !== 0 && /phase 0 is INCOMPLETE/.test(rPartial.stderr || '') && /sdc-002/.test(rPartial.stderr || ''), rPartial.stderr);

  fs.writeFileSync(path.join(dir, 'results-X-Terra-phase0.json'), JSON.stringify([{ id: 'sdc-001', attempts: DONE_ATTEMPT }, { id: 'sdc-002', attempts: DONE_ATTEMPT }], null, 2), 'utf8');
  const rOk = runLane(args, { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('phase 1 proceeds past the ordering check once phase 0 is complete (stops on --yes)',
    rOk.status !== 0 && /bill real OpenAI allowance/i.test(rOk.stderr || '') && !/phase order/.test(rOk.stderr || ''), rOk.stderr);

  check('checkPhaseOrder: phase 0 is always in order', runLaneLib.checkPhaseOrder('X-Terra', 0, key, dir).ok === true);

  // --dry-run must refuse EXACTLY like a real run. The phase-order check runs
  // ahead of the dry-run branch; before that fix, `--phase 1 --dry-run` printed
  // a full, plausible plan and exited 0 with no phase-0 results on disk —
  // rehearsing a run the real invocation was going to refuse.
  {
    const dryDir = tmpDir('wo12-order-dry-');
    const dryArgs = ['--lane', 'X-Sol', '--phase', '1', '--dry-run', '--key', keyPath, '--briefs-dir', briefs,
      '--source-repo', repo.dir, '--results-dir', dryDir, '--runner', path.join(dryDir, 'x.js')];

    const rDryNone = runLane(dryArgs);
    check('a phase-1 --dry-run with NO phase-0 results is REFUSED, exit 1',
      rDryNone.status === 1 && /refusing \(phase order/.test(rDryNone.stderr || ''), 'status=' + rDryNone.status + ' ' + (rDryNone.stderr || ''));
    check('the refused dry-run prints NO plan (no RUN ORDER block, no runner command)',
      !/DRY RUN — nothing executed/.test(rDryNone.stdout || ''), (rDryNone.stdout || '').slice(-600));

    fs.writeFileSync(path.join(dryDir, 'results-X-Sol-phase0.json'), JSON.stringify([{ id: 'sdc-001' }], null, 2), 'utf8');
    const rDryPartial = runLane(dryArgs);
    check('a phase-1 --dry-run with a PARTIAL phase-0 file is refused and names what is missing',
      rDryPartial.status === 1 && /phase 0 is INCOMPLETE/.test(rDryPartial.stderr || '') && /sdc-002/.test(rDryPartial.stderr || ''), rDryPartial.stderr);

    fs.writeFileSync(path.join(dryDir, 'results-X-Sol-phase0.json'), '{not json', 'utf8');
    const rDryCorrupt = runLane(dryArgs);
    check('a phase-1 --dry-run with a CORRUPT phase-0 file is refused rather than ignoring it',
      rDryCorrupt.status === 1 && /does not parse/.test(rDryCorrupt.stderr || ''), rDryCorrupt.stderr);

    fs.writeFileSync(path.join(dryDir, 'results-X-Sol-phase0.json'), JSON.stringify([{ id: 'sdc-001', attempts: DONE_ATTEMPT }, { id: 'sdc-002', attempts: DONE_ATTEMPT }], null, 2), 'utf8');
    const rDryOk = runLane(dryArgs);
    check('a phase-1 --dry-run with a COMPLETE phase-0 file prints the plan and exits 0',
      rDryOk.status === 0 && /DRY RUN — nothing executed/.test(rDryOk.stdout || '') && /RUN ORDER \(phase 1\)/.test(rDryOk.stdout || ''),
      'status=' + rDryOk.status + ' ' + (rDryOk.stderr || '') + (rDryOk.stdout || '').slice(-400));
    check('the passing dry-run says the phase-order check was applied', /phase order was checked and passed/.test(rDryOk.stdout || ''), rDryOk.stdout);
    check('the passing dry-run still runs no Quartermaster check', !/quartermaster --state/i.test(rDryOk.stdout || ''), rDryOk.stdout);
    check('a phase-0 --dry-run is unaffected by any of this',
      runLane(['--lane', 'X-Sol', '--phase', '0', '--dry-run', '--key', keyPath, '--briefs-dir', briefs,
        '--source-repo', repo.dir, '--results-dir', tmpDir('wo12-order-dry0-'), '--runner', path.join(dryDir, 'x.js')]).status === 0);
  }
  check('checkPhaseOrder: a corrupt prior-phase results file refuses rather than being ignored', (() => {
    const d2 = tmpDir('wo12-order2-');
    fs.writeFileSync(path.join(d2, 'results-X-Terra-phase0.json'), '{not json', 'utf8');
    const res = runLaneLib.checkPhaseOrder('X-Terra', 1, key, d2);
    return res.ok === false && /does not parse/.test(res.refusal);
  })());
}

section('36. score.js — an empty/partial adjudication cannot PASS gate 3 (openai-2 CRITICAL score.js:415)');
{
  const artifacts = [];
  for (let i = 1; i <= 30; i++) artifacts.push({ id: 'sd-' + i, kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } });
  for (let i = 1; i <= 54; i++) artifacts.push({ id: 'ct-' + i, kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null });
  const key = { version: 1, artifacts };
  function mkScored(controlBlockers) {
    const scored = [];
    for (const lane of ['X-Sol', 'X-Terra']) {
      artifacts.forEach((a, idx) => scored.push({
        id: a.id, lane, phase: 0, variant: 'V1', order: idx, kind: a.kind, type: a.seed ? 'CV' : null,
        severity: a.seed ? 'MAJOR' : null, hit: false, nearMisses: [], adjudicatedPromotion: false,
        // Round 3: gate 3 tracks completeness per FINDING, so the findings
        // themselves are what a control carries — TWO here, so an adjudication
        // covering only one leaves the gate INCOMPLETE.
        blockerFindings: a.kind === 'control' && controlBlockers.indexOf(a.id) !== -1 ? 2 : 0,
        blockerFindingTexts: a.kind === 'control' && controlBlockers.indexOf(a.id) !== -1
          ? ['[MAJOR] a.js:1 — first blocker on ' + a.id, '[MAJOR] a.js:9 — second blocker on ' + a.id]
          : [],
        unavailableFinal: false, noVerdict: false, integrityWarning: false,
        expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane], servedModel: scoreLib.LANE_EXPECTED_MODEL[lane],
        identity: 'MATCHED', identityKnown: true, identityMismatch: false, identityUnknown: false,
        emptyFindingsSection: false, finalStatus: 'COMPLETED', attemptCount: 1, sourceFile: 'x',
      }));
    }
    return scored;
  }

  const withBlockers = mkScored(['ct-1', 'ct-2', 'ct-3']);
  const gEmpty = scoreLib.gate12f(withBlockers, key, [], scoreLib.identityExclusions(withBlockers));
  const i3Empty = gEmpty.items.find((i) => i.n === 3);
  check('openai-2 CRITICAL score.js:415: `--adjudication []` is INCOMPLETE, never a 0% PASS',
    i3Empty.status === 'INCOMPLETE' && /NOT ADJUDICATED/.test(i3Empty.detail), i3Empty.status + ' — ' + i3Empty.detail);

  const partial = [{ id: 'ct-1', lane: 'X-Terra', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — first blocker on ct-1', verdict: 'REAL', second: 'REAL' }];
  const gPartial = scoreLib.gate12f(withBlockers, key, partial, scoreLib.identityExclusions(withBlockers));
  const i3Partial = gPartial.items.find((i) => i.n === 3);
  check('a PARTIAL adjudication (blocker findings left unadjudicated) is INCOMPLETE and names them',
    i3Partial.status === 'INCOMPLETE' && /PARTIALLY ADJUDICATED/.test(i3Partial.detail) && /ct-2/.test(i3Partial.detail),
    i3Partial.status + ' — ' + i3Partial.detail);

  const full = [];
  for (const id of ['ct-1', 'ct-2', 'ct-3']) {
    for (const t of ['[MAJOR] a.js:1 — first blocker on ' + id, '[MAJOR] a.js:9 — second blocker on ' + id]) {
      full.push({ id, lane: 'X-Terra', severity: 'MAJOR', finding: t, verdict: 'REAL', second: 'REAL' });
    }
  }
  const gFull = scoreLib.gate12f(withBlockers, key, full, scoreLib.identityExclusions(withBlockers));
  const i3Full = gFull.items.find((i) => i.n === 3);
  check('a COMPLETE adjudication with no NOISE/NOISE gives a real 0% PASS', i3Full.status === 'PASS' && /^0 MAJOR\/CRITICAL/.test(i3Full.detail), i3Full.status + ' — ' + i3Full.detail);

  const noBlockers = mkScored([]);
  const gNone = scoreLib.gate12f(noBlockers, key, [{ id: 'ct-1', lane: 'X-Terra', severity: 'MINOR', finding: 'x', verdict: 'DEBATABLE', second: 'DEBATABLE' }], scoreLib.identityExclusions(noBlockers));
  const i3None = gNone.items.find((i) => i.n === 3);
  check('a lane that genuinely produced NO blocker findings on controls can still reach a PASS',
    i3None.status === 'PASS', i3None.status + ' — ' + i3None.detail);
}

section('37. score.js — §2.5 adjudicated HIT promotions reach recall (openai-2 MAJOR score.js:318)');
{
  const key = {
    version: 1,
    artifacts: [
      { id: 'p-1', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'CRITICAL', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } },
      { id: 'p-2', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } },
    ],
  };
  // Round 3 (Anthropic MAJOR 4): a promotion's quote must be EVIDENCE — it has
  // to appear verbatim in that lane's own verdict text for that artifact and
  // cite the seed's locator file — and every entry must name a `lane`.
  const REAL_QUOTE = '[CRITICAL] a.js:1 — the seeded fault, cited by the reviewer in prose';
  // Round 5: the haystack is the FINDINGS SECTION, not the raw transcript.
  const findingsText = '- ' + REAL_QUOTE;
  const scored = [
    { id: 'p-1', lane: 'X-Terra', kind: 'seeded', hit: false, adjudicatedPromotion: false, order: 0, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1, severity: 'CRITICAL', findingsText },
    { id: 'p-2', lane: 'X-Terra', kind: 'seeded', hit: true, adjudicatedPromotion: false, order: 1, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1, severity: 'MAJOR', findingsText },
    { id: 'p-1', lane: 'X-Sol', kind: 'seeded', hit: false, adjudicatedPromotion: false, order: 0, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1, severity: 'CRITICAL', findingsText: 'VERDICT: APPROVE\n\nFINDINGS\n- none\n' },
  ];
  const adjudication = [
    { id: 'p-1', lane: 'X-Terra', verdict: 'HIT', quote: REAL_QUOTE },
    { id: 'p-2', lane: 'X-Terra', verdict: 'MISS', quote: 'not a hit' },
    { id: 'p-1', lane: 'X-Sol', verdict: 'HIT' },
  ];
  const res = scoreLib.applyAdjudicatedPromotions(scored, key, adjudication);
  check('openai-2 MAJOR score.js:318: an adjudicated HIT quoting the verdict PROMOTES the mechanical miss',
    scored[0].hit === true && scored[0].adjudicatedPromotion === true && scored[0].matchedVia === 'adjudication', JSON.stringify(scored[0]));
  check('the promotion is reported as its own count', res.promotions.length === 1 && res.promotions[0].id === 'p-1', JSON.stringify(res.promotions));
  check('adjudication NEVER demotes a mechanical hit', scored[1].hit === true && scored[1].adjudicatedPromotion === false);
  check('an adjudicated HIT with NO quoted line is REFUSED, and said so (§2.5 promotes "on a quoted citation")',
    res.rejected.some((r) => /no quoted line/.test(r.reason)), JSON.stringify(res.rejected));
  check('MAJOR 4: the promotion does NOT leak onto the other lane, whose verdict does not carry the quote',
    scored[2].hit === false, JSON.stringify(scored[2]));
  check('no --adjudication file means no promotions and no rejections',
    JSON.stringify(scoreLib.applyAdjudicatedPromotions(scored, key, null)) === '{"promotions":[],"rejected":[]}');

  // MAJOR 4's two demonstrated holes, closed.
  {
    const fresh = () => [{ id: 'p-1', lane: 'X-Terra', kind: 'seeded', hit: false, adjudicatedPromotion: false, order: 0, finalStatus: 'COMPLETED', attemptCount: 1, findingsText },
      { id: 'p-1', lane: 'X-Sol', kind: 'seeded', hit: false, adjudicatedPromotion: false, order: 0, finalStatus: 'COMPLETED', attemptCount: 1, findingsText },
      { id: 'p-1', lane: 'S-Opus', kind: 'seeded', hit: false, adjudicatedPromotion: false, order: 0, finalStatus: 'COMPLETED', attemptCount: 1, findingsText }];

    const noLane = fresh();
    const r1 = scoreLib.applyAdjudicatedPromotions(noLane, key, [{ id: 'p-1', verdict: 'HIT', quote: REAL_QUOTE }]);
    check('MAJOR 4: an entry with NO `lane` is REFUSED, not applied to every lane at once',
      r1.promotions.length === 0 && noLane.every((r) => r.hit === false) && /no `lane`/.test(r1.rejected[0].reason), JSON.stringify(r1));

    const noId = fresh();
    const r2 = scoreLib.applyAdjudicatedPromotions(noId, key, [{ lane: 'X-Terra', verdict: 'HIT', quote: REAL_QUOTE }]);
    check('MAJOR 4: an entry with no `id` is REFUSED', r2.promotions.length === 0 && /no `id`/.test(r2.rejected[0].reason), JSON.stringify(r2));

    const oneChar = fresh();
    const r3 = scoreLib.applyAdjudicatedPromotions(oneChar, key, [{ id: 'p-1', lane: 'X-Terra', verdict: 'HIT', quote: 'x' }]);
    check('MAJOR 4: a one-character "quote" is REFUSED as too short to be a citation',
      r3.promotions.length === 0 && /too short to be the quoted citation/.test(r3.rejected[0].reason), JSON.stringify(r3));

    const notInVerdict = fresh();
    const r3b = scoreLib.applyAdjudicatedPromotions(notInVerdict, key, [
      { id: 'p-1', lane: 'X-Terra', verdict: 'HIT', quote: '[CRITICAL] a.js:1 — a finding nobody actually wrote' }]);
    check('MAJOR 4: a long, locator-citing quote that is NOT in the verdict is still REFUSED',
      r3b.promotions.length === 0 && /does not appear in the FINDINGS SECTION/.test(r3b.rejected[0].reason), JSON.stringify(r3b));

    const wrongFile = fresh();
    const wrongQuote = '[CRITICAL] other/file.js:1 — a real line of the verdict, but not the locator';
    const wrongVerdict = 'VERDICT: REVISE\n\nFINDINGS\n- ' + wrongQuote + '\n';
    for (const r of wrongFile) r.findingsText = wrongVerdict;
    const r4 = scoreLib.applyAdjudicatedPromotions(wrongFile, key, [{ id: 'p-1', lane: 'X-Terra', verdict: 'HIT', quote: wrongQuote }]);
    check('MAJOR 4: a quote that is in the verdict but does NOT cite the locator file is REFUSED',
      r4.promotions.length === 0 && /does not cite the seed's locator file/.test(r4.rejected[0].reason), JSON.stringify(r4));
  }
}

section('38. run-lane.js — a phase runs in an INTERLEAVED, deterministic, lane-independent order (round-1 MINOR 2)');
{
  // A phase laid out the way base-pool.json actually lays one out: every
  // seeded slot first, then every control.
  const phase = 1;
  const artifacts = [];
  for (let i = 1; i <= 8; i++) artifacts.push({ id: 'sdc-' + String(i).padStart(3, '0'), kind: 'seeded', phase, variant: 'V1' });
  for (let i = 9; i <= 24; i++) artifacts.push({ id: 'sdc-' + String(i).padStart(3, '0'), kind: 'control', phase, variant: 'V1' });

  const ordered = runLaneLib.phaseRunOrder(artifacts, phase);
  check('the run order keeps every artifact exactly once', ordered.length === artifacts.length &&
    new Set(ordered.map((a) => a.id)).size === artifacts.length, String(ordered.length));

  // Determinism: same call twice, and from a shuffled input array.
  const again = runLaneLib.phaseRunOrder(artifacts, phase);
  check('MINOR 2: the order is IDENTICAL across two calls',
    ordered.map((a) => a.id).join(',') === again.map((a) => a.id).join(','), ordered.map((a) => a.id).join(','));
  const shuffled = artifacts.slice().reverse();
  check('the order does not depend on the input array\'s own order',
    runLaneLib.phaseRunOrder(shuffled, phase).map((a) => a.id).join(',') === ordered.map((a) => a.id).join(','));

  // Lane independence: the key is phase + id, never the lane, so both X-lanes
  // see the same sequence and any order effect lands on both arms equally.
  const asSol = runLaneLib.phaseRunOrder(artifacts.map((a) => Object.assign({}, a, { lane: 'X-Sol' })), phase);
  const asTerra = runLaneLib.phaseRunOrder(artifacts.map((a) => Object.assign({}, a, { lane: 'X-Terra' })), phase);
  check('MINOR 2: the order is IDENTICAL across lanes',
    asSol.map((a) => a.id).join(',') === asTerra.map((a) => a.id).join(','));

  // Interleaving: seeds must not all precede controls any more.
  const kinds = ordered.map((a) => a.kind);
  const lastSeed = kinds.lastIndexOf('seeded');
  const firstControl = kinds.indexOf('control');
  check('MINOR 2: seeds and controls INTERLEAVE — not all seeds first',
    firstControl < lastSeed, 'first control at ' + firstControl + ', last seed at ' + lastSeed + ' — ' + kinds.join(''));
  check('at least one control runs before the first phase-position a seed had in corpus order',
    firstControl < 8, 'first control at run position ' + firstControl);
  // A different phase number must produce a different permutation (the phase
  // is part of the key, so phase 2's order is not a copy of phase 1's).
  check('the phase is part of the key — a different phase permutes differently',
    runLaneLib.phaseRunOrder(artifacts, 2).map((a) => a.id).join(',') !== ordered.map((a) => a.id).join(','));

  // End-to-end: --dry-run prints the order, and it matches phaseRunOrder().
  const repo = makeSourceRepo();
  const dir = tmpDir('wo12-runorder-');
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const real = [];
  for (let i = 1; i <= 6; i++) {
    const kind = i <= 3 ? 'seeded' : 'control';
    const id = 'sdc-' + String(i).padStart(3, '0');
    real.push({ id, kind, phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  const keyPath = writeKey(dir, real);
  function dryRunOrder(lane) {
    const r = runLane(['--lane', lane, '--phase', '0', '--dry-run', '--key', keyPath, '--briefs-dir', briefs,
      '--source-repo', repo.dir, '--results-dir', dir, '--runner', path.join(dir, 'x.js')]);
    if (r.status !== 0) return { err: r.stderr, ids: [] };
    const block = (r.stdout || '').split('RUN ORDER (phase 0):')[1] || '';
    const ids = [];
    for (const line of block.split('\n')) {
      const m = /^\s+\d+\.\s+(\S+)\s+(seeded|control)/.exec(line);
      if (m) ids.push(m[1]);
      else if (/seeded at run positions/.test(line)) break;
    }
    return { stdout: r.stdout, ids };
  }
  const solRun = dryRunOrder('X-Sol');
  const terraRun = dryRunOrder('X-Terra');
  check('--dry-run PRINTS the run order', solRun.ids.length === 6, JSON.stringify(solRun.ids) + (solRun.err || ''));
  check('the printed order matches phaseRunOrder() exactly',
    solRun.ids.join(',') === runLaneLib.phaseRunOrder(real, 0).map((a) => a.id).join(','),
    solRun.ids.join(',') + ' vs ' + runLaneLib.phaseRunOrder(real, 0).map((a) => a.id).join(','));
  check('MINOR 2: the printed order is the same on both lanes', solRun.ids.join(',') === terraRun.ids.join(','),
    solRun.ids.join(',') + ' vs ' + terraRun.ids.join(','));
  check('--dry-run discloses the corpus position of each artifact', /corpus position \d+\/6/.test(solRun.stdout || ''), (solRun.stdout || '').slice(0, 1500));
  check('--dry-run reports where the seeds and the controls landed',
    /seeded at run positions:/.test(solRun.stdout || '') && /controls at run positions:/.test(solRun.stdout || ''), solRun.stdout);
  check('the header says the dispatch is NOT corpus order', /not corpus order/.test(solRun.stdout || ''), (solRun.stdout || '').slice(0, 800));
}

section('39. run-lane.js / score.js — runIndex is recorded, and the streak is measured over it');
{
  const repo = makeSourceRepo();
  const dir = tmpDir('wo12-runidx-');
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [];
  for (let i = 1; i <= 3; i++) {
    const id = 'sdc-00' + i;
    artifacts.push({ id, kind: i === 1 ? 'seeded' : 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  // ri-1 is seeded but has no patch; make it a control so the run completes.
  artifacts[0].kind = 'control';
  const keyPath = writeKey(dir, artifacts);
  const stubs = tmpDir('wo12-runidxstub-');
  const runner = writeStub(stubs, 'ok.js', 'process.stdout.write("REVIEW ENGINE: codex model: gpt-5.6-terra\\n\\nVERDICT: APPROVE\\n\\nFINDINGS\\n- none\\n");\n');
  const green = qmStubJson(stubs, 'green.js', ouState(0.85));
  const r = runLane(['--lane', 'X-Terra', '--phase', '0', '--yes', '--key', keyPath, '--briefs-dir', briefs,
    '--patches-dir', dir, '--source-repo', repo.dir, '--results-dir', dir,
    '--clone-root', path.join(dir, 'clone'), '--run-clone-root', path.join(dir, 'run'), '--runner', runner],
  { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('the run completes', r.status === 0, (r.stderr || '') + (r.stdout || '').slice(-600));
  const recs = JSON.parse(fs.readFileSync(path.join(dir, 'results-X-Terra-phase0.json'), 'utf8'));
  check('every record carries a runIndex', recs.every((x) => typeof x.runIndex === 'number'), JSON.stringify(recs.map((x) => x.runIndex)));
  check('runIndex is 0..n-1 in dispatch order', recs.map((x) => x.runIndex).join(',') === '0,1,2', JSON.stringify(recs.map((x) => x.runIndex)));
  check('the records are written in DISPATCH order and name their ids, so corpus order is recoverable from key.json',
    recs.map((x) => x.id).join(',') === runLaneLib.phaseRunOrder(artifacts, 0).map((a) => a.id).join(','),
    recs.map((x) => x.id).join(','));

  // The streak rule must read execution order, not corpus order. Corpus order
  // here would break the run of three into a non-streak.
  const key = { version: 1, artifacts };
  const mkRec = (id, runIndex, status) => ({
    id, lane: 'X-Terra', phase: 0, variant: 'V1', runIndex,
    attempts: [{ wallMs: 1, verdict: status === 'UNAVAILABLE' ? 'REVIEW_UNAVAILABLE' : 'APPROVE', status, engineHeader: 'REVIEW ENGINE: codex model: gpt-5.6-terra', integrityWarning: false, stdout: 'VERDICT: x\n' }],
    expectedModel: 'gpt-5.6-terra',
  });
  // Corpus order ri-1, ri-2, ri-3; executed ri-3, ri-1, ri-2 with the last two
  // UNAVAILABLE — a streak of 2 as run, and a NON-streak read in corpus order.
  const streakScored = scoreLib.scoreRecords([
    mkRec('sdc-003', 0, 'COMPLETED'), mkRec('sdc-001', 1, 'UNAVAILABLE'), mkRec('sdc-002', 2, 'UNAVAILABLE'),
  ], key, {}).scored;
  const withRunIndex = scoreLib.gate12f(streakScored, key, null, scoreLib.identityExclusions(streakScored));
  check('scoreRecords carries runIndex through', streakScored.every((s) => typeof s.runIndex === 'number'), JSON.stringify(streakScored.map((s) => s.runIndex)));
  const stripped = streakScored.map((s) => Object.assign({}, s, { runIndex: null }));
  const stab = scoreLib.gate12f(streakScored, key, null, scoreLib.identityExclusions(streakScored));
  check('the streak is measured over EXECUTION order (2 consecutive UNAVAILABLE as run)',
    /max streak 2/.test(stab.items.find((i) => i.n === 6).detail), stab.items.find((i) => i.n === 6).detail);
  const strippedStab = scoreLib.gate12f(stripped, key, null, scoreLib.identityExclusions(stripped));
  check('a record with no runIndex (a hand-transcribed S-lane) still falls back to corpus order without crashing',
    /max streak/.test(strippedStab.items.find((i) => i.n === 6).detail), strippedStab.items.find((i) => i.n === 6).detail);
  check('gate 6 is computed at all', typeof withRunIndex.items.find((i) => i.n === 6).detail === 'string');
}

section('40. assemble-key.js — the KIND ruling is stated in the header AND in CONSTRUCTION.md');
{
  const src = fs.readFileSync(ASSEMBLE_KEY, 'utf8');
  // The header is a wrapped block comment, so match against it with the
  // comment prefixes stripped and whitespace collapsed.
  const header = src.slice(0, src.indexOf("'use strict'")).replace(/^\s*\*+ ?/gm, ' ').replace(/\s+/g, ' ');
  check('the module header states the KIND ruling', /KIND is declared POOL-WIDE as `code`/.test(header), header.slice(-900));
  check('the header gives the rationale — seeded bases are all code', /All 30 seeded bases are code commits/.test(header), header.slice(-900));
  check('the header says a per-commit KIND would separate the populations',
    /would therefore put `docs` on controls ONLY/.test(header) && /100% precision/.test(header), header.slice(-900));
  check('POOL_DECLARED_KIND is `code`', assembleKeyLib.POOL_DECLARED_KIND === 'code');
  check('resolveKind falls back to the pool-wide declaration', assembleKeyLib.resolveKind({ id: 'x' }) === 'code');
  check('resolveKind prefers an explicit per-slot field when one exists', assembleKeyLib.resolveKind({ id: 'x', base_kind: 'mixed' }) === 'mixed');
  check('an unrecognized per-slot KIND falls back rather than inventing a vocabulary',
    assembleKeyLib.resolveKind({ id: 'x', base_kind: 'nonsense' }) === 'code');

  // CONSTRUCTION.md — rendered, not assumed.
  const key = { version: 1, artifacts: [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null },
  ] };
  const rows = [
    { id: 'sdc-001', kind: 'seeded', variant: 'V1', baseKind: 'code', orderWords: 90, claimsWords: 50 },
    { id: 'sdc-002', kind: 'control', variant: 'V1', baseKind: 'code', orderWords: 88, claimsWords: 47 },
  ];
  const md = assembleKeyLib.renderConstructionMd(key, assembleKeyLib.computeTallies(key), { 'sdc-001': 'h' }, rows,
    { seeds: { 'sdc-001': { target_severity: 'MAJOR', achieved_severity: 'MAJOR' } } },
    { woSkeletons: 1, erByVariant: { V1: 1 }, kinds: ['code'], asymmetricKinds: 0 });
  const mdFlat = md.replace(/\s+/g, ' ');
  check('CONSTRUCTION.md carries a "The KIND ruling" section', /### The KIND ruling/.test(md), md.slice(0, 400));
  check('CONSTRUCTION.md states the pool-wide declaration', /KIND is declared pool-wide as `code`/.test(mdFlat));
  check('CONSTRUCTION.md gives the rationale a corpus reader needs',
    /All 30 seeded bases are code commits/.test(mdFlat) && /would put `docs` on controls ONLY/.test(mdFlat),
    md.slice(md.indexOf('### The KIND ruling'), md.indexOf('### The KIND ruling') + 1400));
  check('CONSTRUCTION.md names the lint that keeps the ruling honest', /lintKindSymmetry\(\)` fails assembly closed/.test(mdFlat));
}

section('41. assemble-key.js — corpus/content/ is INPUT: a control file survives EVERY mode, byte-for-byte');
{
  // The 2026-08-31 incident: 54 control content files, authored concurrently by
  // other agents, were destroyed during round-2 tooling work. These checks make
  // the invariant provable rather than merely intended.
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-content-guard-');
  const contentDir = path.join(work, 'content');
  const briefsDir = path.join(work, 'briefs');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(briefsDir, { recursive: true });

  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  return a - b;\n}\n');
  });
  const slots = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
  ];
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(work, 'sdc-001.seed.json'), JSON.stringify({
    id: 'sdc-001', base: repo.base, commit: repo.commit, phase: 0, variant: 'V1',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');
  // The round-1 briefs the importer mines for the SEEDED slot.
  fs.writeFileSync(path.join(briefsDir, 'sdc-001.wo.txt'),
    'REVIEW PACKET — review a completed, already-merged change.\n\nCommit subject:      ' + REAL_SUBJECT +
    '\n\nORDER:\n\n' + Array(90).fill('word').join(' ') + '\n\nAudit the diff between base and head against that stated intent.\n', 'utf8');
  fs.writeFileSync(path.join(briefsDir, 'sdc-001.er.txt'),
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'a'.repeat(40) + '. An executor produced this change. ' +
    'We ' + Array(44).fill('verified').join(' ') + '.\n', 'utf8');
  const poolPath = path.join(work, 'base-pool.json');
  fs.writeFileSync(poolPath, JSON.stringify({ slots }, null, 2), 'utf8');

  // A CONTROL content file, written by "another agent", with distinctive bytes
  // (trailing whitespace, CRLF, no trailing newline) so any rewrite shows up.
  const controlFile = path.join(contentDir, 'sdc-002.json');
  const CONTROL_BYTES = Buffer.from('{\r\n  "order": "' + Array(90).fill('control').join(' ') + '",\r\n  "claims": "' + Array(45).fill('theirs').join(' ') + '"   \r\n}', 'utf8');
  fs.writeFileSync(controlFile, CONTROL_BYTES);
  const controlDigest = () => fs.readFileSync(controlFile);

  const cliArgs = ['--pool', poolPath, '--corpus-dir', work, '--briefs-dir', briefsDir, '--content-dir', contentDir,
    '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')];

  // (a) --import-legacy-briefs
  const rImport = spawnSync(process.execPath, [ASSEMBLE_KEY, '--import-legacy-briefs'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('import exits 0', rImport.status === 0, (rImport.stderr || '') + (rImport.stdout || ''));
  check('INCIDENT GUARD: a pre-existing CONTROL content file survives --import-legacy-briefs byte-for-byte',
    controlDigest().equals(CONTROL_BYTES), JSON.stringify(controlDigest().toString('utf8')));
  check('the import reports the control file as left untouched, byte-for-byte, and NAMES it',
    /left 1 existing content file\(s\) untouched, byte-for-byte \(sdc-002\.json\)/.test(rImport.stdout || ''), rImport.stdout);
  check('the seeded content file WAS created', fs.existsSync(path.join(contentDir, 'sdc-001.json')));

  // (b) a second import must not rewrite the seeded file it just created.
  const seededBytes = fs.readFileSync(path.join(contentDir, 'sdc-001.json'));
  const rImport2 = spawnSync(process.execPath, [ASSEMBLE_KEY, '--import-legacy-briefs'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('a second import exits 0 and writes nothing', rImport2.status === 0 && /wrote 0 content file\(s\)/.test(rImport2.stdout || ''), rImport2.stdout);
  check('INCIDENT GUARD: the seeded content file is unchanged by a second import', fs.readFileSync(path.join(contentDir, 'sdc-001.json')).equals(seededBytes));
  check('INCIDENT GUARD: the control file is STILL byte-identical after a second import', controlDigest().equals(CONTROL_BYTES));

  // (c) --check-only
  const rCheck = spawnSync(process.execPath, [ASSEMBLE_KEY, '--check-only'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('INCIDENT GUARD: the control file survives --check-only byte-for-byte', controlDigest().equals(CONTROL_BYTES),
    'check-only said: ' + (rCheck.stdout || '') + (rCheck.stderr || ''));

  // (d) a FULL assembly (the real thing on this mini pool, not a mock).
  const rFull = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('the full assembly exits 0', rFull.status === 0, (rFull.stderr || '') + (rFull.stdout || ''));
  check('INCIDENT GUARD: the control file survives a FULL ASSEMBLY byte-for-byte', controlDigest().equals(CONTROL_BYTES),
    JSON.stringify(controlDigest().toString('utf8')));
  check('INCIDENT GUARD: the seeded content file survives a full assembly byte-for-byte', fs.readFileSync(path.join(contentDir, 'sdc-001.json')).equals(seededBytes));
  check('a full assembly writes only briefs/key/notes/CONSTRUCTION.md — content/ gains nothing',
    fs.readdirSync(contentDir).sort().join(',') === 'IMPORT-REPORT.md,sdc-001.json,sdc-002.json', fs.readdirSync(contentDir).sort().join(','));

  // (e) the unit guards themselves.
  let threwControl = null;
  try { assembleKeyLib.guardedWriteContentFile(contentDir, { id: 'sdc-002', kind: 'control' }, { order: 'x', claims: 'y' }); } catch (e) { threwControl = e; }
  check('guardedWriteContentFile REFUSES a control slot outright',
    !!threwControl && /only SEEDED slots may be imported/.test(threwControl.message), threwControl && threwControl.message);
  check('…and the control file is untouched by the attempt', controlDigest().equals(CONTROL_BYTES));

  let threwExisting = null;
  try { assembleKeyLib.guardedWriteContentFile(contentDir, { id: 'sdc-001', kind: 'seeded' }, { order: 'x', claims: 'y' }); } catch (e) { threwExisting = e; }
  check('guardedWriteContentFile REFUSES to overwrite an existing seeded file (O_EXCL, not check-then-write)',
    !!threwExisting && /refusing to overwrite the existing/.test(threwExisting.message), threwExisting && threwExisting.message);
  check('…and that file is untouched by the attempt', fs.readFileSync(path.join(contentDir, 'sdc-001.json')).equals(seededBytes));

  // (f) the after-the-fact assertion catches a deletion or a rewrite.
  const snap = assembleKeyLib.snapshotContentDir(contentDir);
  check('snapshotContentDir captures every file', snap.size === 3, String(snap.size));
  const scratch = tmpDir('wo12-guard-scratch-');
  fs.writeFileSync(path.join(scratch, 'a.json'), 'one', 'utf8');
  const before = assembleKeyLib.snapshotContentDir(scratch);
  fs.rmSync(path.join(scratch, 'a.json'));
  let threwDeleted = null;
  try { assembleKeyLib.assertContentDirPreserved(scratch, before, [], 'a test'); } catch (e) { threwDeleted = e; }
  check('assertContentDirPreserved catches a DELETED content file',
    !!threwDeleted && /a\.json was DELETED/.test(threwDeleted.message), threwDeleted && threwDeleted.message);
  fs.writeFileSync(path.join(scratch, 'a.json'), 'two', 'utf8');
  let threwOverwritten = null;
  try { assembleKeyLib.assertContentDirPreserved(scratch, before, [], 'a test'); } catch (e) { threwOverwritten = e; }
  check('assertContentDirPreserved catches an OVERWRITTEN content file',
    !!threwOverwritten && /a\.json was OVERWRITTEN/.test(threwOverwritten.message), threwOverwritten && threwOverwritten.message);
  fs.writeFileSync(path.join(scratch, 'a.json'), 'one', 'utf8');
  fs.writeFileSync(path.join(scratch, 'b.json'), 'new', 'utf8');
  let threwCreated = null;
  try { assembleKeyLib.assertContentDirPreserved(scratch, before, [], 'a test'); } catch (e) { threwCreated = e; }
  check('assertContentDirPreserved catches an UNAUTHORIZED new content file',
    !!threwCreated && /b\.json was CREATED without authorization/.test(threwCreated.message), threwCreated && threwCreated.message);
  let ok = true;
  try { assembleKeyLib.assertContentDirPreserved(scratch, before, ['b.json'], 'a test'); } catch (e) { ok = false; }
  check('an AUTHORIZED new file is allowed', ok === true);

  // (g) no code path anywhere in the four scripts removes corpus/content/.
  for (const f of [BUILD_CORPUS, RUN_LANE, SCORE, ASSEMBLE_KEY]) {
    const src = fs.readFileSync(f, 'utf8');
    const removals = (src.match(/fs\.(rmSync|rmdirSync|unlinkSync|rm)\([^)]*\)/g) || []);
    const nearContent = removals.filter((r) => /content/i.test(r));
    check(path.basename(f) + ' contains no removal call naming a content path', nearContent.length === 0, nearContent.join(' | '));
  }
}

// ============================================================ ROUND 3
// roster/wo12-r0-review-anthropic-2.md and roster/wo12-r0-review-openai-3.md

section('42. build-corpus.js — artifact ids are validated before any path join or recursive delete (openai-3 CRITICAL build-corpus.js:364)');
{
  const bad = ['../victim', 'sdc-1', 'sdc-0001', 'SDC-001', '', null, undefined, 'sdc-001/..', 'sdc-001\\..', '..', '.',
    'sdc-001 ', ' sdc-001', 'sdc-abc', 42, {}];
  for (const id of bad) {
    let threw = null;
    try { buildCorpusLib.assertSafeArtifactId(id, 'test'); } catch (e) { threw = e; }
    check('unsafe artifact id ' + JSON.stringify(id) + ' is REFUSED', !!threw && /unsafe artifact id/.test(threw.message), threw && threw.message);
  }
  for (const id of ['sdc-001', 'sdc-084', 'sdc-999']) {
    check('valid artifact id ' + id + ' is accepted', buildCorpusLib.assertSafeArtifactId(id, 'test') === id);
  }

  // The live scenario the record demonstrated: an id that escapes the run-clone
  // root and deletes a sibling. The sentinel must survive.
  const root = tmpDir('wo12-idesc-');
  const victim = path.join(root, 'victim');
  fs.mkdirSync(victim, { recursive: true });
  const sentinel = path.join(victim, 'SENTINEL.txt');
  fs.writeFileSync(sentinel, 'do not delete me', 'utf8');
  const runRoot = path.join(root, 'runs');
  fs.mkdirSync(runRoot, { recursive: true });

  let threwPrepare = null;
  try { buildCorpusLib.prepareRunClone(tmpDir('wo12-idesc-bc-'), 'a'.repeat(40), path.join(runRoot, '..', 'victim'), null); }
  catch (e) { threwPrepare = e; }
  check('openai-3 CRITICAL: prepareRunClone REFUSES a run dir whose final component is not an artifact id',
    !!threwPrepare && /not a valid artifact id/.test(threwPrepare.message), threwPrepare && threwPrepare.message);
  check('openai-3 CRITICAL: the sibling directory and its sentinel SURVIVE',
    fs.existsSync(sentinel) && fs.readFileSync(sentinel, 'utf8') === 'do not delete me', sentinel);

  // And the same id is refused at the door, by loadKey and materializeArtifact.
  const kdir = tmpDir('wo12-idkey-');
  const keyPath = path.join(kdir, 'key.json');
  fs.writeFileSync(keyPath, JSON.stringify({ version: 1, artifacts: [{ id: '../victim', kind: 'control', phase: 0, base: 'b', commit: 'c' }] }), 'utf8');
  let threwKey = null;
  try { buildCorpusLib.loadKey(keyPath); } catch (e) { threwKey = e; }
  check('loadKey REFUSES a key.json carrying an unsafe id', !!threwKey && /unsafe artifact id/.test(threwKey.message), threwKey && threwKey.message);
  let threwMat = null;
  try { buildCorpusLib.materializeArtifact({ id: '../victim', kind: 'control', base: 'b', commit: 'c' }, kdir, kdir, {}); } catch (e) { threwMat = e; }
  check('materializeArtifact REFUSES an unsafe id before touching git', !!threwMat && /unsafe artifact id/.test(threwMat.message), threwMat && threwMat.message);
}

section('43. build-corpus.js — the key-absence assertion is PATH-based and never skips silently (anthropic-2 MINOR)');
{
  const repo = makeSourceRepo();
  const keyRel = 'plans/cross-compare/agent-role-architecture/wo12/corpus/key.json';
  fs.mkdirSync(path.join(repo.dir, path.dirname(keyRel)), { recursive: true });
  fs.writeFileSync(path.join(repo.dir, keyRel), '{"version":1,"artifacts":[]}\n', 'utf8');
  git(['add', '-A'], repo.dir);
  git(['commit', '-q', '-m', 'add a key the run clone must not reach'], repo.dir);

  const work = tmpDir('wo12-keypath-');
  const clone = path.join(work, 'clone');
  buildCorpusLib.ensureClone(repo.dir, clone);
  const runDir = path.join(work, 'run', 'sdc-001');
  // Materialize the CONTROL at the pre-key base: its tree has no wo12/ at all.
  const mat = buildCorpusLib.materializeArtifact(
    { id: 'sdc-001', kind: 'control', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT },
    clone, work, { keyBlobSha: null, runCloneDir: runDir });
  check('the sanitized clone is built even with NO key blob sha available', !!mat.runCloneDir);
  check('anthropic-2 MINOR: the path-based assertions ran', (() => {
    const r = buildCorpusLib.sanitizeClone(runDir, mat.head, null);
    return r.pathAssertionsRan === true && r.keyBlobChecked === false;
  })(), 'sanitizeClone should report which assertions ran');
  check('the corpus path is absent from the run clone\'s tree', gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'plans/cross-compare/agent-role-architecture/wo12/corpus'], runDir).stdout.trim() === '');

  // A clone that DOES carry the corpus path must be caught by the path rule
  // even when the blob sha is unavailable — the case the blob-only assertion
  // could not see.
  const dirty = path.join(work, 'dirty');
  spawnSync('git', ['clone', '--quiet', repo.dir, dirty], { encoding: 'utf8' });
  git(['checkout', '--quiet', '--detach', 'HEAD'], dirty);
  let threwDirty = null;
  try { buildCorpusLib.sanitizeClone(dirty, git(['rev-parse', 'HEAD'], dirty), null); } catch (e) { threwDirty = e; }
  check('anthropic-2 MINOR: a clone whose HEAD tree carries the corpus is REFUSED by the PATH rule, with no blob sha in hand',
    !!threwDirty && /TREE contains corpus path/.test(threwDirty.message), threwDirty && threwDirty.message);
}

section('44. run-lane.js — no-verdict runs are UNAVAILABLE, retried, and counted (anthropic-2 MAJOR 3)');
{
  check('NO_VERDICT_LINE is a dead status', runLaneLib.isDeadStatus('NO_VERDICT_LINE') === true);
  check('SPAWN_FAILED is a dead status', runLaneLib.isDeadStatus('SPAWN_FAILED (ENOENT)') === true);
  check('KILLED_AT_OUTER_TIMEOUT is a dead status', runLaneLib.isDeadStatus('KILLED_AT_OUTER_TIMEOUT (SIGTERM)') === true);
  check('COMPLETED is not', runLaneLib.isDeadStatus('COMPLETED') === false);
  check('a dead attempt counts as UNAVAILABLE for retry/stop/scoring',
    runLaneLib.isUnavailableAttempt({ status: 'NO_VERDICT_LINE' }) === true &&
    runLaneLib.isUnavailableAttempt({ status: 'UNAVAILABLE' }) === true &&
    runLaneLib.isUnavailableAttempt({ status: 'COMPLETED' }) === false);

  // A runner that exits 0 printing nothing at all.
  const dir = tmpDir('wo12-noverdict-');
  const silent = writeStub(dir, 'silent.js', 'process.stdout.write("nothing to say\\n");\n');
  const a = runLaneLib.runOneAttempt(silent, 'wo', 'er', 'base', 'head', dir, 5000, LANE_TERRA);
  check('anthropic-2 MAJOR 3: a runner that prints no VERDICT line is NO_VERDICT_LINE', a.status === 'NO_VERDICT_LINE', JSON.stringify(a.status));
  check('…and it is marked unavailable with reason `no-verdict`', a.unavailable === true && a.unavailableReason === 'no-verdict', JSON.stringify(a));

  // A2 MINOR: the space spelling.
  check('anthropic-2 MINOR: "REVIEW UNAVAILABLE" (space) classifies as UNAVAILABLE',
    runLaneLib.classifyVerdict('REVIEW UNAVAILABLE') === 'UNAVAILABLE');
  check('anthropic-2 MINOR: "UNAVAILABLE_ENGINE" classifies as UNAVAILABLE',
    runLaneLib.classifyVerdict('UNAVAILABLE_ENGINE') === 'UNAVAILABLE');
  check('"REVIEW_UNAVAILABLE" still classifies as UNAVAILABLE', runLaneLib.classifyVerdict('REVIEW_UNAVAILABLE') === 'UNAVAILABLE');
  check('a verdict merely MENTIONING the word is still COMPLETED',
    runLaneLib.classifyVerdict('APPROVE — correct when the engine is unavailable') === 'COMPLETED');

  // End to end: a lane that dies without a verdict is retried once and halts phase 0.
  const repo = makeSourceRepo();
  const c = tmpDir('wo12-noverdict-e2e-');
  const briefs = path.join(c, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [];
  for (let i = 1; i <= 5; i++) {
    const id = 'sdc-00' + i;
    artifacts.push({ id, kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  const keyPath = writeKey(c, artifacts);
  const stubs = tmpDir('wo12-noverdict-stub-');
  const green = qmStubJson(stubs, 'green.js', ouState(0.85));
  const r = runLane(['--lane', 'X-Terra', '--phase', '0', '--yes', '--key', keyPath, '--briefs-dir', briefs,
    '--patches-dir', c, '--source-repo', repo.dir, '--results-dir', c,
    '--clone-root', path.join(c, 'clone'), '--run-clone-root', path.join(c, 'run'), '--runner', silent],
  { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('anthropic-2 MAJOR 3: phase 0 HALTS on no-verdict runs (they used to be invisible to the stop rule)',
    r.status !== 0 && /HALTING phase 0/.test(r.stderr || ''), (r.stderr || '').slice(0, 400));
  const recs = JSON.parse(fs.readFileSync(path.join(c, 'results-X-Terra-phase0.json'), 'utf8'));
  check('each no-verdict artifact was RETRIED once, like any other UNAVAILABLE (§2.5)',
    recs.every((x) => x.attempts.length === 2), JSON.stringify(recs.map((x) => x.attempts.length)));
}

section('45. score.js — no-verdict lanes cannot read PASS (anthropic-2 MAJOR 3)');
{
  const artifacts = [];
  for (let i = 1; i <= 30; i++) artifacts.push({ id: 'sd-' + i, kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } });
  for (let i = 1; i <= 54; i++) artifacts.push({ id: 'ct-' + i, kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null });
  const key = { version: 1, artifacts };
  const recs = [];
  for (const lane of ['X-Sol', 'X-Terra']) {
    for (const a of artifacts) {
      const dead = lane === 'X-Terra';
      recs.push({
        id: a.id, lane, phase: 0, variant: 'V1', expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane], runIndex: 0,
        attempts: [{
          wallMs: 1, verdict: dead ? '(none)' : 'APPROVE', status: dead ? 'NO_VERDICT_LINE' : 'COMPLETED',
          unavailable: dead, unavailableReason: dead ? 'no-verdict' : null,
          engineHeader: dead ? null : 'REVIEW ENGINE: codex model: ' + scoreLib.LANE_EXPECTED_MODEL[lane],
          integrityWarning: false,
          stdout: dead ? 'the runner died\n' : 'VERDICT: APPROVE\n\nFINDINGS\n- [MAJOR] a.js:1 — found it\n',
        }],
      });
    }
  }
  const { scored } = scoreLib.scoreRecords(recs, key, {});
  const terra = scored.filter((r) => r.lane === 'X-Terra');
  check('a no-verdict record scores as unavailable, not as a completed 0-hit run',
    terra.every((r) => r.unavailableFinal === true && r.noVerdict === true), JSON.stringify(terra[0]));
  const g = scoreLib.gate12f(scored, key, null, scoreLib.identityExclusions(scored));
  const item = (n) => g.items.find((i) => i.n === n);
  check('anthropic-2 MAJOR 3: gate 6 (stability) is INCOMPLETE, never PASS at 0%',
    item(6).status === 'INCOMPLETE' && /NO VERDICT/.test(item(6).detail), item(6).status + ' — ' + item(6).detail);
  check('anthropic-2 MAJOR 3: gate 5 (identity) is INCOMPLETE, not a PASS over runs that never ran',
    item(5).status === 'INCOMPLETE', item(5).status + ' — ' + item(5).detail);
  check('anthropic-2 MAJOR 3: gate 1 is INCOMPLETE, not FAIL — the lane was not measured',
    item(1).status === 'INCOMPLETE' && /NO VERDICT/.test(item(1).detail), item(1).status + ' — ' + item(1).detail);
  check('the stability rate now COUNTS the dead runs rather than ignoring them',
    /84\/84/.test(item(6).detail) && /no-verdict×84/.test(item(6).detail), item(6).detail);
}

section('46. score.js — the exact-path suffix tier is gone (anthropic-2 MAJOR 2)');
{
  check('anthropic-2 MAJOR 2: a vendored copy under another directory is NOT an exact-path match',
    scoreLib.classifyFileMatch('codex/hooks/orchestra-guard.js', 'hooks/orchestra-guard.js') === 'basename-only',
    String(scoreLib.classifyFileMatch('codex/hooks/orchestra-guard.js', 'hooks/orchestra-guard.js')));
  check('the reverse direction is likewise not exact-path',
    scoreLib.classifyFileMatch('hooks/orchestra-guard.js', 'codex/hooks/orchestra-guard.js') === 'basename-only');
  check('an equal path IS exact-path', scoreLib.classifyFileMatch('hooks/orchestra-guard.js', 'hooks/orchestra-guard.js') === 'exact-path');
  check('a `./`-prefixed citation of the locator IS exact-path',
    scoreLib.classifyFileMatch('./hooks/orchestra-guard.js', 'hooks/orchestra-guard.js') === 'exact-path');
  check('a backslash-spelled citation of the locator IS exact-path',
    scoreLib.classifyFileMatch('hooks\\orchestra-guard.js', 'hooks/orchestra-guard.js') === 'exact-path');
  check('an unrelated file is no match at all', scoreLib.classifyFileMatch('router/router.js', 'hooks/orchestra-guard.js') === null);

  // sdc-061's live scenario: the pack copy is a legitimate finding about a file
  // the diff does not touch, and must NOT be credited with the seed.
  const seed = { locator: { file: 'hooks/orchestra-guard.js', lines: [339, 345], symbol: 'guard' } };
  const packCopy = ['[MAJOR] codex/hooks/orchestra-guard.js:339 — the pack copy was not updated to match'];
  const res = scoreLib.evaluateSeedHit(seed, packCopy, {});
  check('anthropic-2 MAJOR 2: a finding about the vendored copy is NOT a hit on sdc-061\'s seed',
    res.hit === false, JSON.stringify(res));
  check('…and it is reported as a basename-only near miss for adjudication',
    res.nearMisses.length === 1 && res.nearMisses[0].reason === 'path', JSON.stringify(res.nearMisses));
  check('the real file at the real path IS still a hit',
    scoreLib.evaluateSeedHit(seed, ['[MAJOR] hooks/orchestra-guard.js:340 — the seeded fault'], {}).hit === true);
}

section('47. score.js — identity: known families, and the echoed-request evidence limit (openai-3 CRITICAL score.js:427)');
{
  check('a header naming a DIFFERENT known family is MISMATCHED',
    scoreLib.classifyIdentity('REVIEW ENGINE: codex model: gpt-5.6-sol', 'gpt-5.6-terra') === 'MISMATCHED');
  check('a header naming an UNKNOWN model is MISMATCHED, not unknown-then-excluded',
    scoreLib.classifyIdentity('REVIEW ENGINE: codex model: gpt-4o', 'gpt-5.6-terra') === 'MISMATCHED');
  check('`REVIEW ENGINE: NONE` is UNKNOWN — an absence of identity, not a wrong one',
    scoreLib.classifyIdentity('REVIEW ENGINE: NONE — no cross-vendor review was produced.', 'gpt-5.6-terra') === 'UNKNOWN');
  check('the lane\'s own model is MATCHED', scoreLib.classifyIdentity('REVIEW ENGINE: codex model: gpt-5.6-terra', 'gpt-5.6-terra') === 'MATCHED');
  check('the known-family list carries both castings of §2.4',
    scoreLib.KNOWN_MODEL_FAMILIES.indexOf('gpt-5.6-sol') !== -1 && scoreLib.KNOWN_MODEL_FAMILIES.indexOf('gpt-5.6-terra') !== -1);

  check('openai-3 CRITICAL: a MATCHED header built from the REQUESTED model is labelled echoed-request evidence',
    scoreLib.identityEvidence('REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-terra, sandbox: …)', 'gpt-5.6-terra') === 'echoed-request');
  check('a header carrying a served_model line counts as INDEPENDENT evidence',
    scoreLib.identityEvidence('REVIEW ENGINE: codex served_model: gpt-5.6-terra', 'gpt-5.6-terra') === 'independent');
  check('no header at all is no evidence', scoreLib.identityEvidence(null, 'gpt-5.6-terra') === 'none');
}

section('48. run-lane.js — a phase RESUMES rather than re-billing (anthropic-2 MAJOR 5 / openai-3 MAJOR)');
{
  const repo = makeSourceRepo();
  const dir = tmpDir('wo12-resume-');
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [];
  for (let i = 1; i <= 4; i++) {
    const id = 'sdc-00' + i;
    artifacts.push({ id, kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  const keyPath = writeKey(dir, artifacts);
  const resultsFile = path.join(dir, 'results-X-Terra-phase0.json');

  // planResume, directly.
  const completed = { id: 'sdc-001', attempts: DONE_ATTEMPT };
  const unavailOnce = { id: 'sdc-002', attempts: [{ status: 'UNAVAILABLE', unavailable: true }] };
  const unavailRetried = { id: 'sdc-003', attempts: [{ status: 'UNAVAILABLE', unavailable: true }, { status: 'UNAVAILABLE', unavailable: true }] };
  fs.writeFileSync(resultsFile, JSON.stringify([completed, unavailOnce, unavailRetried], null, 2), 'utf8');
  const plan = runLaneLib.planResume(resultsFile, artifacts);
  check('a COMPLETED artifact is already recorded', plan.done.some((d) => d.artifact.id === 'sdc-001'));
  check('an UNAVAILABLE artifact that has had its retry is already recorded', plan.done.some((d) => d.artifact.id === 'sdc-003'));
  check('an UNAVAILABLE artifact that has NOT had its retry is re-dispatched', plan.todo.some((a) => a.id === 'sdc-002'));
  check('an artifact with no record at all is dispatched', plan.todo.some((a) => a.id === 'sdc-004'));
  check('the plan accounts for every artifact exactly once', plan.done.length + plan.todo.length === artifacts.length);

  // Duplicates are a refusal naming the ids.
  fs.writeFileSync(resultsFile, JSON.stringify([completed, completed, unavailRetried], null, 2), 'utf8');
  let threwDup = null;
  try { runLaneLib.planResume(resultsFile, artifacts); } catch (e) { threwDup = e; }
  check('anthropic-2 MAJOR 5: DUPLICATE records in a results file are a REFUSAL',
    !!threwDup && threwDup.wo12DuplicateResults === true && /sdc-001/.test(threwDup.message), threwDup && threwDup.message);

  // End to end: a second invocation runs only what is missing.
  fs.rmSync(resultsFile, { force: true });
  const stubs = tmpDir('wo12-resume-stub-');
  const runner = writeStub(stubs, 'ok.js', 'process.stdout.write("REVIEW ENGINE: codex model: gpt-5.6-terra\\n\\nVERDICT: APPROVE\\n\\nFINDINGS\\n- none\\n");\n');
  const green = qmStubJson(stubs, 'green.js', ouState(0.85));
  const argv = ['--lane', 'X-Terra', '--phase', '0', '--yes', '--key', keyPath, '--briefs-dir', briefs,
    '--patches-dir', dir, '--source-repo', repo.dir, '--results-dir', dir,
    '--clone-root', path.join(dir, 'clone'), '--run-clone-root', path.join(dir, 'run'), '--runner', runner];
  const env = { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) };
  const first = runLane(argv, env);
  check('the first invocation runs the whole phase', first.status === 0, (first.stderr || '') + (first.stdout || '').slice(-300));
  const afterFirst = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  check('four records are written', afterFirst.length === 4, String(afterFirst.length));

  const second = runLane(argv, env);
  check('anthropic-2 MAJOR 5: a second invocation exits 0 and runs NOTHING', second.status === 0, (second.stderr || '') + (second.stdout || '').slice(-400));
  check('…printing an "already recorded" line per artifact',
    (second.stdout || '').match(/already recorded: sdc-00\d \(COMPLETED\) — skipping, not re-billing/g || []).length === 4,
    (second.stdout || '').slice(-900));
  check('…and appending NOTHING: the results file is byte-identical',
    fs.readFileSync(resultsFile, 'utf8') === JSON.stringify(afterFirst, null, 2) + '\n',
    'record count now ' + JSON.parse(fs.readFileSync(resultsFile, 'utf8')).length);
  check('…so no duplicate ids exist to wedge scoring',
    new Set(JSON.parse(fs.readFileSync(resultsFile, 'utf8')).map((r) => r.id)).size === 4);

  // A partial phase resumes from where it stopped.
  const trimmed = afterFirst.slice(0, 2);
  fs.writeFileSync(resultsFile, JSON.stringify(trimmed, null, 2) + '\n', 'utf8');
  const third = runLane(argv, env);
  check('a partial results file resumes: only the missing artifacts run', third.status === 0 && /2 to run/.test(third.stdout || ''), (third.stdout || '').slice(-700));
  const afterThird = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  check('the phase completes to exactly 4 records, none duplicated',
    afterThird.length === 4 && new Set(afterThird.map((r) => r.id)).size === 4, String(afterThird.length));
}

section('49. run-lane.js — the phase-0 stop counter persists across invocations AND lanes (openai-3 MAJOR run-lane.js:855)');
{
  const dir = tmpDir('wo12-stopdisk-');
  const mk = (status, n) => {
    const out = [];
    for (let i = 1; i <= n; i++) {
      out.push({ id: 'sdc-00' + i, attempts: [{ status, unavailable: true }, { status, unavailable: true }] });
    }
    return out;
  };
  fs.writeFileSync(path.join(dir, 'results-X-Sol-phase0.json'), JSON.stringify(mk('UNAVAILABLE', 3), null, 2), 'utf8');
  const counts = runLaneLib.countUnavailableOnDisk(dir, 0, ['X-Sol', 'X-Terra']);
  check('openai-3 MAJOR: UNAVAILABLE is counted from the results files ON DISK', counts['X-Sol'].count === 3, JSON.stringify(counts));
  check('a lane with no results file counts zero', counts['X-Terra'].count === 0);
  check('the breached lane\'s artifact ids are named', counts['X-Sol'].ids.join(',') === 'sdc-001,sdc-002,sdc-003');
  fs.writeFileSync(path.join(dir, 'results-X-Sol-phase0.json'), JSON.stringify(mk('NO_VERDICT_LINE', 3), null, 2), 'utf8');
  check('no-verdict records count toward the stop rule too',
    runLaneLib.countUnavailableOnDisk(dir, 0, ['X-Sol'])['X-Sol'].count === 3);

  // A fresh X-Terra invocation must halt on X-Sol's breach.
  const repo = makeSourceRepo();
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [];
  for (let i = 1; i <= 2; i++) {
    const id = 'sdc-01' + i;
    artifacts.push({ id, kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  const keyPath = writeKey(dir, artifacts);
  const stubs = tmpDir('wo12-stopdisk-stub-');
  const runner = writeStub(stubs, 'ok.js', 'process.stdout.write("REVIEW ENGINE: codex model: gpt-5.6-terra\\n\\nVERDICT: APPROVE\\n\\nFINDINGS\\n- none\\n");\n');
  const green = qmStubJson(stubs, 'green.js', ouState(0.85));
  const r = runLane(['--lane', 'X-Terra', '--phase', '0', '--yes', '--key', keyPath, '--briefs-dir', briefs,
    '--patches-dir', dir, '--source-repo', repo.dir, '--results-dir', dir,
    '--clone-root', path.join(dir, 'clone2'), '--run-clone-root', path.join(dir, 'run2'), '--runner', runner],
  { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('openai-3 MAJOR: a fresh X-Terra invocation HALTS on X-Sol\'s existing breach (">2 in EITHER lane")',
    r.status !== 0 && /HALTING phase 0/.test(r.stderr || '') && /X-Sol/.test(r.stderr || ''), (r.stderr || '').slice(0, 500));
}

section('50. score.js — duplicate (lane, id) records are deduped and reported (anthropic-2 MAJOR 5)');
{
  const rows = [
    { lane: 'X-Terra', id: 'sdc-001', finalStatus: 'NO_VERDICT_LINE', unavailableFinal: true, sourceFile: 'a.json' },
    { lane: 'X-Terra', id: 'sdc-001', finalStatus: 'COMPLETED', unavailableFinal: false, sourceFile: 'b.json' },
    { lane: 'X-Terra', id: 'sdc-002', finalStatus: 'COMPLETED', unavailableFinal: false, sourceFile: 'a.json' },
    { lane: 'X-Sol', id: 'sdc-001', finalStatus: 'COMPLETED', unavailableFinal: false, sourceFile: 'a.json' },
  ];
  const { deduped, duplicates } = scoreLib.dedupeScored(rows);
  check('anthropic-2 MAJOR 5: duplicates collapse to one record per (lane, id)', deduped.length === 3, String(deduped.length));
  check('the COMPLETE record wins over the dead one',
    deduped.find((r) => r.lane === 'X-Terra' && r.id === 'sdc-001').finalStatus === 'COMPLETED');
  check('the same id on a DIFFERENT lane is not a duplicate', deduped.some((r) => r.lane === 'X-Sol' && r.id === 'sdc-001'));
  check('duplicates are reported, not silently dropped', duplicates.length === 1 && duplicates[0].id === 'sdc-001', JSON.stringify(duplicates));
  check('no duplicates in a clean set', scoreLib.dedupeScored(rows.slice(1)).duplicates.length === 0);
}

section('51. assemble-key.js — the population-balance lint (anthropic-2 MAJOR 1 / openai-3 CRITICAL CONSTRUCTION.md:46)');
{
  const words = (n, w) => Array(n).fill(w || 'word').join(' ');
  const mkRow = (kind, orderWords, claimsWords, hardness) => ({
    id: 'x', kind, variant: 'V1', baseKind: 'code',
    orderWords, claimsWords, orderHardness: hardness,
  });

  // must · never · exactly · byte-identical · unchanged · only = 6
  check('hardnessScore counts the absolute-constraint vocabulary, whole-word',
    assembleKeyLib.hardnessScore('It must never change; keep it exactly and byte-identical, unchanged, only that.') === 6,
    String(assembleKeyLib.hardnessScore('It must never change; keep it exactly and byte-identical, unchanged, only that.')));
  check('hardnessScore does not fire on substrings', assembleKeyLib.hardnessScore('mustard commonly nevertheless') === 0,
    String(assembleKeyLib.hardnessScore('mustard commonly nevertheless')));
  check('hardnessScore counts `forbid` and its inflections', assembleKeyLib.hardnessScore('forbid forbids forbidden forbidding') === 4);

  // The round-2 corpus's own numbers: 144.3 vs 128.3 order words. That must now fail.
  {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('seeded', 144, 75, 4));
    for (let i = 0; i < 54; i++) rows.push(mkRow('control', 128, 73, 4));
    const findings = [];
    assembleKeyLib.populationBalanceLint(rows, findings);
    check('MAJOR 1: the round-2 corpus\'s own 16-word ORDER gap is now a HARD FAILURE',
      findings.length === 1 && /mean ORDER words differ by 16\.0/.test(findings[0]), JSON.stringify(findings));
  }
  // Within tolerance: passes.
  {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('seeded', 130, 75, 4));
    for (let i = 0; i < 54; i++) rows.push(mkRow('control', 125, 73, 4));
    const findings = [];
    const b = assembleKeyLib.populationBalanceLint(rows, findings);
    check('a 5-word gap is inside the ±' + assembleKeyLib.MEAN_WORD_TOLERANCE + '-word tolerance and passes', findings.length === 0, JSON.stringify(findings));
    check('the lint returns the measured means for the report', b && Math.abs(b.sOrder - 130) < 1e-9 && Math.abs(b.cOrder - 125) < 1e-9, JSON.stringify(b));
  }
  // The CLAIMS half.
  {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('seeded', 128, 90, 4));
    for (let i = 0; i < 54; i++) rows.push(mkRow('control', 128, 73, 4));
    const findings = [];
    assembleKeyLib.populationBalanceLint(rows, findings);
    check('a CLAIMS mean gap is a hard failure too', findings.length === 1 && /mean CLAIMS words differ by 17\.0/.test(findings[0]), JSON.stringify(findings));
  }
  // The register half — the signal the blind reader actually used.
  {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('seeded', 128, 73, 6));
    for (let i = 0; i < 54; i++) rows.push(mkRow('control', 128, 73, 2));
    const findings = [];
    assembleKeyLib.populationBalanceLint(rows, findings);
    check('MAJOR 1: a 3.0× ORDER hardness ratio is a HARD FAILURE',
      findings.length === 1 && /hardness proxy ratio is 3\.00/.test(findings[0]), JSON.stringify(findings));
  }
  {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('seeded', 128, 73, 4.4));
    for (let i = 0; i < 54; i++) rows.push(mkRow('control', 128, 73, 4));
    const findings = [];
    assembleKeyLib.populationBalanceLint(rows, findings);
    check('a 1.10 hardness ratio is inside [' + assembleKeyLib.HARDNESS_RATIO_MIN + ', ' + assembleKeyLib.HARDNESS_RATIO_MAX + '] and passes',
      findings.length === 0, JSON.stringify(findings));
  }
  {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('seeded', 128, 73, 3));
    for (let i = 0; i < 54; i++) rows.push(mkRow('control', 128, 73, 0));
    const findings = [];
    assembleKeyLib.populationBalanceLint(rows, findings);
    check('one population carrying NO absolute-constraint language at all is a hard failure',
      findings.length === 1 && /one population carries absolute-constraint language and the other carries none/.test(findings[0]), JSON.stringify(findings));
  }
  // Both metrics land in CONSTRUCTION.md's length report either way.
  {
    const rows = [];
    for (let i = 0; i < 3; i++) rows.push(mkRow('seeded', 140, 80, 5));
    for (let i = 0; i < 3; i++) rows.push(mkRow('control', 120, 70, 2));
    const md = assembleKeyLib.renderLengthReport(rows);
    check('the length report carries the ORDER hardness column', /ORDER hardness \(mean ± sd\)/.test(md), md.slice(0, 500));
    check('the length report states BOTH gates with their values and verdicts',
      /mean ORDER words seeded − control.*20\.0/.test(md) && /ORDER hardness ratio.*2\.50/.test(md) && /\*\*FAIL\*\*/.test(md), md);
    check('the report names the hardness vocabulary so a content author can act on it',
      /`must`, `never`, `exactly`, `only`, `byte-identical`/.test(md), md);
  }
}

section('52. assemble-key.js — a population imbalance REFUSES the whole assembly (end to end)');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-balance-e2e-');
  const contentDir = path.join(work, 'content');
  const briefsDir = path.join(work, 'briefs');
  fs.mkdirSync(contentDir, { recursive: true });
  const slots = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
  ];
  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  return a - b;\n}\n');
  });
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(work, 'sdc-001.seed.json'), JSON.stringify({
    id: 'sdc-001', base: repo.base, commit: repo.commit, phase: 0, variant: 'V1',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');
  fs.writeFileSync(path.join(work, 'base-pool.json'), JSON.stringify({ slots }, null, 2), 'utf8');

  const cliArgs = ['--pool', path.join(work, 'base-pool.json'), '--corpus-dir', work, '--briefs-dir', briefsDir,
    '--content-dir', contentDir, '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')];
  const claims = Array(45).fill('the change was made and verified').join(' ').split(' ').slice(0, 45).join(' ');

  // A hard seeded order against a soft control order — the round-2 shape.
  const hardOrder = ('The order must be followed exactly and the guard must never be widened; ' +
    'the adjacent module stays byte-identical and unchanged. ').repeat(3) + Array(60).fill('detail').join(' ');
  const softOrder = Array(95).fill('the change updates documentation and tidies the surrounding prose').join(' ').split(' ').slice(0, 95).join(' ');
  fs.writeFileSync(path.join(contentDir, 'sdc-001.json'), JSON.stringify({ order: hardOrder.split(' ').slice(0, 150).join(' '), claims }), 'utf8');
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'), JSON.stringify({ order: softOrder, claims }), 'utf8');
  const rBad = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('an imbalanced corpus REFUSES assembly', rBad.status !== 0 && /assembly REFUSED/.test(rBad.stderr || ''), rBad.stderr);
  check('the refusal names the population-balance gate', /population balance/.test(rBad.stderr || ''), rBad.stderr);
  check('nothing was written', !fs.existsSync(path.join(work, 'key.json')));

  // Balanced: both populations carry the same register and length.
  const balanced = ('The order must be followed exactly and the guard must never be widened; ' +
    'the adjacent module stays byte-identical and unchanged. ').repeat(3) + Array(60).fill('detail').join(' ');
  const balancedOrder = balanced.split(' ').slice(0, 150).join(' ');
  fs.writeFileSync(path.join(contentDir, 'sdc-001.json'), JSON.stringify({ order: balancedOrder, claims }), 'utf8');
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'), JSON.stringify({ order: balancedOrder, claims }), 'utf8');
  const rOk = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('a BALANCED corpus assembles', rOk.status === 0, (rOk.stderr || '') + (rOk.stdout || '').slice(-400));
  const md = fs.readFileSync(path.join(work, 'CONSTRUCTION.md'), 'utf8');
  check('CONSTRUCTION.md reports both balance gates as passing', /≤ 6 \| pass/.test(md) && /0\.8–1\.25 \| pass/.test(md), md.slice(md.indexOf('| gate |'), md.indexOf('| gate |') + 600));
}

section('53. assemble-key.js — skeletonize masks the SUBJECT before the shas (anthropic-2 NIT)');
{
  const head = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  // A pathological one-character subject that is a substring of the mask tokens.
  const artifact = { id: 'sdc-001', kind: 'seeded', variant: 'V1', base, subject: 'A' };
  const text = 'Change under review: commit ' + head + '\nBase (its parent):   ' + base + '\nCommit subject:      A\n';
  const sk = assembleKeyLib.skeletonize(text, artifact, head);
  check('anthropic-2 NIT: the mask tokens are not corrupted by a subject that is a substring of them',
    /<HEAD>/.test(sk) && /<BASE>/.test(sk) && !/<B<SUBJECT>SE>/.test(sk) && !/<HE<SUBJECT>D>/.test(sk), JSON.stringify(sk));
  check('the subject is still masked', /Commit subject:      <SUBJECT>/.test(sk), JSON.stringify(sk));
}

section('54. assemble-key.js — the LABEL-TELL lint (round 4: a lexical label only seeds carried)');
{
  // A round-3 blind evaluator separated the populations on `IN SCOPE:` /
  // `Constraint:` inside ORDER prose — 5 seeded content files, 0 controls.
  // Nothing upstream can see it: skeletonize() collapses the whole ORDER block
  // to one token, and the word/hardness gates are distributional.
  const L = assembleKeyLib.extractLabels;
  check('a line-start label is extracted', Array.from(L('Constraint: do not touch the adjacent module.')).join(',') === 'Constraint');
  check('a label after a sentence end is extracted', Array.from(L('Do the thing. IN SCOPE: these files only.')).join(',') === 'IN SCOPE');
  check('a label after a newline is extracted', Array.from(L('line one\nNote: a note here')).join(',') === 'Note');
  check('several labels in one string are all extracted',
    Array.from(L('Scope: a. Verification: b. Note: c')).sort().join(',') === 'Note,Scope,Verification');
  check('prose with no labels yields none', Array.from(L('The order asks for a bounded change with no labels at all.')).length === 0);
  check('a time or ratio is not a label', Array.from(L('the ratio is 3:1 and the time is 10:30')).length === 0);
  check('a lowercase word before a colon is not a label', Array.from(L('A sentence ends. lowercase: not a label')).length === 0);
  check('a mid-sentence colon is not a label', Array.from(L('Do it; however: not like that')).length === 0);
  check('contentLabels merges order and claims', assembleKeyLib.contentLabels({
    order: 'Constraint: keep it.', claims: 'Verification: the suite is green.',
  }).join(',') === 'Constraint,Verification');

  check('a clause too long to be a heading is not a label (>' + assembleKeyLib.LABEL_MAX_WORDS + ' words)',
    Array.from(L('One two three four five: still prose')).length === 0,
    JSON.stringify(Array.from(L('One two three four five: still prose'))));
  check('a four-word heading IS a label', Array.from(L('Keep the write idempotent: do so')).join(',') === 'Keep the write idempotent');

  const row = (id, kind, labels) => ({ id, kind, variant: 'V1', baseKind: 'code', orderWords: 100, claimsWords: 50, orderHardness: 2, labels });

  // ZERO TOLERANCE. The first draft of this lint asked for both-or-neither;
  // a scan of the sealed corpus refuted it — 15 distinct labels, all 15
  // one-population — so any label at all now fails.

  // (a) a seed-only label FAILS, naming the file and the token.
  {
    const rows = [
      row('sdc-001', 'seeded', ['Constraint']), row('sdc-002', 'seeded', ['Constraint']),
      row('sdc-003', 'control', []), row('sdc-004', 'control', []),
    ];
    const findings = [];
    assembleKeyLib.labelTellLint(rows, findings);
    check('round 4: a seed-only label is a hard failure, once per file', findings.length === 2, JSON.stringify(findings));
    check('…and each finding names the content file', /content\/sdc-001\.json/.test(findings[0]) && /content\/sdc-002\.json/.test(findings[1]), JSON.stringify(findings));
    check('…and names the label token', findings.every((f) => /"Constraint:"/.test(f)), JSON.stringify(findings));
    check('…and says which population the file belongs to', /\(seeded\)/.test(findings[0]), findings[0]);
  }

  // (b) a control-only label fails identically — no population is privileged.
  {
    const rows = [row('sdc-001', 'seeded', []), row('sdc-002', 'control', ['IN SCOPE'])];
    const findings = [];
    assembleKeyLib.labelTellLint(rows, findings);
    check('round 4: a control-only label is a hard failure too',
      findings.length === 1 && /content\/sdc-002\.json \(control\)/.test(findings[0]) && /"IN SCOPE:"/.test(findings[0]), JSON.stringify(findings));
  }

  // (c) a label present in BOTH populations STILL fails — the rule is not balance.
  {
    const rows = [
      row('sdc-001', 'seeded', ['Constraint']), row('sdc-002', 'seeded', ['Constraint', 'Note']),
      row('sdc-003', 'control', ['Constraint']), row('sdc-004', 'control', ['Note']),
    ];
    const findings = [];
    assembleKeyLib.labelTellLint(rows, findings);
    check('round 4: a label present in BOTH populations still FAILS (zero tolerance, not balance)',
      findings.length === 5, JSON.stringify(findings.length));
    check('…every labelled file is named', ['sdc-001', 'sdc-002', 'sdc-003', 'sdc-004'].every((id) => findings.some((f) => f.indexOf('content/' + id + '.json') !== -1)));
  }

  // (d) no labels anywhere passes — the only way to pass.
  {
    const rows = [row('sdc-001', 'seeded', []), row('sdc-002', 'control', [])];
    const findings = [];
    const use = assembleKeyLib.labelTellLint(rows, findings);
    check('round 4: no labels at all passes', findings.length === 0 && use.labelled.length === 0, JSON.stringify(findings));
  }

  // (e) one label in one file out of many still fails the whole assembly.
  {
    const rows = [row('sdc-001', 'seeded', ['Scope'])];
    for (let i = 2; i <= 20; i++) rows.push(row('sdc-0' + String(i).padStart(2, '0'), 'control', []));
    const findings = [];
    const use = assembleKeyLib.labelTellLint(rows, findings);
    check('round 4: a single label in a single file of 20 is decisive',
      findings.length === 1 && use.labelled.join(',') === 'sdc-001', JSON.stringify(findings));
  }

  // (f) a single-population corpus is still checked — the rule no longer needs
  // two populations to have an opinion.
  {
    const findings = [];
    assembleKeyLib.labelTellLint([row('sdc-001', 'seeded', ['Constraint'])], findings);
    check('a single-population corpus is still checked (zero tolerance needs no comparison)',
      findings.length === 1 && /"Constraint:"/.test(findings[0]), JSON.stringify(findings));
  }
}

section('55. assemble-key.js — a label tell REFUSES the whole assembly, and CONSTRUCTION.md inventories labels');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-label-e2e-');
  const contentDir = path.join(work, 'content');
  const briefsDir = path.join(work, 'briefs');
  fs.mkdirSync(contentDir, { recursive: true });
  const slots = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
  ];
  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  return a - b;\n}\n');
  });
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(work, 'sdc-001.seed.json'), JSON.stringify({
    id: 'sdc-001', base: repo.base, commit: repo.commit, phase: 0, variant: 'V1',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');
  fs.writeFileSync(path.join(work, 'base-pool.json'), JSON.stringify({ slots }, null, 2), 'utf8');
  const cliArgs = ['--pool', path.join(work, 'base-pool.json'), '--corpus-dir', work, '--briefs-dir', briefsDir,
    '--content-dir', contentDir, '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')];

  // Both orders identical in length and register; only the LABEL differs.
  const body = ('The order must be followed exactly and the guard must never be widened; ' +
    'the adjacent module stays byte-identical and unchanged. ').repeat(3) + Array(58).fill('detail').join(' ');
  const claims = Array(45).fill('the change was made and verified').join(' ').split(' ').slice(0, 45).join(' ');
  const labelled = 'Constraint: ' + body.split(' ').slice(0, 148).join(' ');
  const plain = body.split(' ').slice(0, 149).join(' ');
  fs.writeFileSync(path.join(contentDir, 'sdc-001.json'), JSON.stringify({ order: labelled, claims }), 'utf8');
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'), JSON.stringify({ order: plain, claims }), 'utf8');
  const rBad = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('round 4: a label REFUSES assembly even when length and register match',
    rBad.status !== 0 && /assembly REFUSED/.test(rBad.stderr || '') && /label tell/.test(rBad.stderr || ''), rBad.stderr);
  check('the refusal names the label and the content file to fix',
    /"Constraint:"/.test(rBad.stderr || '') && /content\/sdc-001\.json/.test(rBad.stderr || ''), rBad.stderr);
  check('nothing was written', !fs.existsSync(path.join(work, 'key.json')));

  // Giving the CONTROL the same label does NOT help — zero tolerance.
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'), JSON.stringify({ order: 'Constraint: ' + plain.split(' ').slice(0, 148).join(' '), claims }), 'utf8');
  const rBoth = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('round 4: balancing the label across both populations does NOT satisfy the lint',
    rBoth.status !== 0 && /label tell/.test(rBoth.stderr || '') && /content\/sdc-002\.json/.test(rBoth.stderr || ''), rBoth.stderr);

  // Folding the label into ordinary prose is what passes.
  fs.writeFileSync(path.join(contentDir, 'sdc-001.json'), JSON.stringify({ order: plain, claims }), 'utf8');
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'), JSON.stringify({ order: plain, claims }), 'utf8');
  const rOk = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('round 4: label-free content assembles', rOk.status === 0, (rOk.stderr || '') + (rOk.stdout || '').slice(-400));
  const md = fs.readFileSync(path.join(work, 'CONSTRUCTION.md'), 'utf8');
  check('CONSTRUCTION.md carries the inline-label section', /### Inline labels \(round 4\)/.test(md), md.slice(0, 400));
  check('the inventory is empty in a corpus that assembles', /\*\*No inline labels in any content file\.\*\*/.test(md),
    md.slice(md.indexOf('### Inline labels'), md.indexOf('### Inline labels') + 900));
}

// ============================================================ ROUND 5
// roster/wo12-r0-review-anthropic-3.md

section('56. score.js — gate 5 is LIMITED, never PASS, on echoed-request evidence (round-5 MAJOR 2)');
{
  const artifacts = [];
  for (let i = 1; i <= 30; i++) artifacts.push({ id: 'sd-' + i, kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } });
  for (let i = 1; i <= 54; i++) artifacts.push({ id: 'ct-' + i, kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null });
  const key = { version: 1, artifacts };
  // Seeds carry a hit; CONTROLS carry no findings at all, so gate 3 has nothing
  // to adjudicate and can reach PASS. That isolates gate 5 as the only item
  // that is not a clean PASS, which is what makes `overall` readable here.
  function recsWith(header) {
    const out = [];
    for (const lane of ['X-Sol', 'X-Terra']) {
      for (const a of artifacts) {
        const seeded = a.kind === 'seeded';
        out.push({
          id: a.id, lane, phase: 0, variant: 'V1', expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane], runIndex: 0,
          attempts: [{
            wallMs: 1, verdict: seeded ? 'REVISE' : 'APPROVE', status: 'COMPLETED', unavailable: false,
            engineHeader: header(lane), integrityWarning: false,
            stdout: seeded
              ? 'VERDICT: REVISE\n\nFINDINGS\n- [MAJOR] a.js:1 — found it\n\nCLAIMS CHECKED\n- none\n'
              : 'VERDICT: APPROVE\n\nFINDINGS\n- none\n\nCLAIMS CHECKED\n- none\n',
          }],
        });
      }
    }
    return out;
  }
  // One adjudication entry so the lane is not "NOT ADJUDICATED"; no control
  // carries a blocker finding, so coverage is complete.
  const ADJ = [{ id: 'ct-1', lane: 'X-Terra', severity: 'MINOR', finding: 'a MINOR nit, not a blocker finding at all', verdict: 'DEBATABLE', second: 'DEBATABLE' }];
  // The production runner echoes the REQUESTED model.
  const echoed = scoreLib.scoreRecords(recsWith((l) => 'REVIEW ENGINE: OpenAI via Codex CLI (model: ' + scoreLib.LANE_EXPECTED_MODEL[l] + ', sandbox: workspace-write)'), key, {}).scored;
  const gEcho = scoreLib.gate12f(echoed, key, ADJ, scoreLib.identityExclusions(echoed));
  const item5 = gEcho.items.find((i) => i.n === 5);
  check('round-5 MAJOR 2: gate 5 status is LIMITED on echoed-request evidence, not PASS',
    item5.status === 'LIMITED', item5.status + ' — ' + item5.detail);
  check('…and the item carries the evidence class as a FIELD, not only in prose',
    item5.identityEvidence === 'echoed-request', JSON.stringify(item5.identityEvidence));
  check('…and the detail still states the limit', /EVIDENCE LIMIT/.test(item5.detail), item5.detail);
  check('round-5 MAJOR 2: `overall` carries LIMITED — the field every consumer reads',
    gEcho.overall === 'LIMITED', gEcho.overall);

  // Independent evidence (a served_model line) restores a real PASS.
  const independent = scoreLib.scoreRecords(recsWith((l) => 'REVIEW ENGINE: codex served_model: ' + scoreLib.LANE_EXPECTED_MODEL[l]), key, {}).scored;
  const gInd = scoreLib.gate12f(independent, key, ADJ, scoreLib.identityExclusions(independent));
  const item5b = gInd.items.find((i) => i.n === 5);
  check('independent served-model evidence gives a real PASS', item5b.status === 'PASS', item5b.status + ' — ' + item5b.detail);
  check('…and the evidence class says so', item5b.identityEvidence === 'independent');

  // A genuine mismatch still FAILs, and FAIL dominates LIMITED in `overall`.
  const wrong = scoreLib.scoreRecords(recsWith(() => 'REVIEW ENGINE: codex model: gpt-4o'), key, {}).scored;
  const gWrong = scoreLib.gate12f(wrong, key, ADJ, scoreLib.identityExclusions(wrong));
  check('a served model outside the known families still FAILs the gate',
    gWrong.items.find((i) => i.n === 5).status === 'FAIL', gWrong.items.find((i) => i.n === 5).detail);
  check('FAIL dominates LIMITED in `overall`', gWrong.overall === 'FAIL', gWrong.overall);
}

section('57. score.js — promotions: no substring fallback, FINDINGS-only haystack, severity floor (round-5 MAJOR 3)');
{
  const key = {
    version: 1,
    artifacts: [{
      id: 'sdc-061', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's',
      seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'hooks/orchestra-guard.js', lines: [339, 345], symbol: 'guard' }, consequence: '', rationale: '', hazard_terms: [] },
    }],
  };
  const mk = (findingsText) => [{
    id: 'sdc-061', lane: 'X-Terra', kind: 'seeded', hit: false, adjudicatedPromotion: false, order: 0,
    finalStatus: 'COMPLETED', attemptCount: 1, findingsText,
  }];

  // (1) The exact scenario the reviewer used: an APPROVE verdict that misses the
  // seed, with the pack copy mentioned only in CLAIMS CHECKED.
  const packQuote = '[MINOR] codex/hooks/orchestra-guard.js:12 — the pack copy was not updated';
  const rowsClaims = mk('- [MINOR] docs/readme.md:3 — a stale link.');
  const r1 = scoreLib.applyAdjudicatedPromotions(rowsClaims, key, [{ id: 'sdc-061', lane: 'X-Terra', verdict: 'HIT', quote: packQuote }]);
  check('round-5 MAJOR 3: a CLAIMS CHECKED line cannot promote — the haystack is the FINDINGS section',
    r1.promotions.length === 0 && rowsClaims[0].hit === false, JSON.stringify(r1));
  check('…and the reason names the FINDINGS section', /FINDINGS SECTION/.test(r1.rejected[0].reason), r1.rejected[0].reason);

  // (2) Even IN the findings section, the vendored copy is not the locator.
  const rowsPack = mk('- ' + packQuote);
  const r2 = scoreLib.applyAdjudicatedPromotions(rowsPack, key, [{ id: 'sdc-061', lane: 'X-Terra', verdict: 'HIT', quote: packQuote }]);
  check('round-5 MAJOR 3: the substring fallback is gone — the vendored copy no longer counts as the locator',
    r2.promotions.length === 0 && /does not cite the seed's locator file/.test(r2.rejected[0].reason), JSON.stringify(r2));
  check('citesLocatorFile rejects the pack copy directly',
    scoreLib.citesLocatorFile('[MINOR] codex/hooks/orchestra-guard.js:12 — pack copy stale', 'hooks/orchestra-guard.js') === false);
  check('citesLocatorFile still accepts the real path',
    scoreLib.citesLocatorFile('[MAJOR] hooks/orchestra-guard.js:340 — the seeded fault here', 'hooks/orchestra-guard.js') === true);

  // (3) The severity floor governs a promotion as it governs a mechanical hit.
  const untagged = 'hooks/orchestra-guard.js:340 — something is odd in the guard here';
  const rowsUntagged = mk('- ' + untagged);
  const r3 = scoreLib.applyAdjudicatedPromotions(rowsUntagged, key, [{ id: 'sdc-061', lane: 'X-Terra', verdict: 'HIT', quote: untagged }]);
  check('round-5 MAJOR 3: an UNTAGGED quote cannot promote (§2.5 severity floor)',
    r3.promotions.length === 0 && /severity/.test(r3.rejected[0].reason), JSON.stringify(r3));

  // (4) An honest promotion still works.
  const good = '[MAJOR] hooks/orchestra-guard.js:340 — the guard was widened past its stated scope';
  const rowsGood = mk('- ' + good);
  const r4 = scoreLib.applyAdjudicatedPromotions(rowsGood, key, [{ id: 'sdc-061', lane: 'X-Terra', verdict: 'HIT', quote: good }]);
  check('an honest, tagged, locator-citing FINDINGS quote still promotes',
    r4.promotions.length === 1 && rowsGood[0].hit === true && rowsGood[0].adjudicatedPromotion === true, JSON.stringify(r4));

  // scoreRecords must supply findingsText, not the raw transcript.
  const scored = scoreLib.scoreRecords([{
    id: 'sdc-061', lane: 'X-Terra', phase: 0, expectedModel: 'gpt-5.6-terra',
    attempts: [{ status: 'COMPLETED', verdict: 'APPROVE', engineHeader: 'REVIEW ENGINE: codex model: gpt-5.6-terra', integrityWarning: false,
      stdout: 'PREFLIGHT: noise\nVERDICT: APPROVE\n\nFINDINGS\n- none\n\nCLAIMS CHECKED\n- "x" -> codex/hooks/orchestra-guard.js:12 mentioned here\n' }],
  }], key, {}).scored;
  check('scoreRecords exposes the FINDINGS section as the promotion haystack',
    scored[0].findingsText.indexOf('CLAIMS CHECKED') === -1 && scored[0].findingsText.indexOf('PREFLIGHT') === -1,
    JSON.stringify(scored[0].findingsText));
}

section('58. score.js — gate-3 coverage is an EXACT match above the quote floor (round-5 MAJOR 4)');
{
  const artifacts = [];
  for (let i = 1; i <= 30; i++) artifacts.push({ id: 'sd-' + i, kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } });
  for (let i = 1; i <= 54; i++) artifacts.push({ id: 'ct-' + i, kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null });
  const key = { version: 1, artifacts };
  const BLOCKERS = [
    '[CRITICAL] router/router.js:10 — first blocker on the control',
    '[MAJOR] router/router.js:20 — second blocker on the control',
    '[MAJOR] router/router.js:30 — third blocker on the control',
  ];
  const scored = [];
  for (const lane of ['X-Sol', 'X-Terra']) {
    artifacts.forEach((a, idx) => scored.push({
      id: a.id, lane, phase: 0, variant: 'V1', order: idx, kind: a.kind, type: a.seed ? 'CV' : null,
      severity: a.seed ? 'MAJOR' : null, hit: false, nearMisses: [], adjudicatedPromotion: false,
      blockerFindings: a.id === 'ct-1' ? BLOCKERS.length : 0,
      blockerFindingTexts: a.id === 'ct-1' ? BLOCKERS.slice() : [],
      unavailableFinal: false, noVerdict: false, integrityWarning: false,
      expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane], servedModel: scoreLib.LANE_EXPECTED_MODEL[lane],
      identity: 'MATCHED', identityKnown: true, identityMismatch: false, identityUnknown: false,
      identityEvidence: 'independent', emptyFindingsSection: false, finalStatus: 'COMPLETED', attemptCount: 1, sourceFile: 'x',
    }));
  }
  const gate = (adj) => scoreLib.gate12f(scored, key, adj, scoreLib.identityExclusions(scored)).items.find((i) => i.n === 3);

  for (const cheat of ['js:', 'invented', 'blocker finding', 'router', '[MAJOR]']) {
    const g = gate([{ id: 'ct-1', lane: 'X-Terra', severity: 'MAJOR', finding: cheat, verdict: 'REAL', second: 'REAL' }]);
    check('round-5 MAJOR 4: the substring cheat ' + JSON.stringify(cheat) + ' does NOT cover a blocker',
      g.status === 'INCOMPLETE' && /PARTIALLY ADJUDICATED/.test(g.detail), g.status + ' — ' + g.detail.slice(0, 160));
  }
  const partial = gate([{ id: 'ct-1', lane: 'X-Terra', severity: 'CRITICAL', finding: BLOCKERS[0], verdict: 'REAL', second: 'REAL' }]);
  check('an exact match covers exactly ONE blocker, leaving the gate INCOMPLETE',
    partial.status === 'INCOMPLETE' && /2 MAJOR\/CRITICAL finding\(s\)/.test(partial.detail), partial.detail.slice(0, 200));
  const full = gate(BLOCKERS.map((t) => ({ id: 'ct-1', lane: 'X-Terra', severity: 'MAJOR', finding: t, verdict: 'REAL', second: 'REAL' })));
  check('exact entries for every blocker complete the coverage and the gate can PASS',
    full.status === 'PASS', full.status + ' — ' + full.detail.slice(0, 160));
  const shortExact = gate([{ id: 'ct-1', lane: 'X-Terra', severity: 'MAJOR', finding: 'short', verdict: 'REAL', second: 'REAL' }]);
  check('an entry below the ' + 20 + '-char floor never covers, even if it matched',
    shortExact.status === 'INCOMPLETE', shortExact.detail.slice(0, 160));
  check('whitespace differences do not defeat an honest exact match', (() => {
    const g = gate(BLOCKERS.map((t) => ({ id: 'ct-1', lane: 'X-Terra', severity: 'MAJOR', finding: '  ' + t.replace(/ /g, '  ') + '  ', verdict: 'REAL', second: 'REAL' })));
    return g.status === 'PASS';
  })());

  // The exported API validates its own input (round-5 MINOR).
  let threw = null;
  try { scoreLib.gate12f(scored, key, { not: 'an array' }, scoreLib.identityExclusions(scored)); } catch (e) { threw = e; }
  check('round-5 MINOR: gate12f refuses a non-array adjudication instead of throwing a raw TypeError',
    !!threw && /must be an array/.test(threw.message), threw && threw.message);
}

section('59. run-lane.js — the stop counter FAILS CLOSED on an unreadable results file (round-5 MAJOR 5)');
{
  const dir = tmpDir('wo12-stopclosed-');
  const healthy = [];
  for (let i = 1; i <= 4; i++) {
    healthy.push({ id: 'sdc-00' + i, attempts: [{ status: 'UNAVAILABLE', unavailable: true }, { status: 'UNAVAILABLE', unavailable: true }] });
  }
  const solFile = path.join(dir, 'results-X-Sol-phase0.json');
  fs.writeFileSync(solFile, JSON.stringify(healthy, null, 2), 'utf8');
  const counts = runLaneLib.countUnavailableOnDisk(dir, 0, ['X-Sol', 'X-Terra']);
  check('a healthy sibling file counts its final UNAVAILABLE records', counts['X-Sol'].count === 4, JSON.stringify(counts['X-Sol']));

  // The reviewer's exact scenario: truncate the file to 70%, as a crash would.
  const good = fs.readFileSync(solFile, 'utf8');
  fs.writeFileSync(solFile, good.slice(0, Math.floor(good.length * 0.7)), 'utf8');
  let threw = null;
  try { runLaneLib.countUnavailableOnDisk(dir, 0, ['X-Sol', 'X-Terra']); } catch (e) { threw = e; }
  check('round-5 MAJOR 5: an unreadable sibling-lane file THROWS rather than counting zero',
    !!threw && threw.wo12ResultsCorrupt === true, threw && threw.message);
  check('…and the refusal explains that a safety stop must fail closed',
    !!threw && /not evidence of zero failures/.test(threw.message), threw && threw.message);

  // §2.6 counts FINAL unavailable; an unretried record is pending, not final.
  fs.writeFileSync(solFile, JSON.stringify([
    { id: 'sdc-001', attempts: [{ status: 'UNAVAILABLE', unavailable: true }, { status: 'UNAVAILABLE', unavailable: true }] },
    { id: 'sdc-002', attempts: [{ status: 'UNAVAILABLE', unavailable: true }] },
  ], null, 2), 'utf8');
  const c2 = runLaneLib.countUnavailableOnDisk(dir, 0, ['X-Sol'])['X-Sol'];
  check('round-5 MINOR: a record whose retry has not been spent is PENDING, not final',
    c2.count === 1 && c2.pending === 1 && c2.pendingIds.join(',') === 'sdc-002', JSON.stringify(c2));

  // End to end: the halt refuses rather than proceeding past a corrupt sibling.
  const repo = makeSourceRepo();
  const briefs = path.join(dir, 'briefs');
  fs.mkdirSync(briefs, { recursive: true });
  const artifacts = [];
  for (let i = 1; i <= 2; i++) {
    const id = 'sdc-01' + i;
    artifacts.push({ id, kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null });
    fs.writeFileSync(path.join(briefs, id + '.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, id + '.er.txt'), 'er\n');
  }
  const keyPath = writeKey(dir, artifacts);
  fs.writeFileSync(solFile, '{not json', 'utf8');
  const stubs = tmpDir('wo12-stopclosed-stub-');
  const runner = writeStub(stubs, 'ok.js', 'process.stdout.write("REVIEW ENGINE: codex model: gpt-5.6-terra\\n\\nVERDICT: APPROVE\\n\\nFINDINGS\\n- none\\n");\n');
  const green = qmStubJson(stubs, 'green.js', ouState(0.85));
  const r = runLane(['--lane', 'X-Terra', '--phase', '0', '--yes', '--key', keyPath, '--briefs-dir', briefs,
    '--patches-dir', dir, '--source-repo', repo.dir, '--results-dir', dir,
    '--clone-root', path.join(dir, 'clone3'), '--run-clone-root', path.join(dir, 'run3'), '--runner', runner],
  { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('round-5 MAJOR 5: the phase refuses rather than proceeding past a corrupt sibling-lane file',
    r.status !== 0 && /cannot be read/.test(r.stderr || ''), (r.stderr || '').slice(0, 400));
}

section('60. assemble-key.js — the distribution lint (round-5 MAJOR 1)');
{
  const mkRow = (id, kind, o) => Object.assign({
    id, kind, variant: 'V1', baseKind: 'code', orderWords: 145, claimsWords: 76, orderHardness: 2,
    orderHardnessStrict: 1, labels: [], backticks: 0, digitsPer100: 1.0, trigrams: [], idioms: {},
  }, o || {});
  const balanced = () => {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('sdc-' + String(i + 1).padStart(3, '0'), 'seeded', { orderWords: 140 + (i % 10), claimsWords: 72 + (i % 8) }));
    for (let i = 0; i < 54; i++) rows.push(mkRow('sdc-' + String(i + 31).padStart(3, '0'), 'control', { orderWords: 140 + (i % 10), claimsWords: 72 + (i % 8) }));
    return rows;
  };
  { const f = []; assembleKeyLib.distributionLint(balanced(), f); check('a balanced corpus passes every distribution gate', f.length === 0, JSON.stringify(f)); }

  // (1) range floors / ceilings / sd.
  {
    const rows = balanced();
    rows[0].orderWords = 100; // a seed far below every control
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(1) a disjoint ORDER floor is a hard failure', f.some((x) => /ORDER word-count FLOORS differ/.test(x)), JSON.stringify(f));
  }
  {
    const rows = balanced();
    rows[0].claimsWords = 130;
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(1) a disjoint CLAIMS ceiling is a hard failure', f.some((x) => /CLAIMS word-count CEILINGS differ/.test(x)), JSON.stringify(f));
  }
  {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('sdc-' + String(i + 1).padStart(3, '0'), 'seeded', { orderWords: 140 + (i % 20), claimsWords: 76 }));
    for (let i = 0; i < 54; i++) rows.push(mkRow('sdc-' + String(i + 31).padStart(3, '0'), 'control', { orderWords: 148 + (i % 2), claimsWords: 76 }));
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(1) one population authored into a tighter band fails the SD-ratio gate',
      f.some((x) => /SD ratio/.test(x)), JSON.stringify(f));
  }

  // (2) backticks.
  {
    const rows = balanced();
    rows[0].backticks = 3;
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(2) a backtick anywhere is a hard failure naming the file',
      f.some((x) => /backtick/.test(x) && /sdc-001/.test(x)), JSON.stringify(f));
    check('(2) the report lists the offending files', rep.backticks.files.join(',') === 'sdc-001');
  }
  check('(2) backticks are forbidden in CONTROLS too, not just seeds', (() => {
    const rows = balanced();
    rows[40].backticks = 1;
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    return f.some((x) => /backtick/.test(x) && /control/.test(x));
  })());

  // (3) digit density.
  {
    const rows = balanced();
    for (const r of rows) if (r.kind === 'seeded') r.digitsPer100 = 4.0;
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(3) a digit-density gap above the tolerance is a hard failure',
      f.some((x) => /digit density differs/.test(x)), JSON.stringify(f));
  }
  {
    const rows = balanced();
    for (const r of rows) if (r.kind === 'seeded') r.digitsPer100 = 2.0;
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(3) a gap inside the tolerance passes', !f.some((x) => /digit density/.test(x)), JSON.stringify(f));
  }

  // (4) n-gram exclusivity, as retuned in round 5: ≥2 content words, and a
  // document frequency of ≥6 to FAIL. The 4-5 band is reported, not gated —
  // the first calibration fired on 133 phrases that turned out to be commit
  // TOPIC (the control pool carries docs/records commits the seeded pool does
  // not), which no phrasing pass can remove.
  {
    const rows = balanced();
    for (let i = 0; i < 6; i++) rows[i].trigrams = ['resolve the canonical path'];
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(4) a 3-gram in 6 seeds and 0 controls is a hard failure naming it',
      f.some((x) => /3-gram "resolve the canonical path"/.test(x)), JSON.stringify(f));
    check('(4) the report names the files', rep.ngrams.length === 1 && rep.ngrams[0].ids.length === 6, JSON.stringify(rep.ngrams));
  }
  for (const n of [4, 5]) {
    const rows = balanced();
    for (let i = 0; i < n; i++) rows[i].trigrams = ['resolve the canonical path'];
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(4) ' + n + ' documents is REPORTED, not failed', f.length === 0 && rep.ngramsReported.length === 1, JSON.stringify(f) + ' | ' + JSON.stringify(rep.ngramsReported));
  }
  {
    const rows = balanced();
    for (let i = 0; i < 3; i++) rows[i].trigrams = ['resolve the canonical path'];
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(4) three documents is below the reporting band entirely', f.length === 0 && rep.ngramsReported.length === 0);
  }
  {
    const rows = balanced();
    for (let i = 0; i < 8; i++) rows[i].trigrams = ['resolve the canonical path'];
    rows[40].trigrams = ['resolve the canonical path'];
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(4) a 3-gram used by BOTH populations passes at any frequency', f.length === 0, JSON.stringify(f));
  }
  check('(4) all-stopword 3-grams are ignored', assembleKeyLib.trigramsOf('the of and to in for').size === 0);
  check('(4) round 5: ONE content word is not enough', assembleKeyLib.trigramsOf('the of guard').size === 0);
  check('(4) round 5: two content words qualify', assembleKeyLib.trigramsOf('the canonical path').size === 1);
  check('(4) round 5: bare numbers are not content words',
    assembleKeyLib.isContentWord('42') === false && assembleKeyLib.isContentWord('guard') === true);
  check('(4) round 5: "verifier 99 99" has one content word and is dropped', assembleKeyLib.trigramsOf('verifier 99 99').size === 0);
  check('(4) round 5: connective scaffolding is dropped', assembleKeyLib.trigramsOf('the order and the').size === 0);
  check('(4) findings are capped and the total is stated', (() => {
    const rows = balanced();
    for (let g = 0; g < 45; g++) {
      for (let i = 0; i < 6; i++) rows[i].trigrams = (rows[i].trigrams || []).concat(['phrase' + g + ' content word']);
    }
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    const listed = f.filter((x) => /^distribution: the 3-gram/.test(x)).length;
    return rep.ngrams.length === 45 && listed === assembleKeyLib.NGRAM_FINDINGS_SHOWN &&
      f.some((x) => /45 distinct 3-gram\(s\) are exclusive/.test(x));
  })());

  // (5) idiom balance.
  {
    const rows = balanced();
    for (let i = 0; i < 15; i++) rows[30 + i].idioms = { 'leave … alone': 1 };
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(5) an idiom in 15 controls and 0 seeds is a hard failure',
      f.some((x) => /idiom "leave … alone"/.test(x) && /present in one population/.test(x)), JSON.stringify(f));
  }
  {
    const rows = balanced();
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(5) an idiom absent from BOTH populations passes', !f.some((x) => /idiom/.test(x)), JSON.stringify(f));
  }
  {
    const rows = balanced();
    for (let i = 0; i < 6; i++) rows[i].idioms = { 'must never': 1 };
    for (let i = 0; i < 11; i++) rows[30 + i].idioms = { 'must never': 1 };
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(5) a balanced idiom (0.20 vs 0.20 per artifact) passes', !f.some((x) => /idiom/.test(x)), JSON.stringify(f));
  }
  {
    const rows = balanced();
    for (let i = 0; i < 15; i++) rows[i].idioms = { 'byte-identical': 1 };
    for (let i = 0; i < 2; i++) rows[30 + i].idioms = { 'byte-identical': 1 };
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(5) an idiom ratio outside 0.5–2.0 is a hard failure',
      f.some((x) => /idiom "byte-identical"/.test(x) && /frequency ratio/.test(x)), JSON.stringify(f));
  }

  // The `only`-free hardness sensitivity check (round-3 NIT).
  {
    const rows = balanced();
    for (const r of rows) { r.orderHardness = 2; r.orderHardnessStrict = r.kind === 'seeded' ? 2 : 0.5; }
    const f = [];
    assembleKeyLib.populationBalanceLint(rows, f);
    check('the hardness ratio is ALSO gated with `only` removed',
      f.some((x) => /WITHOUT the term `only`/.test(x)), JSON.stringify(f));
  }
}

section('61. assemble-key.js — the distribution report renders, and CONSTRUCTION.md carries the disclosures');
{
  const rows = [];
  for (let i = 0; i < 3; i++) rows.push({ id: 'sdc-00' + (i + 1), kind: 'seeded', variant: 'V1', baseKind: 'code', orderWords: 140 + i, claimsWords: 70 + i, orderHardness: 2, orderHardnessStrict: 1, labels: [], backticks: i === 0 ? 2 : 0, digitsPer100: 1, trigrams: [], idioms: { 'must never': 1 } });
  for (let i = 0; i < 3; i++) rows.push({ id: 'sdc-01' + (i + 1), kind: 'control', variant: 'V1', baseKind: 'code', orderWords: 145 + i, claimsWords: 74 + i, orderHardness: 2, orderHardnessStrict: 1, labels: [], backticks: 0, digitsPer100: 1, trigrams: [], idioms: {} });
  const md = assembleKeyLib.renderDistributionReport(rows);
  check('the report has all five gate sections',
    /\(1\) Word-count ranges and dispersion/.test(md) && /\(2\) Backticks/.test(md) && /\(3\) Digit density/.test(md) &&
    /\(4\) N-gram exclusivity/.test(md) && /\(5\) Idiom balance/.test(md), md.slice(0, 600));
  check('the backtick section names the offending file and marks FAIL', /\*\*FAIL\*\*.*sdc-001/.test(md), md);
  check('the idiom table shows the one-population idiom as a FAIL',
    /"must never".*\*\*FAIL\*\* \(one population only\)/.test(md), md.slice(md.indexOf('(5) Idiom'), md.indexOf('(5) Idiom') + 800));
  check('the ranges table prints min/max/sd for both populations', /\| ORDER \| seeded \| 140 \| 142 \|/.test(md), md.slice(0, 1200));
  check('the n-gram section states both the failing and the reported band',
    /≥6 artifacts of one population/.test(md) && /Reported, not gated/.test(md), md.slice(md.indexOf('(4) N-gram'), md.indexOf('(4) N-gram') + 700));

  // The topic-asymmetry disclosure.
  {
    const topicRows = [];
    for (let i = 0; i < 6; i++) topicRows.push({ id: 'sdc-00' + (i + 1), kind: 'seeded', variant: 'V1', baseKind: 'code', orderWords: 145, claimsWords: 76, orderHardness: 2, orderHardnessStrict: 1, labels: [], backticks: 0, digitsPer100: 1, trigrams: [], idioms: {} });
    for (let i = 0; i < 8; i++) topicRows.push({ id: 'sdc-01' + (i + 1), kind: 'control', variant: 'V1', baseKind: 'code', orderWords: 145, claimsWords: 76, orderHardness: 2, orderHardnessStrict: 1, labels: [], backticks: 0, digitsPer100: 1, trigrams: ['the band record'], idioms: {} });
    const t = assembleKeyLib.renderTopicAsymmetry(topicRows);
    check('the topic-asymmetry section exists', /### Topic asymmetry — a corpus-level property, disclosed/.test(t), t.slice(0, 300));
    const tFlat = t.replace(/\s+/g, ' ');
    check('…it states that controls carry docs/records commits the seeds do not',
      /documentation and records commits/.test(tFlat) && /every one of the 30 seeded bases is a CODE commit/i.test(tFlat), tFlat.slice(0, 900));
    check('…it says a whole-corpus classifier CAN separate them', /classifier with access to the WHOLE corpus can separate/.test(tFlat), t.slice(0, 1200));
    check('…and that a per-packet reviewer learns nothing about ITS packet',
      /learns nothing about whether THAT packet is seeded/.test(tFlat), t.slice(0, 1600));
    check('…it points at the sanitized run clone as the reason the distribution is unreachable',
      /sanitized run clone/.test(tFlat), t.slice(0, 1800));
    check('…and it lists the exclusive n-grams as evidence, with counts',
      /\| `the band record` \| control \| 8 \|/.test(t), t.slice(t.indexOf('| 3-gram'), t.indexOf('| 3-gram') + 500));
    check('the evidence table is capped at ten rows', (() => {
      const many = topicRows.map((r) => Object.assign({}, r));
      for (let i = 6; i < 14; i++) {
        many[i].trigrams = [];
        for (let g = 0; g < 20; g++) many[i].trigrams.push('control phrase' + g + ' here');
      }
      const t2 = assembleKeyLib.renderTopicAsymmetry(many);
      return (t2.match(/^\| `/gm) || []).length === 10;
    })());
  }
}

// ============================================================ ROUND 6
// Blind test #2 scored 24/24 through sha linkage across packets.

section('63. assemble-key.js — no brief names a sha (round-6, VARIANTS.md v3)');
{
  const content = { order: Array(90).fill('word').join(' '), claims: Array(50).fill('claim').join(' ') };
  const head = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  const HEX = /\b[0-9a-f]{7,40}\b/i;

  for (const variant of ['V1', 'V2', 'V3']) {
    for (const kind of ['seeded', 'control']) {
      const a = { id: 'sdc-001', kind, variant, base, subject: 'WO-11 round 3: findings applied and verdicts committed' };
      const b = assembleKeyLib.generateBriefs(a, head, content, 'code');
      check('round 6: the ' + kind + ' ' + variant + ' work order contains NO sha', !HEX.test(b.wo),
        (b.wo.match(HEX) || []).join(','));
      check('round 6: the ' + kind + ' ' + variant + ' executor report contains NO sha', !HEX.test(b.er),
        (b.er.match(HEX) || []).join(','));
      check('…and neither names the head or the base explicitly',
        b.wo.indexOf(head) === -1 && b.wo.indexOf(base) === -1 && b.er.indexOf(head) === -1 && b.er.indexOf(base) === -1);
    }
  }

  // The v3 replacement sentences are actually present.
  {
    const a = { id: 'sdc-001', kind: 'seeded', variant: 'V1', base, subject: 's' };
    const b = assembleKeyLib.generateBriefs(a, head, content, 'code');
    check('the work order says the change is whatever is at HEAD in this checkout',
      /Change under review: the commit checked out at HEAD in this checkout,\ncompared against its parent\./.test(b.wo), b.wo.slice(0, 260));
    check('the work order keeps the Commit subject line', /^Commit subject:      s$/m.test(b.wo), b.wo.slice(0, 260));
    check('the work order no longer carries a "Base (its parent)" line', !/Base \(its parent\)/.test(b.wo));
    check('the executor report says the change is the commit at HEAD',
      /^STATUS: DONE\. The change is the commit at HEAD\. An executor produced this change\.$/m.test(b.er), b.er.slice(0, 200));
  }
  {
    const a = { id: 'sdc-002', kind: 'control', variant: 'V2', base, subject: 's' };
    const b = assembleKeyLib.generateBriefs(a, head, content, 'code');
    check('the V2 author line survives the sha removal',
      /^STATUS: DONE\. The change is the commit at HEAD\. Claude Sonnet 5 · medium \(Anthropic\)$/m.test(b.er) &&
      /^produced this change\.$/m.test(b.er), b.er.slice(0, 220));
  }

  // The skeleton invariant still holds: 1 work-order skeleton across all
  // artifacts, 1 executor-report skeleton per variant, and no skeleton
  // exclusive to one population.
  {
    const rows = [];
    for (const [id, kind, variant] of [['sdc-001', 'seeded', 'V1'], ['sdc-002', 'control', 'V1'],
      ['sdc-003', 'seeded', 'V2'], ['sdc-004', 'control', 'V2'],
      ['sdc-005', 'seeded', 'V3'], ['sdc-006', 'control', 'V3']]) {
      // Deliberately DIFFERENT subjects and bases per artifact: the skeleton
      // must not depend on them.
      const a = { id, kind, variant, base: id.slice(-1).repeat(40), subject: 'subject for ' + id, phase: 0 };
      const h = id.slice(-1).repeat(40).replace(/./g, 'c');
      const b = assembleKeyLib.generateBriefs(a, h, content, 'code');
      rows.push({ id, kind, variant, baseKind: 'code', head: h, wo: b.wo, er: b.er,
        woSkeleton: assembleKeyLib.skeletonize(b.wo, a, h), erSkeleton: assembleKeyLib.skeletonize(b.er, a, h) });
    }
    const f = [];
    assembleKeyLib.structuralTellLint(rows, f);
    check('round 6: the structural-tell lint still passes after the sha removal', f.length === 0, JSON.stringify(f));
    check('round 6: still ONE work-order skeleton across all artifacts',
      new Set(rows.map((r) => r.woSkeleton)).size === 1);
    for (const v of ['V1', 'V2', 'V3']) {
      const inV = rows.filter((r) => r.variant === v);
      check('round 6: still ONE executor-report skeleton within ' + v,
        new Set(inV.map((r) => r.erSkeleton)).size === 1, JSON.stringify(inV.map((r) => r.erSkeleton)));
    }
  }
}

section('64. assemble-key.js — the hex lint (round-6)');
{
  const cases = [
    ['Change under review: commit ' + 'a'.repeat(40), 1, 'a full 40-hex sha'],
    ['see 15ff0b6 for details', 1, 'an abbreviated 7-char sha'],
    ['see 15FF0B6 for details', 1, 'an UPPERCASE abbreviated sha'],
    ['base 7bf8e794306376835716c422313e85d997eaf7c0 and head 772a6881219f61db76a79b9e99846cc97512b70e', 2, 'two shas on one line'],
    ['the guard was widened past its stated scope', 0, 'ordinary prose'],
    ['the ratio is 3:1 and the count is 12345', 0, 'a bare number (not 7+ hex chars)'],
    ['abc123', 0, 'six characters is below the floor'],
    ['deadbeef', 1, 'an 8-character hex word IS caught (accepted cost)'],
  ];
  for (const [text, expected, label] of cases) {
    const f = [];
    assembleKeyLib.hexLint('t.txt', text, f);
    check('hex lint: ' + label + ' -> ' + expected + ' finding(s)', f.length === expected, JSON.stringify(f));
  }
  {
    const f = [];
    assembleKeyLib.hexLint('t.txt', 'line one\nsee ' + 'f'.repeat(12) + ' here\n', f);
    check('hex lint names the file, the line number and the token',
      f.length === 1 && /^t\.txt:2:/.test(f[0]) && f[0].indexOf('"' + 'f'.repeat(12) + '"') !== -1, JSON.stringify(f));
    check('…and explains why a sha is a linkage key', /another packet's base/.test(f[0]), f[0]);
  }
  check('a generated brief passes the hex lint', (() => {
    const a = { id: 'sdc-001', kind: 'seeded', variant: 'V3', base: 'b'.repeat(40), subject: 'an ordinary subject' };
    const b = assembleKeyLib.generateBriefs(a, 'a'.repeat(40), { order: Array(90).fill('word').join(' '), claims: Array(50).fill('claim').join(' ') }, 'code');
    const f = [];
    assembleKeyLib.hexLint('wo', b.wo, f);
    assembleKeyLib.hexLint('er', b.er, f);
    return f.length === 0;
  })());

  // End to end: a content file that quotes a sha refuses the assembly.
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-hex-e2e-');
  const contentDir = path.join(work, 'content');
  fs.mkdirSync(contentDir, { recursive: true });
  const slots = [
    { id: 'sdc-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'sdc-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
  ];
  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  return a - b;\n}\n');
  });
  fs.writeFileSync(path.join(work, 'sdc-001.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(work, 'sdc-001.seed.json'), JSON.stringify({
    id: 'sdc-001', base: repo.base, commit: repo.commit, phase: 0, variant: 'V1',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');
  fs.writeFileSync(path.join(work, 'base-pool.json'), JSON.stringify({ slots }, null, 2), 'utf8');
  const cliArgs = ['--pool', path.join(work, 'base-pool.json'), '--corpus-dir', work,
    '--briefs-dir', path.join(work, 'briefs'), '--content-dir', contentDir,
    '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')];
  const claims = Array(45).fill('the change was made and verified').join(' ').split(' ').slice(0, 45).join(' ');
  const clean = ('The order must be followed exactly and the guard must never be widened; ' +
    'the adjacent module stays byte-identical and unchanged. ').repeat(3) + Array(58).fill('detail').join(' ');
  const cleanOrder = clean.split(' ').slice(0, 149).join(' ');
  fs.writeFileSync(path.join(contentDir, 'sdc-001.json'), JSON.stringify({ order: 'This reverts ' + 'a'.repeat(40) + ' ' + cleanOrder.split(' ').slice(0, 146).join(' '), claims }), 'utf8');
  fs.writeFileSync(path.join(contentDir, 'sdc-002.json'), JSON.stringify({ order: cleanOrder, claims }), 'utf8');
  const rBad = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('round 6: a content file quoting a sha REFUSES the assembly',
    rBad.status !== 0 && /looks like a commit sha/.test(rBad.stderr || ''), rBad.stderr);
  check('nothing was written', !fs.existsSync(path.join(work, 'key.json')));
}

section('65. blind-draw.js — deterministic, and never both members of a linked pair (round-6)');
{
  const blindDraw = require(path.join(WO12, 'blind-draw.js'));

  // A synthetic key with KNOWN linkage: sdc-001/sdc-051 share a base+commit,
  // as the corpus's 10 reused-base pairs do.
  const artifacts = [];
  for (let i = 1; i <= 30; i++) artifacts.push({ id: 'sdc-' + String(i).padStart(3, '0'), kind: 'seeded', base: 'base' + i, commit: 'commit' + i });
  for (let i = 31; i <= 84; i++) artifacts.push({ id: 'sdc-' + String(i).padStart(3, '0'), kind: 'control', base: 'base' + i, commit: 'commit' + i });
  // 10 reused pairs: control 51..60 reuse seeds 1..10's base and commit.
  const PAIRS = [];
  for (let i = 0; i < 10; i++) {
    const seedId = 'sdc-' + String(i + 1).padStart(3, '0');
    const ctlId = 'sdc-' + String(i + 51).padStart(3, '0');
    const ctl = artifacts.find((a) => a.id === ctlId);
    ctl.base = 'base' + (i + 1);
    ctl.commit = 'commit' + (i + 1);
    PAIRS.push([seedId, ctlId]);
  }
  const key = { version: 1, artifacts };

  const comp = blindDraw.linkageComponents(artifacts);
  check('linkage: the 10 reused pairs collapse to 10 shared components',
    new Set(Array.from(comp.values())).size === 84 - 10, String(new Set(Array.from(comp.values())).size));
  for (const [s, c] of PAIRS) {
    check('linkage: ' + s + ' and ' + c + ' are in the same component', comp.get(s) === comp.get(c));
  }

  // Determinism.
  const a1 = blindDraw.blindDraw(key, { seed: 'alpha', size: 6 });
  const a2 = blindDraw.blindDraw(key, { seed: 'alpha', size: 6 });
  const b1 = blindDraw.blindDraw(key, { seed: 'beta', size: 6 });
  check('the same seed gives the identical draw', a1.all.join(',') === a2.all.join(','), a1.all.join(','));
  check('a different seed gives a different draw', a1.all.join(',') !== b1.all.join(','));
  check('the draw is n seeded + n control', a1.seeded.length === 6 && a1.controls.length === 6, JSON.stringify(a1));
  check('every drawn id exists in the key', a1.all.every((id) => artifacts.some((x) => x.id === id)));
  check('the drawn ids are distinct', new Set(a1.all).size === a1.all.length);

  // THE property, over 200 seeds.
  {
    let violations = 0;
    let drawsChecked = 0;
    for (let s = 0; s < 200; s++) {
      const d = blindDraw.blindDraw(key, { seed: 'seed-' + s, size: 8 });
      drawsChecked++;
      const drawn = new Set(d.all);
      for (const [x, y] of PAIRS) if (drawn.has(x) && drawn.has(y)) violations++;
      // And the general form: no two drawn ids share a component.
      const seen = new Set();
      for (const id of d.all) {
        const c = comp.get(id);
        if (seen.has(c)) violations++;
        seen.add(c);
      }
    }
    check('round 6: over ' + drawsChecked + ' seeds, NO draw contains both members of a linked pair',
      violations === 0, violations + ' violation(s)');
  }

  // Exclusion of previously drawn ids.
  {
    const first = blindDraw.blindDraw(key, { seed: 'gamma', size: 6 });
    const second = blindDraw.blindDraw(key, { seed: 'gamma', size: 6, exclude: first.all });
    check('--exclude keeps a second round off the first round\'s ids',
      second.all.every((id) => first.all.indexOf(id) === -1), first.all.join(',') + ' vs ' + second.all.join(','));
    check('the excluded draw is still the right size', second.seeded.length === 6 && second.controls.length === 6);
    check('the exclusion count is reported', second.excludedCount === first.all.length);
  }

  // A draw too large to satisfy reports a shortfall rather than silently under-delivering.
  {
    const huge = blindDraw.blindDraw(key, { seed: 'delta', size: 40 });
    check('an unsatisfiable draw reports a shortfall', huge.shortfall.seeded > 0, JSON.stringify(huge.shortfall));
    check('…and still returns only valid, unlinked ids', (() => {
      const seen = new Set();
      for (const id of huge.all) { const c = comp.get(id); if (seen.has(c)) return false; seen.add(c); }
      return true;
    })());
  }

  // The real corpus, if it is present: the constraint must hold there too.
  {
    const realKeyPath = path.join(WO12, 'corpus', 'key.json');
    if (fs.existsSync(realKeyPath)) {
      const realKey = JSON.parse(fs.readFileSync(realKeyPath, 'utf8'));
      const realComp = blindDraw.linkageComponents(realKey.artifacts);
      let bad = 0;
      for (let s = 0; s < 200; s++) {
        const d = blindDraw.blindDraw(realKey, { seed: 'real-' + s, size: 6 });
        const seen = new Set();
        for (const id of d.all) { const c = realComp.get(id); if (seen.has(c)) bad++; seen.add(c); }
      }
      check('round 6: the constraint holds over 200 seeds on the REAL key.json', bad === 0, bad + ' violation(s)');
      check('the real corpus has 10 linked pairs (84 artifacts, 74 components)',
        new Set(Array.from(realComp.values())).size === realKey.artifacts.length - 10,
        String(new Set(Array.from(realComp.values())).size) + ' components for ' + realKey.artifacts.length + ' artifacts');
    } else {
      check('the real key.json is present for the linkage check', false, realKeyPath);
    }
  }

  // The CLI.
  {
    const r = spawnSync(process.execPath, [path.join(WO12, 'blind-draw.js'), '--seed', 'cli-test', '--size', '4', '--json'],
      { encoding: 'utf8' });
    check('the CLI exits 0 and prints JSON', r.status === 0 && /"seeded"/.test(r.stdout || ''), (r.stderr || '') + (r.stdout || '').slice(0, 200));
    let parsed = null;
    try { parsed = JSON.parse(r.stdout); } catch (e) { /* reported */ }
    check('the JSON carries both lists and the seed', !!parsed && parsed.seeded.length === 4 && parsed.controls.length === 4 && parsed.seed === 'cli-test', JSON.stringify(parsed));
    const rHuman = spawnSync(process.execPath, [path.join(WO12, 'blind-draw.js'), '--seed', 'cli-test', '--size', '4'], { encoding: 'utf8' });
    check('the human output labels both lists and warns to shuffle before handing them over',
      /SEEDED  \(4\)/.test(rHuman.stdout || '') && /SHUFFLED and RENAMED/.test(rHuman.stdout || ''), rHuman.stdout);
    const rNoSeed = spawnSync(process.execPath, [path.join(WO12, 'blind-draw.js'), '--size', '4'], { encoding: 'utf8' });
    check('the CLI refuses without --seed (reproducibility is the point)',
      rNoSeed.status !== 0 && /--seed <string> is required/.test(rNoSeed.stderr || ''), rNoSeed.stderr);
  }
}

// ============================================================ ROUND 7
// roster/wo12-r0-review-anthropic-4.md

section('67. score.js — identity reads the SERVED model first (round-7 CRITICAL 1)');
{
  const T = 'gpt-5.6-terra';
  // The record's own table, row for row.
  const table = [
    ['REVIEW ENGINE: gpt-5.6-terra', null, 'MATCHED', 'echoed-request', 'plain echo'],
    ['REVIEW ENGINE: gpt-5.6-terra (served_model not reported)', null, 'MATCHED', 'echoed-request', 'the disclaimer'],
    ['REVIEW ENGINE: gpt-5.6-terra (served_model: claude-opus-5)', 'claude-opus-5', 'MISMATCHED', 'contradicted', 'inline contradiction'],
    ['REVIEW ENGINE: gpt-5.6-terra\nserved_model: claude-opus-5', 'claude-opus-5', 'MISMATCHED', 'contradicted', 'separate-line contradiction'],
    ['REVIEW ENGINE: gpt-5.6-terra (served_model: gpt-5.6-terra)', T, 'MATCHED', 'independent', 'inline agreement'],
    ['REVIEW ENGINE: gpt-5.6-terra\nserved_model: gpt-5.6-terra', T, 'MATCHED', 'independent', 'separate-line agreement'],
    ['REVIEW ENGINE: gpt-5.6-terra (served_model: not reported)', null, 'MATCHED', 'echoed-request', 'a field with a non-value'],
    ['REVIEW ENGINE: NONE — no cross-vendor review was produced.', null, 'UNKNOWN', 'header-only', 'REVIEW ENGINE: NONE'],
  ];
  for (const [header, served, identity, evidence, label] of table) {
    check('identity: ' + label + ' → served ' + JSON.stringify(served),
      scoreLib.extractServedModel(header) === served, JSON.stringify(scoreLib.extractServedModel(header)));
    check('identity: ' + label + ' → ' + identity,
      scoreLib.classifyIdentity(header, T) === identity, scoreLib.classifyIdentity(header, T));
    check('identity: ' + label + ' → evidence ' + evidence,
      scoreLib.identityEvidence(header, T) === evidence, scoreLib.identityEvidence(header, T));
  }
  check('CRITICAL 1: no substring heuristic — `model:` is NOT read as a served model',
    scoreLib.extractServedModel('REVIEW ENGINE: codex model: gpt-5.6-terra') === null);
  check('CRITICAL 1: a bare `REVIEW ENGINE: <x>` is not a served model either',
    scoreLib.extractServedModel('REVIEW ENGINE: gpt-5.6-terra') === null);
  check('served-model comparison is exact, not a substring',
    scoreLib.classifyIdentity('served_model: gpt-5.6-terra-preview', T) === 'MISMATCHED');

  // run-lane must carry BOTH lines so amendment (viii)'s remedy can land.
  check('CRITICAL 1: extractEngineHeader keeps the REVIEW ENGINE line AND a separate served_model line',
    runLaneLib.extractEngineHeader('REVIEW ENGINE: gpt-5.6-terra\nsome prose\nserved_model: claude-opus-5\n')
      === 'REVIEW ENGINE: gpt-5.6-terra\nserved_model: claude-opus-5');
  check('…a served_model line alone is still captured',
    runLaneLib.extractEngineHeader('served_model: gpt-5.6-terra\n') === 'served_model: gpt-5.6-terra');
  check('…and a plain header is unchanged',
    runLaneLib.extractEngineHeader('REVIEW ENGINE: gpt-5.6-terra\n') === 'REVIEW ENGINE: gpt-5.6-terra');

  // Gate 5 end to end on the three headers that matter.
  const artifacts = [];
  for (let i = 1; i <= 30; i++) artifacts.push({ id: 'sdc-' + String(i).padStart(3, '0'), kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } });
  for (let i = 31; i <= 84; i++) artifacts.push({ id: 'sdc-' + String(i).padStart(3, '0'), kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null });
  const key = { version: 1, artifacts };
  const ADJ = [{ id: 'sdc-031', lane: 'X-Terra', severity: 'MINOR', finding: 'a MINOR nit, not a blocker finding at all', verdict: 'DEBATABLE', second: 'DEBATABLE' }];
  const gateFor = (header) => {
    const recs = [];
    for (const lane of ['X-Sol', 'X-Terra']) {
      for (const a of artifacts) {
        const seeded = a.kind === 'seeded';
        recs.push({
          id: a.id, lane, phase: 0, variant: 'V1', expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane], runIndex: 0,
          attempts: [{ wallMs: 1, verdict: seeded ? 'REVISE' : 'APPROVE', status: 'COMPLETED', unavailable: false,
            engineHeader: header(lane), integrityWarning: false,
            stdout: seeded ? 'VERDICT: REVISE\n\nFINDINGS\n- [MAJOR] a.js:1 — found it\n\nCLAIMS CHECKED\n- none\n'
              : 'VERDICT: APPROVE\n\nFINDINGS\n- none\n\nCLAIMS CHECKED\n- none\n' }],
        });
      }
    }
    const { scored } = scoreLib.scoreRecords(recs, key, {});
    return scoreLib.gate12f(scored, key, ADJ, scoreLib.identityExclusions(scored));
  };
  const gEcho = gateFor((l) => 'REVIEW ENGINE: ' + scoreLib.LANE_EXPECTED_MODEL[l]);
  check('gate 5 on a plain echo is LIMITED', gEcho.items.find((i) => i.n === 5).status === 'LIMITED', gEcho.items.find((i) => i.n === 5).status);
  const gDisclaim = gateFor((l) => 'REVIEW ENGINE: ' + scoreLib.LANE_EXPECTED_MODEL[l] + ' (served_model not reported)');
  check('CRITICAL 1: the disclaimer header no longer lifts gate 5 to PASS — it is LIMITED',
    gDisclaim.items.find((i) => i.n === 5).status === 'LIMITED', gDisclaim.items.find((i) => i.n === 5).status);
  const gWrong = gateFor((l) => 'REVIEW ENGINE: ' + scoreLib.LANE_EXPECTED_MODEL[l] + ' (served_model: claude-opus-5)');
  check('CRITICAL 1: a lane SERVED BY THE FLAGSHIP now FAILS gate 5 (it used to PASS)',
    gWrong.items.find((i) => i.n === 5).status === 'FAIL', gWrong.items.find((i) => i.n === 5).detail.slice(0, 180));
  check('…and `overall` is FAIL, not PASS-eligible', gWrong.overall === 'FAIL', gWrong.overall);
  const gGood = gateFor((l) => 'REVIEW ENGINE: ' + scoreLib.LANE_EXPECTED_MODEL[l] + '\nserved_model: ' + scoreLib.LANE_EXPECTED_MODEL[l]);
  check('a genuine served_model agreeing with the request PASSES gate 5',
    gGood.items.find((i) => i.n === 5).status === 'PASS', gGood.items.find((i) => i.n === 5).detail.slice(0, 180));
}

section('68. score.js — the FINDINGS window ends at the next header of ANY kind (round-7 MAJOR 4)');
{
  const seed = { locator: { file: 'hooks/orchestra-guard.js', lines: [339, 345], symbol: 'guard' } };

  // The record's first reproducer: a bullet under VERIFICATION RE-RUN.
  const verification = [
    'VERDICT: APPROVE', '', 'FINDINGS', '- none.', '',
    'VERIFICATION RE-RUN',
    '- [MINOR] hooks/orchestra-guard.js:339 — I looked at the marker block while re-running and it seemed fine.',
    '', 'CLAIMS CHECKED', '- none',
  ].join('\n');
  const sec1 = scoreLib.extractFindingsSection(verification);
  check('MAJOR 4: a VERIFICATION RE-RUN block is OUTSIDE the findings section',
    sec1.indexOf('orchestra-guard.js') === -1, JSON.stringify(sec1));
  check('MAJOR 4: and it mints no mechanical hit',
    scoreLib.evaluateSeedHit(seed, scoreLib.splitFindingBlocks(sec1), {}).hit === false);

  // The second: no terminator at all, transcript ends in the runner's ATTEMPT LOG.
  const attemptLog = [
    'VERDICT: REVIEW_UNAVAILABLE', '', 'FINDINGS', '- none.', '',
    'FINALITY: this runner made 1 engine attempt and will make no more.',
    '--- ATTEMPT LOG (diagnostics for the attempt(s) that produced nothing) ---',
    'ATTEMPT 1 of 2 — review timed out after 1800000ms',
    '  codex stderr (last 25 lines):',
    '    749: * hooks/orchestra-guard.js:339 anywhere – including reviewer prose about the diff',
  ].join('\n');
  const sec2 = scoreLib.extractFindingsSection(attemptLog);
  check('MAJOR 4: an ATTEMPT LOG tail is OUTSIDE the findings section',
    sec2.indexOf('orchestra-guard.js') === -1, JSON.stringify(sec2));
  check('MAJOR 4: and the embedded source-code tail mints no hit',
    scoreLib.evaluateSeedHit(seed, scoreLib.splitFindingBlocks(sec2), {}).hit === false);

  // Terminators of every shape.
  for (const [term, label] of [['CLAIMS CHECKED', 'the classic terminator'], ['NITS', 'NITS'],
    ['VERIFICATION RE-RUN', 'an ALL-CAPS header with a hyphen'], ['EVIDENCE', 'a one-word ALL-CAPS header'],
    ['## Summary', 'a markdown header'], ['SUMMARY:', 'an ALL-CAPS header with a colon'],
    ['--- ATTEMPT LOG ---', 'a runner delimiter'], ['FINALITY: no more attempts', 'the FINALITY line']]) {
    const text = 'FINDINGS\n- [MAJOR] a.js:1 — real finding\n' + term + '\n- [MAJOR] hooks/orchestra-guard.js:340 — planted\n';
    const sec = scoreLib.extractFindingsSection(text);
    check('MAJOR 4: ' + label + ' ends the section', sec.indexOf('planted') === -1 && sec.indexOf('real finding') !== -1,
      JSON.stringify(sec));
  }
  // A real finding is still found.
  const good = 'FINDINGS\n- [MAJOR] hooks/orchestra-guard.js:340 — the seeded fault\n\nCLAIMS CHECKED\n- none\n';
  check('a genuine finding inside the section still hits',
    scoreLib.evaluateSeedHit(seed, scoreLib.splitFindingBlocks(scoreLib.extractFindingsSection(good)), {}).hit === true);
  check('a multi-line wrapped finding is still folded into one block',
    scoreLib.splitFindingBlocks(scoreLib.extractFindingsSection(
      'FINDINGS\n- [MAJOR] hooks/orchestra-guard.js:340 — the fault\n  continues on this line\n\nNITS\n- x\n')).length === 1);
}

section('69. score.js / run-lane.js — the round-7 MINORs');
{
  // MINOR 1: a short blocker must be adjudicable.
  const artifacts = [{ id: 'sdc-001', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null }];
  for (let i = 2; i <= 84; i++) artifacts.push({ id: 'sdc-' + String(i).padStart(3, '0'), kind: i <= 31 ? 'seeded' : 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: i <= 31 ? { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } : null });
  const key = { version: 1, artifacts };
  const SHORT = '[MAJOR] a.js:1 — b'; // 18 normalized characters
  check('the short blocker really is below the promotion floor', scoreLib.normalizeWhitespace(SHORT).length < 20, String(scoreLib.normalizeWhitespace(SHORT).length));
  const scored = [];
  for (const lane of ['X-Sol', 'X-Terra']) {
    artifacts.forEach((a, idx) => scored.push({
      id: a.id, lane, phase: 0, variant: 'V1', order: idx, kind: a.kind, type: a.seed ? 'CV' : null,
      severity: a.seed ? 'MAJOR' : null, hit: false, nearMisses: [], adjudicatedPromotion: false,
      blockerFindings: a.id === 'sdc-001' ? 1 : 0, blockerFindingTexts: a.id === 'sdc-001' ? [SHORT] : [],
      unavailableFinal: false, noVerdict: false, integrityWarning: false,
      expectedModel: scoreLib.LANE_EXPECTED_MODEL[lane], servedModel: scoreLib.LANE_EXPECTED_MODEL[lane],
      identity: 'MATCHED', identityKnown: true, identityMismatch: false, identityUnknown: false,
      identityEvidence: 'independent', emptyFindingsSection: false, finalStatus: 'COMPLETED', attemptCount: 1, sourceFile: 'x',
    }));
  }
  const g = (adj) => scoreLib.gate12f(scored, key, adj, scoreLib.identityExclusions(scored)).items.find((i) => i.n === 3);
  check('MINOR 1: a blocker shorter than the 20-char floor IS adjudicable by an exact entry',
    g([{ id: 'sdc-001', lane: 'X-Terra', severity: 'MAJOR', finding: SHORT, verdict: 'REAL', second: 'REAL' }]).status === 'PASS',
    g([{ id: 'sdc-001', lane: 'X-Terra', severity: 'MAJOR', finding: SHORT, verdict: 'REAL', second: 'REAL' }]).detail.slice(0, 160));
  check('…and a non-matching entry still leaves it INCOMPLETE',
    g([{ id: 'sdc-001', lane: 'X-Terra', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — something else entirely', verdict: 'REAL', second: 'REAL' }]).status === 'INCOMPLETE');
  check('MINOR 1: the uncovered-finding list prints the FULL text the entry must match, not a truncation',
    g([]).detail.indexOf(SHORT) !== -1 || g([{ id: 'sdc-002', lane: 'X-Terra', finding: 'x', verdict: 'REAL', second: 'REAL' }]).detail.indexOf(SHORT) !== -1,
    g([{ id: 'sdc-002', lane: 'X-Terra', finding: 'x', verdict: 'REAL', second: 'REAL' }]).detail.slice(0, 200));

  // MINOR 4: score.js validates artifact ids like build-corpus does.
  {
    const dir = tmpDir('wo12-scorekey-');
    const bad = path.join(dir, 'key.json');
    fs.writeFileSync(bad, JSON.stringify({ version: 1, artifacts: [{ id: '../victim', kind: 'control' }] }), 'utf8');
    const r = spawnSync(process.execPath, [SCORE, '--key', bad, '--results-dir', dir], { encoding: 'utf8' });
    check('MINOR 4: score.js loadKey refuses an invalid artifact id', r.status !== 0 && /invalid id/.test(r.stderr || ''), r.stderr);
    const good = path.join(dir, 'good.json');
    fs.writeFileSync(good, JSON.stringify({ version: 1, artifacts: [{ id: 'sdc-001', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null }] }), 'utf8');
    const r2 = spawnSync(process.execPath, [SCORE, '--key', good, '--results-dir', dir, '--out', path.join(dir, 'out.json')], { encoding: 'utf8' });
    check('…and accepts a well-formed one', r2.status === 0, r2.stderr);
  }

  // MINOR 2: pending can halt.
  {
    const dir = tmpDir('wo12-pending-');
    const recs = [];
    for (let i = 1; i <= 4; i++) recs.push({ id: 'sdc-00' + i, attempts: [{ status: 'UNAVAILABLE', unavailable: true }] });
    fs.writeFileSync(path.join(dir, 'results-X-Sol-phase0.json'), JSON.stringify(recs, null, 2), 'utf8');
    const c = runLaneLib.countUnavailableOnDisk(dir, 0, ['X-Sol'])['X-Sol'];
    check('MINOR 2: single-attempt records count as `pending`, not `final`', c.count === 0 && c.pending === 4, JSON.stringify(c));
    check('MINOR 2: count + pending breaches the §2.6 threshold',
      c.count + c.pending > runLaneLib.PHASE0_MAX_UNAVAILABLE);
  }

  // MINOR 3: --override-log validation.
  {
    const repo = makeSourceRepo();
    const corpus = miniLaneCorpus(repo);
    const stubs = tmpDir('wo12-ovl-');
    const refused = writeStub(stubs, 'refused.js', 'process.stderr.write("REFUSED for OU: none.\\n");\nprocess.exit(1);\n');
    const base = ['--lane', 'X-Terra', '--phase', '0', '--yes', '--override-p0', 'owner probe',
      '--key', corpus.keyPath, '--briefs-dir', corpus.briefs, '--patches-dir', corpus.dir,
      '--source-repo', repo.dir, '--results-dir', corpus.dir,
      '--clone-root', path.join(corpus.dir, 'clone'), '--run-clone-root', path.join(corpus.dir, 'run'),
      '--runner', path.join(stubs, 'never.js')];
    const env = { WO12_QM_CMD: q(process.execPath) + ' ' + q(refused) };
    const rel = runLane(base.concat(['--override-log', '../../../evil.log']), env);
    check('MINOR 3: a RELATIVE --override-log is refused', rel.status !== 0 && /must be an ABSOLUTE path/.test(rel.stderr || ''), rel.stderr);
    const outside = runLane(base.concat(['--override-log', path.join(tmpDir('wo12-ovl-out-'), 'evil.log')]), env);
    check('MINOR 3: an absolute path OUTSIDE the results dir is refused',
      outside.status !== 0 && /must resolve INSIDE the results directory/.test(outside.stderr || ''), outside.stderr);
    check('…and no ledger was created outside the results dir',
      !fs.existsSync(path.join(WO12, 'p0-overrides.log')));
  }
}

section('70. assemble-key.js — sentence shape and unigram exclusivity (round-7 amendment (xii))');
{
  // (a) The tokenizer, on the shapes that must NOT split.
  const S = assembleKeyLib.splitIntoSentences;
  const tok = [
    ['Run install.js first. Then check the output.', 2, 'a path with a dot'],
    ['The suite tests/quartermaster.test.js is green. It passed.', 2, 'a dotted test path'],
    ['Use the .cmd shim on Windows. It works.', 2, 'a leading-dot extension'],
    ['He said "it is done." The next step follows.', 2, 'a sentence ending in a quoted period'],
    ['The guard — which was widened — must never move. Keep it.', 2, 'an em-dash clause'],
    ['Version 2.3.0 shipped. Nothing else changed.', 2, 'a version number'],
    ['One sentence with no terminator', 1, 'no terminator at all'],
    ['', 0, 'empty text'],
  ];
  for (const [text, n, label] of tok) {
    check('tokenizer: ' + label + ' → ' + n + ' sentence(s)', S(text).length === n, JSON.stringify(S(text)));
  }
  check('shortestSentenceWords finds the short one', assembleKeyLib.shortestSentenceWords('Done. A much longer sentence here indeed.') === 1);
  check('shortestSentenceWords on empty text is 0', assembleKeyLib.shortestSentenceWords('') === 0);

  const mkRow = (id, kind, o) => Object.assign({
    id, kind, variant: 'V1', baseKind: 'code', orderWords: 145, claimsWords: 76, orderHardness: 2,
    orderHardnessStrict: 1, labels: [], backticks: 0, digitsPer100: 1.0, trigrams: [], idioms: {},
    unigrams: [], sentences: { order: [{ text: 'x', words: 20 }], claims: [{ text: 'y', words: 20 }] }, shortestSentence: 20,
  }, o || {});
  const balanced = () => {
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push(mkRow('sdc-' + String(i + 1).padStart(3, '0'), 'seeded'));
    for (let i = 0; i < 54; i++) rows.push(mkRow('sdc-' + String(i + 31).padStart(3, '0'), 'control'));
    return rows;
  };
  { const f = []; assembleKeyLib.distributionLint(balanced(), f); check('(xii) a balanced corpus passes both new gates', f.length === 0, JSON.stringify(f)); }

  // (a) the sentence floor.
  {
    const rows = balanced();
    rows[0].sentences = { order: [{ text: 'Done.', words: 1 }, { text: 'a long one here indeed truly', words: 20 }], claims: [{ text: 'y', words: 20 }] };
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(xii)(a) a 1-word sentence is a hard failure naming file, field and sentence',
      f.some((x) => /content\/sdc-001\.json \(seeded\) `order` contains a 1-word sentence: "Done\."/.test(x)), JSON.stringify(f.slice(0, 2)));
  }
  {
    const rows = balanced();
    rows[40].sentences = { order: [{ text: 'x', words: 20 }], claims: [{ text: 'All green.', words: 2 }, { text: 'z', words: 20 }] };
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(xii)(a) the floor applies to CONTROLS and to `claims` too',
      f.some((x) => /\(control\) `claims` contains a 2-word sentence/.test(x)), JSON.stringify(f.slice(0, 2)));
  }
  {
    const rows = balanced();
    for (const r of rows) r.sentences = { order: [{ text: 'x', words: assembleKeyLib.MIN_SENTENCE_WORDS }], claims: [{ text: 'y', words: 30 }] };
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(xii)(a) exactly the floor passes', !f.some((x) => /-word sentence/.test(x)), JSON.stringify(f));
  }
  // (a) shortest-sentence mean parity.
  {
    const rows = balanced();
    for (const r of rows) r.shortestSentence = r.kind === 'seeded' ? 6 : 13;
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(xii)(a) a 7-word shortest-sentence mean gap is a hard failure',
      f.some((x) => /mean SHORTEST SENTENCE differs by 7\.00/.test(x)), JSON.stringify(f.filter((x) => /SHORTEST/.test(x))));
    check('…and the report carries both populations\' stats', rep.sentences.seeded.mean === 6 && rep.sentences.control.mean === 13);
  }
  {
    const rows = balanced();
    for (const r of rows) r.shortestSentence = r.kind === 'seeded' ? 11 : 13;
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(xii)(a) a 2-word gap is inside the tolerance', !f.some((x) => /SHORTEST/.test(x)), JSON.stringify(f));
  }

  // (b) unigram exclusivity.
  check('unigramsOf keeps content words of ≥4 chars only',
    Array.from(assembleKeyLib.unigramsOf('the deletions and insertions on 42 a big')).sort().join(',') === 'deletions,insertions');
  {
    const rows = balanced();
    for (let i = 30; i < 43; i++) rows[i].unigrams = ['deletions'];
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(xii)(b) a word in 13 controls and 0 seeds is a hard failure naming it',
      f.some((x) => /the word "deletions" occurs in 13 control artifact\(s\)/.test(x)), JSON.stringify(f.filter((x) => /deletions/.test(x))));
    check('…and the report names the files', rep.unigrams.length === 1 && rep.unigrams[0].ids.length === 13);
  }
  for (const n of [5, 6, 7]) {
    const rows = balanced();
    for (let i = 0; i < n; i++) rows[i].unigrams = ['protocol'];
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(xii)(b) ' + n + ' documents is REPORTED, not failed', f.length === 0 && rep.unigramsReported.length === 1, JSON.stringify(f));
  }
  {
    const rows = balanced();
    for (let i = 0; i < 4; i++) rows[i].unigrams = ['protocol'];
    const f = [];
    const rep = assembleKeyLib.distributionLint(rows, f);
    check('(xii)(b) 4 documents is below the reporting band', f.length === 0 && rep.unigramsReported.length === 0);
  }
  {
    const rows = balanced();
    for (let i = 0; i < 10; i++) rows[i].unigrams = ['protocol'];
    rows[40].unigrams = ['protocol'];
    const f = [];
    assembleKeyLib.distributionLint(rows, f);
    check('(xii)(b) a word used by BOTH populations passes at any frequency', f.length === 0, JSON.stringify(f));
  }

  // (c) the rendered sections.
  {
    const rows = balanced();
    rows[0].unigrams = [];
    const md = assembleKeyLib.renderDistributionReport(rows);
    check('(c) the report has the sentence-shape section', /\(6\) Sentence shape/.test(md), md.slice(0, 400));
    check('(c) …with both populations\' shortest-sentence mean ± sd', /\| seeded \| 20\.00 ± 0\.00 \|/.test(md), md.slice(md.indexOf('(6) Sentence'), md.indexOf('(6) Sentence') + 700));
    check('(c) the report has the unigram section', /\(7\) Unigram exclusivity/.test(md));
    const std = assembleKeyLib.renderStoppingStandard(rows);
    check('(c) the Stopping standard section exists', /## Stopping standard \(protocol amendment \(xii\)\)/.test(std), std.slice(0, 300));
    check('(c) …it quotes the standard', /every feature family a reader could key on is measured/.test(std.replace(/\s+/g, ' ')), std.slice(0, 1200));
    check('(c) …and lists every gated feature with a verdict',
      /sentence floor/.test(std) && /unigram exclusivity/i.test(std) && /3-gram exclusivity/.test(std) && /no sha in any brief/.test(std),
      std.slice(std.indexOf('| # |'), std.indexOf('| # |') + 1400));
    check('(c) …with the disclosed-not-removed list', /Disclosed rather than removed/.test(std));
  }
}

section('71. round-6 MAJOR 3 — no brief in the sealed corpus contains a resolvable sha');
{
  // The round-4 record's MAJOR 3: 54/54 control heads resolved in the repository
  // and 0/30 seeded heads did, so one `git cat-file -t` labelled the corpus at
  // 100%/100%. Round 6 removed every sha from every brief (VARIANTS v3 +
  // hexLint), which kills the oracle at its source: there is no sha to resolve.
  const briefsDir = path.join(WO12, 'corpus', 'briefs');
  if (!fs.existsSync(briefsDir)) {
    check('the sealed briefs directory is present', false, briefsDir);
  } else {
    const files = fs.readdirSync(briefsDir).filter((f) => /\.(wo|er)\.txt$/.test(f));
    check('the sealed corpus has 168 brief files', files.length === 168, String(files.length));
    const HEX = /\b[0-9a-f]{7,40}\b/i;
    const offenders = [];
    for (const f of files) {
      const text = fs.readFileSync(path.join(briefsDir, f), 'utf8');
      const m = text.match(HEX);
      if (m) offenders.push(f + ': ' + m[0]);
    }
    check('round-6: NO brief contains a token that could be a sha (7-40 hex chars)',
      offenders.length === 0, offenders.slice(0, 8).join(' | '));
    check('round-6: no brief names "Change under review: commit <sha>"',
      !files.some((f) => /Change under review: commit [0-9a-f]/i.test(fs.readFileSync(path.join(briefsDir, f), 'utf8'))));
    check('round-6: no brief carries a "Base (its parent)" line',
      !files.some((f) => /Base \(its parent\)/.test(fs.readFileSync(path.join(briefsDir, f), 'utf8'))));
    // And the lint that keeps it that way is wired into generation.
    const f2 = [];
    assembleKeyLib.hexLint('t', 'Change under review: commit ' + 'a'.repeat(40), f2);
    check('round-6: hexLint still refuses a sha', f2.length === 1);
  }
}

section('72. the suite itself writes NOTHING into the repository (round-5 incident guard)');
{
  if (WO12_STATUS_AT_START === null) {
    check('working-tree guard: not a git checkout, so the guard cannot run (reported, not silently skipped)', false,
      'git status --porcelain failed in ' + MASTER);
  } else {
    const now = wo12PorcelainStatus();
    const before = new Set(WO12_STATUS_AT_START.split('\n').filter(Boolean));
    const after = (now || '').split('\n').filter(Boolean);
    // Only ADDITIONS can be this suite's doing. Entries that DISAPPEAR mean a
    // concurrently-running agent committed or reverted its own work — that is
    // activity in the same tree, not a side effect of these checks, and failing
    // on it makes the guard fire on other people's commits. (Observed: a content
    // agent committed sdc-060/071/073.json mid-run; a verification agent
    // reverted run-lane.js.) The guard's question is "did the SUITE write
    // anything", and only new dirt answers that.
    const added = after.filter((l) => !before.has(l));
    const gone = Array.from(before).filter((l) => after.indexOf(l) === -1);
    check('`git status --porcelain` under wo12/ gained NOTHING from this suite',
      added.length === 0, 'NEW: ' + (added.join(' | ') || '(none)'));
    if (gone.length) {
      check('note: ' + gone.length + ' pre-existing entr(y/ies) disappeared during the run — concurrent agent activity, not this suite',
        true);
    }
    check('specifically: no p0-overrides.log was created in the repository',
      !/p0-overrides\.log/.test(now || ''), now || '');
    check('specifically: this suite rewrote no key.json, CONSTRUCTION.md or brief',
      !added.some((l) => /key\.json|CONSTRUCTION\.md|briefs\//.test(l)), added.join(' | '));
  }

  // The ledger path is derived, not fixed — the property that makes the above
  // true no matter how a check is interrupted.
  const args = runLaneLib.parseArgs(['--lane', 'X-Terra', '--phase', '0', '--results-dir', 'C:\\tmp\\r']);
  check('parseArgs accepts --override-log', runLaneLib.parseArgs(['--lane', 'X-Terra', '--phase', '0', '--override-log', 'x.log']).overrideLog === 'x.log');
  check('--override-log defaults to null so the ledger follows --results-dir', args.overrideLog === null);
  check('run-lane.js contains no fixed-repo-path ledger write', (() => {
    const src = fs.readFileSync(RUN_LANE, 'utf8');
    return !/path\.join\(HERE,\s*OVERRIDE_LOG_BASENAME\)/.test(src);
  })(), 'path.join(HERE, OVERRIDE_LOG_BASENAME) must not reappear');
}

// ---------------------------------------------------------------- summary

console.log('\n' + (failures === 0 ? 'OK' : 'FAILED') + ' — ' + passes + ' passed, ' + failures + ' failed');
finish();
