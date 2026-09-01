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
  completion bookkeeping), `generationCheck()`, `doctor()`,
  `close(ticketId)` (leg 5 — the two-stage close, below). `launch(id,
  opts)` / `resolve(id, opts)` still exist as thin wrappers over
  `router/tickets.js` but the engine server no longer calls them directly —
  the Agent-tool gate's own PostToolUse/SubagentStop handling is what drives
  a codex-launcher ticket through `LAUNCHED`/`RESOLVED` now (see "Engine
  ticket lifecycle" below).
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
its exported operations, never reimplements them. An Investigator ticket
(class I0, or a merged recon class N0/N1/N2/M0) takes the recon close (PL-10):
`close()` reads its I0 `VERDICT:` line, writes the casting record, and CLOSES
it with `stage: RECON_CLOSED` — no Verifier, no reviewer, since read-only
research names no commit to certify.

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
     additive bookkeeping, never a transition of its own. `agent_id` is
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
     `report`/`last_assistant_message` is the exact text the tool call
     returns; `run_log`/`agent_transcript_path` is the MCP server's own
     per-call run directory (`.claude/scratch/mcp/<lane>-<pid>-<ts>-<n>/`) —
     neither runner exposes a persistent log path of its own in its report
     text.
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

`hooks/orchestra-guard.js` implements the identical round-3 rules
independently (it cannot `require()` a project file before it knows one
exists) — the fingerprint trigger, the strict pin schema, and the git-root
lookup key are all mirrored there too; the two implementations are pinned to
agree by `tests/guard.test.js` and `tests/bridge.test.js` alike (this
module's long-standing invariant: "the two independent implementations must
never diverge — a request one denies that the other would honour reopens the
tampering hole the pin exists to close").
