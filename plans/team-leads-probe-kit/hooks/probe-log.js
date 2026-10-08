#!/usr/bin/env node
/**
 * WO-0 probe logger: records which agent made each hook call.
 *
 * Wired as a command hook for PreToolUse, SubagentStart and SubagentStop (see
 * ../settings.local.json). Appends one JSON line per event to
 * <project>/.claude/probe-log.jsonl.
 *
 * It logs identity and routing fields only, never tool inputs such as file
 * contents or commands, so the log is safe to paste into the probe results.
 * `keys` lists every top-level field the hook input carried (names only), which
 * is how the probes spot undocumented fields such as a parent-agent id.
 *
 * Input:  hook JSON on stdin.
 * Output: nothing on stdout. The hook never decides anything and always exits
 *         0, so a logging fault can never block a tool call.
 * argv[2] (optional): a tag stored with the line. Used to tell whether a
 *         matcher-scoped registration fired (see settings.local.json).
 */
'use strict';

const fs = require('fs');
const path = require('path');

function pick(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const toolInput = input && typeof input.tool_input === 'object' && input.tool_input ? input.tool_input : {};
    const line = {
      at: new Date().toISOString(),
      tag: process.argv[2] || null,
      event: pick(input, 'hook_event_name'),
      session_id: pick(input, 'session_id'),
      agent_id: pick(input, 'agent_id'),
      agent_type: pick(input, 'agent_type'),
      tool_name: pick(input, 'tool_name'),
      // Agent-tool routing fields only; every other tool input is left out.
      subagent_type: pick(toolInput, 'subagent_type'),
      model_override: pick(toolInput, 'model'),
      run_in_background: pick(toolInput, 'run_in_background'),
      isolation: pick(toolInput, 'isolation'),
      // SubagentStop extras (paths, not contents).
      stop_hook_active: pick(input, 'stop_hook_active'),
      agent_transcript_path: pick(input, 'agent_transcript_path'),
      keys: Object.keys(input || {}).sort(),
    };
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    fs.appendFileSync(path.join(projectDir, '.claude', 'probe-log.jsonl'), JSON.stringify(line) + '\n', 'utf8');
  } catch (e) {
    // A logging fault must never block the tool call; leave a trace instead.
    process.stderr.write('probe-log: ' + (e && e.message ? e.message : String(e)) + '\n');
  }
  process.exit(0);
});
