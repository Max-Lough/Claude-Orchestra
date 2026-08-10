---
name: orchestra-status
description: Report the Orchestra harness's live state in this project — harness version, mode (director model or dormant), enforcement/pause state, review engine, guard wiring, installed agents, packs, specialists and skills, verification manifest, plans and ledger. Use when the user asks whether the Orchestra is active, which mode or review engine the session is running, whether the codex pack is installed, why a denial happened, what's installed, or for a general harness health check. Read-only; changes nothing.
---

# Orchestra status

Produce one compact, factual report of the harness's state in this project. This skill is orchestration-class (ORCHESTRA.md §7): safe in the Director's context, because every filesystem fact below comes from one scout mission — never from the Director's own search tools.

## Gather

Mode first, no tools needed: §1 of the protocol — the "You are powered by the model named …" line in your system prompt. Fable → MODE A; Opus → MODE B; anything else → DORMANT.

Then the facts. Under a director model, dispatch **one scout mission** carrying the checklist below verbatim; in a dormant or paused session, check the same list directly with your own tools.

1. **Pause state** — does `.claude/orchestra.pause` exist? Is `ORCHESTRA_PAUSE=1` set in the environment?
2. **Guard wiring** — does `.claude/settings.json` contain a PreToolUse entry whose command references `orchestra-guard.js`? Does `.claude/hooks/orchestra-guard.js` exist?
3. **Protocol** — does `.claude/ORCHESTRA.md` exist? What harness version does its header carry (`Installed by the Orchestra harness (vX.Y.Z)` in the first lines; installs stamped before versioning carry none)? Does `CLAUDE.md` contain the `<!-- ORCHESTRA:BEGIN` marker?
4. **Company** — which of `scout.md`, `detective.md`, `executor.md`, `executor-heavy.md`, `executor-heavy-xhigh.md`, `reviewer.md` (core) and `reviewer-codex.md`, `planner-gpt.md` (codex pack) are present in `.claude/agents/`? List any other `.md` files there as specialists.
5. **Packs** — what does `.claude/orchestra-install.json` record under `packs` and `specialists` (absent = a pre-packs install, or none selected)? For the `codex` pack, do `.claude/hooks/orchestra-review.js` and `.claude/hooks/orchestra-deepplan.js` exist?
6. **Skills** — which skill directories exist under `.claude/skills/`? (Core: the `orchestra-*` set. From the `codex` pack: `deep-plan`.)
7. **Config** — from `.claude/orchestra.json` (absent = all defaults): `reviewEngine` (default `opus`), counts of `directorBlockedPatterns`, `directorPlanPatterns`, and `directorMemoryPatterns`, any `directorAllowedTools`, whether a `verification` manifest exists (quote its `full` command if so), and any `codex` block (report `reviewTimeoutMs`, `reviewModel`, `helpersDir`, and the count of `doNotRun` entries).
8. **Codex availability** — only if the engine is `codex` or `dual`: is the Codex CLI on PATH (`command -v codex` or a version check; respect `CODEX_BIN` if set)?
9. **Plans** — does `.claude/plans/` exist, how many `.md` files does it hold, and is `ledger.md` among them?

## Report

Render exactly this block (drop the Codex parenthetical unless it was checked), then stop — no advice unless something is broken:

```
ORCHESTRA STATUS
Mode:         MODE A (Fable directs) | MODE B (Opus directs) | DORMANT (<model> at the helm)
Enforcement:  active | paused (.claude/orchestra.pause) | paused (ORCHESTRA_PAUSE=1) | guard not wired
Protocol:     .claude/ORCHESTRA.md <present (vX.Y.Z | unversioned)|MISSING> · CLAUDE.md import <present|MISSING>
Company:      scout <✓|✗> detective <✓|✗> executor <✓|✗> executor-heavy <✓|✗> executor-heavy-xhigh <✓|✗> reviewer <✓|✗> · specialists: <names | none>
Packs:        <names | none> (cross-vendor roles: reviewer-codex <✓|✗> planner-gpt <✓|✗>)
Skills:       <skill names | none>
Engine:       opus (default) | opus (configured) | codex (Codex CLI <found|NOT FOUND>) | dual (Codex CLI <found|NOT FOUND>)
Codex config: timeout <ms | default 600000> · model <id | codex default> · helpers <dir | none> · doNotRun <n>
Policy:       blocked-patterns <n> · allowed-tools <names | none> · plan-patterns <n> · memory-patterns <n>
Verification: manifest present (full: <command>) | no manifest
Plans:        <n> plan file(s) · ledger <present|none>
```

Drop the `Codex config:` line entirely unless the `codex` pack is installed.

Below the block add a single `FINDINGS:` line ONLY for inconsistencies, each with its one-line fix:

- Guard entry present but a hook file missing, or marker block without `.claude/ORCHESTRA.md` → re-run the installer.
- DORMANT model yet the user reports denials → model detection failed: pause the harness (§6) and file a bug against the master.
- Engine `codex`/`dual` but the `codex` pack is not installed → the engine setting cannot take effect; re-run the installer with `--packs codex`, or set `reviewEngine` back to `opus`.
- Engine `codex`/`dual` with the pack installed but the Codex CLI missing → reviews fall back to the Opus `reviewer`; expected behavior, note it only.
- Pack files present but unrecorded in `.claude/orchestra-install.json` (a pre-packs install) → re-run the installer with `--packs <names>` so later updates keep them.
