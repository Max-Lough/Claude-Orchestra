<!-- Owner-requested cross-family holistic review of WO-11 (and, transitively, WO-8-10). -->
<!-- Engine: GPT-5.6 Sol at model_reasoning_effort=max, run via orchestra-review.js, cross-family lane. Range: 1ab4a19..9fe143f. -->
<!-- Raw engine output preserved verbatim below, INCLUDING its own duplicated/truncated tail — not repaired. -->

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 2400000ms (flag), attempts: up to 2, prohibited commands: 1, checkout: pinned worktree @ 9fe143fcf8b5)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 6911ms
PREFLIGHT: pinned review: checked out 9fe143fcf8b5 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-Nvve3T\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE
VERIFICATION NARROWED: Static inspection only; tests, builds, and application/engine launches were prohibited.

FINDINGS
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/STATUS.md:494 — Unsound completion decision: WO-8–11 is declared “ALL DONE” despite final-plan.md:2011-2012 requiring an end-to-end exercise before each role ships — Given E8, E1, and A0 obtained zero mission signal, A1 was never dispatched, E5 omitted its defining browser loop, and P0 still cannot publish real four-bucket state, the quick-start advances to WO-12 instead of holding the staffing gate open.
- [MAJOR] [BREACH] quartermaster/README.md:94 — R3 weakens the fail-closed pool gate by publishing 24-hour-to-7-day-old readings unchanged as current routing input; the disclosed `stale` flag is not part of `bucket_state` consumed by the router — Given a six-day-old 90% AU-opus reading followed by unrecorded consumption to 10%, the router sees Green and dispatches Opus without confirmation instead of refusing unknown-current evidence.
- [MAJOR] [BREACH] quartermaster/README.md:178 — R5 keeps a confirmation valid solely while the confirmation record is fresh, without invalidating it when a newer reading supersedes its `evidenceTs` — Given confirmation at 30%, then a newer 10% reading under the default 8% reserve, `quartermaster.js:487-499` publishes Orange plus `quartermasterConfirmation:true`, so `router.js:353-354` permits an Opus review instead of enforcing R5’s stated “Amber only, not sliding through Orange” rule.
- [MAJOR] [BREACH] roster/wo11-band-record.md:183 — D1 does not faithfully dispose the self-audit: it relabels the Q1 tools violation as “F-1,” while the audit’s actual F-1 is the separate primary-Conductor author-and-approve gap; it also softens a full charter violation and offers re-attribution without an acting-seat/casting record — Given a Fable Conductor later closes its own change, the real F-1 remains neither ruled nor registered despite the record claiming the audit findings were closed.
- [MAJOR] [GAP] roster/wo11-band-record.md:211 — WO-9/WO-10 approvals are unauditable because no review order, verdict, casting, or dispatch artifact was committed; only Director-authored tables and fix-commit summaries survive — Given a review used the wrong family or never occurred, the committed evidence would look identical and cannot establish the claimed independent REVISE→fix→APPROVE chain.
- [MINOR] [BREACH] roster/wo9-band-record.md:180 — Sound discard decision, imprecise record: missing retrieval dates supports rejecting N1-ex1, but the other retained ground falsely says the shell failure was not surfaced as a limitation — Given the transcript explicitly records it under VERIFICATION, DEVIATIONS, and CONCERNS at lines 21-28, the decision record treats disclosed degradation as undisclosed.
- [MINOR] [BREACH] roster/wo10-band-record.md:366 — Sound fault tally, imprecise record: N1-ex2 is called a “full block,” contradicting its transcript and the WO-9 record, which show three successful web fetches and only the local shell channel blocked — Given a reader analyzes fault modality, the record reports a total engine outage instead of a partial channel failure, although the 10/14 arithmetic remains unchanged.

CLAIMS CHECKED
- "Each WO-8–11 role shipped with one end-to-end exercised order" → REFUTED (compared final-plan.md:2011-2012 with STATUS.md:494-519 and the exercise rows).
- "The degraded and blocked outcomes were honestly disclosed" → CONFIRMED (the records explicitly state miscounts, omitted browser coverage, zero competency signal, deferred A1, and exercises owed; disclosure does not satisfy the gate).
- "Q0 has no lawful mirror, and E5 has no primary authoring mirror" → CONFIRMED (checked final-plan.md:75-79, 675-703, 789-819, castings.json:249-303, and router.js:417-488).
- "R4 uses the measured 0.03 WO-2 draw, producing 0.039 before the 0.08 floor governs" → CONFIRMED (re-derived from STATUS.md:72-79, castings.json:47-51, README.md:105-160, and router.js:72-79).
- "R7’s Exhausted evidence rule is plan-faithful" → CONFIRMED (zero reading or fresh hard throttle is explicit recorded evidence; soft throttle remains Red, matching §5.5).
- "The fault tally progresses from 10/14 to 12/16" → CONFIRMED (counted all committed run nonces and successful preflights; WO-9 contributes 3/5, WO-10 7/9, and WO-11 Architect 2/2).
- "The fabrication framing was correctly withdrawn" → CONFIRMED (the two N1 runs corroborate three sources and do not demonstrate fabricated citations).
- "Fresh-context Opus R0 reviews already ran and were recorded for every band" → REFUTED (WO-9/10 lack verdict artifacts, and WO-11 explicitly says review/dispositions are pending).
- "All required lint and test suites pass" → UNVERIFIED (prohibited: running the linters and test suites).
- "P0 was live-exercised against the real gitignored readings file" → UNVERIFIED (prohibited: launching the CLI/runtime; the real data file is intentionally absent from the pinned checkout).
- "Load-bearing final-plan citations in the three band records resolve" → CONFIRMED (enumerated and read the cited role, P2, §5.5, and WO-8–11 clauses).
- "Partner assessment: the session’s decision-making is trustworthy overall" → REFUTED (the record is unusually candid and several corrections are sound, but completion-gate relabeling, unsafe R3/R5 rulings, and D1’s self-audit omission make it unreliable without revision).

NITS
- quartermaster/README.md:21 and :299 still say 152 checks while STATUS.md says 154.
- tests/quartermaster.test.js:295 says “AT the floor (8%)” but exercises 0.0799, which is below the floor.
O-10 review verdicts were independently produced as recorded" → UNVERIFIED (no committed verdict, order, casting, or dispatch artifact exists).
- "P0 was exercised against one real OU reading" → UNVERIFIED (the claimed source and live readings files are absent from the pinned checkout).
- "All five/seven required test suites pass with the recorded counts" → UNVERIFIED (prohibited: running the test suites).
- "The band records’ load-bearing final-plan citations resolve" → CONFIRMED (line-resolution checks matched the cited Band A/B/C, Q0, E5, P0, and WO-8–11 passages).

NITS
- Refresh the stale 152/154 test-count references, “five” versus D1–D6 disposition count, completed-band “pending” placeholders, `castings.json`’s outdated “Two entries” comment, and shifted STATUS.md line citation. Partner assessment: the session is unusually candid and several rulings are sound, but declaring gated work complete, weakening P15, and softening its own audit make its decision-making insufficiently trustworthy to advance without revision.
