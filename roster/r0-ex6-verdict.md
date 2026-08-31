# R0-EX6 verdict — cross-vendor delta re-review of e7a5e31..ceeaabc

Recorded verbatim from the review runner, 2026-08-30. Disposition: the R0-EX5
CRITICAL confirmed CLOSED; one MAJOR — the live-set lexical compare — which
CI (macOS/Windows) had caught minutes earlier and was already fixed at
09a824e with the same junction-shaped reproducer pinned before this verdict
landed (see wo8-review-dispositions.md).

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (env), attempts: up to 2, checkout: pinned worktree @ ceeaabc6872e)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5902ms
PREFLIGHT: pinned review: checked out ceeaabc6872e into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-2UUQdi\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] verifier/checkout.js:281 — ACTIVE checkout matching is lexical rather than real-path-aware, so the sweep can delete a live in-process checkout — given `tmpRoot` traverses a junction or symlink, Git registers the checkout under the canonical target while ACTIVE retains the alias path; creating a second checkout then removes the first live checkout instead of exempting it.

CLAIMS CHECKED
- "the R0-EX5 CRITICAL is fixed" → CONFIRMED (independent CI-shape and prefix-substring-ancestor probes preserved the repositories, untracked work, sibling file, and registration)
- "a genuine extant leftover is still removed AND deregistered while the live checkout survives" → CONFIRMED (independent ordinary-temp-path probe verified removal, deregistration, and two surviving ACTIVE checkouts)
- "live in-process checkouts (ACTIVE set) remain exempt" → REFUTED (junction-backed `tmpRoot` probe showed Git canonicalize the registered path and the next sweep delete the still-ACTIVE checkout)
- "the pinned range contains exactly 3d545b9 and ceeaabc; ceeaabc changes 4 files, +107/-9, with code changes only in checkout.js and verifier.test.js" → CONFIRMED (`git log`, `git show --stat`, and pinned diff)
- "all declared and supplemental verification is green" → CONFIRMED (declared commands passed; test counts 31/96/135/37/114/41/79/68 passed after removing inherited outer-runner overrides; score, roster lint, frontmatter lint, and diff check passed)

NITS
- none
