# WO-14b leg 2a — contracts: pre-dispatch request schema + ticket state machine

- **Class:** E2 Builder · risk T2 · casting Anthropic Sonnet 5 · med (legacy Agent path —
  the ticket path is what this leg builds). **Tool budget: 80 calls** → `CHECKPOINT`.
- **Branch:** `claude/wo14b-bridge` (already checked out). **Do not commit** — the
  Conductor commits after review. Do not touch any file outside FILES below.
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 2). Leg-1 evidence that
  fixes the shapes: `roster/wo14b-leg1-lifecycle-proof.md` § Design consequences.
- **Law (Band C):** execute the order, the whole order, nothing but the order; blocked
  beats guessed; the report is a claim, not evidence.

## FILES (the only paths you may create or edit)

- `registry/schemas/dispatch-request.schema.json` (new)
- `registry/schemas/ticket.schema.json` (new)
- `router/tickets.js` (new — pure state machine + store; no hook or MCP wiring)
- `tests/tickets.test.js` (new)
- `registry/load.js` — only if the schema loader enumerates schema files by name and the
  two new schemas must be registered; otherwise untouched.
- `registry/README.md`, `router/README.md` — one paragraph each documenting the new
  contracts.

Forbidden: `router/router.js`, `router/castings.json`, `router/aliases.json`,
`registry/schemas/order.schema.json`, `roster/**`, `install.js`, `hooks/**`,
`packs/**` (leg 2b and later legs own those).

## 1. `dispatch-request.schema.json` — what the Conductor hands `orchestra_dispatch`

The oracle's finding (`roster/wo14b-oracle-verdict.md`): `order.schema.json` is the
routed canonical order — it requires `requested_casting`, `author_family`,
`review_policy`, `integrity_nonce` and rejects unknown properties; `dispatch()` mints
the nonce itself. The request is a different object; the canonical order is its output.

Required: `class` (the order enum — include the merged classes; leg 2b keeps every
class id as a routing label), `risk` (`T0..T3`), `goal` (minLength 1),
`acceptance_criteria` (array of string, minItems 1).
Optional: `task_id` (if absent the runtime mints one), `parent_ticket` (string),
`tier` (`bounded|standard|dense|deep` — Builder-routed classes only; the router
defaults it by class), `override` (object `{ "rung": string, "reason": string }` — an
explicit Conductor casting override, e.g. Sol·high on `deep`; `reason` required
minLength 8), `touches` (same enum as `order.schema.json`), `context_shape` (same
enum), `scope_allow`, `scope_deny`, `constraints`, `context_packet`,
`verification_commands`, `verification_tier`, `tool_budget`, `destructive_actions`,
`human_authored` (boolean — the work under review was written by a human; the router
sets `author_family:"human"`), `under_specified` (boolean — the Conductor's own
admission; feeds the Luna guardrail).
**Never present:** `requested_casting`, `author_family` (other than via
`human_authored`), `review_policy`, `integrity_nonce`, `implementation_author_family`.
`additionalProperties: false`. Add `$comment` explaining the split.

## 2. `ticket.schema.json` + `router/tickets.js` — the authoritative lifecycle

From leg 1: the Agent tool is async; `PostToolUse(Agent)` carries `agentId` +
`resolvedModel`, the result arrives at `SubagentStop` as `last_assistant_message` with
`agent_transcript_path`. Tickets are the only way work is reached under `roster:new`.

**Ticket fields:** `id` (`tkt-` + 16 lowercase hex, from `crypto.randomBytes`),
`kind` (`implementation|q0|reviewer`), `task_id`, `class`, `role`, `rung`, `tier`
(nullable), `casting` (`{vendor, model, effort}` — the SERVED casting from
`dispatch()`), `author_family` (`anthropic|openai|human` — **dispatcher-owned**: the
family of `casting.model`, or `human` when the request said so; never model-asserted),
`parent_ticket` (nullable), `q0_ticket` (nullable — an implementation ticket that
requires Q0 records its Q0 ticket id here), `reviewer_of` (nullable — reviewer tickets
name the implementation ticket they close), `generation` (integer — the roster
generation at issue), `config_hash` (string — sha256 of the castings+aliases+manifest
the ticket was issued under), `issued_at`, `expires_at` (ISO; default TTL 6 h, caller
override), `status`, `consumed` (`{tool_use_id, at}` | null), `launched`
(`{agent_id, served_model, at}` | null), `resolved` (`{last_assistant_message,
agent_transcript_path, at}` | null), `outcome` (`{code, reason, at}` | null — typed
terminal), `attempts` (array of `{at, event, reason}` — every denied use of this id).
`additionalProperties: false`.

**States and the only lawful transitions** (anything else throws a typed
`TicketTransitionError`; the store never records an unlawful transition):

    OPEN ──consume(tool_use_id, role)──▶ CONSUMED ──launch(agent_id, served_model)──▶ LAUNCHED
      │                                     │                                          │
      │                                     └──── (no launch before expiry) ──▶ EXPIRED │
      └──expire / invalidate──▶ EXPIRED / INVALIDATED                                   ▼
                                                              resolve(last_assistant_message, agent_transcript_path)
                                                                                        ▼
                                                                                    RESOLVED
                                                                                        │
                                                        close(code) ──▶ CLOSED  |  NOT_CLOSED (typed reason)

Rules the module enforces, each pinned by a test:
- `consume` requires `status === 'OPEN'`, `now < expires_at`, `role === ticket.role`,
  `generation === store.generation`, and — for an implementation ticket with a
  `q0_ticket` — that the Q0 ticket's status is `LAUNCHED` or later (**an implementation
  spawn before its Q0 has launched is refused**). One use: a second `consume` on any
  status is refused and appended to `attempts`.
- `launch` requires `CONSUMED`; records `served_model` verbatim from the host.
- `resolve` requires `LAUNCHED`; a `resolve` for an `agent_id` that does not match the
  launched one is refused.
- `close` requires `RESOLVED`; `CLOSED` only with `code === 'CLOSED'`; every other code
  yields `NOT_CLOSED` with the reason kept. Reviewer tickets: `close` on the
  implementation ticket is refused unless its reviewer ticket is `RESOLVED` (the closing
  logic itself — verdict validation — is leg 5; this module only enforces the shape).
- `expire(now)` moves `OPEN`/`CONSUMED`/`LAUNCHED` past `expires_at` to `EXPIRED`.
- `bumpGeneration(reason)` increments the store generation and moves every
  non-terminal ticket to `INVALIDATED` with the reason (**this is the rollback hook**:
  `roster:new → legacy` invalidates all open new-roster capability).
- A `denied(id, event, reason)` call appends to `attempts` for an existing id, or to a
  store-level `unknown_attempts` list for an unknown id (the audit of forged ids).

**Store:** `createTicketStore({ dir })` → JSON file `tickets.json` (materialised state +
`generation` + `unknown_attempts`) plus append-only `tickets.events.jsonl` (every
transition and denial as one line `{at, id, from, to, event, data}`). Writes are
atomic (temp file in the same directory + `fs.renameSync`) and serialised in-process;
a cross-process advisory lock file (`tickets.lock`, O_EXCL create, stale after 10 s)
guards the read-modify-write — concurrent hook processes are the real caller (leg 1:
`PreToolUse`, `PostToolUse`, `SubagentStop`, `Stop` hooks are separate node processes).
Unreadable or schema-invalid store → every operation throws `TicketStoreError`
(callers fail closed; never re-initialise silently). `open({dir})` on a missing store
creates `generation: 1` only when `init: true` is passed.

**Exports:** `createTicketStore`, `issue(store, fields)` (validates against the schema,
mints id/timestamps, returns the ticket), `consume`, `launch`, `resolve`, `close`,
`expire`, `bumpGeneration`, `denied`, `get`, `list({status})`, `openTickets()`
(CONSUMED+LAUNCHED — the `Stop` guard's question), `TicketTransitionError`,
`TicketStoreError`, `STATES`, `TRANSITIONS`. Pure Node ≥ 20, no dependencies.

## 3. Tests — `tests/tickets.test.js` (same style as `tests/router.test.js`)

Pin, at minimum: schema accept/reject for both schemas (a request carrying
`integrity_nonce` or `requested_casting` is rejected; `override` without `reason`
rejected); the full happy path with the leg-1 payload shapes (use the verbatim values
from `roster/wo14b-leg1-lifecycle-proof-appendix.md` — `tool_use_id`, `agentId`,
`resolvedModel`, `last_assistant_message`); every refused transition above with its
typed error; replay refused and logged in `attempts`; wrong-role refused; expiry;
generation bump invalidating an OPEN, a CONSUMED and a LAUNCHED ticket while leaving
terminal ones untouched; Q0-before-implementation ordering; the events log line count
equals the number of transitions + denials; atomic write leaves no temp file; a
corrupted `tickets.json` makes every operation throw `TicketStoreError`; two
simulated concurrent writers (child processes) both succeed or one waits — no lost
update. Add the suite to `.github/workflows/test.yml` after `router.test.js` and to
the README test list if one exists.

## Declared verification (run all; paste results)

    node registry/load.js
    node tests/registry.test.js
    node tests/tickets.test.js
    node tests/router.test.js
    node install.js --lint

## Report format

    STATUS: DONE | PARTIAL | BLOCKED | CHECKPOINT
    CHANGES        - <path:line> — one line each
    VERIFICATION   - <command> → <actual output lines, especially failures>
    DEVIATIONS     - <or "none">
    CONCERNS       - <or "none">

Never end while a process you started is still running. Do not run `git commit`.
