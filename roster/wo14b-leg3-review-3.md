# WO-14b leg 3 — cross-vendor review #3 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `4bbc58b..a0cdf4f`, confined to install.js / hooks/orchestra-guard.js / their tests / README / ORCHESTRA.md (leg-3 fix round 2A+2B). Author family: anthropic (two Sonnet 5 Builders on Fable 5 Conductor-specified designs). Policy: mandatory. Exit 0 at 06:40:34Z (engine clock); `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

Leg 3 review history: #1 REVISE 8 MAJOR/3 MINOR → #2 attempt 1 REVIEW_UNAVAILABLE (cyber classifier) → #2 retry REVISE 6 MAJOR/3 MINOR → #3 REVISE 5 MAJOR. E7: pass 1 (3 CRITICAL) → re-verify #1 (2 new CRITICAL) → re-verify #2 in flight.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ a0cdf4f8b836)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 8893ms
PREFLIGHT: pinned review: checked out a0cdf4f8b836 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-XHsaaI\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] hooks/orchestra-guard.js:1303 — A pre-existing pause file bypasses the promised unconditional self-pause write denial — given `.claude/orchestra.pause` hardlinked to `settings.json`, a Write targeting the pause path is allowed instead of denied, permitting the linked settings file to be overwritten.
- [MAJOR] [BREACH] install.js:2626 — `--uninstall --ignore-manifest` skips canonical roster cleanup — given a malformed manifest from a roster:new install, uninstall exits 0 and removes the guard but leaves `architect.md`, `ORCHESTRA-CONDUCTOR.md`, and the runtime substrates installed instead of removing Orchestra.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:715 — Moved-project enforcement depends on the untrusted manifest retaining its `projectId` — given a pinned roster:new project is moved and its manifest is replaced with `{"roster":"legacy"}`, the ID pin is no longer looked up and an undetermined-model Bash call is allowed instead of failing closed on the pinned policy.
- [MAJOR] [BREACH] install.js:2485 — The MISMATCH/NO-PIN fallback removes identical user-owned grants — given the user independently placed `Bash(git commit:*)` in `settings.local.json`, Orchestra added its copy elsewhere, and the manifest later mismatches its pin, uninstall deletes the user's copy instead of removing only Orchestra-owned entries.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:734 — Structurally incomplete pin JSON is accepted as valid when it contains a recognized roster — given a roster:new path pin is replaced by `{"projectDir":<correct path>,"roster":"legacy"}` without `manifestSha256`, loadPolicy treats it as a legacy mismatched pin and allows an undetermined-model Bash call instead of entering the promised UNTRUSTED-NEW state.

CLAIMS CHECKED
- "main() denies any Write/Edit/MultiEdit resolving to .claude/orchestra.pause ... unconditionally" → REFUTED (an independent hardlink probe reported `nlink:2` and an empty guard decision, meaning allow).
- "`--uninstall --ignore-manifest` removes Orchestra without reading the malformed manifest" → REFUTED (independent probe exited 0 but retained roster agents, conductor, and runtime files).
- "pin + manifest missing/mismatch → untrusted, values from pin" → REFUTED (after moving the project and removing `projectId` while changing roster to legacy, `--verify-pin` returned NO-PIN and the guard allowed Bash).
- "corrupt/forged pin → UNTRUSTED-NEW" → REFUTED (a valid-JSON but incomplete path pin with `roster:"legacy"` produced an allow).
- "MISMATCH/NO-PIN fallback removes no user grant and strands nothing" → REFUTED (the fallback removed an independently user-owned identical commit grant).
- "`--grants-local` upgrade strips the shared broad grant; ownership is tracked by file and entry" → CONFIRMED (installer cases 21 and the cross-file uninstall checks passed).
- "Exponent-form unsafe numerics are refused before mutation" → CONFIRMED (`9.007199254740993e15` exited 1, named the literal, and created no agents directory).
- "Regex-shaped patterns are rejected and globs use a bounded non-backtracking matcher" → CONFIRMED (four independent rejection probes completed in 70–80 ms; a 100 KB input completed in 99 ms).
- "Transcript latch, corrupt-state grace, and the over-64-MB tail path work" → CONFIRMED (late director entry in a 68,157,500-byte transcript denied; a director outside the tail did not latch; fresh garbage allowed and backdated garbage denied).
- "Push allowlist contains exactly two strings" → CONFIRMED (installer suite verified only `Bash(git push origin HEAD)` and `Bash(git push -u origin HEAD)` are added).
- "All declared verification is green" → CONFIRMED (`install --lint`, installer 217, guard 86, frontmatter 37, scan-lane 41, roster lint plus roster frontmatter lint, and router 196 all exited 0).

NITS
- none
== exit 0 2026-09-01T06:40:34Z ==
