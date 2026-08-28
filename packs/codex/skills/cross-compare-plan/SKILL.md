---
name: cross-compare-plan
description: Two-architect comparative and adversarial planning session - two frontier models from different vendors (a fresh-context Claude architect and an OpenAI counterpart, GPT-5.6 Sol via the Codex CLI, both read-only in the tree) independently draft plans from one shared brief, cross-critique each other, revise under critique, a blind synthesizer merges the strongest final plan, escalating only genuine ties to the user, and by default a cross-family audit critiques the finished plan. Accepts effort=, model=, context=, docs=, and audit= arguments. Use when the user asks for a cross-compare plan, wants two independent plans compared and merged, or wants adversarial multi-model planning of a goal, approach, engineering hurdle, or pathway where the right framing is itself uncertain. Requires the codex pack (Codex CLI).
---

# Cross-compare plan — two architects, one blind merge

Produce a plan that survived **independent parallel design** before it survived review. Two architects from different vendors receive the identical brief and draft without seeing each other; the drafts are cross-critiqued (steelman first, findings tagged by severity), each owner revises under critique with a disposition per finding, and a **blind synthesizer** (fresh-context Opus) merges the strongest final plan — taking the best of each, adjudicating disputes against the tree, and escalating only genuine ties to the user. This session explores TWO framings of the same problem and merges them: reach for it when the approach itself is uncertain.

Orchestration-class: you (the Director) write the brief and verify artifacts exist (the §3.1 carve-outs), and you dispatch every phase; you never draft, critique, or judge content yourself — you stay OUT of the arbitration so the merge stays blind. A dormant or paused session can run the same waves directly (`node .claude/hooks/orchestra-crossplan.js --phase …` for the GPT lane), but it then plays the Claude architect itself and loses fresh-context independence and blind synthesis — say so plainly if you run it that way.

The session costs **eight frontier consultations** with the default post-synthesis audit (2 drafts + 2 critiques + 2 revisions + 1 synthesis + 1 audit), **seven** with `audit=off`; the GPT lane bills to the user's Codex CLI account and each of its phases can take many minutes at high effort. That cost is the point — planning errors are the most expensive kind — but say so in your first beat.

## Arguments

Tokens anywhere in the invocation; everything else is the goal (none inferable → AskUserQuestion before anything else):

- `effort=<high|xhigh|max>` — ONE level, applied identically to both lanes (default `high`). The GPT lane takes it as a flag; the Claude lane takes it as routing — `high` → `architect-claude`, `xhigh` → `architect-claude-xhigh`, `max` → `architect-claude-max`. Any other value is an error: unequal effort would measure budgets, not judgment.
- `model=<id>` — the GPT architect's model (default `gpt-5.6-sol`, or `ORCHESTRA_CROSSPLAN_MODEL`).
- `context=<repo|none|comma-separated paths>` — the GROUND TRUTH scope, identical for both architects (default `repo`): `repo` = explore the tree read-only and recon first-hand; paths = confine reading to those paths; `none` = the brief and its documents are the only ground truth.
- `docs=<comma-separated paths>` — text documents to include as ground truth. Read each (§3.1 — user-handed files) and inline it into the brief under a labeled heading, so both architects receive byte-identical content. Inlining **verbatim is mandatory regardless of size** — a brief that lists the paths instead of the content is a brief defect: it degrades the byte-identical guarantee to "both architects hopefully read the same files". When the total inlined content would exceed ~100KB, warn the user of the context cost in the INTAKE beat and you may OFFER `context=` paths as the alternative — but never silently substitute references for content.
- `audit=<on|off>` — the post-synthesis cross-family audit wave (default `on`). With two vendors and three seats the synthesizer always shares a model family with one architect; blind judging removes identity bias but not family-correlated blind spots, so the finished plan gets one critique from the family the synthesizer is NOT. `on` costs the eighth consultation; `off` skips it.

## Anonymity law

Model-name mentions in planning documents cause unwanted downstream behavior, so the exercise is anonymous end to end: assign the two architects the letters **A** and **B** for this session and record the lane↔letter mapping ONLY in the conversation — never in the brief, any order, any document, or the final plan. Both lanes' charters already forbid self-identification; the synthesizer judges blind and keeps the final plan model-free. Your **report to the user** may name models; the files never do.

## The waves

All artifacts live in `.claude/plans/cross-compare/<kebab-slug>/`. Never start a wave before both documents of the previous wave exist (Read to verify — §3.1 permits reading agent artifacts; verifying existence and shape is yours, judging content is not). Never edit an architect's document.

1. **INTAKE.** Restate the goal; write concrete done-criteria. State the cost. Genuine ambiguity → AskUserQuestion now.
2. **BRIEF (you, solo).** Write `brief.md`: GOAL, DONE-CRITERIA, CONSTRAINTS, and a GROUND TRUTH section stating the `context=` scope, stating **explicitly whether live web research is granted** (both lanes carry web capability, so the grant is identical for both by construction — a brief that stays silent reads as no grant), and carrying any `docs=` content inline. One brief, byte-identical for both architects, naming no model or vendor.
3. **DRAFT (parallel).** Dispatch both in one message:
   - Claude lane (`architect-claude`, or `-xhigh` / `-max` per `effort=`): order = phase `draft`, the brief path, output `plan-<letter>-v1.md`.
   - GPT lane (`architect-codex`): order = phase `draft`, the brief **verbatim**, `out_path` `plan-<letter>-v1.md`, plus `effort=`/`model=` only if given.
4. **CRITIQUE (parallel, swapped).** Each architect receives its OWN v1 and the RIVAL v1 and writes `critique-of-<rival letter>.md` — steelman, then numbered findings tagged [BLOCKER]/[MAJOR]/[MINOR], then the comparative assessment. The charters carry the focus list; your orders carry only phase, paths, and output.
5. **REVISE (parallel).** Each architect receives its OWN v1 and `critique-of-<own letter>.md` and writes `plan-<letter>-v2.md` — the complete plan with a `## Critique dispositions` section giving every finding exactly one ADOPTED/REBUTTED.
6. **SYNTHESIZE.** Dispatch `plan-synthesizer` with the brief, both v2 plans, and both critiques (paths only, letters only — the order must not reveal the mapping), output `final-plan.md` in the orchestra-plan template. It merges, adjudicates rebutted findings against the tree, flags shared risky assumptions under `## Verify during execution`, and returns OPEN DECISIONS (at most 4) only for material, evidence-balanced, consequential ties.
7. **ESCALATE (only if open decisions).** Put them to the user via AskUserQuestion, then send the rulings back to the same synthesizer agent to apply, clear the `PENDING DECISION` markers, and confirm.
8. **FINALIZE.** Confirm `final-plan.md` is complete and model-free. Next step per §4 — plan-mode sign-off or EXECUTE (after the AUDIT wave, unless `audit=off`).
9. **AUDIT (default; skipped only by `audit=off`).** One more consultation, cross-family by construction: the synthesizer is always a Claude model, so the audit always comes from the GPT lane — the family the synthesizer is NOT. Dispatch `architect-codex` in phase `critique` with `own_plan_path` = that lane's own `plan-<letter>-v2.md`, `rival_plan_path` = `final-plan.md`, output `audit-of-final.md`. Report the audit's findings to the user; then mechanical/factual findings the user accepts are applied by re-dispatching the SAME synthesizer agent with the audit findings and the rulings (mirroring the ESCALATE wave), while design-level findings go to the user as decisions. You never apply a finding yourself.

## Failure rules

- GPT lane returns `STATUS: CROSSPLAN_UNAVAILABLE` → stop the wave and report the DETAIL. The lane is read-only, so once the user fixes the named condition (auth, install, timeout) the same phase re-dispatches safely. Never continue single-architect on your own: a one-architect run is not a cross-compare, and presenting one as such is the worst outcome this skill can produce. If the user chooses to proceed solo, route to `/orchestra-plan` and say what changed.
- Claude lane dies or returns nothing → re-dispatch that phase once; twice → treat like the rule above.
- An architect's document that ignores its output contract (missing dispositions, no steelman, a critique that misses the coverage contract — rival-plan sections neither addressed by a finding nor accounted for under `## Sections examined and found sound`) → re-dispatch that phase once with the defect named; never repair it yourself.
- The AUDIT wave's lane unavailable → the plan is not un-finished by it. Report the plan complete but **UNAUDITED**, plainly — never audit it yourself, and never present an unaudited run as an audited one.

## Report

One beat per wave (what finished; finding counts at critique; adopted/rebutted counts at revise). At the end: what the synthesis took from each lane (by letter), disputes adjudicated and open decisions with their rulings, the audit's finding counts with what was applied versus deferred to the user (or **UNAUDITED**, if the audit lane was unavailable or `audit=off` was given), the verify-during-execution list, the final plan path, and the next step. If any phase was skipped or unavailable, say so plainly; never present a partial run as a cross-compared plan.
