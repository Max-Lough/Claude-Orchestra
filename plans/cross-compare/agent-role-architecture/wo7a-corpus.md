# WO-7a classification corpus — the human pass

This is the paper half of WO-7a (final-plan.md, "WO-7a: Classification corpus — on paper,
before the schemas"). Forty real historical tasks from this repository's git history, each
stripped back to the one-line request a user would have typed **before the work existed** —
no solution details, no class hints, non-chronological order.

**Your job.** For each request, assign exactly one task class from the Part-4 routing table
in `final-plan.md`, using the Part-4.1 exclusive discriminators to break adjacent-pair ties.
Classify against the tables **as written**, not what you think they should say. Optionally
note the risk tier (T0–T3, Part 2.0) and anything you found ambiguous.

**Rules.**

1. Do this pass **independently and completely** before opening
   `wo7a-model-classification-SEALED.md`. That file holds the model's pass; reading any of
   it first voids the comparison.
2. Work only from the request text and the tables. If a request seems to match two
   primaries, apply the 4.1 discriminator for that pair; if it still matches two, mark it
   ambiguous — that is data, not an error.
3. When both passes are done, compare. **Threshold: ≥90% agreement (≥36 of 40), with ≤2
   genuine ambiguities.** Anything below that means the class boundaries get redrawn now —
   before WO-4 encodes them into schemas and 22 agent definitions exist. A disagreement
   traced to a badly written corpus line is a corpus defect, not a boundary defect; strike
   the item and note it.
4. Log every disagreement against its class pair (the Part-4 residual rule's ambiguity
   ledger starts here).

| # | Request | Your class |
|---|---------|------------|
| 1 | When did the default reviewer switch back to Opus, and which commit made the change? | |
| 2 | Replace the codex launcher shell scripts with a proper MCP server that exposes the existing runners as typed tools. | |
| 3 | Codex reviews fail instantly on Windows with EINVAL whenever codex was installed through npm — get the engine launching there. | |
| 4 | Version 1.8.0 has no changelog entry — reconstruct one from the commit and record it. | |
| 5 | Add a specialist that can drive Blender and Godot to model and import game assets for a project. | |
| 6 | The guard hook re-reads the session transcript on every blocked tool call — check whether it's slowing sessions down, and make it faster if it is. | |
| 7 | Retire the /deep-plan lane completely — remove the tool, the agent, the runner, and every reference to them. | |
| 8 | Set up CI that runs the review-lane suite on Linux, Windows, and macOS. | |
| 9 | The cross-vendor review lane has produced no verdicts for six days and reports nothing wrong — find out what's broken and fix it. | |
| 10 | Two complete architecture plans for the new roster disagree — adjudicate them and produce a single merged plan. | |
| 11 | A Godot project's first-open import floods the review integrity warning with 180 generated sidecar files — stop the false alarm. | |
| 12 | Stopping an agent mid-run doesn't stop the engine underneath — it keeps editing the working tree unattended; make cancellation actually end the run. | |
| 13 | Swap the hardcoded local install path in the docs for a placeholder wherever it appears, and add a license. | |
| 14 | Find out how the GPT-5.6 tiers actually perform on visual design and 3D/game coding, and fold that evidence into the research report. | |
| 15 | Before the Director write carve-outs ship, probe them the way an attacker would — path traversal, smuggled extensions, stripped managed markers. | |
| 16 | The exec lane relayed a weeks-old report as DONE for an order that never ran — find the root cause. | |
| 17 | Which projects on this machine still have harness installs older than the current master version? | |
| 18 | Single-architect plans keep locking in their first framing — propose a way to get genuinely adversarial pressure on a plan before it executes. | |
| 19 | Add OpenAI-model executors to the codex pack so implementation work can run cross-vendor, mirroring the review lane. | |
| 20 | A tiny 9-line docs review burned its full time budget twice and returned no verdict — figure out what the review lane is doing and fix it. | |
| 21 | Rename /ultra-plan to /deep-plan everywhere — skill, agents, runner, installer, docs. | |
| 22 | Build a per-project harness that makes the session a non-editing director and routes all work through scout, executor, and reviewer subagents. | |
| 23 | Decide which model should hold the top orchestration seat now that the incumbent's user-facing reports keep degrading into garbled prose. | |
| 24 | Agents keep ending their turn while a background run is still going, and the results reach nobody — make that against the rules everywhere commands run. | |
| 25 | CI case 13 fails on all three macOS runners and passes on Linux and Windows — work out why and fix it. | |
| 26 | Take the three research reports we already have and pull the benchmark and seat-assignment tables into the shared planning brief. | |
| 27 | Add an xhigh variant of the heavy executor — same law word for word, only the effort pin differs. | |
| 28 | Add a capable read-only agent for root-cause investigations, and narrow the scout to where/what missions. | |
| 29 | The "is this directory inside the repo" check answers differently on Windows short names and macOS symlinks for the same layout — make containment detection reliable everywhere. | |
| 30 | The codex pack's agents silently stopped appearing in a downstream install's roster — find out why. | |
| 31 | Go back through the changelog and every codex-lane commit and determine which class of failure keeps recurring. | |
| 32 | The heavy-executor change is finished — give it a fresh-context adversarial review before it merges. | |
| 33 | Fresh installs into one downstream project kill every hook instantly — guard, doctor, everything crashes on launch there and nowhere else; fix it. | |
| 34 | Read the whole session record — both plans, both critiques, the audit, the ledger — and produce a summary of what's decided and what's still open. | |
| 35 | Add a regression test that reproduces the symlinked-tmpdir scratch-directory escape on every platform, not just macOS. | |
| 36 | Make the whole OpenAI surface an opt-in pack so a default install is Claude-only. | |
| 37 | Work out how much of each vendor's window the field run's two lanes actually drew, and whether the adversarial pressure was symmetric. | |
| 38 | The retirement chain just landed across both engine copies, four READMEs, and two suites — sweep for anything it missed. | |
| 39 | Build a planning command where a Claude architect and an OpenAI architect draft independently from one brief and a blind judge merges the strongest plan. | |
| 40 | Confirm the two heavy-tier agent files are byte-identical apart from the name and effort lines. | |

<!--
Source commits (audit trail; one short sha per item — the commit whose work the request
was reverse-derived from; several commits source more than one item because they landed
more than one task):
 1: dab5fe5    2: 06dd657    3: f958183    4: acca34f    5: bbbd983
 6: 8dce759    7: 1cb50b8    8: 84da4ad    9: 54c8c76   10: 177b42e
11: 597a4ba   12: 6f2ae2f   13: ed66435   14: 9bee85f   15: 17a24d4 (and 7c94e7b)
16: e6cb8de   17: bf7daa5   18: de62e90 (and e9e9338 motivation)   19: 09ec342   20: 90db9e7
21: fc30348   22: bbbd983   23: 4636479   24: 98a5157   25: bb5b574
26: e116193   27: f7aaf80   28: 6d6df88   29: 296b551   30: 4ed7a03
31: 06dd657   32: f564682   33: d7738df   34: 177b42e   35: f958183
36: 0bcc2a0   37: e116193   38: 1cb50b8   39: e9e9338   40: f7aaf80
-->
