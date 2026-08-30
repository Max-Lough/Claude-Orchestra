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

    // Path identity, not string identity: on Windows CI, os.tmpdir() hands out
    // an 8.3 short path (RUNNER~1) while git stores the resolved long path, so
    // a substring compare both misses the registration AND lets the
    // deregistration check pass vacuously. Resolve before comparing.
    const normPath = (p) => {
      let r = p;
      try { r = fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p); } catch (_) { /* gone */ }
      r = path.resolve(r).replace(/\\/g, '/');
      return process.platform === 'win32' ? r.toLowerCase() : r;
    };
    const listWorktrees = () => git(fixture.dir, ['worktree', 'list', '--porcelain'])
      .split('\n').filter((l) => l.startsWith('worktree ')).map((l) => normPath(l.slice('worktree '.length)));
    const coReal = normPath(co.dir);
    check('checkout registered as a worktree before teardown', listWorktrees().includes(coReal),
      coReal + ' not in [' + listWorktrees().join(', ') + ']');
    co.teardown();
    check('teardown removes the checkout', !fs.existsSync(co.dir));
    check('teardown deregisters the worktree', !listWorktrees().includes(coReal));
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

// ------------------------------------------------- WO-8 round-2 hardening

section('11. Ruling 1a: the manifest is pinned OUTSIDE the commit under audit');
{
  // A repo whose HEAD tampers .claude/orchestra.json in the very commit
  // under review: the pinned read must execute the BASE's manifest.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-verifier-pin-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, ['init']);
  git(dir, ['config', 'user.email', 'verifier-suite@example.invalid']);
  git(dir, ['config', 'user.name', 'Verifier Suite']);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib.js'), FIXTURE_LIB_GOOD);
  fs.writeFileSync(path.join(dir, 'test.js'), FIXTURE_TEST);
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({
    verifier: { manifest: { commands: [{ command: 'node test.js' }], coverage: 'complete' } },
  }));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'owner baseline with owner manifest']);
  const pinBase = git(dir, ['rev-parse', 'HEAD']);
  // The audited commit breaks the code AND rewrites the manifest to a
  // vacuous oracle that would report green.
  fs.writeFileSync(path.join(dir, 'lib.js'), FIXTURE_LIB_BROKEN);
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({
    verifier: { manifest: { commands: [{ command: 'node -e 0' }], coverage: 'complete' } },
  }));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'breaks sum and tampers the manifest']);
  const pinHead = git(dir, ['rev-parse', 'HEAD']);

  const out = verifier.runVerification({ repoDir: dir, commit: pinHead, baseRef: pinBase });
  const man = out.checks.find((c) => c.check === 'manifest');
  check('manifest provenance is pinned to the base ref', man && man.manifest_provenance && man.manifest_provenance.pinned === true && man.manifest_provenance.ref === pinBase, man && JSON.stringify(man.manifest_provenance));
  check('the BASE manifest ran, not the tampered head copy', man && man.ran.join() === 'node test.js', man && JSON.stringify(man.ran));
  check('so the audited commit cannot green itself by editing its own oracle', out.outcome === 'FAIL' && man.outcome === 'FAIL');

  const direct = verifier.manifestFromRef(dir, pinHead);
  check('manifestFromRef reads whatever ref it is pinned to (head here, by explicit choice only)', !direct.error && direct.manifest.commands[0].command === 'node -e 0');
  check('a leading-dash ref is rejected before git sees it', !!verifier.manifestFromRef(dir, '--help').error);
  const inline = verifier.runVerification({ repoDir: dir, commit: pinBase, manifest: { commands: [{ command: 'node test.js' }], coverage: 'complete' } });
  const inlineMan = inline.checks.find((c) => c.check === 'manifest');
  check('a caller-supplied manifest records its provenance as unpinned (dispatcher trust boundary)',
    inlineMan && inlineMan.manifest_provenance && inlineMan.manifest_provenance.pinned === false);
}

section('12. Blast radius: minimal env, redacted tails, hardened refs, real-path confinement');
{
  process.env.WO5_SECRET_CANARY = 'canary-9f8e7d6c5b4a';
  const probe = verifier.runManifest(fixture.dir, { commands: [{ command: 'node -e "console.log(process.env.WO5_SECRET_CANARY||0)"' }], coverage: 'partial' });
  check('artifact-sourced commands do not inherit the dispatcher environment', probe.commands[0].stdout_tail.trim() === '0', JSON.stringify(probe.commands[0]));
  delete process.env.WO5_SECRET_CANARY;
  check('PATH survives the allowlist (commands can still run at all)', probe.commands[0].exit_code === 0);

  check('credential shapes are redacted from recorded output tails',
    verifier.redact('key sk-ABCDEFGHIJKLMNOPQRSTUV end') === 'key [REDACTED] end' &&
    verifier.redact('Authorization: Bearer abcdef0123456789ABCDEF') === 'Authorization: Bearer [REDACTED]' &&
    verifier.redact('AKIAIOSFODNN7EXAMPLE') === '[REDACTED]' &&
    verifier.redact('API_KEY=super-secret-value-123') === 'API_KEY=[REDACTED]' &&
    verifier.redact('plain output stays untouched') === 'plain output stays untouched');

  const dash = verifier.claimedChanges(fixture.dir, '--output=owned', 'HEAD', ['lib.js:2']);
  check('claimedChanges rejects a leading-dash ref as UNAVAILABLE', dash.outcome === 'UNAVAILABLE' && /ref rejected/.test(dash.reason));
  check('createCheckout rejects a leading-dash commitish', !!checkoutLib.createCheckout(fixture.dir, '--help').error);

  // confine(): lexical containment plus real-path (symlink/junction) escape.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-confine-base-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-confine-out-'));
  cleanups.push(() => fs.rmSync(base, { recursive: true, force: true }));
  cleanups.push(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.mkdirSync(path.join(base, 'real'));
  fs.writeFileSync(path.join(base, 'real', 'file.txt'), 'inside');
  fs.writeFileSync(path.join(outside, 'target.txt'), 'outside');
  check('confine accepts a real inside path and rejects traversal/absolute',
    verifier.confine(base, 'real/file.txt') !== null &&
    verifier.confine(base, '../escape.txt') === null &&
    verifier.confine(base, path.join(outside, 'target.txt')) === null);
  let linked = true;
  try {
    fs.symlinkSync(outside, path.join(base, 'sneaky'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (_) { linked = false; }
  check('a symlink committed inside the tree cannot smuggle a read/write outside (real-path confinement)' + (linked ? '' : ' [skipped: cannot create links here]'),
    !linked || (verifier.confine(base, 'sneaky/target.txt') === null && verifier.confine(base, 'real/file.txt') !== null));

  // The E7 ReDoS finding: 8 stacked stars measured 7.9 s pre-fix. Post-fix
  // (star-run collapse + cache) the same probe must be effectively instant.
  const t0 = Date.now();
  checkoutLib.matchesAny('a/'.repeat(40) + 'deep-file-name-that-never-matches.txt', ['********x', '**/**/**/**/**/**/**y']);
  const redosMs = Date.now() - t0;
  check('glob compilation is star-collapse-safe (adversarial pattern < 250 ms, was ~7.9 s)', redosMs < 250, redosMs + 'ms');
}

section('13. The mutation check is wired into the integrated round and the CLI');
{
  const vacuous = {
    path: 'test.js',
    find: VACUOUS_ASSERT,
    replace: VACUOUS_ASSERT.replace('assert.strictEqual', 'assert.notStrictEqual'),
    description: 'invert the swallowed assertion',
  };
  const out = verifier.runVerification({
    repoDir: fixture.dir, commit: fixture.base, baseRef: fixture.base,
    manifest: MANIFEST, mutations: [vacuous],
  });
  const mut = out.checks.find((c) => c.check === 'mutation');
  check('runVerification runs the mutation check when mutations are declared', !!mut, JSON.stringify(out.checks.map((c) => c.check)));
  check('the surviving vacuous mutation fails the INTEGRATED round (no deterministic_only_closure)',
    mut && mut.outcome === 'FAIL' && out.outcome === 'FAIL' && out.deterministic_only_closure === false);

  // The CLI accepts and forwards --mutations (the finding: it never did).
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-verifier-cli-'));
  cleanups.push(() => fs.rmSync(scratch, { recursive: true, force: true }));
  fs.writeFileSync(path.join(scratch, 'manifest.json'), JSON.stringify(MANIFEST));
  fs.writeFileSync(path.join(scratch, 'mutations.json'), JSON.stringify([vacuous]));
  const cli = spawnSync(process.execPath, [
    path.join(MASTER, 'verifier', 'verifier.js'),
    '--repo', fixture.dir, '--commit', fixture.base,
    '--manifest', path.join(scratch, 'manifest.json'),
    '--mutations', path.join(scratch, 'mutations.json'),
  ], { encoding: 'utf8', windowsHide: true });
  let cliOut = null;
  try { cliOut = JSON.parse(cli.stdout.slice(0, cli.stdout.lastIndexOf('}') + 1)); } catch (_) { /* parse failure fails below */ }
  check('CLI --mutations reaches the round and flips the exit code to FAIL',
    cli.status === 1 && cliOut && cliOut.checks.some((c) => c.check === 'mutation' && c.outcome === 'FAIL'),
    'exit ' + cli.status + ': ' + (cli.stderr || '').slice(0, 300));
}

section('14. Ruling 4: schema semantic gates (verdict-audit in-schema; casting-record computed)');
{
  const audit = (extra) => Object.assign({
    task_id: 't', verdict: 'APPROVE',
    citation_replay: [{ citation: 'lib.js:2', replayed: true, result: 'MATCHES' }],
    refutation_duty_present: true, cross_family: true, gate_class: true,
    falsification_run: { family: 'openai', outcome: 'SURVIVED' },
    outcome: 'PASS',
  }, extra || {});
  check('a coherent gate-class PASS validates', verifier.validateArtifact('verdict-audit', audit()).outcome === 'PASS',
    JSON.stringify(verifier.validateArtifact('verdict-audit', audit()).violations));
  check('a PASS with refutation_duty_present:false cannot exist',
    verifier.validateArtifact('verdict-audit', audit({ refutation_duty_present: false })).outcome === 'FAIL');
  check('a gate-class PASS with falsification UNAVAILABLE cannot exist (UNAVAILABLE downgrades, never authorizes)',
    verifier.validateArtifact('verdict-audit', audit({ falsification_run: { family: 'openai', outcome: 'UNAVAILABLE' } })).outcome === 'FAIL');
  check('a gate-class PASS with cross_family:false cannot exist',
    verifier.validateArtifact('verdict-audit', audit({ cross_family: false })).outcome === 'FAIL');
  check('the same contradictions on a FAIL outcome remain expressible (the audit can still record them)',
    verifier.validateArtifact('verdict-audit', audit({ outcome: 'FAIL', refutation_duty_present: false, cross_family: false, falsification_run: { family: 'openai', outcome: 'UNAVAILABLE' } })).outcome === 'PASS');

  const record = (extra) => Object.assign({
    task_id: 't', class: 'E2', risk: 'T1', role: 'Builder',
    requested_casting: { vendor: 'anthropic', model: 'Sonnet 5', effort: 'med' },
    served_model: 'Sonnet 5', served_model_mismatch: false,
    bucket: 'AU-all', context_shape: 'packet', status: 'DONE', review_cross_family: true,
  }, extra || {});
  check('an honest casting record validates', verifier.validateArtifact('casting-record', record()).outcome === 'PASS',
    JSON.stringify(verifier.validateArtifact('casting-record', record()).violations));
  check('served≠requested with mismatch:false is refused (the detector is computed, ruling 4)',
    (() => { const r = verifier.validateArtifact('casting-record', record({ served_model: 'GPT-5.6 Luna' })); return r.outcome === 'FAIL' && r.violations.some((v) => /contradicts the computed detector/.test(v)); })());
  check('served≠requested with the flag omitted is refused (a masked P15 incident)',
    (() => { const rec = record({ served_model: 'GPT-5.6 Luna' }); delete rec.served_model_mismatch; const r = verifier.validateArtifact('casting-record', rec); return r.outcome === 'FAIL' && r.violations.some((v) => /omitted/.test(v)); })());
  check('served≠requested honestly flagged validates; UNKNOWN served stays out of the detector',
    verifier.validateArtifact('casting-record', record({ served_model: 'GPT-5.6 Luna', served_model_mismatch: true })).outcome === 'PASS' &&
    (() => { const rec = record({ served_model: 'UNKNOWN' }); delete rec.served_model_mismatch; return verifier.validateArtifact('casting-record', rec).outcome === 'PASS'; })());
}

console.log('\n' + passes + ' passed, ' + failures + ' failed');
