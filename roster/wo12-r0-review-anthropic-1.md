<!-- R0 fallback same-family lane, Claude Opus 5, fresh context, READ-ONLY; scope 3057429..e14232d (b7e6ffe corpus + e14232d tooling); verdict REVISE. -->

REVIEW ENGINE: Claude Opus 5 (R0 Anthropic lane, fresh context, tier: full)

**Lane / casting:** R0, Anthropic casting, Claude Opus 5, fresh context, read-only.
**Date:** 2026-08-30.
**Scope:** `b7e6ffe` (WO-12 corpora: SDC sealed, 12a/12e/12c orders and fixtures) and
`e14232d` (WO-12 tooling: build-corpus / run-lane / score / assemble-key; CI; v2.3.0),
against parent `3057429`. Reviewed in a detached worktree pinned at `e14232d`; every
probe ran in `scratchpad/` clones and temp dirs. Nothing in the live tree was modified.

**CROSS-FAMILY DISCLOSURE — `review.cross_family=false`.** The artifacts under review are
Anthropic-authored and this reviewer is Anthropic. This is the **fallback same-family
lane**, dispatched because the cross-vendor engine is environment-blocked (stale codex
helper, `roster/codex-fault-investigation-2026-08-31.md`). Same-family review cannot
supply the independence the mandatory set assumes; read every finding below as
correlated with the author's own blind spots. The dispatcher sets
`review.cross_family=false` on this verdict.

---

# VERDICT: REVISE

4 CRITICAL · 12 MAJOR · 8 MINOR. The CRITICAL findings are not style: two of them mean
that if WO-12 ran today, **every seeded artifact would announce itself to the reviewer in
`git log -1`**, and **a lane can bill the OpenAI allowance with the P0 gate never having
run at all**. The instruments are careful and, in the places I could measure them
(Wilson, tallies, patch integrity, locators), correct. The failures are all in the
adversarial direction: the gates are permissive where the protocol requires them to be
closed, and the blinding is broken by construction rather than by accident.

---

## FINDINGS

### CRITICAL

**[CRITICAL] `run-lane.js:210-226` — the P0 gate fails OPEN. Any Quartermaster failure that is not the literal string "REFUSED for OU" is read as OU-clear, and the lane spends.**

```js
  } else {
    ouFailClosed = /REFUSED for OU\b/.test(combined);
  }
```

Protocol §2.6: "Each phase starts only with `quartermaster.js --state` **Green for OU**."
The code implements the inverse: it proceeds unless it can *prove* an OU refusal by
string match. Absence of evidence is treated as Green. The refusal is therefore only as
strong as one un-versioned English phrase in another module's stderr.

Demonstrated live, with the strongest form of the scenario — the Quartermaster could not
even be found:

```
$ WO12_QM_CMD="node <bad-path>/qm-crash.js" node run-lane.js --lane X-Terra --phase 0 ... --yes
Error: Cannot find module '...\qm-crash.js'
  code: 'MODULE_NOT_FOUND'
exit code: 1
--- end quartermaster output ---

[1/1] rl-001 ...
    attempt 1: COMPLETED / APPROVE  (0.1s)
    -> appended (1 record(s) now in results-X-Terra-phase0.json)
done: 1 artifact(s)
```

The gate printed a stack trace and proceeded to bill a review. Other reachable variants,
all fail-open: `quartermaster.js` renamed or moved; a corrupt readings file producing a
`TypeError`; the process killed (`r.status === null` skips the `=== 0` branch, then the
regex fails on empty output); any rewording of the refusal (`REFUSED: OU`, `no usable
reading for OU`). `r.error` at :207 catches only a spawn failure of `node` itself, not a
non-zero exit. The test suite pins exactly two paths — healthy-with-`OU`-key (§5) and
`REFUSED for OU` verbatim (§6) — and no failure path, so CI ratifies the hole.

Fail-closed here means: any non-zero exit, any unparseable output, any signal death, and
any exit-0 output without a Green OU reading refuses, and `--override-p0` is the only way
past. The §2.6 Amber arm (owner confirmation per §5.5) and the projected-draw-above-P15
check are additionally not implemented at all — see MAJOR below.

**[CRITICAL] `build-corpus.js:75-77, 183-202` — the seeded variant's commit metadata is a perfect tell. `git log -1` separates seeded from control at 100% precision and 100% recall.**

```js
const SEEDER_NAME  = 'WO-12 seeder';
const SEEDER_EMAIL = 'wo12@orchestra.local';
const SEED_DATE    = '2026-08-31T00:00:00Z';
```

Materialized `sdc-001` from its own patch and compared against a control head in the same
clone:

```
=== SEEDED head (what the reviewer's pinned checkout contains) ===
author=WO-12 seeder <wo12@orchestra.local>
date=Mon Aug 31 00:00:00 2026 +0000
refs= (HEAD)
BODY:
WO-11 round 3: Sol·max holistic findings applied (...); verdicts committed

=== CONTROL head (sdc-007 = 7bf8e79) ===
author=Max-Lough <maxtlough@gmail.com>
date=Sun Aug 30 20:15:40 2026 -0700
BODY:
WO-11 round 2: confirmation validity re-anchored to live evidence; ...
CRITICAL: analyze() re-validates a recorded Amber-arm confirmation ...
[19 more lines of real body]
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

Four independent discriminators, each alone decisive, all present on all 30 seeds and
zero controls: (1) author/committer name and e-mail; (2) a committer date identical
across all 30 seeds and in the future relative to every real commit; (3) a **one-line**
commit message where every control carries a multi-paragraph body with `Co-Authored-By`
/ `Claude-Session` trailers; (4) the head is a detached commit on no ref, so
`git branch --contains HEAD` is empty for seeds and non-empty for controls.

Reading `git log -1` on the head under review is the first move of any competent code
reviewer, and the runner hands the lane a real repository precisely so it can. The
reproducibility argument in the header comment (:44-52) is sound and worth keeping — but
it is satisfied by *any* fixed identity, including one that impersonates the repository's
real committer identity and reproduces the real commit's full message body. §2.1's own
requirement is that "the review runner's `--base-ref P --head-ref C'` sees a real commit";
what it sees today is visibly a synthetic one.

This finding voids 12h (§2.7's entire blinding factor), and contaminates 12f gates 1-3
and the whole of 12d, because a lane that can tell seeded from control has no reason to
spend equal effort on both.

**[CRITICAL] `run-lane.js:389` + `build-corpus.js:126` — the sealed answer key is inside the reviewer's own working directory.**

`materializeArtifact` works in a **full `git clone`** of this repository (:126), and
`run-lane.js` passes that same directory as the runner's `cwd` *and* as
`CLAUDE_PROJECT_DIR` (:283). The clone carries every ref, including `origin/HEAD`. From
that cwd:

```
$ git show origin/HEAD:plans/cross-compare/agent-role-architecture/wo12/corpus/key.json
{
  "version": 1,
  "artifacts": [
    { "id": "sdc-001", "kind": "seeded", "phase": 0, "variant": "V1", "base": "7bf8e794...", "commit": ...
```

`locator.file`, `locator.lines`, `locator.symbol`, `severity`, `type` and
`hazard_terms` for all 30 seeds — plus all 30 `.patch` files and all 30 `.seed.json`
files — are one `git show` away from any lane with shell access, which is every lane
(the X-lanes' runner is agentic, and §2.4's S-lanes are in-harness Agents with a pinned
checkout). §2.1's guarantee that the checkout "**never** sees `wo12/`" holds only for the
*working tree*; it does not hold for `.git`. Nothing in the tooling strips the refs,
shallow-clones to the base, or `git gc --prune`s the unreachable objects.

**[CRITICAL] Corpus briefs — 14 of 30 seeds (47%) are identifiable as seeded from the brief text alone, at 100% precision, with no access to `key.json`, the patches, or the tree.**

Established blind, before opening `key.json`, using only brief text and the observable
fact that a `.patch` file exists. Three signals, each of which appears on **zero** of the
54 controls:

1. **Extra work-order sections.** `sdc-001.wo.txt` (28 lines) carries an "In full, the
   order was:" block with a `Constraint:` paragraph; `sdc-013.wo.txt` (37 lines) carries
   an `ORDER:` block with a `Constraint:` paragraph. Every control brief is the same
   9-line subject-only form. Corpus-wide header census: `ORDER AS ISSUED` ×3, `CLAIMS:`
   ×2, `ORDER:` ×1, `SCOPE` ×1 — 7 briefs, 7 seeds, 0 controls.
2. **Executor reports that make specific claims.** Every control ends "no fresh executor
   claims exist beyond the commit message." Seven seeds break that template — e.g.
   `sdc-001.er.txt`: "The staleness window is now 48h, the disclosure keys were added
   additively... router/router.js was not touched." 7 seeds, 0 controls.
3. **V3 hazard lines outside the control vocabulary.** Controls draw from a closed pool
   of five generic lines. Seven seeds add a line no control ever carries, each one
   type-shaped and pointing at its own defect: `sdc-014` "check every stated constraint
   in the order against the diff" (CV); `sdc-019`/`sdc-066` "check each claimed
   verification against the diff" (HF); `sdc-067` "check write atomicity and
   read-after-write ordering" (RC); `sdc-006` "check process/handle lifetimes on error
   paths and write atomicity" (RC); `sdc-003`/`sdc-040` "check that callers outside the
   diff still satisfy any changed contract" (LC).

Mechanical union of the three rules over all 84 briefs:

```
FLAG sdc-001 SEED   FLAG sdc-003 SEED   FLAG sdc-005 SEED   FLAG sdc-006 SEED
FLAG sdc-013 SEED   FLAG sdc-014 SEED   FLAG sdc-015 SEED   FLAG sdc-019 SEED
FLAG sdc-040 SEED   FLAG sdc-043 SEED   FLAG sdc-061 SEED   FLAG sdc-065 SEED
FLAG sdc-066 SEED   FLAG sdc-067 SEED
seeds=30 controls=54 flagged_seeds=14 flagged_controls=0
```

Signal 3 is a structural leak, not a slip: §2.7 defines V3's checklist as built from
"the artifact's class and the **type family's** generic hazard terms" — but controls
*have no type*, so any type-derived line is by construction impossible on a control and
therefore self-identifying on a seed. The V3 arm cannot carry type-derived hazard lines
at all unless controls are assigned a pseudo-type drawn from the same vocabulary.
Signals 1 and 2 are §2.7 violations outright: §2.7's variants differ only in the
executor report's attribution and hazard block; nothing in the protocol authorizes a
seeded artifact to receive a longer work order or a richer executor report than a
control. `assemble-key.js`'s lints cannot catch any of this — they forbid literal words
("seed", "defect", "locator"), never structural asymmetry between the two populations.

---

### MAJOR

**[MAJOR] `score.js:443-452` + `:323` — 12f gate 5 ("exact model identity") passes on a run served by the wrong model, and the protocol's exclusion remedy is not implemented.**

`identityKnown` requires only that *some* engine header string exists and is not literally
`REVIEW ENGINE: NONE`. It never compares the served model against the lane's expected
model. Proven:

```
$ node -e "... engineHeader: 'REVIEW ENGINE: codex model: gpt-5.6-sol' ... lane 'X-Terra'"
identityKnown for a Terra run served by SOL: true -> gate5 sees IDENTITY_UNKNOWN = false
```

A Terra qualification run silently served by the flagship passes gate 5 *and* is counted
in Terra's recall — the precise failure the gate exists to prevent. Compounding it,
`run-lane.js:298` fabricates an identity from `/^.*\bmodel:\s*\S.*$/im`, which matches
**any** line containing "model:" anywhere in the runner's output, including reviewer
prose about the diff.

Separately, §3.1 item 5 and §1 both specify that a persistently-unknown identity means
the artifact is "**excluded from *both* lanes' counts** and the exclusion listed."
`gate12f` never excludes anything: it counts unknowns and flips item 5 to FAIL. Gate 2
can therefore record a CRITICAL seed as "missed" on a run the protocol says should not
have been counted, and `complete` (:378) requires 84 records per lane, so exclusion is
unimplementable without permanently pinning every item to INCOMPLETE.

**[MAJOR] `run-lane.js:244-257` — `appendResult` silently discards a corrupt results file, destroying every prior record. The docstring's durability claim is refuted.**

The header at :41-42 claims "a crash mid-phase loses at most the artifact in flight,
never the ones already reviewed." A crash *during* `writeFileSync` is exactly what
produces a truncated file, and the next append resets to `[]`:

```
records before: 1
file now unparseable: true
after appendResult, record count = 1 (prior evidence silently discarded, no warning)
```

Applied to a real phase-3 run this converts a partial-write crash on artifact 24 into the
loss of 23 billed reviews, with no error, no backup, and no line in the output saying
anything happened. It also erases any `p0Override` stamps carried on those records — the
only place an owner override is recorded. `score.js:284-286` handles the same case
correctly (records and reports `malformedFiles`); `run-lane.js` should refuse, or
side-file the unreadable content, never truncate.

**[MAJOR] `assemble-key.js:574` vs `:606` — key.json is written BEFORE the leakage and template lints. "All-or-nothing key assembly" is refuted.**

```js
574:  fs.writeFileSync(paths.keyPath, JSON.stringify(key, null, 2) + '\n', 'utf8');   // step 1
...
601:    normalizeBrief(wo, ...); normalizeBrief(er, ...);                             // step 3, writes briefs in place
...
608:    leakageLint(wo, a.subject); leakageLint(er, a.subject);                        // step 4
610:    templateConformance(er, a.variant);
```

A lint failure at step 4 throws, and the process exits 1 having already sealed
`key.json` and rewritten an arbitrary prefix of the briefs on disk, while
`construction-notes.json` and `CONSTRUCTION.md` are left stale or absent. The result is a
committed key that was never linted, paired with half-normalized briefs — the exact
state the all-or-nothing rule exists to prevent. The `missing`-list check at :567 is
all-or-nothing; the lints are not. Assemble into a temp path and rename only after step
4 passes.

**[MAJOR] `assemble-key.js:328-333` — the `Commit subject:` leakage exemption is unconditional. Any line starting with that prefix may say anything at all.**

```js
if (/^Commit subject:/.test(trimmed)) return true;
```

The prefix is never checked against the artifact's real subject, and the suite pins the
hole as intended ("the `Commit subject:` line prefix exemption fires even when
leakageLint is called with NO subject argument at all"). Proven:

```
leakageLint PASSED a line full of leakage terms (seed/defect/injected/locator/
  hazard_terms) purely because it starts with 'Commit subject:'
isExemptLeakageLine with NO subject at all: true
```

The rationale — that real subjects legitimately use words like "defect" — is right; the
implementation should be `trimmed === 'Commit subject: ' + subject`, not a prefix test.
The second exemption (`subject.includes(trimmed)`, :331) is over-broad in the same
direction: a bare line `defect` is exempt whenever the real subject contains that
substring anywhere (verified against `"WO-12 corpora: seeded-defect corpus SEALED"` → exempt).

**[MAJOR] `assemble-key.js:392-396` — the V1/V3 vendor check is scoped to one sentence, and a shipped V1 brief names a vendor.**

§2.7 V1: "executor report **names no vendor, model, effort or price**." The check runs
only over `extractAuthorSentence(norm)`. Swept every shipped V1/V3 brief:

```
V1/V3 briefs naming a vendor OUTSIDE the author sentence: 1  ->  sdc-043 (V1) vendor=Codex
```

That is a live blinding break in the sealed corpus, not a hypothetical. Additionally
`VENDOR_TERMS` contains no **effort** or **price** terms at all, so §2.7's other two
prohibitions are unenforced: `findVendorTerm('A medium-effort xhigh executor at
$0.02/1k produced this change.')` → `null`.

**[MAJOR] `score.js:160-175, 206-223` — the default `basename-only` tier scores a citation of a *different file* as a hit.**

```
$ evaluateSeedHit(locator quartermaster/quartermaster.js:556-559,
                  block '[MAJOR] tests/quartermaster.js:557 — unrelated test file ...')
{"hit":true,"via":"line","pathMatchKind":"basename-only"}
```

`tests/quartermaster.js` and `quartermaster/quartermaster.js` are different files; the
line number coincides. This is not §2.5's rule ("cites the seed's `locator.file`"). The
tier is honestly disclosed and separately tabulated, and `--strict-paths` disables it —
but it is **on by default**, so the headline `Recall by lane` table and every Wilson
interval, and 12f gate 1's `hits(Terra) ≥ hits(Sol) − 1`, all run on the inflated count.
Given a repository with `quartermaster.js`, `router.js`, `checkout.js` and `index.js` at
several depths, false hits are likely rather than theoretical. Make `--strict-paths` the
default and require a flag to loosen it.

**[MAJOR] `score.js:206-223` — §2.5's severity floor is not enforced; an untagged block scores a hit.**

§2.5 requires "with severity ≥ MINOR". `parseSeverity` is computed and stored but never
gates: `evaluateSeedHit(seed, ['quartermaster/quartermaster.js:557 something odd here'])`
→ `hit: true`. The docstring rules this deliberate for hand-transcribed S-lane verdicts,
which is defensible for S-lanes — but it applies identically to the X-lanes, whose
runner template *does* mandate `[SEVERITY]` tags, so any stray prose line naming the file
and a nearby line number counts as a find. Scope the leniency to the lanes that need it.

**[MAJOR] `score.js:415-429` — the false-blocker numerator is not restricted to controls, nor to MAJOR/CRITICAL.**

```js
const terraAdj = adjudication.filter((a) => a.lane === 'X-Terra');
const falseBlockers = terraAdj.filter((a) => a.verdict === 'NOISE' && a.second === 'NOISE');
const rate = falseBlockers.length / terraControls.length;
```

§2.5 defines a false blocker as "a **MAJOR or CRITICAL** finding on a **control**
artifact" marked NOISE by both adjudicators. Neither condition is applied: a NOISE/NOISE
MINOR nit on a *seeded* artifact lands in the numerator over a control-only denominator.
12f gate 3 is a hard qualification gate at ≤10% of 54 controls, i.e. ≤5 findings — the
margin is small enough that this miscount can decide the gate.

**[MAJOR] `score.js:532` + `:682-684` — the construction-suspect list is emitted from half-run results.**

`gate12d`'s `reading` correctly prints "NOT COMPUTED" when a family is missing (:516-518),
but `suspects = union.filter(category === 'neither')` is rendered unconditionally into
both the markdown report and `score-output.json`. Score only the X-lanes and every seed
the X-lanes missed is published to the owner as possibly malformed — inverting §2.5's
definition ("seeds hit by **neither** X-lane **nor any** S-lane"). Suppress the list
unless both families are present.

**[MAJOR] `run-lane.js:301` — `INTEGRITY WARNING` is scanned in stdout only; 12f gate 4 fails open on a stderr-borne warning.**

```js
const integrityWarning = /INTEGRITY WARNING/.test(stdout);
```

`stdoutVerbatim` (:292) deliberately concatenates stderr because the runner writes to
both; the detector does not. A tree-audit warning emitted on stderr is preserved in the
record but never sets the flag, so §3.1 gate 4 ("no source mutation") and §2.5's Source
mutation metric silently read clean. Test against `stdoutVerbatim`.

**[MAJOR] `run-lane.js:307` — the UNAVAILABLE classifier matches the word anywhere in the verdict line.**

```js
else if (/UNAVAILABLE/i.test(verdict)) status = 'UNAVAILABLE';
```

A legitimate verdict such as `VERDICT: APPROVE — the cache path is correct when the
engine is unavailable` is classified UNAVAILABLE, triggers a second billed review, and is
counted against §3.1 gate 6's ≤10% budget and its streak rule — a real qualification gate
turned on a substring of reviewer prose. Anchor on the runner's own token
(`REVIEW_UNAVAILABLE`, which §2.5 names) rather than a bare substring. Conversely
`NO_VERDICT_LINE`, `SPAWN_FAILED` and `KILLED_AT_OUTER_TIMEOUT` are never retried and
never counted anywhere, so a lane that dies without printing a verdict is invisible to
the stability gate.

**[MAJOR] `run-lane.js:363-376` — §2.6's Amber arm and projected-draw check are absent.**

§2.6: "Each phase starts only with `--state` **Green for OU** *and* the phase's projected
draw (per-review draw from phase 0 × reviews) leaving OU above the P15 reserve; **Amber
requires the owner's confirmation per §5.5**." The driver implements neither. An exit-0
`--state` carrying an OU key proceeds regardless of whether OU is Amber, and no draw
projection is computed or compared against the reserve at any point. Phase 0's own stop
condition (">2 UNAVAILABLE in either lane → halt") is likewise not enforced — the loop
runs all 12 artifacts whatever happens.

**[MAJOR] `build-corpus.js:114-129` — reproducibility is asserted but not pinned against the git config that can break it.**

The sha-stability argument at :44-52 depends on the tree and message bytes being identical
everywhere. The commit is correctly run with a fixed identity and `-c
commit.gpgsign=false`, but nothing pins `core.autocrlf` / `core.eol` (a Windows clone with
`autocrlf=true` and a patch whose context lines disagree on endings can fail to apply, or
land different bytes for any path carrying a `.gitattributes` override), and nothing
disables hooks — a global `core.hooksPath` with a `commit-msg` hook that appends a trailer
(`Change-Id`, `Signed-off-by`) changes the message and therefore the head sha on that
machine only. `--no-verify` plus `-c core.autocrlf=false -c core.eol=lf` on the clone
would close both. The CI comment on the new workflow step claims the suite proves "same
head sha from two independent clones" — it does (`tests/wo12-tooling.test.js:161`), but
both clones run under one machine's config, so the cross-machine claim is untested.

---

### MINOR

- `score.js:84-96` — `extractFindingsSection` requires a **bare** `FINDINGS` line and a
  bare `CLAIMS CHECKED` / `NITS` terminator. A markdown-headed verdict silently scores
  zero for the whole artifact, with no diagnostic:
  `extractFindingsSection('...## FINDINGS\n\n- [CRITICAL] quartermaster/quartermaster.js:557 — analyze() ...')`
  → `""`, and the correctly-cited CRITICAL scores as a MISS. The X-lane runner's own
  template does use bare headers (`packs/codex/hooks/orchestra-review.js:1815-1823`), so
  the X-lanes are aligned — but §2.4's S-lanes are hand-transcribed in-harness agents,
  and this repository's own R0 house format (`roster/wo11-r0-review-1.md`) uses
  `## BLOCKING` / `## CLAIMS CHECKED`. Accept an optional `#`-prefix, and warn loudly when
  a non-UNAVAILABLE record yields an empty findings section.
- `base-pool.json` allocation, confirmed in `key.json` — **seeded slots precede controls in
  every phase** (phase 0: seeds at indices 0-5, controls 6-11; phases 1-3: seeds 0-7,
  controls 8-23). §2.6 fixes run order as corpus order, so every phase runs its seeds
  first. §2.4's fresh-context rule limits the damage per artifact, but the ordering is
  visible to any adjudicator, to the owner reading results in file order, and to any lane
  that is ever run with carry-over context. Interleave.
- `key.json` — 10 seeded artifacts share a `base` **and** a `commit` with a control
  (`sdc-001`/`sdc-075`, `sdc-002`/`sdc-076`, …). The pool-ran-short reuse is properly
  recorded per §2.1 (`corpus/README.md:119-131`, `base-pool.json` allocation note), so
  this is disclosed, not hidden — but the two briefs then carry an identical
  `Base (its parent)` sha and an identical `Commit subject:` line with different heads,
  which is a cross-artifact tell for anyone who sees both.
- `assemble-key.js:295-317` — `normalizeBrief` rewrites **any** non-base 40-hex sha to the
  materialized head. A brief that legitimately quotes a third commit ("this reverts
  abc123…") is silently corrupted, and the `leftover` guard at :313 then passes precisely
  *because* the corruption was total. It also rewrites committed briefs in place, so any
  reproducibility break (see MAJOR above) rewrites the sealed corpus on a re-run.
- `build-corpus.js:122-124` — `ensureClone` reuses any directory containing `.git` without
  verifying it is a clone of the source repo and without fetching. A stale reused clone
  silently lacks newer bases; an unrelated repo passed as `--clone-root` is accepted. The
  nesting guard at :117-121 uses `path.relative` without `realpath`, so a symlink or
  junction into the repository bypasses it.
- `build-corpus.js:277-286` — on a partial `--all` failure, `materialized.json` is never
  rewritten, so a stale file from a previous run survives alongside a half-materialized
  clone. Fail-closed on the commit itself, but the artifact left on disk is misleading.
- `score.js:525-527` — the fall-through message reads "below the +2 complementarity
  threshold" in a branch reached when the gain **is** ≥2 and the *type* condition failed.
  Misstates which half of §3.2's rule was not met.
- `run-lane.js:402` — `--override-p0` is recorded only in the results file, and only on
  records that survive; combined with the `appendResult` truncation above there is no
  durable ledger entry. `--override-p0` with `--dry-run` returns at :361 before the gate
  and records nothing, which is harmless (nothing is spent) but means the flag is silently
  accepted and ignored.

---

## CLAIMS CHECKED

| Claim (commit message / docstring / CHANGELOG) | Verdict | Evidence |
|---|---|---|
| "139 checks" — the suite passes | **CONFIRMED** | `node tests/wo12-tooling.test.js` → `139 passed, 0 failed`, exit 0 |
| Repo lint still clean | **CONFIRMED** | `node install.js --lint` → `43 file(s) ... 0 error(s) · 0 warning(s)`, exit 0 |
| Wilson intervals correct | **CONFIRMED** | Recomputed 19/20 and 6/8 by hand from the Wilson formula at z=1.959963984540054: 76.39–99.11 and 40.93–92.85. `score.wilson()` returns exactly those. All six §1 anchors reproduce (20/20 83.89–100, 12/12 75.75–100, 18/20 69.90–97.21, 8/8 67.56–100) |
| Env vars per lane are §2.4 verbatim | **CONFIRMED** | `run-lane.js:78-81`: X-Sol `gpt-5.6-sol` + `-c model_reasoning_effort=high`; X-Terra `gpt-5.6-terra` + `medium`. Dry-run output matches on both lanes |
| "one retry on UNAVAILABLE ... both recorded" | **CONFIRMED** (with the MAJOR caveat above) | `run-lane.js:392-396` retries exactly once and pushes both attempts; the retry is not itself retried |
| Corpus shape: 84 = 30 seeded + 54 controls, phases 12/24/24/24 | **CONFIRMED** | `key.json` census: phase `{0:12,1:24,2:24,3:24}` |
| "variants 10/10/10" (seeds) and 18/18/18 (controls) | **CONFIRMED** | seeded `{V1:10,V2:10,V3:10}`; control `{V1:18,V2:18,V3:18}` |
| "6 CRITICAL / 24 MAJOR / 0 MINOR", 5 seeds per type | **CONFIRMED** | severity `{MAJOR:24,CRITICAL:6}`; type `{CV:5,OO:5,LC:5,FT:5,HF:5,RC:5}` — meets §2.2's ≥20 MAJOR / ≥6 CRITICAL / ≤4 MINOR |
| "CRITICAL in all six types" | **CONFIRMED** | CRITICAL by type `{CV:1,OO:1,LC:1,FT:1,HF:1,RC:1}` (§2.2 required ≥4 types) |
| Patches re-apply on their base in a fresh clone | **CONFIRMED** (3/3 sampled) | Fresh `git clone`; `git apply --check --verbose` at each base → exit 0 for `sdc-001` (`7bf8e79`), `sdc-013` (`5758a2d`), `sdc-040` (`1cb50b8`) |
| Locators point at real changed lines | **CONFIRMED** (3/3 sampled) | `sdc-001` `quartermaster/quartermaster.js:556-559` ∈ hunk `@@ -526,6 +542,22 @@ function analyze` (new 542-563); `sdc-013` `verifier/checkout.js:289-291` ∈ `@@ -277,7 +286,9 @@ function sweepAbandoned` (286-294); `sdc-040` `orchestra-engine-mcp.js:443-444` ∈ `@@ -210,26 +392,70 @@ function runRunner` (392-461) |
| Pool-ran-short base reuse "recorded" per §2.1 | **CONFIRMED** | `corpus/README.md:119-131` "Reuse and collision notes"; `base-pool.json` allocation note names the 10 reused bases and the `e7545f6`/`99835d5` sibling collision |
| VERSION 2.3.0, CHANGELOG entry, CI step | **CONFIRMED** | `VERSION` 2.2.0→2.3.0; CHANGELOG `## 2.3.0` present; `.github/workflows/test.yml` +9 lines running `node tests/wo12-tooling.test.js` |
| "P0-gated lane driver" | **REFUTED** | The gate is not fail-closed. Live: a Quartermaster that could not be loaded (`MODULE_NOT_FOUND`, exit 1) printed a stack trace and the driver billed the review — see CRITICAL 1 |
| "all-or-nothing key assembly" | **REFUTED** | `assemble-key.js:574` writes `key.json` before the step-4 lints at :606-611 — see MAJOR 3 |
| "a crash mid-phase loses at most the artifact in flight, never the ones already reviewed" (`run-lane.js:41-42`) | **REFUTED** | A truncated results file is silently reset to `[]`; measured 1 record → corrupt → 1 record, prior evidence gone — see MAJOR 2 |
| Blinding: seeded and control artifacts are indistinguishable to the reviewer | **REFUTED** | `git log -1` separates them at 100%/100% (CRITICAL 2); brief text alone separates 14/30 seeds at 100% precision (CRITICAL 4) |
| "leakage + template lints" enforce §2.7 V1 | **REFUTED** | `sdc-043` (V1) ships naming `Codex`; the `Commit subject:` exemption is unconditional; effort/price are never checked — see MAJOR 4 and 5 |
| CI comment: suite proves "same head sha from two independent clones" | **PARTIAL** | The assertion exists (`tests/wo12-tooling.test.js:161`) and passes, but both clones share one machine's git config, so the cross-machine claim it is offered for is untested — see MAJOR 12 |

---

## TELLS — corpus blinding assessment

**Method.** Read six seeded briefs (`sdc-001, 004, 013, 018, 040, 067`) and six control
briefs (`sdc-007, 008, 009, 021, 022, 023`) blind, then generalized the candidate signals
across all 168 brief files, using only "a `.patch` file exists for this id" as ground
truth. `key.json` was not opened until after this section's conclusions were fixed, and
then only to verify three locators.

**Result: the corpus is not blind.** In the 12-brief sample I separated seeded from
control on two of six seeds with certainty and zero false positives, from text alone.
Generalized, the text signals reach 14/30 seeds at 100% precision; the git-metadata
signal reaches 30/30 at 100% precision.

**Signals that discriminate (all verified across the full corpus):**

| # | Signal | Seeds | Controls | Precision |
|---|---|---|---|---|
| 1 | `.wo.txt` carries an expanded order block (`ORDER:`, `ORDER AS ISSUED`, "In full, the order was", `SCOPE`) — almost always with a `Constraint:` paragraph | 7 | 0 | 100% |
| 2 | `.er.txt` breaks the "no fresh executor claims exist beyond the commit message" template with specific claims (`CLAIMS:` section, or inline assertions as in `sdc-001`) | 7 | 0 | 100% |
| 3 | V3 hazard checklist carries a line outside the controls' closed five-line vocabulary, type-shaped to the seed | 7 | 0 | 100% |
| — | **union of 1-3** | **14** | **0** | **100%** |
| 4 | `git log -1` on the head: author `WO-12 seeder <wo12@orchestra.local>`, date `2026-08-31T00:00:00Z`, single-line message, no trailers, on no ref | 30 | 0 | 100% |
| 5 | The head sha does not exist in an unmaterialized clone of the repo (`git cat-file -t` → "Not a valid object name" for all five sampled seed heads; both sampled control heads resolve) | 30 | 0 | 100% |

**Signals that do NOT discriminate — these are correctly built and worth preserving:**

- **Brief length and shape.** Four of the six sampled seeds (`sdc-004, 018, 040, 067`) are
  byte-for-byte structurally identical to controls: 9 lines, 471-541 bytes, same wording.
- **Sha form.** All 168 briefs use full 40-hex for both `Change under review` and
  `Base (its parent)`. No abbreviation, no `<<HEAD>>` or `<COMMIT>` residue anywhere.
- **Packet variant assignment.** V1/V2/V3 is perfectly balanced (10/10/10 seeded,
  18/18/18 control), so the variant itself carries no information about kind. The V2
  identity line ("Claude Sonnet 5 · medium (Anthropic) produced this change") appears on
  10 seeds and 18 controls alike.
- **Base-commit character.** Both populations draw from the same real history, and both
  cite real subjects.
- **File mtimes.** Uniform across the corpus in a fresh checkout — not a channel.

**What must change before any pass runs.** Signals 1-3 require re-authoring the affected
14 briefs so a seeded packet is textually indistinguishable from a control packet — which
means either giving controls the same expanded-order and specific-claim treatment at the
same rate, or removing it from the seeds (accepting that CV seeds then need their
constraint carried inside the real commit's own quoted body). Signal 3 additionally needs
V3 hazard lines drawn from one vocabulary applied to both populations, since a type-derived
line is structurally impossible on a typeless control. Signals 4-5 require the materializer
to reproduce the real commit's author, committer, date and full message body — the
reproducibility property survives any fixed choice — and the runner to be handed a
repository whose refs do not carry the corpus (CRITICAL 3).

Until then, 12h measures nothing, and 12f/12d measure a reviewer's ability to spot a
seeder rather than a defect.

---

## NITS

- `run-lane.js:83-85` — `OUTER_MARGIN_MS` and `RUNNER_OWN_RETRIES` encode
  `orchestra-review.js`'s internal defaults as constants in a second file; a change there
  silently desynchronizes the outer timeout.
- `score.js:139` — the 80-character proximity window for "lines N-M" is a magic number in
  a scoring rule that decides a qualification gate; it deserves the same "the wo12 report's
  ambiguity note" treatment the path tiers received.
- `score.js:225` `fail()` calls `process.exit(1)` while the module docstring at :44 promises
  "always exits 0". The promise is about the *scoring* path, but `loadKey`/`loadAdjudication`
  failures do exit non-zero; worth restating.
- `assemble-key.js:362` — `extractAuthorSentence`'s defensive fallback returns the whole
  normalized text when the marker is absent, which would make the vendor check *stricter*
  than intended rather than looser. Correct direction; a comment saying so would help.
- `build-corpus.js:88` — `git()` swallows `r.error` for callers other than `gitOrThrow`;
  only `gitOrThrow` checks it.
- `run-lane.js:348` — the dry-run head placeholder `<materialized at run time ...>` makes
  the printed command non-copy-pasteable for seeded artifacts, which is the case an owner
  most wants to reproduce by hand.

---

## VERIFICATION RE-RUN

`node tests/wo12-tooling.test.js` → 139 passed, 0 failed (exit 0).
`node install.js --lint` → 43 files with frontmatter, 0 errors, 0 warnings (exit 0).
Wilson recomputed by hand for 19/20 and 6/8; all six §1 anchors reproduced from the
implementation.
`git apply --check` for `sdc-001`, `sdc-013`, `sdc-040` at their bases in a fresh clone →
exit 0 each.
Three seed locators cross-checked against their patches' hunk ranges → all inside real
changed lines.
Live P0 fail-open reproduced end-to-end with a stub runner and a broken quartermaster
command; `appendResult` truncation, `basename-only` cross-file hit, gate-5 wrong-model
pass, and three `leakageLint` exemption holes each reproduced by direct call.
Review performed in a detached worktree pinned at `e14232d`, removed afterward; all
probes ran in `scratchpad/` clones and temp directories. The live tree was not modified.
