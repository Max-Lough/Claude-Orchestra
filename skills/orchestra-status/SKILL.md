---
name: orchestra-status
description: Report the Orchestra harness's live state in this project — mode (director model or dormant), enforcement/pause state, review engine, guard wiring, installed agents, specialists and skills, verification manifest, plans and ledger. Use when the user asks whether the Orchestra is active, which mode or review engine the session is running, why a denial happened, what's installed, or for a general harness health check. Read-only; changes nothing.
---

# Orchestra status

Produce one compact, factual report of the harness's state in this project. This skill is orchestration-class (ORCHESTRA.md §7): safe in the Director's context, because every filesystem fact below comes from one scout mission — never from the Director's own search tools.

## Gather

Mode first, no tools needed: §1 of the protocol — the "You are powered by the model named …" line in your system prompt. Fable → MODE A; Opus → MODE B; anything else → DORMANT.

Then the facts. Under a director model, dispatch **one scout mission** carrying the checklist below verbatim; in a dormant or paused session, check the same list directly with your own tools.

1. **Pause state** — does `.claude/orchestra.pause` exist? Is `ORCHESTRA_PAUSE=1` set in the environment?
2. **Guard wiring** — does `.claude/settings.json` contain a PreToolUse entry whose command references `orchestra-guard.js`? Do `.claude/hooks/orchestra-guard.js` and `.claude/hooks/orchestra-review.js` exist?
3. **Protocol** — does `.claude/ORCHESTRA.md` exist? Does `CLAUDE.md` contain the `<!-- ORCHESTRA:BEGIN` marker?
4. **Company** — which of `scout.md`, `executor.md`, `reviewer.md`, `reviewer-codex.md`, `planner-gpt.md` are present in `.claude/agents/`? List any other `.md` files there as specialists.
5. **Skills** — which skill directories exist under `.claude/skills/`? (Bundled: the `orchestra-*` set and `ultra-plan`.)
6. **Config** — from `.claude/orchestra.json` (absent = all defaults): `reviewEngine` (default `opus`), counts of `directorBlockedPatterns` and `directorPlanPatterns`, any `directorAllowedTools`, and whether a `verification` manifest exists (quote its `full` command if so).
7. **Codex availability** — only if the engine is `codex` or `dual`: is the Codex CLI on PATH (`command -v codex` or a version check; respect `CODEX_BIN` if set)?
8. **Plans** — does `.claude/plans/` exist, how many `.md` files does it hold, and is `ledger.md` among them?

## Report

Render exactly this block (drop the Codex parenthetical unless it was checked), then stop — no advice unless something is broken:

```
ORCHESTRA STATUS
Mode:         MODE A (Fable directs) | MODE B (Opus directs) | DORMANT (<model> at the helm)
Enforcement:  active | paused (.claude/orchestra.pause) | paused (ORCHESTRA_PAUSE=1) | guard not wired
Protocol:     .claude/ORCHESTRA.md <present|MISSING> · CLAUDE.md import <present|MISSING>
Company:      scout <✓|✗> executor <✓|✗> reviewer <✓|✗> reviewer-codex <✓|✗> planner-gpt <✓|✗> · specialists: <names | none>
Skills:       <skill names | none>
Engine:       opus (default) | opus (configured) | codex (Codex CLI <found|NOT FOUND>) | dual (Codex CLI <found|NOT FOUND>)
Policy:       blocked-patterns <n> · allowed-tools <names | none> · plan-patterns <n>
Verification: manifest present (full: <command>) | no manifest
Plans:        <n> plan file(s) · ledger <present|none>
```

Below the block add a single `FINDINGS:` line ONLY for inconsistencies, each with its one-line fix:

- Guard entry present but a hook file missing, or marker block without `.claude/ORCHESTRA.md` → re-run the installer.
- DORMANT model yet the user reports denials → model detection failed: pause the harness (§6) and file a bug against the master.
- Engine `codex`/`dual` with the Codex CLI missing → reviews fall back to the Opus `reviewer`; expected behavior, note it only.
