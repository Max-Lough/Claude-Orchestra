# WO-14b leg 2 — cross-vendor review #4 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `249a62a..eeb29a9`, confined to router/tickets.js, tests/tickets.test.js, router/README.md (the fix round answering review #3). Author family: anthropic (Sonnet 5 Builder implementing a Fable 5 Conductor-specified design). Policy: mandatory. Exit 0 at 06:00:28Z (engine clock); `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 564a0d2db681)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5578ms
PREFLIGHT: pinned review: checked out 564a0d2db681 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-tXWoVY\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] router/tickets.js:396 — torn JSONL tails are ignored and subsequent events are appended without restoring a line boundary — given a writer crashes or short-writes midway through an event, the next locked mutation concatenates its event onto the malformed tail and still commits `tickets.json`; an independent probe reached `CONSUMED`/seq 2 while only the original `issue`/seq 1 remained parseable, instead of recording reconciliation and consumption.
- [MINOR] [GAP] router/tickets.js:600 — confirmed lock-ownership loss is silently discarded — given the owner token changes after commit, the operation returns success and leaves the lock held; an injected-race probe made the following writer time out rather than surfacing the ownership fault on the first call.
- [MINOR] [GAP] router/tickets.js:318 — failed tombstone deletion is permanently ignored — given repeated stale-lock takeovers while recursive deletion fails, `.tomb-*` directories accumulate without later cleanup, although they do not block acquisition.

CLAIMS CHECKED
- "half-written or absent owner.json waiters respect lockBudgetMs" → CONFIRMED (independent 50 ms probes threw `TicketStoreError` after 63–66 ms).
- "unknown holders are aged by the directory timestamp" → CONFIRMED (source inspection and Windows probe: directory birthtime stayed fixed while owner creation advanced mtime; the code selects birthtime).
- "unlocked reads never reconcile; only a writer holding the lock does" → CONFIRMED (source inspection, suite, and reader-between-append-and-rename test).
- "the next write advances seq strictly past a complete orphan" → CONFIRMED (independent source trace and §17 tests).
- "release-time lock ownership loss is swallowed" → CONFIRMED (injected token mismatch returned success, left `tickets.lock`, and caused the next writer to time out).
- "None outstanding against the two review-#3 MAJORs" → REFUTED (the full-line reader race is closed, but a torn event tail still permits committed state without an authoritative parseable audit event).
- "node tests/tickets.test.js → 116 PASS / 0 FAIL" → CONFIRMED (independent run: exit 0, 116 pass, 0 fail).
- "declared verification is green" → CONFIRMED (`tickets`, `router`, `bridge`, registry load, and installer lint all exited 0; router reported 196 and bridge 42).

NITS
- The unknown-holder timeout message duplicates “for > budget”.
== exit 0 2026-09-01T06:00:28Z ==
