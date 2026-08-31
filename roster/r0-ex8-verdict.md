# R0-EX8 verdict — cross-vendor delta re-review of 09a824e..3a9cc73

Recorded verbatim from the review runner, 2026-08-30. Disposition: ordinary
alias-removal confirmed fixed; two MAJORs (fail-open lexical identity on
creation-time realpath failure; duration-based lock guard) and one records
MINOR — all fixed in round 5d (see wo8-review-dispositions.md).

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (env), attempts: up to 2, checkout: pinned worktree @ 3a9cc7347787)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5091ms
PREFLIGHT: pinned review: checked out 3a9cc7347787 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-ZxKv8V\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] verifier/checkout.js:362 — canonical identity capture silently degrades to the lexical alias when `realpath` fails — given the alias disappears during creation-time resolution, `createCheckout` succeeds with a lexical `realDir`; the next sweep deletes the live canonical checkout. A deterministic ENOENT race probe observed `before=true, after=false` instead of preserving it.
- [MAJOR] [BREACH] tests/review-lane.test.js:365 — the fixed 250 ms sleep does not verify that Git’s registration lock has cleared — given a slow checkout remains locked longer than 250 ms after list visibility, the test kills it mid-registration and single-force reclamation fails. A 15,000-file probe remained locked after the delay and `worktree remove --force` exited 128.
- [MINOR] [BREACH] roster/wo8-review-dispositions.md:300 — the committed “PR #28 CI went fully green (9/9 jobs) on 09a824e” assertion is false — GitHub [run 33333004245](https://github.com/Max-Lough/Claude-Orchestra/actions/runs/33333004245) recorded four successes, one Windows review-lane failure, and four cancellations instead of nine successes.

CLAIMS CHECKED
- "the pinned range contains exactly two commits; 3a9cc73 changes 5 files, +106/−4" → CONFIRMED (`git log`, `git show --stat`, and `git show --numstat`)
- "the R0-EX7 MAJOR is fixed" → REFUTED (ordinary post-return alias removal survived, but removing the alias during the fallback-capable creation-time resolution stored lexical identity and the next sweep deleted the canonical checkout)
- "both [alias regressions] pass, and the CI-shape, prefix-ancestor, and genuine-leftover behaviors are re-asserted" → CONFIRMED (independent post-return alias probe passed; `tests/verifier.test.js` passed all 98 checks)
- "git [holds] a new worktree LOCKED for the whole checkout while the entry is already list-visible" → CONFIRMED (timing probe observed the registered worktree marked `locked` while `worktree add` remained active)
- "the SIGTERM branch ... waits out the registration window" → REFUTED (the guard waits a duration, not the lock condition; the timing probe remained locked after 250 ms)
- "tests: registry 31 · verifier 98 · router 135 · frontmatter 37 · review-lane 114 · scan 41 · exec 79 · mcp 68" → CONFIRMED (independently rerun; review/exec suites reached the stated counts after clearing inherited outer-runner environment overrides)
- "wo7b score: ALL PRE-REGISTERED GATES PASS; roster/lint.js OK; install.js --lint (both) OK" → CONFIRMED (all commands exited 0)
- "PR #28 CI: 9/9 jobs green" → REFUTED (the workflow on `09a824e` failed/cancelled, while the workflow on `3a9cc73` had all nine jobs cancelled)

NITS
- none
