# Executor report — WO-8 round 2 (commit d00a7ae, author: Claude Fable 5, anthropic)

Claim: every outstanding finding from the WO-8 gate review chain is closed in
code under the owner rulings of 2026-08-30. One commit, 14 files, +782/−85.
Full disposition ledger: `roster/wo8-review-dispositions.md` (§ "Owner rulings
(2026-08-30) and the round-2 application").

## What changed, by file

- `verifier/verifier.js` — manifest pinned outside the audited commit
  (`manifestFromRef` via `git show` on an owner ref, default baseRef;
  provenance recorded on the manifest check); `opts.mutations` wired into
  `runVerification` and the CLI (`--mutations`, `--manifest-ref`,
  `--manifest-path`); `confine()` realpath-based (junction/symlink escape
  refused); `runShell` env allowlist + credential redaction over output tails;
  leading-dash ref rejection + `--` after revs in `claimedChanges`;
  casting-record `served_model_mismatch` recomputed in `validateArtifact`.
- `verifier/checkout.js` — glob star-run collapse + compiled-regex cache
  (ReDoS ~7.9 s → <5 ms); SIGINT/SIGTERM/SIGHUP sweep-then-reraise; worktree
  prune at checkout creation; leading-dash commitish rejected.
- `router/router.js` — reviewPolicy computes mandatory first (inert can never
  relax it, and applies only at T0/T1); gated reviewer returns closes:false
  (typed GATED); required-but-uncastable Q0 blocks dispatch; Conductor AU-F
  reserve recasts to the Sol mirror at matched effort, disclosed with
  restrictions; dispatch normalizes risk onto the order and refuses
  unrecognizable tiers; dispatch mints integrity_nonce (result carries the
  minted order); order-canonical touches with flag union; touches enum linted
  against the trigger lists at load (refuses construction on drift); hasOwn on
  cast() rung lookup / normalizeBuckets / bucketsFor / ALIAS_PINS; one risk
  oracle (normalizeRisk) at every risk read; reviewer() requires bucket_state.
- `registry/schemas/order.schema.json` — typed `touches` enum (union of
  q0Triggers.touchAreas ∪ securityTriggerList).
- `registry/schemas/verdict-audit.schema.json` — conditional gates: PASS
  requires refutation_duty_present:true; gate-class PASS requires
  cross_family:true and falsification SURVIVED.
- `registry/schemas/casting-record.schema.json` — mismatch detector documented
  as computed (enforced in the Verifier's validation).
- `registry/load.js` — enum comparison in registry order (byte-identical as
  claimed); duplicate alias ids refused.
- `plans/.../wo7b/score.js` — G3 enforces the full pre-registered text: P95 ≤ 1
  AND every caught misroute at hop-1 ACCEPT AND zero escalations.
- `roster/lint.js` — non-role docs exempted (the dispositions log broke the
  role-file contract lint).
- `router/README.md` — dispatch risk/nonce ownership, order-canonical touches,
  resolveSeat buried-gate shape.
- `tests/` — 27 new checks across the three suites covering all of the above
  (router 129, verifier 89, registry 31).

## Verification actually run (all green at d00a7ae)

    node registry/load.js                       # registry OK, 6 schemas in sync
    node router/router.js                       # router OK, 23 roles, 58 rungs
    node tests/registry.test.js                 # 31 passed, 0 failed
    node tests/verifier.test.js                 # 89 passed, 0 failed
    node tests/router.test.js                   # 129 passed, 0 failed
    node tests/frontmatter-lint.test.js         # 37 passed
    node tests/review-lane.test.js              # 114 passed
    node tests/scan-lane.test.js                # 41 passed
    node tests/exec-lane.test.js                # 79 passed
    node tests/mcp-lane.test.js                 # 68 passed
    node plans/.../wo7b/score.js                # ALL PRE-REGISTERED GATES PASS
    node roster/lint.js                         # 4 role files OK
    node install.js --lint && node install.js --lint roster   # OK

## Deliberate non-fixes (owner-ruled scope bounds)

- Citation/invariant commands stay free-form shell strings behind the minimal
  env (ruling 1a residual, documented).
- Diff-derived touches cross-check: registered follow-on, not built.
- Item 11 ("21 live discriminators" prose): string absent from the tree —
  already removed in round 1; loader prints the correct 22.
