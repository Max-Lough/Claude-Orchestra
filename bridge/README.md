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
  `doctor()`, `close(ticketId)` (leg 5 — the two-stage close, below).
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

- Installed-acceptance and live-canary proof (legs 6 and 7) — this directory's
  own leg 4/4b/5 work is otherwise complete.

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

Nothing of leg 4 remains owed. Leg 5 (below) closed out closure itself: the
two-stage close, the structured `verdict-json` review artifact, and
verdict-audit construction. Legs 6/7 own installed-acceptance and live-canary
proof — the only things not here yet.

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
    `orchestra-review.js` (leg 5) prints its own `REVIEW RUN NONCE: <hex>` the
    same way, and dictates (never asks the engine to invent) the
    `served_model` it requires echoed into the mandatory trailing
    `verdict-json` block — Codex CLI's `--json` stream carries no
    server-confirmed model field, so the dictated value is `CONFIG.model`
    when the caller named one, else the same `'UNKNOWN'` sentinel
    `bridge/telemetry.js` uses for "genuinely not exposed". A missing nonce
    still falls back to a synthesized one so the ticket is bound either way.
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

## Closure (leg 5)

`close(ticketId)` dispatches on the ticket's `kind` (`bridge/close.js`); every
outcome that is not a genuine close is `{ ok:false, outcome:'NOT_CLOSED',
reason }` — a lawful refusal is never an exception (only a caller error, e.g.
an unknown ticket id, throws). Reachable via `runtime.close(ticketId)`,
`node bridge/cli.js close <ticket-id>`, and the `orchestra_close` MCP tool
(`packs/codex/hooks/orchestra-engine-mcp.js`, same verbatim-result shape as
`orchestra_dispatch`).

**Close #1** — a RESOLVED `implementation` ticket (its `q0_ticket`, if any,
must be RESOLVED too): validates the bound executor report (never a
caller-supplied one — always `resolved.last_assistant_message`, the report the
host bound at `SubagentStop`, per `registry/schemas/report.schema.json`),
refusing on a non-`DONE`/`PARTIAL` status or no commit named; runs
`verifier.runVerification` with `manifestRef` pinned to the commit's own
parent (**outside** the audited commit — ruling 1a, never the audited tree
itself), persisting the artifact under
`.claude/orchestra/ledger/<ticket>/verifier.json`; on any outcome but `PASS`,
`NOT_CLOSED` with the failing checks named and **no reviewer ticket issued**.
On `PASS`, computes the reviewer via `router.reviewer()` against a fresh
Quartermaster snapshot and issues a `kind:'reviewer'` ticket in the computed
opposite family — a `closes:false` reviewer is `NOT_CLOSED: review
unavailable (<reason>)`, never guessed around.

**The structured verdict artifact** — `packs/codex/hooks/orchestra-review.js`
and both Reviewer role files (`roster/reviewer-anthropic.md`,
`roster/reviewer-openai.md`) require a mandatory trailing fenced
` ```verdict-json ` block, additive to the existing prose report
(`registry/schemas/verdict.schema.json`). Parsing is strict: exactly one
block, valid JSON, schema-valid — anything else is `MALFORMED` and the ticket
stays open. `run_nonce` is the codex lane's own per-run token (printed on the
runner's own `REVIEW RUN NONCE:` header line, on a channel the engine cannot
write, and cross-checked against the block's echoed value by close #2) or
`null` on the Anthropic lane, which has none to supply. `served_model` is
likewise dictated by the runner rather than left to the engine to invent —
see `dictatedServedModel()` in `orchestra-review.js`. `review.cross_family` is
always `null` from the reviewer; only the dispatcher computes it.

**Close #2** — a RESOLVED `reviewer` ticket: parses the verdict block; computes
`cross_family` from the two tickets' own `author_family` fields (never from
the verdict text); re-runs every self-reported citation through
`verifier.citationReplay` against the implementation commit (never trusting
the block's own MATCH/MISMATCH); validates the resulting `verdict-audit`
(`registry/schemas/verdict-audit.schema.json`) — a schema failure is
`NOT_CLOSED: unauditable`. `CLOSED` only when the verdict is `APPROVE`,
`cross_family` is true, every citation replay is MATCH (or the mismatch is
explained by a `reproduced:true` finding), and no CRITICAL/MAJOR finding
exists; `REVISE`/`REJECT`, same-family, or a malformed/unauditable verdict are
all `NOT_CLOSED` with the reason named. `'CLOSED'` as a close code is written
nowhere in the tree but `bridge/close.js` (grep-pinned by
`tests/bridge-close.test.js`).

**Telemetry** (`bridge/telemetry.js`) — two schema-validated writers, called
only after the actual result they describe has been captured, never
speculatively: `writeCastingRecord()` (one row per ticket — implementation and
reviewer — `served_model:'UNKNOWN'` forces `served_model_mismatch:null`, never
a fabricated `false`) and `writeVerdictAudit()` (the audit row above). Both
write atomically (`.tmp-<pid>-<ts>-<rand>` then rename) to
`.claude/orchestra/ledger/<ticket>/`, and both throw a typed
`TELEMETRY_SCHEMA_INVALID`/`TELEMETRY_INVALID` rather than ever writing a
partial or non-conformant record.

See `tests/bridge-close.test.js` for every branch pinned end to end, and
`tests/review-lane.test.js` §2b for the codex lane's `verdict-json` emission
proven against a stub engine.

### Two riders folded into this leg

- `router/tickets.js` (leg-2 review #6): the anomaly-sidecar drain never
  drops a record it cannot parse — an unparseable line is written back
  (same write-all discipline as the rest of the drain) instead of being
  truncated away, alongside a `lock_anomaly` event with `data.torn:true`
  naming it; the constructor's `_fs` test hooks (including `afterRename`) are
  honoured only under `ORCHESTRA_TICKETS_TEST_HOOKS=1`, otherwise refused with
  a typed error. See `tests/tickets.test.js`.
- `bridge/manifest.js` (leg-3 fix round 3): `readTrustedManifest()`'s pin
  rules tightened to mirror the guard's round-3 rules exactly — a roster:new
  fingerprint (the two file markers, any of the eleven role files, or a
  manifest carrying `projectId`/`installedFiles`/`installedHooks`/
  `rosterGeneration`) with no resolvable pin is `'installed roster:new
  project without a pin'`, never `'unpinned'`; the pin object itself is
  validated against a strict schema (anything short of it is treated as no
  pin found); a third `git-<sha256(root commit)>.json` lookup key is tried
  after path and id; and a pin found by id or git-root naming a different
  `projectDir` still enforces roster (hash-gated, as before) but now also
  sets `moved:true` on the state, exposed in `doctor()`. See
  `tests/bridge.test.js`.

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
**Pin file, by git history root** (leg 5 Rider 2, item iii — tried only when
neither of the above resolves): `<PIN_DIR>/git-<sha256(first line of
`git rev-list --max-parents=0 HEAD` run inside the project), lowercase
hex>.json`. `PIN_DIR = process.env.ORCHESTRA_PIN_DIR ||
~/.claude/orchestra/pins`, honoured only if that directory actually exists —
an env var pointing at a nonexistent directory reads as "no pin dir", same as
none configured.
**Pin content**: `{ projectDir, manifestSha256, roster, rosterGeneration,
seats, writtenAt, by }` — `manifestSha256` is the sha256 of the manifest
FILE'S BYTES at the moment the pin was written. As of leg 5 Rider 2 this
shape is validated STRICTLY (`isValidPinShape()`): `projectDir` a string,
`manifestSha256` exactly 64 lowercase hex characters (case-sensitive),
`roster` exactly `'new'`/`'legacy'`, `rosterGeneration` a non-negative
integer, `writtenAt` a valid date, `by` a string — anything short of the
full shape is an INVALID pin, treated exactly like a corrupt one (below),
never partially trusted via defaulted/coerced fields. Writing the pin is
`install.js`'s job (`writePin()`/`writeManifestAndPin()`); this module only
verifies it.

**Trust rules** (`{ manifest, trusted, roster, rosterGeneration, seats,
reason, moved }`) — leg 5 Rider 2 ("round-3") tightened these; the trigger
for "this project claims roster:new" is no longer the manifest's own
(contested) `roster` field alone but a **fingerprint**
(`hasRosterNewFingerprint()`): `.claude/orchestra/` populated with anything
beyond the runtime's own lazily-created `tickets/` subdirectory,
`.claude/ORCHESTRA-CONDUCTOR.md`, any of the eleven roster role files under
`.claude/agents/`, `manifest.roster === 'new'`, or a manifest carrying any of
`projectId` / `installedFiles` / `installedHooks` / `rosterGeneration` —
deliberately **excluding** `installedPermissions`/`installedDeny`, which a
plain legacy install also writes:

| Pin | Fingerprint / Manifest | Result |
| --- | --- | --- |
| absent (no path-, id-, or git-root-keyed file, or `ORCHESTRA_PIN_DIR` names a nonexistent directory) | fingerprinted (see above) | **UNTRUSTED-NEW, fail closed**: `trusted:false`, `roster:'new'` (never a silent legacy downgrade), `reason:'installed roster:new project without a pin'` — **never** `'unpinned'`. |
| absent | not fingerprinted | `trusted:false`, `roster:'legacy'`, `reason:'unpinned'`. The gate is **inert** — a default-on-request posture, not an enforcement boundary. |
| present, well-formed (strict schema), hash matches (path-keyed pin's own `projectDir` agrees with the resolved path, or found by the id/git-root key) | — | `trusted:true`; `roster`/`rosterGeneration`/`seats` come from the **manifest** (fall back to the pin's own copy if the manifest omits them); `roster` always equals the pin's (by construction, once hash-matched). Found by the id or git-root key with a differing `projectDir`: `moved:true`, `reason:'project moved since pinning'` (informational — trust is unaffected). |
| present, well-formed, manifest missing/unreadable/hash mismatch | — | **UNTRUSTED**: `trusted:false`, `roster`/`rosterGeneration`/`seats` come from the **PIN** instead (the manifest is not trusted enough to read even its own `roster` field from), `reason:'manifest untrusted (hash mismatch)'` (with `' [project moved since pinning]'` and `moved:true` if also found by the id/git-root key with a differing `projectDir`). |
| present but corrupt/unparseable, fails the strict pin schema, or a forged path-keyed pin (its own `projectDir` disagrees with the resolved path) | — | **UNTRUSTED-NEW**: `trusted:false`, `roster` forced to `'new'` (a pin file's mere existence signals this project was pinned at some point, so failing toward enforcement is the safe direction), `reason:'corrupt pin'` or `reason:'pin projectDir does not match this project'` — **never** `'unpinned'`. |

`moved` is `false` on every other branch. Every reason string above stays
exactly as written for every fingerprint-triggered outcome — an
`installedPermissions`/`installedDeny`-only manifest is NOT fingerprinted and
falls to the `'unpinned'`/inert row instead. See `tests/bridge.test.js`
§§21–27 for every branch pinned end to end.

When the resolved `roster` is `'new'` and the manifest is not `trusted`,
`runtime.js` sets an internal `failClosed` flag and every decision fails
closed rather than running normal ticket logic against data that could have
been tampered with since it was pinned: `dispatch()` returns typed
`MANIFEST_UNTRUSTED`; `gate()` denies every `PreToolUse(Agent)`, blocks every
`Stop`, and reports `Post`/`SubagentStop` inert (there is no ticket state
left to safely mutate); `requireTicket()`/`ticketFor()` throw
`TICKET_REQUIRED` naming the untrusted reason. `doctor()` reports pin status
under `.pin`: `{ trusted, reason, file, failClosed, moved }`. See
`tests/bridge.test.js` §§13–27 for every branch pinned end to end (including
a legitimate re-pin restoring normal operation).

**Known divergence (flagged, not fixed here):** `hooks/orchestra-guard.js`
(forbidden to this leg's FILES list) still implements the PRE-round-3
`loadPin()`/`loadPolicy()` rules — the old fingerprint-free "manifest claims
new" trigger, the old lax pin-field coercion, and no git-root lookup key.
This module's own long-standing invariant ("the two independent
implementations must never diverge — a request one denies that the other
would honour reopens the tampering hole the pin exists to close") is
presently **violated** until a follow-on leg realigns the guard to these
round-3 rules. `gate()`'s own `PreToolUse(Agent)` path (this module) already
enforces the tightened rules regardless of what the guard's independent
copy decides; the guard is defense-in-depth on top of it, not the sole
enforcement point — but the drift itself is real and owed.
