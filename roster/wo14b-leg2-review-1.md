# WO-14b leg 2 — cross-vendor review #1 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Pinned `7704287..dfcfc9b` (throwaway worktree). Author family under review: anthropic (two Sonnet 5 Builders + Fable 5 Conductor rider). Policy: mandatory, gate-class.
Review order: the two leg-2 orders + framing (`wo14b-leg2-review-order.md`, scratch); executor report: both builder reports verbatim + the rider.
Launcher preflight: `CODEX_BIN` pinned, sha256 `cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4`, codex-cli 0.151.0. Launched 04:41:34Z, exit 0 at 04:49:47Z.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ dfcfc9b4d6cf)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 15s
PREFLIGHT: pinned review: checked out dfcfc9b4d6cf into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-xF6I0b\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] router/tickets.js:111 — stale-lock takeover is not ownership-safe and loses concurrent updates — given one writer remains active beyond 10 seconds, another unlinks its lock and enters the critical section; a focused two-process probe produced generation 2 instead of the expected 3, so concurrent consumes can both succeed and overwrite each other.
- [MAJOR] [BREACH] router/tickets.js:316 — `launch()` never checks `expires_at` — given a ticket consumed before expiry but launched afterward, it transitions to `LAUNCHED` instead of `EXPIRED`; reproduced with `launched.at` later than `expires_at`.
- [MAJOR] [BREACH] router/router.js:1238 — direct-role `resolveSeat()` bypasses seat toggles — given default-disabled `Sweeper`, `resolveSeat('Sweeper', {roster:'new'})` returns a usable role target instead of the required typed `DISABLED` outcome.
- [MAJOR] [BREACH] registry/load.js:39 — the enumerating schema loader omits both new schemas despite the work order requiring their registration — given either new schema’s class enum drifts, `node registry/load.js` still reports zero problems and “6 schemas in sync” instead of failing closed.
- [MAJOR] [BREACH] router/tickets.js:292 — the Q0 gate accepts any referenced ticket kind — given `q0_ticket` points to a launched reviewer ticket, the implementation consumes successfully instead of requiring a launched `kind:'q0'` ticket.
- [MAJOR] [BREACH] router/castings.json:257 — merging M0 deletes the raw video/audio `UNAVAILABLE` capability boundary while current contracts still promise it — given an M0 raw-video/audio intake, dispatch returns `ok:true` with Investigator/Opus instead of deterministic extraction or typed `UNAVAILABLE`.
- [MINOR] [BREACH] router/castings.json:259 — E1 loses its packet-only context ceiling — given an E1 order with `context_shape:'scoped'` or `subsystem`, dispatch accepts it through Builder instead of rejecting everything beyond `packet`, contradicting the router README’s structural guarantee.
- [MINOR] [GAP] router/router.js:54 — retired charters remain exposed through the router’s public configuration — given a caller enumerates `router.charters.charters`, it sees 23 entries including 12 retired roles although only 11 roles are routable.

CLAIMS CHECKED
- "Full suite at dfcfc9b" → CONFIRMED (registry 31, router 186, tickets 58, quartermaster 216, verifier 101, frontmatter 37; both roster/full lint and smoke commands exited 0).
- "atomic locked writes with no lost update across two processes" → REFUTED (stale-threshold probe lost one of two generation increments).
- "one-use consumption" → REFUTED (normal replay is refused, but stale-lock overlap allows two processes to read the same OPEN state and both succeed).
- "Q0-before-implementation ordering" → REFUTED (a launched reviewer ticket satisfied `q0_ticket`).
- "stale-family cycle-2 fix and mirror case" → CONFIRMED (source inspection and router tests verified served Terra→openai and Sonnet→anthropic).
- "cast()/dispatch()/resolveSeat() on a disabled seat return DISABLED" → REFUTED (cast/dispatch comply; direct-role resolveSeat bypasses the check).
- "thirteen role files deleted; lint green on eleven files" → CONFIRMED (diff inventory and independent lint runs).
- "M0 videoAudio guardrail dropped; E1 packet-only shape lost; 12 retired charters retained" → CONFIRMED (source inspection and focused dispatch probes).
- "99 tool calls against an 80-call ceiling" → UNVERIFIED (the pinned repository records the admission, but contains no raw tool-call telemetry).

NITS
- tests/router.test.js:1019 — the test label says “anthropic-served” while its assertion expects the openai/Terra case.
== exit 0 2026-09-01T04:49:47Z ==
