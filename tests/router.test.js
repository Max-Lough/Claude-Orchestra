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
  // Calibration sample: deterministic 25% of T1 E2/E5/E6 on task_id.
  let sampled = null, unsampled = null;
  for (let i = 0; i < 200 && (!sampled || !unsampled); i++) {
    const id = 'cal-' + i;
    if (fnv1a(id) % 100 < 25) sampled = sampled || id; else unsampled = unsampled || id;
  }
  const rIn = router.q0Required(order('E2', 'T1', { task_id: sampled }));
  const rIn2 = router.q0Required(order('E2', 'T1', { task_id: sampled }));
  const rOut = router.q0Required(order('E2', 'T1', { task_id: unsampled }));
  check('calibration: 25% of T1 E2/E5/E6 sampled, deterministically on task_id', rIn.required === true && rIn2.required === true && rOut.required === false);
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
  // trigger-matching dispatch always carries a Q0 companion.
  let bad = [];
  for (const cls of ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']) {
    for (const risk of ['T1', 'T2', 'T3']) {
      for (const touches of [[], ['concurrency']]) {
        const o = order(cls, risk, { touches, task_id: 'sweep-' + cls + risk + touches.length });
        const need = router.q0Required(o).required;
        const d = router.dispatch(o, G, { flags: {} });
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

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + ' — ' + passes + ' passed');
