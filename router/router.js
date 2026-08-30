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
  return Math.max(dynamic, floor);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
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

  let castings;
  try {
    castings = JSON.parse(fs.readFileSync(castingsFile, 'utf8'));
  } catch (e) {
    throw new Error('router refused: castings.json unreadable or unparseable: ' + e.message);
  }

  const problems = [];
  const fail = (m) => problems.push(m);

  // ---- family / bucket lookups ------------------------------------------
  const familyByModel = new Map();
  for (const fam of FAMILIES) {
    for (const model of (castings.families || {})[fam] || []) familyByModel.set(model, fam);
  }
  const familyOf = (model) => familyByModel.get(model) || null;
  const bucketsFor = (model) => (castings.modelBuckets || {})[model] || null;

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
      if (!rung.vendor || !rung.model || !rung.effort) { fail(name + '.' + rungName + ' incomplete'); continue; }
      const fam = familyOf(rung.model);
      if (!fam) fail(name + '.' + rungName + ' names unknown model ' + rung.model);
      else if (fam !== rung.vendor) fail(name + '.' + rungName + ' vendor ' + rung.vendor + ' disagrees with model family ' + fam);
      if (never.has(rung.model)) fail(name + '.' + rungName + ' violates the role’s own never-rule: ' + rung.model);
      if (!bucketsFor(rung.model)) fail(name + '.' + rungName + ' model has no bucket mapping: ' + rung.model);
      const ladder = (castings.effortLadders || {})[rung.vendor] || [];
      const specials = (castings.effortLadders || {}).specials || [];
      const parts = String(rung.effort).split('–'); // en-dash range
      for (const p of parts) {
        if (!ladder.includes(p) && !specials.includes(p)) {
          fail(name + '.' + rungName + ' effort ' + JSON.stringify(rung.effort) + ' is off the ' + rung.vendor + ' ladder');
        }
      }
    }
    if (!role.computed && !role.substrate && Object.keys(role.rungs || {}).length === 0) {
      fail('role ' + name + ' has no rungs and is neither computed nor a substrate');
    }
  }
  for (const c of registry.classes) {
    if (!classToRole.has(c.id)) fail('active class has no casting-table entry: ' + c.id);
  }
  const q0cfg = castings.q0Triggers || {};
  for (const id of [].concat(q0cfg.classes || [], q0cfg.sourceChangeClasses || [], (q0cfg.calibrationSample || {}).classes || [])) {
    if (!activeById.has(id)) fail('Q0 trigger names unknown class ' + id);
  }
  const rm = castings.reviewMatrix || {};
  for (const fam of ['anthropic', 'openai', 'human']) {
    if (!rm[fam]) fail('review matrix missing the ' + fam + ' author row');
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
      if (!roles[name]) fail('charter names unknown role ' + name);
    }
  }

  if (problems.length > 0) {
    throw new Error('router refused: casting tables invalid (' + problems.length + ' violation(s)):\n  - ' + problems.join('\n  - '));
  }

  const aliasById = new Map(registry.aliases.map((a) => [a.id, a.resolvesTo]));
  const ladderCfg = castings.poolStateLadder;

  // ---- buckets normalization --------------------------------------------
  // Input: { 'AU-all': X, 'AU-opus': X, 'AU-fable': X, 'OU': X } where X is a
  // state name, a Quartermaster reading, or { state, belowReserve,
  // quartermasterConfirmation }. All four buckets are required — a missing
  // bucket fails closed rather than assuming Green.
  function normalizeBuckets(buckets) {
    if (!buckets || typeof buckets !== 'object') throw new Error('bucket_state required (all of: ' + castings.buckets.join(', ') + ')');
    const out = {};
    for (const b of castings.buckets) {
      const raw = buckets[b];
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
    return classToRole.get(resolveClass(id));
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

  // ---- cast(role, bucket_state) → (vendor, model, effort) ---------------
  // The degradation machine: Green dispatches the requested rung; Amber
  // re-casts authoring to the healthy pool's mirror; Orange suspends
  // authoring on the bucket and defers ceiling rungs; Red/Exhausted permit
  // only closing calls. Declared no-mirror halves (E4 irreversible, M0
  // video/audio) wait or return typed UNAVAILABLE — never a substitute.
  function cast(roleName, buckets, castOpts) {
    const o = castOpts || {};
    const role = roles[roleName];
    if (!role) throw new Error('unknown role: ' + JSON.stringify(roleName));
    if (role.computed) throw new Error(roleName + ' casting is computed from the author family set — use reviewer(), never cast()');
    if (role.substrate) {
      return { ok: true, substrate: true, role: roleName, casting: { vendor: 'none', model: 'deterministic', effort: 'none' }, modelAssist: role.modelAssist, note: 'deterministic substrate — code first; model assist only per its contract' };
    }
    const nb = normalizeBuckets(buckets);
    const purpose = o.purpose || 'authoring';

    // Declared no-mirror halves refuse before any rung is consulted.
    if (roleName === 'Archivist' && (o.rung === 'videoAudio' || o.medium === 'videoAudio')) {
      return { ok: false, outcome: 'UNAVAILABLE', role: roleName, reason: role.noMirrorFor.videoAudio };
    }
    if (roleName === 'Data Engineer' && o.rung === 'reversibleT1' && o.risk && o.risk !== 'T1') {
      return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'Terra is permitted only for reversible T1 sub-work — ' + role.noMirrorFor.irreversible };
    }

    // Rung selection.
    let rungName = o.rung;
    if (!rungName && roleName === 'Test Designer') {
      const fam = o.implementationAuthorFamily;
      if (!fam || !AUTHOR_FAMILIES.includes(fam)) {
        throw new Error('Test Designer casting needs implementationAuthorFamily (anthropic|openai|human) — Q0 is Director-created and cast opposite the author');
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
    const rung = (role.rungs || {})[rungName];
    if (!rung) throw new Error(roleName + ' has no rung ' + JSON.stringify(rungName));

    // Hard guardrails that no pool state relaxes.
    if (roleName === 'Builder' && rungName === 'preferredBounded' && o.underSpecified) {
      return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: 'Luna never receives under-specified work — the guardrail survives the promotion; route the order to the Sonnet lane or back to A0' };
    }
    if (roleName === 'Architect' && o.securitySensitive && familyOf(rung.model) === 'anthropic') {
      return { ok: false, outcome: 'FORBIDDEN', role: roleName, reason: role.securityRouteFilter };
    }

    const state = effectiveState(rung.model, nb);
    const result = (rg, name, extra) => Object.assign({
      ok: true, role: roleName, rung: name,
      casting: { vendor: rg.vendor, model: rg.model, effort: rg.effort },
      note: rg.note, bucketState: state,
    }, extra || {});

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
      roleName === 'Data Engineer' && (o.irreversible || o.risk === 'T2' || o.risk === 'T3')
        ? role.noMirrorFor.irreversible
        : null;
    if (noMirrorReason) {
      return { ok: false, outcome: 'WAIT', role: roleName, rung: rungName, reason: noMirrorReason + ' (bucket ' + state + ')' };
    }
    const mirror = (role.rungs || {}).mirror;
    const fallbackName = mirror ? 'mirror' : (roleName === 'Data Engineer' && o.risk === 'T1' ? 'reversibleT1' : null);
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

  // ---- review policy (§3.4) ---------------------------------------------
  function reviewPolicy(classId, risk, flags) {
    const f = flags || {};
    if (f.inert) return 'none';
    const cls = resolveClass(classId);
    const mr = castings.mandatoryReview;
    if (mr.riskTiers.includes(risk)) return 'mandatory';
    if (mr.classes.includes(cls)) return 'mandatory';
    for (const flag of mr.flags) if (f[flag]) return 'mandatory';
    const touches = f.touches || [];
    if (touches.some((t) => castings.securityTriggerList.includes(t))) return 'mandatory';
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
    if (!['T0', 'T1', 'T2', 'T3'].includes(risk)) throw new Error('unknown risk tier: ' + JSON.stringify(risk));
    const nb = normalizeBuckets(o.buckets || allGreen());

    const raw = authorFamilies === undefined || authorFamilies === null ? [] : [].concat(authorFamilies);
    const unattributed = raw.length === 0 || raw.some((f) => !AUTHOR_FAMILIES.includes(f)) || o.unattributed === true;
    const famSet = new Set(raw.filter((f) => AUTHOR_FAMILIES.includes(f)));
    const modelFams = FAMILIES.filter((f) => famSet.has(f));

    const guard = (casting, extra) => {
      const fam = familyOf(casting.model);
      if (famSet.has(fam)) {
        throw new Error('no-self-family violated: reviewer ' + casting.model + ' (' + fam + ') against author set [' + [...famSet].join(', ') + '] — refusing');
      }
      return Object.assign({ closes: true, casting, reviewerFamily: fam, review_cross_family: true, gate: preDispatchGate(casting, nb) }, extra || {});
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
    const cfg = castings.q0Triggers;
    if (cfg.classes.includes(cls)) return { required: true, reason: 'every ' + cls + ' change (class trigger)' };
    const touches = order.touches || [];
    const hit = touches.find((t) => cfg.touchAreas.includes(t));
    if (hit) return { required: true, reason: hit + ' change regardless of nominal tier (touch trigger)' };
    if (cfg.riskTiers.includes(order.risk) && cfg.sourceChangeClasses.includes(cls)) {
      return { required: true, reason: 'every ' + order.risk + ' source change (tier trigger)' };
    }
    const cal = cfg.calibrationSample;
    if (cal.riskTiers.includes(order.risk) && cal.classes.includes(cls)) {
      if (fnv1a(String(order.task_id)) % 100 < cal.rate * 100) {
        return { required: true, reason: 'calibration sample (' + cal.rate * 100 + '% of T1 ' + cal.classes.join('/') + ' work; deterministic on task_id)' };
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
        author_family: castResult.ok ? familyOf(castResult.casting.model) : null,
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
    const roleName = classToRole.get(cls);
    const role = roles[roleName];

    // Context shape is dispatcher-enforced (§2.0): a shape the seat may not
    // be handed is rejected outright, not truncated.
    if (order.context_shape !== undefined) {
      if (!castings.contextShapes.includes(order.context_shape)) {
        return { ok: false, rejected: 'context-shape', reason: 'unknown context shape ' + JSON.stringify(order.context_shape) };
      }
      if (!role.contextShapes.includes(order.context_shape)) {
        return { ok: false, rejected: 'context-shape', reason: roleName + ' (' + cls + ') may not be handed ' + JSON.stringify(order.context_shape) + ' — maximum shapes: [' + role.contextShapes.join(', ') + ']' };
      }
    }

    const policy = reviewPolicy(cls, order.risk, o.flags);

    // Casting for the executor, through the degradation machine…
    const casting = role.computed
      ? null
      : cast(roleName, buckets, Object.assign({ risk: order.risk, purpose: o.purpose || 'authoring' }, o.castOpts));

    // Automatic Q0: created with the implementation order, cast opposite the
    // family that will actually author it; a missing required Q0 blocks the
    // work — a policy violation, not a shortcut.
    const q0 = q0Required(order);
    let q0Companion = null;
    if (q0.required) {
      if (o.q0OrderPresent === false) {
        return { ok: false, blocked: 'Q0', reason: 'required Q0 order missing (' + q0.reason + ') — a policy violation, not a shortcut; Q0 is Director-created' };
      }
      q0Companion = createQ0Order(order, buckets, {
        implementationAuthorFamily: (casting && casting.ok && !casting.substrate) ? familyOf(casting.casting.model) : order.author_family,
      });
      q0Companion.trigger = q0.reason;
    }

    // …then the mechanical pre-dispatch gate on whatever came out.
    let gate = { allowed: true };
    if (casting && casting.ok && !casting.substrate) {
      gate = preDispatchGate(casting.casting, buckets);
      if (!gate.allowed) {
        return { ok: false, outcome: 'GATED', gate, role: roleName, class: cls, q0: q0Companion, reason: gate.reason };
      }
    }
    if (casting && !casting.ok) {
      return { ok: false, outcome: casting.outcome, role: roleName, class: cls, q0: q0Companion, reason: casting.reason };
    }

    // Prospective review of the artifact this order will produce, computed
    // from the family that will author it (plus recorded co-authors).
    const authorFams = role.computed
      ? (o.reviewOf && o.reviewOf.authorFamilies)
      : [familyOf(casting.casting.model)].concat(order.co_author_families || []);
    const review = policy === 'none'
      ? { closes: true, policy: 'none', reason: 'provably inert — lint + targeted checks; inertness verified from the diff first' }
      : reviewer(authorFams, order.risk, { policy, buckets, terraT1Qualified: o.terraT1Qualified, authorModel: casting && casting.ok ? casting.casting.model : undefined, unattributed: o.flags && o.flags.unattributed });

    return { ok: true, class: cls, role: roleName, casting: casting, gate, review_policy: policy, review, q0: q0Companion };
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

  function allGreen() {
    const out = {};
    for (const b of castings.buckets) out[b] = 'Green';
    return out;
  }

  return {
    registry, castings, charters, problems: [],
    route, resolveClass, cast, reviewer, reviewPolicy, dispatch, processReclassify,
    poolState: (r) => poolState(r, ladderCfg),
    preDispatchGate, q0Required, createQ0Order,
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
