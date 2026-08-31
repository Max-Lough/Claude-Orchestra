<!-- R0 delta re-review of round 4. Claude Opus 5 · high, scope 772a688..ff638b7, VERDICT APPROVE. -->
<!-- Residuals closed in this round-5 cleanup. -->

REVIEW ENGINE: Claude Opus 5 · high (R0 anthropic lane, fresh context, tier: full)

VERDICT: APPROVE

FINDINGS (new)
- [MINOR] roster/wo11-r0-review-2.md:2 — the closure header cites fc9e0b8, which is not the round-4 commit. git reflog shows the chain dbd9aef (PLACEHOLDER) → fc9e0b8 (cites dbd9aef) → ff638b7 (cites fc9e0b8). Each amend cited its own predecessor, so the header never converged: fc9e0b8 is an orphaned, unreachable object absent from every clone and from git log. A commit cannot contain its own SHA; the fix is a follow-up commit or a round-reference, not another amend.
- [MINOR] roster/wo11-band-record.md:13 and STATUS.md:459 — both still state the quartermaster suite at 191; the suite now reports 195, and quartermaster/README.md:21/:468 and CHANGELOG.md:36 both say 195. Round 4 added 4 checks and extended neither lineage. Re-broken (the same defect class the round-1 R0 review and the Sol·max verdict each raised and closed).

FINDING LIST FROM wo11-r0-review-2.md
- MAJOR — "freshness is never a gate input" → CONFIRMED-CLOSED. Reproduced the exploit against both commits from one script, with 772a688:quartermaster/quartermaster.js extracted into an isolated tree. OLD: 35% AU-opus reading 47.9h old + confirmation granted at t-23.9h → bucketState() routed {remainingFraction:0.35, stale:true, ageMs:172440000, quartermasterConfirmation:true} → real router.dispatch(I0) → ok:true, gate.allowed:true, casting {anthropic, Opus 5, high}. NEW at the identical fixture: REFUSED at bucketState(), naming AU-opus, before confirmation logic. Structurally: the age check is step (3b) of analyze() at quartermaster.js:539-556, ahead of throttles (4), state assembly (5) and confirmation re-validation (6). 23h → routable, state keys exactly ["remainingFraction"]; 24.000h → routable (> not >=, matching README's "age ≤ 24h" and confirm()'s predicate); 24h+1ms → refused. 25h → typed refusal, failClosed:true, .analysis attached, names the bucket, prints the --record fix. confirm() on a 25h reading refuses and appends nothing. Happy path intact: fresh 35% + fresh confirmation → quartermasterConfirmation:true, dispatch ok:true; same fixture without the confirmation → ok:false. publish() with one stale bucket refuses naming it, no snapshot written; bucketStateDetail() → ok:false, buckets:null; report() does not throw and marks REFUSED-FOR-ROUTING. Fail-open hunt — no surviving path: every producer of router-shaped state runs through bucketStateFromAnalysis() (:689, :697, :1091); analyze() leaves .value/.poolState undefined on a refused bucket. CLI verified by subprocess: --state exit 1, --publish exit 1 no file, --confirm exit 1, --report exit 0 with marker. maxStaleMs no longer influences routing (only predictThrottle's own bound :845-860); bucketState({maxStaleMs:'abc'}) on a 400-day reading is refused by maxFreshMs alone.
- MINOR heading-anchored STATUS citations → CONFIRMED-CLOSED (architect.md:92-93, wo11-band-record.md:155-156; heading at STATUS.md:523, item at :582, no intervening ## heading).
- MINOR "(pending)" Dispositions header → CONFIRMED-CLOSED (wo11-band-record.md:305-317).
- MINOR Incident 2 uncorroborated quote → CONFIRMED-CLOSED (labeled uncorroborated-in-repo; load-bearing claim on wo11-architect-ex1-transcript.md:24 verified byte-exact; timeline pinned to 2026-08-30).
- NITs from the prior round → all closed: "per D3 above" (both); CHANGELOG 2.2.0 in the file's style honoring the :3-5 rule; VERSION 2.2.0 read dynamically by install.js:37-39, no hardcoded copy; publish() single read.

CLAIMS CHECKED
- "behavior is unchanged, including the thrown error's shape and .analysis" → CONFIRMED (green fixture through both commits: bucketState() identical, report() identical; analyze() differs only by the intended removals).
- "195 checks" → CONFIRMED. Independent re-run: quartermaster 195 · router 135 · registry 31 · roster/lint.js OK (24) · install.js --lint 43 files 0 errors · review-lane 116 · verifier 101 · frontmatter-lint 37.
- New tests not vacuous → CONFIRMED (§3 Wednesday block asserts ordering, refusal, live confirm() refusal, hasOwnProperty absence; §15 predictThrottle boundary + inertness proof).
- Tree audit → CONFIRMED CLEAN; real .claude files untouched. No fixes were made.
- The amend left no stray artifacts → CONFIRMED except the SHA above.

NITS
- quartermaster.js:958-965 — refused-bucket table row overflows on a future-dated reading ("IN THE FUTURE by 5.0h" into pad(...,10)). Cosmetic, newly reachable.
- predictThrottle() accepts a 48h trend window while routing accepts 24h; documented as deliberate at README.md:163-170; not a routing path (report() skips prediction for refused buckets via the continue at :994). Worth one README line.
- roster/wo11-p0-ex1-report.md:120 and wo11-band-record.md:184 preserve round-3 live-run output "OU 86.0% 2.0d Green ok STALE (disclosed, not discounted)" unannotated; no longer producible.
- The snapshot contract lost disclosures[].stale; no in-repo consumer reads it back; no self-freshness check once aged on disk (pre-existing).
- Operational consequence, correctly disclosed in three places and confirmed live: the real readings file now fails closed for all four buckets — the substrate is un-armed for real dispatch until a /status reading is recorded per 24h window per bucket.
