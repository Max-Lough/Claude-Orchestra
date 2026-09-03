#!/usr/bin/env node
/**
 * WO-4 registry loader — loads registry/classes.json and the six §3.5 schemas,
 * and asserts the ownership invariant mechanically (final-plan.md Part 4 +
 * WO-4):
 *
 *   - 23 active classes, 23 primaries: every active class owned by exactly one
 *     primary role, no identifier owned twice, exactly two deterministic
 *     substrates (V0, P0).
 *   - `I1` resolves as a registered alias of I0; no alias collides with an
 *     active identifier.
 *   - The §4.0 decision procedure is closed over the table: every route target
 *     is an active class, every cited discriminator exists and is not retired,
 *     every discriminator pair member resolves (active id, alias id, or a
 *     declared sentinel), and every active class is reachable from some step.
 *   - The schemas carry the mandated required fields (integrity block,
 *     requested_casting / served_model, review.cross_family dispatcher-written,
 *     first-class RECLASSIFY) and their class/risk enums are byte-identical to
 *     the registry's identifiers — the mechanical tie that makes this directory
 *     a single source of truth.
 *
 * Usage:
 *   node registry/load.js            # validate, print a summary, exit 0/1
 *   require('./registry/load.js')    # { load } → { registry, schemas, problems }
 *
 * Same conventions as the test suites: no dependencies, exit-code discipline.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_DIR = __dirname;
const CLASSES_FILE = path.join(REGISTRY_DIR, 'classes.json');
const SCHEMA_DIR = path.join(REGISTRY_DIR, 'schemas');

const EXPECTED_ACTIVE_COUNT = 23;
const EXPECTED_SUBSTRATES = ['V0', 'P0'];
const EXPECTED_SCHEMAS = [
  'order.schema.json',
  'report.schema.json',
  'verdict.schema.json',
  'authorization-packet.schema.json',
  'casting-record.schema.json',
  'verdict-audit.schema.json',
  // WO-14b leg 2 fix round (finding 4): the leg-2a schemas were never
  // registered here, so their class enums could drift from the registry
  // (or from each other) with `node registry/load.js` still reporting zero
  // problems.
  'dispatch-request.schema.json',
  'ticket.schema.json',
];
const CLASS_ID_RE = /^[A-Z][0-9]$/;

function load(baseDir) {
  const dir = baseDir || REGISTRY_DIR;
  const classesFile = path.join(dir, 'classes.json');
  const schemaDir = path.join(dir, 'schemas');
  const problems = [];
  const fail = (msg) => problems.push(msg);

  let registry = null;
  try {
    registry = JSON.parse(fs.readFileSync(classesFile, 'utf8'));
  } catch (e) {
    fail('classes.json unreadable or unparseable: ' + e.message);
    return { registry: null, schemas: {}, problems };
  }

  // ---- risk tiers -------------------------------------------------------
  const tierIds = (registry.riskTiers || []).map((t) => t.id);
  if (tierIds.join(',') !== 'T0,T1,T2,T3') {
    fail('risk tiers must be exactly T0..T3 in order; got [' + tierIds.join(', ') + ']');
  }
  const t3 = (registry.riskTiers || []).find((t) => t.id === 'T3');
  if (!t3 || t3.humanAuthorized !== true) {
    fail('T3 must carry humanAuthorized: true (P13 — no model authorizes a T3 action)');
  }

  // ---- classes: the ownership invariant ---------------------------------
  const classes = registry.classes || [];
  const activeIds = classes.map((c) => c.id);
  if (classes.length !== EXPECTED_ACTIVE_COUNT) {
    fail('expected ' + EXPECTED_ACTIVE_COUNT + ' active classes, found ' + classes.length);
  }
  const seenIds = new Set();
  const seenRoles = new Set();
  for (const c of classes) {
    if (!CLASS_ID_RE.test(c.id || '')) fail('class id malformed: ' + JSON.stringify(c.id));
    if (seenIds.has(c.id)) fail('class identifier owned twice: ' + c.id);
    seenIds.add(c.id);
    if (!c.primaryRole || typeof c.primaryRole !== 'string') {
      fail('class ' + c.id + ' has no primary role');
    } else if (seenRoles.has(c.primaryRole)) {
      fail('role owns two classes: ' + c.primaryRole);
    } else {
      seenRoles.add(c.primaryRole);
    }
    for (const field of ['name', 'casting', 'reviewer', 'escalation']) {
      if (!c[field]) fail('class ' + c.id + ' missing ' + field);
    }
    if (!Array.isArray(c.recallSignals) || c.recallSignals.length === 0) {
      fail('class ' + c.id + ' has no recall signals');
    }
  }
  const substrates = classes.filter((c) => c.substrate === true).map((c) => c.id).sort();
  if (substrates.join(',') !== EXPECTED_SUBSTRATES.slice().sort().join(',')) {
    fail('substrates must be exactly ' + EXPECTED_SUBSTRATES.join('+') + '; got [' + substrates.join(', ') + ']');
  }

  // ---- aliases ----------------------------------------------------------
  const aliases = registry.aliases || [];
  const aliasIds = aliases.map((a) => a.id);
  const seenAliasIds = new Set();
  for (const a of aliases) {
    if (seenAliasIds.has(a.id)) fail('alias identifier registered twice: ' + a.id);
    seenAliasIds.add(a.id);
    if (seenIds.has(a.id)) fail('alias collides with an active identifier: ' + a.id);
    if (!seenIds.has(a.resolvesTo)) fail('alias ' + a.id + ' resolves to unknown class ' + a.resolvesTo);
  }
  const i1 = aliases.find((a) => a.id === 'I1');
  if (!i1 || i1.resolvesTo !== 'I0') {
    fail('`I1` must be registered as an alias resolving to I0 (2026-08-29 final ruling)');
  }

  // ---- discriminators ---------------------------------------------------
  const discs = registry.discriminators || [];
  const discById = new Map();
  const sentinels = new Set(Object.keys(registry.pairSentinels || {}));
  for (const d of discs) {
    if (discById.has(d.id)) fail('discriminator id duplicated: ' + d.id);
    discById.set(d.id, d);
    for (const member of d.pair || []) {
      const known = seenIds.has(member) || aliasIds.includes(member) || sentinels.has(member);
      if (!known) fail('discriminator ' + d.id + ' names unknown pair member ' + JSON.stringify(member));
      // A live discriminator may not route on a retired identifier.
      if (!d.retired && aliasIds.includes(member)) {
        fail('live discriminator ' + d.id + ' routes on retired identifier ' + member);
      }
    }
  }

  // ---- §4.0 procedure ---------------------------------------------------
  const steps = (registry.procedure && registry.procedure.steps) || [];
  const stepNums = steps.map((s) => s.step);
  if (stepNums.join(',') !== '1,2,3,4,5,6,7') {
    fail('procedure steps must be exactly 1..7 in order; got [' + stepNums.join(', ') + ']');
  }
  const routed = new Set();
  for (const s of steps) {
    for (const clause of s.clauses || []) {
      for (const target of clause.route || []) {
        if (!seenIds.has(target)) {
          fail('step ' + s.step + ' routes to unknown or non-active class ' + JSON.stringify(target));
        }
        routed.add(target);
      }
      if ((clause.route || []).length === 0 && !clause.fallThrough && !clause.residual) {
        fail('step ' + s.step + ' has a clause that neither routes nor falls through: ' + JSON.stringify(clause.test).slice(0, 60));
      }
      for (const cited of clause.discriminators || []) {
        const d = discById.get(cited);
        if (!d) fail('step ' + s.step + ' cites unknown discriminator ' + cited);
        else if (d.retired) fail('step ' + s.step + ' cites retired discriminator ' + cited);
      }
    }
  }
  for (const id of activeIds) {
    if (!routed.has(id)) fail('active class unreachable from the §4.0 procedure: ' + id);
  }

  // ---- error stance -----------------------------------------------------
  const es = registry.errorStance || {};
  if (es.classIsRoutingHypothesis !== true) fail('errorStance.classIsRoutingHypothesis must be true (final ruling)');
  if (!es.reclassify || es.reclassify.reportStatus !== 'RECLASSIFY') {
    fail('errorStance must define the first-class RECLASSIFY report status');
  }
  if (!es.hops || es.hops.routine !== 1 || es.hops.escalateAtHop !== 2) {
    fail('errorStance hops must be routine:1, escalateAtHop:2');
  }

  // ---- schemas ----------------------------------------------------------
  const schemas = {};
  const schemaIds = new Set();
  for (const name of EXPECTED_SCHEMAS) {
    const file = path.join(schemaDir, name);
    try {
      schemas[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      fail('schema ' + name + ' unreadable or unparseable: ' + e.message);
      continue;
    }
    const id = schemas[name].$id;
    if (!id) fail('schema ' + name + ' has no $id');
    else if (schemaIds.has(id)) fail('schema $id duplicated: ' + id);
    else schemaIds.add(id);
  }

  const requireFields = (name, fields) => {
    const s = schemas[name];
    if (!s) return;
    const req = s.required || [];
    for (const f of fields) {
      if (!req.includes(f)) fail(name + ' must require ' + f);
    }
  };
  requireFields('order.schema.json', ['task_id', 'class', 'risk', 'requested_casting', 'author_family', 'co_author_families', 'integrity_nonce']);
  requireFields('report.schema.json', ['status', 'requested_casting', 'author_family', 'co_author_families', 'served_model', 'integrity']);
  requireFields('verdict.schema.json', ['review']);
  requireFields('authorization-packet.schema.json', ['action', 'risk', 'dry_run_result', 'rollback_script', 'rollback_restore_test_result', 'invariant_comparison', 'blast_radius', 'approver', 'approved_at']);
  // review_policy/close_mode joined the required set on 2026-09-02 (Verifier-
  // only close): a record that omits them cannot say which review band closed
  // it, which is precisely the ledger gap the oracle could not answer.
  requireFields('casting-record.schema.json', ['task_id', 'class', 'requested_casting', 'served_model', 'review_cross_family', 'review_policy', 'close_mode']);
  requireFields('verdict-audit.schema.json', ['citation_replay', 'refutation_duty_present', 'cross_family', 'outcome']);

  const verdictSchema = schemas['verdict.schema.json'];
  if (verdictSchema) {
    const review = (verdictSchema.properties || {}).review || {};
    if (!(review.required || []).includes('cross_family')) {
      fail('verdict.schema.json review block must require cross_family (dispatcher-written, §3.4)');
    }
  }
  const reportSchema = schemas['report.schema.json'];
  if (reportSchema) {
    const statusEnum = (((reportSchema.properties || {}).status) || {}).enum || [];
    if (!statusEnum.includes('RECLASSIFY')) {
      fail('report.schema.json status enum must include RECLASSIFY (final ruling)');
    }
    const conditional = (reportSchema.allOf || []).some(
      (r) => r.if && r.if.properties && r.if.properties.status &&
             r.if.properties.status.const === 'RECLASSIFY' &&
             r.then && (r.then.required || []).includes('reclassify')
    );
    if (!conditional) fail('report.schema.json must make reclassify required when status is RECLASSIFY');
  }

  // Class and risk enums in the schemas must be byte-identical to the
  // registry — compared IN ORDER, as the claim says, not sorted first (a
  // sorted compare would bless a reordered enum as "identical").
  const activeInOrder = activeIds.join(',');
  const checkEnum = (name, getEnum, expected, label) => {
    const s = schemas[name];
    if (!s) return;
    const values = getEnum(s);
    if (!values) { fail(name + ' is missing its ' + label + ' enum'); return; }
    if (values.join(',') !== expected) {
      fail(name + ' ' + label + ' enum diverges from the registry (byte-identical in registry order required)');
    }
  };
  checkEnum('order.schema.json', (s) => (s.properties.class || {}).enum, activeInOrder, 'class');
  checkEnum('casting-record.schema.json', (s) => (s.properties.class || {}).enum, activeInOrder, 'class');
  checkEnum('dispatch-request.schema.json', (s) => (s.properties.class || {}).enum, activeInOrder, 'class');
  checkEnum('ticket.schema.json', (s) => (s.properties.class || {}).enum, activeInOrder, 'class');
  checkEnum('report.schema.json', (s) => ((s.properties.recommended_next_class || {}).enum), activeInOrder, 'recommended_next_class');
  checkEnum('report.schema.json', (s) => (((s.properties.reclassify || {}).properties || {}).recommended_class || {}).enum, activeInOrder, 'reclassify.recommended_class');
  const tiersInOrder = 'T0,T1,T2,T3';
  checkEnum('order.schema.json', (s) => (s.properties.risk || {}).enum, tiersInOrder, 'risk');
  checkEnum('casting-record.schema.json', (s) => (s.properties.risk || {}).enum, tiersInOrder, 'risk');

  // The two closure-band enums are NOT registry-derived (their source of
  // truth is router.js's reviewPolicy() and bridge/close.js's three close
  // paths), so they are pinned literally here: a silently widened enum is a
  // silently widened review exemption.
  const castingRecord = schemas['casting-record.schema.json'];
  if (castingRecord) {
    const props = castingRecord.properties || {};
    for (const [field, expected] of [
      ['review_policy', 'mandatory,preferred,none'],
      ['close_mode', 'verifier-only,reviewed,recon'],
    ]) {
      const values = (props[field] || {}).enum;
      if (!values) fail('casting-record.schema.json is missing its ' + field + ' enum');
      else if (values.join(',') !== expected) {
        fail('casting-record.schema.json ' + field + ' enum must be exactly [' + expected + '] in that order');
      }
    }
    if (castingRecord.additionalProperties !== false) {
      fail('casting-record.schema.json must keep additionalProperties:false — an unknown field is an unaudited close');
    }
  }

  return { registry, schemas, problems };
}

module.exports = { load, CLASSES_FILE, SCHEMA_DIR, EXPECTED_SCHEMAS };

if (require.main === module) {
  const { registry, problems } = load();
  if (problems.length) {
    console.error('REGISTRY INVALID — ' + problems.length + ' violation(s):');
    for (const p of problems) console.error('  - ' + p);
    process.exitCode = 1;
  } else {
    const n = registry.classes.length;
    const a = registry.aliases.map((x) => x.id + '→' + x.resolvesTo).join(', ');
    console.log(
      'registry OK: ' + n + ' active classes, ' + n + ' primaries, aliases [' + a + '], ' +
      registry.discriminators.filter((d) => !d.retired).length + ' live discriminators (+' +
      registry.discriminators.filter((d) => d.retired).length + ' retired), §4.0 closed over the table, ' +
      EXPECTED_SCHEMAS.length + ' schemas in sync'
    );
  }
}
