# WO-10 construction band — staffing record

Band C (seats 9–20 minus retired 13: Operator, Runner, Builder, Principal,
Data Engineer, Interface Artisan, Spatial Specialist, Red Team [shipped in
WO-8], Refactorer, Test Designer, Doc Writer) staffed per the WO-8–11 order
and the WO-8/WO-9 construction pattern, in the staffing order the WO text
named: **Builder and Principal first, validated against existing work; then
Operator, Test Designer, Refactorer** (commit 1); **then the domain seats**
— Runner, Data Engineer, Interface Artisan, Spatial Specialist, Doc Writer
(commit 2). Red Team (E7) shipped already in WO-8 and is not re-touched
here. Eleven role files ship across ten seats (Test Designer splits into
two lane files, Archivist precedent). All nine Part 2.0 fields
transcribed faithfully from
`plans/cross-compare/agent-role-architecture/final-plan.md` Part 2 Band C
(~lines 496–848), cross-checked against `router/castings.json` and
`router/charters.json`.

## Seats shipped

| Seat | File(s) | Rung embodied | Model | Notes |
|---|---|---|---|---|
| Builder (E2) | `builder.md` | primary | Claude Sonnet 5 · medium | successor to legacy `executor`; dense/preferredBounded/mirror documented, not shipped as separate files |
| Principal (E3) | `principal.md` | primary | Claude Opus 5 · high | successor to legacy `executor-heavy`/`executor-heavy-xhigh`; xhigh is the routed `effortPoint2` on this same file, not a second file (one tier, two effort points) |
| Operator (E0) | `operator.md` | primary | GPT-5.6 Sol · high (Codex CLI launcher) | tacticalRaise (max) documented in-file, not a separate file |
| Test Designer (Q0) | `test-designer-vs-anthropic.md` | vsAnthropicAuthor | GPT-5.6 Terra · med (Codex CLI launcher) | one of two lane files; **flagged `router/castings.json` gap — see Conflicts below** |
| Test Designer (Q0) | `test-designer-vs-openai.md` | vsOpenaiAuthor | Claude Sonnet 5 · medium | other lane file; same flagged gap |
| Refactorer (E8) | `refactorer.md` | primary | GPT-5.6 Terra · med (Codex CLI launcher) | mirror (Sonnet med) not shipped as a file; plan carries no Tools bullet for this seat — see Conflicts |
| Runner (E1) | `runner.md` | primary | GPT-5.6 Luna · low–med (Codex CLI launcher) | mirror (Haiku off) not shipped as a file |
| Data Engineer (E4) | `data-engineer.md` | primary | Claude Opus 5 · high | reversibleT1 (Terra high) documented in-file; `noMirrorFor.irreversible` satisfies the mirror-or-exception check |
| Interface Artisan (E5) | `interface-artisan.md` | primary | GPT-5.6 Sol · med–high (Codex CLI launcher), browser/screenshot loop | closing (Opus high) and critic (Fable high, effort `unstatedInPlan`) documented in-file, not separate files; **flagged `router/castings.json` gap — see Conflicts below** |
| Spatial Specialist (E6) | `spatial-specialist.md` | primary | Claude Opus 5 · high | critic (Fable high) and mirror (Sol high) documented in-file; supersedes legacy specialist `modeler` per `router/aliases.json` |
| Doc Writer (D0) | `doc-writer.md` | primary | Claude Sonnet 5 · medium | deliverable/ceiling/mirror documented in-file; plan carries no Tools bullet for this seat — see Conflicts |

## Naming decisions

- **All ten seats ship under plain, un-qualified names** (`builder`,
  `principal`, `operator`, `refactorer`, `runner`, `data-engineer`,
  `interface-artisan`, `spatial-specialist`, `doc-writer`, plus the two
  `test-designer-vs-*` lane names) — none collide with any name in
  `agents/*.md` (`executor-heavy-xhigh`, `executor-heavy`, `executor`,
  `reviewer`, `detective`, `scout`), which is the only directory
  `roster/lint.js`'s collision check actually reads.
- **The collision check does not scan `agents/specialists/*.md`.**
  `roster/lint.js:72-74` builds `legacyNames` from
  `fs.readdirSync(path.join(MASTER, 'agents'))` — a single, non-recursive
  `readdirSync` call over the top-level `agents/` directory only. It never
  descends into `agents/specialists/`, so `agents/specialists/modeler.md`
  and `agents/specialists/_TEMPLATE.md` are invisible to the check. This
  matters directly for `spatial-specialist.md`: the seat it embodies
  **supersedes** the legacy `agents/specialists/modeler.md` per
  `router/aliases.json`'s `modeler` entry ("modeler is promoted:
  spatial/procedural work is the first-class Spatial Specialist"), and had
  this file instead been named `modeler.md` — a plausible choice, since it
  literally replaces that specialist — the lint would not have caught the
  collision even though the name would legitimately shadow a live
  specialist file. `spatial-specialist.md` was named for the seat itself
  regardless, for readability and consistency with the other nine plain
  seat names, not because the lint forced it — but the gap is worth
  recording because a future roster file named e.g. `modeler.md` or
  `_template.md` would ship without a lint objection. Registered as a
  follow-on below.
- **`test-designer-vs-anthropic.md` / `test-designer-vs-openai.md`,
  not `test-designer.md` (rung choice) or `test-designer-anthropic.md`
  / `test-designer-openai.md`.** The WO text explicitly raised this as a
  decision: "Two lane files (like archivist) or one file? Decide per what
  lint.js accepts for a seat whose rungs are family-conditional — follow
  the Archivist two-lane precedent if each rung is a sole casting; record
  the decision." `router/castings.json`'s Test Designer entry carries two
  rungs, `vsAnthropicAuthor` and `vsOpenaiAuthor`, with **no `mirror` key
  at all** — each rung is the *sole* casting for its own condition (which
  family authored the implementation), exactly the Archivist shape
  (`documents`/`images`, no `mirror` key), not the Researcher/Sweeper/Red
  Team shape (`primary`+`mirror`, one file ships). Two lane files, one per
  rung, is what a single `rung:` frontmatter value can cross-check
  cleanly. Named `-vs-anthropic`/`-vs-openai` rather than
  `-anthropic`/`-openai` (the Scout/Reviewer convention) because those
  suffixes name the family the file's casting IS, and would misdescribe a
  file whose casting is OpenAI Terra but which fires specifically
  *against* an Anthropic-authored implementation — `-vs-<author-family>`
  names the condition, not the casting, avoiding exactly that ambiguity.

## Rung / file-count decisions

- **Builder, Principal, Operator, Refactorer, Runner, Data Engineer,
  Spatial Specialist, Doc Writer: one file each (the primary rung), not
  every documented rung.** Each of these seats' non-primary rungs
  (Builder's `preferredBounded`/`dense`/`mirror`; Principal's
  `effortPoint2`/`mirror`/`ceiling`; Operator's `tacticalRaise`/`mirror`;
  Refactorer's `mirror`; Runner's `mirror`; Data Engineer's
  `reversibleT1`; Spatial Specialist's `critic`/`mirror`; Doc Writer's
  `deliverable`/`ceiling`/`mirror`) is already present in
  `router/castings.json`, so `roster/lint.js`'s mirror-or-declared-
  exception check (which reads the casting table, not the shipped files)
  is satisfied without a matching file — the same lawful gap
  `researcher.md`/`lc-analyst.md` established in WO-9. Each file documents
  its seat's other rungs in prose (Casting/Escalation) rather than
  shipping them, following `investigator.md`'s established pattern for its
  own mirror/ceiling.
- **Principal: `effortPoint2` is a routed effort point on the primary
  file, not a second file.** `router/castings.json`'s own comment is
  explicit — "one tier, two effort points — not two rungs of the ladder"
  — so `principal.md` ships once, at `rung: primary` / `effort: high`, and
  documents the xhigh point as a dispatch-time effort raise on the same
  casting.
- **Test Designer: two lane files, not one file with a rung choice** — see
  Naming decisions above for the full reasoning; the file-count question
  and the naming question were the same decision here, unlike Archivist
  where the lanes had unambiguous plain names available.
- **Interface Artisan: one file (the `primary` generation rung), not three
  (generation/closing/critic).** The plan's own contract makes closing "a
  SEPARATE READ-ONLY order" dispatched to a different family than the
  generator — a phase distinction within one seat's workflow, not a
  family-conditional alternate casting the way Test Designer's rungs are.
  This matches the Archivist/Investigator convention of documenting a
  seat's other phases/rungs in prose rather than shipping every one as a
  file; `closing` and `critic` are both already present in
  `router/castings.json`, though (see Conflicts below) their presence does
  not by itself satisfy the mirror-or-exception check for this seat.

## Builder/Principal legacy-validation table

Every rule in `agents/executor.md` (Builder's legacy predecessor) and
`agents/executor-heavy.md`/`agents/executor-heavy-xhigh.md` (Principal's)
checked against the new contract. Both legacy heavy files are
byte-identical in their ten numbered rules and report format;
`executor-heavy-xhigh.md` differs from `executor-heavy.md` only in
`model`/`effort`/`description` frontmatter, and both are subsumed into
`principal.md`'s single file per the "one tier, two effort points" ruling.

| # | Legacy rule (source) | Disposition | Citation in the new file |
|---|---|---|---|
| 1 | Execute the order, the whole order, nothing but the order (`executor.md:13`) | **CARRIED**, generalized to Band C's shared law | `builder.md`/`principal.md` opening paragraph; `final-plan.md:498-499` |
| 2 | Blocked beats guessed (`executor.md:14`) | **CARRIED**, generalized to Band C's shared law | same; also Builder/Principal Weaknesses ("stalls... instead of escalating") |
| 3 | Follow named skills (`executor.md:15`) | **CARRIED, unstated in the plan text but not contradicted** — general harness convention (Skill tool invocation), not restated per-seat in Band C's Part 2 prose | not separately cited; no plan text retires it |
| 4 | Match the house style (`executor.md:16`) | **CARRIED, unstated in the plan text but not contradicted** | Builder Strengths ("house-style fidelity") transcribes the spirit; not a verbatim plan citation |
| 5 | Verify your own work (`executor.md:17`) | **CARRIED**, formalized as mandatory Verifier + cross-family review | `builder.md`/`principal.md` Review sections; `final-plan.md:595-598` (Builder), `:628-629` (Principal) |
| 6 | Never claim untested success (`executor.md:18`) | **CARRIED**, Report format retained verbatim in structure | `builder.md`/`principal.md` Report format |
| 7 | Stop grinding, report state — 3-cycle/4-cap rule (`executor.md:19`) | **CARRIED**, restated as the escalation ladder (two REVISE/CHECKPOINT/mis-sized BLOCKED → next tier) | `builder.md` Escalation, `final-plan.md:593-594`; `principal.md` Escalation, `final-plan.md:626-627` |
| 8 | Heartbeat when the order says so — conditional (`executor.md:20`) | **CHANGED for Principal**: promoted from conditional to **mandatory** ("Checkpoint commits and progress heartbeats mandatory (bundled-order cadence)"); **CARRIED unchanged (conditional) for Builder** — the plan does not restate a heartbeat clause for E2 | `final-plan.md:616-617` (Principal); Builder carries the legacy conditional behavior by omission, not contradiction |
| 9 | Budget crossings are checkpoints, not sprints (`executor.md:21`) | **CARRIED**, via the CHECKPOINT status and the shared "never end your turn on a running process" law | `builder.md`/`principal.md` Report format + closing line |
| 10 | Never end your turn while a process you started is still running (`executor.md:22`) | **CARRIED verbatim in substance**, the standard closing line every roster file in this repo carries | `builder.md`/`principal.md` final line |
| — | `disallowedTools: Agent` — no spawn, either legacy tier (`executor.md:4`, `executor-heavy.md:4`, `executor-heavy-xhigh.md:4`) | **CARRIED unchanged for Builder** ("No SPAWN," `final-plan.md:582`); **CHANGED for Principal** — SPAWN is newly granted, scoped to Runner/Scout/Verifier only, fan-out ≤4 (`final-plan.md:615-616`) | `builder.md` Tools; `principal.md` Tools, explicit callout of the change |
| — | Escalated-order `PRIOR-ATTEMPT DISPOSITION` block (`executor-heavy.md:49-54`) | **CARRIED** — already present in the legacy heavy file, kept on `principal.md` | `principal.md` Report format |

No legacy rule was found retired outright; every rule either carries
unchanged, carries in a generalized/formalized form under the plan's Band C
shared law and Review/Escalation contracts, or changes in a direction the
plan states explicitly (Principal's SPAWN grant, Principal's mandatory
heartbeat).

## Plan-silence / conflict spots

Verbatim quotes and citations for every gap found, per the WO instruction
to say so honestly where the plan is silent, and to STOP and report rather
than edit `router/`, `verifier/`, `registry/`, or `agents/` where a lint
failure would force it.

1. **Two Band-C seats have no `**Tools.**` bullet in `final-plan.md` Part
   2 at all: Refactorer (#18) and Doc Writer (#20).** Verified by grepping
   every `\*\*Tools\.\*\*` occurrence across the whole of Part 2 (lines
   179–1010): every role from #1 Conductor through #24 Quartermaster has
   one except these two. `refactorer.md` and `doc-writer.md` each flag
   this in their own Tools sections and synthesize a Tools grant from the
   seat's Purpose/Contract/Owns prose rather than transcribing a bullet
   that does not exist — the same posture WO-9's band record took for the
   missing `**Strengths.**` bullets across most of Band A/B.

2. **Test Designer (Q0) and Interface Artisan (E5) both fail
   `roster/lint.js`'s mirror-or-declared-exception check, unavoidably, for
   any file shipped under either seat — a genuine `router/castings.json`
   gap, not a file-authoring defect.** Confirmed empirically: running
   `node roster/lint.js` against all eleven shipped files (commit 1 and
   commit 2 together) returns exactly

   ```
   test-designer-vs-anthropic.md: seat Test Designer has neither a mirror rung nor a declared no-mirror exception in castings.json
   test-designer-vs-openai.md: seat Test Designer has neither a mirror rung nor a declared no-mirror exception in castings.json
   interface-artisan.md: seat Interface Artisan has neither a mirror rung nor a declared no-mirror exception in castings.json
   ```

   and no other problems. (Commit 1, verified in isolation before that
   commit landed with the five commit-2 files moved out of `roster/`,
   showed only the two Test Designer lines — recorded in that commit's own
   history; the Interface Artisan line is confirmed here, with commit 2.)
   The check (`roster/lint.js:146-152`) is: `hasMirror = !!(role.rungs ||
   {}).mirror; hasException = !!role.noMirrorFor;` — a literal JSON-key
   test against `router/castings.json`'s `roles[seat]` object, independent
   of which or how many lane files ship for that seat. `Test Designer`'s
   two rungs are named `vsAnthropicAuthor` / `vsOpenaiAuthor` (no key
   literally named `mirror`) and the role carries no `noMirrorFor` key.
   `Interface Artisan`'s three rungs are named `primary` / `closing` /
   `critic` (again no `mirror` key) and also carries no `noMirrorFor`.
   Unlike Archivist — whose `documents`/`images` lanes are the same shape
   (no literal `mirror` key) but whose role **does** carry a declared
   `noMirrorFor.videoAudio` exception that satisfies the check — neither
   Test Designer nor Interface Artisan has any declared exception at all.
   This is distinct from the three `unstatedInPlan` markers the WO named
   in advance (E5 critic effort, E8 contextShapes, D0 contextShapes) — it
   is a fourth and fifth undiscovered gap, found by running the lint
   against real files rather than by inspecting the casting table's own
   `$comment`/`unstatedInPlan` annotations. **Per the WO-10 instruction —
   "NO changes to router/... if a lint failure forces one, STOP and report
   the conflict" — `router/castings.json` is left unedited.** Both seats
   ship anyway (the WO requires staffing all ten), and `node
   roster/lint.js`'s exit code is non-zero for this reason alone in both
   commits; see the WO-10 report for the exact, isolated diff this causes
   against the "all green" bar. The honest fix, for a future work order,
   is almost certainly adding `noMirrorFor` declarations to both roles in
   `router/castings.json` (Test Designer's two rungs are genuinely a
   family-conditional pair with no meaningful "mirror" of either
   individual rung; Interface Artisan's `closing`/`critic` are
   phase-distinct, not primary/mirror) — not adding a synthetic `mirror`
   rung that would misrepresent either seat's actual casting shape.

3. **`agents/specialists/*.md` is not scanned by the name-collision
   check** — see Naming decisions above. Recorded here too as a plan/lint
   discrepancy: the WO text asked "check what the collision check
   actually scans," and the answer is: `agents/*.md` only, non-recursive.
   This is directly load-bearing for the Spatial Specialist naming
   decision (above): had that file been named `modeler.md`, the lint
   would not have caught the shadow of the live `agents/specialists/
   modeler.md`.

4. **Interface Artisan (E5) has no headless exercise path.** Its
   generation casting's browser/screenshot loop runs inside the Codex
   engine's own remote session; nothing in this harness's own tool grants
   (including the `claude-in-chrome` MCP integration, which is a separate
   channel bound to this session, not to `orchestra_exec` calls) reaches
   into that loop. Flagged here as a plan-silence-adjacent finding — the
   plan assumes a render-inspect-adjust loop exists to exercise, and this
   construction round found no way to exercise it end-to-end without
   either a live browser bound to the codex engine's session or touching
   the repository working tree. See the stage-2 exercise map in the WO-10
   report for the closest honest exercise proposed, and the gap it does
   not close.

## Dispositions

Closing the three conflicts raised in "Plan-silence / conflict spots" above,
per the Director's WO-10 ruling (2026-08-30):

**(a) Q0/E5 `router/castings.json` gap (conflict item 2) — closed.**
`router/castings.json` now carries two declared exceptions, quoting the
ruling's own rationale for each:

- **Test Designer (Q0)**: a `crossFamilyByConstruction` annotation. Ruling:
  "mirror substitution is UNLAWFUL by construction — the seat is cast
  opposite the implementation author's family, so substituting the other
  lane under pool outage would place the test designer same-family with the
  author, violating the invariant." Checked against `router.js` before
  writing the reason: there is no special-cased Q0 outage branch. Rung
  selection (`router.js:417-430`) always names `vsAnthropicAuthor` /
  `vsOpenaiAuthor` from `implementationAuthorFamily`; since the role carries
  no `mirror` rung, `cast()`'s generic degradation fallback
  (`router.js:475-488`) finds `role.rungs.mirror` undefined, the
  Data-Engineer-only `reversibleT1` fallback does not apply, and it falls
  through to the final refusal — outcome `WAIT`, reason "no lawful casting:
  ... and the role declares no mirror for this work" (`router.js:485-488`).
  Exactly the honest fallback the ruling anticipated for the case router.js
  has no special handling: outage means wait, never a same-family
  substitution.
- **Interface Artisan (E5)**: a `noMirrorFor.primary` declared exception
  (reusing the existing `noMirrorFor` mechanism — its rung-keyed
  reason-string shape fit a whole-primary-rung exception cleanly), marked
  `unstatedInPlan: true`. Ruling: "the plan names no authoring mirror for
  the E5 primary (the closing rung is a SEPARATE READ-ONLY review-shaped
  order, the critic a ceiling — neither is an authoring substitution
  target)." Verified against `final-plan.md` Part 2 seat 15 (lines
  675–703): the Casting bullet documents generation (Sol), closing (Opus,
  "dispatched as a separate READ-ONLY order ... always a different family
  from the generator") and critic (Fable, ceiling) — no mirror line for the
  primary anywhere in the section.

Both are data annotations only; `router.js`'s `cast()` treats the new keys
as inert (full router suite: 135 passed, unchanged from before this round —
no routing behavior changed). `roster/lint.js`'s mirror-or-declared-
exception check was taught to accept both forms (see (c)'s sibling fix
below), each requiring a non-empty `reason` string to count; `node
roster/lint.js` now exits 0.

**(b) Refactorer/Doc Writer missing plan Tools bullets (conflict item 1) —
already closed, cross-referenced here.** Both seats' role files synthesize
a Tools grant from surrounding Purpose/Contract/Owns prose rather than
transcribing a bullet `final-plan.md` Part 2 does not carry for either
seat, per WO-8/WO-9 precedent (the same posture WO-9's band record took for
the missing `**Strengths.**` bullets across most of Band A/B). No change
this round; see "Plan-silence / conflict spots" item 1 above for the full
citation.

**(c) `agents/specialists/*.md` lint blind spot (conflict item 3) —
closed.** `roster/lint.js`'s name-collision check now also reads
`agents/specialists/*.md` (previously a non-recursive `readdirSync` over
`agents/` only). Verified once the check was widened: no CURRENT roster
file's frontmatter `name` collides with either file under
`agents/specialists/` (`modeler`, `_TEMPLATE`) — `spatial-specialist.md`
(name `spatial-specialist`) stays clear, and `node roster/lint.js` reports
zero collision violations with the widened scan.

## Exercises

_(pending — stage 2; see the stage-2 exercise map delivered in the WO-10
report)_

| Seat | Order | Casting used | Outcome |
|---|---|---|---|
| _(none run yet)_ | | | |

## Review dispositions

_(pending — stage 2)_

## Follow-ons registered

1. **`router/castings.json` gap: Test Designer and Interface Artisan carry
   neither a `mirror` rung nor a `noMirrorFor` declaration**, so
   `roster/lint.js`'s mirror-or-declared-exception check fails
   unconditionally for both seats — see Conflicts item 2 above for the
   full citation and the empirically-confirmed lint output. Recommended
   fix (for the work order authorized to edit `router/`): add
   `noMirrorFor` declarations naming why each seat's rungs are not a
   primary/mirror pair, following the Archivist precedent already in the
   file.
2. **`agents/specialists/*.md` is invisible to `roster/lint.js`'s
   name-collision check** (non-recursive `readdirSync` over `agents/`
   only) — a future roster file could collide with a specialist name
   (e.g. `modeler.md`) without the lint objecting. Recommended fix:
   extend the collision check to also read `agents/specialists/*.md`.
3. **Refactorer (E8) and Doc Writer (D0) have no `**Tools.**` bullet in
   `final-plan.md` Part 2** — this round's files synthesize a Tools grant
   from surrounding prose rather than transcribing plan text that does not
   exist; a future plan revision should add the missing bullets so the
   next construction round can transcribe rather than synthesize.
4. **Interface Artisan (E5) has no headless exercise path** — its
   generation casting's browser/screenshot loop runs inside the Codex
   engine's own remote session; nothing in this harness's own tool grants
   (including the `claude-in-chrome` MCP integration, which is a separate
   channel) reaches into that loop. The stage-2 exercise map proposes the
   closest honest exercise available and flags the gap explicitly rather
   than claiming an equivalent one.
