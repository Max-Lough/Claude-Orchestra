# WO-14b leg 6 — the installed vertical spine (REDUCED per the session oracle)

- **Authority:** `roster/wo14b-session-oracle-verdict.md` § SHORTEST HONEST PATH item 4. This
  supersedes the earlier 19-case framework draft (kept in git history at `13a4799`): "run the real
  installer into a fresh repository and drive the installed MCP server and registered hooks … do
  not duplicate the unit suites' full ladder/toggle/retirement matrices in a new framework."
- **Class:** E2 Builder · risk T1 · Sonnet 5 · med. **Budget:** ≤40 planned calls, implementation
  by 60, verification 61–80, hard `CHECKPOINT` at 80. No mid-round folding.
- **Runs after** repairs A and B are merged. **FILES:** `tests/bridge-acceptance.test.js` (new),
  `tests/fixtures/bridge/**` (new: seeded readings; a stub `CODEX_BIN` that records invocations and
  returns a canned Band-C report / a canned `verdict-json` block echoing the dictated nonce),
  `.github/workflows/test.yml` (one step). Nothing else — **a defect found here is reported, not
  fixed** (it is input to the single integrated review cycle).

## The spine (one temp repository; the REAL installer; the REGISTERED hooks; the INSTALLED MCP server)

1. `node install.js <tmp> --roster new --packs codex` → census: guard hook entry carries
   `--roster new`; the four gate entries with the installer's exact command lines; `.mcp.json`
   registers the engine server; `.claude/orchestra/{router,registry,verifier,quartermaster,bridge}`;
   the ticket store initialised; the manifest with `projectId`/`rosterGeneration`/`installedHooks`/
   `installedStore`; legacy agents co-installed.
2. **MCP over stdio against the installed server**: `tools/list` names `orchestra_dispatch`,
   `orchestra_close`, `orchestra_exec`, `orchestra_review`, `orchestra_doctor`; `orchestra_doctor`
   reports roster new, generation 1, store healthy, 0 open tickets.
3. **Guard + gate composition** (synthetic `PreToolUse` through the installed hook scripts, invoked
   exactly as registered): an unticketed `Agent` → guard allows (registration verified), gate denies;
   a ticketed `Agent` → both allow; a gate entry removed → guard denies; a nested spawn → denied;
   a genuine pause file → both release; a manifest loosening key → no effect; a forged/oversized
   transcript → no effect on a `roster:new` decision; a Write to the pause path (any spelling) →
   denied.
4. **Anthropic-authored order (stub engines)**: `orchestra_dispatch` (T2, a Q0 trigger) → the
   envelope exists before any ticket; implementation + Q0 tickets; Q0 consume before implementation
   consume is refused, then allowed after the Q0 PostToolUse launch; synthetic `PostToolUse` and
   `SubagentStop` bind the result; `orchestra_close` #1 → `runVerification` on the envelope base →
   PASS → reviewer ticket of the opposite family with `TICKET/MODEL/EFFORT/ROLE/PINNED_RANGE` in the
   header; the reviewer runs through the ticket-gated `orchestra_review` with the stub engine
   (enginePass recorded; stub invoked once; a second call → replay refused); `orchestra_close` #2 →
   `CLOSED`; the two casting records + the verdict audit are schema-valid and agree with the
   envelope (served model from the engine result or `UNKNOWN`, never invented).
5. **OpenAI-authored order (stub engine)**: `tier: bounded` → `builder-openai`; the engine call's
   model/effort come from the ticket (a caller override → `CASTING_MISMATCH`); Anthropic reviewer
   via synthetic Agent hooks → `CLOSED`.
6. **Denials**: unticketed raw `orchestra_exec` → `TICKET_REQUIRED`, zero stub invocations;
   an expired ticket at `enginePass` → refused; a ticket after `castings.json` changes →
   `CONFIG_CHANGED`.
7. **Non-closing**: a stub REVISE → `NOT_CLOSED` with telemetry persisted and durable
   `NOT_CLOSED` on both tickets; a forged launcher relay saying APPROVE over an engine REVISE →
   `NOT_CLOSED`.
8. **Rollback**: `node install.js <tmp> --roster legacy` with one open ticket → generation bumped,
   the ticket INVALIDATED, the gate inert, the guard entry without the argument, `orchestra_exec`
   ignores tickets under legacy; flip back → generation 3, nothing resurrected.

Runs on all three CI OSes (a junction/symlink case skips with a named reason only where the OS
refuses). Existing unit suites stay required.

## Declared verification (paste results)

    node tests/bridge-acceptance.test.js
    node tests/bridge.test.js
    node tests/bridge-close.test.js
    node tests/mcp-lane.test.js
    node tests/install.test.js
    node tests/guard.test.js

Report: STATUS / CHANGES / VERIFICATION / DEVIATIONS / CONCERNS + a DEFECTS FOUND section naming
the owning repair for each failing spine step. Never end while a process you started is running.
