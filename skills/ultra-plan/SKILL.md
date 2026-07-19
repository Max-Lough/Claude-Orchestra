---
name: ultra-plan
description: Two-model adversarial planning roundabout - the session's director model drafts a full plan, a different-vendor OpenAI counterpart (GPT-5.6 Sol at max effort by default) critiques it and counter-drafts via the API, and the plan ping-pongs until either model approves it without changes. Accepts effort=, model=, and rounds= arguments. Use when the user asks for an ultra plan, maximum-rigor or cross-vendor planning, or a second model's eyes on a plan before large or risky work. Requires OPENAI_API_KEY.
---

# Ultra-plan — the two-model planning roundabout

Produce a plan that has survived adversarial review by a model from a **different vendor** before any work order is cut. You (the director model) draft; an OpenAI counterpart — GPT-5.6 Sol at `max` reasoning effort by default — critiques and counter-drafts; the plan ping-pongs until **one side approves the standing plan with no changes**. Orchestration-class: you author plan files (the §3.1 carve-out) and dispatch the `planner-gpt` launcher; you never call the API or run commands yourself. In a dormant or paused session, run the same loop directly (`node .claude/hooks/orchestra-ultraplan.js --plan <file> …` yourself).

Each consultation is billed to the user's **OpenAI** key and, at `max` effort, can take minutes — that cost is the point (planning errors are the most expensive kind), but say so in your first beat, and use `effort=high` when the user wants a cheaper pass.

## Arguments

Tokens anywhere in the invocation text; everything else is the goal:

- `effort=<none|low|medium|high|xhigh|max>` — counterpart reasoning effort for every round (default `max`, or `ORCHESTRA_ULTRAPLAN_EFFORT`).
- `model=<id>` — counterpart model (default `gpt-5.6-sol`, or `ORCHESTRA_ULTRAPLAN_MODEL`).
- `rounds=<n>` — consultation cap (default 4).

No goal and none inferable from conversation → AskUserQuestion before anything else.

## The roundabout

1. **DRAFT (you, solo).** Full `orchestra-plan` discipline: INTAKE with done-criteria, RECON through scouts, §8.1 sizing, §8.3 tiers, written to `.claude/plans/<kebab-slug>.md` in the orchestra-plan template. This draft must be **complete and detailed** — the counterpart critiques exactly what you hand it, and a sketchy draft wastes the most expensive review in the harness.
2. **CONSULT (round n of the cap).** Compose the round brief:
   - Round 1: goal, done-criteria, hard constraints, and the recon facts (with paths) the plan rests on — the counterpart has no repo access; the brief is its only ground truth.
   - Round n>1: additionally a **disposition record** for every point of the previous critique — `ADOPTED (how)` or `REBUTTED (why)` — plus any questions you have for the counterpart.
   Dispatch **`planner-gpt`** with: the plan file path, the brief verbatim, the round number, and `effort=`/`model=` if given. It relays the counterpart's verdict untouched.
3. **ARBITRATE.** On the verdict:
   - **`VERDICT: APPROVE`** → converged: the counterpart accepts the standing plan unchanged. Finalize (step 4).
   - **`VERDICT: REVISE`** → read the CRITIQUE and UPDATED PLAN critically — you are the arbiter, and both rubber-stamping and reflexive dismissal defeat the roundabout. Disposition every point:
     - You adopt the counterpart's updated plan **verbatim — zero further edits**: write it to the plan file; that is *your* approval with no feedback → converged. Verbatim adoption is a judgment call that the plan is right, never a shortcut to end the loop.
     - Anything less: merge what you adopt into the plan file, keep what you rebut (with recorded reasons — rebuttals feed the next brief; adopting nothing is a legitimate disposition), and go to the next round with the revised plan. If the relay flags truncation, Read the `RESPONSE SAVED:` file before merging — never adopt a plan you saw only part of.
   - **`VERDICT: ULTRAPLAN_UNAVAILABLE`** → stop the loop; this is never an approval. Report the DETAIL, then let the user choose: fix the condition (key, model, effort, timeout, token cap) and resume the round, or keep the solo plan **explicitly marked as not cross-examined**.
4. **FINALIZE.** Append an `## Ultra-plan log` section to the plan file: per round — verdict, finding count, dispositions summary; then how convergence happened (counterpart approved / director adopted verbatim / round cap), and the model + effort used.
5. **Round cap without convergence** is a legitimate outcome: keep the latest merged plan, log the still-disputed points as OPEN QUESTIONS, and put those to the user — the two models disagreeing after N honest rounds is exactly what a human should arbitrate.

## Report

One beat per round while running (verdict + what changed hands). At the end: how convergence happened and in how many rounds, what the roundabout actually changed (the big shifts, not every edit), open questions if capped, the plan file path, and the next step — plan-mode sign-off or EXECUTE per §4. If any consultation was skipped or unavailable, say so plainly; never present a solo plan as cross-examined.
