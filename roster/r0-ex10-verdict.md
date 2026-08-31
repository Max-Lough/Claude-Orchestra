# R0-EX10 verdict — cross-vendor delta re-review of 5fb5142..2c24df7

Recorded verbatim from the review runner, 2026-08-30. Disposition: the
git-records identity, ambiguity handling, and guard gating all CONFIRMED;
one MAJOR (pre-add snapshot failure discards git's spelling on the cleanup
path) — fixed in round 5f (pre-add refusal + post-add retry + regression-
pinned self-healing of the residual strand); see wo8-review-dispositions.md.

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (env), attempts: up to 2, checkout: pinned worktree @ 2c24df7342ed)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5347ms
PREFLIGHT: pinned review: checked out 2c24df7342ed into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-lKX8op\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] verifier/checkout.js:365 — a failed porcelain snapshot discards Git’s path and cleanup falls back to the caller’s alias — given the pre-add `worktree list` fails once, `worktree add` succeeds through a tmp-root alias, and that alias then vanishes, `created` becomes null and removal addresses the dead alias; a targeted probe left the canonical directory and one Git registration behind instead of cleaning both.

CLAIMS CHECKED
- "the pinned range contains exactly two commits; 2c24df7 changes 5 files, +139/−35" → CONFIRMED (`git log`, `git show --stat`, and `git diff --numstat`)
- "the R0-EX9 MAJOR and MINOR are fixed — the MAJOR structurally" → REFUTED (the one-shot snapshot-failure plus alias-removal probe reproduced the stranded canonical registration)
- "poisoned `fs.realpathSync` yields a working checkout, and prior sweep/teardown shapes remain green" → CONFIRMED (`tests/verifier.test.js`: 100/100; independent normal alias-removal probe survived a sweep and fully tore down)
- "an ambiguous concurrent add refuses fail-closed and cleans every candidate by Git’s spelling" → CONFIRMED (targeted two-candidate snapshot probe refused and left zero registrations/directories)
- "on lock-poll timeout the guard fails the suite, SIGKILLs the child, skips kill-dependent checks, and cannot pass vacuously" → CONFIRMED (control-flow inspection plus two clean-environment `tests/review-lane.test.js` runs: 116/116 each)
- "the declared and executor-reported verification is green" → CONFIRMED (all declared commands plus registry 31, verifier 100, router 135, frontmatter 37, review-lane 116 twice, scan 41, exec 79, MCP 68, score, roster lint, and both installer lint targets passed after clearing inherited runner overrides)

NITS
- none
