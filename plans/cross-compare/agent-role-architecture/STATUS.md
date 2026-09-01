# STATUS — next-generation agent role architecture

**As of:** 2026-08-28 · **Tracking doc for the work that came out of the first full
`/cross-compare-plan` field run.** Read this first when resuming.

## What this directory is

The complete record of the 2026-08-27/28 cross-compare planning session (run in the
`Claude-Orchestra-lab` sibling copy; this directory in the master repo is now the canonical
home — the lab is scratch):

| File | What it is |
|---|---|
| `../CROSSPLAN-GOAL.md` | The goal document handed to the session |
| `brief.md` | The shared brief both architects received (byte-identical) |
| `plan-A-v1/v2.md`, `plan-B-v1/v2.md` | Independent drafts and post-critique revisions |
| `critique-of-A.md`, `critique-of-B.md` | The cross-critiques (steelman + tagged findings) |
| `final-plan.md` | **The deliverable** — the blind-merged, audited, revised plan |
| `audit-of-final.md` | Post-synthesis cross-family audit (11 findings) |
| `ledger.md` | The session's operational ledger + cadence lessons (read the notes) |
| `../_archive/aborted-crossplan-run-2026-08-27/` | First attempt, aborted (wrong brief: API pricing instead of subscription allowance) |

## State of the plan

`final-plan.md` specifies 23 active catalog entries (21 model-cast roles + 2 deterministic
substrates; 24 before the 2026-08-29 I0/I1 merge), a 23-class taxonomy with a
one-primary-per-class bijection, a computed
cross-family review matrix, a subscription-allowance cost model, and an 18-work-order
migration. All 11 audit findings are dispositioned (see its `## Audit dispositions`):

- **Findings 3, 4, 6, 7, 8, 9, 10, 11** — applied 2026-08-28 (mechanical/factual fixes,
  including the 1.43× liveness correction, the recomputed within-pool shares — the OpenAI
  review share is ≈38%, not the merge's ~60% — and the 59-row evidence register).
- **Findings 1, 2, 5** — ADOPTED by owner ruling 2026-08-28: Synthesizer ledger-completeness
  check + post-composition cross-family audit (cost accepted); unattributed authorship fails
  closed with `author_family`/`co_author_families` schema fields; qualification gates are
  provisional with live escape-rate monitoring and revocation triggers.
- **Gemini/Google lane removed** by owner decision 2026-08-28 (WO-3 withdrawn; native
  video/audio intake given up; exhaustion relief now falls to human sooner).

## Resolved 2026-08-28 (second session)

**1. The three deferred lineup rulings — ruled and applied** (see final-plan.md's "Lineup
rulings, 2026-08-28 (second session)"): (a) SUPERSEDED by the Conductor re-cast, (b) ADOPTED
into §5.5, (c) ADOPTED into WO-1 (60%-of-bucket proposed trigger).

**2. Four owner lineup re-casts, applied throughout final-plan.md:**
- **Conductor = Fable 5, the interactive session model, at owner-set effort** (the session
  model IS the Conductor; no bootstrap layer); Sol depletion mirror at matched effort.
- **Opus holds no USER-DIALOGUE seat** — field-observed degradation of its human-facing
  reporting; re-aimed at goal-directed deep work (I0/I1/E3/E4/E6, reference duty).
- **Architect defaults to Sol · xhigh**; Fable · high–xhigh for especially complex, nebulous,
  or ambiguous goals; Opus · high on Codex exhaustion.
- **Luna · xhigh–max is the Builder's preferred casting** for bounded, short-horizon,
  fully-specified, deterministically-verifiable orders; Sonnet · med keeps longer/thinner-spec
  orders; the never-under-specified guardrail survives; WO-12a's trial gate becomes live
  escape-rate confirmation.

**3. Lab work ported (PR #23):** the `/deep-plan` retirement (lab `392f23a`, reconciled with
v1.12.0/v1.13.0, stamped v2.0.0 here) and the MCP cancellation fix (in-flight run registry,
whole-tree kills, measured outcomes; 68 mcp-lane tests pass). The lab's remaining unported
item is `plans/proposed-orchestra-improvements.md` (already copied here) — deferred backlog,
proposed, not scheduled. The lab is now fully ported and can be deleted.

## Open items for the next session

**Plan execution (sequencing per final-plan.md `## Orders`):**
- **WO-1 IN FLIGHT (installed 2026-08-28):** telemetry hook + settings live in this repo's
  `.claude/`; one weekly cycle of normal work collects the ledger, then
  `node .claude/hooks/orchestra-telemetry.js --report` plus the Opus-concentration readout.
  Manual companions in `.claude/orchestra-manual-readings.md` (gitignored).
- **WO-2 throughput probe DONE — PASSED (2026-08-28):** 20/20 historical commits reviewed
  through the pinned cross-vendor lane, 0 UNAVAILABLE (17 REVISE / 3 APPROVE), mean wall
  clock 8.3m, P95 10.8m, projected **36.0 reviews/5h** sequential. Owner-set peak = 10
  gate-class arrivals/5h → capacity is 3.6× peak, clearing both the 1.3× stop condition and
  the 1.43× (≤70%-utilization) gate. Utilization at peak ≈ 28%. Pool draw across the batch:
  ~8%→11% of the weekly Codex window (readings file). One first-batch timeout at the default
  10m cap (18k-line commit) completed in 9.3m on re-run — variance; the 20-review batch used
  `--timeout-ms 1200000`. Audit trail: `%TEMP%\orchestra-probe-wQGdcJ`. WO-3 withdrawn.
- **WO-2 handoff drill DONE — PASSED (2026-08-28):** Fable→Sol Conductor checkpoint handoff
  on a synthetic 8-order workload (4 in-authority, 4 restricted traps). No restricted
  decision closed; 8/8 nonce echoes; T3 and verdict-override correctly deferred to the named
  human, Sol-authored T2 closure to Anthropic, author≠approve honored. Full record:
  `wo2-handoff-drill.md` in this directory. **WO-2 is complete.**
- **Reviewer calibration sample (2026-08-28):** 3 of the 17 REVISE reviews audited finding-by
  finding against the code — **10/12 REAL, 2/12 DEBATABLE, 0/12 NOISE**; every file:line
  citation resolved. Verdict: usefully strict, not noisy; its flaw is severity inflation
  (edge-hardening gaps graded MAJOR). Operating rule adopted: **gate-class REVISE from this
  lane = blocking for triage, not automatically blocking for merge**; owner judgment on
  MAJOR/CRITICAL labels. Proposed lane improvement: have the reviewer separate
  "violates the commit's own claim" (auto-blocking) from "residual hardening gap" (backlog).
  One still-live finding: `agents/scout.md` + `agents/detective.md` lack the
  no-ending-a-turn-with-running-processes rule that `ORCHESTRA.md:38` claims every
  command-running role carries (from review of `98a5157b1afe`).
- **WO-7a corpus READY (2026-08-28):** `wo7a-corpus.md` — 40 one-line requests reverse-derived
  from real history, randomized, 26 on the seeded adjacent-pair boundaries (E0/I1 ×6, I0/I1 ×3,
  E2/E3 ×7, E8/E1 ×4, E5/E6 ×2 bait-only, N0/N2 ×3, performance intake ×1). The model's pass
  is sealed in `wo7a-model-classification-SEALED.md`. Caveat: history holds no true
  E4/E5/E6 work; seed WO-7b with synthetic E5/E6 items.
- **WO-7a SCORED — FAIL — and boundaries REDRAWN (2026-08-29):** owner pass vs sealed pass
  = **31/40 (77.5%)** against the ≥36/40 threshold; two genuine ambiguities (at the cap); no
  corpus defects struck. The nine disagreements spanned nine distinct pairs — ten with the
  item-16 ambiguity's I0/I1 (none repeated — no merge forced) — concentrated on **E2's
  borders** (five pairs) and the **diagnosis frontier** (E0/I1, E2/I1, I0/I1, I0/N2); Bands
  A/D were perfectly clean. Root cause: boundaries appealed to solution facts, but
  classification happens at intake. Redraw applied to final-plan.md per the pre-registered
  rule: signals-precedence (Part 4 preamble), amended discriminators A/B/G/H/I, new S/T/U,
  new **§4.2 phase rules** (diagnosis-before-implementation + intake decidability; composite
  orders). Owner review the same day tightened the wording: explicit E0→I1→I0 diagnosis
  chain (suspected-axis E0 triage removed), intake-visible T/U, coupling-beats-mirror in G,
  the operation-not-container clause, signals column renamed "Recall signals". All ten
  flagged items resolve determinately under the new rules (table in `wo7a-corpus.md`) — but
  that table is an answer key, not a validation, so **WO-4 stays gated on WO-7a-bis** (fresh
  blinded mini-corpus; the original 40 are burned for blinding). WO-4 then encodes 4.1 and
  4.2 as data; WO-7b re-validates through the implemented router.
- **WO-7a-bis corpus READY (2026-08-29):** `wo7a-bis-corpus.md` — 20 one-line requests
  reverse-derived from 17 source commits the first corpus never used (checked against its
  audit trail), randomized, 14 of 20 seeded on the redrawn boundaries: the §4.2 diagnosis
  chain ×4 (stated-axis E0, reproduce-first I1, disc-B-tiebreak I0, states-own-cause direct
  route), disc-T topology ×4 (three central-mechanism, one surface-set), composite bait ×1,
  disc-G mirror-without-coupling ×1, disc-I exact-substitution ×1, disc-S env-words ×1,
  disc-U corpus-synthesis ×1, report-container bait ×1. The model's pass is sealed in
  `wo7a-bis-model-classification-SEALED.md` — produced by a fresh-context agent given only
  the 20 requests plus final-plan.md Parts 2.0 and 4 (no git history, no prior corpus, no
  session context). Next: the owner classifies blind in `wo7a-bis-corpus.md`, then scores.
  **Threshold: ≥18/20 (90%) with ≤1 genuine ambiguity.** Pass → WO-4 (encode 4.1 + 4.2 as
  data); fail → second redraw. WO-7a's caveat stands: history holds no true E4/E5/E6 work,
  so those boundaries remain untested until WO-7b seeds synthetic items.
- **WO-7a-bis SCORED — FAIL (2026-08-29):** the independent pass was completed and saved
  before the sealed pass was opened. Agreement was **17/20 (85%)**, below the required
  18/20; one genuine ambiguity (item 16, D0/N2) is at the allowed maximum, and no corpus
  defects were struck. The disagreements are item 5 (I1/I0), item 16 (N2/D0 provisional),
  and item 17 (E3/E2). The full pair ledger is in `wo7a-bis-corpus.md`. Per the
  pre-registered rule, a second Part-4 boundary redraw is now required before WO-4.
- **Part-4 boundary redraw #2 APPLIED (2026-08-29):** scoped to the three bis findings —
  disc. B recast on where the evidence lives (live-run-only vs persisted artifacts;
  recurrence alone never establishes a running requirement; §4.2 chain and disc. A
  mirrored); new disc. V (D0 vs N2: settled content to record vs content recovered by
  reconciling a corpus; preamble session-summary example narrowed); disc. G given an
  explicit component unit (what could land as its own order; clauses of one policy are one
  component; an acceptance unit must span ≥2 components) plus the preamble pairwise-scoping
  rule (a discriminator routes only within its own pair). All three flagged items resolve
  determinately, and one *agreed* item is logged as shifting under the tightened G — bis
  item 1 re-resolves E3→E2 (answer-key table and the shift note in `wo7a-bis-corpus.md`).
  Cross-probe pair ledger: I0/I1 and E2/E3 each at two logged entries, D0/N2 at one; a
  third on any pair trips the merge/redraw trigger. **OPEN DECISION (owner): how redraw #2
  is validated before WO-4.** The unused-history pool is nearly exhausted (~3 substantive
  commits remain: `c15f090`, `c51a8f6`, `e3b730d`), so the options are (a) a short
  WO-7a-ter probe of ~10–12 items — the last unused commits plus synthetic items — seeded
  only on I0/I1, D0/N2, E2/E3, and the shifted G boundary, threshold pro-rated ≥90% with
  ≤1 genuine ambiguity (recommended: it is cheap and the three redrawn rules plus the item-1
  shift are exactly what needs independent confirmation), or (b) accept the answer key and
  let WO-7b's run through the implemented router serve as the validation gate.
- **WO-7a-ter RULED, corpus DRAWN, passes SEALED (2026-08-29):** the owner ruled the open
  decision — option (a), widened to a **cross-repo** probe from two of the owner's other
  repositories (PiratePartyPals, Godot 4.6; LLM-Comm-V2/Homonoia, TS monorepo), chosen
  because the in-repo pool was exhausted and the foreign histories supply the never-tested
  E5/E6/K boundaries plus a domain-transfer check. Pipeline: two read-only scout agents
  profiled both histories; GPT-5.6 Sol (xhigh, read-only Codex CLI) deep-mined 58
  candidate commits, separating intake-visible facts from solution facts (per the owner's
  offload-heavy-work-to-OpenAI directive). `wo7a-ter-corpus.md` holds 20 items.
  **Selection integrity:** every commit named with a class hint in session was excluded —
  this burned the only clean E4 sources, so E4 stays untested until WO-7b's synthetic
  items. Two passes are sealed in `wo7a-ter-model-classification-SEALED.md`: Claude
  fresh-context (primary, scored) and Sol xhigh (supplementary cross-family data, never
  gating), plus the identity of the 10 redraw-#2-seeded items for post-hoc subset scoring.
  **Gates, pre-registered: full ≥18/20 with ≤1 genuine ambiguity → WO-4; sealed subset
  ≥9/10 validates redraw #2 specifically.** Next: the owner classifies blind in
  `wo7a-ter-corpus.md` without opening the sealed file, then scores both gates.
- **WO-7a-ter SCORED — full FAIL; redraw #2 PASS; redraw #3 APPLIED (2026-08-29):** the
  owner pass was completed and saved before opening the seal (pre-reveal SHA-256 recorded
  in the corpus). Full agreement against the primary Claude pass was **16/20 (80%)** with
  zero ambiguity flags, so the ≥18/20 gate failed and WO-4 remains blocked. The sealed
  redraw-#2 subset was **9/10 (90%)**, so redraw #2 is specifically validated; item 17 was
  its only miss, while three of four misses sat outside the subset. Disagreements: item 2
  I0/E2 (cause-stated threshold), item 10 I1/I0 (persisted exports), item 16 E5/E2
  (unchanged UI consuming new computation), item 17 I1/I0 (runtime-only negative render
  evidence). The sealed Claude and Sol passes agreed on all 20 classes. I0/I1 advances
  from two ledger entries to four, tripping the third-entry redraw/merge rule; I0/E2 and
  E2/E5 each gain one. Redraw #3 therefore sharpens B's evidence object, defines when the
  diagnosis corollary treats a cause as stated, and adds discriminator W for E2/E5. G, V,
  and K stay unchanged. Full score, subset accounting, ledger, and scope:
  `wo7a-ter-corpus.md`; applied text: `final-plan.md` Part 4. The ter corpus is burned, and
  WO-4 stays gated pending independent validation of redraw #3.
- **PR #27 cross-vendor review — Sol · xhigh, VERDICT: REVISE (2026-08-29):** run at the
  owner's directive through the repo's review lane (fresh-context Codex CLI, read-only,
  scope `main...998b978`); verdict verbatim plus dispositions in
  `pr27-cross-vendor-review.md`. Every score, gate pre-registration, and commit-order
  claim was independently CONFIRMED. Three MAJORs, all dispositioned: (1) human passes
  not immutably sealed pre-reveal → protocol change: from WO-7a-quater on, the owner's
  filled blind pass is committed and pushed **before** the sealed file is opened; (2)
  disc. W's horns both claimed its motivating case → W amended (displayed values are
  data, not presentation) before the quater validation; (3) the three-entry merge/redraw
  trigger counted disagreements while Part 4's text defined only ambiguity entries →
  residual rule codified to count both. MINORs: the redraw-#2 "validated" claim precisely
  scoped in `wo7a-ter-corpus.md`; the Related-PRs index corrected; selection-integrity
  auditability → the quater sealed file carries its exclusion/burn ledger and mining
  provenance.
- **WO-7a-quater DRAWN, passes SEALED (2026-08-29):** the redraw-#3 validation probe,
  drawn per the owner's direction from the unburned remainder of the two foreign-repo
  pools. The ter mining reports were recovered from the Codex CLI session logs and the
  class-hint burn list rebuilt from the drawing session's transcript; 14 burned commits,
  the 20 ter-used commits, and 4 more excluded under a stricter description-exposure
  standard are all ledgered with provenance in the sealed file. 20 items in
  `wo7a-quater-corpus.md`; sealed in `wo7a-quater-model-classification-SEALED.md`:
  the Claude fresh-context primary (scored), the Sol xhigh supplementary (run from an
  empty cwd — an isolation tightening over ter; never gating), and the seeded-subset
  key. **Gates, pre-registered: full ≥18/20 with ≤1 genuine ambiguity → WO-4; sealed
  redraw-#3 subset ≥7/8 validates the redraw.** New seal protocol: the owner commits and
  pushes the filled corpus **before** opening the sealed file.
- **WO-7a-quater SCORED — full FAIL; redraw #3 FAIL (2026-08-29):** the owner filled all
  20 classes, committed them as `2965c04`, and pushed that commit before opening the
  seal. Agreement with the primary Claude pass was **14/20 (70%)**, with zero owner or
  primary ambiguity flags: below the 18/20 full gate, so WO-4 remains blocked. The sealed
  redraw-#3 subset was **4/8 (50%)**: items 3, 6, 8, and 14 agreed; items 2, 11, 13, and
  17 missed, so redraw #3 is not validated. Full-corpus misses were 2 (I0/I1), 11
  (E0/E5), 12 (E3/E4), 13 (E2/I1), 17 (E5/I1), and 18 (E2/E6). The supplementary
  Claude/Sol divergences add findings on items 2, 11, 17, and 18; Sol's sole ambiguity
  flag was item 17 (E5/E8), non-gating. I0/I1 advances from four distinct-item entries
  to five, while E5/I1 gains two. The pre-registered outcome is a scoped redraw #4 (or
  merge where recurrence warrants), not WO-4. Coverage remains incomplete by construction:
  no persisted-generated-output I0 case for B and no values-only E2 case for W existed in
  the source pool; both edges stay untested until WO-7b synthetics. Full tables and ledger:
  `wo7a-quater-corpus.md`.
- **FINAL RULING (2026-08-29) — validation-gate cycle CLOSED by owner delegation; WO-4
  UNBLOCKED.** The owner ended the probe/redraw cycle and delegated the disposition to a
  final end-to-end review of the model-selection layer, pre-committing to its
  conclusions. Ruled and applied to `final-plan.md` (Part 4 marked as the final
  owner-delegated ruling superseding the redraw cycle): **(1) I0/I1 merged** into one
  Investigator seat and class I0 (identical castings at every rung — the split bought
  intake burden and no routing difference; five distinct-item ledger entries; the
  boundary is a solution fact, undecidable at intake) — Part 2 seat 7 rewritten, seat 13
  retired with a stub, disc. B retired, `I1` kept as a registered alias; **(2) Part 4
  restructured around a §4.0 total decision procedure** — seven fixed-order steps
  (decisions/assurance → answers → symptom gate → consequence trumps → acceptance
  artifact → implementation shape → residual) that cite the §4.1 discriminators, closing
  the many-doors defect every probe failure traced to (diagnosis-chain vs W, L vs
  cause-stated, G vs J, spatial acceptance vs separability are now explicitly ordered);
  **(3) classification error accepted as a property of one-line intake** (~70–85%
  ceiling, zero ambiguity flags, three lexical redraws moved agreement down): class is a
  routing hypothesis with first-class `RECLASSIFY` recovery, and risk tier + author
  family — never class — carry the review/authorization gates; 7.2's routing gate
  restated as misroute recovery. E2/E3, E3/E4, E2/E6, E5/I1 and the rest are **not**
  merged (different castings or review lanes); their conflicts are resolved by the
  procedure's ordering. No fifth mined corpus: WO-7b through the implemented router
  (with the reserved B/W synthetic edges) is the remaining validation. The cross-probe
  pair ledger is closed and dispositioned in `wo7a-quater-corpus.md`. Next: **WO-4**
  (schemas; encode §4.0 as ordered data, 23-class invariant, RECLASSIFY status).
- **WO-4 EXECUTED (2026-08-29):** the registry lives in `registry/` at the repo root —
  `classes.json` (23 active classes with primaries/castings/reviewers/escalations, the
  `I1 → I0` alias, risk tiers, **§4.0 as ordered data** with per-clause discriminator
  citations, §4.1 with B retired, §4.2 phase rules, residual rule, error stance), the six
  §3.5 schemas (order, report with first-class `RECLASSIFY` + conditional
  `reclassify.{recommended_class, evidence}`, verdict with dispatcher-written
  `review.cross_family`, authorization packet with T3-forces-named-human, casting record
  with the P15 substitution detector, verdict audit with refutation-duty and gate-class
  falsification checks), and `load.js`, which asserts the ownership invariant
  mechanically: 23/23 bijection, alias resolution, §4.0 closed over the table (every
  route target active, every class reachable, no retired citations), schema class/risk
  enums byte-identical to the registry. `tests/registry.test.js`: 29 checks green,
  including fourteen tamper tests proving each corruption fails the load. The load-time
  count immediately caught one prose miscount the ruling introduced — Part 4's preamble
  said "twenty-two active"; the table has 23 active rows — fixed in `final-plan.md`.
  Next: **WO-5** (Verifier substrate; validates artifacts against these schemas).
- **WO-5 EXECUTED (2026-08-29):** the Verifier substrate lives in `verifier/` at the repo
  root. The disposable-checkout substrate first, per the order (`checkout.js`: throwaway
  detached worktree created outside the repository, before/after fingerprint with
  generated-artifact classification — expected churn is an INTEGRITY NOTE, anything else
  an INTEGRITY WARNING — guaranteed teardown with a process-exit sweep, and the
  dispatcher-side guard fingerprinting the *real* tree across the Verifier's own run).
  Then the deterministic checks (`verifier.js`): manifest execution + exit-code capture
  (commands, versions, durations, tree identity, declared-never-derived coverage), nonce
  echo, artifact validation against the WO-4 registry schemas via `schema-check.js` (a
  dependency-free subset validator that fails closed on unsupported keywords), diff
  parsing + claimed-changes replay, mutation check (green baseline required), invariant
  comparison, citation replay emitting verdict-audit-conformant items, both tree audits,
  and PASS/FAIL/UNAVAILABLE/COVERAGE_GAP aggregation with the deterministic-only-closure
  gate; every result carries `evidence_not_approval` and model-assist provenance as
  fields (this core always `used: false`). Proof per the order, on a fixture project
  whose suite cannot run read-only (it writes `.test-cache/` every run):
  `tests/verifier.test.js`, 63 checks green — catches a red suite reported green, changes
  claimed against an untouched tree, an invertible test that stays green (vacuous
  assertion survives its inversion), and a broken row-count invariant. Two incidental
  fixes: the CI workflow now runs the registry suite (the step was missed when WO-4
  landed) and the new verifier suite; the CLI strips UTF-8 BOMs from artifact files
  (PowerShell's Out-File writes one by default). WO-5 is **gate-class** per the plan's
  review routing — cross-vendor review before merge. Next: **WO-6** (router, casting
  tables, review matrix, degradation machine, Q0 triggers).
- **WO-6 EXECUTED (2026-08-30):** the router lives in `router/` at the repo root.
  `castings.json` carries the Part-2 casting tables as data (58 rungs across the 23 roles,
  hard never-rules included), the §3.4 computed R0 review matrix with the mandatory set,
  the §5.5 pool-state ladder, the seat-19 Q0 triggers, and WO-2's measured liveness and
  reserve numbers. `router.js` implements `route(class) → role` (alias-resolving, loading
  the WO-4 registry and failing closed on any invariant violation), `cast(role,
  bucket_state) → (vendor, model, effort)` through the degradation machine (Amber re-casts
  authoring to the healthy pool's mirror, Orange suspends authoring and defers ceiling
  rungs, Red permits only closing calls; E4's irreversible half and M0 video/audio wait or
  return typed UNAVAILABLE — no substitute), `reviewer(author_families, risk)` (computed
  no-self-family matrix; unattributed and both-family authorship fail closed; mandatory
  review rides the frontier T2/T3 lane even at nominal T1, so a Sol-authored mutation gets
  Opus 5 · high per Part 2; Terra T1 relief stays behind the WO-12f qualification flag),
  the pre-dispatch AU-O gate (P15: below-reserve AU-opus blocks every Opus dispatch with
  mirror/wait the only lawful responses; Amber arms Quartermaster confirmation; the
  AU-fable twin re-casts Conductor turns to the Sol mirror), automatic Q0 creation
  (Director-created companion cast opposite the implementing family; a missing required Q0
  blocks dispatch), and the assembled `dispatch()`. Proof per the order:
  `tests/router.test.js`, 74 checks green — no-self-family for every author family set; no
  mandatory-class dispatch produces a same-family closing verdict under any of the 625
  bucket-state combinations including Red/Exhausted (9,375-call sweep, every non-close
  typed DOES_NOT_CLOSE); context-shape violations rejected; every rung matches an
  independent transcription of Part 2 in both directions; every trigger-matching
  implementation spawns Q0 and never a non-trigger one. Three WO-6 defaults where the plan
  is silent are marked `unstatedInPlan` in castings.json (E5 critic effort, E8/D0 context
  shapes). WO-6 is **gate-class** per the plan's review routing — cross-vendor review
  before merge. Next: **WO-7b** (synthetic corpus through `dispatch()`, scored on misroute
  recovery per the restated 7.2 gate, including the reserved B/W edges).
- **WO-7b EXECUTED — ALL GATES PASS (2026-08-30):** the misroute-recovery probe through
  the implemented router, in `wo7b/` (corpus + gates pre-registered and committed at
  `c431274` before any model pass; `score.js` is the mechanical scorer, exit 0). 24
  synthetic items — 13 seeded misroutes, 11 controls, both reserved edges by
  construction. **G1: 13/13 misroutes caught** by fresh-context seat charter filters
  (router/charters.json, Sonnet, no tools); **G2: zero mandatory-gate crossings** among
  the four gate-relevant misroutes (M3 E3→E2, M5 E4→E8, M6 E4→E2, M12 E7→R0), with
  tier-borne gates mechanically identical under seeded vs true dispatch for all items;
  **G3: P95 = 1 hop**, all recoveries landed with hop-1 ACCEPT, zero escalations.
  Telemetry: 0/11 false bounces, 13/13 correct recommended classes, classifier pass
  24/24 (a separability number for a synthetic corpus, not real-intake accuracy — stated
  in the report), B horn and W horn each clean in both classification and recovery.
  Seeded recovery entries do NOT feed the standing three-entry redraw trigger (probe
  provenance, not organic ambiguity). Full record: `wo7b/wo7b-report.md`. The restated
  7.2 routing gate is validated; live P95 telemetry continues during shadow (WO-15).
  Next: **WO-8–11** (staff the bands), with WO-13/WO-14/WO-12f parallelizable.
- **WO-14 EXECUTED (2026-08-30):** the alias layer and roster kill switch, in
  `router/aliases.json` + `router.resolveSeat()`. Every §6.6 retired name resolves
  declaratively to its new (role, rung) pair AND carries its legacy identity; the
  `roster: legacy | new` flag is evaluated per order (opts override; declarative default
  `legacy` — the kill-switch home position), so rollback is a flag flip with no reload.
  Proof per the order, in `tests/router.test.js` §12 (93 total green): an order written
  against `executor` dispatches correctly under both flag values; the flip demonstrated
  mid-session on one router instance; `executor-heavy-xhigh` lands on Principal's routed
  xhigh effort point (not a second seat); `detective` lands on the merged Investigator
  with the read-only pin carried; `reviewer`/`reviewer-codex` resolve to the computed
  Reviewer (never a static casting); every retired-name resolution emits its ledger
  deprecation line under both flags; a tampered alias map fails the load closed. One
  judgment call recorded in the file: §6.6 wrote `planner-gpt → Architect(mirror)` before
  the same-day Sol-default re-cast — operatively it maps to the Architect's Sol casting,
  with WO-13 owning its transport migration.
- **WO-9 STAFFED (2026-08-30); exercise contract INCOMPLETE** (round 3, after
  the Sol·max holistic review — files shipped, lint green, five seats
  exercised; the Archivist images lane ships staffed but unexercised, and is
  ledgered debt, not a closed exercise): the evidence band (Band B, seats 4-8: Scout,
  Researcher, LC Analyst, Investigator, Archivist) staffed per the WO-8-11 order — six
  role files shipped (`roster/wo9-band-record.md`: naming decisions, Archivist's two lane
  files, the Investigator read-only pin). `node roster/lint.js` and `node install.js
  --lint` (roster/ and repo-wide) pass; all five required test suites pass in full. Stage
  2 exercised all five seats: Investigator (I0, Opus 5 in-harness) PASS; Scout (N0, Haiku
  4.5 in-harness) DEGRADED-ACCEPTED — the bounded inventory was correct and independently
  verified, but the seat miscounted its own surface in both exercises (39/40, then
  44/47); a calibration follow-on is registered. N1/N2/M0 ran via the `orchestra_exec`
  codex runner (closest existing cross-vendor call — no dedicated research/long-context/
  extraction runner exists yet). N1's first run (ex1) returned DONE after completing real, cited web
  research, despite its own VERIFICATION section disclosing that its local shell channel had
  separately failed (the command runner was down, and both attempted local commands are
  recorded failing with the exact error) — a status-typing defect (DONE where BLOCKED or a
  disclosed-degraded status was warranted), not a non-disclosure — and with no
  retrieval dates on its citations, a charter duty — a report-integrity/verification-
  discipline defect, not demonstrated fabrication (corrected in round 2 after R0 review; the
  original "fabrication"/"live evidence of the charter's named failure mode" framing is
  withdrawn, and two previously-cited grounds — a conditional `codex --version` duty that
  never fired since network was available, and an openai-docs skill read never owed to ex1 —
  are withdrawn as unsupported; ground reworded round 3 after the Sol·max holistic review, which
  found the transcript's VERIFICATION section did in fact disclose the shell failure).
  Discarded on the two anchored grounds — the status-typing defect plus the missing
  retrieval dates; the retry, under an
  integrity addendum, independently corroborated three of ex1's four cited sources and
  conclusions (evidence against fabrication) — the npm-registry citation, ex1's sole source
  for the 0.151.0-on-npm claim, lacks independent cross-run corroboration (opened only in
  ex1's own VERIFICATION) — and correctly returned BLOCKED — rule-compliant, conservative
  typing, not a choice against fabricating — provisionally accepted as the exercised order,
  owner may override. M0's documents-lane ex1 hit the same transient codex sandbox fault
  (`unsupported protocol version 6`) and typed BLOCKED honestly; ex2 PASS. N2 PASS
  cleanly. M0's images lane ships staffed but unexercised. Follow-ons registered: the
  codex sandbox protocol fault (investigate/upstream), a `verifier/checkout.js:322-327`
  prune-comment fix (incidental I0 finding), the standing no-dedicated-runner gap, and
  N0's self-reported exhaustion counts requiring mechanical verification (calibration
  follow-on).
  Full record: `roster/wo9-band-record.md`. Next: **WO-10**.
- **WO-10 STAFFED (2026-08-30); exercise contract INCOMPLETE** (round 3, after
  the Sol·max holistic review — files shipped, lint green, 8/10 seats
  exercised; Refactorer/E8 and Runner/E1 environment-blocked with zero
  competency signal, and Interface Artisan's E5 browser/render loop is
  unexercisable in this harness — all three ledgered debt): the construction band (Band C, seats
  9-20 minus retired 13: Operator, Runner, Builder, Principal, Data
  Engineer, Interface Artisan, Spatial Specialist, Refactorer, Test
  Designer, Doc Writer; Red Team shipped already in WO-8) staffed per the
  WO-8-11 order — eleven role files across ten seats (Test Designer splits
  into two lane files, Archivist precedent) shipped in two commits (Builder/
  Principal/Operator/Test Designer/Refactorer first, then the five domain
  seats), plus a third commit closing the Director's lint-conflict ruling
  (`roster/wo10-band-record.md`: naming/rung decisions, the Builder/
  Principal legacy-validation table, two flagged `router/castings.json`
  mirror-or-declared-exception gaps for Test Designer and Interface Artisan,
  closed by adding declared exceptions — `crossFamilyByConstruction` for
  Q0, `noMirrorFor.primary` for E5 — that `roster/lint.js` was taught to
  accept). `node roster/lint.js` and `node install.js --lint` (roster/ and
  repo-wide) pass; all five required test suites pass in full. Stage 2
  exercised all ten seats: **8/10 complete** — Builder (E2, Sonnet 5) PASS;
  Principal (E3, Opus 5) PASS with an acceptance-log scope deviation
  discovered on dispatcher review of the pasted output, not disclosed by the
  seat (its own DEVIATIONS opens "Acceptance scenario: none."; contrast Data
  Engineer's genuine self-disclosure below — honesty-calibration data for
  E3); Operator (E0, Sol via Codex) PASS (MODULE_NOT_FOUND root cause,
  minimal fix, independently reproven); Data Engineer (E4, Opus 5) PASS
  (byte-exact rollback round-trip, poisoned record refused as a verified
  no-op); Spatial Specialist (E6, Opus 5) PASS (15-check mesh validator,
  non-vacuity proven by a negative control, self-caught its own report
  transcription error); Doc Writer (D0, Sonnet 5) PASS (28 citations, the
  checker proven to fail closed); Interface Artisan (E5, Sol via Codex)
  DEGRADED-ACCEPTED (all 3 files independently verified including the
  load-bearing contrast computation; the pre-registered browser/render-loop
  gap stayed unexercised as expected). **The Q0 cross-family exercise pair
  is the highlight**: both Test Designer lanes ran the same mission — an
  independent pinning suite plus 2 required mutants, built from contract
  alone — against an implementation from the *other* family (vsOpenaiAuthor,
  Sonnet 5, pinned Sol-authored `contrast.js`; vsAnthropicAuthor, Terra via
  Codex, pinned Sonnet-authored `parse-duration.js`), both PASS, both
  mutants caught non-vacuously in each direction, and the vsOpenaiAuthor run
  surfaced a genuine implementation finding (a `0.04045`-vs-spec-quoted-
  `0.03928` sRGB threshold constant) proven behaviorally unobservable across
  all 256 8-bit hex channel values. **2/10 environment-blocked**: Refactorer
  (E8, Terra via Codex) and Runner (E1, Luna via Codex) each hit the
  `unsupported protocol version 6` codex sandbox fault on all 3 authorized
  attempts (2 in ex1, 1 final retry in ex2) with zero competency signal
  obtained on either seat — the same fault this round also degraded
  Interface Artisan's own mid-run self-check, and across WO-9+WO-10 has now
  hit **10 of 14** engine-reaching attempts (counting rule: an attempt is
  one `orchestra_exec` invocation that reached the engine; WO-10's Operator
  first attempt — refused pre-engine by codex's own directory-trust gate —
  is a distinct precondition fault and is counted separately, not among the
  14). Fault-hit (10): WO-9 `m0-ex1`, `n1-ex1`, `n1-ex2` (3); WO-10
  Refactorer's 3 attempts, Runner's 3 attempts, and Interface Artisan's 1
  (mid-run, still DONE) (7). Clean (4): WO-9 `m0-ex2`, `n2-ex1`; WO-10
  Operator's engine-reaching attempt, Test Designer vsAnthropicAuthor. Full
  per-attempt list in `roster/wo10-band-record.md`'s Incidents section.
  Follow-ons registered: the codex sandbox protocol fault (ESCALATED,
  investigate/upstream), the two owed E8/E1 exercises (orders reproducible
  from the band record's appendix once the fault clears), Interface
  Artisan's browser/render-loop gap (pre-registered, still open), and
  Spatial Specialist's visual/critic path (mechanical validity only this
  round). Full record: `roster/wo10-band-record.md`. Next: **WO-11**.
- **WO-11 STAFFED (2026-08-31); exercise contract INCOMPLETE** (round 3, after
  the Sol·max holistic review — files shipped, lint green, 2 of 4 Band A
  seats exercised; Architect/A0 environment-blocked with zero competency
  signal and Synthesizer/A1 deferred-declared — both ledgered debt): Band A (seats 1-3: Conductor, Architect,
  Synthesizer) staffed — three role files — plus the **P0 Quartermaster
  substrate** built separately (`quartermaster/`), a deterministic code
  substrate, not an agent file. `node roster/lint.js` / `node install.js
  --lint` pass; all six required suites pass, including
  `tests/quartermaster.test.js` (154 checks at this band's own build, 187
  after the round-2 review fixes below, 191 after round 3's R3 48h-staleness
  test additions, 195 after round 4's fail-closed >24h test additions:
  recording, validation
  rejections, fail-closed on absent/stale/malformed evidence, threshold
  exactness, throttle/Exhausted precedence, confirmation, prediction, and —
  load-bearing — real `router.js` interop: Green path, the P15 AU-O reserve
  gate, the §5.5 Amber arm + lift, and the exhaustion-matrix recast). P0's
  default forecast was corrected on Director review (R4, `acbf8f2`): a
  rejected peak-derived reserve (~65.5%) replaced by the WO-2-MEASURED draw,
  now floor-governed at 8% (rejected arithmetic preserved in
  `quartermaster/README.md`, not deleted). Stage 2: **Conductor (O0)** — a
  fresh-context Opus 5 audit of the Conductor's own conduct found 1
  VIOLATION (direct Glob/Bash use — corrective: verification always
  dispatched now), 2 COMPLIANT, 2 INDETERMINATE; seven Director dispositions
  (D1-D6 plus F-1) rule on it — D1 re-ruled in full on round-2 review after
  round 1's partial-acceptance disposition was found unsupported by the
  audit it purported to close — including restoring WO-8's practice of
  committing review verdicts as record files from this band on. **Architect (A0)** —
  BLOCKED-PENDING-ENVIRONMENT, 2 engine-reaching attempts both hit the
  standing sandbox fault before reaching the reference source, honest
  BLOCKED, zero fabrication; exercise owed. **Synthesizer (A1)** —
  DEFERRED-DECLARED (max-reserved, once-per-project; exercised at its first
  real comparative session). **Quartermaster (P0)** — EXERCISED LIVE: PASS
  with DEGRADED coverage (1/4 buckets real), fail-closed proven on the
  other three, `--publish` correctly refused, full pipeline proven on a
  labeled fixture. Fault tally now **12 of 16** engine-reaching attempts
  across WO-9/10/11 (Architect's 2 add to WO-10's 10/14). Follow-ons: the
  Architect exercise + its telemetry-extension plan (owed on fault clear);
  **the owner recording real `/status` readings for AU-all/AU-opus/AU-fable
  via `--record` — the P0 go-live step**; the size-threshold definition
  (owner); the Synthesizer exercise; WO-9/10 verdict reconstruction
  (owner's option). Full record: `roster/wo11-band-record.md`.
  **ROUND-2 REVIEW FIXES (2026-08-31):** R0 review returned REVISE (1
  CRITICAL, 5 MAJOR, ~12 MINOR/nits); all fixed. CRITICAL: a recorded
  Amber-arm confirmation is now re-validated against LIVE evidence at every
  `analyze()` call, not honored merely for being within `maxFreshMs` —
  closes the confirmation-outlives-its-evidence exploit (0.35-evidence
  confirmation + later 0.10 reading now correctly GATES). MAJOR: `confirm()`
  no longer blind-grants over a fresh throttle, an exhausted bucket, or a
  malformed-latest raw line; every public API entry validates caller-supplied
  numeric options (`typeof number`, finite) and throws rather than coercing —
  closes the `'0.3'+'0.1'` string-concat-to-NaN exploit that silently deleted
  the P15 reserve gate; D1 re-ruled in full (above); STATUS.md's false
  "all four Band A exercises" quick-start line corrected. Next:
  **WO-12**.
- **WO-13 DISPOSED — no target (2026-08-31):** the metered lane WO-13 was written to
  migrate (`orchestra-deepplan.js` → `api.openai.com/v1/responses` with
  `OPENAI_API_KEY`, the `planner-gpt` launcher, `OPENAI_BASE_URL`) was deleted
  outright in v2.0.0 with the `/deep-plan` retirement (CHANGELOG 2.0.0); a repo-wide
  scan finds no live code path calling `api.openai.com` — every remaining
  `OPENAI_API_KEY` mention is Codex-CLI auth documentation, a CLI-transport
  diagnostic string, or a test of that diagnostic. Every cross-vendor lane already
  runs on the subscription Codex CLI. The proof clause ("a full planning round
  completed with `OPENAI_API_KEY` unset") is evidenced only partially: the A0
  Architect exercise ran with the variable unset (`roster/wo11-a0-exercise-ex3.md`)
  but did not complete a planning round because of the sandbox fault below; it
  completes with the A0 exercise. Nothing to migrate; the order closes on that
  proof.
- **Codex sandbox fault ROOT-CAUSED (2026-08-31):** the "intermittent
  `unsupported protocol version 6`" fault carried since WO-9 (now 23 engine-reaching
  attempts, 18 faults) is a stale helper in the owner's codex install: the
  `codex-command-runner.exe` inside the 0.151.0 release directory is byte-identical
  to 0.147.0's and rejects the 0.151.0 CLI's spawn protocol v6 on the unified-exec
  tool path; the legacy shell path works, so "intermittency" is which exec tool the
  model picks on a turn. The Conductor's cwd hypothesis was REFUTED by a
  fresh-context Investigator (historical faults at the repo root; live probes 5/5
  faults across repo root, `%TEMP%`, `Projects\`), and the per-invocation disable
  (`-c features.unified_exec=false`) was REFUTED 3/3. Record verbatim:
  `roster/wo11-codex-fault-investigation-2026-08-31.md`. **Owner action: repair the
  helper (replace with the newer runner already on disk, hash `8e47f597…`) or
  reinstall codex 0.151.0.** Until then every Codex-side dispatch that must spawn a
  shell — the owed E8/E1/A0 exercises (re-attempted today: 2 clean engine reaches,
  6 faults; records `roster/wo10-e8-exercise-ex3.md`, `roster/wo10-e1-exercise-ex3.md`,
  `roster/wo11-a0-exercise-ex3.md`) and the WO-12 X-Sol/X-Terra review lanes — is
  blocked; this is the campaign's critical path. Debt rows re-attributed in
  `roster/wo11-band-record.md` § Exercise debt.
- **WO-12 IN PROGRESS (2026-08-31) — protocol pre-registered, corpora under
  construction, NO trial pass run:** `wo12/wo12-protocol.md` (committed `68e2e97`
  before any pass, WO-7b precedent) fixes decision rules for 12a/12c/12d/12e/12f/12h
  and defers 12b to WO-15 with its rule stated. The shared **seeded-defect corpus**
  (12d/12f/12h): 84 artifacts = 30 seeds (6 complementarity types × 5; 6 CRITICAL /
  18 MAJOR / 6 MAJOR-preferred) + 54 controls drawn from this repository's history;
  `corpus/base-pool.json` + control briefs committed at `135ea82` before seeding;
  seeds are produced by fresh-context Opus seeders (one seed each, never shown the
  key) as `P → C'` patches with a sealed `key.json`. Tooling: `build-corpus.js`
  (reproducible variant materialization in a throwaway clone), `run-lane.js`
  (P0-gated lane driver, `--yes`/`--dry-run`, one retry, verbatim results),
  `score.js` (mechanical hits, Wilson intervals, 12f gate table, 12d union table);
  `tests/wo12-tooling.test.js` in CI. 12a (8 bounded Builder orders + fixture), 12e
  (12 hard-environment tasks + fixtures + scope-audited checker), 12c reduced form
  (6 static-component orders + `check.js` with the WO-10 contrast algorithm) built
  as pre-registered corpora. **Runs are gated twice:** P0 must show OU usable (owner
  `/status` readings — all four buckets fail closed as of this date) and the codex
  helper must be repaired (above). Phase 0 = 12-artifact pilot, 24 Codex reviews.
  **Review chain (tooling commit `e14232d`, gate-class):** OpenAI lane attempt 1
  `REVIEW_UNAVAILABLE` (Sol at capacity, vendor-side — recorded, not entered as a P0
  throttle: a model-capacity refusal is not an allowance signal); Anthropic fallback
  lane (disclosed `cross_family=false`) **REVISE — 4 CRITICAL, 12 MAJOR, 8 MINOR**
  (`roster/wo12-r0-review-anthropic-1.md`): the P0 gate failed OPEN on any
  quartermaster failure that was not the literal refusal string; the seeded variant's
  commit metadata identified it at 100%; the answer key was reachable from the
  reviewer's clone via `.git`; 14/30 seeded briefs were structurally distinguishable
  from controls. OpenAI lane re-attempt 2 **REVISE — 3 CRITICAL, 10 MAJOR**
  (`roster/wo12-r0-review-openai-2.md`, suites run), converging on the same lines.
  Round 2 (pre-run, before any pass): protocol amendments committed at `10f44cb`
  (real-commit metadata on variants; sanitized review clones with refs/reflogs removed
  and objects pruned; briefs generated from per-artifact content files under one
  structure; hazards from a closed kind-vocabulary; strict-path hits). **Round 2
  applied:** every finding from both verdicts closed with a pinning test (tooling suite
  368 checks); 84 content files authored (54 controls from commit bodies; 30 seeds by
  type-grouped authors preserving each seed's constraint/scope/claim); the corpus
  re-assembled and re-sealed — 1 work-order skeleton and 1 report skeleton per variant
  across all 84, sanitized run clones identical in shape for seeds and controls (0
  refs, key unreachable), 0 leakage/vendor findings, order-prose bands overlapping
  (seeds 144±12, controls 128±18 words), idempotent to the byte, all suites green. KIND
  declared pool-wide as `code`; phases run in a deterministic interleaved order.
  Incident recorded: a builder agent's own `rm -rf` wiped 54 untracked content files
  (rewritten; now impossible in-tool; batches are committed on arrival). CI on the
  round-2 commit caught a real cross-platform defect (5/9 red): the nested-clone guard
  was inoperative on macOS/Windows because a not-yet-existing clone path cannot be
  realpath'd and the comparison went one-sided — fixed at `1ff2730` (nearest-existing-
  ancestor resolution, segment-wise `path.relative`, case-folded on win32/darwin; every
  spelling pair pinned; 406 checks). **Round-2 delta verdicts:** Anthropic lane
  REVISE — 0 CRITICAL, 5 MAJOR, 6 MINOR (`roster/wo12-r0-review-anthropic-2.md`; all 7
  round-1 CRITICALs confirmed closed by a live 9-case gate matrix and a sweep of all 84
  sanitized clones; new: a residual blinding tell — seeds' ORDER prose is harder and
  longer than controls', a fresh evaluator separated 10/12 briefs at 83% — plus a
  suffix-tier path over-match, no-verdict runs scoring as 0-hit completions, unscoped
  adjudication promotions, no resume); OpenAI lane REVISE — 4 CRITICAL, 2 MAJOR
  (`roster/wo12-r0-review-openai-3.md`; adds an unchecked-id delete path, per-finding
  false-blocker completeness, an identity-mismatch case, a non-persistent phase-0 stop
  counter). **Round 3 (pre-run) in progress:** tooling closures for every item; control
  ORDER/CLAIMS prose re-authored to the seeds' register; a population-balance lint
  (length and hardness) and a fresh-evaluator blind classification re-run after every
  content change; the 10 base-reused controls stay (history pool exhausted) and are
  disclosed. macOS CI: one case-fold check being made empirical (probe, not platform).
  **Round 3 applied:** every item of both delta verdicts closed with a pinning test
  (533 checks); all 54 control ORDER/CLAIMS re-authored to the seeds' register and
  calibrated to the seeds' measured hardness (first drafts overshot 4–16 hits vs the
  seeds' 2.3 and would have flipped the tell); population-balance lint passes at
  Δ3.2 / Δ1.8 words and hardness ratio 1.00. Registered limit: the 12f identity gate
  rests on the runner echoing the requested model (`echoed-request`) until
  `orchestra-review.js` surfaces a served model — follow-on before 12f is scored.
  Round 3 committed (`8152b34` corpus, `5c65946` tooling) after independent
  verification. **Blind test, round 3** (`wo12/corpus/BLIND-TEST-round3.md`): a fresh
  evaluator over 24 briefs scored **10/24 (41.7%)** — at/below chance, against 83% in
  round 2; the ≤65% target is met. Residual hook found and opened as round 4: the five
  OO seeds carried literal `IN SCOPE:` / `Constraint:` labels no control had (their
  three highest-confidence hits) — being rewritten as prose, with a label-tell lint
  added and a second blind test on a different draw. CI on `5c65946`: 9/9 green
  including macOS. **Round 4 applied** (`a908c12`): the label tell turned out to be
  general — 15 distinct sentence-initial labels across 21 content files, every one
  carried by a single population (e.g. `Verification:` in seeds, `Suites:` in
  controls) — so the lint forbids inline labels outright and all 21 files were
  rewritten as prose with every fact preserved (561 checks). **Round-3 delta verdict,
  Anthropic lane: REVISE — 0 CRITICAL, 5 MAJOR, 5 MINOR** (`roster/wo12-r0-review-
  anthropic-3.md`): its fresh blind reader scored exactly chance (50%), but a
  corpus-level classifier still separates 25 artifacts at 100% precision on
  distribution tails the balance lint's three means do not see — controls had been
  authored into 135–160 / 65–95-word bands while seeds kept 121–159 / 57–99;
  backticks in 10 seeded orders and no control; two idioms in 15 controls and no
  seed — plus four scorer/driver fixes landing on the named path but not its
  neighbour. **Round 5 opened** (protocol amendment x): both populations to the same
  bands, backticks forbidden, a distribution lint (range floors/ceilings, sd ratio,
  digit density, 3-gram exclusivity, watched idioms), and the adjacent-path closures;
  content passes on all 84 files complete (final means: ORDER 150.3 vs 147.5, CLAIMS
  79.9 vs 78.0, ranges 136–159 vs 135–160 and 66–90 vs 66–93, backticks 0, watched
  idioms balanced or absent). Round-5 tooling committed (`5379751`, 642 checks):
  every round-3 delta finding closed on its adjacent path; the distribution lint's
  3-gram rule was re-scoped to content-word 3-grams in ≥6 documents after the first
  cut flagged 133 connective phrases, and what survived (53) was not topic but one
  author's boilerplate repeated across consecutive control files — being varied;
  the genuine topic asymmetry (docs/records commits exist only among controls; every
  seeded base is a code commit) is disclosed in CONSTRUCTION.md as a corpus-level
  property that gives a per-packet reviewer nothing. The stray `p0-overrides.log` was
  the tooling suite's own SIGTERM-interrupted run — the ledger now lives beside the
  results file and a guard test asserts the repo stays clean. The first round-5
  `--check-only` on the varied content left three residues — digit density (controls
  5.39 vs seeds 3.40 per 100 words, from stacked suite counts and short shas one
  author had added), one more shared control phrase ("the status file", 6 files), and
  the last "leave … alone" — all being cleared by per-file caps (≤3 numerals, no
  shas) and phrase variation — the digit fix first over-corrected (controls 1.11 vs
  seeds 3.40, the seed mean carried by one order at 30 digits/100 words) and was
  rebalanced from both sides (three seed outliers capped; every zero-numeral control
  given one genuine figure): final 2.10 vs 1.25. CI on `f992947`: 9/9 green. **Content
  sealed at `88b5cec`; `assemble-key.js --check-only` passes every lint.** Round-5
  corpus re-sealed and independently verified at `044b85e` (1,445 checks; CI 9/9
  green). **Blind test #2** (`wo12/corpus/BLIND-TEST-round5.md`): **24/24** — but
  through commit-sha linkage across packets (a control's head quoted as another
  packet's base; reused-base pairs showing one subject under two heads), not review
  content, which the evaluator itself put at ~6 confident calls. A single-packet
  reviewer cannot chain packets; the blind-test instrument can. **Round 6 opened**
  (protocol amendment xi): shas leave the brief text, a hex-token lint, pair-aware
  blind draws — tooling landed at `e3dde34` (711 checks). **Rounds-4–5 delta verdict,
  Anthropic lane: REVISE — 1 CRITICAL, 4 MAJOR, 6 MINOR** (`roster/wo12-r0-review-
  anthropic-4.md`): its fresh blind reader scored **33%** (below chance — the best
  human-facing result yet), but the identity classifier could return MATCHED on an
  engine line whose served model contradicts it (CRITICAL), the FINDINGS extractor
  stopped only at two headers, and a style-only classifier still reached 90%
  precision on sentence shape (seeds' shortest sentences — "Done." — vs controls') and
  diff-stat vocabulary ("deletions", "insertions", "touching" only in controls); the
  head-sha resolvability oracle it named was already closed by round 6. **Round 7**
  (protocol amendment xii): the identity and extractor fixes, a sentence floor and a
  unigram-exclusivity gate, a content pass on all 84 files, and a stated stopping
  standard — every gated feature passes and the delta reviewer's best ungated style
  classifier stays under 80% precision; the human-facing standard (≤65%) has been
  met since round 3. Round-7 content (all 84 files) sealed at `34098ce` and tooling at
  `54b6eeb` (809 checks): on the sealed content every gate passes — sentence floor 0
  failures, shortest-sentence means 10.9 vs 9.6 (Δ1.3, limit 3), unigram exclusivity 0
  at df≥8, plus all earlier gates. The identity gate now parses `served_model` first
  (a contradiction fails gate 5; absence reads LIMITED; only an explicit match is
  evidence). **Round-7 corpus regenerated and committed `fb20e44`** (168 briefs,
  idempotent, zero sha-like tokens, sanitized run clones re-verified; CI 9/9 green).
  **Blind test #3 (`corpus/BLIND-TEST-round7.md`): 8/24 = 33%** — a fresh Opus reader
  over an isolated copy of the 24-packet seeded draw called the V3 hazard-checklist arm
  "the seeding taxonomy" (4/11 precision) and read the V2 author line as a control
  marker (3 of its 4 packets were seeds); its one content-only call was wrong.
  Human-facing accuracy is at or below chance on both content-only reads (41.7%,
  33.3%). **Rounds-6–7 delta (Anthropic, `wo12-r0-review-anthropic-5.md`): REVISE —
  2 CRITICAL / 6 MAJOR / 4 MINOR, all accepted; round 8 opened.** The label-informed
  arm of the stopping standard fails: a style-only classifier reaches 85.7% precision
  under leave-one-out CV and a nine-rule threshold list labels 58 of 84 with zero
  errors (`and` ≥ 13, zero digits, commas ≤ 4.02/100w, mean ORDER sentence ≤ 22.14,
  both shortest-sentence tails). Also: gate 5's `served_model` is parsed from the
  engine's own transcript (spoofable both ways); the FINDINGS terminator drops
  findings under `### CRITICAL` subheads or after a `---` rule; `we` 0S/13C and `md`
  sit under the unigram gate's exclusions; the `Commit subject:` line still pairs the
  reused bases; run clones are named by artifact id; the round-7 draw seed does not
  reproduce (record corrected). Round 8 = a generic single-threshold purity gate over
  a feature family + the specific fixes, then content re-authored against its report,
  blind test #4 with the draw stored verbatim, and a rounds-8 delta. Ships as 2.4.0.
  OpenAI lane: attempts 4 (stub engine) and 5 (foreground cap, Conductor dispatch
  error) VOID; **attempt 6 (`wo12-r0-review-openai-6.md`, engine verified) REVISE —
  1 CRITICAL / 4 MAJOR / 3 MINOR, accepted.** Four of its findings converge with the
  Anthropic lane's, reached blind (identity spoof, FINDINGS terminator from the
  opposite direction, id-named clone dir, lowercase splitter). New from it: an unchecked
  `--run-clone-root` inside the repository reaches the live key; the stopping standard
  is rendered but unenforced; resume resets the run index so gate 6's streak can be
  split. All folded into round 8. Rounds 3–7 now carry a cross-vendor verdict.
  **Round-8 tooling landed `20145a5`** (983 checks, CI 9/9): arm (8) single-threshold
  purity over 15 derived features with content targets; `SEAL:` verdict on
  `--check-only` (drift / purity / absent-or-stale `blind-read.json` → exit 1); served
  model honoured only before `=== ENGINE OUTPUT ===`; terminator reconciled; VARIANTS
  v4 (no subject line); opaque clone tokens + refused in-repo clone roots; absolute run
  index; protocol amendment (xiii). On round-7 content the gate refuses: 13 pure rules
  (the `sdc-024–032` control cluster fires on six; ten seeds carry no digit; nine seeds
  over-use "and"; both shortest-sentence tails pure). Content round 8 in flight in four
  disjoint groups against shared target bands. Version 2.4.0 cut (`a473588`).
  **Incidental findings registered during corpus construction (follow-ons, own
  lanes):** (i) `tests/verifier.test.js:556` — the redaction-before-truncation
  assertion (`!/MNOPQRSTUV/`) is near-vacuous on this platform: the surviving leak
  under the buggy order begins one character later, so the test passes with or
  without the fix it pins (found by the sdc-041 seeder while surveying; not used as a
  seed); (ii) `tests/review-lane.test.js`'s helper-sibling repair and orphan-sweep
  sections flicker 5–7 failures on this host at historical commits while the current
  HEAD runs 116/116 green — environment-dependent (the stale codex helper is the
  plausible cause), worth pinning once the helper is repaired; (iii) the sdc-039
  seeder independently rediscovered the round-4 `sweepAbandoned` main-worktree
  rm-rf (R0-EX5's CRITICAL, fixed at `ceeaabc`) — a confirmation of the record, not a
  live defect; (iv) **review-runner engine observability** — the OpenAI-lane round-3
  delta's third attempt (`roster/wo12-r0-review-openai-4.md`) returned the
  `tests/fixtures/stub-codex.js` fixture's APPROVE as if it were a codex verdict;
  `CODEX_BIN` was set in the invoking environment (source undetermined). Ruled VOID.
  `orchestra-review.js` must print the resolved engine path + hash in every verdict
  header and refuse an engine under `tests/fixtures/` outside an explicit test mode.
  **Closed at `5f83486`:** the runner prints `ENGINE BIN: <path> sha256=<hex>` in its
  header block, ends that block with a literal `=== ENGINE OUTPUT ===` delimiter
  (occurrences inside engine output are neutralised), and refuses a fixture engine
  unless `ORCHESTRA_ALLOW_STUB_ENGINE=1`. It emits no `served_model:` — codex-cli
  0.151.0 exposes no served-model field (the `--json` stream carries none; the rollout
  log echoes the request) — so gate 5 reads LIMITED honestly on every codex lane until
  the CLI reports one. The OpenAI-lane delta itself was delivered on attempt 6.
- **WO-12 DE-SCOPED AND BOUNDED (2026-08-31) — amendments xiv + xv; 12f WITHDRAWN:**
  after the round-4–8 blinding arms race was called out as scope creep (10+ hr
  session postmortem, owner concurrence), the owner directed a hard turn to live
  pilot testing and dropped Terra as a reviewer candidate outright ("attempting to
  find cheaper reviewers is unnecessary"). A session scope oracle (Fable fork, full
  context) ratified a bounded close-out and authored the stopping rule, adopted
  verbatim as **protocol amendment xiv**: at most one completion pass (the 20
  residue ids from the 2026-08-31 `--check-only` report) + one repair pass; blind
  test #4 (one administration, one scoped fix + one re-administration max, then
  owner); the pre-registered rounds-8 delta review is STRUCK (the treadmill
  itself); no further content/lint/gate/tooling changes regardless of later
  classifier findings — disclosures only; anything beyond needs a new owner order.
  **Amendment xv withdraws 12f**: X-Terra struck from every phase, phase 0 = X-Sol
  + in-harness 12d arms only, the served-model identity follow-on closes as moot
  (gate 5 LIMITED = disclosure, gates nothing). The corpus's consumers are 12d
  (needs ground truth; live telemetry cannot measure missed defects) and 12h
  (exploratory). Oracle facts that forced the shape: round-8 content was never
  materialized (on-disk briefs are round-7), `--check-only` refuses on 3 findings
  naming exactly the 20 residue ids, and no override path exists — so "accept
  as-is" was unreachable and one completion batch is the cheapest consistent end
  state. Close-out sequence: amendment committed first → completion batch →
  regenerate + reseal → blind #4 (draw stored verbatim) → SEAL PASS transcript
  committed → `run-lane.js --dry-run` (X-Sol only) → STOP at the two owner gates.
  Oracle cadence is standing policy: a high-effort oracle reviews scope every few
  rounds; stopping rules are oracle-authored, never worker-authored.
- **WO-12 PRE-TRIAL WORK CLOSED — SEAL: PASS (2026-08-31, v2.4.1):** the full
  amendment-xiv sequence executed same-day. Batch G5 (`bd88222`) cleared all three
  residue findings on the 20 ids (Sonnet agent, one pass, fact-preservation
  spot-checked); corpus regenerated idempotently and resealed (`61bda5c`); blind
  test #4 drawn verbatim (`blind-draw-round8.json`, seed round8-blind4), read by a
  fresh-context Opus evaluator over an isolated packet copy, scored mechanically —
  **25% precision / 25% accuracy, below chance** (`check-only-transcript-round8.txt`
  committed; raw evaluator output + the sub-chance disclosure, recorded-not-gated
  per xiv, in `corpus/BLIND-TEST-round8.md`); `run-lane.js --lane X-Sol --phase 0
  --dry-run` clean end-to-end. Human-facing reads across generations: 41.7% → 33%
  → 25%, all at or below chance. Nothing further is permitted on WO-12 pre-trial
  work without a new owner order. **The codex fault is CLEARED (2026-08-31 evening,
  addendum 2 in `roster/wo11-codex-fault-investigation-2026-08-31.md`):** `codex
  update` was a no-op (0.151.0 is still latest stable; the defect is inside the
  0.151.0 package itself) and the last flag lead was refuted (every spelling
  collapses to `features.unified_exec`, refuted 3/3; on 0.151.0 the runner sits
  under the plain exec path too, so no flag routes around it). The repair: the
  `codex-command-runner.exe` from npm `@openai/codex@0.152.0-alpha.7-win32-x64`
  (published 2026-08-31; sha256 `f0cbcc339587…`), owner-swapped into both helper
  locations with backups; the re-probe spawned a shell cleanly (nonce
  `6ce1ec298f174b72`) — the first clean spawn on this path since WO-9. Standing
  state: 0.151.0 CLI + alpha.7 helper; a future `codex update` to 0.152.0 stable
  supersedes the swap wholesale. **The trial now waits on ONE owner action:
  record the four P0 readings
  (`node quartermaster/quartermaster.js --record <AU-all|AU-opus|AU-fable|OU>
  <remaining-fraction> --source "..."`). Then: phase-0 pilot with `--yes`, the
  in-harness 12d arms, and the owed E8/E1/A0 exercises.**
- **WO-12 STOPPED AT PHASE 0; campaign re-aimed (2026-08-31 → 09-01):** the phase-0
  pilot ran on all three lanes (X-Sol 5/6 seeds, 1 UNAVAILABLE; S-Sonnet 6/6; S-Opus
  6/6; no cross-family complementarity on the subset) — `wo12/PHASE0-PILOT-NOTE.md`,
  raw results committed. An open-ended second-pass scope oracle (Sol·xhigh,
  `roster/wo12-scope-oracle-2-2026-08-31.md`, after the owner rejected the first
  oracle order's pre-cut options) ruled: phases 1–3 are an optional research asset,
  not a gate; the S-lane control reviews' live router/quartermaster findings are
  READINESS BLOCKERS; and the campaign's largest gap is **activation** — nothing
  installed calls `dispatch()`, `install.js` still installs the legacy core. Binding
  path (owner-ratified): readiness-repair tranche → activation bridge → E8/E1/A0
  through the working path → WO-15. **Readiness-repair tranche executed and STOPPED
  TO OWNER** (`roster/readiness-repair-tranche-2026-09-01.md`): 11 confirmed
  defects fixed and pinned (router 135→153 checks, quartermaster 195→216), incl. the
  auth-touch→Fable dispatch and the future-dated-throttle fail-open; two cross-vendor
  review cycles (cycle 1: 2 MAJOR, fixed — one was an inverted Q0 family fix the
  Conductor's ambiguous pin spec let through; cycle 2: 1 new MAJOR on human-authored
  Q0 re-dispatch under pool transition + 1 MINOR) — the oracle's two-cycle cap halts
  it here. **Adversarial roster review (Sol·max)** recorded with the Conductor's
  full refutation pass (`roster/roster-adversarial-review-2026-09-01.md`,
  `roster/roster-review-refutations-2026-09-01.md`): keep 5 seats + 2 substrates,
  16 files demote/merge/ditch; Red Team and Sweeper premises refuted (WO-8 exercises
  the reviewer never saw), Data Engineer contested. **Owner rulings 2026-09-01 (all
  three recorded):** (1) tranche residuals ACCEPTED as registered follow-ons — the
  human-authored-Q0 stale-family MAJOR is fixed inside the activation bridge before any
  shadow (oracle's rule), tranche CLOSED; (2) reserve calibration LEFT at parity
  (`floorFractionOfBucket` 0.08 == redBelow); (3) roster: KEEP Red Team, Data Engineer,
  Architect (**toggleable** — owner-settable enable flag, typed `DISABLED` when off,
  Conductor self-plans with disclosure; mechanism built in the bridge); BENCH Sweeper
  (file kept, same toggle, default OFF; re-enable on a missed-site escape in the first
  live tests); DITCH every other non-KEEP file. Launch roster = 9 active seats + 1
  benched + 2 substrates (`roster/roster-review-refutations-2026-09-01.md` § Owner
  rulings). **Builder ladder — ruled, to build in the bridge:** the Conductor selects
  Luna / Terra / Sonnet / Sol / Opus for Builder work by task shape and per-vendor
  availability. Today Builder has four rungs and pool state can only step to `mirror`;
  no Opus or Sol implementation rung exists on E2 (Opus was Principal's, absorbed here).
  Adopted shape: a `tier` on the order (bounded / standard / dense / deep) mapping to a
  preferred casting plus an ordered cross-vendor lawful-substitute list walked under the
  bucket ladder with `recastFrom` disclosed; guardrails preserved (Luna never
  under-specified; Opus behind P15 + Amber arming; review computed from the served author
  family); **`deep` defaults to Opus·high**, Conductor override to Sol·high only after the
  Quartermaster's review-reserve check (Sol-authored mutation is mandatory-review by flag
  and draws down the review reserve — a deliberate choice, never a degradation target).
  The file retirements, both toggles, the stale-family MAJOR fix, and the ladder all land
  in the bridge tranche so `roster/lint.js` and `install.js --lint` move once.
  **WO-14b activation bridge — DRAFTED, ORACLE-RULED, IN PROGRESS (2026-09-01):** v1
  draft (`9bfc021`) refused by the third scope-oracle pass (Sol·xhigh,
  `roster/wo14b-oracle-verdict.md`): right tranche and right basic mechanism (ticketed
  dispatch), but an Agent-only gate leaves raw `orchestra_exec`/`orchestra_review`
  bypasses, no ticket lifecycle, casting records cannot be truthfully written at dispatch,
  the dispatch input contradicts `order.schema.json`, the review runner is prose-only
  against structured verdict/audit schemas, and a synthetic canary could pass with a
  harness that blocks every spawn. Reshaped into seven sequential bounded legs
  (`roster/wo14b-activation-bridge-order.md` v2): 1 host lifecycle proof (can stop the
  tranche) → 2 contracts + ruled migration → 3 installer/guard → 4 activation state
  machine (tickets gate Agent AND raw engine tools; stop hook) → 5 two-stage closure with
  structured verdict + audit → 6 deterministic installed acceptance → 7 live installed
  canary in both vendor directions. Oracle-authored stopping rules and gate are in the
  order; progress file `roster/wo14b-activation-bridge-progress.md`; 80-tool-call leg
  ceiling; branch `claude/wo14b-bridge`.
- Manual companions the probes cannot capture: vendor-UI allowance readings, Opus-bucket
  edge observation, served-model checks (listed in the RUNBOOK).

## Related PRs

- PR #21 — `/cross-compare-plan` max effort rung + field-test hardening (v1.12.0, v1.13.0).
- PR #22 — the session record, the revised final plan, the probes, and the two research
  reports the session used.
- PR #23 — the lab ports: `/deep-plan` retirement (v2.0.0) + MCP cancellation fix.
- PR #24 — the 2026-08-28 second-session lineup rulings applied to final-plan.md,
  STATUS.md, and the probe runbook.
- PR #25 — WO-1 installed, WO-2 executed and passed (throughput + handoff drill), WO-7a
  corpus + sealed model pass, and v2.1.0 (BREACH/GAP finding buckets; running-process rule
  coverage completed).
- PR #26 — WO-7a scored (31/40 FAIL), the Part-4 boundary redraw + owner wording pass.
- PR #27 — the full WO-7a-bis + WO-7a-ter validation cycle: both corpora with sealed
  model passes, both blind scorings, boundary redraws #2 and #3, the cross-vendor review
  record (`pr27-cross-vendor-review.md`), and the WO-7a-quater corpus plus blind scoring.

## Fresh-session quick start (as of 2026-09-02 ~00:40Z — WO-14b SHAKEDOWN in progress)

**OWNER RULING 2026-09-01 ~21:00Z — SHIP TO SHAKEDOWN.** "Keep your goals VERY bounded… KISS,
YAGNI, DRY and get this project closed out. The only important aspects are telemetry for
monitoring performance… usable in our actual projects ASAP… fine tune during our shakedown
cruise/first live tests." The plan's steps 4–5 (Sol integrated review + correction + recheck;
Opus pre-live audit) are CUT. Non-spine findings go to `roster/wo14b-shakedown-punch-list.md`
(PL-1…PL-11), never to a repair round. Do not add verification steps the owner did not order.

**Where it is.** Leg 6 merged (`1967b6e`, acceptance 90/0). The harness is INSTALLED LIVE in
`E:\Godot Projects\PiratePartyPals` (v2.4.1, `--roster new --packs codex`, generation 1;
install committed there as `0c8549e6`, runtime state gitignored `073dfe3e`, merged + pushed
`c096ef08` so `origin/main` carries it). Readings recorded 2026-09-01 15:14Z (AU-all 0.85,
AU-fable 0.88, AU-opus 0.85 = all-models figure, OU 0.60) — **they expire after 24h; re-record
before the next order** (`node quartermaster/quartermaster.js --file <target>/.claude/orchestra-pool-readings.jsonl --record <bucket> <remaining 0..1> --source "..."`).

**Live orders so far.** #1 (DM nametag colours) — spine proven through dispatch → envelope →
ticketed Opus investigator → RESOLVED → Stop blocked while LAUNCHED → replay refused; recon
found the feature already shipped, so no builder ran; recon tickets cannot close (PL-10, no
telemetry for recon-only orders). #2 (mortar explosion VFX +30%) — reached the builder, then the
builder's `checkout -B … origin/main` removed the local-only harness under the session (PL-11);
target repaired (`tools/shakedown/` + `roster/wo14b-activation-bridge-progress.md` last lines),
push done. **Next: the owner restarts `claude --model fable` in the target and re-issues order
#2 (VFX only, tests named).** Expected: builder → close #1 → Verifier → ticketed OpenAI reviewer
→ close #2 → CLOSED, and the FIRST `casting-record` + `verdict-audit` files under
`<target>/.claude/orchestra/ledger/<task_id>/`. Read them; anything off → punch list.

**Tools for the next session** (`tools/shakedown/`): `ppp-doctor.js <project>` (stdio probe:
tools/list + orchestra_doctor of the INSTALLED server), `ppp-call.js <project> <tool> '<json>'`
(call any installed tool; `schema` prints input schemas). The ticket store is
`<target>/.claude/orchestra/tickets/tickets.json` (plain JSON; `tickets.events.jsonl` is the WAL).

**Hazards learned the hard way this session.** (1) The owner's pasted transcripts sometimes run as
`!` commands in THIS repo — check `git status` here after any odd paste. (2) Never `git stash -u`
or `git restore --source=<tree> -- .` in the target: the first swept the harness (PL-9 fail-open:
Claude Code treats a MISSING gate script as a non-blocking hook error and Agent launches proceed
unticketed), the second removed 4,477 tracked files (restore matches the pathspec to the source
tree). Recovery is always from HEAD/stash — nothing was lost. (3) A Sonnet helm is enforced too
but told it is dormant (PL-7) — use Fable. (4) `enableAllProjectMcpServers: true` in the
target's `settings.local.json` means no MCP approval prompt (PL-8). (5) Post-shakedown fix #1 =
PL-9 (guard must require the gate script to exist); #2 = PL-11 installer `.gitignore`; #3 = PL-10
recon close path.

Branch **`claude/wo14b-bridge`** (off `claude/wo12-trials`). Read, in this order, and nothing else
first:

1. `roster/wo14b-activation-bridge-progress.md` — one line per event; the last lines say exactly
   where the bridge is and what is in flight.
2. `roster/wo14b-finish-plan.md` — **the plan of record** (Sol · max, owner-ordered "asap / KISS /
   YAGNI / DRY"): three cuts to the repairs, leg 6 = four installed scenarios, ONE Sol integrated
   review (+ one correction + one recheck), then the live gate with the Opus audit folded in;
   YAGNI/DRY/KISS rulings (what is frozen, what is deferred as a documented limit, what stays
   duplicated through the gate); binding stopping rules.
3. The orders to execute, in order: `roster/wo14b-repair-A-order.md` + `wo14b-repair-B-order.md`
   (owner-approved 17:50Z; amended per the plan; if the progress file's last line says they are
   merged, skip) → `roster/wo14b-leg6-order.md` → the integrated Sol review over the exact
   post-leg-6 commit (framing: property review of the whole installed path incl. leg 3R; declared
   verification = every suite) → `roster/wo14b-leg7-order.md` (owner present).
4. Context only if needed: `roster/wo14b-session-oracle-verdict.md` (why the per-leg loops were
   stopped), `roster/wo14b-leg3-oracle-verdict.md` (the guard's closed regime),
   `roster/wo14b-oracle-verdict.md` (the seven-leg ruling and gate).

Rules a fresh session inherits: the 80-tool-call ceiling is a hard `CHECKPOINT` (eleven builders
breached it; builder self-counts are wrong — trust the harness); orders plan ≤40 calls; no
mid-round folding; no new trust layers / telemetry / schemas / seats; component-suite green is not
installed proof; `CODEX_BIN` pinned to codex-cli 0.151.0 (sha256 `cf68265…`), runners in the
background, review runner on its own pinned worktree; create worktrees by hand (the Agent tool's
`isolation: worktree` provisions from `main`); security-flavoured review orders to Sol trip the
OpenAI cyber classifier — spec-conformance framing for R0, the Opus mirror for E7; write runner
inputs with the Write tool, not shell heredocs.

Owner actions the live gate needs: record Quartermaster readings into the disposable target; approve
the engine server in its `.mcp.json`; be present for accept-or-stop.

## Historical: fresh-session quick start (as of 2026-08-31, WO-12 in progress)

0. **Read the three 2026-08-31 entries above first** (WO-13 disposed; codex fault
   root-caused AND CLEARED — alpha.7 runner swap, addendum 2; WO-12 protocol +
   corpora built, no pass run). The one owner action that gates everything
   downstream: record `/status` readings per bucket
   (`node quartermaster/quartermaster.js --record …`, once per
   24h). Then: WO-12 phase-0 pilot
   (`node wo12/run-lane.js --lane X-Sol --phase 0 --dry-run` first), the owed
   E8/E1/A0 exercises (orders in the band-record appendices), and the exercise-debt
   ledger in `roster/wo11-band-record.md`.

1. **WO-4–WO-8 are DONE. WO-9–WO-11 are STAFFED; exercise contract
   INCOMPLETE** (round 3, applying the owner-requested Sol·max holistic
   review's MAJOR A) — **debt ledgered: E8 (Refactorer, WO-10,
   environment-blocked), E1 (Runner, WO-10, environment-blocked), A0
   (Architect, WO-11, environment-blocked), A1 (Synthesizer, WO-11,
   deferred), E5 render loop (Interface Artisan, WO-10, unexercisable in
   harness); plus WO-9's Archivist images lane (unexercised). Band
   completion is gated on those exercises** — full ledger in
   `roster/wo11-band-record.md`'s "## Exercise debt" section. What IS done,
   stated precisely: every WO-9/10/11 role file shipped, `roster/lint.js`
   and `install.js --lint` green, and the seats that WERE dispatched carry
   real (including degraded) outcomes — WO-9: 5/5 seats exercised (images
   lane excepted); WO-10: 8/10 seats exercised; WO-11 Band A: 2/4 seats
   exercised. WO-11's round-2 review fixes landed on top of the P0
   Quartermaster substrate — see the WO-11 entry above. Band A's four seats
   do NOT all carry the same exercise
   outcome — stated precisely, not rounded up to "all four exercises":
   **Conductor** exercised (1 VIOLATION, dispositions re-ruled in full on
   round 2); **Quartermaster** live-exercised (1/4 buckets evidenced,
   fail-closed proven on the rest); **Architect**
   BLOCKED-PENDING-ENVIRONMENT (2 engine-reaching attempts, no competency
   signal, exercise owed); **Synthesizer** DEFERRED-DECLARED (max-reserved,
   exercised at its first real comparative session). The 2026-08-29
   owner-delegated final ruling
   merged I0/I1, restructured Part 4 around the §4.0 total decision
   procedure, and demoted class to a routing hypothesis with `RECLASSIFY`
   recovery; WO-4 encoded it in `registry/` (`node tests/registry.test.js`);
   WO-5 built the Verifier substrate in `verifier/` (`node tests/verifier.test.js`, 63
   green); WO-6 built the router in `router/` (`node tests/router.test.js`, 82 green —
   casting tables, review matrix, degradation machine, AU-O gate, Q0 triggers, charters,
   RECLASSIFY hop machinery); WO-7b validated misroute recovery through it (all three
   pre-registered gates pass — `wo7b/wo7b-report.md`, including the reserved B/W edges).
   WO-5 and WO-6 are gate-class and need their cross-vendor review pass at PR time.
2. **WO-1 is collecting passively** — nothing to do until a week of normal work has passed;
   then `node .claude/hooks/orchestra-telemetry.js --report` + the Opus-concentration
   readout against the manual readings file.
3. Sequence (taxonomy gate closed by the ruling): ~~WO-4 (schemas)~~ → ~~WO-5
   (Verifier substrate)~~ → ~~WO-6 (router)~~ → ~~WO-7b (misroute recovery — PASSED)~~
   → ~~WO-8~~ → **WO-9 (evidence band STAFFED; exercise contract
   INCOMPLETE — Archivist images lane unexercised)** →
   **WO-10 (construction band STAFFED; exercise contract INCOMPLETE — 8/10
   exercised, Refactorer/E8 and Runner/E1 environment-blocked, Interface
   Artisan's E5 render loop unexercisable in harness)** →
   **WO-11 (Band A STAFFED; exercise contract INCOMPLETE — 2 of 4 seats
   exercised, Architect/A0 environment-blocked, Synthesizer/A1 deferred; P0
   substrate live — round-2 review fixes landed)**
   → **WO-12 trials** (12f any time) → **WO-13 scope check** → **WO-15
   shadow** after. Neither WO-9, WO-10, nor WO-11 is struck through above:
   staffing is done, but the WO-8–11 order's contract — "each with one
   end-to-end exercised order" — is not yet fully discharged for any of the
   three, so none is marked complete (round 3, Sol·max holistic review
   MAJOR A). **Exercises owed on the standing codex sandbox fault**:
   Refactorer (E8, WO-10), Runner (E1, WO-10), Architect (A0, WO-11) — all
   three BLOCKED-PENDING-ENVIRONMENT, reproducible from their band records'
   order-text appendices once the fault clears. Full debt ledger:
   `roster/wo11-band-record.md`'s "## Exercise debt" section.
   Parallelizable now per the plan's dependency line:
   WO-13 (metered planning transport; "after WO-4, any time" — but scope needs a check
   against the `/deep-plan` retirement), WO-12f (Terra T1 qualification trial, "any
   time after WO-2"; consumes real allowance), and WO-14 (alias layer + kill switch,
   "after WO-6" — now unblocked). The P3→P2→P1 deferred backlog
   (`plans/proposed-orchestra-improvements.md`) remains schedulable meanwhile — P3
   (verification manifest) is the cheapest and benefits every review immediately.
