---
name: orchestra-plan
description: Author a durable Orchestra plan — work orders sized, sequenced, and tiered per ORCHESTRA.md §8, with acceptance criteria and cadence clauses — written to .claude/plans/<slug>.md. Use when the user asks to plan work before building it, wants a plan or design saved to disk, or when a request is large enough that decomposition into work orders is itself the next deliverable.
---

# Orchestra plan

Turn a goal into a plan file under `.claude/plans/` — the Director's own notebook: the guard permits the Director to Write markdown there directly (ORCHESTRA.md §3.1), so the plan is authored by you in both modes, never routed through an executor. Orchestration-class throughout; a dormant or paused session runs the same procedure with its own tools.

## Procedure

1. **INTAKE.** Restate the goal; write concrete done-criteria. Genuine ambiguity → AskUserQuestion now, not three phases in. (For large or risky work, plan mode and user sign-off still apply — this skill produces the durable artifact, not the approval.)
2. **RECON — dispatch scouts, unless this session already mapped the exact territory.** Missions: the files/subsystems the work will touch, existing patterns to follow, test layout and protected suites, mechanical ceilings (lint caps, generated files, line counts), prior art. Independent missions launch together in one message. Under a director model you never explore yourself.
3. **Probes for multi-subsystem work (§8.1.5).** Schedule as the plan's first orders: (a) a scout probe of mechanical ceilings on the files to be touched; (b) a risk-first micro-order that forces the scariest cross-system interaction first, alone.
4. **Decompose into work orders (§8.1).** Every order passes this gate:
   - **One deliverable kind** — author a tool | migrate consumers | rewrite a suite | fix a bug; pick one ("author + migrate" always splits).
   - **≤ ~3 subsystems** touched; report format ≤ ~5 numbered sections.
   - **Credibly one executor run** (~≤80 tool calls) and one review round — else split, or bundle deliberately WITH §8.2 cadence clauses (numbered parts, heartbeat file, tool-call budget). Bundling and cadence are a package, never separable.
   - **Fan-out chains** (per-consumer migrations, per-file hardenings) → parallel orders in isolated worktrees, ending with an explicit sweep order ("find the consumers the sub-orders missed").
   - **Tools refuse to emit garbage** — an order authoring a generator/migrator/pipeline requires built-in self-validation.
5. **Tier and route review (§8.3).** Per order: `TIER: full` unless provably inert (docs/comments/formatting, zero behavior impact) → `TIER: inert`; when unsure, full. Note the engine from `.claude/orchestra.json` `reviewEngine` (Reading that one file is permitted — §3.1), and mark gate-class reviews (integration gates, a chain's final review) for a `reviewer-codex` second opinion.
6. **Write `.claude/plans/<kebab-slug>.md` yourself**, in the template below.
7. **Present.** Phases, order count, parallelism, risks, and where sign-off matters — a few plain beats plus the file path. Get sign-off before EXECUTE when the work is large or risky.

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
- **Context to paste:** <prior findings the agent needs — agents share no memory>
- **Acceptance criteria:** <how the executor knows it's done>
- **Verification:** TIER: <full|inert> — <commands, or "per verification manifest">
- **Cadence:** <heartbeat file · numbered parts · tool-call budget — or "short order: none">
- **Depends on:** <WO-ids | none>

## Sequencing
- Parallel: <WO-ids on disjoint files (worktrees if they overlap)>
- Serial: <chains>
- Gates: <integration gate(s); the chain's sweep order>

## Review routing
- Engine: <opus|codex|dual> (from orchestra.json) · second opinion at: <gate-class WO-ids | none>

## Risks
- <risk → mitigation or probe order>
```

Keep the ledger habit (§8.3.5): as orders complete, record tool calls, parts, wall-clock, and verification runs in `.claude/plans/ledger.md` — it calibrates the next plan's sizing.
