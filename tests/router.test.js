#!/usr/bin/env node
/**
 * WO-6 router tests — the order's unit proof, verbatim:
 *
 *   "no-self-family holds for every author family; no mandatory-class
 *    dispatch can produce a same-family closing verdict under any bucket
 *    state including Red/exhausted; context-shape violations rejected;
 *    every rung yields its documented casting set; every trigger-matching
 *    implementation spawns Q0."
 *
 * Plus: the pool-state machine's thresholds and forced-Red inputs, the
 * degradation recasts, the pre-dispatch AU-O/AU-F gate, the hard
 * never-rules under every state, and fail-closed loading over a tampered
 * registry or casting table.
 *
 * The EXPECTED_RUNGS table below is transcribed from final-plan.md Part 2
 * by hand — deliberately duplicating castings.json so the two are checked
 * against each other, not against themselves.
 *
 *   node tests/router.test.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MASTER = path.resolve(__dirname, '..');
const { createRouter, poolState, requiredReserve, fnv1a, STATES, STATE_ORDER } = require(path.join(MASTER, 'router', 'router.js'));

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
process.on('exit', () => {
  for (const fn of cleanups) { try { fn(); } catch (e) { /* best effort */ } }
  if (failures > 0) process.exitCode = 1;
  else if (passes === 0) {
    console.log('\nFAILED — no checks ran at all (the suite did not execute)');
    process.exitCode = 1;
  }
});

const router = createRouter();
// WO-14b: Sweeper is BENCHED (defaultEnabled: false) on the default router —
// a dedicated router with the seat override re-enabled is needed for the
// documented-casting-set checks and any direct Sweeper cast()/dispatch()
// exercise; DISABLED behavior itself is proved against the default router.
const routerSweeperOn = createRouter({ seats: { Sweeper: true } });
const G = router.allGreen();
const FAM_OF = (m) => router.familyOf(m);

function buckets(overrides) { return Object.assign(router.allGreen(), overrides); }
function order(cls, risk, extra) {
  return Object.assign({ task_id: 't-' + cls + '-' + risk, parent_id: null, class: cls, risk, author_family: 'anthropic', co_author_families: [], goal: 'g', acceptance_criteria: ['a'], review_policy: 'mandatory', integrity_nonce: 'deadbeefdeadbeef' }, extra || {});
}

// ---------------------------------------------------------------- 1. loading
section('1. Loading fails closed');

// WO-14b readiness-repair tranche (owner rulings, 2026-09-01): twelve roles
// retired, merged into Builder/Investigator or (A1) a documented workflow —
// eleven live roles remain (the roster's Keep list).
check('router loads clean over the shipped registry + casting tables', !!router.registry && Object.keys(router.castings.roles).length === 11);

{
  // Tampered registry (a class removed) must refuse to construct a router.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-reg-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  const reg = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'classes.json'), 'utf8'));
  reg.classes = reg.classes.filter((c) => c.id !== 'E7');
  fs.writeFileSync(path.join(dir, 'classes.json'), JSON.stringify(reg), 'utf8');
  for (const f of fs.readdirSync(path.join(MASTER, 'registry', 'schemas'))) {
    fs.copyFileSync(path.join(MASTER, 'registry', 'schemas', f), path.join(dir, 'schemas', f));
  }
  let threw = null;
  try { createRouter({ registryBaseDir: dir }); } catch (e) { threw = e; }
  check('tampered registry (E7 removed) → router refuses to construct', !!threw && /registry invalid/.test(threw.message));
}

function tamperedCastings(mutate) {
  const c = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'castings.json'), 'utf8'));
  mutate(c);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-cast-')), 'castings.json');
  cleanups.push(() => fs.rmSync(path.dirname(file), { recursive: true, force: true }));
  fs.writeFileSync(file, JSON.stringify(c), 'utf8');
  let threw = null;
  try { createRouter({ castingsFile: file }); } catch (e) { threw = e; }
  return threw;
}
check('tampered castings: E7 mirror re-cast to Fable → refused (never-rule)',
  (() => { const e = tamperedCastings((c) => { c.roles['Red Team'].rungs.mirror = { vendor: 'anthropic', model: 'Fable 5', effort: 'high' }; }); return !!e && /never-rule/.test(e.message); })());
check('tampered castings: a role deleted → refused (class without an entry)',
  (() => { const e = tamperedCastings((c) => { delete c.roles.Sweeper; }); return !!e && /no casting-table entry: S0/.test(e.message); })());
check('tampered castings: vendor/family mismatch → refused',
  (() => { const e = tamperedCastings((c) => { c.roles.Builder.rungs.primary.vendor = 'openai'; }); return !!e && /disagrees with model family/.test(e.message); })());
check('tampered castings: effort off the vendor ladder → refused',
  (() => { const e = tamperedCastings((c) => { c.roles.Builder.rungs.primary.effort = 'ultra'; }); return !!e && /off the anthropic ladder/.test(e.message); })());

// ------------------------------------------------------------ 2. route(class)
section('2. route(class) → role');

// WO-14b leg 2b: twelve classes route through a mergedClasses target instead
// of a dedicated role (A1 → no role at all, the retired workflow).
const EXPECTED_ROLES = {
  O0: 'Conductor', A0: 'Architect', N0: 'Investigator', N1: 'Investigator',
  N2: 'Investigator', I0: 'Investigator', M0: 'Investigator', E0: 'Builder', E1: 'Builder',
  E2: 'Builder', E3: 'Builder', E4: 'Data Engineer', E5: 'Builder',
  E6: 'Builder', E7: 'Red Team', E8: 'Builder', Q0: 'Test Designer',
  D0: 'Builder', R0: 'Reviewer', S0: 'Sweeper', V0: 'Verifier', P0: 'Quartermaster',
};
{
  let bad = [];
  for (const [cls, role] of Object.entries(EXPECTED_ROLES)) {
    if (router.route(cls) !== role) bad.push(cls + '→' + router.route(cls));
  }
  check('all 22 non-retired-workflow active classes route to their documented (or merged) role', bad.length === 0, bad.join(', '));
  check('A1 routes to no role — the retired workflow carries no casting', router.route('A1') === undefined);
}
check('alias I1 routes to the Investigator (merged class)', router.route('I1') === 'Investigator');
check('unknown class identifier is rejected', (() => { try { router.route('Z9'); return false; } catch (e) { return /unknown class/.test(e.message); } })());

// --------------------------------------- 3. documented casting set, per rung
section('3. Every rung yields its documented casting set (Part 2, transcribed)');

// vendor|model|effort — transcribed from final-plan.md Part 2 by hand.
const EXPECTED_RUNGS = {
  'Conductor': { primary: 'anthropic|Fable 5|owner-set', mirror: 'openai|GPT-5.6 Sol|matched' },
  'Architect': { primary: 'openai|GPT-5.6 Sol|xhigh', nebulous: 'anthropic|Fable 5|high–xhigh', exhaustionFallback: 'anthropic|Opus 5|high', mirror: 'anthropic|Fable 5|high–xhigh', ceilingAnthropic: 'anthropic|Fable 5|xhigh', ceilingOpenai: 'openai|GPT-5.6 Sol|max' },
  'Investigator': { primary: 'anthropic|Opus 5|high', mirror: 'openai|GPT-5.6 Sol|high', ceiling: 'anthropic|Fable 5|high' },
  'Builder': {
    preferredBounded: 'openai|GPT-5.6 Luna|xhigh–max', primary: 'anthropic|Sonnet 5|med', dense: 'anthropic|Sonnet 5|high', mirror: 'openai|GPT-5.6 Terra|med',
    denseMirror: 'openai|GPT-5.6 Terra|high', denseOverrideSol: 'openai|GPT-5.6 Sol|med', deepPrimary: 'anthropic|Opus 5|high', deepOverrideSol: 'openai|GPT-5.6 Sol|high',
  },
  'Data Engineer': { primary: 'anthropic|Opus 5|high', reversibleT1: 'openai|GPT-5.6 Terra|high' },
  'Red Team': { primary: 'openai|GPT-5.6 Sol|high', threatModel: 'openai|GPT-5.6 Sol|max', mirror: 'anthropic|Opus 5|high' },
  'Test Designer': { vsAnthropicAuthor: 'openai|GPT-5.6 Terra|med', vsOpenaiAuthor: 'anthropic|Sonnet 5|med' },
  'Sweeper': { primary: 'openai|GPT-5.6 Terra|med', mirror: 'anthropic|Sonnet 5|med' },
};
{
  let bad = [];
  let count = 0;
  for (const [role, rungs] of Object.entries(EXPECTED_RUNGS)) {
    for (const [rung, expected] of Object.entries(rungs)) {
      count++;
      const qc = buckets({ 'AU-opus': { state: 'Green', quartermasterConfirmation: true } });
      const rt = role === 'Sweeper' ? routerSweeperOn : router;
      const r = rt.cast(role, qc, { rung });
      const got = r.ok ? [r.casting.vendor, r.casting.model, r.casting.effort].join('|') : '<' + r.outcome + '>';
      if (got !== expected) bad.push(role + '.' + rung + ': ' + got + ' ≠ ' + expected);
    }
  }
  check('all ' + count + ' documented rungs yield their documented (vendor, model, effort) at Green', bad.length === 0, bad.join('\n'));
  // No undocumented extra rungs hiding in the tables either.
  let extra = [];
  for (const [role, def] of Object.entries(router.castings.roles)) {
    if (def.computed || def.substrate) continue;
    for (const rung of Object.keys(def.rungs)) {
      if (!EXPECTED_RUNGS[role] || !EXPECTED_RUNGS[role][rung]) extra.push(role + '.' + rung);
    }
  }
  check('no undocumented rung exists in the casting tables', extra.length === 0, extra.join(', '));
}
check('R0 casting is computed, never static — cast(Reviewer) refuses', (() => { try { router.cast('Reviewer', G); return false; } catch (e) { return /use reviewer\(\)/.test(e.message); } })());
check('V0 and P0 are deterministic substrates', router.cast('Verifier', G).substrate === true && router.cast('Quartermaster', G).substrate === true);
// Archivist (M0) is retired as a role (WO-14b readiness-repair tranche);
// its declared videoAudio no-mirror exception was a per-rung refusal on
// that role and has no restated equivalent on merged M0-mode Investigator
// work in this order's spec — removed, not silently dropped.
check('an unknown role is a typed throw, not a silent no-op (Archivist retired, merged into Investigator/M0)',
  (() => { try { router.cast('Archivist', G, { medium: 'videoAudio' }); return false; } catch (e) { return /unknown role/.test(e.message); } })());
check('Q0 vs human author takes the healthier pool, tie → the Anthropic lane',
  router.cast('Test Designer', G, { implementationAuthorFamily: 'human' }).casting.model === 'Sonnet 5' &&
  router.cast('Test Designer', buckets({ 'AU-all': 'Amber' }), { implementationAuthorFamily: 'human' }).casting.model === 'GPT-5.6 Terra');
check('Luna never receives under-specified work (guardrail survives every state)',
  router.cast('Builder', G, { rung: 'preferredBounded', underSpecified: true }).outcome === 'FORBIDDEN');
check('security-sensitive planning is a hard route-filter away from the Fable casting',
  router.cast('Architect', G, { rung: 'nebulous', securitySensitive: true }).outcome === 'FORBIDDEN' &&
  router.cast('Architect', G, { rung: 'primary', securitySensitive: true }).ok === true);

// -------------------------------------------------- 4. the pool-state machine
section('4. Pool-state machine (§5.5) and degradation recasts');

check('thresholds: ≥40% Green, 20–40% Amber, 8–20% Orange, <8% Red',
  poolState({ remainingFraction: 0.4 }) === 'Green' && poolState({ remainingFraction: 0.399 }) === 'Amber' &&
  poolState({ remainingFraction: 0.2 }) === 'Amber' && poolState({ remainingFraction: 0.199 }) === 'Orange' &&
  poolState({ remainingFraction: 0.08 }) === 'Orange' && poolState({ remainingFraction: 0.079 }) === 'Red');
check('reserve breach and observed throttle each force Red regardless of fraction',
  poolState({ remainingFraction: 0.9, reserveBreached: true }) === 'Red' &&
  poolState({ remainingFraction: 0.9, throttleObserved: true }) === 'Red');
check('exhausted trumps everything', poolState({ remainingFraction: 0.9, exhausted: true }) === 'Exhausted');
check('a reading without remainingFraction fails closed', (() => { try { poolState({}); return false; } catch (e) { return /fail closed/.test(e.message); } })());
check('a missing bucket fails closed, never assumed Green',
  (() => { try { router.cast('Builder', { 'AU-all': 'Green' }); return false; } catch (e) { return /fail closed/.test(e.message); } })());
check('dynamic reserve: floored at max(8% of bucket, two gate-class reviews) with the 30% buffer',
  Math.abs(router.requiredReserve({ mandatoryReviewDraw: 0.10, incidentDraw: 0.02 }) - 0.156) < 1e-9 &&
  router.requiredReserve({ mandatoryReviewDraw: 0.01, incidentDraw: 0 }) === 0.08);

check('Green: primary castings dispatch as requested',
  router.cast('Investigator', G).casting.model === 'Opus 5');
check('Amber on the authoring bucket re-casts to the healthy pool mirror',
  (() => { const r = router.cast('Investigator', buckets({ 'AU-opus': 'Amber' })); return r.ok && r.rung === 'mirror' && r.casting.model === 'GPT-5.6 Sol'; })());
check('Amber leaves review on the same bucket unchanged (last thing to sacrifice)',
  (() => { const r = router.cast('Investigator', buckets({ 'AU-opus': { state: 'Amber', quartermasterConfirmation: true } }), { purpose: 'review' }); return r.ok && r.casting.model === 'Opus 5'; })());
check('Orange suspends authoring on the bucket (recast), review still draws',
  (() => {
    // Operator (E0) is retired; Red Team (E7, still a live role) carries the
    // same shape (Sol primary on OU, Opus mirror on AU-all/AU-opus).
    const b = buckets({ OU: 'Orange' });
    const a = router.cast('Red Team', b); // Sol-primary authoring → Opus mirror
    const rev = router.cast('Red Team', b, { purpose: 'review' });
    return a.ok && a.casting.model === 'Opus 5' && a.rung === 'mirror' && rev.ok && rev.casting.model === 'GPT-5.6 Sol';
  })());
check('Orange defers ceiling rungs (AU-fable stops first)',
  // Principal (E3) is retired, absorbed into the Builder deep tier, which
  // carries no ceiling rung — Investigator's own ceiling rung proves the
  // same guardrail.
  router.cast('Investigator', buckets({ 'AU-fable': 'Orange' }), { rung: 'ceiling' }).outcome === 'DEFERRED' &&
  router.cast('Architect', buckets({ 'AU-fable': 'Orange' }), { rung: 'ceilingAnthropic' }).outcome === 'DEFERRED');
check('Red permits only closing calls on the bucket; authoring recasts or waits',
  (() => {
    const b = buckets({ OU: 'Red' });
    const close = router.cast('Red Team', b, { purpose: 'closing' });
    const auth = router.cast('Red Team', b);
    return close.ok && close.casting.model === 'GPT-5.6 Sol' && auth.ok && auth.rung === 'mirror';
  })());
check('both pools Red: authoring waits (typed, never a forced casting)',
  (() => { const r = router.cast('Builder', buckets({ 'AU-all': 'Red', OU: 'Red' })); return r.ok === false && r.outcome === 'WAIT'; })());
check('E4 irreversible half has no mirror: T2 data work WAITS under Anthropic pressure, never Terra',
  (() => {
    const r = router.cast('Data Engineer', buckets({ 'AU-all': 'Orange', 'AU-opus': 'Orange' }), { risk: 'T2' });
    return r.ok === false && r.outcome === 'WAIT' && /never WHO/.test(r.reason);
  })());
check('E4 reversible T1 sub-work may take the Terra lane under pressure',
  (() => { const r = router.cast('Data Engineer', buckets({ 'AU-all': 'Orange', 'AU-opus': 'Orange' }), { risk: 'T1' }); return r.ok && r.casting.model === 'GPT-5.6 Terra'; })());
check('Terra E4 lane is FORBIDDEN at T2/T3 even when requested directly',
  router.cast('Data Engineer', G, { rung: 'reversibleT1', risk: 'T2' }).outcome === 'FORBIDDEN');
check('Conductor at AU-fable degradation re-casts to the Sol mirror from a signed checkpoint',
  (() => { const r = router.cast('Conductor', buckets({ 'AU-fable': 'Red' })); return r.ok && r.casting.model === 'GPT-5.6 Sol' && r.casting.effort === 'matched'; })());

// Never-rules hold under EVERY bucket-state combination.
{
  // Doc Writer, Researcher and Synthesizer are retired (WO-14b readiness-repair
  // tranche) — their never-rules retired with the roles; Red Team and
  // Conductor are the surviving live never-rules.
  const NEVER = { 'Red Team': ['Fable 5'], 'Conductor': ['Opus 5', 'Haiku 4.5', 'Sonnet 5', 'GPT-5.6 Luna', 'GPT-5.6 Terra'] };
  let violations = [];
  let combos = 0;
  for (const s1 of STATES) for (const s2 of STATES) for (const s3 of STATES) for (const s4 of STATES) {
    combos++;
    const b = { 'AU-all': { state: s1, quartermasterConfirmation: true }, 'AU-opus': { state: s2, quartermasterConfirmation: true }, 'AU-fable': s3, OU: s4 };
    for (const [role, banned] of Object.entries(NEVER)) {
      for (const purpose of ['authoring', 'closing']) {
        const r = router.cast(role, b, { purpose });
        if (r.ok && !r.substrate && banned.includes(r.casting.model)) {
          violations.push(role + ' cast ' + r.casting.model + ' at [' + [s1, s2, s3, s4].join(',') + '] ' + purpose);
        }
      }
    }
  }
  check('hard never-rules hold across all ' + combos + ' bucket-state combinations (never-Fable E7, never-Opus Conductor, never-Terra/Luna D0, …)', violations.length === 0, violations.slice(0, 5).join('\n'));
}

// ----------------------------------------------- 5. the pre-dispatch AU-O gate
section('5. Pre-dispatch AU-O gate (P15)');

const OPUS = { vendor: 'anthropic', model: 'Opus 5', effort: 'high' };
const FABLE = { vendor: 'anthropic', model: 'Fable 5', effort: 'owner-set' };
check('AU-opus predicted below reserve → no Opus dispatch; lawful responses are mirror or wait',
  (() => { const g = router.preDispatchGate(OPUS, buckets({ 'AU-opus': { state: 'Green', belowReserve: true } })); return g.allowed === false && g.lawfulResponses.includes('mirror') && g.lawfulResponses.includes('wait'); })());
check('below 40% AU-opus the gate arms: Opus needs Quartermaster confirmation',
  router.preDispatchGate(OPUS, buckets({ 'AU-opus': 'Amber' })).allowed === false &&
  router.preDispatchGate(OPUS, buckets({ 'AU-opus': { state: 'Amber', quartermasterConfirmation: true } })).allowed === true);
check('AU-fable below reserve re-casts the Conductor’s turns to the Sol mirror',
  (() => { const g = router.preDispatchGate(FABLE, buckets({ 'AU-fable': { state: 'Green', belowReserve: true } })); return g.allowed === false && /Sol mirror/.test(g.lawfulResponses.join(',')); })());
check('the gate is mechanical and silent at healthy state', router.preDispatchGate(OPUS, G).allowed === true);
check('dispatch() enforces the gate end-to-end (I0 order under AU-O reserve breach is GATED)',
  (() => { const d = router.dispatch(order('I0', 'T1'), buckets({ 'AU-opus': { state: 'Green', belowReserve: true } })); return d.ok === false && d.outcome === 'GATED'; })());

// ------------------------------------------ 6. reviewer() and no-self-family
section('6. reviewer(author_family, risk): no-self-family for every author family');

{
  const AUTHOR_SETS = [['anthropic'], ['openai'], ['human'], ['anthropic', 'human'], ['openai', 'human']];
  let bad = [];
  for (const fams of AUTHOR_SETS) {
    for (const risk of ['T0', 'T1', 'T2', 'T3']) {
      for (const policy of ['mandatory', 'preferred']) {
        const r = router.reviewer(fams, risk, { policy, buckets: G });
        if (r.closes && r.casting) {
          const rf = FAM_OF(r.casting.model);
          if (fams.includes(rf)) bad.push('[' + fams.join('+') + '] ' + risk + ' ' + policy + ' → ' + r.casting.model);
          if (!r.degraded && r.review_cross_family !== true) bad.push('[' + fams.join('+') + '] ' + risk + ' cross_family not set');
        }
      }
    }
  }
  check('family(reviewer) ∉ families(author + co-authors) for every author set × tier × policy', bad.length === 0, bad.join('\n'));
}
check('the documented matrix rows: anthropic→Sol·high (T1, Terra unqualified; T2/T3), openai→Sonnet·med (T1) / Opus·high (T2/T3), human→Opus·high',
  (() => {
    const a1 = router.reviewer(['anthropic'], 'T1', { policy: 'preferred', buckets: G });
    const a2 = router.reviewer(['anthropic'], 'T2', { buckets: G });
    const o1 = router.reviewer(['openai'], 'T1', { policy: 'preferred', buckets: G });
    const o3 = router.reviewer(['openai'], 'T3', { buckets: G });
    const h2 = router.reviewer(['human'], 'T2', { buckets: G });
    return a1.casting.model === 'GPT-5.6 Sol' && a1.casting.effort === 'high' &&
      a2.casting.model === 'GPT-5.6 Sol' && o1.casting.model === 'Sonnet 5' &&
      o3.casting.model === 'Opus 5' && h2.casting.model === 'Opus 5';
  })());
check('mandatory-class review takes the frontier lane even at nominal T1 (a Sol-authored mutation → Opus 5 · high)',
  router.reviewer(['openai'], 'T1', { policy: 'mandatory', buckets: G }).casting.model === 'Opus 5' &&
  router.reviewer(['anthropic'], 'T1', { policy: 'mandatory', buckets: G, terraT1Qualified: true }).casting.model === 'GPT-5.6 Sol');
check('the Terra T1 relief lane exists only behind the WO-12f qualification flag, preferred band only',
  router.castings.reviewMatrix.terraT1Qualified === false &&
  router.reviewer(['anthropic'], 'T1', { policy: 'preferred', buckets: G, terraT1Qualified: true }).casting.model === 'GPT-5.6 Terra' &&
  router.reviewer(['anthropic'], 'T1', { policy: 'preferred', buckets: G }).casting.model === 'GPT-5.6 Sol');
check('human-authored T3 adds the Sol second opinion',
  (() => { const r = router.reviewer(['human'], 'T3', { buckets: G }); return r.secondOpinion && r.secondOpinion.model === 'GPT-5.6 Sol'; })());
check('unattributed provenance fails closed at mandatory class (both families concur, or a named human)',
  (() => { const r = router.reviewer([], 'T2', { policy: 'mandatory', buckets: G }); return r.closes === false && /both families/.test(r.options.join('|')); })());
check('both-family authorship: no independent family → named human only',
  (() => { const r = router.reviewer(['anthropic', 'openai'], 'T2', { policy: 'mandatory', buckets: G }); return r.closes === false && /named human/.test(r.options.join('|')); })());
check('unattributed T1 preferred may take only the disclosed degraded path',
  (() => { const r = router.reviewer([], 'T1', { policy: 'preferred', buckets: G }); return r.degraded === true && r.review_cross_family === false && r.disclosed === true; })());

// ------- 7. mandatory never closes same-family, under any bucket state at all
section('7. No mandatory-class dispatch produces a same-family closing verdict under ANY bucket state (incl. Red/Exhausted)');

{
  const AUTHOR_SETS = [['anthropic'], ['openai'], ['human'], ['anthropic', 'openai'], []];
  let bad = [];
  let calls = 0;
  for (const s1 of STATES) for (const s2 of STATES) for (const s3 of STATES) for (const s4 of STATES) {
    const b = { 'AU-all': s1, 'AU-opus': { state: s2, quartermasterConfirmation: true }, 'AU-fable': s3, OU: s4 };
    for (const fams of AUTHOR_SETS) {
      for (const risk of ['T1', 'T2', 'T3']) {
        calls++;
        const r = router.reviewer(fams, risk, { policy: 'mandatory', buckets: b });
        if (r.closes) {
          const rf = FAM_OF(r.casting.model);
          if (fams.includes(rf)) { bad.push('same-family close: [' + fams.join('+') + '] ' + risk + ' @[' + [s1, s2, s3, s4] + '] → ' + r.casting.model); continue; }
          if (r.degraded || r.review_cross_family !== true) { bad.push('mandatory degraded/undisclosed: [' + fams.join('+') + '] ' + risk + ' @[' + [s1, s2, s3, s4] + ']'); continue; }
          // The lane it closed on must actually have room (not Red/Exhausted).
          if (STATE_ORDER[router.effectiveState(r.casting.model, b)] >= STATE_ORDER.Red) {
            bad.push('closed on a Red/Exhausted lane: ' + r.casting.model + ' @[' + [s1, s2, s3, s4] + ']');
          }
        } else if (r.outcome !== 'DOES_NOT_CLOSE') {
          bad.push('mandatory non-close is not typed DOES_NOT_CLOSE: [' + fams.join('+') + '] ' + risk + ' @[' + [s1, s2, s3, s4] + '] → ' + r.outcome);
        }
      }
    }
  }
  check('across ' + calls + ' mandatory reviewer calls: every close is cross-family with pool room; every non-close is typed DOES_NOT_CLOSE', bad.length === 0, bad.slice(0, 5).join('\n'));
}
check('mandatory review with the cross-family lane Red does not close — wait / named human / park',
  (() => {
    const r = router.reviewer(['anthropic'], 'T2', { policy: 'mandatory', buckets: buckets({ OU: 'Red' }) });
    return r.closes === false && r.outcome === 'DOES_NOT_CLOSE' && /HOLD: cross-family review unavailable/.test(r.options.join('|'));
  })());
check('the same state on a PREFERRED order takes the disclosed same-family degraded path instead',
  (() => {
    const r = router.reviewer(['anthropic'], 'T1', { policy: 'preferred', buckets: buckets({ OU: 'Red' }), authorModel: 'Sonnet 5' });
    return r.closes === true && r.degraded === true && r.review_cross_family === false && FAM_OF(r.casting.model) === 'anthropic' && r.casting.model !== 'Sonnet 5';
  })());
check('review policy: E3/E4/E7/A1 and T3 are mandatory; security touches are mandatory at any tier; routine E2 T1 is preferred; inert is none',
  router.reviewPolicy('E3', 'T1') === 'mandatory' && router.reviewPolicy('E4', 'T1') === 'mandatory' &&
  router.reviewPolicy('E7', 'T1') === 'mandatory' && router.reviewPolicy('A1', 'T1') === 'mandatory' &&
  router.reviewPolicy('E2', 'T3') === 'mandatory' && router.reviewPolicy('E2', 'T1', { touches: ['auth'] }) === 'mandatory' &&
  router.reviewPolicy('E2', 'T1') === 'preferred' && router.reviewPolicy('E2', 'T1', { inert: true }) === 'none');
check('the risk-tier gate oracle fails CLOSED: a malformed tier never downgrades mandatory review',
  router.reviewPolicy('E2', 'T3 ') === 'mandatory' && router.reviewPolicy('E2', 't3') === 'mandatory' &&
  router.reviewPolicy('E2', 'T3​') === 'mandatory' && router.reviewPolicy('E2', 'bogus') === 'mandatory' &&
  router.reviewPolicy('E2', 'T1 ') === 'preferred' /* normalized, still a real tier */);
check('a malformed tier cannot dodge the Q0 tier trigger (fails closed to T3)',
  router.q0Required({ class: 'E2', risk: 'T3 ', integrity_nonce: 'x' }).required === true &&
  router.q0Required({ class: 'E2', risk: 'bogus', integrity_nonce: 'x' }).required === true);
check('dispatch(): a Sol-authored mutation gets the mandatory Opus review lane (flags.solAuthoredMutation)',
  (() => {
    // E0 (Operator) is retired and merges into Builder, whose standard-tier
    // preferred casting is Sonnet (anthropic), not Sol — Architect (A0,
    // still a live role, Sol primary) keeps the Sol-authored premise intact.
    const d = router.dispatch(order('A0', 'T1'), G, { flags: { solAuthoredMutation: true } });
    return d.ok && d.casting.casting.model === 'GPT-5.6 Sol' && d.review_policy === 'mandatory' && d.review.casting.model === 'Opus 5' && d.review.review_cross_family === true;
  })());

// ------------------------------------------------- 8. context-shape rejection
section('8. Context-shape violations rejected at dispatch');

// WO-14b leg 2 fix round, finding 7 (MINOR, fixed): merging E1 (Runner
// retired) into Builder used to let it inherit Builder's own wider shapes
// (packet/scoped/subsystem) — the "hardest constraint in the roster"
// (packet-only) did not survive the merge. mergedClasses.E1.
// contextShapesOnly restores it as an EXACT override (never additive, unlike
// E8's contextShapesAllowed below): everything past packet is rejected.
check('E1 (Runner retired, merged into Builder) keeps its packet-only ceiling as an exact override (mergedClasses.E1.contextShapesOnly) — Builder’s own wider shapes (scoped/subsystem) do not leak through',
  (() => {
    const h = router.dispatch(order('E1', 'T1', { context_shape: 'haystack' }), G);
    const s = router.dispatch(order('E1', 'T1', { context_shape: 'scoped' }), G);
    const sub = router.dispatch(order('E1', 'T1', { context_shape: 'subsystem' }), G);
    const p = router.dispatch(order('E1', 'T1', { context_shape: 'packet' }), G);
    return h.ok === false && h.rejected === 'context-shape' &&
      s.ok === false && s.rejected === 'context-shape' &&
      sub.ok === false && sub.rejected === 'context-shape' &&
      p.ok === true;
  })());
check('Scout is scoped-maximum: never haystack',
  router.dispatch(order('N0', 'T0', { context_shape: 'haystack' }), G).rejected === 'context-shape' &&
  router.dispatch(order('N0', 'T0', { context_shape: 'scoped' }), G).ok === true);
check('Conductor takes packet only', router.dispatch(order('O0', 'T1', { context_shape: 'repo' }), G).rejected === 'context-shape');
check('Builder may not be handed a repo shape',
  router.dispatch(order('E2', 'T1', { context_shape: 'repo' }), G).rejected === 'context-shape' &&
  router.dispatch(order('E2', 'T1', { context_shape: 'subsystem' }), G).ok === true);
check('an unknown shape word is rejected outright', router.dispatch(order('E2', 'T1', { context_shape: 'universe' }), G).rejected === 'context-shape');
check('the repo-shaped seats accept repo (Investigator, Reviewer)',
  router.dispatch(order('I0', 'T1', { context_shape: 'repo' }), G).ok === true &&
  router.dispatch(order('R0', 'T1', { context_shape: 'repo' }), G, { reviewOf: { authorFamilies: ['openai'] } }).ok === true);
check('E3 (Principal retired, merged into the Builder deep tier) keeps repo via mergedClasses.contextShapesAllowed — Conductor rider 2026-09-01: the merge absorbs the rung, not the shape restriction',
  (() => { const r = router.dispatch(order('E3', 'T1', { context_shape: 'repo' }), G); return r.ok === true && r.role === 'Builder' && r.tier === 'deep' && r.mode === 'E3'; })());
check('E3 still rejects a shape no Builder tier allows (haystack) — the rider adds repo only',
  router.dispatch(order('E3', 'T1', { context_shape: 'haystack' }), G).rejected === 'context-shape');
check('E8 (Refactorer retired, merged into Builder) keeps repo/haystack via mergedClasses.contextShapesAllowed',
  router.dispatch(order('E8', 'T1', { context_shape: 'repo' }), G).ok === true &&
  router.dispatch(order('E8', 'T1', { context_shape: 'haystack' }), G).ok === true);

// ------------------------------------------------------ 9. automatic Q0 spawn
section('9. Every trigger-matching implementation spawns Q0');

{
  // Class triggers: every E3, E4, E7 change at any tier.
  let bad = [];
  for (const cls of ['E3', 'E4', 'E7']) {
    for (const risk of ['T0', 'T1', 'T2', 'T3']) {
      const q = router.q0Required(order(cls, risk));
      if (!q.required) bad.push(cls + '@' + risk);
    }
  }
  check('class triggers: every E3/E4/E7 change requires Q0 at every tier', bad.length === 0, bad.join(', '));
}
{
  // Tier triggers: every T2/T3 source change.
  let bad = [];
  for (const cls of ['E0', 'E1', 'E2', 'E5', 'E6', 'E8']) {
    for (const risk of ['T2', 'T3']) {
      if (!router.q0Required(order(cls, risk)).required) bad.push(cls + '@' + risk);
    }
  }
  check('tier triggers: every T2/T3 source change requires Q0', bad.length === 0, bad.join(', '));
}
check('touch triggers: auth/authz/concurrency/persisted-data/public-API force Q0 regardless of nominal tier',
  ['auth', 'authz', 'concurrency', 'persistent-data', 'public-api'].every((t) => router.q0Required(order('E2', 'T1', { touches: [t] })).required));
check('non-triggering work spawns no Q0 (T1 E0 plain; N0 lookup; D0 doc)',
  !router.q0Required(order('E0', 'T1')).required && !router.q0Required(order('N0', 'T0')).required && !router.q0Required(order('D0', 'T1')).required);
{
  // Calibration sample: deterministic 25% of T1 E2/E5/E6, keyed on the
  // dispatcher-written integrity_nonce (NOT the requester's task_id — an
  // unkeyed hash over a caller-chosen id is grindable).
  let sampled = null, unsampled = null;
  for (let i = 0; i < 400 && (!sampled || !unsampled); i++) {
    const n = 'nonce-cal-' + i;
    if (fnv1a(n) % 100 < 25) sampled = sampled || n; else unsampled = unsampled || n;
  }
  const rIn = router.q0Required(order('E2', 'T1', { integrity_nonce: sampled }));
  const rIn2 = router.q0Required(order('E2', 'T1', { integrity_nonce: sampled }));
  const rOut = router.q0Required(order('E2', 'T1', { integrity_nonce: unsampled }));
  check('calibration: 25% of T1 E2/E5/E6 sampled, deterministically on the dispatcher nonce', rIn.required === true && rIn2.required === true && rOut.required === false);
  // The grind defense: the same task_id with different nonces samples
  // differently, so a requester cannot pick an evading id.
  check('the calibration sample cannot be gamed by a caller-chosen task_id (varying only task_id does not move the sample)',
    router.q0Required(order('E2', 'T1', { integrity_nonce: sampled, task_id: 'attacker-picks-this' })).required === true);
  check('a calibration-eligible order with no integrity_nonce samples closed (required), never open',
    router.q0Required({ class: 'E2', risk: 'T1' }).required === true);
}
{
  const d = router.dispatch(order('E4', 'T2'), G);
  const q = d.q0;
  check('dispatching a triggering order creates the Q0 companion, Director-created',
    d.ok && q && q.director_created === true && q.never_implementer_spawned === true && q.order.class === 'Q0');
  check('the Q0 companion is cast opposite the implementation author’s family',
    q && FAM_OF(q.order.requested_casting.model) !== FAM_OF(d.casting.casting.model) &&
    q.order.requested_casting.model === 'GPT-5.6 Terra');
  const blocked = router.dispatch(order('E4', 'T2'), G, { q0OrderPresent: false });
  check('a missing required Q0 order BLOCKS the work — a policy violation, not a shortcut',
    blocked.ok === false && blocked.blocked === 'Q0');
}
{
  // Sweep: for every implementation class × tier × touch shape, a
  // trigger-matching dispatch always carries a Q0 companion. The trigger is
  // recomputed from the MINTED order the dispatch returns — the calibration
  // sample is keyed on the dispatcher-minted nonce, so the caller's copy of
  // the order cannot predict the draw (that unpredictability is the point).
  let bad = [];
  for (const cls of ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']) {
    for (const risk of ['T1', 'T2', 'T3']) {
      for (const touches of [[], ['concurrency']]) {
        const o = order(cls, risk, { touches, task_id: 'sweep-' + cls + risk + touches.length });
        const d = router.dispatch(o, G, { flags: {} });
        const need = router.q0Required(d.order || o).required;
        const spawned = !!(d.q0 && d.q0.order && d.q0.order.class === 'Q0');
        if (need && !spawned) bad.push(cls + '@' + risk + (touches.length ? '+touch' : '') + ' (outcome ' + (d.ok ? 'ok' : d.outcome || d.blocked) + ')');
        if (!need && spawned) bad.push(cls + '@' + risk + ' spawned without a trigger');
      }
    }
  }
  check('sweep: every trigger-matching implementation dispatch spawns Q0; no non-trigger dispatch does', bad.length === 0, bad.join(', '));
}
check('a Q0 order itself never re-triggers Q0', router.q0Required(order('Q0', 'T2')).required === false);

// ------------------------------------------------------------------- 10. odds
section('10. Dispatch odds and ends');

check('dispatch resolves the I1 alias before routing', (() => { const d = router.dispatch(order('I1', 'T1'), buckets({ 'AU-opus': { state: 'Green', quartermasterConfirmation: true } })); return d.ok && d.role === 'Investigator' && d.class === 'I0'; })());
check('dispatch of an unknown class is rejected, not guessed', router.dispatch(order('X9', 'T1'), G).rejected === 'class');
check('an R0 order without author families fails closed (unattributed review)',
  (() => { const d = router.dispatch(order('R0', 'T2'), G); return d.ok && d.review.closes === false; })());
check('an R0 order with author families computes the matrix lane',
  (() => { const d = router.dispatch(order('R0', 'T2'), G, { reviewOf: { authorFamilies: ['openai'] } }); return d.ok && d.review.casting.model === 'Opus 5'; })());
check('inert verification tier takes no model review', (() => { const d = router.dispatch(order('E2', 'T1'), G, { flags: { inert: true } }); return d.ok && d.review.policy === 'none'; })());

// ------------------------------------- 11. RECLASSIFY hop machinery, charters
section('11. RECLASSIFY hop machinery and seat charters');

check('every role carries a charter with a non-empty must-not-receive filter (substrates exempt)',
  (() => {
    const ch = router.charters.charters;
    return Object.keys(router.castings.roles).every((r) => ch[r] && (ch[r].substrate || ch[r].mustNotReceive.length > 0));
  })());
check('a missing charter fails the load closed',
  (() => {
    const ch = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'charters.json'), 'utf8'));
    delete ch.charters.Builder;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-chart-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'charters.json');
    fs.writeFileSync(file, JSON.stringify(ch), 'utf8');
    let threw = null;
    try { createRouter({ chartersFile: file }); } catch (err) { threw = err; }
    return !!threw && /no charter entry/.test(threw.message);
  })());
// WO-14b leg 2 fix round, finding 8 (MINOR, fixed): router.charters used to
// expose 23 entries (11 live + 12 retired, tolerated via RETIRED_ROLE_NAMES)
// even though only 11 roles are routable. The retired entries are deleted
// from charters.json and the tolerance list is gone — the cross-check is
// strict again: exactly the 11 live roles, and an extra/unknown charter
// entry (a retired-role leftover, or any other drift) fails load closed,
// same as a missing one does.
check('finding 8: router.charters exposes exactly the 11 live roles — no retired-role entries (Synthesizer, Scout, Principal, …) leak through',
  (() => {
    const names = Object.keys(router.charters.charters);
    const retired = ['Synthesizer', 'Scout', 'Researcher', 'LC Analyst', 'Archivist', 'Operator', 'Runner', 'Principal', 'Interface Artisan', 'Spatial Specialist', 'Refactorer', 'Doc Writer'];
    return names.length === 11 &&
      names.every((n) => Object.prototype.hasOwnProperty.call(router.castings.roles, n)) &&
      retired.every((n) => !names.includes(n));
  })());
check('finding 8: an extra charter entry (a retired role reappearing, or any unknown name) fails load closed — the tolerance list is gone',
  (() => {
    const ch = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'charters.json'), 'utf8'));
    ch.charters['Scout'] = { class: 'N0', purpose: 'x', owns: 'x', mustNotReceive: ['y'] };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-chart2-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'charters.json');
    fs.writeFileSync(file, JSON.stringify(ch), 'utf8');
    let threw = null;
    try { createRouter({ chartersFile: file }); } catch (err) { threw = err; }
    return !!threw && /charter names unknown role Scout/.test(threw.message);
  })());
{
  const misrouted = order('N2', 'T1', { task_id: 'rc-1' });
  const report = { status: 'RECLASSIFY', reclassify: { recommended_class: 'I0', evidence: 'deliverable is a causal mechanism, not a synthesis (charter: never live reproduction/causality)' } };
  const qc = buckets({ 'AU-opus': { state: 'Green', quartermasterConfirmation: true } });
  const r = router.processReclassify(misrouted, report, qc);
  check('hop 1 is routine: re-dispatched to the recommended class with the hop counted',
    r.escalated === false && r.hop === 1 && r.dispatch.ok && r.dispatch.role === 'Investigator' && r.order.reclassify_hops === 1);
  check('the hop feeds the per-pair ledger with the observed evidence',
    r.ledger.pair.join('/') === 'I0/N2' && /causal mechanism/.test(r.ledger.evidence));
  const second = router.processReclassify(r.order, { status: 'RECLASSIFY', reclassify: { recommended_class: 'N2', evidence: 'bounced back' } }, qc);
  check('a second hop on the same order escalates to the Conductor as a classification defect',
    second.escalated === true && second.to === 'Conductor' && second.dispatch === null);
}
check('a RECLASSIFY without evidence is rejected — the observed evidence is contractual',
  (() => { try { router.processReclassify(order('E2', 'T1'), { status: 'RECLASSIFY', reclassify: { recommended_class: 'E3' } }, G); return false; } catch (e) { return /evidence/.test(e.message); } })());
check('recommending the class the order already carries is rejected (I1 alias resolves first)',
  (() => { try { router.processReclassify(order('I1', 'T1'), { status: 'RECLASSIFY', reclassify: { recommended_class: 'I0', evidence: 'x' } }, G); return false; } catch (e) { return /already carries/.test(e.message); } })());
check('an alias in recommended_class resolves before re-dispatch',
  (() => {
    const qc = buckets({ 'AU-opus': { state: 'Green', quartermasterConfirmation: true } });
    const r = router.processReclassify(order('N0', 'T1', { task_id: 'rc-2' }), { status: 'RECLASSIFY', reclassify: { recommended_class: 'I1', evidence: 'causal question' } }, qc);
    return r.dispatch.class === 'I0' && r.dispatch.role === 'Investigator';
  })());

// -------------------------- 12. WO-14 alias layer and roster kill switch
section('12. WO-14: alias layer and the roster kill switch');

{
  const qc = buckets({ 'AU-opus': { state: 'Green', quartermasterConfirmation: true } });
  const legacyEx = router.resolveSeat('executor', { roster: 'legacy' });
  const newEx = router.resolveSeat('executor', { roster: 'new', buckets: qc });
  check('an order written against "executor" dispatches correctly under BOTH flag values',
    legacyEx.target.kind === 'legacy-agent' && legacyEx.target.agent === 'executor' && legacyEx.target.model === 'Sonnet 5' &&
    newEx.target.kind === 'new-roster' && newEx.target.role === 'Builder' && newEx.target.cast.ok && newEx.target.cast.casting.model === 'Sonnet 5');
  check('the flip is per-order, mid-session: same router, alternating flags, no reload',
    // Principal is retired (WO-14b): executor-heavy now targets the Builder
    // deep tier, which absorbed Principal's primary rung (Opus 5 · high).
    router.resolveSeat('executor-heavy', { roster: 'new', buckets: qc }).target.role === 'Builder' &&
    router.resolveSeat('executor-heavy', { roster: 'legacy' }).target.agent === 'executor-heavy' &&
    router.resolveSeat('executor-heavy', { roster: 'new', buckets: qc }).target.cast.casting.effort === 'high');
  check('executor-heavy-xhigh maps to the Builder deep tier, its legacy xhigh point downgraded to high (ledgered)',
    (() => {
      const r = router.resolveSeat('executor-heavy-xhigh', { roster: 'new', buckets: qc });
      return r.target.tier === 'deep' && r.target.cast.rung === 'deepPrimary' && r.target.cast.casting.effort === 'high' &&
        /downgrade is deliberate/.test(r.target.note || '');
    })());
  check('detective maps to the merged Investigator with the read-only pin carried',
    (() => { const r = router.resolveSeat('detective', { roster: 'new', buckets: qc }); return r.target.role === 'Investigator' && r.target.pin === 'read-only' && r.target.cast.casting.model === 'Opus 5'; })());
  check('reviewer and reviewer-codex resolve to the COMPUTED Reviewer, never a static casting',
    router.resolveSeat('reviewer', { roster: 'new' }).target.kind === 'computed-reviewer' &&
    router.resolveSeat('reviewer-codex', { roster: 'new' }).target.kind === 'computed-reviewer');
  check('executor-codex becomes Builder’s Terra mirror casting',
    router.resolveSeat('executor-codex', { roster: 'new', buckets: qc }).target.cast.casting.model === 'GPT-5.6 Terra');
  check('executor-codex-heavy targets the Builder deep tier’s override-only Sol entry, FORBIDDEN without the reserve check, Sol with it',
    (() => {
      const noCheck = router.resolveSeat('executor-codex-heavy', { roster: 'new', buckets: qc });
      const withCheck = router.resolveSeat('executor-codex-heavy', { roster: 'new', buckets: qc, castOpts: { reserveCheck: 'passed' } });
      return noCheck.target.cast.ok === false && noCheck.target.cast.outcome === 'FORBIDDEN' && /Sol override requires/.test(noCheck.target.cast.reason) &&
        withCheck.target.cast.ok === true && withCheck.target.cast.casting.model === 'GPT-5.6 Sol' && withCheck.target.cast.override === true;
    })());
  check('modeler is retired into the Builder standard tier (E6 mode, Sonnet 5 · med — the Opus casting does not survive)',
    (() => {
      const r = router.resolveSeat('modeler', { roster: 'new', buckets: qc });
      return r.target.role === 'Builder' && r.target.tier === 'standard' && r.target.cast.casting.model === 'Sonnet 5';
    })());
  check('every retired-name resolution emits ITS OWN deprecation text, under both flags',
    Object.keys(router.aliases.aliases).every((n) => {
      const dep = router.aliases.aliases[n].deprecation;
      const l = router.resolveSeat(n, { roster: 'legacy' });
      const w = router.resolveSeat(n, { roster: 'new', buckets: qc });
      return l.ledger.includes(dep) && w.ledger.includes(dep);
    }));
  check('the roster default comes from the alias map when the order carries no flag (kill-switch home position: legacy)',
    router.aliases.rosterDefault === 'legacy' && router.resolveSeat('scout', {}).target.kind === 'legacy-agent');
  check('a current role name passes through un-aliased; an unknown name is an error, not a guess',
    router.resolveSeat('Builder', { roster: 'new' }).alias === false &&
    typeof router.resolveSeat('warlock', {}).error === 'string');
  // Tampered alias maps must fail the load CLOSED — each corruption caught.
  function tamperedAliases(mutateOrRaw) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-alias-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'aliases.json');
    if (typeof mutateOrRaw === 'string') {
      fs.writeFileSync(file, mutateOrRaw, 'utf8');
    } else {
      const raw = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'aliases.json'), 'utf8'));
      mutateOrRaw(raw);
      fs.writeFileSync(file, JSON.stringify(raw), 'utf8');
    }
    try { createRouter({ aliasesFile: file }); return null; } catch (e) { return e; }
  }
  check('a rung the role lacks fails the load closed',
    (() => { const e = tamperedAliases((r) => { r.aliases.executor.new.rung = 'turbo'; }); return !!e && /does not have/.test(e.message); })());
  check('a map whose aliases key is missing fails closed (the kill switch cannot exist without it)',
    (() => { const e = tamperedAliases((r) => { delete r.aliases; }); return !!e && /kill switch cannot exist/.test(e.message); })());
  check('a file whose entire content is null fails closed at construction, not at first call',
    (() => { const e = tamperedAliases('null'); return !!e && /kill switch cannot exist/.test(e.message); })());
  check('a missing required §6.6 alias fails closed',
    (() => { const e = tamperedAliases((r) => { delete r.aliases.detective; }); return !!e && /required §6.6 alias missing: detective/.test(e.message); })());
  check('the detective pin is validated: dropped or rewritten pins fail the load',
    (() => {
      const dropped = tamperedAliases((r) => { delete r.aliases.detective.new.pin; });
      const rewritten = tamperedAliases((r) => { r.aliases.detective.new.pin = 'read-write'; });
      return !!dropped && /must carry pin "read-only"/.test(dropped.message) && !!rewritten && /unknown pin/.test(rewritten.message);
    })());
  check('an alias shadowing a live role name fails closed',
    (() => { const e = tamperedAliases((r) => { r.aliases.Builder = r.aliases.executor; }); return !!e && /shadows a live role/.test(e.message); })());
  check('two aliases claiming one legacy agent fail closed',
    (() => { const e = tamperedAliases((r) => { r.aliases.scout.legacy.agent = 'executor'; }); return !!e && /same legacy agent/.test(e.message); })());
  check('a rung declared on a computed alias fails closed',
    (() => { const e = tamperedAliases((r) => { r.aliases.reviewer.new.rung = 'primary'; }); return !!e && /computed, not pinned/.test(e.message); })());
  // The MAJOR findings of the R0-EX1 exercise review, pinned:
  check('Object.prototype keys are unknown seat names, not fabricated aliases',
    ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'].every((k) => {
      const r = router.resolveSeat(k, { roster: 'legacy' });
      return r.alias === false && typeof r.error === 'string' && r.target === null;
    }));
  check('the new-roster path without bucket_state fails closed, never fabricating Green',
    (() => { try { router.resolveSeat('executor-heavy', { roster: 'new' }); return false; } catch (e) { return /fail closed, not Green/.test(e.message); } })());
  check('the pre-dispatch AU-O gate holds on the alias path too',
    (() => {
      const r = router.resolveSeat('executor-heavy', { roster: 'new', buckets: buckets({ 'AU-opus': { state: 'Green', belowReserve: true } }) });
      return r.target.cast.ok === false && r.target.cast.outcome === 'GATED' && r.target.gate.allowed === false;
    })());
  check('caller castOpts cannot override the alias’s declared tier',
    (() => {
      const r = router.resolveSeat('executor-heavy-xhigh', { roster: 'new', buckets: qc, castOpts: { tier: 'bounded', rung: 'primary' } });
      return r.target.tier === 'deep' && r.target.cast.rung === 'deepPrimary' && r.target.cast.casting.effort === 'high';
    })());
  check('pool degradation reaches the alias path (Amber AU-opus re-casts detective to the Sol mirror)',
    (() => {
      const r = router.resolveSeat('detective', { roster: 'new', buckets: buckets({ 'AU-opus': 'Amber' }) });
      return r.target.cast.ok && r.target.cast.casting.model === 'GPT-5.6 Sol' && r.target.cast.rung === 'mirror';
    })());
  check('a falsy-but-set roster flag is rejected, never silently defaulted',
    (() => { try { router.resolveSeat('executor', { roster: '' }); return false; } catch (e) { return /never falsy-and-ignored/.test(e.message); } })());
  check('the validated config is exposed frozen — mutation cannot re-route behind the validator',
    Object.isFrozen(router.aliases) && Object.isFrozen(router.aliases.aliases.executor.new) &&
    Object.isFrozen(router.castings.roles.Builder.rungs.primary) && Object.isFrozen(router.charters.charters.Builder));
  check('the max→xhigh ceiling downgrade is carried as a ledgered note',
    (() => { const r = router.resolveSeat('architect-claude-max', { roster: 'new', buckets: qc }); return /downgrade is deliberate/.test(r.target.note || ''); })());
}

// -------- 13. WO-8 round-2 fixes (rulings 1a-adjacent, 2a, 3a, 4; A/B/C)
section('13. WO-8 round-2: inert, order-carried touches, gated reviewer, Q0 blocking, AU-F recast, risk/nonce hygiene');

check('flags.inert never overrides a mandatory class, T2/T3, an unrecognized tier, or a security touch',
  router.reviewPolicy('E7', 'T1', { inert: true }) === 'mandatory' &&
  router.reviewPolicy('E2', 'T3', { inert: true }) === 'mandatory' &&
  router.reviewPolicy('E2', 'T2', { inert: true }) === 'preferred' &&
  router.reviewPolicy('E2', 'T1', { inert: true, touches: ['auth'] }) === 'mandatory' &&
  router.reviewPolicy('E2', 'bogus', { inert: true }) === 'mandatory');
check('order-carried touches fire mandatory review AND the Q0 touch trigger through dispatch (ruling 3a)',
  (() => {
    const d = router.dispatch(order('E2', 'T1', { touches: ['auth'] }), G);
    return d.ok && d.review_policy === 'mandatory' && !!d.q0 && /touch trigger/.test(d.q0.trigger);
  })());
check('a schema-valid order can carry every touch area the triggers read (the unreachable-trigger fix)',
  (() => {
    const { validate } = require(path.join(MASTER, 'verifier', 'schema-check.js'));
    const { schemas } = require(path.join(MASTER, 'registry', 'load.js')).load();
    const union = [...new Set([].concat(router.castings.q0Triggers.touchAreas, router.castings.securityTriggerList))];
    const o = order('E2', 'T1', { touches: union, requested_casting: { vendor: 'anthropic', model: 'Sonnet 5', effort: 'med' } });
    return validate(schemas['order.schema.json'], o).length === 0;
  })());
check('caller flag touches may only ADD (union) — order-declared touches survive',
  (() => {
    const d = router.dispatch(order('E2', 'T1', { touches: ['concurrency'] }), G, { flags: { touches: ['auth'] } });
    return d.ok && d.review_policy === 'mandatory' && d.order.touches.includes('concurrency') && d.order.touches.includes('auth');
  })());
check('a drifted touches enum fails the router load closed (the schema/trigger lint)',
  (() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-touch-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
    fs.copyFileSync(path.join(MASTER, 'registry', 'classes.json'), path.join(dir, 'classes.json'));
    for (const f of fs.readdirSync(path.join(MASTER, 'registry', 'schemas'))) {
      fs.copyFileSync(path.join(MASTER, 'registry', 'schemas', f), path.join(dir, 'schemas', f));
    }
    const osJson = JSON.parse(fs.readFileSync(path.join(dir, 'schemas', 'order.schema.json'), 'utf8'));
    osJson.properties.touches.items.enum = osJson.properties.touches.items.enum.filter((t) => t !== 'auth');
    fs.writeFileSync(path.join(dir, 'schemas', 'order.schema.json'), JSON.stringify(osJson), 'utf8');
    try { createRouter({ registryBaseDir: dir }); return false; } catch (e) { return /touches enum diverges/.test(e.message); }
  })());
check('R0-EX4: the touches lint compares elements, never a joined string (a comma-bearing entry cannot collide)',
  (() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-touch2-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
    fs.copyFileSync(path.join(MASTER, 'registry', 'classes.json'), path.join(dir, 'classes.json'));
    for (const f of fs.readdirSync(path.join(MASTER, 'registry', 'schemas'))) {
      fs.copyFileSync(path.join(MASTER, 'registry', 'schemas', f), path.join(dir, 'schemas', f));
    }
    const osJson = JSON.parse(fs.readFileSync(path.join(dir, 'schemas', 'order.schema.json'), 'utf8'));
    const en = osJson.properties.touches.items.enum.filter((t) => t !== 'auth' && t !== 'authz');
    en.unshift('auth,authz'); // joins byte-identically to ['auth','authz'] under any comma join
    osJson.properties.touches.items.enum = en;
    fs.writeFileSync(path.join(dir, 'schemas', 'order.schema.json'), JSON.stringify(osJson), 'utf8');
    try { createRouter({ registryBaseDir: dir }); return false; } catch (e) { return /touches enum diverges/.test(e.message); }
  })());
check('a gated review lane does not close — closes flips with the embedded gate',
  (() => {
    const r = router.reviewer(['openai'], 'T2', { policy: 'mandatory', buckets: buckets({ 'AU-opus': { state: 'Green', belowReserve: true } }) });
    return r.closes === false && r.outcome === 'GATED' && r.gate.allowed === false && r.casting.model === 'Opus 5';
  })());
check('a required Q0 that cannot be cast BLOCKS dispatch (never a null-casting companion)',
  (() => {
    const d = router.dispatch(order('E4', 'T2'), buckets({ OU: 'Red' })); // Q0-vs-anthropic lives on Terra/OU
    return d.ok === false && d.blocked === 'Q0' && !!d.q0 && d.q0.cast.ok === false;
  })());
check('AU-fable reserve re-casts the Conductor to the Sol mirror at matched effort, disclosed with restrictions (ruling 2a)',
  (() => {
    const d = router.dispatch(order('O0', 'T1'), buckets({ 'AU-fable': { state: 'Green', belowReserve: true } }));
    return d.ok && d.casting.casting.model === 'GPT-5.6 Sol' && d.casting.casting.effort === 'matched' &&
      d.casting.recastFrom === 'primary' && d.casting.disclosed === true &&
      (d.casting.restrictions || []).some((x) => /author-and-approve/.test(x));
  })());
check('a non-Conductor Fable seat under the same reserve stays GATED (the recast is the O0 reserve path, not a bypass)',
  (() => {
    const d = router.dispatch(order('A0', 'T1'), buckets({ 'AU-fable': { state: 'Green', belowReserve: true } }), { castOpts: { rung: 'nebulous' } });
    return d.ok === false && d.outcome === 'GATED';
  })());
check('dispatch normalizes a sloppy tier onto the order AND its Q0 companion (never a schema-invalid risk downstream)',
  (() => {
    const d = router.dispatch(order('E4', 't2 '), G);
    return d.ok && d.order.risk === 'T2' && !!d.q0 && d.q0.order.risk === 'T2';
  })());
check('dispatch refuses an unrecognizable tier outright (fail closed at the door)',
  (() => { const d = router.dispatch(order('E2', 'T9'), G); return d.ok === false && d.rejected === 'risk'; })());
check('dispatch mints the integrity nonce — a caller-chosen nonce never keys the calibration draw',
  (() => {
    const d1 = router.dispatch(order('E0', 'T1'), G);
    const d2 = router.dispatch(order('E0', 'T1'), G);
    return d1.order.integrity_nonce !== 'deadbeefdeadbeef' && d1.order.integrity_nonce.length >= 16 &&
      d1.order.integrity_nonce !== d2.order.integrity_nonce;
  })());
check('reviewer() without bucket_state fails closed — no fabricated Green on the exported API (ruling C)',
  (() => { try { router.reviewer(['anthropic'], 'T2', { policy: 'mandatory' }); return false; } catch (e) { return /bucket_state/.test(e.message); } })());
check('a caller-chosen prototype-key rung hits the typed refusal, not a prototype-chain read',
  (() => { try { router.cast('Builder', G, { rung: '__proto__' }); return false; } catch (e) { return /has no rung/.test(e.message); } })());
check('inherited bucket values never satisfy the requirement (own properties only)',
  (() => { try { router.cast('Builder', Object.create(G)); return false; } catch (e) { return /fail closed/.test(e.message); } })());
check('bucketsFor never reads the prototype chain', router.bucketsFor('constructor') === null && router.bucketsFor('__proto__') === null);
// R0-EX3 findings, pinned as regressions:
check('R0-EX3: a §5.5 degradation recast never silently satisfies a P15 reserve stop (belowReserve GATES a Fable primary on the requested rung, before any degradation output is accepted)',
  (() => {
    // A1/Synthesizer is retired (WO-14b); Architect's nebulous rung is the
    // live non-Conductor Fable-authoring casting. Its own mirror is
    // SAME-family (Fable), so an Amber authoring purpose degrades to WAIT
    // rather than a cross-family recast — Green+belowReserve isolates the
    // reserve-on-the-requested-rung guarantee this pin is actually about,
    // without that same-family degradation interaction in the way.
    const d = router.dispatch(order('A0', 'T1'), buckets({ 'AU-fable': { state: 'Green', belowReserve: true } }), { castOpts: { rung: 'nebulous' } });
    return d.ok === false && d.outcome === 'GATED' && d.gate.gate === 'AU-F reserve (P15)';
  })());
check('R0-EX3: the Conductor reserve path survives Amber+belowReserve — Sol mirror, disclosed, restrictions carried',
  (() => {
    const d = router.dispatch(order('O0', 'T1'), buckets({ 'AU-fable': { state: 'Amber', belowReserve: true } }));
    return d.ok && d.casting.casting.model === 'GPT-5.6 Sol' && d.casting.disclosed === true && (d.casting.restrictions || []).length > 0;
  })());
check('R0-EX3: EVERY mirror-served Conductor turn is disclosed with restrictions (the plain-Amber degradation path too)',
  (() => {
    const d = router.dispatch(order('O0', 'T1'), buckets({ 'AU-fable': 'Amber' }));
    return d.ok && d.casting.casting.model === 'GPT-5.6 Sol' && d.casting.disclosed === true && (d.casting.restrictions || []).length > 0;
  })());
check('R0-EX3: the same requested-rung reserve stop holds for AU-opus through dispatch',
  (() => {
    const d = router.dispatch(order('I0', 'T1'), buckets({ 'AU-opus': { state: 'Amber', belowReserve: true, quartermasterConfirmation: true } }));
    return d.ok === false && d.outcome === 'GATED' && d.gate.gate === 'AU-O reserve (P15)';
  })());
check('R0-EX3: router.js source carries no control bytes (a NUL made the file read as binary to line tools)',
  !/\x00/.test(fs.readFileSync(path.join(MASTER, 'router', 'router.js'), 'utf8')));
check('cast() uses the same risk oracle as every other risk read (sloppy T1 allowed; sloppy T2 and garbage FORBIDDEN on the Terra E4 lane)',
  (() => {
    const ok = router.cast('Data Engineer', G, { rung: 'reversibleT1', risk: 't1' });
    const no = router.cast('Data Engineer', G, { rung: 'reversibleT1', risk: 'T2 ' });
    const garbage = router.cast('Data Engineer', G, { rung: 'reversibleT1', risk: 'bogus' });
    return ok.ok === true && no.outcome === 'FORBIDDEN' && garbage.outcome === 'FORBIDDEN';
  })());

// ------------------------------------- 14. readiness-repair tranche (pins)
section('14. Readiness-repair tranche: A(ii) security, D Q0-throw, F review-matrix load, G touch-trigger class gate, H fnv1a, I substrate review, C reserve parity');

// ---- A(ii): securitySensitive derived from order.touches, and the
// route-filter applies to whichever casting is actually served (requested
// rung OR a §5.5 degradation recast), never only the requested rung.
check('A(ii): securitySensitive derived from order.touches blocks a §5.5 degradation recast onto Fable — no castOpts at all (OU Amber, crypto touch)',
  (() => {
    const d = router.dispatch(order('A0', 'T1', { touches: ['crypto'] }), buckets({ OU: 'Amber' }), { q0OrderPresent: true });
    return d.ok === false && d.outcome === 'FORBIDDEN';
  })());
check('A(ii): the same derivation blocks an explicitly-requested Fable rung at Green, with no castOpts.securitySensitive set by the caller',
  (() => {
    const d = router.dispatch(order('A0', 'T1', { touches: ['auth'] }), G, { q0OrderPresent: true, castOpts: { rung: 'nebulous' } });
    return d.ok === false && d.outcome === 'FORBIDDEN';
  })());
check('A(ii): a non-security A0 still dispatches on the same Fable rung (the filter does not over-block)',
  (() => {
    const d = router.dispatch(order('A0', 'T1'), G, { q0OrderPresent: true, castOpts: { rung: 'nebulous' } });
    return d.ok === true && d.casting.casting.model === 'Fable 5';
  })());

// ---- D: dispatch() of a Q0 order (the router's own createQ0Order() output,
// or any hand-built Q0 order) casts opposite the PARENT IMPLEMENTATION's
// author family — never the Q0 order's own author_family. Finding D
// (MAJOR, fixed): the previous fix seeded castOpts.implementationAuthorFamily
// from the Q0 order's own author_family (already opposite the
// implementation), re-casting the Q0 opposite ITSELF and landing same-family
// as the implementation — Q0 independence defeated. createQ0Order() now
// stamps an explicit implementation_author_family field naming the parent
// implementation's family, and dispatch() reads THAT (never author_family).
check('D: Anthropic-authored implementation → dispatched Q0 casting vendor is openai (opposite)',
  (() => {
    const impl = order('E2', 'T2', { author_family: 'anthropic' });
    const q0 = router.createQ0Order(impl, G, { implementationAuthorFamily: 'anthropic' });
    const d = router.dispatch(q0.order, G, { q0OrderPresent: true });
    return d.ok === true && d.casting.casting.vendor === 'openai';
  })());
check('D: OpenAI-authored implementation → dispatched Q0 casting vendor is anthropic (opposite)',
  (() => {
    const impl = order('E2', 'T2', { author_family: 'openai' });
    const q0 = router.createQ0Order(impl, G, { implementationAuthorFamily: 'openai' });
    const d = router.dispatch(q0.order, G, { q0OrderPresent: true });
    return d.ok === true && d.casting.casting.vendor === 'anthropic';
  })());
check('D: the family recorded on the Q0 order\'s own author_family stays the Q0\'s own casting family, never the implementation\'s',
  (() => {
    const impl = order('E2', 'T2', { author_family: 'anthropic' });
    const q0 = router.createQ0Order(impl, G, { implementationAuthorFamily: 'anthropic' });
    return q0.order.author_family === 'openai' && q0.order.implementation_author_family === 'anthropic';
  })());
check('D: a caller-supplied castOpts.implementationAuthorFamily still wins over the order\'s own implementation_author_family',
  (() => {
    const impl = order('E2', 'T2', { author_family: 'anthropic' });
    const q0 = router.createQ0Order(impl, G, { implementationAuthorFamily: 'anthropic' });
    const d = router.dispatch(q0.order, G, { q0OrderPresent: true, castOpts: { implementationAuthorFamily: 'openai' } });
    return d.ok === true && d.casting.rung === 'vsOpenaiAuthor' && d.casting.casting.model === 'Sonnet 5';
  })());
check('D: a Q0 order with no attributable implementation_author_family is a typed ok:false refusal, never an uncaught throw',
  (() => {
    const o = order('Q0', 'T1');
    delete o.author_family;
    delete o.implementation_author_family;
    let threw = false, d;
    try { d = router.dispatch(o, G, { q0OrderPresent: true }); } catch (e) { threw = true; }
    return !threw && !!d && d.ok === false && d.rejected === 'implementationAuthorFamily';
  })());

// ---- F: load-time validation reaches reviewMatrix / degradedSameFamilyCandidates
// rows (including the nested .qualified/.untilQualified/.secondOpinion
// shapes), not only castings.roles — table-driven over every drift class.
{
  const F_DRIFTS = [
    ['same-family reviewMatrix row (anthropic author names an anthropic model)',
      (c) => { c.reviewMatrix.anthropic.T2 = { vendor: 'anthropic', model: 'Opus 5', effort: 'high' }; }, /names a same-family/],
    ['unknown model in a flat reviewMatrix row',
      (c) => { c.reviewMatrix.openai.T2 = { vendor: 'anthropic', model: 'Opus 6 Imaginary', effort: 'high' }; }, /names unknown model/],
    ['vendor/family mismatch in a reviewMatrix row',
      (c) => { c.reviewMatrix.openai.T2 = { vendor: 'openai', model: 'Opus 5', effort: 'high' }; }, /disagrees with model family/],
    ['off-ladder effort in a reviewMatrix row',
      (c) => { c.reviewMatrix.openai.T2 = { vendor: 'anthropic', model: 'Opus 5', effort: 'ludicrous' }; }, /off the anthropic ladder/],
    ['unknown model in the nested .qualified shape (anthropic T1)',
      (c) => { c.reviewMatrix.anthropic.T1.qualified = { vendor: 'openai', model: 'Opus 6 Imaginary', effort: 'med' }; }, /qualified names unknown model/],
    ['unknown model in the nested .secondOpinion shape (human T3)',
      (c) => { c.reviewMatrix.human.T3.secondOpinion = { vendor: 'openai', model: 'Nope 1', effort: 'high' }; }, /secondOpinion names unknown model/],
    ['unknown model in degradedSameFamilyCandidates',
      (c) => { c.reviewMatrix.degradedSameFamilyCandidates.anthropic = [{ vendor: 'anthropic', model: 'Nope 1', effort: 'high' }]; }, /degradedSameFamilyCandidates\.anthropic\[0\] names unknown model/],
    ['degradedSameFamilyCandidates row family drifts from its own key (an anthropic key holding valid, internally-consistent Terra/openai fields)',
      (c) => { c.reviewMatrix.degradedSameFamilyCandidates.anthropic = [{ vendor: 'openai', model: 'GPT-5.6 Terra', effort: 'med' }]; }, /is filed under degradedSameFamilyCandidates\.anthropic but names a openai model.*actual family must equal the key/],
  ];
  let bad = [];
  for (const [label, mutate, re] of F_DRIFTS) {
    const e = tamperedCastings(mutate);
    if (!e) bad.push(label + ' (loaded clean — did not refuse)');
    else if (!re.test(e.message)) bad.push(label + ' (refused, but for the wrong reason: ' + e.message.split('\n')[0] + ')');
  }
  check('F: every reviewMatrix / degradedSameFamilyCandidates drift class refuses construction, table-driven', bad.length === 0, bad.join('\n'));
}

// ---- G: the Q0 touch trigger is gated on sourceChangeClasses, exactly like
// the tier trigger already is — a read-only/doc class touching a trigger
// area does not hard-block on a missing Q0.
check('G: q0Required touch trigger does not fire for a read-only class (N0) touching auth',
  router.q0Required({ class: 'N0', risk: 'T0', touches: ['auth'] }).required === false);
check('G: q0Required touch trigger still fires for a real source-change class (E2) touching auth',
  router.q0Required({ class: 'E2', risk: 'T0', touches: ['auth'] }).required === true);
check('G: through dispatch, a read-only Scout order touching auth is no longer blocked on a missing Q0',
  (() => { const d = router.dispatch(order('N0', 'T0', { touches: ['auth'] }), G, { q0OrderPresent: false }); return d.ok === true; })());

// ---- H: fnv1a() matches the FNV-1a spec exactly (Math.imul, no lossy
// float64 intermediate past 2^53), pinned against an exact BigInt reference
// and against the downstream calibration draw's actual fire rate/spread.
// NOTE (see DEVIATIONS in the builder report): no existing test or artifact
// in this repo pins the OLD (broken) fnv1a digests — every existing
// calibration test (section 9 above) searches dynamically for a
// sampled/unsampled nonce using fnv1a() itself, so it is self-consistent
// under either the broken or the fixed implementation and needed no change.
{
  const FNV_PRIME = 16777619n, MASK = 0xffffffffn;
  function fnv1aRef(str) {
    let h = 2166136261n;
    for (let i = 0; i < str.length; i++) {
      h ^= BigInt(str.charCodeAt(i));
      h = (h * FNV_PRIME) & MASK;
    }
    return Number(h);
  }
  const VECTORS = ['', 'a', 'abc', 'nonce-cal-0', 'deadbeefdeadbeef', 'the quick brown fox',
    '0123456789abcdef0123456789abcdef', String.fromCharCode(0, 1, 2, 255, 65535)];
  const vecBad = VECTORS.filter((v) => fnv1a(v) !== fnv1aRef(v));
  check('H: fnv1a() matches the exact BigInt FNV-1a reference over a pinned vector set', vecBad.length === 0, JSON.stringify(vecBad));

  const nodeCrypto = require('crypto');
  const N = 100000;
  let hits = 0;
  const residues = new Array(100).fill(0);
  for (let i = 0; i < N; i++) {
    const h = fnv1a(nodeCrypto.randomBytes(12).toString('hex')); // same shape as the dispatcher-minted nonce
    residues[h % 100]++;
    if (h % 100 < 25) hits++;
  }
  const fireRate = hits / N;
  const emptyBuckets = residues.filter((c) => c === 0).length;
  check('H: over ' + N + ' synthetic hex nonces the q0Required calibration fire-rate lands in [24%, 26%]',
    fireRate >= 0.24 && fireRate <= 0.26, (fireRate * 100).toFixed(3) + '%');
  check('H: no mod-100 residue bucket is empty over ' + N + ' nonces (no 16x skew)', emptyBuckets === 0, emptyBuckets + ' empty buckets');
}

// ---- I: dispatching a substrate class (V0 Verifier, P0 Quartermaster) at a
// non-mandatory tier returns a typed substrate review verdict — never a
// degraded same-family model review of code that has no author family.
check('I: V0/P0 at T1 (non-mandatory) return a typed substrate review verdict, no model casting',
  (() => {
    const dv = router.dispatch(order('V0', 'T1'), G);
    const dp = router.dispatch(order('P0', 'T1'), G);
    return dv.ok && dv.review.substrate === true && dv.review.closes === true && dv.review.casting === null &&
      dp.ok && dp.review.substrate === true && dp.review.closes === true && dp.review.casting === null;
  })());
check('I: V0/P0 T2/T3 anchors unchanged — still DOES_NOT_CLOSE (unattributed provenance at mandatory class)',
  (() => {
    const t2 = router.dispatch(order('V0', 'T2'), G);
    const t3 = router.dispatch(order('P0', 'T3'), G);
    return t2.ok && t2.review.closes === false && t2.review.outcome === 'DOES_NOT_CLOSE' &&
      t3.ok && t3.review.closes === false && t3.review.outcome === 'DOES_NOT_CLOSE';
  })());

// ---- C: REPORT ONLY — the requiredReserve/redBelow parity under the
// default forecast is a known, unchanged calibration fact, not a bug fixed
// here. Pinned explicitly so it screams if either side moves silently.
check('C: KNOWN PARITY (no independent signal under the default forecast) — requiredReserve(defaultForecast()) === poolStateLadder.thresholds.redBelow === 0.08',
  (() => {
    const qm = require(path.join(MASTER, 'quartermaster', 'quartermaster.js'));
    const req = router.requiredReserve(qm.defaultForecast());
    return req === router.castings.poolStateLadder.thresholds.redBelow && req === 0.08;
  })());

// ---------------------------- 15. WO-14b leg 2b: readiness-repair tranche pins
section('15. WO-14b leg 2b: stale-family fix, Builder ladder, merged classes, toggles');

// ---- Stale-family MAJOR (router.js, cycle-2 finding): a Q0 order's
// author_family is the family of the SERVED Q0 casting at EVERY dispatch —
// after any recast — never the family stamped at creation.
{
  const impl = order('E2', 'T2', { author_family: 'human' });
  const q0 = router.createQ0Order(impl, G, { implementationAuthorFamily: 'human' });
  check('stale-family: a human-authored Q0 created while both pools are Green ties to the Anthropic lane',
    q0.order.author_family === 'anthropic' && q0.cast.casting.model === 'Sonnet 5');
  const staleBuckets = buckets({ 'AU-all': 'Amber' });
  const dRe = router.dispatch(q0.order, staleBuckets, { q0OrderPresent: true });
  check('stale-family MAJOR (cycle-2, router.js): re-dispatched after AU-all turns Amber, the Q0 serves openai/Terra and author_family is UPDATED to "openai", never the stale "anthropic" it was created with',
    dRe.ok && dRe.casting.casting.model === 'GPT-5.6 Terra' && dRe.order.author_family === 'openai' &&
    q0.order.implementation_author_family === 'human' && dRe.order.implementation_author_family === 'human');
}
{
  const impl = order('E2', 'T2', { author_family: 'anthropic' });
  const q0 = router.createQ0Order(impl, G, { implementationAuthorFamily: 'anthropic' });
  const dRe = router.dispatch(q0.order, G, { q0OrderPresent: true });
  check('stale-family mirror case (openai served): an anthropic implementation’s Q0 re-dispatched under unchanged (Green) pools serves openai/Terra and reports author_family "openai" (opposite anthropic, served)',
    dRe.ok && dRe.casting.casting.model === 'GPT-5.6 Terra' && dRe.order.author_family === 'openai');
  const implO = order('E2', 'T2', { author_family: 'openai' });
  const q0O = router.createQ0Order(implO, G, { implementationAuthorFamily: 'openai' });
  const dReO = router.dispatch(q0O.order, G, { q0OrderPresent: true });
  check('stale-family mirror case (anthropic served): an openai implementation’s Q0 serves anthropic/Sonnet and reports author_family "anthropic"',
    dReO.ok && dReO.casting.casting.model === 'Sonnet 5' && dReO.order.author_family === 'anthropic');
}

// ---- Builder ladder: each tier's preferred casting at Green; substitute
// walk at Amber on the preferred bucket (disclosed); override-only entries
// never reached by the walk; Sol override FORBIDDEN without the reserve
// check, served with it; deep at Opus below reserve GATED, no override WAIT.
check('Builder ladder: each tier’s preferred casting at Green',
  router.cast('Builder', G, { tier: 'bounded' }).casting.model === 'GPT-5.6 Luna' &&
  router.cast('Builder', G, { tier: 'standard' }).casting.model === 'Sonnet 5' &&
  router.cast('Builder', G, { tier: 'dense' }).casting.model === 'Sonnet 5' && router.cast('Builder', G, { tier: 'dense' }).casting.effort === 'high' &&
  router.cast('Builder', G, { tier: 'deep' }).casting.model === 'Opus 5' &&
  router.cast('Builder', G, {}).casting.model === 'Sonnet 5' /* default tier: standard */);
check('Builder ladder: requested is always the tier’s preferred casting, even when a substitute is served',
  (() => {
    const r = router.cast('Builder', buckets({ 'AU-all': 'Amber' }), { tier: 'standard' });
    return r.ok && r.requested.model === 'Sonnet 5' && r.requested.rung === 'primary';
  })());
check('Builder ladder: each tier’s substitute walk fires on Amber (disclosed, recastFrom set)',
  (() => {
    // bounded's preferred (Luna) and first substitute (Terra mirror) both
    // draw from OU — an OU degradation takes out both at once, so the walk
    // lands on the SECOND substitute (Sonnet, AU-all) — a real consequence
    // of the tier ladder as specified, not a test artifact.
    const bounded = router.cast('Builder', buckets({ OU: 'Amber' }), { tier: 'bounded' });
    const standard = router.cast('Builder', buckets({ 'AU-all': 'Amber' }), { tier: 'standard' }); // Sonnet (AU-all) degrades to Terra mirror
    const dense = router.cast('Builder', buckets({ 'AU-all': 'Amber' }), { tier: 'dense' }); // Sonnet dense degrades to Terra denseMirror
    return bounded.ok && bounded.casting.model === 'Sonnet 5' && bounded.rung === 'primary' && bounded.recastFrom === 'preferredBounded' &&
      standard.ok && standard.casting.model === 'GPT-5.6 Terra' && standard.rung === 'mirror' && standard.recastFrom === 'primary' &&
      dense.ok && dense.casting.model === 'GPT-5.6 Terra' && dense.casting.effort === 'high' && dense.rung === 'denseMirror' && dense.recastFrom === 'dense';
  })());
check('Builder ladder: the deep tier has no substitute — both pools degraded WAITs, never a silent walk to Sol',
  (() => { const r = router.cast('Builder', buckets({ 'AU-all': 'Amber' }), { tier: 'deep' }); return r.ok === false && r.outcome === 'WAIT' && /deep tier ladder/.test(r.reason); })());
check('Builder ladder: override-only entries (denseOverrideSol, deepOverrideSol) are never reached by the walk at any bucket state',
  (() => {
    const denseAllStates = STATES.every((s) => {
      const r = router.cast('Builder', buckets({ 'AU-all': s, OU: s }), { tier: 'dense' });
      return !(r.ok && r.casting.model === 'GPT-5.6 Sol');
    });
    const deepAllStates = STATES.every((s) => {
      const r = router.cast('Builder', buckets({ 'AU-all': s, 'AU-opus': s }), { tier: 'deep' });
      return !(r.ok && r.casting.model === 'GPT-5.6 Sol');
    });
    return denseAllStates && deepAllStates;
  })());
check('Builder ladder: a Sol override without castOpts.reserveCheck is typed FORBIDDEN, never walked',
  (() => {
    const dense = router.cast('Builder', G, { tier: 'dense', override: { rung: 'denseOverrideSol', reason: 'owner-directed' } });
    const deep = router.cast('Builder', G, { tier: 'deep', override: { rung: 'deepOverrideSol', reason: 'owner-directed' } });
    return dense.ok === false && dense.outcome === 'FORBIDDEN' && /Sol override requires/.test(dense.reason) &&
      deep.ok === false && deep.outcome === 'FORBIDDEN' && /Sol override requires/.test(deep.reason);
  })());
check('Builder ladder: a Sol override WITH castOpts.reserveCheck === "passed" is served — a deliberate choice, never a degradation target',
  (() => {
    const dense = router.cast('Builder', G, { tier: 'dense', override: { rung: 'denseOverrideSol', reason: 'owner-directed' }, reserveCheck: 'passed' });
    const deep = router.cast('Builder', G, { tier: 'deep', override: { rung: 'deepOverrideSol', reason: 'owner-directed' }, reserveCheck: 'passed' });
    return dense.ok && dense.casting.model === 'GPT-5.6 Sol' && dense.override === true &&
      deep.ok && deep.casting.model === 'GPT-5.6 Sol' && deep.override === true;
  })());
check('Builder ladder guardrail: bounded tier + underSpecified is still FORBIDDEN (Luna never receives under-specified work)',
  router.cast('Builder', G, { tier: 'bounded', underSpecified: true }).outcome === 'FORBIDDEN');
check('Builder ladder: deep tier at Opus below reserve is GATED through dispatch (P15), never silently walked',
  (() => {
    const d = router.dispatch(order('E3', 'T1'), buckets({ 'AU-opus': { state: 'Green', belowReserve: true } }));
    return d.ok === false && d.outcome === 'GATED' && d.gate.gate === 'AU-O reserve (P15)';
  })());
check('Builder ladder: deep tier with Opus gated (Amber, unconfirmed) and no override → WAIT/GATED, never a silent substitution (as Principal behaved)',
  (() => {
    const d = router.dispatch(order('E3', 'T1'), buckets({ 'AU-opus': 'Amber' }));
    return d.ok === false && (d.outcome === 'GATED' || d.outcome === 'WAIT');
  })());

// ---- Merged-class dispatch: class preserved, role/tier/mode set, review
// row taken from the CLASS (E3/E4/E7 mandatory unchanged); A1 → RETIRED_WORKFLOW.
check('merged-class dispatch: E0 preserves class E0, routes to Builder, tier standard (default), mode E0',
  (() => {
    const d = router.dispatch(order('E0', 'T1'), G);
    return d.ok && d.class === 'E0' && d.role === 'Builder' && d.tier === 'standard' && d.mode === 'E0' && d.casting.casting.model === 'Sonnet 5';
  })());
check('merged-class dispatch: an explicit order.tier overrides the merged default (E0 + tier:"dense")',
  (() => {
    const d = router.dispatch(order('E0', 'T1', { tier: 'dense' }), G);
    return d.ok && d.tier === 'dense' && d.casting.casting.effort === 'high';
  })());
check('merged-class dispatch: E3 keeps its mandatory review row (class carries the review, not the role) — Q0 still auto-spawns',
  (() => {
    const d = router.dispatch(order('E3', 'T1'), G);
    return d.ok && d.class === 'E3' && d.role === 'Builder' && d.tier === 'deep' && d.mode === 'E3' && d.review_policy === 'mandatory' && !!d.q0;
  })());
check('merged-class dispatch: N0 routes to Investigator, mode N0, carrying the read-only pin',
  (() => {
    const d = router.dispatch(order('N0', 'T0'), G);
    return d.ok && d.class === 'N0' && d.role === 'Investigator' && d.mode === 'N0' && d.pin === 'read-only' && d.casting.casting.model === 'Opus 5';
  })());
check('merged-class dispatch: N1/N2/M0 all route to Investigator with their own mode, no tier field (Investigator is not tiered)',
  ['N1', 'N2', 'M0'].every((cls) => {
    const d = router.dispatch(order(cls, 'T1'), G);
    return d.ok && d.role === 'Investigator' && d.mode === cls && d.tier === undefined;
  }));
// WO-14b leg 2 fix round, finding 6 (MAJOR, fixed): merging M0 into
// Investigator dropped the retired Archivist's raw video/audio UNAVAILABLE
// capability boundary (noMirrorFor.videoAudio) — an M0 order carrying
// castOpts.medium:'videoAudio' used to dispatch ok:true through Investigator
// instead of the typed refusal. mergedClasses.M0.unavailable restores the
// original reason text verbatim.
check('finding 6: M0 + castOpts.medium:"videoAudio" → typed UNAVAILABLE with the original noMirrorFor.videoAudio reason text preserved',
  (() => {
    const d = router.dispatch(order('M0', 'T1'), G, { castOpts: { medium: 'videoAudio' } });
    return d.ok === false && d.outcome === 'UNAVAILABLE' && d.class === 'M0' && d.role === 'Investigator' &&
      /raw video and audio go below the model layer/.test(d.reason);
  })());
check('finding 6: M0 + castOpts.medium:"documents" (or no medium at all) dispatches ok through Investigator, unaffected',
  (() => {
    const withDocs = router.dispatch(order('M0', 'T1'), G, { castOpts: { medium: 'documents' } });
    const withNone = router.dispatch(order('M0', 'T1'), G);
    return withDocs.ok === true && withDocs.role === 'Investigator' && withNone.ok === true && withNone.role === 'Investigator';
  })());

// WO-14b leg 2 fix round 2 (finding 3, MAJOR, fixed): review #2 found the M0
// UNAVAILABLE guard unreachable through the public contract — only an
// internal castOpts.medium injection could reach it, since
// dispatch-request.schema.json rejected `medium` as an additional property.
// order.schema.json now carries an optional `medium` field; dispatch() must
// read order.medium too — either order.medium OR castOpts.medium names the
// unavailable medium refuses.
check('finding 3: M0 order carrying order.medium:"videoAudio" (the public-contract path, no castOpts) → typed UNAVAILABLE',
  (() => {
    const d = router.dispatch(order('M0', 'T1', { medium: 'videoAudio' }), G);
    return d.ok === false && d.outcome === 'UNAVAILABLE' && d.class === 'M0' && d.role === 'Investigator' &&
      /raw video and audio go below the model layer/.test(d.reason);
  })());
check('finding 3: M0 order carrying order.medium:"documents" dispatches ok through Investigator',
  (() => {
    const d = router.dispatch(order('M0', 'T1', { medium: 'documents' }), G);
    return d.ok === true && d.role === 'Investigator';
  })());
check('finding 3: order.medium and castOpts.medium are both live triggers — a mismatched pair where EITHER names the unavailable medium still refuses',
  (() => {
    const viaOrderOnly = router.dispatch(order('M0', 'T1', { medium: 'videoAudio' }), G, { castOpts: { medium: 'documents' } });
    const viaCastOptsOnly = router.dispatch(order('M0', 'T1', { medium: 'documents' }), G, { castOpts: { medium: 'videoAudio' } });
    return viaOrderOnly.ok === false && viaOrderOnly.outcome === 'UNAVAILABLE' &&
      viaCastOptsOnly.ok === false && viaCastOptsOnly.outcome === 'UNAVAILABLE';
  })());
check('A1 dispatch returns typed RETIRED_WORKFLOW, never a casting',
  (() => {
    const d = router.dispatch(order('A1', 'T1'), G);
    return d.ok === false && d.outcome === 'RETIRED_WORKFLOW' && d.class === 'A1' && /Conductor \+ both Reviewer lanes/.test(d.reason);
  })());

// ---- Seat toggles: DISABLED (never a recast), S0/A0 fallback disclosures,
// override map re-enables Sweeper.
check('Sweeper is disabled by default (defaultEnabled: false) — cast() returns typed DISABLED, never a recast',
  (() => { const r = router.cast('Sweeper', G); return r.ok === false && r.outcome === 'DISABLED' && r.role === 'Sweeper'; })());
check('dispatch() of an S0 order with Sweeper disabled carries fallback:"verifier-census", disclosed',
  (() => {
    const d = router.dispatch(order('S0', 'T1'), G);
    return d.ok === false && d.outcome === 'DISABLED' && d.fallback === 'verifier-census' && /Verifier.*census/.test(d.reason);
  })());
check('the seats override map re-enables Sweeper (createRouter({ seats }))',
  (() => {
    const r = routerSweeperOn.cast('Sweeper', G);
    return r.ok === true && r.casting.model === 'GPT-5.6 Terra';
  })());
check('an owner-disabled Architect (A0) yields fallback:"conductor-self-plan", disclosed',
  (() => {
    const routerNoArchitect = createRouter({ seats: { Architect: false } });
    const d = routerNoArchitect.dispatch(order('A0', 'T1'), G);
    return d.ok === false && d.outcome === 'DISABLED' && d.fallback === 'conductor-self-plan' && /Conductor plans in its own voice/.test(d.reason);
  })());
check('resolveSeat() on a disabled seat also returns the typed DISABLED shape (propagated through target.cast)',
  (() => {
    const r = router.resolveSeat('modeler', { roster: 'new', buckets: G }); // modeler → Builder (enabled); prove via a Sweeper-targeted alias-shaped call instead
    // No shipped alias targets Sweeper; exercise resolveSeat’s propagation directly through a disabled-seat router + a live alias (executor → Builder).
    const routerNoBuilder = createRouter({ seats: { Builder: false } });
    const d = routerNoBuilder.resolveSeat('executor', { roster: 'new', buckets: G });
    return d.target.cast.ok === false && d.target.cast.outcome === 'DISABLED' && d.target.cast.role === 'Builder';
  })());
// WO-14b leg 2 fix round, finding 3 (MAJOR, fixed): resolveSeat() called
// with a DIRECT role name (no alias indirection — the branch above only
// exercised the alias path, which already routed through cast()) used to
// skip the seat-toggle check entirely and hand back a usable
// { kind: 'role', role: name } target even for a disabled seat. It must now
// return the SAME typed DISABLED shape cast()/dispatch() return, including
// the S0/A0 fallback disclosure text, never a usable role target.
check('finding 3: resolveSeat("Sweeper") — a direct role name, no alias — returns typed DISABLED with the S0 fallback text on the default (Sweeper-disabled) router',
  (() => {
    const r = router.resolveSeat('Sweeper', { roster: 'new', buckets: G });
    return r.ok === false && r.outcome === 'DISABLED' && r.role === 'Sweeper' &&
      r.fallback === 'verifier-census' && /Verifier.*census/.test(r.reason) &&
      r.target === undefined; // never a usable role target
  })());
check('finding 3: the seats override map re-enables direct-role resolveSeat("Sweeper") too — a live { kind: "role" } target, not DISABLED',
  (() => {
    const r = routerSweeperOn.resolveSeat('Sweeper', { roster: 'new', buckets: G });
    return r.ok !== false && r.alias === false && r.target && r.target.kind === 'role' && r.target.role === 'Sweeper';
  })());
check('finding 3: resolveSeat("Architect") on an owner-disabled Architect router returns typed DISABLED with the A0 fallback text',
  (() => {
    const routerNoArchitect2 = createRouter({ seats: { Architect: false } });
    const r = routerNoArchitect2.resolveSeat('Architect', { roster: 'new', buckets: G });
    return r.ok === false && r.outcome === 'DISABLED' && r.role === 'Architect' &&
      r.fallback === 'conductor-self-plan' && /Conductor plans in its own voice/.test(r.reason);
  })());

// ---- registry cross-check refusing an unmapped class: a class present in
// the registry but neither owned by a role nor declared in mergedClasses
// must refuse construction (drift still fails closed).
check('registry cross-check refuses a class that is neither owned nor merged',
  (() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-unmapped-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const c = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'castings.json'), 'utf8'));
    delete c.mergedClasses.N0; // N0 now owned by nothing and merged into nothing
    const file = path.join(dir, 'castings.json');
    fs.writeFileSync(file, JSON.stringify(c), 'utf8');
    let threw = null;
    try { createRouter({ castingsFile: file }); } catch (e) { threw = e; }
    return !!threw && /active class has no casting-table entry: N0/.test(threw.message);
  })());
check('mergedClasses cross-check refuses a class owned by BOTH a role and mergedClasses',
  (() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-doubled-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const c = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'castings.json'), 'utf8'));
    c.mergedClasses['E2'] = { role: 'Builder', tier: 'standard', mode: 'E2' }; // E2 is already owned by Builder
    const file = path.join(dir, 'castings.json');
    fs.writeFileSync(file, JSON.stringify(c), 'utf8');
    let threw = null;
    try { createRouter({ castingsFile: file }); } catch (e) { threw = e; }
    return !!threw && /both owned by a role and listed in mergedClasses/.test(threw.message);
  })());
check('mergedClasses cross-check refuses a merged entry targeting an unknown role',
  (() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-router-badtarget-'));
    cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
    const c = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'castings.json'), 'utf8'));
    c.mergedClasses.N0.role = 'Ghost Role';
    const file = path.join(dir, 'castings.json');
    fs.writeFileSync(file, JSON.stringify(c), 'utf8');
    let threw = null;
    try { createRouter({ castingsFile: file }); } catch (e) { threw = e; }
    return !!threw && /targets unknown role/.test(threw.message);
  })());

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + ' — ' + passes + ' passed');
