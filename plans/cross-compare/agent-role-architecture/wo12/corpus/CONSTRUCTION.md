# WO-12 SDC construction record

Written by `assemble-key.js`. Records what `corpus/key.json` does not carry —
narrative fields, materialization results, the generated-brief shape evidence, and
the deviations the protocol asks to be recorded rather than gated on.

## Tallies (protocol §2.2/§2.3/§2.6/§2.7 targets)

Total: 84 (30 seeded + 54 control)

| Type | count (target 5) |
|---|---|
| CV | 5 |
| OO | 5 |
| LC | 5 |
| FT | 5 |
| HF | 5 |
| RC | 5 |

| Severity | count | target |
|---|---|---|
| CRITICAL | 6 | >=6 |
| MAJOR | 24 | >=20 |
| MINOR | 0 | <=4 |
CRITICAL present in types: CV, FT, HF, LC, OO, RC (target >=4 types)

| Variant | seeds (target 10) | controls (target 18) |
|---|---|---|
| V1 | 10 | 18 |
| V2 | 10 | 18 |
| V3 | 10 | 18 |

| Phase | count | target |
|---|---|---|
| 0 | 12 | 12 |
| 1 | 24 | 24 |
| 2 | 24 | 24 |
| 3 | 24 | 24 |

No target warnings — every §2.2/§2.3/§2.6/§2.7 target is met exactly.

## Brief length report (blinding evidence)

| population | order words (mean ± sd) | claims words (mean ± sd) | ORDER hardness (mean ± sd) |
|---|---|---|---|
| seeded | 151.5 ± 7.2  (n=30, range 136–160) | 83.1 ± 6.4  (n=30, range 69–95) | 2.4 ± 0.6  (n=30, range 1–3) |
| control | 147.5 ± 7.2  (n=54, range 135–158) | 83.2 ± 6.7  (n=54, range 66–92) | 2.6 ± 0.9  (n=54, range 1–4) |
| all | 148.9 ± 7.4  (n=84, range 135–160) | 83.2 ± 6.6  (n=84, range 66–95) | 2.5 ± 0.8  (n=84, range 1–4) |

Bands enforced on EVERY artifact: order 60–160 words, claims 30–100 words (VARIANTS.md v2).

**The bands are not the test — the two populations' MEANS are.** Round 2 shipped a corpus whose bands all
passed while `ORDER < 121 words` identified a control at 100% precision, and a blind reader given only brief
text separated the populations at 83% using constraint register. Both are now HARD GATES, checked before
anything is written:

| gate | value | limit | verdict |
|---|---|---|---|
| \|mean ORDER words seeded − control\| | 4.0 | ≤ 6 | pass |
| \|mean CLAIMS words seeded − control\| | 0.1 | ≤ 6 | pass |
| ORDER hardness ratio (seeded ÷ control) | 0.94 | 0.8–1.25 | pass |
| …the same ratio WITHOUT `only` (sensitivity check) | 0.95 | 0.8–1.25 | pass |

`only` is the most common of the seven hardness terms in ordinary English, so the headline ratio can land
near 1.00 by accident. The second row re-computes it without `only`; both are gated.

The hardness proxy counts whole-word occurrences of `must`, `never`, `exactly`, `only`, `byte-identical`,
`unchanged` and `forbid*` in the ORDER prose — the vocabulary the round-2 blind evaluator named when it
explained how it was telling the populations apart.

### Inline labels (round 4)

A round-3 blind evaluator separated the populations on a purely lexical label — `IN SCOPE:` / `Constraint:`
inside the ORDER prose of 5 seeded content files and 0 controls. Inline labels are now forbidden OUTRIGHT in
`order` and `claims`: a capitalized phrase of up to 4 words followed by a colon, at a line start or after a
sentence end, is a hard failure. A first draft asked only that each label appear in both populations or
neither, but a scan of the sealed corpus found 15 distinct labels of which all 15 were one-population —
labels are bespoke to the change they describe, so they never balance. The skeleton lint cannot see any of
this: `skeletonize()` collapses the whole ORDER block to a single `<ORDER>` token.

**No inline labels in any content file.** (This table is empty in every corpus that assembles — a
non-empty one would have failed the lint.)

### Distribution gates (round 5)

A mean is not enough. Round 4 gated Δmean ORDER, Δmean CLAIMS and the hardness ratio; all three passed while
`ORDER < 135` still identified 8 seeds and 0 controls, backticks 10 seeds and 0 controls, and "leave … alone"
15 controls and 0 seeds. These gates check ranges, dispersion, punctuation and vocabulary.

**(1) Word-count ranges and dispersion**

| field | population | min | max | sd | floor Δ (≤8) | ceiling Δ (≤8) | sd ratio (0.6–1.6) |
|---|---|---|---|---|---|---|---|
| ORDER | seeded | 136 | 160 | 7.2 | 1 | 2 | 1.01 |
| ORDER | control | 135 | 158 | 7.2 | | | |
| CLAIMS | seeded | 69 | 95 | 6.4 | 3 | 3 | 0.95 |
| CLAIMS | control | 66 | 92 | 6.7 | | | |

**(2) Backticks** — forbidden outright in `order` and `claims`, both populations.

pass — no content file carries a backtick.

**(3) Digit density** (digits per 100 words, `order` + `claims`)

| population | mean | sd |
|---|---|---|
| seeded | 1.03 | 0.54 |
| control | 1.01 | 0.46 |

Δmean 0.02 (limit 1.5) — pass

**(4) N-gram exclusivity** — a lowercase 3-gram carrying ≥2 content words (stopwords and bare
numbers excluded), occurring in ≥6 artifacts of one population and 0 of the other.

pass — no 3-gram is exclusive to one population at ≥6 documents.

*Reported, not gated:* 4 3-gram(s) are exclusive to one population at 4–5 documents. That band is published rather than enforced — see
the topic-asymmetry disclosure above for why.

| 3-gram | population | documents |
|---|---|---|
| `the roster directory` | control | 5 |
| `and nothing beyond` | control | 4 |
| `stays exactly as` | control | 4 |
| `the plan s` | control | 4 |

**(6) Sentence shape** — amendment (xii)(a): every sentence in `order` and `claims` carries ≥8 words,
and the two populations' mean SHORTEST sentence agree within 3 words.

| population | shortest sentence (mean ± sd) | min | max |
|---|---|---|---|
| seeded | 10.10 ± 1.16 | 8 | 12 |
| control | 10.30 ± 1.14 | 9 | 12 |

Δmean 0.20 (limit 3) — pass

Δfloor 1 (limit 1) — pass · Δceiling 0 (limit 3) — pass

pass — no sentence is below the 8-word floor.

**(7) Unigram exclusivity** — amendment (xii)(b), widened by (xiii): ANY lowercase token of ≥2 characters —
stopwords and bare numbers INCLUDED — present in ≥8 artifacts of one population and 0 of the other.
Round 7 exempted words under 4 characters, stopwords and numbers, and the separating vocabulary moved
straight under all three: `we` 0S/13C, `md` 0S/8C, `135` 7S/0C.

pass — no word is exclusive to one population at ≥8 documents.

*Reported, not gated:* 32 word(s) exclusive at 5–7 documents.

| word | population | documents |
|---|---|---|
| `beyond` | control | 7 |
| `closing` | control | 6 |
| `confirm` | control | 6 |
| `disposition` | control | 6 |
| `downstream` | control | 6 |
| `flagged` | control | 6 |
| `noted` | control | 6 |
| `redraw` | control | 6 |
| `uninstall` | seeded | 6 |
| `altogether` | control | 5 |
| `blind` | control | 5 |
| `border` | control | 5 |
| `confined` | control | 5 |
| `follow-on` | control | 5 |
| `forward` | control | 5 |
| …17 more | | |

**(5) Idiom balance** — the five watched idioms, gated on three arms.

The watched idioms are "leave … alone", "and nothing else", "as it stands", "must never", "byte-identical".

1. **Present in both populations** — the per-artifact frequency ratio must fall within 0.5–2. This is the arm amendment (x) describes.
2. **Present in one population and absent from the other** — a hard failure. No ratio exists
   here (the denominator is zero), so arm 1 cannot see this case, and it is the *strongest*
   form of the tell rather than a lesser one: an idiom no artifact of the other population
   ever uses is a 100%-precision authorship rule. **This arm is stricter than amendment (x)'s
   text and is enforced regardless.**
3. **Absent from both populations** — passes. An idiom nobody uses cannot separate anyone.

A caution the round-4 review earned: gating a LITERAL string is not the same as removing the
habit behind it. `and nothing else` reads 0/0 here and passes on arm 3, while the habit it
stood for — `with nothing else touched`, `nowhere else`, `anything else`, `anywhere else` —
survived at 12 controls to 0 seeds. The generic test that catches that class is the unigram
exclusivity gate (7) below, not this hand-written list.

| idiom | seeded (total / per artifact) | control (total / per artifact) | ratio | verdict |
|---|---|---|---|---|
| "leave … alone" | 0 / 0.000 | 0 / 0.000 | n/a | absent from both — pass |
| "and nothing else" | 0 / 0.000 | 0 / 0.000 | n/a | absent from both — pass |
| "as it stands" | 0 / 0.000 | 0 / 0.000 | n/a | absent from both — pass |
| "must never" | 3 / 0.100 | 5 / 0.093 | 1.08 | pass |
| "byte-identical" | 1 / 0.033 | 1 / 0.019 | 1.80 | pass |

**(8) Single-threshold purity** — amendment (xiii): over a family of 15 derived features, scanned exhaustively at every observed value in both directions, no rule
`feature <= t` or `feature >= t` may fire on ≥5 artifacts of one population and 0 of the other.

pass — no single-threshold rule reaches 100% precision on ≥5 artifacts.

| feature | best rule | seeded | control | precision |
|---|---|---|---|---|
| ORDER words | `ORDER words >= 159` | 4 | 0 | 100.0% |
| CLAIMS words | `CLAIMS words <= 67` | 0 | 2 | 100.0% |
| ORDER sentence count | `ORDER sentence count <= 3` | 0 | 1 | 100.0% |
| CLAIMS sentence count | `CLAIMS sentence count <= 2` | 0 | 1 | 100.0% |
| mean sentence length | `mean sentence length <= 20.36` | 4 | 0 | 100.0% |
| shortest sentence | `shortest sentence <= 8` | 1 | 0 | 100.0% |
| longest sentence | `longest sentence <= 35` | 2 | 0 | 100.0% |
| sentence-length sd | `sentence-length sd <= 7.23` | 0 | 1 | 100.0% |
| commas per 100 words | `commas per 100 words <= 4.56` | 2 | 0 | 100.0% |
| semicolons per 100 words | `semicolons per 100 words >= 1.45` | 0 | 1 | 100.0% |
| colons per 100 words | `colons per 100 words >= 1.65` | 1 | 0 | 100.0% |
| em/en dashes per 100 words | `em/en dashes per 100 words >= 1.24` | 4 | 0 | 100.0% |
| "and" per 100 words | `"and" per 100 words >= 5.65` | 3 | 0 | 100.0% |
| connectives per 100 words | `connectives per 100 words >= 3.94` | 3 | 0 | 100.0% |
| digits per 100 words | `digits per 100 words <= 0.40` | 2 | 0 | 100.0% |

## Stopping standard (protocol amendment (xii))

> The corpus is blind enough to run when every feature below is gated and passing, the blind-read
> precision is at or below the amendment (vi) ceiling, and each remaining separation is DISCLOSED in this
> record rather than removed. Rounds 3, 5 and 6 each gated the statistic a review named and found the
> separation one level down — means, then ranges, then sentence shape, then vocabulary. The standard is not
> "no reader has noticed yet"; it is "every feature family a reader could key on is measured, and the ones
> that cannot be removed are written down."

| # | gated feature | amendment | verdict |
|---|---|---|---|
| 1 | ORDER / CLAIMS mean word count | (x) | pass |
| 2 | ORDER hardness ratio, and the `only`-free ratio | (x) | pass |
| 3 | inline colon labels | (ix) | pass |
| 4 | word-count ranges (floor, ceiling) and sd ratio | (x) | pass |
| 5 | backticks | (x) | pass |
| 6 | digit density | (x) | pass |
| 7 | 3-gram exclusivity (df ≥ 6) | (x) | pass |
| 8 | idiom balance | (x) | pass |
| 9 | sentence floor (≥ 8 words) | (xii)(a) | pass |
| 10 | shortest-sentence mean parity (≤ 3 words) | (xii)(a) | pass |
| 10b | shortest-sentence RANGE parity (floor ≤ 1, ceiling ≤ 3) | (xiii) | pass |
| 11 | unigram exclusivity (df ≥ 8) | (xii)(b) | pass |
| 12 | no sha in any brief | VARIANTS v3 | pass (enforced by `hexLint` at generation) |
| 13 | single-threshold purity (no rule pure on ≥ 5) | (xiii) | pass |

**Reported but not gated** (evidence for the disclosures above, not failures): 4 3-gram(s) exclusive at 4–5 documents, 32 word(s) exclusive at 5–7 documents.

**Disclosed rather than removed:** the topic asymmetry (the control pool carries docs/records commits the
seeded pool cannot), the corpus-directory oracle (`.patch` / `.seed.json` for exactly the 30 seeded ids),
and the base/subject collisions of the 10 reused-base pairs. Each is a corpus-level property, each is
unreachable from a sanitized run clone, and each has its own section above.

## Structural-tell lint result

Every brief is GENERATED from `corpus/content/<id>.json` through VARIANTS.md v2's
one template set, and the lint below passed before anything was written.

| check | result |
|---|---|
| distinct work-order skeletons across all 84 artifacts | 1 (must be 1) |
| distinct executor-report skeletons within variant V1 | 1 (must be 1) |
| distinct executor-report skeletons within variant V2 | 1 (must be 1) |
| distinct executor-report skeletons within variant V3 | 1 (must be 1) |
| KIND values carried by only one population | 0 (must be 0) |
| distinct KIND values in the corpus | code |

### The KIND ruling

**KIND is declared pool-wide as `code`.** VARIANTS.md v2 keys the V3 hazard list on the
artifact's KIND — "a property of the base commit, shared by seeds and controls alike" — but
`base-pool.json` records no such property (its own `kind` field is the ARTIFACT kind, seeded/control).
The value therefore comes from protocol §2.1's own declaration of the pool: "Base-commit pool: KIND=code,
SIZE S or M, TESTED preferred".

**Rationale — why a per-commit KIND would be wrong.** All 30 seeded bases are code commits, while the 54
controls are drawn from a wider sweep that includes docs-only commits (`base-pool.json`'s allocation note:
"then (c) full_table non-shortlisted kind=docs S/M commits"). Deriving KIND per commit would put `docs` on
controls ONLY, and since the hazard list is keyed on KIND, a V3 report carrying the two-item docs list
would identify its artifact as a control at 100% precision — the round-1 CRITICAL 4 tell (type-derived
hazard lines) re-created in mirror image. One pool-wide KIND gives every V3 artifact the same list, which
carries no information about kind at all.

`resolveKind()` prefers an explicit per-slot field (`base_kind` / `kind_class` / `commit_kind` /
`classKind`) if one is ever added to the pool, and `lintKindSymmetry()` fails assembly closed if any KIND
value ends up carried by only one population — so a second KIND cannot be introduced asymmetrically.

## Cross-artifact base/subject collisions (disclosure, non-gating)

§2.1's pool-ran-short allowance lets a base commit serve one seeded variant AND one control. Where that
happened, the two artifacts share a base commit, a head commit and a subject line.

**What survives of this channel, stated exactly (round-8 MAJOR 4).** Nothing in the packet. The channel had
two halves and both are now closed in the brief text:

- The **sha** half — `Change under review: commit <HEAD>` and `Base (its parent):   <BASE>` — was removed in
  VARIANTS v3 (round 6) and is kept out by `hexLint`, which refuses any 6–40-hex token in any brief.
- The **subject** half — a byte-identical `Commit subject:` line under two different heads, in all ten
  pairs, with the seeded member the lower id in every one — was removed in VARIANTS v4 (round 8). A
  many-packet reader who sorted on that line found ten exact duplicates and knew each pair held exactly
  one seeded artifact: 20 of 84 artifacts reduced to ten forced binary choices from a header field, with
  no prose and no statistics. The reviewer loses nothing — it has `git log -1` inside its own clone.

**What remains, and to whom.** The reuse itself is a property of the committed base-pool allocation, not of
brief generation, so it cannot be removed. It is visible to whoever holds `key.json` — an adjudicator, a
scorer, anyone with repository access — and to nobody else. `blind-draw.js` never draws two artifacts that
share a base or a commit, so the blind test cannot see it either. The pairs are listed below so an
adjudicator reading two packets side by side knows which ones to discount.

| base | subject | artifacts sharing it |
|---|---|---|
| 7bf8e7943063… | WO-11 round 3: Sol·max holistic findings applied (exercise d | sdc-001 (seeded, V1), sdc-075 (control, V3) |
| b8a1957838da… | WO-11: P0 R4 default forecast corrected to WO-2 measured dra | sdc-002 (seeded, V2), sdc-076 (control, V1) |
| 3900142ff195… | WO-8 round 5f: pre-add records as a hard prerequisite; resid | sdc-003 (seeded, V3), sdc-077 (control, V2) |
| 7c8d6dde015e… | WO-8 round 5e: checkout identity from git's own records; gua | sdc-004 (seeded, V1), sdc-078 (control, V3) |
| e5d3d9bb8209… | WO-8 round 5d: fail-closed identity capture; lock-condition  | sdc-005 (seeded, V2), sdc-079 (control, V1) |
| 4e509b581a65… | WO-8 round 5c: creation-time canonical identity for live che | sdc-006 (seeded, V3), sdc-080 (control, V2) |
| 5758a2d2b614… | WO-8 round 5b: the sweep's live-set exemption compares REAL  | sdc-013 (seeded, V2), sdc-081 (control, V3) |
| 3d545b94e89c… | WO-8 round 5: structural sweep guard — the CRITICAL both CI  | sdc-015 (seeded, V3), sdc-082 (control, V1) |
| 8ded8ad12038… | WO-8 round 4: fix all four R0-EX4 findings; record the R0-EX | sdc-039 (seeded, V2), sdc-083 (control, V2) |
| 444eaf3c84b5… | WO-8 round 3: fix all five R0-EX3 findings; record the R0-EX | sdc-041 (seeded, V3), sdc-084 (control, V3) |

**10 collision group(s).**

### The corpus directory is an oracle — and it is out of every lane's reach

Round-3 R0 MINOR (A-m5), disclosed here because the same adjudicator who reads the collisions above reads
this. A bare `ls` of `corpus/` labels the entire key: a `.patch` and a `.seed.json` exist for exactly the 30
SEEDED ids and for no control. The seeded ids also occupy contiguous blocks (`001-006`, `013-020`,
`037-044`, `061-068`). Neither can be removed without moving the corpus off disk.

**This oracle is reachable only with repository-level access. It is unreachable from any review lane.**
Every lane runs in a SANITIZED run clone built by `build-corpus.js` `prepareRunClone()`, and
`sanitizeClone()` asserts — it does not assume — that:

- `git for-each-ref` is empty (no branch, tag or remote-tracking ref survives);
- `git rev-list --all` equals `git rev-list HEAD` (nothing is reachable beyond the pinned head's ancestry);
- `git ls-tree -r HEAD -- <wo12 corpus path>` is EMPTY (the corpus is not in the pinned tree);
- `git log --all -- <wo12 corpus path>` is EMPTY (no reachable commit ever touched it);
- the sealed `key.json` blob is absent from the object store (`git cat-file -e` fails).

Controls take the identical path, so the stripping is not itself a tell. A lane therefore cannot list
`corpus/`, cannot `git show` it from any ref, and cannot recover it from history — the oracle exists for a
reader of this repository, never for a reviewer of an artifact.

### Topic asymmetry — a corpus-level property, disclosed

The seeded and control pools are drawn from different slices of this repository's history. Every one of the
30 seeded bases is a CODE commit (a defect has to be injectable into behaviour); the 54 controls are drawn
from a wider sweep that includes documentation and records commits — roughly two dozen of them. The two
populations therefore talk about different subject matter, and no amount of re-phrasing can change that
without misdescribing what the commits actually did.

**The consequence, stated plainly.** A classifier with access to the WHOLE corpus can separate the two
populations by topic. That is real and it is not fixed.

**Why the corpus-level form does not compromise the trial.** §2.4 gives every lane ONE packet in fresh
context. A reviewer holding a single brief about a records commit cannot see the other 83, and the
corpus-level FREQUENCY that makes the signal exploitable is exactly what a per-packet reviewer does not
have. The sanitized run clone (see the section above) puts `wo12/` — key, patches and this record included
— out of every lane's reach, so the distribution cannot be recovered from inside a review either.

**The PER-PACKET exposure, corrected and stated in full (round-8 MAJOR 5(b)).** The paragraph above was
the whole of this disclosure until round 8, and it is not sufficient, because the argument it makes —
"corpus-level frequency is what a per-packet reviewer lacks" — does not hold for an ABSOLUTE rule.
Measured inside the 84 sanitized run clones themselves:

| in-clone observation | n | population | precision |
|---|---|---|---|
| the diff touches ZERO `.js` files | 33 | control 32/33 | 97.0% |
| the diff touches ZERO code files at all | 30 | control 29/30 | 96.7% |
| history depth ≤ 12 | 7 | control | 100% |
| insertions ≥ 661 | 4 | control | 100% |
| ≥ 8 `.md` files touched | 4 | control | 100% |

`git diff --numstat HEAD~1 HEAD` is the first thing any reviewer runs, and *"this change touches only
Markdown and records"* is a PER-PACKET observation, not a corpus-level frequency. What the rule still
needs from outside is its DIRECTION — that "docs-only" means control rather than seeded — and that is the
honest limit of the exposure. So the disclosure is: **the exposure is to a reviewer who has read this
construction record, not only to an adjudicator or a scorer.** A lane in fresh context has not read it,
and cannot reach it from inside its clone; a reviewer who has read it can classify a docs-only packet from
one `git diff --numstat` at 97% precision. It is disclosed here so both readers know exactly which
observations to discount.

**Evidence.** The strongest topic-exclusive 3-grams in the sealed content, with the number of artifacts of
one population carrying each and zero of the other:

| 3-gram | population | documents | example artifacts |
|---|---|---|---|
| `the roster directory` | control | 5 | sdc-050, sdc-051, sdc-052, sdc-054, … |
| `and nothing beyond` | control | 4 | sdc-036, sdc-048, sdc-053, sdc-071 |
| `stays exactly as` | control | 4 | sdc-023, sdc-056, sdc-060, sdc-081 |
| `the plan s` | control | 4 | sdc-010, sdc-046, sdc-060, sdc-076 |

### Amendment (vi) — blind-classification record

(vi) requires a fresh-evaluator blind classification over 12+12 briefs, re-run after every content change
and reported HERE (target: at or near chance; anything above 65% reopens the pass). ROUND-8 MAJOR 6 made this
section the ONLY place the evidence lives: the round-7 read was recorded as hand-written Markdown beside
this file, its draw did not reproduce from the seed it named, and this section still read "NOT RECORDED"
three rounds running. From round 8 the pipeline is mechanical end to end:

1. `node blind-draw.js --seed <s> --size 12 --round <n> --json --out corpus/blind-draw-round<n>.json`
   stores the draw record VERBATIM. That file, not a sentence in a review, is the draw's provenance.
2. The evaluator's calls are written to `corpus/blind-read.json`, and THIS SECTION scores them against
   `key.json`. The scoring is done here, by this tool, so a mis-stated accuracy cannot be recorded.

`corpus/blind-read.json` schema:

```json
{
  "round": 8,
  "evaluator": "a fresh-context agent, no corpus access",
  "date": "2026-09-01",
  "draw": ["sdc-004", "sdc-014", "..."],
  "calls": { "sdc-004": "SEEDED", "sdc-014": "CONTROL" },
  "contentHash": "<sha256 printed by assemble-key.js --check-only>",
  "note": "free text"
}
```

`draw` is the sorted union the evaluator was handed; `calls` is its verdict per id. Precision, recall and
accuracy are COMPUTED below from `calls` against `key.json` — they are not fields anyone writes.
`contentHash` pins the read to the content it was taken on, so a stale read cannot certify a new corpus.

**round:** 8  
**date:** 2026-08-31  
**evaluator:** fresh-context Opus 5 agent, isolated copy of the 24 drawn packets, no repo or corpus access, forbidden cross-packet statistics  
**note:** Blind test #4, drawn from corpus/blind-draw-round8.json (seed round8-blind4). The evaluator's stated signals were requirement-coverage gaps, verification quality (restated-order reports vs falsifiable/self-incriminating ones), and orders that pre-argue the reviewer out of an objection; its seven stake-money-confident ids were sdc-021, sdc-032, sdc-074, sdc-013, sdc-044, sdc-047, sdc-035. Raw evaluator output archived in corpus/BLIND-TEST-round8.md. Scored mechanically by assemble-key.js against key.json; no figure in this file.  

| measure | value | over |
|---|---|---|
| calls scored | 24 | of 24 drawn |
| precision (of the SEEDED calls, how many were seeded) | 25.0% | 3 / 12 |
| recall (of the seeded artifacts drawn, how many were called) | 25.0% | 3 / 12 |
| accuracy (every call, either way) | 25.0% | 6 / 24 |

Within (vi)'s 65% ceiling.

**Content hash matches** (`d1a5532f8941006a…`) — this read was taken on the content sealed here.


## Seeded artifacts

| id | type | severity | locator.file | phase | variant |
|---|---|---|---|---|---|
| sdc-001 | CV | MAJOR | quartermaster/quartermaster.js | 0 | V1 |
| sdc-002 | OO | MAJOR | quartermaster/quartermaster.js | 0 | V2 |
| sdc-003 | LC | MAJOR | verifier/checkout.js | 0 | V3 |
| sdc-004 | FT | MAJOR | tests/review-lane.test.js | 0 | V1 |
| sdc-005 | HF | MAJOR | tests/review-lane.test.js | 0 | V2 |
| sdc-006 | RC | MAJOR | verifier/checkout.js | 0 | V3 |
| sdc-013 | CV | CRITICAL | verifier/checkout.js | 1 | V2 |
| sdc-014 | CV | MAJOR | router/router.js | 1 | V3 |
| sdc-015 | OO | CRITICAL | verifier/checkout.js | 1 | V3 |
| sdc-016 | OO | MAJOR | packs/codex/agents/architect-claude.md | 1 | V1 |
| sdc-017 | LC | MAJOR | skills/orchestra-review/SKILL.md | 1 | V1 |
| sdc-018 | FT | MAJOR | agents/reviewer.md | 1 | V2 |
| sdc-019 | HF | MAJOR | skills/orchestra-status/SKILL.md | 1 | V3 |
| sdc-020 | RC | MAJOR | agents/detective.md | 1 | V1 |
| sdc-037 | CV | MAJOR | .github/workflows/test.yml | 2 | V1 |
| sdc-038 | OO | MAJOR | packs/codex/hooks/orchestra-review.js | 2 | V2 |
| sdc-039 | LC | CRITICAL | verifier/checkout.js | 2 | V2 |
| sdc-040 | LC | MAJOR | packs/codex/hooks/orchestra-engine-mcp.js | 2 | V3 |
| sdc-041 | FT | CRITICAL | tests/router.test.js | 2 | V3 |
| sdc-042 | FT | MAJOR | tests/frontmatter-lint.test.js | 2 | V1 |
| sdc-043 | HF | MAJOR | ORCHESTRA.md | 2 | V1 |
| sdc-044 | RC | MAJOR | agents/executor.md | 2 | V2 |
| sdc-061 | CV | MAJOR | hooks/orchestra-guard.js | 3 | V2 |
| sdc-062 | OO | MAJOR | install.js | 3 | V3 |
| sdc-063 | LC | MAJOR | ORCHESTRA.md | 3 | V1 |
| sdc-064 | FT | MAJOR | skills/orchestra-status/SKILL.md | 3 | V2 |
| sdc-065 | HF | CRITICAL | router/router.js | 3 | V2 |
| sdc-066 | HF | MAJOR | packs/codex/hooks/orchestra-review.js | 3 | V3 |
| sdc-067 | RC | CRITICAL | plans/cross-compare/agent-role-architecture/wo7b/score.js | 3 | V3 |
| sdc-068 | RC | MAJOR | packs/codex/hooks/orchestra-review.js | 3 | V1 |

## Materialized heads

| id | base | head |
|---|---|---|
| sdc-001 | 7bf8e794306376835716c422313e85d997eaf7c0 | a14280eaabc8f0e61f01ddaeaf4ffa68123ede21 |
| sdc-002 | b8a1957838da66600f5320d13c83e54c43d59130 | dfc217060a2023b64c73730391146fc2a1ca9272 |
| sdc-003 | 3900142ff195c91ae38de27f45abc58707b63eae | 3523e234256fd3aee90e16c5393be3867eb13e21 |
| sdc-004 | 7c8d6dde015e0ca5c55f535812ab4ddf13d78936 | b50470d0f9cf1ed6cd16b69d190f811066247d50 |
| sdc-005 | e5d3d9bb8209c6a3ecedf85bd1da206138e035bc | 1c651fb18903e8d968624247858564dc9233a134 |
| sdc-006 | 4e509b581a65caee8540ccde895c752823d8c9aa | 54a5dc05836cd3022a198ad38c96c8b6fe161aac |
| sdc-013 | 5758a2d2b6146b613ea062946f7013e1b9dfa3c2 | e09bbc44cbd4b69af3b5d1e52c186205f6686376 |
| sdc-014 | 9f51f627399e76e9a9b8c0d5bcf66a5aea0ec6c5 | 43c83abdf1ae029789982b3af63a66189b37ff7a |
| sdc-015 | 3d545b94e89cdfc8d026e0457e11225820453745 | 77254e801d95ea6a56b8aaea720f261e88ec5f80 |
| sdc-016 | 6f27ea2249a91dc647b8f2ccbbd324a30511f938 | 46c5a4cb9c0970af3f7523be045c3fe1c8ce0d2f |
| sdc-017 | 09d7935626c35679efdee24324f3571bc82a8023 | cbd426483d775b4422a90551ea09150f3cdb033a |
| sdc-018 | 5976da0af59b34d667793d75095e3015b6971720 | 7bda5af543385a1864ccc45803dfb108159e7818 |
| sdc-019 | 8bef840fd971fc792fd85fd41fa623990f1b5420 | e3e8ea9c66a33415e69b9601ccffde7e176a1853 |
| sdc-020 | ea5ef72cc7f829ec41d7e4c6a822e79d95276873 | 59b0e16d4b37b8cbe18a85d936acd5e17bc2f41c |
| sdc-037 | 16871cc06ce7a9569991a23a63fa2f1dfecdf25e | 540c60da758b26a3d1a7d9ad581751bad664d6f5 |
| sdc-038 | 597a4bae65d867e020eff47f0183e87d623dee72 | 10badb8ebee166e195dd79ee3eef18856eb5d2fc |
| sdc-039 | 8ded8ad120382fa63ea5c8de8d32b6cab7eeb38c | f0f578c7b76bb440490c0c2471fbb6e673a5b2a3 |
| sdc-040 | 1cb50b8cad23935aa9a4870c2ba522735f157924 | 5d9363f5429ab08dc4c81ffe316db9ffd3c134c9 |
| sdc-041 | 444eaf3c84b5fa8d370b4df6794fe6c71a84fa73 | cb083613d8f184d7a7d6b7f8da6fe0856e276e38 |
| sdc-042 | c2c8060068f922d2b658d4f65481f58ef0fbb6de | e24b7aef6e8ab8de8aa43ede574da998858d9da4 |
| sdc-043 | 661feb0bc419fb0878e5b67977ed52b07557f0f7 | e66bd414612938e417adb9f0187b2b222d8db541 |
| sdc-044 | eaf446d296cc2359645302ba79c9b23add034a1d | d5c41b9bf7e736a6b16482d11dda69148d7485d6 |
| sdc-061 | 92430aaec54f4f194c904642f0fb3c1da80b0469 | 55b22b39891aa221d0ae95c19e72b14feb570f96 |
| sdc-062 | cd27cdc4704a41a46e98be09399ec3c433966d7a | 24da6cec12426772ba0b743214e1e20129841323 |
| sdc-063 | f5646829776a5dba4c021f4a887dd730bce04b6c | 1c6144e7330e70fe07b6ba7d22062ef7f929fd33 |
| sdc-064 | fc303481ed98af58433dce80b2ee4e70741a93db | 3721b6211b5503fa984af5c621a1f9adb1ef2242 |
| sdc-065 | 0b0148471f91dce49a8ea919349032fb41189626 | 51663fc30a5dc432a79dcf0ffde4051d27cbcd21 |
| sdc-066 | f95818329e8d54bd00d7590c140f06a78bd5ae15 | 4ecfe5becd31a4100640f95142908e40fd47da31 |
| sdc-067 | 0f5c0a08225f417305b395cabdd54fa5528e3b17 | 6b274a055f89af3c33fda63ff73abb6462374965 |
| sdc-068 | 84da4ad73f402ea78ea4e9b1917eed778bf3527c | bd5c5169c5193c059668ee776cf7d433d3887330 |

## Seeder severity deviations

- **sdc-017**: target MAJOR-preferred -> achieved MAJOR — "MAJOR, not CRITICAL: the review still runs and the reviewer still reads the live diff, so no gate silently inverts and nothing is lost or corrupted — but on every codex/dual-engine on-demand review (ordinary use) the claim half of the intent-vs-claim audit never reaches the reviewer, so the pass no longer checks what it claims to check. Above MINOR because the degradation is invisible in the returned verdict."
- **sdc-018**: target MAJOR-preferred -> achieved MAJOR — "The commit states the new primary reviewer carries the identical contract the Codex brief encodes — presume-broken discipline and independent re-verification via the project verification manifest — and the runner brief in the same diff still reads "the executor's pasted output is a claim, not evidence"; the injected clause waives exactly that re-run obligation for the primary engine, so the check the commit claims to pin (independent re-verification) passes vacuously while the two engines silently diverge."
- **sdc-043**: target MAJOR-preferred -> achieved MAJOR — "The order names three sub-items and §5's is the load-bearing one: the whole point of the commit is that policy binds the non-Codex path. Dropping one clause from a three-clause sentence leaves prose that reads complete and internally coherent, so the defect is only findable by checking the report's specific verification claim (and the §8.3/README cross-references) against what §5 actually says — the HF shape. Severity is MAJOR: it violates an explicit order constraint and leaves behavior reachable in ordinary use (any REVIEW_UNAVAILABLE fallback round) weaker than the document elsewhere claims."
- **sdc-044**: target MAJOR-preferred -> achieved MAJOR — "The commit's own goal is wall-clock, so 'do not idle on the suite' reads as an intended optimization rather than an error; the inserted clause sits inside the new heartbeat rule, keeps the rule's original 'before starting the next part' wording so the ordering violation is not visually obvious, and only contradicts rules 5-7 and §8.3's 'the executor verifies' when the reviewer cross-reads the same file and ORCHESTRA.md."
- **sdc-061**: target MAJOR-preferred -> achieved MAJOR — "The order fences the carve-out with one explicit rule — the managed block must survive the simulated write byte-for-byte, and surviving markers are explicitly called out as not sufficient. The variant replaces the verbatim-block containment test with a presence test for the two marker strings, which satisfies the rule's shape but not the rule, while the function's own doc comment and the executor report both still assert verbatim carry-through."
- **sdc-062**: target MAJOR-preferred -> achieved MAJOR — "The commit's stated scope is adding /ultra-plan; the only legitimate reason to touch this loop is that a new skill directory now exists to be stamped. Replacing the wholesale re-stamp with a first-stamp-only guard is an unrequested 'while I was here' improvement to a pre-existing file: it sounds protective (don't clobber local edits), it is invisible on a fresh install (the documented round-trip stays green because the destination never exists), and it silently breaks the installer's advertised update path. It contradicts the file's own idempotent-update contract in the header comment and the README's 'Stamped wholesale … so stale files never linger' paragraph, neither of which the change updates, and the report discloses nothing beyond the in-scope pieces."

## Per-artifact brief content lengths

| id | kind | variant | KIND | order words | claims words |
|---|---|---|---|---|---|
| sdc-001 | seeded | V1 | code | 153 | 80 |
| sdc-002 | seeded | V2 | code | 158 | 81 |
| sdc-003 | seeded | V3 | code | 152 | 88 |
| sdc-004 | seeded | V1 | code | 136 | 94 |
| sdc-005 | seeded | V2 | code | 155 | 79 |
| sdc-006 | seeded | V3 | code | 147 | 82 |
| sdc-007 | control | V1 | code | 156 | 90 |
| sdc-008 | control | V2 | code | 149 | 82 |
| sdc-009 | control | V3 | code | 155 | 92 |
| sdc-010 | control | V1 | code | 149 | 76 |
| sdc-011 | control | V2 | code | 151 | 67 |
| sdc-012 | control | V3 | code | 141 | 71 |
| sdc-013 | seeded | V2 | code | 157 | 88 |
| sdc-014 | seeded | V3 | code | 158 | 90 |
| sdc-015 | seeded | V3 | code | 153 | 88 |
| sdc-016 | seeded | V1 | code | 155 | 92 |
| sdc-017 | seeded | V1 | code | 152 | 83 |
| sdc-018 | seeded | V2 | code | 140 | 92 |
| sdc-019 | seeded | V3 | code | 154 | 85 |
| sdc-020 | seeded | V1 | code | 159 | 69 |
| sdc-021 | control | V1 | code | 157 | 90 |
| sdc-022 | control | V2 | code | 156 | 81 |
| sdc-023 | control | V3 | code | 143 | 78 |
| sdc-024 | control | V1 | code | 144 | 78 |
| sdc-025 | control | V2 | code | 157 | 88 |
| sdc-026 | control | V3 | code | 156 | 92 |
| sdc-027 | control | V1 | code | 155 | 89 |
| sdc-028 | control | V2 | code | 151 | 89 |
| sdc-029 | control | V3 | code | 153 | 88 |
| sdc-030 | control | V1 | code | 153 | 81 |
| sdc-031 | control | V2 | code | 153 | 87 |
| sdc-032 | control | V3 | code | 142 | 86 |
| sdc-033 | control | V1 | code | 141 | 82 |
| sdc-034 | control | V2 | code | 142 | 83 |
| sdc-035 | control | V3 | code | 157 | 82 |
| sdc-036 | control | V1 | code | 141 | 89 |
| sdc-037 | seeded | V1 | code | 159 | 95 |
| sdc-038 | seeded | V2 | code | 156 | 85 |
| sdc-039 | seeded | V2 | code | 145 | 79 |
| sdc-040 | seeded | V3 | code | 155 | 81 |
| sdc-041 | seeded | V3 | code | 138 | 71 |
| sdc-042 | seeded | V1 | code | 141 | 71 |
| sdc-043 | seeded | V1 | code | 143 | 82 |
| sdc-044 | seeded | V2 | code | 160 | 88 |
| sdc-045 | control | V2 | code | 141 | 84 |
| sdc-046 | control | V3 | code | 138 | 84 |
| sdc-047 | control | V1 | code | 145 | 81 |
| sdc-048 | control | V2 | code | 138 | 90 |
| sdc-049 | control | V3 | code | 141 | 77 |
| sdc-050 | control | V1 | code | 138 | 82 |
| sdc-051 | control | V2 | code | 143 | 87 |
| sdc-052 | control | V3 | code | 138 | 78 |
| sdc-053 | control | V1 | code | 155 | 90 |
| sdc-054 | control | V2 | code | 157 | 88 |
| sdc-055 | control | V3 | code | 135 | 75 |
| sdc-056 | control | V1 | code | 141 | 66 |
| sdc-057 | control | V2 | code | 143 | 92 |
| sdc-058 | control | V3 | code | 143 | 80 |
| sdc-059 | control | V1 | code | 147 | 77 |
| sdc-060 | control | V2 | code | 146 | 90 |
| sdc-061 | seeded | V2 | code | 157 | 86 |
| sdc-062 | seeded | V3 | code | 158 | 81 |
| sdc-063 | seeded | V1 | code | 144 | 79 |
| sdc-064 | seeded | V2 | code | 144 | 82 |
| sdc-065 | seeded | V2 | code | 156 | 81 |
| sdc-066 | seeded | V3 | code | 156 | 85 |
| sdc-067 | seeded | V3 | code | 144 | 80 |
| sdc-068 | seeded | V1 | code | 159 | 77 |
| sdc-069 | control | V3 | code | 150 | 91 |
| sdc-070 | control | V1 | code | 145 | 86 |
| sdc-071 | control | V2 | code | 158 | 89 |
| sdc-072 | control | V3 | code | 141 | 75 |
| sdc-073 | control | V1 | code | 157 | 74 |
| sdc-074 | control | V2 | code | 149 | 88 |
| sdc-075 | control | V3 | code | 143 | 70 |
| sdc-076 | control | V1 | code | 158 | 84 |
| sdc-077 | control | V2 | code | 139 | 80 |
| sdc-078 | control | V3 | code | 145 | 89 |
| sdc-079 | control | V1 | code | 138 | 87 |
| sdc-080 | control | V2 | code | 158 | 91 |
| sdc-081 | control | V3 | code | 140 | 79 |
| sdc-082 | control | V1 | code | 141 | 76 |
| sdc-083 | control | V2 | code | 156 | 81 |
| sdc-084 | control | V3 | code | 156 | 92 |
