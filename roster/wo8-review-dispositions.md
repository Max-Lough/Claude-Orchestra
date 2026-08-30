# WO-8 assurance band — exercise records and review dispositions

The four assurance seats were staffed and each run on a real order. Three of
the four exercises surfaced genuine defects in the already-committed
substrate tranche (WO-4/5/6/14) — the seats working as designed. This file
records the exercises and the disposition of every finding.

**Status: the gate-class tranche is under REVISE. Do not treat WO-5/WO-6 as
having passed their mandatory review yet — outstanding findings below remain
open.** A first round of fixes is applied (working tree, this commit); a
second round is required before the gate closes.

## Exercises

| Seat | Order | Outcome |
|---|---|---|
| `sweeper` (S0) | S0-EX1: completeness sweep of the tranche | 3 findings (stale count, roster/ unwired, wo7b/score.js no CI step) — all fixed |
| `red-team` (E7) | E7-EX1: defensive pass over the substrates | CRITICAL + HIGH set on the verifier trust boundary — see dispositions |
| `reviewer-anthropic` (R0) | R0-EX1: WO-14 diff, disclosed same-family degraded path | REVISE, 6 MAJOR — all fixed + re-review round |
| `reviewer-openai` (R0) | R0-EX2 = the gate-class cross-vendor review of the whole tranche (Sol · high, Codex CLI, pinned `69127bd..ecc88e3`) | REVISE — see dispositions |

## Applied this round (auto-blocking — violated a commit's own claim)

- **Mutation-path traversal / arbitrary write** (Red Team CRITICAL; cross-vendor CRITICAL/BREACH `verifier.js:342`) — violated WO-5's "writes confined to the throwaway checkout". Fixed: `confine()` helper rejects `..`/absolute mutation paths (result `ESCAPE` → FAIL); a failed restore now hard-stops the check.
- **Citation-replay path traversal / read oracle** (Red Team HIGH) — `confine()` applied; a citation resolving outside the checkout is `UNREPLAYABLE`, never a comparison.
- **Red-reported-green via UNAVAILABLE downgrade** (Red Team HIGH) — the report-contradiction check now fires on FAIL **or** UNAVAILABLE; `runShell` gained a 10 MB output ceiling and a 1 s timeout floor so an un-runnable suite cannot masquerade as absence-of-failure.
- **schema-check prototype-chain bypass** (Red Team MEDIUM; underlies several cross-vendor schema findings) — `hasOwnProperty` instead of `in` for required-field and additionalProperties checks.
- **Risk-tier gate oracle fail-open** (Red Team MEDIUM) — `normalizeRisk()` trims/upcases; an unrecognized tier fails **closed** to mandatory review (reviewPolicy) and to the T3 Q0 trigger (q0Required); `reviewer()` refuses an unknown tier.
- **Q0 calibration sample grindable via caller task_id** (Red Team MEDIUM) — keyed on the dispatcher `integrity_nonce`; no nonce → sampled closed (required).
- **WO-14 resolveSeat** (R0-EX1, 6 MAJOR): prototype-key lookups (`hasOwn`), the P15 gate now applies on the alias `new` path, bucket_state required (no fabricated Green), fail-closed on a missing/`null` alias map + all 16 §6.6 names required, the `detective` read-only pin validated, caller `castOpts` can no longer override an alias's declared rung, config exposed deep-frozen, strict roster flag. 15 new tamper/edge tests.
- **Sweeper findings**: router/README stale count removed; `wo7b/score.js` and `roster/lint.js` wired into CI; roster/ committed.
- **planner-gpt** plan/code reconciliation (both reviews, MINOR) — final-plan.md §6.6 annotated.

## OUTSTANDING — required before the gate closes (next session)

From the cross-vendor gate review (Sol · high), independently real, **not yet fixed**:

1. **[MAJOR] `runVerification` ignores `opts.mutations`; the CLI never passes them** (`verifier.js:494`). The integrated path returns PASS with `deterministic_only_closure:true` without ever running the mutation check. Wire mutations into `runVerification` and the CLI.
2. **[MAJOR] `reviewer()` returns `closes:true` while its embedded pre-dispatch gate says `allowed:false`** (`router.js`). A gated Opus reviewer must not close. Flip `closes` on a failed gate.
3. **[MAJOR] caller `flags.inert` overrides mandatory class/risk** (`router.js` reviewPolicy). An E7/T3 order with `inert:true` returned policy `none`. Inert must never override a mandatory class or T2/T3.
4. **[MAJOR] an unavailable required Q0 companion does not block dispatch** (`router.js` dispatch). When the Q0 casting is WAIT/невозможно, dispatch still returned `ok:true` with a schema-invalid Q0 (null casting/author). Block dispatch when a required Q0 cannot be cast.
5. **[MAJOR] `order.schema.json` rejects the `touches` field** the router reads for Q0 touch triggers (`additionalProperties:false`, no `touches`). Either add `touches` to the schema or move it out of the order object. Today a valid order can't carry the field that fires the auth/concurrency Q0 trigger.
6. **[MAJOR] `verdict-audit.schema.json` does not enforce its semantic gates** — a gate-class PASS with `refutation_duty_present:false` + `cross_family:false` + falsification UNAVAILABLE validates. Add conditional required/const gates.
7. **[MAJOR] `casting-record.schema.json` accepts contradictory `served_model_mismatch:false`** with requested≠served. Add the cross-field constraint (or document that the detector is computed, not schema-enforced).
8. **[MAJOR] AU-fable reserve path returns GATED instead of recasting the Conductor to Sol** (`router.js:296` dispatch). The plan promises the Conductor's turns re-cast to the Sol mirror; dispatch only gates. Implement the recast for the O0 seat.
9. **[MAJOR] `wo7b/score.js` G3 checks only the percentile**, not that every caught misroute landed at hop-1 ACCEPT with no escalation (`score.js:133`). The current data passes, but the negative path is unenforced — tighten to match the pre-registered gate text.
10. **[MINOR] `load.js` sorts enums before comparing** despite the "byte-identical" claim; **`load.js` does not dedupe alias ids** (a second `I1→I0` passes). Compare in order; reject duplicate alias identifiers.
11. Doc: the hand-written "21 live discriminators" (report/README) is **22** (the loader prints it correctly); fix the prose.

From the Red Team (E7-EX1), **architectural / owner decision — not a mechanical fix**:

- **[CRITICAL, provenance] the Verifier executes command strings (`shell:true`, full env) taken from the artifacts it audits** — manifest/citation/invariant commands. The plan's model is an owner-declared manifest, but `.claude/orchestra.json` is editable by an executor in the commit under review. This is a genuine trust-boundary redesign (owner-committed hash-pinned manifest vs argv-array allowlist for agent-sourced commands), **beyond WO-5's scope as written**. Needs an owner ruling on the verifier's trust model before implementation. Cheap blast-radius reductions (env allowlist, secret redaction over output tails, `--` before git revs, reject leading-dash refs) are worth applying regardless.
- **[MEDIUM] glob ReDoS** in `checkout.js` `globToRegExp` (measured 7.9 s at 8 stars) — cache compiled regexes, collapse consecutive `.*`. Fix before wiring `generatedPatterns` to any agent-editable source.
- **[LOW] teardown not guaranteed on SIGINT/SIGTERM** — leaves writable checkouts + stale worktree registrations (already observable on this machine). Add signal handlers that sweep then re-raise, plus a startup `git worktree prune`.
- **[LOW] git refs interpolated without `--`** — defense-in-depth for the day a ref comes from an artifact.

## Note

This tranche's mandatory cross-vendor review (R0-EX2) is **REVISE**, so
WO-5 and WO-6 have **not** cleared their gate. The applied fixes address the
CRITICAL breach and the class of findings that violated the commits' own
claims; the outstanding list above must be closed and re-reviewed before the
substrate is treated as gate-passed. The verifier trust-model finding is an
owner decision, not an autonomous fix.
