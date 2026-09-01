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
  `gate(event)`, `initStore()` (fix round item 9 — see below),
  `requireTicket({id, role, phase})` / `ticketFor(phase, opts)` (the engine
  ticket checkpoint — `enginePass()`, never a second `consume()`),
  `engineResult(id, opts)` / `denied(id, event, reason)` (the engine's
  completion bookkeeping), `generationCheck()`, `doctor()`. `launch(id,
  opts)` / `resolve(id, opts)` still exist as thin wrappers over
  `router/tickets.js` but the engine server no longer calls them directly —
  the Agent-tool gate's own PostToolUse/SubagentStop handling is what drives
  a codex-launcher ticket through `LAUNCHED`/`RESOLVED` now (see "Engine
  ticket lifecycle" below). `close()` is a stub — leg 5's job — that always
  throws typed `NOT_IMPLEMENTED`.
- `manifest.js` (leg 4b) — `readTrustedManifest({ projectDir })`: the owner-pin
  trust check, below. No hook/MCP wiring of its own; every other file in this
  directory (and the engine server) reads roster state through it, never
  through `.claude/orchestra.json` directly.
- `hooks/ticket-gate.js` — the PreToolUse/PostToolUse/SubagentStop/Stop hook
  script installed under `roster:new`. Exit 0 always; decisions live in the
  JSON on stdout, never in the exit code, so a crash cannot fail a gate open.
- `cli.js` — `dispatch`/`gate`/`doctor`/`init-store` twins over the same
  core, for tests and operators. **Not evidence of installed MCP or Agent
  reachability** — that is leg 6/7's job. `init-store` (fix-round item 9) is
  the ONLY lawful way to create a project's ticket store — the runtime
  itself never does this implicitly (a missing/unreadable store is a typed
  `STORE_UNAVAILABLE` at `dispatch()`/`gate()`/`requireTicket()` instead).
  `install.js --roster new` calls this same code path (`createRuntime({
  projectDir }).initStore()`, against the just-installed copy under
  `.claude/orchestra/bridge/`) as part of creating a fresh project —
  **only when no store exists yet**: idempotent on a re-run, a re-pin, or a
  legacy-flip-then-back-to-new, and recorded as `installedStore: true` in
  the manifest so `--uninstall` knows to remove it (a plain legacy flip
  leaves the store on disk, same as the roster files themselves — see
  "Ticket store install/uninstall lifecycle" below).

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

## Engine ticket lifecycle — the two-pass model (leg 4b, fix round item 2)

A codex-vendor launcher role (e.g. `builder-openai`, `reviewer-openai`,
`test-designer-vs-anthropic`) is dispatched, spawned, and stopped exactly
like any other Agent-tool launcher — it goes through the SAME
`OPEN -> CONSUMED -> LAUNCHED -> RESOLVED` state machine described above,
driven by the SAME real Claude Code hook events. The engine server
(`packs/codex/hooks/orchestra-engine-mcp.js`) is not a second ticket
consumer sitting beside that lifecycle — it is a checkpoint INSIDE it, one
that a codex launcher's own tool call passes through mid-flight:

1. **Agent PreToolUse** — the launcher subagent is spawned; the gate
   `consume()`s the ticket `OPEN -> CONSUMED`, exactly as for any launcher.
2. **Agent PostToolUse** — the spawn resolves async; the gate binds
   `agent_id`/`resolved_model` and moves the ticket `CONSUMED -> LAUNCHED`.
3. **`orchestra_exec` / `orchestra_review` (the launcher's own MCP call)** —
   `requireEngineTicket()` calls `runtime.ticketFor(phase, {id, role[, cd]})`
   BEFORE any codex spawn. This is **never** a second `consume()` — the
   fix round's whole point is that a second consume on an already-CONSUMED
   ticket rejected it as a replay, so no ticket issued by `dispatch()` could
   ever traverse Agent -> Codex successfully. Instead it requires the ticket
   to already be `LAUNCHED` and records a separate, idempotent
   `enginePass()` marker (`run_nonce`, `role`, `vendor`) the moment codex is
   actually about to run — **the ticket stays `LAUNCHED`**, it does not
   transition. Fails typed and invokes codex zero times on:
   - `TICKET_REQUIRED` — missing ticket/role, unknown id, wrong status (not
     yet `LAUNCHED`), or the manifest is untrusted (fail-closed, item 3's
     fingerprint gate below);
   - `TICKET_MISMATCH` — wrong phase/kind (a reviewer ticket used for
     `exec`), wrong role (item 5: bound to the launcher's own `ROLE=<role>`
     header, not just kind/phase), or a non-`openai` casting (item 5: every
     engine ticket must be OpenAI-served by construction — only OpenAI-served
     castings route through a codex launcher at all);
   - `TICKET_REPLAY` — a SECOND `orchestra_exec`/`orchestra_review` call on a
     ticket that already has an `engine_pass` recorded;
   - `CONFIG_CHANGED` (item 8, below).
4. **On completion**, `runRunner()`'s `bindTicket()` helper binds the run's
   outcome **before** the MCP response is sent (not after — a caller/test
   that reacts immediately to the response must never observe a report whose
   ticket bookkeeping hasn't landed yet):
   - **success / nonzero-exit / empty-output** — the run happened (codex was
     invoked and produced *some* captured output, even a transport-class
     failure) — `runtime.engineResult(id, { report, run_log })` binds the
     engine's own verbatim report text and per-call run directory onto the
     `engine_pass` marker. The ticket **stays `LAUNCHED`** — this is
     additive bookkeeping, never a transition of its own.
   - **cancelled / backstop / spawn-never-happened** (runner file missing,
     `spawn()` threw, the OS-level `'error'` event, or the client cancelled
     / the kill-backstop fired before a result existed) —
     `runtime.denied(id, 'engine-'+branch, reason)` only; no report is
     bound, and the ticket is left exactly where it was for its own TTL to
     expire, or for the launcher's SubagentStop below to still resolve it.
   - Every call is best-effort and idempotent (`ticketBinding._bound` guards
     Node's `'close'`-after-`'error'` double-fire for a spawn failure): a
     thrown `TicketTransitionError`/`TicketStoreError` here is caught,
     logged to the server's stderr, and never allowed to affect the MCP
     response already built.
5. **Agent SubagentStop** — the launcher subagent finishes; the gate resolves
   the ticket `LAUNCHED -> RESOLVED`, binding `last_assistant_message` /
   `agent_transcript_path`, **exactly like any other Agent-tool launcher**.
   This is the **only** place `RESOLVED` happens — the engine server never
   resolves a ticket itself, whatever `engineResult()`/`denied()` recorded in
   step 4 is additional evidence bound alongside that same resolution, not a
   substitute for it.

Proven end to end (no ticket -> `TICKET_REQUIRED`, zero invocations; a valid
`LAUNCHED` ticket -> `enginePass()` recorded, ticket stays `LAUNCHED`, a
second call -> `TICKET_REPLAY`; role/vendor/phase mismatches -> zero
invocations) by `tests/mcp-lane.test.js` §10 against a stub `CODEX_BIN`.

### `STORE_UNAVAILABLE` / `init-store` (fix round item 9)

The runtime never auto-creates a missing ticket store, at any entry point
(`dispatch()`, `gate()`, `requireTicket()`/`ticketFor()`) — a missing or
unreadable store is a typed `STORE_UNAVAILABLE` instead. `bridge/cli.js
init-store` (equivalently `createRuntime({ projectDir }).initStore()`) is
the ONLY lawful way to create one, and it is idempotent: a store that
already exists is left byte-untouched. `install.js --roster new` calls this
exact code path against the just-installed copy, **only when no store exists
yet**, and records `installedStore: true` in the manifest
(`tests/install.test.js` §2 pins the census + the idempotent re-run; §3 pins
that a legacy flip — and a flip back to new — leaves the store
byte-identical; `--uninstall` removes it when `installedStore` is set, or
unconditionally under the untracked-ledger fallback, same rationale as the
untracked `bridge/` removal beside it).

### Launcher selection: the SERVED casting decides, not a fixed name

`subagentTypeFor(roleName, order, casting)` (`runtime.js`) reads the vendor
`dispatch()`'s own router actually served for this ticket — never a
role-name-to-file table blind to which vendor won:

- **Builder** — OpenAI-served (Luna preferredBounded, Terra mirror/dense,
  Sol override) routes to `roster/builder-openai.md` (the codex launcher,
  added this fix round); Anthropic-served (Sonnet primary/dense, Opus
  deepPrimary) routes to the in-harness `roster/builder.md`.
- **Test Designer** — keyed by `order.implementation_author_family` (the
  IMPLEMENTATION's author family, cast-opposite by construction — a
  different axis from the Test Designer ticket's own served vendor):
  `test-designer-vs-anthropic` / `test-designer-vs-openai`.
- **Reviewer** — keyed by the served review casting's own vendor:
  `reviewer-anthropic` / `reviewer-openai`.
- **Architect** — `roster/architect.md` is the OpenAI (Sol) launcher only;
  an Anthropic-served Architect ticket has no installed launcher and throws
  typed `NO_LAUNCHER`.
- **Investigator / Data Engineer / Red Team / Sweeper** (in-harness only) —
  Anthropic-served routes to the lowercased-hyphenated file name; any other
  vendor throws typed `NO_LAUNCHER`.
- Every other role name (Conductor, Verifier, Quartermaster, any future role
  not yet enumerated) falls back to its own lowercased-hyphenated name —
  unenumerated is a configuration defect to fix, not a vendor mismatch to
  paper over.

`NO_LAUNCHER` surfaces from `dispatch()` as a typed outcome, not a crash or a
silently-wrong `subagent_type` — zero tickets are issued when the served
casting has no installed launcher to run it.

### `CONFIG_CHANGED` (fix round item 8)

Every ticket records the `config_hash` (castings + aliases + manifest bytes)
in force at the moment `dispatch()` issued it. That hash is re-checked at
**every** point a ticket is used to authorize work — the Agent PreToolUse
`consume()` AND the engine server's `requireTicket()`/`enginePass()` above —
against the runtime's own `configHash(projectDir)` computed fresh each time.
A mismatch means castings/aliases/the manifest changed (e.g. a `roster:new`
reinstall) since the ticket was issued: the ticket is `invalidate()`d and the
call refuses typed `CONFIG_CHANGED`, never runs against a configuration the
ticket was never actually authorized under.

### `ROUTING_LOG_UNAVAILABLE` (fix round item 10)

`routing.events.jsonl` (under the same `.claude/orchestra/tickets/`
directory as the store) is a MANDATORY, not best-effort, immutable record of
every `dispatch()` outcome — appended before any ticket is issued. If the
log path is unwritable, or has been replaced by a directory, the append
throws typed `ROUTING_LOG_UNAVAILABLE` and `dispatch()` returns that same
typed outcome having issued **nothing** — a routing decision is never made
without its own audit trail landing first.

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
