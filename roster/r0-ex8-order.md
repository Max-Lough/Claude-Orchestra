# R0-EX8 — cross-vendor delta re-review of the WO-8 round-5c fixes

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `09a824e` (base — the round-5b commit R0-EX7 already audited) →
  `3a9cc73` (head). The range contains EXACTLY TWO commits:
  - `4e509b5` — the R0-EX6 verdict record + R0-EX7 order records (roster/*.md, no code)
  - `3a9cc73` — the round-5c fixes (5 files, +106/−4: `verifier/checkout.js`
    creation-time identity; regression tests in `tests/verifier.test.js`; a
    17-line timing guard in `tests/review-lane.test.js`; the R0-EX7 verdict
    record and dispositions update)
- **Prior verdict being answered:** R0-EX7 (REVISE, verbatim at
  `roster/r0-ex7-verdict.md` in this head): the stable-alias case CLOSED; one
  MAJOR — alias removal strips a live checkout's identity under sweep-time
  re-resolution. It also refuted the prior report's "all green" header (the
  review-lane suite was 113/114 under concurrent load; the flake is now
  root-caused — see below).

## Goal

Delta review of two small fixes. Duties:

1. **Closure audit of the R0-EX7 MAJOR.** A checkout's canonical identity is
   now captured AT CREATION (`entry.realDir`, resolved while every path
   component is guaranteed resolvable); the sweep's live set compares that
   and never re-resolves. Probe with your own reproducer: create through an
   alias `tmpRoot`, remove ONLY the alias, trigger a sweep — the canonical
   checkout must survive. Verify the stable-alias, CI-shape, prefix-ancestor,
   and genuine-leftover behaviors all still hold.
2. **Audit the review-lane flake fix** (test-only): root cause was git
   holding a new worktree LOCKED for the whole checkout while the entry is
   already list-visible; a kill in that window freezes it locked forever, and
   a single `worktree remove --force` cannot remove a locked worktree. The
   SIGTERM branch of case4 now waits out the registration window exactly as
   the SIGKILL branch always did. Check the guard is sound (not a sleep
   papering over a live product defect IN THIS TRANCHE — note the runner
   itself is out of scope, and its single-`--force` sweep limitation is
   registered as a follow-on below).
3. **Fresh pass over the round-5c diff** with the usual severity bar.

## Acceptance criteria

- The MAJOR verified CLOSED with your probe; prior sweep behaviors not
  regressed; any new defect reported with severity and scenario.
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

- **Registered follow-on (new, from the flake diagnosis):** the reference
  review runner (`packs/codex/hooks/orchestra-review.js`) sweeps with a
  single `worktree remove --force`, which git refuses on a LOCKED worktree
  (`remove -f -f` is required) — a kill mid-registration therefore leaves an
  unreclaimable entry there. That runner is OUTSIDE this tranche (it is the
  reference lane, not WO-5's substrate); the item is registered for its own
  lane, not fixed here.
- Sweep residuals as previously documented (mkdtemp prefix as namespace
  claim; cross-process dispatcher-serialization trade).
- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
- Diff-derived `touches` cross-check: registered follow-on, not built.
