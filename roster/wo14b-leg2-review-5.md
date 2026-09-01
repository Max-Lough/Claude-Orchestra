# WO-14b leg 2 — cross-vendor review #5 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `59521a3..793af4c`, confined to router/tickets.js, tests/tickets.test.js, router/README.md (fix round 4). Author family: anthropic (Sonnet 5 Builder on a Fable 5 Conductor-specified design). Policy: mandatory. Exit 0 at 06:17:26Z (engine clock); `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 793af4c05fec)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 7279ms
PREFLIGHT: pinned review: checked out 793af4c05fec into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-OJb3fk\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] router/tickets.js:625 — partial writes are treated as complete without checking `fs.writeSync()`’s byte count — given a multi-event `bumpGeneration()` append short-writes exactly after its first newline, all three tickets become `INVALIDATED` and state commits, but only the bump event is logged; the newline-terminated log triggers no reconciliation on the next mutation instead of recording every transition or failing the mutation.
- [MINOR] [BREACH] router/tickets.js:769 — `lastLockAnomaly` is retained only on the process-local store object — given the hook process that observed the mismatch exits and the next hook process opens the same directory with a fresh store object, no `lock_anomaly` event is emitted instead of the promised next-write audit record.
- [MINOR] [BREACH] tests/tickets.test.js:1206 — the claimed post-commit regression test changes `owner.json` from the append hook, before `writeStore()` commits at router/tickets.js:753 — given ownership loss occurs specifically after the state rename, this test never exercises that timing window and can pass without pinning the required behavior.
- [MINOR] [GAP] router/tickets.js:524 — torn-tail detection equates “ends in newline” with “complete JSONL record” — given a malformed fragment ends with a physical newline inside an unterminated JSON string, the next mutation commits with no `torn_tail` reconciliation instead of surfacing the corrupted audit record.

CLAIMS CHECKED
- "STATUS: DONE — all four review-#4 findings fixed and pinned." → REFUTED (independent short-write and fresh-store probes reproduced two remaining audit gaps).
- "a torn tail ... inserts exactly one '\n', one reconcile line carrying torn_tail, and the mutation's own event" → CONFIRMED (ordinary unterminated-tail probe produced one boundary newline, matching bytes/sha256, reconcile seq 1, and mutation/state seq 2).
- "an unlocked read of a torn log reports store.tornTail and writes nothing" → CONFIRMED (byte-for-byte comparison before and after `get()`).
- "the next locked write appends a lock_anomaly line" → REFUTED (a true post-commit mismatch set the first store object's anomaly, but a fresh store—the separate-process caller shape—performed the next write with zero `lock_anomaly` lines).
- "three stale tombstones → swept on acquire; a fresh one survives" → CONFIRMED (independent filesystem probe).
- "unknown-holder timeout descriptor no longer duplicates 'for > budget'" → CONFIRMED (97 ms probe emitted the phrase once).
- "node tests/tickets.test.js → 133 PASS / 0 FAIL" → CONFIRMED (exit 0).
- "node tests/router.test.js → ALL CHECKS PASSED — 196 passed" → CONFIRMED (exit 0).
- "node tests/bridge.test.js → 62 passed, 0 failed" → CONFIRMED (exit 0).
- "node registry/load.js → registry OK … 8 schemas in sync" → CONFIRMED (exit 0).
- "node install.js --lint → 30 files 0 errors" → CONFIRMED (exit 0).

NITS
- none
== exit 0 2026-09-01T06:17:26Z ==
