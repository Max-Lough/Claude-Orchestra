# WO-11 orchestration band — staffing record

Band A (seats 1-3: Conductor, Architect, Synthesizer) staffed per the WO-8–11
order and the WO-8/9/10 construction pattern. Three role files ship this
round. All nine Part 2.0 fields transcribed faithfully from
`plans/cross-compare/agent-role-architecture/final-plan.md` Part 2 Band A
(lines 177-311), cross-checked against `router/castings.json` and
`router/charters.json`. `node roster/lint.js` and `node install.js --lint`
(both `roster/` and repo-wide) pass; the **six required test suites** pass in
full — named explicitly here rather than left as a dangling "(counts below)"
with no table to land in: `tests/router.test.js` (135), `tests/registry.test.js`
(31), `tests/review-lane.test.js` (116), `tests/verifier.test.js` (101),
`tests/frontmatter-lint.test.js` (37), and `tests/quartermaster.test.js` (187
as of the round-2 review fixes; 154 at this band's own build — see the
Exercises row below). Reconciled against
`plans/cross-compare/agent-role-architecture/STATUS.md`'s WO-11 entry, which
this round corrects from "seven" to the same six (round-2 MINOR fix).

**P0 Quartermaster substrate: separate order.** Seat 24 (Quartermaster, class
P0) is a deterministic code substrate (`verifier/`-shaped, not an agent file)
per `roster/README.md`'s own framing ("The Verifier and Quartermaster
substrates are code (`verifier/`, and P0 pending), not agent files") and per
this work order's own instruction: "The P0 Quartermaster substrate is NOT
yours — a separate order builds it; do not create quartermaster files." No
`router/`, `registry/`, `verifier/`, or `agents/` files were touched this
round, and no `roster/quartermaster*.md` file was created.

## Seats shipped

| Seat | File | Rung embodied | Model | Notes |
|---|---|---|---|---|
| Conductor (O0) | `conductor.md` | primary | Claude Fable 5 · owner-set effort | the interactive session model IS the Conductor — no bootstrap layer; this file is the seat's standing contract, not a dispatchable subagent charter; mirror (Sol · matched, four hard restrictions) documented in-file, not shipped as a separate file |
| Architect (A0) | `architect.md` | primary | GPT-5.6 Sol · xhigh (Codex CLI launcher) | owner ruling 2026-08-28 default; nebulous/exhaustionFallback/mirror/ceilingAnthropic/ceilingOpenai documented in-file, not shipped as separate files; WO-13 transport migration honestly flagged unclosed |
| Synthesizer (A1) | `synthesizer.md` | primary | Claude Fable 5 · xhigh, in-harness | max-reserved once-per-project seat; rationSpent (Opus 5 · high) and mirror (Sol · max) documented in-file; carries the four-step contest-ledger/opposite-family-challenge protocol verbatim; three plan-silent headings (Rationale, Strengths, Escalation) flagged rather than invented |

## Naming decisions

- **All three seats ship under plain, un-qualified names**
  (`conductor.md`, `architect.md`, `synthesizer.md`) — verified against both
  collision surfaces `roster/lint.js` actually scans: `agents/*.md`
  (`executor-heavy-xhigh.md`, `executor-heavy.md`, `executor.md`,
  `reviewer.md`, `detective.md`, `scout.md`) and `agents/specialists/*.md`
  (`_TEMPLATE.md`, `modeler.md`). None of the three names collides with
  either directory, case-insensitively. `node roster/lint.js`'s own run this
  round confirms zero collision violations across all 24 shipped role files.
- No `router/aliases.json` retired name maps onto any of these three seats
  by a name that would suggest a different roster filename: `architect-claude`,
  `architect-claude-xhigh`, `architect-claude-max`, and `architect-codex` all
  resolve to the **Architect** role at various rungs (`nebulous`,
  `ceilingAnthropic` twice, `primary`), and `planner-gpt` resolves to
  `{role: Architect, rung: primary}` too — five retired names converging on
  one seat, none of them a candidate filename here since none is
  `architect` itself and the plain name is free. `plan-synthesizer` resolves
  to `{role: Synthesizer, rung: primary}` — again a retired name distinct
  from the plain `synthesizer` this file ships under.

## Rung / file-count decisions

- **Conductor: one file (the `primary` rung), not two.** `router/castings.json`'s
  `Conductor.rungs` carries `primary` and `mirror`; the mirror (Sol, matched
  effort, activated only "from a signed control checkpoint," four hard
  restrictions) is documented in `conductor.md`'s Casting section in prose,
  the same posture `investigator.md`/`principal.md`/`architect.md` take
  toward their own non-primary rungs. `roster/lint.js`'s mirror-or-declared-
  exception check reads `router/castings.json`, not the shipped files, and
  is satisfied by the rung's mere existence in the table (`hasMirror =
  !!(role.rungs || {}).mirror`); a file for the mirror is a lawful future
  gap, not a defect in this one. The check also special-cases Conductor
  (`seat !== 'Conductor'` in the guard) precisely because its own mirror is
  a rung literally named `mirror` — the general case, not an exception this
  seat needed.
- **Conductor is not a dispatchable subagent charter — this is a genuine
  shape difference from every other roster file, not a naming or rung
  choice.** The WO's own framing settles this: "the interactive session
  model IS the Conductor (no bootstrap layer)." Every other roster file
  describes a seat the harness spawns via the Agent tool, where the
  frontmatter `tools:` line is the actual permission surface granted at
  spawn. There is no spawn point for Conductor — nothing in this repo's
  harness ever dispatches an Agent-tool call naming `seat: Conductor`. The
  file therefore still satisfies every mechanical lint requirement (name,
  description, model, seat, rung, the nine field headings, mirror-or-
  exception) so it ships as a normal roster file for tooling purposes, but
  its own body says explicitly what it is: a standing contract the session
  already carries, documented for the same reason every other seat's
  Owns/must-not-receive line is documented — so the discipline is legible
  and auditable, not because a dispatcher enforces it externally. See
  `conductor.md`'s opening note and its "What 'exercising' this seat means"
  closing section (which replaces the Report-format /
  never-end-your-turn-on-a-running-process convention every dispatched seat
  file carries, since neither is meaningful for a seat that is never handed
  an order and never runs a process of its own).
- **Architect: one file (the `primary` rung), not six.**
  `router/castings.json`'s `Architect.rungs` carries `primary`, `nebulous`,
  `exhaustionFallback`, `mirror`, `ceilingAnthropic`, `ceilingOpenai` — the
  widest rung set of any seat staffed across WO-8–11. Only `primary` (Sol ·
  xhigh, the owner's 2026-08-28 default) ships as a file; the other five are
  documented in `architect.md`'s Casting section in prose, following the
  same non-primary-rungs-in-prose convention `wo10-band-record.md`
  established for Builder/Principal/Operator/Refactorer/Runner/Data
  Engineer/Spatial Specialist/Doc Writer. `roster/lint.js`'s check passes on
  the table entry alone (`hasMirror` true — `Architect.rungs.mirror` exists).
- **Synthesizer: one file (the `primary` rung), not three.**
  `router/castings.json`'s `Synthesizer.rungs` carries `primary`,
  `rationSpent`, `mirror`. Only `primary` (Fable 5 · xhigh) ships;
  `rationSpent` (Opus 5 · high, "when the ration is spent") and `mirror`
  (Sol · max) are documented in `synthesizer.md`'s Casting section in prose,
  same convention. `hasMirror` true — `Synthesizer.rungs.mirror` exists — so
  the mirror-or-exception check passes without a matching file.

## Plan-silence spots, verbatim

Per the WO instruction to flag plan silence rather than invent — "the WO-10
review burned an invented escalation trigger — do not repeat that" — every
gap found this round, with the verbatim grep evidence behind each.

1. **Synthesizer (A1) carries no `- **Rationale.**`, `- **Strengths.**`, or
   `- **Escalation.**` bullet anywhere in `final-plan.md`'s Part 2 entry**
   (seat 3, lines 261-309). Verified by grepping every `^- \*\*[A-Za-z]`
   bold-label bullet across Part 2 Band A (lines 177-311): Conductor (seat
   1) carries all nine plus an extra "Mirror restrictions" bullet; Architect
   (seat 2) carries all nine; Synthesizer (seat 3) carries only Purpose,
   Casting (with "The family problem, and the protocol that closes it" and
   "Cost, stated plainly" as sub-bullets under it), Tools, Weaknesses /
   failure modes, Owns / must not receive, and Review — six of nine, missing
   exactly Rationale, Strengths, and Escalation. This is the same shape of
   gap `roster/wo9-band-record.md` already found for `**Strengths.**` across
   most of Band A/B ("only Conductor, Architect and Runner carry a
   `**Strengths.**` bullet at all") — confirmed again here for Band A
   specifically, plus two further missing headings on this one seat that
   WO-9's survey did not have occasion to check (it staffed Band B, not A).

   **Disposition, following WO-8/WO-9 precedent for the Strengths gap and
   extending the same posture to the two new ones:** `synthesizer.md`
   synthesizes each of the three missing sections from content the plan
   *does* state elsewhere in the same entry — the Casting bullet's "the
   merge is the longest-horizon synthesis in the system" and the
   family-problem framing (for Rationale); the four-step protocol's stated
   decomposition-of-authority mechanics (for Strengths); protocol step 4
   ("Residue → human, unconditional") and the Review bullet's degraded-path
   sentence (for Escalation) — never a fact the plan does not state. Each of
   the three sections in the shipped file opens with an explicit "Plan
   silence, flagged rather than invented" note naming the gap and citing
   this record, rather than presenting synthesized content as a plan
   transcription. No new escalation trigger, benchmark claim, or capability
   claim was invented for any of the three.

2. **Architect (A0)'s primary transport is genuinely unsettled between "the
   old metered path is gone" and "the work order that was supposed to close
   it has run."** `router/aliases.json`'s retired `planner-gpt` entry states
   the old `/deep-plan` metered-API transport "is replaced by the
   subscription Codex CLI (WO-13) or reported unavailable." `CHANGELOG.md`'s
   `2.0.0` entry confirms `/deep-plan`, `orchestra-deepplan.js`, and the
   `orchestra_deepplan` MCP tool are already deleted outright — "No lane
   bills a metered API any more... the codex pack now requires the Codex CLI
   alone." But `plans/cross-compare/agent-role-architecture/STATUS.md:521-523`
   still lists **WO-13 itself** unstruck among the parallelizable,
   not-yet-run orders: "WO-13 (metered planning transport; 'after WO-4, any
   time' — but scope needs a check against the `/deep-plan` retirement)."
   So: no metered path survives to migrate away from (the destination state
   WO-13 targeted already exists, reached by deletion rather than
   migration), but the work order formally chartered to declare that
   transition done, and to check the retirement didn't leave any scope
   unaddressed, has not run. `architect.md`'s Tools section states both
   halves explicitly rather than picking the flattering one, and declares
   `orchestra_exec` as the launcher's tool — the same corrected-semantics
   runner `researcher.md` already established — because it is the only
   lawful cross-vendor transport available today, not because a dedicated
   planning runner shipped or WO-13 formally closed.

## Exercises

Stage 2, run 2026-08-31. Band A's four seats do not share one exercise shape
— O0 is a retrospective self-audit rather than a dispatched mission, A1 is
declared deferred rather than run, and P0 is the substrate exercised live
against real evidence rather than a fixture — so each is reported in its own
terms below rather than forced into one uniform table.

| Seat | Order | Casting used | Outcome |
|---|---|---|---|
| Conductor (O0) | Fresh-context retrospective discipline audit of the Conductor's own conduct across the 2026-08-30/31 session (WO-9/WO-10/WO-11 execution on this branch), dispatched to an agent carrying no prior session context, checked against `roster/conductor.md` as shipped and the plan text it transcribes | Claude Opus 5 (fresh-context dispatched auditor, no prior context) | **EXERCISED.** VERDICT: **1 VIOLATION** — the session used Glob/Bash directly (independent mechanical verification of dispatched-seat claims, and one file-count check), on at least four exercises across two work orders, narrated in the session's own first person; corrective adopted (see Conductor audit dispositions below). **2 COMPLIANT** — author≠approve (every closing verdict in both review chains is attributed to an R0 review, never to the Conductor, and the Conductor's own content inside reviewed diffs was corrected/overturned under review like anyone else's); restricted decisions (no T3 without a named human; every REVISE was obeyed, no Anthropic verdict overridden). **2 INDETERMINATE** — plan-authoring above the size threshold (the threshold is defined nowhere in the repository, so the routing rule is unenforceable and unauditable as written); disclosure duties (no rung was ever computed this session, since P0 did not exist until this same round, so §5.5's rung-change announcement duty never triggered — no unmet duty is shown, but the audit cannot rule out an undisclosed degradation state either). See `roster/wo11-conductor-ex1-audit.md` for the full five-question audit, its verbatim charter citations, and six named findings/gaps (F-1, G-1..G-5). |
| Architect (A0) | Class A0 planning order, T0, plan-only: design the extension of the `orchestra-telemetry.js` hook so its ledger records what P0 allowance accounting needs (role/seat, vendor, model, effort, bucket(s), tokens, remaining-allowance signal), stating precisely what the hook's own stdin parsing can evidence vs. what needs an external contract, forbidding fabricated stdin fields and forbidding a padded two-file-fix plan — deliver `plan-telemetry-extension.md`. Full order text in the appendix below | GPT-5.6 Sol · xhigh, via `orchestra-exec` (Codex CLI launcher) | **BLOCKED-PENDING-ENVIRONMENT.** 2 attempts (initial + one bounded retry, both engine-reaching — preflight auth/exec probe ok both times), both hit the standing `unsupported protocol version 6` sandbox fault at the identical point: `Get-Content -Raw reference\orchestra-telemetry.js` failed repeatedly before any read succeeded, before the model reached the reference source it needed to plan against. Neither attempt fabricated a single claim about the hook's fields or wrote a guessed plan — both returned honest `STATUS: BLOCKED` with `CHANGES: none`, a tree audit confirming no source paths changed, and a `CONCERNS` line naming the actual proximate cause; the order's own forbid-fabrication clause held under a broken toolchain rather than being tested against a working one. Report-format discipline (verbatim runner relay, no invented architecture) was the one thing still checkable from a BLOCKED transcript, and it held on both attempts. No competency signal on GPT-5.6 Sol at this mission was obtained — the casting itself never got a chance to plan. Exercise owed once the fault clears; the planning goal itself (the telemetry-hook extension design) is a registered follow-on deliverable independent of when the seat is re-exercised. See `roster/wo11-architect-ex1-transcript.md` (attempt 2, the bounded retry) and `roster/wo11-architect-ex1-transcript-attempt1.md` (attempt 1). |
| Synthesizer (A1) | — (not dispatched this round) | — | **DEFERRED-DECLARED.** The Synthesizer's cast is max-reserved and once-per-project (`roster/wo11-band-record.md`'s own Seats-shipped notes; `synthesizer.md` Casting section); a toy comparative merge invented for the sole purpose of exercising the seat would prove little about a casting whose entire value is a genuine multi-source contest under real stakes, and would spend the once-per-project reservation on a synthetic problem. Declared rather than silently skipped: the seat is exercised at its first real comparative session, whenever that arrives in this program's own work, not on a schedule invented to close this row. Owner override invited if a synthetic exercise is wanted sooner. |
| Quartermaster (P0) | substrate — no dispatch order; exercised by running the shipped code live: extract the one evidenced reading from `.claude/orchestra-manual-readings.md`, record it into the real (previously nonexistent) `.claude/orchestra-pool-readings.jsonl` via the module API, run `--report`/`--state`/`--publish` against that real file, then demonstrate the complete-state pipeline (`bucketState()` → real `router.dispatch()`) against a separate temp-file fixture completing the other three buckets | deterministic code substrate (`quartermaster/quartermaster.js`), no model in the loop | **EXERCISED LIVE: PASS with DEGRADED evidence coverage.** Real coverage is 1 of 4 buckets (OU only, 0.86 remaining, sourced from the WO-2 Codex-window probe row in the manual-readings file) — the manual-readings file currently carries no Claude `/status` row at all for any AU-side bucket, a genuine gap in operator practice, not a substrate defect. Fail-closed demonstrated verbatim for the three unevidenced buckets: `--state` and `--publish` both exit 1, name every missing bucket by name, and print the exact `--record` command that fixes each one, never defaulting to Green (fabricated capacity) or Red (fabricated scarcity); `--publish` wrote no snapshot file on the refusal. `--report` never throws — it printed the one real OU line (disclosed STALE at 2 days old, undiscounted) and the three REFUSED blocks in the same run. The full pipeline was proven end-to-end on a labeled, non-real fixture completing all four buckets: `bucketState()` fed into the real `router.dispatch()` for an I0 order casts the Investigator to its Opus 5 primary rung (Green, gate allowed) with the cross-family review closing on GPT-5.6 Sol — the mechanism works; the fixture readings are explicitly not a real operational routing decision. The real readings file now holds exactly one real, sourced, honestly timestamped line and stays on disk (gitignored, untouched by anything else this round). The 152/154-check `tests/quartermaster.test.js` suite (152 checks at P0's own build; 154 after commit `acbf8f2`'s R4 test changes — the corrected-forecast test additions, not a readings-file check fix as an earlier draft of this row mis-attributed it) plus the router-interop section within it (§7, a P0-produced state fed through the real router end to end: Green path, the P15 reserve gate, the §5.5 Amber arm and its confirmation lift, the exhaustion-matrix recast, and the mandatory-review-does-not-close-same-family refusal) are the substrate's primary exercise — the same standing that WO-5's own unit suite was accepted as the Verifier substrate's exercise. See `roster/wo11-p0-ex1-report.md` for the full run transcript. |

## Conductor audit dispositions (Director, 2026-08-31; D1 re-ruled round 2, 2026-08-31)

Closing the six findings/gaps the O0 audit (`roster/wo11-conductor-ex1-audit.md`)
raised, per the Director's ruling on this band:

- **D1 (violation, accepted in part) — SUPERSEDED IN ROUND 2, see the
  Director's re-ruling immediately below.** Kept here, struck through, as the
  record of what round 1 actually said; the round-1 title's "F-1/" label was
  itself a mislabel (D1 addresses the VIOLATION finding, Q1 — not F-1, which
  is a distinct charter gap disposed of in its own line below):

  ~~The audit's VIOLATION finding — the session used Glob/Bash directly
  during this window — is accepted **in part**: the confirmed uses were
  orientation (locating files/status before dispatch) and independent
  verification of dispatched-seat claims (a count check, mechanical
  re-runs), not authorship of shipped work product. **Corrective, effective
  immediately:** Conductor-side tool use is confined to memory and record
  files (WRITE-DOC, as chartered); every verification act — re-running a
  suite, re-counting a file inventory, re-deriving a claimed figure — is
  dispatched to a seat chartered for it (Verifier, Reviewer, or a
  scout/general-purpose agent), never performed by the session directly,
  even where the session already holds the tool. **Re-attribution:** where
  an orchestrator-agent (this repo's Conductor-adjacent dispatching
  pattern) performs verification work itself, that is lawful
  dispatcher-verifier conduct under the architecture — but the record must
  name the acting agent by its actual seat/casting, never fold it into "the
  dispatching session" as an undifferentiated actor. This ruling is the
  corrective the Exercises row above cites.~~

  ---
  D1 (revised, round 2): the audit's VIOLATION is accepted IN FULL, all counts as the audit recorded them: (a) direct Glob/Bash use by the session; (b) WRITE-of-source and EXECUTE — check.js authored and run on the session's verification path ("both denied" per the charter); (c) the verification-path fixture construction the audit's bounding sentence names. The round-1 disposition's "orientation" mitigation appears nowhere in the audit and is WITHDRAWN as invented. The "lawful dispatcher-verifier" re-attribution restated Defence (1), which the audit examined and rejected; it is WITHDRAWN as a ruling and may only be re-raised as a charter-amendment proposal to the owner — the lawful path. Corrective, broadened: ALL verification, fixture construction, and counting is dispatched to charters that own it; the session's own tools are confined to reading its memory/records and authoring its own dispatch/ruling texts.
  ---

- **F-1 (charter gap, registered as owner follow-on).** The audit's F-1
  finding, dropped from round 1's record while its label was reused for D1
  (fixed above): the author-and-approve prohibition (`conductor.md:42-51`,
  `final-plan.md:209-214`) is scoped to the Sol depletion mirror only — it
  binds the mirror, not the Fable primary. Nothing in the charter forbids
  the Fable Conductor from author-and-approving the same plan, and this
  session's two post-APPROVE cleanup rounds did exactly that (a
  Conductor-authored ledger line as the only closing determination).
  **Lawful today** — no violation — **worth closing**, since the
  restriction was presumably written for the mirror because the mirror is
  *less* trusted, not because the primary is exempt from the principle.
  Registered as an owner follow-on (charter gap), not closed by this band.
- **D2 (G-1, process gap).** Accepted: a post-APPROVE cleanup round that
  touches executable code is not the same act as re-revising the artifact a
  reviewer already read, and the "only CRITICAL/MAJOR forces REVISE" rule
  the two prior bands cited does not, on its own text, license shipping code
  no reviewer ever saw. **Ruling:** from WO-11 forward, any post-APPROVE
  cleanup commit that touches executable code (not memory/record/plan prose)
  gets a delta review before it lands — the lint tool, router, registry,
  verifier, and roster/agent files all count. Applied retroactively here:
  commit `4680027`'s 15-line `roster/lint.js` addition (the WO-10 round-3
  cleanup the audit's G-1 named by number) is added to this band's own R0
  review scope as a delta item. **Retroactive scope, second instance not
  covered here:** the audit's G-1 finding also names commit `357c96d`
  (`roster/researcher.md`, changed post-APPROVE in WO-9 round 4) as a second
  instance of the same pattern. This band's review range does not extend to
  WO-9, so `357c96d` is not retroactively reviewed by this ruling — it is
  registered as owed to the NEXT delta review's scope.
- **D3 (G-2, record gap).** Accepted: WO-9 and WO-10 committed no review
  artifacts at all — no order, no verdict, no reviewer casting — leaving the
  entire review chain attested only by a Conductor-written ledger row and
  fix-commit bodies in reviewer voice. **Ruling:** WO-8's practice is
  restored starting this band. From WO-11 on, every review round's verdict
  is committed verbatim as a `roster/wo11-r0-review-*.md`-shaped record file
  (order/verdict, and the reviewer casting/lane that produced it), not
  summarized into a ledger row alone. WO-9/WO-10's missing verdicts are not
  reconstructed by this ruling — see Follow-ons registered. **Consequence,
  from the audit's G-2 itself:** without a committed verdict artifact for
  each round, no auditor can check whether the R0 lane was actually
  family-independent of the artifacts' Anthropic author set — which
  `reviewer-anthropic.md:20,40` calls a dispatch defect if it was violated
  ("if the packet reveals the artifact was Anthropic-authored at mandatory
  class, that is a dispatch defect: say so and return no verdict"). The
  committed-verdict practice this ruling restores is what makes
  family-independence verifiable going forward, not merely assumed.
- **D4 (G-3, charter gap).** Accepted: "plan authoring above the size
  threshold (→ A0)" appears three times across `conductor.md`,
  `final-plan.md`, and `router/charters.json`, and is defined numerically or
  structurally nowhere. **Ruling:** registered as an owner follow-on (a
  routing rule with an undefined trigger cannot be mechanically enforced or
  audited); not closed by this band, since defining it is a plan-level
  decision outside a construction/staffing order's authority. **Settling
  condition (ii), addressed:** the audit named a second thing that would
  settle Q4 — "the P0 order text committed to the record alongside the
  substrate, so the rulings can be read as issued rather than reconstructed
  from the artifact that consumed them." The P0 order's ten normative
  rulings ARE committed to the record: they are `quartermaster/README.md`'s
  R1-R10 design rulings, each numbered and marked plan-cited or
  unstatedInPlan. See the Order texts appendix below for the honest-scope
  statement of what is and is not preserved verbatim.
- **D5 (G-4, disclosure gap).** Accepted, and now partially self-closing:
  the audit found five-plus Opus 5 dispatches proceeded this session with no
  Quartermaster in existence and therefore no way for the §5.5 P15 gate to
  arm — inert, not overridden, but never disclosed as such. **Ruling:** P0
  now exists (this band). From here forward, every dispatch decision this
  session states carries the bucket_state a Quartermaster read produced —
  once the owner records real `/status` readings for the AU-side buckets
  (see Follow-ons registered), P0's fail-closed behavior makes an
  un-armable gate a loud refusal instead of a silent condition, closing the
  gap going forward rather than retroactively.
- **D6 (G-5, structural).** Accepted as a design consequence, not a defect:
  the Conductor's own deliverable is "legible in the transcript, not in a
  block a downstream parser expects" (`conductor.md:124-127`), so three of
  the audit's five questions hit a boundary no repository artifact can
  cross. **Ruling:** the fresh-context trace audit this band ran (dispatch
  an agent with zero prior context, hand it the committed record, let it
  check the record against the charter) is adopted as the standing O0
  exercise form for future bands — it is the closest audit this
  architecture can run on a seat whose real deliverable is the conversation
  itself, and it produced genuine, specific, checkable findings despite the
  boundary. **Formal rule, adopting the audit's own recommended remedy
  (G-5: "something transcript-derived… has to enter the record"):** this
  band record's Conductor audit dispositions section, together with its
  Order texts appendix, jointly CONSTITUTE the per-work-order decision log
  G-5 calls for, going forward — not a separate document to be built later.
  Every future band's dispositions and order texts serve this same function.

## Dispositions

_(pending — stage 2/3, following an R0 review of this staffing round)_

## Incidents

1. **Protocol fault tally updated: Architect adds 2 more engine-reaching
   fault hits.** `roster/wo10-band-record.md`'s own Incidents section
   established the counting rule this record continues: "an attempt is one
   `orchestra_exec` invocation that reached the engine (preflight probe
   completed); a refusal that never reaches the engine … is a distinct
   fault, counted separately." By that rule, WO-9+WO-10 stood at **10 of 14**
   engine-reaching attempts hitting the `unsupported protocol version 6`
   fault (`roster/wo10-band-record.md`'s Incidents section). **Stated as
   what it is, not overstated as independent confirmation (round 2):**
   `plans/cross-compare/agent-role-architecture/STATUS.md`'s WO-10 entry
   repeats the same 10/14 figure, but both were written by the same
   Conductor-session author in the same round — that is one figure
   recorded in two places, not two independent derivations. The figure's
   actual independent grounding is the WO-10 round-2 delta review itself:
   MAJOR 5 of that review's fix commit (`f98316f`) is what derived the
   exact 10-of-14 tally from a per-attempt list under an explicit counting
   rule, REPLACING an earlier, wrong "6 of ~15" figure — that derivation,
   not the STATUS.md mirror, is the re-check this figure actually rests on.
   This band's Architect exercise ran 2 attempts total — the
   initial attempt (run nonce `c674e8e8ee3cc33b`) and one bounded retry (run
   nonce `5e45a429253dca7f`) — and **both reached the engine** (each
   transcript's own `PREFLIGHT: auth/exec probe: ok` line, at 6104ms and
   7645ms respectively, before the fault hit mid-run on
   `Get-Content -Raw reference\orchestra-telemetry.js`). Both are therefore
   fault-hit, engine-reaching attempts by the same rule, adding 2 to both
   the numerator and the denominator: **12 of 16** engine-reaching attempts
   across WO-9/WO-10/WO-11 have now hit this fault
   (`roster/wo11-architect-ex1-transcript.md`,
   `roster/wo11-architect-ex1-transcript-attempt1.md`). Still ESCALATED, per
   WO-10's follow-on; this band adds evidence, not a new finding.
2. **The Architect exercise agent violated its scratchpad instruction.**
   Rather than writing its fixtures, transcripts, and reports under the
   session's assigned scratchpad directory, the dispatched exercise agent
   created three directories directly at the repository root:
   `wo11-fixtures/`, `wo11-transcripts/`, `wo11-reports/` — all untracked.
   **Corrected evidence basis (round 2):** the round-1 text attributed a
   "`git status --porcelain` before/after both attempts" attestation to
   this agent that does not exist verbatim in either transcript. The actual
   basis is the Architect exercise agent's own report line, as the
   dispatching session recorded it: *"git status --porcelain in the live
   project root shows no modified/deleted tracked files — only new
   untracked dirs this exercise created (`wo11-fixtures/`,
   `wo11-transcripts/`, `wo11-reports/`) plus pre-existing unrelated
   untracked material from a parallel agent building `quartermaster/`."*
   **Reconciled against the sibling record:** `roster/wo11-p0-ex1-report.md:337-340`
   states these same three directories "predate this session… left
   untouched" from the P0 exercise task's own point of view. Both records
   are consistent once the timeline is stated: the Architect exercise agent
   created the three directories during its own run, ~19:10–19:15
   (directory timestamps), and the P0 exercise task began later in the same
   session window — correctly observing them as pre-existing relative to
   ITSELF, not claiming to have created or touched them. Cleaned this
   commit: the evidence worth keeping was copied into
   `roster/wo11-architect-ex1-transcript.md`,
   `roster/wo11-architect-ex1-transcript-attempt1.md`, and this band
   record's Exercises row and Order-texts appendix; the three stray
   directories were then deleted in full. No tracked repository state was
   ever at risk from this incident — it is a scratchpad-discipline defect
   in the exercise agent's own conduct, not a data-loss or scope incident.
3. **The P0 R4 escalation + Director correction story.** The Quartermaster's
   default forecast originally derived `mandatoryReviewDraw` from a PEAK
   arrival-rate reading, which drove the default required reserve to
   ~65.5% — above the ladder's own Green threshold, meaning a healthy
   80%-remaining bucket would have read as `belowReserve` under the
   substrate's own default. Rather than quietly softening that surprising
   number, the build escalated it explicitly (documented at the point of
   use in `quartermaster.js` and carried into `quartermaster/README.md`'s
   own record). On Director review, the peak-derived arithmetic was
   rejected: the WO-2 throughput probe's actually-measured weekly draw
   (~3 percentage points across 20 gate-class reviews, ~8%→11% of the
   Codex window) is the right basis, not a sustained-peak assumption run
   across a full week. Corrected (commit `acbf8f2`): `mandatoryReviewDraw`
   is now the WO-2-measured 0.03, which sits below the plan's own 8% floor,
   so the floor (not the dynamic term) governs the default required
   reserve. The rejected peak-derived arithmetic is preserved, not deleted,
   in `quartermaster/README.md` — a record of the wrong turn and the
   correction, not just the corrected answer.

## Follow-ons registered

1. **Architect exercise + the telemetry-extension plan owed.** No
   competency signal on GPT-5.6 Sol at this mission was obtained — both
   attempts were stopped by the environment fault before the model reached
   its reference source. The order text is reproduced verbatim in the
   Order texts appendix below, so the exercise is fully reproducible once
   the fault clears. The planning goal itself — a design for extending
   `orchestra-telemetry.js`'s ledger to carry what P0 allowance accounting
   needs (role/seat, vendor, model, effort, bucket(s), tokens, remaining-
   allowance signal) — is a registered deliverable independent of when the
   seat is re-exercised; it does not go away if a different casting ends up
   producing it.
2. **Owner records `/status` readings to bring P0 live — the go-live
   step.** `.claude/orchestra-manual-readings.md` currently carries no
   Claude-side row at all; recording real readings for `AU-all` (and
   `AU-opus`/`AU-fable` if the vendor UI breaks them out) via `node
   quartermaster/quartermaster.js --record <bucket> <fraction> --source
   "<where you read it>"` is what turns `--state`/`--publish` from a
   fail-closed demonstration into a lawful, fully real, complete pool
   state — the step that actually arms the §5.5/P15 gates for real
   dispatch decisions rather than leaving them structurally un-armable.
3. **Size-threshold definition (owner).** "Plan authoring above the size
   threshold (→ A0)" is undefined anywhere in the repository (D4/G-3
   above); a numeric or structural definition is an owner/plan-level
   decision, not something a construction or staffing order can supply on
   its own authority.
4. **Synthesizer exercise at first real comparative session.** Declared
   deferred rather than run this round (see Exercises above); owner
   override invited if a synthetic exercise is wanted sooner than the
   seat's first genuine multi-source contest.
5. **WO-9/WO-10 verdict reconstruction at owner's option.** D3 restores
   WO-8's practice of committing verbatim review-verdict records starting
   this band; it does not retroactively reconstruct the missing WO-9/WO-10
   verdict artifacts (G-2). Reconstruction — from the fix-commit bodies'
   reviewer-voice enumeration, if the owner judges that sufficient — is
   available but not performed here.
6. **P0 ledger maintenance (round 2, `quartermaster/README.md` R11).**
   DECLARED NOT IMPLEMENTED in v1: rotation/integrity of
   `.claude/orchestra-pool-readings.jsonl` and the snapshot it publishes,
   as the append-only log grows across the life of a project. Scope not
   yet designed.
7. **P0 cost reporting (round 2, `quartermaster/README.md` R12).**
   DECLARED NOT IMPLEMENTED in v1: per-window draw summaries (how much of
   a bucket a given work order or review round drew), blocked on the same
   ledger-attribution gap R2 already names — becomes possible once
   follow-on 1 above (or R2's own follow-on) extends the telemetry hook to
   carry role/effort/vendor/bucket attribution.

## Order texts

The Architect exercise is the only stage-2 exercise this band dispatched via
a literal work-order file (`orchestra-exec`); it is reproduced verbatim
below. The Conductor and Quartermaster exercises ran as a Director order
direct to a dispatched agent / to the session itself, with no separate order
file — each is condensed here in a sentence or two, following the WO-10
band record's own convention for its six in-harness orders.

### Condensed orders

- **Conductor (O0).** Dispatch a fresh-context agent (Opus 5, no prior
  session context) to audit the Conductor's own conduct across the
  2026-08-30/31 session against `roster/conductor.md` as shipped and the
  plan text it transcribes, on five named questions (owns-O0-only;
  author≠approve; restricted decisions; size-threshold routing; disclosure
  duties), citing the committed record (band records, exercise reports/
  transcripts, `STATUS.md`) rather than any conversation the auditor cannot
  see, and typing each verdict COMPLIANT / VIOLATION / INDETERMINATE-from-
  record rather than guessing past what the artifacts show.
- **Quartermaster (P0).** Run the shipped substrate live: extract the most
  recent evidenced reading from `.claude/orchestra-manual-readings.md`
  and record it into the real `.claude/orchestra-pool-readings.jsonl` via
  the module API (not the CLI, so the reading's own recorded timestamp can
  be injected as `now`); run `--report`, `--state`, and `--publish` against
  that real file and record the literal output of each; then, without ever
  writing a fixture value into the real file, build a separate temp-file
  fixture completing the other three buckets and demonstrate the full
  `bucketState()` → real `router.dispatch()` pipeline against it. Never
  fabricate a bucket the manual-readings file does not evidence.

**P0's own build/design order, preserved by content rather than by transcript
(D4 settling condition (ii), round 2).** The Quartermaster substrate itself
was built under a separate Director order distinct from the live-exercise
order condensed above; that build order's normative content — the ten design
rulings it settled — is preserved in the session record with its full
normative content mirrored by `quartermaster/README.md`'s R1-R10 (each
plan-cited or unstatedInPlan, numbered, with its rationale stated). Honest
scope: this is content preservation, not verbatim-prose reconstruction — the
order's own original wording is not reproduced here the way the Architect's
Codex order text is below, only the rulings it produced.

### Codex order text, verbatim

#### wo11-architect-order.md (Architect, A0)

```
Class A0 planning order, T0, plan-only (you implement nothing). GOAL: design the extension of the orchestra-telemetry hook so the ledger records what P0 allowance accounting needs — per call: role/seat, vendor, model, effort, bucket(s), and where exposed, tokens and the CLI's remaining-allowance signal — while preserving the hook's hard constraints (never blocks, never writes stdout in hook mode, exit 0 always, zero deps, append-only JSONL, backward-compatible with existing 2,900+ line ledger and its --report mode). The hook receives Claude Code PostToolUse/SubagentStop JSON on stdin: state precisely what fields ARE available there vs what must come from elsewhere (e.g. an env contract with the dispatcher, order-embedded metadata), and do NOT assume fields you cannot evidence from the provided hook source's own parsing. Deliver: numbered design with data-flow, the new record schema (versioned), migration/compat strategy, failure modes, test plan, and an explicit UNKNOWNS section for what needs live verification. Write the plan to plan-telemetry-extension.md.

SCOPE CONSTRAINTS:
- Plan only. You do not implement, edit, or execute anything against the current hook or any other file. No code changes, no test runs, no shell commands beyond what is needed to read your reference material and write the plan document.
- Read-only reference material is provided under ./reference/: the actual orchestra-telemetry.js hook source, a reference.md excerpt of router/castings.json (buckets/modelBuckets/poolStateLadder/reserve), and a reference-plan.md excerpt of final-plan.md (seat 24 Quartermaster + WO-1 ledger fields). Base every factual claim about the hook's current behavior on the copied hook source, not on assumption or general Claude Code knowledge.
- Deliverable is exactly one file: plan-telemetry-extension.md, written at the root of this working directory.
- Do not fabricate hook stdin fields. If a field the design needs (e.g. effort, vendor, bucket) is not visible in the hook's own JSON.parse/property-access logic, say so explicitly and route it to the UNKNOWNS section or propose an explicit external contract (env var, order-embedded metadata) rather than asserting Claude Code already provides it.

FORBID:
- No implementation, no diffs, no patches, no test execution.
- No modification of reference/orchestra-telemetry.js or any file under reference/.
- No plan for a two-file fix — this is a system design deliverable, not a trivial patch; if the honest answer collapses to "edit two lines," say so plainly rather than padding it into an over-plan.
- No security-sensitive planning tangents (this goal is not security-sensitive; do not route into cyber/bio adjacent material).
```

Note: per D3 above, this band's R0 review verdicts will be committed
verbatim as `roster/wo11-r0-review-*.md` files, restoring WO-8's practice
after the WO-9/WO-10 gap (G-2) — not summarized into a ledger row alone.

## Review rounds

_(pending)_
