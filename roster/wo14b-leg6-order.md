# WO-14b leg 6 — the installed vertical spine (FOUR scenarios, per the finish plan)

- **Authority:** `roster/wo14b-finish-plan.md` § ASAP step 3 (supersedes the earlier reduced draft
  at `f64e9a6` and the 19-case framework at `13a4799`). "Do not duplicate pause/transcript/pin/
  moved/toggle/ladder matrices already owned by unit suites."
- **Class:** E2 Builder · risk T1 · Sonnet 5 · med. **Budget (oracle-set):** ≤30 planning calls,
  implementation by call 55, verification/report by 80; hard `CHECKPOINT` at 80. No mid-round
  folding. **Runs after repairs A and B are merged.**
- **FILES:** `tests/bridge-acceptance.test.js` (new), `tests/fixtures/bridge/**` (new: seeded
  Quartermaster readings; a stub `CODEX_BIN` that records invocations and returns a canned Band-C
  report or a canned `verdict-json` block echoing the dictated nonce), `.github/workflows/test.yml`
  (one step). Nothing else — **a defect found here is reported, not fixed** (it is input to the
  single integrated Sol review).

## The four scenarios (one fresh temp repository; the REAL installer; the REGISTERED hook
## commands invoked exactly as written; the INSTALLED MCP server over stdio)

1. **Fresh real install.** `node install.js <tmp> --roster new --packs codex` → the guard hook
   entry carries `--roster new`; the four gate entries with the installer's exact command lines;
   `.mcp.json` registers the engine server; the ticket store initialised; `tools/list` names exactly
   the five supported tools (`orchestra_dispatch`, `orchestra_close`, `orchestra_exec`,
   `orchestra_review`, `orchestra_doctor`); `orchestra_doctor` reports roster new, generation 1,
   store healthy, 0 open tickets; `orchestra_crossplan` and `orchestra_doctor live=true` →
   `UNSUPPORTED`.
2. **Anthropic T2 order, end to end (stub engine).** `orchestra_dispatch` (a Q0 trigger) → the
   task envelope exists (exclusively created) before any ticket; implementation + Q0 tickets;
   implementation consume refused until the Q0 ticket has LAUNCHED (synthetic Agent
   PreToolUse/PostToolUse through the registered gate command; the guard command allows because
   the gate is registered); SubagentStop binds the report; `orchestra_close` #1 → Verifier on the
   envelope base → PASS → reviewer ticket of the opposite family with `TICKET/MODEL/EFFORT/ROLE/
   PINNED_RANGE` in its header; the reviewer runs through the ticket-gated `orchestra_review` (stub;
   enginePass recorded; invoked once; a second call → replay refused, zero invocations); close #2
   → `CLOSED` from the authoritative engine result; casting records + verdict audit schema-valid
   and consistent with the envelope (served model from the engine or `UNKNOWN`).
3. **Bounded OpenAI order + denials + non-closing.** `tier: bounded` → `builder-openai`; the
   engine call's model/effort come from the ticket (a caller override → `CASTING_MISMATCH`, zero
   invocations); an Anthropic reviewer via synthetic Agent hooks → `CLOSED`. Then: wrong role,
   wrong vendor, expired ticket at enginePass → refused; an unticketed raw `orchestra_exec` →
   `TICKET_REQUIRED`, zero invocations; one forged-launcher-relay APPROVE over an engine REVISE
   → durably `NOT_CLOSED` on both tickets with telemetry persisted.
4. **Rollback with an open ticket.** `node install.js <tmp> --roster legacy` → generation bumped,
   the open ticket INVALIDATED, the gate inert, the guard entry without the argument, tickets
   ignored by the engine server under legacy; a legacy Agent call allowed; flip back → generation 3,
   nothing resurrected.

Runs on all three CI OSes. Existing unit suites stay required.

## Declared verification (paste results)

    node tests/bridge-acceptance.test.js
    node tests/bridge.test.js
    node tests/bridge-close.test.js
    node tests/mcp-lane.test.js
    node tests/install.test.js
    node tests/guard.test.js

Report: STATUS / CHANGES / VERIFICATION / DEVIATIONS / CONCERNS + DEFECTS FOUND (owning repair per
failing step). Never end while a process you started is running.
