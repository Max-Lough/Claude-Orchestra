# WO-11 — Quartermaster substrate (class P0)

The deterministic core of the Quartermaster, per
`plans/cross-compare/agent-role-architecture/final-plan.md` (catalog entry 24,
lines 982-1011) and §5.5 (lines 1590-1612). It knows how much of each vendor's
allowance remains — **per bucket** — predicts exhaustion, and publishes the
degradation state the router reads.

Its one law: **it computes nothing it was not told.** §5.2 (line 1464): *"the
Anthropic side cannot [be expressed as a share of a window], and inventing a
denominator would fabricate a number."* Every fraction this substrate publishes
came from a reading someone recorded. There is no depletion model, no
back-derivation from call counts, no decay applied to an old number.

## Layout

| File | What it is |
|---|---|
| `quartermaster.js` | The whole substrate: recording + hard validation, the fail-closed bucket-state builder (the router's `normalizeBuckets` input), the Amber-arm confirmation protocol, two-point throttle prediction, the human report, the snapshot publisher, and the CLI |
| `README.md` | This file — the rulings, the CLI reference, the plan citations |
| `../tests/quartermaster.test.js` | 195 checks, including the router-interop proof (a P0-produced state fed to the real `router/router.js`), the round-2 adversarial suite (confirmation-validity exploit reproduction, `confirm()` blind-grant refusals, module-boundary validation, `predictThrottle` staleness/horizon guards), and the round-4 R3 revision's 23h/25h freshness-boundary vectors plus the Wednesday-scenario regression proving a reading past `maxFreshMs` refuses for routing before confirmation logic is ever reached |

Data files, both **gitignored** (operator data about a personal allowance; it
never enters version control):

| File | What it holds |
|---|---|
| `.claude/orchestra-pool-readings.jsonl` | Append-only log of readings, throttles and confirmations |
| `.claude/orchestra-pool-state.json` | The published `bucket_state` snapshot written by `--publish` |

Entry shapes:

```
{ts, kind:"reading",      bucket, remainingFraction, source, note?}
{ts, kind:"throttle",     bucket, severity:"soft"|"hard", message}
{ts, kind:"confirmation", bucket, dispatchRef?, evidenceTs, remainingFraction}
```

`bucket` is one of the four the plan publishes: `AU-all`, `AU-opus`,
`AU-fable`, `OU` (final-plan.md:990-995 — the two-bucket Max structure plus the
Fable sub-cap plus the OpenAI pool; if WO-1 falsifies it, this collapses to one
AU and nothing else changes).

## Design rulings

Every gap the plan leaves is settled here, numbered, with its status marked:
**plan-cited** (the plan says it, here is where) or **unstatedInPlan** (the plan
is silent; the Director ruled, and this is the ruling).

**Module-boundary validation (added round 2).** Every public API entry that
accepts caller-supplied numeric options (`forecast.mandatoryReviewDraw`,
`forecast.incidentDraw`, `maxFreshMs`, and `predictThrottle()`'s own
`maxStaleMs` — round 4 retires `maxStaleMs` from `analyze()`/`bucketState()`
entirely, see R3) validates them as `typeof
number` and finite, and throws a typed error otherwise — never coerces. The
round-1 review demonstrated `forecast: {mandatoryReviewDraw: '0.3', incidentDraw:
'0.1'}` (both strings) reaching `requiredReserve()`, where `(m + i) * (1 +
buffer)` string-concatenated before the `*` coerced the result to `NaN`;
`remainingFraction < NaN` is always `false`, so `belowReserve` silently read
`false` for every bucket and the P15 reserve gate was deleted without a single
thrown error. A caller-supplied numeric string, `NaN`, or non-finite value now
throws immediately, fail-closed, before it can reach a comparison.

### R1 — The contract is the router's `normalizeBuckets` input · *plan-cited (de facto)*

The plan says P0 "publishes the degradation state the router reads"
(final-plan.md:985) without naming a format. The format already exists in code:
`router/router.js:297-318`. `bucketState()` returns exactly that and nothing
else — all four buckets as **own** properties (an inherited value must never
satisfy the requirement), each `{state:{remainingFraction, reserveBreached?,
throttleObserved?, exhausted?}, belowReserve, quartermasterConfirmation?}`.
The router's fail-closed rules are therefore ours: a missing bucket is a
refusal, not a Green; `remainingFraction` outside [0,1] throws.

`quartermasterConfirmation` is **omitted** rather than set false when absent —
`normalizeBuckets` reads absence as false, and an explicit `false` would be a
claim we did not make.

### R2 — No fabricated denominators; readings only, both vendors · *plan-cited (§5.2, final-plan.md:1448-1469)*

The Anthropic allowance has no published denominator. So the substrate never
derives a remaining fraction from anything — not from the telemetry ledger, not
from a burn model. It records what a human (or a future scraper) read off a
vendor surface, with a mandatory `source` string: **a reading without
provenance is a fabricated number, and is refused.**

**Ledger attribution is IMPOSSIBLE today.** `.claude/hooks/orchestra-telemetry.js`
records `ts`, `session`, `event`, `tool`, `subagent_type`, `description`,
`agent_id`, `duration_ms`, and `model` *only* when a `Task`/`Agent` dispatch
happens to name one in its `tool_input`. It records no role, no effort, no
vendor, no bucket; its own header says token draw, allowance accounting,
throttle events and served-model substitution are all invisible to hook events;
and the OpenAI pool is **absent from it entirely** (Codex runs are not Claude
Code tool calls). There is consequently no mapping from a ledger row to a
bucket, and none is invented here.

*Registered follow-on, not done in WO-11:* extend the telemetry hook to stamp
role / model / effort / vendor / bucket per row, and add an OU-side record, in
**WO-1's lane** (the hook is WO-1 instrumentation; changing it here would fork
the instrument out from under its own probe).

### R3 — Freshness is the only gate: readings older than 24h are not routing evidence · *unstatedInPlan (Director-set operational value), REVISED round 4 after the R0 delta review*

The plan sets no freshness window. The Director set `maxFreshMs = 24h`,
overridable per call.

**Revised round 4 (WO-11 R0 delta review, MAJOR — "freshness is never a gate
input"), superseding round 3 in full:**

~~Revised round 3 (WO-11, owner-requested Sol·max holistic review, MAJOR B):
`maxStaleMs` is cut from 7d to 48h. Rationale: a weekly window moves ~15-20%
of its remaining fraction per day under normal load, so a reading a full week
old describes a pool state that no longer exists — it is obsolete, not
evidence, and publishing it unchanged (even disclosed) invites a dispatcher
to treat a stale number as current. 48h is the outer bound at which a
reading is still recognizably describing approximately the current state.~~

~~- age ≤ 24h — fresh. Full standing: it can arm the confirmation gate.~~
~~- 24h < age ≤ 48h — usable and DISCLOSED. The fraction is published exactly
  as recorded, and the staleness rides on the published reading object
  itself (`state.stale: true, state.ageMs`), the same object router.js's
  normalizeBuckets consumes, not only on the human report — so a snapshot
  consumer or a live dispatcher sees the disclosure even if it never calls
  --report. Staleness is never discounted: aging a reading forward requires a
  burn rate, and a burn rate is a fabricated number (R2).~~
~~- age > 48h, or no reading at all — REFUSED.~~
~~- Confirmations and gate-lifting already require FRESH evidence, unaffected
  by this revision: a stale (24h-48h) reading can be published, disclosed,
  but it can never arm or satisfy a gate — only a fresh (≤24h) reading can.~~

**Struck in full.** The round-3 "disclosed-but-usable" band was itself a
fail-open path: `router/router.js`'s `normalizeBuckets` (:297-318) and
`poolState` (:53-70) rebuild `bucket_state` from exactly
`state.remainingFraction` / `reserveBreached` / `throttleObserved` /
`exhausted` — any other key, `stale`/`ageMs` included, is silently dropped by
that rebuild. So a stale-but-published reading reached the router
indistinguishable from a fresh one at the one place the distinction needed to
survive, and a live dispatcher reading `bucket_state` directly (never calling
`--report`) had no way to know the number it was routing on was up to 48h
old. The R0 delta review's demonstrated exploit: a 35% `AU-opus` reading
confirmed near the edge of its own freshness window, never refreshed; two
days later `bucketState()` still published the (48h-stale) 35% reading AND
still honored the earlier confirmation, dispatching an un-gated Opus 5
primary — while a live `confirm()` call at that same instant refused outright
("latest reading is 1.3d old… past the 1.0d freshness window"). The gate
honored a grant it would no longer issue. The only safe encoding of
staleness in this contract is refusal, not disclosure:

- age ≤ 24h (`maxFreshMs`) — **fresh**. Routing evidence; can arm the
  confirmation gate.
- age > 24h, or **no reading at all** — **REFUSED**. Not Green (fabricated
  capacity), not Red (fabricated scarcity), and — as of round 4 — never
  published as disclosed-but-usable either. The error names the bucket, its
  age, and prints the exact `--record` command that fixes it — the identical
  typed-refusal shape an absent reading gets. `report()` still shows a
  refused bucket's last reading and its age for a human operator, marked
  `REFUSED-FOR-ROUTING` — that is display, never a routing input, and it
  never reaches `bucketState()`'s return value.

A **future-dated** reading is also refused: clock skew or tamper, either way not
evidence.

`maxStaleMs` is **retired as a routing parameter** — `analyze()`/
`bucketState()` no longer accept or read it at all, so passing one is inert
rather than a silent bypass of anything. It survives only as
`predictThrottle()`'s own, unrelated bound on trend-line inputs (R6): a
crossing-time estimate fit to points older than `maxStaleMs` is non-evidence,
not lower-confidence evidence. Either way it can no longer make any reading
routable.

**Confirmations and gate-lifting already required FRESH evidence before this
revision, and still do — but round 4 makes the reading's own freshness a
structural precondition rather than a parallel check.** The round-2 R5 fix
re-validates a recorded Amber-arm confirmation against **live** state at
every `analyze()` call, and `confirm()` itself still refuses outright on
anything past `maxFreshMs`. What round 4 adds: a bucket whose only evidence
is stale now fails the WHOLE bucket closed at the age check, before
confirmation logic is ever reached — so a stale reading's confirmation can
never even be evaluated, let alone honored. The R5 void-condition list (below)
keeps a sixth condition, "the live reading is itself fresh," documented for
completeness even though it can never actually fire from this call site: a
stale bucket already returned at the age check.

**Operational consequence, go-live cadence (round 4).** Because `maxFreshMs`
(24h) is now the sole gate a reading crosses for routing at all, go-live
requires a Claude `/status` reading recorded at least once per 24h window per
bucket — not the round-3 48h figure. This matches `final-plan.md:1003`'s own
cadence for the dynamic review reserve, "before each scheduling window": a
scheduling window that goes uncovered by a fresh reading now gets a loud,
typed refusal (naming the bucket, its age, and the `--record` fix) rather
than a quietly aging, still-routable number.

### R4 — `belowReserve` via the router's own `requiredReserve`, on a WO-2-measured default forecast · *plan-cited formula (final-plan.md:1003-1006) + unstatedInPlan default (ESTIMATE), CORRECTED by Director ruling (WO-11 P0 review)*

The formula is the plan's — *"required reserve = forecast mandatory-review draw
+ forecast incident draw + 30% uncertainty buffer, floored at the larger of 8%
of the bucket and the measured cost of two gate-class reviews"* — and it is
**imported from `router/router.js`, never reimplemented**, so the seat that
computes the reserve and the gate that enforces it can never drift.

The plan supplies no default forecast. An earlier derivation (below, now
**REJECTED**) sustained the *peak* arrival rate across a whole week and pushed
the default required reserve to ~65.5% — above the ladder's own 40% Green
threshold, so the P15 gate fired for nearly any bucket. **Ruling: that
derivation fabricated load** — no week runs entirely at burst rate — and is
replaced by WO-2's directly **measured** weekly draw as the operational
default:

```
mandatoryReviewDraw = 0.03
  (WO-2 throughput probe 2026-08-28: 20 gate-class reviews drew ~3 percentage
   points of the weekly window, 8%→11% ⇒ 0.03 measured directly — the SAME
   probe castings.reserve.twoGateClassReviewsCostSource cites, read as a
   weekly aggregate rather than derived through a peak-arrival extrapolation)
incidentDraw        = 0
```

`incidentDraw` is **not derivable** from anything measured today, so it is left
at zero — a *disclosed under-estimate* rather than a fabricated number.

**Nit, honest margin (round 2):** the operator's own second manual-readings
row (`.claude/orchestra-manual-readings.md`, "Whole WO-2 exercise (25
reviews): ~92%→86% remaining ≈ 6 pts / 25") implies a DIFFERENT weekly-volume
estimate — treating that 25-review batch the same way the adopted default
treats the 20-review batch gives `mandatoryReviewDraw ≈ 0.06`, double the
0.03 actually adopted. Stated honestly rather than silently favoring the
smaller figure: even at 0.06, the dynamic term is `0.06 × 1.3 = 0.078`, which
*still* sits under the 8% floor — so the floor-governs-the-default conclusion
below is unchanged either way, but the margin is thin (0.078 vs the 0.08
floor, a 0.002 gap) rather than wide. If the operator judges 25-review weeks
more representative than 20-review weeks, `--forecast-mandatory 0.06`
overrides the default explicitly.

**Consequence.** `requiredReserve(default) = 0.03 × 1.3 = 0.039`, which sits
**below** the plan's own 8% floor (`max(floorFractionOfBucket,
twoGateClassReviewsCostFraction) = max(0.08, 0.003) = 0.08`), so
**the floor governs the default**: `requiredReserve = 0.08`. A bucket below 8%
remaining is `belowReserve` under the default forecast — a floor-dominated,
non-fabricated result. Callers who want a busier-window forecast still pass one
explicitly (`{mandatoryReviewDraw, incidentDraw}`, or `--forecast-mandatory` /
`--forecast-incident`); that override path is unaffected by this correction.

**Rejected alternative, kept for the record** (its arithmetic is real, the
assumption behind it — a peak burst sustained across the whole week — was not):

```
per-review basis   = reserve.twoGateClassReviewsCostFraction / 2
                   = 0.003 / 2 = 0.0015 of the bucket per gate-class review
                     (the castings constant is the two-review floor, i.e.
                      twice that)
5h windows / week  = 168 / 5 = 33.6
weekly reviews     = liveness.forecastPeakArrivalsPer5h × 33.6 = 10 × 33.6 = 336
mandatoryReviewDraw = 336 × 0.0015 = 0.504
required reserve    = 0.504 × 1.3 = 0.6552 — above the ladder's 40% Green
                       threshold; any bucket below ~65.5% remaining would have
                       been `belowReserve` under this rejected default.
```

This alternative is **no longer the default** but remains available to any
caller who explicitly wants a peak-sustained forecast, by passing
`{mandatoryReviewDraw: 0.504, incidentDraw: 0}` (or the CLI flags) directly.

### R5 — The Amber-arm confirmation protocol · *unstatedInPlan, CORRECTED by Director ruling (WO-11 P0 round-2 review)*

§5.5 arms a gate — *"below 40% AU-opus, no Opus dispatch without Quartermaster
confirmation"* — and never defines confirming. Undefined, it degenerates into a
rubber stamp, which is the exact failure P15 exists to prevent. The ruling:

> **Confirmation is evidence, not permission.** `confirm(bucket)` is granted
> only when a **fresh** (≤ `maxFreshMs`) reading exists for that bucket **and**
> that reading is **strictly above** `poolStateLadder.thresholds.orangeBelow`
> (0.20) — i.e. the bucket is genuinely in the Amber band the gate was written
> for, not sliding through Orange or Red behind a stale number.

`confirm()` also REFUSES — appending nothing — on three more facts the round-1
review demonstrated it used to grant through: a throttle (soft **or** hard)
fresh for the bucket; the bucket reading zero (exhausted); the bucket's latest
raw line being malformed (the true current reading is unknown, so a prior one
cannot stand in for it).

A grant appends a `confirmation` entry (the audit trail that makes a wrong
confirmation attributable afterwards) and returns `{confirmed: true, evidence}`.
A refusal returns `{confirmed: false, reason}` and **appends nothing** — a
refused confirmation must leave no artifact a later reader could mistake for a
grant.

**CRITICAL, corrected round 2 — the confirmation outlives its evidence.** A
grant is a **fact about the reading it was made against**, not a standing
permission for the rest of `maxFreshMs`. `analyze()` re-validates a recorded
confirmation against **live** state at every call, and `quartermasterConfirmation:
true` appears on the published state only when ALL of the following hold RIGHT
NOW, not merely at grant time:

1. the confirmation itself was recorded within `maxFreshMs`;
2. its `evidenceTs` equals the bucket's **current** latest valid reading's
   `ts` — a newer reading landing since the grant **voids** it (superseded
   evidence);
3. that current reading's own fraction still satisfies the R5 predicate
   (strictly above `orangeBelow`) — checked against the LIVE reading, never
   against the confirmation's own recorded fraction;
4. no throttle is fresh and the bucket is not exhausted, right now;
5. the bucket carries no malformed-latest poison (structural: a poisoned
   bucket already fails the whole bucket closed before confirmation logic
   runs at all);
6. *(round 4)* the live reading is itself fresh — structural, same as (5): a
   bucket whose latest reading is past `maxFreshMs` already fails the whole
   bucket closed at R3's age check, before confirmation logic is reached at
   all. Listed for completeness and to keep `confirm()`'s own predicate and
   `analyze()` consistent, even though it can never actually fire from this
   call site.

Any violation voids the confirmation — the state publishes without it, and
both `bucketStateDetail()`'s analysis and the human report state exactly why
(`info.confirmation.voidReason`). The exploit this closes: a confirmation
granted on a 0.35 reading no longer arms the gate once a later 0.10 reading
lands — re-confirmation is required on the CURRENT evidence, every time.

### R6 — Throttle prediction: two-point linear, v1 · *unstatedInPlan*

The plan demands numbers *"reported as estimates with confidence"*
(final-plan.md:988-989) and names no method. v1 is the honest floor — the
simplest model whose assumptions fit on one line:

- **< 2 readings** → `{ok:false, reason:"insufficient data (need ≥2 readings)"}`.
  A single point has no slope; extrapolating one invents a number.
- **rate ≥ 0** (flat, or the allowance regenerating at a window reset) →
  `{ok:true, estimates:[], confidence:"insufficient-trend", note:"window-reset
  or non-monotonic; no prediction"}`. A rising allowance has no crossing time,
  and printing one would be fiction.
- **declining** → crossing ETAs for `amberBelow` / `orangeBelow` / `redBelow` /
  zero, at `confidence: "low (two-point linear)"`. Never higher: two points
  cannot support a stronger claim. An estimate whose crossing already lies
  behind `now` is flagged `overdue` rather than hidden — it means *record a
  fresh reading*, not *the bucket is fine*.

The seat's review criterion is **predicted vs observed throttle**
(final-plan.md:1010-1011). v1 records the raw material — every `--throttle`
record is an observation — and the report shows the observation list with an
explicit note that scoring needs a prediction history v1 does not keep. It
scores nothing it cannot yet compute. *Follow-on:* persist predictions so the
comparison becomes a number.

**Two more typed refusals, round 2:** a latest reading older than `maxStaleMs`
refuses with `"readings too stale to be evidence"` rather than fitting a trend
line to stale points (that is not lower-confidence evidence, it is
non-evidence); and an extremely small decline rate (e.g. `1e-12`) that would
put a crossing time outside a JS `Date`'s representable range (past
±8.64e15ms/epoch) is typed `beyondHorizon: true` rather than throwing a
`RangeError` — `report()` calls `predictThrottle()` internally and must never
throw.

### R7 — The Exhausted evidence rule · *unstatedInPlan*

§5.5's ladder table stops at Red; the exhaustion matrix describes an exhausted
pool without saying what **proves** one, and `castings.json` adds `Exhausted` as
a fifth state. Two pieces of evidence, both recorded, neither inferred:

1. the latest reading is **≤ 0**; or
2. a **hard** throttle inside the freshness window.

A **soft** throttle is Red (the ladder's own *"a throttle observed"*), not
Exhausted. The plan's whole point about `AU-opus` is that it fails by **silent
substitution** rather than by erroring (final-plan.md:992-1001), so exhaustion
is never assumed from silence — only from a number or an explicit refusal.

### R8 — `allGreen()` stays; `wo7b/score.js` untouched; live dispatch should source `bucket_state` from P0 · *unstatedInPlan*

`router.allGreen()` is a **test affordance** and stays exported: dozens of
router checks need a neutral bucket state that asserts nothing about the real
pool, and the WO-7b probe re-scorer (`plans/.../wo7b/score.js`) depends on it.
Neither was modified by WO-11.

The ruling is about **live** dispatch, not tests: once readings exist, a live
dispatcher should source `bucket_state` from this substrate —
`require('./quartermaster/quartermaster.js').bucketState()`, or the
`--publish` snapshot — and must let the fail-closed refusal propagate rather
than substituting `allGreen()`. `allGreen()` in a live path is precisely the
fabricated-capacity failure R3 refuses.

### R9 — `modelAssist` unused in v1 · *plan-cited (final-plan.md:986-987) + unstatedInPlan scope*

The plan allows a *"cheapest-tier model only for summarization"*, and
`castings.json` declares `roles.Quartermaster.modelAssist` (Luna low / Haiku
off). v1 uses **none of it**: every output here is deterministic code over
recorded readings, and the `report()` summary is string formatting, not
summarization. The declaration stays in castings for a future prose-summary
path; nothing in this substrate reads it.

### R10 — No registry schema added · *unstatedInPlan*

The reading/throttle/confirmation shapes are documented **here** and enforced by
`quartermaster.js`'s own validators, not by a new `registry/schemas/*.json`.
The registry's six schemas cover orders, reports and verdicts — dispatch
artifacts — and P0 readings are operator observations, not dispatch artifacts.
Adding a seventh schema would also mean touching `registry/`, which WO-11 does
not own. *Possible follow-on:* promote the entry shapes to a registry schema if
another seat ever needs to produce or validate them.

### R11 — Ledger maintenance · *DECLARED NOT IMPLEMENTED in v1, added round 2*

The P0 duties this substrate was built against imply a maintenance obligation
for the readings/telemetry files it depends on and produces — rotation and
integrity of `.claude/orchestra-pool-readings.jsonl` (and the snapshot it
publishes) as the append-only log grows across the life of a project. v1 has
no rotation, compaction, or integrity-check tooling; every function reads the
whole file on every call. **Registered follow-on**, not built here: a
maintenance pass (rotate past some size/age, verify hash continuity, archive
rather than delete) — scope not yet designed.

### R12 — Cost reporting · *DECLARED NOT IMPLEMENTED in v1, added round 2*

The plan's per-class draw model (final-plan.md:1476-1519) implies a
per-window cost summary — how much of each bucket a given work order or
review round actually drew — that this substrate does not compute. It is
blocked on the same gap R2 already names: **ledger attribution is impossible
today** (`.claude/hooks/orchestra-telemetry.js` records no role, effort,
vendor, or bucket per row). **Registered follow-on**, not built here: once
R2's follow-on (extending the telemetry hook, WO-1's lane) supplies
attribution, a per-window draw-summary report becomes possible; it is not
invented here as a number this substrate cannot yet evidence.

## CLI

```
node quartermaster/quartermaster.js --record <bucket> <fraction> --source "..." [--note "..."]
node quartermaster/quartermaster.js --throttle <bucket> <soft|hard> --message "..."
node quartermaster/quartermaster.js --confirm <bucket> [--dispatch-ref <id>]
node quartermaster/quartermaster.js --report
node quartermaster/quartermaster.js --state
node quartermaster/quartermaster.js --publish [--out <file>]
```

Common options: `--file <readings.jsonl>` (default
`.claude/orchestra-pool-readings.jsonl`), `--forecast-mandatory <n>`,
`--forecast-incident <n>`.

Exit codes: **0** success · **1** fail-closed refusal or validation rejection.

| Command | Does |
|---|---|
| `--record` | Appends a reading. Unknown bucket, fraction outside [0,1], or missing source → refused, nothing written |
| `--throttle` | Appends an observed throttle. `soft` → Red; `hard` → Exhausted (R7) |
| `--confirm` | Runs the R5 protocol. Exits 1 on refusal; appends only on a grant |
| `--report` | Human summary: per bucket the latest reading, its age, the ladder state, reserve status, active throttles and the prediction; the malformed-line count; the predicted-vs-observed section. Prints fail-closed refusals rather than becoming one |
| `--state` | Prints the `bucketState()` JSON, or exits 1 with the fail-closed error |
| `--publish` | Writes the snapshot (fails closed first — an authority file is never written from incomplete evidence) |

## Module API

```js
const qm = require('./quartermaster/quartermaster.js');
qm.recordReading(bucket, remainingFraction, source, note?, {file, now});
qm.recordThrottle(bucket, 'soft'|'hard', message, {file, now});
qm.bucketState({file, now, maxFreshMs, forecast});               // → normalizeBuckets input, or THROWS
qm.bucketStateDetail({...});                                     // + ages, malformed lines
qm.confirm(bucket, {dispatchRef, file, now, maxFreshMs});        // → {confirmed, evidence|reason}
qm.predictThrottle(bucket, {file, now, maxStaleMs});             // → typed estimate set
qm.report({file, now});                                          // → string
qm.publish({file, now, out});                                    // → snapshot
qm.defaultForecast();                                            // the R4 estimate, self-describing
```

Every function takes an injectable `file` and `now`, which is what lets the
suite run entirely on temp fixtures and never touch the real `.claude/` files.

## Proof

`node tests/quartermaster.test.js` — **195 checks**, all on `mkdtemp` fixtures.
The load-bearing ones are the **interop** section, which feeds a P0-produced
state into the real `router/router.js`:

| Scenario, from recorded readings only | Router outcome |
|---|---|
| Four fresh healthy readings | `normalizeBuckets` → all Green; `dispatch(I0)` serves the Opus 5 primary rung; no gate fires |
| `AU-opus` at 30% against a 39% required reserve | `dispatch(I0)` → `GATED`, gate `AU-O reserve (P15)`, lawful responses `["mirror","wait"]` |
| `AU-opus` in the Amber band, unconfirmed | `preDispatchGate` and a review-purpose `dispatch` → `GATED`, gate `AU-O armed (Amber, §5.5)` |
| …then a recorded `confirm('AU-opus')` | the arm lifts; the Opus review dispatches |
| `AU-opus` hard-throttled at 92% remaining | `effectiveState('Opus 5')` → `Exhausted`; the Investigator recasts to the openai mirror, disclosed |
| `AU-opus` read at zero | both exhausted **and** below reserve; the stricter P15 reserve stop wins — `GATED`, not a silent recast |
| `OU` hard-throttled | mandatory T2 review of Anthropic work → `DOES_NOT_CLOSE` with wait / named-human / park |
| `AU-opus` confirmed on a 0.35 reading, THEN a later 0.10 reading lands (round-2 CRITICAL exploit repro) | the confirmation VOIDS (superseded evidence); `dispatch(I0, purpose:'review')` → `GATED`, gate `AU-O armed (Amber, §5.5)` |

Plus: threshold boundary exactness against router semantics (0.40 Green, 0.399
Amber, 0.20 Amber, 0.199 Orange, 0.08 Orange, 0.0799 Red, 0 Exhausted); every
validation rejection, proven to write nothing; fail-closed on absent, too-stale,
future-dated and malformed-latest evidence; the confirmation protocol granted,
refused and audited; prediction vectors (declining, single-reading,
non-monotonic, same-instant, already-crossed); throttle Red-precedence and the
R7 hard-throttle rule; snapshot publish and its fail-closed refusal to write;
eleven hand-corrupted JSONL tamper cases; and, round 2: the confirmation-voids-
on-superseded/failed-predicate/fresh-throttle matrix (§13), `confirm()`'s three
blind-grant refusals (§14), the module-boundary validation set including the
exact `'0.3'+'0.1'` string-concat NaN exploit vector (§15), and `predictThrottle`'s
staleness refusal plus its 1e-12-decline RangeError guard (§16). Round 4 (§3):
freshness is the only gate — a 23h-old reading routes normally with no
stale/ageMs key on the published object at all (there is no such key any
more), a 25h-old reading is REFUSED FOR ROUTING under `maxFreshMs` exactly
like an absent reading (same typed-error shape, and `report()` still shows
the human operator the refused reading and its age, marked
`REFUSED-FOR-ROUTING`), and the delta review's own Wednesday-scenario
exploit shape (a confirmation granted near the edge of its evidence's
freshness window, never refreshed, evaluated once the reading itself has
gone stale) now refuses at `bucketState()` before confirmation logic is ever
reached — closing the round-3 gap where a stale-but-disclosed reading still
reached the router indistinguishable from a fresh one.

## Plan and work-order citations

| Claim | Source |
|---|---|
| Seat purpose, bucket model, the one hard gate, dynamic review reserve, review criterion | final-plan.md:982-1011 |
| Pool states and the degradation ladder; the exhaustion matrix | final-plan.md:1590-1612 |
| Units, and "inventing a denominator would fabricate a number" | final-plan.md:1448-1469 |
| Per-class draw and the illustrative mix | final-plan.md:1476-1519 |
| Buckets, ladder thresholds, reserve constants, liveness forecast | `router/castings.json` |
| `poolState`, `requiredReserve`, `normalizeBuckets`, the P15 gates | `router/router.js:53-80, 297-328, 346-384` |
| What the telemetry ledger does and does not record | `.claude/hooks/orchestra-telemetry.js` header, "WHAT THIS CANNOT MEASURE" |
| Substrate conventions (zero deps, CommonJS, typed outcomes, fail closed) | `verifier/README.md`, `verifier/verifier.js` |
