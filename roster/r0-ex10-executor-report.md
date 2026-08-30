# Executor report — WO-8 round 5e (commit 2c24df7, author: Claude Fable 5, anthropic)

Claim: the R0-EX9 MAJOR and MINOR are fixed — the MAJOR structurally, by
removing the resolution step the last three findings raced. The pinned range
`5fb5142..2c24df7` is two commits: `7c8d6dd` (records, markdown only) and
`2c24df7` (5 files, +139/−35).

## The MAJOR: identity from git's records

The last three findings (R0-EX7/8/9) were all shapes of one problem: the
checkout's identity was derived by RESOLVING a path, and resolution can
disagree with git (aliases), fail (mid-creation removal), or leave cleanup
addressing the wrong spelling. Round 5e removes the derivation entirely:

- the linked-worktree porcelain list is snapshotted immediately before and
  after `worktree add`; the single new entry is git's own spelling of the
  checkout — stored as identity (`realDir`) AND used as the entry's working
  handle (`entry.dir`);
- `fs.realpath` is no longer on the identity path (normPath still
  canonicalizes both sides idempotently, and degrades identically on both
  sides if it ever fails — same string in, same string compared);
- creation-failure cleanup, the sweep, and teardown all address git's
  spelling, so no vanished alias can strand a registration;
- an ambiguous before/after diff (a concurrent add) refuses fail-closed,
  removing every candidate registration by git's spelling;
- teardown removes both parent spellings (alias-side mkdtemp parent and
  canonical parent), the latter behind a prefix belt.

Regressions pinned: poisoned `fs.realpathSync` yields a WORKING checkout
whose handle is git's spelling and whose sweep exemption holds; teardown by
git's spelling leaves neither registration nor directory; all prior sweep
shapes re-asserted in the same suite run.

## The MINOR: guard-timeout gating

On lock-poll timeout, the guard `check()` fails the suite, the child is put
down with SIGKILL, and the kill-dependent sub-checks are SKIPPED in both
branches — no path kills into the unreclaimable mid-registration state and
then asserts on its wreckage; no vacuous pass exists because the guard's own
failed check is recorded first.

## Verification actually run (all green at 2c24df7)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 100 · router 135 · frontmatter 37 ·
    review-lane 116 (run twice, both green) · scan 41 · exec 79 · mcp 68
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
