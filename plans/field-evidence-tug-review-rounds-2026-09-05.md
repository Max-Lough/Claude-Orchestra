# Field evidence — review rounds in the PiratePartyPals Tug of War campaign (2026-09-02 → 09-05)

Question from the owner: the campaign produced an anomalous number of Sol (`reviewer-codex`)
REVISE verdicts. Is the reviewer too harsh, are the executors too weak, or is the Director
routing hard orders to the wrong tier? And should the threshold for starting an order on a
stronger executor move down?

## Method

The harness has no verdict ledger. Everything below was reconstructed from the Claude Code
session transcripts of the eight Tug sessions (`~/.claude/projects/E--Godot-Projects-PiratePartyPals/`,
sessions dated 2026-09-02 18:23Z through 2026-09-05 23:22Z) plus the Director's notebook
`.claude/plans/tug-of-war-impl-chunks.md` in the project. Each `Agent` dispatch was paired with
its task-notification `<result>` block, which carries the agent's final report and a `<usage>`
line (`subagent_tokens`, `tool_uses`, `duration_ms`). Verdicts, finding severities and
BREACH/GAP buckets were parsed from the relayed Sol reports; per-order chains were assembled
by hand from the chronology and cross-checked against the notebook. The 2026-09-02 sessions
ran the retired 2.0 roster (`builder` / `reviewer-openai`) and are reported separately.

Caveats. `subagent_tokens` is the agent's final context size, not billed tokens (a 20-call
scout reports ~46k; billed tokens would be far larger) — the hook layer does not expose
billing, as `orchestra-telemetry.js` documents. Wall-clock and tool-call counts are robust.
Warm resumes (`SendMessage`) re-report on the same agent, so "completions" exceed dispatches.
There is no controlled comparison of reviewer harshness: the July–August baseline is the Opus
`reviewer` on smaller, less contract-heavy orders.

## Verdicts

| Reviewer | Verdicts | APPROVE | REVISE | UNAVAILABLE | REVISE rate |
|---|---|---|---|---|---|
| `reviewer-codex` (Sol), 3.0 harness, sessions 4–9 | 74 | 21 | 48 | 5 | 70% |
| `reviewer-openai` (Sol), 2.0 harness, sessions 2–3 | 20 | 3 | 14 | 3 | 82% |
| `reviewer` (Opus), Tug campaign, mostly fallback or docs | 9 | 8 | 1 | — | 11% |
| `reviewer` (Opus), all campaigns 2026-07-19 → 08-28 (`ledger.md`) | 171 | 117 | 54 | 6 | 32% |

Calibration checks on the 48 Sol REVISE verdicts: 47 carried at least one MAJOR or CRITICAL
finding; 0 were GAP-only. The Director recorded one hallucinated finding (a "Brig / 3rd-Rate"
roster that does not exist) and arbitrated past a REVISE three times (WI-8 rounds 4 and 6,
rules-doc round 7). Sol reproduced its own benchmark numbers on every WI-8 round it rejected.
One Sol verdict was actually an Opus verdict relayed through the project's MCP reviewer
(the inner `REVIEW ENGINE: Claude CLI` header) — a separate runner defect, tracked in the
project's memory.

## Per-order chains (code orders, by the tier the order started on)

| First tier | Orders | Review rounds | Avg rounds | 1st-round APPROVE | Escalated | Abandoned |
|---|---|---|---|---|---|---|
| Sonnet `executor` | 7 | 16 | 2.3 | 3 | 2 | 1 |
| Opus `executor-heavy` | 12 | 37 | 3.1 | 3 | 1 | 0 |
| Opus `executor-heavy-xhigh` | 4 | 6 | 1.5 | 2 | 0 | 0 |
| Docs orders (Sonnet) | 5 | 17 | 3.4 | 0 | 1 | 0 |

Sonnet: B0 (1), B4 UI (3, escalated to heavy at round 3 → APPROVE), R1 foundations (1), WO-8
funnel (1), DM smoke race (5, escalated at round 3, owner ruling at round 5), D1 (2), Godot
watchdog (3, shelved unmerged).
Opus high: B3 (2), B6 (1), WO-5 (2), WO-6 proof suites (4), Chunk C gate (2), **D2 result latch
(9)**, D3 (2), WI-15a (3), **WI-8 benchmark (6, shipped by arbitration)**, WO-21b grid benchmark
(4: two bounces at heavy → xhigh bounce → Fable rung → APPROVE), WO-9a (1), WO-9b (1).
Opus xhigh: B2 (1), WO-2 ledger (2), WO-7 lifecycle (2), **WO-21a HitQueryGrid (1)** — the
hardest code order of the campaign approved first time.
Docs: status PR #410 (2), plan archive (2), WI-21 amendment (2), My Ship/My Fleet rules (7, one
inert-tier violation, arbitrated), WI-9 amendments (4, one inert-tier violation, escalated).

The heavy population is the harder one by construction (routing already selected for
difficulty), so the tier comparison is directional. What is not confounded: the three longest
chains (9, 6, 4 rounds) all sat at Opus high with no rung above them, and every escalation that
did happen converged within one round of the new tier (B4 → heavy, WO-21b → Fable, WI-9
docs → heavy).

## What a round costs

| Agent | Completions with usage | Avg wall-clock | Avg tool calls | Avg final context |
|---|---|---|---|---|
| `reviewer-codex` launcher (Sol review) | 78 | 20.7 min | 1 | 29k |
| `executor` (Sonnet) | 81 | 10.0 min | 43 | 169k |
| `executor-heavy` (Opus high) | 51 | 29.5 min | 72 | 352k |
| `executor-heavy-xhigh` (Opus xhigh) | 8 | 31.1 min | 60 | 280k |
| `executor-heavy-xhigh` + `model: fable` | 1 | 17.5 min | 39 | 259k |
| `scout` (audit after each executor) | 82 | 2.0 min | 20 | 46k |

A REVISE round therefore costs roughly 35–75 minutes of wall-clock (review 15–39 min, fix
10–35 min, audit 2 min, Director turnaround), and a Sol review draws about 0.24–0.36% of the
weekly Codex allowance (`.claude/orchestra-pool-readings.jsonl`). The 62 REVISE rounds in the
campaign are on the order of 40–60 hours of rework loop across four days, and the Sol reviews
alone consumed roughly 27 hours of wall-clock. Cold import in the review worktree (~9–10 min
per attempt, per the notebook) is paid every round.

## Reading

1. **Not reviewer harshness in the calibration sense.** Sol's REVISE verdicts almost always
   name a MAJOR BREACH, it reproduces its findings, and the Director found one hallucination in
   roughly ninety verdicts. The brief's rule — any CRITICAL or MAJOR BREACH forces REVISE — is
   being followed.
2. **The dominant shape is whack-a-mole.** In every long chain the reviewer surfaced one
   blocking instance of a class per round (D2: a guarantee stated in a doc comment but not
   enforced, nine variations; WO-6: a fixture proving fewer fields than it claimed; WI-8: one
   more place the rig re-modelled production instead of calling it; rules doc: one more
   hand-enumerated list left stale). The executor, under its own "nothing but the order" law,
   fixed exactly the cited instance, and the next fresh-context review found the sibling. The
   Director wrote this lesson into project memory after D2 but the harness had no rule for it.
3. **Executor tier mattered where the class was large.** Orders whose acceptance depends on an
   exhaustive enumeration a reviewer can extend (every field, every site, every edge, every
   number) were the grinders, and they converged only when a stronger model or an owner ruling
   closed the class. Sonnet-specific pathologies were also visible (289 tool calls on B4, a
   666k-context rules-doc executor across six resumes, the watchdog shelved after three rounds
   — the Director's own note: "heavy-tier work from the start").
4. **Escalation stalled at the top.** §3.5 named one rung (`executor` → `executor-heavy`) and
   called two heavy bounces "a plan problem"; the Director read that as re-plan in place, and
   D2 and WI-8 ground on. The owner's ad-hoc Fable rung on WO-21b worked first time.
5. **Docs orders were the worst per round and the cheapest to fix.** Two inert-tier violations
   (a nine-file range declared docs-only) each cost a full round; hand-enumerated lists in a
   long plan document produced six consecutive single-finding rounds.

## Changes made from this record

- 3.1.0: `executor-principal` / `executor-principal-xhigh` (Fable high / xhigh) added as the
  top rung; §3.5 ladder made explicit; the principal carries two duties the chains showed were
  missing — decisions the order delegates, and class-wide fixes of reviewer findings.

## Proposed, not applied (owner decision)

- Class-sweep clause for every fix order at every tier, not only the principal: "fix the
  finding and every sibling instance in scope; list the sweep".
- Review orders that ask the reviewer to enumerate the whole class when it finds one instance
  ("list every instance of this class you can find, not the first").
- A refuted *report* claim whose underlying code is correct graded MINOR, not MAJOR, unless
  the work order itself required the claim.
- Route-up heuristic for PLAN time: if the acceptance criterion is an exhaustive enumeration a
  reviewer can extend, start at heavy (or principal) with an enumeration table in the order,
  and never declare the inert tier on a range touching data, tests, or `.tres` files.
- Reviewer worktree reuse across rounds of one branch, to stop paying the cold import every
  round (a review-runner change; larger).
