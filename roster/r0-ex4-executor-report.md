# Executor report — WO-8 round 3 (commit 7e90c67, author: Claude Fable 5, anthropic)

Claim: all five R0-EX3 findings are fixed. Each was reproduced locally with the
reviewer's own probe BEFORE fixing, and each fix was re-probed after. One
commit, 9 files, +271/−51.

## Per finding

1. **Reserve gate examined the degraded casting** — `cast()` results now carry
   `requested: { model, rung }` (the rung selected before degradation);
   `dispatch()` and `resolveSeat()` run a new `reserveGate()` against the
   REQUESTED model first, then `preDispatchGate` against the served casting
   (Amber arming stays a served-casting check). Probes after fix:
   A1 @ `AU-fable {Amber, belowReserve}` → GATED (`AU-F reserve (P15)`);
   I0 @ `AU-opus {Amber, belowReserve, confirmed}` → GATED (`AU-O reserve`);
   O0 @ same → ok on Sol mirror with `disclosed:true` + restrictions;
   O0 @ plain Amber (degradation path) → also disclosed + restrictions now.
2. **Separated-star ReDoS** — the regex compiler is deleted. Patterns
   token-compile (cached) to literals / `star` / `globstar` and match via a
   linear-pass DP, O(pattern × path) by construction. Reviewer's probe
   (`("**a").repeat(10)+"**b"` vs 32 chars): 5,413 ms before → 0 ms after.
   Semantics regression-tested (11 cases incl. `**/`, `*.log`, `a*b`,
   slash-boundedness of `*`).
3. **Tail-then-redact leak** — order swapped: `tail(redact(text))`. End-to-end
   regression through `runManifest`: a token followed by 1,990 filler chars
   (straddling the cutoff) leaves no reconstructible fragment in the tail.
4. **Windows SIGTERM** — honest per-platform handling: win32 installs
   SIGINT/SIGBREAK/SIGHUP (the trappable set), POSIX keeps SIGTERM; the
   TerminateProcess limitation is documented in-code; the startup
   `git worktree prune` in `createCheckout` is the named recovery for
   untrappable kills. No claim of trapping the untrappable remains.
5. **NUL bytes in router.js** — the touches-enum join separators were literal
   U+0000; replaced with `,`. A no-control-bytes regression check is pinned
   in the router suite; `rg` line-tools see the file as text again.

## Also in this diff

- `roster/lint.js`: record documents exempted by prefix (`woN-`/`rN-exN-`)
  instead of a growing name list (this order file itself relies on it).
- `tests/review-lane.test.js` case15: the helper-repair search is isolated
  from the real machine (HOME/USERPROFILE/CODEX_HOME pinned to the fixture
  root) — a genuine Codex install carrying the helpers was silently
  repairing the "missing" fixture. This answers your UNVERIFIED row: the 5
  environment-dependent failures were this leak, now closed; the suite is
  114/114 with a real install present.
- `roster/r0-ex3-verdict.md`: your R0-EX3 verdict recorded verbatim;
  dispositions log updated with the round-3 dispositions.

## Verification actually run (all green at 7e90c67)

    node registry/load.js · node router/router.js
    tests: registry 31 · verifier 92 · router 134 · frontmatter 37 ·
    review-lane 114 · scan 41 · exec 79 · mcp 68
    wo7b score: ALL PRE-REGISTERED GATES PASS
    roster/lint.js OK · install.js --lint (both) OK
