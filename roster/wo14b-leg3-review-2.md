# WO-14b leg 3 — cross-vendor review #2 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `5ac3835..4bbc58b`, confined to install.js / hooks/orchestra-guard.js / their tests / README / ORCHESTRA.md (the leg-3 fix round A+B). **Attempt 1 was refused by the OpenAI cyber classifier (`roster/wo14b-leg3-review-2-unavailable.md`); this is the one reworded retry** (spec-conformance framing; the adversarial half went to the E7 Anthropic mirror). Author family: anthropic (two Sonnet 5 Builders on Fable 5 Conductor-specified designs). Policy: mandatory. Exit 0 at 06:04:26Z (engine clock); `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 4bbc58b4cb39)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5457ms
PREFLIGHT: pinned review: checked out 4bbc58b4cb39 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-6XUZnd\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] install.js:1920 — The legacy broad push grant is stripped only from the selected grants file — given an upgrade where `settings.json` contains `Bash(git push:*)` and the installer runs with `--grants-local`, the dangerous shared grant survives instead of being removed.
- [MAJOR] [BREACH] install.js:2161 — Permission ownership is tracked without its source file — given a user-owned matching grant or deny in `settings.local.json` while Orchestra added that string to `settings.json`, uninstall removes both copies instead of preserving the user-owned entry.
- [MAJOR] [BREACH] install.js:793 — The numeric round-trip guard explicitly skips exponent-form numbers — given `9.007199254740993e15` in an unrelated settings key, installation succeeds and rewrites it as `9007199254740992` instead of refusing before mutation.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:473 — Moving a pinned project silently loses roster:new enforcement — given a valid pinned new-roster installation renamed to another directory, the real-path-derived pin lookup misses, and an undetermined-model Bash call is allowed despite the manifest still declaring `roster:new`.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:392 — The regex rejection heuristic misses catastrophic overlapping alternatives — given `^(a|aa)+$` and a 43-character near-match, the guard emitted no decision before a 15-second timeout instead of rejecting the pattern quickly.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:937 — The pause hardlink defense is unreachable for an existing pause file — given `.claude/orchestra.pause` hardlinked to `.claude/settings.json`, the initial existence check allows immediately, so writing the pause path overwrites settings instead of producing the promised hardlink denial.
- [MINOR] [BREACH] README.md:353 — The grants are still described as empowering only agents — given a non-director, legacy first-turn, or paused main session, the session-wide grants apply unprompted, contradicting this sentence and the required disclosure immediately below it.
- [MINOR] [BREACH] README.md:397 — The manifest-pin documentation says guard enforcement is future work — given the current guard already enforces the pin, readers are told the opposite of the shipped behavior.
- [MINOR] [BREACH] README.md:657 — The model lookup is still documented as a fixed-cost, sub-millisecond tail read — given an exact-64-MiB transcript, the guard performs a whole-file read and took 263 ms in the probe.

CLAIMS CHECKED
- "A plain legacy install writes NO orchestra.json and preserves the legacy census" → CONFIRMED (fresh plain and explicit legacy installs matched the checked-in census; install suite passed 165 checks).
- "The old broad Bash(git push:*) grant is stripped on every install" → REFUTED (`--grants-local` left the broad rule in shared `settings.json`).
- "The four exact-match push rules are correct, and the 12 deny patterns still serve a purpose" → CONFIRMED (literal Bash rules are exact matches and deny precedes allow under [Claude Code permission semantics](https://code.claude.com/docs/en/permissions); the denies provide defense-in-depth against separate broader allow rules).
- "Uninstall removes exactly what it added" → REFUTED (a cross-file user-owned allow and deny were both removed).
- "The JSON numeric round-trip guard refuses unsafe values" → REFUTED (exponent-form unsafe integer was silently rounded).
- "Non-object JSON and non-integer rosterGeneration are refused" → CONFIRMED (reran the relevant installer cases).
- "The pause, plan, and memory carve-outs all enforce hardlink safety" → REFUTED (pause-file existence bypasses its hardlink check).
- "Whole-file transcript scanning is bounded at 64 MB" → CONFIRMED (exactly 64 MiB found the director model; 64 MiB plus one byte produced a corrupt-transcript denial).
- "Unsafe regex patterns are rejected before compilation" → REFUTED (`^(a|aa)+$` passed validation and exceeded the 15-second probe timeout).
- "The manifest pin's no-pin, matching-pin, and mismatched-pin branches behave as specified" → CONFIRMED for an unmoved project (tests and tamper probes), but the real-path relocation failure is not handled.
- "Malformed stdin and malformed/deleted manifest deny under pinned roster:new" → CONFIRMED for an in-place resolvable pin (guard suite passed 53 checks).
- "All declared verification is green" → CONFIRMED (`install --lint`, install 165, guard 53, frontmatter 37, scan-lane 41, roster lint, roster frontmatter lint, and router 196 all exited 0).

NITS
- none
== exit 0 2026-09-01T06:04:26Z ==
