# R0-EX5 — cross-vendor delta re-review of the WO-8 round-4 fixes

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `7e90c67` (base — the round-3 commit R0-EX4 already audited) →
  `e7a5e31` (head). The range contains EXACTLY TWO commits (your R0-EX4 MINOR on
  range precision, applied):
  - `8ded8ad` — the R0-EX4 order + executor report (two roster/*.md records, no code)
  - `e7a5e31` — the round-4 code fixes + the R0-EX4 verdict record
- **Prior verdict being answered:** R0-EX4 (REVISE, verbatim at
  `roster/r0-ex4-verdict.md` in this head): all five R0-EX3 closures CONFIRMED;
  four new findings, whose fixes are this diff.

## Goal

Delta review only — rounds 2 and 3 are already confirmed by R0-EX3/R0-EX4. Two duties:

1. **Closure audit of the four R0-EX4 findings**, each with your own probe:
   - **Comma-join collision** (`router.js` touches lint): now element-wise
     (length + per-index equality on sorted arrays), no join. Your reproducer —
     a schema enum carrying `"auth,authz"` as one entry — must refuse construction.
   - **Line-terminator drift** (`checkout.js` DP matcher): `**` must not match
     `\n`, `\r`, U+2028, U+2029 (exactly the retired regex `.`); `*` excludes
     only `/` (and therefore still matches `\n`, as `[^/]*` did).
   - **Extant-leftover recovery** (`checkout.js` `sweepAbandoned`): a registered
     worktree under the module's `orchestra-verifier-` tmp prefix whose
     directory still exists must be removed AND deregistered at the next
     `createCheckout`, while checkouts live in the calling process (the ACTIVE
     set) survive.
   - **Range precision**: this order enumerates its two commits above — verify
     the enumeration against `git log --oneline 7e90c67..e7a5e31`.
2. **Fresh pass over the round-4 diff itself** — `sweepAbandoned` (a new
   deleter: scrutinize its prefix guard and ACTIVE exemption for anything it
   could wrongly remove or wrongly keep), the element-wise lint, and the
   LINE_TERMINATORS set.

## Acceptance criteria

- Each of the four findings: verified CLOSED with your probe, or refuted with a
  concrete scenario.
- Any new defect in this diff reported with severity and a concrete scenario.
- An explicit REVISE or APPROVE verdict for the gate-class tranche (WO-5/WO-6).

## Declared verification (run in the pinned checkout)

    node registry/load.js
    node router/router.js
    node tests/registry.test.js
    node tests/verifier.test.js
    node tests/router.test.js
    node plans/cross-compare/agent-role-architecture/wo7b/score.js
    node roster/lint.js

## Known, deliberate scope bounds (unchanged; flag only if code contradicts them)

- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
- Diff-derived `touches` cross-check: registered follow-on, not built.
- Windows SIGTERM stays untrappable; `sweepAbandoned` + the trappable signal
  set is the accepted recovery model.
- Cross-PROCESS concurrent verifier runs on one repo can race the sweep — the
  documented trade (runs on one repo are dispatcher-serialized), same as the
  reference review lane.
