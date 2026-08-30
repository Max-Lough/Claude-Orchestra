# R0-EX6 — cross-vendor delta re-review of the WO-8 round-5 fix

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `e7a5e31` (base — the round-4 commit R0-EX5 already audited) →
  `ceeaabc` (head). The range contains EXACTLY TWO commits:
  - `3d545b9` — the R0-EX5 order + executor report (two roster/*.md records, no code)
  - `ceeaabc` — the round-5 fix + the R0-EX5 verdict record (4 files, +107/−9;
    code changes only in `verifier/checkout.js` and `tests/verifier.test.js`)
- **Prior verdict being answered:** R0-EX5 (REVISE, verbatim at
  `roster/r0-ex5-verdict.md` in this head): all four R0-EX4 closures CONFIRMED;
  one CRITICAL — `sweepAbandoned`'s substring prefix guard swept legitimate
  worktrees and `rm -rf`'d their parent (CI on macOS/Windows caught the same
  bug against the fixture repo, where the deleted parent was the OS temp root).

## Goal

Delta review of one fix. Two duties:

1. **Closure audit of the R0-EX5 CRITICAL.** The guard is now structural:
   a leftover is exactly `<tmp>/orchestra-verifier-XXXX/checkout` — worktree
   basename `checkout`, parent whose OWN BASENAME starts with the prefix, and
   only that parent is removed; the main worktree (first porcelain entry) is
   skipped outright. Probe it yourself, at minimum:
   - your own reproducer (legit worktree under a prefix-substring ancestor,
     with untracked contents and an unrelated sibling file);
   - the CI shape (a repository whose own directory name contains the prefix,
     sitting directly in tmp);
   - that a genuine leftover (`<tmp>/orchestra-verifier-XXXX/checkout`,
     directory extant, unowned) is still reclaimed — the R0-EX4 fix must
     survive the R0-EX5 fix;
   - that live ACTIVE checkouts still survive a concurrent sweep.
2. **Fresh pass over the round-5 diff** — the structural guard itself and the
   two new regression tests. Hunt for any remaining way `sweepAbandoned` can
   delete something it does not own, or fail to reclaim something it does.

## Acceptance criteria

- The CRITICAL verified CLOSED with your probes, or refuted with a concrete
  scenario; the prior reclaim behavior verified NOT regressed.
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

- Documented residual on the sweep: a user directory deliberately named
  `orchestra-verifier-*/checkout` and registered as a worktree would still be
  swept — the mkdtemp prefix is the namespace claim. Cross-process races
  remain the dispatcher-serialization trade.
- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
- Diff-derived `touches` cross-check: registered follow-on, not built.
