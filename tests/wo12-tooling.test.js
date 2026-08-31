#!/usr/bin/env node
/**
 * WO-12 tooling tests — build-corpus.js, run-lane.js, score.js
 * (`plans/cross-compare/agent-role-architecture/wo12/`).
 *
 *   node tests/wo12-tooling.test.js
 *
 * No dependencies, no test framework, no real codex/engine invocation
 * anywhere in this file — run-lane.js is only ever exercised with a
 * placeholder --runner path (never invoked; the refusal/dry-run cases under
 * test never reach the point of spawning it) and a stubbed quartermaster
 * command (WO12_QM_CMD), same pattern as tests/review-lane.test.js's
 * stub-codex.js.
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

function tmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

// A minimal source repo this suite fully controls, standing in for "THIS
// repository" that build-corpus.js clones from.
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
  return { dir, base };
}

// Produces a unified diff (base -> mutated working tree), then restores the
// working tree so the source repo is left clean.
function makePatch(repoDir, mutate) {
  mutate(repoDir);
  const diff = spawnSync('git', ['-C', repoDir, 'diff'], { encoding: 'utf8' }).stdout;
  spawnSync('git', ['-C', repoDir, 'checkout', '--', '.'], { encoding: 'utf8' });
  return diff;
}

function writeKey(dir, artifacts) {
  fs.writeFileSync(path.join(dir, 'key.json'), JSON.stringify({ version: 1, artifacts }, null, 2), 'utf8');
  return path.join(dir, 'key.json');
}

// Quote-wraps a path for a whitespace-split command string (WO12_QM_CMD),
// since process.execPath can itself contain spaces (a Program Files install).
function q(p) { return '"' + p + '"'; }

function writeStub(dir, name, body) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, body, 'utf8');
  return p;
}

// ================================================================ build-corpus

section('1. build-corpus.js — reproducibility (same head sha, two separate process invocations)');
{
  const src = makeSourceRepo();
  const patch = makePatch(src.dir, (dir) => {
    fs.writeFileSync(path.join(dir, 'app.js'), 'function add(a, b) {\n  return a + b; // seeded defect\n}\n');
  });
  check('patch is non-empty', patch.trim().length > 0, patch);

  const corpusDir = tmpDir('wo12-corpus-');
  fs.writeFileSync(path.join(corpusDir, 'sdc-repro-001.patch'), patch, 'utf8');
  // The key's `subject` is DELIBERATELY DIFFERENT from the base commit's own
  // real subject ("base commit for wo12 test") — this is what proves
  // build-corpus.js reads the variant's commit message from key.json's
  // `subject` field (the real commit C's subject) and NEVER from `git log`
  // on the base P, per the Director's correction.
  const KEY_SUBJECT = 'SEEDED: sdc-repro-001 — add() drops the second argument under load';
  const keyPath = writeKey(corpusDir, [{
    id: 'sdc-repro-001', kind: 'seeded', phase: 0, variant: 'V1',
    base: src.base, commit: src.base, subject: KEY_SUBJECT,
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: [] },
  }]);

  const clone1 = path.join(tmpDir('wo12-clone1-'), 'clone');
  const clone2 = path.join(tmpDir('wo12-clone2-'), 'clone');

  const r1 = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'sdc-repro-001', '--key', keyPath, '--source-repo', src.dir, '--clone-root', clone1], { encoding: 'utf8' });
  const r2 = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'sdc-repro-001', '--key', keyPath, '--source-repo', src.dir, '--clone-root', clone2], { encoding: 'utf8' });

  check('first invocation exits 0', r1.status === 0, r1.stderr);
  check('second invocation exits 0', r2.status === 0, r2.stderr);

  let out1 = null, out2 = null;
  try { out1 = JSON.parse((r1.stdout || '').trim()); } catch (e) { /* leave null */ }
  try { out2 = JSON.parse((r2.stdout || '').trim()); } catch (e) { /* leave null */ }
  check('first invocation prints parseable JSON', !!out1, r1.stdout);
  check('second invocation prints parseable JSON', !!out2, r2.stdout);

  if (out1 && out2) {
    check('both invocations report the same base', out1.base === src.base && out2.base === src.base);
    check('the variant head sha is REPRODUCIBLE across two independent clones', out1.head === out2.head, 'clone1 head=' + out1.head + ' clone2 head=' + out2.head);
    check('the variant head differs from the base (a real commit was made)', out1.head !== out1.base);
    check('cloneDir is reported and different between the two runs (two separate clones)', out1.cloneDir !== out2.cloneDir);

    const author = git(['show', '-s', '--format=%an <%ae>', out1.head], clone1);
    const msg = git(['show', '-s', '--format=%s', out1.head], clone1);
    check('committed author is the fixed WO-12 seeder identity', author === buildCorpusLib.SEEDER_NAME + ' <' + buildCorpusLib.SEEDER_EMAIL + '>', author);
    check('commit message equals key.json\'s `subject` field (the REAL commit C\'s subject, not the base P\'s)', msg === KEY_SUBJECT, msg);
    check('commit message is NOT the base commit\'s own subject', msg !== 'base commit for wo12 test', msg);
  }
}

section('2. build-corpus.js — fail-closed on a patch that will not apply');
{
  const src = makeSourceRepo();
  const corpusDir = tmpDir('wo12-corpus-badpatch-');
  fs.writeFileSync(path.join(corpusDir, 'sdc-bad-001.patch'), 'this is not a valid unified diff at all\n', 'utf8');
  const keyPath = writeKey(corpusDir, [{
    id: 'sdc-bad-001', kind: 'seeded', phase: 0, variant: 'V1', base: src.base, commit: src.base, subject: 'x',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 1], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: [] },
  }]);
  const clone = path.join(tmpDir('wo12-clone-bad-'), 'clone');
  const r = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'sdc-bad-001', '--key', keyPath, '--source-repo', src.dir, '--clone-root', clone], { encoding: 'utf8' });
  check('exits non-zero on an unapplyable patch', r.status !== 0, 'status=' + r.status);
  check('error names the failure as a patch-apply problem', /patch failed to apply/i.test(r.stderr || ''), r.stderr);
}

section('3. build-corpus.js — fail-closed on an empty patch file (git itself refuses it; belt-and-suspenders with the empty-staged-diff guard)');
{
  // An empty patch file is what a construction bug (e.g. `git diff` run
  // against an already-identical tree) actually produces. `git apply
  // --index` refuses it outright ("No valid patches in input") before this
  // script's own "staged diff is EMPTY" guard (materializeArtifact(), the
  // check right after `git apply --index` succeeds) would even run — the two
  // checks are complementary fail-closed layers, not alternatives, so either
  // error text is an acceptable, correctly-refused outcome here.
  const src = makeSourceRepo();
  const corpusDir = tmpDir('wo12-corpus-empty-');
  fs.writeFileSync(path.join(corpusDir, 'sdc-empty-001.patch'), '', 'utf8');
  const artifact = {
    id: 'sdc-empty-001', kind: 'seeded', phase: 0, variant: 'V1', base: src.base, commit: src.base, subject: 'x',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 1], symbol: 'add' }, consequence: 'x', rationale: 'y', hazard_terms: [] },
  };
  const cloneDir = path.join(tmpDir('wo12-clone-empty-'), 'clone');
  buildCorpusLib.ensureClone(src.dir, cloneDir);
  let threw = null;
  try { buildCorpusLib.materializeArtifact(artifact, cloneDir, corpusDir); }
  catch (e) { threw = e; }
  check('materializeArtifact throws on an empty patch file', !!threw, threw && threw.message);
  check(
    'error is a recognizable fail-closed refusal (git\'s own "no valid patches", or this script\'s own "EMPTY staged diff" guard)',
    threw && (/No valid patches|patch failed to apply|EMPTY staged diff/i.test(threw.message)),
    threw && threw.message
  );
}

section('4. build-corpus.js — control artifacts are the real commit, unmodified');
{
  const src = makeSourceRepo();
  // A second commit to serve as the control's real head.
  fs.writeFileSync(path.join(src.dir, 'notes.md'), '# notes\n', 'utf8');
  git(['add', '-A'], src.dir);
  git(['commit', '-q', '-m', 'add notes'], src.dir);
  const head = git(['rev-parse', 'HEAD'], src.dir);

  const corpusDir = tmpDir('wo12-corpus-control-');
  const keyPath = writeKey(corpusDir, [{ id: 'ctl-001', kind: 'control', phase: 0, variant: 'V1', base: src.base, commit: head, subject: 'add notes', seed: null }]);
  const cloneDir = path.join(tmpDir('wo12-clone-control-'), 'clone');
  const r = spawnSync(process.execPath, [BUILD_CORPUS, '--id', 'ctl-001', '--key', keyPath, '--source-repo', src.dir, '--clone-root', cloneDir], { encoding: 'utf8' });
  check('control materialization exits 0', r.status === 0, r.stderr);
  let out = null;
  try { out = JSON.parse((r.stdout || '').trim()); } catch (e) { /* leave null */ }
  check('control head is exactly the real commit sha (no re-commit)', !!out && out.head === head, JSON.stringify(out));
}

// ================================================================ run-lane

const QM_HEALTHY = `#!/usr/bin/env node
'use strict';
console.log(JSON.stringify({
  'AU-all': { state: { remainingFraction: 0.9 }, belowReserve: false },
  'AU-opus': { state: { remainingFraction: 0.9 }, belowReserve: false },
  'AU-fable': { state: { remainingFraction: 0.9 }, belowReserve: false },
  'OU': { state: { remainingFraction: 0.9 }, belowReserve: false }
}));
process.exit(0);
`;

const QM_REFUSED = `#!/usr/bin/env node
'use strict';
process.stderr.write('quartermaster: bucket state FAILS CLOSED (1 of 4 bucket(s) have no usable evidence):\\n\\n' +
  'REFUSED for OU: latest reading is 2.1d old (line 3, 2026-08-27T00:00:00.000Z), past the 24.0h freshness window. ' +
  'Record a fresh one:\\n  node quartermaster/quartermaster.js --record OU <fraction 0..1> --source "<where you read it>"\\n');
process.exit(1);
`;

function runLaneKey(dir) {
  return writeKey(dir, [{ id: 'rl-001', kind: 'control', phase: 0, variant: 'V1', base: 'deadbeef', commit: 'deadbeef', subject: 'x', seed: null }]);
}

section('5. run-lane.js — refuses without --yes (even when Quartermaster is healthy)');
{
  const corpusDir = tmpDir('wo12-rl-1-');
  const keyPath = runLaneKey(corpusDir);
  const stubDir = tmpDir('wo12-rl-stub-1-');
  const qmStub = writeStub(stubDir, 'qm-healthy.js', QM_HEALTHY);
  const r = spawnSync(process.execPath, [RUN_LANE, '--lane', 'X-Sol', '--phase', '0', '--key', keyPath, '--runner', path.join(stubDir, 'fake-runner.js')], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { WO12_QM_CMD: q(process.execPath) + ' ' + q(qmStub) }),
  });
  check('exits non-zero without --yes', r.status !== 0, 'status=' + r.status);
  check('refusal explains real allowance is billed', /bill real OpenAI allowance/i.test(r.stderr || ''), r.stderr);
  check('the healthy Quartermaster output was still printed verbatim (informational either way)', /"OU"/.test(r.stdout || ''), r.stdout);
}

section('6. run-lane.js — refuses when Quartermaster reports OU fail-closed/REFUSED, even with --yes');
{
  const corpusDir = tmpDir('wo12-rl-2-');
  const keyPath = runLaneKey(corpusDir);
  const stubDir = tmpDir('wo12-rl-stub-2-');
  const qmStub = writeStub(stubDir, 'qm-refused.js', QM_REFUSED);
  const r = spawnSync(process.execPath, [RUN_LANE, '--lane', 'X-Terra', '--phase', '0', '--key', keyPath, '--runner', path.join(stubDir, 'fake-runner.js'), '--yes'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { WO12_QM_CMD: q(process.execPath) + ' ' + q(qmStub) }),
  });
  check('exits non-zero on an OU-REFUSED Quartermaster state', r.status !== 0, 'status=' + r.status);
  check('the REFUSED quartermaster output was printed verbatim', /REFUSED for OU/.test(r.stdout || ''), r.stdout);
  check('the refusal names the P0/OU gate', /Quartermaster/i.test(r.stderr || '') && /OU/.test(r.stderr || ''), r.stderr);
}

section('7. run-lane.js — --override-p0 proceeds past an OU-REFUSED Quartermaster state (but --yes is still required)');
{
  const corpusDir = tmpDir('wo12-rl-3-');
  const keyPath = runLaneKey(corpusDir);
  const stubDir = tmpDir('wo12-rl-stub-3-');
  const qmStub = writeStub(stubDir, 'qm-refused.js', QM_REFUSED);
  // --override-p0 without --yes: must still refuse on the --yes gate, never
  // on the P0 gate — proving override bypasses ONLY the P0 refusal.
  const r = spawnSync(process.execPath, [RUN_LANE, '--lane', 'X-Terra', '--phase', '0', '--key', keyPath, '--runner', path.join(stubDir, 'fake-runner.js'), '--override-p0', 'owner-authorized test'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { WO12_QM_CMD: q(process.execPath) + ' ' + q(qmStub) }),
  });
  check('still refuses (on --yes, not on P0) with --override-p0 but no --yes', r.status !== 0 && /bill real OpenAI allowance/i.test(r.stderr || ''), r.stderr);
}

section('8. run-lane.js — --dry-run prints the exact commands with the right per-lane env, touches nothing');
{
  const corpusDir = tmpDir('wo12-rl-4-');
  const keyPath = writeKey(corpusDir, [
    { id: 'rl-sol-001', kind: 'control', phase: 0, variant: 'V1', base: 'deadbeef', commit: 'deadbeef', subject: 'x', seed: null },
  ]);
  const rSol = spawnSync(process.execPath, [RUN_LANE, '--lane', 'X-Sol', '--phase', '0', '--key', keyPath, '--dry-run', '--runner', 'Z:/does/not/exist/orchestra-review.js'], { encoding: 'utf8' });
  check('X-Sol dry-run exits 0', rSol.status === 0, rSol.stderr);
  check('X-Sol dry-run names the right model', /ORCHESTRA_REVIEW_MODEL=gpt-5\.6-sol\b/.test(rSol.stdout || ''), rSol.stdout);
  check('X-Sol dry-run names the right effort args', /model_reasoning_effort=high/.test(rSol.stdout || ''), rSol.stdout);
  check('X-Sol dry-run never invokes the Quartermaster gate (no --state output block)', !/quartermaster --state/i.test(rSol.stdout || ''), rSol.stdout);

  const rTerra = spawnSync(process.execPath, [RUN_LANE, '--lane', 'X-Terra', '--phase', '0', '--key', keyPath, '--dry-run', '--runner', 'Z:/does/not/exist/orchestra-review.js'], { encoding: 'utf8' });
  check('X-Terra dry-run exits 0', rTerra.status === 0, rTerra.stderr);
  check('X-Terra dry-run names the right model', /ORCHESTRA_REVIEW_MODEL=gpt-5\.6-terra\b/.test(rTerra.stdout || ''), rTerra.stdout);
  check('X-Terra dry-run names the right effort args', /model_reasoning_effort=medium/.test(rTerra.stdout || ''), rTerra.stdout);
}

section('9. run-lane.js — refuses cleanly on an empty phase selection');
{
  const corpusDir = tmpDir('wo12-rl-5-');
  const keyPath = writeKey(corpusDir, [{ id: 'rl-other-phase', kind: 'control', phase: 1, variant: 'V1', base: 'deadbeef', commit: 'deadbeef', subject: 'x', seed: null }]);
  const r = spawnSync(process.execPath, [RUN_LANE, '--lane', 'X-Sol', '--phase', '0', '--key', keyPath, '--dry-run'], { encoding: 'utf8' });
  check('exits non-zero when no artifact matches the requested phase', r.status !== 0, 'status=' + r.status);
}

// ================================================================ score.js

section('10. score.js — hit logic: file+line (exact and ±3 tolerance boundary)');
{
  const seed = { locator: { file: 'src/foo.js', lines: [100, 110], symbol: 'doThing' } };
  const hitExact = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/foo.js:105 — a defect — scenario']);
  check('exact in-range line citation is a hit', hitExact.hit === true, JSON.stringify(hitExact));
  check('hit is attributed to the line match', hitExact.via === 'line', hitExact.via);

  const hitAtTolBoundary = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/foo.js:113 — a defect — scenario']); // 110 + 3
  check('a citation exactly at the +3 tolerance boundary (110+3=113) is a hit', hitAtTolBoundary.hit === true, JSON.stringify(hitAtTolBoundary));

  const missPastTol = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/foo.js:114 — a defect — scenario']); // 110 + 4
  check('a citation one past the +3 tolerance boundary (110+4=114) is a miss', missPastTol.hit === false, JSON.stringify(missPastTol));

  const belowTolBoundary = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/foo.js:97 — a defect — scenario']); // 100 - 3
  check('a citation exactly at the -3 tolerance boundary (100-3=97) is a hit', belowTolBoundary.hit === true, JSON.stringify(belowTolBoundary));
}

section('11. score.js — hit logic: file+symbol (no line overlap, symbol named elsewhere in the block)');
{
  const seed = { locator: { file: 'src/foo.js', lines: [100, 110], symbol: 'doThing' } };
  const hitSymbol = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/foo.js:900 — doThing() silently drops the second argument — given (1,2) it returns 1']);
  check('a far-off line citation still hits via symbol name', hitSymbol.hit === true && hitSymbol.via === 'symbol', JSON.stringify(hitSymbol));

  const symbolWithoutFile = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] doThing() is wrong — no file cited at all']);
  check('symbol named but NO file citation at all is a MISS (file citation is mandatory)', symbolWithoutFile.hit === false, JSON.stringify(symbolWithoutFile));
}

section('12. score.js — hit logic: wrong file is a miss, "none" findings produce no blocks');
{
  const seed = { locator: { file: 'src/foo.js', lines: [100, 110], symbol: 'doThing' } };
  const wrongFile = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/bar.js:105 — unrelated defect — scenario']);
  check('a citation to a different file is a miss', wrongFile.hit === false, JSON.stringify(wrongFile));

  const blocks = scoreLib.splitFindingBlocks('- none');
  check('"- none" produces zero finding blocks', blocks.length === 0, JSON.stringify(blocks));
}

section('13. score.js — liberal citation parsing (backticked path, "lines N-M" phrasing)');
{
  const cited = scoreLib.parseCitations('the bug is in `src/foo.js`, specifically lines 104-106 of the loop');
  const hasFooRange = cited.some((c) => c.file === 'src/foo.js' && c.lineStart === 104 && c.lineEnd === 106);
  check('backticked path + "lines N-M" phrasing is parsed as a citation', hasFooRange, JSON.stringify(cited));
}

section('14. score.js — Wilson 95% interval: standard-formula anchors (own known-good values vs protocol §1 anchors)');
{
  // Hand-derived from the standard Wilson formula (z = 1.959963984540054),
  // independent of this test file calling the SAME implementation twice —
  // these are the numbers the formula is supposed to produce, computed by
  // hand for this suite.
  const cases = [
    { hits: 19, n: 20, expectLo: 0.7639, expectHi: 0.9912, protocolAnchor: '76-99' },
    { hits: 12, n: 12, expectLo: 0.7575, expectHi: 1.0000, protocolAnchor: '76-100' },
    { hits: 6, n: 8, expectLo: 0.4093, expectHi: 0.9285, protocolAnchor: '41-92' },
  ];
  for (const c of cases) {
    const w = scoreLib.wilson(c.hits, c.n);
    const loOk = Math.abs(w.lo - c.expectLo) < 0.001;
    const hiOk = Math.abs(w.hi - c.expectHi) < 0.001;
    check(
      c.hits + '/' + c.n + ' Wilson lower bound matches hand-derived value (' + c.expectLo.toFixed(4) + ')',
      loOk, 'got ' + w.lo.toFixed(4)
    );
    check(
      c.hits + '/' + c.n + ' Wilson upper bound matches hand-derived value (' + c.expectHi.toFixed(4) + ')',
      hiOk, 'got ' + w.hi.toFixed(4)
    );
    console.log(
      '        [report] ' + c.hits + '/' + c.n + ': computed [' + (w.lo * 100).toFixed(1) + ', ' + (w.hi * 100).toFixed(1) +
      ']  vs  protocol §1 anchor [' + c.protocolAnchor + ']'
    );
  }
}

section('15. score.js — 12d seed-level union table (synthetic X-only / S-only / both / neither)');
{
  const key = {
    version: 1,
    artifacts: [
      { id: 's-both', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 'x', seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'a.js', lines: [10, 20], symbol: 'foo' }, consequence: 'x', rationale: 'y', hazard_terms: [] } },
      { id: 's-x-only', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 'x', seed: { type: 'OO', severity: 'MAJOR', locator: { file: 'b.js', lines: [10, 20], symbol: 'bar' }, consequence: 'x', rationale: 'y', hazard_terms: [] } },
      { id: 's-s-only', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 'x', seed: { type: 'LC', severity: 'MAJOR', locator: { file: 'c.js', lines: [10, 20], symbol: 'baz' }, consequence: 'x', rationale: 'y', hazard_terms: [] } },
      { id: 's-neither', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 'x', seed: { type: 'FT', severity: 'MAJOR', locator: { file: 'd.js', lines: [10, 20], symbol: 'qux' }, consequence: 'x', rationale: 'y', hazard_terms: [] } },
    ],
  };

  function findingText(hitLine) {
    return [
      'REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol)', '', 'VERDICT: REVISE', '', 'FINDINGS',
      hitLine ? '- ' + hitLine : '- none', '', 'CLAIMS CHECKED', '- none', '', 'NITS', '- none', '',
    ].join('\n');
  }
  function rec(id, lane, hitLine) {
    return { id, base: 'b', head: 'c', lane, phase: 0, variant: 'V1', attempts: [{ wallMs: 1, verdict: 'REVISE', status: 'COMPLETED', engineHeader: 'model: x', integrityWarning: false, stdout: findingText(hitLine) }] };
  }

  const records = [
    rec('s-both', 'X-Sol', '[MAJOR] [BREACH] a.js:15 — bug — scenario'),
    rec('s-both', 'S-Sonnet', '[MAJOR] [BREACH] a.js:15 — bug — scenario'),
    rec('s-x-only', 'X-Sol', '[MAJOR] [BREACH] b.js:15 — bug — scenario'),
    rec('s-x-only', 'S-Sonnet', null),
    rec('s-s-only', 'X-Sol', null),
    rec('s-s-only', 'S-Sonnet', '[MAJOR] [BREACH] c.js:15 — bug — scenario'),
    rec('s-neither', 'X-Sol', null),
    rec('s-neither', 'S-Sonnet', null),
  ];

  const { scored } = scoreLib.scoreRecords(records, key);
  const d = scoreLib.gate12d(scored, key);
  const byId = Object.fromEntries(d.union.map((u) => [u.id, u.category]));

  check('s-both is categorized "both"', byId['s-both'] === 'both', JSON.stringify(byId));
  check('s-x-only is categorized "X-only"', byId['s-x-only'] === 'X-only', JSON.stringify(byId));
  check('s-s-only is categorized "S-only"', byId['s-s-only'] === 'S-only', JSON.stringify(byId));
  check('s-neither is categorized "neither"', byId['s-neither'] === 'neither', JSON.stringify(byId));
  check('construction-suspect list contains exactly s-neither', d.suspects.length === 1 && d.suspects[0] === 's-neither', JSON.stringify(d.suspects));
  check('cross-family union recall is 2/4 (s-both + s-x-only)', d.xUnionRecall.hits === 2 && d.xUnionRecall.n === 4, JSON.stringify(d.xUnionRecall));
  check('same-family union recall is 2/4 (s-both + s-s-only)', d.sUnionRecall.hits === 2 && d.sUnionRecall.n === 4, JSON.stringify(d.sUnionRecall));
  check('gain for X-family is 0 (2 - 2) — a null result at this n', d.gainForX === 0, d.gainForX);
}

section('16. score.js — end-to-end CLI run over the 12d synthetic corpus (report + score-output.json)');
{
  const corpusDir = tmpDir('wo12-score-e2e-');
  const keyPath = writeKey(corpusDir, [
    { id: 'e2e-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 'x', seed: { type: 'CV', severity: 'CRITICAL', locator: { file: 'a.js', lines: [1, 5], symbol: 'foo' }, consequence: 'x', rationale: 'y', hazard_terms: [] } },
    { id: 'e2e-ctl-001', kind: 'control', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 'x', seed: null },
  ]);
  const resultsDir = corpusDir;
  const findingsHit = ['REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol)', '', 'VERDICT: REVISE', '', 'FINDINGS',
    '- [CRITICAL] [BREACH] a.js:3 — bug — scenario', '', 'CLAIMS CHECKED', '- none', '', 'NITS', '- none', ''].join('\n');
  fs.writeFileSync(path.join(resultsDir, 'results-X-Sol-phase0.json'), JSON.stringify([
    { id: 'e2e-001', base: 'b', head: 'c', lane: 'X-Sol', phase: 0, variant: 'V1', attempts: [{ wallMs: 1, verdict: 'REVISE', status: 'COMPLETED', engineHeader: 'model: gpt-5.6-sol', integrityWarning: false, stdout: findingsHit }] },
    { id: 'e2e-ctl-001', base: 'b', head: 'c', lane: 'X-Sol', phase: 0, variant: 'V1', attempts: [{ wallMs: 1, verdict: 'APPROVE', status: 'COMPLETED', engineHeader: 'model: gpt-5.6-sol', integrityWarning: false, stdout: 'VERDICT: APPROVE\n\nFINDINGS\n- none\n' }] },
  ], null, 2), 'utf8');

  const outPath = path.join(corpusDir, 'score-output.json');
  const r = spawnSync(process.execPath, [SCORE, '--key', keyPath, '--results-dir', resultsDir, '--out', outPath], { encoding: 'utf8' });
  check('score.js CLI always exits 0 (a scorer, not a gate)', r.status === 0, 'status=' + r.status + '\n' + r.stderr);
  check('markdown report is printed to stdout', /# WO-12 SDC score report/.test(r.stdout || ''), r.stdout);
  check('12f gate table is present and INCOMPLETE on a 2-artifact corpus', /12f/.test(r.stdout) && /INCOMPLETE/.test(r.stdout), r.stdout);
  check('score-output.json was written', fs.existsSync(outPath));
  if (fs.existsSync(outPath)) {
    const j = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    check('score-output.json records the X-Sol lane', j.lanes.includes('X-Sol'), JSON.stringify(j.lanes));
    check('score-output.json records the CRITICAL seed as hit', j.recallByLane['X-Sol'].hits === 1, JSON.stringify(j.recallByLane));
    check('score-output.json carries a pathMatchByLane entry for X-Sol (exact-path hit)', j.pathMatchByLane && j.pathMatchByLane['X-Sol'] && j.pathMatchByLane['X-Sol'].exactPath === 1, JSON.stringify(j.pathMatchByLane));
  }
  check('markdown report carries the path-match tier section', /Path-match tier of hits/.test(r.stdout || ''), r.stdout);
}

section('17. score.js — basename-only path-match tier is counted and labeled, and excluded under --strict-paths');
{
  const seed = { locator: { file: 'src/deep/nested/foo.js', lines: [100, 110], symbol: 'doThing' } };

  const exactHit = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/deep/nested/foo.js:105 — a defect — scenario']);
  check('a full-path citation hits with pathMatchKind "exact-path"', exactHit.hit === true && exactHit.pathMatchKind === 'exact-path', JSON.stringify(exactHit));

  const basenameHit = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] foo.js:105 — a defect — scenario']);
  check('a bare-filename citation is COUNTED as a hit by default (liberal fallback)', basenameHit.hit === true, JSON.stringify(basenameHit));
  check('the bare-filename hit is LABELED pathMatchKind "basename-only"', basenameHit.pathMatchKind === 'basename-only', JSON.stringify(basenameHit));

  const basenameUnderStrict = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] foo.js:105 — a defect — scenario'], { strictPaths: true });
  check('the SAME bare-filename citation is EXCLUDED (a miss) under --strict-paths', basenameUnderStrict.hit === false, JSON.stringify(basenameUnderStrict));

  const exactUnderStrict = scoreLib.evaluateSeedHit(seed, ['[MAJOR] [BREACH] src/deep/nested/foo.js:105 — a defect — scenario'], { strictPaths: true });
  check('an exact-path citation is UNAFFECTED by --strict-paths', exactUnderStrict.hit === true && exactUnderStrict.pathMatchKind === 'exact-path', JSON.stringify(exactUnderStrict));

  check('classifyFileMatch itself returns the two named tiers, or null', scoreLib.classifyFileMatch('foo.js', 'src/deep/nested/foo.js') === 'basename-only' &&
    scoreLib.classifyFileMatch('src/deep/nested/foo.js', 'src/deep/nested/foo.js') === 'exact-path' &&
    scoreLib.classifyFileMatch('bar.js', 'src/deep/nested/foo.js') === null);

  // scoreRecords()-level: strictPaths threaded through from CLI opts turns a
  // would-be basename-only hit into a scored miss.
  const key = { version: 1, artifacts: [{ id: 'bn-001', kind: 'seeded', phase: 0, variant: 'V1', base: 'b', commit: 'c', subject: 'x', seed: { type: 'CV', severity: 'MAJOR', locator: seed.locator, consequence: 'x', rationale: 'y', hazard_terms: [] } }] };
  const stdout = ['VERDICT: REVISE', '', 'FINDINGS', '- [MAJOR] [BREACH] foo.js:105 — a defect — scenario', '', 'CLAIMS CHECKED', '- none', '', 'NITS', '- none', ''].join('\n');
  const records = [{ id: 'bn-001', base: 'b', head: 'c', lane: 'X-Sol', phase: 0, variant: 'V1', attempts: [{ wallMs: 1, verdict: 'REVISE', status: 'COMPLETED', engineHeader: 'model: x', integrityWarning: false, stdout }] }];
  const loose = scoreLib.scoreRecords(records, key, { strictPaths: false }).scored[0];
  const strict = scoreLib.scoreRecords(records, key, { strictPaths: true }).scored[0];
  check('scoreRecords() without --strict-paths scores the basename-only citation as a hit', loose.hit === true && loose.pathMatchKind === 'basename-only', JSON.stringify(loose));
  check('scoreRecords() WITH strictPaths:true scores the same citation as a miss', strict.hit === false, JSON.stringify(strict));
}

// ================================================================ assemble-key

section('18. assemble-key.js — seed.json disagreeing with its base-pool slot is a hard failure naming both');
{
  const corpusDir = tmpDir('wo12-ak-mismatch-');
  fs.writeFileSync(path.join(corpusDir, 'sdc-901.seed.json'), JSON.stringify({
    id: 'sdc-901', kind: 'seeded', phase: 0, variant: 'V1',
    base: 'a'.repeat(40), commit: 'b'.repeat(40), subject: 'x',
    seed: { type: 'OO', severity: 'MAJOR', locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: 'x', rationale: 'y', hazard_terms: [] },
  }, null, 2), 'utf8');
  const pool = {
    slots: [{
      id: 'sdc-901', kind: 'seeded', phase: 0, variant: 'V1',
      base: 'a'.repeat(40), commit: 'b'.repeat(40), subject: 'x',
      seed_slot: { type: 'CV', target_severity: 'MAJOR' }, // CV in the pool, OO in seed.json — deliberate mismatch
    }],
  };
  let threw = null;
  try { assembleKeyLib.buildKeyAndNotes(pool, { corpusDir }); } catch (e) { threw = e; }
  check('a type mismatch between seed.json and the base-pool slot throws', !!threw, threw);
  check('the error names the artifact id', threw && threw.message.includes('sdc-901'), threw && threw.message);
  check('the error quotes BOTH the seed.json value and the base-pool slot value', threw && threw.message.includes('OO') && threw.message.includes('CV'), threw && threw.message);
}

section('19. assemble-key.js — normalizeBrief: <<HEAD>>/<COMMIT>/foreign-sha rewriting and its assertions');
{
  const dir = tmpDir('wo12-ak-normalize-');
  const base = 'a'.repeat(40);
  const head = 'c'.repeat(40);
  const foreign = 'f'.repeat(40);

  const f1 = path.join(dir, 'tok.txt');
  fs.writeFileSync(f1, 'Change under review: commit <<HEAD>>\nBase (its parent): ' + base + '\nSTATUS line names <COMMIT> too, and a stray guess ' + foreign + '.\n', 'utf8');
  const log1 = assembleKeyLib.normalizeBrief(f1, base, head);
  check('<<HEAD>>, <COMMIT> and the foreign sha are all recorded as replaced', log1.replaced.length === 3, JSON.stringify(log1));
  const out1 = fs.readFileSync(f1, 'utf8');
  check('the base sha is left untouched', out1.includes(base));
  check('the file no longer contains the foreign sha', !out1.includes(foreign), out1);
  check('the file no longer contains the <<HEAD>>/<COMMIT> tokens', !out1.includes('<<HEAD>>') && !out1.includes('<COMMIT>'), out1);
  check('the file now names the head sha (three times: two tokens + the foreign sha)', (out1.match(new RegExp(head, 'g')) || []).length === 3, out1);

  // Idempotent: a second pass over an already-normalized file is a no-op.
  const log2 = assembleKeyLib.normalizeBrief(f1, base, head);
  check('re-running normalizeBrief on an already-normalized file replaces nothing', log2.replaced.length === 0, JSON.stringify(log2));
  check('re-running normalizeBrief on an already-normalized file reports unchanged', log2.changed === false, JSON.stringify(log2));

  const f2 = path.join(dir, 'nobase.txt');
  fs.writeFileSync(f2, 'Change under review: commit <COMMIT>\nno base sha anywhere in this file\n', 'utf8');
  let threw2 = null;
  try { assembleKeyLib.normalizeBrief(f2, base, head); } catch (e) { threw2 = e; }
  check('normalizeBrief fails closed when the base sha is missing from the (normalized) file', !!threw2 && /does not contain the base/.test(threw2.message), threw2 && threw2.message);
}

section('20. assemble-key.js — leakage lint catches forbidden corpus-construction terms');
{
  const dir = tmpDir('wo12-ak-leak-');
  const clean = path.join(dir, 'clean.txt');
  fs.writeFileSync(clean, 'REVIEW PACKET — review a completed, already-merged change.\n', 'utf8');
  let threwClean = null;
  try { assembleKeyLib.leakageLint(clean); } catch (e) { threwClean = e; }
  check('a clean brief passes the leakage lint', !threwClean, threwClean && threwClean.message);

  const leaky = path.join(dir, 'leaky.txt');
  fs.writeFileSync(leaky, 'This change fixes the seeded regression from round 2.\n', 'utf8');
  let threwLeaky = null;
  try { assembleKeyLib.leakageLint(leaky); } catch (e) { threwLeaky = e; }
  check('a brief containing "seed" (as a substring, e.g. "seeded") fails the leakage lint', !!threwLeaky, threwLeaky);
  check('the leakage error names the forbidden term', threwLeaky && threwLeaky.message.includes('"seed"'), threwLeaky && threwLeaky.message);

  const hazardLeak = path.join(dir, 'hazard-leak.txt');
  fs.writeFileSync(hazardLeak, 'Cross-check the hazard_terms list before merging.\n', 'utf8');
  let threwHazard = null;
  try { assembleKeyLib.leakageLint(hazardLeak); } catch (e) { threwHazard = e; }
  check('a brief containing "hazard_terms" fails the leakage lint', !!threwHazard, threwHazard);
}

section('21. assemble-key.js — 12h template conformance (V1/V2/V3 author lines, vendor-name and HAZARD CHECKLIST rules)');
{
  const dir = tmpDir('wo12-ak-template-');

  const v1Ok = path.join(dir, 'v1-ok.txt');
  fs.writeFileSync(v1Ok, 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. An executor produced this\nchange; no fresh executor claims exist beyond\nthe commit message. Verify\nthe diff on its own merits.\n', 'utf8');
  let threwV1Ok = null;
  try { assembleKeyLib.templateConformance(v1Ok, 'V1'); } catch (e) { threwV1Ok = e; }
  check('a correctly-worded, vendor-free V1 report passes', !threwV1Ok, threwV1Ok && threwV1Ok.message);

  const v1Leaky = path.join(dir, 'v1-leaky.txt');
  fs.writeFileSync(v1Leaky, 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. Claude Sonnet 5 · medium\nproduced this change; no fresh executor claims exist beyond\nthe commit message.\n', 'utf8');
  let threwV1Leaky = null;
  try { assembleKeyLib.templateConformance(v1Leaky, 'V1'); } catch (e) { threwV1Leaky = e; }
  check('a V1 report naming a vendor/model fails', !!threwV1Leaky, threwV1Leaky);

  // Coordinator regression case: sdc-001.er.txt's V1 author phrase is
  // re-wrapped ACROSS REAL INSERTED CONTENT (a genuine sentence describing
  // the change sits between "this change" and "no fresh executor claims
  // exist..."), not merely re-wrapped at a different column. The phrase-
  // prefix match (not the old full-sentence match) must still pass this.
  const v1WrappedMidSentence = path.join(dir, 'v1-wrapped-mid-sentence.txt');
  fs.writeFileSync(v1WrappedMidSentence,
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '.\n' +
    'An executor produced this change. The staleness window is now 48h, the\n' +
    'disclosure keys were added additively, and the published state object\'s\n' +
    'routing-relevant fields are unchanged. Beyond that, no fresh executor\n' +
    'claims exist beyond the commit message. Verify the diff on its own\n' +
    'merits.\n', 'utf8');
  let threwWrapped = null;
  try { assembleKeyLib.templateConformance(v1WrappedMidSentence, 'V1'); } catch (e) { threwWrapped = e; }
  check('a V1 report whose author phrase is re-wrapped mid-sentence (real content inserted, different line breaks) still passes', !threwWrapped, threwWrapped && threwWrapped.message);

  // Coordinator regression case: whole-word, case-sensitive vendor-name
  // detection — a V1 report that otherwise matches the phrase but names
  // "Anthropic" (whole word) must still fail.
  const v1NamesAnthropic = path.join(dir, 'v1-names-anthropic.txt');
  fs.writeFileSync(v1NamesAnthropic,
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '.\n' +
    'An executor produced this change under an Anthropic-run harness; no\n' +
    'fresh executor claims exist beyond the commit message.\n', 'utf8');
  let threwAnthropic = null;
  try { assembleKeyLib.templateConformance(v1NamesAnthropic, 'V1'); } catch (e) { threwAnthropic = e; }
  check('a V1 report naming "Anthropic" (whole word) fails even though the author phrase itself matches', !!threwAnthropic && /Anthropic/.test(threwAnthropic.message), threwAnthropic && threwAnthropic.message);

  check('findVendorTerm is whole-word (does not false-positive on "Sol"/"Terra"/"Luna" as ordinary words)', assembleKeyLib.findVendorTerm('The solution landed on terra firma under a luna eclipse.') === null, assembleKeyLib.findVendorTerm('The solution landed on terra firma under a luna eclipse.'));
  check('findVendorTerm IS case-sensitive (lowercase "claude" is not a match; only the capitalized vendor name is)', assembleKeyLib.findVendorTerm('a claude in the sky') === null && assembleKeyLib.findVendorTerm('Claude Sonnet') === 'Claude', JSON.stringify([assembleKeyLib.findVendorTerm('a claude in the sky'), assembleKeyLib.findVendorTerm('Claude Sonnet')]));

  const v2Ok = path.join(dir, 'v2-ok.txt');
  fs.writeFileSync(v2Ok, 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. Claude Sonnet 5 · medium\n(Anthropic) produced this change; no fresh executor claims exist beyond\nthe commit message. Verify the diff on its own merits.\n', 'utf8');
  let threwV2Ok = null;
  try { assembleKeyLib.templateConformance(v2Ok, 'V2'); } catch (e) { threwV2Ok = e; }
  check('the exact V2 author line (identity-visible) passes as V2', !threwV2Ok, threwV2Ok && threwV2Ok.message);

  const v2Wrong = path.join(dir, 'v2-wrong.txt');
  fs.writeFileSync(v2Wrong, 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. Some engineer\nproduced this change.\n', 'utf8');
  let threwV2Wrong = null;
  try { assembleKeyLib.templateConformance(v2Wrong, 'V2'); } catch (e) { threwV2Wrong = e; }
  check('V2 wording that is not the exact author line fails', !!threwV2Wrong, threwV2Wrong);

  const v3Ok = path.join(dir, 'v3-ok.txt');
  fs.writeFileSync(v3Ok, 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. An executor produced this\nchange; no fresh executor claims exist beyond\nthe commit message.\n\nHAZARD CHECKLIST (class-derived, unattributed):\n- check for unrequested mutation outside the stated scope\n', 'utf8');
  let threwV3Ok = null;
  try { assembleKeyLib.templateConformance(v3Ok, 'V3'); } catch (e) { threwV3Ok = e; }
  check('V1 wording plus a HAZARD CHECKLIST block passes as V3', !threwV3Ok, threwV3Ok && threwV3Ok.message);

  const v3NoHazard = path.join(dir, 'v3-no-hazard.txt');
  fs.writeFileSync(v3NoHazard, 'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. An executor produced this\nchange; no fresh executor claims exist beyond\nthe commit message.\n', 'utf8');
  let threwV3NoHazard = null;
  try { assembleKeyLib.templateConformance(v3NoHazard, 'V3'); } catch (e) { threwV3NoHazard = e; }
  check('V3 without a HAZARD CHECKLIST block fails', !!threwV3NoHazard, threwV3NoHazard);
}

section('22. assemble-key.js — computeTallies against protocol §2.2/§2.3/§2.6/§2.7 targets');
{
  // A synthetic key that hits every target EXACTLY: 5 seeds/type x 6 types = 30
  // (2 CRITICAL + 22 MAJOR + ... wait — build it directly to the targets:
  // 6 CRITICAL total, spread across 4+ types; 20 MAJOR; 4 MINOR; 10/10/10 seed
  // variant; phase counts 12/24/24/24 overall (30 seeded + 54 control = 84).
  function seededArtifact(id, type, severity, phase, variant) {
    return { id, kind: 'seeded', phase, variant, base: 'b', commit: 'c', subject: 'x', seed: { type, severity, locator: { file: 'a.js', lines: [1, 2], symbol: 'f' }, consequence: 'x', rationale: 'y', hazard_terms: [] } };
  }
  function controlArtifact(id, phase, variant) {
    return { id, kind: 'control', phase, variant, base: 'b', commit: 'c', subject: 'x', seed: null };
  }

  const severityPlan = { // 5 per type; exactly 6 CRITICAL across 4 types, 20 MAJOR, 4 MINOR
    CV: ['CRITICAL', 'MAJOR', 'MAJOR', 'MAJOR', 'MAJOR'],
    OO: ['CRITICAL', 'MAJOR', 'MAJOR', 'MAJOR', 'MAJOR'],
    LC: ['CRITICAL', 'MAJOR', 'MAJOR', 'MAJOR', 'MAJOR'],
    FT: ['CRITICAL', 'MAJOR', 'MAJOR', 'MAJOR', 'MAJOR'],
    HF: ['CRITICAL', 'CRITICAL', 'MAJOR', 'MAJOR', 'MINOR'],
    RC: ['MAJOR', 'MAJOR', 'MINOR', 'MINOR', 'MINOR'],
  };
  // Per-type variant COUNTS matching base-pool.json's own staggered-rotation
  // table (README.md "Seeded, by variant"), so the 5-per-type/30-total split
  // sums to exactly 10/10/10 despite 5 not being a multiple of 3.
  const variantCountsByType = {
    CV: { V1: 2, V2: 2, V3: 1 }, OO: { V1: 1, V2: 2, V3: 2 }, LC: { V1: 2, V2: 1, V3: 2 },
    FT: { V1: 2, V2: 2, V3: 1 }, HF: { V1: 1, V2: 2, V3: 2 }, RC: { V1: 2, V2: 1, V3: 2 },
  };
  function variantPlanForType(type) {
    const counts = variantCountsByType[type];
    const plan = [];
    for (const v of assembleKeyLib.VARIANTS) for (let i = 0; i < counts[v]; i++) plan.push(v);
    return plan; // length 5
  }
  // Per-type phase assignment: seed index 0 -> phase 0 (the pilot, 6 seeds
  // total); indices 1/2/3 -> phases 1/2/3 (6 seeds each); index 4 (the 5th,
  // "MAJOR-preferred" seed) spreads 2 types per phase so 1/2/3 each land at
  // 8 total (6 + 2), matching protocol §2.6's phase-0/1/2/3 = 6/8/8/8 seeds.
  const extraPhaseByType = { CV: 1, FT: 1, OO: 2, HF: 2, LC: 3, RC: 3 };
  function phaseForSeedIndex(type, i) {
    if (i === 0) return 0;
    if (i <= 3) return i;
    return extraPhaseByType[type];
  }

  const artifacts = [];
  let sid = 1;
  for (const type of assembleKeyLib.TYPES) {
    const variantPlan = variantPlanForType(type);
    severityPlan[type].forEach((sev, i) => {
      artifacts.push(seededArtifact('sdc-s' + (sid++), type, sev, phaseForSeedIndex(type, i), variantPlan[i]));
    });
  }
  // 54 controls, 18 per variant (a straight V1/V2/V3 cycle over 54 is exactly
  // 18 each), phases 6/16/16/16 so phase totals land on 12/24/24/24 overall.
  let cid = 1;
  const controlVariantCycle = ['V1', 'V2', 'V3'];
  const controlPhasePlan = [];
  for (let i = 0; i < 6; i++) controlPhasePlan.push(0);
  for (let i = 0; i < 16; i++) controlPhasePlan.push(1);
  for (let i = 0; i < 16; i++) controlPhasePlan.push(2);
  for (let i = 0; i < 16; i++) controlPhasePlan.push(3);
  for (let i = 0; i < 54; i++) {
    artifacts.push(controlArtifact('sdc-c' + (cid++), controlPhasePlan[i], controlVariantCycle[i % 3]));
  }

  const tallies = assembleKeyLib.computeTallies({ version: 1, artifacts });
  check('30 seeded computed', tallies.seededCount === 30, tallies.seededCount);
  check('54 control computed', tallies.controlCount === 54, tallies.controlCount);
  check('per-type seed counts are all 5', assembleKeyLib.TYPES.every((t) => tallies.byType[t] === 5), JSON.stringify(tallies.byType));
  check('severity tally: 6 CRITICAL, 20 MAJOR, 4 MINOR', tallies.severityCounts.CRITICAL === 6 && tallies.severityCounts.MAJOR === 20 && tallies.severityCounts.MINOR === 4, JSON.stringify(tallies.severityCounts));
  check('CRITICAL lands in >=4 types', tallies.criticalTypes.length >= 4, JSON.stringify(tallies.criticalTypes));
  check('phase counts are 12/24/24/24', tallies.phaseCounts[0] === 12 && tallies.phaseCounts[1] === 24 && tallies.phaseCounts[2] === 24 && tallies.phaseCounts[3] === 24, JSON.stringify(tallies.phaseCounts));
  check('every target is met, so there are zero warnings on this exact-target corpus', tallies.warnings.length === 0, JSON.stringify(tallies.warnings));

  // Perturb one MINOR->CRITICAL swap that breaks nothing, then break the MINOR
  // ceiling directly to prove a missed target surfaces as a WARNING, not a throw.
  artifacts.push(seededArtifact('sdc-extra-minor', 'RC', 'MINOR', 3, 'V2'));
  const perturbed = assembleKeyLib.computeTallies({ version: 1, artifacts });
  check('a corpus that MISSES a target computes without throwing (warnings are non-gating)', Array.isArray(perturbed.warnings));
  check('the MINOR-ceiling miss is reported as a warning', perturbed.warnings.some((w) => /MINOR/.test(w)), JSON.stringify(perturbed.warnings));
}

section('23. assemble-key.js — end-to-end CLI: --check-only, then a full assembly on a synthetic mini-pool');
{
  const src = makeSourceRepo();
  // A second real commit to serve as the control slot's head.
  fs.writeFileSync(path.join(src.dir, 'notes.md'), '# notes\n', 'utf8');
  git(['add', '-A'], src.dir);
  git(['commit', '-q', '-m', 'add notes'], src.dir);
  const controlHead = git(['rev-parse', 'HEAD'], src.dir);

  const patch = makePatch(src.dir, (dir) => {
    fs.writeFileSync(path.join(dir, 'app.js'), 'function add(a, b) {\n  return a + b; // seeded defect\n}\n');
  });

  const corpusDir = tmpDir('wo12-ak-e2e-corpus-');
  const briefsDir = path.join(corpusDir, 'briefs');
  fs.mkdirSync(briefsDir, { recursive: true });

  const poolPath = path.join(corpusDir, 'base-pool.json');
  fs.writeFileSync(poolPath, JSON.stringify({
    slots: [
      {
        id: 'sdc-e2e-901', kind: 'seeded', phase: 0, variant: 'V1',
        base: src.base, commit: controlHead, subject: 'e2e sample subject',
        seed_slot: { type: 'CV', target_severity: 'MAJOR' },
      },
      {
        id: 'sdc-e2e-ctl', kind: 'control', phase: 0, variant: 'V2',
        base: src.base, commit: controlHead, subject: 'add notes', seed_slot: null,
      },
    ],
  }, null, 2), 'utf8');

  // --check-only BEFORE the seed.json/patch exist: must report exactly what's missing and exit 1.
  const rCheck1 = spawnSync(process.execPath, [ASSEMBLE_KEY, '--check-only', '--pool', poolPath], { encoding: 'utf8' });
  check('--check-only exits 1 when inputs are missing', rCheck1.status === 1, 'status=' + rCheck1.status + '\n' + rCheck1.stdout);
  check('--check-only lists the missing seed.json', /sdc-e2e-901.*seed\.json/.test(rCheck1.stdout || ''), rCheck1.stdout);
  check('--check-only lists the missing patch', /sdc-e2e-901.*\.patch/.test(rCheck1.stdout || ''), rCheck1.stdout);
  check('--check-only lists the missing briefs for both slots', /sdc-e2e-901.*wo\.txt/.test(rCheck1.stdout || '') && /sdc-e2e-ctl.*wo\.txt/.test(rCheck1.stdout || ''), rCheck1.stdout);

  // A full (non-check-only) run over the same incomplete pool is a hard failure too.
  const rFull1 = spawnSync(process.execPath, [ASSEMBLE_KEY, '--pool', poolPath], { encoding: 'utf8' });
  check('a full run refuses (non-zero) when inputs are missing (all-or-nothing)', rFull1.status !== 0, 'status=' + rFull1.status);
  check('key.json was NOT written by the refused full run', !fs.existsSync(path.join(corpusDir, 'key.json')));

  // Now supply everything.
  fs.writeFileSync(path.join(corpusDir, 'sdc-e2e-901.patch'), patch, 'utf8');
  fs.writeFileSync(path.join(corpusDir, 'sdc-e2e-901.seed.json'), JSON.stringify({
    id: 'sdc-e2e-901', kind: 'seeded', phase: 0, variant: 'V1',
    base: src.base, commit: controlHead, subject: 'e2e sample subject',
    seed: { type: 'CV', severity: 'MAJOR', locator: { file: 'app.js', lines: [1, 3], symbol: 'add' }, consequence: 'x consequence', rationale: 'y rationale', hazard_terms: ['scope creep'] },
    suite_at_variant: '3 passed, 0 failed',
    design_note: 'a plausible slip an executor would make',
  }, null, 2), 'utf8');

  const foreignGuessSha = '1'.repeat(40);
  fs.writeFileSync(path.join(briefsDir, 'sdc-e2e-901.wo.txt'),
    'REVIEW PACKET — review a completed, already-merged change.\n\n' +
    'Change under review: commit <<HEAD>>\n' +
    'Base (its parent):   ' + src.base + '\n' +
    'Commit subject:      e2e sample subject\n\n' +
    'Intent: the commit message above is the work order this change claims to\n' +
    'implement. Audit the diff between base and head against that stated\n' +
    'intent: correctness, unexplained changes, and concrete failure scenarios.\n' +
    '(a placeholder guess an earlier drafter left behind: ' + foreignGuessSha + ')\n', 'utf8');
  fs.writeFileSync(path.join(briefsDir, 'sdc-e2e-901.er.txt'),
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit <COMMIT>. An executor produced this\n' +
    'change; no fresh executor claims exist beyond the commit message. Verify\n' +
    'the diff on its own merits.\n', 'utf8');

  fs.writeFileSync(path.join(briefsDir, 'sdc-e2e-ctl.wo.txt'),
    'REVIEW PACKET — review a completed, already-merged change.\n\n' +
    'Change under review: commit ' + controlHead + '\n' +
    'Base (its parent):   ' + src.base + '\n' +
    'Commit subject:      add notes\n\n' +
    'Intent: the commit message above is the work order this change claims to\n' +
    'implement. Audit the diff between base and head against that stated\n' +
    'intent: correctness, unexplained changes, and concrete failure scenarios.\n', 'utf8');
  fs.writeFileSync(path.join(briefsDir, 'sdc-e2e-ctl.er.txt'),
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + controlHead + '. Claude Sonnet 5 · medium\n' +
    '(Anthropic) produced this change; no fresh executor claims exist beyond\n' +
    'the commit message. Verify the diff on its own merits.\n', 'utf8');

  const rCheck2 = spawnSync(process.execPath, [ASSEMBLE_KEY, '--check-only', '--pool', poolPath], { encoding: 'utf8' });
  check('--check-only exits 0 once every input is present', rCheck2.status === 0, 'status=' + rCheck2.status + '\n' + rCheck2.stdout);
  check('--check-only reports nothing missing', /nothing missing/.test(rCheck2.stdout || ''), rCheck2.stdout);

  const cloneRoot = path.join(tmpDir('wo12-ak-e2e-clone-'), 'clone');
  const rFull2 = spawnSync(process.execPath, [ASSEMBLE_KEY, '--pool', poolPath, '--source-repo', src.dir, '--clone-root', cloneRoot], { encoding: 'utf8' });
  check('the full assembly succeeds once every input is present', rFull2.status === 0, 'status=' + rFull2.status + '\n' + rFull2.stderr + '\n' + rFull2.stdout);

  const keyPath = path.join(corpusDir, 'key.json');
  check('key.json was written', fs.existsSync(keyPath));
  let key = null;
  if (fs.existsSync(keyPath)) {
    key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    check('key.json has both artifacts, in corpus (pool) order', key.artifacts.length === 2 && key.artifacts[0].id === 'sdc-e2e-901' && key.artifacts[1].id === 'sdc-e2e-ctl', JSON.stringify(key.artifacts.map((a) => a.id)));
    check('the control artifact has seed: null', key.artifacts[1].seed === null);
    check('the seeded artifact carries the ACHIEVED severity from seed.json', key.artifacts[0].seed && key.artifacts[0].seed.severity === 'MAJOR', JSON.stringify(key.artifacts[0]));
    check('the seeded artifact does NOT carry suite_at_variant/design_note (those live in construction-notes.json, not the sealed key)', !('suite_at_variant' in key.artifacts[0]) && !('design_note' in key.artifacts[0]), JSON.stringify(key.artifacts[0]));
  }

  const notesPath = path.join(corpusDir, 'construction-notes.json');
  check('construction-notes.json was written', fs.existsSync(notesPath));
  if (fs.existsSync(notesPath)) {
    const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
    check('construction-notes.json carries the seed\'s suite_at_variant', notes.seeds && notes.seeds['sdc-e2e-901'] && notes.seeds['sdc-e2e-901'].suite_at_variant === '3 passed, 0 failed', JSON.stringify(notes.seeds));
    check('construction-notes.json carries targetWarnings (a 1-seed/1-control corpus misses nearly every count target, as expected)', Array.isArray(notes.targetWarnings) && notes.targetWarnings.length > 0, JSON.stringify(notes.targetWarnings));
  }

  const constructionMdPath = path.join(corpusDir, 'CONSTRUCTION.md');
  check('CONSTRUCTION.md was written and names the seeded id', fs.existsSync(constructionMdPath) && fs.readFileSync(constructionMdPath, 'utf8').includes('sdc-e2e-901'));

  const normalizedWo = fs.readFileSync(path.join(briefsDir, 'sdc-e2e-901.wo.txt'), 'utf8');
  const normalizedEr = fs.readFileSync(path.join(briefsDir, 'sdc-e2e-901.er.txt'), 'utf8');
  check('the normalized work-order brief no longer contains the <<HEAD>> token', !normalizedWo.includes('<<HEAD>>'), normalizedWo);
  check('the normalized work-order brief no longer contains the foreign placeholder sha', !normalizedWo.includes(foreignGuessSha), normalizedWo);
  check('the normalized work-order brief still names the real base sha', normalizedWo.includes(src.base), normalizedWo);
  check('the normalized executor-report brief no longer contains the <COMMIT> token', !normalizedEr.includes('<COMMIT>'), normalizedEr);
  if (key) {
    const head = key.artifacts[0].base === src.base ? (normalizedWo.match(/Change under review: commit ([0-9a-f]{40})/) || [])[1] : null;
    check('the materialized head sha appears in both normalized briefs and is a real 40-hex sha distinct from base', !!head && head !== src.base && normalizedEr.includes(head), head);
  }
}

section('24. assemble-key.js — coordinator scoping ruling: vendor check confined to the author sentence; leakage lint exempts the real commit subject');
{
  const dir = tmpDir('wo12-ak-scoping-');

  // (a) sdc-043 regression: the AUTHOR SENTENCE is clean, but later, real
  // report prose legitimately names a vendor/tool while describing the
  // diff's own subject matter ("the Codex path") — must PASS now that the
  // vendor check is confined to the sentence containing "produced this
  // change", not the whole report.
  const v1CodexElsewhere = path.join(dir, 'v1-codex-elsewhere.er.txt');
  fs.writeFileSync(v1CodexElsewhere,
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. An executor produced this\n' +
    'change; the executor\'s completion claims follow. Verify the diff on its\n' +
    'own merits.\n\n' +
    'All three sub-items landed: the fallback path is no longer weaker than\n' +
    'the Codex path on any of the three. README and the runner header\n' +
    'document the policy/transport split.\n', 'utf8');
  let threwCodexElsewhere = null;
  try { assembleKeyLib.templateConformance(v1CodexElsewhere, 'V1'); } catch (e) { threwCodexElsewhere = e; }
  check('a V1 report whose author sentence is clean, but whose LATER real prose names a vendor/tool ("the Codex path"), now passes', !threwCodexElsewhere, threwCodexElsewhere && threwCodexElsewhere.message);

  // The same vendor name INSIDE the author sentence itself must still fail —
  // scoping narrows where the check looks, it does not disable it.
  const v3CodexInSentence = path.join(dir, 'v3-codex-in-sentence.er.txt');
  fs.writeFileSync(v3CodexInSentence,
    'EXECUTOR REPORT:\nSTATUS: DONE. The change is commit ' + 'c'.repeat(40) + '. An executor produced this\n' +
    'change under Codex; no fresh executor claims exist beyond the commit\n' +
    'message.\n\nHAZARD CHECKLIST (class-derived, unattributed):\n- check for unrequested mutation outside the stated scope\n', 'utf8');
  let threwCodexInSentence = null;
  try { assembleKeyLib.templateConformance(v3CodexInSentence, 'V3'); } catch (e) { threwCodexInSentence = e; }
  check('a vendor/tool name INSIDE the author sentence itself still fails (scoping narrows, does not disable, the check)', !!threwCodexInSentence && /Codex/.test(threwCodexInSentence.message), threwCodexInSentence && threwCodexInSentence.message);

  check('extractAuthorSentence pulls just the sentence containing "produced this change", not the whole text', assembleKeyLib.extractAuthorSentence('Some prose before. An executor produced this change; and more prose after.') === 'An executor produced this change;', JSON.stringify(assembleKeyLib.extractAuthorSentence('Some prose before. An executor produced this change; and more prose after.')));

  // (b) sdc-068 regression: the real commit SUBJECT itself contains a
  // forbidden term ("Fix three cross-platform defects...") — exempt on the
  // `Commit subject:` line and as a verbatim substring of key.json's
  // `subject`, but "seed"/"defect"/etc. ANYWHERE ELSE in the same brief
  // must still be caught.
  const subject = 'Fix three cross-platform defects CI found in its first run';
  const woSubjectOnly = path.join(dir, 'wo-subject-only.wo.txt');
  fs.writeFileSync(woSubjectOnly,
    'REVIEW PACKET — review a completed, already-merged change.\n\n' +
    'Change under review: commit ' + 'c'.repeat(40) + '\n' +
    'Base (its parent):   ' + 'b'.repeat(40) + '\n' +
    'Commit subject:      ' + subject + '\n\n' +
    'Intent: the commit message above is the work order this change claims to\n' +
    'implement. Audit the diff between base and head against that stated\n' +
    'intent: correctness, unexplained changes, and concrete failure scenarios.\n', 'utf8');
  let threwSubjectOnly = null;
  try { assembleKeyLib.leakageLint(woSubjectOnly, subject); } catch (e) { threwSubjectOnly = e; }
  check('a V1 brief whose `Commit subject:` line says "...defects..." (this artifact\'s real subject) passes the leakage lint', !threwSubjectOnly, threwSubjectOnly && threwSubjectOnly.message);

  const woSubjectPlusLeakElsewhere = path.join(dir, 'wo-subject-plus-leak.wo.txt');
  fs.writeFileSync(woSubjectPlusLeakElsewhere,
    'REVIEW PACKET — review a completed, already-merged change.\n\n' +
    'Change under review: commit ' + 'c'.repeat(40) + '\n' +
    'Base (its parent):   ' + 'b'.repeat(40) + '\n' +
    'Commit subject:      ' + subject + '\n\n' +
    'Intent: the commit message above is the work order this change claims to\n' +
    'implement, described as a seeded fix. Audit the diff between base and\n' +
    'head against that stated intent.\n', 'utf8');
  let threwSubjectPlusLeak = null;
  try { assembleKeyLib.leakageLint(woSubjectPlusLeakElsewhere, subject); } catch (e) { threwSubjectPlusLeak = e; }
  check('a brief with "seed" OUTSIDE the subject line still fails the leakage lint, even with the same exempt subject present', !!threwSubjectPlusLeak && /"seed"/.test(threwSubjectPlusLeak.message), threwSubjectPlusLeak && threwSubjectPlusLeak.message);

  // Without a `Commit subject:` prefix but STILL a verbatim substring of the
  // artifact's real subject (e.g. a wrapped continuation line) is exempt too.
  check('isExemptLeakageLine exempts a line that is a verbatim substring of the artifact subject, even without the "Commit subject:" prefix', assembleKeyLib.isExemptLeakageLine('  cross-platform defects CI found  ', subject) === true);
  check('isExemptLeakageLine does NOT exempt a line merely because SOME subject was supplied, when the line is not a substring of it', assembleKeyLib.isExemptLeakageLine('this is a seeded line unrelated to the subject', subject) === false);
  // The `Commit subject:` PREFIX exemption (b)(i) is independent of whether
  // a `subject` argument is even passed — it fires on the line prefix alone.
  {
    const p = path.join(dir, 'no-subject-arg.txt');
    fs.writeFileSync(p, 'Commit subject:      Fix three cross-platform defects CI found in its first run\n', 'utf8');
    let threwNoSubjectArg = null;
    try { assembleKeyLib.leakageLint(p); } catch (e) { threwNoSubjectArg = e; }
    check('the `Commit subject:` line prefix exemption fires even when leakageLint is called with NO subject argument at all', !threwNoSubjectArg, threwNoSubjectArg && threwNoSubjectArg.message);
  }

  // But that prefix exemption is scoped to the ONE line — a "defect" a line
  // below the (unexempt, plain) subject line still fails when no `subject`
  // argument narrows the verbatim-substring exemption.
  {
    const p = path.join(dir, 'leak-below-subject.txt');
    fs.writeFileSync(p, 'Commit subject:      a clean subject line\nThis is a seeded regression.\n', 'utf8');
    let threwBelow = null;
    try { assembleKeyLib.leakageLint(p); } catch (e) { threwBelow = e; }
    check('a forbidden term on a line OTHER than the exempt `Commit subject:` line still fails', !!threwBelow && /"seed"/.test(threwBelow.message), threwBelow && threwBelow.message);
  }
}

console.log('\n' + passes + ' passed, ' + failures + ' failed');
