# Readiness triage — quartermaster findings at HEAD eef13b7 — 2026-09-01

Fresh-context Opus 5 triage agent; probes in the session scratchpad
(`repair-triage/quartermaster/probe{,2,3}.js`, `q8-*.test.js`); every call used
explicit temp `--file` fixtures; repo left byte-clean. Baseline: `node
tests/quartermaster.test.js` → 195 passed. Findings originate from the WO-12 phase-0
S-lane control reviews (sdc-007, sdc-009; the controls pin EARLIER commits, so
several were expected to be fixed by rounds 2–4).

## Verdicts

**Q1 — CONFIRMED-AT-HEAD (narrowed).** `confirm()` (`:785`) enforces only
`> orangeBelow`; no `< amberBelow` anywhere in `confirm()` or `analyze()`'s void
chain. A 0.92 Green reading mints a real, appended, arm-lifting confirmation. The
"later satisfies the arm when the bucket drops" clause is REFUTED: a genuine drop is a
new reading and the round-2 re-anchoring (`:620`, `evidenceTs !== latest.ts`) voids
it. Soft-throttle, hard-throttle and exhausted sub-cases all correctly refuse.

**Q2 — CONFIRMED at the published contract; no dispatch escape.** The router arm
(`router.js:353`) is `STATE_ORDER >= Amber && !confirmation`; `analyze()`'s void
chain (`:617–636`) has no `belowReserve` clause while `poolState` maps
`reserveBreached → Red`. With an override forecast, a lawfully-minted confirmation is
published on a bucket the router calls Red: `{state:"Red", belowReserve:true,
quartermasterConfirmation:true}`. `preDispatchGate` tests `belowReserve` first, so no
Opus dispatch escapes today — the defect is a contract object asserting an arm-lift
defended only by ordering in another file.

**Q3 — REFUTED-AT-HEAD.** Round 4's single freshness knob makes the scenario
unconstructible: reading must satisfy `ageMs <= maxFreshMs` (`:542`) and throttles are
filtered by the same `maxFreshMs` (`:556`), so a dropped throttle is always OLDER than
the live reading. Residual (minor): `DEFAULT_MAX_STALE_MS` (48h) still governs
`predictThrottle` (`:845, :855`), looser than the 24h routing gate; reachable only by
direct API callers since `report()` continues on `info.problem` first.

**Q4 — CONFIRMED-AT-HEAD — CRITICAL.** `:556` and `:617` (`now - t.at >= 0`)
silently FILTER future-dated throttles and confirmations while `:526–533` REFUSES a
future reading. A hard throttle dated +2h vanishes: bucket publishes Green,
`preDispatchGate(Opus 5) = {allowed:true}`, `malformedCount 0`, no mention in
`report()`. The same throttle one minute in the PAST yields Exhausted and the Amber
arm. `confirm()` (`:769`) shares the bug and grants over a future throttle.

**Q5 — REFUTED-AT-HEAD (mooted by round 4).** A reading past `maxFreshMs` fails the
whole bucket closed at step 3b (`:542–552`) before the confirmation block is reached:
`bucketState` throws `failClosed`. Closed by refusal rather than re-check.

**Q6 — CONFIRMED-AT-HEAD.** `:464` `opts.forecast ? validateForecast(...) :
defaultForecast()` — `null/0/''/false` silently take the loosest reserve (0.08);
`validateForecast`'s `!forecast` guard (`:258`) is dead from this call site.

**Q7 — CONFIRMED for the future-dated sub-case only.** Flat rate, dt=0, and 1e-12
decline all handled (`:874`, `:865`, `:895–912` horizon guard). A latest reading
dated +10h has negative age, passes the staleness check, and yields four confident
ETAs including `Amber crossed:true` — where `analyze()` refuses the same record.

**Q8 — CONFIRMED (both halves).** (a) `tests/quartermaster.test.js:50` hand-derives
`REAL_READINGS` instead of `qm.DEFAULT_READINGS_FILE` (exported at `:1120`). (b) The
byte-identity guard (`:716–725`) lives inside section 12; the `process.on('exit')`
handler (`:78–85`) has no comparison. Demonstrated: an injected abort before section
12 → guard never runs; a sentinel clobbered at the top of section 13 → suite reports
the guard PASS and 195/195 while the protected file was modified.

## Summary

| # | Verdict | HEAD lines | Severity |
|---|---|---|---|
| Q1 | CONFIRMED (band bound) | qm 785–792; 625–628; 769–784 | Major |
| Q2 | CONFIRMED (contract) | qm 617–636, 583; router 61, 350–353 | Major |
| Q3 | REFUTED | qm 454–463, 542, 556, 845 | — |
| Q4 | CONFIRMED | qm 556, 617, 769 vs 526–533 | **Critical** |
| Q5 | REFUTED | qm 542–552, 608–613 | — |
| Q6 | CONFIRMED | qm 464, 257–264 | Minor |
| Q7 | CONFIRMED (future-dated) | qm 840–928 | Minor |
| Q8 | CONFIRMED | test 50, 78–85, 716–725 | Test-quality |

5 confirmed (Q1/Q2 share a root; Q4 spans three sites), 2 refuted outright; the
round-2 and round-4 review fixes landed exactly as claimed.
