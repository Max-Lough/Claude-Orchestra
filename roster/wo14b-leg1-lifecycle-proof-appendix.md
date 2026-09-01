# WO-14b leg 1 — appendix: captured payloads and fixture (verbatim, paths shortened)

Companion to `roster/wo14b-leg1-lifecycle-proof.md`. `<target>` = the disposable target directory; `<claude-projects-dir>` = the host transcript root under `~/.claude/projects/`.

## Run 2 — every hook event, in order (run 1 had the same shapes; its 15 events are summarised in the record)

```jsonl
{"t":"2026-09-01T04:11:45.904Z","label":"SessionStart","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","hook_event_name":"SessionStart","source":"startup"}}
{"t":"2026-09-01T04:11:46.473Z","label":"UserPromptSubmit","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","hook_event_name":"UserPromptSubmit","prompt":"Run the leg-1 enforcement probe. Do these FOUR Agent-tool launches in order, one at a time, and do not stop until you have attempted all four; if a launch is denied, note the denial reason and continue to the next one. (1) launch subagent probe-agent with the exact prompt 'TICKET=tkt-aa11bb22cc33dd44'. (2) launch subagent probe-agent with the exact prompt 'NO TICKET HERE'. (3) launch subagent probe-agent again with the exact prompt 'TICKET=tkt-aa11bb22cc33dd44' (a replay). (4) launch subagent probe-agent with the exact prompt 'TICKET=tkt-9999999999999999'. When all four have been attempted and any launched subagent has returned, reply with exactly four lines: 'L1: <outcome>' 'L2: <outcome>' 'L3: <outcome>' 'L4: <outcome>' where outcome is either DENIED: <reason> or RESULT: <the subagent's echoed ticket>."}}
{"t":"2026-09-01T04:11:50.290Z","label":"PreToolUse:Agent","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","hook_event_name":"PreToolUse","tool_name":"Agent","tool_input":{"description":"Probe launch 1","prompt":"TICKET=tkt-aa11bb22cc33dd44","subagent_type":"probe-agent"},"tool_use_id":"toolu_01AuYt3hjvYc2Yws8FZriovJ"}}
{"t":"2026-09-01T04:11:50.491Z","label":"SubagentStart","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","agent_id":"a01ba92504d73e391","agent_type":"probe-agent","hook_event_name":"SubagentStart"}}
{"t":"2026-09-01T04:11:50.501Z","label":"PostToolUse:Agent","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","hook_event_name":"PostToolUse","tool_name":"Agent","tool_input":{"description":"Probe launch 1","prompt":"TICKET=tkt-aa11bb22cc33dd44","subagent_type":"probe-agent"},"tool_response":{"isAsync":true,"status":"async_launched","agentId":"a01ba92504d73e391","description":"Probe launch 1","resolvedModel":"claude-haiku-4-5-20251001","prompt":"TICKET=tkt-aa11bb22cc33dd44","outputFile":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430\\tasks\\a01ba92504d73e391.output","canReadOutputFile":true},"tool_use_id":"toolu_01AuYt3hjvYc2Yws8FZriovJ","duration_ms":4}}
{"t":"2026-09-01T04:11:54.540Z","label":"PreToolUse:any","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","agent_id":"a01ba92504d73e391","agent_type":"probe-agent","hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target\\probe.txt"},"tool_use_id":"toolu_01K5RDbxbEBXTRJ1imG42Pny"}}
{"t":"2026-09-01T04:11:54.726Z","label":"Stop","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","hook_event_name":"Stop","stop_hook_active":false,"last_assistant_message":"Probe launch 1 initiated. Waiting for completion notification before proceeding to launch 2.","background_tasks":[{"id":"a01ba92504d73e391","type":"subagent","status":"running","description":"Probe launch 1","agent_type":"probe-agent"}],"session_crons":[]}}
{"t":"2026-09-01T04:11:54.765Z","label":"PostToolUse:any","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","agent_id":"a01ba92504d73e391","agent_type":"probe-agent","hook_event_name":"PostToolUse","tool_name":"Read","tool_input":{"file_path":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target\\probe.txt"},"tool_response":{"type":"text","file":{"filePath":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target\\probe.txt","content":"leg-1 probe file: present.\n","numLines":2,"startLine":1,"totalLines":2}},"tool_use_id":"toolu_01K5RDbxbEBXTRJ1imG42Pny","duration_ms":36}}
{"t":"2026-09-01T04:11:56.215Z","label":"SubagentStop","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","agent_id":"a01ba92504d73e391","agent_type":"probe-agent","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430\\subagents\\agent-a01ba92504d73e391.jsonl","last_assistant_message":"PROBE-AGENT-RESULT\nTICKET=tkt-aa11bb22cc33dd44","background_tasks":[{"id":"a01ba92504d73e391","type":"subagent","status":"running","description":"Probe launch 1","agent_type":"probe-agent"}],"session_crons":[]}}
{"t":"2026-09-01T04:11:56.850Z","label":"Stop","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"db03395e-d722-4138-a075-209b34ecbee5","permission_mode":"default","hook_event_name":"Stop","stop_hook_active":true,"last_assistant_message":"Understood. I'm holding for the probe-agent #1 result before proceeding to launch #2. Waiting for the completion notification.","background_tasks":[],"session_crons":[]}}
{"t":"2026-09-01T04:11:56.996Z","label":"UserPromptSubmit","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"849bafa3-e3ca-455d-afeb-e9147070ba2d","permission_mode":"default","hook_event_name":"UserPromptSubmit","prompt":"<task-notification>\n<task-id>a01ba92504d73e391</task-id>\n<tool-use-id>toolu_01AuYt3hjvYc2Yws8FZriovJ</tool-use-id>\n<output-file>C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430\\tasks\\a01ba92504d73e391.output</output-file>\n<status>completed</status>\n<summary>Agent \"Probe launch 1\" finished</summary>\n<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>\n<result>PROBE-AGENT-RESULT\nTICKET=tkt-aa11bb22cc33dd44</result>\n<usage><subagent_tokens>2634</subagent_tokens><tool_uses>1</tool_uses><duration_ms>5895</duration_ms></usage>\n</task-notification>"}}
{"t":"2026-09-01T04:11:59.649Z","label":"PreToolUse:Agent","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"849bafa3-e3ca-455d-afeb-e9147070ba2d","permission_mode":"default","hook_event_name":"PreToolUse","tool_name":"Agent","tool_input":{"description":"Probe launch 2","prompt":"NO TICKET HERE","subagent_type":"probe-agent"},"tool_use_id":"toolu_01Xm7iWRm78QPJcMoZn6uq9z"}}
{"t":"2026-09-01T04:12:02.145Z","label":"PreToolUse:Agent","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"849bafa3-e3ca-455d-afeb-e9147070ba2d","permission_mode":"default","hook_event_name":"PreToolUse","tool_name":"Agent","tool_input":{"description":"Probe launch 3","prompt":"TICKET=tkt-aa11bb22cc33dd44","subagent_type":"probe-agent"},"tool_use_id":"toolu_01DrEVFBgdHHwC6B8vR4zRL4"}}
{"t":"2026-09-01T04:12:04.457Z","label":"PreToolUse:Agent","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"849bafa3-e3ca-455d-afeb-e9147070ba2d","permission_mode":"default","hook_event_name":"PreToolUse","tool_name":"Agent","tool_input":{"description":"Probe launch 4","prompt":"TICKET=tkt-9999999999999999","subagent_type":"probe-agent"},"tool_use_id":"toolu_01BRFgRfpHMM59ikHMpwrz5q"}}
{"t":"2026-09-01T04:12:07.115Z","label":"Stop","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"849bafa3-e3ca-455d-afeb-e9147070ba2d","permission_mode":"default","hook_event_name":"Stop","stop_hook_active":false,"last_assistant_message":"L1: RESULT: tkt-aa11bb22cc33dd44\nL2: DENIED: no ticket in prompt\nL3: DENIED: ticket tkt-aa11bb22cc33dd44 is RESOLVED (one-use)\nL4: DENIED: ticket tkt-9999999999999999 is for role some-other-role, not probe-agent","background_tasks":[],"session_crons":[]}}
{"t":"2026-09-01T04:12:07.293Z","label":"SessionEnd","env":{"CLAUDE_AGENT_ID":null,"CLAUDE_AGENT_TYPE":null,"CLAUDE_SESSION_ID":null,"CLAUDE_PROJECT_DIR":"C:/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/157bcc07-bfcc-4328-b747-f8c512eb2d1c/scratchpad/leg1/target"},"payload":{"session_id":"d787d05d-bcd7-4f4b-85b5-c531aaf2a430","transcript_path":"C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430.jsonl","cwd":"C:\\Users\\maxtl\\AppData\\Local\\Temp\\claude\\C--Users-maxtl-Projects-Claude-Orchestra\\157bcc07-bfcc-4328-b747-f8c512eb2d1c\\scratchpad\\leg1\\target","prompt_id":"849bafa3-e3ca-455d-afeb-e9147070ba2d","hook_event_name":"SessionEnd","reason":"other"}}
```

## Run 2 — gate.log

```jsonl
{"t":"2026-09-01T04:11:50.293Z","label":"PreToolUse","decision":"allow","ticket":"tkt-aa11bb22cc33dd44","tool_use_id":"toolu_01AuYt3hjvYc2Yws8FZriovJ"}
{"t":"2026-09-01T04:11:50.504Z","label":"PostToolUse","bound":"a01ba92504d73e391","served_model":"claude-haiku-4-5-20251001","tool_use_id":"toolu_01AuYt3hjvYc2Yws8FZriovJ"}
{"t":"2026-09-01T04:11:54.773Z","label":"Stop","stop_hook_active":false,"open":["tkt-aa11bb22cc33dd44"],"bg":[{"id":"a01ba92504d73e391","type":"subagent","status":"running","description":"Probe launch 1","agent_type":"probe-agent"}]}
{"t":"2026-09-01T04:11:56.221Z","label":"SubagentStop","resolved":"a01ba92504d73e391","result":"PROBE-AGENT-RESULT\nTICKET=tkt-aa11bb22cc33dd44"}
{"t":"2026-09-01T04:11:56.849Z","label":"Stop","stop_hook_active":true,"open":[],"bg":[]}
{"t":"2026-09-01T04:11:59.650Z","label":"PreToolUse","decision":"deny","reason":"no ticket in prompt"}
{"t":"2026-09-01T04:12:02.150Z","label":"PreToolUse","decision":"deny","reason":"ticket tkt-aa11bb22cc33dd44 is RESOLVED (one-use)"}
{"t":"2026-09-01T04:12:04.456Z","label":"PreToolUse","decision":"deny","reason":"ticket tkt-9999999999999999 is for role some-other-role, not probe-agent"}
{"t":"2026-09-01T04:12:07.116Z","label":"Stop","stop_hook_active":false,"open":[],"bg":[]}
```

## Run 2 — tickets.json before / after

```json
{
  "generation": 1,
  "tickets": {
    "tkt-aa11bb22cc33dd44": { "role": "probe-agent", "status": "OPEN", "issued_at": "2026-09-01T04:20:00Z" },
    "tkt-9999999999999999": { "role": "some-other-role", "status": "OPEN", "issued_at": "2026-09-01T04:20:00Z" }
  }
}
```

```json
{
  "generation": 1,
  "tickets": {
    "tkt-aa11bb22cc33dd44": {
      "role": "probe-agent",
      "status": "RESOLVED",
      "issued_at": "2026-09-01T04:20:00Z",
      "tool_use_id": "toolu_01AuYt3hjvYc2Yws8FZriovJ",
      "consumed_at": "2026-09-01T04:11:50.291Z",
      "agent_id": "a01ba92504d73e391",
      "served_model": "claude-haiku-4-5-20251001",
      "result": "PROBE-AGENT-RESULT\nTICKET=tkt-aa11bb22cc33dd44",
      "agent_transcript_path": "C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430\\subagents\\agent-a01ba92504d73e391.jsonl"
    },
    "tkt-9999999999999999": {
      "role": "some-other-role",
      "status": "OPEN",
      "issued_at": "2026-09-01T04:20:00Z"
    }
  }
}
```

## Run 1 — ticket and final result

```
issued: tkt-51abec4357c1447d
main final: MAIN-RESULT TICKET=tkt-51abec4357c1447d
cost_usd: 0.0357774
```

## Run 2 — final result

```
L1: RESULT: tkt-aa11bb22cc33dd44
L2: DENIED: no ticket in prompt
L3: DENIED: ticket tkt-aa11bb22cc33dd44 is RESOLVED (one-use)
L4: DENIED: ticket tkt-9999999999999999 is for role some-other-role, not probe-agent
num_turns: 4  cost_usd: 0.0479666
```

## Fixture files

### `.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" SessionStart" } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" UserPromptSubmit" } ] }
    ],
    "SubagentStart": [
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" SubagentStart" } ] }
    ],
    "PreToolUse": [
      { "matcher": "Agent", "hooks": [
        { "type": "command", "command": "node \".claude/hooks/log-event.js\" PreToolUse:Agent" },
        { "type": "command", "command": "node \".claude/hooks/ticket-gate.js\" PreToolUse" }
      ] },
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" PreToolUse:any" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Agent", "hooks": [
        { "type": "command", "command": "node \".claude/hooks/log-event.js\" PostToolUse:Agent" },
        { "type": "command", "command": "node \".claude/hooks/ticket-gate.js\" PostToolUse" }
      ] },
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" PostToolUse:any" } ] }
    ],
    "PostToolUseFailure": [
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" PostToolUseFailure" } ] }
    ],
    "PermissionDenied": [
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" PermissionDenied" } ] }
    ],
    "SubagentStop": [
      { "hooks": [
        { "type": "command", "command": "node \".claude/hooks/log-event.js\" SubagentStop" },
        { "type": "command", "command": "node \".claude/hooks/ticket-gate.js\" SubagentStop" }
      ] }
    ],
    "Stop": [
      { "hooks": [
        { "type": "command", "command": "node \".claude/hooks/log-event.js\" Stop" },
        { "type": "command", "command": "node \".claude/hooks/ticket-gate.js\" Stop" }
      ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "node \".claude/hooks/log-event.js\" SessionEnd" } ] }
    ]
  }
}

```

### `.claude/agents/probe-agent.md`

```markdown
---
name: probe-agent
description: Leg-1 lifecycle probe subagent. Echoes the ticket it was given. Use when asked to run the probe.
tools: Read
model: haiku
---

You are a lifecycle probe. Your prompt contains a line of the form `TICKET=<value>`.
Use the Read tool exactly once on the file `probe.txt` in the working directory (it may
not exist — that is fine, report the error briefly). Then reply with exactly two lines:

    PROBE-AGENT-RESULT
    TICKET=<the exact value you were given>

Nothing else.

```

### `.claude/hooks/log-event.js`

```js
#!/usr/bin/env node
// Leg-1 lifecycle probe: append every hook event's full stdin payload, verbatim,
// to events.jsonl with a wall-clock stamp and the event label passed as argv[2].
// Exit 0 always (never blocks) so we observe the host's natural ordering.
'use strict';
const fs = require('fs');
const path = require('path');
const label = process.argv[2] || 'unknown';
const out = path.join(__dirname, '..', 'events.jsonl');
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (_) { /* keep raw */ }
  const rec = {
    t: new Date().toISOString(),
    label,
    pid: process.pid,
    ppid: process.ppid,
    env: {
      CLAUDE_AGENT_ID: process.env.CLAUDE_AGENT_ID || null,
      CLAUDE_AGENT_TYPE: process.env.CLAUDE_AGENT_TYPE || null,
      CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID || null,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR || null,
    },
    payload: parsed,
    raw: parsed ? undefined : raw,
  };
  fs.appendFileSync(out, JSON.stringify(rec) + '\n');
  process.exit(0);
});

```

### `.claude/hooks/ticket-gate.js`

```js
#!/usr/bin/env node
// Leg-1 enforcement probe: a minimal ticket gate.
//   PreToolUse(Agent): allow only if the prompt carries TICKET=<id> for an OPEN ticket in
//                      tickets.json whose role matches subagent_type; consume it (one-use).
//                      Anything else -> permissionDecision "deny". Malformed state -> deny.
//   PostToolUse(Agent): bind agentId + resolvedModel to the consumed ticket by tool_use_id.
//   SubagentStop:       bind last_assistant_message to the ticket by agent_id -> RESOLVED.
//   Stop:               if any ticket is CONSUMED but not RESOLVED -> decision "block" once
//                       (stop_hook_active guards against looping).
// Every decision is appended to gate.log. Fail CLOSED on any internal error.
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const storePath = path.join(dir, 'tickets.json');
const logPath = path.join(dir, 'gate.log');
const label = process.argv[2] || 'unknown';
function log(o) { fs.appendFileSync(logPath, JSON.stringify(Object.assign({ t: new Date().toISOString(), label }, o)) + '\n'); }
function out(obj, code) { process.stdout.write(JSON.stringify(obj)); process.exit(code || 0); }
function deny(reason) { log({ decision: 'deny', reason }); out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }); }
function loadStore() { return JSON.parse(fs.readFileSync(storePath, 'utf8')); }
function saveStore(s) { fs.writeFileSync(storePath, JSON.stringify(s, null, 2)); }

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let p;
  try { p = JSON.parse(raw); } catch (e) { if (label.startsWith('Pre')) return deny('malformed hook input'); log({ error: 'malformed input on ' + label }); return out({}); }
  try {
    const ev = p.hook_event_name;
    if (ev === 'PreToolUse' && p.tool_name === 'Agent') {
      if (p.agent_id) { log({ decision: 'allow', why: 'nested spawn from subagent ' + p.agent_id + ' (not gated in this probe)' }); return out({}); }
      let store; try { store = loadStore(); } catch (e) { return deny('ticket store unreadable — fail closed'); }
      const m = /TICKET=(tkt-[0-9a-f]+)/.exec(String(p.tool_input && p.tool_input.prompt || ''));
      if (!m) return deny('no ticket in prompt');
      const t = store.tickets[m[1]];
      if (!t) return deny('unknown ticket ' + m[1]);
      if (t.status !== 'OPEN') return deny('ticket ' + m[1] + ' is ' + t.status + ' (one-use)');
      if (t.role !== p.tool_input.subagent_type) return deny('ticket ' + m[1] + ' is for role ' + t.role + ', not ' + p.tool_input.subagent_type);
      t.status = 'CONSUMED'; t.tool_use_id = p.tool_use_id; t.consumed_at = new Date().toISOString();
      saveStore(store);
      log({ decision: 'allow', ticket: m[1], tool_use_id: p.tool_use_id });
      return out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'ticket ' + m[1] + ' consumed' } });
    }
    if (ev === 'PostToolUse' && p.tool_name === 'Agent' && !p.agent_id) {
      const store = loadStore();
      const t = Object.values(store.tickets).find((x) => x.tool_use_id === p.tool_use_id);
      if (t) { t.agent_id = p.tool_response && p.tool_response.agentId; t.served_model = p.tool_response && p.tool_response.resolvedModel; t.status = t.status === 'CONSUMED' ? 'LAUNCHED' : t.status; saveStore(store); log({ bound: t.agent_id, served_model: t.served_model, tool_use_id: p.tool_use_id }); }
      else log({ warn: 'PostToolUse Agent with no consumed ticket for tool_use_id ' + p.tool_use_id, resp_status: p.tool_response && p.tool_response.status });
      return out({});
    }
    if (ev === 'SubagentStop') {
      const store = loadStore();
      const t = Object.values(store.tickets).find((x) => x.agent_id === p.agent_id);
      if (t) { t.status = 'RESOLVED'; t.result = p.last_assistant_message; t.agent_transcript_path = p.agent_transcript_path; saveStore(store); log({ resolved: p.agent_id, result: String(p.last_assistant_message).slice(0, 120) }); }
      else log({ warn: 'SubagentStop for unbound agent ' + p.agent_id + ' type=' + p.agent_type });
      return out({});
    }
    if (ev === 'Stop') {
      const store = loadStore();
      const open = Object.entries(store.tickets).filter(([, x]) => x.status === 'CONSUMED' || x.status === 'LAUNCHED');
      log({ stop_hook_active: p.stop_hook_active, open: open.map(([k]) => k), bg: p.background_tasks });
      if (open.length && !p.stop_hook_active) return out({ decision: 'block', reason: 'open tickets: ' + open.map(([k]) => k).join(',') + ' — wait for the subagent result before stopping' });
      return out({});
    }
    return out({});
  } catch (e) {
    log({ error: String(e && e.stack || e) });
    if (label.startsWith('Pre')) return deny('gate internal error — fail closed');
    return out({});
  }
});

```

## Invocation (run 2)

```
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT -u CLAUDE_CODE_SSE_PORT claude -p "<probe prompt: four launches in order>" --model haiku --allowedTools Agent Read --output-format stream-json --verbose --max-turns 12
```
