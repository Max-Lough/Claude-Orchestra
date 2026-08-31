# WO-8–11 — the next-generation roster

Seat definitions for the role architecture of
`plans/cross-compare/agent-role-architecture/final-plan.md`, staffed band by
band per the WO-8–11 order: **assurance first** (Reviewer both castings,
Sweeper, Red Team), then **evidence** (Scout re-contracted, merged
Investigator, Researcher, LC Analyst, Archivist), then **construction**
(Builder and Principal first, then Operator, Test Designer, Refactorer, then
domain seats), **orchestration last** (Conductor, Architect, Synthesizer,
Quartermaster). The Verifier and Quartermaster substrates are code
(`verifier/`, and P0 pending), not agent files.

These co-install alongside the legacy `agents/` roster for the §6.6 shadow
period — names never collide (the lint enforces it), and the WO-14 alias
layer (`router/aliases.json`) resolves retired names to these seats under
the `roster: new` flag.

## The shipping contract

A role ships only when:

1. **All nine fields are populated** — Part 2.0's role-entry fields, carried
   as body headings in every file: Purpose · Casting · Rationale · Tools ·
   Strengths · Weaknesses / failure modes · Owns / must not receive ·
   Escalation · Review.
2. **`node roster/lint.js` passes** — frontmatter cross-checked against
   `router/castings.json` and `router/charters.json` (seat exists, declared
   rung/lane matches the documented casting, model+effort on the ladder),
   the nine fields non-trivial, **mirror-or-declared-exception** verified
   from the casting table, and no name collision with the legacy roster.
   `node install.js --lint roster` must also pass (frontmatter survives a
   strict YAML parse — the silent-drop hazard).
3. **One end-to-end exercised order** — a real order through the seat's
   contract, recorded in `EXERCISES.md` with the order, casting used, and
   outcome.

## Frontmatter conventions

`seat:` names the casting-table role; `rung:` the documented rung this file
embodies (`lane:` instead for the computed Reviewer). In-harness Anthropic
castings set `model:`/`effort:` directly; OpenAI castings are thin launchers
(`model: haiku` + `engine: codex` + `engine_model:`) driving the Codex CLI
runners, per the field-tested cross-vendor lane.

## Staffed so far

| Band | Seat file | Casting embodied | Exercised |
|---|---|---|---|
| Assurance | `reviewer-anthropic.md` | R0 anthropic lane — Opus 5 · high | R0-EX1 |
| Assurance | `reviewer-openai.md` | R0 openai lane — Sol · high via Codex CLI | R0-EX2 (gate-class tranche review) |
| Assurance | `sweeper.md` | S0 mirror — Sonnet 5 · med (Terra · med primary via codex engine) | S0-EX1 |
| Assurance | `red-team.md` | E7 mirror — Opus 5 · high (Sol · high primary via codex engine) | E7-EX1 |
| Evidence | `scout-anthropic.md` | N0 primary — Haiku 4.5 · off (Luna · low mirror via codex engine) | DEGRADED-ACCEPTED (ex1 superseded, ex2 miscounted exhaustion — see band record) |
| Evidence | `researcher.md` | N1 primary — Sol · med via Codex CLI (Opus 5 · med mirror, no file yet) | DEGRADED-ACCEPTED (ex1 discarded, ex2 rule-compliant BLOCKED — see band record) |
| Evidence | `lc-analyst.md` | N2 primary — Terra · med via Codex CLI (Opus 5 · med mirror, no file yet) | PASS |
| Evidence | `investigator.md` | I0 primary — Opus 5 · high, read-only tool pin (Sol · high mirror / Fable 5 · high ceiling, no files yet) | PASS |
| Evidence | `archivist-documents.md` | M0 documents lane — Terra · med via Codex CLI | PASS (ex2; ex1 typed BLOCKED honestly — see band record) |
| Evidence | `archivist-images.md` | M0 images lane — Opus 5 · med, also the video/audio degradation path's landing point | unexercised — see band record |
| Construction | `builder.md` | E2 primary — Sonnet 5 · medium | PASS — `node test.js` all-pass, separate baseline/impl commits (see band record) |
| Construction | `principal.md` | E3 primary — Opus 5 · high (xhigh effort point routed, not a separate file) | PASS — 4/4 acceptance steps, coupling invariant named, honest split-resistance concession (see band record) |
| Construction | `operator.md` | E0 primary — Sol · high via Codex CLI | PASS — MODULE_NOT_FOUND root cause, minimal fix, install+run independently reproven (see band record) |
| Construction | `test-designer-vs-anthropic.md` | Q0 vsAnthropicAuthor — Terra · med via Codex CLI | PASS — 25-case suite vs. Sonnet-authored implementation, both mutants red, all claims independently reproduced (see band record) |
| Construction | `test-designer-vs-openai.md` | Q0 vsOpenaiAuthor — Sonnet 5 · medium | PASS — suite vs. Sol-authored implementation, both mutants red, 3 informational findings (see band record) |
| Construction | `refactorer.md` | E8 primary — Terra · med via Codex CLI | BLOCKED-PENDING-ENVIRONMENT — 3 attempts, all `unsupported protocol version 6`, no competency signal (see band record) |
| Construction | `runner.md` | E1 primary — Luna · low–med via Codex CLI | BLOCKED-PENDING-ENVIRONMENT — 3 attempts, all `unsupported protocol version 6`, no competency signal (see band record) |
| Construction | `data-engineer.md` | E4 primary — Opus 5 · high | PASS — byte-exact rollback round-trip, poison record refused as verified no-op (see band record) |
| Construction | `interface-artisan.md` | E5 primary — Sol · med–high via Codex CLI, browser/screenshot loop | DEGRADED-ACCEPTED — all 3 files delivered and independently verified; pre-registered render-loop gap unexercised (see band record) |
| Construction | `spatial-specialist.md` | E6 primary — Opus 5 · high | PASS — 15-check validator, negative control proves non-vacuity, byte-identical regeneration (see band record) |
| Construction | `doc-writer.md` | D0 primary — Sonnet 5 · medium | PASS — 28 citations, mechanical checker fails closed (see band record) |
| Orchestration | `conductor.md` | O0 primary — Fable 5 · owner-set effort, the interactive session model itself (no bootstrap layer; not a dispatchable subagent charter — see band record) | EXERCISED — fresh-context Opus 5 audit: 1 VIOLATION (direct Glob/Bash use; corrective adopted), 2 COMPLIANT, 2 INDETERMINATE; dispositions re-ruled in full on round-2 review (see band record) |
| Orchestration | `architect.md` | A0 primary — Sol · xhigh via Codex CLI (owner ruling 2026-08-28; WO-13 transport migration unclosed — see band record) | BLOCKED-PENDING-ENVIRONMENT — 2 engine-reaching attempts, both hit the standing `unsupported protocol version 6` fault before reaching the reference source, no competency signal (see band record) |
| Orchestration | `synthesizer.md` | A1 primary — Fable 5 · xhigh, in-harness, max-reserved once-per-project seat | DEFERRED-DECLARED — max-reserved once-per-project seat; exercised at its first real comparative session (see band record) |

Exercise records and the review dispositions they produced (assurance band):
`wo8-review-dispositions.md`. **The tranche's mandatory cross-vendor review
is REVISE — WO-5/WO-6 have not yet cleared their gate; see the outstanding
findings there.**

Evidence band (WO-9) exercise records and naming/rung decisions:
`wo9-band-record.md`.

Construction band (WO-10) staffing record, naming/rung decisions, the
Builder/Principal legacy-validation table, the two flagged `router/`
mirror-or-declared-exception gaps (Test Designer, Interface Artisan) — later
closed by Director ruling, see the record's Dispositions section — and the
stage-2 exercise record (8/10 seats PASS or DEGRADED-ACCEPTED, 2 seats
BLOCKED-PENDING-ENVIRONMENT by the codex sandbox fault): `wo10-band-record.md`.

Orchestration band (WO-11) staffing record — Conductor, Architect, Synthesizer;
the Conductor's standing-contract-not-subagent-charter shape, the Synthesizer's
plan-silence flags (Rationale/Strengths/Escalation), the Architect's
WO-13-transport-unclosed honesty note, naming/rung decisions, and the P0
Quartermaster substrate note (built by a separate order, not staffed here):
`wo11-band-record.md`.
