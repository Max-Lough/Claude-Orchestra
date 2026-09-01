# WO-14b shakedown punch list (owner ruling 2026-09-01: ship to shakedown; fine-tune in live use)

Items here do NOT break the vertical path (install → ticketed dispatch → close → telemetry). They
are fixed only if the shakedown shows they matter. No review→fix cycle is opened for them.

| # | Item | Where | Why it can wait |
|---|------|-------|-----------------|
| PL-1 | `tools/list` still enumerates `orchestra_crossplan` under `roster:new` (six names, plan expects five) | `packs/codex/hooks/orchestra-engine-mcp.js` tool registration; `tests/mcp-lane.test.js` case 1 asserts six | Calling it is typed `UNSUPPORTED` with zero engine invocations (proven in leg 6 scenario 1 and mcp-lane case 16). Cosmetic. |
| PL-2 | `install.js --roster legacy` bumps the manifest generation but never calls `tickets.bumpGeneration()`; an open ticket stays `OPEN` through the legacy window and is swept to `INVALIDATED` lazily on the next `gate()` touch | `install.js` roster-flip path; `bridge/runtime.js:337-345` `generationCheck()` | The stale ticket is denied and invalidated the moment anything touches the gate again (leg 6 scenario 4 proves the deny after re-activation). Nothing is consumable under legacy because the gate entries are removed. |
| PL-3 | Repair B's own concerns: `order.parent_ticket` vs schema `parent_id`; `tickets.close()` reviewer-gate vs `NOT_CLOSED` persistence with a stray open reviewer ticket; orphan envelope if `NO_LAUNCHER` fires after the envelope write; `findRoutingEvent()` dead code | `bridge/close.js`, `bridge/runtime.js`, `router/tickets.js` | None reproduced on the four installed scenarios; watch for them in live telemetry. |
| PL-4 | Repair A items 8/9 (exact gate-hook marker match; guard `main()` catch denies under `roster:new`) have no dedicated tests; engine model recorded to stderr only | `install.js`, `hooks/orchestra-guard.js`, `orchestra-engine-mcp.js` | Behaviour implemented; coverage gap only. |
| PL-5 | Deferred limits from the finish plan (pins/fingerprints/`--verify-pin`/`--repin` as receipts only; moved projects / cross-project `cd`; `bridge/cli.js` to delete; `--grants-local`; seat-toggle fallbacks; Sol override rungs; crossplan + live doctor; gate-class closure) | `roster/wo14b-finish-plan.md` § YAGNI | Documented limits, by ruling. |
| PL-6 | Leg-6 acceptance suite is the slowest lane (real installs + live MCP + hook subprocesses) | `tests/bridge-acceptance.test.js`, CI step | Watch CI wall-clock. |

Process note: leg 6 used 114 tool calls against the 80-call ceiling (breach #14, disclosed). The
builder's stated reason — four production-surface discoveries not written down anywhere (ticket WAL
shape; Verifier reads the committed base manifest; runner forwards only `STUB_CODEX_*`/`ORCHESTRA_*`/
`CODEX_*` env to `CODEX_BIN`; guard signals allow via empty stdout) — is itself punch-list input for
the README, not a reason to reopen the ceiling.
