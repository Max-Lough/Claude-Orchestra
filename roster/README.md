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
| Evidence | `scout-anthropic.md` | N0 primary — Haiku 4.5 · off (Luna · low mirror via codex engine) | pending (WO-9 stage 2) |
| Evidence | `researcher.md` | N1 primary — Sol · med via Codex CLI (Opus 5 · med mirror, no file yet) | pending (WO-9 stage 2) |
| Evidence | `lc-analyst.md` | N2 primary — Terra · med via Codex CLI (Opus 5 · med mirror, no file yet) | pending (WO-9 stage 2) |
| Evidence | `investigator.md` | I0 primary — Opus 5 · high, read-only tool pin (Sol · high mirror / Fable 5 · high ceiling, no files yet) | pending (WO-9 stage 2) |
| Evidence | `archivist-documents.md` | M0 documents lane — Terra · med via Codex CLI | pending (WO-9 stage 2) |
| Evidence | `archivist-images.md` | M0 images lane — Opus 5 · med, also the video/audio degradation path's landing point | pending (WO-9 stage 2) |

Exercise records and the review dispositions they produced (assurance band):
`wo8-review-dispositions.md`. **The tranche's mandatory cross-vendor review
is REVISE — WO-5/WO-6 have not yet cleared their gate; see the outstanding
findings there.**

Evidence band (WO-9) exercise records and naming/rung decisions:
`wo9-band-record.md`.
