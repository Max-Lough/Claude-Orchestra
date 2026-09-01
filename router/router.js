#!/usr/bin/env node
/**
 * WO-6 router — route(class) → role, cast(role, bucket_state) → casting,
 * reviewer(author_families, risk) → casting, the pool-state (degradation)
 * machine, the pre-dispatch AU-O gate, and automatic Q0 creation.
 *
 * Sources of truth, in order:
 *   - registry/classes.json (WO-4) — the taxonomy; loaded through
 *     registry/load.js and FAILING CLOSED on any ownership-invariant
 *     violation (the registry README's contract for WO-6).
 *   - router/castings.json — the Part-2 casting tables, the §3.4 review
 *     matrix, the §5.5 degradation ladder, and the seat-19 Q0 triggers.
 *
 * Load-time cross-checks tie the two: every active class must have exactly
 * one casting-table role whose name matches the registry's primary, every
 * rung's vendor must match its model's family, hard never-rules must not be
 * violated by any rung of their own role, and efforts must sit on the
 * vendor's ladder. Any drift refuses to construct a router at all.
 *
 * Structural guarantees the tests prove (the WO-6 unit proof):
 *   - no-self-family: reviewer() can never return a casting whose family is
 *     in the author/co-author set (asserted again at return, defensively);
 *   - no mandatory-class dispatch produces a same-family closing verdict
 *     under any bucket state including Red/exhausted — mandatory review that
 *     cannot run cross-family returns DOES_NOT_CLOSE (wait / named human /
 *     park), never a casting;
 *   - context-shape violations are rejected at dispatch;
 *   - every rung yields its documented casting set;
 *   - every trigger-matching implementation order spawns a Director-created
 *     Q0 companion, and a suppressed required Q0 blocks the dispatch.
 *
 * No dependencies; same conventions as registry/load.js and verifier/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROUTER_DIR = __dirname;
const CASTINGS_FILE = path.join(ROUTER_DIR, 'castings.json');
const REGISTRY_DIR = path.join(ROUTER_DIR, '..', 'registry');

const STATES = ['Green', 'Amber', 'Orange', 'Red', 'Exhausted'];
const STATE_ORDER = { Green: 0, Amber: 1, Orange: 2, Red: 3, Exhausted: 4 };
const FAMILIES = ['anthropic', 'openai'];
const AUTHOR_FAMILIES = ['anthropic', 'openai', 'human'];

// WO-14b readiness-repair tranche: twelve roles retired from castings.json,
// merged into Builder/Investigator or (A1) a documented workflow. Their
// roster/*.md files are deleted, and (WO-14b leg 2 fix round, finding 8)
// their router/charters.json entries are deleted too — the charter
// cross-check below is strict: exactly the 11 live roles, no tolerance list.
// ---------------------------------------------------------------------------
// Pool-state machine (§5.5). Pure: one Quartermaster reading in, one state
// out. Reserve breach and observed throttle force Red regardless of the
// remaining fraction; `exhausted` is the exhaustion-matrix state past Red.
function poolState(reading, ladder) {
  const t = (ladder && ladder.thresholds) || { amberBelow: 0.4, orangeBelow: 0.2, redBelow: 0.08 };
  if (typeof reading === 'string') {
    if (!STATES.includes(reading)) throw new Error('unknown pool state: ' + reading);
    return reading;
  }
  if (!reading || typeof reading !== 'object') throw new Error('poolState needs a reading or a state name');
  if (reading.exhausted) return 'Exhausted';
  if (reading.throttleObserved || reading.reserveBreached) return 'Red';
  const f = reading.remainingFraction;
  if (typeof f !== 'number' || !(f >= 0) || f > 1) {
    throw new Error('poolState reading needs remainingFraction in [0,1] (fail closed, not open)');
  }
  if (f < t.redBelow) return 'Red';
  if (f < t.orangeBelow) return 'Orange';
  if (f < t.amberBelow) return 'Amber';
  return 'Green';
}

// P0's dynamic review reserve (seat 24), with WO-2's measured floor inputs.
function requiredReserve(forecast, reserveCfg) {
  const cfg = reserveCfg || { uncertaintyBuffer: 0.3, floorFractionOfBucket: 0.08, twoGateClassReviewsCostFraction: 0.003 };
  const m = (forecast && forecast.mandatoryReviewDraw) || 0;
  const i = (forecast && forecast.incidentDraw) || 0;
  const dynamic = (m + i) * (1 + cfg.uncertaintyBuffer);
  const floor = Math.max(cfg.floorFractionOfBucket, cfg.twoGateClassReviewsCostFraction);
  // KNOWN PARITY (finding C, report-only — a calibration decision reserved
  // to the owner, not changed here): under the WO-2 default forecast, the
  // dynamic term (0.03 + 0) × 1.3 ≈ 0.039 sits below floorFractionOfBucket
  // (0.08), so the floor governs and requiredReserve(defaultForecast()) ===
  // poolStateLadder.thresholds.redBelow exactly. belowReserve then fires
  // (quartermaster.js: remainingFraction < requiredReserve) at precisely the
  // same boundary poolState() already calls Red — the reserve gate carries
  // NO independent signal past what the pool-state ladder already gives,
  // under the default forecast. The reserve gets a genuine lead over
  // redBelow only under an override forecast busy enough to push the
  // dynamic term above the floor (see requiredReserve.test pin).
  return Math.max(dynamic, floor);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // Math.imul, not `h * 0x01000193`: the plain float64 multiply can reach
    // ~7.2e16 (0xffffffff * 0x01000193), 8000x past 2^53 — every digest is
    // wrong past the point float64 can no longer represent the integer
    // product exactly, which is effectively every digest (finding H). imul
    // does the multiply in true 32-bit integer arithmetic and truncates by
    // construction, matching the FNV-1a spec's implicit mod 2^32.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
function createRouter(opts) {
  const options = opts || {};
  const registryDir = options.registryDir || REGISTRY_DIR;
  const castingsFile = options.castingsFile || CASTINGS_FILE;

  // The registry fails closed: a router over a taxonomy that violates the
  // ownership invariant must not exist at all.
  const { load } = require(path.join(registryDir, 'load.js'));
  const loaded = load(options.registryBaseDir);
  if (loaded.problems.length > 0) {
    throw new Error('router refused: registry invalid (' + loaded.problems.length + ' violation(s)):\n  - ' + loaded.problems.join('\n  - '));
  }
  const registry = loaded.registry;
  const registrySchemas = loaded.schemas || {};

  let castings;
  try {
    castings = JSON.parse(fs.readFileSync(castingsFile, 'utf8'));
  } catch (e) {
    throw new Error('router refused: castings.json unreadable or unparseable: ' + e.message);
  }

  const problems = [];
  const fail = (m) => problems.push(m);
  // Own-property lookup — bare bracket reads on JSON-shaped maps resolve
  // Object.prototype keys ('constructor', '__proto__', …) as hits; every
  // name-keyed lookup in this file goes through this instead.
  const hasOwn = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

  // ---- family / bucket lookups ------------------------------------------
  const familyByModel = new Map();
  for (const fam of FAMILIES) {
    for (const model of (castings.families || {})[fam] || []) familyByModel.set(model, fam);
  }
  const familyOf = (model) => familyByModel.get(model) || null;
  const bucketsFor = (model) => (hasOwn(castings.modelBuckets, model) ? castings.modelBuckets[model] : null);

  // A single per-casting-row validator (finding F): castings.roles used to
  // be the ONLY table this cross-check covered — a hand-edited reviewMatrix
  // or degradedSameFamilyCandidates row (unknown model, vendor/family
  // mismatch, off-ladder effort) loaded clean and only surfaced when
  // reviewer() actually reached that row at call time. Every casting-shaped
  // row this file trusts — a role's rung, a review-matrix lane, a degraded
  // candidate — now goes through the SAME checks. Returns the row's model
  // family (or null if the row is incomplete or names an unknown model), so
  // a caller that needs it (the same-family cross-check below) doesn't
  // re-derive it.
  function validateCastingRow(label, row) {
    if (!row || !row.vendor || !row.model || !row.effort) { fail(label + ' incomplete'); return null; }
    const fam = familyOf(row.model);
    if (!fam) fail(label + ' names unknown model ' + row.model);
    else if (fam !== row.vendor) fail(label + ' vendor ' + row.vendor + ' disagrees with model family ' + fam);
    if (!bucketsFor(row.model)) fail(label + ' model has no bucket mapping: ' + row.model);
    const ladder = (castings.effortLadders || {})[row.vendor] || [];
    const specials = (castings.effortLadders || {}).specials || [];
    const parts = String(row.effort).split('–'); // en-dash range
    for (const p of parts) {
      if (!ladder.includes(p) && !specials.includes(p)) {
        fail(label + ' effort ' + JSON.stringify(row.effort) + ' is off the ' + row.vendor + ' ladder');
      }
    }
    return fam;
  }

  // ---- cross-check castings against the registry ------------------------
  const activeById = new Map(registry.classes.map((c) => [c.id, c]));
  const roles = castings.roles || {};
  const roleNames = Object.keys(roles);
  const classToRole = new Map();
  for (const name of roleNames) {
    const role = roles[name];
    const cls = activeById.get(role.class);
    if (!cls) { fail('role ' + name + ' claims unknown class ' + role.class); continue; }
    if (cls.primaryRole !== name) fail('role ' + name + ' claims class ' + role.class + ' owned by ' + cls.primaryRole);
    if (classToRole.has(role.class)) fail('class cast twice in the casting tables: ' + role.class);
    classToRole.set(role.class, name);
    if (!Array.isArray(role.contextShapes) || role.contextShapes.length === 0) {
      fail('role ' + name + ' declares no context shapes');
    } else {
      for (const s of role.contextShapes) {
        if (!(castings.contextShapes || []).includes(s)) fail('role ' + name + ' declares unknown context shape ' + s);
      }
    }
    const never = new Set(role.never || []);
    for (const [rungName, rung] of Object.entries(role.rungs || {})) {
      const label = name + '.' + rungName;
      if (!rung.vendor || !rung.model || !rung.effort) { fail(label + ' incomplete'); continue; }
      validateCastingRow(label, rung);
      if (never.has(rung.model)) fail(label + ' violates the role’s own never-rule: ' + rung.model);
    }
    if (!role.computed && !role.substrate && Object.keys(role.rungs || {}).length === 0) {
      fail('role ' + name + ' has no rungs and is neither computed nor a substrate');
    }
  }
  // ---- WO-14b merged classes: a class may be routed by a mergedClasses
  // entry instead of owned by a role — a retired-workflow class (A1) names a
  // `workflow` and no role; a merged-into-a-role class (N0/N1/N2/M0 →
  // Investigator, E0/E1/E3/E5/E6/E8/D0 → Builder) names the target role, an
  // optional default `tier` (Builder-tiered targets only) and the `mode`
  // (the former class id) dispatch() reports. A class owned by BOTH a role
  // and mergedClasses, or neither, fails closed — drift still refuses.
  const mergedClasses = castings.mergedClasses || {};
  for (const id of Object.keys(mergedClasses)) {
    if (id === '$comment') continue;
    const m = mergedClasses[id];
    if (classToRole.has(id)) fail('class ' + id + ' is both owned by a role and listed in mergedClasses');
    if (m.workflow !== undefined) continue;
    if (!m.role || !hasOwn(roles, m.role)) { fail('mergedClasses.' + id + ' targets unknown role ' + JSON.stringify(m.role)); continue; }
    if (m.tier !== undefined && !((roles[m.role].tiers || {})[m.tier])) {
      fail('mergedClasses.' + id + ' names tier ' + JSON.stringify(m.tier) + ' that ' + m.role + ' does not have');
    }
    // Findings 6/7 (WO-14b leg 2 fix round): contextShapesOnly is an exact
    // replacement set (never additive with contextShapesAllowed on the same
    // entry — that would make the "only" a lie), and every shape named by
    // either must be a real contextShapes value.
    if (m.contextShapesOnly !== undefined && m.contextShapesAllowed !== undefined) {
      fail('mergedClasses.' + id + ' declares both contextShapesOnly and contextShapesAllowed — pick one (only replaces, allowed widens)');
    }
    for (const shape of [].concat(m.contextShapesOnly || [], m.contextShapesAllowed || [])) {
      if (!castings.contextShapes.includes(shape)) fail('mergedClasses.' + id + ' names unknown context shape ' + JSON.stringify(shape));
    }
    if (m.unavailable !== undefined && (typeof m.unavailable !== 'object' || Array.isArray(m.unavailable))) {
      fail('mergedClasses.' + id + '.unavailable must be an object map of medium -> reason');
    }
  }
  for (const c of registry.classes) {
    if (classToRole.has(c.id)) continue;
    if (hasOwn(mergedClasses, c.id)) continue;
    fail('active class has no casting-table entry: ' + c.id);
  }
  const q0cfg = castings.q0Triggers || {};
  for (const id of [].concat(q0cfg.classes || [], q0cfg.sourceChangeClasses || [], (q0cfg.calibrationSample || {}).classes || [])) {
    if (!activeById.has(id)) fail('Q0 trigger names unknown class ' + id);
  }
  // Ruling 3a (WO-8): the order schema's `touches` enum must equal the union
  // of the Q0 touch triggers and the security trigger list — a touch area the
  // schema rejects is an unreachable trigger, because no schema-valid order
  // could ever carry the field that fires it.
  {
    const orderSchema = registrySchemas['order.schema.json'] || {};
    const touchesEnum = (((orderSchema.properties || {}).touches || {}).items || {}).enum;
    const touchUnion = [...new Set([].concat(q0cfg.touchAreas || [], castings.securityTriggerList || []))].sort();
    if (!Array.isArray(touchesEnum)) {
      fail('order.schema.json must declare a typed `touches` enum — the Q0/security touch triggers read that field');
    } else {
      // Element-wise, never joined (R0-EX4 MAJOR): any join separator is
      // collision-prone the moment an entry can contain it — unequal sets
      // must never compare equal on a serialization accident.
      const sortedEnum = touchesEnum.slice().sort();
      if (sortedEnum.length !== touchUnion.length || sortedEnum.some((v, i) => v !== touchUnion[i])) {
        fail('order.schema.json touches enum diverges from q0Triggers.touchAreas ∪ securityTriggerList');
      }
    }
  }
  const rm = castings.reviewMatrix || {};
  for (const fam of ['anthropic', 'openai', 'human']) {
    if (!rm[fam]) fail('review matrix missing the ' + fam + ' author row');
  }
  // Every reviewMatrix[fam][tier] row — including the nested
  // .qualified/.untilQualified (anthropic T1) and .secondOpinion (human T3)
  // shapes — through the same validator as a role's rung (finding F), plus
  // the no-self-family invariant checked in the TABLE, not only defensively
  // at reviewer()'s return: an anthropic-author row naming an anthropic
  // model (or an openai-author row naming an openai model) is a same-family
  // row baked into the source of truth, which no runtime re-check catches
  // until reviewer() happens to be called for that exact lane.
  for (const fam of ['anthropic', 'openai', 'human']) {
    const famRows = rm[fam] || {};
    for (const [tier, row] of Object.entries(famRows)) {
      const label = 'reviewMatrix.' + fam + '.' + tier;
      const subRows = row && (row.qualified || row.untilQualified)
        ? [['qualified', row.qualified], ['untilQualified', row.untilQualified]]
        : [[null, row]];
      for (const [subName, subRow] of subRows) {
        const subLabel = subName ? label + '.' + subName : label;
        const rowFam = validateCastingRow(subLabel, subRow);
        if ((fam === 'anthropic' || fam === 'openai') && rowFam === fam) {
          fail(subLabel + ' names a same-family (' + fam + ') model ' + subRow.model + ' — the review matrix must never table a same-family row');
        }
      }
      if (row && row.secondOpinion) validateCastingRow(label + '.secondOpinion', row.secondOpinion);
    }
  }
  const degradedCandidates = rm.degradedSameFamilyCandidates || {};
  for (const fam of Object.keys(degradedCandidates)) {
    const list = Array.isArray(degradedCandidates[fam]) ? degradedCandidates[fam] : [];
    list.forEach((cand, i) => {
      const label = 'reviewMatrix.degradedSameFamilyCandidates.' + fam + '[' + i + ']';
      const rowFam = validateCastingRow(label, cand);
      // Finding F (MAJOR, fixed): validateCastingRow alone only checks a
      // row's OWN internal consistency (vendor agrees with ITS OWN model's
      // family) — it never checked the row against the KEY it is filed
      // under. An `anthropic` key holding valid, internally-consistent
      // OpenAI/Terra fields (vendor: 'openai', model: 'GPT-5.6 Terra')
      // constructed cleanly under the old check, and degradedPath() trusts
      // the outer key as the reviewer's family without re-deriving it from
      // the model actually served — an unattributed preferred review then
      // returned Terra while reporting reviewerFamily:'anthropic' and
      // review_cross_family:false: false metadata. A row whose model names
      // an unknown model, or is otherwise incomplete, is already reported by
      // validateCastingRow above (rowFam is null) — nothing further to add.
      if (rowFam && rowFam !== fam) {
        fail(label + ' is filed under degradedSameFamilyCandidates.' + fam + ' but names a ' + rowFam + ' model (' + cand.model + ') — a degraded-candidate\'s actual family must equal the key it is filed under');
      }
    });
  }
  const redTeam = roles['Red Team'];
  if (redTeam && !(redTeam.never || []).includes('Fable 5')) fail('Red Team must carry the never-Fable hard route-filter');
  const conductor = roles['Conductor'];
  if (conductor && !(conductor.never || []).includes('Opus 5')) fail('Conductor must carry the never-Opus rule');

  // ---- seat charters (the live intake filters, Part 2 + error stance) ----
  let charters;
  try {
    charters = JSON.parse(fs.readFileSync(options.chartersFile || path.join(path.dirname(castingsFile), 'charters.json'), 'utf8'));
  } catch (e) {
    fail('charters.json unreadable or unparseable: ' + e.message);
  }
  if (charters) {
    for (const name of roleNames) {
      const ch = (charters.charters || {})[name];
      if (!ch) { fail('role ' + name + ' has no charter entry'); continue; }
      if (ch.class !== roles[name].class) fail('charter for ' + name + ' claims class ' + ch.class + ', casting table says ' + roles[name].class);
      if (!ch.owns || !ch.purpose) fail('charter for ' + name + ' missing owns/purpose');
      if (!ch.substrate && (!Array.isArray(ch.mustNotReceive) || ch.mustNotReceive.length === 0)) {
        fail('charter for ' + name + ' has an empty must-not-receive filter');
      }
    }
    for (const name of Object.keys(charters.charters || {})) {
      // WO-14b leg 2 fix round (finding 8): the retired roles' charter
      // entries are deleted from charters.json itself now — no tolerance
      // list. Any name that is not a live role (an extra, or a stale
      // retired-role leftover) fails closed, same as a missing charter does
      // above.
      if (!roles[name]) fail('charter names unknown role ' + name);
    }
  }

  // ---- WO-14 alias layer (§6.6: alias layer before any rename) -----------
  // Every §6.6 retired name must be present — a map that parses but lacks
  // the aliases (or a name) fails CLOSED at construction, because the kill
  // switch's rollback direction depends on the map existing.
  const REQUIRED_ALIASES = [
    'executor', 'executor-heavy', 'executor-heavy-xhigh', 'executor-codex',
    'executor-codex-heavy', 'reviewer', 'reviewer-codex', 'scout', 'detective',
    'modeler', 'architect-claude', 'architect-claude-xhigh', 'architect-claude-max',
    'architect-codex', 'planner-gpt', 'plan-synthesizer',
  ];
  const ALIAS_PINS = { 'detective': 'read-only', 'scout': 'read-only' }; // §6.6: detective → Investigator(read-only pinned); WO-14b: scout → Investigator(N0 mode, read-only pin carried)
  let seatAliases;
  try {
    seatAliases = JSON.parse(fs.readFileSync(options.aliasesFile || path.join(path.dirname(castingsFile), 'aliases.json'), 'utf8'));
  } catch (e) {
    fail('aliases.json unreadable or unparseable: ' + e.message);
  }
  if (!seatAliases || typeof seatAliases !== 'object' || !seatAliases.aliases || typeof seatAliases.aliases !== 'object') {
    fail('alias map missing or shapeless — the kill switch cannot exist without it (fail closed)');
    seatAliases = null;
  } else {
    if (!['legacy', 'new'].includes(seatAliases.rosterDefault)) {
      fail('aliases rosterDefault must be legacy or new; got ' + JSON.stringify(seatAliases.rosterDefault));
    }
    for (const required of REQUIRED_ALIASES) {
      if (!hasOwn(seatAliases.aliases, required)) fail('required §6.6 alias missing: ' + required);
    }
    const legacyAgents = new Set();
    for (const [name, a] of Object.entries(seatAliases.aliases)) {
      if (hasOwn(roles, name)) fail('alias ' + JSON.stringify(name) + ' shadows a live role name');
      if (!a.deprecation) fail('alias ' + name + ' has no deprecation line');
      if (!a.legacy || !a.legacy.agent || !a.legacy.model) fail('alias ' + name + ' has no legacy identity');
      else {
        if (!familyOf(a.legacy.model)) fail('alias ' + name + ' legacy model unknown: ' + a.legacy.model);
        if (legacyAgents.has(a.legacy.agent)) fail('two aliases claim the same legacy agent: ' + a.legacy.agent);
        legacyAgents.add(a.legacy.agent);
      }
      const n = a.new || {};
      if (n.retiredWorkflow) {
        // WO-14b: plan-synthesizer's target is A1's retired workflow — no
        // role, no casting; the note IS the target.
        if (!n.workflow) fail('alias ' + name + ' declares retiredWorkflow with no workflow note');
        if (n.role || n.rung || n.tier || n.computed) fail('alias ' + name + ' declares retiredWorkflow alongside a role/rung/tier/computed target');
      } else if (!n.role || !hasOwn(roles, n.role)) {
        fail('alias ' + name + ' resolves to unknown role ' + JSON.stringify(n.role));
      } else if (n.computed && !roles[n.role].computed) {
        fail('alias ' + name + ' claims a computed casting but ' + n.role + ' is not computed');
      } else if (n.computed && (n.rung || n.tier)) {
        fail('alias ' + name + ' declares a rung/tier on a computed casting — the lane is computed, not pinned');
      } else if (!n.computed) {
        if (n.tier) {
          if (!((roles[n.role].tiers || {})[n.tier])) fail('alias ' + name + ' names tier ' + JSON.stringify(n.tier) + ' that ' + n.role + ' does not have');
        } else if (!n.rung || !hasOwn(roles[n.role].rungs || {}, n.rung)) {
          fail('alias ' + name + ' names rung ' + JSON.stringify(n.rung) + ' that ' + n.role + ' does not have');
        }
      }
      // The pin carries a safety law (§6.6) — unvalidated, it could be
      // silently dropped or rewritten by a bad merge. Enum + required where
      // the plan requires it.
      if (n.pin !== undefined && n.pin !== 'read-only') {
        fail('alias ' + name + ' carries unknown pin ' + JSON.stringify(n.pin) + ' (only "read-only" is defined)');
      }
      if (hasOwn(ALIAS_PINS, name) && n.pin !== ALIAS_PINS[name]) {
        fail('alias ' + name + ' must carry pin ' + JSON.stringify(ALIAS_PINS[name]) + ' (§6.6)');
      }
    }
  }

  if (problems.length > 0) {
    throw new Error('router refused: casting tables invalid (' + problems.length + ' violation(s)):\n  - ' + problems.join('\n  - '));
  }

  const aliasById = new Map(registry.aliases.map((a) => [a.id, a.resolvesTo]));
  const ladderCfg = castings.poolStateLadder;

  // ---- WO-14b seat toggles: an owner-set manifest override map, merged
  // over castings.json's per-role defaultEnabled (true when unset). cast(),
  // dispatch() and resolveSeat() on a disabled seat all return a typed
  // DISABLED outcome — never a silent recast.
  const seatFlags = {};
  for (const name of roleNames) seatFlags[name] = roles[name].defaultEnabled !== false;
  Object.assign(seatFlags, options.seats || {});
  const seatEnabled = (name) => hasOwn(seatFlags, name) ? seatFlags[name] : true;

  // ---- buckets normalization --------------------------------------------
  // Input: { 'AU-all': X, 'AU-opus': X, 'AU-fable': X, 'OU': X } where X is a
  // state name, a Quartermaster reading, or { state, belowReserve,
  // quartermasterConfirmation }. All four buckets are required — a missing
  // bucket fails closed rather than assuming Green.
  function normalizeBuckets(buckets) {
    if (!buckets || typeof buckets !== 'object') throw new Error('bucket_state required (all of: ' + castings.buckets.join(', ') + ')');
    const out = {};
    for (const b of castings.buckets) {
      // Own property only: an inherited (or prototype-polluted) bucket value
      // must not satisfy the requirement — that is the one remaining way to
      // fabricate Green (WO-14 re-review).
      const raw = hasOwn(buckets, b) ? buckets[b] : undefined;
      if (raw === undefined) throw new Error('bucket_state missing bucket ' + b + ' — fail closed, not Green');
      if (typeof raw === 'string') {
        out[b] = { state: poolState(raw, ladderCfg), belowReserve: false, quartermasterConfirmation: false };
      } else {
        const state = raw.state ? poolState(raw.state, ladderCfg) : poolState(raw, ladderCfg);
        out[b] = {
          state,
          belowReserve: raw.belowReserve === true,
          quartermasterConfirmation: raw.quartermasterConfirmation === true,
        };
      }
    }
    return out;
  }

  // Effective state of a casting = the worst state across every bucket its
  // model draws from (Opus draws AU-all + AU-opus; Fable AU-all + AU-fable).
  function effectiveState(model, nb) {
    let worst = 'Green';
    for (const b of bucketsFor(model)) {
      if (STATE_ORDER[nb[b].state] > STATE_ORDER[worst]) worst = nb[b].state;
    }
    return worst;
  }

  // ---- route(class) → role ----------------------------------------------
  function resolveClass(id) {
    if (aliasById.has(id)) return aliasById.get(id);
    if (activeById.has(id)) return id;
    throw new Error('unknown class identifier: ' + JSON.stringify(id));
  }
  function route(id) {
    const cls = resolveClass(id);
    if (classToRole.has(cls)) return classToRole.get(cls);
    const m = mergedClasses[cls];
    return m && m.role ? m.role : undefined; // A1's retired workflow routes to no role
  }

  // ---- the pre-dispatch AU-O gate (P15) ---------------------------------
  // Mechanical: when AU-opus is predicted below reserve, no Opus casting is
  // dispatched — the Conductor decides only which lawful response (mirror or
  // wait) applies. Same gate on AU-fable re-casts the Conductor's own turns
  // to the Sol mirror. Amber arming: below 40% AU-opus, no Opus dispatch
  // without Quartermaster confirmation (§5.5).
  function preDispatchGate(casting, buckets) {
    const nb = normalizeBuckets(buckets);
    if (casting.model === 'Opus 5') {
      const b = nb['AU-opus'];
      if (b.belowReserve) {
        return { allowed: false, gate: 'AU-O reserve (P15)', lawfulResponses: ['mirror', 'wait'], reason: 'AU-opus predicted below reserve — the failure past that boundary is silent substitution, not refusal; stop before the boundary' };
      }
      if (STATE_ORDER[b.state] >= STATE_ORDER.Amber && !b.quartermasterConfirmation) {
        return { allowed: false, gate: 'AU-O armed (Amber, §5.5)', lawfulResponses: ['quartermaster confirmation', 'mirror', 'wait'], reason: 'below 40% AU-opus, no Opus dispatch without Quartermaster confirmation' };
      }
    }
    if (casting.model === 'Fable 5') {
      const b = nb['AU-fable'];
      if (b.belowReserve) {
        return { allowed: false, gate: 'AU-F reserve (P15)', lawfulResponses: ['Sol mirror at matched effort', 'wait'], reason: 'AU-fable predicted below reserve — Conductor turns re-cast to the Sol mirror' };
      }
    }
    return { allowed: true };
  }

  // The reserve half of P15 alone, evaluated against the REQUESTED rung's
  // model — before the degradation machine's output is accepted. The R0-EX3
  // finding: at Amber+belowReserve the §5.5 auto-recast used to satisfy the
  // gate silently ("no Fable dispatch below reserve" was answered by never
  // asking), so a WORSE pool state produced a MORE permissive outcome than
  // Green+belowReserve. Reserve is a stop-the-line predicate: the response
  // (mirror or wait) is the Conductor's decision — or the O0 reserve path —
  // never the ladder's silent substitution. The Amber ARMING check stays in
  // preDispatchGate, applied to the casting actually served.
  function reserveGate(model, buckets) {
    const nb = normalizeBuckets(buckets);
    if (model === 'Opus 5' && nb['AU-opus'].belowReserve) {
      return { allowed: false, gate: 'AU-O reserve (P15)', lawfulResponses: ['mirror', 'wait'], reason: 'AU-opus predicted below reserve — requested casting stops before the boundary; mirror-or-wait is a decision, not a silent substitution' };
    }
    if (model === 'Fable 5' && nb['AU-fable'].belowReserve) {
      return { allowed: false, gate: 'AU-F reserve (P15)', lawfulResponses: ['Sol mirror at matched effort', 'wait'], reason: 'AU-fable predicted below reserve — requested casting stops before the boundary; Conductor turns take the disclosed Sol-mirror reserve path' };
    }
    return { allowed: true };
  }

  // ---- WO-14b Builder ladder: tier walk + override-only entries ---------
  // castOpts.tier picks the tier (order tier; else the caller-passed
  // default, else 'standard' for Builder); the preferred casting is walked
  // first, then the tier's ordered substitute list, under the same
  // purposesAllowedOnBucket ladder every other degradation uses;
  // `requested` is always the tier's PREFERRED casting, per the order.
  // Override-only entries (Sol at dense/deep) are reachable only through
  // castOpts.override = {rung|model, reason}; a Sol override additionally
  // requires castOpts.reserveCheck === 'passed' (Quartermaster-set, leg 4) —
  // absent, a typed FORBIDDEN, never a silent walk onto Sol.
  function castTiered(roleName, role, nb, o, purpose) {
    const tierName = o.tier || (roleName === 'Builder' ? 'standard' : role.defaultTier);
    const tierDef = (role.tiers || {})[tierName];
    if (!tierDef) {
      return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'unknown tier ' + JSON.stringify(tierName) + ' for ' + roleName };
    }
    const preferredRungName = tierDef.preferred;
    const preferredRung = role.rungs[preferredRungName];
    const requested = { model: preferredRung.model, rung: preferredRungName };

    if (roleName === 'Builder' && preferredRungName === 'preferredBounded' && o.underSpecified) {
      return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'Luna never receives under-specified work — the guardrail survives the promotion; route the order to the Sonnet lane or back to A0' };
    }

    if (o.override) {
      const overrideOnly = tierDef.overrideOnly || [];
      let overrideRungName = o.override.rung;
      if (!overrideRungName && o.override.model) {
        overrideRungName = overrideOnly.find((rn) => role.rungs[rn].model === o.override.model);
      }
      if (!overrideRungName || !overrideOnly.includes(overrideRungName)) {
        return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'override target is not a declared override-only entry for the ' + tierName + ' tier', requested };
      }
      const overrideRung = role.rungs[overrideRungName];
      if (overrideRung.model === 'GPT-5.6 Sol' && o.reserveCheck !== 'passed') {
        return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'FORBIDDEN: Sol override requires the review-reserve check', requested };
      }
      const state = effectiveState(overrideRung.model, nb);
      const allowed = ladderCfg.purposesAllowedOnBucket[state];
      if (!allowed.includes(purpose)) {
        return { ok: false, outcome: 'WAIT', role: roleName, rung: overrideRungName, reason: 'override casting ' + overrideRung.model + ' bucket at ' + state + ' — no lawful casting', requested };
      }
      return {
        ok: true, role: roleName, rung: overrideRungName,
        casting: { vendor: overrideRung.vendor, model: overrideRung.model, effort: overrideRung.effort },
        note: overrideRung.note, bucketState: state, requested,
        override: true, overrideReason: (o.override && o.override.reason) || null,
      };
    }

    const chain = [preferredRungName].concat(tierDef.substitutes || []);
    for (const rn of chain) {
      const rg = role.rungs[rn];
      const state = effectiveState(rg.model, nb);
      const allowed = ladderCfg.purposesAllowedOnBucket[state];
      if (allowed.includes(purpose)) {
        const preferredState = effectiveState(preferredRung.model, nb);
        const extra = rn === preferredRungName ? {} : { recastFrom: preferredRungName, recastReason: preferredRung.model + ' bucket at ' + preferredState + ' — ' + ladderCfg.behavior[preferredState] };
        return Object.assign({
          ok: true, role: roleName, rung: rn,
          casting: { vendor: rg.vendor, model: rg.model, effort: rg.effort },
          note: rg.note, bucketState: state, requested,
        }, extra);
      }
    }
    return {
      ok: false, outcome: 'WAIT', role: roleName, rung: preferredRungName, requested,
      reason: 'no lawful casting on the ' + tierName + ' tier ladder: ' + chain.map((rn) => role.rungs[rn].model + ' @ ' + effectiveState(role.rungs[rn].model, nb)).join(', '),
    };
  }

  // ---- cast(role, bucket_state) → (vendor, model, effort) ---------------
  // The degradation machine: Green dispatches the requested rung; Amber
  // re-casts authoring to the healthy pool's mirror; Orange suspends
  // authoring on the bucket and defers ceiling rungs; Red/Exhausted permit
  // only closing calls. Declared no-mirror halves (E4 irreversible, M0
  // video/audio) wait or return typed UNAVAILABLE — never a substitute.
  function cast(roleName, buckets, castOpts) {
    const o = castOpts || {};
    if (!hasOwn(roles, roleName)) throw new Error('unknown role: ' + JSON.stringify(roleName));
    if (!seatEnabled(roleName)) {
      return { ok: false, outcome: 'DISABLED', role: roleName, reason: 'seat disabled by the owner-set manifest toggle' };
    }
    const role = roles[roleName];
    if (role.computed) throw new Error(roleName + ' casting is computed from the author family set — use reviewer(), never cast()');
    if (role.substrate) {
      return { ok: true, substrate: true, role: roleName, casting: { vendor: 'none', model: 'deterministic', effort: 'none' }, modelAssist: role.modelAssist, note: 'deterministic substrate — code first; model assist only per its contract' };
    }
    const nb = normalizeBuckets(buckets);
    const purpose = o.purpose || 'authoring';
    // One risk oracle (WO-14 re-review): the same normalizer every other
    // risk read uses. A tier that is provided but unrecognizable normalizes
    // to null and takes the fail-closed branch of every comparison below.
    const tier = o.risk === undefined ? undefined : normalizeRisk(o.risk);

    // Declared no-mirror halves refuse before any rung is consulted.
    if (roleName === 'Archivist' && (o.rung === 'videoAudio' || o.medium === 'videoAudio')) {
      return { ok: false, outcome: 'UNAVAILABLE', role: roleName, reason: role.noMirrorFor.videoAudio };
    }
    if (roleName === 'Data Engineer' && o.rung === 'reversibleT1' && o.risk !== undefined && tier !== 'T1') {
      return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'Terra is permitted only for reversible T1 sub-work — ' + role.noMirrorFor.irreversible };
    }

    // The WO-14b Builder ladder: a tiered role (Builder only, today), when
    // no explicit rung is requested, picks its tier (castOpts.tier; default
    // 'standard' for Builder) and walks that tier's preferred casting then
    // its ordered substitute list under the bucket ladder — never the
    // override-only entries, reachable solely through castOpts.override. An
    // explicit o.rung bypasses the ladder and falls through to the ordinary
    // single-rung path below (unchanged), so every existing direct-rung call
    // keeps its documented behavior.
    if (role.tiers && !o.rung) {
      return castTiered(roleName, role, nb, o, purpose);
    }

    // Rung selection.
    let rungName = o.rung;
    if (!rungName && roleName === 'Test Designer') {
      const fam = o.implementationAuthorFamily;
      if (!fam || !AUTHOR_FAMILIES.includes(fam)) {
        // A Q0 order dispatched with no attributable implementation author
        // family cannot be cast (Test Designer is cast OPPOSITE the author,
        // by construction — there is no lawful default). This is a typed
        // refusal, not a throw (finding D): dispatch()'s own createQ0Order()
        // output — or any hand-built Q0 order missing author_family — must
        // fail closed through the ordinary ok:false path, never crash the
        // dispatcher uncaught.
        return { ok: false, rejected: 'implementationAuthorFamily', role: roleName, reason: 'Test Designer casting needs implementationAuthorFamily (anthropic|openai|human) — Q0 is Director-created and cast opposite the author' };
      }
      if (fam === 'anthropic') rungName = 'vsAnthropicAuthor';
      else if (fam === 'openai') rungName = 'vsOpenaiAuthor';
      else {
        // Human author: any family independent — take the healthier pool,
        // tie → the Anthropic lane (protects the OpenAI review reserve).
        const terra = effectiveState('GPT-5.6 Terra', nb);
        const sonnet = effectiveState('Sonnet 5', nb);
        rungName = STATE_ORDER[terra] < STATE_ORDER[sonnet] ? 'vsAnthropicAuthor' : 'vsOpenaiAuthor';
      }
    }
    if (!rungName) rungName = role.defaultRung || 'primary';
    // Own property only: a caller-chosen rung name like '__proto__' must hit
    // the typed "no rung" refusal, never a prototype-chain read.
    const rung = hasOwn(role.rungs || {}, rungName) ? role.rungs[rungName] : null;
    if (!rung) throw new Error(roleName + ' has no rung ' + JSON.stringify(rungName));

    // Hard guardrails that no pool state relaxes.
    if (roleName === 'Builder' && rungName === 'preferredBounded' && o.underSpecified) {
      return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'Luna never receives under-specified work — the guardrail survives the promotion; route the order to the Sonnet lane or back to A0' };
    }

    const state = effectiveState(rung.model, nb);
    // `requested` records the rung selected BEFORE degradation: the reserve
    // gate (P15) is evaluated against this, not the recast output — a
    // degraded recast must never silently satisfy a reserve stop. The
    // security route-filter is the same shape of guardrail and belongs in
    // the same choke-point (both `result()` call sites — the direct grant
    // AND the §5.5 mirror fallback): checking only the REQUESTED rung let a
    // degraded recast (Amber → mirror) silently smuggle a security-sensitive
    // order onto the Fable lane the filter exists to block (probe A2d).
    const result = (rg, name, extra) => {
      if (roleName === 'Architect' && o.securitySensitive && familyOf(rg.model) === 'anthropic') {
        return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: role.securityRouteFilter };
      }
      return Object.assign({
        ok: true, role: roleName, rung: name,
        casting: { vendor: rg.vendor, model: rg.model, effort: rg.effort },
        note: rg.note, bucketState: state,
        requested: { model: rung.model, rung: rungName },
      }, extra || {});
    };

    // Ceiling rungs defer from Orange down (AU-fable stops first, §5.5).
    if (rung.ceiling && STATE_ORDER[state] >= STATE_ORDER.Orange) {
      return { ok: false, outcome: 'DEFERRED', role: roleName, rung: rungName, reason: 'ceiling seats deferred at ' + state + ' (§5.5 Orange rung: AU-fable stops first)' };
    }
    const allowedPurposes = ladderCfg.purposesAllowedOnBucket[state];
    if (allowedPurposes.includes(purpose)) {
      return result(rung, rungName);
    }

    // Authoring (or another disallowed purpose) on a degraded bucket:
    // re-cast to the healthy pool's mirror, per role; else wait.
    const noMirrorReason =
      roleName === 'Data Engineer' && (o.irreversible || (o.risk !== undefined && tier !== 'T0' && tier !== 'T1'))
        ? role.noMirrorFor.irreversible
        : null;
    if (noMirrorReason) {
      return { ok: false, outcome: 'WAIT', role: roleName, rung: rungName, reason: noMirrorReason + ' (bucket ' + state + ')' };
    }
    const mirror = (role.rungs || {}).mirror;
    const fallbackName = mirror ? 'mirror' : (roleName === 'Data Engineer' && tier === 'T1' ? 'reversibleT1' : null);
    const fallback = mirror || (fallbackName ? role.rungs[fallbackName] : null);
    if (fallback && familyOf(fallback.model) !== familyOf(rung.model)) {
      const mState = effectiveState(fallback.model, nb);
      const mAllowed = ladderCfg.purposesAllowedOnBucket[mState];
      if (mAllowed.includes(purpose)) {
        return result(fallback, fallbackName || 'mirror', { recastFrom: rungName, recastReason: rung.model + ' bucket at ' + state + ' — ' + ladderCfg.behavior[state] });
      }
    }
    return {
      ok: false, outcome: 'WAIT', role: roleName, rung: rungName,
      reason: 'no lawful casting: ' + rung.model + ' bucket at ' + state + (fallback ? ', mirror bucket at ' + effectiveState(fallback.model, nb) : ', and the role declares no mirror for this work'),
    };
  }

  // Risk tier is the gate oracle — an unrecognized tier must fail CLOSED to
  // mandatory, never fall through to preferred. `"T3 "`, `"t3"`, a
  // zero-width space, or any typo silently downgrading mandatory review is
  // exactly the P15 silent-relaxation failure. One normalizer, used
  // everywhere risk enters.
  const RISK_TIERS = ['T0', 'T1', 'T2', 'T3'];
  function normalizeRisk(risk) {
    const r = typeof risk === 'string' ? risk.trim().toUpperCase() : risk;
    return RISK_TIERS.includes(r) ? r : null;
  }

  // ---- review policy (§3.4) ---------------------------------------------
  // Mandatory is computed FIRST and nothing overrides it: `inert` is an
  // affordance for provably-inert T0/T1 work, never a bypass — an inert flag
  // on a mandatory class, an unrecognized or T2/T3 tier, or a security touch
  // changes nothing (WO-8 gate finding: flags.inert must never relax the
  // mandatory set, and inert never applies above T1).
  function reviewPolicy(classId, risk, flags) {
    const f = flags || {};
    const cls = resolveClass(classId);
    const tier = normalizeRisk(risk);
    const mr = castings.mandatoryReview;
    const touches = f.touches || [];
    const mandatory =
      tier === null || // unrecognized tier fails closed
      mr.riskTiers.includes(tier) ||
      mr.classes.includes(cls) ||
      mr.flags.some((flag) => !!f[flag]) ||
      touches.some((t) => castings.securityTriggerList.includes(t));
    if (mandatory) return 'mandatory';
    if (f.inert && (tier === 'T0' || tier === 'T1')) return 'none';
    return 'preferred';
  }

  // ---- reviewer(author_families, risk) → casting ------------------------
  // The computed R0 matrix. Structural properties: (1) no-self-family — a
  // returned casting's family is never in the author set, asserted at
  // return; (2) mandatory work whose cross-family lane is Red/Exhausted
  // returns DOES_NOT_CLOSE, never a same-family casting; (3) unattributed or
  // both-family authorship fails closed at mandatory class.
  function reviewer(authorFamilies, risk, revOpts) {
    const o = revOpts || {};
    const policy = o.policy || 'mandatory';
    if (!['mandatory', 'preferred', 'none'].includes(policy)) throw new Error('unknown review policy: ' + policy);
    risk = normalizeRisk(risk);
    if (risk === null) throw new Error('unknown risk tier — refusing rather than guessing a lane');
    // Bucket state is required, not defaulted: `|| allGreen()` on the
    // exported API was the last fabricated-Green fail-open (WO-14 re-review
    // NIT, ruling C). A caller that measured Green passes allGreen() itself.
    if (o.buckets === undefined) {
      throw new Error('reviewer requires bucket_state — fail closed, not Green (P15)');
    }
    const nb = normalizeBuckets(o.buckets);

    const raw = authorFamilies === undefined || authorFamilies === null ? [] : [].concat(authorFamilies);
    const unattributed = raw.length === 0 || raw.some((f) => !AUTHOR_FAMILIES.includes(f)) || o.unattributed === true;
    const famSet = new Set(raw.filter((f) => AUTHOR_FAMILIES.includes(f)));
    const modelFams = FAMILIES.filter((f) => famSet.has(f));

    const guard = (casting, extra) => {
      const fam = familyOf(casting.model);
      if (famSet.has(fam)) {
        throw new Error('no-self-family violated: reviewer ' + casting.model + ' (' + fam + ') against author set [' + [...famSet].join(', ') + '] — refusing');
      }
      // A gated reviewer must not close (WO-8 gate finding): the embedded
      // pre-dispatch gate is a refusal, never an annotation on a close.
      const gate = preDispatchGate(casting, nb);
      if (!gate.allowed) {
        return Object.assign({
          closes: false, outcome: 'GATED', gate, casting, reviewerFamily: fam,
          review_cross_family: true,
          reason: 'review lane gated: ' + gate.reason,
          options: gate.lawfulResponses || castings.mandatoryReview.unavailableOptions,
        }, extra || {});
      }
      return Object.assign({ closes: true, casting, reviewerFamily: fam, review_cross_family: true, gate }, extra || {});
    };
    const doesNotClose = (why, options) => ({
      closes: false, outcome: 'DOES_NOT_CLOSE', reason: why,
      options: options || castings.mandatoryReview.unavailableOptions,
      review_cross_family: null,
    });

    // Unattributed / unprovable provenance fails closed (§3.4, R0 matrix).
    if (unattributed) {
      if (policy === 'mandatory' || risk === 'T2' || risk === 'T3') {
        return doesNotClose('unattributed or unprovable provenance at mandatory class — treated as potentially authored by every model family; no single-family verdict can close it', ['concurring independent verdicts from both families', 'named human review recorded in the ledger']);
      }
      return degradedPath(null, o, nb, 'T1 work with unprovable provenance may proceed only under the preferred-band degraded path, disclosed, or wait for provenance');
    }
    // Both model families authored: no independent model family exists.
    if (modelFams.length === 2) {
      if (policy === 'mandatory' || risk === 'T2' || risk === 'T3') {
        return doesNotClose('both model families are in the author set — no independent family exists', ['named human review recorded in the ledger']);
      }
      return degradedPath(null, o, nb, 'both families authored; preferred-band degraded path only, disclosed');
    }

    // Select the matrix row. Mandatory-class review takes the frontier
    // (T2/T3) lane regardless of nominal tier — Part 2's documented lanes
    // (e.g. every Sol-authored mutation is mandatory-class and reviewed by
    // Opus 5 · high, even at nominal T1); the qualified-Terra/Sonnet T1 rows
    // serve the preferred band only.
    const effRisk = risk === 'T0' ? 'T1' : risk;
    const rowTier = policy === 'mandatory' && effRisk === 'T1' ? 'T2' : effRisk;
    let row, secondOpinion = null;
    if (modelFams.length === 0) {
      row = castings.reviewMatrix.human[rowTier];
      if (rowTier === 'T3' && row.secondOpinion) secondOpinion = row.secondOpinion;
    } else if (modelFams[0] === 'anthropic') {
      if (rowTier === 'T1') {
        const lane = castings.reviewMatrix.anthropic.T1;
        row = (o.terraT1Qualified === true || (o.terraT1Qualified === undefined && castings.reviewMatrix.terraT1Qualified)) ? lane.qualified : lane.untilQualified;
      } else {
        row = castings.reviewMatrix.anthropic[rowTier];
      }
    } else {
      row = castings.reviewMatrix.openai[rowTier];
    }
    const casting = { vendor: row.vendor, model: row.model, effort: row.effort };

    // Availability: mandatory review whose lane is Red/Exhausted does not
    // close — under NO bucket state does it fall back to the author's family.
    const laneState = effectiveState(casting.model, nb);
    if (STATE_ORDER[laneState] >= STATE_ORDER.Red) {
      if (policy === 'mandatory' || risk === 'T3') {
        return doesNotClose('cross-family review lane (' + casting.model + ') at ' + laneState + ' — mandatory review can never degrade (§3.4)');
      }
      return degradedPath(modelFams[0] || null, o, nb, 'reviewer lane at ' + laneState + '; preferred band may take the disclosed degraded path');
    }
    const out = guard(casting, secondOpinion ? { secondOpinion } : null);
    return out;
  }

  // Preferred-band degraded path (§3.4): fresh-context, different-model,
  // same-family review + mandatory Verifier, review.cross_family = false set
  // by the dispatcher and rendered verbatim in the user report.
  function degradedPath(authorModelFamily, o, nb, why) {
    const fams = authorModelFamily ? [authorModelFamily] : FAMILIES.slice();
    for (const fam of fams) {
      for (const cand of castings.reviewMatrix.degradedSameFamilyCandidates[fam]) {
        if (o.authorModel && cand.model === o.authorModel) continue; // different model, never the author's
        const st = effectiveState(cand.model, nb);
        if (STATE_ORDER[st] < STATE_ORDER.Red) {
          return {
            closes: true, degraded: true, review_cross_family: false, disclosed: true,
            casting: { vendor: cand.vendor, model: cand.model, effort: cand.effort },
            reviewerFamily: fam,
            requirement: 'fresh-context, different-model review + mandatory Verifier; review.cross_family=false rendered verbatim in the user report',
            reason: why,
          };
        }
      }
    }
    return { closes: false, outcome: 'WAIT', reason: why + ' — and no degraded lane has pool room', review_cross_family: null };
  }

  // ---- automatic Q0 (seat 19 triggers — policy, not discretion) ---------
  function q0Required(order) {
    const cls = resolveClass(order.class);
    if (cls === 'Q0') return { required: false, reason: 'the order IS the Q0 order' };
    const risk = normalizeRisk(order.risk);
    const cfg = castings.q0Triggers;
    if (cfg.classes.includes(cls)) return { required: true, reason: 'every ' + cls + ' change (class trigger)' };
    // Gated on sourceChangeClasses exactly like the tier trigger below
    // (finding G): a read-only/doc class (N0, D0, I0, N1, M0, S0, …) makes
    // no source change for an independent test oracle to cover, so a touch
    // area recorded on it (carried for the security-review triggers, which
    // DO apply to every class) must not also hard-block on a missing Q0.
    const touches = order.touches || [];
    const hit = cfg.sourceChangeClasses.includes(cls) ? touches.find((t) => cfg.touchAreas.includes(t)) : undefined;
    if (hit) return { required: true, reason: hit + ' change regardless of nominal tier (touch trigger)' };
    // An unrecognized risk tier fails closed to the highest gated tier, so a
    // malformed tier cannot dodge the tier trigger.
    const effRisk = risk === null ? 'T3' : risk;
    if (cfg.riskTiers.includes(effRisk) && cfg.sourceChangeClasses.includes(cls)) {
      return { required: true, reason: 'every ' + effRisk + ' source change (tier trigger)' };
    }
    const cal = cfg.calibrationSample;
    if (cal.riskTiers.includes(effRisk) && cal.classes.includes(cls)) {
      // Sample on the dispatcher-written integrity_nonce, never the
      // requester-chosen task_id: an unkeyed hash over a caller-controlled id
      // lets a requester grind an id that evades the independent-test-oracle
      // audit. The nonce is unpredictable to the requester; absent one, the
      // audit fails closed (required), never open.
      const sampleKey = order.integrity_nonce;
      if (!sampleKey) return { required: true, reason: 'calibration-eligible with no integrity_nonce — sampled closed (required)' };
      if (fnv1a(String(sampleKey)) % 100 < cal.rate * 100) {
        return { required: true, reason: 'calibration sample (' + cal.rate * 100 + '% of T1 ' + cal.classes.join('/') + ' work; keyed on the dispatcher nonce)' };
      }
      return { required: false, reason: 'calibration-eligible, not sampled' };
    }
    return { required: false, reason: 'no trigger matched' };
  }

  function createQ0Order(implOrder, buckets, q0Opts) {
    const o = q0Opts || {};
    const authorFamily = o.implementationAuthorFamily || implOrder.author_family;
    const castResult = cast('Test Designer', buckets, { implementationAuthorFamily: authorFamily, purpose: 'authoring' });
    return {
      order: {
        task_id: String(implOrder.task_id) + '-q0',
        parent_id: implOrder.parent_id !== undefined ? implOrder.parent_id : null,
        class: 'Q0',
        risk: implOrder.risk,
        requested_casting: castResult.ok ? castResult.casting : null,
        // author_family is the Q0 ORDER'S OWN family — the family that will
        // actually author the test-oracle work (the casting result above,
        // opposite the implementation by construction). It must never be
        // confused with the implementation's family below (finding D): a
        // caller re-dispatching this order (dispatch() seeding
        // castOpts.implementationAuthorFamily) needs the IMPLEMENTATION's
        // family, not the Q0's own, or the re-cast lands same-family as the
        // implementation and Q0 independence is defeated.
        author_family: castResult.ok ? familyOf(castResult.casting.model) : null,
        // implementation_author_family: the PARENT implementation's author
        // family — what the Q0 casting was chosen opposite of. This is the
        // field dispatch() must read when re-dispatching a Q0 order.
        implementation_author_family: authorFamily,
        co_author_families: [],
        goal: 'Independent test oracle for ' + implOrder.task_id + ': black-box tests drafted before or parallel to implementation, diff withheld where practical',
        acceptance_criteria: ['mutation check: inverted assertion or reverted fix goes red (Verifier, contractual)', 'flake check passes'],
        review_policy: reviewPolicy('Q0', implOrder.risk, {}),
        integrity_nonce: crypto.randomBytes(12).toString('hex'),
      },
      director_created: true,
      never_implementer_spawned: true,
      cast: castResult,
    };
  }

  // ---- dispatch: the assembled pre-dispatch pipeline --------------------
  function dispatch(order, buckets, dispatchOpts) {
    const o = dispatchOpts || {};
    let cls;
    try {
      cls = resolveClass(order.class);
    } catch (e) {
      return { ok: false, rejected: 'class', reason: e.message };
    }

    // Risk is normalized ONTO the order at the door — whitespace/case only;
    // an unrecognizable tier is refused, not guessed, so no schema-invalid
    // `risk` can ride the order or its Q0 companion out of dispatch.
    const tier = normalizeRisk(order.risk);
    if (tier === null) {
      return { ok: false, rejected: 'risk', reason: 'unrecognized risk tier ' + JSON.stringify(order.risk) + ' — dispatch refuses rather than guessing a lane (fail closed)' };
    }
    // The integrity nonce is MINTED HERE, never taken from the caller: the
    // Q0 calibration sample is keyed on it, and a requester-chosen nonce is
    // a grindable sample (WO-14 re-review). The minted order is returned in
    // the result so the ledger records the nonce the draw actually used.
    order = Object.assign({}, order, { risk: tier, integrity_nonce: crypto.randomBytes(12).toString('hex') });
    // The order is the canonical `touches` carrier (schema-typed, ruling
    // 3a); caller flags may only ADD trigger areas — union — never remove.
    const flagTouches = (o.flags && o.flags.touches) || [];
    if (flagTouches.length > 0 || (order.touches || []).length > 0) {
      order.touches = [...new Set([].concat(order.touches || [], flagTouches))];
    }

    // WO-14b merged classes: a retired-workflow class (A1) dispatches to no
    // role at all — a typed refusal naming the documented workflow.
    const merge = mergedClasses[cls];
    if (merge && merge.workflow !== undefined) {
      return { ok: false, outcome: 'RETIRED_WORKFLOW', class: cls, order, reason: merge.workflow };
    }

    // A merged class (N0/N1/N2/M0 → Investigator, E0/E1/E3/E5/E6/E8/D0 →
    // Builder) routes through its target role, carrying the class UNCHANGED
    // (it still carries its own review row — E3/E4 etc. mandatory), the
    // target role, a default tier (Builder-tiered targets only, overridden
    // by an explicit order.tier), and `mode` — the former class id, read by
    // the served seat's own logic (e.g. N0's read-only pin).
    const roleName = merge ? merge.role : classToRole.get(cls);
    const role = roles[roleName];
    const mode = merge ? merge.mode : undefined;
    const mergedDefaultTier = merge ? merge.tier : undefined;

    if (!seatEnabled(roleName)) {
      const disabled = { ok: false, outcome: 'DISABLED', role: roleName, class: cls, order, reason: 'seat disabled by the owner-set manifest toggle' };
      if (cls === 'S0') {
        return Object.assign(disabled, { fallback: 'verifier-census', reason: disabled.reason + ' — the Conductor\'s chain-final step falls to the Verifier\'s census re-run' });
      }
      if (cls === 'A0') {
        return Object.assign(disabled, { fallback: 'conductor-self-plan', reason: disabled.reason + ' — the Conductor plans in its own voice, disclosure recorded on the order' });
      }
      return disabled;
    }

    // WO-14b leg 2 fix round (finding 6): merging M0 into Investigator
    // dropped the raw video/audio UNAVAILABLE capability boundary the
    // retired Archivist role declared (noMirrorFor.videoAudio) — restored
    // generically here: any mergedClasses entry may declare
    // `unavailable: { <medium>: reason }`; a request naming that medium is
    // refused typed UNAVAILABLE before a role/rung is ever consulted. The
    // medium is read ONLY from castOpts.medium — explicit caller intent,
    // never inferred from context_packet or any other free-text field — so
    // order.schema.json (out of this fix round's edit set) needs no change;
    // a future leg that wants an order-level `medium` field can add it and
    // fold it into this same read.
    if (merge && merge.unavailable) {
      const medium = o.castOpts && o.castOpts.medium;
      if (medium !== undefined && hasOwn(merge.unavailable, medium)) {
        return { ok: false, outcome: 'UNAVAILABLE', class: cls, role: roleName, order, reason: merge.unavailable[medium] };
      }
    }

    // Context shape is dispatcher-enforced (§2.0): a shape the seat may not
    // be handed is rejected outright, not truncated. A merged class may
    // widen the target role's maximum shapes (E8 → Builder: repo/haystack)
    // or, WO-14b leg 2 fix round (finding 7), NARROW them to an exact set
    // via contextShapesOnly (E1 → Builder: packet only) — the merged
    // class's own ceiling replaces the target role's, rather than adding to
    // it, so a class that used to be the "hardest constraint in the roster"
    // (E1/Runner, packet-only) stays that way after the merge.
    const allowedShapes = (merge && merge.contextShapesOnly)
      ? merge.contextShapesOnly
      : role.contextShapes.concat((merge && merge.contextShapesAllowed) || []);
    if (order.context_shape !== undefined) {
      if (!castings.contextShapes.includes(order.context_shape)) {
        return { ok: false, rejected: 'context-shape', reason: 'unknown context shape ' + JSON.stringify(order.context_shape) };
      }
      if (!allowedShapes.includes(order.context_shape)) {
        return { ok: false, rejected: 'context-shape', reason: roleName + ' (' + cls + ') may not be handed ' + JSON.stringify(order.context_shape) + ' — maximum shapes: [' + allowedShapes.join(', ') + ']' };
      }
    }

    const policy = reviewPolicy(cls, order.risk, Object.assign({}, o.flags, { touches: order.touches || [] }));

    // securitySensitive is derived from the canonical order.touches against
    // the SAME securityTriggerList the load-time cross-check ties to the
    // order schema (line ~183) — never left for the caller to remember to
    // set. A caller-supplied o.castOpts.securitySensitive can only ADD to
    // this (a caller who knows more than the touches list can still flag
    // it); it can never suppress a touch-derived true, which is why the OR
    // is applied AFTER spreading o.castOpts rather than merged into it.
    const securitySensitive =
      (order.touches || []).some((t) => castings.securityTriggerList.includes(t)) ||
      !!(o.castOpts && o.castOpts.securitySensitive);

    // Casting for the executor, through the degradation machine… Test
    // Designer (Q0) needs implementationAuthorFamily to pick its
    // opposite-family rung; a Q0 order dispatched directly (createQ0Order()'s
    // own output, or any hand-built Q0 order) rarely repeats it in castOpts,
    // so it is seeded from the order's own implementation_author_family —
    // the PARENT IMPLEMENTATION's author family, exactly the field
    // createQ0Order() stamps for this purpose. Finding D (MAJOR, fixed):
    // this used to fall back to order.author_family, which on a Q0 order is
    // the Q0's OWN family (already opposite the implementation) — feeding
    // that back in as "the implementation's family" re-cast the Q0 opposite
    // ITSELF, landing same-family as the original implementation and
    // defeating Q0 independence. order.author_family must never be read
    // here. Harmless for every non-Test-Designer role, which never reads
    // this key.
    let casting = role.computed
      ? null
      : cast(roleName, buckets, Object.assign(
          { risk: order.risk, purpose: o.purpose || 'authoring', tier: order.tier || mergedDefaultTier },
          o.castOpts,
          {
            securitySensitive,
            implementationAuthorFamily: (o.castOpts && o.castOpts.implementationAuthorFamily) || order.implementation_author_family,
          }
        ));

    // …then the mechanical pre-dispatch gates on what came out — BEFORE Q0
    // creation, so the companion is cast opposite the family that will
    // ACTUALLY author (a recast changes the author family). Two gates, in
    // order (R0-EX3 finding): the RESERVE gate runs against the REQUESTED
    // rung — a §5.5 degradation recast must never silently satisfy a P15
    // reserve stop — then the full gate (reserve + Amber arming) runs
    // against the casting actually served.
    let gate = { allowed: true };
    if (casting && casting.ok && !casting.substrate) {
      gate = reserveGate((casting.requested || casting.casting).model, buckets);
      if (gate.allowed) gate = preDispatchGate(casting.casting, buckets);
      if (!gate.allowed && roleName === 'Conductor' && gate.gate === 'AU-F reserve (P15)') {
        // Ruling 2a: the AU-fable reserve re-casts the Conductor's turns to
        // the Sol mirror at matched effort — the plan's promised reserve
        // path, disclosed, with the mirror rung's restrictions carried —
        // but only when the mirror itself casts and gates clean; otherwise
        // the order stays GATED (lawful response: wait).
        const mirror = cast(roleName, buckets, Object.assign({}, o.castOpts, { risk: order.risk, purpose: o.purpose || 'authoring', rung: 'mirror' }));
        if (mirror.ok && !mirror.substrate) {
          const mirrorGate = preDispatchGate(mirror.casting, buckets);
          if (mirrorGate.allowed) {
            casting = Object.assign({}, mirror, {
              recastFrom: casting.rung,
              recastReason: gate.reason,
            });
            gate = mirrorGate;
          }
        }
      }
      if (!gate.allowed) {
        return { ok: false, outcome: 'GATED', gate, role: roleName, class: cls, order, reason: gate.reason };
      }
      // Every Conductor turn served on the mirror carries the mirror's §6.6
      // restrictions and the disclosure marker — REGARDLESS of which path
      // put it there (the reserve branch above, or the §5.5 degradation
      // machine inside cast()). The R0-EX3 finding: the Amber-path recast
      // arrived undisclosed and unrestricted.
      if (roleName === 'Conductor' && casting.rung === 'mirror') {
        casting = Object.assign({}, casting, {
          disclosed: true,
          restrictions: ((role.rungs || {}).mirror && role.rungs.mirror.restrictions) || [],
        });
      }
    }
    if (casting && !casting.ok) {
      return { ok: false, outcome: casting.outcome, rejected: casting.rejected, role: roleName, class: cls, order, reason: casting.reason };
    }

    // Stale-family fix (cycle-2 MAJOR, router.js:895): a Q0 order's
    // author_family is the family of the SERVED Q0 casting at THIS dispatch
    // — after any recast — never the family recorded when the order was
    // first created. A human-authored implementation's Q0, created while
    // both pools are Green (tie → Anthropic/Sonnet), re-dispatched after
    // AU-all turns Amber and now serves OpenAI/Terra, must report
    // author_family:"openai" here, not the stale "anthropic" the order
    // arrived with. implementation_author_family is the PARENT
    // implementation's family and is never touched — it is what the casting
    // was chosen opposite of, not what this order's own author_family means.
    if (cls === 'Q0' && casting && casting.ok && !casting.substrate) {
      order = Object.assign({}, order, { author_family: familyOf(casting.casting.model) });
    }

    // Automatic Q0: created with the implementation order, cast opposite the
    // family that will actually author it; a missing required Q0 blocks the
    // work — a policy violation, not a shortcut.
    const q0 = q0Required(order);
    let q0Companion = null;
    if (q0.required) {
      if (o.q0OrderPresent === false) {
        return { ok: false, blocked: 'Q0', order, reason: 'required Q0 order missing (' + q0.reason + ') — a policy violation, not a shortcut; Q0 is Director-created' };
      }
      q0Companion = createQ0Order(order, buckets, {
        implementationAuthorFamily: (casting && casting.ok && !casting.substrate) ? familyOf(casting.casting.model) : order.author_family,
      });
      q0Companion.trigger = q0.reason;
      // A required Q0 that cannot be cast blocks the dispatch (WO-8 gate
      // finding): emitting a companion with a null casting is schema-invalid,
      // and a required Q0 that silently cannot exist is the suppressed-Q0
      // case wearing a different coat.
      if (!q0Companion.cast.ok) {
        return {
          ok: false, blocked: 'Q0', outcome: q0Companion.cast.outcome || 'WAIT',
          role: roleName, class: cls, order, q0: q0Companion,
          reason: 'required Q0 companion cannot be cast (' + (q0Companion.cast.reason || q0Companion.cast.outcome) + ') — dispatch blocks rather than emitting an uncastable Q0',
        };
      }
    }

    // Prospective review of the artifact this order will produce, computed
    // from the family that will author it (plus recorded co-authors). A
    // substrate casting (V0 Verifier, P0 Quartermaster) is deterministic
    // code — never a model-authored artifact — so this MUST branch before
    // authorFams is even computed (finding I): familyOf('deterministic') is
    // null, and feeding that into reviewer() falls into the
    // unattributed-authorship path, which fabricates a degraded same-family
    // Opus review of code that has no author family to review at all. The
    // mandatory-gated branch (policy === 'mandatory', or T2/T3 nominal tier —
    // the exact condition reviewer()'s own unattributed check applies)
    // reuses that same reviewer() call so its DOES_NOT_CLOSE outcome is
    // byte-for-byte the prior behavior, unchanged.
    let review;
    if (casting && casting.ok && casting.substrate && policy !== 'none' && !(policy === 'mandatory' || tier === 'T2' || tier === 'T3')) {
      review = {
        closes: true, substrate: true, casting: null,
        requirement: 're-execution / Verifier confirms deterministic substrate behavior — no model casting is a review target',
        reason: 'deterministic substrate (' + roleName + ') — code first; not a model-authored artifact requiring cross-family review',
      };
    } else {
      const authorFams = role.computed
        ? (o.reviewOf && o.reviewOf.authorFamilies)
        : [familyOf(casting.casting.model)].concat(order.co_author_families || []);
      review = policy === 'none'
        ? { closes: true, policy: 'none', reason: 'provably inert — lint + targeted checks; inertness verified from the diff first' }
        : reviewer(authorFams, order.risk, { policy, buckets, terraT1Qualified: o.terraT1Qualified, authorModel: casting && casting.ok ? casting.casting.model : undefined, unattributed: o.flags && o.flags.unattributed });
    }

    const mergedFields = merge
      ? Object.assign({ mode: mode }, mergedDefaultTier !== undefined ? { tier: order.tier || mergedDefaultTier } : {}, mode === 'N0' && merge.pin ? { pin: merge.pin } : {})
      : {};
    return Object.assign({ ok: true, class: cls, role: roleName, casting: casting, gate, review_policy: policy, review, q0: q0Companion, order }, mergedFields);
  }

  // ---- RECLASSIFY hop machinery (Part 4 error stance, WO-4 encoding) ----
  // A seat receiving work outside its charter returns RECLASSIFY with
  // {recommended_class, evidence}. Processing it re-dispatches the order to
  // the recommended class with the hop counted: one hop is routine; a second
  // hop on the same order escalates to the Conductor as a classification
  // defect. Every hop feeds the per-pair ledger (the same ledger residual
  // ambiguities feed — three entries on one pair force a redraw or merge).
  function processReclassify(order, report, buckets, dispatchOpts) {
    if (!report || report.status !== 'RECLASSIFY') {
      throw new Error('processReclassify needs a report with status RECLASSIFY');
    }
    const rc = report.reclassify || {};
    if (!rc.recommended_class) throw new Error('RECLASSIFY report missing reclassify.recommended_class');
    if (!rc.evidence || String(rc.evidence).trim() === '') {
      throw new Error('RECLASSIFY report missing reclassify.evidence — the observed evidence is required, not optional');
    }
    const from = resolveClass(order.class);
    const to = resolveClass(rc.recommended_class);
    if (from === to) throw new Error('RECLASSIFY recommends the class the order already carries (' + from + ') — not a reclassification');
    const hop = (order.reclassify_hops || 0) + 1;
    const ledgerEntry = { pair: [from, to].sort(), task_id: order.task_id, hop, evidence: rc.evidence };
    if (hop >= 2) {
      return {
        escalated: true, to: 'Conductor',
        reason: 'classification defect: second reclassification hop on one order (' + order.task_id + '), ' + from + ' → ' + to,
        hop, ledger: ledgerEntry, dispatch: null,
      };
    }
    const newOrder = Object.assign({}, order, { class: to, reclassify_hops: hop });
    return { escalated: false, hop, ledger: ledgerEntry, order: newOrder, dispatch: dispatch(newOrder, buckets, dispatchOpts) };
  }

  // ---- resolveSeat: the WO-14 kill switch, evaluated per order -----------
  // A name written against the OLD roster resolves under whichever roster
  // flag the order carries: 'legacy' → the installed legacy agent identity,
  // unchanged; 'new' → the (role, rung) pair from the casting tables, cast
  // through the degradation machine. Either way a retired name emits its
  // ledger deprecation line. Rollback is a flag flip — same router, no
  // reload, demonstrated per-call.
  function resolveSeat(name, seatOpts) {
    const o = seatOpts || {};
    if (o.roster !== undefined && !['legacy', 'new'].includes(o.roster)) {
      throw new Error('unknown roster flag: ' + JSON.stringify(o.roster) + ' — the flag is explicit or absent, never falsy-and-ignored');
    }
    const roster = o.roster === undefined ? seatAliases.rosterDefault : o.roster;
    if (!hasOwn(seatAliases.aliases, name)) {
      if (hasOwn(roles, name)) {
        // WO-14b leg 2 fix round (finding 3): a direct role name (no alias
        // indirection) used to skip the seat-toggle check entirely and hand
        // back a usable role target even for a disabled seat. Same typed
        // DISABLED shape cast()/dispatch() return — including the S0/A0
        // fallback disclosure — never a usable role target.
        if (!seatEnabled(name)) {
          const disabled = { ok: false, outcome: 'DISABLED', role: name, reason: 'seat disabled by the owner-set manifest toggle' };
          if (name === 'Sweeper') {
            return Object.assign(disabled, { fallback: 'verifier-census', reason: disabled.reason + ' — the Conductor\'s chain-final step falls to the Verifier\'s census re-run' });
          }
          if (name === 'Architect') {
            return Object.assign(disabled, { fallback: 'conductor-self-plan', reason: disabled.reason + ' — the Conductor plans in its own voice, disclosure recorded on the order' });
          }
          return disabled;
        }
        return { roster, alias: false, target: { kind: 'role', role: name } };
      }
      return { roster, alias: false, error: 'unknown seat name: ' + JSON.stringify(name), target: null };
    }
    const a = seatAliases.aliases[name];
    const ledger = 'DEPRECATED "' + name + '" (roster: ' + roster + ') — ' + a.deprecation;
    if (roster === 'legacy') {
      return { roster, alias: true, ledger, target: Object.assign({ kind: 'legacy-agent' }, a.legacy) };
    }
    if (a.new.computed) {
      return { roster, alias: true, ledger, target: { kind: 'computed-reviewer', role: a.new.role, laneNote: a.new.laneNote } };
    }
    if (a.new.retiredWorkflow) {
      return { roster, alias: true, ledger, target: { kind: 'retired-workflow', workflow: a.new.workflow, note: a.new.downgradeNote || null } };
    }
    // The alias's declared rung/tier/override ALWAYS wins over caller
    // castOpts — a caller override here would silently re-cast a §6.6
    // mapping while the ledger records the alias's own mapping (the
    // silent-substitution failure, P15/§7.1).
    if (o.buckets === undefined) {
      throw new Error('new-roster resolution requires bucket_state — fail closed, not Green (P15)');
    }
    const forced = {};
    if (a.new.tier) { forced.tier = a.new.tier; forced.rung = undefined; }
    else if (a.new.rung) { forced.rung = a.new.rung; forced.tier = undefined; }
    if (a.new.override) forced.override = a.new.override;
    const castOpts = Object.assign({}, o.castOpts, forced);
    if (o.purpose !== undefined) castOpts.purpose = o.purpose;
    let c = cast(a.new.role, o.buckets, castOpts);
    let gate = { allowed: true };
    if (c.ok && !c.substrate) {
      // Reserve on the REQUESTED rung first (a degradation recast never
      // silently satisfies a P15 stop), then the full gate on the served
      // casting — same order as dispatch().
      gate = reserveGate((c.requested || c.casting).model, o.buckets);
      if (gate.allowed) gate = preDispatchGate(c.casting, o.buckets);
      if (!gate.allowed) {
        c = { ok: false, outcome: 'GATED', role: a.new.role, rung: c.rung, gate, reason: gate.reason };
      }
    }
    return {
      roster, alias: true, ledger,
      target: { kind: 'new-roster', role: a.new.role, rung: a.new.rung || null, tier: a.new.tier || null, pin: a.new.pin || null, cast: c, gate, note: a.new.downgradeNote },
    };
  }

  function allGreen() {
    const out = {};
    for (const b of castings.buckets) out[b] = 'Green';
    return out;
  }

  // The validated config is exposed read-only: a caller mutating the live
  // maps would change routing behind the validator's back.
  function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      for (const v of Object.values(obj)) deepFreeze(v);
    }
    return obj;
  }
  deepFreeze(registry);
  deepFreeze(castings);
  deepFreeze(charters);
  deepFreeze(seatAliases);

  return {
    registry, castings, charters, aliases: seatAliases, resolveSeat, problems: [],
    route, resolveClass, cast, reviewer, reviewPolicy, dispatch, processReclassify,
    poolState: (r) => poolState(r, ladderCfg),
    preDispatchGate, reserveGate, q0Required, createQ0Order,
    requiredReserve: (f) => requiredReserve(f, castings.reserve),
    familyOf, bucketsFor, effectiveState: (m, b) => effectiveState(m, normalizeBuckets(b)),
    normalizeBuckets, allGreen,
  };
}

module.exports = { createRouter, poolState, requiredReserve, fnv1a, STATES, STATE_ORDER };

if (require.main === module) {
  try {
    const r = createRouter();
    const roleCount = Object.keys(r.castings.roles).length;
    const rungCount = Object.values(r.castings.roles).reduce((n, role) => n + Object.keys(role.rungs || {}).length, 0);
    console.log(
      'router OK: ' + r.registry.classes.length + ' classes routed to ' + roleCount + ' roles, ' +
      rungCount + ' casting rungs, review matrix loaded (terra T1 qualified: ' + r.castings.reviewMatrix.terraT1Qualified + '), ' +
      'mandate active per WO-2: ' + r.castings.liveness.mandateActive
    );
  } catch (e) {
    console.error(String(e.message || e));
    process.exitCode = 1;
  }
}
