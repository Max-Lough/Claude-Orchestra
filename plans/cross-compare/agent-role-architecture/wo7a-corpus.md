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
| 1 | When did the default reviewer switch back to Opus, and which commit made the change? | N0 |
| 2 | Replace the codex launcher shell scripts with a proper MCP server that exposes the existing runners as typed tools. | E3 |
| 3 | Codex reviews fail instantly on Windows with EINVAL whenever codex was installed through npm — get the engine launching there. | E0 |
| 4 | Version 1.8.0 has no changelog entry — reconstruct one from the commit and record it. | D0 |
| 5 | Add a specialist that can drive Blender and Godot to model and import game assets for a project. | E6 (ambiguous with E2) |
| 6 | The guard hook re-reads the session transcript on every blocked tool call — check whether it's slowing sessions down, and make it faster if it is. | I1 |
| 7 | Retire the /deep-plan lane completely — remove the tool, the agent, the runner, and every reference to them. | E8 |
| 8 | Set up CI that runs the review-lane suite on Linux, Windows, and macOS. | E0 |
| 9 | The cross-vendor review lane has produced no verdicts for six days and reports nothing wrong — find out what's broken and fix it. | I1 |
| 10 | Two complete architecture plans for the new roster disagree — adjudicate them and produce a single merged plan. | A1 |
| 11 | A Godot project's first-open import floods the review integrity warning with 180 generated sidecar files — stop the false alarm. | I1 |
| 12 | Stopping an agent mid-run doesn't stop the engine underneath — it keeps editing the working tree unattended; make cancellation actually end the run. | I1 |
| 13 | Swap the hardcoded local install path in the docs for a placeholder wherever it appears, and add a license. | E1 |
| 14 | Find out how the GPT-5.6 tiers actually perform on visual design and 3D/game coding, and fold that evidence into the research report. | N1 |
| 15 | Before the Director write carve-outs ship, probe them the way an attacker would — path traversal, smuggled extensions, stripped managed markers. | E7 |
| 16 | The exec lane relayed a weeks-old report as DONE for an order that never ran — find the root cause. | I0 (ambiguous with I1) |
| 17 | Which projects on this machine still have harness installs older than the current master version? | N0 |
| 18 | Single-architect plans keep locking in their first framing — propose a way to get genuinely adversarial pressure on a plan before it executes. | A0 |
| 19 | Add OpenAI-model executors to the codex pack so implementation work can run cross-vendor, mirroring the review lane. | E2 |
| 20 | A tiny 9-line docs review burned its full time budget twice and returned no verdict — figure out what the review lane is doing and fix it. | I1 |
| 21 | Rename /ultra-plan to /deep-plan everywhere — skill, agents, runner, installer, docs. | E1 |
| 22 | Build a per-project harness that makes the session a non-editing director and routes all work through scout, executor, and reviewer subagents. | E3 |
| 23 | Decide which model should hold the top orchestration seat now that the incumbent's user-facing reports keep degrading into garbled prose. | O0 |
| 24 | Agents keep ending their turn while a background run is still going, and the results reach nobody — make that against the rules everywhere commands run. | E8 |
| 25 | CI case 13 fails on all three macOS runners and passes on Linux and Windows — work out why and fix it. | E0 |
| 26 | Take the three research reports we already have and pull the benchmark and seat-assignment tables into the shared planning brief. | M0 |
| 27 | Add an xhigh variant of the heavy executor — same law word for word, only the effort pin differs. | E1 |
| 28 | Add a capable read-only agent for root-cause investigations, and narrow the scout to where/what missions. | E2 |
| 29 | The "is this directory inside the repo" check answers differently on Windows short names and macOS symlinks for the same layout — make containment detection reliable everywhere. | E0 |
| 30 | The codex pack's agents silently stopped appearing in a downstream install's roster — find out why. | I0 |
| 31 | Go back through the changelog and every codex-lane commit and determine which class of failure keeps recurring. | N2 |
| 32 | The heavy-executor change is finished — give it a fresh-context adversarial review before it merges. | R0 |
| 33 | Fresh installs into one downstream project kill every hook instantly — guard, doctor, everything crashes on launch there and nowhere else; fix it. | E0 |
| 34 | Read the whole session record — both plans, both critiques, the audit, the ledger — and produce a summary of what's decided and what's still open. | N2 |
| 35 | Add a regression test that reproduces the symlinked-tmpdir scratch-directory escape on every platform, not just macOS. | Q0 |
| 36 | Make the whole OpenAI surface an opt-in pack so a default install is Claude-only. | E8 |
| 37 | Work out how much of each vendor's window the field run's two lanes actually drew, and whether the adversarial pressure was symmetric. | P0 |
| 38 | The retirement chain just landed across both engine copies, four READMEs, and two suites — sweep for anything it missed. | S0 |
| 39 | Build a planning command where a Claude architect and an OpenAI architect draft independently from one brief and a blind judge merges the strongest plan. | E3 |
| 40 | Confirm the two heavy-tier agent files are byte-identical apart from the name and effort lines. | V0 |

## Comparison with the sealed pass

The independent pass above was completed and saved before
`wo7a-model-classification-SEALED.md` was opened. For scoring, a sealed provisional class is
treated as that pass's class; an ambiguity flag does not erase a class disagreement.

**Result: 31/40 agreement (77.5%) — FAIL.** This is below the required 36/40 threshold.
There are two genuine ambiguities (items 5 and 16), which is at the allowed maximum. Per the
pre-registered rule, the class boundaries must be redrawn before WO-4 encodes them.

### Disagreement ledger

| # | This pass | Sealed pass | Class pair | Boundary finding |
|---|-----------|-------------|------------|------------------|
| 5 | E6 | E2 (provisional; ambiguous) | E2/E6 | The E6 signal list classifies subject-matter words while E2 classifies the requested artifact. State explicitly that the requested work product and current phase win over domain nouns. |
| 8 | E0 | E2 | E0/E2 | `CI` is an unconditional E0 signal even when the request is to author a new, known workflow. Separate environment diagnosis/remediation from routine CI configuration authoring. |
| 9 | I1 | E0 | E0/I1 | Discriminator A's `Unknown → E0` can absorb any undiagnosed runtime bug. Require affirmative environment/toolchain variance for E0; otherwise a run/instrument-first behavior failure starts at I1. |
| 11 | I1 | E2 | E2/I1 | The table does not state whether a symptom report with no confirmed cause routes to investigation or directly to a presumed routine fix. Add a diagnosis-before-implementation phase rule. |
| 19 | E2 | E3 | E2/E3 | `Could ... finish in one run` is too subjective, and the sealed rationale relies on implementation facts absent from the request. Define E3 with observable coupled contracts or inseparable acceptance units. |
| 21 | E1 | E8 | E1/E8 | E8 names `rename` and `everywhere`, while discriminator I sends a literal, enumerable, grep-verifiable rename to E1. Reserve E8 for context-sensitive semantic migrations; route exact token substitutions to E1. |
| 24 | E8 | E2 | E2/E8 | There is no E2/E8 discriminator for one known rule applied across many independently authored consumers. Distinguish a bounded/central implementation unit from a census-driven multi-consumer migration. |
| 31 | N2 | I0 | I0/N2 | There is no discriminator between causal investigation and synthesis over a large fixed corpus. Route by the dominant uncertainty: hypothesis/falsification → I0; corpus volume/reconciliation → N2. |
| 36 | E8 | E3 | E3/E8 | Discriminator H does not settle work containing both a novel core mechanism and an N-consumer migration. Make E3 own the novel interlocked core with an E8 child order; keep pure fan-out migrations in E8. |

### Genuine ambiguities

- **Item 5 — E2/E6:** the requested artifact is an agent definition, but the E6 row's literal
  signals describe the agent's downstream subject matter. This pass selected E6 under the
  table as written; the sealed pass selected E2 provisionally.
- **Item 16 — I0/I1:** the intake text cannot establish whether reading the existing protocols
  will settle the stale-relay cause or whether a reproduction/instrumentation run is required.
  Both passes selected I0 provisionally.

No item was struck as a corpus defect. Several sealed rationales use solution facts that are
not present in the one-line requests; those are comparison-pass defects and reinforce the need
for boundaries decidable from intake text alone.

## Boundary redraw (2026-08-29)

Applied to `final-plan.md` per the pre-registered rule: a **signals-precedence rule** in the
Part 4 preamble (signals are recall hints; the requested work product and the discriminator
decide, from intake text alone), amended discriminators **A** (E0 requires an affirmative
environment axis in the request), **B** (unanswerable from intake → I0), **G** (E3 requires
coupled contracts observable in the intake text; named coupling beats a named template to
mirror, which otherwise → E2), **H** (novel core + fan-out → composite rule), **I** (exact
token substitution → E1 beats E8's signal words), new discriminators **S** (E0 vs E2:
environment the variable, or the artifact), **T** (E2 vs E8: one named central mechanism,
or a named surface set; topology unstated → E8), **U** (I0 vs N2: causal mechanism, or
cross-source synthesis), and a new **§4.2** with two phase rules:
diagnosis-before-implementation (an explicit E0 → I1 → I0 precedence chain, with the
intake-decidability corollary) and composite orders (E3 parent, E8/E1 child). No pair
logged more than one ambiguity, so no class merge was forced; the catalog itself is
unchanged.

An owner review the same day tightened the wording: the suspected-axis E0 triage clause was
removed (a suspected-but-unstated axis is no axis), T and U were recast on intake-visible
facts, G's mirror clause was subordinated to named coupling, the precedence rule gained the
operation-not-container clause (research into a report is N1, not D0 — protecting agreed
items 14/26/34 from container drift), and the routing table's signals column was renamed
"Recall signals" to match its demotion.

**Validation status.** The resolution table below is an answer key produced by the session
that drew the redraw — an audit trail, not an independent validation — and the original 40
items are burned for blinding now that the ledger and resolutions exist. **WO-4 stays gated
on WO-7a-bis** (defined in final-plan.md's WO-7a outcome): 15–20 fresh blinded items from
unused source commits, seeded on the redrawn boundaries, threshold ≥90% with ≤1 genuine
ambiguity.

### Post-redraw resolution of the flagged items

A paper check only — both original passes stand as recorded. The nine disagreements and two
ambiguities cover ten distinct items (item 5 appears in both sets); each resolves
determinately under the redrawn rules:

| # | Resolution | Deciding rule |
|---|-----------|---------------|
| 5 | E2 | Precedence: the deliverable is an agent definition; domain nouns don't route |
| 8 | E2 | Disc. S: authoring a specified workflow, nothing broken, env not the variable |
| 9 | I1 | Amended A + diagnosis rule: no environment axis stated; undiagnosed behavior failure, needs running |
| 11 | E2 | Diagnosis rule's direct-route clause: the request states its own cause (generated sidecars trip the census) and asks for the remedy |
| 16 | I0 | Amended B: running-needed unanswerable from intake → I0; "run an experiment" is a correct finish |
| 19 | E2 | Amended G: a named lane to mirror, no coupled contracts in the intake text |
| 21 | E1 | Amended I + E8 signals: exact enumerable token substitution, grep-verifiable |
| 24 | E8 | Disc. T: "everywhere commands run" names a surface set, each site to be found and touched |
| 31 | N2 | Disc. U: the deliverable is a recurring-category synthesis over a named fixed corpus, not a causal mechanism |
| 36 | E3 | Composite rule: novel pack/install-gating core owns acceptance; the surface migration is the E8 child |

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
