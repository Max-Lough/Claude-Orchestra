# WO-14b repair B — dispatch-to-close envelope (oracle-ruled; owner-approved 2026-09-01 17:50Z)

> **Amended by the finish plan (`roster/wo14b-finish-plan.md`, 18:20Z), sent to the running
> builder:** item 1's envelope carries **no ticket ids** and is keyed by `task_id`
> (`ledger/<task_id>/envelope.json`, exclusively created before issuance; closure derives it from
> `ticket.task_id`; no ticket/schema widening); item 7 returns `NOT_CLOSED: UNSUPPORTED_GATE_CLASS`
> for gate-class closures (no `falsification_run` construction); DRY — `close.js` uses
> `bridge/telemetry.js`'s `ledgerDir`/`atomicWriteJson` and `router.familyOf`.

- **Authority:** `roster/wo14b-session-oracle-verdict.md` § SHORTEST HONEST PATH item 3, and the
  finite defect inventory in `roster/wo14b-leg5-review-1.md` (8 MAJOR / 1 MINOR / 1 NIT).
- **Owns one property:** *dispatch persists one dispatcher-owned envelope that closure consumes;
  nothing executable is issued without it, and closure decides only from that envelope, the
  bound engine result, and dispatcher-owned casting facts — never from model-authored text.*
- **Budget (oracle-set):** ≤ 40 planned tool calls; implementation ends by call 60; calls 61–80 are
  verification and report only; call 80 is `CHECKPOINT`. **No mid-round folding.**
- **FILES (exact):** `bridge/runtime.js` (dispatch envelope + reviewer spawn header),
  `bridge/close.js`, `bridge/telemetry.js` (only if the envelope changes a writer's input),
  `roster/reviewer-openai.md` (pass ticket + role to its sole tool), `roster/reviewer-anthropic.md`
  (header fields, if needed), `registry/schemas/verdict-audit.schema.json` (add `REJECT` to the
  verdict enum only), `tests/bridge-close.test.js`, `tests/bridge.test.js`. Nothing else.
- **Forbidden:** new telemetry products, new schemas beyond the one enum value, a generic
  transaction framework, any trust layer.

## Items (each pinned by a test that drives production dispatch, not a hand-built fixture)

1. **Envelope.** `dispatch()` writes, atomically and **before** any ticket is issued, one
   envelope record `ledger/<task_id>/envelope.json` = `{ request, order (canonical, as validated),
   base (the repo HEAD at dispatch — the immutable audit base), risk, tickets: {implementation,
   q0}, requested_casting, served_casting, routing_result, at }`; a write failure → typed
   `ENVELOPE_UNAVAILABLE`, nothing issued. The routing event carries the envelope path. Tickets
   record `envelope` (path) so closure never searches the routing log.
2. **Close #1** reads the envelope by ticket: `baseRef` = `envelope.base` (never the reported
   commit's parent); the canonical `order` is the envelope's, validated against
   `order.schema.json` — if it does not validate, `NOT_CLOSED: envelope invalid` (never skipped).
3. **Band-C report** — all four sections (`CHANGES`, `VERIFICATION`, `DEVIATIONS`, `CONCERNS`)
   must be present and non-empty (a literal "none" counts); otherwise `NOT_CLOSED: incomplete
   report`.
4. **Codex-lane closure** — when the ticket carries `engine_result`, the verdict/report is taken
   **only** from `engine_result.report` (with its run nonce); the launcher relay
   (`resolved.last_assistant_message`) is ignored for the decision. Nonce mismatch → `NOT_CLOSED`.
5. **Cross-family** is derived from `familyOf(implementation.casting.model)` vs
   `familyOf(reviewer.casting.model)` — dispatcher-owned casting facts — never from
   `author_family` fields or the verdict text.
6. **Citations** — a `DIVERGES` replay is excused only by a reproduced finding whose `path`
   matches the citation's path; otherwise `NOT_CLOSED: unexplained citation divergence`.
7. **Gate class** — computed from the envelope's `risk`/`class`/`touches` using the real trigger
   lists (`securityTriggerList`, `mandatoryReview.classes`); a gate-class closure without a real
   `falsification_run` in the envelope is `NOT_CLOSED: falsification required` (deferred-as-canary:
   gate-class traffic stays out of the first shadow).
8. **Non-closing outcomes** persist: both casting records (with the reviewer's served model from
   the engine result or `'UNKNOWN'`, never the launcher's), the verdict audit (with `REJECT` now
   representable), and durable `NOT_CLOSED` on both tickets.
9. **Reviewer spawn** — close #1's `spawn.prompt_header` carries `TICKET=`, `MODEL=`, `EFFORT=`,
   `ROLE=`, and `PINNED_RANGE=<base>..<head>`; `roster/reviewer-openai.md` instructs the launcher
   to pass `ticket` and `role` to `orchestra_review` verbatim.

## Declared verification (paste actual outputs)

    node tests/bridge-close.test.js
    node tests/bridge.test.js
    node tests/mcp-lane.test.js
    node tests/review-lane.test.js
    node tests/registry.test.js
    node roster/lint.js && node install.js --lint

Report: STATUS / CHANGES (path:line per item 1–9) / VERIFICATION / DEVIATIONS / CONCERNS.
