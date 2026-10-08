# WO-0 probe results

Date: 2026-10-08 · Claude Code: 2.1.294 · OS: Windows 11 Home 10.0.26200 · Main model: Sonnet (`claude-sonnet-5-5`), via `claude -p` and in the owner's interactive re-runs · API: Anthropic first-party (every `modelUsage` entry reports `"provider":"firstParty"`)

## Method

Every probe first ran **headless**: each probe was a nested
`claude -p "<prompt>" --model sonnet --output-format json` run from `C:\scratch\lead-probes`, with
`--allowedTools Agent SendMessage TaskStop CronCreate CronDelete CronList "Bash(node:*)"
mcp__orchestra-engine__orchestra_doctor` (no bypass mode). Multi-turn probes (2b, 3d) used
`--resume <session_id>`. `.claude\probe-log.jsonl` was cleared between probes. About 15 nested
`claude -p` runs in total.

- Headless `-p` skipped the trust dialog, and the project hooks still ran: probe 1 wrote
  `probe-log.jsonl`. Claude Code printed `Ignoring 4 permissions.allow entries from
  .claude/settings.json: this workspace has not been trusted`, so only the `permissions.allow`
  entries were dropped, not the hooks.
- **Interactive re-runs (owner, 2026-10-08, Sonnet main session in `C:scratchlead-probes`):**
  3a, 3b, 3c, 4a, 4b and 7a, the rows that headless could not measure faithfully. The rows carry
  both results where they differ. The interactive result is the one the plan uses, because leads
  are interactive-only. 2a/2b/2c and 3d were not re-run interactively.
- Environmental noise: the nested sessions loaded my user-level claude.ai MCP connectors, so many
  worker replies mentioned an "MCP Server Instructions" block about creating Claude Docs
  documents. They ignored it and nothing was created. It does not affect any row.
- Headless caveat that matters for several rows: when the `Agent` call omitted `run_in_background`
  (3a, 3b first run, 6), the harness reported `started_in_background` for those children
  (`"requested":{"unset":2}` → `"started_in_background":2`). When the call set
  `run_in_background: false` explicitly, the child ran in the foreground. The interactive re-runs
  (3a, 3c) showed that an unset flag backgrounds there too, for the main session's spawns as well
  as a lead's.

## Table

| Probe | Observed (evidence: log line or quote) | As the plan assumes? | Design change it forces |
|---|---|---|---|
| 1a agent_type = name | Yes. `start-any` lines carry `probe-lead`, `probe-worker`; e.g. `17:24:29.206 start-any SubagentStart a230653063 probe-lead`. Also `probe-turns`, `probe-mcp`, `probe-haiku-pinned`, `probe-opus-max` in later probes. | Yes | None |
| 1b SubagentStart matcher targets one type | Yes. `start-matched-probe-lead` appears for `probe-lead` (`a230653063`) and for none of the 3 `probe-worker` starts (`ad50a65aea`, `a179b7486b`, `a9560348e4`), which only have `start-any`. | Yes | None; WO-3 can use a `SubagentStart` matcher, and still filtering in-script is harmless |
| 1c caller identity on Agent calls | Yes. `17:24:32.184 PreToolUse a230653063 probe-lead Agent probe-worker`. A main-session Agent call has `agent_id`/`agent_type` null (`17:24:29.034 PreToolUse - - Agent probe-lead`), so the hook can tell main from subagent callers. | Yes | None |
| 1d settings hook blocks a subagent spawn | Yes. `17:25:11.992 PreToolUse a230653063 probe-lead Agent probe-haiku-pinned` was denied and no `SubagentStart` followed. Subagent stats: `"spawned":4`, `by_type {"probe-lead":1,"probe-worker":3}`. The main session reported: `PreToolUse:Agent hook error: probe-deny: probe-lead may not spawn probe-haiku-pinned. Report this denial verbatim.` (the lead relays it with a `PreToolUse:Agent hook error:` prefix; the reason text is intact). | Yes | None. Guard rules keyed on `agent_type` and `Agent` are viable for WO-2 |
| 1e parallel children have distinct agent_ids | Yes. Two `Bash` lines `17:25:04.378 ... a179b7486b probe-worker` and `17:25:05.399 ... a9560348e4 probe-worker`. | Yes | None |
| 1f extra input fields | No parent-agent id on any event. Extra top-level keys beyond the documented set: `PreToolUse` carries `cwd, effort, hook_event_name, permission_mode, prompt_id, session_id, tool_input, tool_name, tool_use_id, transcript_path` (+ `agent_id`, `agent_type` in a subagent). `SubagentStart` carries `agent_id, agent_type, cwd, hook_event_name, prompt_id, session_id, transcript_path`. `SubagentStop` carries `agent_id, agent_transcript_path, agent_type, background_tasks, cwd, effort, hook_event_name, last_assistant_message, permission_mode, prompt_id, session_crons, session_id, stop_hook_active, transcript_path`. Notably `effort` (hook input, per turn), `background_tasks` and `session_crons` on stop. | Partly new | No parent id means a lead's children cannot be attributed to a lead except by spawn-order/`prompt_id`; WO-3 budget tracking must key on the lead's own `agent_id` (calls by the lead) rather than on a children-to-lead link. Possible bonus: `background_tasks` on `SubagentStop` could expose leftover children (not examined) |
| 2a maxTurns stop point and partial marker | `probe-turns` (`maxTurns: 3`) ran **3** workers (steps 1-3) then stopped; steps 4-5 never started. Text the main session received: `NOTE: this agent stopped at its 3-turn limit before finishing. It was still calling tools and had produced no report. Send the agent a message (SendMessage) to let it continue from where it stopped.` with `usage ... tool_uses: 3`, `canContinueAgent: true`. So one spawn = one turn, and the stop is explicitly marked partial. **No `SubagentStop` fired for `probe-turns`** on this stop (the log ends at the third worker's stop). | Mostly | A lead with `maxTurns: N` gets N tool-calling turns and **no final report turn** if it is still calling tools. Set `maxTurns` ≥ planned spawns + 1, and have the Director treat the `stopped at its N-turn limit` note as a partial status. The budget clock cannot rely on `SubagentStop` to see a maxTurns stop |
| 2b resume resets maxTurns | Yes. After `SendMessage` to the same `probe-turns` (`a4c7f6bffb`), it ran **2 more** workers (steps 4-5) and then returned a full report; a `SubagentStart` fired for `a4c7f6bffb` at `17:26:27.836` and a normal `SubagentStop` at `17:26:40.647`. A 3-turn cap that had not reset would have stopped it before spawning. Fits "fresh budget of 3 per run, report turn included". | Yes (resume gets a fresh count) | None; confirms a resume restarts the budget, which WO-3's clock reset relies on |
| 2c long child counts as one turn | Yes. With a 90 s child first, the new `probe-turns` still ran 3 workers (`slow` 17:27:01 to 17:28:35, then two fast ones) and hit the same 3-turn stop. Wall-clock time did not change the count. | Yes | None. `maxTurns` is not a time bound; WO-3 needs its separate clock for time |
| 3a background completion wakes the session | **Yes, confirmed interactively 2026-10-08.** With the main session idle, it relayed the lead's report unprompted (`Agent "Probe lead spawns two workers" finished · 1m 46s`). Log: the lead spawned both workers without setting `run_in_background` (logged null on both `PreToolUse Agent` lines), so they ran in the background, and the lead stopped 5 s in (`17:51:20.145` start, `17:51:25.597` stop). Each worker's completion then **re-woke the lead with a fresh `SubagentStart`, both tags** (`17:52:58.425`, `17:53:00.401`, `17:53:03.631`; four start/stop cycles for one lead in total) before its final handback. Headless run (earlier): the lead also stopped after 6 s, and `-p` stayed alive ~112 s. | Yes; the lead behaviour is new | An omitted `run_in_background` also defaults to background interactively, so the 3b lead-law fix (explicit `false`) applies. A lead is re-woken per child completion and each wake fires `SubagentStart`, so a WO-3 budget that resets on `SubagentStart` resets on every child completion. Key the reset on main-session resumes only, or count wakes. |
| 3b TaskStop on a lead stops its children | **Interactive (2026-10-08): yes, children were killed even though they were backgrounded.** The lead dispatched both workers with `run_in_background` unset (logged null), so they ran in the background and the lead ended its turn at `17:58:13.749`. Workers ran `Bash` at `17:58:12.943`/`17:58:13.023`, so their timers would end around `17:59:43`. The human typed the stop; `TaskStop` was called at `17:58:57.913`. The user's process check about 10 s later still listed two `setTimeout` node processes; a check about 3 s after that listed none, roughly 30 s before the timers could finish on their own. Nothing was logged after the `TaskStop`: no worker `SubagentHandback` or `SubagentStop`, and no lead re-wake. So the workers were killed, about 10 to 13 s after the stop. **Headless variant (earlier), differs:** Two runs, asked the session to `TaskStop` the lead ~30 s in. (i) Children started with `run_in_background` unset (started in background): lead killed (`"killed":{"parent":1}`), **children survived and ran the full 90 s** (`17:32:57.847` and `17:32:58.656` stops, ~66 s after the `TaskStop` at `17:31:51.144`). The lead's own `SubagentStop` never fired. (ii) Children explicitly `run_in_background: false` (foreground, lead blocked): `TaskStop` at `17:40:53.753` and the `setTimeout` node processes (pids 37444, 4216) were gone at the next poll (10:40:57); stats `"killed":{"parent":1,"user":2}`; no `SubagentStop` for lead or workers. | Interactively yes, with a 10 to 13 s kill lag; headless orphans background children | Weaker than the headless run implied: interactively, `TaskStop` does reach backgrounded children. Still have leads set `run_in_background: false` explicitly. It is cheap, it closes the headless orphan path, and it avoids the per-child lead re-wakes seen in 3a. It is defence in depth rather than a correctness fix for interactive leads. Neither kill path emits `SubagentStop`, so cleanup and accounting cannot hang off it. |
| 3c lead resumes its own child; SubagentStart on resume | **Interactive re-check (2026-10-08): the second result did reach the lead, through a re-wake rather than a synchronous return.** The lead dispatched the worker with `run_in_background` unset (logged null), so it backgrounded, and the lead ended its turn (`18:41:35.915`). The worker's completion re-woke the lead (`18:41:37.234`). The lead called `SendMessage` (`18:41:39.924`). The worker resumed with a second `SubagentStart` for the same id (`18:41:40.306 start-any a0916f4bbc probe-worker`), ran, and handed back (`18:41:43.284`). The lead ended its turn (`18:41:47.434`) and was re-woken (`18:41:47.624`). It then reported both results, `first` and `second`. Six `SubagentStart` lines were logged for the lead across the run. Note that the main session's spawn of the lead also left `run_in_background` unset (null), so the lead itself ran in the background despite the prompt saying "in the foreground". **Headless (earlier), differs:** Resume works and fires `SubagentStart` for the worker's id (`17:33:33.224 start-any a458eacf4f probe-worker`, the second start for that id). **But the reply is asynchronous.** `SendMessage` returned `{"success":true,"message":"Resuming agent a458eac",...}` immediately; the lead then ended its turn and reported `The output of the second command has not come back yet, so I have no result for it` (worker stopped 0.6 s before the lead did, and the result was never delivered to the lead). In a second run where the lead was told to keep taking turns, the result arrived as a task-notification only after the lead's next turn (`17:34:18.378 Read`, then `second` delivered; lead reported "delayed by about one turn"). Run headless. | Yes interactively, by re-wake; no headless | Weaker than the headless run implied: interactively, a lead that ends its turn after `SendMessage` is re-woken with the reply. Keep the lead-law sentence (do not report until every child reply has arrived) because it is cheap and covers headless. Each re-wake is a `SubagentStart` (see 3a), so it also counts toward the lead's turns and any `SubagentStart`-keyed budget. |
| 3d main-session resume of a lead fires SubagentStart | Yes. After `--resume` and `SendMessage` to the lead: `17:34:37.340 start-matched-probe-lead SubagentStart ae7065066a probe-lead` and `start-any` for the same id, then `17:34:38.679 stop`. The lead answered `7` with no tool calls. | Yes | None |
| 4a cron fires while waiting on a background lead | **Yes, confirmed interactively 2026-10-08.** The cron was set for every 2 minutes (`*/2`, job c42c48e4). The background lead ran from `18:04:18.686` to `18:09:16.131`, re-woken per worker as in 3a. Check-in turns from the main session (null `agent_id`, `PowerShell` calls) fired at `18:06:48`/`18:06:51` and `18:08:48`, both while the lead and its workers were live, and again at `18:10:49` after it finished. Each fired about 48 s after its scheduled minute. Headless (earlier): no check-in fired, because `-p` is not an idle interactive session. | Yes | None. Check-ins can serve as the Director's heartbeat while it waits on a background lead. Expect each one up to about a minute late. |
| 4b cron that came due while busy runs after the turn | **Yes, confirmed interactively 2026-10-08.** While idle, the check-ins held a steady cadence (`18:12:51`, then `18:14:47` through `18:32:48`, each about 48 s past its scheduled minute). A main-session foreground `Bash` turn ran from `18:33:34.809` for about 155 s, spanning the `~18:34:48` slot. **Exactly one** check-in ran as soon as the turn ended (`18:36:09.395`). No separate one followed at `~18:36:48`, and the cadence resumed at `18:38:48.754`. The missed fire was deferred, not dropped and not duplicated. | Yes | None |
| 5a MCP tool at depth 2 | Pass. `probe-mcp` under `probe-lead` (depth 2) called the tool: `17:42:37.085 PreToolUse ab6c1c78f4 probe-mcp mcp__orchestra-engine__orchestra_doctor`; the lead's report contained `DOCTOR EXIT CODE: 0` and the codex 0.159.3 path. Note the agent's `tools:` list named the MCP tool explicitly. | Yes | None; `reviewer-codex` under a lead can reach the engine MCP, provided its `tools:` frontmatter names the MCP tool |
| 6a pinned claude-haiku-5-5 served as | `claude-haiku-5-5` (`probe-models.js` on `agent-abb8e2638d3ad6e22.jsonl`). `modelUsage` also lists `claude-haiku-5-5`. | Yes | None |
| 6b haiku alias served as | `claude-haiku-5-5` (`probe-worker`, `agent-ab48e8b6df15425e8.jsonl`), on first-party Anthropic API. Matches the plan's expectation for the Anthropic API only. | Yes (Anthropic API) | None on this API; the plan's note about Haiku 4.5 on Bedrock/Vertex/Foundry stays untested here |
| 7a probe-opus-max registers (effort: max accepted) | **Yes, confirmed interactively 2026-10-08.** `/agents` was removed in 2.1.294 ("The /agents wizard has been removed"), so the check asked the session to list its spawnable subagent_types; `probe-opus-max` was listed. Headless: it spawned: `17:43:19.757 start-any SubagentStart ae36753f64 probe-opus-max`, ran `Bash`, stopped normally. No warning or error about `effort: max` on stderr (only the unrelated trust notice). The subagent transcript records `"effort":"max","perTurnEffort":"max"` on its turns (main session: `"effort":"medium"`). | Yes | None |
| 7b pinned claude-opus-5-5 served as | `claude-opus-5-5` (`probe-models.js` on `agent-ae36753f648f4dfe7.jsonl`; `modelUsage` lists `claude-opus-5-5`). | Yes | None |

## Contradictions and findings that force changes

1. **3c: `SendMessage` to a child is asynchronous.** Headless, the lead reported before the reply
   arrived and lost it. Interactively, the lead ended its turn and was re-woken with the reply, so it
   reported both results. Lead law, kept as a cheap safeguard: do not report until every child reply has
   arrived. Count the receive turn in `maxTurns`.
2. **3b: whether `TaskStop` reaches a lead's children.** Interactively, it killed backgrounded children,
   about 10 to 13 s after the stop. Headless, backgrounded children survived as orphans, and only
   `run_in_background: false` children died. Keep requiring `run_in_background: false` on lead
   `Agent` calls (lead law, and optionally the guard) as defence in depth. It is no longer a
   correctness fix for interactive leads.
3. **No `SubagentStop` on `maxTurns` stop (2a) or `TaskStop` kill (3b).** Anything in WO-3 that
   assumes a `SubagentStop` marks the end of a lead's work will miss both. The Director must read
   the `stopped at its N-turn limit` note and the kill status instead.
4. **2a: `maxTurns` leaves no report turn.** The cap is on turns, and a lead still tool-calling
   at the cap returns no report. Set `maxTurns` to spawns planned + 1 (plus any resume-receive
   turns, see 1).
5. **1f: no parent-agent id** on any hook event. Children cannot be attributed to a lead via the
   hook input; budget accounting must key on the lead's own `agent_id`.
6. **3a/3c: an unset `run_in_background` backgrounds, and each finished child re-wakes its lead
   with a fresh `SubagentStart`.** This held for the main session's spawn too: a lead asked for
   "in the foreground" still ran in the background. One lead logged four to six `SubagentStart`
   lines in a single run. A WO-3 budget that resets on `SubagentStart` therefore resets on every child
   completion, not only on a main-session resume (3d). Distinguish the two cases, or count wakes
   instead.

Everything else (1a-1e, 2b, 2c, 3d, 4a, 4b, 5a, 6a, 6b, 7a, 7b) matched the plan. 3a matched, apart from the re-wake behaviour in item 6.

## Still needs an interactive run

- None. 3c was re-checked interactively and passes by re-wake; the unset-`run_in_background` default backgrounds, for both the main session and leads (3a, 3c).

## Cleanup

No `setTimeout` node processes remained (checked by command line after the last probe). The cron
task created in the headless probe 4 was deleted: `CronDelete` ran and a resumed `CronList` returned
`No scheduled jobs.` The interactive cron job (c42c48e4) was deleted with `CronDelete` at
`18:40:38`, and no check-in fired after it. The plan, `plans/team-leads-trial.md`, is amended for
these results (its "WO-0 amendments" section).
