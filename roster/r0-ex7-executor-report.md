# Executor report — WO-8 round 5b (commit 09a824e, author: Claude Fable 5, anthropic)

Claim: the R0-EX6 MAJOR (live-set lexical compare) is fixed. The pinned range
`ceeaabc..09a824e` is two commits: `5758a2d` (R0-EX6 order records, markdown
only) and `09a824e` (the fix; 2 files, +35/−1).

## The finding and the fix

Git records RESOLVED worktree paths; a live checkout's ACTIVE handle may be
spelled through an alias — a junction/symlink `tmpRoot` (your reproducer),
macOS `/var`→`/private/var`, or a Windows 8.3 short tmpdir (`RUNNER~1`, the
PR #28 CI failure: the sweep deleted the live checkout mid-`runVerification`
and the invariant probes died on a vanished cwd; ubuntu and long-named local
users passed on accident). The lexical `normPath` compare missed, so the
ACTIVE exemption failed exactly where it mattered.

Fix: `normPath` resolves real paths — `fs.realpathSync.native` (plain
`realpathSync` fallback), then the existing resolve/slash/lowercase
normalization; a path no longer on disk falls back to lexical, which only
affects already-gone entries where deletion is a no-op. Both sides of every
sweep comparison (git's listed path, ACTIVE handles) now meet on canonical
ground.

## Regression pinned

An aliased-tmp-root reproducer that fails on every platform without the fix:
checkout #1 created through a junction (Windows) / dir symlink (POSIX)
`tmpRoot`, checkout #2 created normally so the sweep runs — checkout #1 must
survive with its directory intact. (Environments where link creation is
denied record an explicit skip.)

## Verification actually run (all green at 09a824e)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 97 · router 135 · frontmatter 37 ·
    scan 41 · exec 79 · mcp 68 — and review-lane 113/114 with one KNOWN
    timing-flake under concurrent load ("and a later run reclaims it", a
    SIGTERM-orphan reclaim race in the TEST harness; it passed 114/114 three
    times earlier today on identical code, and a separate agent is
    confirming flake-vs-real in parallel — packs/codex/hooks code is
    untouched by this diff)
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
