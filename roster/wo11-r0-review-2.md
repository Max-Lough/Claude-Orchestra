<!-- R0 delta re-review of rounds 2-3. Claude Opus 5 · high, scope 9fe143f..772a688, verdict REVISE — 1 new MAJOR. -->
<!-- Closed in round 4 at fc9e0b8 (this round's own commit — see `git log` for the final hash; self-reference is necessarily approximate). -->

REVIEW ENGINE: Claude Opus 5 · high (R0 anthropic lane, fresh context, tier: full)

VERDICT: REVISE

One new MAJOR. Every listed finding from both verdicts is closed or dispositioned except one MINOR that round 3 re-broke, and one Sol MAJOR that is closed only in part — and the residual of that one is the same root cause as the new MAJOR.

VERIFICATION RE-RUN (independent): quartermaster 191 · router 135 · registry 31 · review-lane 116 · verifier 101 · frontmatter-lint 37 · roster/lint.js OK (24 role files) · install.js --lint 43 files, 0 errors. The new §13–§16 tests are not vacuous — they assert specific gate strings, specific void reasons, hasOwnProperty absence, unchanged append counts, and typed error regexes.

NEW FINDINGS

[MAJOR] quartermaster/quartermaster.js:584-604 — the round-2 re-anchoring re-validates a confirmation's evidence identity, fraction, throttle and exhaustion, but never the live reading's own AGE. The §5.5 Amber gate therefore lifts on evidence up to 48h old, and both the code comment and the README assert the opposite. Given: AU-opus read at 35% Monday 09:00; confirm() granted the same hour. No new reading is recorded. Wednesday 08:00 (reading 47.9h old, confirmation 23.9h old) a dispatcher calls bucketState() and dispatches an I0 review order. Observed on fixture: published state {remainingFraction:0.35, stale:true, ageMs:172440000} plus quartermasterConfirmation:true → preDispatchGate allowed:true → Opus 5, rung primary, un-gated, un-recast. confirm() asked for a fresh grant at that same instant refuses ("latest AU-opus reading is 1.3d old… past the 1.0d freshness window") — the gate honors a grant it would no longer issue. By README.md:106-107's own stated burn rate (~15-20%/day), a 35% reading is near zero after 47.9h. False claims refuted: quartermaster.js:107 "Confirmations, and any gate-lifting, already require FRESH (≤24h) evidence"; README.md:142 "a stale (24h-48h) reading… can never arm or satisfy a gate"; README.md:114 "age ≤ 24h — fresh. Full standing: it can arm the confirmation gate". README.md:135-142 is precisely the stated justification for R3's decision to keep publishing stale readings at all. Neither the code's five-condition list (:569-580) nor the README's (:245-252) includes reading freshness. Test §13 has no case for the live reading having gone stale.

[MINOR] roster/architect.md:92 and roster/wo11-band-record.md:155 — round 2's citation fix was re-broken by round 3 and propagated to a second file. Both cite STATUS.md:521-523 for WO-13; that text now lives at :582-583; :521-523 is PR #27 text. Round 2 applied the round-1 review's suggested line number verbatim without re-resolving it. The original round-1 MINOR is NOT-CLOSED.

[MINOR] roster/wo11-band-record.md:305-307 — "## Dispositions (pending — stage 2/3…)". Three review rounds have run, wo11-r0-review-1.md is committed, every finding is dispositioned. Contradicts the record's own round ledger at :534-566.

[MINOR] roster/wo11-band-record.md:351 — Incident 2's replacement attestation is itself uncorroborated: the new quote returns exactly one grep hit repo-wide — the band record asserting it. Honestly labeled, sibling contradiction closed, but a genuine committed attestation was available and unused (wo11-architect-ex1-transcript.md:24, "TREE AUDIT: no source paths changed while the engine ran"). Partial closure.

FINDINGS FROM R0 ROUND 1: CRITICAL confirmation-outlives-evidence → CONFIRMED-CLOSED (exploit re-run: 0.35 confirm + 0.10 reading → confirmation absent, dispatch ok:false, gate AU-O armed). MAJOR confirm() blind-grants → CONFIRMED-CLOSED (soft/hard throttle, malformed-latest, exhausted all refuse and append nothing; happy path still grants). MAJOR boundary validation → CONFIRMED-CLOSED (8/8 vectors throw; 400-day + 'abc' throws before publishing). MAJOR D1/F-1 → CONFIRMED-CLOSED (round-1 D1 struck under SUPERSEDED IN ROUND 2; re-ruling accepts IN FULL with counts (a)(b)(c); "orientation" WITHDRAWN; Defence-(1) re-attribution WITHDRAWN; F-1 own bullet). MAJOR STATUS "all four" → CONFIRMED-CLOSED (STAFFED; INCOMPLETE with fractions; strike-lines un-struck). MAJOR Incident 2 → CONFIRMED-CLOSED with the MINOR residual above. MINORs → all CLOSED except the STATUS.md:521-523 citation.

FINDINGS FROM THE SOL·MAX HOLISTIC VERDICT: "ALL DONE" → CONFIRMED-CLOSED (debt ledger carries all six owed exercises with unblock conditions). R3 stale window → CLOSED IN PART: 7d→48h and stale/ageMs on the published state (verified), but router.js:297-318 normalizeBuckets DROPS them — a 47.9h-old 90% AU-opus reading → Green → dispatch ok:true, Opus 5 primary, no gate. Narrowed 3.5× and disclosed, not removed; README.md:124-125 concedes it. Same root cause as the new MAJOR: freshness is never a gate input. R5 → CONFIRMED-CLOSED. D1 → CONFIRMED-CLOSED. WO-9/10 approvals unauditable → CONFIRMED-CLOSED as dispositioned (D3). N1-ex1 ground → CONFIRMED-CLOSED. n1-ex2 "full block" → CONFIRMED-CLOSED.

SURVIVOR GREP: no live survivors; every hit inside the committed verdict files, struck superseded blocks, or remediation notes. Check counts consistent at 191.

FAIL-OPEN HUNT: evidenceTs ISO-normalization safe (fails closed only); two readings sharing a ts → condition (c) voids; voiding appends nothing (pure reads); newer VOID shadowing older valid → void wins; future-dated confirmation ignored; reserve gate precedes confirmation (router.js:350 before :353); reserve floor 0.08 < orangeBelow 0.20; extra-key tolerance confirmed by code and empirically.

NITS: wo11-band-record.md:536 "per D3 below" (D3 is above). CHANGELOG.md carries no entry for the Quartermaster substrate nor for R3's 7d→48h cut (CHANGELOG:3-5 rule). quartermaster.js:1025-1026 publish() double file read. Incident 2's timestamps "~19:10–19:15" pinned to 2026-08-30 by wo11-p0-ex1-report.md:338 while the Stage-2 header says 2026-08-31 — name the date.

No fixes were made. Nothing in the tree was altered by this review.
