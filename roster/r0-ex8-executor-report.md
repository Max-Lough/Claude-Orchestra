# Executor report — WO-8 round 5c (commit 3a9cc73, author: Claude Fable 5, anthropic)

Claim: the R0-EX7 MAJOR is fixed, and the review-lane flake it used against
the prior report's "all green" header is root-caused and guarded (test
only). The pinned range `09a824e..3a9cc73` is two commits: `4e509b5`
(records, markdown only) and `3a9cc73` (5 files, +106/−4).

## The R0-EX7 MAJOR and the fix

Your probe: create a checkout through a junction/symlink `tmpRoot`, remove
only the alias, trigger a sweep — sweep-time re-resolution of the ACTIVE
handle fell back to the lexical alias spelling, missed git's canonical
listed path, and deleted the live canonical checkout (`before=true,
after=false`).

Fix: `entry.realDir` — the canonical path resolved AT CREATION, while every
component is guaranteed to exist — is stored on the ACTIVE entry, and
`sweepAbandoned`'s live set compares that stored identity. No sweep-time
re-resolution of live handles remains. Your exact probe shape is pinned as a
regression next to the stable-alias one; both pass, and the CI-shape,
prefix-ancestor, and genuine-leftover behaviors are re-asserted in the same
suite run.

## The review-lane flake (agent-diagnosed, test-only change)

Root cause (verified experimentally, not guessed): `git worktree add` holds
the new worktree LOCKED for the entire checkout, and the entry becomes
list-visible BEFORE checkout completes. The test's polling loop only waits
for list-visibility, so a kill under load could land inside that window —
freezing a permanently locked worktree that `worktree remove --force`
(single force) flatly refuses to remove; the later run's "reclaimed 1"
header counts what the sweep FOUND, not what it deleted. The SIGKILL branch
of the same test always guarded this window with a 250 ms settle; the
SIGTERM branch now does the identical thing, with the mechanism documented
in-code. Flake rate: 3 baseline runs green, the failure reproduced only
under concurrent review load; 2 post-fix runs green.

Registered follow-on (out of tranche): the reference runner's own sweep has
the same single-`--force` limitation against locked worktrees.

## Verification actually run (all green at 3a9cc73)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 98 · router 135 · frontmatter 37 ·
    review-lane 114 · scan 41 · exec 79 · mcp 68
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
    PR #28 CI: 9/9 jobs green (macOS/Windows/Ubuntu × Node 20/22/24)
