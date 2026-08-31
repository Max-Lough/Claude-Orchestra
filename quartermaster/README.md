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
| `../tests/quartermaster.test.js` | 152 checks, including the router-interop proof (a P0-produced state fed to the real `router/router.js`) |

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

### R3 — Staleness windows: 24h fresh / 7d usable · *unstatedInPlan (Director-set operational values)*

The plan sets no freshness window. The Director set: `maxFreshMs = 24h`,
`maxStaleMs = 7d`, both overridable per call.

- age ≤ 24h — **fresh**. Full standing: it can arm the confirmation gate.
- 24h < age ≤ 7d — **usable and DISCLOSED**. The fraction is published *exactly
  as recorded* and the report marks `stale: true`. Staleness is never
  discounted: aging a reading forward requires a burn rate, and a burn rate is
  a fabricated number (R2).
- age > 7d, or **no reading at all** — **REFUSED**. Not Green (fabricated
  capacity), not Red (fabricated scarcity). The error names the bucket and
  prints the exact `--record` command that fixes it.

A **future-dated** reading is also refused: clock skew or tamper, either way not
evidence.

### R4 — `belowReserve` via the router's own `requiredReserve`, on a WO-2-derived default forecast · *plan-cited formula (final-plan.md:1003-1006) + unstatedInPlan default (ESTIMATE)*

The formula is the plan's — *"required reserve = forecast mandatory-review draw
+ forecast incident draw + 30% uncertainty buffer, floored at the larger of 8%
of the bucket and the measured cost of two gate-class reviews"* — and it is
**imported from `router/router.js`, never reimplemented**, so the seat that
computes the reserve and the gate that enforces it can never drift.

The plan supplies no default forecast. Derived from `router/castings.json`, and
carried as a **WO-2-based ESTIMATE** (Director-set operational default):

```
per-review basis   = reserve.twoGateClassReviewsCostFraction / 2
                   = 0.003 / 2 = 0.0015 of the bucket per gate-class review
                     (WO-2 throughput probe 2026-08-28: 20 gate-class reviews
                      drew ~3 percentage points of the weekly window, 8%→11%
                      ⇒ 0.0015 each; the castings constant is the two-review floor)
5h windows / week  = 168 / 5 = 33.6
weekly reviews     = liveness.forecastPeakArrivalsPer5h × 33.6 = 10 × 33.6 = 336
mandatoryReviewDraw = 336 × 0.0015 = 0.504
incidentDraw        = 0
```

`incidentDraw` is **not derivable** from anything measured today, so it is left
at zero — a *disclosed under-estimate* rather than a fabricated number. The
default reserve is therefore a lower bound on the plan's full formula.

**Consequence, stated rather than softened.** The derivation uses the *peak*
arrival rate sustained across a whole week, so the default required reserve is
`0.504 × 1.3 = 0.6552` — **above the ladder's 40% Green threshold**. Under the
default forecast, any bucket below ~65.5% remaining is `belowReserve` and the
P15 gate fires. That is what the ruling's arithmetic says. Callers who want a
duty-cycled forecast pass one explicitly (`{mandatoryReviewDraw, incidentDraw}`,
or `--forecast-mandatory` / `--forecast-incident`). Flagged to the Director as
the one ruling whose literal reading has an operationally sharp edge.

### R5 — The Amber-arm confirmation protocol · *unstatedInPlan*

§5.5 arms a gate — *"below 40% AU-opus, no Opus dispatch without Quartermaster
confirmation"* — and never defines confirming. Undefined, it degenerates into a
rubber stamp, which is the exact failure P15 exists to prevent. The ruling:

> **Confirmation is evidence, not permission.** `confirm(bucket)` is granted
> only when a **fresh** (≤ `maxFreshMs`) reading exists for that bucket **and**
> that reading is **strictly above** `poolStateLadder.thresholds.orangeBelow`
> (0.20) — i.e. the bucket is genuinely in the Amber band the gate was written
> for, not sliding through Orange or Red behind a stale number.

A grant appends a `confirmation` entry (the audit trail that makes a wrong
confirmation attributable afterwards) and returns `{confirmed: true, evidence}`.
A refusal returns `{confirmed: false, reason}` and **appends nothing** — a
refused confirmation must leave no artifact a later reader could mistake for a
grant. `quartermasterConfirmation: true` appears on the published state only
while a recorded confirmation is itself inside the freshness window.

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
qm.bucketState({file, now, maxFreshMs, maxStaleMs, forecast});   // → normalizeBuckets input, or THROWS
qm.bucketStateDetail({...});                                     // + ages, staleness, malformed lines
qm.confirm(bucket, {dispatchRef, file, now});                    // → {confirmed, evidence|reason}
qm.predictThrottle(bucket, {file, now});                         // → typed estimate set
qm.report({file, now});                                          // → string
qm.publish({file, now, out});                                    // → snapshot
qm.defaultForecast();                                            // the R4 estimate, self-describing
```

Every function takes an injectable `file` and `now`, which is what lets the
suite run entirely on temp fixtures and never touch the real `.claude/` files.

## Proof

`node tests/quartermaster.test.js` — **152 checks**, all on `mkdtemp` fixtures.
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

Plus: threshold boundary exactness against router semantics (0.40 Green, 0.399
Amber, 0.20 Amber, 0.199 Orange, 0.08 Orange, 0.0799 Red, 0 Exhausted); every
validation rejection, proven to write nothing; fail-closed on absent, too-stale,
future-dated and malformed-latest evidence; the confirmation protocol granted,
refused and audited; prediction vectors (declining, single-reading,
non-monotonic, same-instant, already-crossed); throttle Red-precedence and the
R7 hard-throttle rule; snapshot publish and its fail-closed refusal to write;
and eleven hand-corrupted JSONL tamper cases.

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
