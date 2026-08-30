#!/usr/bin/env node
/**
 * WO-5 Verifier substrate tests.
 *
 *   node tests/verifier.test.js
 *
 * The order's proof clause, verbatim: the substrate must catch (1) a red
 * suite reported green, (2) changes claimed against an untouched tree,
 * (3) an invertible test that stays green, and (4) a broken row-count
 * invariant — on a project whose suite CANNOT run read-only. The fixture
 * project built here writes a `.test-cache/` file on every suite run, so a
 * read-only sandbox would fail it by construction; the disposable-checkout
 * substrate is what makes the checks possible at all.
 *
 * Also under test: the checkout lifecycle (creation outside the repo,
 * guaranteed teardown, worktree deregistration), the generated-artifact
 * classification (cache churn is a NOTE, a source edit is a WARNING), the
 * dispatcher-side guard of the real tree, nonce echo, artifact validation
 * against the WO-4 registry schemas, citation replay (whose items must
 * themselves validate against the verdict-audit schema), diff parsing, and
 * the typed-outcome aggregation with the deterministic-only-closure gate.
 *
 * Same conventions as the other suites: no dependencies, exit-code
 * discipline enforced by an exit handler, a suite that ran no checks fails.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const checkoutLib = require(path.join(MASTER, 'verifier', 'checkout.js'));
const verifier = require(path.join(MASTER, 'verifier', 'verifier.js'));
const registry = require(path.join(MASTER, 'registry', 'load.js'));

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

function section(title) {
  console.log('\n' + title);
}

process.on('exit', () => {
  for (const fn of cleanups) { try { fn(); } catch (e) { /* best effort */ } }
  if (failures > 0) process.exitCode = 1;
  else if (passes === 0) {
    console.log('\nFAILED — no checks ran at all (the suite did not execute)');
    process.exitCode = 1;
  }
});

function git(dir, args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + (r.stderr || ''));
  return (r.stdout || '').trim();
}

// ------------------------------------------------------------- the fixture
//
// A tiny node project whose suite cannot run read-only (test.js writes
// .test-cache/ on every run), with one real assertion, one vacuous assertion
// (swallowed by try/catch — the invertible test that stays green), and a
// row-count invariant probe.

const FIXTURE_LIB_GOOD = [
  "'use strict';",
  'function sum(a, b) { return a + b; }',
  'function rows(text) { return text.split(/\\r?\\n/).filter(Boolean).length; }',
  'module.exports = { sum, rows };',
  '',
].join('\n');

const FIXTURE_LIB_BROKEN = FIXTURE_LIB_GOOD.replace('return a + b;', 'return a - b;');

const REAL_ASSERT = 'assert.strictEqual(sum(2, 2), 4);';
const VACUOUS_ASSERT = 'try { assert.strictEqual(sum(1, 2), 3); } catch (e) {}';

const FIXTURE_TEST = [
  "'use strict';",
  "const assert = require('assert');",
  "const fs = require('fs');",
  "const { sum } = require('./lib.js');",
  '// The suite cannot run read-only: every run writes the cache below.',
  "fs.mkdirSync('.test-cache', { recursive: true });",
  "fs.writeFileSync('.test-cache/last-run.json', JSON.stringify({ at: Date.now() }));",
  REAL_ASSERT,
  VACUOUS_ASSERT,
  "console.log('suite green');",
  '',
].join('\n');

const FIXTURE_COUNT = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const { rows } = require('./lib.js');",
  "console.log(rows(fs.readFileSync(path.join(__dirname, 'data.txt'), 'utf8')));",
  '',
].join('\n');

function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-verifier-fixture-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, ['init']);
  git(dir, ['config', 'user.email', 'verifier-suite@example.invalid']);
  git(dir, ['config', 'user.name', 'Verifier Suite']);
  fs.writeFileSync(path.join(dir, 'lib.js'), FIXTURE_LIB_GOOD);
  fs.writeFileSync(path.join(dir, 'test.js'), FIXTURE_TEST);
  fs.writeFileSync(path.join(dir, 'count.js'), FIXTURE_COUNT);
  fs.writeFileSync(path.join(dir, 'data.txt'), 'row-1\nrow-2\nrow-3\nrow-4\nrow-5\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'green baseline: 5 data rows, suite passes']);
  const base = git(dir, ['rev-parse', 'HEAD']);

  // The "bad" head commit: breaks sum (suite goes red) AND drops a data row
  // (breaks the row-count invariant) — while its report will claim green.
  fs.writeFileSync(path.join(dir, 'lib.js'), FIXTURE_LIB_BROKEN);
  fs.writeFileSync(path.join(dir, 'data.txt'), 'row-1\nrow-2\nrow-3\nrow-4\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'breaks sum and deletes a data row']);
  const bad = git(dir, ['rev-parse', 'HEAD']);
  return { dir, base, bad };
}

const MANIFEST = { commands: [{ command: 'node test.js' }], coverage: 'complete', versions: ['node --version'] };

function makeOrder(nonce) {
  return {
    task_id: 'wo5-proof',
    class: 'E2',
    risk: 'T1',
    requested_casting: { vendor: 'anthropic', model: 'claude-sonnet-5', effort: 'med' },
    author_family: 'anthropic',
    co_author_families: [],
    goal: 'fixture change under verification',
    acceptance_criteria: ['node test.js exits 0'],
    review_policy: 'preferred',
    integrity_nonce: nonce,
  };
}

function makeReport(nonce, extra) {
  return Object.assign({
    status: 'DONE',
    summary: 'change complete, suite green',
    requested_casting: { vendor: 'anthropic', model: 'claude-sonnet-5', effort: 'med' },
    author_family: 'anthropic',
    co_author_families: [],
    served_model: 'claude-sonnet-5',
    integrity: { nonce_echo: nonce },
  }, extra || {});
}

const NONCE = 'nonce-3f9a71c2';
const fixture = makeFixtureRepo();

// ---------------------------------------------------------------- substrate

section('1. Disposable-checkout substrate: outside the repo, torn down, deregistered');
{
  const co = checkoutLib.createCheckout(fixture.dir, fixture.base);
  check('checkout created', !co.error, co.error);
  if (!co.error) {
    const toplevel = git(fixture.dir, ['rev-parse', '--show-toplevel']);
    const rel = path.relative(path.resolve(toplevel), co.dir);
    check('checkout lives OUTSIDE the repository', rel.startsWith('..') || path.isAbsolute(rel), co.dir);
    check('checkout is at the requested commit', git(co.dir, ['rev-parse', 'HEAD']) === fixture.base);

    // The read-only-impossible project: running the suite writes the cache,
    // and the classification must file that under expected churn (NOTE), not
    // suspect (WARNING).
    const run = verifier.runManifest(co.dir, MANIFEST);
    check('suite green at base', run.outcome === 'PASS', JSON.stringify(run.commands));
    check('suite wrote the cache (cannot run read-only)', fs.existsSync(path.join(co.dir, '.test-cache', 'last-run.json')));
    const delta = co.delta();
    check('cache churn classified as expected (INTEGRITY NOTE bucket)',
      delta && delta.expected.some((c) => c.path.replace(/\\/g, '/').startsWith('.test-cache/')),
      delta && JSON.stringify(delta));
    check('no suspect churn from a clean run', delta && delta.suspect.length === 0, delta && JSON.stringify(delta.suspect));

    // A source edit mid-run is the suspect bucket.
    fs.appendFileSync(path.join(co.dir, 'lib.js'), '// tampered\n');
    const delta2 = co.delta();
    check('source edit classified as suspect (INTEGRITY WARNING bucket)',
      delta2 && delta2.suspect.some((c) => c.path === 'lib.js'), delta2 && JSON.stringify(delta2.suspect));

    const coDirNorm = co.dir.replace(/\\/g, '/');
    check('checkout registered as a worktree before teardown',
      git(fixture.dir, ['worktree', 'list']).replace(/\\/g, '/').includes(coDirNorm));
    co.teardown();
    check('teardown removes the checkout', !fs.existsSync(co.dir));
    check('teardown deregisters the worktree',
      !git(fixture.dir, ['worktree', 'list']).replace(/\\/g, '/').includes(coDirNorm));
    check('teardown is idempotent', (() => { co.teardown(); return true; })());
  }

  const guarded = checkoutLib.guardTree(fixture.dir);
  fs.writeFileSync(path.join(fixture.dir, 'escaped-write.txt'), 'a write-scope escape');
  const gd = guarded.check();
  check('dispatcher guard catches a write to the real tree',
    gd && gd.suspect.some((c) => c.path === 'escaped-write.txt'), gd && JSON.stringify(gd));
  fs.rmSync(path.join(fixture.dir, 'escaped-write.txt'));
  check('guard reads clean after the write is removed', guarded.check().suspect.length === 0);

  const bogus = checkoutLib.createCheckout(fixture.dir, 'no-such-ref');
  check('unresolvable commit yields an error, not a checkout', !!bogus.error);
}

// ------------------------------------------------------------------ proofs

section('2. Proof: a red suite reported green is caught');
{
  const out = verifier.runVerification({
    repoDir: fixture.dir,
    commit: fixture.bad,
    baseRef: fixture.base,
    order: makeOrder(NONCE),
    report: makeReport(NONCE, { changes: ['lib.js:2'] }),
    manifest: MANIFEST,
  });
  check('aggregate outcome is FAIL', out.outcome === 'FAIL');
  const manifest = out.checks.find((c) => c.check === 'manifest');
  check('manifest check is red', manifest && manifest.outcome === 'FAIL');
  check('the DONE-but-red contradiction is its own finding',
    out.checks.some((c) => c.check === 'report-contradiction' && c.outcome === 'FAIL'));
  const claimed = out.checks.find((c) => c.check === 'claimed-changes');
  check('the genuinely-changed line still MATCHES', claimed && claimed.outcome === 'PASS', claimed && JSON.stringify(claimed.items));
  check('no deterministic-only closure on a FAIL', out.deterministic_only_closure === false);
}

section('3. Proof: changes claimed against an untouched tree are caught');
{
  const out = verifier.runVerification({
    repoDir: fixture.dir,
    commit: fixture.base,
    baseRef: fixture.base, // base == head: the tree is untouched
    order: makeOrder(NONCE),
    report: makeReport(NONCE, { changes: ['lib.js:2'] }),
    manifest: MANIFEST,
  });
  const claimed = out.checks.find((c) => c.check === 'claimed-changes');
  check('claimed-changes check FAILs', claimed && claimed.outcome === 'FAIL');
  check('every claim DIVERGES', claimed && claimed.items.every((i) => i.result === 'DIVERGES'), claimed && JSON.stringify(claimed.items));
  check('the reason names the untouched tree', claimed && /untouched tree/.test(claimed.reason || ''));
  check('aggregate outcome is FAIL', out.outcome === 'FAIL');
}

section('4. Proof: an invertible test that stays green is caught');
{
  const vacuous = {
    path: 'test.js',
    find: VACUOUS_ASSERT,
    replace: VACUOUS_ASSERT.replace('assert.strictEqual', 'assert.notStrictEqual'),
    description: 'invert the swallowed assertion',
  };
  const real = {
    path: 'test.js',
    find: REAL_ASSERT,
    replace: REAL_ASSERT.replace('assert.strictEqual', 'assert.notStrictEqual'),
    description: 'invert the real assertion',
  };
  const out = verifier.mutationCheck(fixture.dir, fixture.base, MANIFEST, [vacuous, real]);
  check('mutation check FAILs overall', out.outcome === 'FAIL', JSON.stringify(out.items));
  const items = out.items || [];
  check('the vacuous assertion SURVIVED its inversion',
    items.some((i) => i.mutation.description === vacuous.description && i.result === 'SURVIVED'));
  check('the real assertion inversion was CAUGHT',
    items.some((i) => i.mutation.description === real.description && i.result === 'CAUGHT'));

  const clean = verifier.mutationCheck(fixture.dir, fixture.base, MANIFEST, [real]);
  check('a suite that can fail PASSes the mutation check', clean.outcome === 'PASS', JSON.stringify(clean.items));

  const onRed = verifier.mutationCheck(fixture.dir, fixture.bad, MANIFEST, [real]);
  check('a red baseline is UNAVAILABLE, never false confidence', onRed.outcome === 'UNAVAILABLE');
}

section('5. Proof: a broken row-count invariant is caught');
{
  const spec = { name: 'data row count', command: 'node count.js' };
  const out = verifier.runVerification({
    repoDir: fixture.dir,
    commit: fixture.bad,
    baseRef: fixture.base,
    manifest: { commands: [{ command: 'node count.js' }], coverage: 'partial' },
    invariants: [spec],
  });
  const inv = out.checks.find((c) => c.check.startsWith('invariant:'));
  check('row-count invariant FAILs (5 → 4)', inv && inv.outcome === 'FAIL' && inv.before === 5 && inv.after === 4, JSON.stringify(inv));

  const held = verifier.invariantComparison(spec,
    checkoutLib.createCheckout(fixture.dir, fixture.base).dir,
    checkoutLib.createCheckout(fixture.dir, fixture.base).dir);
  check('an unbroken invariant PASSes', held.outcome === 'PASS' && held.before === 5 && held.after === 5);
  const expected = verifier.invariantComparison({ name: 'expected form', command: 'node count.js', expected: 4 },
    null, checkoutLib.createCheckout(fixture.dir, fixture.bad).dir);
  check('single-sided expected form works', expected.outcome === 'PASS', JSON.stringify(expected));
}

// --------------------------------------------------------------- mechanics

section('6. Nonce echo');
{
  check('matching echo PASSes', verifier.nonceEcho(makeOrder(NONCE), makeReport(NONCE)).outcome === 'PASS');
  check('diverging echo FAILs', verifier.nonceEcho(makeOrder(NONCE), makeReport('nonce-badbadbad')).outcome === 'FAIL');
  const missing = makeReport(NONCE);
  delete missing.integrity;
  check('missing echo fails closed', verifier.nonceEcho(makeOrder(NONCE), missing).outcome === 'FAIL');
  check('order without a nonce is UNAVAILABLE', verifier.nonceEcho({}, makeReport(NONCE)).outcome === 'UNAVAILABLE');
}

section('7. Artifact validation against the WO-4 registry schemas');
{
  check('valid order PASSes', verifier.validateArtifact('order', makeOrder(NONCE)).outcome === 'PASS');
  const bad = makeOrder(NONCE);
  delete bad.integrity_nonce;
  const r1 = verifier.validateArtifact('order', bad);
  check('order missing integrity_nonce FAILs', r1.outcome === 'FAIL' && r1.violations.some((v) => v.includes('integrity_nonce')));
  check('valid report PASSes', verifier.validateArtifact('report', makeReport(NONCE)).outcome === 'PASS');
  const reclass = makeReport(NONCE, { status: 'RECLASSIFY' });
  const r2 = verifier.validateArtifact('report', reclass);
  check('RECLASSIFY without its evidence block FAILs (if/then)', r2.outcome === 'FAIL', JSON.stringify(r2.violations));
  reclass.reclassify = { recommended_class: 'I0', evidence: ['symptom without a stated cause'], hop: 1 };
  check('RECLASSIFY with recommended_class + evidence PASSes', verifier.validateArtifact('report', reclass).outcome === 'PASS',
    JSON.stringify(verifier.validateArtifact('report', reclass).violations));
  check('unknown artifact kind is UNAVAILABLE', verifier.validateArtifact('mystery', {}).outcome === 'UNAVAILABLE');

  // The validator must fail closed on schema keywords it does not implement.
  const schemaCheck = require(path.join(MASTER, 'verifier', 'schema-check.js'));
  check('unsupported schema keyword fails closed',
    schemaCheck.validate({ contains: { type: 'string' } }, []).some((p) => p.includes('unsupported keyword')));
}

section('8. Citation replay (items conform to the verdict-audit schema)');
{
  const co = checkoutLib.createCheckout(fixture.dir, fixture.base);
  const out = verifier.citationReplay(co.dir, [
    { citation: 'lib.js:2', expect_substring: 'sum' },
    { citation: 'count.js:5', expect_substring: 'rows' },
    { command: 'node count.js', expect_substring: '5', citation: 'row count probe' },
  ]);
  check('true citations all MATCH', out.outcome === 'PASS' && out.items.every((i) => i.result === 'MATCHES'), JSON.stringify(out.items));

  const bad = verifier.citationReplay(co.dir, [
    { citation: 'lib.js:2', expect_substring: 'multiply' },   // line says no such thing
    { citation: 'lib.js:999' },                                // line does not exist
    { citation: 'ghost.js:1' },                                // file does not exist
  ]);
  check('false citations DIVERGE and FAIL', bad.outcome === 'FAIL' && bad.items.every((i) => i.result === 'DIVERGES'), JSON.stringify(bad.items));

  const gap = verifier.citationReplay(co.dir, [
    { citation: 'lib.js:2', expect_substring: 'sum' },
    { citation: 'no line reference here at all' },
  ]);
  check('an unreplayable citation forces COVERAGE_GAP, never PASS', gap.outcome === 'COVERAGE_GAP', JSON.stringify(gap.items));

  const { schemas } = registry.load();
  const itemSchema = schemas['verdict-audit.schema.json'].properties.citation_replay.items;
  const schemaCheck = require(path.join(MASTER, 'verifier', 'schema-check.js'));
  const allItems = [...out.items, ...bad.items, ...gap.items];
  check('every replay item validates against the verdict-audit schema',
    allItems.every((i) => schemaCheck.validate(itemSchema, i).length === 0),
    allItems.map((i) => schemaCheck.validate(itemSchema, i).join('; ')).filter(Boolean).join(' | '));
  co.teardown();
}

section('9. Diff parsing');
{
  const diffText = git(fixture.dir, ['diff', '--unified=0', fixture.base, fixture.bad]);
  const files = verifier.parseDiff(diffText);
  const paths = files.map((f) => f.path).sort();
  check('both changed files parsed', paths.join(',') === 'data.txt,lib.js', paths.join(','));
  const lib = files.find((f) => f.path === 'lib.js');
  check('hunk line numbers parsed', lib && lib.hunks.length > 0 && lib.hunks[0].newStart === 2, lib && JSON.stringify(lib.hunks));
  check('a bare-path claim parses', JSON.stringify(verifier.parseChangeClaim('lib.js')) === JSON.stringify({ path: 'lib.js', from: null, to: null }));
  check('a ranged claim parses', JSON.stringify(verifier.parseChangeClaim('lib.js:2-4')) === JSON.stringify({ path: 'lib.js', from: 2, to: 4 }));
}

section('10. Typed outcomes, aggregation, and the deterministic-only closure');
{
  const green = verifier.runVerification({
    repoDir: fixture.dir,
    commit: fixture.base,
    baseRef: fixture.base,
    order: makeOrder(NONCE),
    report: makeReport(NONCE),
    manifest: MANIFEST,
  });
  check('green round PASSes', green.outcome === 'PASS', JSON.stringify(green.checks.map((c) => c.check + ':' + c.outcome)));
  check('complete oracle + no model assist → deterministic-only closure', green.deterministic_only_closure === true);
  check('every check carries the not-an-approval marker', green.checks.every((c) => c.evidence_not_approval === true));
  check('every check records model-assist provenance as fields',
    green.checks.every((c) => c.model_assist && c.model_assist.used === false && 'influenced_outcome' in c.model_assist));
  const manifest = green.checks.find((c) => c.check === 'manifest');
  check('manifest reports what RAN, versions, and tree identity',
    manifest && manifest.ran.length === 1 && manifest.versions.length === 1 && typeof manifest.tree_identity === 'string');
  check('checkout tree audit is a NOTE, not a WARNING',
    green.checks.some((c) => c.check === 'checkout-tree-audit' && c.outcome === 'PASS' && /NOTE/.test(c.note)));
  check('dispatcher tree audit held', green.checks.some((c) => c.check === 'dispatcher-tree-audit' && c.outcome === 'PASS'));

  const partial = verifier.runVerification({
    repoDir: fixture.dir,
    commit: fixture.base,
    manifest: { commands: [{ command: 'node test.js' }], coverage: 'partial' },
  });
  check('green run on a partial oracle is COVERAGE_GAP, not PASS', partial.outcome === 'COVERAGE_GAP');
  check('no deterministic-only closure on a partial oracle', partial.deterministic_only_closure === false);

  const noManifest = verifier.runVerification({ repoDir: fixture.dir, commit: fixture.base, manifest: null });
  check('a missing manifest is UNAVAILABLE, never a silent pass', noManifest.outcome === 'UNAVAILABLE');

  check('aggregation: FAIL dominates', verifier.aggregate([
    verifier.result('a', 'PASS'), verifier.result('b', 'COVERAGE_GAP'), verifier.result('c', 'FAIL'),
  ]) === 'FAIL');
  check('aggregation: UNAVAILABLE beats COVERAGE_GAP', verifier.aggregate([
    verifier.result('a', 'COVERAGE_GAP'), verifier.result('b', 'UNAVAILABLE'),
  ]) === 'UNAVAILABLE');
}

console.log('\n' + passes + ' passed, ' + failures + ' failed');
