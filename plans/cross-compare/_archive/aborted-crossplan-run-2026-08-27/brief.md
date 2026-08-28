# Shared brief — next-generation agent role architecture and hierarchy

*This brief is byte-identical for both architects. It names no author. Do not attempt to
determine, guess, or state which system wrote any document in this exercise, including your own.*

---

## GOAL

Produce a complete, detailed **specification of a new agent role architecture and hierarchy**
for a cross-vendor multi-agent coding harness: the roster of roles, what each role is for, how
each role is cast (which model and effort tier, and why), how the roles compose into a
hierarchy, and how work routes between them.

The authoritative statement of the requirement is the goal document reproduced verbatim in
**§ GROUND TRUTH → Document 1** below. Follow it exactly. Where this brief and Document 1
appear to differ, Document 1 governs.

---

## DONE-CRITERIA

The four hard requirements are stated in Document 1 (§ "Done-criteria") and are reproduced
there verbatim. Restated here as the acceptance checklist your document is judged against:

1. **Nuance-matched casting.** Every role states its strengths *and* its weaknesses and
   characteristic failure modes, with enough specificity that an orchestrator can match a
   nuanced task ("strong visual/spatial understanding paired with coding skill") to one
   identifiable role. A role with no stated weakness is not usable for routing and does not
   count as complete.
2. **Coverage of real task classes.** Every task class named in Document 1 — plus every
   further class you judge the architecture needs, each justified — has exactly one obvious
   primary role. Assignment must be unambiguous.
3. **Quality per dollar.** Explicit and concrete about where a cheap model genuinely suffices,
   where spending is load-bearing, what the escalation ladder is, and what triggers each rung.
   Quantify where evidence permits; mark estimates as estimates.
4. **Cross-vendor de-correlation.** No model evaluates its own output, and no model evaluates
   output from its own family where correlated blind spots would be expensive. State where
   cross-vendor pairing is mandatory, where merely preferred, and what each mandate costs in
   latency and money.

A proposal satisfying three of four is incomplete. The deliverable must also carry all seven
sections of the "Required shape of the deliverable" in Document 1, in that order.

---

## CONSTRAINTS

1. **Design document, not implementation.** Do not write agent definition files, hook code, or
   configuration. Specify the architecture in enough detail that someone else could write them
   without further design decisions.
2. **Depth is the point.** A thin roster of five generic roles fails this brief.
3. **Anonymity of authorship.** Your document must never identify, hint at, or speculate about
   which system produced it or any other document in this exercise. Never self-identify. Never
   write "as an AI", "as <vendor>'s model", or equivalent. This constraint governs *authorship
   only* — see constraint 4.
4. **Naming models is required, not forbidden.** The subject matter of this design *is* models.
   Name vendors, model ids, and effort tiers freely and precisely throughout. Recommending a
   model is not self-identification.
5. **Evidence discipline.** Where the three research reports disagree with each other, or with
   what the repository shows, say so explicitly and adjudicate — do not average. Cite what you
   rely on (document + section, path + line, or URL). Where a claim matters and nothing
   available can verify it, mark it explicitly as an assumption.
6. **Numbers carry their source and their sensitivity.** Where a casting decision hangs on a
   number (price, benchmark score, context limit), state the number, its source, and how the
   casting would change if the number moved.
7. **Runtime-neutral role definitions.** The harness in this repository is the reference
   implementation and the target of the "deltas" section, but a transposition to a different
   runtime is contemplated (currently parked). Prefer role definitions that describe capability
   and responsibility over one runtime's mechanics.
8. **Read-only in the tree.** You may read anything in the repository and run read-only
   commands. You must not modify, create, or delete any file except the single output document
   the order names for your current phase.
9. **Write to the ordered path only.** Your phase order names exactly one output path. Write
   there and nowhere else.
10. **Self-contained deliverable.** The document must be readable on its own by someone who has
    the repository but not this conversation.

---

## GROUND TRUTH

The scope of ground truth for this exercise, identical for both architects:

> *(Carried verbatim from the goal document's "Ground truth" section.)*
>
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

**Delivery of the three research reports.** They are supplied to both architects as identical
files in this repository, at the exact paths below, rather than retyped into this brief — file
delivery is what guarantees both architects receive byte-identical content. **Read all three in
full, from the first line to the last, before drafting.** Line counts are given so you can
confirm you read the whole file:

| # | Path (relative to repository root) | Lines |
|---|---|---|
| 2 | `research/openai-models.md` | 620 |
| 3 | `research/cross_vendor_agent_harness_roster_summary.md` | 837 |
| 4 | `research/dossier_both.md` | 605 |

These three are the research reports referenced above. They were produced independently and none
evaluates its own family; they overlap, and in places they disagree. Adjudicate per constraint 5.

**Repository scope:** the whole tree, read-only. Recon it first-hand — do not take this brief's
or another document's description of the current harness on trust. The current protocol lives in
`.claude/ORCHESTRA.md` (and `ORCHESTRA.md` / `codex/ORCHESTRA.md` in the master layout), the
installed roster under `.claude/agents/`, the master roster under `agents/`, optional modules
under `packs/`, skills under `.claude/skills/` and `skills/`, configuration in
`.claude/orchestra.json`, and the history in `git log`.

**Live web research is granted.** Use it where the reports are thin, stale, or contradictory —
model availability, pricing, and capability figures move fast. Cite what you rely on.

---

## Document 1 — the goal document (verbatim)

> Reproduced verbatim from `CROSSPLAN-GOAL.md` at the repository root. This is the authoritative
> requirement. Its "Ground truth" section is the one carried into § GROUND TRUTH above.

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
```

---

## Output

Write the complete document to the single path your phase order names. Nothing else in the tree
changes.
