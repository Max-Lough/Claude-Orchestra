# P0 live end-to-end exercise (WO-11 substrate exercise)

Date run: 2026-08-31 (system clock at run time: `2026-08-31T02:22:21Z`).
Repo: `C:\Users\maxtl\Projects\Claude-Orchestra`, branch `claude/wo7a-bis-corpus`.

This is the record of a REAL, live run of `quartermaster/quartermaster.js`
against `.claude/orchestra-pool-readings.jsonl`, which did not exist before
this exercise. Every reading recorded into that file is REAL, evidenced,
extracted from `.claude/orchestra-manual-readings.md`. No fixture value was
ever written to the real file.

---

## Step 1 — extraction from `.claude/orchestra-manual-readings.md`

Full content of the "Daily allowance readings" table (the only table in the
file with genuine remaining/used fractions):

```
| timestamp (local) | source (Claude /status | Codex CLI) | reading | notes |
|---|---|---|---|
| 2026-08-29T00:00Z | Codex CLI session log (rate_limits) | weekly window 8.0% used, plan=prolite, credits=0 | auto-captured mid WO-2 5-review batch (during review 4/5) |
| 2026-08-28 ~17:20 local | vendor UI (owner-reported: "89% currently") | 89% weekly allowance remaining (= 11% used) | taken mid WO-2 20-review batch; consistent with the 8%-used log reading above |
| 2026-08-28 ~19:30 local | vendor UI (owner-reported) | 86% weekly allowance remaining (= 14% used) | post WO-2 20-review batch. Whole WO-2 exercise (25 reviews): ~92%→86% remaining ≈ 6 pts / 25 ≈ **0.24% of weekly window per gate-class review** |
```

No other table in the file (Throttle events, Served-model surprises,
Opus-concentration watch) has any rows — all empty.

**Finding, contrary to the task's anticipated shape:** all three rows above
are OpenAI/Codex readings, not Claude ones. Row 1 is explicitly sourced from
the "Codex CLI session log". Rows 2 and 3 say "vendor UI" without naming
Claude or Codex, but their numbers (11% used, then 14% used) are the direct
continuation of row 1's "8.0% used" mid-batch reading — and this exact
progression ("8%→11%") is the same figure quoted verbatim in
`router/castings.json` as `reserve.twoGateClassReviewsCostSource`: *"WO-2
throughput probe 2026-08-28: 20 gate-class reviews drew ~3 percentage points
of the weekly Codex window (~8%→11%)"*. All three rows are therefore the SAME
Codex/OU measurement series, not Claude/AU-side data. **There is no "Claude
/status" row anywhere in the manual-readings file** — so `AU-all`, `AU-opus`,
and `AU-fable` all have zero real evidence today, not just `AU-opus`/`AU-fable`
as the task anticipated. This is reported plainly rather than papered over.

All three rows are dated 2026-08-28/29 — well within the 7-day staleness
window relative to 2026-08-31 (age ≈ 2–3 days).

**Extracted (LATEST dated reading, the only evidenced bucket, OU):**

> `2026-08-28 ~19:30 local | vendor UI (owner-reported) | 86% weekly allowance remaining (= 14% used) | post WO-2 20-review batch. Whole WO-2 exercise (25 reviews): ~92%→86% remaining ≈ 6 pts / 25 ≈ 0.24% of weekly window per gate-class review`

→ OU remainingFraction = 0.86, per the task's stated Codex mapping (Y%
remaining → OU = Y/100).

The row gives no explicit timezone ("local"); I recorded it as
`2026-08-28T19:30:00` with no `Z` suffix, which `Date()` interprets as the
recording machine's local time — it resolved to `2026-08-29T02:30:00.000Z`
(machine local zone is UTC-7 at that date). Disclosed here rather than
silently assumed to be UTC.

### Recording command (module API, per task instruction — not the CLI, so the
reading's own timestamp could be injected as `now`)

```js
// C:\Users\maxtl\AppData\Local\Temp\claude\...\scratchpad\wo11-reports\record-real.js
const qm = require('C:/Users/maxtl/Projects/Claude-Orchestra/quartermaster/quartermaster.js');
const entry = qm.recordReading(
  'OU',
  0.86,
  'manual readings .claude/orchestra-manual-readings.md row: "2026-08-28 ~19:30 local | vendor UI (owner-reported) | 86% weekly allowance remaining (= 14% used) | post WO-2 20-review batch..."',
  'latest OU reading on record as of 2026-08-31 exercise; whole WO-2 exercise (25 reviews) ~92%->86% remaining ~6pts/25 ~0.24% of weekly window per gate-class review',
  { now: '2026-08-28T19:30:00' }
);
```

**Output:**

```
RECORDED: {
  "ts": "2026-08-29T02:30:00.000Z",
  "kind": "reading",
  "bucket": "OU",
  "remainingFraction": 0.86,
  "source": "manual readings .claude/orchestra-manual-readings.md row: \"2026-08-28 ~19:30 local | vendor UI (owner-reported) | 86% weekly allowance remaining (= 14% used) | post WO-2 20-review batch...\"",
  "note": "latest OU reading on record as of 2026-08-31 exercise; whole WO-2 exercise (25 reviews) ~92%->86% remaining ~6pts/25 ~0.24% of weekly window per gate-class review"
}
```

Resulting real file, `.claude/orchestra-pool-readings.jsonl` (verbatim, one
line, this is now live operational data and STAYS on disk, gitignored):

```json
{"ts":"2026-08-29T02:30:00.000Z","kind":"reading","bucket":"OU","remainingFraction":0.86,"source":"manual readings .claude/orchestra-manual-readings.md row: \"2026-08-28 ~19:30 local | vendor UI (owner-reported) | 86% weekly allowance remaining (= 14% used) | post WO-2 20-review batch...\"","note":"latest OU reading on record as of 2026-08-31 exercise; whole WO-2 exercise (25 reviews) ~92%->86% remaining ~6pts/25 ~0.24% of weekly window per gate-class review"}
```

**AU-all / AU-opus / AU-fable: no reading recorded** — no evidenced row exists
for any of them in the manual-readings file. Per the task's own rule ("Do NOT
invent AU-opus/AU-fable values if no row breaks them out"), and by the same
logic extended honestly to AU-all (no Claude row exists at all), nothing was
recorded for these three buckets.

---

## Step 2 — `--report` and `--state` against the REAL file

### `node quartermaster/quartermaster.js --report`

```
QUARTERMASTER — pool state (P0, final-plan.md seat 24)
readings: C:\Users\maxtl\Projects\Claude-Orchestra\.claude\orchestra-pool-readings.jsonl
as of:    2026-08-31T02:22:44.804Z
reserve:  required 8.0% of bucket — router.requiredReserve(forecast)
forecast: mandatoryReviewDraw=0.03, incidentDraw=0  [ESTIMATE]
          WO-2-MEASURED weekly draw (Director ruling R4, corrected): WO-2 throughput probe 2026-08-28: 20 gate-class reviews drew ~3 percentage points of the weekly Codex window (~8%→11%) ⇒ mandatoryReviewDraw=0.03; incidentDraw left at 0 — not derivable, disclosed not fabricated. Supersedes the rejected peak-arrival-rate derivation (mandatoryReviewDraw=0.504, requiredReserve≈0.6552) which sustained a peak burst across a full week.

bucket    reading   age       state       reserve     flags
--------------------------------------------------------------------------
AU-all    FAILS CLOSED — see below
AU-opus   FAILS CLOSED — see below
AU-fable  FAILS CLOSED — see below
OU        86.0%     2.0d      Green       ok          STALE (disclosed, not discounted)

AU-all:
  REFUSED for AU-all: no recorded reading. There is no denominator to invent (§5.2) — the Quartermaster refuses rather than defaulting to Green (fabricated capacity) or Red (fabricated scarcity). Record one:
    node quartermaster/quartermaster.js --record AU-all <fraction 0..1> --source "<where you read it>"

AU-opus:
  REFUSED for AU-opus: no recorded reading. There is no denominator to invent (§5.2) — the Quartermaster refuses rather than defaulting to Green (fabricated capacity) or Red (fabricated scarcity). Record one:
    node quartermaster/quartermaster.js --record AU-opus <fraction 0..1> --source "<where you read it>"

AU-fable:
  REFUSED for AU-fable: no recorded reading. There is no denominator to invent (§5.2) — the Quartermaster refuses rather than defaulting to Green (fabricated capacity) or Red (fabricated scarcity). Record one:
    node quartermaster/quartermaster.js --record AU-fable <fraction 0..1> --source "<where you read it>"

OU:
  latest    86.0% @ 2026-08-29T02:30:00.000Z (line 1, source: manual readings .claude/orchestra-manual-readings.md row: "2026-08-28 ~19:30 local | vendor UI (owner-reported) | 86% weekly allowance remaining (= 14% used) | post WO-2 20-review batch...") — latest OU reading on record as of 2026-08-31 exercise; whole WO-2 exercise (25 reviews) ~92%->86% remaining ~6pts/25 ~0.24% of weekly window per gate-class review
  readings  1
  throttles none in the freshness window
  forecast  no prediction — insufficient data (need ≥2 readings)

malformed lines: 0

PREDICTED vs OBSERVED (the seat's review criterion):
  no throttle observations recorded yet — the comparison accumulates as
  --throttle records land. A consistently wrong Quartermaster is meant to be
  a detectable, fixable defect; v1 records the raw material and scores nothing
  it cannot yet compute.
```
`EXIT: 0` (report never throws — it prints refusals instead of becoming one).

### `node quartermaster/quartermaster.js --state`

```
quartermaster: bucket state FAILS CLOSED (3 of 4 bucket(s) have no usable evidence):

REFUSED for AU-all: no recorded reading. There is no denominator to invent (§5.2) — the Quartermaster refuses rather than defaulting to Green (fabricated capacity) or Red (fabricated scarcity). Record one:
  node quartermaster/quartermaster.js --record AU-all <fraction 0..1> --source "<where you read it>"

REFUSED for AU-opus: no recorded reading. There is no denominator to invent (§5.2) — the Quartermaster refuses rather than defaulting to Green (fabricated capacity) or Red (fabricated scarcity). Record one:
  node quartermaster/quartermaster.js --record AU-opus <fraction 0..1> --source "<where you read it>"

REFUSED for AU-fable: no recorded reading. There is no denominator to invent (§5.2) — the Quartermaster refuses rather than defaulting to Green (fabricated capacity) or Red (fabricated scarcity). Record one:
  node quartermaster/quartermaster.js --record AU-fable <fraction 0..1> --source "<where you read it>"
```
`EXIT: 1`

**This is the demonstration the task asked for: P0 refuses to fabricate.**
It names every unevidenced bucket by name and prints the exact `--record`
command that fixes each one, rather than defaulting any of them to Green
(fabricated capacity) or Red (fabricated scarcity). It differs from the
task's anticipated result only in SCOPE — three buckets fail closed here
(`AU-all` included), not two — because the manual-readings source file has no
Claude-side row at all right now, only Codex/OU data.

---

## Step 3 — fixture pipeline demo (complete state, TEMP file only)

The real file was never modified for this step. A separate temp file
(`os.tmpdir()/qm-fixture-*/fixture-pool-readings.jsonl`, NOT
`.claude/orchestra-pool-readings.jsonl`) was seeded by copying the one real
OU line, then three FIXTURE-labeled readings were appended for the buckets
with no real evidence.

Script: `...\scratchpad\wo11-reports\fixture-pipeline.js`.

**Fixture file, real line copied in first, FIXTURE lines appended (verbatim):**

```json
{"ts":"2026-08-29T02:30:00.000Z","kind":"reading","bucket":"OU","remainingFraction":0.86,"source":"manual readings .claude/orchestra-manual-readings.md row: \"2026-08-28 ~19:30 local | vendor UI (owner-reported) | 86% weekly allowance remaining (= 14% used) | post WO-2 20-review batch...\"","note":"latest OU reading on record as of 2026-08-31 exercise; whole WO-2 exercise (25 reviews) ~92%->86% remaining ~6pts/25 ~0.24% of weekly window per gate-class review"}
{"ts":"2026-08-31T02:23:10.970Z","kind":"reading","bucket":"AU-all","remainingFraction":0.5,"source":"FIXTURE — pipeline demo only","note":"FIXTURE value, not a real vendor reading"}
{"ts":"2026-08-31T02:23:10.970Z","kind":"reading","bucket":"AU-opus","remainingFraction":0.5,"source":"FIXTURE — pipeline demo only","note":"FIXTURE value, not a real vendor reading"}
{"ts":"2026-08-31T02:23:10.970Z","kind":"reading","bucket":"AU-fable","remainingFraction":0.5,"source":"FIXTURE — pipeline demo only","note":"FIXTURE value, not a real vendor reading"}
```

**[FIXTURE] `qm.bucketState({file: fixtureFile, now})` — now complete (all 4 buckets):**

```json
{
  "AU-all":   { "state": { "remainingFraction": 0.5 },  "belowReserve": false },
  "AU-opus":  { "state": { "remainingFraction": 0.5 },  "belowReserve": false },
  "AU-fable": { "state": { "remainingFraction": 0.5 },  "belowReserve": false },
  "OU":       { "state": { "remainingFraction": 0.86 }, "belowReserve": false }
}
```
(`belowReserve` is `false` everywhere because the corrected R4 default
required reserve is now the 8% floor — see Task 1 — and 0.5/0.86 both clear
it comfortably.)

**[FIXTURE] `router.dispatch({class:'I0', risk:'T1', title:'FIXTURE pipeline demo order', context_shape:'scoped'}, fixtureState)`:**

```json
{
  "ok": true,
  "class": "I0",
  "role": "Investigator",
  "casting": {
    "ok": true,
    "role": "Investigator",
    "rung": "primary",
    "casting": { "vendor": "anthropic", "model": "Opus 5", "effort": "high" },
    "bucketState": "Green",
    "requested": { "model": "Opus 5", "rung": "primary" }
  },
  "gate": { "allowed": true },
  "review_policy": "preferred",
  "review": {
    "closes": true,
    "casting": { "vendor": "openai", "model": "GPT-5.6 Sol", "effort": "high" },
    "reviewerFamily": "openai",
    "review_cross_family": true,
    "gate": { "allowed": true }
  },
  "q0": null,
  "order": {
    "class": "I0", "risk": "T1", "title": "FIXTURE pipeline demo order",
    "context_shape": "scoped", "integrity_nonce": "4b1136e6c3b7414a087282d8"
  }
}
```

**[FIXTURE] Routing outcome:** end-to-end success (`ok: true`). At `AU-opus`
= 0.5 (Amber/Green boundary — actually ≥0.40, so **Green**), the Investigator
gets its primary casting (Anthropic Opus 5 · high, Green bucket, gate
allowed), and the cross-family review closes on OpenAI GPT-5.6 Sol · high (no
Q0 companion required at T1). **Everything in this section — the three 0.5
readings and the routing decision built on them — is FIXTURE-derived and NOT
a real operational routing decision.** It demonstrates only that the pipeline
(`bucketState()` → real `router.dispatch()`) works mechanically once evidence
is complete; it says nothing about the actual current AU-side pool state.

---

## Step 4 — real readings are not all stale / no usable rows: N/A

Not triggered — the one real OU row (2 days old at run time) is well inside
the 7-day usable window, so this exercise is NOT reduced to "fail-closed demo
+ fixture demo alone" for that reason. It IS effectively reduced to that shape
anyway, for a different reason: three of the four buckets simply have zero
real rows in the source file (see Step 1 finding), so the only complete state
achievable today is the fixture one from Step 3.

---

## Step 5 — `--publish` against the real file

Not run to completion — attempted, to confirm it fails closed rather than
writing an incomplete snapshot, per the exact same reasoning as `--state`:
the real file has only 1 of 4 buckets evidenced, so no lawful (non-fixture)
complete state exists.

```
$ node quartermaster/quartermaster.js --publish
quartermaster: bucket state FAILS CLOSED (3 of 4 bucket(s) have no usable evidence):
... [same three REFUSED blocks as --state above] ...
EXIT: 1
```

Confirmed: `.claude/orchestra-pool-state.json` was **not** written (`publish()`
calls `bucketState()` — which throws — before any file write happens). No
snapshot exists on disk from this run.

**Publish against the real file is correctly skipped** — the real, lawful
state is incomplete (OU-only), and per instructions `--publish` is run
against the real file only when a lawful complete state exists. It does not
here.

---

## Judgment: PASS (DEGRADED evidence coverage, by design — not a defect)

- **PASS** — every mechanism exercised exactly as specified and as documented
  in `quartermaster/README.md`: recording via the module API with honest
  backdated timestamps, `--report`'s non-throwing human summary, `--state`'s
  fail-closed refusal (exit 1, names every unevidenced bucket, prints the
  fix), `--publish`'s fail-closed refusal with zero side effects, and the
  full `bucketState()` → `router.dispatch()` pipeline on a complete
  (fixture-completed) state.
- **DEGRADED, and disclosed rather than hidden**: real evidence coverage is
  1 of 4 buckets (OU only) today, not the 2-of-4 the task anticipated —
  `.claude/orchestra-manual-readings.md` currently has no Claude-side
  (`AU-*`) row at all, only three Codex/OU rows from the same WO-2 probe.
  This is a genuine gap in the manual-readings practice (no operator has
  logged a Claude `/status` reading yet), not a bug in the Quartermaster —
  the substrate did exactly what it is supposed to do with that gap: refuse,
  by name, with a fix command, rather than fabricate.
- The real readings file now holds exactly one real, sourced, honestly
  timestamped line (OU = 0.86, 2026-08-29T02:30:00.000Z) and **stays on
  disk** as live operational data (gitignored, untouched by this report).
- No fixture value ever reached the real file; the fixture demo ran entirely
  against a `os.tmpdir()` copy.

## Recommendation (not actioned — outside this exercise's scope)

Record a Claude `/status` reading for `AU-all` (and, if the UI breaks them
out, `AU-opus`/`AU-fable`) via `--record`, so `--state`/`--publish` can reach
a lawful, fully real complete state without a fixture.

---

## Scripts used (not part of the repo; scratchpad only)

- `...\scratchpad\wo11-reports\record-real.js` — records the one real OU
  reading into the real file via the module API.
- `...\scratchpad\wo11-reports\fixture-pipeline.js` — builds the temp fixture
  file, adds the three FIXTURE readings, runs `bucketState()` and
  `router.dispatch()`.

## Repo state after this exercise

- `.claude/orchestra-pool-readings.jsonl` — created, 1 real line (gitignored,
  stays).
- `.claude/orchestra-pool-state.json` — NOT created (publish refused as
  designed).
- No tracked repo files were touched by this task's Task 2; the only tracked
  changes in the working tree are Task 1's `quartermaster/quartermaster.js`,
  `quartermaster/README.md`, and `tests/quartermaster.test.js`.
- Pre-existing untracked directories `wo11-fixtures/`, `wo11-reports/`,
  `wo11-transcripts/` at the repo root predate this session (timestamps
  2026-08-30 19:10–19:15, before this task started) and are unrelated to
  this exercise — left untouched, not committed.
