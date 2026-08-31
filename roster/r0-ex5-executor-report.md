# Executor report — WO-8 round 4 (commit e7a5e31, author: Claude Fable 5, anthropic)

Claim: all four R0-EX4 findings are fixed; each reproduced (or, for the
record-precision item, acknowledged) before fixing. The pinned range
`7e90c67..e7a5e31` is two commits: `8ded8ad` (R0-EX4 order records, markdown
only) and `e7a5e31` (code fixes + verdict record; 6 files, +167/−11).

## Per finding

1. **Comma-join collision (MAJOR)** — `router.js` touches lint now compares
   sorted arrays element-wise (length + per-index `!==`); no join exists to
   collide. Regression: a tampered schema enum carrying `"auth,authz"` as a
   single entry (byte-identical under any comma join) refuses construction
   with `touches enum diverges`.
2. **Line-terminator drift (MINOR)** — `globMatch` gives `globstar` the
   retired regex's exact class: any char except `\n`, `\r`, `U+2028`,
   `U+2029` (still crosses `/`); `star` excludes only `/` (so it still
   matches `\n`, as `[^/]*` did). Six-case regression pinned, including
   `matchesAny('\n', ['**']) === false` and `matchesAny('a\nb', ['a*b'])
   === true`.
3. **Extant-leftover recovery (MINOR)** — new `sweepAbandoned(repoDir)` runs
   at every `createCheckout`: lists registered worktrees, removes+deregisters
   any under the module's own `orchestra-verifier-` tmp prefix not owned by a
   live in-process checkout (the ACTIVE set — head+base+mutation checkouts
   legitimately coexist), then prunes. Regression: a simulated leftover (a
   real registered worktree in an `orchestra-verifier-*` parent, directory
   intact) is reclaimed — directory gone AND deregistered — while the live
   checkout created in the same call survives.
4. **Range precision (MINOR)** — this order enumerates both commits in its
   pinned range; the practice is recorded in the dispositions log as the
   standing convention for future orders.

## Verification actually run (all green at e7a5e31)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 94 · router 135 · frontmatter 37 ·
    review-lane 114 · scan 41 · exec 79 · mcp 68
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
