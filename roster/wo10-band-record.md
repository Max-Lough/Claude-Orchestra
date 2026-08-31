# WO-10 construction band — staffing record

Band C (seats 9–20 minus retired 13: Operator, Runner, Builder, Principal,
Data Engineer, Interface Artisan, Spatial Specialist, Red Team [shipped in
WO-8], Refactorer, Test Designer, Doc Writer) staffed per the WO-8–11 order
and the WO-8/WO-9 construction pattern, in the staffing order the WO text
named: **Builder and Principal first, validated against existing work; then
Operator, Test Designer, Refactorer** (commit 1); **then the domain seats**
— Runner, Data Engineer, Interface Artisan, Spatial Specialist, Doc Writer
(commit 2, not yet landed as of this section). Red Team (E7) shipped
already in WO-8 and is not re-touched here. All nine Part 2.0 fields
transcribed faithfully from
`plans/cross-compare/agent-role-architecture/final-plan.md` Part 2 Band C
(~lines 496–848), cross-checked against `router/castings.json` and
`router/charters.json`.

## Seats shipped (commit 1)

| Seat | File(s) | Rung embodied | Model | Notes |
|---|---|---|---|---|
| Builder (E2) | `builder.md` | primary | Claude Sonnet 5 · medium | successor to legacy `executor`; dense/preferredBounded/mirror documented, not shipped as separate files |
| Principal (E3) | `principal.md` | primary | Claude Opus 5 · high | successor to legacy `executor-heavy`/`executor-heavy-xhigh`; xhigh is the routed `effortPoint2` on this same file, not a second file (one tier, two effort points) |
| Operator (E0) | `operator.md` | primary | GPT-5.6 Sol · high (Codex CLI launcher) | tacticalRaise (max) documented in-file, not a separate file |
| Test Designer (Q0) | `test-designer-vs-anthropic.md` | vsAnthropicAuthor | GPT-5.6 Terra · med (Codex CLI launcher) | one of two lane files; **flagged `router/castings.json` gap — see Conflicts below** |
| Test Designer (Q0) | `test-designer-vs-openai.md` | vsOpenaiAuthor | Claude Sonnet 5 · medium | other lane file; same flagged gap |
| Refactorer (E8) | `refactorer.md` | primary | GPT-5.6 Terra · med (Codex CLI launcher) | mirror (Sonnet med) not shipped as a file; plan carries no Tools bullet for this seat — see Conflicts |

_(Commit 2 seats — Runner, Data Engineer, Interface Artisan, Spatial
Specialist, Doc Writer — will be added to this table when that commit
lands.)_

## Naming decisions

- **All six commit-1 seats ship under plain, un-qualified names**
  (`builder`, `principal`, `operator`, `refactorer`, plus the two
  `test-designer-vs-*` lane names) — none collide with any name in
  `agents/*.md` (`executor-heavy-xhigh`, `executor-heavy`, `executor`,
  `reviewer`, `detective`, `scout`), which is the only directory
  `roster/lint.js`'s collision check actually reads.
- **The collision check does not scan `agents/specialists/*.md`.**
  `roster/lint.js:72-74` builds `legacyNames` from
  `fs.readdirSync(path.join(MASTER, 'agents'))` — a single, non-recursive
  `readdirSync` call over the top-level `agents/` directory only. It never
  descends into `agents/specialists/`, so `agents/specialists/modeler.md`
  and `agents/specialists/_TEMPLATE.md` are invisible to the check. Not
  load-bearing for any commit-1 file name, but recorded here since it was
  verified by reading the lint source while checking these seats' names,
  per the WO's explicit instruction to check what the collision check
  actually scans; the commit-2 Spatial Specialist naming decision (which
  supersedes the legacy `modeler` specialist) depends on this same finding
  — see that section when it lands.
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

- **Builder, Principal, Operator, Refactorer: one file each (the primary
  rung), not every documented rung.** Each of these seats' non-primary
  rungs (Builder's `preferredBounded`/`dense`/`mirror`; Principal's
  `effortPoint2`/`mirror`/`ceiling`; Operator's `tacticalRaise`/`mirror`;
  Refactorer's `mirror`) is already present in `router/castings.json`, so
  `roster/lint.js`'s mirror-or-declared-exception check (which reads the
  casting table, not the shipped files) is satisfied without a matching
  file — the same lawful gap `researcher.md`/`lc-analyst.md` established
  in WO-9. Each file documents its seat's other rungs in prose
  (Casting/Escalation) rather than shipping them, following
  `investigator.md`'s established pattern for its own mirror/ceiling.
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

## Plan-silence / conflict spots (commit 1)

Verbatim quotes and citations for every gap found, per the WO instruction
to say so honestly where the plan is silent, and to STOP and report rather
than edit `router/`, `verifier/`, `registry/`, or `agents/` where a lint
failure would force it.

1. **Refactorer (#18) has no `**Tools.**` bullet in `final-plan.md` Part
   2 at all.** Verified by grepping every `\*\*Tools\.\*\*` occurrence
   across the whole of Part 2 (lines 179–1010): every role from #1
   Conductor through #24 Quartermaster has one except Refactorer and Doc
   Writer (the latter is a commit-2 seat; noted here for completeness,
   fully recorded when that commit lands). `refactorer.md` flags this in
   its own Tools section and synthesizes a Tools grant from the seat's
   Purpose/Contract/Owns prose rather than transcribing a bullet that does
   not exist — the same posture WO-9's band record took for the missing
   `**Strengths.**` bullets across most of Band A/B.

2. **Test Designer (Q0) fails `roster/lint.js`'s mirror-or-declared-
   exception check, unavoidably, for any file shipped under this seat —
   a genuine `router/castings.json` gap, not a file-authoring defect.**
   Confirmed empirically: running `node roster/lint.js` against the
   shipped commit-1 files returns exactly

   ```
   test-designer-vs-anthropic.md: seat Test Designer has neither a mirror rung nor a declared no-mirror exception in castings.json
   test-designer-vs-openai.md: seat Test Designer has neither a mirror rung nor a declared no-mirror exception in castings.json
   ```

   and no other problems, for all six commit-1 shipped files. The check
   (`roster/lint.js:146-152`) is: `hasMirror = !!(role.rungs ||
   {}).mirror; hasException = !!role.noMirrorFor;` — a literal JSON-key
   test against `router/castings.json`'s `roles[seat]` object, independent
   of which or how many lane files ship for that seat. `Test Designer`'s
   two rungs are named `vsAnthropicAuthor` / `vsOpenaiAuthor` (no key
   literally named `mirror`) and the role carries no `noMirrorFor` key.
   Unlike Archivist — whose `documents`/`images` lanes are the same shape
   (no literal `mirror` key) but whose role **does** carry a declared
   `noMirrorFor.videoAudio` exception that satisfies the check — Test
   Designer has no declared exception at all. This is distinct from the
   three `unstatedInPlan` markers the WO named in advance (E5 critic
   effort, E8 contextShapes, D0 contextShapes) — it is an undiscovered
   gap, found by running the lint against real files rather than by
   inspecting the casting table's own `$comment`/`unstatedInPlan`
   annotations. (Commit 2 will confirm a second instance of this same gap,
   Interface Artisan (E5), and record it there.) **Per the WO-10
   instruction — "NO changes to router/... if a lint failure forces one,
   STOP and report the conflict" — `router/castings.json` is left
   unedited.** Test Designer ships anyway (the WO requires staffing all
   ten seats), and `node roster/lint.js`'s exit code is non-zero for this
   reason alone; see the WO-10 report for the exact, isolated diff this
   causes against the "all green" bar. The honest fix, for a future work
   order, is almost certainly adding a `noMirrorFor` declaration to
   `router/castings.json`'s Test Designer role (its two rungs are
   genuinely a family-conditional pair with no meaningful "mirror" of
   either individual rung) — not adding a synthetic `mirror` rung that
   would misrepresent the seat's actual casting shape.

3. **`agents/specialists/*.md` is not scanned by the name-collision
   check** — see Naming decisions above. Recorded here too as a plan/lint
   discrepancy: the WO text asked "check what the collision check
   actually scans," and the answer is: `agents/*.md` only, non-recursive.

## Exercises

_(pending — stage 2; see the stage-2 exercise map delivered in the WO-10
report)_

| Seat | Order | Casting used | Outcome |
|---|---|---|---|
| _(none run yet)_ | | | |

## Review dispositions

_(pending — stage 2)_

## Follow-ons registered

1. **`router/castings.json` gap: Test Designer carries neither a `mirror`
   rung nor a `noMirrorFor` declaration**, so `roster/lint.js`'s
   mirror-or-declared-exception check fails unconditionally for this seat
   — see Conflicts item 2 above for the full citation and the
   empirically-confirmed lint output. Recommended fix (for the work order
   authorized to edit `router/`): add a `noMirrorFor` declaration naming
   why the seat's two rungs are not a primary/mirror pair, following the
   Archivist precedent already in the file. (Commit 2 will register a
   second instance of this same follow-on for Interface Artisan.)
2. **`agents/specialists/*.md` is invisible to `roster/lint.js`'s
   name-collision check** (non-recursive `readdirSync` over `agents/`
   only) — a future roster file could collide with a specialist name
   (e.g. `modeler.md`) without the lint objecting. Recommended fix:
   extend the collision check to also read `agents/specialists/*.md`.
3. **Refactorer (E8) has no `**Tools.**` bullet in `final-plan.md` Part
   2** — this round's file synthesizes a Tools grant from surrounding
   prose rather than transcribing plan text that does not exist; a future
   plan revision should add the missing bullet so the next construction
   round can transcribe rather than synthesize.
