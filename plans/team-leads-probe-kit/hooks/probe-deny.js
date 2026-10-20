#!/usr/bin/env node
/**
 * WO-0 probe 1b: can a settings-level PreToolUse hook block a SUBAGENT's spawn?
 *
 * WO-2's company law depends on it. This hook denies exactly one call shape:
 * probe-lead calling the Agent tool with subagent_type "probe-haiku-pinned".
 * Every other call passes untouched. The deny uses the same output format as
 * hooks/orchestra-guard.js deny(), so a pass here means the guard's format
 * works for subagent calls too.
 *
 * Input: hook JSON on stdin. Output: a deny decision on stdout for the one
 * shape, nothing otherwise. Always exits 0; malformed input passes (fail open,
 * as the guard does).
 */
'use strict';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch (_) {
    process.exit(0);
  }
  const toolInput = input && typeof input.tool_input === 'object' && input.tool_input ? input.tool_input : {};
  if (
    input &&
    input.tool_name === 'Agent' &&
    input.agent_type === 'probe-lead' &&
    toolInput.subagent_type === 'probe-haiku-pinned'
  ) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'probe-deny: probe-lead may not spawn probe-haiku-pinned. Report this denial verbatim.',
        },
      })
    );
  }
  process.exit(0);
});
