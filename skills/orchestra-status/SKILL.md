---
name: orchestra-status
description: Report the Orchestra harness's live state in this project — harness version, mode (Director or normal), enforcement/pause state, review routing, guard wiring, installed agents, packs, specialists and skills, verification manifest, plans and ledger. Use when the user asks whether the Orchestra is active, which mode the session is running, whether the codex pack is installed and its Sol lane available, why a denial happened, what's installed, or for a general harness health check. Read-only; changes nothing.
---

# Orchestra status

Produce one compact, factual report of the harness's state in this project. This skill is orchestration-class (ORCHESTRA.md §7): safe in the Director's context, because every filesystem fact below comes from one scout mission — never from the Director's own search tools.

## Gather

Mode first, no tools needed: §1 of the protocol — the "You are powered by the model named …" line in your system prompt. Fable or Opus → DIRECTOR MODE; anything else → NORMAL MODE.

Then the facts. Under a Director, dispatch **one scout mission** carrying the checklist below verbatim; in a NORMAL-mode or paused session, check the same list directly with your own tools.

1. **Pause state** — does `.claude/orchestra.pause` exist? Is `ORCHESTRA_PAUSE=1` set in the environment?
2. **Guard wiring** — does `.claude/settings.json` contain a PreToolUse entry whose command references `orchestra-guard.js`? Does `.claude/hooks/orchestra-guard.js` exist?
3. **Protocol** — does `.claude/ORCHESTRA.md` exist? What harness version does its header carry (`Installed by the Orchestra harness (vX.Y.Z)` in the first lines; installs stamped before versioning carry none)? Does `CLAUDE.md` contain the `<!-- ORCHESTRA:BEGIN` marker?
4. **Company** — which of `scout.md`, `detective.md`, `executor.md`, `executor-heavy.md`, `executor-heavy-xhigh.md`, `executor-principal.md`, `reviewer.md` (core) and `reviewer-codex.md`, `executor-codex-heavy.md`, `architect-claude.md`, `architect-claude-xhigh.md`, `architect-claude-max.md`, `architect-codex.md`, `plan-synthesizer.md` (codex pack) are present in `.claude/agents/`? List any other `.md` files there as specialists.
5. **Packs** — what does `.claude/orchestra-install.json` record under `packs` and `specialists` (absent = a pre-packs install, or none selected)? For the `codex` pack, do `.claude/hooks/orchestra-review.js`, `.claude/hooks/orchestra-exec.js`, and `.claude/hooks/orchestra-crossplan.js` exist?
6. **Skills** — which skill directories exist under `.claude/skills/`? (Core: the `orchestra-*` set. From the `codex` pack: `cross-compare-plan`.)
7. **Config** — from `.claude/orchestra.json` (absent = all defaults): `executorEngine` (default `claude`), counts of `directorBlockedPatterns`, `directorPlanPatterns`, and `directorMemoryPatterns`, any `directorAllowedTools`, whether a `verification` manifest exists (quote its `full` command if so), and any `codex` block (report `reviewModel` [default `gpt-5.6-sol`], `reviewTimeoutMs` [default 1800000], `execHeavyModel`/`execHeavyEffort` [defaults `gpt-5.6-sol`/`high`], `helpersDir`, `worktreeRoot`, `worktreeWarmupCmd`, and the counts of `doNotRun` and `integrityIgnore` entries; note explicitly when `authProbe` or `reviewRetries` has been turned off, since both are on by default and disabling them removes a reliability net).
8. **Sol lane availability** — whenever the `codex` pack is installed (not only when a config routes there): is the Codex CLI on PATH (`command -v codex` or a version check; respect `CODEX_BIN` if set)? Do **not** run `orchestra-review.js --doctor` for this report: the doctor repairs the Codex install (it copies files into it), and this report changes nothing. Name repair as a fix instead.
9. **Plans** — does `.claude/plans/` exist, how many `.md` files does it hold, and is `ledger.md` among them?

## Report

Render exactly this block (drop the two Codex lines unless the pack is installed), then stop — no advice unless something is broken:

```
ORCHESTRA STATUS
Mode:         DIRECTOR (Fable|Opus) | NORMAL (<model>)
Enforcement:  active | paused (.claude/orchestra.pause) | paused (ORCHESTRA_PAUSE=1) | guard not wired
Protocol:     .claude/ORCHESTRA.md <present (vX.Y.Z | unversioned)|MISSING> · CLAUDE.md import <present|MISSING>
Company:      scout <✓|✗> detective <✓|✗> executor <✓|✗> executor-heavy <✓|✗> executor-heavy-xhigh <✓|✗> executor-principal <✓|✗> reviewer <✓|✗> · specialists: <names | none>
Packs:        <names | none> (codex roles: reviewer-codex <✓|✗> executor-codex-heavy <✓|✗> architect-claude(+xhigh/max) <✓|✗> architect-codex <✓|✗> plan-synthesizer <✓|✗>)
Skills:       <skill names | none>
Executor:     claude (default) | claude (configured) | codex (Sol lane: available | UNAVAILABLE (<reason>))
Sol lane:     available | UNAVAILABLE (<reason>) | pack not installed
Codex config: review model <id | default gpt-5.6-sol> · review timeout <ms | default 1800000> · exec model/effort <id/level | defaults gpt-5.6-sol/high> · helpers <dir | none> · doNotRun <n>
Policy:       blocked-patterns <n> · allowed-tools <names | none> · plan-patterns <n> · memory-patterns <n>
Verification: manifest present (full: <command>) | no manifest
Plans:        <n> plan file(s) · ledger <present|none>
```

Below the block add a single `FINDINGS:` line ONLY for inconsistencies, each with its one-line fix:

- Guard entry present but a hook file missing, or marker block without `.claude/ORCHESTRA.md` → re-run the installer.
- NORMAL mode yet the user reports denials → model detection failed: pause the harness (§6) and file a bug against the master.
- `codex` pack installed but the Sol lane is UNAVAILABLE → this is an alarm condition under §5, never a silent expected fallback: name the reason, note that campaign review falls back to the fresh-context Opus `reviewer` carrying the §5 alarm, and suggest `--doctor` if the cause looks install-related.
- The Codex CLI present, a lane routed to it, and the user reports runs that return nothing (reviews with no verdict, or orders reporting `EXEC_UNAVAILABLE` / no changes) → the install may be incomplete or a helper misplaced; both lanes share one Codex install. One command answers it and repairs what it can: `node .claude/hooks/orchestra-review.js --doctor`.
- Pack files present but unrecorded in `.claude/orchestra-install.json` (a pre-packs install) → re-run the installer with `--packs <names>` so later updates keep them.
