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
 * Model-aware: Director law binds only director models (ORCHESTRA.md §1).
 * Before denying, the guard reads the latest main-session assistant turn from
 * the session transcript (tail read, sidechain-filtered): Opus/Fable ->
 * enforce; anything else (Sonnet, Haiku) -> the Orchestra is dormant and the
 * guard stands down entirely. Undetermined -> stand down too: enforcement
 * requires positive evidence of a director model. Sonnet/Haiku sessions must
 * never see a denial (they can't cheaply delegate simple tasks), whereas an
 * unenforced first turn on a director session is harmless — ORCHESTRA.md
 * still instructs the Director to delegate, and the guard picks up hard
 * enforcement as soon as the model reaches the transcript. Known one-turn
 * staleness windows (both now fail toward standing down):
 *   - fresh session, first assistant turn: no assistant entry is flushed yet
 *     -> undetermined -> stand down (a director session's opening turn is
 *     covered by protocol instructions rather than the hook);
 *   - the current turn is flushed only after it completes, so a mid-session
 *     /model switch is picked up one turn late.
 *
 * Two writes are exempt from Director law:
 *   - the pause file (.claude/orchestra.pause), at the user's request (§6);
 *   - plan files: Write/Edit/MultiEdit of markdown under .claude/plans/
 *     (ORCHESTRA.md §4 PLAN). Plans are Director thinking, not execution —
 *     the plan is the one artifact the Director authors itself. The carve-out
 *     is deliberately narrow (that directory, .md only, traversal-checked) so
 *     it cannot become a general write loophole.
 *
 * Optional per-project policy — .claude/orchestra.json:
 *   {
 *     "directorBlockedPatterns": ["^mcp__blender__", "^mcp__godot__"],
 *     "directorAllowedTools": ["Glob"],
 *     "directorPlanPatterns": ["^docs/plans/.+\\.md$"]
 *   }
 * directorBlockedPatterns: regexes tested against tool names; matches are
 *   denied to the Director (use for MCP tools that mutate external state).
 * directorAllowedTools: exact built-in names to REMOVE from the default
 *   blocklist below (loosen the law for this project without editing code).
 * directorPlanPatterns: regexes tested against the project-relative path
 *   (forward-slash form) of Write/Edit/MultiEdit targets; matches are
 *   treated as plan files in ADDITION to the default .claude/plans/*.md.
 *   Paths outside the project directory never match.
 *
 * Fail-open by design: any unexpected input, config error, or internal error
 * allows the call rather than bricking the session. A broken orchestra.json
 * disables only itself — the default blocklist still applies. Model detection
 * follows the same rule: undetermined stands down rather than enforcing.
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

// Models allowed to direct (MODE A / MODE B). Anything else — Sonnet, Haiku,
// or unknown — means the Orchestra is dormant (ORCHESTRA.md §1) and the guard
// stands down so the session behaves like plain Claude Code. Matches bare ids
// ("claude-opus-4-8"), suffixed ("claude-opus-4-8[1m]"), and provider-prefixed
// ("us.anthropic.claude-opus-...") forms.
const DIRECTOR_MODEL = /opus|fable/i;

const PAUSE_BASENAME = 'orchestra.pause';
const CONFIG_BASENAME = 'orchestra.json';
const PLANS_DIRNAME = 'plans'; // .claude/plans — the Director's own notebook

// Tools whose calls can qualify for the plan-file exception.
const FILE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

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
  const planHint = FILE_WRITE_TOOLS.has(toolName)
    ? 'Exception: plan files — the Director may write markdown under .claude/' +
      PLANS_DIRNAME + '/ itself. '
    : '';
  deny(
    'Orchestra: the Director does not use ' + toolName + '. Delegate instead — ' +
      'searches/reading the terrain -> scout agent; file edits and commands -> executor ' +
      'or a domain specialist agent; verification -> reviewer agent. ' + planHint +
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
  const empty = { patterns: [], allowed: [], planPatterns: [] };
  try {
    const p = path.join(projectDir(), '.claude', CONFIG_BASENAME);
    if (!fs.existsSync(p)) return empty;
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!cfg || typeof cfg !== 'object') return empty;
    const toRegexes = (arr) =>
      (Array.isArray(arr) ? arr : [])
        .filter((s) => typeof s === 'string')
        .map((s) => {
          try {
            return new RegExp(s);
          } catch (_) {
            return null; // bad regex — skip it, keep the rest
          }
        })
        .filter(Boolean);
    const patterns = toRegexes(cfg.directorBlockedPatterns);
    const planPatterns = toRegexes(cfg.directorPlanPatterns);
    const allowed = (Array.isArray(cfg.directorAllowedTools) ? cfg.directorAllowedTools : []).filter(
      (s) => typeof s === 'string'
    );
    return { patterns, allowed, planPatterns };
  } catch (_) {
    return empty;
  }
}

// Latest main-session assistant model from the session transcript. Reads only
// the file tail (fixed cost regardless of transcript size) and skips sidechain
// (subagent) entries so a recently finished Haiku scout cannot masquerade as
// the session model. Returns null when undetermined — callers must treat null
// as "stand down": only positive evidence of a director model enforces.
function latestMainModel(input) {
  try {
    const tp = input.transcript_path;
    if (typeof tp !== 'string' || tp === '') return null;
    const size = fs.statSync(tp).size;
    const start = Math.max(0, size - 262144); // last 256 KB
    const buf = Buffer.alloc(size - start);
    const fd = fs.openSync(tp, 'r');
    try {
      fs.readSync(fd, buf, 0, buf.length, start);
    } finally {
      fs.closeSync(fd);
    }
    const lines = buf.toString('utf8').split('\n');
    if (start > 0) lines.shift(); // first line may begin mid-entry
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue; // partial/corrupt line — keep scanning backwards
      }
      if (!entry || entry.type !== 'assistant' || entry.isSidechain === true) continue;
      const model = entry.message && entry.message.model;
      if (typeof model === 'string' && model !== '' && model !== '<synthetic>') return model;
    }
    return null;
  } catch (_) {
    return null;
  }
}

// Plan-file exception (ORCHESTRA.md §4 PLAN): the Director may author plan
// files itself — markdown inside <project>/.claude/plans/ by default, plus any
// project-relative path matching directorPlanPatterns from orchestra.json.
// Containment is checked on the resolved path so "../" cannot escape, and the
// default carve-out requires a .md extension so it can't smuggle code.
function isPlanFileOperation(toolName, toolInput, planPatterns) {
  if (!FILE_WRITE_TOOLS.has(toolName)) return false;
  if (!toolInput || typeof toolInput !== 'object') return false;
  if (typeof toolInput.file_path !== 'string' || toolInput.file_path === '') return false;
  const root = projectDir();
  const resolved = path.resolve(root, toolInput.file_path);

  const relToProject = path.relative(root, resolved);
  if (relToProject === '' || relToProject.startsWith('..') || path.isAbsolute(relToProject)) {
    return false; // outside the project — never a plan file
  }

  // Default carve-out: .claude/plans/**/*.md
  const plansRoot = path.join(root, '.claude', PLANS_DIRNAME);
  const relToPlans = path.relative(plansRoot, resolved);
  const inPlansDir =
    relToPlans !== '' && !relToPlans.startsWith('..') && !path.isAbsolute(relToPlans);
  if (inPlansDir && /\.md$/i.test(resolved)) return true;

  // Project-configured plan locations (regexes over the forward-slash
  // project-relative path).
  const posixRel = relToProject.split(path.sep).join('/');
  return planPatterns.some((re) => re.test(posixRel));
}

// The one mutation the Director is permitted regardless of location: the
// pause file itself, at the user's explicit request (see ORCHESTRA.md §6).
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

  // Exempt mutations: the pause-file toggle (§6) and plan-file authorship
  // (§4 PLAN — .claude/plans/*.md plus any directorPlanPatterns matches).
  if (isPauseFileOperation(toolName, input.tool_input)) return allow();

  const policy = loadPolicy();

  if (isPlanFileOperation(toolName, input.tool_input, policy.planPatterns)) return allow();

  const deniedByDefault = BLOCKED.has(toolName) && !policy.allowed.includes(toolName);
  const deniedByPolicy = policy.patterns.some((re) => re.test(toolName));
  if (!deniedByDefault && !deniedByPolicy) return allow();

  // Model-aware dormancy (ORCHESTRA.md §1): only Opus/Fable direct. Enforce
  // only on positive evidence of a director model at the helm. Any other
  // model (Sonnet, Haiku) — or an undetermined one (no transcript, unreadable,
  // no assistant turn flushed yet, e.g. a fresh session's first turn) — means
  // the guard stands down so the session behaves like plain Claude Code; a
  // director session's opening turn is covered by ORCHESTRA.md instructions
  // until the model reaches the transcript.
  const model = latestMainModel(input);
  if (model === null || !DIRECTOR_MODEL.test(model)) return allow();

  return deniedByDefault ? denyDefault(toolName) : denyByPolicy(toolName);
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
