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
const G = router.allGreen();
const FAM_OF = (m) => router.familyOf(m);

function buckets(overrides) { return Object.assign(router.allGreen(), overrides); }
function order(cls, risk, extra) {
  return Object.assign({ task_id: 't-' + cls + '-' + risk, parent_id: null, class: cls, risk, author_family: 'anthropic', co_author_families: [], goal: 'g', acceptance_criteria: ['a'], review_policy: 'mandatory', integrity_nonce: 'deadbeefdeadbeef' }, extra || {});
}

// ---------------------------------------------------------------- 1. loading
section('1. Loading fails closed');

check('router loads clean over the shipped registry + casting tables', !!router.registry && Object.keys(router.castings.roles).length === 23);

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

const EXPECTED_ROLES = {
  O0: 'Conductor', A0: 'Architect', A1: 'Synthesizer', N0: 'Scout', N1: 'Researcher',
  N2: 'LC Analyst', I0: 'Investigator', M0: 'Archivist', E0: 'Operator', E1: 'Runner',
  E2: 'Builder', E3: 'Principal', E4: 'Data Engineer', E5: 'Interface Artisan',
  E6: 'Spatial Specialist', E7: 'Red Team', E8: 'Refactorer', Q0: 'Test Designer',
  D0: 'Doc Writer', R0: 'Reviewer', S0: 'Sweeper', V0: 'Verifier', P0: 'Quartermaster',
};
{
  let bad = [];
  for (const [cls, role] of Object.entries(EXPECTED_ROLES)) {
    if (router.route(cls) !== role) bad.push(cls + '→' + router.route(cls));
  }
  check('all 23 active classes route to their documented primary role', bad.length === 0, bad.join(', '));
}
check('alias I1 routes to the Investigator (merged class)', router.route('I1') === 'Investigator');
check('unknown class identifier is rejected', (() => { try { router.route('Z9'); return false; } catch (e) { return /unknown class/.test(e.message); } })());

// --------------------------------------- 3. documented casting set, per rung
section('3. Every rung yields its documented casting set (Part 2, transcribed)');

// vendor|model|effort — transcribed from final-plan.md Part 2 by hand.
const EXPECTED_RUNGS = {
  'Conductor': { primary: 'anthropic|Fable 5|owner-set', mirror: 'openai|GPT-5.6 Sol|matched' },
  'Architect': { primary: 'openai|GPT-5.6 Sol|xhigh', nebulous: 'anthropic|Fable 5|high–xhigh', exhaustionFallback: 'anthropic|Opus 5|high', mirror: 'anthropic|Fable 5|high–xhigh', ceilingAnthropic: 'anthropic|Fable 5|xhigh', ceilingOpenai: 'openai|GPT-5.6 Sol|max' },
  'Synthesizer': { primary: 'anthropic|Fable 5|xhigh', rationSpent: 'anthropic|Opus 5|high', mirror: 'openai|GPT-5.6 Sol|max' },
  'Scout': { primary: 'anthropic|Haiku 4.5|off', mirror: 'openai|GPT-5.6 Luna|low' },
  'Researcher': { primary: 'openai|GPT-5.6 Sol|med', deep: 'openai|GPT-5.6 Sol|high', mirror: 'anthropic|Opus 5|med' },
  'LC Analyst': { primary: 'openai|GPT-5.6 Terra|med', dense: 'openai|GPT-5.6 Terra|high', mirror: 'anthropic|Opus 5|med' },
  'Investigator': { primary: 'anthropic|Opus 5|high', mirror: 'openai|GPT-5.6 Sol|high', ceiling: 'anthropic|Fable 5|high' },
  'Archivist': { documents: 'openai|GPT-5.6 Terra|med', images: 'anthropic|Opus 5|med' },
  'Operator': { primary: 'openai|GPT-5.6 Sol|high', tacticalRaise: 'openai|GPT-5.6 Sol|max', mirror: 'anthropic|Opus 5|high' },
  'Runner': { primary: 'openai|GPT-5.6 Luna|low–med', mirror: 'anthropic|Haiku 4.5|off' },
  'Builder': { preferredBounded: 'openai|GPT-5.6 Luna|xhigh–max', primary: 'anthropic|Sonnet 5|med', dense: 'anthropic|Sonnet 5|high', mirror: 'openai|GPT-5.6 Terra|med' },
  'Principal': { primary: 'anthropic|Opus 5|high', effortPoint2: 'anthropic|Opus 5|xhigh', mirror: 'openai|GPT-5.6 Sol|high', ceiling: 'anthropic|Fable 5|high' },
  'Data Engineer': { primary: 'anthropic|Opus 5|high', reversibleT1: 'openai|GPT-5.6 Terra|high' },
  'Interface Artisan': { primary: 'openai|GPT-5.6 Sol|med–high', closing: 'anthropic|Opus 5|high', critic: 'anthropic|Fable 5|high' },
  'Spatial Specialist': { primary: 'anthropic|Opus 5|high', critic: 'anthropic|Fable 5|high', mirror: 'openai|GPT-5.6 Sol|high' },
  'Red Team': { primary: 'openai|GPT-5.6 Sol|high', threatModel: 'openai|GPT-5.6 Sol|max', mirror: 'anthropic|Opus 5|high' },
  'Refactorer': { primary: 'openai|GPT-5.6 Terra|med', mirror: 'anthropic|Sonnet 5|med' },
  'Test Designer': { vsAnthropicAuthor: 'openai|GPT-5.6 Terra|med', vsOpenaiAuthor: 'anthropic|Sonnet 5|med' },
  'Doc Writer': { primary: 'anthropic|Sonnet 5|med', deliverable: 'anthropic|Opus 5|med', ceiling: 'anthropic|Fable 5|med', mirror: 'openai|GPT-5.6 Sol|med' },
  'Sweeper': { primary: 'openai|GPT-5.6 Terra|med', mirror: 'anthropic|Sonnet 5|med' },
};
{
  let bad = [];
  let count = 0;
  for (const [role, rungs] of Object.entries(EXPECTED_RUNGS)) {
    for (const [rung, expected] of Object.entries(rungs)) {
      count++;
      const qc = buckets({ 'AU-opus': { state: 'Green', quartermasterConfirmation: true } });
      const r = router.cast(role, qc, { rung });
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
check('Archivist video/audio is typed UNAVAILABLE (declared no-mirror), never a model casting',
  (() => { const r = router.cast('Archivist', G, { medium: 'videoAudio' }); return r.ok === false && r.outcome === 'UNAVAILABLE'; })());
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
    const b = buckets({ OU: 'Orange' });
    const a = router.cast('Operator', b); // Sol-primary authoring → Opus mirror
    const rev = router.cast('Operator', b, { purpose: 'review' });
    return a.ok && a.casting.model === 'Opus 5' && a.rung === 'mirror' && rev.ok && rev.casting.model === 'GPT-5.6 Sol';
  })());
check('Orange defers ceiling rungs (AU-fable stops first)',
  router.cast('Principal', buckets({ 'AU-fable': 'Orange' }), { rung: 'ceiling' }).outcome === 'DEFERRED' &&
  router.cast('Architect', buckets({ 'AU-fable': 'Orange' }), { rung: 'ceilingAnthropic' }).outcome === 'DEFERRED');
check('Red permits only closing calls on the bucket; authoring recasts or waits',
  (() => {
    const b = buckets({ OU: 'Red' });
    const close = router.cast('Operator', b, { purpose: 'closing' });
    const auth = router.cast('Operator', b);
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
  const NEVER = { 'Red Team': ['Fable 5'], 'Conductor': ['Opus 5', 'Haiku 4.5', 'Sonnet 5', 'GPT-5.6 Luna', 'GPT-5.6 Terra'], 'Doc Writer': ['GPT-5.6 Terra', 'GPT-5.6 Luna'], 'Researcher': ['GPT-5.6 Luna', 'Haiku 4.5'], 'Synthesizer': ['Haiku 4.5', 'GPT-5.6 Luna', 'GPT-5.6 Terra'] };
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
check('dispatch(): a Sol-authored E0 mutation gets the mandatory Opus review lane (flags.solAuthoredMutation)',
  (() => {
    const d = router.dispatch(order('E0', 'T1'), G, { flags: { solAuthoredMutation: true } });
    return d.ok && d.review_policy === 'mandatory' && d.review.casting.model === 'Opus 5' && d.review.review_cross_family === true;
  })());

// ------------------------------------------------- 8. context-shape rejection
section('8. Context-shape violations rejected at dispatch');

check('Runner is packet-only: a haystack (or even scoped) order is rejected',
  (() => {
    const h = router.dispatch(order('E1', 'T1', { context_shape: 'haystack' }), G);
    const s = router.dispatch(order('E1', 'T1', { context_shape: 'scoped' }), G);
    const p = router.dispatch(order('E1', 'T1', { context_shape: 'packet' }), G);
    return h.ok === false && h.rejected === 'context-shape' && s.ok === false && p.ok === true;
  })());
check('Scout is scoped-maximum: never haystack',
  router.dispatch(order('N0', 'T0', { context_shape: 'haystack' }), G).rejected === 'context-shape' &&
  router.dispatch(order('N0', 'T0', { context_shape: 'scoped' }), G).ok === true);
check('Conductor takes packet only', router.dispatch(order('O0', 'T1', { context_shape: 'repo' }), G).rejected === 'context-shape');
check('Builder may not be handed a repo shape',
  router.dispatch(order('E2', 'T1', { context_shape: 'repo' }), G).rejected === 'context-shape' &&
  router.dispatch(order('E2', 'T1', { context_shape: 'subsystem' }), G).ok === true);
check('an unknown shape word is rejected outright', router.dispatch(order('E2', 'T1', { context_shape: 'universe' }), G).rejected === 'context-shape');
check('the repo-shaped seats accept repo (Investigator, Principal, Reviewer)',
  router.dispatch(order('I0', 'T1', { context_shape: 'repo' }), G).ok === true &&
  router.dispatch(order('E3', 'T1', { context_shape: 'repo' }), G).ok === true);

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
    router.resolveSeat('executor-heavy', { roster: 'new', buckets: qc }).target.role === 'Principal' &&
    router.resolveSeat('executor-heavy', { roster: 'legacy' }).target.agent === 'executor-heavy' &&
    router.resolveSeat('executor-heavy', { roster: 'new', buckets: qc }).target.cast.casting.effort === 'high');
  check('executor-heavy-xhigh maps to Principal’s routed xhigh effort point, not a second seat',
    (() => { const r = router.resolveSeat('executor-heavy-xhigh', { roster: 'new', buckets: qc }); return r.target.rung === 'effortPoint2' && r.target.cast.casting.effort === 'xhigh'; })());
  check('detective maps to the merged Investigator with the read-only pin carried',
    (() => { const r = router.resolveSeat('detective', { roster: 'new', buckets: qc }); return r.target.role === 'Investigator' && r.target.pin === 'read-only' && r.target.cast.casting.model === 'Opus 5'; })());
  check('reviewer and reviewer-codex resolve to the COMPUTED Reviewer, never a static casting',
    router.resolveSeat('reviewer', { roster: 'new' }).target.kind === 'computed-reviewer' &&
    router.resolveSeat('reviewer-codex', { roster: 'new' }).target.kind === 'computed-reviewer');
  check('codex executors become mirror castings (Builder Terra, Principal Sol)',
    router.resolveSeat('executor-codex', { roster: 'new', buckets: qc }).target.cast.casting.model === 'GPT-5.6 Terra' &&
    router.resolveSeat('executor-codex-heavy', { roster: 'new', buckets: qc }).target.cast.casting.model === 'GPT-5.6 Sol');
  check('modeler is promoted to the Spatial Specialist (Opus 5 · high)',
    router.resolveSeat('modeler', { roster: 'new', buckets: qc }).target.cast.casting.model === 'Opus 5');
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
  check('caller castOpts cannot override the alias’s declared rung',
    (() => {
      const r = router.resolveSeat('executor-heavy-xhigh', { roster: 'new', buckets: qc, castOpts: { rung: 'primary' } });
      return r.target.rung === 'effortPoint2' && r.target.cast.rung === 'effortPoint2' && r.target.cast.casting.effort === 'xhigh';
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
check('R0-EX3: a §5.5 degradation recast never silently satisfies a P15 reserve stop (Amber+belowReserve GATES a Fable primary)',
  (() => {
    const d = router.dispatch(order('A1', 'T1'), buckets({ 'AU-fable': { state: 'Amber', belowReserve: true } }));
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

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + ' — ' + passes + ' passed');
