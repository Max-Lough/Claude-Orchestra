#!/usr/bin/env node
/**
 * WO-4 registry tests.
 *
 *   node tests/registry.test.js
 *
 * Two halves:
 *
 *   1. The shipped registry loads clean: 23 active classes, 23 primaries,
 *      `I1` aliased to I0, the §4.0 procedure closed over the table, the six
 *      §3.5 schemas present with the mandated required fields and their
 *      class/risk enums byte-identical to the registry.
 *
 *   2. Tamper tests — each seeded corruption of a scratch copy must be caught
 *      by the loader. The invariant is only real if breaking it fails the
 *      load; a checker that cannot fail is decoration.
 *
 * Same conventions as the other suites: no dependencies, exit-code discipline
 * enforced by an exit handler, and a suite that ran no checks fails.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MASTER = path.resolve(__dirname, '..');
const { load, EXPECTED_SCHEMAS } = require(path.join(MASTER, 'registry', 'load.js'));
const REGISTRY_DIR = path.join(MASTER, 'registry');

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

// Copy the registry into a scratch dir, apply a mutation to the parsed
// classes.json (or a named schema), and return the loader's problems.
function tamper(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-registry-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  const registry = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, 'classes.json'), 'utf8'));
  const schemas = {};
  for (const name of EXPECTED_SCHEMAS) {
    schemas[name] = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, 'schemas', name), 'utf8'));
  }
  mutate(registry, schemas);
  fs.writeFileSync(path.join(dir, 'classes.json'), JSON.stringify(registry), 'utf8');
  for (const name of EXPECTED_SCHEMAS) {
    fs.writeFileSync(path.join(dir, 'schemas', name), JSON.stringify(schemas[name]), 'utf8');
  }
  return load(dir).problems;
}

// ---------------------------------------------------------------- the tests

section('1. The shipped registry loads clean');
{
  const { registry, schemas, problems } = load();
  check('zero invariant violations', problems.length === 0, problems.join('\n'));
  check('23 active classes', registry && registry.classes.length === 23);
  check('23 distinct primaries', registry && new Set(registry.classes.map((c) => c.primaryRole)).size === 23);
  check('I1 aliased to I0', registry && registry.aliases.some((a) => a.id === 'I1' && a.resolvesTo === 'I0'));
  check('discriminator B retired', registry && registry.discriminators.some((d) => d.id === 'B' && d.retired === true));
  check('eight schemas loaded (finding 4: dispatch-request + ticket registered)', Object.keys(schemas).length === 8);
  check(
    'RECLASSIFY is a first-class report status',
    schemas['report.schema.json'] &&
      schemas['report.schema.json'].properties.status.enum.includes('RECLASSIFY')
  );
  const t3 = registry && registry.riskTiers.find((t) => t.id === 'T3');
  check('T3 is human-authorized', !!(t3 && t3.humanAuthorized === true));
}

section('2. Every active class is reachable from §4.0 (spot re-derivation)');
{
  const { registry } = load();
  const routed = new Set();
  for (const s of registry.procedure.steps) {
    for (const c of s.clauses) for (const t of c.route || []) routed.add(t);
  }
  for (const id of ['I0', 'E4', 'E5', 'E6', 'V0', 'P0']) {
    check(id + ' reachable', routed.has(id));
  }
  check('nothing routes to the retired I1', !routed.has('I1'));
}

section('3. Tampering is caught — the invariant can actually fail');
{
  check(
    'duplicate primary role',
    tamper((r) => { r.classes[1].primaryRole = r.classes[0].primaryRole; }).length > 0
  );
  check(
    'dropped class (count breaks)',
    tamper((r) => { r.classes.pop(); }).length > 0
  );
  check(
    'duplicated identifier',
    tamper((r) => { r.classes[2].id = r.classes[3].id; }).length > 0
  );
  check(
    'dangling alias target',
    tamper((r) => { r.aliases[0].resolvesTo = 'Z9'; }).length > 0
  );
  check(
    'alias colliding with an active id',
    tamper((r) => { r.aliases.push({ id: 'E2', resolvesTo: 'I0' }); }).length > 0
  );
  check(
    'procedure routing to a retired identifier',
    tamper((r) => { r.procedure.steps[1].clauses[0].route = ['I1']; }).length > 0
  );
  check(
    'procedure citing the retired discriminator B',
    tamper((r) => { r.procedure.steps[2].clauses[3].discriminators = ['B']; }).length > 0
  );
  check(
    'unreachable class (route target removed everywhere)',
    tamper((r) => {
      for (const s of r.procedure.steps) {
        for (const c of s.clauses) c.route = (c.route || []).filter((t) => t !== 'E6');
      }
    }).length > 0
  );
  check(
    'schema class enum drifting from the registry',
    tamper((r, s) => { s['order.schema.json'].properties.class.enum.push('Z9'); }).length > 0
  );
  check(
    'report losing RECLASSIFY',
    tamper((r, s) => {
      const e = s['report.schema.json'].properties.status.enum;
      e.splice(e.indexOf('RECLASSIFY'), 1);
    }).length > 0
  );
  check(
    'verdict losing dispatcher-written cross_family',
    tamper((r, s) => { s['verdict.schema.json'].properties.review.required = []; }).length > 0
  );
  check(
    'order losing the integrity nonce',
    tamper((r, s) => {
      const req = s['order.schema.json'].required;
      req.splice(req.indexOf('integrity_nonce'), 1);
    }).length > 0
  );
  check(
    'T3 losing human authorization',
    tamper((r) => { delete r.riskTiers[3].humanAuthorized; }).length > 0
  );
  check(
    'error stance losing RECLASSIFY',
    tamper((r) => { r.errorStance.reclassify.reportStatus = 'REROUTE'; }).length > 0
  );
  check(
    'duplicate alias identifier (a second I1→I0) is refused',
    tamper((r) => { r.aliases.push({ id: 'I1', resolvesTo: 'I0' }); }).some((p) => /registered twice/.test(p))
  );
  check(
    'a REORDERED class enum is caught — byte-identical means in registry order, not merely the same set',
    tamper((r, s) => { s['order.schema.json'].properties.class.enum.reverse(); }).some((p) => /diverges from the registry/.test(p))
  );
  check(
    'finding 4: dispatch-request.schema.json class enum drifting from the registry fails closed (was previously unregistered — zero problems, 6 schemas in sync)',
    tamper((r, s) => { s['dispatch-request.schema.json'].properties.class.enum.push('Z9'); }).some((p) => /dispatch-request\.schema\.json.*class.*diverges from the registry/.test(p))
  );
  check(
    'finding 4: ticket.schema.json class enum drifting from the registry fails closed',
    tamper((r, s) => { s['ticket.schema.json'].properties.class.enum.push('Z9'); }).some((p) => /ticket\.schema\.json.*class.*diverges from the registry/.test(p))
  );
  // 2026-09-02 (Verifier-only close): the casting record now has to say which
  // review band closed the ticket. Each of these is a way that guarantee
  // could be quietly removed.
  check(
    'casting-record dropping review_policy from required is caught',
    tamper((r, s) => {
      s['casting-record.schema.json'].required = s['casting-record.schema.json'].required.filter((f) => f !== 'review_policy');
    }).some((p) => /must require review_policy/.test(p))
  );
  check(
    'casting-record dropping close_mode from required is caught',
    tamper((r, s) => {
      s['casting-record.schema.json'].required = s['casting-record.schema.json'].required.filter((f) => f !== 'close_mode');
    }).some((p) => /must require close_mode/.test(p))
  );
  check(
    'a WIDENED close_mode enum is caught — a new close mode is a new review exemption',
    tamper((r, s) => { s['casting-record.schema.json'].properties.close_mode.enum.push('trust-me'); })
      .some((p) => /close_mode enum must be exactly/.test(p))
  );
  check(
    'a widened review_policy enum is caught',
    tamper((r, s) => { s['casting-record.schema.json'].properties.review_policy.enum.push('skip'); })
      .some((p) => /review_policy enum must be exactly/.test(p))
  );
  check(
    'casting-record losing additionalProperties:false is caught',
    tamper((r, s) => { s['casting-record.schema.json'].additionalProperties = true; })
      .some((p) => /additionalProperties:false/.test(p))
  );
}

console.log('\n' + passes + ' passed, ' + failures + ' failed');
