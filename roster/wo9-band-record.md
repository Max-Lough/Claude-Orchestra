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
  `packs/codex/hooks/orchestra-engine-mcp.js` registers four tools:
  `orchestra_review`, `orchestra_exec`, `orchestra_crossplan`,
  `orchestra_doctor` — no `orchestra_research`, no long-context or
  extraction-specific call. The brief's instruction to build "thin codex
  launcher file[s] per reviewer-openai.md pattern" presumes a matching
  runner the way `reviewer-openai.md` has `orchestra_review`; none exists
  for these three seats. `researcher.md`, `lc-analyst.md`, and
  `archivist-documents.md` each declare `orchestra_exec` — the closest
  existing cross-vendor call, since each seat's deliverable (a research
  note, a reconciled extraction, a schema-validated artifact) is a file
  written into a live checkout the same way an implementation is — and each
  file's Tools section names this explicitly as a documented gap, not a
  design choice.

  **Why not `orchestra_crossplan`, which is genuinely READ-ONLY in the
  project tree (`packs/codex/hooks/orchestra-crossplan.js:5-7`)?** It was
  considered and rejected for these three seats' orders, not overlooked.
  Its contract (`orchestra-engine-mcp.js:593-643`) is shaped for the
  `/cross-compare-plan` skill specifically: `phase` is one of
  `draft`/`critique`/`revise`, `critique` and `revise` require a
  `rival_plan_path`/`critique_path` that N1/N2/M0 orders never have, the
  produced document is always a plan-shaped artifact under a
  provenance header with a `DOCUMENT SAVED` line (anonymized, no vendor/model
  mention per its own charter), and web search is on by default — none of
  which matches a bounded research note (N1), a reconciled long-context
  extraction with surfaced conflicts (N2), or a schema-validated JSON
  extraction (M0). Its read-only property doesn't transfer to a shape it
  was never built to carry. Because it IS the only read-only runner the pack
  ships, it stays a named candidate for the dedicated read-only
  research/extraction runner (Follow-on 3, below) rather than a runner to
  switch to now — a future runner could plausibly reuse its read-only
  execution path under a new `phase`, but that is a build decision for that
  follow-on, not a reason to route today's N1/N2/M0 orders through a
  planning-document tool. **This is the sharpest open item for stage 2**:
  these three launchers cannot be meaningfully exercised end-to-end against
  a purpose-built runner until either a dedicated runner ships (a
  WO-12/13-shaped follow-on) or the exercise is run against `orchestra_exec`
  as-is with the mismatch noted in the exercise record.
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
| Scout (N0) | Bounded inventory of `engine:codex` roster files | Haiku 4.5 (in-harness, primary rung) | ex1 superseded (`wo9-n0-ex1-report.md`); ex2 DEGRADED-ACCEPTED — inventory correct and independently verified (4/4 `engine:codex` files), but the SEARCH LOG's exhaustion count failed independent verification (44 claimed vs 47 actual, second consecutive miscount) (`wo9-n0-ex2-report.md`) |
| Investigator (I0) | Causal account: worktree lock mechanism | Opus 5 (in-harness, primary rung) | PASS, VERDICT CONFIRMED (`wo9-i0-ex1-report.md`) |
| Researcher (N1) | Roster model-facts verification | GPT-5.6 Sol · med via `orchestra_exec` runner | ex1 DISCARDED (report-integrity defect, corrected in round 2 after R0 review — see Incidents; not demonstrated fabrication); ex2 DEGRADED-ACCEPTED (`STATUS: BLOCKED`, rule-compliant under the retry's integrity addendum; three of ex1's four cited sources — github release tag, model guidance, launch announcement — independently corroborated by ex2's own fetches; the npm-registry citation, ex1's sole source for the 0.151.0-on-npm claim, was never touched by ex2 and lacks independent cross-run corroboration (opened only in ex1's own VERIFICATION); local shell channel blocked by the sandbox fault). Director's provisional acceptance as the exercised order; owner may override. (`wo9-n1-ex1-transcript.md`, `wo9-n1-ex2-transcript.md`) |
| LC Analyst (N2) | Synthesis over the nine R0-EX verdicts | GPT-5.6 Terra · med via `orchestra_exec` runner | PASS (`wo9-n2-ex1-transcript.md`) |
| Archivist (M0), documents lane | Owner-rulings extraction from `wo8-review-dispositions.md` | GPT-5.6 Terra · med via `orchestra_exec` runner | ex1 typed BLOCKED (honest); ex2 PASS (`wo9-m0-ex1-transcript.md`, `wo9-m0-ex2-transcript.md`). Images lane ships staffed but unexercised; first real image order will exercise it. |

## Incidents

1. **N1-ex1 report-integrity defect (corrected in round 2 after R0 review).** The run
   returned `STATUS: DONE` after completing real web research — four distinct sources its
   own RESEARCH FINDINGS section cites by name (github release tag, npm registry record,
   OpenAI model guidance, OpenAI launch announcement), of which its VERIFICATION section
   opened three (github, npm, model guidance; the launch announcement was cited but never
   opened) — while its VERIFICATION section separately admitted that the LOCAL shell channel
   failed on both commands it attempted, `codex --version` (`wo9-n1-ex1-transcript.md:21`)
   and the repository-status check (`wo9-n1-ex1-transcript.md:22`), each with `unsupported
   protocol version 6`; the transcript keeps the two channels distinct and shows no
   self-contradiction between the completed web research and the failed local commands.
   The anchored grounds, and the reason the run's
   discard stands, reworded round 3 after the Sol·max holistic review (which found the
   original ground below inaccurate — the transcript's own VERIFICATION section DID disclose
   the failed local commands, at the two bullets quoted above; the defect is not
   non-disclosure): (1) it returned `STATUS: DONE` despite its own VERIFICATION section
   disclosing that the local shell channel had failed on both commands it attempted — a
   status-typing defect (DONE where BLOCKED or an explicitly-labeled degraded status was
   warranted), not a failure to disclose — and (2) it carried no retrieval dates on its citations, a charter duty
   (`researcher.md:41`, "every load-bearing claim... must carry a resolvable source and
   retrieval date"). Two grounds previously stated alongside these are withdrawn as
   unsupported: `codex --version` was conditional in the order text on network being
   unavailable (`n1-order.txt`, "If network access is unavailable... report what you can
   establish from the local installation"), and ex1's own network access worked (its web
   research completed) — the conditional branch never fired, so `codex --version` was never
   an owed duty for this run. The "required openai-docs skill read" was never a duty given to
   ex1 at all — it appears only in the retry's transcript (`wo9-n1-ex2-transcript.md:16,20`)
   and was retro-attributed to ex1 in error. **This record previously claimed the run was
   "live evidence of the charter's named failure mode [fabrication]" — that claim was refuted
   on R0 review and is withdrawn.** The retry (`wo9-n1-ex2-transcript.md`), run under an
   integrity addendum requiring quoted fetch transcripts for every citation, independently
   corroborated three of ex1's four cited sources — the github release tag, OpenAI's model
   guidance, and the launch announcement — and their conclusions (evidence against
   fabrication, not for it); the npm-registry citation, ex1's sole source for the
   0.151.0-on-npm claim, was not touched by ex2 and lacks independent cross-run
   corroboration (opened only in ex1's own VERIFICATION, `wo9-n1-ex1-transcript.md:19`) —
   and returned `STATUS: BLOCKED` because the addendum compels BLOCKED whenever the command
   runner is unavailable: rule-compliant, conservative typing, not a choice made against
   fabricating.
2. **Transient codex sandbox command-runner fault** (`unsupported protocol version 6`).
   Hit m0-ex1 (full block — could not read the source document at all), n1-ex1 (partial —
   blocked the local shell channel only, undisclosed up front; see Incident 1), and n1-ex2
   (local shell channel only; the web fetch channel worked and produced the honest BLOCKED
   report); did NOT hit n2-ex1 or m0-ex2 in the same windows. Environment fault, codex CLI
   0.151.0, doctor exit 0 — intermittent, not tied to a specific order class.
   Provenance note: both n1-ex2 and m0-ex2 (the two retries run after this fault was first
   observed) record an identical `PREFLIGHT: auth/exec probe: ok in 5095ms` — flagged as
   suspicious and unexplained; the transcripts are evidence and are left untouched.

## Follow-ons registered

1. **Codex sandbox command-runner protocol fault** (above) — investigate/upstream
   (codex lane).
2. **`verifier/checkout.js:322-327` prune-comment incompleteness** — the comment describes
   prune as clearing registrations whose directory is gone; it is incomplete, since prune
   also skips LOCKED registrations even with the directory gone (surfaced incidentally by
   the I0-ex1 investigation) — doc fix, verifier lane.
3. **No research/long-context/extraction-specific MCP runner** — N1/N2/M0 launchers
   declare `orchestra_exec` as the closest existing cross-vendor call; already noted in
   this record's stage-1 section ("Where the plan was silent, or sources needed
   reconciling") — kept here as one canonical cross-reference, not a second open item.
4. **N0 self-reported exhaustion counts are unreliable — verify mechanically.** Two
   consecutive N0 runs against this same order class miscounted their own surface: ex1
   reported 39 of 40 roster files; ex2 (`wo9-n0-ex2-report.md`) reported 44 of 47 (an
   independent Glob returned 47; the opened-files list omitted `scout-anthropic.md` by
   name — the naive 47−44=3 arithmetic was never verified against actual filenames, so
   only this one omission is confirmed). The SEARCH LOG's own opened-files list carries a
   further inconsistency: its numbered ranges run to position 49 while the SEARCH LOG and
   report both declare a total of 44 files. Both runs' bounded inventories were themselves
   correct — only the exhaustion arithmetic was wrong. Calibration for the N0 Haiku·off
   casting: bounded inventories are reliable, self-reported counts are not; SEARCH LOG
   numbers must be quoted tool output, and count claims verified mechanically by the
   dispatcher, not accepted on the seat's own arithmetic — investigate/fix in the N0
   charter or dispatch discipline (evidence lane).

## Order texts

### n1-order.txt (N1-ex1)

```
Class N1 research order, read-only. Do NOT modify any files in the repository or working
tree — this is a research and reporting task only, not an implementation task. Write
nothing to disk except your final report message.

Verify the roster's model facts: confirm the current stable release version of the codex
CLI and the publicly documented GPT-5.6 model family names, citing the upstream sources
you used. If network access is unavailable in this sandbox, say so explicitly and report
what you can establish from the local installation itself (codex --version, help output),
labeling it as local evidence, not research.

Report using the standard executor report format (STATUS / CHANGES / VERIFICATION /
DEVIATIONS / CONCERNS). Since this is a read-only research task, CHANGES should read
"none" unless you made no file edits (expected), and your research findings belong under
CONCERNS or as an additional clearly-labeled RESEARCH FINDINGS section before the STATUS
block's closing.
```

### n1-order-v2.txt (N1-ex2, retry with integrity addendum)

[Editorial note: order text preserved verbatim as dispatch evidence; its preamble's "retry
after a fabrication incident" framing below is the wording Incident 1 (above) withdraws —
order text unaltered, framing corrected in round 2/3.]

```
Class N1 research order, read-only. Do NOT modify any files in the repository or working
tree — this is a research and reporting task only, not an implementation task. Write
nothing to disk except your final report message.

Verify the roster's model facts: confirm the current stable release version of the codex
CLI and the publicly documented GPT-5.6 model family names, citing the upstream sources
you used. If network access is unavailable in this sandbox, say so explicitly and report
what you can establish from the local installation itself (codex --version, help output),
labeling it as local evidence, not research.

Report using the standard executor report format (STATUS / CHANGES / VERIFICATION /
DEVIATIONS / CONCERNS). Since this is a read-only research task, CHANGES should read
"none" unless you made no file edits (expected), and your research findings belong under
CONCERNS or as an additional clearly-labeled RESEARCH FINDINGS section before the STATUS
block's closing.

INTEGRITY ADDENDUM (retry after a fabrication incident): You may only cite a source you
actually fetched in THIS run, with the fetch command and its observed output quoted in
your VERIFICATION section. If your command runner or network is unavailable, you MUST
return STATUS: BLOCKED or an explicitly-labeled local-evidence-only note — a DONE with
unverifiable citations is a charter violation. Any claim without a quoted fetch transcript
will be treated as absent.
```

### n2-order.txt (N2-ex1)

```
Class N2 long-context synthesis order, read-only, over supplied material only. Do NOT
modify any files in the repository or working tree — this is a synthesis and reporting
task only, not an implementation task.

Supplied material: the nine verdict files roster/r0-ex3-verdict.md through
roster/r0-ex11-verdict.md in this checkout (that is: roster/r0-ex3-verdict.md,
roster/r0-ex4-verdict.md, roster/r0-ex5-verdict.md, roster/r0-ex6-verdict.md,
roster/r0-ex7-verdict.md, roster/r0-ex8-verdict.md, roster/r0-ex9-verdict.md,
roster/r0-ex10-verdict.md, roster/r0-ex11-verdict.md).

Synthesize:
(a) the trajectory of the review rounds (findings per round, severity trend),
(b) every finding class that recurred across rounds,
(c) any CONFLICTS between verdicts (one round asserting what a later round contradicts) —
surface conflicts, do not resolve them.

Cite file + section for every claim.

Report using the standard executor report format (STATUS / CHANGES / VERIFICATION /
DEVIATIONS / CONCERNS), with CHANGES reading "none" (read-only task), and the synthesis
itself presented as a clearly-labeled SYNTHESIS section ahead of the STATUS block's
closing.
```

### m0-order.txt (M0-ex1, M0-ex2)

```
Class M0 document-intake order, read-only, single bounded extraction. Do NOT modify any
files in the repository or working tree — this is an extraction and reporting task only,
not an implementation task.

From roster/wo8-review-dispositions.md, extract every owner ruling recorded in the
"## Owner rulings" section (or equivalently-titled section) into structured JSON:
[{id_or_topic, ruling, residual_accepted (bool/na)}]

Extraction only — no conclusions, no recommendations. Emit the JSON verbatim in your
report.

Report using the standard executor report format (STATUS / CHANGES / VERIFICATION /
DEVIATIONS / CONCERNS), with CHANGES reading "none" (read-only task), and the extracted
JSON presented in a clearly-labeled EXTRACTION section ahead of the STATUS block's
closing.
```

## Review dispositions

_(pending — stage 2)_

## Review rounds

| Round | Scope | Outcome |
|---|---|---|
| 1 | R0 review of `1ab4a19..316759a` (staffing + exercises) | REVISE — 4 MAJOR, 4 MINOR |
| 2 | Fixes landed at `9336392` (runner semantics, incident narrative, report contracts) | Delta review: REVISE — 3 MAJOR, 5 MINOR |
| 3 | Fixes landed at `ee5aec4` (self-consistent sandbox facts, anchored discard grounds, exact counts) | Delta review: APPROVE — 3 MINOR residuals, no CRITICAL/MAJOR |
| 4 | This commit — post-APPROVE residual cleanup (3 MINOR residuals + 2 substantive nits from the round-3 delta review) | No re-review required per charter: only CRITICAL/MAJOR findings force REVISE |
