# WO-9 evidence band — staffing record

Band B (seats 4–8: Scout, Researcher, Long-Context Analyst, Investigator,
Archivist) staffed per the WO-8–11 order and the WO-8 construction pattern.
Six role files shipped (Archivist splits into two lane files, same as the
computed Reviewer's two-lane precedent). All nine Part 2.0 fields transcribed
faithfully from `plans/cross-compare/agent-role-architecture/final-plan.md`
Part 2 Band B, cross-checked against `router/castings.json` and
`router/charters.json`. `node roster/lint.js` and `node install.js --lint`
(both `roster/` and repo-wide) pass; the five required test suites pass in
full (counts in the WO-9 report).

## Seats shipped

| Seat | File(s) | Rung embodied | Model | Notes |
|---|---|---|---|---|
| Scout (N0) | `scout-anthropic.md` | primary | Claude Haiku 4.5 · off | renamed to avoid legacy collision |
| Researcher (N1) | `researcher.md` | primary | GPT-5.6 Sol · med (Codex CLI launcher) | mirror not shipped as a file |
| LC Analyst (N2) | `lc-analyst.md` | primary | GPT-5.6 Terra · med (Codex CLI launcher) | mirror not shipped as a file |
| Investigator (I0) | `investigator.md` | primary | Claude Opus 5 · high | read-only tool pin from the `detective` alias |
| Archivist (M0) | `archivist-documents.md` | documents | GPT-5.6 Terra · med (Codex CLI launcher) | one of two lane files |
| Archivist (M0) | `archivist-images.md` | images | Claude Opus 5 · med | other lane file; video/audio degradation path lands here |

## Naming decisions

- **Scout → `scout-anthropic.md`, not `scout.md`.** The legacy roster ships
  `agents/scout.md` (a fixed-Haiku seat) and both rosters co-install during
  the §6.6 shadow period, so the plain name collides — `roster/lint.js`
  refuses any shipped `name:` that matches a legacy `agents/*.md` basename.
  Followed the WO-8 precedent named in the brief (`reviewer-anthropic` /
  `reviewer-openai`'s family-qualifier suffix) rather than inventing a new
  convention: this file embodies the Anthropic primary rung, so it carries
  the `-anthropic` qualifier the same way the computed Reviewer's two lane
  files do. No OpenAI mirror file ships this round (see below), so there is
  no `scout-openai.md` yet and no ambiguity about which file the qualifier
  distinguishes it from.
- **Investigator → `investigator.md`, plain name.** The legacy roster's
  matching seat is named `detective.md`, not `investigator.md` — no
  collision, so no qualifier is needed. `router/aliases.json`'s `detective`
  entry resolves the retired name to `{role: Investigator, rung: primary,
  pin: read-only}` under the `roster: new` flag; this file IS that primary
  rung.
- **Researcher → `researcher.md`, LC Analyst → `lc-analyst.md`, Archivist →
  `archivist-documents.md` / `archivist-images.md`.** No legacy `agents/`
  files use these names — plain (or, for Archivist, lane-qualified) names
  are lawful without a family qualifier.

## Rung / file-count decisions

- **Researcher and LC Analyst: one file each (the primary launcher), not
  two.** The brief allowed either choice — "follow what WO-8 did for
  Reviewer (both castings shipped) ONLY if the WO text or plan requires it;
  otherwise ship the primary and document why" — and neither the plan nor
  WO-8–11's order text requires both castings for these seats (that
  requirement is explicit only for the computed Reviewer, whose matrix is
  family-independent by construction: `final-plan.md` line ~855, "family
  independent of the artifact's recorded author/co-author set"). WO-8's own
  practice for its two non-computed seats (Sweeper, Red Team) also shipped
  exactly one in-harness file per seat, not both castings. `roster/lint.js`'s
  mirror-or-declared-exception check reads `router/castings.json` (both
  rungs are already documented there), not the shipped files, so shipping
  one file per seat is lawful. The Anthropic mirror rungs for both seats
  (Opus 5 · med) have no roster file yet — a gap for a later work order, not
  a defect in this one.
- **Archivist: two lane files, not one file with a rung choice.** The brief
  flagged this as a real decision — "Decide one file with rung choice or two
  lane files (Reviewer precedent allows two); pick what lint.js accepts
  cleanly." Chose two because `documents` and `images` are not a
  primary/mirror pair the way every other Band-B seat's rungs are: each is
  the *sole* casting for its own modality in `router/castings.json` (no
  `mirror` key exists on this role at all — the role's mirror-or-exception
  check is satisfied by the declared `noMirrorFor.videoAudio` exception
  instead). A single file would have to declare a `rung:` that names only
  one modality's casting while the frontmatter model/effort cross-check
  against the *other* modality would then fail — there is no rung name in
  the casting table that means "both." Two lane files, each cross-checking
  cleanly against its own rung, is what `roster/lint.js` accepts without
  strain, and it mirrors the already-accepted two-lane Reviewer precedent
  named in the brief.
- **Investigator: read-only tool pin carried into the shipped `tools:`
  line.** `router/aliases.json`'s `detective` entry: `"pin": "read-only"`,
  with the deprecation note "the read-only law survives as the read-only-
  first law plus this alias's read-only tool pin." The plan's I0 entry
  describes a broader eventual contract (EXECUTE full, WRITE-TREE restricted
  to a scratch/probe scope plus the eventual fix, SPAWN of a Runner) gated
  behind the Conductor's per-order `tool_capabilities` grant. This file ships
  the safe default the alias pins (`Bash, Glob, Grep, Read` — no write) and
  documents in its Tools section that the fuller contract is a
  Conductor-granted widening on a specific order, not this file's standing
  grant.

## Where the plan was silent, or sources needed reconciling

- **No seat in Band A or Band B has an explicit "Strengths" bullet in
  `final-plan.md`'s Part 2 catalog** (verified by grepping every
  `- **Purpose.**` … `- **Review.**` bullet run for every role in Part 2:
  only Conductor, Architect and Runner carry a `**Strengths.**` bullet at
  all). Yet the shipping contract's nine fields require a non-trivial
  `## Strengths` heading in every file, and WO-8's already-shipped
  `reviewer-anthropic.md` / `sweeper.md` / `red-team.md` each carry one with
  content synthesized from the seat's stated Purpose/Casting/Rationale/Tools
  rather than lifted from a plan bullet that doesn't exist. This file's six
  roster files follow the same established precedent — Strengths content is
  faithfully derived from what the plan does say (measured benchmarks in
  Rationale, the charter's Owns line, the Tools contract), never invented
  capability. Not flagged as `unstatedInPlan` in the shipped files because
  WO-8 did not flag it either and the convention is now uniform across the
  whole roster; flagged here for the record.
- **No dispatch-ready MCP runner exists yet for N1 (Researcher) or N2 (LC
  Analyst) work, and none exists for M0 (Archivist) extraction either.**
  `packs/codex/hooks/orchestra-engine-mcp.js` exposes exactly three tools:
  `orchestra_review`, `orchestra_exec`, `orchestra_crossplan` — no
  `orchestra_research`, no long-context or extraction-specific call. The
  brief's instruction to build "thin codex launcher file[s] per
  reviewer-openai.md pattern" presumes a matching runner the way
  `reviewer-openai.md` has `orchestra_review`; none exists for these three
  seats. `researcher.md`, `lc-analyst.md`, and `archivist-documents.md` each
  declare `orchestra_exec` — the closest existing cross-vendor call, since
  each seat's deliverable (a research note, a reconciled extraction, a
  schema-validated artifact) is a file written into a live checkout the same
  way an implementation is — and each file's Tools section names this
  explicitly as a documented gap, not a design choice. **This is the
  sharpest open item for stage 2**: these three launchers cannot be
  meaningfully exercised end-to-end against a purpose-built runner until
  either a dedicated runner ships (a WO-12/13-shaped follow-on) or the
  exercise is run against `orchestra_exec` as-is with the mismatch noted in
  the exercise record.
- **`router/castings.json`'s `$comment` on the Archivist role** documents
  the `noMirrorFor.videoAudio` exception verbatim; no conflict found between
  the plan, the casting table, and the charter for any of the five seats —
  charter `owns`/`mustNotReceive` text mirrors the plan's prose exactly
  everywhere checked, transcribed into the Owns/must-not-receive heading of
  each file without paraphrase drift where the charter's own wording was
  available verbatim.

## Exercises

| Seat | Order | Casting used | Outcome |
|---|---|---|---|
| _(pending — stage 2)_ | | | |

## Review dispositions

_(pending — stage 2)_
