# R0-EX9 — cross-vendor delta re-review of the WO-8 round-5d fixes

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `3a9cc73` (base — the round-5c commit R0-EX8 already audited) →
  `5fb5142` (head). The range contains EXACTLY TWO commits:
  - `e5d3d9b` — the R0-EX8 order + executor report (roster/*.md records, no code)
  - `5fb5142` — the round-5d fixes (5 files, +128/−16: `verifier/checkout.js`
    fail-closed identity; `tests/verifier.test.js` poisoned-realpath regression;
    `tests/review-lane.test.js` lock-condition polls in both kill branches; the
    R0-EX8 verdict record and dispositions update, including the CI-records
    correction)
- **Prior verdict being answered:** R0-EX9 answers R0-EX8 (REVISE, verbatim at
  `roster/r0-ex8-verdict.md` in this head): two MAJORs — fail-open lexical
  identity when creation-time realpath fails; a duration-based (not
  condition-based) lock guard — plus the records MINOR on the CI claim.

## Goal

Delta review of the round-5d fixes. Duties:

1. **Closure audit of the two R0-EX8 MAJORs**, with your own probes:
   - **Fail-closed identity**: `createCheckout` now resolves the canonical
     path itself; when resolution fails it returns an error, removes its own
     registration, and hands out nothing — no lexical identity can ever be
     stored for a live checkout. Your ENOENT-during-creation race must yield
     a refusal with no stray registration and no later mis-sweep. `normPath`'s
     lexical fallback remains only for already-gone swept paths.
   - **Lock-condition guard**: both kill branches in the review-lane suite now
     poll `git worktree list --porcelain` until no linked worktree carries
     `locked` (`waitWorktreesUnlocked`, bounded at 30 s, asserted as a check)
     before killing. Verify the condition is the right one and the poll can't
     pass while the checkout is still mid-registration.
2. **Verify the records correction** (dispositions round-5c section) against
   the actual GitHub runs.
3. **Fresh pass over the round-5d diff** with the usual severity bar.

## Acceptance criteria

- Both MAJORs verified CLOSED with your probes; prior sweep and reclaim
  behaviors not regressed; any new defect reported with severity and scenario.
- An explicit REVISE or APPROVE verdict for the gate-class tranche (WO-5/WO-6).

## Declared verification (run in the pinned checkout)

    node registry/load.js
    node router/router.js
    node tests/registry.test.js
    node tests/verifier.test.js
    node tests/router.test.js
    node plans/cross-compare/agent-role-architecture/wo7b/score.js
    node roster/lint.js

## Known, deliberate scope bounds (flag only if code contradicts them)

- A checkout refused for unresolvable identity may leave its canonical
  directory behind when only the alias vanished mid-creation; that remnant is
  an ordinary unowned leftover the next sweep reclaims — by design, not a gap.
- Registered follow-ons (their own lanes, not this tranche): the reference
  runner's single-`--force` sweep vs locked worktrees; the verification-time
  diff-derived `touches` cross-check.
- Sweep residuals as previously documented (mkdtemp prefix as namespace claim;
  cross-process dispatcher-serialization trade).
- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
