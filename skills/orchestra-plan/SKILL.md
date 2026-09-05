---
name: orchestra-plan
description: "Author a durable Orchestra plan — work orders sized, sequenced, and tiered per ORCHESTRA.md §8, with acceptance criteria and cadence clauses — written to .claude/plans/<slug>.md. Use when the user asks to plan work before building it, wants a plan or design saved to disk, or when a request is large enough that decomposition into work orders is itself the next deliverable."
---

# Orchestra plan

Turn a goal into a plan file under `.claude/plans/` — the Director's own notebook: the guard permits the Director to Write markdown there directly (ORCHESTRA.md §3.1), so the plan is authored by you whatever the session's mode, never routed through an executor. Orchestration-class throughout; a NORMAL-mode or paused session runs the same procedure with its own tools.

## Procedure

1. **INTAKE.** Restate the goal; write concrete done-criteria. Genuine ambiguity → AskUserQuestion now, not three phases in. (For large or risky work, plan mode together with user sign-off still applies — this skill produces the durable artifact, not the approval.)
2. **RECON — dispatch scouts, unless this session already mapped the exact territory.** Missions: the files/subsystems the work will touch, existing patterns to follow, test layout and protected suites, mechanical ceilings (lint caps, generated files, line counts), prior art. Independent missions launch together in one message. Causal *why/how* questions the plan depends on (root-cause a failure, trace a flow end-to-end) become detective cases once the scouts' map is back (ORCHESTRA.md §2). Under a director model you never explore yourself.
3. **Probes for multi-subsystem work (§8.1.5).** Schedule as the plan's first orders: (a) a scout probe of mechanical ceilings on the files to be touched; (b) a risk-first micro-order that forces the scariest cross-system interaction first, alone.
4. **Decompose into work orders (§8.1).** Every order passes this gate:
   - **One deliverable kind** — author a tool | migrate consumers | rewrite a suite | fix a bug; pick one ("author + migrate" always splits).
   - **≤ ~3 subsystems** touched; report format ≤ ~5 numbered sections.
   - **Credibly one executor run** (~≤80 tool calls) and one review round — else split, or bundle deliberately WITH §8.2 cadence clauses (numbered parts, heartbeat file, tool-call budget). Bundling and cadence are a package, never separable.
   - **Fan-out chains** (per-consumer migrations, per-file hardenings) → parallel orders in isolated worktrees, ending with an explicit sweep order ("find the consumers the sub-orders missed").
   - **Tools refuse to emit garbage** — an order authoring a generator/migrator/pipeline requires built-in self-validation.
   - **Principal orders are the exception, not the escape hatch (§8.1).** When the gate above would cut one coherent change into fragments that only make sense together (many coupled seams), or when the territory cannot be planned before it is explored (recon and implementation inseparable), or when the user asks for it, write ONE goal-shaped order for `executor-principal`: goal, observable done-criteria, the intent behind it, explicit boundaries (what must not change), the case file to paste, and the full cadence package (numbered parts, progress file, tool-call budget). Difficulty alone is a heavy-tier reason, not a principal one.
5. **Tier each order (§8.3).** Per order: `TIER: full` unless provably inert (docs/comments/formatting, zero behavior impact) → `TIER: inert`; when unsure, full. Tier narrows what a reviewer must verify — it never picks which engine reviews it; that routing happens at REVIEW time under §5 (Claude-authored → Sol when the `codex` pack is installed, else `reviewer`; Codex-authored → `reviewer`). If an order needs a non-default review timeout or must forbid running something, state it in the order as a flag for the launcher to pass (`--timeout-ms`, `--no-tests`, `--forbid`); prose alone configures nothing. Do not shorten the cap for an inert round: the tier narrows what gets verified, not how long the engine takes to look, and the runner floors inert reviews at 600000ms regardless.
6. **Schedule campaign review (§5).** A plan does not need a review per order — it needs at least one independent review before the campaign's final REPORT. Group related orders into one or more review checkpoints and name them in the plan; for any checkpoint whose work will be committed before its review, require the base and head SHAs at execution time so the launcher can pass `--base-ref`/`--head-ref` and the review reads a clean checkout instead of a working tree carrying the session's own plan files and notes.
7. **Write `.claude/plans/<kebab-slug>.md` yourself**, in the template below.
8. **Present.** Phases, order count, parallelism, risks, and where sign-off matters — a few plain beats plus the file path. Get sign-off before EXECUTE when the work is large or risky.

## Plan file template

```markdown
# Plan: <title>
Date: <date> · Status: DRAFT | APPROVED | IN FLIGHT | DONE

## Goal
<one paragraph>

## Done-criteria
- [ ] <observable criterion>

## Recon summary
- <fact the plan depends on> (path)

## Orders

### WO-1: <title>
- **Kind:** <the one deliverable kind>
- **Scope:** <exact paths / globs>
- **Constraints:** <what must not change; house rules>
- **Intent:** <why the goal exists — required for a principal order; useful on any>
- **Context to paste:** <prior findings the agent needs — agents share no memory>
- **Acceptance criteria:** <how the executor knows it's done>
- **Verification:** TIER: <full|inert> — <commands, or "per verification manifest">
- **Cadence:** <heartbeat file · numbered parts · tool-call budget — or "short order: none">
- **Depends on:** <WO-ids | none>

## Sequencing
- Parallel: <WO-ids on disjoint files (worktrees if they overlap)>
- Serial: <chains>
- Gates: <integration gate(s); the chain's sweep order>

## Review checkpoints
- <checkpoint name>: orders <WO-ids> · commit before review, base/head named at execution · engine per ORCHESTRA.md §5 (Sol default for Claude-authored work with the `codex` pack installed; fresh-context Opus otherwise, or for Codex-authored work)

## Risks
- <risk → mitigation or probe order>
```

Keep the ledger habit (§8.3.5): as orders complete, record tool calls, parts, wall-clock, and verification runs in `.claude/plans/ledger.md` — it calibrates the next plan's sizing.
