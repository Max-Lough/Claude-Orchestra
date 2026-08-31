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
  `roster/lint.js:78-80` builds `legacyNames` from
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
checked against the new contract. **Rule counts differ across the two
legacy tiers** (verified by grep): `agents/executor.md` carries **10**
numbered rules; `agents/executor-heavy.md` and `agents/executor-heavy-
xhigh.md` each carry **12** — the same 10 as the base tier plus two
heavy-only rules (numbered 3 and 8 in the heavy files' own numbering; see
rows 3 and 8 below). Both legacy heavy files are byte-identical in their
twelve numbered rules and report format; `executor-heavy-xhigh.md`
differs from `executor-heavy.md` only in `model`/`effort`/`description`
frontmatter, and both are subsumed into `principal.md`'s single file per
the "one tier, two effort points" ruling.

Rows below use `executor-heavy.md`'s own numbering (1–12), the superset —
`executor.md`'s 10 rules are the same 10 substantive rules minus rows 3 and
8, which are heavy-only and have no base-tier equivalent (Builder's
predecessor never carried them, so Builder's disposition is N/A on those
two rows, not a retirement).

| # | Legacy rule (source) | Disposition | Citation in the new file |
|---|---|---|---|
| 1 | Execute the order, the whole order, nothing but the order (`executor.md:13`, `executor-heavy.md:16`) | **CARRIED**, generalized to Band C's shared law | `builder.md`/`principal.md` opening paragraph; `final-plan.md:498-499` |
| 2 | Blocked beats guessed (`executor.md:14`, `executor-heavy.md:17`) | **CARRIED**, generalized to Band C's shared law | same; also Builder/Principal Weaknesses ("stalls... instead of escalating") |
| 3 | Read the case file before the code — heavy-only, no base-tier equivalent (`executor-heavy.md:18`) | **CARRIED for Principal** (N/A for Builder — this rule was never in `executor.md`, not retired from it) | `principal.md` Strengths (:34): "reads the case file before the code on escalated orders, absorbing prior dead ends rather than repeating them" |
| 4 | Follow named skills (`executor.md:15`, `executor-heavy.md:19`) | **CARRIED, unstated in the plan text but not contradicted** — general harness convention (Skill tool invocation), not restated per-seat in Band C's Part 2 prose | not separately cited; no plan text retires it |
| 5 | Match the house style (`executor.md:16`, `executor-heavy.md:20`) | **CARRIED, unstated in the plan text but not contradicted** | Builder Strengths ("house-style fidelity") transcribes the spirit; not a verbatim plan citation |
| 6 | Verify your own work (`executor.md:17`, `executor-heavy.md:21`) | **CARRIED**, formalized as mandatory Verifier + cross-family review | `builder.md`/`principal.md` Review sections; `final-plan.md:595-598` (Builder), `:628-629` (Principal) |
| 7 | Never claim untested success (`executor.md:18`, `executor-heavy.md:22`) | **CARRIED**, Report format retained verbatim in structure | `builder.md`/`principal.md` Report format |
| 8 | Surface the coupling — heavy-only, no base-tier equivalent (`executor-heavy.md:23`) | **CARRIED for Principal** (N/A for Builder — this rule was never in `executor.md`, not retired from it) | `principal.md` Strengths (:34): "surfaces cross-subsystem coupling explicitly ... even when everything passes, carried forward from the legacy heavy executor's rule 8" |
| 9 | Stop grinding, report state — 3-cycle/4-cap rule (`executor.md:19`, `executor-heavy.md:24`) | **CARRIED**, restated as the escalation ladder (two REVISE/CHECKPOINT/mis-sized BLOCKED → next tier) | `builder.md` Escalation, `final-plan.md:593-594`; `principal.md` Escalation, `final-plan.md:626-627` |
| 10 | Heartbeat when the order says so — conditional (`executor.md:20`, `executor-heavy.md:25`) | **CHANGED for Principal**: promoted from conditional to **mandatory** ("Checkpoint commits and progress heartbeats mandatory (bundled-order cadence)"); **CARRIED unchanged (conditional) for Builder** — the plan does not restate a heartbeat clause for E2 | `final-plan.md:616-617` (Principal); Builder carries the legacy conditional behavior by omission, not contradiction |
| 11 | Budget crossings are checkpoints, not sprints (`executor.md:21`, `executor-heavy.md:26`) | **CARRIED**, via the CHECKPOINT status and the shared "never end your turn on a running process" law | `builder.md`/`principal.md` Report format + closing line |
| 12 | Never end your turn while a process you started is still running (`executor.md:22`, `executor-heavy.md:27`) | **CARRIED verbatim in substance**, the standard closing line every roster file in this repo carries | `builder.md`/`principal.md` final line |
| — | `disallowedTools: Agent` — no spawn, either legacy tier (`executor.md:4`, `executor-heavy.md:4`, `executor-heavy-xhigh.md:4`) | **CARRIED unchanged for Builder** ("No SPAWN," `final-plan.md:582`); **CHANGED for Principal** — SPAWN is newly granted, scoped to Runner/Scout/Verifier only, fan-out ≤4 (`final-plan.md:615-616`) | `builder.md` Tools; `principal.md` Tools, explicit callout of the change |
| — | Escalated-order `PRIOR-ATTEMPT DISPOSITION` block (`executor-heavy.md:49-54`) | **CARRIED** — already present in the legacy heavy file, kept on `principal.md` | `principal.md` Report format |

No legacy rule was found retired outright, across the complete 12-rule
audit of the heavy tier (not the 10-rule subset this table originally
carried): every rule either carries unchanged, carries in a
generalized/formalized form under the plan's Band C shared law and
Review/Escalation contracts, or changes in a direction the plan states
explicitly (Principal's SPAWN grant, Principal's mandatory heartbeat). The
two heavy-only rules (3, 8) are additions specific to Principal's
predecessor, not rules Builder's predecessor ever had and then lost.

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

Stage 2, run 2026-08-30. All six in-harness reports below were written by the
exercised seats **themselves, directly to files** — no Director
condensation — a process improvement adopted after WO-9's PHASE-line loss
(a report detail lost in the earlier round's condensation step). The five
codex-launcher exercises are dispatched via `orchestra-exec` and independently
re-verified by the dispatching session against the engine's own claims, per
that lane's standing practice.

| Seat | Order | Casting used | Outcome |
|---|---|---|---|
| Builder (E2) | Implement `parseDuration(input)` against a Director-authored contract; commit the Director-provided `test.js` verbatim as a baseline commit before implementing, then commit the implementation separately, and report the observed `node test.js` result | Claude Sonnet 5 · medium, in-harness | PASS — `node test.js` → `all pass`, exact verbatim output, exit 0; baseline (`45c9020`) and implementation (`cda8569`) landed as two separate commits per order (`roster/wo10-builder-ex1-report.md`) |
| Principal (E3) | Design and implement a coupled append-only event-log writer + reader sharing one chained-hash record format, against the Director's four-step acceptance scenario (append 5 events; corrupt one byte; confirm `append` refuses the corrupt tail; restore and append a 6th) | Claude Opus 5 · high, in-harness | PASS — 4/4 acceptance steps pass verbatim (`ACCEPTANCE PASS`, exit 0); the coupling invariant is named ("canonical-body chaining — the bytes the reader re-derives must be the bytes the writer hashed"); honest split-resistance concession (design-time coupled — three invariant clauses are only forced by holding both sides in view — but implementation-time decomposable via a spec-then-fan-out shape). NOTE: the acceptance log was written under `%TEMP%`, not the fixture directory — a scope deviation discovered on dispatcher review of the pasted acceptance output (the path appears only incidentally in `node acceptance.js`'s own printed `log file:` line), NOT disclosed by the seat: the report's own DEVIATIONS section opens "Acceptance scenario: none." and never mentions the path — contrast the Data Engineer's genuine self-disclosure of its own stray-write deviation below, honesty-calibration data for E3 (`roster/wo10-principal-ex1-report.md:28,124`) |
| Operator (E0) | Diagnose why a fixture's `npm install` + `node index.js` pipeline fails to produce a working program, cite the exact observed error text, apply and justify the minimal fix, then prove clean success from a fresh reinstall | GPT-5.6 Sol · high, via `orchestra-exec` (Codex CLI launcher) | PASS — root cause (`Error: Cannot find module 'left-pad-local'`, `MODULE_NOT_FOUND`, a declared local `file:` dependency whose source directory did not exist) diagnosed and cited verbatim, matching this session's own independent sanity check of the same fixture; minimal fix (stub the missing vendor package rather than rewrite the app) proven by an independent, session-run reinstall (`005`, exit 0) — not merely accepted on the engine's own claim. First attempt hit codex's own directory-trust gate (fixture wasn't yet a git repo) before any engine attempt or tree write — an infrastructure discovery, not charged against the seat or the one-bounded-retry allowance (`roster/wo10-operator-ex1-transcript.md`) |
| Test Designer (Q0, vsOpenaiAuthor) | Build an independent pinning suite (`test.js`) plus 2 required mutants for `contrast.js` — a Sol-authored (OpenAI-family) WCAG contrast-ratio implementation — derived only from the function's documented contract, not its code | Claude Sonnet 5 · medium, in-harness | PASS — both required mutants (swapped R/B luminance coefficients; dropped `+0.05` offsets) go red, the unmodified original stays green — confirmed non-vacuous, including that the swapped-coefficient mutant is caught only because the suite deliberately includes an asymmetric-channel pair. 3 informational findings reported on the implementation, none fixed (Q0 does not edit production logic): the sharpest is that `contrast.js` branches its sRGB linearization at `0.04045` rather than the WCAG-quoted `0.03928`, proven behaviorally unobservable across all 256 possible 8-bit hex channel values (`roster/wo10-test-designer-sonnet-ex1-report.md`) |
| Test Designer (Q0, vsAnthropicAuthor) | Build an independent pinning suite (≥15 cases) plus 2 required mutants for `src/parse-duration.js` — the Sonnet-5-authored (Anthropic-family) Builder-seat implementation — derived only from the function's documented header-comment contract, not its code, without editing `src/` | GPT-5.6 Terra · medium, via `orchestra-exec` (Codex CLI launcher) | PASS — delivered a 25-case suite (exceeding the 15-case minimum), both single-line mutants (`ms` multiplier, repeated-unit rank guard) go red on the exact claimed assertion, the original passes 25/25; `src/` confirmed byte-identical to the seed commit throughout. Every engine claim — suite results against original and both mutants, the two mutant diffs, the untouched `src/` tree — was independently re-executed and reproduced exactly by the dispatching session, not merely relayed (`roster/wo10-test-designer-terra-ex1-transcript.md`) |
| Refactorer (E8) | Census `fetchData` occurrences across 5 planted files before editing, rename to `retrieveData` everywhere (definitions, requires, calls, exports), re-census to confirm an exact per-file count match, and run `node --check` on all 5 files | GPT-5.6 Terra · medium, via `orchestra-exec` (Codex CLI launcher) | BLOCKED-PENDING-ENVIRONMENT — 3 attempts total (2 in ex1, 1 final retry in ex2), every one hit `unsupported protocol version 6` before the engine reached even its first local shell command; the mandatory pre-edit census was never obtained, so no edit was ever attempted (`CHANGES: none`, tree audit `no source paths changed`, all 3 times). Fixture verified byte-identical to plant state (a=2,b=2,c=4,d=2,e=5 `fetchData` occurrences, total 15) throughout. No competency signal on GPT-5.6 Terra was obtained — the mission was never attempted at any try. Exercise owed once the fault clears (`roster/wo10-refactorer-ex1-transcript.md`, `roster/wo10-refactorer-ex2-transcript.md`) |
| Runner (E1) | Perform an exact string substitution `1.2.3` → `1.3.0` in exactly 3 named files, nothing else, validated by grep counts (3 of `1.3.0`, 0 of `1.2.3`) and a 3-line diff — bounded, mechanical, no judgment | GPT-5.6 Luna · low, via `orchestra-exec` (Codex CLI launcher) | BLOCKED-PENDING-ENVIRONMENT — 3 attempts total (2 in ex1, 1 final retry in ex2), every one hit `unsupported protocol version 6`; the third attempt notably got one file-discovery command (`rg --files -g config.json -g README.md -g version.js`) through before the fault recurred, but the substitution and its validation never ran. Fixture verified unchanged (`1.2.3` once, `1.3.0` zero times, in each of the 3 files) throughout. No competency signal on GPT-5.6 Luna was obtained. Exercise owed once the fault clears (`roster/wo10-runner-ex1-transcript.md`, `roster/wo10-runner-ex2-transcript.md`) |
| Data Engineer (E4) | Prepare (not apply) a reversible (T1) v1→v2 name-split migration over a 50-record synthetic dataset: deterministic generator, structural/splittability validator, dry-run planner, apply-with-post-write-verification, a true-inverse rollback, and a poisoned-record (unsplittable name) refusal test | Claude Opus 5 · high, in-harness | PASS — byte-exact rollback round-trip proven by a real (not simulated) migrate-then-rollback run: `sha256 34aa7c35b66d50d00bb38b04091f1bf293594ad9ab0bda8ef7ce7c54e9674816` both before and after, `equal: true`; the poisoned record (`"Mononym"`) is refused as a verified no-op — 11/11 assertions, target hash unchanged before/after the refused attempt. Self-disclosed a transient stray write to the system `%TEMP%` root (a Git Bash `/tmp` path-mapping surprise, not the assigned scratchpad), deleted immediately and confirmed gone (`roster/wo10-data-engineer-ex1-report.md`) |
| Interface Artisan (E5) | Build a static, dependency-free, accessible "user profile card" (`card.html`/`card.css`/`contrast.js`) in an empty fixture, meeting stated HTML-validity, semantics/ARIA, keyboard-focus-visible, and contrast-ratio (≥4.5, computed by the seat's own `contrast.js`) acceptance criteria; the browser render-inspect-adjust loop is explicitly out of reach in this harness and the order says so up front | GPT-5.6 Sol · medium, via `orchestra-exec` (Codex CLI launcher) | DEGRADED-ACCEPTED — all 3 files delivered exactly as scoped and independently verified by the dispatching session's own `check.js`: `contrastRatio('#000000','#ffffff') === 21`; the declared pair `#172554` text on `#ffffff` background computes to `14.694794518800467` (≥ 4.5) via the seat's own unmodified function — an exact digit-for-digit match to the engine's own claimed figure, confirming the number came from actually running the code, not a plausible-sounding fabrication. The engine honestly reported its own mid-run shell fault (`unsupported protocol version 6`, hitting AFTER the file-writing calls had already succeeded) and worked around the one number that mattered via its own V8 isolate rather than fabricating a passing self-check. The pre-registered browser/render-loop gap stayed unexercised, exactly as expected going in (`roster/wo10-interface-artisan-ex1-transcript.md`) |
| Spatial Specialist (E6) | Build a deterministic closed-cylinder OBJ generator plus a mechanical mesh validator (manifold/watertight, orientable, Euler characteristic, finite coordinates, signed volume vs. closed form, per-face winding), demonstrated against both a valid mesh and a deliberately broken variant (one deleted face) | Claude Opus 5 · high, in-harness | PASS — 15/15 checks pass on the valid mesh (V=50, T=96, matching the closed-form vertex/triangle-count formulas exactly); exactly 5 of 15 checks fail on the broken variant, precisely localizing the missing face's 3 boundary edges rather than failing uniformly. Negative control (every face's winding reversed) fails exactly the winding-dependent checks and nothing else, proving the check set is non-vacuous. Two independent generation runs are byte-identical (`sha256` match, `cmp` clean). Self-caught and disclosed its own report transcription error — a mis-copied `[FAIL]`/`[PASS]` row for check `e3` — via a scripted diff against the committed `runs.txt`, corrected before the report shipped (`roster/wo10-spatial-ex1-report.md`) |
| Doc Writer (D0) | Write a complete, citation-grounded API reference for a Director-supplied `LRUCache` fixture (`src/lru-cache.js`), every claim citing a resolvable `file:line`, checked by a mechanical citation-resolution checker | Claude Sonnet 5 · medium, in-harness | PASS — 28 citations, all resolve (`node check-citations.js` → `Checked 28 citation(s) against source.` / `ALL CITATIONS RESOLVE`, exit 0). The checker is proven to fail closed, not merely to rubber-stamp: a self-run negative control (an injected bogus citation token) correctly triggers `TOKEN NOT FOUND`, exit 1; the injected citation was then removed and the checker reconfirmed clean (`roster/wo10-doc-writer-ex1-report.md`) |
| Retry-protocol context (E8, E1) | — | — | Both BLOCKED-PENDING-ENVIRONMENT seats used the full 3-attempt structure this wave authorized: 2 attempts under ex1 (initial attempt + one bounded retry, per the standing protocol), then one further attempt under ex2 after a dispatcher-directed final retry with no further retry authorized beyond it. All 6 attempts across the two seats hit the identical `unsupported protocol version 6` fault — none reached a state where the seat's actual competency (GPT-5.6 Terra on Refactorer, GPT-5.6 Luna on Runner) was exercised. See Incidents below for the full cross-work-order fault tally |

NOTE (transcript index, filename-vs-heading): the `ex1`/`ex2` transcript filenames above use **retry numbering** (per-seat: `ex1` = initial attempt(s), `ex2` = a further retry) — but a transcript's own in-file heading sometimes says "Exercise 2/3/4" instead, reflecting **session dispatch order** (Refactorer, Runner, and Interface Artisan were the 2nd, 3rd, and 4th codex-launcher missions dispatched this session, after Operator's 1st). The two numberings disagree by design and neither is wrong: **filenames govern** for citation purposes in this record; the transcripts themselves are left untouched as evidence, headings included.

## Review dispositions

_(pending — stage 3)_

## Incidents

1. **The `unsupported protocol version 6` codex sandbox fault — exact tally
   across WO-9+WO-10.** **Counting rule**: an "attempt" is one
   `orchestra_exec` invocation that reached the engine (preflight probe
   completed); a refusal that never reaches the engine — WO-10's Operator
   first attempt, stopped by codex's own directory-trust gate before any
   engine attempt (Incident 2 below) — is a distinct fault, counted
   separately, not among the tally below. By that rule: **10 of 14**
   engine-reaching attempts across the two work orders hit this fault.

   Fault-hit (10): WO-9 `m0-ex1` (1 attempt, full block); WO-9 `n1-ex1` (1
   attempt, local shell channel degraded — the web-fetch channel kept
   working, so the run still returned DONE); WO-9 `n1-ex2` (1 attempt, full
   block); WO-10 Refactorer — 3 attempts total (2 in `ex1`, 1 final retry in
   `ex2`), every one BLOCKED before the mandatory pre-edit census could run;
   WO-10 Runner — 3 attempts total (2 in `ex1`, 1 final retry in `ex2`),
   every one BLOCKED — **not** "outright" for all three: the third attempt
   (`ex2`'s final retry) got one command through before the fault recurred
   (`rg --files -g config.json -g README.md -g version.js`, `roster/wo10-
   runner-ex2-transcript.md:26-29,56`), locating all 3 named files, before
   the substantive census/edit/validation work was cut off; WO-10 Interface Artisan — 1
   attempt, hit mid-run (after its file-writing calls had already landed),
   still returned DONE via its own V8-isolate workaround.

   Clean (4): WO-9 `m0-ex2`, WO-9 `n2-ex1`; WO-10 Operator's one
   engine-reaching attempt (its first attempt never reached the engine —
   see the counting rule above); WO-10 Test Designer (vsAnthropicAuthor
   lane). Did **not** hit this round's Builder, Principal, Data Engineer,
   Spatial Specialist, Doc Writer, or Test Designer (vsOpenaiAuthor lane)
   runs either — the last five (plus the vsOpenaiAuthor Test Designer
   lane) are in-harness Anthropic castings and never route through the
   codex engine at all, so they carry no fault exposure and are outside
   this tally's denominator entirely (distinct from "clean," which means an
   engine attempt that did not hit the fault).

   Intermittent per-run, no model/effort correlation — GPT-5.6 Terra · med
   hit the fault three-for-three on Refactorer and zero-for-one (clean) on
   the Test Designer vsAnthropicAuthor exercise, in the same session.
   **ESCALATED** as a follow-on (below); ships unresolved.
2. **codex directory-trust gate: fixtures must be a git repo before the
   engine will operate.** Distinct from the transient fault above — a
   reproducible precondition, not intermittent. Hit on the Operator
   fixture's first attempt (`STATUS: EXEC_UNAVAILABLE`, "Not inside a
   trusted directory and `--skip-git-repo-check` was not specified");
   `orchestra-exec.js` exposes no flag to pass `--skip-git-repo-check`
   through. Resolved for every codex-launched exercise this round by
   `git init`-ing each fixture (self-contained, isolated from the
   Orchestra repo) with a seed commit before the counted dispatch — not
   charged against any seat's one-bounded-retry allowance since no engine
   attempt or tree write occurred on a trust-gate refusal. **Operational
   learning for every future codex-side order**: git-init the fixture
   first, always.

## Follow-ons registered

5. **Codex sandbox protocol fault (`unsupported protocol version 6`) —
   investigate/upstream, ESCALATED.** Per Incident 1 above, this round it
   fully blocked both Refactorer (E8) and Runner (E1) — 3 attempts each,
   zero competency signal on either seat — and it degraded Interface
   Artisan's (E5) self-verification channel mid-run. Combined with WO-9's
   tally (blocked `m0-ex1`, degraded `n1`'s local channel), this is now a
   recurring cross-session fault, not a one-off.
6. **Refactorer (E8) and Runner (E1) exercises are owed.** No competency
   signal was obtained for GPT-5.6 Terra on the rename mission or GPT-5.6
   Luna on the substitution mission — every attempt at both was stopped by
   the environment fault before the seat's actual mission work (census,
   edit, validation) could run; Runner's third attempt did get one
   file-discovery command through (`rg --files`, `roster/wo10-runner-ex2-
   transcript.md:26-29,56`) before the fault recurred, so "before the engine
   reached its first local command" is accurate for Refactorer's three
   attempts and Runner's first two, but not Runner's third. Fixtures and
   order texts are currently preserved at
   `scratchpad\wo10-fixtures\{refactorer,runner}` and
   `scratchpad\wo10-orders\{refactorer-ex1,runner-ex1}-order.txt`, but the
   scratchpad is **session-ephemeral** — do not rely on it surviving to a
   future session. Both order texts are reproduced verbatim in the "Order
   texts" appendix below, so the exercise is fully reproducible from this
   record alone once the fault clears.
7. **Interface Artisan (E5) browser/render loop remains unexercised after
   stage 2** — cross-referenced to conflict item 4 / follow-on 4 above.
   The DEGRADED-ACCEPTED stage-2 exercise closed everything reachable
   inside this harness (generation, and mechanical verification of every
   acceptance criterion including the load-bearing contrast computation)
   but did not and could not close the render-inspect-adjust gap itself —
   that gap is pre-registered, not newly discovered.
8. **Spatial Specialist (E6) visual/critic review path unexercised.**
   Stage 2 exercised mechanical validity only (the 15-check deterministic
   validator, plus a non-vacuity negative control) — the seat's
   Fable-critic escalation path for "numerically valid, visually wrong"
   output was never triggered, since the order explicitly stated no
   render was available and sought no artistic approval. A future order
   with a real render path is needed to exercise it.

## Follow-ons registered (stage 1)

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

## Order texts

The five codex-launched (`orchestra-exec`) exercises dispatch from a literal
order file; those five are embedded verbatim below. The six in-harness
exercises dispatch as a Director order to the session directly (no separate
order file survives in the scratchpad) — each is instead summarized here in
one or two sentences, condensed from that seat's own report (its opening
"Order:" line where the report states one, otherwise reconstructed from its
CHANGES/DEVIATIONS sections, which carry the order's requirements
faithfully even where they are not quoted verbatim).

### In-harness orders (condensed from each report's own order section)

- **Builder (E2).** Implement `parseDuration(input)` per a Director-authored
  contract (units d/h/m/s/ms, integer counts only, strictly descending unit
  order, no sign/whitespace, `null` on any malformed input including the
  empty string). Commit the Director-provided `test.js` verbatim as a
  baseline commit before writing the implementation; commit the
  implementation separately; report the observed `node test.js` result
  without independently certifying the suite's own coverage.
- **Principal (E3).** Design and implement a coupled append-only event-log
  writer and reader sharing one chained-hash record format (class E3, risk
  T1), against a four-step Director acceptance scenario: append 5 events and
  confirm a clean read-back; flip one byte in a payload and confirm the read
  reports the corrupt line; confirm a further `append` attempt is refused
  against the corrupt tail with the file left byte-unchanged; restore the
  file and confirm a 6th event appends cleanly. `ACCEPTANCE PASS` gates on
  all four steps.
- **Data Engineer (E4).** Prepare (not apply) a reversible (T1) v1→v2
  name-split migration over a 50-record synthetic dataset: a deterministic
  generator, a structural/splittability validator, a dry-run planner that
  writes nothing, an apply step with post-write verification read from
  disk, a true-inverse rollback needing no backup side file, and a
  poisoned-record (one unsplittable name) test proving the whole migration
  refuses rather than partially applying.
- **Spatial Specialist (E6).** Build a deterministic closed-cylinder OBJ
  generator (geometry only — positions and triangular faces, no
  normals/UVs, no randomness) plus a mechanical mesh validator checking at
  minimum: vertex/triangle counts against closed-form formulas, watertight
  manifold edges, finite coordinates, and signed volume/winding. Demonstrate
  the validator against both a valid mesh and a deliberately broken variant
  (one deleted face), showing the validator catches the break. No visual
  render is available and none is sought for this order.
- **Doc Writer (D0).** Write a complete API reference for a Director-supplied
  `LRUCache` fixture (`src/lru-cache.js`), with every claim citing a
  resolvable `file:line`, checked by a mechanical citation-resolution
  checker built as part of the same deliverable. Commit the Director-
  provided fixture (source + test) verbatim as a baseline before adding the
  documentation and checker.
- **Test Designer (Q0, vsOpenaiAuthor).** Build an independent pinning suite
  plus exactly 2 mutants for `contrast.js` (Sol-authored, OpenAI-family),
  derived only from the WCAG contrast-ratio formula as an external contract,
  never from reading the implementation's own code as ground truth. Confirm
  the suite passes the original and fails on both required mutants (wrong
  luminance coefficients; dropped `+0.05` offsets), and report any findings
  on the implementation without fixing them (Q0 does not edit production
  logic).

### Codex order texts, verbatim

#### operator-ex1-order.txt (Operator, E0)

```
WORK ORDER — Operator (E0) — WO-10 Exercise 1

MISSION
This fixture project's install-then-run pipeline does not produce a working
program: running `npm install` followed by `node index.js` in this directory
does not succeed cleanly end to end. Diagnose the root cause from the
evidence you observe by actually running these commands (do not guess).
State the root cause precisely, citing the exact error text you observed.
Apply the minimal fix — your engineering judgment on whether to create the
missing local package (with a minimal stub `index.js` + `package.json`
implementing enough of `left-pad-local`'s `require(...)` surface for
`index.js` to run) or to remove/replace the dependency in `package.json` —
and justify whichever you choose in one or two sentences. Then PROVE, by
actually running them and pasting the output: (1) `npm install` completes
successfully, and (2) `node index.js` runs and produces output, with no
errors, from a clean state (delete any `node_modules` / `package-lock.json`
first and reinstall, so the proof is not resting on stale state).

SCOPE — READ/WRITE
Read and write ONLY inside this fixture directory (the directory you were
invoked with via --cd). This is a throwaway fixture, not the Orchestra repo
and not any other project — do not read, write, or otherwise touch any path
outside this directory tree.

FORBIDDEN — ABSOLUTE, OUTRANKS EVERYTHING ELSE IN THIS ORDER
- git push, git commit --amend, any remote git operation
- npm publish, npm login, or any registry-publishing command
- any network package install beyond what this exact fixture already
  declares (no adding unrelated dependencies, no `npm install <other-pkg>`)
- any command or file path that leaves this fixture directory
- any destructive action outside this directory (no deleting or modifying
  anything outside --cd)

REPORT CONTRACT (Operator launcher relay — do not editorialize)
State plainly: the observed error text (verbatim), the diagnosed root
cause, the fix applied (what changed, in which files, and why), and the
verbatim output proving both `npm install` and `node index.js` succeeded
from a clean reinstall. If you cannot reach a working end state, say so
plainly (BLOCKED) rather than claiming success — the report is a claim,
not evidence; the runner's own tree audit is the check against it.
```

#### interface-artisan-ex1-order.txt (Interface Artisan, E5)

```
WORK ORDER — Interface Artisan (E5) — WO-10 Exercise 1

KNOWN HARNESS GAP, STATED UP FRONT: this exercise runs in a harness with no
live browser or screenshot loop bound to your session — your normal
render-inspect-adjust loop is NOT reachable here. This exercises generation
only, verified deterministically by a downstream script, not by rendering.
Treat this as a generation-only exercise; do not claim a visual render or
screenshot inspection happened, because it did not.

MISSION
In this empty fixture directory, build a static, dependency-free,
accessible "user profile card" UI component, as exactly 3 files:
  - card.html — the component markup (a standalone, valid HTML document is
    fine, or a fragment — your call, state which)
  - card.css — the component's styling
  - contrast.js — a small, pure, dependency-free JS module that exports a
    function `contrastRatio(hex1, hex2)` implementing the WCAG 2.x relative
    luminance / contrast ratio formula, taking two hex color strings (e.g.
    "#000000") and returning the numeric contrast ratio between them. It
    must be a PURE function — no DOM access, no browser globals, callable
    from plain Node.js. Export it in a way `require('./contrast.js')` in
    Node can consume (e.g. `module.exports = { contrastRatio }`).

ACCEPTANCE CRITERIA (state your compliance with each, explicitly)
- card.html is valid HTML — no unclosed tags, no structural errors
- card.html uses semantic elements appropriately (e.g. <article>, <h2>,
  <button>, not an all-<div> soup) and ARIA attributes where semantic HTML
  alone is insufficient
- the card includes at least one keyboard-focusable action button/control,
  with a visible `:focus-visible` style declared in card.css (not just the
  browser default, and not `outline: none` with nothing replacing it)
- the card declares one text/background color pair (name which element(s)
  and which two hex values) that MUST achieve a contrast ratio >= 4.5,
  and that ratio must be computed and confirmed BY YOUR OWN contrast.js
  function, not by eyeballing — paste the actual computed number

SCOPE — READ/WRITE
Read and write ONLY inside this fixture directory (the directory you were
invoked with via --cd). It is currently empty; create exactly the 3 files
named above (plus, only if genuinely needed, no more than 1 additional
small file you name and justify — prefer exactly 3).

FORBIDDEN — ABSOLUTE, OUTRANKS EVERYTHING ELSE IN THIS ORDER
- any network install (no npm install, no CDN-loaded runtime dependency —
  the component must be dependency-free, plain HTML/CSS/JS)
- git push, git commit, or any git operation
- any path outside this fixture directory
- claiming a browser render, screenshot, or visual inspection took place —
  it did not; say so plainly instead

REPORT CONTRACT (Interface Artisan launcher relay — do not editorialize)
List the files created with their paths. State explicitly which two hex
values form the tested text/background pair, and the exact contrast ratio
your own contrast.js computed for that pair. Confirm each acceptance
criterion above individually (met / not met). State plainly, in your own
words as instructed by this order, that the render-inspect-adjust loop was
not exercised in this run — a known, accepted harness gap, not a failure to
hide.
```

#### refactorer-ex1-order.txt (Refactorer, E8 — reused verbatim for ex2's final retry)

```
WORK ORDER — Refactorer (E8) — WO-10 Exercise 1

MISSION
This fixture directory contains 5 small JavaScript files: a.js, b.js, c.js,
d.js, e.js. They define, require, and call a function named `fetchData` at
various sites. Your job: rename `fetchData` to `retrieveData` EVERYWHERE it
appears as that identifier — every definition, every destructured import/
require, every call site, and the corresponding `module.exports` key(s) —
across all 5 files, consistently, so the files still work together (d.js
requires fetchData from e.js; b.js requires it from a.js).

CENSUS FIRST — before making any edit, run a grep census (state the exact
command and its per-file count in your report) for the exact token
`fetchData` across a.js, b.js, c.js, d.js, e.js. Report the per-file count
and the total BEFORE you touch anything.

THEN make the rename, element-wise, file by file.

AFTER the rename, verify and report:
- a grep census for `fetchData` across all 5 files returns ZERO occurrences
  anywhere in this directory
- a grep census for `retrieveData` across all 5 files, reported per file,
  and the total
- `node --check` passes on all 5 files individually (run each and paste the
  result)
- your after-rename per-file `retrieveData` census must match the same
  per-file counts you found for `fetchData` in the BEFORE census (a pure
  rename changes no occurrence count, per file or in total) — state this
  match explicitly, file by file, in your report

SCOPE — READ/WRITE
Read and write ONLY inside this fixture directory (the directory you were
invoked with via --cd) — exactly the 5 named files (a.js, b.js, c.js, d.js,
e.js). Do not create new files, do not touch anything outside this
directory.

FORBIDDEN — ABSOLUTE, OUTRANKS EVERYTHING ELSE IN THIS ORDER
- git push, git commit, or any git operation
- npm install, npm publish, or any network/registry command
- editing any file other than a.js, b.js, c.js, d.js, e.js in this directory
- any path outside this fixture directory

REPORT CONTRACT (Refactorer launcher relay — do not editorialize)
State the census method named before the change, the before-census
(per-file + total), the after-census for both `fetchData` (must be 0) and
`retrieveData` (per-file + total, matching the before numbers exactly), and
the `node --check` result for each of the 5 files. Any mismatch between the
before and after census is a reportable finding, not something to paper
over.
```

#### runner-ex1-order.txt (Runner, E1 — reused verbatim for ex2's final retry)

```
WORK ORDER — Runner (E1) — WO-10 Exercise 1

MISSION — bounded, mechanical, no judgment
This fixture directory contains exactly 3 named files, each containing the
exact text `1.2.3` exactly once: config.json, README.md, version.js.
Perform an EXACT string substitution, replacing `1.2.3` with `1.3.0`, in
EXACTLY these 3 named paths, and nothing else:
  - config.json
  - README.md
  - version.js

Do not touch any other file. Do not make any other edit to these 3 files —
change ONLY the `1.2.3` -> `1.3.0` token, leave every other character,
line, and byte identical. Do not "improve," reformat, or reindent anything.

VALIDATION — run these checks yourself and report the literal results
- grep count of the string `1.3.0` across the 3 named files combined == 3
- grep count of the string `1.2.3` across the 3 named files combined == 0
- a diff against the original content shows exactly 3 changed lines total
  (one changed line per file) — no other lines differ

If anything about this task requires judgment beyond the exact substitution
above (a file missing, a version string appearing more than once, a file
that doesn't parse), STOP and report — do not guess, do not improvise a
fix, do not touch files beyond the 3 named above.

SCOPE — READ/WRITE
Read and write ONLY inside this fixture directory (the directory you were
invoked with via --cd), and only the 3 named files.

FORBIDDEN — ABSOLUTE, OUTRANKS EVERYTHING ELSE IN THIS ORDER
- any edit to any file other than config.json, README.md, version.js
- git push, git commit, or any git operation
- npm install or any network command
- any path outside this fixture directory
- any reformatting, reindentation, or content change beyond the single
  1.2.3 -> 1.3.0 token substitution per file

REPORT CONTRACT (Runner launcher relay — do not editorialize, no judgment)
State the mechanical result only: the exact command(s) run, the grep counts
for `1.3.0` and `1.2.3` post-edit, and the diff line count. Report a
checklist item unmet if any validation fails — never that the change is
"good," only whether each stated check passed or failed.
```

#### test-designer-terra-ex1-order.txt (Test Designer, Q0 vsAnthropicAuthor)

```
WORK ORDER — Test Designer (Q0, vsAnthropicAuthor lane) — WO-10 Exercise 1

CASTING NOTE
You are cast opposite an Anthropic-authored implementation. The file
`src/parse-duration.js` in this fixture directory was written by a
Claude model (Sonnet 5, Builder seat) earlier in this program — you did
NOT author it and must not assume its internals are correct. Your job is
to construct an INDEPENDENT pinning suite from the function's documented
CONTRACT, not from reading its implementation strategy as ground truth.

THE CONTRACT (from the file's own header comment — treat this as the
spec, not the code below it)
`parseDuration(input)` parses a compact duration string (e.g. "1h30m",
"2d", "100ms") into a total number of milliseconds.
  - Supported units: d (day), h (hour), m (minute), s (second), ms
    (millisecond)
  - Counts must be non-negative integers (no sign, no decimals)
  - Units must appear in strictly descending order: d > h > m > s > ms
  - Each unit may appear at most once
  - No whitespace anywhere in the string
  - Returns the total duration in milliseconds, or `null` if the input
    is malformed in any way (including an empty string)

MISSION — three deliverables

(a) TEST FILE — write a new test file (e.g. `test/parse-duration.test.js`,
your choice of a plain Node-runnable assertion script or a common test
runner already implied by the fixture — if no test runner is present,
write a self-contained script using Node's built-in `assert` module and
document exactly how to run it) that exercises `parseDuration`'s CONTRACT
above. At least 15 cases, including boundaries the author might have
missed:
  - each unit individually (d, h, m, s, ms), each exactly once
  - a descending-order combination using all 5 units
  - integer counts of varying magnitude, including 0 and multi-digit
  - malformed inputs that must return null: unit repeated (e.g. "1h2h"),
    wrong/ascending order (e.g. "1s2h"), whitespace anywhere in the
    string, a leading plus sign ("+5m"), a decimal count ("1.5h"), a
    negative count ("-5h"), an unknown unit, an empty string, a string
    with no unit at all
  - a huge value (e.g. very large digit count) to check it doesn't
    silently overflow/misbehave
  - non-string inputs: null, undefined, a number, an object, an array —
    every one must return `null`, not throw

(b) MUTATION CHECK — create exactly 2 mutant COPIES of the implementation
(do NOT modify the original `src/parse-duration.js`):
  - mutant 1: the `ms` unit's millisecond multiplier is wrong (e.g. change
    `ms: 1` to `ms: 10` in a copy)
  - mutant 2: the implementation accepts a repeated unit (e.g. change the
    out-of-order/repeat check from `rank <= lastRank` to `rank < lastRank`
    in a copy, so a repeated unit like "1h2h" is wrongly accepted)
  Run your test suite against the ORIGINAL (must PASS in full) and against
  EACH mutant (must FAIL — at least one assertion in your suite must catch
  each mutant). Report the pass/fail outcome against the original and
  against each mutant explicitly, case by case if any case's status
  differs. A suite that stays green on a mutant is VACUOUS for that
  mutant and must be reported as such, not glossed over.

(c) NO SOURCE EDITS — you must never edit anything under `src/` in this
fixture directory. `src/parse-duration.js` is the fixed, pre-authored
implementation under test; your job is the oracle, not the implementation.
Mutant copies belong in a separate location (e.g. a `mutants/` directory
you create, or inline in your own test-running script) — never overwrite
or modify the original file.

SCOPE — READ/WRITE
Read and write ONLY inside this fixture directory (the directory you were
invoked with via --cd). You may create new files/directories for your
test suite and mutant copies (e.g. `test/`, `mutants/`). Do not touch
anything outside this directory.

FORBIDDEN — ABSOLUTE, OUTRANKS EVERYTHING ELSE IN THIS ORDER
- any edit to src/parse-duration.js (or any file under src/)
- git push, git commit, or any git operation
- npm install, npm publish, or any network/registry command
- any path outside this fixture directory
- fabricating or asserting a pass/fail result you did not actually observe
  by running the suite

REPORT CONTRACT (Test Designer launcher relay — do not editorialize, no
judgment beyond what you directly observed)
State: the test file's path and how many cases it contains (list them
briefly), the exact command(s) used to run the suite, the result running
against the original implementation (must be full PASS — report if not),
the two mutants' exact diffs from the original, and the result running the
same suite against each mutant (which case(s) caught each mutant, or
report explicitly if a mutant was NOT caught — that is a reportable
vacuous-suite finding, not something to smooth over).
```
