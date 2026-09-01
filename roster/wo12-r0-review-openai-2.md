# WO-12 R0 Review (OpenAI) — Attempt 2

**Date:** 2026-08-31  
**Lane:** Reviewer, OpenAI casting, GPT-5.6 Sol · high via Codex CLI  
**Pinned:** 3057429..e14232d  
**Re-attempt:** 2 after vendor capacity UNAVAILABLE; command: `node packs/codex/hooks/orchestra-review.js --work-order wo12-r0/wo.txt --executor-report wo12-r0/er.txt --base-ref 3057429 --head-ref e14232d --timeout-ms 1800000`; wall clock 2026-08-31T06:46:00Z

```
REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (flag), attempts: up to 2, checkout: pinned worktree @ e14232d3c21f)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: reclaimed 1 abandoned review worktree(s) from a prior run
PREFLIGHT: auth/exec probe: ok in 9274ms
PREFLIGHT: pinned review: checked out e14232d3c21f into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-CND1aE\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:211 — the P0 gate accepts any exit-0 JSON containing a truthy `OU` value and treats nonzero output as healthy unless it contains one exact phrase; it never verifies Green state or projected P15 reserve — given an exit-1 empty response (directly observed) or a valid Red OU response, `--yes` dispatches paid reviews instead of failing closed.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:382 — protocol §2.6 phase controls are not enforced — given three final UNAVAILABLE results during phase 0, the loop continues through the remaining artifacts instead of halting after more than two; arbitrary later phases can also run first.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:244 — result persistence is neither atomic nor resumable despite claiming prior artifacts cannot be lost — given interruption during `writeFileSync`, the next run parses the truncated file as invalid, resets it to `[]`, and overwrites all completed records.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/build-corpus.js:196 — materialized commit identity still depends on user Git configuration — given `i18n.commitEncoding=UTF-8` versus `ISO-8859-1`, the same sdc-001 base and patch produced heads `15ff0b6…` and `12b8017…`, so another machine can materialize a head different from the committed brief and CONSTRUCTION.md.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:160 — basename-only matching is enabled by default although §2.5 requires the locator file — given locator `src/a/index.js` and a finding citing `other/index.js:105`, the scorer reports a hit instead of a miss, inflating recall.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:215 — the required severity floor is not enforced — given an untagged `src/a/index.js:105` finding, the scorer returns a hit with `severity:null` instead of rejecting it as below the required MINOR floor.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:318 — adjudicated HIT promotions required by §2.5 are never applied to recall — given a mechanical miss that Opus adjudicates HIT with a quoted citation, it remains a miss and can incorrectly fail recall or CRITICAL-seed gates.
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:415 — an empty adjudication array makes the false-blocker gate pass at 0% — given complete Terra results containing blocker findings on controls and `--adjudication []`, gate 3 reports PASS instead of INCOMPLETE pending finding-by-finding adjudication.
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:323 — "exact model identity" means only that some header exists — given an X-Terra record whose header explicitly says `gpt-5.6-sol`, it is marked `identityKnown:true`, so gate 5 can pass instead of excluding and rerunning the mismatched artifact.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/assemble-key.js:392 — V1/V3 vendor lint examines only the author sentence, contradicting §2.7's whole-report blindness — committed V1 artifact sdc-043 says "Codex" at executor-report line 13 yet passes conformance, exposing vendor identity in the blind arm.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/assemble-key.js:377 — conformance checks substrings rather than the required verbatim templates, leaving a seeded/control tell — 12/30 seeded work orders exceed nine lines while 0/54 controls do, so a reviewer can identify those artifacts as seeded from packet shape.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/assemble-key.js:330 — the leakage exemption trusts any `Commit subject:` line without verifying it equals the artifact's actual subject — given `Commit subject: seeded defect at locator X`, leakage lint passes instead of rejecting the disclosed answer.

CLAIMS CHECKED
- "139 tooling checks green" → CONFIRMED (`node tests/wo12-tooling.test.js`: 139 passed, 0 failed)
- "all pre-existing suites green" → UNVERIFIED (the claimed aggregate suite set was not identified; the specifically cited review-lane suite and required lint were rerun)
- "review-lane 116/116" → CONFIRMED (`node tests/review-lane.test.js`: 116 passed, 0 failed)
- "assemble-key idempotent" → CONFIRMED (two isolated runs over a temporary corpus copy exited 0 and produced identical SHA-256 tree digests across all 237 current corpus files)
- "sha-256 over 206 corpus files identical across two runs" → UNVERIFIED (the checkout contains 237 corpus files and the report does not define the excluded 31-file subset)
- "run-lane refuses without --yes" → CONFIRMED (independent tooling suite reproduced the refusal)
- "run-lane refuses when quartermaster shows OU REFUSED" → CONFIRMED (the exact `REFUSED for OU` case refuses, although malformed and non-Green cases do not)
- "build-corpus materializes 84 artifacts with heads matching CONSTRUCTION.md" → CONFIRMED (temporary `--all` run produced 84 artifacts; every id/base/head matched the committed manifest and construction record)
- "Authored by Claude (Anthropic) agents under the Conductor" → UNVERIFIED (commit metadata shows Max-Lough as author/committer and one Claude Fable co-author trailer, but cannot establish the claimed orchestration provenance)
- "node install.js --lint is green" → CONFIRMED (43 files checked, 0 errors, 0 warnings)

NITS
- none
```

This runner made 1 engine attempt (reported within the output as "attempts: up to 2, checkout: pinned worktree @ e14232d3c21f" with actual execution of attempt 1) and completed with VERDICT: REVISE, yielding 13 findings (3 CRITICAL, 10 MAJOR) and 10 claims checked (6 CONFIRMED, 3 UNVERIFIED, 1 claim subset mismatch). The applied settings match the ordered parameters: GPT-5.6 Sol model, 1800000ms timeout flag, pinned checkout to e14232d, and baseline ref 3057429, with no divergence between requested and executed configuration.
