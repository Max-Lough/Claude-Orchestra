# R0-EX4 verdict — cross-vendor delta re-review of d00a7ae..7e90c67

Recorded verbatim from the review runner, 2026-08-30. Disposition: all five
R0-EX3 closures CONFIRMED; four new findings, all fixed in round 4 (see
wo8-review-dispositions.md).

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 1800000ms (env), attempts: up to 2, checkout: pinned worktree @ 7e90c673184c)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: reclaimed 1 abandoned review worktree(s) from a prior run
PREFLIGHT: auth/exec probe: ok in 4749ms
PREFLIGHT: pinned review: checked out 7e90c673184c into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-Cx54Vf\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] router/router.js:186 — Comma-joining makes the touch-enum equality check collision-prone, allowing unequal schema and trigger sets to pass validation and disable mandatory controls — given schema entries `["auth","authz",...]` and a trigger union `["auth,authz",...]`, both join identically; `createRouter()` succeeds and an E0/T1 order with `touches:["auth"]` receives preferred review and `q0:null` instead of mandatory review plus Q0.
- [MINOR] [BREACH] verifier/checkout.js:111 — The DP rewrite does not preserve all previous matching semantics — given `matchesAny("\n", ["**"])`, HEAD returns true while the pinned-base matcher returned false; the same change occurs for CR, U+2028, and U+2029.
- [MINOR] [BREACH] verifier/checkout.js:223 — The documented startup recovery does not reclaim the actual Windows SIGTERM leftover — given TerminateProcess kills the process while its checkout directory exists, plain `git worktree prune` retains both the directory and registration instead of recovering them.
- [MINOR] [BREACH] roster/r0-ex3-order.md:1 — The pinned range is not the stated single round-3 commit — given `git log d00a7ae..HEAD`, the range contains both `444eaf3` and `7e90c67`, adding 136 lines across two extra record files beyond the reported round-3 commit.

CLAIMS CHECKED
- "all five R0-EX3 findings are fixed" → CONFIRMED (independently reproduced the exact reserve, separated-star, cutoff-redaction, Windows-signal, and NUL checks; the findings above are new defects or overclaims)
- "A1/I0 Amber+belowReserve GATE; both Conductor mirror paths are disclosed and restricted" → CONFIRMED (direct dispatch probes exercised all four paths)
- "the glob matcher is fast with unchanged matching semantics" → REFUTED (the adversarial pattern completed in 0.0244 ms and 530,255 ordinary differential cases matched, but line-terminator semantics changed)
- "redact before tail truncation prevents cutoff-straddling credential fragments" → CONFIRMED (independent stdout and stderr probes with a delimited credential crossing the 2,000-character boundary retained no credential fragment)
- "startup worktree prune is the recovery path for untrappable Windows kills" → REFUTED (SIGTERM was independently confirmed untrappable, but prune retained an extant abandoned worktree)
- "router.js contains no NUL bytes and greps as text" → CONFIRMED (`rg -n "function dispatch" router/router.js` returned line 700)
- "review-lane is 114/114 after case15 isolation" → CONFIRMED (case15 passed with a real install present; sanitized rerun was 114/114, while the outer review timeout override predictably made the unsanitized run 113/114)
- "all declared verification commands are green" → CONFIRMED (registry 31/31, verifier 92/92, router 134/134, both loaders, WO-7b gates, and roster lint passed)
- "supplemental frontmatter/review/scan/exec/MCP suites and both install lints are green" → CONFIRMED (37/37, 114/114, 41/41, 79/79, 68/68, and both lints passed after removing outer-harness environment overrides where required)
- "one commit, 9 files, +271/−51" → CONFIRMED (true for commit `7e90c67` itself)
- "the pinned base-to-head range contains the single round-3 commit" → REFUTED (`444eaf3` is also in the range; the complete diff is 11 files, +407/−51)

NITS
- none
