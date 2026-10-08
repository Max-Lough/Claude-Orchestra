# WO-0 probe kit: team-leads platform checks

This kit answers, in your own environment, the questions `plans/team-leads-trial.md` cannot settle
from the docs. Every build order (WO-1..WO-4) waits on its results.

Run it in an interactive Claude Code session on the machine you run the harness on. Record the
results in `plans/team-leads-probe-results.md` (template at the bottom). The whole run should take
about 30 minutes and cost a few dollars: Sonnet main session and probe lead, Haiku workers.

## What's here

| File | Role |
|---|---|
| `hooks/probe-log.js` | Logs who made each hook call (identity and routing fields only, never tool inputs) to `.claude/probe-log.jsonl` |
| `hooks/probe-deny.js` | Denies one call shape: `probe-lead` spawning `probe-haiku-pinned`. Tests whether a settings hook can block a subagent's spawn |
| `settings.local.json` | Registers both hooks for `PreToolUse`, the logger for `SubagentStart` (once for all agents, once with a `probe-lead` matcher) and for `SubagentStop` |
| `agents/probe-lead.md` | Stand-in lead (Sonnet). Spawns or resumes children exactly as told |
| `agents/probe-worker.md` | Trivial child (Haiku alias). Runs one harmless `node -e` command |
| `agents/probe-turns.md` | `maxTurns: 3`. Spawns workers one per message |
| `agents/probe-mcp.md` | Calls the read-only `orchestra_doctor` MCP tool once |
| `agents/probe-haiku-pinned.md` | Worker pinned to `claude-haiku-5-5` |
| `agents/probe-opus-max.md` | Worker pinned to `claude-opus-5-5` at `effort: max` (the new principal rung's frontmatter) |
| `probe-models.js` | Prints the model ids served in a transcript |

## Setup (PowerShell)

```powershell
$repo = "C:\path\to\Claude-Orchestra"          # this repository, on this branch
$kit  = "$repo\plans\team-leads-probe-kit"
$proj = "C:\scratch\lead-probes"                # throwaway project

New-Item -ItemType Directory -Force $proj | Out-Null
git -C $proj init
node "$repo\install.js" $proj --packs codex     # current harness + the engine MCP server (probe 5)

New-Item -ItemType Directory -Force "$proj\.claude\hooks", "$proj\.claude\agents" | Out-Null
Copy-Item "$kit\hooks\*.js"  "$proj\.claude\hooks\"
Copy-Item "$kit\agents\*.md" "$proj\.claude\agents\"
Copy-Item "$kit\settings.local.json" "$proj\.claude\settings.local.json"   # merge by hand if one exists

Set-Location $proj
claude --version                                 # record this
claude --model sonnet                            # Sonnet main session = NORMAL mode; the guard stands down
```

Trust the folder when asked, because hooks only run in a trusted folder. Between probes, clear the
log so each probe reads cleanly:

```powershell
Remove-Item .claude\probe-log.jsonl -ErrorAction SilentlyContinue
```

To read the log:

```powershell
Get-Content .claude\probe-log.jsonl | ConvertFrom-Json |
  Format-Table at, tag, event, agent_id, agent_type, tool_name, subagent_type -AutoSize
```

Paste each prompt below into the session exactly as written.

## Probe 1: identity, matcher, and deny (feeds WO-2, WO-3)

```
Spawn probe-lead in the foreground with this task:
1. Spawn one probe-worker to run: node -e "console.log('w1')"
2. Spawn two probe-workers in parallel, each to run: node -e "console.log('p')"
3. Spawn one probe-haiku-pinned to run: node -e "console.log('should be denied')"
Then report.
```

Check, and record each as yes/no with the evidence line:

- **1a.** Every `SubagentStart` line tagged `start-any` has `agent_type` equal to the agent's
  frontmatter `name`.
- **1b.** A `start-matched-probe-lead` line appears for `probe-lead` and for no worker. That means
  a `SubagentStart` matcher can target one agent type. If it also appears for the workers, the
  matcher is ignored and WO-3 filters inside the script instead.
- **1c.** The `PreToolUse` lines with `tool_name: Agent` carry `agent_type: probe-lead` and
  `subagent_type: probe-worker`. That means the hook sees the *calling* subagent on a spawn, which
  WO-2 depends on.
- **1d.** Step 3 was denied, and `probe-lead` reported the `probe-deny:` text verbatim. That means
  a settings hook can block a subagent's spawn (WO-2).
- **1e.** The two parallel workers' `Bash` lines carry different `agent_id`s.
- **1f.** Any name in `keys` beyond the documented fields (for example a parent-agent id). Note it.

## Probe 2: what `maxTurns` counts (sets the leads' `maxTurns`)

```
Spawn probe-turns in the foreground with this task: steps 1 to 5 — in each step N, spawn one probe-worker to run: node -e "console.log(N)"
```

- **2a.** How many workers ran before it stopped, and the exact text the main session received
  at the stop (is it marked partial?).

```
Send probe-turns a message: "continue with the remaining steps"
```

- **2b.** How many more workers ran before it stopped again. That tells you whether a resume
  resets the `maxTurns` count.

```
Spawn a new probe-turns in the foreground with this task:
1. Spawn one probe-worker to run: node -e "setTimeout(()=>console.log('slow'),90000)"
2. Spawn one probe-worker to run: node -e "console.log('fast')"
3. Spawn one probe-worker to run: node -e "console.log('fast')"
```

- **2c.** Did the 90-second child cost the same as a quick one? Compare how many steps ran here
  with 2a.

## Probe 3: background lead mechanics (feeds D3 and the Leads section)

```
Spawn probe-lead in the background with this task:
1. Spawn two probe-workers in parallel, each to run: node -e "setTimeout(()=>console.log('bg'),90000)"
Then report.
```

Type nothing until it finishes.

- **3a.** Did the completion notification arrive and the session respond on its own, without
  you typing?

Run the same prompt again. About 30 seconds in, type: `Stop probe-lead now with TaskStop.` Then:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object CommandLine -match "setTimeout" | Select-Object ProcessId, CommandLine
```

- **3b.** Did stopping the lead stop its workers? No surviving `setTimeout` processes, and
  `SubagentStop` lines for the workers right after the stop, means yes.

```
Spawn probe-lead in the foreground with this task:
1. Spawn one probe-worker to run: node -e "console.log('first')"
2. Send that same worker a message with SendMessage, using the agent id from step 1: run node -e "console.log('second')"
Then report both results.
```

- **3c.** The lead resumed its own child, and the second result came back to the lead (it appears
  in the lead's report). The log also shows a second `SubagentStart` for that worker's `agent_id`.
  That means a resume fires `SubagentStart`, which WO-3's budget reset relies on.

```
Send probe-lead (the one from the last step) the message: "reply with the number 7"
```

- **3d.** The log shows a new `SubagentStart` for the *lead's* `agent_id` (both tags). That means
  resuming a lead from the main session restarts its budget clock.

## Probe 4: does a scheduled check-in fire while the Director waits? (D3 layer 4)

```
Use CronCreate to schedule a recurring prompt every 2 minutes with the text: "CHECK-IN: reply with the current time only."
Then spawn probe-lead in the background with this task: steps 1 to 3 — in each step, spawn one probe-worker to run: node -e "setTimeout(()=>console.log('wait'),90000)", one step at a time.
```

Watch for about 5 minutes without typing.

- **4a.** Did `CHECK-IN` turns fire while the background lead was still running?
- **4b.** If one came due during a busy turn, did it run once that turn ended?

Then: `Delete that cron task with CronDelete.`

## Probe 5: MCP tools at depth 2 (`reviewer-codex` under a lead)

```
Spawn probe-lead in the foreground with this task:
1. Spawn one probe-mcp.
Then report its reply.
```

- **5a.** The lead's report contains a `DOCTOR EXIT CODE:` line (pass), or says the tool was
  unavailable (fail: leads could not run the Sol reviewer).

## Probe 6: which Haiku actually serves the pinned and aliased agents

```
In parallel, spawn one probe-haiku-pinned and one probe-worker, each to run: node -e "console.log(1)"
```

From the two `stop` lines in the log, copy each `agent_transcript_path`, then:

```powershell
node "$kit\probe-models.js" "<agent_transcript_path>"
```

- **6a.** The model id served for `probe-haiku-pinned` (expect `claude-haiku-5-5`).
- **6b.** The model id served for `probe-worker` through the `haiku` alias (expect Haiku 5.5 on
  the Anthropic API, Haiku 4.5 on Bedrock, Vertex or Foundry).

## Probe 7: the principal rung's frontmatter (feeds WO-1b)

Run `/agents` in the session first.

- **7a.** `probe-opus-max` is listed. An agent whose frontmatter is rejected never registers, and
  nothing logs it.

```
Spawn one probe-opus-max to run: node -e "console.log(1)"
```

Take its `agent_transcript_path` from the `stop` line and run:

```powershell
node "$kit\probe-models.js" "<agent_transcript_path>"
```

- **7b.** The model id served (expect `claude-opus-5-5`). Effort isn't visible in the transcript.
  Note any warning or error Claude Code printed about `effort: max`.

## Cleanup

Close the session and delete `$proj`. Nothing in the kit touches the harness repository or your
user-level settings.

## Results template: `plans/team-leads-probe-results.md`

```markdown
# WO-0 probe results

Date: · Claude Code: <claude --version> · OS: · Main model: · API: Anthropic / Bedrock / Vertex / Foundry

| Probe | Observed (evidence: log line or quote) | As the plan assumes? | Design change it forces |
|---|---|---|---|
| 1a agent_type = name | | | |
| 1b SubagentStart matcher targets one type | | | |
| 1c caller identity on Agent calls | | | |
| 1d settings hook blocks a subagent spawn | | | |
| 1e parallel children have distinct agent_ids | | | |
| 1f extra input fields | | | |
| 2a maxTurns stop point and partial marker | | | |
| 2b resume resets maxTurns | | | |
| 2c long child counts as one turn | | | |
| 3a background completion wakes the session | | | |
| 3b TaskStop on a lead stops its children | | | |
| 3c lead resumes its own child; SubagentStart on resume | | | |
| 3d main-session resume of a lead fires SubagentStart | | | |
| 4a cron fires while waiting on a background lead | | | |
| 4b cron that came due while busy runs after the turn | | | |
| 5a MCP tool at depth 2 | | | |
| 6a pinned claude-haiku-5-5 served as | | | |
| 6b haiku alias served as | | | |
| 7a probe-opus-max registers (effort: max accepted) | | | |
| 7b pinned claude-opus-5-5 served as | | | |
```
