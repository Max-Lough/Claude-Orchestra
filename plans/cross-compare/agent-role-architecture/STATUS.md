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
- **WO-1 + WO-2 are ready to run** — `probes/RUNBOOK.md` in this repo (telemetry hook
  validated; review-throughput probe dry-run validated; nothing billed yet). WO-3 withdrawn.
- Then **WO-7a** (40-request paper classification corpus) before any schema work (WO-4).
- Manual companions the probes cannot capture: vendor-UI allowance readings, Opus-bucket
  edge observation, served-model checks (listed in the RUNBOOK).

## Related PRs

- PR #21 — `/cross-compare-plan` max effort rung + field-test hardening (v1.12.0, v1.13.0).
- PR #22 — the session record, the revised final plan, the probes, and the two research
  reports the session used.
- PR #23 — the lab ports: `/deep-plan` retirement (v2.0.0) + MCP cancellation fix.
- PR (this branch) — the 2026-08-28 second-session lineup rulings applied to final-plan.md,
  STATUS.md, and the probe runbook.
