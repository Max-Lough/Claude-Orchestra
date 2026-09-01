# WO-14b leg 3 — cross-vendor review #4 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `a0cdf4f..733d427` (fix round 3A+3B), confined to the leg-3 files. Author family: anthropic (two Sonnet 5 Builders on Fable 5 Conductor-specified designs). Policy: mandatory. Exit 0 at 07:20:10Z (engine clock); `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

Leg 3 review history: #1 8 MAJOR/3 MINOR → #2 (retry) 6 MAJOR/3 MINOR → #3 5 MAJOR → #4 3 MAJOR/1 MINOR.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 733d4275b24c)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 6634ms
PREFLIGHT: pinned review: checked out 733d4275b24c into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-AGjLX3\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] install.js:919 — Git-keyed pin discovery is incorrectly conditional on the manifest still existing — given a roster-new Git project is moved and its manifest deleted, uninstall reports success but leaves the roster agents, conductor, and runtime substrates instead of performing canonical cleanup.
- [MAJOR] [BREACH] hooks/orchestra-guard.js:831 — `installedPermissions` is falsely treated as a roster-new-only fingerprint — given `--roster legacy --grant-push` creates this key and its pin later disappears, an undetermined-model Bash call is denied as UNTRUSTED-NEW instead of retaining legacy stand-down behavior.
- [MAJOR] [BREACH] install.js:1061 — The numeric guard remains digit-count-based rather than value-based — given the exactly representable literal `9007199254740992.0`, installation exits 1 for alleged precision loss instead of accepting the value as it does cosmetic `5.0` and exponent spellings.
- [MINOR] [BREACH] install.js:854 — Uninstalling a moved project leaves its original path-keyed pin behind — given lookup succeeds through the Git pin, `removePin()` recovers only `projectId`, deletes the Git/id pins, and retains the computable old-path pin, which can later misclassify a project created at that path.

CLAIMS CHECKED
- "classifyPauseWrite() runs BEFORE the pause-exists short-circuit; a directory at the pause path is ignored" → CONFIRMED (independent hardlink and directory probes both denied the relevant main-session operations).
- "`--uninstall --ignore-manifest` removes the roster files, conductor file and substrates" → CONFIRMED (independent malformed-manifest probe removed all three categories while leaving the manifest untouched).
- "git-root key + fingerprint rule keep a moved project with `{\"roster\":\"legacy\"}` denied" → CONFIRMED (independent moved-Git-project probe denied Bash with hash-mismatch and moved-project annotations).
- "MISMATCH/NO-PIN fallback touches settings.json only and honours userOwnedPermissions" → CONFIRMED (independent probe preserved settings.local.json byte-for-byte and retained the user-owned shared grant).
- "pinSchemaProblem() validates a structurally incomplete pin as UNTRUSTED-NEW" → CONFIRMED (independent incomplete-path-pin probe denied Bash and named `invalid pin (manifestSha256)`).
- "hasRosterNewFingerprint() checks only roster:new fingerprints" → REFUTED (source audit shows all listed fingerprints must be removed together to reach unpinned legacy, but an independent legacy `--grant-push` probe demonstrated that `installedPermissions` is also written for legacy and alone forces UNTRUSTED-NEW).
- "findUnsafeNumericLiterals() is value-based" → REFUTED (`9007199254740992.0` was refused despite preserving its exact numeric value).
- "the deleted-manifest cleanup and git-root pin remove paths work" → REFUTED (independent moved-plus-deleted-manifest probe exited 0 while retaining roster files and the original path pin).
- "head+tail transcript windows, birthtime gating, self-match exclusion, array caps, moved-project loosening removal, pattern-key validation, and junction containment work" → CONFIRMED (guard and installer suites plus source inspection exercised these cases).
- "All declared verification is green" → CONFIRMED (`install --lint`, installer 308, guard 129, frontmatter 37, scan-lane 41, roster lint plus roster frontmatter lint, and router 196 passed; the installer suite required an unsandboxed rerun for its intentional outside-workspace containment fixture).
- "STATUS: DONE" → REFUTED (the independent probes above expose three material contract failures; whether the recorded 110/109-call overruns caused a rushed close is UNVERIFIED).

NITS
- none
== exit 0 2026-09-01T07:20:10Z ==
