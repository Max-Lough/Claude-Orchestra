#!/usr/bin/env node
/**
 * Orchestra director guard — PreToolUse hook.
 *
 * Enforces Director law: the main session (the Director) may not edit files,
 * run commands, or search the codebase — those belong to the executor and
 * scout subagents. Subagent tool calls are exempt.
 *
 * The settings.json matcher fires this hook on every main-session tool call;
 * this script is the single source of truth for what the Director may do.
 *
 * Optional per-project policy — .claude/orchestra.json:
 *   {
 *     "directorBlockedPatterns": ["^mcp__blender__", "^mcp__godot__"],
 *     "directorAllowedTools": ["Glob"]
 *   }
 * directorBlockedPatterns: regexes tested against tool names; matches are
 *   denied to the Director (use for MCP tools that mutate external state).
 * directorAllowedTools: exact built-in names to REMOVE from the default
 *   blocklist below (loosen the law for this project without editing code).
 *
 * Fail-open by design: any unexpected input, config error, or internal error
 * allows the call rather than bricking the session. A broken orchestra.json
 * disables only itself — the default blocklist still applies.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Tools the Director may not use (default law).
const BLOCKED = new Set([
  'Edit',
  'MultiEdit',
  'Write',
  'NotebookEdit',
  'Bash',
  'PowerShell',
  'Grep',
  'Glob',
]);

const PAUSE_BASENAME = 'orchestra.pause';
const CONFIG_BASENAME = 'orchestra.json';

function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function denyDefault(toolName) {
  deny(
    'Orchestra: the Director does not use ' + toolName + '. Delegate instead — ' +
      'searches/reading the terrain -> scout agent; file edits and commands -> executor ' +
      'or a domain specialist agent; verification -> reviewer agent. ' +
      '(User-only pause switch: create .claude/' + PAUSE_BASENAME + ' or set ORCHESTRA_PAUSE=1.)'
  );
}

function denyByPolicy(toolName) {
  deny(
    'Orchestra: ' + toolName + ' is blocked for the Director by project policy ' +
      '(.claude/' + CONFIG_BASENAME + '): tools that mutate external state count as ' +
      'execution. Delegate to the executor or a domain specialist agent — subagents ' +
      'inherit MCP tools. (User-only pause switch: .claude/' + PAUSE_BASENAME +
      ' or ORCHESTRA_PAUSE=1.)'
  );
}

// Per-project policy. Any failure here returns the empty policy — the default
// blocklist above is never weakened by a broken config.
function loadPolicy() {
  const empty = { patterns: [], allowed: [] };
  try {
    const p = path.join(projectDir(), '.claude', CONFIG_BASENAME);
    if (!fs.existsSync(p)) return empty;
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!cfg || typeof cfg !== 'object') return empty;
    const patterns = (Array.isArray(cfg.directorBlockedPatterns) ? cfg.directorBlockedPatterns : [])
      .filter((s) => typeof s === 'string')
      .map((s) => {
        try {
          return new RegExp(s);
        } catch (_) {
          return null; // bad regex — skip it, keep the rest
        }
      })
      .filter(Boolean);
    const allowed = (Array.isArray(cfg.directorAllowedTools) ? cfg.directorAllowedTools : []).filter(
      (s) => typeof s === 'string'
    );
    return { patterns, allowed };
  } catch (_) {
    return empty;
  }
}

// The one mutation the Director is permitted: creating/removing the pause file
// itself, at the user's explicit request (see ORCHESTRA.md §6).
function isPauseFileOperation(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  if (toolName === 'Write' || toolName === 'Edit') {
    return (
      typeof toolInput.file_path === 'string' &&
      path.basename(toolInput.file_path) === PAUSE_BASENAME
    );
  }
  if (toolName === 'Bash' || toolName === 'PowerShell') {
    return (
      typeof toolInput.command === 'string' &&
      toolInput.command.includes(PAUSE_BASENAME)
    );
  }
  return false;
}

function main(raw) {
  let input;
  try {
    input = JSON.parse(raw);
  } catch (_) {
    return allow(); // unparseable input — fail open
  }

  // Escape hatches (user-controlled).
  if (process.env.ORCHESTRA_PAUSE === '1') return allow();
  try {
    if (fs.existsSync(path.join(projectDir(), '.claude', PAUSE_BASENAME))) return allow();
  } catch (_) {
    /* fall through — treat as no pause file */
  }

  // Subagent calls are never restricted. Project-settings PreToolUse hooks
  // only fire for the main session in current Claude Code, but if this input
  // carries subagent identity (agent_id / agent_type), exempt it explicitly.
  if (input.agent_id || input.agent_type) return allow();

  const toolName = input.tool_name;
  if (typeof toolName !== 'string') return allow();

  const policy = loadPolicy();

  if (BLOCKED.has(toolName) && !policy.allowed.includes(toolName)) {
    if (isPauseFileOperation(toolName, input.tool_input)) return allow();
    return denyDefault(toolName);
  }

  if (policy.patterns.some((re) => re.test(toolName))) {
    return denyByPolicy(toolName);
  }

  return allow();
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch (_) {
    allow(); // never brick the session on a guard bug
  }
});
