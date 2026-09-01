# bridge/ — WO-14b leg 4 activation runtime

One shared core (`runtime.js`) with thin adapters: the ticket-gate hook
(`hooks/ticket-gate.js`), a CLI twin (`cli.js`), and the engine server's
`orchestra_dispatch` / ticketed `orchestra_exec` / `orchestra_review` /
`orchestra_doctor` (`packs/codex/hooks/orchestra-engine-mcp.js`).

Installed by `install.js --roster new` as `.claude/orchestra/bridge/`
(copied verbatim from this directory), alongside the substrates it depends
on (`.claude/orchestra/{router,registry,verifier,quartermaster}/`).
`runtime.js` resolves those siblings relative to its own `__dirname`, so the
same file works unmodified from the source tree and from the installed copy.

## What lives here

- `runtime.js` — `createRuntime({ projectDir })`: `dispatch(request)`,
  `gate(event)`, `requireTicket({id, phase})` / `ticketFor(phase, opts)`,
  `generationCheck()`, `doctor()`. `close()` is a stub — leg 5's job — that
  always throws typed `NOT_IMPLEMENTED`.
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

## Ticket lifecycle this runtime enforces

`OPEN -> CONSUMED (PreToolUse) -> LAUNCHED (PostToolUse) -> RESOLVED
(SubagentStop)`, then `close()` (leg 5) to `CLOSED` or a disclosed
`NOT_CLOSED`; `EXPIRED`/`INVALIDATED` are the other two terminal states. See
`router/tickets.js` for the state machine itself — this runtime only calls
its exported operations, never reimplements them.
