# WO-14b leg 1 — host lifecycle proof (2026-09-01)

**STATUS: DONE — the host exposes enough lifecycle state to enforce spawn, result
provenance, and open-ticket stop. The tranche continues to leg 2.**

Order: `roster/wo14b-activation-bridge-order.md` leg 1 ("no repository writes" — this
record and its appendix are the only files added; no code under the tree changed).
Host: Claude Code 2.1.252 on Windows 11, headless `claude -p`, main model haiku
(enforcement is host-side, so the main model is irrelevant to the proof), disposable
target `<scratchpad>/leg1/target` with project-level `.claude/settings.json` hooks,
one subagent definition `probe-agent` (haiku, `tools: Read`). Two runs; every hook
event's stdin captured verbatim by a logger hook; a second, minimal gate hook enforced
tickets in run 2. Payloads, gate log, ticket store and fixture files are in
`roster/wo14b-leg1-lifecycle-proof-appendix.md`.

## What was asked, and what the host showed

| Requirement (oracle leg 1) | Result | Evidence |
|---|---|---|
| Actual payload + ordering for Agent `PreToolUse` | `tool_name:"Agent"`, `tool_input:{description,prompt,subagent_type}`, `tool_use_id`, `session_id`, `prompt_id`, `permission_mode`, `transcript_path`, `cwd`. Fires before spawn. | run 1 event 3; run 2 event 3 |
| A random ticket passed unchanged through the Agent invocation | `PreToolUse.tool_input.prompt === "TICKET=tkt-51abec4357c1447d"` byte-identical to the issued value; same in run 2. | run 1 event 3; ticket.txt |
| Agent result capture, bound to the invocation | `PostToolUse(Agent)` fires immediately with the **same `tool_use_id`** and `tool_response:{isAsync:true,status:"async_launched",agentId,resolvedModel,prompt,outputFile}`. Then `SubagentStop` fires with `agent_id` (== that `agentId`), `agent_type`, `agent_transcript_path`, and **`last_assistant_message`** — the subagent's final text, verbatim. Chain: ticket → `tool_use_id` → `agentId` → result. | run 1 events 7, 12; run 2 gate.log lines 1, 2, 4 |
| Served model available to the runtime (casting-record `served_model`) | `PostToolUse.tool_response.resolvedModel = "claude-haiku-4-5-20251001"` — a host fact, not a model assertion. | run 1 event 7; tickets.json after run 2 |
| Session stop with open tickets | `Stop` carries `stop_hook_active`, `last_assistant_message`, and **`background_tasks`** (id, type, status, agent_type of every running subagent). A `{decision:"block", reason}` on `Stop` held the session; the next `Stop` arrived with `stop_hook_active:true` after `SubagentStop` had resolved the ticket. | run 2 gate.log lines 3, 5; events 7, 10 |
| Spawn enforcement: unticketed / replayed / wrong-role | All three **denied at the host** via `PreToolUse` `permissionDecision:"deny"`; the reason reached the model, which reported it (`L2/L3/L4: DENIED: …`). No `SubagentStart`, no `agentId`, no subagent transcript for any denied call. | run 2 gate.log lines 6–8; final answer |
| Subagent tool calls distinguishable from main-session calls | A subagent's own `PreToolUse`/`PostToolUse` carry `agent_id` and `agent_type`; main-session calls carry neither. | run 1 events 10–11 |
| Additional events available | `SubagentStart` (fires between `PreToolUse` and `PostToolUse` of the Agent call), `PostToolUseFailure`, `PermissionDenied`, `SessionStart`/`SessionEnd`, `UserPromptSubmit` (also fires for the async completion notification). | run 2 event sequence |

Docs corroboration (claude-code-guide agent, 2026-09-01): the docs confirm
`permissionDecision` allow/deny/ask/defer and `updatedInput` on `PreToolUse`, `Stop`
blocking with `stop_hook_active` and an 8-consecutive-block cap
(`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`), `mcp__<server>__<tool>` matchers, hooks running in
`-p` mode, and subagent-frontmatter `hooks`; they are **silent** on the `SubagentStop`
payload, the Agent `tool_input` shape, `agent_id` on subagent tool calls, and
`tool_response` for Agent — which is exactly what this record measures.

## Design consequences carried into legs 2, 4 and 5

1. **The Agent tool is async by default.** `PostToolUse(Agent)` does not carry the
   result; it carries the binding key (`agentId`). The result arrives at
   `SubagentStop`. The ticket state machine therefore needs the states
   `OPEN → CONSUMED (PreToolUse) → LAUNCHED (PostToolUse, agentId + served_model bound)
   → RESOLVED (SubagentStop, last_assistant_message + agent_transcript_path bound)`,
   plus terminal typed outcomes. Leg 5's close #1 validates the bound report from
   `RESOLVED`, never from a model-pasted summary.
2. **`Stop` blocking is the open-ticket guard, and it must be bounded.** Block while any
   ticket is `CONSUMED`/`LAUNCHED` and `stop_hook_active` is false; the host caps
   consecutive blocks at 8. The block reason must tell the Conductor what is open.
3. **Nested spawns are visible and must be gated.** A subagent's Agent call carries
   `agent_id`; under `roster:new` the gate denies any nested spawn whose parent ticket
   does not grant SPAWN (only Conductor-issued tickets do — Builder has no SPAWN).
4. **The deny reason is the user-facing contract.** Denials surface to the model as the
   tool result; the reason string is what the Conductor acts on, so it must name the
   ticket, the role, and the lawful next step.
5. **The gate must fail closed by construction.** The probe gate denies on malformed
   input, unreadable store, and any internal error (`ticket-gate.js`); the legacy guard's
   fail-open windows do not carry over to the `roster:new` path.
6. **Raw engine tools are not covered by this gate** — `PreToolUse` matchers can target
   `mcp__orchestra-engine__orchestra_exec` etc., but per the oracle the engine server
   itself must reject unticketed calls (leg 4); the hook is defence in depth there.
7. **Transcripts are addressable evidence.** `agent_transcript_path` and the session
   `transcript_path` are host-owned paths; the ledger records them for audit replay.

## Verification

- Run 1: `claude -p … --model haiku --allowedTools Agent Read --output-format stream-json
  --max-turns 6` → exit 0; final text `MAIN-RESULT TICKET=tkt-51abec4357c1447d`; 15
  hook events captured; `SubagentStop.last_assistant_message ===
  "PROBE-AGENT-RESULT\nTICKET=tkt-51abec4357c1447d"`. Cost $0.036.
- Run 2 (gate armed; store seeded with one OPEN ticket for `probe-agent` and one OPEN
  ticket for `some-other-role`): exit 0; final text exactly
  `L1: RESULT: tkt-aa11bb22cc33dd44 / L2: DENIED: no ticket in prompt / L3: DENIED:
  ticket tkt-aa11bb22cc33dd44 is RESOLVED (one-use) / L4: DENIED: ticket
  tkt-9999999999999999 is for role some-other-role, not probe-agent`; gate.log shows
  allow → bind(agentId, served_model) → Stop BLOCKED (open ticket, bg=1) → SubagentStop
  RESOLVED → Stop allowed (`stop_hook_active:true`, open []) → three denies → Stop
  allowed. Store after run: the valid ticket `RESOLVED` with `tool_use_id`, `agent_id`,
  `served_model`, `result`, `agent_transcript_path`; the wrong-role ticket still `OPEN`
  (never consumed). Cost $0.048.
- `git status --short` on the repo → only this record and its appendix.

## Deviations

- The probe ran the main session on haiku to keep cost near zero; enforcement lives in
  the hook, not the model, and the oracle's requirement was host lifecycle state, which
  is model-independent. Leg 7's live canary runs the real castings.
- The probe gate allowed nested spawns from subagents (logged, not enforced) to keep
  the proof minimal; consequence 3 above carries the requirement into leg 4.

## Concerns

- `PostToolUse(Agent)` fires before the subagent runs, so any leg-4 logic that needs the
  result must key on `SubagentStop`, not `PostToolUse`. A `SubagentStop` that never
  arrives (killed subagent) leaves a `LAUNCHED` ticket; the state machine needs expiry
  and the `Stop` guard's block reason to surface it.
- `background_tasks` is the host's view of running subagents; the ticket store is the
  runtime's. Leg 6 should include a disagreement case (host says none running, store
  says LAUNCHED) → fail closed, ticket EXPIRED with reason.
