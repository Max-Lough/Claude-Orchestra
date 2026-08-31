# R0-EX7 — cross-vendor delta re-review of the WO-8 round-5b fix

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `ceeaabc` (base — the round-5 commit R0-EX6 already audited) →
  `09a824e` (head). The range contains EXACTLY TWO commits:
  - `5758a2d` — the R0-EX6 order + executor report (two roster/*.md records, no code)
  - `09a824e` — the round-5b fix (2 files, +35/−1: `verifier/checkout.js` normPath
    and one regression test in `tests/verifier.test.js`)
- **Prior verdict being answered:** R0-EX6 (REVISE, verbatim at
  `roster/r0-ex6-verdict.md` in this head): the R0-EX5 CRITICAL CLOSED; one
  MAJOR — the sweep's ACTIVE-set exemption compared lexical paths while git
  registers canonical ones, so a junction/symlink/8.3-aliased tmp root let the
  sweep delete a still-live checkout. PR #28 CI (macOS/Windows) caught the same
  defect independently; this fix landed before your R0-EX6 verdict arrived.

## Goal

Delta review of one small fix. Two duties:

1. **Closure audit of the R0-EX6 MAJOR.** `normPath` now resolves real paths
   (`fs.realpathSync.native`, lexical fallback only for paths no longer on
   disk), so the live-set compare and the swept-path compare meet on canonical
   ground. Probe it yourself: your junction-backed `tmpRoot` reproducer must
   leave the first (still-ACTIVE) checkout alive when a second checkout's
   sweep runs; the genuine-leftover reclaim and both R0-EX5 preservation
   shapes must still hold.
2. **Fresh pass over the round-5b diff** — the realpath call itself (its
   failure fallback, and whether resolving through it can ever misclassify a
   NON-owned path as ours or vice versa).

## Acceptance criteria

- The MAJOR verified CLOSED with your probe, or refuted with a concrete
  scenario; prior sweep behaviors verified not regressed.
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

- Sweep residuals as documented in the dispositions log: the mkdtemp prefix
  is the namespace claim; cross-process races are the dispatcher-serialization
  trade.
- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
- Diff-derived `touches` cross-check: registered follow-on, not built.
