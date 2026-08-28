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

*(Director: carry this section into the brief's GROUND TRUTH section, identically for both lanes.)*

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
