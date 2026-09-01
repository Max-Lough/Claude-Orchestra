# WO-14b leg 3 — cross-vendor review #1 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Pinned `dfcfc9b..5ac3835` (branch `claude/wo14b-leg3`, merged into `claude/wo14b-bridge` at `fca1853`; throwaway worktree). Author family: anthropic (Sonnet 5 Builder; Fable 5 Conductor). Policy: mandatory, gate-class (installer + security guard). Launched 05:10Z, exit 0 at 05:20:23Z; `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 5ac3835c2a0f)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5967ms
PREFLIGHT: pinned review: checked out 5ac3835c2a0f into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-8gMMM7\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] install.js:1580 — Default upgrades do not revoke the legacy push grant or add deny rules — given a project installed at `dfcfc9b`, rerunning the new installer without `--grant-push` leaves `Bash(git push:*)` active and untracked instead of granting only add/commit.
- [MAJOR] [BREACH] install.js:624 — The push deny set does not cover the required dangerous forms — given `git push -d origin branch`, `git push origin :branch`, `git push origin +main`, or `git push origin --delete branch`, the broad push allow applies while none of the five deny patterns match.
- [MAJOR] [BREACH] install.js:1767 — Uninstall removes pre-existing user deny entries because deny ownership is not tracked — given a user-owned `Bash(git push --force*)` before `--grant-push`, uninstall deletes it instead of removing only installer-added permissions.
- [MAJOR] [BREACH] install.js:1858 — Legacy uninstall recursively deletes new-roster paths it never installed — given user-owned `.claude/orchestra/user-data.txt` or `.claude/agents/architect.md`, a legacy install followed by uninstall deletes both instead of preserving unrelated files.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:494 — Malformed hook input still fails open under `roster:new` — given a valid new-roster manifest and malformed stdin such as `{bad`, the guard exits successfully with no denial instead of denying as required.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:262 — A malformed or unreadable new-roster manifest silently becomes legacy policy — given a truncated manifest beginning `{"roster":"new",` and an undetermined model, Bash is allowed instead of failing closed.
- [MAJOR] [BREACH] install.js:1621 — Fresh legacy installs create `.claude/orchestra.json`, violating the pinned legacy census — given a fresh default install, the new `installedPermissions` manifest exists although the base installer created no such file.
- [MAJOR] [BREACH] install.js:716 — Unrelated JSON keys are reserialized rather than preserved byte-for-byte — given an unrelated value `9007199254740993`, installation rewrites it as `9007199254740992` instead of preserving the user value.
- [MINOR] [BREACH] install.js:1390 — `rosterGeneration` is not constrained to an integer — given an existing generation of `0.5`, flipping to new writes `1.5` instead of a valid integer generation.
- [MINOR] [BREACH] README.md:594 — Troubleshooting still says rerunning the installer adds the push grant unconditionally — given a user following this advice without `--grant-push`, the documented result differs from fresh-install behavior.
- [MINOR] [BREACH] README.md:357 — The grants section states that every first turn is a guard stand-down window — given `roster:new`, an undetermined first-turn model is intended to deny, contradicting this paragraph.

CLAIMS CHECKED
- "`--roster legacy` is byte-for-byte today's behaviour" → REFUTED (compared base installer behavior and observed a fresh legacy install create `.claude/orchestra.json`)
- "Default install grants only add and commit" → REFUTED (reproduced an upgrade retaining the base version's unprotected push grant)
- "Uninstall removes exactly what it added" → REFUTED (reproduced deletion of a pre-existing user deny rule and user-owned roster/runtime files)
- "Undetermined model under `roster:new` denies, including malformed input" → REFUTED (malformed hook stdin and malformed manifest both produced allow/no output)
- "User keys are preserved byte-for-byte" → REFUTED (reproduced numeric precision loss during JSON reserialization)
- "`node tests/install.test.js` → 79 passed" → CONFIRMED (reran: 79 passed, 0 failed)
- "`node tests/guard.test.js` → 19 passed" → CONFIRMED (reran: 19 passed, 0 failed)
- "Declared lint, roster, router, scan-lane, and review-lane verification is green" → CONFIRMED (reran all; router 186, scan-lane 41, review-lane 126, all passed)
- "Codex pack registers the orchestra-engine MCP server" → CONFIRMED (fresh `--roster new --packs codex` install registered `orchestra-engine`)
- "install.js and orchestra-guard.js contain zero control bytes and parse" → CONFIRMED (byte scan found zero; both `node --check` commands passed)

NITS
- none
== exit 0 2026-09-01T05:20:23Z ==
