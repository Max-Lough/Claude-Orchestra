<!-- R0 fallback same-family lane, Claude Opus 5, fresh context, READ-ONLY; scope 5c65946..044b85e (round 4: label-tell lint + label strip; round 5: symmetric bands, backticks forbidden, distribution lint, LIMITED identity gate, FINDINGS-only hits, exact adjudication coverage, fail-closed stop counter, override-ledger relocation, 83 of 84 content files re-authored, corpus re-sealed); rounds 4-5; verdict REVISE. -->

REVIEW ENGINE: Claude Opus 5 (R0 Anthropic lane, fresh context, tier: full)

**Lane / casting:** R0, Anthropic casting, Claude Opus 5, fresh context, read-only.
**Date:** 2026-08-31.
**Rounds:** 4 and 5 (delta review).
**Scope:** `5c65946..044b85e` — 40 commits. Round 4: protocol (ix), the
zero-tolerance label-tell lint, inline colon-labels stripped from 21 content
files. Round 5: protocol (x), symmetric author bands, backticks forbidden, the
five-gate distribution lint, `LIMITED` on gate 5, FINDINGS-only promotion
haystack, exact adjudication coverage, the fail-closed phase-0 stop counter, the
override ledger moved out of the repository, 83 of the 84 content files
re-authored, and `044b85e` re-sealing the corpus. Reviewed in a detached
worktree pinned at `044b85e`; every probe ran in `scratchpad/` temp directories.
Nothing in the live tree was modified except this record.

**CROSS-FAMILY DISCLOSURE — `review.cross_family=false`.** The artifacts under
review are Anthropic-authored and this reviewer is Anthropic. This is the
**fallback same-family lane**. Same-family review cannot supply the independence
the mandatory set assumes — read every finding below as correlated with the
author's own blind spots. The dispatcher sets `review.cross_family=false` on this
verdict. The cross-vendor attempt for the previous round
(`roster/wo12-r0-review-openai-4.md`) returned `REVIEW_UNAVAILABLE` on a
1800000 ms runner timeout and produced no findings, so no cross-vendor opinion
exists for rounds 3-5.

**Predecessor records:** `roster/wo12-r0-review-anthropic-3.md` (REVISE, 0
CRITICAL / 5 MAJOR / 5 MINOR, and 18 prior findings it had already ruled),
`roster/wo12-r0-review-openai-3.md` (closed in the round-3 record) and
`roster/wo12-r0-review-openai-4.md` (no findings — timed out). **11 open items
carried in; every one ruled below.**

---

# VERDICT: REVISE

**1 CRITICAL · 4 MAJOR · 6 MINOR.**

Rounds 4 and 5 are the most disciplined work in this series. Every one of the
round-3 record's five MAJORs was attacked at the named line, four of them
completely, and this time the authors also went looking for the adjacent path
themselves: the promotion haystack moved off raw stdout, the coverage predicate
became exact equality, the stop counter throws instead of returning zero, and
the identity gate grew a fourth status rather than decorating a PASS. The suite
grew from 533 to 642 checks and all ten suites are green. The corpus is now
**better blinded to a human reader than at any prior round** — a fresh
evaluator given twelve packets scored 33.3% precision, 33.3% recall, **below
chance**, against 83% in round 2 and 50% in round 3.

What blocks is the same shape as last round, and I want to be precise about why
that is not a rhetorical flourish: **each fix was applied to the statistic or
the string the finding named, and the defect survives one level down.**

- The **means** were gated in round 3, so the tell moved to the **ranges**. The
  ranges were gated in round 5, so the tell moved to **sentence shape** — a
  dimension no gate measures. The shortest sentence in a packet separates the
  populations at Cohen's d = **−1.80**; `minSent ≥ 14` is 26 artifacts and
  **all 26 are controls**; a style-only classifier using no topic vocabulary and
  no digits reaches **90.0% precision / 90.0% recall under leave-one-out CV**
  (MAJOR 1).
- The **3-gram** exclusivity gate passes with zero violations. **Unigram**
  exclusivity, ungated, is much stronger: `deletions` 0 seeds / 13 controls,
  `confirm` 0/12, `else` 0/12, `insertions` 0/11, `touching` 0/10, `protocol`
  8/0 (MAJOR 2). `else` is the residue of the very idiom round 5 deleted.
- Two corpus oracles are disclosed in `CONSTRUCTION.md`; a third, stronger and
  undisclosed one is in every brief. **54/54 control head commits resolve in the
  repository; 0/30 seeded heads do.** One `git cat-file -t` labels the whole
  corpus at 100%/100% (MAJOR 3).
- The promotion haystack moved from raw stdout to `extractFindingsSection`,
  which **swallows every section header it does not know**. I minted a
  mechanical HIT on `sdc-061` from a bullet under a `VERIFICATION RE-RUN`
  heading, and another from the runner's own `ATTEMPT LOG` (MAJOR 4).
- Gate 5 correctly reads `LIMITED` on a plain echoed header — MAJOR 2 of round 3
  is genuinely closed. But `identityEvidence` decides `independent` on a **bare
  substring**, so `REVIEW ENGINE: gpt-5.6-terra (served_model not reported)`
  reads PASS; and when a served model *is* present on that line and contradicts
  the request, `classifyIdentity` short-circuits to MATCHED before reading it —
  `REVIEW ENGINE: gpt-5.6-terra (served_model: claude-opus-5)` certifies **gate 5
  PASS on a lane served by the flagship** (CRITICAL 1).

---

## CLOSURE TABLE — Anthropic round 3 (`wo12-r0-review-anthropic-3.md`)

### MAJOR

| # | Finding | Ruling | Fix + the test I RAN |
|---|---|---|---|
| M1 | `assemble-key.js:797-838` — the balance lint gates three MEANS; the tell lives in the tails and the vocabulary (7 rules, 25 seeds, 100% precision) | **PARTIALLY CLOSED** | `distributionLint` (`assemble-key.js:1075-1210`), five gates, hard failure, run at `:2050` before the first write. **Every one of the seven round-3 rules is dead, verified independently on all 84 `content/*.json` against `key.json`:** ORDER floors 136 vs 135 (Δ1), ceilings 159 vs 160 (Δ1), sd ratio 1.06; CLAIMS floors 66/65, ceilings 90/95, sd ratio 0.68; **backticks 0 of 84**; hardness ranges now overlap (seeded 1–3, control 2–3); "leave … alone" and "and nothing else" **0/0 in both**; digit density Δ0.85 ≤ 1.5; **zero 3-grams exclusive at df ≥ 6**, and the 8 in the reported 4–5 band reproduce CONSTRUCTION.md's table **exactly, name for name**. The disjunction that scored 25S/0C in round 3 now fires on **nothing**. **But the same defect survives one level down — NEW MAJOR 1 and MAJOR 2.** |
| M2 | `score.js:1018-1022` — gate 5's status is PASS on evidence the protocol calls insufficient | **CLOSED** | `status5` (`score.js:1090-1097`) adds `LIMITED`; `overall` propagates it (`:1136`); `identityEvidence` is now emitted on the item itself; `buildReport` prints a four-line explanation (`:1432-1438`). **Ran it**: 84-artifact healthy corpus, X-Terra headers `REVIEW ENGINE: gpt-5.6-terra` → item 5 **`LIMITED`**, `item.identityEvidence='echoed-request'`, and `overall` is no longer PASS. The round-3 counterexample is gone. **A new bypass of this exact status — CRITICAL 1.** |
| M3 | `score.js citesLocatorFile` — the deleted `exact-path` suffix tier is alive on the adjudication path; no severity floor; the haystack is the whole transcript | **PARTIALLY CLOSED (3 of 3 named sub-defects fixed; the replacement haystack is too wide)** | (1) The substring fallback is deleted (`citesLocatorFile`, `score.js:743-760`). **Verified**: `citesLocatorFile('[MINOR] codex/hooks/orchestra-guard.js:12 — pack copy stale','hooks/orchestra-guard.js')` → **`false`** (was `true`); a bare unnumbered path → `false`; a correct citation → `true`. (2) A severity floor now applies to promotions (`:693-702`), matching `evaluateSeedHit`'s rule exactly (both require *a* `CRITICAL/MAJOR/MINOR` tag). (3) `verdictText: last.stdout` is replaced by `findingsText` (`:573`). **But `extractFindingsSection` is not the FINDINGS section — NEW MAJOR 4.** |
| M4 | `score.js:930-940` — gate 3's coverage test is an unbounded bidirectional substring match; `finding:"js:"` covers three blockers and returns PASS at 0% | **CLOSED** | `score.js:991-1000`: exact normalized equality plus the 20-char floor. **Ran the exact round-3 reproducer** on one control carrying three blocker findings, against the real `key.json`: `finding:"js:"` → **INCOMPLETE**, *"3 MAJOR/CRITICAL finding(s) … have no adjudication entry"*; a 53-character proper substring of finding #1 → **INCOMPLETE**; one exact entry → **INCOMPLETE (2 of 3 uncovered)**; all three exact → PASS. The three-character bypass is dead. **A liveness edge remains — MINOR 1.** |
| M5 | `run-lane.js:668` — `countUnavailableOnDisk` swallows the read error; an unreadable sibling file counts as ZERO and disarms the §2.6 halt | **CLOSED** | `run-lane.js:670-687` throws `wo12ResultsCorrupt` instead of returning `[]`; `main()`'s top-level catch turns it into `fail()`, exit 1. **Ran the round-3 reproducer**: healthy X-Sol with 4 final UNAVAILABLE → count 4, breach true; the **same file truncated to 70%** → **throws**, *"refusing to evaluate the §2.6 phase-0 stop condition … an unreadable file is not evidence of zero failures"*; a JSON object instead of an array → throws; a **missing** file → count 0, no throw (correct — absent is not corrupt). |

### MINOR

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| m1 | amendment (vi)'s blind-classification acceptance test is not recorded in `CONSTRUCTION.md` | **NOT CLOSED (mechanism added, evidence absent — and honestly declared)** | `CONSTRUCTION.md:253-263` now has an "Amendment (vi) — blind-classification record" section that renders from `corpus/blind-read.json` when present. At `044b85e` that file does not exist and the section reads **"NOT RECORDED."** Protocol (ix) also requires *"a second blind test on a different 24-id draw … recorded before any pass"*; `corpus/` at the pinned commit holds only `BLIND-TEST-round3.md`. I ran the test myself (TELLS below: 33.3%, below chance), so the substance is met twice over — but the pre-registered evidence is still missing from the artifact that exists to carry it. Uncommitted work toward this exists in the live tree (`blind-draw.js`, a round-5 blind record) and is outside this scope. |
| m2 | `score.js:900` — `gate12f` throws a raw `TypeError` on a truthy non-array adjudication | **CLOSED** | `score.js:856-867` validates and throws a named error. **Verified**: `gate12f(scored, key, {a:1}, ex)` → *"gate12f: `adjudication` must be an array or null/undefined (got object)"*, `err.wo12BadAdjudication === true`; a string throws the same; `null` still runs and yields INCOMPLETE. |
| m3 | `build-corpus.js:248-279` — `isCaseInsensitiveFs` over-refuses when no ancestor basename has a letter to swap | **CLOSED** | `build-corpus.js:275-292`: before the fail-closed default, a **write probe** creates `.wo12-case-probe-Aa<pid><rand>` in the probed directory and stats the case-swapped spelling, removing it in a `finally`. A write failure falls through to the old default. Clean, self-cleaning, and it only narrows the over-refusal. |
| m4 | `countUnavailableOnDisk` counts a record whose *last* attempt is unavailable, not one whose retry is spent; §2.6 says ">2 **final**" | **CLOSED, with a new hole** | `run-lane.js:688-706` requires `attempts.length >= 2` and reports the rest as `pending`. The code and the protocol now say the same thing, and `run-lane.js:1058-1062` always dispatches the §2.5 retry inline before `appendResult`, so a run-lane-written record is never single-attempt. **But `pending` can never halt — MINOR 2.** |
| m5 | `tests/wo12-tooling.test.js:1651-1652` — the check's name overstates its assertion | **NOT CLOSED (third round)** | Now `tests/wo12-tooling.test.js:1706-1707`. The name still claims *"no RUN ORDER block, no runner command"*; the assertion is still only `!/DRY RUN — nothing executed/.test(...)`. The behaviour remains correct; the test still does not pin what it says. Carried to NITS. |

## CLOSURE TABLE — items carried forward through round 3

| # | Item | Ruling | Evidence |
|---|---|---|---|
| A-m5 (r2) | the `corpus/` directory is an oracle: `.patch` + `.seed.json` for exactly the 30 seeded ids; contiguous seeded id blocks | **CLOSED AS DISCLOSURE** | `CONSTRUCTION.md` now carries "### The corpus directory is an oracle — and it is out of every lane's reach", naming both the file oracle and the `001-006 / 013-020 / 037-044 / 061-068` blocks, and listing the five assertions `sanitizeClone()` makes. That is the right resolution for something that cannot be removed without moving the corpus off disk. **The same reasoning was not applied to a third, stronger oracle — NEW MAJOR 3.** |
| r3 NIT | `populationBalanceLint` returns means but not the ranges/sd it already has | **CLOSED** | `distributionLint` returns `report.fields[label].{seeded,control,sdRatio}` with full `statsOf` records, and `CONSTRUCTION.md`'s "(1) Word-count ranges and dispersion" table prints min/max/sd/Δ/ratio per field. |
| r3 NIT | the hardness proxy counts `only`; the 1.0016 ratio deserves a sensitivity check with `only` removed | **CLOSED** | `hardnessScoreStrict` / `HARDNESS_TERMS_STRICT_RE` (`assemble-key.js:174-184`), gated on the same 0.8–1.25 band (`:931-946`) and printed as its own row in `CONSTRUCTION.md`. I recomputed both: headline 2.40 vs 2.37 (ratio 1.01), `only`-free **1.83 vs 1.76 (ratio 1.04)** — the parity is not carried by `only`. |
| r3 NIT | `VERSION` still 2.3.0, its CHANGELOG entry amended in place | **NOT CLOSED** | `VERSION` at `044b85e` is `2.3.0`; the entry now describes five sealed states of one corpus. Still defensible for an unreleased version. Carried to NITS. |
| r3 NIT | `run-lane.js:141-148` mirrors `orchestra-review.js`'s retry/margin defaults | **NOT CLOSED** | `RUNNER_OWN_RETRIES = 1` / `OUTER_MARGIN_MS = 180000` at `run-lane.js:147-148`, still a second copy. Carried from rounds 1, 2 and 3. |
| r3 NIT | cross-machine reproducibility is unprovable on one machine | **NOT CLOSED (unfalsifiable here)** | Unchanged. |

### Closure counts

**16 items ruled. 9 CLOSED · 3 PARTIALLY CLOSED · 4 NOT CLOSED.**
Of the round-3 record's ten findings specifically: **6 CLOSED, 2 PARTIALLY
CLOSED, 2 NOT CLOSED.** Every MAJOR was attacked at the line it named and none
of the named reproducers still fires.

---

## NEW FINDINGS

### CRITICAL

**[CRITICAL 1] `score.js:452-465` (`classifyIdentity`) + `score.js:491-496` (`identityEvidence`) + `run-lane.js extractEngineHeader` — the `LIMITED` status added this round is decided by a bare substring, and the one configuration §3.1 item 5 exists to catch reads PASS. A lane served by `claude-opus-5`, with the runner reporting exactly that, certifies "exact model identity on every counted X-Terra run" as PASS.**

```js
function identityEvidence(engineHeader, expectedModel) {
  if (!engineHeader) return 'none';
  if (/\bserved[_ ]model\b/i.test(engineHeader)) return 'independent';   // <-- the WORD, not the FIELD
  ...
}
function classifyIdentity(engineHeader, expectedModel) {
  ...
  if (namesModel(engineHeader, expectedModel)) return 'MATCHED';         // <-- :459, before the served value is read
  const served = extractServedModel(engineHeader);                       // <-- :460, never reached
```

Gate 5's new status is `echoed && !independent ? 'LIMITED' : 'PASS'`. Three
things go wrong, all exercised against the real `key.json` with `run-lane.js`'s
own `extractEngineHeader`:

```
header                                                        extractEngine    classifyIdentity  extractServedModel  evidence     gate 5
REVIEW ENGINE: gpt-5.6-terra                                  (the line)       MATCHED           gpt-5.6-terra       echoed       LIMITED   correct
REVIEW ENGINE: gpt-5.6-terra (served_model not reported)      (the line)       MATCHED           "gpt-5.6-terra (…)" independent  PASS      (a)
REVIEW ENGINE: gpt-5.6-terra (served_model: claude-opus-5)    (the line)       MATCHED           claude-opus-5       independent  PASS      (b)
REVIEW ENGINE: gpt-5.6-terra \n served_model: claude-opus-5   REVIEW line only MATCHED           gpt-5.6-terra       echoed       LIMITED   (c)
```

**(a) The escape is a disclaimer.** Any header containing the phrase
`served_model` or `served model` — including a header that exists precisely to
*deny* independent evidence — is classified `independent` and lifts gate 5 to
PASS. The predicate tests for the token, never for a parsed field with a value.

**(b) The one case the gate exists for.** With a genuine served model on the
same line, contradicting the request, `extractServedModel` **correctly** returns
`claude-opus-5` — and `classifyIdentity` never asks, because line 459 already
returned MATCHED on the `REVIEW ENGINE:` half of the same string. Identity
MATCHED, `stillWrong` empty, evidence `independent`, **gate 5 PASS, `overall`
PASS-eligible**. This is `roster/wo12-r0-review-openai-3.md`'s CRITICAL at
`score.js:427` — *"exact served-model identity compares against an echo of the
request"* — alive on the branch round 5 just made load-bearing. Round 4 was
merely uninformative here; round 5 makes the wrong answer *authoritative*,
because `independent` is now the thing that certifies the gate.

**(c) The protocol's own remedy cannot reach the good branch.** Amendment (viii)
registers exactly one fix: *"`packs/codex/hooks/orchestra-review.js` … surface a
vendor-reported served model."* The obvious implementation is a separate
`served_model:` line. `run-lane.js`'s `extractEngineHeader` returns **only** the
`REVIEW ENGINE:` line whenever one exists, so that line is discarded before
`score.js` ever sees it and gate 5 stays `LIMITED` for ever. The only shape that
reaches `independent` is one that also echoes the request — i.e. exactly the
shape (b) mis-certifies.

This is CRITICAL by §2.3's own rubric: a silently wrong result on a load-bearing
path, on the gate whose entire purpose is to prove the qualification run was
served by the model being qualified. Fixes: read the served value before the
echo (`const served = extractServedModel(...); if (served && !namesModel(served,
expected)) return 'MISMATCHED';` ahead of line 459); make `independent` require
a parsed `served_model: <value>` field, not the token; and teach
`extractEngineHeader` to carry a `served_model` line alongside the
`REVIEW ENGINE` line so (viii)'s remedy can actually land.

### MAJOR

**[MAJOR 1] `assemble-key.js:1084-1106` — the distribution lint gates ORDER/CLAIMS word TOTALS (floor, ceiling, sd). It measures nothing about how those words are divided into sentences, and that is where the whole separation now lives. The shortest sentence in a packet separates the populations at d = −1.80; `minSent ≥ 14` is 26 artifacts and all 26 are controls. A style-only classifier — no topic vocabulary, no digits — reaches 90.0% precision / 90.0% recall / 92.9% accuracy under leave-one-out CV, against a 64.3% base rate.**

Recomputed independently over all 84 `corpus/content/*.json` against `key.json`
with my own splitter (full table in DISTRIBUTIONAL ANALYSIS). The gated
quantities are in excellent shape. The ungated sentence-level ones are not:

```
feature                        seeded (n=30)          control (n=54)          Cohen d
shortest sentence (words)      5.60 ± 3.06 [ 1–13]    12.50 ± 4.18 [ 4–21]     -1.80
sentences in CLAIMS            4.17 ± 0.91 [ 2– 6]     3.13 ± 0.70 [ 2– 5]     +1.32
mean sentence length, CLAIMS  19.97 ± 4.40           25.95 ± 6.10             -1.08
"and" per packet              11.17 ± 3.29 [ 6–18]     7.24 ± 2.61 [ 2–12]     +1.37
CLAIMS hardness                0.37 ± 0.61             1.30 ± 1.11             -0.96
sentences (total)              9.60 ± 1.35             8.41 ± 1.41             +0.86
```

The mechanism is visible the moment you print the shortest sentence of each
packet. The seeds are written in a punchy register that lands a short emphatic
sentence; the controls are written in long measured ones:

```
 1 sdc-003 seeded   "Done."          1 sdc-017 seeded  "Done."
 1 sdc-040 seeded   "Done."          1 sdc-063 seeded  "Done."
 2 sdc-018 seeded   "All green."     3 sdc-002 seeded  "That fabricates load."
 3 sdc-020 seeded   "Make recon two-tier."
...
17 sdc-050 control  "The two pinned commits are cited as that specific pair rather than folded …"
18 sdc-069 control  "Preserve the verdict verbatim, together with its dispositions, in a dedicated …"
21 sdc-074 control  "Update the review-routing logic to honor the setting and document the key …"
```

`"Done."` appears in **4 seeded packets and 0 controls**. Of the 26 artifacts
whose shortest sentence is ≤ 6 words, **22 are seeded**. Of the 26 whose
shortest sentence is ≥ 14 words, **all 26 are controls**. Measured on all 84:

```
rule                          fires   S/C      precision   coverage
minSent >= 14  -> CONTROL       26    0S/26C    100.0%     48% of controls
minSent <=  3  -> SEEDED         7    7S/ 0C    100.0%     23% of seeds
minSent <=  8  -> SEEDED        35   26S/ 9C     74.3%     87% of seeds   (single-feature accuracy 84.5%)
"and" >= 13    -> SEEDED         8    8S/ 0C    100.0%     27% of seeds
CLAIMS hardness >= 3 -> CONTROL  6    0S/ 6C    100.0%     11% of controls
mean CLAIMS sentence >= 33.5 -> CONTROL 7  0S/7C 100.0%    13% of controls
```

**The word budgets are balanced to a single word at both ends; the sentence
budgets are not balanced at all.** Both populations spend 135–160 ORDER words —
the seeds spend them on 9.6 sentences, the controls on 8.4, and the seeds always
include a very short one. That is a pure authorship-style artifact, not topic:
it survives with every topic word, every digit and every named symbol removed
(the style-only model below uses only sentence counts, sentence lengths,
connective and punctuation density).

**My best classifier, honestly cross-validated** (leave-one-out, refit 84 times,
logistic regression, 11 features, none of them a topic word and none of them a
digit — `minSent, mslC, nsC, and, commaD, hardC, emdash, semi, ns, mslO,
sdSent`):

```
STYLE-ONLY, LOO-CV:  TP 27  FP 3  FN 3  TN 51
                     precision 90.0%   recall 90.0%   accuracy 92.9%   (base rate 64.3%)
```

Adding digit density and the two verification-vocabulary features gives 92.3% /
80.0% / 90.5% LOO-CV. A hand-built decision list of six 100%-precision seeded
rules fires on **17 artifacts, 17 seeded and 0 control — precision 100.0%,
recall 56.7%**, and its mirror (seven control rules) fires on 40, 39 of them
control.

**Honest limits, stated.** §2.4's fresh-context rule means a review lane sees
one packet and cannot fit a threshold in situ, and `CONSTRUCTION.md` is
unreachable from a sanitized run clone — I re-checked. Two of the six seeded
rules (`minSent ≤ 3`, `and ≥ 13`) are absolute thresholds a reader **could**
carry in from outside, and one of them is legible without arithmetic at all
("this order contains a three-word emphatic sentence"); the blind evaluator did
not find it, which is the honest counter-evidence and why this is MAJOR rather
than CRITICAL. But it is the third consecutive round in which the corpus is more
separable by a deterministic oracle than the version that was rejected, and the
remedy is not a seventh gate on a new statistic. It is to make the lint compare
the two populations on a **family** of derived features rather than a list —
sentence count, sentence-length quantiles (min especially), and per-token
frequency — and fail on any feature whose ranges are disjoint at either end,
which is the same shape of test that would have caught the round-3 tails and the
round-5 sentences alike.

**[MAJOR 2] `assemble-key.js:1133-1175` — the n-gram exclusivity gate looks only at 3-grams at document frequency ≥ 6. UNIGRAM exclusivity is ungated and much stronger: six words are carried by 8–13 documents of one population and zero of the other, where no 3-gram reaches the threshold at all. One of them is the residue of the idiom round 5 removed.**

Recomputed on all 84 with the lint's own stopword list and content-word rule:

```
gated       3-grams exclusive at df >= 6 :  0        <- the gate passes
reported    3-grams exclusive at df 4-5  :  8        <- matches CONSTRUCTION.md name for name
UNGATED     2-grams exclusive at df >= 6 : 13   ("this pass" 9C, "insertions and" 8C, "exactly one" 7C, …)
UNGATED     unigrams exclusive at df >= 8:  9
```

```
token          docs   S/C     token          docs   S/C
deletions       13   0S/13C   protocol        8    8S/0C
confirm         12   0S/12C   follow-on       8    0S/8C
else            12   0S/12C   redraw          8    0S/8C
insertions      11   0S/11C   md              8    0S/8C
touching        10   0S/10C
```

Each is a single-brief-visible lexical rule at 100% precision, exactly the class
of tell the gate was written for — `assemble-key.js:1133` calls it *"an
authorship fingerprint, whatever the means say"*. The 3-gram scoping in
amendment (x) was retuned **down** to df ≥ 6 with ≥ 2 content words to avoid
firing on subject matter, and the retune left the strongest evidence outside the
window: a habit that varies its phrasing (`"50 insertions and 31 deletions"` /
`"a substantial batch of insertions and far fewer deletions"` / `"82 insertions
and six deletions"`) never produces a shared 3-gram but produces a rock-solid
shared unigram.

**`else` is the specific proof that the round-5 idiom fix was a string edit, not
a habit fix.** The lint gates the literal `and nothing else`, and it is now 0/0
in both populations — pass. The habit it stood for is untouched: `with nothing
else touched` (sdc-023), `nowhere else` (sdc-009, sdc-051), `anything else`
(sdc-012, sdc-054), `anywhere else` (sdc-021, sdc-052) — **12 controls, 0
seeds**, and `"with nothing else"` still shows up as a control-exclusive 3-gram
in the reported 4–5 band. The five watched idioms are a hand-written list; the
population-exclusivity test that could have found this generically is scoped to
a window that excludes it.

Fix: run the same exclusivity test over unigrams and bigrams (the stopword list
already exists), or better, replace the five hand-written idioms with "any token
or bigram whose document frequency is ≥ N in one population and 0 in the other",
reported at 4–5 and failed at 6+, exactly as the 3-gram rule already does.

**[MAJOR 3] `corpus/briefs/*.wo.txt` — the head commit hash printed in every packet is a perfect, undisclosed oracle. 54 of 54 control heads resolve in the repository; 0 of 30 seeded heads do. `git cat-file -t <head>` labels the entire corpus at 100% precision and 100% recall.**

Every brief opens with the same three lines:

```
Change under review: commit <head sha>
Base (its parent):   <parent sha>
Commit subject:      <subject>
```

Measured across all 84 briefs against the real repository:

```
                       head resolves    parent resolves
seeded  (n=30)            0 / 30            30 / 30
control (n=54)           54 / 54            54 / 54
exceptions to "control <=> head is a real commit":  NONE
```

The cause is structural: only the 30 seeded ids have a `.patch`, so only they
are re-materialized as a fresh commit `C'`. The 54 controls ship the **real**
commit `C` unmodified, so their head sha is a live object in the repository and
their parent is its true parent. A single `git cat-file -t` (or
`git merge-base --is-ancestor <head> main`) per brief solves the corpus with
certainty — no prose, no statistics, no threshold.

This is the same *class* as the two oracles `CONSTRUCTION.md` already discloses
(the `.patch` directory listing, the base/subject collisions), and it is
strictly stronger than either: the directory oracle needs the corpus directory,
the collision oracle covers 20 of 84, and this one needs only the public
repository and covers all 84. It is also the only one of the three that is
**nowhere disclosed** — the collision section says the reused pairs "carry an
identical `Base` sha and an identical `Commit subject:` with different heads"
and stops there, never noting that one of the two heads is real and the other is
not.

The blind evaluator found it unprompted and called it *"a fatal hole in the
blinding scheme, independent of me: if real commits are ancestors of `main` and
seeded ones are not, one `git merge-base --is-ancestor` per item solves all 12
with certainty. The prohibition on running git is doing all the work."* Its own
two highest-confidence calls (both correct) rested on it.

Reachability, stated honestly: a lane running in a properly sanitized run clone
cannot perform the test — inside that clone the artifact's own head resolves by
construction, and `sanitizeClone()` asserts the corpus is unreachable. So this
is out of a compliant lane's hands, like A-m5, and that is why it is MAJOR and
not CRITICAL. But it is in the hands of the adjudicator, the scorer, the
operator, any lane whose sandbox is imperfect, and any engine with the public
repository in reach — and unlike the other two it is not written down anywhere.

Two remedies, either sufficient: re-materialize **all 84** artifacts through the
patch pipeline (a control's patch is empty, its `C'` is a fresh commit with the
real author/committer/dates per amendment (i)), which kills this oracle **and**
A-m5's `.patch`-count oracle in one move; or, if that is too expensive, disclose
it in `CONSTRUCTION.md` beside the other two, in the same words.

**[MAJOR 4] `score.js:122-134` `extractFindingsSection` — the FINDINGS window ends only at `CLAIMS CHECKED` or `NITS`. Every other section header is swallowed. MAJOR 3's fix ("the haystack is the FINDINGS SECTION, never the raw transcript") does not hold, and this reaches MECHANICAL hits, not only promotions.**

```js
const FINDINGS_END_HEADERS = /^#*\s*(CLAIMS CHECKED|NITS)\s*:?\s*$/i;
...
let end = lines.length;                               // <-- no terminator found: run to EOF
for (let j = start; j < lines.length; j++) {
  if (FINDINGS_END_HEADERS.test(lines[j].trim())) { end = j; break; }
}
```

Two reachable shapes, both exercised against the real `key.json`:

*Intervening header.* A verdict with `FINDINGS`, then `VERIFICATION RE-RUN`,
then `CLAIMS CHECKED` yields a "findings section" containing the whole
VERIFICATION block. I planted a `[MINOR]` bullet citing `sdc-061`'s locator
(`hooks/orchestra-guard.js:339`) under `VERIFICATION RE-RUN`, in a verdict whose
FINDINGS section reads `- none.`:

```
FINDINGS
- none.

VERIFICATION RE-RUN
- [MINOR] hooks/orchestra-guard.js:339 — I looked at the marker block while re-running and it seemed fine to me.

mechanical hit on sdc-061 (a MAJOR CV seed): TRUE
```

No adjudication involved. A reviewer who filed **no findings at all** and merely
mentioned the file while describing its own verification is credited with the
seed — inflating recall, every Wilson interval, and gate 1, whose entire margin
is ±1. Section headers like `VERIFICATION`, `EVIDENCE`, `CLOSURE TABLE`,
`DISTRIBUTIONAL ANALYSIS` and `SUMMARY` are ordinary in real R0 records
(including this one).

*No terminator at all.* A verdict with `FINDINGS` and no `CLAIMS CHECKED`/`NITS`
runs to end of transcript — which for a crashed run includes the runner's own
`--- ATTEMPT LOG ---` block and the codex stderr tail it embeds. That tail is
literally source-code excerpts with line numbers
(`roster/wo12-r0-review-openai-4.md` shows `749: * anywhere – including reviewer
prose about the diff –` and 24 more such lines). I minted a `sdc-061` hit from
an ATTEMPT LOG in the same way. This is round-3 MAJOR 3's third sub-defect — *"the
haystack is the whole transcript"* — surviving on the adjacent path, and it now
governs the mechanical scorer, not just promotions.

Fix: end the section at **any** header-shaped line (`^#{1,6}\s+\S` or a bare
ALL-CAPS/Title-Case line with no trailing prose), not at two named ones; and
refuse to treat anything after a runner delimiter (`--- ATTEMPT LOG`,
`FINALITY:`) as verdict text at all.

### MINOR

- **[MINOR 1] `score.js:991-1000` — a blocker finding shorter than 20 normalized characters can never be adjudicated, so gate 3 is permanently INCOMPLETE with no operator remedy.** Coverage is `t === f && t.length >= MIN_ADJUDICATION_QUOTE_CHARS`, applied to the *entry* text, which must equal the finding exactly. Verified: a control whose verdict carries `- [MAJOR] a.js:1 — b` (18 chars normalized) stays INCOMPLETE with the exact entry, and stays INCOMPLETE when the entry is padded, because `normalizeWhitespace` trims the padding back. The direction is fail-closed, which is right, but a hard qualification gate with an unreachable satisfying assignment is a liveness defect. Compounding it: the "needs adjudication" list prints `f.slice(0, 70)`, so the operator is shown a truncated string they must not copy. Apply the floor to the *finding*, not the entry (a short finding needs no floor to be unambiguous), and print the full text the entry must match.
- **[MINOR 2] `run-lane.js:697-704` — the `pending` bucket is computed, named and displayed, and can never halt anything.** The breach test is `perLane[l].count > PHASE0_MAX_UNAVAILABLE`; `pending` appears only inside the message printed once `count` has already breached. Verified: 84 single-attempt final-UNAVAILABLE records on X-Sol → `count 0, pending 84, breach false`. `run-lane.js` itself always dispatches the §2.5 retry inline before `appendResult`, so it cannot produce such a file — but a hand-repaired file, an externally-produced one, or a future runner that honours its own `FINALITY:` and skips the retry would be invisible to the §2.6 halt. At minimum, breach on `count + pending` with the two named separately.
- **[MINOR 3] `run-lane.js:1008` — `--override-log` takes any path, unvalidated, and `appendOverrideLog` creates the parent directories.** Verified: `--override-log ../../../evil.log` parses, and `appendOverrideLog` `mkdir -p`s a nested path that did not exist. The round-5 change exists because a fixed `path.join(HERE, …)` left an untracked `wo12/p0-overrides.log` in the repository after an interrupted run; one flag re-creates exactly that. It is owner-only and behind `--yes`, so it is MINOR — but the ledger should be refused when it resolves inside the source repository, which is the property the fix was actually after.
- **[MINOR 4] `score.js loadKey` still does not validate artifact ids** (`ARTIFACT_ID_RE` / `assertSafeArtifactId` appear nowhere in `score.js`), while `build-corpus.js:767` validates every id in the same file. Carried unchanged from round 3. `score.js` joins no id into a path so nothing is exploitable; `build-corpus.js`'s `--id` **is** safe — verified, it is looked up in the validated key at `:792` before any path is built.
- **[MINOR 5] the label-tell lint is not zero-tolerance, and `CONSTRUCTION.md` says it is.** `LABEL_RE` anchors only at a line start or after sentence-ending punctuation, caps the label at 4 words and 24 characters, and allows only `[A-Za-z -]`. Verified escapes: after a comma, after a semicolon, after an em dash, a five-word label, a label containing a digit, a label over 24 characters. Scanning the sealed corpus for *any* capitalized phrase immediately followed by a colon finds **14 survivors** — `"P0 substrate:"` (sdc-009), `"Scope is exactly two changes:"` (sdc-034), `"Windows is the reason this exists:"` (sdc-037), `"Windows:"` (sdc-068), `"Adopt the process change going forward:"` (sdc-069) and nine more. They are natural clause-introducing colons and they are balanced (7 seeded / 7 control; colon counts 0.70 vs 0.57 per packet, d = 0.13), so this is **not** a live tell — but `CONSTRUCTION.md`'s "**No inline labels in any content file.** (This table is empty in every corpus that assembles — a non-empty one would have failed the lint.)" is a stronger claim than the lint supports, and the em-dash case is where a real label would most naturally hide in prose this dash-heavy (control mean 1.93 em dashes, max 6).
- **[MINOR 6] amendment (x)'s text and `distributionLint` disagree in one place.** (x) describes the idiom gate as *"a per-population frequency ratio outside 0.5–2.0"*. The code (`:1187-1191`) additionally fails when an idiom is present in one population and **absent** from the other, where no ratio exists. The code is right and the protocol should say so; as written, the strictest arm of the gate is undocumented.

---

## DISTRIBUTIONAL ANALYSIS

**Reproduction of `CONSTRUCTION.md`.** Recomputed from `corpus/content/*.json` +
`key.json` with my own word splitter, my own trigram extractor and the
protocol's hardness regexes. **Every published figure reproduces to the printed
digit, including the n-gram table name for name.**

| statistic | `CONSTRUCTION.md` | my recomputation |
|---|---|---|
| seeded order words | 150.5 ± 7.3 (n=30, 136–159) | 150.47 ± 7.33 (136–159) |
| control order words | 146.8 ± 6.9 (n=54, 135–160) | 146.81 ± 6.90 (135–160) |
| seeded claims words | 79.5 ± 5.4 (n=30, 66–90) | 79.53 ± 5.42 (66–90) |
| control claims words | 77.6 ± 7.9 (n=54, 65–95) | 77.57 ± 7.93 (65–95) |
| seeded / control ORDER hardness | 2.4 ± 0.6 (1–3) / 2.4 ± 0.5 (2–3) | 2.40 ± 0.62 (1–3) / 2.37 ± 0.49 (2–3) |
| gate: Δmean order / claims / ratio / `only`-free ratio | 3.7 / 2.0 / 1.01 / 1.04 | 3.65 / 1.96 / 1.01 / 1.04 |
| ORDER floor Δ / ceiling Δ / sd ratio | 1 / 1 / 1.06 | 1 / 1 / 1.06 |
| CLAIMS floor Δ / ceiling Δ / sd ratio | 1 / 5 / 0.68 | 1 / 5 / 0.68 |
| digit density seeded / control / Δ | 2.10 / 1.25 / 0.85 | 2.10 ± 1.98 / 1.25 ± 0.87 / 0.85 |
| backticks | 0 files | **0 of 84** |
| 3-grams exclusive at df ≥ 6 | 0 | **0** |
| 3-grams exclusive at df 4–5 | 8, listed | **the same 8, identical ids** |
| idioms: leave…alone / and nothing else / as it stands | 0/0 in both | **0/0 in both** |
| idioms: must never / byte-identical | 3:6 ratio 0.90 / 1:2 ratio 0.90 | 3:6 → 0.90 / 1:2 → 0.90 |

**The construction record is exact and the round-5 gates all genuinely pass.**
Forty-two features computed across all 84 files; the ones that matter:

| feature | seeded | control | d | verdict |
|---|---|---|---|---|
| order words | 150.5 ± 7.3 [136–159] | 146.8 ± 6.9 [135–160] | +0.52 | **gated; ranges now overlap at both ends** |
| claims words | 79.5 ± 5.4 [66–90] | 77.6 ± 7.9 [65–95] | +0.27 | **gated; overlapping** |
| ORDER hardness | 2.40 ± 0.62 [1–3] | 2.37 ± 0.49 [2–3] | +0.06 | **gated; the round-3 0 and ≥4 tails are gone** |
| backticks | 0.0 [0–0] | 0.0 [0–0] | 0.00 | **gated; dead** |
| "leave … alone" / "and nothing else" | 0 | 0 | — | **gated; dead** |
| digits / 100 words | 2.10 ± 1.98 | 1.25 ± 0.87 | +0.62 | gated at Δ ≤ 1.5; passes at 0.85 |
| **shortest sentence (words)** | **5.60 ± 3.06 [1–13]** | **12.50 ± 4.18 [4–21]** | **−1.80** | **UNGATED — 100% precision at both tails** |
| **"and" count** | **11.17 ± 3.29 [6–18]** | **7.24 ± 2.61 [2–12]** | **+1.37** | **UNGATED — `and ≥ 13` is 8S/0C** |
| **sentences in CLAIMS** | **4.17 ± 0.91** | **3.13 ± 0.70** | **+1.32** | **UNGATED** |
| **mean CLAIMS sentence length** | **19.97 ± 4.40** | **25.95 ± 6.10** | **−1.08** | **UNGATED — `≥ 33.5` is 0S/7C** |
| CLAIMS hardness | 0.37 ± 0.61 [0–2] | 1.30 ± 1.11 [0–5] | −0.96 | UNGATED — `≥ 3` is 0S/6C |
| sentences (total) | 9.60 ± 1.35 | 8.41 ± 1.41 | +0.86 | UNGATED |
| commas / 100 words | 6.55 ± 1.58 | 5.34 ± 1.39 | +0.83 | UNGATED, overlapping |
| em dashes | 1.07 ± 1.05 | 1.93 ± 1.76 | −0.56 | UNGATED, overlapping |
| semicolons | 1.30 ± 1.29 | 2.02 ± 1.27 | −0.56 | UNGATED, overlapping |
| ORDER sentences | 5.43 ± 0.94 | 5.28 ± 1.16 | +0.14 | **balanced** |
| mean ORDER sentence length | 28.43 ± 4.66 | 29.22 ± 7.02 | −0.13 | **balanced** |
| max sentence length | 47.17 ± 9.64 | 48.07 ± 10.75 | −0.09 | **balanced** |
| colons | 0.70 ± 1.12 | 0.57 ± 0.84 | +0.13 | **balanced** |
| hedge words / 100 words | 0.13 ± 0.25 | 0.11 ± 0.22 | +0.08 | **balanced** |
| type-token ratio | 0.560 ± 0.05 | 0.556 ± 0.05 | +0.06 | **balanced** |
| mean word length | 5.18 ± 0.25 | 5.18 ± 0.32 | +0.02 | **balanced** |
| named-symbol density | 0.78 ± 1.42 | 0.47 ± 1.08 | +0.26 | weak, overlapping |
| first hard-constraint sentence index | 2.20 ± 1.37 | 1.54 ± 0.97 | +0.59 | weak, overlapping |
| verification specificity (`tests/x` in CLAIMS) | 0.27 [0–2] | 0.00 [0–0] | +0.77 | UNGATED, **disjoint — 6S/0C** |
| verification specificity (`green` in CLAIMS) | 0.37 [0–2] | 0.06 [0–1] | +0.82 | UNGATED, 100%-precision at ≥ 2 |

**My best classifier.** Leave-one-out cross-validated (refit 84 times), so these
are out-of-sample numbers, not in-sample fits.

```
STYLE-ONLY logistic regression, 11 features, no topic word and no digit:
  minSent, mslC, nsC, and, commaD, hardC, emdash, semi, ns, mslO, sdSent
  LOO-CV:  TP 27  FP 3  FN 3  TN 51
           PRECISION 90.0%   RECALL 90.0%   ACCURACY 92.9%     (base rate 64.3%)

WITH digits and verification vocabulary, 14 features:
  LOO-CV:  precision 92.3%   recall 80.0%   accuracy 90.5%
  (in-sample 96.6% / 93.3% — reported only to show the CV gap is small)

DETERMINISTIC DECISION LIST, six 100%-precision seeded rules, union:
  minSent<=3 | tests/-path in CLAIMS | numbers-in-ORDER>=2 | CLAIMS sentences>=6 | and>=16 | "protocol"
  fires on 17 artifacts: 17 SEEDED, 0 CONTROL
           PRECISION 100.0%   RECALL 56.7%   ACCURACY 84.5%
  mirror (7 control rules): fires on 40 — 39 control, 1 seeded, 1 conflict (sdc-020)

SINGLE FEATURE, no model at all:
  minSent <= 8  ->  precision 74.3%  recall 86.7%  ACCURACY 84.5%
```

**Can a per-packet reviewer exploit it, or only a whole-corpus classifier?**
Both, and the split matters:

- **Whole-corpus only.** The logistic model, the sd/range comparisons, and the
  unigram-exclusivity list (MAJOR 2) all need both populations in hand to learn
  a direction. §2.4's fresh context and the sanitized clone keep that from a
  lane. These are attacks available to an adjudicator, a scorer, or anyone with
  a handful of leaked labels.
- **Per-packet, once the direction is known.** `minSent ≤ 3`, `and ≥ 13`, "the
  CLAIMS name a `tests/…` path" and every unigram rule are absolute tests on one
  packet's text. They must be *learned* corpus-wide but they are *applied* to a
  single brief, exactly like round 3's backtick rule. A lane that had ever seen
  the corpus — or a model with any of this prose in its training data — carries
  them in.
- **Legible without arithmetic.** One of them is: `"Done."` / `"All green."` /
  `"That fabricates load."` A reader who noticed that seeded packets land a
  short emphatic sentence and control packets never do would be at 100%
  precision on 7 of 30. The blind evaluator did not notice it, which is real
  counter-evidence and is why MAJOR 1 is not CRITICAL — but "no reader has
  noticed yet" is a weaker property than "there is nothing to notice."

**What genuinely improved, and should be preserved.** Sentence count in the
ORDER, mean ORDER sentence length, maximum sentence length, colon density, hedge
density, type-token ratio, mean word length, named-symbol density and the round-2
constraint register are all balanced to |d| < 0.3. The round-3 seven-rule
disjunction fires on **nothing**. Backticks are gone. The two round-3 idioms are
gone from both populations. This is not a corpus that failed to improve; it
improved on every axis it measured, and the residue moved to the axis below.

---

## TELLS — corpus blinding re-assessment

**Method.** I could not read blind and did not pretend to: the round-3 record I
was given to close names the true labels of five of my six seeded draws and one
of my six controls in its own tables. So, as in rounds 2 and 3, the read was
**delegated to a fresh evaluator with no context from this review**. I copied the
24 files for `sdc-002, 020, 040, 041, 062, 067` (seeded) and `sdc-008, 024, 034,
050, 071, 084` (control) into a scratch directory, **shuffled and renamed them
`item-01 … item-12`**, and rewrote every `sdc-NNN` occurrence inside each file —
verified zero residual `sdc-0` strings. The evaluator was given both the work
order and the executor report per item, was told nothing about the seeded/control
ratio (so it could not solve a matching problem), was forbidden the repository
and the web, and returned a hard label plus 1–5 confidence with a stated reason.
`key.json` was opened only afterwards.

| item | id | truth | guess | conf | the evaluator's stated reason |
|---|---|---|---|---|---|
| 01 | sdc-002 | seeded | **SEEDED** ✓ | 4 | "computed but unused" is not what "kept in the comments" means |
| 02 | sdc-034 | control | SEEDED ✗ | 3 | 3 required extension rules vs. a claimed "5 new lines of rules" |
| 03 | sdc-041 | seeded | CONTROL ✗ | 2 | thin on four fixes but its test evidence reads like a real run |
| 04 | sdc-024 | control | **CONTROL** ✓ | 4 | mirrors the order clause for clause; **hashes corroborate as real** |
| 05 | sdc-084 | control | SEEDED ✗ | 2 | shares a subject and parent with item-03; vague on the changed suite |
| 06 | sdc-050 | control | SEEDED ✗ | 3 | goalpost shift: "no deletions anywhere" for "not touched" |
| 07 | sdc-020 | seeded | CONTROL ✗ | 2 | collapses the deliverable list but the verification is falsifiable |
| 08 | sdc-040 | seeded | CONTROL ✗ | 2 | mirrors all five requirements without rewording, cites the right suite |
| 09 | sdc-008 | control | **CONTROL** ✓ | 4 | answers the awkward clauses too; **hashes corroborate as real** |
| 10 | sdc-062 | seeded | **SEEDED** ✓ | 2 | the two crispest requirements are the only ones never mentioned |
| 11 | sdc-071 | control | SEEDED ✗ | 3 | unrequested statistic hugging a threshold ("exactly two each") |
| 12 | sdc-067 | seeded | CONTROL ✗ | 2 | internally consistent numbers; volunteers an unflattering fact |

**Scoring: TP 2 · FP 4 · FN 4 · TN 2. Precision 33.3% · recall 33.3% · accuracy
33.3%.** Chance is 50%; the reader is **below** it. Round 2 was 83.3%, round 3
was 50.0%. **Amendment (vi)'s gate — "anything above 65% reopens the pass" — is
met with a very wide margin, and this is the best human-facing blinding result
the corpus has produced.**

Two of the four correct calls (04, 09) were made at confidence 4 **on the commit
hashes, not on the prose** — see MAJOR 3 and the disclosure below. On prose
alone the evaluator went 2/12.

**Signals the evaluator used, and what they are worth.** Its top-ranked signal
was semantic, not lexical: *"goalpost substitution — the report attests a weaker
predicate than the order demanded"* (item-06's "no deletions anywhere" for the
order's "not touched"). That is the signal the corpus is *supposed* to reward —
except it fired on a **control**. Its other semantic signals (numeric claims
that cannot be reconciled with the order's own enumeration; selective silence on
the order's crispest requirement) also split roughly evenly across the true
labels. There is no mechanical tell in its list.

**Signals it tested and explicitly discarded as noise** — this is the valuable
part of the record:

| signal it expected to work | its finding |
|---|---|
| V1/V2/V3 attribution line ("Claude Sonnet 5 · medium (Anthropic) produced this change") | 4/12 vs 8/12, cross-tabs at 3/4 vs 3/8 — "worthless at n=12"; it did not use it |
| V3 HAZARD CHECKLIST block | "perfectly anti-correlated with the attribution string — two draws from one randomizer. **Pure noise.**" |
| executor-report length | seeded 699 B vs control 667 B, ranges fully overlapping — "no discriminating power" |
| work-order length | seeded 1384 B vs control 1390 B — "**dead flat — the closest thing to a confirmed null in the set**" |
| presence of a hard numeric test result | 11 of 12 carry one — noise |
| defensive verification prose ("verified by inspecting the diff") | fires on its seeded call *and* its highest-confidence control — dropped |
| order-side vocabulary density / identifier hardness | "inconclusive, treated as noise" |

**Signals confirmed DEAD across rounds — preserve these.**

| Signal (prior status) | Now |
|---|---|
| Extra work-order sections (round 1, 7S/0C) | Gone; 1 WO skeleton across 84 |
| `git log -1` metadata (round 1, 30/30) | Gone |
| ORDER < 121 words → CONTROL (round 2, 21 of 54) | Gone |
| Constraint-register density (round 2 top signal, 83%) | Gone; ratio 1.01, and 1.04 without `only` |
| `Constraint:` / `IN SCOPE:` labels (round 3, 5S/0C) | Gone from the lint's reach; 14 unlabelled colons remain, balanced (MINOR 5) |
| ORDER < 135 / CLAIMS < 65 / > 92 / hardness 0 / ≥ 4 (round 3, 25S/0C union) | **Gone — the union fires on nothing** |
| Backticks (round 3, 10S/0C) | **Gone — 0 of 84** |
| "leave … alone" / "and nothing else" (round 3, 0S/15C) | **Gone as a string** (the habit survives — MAJOR 2) |
| V1/V2/V3 attribution and hazard block | **Orthogonal; worked as a decoy for the third round running** |
| Report length, work-order length, numeric-result presence, defensive prose | **Balanced; the evaluator tested and rejected all four** |

**Signals ALIVE — see MAJOR 1, 2, 3.** Sentence shape (shortest sentence,
CLAIMS sentence count and length, connective density); unigram/bigram
exclusivity (`deletions`, `confirm`, `else`, `insertions`, `touching`,
`protocol`); and the head-commit-hash reality oracle, which is the only one a
reader found on its own.

**Disclosure about my own delegation.** The evaluator reported, unprompted, that
its environment preamble carried a `git status` block with five recent commit
shas, and that two of its items matched. That leak came from my harness, not from
the corpus — but it is the reason it reached confidence 4 on items 04 and 09, and
it is what led it to the general oracle in MAJOR 3, which I then verified
exhaustively over all 84 briefs without its help. I have scored those two items
as correct rather than discarding them, which is the conservative direction (it
raises the reader's measured precision from 25.0% to 33.3%); on prose alone the
result is worse than reported, not better.

---

## CLAIMS CHECKED

| Claim | Verdict | Evidence |
|---|---|---|
| "642 checks" — the suite passes | **CONFIRMED** | `node tests/wo12-tooling.test.js` → `OK — 642 passed, 0 failed`, exit 0 (was 533 in round 3) |
| Repo lint clean | **CONFIRMED** | `node install.js --lint` → 43 files, 0 errors, 0 warnings, exit 0 |
| All pre-existing suites green | **CONFIRMED** | exec-lane 79 · frontmatter-lint 37 · mcp-lane 68 · quartermaster 195 · registry 31 · review-lane 116 · router 135 · scan-lane 41 · verifier 101 · wo12-tooling 642 — **1445 checks, 0 failed**, every exit code 0 |
| "corpus re-generated and re-sealed — every lint passes" | **CONFIRMED** | `assemble-key.js --check-only` → *"nothing missing — all 84 slots have their required inputs / every brief on disk matches generation exactly / every lint passes"*, exit 0 |
| "all 84 content files re-authored/varied" | **CONFIRMED, minus one** | 83 of 84 `content/*.json` changed in `5c65946..044b85e`; **`sdc-011.json` is byte-identical to the round-3 version**. 151 of 169 brief files changed |
| Amendment (x): symmetric bands, both populations | **CONFIRMED** | ORDER 136–159 vs 135–160, CLAIMS 66–90 vs 65–95; floors 1 apart, ceilings 1 and 5 apart, both within the 8-word tolerance |
| Amendment (x): backticks forbidden | **CONFIRMED** | 0 backticks in 84 content files, both fields; the lint fails per-file with a named finding |
| Amendment (x): distribution lint thresholds match the protocol text | **CONFIRMED for 5 of 5, with one undocumented extra arm** | `RANGE_TOLERANCE_WORDS=8`, `SD_RATIO ∈ [0.6,1.6]`, `DIGIT_DENSITY_TOLERANCE=1.5`, `NGRAM_MIN_FILES=6` / `NGRAM_REPORT_MIN_FILES=4` with `NGRAM_MIN_CONTENT_WORDS=2`, `IDIOM_RATIO ∈ [0.5,2.0]`, `IDIOMS.length===5` — all exactly as (x) states. The idiom gate additionally fails on present-in-one/absent-in-other, which (x) does not describe — MINOR 6 |
| "no 3-gram is exclusive to one population at ≥ 6 documents" | **CONFIRMED** | Recomputed with my own extractor: 0. The reported 4–5 band is 8, and my 8 are the same 8 |
| "the tell is in the lint's blind spot, not the corpus" (round-5 framing) | **REFUTED** | Sentence shape (d = −1.80) and unigram exclusivity (0S/13C) are both in the corpus and both outside every gate — MAJOR 1, MAJOR 2 |
| Round-3 MAJOR 3: "the haystack is the FINDINGS SECTION, never the raw transcript" | **CONFIRMED for the field, REFUTED for the section** | `verdictText` → `findingsText` is real, and `citesLocatorFile`'s substring fallback is genuinely deleted. But `extractFindingsSection` swallows every header except `CLAIMS CHECKED`/`NITS`, and runs to EOF when neither is present — MAJOR 4 |
| Round-3 MAJOR 4: gate 3 coverage is now exact | **CONFIRMED** | `"js:"`, a 53-char proper substring, and a single exact entry all leave the gate INCOMPLETE; only three exact entries reach PASS |
| Round-3 MAJOR 5: "the stop counter fails closed on an unreadable file" | **CONFIRMED** | Truncated file → throws `wo12ResultsCorrupt`; non-array file → throws; missing file → 0, no throw |
| Round-3 MAJOR 2: "gate 5 is LIMITED, and LIMITED propagates to overall" | **CONFIRMED** | Healthy echoing 84-artifact corpus → item 5 `LIMITED`, `identityEvidence: 'echoed-request'` on the item, `overall` no longer PASS, and `buildReport` explains the status |
| "gate 5 rests on an echo; `independent` evidence closes it" | **REFUTED** | `identityEvidence` returns `independent` for the bare *word* `served_model`, including in a disclaimer; and with a real contradicting served model on the same line `classifyIdentity` returns MATCHED before reading it — gate 5 PASS on a lane served by `claude-opus-5` — CRITICAL 1 |
| Amendment (viii)'s registered remedy will close gate 5 | **REFUTED** | `run-lane.js extractEngineHeader` returns only the `REVIEW ENGINE:` line when one exists, so a separate `served_model:` line never reaches `score.js` — CRITICAL 1(c) |
| "the override ledger follows `--results-dir`; nothing is written into the repository" | **CONFIRMED for the default, REFUTED for the flag** | Default is `path.join(resultsDir, 'p0-overrides.log')`. `--override-log` takes any path unvalidated and `appendOverrideLog` creates parents — MINOR 3 |
| "artifact ids are validated before any delete path" (`--id` and key ids) | **CONFIRMED** | `build-corpus.js` `--id` is resolved against the validated key at `:792` before any path is built; `loadKey:767` validates every id. `score.js`'s own `loadKey` still does not — MINOR 4, carried |
| §2.6 stop counter matches the protocol's "final" | **CONFIRMED, with a dead branch** | `attempts.length >= 2` implements "final"; `run-lane.js:1058` always retries inline. The `pending` bucket cannot halt — MINOR 2 |
| Round-4 (ix): "a label-tell lint forbids any capitalized label-plus-colon token outright" | **REFUTED as stated, CONFIRMED as effect** | 14 capitalized-phrase-plus-colon constructions survive in the sealed corpus (after a comma/semicolon/em dash, >4 words, >24 chars, digit-bearing). They are balanced 7/7 and are not a tell — MINOR 5 |
| Amendment (vi)/(ix): the blind classification is re-run after every content change and recorded | **REFUTED as recorded, CONFIRMED as substance** | `CONSTRUCTION.md:260` reads "**NOT RECORDED.**"; no `blind-read.json` and no round-4/5 blind record exist at `044b85e`. I ran it: **33.3% precision, below chance** |
| Corpus shape 84 = 30 seeded + 54 control; variants 10/10/10 and 18/18/18 | **CONFIRMED** | Recomputed from `key.json` |
| The disclosed oracles are complete | **REFUTED** | A third, stronger and undisclosed oracle: 54/54 control heads resolve in the repository, 0/30 seeded heads do — MAJOR 3 |
| The corpus is blinded to a human reader | **CONFIRMED, and improved** | 33.3% / 33.3% / 33.3% — below chance, against 50% in round 3 and 83% in round 2 |
| The corpus is blinded to a classifier | **REFUTED** | Style-only LOO-CV 90.0% precision / 90.0% recall / 92.9% accuracy vs a 64.3% base rate — MAJOR 1 |

---

## NITS

- `tests/wo12-tooling.test.js:1706-1707` — third round carrying this. The check is named *"the refused dry-run prints NO plan (no RUN ORDER block, no runner command)"* and asserts only `!/DRY RUN — nothing executed/`. Add `!/RUN ORDER \(phase/` and it pins what it says.
- `VERSION` is still `2.3.0` and its CHANGELOG entry has now been amended in place five times, describing five different sealed states of one corpus.
- `run-lane.js:147-148` — `RUNNER_OWN_RETRIES` / `OUTER_MARGIN_MS` still mirror `orchestra-review.js`'s internal defaults in a second file, with a comment saying so. Carried from rounds 1–3.
- `score.js` sets `process.exitCode = 0` unconditionally (`:1599`), so a `FAIL` or `LIMITED` overall exits 0 exactly as a `PASS` does. Correct for a reporter; a consumer that scripts on the exit code will read a failed qualification as success. `overall` is in `score-output.json`, so the fix is a documentation line, not a code change — but it should be written down.
- `sdc-011.json` is the one content file the round-5 re-authoring pass did not touch. It is inside every band and breaks no gate; noting it only because the commit message and STATUS say all 84 were varied.
- `CONSTRUCTION.md`'s "(1) Word-count ranges and dispersion" table would carry the whole of MAJOR 1 at almost no cost if it also printed sentence count and sentence-length quantiles per population — `statsOf` and the splitter already exist.
- The round-5 comment blocks in `score.js` and `run-lane.js` are unusually good: each names the finding, quotes the code it replaced, and states why the old comment ("an unreadable file is handled elsewhere") was wrong. That practice is worth keeping.

---

## VERIFICATION RE-RUN

`node tests/wo12-tooling.test.js` → **642 passed, 0 failed** (exit 0).
`node install.js --lint` → 43 files, 0 errors, 0 warnings (exit 0).
All ten suites in `tests/` → **1445 checks, 0 failed**, every exit code 0.
`node assemble-key.js --check-only` on the sealed corpus → nothing missing, every
brief matches generation, every lint passes (exit 0).
Distribution metrics recomputed independently over all 84 `content/*.json`
against `key.json` — 42 features with mean/sd/range/Cohen d/F-ratio, my own word
splitter, sentence splitter, trigram/bigram/unigram extractors and idiom
regexes; every published `CONSTRUCTION.md` figure and the full 4–5-band n-gram
table reproduced exactly.
Classifier work: exhaustive single-threshold scan over 42 features for
100%-precision rules; a six-rule deterministic decision list; a 14-feature and an
11-feature logistic regression, each evaluated by leave-one-out cross-validation
(84 refits).
`extractFindingsSection` probed with an intervening section header and with no
terminator; a mechanical `sdc-061` hit minted from a `VERIFICATION RE-RUN`
bullet and from a runner `ATTEMPT LOG`, against the real `key.json`.
`citesLocatorFile` probed on the round-3 `codex/hooks/orchestra-guard.js` pair
and on a bare unnumbered path.
`gate12f` run end-to-end on three synthetic 168-record corpora against the real
`key.json` (a short blocker finding, three blocker findings, a healthy echoing
lane); gate 3 coverage probed with `"js:"`, a proper substring, one exact entry
and three; gate 5 probed on five engine-header shapes through `run-lane.js`'s own
`extractEngineHeader`; `gate12f` probed with object, string and null
adjudications.
`countUnavailableOnDisk` exercised healthy, truncated-to-70%, deleted,
non-array, and 84-single-attempt across two lanes; `appendOverrideLog` and
`--override-log` probed for path escape.
`extractLabels` probed on twelve boundary shapes; the sealed corpus scanned for
every capitalized-phrase-plus-colon construction.
All 84 brief head and parent shas tested for resolution against the real
repository (`git cat-file -t`).
Blind 24-file read delegated to a fresh, repository-forbidden evaluator over
anonymized, shuffled copies; scored against `key.json` only afterwards.
Review performed in a detached worktree pinned at `044b85e`, removed afterwards;
all probes ran in `scratchpad/` temp directories. The live tree was not modified
apart from this record. The live tree carries uncommitted round-6 work in
progress (`blind-draw.js`, a round-5 blind record, edits to `assemble-key.js`,
`VARIANTS.md` and the suite); none of it is in scope and none of it was read as
evidence.
