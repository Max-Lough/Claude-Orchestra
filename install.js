#!/usr/bin/env node
/**
 * Orchestra installer — stamps the Orchestra harness (agents, hooks, the
 * protocol, and bundled skills) into a target project.
 *
 *   node install.js [targetDir]                        install / update (idempotent)
 *   node install.js [targetDir] --packs a[,b]          also install optional packs
 *   node install.js [targetDir] --no-packs             install with no packs
 *   node install.js [targetDir] --specialists a[,b]    also install domain specialists
 *   node install.js [targetDir] --uninstall            remove cleanly
 *   node install.js --scan <dir> [--depth n]           report which installs are behind
 *   node install.js --scan <dir> --update              ...and bring the stale ones up
 *   node install.js --lint [dir]                       frontmatter lint only (CI /
 *                                                      contributors; dir defaults to
 *                                                      this master)
 *
 * targetDir defaults to the current working directory.
 *
 * Packs (packs/<name>/) are OPTIONAL modules — agents, hook runners, and
 * skills that share a dependency the core harness does not have (e.g. the
 * `codex` pack's OpenAI surface). Nothing in packs/ installs unless named.
 * Both packs and specialists are recorded in .claude/orchestra-install.json so
 * a later plain `node install.js` refreshes exactly the same selection instead
 * of silently dropping it; pass the flags again to change the selection.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

// The core company — always installed. Optional roles (the cross-vendor
// reviewer and planner) live in packs/, not here.
const AGENTS = [
  'scout.md',
  'detective.md',
  'executor.md',
  'executor-heavy.md',
  'executor-heavy-xhigh.md',
  'reviewer.md',
];
const SPECIALISTS_DIR = path.join(SRC, 'agents', 'specialists');
const SKILLS_DIR = path.join(SRC, 'skills');
const PACKS_DIR = path.join(SRC, 'packs');

function availableSpecialists() {
  if (!fs.existsSync(SPECIALISTS_DIR)) return [];
  return fs
    .readdirSync(SPECIALISTS_DIR)
    .filter((f) => f.endsWith('.md') && f !== '_TEMPLATE.md')
    .map((f) => f.slice(0, -3));
}

// Bundled skills: every skills/<name>/ directory carrying a SKILL.md, minus
// underscore-prefixed ones (the authoring template). Always installed — they
// are part of the harness, not an opt-in like specialists or packs.
function availableSkills() {
  return skillDirsIn(SKILLS_DIR);
}

function skillDirsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => !d.startsWith('_'))
    .filter((d) => {
      const p = path.join(dir, d);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'SKILL.md'));
    })
    .sort();
}

// -------------------------------------------------------- frontmatter lint
//
// Claude Code loads agents, skills, and commands from .md files whose YAML
// frontmatter it parses. Two facts make one bad value catastrophic rather
// than merely wrong (both verified against the shipped binary, 2026-08):
//
//   1. A frontmatter block that fails to parse is dropped SILENTLY — no log,
//      no telemetry: the parse failure yields an empty frontmatter object and
//      the missing-name path returns null before any logging runs. The agent
//      simply never registers, in any session.
//   2. Claude Code has a repair pass that quotes YAML-unsafe values and
//      reparses — but its line regex cannot match lines with a trailing CR,
//      so a CRLF worktree (Windows autocrlf, no .gitattributes) defeats it.
//      The same file loads on LF platforms and vanishes on CRLF ones.
//
// That combination shipped three codex-pack agents whose descriptions carried
// an unquoted "launcher: it runs" (a bare ": " makes the whole block
// unparseable) and cost a field project days of misdirected diagnosis before
// 4ed7a03 reworded them. This lint makes the class unshippable: the installer
// refuses to stamp any .md whose frontmatter fails a strict parse of the YAML
// block-mapping subset frontmatter actually uses, and warns about values that
// parse only lossily or lean on the repair pass. `node install.js --lint`
// runs the identical check standalone, for CI and contributors.

// The character class Claude Code's repair pass triggers on. A plain scalar
// containing one of these may parse today, but it is one edit away from
// needing the repair pass — which CRLF defeats.
const REPAIR_TRIGGER_CHARS = /[{}\[\]*&#!|>%@`]/;

function extractFrontmatterBlock(text) {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const crlf = /\r/.test(t);
  const lines = t.split(/\r\n|\r|\n/);
  if (!/^---\s*$/.test(lines[0] || '')) return { present: false, crlf };
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      return { present: true, crlf, lines: lines.slice(1, i) };
    }
  }
  return { present: true, crlf, unterminated: true, lines: lines.slice(1) };
}

// One scalar value, judged the way a strict YAML parser judges it. Returns
// { kind, error, warning } — kind drives how following lines are read
// ('block' consumes an indented block; 'open' expects nested structure).
function judgeScalar(v) {
  const value = v.trim();
  if (value === '') return { kind: 'open' };
  if (value[0] === '"') {
    return /^"(?:[^"\\]|\\.)*"(?:\s+#.*)?$/.test(value)
      ? { kind: 'closed' }
      : { kind: 'closed', error: 'unterminated or malformed double-quoted value' };
  }
  if (value[0] === "'") {
    return /^'(?:[^']|'')*'(?:\s+#.*)?$/.test(value)
      ? { kind: 'closed' }
      : { kind: 'closed', error: 'unterminated or malformed single-quoted value' };
  }
  if (value[0] === '|' || value[0] === '>') {
    return /^[|>][+-]?\d*\s*(#.*)?$/.test(value)
      ? { kind: 'block' }
      : { kind: 'block', error: 'malformed block-scalar header ("' + value + '")' };
  }
  if (value[0] === '[' || value[0] === '{') {
    let depth = 0;
    let inStr = '';
    for (const c of value) {
      if (inStr) {
        if (c === inStr) inStr = '';
        continue;
      }
      if (c === '"' || c === "'") inStr = c;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
    }
    return depth === 0 && !inStr
      ? { kind: 'closed' }
      : { kind: 'closed', error: 'flow collection does not close on its line — quote it or use block style' };
  }
  // Plain scalar. The hard errors are exactly what makes a real parser reject
  // the whole block; the warnings are what parses but loses text or leans on
  // the repair pass.
  if (/^[*&!%@`]/.test(value)) {
    return {
      kind: 'closed',
      error:
        'unquoted value begins with the YAML indicator character "' + value[0] +
        '" — the whole frontmatter fails to parse. Quote the value.',
    };
  }
  if (/^\?(\s|$)/.test(value) || /^-\s/.test(value) || value === '-') {
    return {
      kind: 'closed',
      error:
        'unquoted value begins with "' + value.slice(0, 2).trim() +
        '" (a YAML structure indicator) — quote the value.',
    };
  }
  if (/: /.test(value) || /:$/.test(value)) {
    return {
      kind: 'closed',
      error:
        'unquoted value contains ": " (or ends with ":") — a plain YAML scalar cannot, ' +
        'so the WHOLE frontmatter fails to parse and Claude Code drops the file ' +
        'silently. Quote the value, or reword (e.g. "launcher: it runs" → ' +
        '"launcher that runs").',
    };
  }
  if (/\s#/.test(value)) {
    return {
      kind: 'closed',
      warning:
        'everything from " #" onward parses as a YAML comment and is silently ' +
        'dropped from the value — quote the value to keep it.',
    };
  }
  const trig = REPAIR_TRIGGER_CHARS.exec(value);
  if (trig) {
    return {
      kind: 'closed',
      warning:
        'unquoted value contains "' + trig[0] + '" — parseable today, but in the ' +
        'class Claude Code\'s frontmatter repair pass exists for, and that pass is ' +
        'defeated by CRLF checkouts. Quote the value so it never needs repair.',
    };
  }
  return { kind: 'closed' };
}

// Lint one .md file's frontmatter. opts.required: the file only functions if
// Claude Code can load it (agents, specialists, SKILL.md), so absent or
// unterminated frontmatter and a missing `name` are errors, not shrugs.
// Returns { present, errors, warnings } with 1-based file line numbers.
function lintFrontmatterText(text, opts) {
  const required = !!(opts && opts.required);
  const errors = [];
  const warnings = [];
  const fm = extractFrontmatterBlock(text);
  if (!fm.present) {
    if (required) {
      errors.push({
        line: 1,
        text: (text.split(/\r\n|\r|\n/)[0] || '').slice(0, 120),
        msg: 'no frontmatter block — Claude Code cannot load this file without one (it must begin with "---")',
      });
    }
    return { present: false, errors, warnings };
  }
  if (fm.crlf) {
    warnings.push({
      line: 1,
      text: '---',
      msg:
        'CRLF line endings — Claude Code\'s frontmatter repair pass cannot match ' +
        'lines with a trailing CR. The installer stamps LF copies, but keep the ' +
        'source LF too (.gitattributes: *.md text eol=lf).',
    });
  }
  if (fm.unterminated) {
    errors.push({
      line: 1,
      text: '---',
      msg: 'frontmatter never closes — no terminating "---" line; the whole file fails to load',
    });
    return { present: true, errors, warnings };
  }

  const err = (j, text, msg) => errors.push({ line: j + 2, text: text.slice(0, 120), msg });
  const warn = (j, text, msg) => warnings.push({ line: j + 2, text: text.slice(0, 120), msg });

  const topKeys = new Set();
  let nameValue = '';
  let blockIndent = -1; // consuming a |/> block while indent exceeds this
  let lastKind = '';
  let lastIndent = -1;

  for (let j = 0; j < fm.lines.length; j++) {
    const raw = fm.lines[j];
    if (!raw.trim()) continue;
    const lead = /^[ \t]*/.exec(raw)[0];
    const indent = lead.length;
    if (blockIndent >= 0) {
      if (indent > blockIndent) continue; // block-scalar content, opaque by design
      blockIndent = -1;
    }
    if (lead.includes('\t')) {
      err(j, raw, 'tab in indentation — YAML forbids tabs; use spaces');
      continue;
    }
    let rest = raw.slice(indent);
    if (rest.startsWith('#')) continue;

    let isSeqItem = false;
    if (/^-\s/.test(rest) || rest === '-') {
      isSeqItem = true;
      rest = rest.replace(/^-\s*/, '');
      if (rest === '') continue; // "-" alone: nested structure follows
    }

    const km = /^([^:#]+?):(?:\s(.*))?$/.exec(rest);
    if (km && !/\s$/.test(km[1])) {
      const key = km[1];
      const value = km[2] == null ? '' : km[2];
      if (!isSeqItem && indent === 0) {
        if (topKeys.has(key)) err(j, raw, 'duplicate key "' + key + '"');
        topKeys.add(key);
        if (key === 'name') nameValue = value.trim();
      }
      const judged = judgeScalar(value);
      if (judged.error) err(j, raw, key + ': ' + judged.error);
      if (judged.warning) warn(j, raw, key + ': ' + judged.warning);
      if (judged.kind === 'block') blockIndent = indent;
      lastKind = judged.kind;
      lastIndent = indent;
      continue;
    }

    if (isSeqItem) {
      const judged = judgeScalar(rest);
      if (judged.error) err(j, raw, 'sequence item: ' + judged.error);
      if (judged.warning) warn(j, raw, 'sequence item: ' + judged.warning);
      if (judged.kind === 'block') blockIndent = indent;
      lastKind = judged.kind;
      lastIndent = indent;
      continue;
    }

    if (indent > lastIndent && lastKind === 'closed') {
      // A more-indented bare line after a scalar is a plain-scalar
      // continuation — legal, but the continuation must obey scalar rules.
      const judged = judgeScalar(rest);
      if (judged.error) err(j, raw, 'scalar continuation: ' + judged.error);
      if (judged.warning) warn(j, raw, 'scalar continuation: ' + judged.warning);
      continue;
    }
    if (indent > lastIndent && lastKind === 'open') continue; // nested block — keys checked above when they match
    err(j, raw, 'not a "key: value" line, a "- item", or a valid continuation — the frontmatter fails to parse');
  }

  if (required && !nameValue) {
    errors.push({
      line: 1,
      text: '---',
      msg:
        'no top-level "name:" with a value — Claude Code drops a frontmatter ' +
        'without a name (silently), so this file would never register',
    });
  }
  return { present: true, errors, warnings };
}

// Is Claude Code's ability to LOAD this file the whole point of the file?
// Agents, specialists, and SKILL.md files: yes. Reference .md beside a skill
// or plain docs: only if they carry frontmatter at all.
function frontmatterRequired(file) {
  const norm = file.replace(/\\/g, '/');
  const base = path.basename(norm);
  if (base === 'SKILL.md') return true;
  const parent = path.basename(path.dirname(norm));
  return (parent === 'agents' || parent === 'specialists') && !base.startsWith('_');
}

function lintFile(file, required) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return { errors: [{ line: 1, text: '', msg: 'unreadable (' + e.message + ')' }], warnings: [] };
  }
  return lintFrontmatterText(text, { required });
}

// Lint a set of {file, required} entries and print findings. Returns
// { errors, warnings } as counts; the caller decides what is fatal.
function runLint(targets, baseDir) {
  let nErrors = 0;
  let nWarnings = 0;
  let checked = 0;
  for (const t of targets) {
    const res = lintFile(t.file, t.required);
    if (!res.present && !res.errors.length) continue;
    checked++;
    const rel = path.relative(baseDir, t.file).replace(/\\/g, '/') || t.file;
    for (const e of res.errors) {
      nErrors++;
      console.error('  ERROR ' + rel + ':' + e.line + ' — ' + e.msg);
      if (e.text) console.error('        > ' + e.text);
    }
    for (const w of res.warnings) {
      nWarnings++;
      console.error('  WARN  ' + rel + ':' + w.line + ' — ' + w.msg);
      if (w.text) console.error('        > ' + w.text);
    }
  }
  return { errors: nErrors, warnings: nWarnings, checked };
}

// Every .md under root that the lint should see — skipping VCS/build debris
// and underscore-prefixed templates, which are never installed and carry
// <slot> placeholders no YAML parser should be asked to like.
function collectLintables(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('_') || e.name === '.git') continue;
      if (SCAN_SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push({ file: p, required: frontmatterRequired(p) });
    }
  };
  walk(root);
  return out;
}

// ------------------------------------------------------------------- packs

// A pack is packs/<name>/ with a pack.json. Underscore-prefixed directories
// (the authoring template) are never installable.
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
    agents: filesIn('agents', '.md'),
    hooks: filesIn('hooks', '.js'),
    skills: skillDirsIn(path.join(root, 'skills')),
  };
}

// Pack files land in the same .claude/ directories as the core harness, so a
// colliding name would overwrite a core part. Refuse rather than clobber.
function assertNoCollisions(names) {
  const coreHooks = [GUARD];
  const coreSkills = availableSkills();
  const seen = { agents: new Map(), hooks: new Map(), skills: new Map() };
  for (const a of AGENTS) seen.agents.set(a, 'the core harness');
  for (const h of coreHooks) seen.hooks.set(h, 'the core harness');
  for (const s of coreSkills) seen.skills.set(s, 'the core harness');
  for (const s of availableSpecialists()) seen.agents.set(s + '.md', 'a specialist');

  for (const name of names) {
    const contents = packContents(name);
    for (const kind of ['agents', 'hooks', 'skills']) {
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

// Markdown is stamped LF regardless of how this master checkout is encoded.
// Claude Code's frontmatter repair pass cannot match CRLF lines (see the
// frontmatter-lint comment above), so normalizing at copy time removes the
// installed files' dependence on the machine's autocrlf setting outright.
function copyFileStamped(src, dest) {
  if (src.endsWith('.md')) {
    fs.writeFileSync(dest, fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
    return;
  }
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else copyFileStamped(s, d);
  }
}
const GUARD = 'orchestra-guard.js';
const GUARD_MARK = 'orchestra-guard.js'; // identifies our hook entries in settings
const STATE_FILE = 'orchestra-install.json'; // records the pack/specialist selection
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

function readJsonSafe(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return {};
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (_) {
    // A scan reads many projects and must not die on one bad file: an
    // unreadable record simply means "version unknown" for that row.
    return {};
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

// ------------------------------------------------------------------ scan
//
// Updating ONE project has always been easy: `node install.js <project>`, no
// flags, idempotent, and it re-reads orchestra-install.json so the project's
// own pack and specialist selection survives. What was missing is knowing
// WHICH projects need it. Nothing recorded where the installs are, so the
// documented upgrade path was "run `head -3 .claude/ORCHESTRA.md` in each
// project you remember harnessing, compare it against the master's VERSION by
// eye, and re-run the installer" — a manual diff across an unknown set.
//
// That gap has teeth: v1.5.0 fixed a Codex helper that had left the review
// lane silently dead for six days. A project still on 1.4.1 carries that bug
// and has no way to find out except by hitting it. `--scan` answers "which of
// my projects are behind?" in one command, and `--update` acts on the answer.

// Ordered comparison of two dotted versions. Returns <0, 0, or >0. A missing
// or unparseable version sorts oldest — an install stamped before versioning
// existed IS older than every released version, which is exactly the answer a
// scan should give rather than an error.
function compareVersions(a, b) {
  const parse = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

// What version is installed in a project, and what does it carry?
//
// Two sources, in order: orchestra-install.json (written since packs existed,
// and machine-readable) and the version stamped into the ORCHESTRA.md header.
// Older installs have only the header; the oldest have neither, and report as
// unversioned rather than as a failure to read.
function readInstall(projectDir) {
  const dot = path.join(projectDir, '.claude');
  const state = readJsonSafe(path.join(dot, STATE_FILE));
  let version = typeof state.version === 'string' ? state.version.trim() : '';
  if (!version) {
    try {
      const head = fs.readFileSync(path.join(dot, 'ORCHESTRA.md'), 'utf8').slice(0, 2048);
      const m = /Installed by the Orchestra harness \(v(\d+\.\d+\.\d+)\)/.exec(head);
      if (m) version = m[1];
    } catch (_) {
      /* no header to read — stays unversioned */
    }
  }
  return {
    dir: projectDir,
    version,
    packs: stringList(state.packs),
    specialists: stringList(state.specialists),
    // Whether the selection is RECORDED, not whether it is empty: a pre-packs
    // install has no record, so a plain re-run cannot restore a selection it
    // was never told about. Worth saying out loud before updating one.
    hasState: Object.keys(state).length > 0,
  };
}

// A project is an Orchestra install if the protocol was stamped into it. That
// file is what the installer writes and `--uninstall` removes, so it is the
// honest marker — orchestra-install.json alone would miss every pre-packs
// install, and a stray .claude/ directory (every Claude Code project has one)
// would over-match.
function isInstall(dir) {
  try {
    return fs.statSync(path.join(dir, '.claude', 'ORCHESTRA.md')).isFile();
  } catch (_) {
    return false;
  }
}

// Directories never worth walking into. Cheap to skip and expensive not to:
// one node_modules can hold more directories than the rest of a tree combined.
const SCAN_SKIP = new Set([
  'node_modules', '.git', '.hg', '.svn', 'vendor', 'venv', '.venv', '__pycache__',
  'target', 'dist', 'build', 'out', '.next', '.nuxt', '.turbo', '.cache',
  'Library', '.godot', 'coverage', '.gradle', '.m2', '.cargo', '.tox',
]);

// Every Orchestra install under `root`, breadth-first to a depth limit.
//
// Symlinked directories are skipped for free: a Dirent reports a symlink as a
// symlink, not a directory, so `isDirectory()` is false and the walk cannot
// loop through one. An install is not descended into — a harnessed project
// does not contain other harnessed projects, and stopping there keeps the
// scan proportional to the number of repositories rather than their contents.
function findInstalls(root, maxDepth) {
  const found = [];
  const walk = (dir, depth) => {
    if (isInstall(dir)) {
      found.push(readInstall(dir));
      return;
    }
    if (depth >= maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return; // unreadable directory — not a scan failure, just not searchable
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (SCAN_SKIP.has(e.name)) continue;
      const child = path.join(dir, e.name);
      // Never report the master as one of its own installs.
      if (path.resolve(child) === path.resolve(SRC)) continue;
      walk(child, depth + 1);
    }
  };
  walk(path.resolve(root), 0);
  found.sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  return found;
}

// A project is updated by spawning the installer against it, exactly as a
// person would run it by hand. That is deliberate: this mode adds discovery,
// it does not add a second way to install. Each project therefore gets the
// identical code path, its own recorded pack/specialist selection, and its own
// pack self-check output — and a failure in one cannot corrupt the state of
// the next, because nothing is shared but a fresh process.
function updateInstall(projectDir) {
  const r = spawnSync(process.execPath, [path.join(SRC, 'install.js'), projectDir], {
    cwd: SRC,
    encoding: 'utf8',
    timeout: 120000,
  });
  return {
    ok: !r.error && r.status === 0,
    status: r.status,
    output: ((r.stdout || '') + (r.stderr || '')).replace(/\s+$/, ''),
    error: r.error ? String(r.error.message || r.error) : '',
  };
}

function runScan(root, doUpdate, maxDepth) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    fail('Scan directory does not exist: ' + root);
  }
  console.log(
    'Orchestra ' + (VERSION || '(unversioned master)') + ' — master: ' + SRC
  );
  console.log('Scanning ' + path.resolve(root) + ' (max depth ' + maxDepth + ')\n');

  const installs = findInstalls(root, maxDepth);
  if (!installs.length) {
    console.log('  No Orchestra installs found.');
    console.log(
      '\n  A project counts as an install when it has .claude/ORCHESTRA.md. If you\n' +
      '  expected one here, it may be deeper than the depth limit (--depth <n>).'
    );
    return 0;
  }

  // Classify first, print second: the summary line and the exit code both need
  // the whole picture, and a reader wants the counts to agree with the rows.
  const rows = installs.map((i) => {
    const cmp = compareVersions(i.version, VERSION);
    let state;
    if (!i.version) state = 'BEHIND';
    else if (cmp < 0) state = 'BEHIND';
    else if (cmp > 0) state = 'ahead';
    else state = 'up to date';
    return { install: i, state };
  });

  const stale = rows.filter((r) => r.state === 'BEHIND');
  const ahead = rows.filter((r) => r.state === 'ahead');

  for (const row of rows) {
    const i = row.install;
    const bits = [];
    if (i.packs.length) bits.push('packs: ' + i.packs.join(', '));
    if (i.specialists.length) bits.push('specialists: ' + i.specialists.join(', '));
    if (!i.hasState) bits.push('no install record — a pre-packs install');
    if (row.state === 'ahead') bits.push('NEWER than this master — not updated');
    console.log(
      '  ' + (i.version || 'unversioned').padEnd(12) +
      row.state.padEnd(12) +
      i.dir +
      (bits.length ? '\n' + ' '.repeat(26) + bits.join(' · ') : '')
    );
  }

  console.log(
    '\n' + installs.length + ' install(s) · ' + stale.length + ' behind · ' +
    ahead.length + ' ahead of this master'
  );
  if (ahead.length) {
    console.log(
      '  An install ahead of this master is never touched — `git pull` the master first.'
    );
  }

  if (!stale.length) {
    console.log('  Everything reachable is on ' + (VERSION || 'this master') + '.');
    return 0;
  }

  if (!doUpdate) {
    console.log('\n  Update them: node install.js --scan ' + path.resolve(root) + ' --update');
    return 1; // "something is behind" is a reportable state, usable in a check
  }

  console.log('');
  let failed = 0;
  for (const row of stale) {
    const i = row.install;
    console.log(
      '  Updating ' + i.dir + ' (' + (i.version || 'unversioned') + ' -> ' + VERSION + ')'
    );
    if (!i.hasState && (i.packs.length === 0)) {
      // Said before the run, not after: a pre-packs install has no recorded
      // selection to inherit, so packs it may have had are not restored by a
      // plain re-run. Better a warning the user can act on than a silent
      // downgrade of their harness.
      console.log(
        '    note: no install record — any packs/specialists this project had are NOT\n' +
        '          restored automatically. Re-add them with:\n' +
        '            node install.js "' + i.dir + '" --packs <names> --specialists <names>'
      );
    }
    const res = updateInstall(i.dir);
    if (res.ok) {
      console.log('    updated to ' + VERSION);
    } else {
      failed++;
      console.log(
        '    FAILED (' + (res.error || 'exit ' + res.status) + ')' +
        (res.output ? '\n' + res.output.split(/\r?\n/).map((l) => '      ' + l).join('\n') : '')
      );
    }
  }

  console.log(
    '\n' + (stale.length - failed) + ' updated, ' + failed + ' failed.' +
    (failed
      ? ' Re-run the installer on the failed project(s) directly to see the full output.'
      : '')
  );
  return failed ? 1 : 0;
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
let uninstall = false;
let specialistsArg = null; // null = not given (inherit the recorded selection)
let packsArg = null;
let dirArg = '';
let scanArg = null; // null = not scanning
let updateFlag = false;
let depthArg = null;
let lintFlag = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--uninstall') uninstall = true;
  else if (a === '--specialists') specialistsArg = args[++i] || '';
  else if (a.startsWith('--specialists=')) specialistsArg = a.slice('--specialists='.length);
  else if (a === '--no-specialists') specialistsArg = '';
  else if (a === '--packs') packsArg = args[++i] || '';
  else if (a.startsWith('--packs=')) packsArg = a.slice('--packs='.length);
  else if (a === '--no-packs') packsArg = '';
  else if (a === '--scan') scanArg = args[++i] || '';
  else if (a.startsWith('--scan=')) scanArg = a.slice('--scan='.length);
  else if (a === '--update') updateFlag = true;
  else if (a === '--depth') depthArg = args[++i] || '';
  else if (a.startsWith('--depth=')) depthArg = a.slice('--depth='.length);
  else if (a === '--lint') lintFlag = true;
  else if (a.startsWith('--')) {
    fail(
      'Unknown flag: ' + a +
        ' (expected --uninstall, --packs <names>, --no-packs, --specialists <names>,' +
        ' --no-specialists, --scan <dir>, --update, --depth <n>, or --lint [dir])'
    );
  } else if (!dirArg) dirArg = a;
  else fail('Unexpected extra argument: ' + a);
}

// --- lint mode: the frontmatter check on its own, for CI and contributors.
// Strict on purpose: warnings fail it too, because "parses today but leans on
// the repair pass" is exactly the state that shipped the field failure.
if (lintFlag) {
  if (scanArg !== null || uninstall || updateFlag) {
    fail('--lint runs alone (optionally with a directory to lint): node install.js --lint [dir]');
  }
  const root = path.resolve(dirArg || SRC);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    fail('Lint directory does not exist: ' + root);
  }
  console.log('Orchestra frontmatter lint — ' + root);
  const res = runLint(collectLintables(root), root);
  console.log(
    '  ' + res.checked + ' file(s) with frontmatter checked · ' +
    res.errors + ' error(s) · ' + res.warnings + ' warning(s)'
  );
  if (res.errors) {
    console.error(
      '\nFAILED — a frontmatter error means Claude Code drops the file SILENTLY:\n' +
      'the agent or skill never registers, in any session, with no log anywhere.'
    );
  } else if (res.warnings) {
    console.error(
      '\nFAILED (warnings are fatal in lint mode) — these values parse today but\n' +
      'lose text or depend on Claude Code\'s CRLF-fragile repair pass. Quote them.'
    );
  } else {
    console.log('  OK — every frontmatter here survives a strict YAML parse unrepaired.');
  }
  process.exit(res.errors || res.warnings ? 1 : 0);
}

// --- scan mode: a different job from installing into one target, so it is
// handled here and returns; nothing below this block runs.
if (scanArg !== null) {
  if (!scanArg.trim()) fail('--scan needs a directory to search: --scan <dir>');
  if (dirArg) {
    fail(
      '--scan takes the directory to search and nothing else — got an extra target ' +
        '("' + dirArg + '"). To install into one project, drop --scan.'
    );
  }
  // Refused rather than supported. A scan spans projects that made DIFFERENT
  // choices, and the recorded selection is what a plain re-run preserves;
  // applying one --packs/--specialists set across all of them would silently
  // rewrite those choices — adding an OpenAI surface to projects that never
  // asked for one, or dropping a specialist a project depends on.
  if (packsArg !== null || specialistsArg !== null) {
    fail(
      '--scan cannot be combined with --packs/--specialists. A scan updates each ' +
        'project to its OWN recorded selection; one selection applied across many ' +
        'projects would silently rewrite choices they made deliberately. Change a ' +
        "project's selection by installing into it directly."
    );
  }
  // Mass uninstall is not a convenience worth building. One project at a time
  // is the honest interface for removing a harness.
  if (uninstall) {
    fail(
      '--scan cannot be combined with --uninstall. Removing the harness is per ' +
        'project on purpose: node install.js <project> --uninstall'
    );
  }
  let maxDepth = 6;
  if (depthArg !== null) {
    const n = parseInt(depthArg, 10);
    if (!Number.isFinite(n) || n < 1) fail('--depth needs a positive whole number');
    maxDepth = n;
  }
  process.exit(runScan(scanArg, updateFlag, maxDepth));
}
if (updateFlag) fail('--update only means something with --scan <dir>');
if (depthArg !== null) fail('--depth only means something with --scan <dir>');
const target = path.resolve(dirArg || process.cwd());

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
const stateFile = path.join(dotClaude, STATE_FILE);
const claudeMd = path.join(target, 'CLAUDE.md');
const orchestraMd = path.join(dotClaude, 'ORCHESTRA.md');
const pauseFile = path.join(dotClaude, 'orchestra.pause');
const gitattributesFile = path.join(dotClaude, '.gitattributes');

// Exactly what the installer stamps into .claude/.gitattributes — and, on
// --uninstall, the only content it will remove (anything else is the user's).
const GITATTRIBUTES_CONTENT = [
  '# Written by the Orchestra installer. Keep installed files LF on disk:',
  "# Claude Code's frontmatter repair pass cannot match lines with a trailing",
  '# CR, so a CRLF re-checkout (core.autocrlf) can silently drop agents whose',
  '# YAML would need that repair. Delete only if you manage line endings here.',
  '*.md text eol=lf',
  '*.js text eol=lf',
  '',
].join('\n');

// What the last install selected. Lets a plain re-run refresh the same packs
// and specialists instead of silently leaving them stale or dropping them.
const priorState = readJson(stateFile);
const priorPacks = stringList(priorState.packs);
const priorSpecialists = stringList(priorState.specialists);

// Explicit flag wins; otherwise inherit the recorded selection.
const specialists = specialistsArg === null ? priorSpecialists : parseList(specialistsArg);
const packs = packsArg === null ? priorPacks : parseList(packsArg);

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
for (const p of packs) {
  if (!availablePacks().includes(p)) {
    fail(
      'Unknown pack: ' + p +
        (availablePacks().length
          ? '. Available: ' + availablePacks().join(', ')
          : '. No packs exist in the master yet (see packs/_TEMPLATE/).')
    );
  }
}
if (!uninstall) {
  packs.forEach(packManifest); // validate manifests before touching anything
  assertNoCollisions(packs);
}

const vTag = VERSION ? ' v' + VERSION : '';
console.log(
  (uninstall ? 'Uninstalling Orchestra' + vTag + ' from: ' : 'Installing Orchestra' + vTag + ' into: ') + target
);

if (!uninstall) {
  // 0. Frontmatter gate — everything about to be copied is linted FIRST, so
  // a failure touches nothing in the target. A file with unparseable
  // frontmatter would be dropped SILENTLY by Claude Code (no log, no error:
  // the agent simply never registers in any session), which is strictly
  // worse than an installer that refuses with a filename and a line number.
  const lintTargets = [];
  for (const a of AGENTS) lintTargets.push({ file: path.join(SRC, 'agents', a), required: true });
  for (const s of specialists) {
    lintTargets.push({ file: path.join(SPECIALISTS_DIR, s + '.md'), required: true });
  }
  for (const s of availableSkills()) lintTargets.push(...collectLintables(path.join(SKILLS_DIR, s)));
  for (const name of packs) {
    const root = path.join(PACKS_DIR, name);
    const c = packContents(name);
    for (const f of c.agents) lintTargets.push({ file: path.join(root, 'agents', f), required: true });
    for (const d of c.skills) lintTargets.push(...collectLintables(path.join(root, 'skills', d)));
  }
  const lint = runLint(lintTargets, SRC);
  if (lint.errors) {
    fail(
      'refusing to install: ' + lint.errors + ' frontmatter error(s) above. A file ' +
        'whose frontmatter fails to parse is dropped SILENTLY by Claude Code — the ' +
        'agent or skill never registers, with no log anywhere. Nothing was copied. ' +
        'Fix the value(s) in the master (usually: quote the offending value), or run ' +
        '`node install.js --lint` for the standalone report.'
    );
  }
  if (lint.warnings) {
    console.log(
      '  ! ' + lint.warnings + ' frontmatter warning(s) above — installing anyway ' +
        '(the LF-normalized copies parse today), but quote those values in the master: ' +
        'they are one edit away from the silent-drop class.'
    );
  }

  // 1. Copy files.
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(hooksDir, { recursive: true });
  for (const a of AGENTS) {
    copyFileStamped(path.join(SRC, 'agents', a), path.join(agentsDir, a));
  }
  did('agents: ' + AGENTS.join(', ') + ' -> .claude/agents/');
  for (const s of specialists) {
    copyFileStamped(path.join(SPECIALISTS_DIR, s + '.md'), path.join(agentsDir, s + '.md'));
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

  // 1b. Packs — opt-in modules. Deselected packs from a previous install are
  // removed first, so `--no-packs` (or dropping a name) actually takes effect.
  const packSkillsInstalled = [];
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
    for (const d of c.skills) {
      const p = path.join(skillsDir, d);
      if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); removed++; }
    }
    if (removed) did('pack "' + name + '" deselected — removed its ' + removed + ' installed item(s)');
  }
  for (const name of packs) {
    const root = path.join(PACKS_DIR, name);
    const c = packContents(name);
    for (const f of c.agents) {
      copyFileStamped(path.join(root, 'agents', f), path.join(agentsDir, f));
    }
    for (const f of c.hooks) {
      fs.copyFileSync(path.join(root, 'hooks', f), path.join(hooksDir, f));
    }
    for (const d of c.skills) {
      const dest = path.join(skillsDir, d);
      fs.rmSync(dest, { recursive: true, force: true });
      copyDir(path.join(root, 'skills', d), dest);
      packSkillsInstalled.push(d);
    }
    const parts = [];
    if (c.agents.length) parts.push(c.agents.length + ' agent(s)');
    if (c.hooks.length) parts.push(c.hooks.length + ' hook(s)');
    if (c.skills.length) parts.push(c.skills.length + ' skill(s)');
    did('pack "' + name + '": ' + (parts.join(', ') || 'nothing to copy') + ' -> .claude/');
  }

  let protocol = fs.readFileSync(path.join(SRC, 'ORCHESTRA.md'), 'utf8');
  if (VERSION) {
    protocol = protocol.replace(
      'Installed by the Orchestra harness.',
      'Installed by the Orchestra harness (v' + VERSION + ').'
    );
  }
  fs.writeFileSync(orchestraMd, protocol.replace(/\r\n/g, '\n'), 'utf8');
  did('protocol -> .claude/ORCHESTRA.md' + (VERSION ? ' (v' + VERSION + ')' : ''));

  // 1c. Line-ending armor. The LF-normalized copies above fix the install,
  // but a project that COMMITS .claude/ and re-checks out under
  // core.autocrlf=true would convert them right back to CRLF — re-arming the
  // repair-pass failure the lint exists to prevent. A scoped .gitattributes
  // pins the endings on disk regardless of that setting. Only created when
  // absent: an existing file is the user's, and is never edited.
  if (!fs.existsSync(gitattributesFile)) {
    fs.writeFileSync(gitattributesFile, GITATTRIBUTES_CONTENT, 'utf8');
    did('.claude/.gitattributes stamped (*.md and *.js stay LF — autocrlf cannot re-break frontmatter)');
  } else if (!/eol=lf/.test(fs.readFileSync(gitattributesFile, 'utf8'))) {
    console.log(
      '  ! .claude/.gitattributes exists but pins no LF endings — left untouched (it is ' +
        'yours). Consider adding "*.md text eol=lf": a CRLF re-checkout can silently ' +
        'break agent frontmatter.'
    );
  }

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

  // 4. Record the selection so a later plain re-run refreshes the same set.
  writeJson(stateFile, {
    version: VERSION || null,
    packs: packs.slice().sort(),
    specialists: specialists.slice().sort(),
  });
  did('selection recorded in .claude/' + STATE_FILE + ' (re-runs keep it; change it with --packs / --specialists)');

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
  const allSkills = skills.concat(packSkillsInstalled).sort();
  if (allSkills.length) {
    console.log(
      '  - Skills installed: ' +
        allSkills.map((s) => '/' + s).join(', ') +
        ' (fresh sessions pick them up; see README "Bundled skills").'
    );
  }
  for (const name of packs) {
    const m = packManifest(name);
    console.log('  - Pack "' + name + '"' + (m.title ? ' — ' + m.title : '') + ':');
    for (const n of stringList(m.notes)) console.log('      ' + n);
    const req = (m.requires && typeof m.requires === 'object') ? m.requires : {};
    for (const b of stringList(req.bin)) console.log('      needs executable: ' + b);
    for (const e of stringList(req.env)) console.log('      needs env: ' + e);
  }

  // A pack may declare a self-check the installer runs on the spot. The codex
  // pack does, and it earns its keep: the review lane's worst failure mode is a
  // Codex install that LOOKS fine — one helper file present but one directory
  // too deep — and produces reviews that quietly return nothing. That state is
  // discoverable in milliseconds and was, in the field, discovered days later.
  // Running the check here puts the answer next to the instructions for fixing
  // it, at the one moment the person is already looking at this output.
  //
  // Never fatal: the harness installs fine on a machine with no Codex at all,
  // and the pack is optional in the first place.
  for (const name of packs) {
    const m = packManifest(name);
    const cmd = m.selfCheck;
    if (!cmd || typeof cmd !== 'object' || !Array.isArray(cmd.args)) continue;
    if (typeof cmd.script !== 'string' || !cmd.script.trim()) continue;
    // A pack's self-check runs a file the pack itself just installed, and
    // nothing outside .claude/ — a manifest is data, not a licence to run
    // arbitrary paths on the user's machine.
    const script = path.resolve(dotClaude, cmd.script);
    const inside = path.relative(dotClaude, script);
    if (inside.startsWith('..') || path.isAbsolute(inside)) continue;
    if (!fs.existsSync(script) || !fs.statSync(script).isFile()) continue;
    let r = null;
    try {
      r = spawnSync(process.execPath, [script].concat(cmd.args), {
        cwd: target,
        encoding: 'utf8',
        timeout: 60000,
      });
    } catch (_) {
      r = null;
    }
    const text = r ? (r.stdout || '') + (r.stderr || '') : '';
    console.log('');
    console.log('  Pack "' + name + '" self-check (re-run anytime: node .claude/' +
      cmd.script + ' ' + cmd.args.join(' ') + '):');
    if (!text.trim()) {
      console.log('    (the check produced no output — run it yourself to see why)');
      continue;
    }
    for (const line of text.replace(/\s+$/, '').split(/\r?\n/)) {
      console.log(line.trim() ? '    ' + line : '');
    }
    if (r && r.status !== 0) {
      console.log('    ^ the check above did NOT pass. The harness is installed either way;');
      console.log('      this pack\'s lane will not work until the lines above are addressed.');
    }
  }
  console.log('  - Update later by re-running this installer; remove with --uninstall.');
  const availPacks = availablePacks().filter((p) => !packs.includes(p));
  if (availPacks.length) {
    console.log(
      '  - Optional packs available (not installed): ' +
        availPacks.join(', ') +
        ' — add with --packs <name> (see packs/README.md).'
    );
  }
  const avail = availableSpecialists().filter((s) => !specialists.includes(s));
  if (avail.length && specialists.length === 0) {
    console.log(
      '  - Domain specialists available (not installed): ' +
        avail.join(', ') +
        ' — add with --specialists <name>.'
    );
  }
} else {
  // Uninstall: remove our files (core agents, any master-known specialists, and
  // every master-known pack's files), hook entries, and the CLAUDE.md marker
  // block. Packs are removed whether or not the state file records them —
  // master knowledge is what makes removal safe.
  const packAgents = [];
  const packHooks = [];
  const packSkills = [];
  for (const name of availablePacks()) {
    const c = packContents(name);
    packAgents.push(...c.agents);
    packHooks.push(...c.hooks);
    packSkills.push(...c.skills);
  }

  const agentFiles = AGENTS.concat(availableSpecialists().map((s) => s + '.md')).concat(packAgents);
  for (const a of agentFiles) {
    const f = path.join(agentsDir, a);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed .claude/agents/' + a);
    }
  }
  const hookFiles = [GUARD].concat(packHooks).map((h) => path.join(hooksDir, h));
  for (const f of hookFiles.concat([orchestraMd, pauseFile, stateFile])) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed ' + path.relative(target, f).replace(/\\/g, '/'));
    }
  }

  // The stamped .gitattributes is removed only when it is byte-for-byte ours —
  // a file the user edited (or wrote themselves) is theirs to keep.
  try {
    if (
      fs.existsSync(gitattributesFile) &&
      fs.readFileSync(gitattributesFile, 'utf8') === GITATTRIBUTES_CONTENT
    ) {
      fs.unlinkSync(gitattributesFile);
      did('removed .claude/.gitattributes (installer-stamped, unedited)');
    }
  } catch (_) {
    /* an unreadable file is left alone */
  }

  // Bundled and pack skills: remove master-known names only — skills the user
  // authored under other names are theirs, not ours.
  for (const s of availableSkills().concat(packSkills)) {
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
