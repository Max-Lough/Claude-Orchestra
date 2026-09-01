# bridge/ — WO-14b leg 4/4b activation runtime

One shared core (`runtime.js`) with thin adapters: the ticket-gate hook
(`hooks/ticket-gate.js`), a CLI twin (`cli.js`), and the engine server's
`orchestra_dispatch` / ticketed `orchestra_exec` / `orchestra_review` /
`orchestra_doctor` (`packs/codex/hooks/orchestra-engine-mcp.js`). Leg 4b adds
`manifest.js` — the owner-pin trust check every one of those goes through
before reading `roster`/`rosterGeneration`/`seats` from anywhere.

Installed by `install.js --roster new` as `.claude/orchestra/bridge/`
(copied verbatim from this directory), alongside the substrates it depends
on (`.claude/orchestra/{router,registry,verifier,quartermaster}/`).
`runtime.js` resolves those siblings relative to its own `__dirname`, so the
same file works unmodified from the source tree and from the installed copy.

## What lives here

- `runtime.js` — `createRuntime({ projectDir })`: `dispatch(request)`,
  `gate(event)`, `requireTicket({id, phase})` / `ticketFor(phase, opts)`,
  `generationCheck()`, `launch(id, opts)` / `resolve(id, opts)` /
  `denied(id, event, reason)` (leg 4b — the engine ticket lifecycle, below),
  `doctor()`. `close()` is a stub — leg 5's job — that always throws typed
  `NOT_IMPLEMENTED`.
- `manifest.js` (leg 4b) — `readTrustedManifest({ projectDir })`: the owner-pin
  trust check, below. No hook/MCP wiring of its own; every other file in this
  directory (and the engine server) reads roster state through it, never
  through `.claude/orchestra.json` directly.
- `hooks/ticket-gate.js` — the PreToolUse/PostToolUse/SubagentStop/Stop hook
  script installed under `roster:new`. Exit 0 always; decisions live in the
  JSON on stdout, never in the exit code, so a crash cannot fail a gate open.
- `cli.js` — `dispatch`/`gate`/`doctor` twins over the same core, for tests
  and operators. **Not evidence of installed MCP or Agent reachability** —
  that is leg 6/7's job.

## What is NOT here yet

- Closure (leg 5): the two-stage close (Verifier PASS -> computed Reviewer
  ticket -> structured verdict -> final casting/verdict telemetry).
- The strict structured review artifact and verdict-audit construction
  (leg 5).
- Installed-acceptance and live-canary proof (legs 6 and 7).

Leg 4c (this leg) closed out everything previously owed here: `install.js`
copies `bridge/` into `.claude/orchestra/bridge/` on `--roster new` and
registers/removes the four gate hook entries in `.claude/settings.json`
(`PreToolUse`/`PostToolUse` matcher `Agent`, `SubagentStop`, `Stop` -> `node
.claude/orchestra/bridge/hooks/ticket-gate.js <Event>`, tracked in the
manifest's `installedHooks`, removed on a legacy flip and on `--uninstall`);
`install.js` also writes the owner pin (`writePin()`/`writeManifestAndPin()`
— this existed before leg 4c, from the leg-3 fix round); and
`hooks/orchestra-guard.js` now delegates `PreToolUse(Agent)` to this
runtime's `gate()` under `roster:new` (trusted or untrusted-but-new alike),
returning its decision verbatim, DENYING (fail closed) if the runtime can't
be loaded — see `tests/guard.test.js` §16. `manifest.js`'s trust rules are
also now aligned to `hooks/orchestra-guard.js`'s own `loadPin()`/
`loadPolicy()` rules exactly (see the table below, revised) — the two
independent implementations are pinned to agree by `tests/guard.test.js`
and `tests/bridge.test.js`.

Nothing of leg 4 remains owed. Leg 5 owns: closure (the two-stage close
above), the structured review artifact/verdict-audit construction, and
everything after — legs 6/7 own installed-acceptance and live-canary proof.

## Ticket lifecycle this runtime enforces

`OPEN -> CONSUMED (PreToolUse) -> LAUNCHED (PostToolUse) -> RESOLVED
(SubagentStop)`, then `close()` (leg 5) to `CLOSED` or a disclosed
`NOT_CLOSED`; `EXPIRED`/`INVALIDATED` are the other two terminal states. See
`router/tickets.js` for the state machine itself — this runtime only calls
its exported operations, never reimplements them.

## Engine ticket lifecycle (leg 4b)

The Agent-tool lifecycle above is driven by real Claude Code hook events
(Pre/Post/SubagentStop/Stop). A codex run under the MCP engine server has no
such events — `orchestra_exec`/`orchestra_review` are ONE blocking tool call
each — so `packs/codex/hooks/orchestra-engine-mcp.js` binds the ticket itself,
around its own `runRunner()` completion, using `runtime.launch()` /
`runtime.resolve()` / `runtime.denied()`:

- `requireEngineTicket()` calls `runtime.ticketFor(phase, {id})` BEFORE any
  spawn — a missing/mismatched ticket returns typed `TICKET_REQUIRED`/
  `TICKET_MISMATCH` and codex is never invoked (proven by
  `tests/mcp-lane.test.js` §10 with a stub `CODEX_BIN` asserting zero
  invocations).
- On completion, `runRunner()`'s `bindTicket()` helper binds the now-CONSUMED
  ticket depending on which of the runner's named exit branches fired,
  **before** the MCP response is sent (not after — a caller/test that reacts
  immediately to the response must never observe a report whose ticket
  lifecycle hasn't landed yet):
  - **success / nonzero-exit / empty-output** — the run happened (codex was
    invoked and produced *some* captured output, even if it was a
    transport-class failure) — `launch()` then `resolve()`. `agent_id` is
    `'codex:' + <the run's own nonce>`: `orchestra-exec.js` prints
    `RUN NONCE: <hex>` in every header (success and failure alike);
    `orchestra-review.js` deliberately prints neither a nonce nor a
    `served_model` (its own header comment: Codex CLI's `--json` stream
    carries no server-confirmed model field, and echoing the requested one
    back would be exactly the unverifiable claim its reports refuse to make)
    — served_model falls back to `'UNKNOWN'` in that case, and a missing
    nonce falls back to a synthesized one so the ticket is still bound.
    `last_assistant_message` is the exact text the tool call returns;
    `agent_transcript_path` is the MCP server's own per-call run directory
    (`.claude/scratch/mcp/<lane>-<pid>-<ts>-<n>/`) — neither runner exposes a
    persistent log path of its own in its report text.
  - **cancelled / backstop** — the run was stopped before it produced a
    result — `denied(id, 'engine-cancelled'|'engine-backstop', reason)` only;
    the ticket is left `CONSUMED` (or `LAUNCHED`, if a nonce did surface
    before the kill) for its own TTL to expire, per the order.
  - **spawn never happened at all** (runner file missing, `spawn()` threw, or
    the OS-level `'error'` event) — no codex process, and so no nonce, ever
    existed. Extension beyond the order's five named branches: treated the
    same as cancelled/backstop (`denied('engine-spawn-error', ...)`, left for
    expiry) rather than fabricating a launch/resolve for work that never ran.
  - Every call is best-effort and idempotent (`ticketBinding._bound` guards
    against Node's `'close'`-after-`'error'` double-fire for a spawn
    failure): a thrown `TicketTransitionError`/`TicketStoreError` here is
    caught, logged to the server's stderr, and never allowed to affect (or
    escape into) the MCP response already built.

## Manifest pin verification (leg 4b)

`.claude/orchestra.json` is an in-project file — roster/wo14b-leg3-redteam-1.md's
`[HIGH]` finding showed it can be silently tampered with (or simply
corrupted) to change a project's activation state with nothing to detect it,
and flagged that owner-pinning was not implemented and "the pin is a leg-4
requirement." `manifest.js`'s `readTrustedManifest({ projectDir })` is that
pin check; `runtime.js`'s `createRuntime()` and the engine server's
`readOrchestraManifest()` both go through it exclusively — neither reads
`.claude/orchestra.json`'s `roster` field directly anymore.

**Pin file, by resolved project path**:
`<PIN_DIR>/<sha256(realpath(projectDir)), lowercase hex>.json`.
**Pin file, by project id** (a project that has MOVED since it was pinned):
`<PIN_DIR>/id-<sha256(manifest.projectId), lowercase hex>.json` — tried only
when the path-keyed file is absent and the manifest carries a `projectId`.
`PIN_DIR = process.env.ORCHESTRA_PIN_DIR || ~/.claude/orchestra/pins`,
honoured only if that directory actually exists — an env var pointing at a
nonexistent directory reads as "no pin dir", same as none configured.
**Pin content**: `{ projectDir, manifestSha256, roster, rosterGeneration,
seats, writtenAt, by }` — `manifestSha256` is the sha256 of the manifest
FILE'S BYTES at the moment the pin was written. Writing the pin is
`install.js`'s job (`writePin()`/`writeManifestAndPin()`); this module only
verifies it.

**Trust rules** (`{ manifest, trusted, roster, rosterGeneration, seats,
reason }`) — leg 4c aligned these to `hooks/orchestra-guard.js`'s own
`loadPin()`/`loadPolicy()` rules exactly; the two independent
implementations must never diverge (a request one denies that the other
would honour reopens the tampering hole the pin exists to close):

| Pin | Manifest | Result |
| --- | --- | --- |
| absent (no path-keyed or id-keyed file, or `ORCHESTRA_PIN_DIR` names a nonexistent directory) | claims `roster:"new"` | **UNTRUSTED-NEW, fail closed**: `trusted:false`, `roster:'new'` (never a silent legacy downgrade — that used to make "delete the pin" strictly safer, for an attacker, than editing the manifest), `reason:'manifest claims new without a pin'`. |
| absent | absent, or claims `roster:"legacy"` | `trusted:false`, `roster:'legacy'`, `reason:'unpinned'`. The gate is **inert** — a default-on-request posture, not an enforcement boundary. |
| present, well-formed, hash matches (path-keyed pin's own `projectDir` agrees with the resolved path, or found by the id key) | — | `trusted:true`; `roster`/`rosterGeneration`/`seats` come from the **manifest** (fall back to the pin's own copy if the manifest omits them); `roster` always equals the pin's (by construction, once hash-matched). Found by the id key with a differing `projectDir`: `reason:'project moved since pinning'` (informational — trust is unaffected). |
| present, well-formed, manifest missing/unreadable/hash mismatch | — | **UNTRUSTED**: `trusted:false`, `roster`/`rosterGeneration`/`seats` come from the **PIN** instead (the manifest is not trusted enough to read even its own `roster` field from), `reason:'manifest untrusted (hash mismatch)'` (with `' [project moved since pinning]'` appended if also found by the id key with a differing `projectDir`). |
| present but corrupt/unparseable, or a forged path-keyed pin (its own `projectDir` disagrees with the resolved path) | — | **UNTRUSTED-NEW**: `trusted:false`, `roster` forced to `'new'` (a pin file's mere existence signals this project was pinned at some point, so failing toward enforcement is the safe direction), `reason:'corrupt pin'` or `reason:'pin projectDir does not match this project'` — **never** `'unpinned'` (that collapse used to make deleting the pin strictly better, for an attacker, than editing the manifest). |

When the resolved `roster` is `'new'` and the manifest is not `trusted`,
`runtime.js` sets an internal `failClosed` flag and every decision fails
closed rather than running normal ticket logic against data that could have
been tampered with since it was pinned: `dispatch()` returns typed
`MANIFEST_UNTRUSTED`; `gate()` denies every `PreToolUse(Agent)`, blocks every
`Stop`, and reports `Post`/`SubagentStop` inert (there is no ticket state
left to safely mutate); `requireTicket()`/`ticketFor()` throw
`TICKET_REQUIRED` naming the untrusted reason. `hooks/orchestra-guard.js`
(leg 4c) delegates `PreToolUse(Agent)` to this same `gate()` under exactly
the same condition (`roster:'new'`, trusted or not) and returns its decision
verbatim — defense in depth if the installed settings.json hook entries are
ever stripped; if the runtime can't be `require()`'d, the guard denies on
its own. `doctor()` reports pin status under `.pin`:
`{ trusted, reason, file, failClosed }`. See `tests/bridge.test.js` §§13–20
for every branch pinned end to end (including a legitimate re-pin restoring
normal operation) and `tests/guard.test.js` §16 for the guard-side seam.
