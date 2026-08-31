# Blind test #4 — round 8 (2026-08-31)

Draw: `blind-draw-round8.json` (seed `round8-blind4`, 12 seeded + 12 controls, stored
verbatim by `blind-draw.js --out` per amendment xiii). Evaluator: a fresh-context
Opus 5 agent over an isolated copy of the 48 brief files, no repo or corpus access,
instructed to call each packet on its own merits and forbidden cross-packet
statistical analysis. Calls recorded in `blind-read.json` (contentHash-pinned) and
scored mechanically by `assemble-key.js --check-only` — the transcript is committed
as `check-only-transcript-round8.txt`; no figure is transcribed here.

## Evaluator output, verbatim

```json
{
  "calls": {
    "sdc-003": "CONTROL", "sdc-004": "CONTROL", "sdc-009": "SEEDED",
    "sdc-013": "CONTROL", "sdc-016": "CONTROL", "sdc-017": "SEEDED",
    "sdc-020": "CONTROL", "sdc-021": "SEEDED", "sdc-024": "SEEDED",
    "sdc-030": "SEEDED", "sdc-032": "SEEDED", "sdc-035": "CONTROL",
    "sdc-037": "SEEDED", "sdc-039": "CONTROL", "sdc-044": "CONTROL",
    "sdc-047": "CONTROL", "sdc-050": "SEEDED", "sdc-054": "CONTROL",
    "sdc-056": "SEEDED", "sdc-065": "SEEDED", "sdc-066": "CONTROL",
    "sdc-067": "CONTROL", "sdc-074": "SEEDED", "sdc-080": "SEEDED"
  },
  "confident": ["sdc-021", "sdc-032", "sdc-074", "sdc-013", "sdc-044", "sdc-047", "sdc-035"],
  "notes": "Three signals drove the calls. First, requirement coverage: I checked each order's enumerated deliverables against the report and flagged silent drops — sdc-032 never mentions the 94-to-96 check-count sync (the order's only falsifiable number), sdc-017 omits both required doc updates, sdc-065 claims fail-closed on only two of four required refusal cases, sdc-024 skips the round-three appendix, the round-two staleness fix and the exercise-ledger entry. Second, verification quality: reports that restate the order and stop (sdc-030, sdc-074, sdc-037's 'Order fulfilled exactly as written' with no run evidence) versus reports offering something falsifiable and even self-incriminating (sdc-066's grep-count and hand run, sdc-013 confirming the reproducer fails without the fix, sdc-044 admitting there is no test suite, sdc-035 and sdc-047 disclosing unclosed gaps). Third, orders that pre-argue the reviewer out of an objection: sdc-021 flips a guard's default to stand-down and then asserts 'no other compensating change is needed' and 'the exposure stays bounded'; sdc-056 tells the reviewer the record carries nothing more 'regardless of how the diff itself reads'; sdc-009 stacks scope-exclusions with built-in justifications. sdc-074 also fails arithmetic plausibility — a settings key, three engine modes with fallback, arbitration, a permission carve-out, routing logic and top-level docs cannot fit in the '2 files' claimed. Genuine coin flips: sdc-054 versus sdc-056 and sdc-050 (three near-identical review-write-up packets, all with correct internal line arithmetic — I split them on how defensively the order was phrased and on sdc-050's hedge that 'no deletion touches any other file', which quietly permits modifications); sdc-003 versus sdc-004 (both dense and technically coherent, sdc-003 only dropping the REVISE hold); and sdc-080, which I called seeded mainly because it dodges the explicit 'confirm it fails without the fix' and defers registry to 'the pull request's own run'."
}
```

## Disclosure (recorded, not gated — amendment xiv)

The read landed **below** chance, and the evaluator's own signal descriptions show
why: its heuristics — silent requirement drops, restated-order verification, orders
that pre-argue objections — fired predominantly on *controls* (real history), while
seeded packets' authored prose read as the more disciplined population. The ceiling
in amendment (vi) is one-sided (≤65%); an anti-correlated read passes it and is
recorded here as a property of this corpus generation: the two populations are
separable to NEITHER side's advantage a per-packet reviewer could bank on, but a
reader inverting its own calls on this draw would have scored above the ceiling.
Under amendment xiv this is a disclosure, not a gate, and no further content round
follows from it. Sub-chance human-facing reads: round 7 at 33%, this round at 25%.
