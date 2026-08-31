# R0-EX9 verdict — cross-vendor delta re-review of 3a9cc73..5fb5142

Recorded verbatim from the review runner, 2026-08-30. Disposition: lock-poll
and records corrections CONFIRMED; one MAJOR (cleanup by vanished alias
strands the canonical registration) + one MINOR (timed-out guard still
kills) — both fixed in round 5e by deriving checkout identity from git's
own records (see wo8-review-dispositions.md).

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (env), attempts: up to 2, checkout: pinned worktree @ 5fb514259920)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5842ms
PREFLIGHT: pinned review: checked out 5fb514259920 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-8G0e5E\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] verifier/checkout.js:361 — failed identity cleanup addresses the vanished lexical alias and ignores `worktree remove` failure — given the alias disappears immediately before `realpath` throws ENOENT, `createCheckout` returns an error but Git retains the canonical worktree registration and directory instead of leaving no stray registration.
- [MINOR] [BREACH] tests/review-lane.test.js:383 — a lock-poll timeout does not prevent either kill — given registration remains locked beyond 30 seconds, `check()` records failure but returns normally, so lines 384/443 still kill the child into the explicitly unreclaimable state instead of leaving it running.

CLAIMS CHECKED
- "the pinned range contains exactly two commits; 5fb5142 changes 5 files, +128/−16" → CONFIRMED (`git log`, `git show --stat`, and `git show --numstat`)
- "both R0-EX8 MAJORs are fixed" → REFUTED (the alias-disappearance ENOENT probe leaves a canonical registration behind)
- "with `fs.realpathSync` merely poisoned, checkout creation refuses and porcelain is byte-identical" → CONFIRMED (`tests/verifier.test.js`: 99/99; this regression does not remove the alias and therefore misses the real cleanup failure)
- "both kill branches poll the actual lock condition, and the poll cannot pass mid-registration" → CONFIRMED (two 116/116 suite runs; a 5,000-file probe observed 136/136 visible in-progress samples locked, zero unlocked-incomplete samples)
- "a still-locked slow checkout fails the guard instead of being killed" → REFUTED (`check()` is non-throwing and both branches kill immediately afterward)
- "run 33333118636 was 9/9 green after 4e509b5; run 33333004245 on 09a824e was 4 passed / 4 cancelled / 1 Windows review-lane failure" → CONFIRMED ([green run](https://github.com/Max-Lough/Claude-Orchestra/actions/runs/33333118636), [superseded run](https://github.com/Max-Lough/Claude-Orchestra/actions/runs/33333004245), including failed-job logs)
- "the declared and executor-reported verification is green" → CONFIRMED (all declared commands plus registry 31, verifier 99, router 135, frontmatter 37, review-lane 116 twice, scan 41, exec 79, MCP 68, both installer lints, score, and roster lint passed with inherited outer-runner overrides cleared)

NITS
- none
