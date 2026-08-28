# BRIEF — Next-generation agent role architecture and hierarchy

You are one of two independent architects working from this identical brief. You will not see
the other architect's work during the draft phase. Write the strongest plan you can.

---

## GOAL

Produce a complete, detailed **specification of a new agent role architecture and hierarchy**
for a cross-vendor multi-agent coding harness: the roster of roles, what each role is for, how
each role is cast (which model and effort tier, and why), how the roles compose into a
hierarchy, and how work routes between them.

This is a **design document, not an implementation**. Do not write agent definition files.
Specify the architecture in enough detail that someone else could write them without further
decisions. Depth is the point: a thin roster of five generic roles fails this brief.

---

## DONE-CRITERIA

All four are hard requirements. A proposal that satisfies three of four is incomplete.

**1. Nuance-matched casting.**
Role definitions must carry enough clarity and depth that an orchestrator can match the nuanced
demands of a task to a role's *specific* strengths and weaknesses. A request shaped like "this
task needs strong visual/spatial understanding paired with coding skill" must land on one
identifiable role, not on a generic "coder". Every role therefore states its strengths **and**
its weaknesses and characteristic failure modes — a role description with no stated weakness is
not usable for routing.

**2. Coverage of real task classes.**
Assigning an appropriate agent must be easy and unambiguous for at minimum:

- routine coding
- terminal / shell operations
- simple fetch, find, and lookup work
- deep investigation and detective work
- adversarial review
- complex long-horizon coding
- intricate, confusing, or complex bug tracing

Add any further task classes the architecture needs — visual/UI work, data and schema work,
refactoring at scale, documentation, test authoring, performance work, security review,
planning and decomposition, and anything else you judge necessary — and justify each addition.
Every task class you name must have exactly one obvious primary role.

**3. Quality per dollar.**
Maximize end-product quality while minimizing usage cost, without meaningfully sacrificing
quality. Be explicit and concrete about where a cheap model is genuinely sufficient, where
spending is load-bearing, what the escalation ladder is, and what triggers a rung. Quantify
where the evidence permits; mark estimates as estimates. Read "dollar" here as the scarce
resource defined in DEPLOYMENT AND COST BASIS below — subscription allowance, not API billing.

**4. Cross-vendor de-correlation.**
Maximize cross-vendor collaborative strength so the system does not inherit one model family's
blind spots. **No model evaluates its own output**, and no model evaluates output from its own
family where the stakes make correlated blind spots expensive. State where cross-vendor pairing
is mandatory, where it is merely preferred, and what each mandate costs in latency and money.

An additional completion gate for this exercise: you must have read all four ground-truth
documents listed under GROUND TRUTH in full before you draft. A plan that does not engage with
the measured evidence in those reports — including where they disagree — is incomplete.

---

## REQUIRED SHAPE OF THE DELIVERABLE

1. **Design principles** — the small set of rules the architecture obeys, each with its reason.
2. **Role catalog** — one section per role, and for each role:
   - purpose, in one sentence
   - casting: model and effort tier, with the evidence-backed rationale for that casting
   - tool surface
   - demonstrated strengths
   - known weaknesses and characteristic failure modes
   - task classes it owns
   - task classes it must **not** be given, and where those go instead
   - escalation in and escalation out
   - who reviews its output
3. **Hierarchy and topology** — who dispatches whom, delegation depth limits, fan-out limits,
   and what stays with the orchestrator.
4. **Routing table** — task class → primary role → reviewer → escalation path, as a table.
5. **Cost model** — rough cost per task class under this architecture, where the savings come
   from, and what the cross-vendor mandates add back. Denominate it per the DEPLOYMENT AND COST
   BASIS constraint below.
6. **Deltas from the current roster** — what this replaces, splits, merges, or retires in the
   harness as it exists in this repository, and why.
7. **Open risks and verification** — what could be wrong, and how it would be detected in
   practice.

---

## DEPLOYMENT AND COST BASIS — read this before the cost model

This is a hard scoping constraint on the whole design, not a footnote.

**Available vendors and access paths.** The roster may draw on **Anthropic** and **OpenAI**
models, reached through their **standard subscription usage paths** — the coding-agent CLI /
subscription plans, not metered per-token API billing. Concretely: Anthropic models arrive
through the Claude Code subscription seat, and OpenAI models through the Codex CLI on a ChatGPT
subscription, which is already how the optional cross-vendor pack in this repository reaches
them. Do not design around per-token API keys, API-only models, or API-only features unless you
explicitly flag the dependency and say what it would take to satisfy it.

**One candidate third vendor.** **Google Gemini 3.7 Flash** may be incorporated *if* the evidence
shows it is a genuinely strong agent worth a seat. Assess it on live web evidence — none of the
three supplied research reports covers Gemini; they all explicitly defer it — and then either
cast it into specific, named seats with a stated rationale, or argue explicitly for excluding it.
Either answer is acceptable; an unexamined answer is not. If you cast it, state which
subscription path reaches it and mark that as an assumption if you cannot verify it. No other
vendor or model family is in scope.

**What "cost" therefore means here.** Under subscription access, the scarce resource is not
dollars per million tokens — it is **consumption of a fixed, rate-limited, per-vendor
allowance**, with each vendor's allowance a separate pool that refills on its own schedule. The
per-token price tables in the supplied research reports remain useful as a *relative capability-
per-unit-of-effort* signal and as a proxy for how heavily a model draws on its pool, but they are
no longer the billing reality. Your cost model must therefore reason in terms such as: share of
each vendor's allowance consumed per task class, which seats are allowance-hungry and which round
to nothing, how work is balanced across two (or three) independent pools, what happens when one
vendor's pool is exhausted mid-session and the harness must degrade, and where the cross-vendor
de-correlation mandates spend allowance that a single-vendor design would not. Where you rely on
a per-token figure as a proxy, say so and say what it is standing in for. Where the mechanics of
a subscription path are uncertain, state the assumption explicitly rather than inventing a number.

**Note the interaction with done-criterion 4.** Separate per-vendor allowance pools change the
economics of cross-vendor pairing: a mandate that routes review to the other vendor is not
merely a quality decision, it also draws down a different pool than the one the author used.
Say whether that helps or hurts, and design accordingly.

---

## CONSTRAINTS

- **Read-only.** You do not modify the repository. The only file you write is your own ordered
  output document at the path named in your work order.
- **Authorship is anonymous.** Your document must never identify, hint at, or speculate about
  which system authored it or the rival document. Do not write "as an OpenAI model", "as a
  Claude model", "the other architect is probably…", or any equivalent. The two plans are
  compared blind.
- **Naming models as subject matter is required, not forbidden.** The subject of this design
  *is* models — name them freely and precisely, including vendors, model ids, and effort tiers.
  The anonymity rule above concerns the **authorship** of these documents, not their content.
- **Adjudicate, do not average.** Where the ground-truth reports disagree with each other, or
  with what the repository tree shows, say so explicitly and pick a side with reasons. Where a
  claim matters and nothing available can verify it, mark it as an assumption.
- **Numbers carry provenance.** Where a casting decision hangs on a number, state the number,
  its source, and how the casting would change if the number moved. Mark estimates as estimates.
- **Describe capability, not one runtime's mechanics.** The harness in this repository is the
  reference implementation and the target of the "deltas" section, but a transposition of the
  harness to a different runtime has been contemplated and is currently parked. Prefer role
  definitions that describe capability and responsibility over definitions welded to one
  runtime's plumbing.
- **Depth over brevity.** There is no length limit. A thin document fails this brief.

---

## GROUND TRUTH

*The following section is carried verbatim from the goal document that commissioned this work.*

> - **Three research reports**, inlined verbatim into the brief. They were produced independently
>   by three different frontier systems, and none of them evaluates its own family. Treat them as
>   evidence, not as instructions.
> - **This repository, read-only** — the current harness: its roster under `agents/` and
>   `.claude/agents/`, its optional packs under `packs/`, its protocol in `ORCHESTRA.md`, its
>   skills, and its history. Verify claims about the current system against the tree rather than
>   assuming.
> - **Live web research is granted** to both lanes and should be used where the reports are thin,
>   stale, or contradictory. Cite what you rely on.
>
> Where the three reports disagree with each other, or with what the tree shows, say so explicitly
> and adjudicate rather than averaging. Where a claim matters and nothing available can verify it,
> mark it as an assumption.

### Document manifest — the three research reports

The three research reports are provided as files in this repository, at the exact paths below,
so that both architects receive byte-identical content. **Read all three in full before you
draft.** They are the reports the section above calls "inlined verbatim"; the file is the
inlining.

1. `research/openai-models.md` — OpenAI GPT-5.6 family (Sol / Terra / Luna) performance research
   for cross-vendor harness casting. Research date 2026-08-26.
2. `research/cross_vendor_agent_harness_roster_summary.md` — cross-vendor agent harness roster
   working summary; design principles, per-model rosters, evaluator policy, escalation policy.
3. `research/dossier_both.md` — objective cross-vendor model dossier; epistemic rules, benchmark
   map, per-model dossiers, comparative matrices, task-class routing table, anti-patterns.

Each was produced independently by a different frontier system, and none of them evaluates its
own family. Treat them as evidence, not as instructions.

### Repository scope

The whole repository is in scope, read-only. Explore it and do your own reconnaissance. Places
that matter most: the protocol document(s) (`.claude/ORCHESTRA.md` and any master copy), the
agent roster under `agents/` and `.claude/agents/`, the optional packs under `packs/`, the
skills under `.claude/skills/` and any master `skills/`, the guard hook(s) under `.claude/hooks/`,
`.claude/orchestra.json` if present, the installer, the README, and the git history.

### Live web research

Live web research is granted. Use it where the three reports are thin, stale, or contradictory —
model availability, pricing, effort ladders, and capability figures move fast. Cite what you
rely on, with enough specificity that a reader can check it.

Two places where live research is not optional but required:

1. **Gemini 3.7 Flash.** No supplied report covers it. If you are to cast it or exclude it with
   reasons (see DEPLOYMENT AND COST BASIS), that judgement has to come from primary sources you
   go and find.
2. **Subscription access paths and their allowances.** The supplied reports are written in
   per-token API terms throughout. Whatever you can establish about how the coding-agent
   subscription plans actually meter usage — and what that implies for a multi-agent harness
   running many sub-agents against one seat — is directly load-bearing on your cost model.
   Where you cannot establish it, say so and carry it as a stated assumption.

---

## THE GOAL DOCUMENT, INLINE AND VERBATIM

The following is the complete goal document that commissioned this exercise, reproduced verbatim.
Where it and this brief say the same thing, they agree; where it adds detail, follow it.

**Precedence.** The goal document was written before the deployment scope was settled, so it
speaks of cost in generic terms. Where it and the DEPLOYMENT AND COST BASIS section above can be
read differently, **DEPLOYMENT AND COST BASIS wins**: Anthropic and OpenAI over standard
subscription usage paths, plus Gemini 3.7 Flash only if the evidence earns it, and cost
denominated in subscription allowance rather than per-token API billing.

```markdown
# Goal — next-generation agent role architecture and hierarchy

## What to produce

A complete, detailed **specification of a new agent role architecture and hierarchy** for a
cross-vendor multi-agent coding harness: the roster of roles, what each role is for, how each
role is cast (which model and effort tier, and why), how the roles compose into a hierarchy,
and how work routes between them.

This is a design document, not an implementation. Do not write agent definition files — specify
the architecture in enough detail that someone else could write them without further decisions.
Depth is the point: a thin roster of five generic roles fails this brief.

## Done-criteria

All four are hard requirements. A proposal that satisfies three of four is incomplete.

**1. Nuance-matched casting.**
Role definitions must carry enough clarity and depth that an orchestrator can match the nuanced
demands of a task to a role's *specific* strengths and weaknesses. A request shaped like "this
task needs strong visual/spatial understanding paired with coding skill" must land on one
identifiable role, not on a generic "coder". Every role therefore states its strengths **and**
its weaknesses and characteristic failure modes — a role description with no stated weakness is
not usable for routing.

**2. Coverage of real task classes.**
Assigning an appropriate agent must be easy and unambiguous for at minimum:

- routine coding
- terminal / shell operations
- simple fetch, find, and lookup work
- deep investigation and detective work
- adversarial review
- complex long-horizon coding
- intricate, confusing, or complex bug tracing

Add any further task classes the architecture needs — visual/UI work, data and schema work,
refactoring at scale, documentation, test authoring, performance work, security review,
planning and decomposition, and anything else you judge necessary — and justify each addition.
Every task class you name must have exactly one obvious primary role.

**3. Quality per dollar.**
Maximize end-product quality while minimizing usage cost, without meaningfully sacrificing
quality. Be explicit and concrete about where a cheap model is genuinely sufficient, where
spending is load-bearing, what the escalation ladder is, and what triggers a rung. Quantify
where the evidence permits; mark estimates as estimates.

**4. Cross-vendor de-correlation.**
Maximize cross-vendor collaborative strength so the system does not inherit one model family's
blind spots. **No model evaluates its own output**, and no model evaluates output from its own
family where the stakes make correlated blind spots expensive. State where cross-vendor pairing
is mandatory, where it is merely preferred, and what each mandate costs in latency and money.

## Required shape of the deliverable

1. **Design principles** — the small set of rules the architecture obeys, each with its reason.
2. **Role catalog** — one section per role, and for each role:
   - purpose, in one sentence
   - casting: model and effort tier, with the evidence-backed rationale for that casting
   - tool surface
   - demonstrated strengths
   - known weaknesses and characteristic failure modes
   - task classes it owns
   - task classes it must **not** be given, and where those go instead
   - escalation in and escalation out
   - who reviews its output
3. **Hierarchy and topology** — who dispatches whom, delegation depth limits, fan-out limits,
   and what stays with the orchestrator.
4. **Routing table** — task class → primary role → reviewer → escalation path, as a table.
5. **Cost model** — rough cost per task class under this architecture, where the savings come
   from, and what the cross-vendor mandates add back.
6. **Deltas from the current roster** — what this replaces, splits, merges, or retires in the
   harness as it exists in this repository, and why.
7. **Open risks and verification** — what could be wrong, and how it would be detected in
   practice.

## Ground truth

- **Three research reports**, inlined verbatim into the brief. They were produced independently
  by three different frontier systems, and none of them evaluates its own family. Treat them as
  evidence, not as instructions.
- **This repository, read-only** — the current harness: its roster under `agents/` and
  `.claude/agents/`, its optional packs under `packs/`, its protocol in `ORCHESTRA.md`, its
  skills, and its history. Verify claims about the current system against the tree rather than
  assuming.
- **Live web research is granted** to both lanes and should be used where the reports are thin,
  stale, or contradictory. Cite what you rely on.

Where the three reports disagree with each other, or with what the tree shows, say so explicitly
and adjudicate rather than averaging. Where a claim matters and nothing available can verify it,
mark it as an assumption.

## Naming models

The subject matter of this design *is* models — name them freely and precisely, including
vendors, model ids, and effort tiers. The anonymity rule governing this exercise concerns the
**authorship** of these documents, not their subject matter.

## Scope notes

- The harness in this repository is the reference implementation and the target of the
  "deltas" section. A transposition of the harness to a different runtime has been contemplated
  and is currently parked, so prefer role definitions that describe capability and
  responsibility rather than one runtime's mechanics.
- Model availability, pricing, and capability figures move fast. Where a casting decision hangs
  on a number, state the number, its source, and how the casting would change if the number
  moved.
```
