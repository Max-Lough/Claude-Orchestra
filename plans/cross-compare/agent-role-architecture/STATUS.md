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
- **WO-9 EXECUTED (2026-08-30):** the evidence band (Band B, seats 4-8: Scout,
  Researcher, LC Analyst, Investigator, Archivist) staffed per the WO-8-11 order — six
  role files shipped (`roster/wo9-band-record.md`: naming decisions, Archivist's two lane
  files, the Investigator read-only pin). `node roster/lint.js` and `node install.js
  --lint` (roster/ and repo-wide) pass; all five required test suites pass in full. Stage
  2 exercised all five seats: Scout (N0, Haiku 4.5 in-harness) and Investigator (I0, Opus
  5 in-harness) both PASS; N1/N2/M0 ran via the `orchestra_exec` codex runner (closest
  existing cross-vendor call — no dedicated research/long-context/extraction runner
  exists yet). N1's first run (ex1) returned DONE after completing real, cited web
  research, but without disclosing that its local shell channel had separately failed, with
  no retrieval dates, and with local verification duties unrun — a report-integrity/
  verification-discipline defect, not demonstrated fabrication (corrected in round 2 after
  R0 review; the original "fabrication"/"live evidence of the charter's named failure mode"
  framing is withdrawn). Discarded on that narrower ground; the retry, under an integrity
  addendum, independently corroborated ex1's same three URLs and conclusions (evidence
  against fabrication) and correctly returned BLOCKED — rule-compliant, conservative typing,
  not a choice against fabricating — provisionally accepted as the exercised order, owner
  may override. M0's documents-lane ex1 hit the same transient codex sandbox fault
  (`unsupported protocol version 6`) and typed BLOCKED honestly; ex2 PASS. N2 PASS
  cleanly. M0's images lane ships staffed but unexercised. Follow-ons registered: the
  codex sandbox protocol fault (investigate/upstream), a `verifier/checkout.js:322-327`
  prune-comment fix (incidental I0 finding), and the standing no-dedicated-runner gap.
  Full record: `roster/wo9-band-record.md`. Next: **WO-10**.
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

## Fresh-session quick start (as of 2026-08-29, final ruling applied)

1. **WO-8–11 are the active steps — WO-4, WO-5, WO-6, WO-7b, WO-8, and WO-9 are
   done; WO-10 is next.** The
   2026-08-29 owner-delegated final ruling merged I0/I1, restructured Part 4 around the
   §4.0 total decision procedure, and demoted class to a routing hypothesis with
   `RECLASSIFY` recovery; WO-4 encoded it in `registry/` (`node tests/registry.test.js`);
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
   → ~~WO-8~~ → ~~WO-9 (evidence band staffed + exercised)~~ → **WO-10** →
   WO-11 → WO-12 trials → WO-15 shadow.
   Parallelizable now per the plan's dependency line:
   WO-13 (metered planning transport; "after WO-4, any time" — but scope needs a check
   against the `/deep-plan` retirement), WO-12f (Terra T1 qualification trial, "any
   time after WO-2"; consumes real allowance), and WO-14 (alias layer + kill switch,
   "after WO-6" — now unblocked). The P3→P2→P1 deferred backlog
   (`plans/proposed-orchestra-improvements.md`) remains schedulable meanwhile — P3
   (verification manifest) is the cheapest and benefits every review immediately.
