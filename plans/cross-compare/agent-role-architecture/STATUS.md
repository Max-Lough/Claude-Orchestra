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

## Open items for the next session

**1. Three lineup rulings (owner review pending — listed at the end of final-plan.md's
Audit dispositions, NOT yet applied):**
- (a) Conductor effort split by turn type — intake/arbitration at high, relay turns at
  medium; currently the medium-effort Conductor self-assesses ambiguity (circular).
- (b) An explicit §5.5 statement that removing the Gemini lane makes pool-exhaustion states
  fall back to the human operator sooner — owned as a conscious trade.
- (c) An Opus-concentration watch: WO-1 measures the AU-O fraction drawn by the I0/I1/E3/E4
  mix; if high, deliberate Detective/Investigator rotation to the Sol mirror.

**2. Lab-unique work that has NOT been ported to this repo** (the lab made its own commits
during the session; nothing below exists on `main` here — decide, then port deliberately):
- **`/deep-plan` retirement (lab commit `392f23a`, stamped v2.0.0 in the lab).** The lab
  session retired the deep-plan skill on the strength of final-plan.md §6.3/§6.4 (one
  Architect contract; the metered API transport violates the subscription-only basis,
  WO-13). Porting it will conflict lightly with this repo's v1.13.0 SKILL.md changes and
  needs its own version decision (the lab called it 2.0.0). Reviewed APPROVE in the lab
  after one REVISE round (version stamps).
- **MCP cancellation fix (UNCOMMITTED in the lab: `packs/codex/hooks/orchestra-engine-mcp.js`
  +250, `tests/mcp-lane.test.js` +253).** Honors `notifications/cancelled` by killing the
  child process via an in-flight run registry; motivated by the orphaned Codex run during
  the session (a "stopped" call kept running — judged the one finding with a live safety
  consequence). Must be reconciled with this repo's 1.13.0 engine changes when ported.
- **`plans/proposed-orchestra-improvements.md`** (copied here) — deferred backlog: P1
  harvest the ledger from logs instead of hand-writing it, P2 name the Codex rollout on
  every runner report, P3 commission the missing verification manifest. Proposed, not
  scheduled.
- The lab's web-tools commit (`f4ab59e`) is superseded by this repo's v1.13.0 (which does
  the same more completely); nothing to port.

**3. Plan execution (sequencing per final-plan.md `## Orders`):**
- **WO-1 + WO-2 are ready to run** — `probes/RUNBOOK.md` in this repo (telemetry hook
  validated; review-throughput probe dry-run validated; nothing billed yet). WO-3 withdrawn.
- Then **WO-7a** (40-request paper classification corpus) before any schema work (WO-4).
- Manual companions the probes cannot capture: vendor-UI allowance readings, Opus-bucket
  edge observation, served-model checks (listed in the RUNBOOK).

## Related PRs

- PR #21 — `/cross-compare-plan` max effort rung + field-test hardening (v1.12.0, v1.13.0).
- PR (this branch) — the session record, the revised final plan, the probes, and the two
  research reports the session used.
