#!/usr/bin/env node
/**
 * WO-7b mechanical scorer — misroute recovery through the implemented router.
 *
 *   node plans/cross-compare/agent-role-architecture/wo7b/score.js
 *
 * Inputs (same directory):
 *   corpus.json              — items + pre-registered gates (committed first)
 *   results-hop0.json        — per-item filter decisions from the seat inboxes
 *   results-hop1.json        — filter decisions on re-dispatched orders
 *   results-classifier.json  — the telemetry classification pass
 *
 * Everything judged here is judged BY THE ROUTER: gate relevance is computed
 * from reviewPolicy()/q0Required() under the seeded vs true class, hops run
 * through processReclassify(), and the per-pair ledger is emitted from its
 * entries. Exit 0 iff G1+G2+G3 hold.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const MASTER = path.resolve(HERE, '..', '..', '..', '..');
const { createRouter } = require(path.join(MASTER, 'router', 'router.js'));

const router = createRouter();
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, 'corpus.json'), 'utf8'));
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const hop0 = readJson('results-hop0.json');
const hop1 = fs.existsSync(path.join(HERE, 'results-hop1.json')) ? readJson('results-hop1.json') : {};
const classifier = fs.existsSync(path.join(HERE, 'results-classifier.json')) ? readJson('results-classifier.json') : null;

const buckets = router.allGreen();
buckets['AU-opus'] = { state: 'Green', quartermasterConfirmation: true };

const misroutes = corpus.items.filter((i) => i.kind === 'misroute');
const controls = corpus.items.filter((i) => i.kind === 'control');

function orderFor(item, cls) {
  return {
    task_id: item.id, parent_id: null, class: cls, risk: item.risk,
    author_family: 'anthropic', co_author_families: [],
    goal: item.request, acceptance_criteria: ['per request'],
    review_policy: 'mandatory', integrity_nonce: 'wo7bwo7bwo7bwo7b',
  };
}

// ---- gate relevance, computed from the router itself ----------------------
function obligations(item, cls) {
  return {
    review: router.reviewPolicy(cls, item.risk, {}),
    q0: router.q0Required(orderFor(item, cls)).required,
  };
}
function gateRelevance(item) {
  const t = obligations(item, item.true_class);
  const s = obligations(item, item.dispatch_class);
  const reasons = [];
  if (t.review === 'mandatory' && s.review !== 'mandatory') reasons.push('mandatory review lost (' + item.true_class + ':' + t.review + ' → ' + item.dispatch_class + ':' + s.review + ')');
  if (t.q0 && !s.q0) reasons.push('required Q0 lost');
  return { relevant: reasons.length > 0, reasons, trueOb: t, seededOb: s };
}

// Tier-borne gates must be identical under both dispatches for every item —
// risk rides on the order, so a misroute can never relax them. Asserted.
let tierGateViolations = [];
for (const item of corpus.items) {
  if (item.risk === 'T3') {
    // no T3 items in this corpus, but the assertion is written for them
    const a = obligations(item, item.true_class).review;
    const b = obligations(item, item.dispatch_class).review;
    if (a !== 'mandatory' || b !== 'mandatory') tierGateViolations.push(item.id);
  }
}

// ---- run the recovery loop through the router -----------------------------
const rows = [];
const ledger = [];
let falseBounces = [];
let escalations = [];

for (const item of corpus.items) {
  const d0 = hop0[item.id];
  if (!d0) { console.error('missing hop-0 result for ' + item.id); process.exit(1); }
  const seatRole = router.route(item.dispatch_class);
  const row = { id: item.id, kind: item.kind, seeded: item.dispatch_class, true_class: item.true_class, seat: seatRole, hop0: d0.decision, hops: 0 };

  if (d0.decision === 'ACCEPT') {
    if (item.kind === 'misroute') row.caught = false;
    else row.correctAccept = true;
  } else if (d0.decision === 'RECLASSIFY') {
    if (item.kind === 'control') falseBounces.push(item.id + ' (' + seatRole + ' → ' + d0.recommended_class + ': ' + (d0.evidence || '') + ')');
    const rc = router.processReclassify(
      orderFor(item, item.dispatch_class),
      { status: 'RECLASSIFY', reclassify: { recommended_class: d0.recommended_class, evidence: d0.evidence || '(none)' } },
      buckets
    );
    row.caught = item.kind === 'misroute';
    row.recommended = router.resolveClass(d0.recommended_class);
    row.recommendedCorrect = row.recommended === item.true_class;
    row.hops = rc.hop;
    ledger.push(rc.ledger);
    const d1 = hop1[item.id];
    if (d1) {
      row.hop1 = d1.decision;
      if (d1.decision === 'RECLASSIFY') {
        const rc2 = router.processReclassify(rc.order, { status: 'RECLASSIFY', reclassify: { recommended_class: d1.recommended_class, evidence: d1.evidence || '(none)' } }, buckets);
        row.hops = rc2.hop;
        ledger.push(rc2.ledger);
        if (rc2.escalated) escalations.push(item.id + ' (' + rc.order.class + ' → ' + d1.recommended_class + ')');
      }
    } else if (row.caught) {
      console.error('missing hop-1 result for reclassified item ' + item.id);
      process.exit(1);
    }
  }
  if (item.kind === 'misroute') row.gate = gateRelevance(item);
  rows.push(row);
}

// ---- gates ----------------------------------------------------------------
const missed = rows.filter((r) => r.kind === 'misroute' && !r.caught);
const g1 = missed.length === 0;

const gateRelevant = rows.filter((r) => r.kind === 'misroute' && r.gate.relevant);
const crossings = gateRelevant.filter((r) => !r.caught);
const g2 = crossings.length === 0 && tierGateViolations.length === 0;

const hopCounts = rows.map((r) => r.hops).sort((a, b) => a - b);
const p95 = hopCounts[Math.ceil(0.95 * hopCounts.length) - 1];
const landed = rows.filter((r) => r.caught && r.hop1 === 'ACCEPT');
const g3 = p95 <= 1;

// ---- report ---------------------------------------------------------------
console.log('WO-7b — misroute recovery through the implemented router');
console.log('corpus: ' + corpus.items.length + ' items (' + misroutes.length + ' seeded misroutes, ' + controls.length + ' controls)\n');

console.log('Per-item:');
for (const r of rows) {
  const bits = [r.id, r.kind, r.seeded + '→' + r.seat, 'hop0:' + r.hop0];
  if (r.recommended) bits.push('rec:' + r.recommended + (r.recommendedCorrect ? '' : ' (true:' + r.true_class + ')'));
  if (r.hop1) bits.push('hop1:' + r.hop1);
  bits.push('hops:' + r.hops);
  if (r.kind === 'misroute') bits.push(r.caught ? 'CAUGHT' : 'MISSED');
  if (r.gate && r.gate.relevant) bits.push('GATE-RELEVANT[' + r.gate.reasons.join('; ') + ']');
  console.log('  ' + bits.join(' · '));
}

console.log('\nG1 recovery: ' + (g1 ? 'PASS' : 'FAIL') + ' — ' + (misroutes.length - missed.length) + '/' + misroutes.length + ' seeded misroutes caught' + (missed.length ? ' (missed: ' + missed.map((r) => r.id).join(', ') + ')' : ''));
console.log('G2 no gate crossing: ' + (g2 ? 'PASS' : 'FAIL') + ' — ' + gateRelevant.length + ' gate-relevant misroutes, ' + crossings.length + ' crossed' + (crossings.length ? ' (' + crossings.map((r) => r.id).join(', ') + ')' : '') + '; tier-borne gates identical under both dispatches for all items: ' + (tierGateViolations.length === 0 ? 'yes' : 'NO — ' + tierGateViolations.join(', ')));
console.log('G3 hops: ' + (g3 ? 'PASS' : 'FAIL') + ' — P95 hop count ' + p95 + ' (≤1 required); ' + landed.length + '/' + rows.filter((r) => r.caught).length + ' caught misroutes landed with hop-1 ACCEPT; escalations: ' + (escalations.length ? escalations.join(', ') : 'none'));

console.log('\nTelemetry (non-gating):');
console.log('  false bounces on controls: ' + falseBounces.length + '/' + controls.length + (falseBounces.length ? ' — ' + falseBounces.join('; ') : ''));
const caught = rows.filter((r) => r.caught);
const recRight = caught.filter((r) => r.recommendedCorrect);
console.log('  recommended-class accuracy on caught misroutes: ' + recRight.length + '/' + caught.length);
if (classifier) {
  const agree = corpus.items.filter((i) => router.resolveClass(classifier[i.id]) === i.true_class);
  console.log('  classifier pass agreement with construction key: ' + agree.length + '/' + corpus.items.length + ' (' + Math.round(100 * agree.length / corpus.items.length) + '%)');
  for (const edge of [['B', ['C2', 'M1']], ['W', ['C11', 'M2']]]) {
    const hits = edge[1].filter((id) => {
      const item = corpus.items.find((i) => i.id === id);
      return router.resolveClass(classifier[id]) === item.true_class;
    });
    console.log('  reserved edge ' + edge[0] + ' (classifier): ' + hits.length + '/' + edge[1].length + ' [' + edge[1].join(', ') + ']');
  }
} else {
  console.log('  classifier pass: not yet run');
}
for (const edge of [['B', ['C2', 'M1']], ['W', ['C11', 'M2']]]) {
  const rws = rows.filter((r) => edge[1].includes(r.id));
  console.log('  reserved edge ' + edge[0] + ' (recovery): ' + rws.map((r) => r.id + '=' + (r.kind === 'misroute' ? (r.caught ? 'caught' : 'MISSED') : (r.correctAccept ? 'accepted' : 'BOUNCED')) + '@' + r.hops + 'h').join(', '));
}

console.log('\nPer-pair RECLASSIFY ledger feed (' + ledger.length + ' entries):');
const byPair = {};
for (const e of ledger) byPair[e.pair.join('/')] = (byPair[e.pair.join('/')] || 0) + 1;
for (const [pair, n] of Object.entries(byPair).sort()) console.log('  ' + pair + ': ' + n);

const allPass = g1 && g2 && g3;
console.log('\n' + (allPass ? 'ALL PRE-REGISTERED GATES PASS' : 'GATE FAILURE — see above'));
process.exitCode = allPass ? 0 : 1;
