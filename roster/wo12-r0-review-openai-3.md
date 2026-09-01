# WO-12 R0 Review (OpenAI) — Attempt 1 (Gate-Class Delta Round 2)

**Date:** 2026-08-31  
**Lane:** Reviewer, OpenAI casting, GPT-5.6 Sol · high via Codex CLI  
**Pinned:** 6f296b6..efe9977 (delta round 2)  
**Command:** `node packs/codex/hooks/orchestra-review.js --work-order <wo.txt> --executor-report <er.txt> --base-ref 6f296b6 --head-ref efe9977 --timeout-ms 1800000`  
**Wall Clock:** ~10 minutes (actual review execution time within the Codex sandbox)  
**Attempt Count:** 1  

## Review Output

```
REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (flag), attempts: up to 2, checkout: pinned worktree @ efe99779ca34)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: reclaimed 1 abandoned review worktree(s) from a prior run
PREFLIGHT: auth/exec probe: ok in 8088ms
PREFLIGHT: pinned review: checked out efe99779ca34 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-HsfUHV\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/build-corpus.js:364 — unchecked artifact IDs escape `--run-clone-root` before recursive deletion — given an ID such as `../victim`, `prepareRunClone` deletes and replaces the sibling directory; a temporary reproducer lost its sentinel file.
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/corpus/CONSTRUCTION.md:46 — seeded/control brief length remains a reliable blinding tell — given the requested sample, sdc-050's 107-word order is certainly a control because every seed is 121–159 words; corpus-wide means remain visibly separated at 144.3 versus 128.3.
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:714 — false-blocker completeness is tracked per artifact, not per finding — given one control with two blocker findings and an adjudication for only one, gate 3 reports PASS at 0% instead of INCOMPLETE; reproduced directly.
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:427 — "exact served-model identity" compares against a header that merely echoes the requested `CONFIG.model` — given a Terra request silently served by Sol, the header still contains `gpt-5.6-terra`, so gate 5 records MATCHED instead of detecting or excluding the mismatch.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:821 — interrupted phases are still not resumable — given five persisted reviews followed by interruption, rerunning starts all artifacts again and appends duplicate IDs, re-billing completed reviews and leaving scorer completeness permanently wrong.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:855 — the phase-0 stop counter is local to one invocation and lane — given three final UNAVAILABLE results on X-Sol, a fresh X-Terra invocation starts from zero and proceeds instead of honoring ">2 in either lane → halt."

CLAIMS CHECKED
- "efe9977 closes every finding of both round-1 verdicts with a pinning test (376 checks)" → REFUTED (`node tests/wo12-tooling.test.js` did pass 376/376, but targeted counterexamples reproduced the false-blocker, resume, identity, blinding, phase-stop, and deletion defects above)
- "81ca7cf regenerates all 168 briefs from corpus/content under one skeleton per variant" → CONFIRMED (fresh temporary-clone assembly generated 168 briefs and reported one work-order skeleton plus one executor-report skeleton per variant)
- "assembly verified idempotent (sha-256 identical across two runs)" → CONFIRMED (two production assembly runs in a temporary clone exited 0; SHA-256 inventories of all 322 corpus files were identical)
- "sanitized run clones show 0 refs, rev-list --all == HEAD, key blob absent, for seeds and controls alike" → CONFIRMED (independently materialized sdc-001 and sdc-007; both had empty `for-each-ref`, `rev-list --all` equal to `rev-list HEAD`, and inaccessible key blob/path)
- "all suites green; install lint clean" → CONFIRMED (all JavaScript suites passed; the environment-sensitive exec suite passed 79/79 after removing inherited process-level Git-isolation variables; lint checked 43 files with 0 errors and 0 warnings)
- "Authored by Claude (Anthropic) agents under the Conductor" → UNVERIFIED (both commits are authored/committed by Max-Lough and carry a Claude Fable co-author/session trailer; orchestration provenance is not independently establishable)

NITS
- tests/wo12-tooling.test.js:1474 says the refused phase-1 dry run prints no RUN ORDER block, but its assertion checks only for the later "DRY RUN" marker; the required live command did print the complete run order before refusing.
```

## Summary

First and final attempt completed successfully in a single invocation; VERDICT is REVISE with no capacity unavailability. No order-vs-settings mismatch detected; command flags matched Codex CLI defaults.
