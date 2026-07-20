#!/usr/bin/env node
/**
 * Orchestra installer — stamps the Orchestra harness (agents, hooks, the
 * protocol, and bundled skills) into a target project.
 *
 *   node install.js [targetDir]                        install / update (idempotent)
 *   node install.js [targetDir] --specialists a[,b]    also install domain specialists
 *   node install.js [targetDir] --uninstall            remove cleanly
 *
 * targetDir defaults to the current working directory.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = __dirname;

// Harness version — single source of truth is the VERSION file at the master
// root. Stamped into each installed project's .claude/ORCHESTRA.md header so
// a project can always answer "what Orchestra version am I on".
const VERSION = (() => {
  try {
    const v = fs.readFileSync(path.join(SRC, 'VERSION'), 'utf8').trim();
    return /^\d+\.\d+\.\d+$/.test(v) ? v : '';
  } catch (_) {
    return '';
  }
})();

const AGENTS = ['scout.md', 'executor.md', 'reviewer.md', 'reviewer-codex.md', 'planner-gpt.md'];
const SPECIALISTS_DIR = path.join(SRC, 'agents', 'specialists');

function availableSpecialists() {
  if (!fs.existsSync(SPECIALISTS_DIR)) return [];
  return fs
    .readdirSync(SPECIALISTS_DIR)
    .filter((f) => f.endsWith('.md') && f !== '_TEMPLATE.md')
    .map((f) => f.slice(0, -3));
}

const SKILLS_DIR = path.join(SRC, 'skills');

// Bundled skills: every skills/<name>/ directory carrying a SKILL.md, minus
// underscore-prefixed ones (the authoring template). Always installed — they
// are part of the harness, not an opt-in like specialists.
function availableSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((d) => !d.startsWith('_'))
    .filter((d) => {
      const p = path.join(SKILLS_DIR, d);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'SKILL.md'));
    })
    .sort();
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
const GUARD = 'orchestra-guard.js';
const GUARD_MARK = 'orchestra-guard.js'; // identifies our hook entries in settings
const REVIEW_RUNNER = 'orchestra-review.js'; // cross-vendor review runner (driven by the reviewer-codex agent)
const ULTRAPLAN_RUNNER = 'orchestra-ultraplan.js'; // plan-roundabout runner (driven by the planner-gpt agent)
const BEGIN = '<!-- ORCHESTRA:BEGIN (managed by the Orchestra installer - do not edit between markers) -->';
const END = '<!-- ORCHESTRA:END -->';
const IMPORT_BLOCK = BEGIN + '\n@.claude/ORCHESTRA.md\n' + END;

// Settings-level permission grants for the executor's git workflow. Subagents
// cannot accept authorization relayed by the Director ("the user said push" in
// a work order is not a user turn in the subagent's transcript), so the
// permission classifier denies git commit/push unless the grant lives in
// settings. These rules make Director-ordered commits and pushes work.
const GIT_PERMISSIONS = [
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'Bash(git push:*)',
];

// Empty matcher = the hook fires on every main-session tool call; the guard
// script is the single source of truth for policy (including orchestra.json
// MCP patterns). Subagent tool calls never trigger project PreToolUse hooks.
const HOOK_ENTRY = {
  matcher: '',
  hooks: [
    {
      type: 'command',
      command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-guard.js"',
    },
  ],
};

// ---------------------------------------------------------------- helpers

const actions = [];
function did(msg) {
  actions.push(msg);
  console.log('  * ' + msg);
}

function fail(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (raw === '') return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(
      file +
        ' exists but is not valid JSON (' +
        e.message +
        '). Fix it first — refusing to overwrite it.'
    );
  }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function isOurHookEntry(entry) {
  return (
    entry &&
    Array.isArray(entry.hooks) &&
    entry.hooks.some(
      (h) => h && typeof h.command === 'string' && h.command.includes(GUARD_MARK)
    )
  );
}

function stripMarkerBlock(text) {
  const start = text.indexOf(BEGIN);
  // Tolerate older/edited BEGIN lines: fall back to any ORCHESTRA:BEGIN comment.
  const startLoose = start !== -1 ? start : text.indexOf('<!-- ORCHESTRA:BEGIN');
  if (startLoose === -1) return { text, found: false };
  const endIdx = text.indexOf(END, startLoose);
  if (endIdx === -1) return { text, found: false }; // unbalanced — leave alone
  const before = text.slice(0, startLoose).replace(/\n+$/, '\n\n');
  const after = text.slice(endIdx + END.length).replace(/^\n+/, '\n');
  return { text: (before + after).replace(/^\n+/, ''), found: true };
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
let uninstall = false;
let specialistsArg = '';
let dirArg = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--uninstall') uninstall = true;
  else if (a === '--specialists') specialistsArg = args[++i] || '';
  else if (a.startsWith('--specialists=')) specialistsArg = a.slice('--specialists='.length);
  else if (a.startsWith('--')) fail('Unknown flag: ' + a + ' (expected --uninstall or --specialists <names>)');
  else if (!dirArg) dirArg = a;
  else fail('Unexpected extra argument: ' + a);
}
const target = path.resolve(dirArg || process.cwd());

const specialists = specialistsArg
  ? specialistsArg.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
for (const s of specialists) {
  if (!availableSpecialists().includes(s)) {
    fail(
      'Unknown specialist: ' + s +
        (availableSpecialists().length
          ? '. Available: ' + availableSpecialists().join(', ')
          : '. No specialists exist in the master yet (see agents/specialists/_TEMPLATE.md).')
    );
  }
}

if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
  fail('Target directory does not exist: ' + target);
}
if (path.resolve(target) === path.resolve(SRC)) {
  fail('Refusing to install the Orchestra into its own master folder.');
}

const dotClaude = path.join(target, '.claude');
const agentsDir = path.join(dotClaude, 'agents');
const hooksDir = path.join(dotClaude, 'hooks');
const skillsDir = path.join(dotClaude, 'skills');
const settingsFile = path.join(dotClaude, 'settings.json');
const claudeMd = path.join(target, 'CLAUDE.md');
const orchestraMd = path.join(dotClaude, 'ORCHESTRA.md');
const pauseFile = path.join(dotClaude, 'orchestra.pause');

const vTag = VERSION ? ' v' + VERSION : '';
console.log(
  (uninstall ? 'Uninstalling Orchestra' + vTag + ' from: ' : 'Installing Orchestra' + vTag + ' into: ') + target
);

if (!uninstall) {
  // 1. Copy files.
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(hooksDir, { recursive: true });
  for (const a of AGENTS) {
    fs.copyFileSync(path.join(SRC, 'agents', a), path.join(agentsDir, a));
  }
  did('agents: ' + AGENTS.join(', ') + ' -> .claude/agents/');
  for (const s of specialists) {
    fs.copyFileSync(path.join(SPECIALISTS_DIR, s + '.md'), path.join(agentsDir, s + '.md'));
  }
  if (specialists.length) did('specialists: ' + specialists.join(', ') + ' -> .claude/agents/');
  const skills = availableSkills();
  for (const s of skills) {
    const dest = path.join(skillsDir, s);
    // Wholesale re-stamp: replace the whole directory so files removed from
    // the master don't linger in projects.
    fs.rmSync(dest, { recursive: true, force: true });
    copyDir(path.join(SKILLS_DIR, s), dest);
  }
  if (skills.length) did('skills: ' + skills.join(', ') + ' -> .claude/skills/');
  fs.copyFileSync(path.join(SRC, 'hooks', GUARD), path.join(hooksDir, GUARD));
  did('hook script -> .claude/hooks/' + GUARD);
  fs.copyFileSync(path.join(SRC, 'hooks', REVIEW_RUNNER), path.join(hooksDir, REVIEW_RUNNER));
  did('review runner -> .claude/hooks/' + REVIEW_RUNNER);
  fs.copyFileSync(path.join(SRC, 'hooks', ULTRAPLAN_RUNNER), path.join(hooksDir, ULTRAPLAN_RUNNER));
  did('ultra-plan runner -> .claude/hooks/' + ULTRAPLAN_RUNNER);
  let protocol = fs.readFileSync(path.join(SRC, 'ORCHESTRA.md'), 'utf8');
  if (VERSION) {
    protocol = protocol.replace(
      'Installed by the Orchestra harness.',
      'Installed by the Orchestra harness (v' + VERSION + ').'
    );
  }
  fs.writeFileSync(orchestraMd, protocol, 'utf8');
  did('protocol -> .claude/ORCHESTRA.md' + (VERSION ? ' (v' + VERSION + ')' : ''));

  // 2. Merge hook entry into settings.json (replace any stale Orchestra entries).
  const settings = readJson(settingsFile);
  if (typeof settings.hooks !== 'object' || settings.hooks === null) settings.hooks = {};
  const pre = Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
  const kept = pre.filter((e) => !isOurHookEntry(e));
  kept.push(HOOK_ENTRY);
  settings.hooks.PreToolUse = kept;

  // Merge git permission grants so the executor can commit/push when a work
  // order says to (relayed authorization is not enough — see GIT_PERMISSIONS).
  if (typeof settings.permissions !== 'object' || settings.permissions === null) {
    settings.permissions = {};
  }
  const allow = Array.isArray(settings.permissions.allow) ? settings.permissions.allow : [];
  const missingPerms = GIT_PERMISSIONS.filter((p) => !allow.includes(p));
  settings.permissions.allow = allow.concat(missingPerms);

  writeJson(settingsFile, settings);
  did(
    'PreToolUse guard merged into .claude/settings.json (' +
      (pre.length - kept.length + 1 > 1 ? 'replaced existing entry' : 'added') +
      ', other settings preserved)'
  );
  did(
    'git permissions for the executor (' +
      GIT_PERMISSIONS.join(', ') +
      ') ' +
      (missingPerms.length ? 'merged into' : 'already present in') +
      ' .claude/settings.json permissions.allow'
  );

  // 3. Ensure CLAUDE.md imports the protocol, inside managed markers.
  let md = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, 'utf8') : '';
  const stripped = stripMarkerBlock(md).text;
  const sep = stripped === '' ? '' : stripped.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(claudeMd, stripped + sep + IMPORT_BLOCK + '\n', 'utf8');
  did('CLAUDE.md: Orchestra import line ensured (marker block)');

  console.log('\nDone. Notes:');
  console.log(
    '  - First launch in this project will ask you to approve the project hook. Approve it once.'
  );
  console.log(
    '  - Pause anytime: create .claude/orchestra.pause (delete it to resume), or ORCHESTRA_PAUSE=1.'
  );
  console.log(
    '  - The Director may write plan files (.claude/plans/*.md) and memory files (CLAUDE.md /'
  );
  console.log(
    '    CLAUDE.local.md / auto-memory) itself; the CLAUDE.md marker block is protected, and'
  );
  console.log('    everything else stays delegated.');
  if (skills.length) {
    console.log(
      '  - Bundled skills installed: ' +
        skills.map((s) => '/' + s).join(', ') +
        ' (fresh sessions pick them up; see README "Bundled skills").'
    );
  }
  console.log('  - Update later by re-running this installer; remove with --uninstall.');
  const avail = availableSpecialists();
  if (avail.length && specialists.length === 0) {
    console.log(
      '  - Domain specialists available (not installed): ' +
        avail.join(', ') +
        ' — add with --specialists <name>.'
    );
  }
} else {
  // Uninstall: remove our files (core agents + any master-known specialists),
  // hook entries, and the CLAUDE.md marker block.
  const agentFiles = AGENTS.concat(availableSpecialists().map((s) => s + '.md'));
  for (const a of agentFiles) {
    const f = path.join(agentsDir, a);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed .claude/agents/' + a);
    }
  }
  for (const f of [path.join(hooksDir, GUARD), path.join(hooksDir, REVIEW_RUNNER), path.join(hooksDir, ULTRAPLAN_RUNNER), orchestraMd, pauseFile]) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed ' + path.relative(target, f).replace(/\\/g, '/'));
    }
  }

  // Bundled skills: remove master-known names only — skills the user authored
  // under other names are theirs, not ours.
  for (const s of availableSkills()) {
    const dir = path.join(skillsDir, s);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      did('removed .claude/skills/' + s + '/');
    }
  }
  try {
    if (fs.existsSync(skillsDir) && fs.readdirSync(skillsDir).length === 0) fs.rmdirSync(skillsDir);
  } catch (_) {
    /* leave a non-empty or busy skills dir alone */
  }

  if (fs.existsSync(settingsFile)) {
    const settings = readJson(settingsFile);
    let settingsChanged = false;
    if (settings.hooks && Array.isArray(settings.hooks.PreToolUse)) {
      const kept = settings.hooks.PreToolUse.filter((e) => !isOurHookEntry(e));
      if (kept.length !== settings.hooks.PreToolUse.length) {
        if (kept.length > 0) settings.hooks.PreToolUse = kept;
        else delete settings.hooks.PreToolUse;
        if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
        settingsChanged = true;
        did('removed guard entry from .claude/settings.json (other settings preserved)');
      }
    }
    if (settings.permissions && Array.isArray(settings.permissions.allow)) {
      const keptPerms = settings.permissions.allow.filter((p) => !GIT_PERMISSIONS.includes(p));
      if (keptPerms.length !== settings.permissions.allow.length) {
        if (keptPerms.length > 0) settings.permissions.allow = keptPerms;
        else delete settings.permissions.allow;
        if (Object.keys(settings.permissions).length === 0) delete settings.permissions;
        settingsChanged = true;
        did('removed Orchestra git permission grants from .claude/settings.json (re-add manually if you want them without the harness)');
      }
    }
    if (settingsChanged) writeJson(settingsFile, settings);
  }

  if (fs.existsSync(claudeMd)) {
    const md = fs.readFileSync(claudeMd, 'utf8');
    const res = stripMarkerBlock(md);
    if (res.found) {
      if (res.text.trim() === '') {
        fs.unlinkSync(claudeMd);
        did('CLAUDE.md contained only the Orchestra block — removed the file');
      } else {
        fs.writeFileSync(claudeMd, res.text, 'utf8');
        did('CLAUDE.md: Orchestra marker block removed');
      }
    }
  }

  const orchestraJson = path.join(dotClaude, 'orchestra.json');
  if (fs.existsSync(orchestraJson)) {
    console.log('  ! left in place (user-authored): .claude/orchestra.json — delete it yourself if unwanted');
  }

  if (actions.length === 0) console.log('  (nothing to remove — Orchestra was not installed here)');
  else console.log('\nDone. The project is back to a standard Claude Code setup.');
}
