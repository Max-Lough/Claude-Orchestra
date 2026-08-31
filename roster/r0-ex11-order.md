# R0-EX11 — cross-vendor delta re-review of the WO-8 round-5f fix

- **Class:** R0 (computed reviewer, OpenAI lane — GPT-5.6 Sol · high via Codex CLI)
- **Policy:** mandatory (gate-class: a clean verdict clears WO-5/WO-6 out of REVISE)
- **Author family under review:** anthropic (Claude Fable 5); co-authors: none
- **Pinned range:** `2c24df7` (base — the round-5e commit R0-EX10 already audited) →
  `e04005b` (head). The range contains EXACTLY TWO commits:
  - `3900142` — the R0-EX10 order + executor report (roster/*.md records, no code)
  - `e04005b` — the round-5f fix (4 files, +95/−7: `verifier/checkout.js` pre-add
    prerequisite + post-add retry; `tests/verifier.test.js` self-healing
    regression; the R0-EX10 verdict record and dispositions update)
- **Prior verdict being answered:** R0-EX11 answers R0-EX10 (REVISE, verbatim at
  `roster/r0-ex10-verdict.md` in this head): one MAJOR — a failed pre-add
  porcelain snapshot discarded git's spelling, so the alias-vanish cleanup
  stranded the canonical registration.

## Goal

Delta review of one fix. Duties:

1. **Closure audit of the R0-EX10 MAJOR.** Your reviewed compound (pre-add
   list fails once + alias add + alias vanish) no longer exists: an
   unreadable pre-add snapshot now refuses BEFORE `worktree add` runs —
   nothing is registered, only the empty mkdtemp parent is removed. Probe
   that refusal (nothing registered, parent gone, typed error) and that a
   healthy pre-add read proceeds exactly as in round 5e.
2. **Rule on the declared residual bound** (see scope bounds): the only
   remaining strand shape requires the POST-add list to fail four
   consecutive reads AND the alias to vanish in the same window; the
   resulting strand is a `<prefix>/checkout`-shaped unowned leftover whose
   reclamation by the standing sweep is regression-pinned
   (directory and registration both gone at the next `createCheckout`).
   Verify the self-healing regression is real — a strand you construct the
   same way must be reclaimed — and flag the bound ONLY if you find a strand
   shape the standing sweep provably cannot reclaim.
3. **Fresh pass over the round-5f diff** with the usual severity bar.

## Acceptance criteria

- The MAJOR verified CLOSED with your probes; prior behaviors not regressed;
  any new defect reported with severity and a concrete scenario.
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

- **Declared residual bound (owner-documented)**: after the pre-add
  prerequisite and the post-add retry, a strand requires a multi-failure
  window (four consecutive post-add list failures + alias vanishing) and is
  then transient by construction — an unowned `<prefix>/checkout` leftover
  the standing sweep reclaims at the next checkout on that repo. This is the
  accepted recovery model, matching the reference lane's; do not re-report
  the bound itself, only a strand the sweep provably cannot reclaim.
- Registered follow-ons (their own lanes): the reference runner's
  single-`--force` sweep vs locked worktrees; the verification-time
  diff-derived `touches` cross-check.
- Ruling 1a residual: artifact-sourced citation/invariant commands stay
  free-form shell strings behind the minimal env.
