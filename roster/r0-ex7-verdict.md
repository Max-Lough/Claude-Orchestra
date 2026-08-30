# R0-EX7 verdict — cross-vendor delta re-review of ceeaabc..09a824e

Recorded verbatim from the review runner, 2026-08-30. Disposition: the
stable-alias case confirmed fixed; one MAJOR — alias REMOVAL strips a live
checkout's identity under sweep-time re-resolution — fixed in round 5c by
capturing the canonical identity at creation (entry.realDir); see
wo8-review-dispositions.md.

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (env), attempts: up to 2, checkout: pinned worktree @ 09a824e1f153)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: reclaimed 1 abandoned review worktree(s) from a prior run
PREFLIGHT: auth/exec probe: ok in 6392ms
PREFLIGHT: pinned review: checked out 09a824e1f153 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-3maUIK\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] verifier/checkout.js:259 — the lexical fallback loses an ACTIVE checkout’s canonical identity when its alias disappears — given a checkout created through a symlink/junction `tmpRoot`, removing only that alias leaves the canonical checkout alive, but the next `createCheckout` compares the broken lexical ACTIVE path with Git’s still-resolvable canonical path and deletes the live checkout; the probe observed `before=true` and `after=false` instead of preserving it

CLAIMS CHECKED
- "the R0-EX6 MAJOR is fixed" → REFUTED (the stable-alias case passes, but the alias-removal probe still caused the sweep to delete a live checkout)
- "a path no longer on disk falls back to lexical, which only affects already-gone entries where deletion is a no-op" → REFUTED (only the alias was gone; its canonical target existed and was deleted)
- "the junction-backed tmpRoot reproducer leaves the ACTIVE checkout alive, while genuine leftovers are reclaimed and both preservation shapes hold" → CONFIRMED (`node tests/verifier.test.js`: 97 passed, including all four relevant checks)
- "the pinned range contains exactly two commits and the fix is 2 files, +35/−1" → CONFIRMED (`git log`, `git diff --numstat`, and `git show --numstat`)
- "Verification actually run (all green at 09a824e)" → REFUTED (the report itself records review-lane 113/114, and the independent rerun reproduced that reclaim-test failure; all seven work-order commands passed)

NITS
- none
