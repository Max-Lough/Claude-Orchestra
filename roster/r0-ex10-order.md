# R0-EX10 — cross-vendor delta re-review of the WO-8 round-5e fixes

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `5fb5142` (base — the round-5d commit R0-EX9 already audited) →
  `2c24df7` (head). The range contains EXACTLY TWO commits:
  - `7c8d6dd` — the R0-EX9 order + executor report (roster/*.md records, no code)
  - `2c24df7` — the round-5e fixes (5 files, +139/−35: `verifier/checkout.js`
    git-records identity; `tests/verifier.test.js` regressions;
    `tests/review-lane.test.js` guard-timeout gating; R0-EX9 verdict record and
    dispositions update)
- **Prior verdict being answered:** R0-EX10 answers R0-EX9 (REVISE, verbatim at
  `roster/r0-ex9-verdict.md` in this head): one MAJOR — the fail-closed cleanup
  addressed the vanished alias and stranded the canonical registration — and
  one MINOR — a timed-out lock guard still killed into the unreclaimable state.

## Goal

Delta review of the round-5e fixes. Duties:

1. **Closure audit of the R0-EX9 MAJOR.** Checkout identity now comes from
   git's own records: the linked-worktree porcelain list is snapshotted
   across the `worktree add`, the single new entry is BOTH the stored
   identity and the entry's working handle (`entry.dir`), `fs.realpath` is
   no longer on the identity path, creation/sweep/teardown all address git's
   spelling, an ambiguous records diff refuses fail-closed (cleaning every
   candidate by git's spelling), and teardown removes both parent spellings
   behind a prefix belt. Probe at minimum:
   - your alias-vanishes-mid-creation ENOENT race: whatever the outcome
     (working checkout or refusal), NO stray registration may remain and no
     live checkout may later be mis-swept;
   - alias removal after creation: the handle stays usable (it is git's
     spelling) and teardown fully cleans registration + directory;
   - all prior sweep shapes (CI fixture, prefix-ancestor, genuine leftover,
     stable-alias, post-creation alias removal) hold.
2. **Audit the guard-timeout gating**: on lock-poll timeout the guard check
   fails the suite, the child is SIGKILLed, and the kill-dependent sub-checks
   are skipped — verify no vacuous pass is possible and no path still kills
   into the unreclaimable state while asserting on its wreckage.
3. **Fresh pass over the round-5e diff** with the usual severity bar — in
   particular the before/after porcelain diff (concurrent-add ambiguity
   handling) and the dual-parent teardown.

## Acceptance criteria

- The MAJOR and MINOR verified CLOSED with your probes; all prior behaviors
  not regressed; any new defect reported with severity and scenario.
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

- The before/after porcelain diff assumes runs on one repo are
  dispatcher-serialized (the documented trade); a concurrent add produces a
  fail-closed refusal, not a misattribution.
- Registered follow-ons (their own lanes): the reference runner's
  single-`--force` sweep vs locked worktrees; the verification-time
  diff-derived `touches` cross-check.
- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
