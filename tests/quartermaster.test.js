#!/usr/bin/env node
/**
 * WO-11 Quartermaster tests — the P0 substrate's unit proof.
 *
 * What this suite has to establish:
 *
 *   - readings round-trip, and EVERY validation rejection actually rejects
 *     (a bad reading routes the whole harness; a refused one does not);
 *   - the substrate FAILS CLOSED on absent, too-stale and malformed-latest
 *     evidence — never Green (fabricated capacity), never Red (fabricated
 *     scarcity), always naming the bucket and the fixing command;
 *   - THE INTEROP: bucketState() output fed into the REAL router
 *     (require ../router/router.js) normalizes, casts, dispatches and GATES —
 *     a P0-produced state routes end-to-end on the Green path, a below-reserve
 *     AU-opus reading fires the P15 reserve gate against a real Opus dispatch,
 *     an unconfirmed Amber AU-opus fires the §5.5 Amber arm, and an exhausted
 *     bucket takes the exhaustion-matrix path;
 *   - threshold boundary exactness matches router semantics (0.40 Green,
 *     0.399 Amber, 0.08 Orange, 0.0799 Red);
 *   - the confirmation protocol grants on fresh above-Orange evidence, refuses
 *     otherwise, and appends NOTHING when it refuses;
 *   - prediction is typed for declining / insufficient / non-monotonic;
 *   - throttles force Red and hard throttles force Exhausted;
 *   - hand-corrupted JSONL is counted, reported, and fatal in the latest
 *     position only.
 *
 * Every fixture lives under a fresh mkdtemp directory. NOTHING in this suite
 * touches the repository's real .claude/ files.
 *
 *   node tests/quartermaster.test.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const QM_PATH = path.join(MASTER, 'quartermaster', 'quartermaster.js');
const qm = require(QM_PATH);
const { createRouter } = require(path.join(MASTER, 'router', 'router.js'));

// The suite must not care whether the real readings file exists — WO-11's P0
// live exercise made it real operational data (WO-2/WO-5 Codex OU readings),
// so "it never exists" is no longer a lawful assertion. What the suite DOES
// owe is proof that it never creates, modifies, or deletes that file itself.
// Snapshot it now, before any fixture work below, and compare at the end.
const REAL_READINGS = path.join(MASTER, '.claude', 'orchestra-pool-readings.jsonl');
function snapshotRealReadings() {
  if (!fs.existsSync(REAL_READINGS)) return { exists: false };
  const stat = fs.statSync(REAL_READINGS);
  return {
    exists: true,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    hash: crypto.createHash('sha256').update(fs.readFileSync(REAL_READINGS)).digest('hex'),
  };
}
const REAL_READINGS_BEFORE = snapshotRealReadings();

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

// --------------------------------------------------------------- fixtures

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-qm-'));
cleanups.push(() => fs.rmSync(TMP, { recursive: true, force: true }));
let fixtureSeq = 0;
function newFile() {
  return path.join(TMP, 'readings-' + (++fixtureSeq) + '.jsonl');
}
function lines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
}
function threw(fn) {
  try { fn(); return null; } catch (e) { return e; }
}

const NOW = new Date('2026-08-30T12:00:00.000Z');
const H = 3600000;
const ago = (hours) => new Date(NOW.getTime() - hours * H);

// A forecast whose dynamic term is zero, so requiredReserve falls to the
// castings floor (8%) and the ladder thresholds can be probed exactly. The
// DEFAULT (WO-2-derived) forecast is exercised separately below.
const FC0 = { mandatoryReviewDraw: 0, incidentDraw: 0, basis: 'test: floor only' };

// Record the same fraction into all four buckets at a given time.
function seedAll(file, fraction, when, source) {
  for (const b of qm.BUCKETS) qm.recordReading(b, fraction, source || 'test vendor UI', undefined, { file, now: when || ago(1) });
  return file;
}

const router = createRouter();
function order(cls, risk, extra) {
  return Object.assign({ class: cls, risk: risk || 'T1', title: 'test order', context_shape: 'scoped' }, extra);
}

// =========================================================================
section('1. Recording round-trips');

{
  const f = newFile();
  const e = qm.recordReading('AU-opus', 0.55, 'claude.ai usage page', 'read at the top of the window', { file: f, now: NOW });
  check('recordReading returns the appended entry with kind/bucket/fraction/source',
    e.kind === 'reading' && e.bucket === 'AU-opus' && e.remainingFraction === 0.55 && e.source === 'claude.ai usage page');
  check('recordReading stamps an ISO ts from the injected clock', e.ts === NOW.toISOString());
  check('the optional note round-trips', e.note === 'read at the top of the window');
  check('exactly one JSONL line was appended', lines(f).length === 1);
  check('the appended line parses back to the same object', JSON.parse(lines(f)[0]).remainingFraction === 0.55);

  const t = qm.recordThrottle('OU', 'soft', '429 from the Codex window', { file: f, now: NOW });
  check('recordThrottle appends a typed throttle entry', t.kind === 'throttle' && t.severity === 'soft' && t.bucket === 'OU');
  check('appends are additive — the log is append-only', lines(f).length === 2);
  check('the readings file is created with its parent directory on first use', fs.existsSync(f));

  const nested = path.join(TMP, 'deep', 'nest', 'r.jsonl');
  qm.recordReading('OU', 0.5, 'src', undefined, { file: nested, now: NOW });
  check('a missing parent directory is created rather than throwing', fs.existsSync(nested));

  check('the boundary fractions 0 and 1 are both legal readings',
    threw(() => qm.recordReading('AU-all', 0, 's', undefined, { file: newFile(), now: NOW })) === null &&
    threw(() => qm.recordReading('AU-all', 1, 's', undefined, { file: newFile(), now: NOW })) === null);
}

// =========================================================================
section('2. Every validation rejection');

{
  const f = newFile();
  const rej = (what, fn, re) => {
    const e = threw(fn);
    check(what, e !== null && re.test(e.message), e ? e.message : '(did not throw)');
  };
  rej('unknown bucket is refused, and the refusal names the four published buckets',
    () => qm.recordReading('AU-sonnet', 0.5, 's', undefined, { file: f, now: NOW }), /unknown bucket.*AU-all, AU-opus, AU-fable, OU/);
  rej('a prototype key is not a bucket', () => qm.recordReading('constructor', 0.5, 's', undefined, { file: f, now: NOW }), /unknown bucket/);
  rej('fraction above 1 is refused', () => qm.recordReading('AU-all', 1.5, 's', undefined, { file: f, now: NOW }), /\[0,1\]/);
  rej('negative fraction is refused', () => qm.recordReading('AU-all', -0.01, 's', undefined, { file: f, now: NOW }), /\[0,1\]/);
  rej('NaN fraction is refused', () => qm.recordReading('AU-all', NaN, 's', undefined, { file: f, now: NOW }), /\[0,1\]/);
  rej('a string fraction is refused (no coercion)', () => qm.recordReading('AU-all', '0.5', 's', undefined, { file: f, now: NOW }), /\[0,1\]/);
  rej('a missing source is refused — a reading without provenance is a fabricated number',
    () => qm.recordReading('AU-all', 0.5, undefined, undefined, { file: f, now: NOW }), /source is required/);
  rej('a whitespace-only source is refused', () => qm.recordReading('AU-all', 0.5, '   ', undefined, { file: f, now: NOW }), /source is required/);
  rej('a non-string note is refused', () => qm.recordReading('AU-all', 0.5, 's', 42, { file: f, now: NOW }), /note must be a string/);
  rej('an unknown throttle severity is refused', () => qm.recordThrottle('OU', 'medium', 'm', { file: f, now: NOW }), /severity must be one of/);
  rej('a throttle without a message is refused', () => qm.recordThrottle('OU', 'hard', '', { file: f, now: NOW }), /message is required/);
  rej('an unknown bucket is refused by recordThrottle too', () => qm.recordThrottle('nope', 'hard', 'm', { file: f, now: NOW }), /unknown bucket/);
  rej('an unusable `now` is refused', () => qm.recordReading('AU-all', 0.5, 's', undefined, { file: f, now: 'not-a-date' }), /not a usable timestamp/);
  check('NOT ONE rejected call wrote a line', lines(f).length === 0);
}

// =========================================================================
section('3. Fail-closed: absent, too stale, malformed-latest');

{
  const f = newFile();
  const e = threw(() => qm.bucketState({ file: f, now: NOW, forecast: FC0 }));
  check('an absent readings file fails closed for all four buckets', e !== null && e.failClosed === true);
  check('the refusal names every missing bucket', qm.BUCKETS.every((b) => e.message.includes(b)));
  check('the refusal prints the exact --record command that fixes it',
    /node quartermaster\/quartermaster\.js --record AU-opus <fraction 0\.\.1> --source/.test(e.message));
  check('the refusal is neither Green nor Red — it is a refusal',
    !/"state"/.test(e.message) && /FAILS CLOSED/.test(e.message));
}
{
  const f = newFile();
  seedAll(f, 0.5, ago(3), 'vendor UI');
  qm.recordReading('AU-opus', 0.5, 'vendor UI', undefined, { file: f, now: ago(24 * 8) });
  // AU-opus's latest reading is still the 3h-old one; make a bucket genuinely stale instead:
  const g = newFile();
  for (const b of qm.BUCKETS) {
    qm.recordReading(b, 0.5, 'vendor UI', undefined, { file: g, now: b === 'AU-fable' ? ago(24 * 8) : ago(3) });
  }
  const e = threw(() => qm.bucketState({ file: g, now: NOW, forecast: FC0 }));
  check('a reading older than maxStaleMs fails closed', e !== null && e.failClosed === true);
  check('the stale refusal names the bucket and the age', /AU-fable/.test(e.message) && /8\.0d old/.test(e.message));
  check('only the stale bucket fails — the other three are fine', (e.message.match(/REFUSED for/g) || []).length === 1);
  check('the stale refusal invents no burn rate', /no burn rate is invented/.test(e.message));
}
{
  // Stale but inside the 7d window: USED AS-IS and DISCLOSED, never discounted.
  const f = newFile();
  for (const b of qm.BUCKETS) {
    qm.recordReading(b, 0.62, 'vendor UI', undefined, { file: f, now: b === 'OU' ? ago(72) : ago(3) });
  }
  const st = qm.bucketState({ file: f, now: NOW, forecast: FC0 });
  check('a 3-day-old reading is still published — at its recorded value, undiscounted',
    st.OU.state.remainingFraction === 0.62);
  const d = qm.bucketStateDetail({ file: f, now: NOW, forecast: FC0 });
  check('…and the accompanying report marks it stale: true', d.analysis.buckets.OU.stale === true);
  check('a fresh bucket is not marked stale', d.analysis.buckets['AU-all'].stale === false);
  check('the report text discloses staleness in words', /STALE \(disclosed, not discounted\)/.test(qm.report({ file: f, now: NOW, forecast: FC0 })));
}
{
  // A malformed line in the LATEST position for a bucket is fatal, by line number.
  const f = newFile();
  seedAll(f, 0.7, ago(2));
  fs.appendFileSync(f, '{"ts":"2026-08-30T11:00:00Z","kind":"reading","bucket":"AU-opus","remainingFraction":\n', 'utf8');
  const e = threw(() => qm.bucketState({ file: f, now: NOW, forecast: FC0 }));
  check('a malformed line newer than the bucket\'s latest reading fails that bucket closed', e !== null && e.failClosed === true);
  check('the refusal names the line number', /line 5/.test(e.message));
  check('a corrupted newest record is not silently replaced by the older one',
    /could have been the one that said the pool was empty/.test(e.message));
}
{
  // …but a malformed line OLDER than every bucket's latest reading is counted, not fatal.
  const f = newFile();
  fs.writeFileSync(f, 'this is not json at all\n', 'utf8');
  seedAll(f, 0.7, ago(2));
  const st = qm.bucketState({ file: f, now: NOW, forecast: FC0 });
  check('a malformed line behind every latest reading does not block the state', st['AU-all'].state.remainingFraction === 0.7);
  const d = qm.bucketStateDetail({ file: f, now: NOW, forecast: FC0 });
  check('…but it is COUNTED, never silently skipped', d.analysis.malformedCount === 1);
  check('…and reported with its line number and reason',
    d.analysis.malformed[0].lineNumber === 1 && /unparseable JSON/.test(d.analysis.malformed[0].reason));
  check('the human report prints the malformed-line count', /malformed lines: 1/.test(qm.report({ file: f, now: NOW, forecast: FC0 })));
}
{
  const f = newFile();
  seedAll(f, 0.7, ago(2));
  qm.recordReading('OU', 0.6, 'vendor UI', undefined, { file: f, now: new Date(NOW.getTime() + 5 * H) });
  const e = threw(() => qm.bucketState({ file: f, now: NOW, forecast: FC0 }));
  check('a future-dated reading fails closed (clock skew or tamper, not evidence)',
    e !== null && /dated in the future/.test(e.message) && /OU/.test(e.message));
}

// =========================================================================
section('4. The contract shape (ruling R1)');

{
  const f = newFile();
  seedAll(f, 0.75, ago(2));
  const st = qm.bucketState({ file: f, now: NOW, forecast: FC0 });
  check('bucketState returns exactly the four published buckets as OWN properties',
    qm.BUCKETS.every((b) => Object.prototype.hasOwnProperty.call(st, b)) && Object.keys(st).length === 4);
  check('each value carries {state:{remainingFraction}, belowReserve}',
    qm.BUCKETS.every((b) => typeof st[b].state.remainingFraction === 'number' && typeof st[b].belowReserve === 'boolean'));
  check('quartermasterConfirmation is ABSENT unless confirmed (normalizeBuckets reads absence as false)',
    !Object.prototype.hasOwnProperty.call(st['AU-opus'], 'quartermasterConfirmation'));
  check('the state object carries no reserveBreached/throttleObserved/exhausted keys when none apply',
    Object.keys(st['AU-all'].state).length === 1);
  check('every remainingFraction is in [0,1] — the router throws otherwise',
    qm.BUCKETS.every((b) => st[b].state.remainingFraction >= 0 && st[b].state.remainingFraction <= 1));

  // The default (WO-2-MEASURED) forecast, ruling R4 (corrected): imported
  // from the router.
  const fc = qm.defaultForecast();
  check('the default forecast is derived from castings and MARKED as an estimate',
    fc.estimate === true && /WO-2-MEASURED weekly draw/.test(fc.basis));
  check('the default mandatoryReviewDraw is the WO-2 MEASURED weekly draw (0.03), not the rejected peak-derived 0.504',
    Math.abs(fc.mandatoryReviewDraw - 0.03) < 1e-9);
  check('incidentDraw is 0 — a disclosed under-estimate, not a fabricated number', fc.incidentDraw === 0);
  check('requiredReserve comes from the ROUTER, not a local reimplementation',
    (() => {
      const d = qm.bucketStateDetail({ file: f, now: NOW });
      return Math.abs(d.analysis.requiredReserve - router.requiredReserve(fc)) < 1e-12;
    })());
  // Corrected R4: the dynamic term (0.03 × 1.3 = 0.039) sits BELOW the plan's
  // own 8% floor, so the FLOOR governs the default required reserve — not the
  // rejected peak-derived ~65.5%. Pinned here so the floor-dominance is
  // visible rather than surprising.
  check('the default required reserve is the corrected 0.039 dynamic term, floor-dominated to 0.08',
    Math.abs(router.requiredReserve(fc) - 0.08) < 1e-9);
  check('the floor (0.08), not the dynamic term (0.039), is what the default actually enforces',
    router.requiredReserve(fc) > (fc.mandatoryReviewDraw + fc.incidentDraw) * 1.3);
  check('under the default forecast a 75% bucket is NOT below reserve',
    qm.bucketState({ file: f, now: NOW })['AU-all'].belowReserve === false);
  check('…nor is a 60% bucket — the corrected default reserve is the 8% floor, not ~65.5%',
    (() => { const g = newFile(); seedAll(g, 0.6, ago(1)); return qm.bucketState({ file: g, now: NOW })['AU-all'].belowReserve === false; })());
  check('…but a bucket JUST BELOW the floor (0.0799 < 8%) IS below reserve under the default forecast',
    (() => { const g = newFile(); seedAll(g, 0.0799, ago(1)); return qm.bucketState({ file: g, now: NOW })['AU-all'].belowReserve === true; })());
}

// =========================================================================
section('5. Threshold boundary exactness — the router\'s own semantics');

{
  const at = (fraction) => {
    const f = newFile();
    seedAll(f, fraction, ago(1));
    const st = qm.bucketState({ file: f, now: NOW, forecast: FC0 });
    return { st, state: router.normalizeBuckets(st)['AU-all'].state, belowReserve: st['AU-all'].belowReserve };
  };
  check('0.40 → Green (the ladder is "≥ 40%")', at(0.4).state === 'Green');
  check('0.399 → Amber', at(0.399).state === 'Amber');
  check('0.20 → Amber (amberBelow is exclusive at the bottom)', at(0.2).state === 'Amber');
  check('0.199 → Orange', at(0.199).state === 'Orange');
  check('0.08 → Orange, and not below the 8% floor reserve', at(0.08).state === 'Orange' && at(0.08).belowReserve === false);
  check('0.0799 → Red, and below the 8% floor reserve', at(0.0799).state === 'Red' && at(0.0799).belowReserve === true);
  check('0 → Exhausted (ruling R7: a reading of zero IS evidence of exhaustion)', at(0).state === 'Exhausted');
  check('the Quartermaster\'s own poolState agrees with the router\'s for every probe',
    (() => {
      const f = newFile();
      seedAll(f, 0.199, ago(1));
      const d = qm.bucketStateDetail({ file: f, now: NOW, forecast: FC0 });
      return d.analysis.buckets['AU-all'].poolState === 'Orange';
    })());
}

// =========================================================================
section('6. Throttles: Red precedence and the Exhausted evidence rule (R7)');

{
  const f = newFile();
  seedAll(f, 0.95, ago(1));
  qm.recordThrottle('AU-all', 'soft', 'rate-limited mid-round', { file: f, now: ago(2) });
  const st = qm.bucketState({ file: f, now: NOW, forecast: FC0 });
  check('a soft throttle in the freshness window sets throttleObserved', st['AU-all'].state.throttleObserved === true);
  check('…and forces Red through the router even at a 95% reading (§5.5 precedence)',
    router.normalizeBuckets(st)['AU-all'].state === 'Red');
  check('a soft throttle is Red, NOT Exhausted — exhaustion is never assumed from silence',
    st['AU-all'].state.exhausted === undefined);

  const g = newFile();
  seedAll(g, 0.95, ago(1));
  qm.recordThrottle('AU-opus', 'hard', 'weekly Opus limit reached', { file: g, now: ago(2) });
  const st2 = qm.bucketState({ file: g, now: NOW, forecast: FC0 });
  check('a HARD throttle in the window is Exhausted evidence (ruling R7)', st2['AU-opus'].state.exhausted === true);
  check('…and the router reads it as Exhausted', router.normalizeBuckets(st2)['AU-opus'].state === 'Exhausted');

  const h = newFile();
  seedAll(h, 0.95, ago(1));
  qm.recordThrottle('AU-opus', 'hard', 'old news', { file: h, now: ago(48) });
  const st3 = qm.bucketState({ file: h, now: NOW, forecast: FC0 });
  check('a throttle older than the freshness window no longer forces a state', router.normalizeBuckets(st3)['AU-opus'].state === 'Green');
}

// =========================================================================
section('7. THE INTEROP — a P0-produced state through the real router');

{
  // (a) Green path, end to end.
  const f = newFile();
  seedAll(f, 0.92, ago(1));
  const green = qm.bucketState({ file: f, now: NOW, forecast: FC0 });
  const nb = router.normalizeBuckets(green);
  check('INTEROP: normalizeBuckets accepts the P0 output unmodified (all four buckets Green)',
    qm.BUCKETS.every((b) => nb[b].state === 'Green'));
  const castGreen = router.cast('Investigator', green);
  check('INTEROP: cast() over the P0 state serves the Opus 5 primary rung',
    castGreen.ok === true && castGreen.casting.model === 'Opus 5' && castGreen.rung === 'primary');
  const dGreen = router.dispatch(order('I0'), green);
  check('INTEROP: dispatch() over the P0 state routes end-to-end (Green path)',
    dGreen.ok === true && dGreen.casting.casting.model === 'Opus 5' && dGreen.role === 'Investigator');
  check('INTEROP: no gate fires on the Green path', dGreen.outcome === undefined);

  // (b) A below-reserve AU-opus READING blocks a real Opus dispatch.
  // 0.30 of the bucket against an explicit 39%-required forecast (not the
  // default) — the reading alone arms the P15 stop, no hand-set flag.
  const g = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0.30 : 0.92, 'vendor UI', undefined, { file: g, now: ago(1) });
  const low = qm.bucketState({ file: g, now: NOW, forecast: { mandatoryReviewDraw: 0.3, incidentDraw: 0 } });
  check('a 30% AU-opus reading against a 39% required reserve sets belowReserve', low['AU-opus'].belowReserve === true);
  check('…and marks reserveBreached on the state the router reads', low['AU-opus'].state.reserveBreached === true);
  const dGated = router.dispatch(order('I0'), low);
  check('INTEROP GATE: a below-reserve AU-opus reading BLOCKS the Opus dispatch',
    dGated.ok === false && dGated.outcome === 'GATED');
  check('INTEROP GATE: the gate that fired is the P15 AU-O reserve gate',
    dGated.gate.gate === 'AU-O reserve (P15)');
  check('INTEROP GATE: the lawful responses are mirror-or-wait — a decision, never a silent substitution',
    JSON.stringify(dGated.gate.lawfulResponses) === JSON.stringify(['mirror', 'wait']));

  // (c) The Amber arm — an unconfirmed Amber AU-opus refuses an Opus dispatch
  // on a purpose the ladder still permits on the bucket (review).
  const h = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0.30 : 0.92, 'vendor UI', undefined, { file: h, now: ago(1) });
  const amber = qm.bucketState({ file: h, now: NOW, forecast: FC0 });
  check('an Amber-band reading is not belowReserve at the floor forecast', amber['AU-opus'].belowReserve === false);
  const gate = router.preDispatchGate({ model: 'Opus 5' }, amber);
  check('INTEROP GATE: unconfirmed Amber AU-opus arms the §5.5 gate',
    gate.allowed === false && gate.gate === 'AU-O armed (Amber, §5.5)');
  const dAmber = router.dispatch(order('I0'), amber, { purpose: 'review' });
  check('INTEROP GATE: an Opus review dispatch on unconfirmed Amber is GATED',
    dAmber.ok === false && dAmber.outcome === 'GATED' && dAmber.gate.gate === 'AU-O armed (Amber, §5.5)');
  // …and a recorded confirmation lifts it.
  const c = qm.confirm('AU-opus', { file: h, now: NOW, dispatchRef: 'interop-1' });
  const confirmed = qm.bucketState({ file: h, now: NOW, forecast: FC0 });
  check('confirm() sets quartermasterConfirmation on the published state',
    c.confirmed === true && confirmed['AU-opus'].quartermasterConfirmation === true);
  const dConfirmed = router.dispatch(order('I0'), confirmed, { purpose: 'review' });
  check('INTEROP GATE: the recorded confirmation lifts the Amber arm and the Opus review dispatches',
    dConfirmed.ok === true && dConfirmed.casting.casting.model === 'Opus 5');

  // (d) An exhausted bucket takes the exhaustion-matrix path. The evidence is
  // a HARD THROTTLE on a bucket whose fraction is still healthy (ruling R7's
  // second form) — a zero reading is simultaneously below reserve, and the
  // reserve gate is the stricter stop, asserted separately below.
  const x = newFile();
  seedAll(x, 0.92, ago(1));
  qm.recordThrottle('AU-opus', 'hard', 'weekly Opus limit reached — served Sonnet silently', { file: x, now: ago(2) });
  const exh = qm.bucketState({ file: x, now: NOW, forecast: FC0 });
  check('a hard throttle publishes exhausted: true with the fraction untouched',
    exh['AU-opus'].state.exhausted === true && exh['AU-opus'].state.remainingFraction === 0.92 && exh['AU-opus'].belowReserve === false);
  check('INTEROP: the router reads the bucket as Exhausted', router.effectiveState('Opus 5', exh) === 'Exhausted');
  const dExh = router.dispatch(order('I0'), exh, { purpose: 'closing' });
  check('INTEROP: an exhausted AU-opus recasts the Investigator off the dead bucket, disclosed',
    dExh.ok === true && dExh.casting.recastFrom === 'primary' && /Exhausted/.test(dExh.casting.recastReason), JSON.stringify(dExh).slice(0, 200));
  check('INTEROP: the recast never serves the exhausted family', dExh.casting.casting.vendor === 'openai');

  const z = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0 : 0.92, 'vendor UI', undefined, { file: z, now: ago(1) });
  const zero = qm.bucketState({ file: z, now: NOW, forecast: FC0 });
  check('a zero reading is BOTH exhausted and below reserve',
    zero['AU-opus'].state.exhausted === true && zero['AU-opus'].belowReserve === true);
  check('INTEROP: and the stricter P15 reserve stop wins — GATED, not a silent recast',
    (() => { const d = router.dispatch(order('I0'), zero); return d.ok === false && d.gate.gate === 'AU-O reserve (P15)'; })());

  // (e) A mandatory-class order whose cross-family direction needs a dead
  // bucket must not close same-family — the router's own law, driven here by
  // P0 evidence rather than a hand-written bucket literal.
  const y = newFile();
  seedAll(y, 0.92, ago(1));
  qm.recordThrottle('OU', 'hard', 'codex weekly cap', { file: y, now: ago(2) });
  const ouDead = qm.bucketState({ file: y, now: NOW, forecast: FC0 });
  const rev = router.reviewer(['anthropic'], 'T2', { policy: 'mandatory', buckets: ouDead });
  check('INTEROP: with OU exhausted by a recorded throttle, mandatory review does NOT close same-family',
    rev.closes === false && rev.outcome === 'DOES_NOT_CLOSE', JSON.stringify(rev).slice(0, 200));
  check('INTEROP: the refusal offers the plan\'s lawful options (wait / named human / park)',
    Array.isArray(rev.options) && rev.options.length >= 3);
}

// =========================================================================
section('8. The confirmation protocol (ruling R5)');

{
  const f = newFile();
  seedAll(f, 0.30, ago(1));
  const before = lines(f).length;
  const ok = qm.confirm('AU-opus', { file: f, now: NOW, dispatchRef: 'ord-42' });
  check('a fresh above-Orange reading grants confirmation', ok.confirmed === true);
  check('the grant returns the evidence it rested on',
    ok.evidence.remainingFraction === 0.30 && ok.evidence.evidenceTs === ago(1).toISOString() && ok.evidence.source === 'test vendor UI');
  check('the grant appends exactly one confirmation entry (the audit trail)', lines(f).length === before + 1);
  check('the audit entry carries the dispatch reference and the evidence timestamp',
    (() => { const e = JSON.parse(lines(f)[lines(f).length - 1]); return e.kind === 'confirmation' && e.dispatchRef === 'ord-42' && e.evidenceTs === ago(1).toISOString(); })());

  const g = newFile();
  seedAll(g, 0.30, ago(48));
  const stale = qm.confirm('AU-opus', { file: g, now: NOW });
  check('a STALE reading cannot arm the gate', stale.confirmed === false && /freshness window/.test(stale.reason));
  check('a refused confirmation appends NOTHING — no artifact a later reader could mistake for a grant',
    lines(g).length === 4);

  const h = newFile();
  seedAll(h, 0.20, ago(1));
  const atOrange = qm.confirm('AU-opus', { file: h, now: NOW });
  check('exactly at orangeBelow (0.20) confirmation is REFUSED — the arm covers the Amber band only',
    atOrange.confirmed === false && /orangeBelow/.test(atOrange.reason));
  const i = newFile();
  seedAll(i, 0.2001, ago(1));
  check('just above orangeBelow it is granted', qm.confirm('AU-opus', { file: i, now: NOW }).confirmed === true);

  const j = newFile();
  const none = qm.confirm('AU-opus', { file: j, now: NOW });
  check('with no reading at all, confirmation is refused and points at --record',
    none.confirmed === false && /--record AU-opus/.test(none.reason));
  check('confirm() still THROWS on an unknown bucket (validation, not evidence)',
    threw(() => qm.confirm('AU-sonnet', { file: j, now: NOW })) !== null);

  const k = newFile();
  seedAll(k, 0.30, ago(1));
  qm.confirm('AU-opus', { file: k, now: ago(30) });
  check('a confirmation older than the freshness window no longer counts',
    qm.bucketState({ file: k, now: NOW, forecast: FC0 })['AU-opus'].quartermasterConfirmation === undefined);
}

// =========================================================================
section('9. Throttle prediction (ruling R6)');

{
  const f = newFile();
  qm.recordReading('AU-all', 0.90, 'vendor UI', undefined, { file: f, now: ago(10) });
  qm.recordReading('AU-all', 0.50, 'vendor UI', undefined, { file: f, now: ago(2) });
  const p = qm.predictThrottle('AU-all', { file: f, now: NOW });
  check('a declining trend predicts', p.ok === true && p.estimates.length === 4);
  check('the confidence is labelled with the method, never higher', p.confidence === 'low (two-point linear)');
  check('the rate is reported so the reader can check the arithmetic', Math.abs(p.from.ratePerHour + 0.05) < 1e-9);
  check('at 50% remaining the Amber rung is not yet crossed, so it gets an ETA',
    p.estimates[0].name === 'Amber' && p.estimates[0].crossed === false);
  check('the Red crossing is 8.4h after the latest reading (0.50→0.08 at 5pp/h)',
    Math.abs(p.estimates[2].msFromNow - (8.4 * H - 2 * H)) < 1000, JSON.stringify(p.estimates[2]));
  check('the Exhausted (zero) crossing is predicted too', p.estimates[3].name === 'Exhausted' && p.estimates[3].etaIso > p.estimates[2].etaIso);

  const g = newFile();
  qm.recordReading('AU-all', 0.50, 'vendor UI', undefined, { file: g, now: ago(2) });
  const p2 = qm.predictThrottle('AU-all', { file: g, now: NOW });
  check('a single reading yields NO prediction — extrapolating from one point invents a slope',
    p2.ok === false && p2.reason === 'insufficient data (need ≥2 readings)');
  const p3 = qm.predictThrottle('OU', { file: g, now: NOW });
  check('no readings at all is the same typed refusal', p3.ok === false && /insufficient data/.test(p3.reason));

  const h = newFile();
  qm.recordReading('AU-all', 0.30, 'vendor UI', undefined, { file: h, now: ago(10) });
  qm.recordReading('AU-all', 0.95, 'vendor UI', undefined, { file: h, now: ago(2) });
  const p4 = qm.predictThrottle('AU-all', { file: h, now: NOW });
  check('a rising allowance is typed as a window reset, with no fictional crossing date',
    p4.ok === true && p4.estimates.length === 0 && p4.note === 'window-reset or non-monotonic; no prediction');
  check('…at confidence "insufficient-trend"', p4.confidence === 'insufficient-trend');

  const i = newFile();
  qm.recordReading('AU-all', 0.50, 'vendor UI', undefined, { file: i, now: ago(2) });
  qm.recordReading('AU-all', 0.50, 'vendor UI', undefined, { file: i, now: ago(2) });
  const p5 = qm.predictThrottle('AU-all', { file: i, now: NOW });
  check('two readings at the same instant do not divide by zero', p5.ok === false && /do not advance in time/.test(p5.reason));

  const j = newFile();
  qm.recordReading('AU-all', 0.30, 'vendor UI', undefined, { file: j, now: ago(10) });
  qm.recordReading('AU-all', 0.10, 'vendor UI', undefined, { file: j, now: ago(2) });
  const p6 = qm.predictThrottle('AU-all', { file: j, now: NOW });
  check('a threshold already below the latest reading is reported as crossed, not as a past ETA',
    p6.estimates[0].crossed === true && p6.estimates[1].crossed === true && p6.estimates[2].crossed === false);
  check('predictThrottle throws on an unknown bucket', threw(() => qm.predictThrottle('AU-sonnet', { file: j, now: NOW })) !== null);
}

// =========================================================================
section('10. Report and snapshot publish');

{
  const f = newFile();
  seedAll(f, 0.35, ago(6));
  seedAll(f, 0.30, ago(1));
  qm.recordThrottle('OU', 'soft', 'codex 429', { file: f, now: ago(1) });
  const txt = qm.report({ file: f, now: NOW, forecast: FC0 });
  check('report names every bucket', qm.BUCKETS.every((b) => txt.includes(b)));
  check('report shows the required reserve and its forecast basis', /required 8\.0%/.test(txt) && /forecast:/.test(txt));
  check('report shows per-bucket state via the ladder', /Amber/.test(txt) && /Red/.test(txt));
  check('report lists the active throttle with its severity and message', /\[soft\].*codex 429/.test(txt));
  check('report carries the predicted-vs-observed review criterion', /PREDICTED vs OBSERVED/.test(txt));
  check('report explains that observations accumulate from throttle records', /1 observed throttle\(s\) on record/.test(txt));
  check('report does NOT throw when a bucket fails closed — it prints the refusal',
    (() => { const g = newFile(); qm.recordReading('OU', 0.5, 's', undefined, { file: g, now: ago(1) }); return /REFUSED for AU-all/.test(qm.report({ file: g, now: NOW, forecast: FC0 })); })());

  const out = path.join(TMP, 'snapshot.json');
  const pub = qm.publish({ file: f, now: NOW, forecast: FC0, out });
  const snap = JSON.parse(fs.readFileSync(out, 'utf8'));
  check('publish writes a snapshot at the requested path', pub.file === out && fs.existsSync(out));
  check('the snapshot carries bucket_state in the router\'s contract shape',
    qm.BUCKETS.every((b) => typeof snap.bucket_state[b].state.remainingFraction === 'number'));
  check('the snapshot round-trips through the real router', router.normalizeBuckets(snap.bucket_state)['AU-all'].state === 'Amber');
  check('the snapshot discloses age, staleness and source per bucket',
    snap.disclosures.length === 4 && snap.disclosures.every((d) => typeof d.ageMs === 'number' && typeof d.stale === 'boolean' && d.source));
  check('the snapshot names its generator and its contract',
    /quartermaster\.js/.test(snap.generator) && /normalizeBuckets/.test(snap.contract));
  const bad = path.join(TMP, 'never-written.json');
  const e = threw(() => qm.publish({ file: newFile(), now: NOW, forecast: FC0, out: bad }));
  check('publish FAILS CLOSED and writes nothing when evidence is missing', e !== null && !fs.existsSync(bad));
}

// =========================================================================
section('11. Tamper — hand-corrupted JSONL');

{
  const mk = (extraLines) => {
    const f = newFile();
    seedAll(f, 0.7, ago(3));
    for (const l of extraLines) fs.appendFileSync(f, l + '\n', 'utf8');
    return f;
  };
  const detail = (f) => qm.bucketStateDetail({ file: f, now: NOW, forecast: FC0 });

  const f1 = mk(['{"ts":"2026-08-30T11:00:00Z","kind":"reading","bucket":"AU-all","remainingFraction":1.7,"source":"x"}']);
  const d1 = detail(f1);
  check('a fraction outside [0,1] in the FILE is malformed, not accepted',
    d1.analysis.malformedCount === 1 && /remainingFraction not in/.test(d1.analysis.malformed[0].reason));
  check('…and being in the latest position, it fails that bucket closed', d1.ok === false && /AU-all/.test(d1.analysis.buckets['AU-all'].problem));

  const f2 = mk(['{"ts":"2026-08-30T11:00:00Z","kind":"reading","bucket":"AU-opus","remainingFraction":0.4}']);
  check('a reading with no source is malformed (provenance is not optional)',
    /reading has no source/.test(detail(f2).analysis.malformed[0].reason));

  const f3 = mk(['{"ts":"2026-08-30T11:00:00Z","kind":"guess","bucket":"AU-all","remainingFraction":0.4,"source":"x"}']);
  check('an unknown kind is malformed', /unknown kind/.test(detail(f3).analysis.malformed[0].reason));

  const f4 = mk(['{"ts":"nonsense","kind":"reading","bucket":"AU-all","remainingFraction":0.4,"source":"x"}']);
  check('an unparseable ts is malformed', /unparseable ts/.test(detail(f4).analysis.malformed[0].reason));

  const f5 = mk(['{"ts":"2026-08-30T11:00:00Z","kind":"reading","bucket":"AU-sonnet","remainingFraction":0.4,"source":"x"}']);
  const d5 = detail(f5);
  check('a reading for a bucket the plan does not publish is malformed',
    /unknown or missing bucket/.test(d5.analysis.malformed[0].reason));
  check('…and because its bucket is unattributable, it poisons EVERY bucket behind it',
    qm.BUCKETS.every((b) => d5.analysis.buckets[b].problem !== null));

  const f6 = mk(['[1,2,3]']);
  check('a JSON array line is malformed', /not a JSON object/.test(detail(f6).analysis.malformed[0].reason));

  const f7 = mk(['{"ts":"2026-08-30T11:00:00Z","kind":"throttle","bucket":"OU","severity":"catastrophic","message":"m"}']);
  check('a throttle with an out-of-vocabulary severity is malformed', /severity not soft\|hard/.test(detail(f7).analysis.malformed[0].reason));

  const f8 = mk(['', '   ', '']);
  check('blank lines are not malformed — they are nothing', detail(f8).analysis.malformedCount === 0);

  const f9 = mk(['{"ts":"2026-08-30T11:00:00Z","kind":"reading","bucket":"AU-all","remainingFraction":0.4,"source":"x","__proto__":{"remainingFraction":0}}']);
  check('a prototype-pollution attempt in a record does not corrupt the published state',
    (() => { const st = qm.bucketState({ file: f9, now: NOW, forecast: FC0 }); return st['AU-all'].state.remainingFraction === 0.4 && ({}).remainingFraction === undefined; })());

  check('quartermaster.js source carries no control bytes',
    !/\x00/.test(fs.readFileSync(QM_PATH, 'utf8')));
}

// =========================================================================
section('12. CLI');

{
  const f = newFile();
  const run = (args) => spawnSync(process.execPath, [QM_PATH].concat(args), { encoding: 'utf8' });
  const r1 = run(['--file', f, '--record', 'AU-all', '0.5', '--source', 'vendor UI', '--note', 'cli test']);
  check('CLI --record exits 0 and appends', r1.status === 0 && lines(f).length === 1, r1.stderr);
  const r2 = run(['--file', f, '--record', 'AU-bogus', '0.5', '--source', 'x']);
  check('CLI refuses an unknown bucket with exit 1', r2.status === 1 && /unknown bucket/.test(r2.stderr));
  const r3 = run(['--file', f, '--state', '--forecast-mandatory', '0']);
  check('CLI --state fails closed (exit 1) while three buckets have no reading',
    r3.status === 1 && /FAILS CLOSED/.test(r3.stderr));
  for (const b of ['AU-opus', 'AU-fable', 'OU']) run(['--file', f, '--record', b, '0.5', '--source', 'vendor UI']);
  const r4 = run(['--file', f, '--state', '--forecast-mandatory', '0']);
  check('CLI --state prints the contract JSON once every bucket has evidence',
    r4.status === 0 && router.normalizeBuckets(JSON.parse(r4.stdout))['AU-all'].state === 'Green', r4.stderr);
  const r5 = run(['--file', f, '--report', '--forecast-mandatory', '0']);
  check('CLI --report exits 0 and prints the summary', r5.status === 0 && /QUARTERMASTER/.test(r5.stdout));
  const snap = path.join(TMP, 'cli-snapshot.json');
  const r6 = run(['--file', f, '--publish', '--out', snap, '--forecast-mandatory', '0']);
  check('CLI --publish writes the snapshot and exits 0', r6.status === 0 && fs.existsSync(snap));
  const r7 = run(['--file', f, '--throttle', 'OU', 'hard', '--message', 'weekly cap']);
  check('CLI --throttle records a hard throttle', r7.status === 0 && /"severity":"hard"/.test(r7.stdout));
  const r8 = run(['--file', f, '--confirm', 'AU-opus', '--dispatch-ref', 'cli-1']);
  check('CLI --confirm exits 0 on a grant', r8.status === 0 && /"confirmed": true/.test(r8.stdout));
  const g = newFile();
  qm.recordReading('AU-opus', 0.1, 'vendor UI', undefined, { file: g });
  const r9 = run(['--file', g, '--confirm', 'AU-opus']);
  check('CLI --confirm exits 1 on a refusal', r9.status === 1 && /"confirmed": false/.test(r9.stdout));
  const r10 = run([]);
  check('CLI with no command prints usage and exits 1', r10.status === 1 && /usage:/.test(r10.stderr));
  check('the suite created, modified, or deleted no bytes of the repository\'s real readings file '
      + '(present or absent, it is byte-identical before and after — every fixture call above used an explicit --file)',
    (() => {
      const after = snapshotRealReadings();
      if (after.exists !== REAL_READINGS_BEFORE.exists) return false;
      if (!after.exists) return true;
      return after.size === REAL_READINGS_BEFORE.size
        && after.mtimeMs === REAL_READINGS_BEFORE.mtimeMs
        && after.hash === REAL_READINGS_BEFORE.hash;
    })());
}

// =========================================================================
section('13. CRITICAL (round 2) — confirmation validity re-anchored to LIVE evidence');

{
  // (a) THE EXPLOIT REPRODUCTION, verbatim from the round-1 review: a
  // confirmation granted on a 0.35 reading must NOT still arm the gate once
  // a LATER 0.10 reading has landed — the confirmation's evidence has been
  // superseded, and the current reading (Orange) does not even satisfy the
  // R5 predicate any more.
  const f = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0.35 : 0.92, 'vendor UI', undefined, { file: f, now: ago(3) });
  const grant = qm.confirm('AU-opus', { file: f, now: ago(3) });
  check('exploit setup: the 0.35 reading grants confirmation', grant.confirmed === true);
  qm.recordReading('AU-opus', 0.10, 'vendor UI', undefined, { file: f, now: ago(2) });
  const st = qm.bucketState({ file: f, now: NOW, forecast: FC0 });
  check('the confirmation is VOID once its evidence is superseded — quartermasterConfirmation is absent',
    !Object.prototype.hasOwnProperty.call(st['AU-opus'], 'quartermasterConfirmation'));
  const detail = qm.bucketStateDetail({ file: f, now: NOW, forecast: FC0 });
  check('…and the analysis states WHY: the evidence was superseded',
    /SUPERSEDED/.test(detail.analysis.buckets['AU-opus'].confirmation.voidReason));
  const dGated = router.dispatch(order('I0'), st, { purpose: 'review' });
  check('EXPLOIT REPRODUCTION: dispatch GATES — a confirmation granted on 0.35 evidence cannot arm the gate once a later 0.10 reading lands',
    dGated.ok === false && dGated.outcome === 'GATED' && dGated.gate.gate === 'AU-O armed (Amber, §5.5)',
    JSON.stringify(dGated).slice(0, 300));

  // (b) A newer reading that ALSO satisfies the predicate still voids —
  // re-confirmation is required on ITS OWN evidence, never inherited.
  const f2 = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0.35 : 0.92, 'vendor UI', undefined, { file: f2, now: ago(3) });
  qm.confirm('AU-opus', { file: f2, now: ago(3) });
  qm.recordReading('AU-opus', 0.36, 'vendor UI', undefined, { file: f2, now: ago(2) });
  check('(b) a newer reading that STILL satisfies R5 does not inherit the old confirmation — evidenceTs must match exactly',
    !Object.prototype.hasOwnProperty.call(qm.bucketState({ file: f2, now: NOW, forecast: FC0 })['AU-opus'], 'quartermasterConfirmation'));

  // (c) A confirmation whose evidenceTs matches the current latest reading's
  // ts EXACTLY, but that reading's own fraction fails the R5 predicate — a
  // hand-tampered / hypothetically-mis-granted record. Voided on the LIVE
  // reading's own fraction, never trusting the confirmation's recorded one.
  const g = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0.15 : 0.92, 'vendor UI', undefined, { file: g, now: ago(3) });
  const readingTs = ago(3).toISOString();
  fs.appendFileSync(g, JSON.stringify({ ts: ago(1).toISOString(), kind: 'confirmation', bucket: 'AU-opus', evidenceTs: readingTs, remainingFraction: 0.15 }) + '\n', 'utf8');
  const st2 = qm.bucketState({ file: g, now: NOW, forecast: FC0 });
  check('(c) evidenceTs matches but the LIVE reading fails the R5 predicate — voided',
    !Object.prototype.hasOwnProperty.call(st2['AU-opus'], 'quartermasterConfirmation'));
  const d2 = qm.bucketStateDetail({ file: g, now: NOW, forecast: FC0 });
  check('…and the void reason names the failed predicate, not a superseded-evidence mismatch',
    /no longer satisfies the R5 Amber predicate/.test(d2.analysis.buckets['AU-opus'].confirmation.voidReason));

  // (d) A fresh throttle recorded AFTER a valid confirmation voids it even
  // though the reading (and therefore evidenceTs) never changed.
  const h = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0.35 : 0.92, 'vendor UI', undefined, { file: h, now: ago(3) });
  const grant2 = qm.confirm('AU-opus', { file: h, now: ago(3) });
  check('(d) setup: confirmation granted on healthy evidence', grant2.confirmed === true);
  qm.recordThrottle('AU-opus', 'soft', 'rate-limited after confirmation', { file: h, now: ago(1) });
  const st3 = qm.bucketState({ file: h, now: NOW, forecast: FC0 });
  check('(d) a fresh throttle recorded after confirmation voids it, even though evidenceTs still matches',
    !Object.prototype.hasOwnProperty.call(st3['AU-opus'], 'quartermasterConfirmation'));
  const d3 = qm.bucketStateDetail({ file: h, now: NOW, forecast: FC0 });
  check('…and the void reason names the throttle',
    /a confirmation cannot arm the gate over an active throttle/.test(d3.analysis.buckets['AU-opus'].confirmation.voidReason));
  // preDispatchGate, evaluated directly against the requested Opus rung
  // (the mechanism §5.5/P15 actually arms) rather than through cast()'s
  // degradation machine — Red only permits "closing" for Opus, so a
  // 'review'-purpose dispatch would recast away before ever reaching the
  // gate; asserting on preDispatchGate isolates the confirmation's own
  // effect from that unrelated recast choice.
  const gateThrottled = router.preDispatchGate({ model: 'Opus 5' }, st3);
  check('…and preDispatchGate refuses the requested Opus rung — the throttle forces Red and the voided confirmation cannot lift the arm',
    gateThrottled.allowed === false && gateThrottled.gate === 'AU-O armed (Amber, §5.5)');

  // (e) Structural: a malformed-latest poison landing AFTER a valid
  // confirmation still fails the bucket fully closed — a confirmation can
  // never rescue (or hide behind) a poisoned bucket. bucketState() throws
  // before the confirmation logic is even reached (step (1) of analyze()).
  const k = newFile();
  for (const b of qm.BUCKETS) qm.recordReading(b, b === 'AU-opus' ? 0.35 : 0.92, 'vendor UI', undefined, { file: k, now: ago(3) });
  qm.confirm('AU-opus', { file: k, now: ago(3) });
  fs.appendFileSync(k, '{"ts":"' + ago(1).toISOString() + '","kind":"reading","bucket":"AU-opus","remainingFraction":\n', 'utf8');
  const e = threw(() => qm.bucketState({ file: k, now: NOW, forecast: FC0 }));
  check('(e) a malformed-latest poison after a valid confirmation still fails the bucket closed',
    e !== null && e.failClosed === true && /AU-opus/.test(e.message));
}

// =========================================================================
section('14. MAJOR (round 2) — confirm() no longer blind-grants');

{
  // (a) A fresh throttle refuses, and appends nothing.
  const f = newFile();
  qm.recordReading('AU-opus', 0.35, 'vendor UI', undefined, { file: f, now: ago(2) });
  qm.recordThrottle('AU-opus', 'soft', 'mid-window throttle', { file: f, now: ago(1) });
  const before1 = lines(f).length;
  const r1 = qm.confirm('AU-opus', { file: f, now: NOW });
  check('confirm() REFUSES when a throttle is fresh for the bucket', r1.confirmed === false && /throttle is fresh/.test(r1.reason));
  check('…and appends nothing', lines(f).length === before1);

  // …a HARD throttle refuses too, not only soft.
  const f2 = newFile();
  qm.recordReading('AU-opus', 0.35, 'vendor UI', undefined, { file: f2, now: ago(2) });
  qm.recordThrottle('AU-opus', 'hard', 'weekly cap', { file: f2, now: ago(1) });
  const r1b = qm.confirm('AU-opus', { file: f2, now: NOW });
  check('…and so does a HARD throttle', r1b.confirmed === false && /hard throttle is fresh/.test(r1b.reason));

  // (b) An exhausted (zero) bucket refuses, and appends nothing.
  const g = newFile();
  qm.recordReading('AU-opus', 0, 'vendor UI', undefined, { file: g, now: ago(1) });
  const before2 = lines(g).length;
  const r2 = qm.confirm('AU-opus', { file: g, now: NOW });
  check('confirm() REFUSES on an exhausted (zero) reading', r2.confirmed === false && /exhausted/.test(r2.reason));
  check('…and appends nothing', lines(g).length === before2);

  // (c) A malformed latest raw line refuses, and appends nothing.
  const h = newFile();
  qm.recordReading('AU-opus', 0.35, 'vendor UI', undefined, { file: h, now: ago(2) });
  fs.appendFileSync(h, '{"ts":"' + ago(1).toISOString() + '","kind":"reading","bucket":"AU-opus","remainingFraction":\n', 'utf8');
  const before3 = lines(h).length;
  const r3 = qm.confirm('AU-opus', { file: h, now: NOW });
  check('confirm() REFUSES when the bucket\'s latest raw line is malformed', r3.confirmed === false && /malformed record/.test(r3.reason));
  check('…and appends nothing', lines(h).length === before3);
}

// =========================================================================
section('15. MAJOR (round 2) — module-boundary validation');

{
  const f = newFile();
  seedAll(f, 0.5, ago(1));
  const rej = (what, fn, re) => {
    const e = threw(fn);
    check(what, e !== null && re.test(e.message), e ? e.message : '(did not throw)');
  };
  rej('a string mandatoryReviewDraw is refused, not coerced',
    () => qm.bucketState({ file: f, now: NOW, forecast: { mandatoryReviewDraw: '0.3', incidentDraw: 0 } }),
    /forecast\.mandatoryReviewDraw.*must be a finite number/);
  rej('a string incidentDraw is refused, not coerced',
    () => qm.bucketState({ file: f, now: NOW, forecast: { mandatoryReviewDraw: 0, incidentDraw: '0.1' } }),
    /forecast\.incidentDraw.*must be a finite number/);
  rej('THE EXPLOIT VECTOR — both as strings (used to string-concat \'0.3\'+\'0.1\' into NaN, ' +
      'making belowReserve always false and silently deleting the P15 gate) — now throws',
    () => qm.bucketState({ file: f, now: NOW, forecast: { mandatoryReviewDraw: '0.3', incidentDraw: '0.1' } }),
    /must be a finite number/);
  rej('a non-object forecast is refused', () => qm.bucketState({ file: f, now: NOW, forecast: 'default' }), /forecast.*must be an object/);
  rej('a negative mandatoryReviewDraw is refused', () => qm.bucketState({ file: f, now: NOW, forecast: { mandatoryReviewDraw: -1, incidentDraw: 0 } }), /must be ≥ 0/);
  rej('maxFreshMs as NaN is refused', () => qm.bucketState({ file: f, now: NOW, forecast: FC0, maxFreshMs: NaN }), /maxFreshMs.*must be a finite number/);
  rej('maxStaleMs as a string is refused rather than silently disabling the staleness check',
    () => qm.bucketState({ file: f, now: NOW, forecast: FC0, maxStaleMs: 'abc' }),
    /maxStaleMs.*must be a finite number/);
  rej('confirm() validates maxFreshMs at its own module boundary too',
    () => qm.confirm('AU-opus', { file: f, now: NOW, maxFreshMs: 'soon' }),
    /maxFreshMs.*must be a finite number/);

  // The exact scenario the review named: without validation, `ageMs >
  // maxStaleMs` compares a number against NaN (always false), so a
  // 400-day-old reading would publish as if it were fresh evidence.
  const g = newFile();
  qm.recordReading('AU-opus', 0.5, 'vendor UI', undefined, { file: g, now: new Date(NOW.getTime() - 400 * 24 * H) });
  const e2 = threw(() => qm.bucketState({ file: g, now: NOW, forecast: FC0, maxStaleMs: 'abc' }));
  check('a bogus maxStaleMs throws BEFORE a 400-day-old reading could publish as fresh evidence',
    e2 !== null && /maxStaleMs/.test(e2.message));
}

// =========================================================================
section('16. MINOR (round 2) — predictThrottle staleness refusal and RangeError guard');

{
  const f = newFile();
  qm.recordReading('AU-all', 0.90, 'vendor UI', undefined, { file: f, now: new Date(NOW.getTime() - 40 * 24 * H) });
  qm.recordReading('AU-all', 0.50, 'vendor UI', undefined, { file: f, now: new Date(NOW.getTime() - 30 * 24 * H) });
  const p = qm.predictThrottle('AU-all', { file: f, now: NOW });
  check('predictThrottle refuses when the latest reading is older than maxStaleMs (30d old > 7d default)',
    p.ok === false && /too stale to be evidence/.test(p.reason));

  // 1e-12 decline vector: an extremely slow decline puts every crossing time
  // far outside a JS Date's representable range (±8.64e15ms/epoch). Must not
  // throw a RangeError.
  const g = newFile();
  qm.recordReading('AU-all', 0.9 + 1e-12, 'vendor UI', undefined, { file: g, now: ago(10) });
  qm.recordReading('AU-all', 0.9, 'vendor UI', undefined, { file: g, now: ago(2) });
  let threwHere = null;
  let p2;
  try { p2 = qm.predictThrottle('AU-all', { file: g, now: NOW }); } catch (e) { threwHere = e; }
  check('an extreme 1e-12 decline does not throw a RangeError out of predictThrottle', threwHere === null, threwHere && threwHere.message);
  check('…and every far-out estimate is typed "beyond representable horizon", not a fictional ETA',
    p2 && p2.ok === true && p2.estimates.length === 4 && p2.estimates.every((e) => e.beyondHorizon === true && e.etaIso === null),
    p2 && JSON.stringify(p2.estimates));

  // report() calls predictThrottle internally and must never throw either.
  let reportThrew = null;
  let txt;
  try { txt = qm.report({ file: g, now: NOW }); } catch (e) { reportThrew = e; }
  check('report() never throws on the 1e-12 decline vector', reportThrew === null, reportThrew && reportThrew.message);
  check('…and prints the beyond-horizon note rather than a bogus far-future date', txt && /beyond representable horizon/.test(txt));
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + ' — ' + passes + ' passed');
