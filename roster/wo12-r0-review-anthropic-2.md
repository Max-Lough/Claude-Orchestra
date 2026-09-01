<!-- R0 fallback same-family lane, Claude Opus 5, fresh context, READ-ONLY; scope 6f296b6..efe9977 (81ca7cf corpus + efe9977 tooling); round 2; verdict REVISE. -->

REVIEW ENGINE: Claude Opus 5 (R0 Anthropic lane, fresh context, tier: full)

**Lane / casting:** R0, Anthropic casting, Claude Opus 5, fresh context, read-only.
**Date:** 2026-08-31.
**Round:** 2 (delta review).
**Scope:** `6f296b6..efe9977` — `81ca7cf` (WO-12 round 2: corpus re-generated and
re-sealed from content files; briefs v2, CONSTRUCTION, materialized) and `efe9977`
(WO-12 tooling round 2: every R0 finding closed with a pinning test — 376 checks).
Reviewed in a detached worktree pinned at `efe9977`; every probe ran in
`scratchpad/` clones and temp directories. Nothing in the live tree was modified
except this record.

**CROSS-FAMILY DISCLOSURE — `review.cross_family=false`.** The artifacts under
review are Anthropic-authored and this reviewer is Anthropic. This is the
**fallback same-family lane**; the cross-vendor lane runs in parallel. Same-family
review cannot supply the independence the mandatory set assumes — read every
finding below as correlated with the author's own blind spots. The dispatcher sets
`review.cross_family=false` on this verdict.

**Predecessor records:** `roster/wo12-r0-review-anthropic-1.md` (4 CRITICAL,
12 MAJOR — 13 bold entries, 8 MINOR) and `roster/wo12-r0-review-openai-2.md`
(3 CRITICAL, 10 MAJOR — 12 bullets). 37 prior findings in total, every one of
which is ruled below.

---

# VERDICT: REVISE

**0 CRITICAL · 5 MAJOR · 6 MINOR.**

The round-2 work is real and it is good. **Every one of the seven CRITICALs across
both round-1 records is closed, and I could not reopen any of them** — I ran the P0
gate's whole refusal matrix live, materialized a seed and a control and took their
run clones apart with `for-each-ref` / `rev-list` / `fsck` / `packed-refs` /
`.git/logs`, and read a seeded head's `git log -1` beside a control's. There is no
CRITICAL in this round.

What blocks is narrower and mostly of a kind the round-1 fixes created or left
behind: the corpus's own construction record runs a blinding test, **prints a
visible gap, and ships anyway** (MAJOR 1); the new strict-path tier still credits a
genuinely different file on one live seed (MAJOR 2); a lane that dies without
printing a verdict is still invisible to every gate that exists to catch it
(MAJOR 3); the newly-added adjudication promotion accepts a one-character "quote"
and, with `lane` omitted, promotes on all four lanes at once (MAJOR 4); and a phase
still cannot be resumed, so a crash re-bills everything and then wedges the score
permanently (MAJOR 5).

---

## CLOSURE TABLE — Anthropic round 1 (`wo12-r0-review-anthropic-1.md`)

### CRITICAL

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| C1 | `run-lane.js:210-226` — P0 gate fails OPEN | **CLOSED** | `run-lane.js:387-459` (`checkQuartermaster`) + `:757-767`. Pinned by `tests/wo12-tooling.test.js:403` (§6). **Ran the whole matrix myself** with stub quartermasters: crash/exit-1 REFUSE · exit-0 empty stdout REFUSE · JSON without an `OU` bucket REFUSE · Red REFUSE · `exhausted:true` (ladder `Exhausted`) REFUSE · Amber without confirmation REFUSE · Green PASS · Amber + `quartermasterConfirmation:true` PASS. E2E: `WO12_QM_CMD=<crashing script> … --yes` printed the stack trace and **refused**, billing nothing. The ladder is the router's own (`loadLadder`, `:342-351`), and an unloadable router refuses. |
| C2 | `build-corpus.js:75-77,183-202` — seeded commit metadata is a perfect tell | **CLOSED** | `build-corpus.js:224-259` (`readCommitMetadata`, body read as raw bytes from `cat-file`) + `:440-467`. Materialized `sdc-013`: `git log -1` shows `Author: Max-Lough <maxtlough@gmail.com>`, `Sun Aug 30 13:12:35 2026 -0700`, the full multi-paragraph body ending in `Co-Authored-By: Claude Fable 5` / `Claude-Session:` — shaped exactly like control `sdc-021`'s. The `WO-12 seeder` identity, the constant future date and the one-line message are gone. Tests §1 (`:205`), §3 (`:300`). |
| C3 | `run-lane.js:389` + `build-corpus.js:126` — the answer key is inside the reviewer's cwd | **CLOSED** | `build-corpus.js:280-335` (`sanitizeClone`, with assertions) + `:359-381` (`prepareRunClone`, `--no-local --single-branch`); `run-lane.js:827-830` refuses to hand a lane the build clone. **Materialized `sdc-013` (seed) and `sdc-021` (control) with `--run-clone-root` and took both apart:** `for-each-ref` → 0 refs · `remote -v` → empty · `packed-refs` → header line only · `.git/logs/HEAD` → **0 bytes** · `git fsck --lost-found` → silent · `rev-list --all` == `rev-list HEAD` (112/112 and 6/6) · no `wo12` path in the worktree or in `git ls-files`. Also swept all 84 artifacts: **0** have `wo12/` in their tree at all. Controls take the identical path, so the stripping is not itself a tell. Tests §4 (`:316`). |
| C4 | 14/30 seeds identifiable from brief text at 100% precision | **CLOSED for all three named signals** (see NEW MAJOR 1 for the residual) | Briefs are no longer authored — all 168 are **generated** from `corpus/content/<id>.json` through one template (`renderWorkOrder`/`renderExecutorReport`, `:268-305`). `node assemble-key.js --check-only` on the shipped corpus: *"every brief on disk matches generation exactly · every lint passes"*, exit 0. `structuralTellLint` (`:703-739`) proves 1 work-order skeleton across all 84 and 1 executor-report skeleton per variant; V3 hazards come from a closed KIND-keyed vocabulary (`:142-159`) with `lintKindSymmetry` (`:748-763`) failing closed on a one-population KIND. Signal 1 (extra order blocks), signal 2 (specific executor claims), signal 3 (type-derived hazard lines) are all structurally impossible now. Tests §25 (`:1023`), §26 (`:1071`). |

### MAJOR

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| M1 | `score.js:443-452`+`:323` — gate 5 passes on the wrong model; exclusion unimplemented | **CLOSED** | `score.js:423-430` (`classifyIdentity` compares the SERVED model to the lane's), `:553-570` (`identityExclusions`), `:763-779` (gate 5 excludes rather than deadlocks). Verified: `classifyIdentity('REVIEW ENGINE: codex model: gpt-5.6-sol','gpt-5.6-terra')` → `MISMATCHED`. The fabricated-identity half is closed too: `run-lane.js:609-614` anchors the fallback — `extractEngineHeader('some prose about the model: foo bar')` → `null`. Tests §18 (`:818`). |
| M2 | `run-lane.js:244-257` — `appendResult` discards a corrupt results file | **CLOSED** | `run-lane.js:530-562`. Verified live: on a truncated file it **throws** with `wo12ResultsCorrupt`, copies the original to a `.corrupt-<ts>` side file, and leaves the truncated original byte-for-byte. Writes now go through `<file>.tmp` + `renameSync`. Tests §10 (`:641`). |
| M3 | `assemble-key.js:574` vs `:606` — key.json written BEFORE the lints | **CLOSED** | `assemble-key.js:1404-1422`: key + notes built in memory, heads materialized against a **scratch** key file that is removed (`materializeHeads`, `:1230-1258`), `generateAndLint` writes nothing, and `fail()` fires on any finding before the first `writeAtomic`. Tests §32 (`:1262`). |
| M4 | `assemble-key.js:328-333` — `Commit subject:` exemption is unconditional | **CLOSED** | `:619-621` (`isSubjectLine` is an EQUALITY test against the exact template line) + `:635-642`; the `subject.includes(trimmed)` second exemption is gone. Verified: a forged `Commit subject:      seeded defect at locator X` is **flagged** (`leakage term "seed"`), while the genuine subject line is exempt. Tests §23 (`:979`). |
| M5 | `assemble-key.js:392-396` — vendor check scoped to one sentence; no effort/price | **CLOSED** | `:654-662` (`vendorLint` runs over EVERY line of EVERY brief, two exact-line exemptions). `VENDOR_PATTERNS` `:196-217` now carry effort and price. Verified: a V1 body line naming `Codex` is flagged; `A medium-effort xhigh executor at $0.02/1k …` is flagged. `sdc-043` regenerated. Tests §24 (`:995`). |
| M6 | `score.js:160-175` — basename-only default scores a different file as a hit | **CLOSED for the basename tier; PARTIALLY for the class** | Strict is the default (`:211-226`, `:276-284`); verified `tests/quartermaster.js:557` against locator `quartermaster/quartermaster.js:556-559` → `hit:false`, recorded as a `basename-only` near miss; `--lenient-paths` restores the old behaviour and is disclosed. **But the `exact-path` suffix rule still credits a different file — see NEW MAJOR 2.** Tests §15 (`:762`). |
| M7 | `score.js:206-223` — severity floor not enforced | **CLOSED** | `:292-295`. Verified: `'quartermaster/quartermaster.js:557 something odd'` → `hit:false` (near miss, reason `severity`); `'[MINOR] …'` → `hit:true`. Tests §14 (`:734`). |
| M8 | `score.js:415-429` — false-blocker numerator unrestricted | **CLOSED** | `:692-741`: MAJOR/CRITICAL only, on controls only, both-NOISE only; entries with no establishable severity are excluded and listed. Tests §19 (`:843`). |
| M9 | `score.js:532`,`:682-684` — suspects list from half-run results | **CLOSED** | `:878-887`. Verified: scoring the X-lanes alone returns `suspects: null` plus `suspectsWithheldReason`. Tests §20 (`:882`). |
| M10 | `run-lane.js:301` — `INTEGRITY WARNING` scanned in stdout only | **CLOSED** | `run-lane.js:649` tests `stdoutVerbatim` (stdout + stderr) and the verdict line. Tests §12 (`:683`). |
| M11 | `run-lane.js:307` — UNAVAILABLE matched anywhere; and dead-without-verdict statuses counted nowhere | **PARTIALLY CLOSED** | First half CLOSED: `classifyVerdict` (`:596-600`) reads the leading token only — verified `VERDICT: APPROVE — … when the engine is unavailable` → `COMPLETED`, `REVIEW_UNAVAILABLE` → `UNAVAILABLE`. **Second half NOT CLOSED** — `NO_VERDICT_LINE`, `SPAWN_FAILED`, `KILLED_AT_OUTER_TIMEOUT` are still never retried (`:836`), never counted by the phase-0 stop condition (`:855`), and never reach `score.js`'s stability arm (`:612`). See NEW MAJOR 3. |
| M12 | `run-lane.js:363-376` — §2.6 Amber arm, projected draw and phase-0 halt absent | **CLOSED** | Amber arm `:444-458` (the Quartermaster's own re-validated `quartermasterConfirmation`); projected draw `:466-501` + `:758`; phase-0 halt `:856-862` (`PHASE0_MAX_UNAVAILABLE`). Verified: phase 1 without `--draw-per-review` refuses; with a `requiredReserve`-less state JSON refuses rather than inventing a floor; `0.9 − 48×0.02 = −0.06 < 0.15` refuses with the arithmetic quoted. Tests §7 (`:493`), §13 (`:697`). |
| M13 | `build-corpus.js:114-129` — reproducibility not pinned against local git config | **CLOSED** | `GIT_PINS` `:119-126` pin `commit.gpgsign`, `core.autocrlf`, `core.eol`, `core.safecrlf`, `i18n.commitEncoding`, `i18n.logOutputEncoding`; the commit runs `--no-verify`. Verified: `sdc-013` re-materialized to `e09bbc44…` — byte-identical to `materialized.json` and `CONSTRUCTION.md:157` — and again to `e09bbc44…` under `i18n.commitEncoding=ISO-8859-1`. The cross-machine claim is still unprovable on one machine (NIT). Tests §1 (`:205`), §34 (`:1394`). |

### MINOR

| # | Finding | Ruling | Evidence |
|---|---|---|---|
| m1 | bare `FINDINGS` header requirement | **CLOSED** | `score.js:119-120` accept an optional `#`-run and trailing colon; verified `## FINDINGS … ## CLAIMS CHECKED` extracts the block. `emptyFindingsSection` (`:462`) now warns loudly. Tests §16. |
| m2 | seeded slots run before controls in every phase | **CLOSED** | `phaseRunOrder` (`:184-189`). Verified on the real corpus — phase 0 corpus `SSSSSScccccc` → run `SSScccSScScc`; phases 1-3 likewise interleaved; deterministic and lane-independent. Tests §38 (`:1582`), §39 (`:1664`). |
| m3 | 10 seeds share `base` AND `commit` with a control | **NOT CLOSED** | Still exactly 10 pairs (`sdc-001/075` … `sdc-041/084`). The regenerated briefs make the collision *sharper*: `sdc-001.wo.txt` and `sdc-075.wo.txt` now carry a byte-identical `Base (its parent):   7bf8e794…` line **and** a byte-identical `Commit subject:      WO-11 round 3: …` line, differing only in `Change under review: commit …`. Anyone who sees both knows one head is synthetic. §2.4's fresh-context rule keeps it out of a lane's hands, so it stays MINOR — but it is now the sharpest cross-artifact tell left. |
| m4 | `normalizeBrief` rewrote any non-base 40-hex sha | **CLOSED** | Gone by construction — briefs are generated with the real head (`:602-615`); there is no rewriting pass. |
| m5 | `ensureClone` reused any `.git` dir; `path.relative` without realpath | **CLOSED** | `:179-222`: `realResolve` (native realpath) for the nesting guard, `origin` verified against the source and `git fetch --tags --force` on reuse, refusal quoting both paths otherwise. Exercised incidentally — my run-lane E2E reused the probe build clone and the origin check passed. Tests §5 (`:371`). |
| m6 | stale `materialized.json` survives a partial `--all` | **CLOSED** | `:561-562` removes it up front; it is rewritten only on a complete pass. Tests §5. |
| m7 | §3.2 fall-through misstates which half failed | **CLOSED** | `score.js:860-869`. Tests §20. |
| m8 | `--override-p0` not durably ledgered; inert under `--dry-run` | **CLOSED** | `appendOverrideLog` (`:568-573`) + `:805-807`. Verified E2E: with a crashed quartermaster and `--override-p0 "owner probe R0" --yes`, a loud banner printed, one JSON line landed in `wo12/p0-overrides.log` **before** the artifact loop, and the results record carried the full `p0Override` stamp. `--dry-run` prints the explicit inert note (`:717-720`). Tests §8 (`:545`), §9 (`:601`). |

## CLOSURE TABLE — cross-vendor round 2 (`wo12-r0-review-openai-2.md`)

| Finding | Ruling | Evidence |
|---|---|---|
| C `run-lane.js:211` — P0 gate | **CLOSED** | As A-C1. The specific cases named (exit-1 empty response, a valid Red OU response) both refuse; verified. |
| C `score.js:415` — empty adjudication makes gate 3 PASS at 0% | **CLOSED** | `score.js:706-741`. Verified: `--adjudication []` with controls carrying blocker findings → item 3 **INCOMPLETE**, *"NOT ADJUDICATED — the --adjudication file carries no X-Terra entries at all"*; a partially-adjudicated lane → INCOMPLETE naming the ids. Tests §36 (`:1506`). |
| C `score.js:323` — "exact model identity" means a header exists | **CLOSED** | As A-M1. |
| M `run-lane.js:382` — §2.6 phase controls | **CLOSED** | `checkPhaseOrder` (`:203-222`) runs **before** the `--dry-run` branch and is not overridable. Verified: a dry-run of phase 3 with no phase-0 results file refuses, quoting the missing path. Phase-0 halt at >2 UNAVAILABLE is `:856-862`. Tests §35 (`:1425`), §13. |
| M `run-lane.js:244` — persistence not atomic/resumable | **CLOSED for atomicity, NOT for resumability** | Atomic write + refusal verified (A-M2). **Resumability is still absent — see NEW MAJOR 5.** |
| M `build-corpus.js:196` — `i18n.commitEncoding` moves the head | **CLOSED** | Verified: `UTF-8` → `e09bbc44…`, `ISO-8859-1` → `e09bbc44…`. Tests §34. |
| M `score.js:160` — basename-only default | **CLOSED / partially** | As A-M6; NEW MAJOR 2. |
| M `score.js:215` — severity floor | **CLOSED** | As A-M7. |
| M `score.js:318` — adjudicated HIT promotions never applied to recall | **CLOSED** | `applyAdjudicatedPromotions` (`:511-539`), applied at `:1149` before any count; promotions reported as their own count in the report and in `score-output.json`. **The implementation introduces NEW MAJOR 4.** Tests §37 (`:1553`). |
| M `assemble-key.js:392` — vendor lint scope | **CLOSED** | As A-M5. |
| M `assemble-key.js:377` — substring conformance; 12/30 seeded WOs exceed nine lines | **CLOSED** | Conformance is no longer a check over authored text — briefs are generated and `structuralTellLint` proves one skeleton. Residual is a *length distribution*, not a shape: NEW MAJOR 1. |
| M `assemble-key.js:330` — `Commit subject:` exemption | **CLOSED** | As A-M4. |

### Closure counts

**37 prior findings ruled. 34 CLOSED · 2 PARTIALLY CLOSED (A-M6, A-M11) · 1 NOT
CLOSED (A-m3).** All 7 CRITICALs closed; I attacked each one directly and could not
reopen any.

---

## NEW FINDINGS

### MAJOR

**[MAJOR] `assemble-key.js:686-696` + `corpus/CONSTRUCTION.md:42-52` — the corpus's own blinding test prints a visible gap and the corpus ships anyway. Seeded work orders run systematically longer and harder than control work orders; the structural-tell lint is blind to it by construction.**

`renderLengthReport`'s own docstring states the standard (`assemble-key.js:851-855`):

> *"Brief length is exactly the kind of signal a lint cannot see and a reader can: if the seeded orders run systematically longer than the control orders, the word bands are being met and the corpus is still not blind."*

`CONSTRUCTION.md:46-48`, generated by that function from the sealed corpus:

```
| seeded  | 144.3 ± 11.7  (n=30, range 121–159) | 75.2 ± 13.0 |
| control | 128.3 ± 18.3  (n=54, range 95–160)  | 73.1 ± 11.3 |
```

followed, at `:51-52`, by the corpus's own verdict on that table: *"A visible gap is
a blinding finding even though nothing here failed."* The gap is 16 words on the
order, Cohen's *d* ≈ 1.0. Nothing acted on it.

Measured over the sealed corpus:

```
ORDER < 121 words  -> CONTROL at 100% precision, 21 of 54 controls (39%)
ORDER >= 156 words -> SEEDED  at 90.9% precision (10 of 30 seeds, 1 false positive)
work-order line count: seeded 22–27 (mean 24.2), control 19–26 (mean 22.6)
```

The lint cannot see any of it. `skeletonize` (`:325-350`) collapses the whole ORDER
block to a single `<ORDER>` token, so a 160-word order and a 62-word order reduce to
the same skeleton. Demonstrated:

```
hard-order brief line count: 23 | soft-order: 16
SKELETONS IDENTICAL? true
structuralTellLint findings on a 160-word HARD seed vs a 62-word SOFT control: 0
```

The prose half is worse than the numbers, and it is what a lane actually sees. I ran
a **blind re-read** (methodology and scoring under TELLS below): a fresh evaluator
given only the 24 brief files, forbidden every other path, separated the two
populations at **83.3% precision / 83.3% recall (10 of 12)** and went **3 for 3** on
its high-confidence bets — using "density of hard absolute constraints in the ORDER"
as its top-ranked signal. Round 1 removed the *shape* asymmetry; the *register*
asymmetry survived it, because both come from the same root cause the blind reader
named: seeded slots were drawn preferentially from single-invariant behavioural
commits (good injection substrates) while controls draw from docs/chore commits.

Honest limits, stated: this is a distributional tell, not round 1's deterministic
one. §2.4's fresh-context rule means a lane never sees two briefs side by side, so
the numeric threshold is not computable in situ; only the register signal is
single-brief-visible, and my sample is 12 with a self-imposed balanced prior against
a true 30/54 corpus. But 12h's entire factor is this property, the artifact's own
acceptance criterion declares it a finding, and it is not met.

**[MAJOR] `score.js:220-221` — the new `exact-path` tier scores a citation of a genuinely different file as an exact-path HIT. Live on `sdc-061` (CV / MAJOR).**

```js
  if (a.includes('/') && b.endsWith('/' + a)) return 'exact-path';
  if (b.includes('/') && a.endsWith('/' + b)) return 'exact-path';
```

The comment calls this "a genuine path suffix … just possibly
relative-vs-repo-root-relative". It is not: this repository vendors a second copy of
the guard under the codex pack. Swept all 19 distinct locator files against
`git ls-files`: two locators are suffix-matched by a *different* real file, and one
of them is exposed:

```
classifyFileMatch("codex/hooks/orchestra-guard.js","hooks/orchestra-guard.js") = exact-path
sdc-061 (CV/MAJOR) locator hooks/orchestra-guard.js:339-345
  => a finding about the CODEX COPY scores hit=true via=line tier=exact-path
```

A reviewer who writes *"[MAJOR] codex/hooks/orchestra-guard.js:339 — the pack copy
was not updated to match"* — a legitimate, and for a CV/LC seed a very likely,
finding about a file the diff does not touch — is credited with finding the seed.
That inflates recall, every Wilson interval, and 12f gate 1, whose whole margin is
±1. (`ORCHESTRA.md` escapes only because the locator has no directory component and
falls to the basename tier.) The suffix rule needs the shorter side to be a
root-anchored path, or the cited path checked against the artifact's own diff.

**[MAJOR] `run-lane.js:836,855` + `score.js:448,612` — a lane that dies without printing a verdict is invisible to every gate that exists to catch it. §3.1 gate 6 reads 0% instability on a lane that produced nothing at all.**

Round-1 MAJOR 11's second half is not closed. `NO_VERDICT_LINE`, `SPAWN_FAILED` and
`KILLED_AT_OUTER_TIMEOUT` are set (`:652-654`) and recorded, then: not retried
(`:836` retries only `'UNAVAILABLE'`), not counted by the phase-0 stop condition
(`:855`), and not counted by `scoreRecords` (`:448`, `unavailableFinal` only) or
`stabilityForLane` (`:612`). Demonstrated with 84 X-Terra records whose only attempt
is `status:'NO_VERDICT_LINE'`:

```
item 6 (stability): PASS | 0/84 = 0.0%; max streak 0
item 5 (identity):  PASS | 0 counted run(s) whose served model is not gpt-5.6-terra
item 1 (hits):      FAIL | X-Sol hits 30/30; X-Terra hits 0/30
```

Gate 6 exists to decide whether Terra's numbers are trustworthy *at all*; here it
certifies a lane that emitted nothing as perfectly stable, and gate 1 then records
the infrastructure failure as a recall result — *"X-Terra hits 0/30"* — which is
exactly the mis-attribution §3.1 item 6 was written to prevent. Phase 0 would have
run all 12 artifacts and billed all 12 without the stop condition ever arming.

**[MAJOR] `score.js:519-536` — the adjudication promotion accepts any non-blank string as the "quoted citation", and an entry that omits `lane` promotes the seed on EVERY lane at once.**

The docstring at `:507-509` sets the rule it does not implement: *"An entry that says
HIT with nothing quoted is NOT applied … the quote is the evidence, and a promotion
without one is an assertion."* The check is `if (!quote || !String(quote).trim())` —
nothing verifies the quote appears in the record's own verdict text, cites
`locator.file`, or names a line. And `:524`:

```js
const targets = scored.filter((r) => r.id === entry.id && (!entry.lane || r.lane === entry.lane));
```

Demonstrated — one adjudication entry, one character of "evidence":

```
HIT with NO quote            -> promotions 0  (correctly rejected)
HIT quote "x" (no lane)      -> promotions 3  lanes: X-Terra,X-Sol,S-Opus
```

That single line moves 12f gate 1 (`hits(Terra) ≥ hits(Sol) − 1`) on both sides at
once, can clear gate 2 (zero missed CRITICAL seeds), and shifts 12d's
cross-family/same-family union — the one place §3.2's complementarity reading is
decided. §2.5 adjudicates finding by finding on a lane; a lane-less entry is a
data-entry slip that silently rewrites four lanes. Require the quote to be a
substring of the record's verdict text, and require `lane`.

**[MAJOR] `run-lane.js:822-863` — a phase has no resume. A crash re-bills every artifact already recorded, and the duplicate records then wedge scoring permanently.**

The loop dispatches every artifact of the phase unconditionally; nothing consults the
existing results file for ids already recorded. Yet the driver's own refusal texts
instruct the operator otherwise — `:550` *"the artifacts already recorded in it must
not be re-billed"*, `:860` *"… are recorded in <file> and must not be re-billed"*.
There is no way to obey that and still finish the phase.

The consequence is not only cost. Demonstrated with 10 duplicated X-Terra records
(what a resume after a crash at artifact 10 of 24 produces):

```
X-Terra scored records: 94 (key has 84)
gate12f complete: false | overall: INCOMPLETE
item1 detail: X-Sol hits 30/30; X-Terra hits 0/40 (corpus not complete …)
```

`complete` (`:640-641`) demands exactly 84 records per lane, so the phase is pinned
INCOMPLETE forever, and gate 1's denominator becomes 40 over a 30-seed population.
The paired refusal (`appendResult` on a truncated file) and this together mean a
mid-phase crash has no correct recovery: repair-and-rerun re-bills, and
delete-and-rerun re-bills more. `--resume` skipping recorded ids, or a documented
`--only <id>…`, closes it.

### MINOR

- **`build-corpus.js:327-333`, `:342-350`** — the key-absence assertion is
  *blob-identity* based on the **current** `key.json`. A base drawn after the corpus
  was committed would carry an *older* `key.json` blob, whose sha differs, and the
  assertion would pass while an answer key sat in the clone. Today no artifact's tree
  contains `wo12/` at all (swept all 84), so this is latent, not live — but a
  path-based assertion (`git ls-tree -r HEAD -- <wo12 path>` empty, `git log --all
  -- <path>` empty) is what makes the guarantee robust to the pool changing.
  Separately, `keyBlobShaFor` returns `null` when the file is missing **or** when
  `git hash-object` fails, and `sanitizeClone` then skips the assertion **silently**
  (`if (keyBlobSha)`), with no line in the output saying the check did not run.
- **`score.js:714-719`** — gate 3's `needsAdjudication` is keyed per **artifact**,
  not per finding: one adjudication entry satisfies a control carrying three
  MAJOR/CRITICAL findings. The same block's own comment says *"§2.5 adjudicates
  finding by finding"*.
- **`score.js:694` vs `:524`** — the `lane` field is treated inconsistently: gate 3
  ignores an entry with no `lane` (`a.lane === 'X-Terra'`), while promotions honour
  it on every lane. One file, one field, two opposite defaults.
- **`run-lane.js:596-600`** — `classifyVerdict` splits on `[\s,;:—–-]+`, so
  `VERDICT: REVIEW UNAVAILABLE` (space, not underscore) classifies as `COMPLETED`
  and `UNAVAILABLE_ENGINE` likewise. The production runner emits
  `REVIEW_UNAVAILABLE` (`packs/codex/hooks/orchestra-review.js:2303,2895`), so the
  X-lanes are safe — but the docstring says a hand-transcribed lane is accommodated,
  and that is the case this misses.
- **`corpus/key.json` / `base-pool.json` allocation** — seeded ids occupy contiguous
  blocks (`001-006`, `013-020`, `037-044`, `061-068`), and the 10 base+commit
  collisions map seeds `001-006/013/015/039/041` onto controls `075-084` in order.
  Neither is visible to a lane, but both make the key deterministically recoverable
  from a handful of leaked labels — and the corpus directory itself is an oracle:
  a `.patch` and a `.seed.json` exist for exactly the 30 seeded ids and no control.
- **`run-lane.js:215-219`** — `checkPhaseOrder` accepts a prior phase as complete on
  the mere presence of a record per id, whatever its status. 24 `SPAWN_FAILED`
  records satisfy it, and phase 1 proceeds on a phase 0 that measured no draw.

---

## TELLS — corpus blinding re-assessment

**Method.** The reading was delegated to a **fresh evaluator with no context from
this review**, given the absolute paths of exactly 24 files
(`sdc-001/004/007/008/009/013/018/021/022/023/040/067`, `.wo.txt` + `.er.txt`) and a
hard prohibition on reading, listing or grepping anything else — no `key.json`, no
patch, no `.seed.json`, no `materialized.json`, no `VARIANTS.md`, no `.js`, no
directory listing, no git. It was required to output a hard SEEDED/CONTROL label plus
a 1-5 confidence for all 12, and confirmed it read those 24 files and nothing else.
`key.json` was opened only afterwards, to score. I ran the delegation rather than
reading blind myself because I had already seen the corpus directory listing, in
which a `.patch` file exists for exactly the seeded ids — the same oracle my
predecessor used, and a contamination I could not undo.

**Result: the corpus is much better blinded than in round 1, and still not blind.**

| id | truth | guess | conf | the evaluator's reason |
|---|---|---|---|---|
| sdc-001 | seeded | **SEEDED** ✓ | 4 | WO stacks five hard negatives ("ADDITIVE ONLY … never discounted", "Do not modify `router/router.js`"); ER echoes each |
| sdc-004 | seeded | **SEEDED** ✓ | 3 | "Keep fs.realpath off the identity path *entirely*", "must refuse fail-closed", "verbatim" |
| sdc-013 | seeded | **SEEDED** ✓ | 4 | "byte-unchanged", "must **never** become a substring match anywhere in the path"; ER answers clause-for-clause |
| sdc-040 | seeded | **SEEDED** ✓ | 3 | two precise one-token-reproducible hazards; ER claims both |
| sdc-067 | seeded | **SEEDED** ✓ | 3 | densest numeric-threshold brief (24 = 13 + 11, p95 ≤ 1 hop, exit 0/1) |
| sdc-018 | seeded | CONTROL ✗ | 2 | "mostly markdown/brief-roster work; one crisp invariant, asserted loosely" |
| sdc-007 | control | CONTROL ✓ | 2 | broad multi-item round, no single violable invariant |
| sdc-008 | control | CONTROL ✓ | 3 | process/docs commit; softest register in the set |
| sdc-009 | control | CONTROL ✓ | 2 | greenfield build, normal register |
| sdc-021 | control | CONTROL ✓ | 3 | narrative, hedged, goal-framed; no absolute anchors |
| sdc-023 | control | CONTROL ✓ | 3 | README/LICENSE chore |
| sdc-022 | control | **SEEDED** ✗ | 3 | three inversion-shaped invariants in one paragraph; ER restates all three |

**Scoring: precision 5/6 = 83.3% · recall 5/6 = 83.3% · accuracy 10/12 = 83.3%.**
Of the three it would bet on at ≥70% (`sdc-013` S, `sdc-001` S, `sdc-008` C), it went
**3 for 3**.

**The one signal that works, honestly stated.** Density of hard absolute constraints
in the ORDER — *"byte-unchanged", "must never", "exactly as", "ADDITIVE ONLY", "only
when … AND"* — plus a claims block that echoes those negatives clause for clause. The
evaluator's own diagnosis is the right one and worth quoting: *"constraint hardness
in the order text correlates with how injectable the underlying change is, so the top
and bottom of that ranking are informative while the middle eight are not."* It is a
**selection** artefact, not a writing artefact: seeded slots were drawn from
single-invariant behavioural commits, controls disproportionately from docs and chore
commits. That is why the round-1 fixes — which normalized authorship, template and
shape — could not touch it. The MAJOR 1 length gap is the same effect showing up as a
number.

**Signals confirmed DEAD — these are correctly built and should be preserved.**

| Signal (round-1 status) | Now |
|---|---|
| Extra work-order sections (`ORDER AS ISSUED`, `CLAIMS:`, `SCOPE`) — 7 seeds, 0 controls | **Gone.** One generated template; `structuralTellLint` proves 1 WO skeleton across 84. |
| Executor reports breaking the "no fresh claims" template — 7 seeds, 0 controls | **Gone.** Every ER carries a `CLAIMS:` block; 1 skeleton per variant. |
| V3 hazard lines outside the control vocabulary — 7 seeds, 0 controls | **Gone.** Closed KIND-keyed vocabulary; `lintKindSymmetry` fails closed on a one-population KIND. |
| `git log -1` metadata (30/30, 100%) | **Gone.** Verified head-to-head on `sdc-013` vs `sdc-021`. |
| Seed head absent from an unmaterialized clone (30/30) | **Gone from the lane's reach.** The run clone has no refs, no remote, no reflog and nothing beyond HEAD's ancestry. |
| Attribution line / hazard-block presence | **Orthogonal.** The evaluator found a clean 4/4/4 V1/V2/V3 partition in its sample and correctly refused to use it; the corpus is 10/10/10 seeded, 18/18/18 control. |
| Boilerplate, tense, register of the fixed lines, ER line counts | **Byte-identical across all 12.** No exploitable variation. |

**What must change before 12h means anything.** Bring the two ORDER distributions
together — the band (60-160) is satisfied by both populations and is not the test;
the two means are. And normalize constraint register: either give control orders a
comparable count of absolute "must / never / exactly / byte-identical" clauses, or
draw seeded and control slots from the same commit-shape pool so the injectability
correlation stops carrying the signal. Until then 12h measures a reader's feel for
which commits are injectable, at roughly 8-10 of 12, rather than nothing — which is a
real improvement on round 1's 100%-precision structural break, and still not blind.

---

## CLAIMS CHECKED

| Claim | Verdict | Evidence |
|---|---|---|
| "376 checks" — the suite passes | **CONFIRMED** | `node tests/wo12-tooling.test.js` → `OK — 376 passed, 0 failed`, exit 0 |
| Repo lint clean | **CONFIRMED** | `node install.js --lint` → `43 file(s) … 0 error(s) · 0 warning(s)`, exit 0 |
| All pre-existing suites green | **CONFIRMED** | Ran all ten: exec-lane 79 · frontmatter-lint 37 · mcp-lane 68 · quartermaster 195 · registry 31 · review-lane 116 · router 135 · scan-lane 41 · verifier 101 · wo12-tooling 376 — **1179 checks, 0 failed** |
| "corpus re-generated and re-sealed from content files" | **CONFIRMED** | `node assemble-key.js --check-only` → *"nothing missing … every brief on disk matches generation exactly … every lint passes"*, exit 0. All 168 brief files reproduce byte-for-byte from `content/<id>.json`. |
| Structural-tell lint: 1 WO skeleton / 1 ER skeleton per variant | **CONFIRMED** | `CONSTRUCTION.md:59-62` and re-derived from the shipped corpus by `--check-only` |
| "P0-gated lane driver", fail-closed | **CONFIRMED** | 9-case refusal matrix run live (see C1); E2E refusal on a crashed quartermaster with nothing billed |
| §2.6 Amber arm and projected-draw arm implemented | **CONFIRMED** | Amber-without-confirmation refuses; Amber-with-confirmation passes; phase 1 without `--draw-per-review` refuses; a missing `requiredReserve` refuses rather than inventing a floor; `0.9 − 48×0.02` refuses with the arithmetic quoted |
| Sanitized run clone: "no refs, no remote, no reflog, no unreachable object; key blob absent" | **CONFIRMED** | Materialized `sdc-013` and `sdc-021`; `for-each-ref` empty, `remote -v` empty, `packed-refs` header-only, `.git/logs/HEAD` 0 bytes, `fsck --lost-found` silent, `rev-list --all` == `rev-list HEAD` (112/112, 6/6), no `wo12` in worktree or index; swept all 84 artifacts — 0 trees contain `wo12/` |
| "variants commit with the real commit's author/committer/dates/body" | **CONFIRMED** | `git log -1` on `sdc-013`'s head is `Max-Lough`, the real date, and the full body with both trailers |
| Head shas reproduce | **CONFIRMED** | `sdc-013` → `e09bbc44…` matching `materialized.json` and `CONSTRUCTION.md:157`, in a clone made fresh for this review; unchanged under `i18n.commitEncoding=ISO-8859-1` |
| "hits require the locator's path (basename-only is a reported near-miss)" | **CONFIRMED with an exception** | Basename tier verified; the `exact-path` suffix tier still credits `codex/hooks/orchestra-guard.js` on `sdc-061` — NEW MAJOR 2 |
| "identity, false-blocker, adjudication-promotion and phase-order rules follow the protocol text exactly" | **PARTIAL** | Identity, false-blocker and phase-order confirmed by direct probe. Adjudication promotion does **not**: a one-character quote promotes, and a lane-less entry promotes all four lanes — NEW MAJOR 4 |
| "a crash mid-phase loses at most the artifact in flight, never the ones already reviewed" (`run-lane.js:61-64`) | **CONFIRMED for loss; REFUTED for recovery** | The truncated file is preserved and side-filed, nothing is destroyed — but there is no resume, so the recorded artifacts are re-billed on the next run and the duplicates wedge scoring (NEW MAJOR 5) |
| CONSTRUCTION.md's own blinding standard ("a visible gap is a blinding finding") | **REFUTED as met** | The report it generates shows 144.3 vs 128.3 order words; nothing acted on it (NEW MAJOR 1) |
| Corpus shape 84 = 30 seeded + 54 controls; variants 10/10/10 and 18/18/18 | **CONFIRMED** | Recomputed from `key.json` and `content/` |
| Content-file preservation guards (`O_EXCL`, directory snapshot) | **CONFIRMED** | Tests §41 (`:1757`) — the control-file survival checks pass on all four modes; `guardedWriteContentFile` refuses a control slot and refuses to overwrite |
| CHANGELOG records the round-2 closure honestly | **CONFIRMED** | `CHANGELOG.md` 2.3.0, +23 lines, naming both lanes, the four CRITICALs and the content-file incident. VERSION stays 2.3.0 (see NITS) |

---

## NITS

- `assemble-key.js:344-346` — `skeletonize` writes `<HEAD>` and `<BASE>` into the
  line **before** substituting the subject, so a subject that is a substring of those
  tokens corrupts the mask (`Base (its parent):   <BA<SUBJECT>E>`, reproduced with a
  one-character subject). Real subjects are long sentences so it cannot fire here,
  and the corruption differs per artifact, i.e. it would make the lint fire rather
  than pass — fail-closed. Mask the subject first, or use sentinels no template
  contains.
- `assemble-key.js:1416-1426` — briefs are written before `key.json`, notes and
  `CONSTRUCTION.md`. Each write is atomic; the *set* is not, so a crash between them
  leaves briefs newer than the key. The lints having already passed makes this small,
  but "all-or-nothing" is still a per-file property here.
- `score.js:180,185` — `parseCitations` requires a `.`+1-10-letter extension, so a
  locator on an extensionless file could never be cited. None exist today.
- `VERSION` remains `2.3.0` and the 2.3.0 CHANGELOG entry was amended in place rather
  than a new entry added. Defensible for an unreleased version; the entry now
  describes two different sealed states of the same corpus.
- The cross-machine reproducibility claim is still unprovable here: both clones in
  `tests/wo12-tooling.test.js:205` run under one machine's config. The five new
  `GIT_PINS` plus `--no-verify` make it very likely to hold; nothing in CI proves it.
- Bookkeeping in the round-1 records that the CHANGELOG now inherits: the Anthropic
  header says "12 MAJOR" over 13 bold MAJOR entries, and the OpenAI record's closing
  prose says "13 findings (3 CRITICAL, 10 MAJOR)" over 12 bullets.
- `run-lane.js:141-148` — `RUNNER_OWN_RETRIES` / `OUTER_MARGIN_MS` still mirror
  `orchestra-review.js`'s internal defaults in a second file. Carried from round 1
  with a comment now saying so, which is the honest minimum.

---

## VERIFICATION RE-RUN

`node tests/wo12-tooling.test.js` → 376 passed, 0 failed (exit 0).
`node install.js --lint` → 43 files, 0 errors, 0 warnings (exit 0).
All ten suites in `tests/` → 1179 checks, 0 failed.
`node assemble-key.js --check-only` on the sealed corpus → every brief matches
generation, every lint passes (exit 0).
`node build-corpus.js --id sdc-013 --run-clone-root …` and `--id sdc-021` → run
clones inspected with `log -1`, `for-each-ref`, `remote -v`, `rev-list --all` vs
`rev-list HEAD`, `packed-refs`, `.git/logs`, `fsck --lost-found`, `ls-files`.
All 84 artifact trees swept for `wo12/` → none.
`sdc-013` re-materialized under `i18n.commitEncoding` `UTF-8` and `ISO-8859-1` →
identical head, matching `materialized.json` and `CONSTRUCTION.md`.
P0 gate exercised live across 9 quartermaster states; `checkProjectedDraw` across 5;
`checkPhaseOrder` refused an out-of-order dry-run; `--override-p0` ledgered and
stamped end-to-end with a stub runner.
Direct-call probes reproduced every closure and all five new findings.
Blind 24-file brief read delegated to a fresh, restricted evaluator; scored against
`key.json` only afterwards.
Review performed in a detached worktree pinned at `efe9977`, removed afterwards; all
probes ran in `scratchpad/` clones and temp directories. The live tree was not
modified apart from this record.
