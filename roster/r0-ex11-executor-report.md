# Executor report — WO-8 round 5f (commit e04005b, author: Claude Fable 5, anthropic)

Claim: the R0-EX10 MAJOR is fixed by removing the reviewed compound outright,
and the residual strand shape is proven self-healing. The pinned range
`2c24df7..e04005b` is two commits: `3900142` (records, markdown only) and
`e04005b` (4 files, +95/−7).

## The fix

- **Pre-add records are a hard prerequisite**: if the linked-worktree
  porcelain list cannot be read, `createCheckout` refuses BEFORE running
  `worktree add` — nothing is registered, the empty mkdtemp parent is
  removed, and a typed error is returned. The reviewed compound (pre-add
  failure + alias add + alias vanish) can no longer occur because the add
  never happens.
- **Post-add list failures are retried** (up to four reads total) before the
  fail-closed refusal path runs.
- **The residual strand is self-healing, regression-pinned**: a registration
  created through an alias, alias removed, never entering ACTIVE — the exact
  worst-case strand — is reclaimed by the standing sweep at the next
  `createCheckout`: directory gone from the canonical target AND the
  registration gone from porcelain. (`tests/verifier.test.js`, the R0-EX10
  self-healing check.)

## Verification actually run (all green at e04005b)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 101 · router 135 · frontmatter 37 ·
    review-lane 116 · scan 41 · exec 79 · mcp 68
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
