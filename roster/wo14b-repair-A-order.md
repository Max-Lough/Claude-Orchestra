# WO-14b repair A — enforcement composition (oracle-ruled; awaiting owner approval)

- **Authority:** `roster/wo14b-session-oracle-verdict.md` § SHORTEST HONEST PATH item 2, and the
  finite defect inventory in `roster/wo14b-leg4-review-2.md` (8 MAJOR / 2 MINOR).
- **Owns one property:** *every capability the host or the engine server honours is one-use,
  unexpired, bound to its ticket's role/casting/generation, and every load or argument failure on
  the enforcement path denies before anything runs.*
- **Budget (oracle-set):** ≤ 40 planned tool calls; implementation ends by call 60; calls 61–80 are
  verification and report only; call 80 is `CHECKPOINT`. **No finding discovered mid-round is
  folded in** — it is reported for the integrated review.
- **FILES (exact):** `bridge/hooks/ticket-gate.js`, `bridge/runtime.js`,
  `packs/codex/hooks/orchestra-engine-mcp.js`, `router/tickets.js` (expiry check in `enginePass`
  only), `install.js` (gate-hook ownership by exact marker only), `hooks/orchestra-guard.js`
  (the process-level exception catch only), `tests/bridge.test.js`, `tests/mcp-lane.test.js`,
  `tests/install.test.js`, `tests/guard.test.js`. Nothing else.
- **Forbidden:** any new trust layer, fingerprint family, pin key, transcript heuristic,
  telemetry, schema, cross-project runner, seat, or model lane.

## Items (each pinned by a test reproducing the reviewer's probe)

1. `bridge/hooks/ticket-gate.js` — the runtime `require` moves **inside** the fail-closed wrapper:
   a missing/unloadable runtime under `roster:new` emits a deny decision with exit 0, never exit 1
   with no JSON.
2. `orchestra-engine-mcp.js` — after a trusted legacy flip (`rosterGeneration` bumped, hook
   entries removed) the engine server treats the project as **legacy** even though the runtime
   directory remains; the fingerprint rule yields to an explicit legacy manifest that the pin
   receipt corroborates. Tickets are ignored under legacy.
3. `orchestra-engine-mcp.js` — cross-project `cd` under `roster:new` is **rejected** with a typed
   `CD_NOT_SUPPORTED` (deferred as a canary by the oracle); enforcement is evaluated against the
   server's own project only.
4. `orchestra-engine-mcp.js` — argument validation (`work_order`, `role`, `ticket`, model/effort
   shape) completes **before** `enginePass` is committed; a parameter error leaves the ticket
   LAUNCHED and re-usable.
5. `router/tickets.js` `enginePass()` — refuses (typed) when `now >= expires_at`, transitioning
   the ticket to EXPIRED exactly as `launch()`/`resolve()` do.
6. `orchestra-engine-mcp.js` — the engine invocation's `model` and `effort` are taken **from the
   ticket's casting**, never from the caller; a caller-supplied value that differs → typed
   `CASTING_MISMATCH`, no invocation.
7. `bridge/runtime.js` + `orchestra-engine-mcp.js` — engine identity bookkeeping records only the
   engine-reported run nonce and the engine-reported model, else `'UNKNOWN'`; never a launcher
   model, never an invented nonce.
8. `install.js` — `isOurGateHookEntry()` matches only an entry carrying the exact
   `GATE_HOOK_MARK` tag (the marker string the installer writes), never a path substring.
9. `hooks/orchestra-guard.js` — the process-level `catch` in `main()` **denies** under
   `roster:new` (allow only on the legacy path, as documented).

## Declared verification (paste actual outputs)

    node tests/bridge.test.js
    node tests/mcp-lane.test.js
    node tests/tickets.test.js
    node tests/install.test.js
    node tests/guard.test.js
    node tests/exec-lane.test.js
    node install.js --lint

Report: STATUS / CHANGES (path:line per item 1–9) / VERIFICATION / DEVIATIONS / CONCERNS.
