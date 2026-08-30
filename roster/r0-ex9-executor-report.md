# Executor report — WO-8 round 5d (commit 5fb5142, author: Claude Fable 5, anthropic)

Claim: both R0-EX8 MAJORs and the records MINOR are fixed. The pinned range
`3a9cc73..5fb5142` is two commits: `e5d3d9b` (records, markdown only) and
`5fb5142` (5 files, +128/−16).

## Per finding

1. **Fail-open lexical identity (MAJOR)** — `createCheckout` now resolves
   the canonical path itself (`fs.realpathSync[.native]`) immediately after
   `worktree add`; on failure it removes its own registration, prunes,
   deletes the parent best-effort, and returns a typed error — no checkout,
   no stored identity, nothing for a later sweep to mistrust. `normPath`'s
   lexical fallback now serves only already-gone swept paths (where deletion
   is a no-op). Regression: with `fs.realpathSync` poisoned to throw,
   `createCheckout` refuses with "canonical identity" in the error and the
   porcelain worktree list is byte-identical before/after (no stray
   registration).
2. **Duration-based lock guard (MAJOR)** — both kill branches (SIGTERM and
   SIGKILL) now await `waitWorktreesUnlocked(repo, 30000)`: poll
   `git worktree list --porcelain` until no linked (non-main) worktree block
   carries a `locked` line, bounded, and ASSERTED as its own check — so a
   still-locked slow checkout fails the guard check loudly instead of being
   killed into an unreclaimable state. The fixed 250 ms sleeps are gone from
   both branches.
3. **Records MINOR** — the dispositions round-5c section now names run
   33333118636 (PR head after `4e509b5`) as the 9/9-green run and records
   the superseded `09a824e` run's true outcome (4 pass / 4 cancelled / 1
   Windows review-lane failure — the same lock race, firing in CI).

## Verification actually run (all green at 5fb5142)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 99 · router 135 · frontmatter 37 ·
    review-lane 116 (run twice, both green) · scan 41 · exec 79 · mcp 68
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
