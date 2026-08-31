# Executor report — WO-8 round 5 (commit ceeaabc, author: Claude Fable 5, anthropic)

Claim: the R0-EX5 CRITICAL is fixed, and the R0-EX4 reclaim behavior it sat
on is not regressed. The pinned range `e7a5e31..ceeaabc` is two commits:
`3d545b9` (R0-EX5 order records, markdown only) and `ceeaabc` (the fix +
verdict record; code touched only in `verifier/checkout.js` and
`tests/verifier.test.js`).

## The finding and the fix

`sweepAbandoned` identified leftovers by substring containment of
`orchestra-verifier-` in the full worktree path, then `rm -rf`'d
`path.dirname(worktree)`. Two independent detections: CI (macOS/Windows) hit
it via the test fixture repo — whose own mkdtemp name contains the substring
— making the deleted parent the OS TEMP ROOT; your R0-EX5 probe hit it via a
legitimate worktree under a prefix-substring ancestor. (Ubuntu and the local
run had survived on deletion-order luck; the CI failure and your finding
landed within minutes of each other.)

Fix (structural identification, no substring anywhere):

- a candidate must have basename exactly `checkout`;
- its parent's OWN BASENAME must start with `orchestra-verifier-` (the
  mkdtemp prefix this module itself creates);
- only that prefix-named parent is ever removed — never `dirname` of an
  arbitrary path;
- the main worktree (first `worktree list --porcelain` entry) is skipped
  outright as a second belt;
- live in-process checkouts (ACTIVE set) remain exempt, unchanged.

## Regressions pinned (both reproducer shapes)

- CI shape: after a sweep, a repository whose own tmp path contains the
  prefix substring is intact (`lib.js` present, `rev-parse HEAD` works).
- R0-EX5 shape: a legitimate worktree at
  `<tmp>/user-orchestra-verifier-project-XXXX/legitimate-worktree` with an
  untracked file and an unrelated sibling file survives the sweep fully —
  registration included.
- R0-EX4 behavior retained: a genuine extant leftover
  (`<tmp>/orchestra-verifier-XXXX/checkout`) is still removed AND
  deregistered while the live checkout survives.

## Verification actually run (all green at ceeaabc)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 96 · router 135 · frontmatter 37 ·
    review-lane 114 · scan 41 · exec 79 · mcp 68
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
