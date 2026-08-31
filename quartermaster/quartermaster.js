#!/usr/bin/env node
/**
 * WO-11 Quartermaster substrate — class P0 (final-plan.md catalog entry 24).
 *
 * Knows how much of each vendor's allowance remains — PER BUCKET — predicts
 * exhaustion, and publishes the degradation state the router reads. It is
 * deterministic code over RECORDED READINGS, and it is the whole seat: no
 * model is in the loop (ruling R9).
 *
 * ------------------------------------------------------------------ honesty
 *
 * §5.2: "the OpenAI side can be expressed as a share of a window today
 * (published ranges); the Anthropic side cannot, and INVENTING A DENOMINATOR
 * WOULD FABRICATE A NUMBER". This substrate therefore computes NOTHING from
 * the ledger's call counts. Every remaining-fraction it publishes came from a
 * human (or a future scraper) who READ a number off a vendor surface and
 * recorded it. There is no synthesis, no depletion model, no back-derivation
 * from `.claude/orchestra-ledger.jsonl` — the telemetry hook records neither
 * role, effort, vendor nor bucket, and the OpenAI pool is absent from it
 * entirely, so ledger-based attribution is IMPOSSIBLE today (ruling R2).
 *
 * The three consequences, all deliberate:
 *
 *   - A bucket with no fresh-enough reading FAILS CLOSED. It does not default
 *     to Green (that fabricates capacity), and it does not default to Red
 *     (that fabricates scarcity and would halt the harness on an empty file).
 *     It refuses, names the bucket, and prints the exact command that fixes it.
 *   - Staleness is DISCLOSED, never discounted. A 3-day-old reading of 0.55 is
 *     published as 0.55 with `stale: true` — not as 0.55 decayed by some
 *     invented burn rate.
 *   - Predictions are labelled with their method and confidence, and a single
 *     reading yields no prediction at all.
 *
 * ---------------------------------------------------------------- the file
 *
 * `.claude/orchestra-pool-readings.jsonl` — one JSON object per line,
 * append-only, GITIGNORED (it is operator data about a personal allowance;
 * it never enters version control):
 *
 *   {ts, kind:"reading",      bucket, remainingFraction, source, note?}
 *   {ts, kind:"throttle",     bucket, severity:"soft"|"hard", message}
 *   {ts, kind:"confirmation", bucket, dispatchRef?, evidenceTs, remainingFraction}
 *
 * Malformed lines are COUNTED AND REPORTED, never silently skipped; and a
 * malformed line sitting in the latest position for a bucket (i.e. after that
 * bucket's newest valid reading, or anywhere when the bucket has none) fails
 * that bucket closed by line number — a corrupted newest record could have
 * been the one that said "empty".
 *
 * -------------------------------------------------------------- the output
 *
 * `bucketState()` returns EXACTLY the router's `normalizeBuckets` input
 * (router/router.js:297-318) — all four buckets, own properties, each
 * `{state:{remainingFraction, stale?, ageMs?, reserveBreached?, throttleObserved?, exhausted?},
 * belowReserve, quartermasterConfirmation?}`. `stale`/`ageMs` (round 3, WO-11
 * Sol·max holistic review) are present whenever the reading is inside
 * maxFreshMs < age ≤ maxStaleMs — on the PUBLISHED state object itself, not
 * only in the human report, so a snapshot consumer or dispatcher sees the
 * disclosure too; router.js's normalizeBuckets/poolState ignore unrecognized
 * keys, so this is additive. The router owns the ladder and
 * the reserve formula; this file owns the EVIDENCE. `requiredReserve` is
 * imported from the router rather than reimplemented, so the reserve
 * arithmetic can never drift between the seat that computes it and the gate
 * that enforces it.
 *
 * Usage:
 *   node quartermaster/quartermaster.js --record <bucket> <fraction> --source "..." [--note "..."]
 *   node quartermaster/quartermaster.js --throttle <bucket> <soft|hard> --message "..."
 *   node quartermaster/quartermaster.js --confirm <bucket> [--dispatch-ref <id>]
 *   node quartermaster/quartermaster.js --report
 *   node quartermaster/quartermaster.js --state
 *   node quartermaster/quartermaster.js --publish [--out <file>]
 *   (all accept --file <readings.jsonl>, --forecast-mandatory <n>, --forecast-incident <n>)
 *   Exit codes: 0 success · 1 fail-closed / validation refusal.
 *
 * No dependencies; same conventions as verifier/ and router/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const QM_DIR = __dirname;
const MASTER = path.join(QM_DIR, '..');
const CASTINGS_FILE = path.join(MASTER, 'router', 'castings.json');
const DEFAULT_READINGS_FILE = path.join(MASTER, '.claude', 'orchestra-pool-readings.jsonl');
const DEFAULT_SNAPSHOT_FILE = path.join(MASTER, '.claude', 'orchestra-pool-state.json');

// The router is the source of truth for the ladder and the reserve formula.
// requiredReserve() is IMPORTED, never reimplemented (ruling R4).
const { poolState, requiredReserve } = require(path.join(MASTER, 'router', 'router.js'));

const castings = JSON.parse(fs.readFileSync(CASTINGS_FILE, 'utf8'));
const BUCKETS = castings.buckets.slice();
const LADDER = castings.poolStateLadder;
const THRESHOLDS = LADDER.thresholds;
const RESERVE_CFG = castings.reserve;
const LIVENESS = castings.liveness;

const KINDS = ['reading', 'throttle', 'confirmation'];
const SEVERITIES = ['soft', 'hard'];

// Ruling R3 (Director-set operational values; the plan sets no window).
// REVISED round 3 (WO-11, after the owner-requested Sol·max holistic review):
// the original 7d maxStaleMs is STRUCK — a weekly window moves ~15-20%/day
// under load, so a week-old reading is obsolete, not evidence; a 48h window
// replaces it. Confirmations, and any gate-lifting, already require FRESH
// (≤24h, maxFreshMs) evidence per the round-2 R5 fix (analyze() re-validates
// against LIVE evidence every call) — R3's window only governs whether a
// stale-but-usable reading may still be PUBLISHED, disclosed, never a gate
// grant.
//   fresh  ≤ 24h        — a reading of a rolling weekly allowance is still decision-grade a day later
//   ~~stale ≤ 7d~~ (round-1 text, struck round 3 — see above)
//   stale  ≤ 48h        — usable but DISCLOSED on the PUBLISHED reading object itself
//                          (`stale: true, ageMs`), so the router/dispatcher sees it too,
//                          not merely the human report
//   older                — refused; a reading older than the window it describes is not evidence
const DEFAULT_MAX_FRESH_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_STALE_MS = 48 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Ruling R4 — the default review-draw forecast, derived from castings.json.
// CORRECTED by Director ruling (WO-11 P0 review): the original derivation
// sustained the PEAK arrival rate across a whole 168h week to get
// mandatoryReviewDraw = 0.504, which pushed the default requiredReserve to
// ~0.6552 — ABOVE the ladder's 40% Green threshold, so the P15 gate fired on
// nearly every bucket under the default forecast. RULING: that derivation
// FABRICATED LOAD — no week runs entirely at burst rate — and is REJECTED as
// the default (its arithmetic is preserved below, unused, as the cautionary
// alternative).
//
// requiredReserve(forecast) needs `mandatoryReviewDraw` as a FRACTION OF THE
// BUCKET per scheduling window. The plan never states one; the ADOPTED
// default is WO-2's directly MEASURED weekly draw — the same throughput
// probe castings.reserve.twoGateClassReviewsCostSource cites — rather than an
// extrapolation from a sustained peak. It is an ESTIMATE and is labelled as
// one everywhere it surfaces.
//
//   mandatoryReviewDraw = 0.03
//     (WO-2 throughput probe 2026-08-28: 20 gate-class reviews drew ~3
//      percentage points of the weekly window, 8%→11% ⇒ 0.03 measured
//      directly — the SAME probe castings.reserve.twoGateClassReviewsCostSource
//      cites, read as a weekly aggregate rather than derived through the
//      peak-arrival-rate arithmetic below.)
//
// incidentDraw is NOT derivable from anything measured today. It is left at 0
// — a DISCLOSED under-estimate rather than a fabricated number (§5.2).
//
// requiredReserve(default) = mandatoryReviewDraw × (1 + uncertaintyBuffer)
//                           = 0.03 × 1.3 = 0.039
//                           → floored at max(floorFractionOfBucket,
//                             twoGateClassReviewsCostFraction)
//                           = max(0.08, 0.003) = 0.08
// The dynamic term (0.039) sits BELOW the plan's own 8% floor, so the floor
// governs the default: a bucket below 8% remaining is belowReserve. Callers
// who want a busier-window forecast still pass one explicitly
// ({mandatoryReviewDraw, incidentDraw}, or --forecast-mandatory /
// --forecast-incident) — the override is unaffected by this correction.
//
// REJECTED ALTERNATIVE, preserved as the cautionary arithmetic (not used by
// defaultForecast() below):
//
//   per-review basis   = reserve.twoGateClassReviewsCostFraction / 2
//                      = 0.003 / 2 = 0.0015 of the bucket per gate-class review
//     (the castings constant is the two-review floor, i.e. twice that.)
//   5h windows / week  = 168 / 5 = 33.6
//   weekly reviews     = liveness.forecastPeakArrivalsPer5h × 33.6
//                      = 10 × 33.6 = 336
//   mandatoryReviewDraw = 336 × 0.0015 = 0.504
//   required reserve    = 0.504 × 1.3 = 0.6552 — above the ladder's Green
//                          threshold; a bucket below ~65.5% remaining would
//                          have been belowReserve under this rejected default.
const REJECTED_HOURS_PER_WEEK = 168;
const REJECTED_ROLLING_WINDOW_HOURS = 5;
const REJECTED_WINDOWS_PER_WEEK = REJECTED_HOURS_PER_WEEK / REJECTED_ROLLING_WINDOW_HOURS;
const REJECTED_PER_REVIEW = RESERVE_CFG.twoGateClassReviewsCostFraction / 2;
const REJECTED_WEEKLY_REVIEWS = LIVENESS.forecastPeakArrivalsPer5h * REJECTED_WINDOWS_PER_WEEK;
const REJECTED_MANDATORY_REVIEW_DRAW = REJECTED_WEEKLY_REVIEWS * REJECTED_PER_REVIEW; // 0.504, kept only for the record — NOT used below

function defaultForecast() {
  const mandatoryReviewDraw = 0.03; // WO-2-MEASURED weekly draw (Director ruling: corrected default)
  return {
    mandatoryReviewDraw,
    incidentDraw: 0,
    basis: 'WO-2-MEASURED weekly draw (Director ruling R4, corrected): ' + RESERVE_CFG.twoGateClassReviewsCostSource +
      ' ⇒ mandatoryReviewDraw=' + mandatoryReviewDraw + '; incidentDraw left at 0 — not derivable, disclosed not ' +
      'fabricated. Supersedes the rejected peak-arrival-rate derivation (mandatoryReviewDraw=' +
      REJECTED_MANDATORY_REVIEW_DRAW + ', requiredReserve≈0.6552) which sustained a peak burst across a full week.',
    estimate: true,
  };
}

// ---------------------------------------------------------------------------
// small helpers

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isFraction(v) {
  return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1;
}

// ---------------------------------------------------------------------------
// module-boundary validation (WO-11 round 2, MAJOR). Every public API entry
// that accepts caller-supplied numeric options validates them HERE, typed and
// fail-closed, rather than trusting JS's implicit coercion. The exploit this
// closes: `forecast: {mandatoryReviewDraw: '0.3', incidentDraw: '0.1'}` (both
// strings) used to reach `requiredReserve()`, where `(m + i) * (1 +
// buffer)` string-concatenates ('0.3' + '0.1' = '0.30.1') before the `*`
// coerces it to NaN; `Math.max(NaN, floor)` is NaN; `remainingFraction < NaN`
// is always false — so every bucket read `belowReserve: false` and the P15
// reserve gate was silently deleted. `typeof number` is required; a numeric
// STRING is refused, not coerced.
function assertFiniteNumber(v, name) {
  if (typeof v !== 'number' || !isFinite(v)) {
    throw new Error(
      'quartermaster: `' + name + '` must be a finite number — got ' + JSON.stringify(v) +
      ' (' + (typeof v) + ') — caller-supplied options are validated at the module boundary, ' +
      'never coerced (fail closed: a bad option routes the whole harness on a fabricated number)'
    );
  }
}
function assertNonNegativeFiniteNumber(v, name) {
  assertFiniteNumber(v, name);
  if (v < 0) {
    throw new Error('quartermaster: `' + name + '` must be ≥ 0 — got ' + v);
  }
}
function assertPositiveFiniteNumber(v, name) {
  assertFiniteNumber(v, name);
  if (!(v > 0)) {
    throw new Error('quartermaster: `' + name + '` must be a positive number — got ' + v);
  }
}
/** Validates a caller-supplied forecast override. Never mutates; throws on any violation. */
function validateForecast(forecast) {
  if (!forecast || typeof forecast !== 'object') {
    throw new Error('quartermaster: `forecast` must be an object with numeric mandatoryReviewDraw/incidentDraw — got ' + JSON.stringify(forecast));
  }
  assertNonNegativeFiniteNumber(forecast.mandatoryReviewDraw, 'forecast.mandatoryReviewDraw');
  assertNonNegativeFiniteNumber(forecast.incidentDraw === undefined ? 0 : forecast.incidentDraw, 'forecast.incidentDraw');
  return forecast;
}
function toDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && isFinite(v)) return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function nowOf(opts) {
  const d = toDate((opts && opts.now) !== undefined ? opts.now : new Date());
  if (!d) throw new Error('quartermaster: `now` is not a usable timestamp');
  return d;
}
function fileOf(opts) {
  return (opts && opts.file) || DEFAULT_READINGS_FILE;
}
function assertBucket(bucket) {
  if (!BUCKETS.includes(bucket)) {
    throw new Error(
      'unknown bucket ' + JSON.stringify(bucket) + ' — the plan publishes exactly: ' + BUCKETS.join(', ')
    );
  }
  return bucket;
}
function fmtAge(ms) {
  if (ms < 0) return 'IN THE FUTURE by ' + fmtAge(-ms);
  if (ms >= 86400000) return (ms / 86400000).toFixed(1) + 'd';
  if (ms >= 3600000) return (ms / 3600000).toFixed(1) + 'h';
  if (ms >= 60000) return (ms / 60000).toFixed(1) + 'm';
  return (ms / 1000).toFixed(0) + 's';
}
function pad(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}
function pct(f) {
  return (f * 100).toFixed(1) + '%';
}

// The exact command that fixes a missing/stale bucket — printed inside the
// fail-closed error so the refusal is actionable, not just correct.
function recordHint(bucket) {
  return 'node quartermaster/quartermaster.js --record ' + bucket +
    ' <fraction 0..1> --source "<where you read it>"';
}

// ---------------------------------------------------------------------------
// append

function appendEntry(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

/**
 * Record a remaining-allowance READING. Validation is hard — an unknown
 * bucket, an out-of-range fraction or a missing source THROWS. A bad reading
 * is worse than no reading: no reading fails closed and asks; a bad reading
 * routes the whole harness.
 */
function recordReading(bucket, remainingFraction, source, note, opts) {
  opts = opts || {};
  assertBucket(bucket);
  if (!isFraction(remainingFraction)) {
    throw new Error(
      'remainingFraction must be a number in [0,1] — got ' + JSON.stringify(remainingFraction) +
      ' (fail closed: a fraction outside the range is a misread, not a state)'
    );
  }
  if (!isNonEmptyString(source)) {
    throw new Error('source is required and must be a non-empty string — a reading without provenance is a fabricated number (§5.2)');
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw new Error('note must be a string when present');
  }
  const entry = {
    ts: nowOf(opts).toISOString(),
    kind: 'reading',
    bucket,
    remainingFraction,
    source: source.trim(),
  };
  if (isNonEmptyString(note)) entry.note = note.trim();
  return appendEntry(fileOf(opts), entry);
}

/**
 * Record an OBSERVED throttle. §5.5: "a throttle observed" forces Red
 * regardless of the remaining fraction — this is the only pool signal the
 * vendors emit unambiguously, so it is recorded verbatim and never inferred.
 */
function recordThrottle(bucket, severity, message, opts) {
  opts = opts || {};
  assertBucket(bucket);
  if (!SEVERITIES.includes(severity)) {
    throw new Error('severity must be one of: ' + SEVERITIES.join(', ') + ' — got ' + JSON.stringify(severity));
  }
  if (!isNonEmptyString(message)) {
    throw new Error('message is required and must be a non-empty string — an unexplained throttle cannot be reviewed against prediction');
  }
  return appendEntry(fileOf(opts), {
    ts: nowOf(opts).toISOString(),
    kind: 'throttle',
    bucket,
    severity,
    message: message.trim(),
  });
}

// ---------------------------------------------------------------------------
// parse

/**
 * Read the JSONL and split it into typed entries and malformed lines. Nothing
 * is silently dropped: every line that is not a well-formed entry lands in
 * `malformed` with its 1-based line number and the reason.
 *
 * A malformed line whose `bucket` field survived parsing is attributed to
 * that bucket; one that did not parse at all has `bucket: null` and poisons
 * EVERY bucket whose newest valid reading is older in the file — we cannot
 * know which bucket the corrupted record spoke for.
 */
function readEntries(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { exists: false, entries: [], malformed: [], lines: 0 };
    throw new Error('quartermaster: cannot read readings file ' + file + ': ' + ((e && e.message) || e));
  }
  const entries = [];
  const malformed = [];
  const lines = raw.split('\n');
  let lineNo = 0;
  for (const line of lines) {
    lineNo++;
    const t = line.trim();
    if (!t) continue;
    let rec = null;
    try {
      rec = JSON.parse(t);
    } catch (e) {
      malformed.push({ lineNumber: lineNo, bucket: null, reason: 'unparseable JSON: ' + ((e && e.message) || e) });
      continue;
    }
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      malformed.push({ lineNumber: lineNo, bucket: null, reason: 'line is not a JSON object' });
      continue;
    }
    const bucket = BUCKETS.includes(rec.bucket) ? rec.bucket : null;
    const bad = (reason) => malformed.push({ lineNumber: lineNo, bucket, reason });
    const ts = toDate(rec.ts);
    if (!ts) { bad('missing or unparseable ts'); continue; }
    if (!KINDS.includes(rec.kind)) { bad('unknown kind ' + JSON.stringify(rec.kind)); continue; }
    if (!bucket) { bad('unknown or missing bucket ' + JSON.stringify(rec.bucket)); continue; }
    if (rec.kind === 'reading') {
      if (!isFraction(rec.remainingFraction)) { bad('remainingFraction not in [0,1]: ' + JSON.stringify(rec.remainingFraction)); continue; }
      if (!isNonEmptyString(rec.source)) { bad('reading has no source'); continue; }
    } else if (rec.kind === 'throttle') {
      if (!SEVERITIES.includes(rec.severity)) { bad('throttle severity not soft|hard: ' + JSON.stringify(rec.severity)); continue; }
      if (!isNonEmptyString(rec.message)) { bad('throttle has no message'); continue; }
    } else if (rec.kind === 'confirmation') {
      if (!toDate(rec.evidenceTs)) { bad('confirmation has no usable evidenceTs'); continue; }
      if (!isFraction(rec.remainingFraction)) { bad('confirmation remainingFraction not in [0,1]'); continue; }
    }
    entries.push(Object.assign({}, rec, { lineNumber: lineNo, at: ts }));
  }
  return { exists: true, entries, malformed, lines: lineNo };
}

function entriesFor(entries, bucket, kind) {
  return entries
    .filter((e) => e.bucket === bucket && e.kind === kind)
    .sort((a, b) => a.at - b.at || a.lineNumber - b.lineNumber);
}

// ---------------------------------------------------------------------------
// analysis — never throws; the throwing wrapper is bucketState()

/**
 * The whole per-bucket picture, evidence and problems both. `problem` is a
 * fail-closed refusal string (bucketState throws it; report() prints it).
 */
function analyze(opts) {
  opts = opts || {};
  const file = fileOf(opts);
  const now = nowOf(opts);
  const maxFreshMs = opts.maxFreshMs === undefined ? DEFAULT_MAX_FRESH_MS : opts.maxFreshMs;
  const maxStaleMs = opts.maxStaleMs === undefined ? DEFAULT_MAX_STALE_MS : opts.maxStaleMs;
  // Module-boundary validation (WO-11 round 2, MAJOR): every caller-supplied
  // numeric option is validated HERE, typed, before anything downstream trusts
  // it. Defaults are always well-formed, so this only ever rejects an
  // explicit override.
  assertPositiveFiniteNumber(maxFreshMs, 'maxFreshMs');
  assertPositiveFiniteNumber(maxStaleMs, 'maxStaleMs');
  const forecast = opts.forecast ? validateForecast(opts.forecast) : defaultForecast();
  const reserve = requiredReserve(forecast, RESERVE_CFG);

  const parsed = readEntries(file);
  const out = {
    file,
    now: now.toISOString(),
    exists: parsed.exists,
    maxFreshMs,
    maxStaleMs,
    forecast,
    requiredReserve: reserve,
    malformed: parsed.malformed,
    malformedCount: parsed.malformed.length,
    buckets: {},
  };

  for (const bucket of BUCKETS) {
    const readings = entriesFor(parsed.entries, bucket, 'reading');
    const throttles = entriesFor(parsed.entries, bucket, 'throttle');
    const confirmations = entriesFor(parsed.entries, bucket, 'confirmation');
    const latest = readings.length ? readings[readings.length - 1] : null;

    const info = {
      bucket,
      latest: latest ? { ts: latest.ts, remainingFraction: latest.remainingFraction, source: latest.source, note: latest.note, lineNumber: latest.lineNumber } : null,
      ageMs: latest ? now - latest.at : null,
      stale: false,
      readingCount: readings.length,
      throttles: [],
      hardThrottleFresh: false,
      confirmation: null,
      problem: null,
    };

    // (1) A malformed line in the LATEST position for this bucket fails it
    // closed. "Latest position" = after this bucket's newest valid reading in
    // the file, or anywhere at all when the bucket has none.
    const poison = parsed.malformed.filter(
      (m) => (m.bucket === bucket || m.bucket === null) && (!latest || m.lineNumber > latest.lineNumber)
    );
    if (poison.length > 0) {
      const p = poison[0];
      info.problem =
        'REFUSED for ' + bucket + ': malformed record at ' + file + ' line ' + p.lineNumber +
        ' (' + p.reason + ') sits in the latest position for this bucket — a corrupted newest record ' +
        'could have been the one that said the pool was empty, so this fails closed rather than ' +
        'falling back to the older reading. Repair or delete line ' + p.lineNumber + ', or append a fresh reading:\n  ' +
        recordHint(bucket);
      out.buckets[bucket] = info;
      continue;
    }

    // (2) No reading at all.
    if (!latest) {
      info.problem =
        'REFUSED for ' + bucket + ': no recorded reading. There is no denominator to invent (§5.2) — ' +
        'the Quartermaster refuses rather than defaulting to Green (fabricated capacity) or Red ' +
        '(fabricated scarcity). Record one:\n  ' + recordHint(bucket);
      out.buckets[bucket] = info;
      continue;
    }

    // (3) Age. Future-dated readings are a tamper/clock signal, not evidence.
    if (info.ageMs < 0) {
      info.problem =
        'REFUSED for ' + bucket + ': latest reading (line ' + latest.lineNumber + ', ' + latest.ts +
        ') is dated in the future relative to now (' + now.toISOString() + ') — a clock skew or a ' +
        'tampered record, either way not evidence.';
      out.buckets[bucket] = info;
      continue;
    }
    if (info.ageMs > maxStaleMs) {
      info.problem =
        'REFUSED for ' + bucket + ': latest reading is ' + fmtAge(info.ageMs) + ' old (line ' +
        latest.lineNumber + ', ' + latest.ts + '), past the ' + fmtAge(maxStaleMs) + ' staleness limit. ' +
        'A reading older than the window it describes is not evidence, and no burn rate is invented to ' +
        'age it forward. Record a fresh one:\n  ' + recordHint(bucket);
      out.buckets[bucket] = info;
      continue;
    }
    // Stale is DISCLOSED, never discounted: the fraction is published as read.
    info.stale = info.ageMs > maxFreshMs;

    // (4) Throttles inside the freshness window.
    info.throttles = throttles
      .filter((t) => now - t.at <= maxFreshMs && now - t.at >= 0)
      .map((t) => ({ ts: t.ts, severity: t.severity, message: t.message, lineNumber: t.lineNumber, ageMs: now - t.at }));
    info.hardThrottleFresh = info.throttles.some((t) => t.severity === 'hard');

    // (5) The published state object — the router's poolState input.
    const remainingFraction = latest.remainingFraction;
    const belowReserve = remainingFraction < reserve;
    const throttleObserved = info.throttles.length > 0;
    // Ruling R7 — Exhausted evidence rule. The plan's ladder table stops at
    // Red; the exhaustion matrix (§5.5) describes an Exhausted pool without
    // saying what proves one. Two pieces of evidence, both recorded, neither
    // inferred: a reading of zero, or a HARD throttle inside the freshness
    // window. A soft throttle is Red (the ladder's "a throttle observed"), not
    // Exhausted — the plan's own point is that the Opus bucket fails by
    // SILENT SUBSTITUTION, so exhaustion is never assumed from silence.
    const exhausted = remainingFraction <= 0 || info.hardThrottleFresh;

    const state = { remainingFraction };
    // Round 3 (Sol·max holistic review, MAJOR B): staleness must ride on the
    // PUBLISHED reading object itself, not just the human report / analysis
    // metadata (info.stale, above) — otherwise a stale-but-usable reading
    // reaches the router/snapshot indistinguishable from a fresh one.
    // router.js's normalizeBuckets/poolState (router/router.js:53-70,
    // 297-318) read only state.remainingFraction/reserveBreached/
    // throttleObserved/exhausted and ignore unrecognized keys, so adding
    // stale/ageMs here is additive and does not perturb routing.
    if (info.stale) {
      state.stale = true;
      state.ageMs = info.ageMs;
    }
    if (belowReserve) state.reserveBreached = true;
    if (throttleObserved) state.throttleObserved = true;
    if (exhausted) state.exhausted = true;

    // (6) Amber-arm confirmation (ruling R5, CORRECTED round 2: confirmation
    // validity is re-anchored to LIVE evidence at every analyze() call, not
    // just at the moment confirm() was granted). The CRITICAL the round-1
    // review demonstrated: a confirmation recorded against a 0.35 reading
    // stayed "confirmed" for the rest of maxFreshMs even after a LATER
    // reading of 0.10 landed — the confirmation outlived the evidence it was
    // granted on. A recorded confirmation is honored ONLY when ALL of the
    // following hold RIGHT NOW:
    //   (a) it was itself recorded within maxFreshMs of now;
    //   (b) its evidenceTs equals the CURRENT latest valid reading's ts —
    //       a newer reading since landing VOIDS it (superseded evidence);
    //   (c) that current latest reading's OWN fraction still satisfies the R5
    //       predicate (strictly above orangeBelow) — checked against the live
    //       reading, never against the confirmation's own recorded fraction;
    //   (d) no throttle is fresh and the bucket is not exhausted for this
    //       bucket right now — the same facts that make confirm() itself
    //       refuse today (MAJOR, below);
    //   (e) the bucket carries no malformed-latest poison — guaranteed
    //       structurally: a poisoned bucket already returned at step (1)
    //       above and never reaches this code.
    // Any violation VOIDS the confirmation: quartermasterConfirmation is
    // omitted, the state publishes without it, and both info.confirmation and
    // the human report say exactly why.
    const freshConfirm = confirmations.filter((c) => now - c.at <= maxFreshMs && now - c.at >= 0).pop() || null;
    let confirmationVoidReason = null;
    if (freshConfirm) {
      if (freshConfirm.evidenceTs !== latest.ts) {
        confirmationVoidReason =
          'confirmation evidence (ts ' + freshConfirm.evidenceTs + ') was SUPERSEDED by a newer reading ' +
          '(line ' + latest.lineNumber + ', ts ' + latest.ts + ', ' + pct(latest.remainingFraction) + ') — ' +
          'the confirmation is void; re-confirm on the current reading.';
      } else if (!(latest.remainingFraction > THRESHOLDS.orangeBelow)) {
        confirmationVoidReason =
          'the confirmed reading (' + pct(latest.remainingFraction) + ') no longer satisfies the R5 Amber ' +
          'predicate (strictly above orangeBelow, ' + pct(THRESHOLDS.orangeBelow) + ') — the confirmation is void.';
      } else if (throttleObserved) {
        confirmationVoidReason =
          'a throttle is fresh for ' + bucket + ' — a confirmation cannot arm the gate over an active throttle signal; the confirmation is void.';
      } else if (exhausted) {
        confirmationVoidReason =
          bucket + ' is exhausted — a confirmation cannot arm the gate for an exhausted bucket; the confirmation is void.';
      }
    }
    const liveConfirm = freshConfirm && !confirmationVoidReason;
    if (freshConfirm) {
      info.confirmation = {
        ts: freshConfirm.ts,
        evidenceTs: freshConfirm.evidenceTs,
        remainingFraction: freshConfirm.remainingFraction,
        dispatchRef: freshConfirm.dispatchRef || null,
        lineNumber: freshConfirm.lineNumber,
        voidReason: confirmationVoidReason,
      };
    }

    const value = { state, belowReserve };
    if (liveConfirm) value.quartermasterConfirmation = true;

    info.value = value;
    info.poolState = poolState(state, LADDER);
    out.buckets[bucket] = info;
  }

  return out;
}

/**
 * THE CONTRACT (ruling R1). Returns exactly what router.normalizeBuckets
 * accepts — all four buckets as own properties — or throws a fail-closed
 * refusal naming the bucket and the command that fixes it.
 */
function bucketState(opts) {
  const a = analyze(opts);
  const problems = BUCKETS.map((b) => a.buckets[b].problem).filter(Boolean);
  if (problems.length > 0) {
    const err = new Error(
      'quartermaster: bucket state FAILS CLOSED (' + problems.length + ' of ' + BUCKETS.length +
      ' bucket(s) have no usable evidence):\n\n' + problems.join('\n\n')
    );
    err.failClosed = true;
    err.analysis = a;
    throw err;
  }
  const out = {};
  for (const b of BUCKETS) out[b] = a.buckets[b].value;
  return out;
}

/** bucketState() plus the disclosure metadata (staleness, ages, malformed). */
function bucketStateDetail(opts) {
  const a = analyze(opts);
  const problems = BUCKETS.map((b) => a.buckets[b].problem).filter(Boolean);
  return { ok: problems.length === 0, analysis: a, buckets: problems.length === 0 ? bucketState(opts) : null };
}

// ---------------------------------------------------------------------------
// the Amber-arm confirmation protocol (ruling R5 — unstatedInPlan)

/**
 * §5.5 arms a gate — "below 40% AU-opus, no Opus dispatch without
 * Quartermaster confirmation" — and never says what confirming MEANS. Left
 * undefined it degenerates into a rubber stamp, which is exactly the failure
 * P15 is defending against. The Director's rule:
 *
 *   confirmation is EVIDENCE, not permission. It is granted only when a FRESH
 *   reading (≤ maxFreshMs) exists for the bucket AND that reading is strictly
 *   above the ladder's orangeBelow threshold — i.e. the bucket is genuinely in
 *   the Amber band the gate was written for, not sliding through Orange or Red
 *   behind a stale number. Otherwise it is REFUSED and NOTHING is appended:
 *   a refused confirmation must leave no artifact a later reader could mistake
 *   for a grant.
 *
 * A grant appends a confirmation entry — the audit trail that makes a wrong
 * confirmation attributable after the fact.
 *
 * MAJOR (WO-11 round 2): confirm() must not BLIND-GRANT — three more facts
 * refuse it, each demonstrated by the round-1 review as a grant that should
 * not have happened: a throttle (soft OR hard) recorded within maxFreshMs; a
 * bucket that is exhausted (a reading of zero); the bucket's latest raw line
 * being malformed (the true current reading is unknown, so a prior one
 * cannot stand in for it). All three refuse and append nothing, same as
 * every other refusal path here.
 */
function confirm(bucket, opts) {
  opts = opts || {};
  assertBucket(bucket);
  const file = fileOf(opts);
  const now = nowOf(opts);
  const maxFreshMs = opts.maxFreshMs === undefined ? DEFAULT_MAX_FRESH_MS : opts.maxFreshMs;
  assertPositiveFiniteNumber(maxFreshMs, 'maxFreshMs');
  const parsed = readEntries(file);
  const readings = entriesFor(parsed.entries, bucket, 'reading');
  const throttles = entriesFor(parsed.entries, bucket, 'throttle');
  const latest = readings.length ? readings[readings.length - 1] : null;

  // Malformed-latest poison: the same rule analyze() applies at its step (1).
  // A corrupted record sitting in the latest position for this bucket means
  // the true current reading is unknown — confirm() must refuse rather than
  // grant against a reading that record may have superseded.
  const poison = parsed.malformed.filter(
    (m) => (m.bucket === bucket || m.bucket === null) && (!latest || m.lineNumber > latest.lineNumber)
  );
  if (poison.length > 0) {
    const p = poison[0];
    return {
      confirmed: false,
      bucket,
      reason: 'malformed record at ' + file + ' line ' + p.lineNumber + ' (' + p.reason + ') sits in the latest ' +
        'position for ' + bucket + ' — the true current reading is unknown, so confirmation cannot be granted ' +
        'against a possibly-superseded prior reading. Repair or delete line ' + p.lineNumber + ', or append a fresh reading:\n  ' +
        recordHint(bucket),
    };
  }

  if (!latest) {
    return { confirmed: false, bucket, reason: 'no recorded reading for ' + bucket + ' — confirmation is evidence, not permission; record one first:\n  ' + recordHint(bucket) };
  }
  const ageMs = now - latest.at;
  if (ageMs < 0) {
    return { confirmed: false, bucket, reason: 'latest ' + bucket + ' reading (line ' + latest.lineNumber + ') is dated in the future — refused' };
  }
  if (ageMs > maxFreshMs) {
    return { confirmed: false, bucket, reason: 'latest ' + bucket + ' reading is ' + fmtAge(ageMs) + ' old (line ' + latest.lineNumber + '), past the ' + fmtAge(maxFreshMs) + ' freshness window — a stale number cannot arm a gate that exists because the bucket fails silently' };
  }
  const freshThrottle = throttles.find((t) => now - t.at <= maxFreshMs && now - t.at >= 0);
  if (freshThrottle) {
    return {
      confirmed: false,
      bucket,
      reason: 'a ' + freshThrottle.severity + ' throttle is fresh for ' + bucket + ' (' + freshThrottle.ts + ', ' +
        fmtAge(now - freshThrottle.at) + ' ago) — a confirmation cannot arm the gate over an active throttle signal',
    };
  }
  if (latest.remainingFraction <= 0) {
    return {
      confirmed: false,
      bucket,
      reason: bucket + ' reads ' + pct(latest.remainingFraction) + ' remaining — exhausted; a confirmation cannot arm the gate for an exhausted bucket',
    };
  }
  if (!(latest.remainingFraction > THRESHOLDS.orangeBelow)) {
    return {
      confirmed: false,
      bucket,
      reason: 'latest ' + bucket + ' reading is ' + pct(latest.remainingFraction) + ', not above the ladder\'s orangeBelow threshold (' +
        pct(THRESHOLDS.orangeBelow) + ') — the Amber-arm confirmation covers the Amber band only; at Orange authoring is suspended, not confirmable',
    };
  }

  const evidence = {
    bucket,
    remainingFraction: latest.remainingFraction,
    evidenceTs: latest.ts,
    source: latest.source,
    ageMs,
    lineNumber: latest.lineNumber,
  };
  const entry = { ts: now.toISOString(), kind: 'confirmation', bucket, evidenceTs: latest.ts, remainingFraction: latest.remainingFraction };
  if (isNonEmptyString(opts.dispatchRef)) entry.dispatchRef = opts.dispatchRef.trim();
  appendEntry(file, entry);
  return { confirmed: true, bucket, evidence, entry };
}

// ---------------------------------------------------------------------------
// throttle prediction (ruling R6 — unstatedInPlan; v1 method)

/**
 * Two-point linear extrapolation over the latest two valid readings. The plan
 * demands prediction "reported as estimates with confidence" and specifies no
 * method; this is the honest floor — the simplest model whose assumptions can
 * be stated in one line, labelled with its own name so a reader is never
 * misled about how much machinery is behind the number.
 *
 *   - one reading  → NO prediction. Extrapolating from a single point is
 *     inventing a slope, which is inventing a number.
 *   - non-negative rate (flat, or regenerating at a window reset) → typed
 *     "window-reset or non-monotonic; no prediction". A rising allowance has
 *     no crossing time, and pretending otherwise would emit a fictional date.
 *   - declining rate → crossing times for every ladder threshold plus zero,
 *     at confidence "low (two-point linear)". Never higher: two points cannot
 *     support a stronger claim, and predicted-vs-observed is the seat's own
 *     review criterion.
 *
 * MINOR (WO-11 round 2), two more typed refusals rather than a thrown
 * exception or a fictional number:
 *   - the latest reading is older than maxStaleMs → typed "readings too
 *     stale to be evidence", same staleness bound analyze() enforces —
 *     extrapolating a trend line from stale evidence is not lower-confidence
 *     evidence, it is non-evidence.
 *   - an extremely small |rate| can put a crossing time outside the range a
 *     JS `Date` can represent at all (`new Date(...).toISOString()` throws
 *     RangeError past ~±8.64e15ms/epoch) — that estimate is typed "beyond
 *     representable horizon" rather than throwing. report() calls this
 *     function and must never throw.
 */
function predictThrottle(bucket, opts) {
  opts = opts || {};
  assertBucket(bucket);
  const file = fileOf(opts);
  const now = nowOf(opts);
  const maxStaleMs = opts.maxStaleMs === undefined ? DEFAULT_MAX_STALE_MS : opts.maxStaleMs;
  assertPositiveFiniteNumber(maxStaleMs, 'maxStaleMs');
  const parsed = readEntries(file);
  const readings = entriesFor(parsed.entries, bucket, 'reading');
  if (readings.length < 2) {
    return { ok: false, bucket, reason: 'insufficient data (need ≥2 readings)', readingCount: readings.length };
  }
  const a = readings[readings.length - 2];
  const b = readings[readings.length - 1];
  const bAgeMs = now - b.at;
  if (bAgeMs > maxStaleMs) {
    return {
      ok: false,
      bucket,
      reason: 'readings too stale to be evidence (latest reading is ' + fmtAge(bAgeMs) + ' old, past the ' +
        fmtAge(maxStaleMs) + ' staleness limit) — a trend line fit to stale points is not lower-confidence evidence, it is non-evidence',
      readingCount: readings.length,
    };
  }
  const dtMs = b.at - a.at;
  if (!(dtMs > 0)) {
    return { ok: false, bucket, reason: 'non-monotonic timestamps — the two latest readings do not advance in time', readingCount: readings.length };
  }
  const rate = (b.remainingFraction - a.remainingFraction) / dtMs; // fraction per ms
  const from = {
    a: { ts: a.ts, remainingFraction: a.remainingFraction },
    b: { ts: b.ts, remainingFraction: b.remainingFraction },
    ratePerHour: rate * 3600000,
  };
  if (rate >= 0) {
    return {
      ok: true,
      bucket,
      estimates: [],
      confidence: 'insufficient-trend',
      note: 'window-reset or non-monotonic; no prediction',
      from,
    };
  }

  const targets = [
    { name: 'Amber', threshold: THRESHOLDS.amberBelow },
    { name: 'Orange', threshold: THRESHOLDS.orangeBelow },
    { name: 'Red', threshold: THRESHOLDS.redBelow },
    { name: 'Exhausted', threshold: 0 },
  ];
  // A JS Date can represent at most ±8,640,000,000,000,000ms from the epoch
  // (`Date.prototype.toISOString`'s own documented range); an extremely
  // small |rate| (e.g. a 1e-12 decline) can put a crossing that many
  // milliseconds out. Guarded rather than left to throw a RangeError.
  const DATE_MS_HORIZON = 8640000000000000;
  const estimates = targets.map((t) => {
    if (b.remainingFraction <= t.threshold) {
      return { name: t.name, threshold: t.threshold, crossed: true, msFromNow: 0, etaIso: b.ts };
    }
    const msFromLatest = (b.remainingFraction - t.threshold) / -rate;
    const crossAt = b.at.getTime() + msFromLatest;
    if (!isFinite(crossAt) || Math.abs(crossAt) > DATE_MS_HORIZON) {
      return {
        name: t.name,
        threshold: t.threshold,
        crossed: false,
        beyondHorizon: true,
        msFromNow: null,
        etaIso: null,
        note: 'beyond representable horizon — at this rate the crossing lies further out than a JS Date can express; not a typed ETA',
      };
    }
    const msFromNow = crossAt - now.getTime();
    return {
      name: t.name,
      threshold: t.threshold,
      crossed: false,
      // The trend line can put a crossing BEHIND `now` when the latest
      // reading is itself old: the prediction is overdue, not negative-time.
      // Flagged rather than hidden — an overdue crossing means "record a
      // fresh reading", not "the bucket is fine".
      overdue: msFromNow < 0,
      msFromNow,
      etaIso: new Date(crossAt).toISOString(),
    };
  });
  return { ok: true, bucket, estimates, confidence: 'low (two-point linear)', from };
}

// ---------------------------------------------------------------------------
// report

/**
 * The human summary. Deliberately does NOT throw on a fail-closed bucket —
 * the report is how an operator finds out WHICH bucket needs a reading, so it
 * prints the refusal instead of becoming one.
 */
function report(opts) {
  opts = opts || {};
  const a = analyze(opts);
  const out = [];
  out.push('QUARTERMASTER — pool state (P0, final-plan.md seat 24)');
  out.push('readings: ' + a.file + (a.exists ? '' : '  (FILE DOES NOT EXIST YET)'));
  out.push('as of:    ' + a.now);
  out.push('reserve:  required ' + pct(a.requiredReserve) + ' of bucket — router.requiredReserve(forecast)');
  out.push('forecast: mandatoryReviewDraw=' + a.forecast.mandatoryReviewDraw +
    ', incidentDraw=' + (a.forecast.incidentDraw || 0) + (a.forecast.estimate ? '  [ESTIMATE]' : ''));
  if (a.forecast.basis) out.push('          ' + a.forecast.basis);
  out.push('');
  out.push(pad('bucket', 10) + pad('reading', 10) + pad('age', 10) + pad('state', 12) + pad('reserve', 12) + 'flags');
  out.push('-'.repeat(74));
  for (const bucket of BUCKETS) {
    const info = a.buckets[bucket];
    if (info.problem) {
      out.push(pad(bucket, 10) + 'FAILS CLOSED — see below');
      continue;
    }
    const flags = [];
    if (info.stale) flags.push('STALE (disclosed, not discounted)');
    if (info.throttles.length) flags.push(info.throttles.length + ' throttle(s) in window');
    if (info.value.state.exhausted) flags.push('EXHAUSTED');
    if (info.value.quartermasterConfirmation) flags.push('confirmed (Amber arm)');
    if (info.confirmation && info.confirmation.voidReason) flags.push('CONFIRMATION VOIDED');
    out.push(
      pad(bucket, 10) +
      pad(pct(info.latest.remainingFraction), 10) +
      pad(fmtAge(info.ageMs), 10) +
      pad(info.poolState, 12) +
      pad(info.value.belowReserve ? 'BELOW' : 'ok', 12) +
      (flags.join('; ') || '-')
    );
  }

  // Per-bucket detail: source, throttles, prediction.
  for (const bucket of BUCKETS) {
    const info = a.buckets[bucket];
    out.push('');
    out.push(bucket + ':');
    if (info.problem) {
      out.push('  ' + info.problem.split('\n').join('\n  '));
      continue;
    }
    out.push('  latest    ' + pct(info.latest.remainingFraction) + ' @ ' + info.latest.ts +
      ' (line ' + info.latest.lineNumber + ', source: ' + info.latest.source + ')' +
      (info.latest.note ? ' — ' + info.latest.note : ''));
    out.push('  readings  ' + info.readingCount);
    if (info.throttles.length === 0) {
      out.push('  throttles none in the freshness window');
    } else {
      for (const t of info.throttles) {
        out.push('  throttle  [' + t.severity + '] ' + t.ts + ' (' + fmtAge(t.ageMs) + ' ago): ' + t.message);
      }
    }
    if (info.confirmation) {
      out.push('  confirmed ' + info.confirmation.ts + ' on evidence ' + info.confirmation.evidenceTs +
        ' (' + pct(info.confirmation.remainingFraction) + ')' +
        (info.confirmation.dispatchRef ? ' for dispatch ' + info.confirmation.dispatchRef : ''));
      if (info.confirmation.voidReason) {
        out.push('  VOID      ' + info.confirmation.voidReason);
      }
    }
    const p = predictThrottle(bucket, opts);
    if (!p.ok) {
      out.push('  forecast  no prediction — ' + p.reason);
    } else if (p.confidence === 'insufficient-trend') {
      out.push('  forecast  ' + p.note + ' (rate ' + (p.from.ratePerHour >= 0 ? '+' : '') + (p.from.ratePerHour * 100).toFixed(3) + ' pp/h)');
    } else {
      out.push('  forecast  confidence: ' + p.confidence + ' — rate ' + (p.from.ratePerHour * 100).toFixed(3) + ' pp/h');
      for (const e of p.estimates) {
        const when = e.crossed
          ? 'already crossed (latest reading is at or below this rung)'
          : e.beyondHorizon
            ? e.note
            : e.overdue
              ? 'ETA ' + e.etaIso + '  (OVERDUE by ' + fmtAge(-e.msFromNow) + ' — the trend line ran past now; record a fresh reading)'
              : 'ETA ' + e.etaIso + '  (in ' + fmtAge(e.msFromNow) + ')';
        out.push('            ' + pad(e.name, 10) + when);
      }
    }
  }

  out.push('');
  if (a.malformedCount === 0) {
    out.push('malformed lines: 0');
  } else {
    out.push('malformed lines: ' + a.malformedCount + ' (counted, never silently skipped)');
    for (const m of a.malformed) {
      out.push('  line ' + m.lineNumber + (m.bucket ? ' [' + m.bucket + ']' : ' [bucket unknown]') + ': ' + m.reason);
    }
  }

  // The seat's own review criterion (§ seat 24, "Review. Reality — predicted
  // vs observed throttle"). The comparison needs a history of predictions to
  // score; v1 records the inputs and states the gap rather than printing a
  // number it cannot compute yet.
  const observed = [];
  const allEntries = readEntries(a.file).entries;
  for (const bucket of BUCKETS) {
    for (const t of entriesFor(allEntries, bucket, 'throttle')) {
      observed.push(bucket + ' [' + t.severity + '] ' + t.ts);
    }
  }
  out.push('');
  out.push('PREDICTED vs OBSERVED (the seat\'s review criterion):');
  if (observed.length === 0) {
    out.push('  no throttle observations recorded yet — the comparison accumulates as');
    out.push('  --throttle records land. A consistently wrong Quartermaster is meant to be');
    out.push('  a detectable, fixable defect; v1 records the raw material and scores nothing');
    out.push('  it cannot yet compute.');
  } else {
    out.push('  ' + observed.length + ' observed throttle(s) on record:');
    for (const o of observed) out.push('    ' + o);
    out.push('  scoring against the predictions that preceded them is a follow-on (v1 keeps');
    out.push('  no prediction history; see quartermaster/README.md ruling R6).');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// snapshot

/**
 * Publish the degradation state the router reads. Fails closed exactly as
 * bucketState does — a snapshot file that a consumer might read as authority
 * is never written from incomplete evidence.
 */
function publish(opts) {
  opts = opts || {};
  const a = analyze(opts);
  const buckets = bucketState(opts); // throws (fail closed) before anything is written
  const outFile = opts.out || DEFAULT_SNAPSHOT_FILE;
  const snapshot = {
    generatedAt: a.now,
    generator: 'quartermaster/quartermaster.js (WO-11, class P0)',
    source: a.file,
    contract: 'router.normalizeBuckets input (router/router.js:297-318)',
    requiredReserve: a.requiredReserve,
    forecast: a.forecast,
    malformedLineCount: a.malformedCount,
    disclosures: BUCKETS.map((b) => ({
      bucket: b,
      ageMs: a.buckets[b].ageMs,
      stale: a.buckets[b].stale,
      poolState: a.buckets[b].poolState,
      source: a.buckets[b].latest.source,
      readingTs: a.buckets[b].latest.ts,
    })),
    bucket_state: buckets,
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  return { file: outFile, snapshot };
}

module.exports = {
  BUCKETS,
  DEFAULT_READINGS_FILE,
  DEFAULT_SNAPSHOT_FILE,
  DEFAULT_MAX_FRESH_MS,
  DEFAULT_MAX_STALE_MS,
  defaultForecast,
  recordReading,
  recordThrottle,
  readEntries,
  analyze,
  bucketState,
  bucketStateDetail,
  confirm,
  predictThrottle,
  report,
  publish,
};

// --------------------------------------------------------------------- CLI

function usage() {
  return [
    'usage:',
    '  node quartermaster/quartermaster.js --record <bucket> <fraction> --source "..." [--note "..."]',
    '  node quartermaster/quartermaster.js --throttle <bucket> <soft|hard> --message "..."',
    '  node quartermaster/quartermaster.js --confirm <bucket> [--dispatch-ref <id>]',
    '  node quartermaster/quartermaster.js --report',
    '  node quartermaster/quartermaster.js --state',
    '  node quartermaster/quartermaster.js --publish [--out <file>]',
    '',
    'buckets: ' + BUCKETS.join(' | '),
    'common:  [--file <readings.jsonl>] [--forecast-mandatory <n>] [--forecast-incident <n>]',
    'exit:    0 success · 1 fail-closed / validation refusal',
  ].join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  // Flags with values, plus positionals collected per-command.
  const flag = (name) => {
    const i = argv.indexOf('--' + name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (name) => argv.indexOf('--' + name) >= 0;
  const positionalsAfter = (name) => {
    const i = argv.indexOf('--' + name);
    const out = [];
    for (let j = i + 1; j < argv.length && !String(argv[j]).startsWith('--'); j++) out.push(argv[j]);
    return out;
  };

  const opts = {};
  if (flag('file')) opts.file = path.resolve(flag('file'));
  const fm = flag('forecast-mandatory');
  const fi = flag('forecast-incident');
  if (fm !== undefined || fi !== undefined) {
    opts.forecast = {
      mandatoryReviewDraw: fm === undefined ? 0 : Number(fm),
      incidentDraw: fi === undefined ? 0 : Number(fi),
      basis: 'caller-supplied forecast override (CLI)',
    };
    if (!isFinite(opts.forecast.mandatoryReviewDraw) || !isFinite(opts.forecast.incidentDraw)) {
      console.error('--forecast-mandatory / --forecast-incident must be numbers');
      process.exit(1);
    }
  }

  try {
    if (has('record')) {
      const [bucket, fraction] = positionalsAfter('record');
      const e = recordReading(bucket, Number(fraction), flag('source'), flag('note'), opts);
      console.log('recorded: ' + JSON.stringify(e));
    } else if (has('throttle')) {
      const [bucket, severity] = positionalsAfter('throttle');
      const e = recordThrottle(bucket, severity, flag('message'), opts);
      console.log('recorded: ' + JSON.stringify(e));
    } else if (has('confirm')) {
      const [bucket] = positionalsAfter('confirm');
      const r = confirm(bucket, Object.assign({}, opts, { dispatchRef: flag('dispatch-ref') }));
      console.log(JSON.stringify(r, null, 2));
      if (!r.confirmed) process.exit(1);
    } else if (has('report')) {
      console.log(report(opts));
    } else if (has('state')) {
      console.log(JSON.stringify(bucketState(opts), null, 2));
    } else if (has('publish')) {
      if (flag('out')) opts.out = path.resolve(flag('out'));
      const r = publish(opts);
      console.log('published bucket_state snapshot: ' + r.file);
    } else {
      console.error(usage());
      process.exit(1);
    }
  } catch (e) {
    console.error(String((e && e.message) || e));
    process.exit(1);
  }
}
