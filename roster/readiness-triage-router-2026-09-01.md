# Readiness triage — router findings at HEAD eef13b7 — 2026-09-01

Fresh-context Opus 5 triage agent; probes in the session scratchpad
(`repair-triage/router/probe{A,B,C,DEGI,F,H}.js`); repo left untouched. Baseline:
`node tests/router.test.js` → 135 passed. Findings originate from the WO-12 phase-0
S-lane control reviews (sdc-010, both lanes) and the second scope oracle's own probe.

## Verdicts

**A — SPLIT.** (i) `reviewPolicy` reading `flags.touches` so the security branch is
unreachable from a canonical order: **REFUTED-AT-HEAD** — `router.js:729–732` unions
`order.touches` with `flags.touches` and `:748` passes it to `reviewPolicy`;
`reviewPolicy('E2','T1',{touches:['auth','secrets']})` = `mandatory`. (ii)
`dispatch()` never derives `securitySensitive` from canonical touches:
**CONFIRMED-AT-HEAD** — `dispatch({class:'A0',touches:['auth']})` on the Fable rung
→ `ok=true, model="Fable 5"`; with `securitySensitive` supplied explicitly →
`FORBIDDEN`. Sharper: with NO caller flags, an OU-Amber degradation recasts a
crypto-touching A0 order `primary → mirror = Fable 5` (`crypto` is in
`securityTriggerList` but not `q0Triggers.touchAreas`, so Q0 does not mask it).
Guard at `:442–444` keys on `o.securitySensitive`; castOpts built at `:753` never
derive it. Fix: derive from `order.touches ∩ securityTriggerList` (OR caller flag);
re-apply the Architect filter after any recast.

**B — REFUTED-AT-HEAD.** `guard()` (`:550–567`) calls `preDispatchGate` and returns
`closes:false, outcome:'GATED'` for both the reserve and the Amber arm, at
`reviewer()` and through `dispatch()`. The in-file comment names it the WO-8 gate
finding. Fixed since WO-6.

**C — CONFIRMED-AT-HEAD.** `requiredReserve(defaultForecast()) = 0.08` and
`poolStateLadder.thresholds.redBelow = 0.08`; over 1001 sampled fractions
`belowReserve` and `state>=Red` never disagree. The change since WO-6 (`acbf8f2`,
measured 0.03 draw replacing the peak-derived 0.504) REMOVED the only lead the
reserve had. Only an override forecast produces a lead (0.325 in the probe).
Calibration/design gap, reserved to the owner.

**D — CONFIRMED-AT-HEAD.** `dispatch(createQ0Order(...).order, G)` throws uncaught
`Test Designer casting needs implementationAuthorFamily` (`:420`); castOpts at
`:753` never thread the family. Every other dispatch failure is typed; this one
crashes.

**E — REFUTED-AT-HEAD.** `reviewer()` with no buckets throws `reviewer requires
bucket_state — fail closed, not Green (P15)` (`:540–542`); incomplete maps refused
by `normalizeBuckets` (`:297–318`). Symmetric with `cast()`.

**F — CONFIRMED-AT-HEAD (broader than reported).** Validation loop (`:134–168`)
walks `castings.roles` only; `reviewMatrix` gets a presence check (`:196–199`),
`degradedSameFamilyCandidates` none. Of six tampered tables, all load clean; two
(vendor mismatch, off-ladder effort) even RETURN a mislabeled casting; same-family
and unknown-model rows throw at call time. Role-table controls refuse at load, so
the header's "any drift refuses to construct" holds only for `roles`.

**G — CONFIRMED-AT-HEAD.** `q0Required` touch branch (`:655–657`) has no class
predicate (the tier branch at `:661` does): N0/D0/I0/N1/M0/S0 with `touches:['auth']`
all `required:true`; a read-only Scout order hard-blocks on a missing Q0.

**H — CONFIRMED-AT-HEAD.** `fnv1a` (`:82–89`) computes `h * 0x01000193` in float64
(product ~7.2e16 > 2^53): 200,000/200,000 digests differ from a BigInt FNV-1a;
calibration fires **26.925%** vs configured 25% (reference 24.802%); residue χ² =
270,006 vs 125 for the reference (df=99); buckets range 375–6155 against ~2000.

**I — CONFIRMED-AT-HEAD (T0/T1).** V0/P0 dispatch: `authorFams = [familyOf(
'deterministic')] = [null]` → unattributed branch → `degradedPath()` returns
`closes:true, degraded:true, reviewerFamily:"anthropic"` — an Opus same-family
review of a deterministic substrate. T2/T3 correctly `DOES_NOT_CLOSE`.

## Summary

| # | Verdict | HEAD lines |
|---|---|---|
| A(i) | REFUTED | 514, 519, 729–732, 748 |
| A(ii) | CONFIRMED | 442–444, 753 |
| B | REFUTED | 550–567, 834–838 |
| C | CONFIRMED (calibration) | 66, 73–80; qm 201–212, 562 |
| D | CONFIRMED | 417–431, 692, 753 |
| E | REFUTED | 297–318, 540–542 |
| F | CONFIRMED (broader) | 134–168, 196–199, 322–328, 551–554 |
| G | CONFIRMED | 655–657 |
| H | CONFIRMED | 82–89, 673 |
| I | CONFIRMED (T0/T1) | 397–399, 763, 831–833, 546, 579, 628–646 |

6 CONFIRMED, 3 REFUTED. All six confirmed defects sat entirely outside the 135-test
suite's coverage.
