#!/usr/bin/env node
/**
 * Orchestra installer (Codex-native) — stamps the Codex-as-Director half of
 * the harness (agents, guard hook, protocol, and Codex CLI wiring) into a
 * target project's .codex/ directory and root AGENTS.md.
 *
 *   node install-codex.js [targetDir]                        install / update (idempotent)
 *   node install-codex.js [targetDir] --packs a[,b]          also install optional packs
 *   node install-codex.js [targetDir] --no-packs             install with no packs
 *   node install-codex.js [targetDir] --uninstall            remove cleanly
 *
 * targetDir defaults to the current working directory.
 *
 * This is the Codex-side counterpart to install.js (the Claude-side
 * installer). The two never touch each other's files: install.js owns
 * .claude/ + CLAUDE.md, this script owns .codex/ + AGENTS.md. A project may
 * run either, both, or neither — running both makes the same repository
 * dual-drivable, with Claude Code and Codex CLI each able to act as the
 * Director under their own copy of the protocol.
 *
 * Packs (codex/packs/<name>/) are OPTIONAL modules — agents and hook runners
 * that share a dependency the core harness does not have (e.g. the `claude`
 * pack's Anthropic surface). Nothing in codex/packs/ installs unless named.
 * The pack selection is recorded in .codex/orchestra-install.json so a later
 * plain `node install-codex.js` refreshes exactly that selection instead of
 * silently dropping it; pass --packs again to change it.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const CODEX_SRC = path.join(SRC, 'codex');
const PACKS_DIR = path.join(CODEX_SRC, 'packs');

// Harness version — shared single source of truth with install.js: the
// VERSION file at the master root. Stamped into .codex/ORCHESTRA.md exactly
// like the Claude-side .claude/ORCHESTRA.md, so a project can always answer
// "what Orchestra version am I on" regardless of which installer it ran.
const VERSION = (() => {
  try {
    const v = fs.readFileSync(path.join(SRC, 'VERSION'), 'utf8').trim();
    return /^\d+\.\d+\.\d+$/.test(v) ? v : '';
  } catch (_) {
    return '';
  }
})();

// The core company — always installed. The optional cross-vendor roles live
// in codex/packs/, not here.
const AGENTS = ['scout.toml', 'detective.toml', 'executor.toml', 'reviewer.toml'];
const GUARD = 'orchestra-guard.js';
const GUARD_MARK = 'orchestra-guard.js'; // identifies our hooks.json entries
const STATE_FILE = 'orchestra-install.json'; // records the pack selection
const BEGIN =
  '<!-- ORCHESTRA:BEGIN (managed Codex Orchestra protocol - keep synchronized with .codex/ORCHESTRA.md) -->';
const END = '<!-- ORCHESTRA:END -->';

// hooks.json entries. Matchers mirror Codex's own event-filter syntax, not
// Claude Code's settings.json shape — the two hook systems are unrelated.
const SESSION_START_ENTRY = {
  matcher: 'startup|resume|clear|compact',
  hooks: [
    {
      type: 'command',
      command: 'node "$(git rev-parse --show-toplevel)/.codex/hooks/orchestra-guard.js"',
      commandWindows: 'node .codex/hooks/orchestra-guard.js',
      timeout: 30,
      statusMessage: 'Loading Orchestra protocol',
    },
  ],
};
const PRE_TOOL_USE_ENTRY = {
  matcher: '.*',
  hooks: [
    {
      type: 'command',
      command: 'node "$(git rev-parse --show-toplevel)/.codex/hooks/orchestra-guard.js"',
      commandWindows: 'node .codex/hooks/orchestra-guard.js',
      timeout: 30,
      statusMessage: 'Checking Orchestra Director policy',
    },
  ],
};

function availablePacks() {
  if (!fs.existsSync(PACKS_DIR)) return [];
  return fs
    .readdirSync(PACKS_DIR)
    .filter((d) => !d.startsWith('_'))
    .filter((d) => {
      const p = path.join(PACKS_DIR, d);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'pack.json'));
    })
    .sort();
}

function packManifest(name) {
  const file = path.join(PACKS_DIR, name, 'pack.json');
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail('pack "' + name + '" has an unreadable pack.json (' + e.message + ')');
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    fail('pack "' + name + '" has a pack.json that is not a JSON object');
  }
  if (cfg.name !== name) {
    fail(
      'pack "' + name + '" declares name "' + cfg.name + '" in pack.json — it must ' +
        'match the directory name'
    );
  }
  return cfg;
}

// What a pack owns, discovered by walking its directories — pack.json never
// lists files, so the master is always the single source of truth for what
// gets stamped and, on --uninstall, what gets removed.
function packContents(name) {
  const root = path.join(PACKS_DIR, name);
  const filesIn = (sub, ext) => {
    const dir = path.join(root, sub);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(ext) && fs.statSync(path.join(dir, f)).isFile())
      .sort();
  };
  return {
    agents: filesIn('agents', '.toml'),
    hooks: filesIn('hooks', '.js'),
  };
}

// Pack files land in .codex/agents/ and .codex/hooks/, so a colliding name
// would overwrite a core part. Refuse rather than clobber.
function assertNoCollisions(names) {
  const seen = { agents: new Map(), hooks: new Map() };
  for (const a of AGENTS) seen.agents.set(a, 'the core harness');
  seen.hooks.set(GUARD, 'the core harness');

  for (const name of names) {
    const contents = packContents(name);
    for (const kind of ['agents', 'hooks']) {
      for (const item of contents[kind]) {
        const owner = seen[kind].get(item);
        if (owner) {
          fail(
            'pack "' + name + '" would overwrite ' + kind + '/' + item + ' owned by ' +
              owner + '. Rename it in the master before installing.'
          );
        }
        seen[kind].set(item, 'pack "' + name + '"');
      }
    }
  }
}

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

function stringList(value) {
  return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [];
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

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
let uninstall = false;
let packsArg = null; // null = not given (inherit the recorded selection)
let dirArg = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--uninstall') uninstall = true;
  else if (a === '--packs') packsArg = args[++i] || '';
  else if (a.startsWith('--packs=')) packsArg = a.slice('--packs='.length);
  else if (a === '--no-packs') packsArg = '';
  else if (a.startsWith('--')) {
    fail('Unknown flag: ' + a + ' (expected --uninstall, --packs <names>, or --no-packs)');
  } else if (!dirArg) dirArg = a;
  else fail('Unexpected extra argument: ' + a);
}
const target = path.resolve(dirArg || process.cwd());

if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
  fail('Target directory does not exist: ' + target);
}
if (path.resolve(target) === path.resolve(SRC)) {
  fail('Refusing to install the Orchestra into its own master folder.');
}

const dotCodex = path.join(target, '.codex');
const agentsDir = path.join(dotCodex, 'agents');
const hooksDir = path.join(dotCodex, 'hooks');
const hooksJsonFile = path.join(dotCodex, 'hooks.json');
const configTomlFile = path.join(dotCodex, 'config.toml');
const stateFile = path.join(dotCodex, STATE_FILE);
const orchestraMd = path.join(dotCodex, 'ORCHESTRA.md');
const pauseFile = path.join(dotCodex, 'orchestra.pause');
const agentsMd = path.join(target, 'AGENTS.md');

// What the last install selected. Lets a plain re-run refresh the same packs
// instead of silently leaving them stale or dropping them.
const priorState = readJson(stateFile);
const priorPacks = stringList(priorState.packs);

// Explicit flag wins; otherwise inherit the recorded selection.
const packs = packsArg === null ? priorPacks : parseList(packsArg);

for (const p of packs) {
  if (!availablePacks().includes(p)) {
    fail(
      'Unknown pack: ' + p +
        (availablePacks().length
          ? '. Available: ' + availablePacks().join(', ')
          : '. No packs exist in the master yet (see codex/packs/_TEMPLATE/).')
    );
  }
}
if (!uninstall) {
  packs.forEach(packManifest); // validate manifests before touching anything
  assertNoCollisions(packs);
}

const vTag = VERSION ? ' v' + VERSION : '';
console.log(
  (uninstall
    ? 'Uninstalling Orchestra (Codex-native)' + vTag + ' from: '
    : 'Installing Orchestra (Codex-native)' + vTag + ' into: ') + target
);

if (!uninstall) {
  // 1. Copy files.
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(hooksDir, { recursive: true });
  for (const a of AGENTS) {
    fs.copyFileSync(path.join(CODEX_SRC, 'agents', a), path.join(agentsDir, a));
  }
  did('agents: ' + AGENTS.join(', ') + ' -> .codex/agents/');
  fs.copyFileSync(path.join(CODEX_SRC, 'hooks', GUARD), path.join(hooksDir, GUARD));
  did('hook script -> .codex/hooks/' + GUARD);

  // 1b. Packs — opt-in modules. Deselected packs from a previous install are
  // removed first, so `--no-packs` (or dropping a name) actually takes effect.
  for (const name of priorPacks.filter((p) => !packs.includes(p))) {
    if (!availablePacks().includes(name)) continue; // unknown to this master — leave it
    const c = packContents(name);
    let removed = 0;
    for (const f of c.agents) {
      const p = path.join(agentsDir, f);
      if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
    }
    for (const f of c.hooks) {
      const p = path.join(hooksDir, f);
      if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
    }
    if (removed) did('pack "' + name + '" deselected — removed its ' + removed + ' installed item(s)');
  }
  for (const name of packs) {
    const root = path.join(PACKS_DIR, name);
    const c = packContents(name);
    for (const f of c.agents) {
      fs.copyFileSync(path.join(root, 'agents', f), path.join(agentsDir, f));
    }
    for (const f of c.hooks) {
      fs.copyFileSync(path.join(root, 'hooks', f), path.join(hooksDir, f));
    }
    const parts = [];
    if (c.agents.length) parts.push(c.agents.length + ' agent(s)');
    if (c.hooks.length) parts.push(c.hooks.length + ' hook(s)');
    did('pack "' + name + '": ' + (parts.join(', ') || 'nothing to copy') + ' -> .codex/');
  }

  // 2. Protocol doc, version-stamped exactly like the Claude-side installer.
  let protocol = fs.readFileSync(path.join(CODEX_SRC, 'ORCHESTRA.md'), 'utf8');
  if (VERSION) {
    protocol = protocol.replace(
      'Installed by the Orchestra harness.',
      'Installed by the Orchestra harness (v' + VERSION + ').'
    );
  }
  fs.writeFileSync(orchestraMd, protocol, 'utf8');
  did('protocol -> .codex/ORCHESTRA.md' + (VERSION ? ' (v' + VERSION + ')' : ''));

  // 3. config.toml — a scaffold, not a managed file. Codex CLI's own config
  // surface may carry project settings this harness knows nothing about, and
  // there is no safe generic TOML merge available here, so this is written
  // ONCE on first install and never touched again on update.
  if (!fs.existsSync(configTomlFile)) {
    fs.copyFileSync(path.join(CODEX_SRC, 'config.toml'), configTomlFile);
    did('config.toml -> .codex/config.toml (first install only — hand-edit freely; re-runs never touch it)');
  } else {
    did('.codex/config.toml already exists — left untouched (see codex/config.toml in the master for recommended defaults)');
  }

  // 4. hooks.json — this genuinely IS Codex's own per-project hook config
  // surface, so merge rather than overwrite: replace only the SessionStart/
  // PreToolUse entries this installer owns, preserving anything else a
  // project added (other events, other commands).
  const hooksConfig = readJson(hooksJsonFile);
  if (!hooksConfig.description) {
    hooksConfig.description = 'Codex-native Orchestra Director guard.';
  }
  if (typeof hooksConfig.hooks !== 'object' || hooksConfig.hooks === null) {
    hooksConfig.hooks = {};
  }
  const priorEntryCount =
    (Array.isArray(hooksConfig.hooks.SessionStart) ? hooksConfig.hooks.SessionStart.length : 0) +
    (Array.isArray(hooksConfig.hooks.PreToolUse) ? hooksConfig.hooks.PreToolUse.length : 0);
  const keptStart = (Array.isArray(hooksConfig.hooks.SessionStart) ? hooksConfig.hooks.SessionStart : [])
    .filter((e) => !isOurHookEntry(e));
  keptStart.push(SESSION_START_ENTRY);
  hooksConfig.hooks.SessionStart = keptStart;
  const keptPre = (Array.isArray(hooksConfig.hooks.PreToolUse) ? hooksConfig.hooks.PreToolUse : [])
    .filter((e) => !isOurHookEntry(e));
  keptPre.push(PRE_TOOL_USE_ENTRY);
  hooksConfig.hooks.PreToolUse = keptPre;
  writeJson(hooksJsonFile, hooksConfig);
  did(
    'SessionStart + PreToolUse guard entries merged into .codex/hooks.json (' +
      (priorEntryCount > 0 ? 'replaced existing entries' : 'added') +
      ', other settings preserved)'
  );

  // 5. Ensure AGENTS.md carries the protocol. Codex does not expand
  // Claude-style @import lines, so the full text is embedded (not a pointer)
  // inside the same managed markers CLAUDE.md uses on the Claude side.
  let md = fs.existsSync(agentsMd) ? fs.readFileSync(agentsMd, 'utf8') : '';
  const stripped = stripMarkerBlock(md).text;
  const sep = stripped === '' ? '' : stripped.endsWith('\n') ? '\n' : '\n\n';
  const block = BEGIN + '\n' + protocol.replace(/\n+$/, '') + '\n\n' + END;
  fs.writeFileSync(agentsMd, stripped + sep + block + '\n', 'utf8');
  did('AGENTS.md: Orchestra protocol block ensured (marker block, full text embed)');

  // 6. Record the selection so a later plain re-run refreshes the same set.
  writeJson(stateFile, {
    version: VERSION || null,
    packs: packs.slice().sort(),
  });
  did('selection recorded in .codex/' + STATE_FILE + ' (re-runs keep it; change it with --packs)');

  console.log('\nDone. Notes:');
  console.log('  - Codex CLI will ask you to trust project hooks on first launch. Approve them once.');
  console.log(
    '  - Pause anytime: create .codex/orchestra.pause (delete it to resume), or ORCHESTRA_PAUSE=1.'
  );
  console.log(
    '  - The Director may write plan files (.codex/plans/*.md) itself; everything else stays delegated.'
  );
  for (const name of packs) {
    const m = packManifest(name);
    console.log('  - Pack "' + name + '"' + (m.title ? ' — ' + m.title : '') + ':');
    for (const n of stringList(m.notes)) console.log('      ' + n);
    const req = (m.requires && typeof m.requires === 'object') ? m.requires : {};
    for (const b of stringList(req.bin)) console.log('      needs executable: ' + b);
    for (const e of stringList(req.env)) console.log('      needs env: ' + e);
  }
  console.log('  - Update later by re-running this installer; remove with --uninstall.');
  const availPacks = availablePacks().filter((p) => !packs.includes(p));
  if (availPacks.length) {
    console.log(
      '  - Optional packs available (not installed): ' +
        availPacks.join(', ') +
        ' — add with --packs <name> (see codex/packs/README.md).'
    );
  }
  console.log(
    '  - This is the Codex-native half of the harness. For Claude Code as Director in the ' +
      'same project, run install.js separately — the two never share files.'
  );
} else {
  // Uninstall: remove our files (core agents and every master-known pack's
  // files), hooks.json entries, and the AGENTS.md marker block. Packs are
  // removed whether or not the state file records them — master knowledge is
  // what makes removal safe.
  const packAgents = [];
  const packHooks = [];
  for (const name of availablePacks()) {
    const c = packContents(name);
    packAgents.push(...c.agents);
    packHooks.push(...c.hooks);
  }

  const agentFiles = AGENTS.concat(packAgents);
  for (const a of agentFiles) {
    const f = path.join(agentsDir, a);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed .codex/agents/' + a);
    }
  }
  const hookFiles = [GUARD].concat(packHooks).map((h) => path.join(hooksDir, h));
  for (const f of hookFiles.concat([orchestraMd, pauseFile, stateFile])) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed ' + path.relative(target, f).replace(/\\/g, '/'));
    }
  }

  if (fs.existsSync(hooksJsonFile)) {
    const hooksConfig = readJson(hooksJsonFile);
    let changed = false;
    if (hooksConfig.hooks && typeof hooksConfig.hooks === 'object') {
      for (const key of ['SessionStart', 'PreToolUse']) {
        if (!Array.isArray(hooksConfig.hooks[key])) continue;
        const kept = hooksConfig.hooks[key].filter((e) => !isOurHookEntry(e));
        if (kept.length !== hooksConfig.hooks[key].length) {
          if (kept.length > 0) hooksConfig.hooks[key] = kept;
          else delete hooksConfig.hooks[key];
          changed = true;
        }
      }
      if (changed && Object.keys(hooksConfig.hooks).length === 0) delete hooksConfig.hooks;
    }
    if (changed) {
      writeJson(hooksJsonFile, hooksConfig);
      did('removed guard entries from .codex/hooks.json (other settings preserved)');
    }
  }

  if (fs.existsSync(agentsMd)) {
    const md = fs.readFileSync(agentsMd, 'utf8');
    const res = stripMarkerBlock(md);
    if (res.found) {
      if (res.text.trim() === '') {
        fs.unlinkSync(agentsMd);
        did('AGENTS.md contained only the Orchestra block — removed the file');
      } else {
        fs.writeFileSync(agentsMd, res.text, 'utf8');
        did('AGENTS.md: Orchestra marker block removed');
      }
    }
  }

  if (fs.existsSync(configTomlFile)) {
    console.log('  ! left in place (your project config): .codex/config.toml — delete it yourself if unwanted');
  }
  const codexOrchestraJson = path.join(dotCodex, 'orchestra.json');
  if (fs.existsSync(codexOrchestraJson)) {
    console.log('  ! left in place (user-authored): .codex/orchestra.json — delete it yourself if unwanted');
  }

  if (actions.length === 0) console.log('  (nothing to remove — Orchestra (Codex-native) was not installed here)');
  else console.log('\nDone. The project is back to a standard Codex CLI setup.');
}
