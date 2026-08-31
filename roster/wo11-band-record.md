# WO-11 orchestration band — staffing record

Band A (seats 1-3: Conductor, Architect, Synthesizer) staffed per the WO-8–11
order and the WO-8/9/10 construction pattern. Three role files ship this
round. All nine Part 2.0 fields transcribed faithfully from
`plans/cross-compare/agent-role-architecture/final-plan.md` Part 2 Band A
(lines 177-311), cross-checked against `router/castings.json` and
`router/charters.json`. `node roster/lint.js` and `node install.js --lint`
(both `roster/` and repo-wide) pass; the five required test suites pass in
full (counts below).

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
   alone." But `plans/cross-compare/agent-role-architecture/STATUS.md:481-482`
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

_(pending — stage 2)_

## Dispositions

_(pending — stage 2/3, following an R0 review of this staffing round)_

## Follow-ons registered

_(none yet — this round is staffing only; stage 2's exercises may register
follow-ons the way every prior band's stage-2 round did)_

## Review rounds

_(pending)_
