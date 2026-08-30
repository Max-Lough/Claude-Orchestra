# WO-8 assurance band — exercise records and review dispositions

The four assurance seats were staffed and each run on a real order. Three of
the four exercises surfaced genuine defects in the already-committed
substrate tranche (WO-4/5/6/14) — the seats working as designed. This file
records the exercises and the disposition of every finding.

**Status: round-2 fixes are applied under owner rulings (2026-08-30, below).
Every outstanding finding is closed in code. The tranche remains REVISE until
the cross-vendor lane re-reviews the round-2 diff — re-review is the one
remaining step before the gate closes.**

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

## Owner rulings (2026-08-30) and the round-2 application

Walked item-by-item with the owner; every ruling recorded here, all fixes
applied and proven this round (129 router / 89 verifier / 31 registry checks,
full CI-equivalent green).

- **Ruling 1a — Verifier trust model** (E7 CRITICAL): the manifest is pinned
  OUTSIDE the commit under audit. `runVerification` reads it from an owner
  ref (`manifestRef`, default the base ref) at `.claude/orchestra.json` via
  `git show` against the real repo — never from the head checkout; a
  caller-supplied manifest records `pinned:false` provenance (the dispatcher
  is then the trust boundary). Proven: a head commit that breaks the code AND
  rewrites its own manifest to a vacuous oracle still fails. Blast-radius
  reductions applied regardless: `runShell` env allowlist (no inherited
  secrets), credential redaction over recorded output tails, leading-dash
  ref rejection + `--` before git revs, and `confine()` is now
  real-path-based (a symlink/junction committed inside the checkout can no
  longer smuggle a read/write outside — the WO-14 re-review corollary).
  **Documented residual under (a):** artifact-sourced citation/invariant
  commands remain free-form shell strings behind the minimal env — the (c)
  argv-allowlist extension was considered and not taken.
- **Ruling 2a — AU-fable reserve**: implemented as planned. The Conductor's
  turns re-cast to the Sol mirror at matched effort when the AU-F reserve
  gate fires — disclosed (`recastFrom`/`recastReason`), the mirror rung's
  restrictions carried on the casting; any other Fable seat stays GATED.
- **Ruling 3a — `touches` declared, not derived** (Fable-agent analysis):
  pure derivation is temporally incoherent with the plan — Q0 fires at order
  creation, before a diff exists — and a diff-derived sole source would
  trust the artifact under audit (the 1a precedent). `touches` is now a
  typed enum on `order.schema.json` (union of `q0Triggers.touchAreas` ∪
  `securityTriggerList`, linted at router load — drift refuses to
  construct); the order is the canonical carrier and caller flags may only
  ADD areas (union). **Registered follow-on, not built:** a
  verification-time diff-derived cross-check (union semantics, escalate on
  disagreement) in the Verifier/E7 lane.
- **Ruling 4 — schema semantic gates**: verdict-audit gates are in-schema
  (a PASS with `refutation_duty_present:false` cannot exist; a gate-class
  PASS requires `cross_family:true` and falsification SURVIVED — the same
  facts stay expressible on a FAIL). `served_model_mismatch` is a COMPUTED
  detector: the Verifier's artifact validation recomputes it and refuses a
  record that contradicts or omits a computable mismatch; the schema
  documents this.
- **Ruling A** — dispatch normalizes sloppy risk tiers onto the order
  (whitespace/case only) and refuses unrecognizable tiers at the door; the
  Q0 companion can no longer carry a schema-invalid risk.
- **Ruling B** — dispatch MINTS `integrity_nonce` (caller value never keys
  the calibration draw); the minted order rides the result for the ledger.
  Direct `q0Required()` calls without a nonce stay sampled-closed.
- **Ruling C** — `reviewer()` requires bucket_state on the exported API (the
  `|| allGreen()` fabricated-Green default is gone); resolveSeat's
  buried-gate shape got its README line.

**Applied round-2 mechanical fixes** (cross-vendor #1–#11 + WO-14 minors +
E7 mediums/lows): mutations wired into `runVerification` and the CLI
(`--mutations`); a gated reviewer returns `closes:false` (typed GATED); a
required-but-uncastable Q0 blocks dispatch; `flags.inert` can never relax a
mandatory class, T2/T3, an unrecognized tier, or a security touch (and never
applies above T1); `score.js` G3 enforces the full pre-registered text (P95
AND all-caught-at-hop-1-ACCEPT AND zero escalations); `load.js` compares
enums in registry order and rejects duplicate alias ids; the remaining
`hasOwn` family closed (`cast()` rung lookup, `normalizeBuckets`,
`bucketsFor`, `ALIAS_PINS`); `cast()` uses `normalizeRisk` everywhere risk
enters; glob compilation collapses star-runs and caches (ReDoS: ~7.9 s → <5
ms, regression-tested); SIGINT/SIGTERM/SIGHUP sweep checkouts then re-raise,
and `createCheckout` prunes stale worktree registrations at start.
Item #11 (the "21 live discriminators" prose): the string no longer exists
anywhere in the tree — already removed by the round-1 sweep; the loader
prints the correct 22. `roster/lint.js` now exempts this dispositions log
from the role-file contract (it broke the CI lint it itself wired in).

## Findings addressed above, as originally recorded (historical)

From the cross-vendor gate review (Sol · high), independently real, **fixed
in round 2 as recorded in the rulings section**:

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

## WO-14 re-review (R0-EX1 round 2, landed post-halt)

The Anthropic-lane re-review of the WO-14 fixes: **10 of 11 FIXED, 1 PARTIALLY**
(the six original MAJORs are all resolved and independently re-probed). Verdict
REVISE on new MINORs, all small/local, to fold into the next round:

- **[MINOR] `router.js:385` `cast()` `role.rungs[rungName]`** — a bare bracket read with a
  caller-chosen key (the one site the "hasOwn everywhere" comment names but missed).
  `castOpts:{rung:'__proto__'}` sails past `if (!rung) throw` and dies with an uncaught
  TypeError at effectiveState instead of the typed "no rung" error. Fail-closed in effect
  (crashes, doesn't fabricate) but wrong. Fix: `hasOwn(role.rungs||{}, rungName)`.
- **[MINOR] `router.js:280` `normalizeBuckets` `buckets[b]`** — prototype-chain read; with
  global pollution `normalizeBuckets({})` fabricates all-Green (the one remaining way to
  fabricate Green). `hasOwn(buckets, b)` closes it.
- **[MINOR] `router.js:126` `bucketsFor`** — same bare read; only reachable via tampered
  castings.json (low severity).
- **[MINOR] dispatch never normalizes risk onto the order** (`router.js:612`) — `dispatch({
  class:'E5', risk:'T3 '})` returns ok:true and emits a Q0 companion carrying `risk:"T3 "`
  verbatim, which is **schema-invalid** (order.schema risk enum is exactly T0–T3). Corroborates
  the cross-vendor "order.schema / schema-invalid Q0" findings. Normalize onto the order or
  reject at dispatch.
- **[MINOR] `cast()` compares raw `o.risk`** (`:363/:422`) — two risk oracles for one field:
  `reviewPolicy('D0','t1')`→preferred while `cast(...,{risk:'t1'})`→FORBIDDEN. Apply
  normalizeRisk consistently.
- **[MINOR] Q0 nonce provenance is asserted but not enforced** — `q0Required` reads
  `order.integrity_nonce` straight off the caller; dispatch never writes one for the impl
  order, so (a) an evading nonce is grindable and (b) calibration-eligible orders with no
  nonce now spawn 100% Q0 (safe but an unremarked cost change). The dispatcher must mint the
  nonce for the sample to be unforgeable.
- NITs: `reviewer()` still has the `o.buckets || allGreen()` fail-open on the exported API
  (not reachable from dispatch); `ALIAS_PINS[name]` bare read gives a nonsense diagnostic on a
  polluted key (fails closed); resolveSeat buries the gate at `target.cast.ok` with no
  top-level `ok` (dispatch surfaces it) — worth a README line.
- **[out of scope, WO-5 owner] `verifier.js` `confine()` is purely lexical** (no
  `fs.realpathSync`) — a symlink committed inside the checkout by the party under audit passes
  confine() and is then followed by read/write: the exact escape the function claims to
  prevent. Not reproduced (privileged symlink creation), CI is ubuntu. **Add to the WO-5
  outstanding list** — my confinement fix this round is necessary but not sufficient against a
  symlinked checkout.

## Note

This tranche's mandatory cross-vendor review (R0-EX2) is **REVISE**, and the
verdict stands until the round-2 diff is re-reviewed by the cross-vendor
lane. Everything the review found is now fixed in code under the owner
rulings of 2026-08-30 (see above); the two open items are process, not code:
(1) the cross-vendor re-review of this round, and (2) the registered
follow-on — the verification-time diff-derived `touches` cross-check.
