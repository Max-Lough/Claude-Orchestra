<!-- R0 fallback same-family lane, Claude Opus 5, fresh context, READ-ONLY; scope efe9977..5c65946 (1ff2730 nested-clone guard, 54 control-content commits, 8152b34 corpus regeneration, 5c65946 tooling round 3); round 3; verdict REVISE. -->

REVIEW ENGINE: Claude Opus 5 (R0 Anthropic lane, fresh context, tier: full)

**Lane / casting:** R0, Anthropic casting, Claude Opus 5, fresh context, read-only.
**Date:** 2026-08-31.
**Round:** 3 (delta review).
**Scope:** `efe9977..5c65946` — `1ff2730` (nested-clone guard was one-sided on
macOS/Windows; CI caught it), nine content commits re-authoring all 54 control
ORDER/CLAIMS files to the seeds' register, `8152b34` (corpus re-generated and
re-sealed), `5c65946` (tooling round 3 — 533 checks). Reviewed in a detached
worktree pinned at `5c65946`; every probe ran in `scratchpad/` temp directories.
Nothing in the live tree was modified except this record.

**CROSS-FAMILY DISCLOSURE — `review.cross_family=false`.** The artifacts under
review are Anthropic-authored and this reviewer is Anthropic. This is the
**fallback same-family lane**. Same-family review cannot supply the independence
the mandatory set assumes — read every finding below as correlated with the
author's own blind spots. The dispatcher sets `review.cross_family=false` on this
verdict.

**Predecessor records:** `roster/wo12-r0-review-anthropic-2.md` (0 CRITICAL,
5 MAJOR, 6 MINOR) and `roster/wo12-r0-review-openai-3.md` (4 CRITICAL, 2 MAJOR,
1 NIT). **18 prior findings**, every one ruled below.

---

# VERDICT: REVISE

**0 CRITICAL · 5 MAJOR · 5 MINOR.**

The round-3 tooling work is the strongest of the three rounds. The cross-vendor
path-traversal CRITICAL is genuinely dead — I pointed `prepareRunClone` at
`../victim` with a sentinel file in it and the sentinel survived. Resume works
and refuses duplicates. A lane that emits nothing now drives gates 1, 5 and 6 to
INCOMPLETE instead of certifying itself stable. The `exact-path` suffix tier is
deleted. And the corpus is measurably better blinded to a *reader*: a fresh
evaluator given only 24 brief files scored **50% precision / 33% recall** — chance
— against the 83%/83% of round 2.

What blocks is a single pattern repeated five times: **a fix was applied to the
path the finding named, and the same defect survives on the adjacent path.**

- The three population MEANS became hard gates and pass. The tell moved into the
  **tails and the vocabulary**, where the lint does not look, and a
  seven-feature disjunction now identifies **25 of 30 seeds at 100% precision
  with zero control false positives** — broader coverage than round 2's tell had
  (MAJOR 1).
- Gate 5 records `echoed-request` honestly in its *detail* and still prints
  **PASS** in its *status*, which is the field `overall` and `score-output.json`
  read (MAJOR 2).
- `classifyFileMatch`'s suffix tier is gone; `citesLocatorFile`'s substring
  fallback re-admits the same wrong file, and I promoted `sdc-061` to a HIT from
  an **APPROVE** verdict using a **CLAIMS CHECKED** line about the codex copy
  (MAJOR 3).
- Gate 3 counts per FINDING now; its coverage predicate is an unbounded
  substring test, and `finding: "js:"` covers all three of a control's blockers
  and flips the gate from INCOMPLETE to PASS at 0% (MAJOR 4).
- The phase-0 stop counter reads every lane from disk; on an **unreadable**
  sibling file it swallows the throw and reports zero, disarming the halt
  (MAJOR 5).

---

## CLOSURE TABLE — Anthropic round 2 (`wo12-r0-review-anthropic-2.md`)

### MAJOR

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| M1 | `assemble-key.js:686-696` + `CONSTRUCTION.md:42-52` — blinding gap printed and shipped | **PARTIALLY CLOSED** | The three means are now HARD gates (`populationBalanceLint`, `assemble-key.js:797-838`), run at `:1419` **before** the first `writeAtomic`, and rendered at `CONSTRUCTION.md:57-61`. I recomputed all three independently from `corpus/content/*.json` + `key.json`: **Δmean ORDER 3.20 ≤ 6 · Δmean CLAIMS 1.84 ≤ 6 · hardness ratio 1.0016 ∈ [0.8,1.25]** — CONSTRUCTION.md's figures reproduce to the digit. The blind re-read is at chance (TELLS below). **But the fix relocated the tell rather than removing it — NEW MAJOR 1.** |
| M2 | `score.js:220-221` — `exact-path` suffix tier credits a different file | **PARTIALLY CLOSED** | The tier is deleted (`score.js`, `classifyFileMatch`). Verified: `classifyFileMatch('codex/hooks/orchestra-guard.js','hooks/orchestra-guard.js')` → **`basename-only`** (was `exact-path`), so the mechanical scorer records a near miss. **The identical suffix acceptance survives in `citesLocatorFile` and governs adjudicated promotions — NEW MAJOR 3.** |
| M3 | `run-lane.js:836,855` + `score.js:448,612` — a lane that dies without a verdict is invisible | **CLOSED** | `DEAD_STATUS_RE` / `isUnavailableAttempt` (`run-lane.js:736-744`); retried at `:1016`; counted by `countUnavailableOnDisk` (`:663-679`); `score.js:521-525`. **Ran the round-2 counterexample**: 84 X-Terra records whose final attempt is `NO_VERDICT_LINE`, against a healthy X-Sol → item 1 **INCOMPLETE**, item 5 **INCOMPLETE**, item 6 **INCOMPLETE** (`84/84 = 100.0%; max streak 84; by reason: no-verdict×84`), overall INCOMPLETE. Round 2's "gate 6 PASS at 0%" is gone. |
| M4 | `score.js:519-536` — one-character quote promotes; lane-less entry promotes four lanes | **PARTIALLY CLOSED** | `applyAdjudicatedPromotions` (`score.js:631-710`) now refuses a missing `id`, refuses a missing `lane` with the §2.5 reason, refuses a non-seeded id, enforces `MIN_ADJUDICATION_QUOTE_CHARS = 20`, requires the quote to appear verbatim in **that lane's** record, and requires it to cite the locator file. Verified: `quote:"x"` → rejected (`1 character(s) — too short`); lane omitted → rejected. **Three bypasses remain — NEW MAJOR 3.** |
| M5 | `run-lane.js:822-863` — no resume; a crash re-bills and then wedges scoring | **CLOSED** | `planResume` (`:621-653`), called at `:985` after the P0 gate. Exercised on seven damaged/partial record shapes — no `attempts` key, `attempts:[]`, `attempts` not an array, a null attempt entry, a single `SPAWN_FAILED`, a `COMPLETED` record, an id outside the corpus. Every unusable shape falls to **re-dispatch** (fail-safe); only a terminal record is skipped; a file already holding two records for one id **throws** `wo12DuplicateResults` rather than appending a third. |

### MINOR

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| m1 | key-absence assertion is blob-identity only; silent skip | **CLOSED** | `sanitizeClone` now runs a **path-based** assertion (`build-corpus.js:510`, `git ls-tree -r --name-only HEAD -- <wo12 path>` must be empty) alongside the blob check, and returns `keyBlobChecked` / `pathAssertionsRan` (`:541`) so a skipped check is reported rather than silent. |
| m2 | `score.js:714-719` — gate 3 keyed per artifact, not per finding | **PARTIALLY CLOSED** | Per-finding accounting implemented (`score.js:925-947`). Verified on a control carrying three blocker findings with one honest adjudication entry → **INCOMPLETE**, *"PARTIALLY ADJUDICATED — 2 MAJOR/CRITICAL finding(s) … have no adjudication entry"*. **The coverage predicate is bypassable — NEW MAJOR 4.** |
| m3 | `score.js:694` vs `:524` — `lane` honoured inconsistently | **CLOSED** | Both sides now require `lane`: gate 3 filters `a.lane === 'X-Terra'`, promotions refuse a lane-less entry outright (`:650-656`). One default, both places. |
| m4 | `classifyVerdict` splits on `[\s,;:—–-]+`; `REVIEW UNAVAILABLE` reads COMPLETED | **CLOSED** | `run-lane.js` `classifyVerdict` is now `/^(?:REVIEW[_ ])?UNAVAILABLE(?:[_-][A-Z0-9]+)?\b/i`. Verified all four: `REVIEW_UNAVAILABLE` → UNAVAILABLE · `REVIEW UNAVAILABLE` → **UNAVAILABLE** · `UNAVAILABLE_ENGINE` → **UNAVAILABLE** · `APPROVE — … when the engine is unavailable` → COMPLETED. |
| m5 | contiguous seeded id blocks; a `.patch`/`.seed.json` exists for exactly the 30 seeded ids | **NOT CLOSED** | Unchanged and undisclosed. `corpus/` holds **30 `.patch` + 30 `.seed.json` files, for exactly the 30 seeded ids and no control**; the blocks are still `001-006 / 013-020 / 037-044 / 061-068`. I confirmed the oracle before reading anything else: a bare `ls` of `corpus/` labels the whole key. `CONSTRUCTION.md` discloses the base/subject collisions but says nothing about this. §2.4's fresh context and the sanitized run clone keep it out of a lane's hands, so it stays MINOR — but it is the reason my own blind read had to be delegated (again). |
| m6 | `checkPhaseOrder` accepts a prior phase as complete on any record status | **CLOSED** | `run-lane.js:221-228`: a record whose last attempt is missing or unavailable is pushed to `unusable`. The round-2 counterexample (24 `SPAWN_FAILED` records satisfying phase 0) no longer passes. |

## CLOSURE TABLE — cross-vendor round 2 (`wo12-r0-review-openai-3.md`)

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| C1 | `build-corpus.js:364` — unchecked ids escape `--run-clone-root` before recursive deletion | **CLOSED** | `ARTIFACT_ID_RE = /^sdc-\d{3}$/` + `assertSafeArtifactId` (`build-corpus.js:157-165`), applied at `materializeArtifact` (`:612`) and over **every id in `key.json`** at `loadKey` (`:747`), plus a last-line basename guard on the resolved delete target (`prepareRunClone`, `:572-576`). **Ran the reproducer**: a `victim/` directory with a `SENTINEL` file, `--run-clone-root` given `../victim` → *"refusing to prepare (and recursively delete) a run clone … not a valid artifact id"*, **sentinel intact**; `sdc-001` passes the guard and fails later on git, as it should. `assertSafeArtifactId` refuses all of `../victim`, `sdc-1`, `sdc-0001`, `SDC-001`, `sdc-001/../x`, `''`, `sdc-001\0`, `null`, `'sdc-001 '`. `run-lane.js:832` loads the key through the validating loader, so every path it joins is checked. |
| C2 | `CONSTRUCTION.md:46` — seeded/control brief length is a blinding tell | **PARTIALLY CLOSED** | The named example is dead: **no control is now below 135 order words** (was 95), so `sdc-050`'s "certainly a control" reasoning no longer works, and the means are 3.2 apart, not 16. **The separation inverted into the tails — NEW MAJOR 1.** |
| C3 | `score.js:714` — false-blocker completeness per artifact | **PARTIALLY CLOSED** | As A-m2. The exact counterexample given ("one control with two blocker findings and an adjudication for only one") now reports INCOMPLETE. **NEW MAJOR 4.** |
| C4 | `score.js:427` — "exact served-model identity" compares against an echo of the request | **PARTIALLY CLOSED** | The finding is accepted in the code and in protocol amendment (viii): `identityEvidence` (`score.js:491-496`) labels every such match `echoed-request`, and gate 5's detail carries an explicit `EVIDENCE LIMIT:` sentence. **But the gate's `status` is still PASS — NEW MAJOR 2.** |
| M1 | `run-lane.js:821` — interrupted phases not resumable | **CLOSED** | As A-M5. |
| M2 | `run-lane.js:855` — phase-0 stop counter local to one invocation and lane | **PARTIALLY CLOSED** | `countUnavailableOnDisk` (`:663-679`) reads **every** lane's results file from disk at `:1041`; verified that 4 final-UNAVAILABLE records on X-Sol breach the `>2` rule when X-Terra is the lane being run. **It fails OPEN on an unreadable file — NEW MAJOR 5.** |
| NIT | `tests/wo12-tooling.test.js:1474` — the check's name overstates its assertion | **CLOSED in behaviour, NOT in the test** | The behaviour is fixed: `checkPhaseOrder` now runs at `run-lane.js:860`, **before** the RUN ORDER print at `:866`, with a comment naming this nit. But the assertion (now `tests/wo12-tooling.test.js:1651-1652`) is still only `!/DRY RUN — nothing executed/` while its name claims *"no RUN ORDER block, no runner command"*. Carried to NITS. |

### Closure counts

**18 prior findings ruled. 8 CLOSED · 9 PARTIALLY CLOSED · 1 NOT CLOSED.**
All 4 cross-vendor CRITICALs were attacked directly; C1 is fully closed and I
could not reopen it. C2/C3/C4 are each closed on the path they named and open on
the adjacent one.

---

## NEW FINDINGS

### MAJOR

**[MAJOR 1] `assemble-key.js:797-838` + `wo12-protocol.md:108-115` — the population-balance lint gates three MEANS and nothing else. Squeezing the controls into a narrow band while leaving the seeds wide made the TAILS an exclusive seeded signature. A seven-feature disjunction identifies 25 of 30 seeds at 100% precision with zero control false positives — wider coverage than the round-2 tell it replaced.**

Recomputed independently over all 84 `corpus/content/*.json` against `key.json`
(hardness = whole-word `must|never|exactly|only|byte-identical|unchanged|forbid*`
per ORDER, the lint's own vocabulary):

```
                  seeded (n=30)              control (n=54)          Δmean   Cohen d   F(sd²)
order words    144.3 ± 11.7  [121–159]    147.5 ±  6.9  [135–160]     3.20     -0.36     2.85
claims words    75.2 ± 13.0  [ 57– 99]     77.1 ±  6.7  [ 65– 92]     1.84     -0.19     3.74
ORDER hardness   2.3 ±  1.6  [  0–  6]      2.3 ±  0.5  [  1–  3]     0.00      0.00    10.24
```

The three gated numbers pass, and CONSTRUCTION.md's table reproduces exactly.
Every ungated number does not. **The lint measures no dispersion, no range, and
no vocabulary outside its seven hardness terms** — and the variance ratios are
2.9×, 3.7× and **10.2×**.

The mechanism is amendment (vi) itself. It prescribes a band for **controls
only** — *"135–160 / 65–95 words, ≥2 hard constraints"* — and the authors hit it
perfectly: **54 of 54 controls sit inside 135–160 and 65–95.** The 30 seeds were
never re-authored and still occupy the round-2 band. So "outside the control
band" became a seeded signature. Measured on all 84:

```
rule                              fires   S/C     precision   covers
ORDER words < 135                   8    8S/0C     100.0%     27% of seeds
CLAIMS words < 65                   8    8S/0C     100.0%     27% of seeds
CLAIMS words > 92                   4    4S/0C     100.0%     13% of seeds
ORDER hardness == 0                 3    3S/0C     100.0%     10% of seeds
ORDER hardness >= 4                 7    7S/0C     100.0%     23% of seeds
digits in ORDER > 9                 2    2S/0C     100.0%      7% of seeds
BACKTICK anywhere in the ORDER     10   10S/0C     100.0%     33% of seeds
"leave … alone" / "and nothing
   else" in the ORDER              15    0S/15C    100.0%     28% of controls
```

Union of the seeded rules: **fires on 25 artifacts — 25 seeded, 0 control.
Precision 100.0%, recall 83.3% of the seed population.** Labelling everything
else CONTROL gives **79/84 = 94.0% accuracy against a 64.3% base rate**. Only
`sdc-015, 016, 018, 020, 041` survive it.

Two of these need no distributional knowledge at all, because they are lexical,
not numeric:

- **Backticks.** Exactly **10 of 84 `briefs/*.wo.txt` contain a backtick, and all
  10 are seeded** — `sdc-001` (8), `005`, `013`, `014`, `019` (6), `037` (4),
  `043`, `061`, `065`, `066`. **Zero of the 54 controls contain one.** The seeded
  orders quote identifiers (`` `maxStaleMs` ``, `` `stale`, `ageMs` ``); the
  round-3 control authors never did. This is round-1 CRITICAL 4's "extra ORDER
  blocks" tell in punctuation form, and it is single-brief-visible.
- **`leave … alone` / `and nothing else`** — 15 controls, 0 seeds
  (`sdc-009.wo.txt:15`, `sdc-054.wo.txt:12`, …). The mirror image.

The lint cannot see either: `populationBalanceLint` only ever computes six means.
Nor is amendment (vi)'s own authoring rule enforced — `sdc-076` carries one hard
constraint where (vi) requires ≥2, and nothing complained.

Honest limits, stated. §2.4's fresh-context rule means a lane sees one brief and
cannot compute a threshold in situ, and `CONSTRUCTION.md` (which publishes the
ranges) is unreachable from a sanitized run clone — I re-checked. And the blind
prose read is now at chance (TELLS below), which is a real and large improvement.
That is why this is MAJOR and not CRITICAL. But it is the same finding both
round-2 records called blocking, it is not fixed, and by the deterministic-oracle
measure the corpus is now *more* separable than the version that was rejected:
round 2 had one rule over 21 controls; round 3 has seven rules over 25 artifacts.
The remedy is not a fourth mean. It is to re-author the **seeds** into the same
band and register as the controls, or better, to make the lint refuse any feature
whose seeded and control **ranges are disjoint at either end** — plus a
vocabulary-overlap check, which is what would have caught the backticks.

**[MAJOR 2] `score.js:1018-1022` — gate 5's status is PASS on evidence the protocol itself says is insufficient. `overall` and `score-output.json` read `status`; the caveat lives only in `detail`.**

Amendment (viii) is explicit: *"until then gate 5 is evidence of configuration,
not of service."* The code agrees in prose (`score.js:468-490`) and records
`identityEvidence: 'echoed-request'` per record. Then:

```js
status: !complete || pending.length || terraDead.length ? 'INCOMPLETE'
        : (stillWrong.length === 0 ? 'PASS' : 'FAIL'),
```

`stillWrong` is `identity !== 'MATCHED'`, and `classifyIdentity` returns MATCHED
whenever the header names the requested model — which it always does, because
`orchestra-review.js` builds the header from `CONFIG.model`. Run on a healthy
84-artifact corpus where every header echoes:

```
item 5: PASS | 0 counted run(s) whose served model is not gpt-5.6-terra;
              0 artifact(s) EXCLUDED …; EVIDENCE LIMIT: all 84 matched run(s)
              rest on the runner ECHOING the requested model …
>>> gate 5 status = PASS
```

The gate cannot fail for the thing it names. The file already has the right
mechanism and uses it twice in the same function: gate 3 is INCOMPLETE when the
adjudication has not been done, gate 6 is INCOMPLETE when the answer is not yet
knowable. `echoed && !independent` is exactly that condition and should set
`status: 'INCOMPLETE'`, not decorate a PASS. As written, a reader scanning the
gate table — or any consumer of `score-output.json`, where `detail` is a prose
blob — records §3.1 item 5 as satisfied, and `overall` is computed from `status`
alone.

**[MAJOR 3] `score.js` `citesLocatorFile` — the deleted `exact-path` suffix tier is still alive on the adjudication path, which has no severity floor and searches the whole transcript. I promoted `sdc-061` to a HIT from an APPROVE verdict, quoting a CLAIMS CHECKED line about a different file.**

```js
function citesLocatorFile(quote, locatorFile) {
  for (const c of parseCitations(quote)) {
    if (classifyFileMatch(c.file, locatorFile) === 'exact-path') return true;
  }
  return normalizePath(quote).indexOf(normalizePath(locatorFile)) !== -1;   // <-- raw substring
}
```

The guarded first arm is correct. The **unguarded fallback** is a plain substring
test, so `codex/hooks/orchestra-guard.js` contains `hooks/orchestra-guard.js` and
passes — the precise pair MAJOR 2 was raised about. Three defects compound:

1. **Wrong file.** `citesLocatorFile('[MINOR] codex/hooks/orchestra-guard.js:12 — pack copy stale', 'hooks/orchestra-guard.js')` → `true`.
2. **No severity floor.** Mechanical hits require the seed's severity
   (`sdc-061` is CV/MAJOR); a promotion requires none.
3. **The haystack is the whole transcript.** `verdictText: last.stdout`
   (`score.js:571`) — not `extractFindingsSection(...)`, which is what the
   mechanical scorer uses. PREFLIGHT lines, CLAIMS CHECKED, NITS and any echo of
   the brief all count as "that lane's own verdict".

Demonstrated end to end on the real `key.json`, with a verdict that misses the
seed completely:

```
VERDICT: APPROVE
FINDINGS
- [MINOR] docs/readme.md:3 — a stale link.
CLAIMS CHECKED
- "the guard is centralised" -> PARTIAL: the pack still vendors
  codex/hooks/orchestra-guard.js:12 and it was not touched here.

mechanical hit BEFORE adjudication: false
adjudication entry quotes that CLAIMS CHECKED line (79 chars, passes the 20-char floor)
promotions: 1 | rejected: 0
hit AFTER adjudication: true | adjudicatedPromotion: true
```

`sdc-061`'s locator is `hooks/orchestra-guard.js:339-345`. The reviewer filed an
APPROVE, found nothing, mentioned the vendored copy in passing, and is credited
with the seed — inflating recall, every Wilson interval and gate 1, whose whole
margin is ±1. Fixes: use `classifyFileMatch(...) === 'exact-path'` for the
fallback too, search `extractFindingsSection(verdictText)` rather than raw
stdout, and apply the seed's severity floor to a promotion as to a hit.

**[MAJOR 4] `score.js:930-940` — gate 3's per-finding coverage test is an unbounded bidirectional substring match. One entry whose `finding` is `"js:"` covers every blocker on the artifact and flips the gate from INCOMPLETE to PASS at 0%.**

```js
const covered = entries.some((e) => {
  const t = normalizeWhitespace(String(e.finding || e.quote || ''));
  if (!t) return false;
  const f = normalizeWhitespace(text);
  return f.indexOf(t) !== -1 || t.indexOf(f) !== -1;
});
```

`MIN_ADJUDICATION_QUOTE_CHARS = 20` was added in this same round, in this same
file, for this same field family — and is not applied here. Run against one
control carrying three blocker findings:

```
finding: "[CRITICAL] router/router.js:10 — first blocker …"  -> INCOMPLETE (2 of 3 uncovered)   correct
finding: "js:"                                               -> PASS  0 MAJOR/CRITICAL … = 0.0%
finding: "invented"                                          -> PASS  0 MAJOR/CRITICAL … = 0.0%
finding: "blocker finding"                                   -> PASS  0 MAJOR/CRITICAL … = 0.0%
```

This is the cross-vendor round-2 CRITICAL verbatim — *"gate 3 reports PASS at 0%
instead of INCOMPLETE"* — reachable from a single three-character string, and the
detail line even admits it: *"of **0** NOISE/NOISE adjudication(s) on this lane"*.
A hard qualification gate passes at 0% on zero substantive adjudication. Apply
the 20-char floor and require the entry text to be a substring of the finding
(one direction, not both).

**[MAJOR 5] `run-lane.js:668` — `countUnavailableOnDisk` swallows the read error, so an unreadable sibling-lane results file counts as ZERO unavailable and the §2.6 phase-0 halt silently disarms.**

```js
try { recs = readResults(file); } catch (e) { recs = []; }   // "an unreadable file is handled elsewhere"
```

It is not handled elsewhere. `planResume` → `readResults` protects only the
**current** lane's file; nothing in the driver ever reads the other lane's file
except this function, and this function is the stop condition. Demonstrated:

```
healthy X-Sol file, 4 final UNAVAILABLE   -> X-Sol count = 4  -> breach(>2)? true
SAME file truncated to 70% (a crash mid-write)
                                          -> X-Sol count = 0  -> breach(>2)? false
X-Terra planResume on the same directory  -> todo 2, done 0 -> proceeds normally
```

A truncated results file is not a hypothetical: it is the exact failure mode
`appendResult`'s entire corruption discipline (`:560-570`) was built for, and it
is what a crash mid-write leaves behind. The one moment the halt matters most —
the other lane already burned its budget on a failing engine and died — is the
moment it fails open. A safety stop must fail closed: either halt on an
unreadable file, or count it as a breach and say so.

### MINOR

- **`corpus/CONSTRUCTION.md` — amendment (vi)'s own acceptance test is not in the
  record.** (vi) requires *"a fresh-evaluator blind classification over 12+12
  briefs … re-run after every content change and reported in CONSTRUCTION.md
  (target: precision at or near chance; anything above 65% reopens the pass)."*
  All 54 control content files were re-authored in this round; `CONSTRUCTION.md`
  carries **no round-3 blind number** — only two backward references to the
  round-2 83% figure. I ran the test myself and it passes comfortably (50%
  precision, TELLS below), so the substance is met and this is MINOR rather than
  blocking — but the pre-registered evidence is missing from the artifact that
  exists to carry it.
- **`score.js:900` — `gate12f` throws a raw `TypeError: adjudication.filter is
  not a function`** on any truthy non-array adjudication. The CLI guards it
  (`:396`, *"--adjudication file must be a JSON array"*), so this is reachable
  only through the exported API — but `score.js`'s own test seam uses that API,
  and the two `loadKey` implementations in this pack differ in strictness too
  (`build-corpus.js:747` validates every artifact id, `score.js:361-366` does
  not). `score.js` never joins an id into a path, so nothing is exploitable;
  it is a consistency gap in a file whose whole argument is fail-closed.
- **`build-corpus.js:248-279` — `isCaseInsensitiveFs` returns `true` (fold) when
  no ancestor basename has a letter to swap.** Verified on this platform:
  `isCaseInsensitiveFs('C:/')` → `true`. Correct on win32 and correct by the
  documented fail-closed intent; on a case-sensitive Linux mount rooted at `/`
  it over-refuses. `isInside(parent, child)` also probes only the **parent's**
  filesystem and applies that regime to both sides, so a cross-filesystem
  comparison (NTFS parent, case-sensitive child, or the reverse) uses the wrong
  fold — again in the refusing direction. Empirically the probe is right here:
  `AbcDir` → insensitive, the `WO12_FORCE_CASE_SENSITIVE=1` override is honoured
  before the cache, and the round-3 test matrix over every source×destination
  spelling passes.
- **`countUnavailableOnDisk` counts a record whose *last* attempt is unavailable,
  not one whose retry has been spent.** §2.6 says ">2 **final** UNAVAILABLE". A
  record with one unavailable attempt and no retry yet is counted. This errs
  toward halting, which is the right direction, but the code and the protocol
  say different things.
- **`tests/wo12-tooling.test.js:1651-1652`** — carried from the cross-vendor NIT.
  The behaviour it describes is now correct (`run-lane.js:860` precedes `:866`),
  but the assertion still checks only `!/DRY RUN — nothing executed/` while the
  check's name claims *"no RUN ORDER block, no runner command"*. Assert the
  absence of `RUN ORDER (phase` and the test will pin what it says.

---

## DISTRIBUTIONAL ANALYSIS

**Reproduction of CONSTRUCTION.md.** Recomputed from `corpus/content/*.json` +
`key.json` with my own word-splitter and the protocol's hardness regex. Every
published figure reproduces to the printed digit:

| statistic | CONSTRUCTION.md:46-48 | my recomputation |
|---|---|---|
| seeded order words | 144.3 ± 11.7 (n=30, 121–159) | 144.3 ± 11.7 (n=30, 121–159) |
| control order words | 147.5 ± 6.9 (n=54, 135–160) | 147.5 ± 6.9 (n=54, 135–160) |
| seeded claims words | 75.2 ± 13.0 (n=30, 57–99) | 75.2 ± 13.0 (n=30, 57–99) |
| control claims words | 77.1 ± 6.7 (n=54, 65–92) | 77.1 ± 6.7 (n=54, 65–92) |
| seeded ORDER hardness | 2.3 ± 1.6 (n=30, 0–6) | 2.3 ± 1.6 (n=30, 0–6) |
| control ORDER hardness | 2.3 ± 0.5 (n=54, 1–3) | 2.3 ± 0.5 (n=54, 1–3) |
| gate: Δmean order / claims / ratio | 3.2 / 1.8 / 1.00 | 3.20 / 1.84 / 1.0016 |

**The construction record is honest about what it measures.** The finding is
what it does not measure. Sixteen features computed across all 84 files:

| feature | seeded | control | Δmean | d | verdict |
|---|---|---|---|---|---|
| order words | 144.3 ± 11.7 | 147.5 ± 6.9 | 3.20 | −0.36 | gated; **ranges disjoint below 135** |
| claims words | 75.2 ± 13.0 | 77.1 ± 6.7 | 1.84 | −0.19 | gated; **disjoint below 65 and above 92** |
| ORDER hardness | 2.3 ± 1.6 | 2.3 ± 0.5 | 0.00 | 0.00 | gated; **disjoint at 0 and ≥4** |
| CLAIMS hardness | 0.8 ± 1.2 | 1.6 ± 1.1 | 0.84 | −0.74 | ungated; largest un-gated mean gap, but ranges overlap (0–5 both) |
| **backticks in ORDER** | 1.0 ± 1.9 (max 8) | **0.0 ± 0.0 (max 0)** | 1.00 | 0.86 | **deterministic, 10 seeds / 0 controls** |
| **"leave … alone"/"nothing else"** | **0.00 (max 0)** | 0.31 ± 0.54 (max 2) | 0.31 | −0.72 | **deterministic, 0 seeds / 15 controls** |
| digits in ORDER | 2.2 ± 6.3 (max 33) | 1.2 ± 2.2 (max 9) | 1.05 | 0.25 | disjoint above 9 |
| sentence count | 5.4 ± 1.1 | 5.4 ± 1.0 | 0.03 | 0.02 | **no signal — correctly balanced** |
| order characters | 935 ± 85 | 931 ± 58 | 4.68 | 0.07 | no signal in the mean |
| claims characters | 490 ± 87 | 497 ± 50 | 6.66 | −0.10 | no signal in the mean |
| numbers in ORDER | 0.8 ± 1.8 | 0.6 ± 1.4 | 0.23 | 0.14 | **no signal** |
| numbers in CLAIMS | 2.5 ± 2.7 | 3.2 ± 1.3 | 0.67 | −0.35 | weak, ranges overlap |
| "must never" | 0.07 ± 0.25 | 0.13 ± 0.34 | 0.06 | −0.20 | **no signal — the round-2 tell is dead** |
| "do not"/"don't" | 0.13 ± 0.35 | 0.06 ± 0.30 | 0.08 | 0.24 | **no signal** |
| commas | 8.4 ± 2.9 | 7.4 ± 2.3 | 0.96 | 0.38 | weak, overlapping |
| semicolons | 1.20 ± 1.30 | 0.94 ± 0.94 | 0.26 | 0.24 | **no signal** |

**Answer to "is there a distributional tell the lint does not measure": yes,
seven of them, and a classifier can exploit them at 100% precision.** The
variance asymmetry the question anticipated is real and is the mechanism —
sd 11.7 vs 6.9 on order (F = 2.85), 13.0 vs 6.7 on claims (F = 3.74), 1.6 vs 0.5
on hardness (F = **10.24**) — but variance is only the symptom. The exploitable
form is the **disjoint range floor**: because 54/54 controls were authored into
135–160 / 65–95 while the seeds were left in the round-2 band, the region outside
the control band is *exclusively* seeded. Combined with the two vocabulary tells
(backticks, "leave alone"), the disjunction reaches **precision 100.0%, recall
83.3%, overall accuracy 94.0% vs a 64.3% base rate**.

Two honest qualifications. First, three of the seven rules need the corpus-level
distribution to know their direction, and §2.4 plus the sanitized run clone keep
that away from a lane — this is an attack available to an adjudicator, a scorer,
or anyone holding a handful of leaked labels, not to a review lane in fresh
context. Second, sentence count, digit density, number density, "must never" and
"do not" density are all genuinely balanced; the round-2 register tell really was
fixed, and the round-3 authors deserve that credit. The corpus did not fail to
improve. It improved on the axis it measured and regressed on the axes it did not.

---

## TELLS — corpus blinding re-assessment

**Method.** I could not read blind: the first `ls` of `corpus/` shows a `.patch`
and a `.seed.json` for exactly the 30 seeded ids (A-m5), which is the whole key.
So, as in round 2, the read was **delegated to a fresh evaluator with no context
from this review**. I copied the 24 files (`sdc-002, 041, 062, 067, 018, 040`
seeded; `sdc-009, 027, 054, 083, 035, 075` control) into a scratch directory,
**renamed them `item-01 … item-12` in a shuffled order**, and rewrote every
occurrence of the id inside each file — verified zero residual `sdc-0` strings.
The evaluator was told nothing about the seeded/control ratio (so it could not
solve a matching problem), was forbidden the repository, and returned a hard
label plus 1-5 confidence for each. `key.json` was opened only afterwards.

| item | id | variant | truth | guess | conf | the evaluator's stated reason |
|---|---|---|---|---|---|---|
| 01 | sdc-027 | V1 | control | **CONTROL** ✓ | 1 | its two signals disagreed; broke the tie on attribution |
| 02 | sdc-062 | V3 | seeded | CONTROL ✗ | 2 | anonymous attribution + hazard checklist |
| 03 | sdc-075 | V3 | control | **CONTROL** ✓ | 4 | recognised the real commit pair from its own ambient context |
| 04 | sdc-002 | V2 | seeded | **SEEDED** ✓ | 3 | named-model attribution line; "IN SCOPE, nothing else" |
| 05 | sdc-040 | V3 | seeded | CONTROL ✗ | 2 | anonymous attribution + hazard checklist |
| 06 | sdc-083 | V2 | control | SEEDED ✗ | 3 | named-model attribution line |
| 07 | sdc-067 | V3 | seeded | CONTROL ✗ | 2 | anonymous attribution + hazard checklist |
| 08 | sdc-054 | V2 | control | SEEDED ✗ | 3 | named-model attribution line |
| 09 | sdc-041 | V3 | seeded | CONTROL ✗ | 2 | anonymous attribution + hazard checklist |
| 10 | sdc-009 | V3 | control | **CONTROL** ✓ | 2 | discloses scope limits rather than only successes |
| 11 | sdc-035 | V3 | control | **CONTROL** ✓ | 2 | volunteers an unmet obligation |
| 12 | sdc-018 | V2 | seeded | **SEEDED** ✓ | 3 | named-model attribution line |

**Scoring: TP 2 · FP 2 · FN 4 · TN 4. Precision 50.0% · recall 33.3% · accuracy
50.0%.** Round 2 was 83.3/83.3/83.3. **Amendment (vi)'s gate — "anything above
65% reopens the pass" — is met with room.**

**Why it landed at chance is the interesting part.** The evaluator's top-ranked
signal, which it said "carried essentially my whole signal", was the **V2 author
line and the V3 hazard checklist**. That is the packet **variant**, which is
10/10/10 seeded and 18/18/18 control — orthogonal to kind by construction. It bet
its whole answer on a decoy and got exactly chance. Its own summary is the right
epitaph: *"On the brief prose alone I would be at chance."* It explicitly tested
and **discarded** the round-2 signal: *"Presence of an explicit prohibition in
the ORDER — noise. I expected 'Constraint:', 'must never', 'byte-unchanged', 'do
not touch', 'nothing else' to concentrate in seeded items. They do not."* My
numbers agree: "must never" d = −0.20, "do not" d = 0.24, hardness ratio 1.00.
It also found **no arithmetic contradiction anywhere in either population**,
which is a real point in the corpus's favour — the fabricated verification
figures interlock with the real ones.

**Signals confirmed DEAD — preserve these.**

| Signal (prior status) | Now |
|---|---|
| Extra work-order sections (round-1, 7 seeds / 0 controls) | Gone; one generated template, 1 WO skeleton across 84 |
| Executor reports breaking the no-fresh-claims template | Gone; 1 ER skeleton per variant |
| V3 hazard lines outside the control vocabulary | Gone; pool-wide KIND `code`, `lintKindSymmetry` fails closed |
| `git log -1` metadata (round-1, 30/30) | Gone |
| Seed head absent from an unmaterialized clone | Gone from the lane's reach |
| ORDER < 121 words → CONTROL at 100% (round-2, 21 of 54) | **Gone** — no control is below 135 now |
| Constraint-register density (round-2 top signal, 83%) | **Gone** — hardness ratio 1.00, blind reader discarded it explicitly |
| Sentence count, digit density, number density, comma/semicolon density | **Balanced; no signal** |
| V1/V2/V3 attribution and hazard block | **Orthogonal, and it worked as a decoy** |

**Signals ALIVE — see MAJOR 1.** Range floors on order words (<135), claims words
(<65, >92) and hardness (0, ≥4); backticks in the ORDER (10S/0C); "leave … alone"
/ "and nothing else" (0S/15C); digits > 9. Union: 25 artifacts at 100% precision.
None of these was reachable by the blind reader, all are reachable by anyone with
corpus-level access.

**What must change before 12h means anything.** Re-author the 30 **seeds** into
the same 135–160 / 65–95 / ≥2-hard band the 54 controls were put into, so the
bands are the property of the corpus rather than of one population; and extend
the lint from three means to a **range-disjointness** check plus a
**vocabulary-overlap** check (any token class present in one population and
absent from the other), which is the only shape of test that would have caught
the backticks.

---

## CLAIMS CHECKED

| Claim | Verdict | Evidence |
|---|---|---|
| "533 checks" — the suite passes | **CONFIRMED** | `node tests/wo12-tooling.test.js` → `OK — 533 passed, 0 failed`, exit 0 |
| Repo lint clean | **CONFIRMED** | `node install.js --lint` → `43 file(s) … 0 error(s) · 0 warning(s)`, exit 0 |
| All pre-existing suites green | **CONFIRMED** | All ten: exec-lane 79 · frontmatter-lint 37 · mcp-lane 68 · quartermaster 195 · registry 31 · review-lane 116 · router 135 · scan-lane 41 · verifier 101 · wo12-tooling 533 — **1336 checks, 0 failed** |
| "artifact ids validated (`^sdc-\d{3}$`) before any delete path" | **CONFIRMED** | Live reproducer with a sentinel; 9 malformed id forms all refused; `loadKey` validates every key id; `prepareRunClone` re-checks the resolved basename |
| "empirical case-fold probe for the nested-clone guard" | **CONFIRMED** | `isCaseInsensitiveFs` probes by stat'ing the case-swapped sibling, caches per directory, honours the override before the cache, fails closed when inconclusive. Verified on win32; over-refusal edge noted in NITS |
| "no-verdict runs are UNAVAILABLE; gates 1/5/6 INCOMPLETE when a lane has any" | **CONFIRMED** | 84 `NO_VERDICT_LINE` records → items 1, 5, 6 all INCOMPLETE; `100.0%`, streak 84, `no-verdict×84` |
| "UNAVAILABLE classified from the leading token including 'REVIEW UNAVAILABLE'" | **CONFIRMED** | All four spellings probed directly |
| "false-blocker completeness per FINDING" | **CONFIRMED for the accounting, REFUTED for the check** | Per-finding INCOMPLETE reproduced; `finding: "js:"` covers all three and returns PASS at 0% — MAJOR 4 |
| "adjudication entries require lane+id and a ≥20-char quote present verbatim in that lane's verdict citing the locator file" | **PARTIAL** | lane/id/20-char/verbatim all confirmed. "Citing the locator file" is a substring test that accepts a *different* file, the haystack is raw stdout rather than the FINDINGS section, and no severity floor applies — MAJOR 3 |
| "run-lane resumes (terminal records skipped; duplicates refuse)" | **CONFIRMED** | Seven damaged record shapes probed; every ambiguous shape re-dispatches; duplicates throw |
| "phase-0 stop counter read from every lane's results file on disk" | **CONFIRMED with a hole** | Cross-lane counting verified; an unreadable file counts zero — MAJOR 5 |
| "refused dry-run prints no plan" | **CONFIRMED** | `checkPhaseOrder` at `run-lane.js:860` precedes the RUN ORDER print at `:866`. The *test* still under-asserts (NITS) |
| "exact-path suffix tier deleted (cited path must equal the locator after normalization)" | **CONFIRMED for `classifyFileMatch`, REFUTED as a whole** | `codex/hooks/orchestra-guard.js` now returns `basename-only`; `citesLocatorFile` still accepts it — MAJOR 3 |
| "population-balance lint runs before key.json is written and is rendered in CONSTRUCTION.md" | **CONFIRMED** | `assemble-key.js:1419`, before the first `writeAtomic`; `CONSTRUCTION.md:57-61` |
| "controls at the seed register; Δ3.2/Δ1.8/ratio 1.00" | **CONFIRMED as arithmetic, REFUTED as blinding** | All three reproduce exactly. The corpus carries a 100%-precision / 83%-recall oracle — MAJOR 1 |
| "identity gate labels every match echoed-request" | **CONFIRMED for the label, REFUTED for the gate** | `identityEvidence` is correct and the EVIDENCE LIMIT text prints. `status` is still PASS — MAJOR 2 |
| "corpus re-generated and re-sealed" | **CONFIRMED** | `node assemble-key.js --check-only` → *"nothing missing … every brief on disk matches generation exactly … every lint passes"*, exit 0 |
| Corpus shape 84 = 30 seeded + 54 controls; variants 10/10/10 and 18/18/18 | **CONFIRMED** | Recomputed from `key.json` and `content/` |
| Amendment (vi)'s blind classification "re-run after every content change and reported in CONSTRUCTION.md" | **REFUTED as reported; CONFIRMED as substance** | No round-3 blind number in `CONSTRUCTION.md`. I ran it: 50% precision, well inside the 65% gate |
| Amendment (vi)'s control authoring rule "≥2 hard constraints" | **REFUTED on one artifact** | `sdc-076` carries 1; the lint does not check the per-artifact rule |

---

## NITS

- `VERSION` is still `2.3.0` and the 2.3.0 CHANGELOG entry has now been amended
  in place three times. Defensible for an unreleased version; the entry now
  describes three different sealed states of the same corpus.
- `corpus/CONSTRUCTION.md` discloses the base/subject collisions but not the
  `.patch`/`.seed.json` directory oracle (A-m5) nor the contiguous seeded id
  blocks. Both are out of a lane's reach; both belong in the same disclosure
  section as the collisions, since the same adjudicator reads it.
- `populationBalanceLint` returns its six means but not the ranges or standard
  deviations it already has in `rows`; `renderLengthReport` computes and prints
  the sd. One function away from being able to gate on the thing that matters.
- The hardness regex counts `only` — by far the most common of the seven terms in
  ordinary English prose — which makes the proxy easier to satisfy by accident
  than the docstring's "absolute-constraint words" framing suggests. The ratio
  landing at 1.0016 across two independently authored populations is a very tidy
  number for a seven-word bag-of-terms; worth a sensitivity check with `only`
  removed before the ratio is trusted as evidence of register parity.
- `run-lane.js:141-148` — `RUNNER_OWN_RETRIES` / `OUTER_MARGIN_MS` still mirror
  `orchestra-review.js`'s internal defaults in a second file. Carried from
  rounds 1 and 2 with a comment saying so.
- The cross-machine reproducibility claim remains unprovable on one machine.

---

## VERIFICATION RE-RUN

`node tests/wo12-tooling.test.js` → 533 passed, 0 failed (exit 0).
`node install.js --lint` → 43 files, 0 errors, 0 warnings (exit 0).
All ten suites in `tests/` → **1336 checks, 0 failed**.
`node assemble-key.js --check-only` on the sealed corpus → every brief matches
generation, every lint passes (exit 0).
Population-balance metrics recomputed independently over all 84 `content/*.json`
against `key.json` (16 features, means/sd/range/Cohen d/F-ratio); eight
single-feature rules and their disjunction evaluated on all 84.
`prepareRunClone` attacked with `../victim` against a sentinel directory;
`assertSafeArtifactId` exercised on 11 id forms.
`planResume` exercised on seven damaged/partial results shapes;
`countUnavailableOnDisk` exercised healthy and truncated across two lanes.
`gate12f` run end-to-end on three synthetic 168-record corpora (dead lane,
healthy echoing lane, one control with three blocker findings) against the real
`key.json`; `applyAdjudicatedPromotions` and `citesLocatorFile` probed directly.
`classifyVerdict` and `isCaseInsensitiveFs` probed on this platform.
Blind 24-file brief read delegated to a fresh, restricted evaluator over
anonymized, shuffled copies; scored against `key.json` only afterwards.
Review performed in a detached worktree pinned at `5c65946`, removed afterwards;
all probes ran in `scratchpad/` temp directories. The live tree was not modified
apart from this record.
