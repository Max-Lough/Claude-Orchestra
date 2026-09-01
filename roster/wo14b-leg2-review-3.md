# WO-14b leg 2 — cross-vendor review #3 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `fa01a03..249a62a`, confined to the leg-2 fix-round-2 files (the range also carries the leg-3 merge, records, and the leg-4 checkpoint — reviewed separately). Author family: anthropic (Sonnet 5 Builder implementing a Fable 5 Conductor-specified design). Policy: mandatory. Launched 06:05Z, exit 0 at 05:41:34Z (engine clock); `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 249a62a7d312)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5539ms
PREFLIGHT: pinned review: checked out 249a62a7d312 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-2M16au\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] router/tickets.js:192 — malformed or partially written lock metadata bypasses the lock budget indefinitely — given a holder crashes after creating `tickets.lock` but before completing its JSON write, every waiter loops at the parse retry without sleeping or checking `lockBudgetMs`; a probe with a 50 ms budget was still spinning after 10 seconds instead of taking over or throwing `TicketStoreError`.
- [MAJOR] [BREACH] router/tickets.js:273 — reconciliation cannot reliably distinguish orphaned events from committed or retried events — given a reader loads state while a writer is between event append and state rename, it records that in-flight sequence as dropped even when the writer subsequently commits; an independent probe committed generation 2/seq 1 while the log simultaneously contained `bumpGeneration` seq 1 and `reconcile {dropped:[1]}`. After a genuine crash, the next write also reuses the dropped sequence, leaving orphan and valid events with the same seq and an ambiguous reconciliation marker.

CLAIMS CHECKED
- "a live holder is never displaced; the waiter fails closed after lockBudgetMs" → CONFIRMED (re-ran the paused-live-holder process test; the holder committed and the waiter threw `TicketStoreError`).
- "a provably dead holder past lockStaleMs is taken over cleanly" → CONFIRMED (re-ran the SIGKILL/dead-holder test; takeover committed with no lost update or tombstone).
- "an unwritable events log causes no state change" → CONFIRMED (source inspection and both directory-at-log-path and injected-append-failure tests).
- "an orphan event is reconciled without changing state" → REFUTED (state remains unchanged, but reconciliation can falsely mark a later committed event or ambiguously mark both an orphan and its same-seq retry as dropped).
- "expiry refusals log [expire, denied]" → CONFIRMED (late launch and resolve tests produced the required event shapes and attempts).
- "medium on both schemas reaches the M0 guard through order.medium" → CONFIRMED (schema validation and direct router tests for videoAudio/documents).
- "the public API of router/tickets.js is unchanged" → CONFIRMED (export comparison; only `_internal.isPidAlive` was added).
- "Declared verification is green" → CONFIRMED (all declared commands passed independently; reported counts were inaccurate: router produced 196, not 197, and quartermaster 216, not 217).
- "none outstanding" → REFUTED (lock corruption can hang every writer, and reconciliation does not produce an authoritative audit log).

NITS
- none
== exit 0 2026-09-01T05:41:34Z ==
