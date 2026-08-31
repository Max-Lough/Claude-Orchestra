# R0-EX4 — cross-vendor gate re-review of the WO-8 round-3 fixes

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict here clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `d00a7aedd28ad2cc17260b2aaec921c65dcdec5c` (base — the round-2
  commit your R0-EX3 review already audited) → `7e90c67` (head, the single round-3
  commit; resolve the full SHA with `git rev-parse HEAD` in the checkout)
- **Prior verdict being answered:** R0-EX3 (REVISE, verdict recorded verbatim at
  `roster/r0-ex3-verdict.md` in this head). R0-EX3 confirmed every round-1/2
  closure; its five findings — and only code answering them — are this diff.

## Goal

This is a DELTA review: the round-2 substance was already confirmed by R0-EX3;
do not re-review it. Two duties:

1. **Closure audit of the five R0-EX3 findings.** For each, verify the fix with
   your own probe, not the committed tests alone:
   - Reserve gate vs degradation (`router.js`): a Fable/Opus primary at
     Amber+belowReserve must GATE (`reserveGate` on the REQUESTED rung); the
     Conductor must take the disclosed Sol-mirror path with restrictions
     attached on EVERY mirror-served turn, Amber path included.
   - Glob matcher (`checkout.js`): now a token-compiled DP, no regex. Probe
     separated star runs (your `("**a").repeat(10)+"**b"` reproducer) and
     confirm both speed and unchanged matching semantics.
   - Redaction order (`verifier.js` runShell): redact before tail truncation.
     Probe a credential straddling the 2000-char cutoff.
   - Windows signals (`checkout.js`): SIGTERM is untrappable on Windows —
     verify the claim is now honest (trappable set installed per-platform,
     limitation documented, startup `worktree prune` named as recovery), not
     that the untrappable became trappable.
   - NUL bytes in `router.js`: gone; file greps as text.
2. **Fresh pass over the round-3 diff itself** — the new `reserveGate`, the
   `requested` field on cast results, the DP matcher, and the review-lane
   test isolation (case15 HOME/USERPROFILE pinning) are new code; hunt for
   defects they introduce with the same severity bar.

## Acceptance criteria

- Each of the five findings: verified CLOSED with your probe, or refuted with
  a concrete scenario.
- Any new defect in the round-3 diff reported with severity and scenario.
- An explicit REVISE or APPROVE verdict for the gate-class tranche.

## Declared verification (run in the pinned checkout)

    node registry/load.js
    node router/router.js
    node tests/registry.test.js
    node tests/verifier.test.js
    node tests/router.test.js
    node plans/cross-compare/agent-role-architecture/wo7b/score.js
    node roster/lint.js

## Known, deliberate scope bounds (unchanged from R0-EX3; flag only if code contradicts them)

- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
- Diff-derived `touches` cross-check: registered follow-on, not built.
- Windows SIGTERM: untrappable by any userland handler; honesty, not magic,
  is the acceptance bar.
