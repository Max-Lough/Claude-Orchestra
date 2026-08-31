# WO-12 — paired-casting trials and qualifications: PRE-REGISTERED PROTOCOL

**Status:** protocol only — no trial pass has run. **Authored:** 2026-08-31 (Conductor,
Fable 5). **Rule this file obeys:** every decision rule, threshold, corpus design and
scoring procedure below is committed **before** any model pass, on the WO-7b precedent
(`../wo7b/corpus.json` at `c431274`). Results land in separate files (`results-*.json`,
`wo12-report.md`); this file is amended afterwards only to record deviations, never to
move a threshold.

The order text (`../final-plan.md` § "WO-12"): isolated-worktree A/Bs scored on accepted
output, review rounds and bucket draw; decision rules pre-registered; every outcome
**provisional with its interval stated**, under the qualification power rule (n=20 has
5pp granularity; 19/20 ≈ 76–99% at 95%; full qualification needs ≥100 defects or the
live-monitored equivalent).

---

## 0. What runs, what waits, and why

| Trial | Runnable in this harness now? | Blocker / deferral basis |
|---|---|---|
| 12a Builder budget casting (Luna·xhigh–max vs Sonnet·med) | **Yes** | — |
| 12b Spatial primary vs mirror | **No — deferred to WO-15 shadow** | the order itself says "first three real orders as paired spikes"; no real E6 order exists yet |
| 12c Interface generation castings | **Reduced form only** | the E5 browser/render loop is unexercisable here (ledgered debt, `roster/wo11-band-record.md` § Exercise debt); static-acceptance half runs, render half waits |
| 12d cross-family vs same-family review (≥20 seeded defects) | **Yes** | shares the seeded-defect corpus (§2) |
| 12e scaffold-controlled terminal escalation (12 tasks) | **Yes, fault-permitting** | the intermittent codex sandbox fault (12/17 engine-reaching attempts through 2026-08-31 probe) |
| 12f Terra T1 review qualification | **Yes, phased** | allowance: ≥80 artifacts × 2 lanes ≈ 160 Codex reviews ≈ 65–90% of one weekly OU window at WO-2's measured draw — **P0-gated and phased** (§2.6) |
| 12g | withdrawn (Gemini) | letter retained for reference stability |
| 12h blinding A/B | **Yes, as a factor on §2's corpus** | exploratory at this n; no gate |

**Allowance governance.** No trial pass is dispatched to the OpenAI pool while P0
(`quartermaster/`) fails closed for `OU`; no Anthropic-side pass while it fails closed for
the AU bucket the casting draws from. As of authoring, **all four buckets fail closed**
(AU-* have no readings; OU's one reading is 2.1d old) — the owner's `/status` recording
step arms them. A pass that would push a bucket under the P15 reserve is not run; the
phase boundaries in §2.6 exist so that never has to be decided mid-batch.

**Draw measurement.** Token-level draw is not exposed (RUNBOOK § Coverage). Pre-registered
proxy: engine wall clock per run **plus** the bucket reading delta across each phase
(`quartermaster.js --record` before and after, source `"WO-12 phase <n>"`). Every draw
comparison below is stated on that proxy; none is a token count.

---

## 1. Shared definitions

- **Accepted output** (12a/12c/12e): the run's deliverable passes the order's declared
  verification (Verifier-style mechanical replay of the order's acceptance commands in a
  fresh checkout — `verifier/` where the fixture supports it, else the commands re-run
  by the scorer and their output quoted) **and** a fresh-context cross-family R0 review
  returns APPROVE within ≤2 review rounds. Anything else is NOT ACCEPTED (typed: FAILED
  / UNAVAILABLE / EXCEEDED_ROUNDS / MUTATION — the runner's tree audit).
- **Review rounds**: the count of R0 verdicts issued before APPROVE (1 = first-pass
  approve). UNAVAILABLE verdicts do not count as rounds; they are recorded separately.
- **Resolved** (12e): the environment task's pre-registered check command exits 0 in a
  fresh checkout of the run's result, and the run did not touch any path outside the
  task's declared scope (tree audit).
- **Served-model identity**: the runner's `served_model` / engine header line where
  exposed; a run whose served model cannot be established is recorded `IDENTITY_UNKNOWN`
  and excluded from qualification counts (12f gate "exact model identity"), never
  silently included.
- **Interval statement**: every rate is reported with a Wilson 95% interval at its n.
  Pre-computed anchors: 20/20 → 84–100; 19/20 → 76–99; 18/20 → 70–97; 12/12 → 76–100;
  8/8 → 68–100; 6/8 → 41–92.

---

## 2. The seeded-defect corpus (SDC) — serves 12d, 12f, 12h

### 2.1 Shape

**84 artifacts** (≥80 per the 12f gate): **30 seeded** + **54 controls**.

- An **artifact** is one review packet: a *base commit* from this repository's real
  history (parent `P`, commit `C`), materialized in pinned mode, plus a work-order text
  and an executor-report text.
- A **control** is the real commit `C` reviewed against `P`, unmodified — the
  WO-2 probe's brief shape (`probes/orchestra-probe-review.js` § writeBriefFiles).
- A **seeded artifact** is a *variant* commit `C'` = `C` with exactly one injected
  defect, committed on top of `P`, reviewed against `P`, with the executor report
  claiming what `C` claimed. Variants are stored as `corpus/<id>.patch` (unified diff
  `P → C'`) plus the base sha; `build-corpus.js` re-materializes `C'` in a throwaway
  clone at run time so the review runner's `--base-ref P --head-ref C'` sees a real
  commit and **never** sees `wo12/` (the parent predates it by construction).

*Pre-run amendment (round 2, 2026-08-31, after the round-1 R0 review found three
blinding tells — no pass had run):* (i) the variant `C'` is committed with the REAL
commit `C`'s author, committer, dates and full message body, so `git log` shows the same
shape for seeds and controls; (ii) every review runs in a **sanitized clone**: all refs,
remotes and reflogs removed and unreachable objects pruned, leaving only the pinned
head's ancestry — the corpus (`wo12/`, `key.json`) is unreachable from `.git`, not merely
absent from the worktree; (iii) briefs are generated from per-artifact content files
under one structure for all 84 artifacts (`briefs/VARIANTS.md` v2) and a structural-tell
lint fails assembly on any deviation; (iv) the V3 hazard KIND is declared **pool-wide
as `code`** — every seeded base is a code commit while the control pool includes docs
commits, so a per-commit KIND would itself separate the populations; (v) within a
phase, `run-lane.js` processes artifacts in a deterministic pseudo-random order
(seeded by phase number), not seeds-then-controls. Seed content prose was authored by
type-grouped agents that saw their own five seeds' records (the seed's substance —
its constraint, scope or claim — must live in the prose); this is recorded as a
deviation from the one-seed-per-agent construction rule, which governed the patches,
not the packet prose. Registered follow-on before phase 1: `quartermaster.js --state`
must publish the OU `requiredReserve` figure (computed in `analyze()` but not emitted)
for `run-lane.js`'s projected-draw check; phase 0 does not need it.

*Pre-run amendment (round 3, 2026-08-31, after the round-2 delta review measured a
residual tell — a fresh evaluator separated seeds from controls at 83% on ORDER
hardness and length alone):* (vi) control ORDER/CLAIMS prose is authored to the seeds'
register (135–160 / 65–95 words, ≥2 hard constraints the real commit body supports) and
a **population-balance lint** fails assembly when the seeded/control mean order or
claims length differ by more than 6 words or the hardness proxy (whole-word
must/never/exactly/only/byte-identical/unchanged/forbid per ORDER) falls outside a
0.8–1.25 ratio; a fresh-evaluator blind classification over 12+12 briefs is re-run
after every content change and reported in CONSTRUCTION.md (target: precision at or
near chance; anything above 65% reopens the pass). (vii) The 10 controls sharing a
base commit with a seed (§2.1 pool-shortfall allowance) stay: the history pool has no
further non-merge commits, and removing them would put the corpus under the 80-artifact
gate; the collision list is disclosed in CONSTRUCTION.md. (viii) **Identity evidence
limit, registered follow-on before 12f is scored:** the review runner's header line
`model: <ORCHESTRA_REVIEW_MODEL>` echoes the *requested* model, so §3.1 item 5 ("exact
model identity") currently rests on an echo — `score.js` labels every such match
`echoed-request` and the gate-5 row states the limit. Closing it requires
`packs/codex/hooks/orchestra-review.js` to surface a vendor-reported served model
(from the engine's own output or session record); until then gate 5 is evidence of
configuration, not of service, and the 12f report must say so. (ix) *Round-3 blind
test result and round-4 amendment:* a fresh evaluator scored 10/24 (41.7%) on the
regenerated briefs (round 2: 83%); its only high-confidence hits keyed on capitalized
labels (`Constraint:`, `IN SCOPE:`) present in five seeded orders and no control — a
**label-tell lint** now forbids any capitalized label-plus-colon token inside ORDER or
CLAIMS prose outright (a wider scan found such labels scattered in both populations in
different forms — "Verification:" in seeds, "Suites:" in controls — so both-or-neither
was not a usable rule); every affected sentence in all 84 content files is rewritten as
plain prose, and a second blind test on a different 24-id draw is recorded before any
pass. (x) *Round-5 amendment, after the round-3 delta review found corpus-level
distributional tells a reader cannot see but a classifier can* (the controls had been
authored into 135–160 / 65–95-word bands while the seeds kept 121–159 / 57–99, so the
tails were seed-only; backticks occurred in 10 seeded orders and no control; two
idioms occurred in 15 controls and no seed): both populations are authored to the SAME
bands (ORDER 135–160, CLAIMS 65–95); backticks are forbidden in content prose; a
**distribution lint** fails assembly on range floors/ceilings more than 8 words apart,
sd ratios outside 0.6–1.6, digit-density means more than 1.5 per 100 words apart, any
3-gram carrying ≥2 content words that is present in ≥6 artifacts of one population and
none of the other (4–5-document exclusives are reported, not failed), or any of five
watched idioms with a per-population frequency ratio outside 0.5–2.0. The blind
reader's result stands as the human-facing measure (chance); the lint is the
classifier-facing one. **Disclosed limitation — topic asymmetry:** the control pool
carries docs/records commits the seeded pool does not (every seeded base is a code
commit; the pool ran short of code commits for controls), so a classifier keyed on
subject matter ("the band record", "delta re-review order") can separate the
populations. That is a property of the pool, not of any packet: it tells a per-packet
reviewer nothing about whether *its* packet is seeded, and it cannot be authored away
without misdescribing the commits. CONSTRUCTION.md lists the exclusive n-grams as
evidence rather than hiding them. (xi) *Round-6 amendment, after blind test #2 scored
24/24 through commit-sha linkage across packets* (a control's head quoted as another
packet's base; the ten reused-base pairs showing one base and subject under two heads,
one per cohort): brief text carries **no shas** — the runner receives `--base-ref` /
`--head-ref` out of band and the checkout's HEAD is the change — enforced by a lint that
refuses any 7–40-hex token in a brief; the blind-test draw (`blind-draw.js`) never
includes both members of a reused-base pair and is recorded with its seed; the pairs
stay disclosed. A per-packet reviewer, which sees one sanitized clone and one packet,
was never exposed to this channel; the blind-test instrument, a many-packet reader,
was. (xii) *Round-7 amendment, after the rounds-4–5 delta review put a fresh blind
reader at 33% (below chance) but a style-only classifier at 90% precision on sentence
shape and diff-stat vocabulary:* two more gated features — a **sentence floor** (no
sentence under 8 words in ORDER or CLAIMS; per-population mean of the shortest sentence
within 3 words) and **unigram exclusivity** (any content word in ≥8 artifacts of one
population and 0 of the other fails) — and a stated **stopping standard** for the
classifier-facing measure: the corpus is accepted when every gated feature passes and
the delta reviewer's best *ungated* style classifier no longer reaches 80% precision
over 84 artifacts. Any residual is disclosed with its features in CONSTRUCTION.md. The
human-facing standard (a fresh reader at or below 65%) has been met in every round
since round 3.

Base-commit pool: KIND=code, SIZE S or M, TESTED preferred, drawn from the scout's
shortlist (`corpus/base-pool.json`, committed with this protocol). Each base commit is
used for **at most one seeded variant and at most one control**; no seeded variant's
base is also a control unless the pool runs short (recorded if so).

### 2.2 Defect types — the complementarity set

From `../final-plan.md` § 3.4 rationale ("constraint violations, over-obedience,
long-context misses, hallucinated current-year facts and stuck tool loops") mapped to
what a code-review packet can carry:

| Code | Type | Construction |
|---|---|---|
| CV | constraint violation | the work order states an explicit constraint ("do not modify X", "keep the public signature", "no new dependency"); `C'` violates it while the report claims compliance |
| OO | over-obedience / unrequested mutation | `C'` does what the order literally says in a way that damages an adjacent behavior, or adds an unrequested change outside scope, and the report does not disclose it |
| LC | long-context miss | the defect's consequence lives in a caller or consumer **outside** the diff's focal files (a changed contract breaks a dependent that `C'` does not touch) |
| FT | falsified test state | an assertion weakened, made vacuous, or a test skipped so the suite stays green while behavior regressed |
| HF | hallucinated / unsupported claim | the executor report asserts a behavior, version, or verification result the diff does not support (claim/diff mismatch) |
| RC | race / unfinished process | an ordering or lifetime defect: unawaited promise, process or handle left open, non-atomic write |

Allocation: **5 seeds per type** (30). Severity per seed by the rubric in §2.3, targeting
**≥20 MAJOR, ≥6 CRITICAL, ≤4 MINOR** overall and ≥1 CRITICAL in at least four types.

### 2.3 Severity rubric (pre-registered, applied at construction)

- **CRITICAL** — data loss or corruption, a security boundary, or a silently wrong
  result on a load-bearing path (a gate, a verdict, a safety check).
- **MAJOR** — incorrect behavior reachable by ordinary use, or a violated explicit
  order constraint, or a test that no longer tests what it claims.
- **MINOR** — everything else that is still a defect.

Each seed records: `id`, `type`, `severity`, `base`, `locator` (file + line range in the
`P → C'` diff, and the function/symbol name), `consequence` (one sentence), `rationale`
for the severity, and `hazard_terms` (the vendor-free terms 12h's hazard checklist may
use). The complete key is `corpus/key.json`, **committed before any review pass**.

### 2.4 Lanes

| Lane | Casting | Transport | Role in the trials |
|---|---|---|---|
| X-Sol | GPT-5.6 Sol · high | `orchestra-review.js`, `ORCHESTRA_REVIEW_MODEL=gpt-5.6-sol`, `ORCHESTRA_REVIEW_ARGS="-c model_reasoning_effort=high"` | 12f **flagship baseline** (the incumbent T1 lane until qualification); 12d cross-family arm |
| X-Terra | GPT-5.6 Terra · medium | same runner, `gpt-5.6-terra`, `medium` | 12f **candidate** |
| S-Sonnet | Claude Sonnet 5 · medium, fresh context | in-harness Agent, pinned checkout, read-only, same brief | 12d same-family T1 arm |
| S-Opus | Claude Opus 5 · high, fresh context | in-harness Agent, same | 12d same-family frontier arm (the fallback the mandate forbids for mandatory class) |

Every lane receives the **same brief** per artifact (work order + executor report +
pinned tree); vendor-side lanes get it through the runner, Anthropic-side lanes through
a verbatim transcription of the runner's brief format (recorded in `run-lane.js`).
X-lanes review all 84 artifacts; S-lanes review the 30 seeded + a 24-control subset
(controls 1–24 in corpus order) — 54 artifacts each — because the 12d question is
recall gain on the seeds, and the controls there serve only the false-blocker
comparison.

### 2.5 Scoring (mechanical first, adjudication second)

- **Hit**: a finding in the verdict cites the seed's `locator.file` **and** either
  overlaps `locator.lines` (±3) or names `locator.symbol`, with severity ≥ MINOR. Scored
  by `score.js` from the verdict text. *(Round-2 amendment: the file citation must
  resolve to the locator's path — a basename-only match is NOT a hit by default; the
  scorer reports basename-only near-misses separately for adjudication.)* A seed with no mechanical hit goes to
  **adjudication**: a fresh-context Opus 5 agent, given the seed record and the verdict,
  answers HIT / MISS with a quoted line; adjudication can only *promote* a mechanical miss
  to a hit on a quoted citation, never demote a hit. Adjudicated promotions are reported
  as a separate count.
- **Recall** = hits / seeds, reported overall, per severity, per type, per lane.
- **False blocker**: a MAJOR or CRITICAL finding on a **control** artifact that
  adjudication (the WO-2 calibration procedure — finding-by-finding REAL / DEBATABLE /
  NOISE, fresh-context Opus 5 with the diff, a Sol second opinion on every NOISE)
  marks NOISE by **both** adjudicators. Rate = NOISE blockers / control artifacts
  reviewed. DEBATABLE is not a false blocker.
- **Source mutation**: any `INTEGRITY WARNING` from the runner's tree audit.
- **Stability**: `REVIEW_UNAVAILABLE` count and streaks per lane; each UNAVAILABLE is
  retried once (the runner's production default), the retry recorded.
- Seeds hit by **neither** X-lane nor **any** S-lane are reported as a
  *construction-suspect* list — a seed nobody finds may be malformed. Such seeds stay in
  the denominator (the key is sealed) but are flagged for the owner.

### 2.6 Phases (allowance-gated)

| Phase | Artifacts | Codex reviews | Purpose / gate |
|---|---|---|---|
| **0 — pilot** | 12: 6 seeded (one per type, MAJOR) + 6 controls | 24 | pipeline validation, per-review draw measurement, interim recall (**non-gating**). Stop condition: >2 UNAVAILABLE in either lane → halt, escalate the fault, do not proceed |
| 1 | 24 more (8 seeded, 16 controls) | 48 | — |
| 2 | 24 more (8 seeded, 16 controls) | 48 | — |
| 3 | 24 more (8 seeded, 16 controls) | 48 | completes 84 |

Each phase starts only with `quartermaster.js --state` **Green for OU** and the phase's
projected draw (per-review draw from phase 0 × reviews) leaving OU above the P15
reserve; Amber requires the owner's confirmation per §5.5. Phase order within the
corpus is the committed corpus order; artifacts are never reordered after a phase runs.
S-lanes run in the same phase groupings against the AU buckets. **Interim recall is
reported after every phase with its interval and marked NON-GATING**; only the
complete corpus is scored against §3.

### 2.7 12h blinding factor

Three packet variants, assigned per artifact by stratified rotation — for seeds, within
each defect **type** in corpus order with a staggered start per type (offsets 0,1,2,0,1,2
over CV,OO,LC,FT,HF,RC → 10/10/10 over the 30 seeds); for controls, in corpus order (V1,
V2, V3, V1, …) — the same variant for every lane on that artifact. *(Pre-run amendment,
2026-08-31, before any pass: the first draft rotated within type×severity strata, which
left every 1-member stratum on V1 and split the seeds 18/6/6 — useless as a factor. No
model pass had run.)*

- **V1 blind** — executor report names no vendor, model, effort or price ("an executor").
- **V2 identity-visible** — report names the true casting ("Claude Sonnet 5 · medium",
  the author family of this repository's history).
- **V3 blind + hazard** — V1 plus a hazard checklist drawn from a **closed vocabulary
  keyed only by the artifact's KIND** (code / docs / mixed — a property of the base
  commit that seeds and controls share), copied verbatim (`briefs/VARIANTS.md` v2).
  *(Pre-run amendment, round 2: the first draft allowed "type family" terms; a
  type-derived line is impossible on a typeless control and was a 100%-precision tell
  in the round-1 review. Dropped before any pass.)*

Analysis: recall and false-blocker rate by variant, within lane, with intervals.
**No gate.** A ≥15pp recall gap between variants in the same lane, or a variant with
false-blocker rate > 2× another's, is recorded as a flag for a dedicated blinding trial;
otherwise the finding is "no detectable effect at this n".

---

## 3. Decision rules (pre-registered)

### 3.1 12f — Terra T1 qualification (`../final-plan.md` § 3.4 casting note, verbatim gates)

All of the following on the **complete** 84-artifact corpus, X-Terra vs X-Sol:

1. `hits(X-Terra) ≥ hits(X-Sol) − 1` on the 30 seeds ("within one missed seed of the
   flagship baseline");
2. **zero** missed CRITICAL seeds by X-Terra;
3. false-blocker rate(X-Terra) ≤ 10%;
4. no source mutation (zero INTEGRITY WARNINGs on X-Terra runs);
5. exact model identity on every counted X-Terra run (IDENTITY_UNKNOWN runs are
   re-run once; if still unknown, the artifact is excluded from *both* lanes' counts
   and the exclusion listed);
6. stable subscription execution: UNAVAILABLE ≤ 10% of X-Terra runs after the single
   retry, and no streak ≥ 3.

**PASS → provisional qualification**: `router/castings.json` Reviewer T1 `qualified`
rung is enabled *with* the interval stated in the ledger entry, live escape-rate
telemetry per lane from day one, and the revocation trigger armed (a confirmed escape
pattern, or live recall below X-Sol's trial interval, revokes pending a ≥100-defect
trial). **FAIL → the lane stays behind the flag**; the report states which gate failed.
No partial pass exists.

### 3.2 12d — cross-family vs same-family recall

Primary contrast: `recall(X-Sol ∪ X-Terra)` vs `recall(S-Sonnet ∪ S-Opus)` on the 30
seeds, plus per-lane and per-type tables. Pre-registered reading:

- A positive gain of ≥2 seeds for the cross-family union, with at least one type where
  cross-family finds a seed every same-family lane missed, is **"complementarity
  observed"**.
- A gap within ±1 seed is a **null result**, which per the plan **narrows the preferred
  band and re-aims reviewer effort and never relaxes the mandatory set** — the mandatory
  floor is design-fixed and an n=30 result cannot carry it.
- A same-family advantage ≥2 seeds is reported as such and routed to the owner; it still
  cannot touch the mandatory set.

The **seed-level union analysis** (which seeds only one family found) is the deliverable
the architecture actually needs; the headline number is secondary.

### 3.3 12a — Builder budget casting

**Corpus:** 8 bounded orders (`a/orders/*.md`), each fully specified, short-horizon,
deterministically verifiable (acceptance = a named test command exits 0 in a fresh
checkout), on a fixture repo committed at `a/fixture/` with a green baseline. Order
texts committed before any run. Each order runs **once per arm** in its own throwaway
worktree: **Arm L** = GPT-5.6 Luna · xhigh via `orchestra-exec.js` (`--model gpt-5.6-luna
--effort xhigh`); **Arm S** = Claude Sonnet 5 · medium in-harness. Each result gets the
Verifier-style replay and one cross-family R0 review (Sol·high for Arm S, Opus·high for
Arm L — the computed matrix).

**Rule:** Luna keeps the `preferredBounded` rung iff (i) `accepted(L) ≥ accepted(S) − 1`
of 8 **and** (ii) `mean review rounds(L) ≤ mean review rounds(S) + 0.5`. Otherwise the
rung is demoted to *optional* (Sonnet·med becomes the default for bounded orders)
pending a ≥30-order trial. Draw proxy reported per arm; a Luna draw > 1.5× Sonnet's per
accepted order is a flag, not a gate (the plan's premise is that Luna is the cheaper
pool). n=8 → intervals are wide (8/8: 68–100); the outcome is provisional by
construction and the WO-12a gate is, per the 2026-08-28 lineup ruling, the **live
escape-rate confirmation** during shadow.

### 3.4 12e — scaffold-controlled terminal escalation

**Corpus:** 12 hard-environment tasks (`e/tasks/*.md`), each a fixture repo in a
deliberately broken state (categories, 2 each: broken build script; red CI-equivalent
test from an environment cause; toolchain/version mismatch; missing or wrong
dependency wiring; path/encoding fault on Windows; a process-lifetime fault — a hung
watcher or lock). Each task declares: scope (paths that may change), a `check`
command that exits 0 when resolved, and a budget (20 min wall clock, one attempt).
Task texts and fixtures committed before any run.

**Pairs (identical orders, identical budgets):** **Arm O** = Opus 5 · high in Claude
Code (in-harness Agent with full tools, scope-fenced by the order); **Arm C** = GPT-5.6
Sol · high under Codex (`orchestra-exec.js --model gpt-5.6-sol --effort high`).
Resolved per §1; the tree audit disqualifies out-of-scope mutation.

**Rule (the plan's, verbatim):** `resolved(O) ≥ resolved(C) + 2` of 12 **and**
`draw per resolved task(O) ≤ 1.5 × draw per resolved task(C)` → the E0 escalation rung
inverts to Opus-first (`router/castings.json` Operator `mirror` becomes the strategy-
stall target *first*; recorded as a ruling with the numbers). Otherwise the reports'
ordering stands (Sol·high → Sol·max once → Opus·high). Draw on the §0 proxy. Zero
resolved in both arms on a task marks the task construction-suspect.

### 3.5 12c — interface generation castings (reduced form)

**Corpus:** 6 static-component orders (`c/orders/*.md`) with mechanical acceptance only
(markup validity, the contrast computation the WO-10 exercise already proved, no
browser). Arms: **Sol · medium**, **Sol · high** (the primary rung's stated range), and
**Opus 5 · high** as the cross-family reference. Each output gets the Opus·high
*closing* read-only review (the E5 closing rung) plus the mechanical checks.

**Rule:** within the Sol range, medium is adopted as the default effort iff
`accepted(Sol·med) ≥ accepted(Sol·high) − 1` of 6; else high. Opus results are reported
as reference only — the plan gives E5 no Anthropic authoring mirror (declared exception
in `castings.json`), so no rule here can promote one. The render-loop half of 12c is
**not run**; its rule is pre-registered for when an environment exists: the same 6
orders re-run with the browser loop, accepted iff the closing review's render
inspection passes — until then E5's casting stays as shipped.

### 3.6 12b — Spatial primary vs mirror (deferred, rule fixed now)

The first three **real** E6 orders during WO-15 each run as a paired spike: Opus 5 ·
high (primary) and Sol · high (mirror, the agentic build-run-screenshot loop), same
order and budget, both outputs through the Verifier-style replay and the E6 critic
path if any. Rule: the mirror wins ≥2 of 3 on accepted output with ≤ the primary's
review rounds → the owner re-examines the primary casting (a ruling, not an automatic
flip — three real orders cannot carry a casting change alone). Anything else → primary
stands.

---

## 4. Execution order and evidence layout

```
wo12/
  wo12-protocol.md          this file (pre-registration)
  corpus/                   SDC: base-pool.json, key.json, <id>.patch, briefs/
  build-corpus.js           materialize a variant commit in a throwaway clone
  run-lane.js               drive one lane over a phase; records results-<lane>-<phase>.json
  score.js                  mechanical scorer (hits, recall, intervals, false-blocker prep)
  a/ e/ c/                  per-trial orders, fixtures, results
  results-*.json            verbatim verdicts + timings, one file per lane × phase
  wo12-report.md            the scored report; written only after the last phase
```

Order of operations: (1) commit this protocol + `corpus/base-pool.json`; (2) construct
the SDC (fresh-context seeder agents, one seed each, given only the base commit, the
type definition and the rubric — never the whole key) and commit `key.json` + patches;
(3) phase 0 of the SDC with the P0 check recorded; (4) 12a, 12e, 12c corpora committed,
then run under the same allowance rule; (5) phases 1–3 as windows permit; (6) score,
report, and rulings. Every trial pass's raw output is kept verbatim in `results-*.json`;
no summary replaces it. Code under `wo12/` is substantive and goes through the
cross-vendor R0 review before merge, like every other substrate in this plan.

## 5. Pre-declared limitations

- The SDC is drawn from **one repository's history**, largely authored by Claude models
  under this harness; 12f/12d results are a measurement on that distribution, not a
  general reviewer benchmark. The plan's full-qualification bar (≥100 defects or the
  live equivalent) remains the standard; this corpus is the n=30-seed provisional trial
  the power rule anticipates.
- Draw is a proxy (wall clock + bucket reading deltas), stated as such everywhere.
- Adjudication uses Opus 5 (with a Sol second opinion for NOISE) — a model judge with a
  named procedure, not a human panel; the owner may re-adjudicate any sample, and the
  WO-2 calibration precedent (10/12 REAL, 2/12 DEBATABLE, 0/12 NOISE) is the prior.
- The codex sandbox fault is intermittent; UNAVAILABLE rates are reported per lane and
  the phase-0 stop condition exists so a fault storm cannot masquerade as a lane result.
