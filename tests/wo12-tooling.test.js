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
    id: 'rl-001', kind: 'control', phase: phase === undefined ? 0 : phase, variant: 'V1',
    base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }];
  fs.writeFileSync(path.join(briefs, 'rl-001.wo.txt'), 'work order\n');
  fs.writeFileSync(path.join(briefs, 'rl-001.er.txt'), 'executor report\n');
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
  fs.writeFileSync(path.join(work, 'r-001.patch'), patch, 'utf8');
  const keyPath = writeKey(work, [{
    id: 'r-001', kind: 'seeded', phase: 0, variant: 'V1',
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
      BUILD_CORPUS, '--id', 'r-001', '--key', keyPath, '--corpus-dir', work, '--patches-dir', work,
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
  fs.writeFileSync(path.join(work, 'b-001.patch'),
    'diff --git a/nope.js b/nope.js\n--- a/nope.js\n+++ b/nope.js\n@@ -1,1 +1,1 @@\n-nothing\n+something\n', 'utf8');
  const keyPath = writeKey(work, [{
    id: 'b-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }]);
  const r = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'b-001', '--key', keyPath,
    '--corpus-dir', work, '--patches-dir', work, '--source-repo', repo.dir, '--clone-root', path.join(work, 'clone')],
  { encoding: 'utf8' });
  check('exits non-zero on an unapplyable patch', r.status !== 0, 'status=' + r.status);
  check('error names the failure as a patch-apply problem', /patch failed to apply/i.test(r.stderr || ''), r.stderr);

  const work2 = tmpDir('wo12-emptypatch-');
  fs.writeFileSync(path.join(work2, 'b-002.patch'), '', 'utf8');
  let threw = null;
  try {
    const clone = path.join(work2, 'clone');
    buildCorpusLib.ensureClone(repo.dir, clone);
    buildCorpusLib.materializeArtifact(
      { id: 'b-002', kind: 'seeded', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT },
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
    id: 'c-001', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }]);
  const r = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'c-001', '--key', keyPath,
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
  fs.writeFileSync(path.join(work, 's-001.patch'), patch, 'utf8');
  const artifacts = [
    { id: 's-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null },
    { id: 's-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null },
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
    git(['for-each-ref'], path.join(work, 'run', 's-001')) === git(['for-each-ref'], path.join(work, 'run', 's-002')));
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
  {
    const absent = path.join(repoA.dir, 'does', 'not', 'exist', 'yet');
    const resolvedParent = buildCorpusLib.realResolve(repoA.dir);
    const resolvedAbsent = buildCorpusLib.realResolve(absent);
    check('realResolve resolves a path that does not exist yet, via its nearest existing ancestor',
      buildCorpusLib.isInside(resolvedParent, resolvedAbsent), resolvedParent + ' vs ' + resolvedAbsent);
    check('realResolve keeps the non-existent remainder intact',
      resolvedAbsent.endsWith(path.join('does', 'not', 'exist', 'yet')), resolvedAbsent);
    check('isInside is false for a sibling whose name merely shares a prefix',
      buildCorpusLib.isInside('/a/repo', '/a/repo-backup') === false);
    check('isInside is false for the same directory', buildCorpusLib.isInside('/a/repo', '/a/repo') === false);
    check('isInside is true for a real child', buildCorpusLib.isInside('/a/repo', '/a/repo/child') === true);
    check('isInside does not mistake a directory named "..config" for an escape',
      buildCorpusLib.isInside('/a/repo', '/a/repo/..config') === true);
    if (buildCorpusLib.CASE_INSENSITIVE_FS) {
      check('on a case-insensitive filesystem, case alone does not make a path "outside"',
        buildCorpusLib.isInside('C:\\A\\Repo', 'c:\\a\\repo\\child') === true);
      check('on a case-insensitive filesystem, samePath ignores case',
        buildCorpusLib.samePath('C:\\A\\Repo', 'c:\\a\\repo') === true);
    }
  }

  // --all: a stale materialized.json must not outlive a failing run.
  const work2 = tmpDir('wo12-all-');
  const stale = path.join(work2, 'materialized.json');
  fs.writeFileSync(stale, '[{"id":"STALE"}]\n', 'utf8');
  const keyPath = writeKey(work2, [
    { id: 'a-001', kind: 'control', phase: 0, variant: 'V1', base: repoA.base, commit: repoA.commit, subject: REAL_SUBJECT, seed: null },
    { id: 'a-002', kind: 'seeded', phase: 0, variant: 'V1', base: repoA.base, commit: repoA.commit, subject: REAL_SUBJECT, seed: null },
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
  const overrideLog = path.join(WO12, runLaneLib.OVERRIDE_LOG_BASENAME);
  const before = fs.existsSync(overrideLog) ? fs.readFileSync(overrideLog, 'utf8') : null;
  cleanups.push(() => {
    if (before === null) { try { fs.rmSync(overrideLog, { force: true }); } catch (e) { /* best effort */ } }
    else { try { fs.writeFileSync(overrideLog, before, 'utf8'); } catch (e) { /* best effort */ } }
  });

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
  check('MINOR 8(b): the override is appended to wo12/p0-overrides.log', fs.existsSync(overrideLog), overrideLog);
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
  const runClone = path.join(corpus.dir, 'run', 'rl-001');
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
    fs.writeFileSync(path.join(briefs, 'ds-001.wo.txt'), 'wo\n');
    fs.writeFileSync(path.join(briefs, 'ds-001.er.txt'), 'er\n');
    return { dir, briefs, keyPath: writeKey(dir, [{ id: 'ds-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null }]) };
  })();
  const rSeed = runLane(['--lane', 'X-Sol', '--phase', '0', '--dry-run', '--key', seededCorpus.keyPath,
    '--briefs-dir', seededCorpus.briefs, '--source-repo', repo.dir, '--runner', path.join(seededCorpus.dir, 'x.js')]);
  check('NIT: a seeded dry-run prints the build-corpus command that produces the head, not an unusable placeholder',
    /build-corpus\.js.*--id ds-001/.test(rSeed.stdout || '') && !/materialized at run time/.test(rSeed.stdout || ''), rSeed.stdout);
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
    const id = 'st-00' + i;
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
  check('extractServedModel pulls the model id out of the header',
    scoreLib.extractServedModel('REVIEW ENGINE: codex model: gpt-5.6-sol') === 'gpt-5.6-sol');
  check('§2.4\'s lane table is available as the expected-model fallback',
    scoreLib.LANE_EXPECTED_MODEL['X-Terra'] === 'gpt-5.6-terra' && scoreLib.LANE_EXPECTED_MODEL['X-Sol'] === 'gpt-5.6-sol');

  // §3.1 item 5's remedy: re-run once, then EXCLUDE from both lanes.
  const scored = [
    { id: 'x1', lane: 'X-Terra', finalStatus: 'COMPLETED', identity: 'MISMATCHED', attemptCount: 2, servedModel: 'gpt-5.6-sol', expectedModel: 'gpt-5.6-terra' },
    { id: 'x2', lane: 'X-Terra', finalStatus: 'COMPLETED', identity: 'UNKNOWN', attemptCount: 1, servedModel: null, expectedModel: 'gpt-5.6-terra' },
    { id: 'x3', lane: 'X-Terra', finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1, servedModel: 'gpt-5.6-terra', expectedModel: 'gpt-5.6-terra' },
  ];
  const ex = scoreLib.identityExclusions(scored);
  check('MAJOR 1: an artifact still wrong AFTER the re-run is EXCLUDED', ex.excludedIds.join(',') === 'x1', JSON.stringify(ex.excludedIds));
  check('MAJOR 1: an artifact whose re-run has not happened yet is PENDING, not excluded', ex.pendingRerunIds.join(',') === 'x2', JSON.stringify(ex.pendingRerunIds));
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
    { id: 'e-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'CRITICAL', locator: { file: 'quartermaster/quartermaster.js', lines: [100, 110], symbol: 'analyze' }, consequence: '', rationale: '', hazard_terms: [] } },
    { id: 'e-002', kind: 'seeded', phase: 0, variant: 'V2', base: 'b', commit: 'c', subject: 's', seed: { type: 'RC', severity: 'MAJOR', locator: { file: 'router/router.js', lines: [10, 12], symbol: 'route' }, consequence: '', rationale: '', hazard_terms: [] } },
    { id: 'e-003', kind: 'control', phase: 0, variant: 'V3', base: 'b', commit: 'c', subject: 's', seed: null },
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
    rec('e-001', 'X-Terra', hitOut), rec('e-002', 'X-Terra', missOut), rec('e-003', 'X-Terra', missOut),
  ], null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'results-X-Sol-phase0.json'), JSON.stringify([
    rec('e-001', 'X-Sol', hitOut.replace(/terra/g, 'sol')), rec('e-002', 'X-Sol', missOut.replace(/terra/g, 'sol')), rec('e-003', 'X-Sol', missOut.replace(/terra/g, 'sol')),
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
  const artifact = { id: 'v-001', variant: 'V1', subject: 'an ordinary subject', base: 'b' };
  const head = 'a'.repeat(40);
  const bodyNamesVendor = 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + head + '. An executor produced this change.\n\nCLAIMS:\nThe path is no longer weaker than the Codex path.\n\nVerify the diff on its own merits.\n';
  const f1 = [];
  assembleKeyLib.vendorLint('v-001.er.txt', bodyNamesVendor, artifact, head, f1);
  check('MAJOR 5: a V1 report naming a vendor OUTSIDE the author sentence is now caught',
    f1.length === 1 && /"Codex"/.test(f1[0]), JSON.stringify(f1));

  const f2 = [];
  assembleKeyLib.vendorLint('v-001.er.txt',
    'CLAIMS:\nA medium-effort executor at $0.02/1k produced the change.\n', artifact, head, f2);
  check('MAJOR 5: effort AND price terms are now checked (they were unenforced in round 1)',
    f2.length >= 1 && /effort|price/.test(f2.join(' ')), JSON.stringify(f2));

  // V2's author line names the casting ON PURPOSE — that is the 12h factor.
  const v2 = { id: 'v-002', variant: 'V2', subject: 'an ordinary subject', base: 'b' };
  const v2er = assembleKeyLib.renderExecutorReport(v2, head, { order: '', claims: 'We widened the adder and pinned the regression in the suite; the run is green.' }, 'code');
  const f3 = [];
  assembleKeyLib.vendorLint('v-002.er.txt', v2er, v2, head, f3);
  check('the V2 author line is exempt (identity-visible by design), and nothing else in the V2 report is',
    f3.length === 0, JSON.stringify(f3));
  const f4 = [];
  assembleKeyLib.vendorLint('v-002.er.txt', v2er.replace('Verify the diff', 'Codex should verify the diff'), v2, head, f4);
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
  const a = { id: 'h-001', variant: 'V3', subject: 'an ordinary subject', base: 'x'.repeat(40) };
  const head = 'y'.repeat(40);
  const content = { order: Array(80).fill('word').join(' '), claims: Array(40).fill('claim').join(' ') };
  const er = assembleKeyLib.renderExecutorReport(a, head, content, 'code');
  const ok = [];
  assembleKeyLib.hazardLint('h-001.er.txt', er, 'code', 'V3', ok);
  check('a generated V3 report passes the hazard lint', ok.length === 0, JSON.stringify(ok));
  check('the hazard lines are VARIANTS.md v2\'s KIND=code list, verbatim and in order',
    assembleKeyLib.HAZARD_VOCABULARY.code.every((h) => er.indexOf('- ' + h + '\n') !== -1 || er.indexOf('- ' + h) !== -1), er);

  const typeDerived = er.replace(assembleKeyLib.HAZARD_VOCABULARY.code[0], 'check every stated constraint in the order against the diff');
  const bad = [];
  assembleKeyLib.hazardLint('h-001.er.txt', typeDerived, 'code', 'V3', bad);
  check('CRITICAL 4: a TYPE-derived hazard line (the round-1 100%-precision tell) is rejected',
    bad.some((f) => /OUTSIDE VARIANTS\.md v2's closed vocabulary/.test(f)), JSON.stringify(bad));

  const wrongKind = [];
  assembleKeyLib.hazardLint('h-001.er.txt', er, 'docs', 'V3', wrongKind);
  check('a hazard list that is not this artifact\'s KIND list is rejected', wrongKind.length >= 1, JSON.stringify(wrongKind));

  const v1 = { id: 'h-002', variant: 'V1', subject: 's', base: 'x'.repeat(40) };
  const v1er = assembleKeyLib.renderExecutorReport(v1, head, content, 'code');
  const v1f = [];
  assembleKeyLib.hazardLint('h-002.er.txt', v1er, 'code', 'V1', v1f);
  check('a V1 report carries no hazard block and passes', v1f.length === 0 && v1er.indexOf(assembleKeyLib.HAZARD_HEADER) === -1, JSON.stringify(v1f));
  const v1bad = [];
  assembleKeyLib.hazardLint('h-002.er.txt', v1er + '\n' + assembleKeyLib.HAZARD_HEADER + '\n- x\n', 'code', 'V1', v1bad);
  check('a hazard block on a NON-V3 artifact is caught', v1bad.length === 1 && /only V3 may/.test(v1bad[0]), JSON.stringify(v1bad));
}

section('27. assemble-key.js — word bands are enforced on EVERY artifact (VARIANTS.md v2)');
{
  const f1 = [];
  assembleKeyLib.wordBandLint('w-001', { order: Array(90).fill('w').join(' '), claims: Array(50).fill('c').join(' ') }, f1);
  check('an in-band content file passes', f1.length === 0, JSON.stringify(f1));
  const f2 = [];
  assembleKeyLib.wordBandLint('w-002', { order: Array(59).fill('w').join(' '), claims: Array(50).fill('c').join(' ') }, f2);
  check('order at 59 words (one below the floor) fails', f2.length === 1 && /59 words/.test(f2[0]), JSON.stringify(f2));
  const f3 = [];
  assembleKeyLib.wordBandLint('w-003', { order: Array(161).fill('w').join(' '), claims: Array(101).fill('c').join(' ') }, f3);
  check('order at 161 and claims at 101 (one above each ceiling) both fail', f3.length === 2, JSON.stringify(f3));
  const f4 = [];
  assembleKeyLib.wordBandLint('w-004', { order: Array(60).fill('w').join(' '), claims: Array(30).fill('c').join(' ') }, f4);
  check('the floors themselves (60 / 30) are inclusive', f4.length === 0, JSON.stringify(f4));
  const f5 = [];
  assembleKeyLib.wordBandLint('w-005', { order: Array(160).fill('w').join(' '), claims: Array(100).fill('c').join(' ') }, f5);
  check('the ceilings themselves (160 / 100) are inclusive', f5.length === 0, JSON.stringify(f5));
}

section('28. assemble-key.js — seed.json disagreeing with its base-pool slot is a hard failure naming both');
{
  const dir = tmpDir('wo12-seedmismatch-');
  const pool = { slots: [{ id: 'm-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b'.repeat(40), commit: 'c'.repeat(40), subject: 's', seed_slot: { type: 'CV', target_severity: 'MAJOR' } }] };
  fs.writeFileSync(path.join(dir, 'm-001.seed.json'), JSON.stringify({
    id: 'm-001', base: 'b'.repeat(40), commit: 'c'.repeat(40), phase: 0, variant: 'V2',
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
      { id: 'k-001', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: null },
      { id: 'k-002', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: null },
    ],
  };
  fs.writeFileSync(path.join(contentDir, 'k-001.json'), JSON.stringify({ order: 'x', claims: 'y' }), 'utf8');
  const missing = assembleKeyLib.checkRequirements(pool, { corpusDir: dir, briefsDir: path.join(dir, 'briefs'), contentDir });
  check('a missing content file is reported as missing', missing.length === 1 && /k-002.*content\/k-002\.json/.test(missing[0]), JSON.stringify(missing));
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
  fs.writeFileSync(path.join(work, 'ak-001.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(work, 'ak-001.seed.json'), JSON.stringify({
    id: 'ak-001', base: repo.base, commit: repo.commit, phase: 0, variant: 'V1',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');

  const slots = [
    { id: 'ak-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'ak-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
    { id: 'ak-003', kind: 'seeded', phase: 0, variant: 'V3', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'ak-004', kind: 'control', phase: 0, variant: 'V3', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
  ];
  fs.copyFileSync(path.join(work, 'ak-001.patch'), path.join(work, 'ak-003.patch'));
  fs.writeFileSync(path.join(work, 'ak-003.seed.json'), JSON.stringify({
    id: 'ak-003', base: repo.base, commit: repo.commit, phase: 0, variant: 'V3',
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
  const woSeed = fs.readFileSync(path.join(briefsDir, 'ak-001.wo.txt'), 'utf8');
  const woCtl = fs.readFileSync(path.join(briefsDir, 'ak-002.wo.txt'), 'utf8');
  check('CRITICAL 4: a seeded and a control work order have the same line count and shape',
    woSeed.split('\n').length === woCtl.split('\n').length, woSeed.split('\n').length + ' vs ' + woCtl.split('\n').length);
  const erSeedV3 = fs.readFileSync(path.join(briefsDir, 'ak-003.er.txt'), 'utf8');
  const erCtlV3 = fs.readFileSync(path.join(briefsDir, 'ak-004.er.txt'), 'utf8');
  check('CRITICAL 4: a seeded and a control V3 report carry the SAME hazard checklist',
    erSeedV3.slice(erSeedV3.indexOf(assembleKeyLib.HAZARD_HEADER)) === erCtlV3.slice(erCtlV3.indexOf(assembleKeyLib.HAZARD_HEADER)));

  // --check-only on a clean tree.
  const rCheck = spawnSync(process.execPath, [ASSEMBLE_KEY, '--check-only'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('--check-only on a freshly assembled corpus exits 0', rCheck.status === 0, (rCheck.stderr || '') + (rCheck.stdout || ''));
  check('--check-only confirms every brief matches generation', /every brief on disk matches generation exactly/.test(rCheck.stdout || ''), rCheck.stdout);

  // A HAND-EDITED brief is refused: --check-only names it as drift.
  const tamper = path.join(briefsDir, 'ak-001.wo.txt');
  fs.writeFileSync(tamper, fs.readFileSync(tamper, 'utf8') + '\nCONSTRAINT: do not touch the adjacent module.\n', 'utf8');
  const rDrift = spawnSync(process.execPath, [ASSEMBLE_KEY, '--check-only'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('CRITICAL 4: --check-only reports a hand-edited brief as DRIFT that will be overwritten',
    /ak-001\.wo\.txt/.test(rDrift.stdout || '') && /DIFFER from generation/.test(rDrift.stdout || ''), rDrift.stdout);
  const rFix = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('a re-run REGENERATES the hand-edited brief', rFix.status === 0 && !/CONSTRAINT: do not touch/.test(fs.readFileSync(tamper, 'utf8')), fs.readFileSync(tamper, 'utf8'));

  // MAJOR 3: lints run BEFORE key.json is written.
  const keyBefore = fs.readFileSync(path.join(work, 'key.json'), 'utf8');
  fs.writeFileSync(path.join(contentDir, 'ak-002.json'),
    JSON.stringify({ order: goodOrder + ' The Codex path is now stronger.', claims: goodClaims }, null, 2), 'utf8');
  const rLint = spawnSync(process.execPath, [ASSEMBLE_KEY].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('MAJOR 3: a lint failure REFUSES the whole assembly', rLint.status !== 0 && /assembly REFUSED/.test(rLint.stderr || ''), rLint.stderr);
  check('MAJOR 3: the lint failure names the offending vendor term and file', /"Codex"/.test(rLint.stderr || '') && /ak-002/.test(rLint.stderr || ''), rLint.stderr);
  check('MAJOR 3: key.json is UNCHANGED — the lints ran before it was sealed',
    fs.readFileSync(path.join(work, 'key.json'), 'utf8') === keyBefore);
  check('MAJOR 3: no .tmp file is left behind by the refusal', !fs.existsSync(path.join(work, 'key.json.tmp')));

  // A word-band failure is likewise all-or-nothing.
  fs.writeFileSync(path.join(contentDir, 'ak-002.json'), JSON.stringify({ order: 'too short', claims: goodClaims }, null, 2), 'utf8');
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
    { id: 'i-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'i-002', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed_slot: null },
  ];
  fs.writeFileSync(path.join(briefsDir, 'i-001.wo.txt'),
    'REVIEW PACKET — review a completed, already-merged change.\n\nCommit subject:      s\n\nORDER:\n\nDo the bounded thing.\n\nAudit the diff between base and head against that stated intent.\n', 'utf8');
  fs.writeFileSync(path.join(briefsDir, 'i-001.er.txt'),
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'a'.repeat(40) + '. An executor produced this change. It was done and verified.\n', 'utf8');
  // A control content file another agent is writing concurrently.
  const guarded = path.join(contentDir, 'i-002.json');
  fs.writeFileSync(guarded, JSON.stringify({ order: 'CONTROL PROSE FROM ANOTHER AGENT', claims: 'ALSO THEIRS' }), 'utf8');

  const paths = { contentDir, briefsDir, corpusDir: work, importReportPath: path.join(contentDir, 'IMPORT-REPORT.md') };
  const result = assembleKeyLib.importLegacyBriefs({ slots }, paths);
  check('only SEEDED slots are imported', result.written.length === 1 && result.written[0].id === 'i-001', JSON.stringify(result.written));
  check('a control content file written by another agent is untouched',
    JSON.parse(fs.readFileSync(guarded, 'utf8')).order === 'CONTROL PROSE FROM ANOTHER AGENT');
  check('an out-of-band import is written anyway and FLAGGED, never dropped',
    fs.existsSync(path.join(contentDir, 'i-001.json')) && result.flagged.length === 1, JSON.stringify(result.flagged));

  // Re-running must not overwrite what it just wrote.
  fs.writeFileSync(path.join(contentDir, 'i-001.json'), JSON.stringify({ order: 'HAND REVISED', claims: 'HAND REVISED' }), 'utf8');
  const again = assembleKeyLib.importLegacyBriefs({ slots }, paths);
  check('a second import leaves a hand-revised file alone', again.written.length === 0 && again.skippedExisting.indexOf('i-001') !== -1, JSON.stringify(again));
  check('the revised prose survives', JSON.parse(fs.readFileSync(path.join(contentDir, 'i-001.json'), 'utf8')).order === 'HAND REVISED');

  const report = assembleKeyLib.renderImportReport(result, { slots });
  check('the import report names the files needing a pass', /## Needing a human\/agent pass/.test(report) && /i-001/.test(report), report.slice(0, 1200));
}

// ============================ cross-vendor R0 record (openai-2) additions

section('34. build-corpus.js — i18n.commitEncoding cannot move the head sha (openai-2 MAJOR build-corpus.js:196)');
{
  const repo = makeSourceRepo();
  const work = tmpDir('wo12-i18n-');
  const patch = makePatchAgainstBase(repo, (d) => {
    fs.writeFileSync(path.join(d, 'app.js'), 'function add(a, b) {\n  // café naïve résumé\n  return a + b;\n}\n');
  });
  fs.writeFileSync(path.join(work, 'i-001.patch'), patch, 'utf8');
  const keyPath = writeKey(work, [{
    id: 'i-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed: null,
  }]);
  function build(cloneRoot, encoding) {
    const cfg = path.join(work, 'gitconfig-' + encoding.replace(/[^a-z0-9]/gi, ''));
    fs.writeFileSync(cfg, '[i18n]\n\tcommitEncoding = ' + encoding + '\n\tlogOutputEncoding = ' + encoding + '\n', 'utf8');
    return spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'i-001', '--key', keyPath, '--corpus-dir', work,
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
  for (const [id, phase] of [['po-1', 0], ['po-2', 0], ['po-3', 1]]) {
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

  fs.writeFileSync(path.join(dir, 'results-X-Terra-phase0.json'), JSON.stringify([{ id: 'po-1' }], null, 2), 'utf8');
  const rPartial = runLane(args, { WO12_QM_CMD: q(process.execPath) + ' ' + q(green) });
  check('phase 1 refuses when phase 0 is only PARTIALLY recorded, and names what is missing',
    rPartial.status !== 0 && /phase 0 is INCOMPLETE/.test(rPartial.stderr || '') && /po-2/.test(rPartial.stderr || ''), rPartial.stderr);

  fs.writeFileSync(path.join(dir, 'results-X-Terra-phase0.json'), JSON.stringify([{ id: 'po-1' }, { id: 'po-2' }], null, 2), 'utf8');
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

    fs.writeFileSync(path.join(dryDir, 'results-X-Sol-phase0.json'), JSON.stringify([{ id: 'po-1' }], null, 2), 'utf8');
    const rDryPartial = runLane(dryArgs);
    check('a phase-1 --dry-run with a PARTIAL phase-0 file is refused and names what is missing',
      rDryPartial.status === 1 && /phase 0 is INCOMPLETE/.test(rDryPartial.stderr || '') && /po-2/.test(rDryPartial.stderr || ''), rDryPartial.stderr);

    fs.writeFileSync(path.join(dryDir, 'results-X-Sol-phase0.json'), '{not json', 'utf8');
    const rDryCorrupt = runLane(dryArgs);
    check('a phase-1 --dry-run with a CORRUPT phase-0 file is refused rather than ignoring it',
      rDryCorrupt.status === 1 && /does not parse/.test(rDryCorrupt.stderr || ''), rDryCorrupt.stderr);

    fs.writeFileSync(path.join(dryDir, 'results-X-Sol-phase0.json'), JSON.stringify([{ id: 'po-1' }, { id: 'po-2' }], null, 2), 'utf8');
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
        blockerFindings: a.kind === 'control' && controlBlockers.indexOf(a.id) !== -1 ? 1 : 0,
        unavailableFinal: false, integrityWarning: false,
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

  const partial = [{ id: 'ct-1', lane: 'X-Terra', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — x', verdict: 'REAL', second: 'REAL' }];
  const gPartial = scoreLib.gate12f(withBlockers, key, partial, scoreLib.identityExclusions(withBlockers));
  const i3Partial = gPartial.items.find((i) => i.n === 3);
  check('a PARTIAL adjudication (blocker findings left unadjudicated) is INCOMPLETE and names them',
    i3Partial.status === 'INCOMPLETE' && /PARTIALLY ADJUDICATED/.test(i3Partial.detail) && /ct-2/.test(i3Partial.detail),
    i3Partial.status + ' — ' + i3Partial.detail);

  const full = ['ct-1', 'ct-2', 'ct-3'].map((id) => ({ id, lane: 'X-Terra', severity: 'MAJOR', finding: '[MAJOR] a.js:1 — x', verdict: 'REAL', second: 'REAL' }));
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
  const scored = [
    { id: 'p-1', lane: 'X-Terra', kind: 'seeded', hit: false, adjudicatedPromotion: false, order: 0, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1, severity: 'CRITICAL' },
    { id: 'p-2', lane: 'X-Terra', kind: 'seeded', hit: true, adjudicatedPromotion: false, order: 1, finalStatus: 'COMPLETED', identity: 'MATCHED', attemptCount: 1, severity: 'MAJOR' },
  ];
  const adjudication = [
    { id: 'p-1', lane: 'X-Terra', verdict: 'HIT', quote: '[CRITICAL] a.js:1 — the seeded fault, cited by the reviewer in prose' },
    { id: 'p-2', lane: 'X-Terra', verdict: 'MISS', quote: 'not a hit' },
    { id: 'p-1', lane: 'X-Sol', verdict: 'HIT' },
  ];
  const res = scoreLib.applyAdjudicatedPromotions(scored, key, adjudication);
  check('openai-2 MAJOR score.js:318: an adjudicated HIT with a quoted line PROMOTES the mechanical miss',
    scored[0].hit === true && scored[0].adjudicatedPromotion === true && scored[0].matchedVia === 'adjudication', JSON.stringify(scored[0]));
  check('the promotion is reported as its own count', res.promotions.length === 1 && res.promotions[0].id === 'p-1', JSON.stringify(res.promotions));
  check('adjudication NEVER demotes a mechanical hit', scored[1].hit === true && scored[1].adjudicatedPromotion === false);
  check('an adjudicated HIT with NO quoted line is REFUSED, and said so (§2.5 promotes "on a quoted citation")',
    res.rejected.length === 1 && /no quoted line/.test(res.rejected[0].reason), JSON.stringify(res.rejected));
  check('no --adjudication file means no promotions and no rejections',
    JSON.stringify(scoreLib.applyAdjudicatedPromotions(scored, key, null)) === '{"promotions":[],"rejected":[]}');
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
    const id = 'ro-' + String(i).padStart(3, '0');
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
    const id = 'ri-' + i;
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
    mkRec('ri-3', 0, 'COMPLETED'), mkRec('ri-1', 1, 'UNAVAILABLE'), mkRec('ri-2', 2, 'UNAVAILABLE'),
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
    { id: 'kd-1', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: '', rationale: '', hazard_terms: [] } },
    { id: 'kd-2', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 's', seed: null },
  ] };
  const rows = [
    { id: 'kd-1', kind: 'seeded', variant: 'V1', baseKind: 'code', orderWords: 90, claimsWords: 50 },
    { id: 'kd-2', kind: 'control', variant: 'V1', baseKind: 'code', orderWords: 88, claimsWords: 47 },
  ];
  const md = assembleKeyLib.renderConstructionMd(key, assembleKeyLib.computeTallies(key), { 'kd-1': 'h' }, rows,
    { seeds: { 'kd-1': { target_severity: 'MAJOR', achieved_severity: 'MAJOR' } } },
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
    { id: 'cg-001', kind: 'seeded', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: { type: 'CV', target_severity: 'MAJOR' } },
    { id: 'cg-002', kind: 'control', phase: 0, variant: 'V1', base: repo.base, commit: repo.commit, subject: REAL_SUBJECT, seed_slot: null },
  ];
  fs.writeFileSync(path.join(work, 'cg-001.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(work, 'cg-001.seed.json'), JSON.stringify({
    id: 'cg-001', base: repo.base, commit: repo.commit, phase: 0, variant: 'V1',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: ['a'] },
  }), 'utf8');
  // The round-1 briefs the importer mines for the SEEDED slot.
  fs.writeFileSync(path.join(briefsDir, 'cg-001.wo.txt'),
    'REVIEW PACKET — review a completed, already-merged change.\n\nCommit subject:      ' + REAL_SUBJECT +
    '\n\nORDER:\n\n' + Array(90).fill('word').join(' ') + '\n\nAudit the diff between base and head against that stated intent.\n', 'utf8');
  fs.writeFileSync(path.join(briefsDir, 'cg-001.er.txt'),
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'a'.repeat(40) + '. An executor produced this change. ' +
    'We ' + Array(44).fill('verified').join(' ') + '.\n', 'utf8');
  const poolPath = path.join(work, 'base-pool.json');
  fs.writeFileSync(poolPath, JSON.stringify({ slots }, null, 2), 'utf8');

  // A CONTROL content file, written by "another agent", with distinctive bytes
  // (trailing whitespace, CRLF, no trailing newline) so any rewrite shows up.
  const controlFile = path.join(contentDir, 'cg-002.json');
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
    /left 1 existing content file\(s\) untouched, byte-for-byte \(cg-002\.json\)/.test(rImport.stdout || ''), rImport.stdout);
  check('the seeded content file WAS created', fs.existsSync(path.join(contentDir, 'cg-001.json')));

  // (b) a second import must not rewrite the seeded file it just created.
  const seededBytes = fs.readFileSync(path.join(contentDir, 'cg-001.json'));
  const rImport2 = spawnSync(process.execPath, [ASSEMBLE_KEY, '--import-legacy-briefs'].concat(cliArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  check('a second import exits 0 and writes nothing', rImport2.status === 0 && /wrote 0 content file\(s\)/.test(rImport2.stdout || ''), rImport2.stdout);
  check('INCIDENT GUARD: the seeded content file is unchanged by a second import', fs.readFileSync(path.join(contentDir, 'cg-001.json')).equals(seededBytes));
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
  check('INCIDENT GUARD: the seeded content file survives a full assembly byte-for-byte', fs.readFileSync(path.join(contentDir, 'cg-001.json')).equals(seededBytes));
  check('a full assembly writes only briefs/key/notes/CONSTRUCTION.md — content/ gains nothing',
    fs.readdirSync(contentDir).sort().join(',') === 'IMPORT-REPORT.md,cg-001.json,cg-002.json', fs.readdirSync(contentDir).sort().join(','));

  // (e) the unit guards themselves.
  let threwControl = null;
  try { assembleKeyLib.guardedWriteContentFile(contentDir, { id: 'cg-002', kind: 'control' }, { order: 'x', claims: 'y' }); } catch (e) { threwControl = e; }
  check('guardedWriteContentFile REFUSES a control slot outright',
    !!threwControl && /only SEEDED slots may be imported/.test(threwControl.message), threwControl && threwControl.message);
  check('…and the control file is untouched by the attempt', controlDigest().equals(CONTROL_BYTES));

  let threwExisting = null;
  try { assembleKeyLib.guardedWriteContentFile(contentDir, { id: 'cg-001', kind: 'seeded' }, { order: 'x', claims: 'y' }); } catch (e) { threwExisting = e; }
  check('guardedWriteContentFile REFUSES to overwrite an existing seeded file (O_EXCL, not check-then-write)',
    !!threwExisting && /refusing to overwrite the existing/.test(threwExisting.message), threwExisting && threwExisting.message);
  check('…and that file is untouched by the attempt', fs.readFileSync(path.join(contentDir, 'cg-001.json')).equals(seededBytes));

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

// ---------------------------------------------------------------- summary

console.log('\n' + (failures === 0 ? 'OK' : 'FAILED') + ' — ' + passes + ' passed, ' + failures + ' failed');
finish();
