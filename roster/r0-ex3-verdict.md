# R0-EX3 verdict — cross-vendor gate re-review of fb07668..d00a7ae

Recorded verbatim from the review runner, 2026-08-30. Disposition: all five
findings verified real, fixed in round 3 (see wo8-review-dispositions.md).

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (env), attempts: up to 2, checkout: pinned worktree @ d00a7aedd28a)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 6022ms
PREFLIGHT: pinned review: checked out d00a7aedd28a into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-Ks8Glc\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] router/router.js:729 — The AU-F reserve gate examines the already-degraded casting, so generic pool degradation can bypass the promised reserve behavior — given an A1 primary casting with `AU-fable={state:"Amber",belowReserve:true}`, dispatch returns `ok:true` on Sol instead of GATED; the equivalent Conductor path also omits the required disclosure and mirror restrictions.
- [MAJOR] [BREACH] verifier/checkout.js:84 — The ReDoS fix collapses only adjacent stars; separated wildcard runs still cause catastrophic backtracking — given `("**a").repeat(10)+"**b"` against 32 `a` characters, `matchesAny` blocked for 5.456 seconds instead of the claimed sub-5-ms behavior.
- [MAJOR] [BREACH] verifier/verifier.js:201 — Output is truncated before credential redaction, allowing supported secrets to straddle the tail boundary — given an `sk-…` token crossing the 2,000-character cutoff, the recorded tail contained `…k-ABCDEFGHIJKLMNOPQRSTUV` instead of `[REDACTED]`.
- [MINOR] [BREACH] verifier/checkout.js:193 — The new SIGTERM cleanup listener does not execute on Windows — given a child with the same listener killed via SIGTERM, the process exited with `handled:false`, so an active checkout is terminated without `sweepActive()` instead of being removed and deregistered.
- [MINOR] [BREACH] router/router.js:186 — The touch-enum comparison embeds a literal NUL byte in JavaScript source — given a normal `rg -n "function dispatch" router/router.js`, the file is classified as binary and line-level results are suppressed instead of remaining searchable text.

CLAIMS CHECKED
- "every outstanding finding from the WO-8 gate review chain is closed" → REFUTED (the AU-F, glob, redaction, and signal-cleanup failures above were independently reproduced)
- "all declared verification commands are green at d00a7ae" → CONFIRMED (ran all seven declared commands; registry 31/31, verifier 89/89, router 129/129, score gates, loaders, and roster lint passed)
- "manifest pinned outside the audited commit by default" → CONFIRMED (`tests/verifier.test.js` exercised a head-tampered manifest and ran the base manifest)
- "mutations are wired into runVerification and the CLI" → CONFIRMED (source trace plus integrated and CLI mutation tests)
- "gated reviewers do not close; inert cannot relax mandatory review; uncastable required Q0 blocks" → CONFIRMED (router tests and direct call-path inspection)
- "touches is schema-reachable and load-linted; verdict-audit and casting mismatch gates are enforced" → CONFIRMED (schema inspection and negative validation tests)
- "Conductor AU-F reserve recasts to the Sol mirror with disclosure and restrictions; other Fable seats stay gated" → REFUTED (combined Amber+belowReserve state bypasses the reserve branch)
- "glob ReDoS reduced to under 5 ms" → REFUTED (separated wildcard-run probe took 5.456 seconds)
- "credential shapes are redacted from recorded output tails" → REFUTED (tail-boundary probe retained the reconstructible credential)
- "SIGINT/SIGTERM/SIGHUP sweep checkouts then re-raise" → REFUTED (Windows SIGTERM probe terminated without invoking the listener)
- "supplemental frontmatter/review/scan/exec/MCP suites were all green" → UNVERIFIED (frontmatter, scan, MCP, and sanitized exec suites passed; review-lane produced 108 passes and 6 environment-dependent failures against the current timeout/helper installation)
- "the stale 21-discriminator assertion is removed and the loader reports 22" → CONFIRMED (only historical quotations remain; the loader reports 22)

NITS
- none
