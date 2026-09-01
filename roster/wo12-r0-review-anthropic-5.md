<!-- R0 fallback same-family lane, Claude Opus 5, fresh context, READ-ONLY; scope 044b85e..fb20e44 (round 6: no shas in briefs, hexLint, pair-aware blind-draw.js; round 7: sentence floor, unigram exclusivity, stopping standard, identity gate re-ordered, FINDINGS window ends at any header, override-ledger containment, pending halts, 84 content files re-authored, corpus re-sealed); rounds 6 and 7; verdict REVISE. -->

REVIEW ENGINE: Claude Opus 5 (R0 Anthropic lane, fresh context, tier: full)

**Lane / casting:** R0, Anthropic casting, Claude Opus 5, fresh context, read-only.
**Date:** 2026-08-31.
**Rounds:** 6 and 7 (delta review).
**Scope:** `044b85e..fb20e44` — 21 commits. Round 6: protocol (xi), every sha
removed from brief text (VARIANTS.md v3), `hexLint`, the pair-aware seeded
`blind-draw.js`. Round 7: protocol (xii), the sentence floor and
shortest-sentence parity gate, unigram exclusivity, the rendered stopping
standard, the identity gate re-ordered to parse `served_model` first, the
FINDINGS window ended at any header, the override ledger contained inside
`--results-dir`, `pending` folded into the §2.6 breach, `score.js loadKey`
validating artifact ids, and all 84 content files re-authored and re-sealed at
`fb20e44`.

**Method.** Read-only. Every probe ran under
`…/scratchpad/anth5` and `…/scratchpad/`. The one repository write was
`corpus/materialized.json`, rewritten by the `build-corpus.js --all` run the
brief asked for and restored immediately with `git checkout --`
(`git status --porcelain` clean afterwards, verified). All 84 sanitized run
clones were built and inspected. The live tree moved during the review (HEAD
advanced from `fb20e44` to `3b168a9`); `key.json`, `blind-draw.js`, the briefs
and the content files are byte-identical between `fb20e44` and the tree I
measured — verified with `git diff --stat fb20e44 HEAD -- …` (empty).

**CROSS-FAMILY DISCLOSURE — `review.cross_family=false`.** The artifacts under
review are Anthropic-authored and this reviewer is Anthropic. This is the
**fallback same-family lane**; read every finding as correlated with the
author's own blind spots. The OpenAI-lane delta for rounds 4–5
(`roster/wo12-r0-review-openai-4.md`) produced no findings, and the round-6/7
OpenAI attempt recorded at `44ab83c` was VOID on a stub engine. **No
cross-vendor opinion exists for rounds 3 through 7.**

**Predecessor record:** `roster/wo12-r0-review-anthropic-4.md` (REVISE, 1
CRITICAL / 4 MAJOR / 6 MINOR). **11 findings carried in; every one ruled below.**

---

# VERDICT: REVISE

**2 CRITICAL · 6 MAJOR · 4 MINOR.**

Round 7 did something none of the previous rounds did: it wrote down the
condition under which the loop stops. Amendment (xii) says the corpus is
accepted when every gated feature passes **and the delta reviewer's best
*ungated* style classifier no longer reaches 80% precision over 84 artifacts**,
and `BLIND-TEST-round7.md` restates it as *"Round 7 is the last content round
unless the delta review's label-informed classifier reaches 80%."* That is the
right way to end this, and it is the reason this verdict is not a judgement
call.

**The standard is not met.** A style-only logistic regression — thirteen
features, no topic word, no digit, no named symbol — reaches **85.7% precision
at the 0.5 threshold and 95.0% at 0.7** under leave-one-out cross-validation
(84 refits). Adding digit density and the two word-count totals gives **96.2%
precision / 83.3% recall / 92.9% accuracy**. And a deterministic decision list
of nine absolute single-feature thresholds — the kind a reader carries in
their head — labels **58 of 84 artifacts with zero errors** (19 seeded, 39
control), against 17 in round 5. By the protocol's own arithmetic the corpus is
*more* separable than the version the last record rejected, not less.

Everything else follows the same shape as the four rounds before it, and I want
to be precise about it because the authors have now named the pattern
themselves:

- The **shortest-sentence mean** was gated at Δ ≤ 3 words and passes at 1.34.
  The **tail** was not gated, and the floor itself minted the new rule:
  `shortest sentence == 8 words` is **0 seeded / 15 controls**, because 8 is
  the floor and the seeded minimum is 9 (MAJOR 3).
- The **unigram** gate was added and genuinely passes — I reproduced 0
  exclusives at df ≥ 8 with my own extractor and no stopword list at all. The
  separating vocabulary simply moved under its three exclusions: **`we` 0S/13C**
  (2 characters *and* a stopword), **`md` 0S/8C** (the exact token round-4
  MAJOR 2 named, at the gate's own fail threshold), **`135` 7S/0C** (a bare
  number) (MAJOR 2).
- The **sha** half of the pair oracle was removed from every brief — 0 hex
  tokens across all 168, verified. The **`Commit subject:`** half was left in,
  byte-identical across all ten reused-base pairs (MAJOR 4).
- Round-4's CRITICAL on gate 5 is genuinely closed: the disclaimer, the inline
  contradiction and the separate `served_model:` line all now behave. But the
  field is parsed out of the **reviewed model's own transcript**, and
  `orchestra-review.js` emits no `served_model` at all — so **the only way gate
  5 can ever read PASS is from a line the model under test wrote itself**
  (CRITICAL 1).
- Round-4's MAJOR 4 on the FINDINGS window is closed for both named
  reproducers. The replacement terminator ends the section at any heading-shaped
  line, any `---`, and any line beginning `--`. A correctly-cited CRITICAL seed
  under a `### CRITICAL` subhead scores **MISS**; so does one after a horizontal
  rule or after a wrapped `--override-log …` continuation — and the last two
  leave a non-empty section, so `emptyFindingsSection` does not warn
  (CRITICAL 2).

---

## CLOSURE TABLE — Anthropic round 4 (`wo12-r0-review-anthropic-4.md`)

### CRITICAL

| # | Finding | Ruling | Fix + the test I RAN |
|---|---|---|---|
| C1 | `score.js` — gate 5's `independent` is decided by a bare substring; `classifyIdentity` returns MATCHED before reading the served value; `extractEngineHeader` discards a separate `served_model:` line | **CLOSED (all three sub-defects), with a new bypass** | `SERVED_MODEL_FIELD_RE` (`score.js:474`) requires a parsed field with a value; `SERVED_MODEL_ABSENT_VALUES` rejects `not/none/unknown/…`; `classifyIdentity` reads `served` **before** the echo (`:551`); `extractEngineHeader` now joins a separate `served_model:` line to the `REVIEW ENGINE:` line (`run-lane.js:785-800`). **Ran all four round-4 shapes through `run-lane.js`'s own extractor against the real lane model**: `(served_model not reported)` → `echoed-request`/**LIMITED**; `(served_model: claude-opus-5)` → `MISMATCHED`/`contradicted`; a separate `served_model: claude-opus-5` line → `MISMATCHED`/`contradicted`. Every round-4 counterexample is dead. **The evidence source is the model's own transcript — CRITICAL 1.** |

### MAJOR

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| M1 | sentence shape is ungated; minSent d = −1.80; style-only LOO-CV 90.0%/90.0% | **PARTIALLY CLOSED (the named statistic is fixed; the family is not)** | `MIN_SENTENCE_WORDS = 8` and `SHORTEST_SENTENCE_MEAN_TOLERANCE = 3` (`assemble-key.js:1129-1130`), both enforced in `distributionLint` arm (6) (`:1342-1364`). Recomputed on all 84: shortest sentence **10.93 ± 1.87 [9–17] seeded / 9.59 ± 1.34 [8–12] control, d = +0.87** (was −1.80 — the sign flipped and the magnitude halved), Δmean 1.34 ≤ 3, and **no sentence anywhere is under 8 words**. `"Done."` is gone. **But `minSent ≤ 8` is now 0S/15C at 100% and `and` rose from d = 1.37 to d = 1.62 — MAJOR 1, MAJOR 3.** |
| M2 | 3-gram exclusivity is scoped past the real signal; unigrams `deletions` 0/13, `confirm` 0/12, `else` 0/12, `insertions` 0/11, `touching` 0/10, `protocol` 8/0 | **CLOSED for the six named words; the gate's exclusions re-admit the class** | Arm (7), `UNIGRAM_MIN_FILES = 8` / `UNIGRAM_REPORT_MIN_FILES = 5`. **Recomputed independently with my own tokenizer, ≥4 characters, and NO stopword list: 0 exclusives at df ≥ 8** — the published figure is exact, and the stopword list hides nothing at ≥4 characters (43 at df 5–7 against the report's 42). All six named words are gone. **`we` 0S/13C and `md` 0S/8C survive under the length and stopword rules — MAJOR 2.** |
| M3 | the head sha in every brief is a 100%/100% oracle (54/54 control heads resolve, 0/30 seeded) | **CLOSED for the brief text** | `HEX_IN_BRIEF_RE` = `/\b[0-9a-f]{7,40}\b/gi`, run on both briefs of every artifact at generation (`assemble-key.js:2363-2364`). **Ran `hexLint` over all 168 sealed briefs: 0 findings**, and 0 briefs contain any prefix of their own `base` or `commit`. The `Change under review:`/`Base (its parent):` sha lines are replaced by *"the commit checked out at HEAD in this checkout, compared against its parent."* **The `Commit subject:` half of the same oracle is untouched — MAJOR 4.** |
| M4 | `extractFindingsSection` ends only at `CLAIMS CHECKED`/`NITS`; every other header is swallowed; no terminator runs to EOF | **CLOSED for both named reproducers, REOPENED in the other direction** | `isFindingsTerminator` (`score.js:146-150`) adds `SECTION_HEADER_RE` and `RUNNER_DELIMITER_RE`. **Verified**: a `VERIFICATION RE-RUN` block and an `--- ATTEMPT LOG` tail are both now outside the window, so neither can mint a hit. **The same predicate destroys legitimate findings — CRITICAL 2.** |

### MINOR

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| m1 | a blocker under 20 normalized characters can never be adjudicated; the operator is shown a truncated string | **CLOSED** | `score.js:1105-1122`: the floor is dropped on the coverage path (equality makes it unnecessary) and kept on the promotion path; the "needs adjudication" list prints the full text, not `slice(0,70)`. The reasoning in the comment is correct. |
| m2 | `pending` is computed, named, displayed and can never halt | **CLOSED** | `run-lane.js:1117-1129`: the breach is `count + pending > PHASE0_MAX_UNAVAILABLE`, both reported separately, with `'none'` for an empty final list. Pinned by two suite checks (`tests/wo12-tooling.test.js:3695-3697`). |
| m3 | `--override-log` takes any path, unvalidated, and creates its parents | **CLOSED** | `run-lane.js:1021-1041`: refuses a relative path, and refuses any absolute path that does not `isInside(realResolve(resultsDir))`. Pinned by two suite checks (`:3712-3714`), both of which I saw pass. |
| m4 | `score.js loadKey` does not validate artifact ids while `build-corpus.js` does | **CLOSED** | `score.js:397-405` validates every id against `buildCorpus.ARTIFACT_ID_RE` — one rule, both loaders, and the reason is written down. |
| m5 | the label-tell lint is not zero-tolerance and `CONSTRUCTION.md` says it is | **NOT CLOSED** | `LABEL_RE` is untouched in range. Carried to NITS. |
| m6 | amendment (x)'s text and the idiom gate's third arm disagree | **CLOSED** | The distribution report now enumerates all three arms with the strictest one flagged (`assemble-key.js:1841-1857`, rendered in `CONSTRUCTION.md:167-186`). **I exercised all three**: ratio 1.0 → pass; ratio 3.0 → FAIL; present-seeded/absent-control → FAIL; absent from both → pass. |

### Carried items

| Item | Ruling | Evidence |
|---|---|---|
| A-m5 (r2): the `corpus/` directory is an oracle | **CLOSED AS DISCLOSURE** (unchanged) | The section is intact and accurate; I re-ran all five `sanitizeClone()` assertions' subject matter across all 84 clones — no clone's HEAD tree contains any `wo12` path, any `roster/wo12` record, or any literal `sdc-NNN` id. |
| r3 NIT: `VERSION` still `2.3.0`, entry amended in place | **NOT CLOSED** | Now amended in place seven times. Carried to NITS. |
| r3 NIT: `run-lane.js` mirrors `orchestra-review.js`'s retry/margin defaults | **NOT CLOSED** | Unchanged. Fifth round. |
| r4 NIT: the test name at `:1706` overstates its assertion | **NOT CLOSED** | Fourth round. Carried to NITS. |
| r4 m1 / (vi): the blind-classification record is missing from `CONSTRUCTION.md` | **NOT CLOSED IN RANGE** | At `fb20e44` the section still reads **"NOT RECORDED."** — no `corpus/blind-read.json` exists. `BLIND-TEST-round7.md` was committed at `2c73cff`, *after* the range, and does not populate that section either. See MAJOR 6. |

### Closure counts

**15 items ruled. 9 CLOSED · 2 PARTIALLY CLOSED · 4 NOT CLOSED.** Of the
round-4 record's eleven findings: **8 CLOSED, 2 PARTIALLY CLOSED, 1 NOT
CLOSED.** Every CRITICAL and MAJOR was attacked at the line it named and every
named reproducer is dead. This is the most complete closure pass in the series.

---

## NEW FINDINGS

### CRITICAL

**[CRITICAL 1] `score.js:474` (`SERVED_MODEL_FIELD_RE`) + `score.js:594-599` (`identityEvidence`) + `run-lane.js:785-800` (`extractEngineHeader`) — the served model is parsed out of the reviewed model's own transcript, and `orchestra-review.js` emits no `served_model` field of its own. The only satisfying assignment for gate 5's PASS is therefore text the model under test wrote about itself.**

The round-7 change makes `served_model` load-bearing in a way round 5 did not:
`identityEvidence` returns `independent` **only** when a parsed
`served_model: <value>` equals the lane's model, and gate 5 is `LIMITED`
without it. So `independent` is now the sole route to PASS.

`extractEngineHeader` builds the header from the runner's **whole captured
stdout** (`run-lane.js:830`, `extractEngineHeader(stdout)`) with an `m`-flagged
line regex. Stdout contains the model's verdict. Exercised end to end, against
the real `LANE_EXPECTED_MODEL` for X-Terra:

```
$ node -e "const R=require('./run-lane.js'),S=require('./score.js'); …"

plain terra header
   header="REVIEW ENGINE: gpt-5.6-terra"
   served=null classify=MATCHED evidence=echoed-request  => gate5 LIMITED
SPOOF: model writes its own served_model in the VERDICT BODY
   header="REVIEW ENGINE: gpt-5.6-terra\nserved_model: gpt-5.6-terra"
   served="gpt-5.6-terra" classify=MATCHED evidence=independent  => gate5 PASS
SPOOF with NO runner header at all
   header="served_model: gpt-5.6-terra"
   served="gpt-5.6-terra" classify=MATCHED evidence=independent  => gate5 PASS
```

The spoofing input was an ordinary verdict whose NITS section contained the
line `served_model: gpt-5.6-terra` on its own line. Nothing adversarial is
required beyond a model that mentions the field name at the start of a line —
and a model reviewing *this* repository has `score.js` and `run-lane.js` in
front of it. The reverse also holds: a reviewer that writes
`served_model: claude-opus-5` anywhere in its output makes its own lane read
`MISMATCHED`, and the round-7 rule is that a contradiction **FAILS** gate 5.
Both directions of the trial's identity gate are writable by the subject.

And the honest path is closed. I grepped the runner:

```
$ grep -n "served_model\|served model\|REVIEW ENGINE" packs/codex/hooks/orchestra-review.js
2262:  return 'REVIEW ENGINE: OpenAI via Codex CLI (' + settingsBits().join(', ') + ')' + headerTail();
2275:    'REVIEW ENGINE: NONE — no cross-vendor review was produced.\n' +
```

`settingsBits()` emits `model: ' + CONFIG.model` — the **requested** model, which
round 7 correctly routes to `echoed-request`/LIMITED. There is no
`served_model` anywhere in the runner. So in a real trial pass, gate 5 reads
`LIMITED` on every lane — correct and fail-safe — **unless a model emits the
line, in which case it silently reads PASS**. A gate whose only PASS is
attacker-controlled is worse than a gate that always reads LIMITED, because
`overall` treats them differently.

Fixes, in order of value: (1) take the engine header from a channel the model
cannot write — the runner's own framing, a separate file, or a delimiter the
runner strips from model output before scoring; (2) until amendment (viii)'s
remedy lands in `orchestra-review.js`, make `independent` unreachable rather
than model-reachable, so gate 5 is honestly `LIMITED`; (3) at minimum, restrict
the `served_model:` line search to the runner's own header block rather than
the whole transcript.

**[CRITICAL 2] `score.js:143-150` (`SECTION_HEADER_RE`, `RUNNER_DELIMITER_RE`, `isFindingsTerminator`) — the new terminator ends the FINDINGS window at any heading-shaped line, at any `---`, and at any line beginning with `--`. A correctly-cited CRITICAL seed placed under a `### CRITICAL` subhead, after a horizontal rule, or after a wrapped `--flag` continuation scores MISS. Two of the three leave a non-empty section, so `emptyFindingsSection` does not warn.**

```js
const SECTION_HEADER_RE = /^(?:#{1,6}\s+\S.*|[A-Z][A-Z0-9 /-]{2,}:?)$/;
const RUNNER_DELIMITER_RE = /^(?:-{2,}\s*\S|FINALITY:)/;
```

Exercised against the real `key.json`, on `sdc-013` (a **CRITICAL** CV seed at
`verifier/checkout.js:289-291`), with the same correctly-cited, correctly-graded
finding in every case:

```
runner template (bare headers)             blocks=1  HIT=true
house markdown (## FINDINGS)               blocks=1  HIT=true
house markdown + ### CRITICAL subhead      blocks=0  HIT=false
bare ALL-CAPS CRITICAL subhead             blocks=0  HIT=false
hr --- before the real finding             blocks=1  HIT=false
--flag continuation before the finding     blocks=1  HIT=false
NOTE: line before the finding              blocks=1  HIT=true
```

Three reachable shapes, in ascending order of likelihood:

*Severity subheads.* `score.js:105-118`'s own comment says why the parser
accepts `## FINDINGS`: *"§2.4's S-lanes are hand-transcribed in-harness agents,
and this repository's own R0 house format (`roster/wo11-r0-review-1.md`) writes
`## FINDINGS` / `## CLAIMS CHECKED`."* I checked what that house format actually
does inside the section:

```
$ grep -n "^#\{1,6\} \|^---$" roster/wo12-r0-review-anthropic-3.md | head
26:---
63:---
109:## NEW FINDINGS
111:### MAJOR
316:### MINOR
358:---
```

`### MAJOR` / `### MINOR` under a `## …FINDINGS` heading is the house format —
this record uses it, `anthropic-3.md` and `anthropic-4.md` use it, and
`wo11-r0-review-1.md` uses `### Substrate (gate-class)`. An S-lane writing the
house record scores **zero findings for the whole artifact**. `## FINDINGS` is
supported precisely so the S-lanes work; the round-7 terminator un-supports the
rest of the same format.

*Horizontal rules.* `---` between findings matches `RUNNER_DELIMITER_RE` (the
`-{2,}\s*\S` branch backtracks onto the third dash). Everything after the first
rule is discarded, silently, with a non-empty section and no diagnostic.

*Wrapped flag continuations.* A finding about a CLI flag whose wrapped second
line begins `--override-log …` terminates the section there. Reproduced above;
the *following* CRITICAL was lost.

The blast radius is the whole trial. Gate 1's margin is ±1 hit; gate 2 is *zero*
missed CRITICAL seeds; both recall Wilson intervals and the 12d X/S contrast
read from the same scored records. Round-4 MAJOR 4 was about over-crediting a
lane; this is under-crediting, is equally result-changing, and unlike round-4's
version it produces **no warning** in two of three shapes. `scoreRecords()`
flags `emptyFindingsSection` only when the section is empty, which the `---` and
`--flag` cases are not.

Fix: keep the runner delimiters, drop `-{2,}` (require the literal
`--- ATTEMPT LOG` / `FINALITY:` the comment names), and treat a heading as a
terminator only when it is **not** a severity/bucket word — or better, only when
its level is at or above the level of the `FINDINGS` heading that opened the
window. A `###` under a `##` is a subsection, not the next section.

### MAJOR

**[MAJOR 1] Amendment (xii)'s own stopping standard is not met. The best ungated style classifier reaches 85.7% precision (95.0% at a 0.7 threshold) under leave-one-out CV, 96.2% with digits and word totals, and a nine-rule deterministic decision list labels 58 of 84 artifacts with zero errors — against a stated ceiling of 80%.**

The standard, quoted from the protocol: *"the corpus is accepted when every
gated feature passes and the delta reviewer's best ungated style classifier no
longer reaches 80% precision over 84 artifacts."* Measured, honestly
cross-validated (refit 84 times, out-of-sample):

```
STYLE-ONLY logistic regression, 13 features, no topic word and no digit:
  toolMinSent, and, commaD, mslOrder, nsOrder, maxSent, sdSent, semi,
  emdash, nsClaims, mslClaims, meanWordLen, ttr
  thr 0.5  LOO-CV: TP 24 FP 4 TN 50 FN 6 | precision 85.7%  recall 80.0%  accuracy 88.1%
  thr 0.7  LOO-CV: TP 19 FP 1 TN 53 FN 11| precision 95.0%  recall 63.3%  accuracy 85.7%

WITH digit density and the two word totals, 17 features:
  thr 0.5  LOO-CV: TP 25 FP 1 TN 53 FN 5 | precision 96.2%  recall 83.3%  accuracy 92.9%
```

More damning than the model is the decision list, because every rule is a single
absolute threshold a reader can carry in and apply to one packet:

```
SEEDED  (union fires on 19 — 19 seeded, 0 control, precision 100.0%, recall 63.3%)
  and >= 13            n=10   digits per 100 words == 0   n=10   shortest sentence >= 13  n=5
CONTROL (union fires on 39 — 39 control, 0 seeded, precision 100.0%, recall 72.2%)
  commas/100w <= 4.02  n=20   mean ORDER sentence <= 22.14 n=20  shortest sentence <= 8  n=15
  longest sentence <= 34 n=15  ORDER sentences >= 8  n=12  CLAIMS sentences >= 6  n=8

combined: TP 19  FP 0  TN 39  FN 0  undecided 26 — 58 of 84 decided, 100% correct
```

Round 5's equivalent list fired on 17 artifacts; this one fires on 58. `and`
went from d = 1.37 to **d = 1.62** (11.40 ± 3.22 seeded vs 6.76 ± 2.64 control);
comma density from d = 0.83 to **0.98**. **`digits per 100 words == 0` → SEEDED
is 10 artifacts at 100% precision** and needs no arithmetic at all: *this packet
contains no digit anywhere.* The digit-density gate compares means (Δ 0.41 ≤
1.5) and cannot see a disjoint zero-bin.

This is the same failure the stopping standard was written to end: word totals
were gated, so the tell moved to sentence shape; sentence *means* were gated, so
it moved to sentence *tails* and connective/punctuation density. The remedy is
still not another named statistic. It is to make `distributionLint` compare the
two populations over a **family** of derived features and fail any feature whose
value ranges are disjoint at either end — which would have caught the round-3
tails, the round-5 sentences and every rule in the list above with one test.

**[MAJOR 2] `assemble-key.js:1122-1125` — the unigram gate genuinely passes, and the vocabulary that separates the populations sits under its three exclusions. `we` is 0 seeded / 13 controls; `md` is 0/8 — at the gate's own fail threshold, and the exact token round-4 MAJOR 2 named; `135` is 7/0. Protocol (xii) says "any content word"; the code says ≥ 4 characters, non-stopword, non-numeric.**

```js
const UNIGRAM_MIN_LENGTH = 4;      // (6) shorter words are function words
```

Measured over all 84 sealed content files:

```
$ node -e "…df over tokens of 2-3 characters…"
we    0S/13C  sdc-007 sdc-008 sdc-009 sdc-024 sdc-025 sdc-026 sdc-027 sdc-028
              sdc-029 sdc-030 sdc-031 sdc-032 sdc-058
md    0S/8C   sdc-011 sdc-025 sdc-029 sdc-033 sdc-034 sdc-036 sdc-045 sdc-060
ten   0S/5C
135   7S/0C
```

Adversarial inputs run through the exported lint confirm the boundary is exactly
where the constant puts it:

```
9-char word, 8 seeded / 0 control (AT the fail threshold)      -> FAIL (1)
9-char word, 7 seeded / 0 control (reported, not gated)        -> pass
3-char word, 30 seeded / 0 control (BELOW UNIGRAM_MIN_LENGTH)  -> pass
```

A 3-character word carried by **all 30 seeds and no control** passes the gate.
`we` is doubly exempt (length *and* stopword) and is a first-person authorial
habit — the purest authorship fingerprint in the set, at 100% precision on 24%
of the controls, legible from one packet with no arithmetic. `135` is excluded
by `isContentWord`'s bare-number rule, which is correct for 3-grams (where a
number is topic) and wrong for a single token that happens to be a test count.

I also checked whether the stopword list is hiding anything above the length
floor, and it is not: my own tokenizer with **no stopword list at all**, ≥ 4
characters, finds **0 exclusives at df ≥ 8** and 43 at df 5–7 against the
report's 42. The gate is honest; its scope is too narrow. Fix: drop
`UNIGRAM_MIN_LENGTH` to 2, and exempt from the *stopword* rule nothing at all —
a stopword carried by 13 documents of one population and none of the other is
the strongest possible authorship signal, not the weakest.

**[MAJOR 3] `assemble-key.js:1129` (`MIN_SENTENCE_WORDS = 8`) — the floor is evadable by the splitter's own uppercase lookahead, and the floor value itself created a new 100%-precision rule: `shortest sentence == 8 words` is 0 seeded / 15 controls, because 8 is the floor and the seeded minimum is 9.**

The histogram of the gated feature, over all 84:

```
shortest sentence (words) -> seeded / control
   8:  0S / 15C     <- the floor value; 15 artifacts, 100% control
   9:  8S / 11C
  10:  7S / 16C
  11:  4S /  5C
  12:  6S /  7C
  13:  3S /  0C     <- 5 artifacts at >= 13, 100% seeded
  14:  1S /  0C
  17:  1S /  0C
```

Both tails are pure. The Δmean gate (1.34 ≤ 3) is satisfied while `minSent ≤ 8`
alone is 15 controls at 100% and `minSent ≥ 13` is 5 seeds at 100% — 20 of 84
artifacts decided by the *gated* feature. Round-3's means-vs-tails lesson,
applied to the gate that was added to fix round-5's version of it.

Separately, the floor cannot see the register it was written to remove.
`SENTENCE_SPLIT_RE` splits only before an uppercase letter:

```
"Done. The tests pass and nothing else moved in this change."
   -> 2 sentences, [1,10], shortest=1  *** FLOOR WOULD FIRE
"Done. install.js must not be touched by this change at all."
   -> 1 sentence,  [11],   shortest=11    (floor passes)
"Make recon two-tier. tests/router.test.js stays green throughout the run."
   -> 1 sentence,  [9],    shortest=9     (floor passes)
"Done.The tests pass and nothing else moved in this whole change."
   -> 1 sentence,  [11],   shortest=11    (floor passes)
```

A short emphatic sentence followed by a sentence beginning with a lowercase
filename — `install.js`, `tests/…`, `.cmd`, `orchestra.json` — is invisible to
the floor, and this corpus's prose starts sentences with lowercase filenames
constantly. The exemption is deliberate (the comment explains it), and it is
exactly the shape a content author reaching for the punchy register would land
in. It is **not currently exploited** — `[.!?]\s+[a-z]` occurs 0.07 times per
seeded packet and 0.04 per control — which is why this is MAJOR and not
CRITICAL. But the gate's guarantee is "no sentence under 8 words", and what it
actually enforces is "no sentence under 8 words that is followed by a capital
letter."

Fix: gate the shortest-sentence **range**, not just its mean (floor Δ and
ceiling Δ, exactly as arm (1) already does for word counts), and split on
`[.!?]\s` unconditionally with a dotted-token exception list rather than on a
capital-letter lookahead.

**[MAJOR 4] `assemble-key.js:410` (`SUBJECT_LABEL + artifact.subject`) — round 6 removed the sha half of the reused-base pair oracle and left the subject half. All ten pairs still carry a byte-identical `Commit subject:` line, and in every pair the seeded member is the lower id.**

Amendment (xi) names the channel it is closing: *"the ten reused-base pairs
showing one base and subject under two heads, one per cohort."* `hexLint` closes
the base sha. The subject is still printed:

```
$ diff <(head -5 corpus/briefs/sdc-001.wo.txt) <(head -5 corpus/briefs/sdc-075.wo.txt)
(no differences — the first five lines are identical, subject included)

$ node -e "…pair check over key.json…"
sdc-001 sdc-075 sameCommit true sameSubject true      … 10 of 10 pairs identical
duplicate-subject groups: 10 — every one is (seeded, control)
```

A many-packet reader who sorts on the `Commit subject:` line finds ten exact
duplicates and knows that each pair contains exactly one seeded artifact — 20 of
84 artifacts reduced to ten forced binary choices, from a header field, with no
prose and no statistics. That is the same join key blind test #2 used to score
24/24; only one of its two halves was removed.

Reach, stated honestly: `blind-draw.js` prevents the *blind test* from seeing
both members (verified — the linkage components are computed over shared `base`
**or** `commit`, and my reproduction reports 74 components with no two drawn ids
sharing one), and a per-packet lane sees one packet. So the residual exposure is
to a classifier, an adjudicator and a scorer — the same audience as the two
disclosed oracles. `CONSTRUCTION.md:257-279` still describes the collision as
*"an identical `Base (its parent)` sha and an identical `Commit subject:` line"*,
which is now half true and reads as though the whole channel were merely
disclosed rather than half-closed. Either drop the subject line from the brief
(the reviewer has `git log -1` inside the clone and does not need it) or update
the disclosure to say which half survives.

**[MAJOR 5] Two run-clone channels that `CONSTRUCTION.md` states are unreachable from a sanitized clone. (a) `run-lane.js:1079` names each lane's checkout after the artifact id — the lane's own working directory is literally `sdc-013`, and the seeded ids are four contiguous blocks published in this repository. (b) Inside the clone, "the diff touches no `.js` file" is 32/33 control — a per-packet absolute rule at 97% precision.**

(a) `runCloneDir: path.join(runCloneRoot, a.id)`. I built all 84 and confirmed:

```
$ basename "$PWD"   (in each clone)
sdc-001 … sdc-084
```

The artifact id is not blinded from the lane at all. On its own that is only an
index; combined with `CONSTRUCTION.md`'s own disclosure — *"the seeded ids
occupy contiguous blocks (`001-006`, `013-020`, `037-044`, `061-068`)"*, a fact
also quoted verbatim in four `roster/wo12-r0-review-*.md` records in the same
public repository — it is a complete oracle for anyone who has that one line.
I verified the line is **not** inside any clone (`git grep` for the block
spellings and for any literal `sdc-NNN` across all 84 HEAD trees: **0 files**),
so a lane cannot derive it in situ. It does not have to: the map is one
sentence, in a public repo, about the corpus the lane is inside. The remedy is
one line — name the run clone with an opaque per-run token instead of the id.

(b) The topic asymmetry is disclosed, and the disclosure's argument for why it
does not compromise the trial is: *"the corpus-level frequency that makes the
signal exploitable is exactly what a per-packet reviewer does not have."* That
argument does not hold for an absolute rule. Measured across all 84 clones:

```
diff touches ZERO .js files          n=33   control 32/33   precision 97.0%
diff touches ZERO code files at all  n=30   control 29/30   precision 96.7%
depth <= 12  -> CONTROL              n=7    100%
ins  >= 661  -> CONTROL              n=4    100%
md   >= 8    -> CONTROL              n=4    100%
```

`git diff --numstat HEAD~1 HEAD` is the first thing any reviewer runs, and
"this change touches only Markdown and records" is a per-packet observation, not
a corpus-level frequency. It needs the *direction* learned elsewhere, which is
the honest limit and why this is MAJOR rather than CRITICAL. But the disclosure
should say so in the terms that are true: the exposure is to a reviewer who has
seen the construction record, not only to an adjudicator.

What I checked and found **clean**, so it is on the record: no clone has a dirty
worktree; every clone is fully packed with 0 loose objects (so the seeded
materialization leaves no object-store signature); the reflog file exists but is
empty; author and committer identity, timestamps and the **full commit message
including trailers** are byte-identical between a seeded artifact's synthetic
head and the real commit it was rebuilt from; `git for-each-ref` is empty in
every clone; and no clone's HEAD tree contains any `wo12` path, any
`roster/wo12` record, or any literal artifact id.

**[MAJOR 6] `corpus/BLIND-TEST-round7.md` — the round-7 blind draw does not reproduce from the seed it records, and `CONSTRUCTION.md`'s amendment (vi) section still reads "NOT RECORDED." The pre-registered acceptance evidence for the corpus a pass would actually run on cannot be verified.**

*Scope note: `BLIND-TEST-round7.md` was committed at `2c73cff`, immediately
after this review's range. I examined it because it is the evidence a trial pass
on this corpus would rest on, and because `blind-draw.js` — which is in range —
exists to make exactly this reproducible.*

The record states: *"Draw: `blind-draw.js` seed `wo12-round7` — 24 packets (12
seeded, 12 control) … Sorted union: 004, 012, 014, 016, 018, 019, 020, 026, 032,
036, 038, 039, 041, 049, 053, 058, 063, 066, 068, 075, 076, 079, 080, 081."*

```
$ node blind-draw.js --seed wo12-round7 --size 12 --json
all: 004, 014, 016, 018, 019, 020, 021, 026, 030, 031, 035, 038, 039, 041,
     046, 047, 053, 057, 059, 063, 066, 068, 069, 074
```

Fourteen of twenty-four overlap; ten do not, and the recorded draw contains five
of the reused-base controls (075, 076, 079, 080, 081) where the reproduction
contains none. `key.json` and `blind-draw.js` are byte-identical between
`fb20e44` and the commit that carries the record (`git diff --stat fb20e44 HEAD
-- corpus/key.json blind-draw.js` is empty), and the draw is deterministic — I
ran it twice and diffed for identity. I also tried `--exclude` with the full
round-5 draw and three seed spellings; none reproduces the recorded set.

Separately, `CONSTRUCTION.md`'s amendment (vi) section — the artifact built to
carry this evidence, which renders from `corpus/blind-read.json` — still reads
**"NOT RECORDED."** at `fb20e44` and at HEAD. The blind read exists as a
hand-written Markdown record beside it, in the format the section was written to
replace. Third round carrying this.

Two remedies, both cheap: re-run `blind-draw.js` and record the seed that
actually produced the sample (or record the draw's `--json` output verbatim),
and write `corpus/blind-read.json` so the acceptance evidence lives where
amendment (vi) says it lives.

### MINOR

- **[MINOR 1] `assemble-key.js --check-only` exits 0 when briefs on disk differ from generation, so the seal cannot be enforced by exit code.** The usage text says *"lists … every brief on disk that DIFFERS from what generation produces, then exits 1 if anything is missing"* — "missing" is load-bearing and drift is not it. Reproduced: I copied the corpus to a scratch directory, converted the 168 briefs to CRLF, and ran `--check-only --pool <scratch>/corpus/base-pool.json` → *"168 brief file(s) DIFFER from generation and will be overwritten: sdc-001.wo.txt, …"* then `EXIT=0`. On the real corpus the same command reports *"every brief on disk matches generation exactly"*, also exit 0. A CI seal check or a pre-run gate keying on the exit code cannot tell the two apart. Exit 1 on drift, or add `--strict`.
- **[MINOR 2] `corpus/.gitattributes` marks `*.patch`, `briefs/*` and `content/*.json` as `-text` but not `key.json`, `base-pool.json`, `construction-notes.json` or `materialized.json`, so those four are EOL-converted on a Windows checkout.** Reproduced with a real clone: `git -c core.autocrlf=true clone --no-local` of this branch produces `corpus/key.json` with **1443 CR characters** while the briefs and content files come out with 0 (their `-text` attribute holds). Nothing breaks — `JSON.parse` is EOL-agnostic, and `git hash-object` applies the clean filter so `sanitizeClone()`'s key-blob assertion still computes the correct sha (I checked: `hash-object` and `rev-parse HEAD:<path>` agree at `af3b6f3a…`, while `--no-filters` gives `d74c1b9d…`). But re-running `assemble-key.js` on such a checkout rewrites `key.json` wholesale and shows a 1400-line diff that is pure line endings. Add `key.json -text` and friends to the corpus `.gitattributes`, the way the briefs already have it.
- **[MINOR 3] `HEX_IN_BRIEF_RE` misses a 6-character abbreviated sha and any hex token preceded by a word character.** Verified: `"commit 044b85e"` → FAIL (correct); `"commit 044b85"` → **pass**; `"base 0x1234567 was used"` → **pass**; uppercase full sha → FAIL (correct); `"commit-044b85e"` → FAIL (correct). A 6-hex abbreviation is still unique in a repository this size and is as good a join key as a 7-hex one. The false-positive side is real but declared: `"the word defaced appears here"` → FAIL on `"defaced"`. Lower the floor to 6 and add a `0x`-aware boundary.
- **[MINOR 4] `score.js:1128` — gate 3's `ready` predicate does not include `!anyDead`, so a lane carrying runs that produced no verdict can still read PASS, with those controls in the denominator.** Items 1 and 6 both gate on `!anyDead` / `terraDead.length` (`:1018`, `:1240`); item 3's `ready` is `complete && terraControls.length > 0 && !laneHasNoEntries && unadjudicatedFindings.length === 0`. The rate is `falseBlockers.length / terraControls.length`, and `terraControls` counts every control record recorded on the lane including ones that produced nothing. §2.6 caps final UNAVAILABLE at 2 per lane, so the dilution is bounded at 2 of 54 — enough to move the 10% threshold from 5.2 findings to 5.4, which matters exactly once, at 6 vs 5. Round-3 MAJOR 3's fix belongs on this item too.

---

## DISTRIBUTIONAL ANALYSIS

**Reproduction of `CONSTRUCTION.md`.** Recomputed from `corpus/content/*.json` +
`key.json` with my own word splitter, my own sentence splitter, my own
unigram/trigram extractors and the protocol's hardness regexes. **Every
published round-7 figure reproduces to the printed digit.**

| statistic | `CONSTRUCTION.md` | my recomputation |
|---|---|---|
| seeded order words | 151.5 ± 7.4 (136–159) | 151.50 ± 7.38 (136–159) |
| control order words | 147.1 ± 7.4 (135–160) | 147.15 ± 7.43 (135–160) |
| seeded claims words | 81.0 ± 6.2 (66–92) | 81.03 ± 6.16 (66–92) |
| control claims words | 78.8 ± 8.3 (66–95) | 78.81 ± 8.26 (66–95) |
| Δmean order / claims | 4.4 / 2.2 | 4.35 / 2.22 |
| hardness ratio / `only`-free | 0.97 / 0.98 | 0.97 / 0.98 |
| ORDER floor Δ / ceiling Δ / sd ratio | 1 / 1 / 0.99 | 1 / 1 / 0.99 |
| CLAIMS floor Δ / ceiling Δ / sd ratio | 0 / 3 / 0.75 | 0 / 3 / 0.75 |
| digit density seeded / control / Δ | 1.66 / 1.24 / 0.41 | 1.66 / 1.24 / 0.41 |
| backticks | 0 files | **0 of 84** |
| shortest sentence seeded / control / Δmean | 10.93 ± 1.87 [9–17] / 9.59 ± 1.34 [8–12] / 1.34 | **identical** |
| sentences below the 8-word floor | 0 | **0** |
| 3-grams exclusive at df ≥ 6 | 0 | **0** |
| unigrams exclusive at df ≥ 8 | 0 | **0**, and 0 even with no stopword list |
| unigrams exclusive at df 5–7 | 42 | 43 (my tokenizer keeps one word theirs drops) |
| hex tokens in the 168 briefs | 0 (gated) | **0** |

**Forty-plus features over all 84 files. The ones that matter:**

| feature | seeded (n=30) | control (n=54) | d | verdict |
|---|---|---|---|---|
| order words | 151.50 ± 7.38 | 147.15 ± 7.43 | +0.59 | gated; overlapping |
| claims words | 81.03 ± 6.16 | 78.81 ± 8.26 | +0.29 | gated; overlapping |
| ORDER hardness ratio | — | — | — | gated at 0.97 / 0.98 |
| backticks | 0 | 0 | — | gated; dead |
| **`and` count** | **11.40 ± 3.22 [5–19]** | **6.76 ± 2.64 [1–12]** | **+1.62** | **UNGATED — `≥13` is 10S/0C, `≤4` is 0S/9C** |
| **commas / 100 words** | **6.56 ± 1.57** | **5.02 ± 1.57** | **+0.98** | **UNGATED — `≤4.02` is 0S/20C** |
| **shortest sentence** | **10.93 ± 1.87** | **9.59 ± 1.34** | **+0.87** | **gated on the MEAN; both tails 100% pure** |
| **mean ORDER sentence** | **28.85 ± 4.32** | **23.91 ± 7.67** | **+0.74** | **UNGATED — `≤22.14` is 0S/20C** |
| **ORDER sentence count** | **5.37 ± 0.85** | **6.89 ± 2.62** | **−0.70** | **UNGATED — `≥8` is 0S/12C** |
| longest sentence | 47.50 ± 9.31 | 42.11 ± 14.05 | +0.43 | UNGATED — `≤34` is 0S/15C |
| digits / 100 words | 1.66 ± 1.65 | 1.24 ± 0.86 | +0.35 | gated on Δmean (0.41 ≤ 1.5); **`==0` is 10S/0C** |
| sentence-length sd | 12.51 ± 3.35 | 10.97 ± 5.03 | +0.34 | UNGATED |
| CLAIMS sentence count | 3.60 ± 0.67 | 3.63 ± 1.47 | −0.02 | **balanced** — but `≥6` is 0S/8C |
| semicolons | 1.10 ± 1.27 | 1.70 ± 1.33 | −0.46 | UNGATED, overlapping |
| em dashes | 1.07 ± 1.14 | 1.33 ± 1.55 | −0.19 | overlapping |
| colons | 0.67 ± 1.12 | 0.56 ± 0.82 | +0.12 | **balanced** |
| mean word length | 5.26 ± 0.27 | 5.22 ± 0.29 | +0.16 | **balanced** |
| type-token ratio | 0.57 ± 0.05 | 0.57 ± 0.04 | +0.04 | **balanced** |
| mean CLAIMS sentence | 23.16 ± 3.87 | 24.35 ± 7.79 | −0.18 | **balanced** (was −1.08 — genuinely fixed) |
| `[.!?]` + lowercase | 0.07 ± 0.25 | 0.04 ± 0.27 | +0.11 | balanced (the floor's escape hatch is unused) |

**What genuinely improved and should be preserved.** `"Done."` and the whole
punchy register are gone. CLAIMS sentence count and CLAIMS mean sentence length
— d = +1.32 and −1.08 in round 5 — are now −0.02 and −0.18. CLAIMS hardness is
no longer separating. Every one of round-4's six named exclusive unigrams is
dead, verified word by word. Colon density, word length, type-token ratio and
the constraint register remain balanced for the third consecutive round. The
sha channel is completely closed in the brief text. This is not a corpus that
failed to improve; it improved on every axis it measured, and the residue moved
to the axis below — for the fifth time.

**Where the residue is now:** connective and punctuation density (`and`,
commas), ORDER sentence *count* and *length* (the seeds pack 151 words into 5.4
long sentences; the controls spread 147 into 6.9 shorter ones — the exact
inverse of the round-5 pattern, which is what makes it look fixed on the mean),
the digit-free packet, and the tails of the newly gated shortest-sentence
feature.

---

## CLAIMS CHECKED

| Claim | Verdict | Evidence |
|---|---|---|
| "815 checks" — the suite passes | **CONFIRMED** | `node tests/wo12-tooling.test.js` → `OK — 815 passed, 0 failed` (was 642 in round 4; the commit messages' 711 and 809 are intermediate) |
| All pre-existing suites green | **CONFIRMED** | exec-lane 79 · frontmatter-lint 37 · mcp-lane 68 · quartermaster 195 · registry 31 · review-lane 116 · router 135 · scan-lane 41 · verifier 101 · wo12-tooling 815 — **1618 checks, 0 failed** |
| Repo lint clean | **CONFIRMED** | `node install.js --lint` → 43 files, 0 errors, 0 warnings |
| "briefs regenerated from sealed content; all gates pass" | **CONFIRMED** | `node assemble-key.js --check-only` → *"nothing missing … every brief on disk matches generation exactly … every lint passes"* |
| VARIANTS v3 / (xi): "no shas in any brief" | **CONFIRMED** | `hexLint` over all 168 briefs → **0 findings**; 0 briefs contain any prefix of their own `base` or `commit` |
| (xi): "`blind-draw.js` never includes both members of a reused-base pair" | **CONFIRMED** | Linkage is a union-find over shared `base` **or** `commit`; 74 components over 84 artifacts; both `drawKind` calls share one `usedComponents` set. Reproduced with `--size 12`: no two drawn ids share a component |
| (xi): "the pairs stay disclosed" | **CONFIRMED as disclosure, REFUTED as description** | The section exists and lists all ten, but still describes the tell as "an identical `Base` sha **and** an identical `Commit subject:`" when only the subject survives in the brief — MAJOR 4 |
| (xii)(a): sentence floor — "no sentence under 8 words in ORDER or CLAIMS" | **CONFIRMED for the corpus, REFUTED as a guarantee** | 0 sentences below 8 words in all 84. But the splitter only breaks before a capital letter, so `"Done. install.js must not change."` is one 11-word sentence — MAJOR 3 |
| (xii)(a): "per-population mean of the shortest sentence within 3 words" | **CONFIRMED** | Δ 1.34 ≤ 3, reproduced exactly. Both tails remain 100% pure — MAJOR 3 |
| (xii)(b): "any content word in ≥8 artifacts of one population and 0 of the other fails" | **CONFIRMED for the code as written, REFUTED against the protocol's words** | 0 exclusives at df ≥ 8 with my own extractor and no stopword list. The code adds a ≥4-character rule the protocol does not state; `md` 0S/8C and `we` 0S/13C pass — MAJOR 2 |
| (xii): "the corpus is accepted when … the best ungated style classifier no longer reaches 80% precision over 84 artifacts" | **REFUTED** | 85.7% LOO-CV style-only at thr 0.5, 95.0% at 0.7, 96.2% with digits; a nine-rule deterministic list labels 58 of 84 with zero errors — MAJOR 1 |
| "the human-facing standard has been met in every round since round 3" | **CONFIRMED, with a caveat** | Round 3 41.7%, round 4/5 33.3%, round 7 33.3% — all ≤ 65%. The round-7 read is real and its post-mortem (the evaluator chased the V3 hazard arm at 36% precision) is credible. But its draw does not reproduce from its recorded seed — MAJOR 6 |
| Round-7 identity gate: "served_model parsed first; contradiction FAILS; absence is LIMITED" | **CONFIRMED** | All four round-4 shapes re-run: disclaimer → LIMITED, inline contradiction → MISMATCHED, separate line → MISMATCHED, plain echo → LIMITED |
| "gate 5 can now be closed by amendment (viii)'s remedy" | **REFUTED in practice** | `orchestra-review.js` emits no `served_model` anywhere, and the field is read from the model's own stdout, so the only reachable PASS is self-certified — CRITICAL 1 |
| Round-7 MAJOR 4 fix: "the window ends at the next header of any kind" | **CONFIRMED for the two named reproducers, REFUTED as safe** | The `VERIFICATION RE-RUN` and `--- ATTEMPT LOG` hits are dead. A `### CRITICAL` subhead, a `---` rule, and a `--flag` continuation each destroy real findings — CRITICAL 2 |
| Round-7 MINOR 1 fix: a short blocker can now be adjudicated | **CONFIRMED** | The floor is dropped on the coverage path and kept on the promotion path; the operator is shown the full string |
| Round-7 MINOR 2 fix: "`pending` now halts" | **CONFIRMED** | `count + pending > PHASE0_MAX_UNAVAILABLE`, pinned at `tests/wo12-tooling.test.js:3695-3697` |
| Round-7 MINOR 3 fix: "`--override-log` must resolve inside the results directory" | **CONFIRMED** | Relative and outside-the-results-dir paths both refused, pinned at `:3712-3714` |
| Round-7 MINOR 4 fix: "one rule, both loaders" | **CONFIRMED** | `score.js loadKey` validates every id against `buildCorpus.ARTIFACT_ID_RE` |
| Round-7 MINOR 6 fix: the idiom gate's three arms are documented | **CONFIRMED** | Rendered in `CONSTRUCTION.md`; I exercised all three arms and each behaves as the text says |
| "each remaining separation is DISCLOSED in this record" | **REFUTED** | The disclosed set is topic asymmetry, the corpus directory, and the base/subject collisions. Undisclosed: the shortest-sentence tails, `and`/comma density, the digit-free packet, `we`/`md`/`135`, the run-clone directory name — MAJOR 1, 2, 3, 5 |
| "each is … unreachable from a sanitized run clone" | **REFUTED** | The clone is named after the artifact id, and "the diff touches no `.js` file" is 32/33 control inside the clone — MAJOR 5 |
| Corpus shape 84 = 30 + 54; variants 10/10/10 and 18/18/18; phase 0 is 6/6 | **CONFIRMED** | Recomputed from `key.json` |
| Run order is independent of kind | **CONFIRMED** | `sha256(phase + ':' + id)` with an id tiebreak (`run-lane.js:187`), identical on both lanes |
| The sanitized clones leak no corpus metadata | **CONFIRMED** | 0 of 84 HEAD trees contain a `wo12` path, a `roster/wo12` record, a literal `sdc-NNN`, or the seeded-block spellings; 0 dirty worktrees; 0 loose objects; empty reflog; author/committer/date/message byte-identical to the real commit |
| `blind-draw.js` is deterministic | **CONFIRMED** | Two runs of the same seed diff clean; FNV-1a + mulberry32 + Fisher-Yates with no `Math.random`, no locale sort (`Array#sort` default and `<` on strings are code-unit comparisons), no filesystem iteration |
| `assemble-key.js` output is platform-stable | **CONFIRMED with one gap** | No backslashes in `CONSTRUCTION.md` or `key.json`; all sorts are code-unit; the one `readdirSync` (`:626`) feeds a lookup, not an ordering. Briefs and content are `-text` in `corpus/.gitattributes`; `key.json` and three siblings are not — MINOR 2 |
| The corpus is blinded to a human reader | **CONFIRMED (round-7 read, out of range)** | 8/24 = 33.3%, below chance, on the regenerated briefs |
| The corpus is blinded to a classifier | **REFUTED** | 85.7–96.2% LOO-CV precision; 58 of 84 decided at 100% by nine absolute thresholds — MAJOR 1 |
| "`--check-only` … exits 1 if anything is missing" | **CONFIRMED as written, and that is the defect** | 168 differing briefs, `EXIT=0` — MINOR 1 |
| O_EXCL content writes and the directory snapshot guard | **UNCHECKED (out of range)** | `guardedWriteContentFile` / `snapshotContentDir` / `assertContentDirPreserved` are unchanged in `044b85e..fb20e44`; they are round-5 work and were ruled in the round-4 record |

---

## NITS

- The distribution report emits its sections in the order **(4), (6), (7), (5)**, and the idiom section's own text says *"the unigram exclusivity gate (7) below"* when (7) is printed **above** it. Renumber or reorder; the rendered `CONSTRUCTION.md` reads as though a section were missing.
- `isV2AuthorLine(line, head, variant)` keeps a `head` parameter that is now deliberately unused, with a comment saying so. The comment is good practice; the parameter is still dead weight at every call site.
- The label-tell lint is still not zero-tolerance while `CONSTRUCTION.md` says it is (round-4 MINOR 5, unchanged in range). The 14 surviving capitalized-phrase-plus-colon constructions remain balanced and are not a live tell.
- `score.js` still sets `process.exitCode = 0` unconditionally, so `FAIL` and `LIMITED` exit exactly as `PASS` does. Fourth round. With gate 5 now structurally `LIMITED` in any honest run (CRITICAL 1), a consumer scripting on the exit code will read every real trial as a pass.
- `VERSION` is still `2.3.0` with its CHANGELOG entry amended in place, now describing seven sealed states of one corpus.
- `run-lane.js:147-148` — `RUNNER_OWN_RETRIES` / `OUTER_MARGIN_MS` still mirror `orchestra-review.js`'s internal defaults in a second file. Fifth round.
- `tests/wo12-tooling.test.js:1706-1707` — the check is still named *"no RUN ORDER block, no runner command"* and still asserts only `!/DRY RUN — nothing executed/`. Fourth round.
- `keyBlobShaFor` calls `spawnSync('git', ['hash-object', abs])` with **no `cwd`**, so the attribute lookup that makes the sha correct depends on the caller's working directory rather than on `sourceRepo`. It fails loudly (returns null, prints the NOTE) rather than silently, which is why this is a nit — but `{ cwd: sourceRepo }` costs nothing.
- The round-7 comment blocks are, again, the best documentation in the pack: each names the finding, quotes the code it replaced, and states the reasoning. `score.js:1105-1122`'s explanation of why equality makes the 20-character floor unnecessary on one path and necessary on the other is the clearest thing in the file. Keep doing this.

---

## VERIFICATION RE-RUN

`node tests/wo12-tooling.test.js` → **815 passed, 0 failed**.
All ten suites in `tests/` → **1618 checks, 0 failed**, every exit code 0.
`node install.js --lint` → 43 files, 0 errors, 0 warnings.
`node assemble-key.js --check-only` on the sealed corpus → nothing missing,
every brief matches generation, every lint passes.
`node build-corpus.js --all --run-clone-root <scratch>` → all 84 sanitized run
clones built; `corpus/materialized.json` restored with `git checkout --` and
`git status --porcelain` verified clean.
Distribution metrics recomputed independently over all 84 `content/*.json`
against `key.json` — 23 features with mean/sd/range/Cohen d, my own word
splitter, sentence splitter and unigram extractor; an exhaustive single-threshold
scan over every feature for 100%-precision rules; a nine-rule deterministic
decision list; and two logistic regressions (13 and 17 features) evaluated by
leave-one-out cross-validation, 84 refits each.
Gate probes through the exported lint functions: eight sentence-splitter cases
(capital lookahead, lowercase-initial next sentence, no-space, bang, tail
position, em-dash); five synthetic 84-row corpora for unigram exclusivity at
df 7, 8 and 30 and at 3 and 9 characters; seven `hexLint` inputs (7-hex, 6-hex,
`0x`-prefixed, uppercase 40-hex, an a–f English word, a hyphen-prefixed sha, a
10-hex token); all three idiom arms plus a ratio-3.0 case; three digit-density
deltas at 2.0, 1.5 and 1.4.
Independent verification of the published unigram gate with no stopword list at
all (0 at df ≥ 8, 43 at df 5–7) and of the short-token document frequencies
(`we`, `md`, `ten`, `135`).
`score.js` identity gate exercised on six engine-header shapes through
`run-lane.js`'s own `extractEngineHeader`, including two spoofs from verdict
body text; `orchestra-review.js` grepped for `served_model`.
`extractFindingsSection` + `splitFindingBlocks` + `evaluateSeedHit` exercised on
seven verdict shapes against the real `key.json` and `sdc-013`'s CRITICAL seed;
`extractFindingsSection` also run over five real `roster/*.md` records.
All 84 run clones swept for `git status`, loose objects, reflog, refs, commit
identity/message fidelity, tree contents (`wo12`, `roster/wo12`, literal ids,
seeded-block spellings), diffstat shape, `.js`/`.md`/`tests` file counts, history
depth and commit timestamp, with an exhaustive threshold scan over all nine
in-clone numeric features.
`blind-draw.js` run for determinism (two identical `--json` runs, diffed), for
the recorded round-7 seed, for three alternative seed spellings, with the
round-5 exclusion list, and past the pool at `--size 27`.
Cross-platform reproducibility probed with a real `git -c core.autocrlf=true
clone --no-local` of this branch and with a CRLF-converted copy of the corpus run
through `--check-only`; `git check-attr text eol` consulted for the brief,
content and key paths; `git hash-object` compared with and without `--no-filters`
against `rev-parse HEAD:<path>`.
All probes ran in `scratchpad/` directories. The live tree was not modified apart
from this record and the restored `materialized.json`.

---

## Conductor rulings (2026-08-31)

Verdict REVISE accepted in full. Round 8 opens: tooling first, then content
re-authored against the new gate's report, then blind test #4 and a rounds-8 delta.

| # | Ruling | Disposition |
|---|---|---|
| CRITICAL 1 | ACCEPTED | `independent` becomes unreachable from model-authored text: `served_model` is honoured only from a runner-emitted header block that precedes and is delimited from the engine's output; until `orchestra-review.js` emits one, gate 5 reads LIMITED on every lane. The runner gains an `ENGINE BIN:` line (resolved path + sha256) and emits `served_model:` only if the codex CLI reports one — follow-on (iv), own lane. |
| CRITICAL 2 | ACCEPTED | Terminator = a heading at the same or higher level as the one that opened the window, the named next sections, or the literal runner delimiters (`--- ATTEMPT LOG`, `FINALITY:`); severity/bucket subheads and `---` rules are inside the window. Pinned by the seven shapes in the reviewer's table. |
| MAJOR 1 | ACCEPTED — round 8 | New generic gate: over a family of derived features (word/sentence counts, mean/min/max/sd sentence length, commas·semicolons·colons·dashes per 100 words, `and` and other connectives per 100 words, digits per 100 words including the zero bin) no single-feature threshold rule may fire on ≥ 5 artifacts of one population and 0 of the other; the report prints the best rule per feature with its n. Content is re-authored until it passes. |
| MAJOR 2 | ACCEPTED | Unigram arm: minimum length 2, no stopword exemption, bare numbers included as tokens; fail threshold unchanged (df ≥ 8), report 5–7. |
| MAJOR 3 | ACCEPTED | Split on `[.!?]\s` unconditionally with a dotted-token exception list; gate the shortest-sentence range (floor Δ and ceiling Δ) like arm (1), not only the mean. Tail purity is also covered by MAJOR 1's gate. |
| MAJOR 4 | ACCEPTED | `Commit subject:` line removed from the work order (VARIANTS v4); the reviewer has `git log -1` in the clone. Disclosure rewritten to say what survives (nothing in the packet; the pair remains visible to whoever holds `key.json`). |
| MAJOR 5 | ACCEPTED | (a) run clones are named by an opaque per-run token (sha256 of run seed + id, 12 hex) with the id↔token map written beside the results file; (b) the topic-asymmetry disclosure states the per-packet exposure in the reviewer's terms. |
| MAJOR 6 | ACCEPTED, with a correction of record | The round-7 sample was drawn in an earlier session and its provenance is not reproducible from the stated seed; `BLIND-TEST-round7.md` is amended to say so — the sample and score stand as recorded. From round 8: the draw's `--json` output is stored verbatim as `corpus/blind-draw-roundN.json`, and the evaluator's calls are written to `corpus/blind-read.json` so amendment (vi)'s section renders. |
| MINOR 1–4 | ACCEPTED | `--check-only` exits 1 on drift; `.gitattributes` `-text` for the four JSON files; hex floor 6 with a `0x`-aware boundary; gate 3 `ready` includes `!anyDead`. |
| m5 (carried) | ACCEPTED | Label lint made zero-tolerance, matching CONSTRUCTION.md. |
| r3 NIT VERSION | ACCEPTED | Round 8 ships as 2.4.0 with its own CHANGELOG entry. |
| r3 NIT retry/margin mirror | WONTFIX (recorded) | Deliberate: run-lane.js pins the trial's values independently of the runner's defaults so a runner change cannot silently alter a pass. Documented at the constant. |
| r4 NIT test name `:1706` | ACCEPTED | Renamed to what it asserts. |
