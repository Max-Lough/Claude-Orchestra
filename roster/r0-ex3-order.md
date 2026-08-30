# R0-EX3 — cross-vendor gate re-review of the WO-8 round-2 fixes

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: this review decides whether WO-5/WO-6 clear REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `fb07668bf9a4ac18f4ab6c0b3f1cf68d493a3eaa` (base) → `d00a7aedd28ad2cc17260b2aaec921c65dcdec5c` (head, the single round-2 commit)
- **Prior verdict being answered:** R0-EX2 (REVISE, pinned `69127bd..ecc88e3`) plus the
  R0-EX1 round-2 MINORs and the E7-EX1 architectural items. The full worklist and the
  owner rulings of 2026-08-30 are recorded in `roster/wo8-review-dispositions.md`
  (in this head commit) — read it first; it is the claim ledger this review audits.

## Goal

Re-review the round-2 diff and rule REVISE or APPROVE on the gate-class tranche.
Two duties, in order:

1. **Closure audit** — for each previously outstanding finding, verify the fix is
   real, complete, and not merely test-shaped. The eleven cross-vendor items
   (mutations wired into `runVerification`+CLI; gated reviewer must not close;
   inert cannot relax the mandatory set; uncastable required Q0 blocks dispatch;
   `touches` schema-reachable and load-linted; verdict-audit semantic gates;
   casting-record mismatch detector; Conductor AU-F recast to the Sol mirror;
   score.js G3 full gate text; load.js in-order enums + alias dedupe; stale
   discriminator prose), the WO-14 re-review MINORs (hasOwn family, one risk
   oracle, dispatch risk normalization, dispatcher-minted nonce, reviewer
   bucket_state required, README line), and the E7 items (manifest pinned outside
   the audited commit per ruling 1a; realpath confine; env allowlist + tail
   redaction; ref hardening; glob ReDoS; signal-safe teardown + worktree prune).
2. **Fresh pass over the new code** — the round-2 diff introduces new attack
   surface of its own (manifestFromRef, the recast branch in dispatch, the
   realpath walk in confine, the redaction patterns, signal handlers). Hunt for
   concrete failure scenarios in the NEW code with the same severity bar as the
   original gate review.

## Acceptance criteria

- Every previously outstanding finding is either verified CLOSED (with the
  evidence you checked) or called out as not-actually-fixed with a concrete
  failure scenario.
- Any new defect introduced by the round-2 diff is reported with severity and a
  concrete scenario.
- Verdict is REVISE or APPROVE for the gate-class tranche (WO-5/WO-6 substrate),
  stated explicitly.

## Declared verification (run it yourself in the pinned checkout)

    node registry/load.js
    node router/router.js
    node tests/registry.test.js
    node tests/verifier.test.js
    node tests/router.test.js
    node plans/cross-compare/agent-role-architecture/wo7b/score.js
    node roster/lint.js

## Known, deliberate scope bounds (do not re-litigate; flag only if the code
contradicts them)

- Ruling 1a chose manifest pinning, NOT an argv-array allowlist: artifact-sourced
  citation/invariant commands remain free-form shell strings behind a minimal
  env. This is a documented owner-accepted residual.
- The verification-time diff-derived `touches` cross-check is a REGISTERED
  FOLLOW-ON, deliberately not built this round.
- `dispatch()` now refuses unrecognizable risk tiers and re-mints
  `integrity_nonce` unconditionally — behavior changes ruled by the owner
  (rulings A and B), not regressions.
