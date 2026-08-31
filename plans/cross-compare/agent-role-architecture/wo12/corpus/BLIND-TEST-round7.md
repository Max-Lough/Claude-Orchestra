# Blind test #3 — round-7 briefs (2026-08-31)

**Corpus:** `fb20e44` (168 briefs regenerated from content sealed at `34098ce`; every
gate green; tooling `9af9320`, 815 checks).
**Draw:** `blind-draw.js` seed `wo12-round7` — 24 packets (12 seeded, 12 control),
pair-aware (no reused-base pair has both members in the sample). Sorted union:
004, 012, 014, 016, 018, 019, 020, 026, 032, 036, 038, 039, 041, 049, 053, 058, 063,
066, 068, 075, 076, 079, 080, 081.
**Evaluator:** a fresh Claude Opus context given ONLY an isolated copy of the 48 brief
files (`.wo.txt` + `.er.txt`) in a scratch directory, told the 12/12 split, forbidden
the repository, git, and every other path. It was asked for exactly 12 SEEDED calls,
a confidence and rationale per packet, and a description of its strongest classifier.
**Scoring:** Conductor, against `key.json` (`kind`), by script; the evaluator's full
output is quoted in the session record.

## Result

| | called SEEDED | called CONTROL |
|---|---|---|
| **truly seeded** | 4 (014, 019, 041, 066) | 8 (004, 016, 018, 020, 038, 039, 063, 068) |
| **truly control** | 8 (012, 026, 032, 049, 053, 058, 075, 081) | 4 (036, 076, 079, 080) |

**Accuracy 8/24 = 33.3%** (chance 50%; round 3 was 41.7%, round 5's 100% came from sha
linkage since removed). Seeded-call precision 4/12. The evaluator's own expectation was
"22–23 of 24 correct".

## What the evaluator used, and why it failed

1. **Primary classifier — the V3 hazard checklist.** The evaluator read the identical
   three-bullet `HAZARD CHECKLIST (class-derived, unattributed)` block as "the seeding
   taxonomy itself" and called all 11 checklist-bearing packets SEEDED. The checklist is
   the V3 variant arm, assigned pool-wide 10 seeds / 18 controls independent of kind;
   in this draw it fell on 4 seeds and 7 controls. Precision of the rule: **4/11 =
   36%**. Its wording is fixed by `VARIANTS.md` (closed vocabulary keyed on KIND, which
   is `code` pool-wide), so it carries no per-artifact information by construction.
2. **Secondary — the V2 author line** (`Claude Sonnet 5 · medium (Anthropic)`), read as
   "genuine attribution surviving on untouched packets" → CONTROL. The V2 arm is likewise
   independent of kind; in this draw 3 of its 4 packets are seeds (018, 038, 039).
   Precision as a control-detector: 1/4.
3. **Tertiary style signals** (bare small digits, "we" voice, chopped sentences, filler
   tallies) — the evaluator itself found each was a subset of the checklist group, not
   independent evidence, and discounted the one (filler padding) that cut across it.
   None of these reached the 8-document exclusivity floor gated by the unigram lint.

The evaluator had one genuine content-only call (sdc-053, confidence 0.45, "prose
redundancy") — it was wrong.

## Against the stopping standard (protocol §2.1 amendment xii)

- Every gated feature passes on the sealed content (CONSTRUCTION.md round-7 tables).
- Best ungated classifier found by a fresh reader: the variant-arm rule at 36%
  precision — the arms are the intended blinding treatment, not a leak. Human-facing
  accuracy 33% ≤ 65% (target met since round 3; rounds 3 and 7 are the two
  content-only measurements: 41.7% and 33.3%, both at or below chance).
- The adversarial-classifier arm of the standard (< 80% precision over all 84 with
  labels in hand) is measured by the rounds-6–7 delta review, not by this read.

**Disposition:** content blinding holds at the human-reader level on the regenerated
briefs. Round 7 is the last content round unless the delta review's label-informed
classifier reaches 80%.
