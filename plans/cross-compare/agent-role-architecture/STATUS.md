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

`final-plan.md` specifies 24 catalog entries (22 model-cast roles + 2 deterministic
substrates), a 24-class taxonomy with a one-primary-per-class bijection, a computed
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
  is sealed in `wo7a-model-classification-SEALED.md`. **Next: the owner classifies the corpus
  independently — do NOT open the sealed file first** — then compare (≥90% agreement, ≤2
  genuine ambiguities, else redraw boundaries before WO-4). Caveat: history holds no true
  E4/E5/E6 work; seed WO-7b with synthetic E5/E6 items.
- Manual companions the probes cannot capture: vendor-UI allowance readings, Opus-bucket
  edge observation, served-model checks (listed in the RUNBOOK).

## Related PRs

- PR #21 — `/cross-compare-plan` max effort rung + field-test hardening (v1.12.0, v1.13.0).
- PR #22 — the session record, the revised final plan, the probes, and the two research
  reports the session used.
- PR #23 — the lab ports: `/deep-plan` retirement (v2.0.0) + MCP cancellation fix.
- PR (this branch) — the 2026-08-28 second-session lineup rulings applied to final-plan.md,
  STATUS.md, and the probe runbook.
