# WO-8 assurance band — exercise records and review dispositions

The four assurance seats were staffed and each run on a real order. Three of
the four exercises surfaced genuine defects in the already-committed
substrate tranche (WO-4/5/6/14) — the seats working as designed. This file
records the exercises and the disposition of every finding.

**Status: round-2 fixes applied under owner rulings (2026-08-30, below); the
R0-EX3 re-review (Sol · high, pinned `fb07668..d00a7ae`) confirmed every
round-1/2 closure real but returned REVISE with 3 MAJOR + 2 MINOR defects in
the NEW round-2 code — all five reproduced locally and fixed in round 3 (see
§R0-EX3 below). The tranche remains REVISE until a re-review of the round-3
diff (R0-EX4) comes back clean.**

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

## R0-EX3 (re-review of round 2) and the round-3 dispositions

R0-EX3 (Sol · high, Codex CLI, pinned `fb07668..d00a7ae`; order at
`roster/r0-ex3-order.md`, verdict verbatim at `roster/r0-ex3-verdict.md`):
**REVISE** — every round-1/2 closure independently CONFIRMED (it re-ran all
seven declared verification commands itself), but 5 defects found in the new
round-2 code. All five reproduced locally before fixing; all fixed:

- **[MAJOR] reserve gate examined the already-degraded casting** — at
  `AU-fable {Amber, belowReserve}` the §5.5 auto-recast silently satisfied
  the P15 stop (a WORSE state than Green+belowReserve produced a MORE
  permissive outcome). Fixed: `cast()` records the requested rung;
  `dispatch()`/`resolveSeat()` run a `reserveGate` against the REQUESTED
  model first (Amber arming still checks the served casting). A Fable/Opus
  primary at any-state+belowReserve now GATES; the Conductor takes the
  disclosed reserve path. Corollary fixed with it: EVERY mirror-served
  Conductor turn now carries `disclosed:true` + the mirror restrictions,
  whichever path produced it.
- **[MAJOR] glob ReDoS survived as separated star runs** (`**a**a…` — 5.4 s
  on 32 chars). The regex is gone entirely: patterns token-compile to a
  cached list and match via a linear-pass DP (O(pattern × path), no
  backtracking to detonate). Semantics regression-tested.
- **[MAJOR] tail-then-redact leaked straddling credentials** — a token
  crossing the 2000-char cutoff survived as a reconstructible suffix.
  Fixed: redaction runs over the FULL output before truncation; end-to-end
  regression through `runShell`.
- **[MINOR] SIGTERM listener inert on Windows** — TerminateProcess runs no
  userland handler; nothing can fix that. Fixed honestly: Windows installs
  the trappable set (SIGINT/SIGBREAK/SIGHUP), POSIX keeps SIGTERM, the
  limitation is documented in-code, and the startup `worktree prune` is the
  named recovery for untrappable kills.
- **[MINOR] literal NUL bytes in `router.js`** (the touches-enum join
  separators) made the file read as binary to line tools. Replaced with a
  comma; a no-control-bytes regression check pinned in the router suite.

Also this round: `roster/lint.js` exempts record documents by prefix
(`woN-`/`rN-exN-`) instead of a growing name list. R0-EX3's one UNVERIFIED
row (review-lane suite: 6 environment-dependent failures in ITS sandbox)
reflects the reviewer's environment; the suite is green here.

## R0-EX4 (delta re-review of round 3) and the round-4 dispositions

R0-EX4 (Sol · high, pinned `d00a7ae..7e90c67`; verdict verbatim at
`roster/r0-ex4-verdict.md`): **REVISE, converging** — all five R0-EX3
closures independently CONFIRMED (it re-probed reserve gating, separated
stars, cutoff redaction, Windows signals, and the NUL itself), with four new
findings. All fixed in round 4:

- **[MAJOR] comma-join collision in the touches lint** — an enum entry that
  itself contains a comma made unequal sets join identically (`["auth,authz"]`
  vs `["auth","authz"]`), letting drift disable mandatory review + Q0. Fixed:
  element-wise comparison, no join at all; a comma-bearing-entry tamper test
  pinned. (Ironic lineage: the original NUL separator existed to dodge exactly
  this; the NUL broke the file, the comma broke the check, the join is gone.)
- **[MINOR] DP matcher drifted on line terminators** — the rewrite let `**`
  span `\n`/`\r`/U+2028/U+2029, which the retired regex `.` never matched.
  Fixed: globstar excludes line terminators, `*` excludes only `/` — the old
  classes replicated exactly, regression-pinned.
- **[MINOR] `worktree prune` does not reclaim an EXTANT leftover** — an
  untrappable kill leaves directory + registration, and prune keeps both.
  Fixed: `sweepAbandoned()` at checkout creation removes registered worktrees
  under this module's own tmp prefix that no live in-process checkout owns
  (ACTIVE set skipped — runVerification legitimately holds head+base at
  once), then prunes. Simulated-leftover test pinned.
- **[MINOR] order-file overclaim** — the R0-EX4 order said "the single
  round-3 commit" while the pinned range also contained `444eaf3` (the
  R0-EX3 order records, +136 lines of markdown). Acknowledged; from R0-EX5
  on, orders enumerate every commit in the pinned range.

## R0-EX5 (delta re-review of round 4) and the round-5 disposition

R0-EX5 (Sol · high, pinned `7e90c67..e7a5e31`; verdict verbatim at
`roster/r0-ex5-verdict.md`): **REVISE** — all four R0-EX4 closures
CONFIRMED; one **CRITICAL** in the round-4 code, and it is the real thing:
`sweepAbandoned`'s prefix guard used substring containment on the full path
and then `rm -rf`'d the worktree's PARENT. Two independent detections within
minutes of each other:

- **CI (macOS/Windows)**: the test fixture repo's own tmp path
  (`orchestra-verifier-fixture-…`) matched the substring; its MAIN worktree
  was classified a leftover and `path.dirname()` of a repo sitting directly
  in tmp is the **OS temp root**, which the sweep then deleted. Ubuntu and
  the local run survived on deletion-order luck only.
- **R0-EX5**: a legitimate dirty worktree under an ancestor merely
  containing the substring was destructively swept, sibling file included.

**Fixed in round 5**: identification is structural, never a substring — a
leftover is exactly `<tmp>/<prefix>XXXX/checkout` (basename `checkout`,
parent whose OWN basename carries the prefix, only that parent removed), and
the main worktree (first porcelain entry) is skipped outright. Both
reproducers pinned as regressions (the CI fixture shape and R0-EX5's
legit-worktree-with-sibling shape). Residual, accepted: a user directory
deliberately named `orchestra-verifier-*/checkout` and registered as a
worktree would still be swept — the mkdtemp prefix is the namespace claim.

## R0-EX6 (delta re-review of round 5) and the round-5b disposition

R0-EX6 (Sol · high, pinned `e7a5e31..ceeaabc`; verdict verbatim at
`roster/r0-ex6-verdict.md`): **REVISE** — the R0-EX5 CRITICAL confirmed
CLOSED (both reproducer shapes independently re-probed, reclaim behavior
verified not regressed), one MAJOR remaining in `ceeaabc`: the sweep's
live-set (ACTIVE) exemption compared LEXICAL paths, while git registers
worktrees under canonical paths — through a junction/symlink (or macOS
`/var`→`/private/var`, or a Windows 8.3 tmpdir) the compare misses and the
sweep deletes a still-live checkout.

**Detected twice again, CI first**: the same defect broke PR #28 CI on
macOS/Windows (live checkout deleted mid-`runVerification`, invariant probes
dying on a vanished cwd) and was **already fixed at `09a824e`** — `normPath`
resolves real paths (lexical fallback for paths already gone), with an
aliased-tmp-root (junction/symlink) regression that reproduces the class on
every platform — before the R0-EX6 verdict landed. R0-EX6's junction probe
is the same shape as the pinned regression.

## R0-EX7 (delta re-review of round 5b) and the round-5c disposition

R0-EX7 (Sol · high, pinned `ceeaabc..09a824e`; verdict verbatim at
`roster/r0-ex7-verdict.md`): **REVISE** — the stable-alias case (the CI
shape) confirmed fixed, plus one MAJOR on a sharper edge: when the ALIAS a
live checkout was created through is later removed, sweep-time re-resolution
of the ACTIVE handle falls back to the lexical alias spelling while git's
listed path stays canonical — the exemption misses and the sweep deletes the
live canonical checkout. It also (fairly) refuted the executor report's
"all green" header line, since that very report disclosed review-lane at
113/114 under concurrent load.

**Fixed in round 5c**: a checkout's canonical identity is captured AT
CREATION (`entry.realDir`, resolved while every path component is guaranteed
to exist) and the sweep's live set compares that — never a sweep-time
re-resolution. Sol's alias-removal probe pinned as a regression alongside
the stable-alias one. PR #28 CI went 9/9 green on run 33333118636 (the PR
head after `4e509b5`; the workflow on `09a824e` itself was superseded — 4
passes, 4 cancelled, and one Windows review-lane failure that was the very
flake later root-caused in round 5c — corrected per the R0-EX8 MINOR); this
fix hardens the edge CI cannot reach.

## R0-EX8 (delta re-review of round 5c) and the round-5d dispositions

R0-EX8 (Sol · high, pinned `09a824e..3a9cc73`; verdict verbatim at
`roster/r0-ex8-verdict.md`): **REVISE** — the ordinary alias-removal case
confirmed fixed, with two MAJORs on the newest fixes and one records MINOR.
All fixed in round 5d:

- **[MAJOR] identity capture degraded to a lexical guess on realpath
  failure** — if the alias vanished DURING creation-time resolution,
  `normPath`'s lexical fallback stored the alias spelling as identity and a
  later sweep deleted the live canonical checkout. Fixed fail-CLOSED:
  `createCheckout` resolves the canonical path itself and REFUSES the
  checkout (cleaning its own registration) when resolution fails — the
  lexical fallback now serves only already-gone swept paths, never a live
  identity. Poisoned-realpath regression pinned (no checkout, no stray
  registration).
- **[MAJOR] the flake guard waited a duration, not the condition** — a slow
  checkout stays locked past any fixed sleep (Sol's 15,000-file probe held
  the lock well past 250 ms). Fixed: both kill branches now poll
  `worktree list --porcelain` for the lock to actually clear
  (`waitWorktreesUnlocked`, bounded), asserted as its own check.
- **[MINOR] records precision** — "9/9 green on `09a824e`" conflated the PR
  head's run with the superseded run on `09a824e` itself (4 pass / 4
  cancelled / 1 Windows review-lane flake — the same race, firing in CI).
  Corrected in the round-5c section above.

## Note

The tranche's gate verdict is **REVISE** until a cross-vendor re-review of
the round-5d diff (R0-EX9) comes back clean. Open items are process, not
code: (1) R0-EX9, and (2) the registered follow-ons — the verification-time
diff-derived `touches` cross-check, and the reference runner's
single-`--force` sweep vs locked worktrees.
