# Readiness-repair tranche — 2026-09-01 — STATUS: OPEN, stopped to owner (oracle rule)

Authorized by the second-pass scope oracle (`wo12-scope-oracle-2-2026-08-31.md`, step 2 of
its binding path) and ratified by the owner. Rule applied: "at most two fix/re-review
cycles; a second cycle that still produces a new MAJOR/CRITICAL stops to the owner."
Cycle 2 produced one new MAJOR. Stopped.

## Triage (HEAD eef13b7) — verdicts verbatim

- `readiness-triage-router-2026-09-01.md` — findings A–I from the S-lane control
  reviews + the oracle's own probe: **6 CONFIRMED** (A-ii security derivation, C
  reserve/redBelow parity, D Q0 dispatch throw, F load-time validation gap, G Q0
  touch-trigger class filter, H fnv1a overflow, I substrate review path), **3 REFUTED**
  (A-i, B, E — fixed by WO-8's gate work and the touches-threading change since WO-6).
- `readiness-triage-quartermaster-2026-09-01.md` — findings Q1–Q8: **5 CONFIRMED**
  (Q4 future-dated throttle/confirmation fail-open — CRITICAL; Q1 Amber upper bound;
  Q2 belowReserve void clause; Q6 forecast truthiness; Q7 predictThrottle future
  guard; Q8 test-guard placement), **2 REFUTED** (Q3, Q5 — closed by round-4's
  single-freshness-knob retirement of the stale band).

All confirmed defects sat outside the green suites' coverage at HEAD.

## Fixes (in this commit; disjoint builders; every fix pinned)

Router (`router/router.js`, `tests/router.test.js`, `registry/schemas/order.schema.json`):
A-ii, D, F, G, H, I as specified in the triage; C documented + pinned only (calibration
decision reserved to the owner — see below). Quartermaster (`quartermaster/*`,
`tests/quartermaster.test.js`): Q1, Q2, Q4, Q6, Q7, Q8; README reconciled.

Suites after cycle 2: router 153 (was 135), quartermaster 216 (was 195), registry 31,
exec-lane 79, mcp-lane 68, review-lane 126, scan-lane 41, verifier 101,
frontmatter-lint 37, wo12-tooling 983 — 0 failed in a quiet tree; `install.js --lint`
clean. (The cycle-2 reviewer saw 2+2 failures in exec-lane/mcp-lane while it was
itself spawning processes in the live tree; re-run quiet: 79/79, 68/68 — the recorded
environment-sensitive flicker, not a regression.)

## Cross-vendor review (X-Sol · high, live tree vs HEAD)

- **Cycle 1** (`readiness-review-cycle1-2026-09-01.md`): REVISE — 2 MAJOR BREACH.
  (1) fix D inverted: dispatch() seeded the implementation family from the Q0 order's
  OWN `author_family`, opposing it twice and defeating Q0 independence — the builder's
  pin asserted the wrong criterion ("matches the parent") and the Conductor's spec let
  it. (2) fix F incomplete: `degradedSameFamilyCandidates` rows never checked against
  their key. Both fixed: Q0 orders now carry an explicit `implementation_author_family`;
  pins name the resulting VENDOR in both directions; key/family drift refuses at load.
- **Cycle 2** (`readiness-review-cycle2-2026-09-01.md`): REVISE — **1 MAJOR, 1 MINOR**:
  - MAJOR `router.js:895` — a Q0 created for a HUMAN-authored implementation while
    both pools are Green records `author_family:"anthropic"`; re-dispatched after
    AU-all turns Amber it serves OpenAI/Terra while still returning the stale
    `author_family`. (Human authors have no single "opposite"; the family is chosen
    by pool state at cast time, so a creation-time stamp can disagree with the served
    casting on re-dispatch.)
  - MINOR `router.js:895` — override precedence uses `||`, so an explicit empty-string
    `castOpts.implementationAuthorFamily` silently falls through to the order field
    instead of the promised typed refusal.
  Everything else CONFIRMED (suites, lint, castings.json untouched, quartermaster
  fixes pinned and green).

## Open items for the owner

1. **Cycle-3 authorization**: fix the residual MAJOR (record the SERVED family on the
   Q0 order at dispatch, or re-derive `author_family` from the casting at return) and
   the MINOR (`??` semantics + typed refusal on non-string overrides), then one more
   review — or accept both as registered follow-ons and close the tranche as-is.
2. **Reserve calibration (finding C)**: `requiredReserve(defaultForecast()) === redBelow
   === 0.08`, so P15's "predictive" reserve never leads the ordinary Red transition
   under the default forecast. Options: leave (documented, pinned, honest) or raise
   `reserve.floorFractionOfBucket` above `redBelow` so the reserve stop fires first.
3. Legacy guard/installer findings from S-lane controls sdc-011/sdc-012 (pattern-route
   `.md` bypass; guard stand-down windows letting the new git grants reach the main
   session; unbounded `git push` grant) — registered here; disposition belongs to the
   activation bridge, which rebuilds `install.js`.

Nothing here claims readiness. The oracle's rule — no shadow while any confirmed
MAJOR/CRITICAL fail-open remains — still holds until item 1 is ruled.
