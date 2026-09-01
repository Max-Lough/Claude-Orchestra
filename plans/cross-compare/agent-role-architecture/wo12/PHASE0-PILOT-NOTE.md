# WO-12 Phase-0 pilot note — 2026-08-31 — NON-GATING

**Status: WO-12 stops at phase 0** per the second-pass scope oracle
(`roster/wo12-scope-oracle-2-2026-08-31.md`, Sol · xhigh, open-ended order after the
owner rejected the first order's framing). The remaining corpus (phases 1–3) is an
optional research asset, not a harness-completion gate. This note is the immutable
pilot record; per amendment xiv and the oracle's bright lines, no WO-12 tooling,
corpus, or scorer changes accompany it.

## What ran

12 artifacts (6 seeded, one per type, all MAJOR; 6 controls), three lanes:

| lane | transport | completed | unavailable | seed recall | integrity warnings |
|---|---|---|---|---|---|
| X-Sol (gpt-5.6-sol · high) | orchestra-review.js, sanitized clones | 11/12 | 1 (sdc-004, both attempts) | 5/6* | 0 |
| S-Sonnet (claude-sonnet-5) | in-harness Agent, hand-transcribed §2.4 | 12/12 | 0 final (sdc-002 attempt 1 killed by an API-side `[bio]` classifier; retry completed) | 6/6 | 0 |
| S-Opus (claude-opus-5) | in-harness Agent, hand-transcribed §2.4 | 12/12 | 0 | 6/6 | 0 |

*X-Sol's miss is sdc-004 — the artifact it never reviewed (UNAVAILABLE), not a
review failure. Among reviews that completed, X-Sol hit 5/5.

**The honest pilot comparison is 5/6 (X-Sol) vs 6/6 (each S-lane; union 6/6).**
Every hit in every lane was an exact-path citation; most carried an executed
reproduction. No lane showed pilot-only cross-family complementarity: the one seed
X-Sol missed, both S-lanes found.

## Scorer discrepancy — preserved, deliberately not repaired

`corpus/score-output.json` reports 4/29 vs 5/29 for the 12d unions. Two known
distortions, recorded per the oracle and left unfixed (repair would reopen the
amendment-xiv instrumentation treadmill):
1. It applies the withdrawn 12f identity exclusion to 12d — the in-harness S-lane
   records carry no engine header (the transport has none), so served-model reads
   UNKNOWN and sdc-002 was excluded from every lane's counts, deleting X-Sol's
   own hit there. The S-lane models are known by construction (Agent dispatch
   metadata; attempt-1's API error for sdc-002 names `claude-sonnet-5` verbatim).
2. It uses all 29 non-excluded corpus seeds as the denominator, including the 24
   phases-1–3 seeds nobody ran; its "construction-suspect" list is those 24
   unreviewed seeds, not a corpus defect.

## Verdict divergences (adjudication material, deferred)

Controls sdc-007, sdc-008, sdc-012: S-Sonnet APPROVE / S-Opus REVISE. Control
sdc-010: both REVISE. False-blocker adjudication is deferred per the oracle; the
REAL/DEBATABLE/NOISE pass runs only if the owner ever orders corpus completion.

## Live-code findings surfaced by the S-lane control reviews — READINESS BLOCKERS

The second oracle overturned the first verdict's registration-only disposition:
these are readiness blockers for the harness, to be dispositioned (current-HEAD
reproducer or precise refutation) in a gate-class readiness-repair tranche before
any shadow. The oracle independently confirmed one probe itself:

- **CONFIRMED by oracle probe:** an order with `touches:["auth"]` dispatches to
  Fable — `dispatch()` never derives `securitySensitive` from its canonical
  touches (`{"ok":true,"model":"Fable 5"}` on the A0 auth-touch probe); related:
  `dispatch()` reads `o.flags.touches` while the Q0 path reads `order.touches`,
  so the security-trigger mandatory-review branch is unreachable (S-Opus
  sdc-010 CRITICAL).
- P15 reserve gate computed but unenforced on the reviewer casting path
  (S-Sonnet + S-Opus sdc-010, convergent, reproduced).
- `requiredReserve` default = 0.08 = the ladder's `redBelow` — the "predictive"
  reserve never leads the Red transition under the default forecast (S-Opus
  sdc-002 GAP; oracle-confirmed arithmetic).
- Q0 dispatch of the router's own `createQ0Order()` output throws uncaught;
  `reviewer()` defaults missing buckets to allGreen (fail-open) while `cast()`
  fails closed; reviewMatrix hand-edits crash at call time, not load time
  (S-Opus sdc-010).
- Historical-commit findings (quartermaster `confirm()` bounds, stale-reading
  `reserveBreached` forcing, predictThrottle flat-rate crash) were fixed in later
  commits — each needs a current-HEAD check to confirm, not assume.

## Draw measurement (§2.6)

OU 0.78 → 0.74 across 13 engine attempts (~0.31 pts/attempt). Remaining X-Sol
corpus would cost ~22–27 pts of the weekly window — affordable, and explicitly
not the reason for stopping.

## What happens next (oracle's binding path, pending owner ratification)

1. This note + raw results committed (done, this commit).
2. Gate-class readiness-repair tranche (all live findings; max two fix/review
   cycles; stop-to-owner on a third).
3. **Activation bridge** — the campaign's largest unacknowledged gap: router/
   registry/Verifier/Quartermaster/roster are libraries with no production
   caller; `install.js` still installs the legacy core. An installed end-to-end
   canary must prove dispatch, gates, Q0, verification, non-closing refusal, and
   `roster:new → roster:legacy` rollback before WO-15 can honestly begin.
4. E8/E1/A0 exercises through the working path; A1/E5-render/M0-images become
   shadow canaries or declared capability limits.
5. WO-15 shadow → WO-16 acceptance → WO-17 retirement → WO-18.
