# WO-14b leg 4 — activation state machine (runtime core, hooks, MCP/CLI adapters)

- **Class:** E2 Builder · risk T2 · casting Anthropic Sonnet 5 · high (dense).
  **Tool budget: 80 calls** → `CHECKPOINT`. Runs after legs 2 and 3 are committed.
- **Branch:** `claude/wo14b-bridge`. **Do not commit.**
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 4 + mechanism section).
  Contracts: `router/tickets.js` (leg 2a — read its exports and `tests/tickets.test.js`),
  `registry/schemas/dispatch-request.schema.json`, `registry/schemas/ticket.schema.json`.
  Host facts: `roster/wo14b-leg1-lifecycle-proof.md` + appendix (payload shapes verbatim).
- **Law (Band C):** execute the order, the whole order, nothing but the order; blocked
  beats guessed; the report is a claim, not evidence.

## FILES

New directory `bridge/` (the shared runtime core; leg 3's installer copies it to
`.claude/orchestra/bridge/`): `bridge/runtime.js`, `bridge/cli.js`,
`bridge/hooks/ticket-gate.js`, `bridge/README.md`, `tests/bridge.test.js` (new).
Edit: `packs/codex/hooks/orchestra-engine-mcp.js` (add `orchestra_dispatch`; add the
ticket requirement to `orchestra_exec`/`orchestra_review`), `install.js` (only: copy
`bridge/` into the runtime dir on `--roster new`, register the four gate hooks in
`.claude/settings.json` on `--roster new`, remove on legacy flip — extend leg 3's
census test), `hooks/orchestra-guard.js` (only: call into the gate for `Agent` under
`roster:new`, using leg 3's `loadPolicy()` seam), `.github/workflows/test.yml`.
Forbidden: `router/router.js`, `router/castings.json`, `registry/schemas/*` (except
reading), `verifier/**`, `quartermaster/**` (call their exported APIs; do not edit).

## 1. `bridge/runtime.js` — one core, thin adapters

`createRuntime({ projectDir })` reads the owner-pinned manifest
`.claude/orchestra.json` (`roster`, `rosterGeneration`, `seats`), opens the ticket
store at `.claude/orchestra/tickets/` (`init:true` only on first `--roster new`
install — never re-initialise silently), builds the router with
`createRouter({ seats })`, and exposes:

- **`dispatch(request)`**: validate against `dispatch-request.schema.json` (invalid →
  typed `INVALID_REQUEST`, nothing written). Read **one fresh Quartermaster snapshot**
  via `quartermaster.bucketState()` from the project's readings file; a `failClosed`
  error → typed `P0_UNAVAILABLE` (never Green, nothing written). Build the canonical
  order (router mints the nonce), call `router.dispatch(order, buckets, {castOpts:{…,
  override, reserveCheck}})`. On `ok:false` return the router's typed outcome verbatim
  (`GATED`, `DISABLED`, `FORBIDDEN`, `WAIT`, `blocked:'Q0'`, `RETIRED_WORKFLOW`…) and
  append a **routing event** (`routing.events.jsonl`: `{at, request, buckets_digest,
  outcome}`) — an immutable record, not a casting record. On success: issue an
  implementation ticket (`author_family` = family of the served casting, or `human`
  per `human_authored`; `q0_ticket` set when the router returned a Q0 companion, whose
  own ticket is issued first with `kind:'q0'`), append the routing event, and return
  `{ ok:true, tickets:{implementation, q0|null}, spawn:{ subagent_type: <role file
  name>, prompt_header: "TICKET=<id>\n…" }, review_policy, casting, requested,
  recastFrom }`. `spawn.subagent_type` is the installed agent file name for the role
  (`Builder` → `builder`, `Test Designer`+family → `test-designer-vs-<family>`,
  `Reviewer`+family → `reviewer-<family>`; codex-engine seats resolve to their
  launcher file). The **reserve check** for a Sol override: call the Quartermaster's
  review-reserve predicate (find the exported function; if none is exported, compute
  `requiredReserve` vs the OpenAI bucket's forecast exactly as the router's
  `reserveGate` does and say so in CONCERNS) and pass `reserveCheck:'passed'` only when
  it passes — otherwise the router's typed `FORBIDDEN` stands.
- **`gate(event)`**: the hook brain (pure; the hook script is a 20-line adapter). For
  `PreToolUse` on `Agent` under `roster:new`: parse `TICKET=` from `tool_input.prompt`;
  `consume(id, {tool_use_id, role: tool_input.subagent_type})`; deny with the reason on
  any `TicketTransitionError`/`TicketStoreError`/missing ticket/missing state; a
  nested spawn (`agent_id` present) is denied unless the parent ticket grants SPAWN
  (only Conductor-issued reviewer/q0 tickets do — encode as `ticket.spawn_grant`
  default false; the runtime sets it true on tickets it issues to the Conductor's own
  Agent calls, which is all of them today — so effectively: a subagent may not spawn).
  `PostToolUse` on `Agent`: `launch(id-by-tool_use_id, {agent_id: tool_response.agentId,
  served_model: tool_response.resolvedModel})`. `SubagentStop`: `resolve(by agent_id,
  {last_assistant_message, agent_transcript_path})`. `Stop`: if `openTickets()` is
  non-empty and `!stop_hook_active` → `{decision:'block', reason:<ids + roles + what is
  awaited>}`; when the host's `background_tasks` lists none of an open ticket's
  `agent_id`s → mark it `EXPIRED` with reason `host reports no running subagent` and
  do not block on it. Under `roster:legacy` or when the manifest is absent/`roster !==
  'new'`: `gate()` returns `{inert:true}` for every event. Under `roster:new`: any
  parse error, missing store, or internal exception → **deny** (Pre) / block-once
  (Stop) / log-and-continue (Post/SubagentStop).
- **`ticketFor(kind, opts)`** for the engine server: `requireTicket({id, role, phase})`
  → consumes a ticket bound to that role/phase (`phase` ∈ `exec|review`) or throws a
  typed `TICKET_REQUIRED`/`TICKET_MISMATCH`.
- **`generationCheck()`**: on every call, compare the manifest's `rosterGeneration`
  with the store's; if the manifest is ahead, `bumpGeneration('roster generation
  advanced by the manifest')` first (this is how a `roster:legacy` flip invalidates
  open capability without the runtime being told).
- Closure (`close`) is **leg 5** — export a stub that returns typed `NOT_IMPLEMENTED`
  and say so in the README.

## 2. `bridge/hooks/ticket-gate.js`

A single script; `argv[2]` names the event; reads stdin JSON; calls
`runtime.gate()`; writes the hook JSON output from leg 1's proven shapes
(`hookSpecificOutput.permissionDecision` for Pre; `{decision:'block', reason}` for
Stop); exit 0 always (decisions are in the JSON, never in the exit code, so a crash
cannot fail open — wrap everything; on any throw under `roster:new` emit deny/block).
Installed by `install.js --roster new` into `.claude/settings.json` as
`PreToolUse`(matcher `Agent`), `PostToolUse`(matcher `Agent`), `SubagentStop`, `Stop`
entries tagged like the guard's (`isOurHookEntry`), removed on legacy flip.

## 3. Engine server — `packs/codex/hooks/orchestra-engine-mcp.js`

- Add `orchestra_dispatch` (input = the request schema; output = the runtime's
  result verbatim).
- `orchestra_exec` and `orchestra_review` gain an optional `ticket` input. Under
  `roster:new` (the server reads the manifest of its `cd`/project dir) a missing or
  mismatched ticket → the tool returns a typed `TICKET_REQUIRED`/`TICKET_MISMATCH`
  result **without invoking codex**; under legacy the input is ignored. The consumed
  ticket's `launched` gets `{agent_id: 'codex:'+run_nonce, served_model: <the engine's
  reported model>}` and `resolved` gets the executor report as
  `last_assistant_message` with the run log path.
- `orchestra_doctor` reports the manifest `roster`, generation, store health, and the
  count of open tickets.

## 4. `bridge/cli.js` — twins for tests (not evidence of installed reachability)

`node bridge/cli.js dispatch <request.json>` / `gate <event> < payload.json` /
`doctor`. Same core, same outputs.

## 5. Tests — `tests/bridge.test.js` (temp project dirs; no live models)

Pin: manifest absent/legacy → every gate event inert; `roster:new` happy path with the
leg-1 payloads verbatim (issue → Pre consume → Post launch → SubagentStop resolve →
Stop not blocked); unticketed/replay/wrong-role/expired/wrong-generation Pre → deny with
the reason; malformed stdin → deny; missing store → deny; nested spawn → deny; Stop
with an open ticket → block once, then allowed with `stop_hook_active`; Stop with an
open ticket the host does not list → EXPIRED, not blocked; manifest generation ahead
of store → open tickets INVALIDATED on the next call; `P0_UNAVAILABLE` on missing
readings, nothing written; `INVALID_REQUEST` on a request carrying `integrity_nonce`;
a security-touch request selecting a Fable rung → router `FORBIDDEN` passed through;
Q0 companion → two tickets, implementation unusable until Q0 LAUNCHED; DISABLED seat
→ passthrough with fallback text; engine-server ticket requirement (drive the MCP
server over stdio as `tests/mcp-lane.test.js` does) → `TICKET_REQUIRED` without codex
being spawned (stub `CODEX_BIN` and assert it was never invoked). All in CI.

## Declared verification (run all; paste results)

    node tests/tickets.test.js
    node tests/bridge.test.js
    node tests/mcp-lane.test.js
    node tests/exec-lane.test.js
    node tests/install.test.js
    node tests/guard.test.js
    node tests/router.test.js
    node install.js --lint

## Report format

    STATUS: DONE | PARTIAL | BLOCKED | CHECKPOINT
    CHANGES / VERIFICATION (actual outputs) / DEVIATIONS / CONCERNS

Never end while a process you started is still running. Do not run `git commit`.
