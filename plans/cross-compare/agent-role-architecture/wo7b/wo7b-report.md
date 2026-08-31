# WO-7b — misroute recovery through the implemented router: PASSED

**Run:** 2026-08-30 · **Scored by:** `score.js` (mechanical, exit 0) against the gates
pre-registered in `corpus.json`, committed at `c431274` **before** any model pass ran.

## Verdict

| Gate (pre-registered) | Result |
|---|---|
| **G1 — recovery**: every seeded misroute caught by the receiving seat's charter filter | **PASS — 13/13** |
| **G2 — no gate crossing**: no misroute crosses a mandatory review, tier, or T3 gate | **PASS — 4 gate-relevant misroutes (M3, M5, M6, M12), 0 crossed**; tier-borne gates provably identical under seeded vs true dispatch for all 24 items |
| **G3 — hops**: ≤1 reclassification hop per order at P95 | **PASS — P95 = 1**; all 13 caught misroutes landed with a hop-1 ACCEPT; zero escalations |

Telemetry (non-gating): **0/11 false bounces** on controls; **13/13** recommended
classes matched the construction key; the fresh-context classifier pass agreed
**24/24 (100%)** with the construction key, including both reserved edges — **B horn**
(persisted-generated-output investigation: C2 accepted at I0 with zero hops, M1 caught
from N2 and landed at I0 in one hop) and **W horn** (values-only display change: C11
accepted at E2, M2 caught from E5 and landed at E2 in one hop) — each reported
separately above so the aggregate cannot hide a boundary.

## How it ran

24 synthetic items (13 seeded misroutes, 11 controls; true classes are authorial facts
of construction — the unused-history pools were exhausted, and the reserved edges never
occurred in real history). Each receiving seat's inbox — controls and misroutes mixed
where the seat had both — went to a fresh-context **Sonnet** agent holding only that
seat's charter (`router/charters.json`, transcribed from Part 2), the RECLASSIFY
protocol, and the 23-class vocabulary; no tools, no repo access, so the ~15-tool-call
triage budget is honored by construction. Every RECLASSIFY was processed by
`router.processReclassify()` (hop counted, pair ledgered, re-dispatched), and the
recommended seat's hop-1 agent triaged the re-dispatched order. Gate relevance in G2 is
computed by the router itself (`reviewPolicy`/`q0Required` under seeded vs true class),
not asserted by hand. Raw decisions: `results-hop0.json`, `results-hop1.json`,
`results-classifier.json` (verbatim agent outputs).

## Honest scope notes

- **The 100% classifier agreement measures this corpus's separability, not real-intake
  one-shot accuracy.** Synthetic items authored to have determinate classes are
  cleaner-cut than mined one-line history (where four probes measured 70–85%). Per the
  final ruling this number is telemetry; the shipping gate was recovery, and that is
  what passed.
- **The recovery entries in the per-pair ledger are seeded, not organic.** A successful
  seeded recovery is neither a residual ambiguity nor a scored cross-pass disagreement,
  so these 13 entries do **not** count toward the standing three-entry redraw/merge
  trigger; they are recorded here as probe provenance only.
- **The mid-order E4 discovery trump** (an executor discovering a persisted-data change
  mid-order) is not exercisable by an intake-filter probe; it remains covered by the
  WO-4 registry encoding and the router suite only, and will get live coverage during
  the shadow period (WO-15).
- All seats ran on one model (Sonnet) by design — the probe tests the charters'
  mechanical clarity, not any seat's cast model. An owner blind pass remains welcome as
  additional telemetry and gates nothing.
- The merge dividend held mechanically: an order addressed `I1` resolves to I0 and
  dispatches to the Investigator with zero hops (`tests/router.test.js`), and the
  B-horn control C2 — exactly the case the old I0/I1 boundary would have contested —
  was accepted without a hop.

## Consequence

The restated 7.2 routing gate — misroute recovery through the implemented router — is
**validated on this corpus**. The classification layer's stack is now: registry (WO-4,
fail-closed bijection) → Verifier substrate (WO-5) → router + charters + RECLASSIFY
recovery (WO-6) → this probe (WO-7b). WO-8–11 (band staffing) are unblocked; the
operator's one-pager (WO-18) additionally awaits WO-17's gates per the plan's
sequencing. Live misroute-recovery telemetry continues through §7.3 during shadow
(WO-15), where P95 is measured on real arrivals rather than a 24-item corpus.
