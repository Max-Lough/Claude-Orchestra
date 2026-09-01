#!/usr/bin/env node
/**
 * Orchestra installer — stamps the Orchestra harness (agents, hooks, the
 * protocol, and bundled skills) into a target project.
 *
 *   node install.js [targetDir]                        install / update (idempotent)
 *   node install.js [targetDir] --packs a[,b]          also install optional packs
 *   node install.js [targetDir] --no-packs             install with no packs
 *   node install.js [targetDir] --specialists a[,b]    also install domain specialists
 *   node install.js [targetDir] --roster legacy|new    roster generation (default legacy;
 *                                                      "new" co-installs the eleven-file
 *                                                      roster and its runtime substrates
 *                                                      ALONGSIDE the legacy six — see
 *                                                      "Roster generations" below)
 *   node install.js [targetDir] --grant-push           also grant an exact-match allowlist of
 *                                                      safe push invocations, with a
 *                                                      permissions.deny counterweight for
 *                                                      --force/-f/--delete/--mirror/--prune and
 *                                                      refspec forms (push is NOT granted by
 *                                                      default)
 *   node install.js [targetDir] --grants-local         write git grants to settings.local.json
 *                                                      (git-ignored, per-developer) instead of
 *                                                      the shared settings.json
 *   node install.js [targetDir] --verify-pin           recompute and report MATCH/MISMATCH/
 *                                                      NO-PIN against this project's external
 *                                                      manifest pin (see "Manifest pin" in the
 *                                                      README)
 *   node install.js [targetDir] --uninstall            remove cleanly
 *   node install.js --scan <dir> [--depth n]           report which installs are behind
 *   node install.js --scan <dir> --update              ...and bring the stale ones up
 *   node install.js --lint [dir]                       frontmatter lint only (CI /
 *                                                      contributors; dir defaults to
 *                                                      this master)
 *
 * targetDir defaults to the current working directory.
 *
 * Roster generations: "legacy" (default) is byte-for-byte the original
 * install — the six core agents/*.md files and nothing under roster/. "new"
 * installs the eleven roster/*.md role files (minus conductor.md, which is
 * the session's own standing contract, not a spawnable agent) into
 * .claude/agents/ IN ADDITION to the legacy six, conductor.md itself to
 * .claude/ORCHESTRA-CONDUCTOR.md, and the shared substrates (router/,
 * registry/, verifier/, quartermaster/, and bridge/ once leg 4 adds it) as a
 * runtime directory, .claude/orchestra/. Both rosters stay installed
 * together; the manifest flag .claude/orchestra.json "roster" is what a
 * later leg's runtime reads to decide which one is live, and flipping it
 * back to "legacy" is a flag flip, never a reinstall or a deletion.
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
const os = require('os');
const path = require('path');
const crypto = require('crypto');
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

// --------------------------------------------------------- roster (leg 3)
//
// roster/*.md holds the eleven-file new roster PLUS a mix of non-role
// documents (README.md, dated campaign records, work-order dispositions).
// This classification mirrors roster/lint.js's own isRoleFile exactly (kept
// duplicated rather than required-in: install.js has no other dependency on
// registry/router internals, and lint.js has no exported classifier) so the
// two never silently disagree about what counts as a role file.
const ROSTER_DIR = path.join(SRC, 'roster');
const ROSTER_NON_ROLE_NAMES = new Set(['README.md', 'EXERCISES.md']);
const ROSTER_RECORD_DOC_RE = /^(wo\d+[a-z]?-|r\d+-ex\d+-|(readiness|roster)-.*-\d{4}-\d{2}-\d{2}\.md$)/;
function rosterRoleFiles() {
  if (!fs.existsSync(ROSTER_DIR)) return [];
  return fs
    .readdirSync(ROSTER_DIR)
    .filter(
      (f) =>
        f.endsWith('.md') && !ROSTER_NON_ROLE_NAMES.has(f) && !ROSTER_RECORD_DOC_RE.test(f)
    )
    .sort();
}
const ROSTER_CONDUCTOR_FILE = 'conductor.md';
const ROSTER_CONDUCTOR_DEST = 'ORCHESTRA-CONDUCTOR.md'; // .claude/ORCHESTRA-CONDUCTOR.md — the
  // session's standing contract, not a spawnable agent (A.2) — so it does
  // NOT land in .claude/agents/ with the other ten role files.
const ORCHESTRA_RUNTIME_DIRNAME = 'orchestra'; // .claude/orchestra/ — the shared substrates
const ROSTER_SUBSTRATE_DIRS = ['router', 'registry', 'verifier', 'quartermaster'];
const ROSTER_BRIDGE_DIRNAME = 'bridge'; // leg 4 creates this at the master root; today it
  // does not exist, and its absence is handled silently (see rosterInstall()).
const ORCHESTRA_MANIFEST_FILE = 'orchestra.json'; // .claude/orchestra.json — owner-pinned,
  // read by the guard's loadPolicy() and (leg 4) the activation runtime.
const DEFAULT_SEATS = { Architect: true, Sweeper: false };

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
  if (cfg.mcpServers !== undefined) {
    if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object' || Array.isArray(cfg.mcpServers)) {
      fail('pack "' + name + '" declares mcpServers that is not an object of server entries');
    }
    for (const [srv, entry] of Object.entries(cfg.mcpServers)) {
      if (!entry || typeof entry !== 'object' || typeof entry.command !== 'string' || !entry.command.trim()) {
        fail('pack "' + name + '" mcpServers["' + srv + '"] must be an object with a string "command"');
      }
    }
  }
  return cfg;
}

// MCP servers a set of packs declares, as { name: entry }. A manifest is data:
// the entries are merged into the project's .mcp.json verbatim, and the names
// are what deselection and --uninstall remove.
function packMcpServers(names) {
  const out = {};
  for (const name of names) {
    const cfg = packManifest(name);
    if (cfg.mcpServers) Object.assign(out, cfg.mcpServers);
  }
  return out;
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

// Every hook script (core guard, pack hooks) is CommonJS (`require(...)`).
// Node resolves a script's module type from the package.json NEAREST the
// script, so this one scoping file pins .claude/hooks/ to CommonJS
// regardless of the target project's own root "type" field — without it, a
// project with "type": "module" at its root makes Node treat every .js file
// under .claude/hooks/ as ESM, and every hook crashes with "require is not
// defined in ES module scope" (hit for real at orchestra-review.js:208).
const HOOKS_PACKAGE_JSON = 'package.json';
const HOOKS_PACKAGE_JSON_CONTENT = '{"type":"commonjs"}\n';
const STATE_FILE = 'orchestra-install.json'; // records the pack/specialist selection
const BEGIN = '<!-- ORCHESTRA:BEGIN (managed by the Orchestra installer - do not edit between markers) -->';
const END = '<!-- ORCHESTRA:END -->';
const IMPORT_BLOCK = BEGIN + '\n@.claude/ORCHESTRA.md\n' + END;

// Settings-level permission grants for the executor's git workflow. Subagents
// cannot accept authorization relayed by the Director ("the user said push" in
// a work order is not a user turn in the subagent's transcript), so the
// permission classifier denies git commit/push unless the grant lives in
// settings. These rules make Director-ordered commits work by default.
//
// Push is deliberately NOT among them (sdc-012 MAJOR): a session-wide
// `Bash(git push:*)` grant reaches every window the guard stands down in
// (see "What these grants reach" in the README), so it is opt-in via
// --grant-push, which adds it TOGETHER WITH the deny counterweight below —
// deny wins in Claude Code's permission evaluation, so the broad allow can
// never authorize the specific dangerous forms even in a stand-down window.
const GIT_PERMISSIONS = [
  'Bash(git add:*)',
  'Bash(git commit:*)',
];
// The broad prefix allow this installer shipped before WO-14b leg-3 fix
// round B — a deny blacklist over free-form shell can never be completed
// against it (Red Team, 2026-09-01: -d, --del, --mir, +refspec, :branch,
// origin --delete all defeat the five original deny patterns while still
// matching this prefix). Kept only as a detection string, so an install can
// recognize and strip a grant an older installer version left behind; it is
// never written to a target again.
const GIT_PUSH_PERMISSION = 'Bash(git push:*)';
// --grant-push now grants exactly these two invocations — no `:*` prefix,
// so nothing outside this literal list matches and anything else prompts.
// This is the fix for the class above: an allowlist of exact safe strings
// cannot be defeated by an option abbreviation or a refspec trick the way a
// prefix allow (or a deny blacklist trying to cover one) can. WO-14b leg-3
// fix round 2B item 6 (Red Team MEDIUM) drops the bare `Bash(git push)` and
// the `--set-upstream` spelling: both omit an explicit refspec, so what they
// push is decided by `.git/config` (`remote.origin.push`, `push.default`)
// rather than by the string Claude Code matched — a config-driven grant is
// not the same guarantee as an exact-match one. `-u`/`origin HEAD` names the
// branch explicitly and is kept.
const GIT_PUSH_SAFE_ALLOW = [
  'Bash(git push origin HEAD)',
  'Bash(git push -u origin HEAD)',
];
// Belt-and-braces: kept and extended even though the allowlist above no
// longer needs a blacklist to be safe, in case a project's own permission
// rules (or a future broader allow) reintroduce a prefix grant. Original
// five plus the seven forms the Red Team reproduced escaping them.
const GIT_PUSH_DENY_PATTERNS = [
  'Bash(git push --force*)',
  'Bash(git push -f*)',
  'Bash(git push --delete*)',
  'Bash(git push --mirror*)',
  'Bash(git push * --force*)',
  'Bash(git push -d*)',
  'Bash(git push --del*)',
  'Bash(git push --mir*)',
  'Bash(git push --prune*)',
  'Bash(git push * +*)',
  'Bash(git push * :*)',
  'Bash(git push origin --delete*)',
];

// ------------------------------------------------------------- manifest pin
//
// .claude/orchestra.json is an ordinary project file: nothing stopped a
// Director (or a hostile cloned repo) from editing it to loosen the guard's
// policy (Red Team HIGH, 2026-09-01). The pin is a second copy of the
// manifest's load-bearing fields, held OUTSIDE the project — under the
// user's home directory by default — hashed to the manifest's own bytes, so
// a guard-side check (leg 4 / the sibling builder's guard work) can detect
// an in-project edit the pin does not agree with. ORCHESTRA_PIN_DIR
// overrides the location (tests use a temp dir so runs never touch a real
// machine's pin store).
const PIN_DIR = process.env.ORCHESTRA_PIN_DIR || path.join(os.homedir(), '.claude', 'orchestra', 'pins');

function projectRealPath(dir) {
  try {
    return fs.realpathSync(dir);
  } catch (_) {
    return path.resolve(dir);
  }
}

function pinFilePath(projectDir) {
  const real = projectRealPath(projectDir);
  const hash = crypto.createHash('sha256').update(real, 'utf8').digest('hex');
  return path.join(PIN_DIR, hash + '.json');
}

// Item 5 (WO-14b leg-3 fix round 2B): a second pin keyed on the manifest's
// own `projectId` (minted once, at the first --roster new, and preserved
// thereafter) rather than the project's real path. The path-keyed pin above
// goes stale the instant a project directory moves or is re-cloned
// elsewhere; the id-keyed copy survives that unchanged, so --verify-pin can
// tell "never pinned" apart from "pinned, then moved" instead of reporting
// NO-PIN for a project the owner genuinely already vouched for.
function idPinFilePath(projectId) {
  const hash = crypto.createHash('sha256').update(String(projectId), 'utf8').digest('hex');
  return path.join(PIN_DIR, 'id-' + hash + '.json');
}

// Writes/refreshes the pin for `projectDir` from the manifest file as JUST
// WRITTEN to disk (the hash covers the exact bytes written, indentation and
// all). Returns the path-keyed pin file path. Called after every write to
// orchestra.json that carries roster/seat information — never for a plain
// legacy install, which writes no manifest and therefore gets no pin. Writes
// BOTH the path-keyed and (when the manifest carries a projectId) the
// id-keyed pin, with identical content.
function writePin(projectDir, manifestFile, manifestObj) {
  const bytes = fs.readFileSync(manifestFile);
  const pin = {
    projectDir: projectRealPath(projectDir),
    manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    roster: manifestObj.roster || 'legacy',
    rosterGeneration: typeof manifestObj.rosterGeneration === 'number' ? manifestObj.rosterGeneration : 0,
    seats: manifestObj.seats || {},
    projectId: typeof manifestObj.projectId === 'string' && manifestObj.projectId ? manifestObj.projectId : null,
    writtenAt: new Date().toISOString(),
    by: 'install.js',
  };
  const body = JSON.stringify(pin, null, 2) + '\n';
  const pf = pinFilePath(projectDir);
  fs.mkdirSync(path.dirname(pf), { recursive: true });
  fs.writeFileSync(pf, body, 'utf8');
  if (pin.projectId) {
    const idPf = idPinFilePath(pin.projectId);
    fs.mkdirSync(path.dirname(idPf), { recursive: true });
    fs.writeFileSync(idPf, body, 'utf8');
  }
  return pf;
}

// Removes both the path-keyed and (if discoverable) the id-keyed pin for a
// project. `knownProjectId` lets a caller that already has the manifest's
// projectId (e.g. --uninstall, reading orchestra.json before it clears the
// file) remove the id-keyed copy even if the path-keyed one is already gone
// (a moved project that was never --repin'd).
function removePin(projectDir, knownProjectId) {
  const pf = pinFilePath(projectDir);
  let projectId = knownProjectId || null;
  let removedAny = false;
  let removedPath = null;
  if (fs.existsSync(pf)) {
    if (!projectId) {
      try {
        const pin = JSON.parse(fs.readFileSync(pf, 'utf8'));
        if (pin && pin.projectId) projectId = pin.projectId;
      } catch (_) {
        /* unreadable pin — still remove it below */
      }
    }
    fs.unlinkSync(pf);
    removedPath = pf;
    removedAny = true;
  }
  if (projectId) {
    const idPf = idPinFilePath(projectId);
    if (fs.existsSync(idPf)) {
      fs.unlinkSync(idPf);
      removedAny = true;
      if (!removedPath) removedPath = idPf;
    }
  }
  return removedAny ? removedPath : null;
}

// The shared status computation behind --verify-pin AND --uninstall's
// pin-before-ledger check (item 2). Returns
// { status: 'MATCH'|'MISMATCH'|'NO-PIN'|'MOVED', ... } — never throws.
//
//   MATCH     — the path-keyed pin exists and its hash + projectDir agree
//               with the manifest on disk right now.
//   MISMATCH  — a pin exists (by path, or by id) but its hash disagrees
//               with the manifest on disk, or the manifest is gone.
//   NO-PIN    — no pin was ever recorded for this project, by either key.
//   MOVED     — no path-keyed pin here, but the manifest's own projectId
//               resolves to an id-keyed pin elsewhere whose hash MATCHES
//               the manifest on disk now — a relocated, still-trusted
//               project (item 5's guard-side rule: trusted iff hash
//               matches). --repin promotes this to a fresh path-keyed pin.
function verifyPinStatus(target, orchestraJsonFile) {
  const pf = pinFilePath(target);
  const realDir = projectRealPath(target);
  const manifestBytes = () => fs.readFileSync(orchestraJsonFile);
  if (fs.existsSync(pf)) {
    let pin;
    try {
      pin = JSON.parse(fs.readFileSync(pf, 'utf8'));
    } catch (e) {
      return { status: 'NO-PIN', pf, reason: 'pin file exists but is not valid JSON (' + pf + ': ' + e.message + ')' };
    }
    if (!fs.existsSync(orchestraJsonFile)) {
      return { status: 'MISMATCH', pf, pin, realDir, reason: '.claude/orchestra.json no longer exists here' };
    }
    const actualSha = crypto.createHash('sha256').update(manifestBytes()).digest('hex');
    if (actualSha === pin.manifestSha256 && realDir === pin.projectDir) {
      return { status: 'MATCH', pf, pin, actualSha, realDir };
    }
    return { status: 'MISMATCH', pf, pin, actualSha, realDir };
  }
  // No path-keyed pin here — check whether the manifest's own projectId
  // resolves to an id-keyed pin (a relocated project).
  if (fs.existsSync(orchestraJsonFile)) {
    let manifest = null;
    try {
      manifest = JSON.parse(fs.readFileSync(orchestraJsonFile, 'utf8'));
    } catch (_) {
      /* unparseable manifest — treated as NO-PIN below, same as before */
    }
    if (manifest && typeof manifest.projectId === 'string' && manifest.projectId) {
      const idPf = idPinFilePath(manifest.projectId);
      if (fs.existsSync(idPf)) {
        let idPin;
        try {
          idPin = JSON.parse(fs.readFileSync(idPf, 'utf8'));
        } catch (e) {
          return { status: 'NO-PIN', pf, reason: 'id-pin file exists but is not valid JSON (' + idPf + ': ' + e.message + ')' };
        }
        const actualSha = crypto.createHash('sha256').update(manifestBytes()).digest('hex');
        if (actualSha === idPin.manifestSha256) {
          return { status: 'MOVED', pf, idPf, pin: idPin, actualSha, realDir };
        }
        return { status: 'MISMATCH', pf, idPf, pin: idPin, actualSha, realDir };
      }
    }
  }
  return { status: 'NO-PIN', pf };
}

// Every write to orchestra.json that carries roster/seat information goes
// through this one function, so the external pin can never drift from the
// manifest bytes actually on disk (item 9). Plain grant-only bookkeeping for
// a byte-for-byte legacy install never calls this — see item 1.
function writeManifestAndPin(targetDir, manifestFile, manifestObj) {
  writeJson(manifestFile, manifestObj);
  const pf = writePin(targetDir, manifestFile, manifestObj);
  did('.claude/orchestra.json pin refreshed (' + pf + ')');
}

// All file paths under `dir`, relative to `dir`, forward-slashed. Used to
// record exactly what a --roster new install copied under
// .claude/orchestra/<substrate>/, so --uninstall can remove precisely that
// later without ever having to ask the CURRENT master what it would install
// today (item 4).
function listFilesRecursive(dir) {
  const out = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else out.push(r);
    }
  };
  walk(dir, '');
  return out;
}

// --------------------------------------------------- JSON round-trip guard
//
// JSON.parse/JSON.stringify silently rounds an integer literal wider than
// Number.MAX_SAFE_INTEGER to the nearest representable double (sdc-review
// MAJOR, 2026-09-01: 9007199254740993 -> 9007199254740992). Any of the three
// settings files this installer reads/writes may hold a value belonging to
// something else entirely (an unrelated tool's config key sharing the file);
// re-serializing it must never silently corrupt that value. This scans the
// raw JSON text (string contents masked out first, so a numeral inside a
// string is never mistaken for a literal) for every bare numeric token and
// flags one that would not survive a parse/stringify round trip.
// WO-14b leg-3 fix round 2B item 4c: normalizes exactly two purely-cosmetic
// differences a byte round trip should not be judged lossy on — the
// exponent marker's case, and a redundant '+' immediately after it — plus a
// trailing ".0" fractional part, which JSON.stringify never writes back for
// a value that is a whole number. Everything else in the literal's digits
// must survive the round trip unchanged, or it is lossy.
function canonicalNumericLiteral(tok) {
  return tok.replace(/E/, 'e').replace(/e\+/, 'e').replace(/\.0(?=$|e)/, '');
}

function findUnsafeNumericLiterals(raw) {
  let masked = '';
  let inStr = false;
  let esc = false;
  for (const ch of raw) {
    if (inStr) {
      // WO-14b leg-3 fix round 2B item 4a (Red Team HIGH): test ch === '"'
      // && !esc using the escape state as of the character BEFORE this one,
      // then recompute esc for the next character afterward. The old code
      // recomputed esc first, so an escaped quote (\") cleared esc and was
      // then read as an unescaped closing quote — ending the string early;
      // the real closing quote a few characters later then re-opened string
      // state, masking out everything after it, including the very literal
      // this guard exists to catch (pinned fixture:
      // {"a":"z\"", "big": 9007199254740993}).
      const wasEscaped = esc;
      masked += ch === '"' && !wasEscaped ? '"' : '_';
      if (ch === '"' && !wasEscaped) inStr = false;
      esc = !wasEscaped && ch === '\\';
      continue;
    }
    if (ch === '"') {
      inStr = true;
      masked += '"';
      continue;
    }
    masked += ch;
  }
  const NUM_RE = /(?:^|[:,\[\s])(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s*[,\]\}]|\s*$)/g;
  const bad = [];
  let m;
  while ((m = NUM_RE.exec(masked))) {
    const tok = m[1];
    const n = Number(tok);
    if (/[.eE]/.test(tok)) {
      // Fractional/exponent form (items 4b/4c, Red Team/cross-vendor review
      // MEDIUM x2): the old code exempted every such token as "float
      // precision is expected, not this guard's concern" — but Infinity
      // re-serializes as `null` (a TYPE change, strictly worse than the
      // integer rounding this guard was written to stop: 1e400/-1e400/1E400
      // all become null), and a finite-but-lossy float silently rewrites to
      // a different number (1.7976931348623159e308, 12345678901234567890.5,
      // 1.00000000000000000001 all lose digits). Refuse both.
      if (!Number.isFinite(n) || String(n) !== canonicalNumericLiteral(tok)) bad.push(tok);
      continue;
    }
    if (String(n) !== tok || !Number.isSafeInteger(n)) bad.push(tok);
  }
  return bad;
}

// ---------------------------------------------------- JSON formatting memory
//
// Preserve a settings file's own indentation across a rewrite (WO-14b leg-3
// fix round B item 5) instead of always re-serializing at 2 spaces. Detected
// once per file, from its content BEFORE this run touches it, and reused by
// every writeJson() call against that path for the rest of the run.
const FILE_INDENT = new Map();

function detectIndent(raw) {
  const m = /\n([ \t]+)\S/.exec(raw);
  if (!m) return '  ';
  return m[1][0] === '\t' ? '\t' : ' '.repeat(m[1].length);
}

function rememberFormat(file) {
  if (!fs.existsSync(file)) return;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (raw.trim()) FILE_INDENT.set(path.resolve(file), detectIndent(raw));
  } catch (_) {
    /* unreadable — writeJson falls back to 2 spaces */
  }
}

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

// The bridge's ticket-gate hook (WO-14b leg 4c) — registered into
// .claude/settings.json ONLY under --roster new (the gate is inert under
// legacy anyway; removed on a legacy flip as hygiene, not a behaviour
// change). Four events: PreToolUse/PostToolUse matched to tool "Agent" only
// (the gate has nothing to say about any other tool); SubagentStop/Stop
// fire on every such event (no matcher concept applies to non-tool events).
// GATE_HOOK_MARK identifies our entries the same way GUARD_MARK identifies
// the guard's, via isOurGateHookEntry() below — so a re-run replaces rather
// than duplicates them, and a user's own entries for these same four events
// are always left untouched.
const GATE_HOOK_MARK = 'ticket-gate.js';
const GATE_HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'SubagentStop', 'Stop'];
function gateHookEntry(eventName) {
  const entry = {
    hooks: [
      {
        type: 'command',
        command:
          'node "$CLAUDE_PROJECT_DIR/.claude/orchestra/bridge/hooks/ticket-gate.js" ' + eventName,
      },
    ],
  };
  if (eventName === 'PreToolUse' || eventName === 'PostToolUse') entry.matcher = 'Agent';
  return entry;
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

// See HOOKS_PACKAGE_JSON_CONTENT above for why this file exists. Idempotent:
// a file that already carries the right content is left alone, silently, so
// a plain re-run stays quiet; a file that exists with something ELSE gets
// overwritten (the hooks must stay CommonJS) with a notice, since that is a
// state worth knowing about.
function stampHooksPackageJson(dirPath) {
  const p = path.join(dirPath, HOOKS_PACKAGE_JSON);
  const existing = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (existing === null) {
    fs.writeFileSync(p, HOOKS_PACKAGE_JSON_CONTENT, 'utf8');
    did('.claude/hooks/package.json stamped (hooks stay CommonJS even when the project is "type": "module")');
    return;
  }
  // Compared CRLF-normalized: GITATTRIBUTES_CONTENT pins this file to LF on
  // fresh checkouts, but a checkout that predates that line (or any
  // core.autocrlf=true re-checkout before .gitattributes is picked up) can
  // still hand back the identical JSON with \r\n line endings. Node parses
  // that JSON exactly the same either way, so treat it as unchanged rather
  // than "fixing" a file nobody actually edited on every single run.
  if (existing === HOOKS_PACKAGE_JSON_CONTENT || existing.replace(/\r\n/g, '\n') === HOOKS_PACKAGE_JSON_CONTENT) {
    return;
  }
  fs.writeFileSync(p, HOOKS_PACKAGE_JSON_CONTENT, 'utf8');
  did(
    '.claude/hooks/package.json existed with different content — overwritten ' +
      '(it must stay {"type":"commonjs"} or the hooks stop loading)'
  );
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
  const indent = FILE_INDENT.get(path.resolve(file)) || '  ';
  fs.writeFileSync(file, JSON.stringify(obj, null, indent) + '\n', 'utf8');
}

// Refuse before touching ANYTHING (sdc-012 MINOR): malformed JSON in any of
// the three settings files the installer reads/writes — .claude/settings.json,
// .mcp.json, .claude/orchestra.json — used to surface only after the install
// had already copied agents/skills/hooks, and --uninstall used to delete
// every owned file before ever reading settings, stranding grants in a
// project left with no guard. This runs first, for both install and
// uninstall, before any fs mutation. Malformed `permissions` (a string, an
// array — not an object) is refused too, named explicitly, rather than
// silently replaced with {} the way a plain readJson() would invite.
// Refuse before touching ANYTHING (sdc-012 MINOR, extended by WO-14b leg-3
// fix round B items 5/6/7): malformed JSON, a non-object top level, a
// numeric literal that cannot survive a JSON.parse/stringify round trip, and
// (for orchestra.json specifically) a non-integer rosterGeneration, in any
// of the settings-like files this installer reads/writes. `files` is an
// array of { file, checkPermissions, checkRosterGeneration } — the caller
// decides which extra checks apply to which path (permissions shape only
// makes sense for a settings-style file; rosterGeneration only for the
// manifest).
function refuseIfTargetMalformed(files) {
  for (const spec of files) {
    const f = spec.file;
    if (!f || !fs.existsSync(f)) continue;
    const raw = fs.readFileSync(f, 'utf8').trim();
    if (raw === '') continue;
    // Item 7 (WO-14b leg-3 fix round 2B, Red Team LOW): a caller may attach
    // a hint naming the actual remedy — spelled out here rather than left
    // for the reader to infer, since the prior message said only "fix it
    // first" with no hint that deleting the file IS fixing it.
    const hint = spec.hint ? ' ' + spec.hint : '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      fail(
        f + ' exists but is not valid JSON (' + e.message + '). Refusing to touch ' +
          'anything in this project (nothing copied or deleted) — fix it first.' + hint
      );
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      fail(
        f + ' must contain a JSON object at the top level, found ' + JSON.stringify(parsed) +
          '. Refusing to touch anything in this project (nothing copied or deleted) — fix it first.' + hint
      );
    }
    const badNums = findUnsafeNumericLiterals(raw);
    if (badNums.length) {
      fail(
        f + ' contains numeric value(s) that would not survive a JSON.parse/stringify ' +
          'round trip without precision loss (' + badNums.join(', ') + '). Refusing to ' +
          'touch anything in this project (nothing copied or deleted) — fix it first ' +
          '(quote the value as a string if it must be preserved exactly).'
      );
    }
    if (spec.checkPermissions) {
      const perms = parsed.permissions;
      if (perms !== undefined) {
        if (typeof perms !== 'object' || perms === null || Array.isArray(perms)) {
          fail(
            f + ': "permissions" must be an object, found ' + JSON.stringify(perms) +
              '. Refusing to touch anything in this project — fix it first.'
          );
        }
        for (const key of ['allow', 'deny']) {
          if (perms[key] !== undefined && !Array.isArray(perms[key])) {
            fail(
              f + ': "permissions.' + key + '" must be an array, found ' +
                JSON.stringify(perms[key]) + '. Refusing to touch anything in this project — fix it first.'
            );
          }
        }
      }
    }
    if (spec.checkRosterGeneration && parsed.rosterGeneration !== undefined) {
      const g = parsed.rosterGeneration;
      if (typeof g !== 'number' || !Number.isInteger(g) || g < 0) {
        fail(
          f + ': "rosterGeneration" must be a non-negative integer, found ' + JSON.stringify(g) +
            '. Refusing to touch anything in this project — fix it first.'
        );
      }
    }
  }
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

function isOurGateHookEntry(entry) {
  return (
    entry &&
    Array.isArray(entry.hooks) &&
    entry.hooks.some(
      (h) => h && typeof h.command === 'string' && h.command.includes(GATE_HOOK_MARK)
    )
  );
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [];
}

// installedPermissions/installedDeny entries (WO-14b leg-3 fix round 2B item
// 3, cross-vendor review #2 MAJOR): {file, entry} pairs rather than bare
// strings, so uninstall can tell "Orchestra added this string to
// settings.json" apart from "the user independently added the identical
// string to settings.local.json" — a flat string list could not distinguish
// the two, so removing a tracked entry removed BOTH copies.
function permEntryList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e) => e && typeof e === 'object' && typeof e.file === 'string' && typeof e.entry === 'string' && e.entry.trim())
    .map((e) => ({ file: e.file, entry: e.entry }));
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
let rosterArg = null; // null = not given (defaults to "legacy" below)
let grantPushFlag = false;
let grantsLocalFlag = false;
let verifyPinFlag = false;
let repinFlag = false;
let ignoreManifestFlag = false;
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
  else if (a === '--roster') rosterArg = args[++i] || '';
  else if (a.startsWith('--roster=')) rosterArg = a.slice('--roster='.length);
  else if (a === '--grant-push') grantPushFlag = true;
  else if (a === '--grants-local') grantsLocalFlag = true;
  else if (a === '--verify-pin') verifyPinFlag = true;
  else if (a === '--repin') repinFlag = true;
  else if (a === '--ignore-manifest') ignoreManifestFlag = true;
  else if (a.startsWith('--')) {
    fail(
      'Unknown flag: ' + a +
        ' (expected --uninstall, --packs <names>, --no-packs, --specialists <names>,' +
        ' --no-specialists, --scan <dir>, --update, --depth <n>, --lint [dir],' +
        ' --roster legacy|new, --grant-push, --grants-local, --verify-pin, --repin,' +
        ' or --uninstall --ignore-manifest)'
    );
  } else if (!dirArg) dirArg = a;
  else fail('Unexpected extra argument: ' + a);
}
if (rosterArg !== null && rosterArg !== 'legacy' && rosterArg !== 'new') {
  fail('--roster must be "legacy" or "new", got: ' + JSON.stringify(rosterArg));
}
const roster = rosterArg || 'legacy';
if (grantPushFlag && uninstall) {
  fail('--grant-push does nothing with --uninstall — grants are removed by uninstall itself.');
}
if (grantsLocalFlag && uninstall) {
  fail('--grants-local does nothing with --uninstall — grants are removed from wherever they were written.');
}
if (verifyPinFlag && (uninstall || scanArg !== null || lintFlag || updateFlag)) {
  fail('--verify-pin runs alone against one target: node install.js [targetDir] --verify-pin');
}
if (repinFlag && (uninstall || scanArg !== null || lintFlag || updateFlag)) {
  fail('--repin runs alone against one target: node install.js [targetDir] --repin');
}
// --ignore-manifest (item 7, WO-14b leg-3 fix round 2B): the escape hatch
// for a malformed .claude/orchestra.json that otherwise locks --uninstall
// out entirely (refuseIfTargetMalformed refuses the WHOLE run, uninstall
// included, on a file the owner cannot fix without hand-editing it first).
// Only means something paired with --uninstall.
if (ignoreManifestFlag && !uninstall) {
  fail('--ignore-manifest only means something with --uninstall: node install.js [targetDir] --uninstall --ignore-manifest');
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
  if (rosterArg !== null || grantPushFlag) {
    fail(
      '--scan cannot be combined with --roster/--grant-push, for the same reason as ' +
        "--packs/--specialists above: change a project's roster or grants by installing " +
        'into it directly.'
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
const settingsLocalFile = path.join(dotClaude, 'settings.local.json'); // --grants-local target
const stateFile = path.join(dotClaude, STATE_FILE);
const claudeMd = path.join(target, 'CLAUDE.md');
const orchestraMd = path.join(dotClaude, 'ORCHESTRA.md');
const pauseFile = path.join(dotClaude, 'orchestra.pause');
const gitattributesFile = path.join(dotClaude, '.gitattributes');
const mcpFile = path.join(target, '.mcp.json');
const orchestraJsonFile = path.join(dotClaude, ORCHESTRA_MANIFEST_FILE);
const conductorFile = path.join(dotClaude, ROSTER_CONDUCTOR_DEST);
const orchestraRuntimeDir = path.join(dotClaude, ORCHESTRA_RUNTIME_DIRNAME);

// --verify-pin: read-only, runs alone against one target, before any of the
// mutation below (and before refuseIfTargetMalformed, since it only reads
// bytes and a hash — it does not need the manifest to be well-formed to
// report MISMATCH/NO-PIN honestly).
if (verifyPinFlag) {
  const status = verifyPinStatus(target, orchestraJsonFile);
  if (status.status === 'NO-PIN') {
    console.log('NO-PIN — no pin recorded for this project' + (status.reason ? ' (' + status.reason + ')' : ' (looked for ' + status.pf + ')'));
    process.exit(1);
  }
  if (status.status === 'MATCH') {
    console.log('MATCH — .claude/orchestra.json matches the pin recorded ' + status.pin.writtenAt + ' (' + status.pf + ')');
    process.exit(0);
  }
  if (status.status === 'MOVED') {
    console.log('MOVED — no pin at this path, but the manifest\'s projectId resolves to a pin recorded ' + status.pin.writtenAt + ' at a different location, and its hash MATCHES the manifest here (' + status.idPf + ')');
    console.log('  pinned projectDir (old): ' + status.pin.projectDir);
    console.log('  actual projectDir (new): ' + status.realDir);
    console.log('  Trusted (item 5: found by id, hash matches). Run --repin to also write a path-keyed pin for this location.');
    process.exit(0);
  }
  // MISMATCH
  console.log('MISMATCH — .claude/orchestra.json has changed since the pin was written (' + (status.pf && fs.existsSync(status.pf) ? status.pf : status.idPf) + ')');
  console.log('  pin projectDir:     ' + status.pin.projectDir);
  console.log('  actual projectDir:  ' + status.realDir);
  console.log('  pin manifestSha256: ' + status.pin.manifestSha256);
  console.log('  actual sha256:      ' + (status.actualSha || '(unavailable — ' + (status.reason || 'manifest missing') + ')'));
  process.exit(1);
}

// --repin (item 5): promotes a MOVED verdict (a relocated project, still
// trusted because its hash matches the id-keyed pin) into a fresh
// path-keyed pin at the new location — never usable to manufacture trust:
// refused unless verifyPinStatus itself already says MOVED.
if (repinFlag) {
  const status = verifyPinStatus(target, orchestraJsonFile);
  if (status.status !== 'MOVED') {
    console.log('--repin refused: pin status here is ' + status.status + ', not MOVED. Nothing changed.');
    process.exit(1);
  }
  const newPin = Object.assign({}, status.pin, {
    projectDir: status.realDir,
    writtenAt: new Date().toISOString(),
  });
  const body = JSON.stringify(newPin, null, 2) + '\n';
  const pf = pinFilePath(target);
  fs.mkdirSync(path.dirname(pf), { recursive: true });
  fs.writeFileSync(pf, body, 'utf8');
  if (newPin.projectId) {
    const idPf = idPinFilePath(newPin.projectId);
    fs.mkdirSync(path.dirname(idPf), { recursive: true });
    fs.writeFileSync(idPf, body, 'utf8');
  }
  console.log('REPINNED — path-keyed pin written for the new location (' + pf + ')');
  process.exit(0);
}

// Refuse before touching ANYTHING — settings.json, settings.local.json (if
// present), .mcp.json, orchestra.json (A.4/A.5, WO-14b leg-3 fix round B
// items 5/6/7). Runs for both install and uninstall, before any fs mutation
// below (including the frontmatter lint's own file reads, which touch
// nothing in the target either way).
// Item 7 (WO-14b leg-3 fix round 2B): --uninstall --ignore-manifest skips
// this check for orchestra.json specifically — a malformed manifest must
// never lock the owner out of removing the harness, and the whole point of
// --ignore-manifest is running the uninstall's untracked path WITHOUT
// reading this file at all (not even to validate it).
const manifestMalformedCheck = uninstall && ignoreManifestFlag ? [] : [
  {
    file: orchestraJsonFile,
    checkRosterGeneration: true,
    hint: uninstall
      ? '.claude/orchestra.json may simply be deleted to proceed — --uninstall handles a project ' +
        'with no manifest cleanly once it is gone — or re-run with --uninstall --ignore-manifest ' +
        'to remove Orchestra without ever reading this file.'
      : '.claude/orchestra.json may simply be deleted to proceed, if you do not need its contents preserved.',
  },
];
refuseIfTargetMalformed([
  { file: settingsFile, checkPermissions: true },
  { file: settingsLocalFile, checkPermissions: true },
  { file: mcpFile },
].concat(manifestMalformedCheck));
// Remember each file's own indentation BEFORE anything below rewrites it —
// writeJson() re-uses this so a rewrite preserves the source formatting
// (2-space / 4-space / tab) instead of always re-serializing at 2 spaces.
rememberFormat(settingsFile);
rememberFormat(settingsLocalFile);
rememberFormat(mcpFile);
rememberFormat(orchestraJsonFile);

// Exactly what the installer stamps into .claude/.gitattributes today. Never
// compare a file against this constant byte-for-byte to decide ownership
// (see isOurGitattributes below) — it changes shape across versions (this
// revision alone added, then widened, its third pattern line), and a
// byte-exact check would stop recognizing every install a prior version
// wrote.
const GITATTRIBUTES_CONTENT = [
  '# Written by the Orchestra installer. Keep installed files LF on disk:',
  "# Claude Code's frontmatter repair pass cannot match lines with a trailing",
  '# CR, so a CRLF re-checkout (core.autocrlf) can silently drop agents whose',
  '# YAML would need that repair. Delete only if you manage line endings here.',
  '*.md text eol=lf',
  '*.js text eol=lf',
  '*.json text eol=lf',
  '',
].join('\n');

// Recognizes ANY installer-authored .claude/.gitattributes, past or future —
// not a specific version of GITATTRIBUTES_CONTENT. A file is ours if it opens
// with our header comment and every other non-empty, non-comment line is a
// plain "<pattern> text eol=lf" rule; anything that fails that shape
// (hand-authored, or genuinely edited) is left alone, same as a byte-exact
// match would have left it. CRLF-normalized first so a file re-checked-out
// under core.autocrlf=true still matches.
function isOurGitattributes(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== '# Written by the Orchestra installer. Keep installed files LF on disk:') {
    return false;
  }
  return lines.every((line) => line === '' || line.startsWith('#') || /^\S+ text eol=lf$/.test(line));
}

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
// A roster role file lands in .claude/agents/ alongside the core six and any
// specialists — a colliding name would silently overwrite one (Red Team LOW,
// 2026-09-01: reproduced with roster/scout.md clobbering agents/scout.md).
// Same refuse-before-touch discipline as assertNoCollisions() for packs.
function assertNoRosterCollisions() {
  const owners = new Map();
  for (const a of AGENTS) owners.set(a, 'the core harness');
  for (const s of availableSpecialists()) owners.set(s + '.md', 'a specialist');
  for (const f of rosterRoleFiles()) {
    if (f === ROSTER_CONDUCTOR_FILE) continue; // lands outside .claude/agents/ — not a collision risk
    const owner = owners.get(f);
    if (owner) {
      fail(
        'roster role file "' + f + '" would overwrite .claude/agents/' + f + ', owned by ' +
          owner + '. Rename it in roster/ before installing --roster new.'
      );
    }
  }
}

if (!uninstall) {
  packs.forEach(packManifest); // validate manifests before touching anything
  assertNoCollisions(packs);
  if (roster === 'new') assertNoRosterCollisions();
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
  // Roster role files (WO-14b leg-3 fix round B item 8) — required when
  // --roster new is requested, same as the core six: a silently-dropped
  // agent is the one failure class this whole lint apparatus exists to
  // prevent, and roster/*.md was the one path that bypassed it.
  if (roster === 'new') {
    for (const f of rosterRoleFiles()) {
      lintTargets.push({ file: path.join(ROSTER_DIR, f), required: true });
    }
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

  // 1a. New roster (--roster new), ALONGSIDE the legacy six (WO-15's
  // precondition — both stay installed). conductor.md is the session's own
  // standing contract, not a spawnable agent, so it lands at
  // .claude/ORCHESTRA-CONDUCTOR.md instead of .claude/agents/ (A.2).
  // sweeper.md installs like every other role file here; it is the
  // manifest's seats.Sweeper:false that marks it benched, not withholding
  // the file. Nothing below runs under --roster legacy (default): the
  // installed-file census of a legacy install is unchanged by this leg.
  const rosterFiles = roster === 'new' ? rosterRoleFiles() : [];
  // Every path this block writes under .claude/, relative to .claude/ itself
  // (forward-slashed) — recorded into the manifest below as installedFiles
  // (item 4) so --uninstall removes exactly these, and nothing it merely
  // recognizes the NAME of.
  const rosterInstalledFiles = [];
  if (rosterFiles.length) {
    const installedRoleFiles = [];
    for (const f of rosterFiles) {
      if (f === ROSTER_CONDUCTOR_FILE) continue;
      copyFileStamped(path.join(ROSTER_DIR, f), path.join(agentsDir, f));
      installedRoleFiles.push(f);
      rosterInstalledFiles.push('agents/' + f);
    }
    if (installedRoleFiles.length) {
      did('roster (new): ' + installedRoleFiles.join(', ') + ' -> .claude/agents/');
    }
    if (rosterFiles.includes(ROSTER_CONDUCTOR_FILE)) {
      copyFileStamped(path.join(ROSTER_DIR, ROSTER_CONDUCTOR_FILE), conductorFile);
      rosterInstalledFiles.push(ROSTER_CONDUCTOR_DEST);
      did('roster (new): conductor.md -> .claude/' + ROSTER_CONDUCTOR_DEST + " (the session's standing contract, not a spawnable agent)");
    }
    // Substrates as a runtime directory. leg 4 adds dispatch.js/close.js and
    // the MCP wiring here; this leg only installs what exists today.
    const installedSubstrates = [];
    for (const sub of ROSTER_SUBSTRATE_DIRS) {
      const subSrc = path.join(SRC, sub);
      if (!fs.existsSync(subSrc)) continue; // defensive — all four exist in this master
      const subDest = path.join(orchestraRuntimeDir, sub);
      fs.rmSync(subDest, { recursive: true, force: true });
      copyDir(subSrc, subDest);
      installedSubstrates.push(sub);
      for (const rel of listFilesRecursive(subDest)) {
        rosterInstalledFiles.push(ORCHESTRA_RUNTIME_DIRNAME + '/' + sub + '/' + rel);
      }
    }
    if (installedSubstrates.length) {
      did('roster (new): substrates (' + installedSubstrates.join(', ') + ') -> .claude/' + ORCHESTRA_RUNTIME_DIRNAME + '/');
    }
    // bridge/ — leg 4 creates this top-level directory; today it does not
    // exist in this master, and that absence is handled silently (no file,
    // no warning line) — the census test pins both cases.
    const bridgeSrc = path.join(SRC, ROSTER_BRIDGE_DIRNAME);
    if (fs.existsSync(bridgeSrc)) {
      const bridgeDest = path.join(orchestraRuntimeDir, ROSTER_BRIDGE_DIRNAME);
      fs.rmSync(bridgeDest, { recursive: true, force: true });
      copyDir(bridgeSrc, bridgeDest);
      for (const rel of listFilesRecursive(bridgeDest)) {
        rosterInstalledFiles.push(ORCHESTRA_RUNTIME_DIRNAME + '/' + ROSTER_BRIDGE_DIRNAME + '/' + rel);
      }
      did('roster (new): bridge/ -> .claude/' + ORCHESTRA_RUNTIME_DIRNAME + '/' + ROSTER_BRIDGE_DIRNAME + '/');
    }
  }

  // 1b. Manifest (.claude/orchestra.json) roster flag — the owner-pinned
  // value the guard's loadPolicy() and (leg 4) the runtime read (A.3). A
  // plain legacy install with no prior "new" state touches this file NOT AT
  // ALL, not even to create an empty one — the legacy install-file census
  // must stay exactly what it was before this leg (A.1). Two cases write
  // here: --roster new (create/refresh), and --roster legacy given OVER an
  // existing new install (the rollback — a flag flip, never a reinstall or
  // a file deletion: the new-roster files copied above are left in place).
  {
    const manifestExisted = fs.existsSync(orchestraJsonFile);
    const manifest = manifestExisted ? readJson(orchestraJsonFile) : {};
    const prevRoster = manifest.roster;
    if (roster === 'new') {
      const hadSeats = manifest.seats !== undefined;
      manifest.roster = 'new';
      if (!hadSeats) manifest.seats = Object.assign({}, DEFAULT_SEATS);
      // Item 5 (WO-14b leg-3 fix round 2B): mint projectId once, at the
      // first --roster new install, and preserve it on every later run —
      // it is what lets a pin survive the project directory moving (see
      // "Manifest pin" / --repin).
      if (typeof manifest.projectId !== 'string' || !manifest.projectId) {
        manifest.projectId = crypto.randomUUID();
      }
      const flipped = prevRoster !== 'new';
      if (flipped) {
        manifest.rosterGeneration =
          typeof manifest.rosterGeneration === 'number' ? manifest.rosterGeneration + 1 : 1;
      }
      // installedFiles (item 4): the exact roster/runtime paths THIS run
      // wrote, replacing whatever was tracked before — rosterRoleFiles() and
      // the substrate copy above are recomputed from the CURRENT master on
      // every --roster new run, so the tracked list must be too, or a file
      // removed from a later master would linger untracked forever.
      manifest.installedFiles = rosterInstalledFiles.slice();
      // installedHooks (leg 4c): the four bridge gate hook events this run
      // registers into .claude/settings.json (section 2, below) — recorded
      // here, in the SAME manifest write, so --uninstall and a later legacy
      // flip always know precisely what to remove without re-deriving it
      // from the CURRENT master's event list.
      manifest.installedHooks = GATE_HOOK_EVENTS.slice();
      writeManifestAndPin(target, orchestraJsonFile, manifest);
      did(
        '.claude/orchestra.json: roster="new", rosterGeneration=' + manifest.rosterGeneration +
          (flipped ? ' (bumped)' : ' (unchanged — already new)') + ', seats ' +
          (hadSeats ? 'preserved' : 'defaulted to Architect:true, Sweeper:false') +
          ', installedFiles tracks ' + manifest.installedFiles.length + ' path(s)' +
          ', installedHooks tracks ' + manifest.installedHooks.join(', ') +
          ' (every other key preserved byte-for-byte)'
      );
    } else if (manifestExisted && prevRoster === 'new') {
      manifest.roster = 'legacy';
      manifest.rosterGeneration =
        typeof manifest.rosterGeneration === 'number' ? manifest.rosterGeneration + 1 : 1;
      // installedFiles is left exactly as it was: the rollback is a flag
      // flip, never a reinstall or a deletion, so what --uninstall would
      // remove later must not change just because the flag flipped.
      // installedHooks IS cleared: unlike installedFiles (roster files stay
      // on disk across a flip), the gate hook entries are actually removed
      // from settings.json below (section 2) — the gate is inert under
      // legacy anyway, so leaving stale entries registered would be pure
      // clutter with no files left to reconcile them against.
      delete manifest.installedHooks;
      writeManifestAndPin(target, orchestraJsonFile, manifest);
      did(
        '.claude/orchestra.json: roster flipped to "legacy" (rosterGeneration bumped to ' +
          manifest.rosterGeneration + ') — the new-roster files stay installed; this is a ' +
          'rollback flag, not a reinstall'
      );
    }
    // Otherwise: --roster legacy (explicit or default) with no prior "new"
    // state — nothing touched, on purpose (A.1).
  }

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
  // Scope .claude/hooks/ to CommonJS now — before any pack hooks are copied
  // below, since it applies to all of them equally and the core install
  // always runs this path.
  stampHooksPackageJson(hooksDir);

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

  // 1b-mcp. MCP servers a pack declares are registered in the project's root
  // .mcp.json (that is where Claude Code discovers project-scope servers —
  // settings.json hooks cannot register one). Merge, never clobber: entries
  // from other tools survive, ours are overwritten by name on every run so a
  // stale registration cannot linger, and a deselected pack's names are
  // removed the same way its files are above.
  {
    const declared = packMcpServers(packs.filter((p) => availablePacks().includes(p)));
    const stale = packMcpServers(
      priorPacks.filter((p) => !packs.includes(p) && availablePacks().includes(p))
    );
    const staleNames = Object.keys(stale).filter((n) => !(n in declared));
    if (Object.keys(declared).length || staleNames.length) {
      const mcp = readJson(mcpFile);
      if (typeof mcp.mcpServers !== 'object' || mcp.mcpServers === null || Array.isArray(mcp.mcpServers)) {
        mcp.mcpServers = {};
      }
      let changed = false;
      for (const n of staleNames) {
        if (n in mcp.mcpServers) { delete mcp.mcpServers[n]; changed = true; }
      }
      for (const [n, entry] of Object.entries(declared)) {
        if (JSON.stringify(mcp.mcpServers[n]) !== JSON.stringify(entry)) {
          mcp.mcpServers[n] = entry;
          changed = true;
        }
      }
      if (changed) {
        writeJson(mcpFile, mcp);
        did(
          '.mcp.json: ' +
            (Object.keys(declared).length
              ? 'registered MCP server(s) ' + Object.keys(declared).sort().join(', ') + ' (other entries preserved)'
              : 'removed deselected pack server(s) ' + staleNames.sort().join(', '))
        );
      }
      if (Object.keys(declared).length) {
        console.log(
          '  ! First launch will ask you to approve the project MCP server(s) (' +
            Object.keys(declared).sort().join(', ') +
            '). Approve once — the cross-vendor lanes call through them.'
        );
      }
    }
  }

  let protocol = fs.readFileSync(path.join(SRC, 'ORCHESTRA.md'), 'utf8');
  if (VERSION) {
    protocol = protocol.replace(
      'Installed by the Orchestra harness.',
      'Installed by the Orchestra harness (v' + VERSION + ').'
    );
  }
  // A.2: "reference it [conductor.md] from ORCHESTRA.md". Stamped into the
  // INSTALLED copy only (this is install.js code, not a master ORCHESTRA.md
  // edit — the master's own §3.1 plan-file bullet is the only master-content
  // change this leg makes to that file, per the order's FILES list), the
  // same way the version number above is stamped rather than authored.
  if (roster === 'new') {
    protocol = protocol.replace(
      '<!-- Installed by the Orchestra harness',
      '<!-- roster:new — the session\'s standing contract is .claude/' + ROSTER_CONDUCTOR_DEST +
        ' -->\n<!-- Installed by the Orchestra harness'
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
    did('.claude/.gitattributes stamped (*.md, *.js, *.json stay LF — autocrlf cannot re-break frontmatter)');
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

  // 2a. The bridge's ticket-gate hook entries (leg 4c) — registered under
  // --roster new, tagged like the guard's own entry (isOurGateHookEntry, so
  // a re-run replaces rather than duplicates them and a user's own entries
  // for these four events are always left untouched), removed on a legacy
  // flip (the gate is inert under legacy anyway — this is hygiene, not a
  // behaviour change). A plain legacy install (never --roster new) finds
  // nothing of ours to remove, so these event keys are left exactly as
  // found — same guarantee as the guard's own PreToolUse entry above.
  const gateEventsInstalled = [];
  const gateEventsRemoved = [];
  for (const eventName of GATE_HOOK_EVENTS) {
    const priorList = Array.isArray(settings.hooks[eventName]) ? settings.hooks[eventName] : [];
    const hadOurs = priorList.some((e) => isOurGateHookEntry(e));
    const keptList = priorList.filter((e) => !isOurGateHookEntry(e));
    if (roster === 'new') {
      keptList.push(gateHookEntry(eventName));
      gateEventsInstalled.push(eventName);
    } else if (hadOurs) {
      gateEventsRemoved.push(eventName);
    }
    if (keptList.length) settings.hooks[eventName] = keptList;
    else delete settings.hooks[eventName];
  }
  if (gateEventsInstalled.length) {
    did(
      'ticket-gate hooks merged into .claude/settings.json (' + gateEventsInstalled.join(', ') +
        ' -> node .claude/orchestra/bridge/hooks/ticket-gate.js <Event>, other settings preserved)'
    );
  }
  if (gateEventsRemoved.length) {
    did(
      'ticket-gate hooks removed from .claude/settings.json (' + gateEventsRemoved.join(', ') +
        ') — the gate is inert under roster:legacy; this is hygiene, not a behaviour change'
    );
  }

  const grantsManifestExisted = fs.existsSync(orchestraJsonFile);
  const grantsPriorManifest = grantsManifestExisted ? readJson(orchestraJsonFile) : {};
  const userOwnedPerms = stringList(grantsPriorManifest.userOwnedPermissions);
  // Item 3 (WO-14b leg-3 fix round 2B, cross-vendor review #2 MAJOR):
  // installedPermissions/installedDeny are now {file, entry} pairs, not bare
  // strings — see permEntryList's comment.
  const priorTrackedPerms = permEntryList(grantsPriorManifest.installedPermissions);
  const priorTrackedDeny = permEntryList(grantsPriorManifest.installedDeny);

  // Upgrade fix (sdc-012 MAJOR / item 2, extended by item 3): a pre-existing
  // broad Bash(git push:*) is, on every install, an artifact of an
  // installer version that predates --grant-push and the exact-match
  // allowlist — dfcfc9b granted it unconditionally, and an earlier revision
  // of this master granted it under --grant-push. It is superseded either
  // way, so it is stripped unconditionally from settings.json AND
  // settings.local.json on EVERY install — not only the file this run
  // happens to write grants into (cross-vendor review #2 MAJOR: an upgrade
  // that ran with --grants-local left the broad grant standing forever in
  // the OTHER file, since only the selected grants file was ever checked) —
  // unless the manifest marks it user-owned ("userOwnedPermissions", a
  // hand-authored escape hatch nothing sets automatically).
  const strippedStalePushFiles = [];
  if (!userOwnedPerms.includes(GIT_PUSH_PERMISSION)) {
    for (const gf of [settingsFile, settingsLocalFile]) {
      const isSettingsFile = gf === settingsFile;
      if (!isSettingsFile && !fs.existsSync(gf)) continue;
      const s = isSettingsFile ? settings : readJson(gf);
      if (s.permissions && Array.isArray(s.permissions.allow) && s.permissions.allow.includes(GIT_PUSH_PERMISSION)) {
        s.permissions.allow = s.permissions.allow.filter((p) => p !== GIT_PUSH_PERMISSION);
        strippedStalePushFiles.push(path.basename(gf));
        if (!isSettingsFile) writeJson(gf, s); // settingsFile itself is written below, once, with the hook merge
      }
    }
  }

  // Merge git permission grants so the executor can commit (and, opt-in,
  // push) when a work order says to (relayed authorization is not enough —
  // see GIT_PERMISSIONS). settings.json by default; --grants-local (item 10)
  // targets settings.local.json instead — git-ignored, per-developer, so the
  // grant does not propagate to collaborators on clone. Push is behind
  // --grant-push and always arrives together with its deny counterweight
  // (B.1, sdc-012 MAJOR x2) — deny wins in Claude Code's permission
  // evaluation, so the allowlist can never authorize --force/-f/--delete/
  // --mirror even in a guard stand-down window.
  const grantsFile = grantsLocalFlag ? settingsLocalFile : settingsFile;
  const grantsFileName = path.basename(grantsFile);
  const grantsSettings = grantsFile === settingsFile ? settings : readJson(grantsFile);
  if (typeof grantsSettings.permissions !== 'object' || grantsSettings.permissions === null) {
    grantsSettings.permissions = {};
  }
  const allow = Array.isArray(grantsSettings.permissions.allow) ? grantsSettings.permissions.allow : [];

  // Push allowlist (item 3, narrowed further by item 6): an allowlist of
  // exact safe invocations, never a `:*` prefix — a deny blacklist over
  // free-form shell cannot be completed against a prefix allow (Red Team
  // HIGH, 2026-09-01: -d, --del, --mir, +refspec, :branch, origin --delete
  // all defeated the five original deny patterns while still matching
  // `Bash(git push:*)`).
  const desiredAllow = GIT_PERMISSIONS.slice();
  if (grantPushFlag) desiredAllow.push(...GIT_PUSH_SAFE_ALLOW);
  const missingPerms = desiredAllow.filter((p) => !allow.includes(p));
  grantsSettings.permissions.allow = allow.concat(missingPerms);

  let missingDeny = [];
  if (grantPushFlag) {
    const deny = Array.isArray(grantsSettings.permissions.deny) ? grantsSettings.permissions.deny : [];
    missingDeny = GIT_PUSH_DENY_PATTERNS.filter((p) => !deny.includes(p));
    grantsSettings.permissions.deny = deny.concat(missingDeny);
  }

  writeJson(settingsFile, settings);
  did(
    'PreToolUse guard merged into .claude/settings.json (' +
      (pre.length - kept.length + 1 > 1 ? 'replaced existing entry' : 'added') +
      ', other settings preserved)'
  );
  if (grantsFile !== settingsFile) writeJson(grantsFile, grantsSettings);
  did(
    'git permissions for the executor (' +
      desiredAllow.join(', ') +
      ') ' +
      (missingPerms.length ? 'merged into' : 'already present in') +
      ' .claude/' + grantsFileName + ' permissions.allow' +
      (grantsLocalFlag ? ' (--grants-local: per-developer, git-ignored, not on clone)' : '') +
      (grantPushFlag
        ? '; deny counterweight (' + GIT_PUSH_DENY_PATTERNS.join(', ') + ') ' +
          (missingDeny.length ? 'merged into' : 'already present in') + ' permissions.deny'
        : ' (push NOT granted — pass --grant-push for the exact-match allowlist, with its deny counterweight)')
  );
  if (strippedStalePushFiles.length) {
    did(
      'removed the broad Bash(git push:*) grant from .claude/' + strippedStalePushFiles.join(' and .claude/') +
        ' (checked both settings.json and settings.local.json — item 3) — installer-added by an ' +
        'older Orchestra version that granted push unconditionally (a deny blacklist over a ' +
        'prefix allow cannot be completed; see README "Push is opt-in").' +
        (grantPushFlag
          ? ' Replaced by the exact-match allowlist above.'
          : ' Pass --grant-push to get the exact-match allowlist instead, or add ' +
            '"Bash(git push:*)" to orchestra.json\'s userOwnedPermissions to keep it.')
    );
  }

  // installedPermissions / installedDeny bookkeeping (A.5, sdc-012 Sonnet
  // MINOR; items 1 and 4; reshaped to {file, entry} pairs by item 3): tracked
  // ONLY when this install writes, or has already written, a manifest for
  // grant purposes — --roster new, --grant-push, or a project this
  // installer already tracks from an earlier run. A byte-for-byte legacy
  // install (no --roster new, no --grant-push, no prior tracking) must NOT
  // create .claude/orchestra.json at all — that is the pinned legacy census
  // (item 1). Its --uninstall instead falls back to the pre-existing
  // exact-string removal of the add/commit pair (documented, sdc-012 Sonnet
  // MINOR).
  const newPermObjs = missingPerms.map((entry) => ({ file: grantsFileName, entry }));
  const newDenyObjs = missingDeny.map((entry) => ({ file: grantsFileName, entry }));
  const mergeUniquePermEntries = (prior, fresh) => {
    const out = prior.slice();
    for (const o of fresh) {
      if (!out.some((e) => e.file === o.file && e.entry === o.entry)) out.push(o);
    }
    return out;
  };
  const trackingActive =
    roster === 'new' || grantPushFlag || priorTrackedPerms.length > 0 || priorTrackedDeny.length > 0;
  if (trackingActive) {
    const trackedPerms = mergeUniquePermEntries(priorTrackedPerms, newPermObjs);
    const trackedDeny = grantPushFlag ? mergeUniquePermEntries(priorTrackedDeny, newDenyObjs) : priorTrackedDeny;
    const manifest = Object.assign({}, grantsPriorManifest, { installedPermissions: trackedPerms });
    if (trackedDeny.length) manifest.installedDeny = trackedDeny;
    else delete manifest.installedDeny;
    writeManifestAndPin(target, orchestraJsonFile, manifest);
    did(
      '.claude/orchestra.json: installedPermissions tracks (' +
        trackedPerms.map((e) => e.file + ':' + e.entry).join(', ') + ')' +
        (trackedDeny.length
          ? ', installedDeny tracks (' + trackedDeny.map((e) => e.file + ':' + e.entry).join(', ') + ')'
          : '') +
        ' for a clean --uninstall'
    );
  } else if (missingPerms.length) {
    did(
      'this legacy install is untracked by design (item 1: a plain install writes no ' +
        'orchestra.json) — --uninstall removes Bash(git add:*)/Bash(git commit:*) by exact ' +
        'string match instead'
    );
  }

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
  // Uninstall order (A.5, sdc-012 MINOR): grants, then hook/MCP entries, then
  // files — reversed from the pre-leg-3 installer, which deleted every owned
  // file BEFORE ever reading settings, so a crash or malformed settings.json
  // partway through could strand git-push grants in a project with no guard
  // left to stand between the Director and the repo. refuseIfTargetMalformed()
  // above already refused on bad JSON before any of this runs.

  // 0. Read the manifest (unless --ignore-manifest, item 7) and check the pin
  // it wrote BEFORE trusting any of its ledgers (item 2, Red Team HIGH): the
  // manifest is an ordinary project file, so a MISMATCH or NO-PIN state
  // means installedPermissions/installedDeny/installedFiles could be an
  // attacker-supplied list rather than the truth. --ignore-manifest never
  // even reads this file.
  const manifestExistsForUninstall = !ignoreManifestFlag && fs.existsSync(orchestraJsonFile);
  const priorManifest = manifestExistsForUninstall ? readJson(orchestraJsonFile) : {};
  let ledgerTrusted = true;
  let pinUntrustedReport = '';
  if (manifestExistsForUninstall) {
    const pinStatus = verifyPinStatus(target, orchestraJsonFile);
    ledgerTrusted = pinStatus.status === 'MATCH' || pinStatus.status === 'MOVED';
    if (!ledgerTrusted) {
      pinUntrustedReport =
        pinStatus.status + ' — this project\'s pin does not vouch for the .claude/orchestra.json on disk now (' +
        (pinStatus.status === 'NO-PIN'
          ? 'a manifest exists but no pin was ever recorded for it'
          : 'the pin recorded ' + ((pinStatus.pin && pinStatus.pin.writtenAt) || '(unknown time)') + ' does not match') +
        '). Refusing to trust installedPermissions/installedDeny/installedFiles — falling back to ' +
        'the untracked exact-string grant removal and canonical roster-file removal instead.';
      console.error('  ! ' + pinUntrustedReport);
    }
  }

  // 1. Grants — installer-tracked only (sdc-012 Sonnet MINOR; items 1/2/4;
  // reshaped to {file, entry} pairs by item 3): an identical string the USER
  // added independently in either file (not recorded in orchestra.json's
  // installedPermissions/installedDeny AGAINST THAT FILE) survives; only the
  // (file, entry) pair this installer itself recorded comes out of that same
  // file — a matching string tracked against settings.json is never used to
  // remove a user-owned copy of it in settings.local.json, or vice versa
  // (cross-vendor review #2 MAJOR).
  const trackedPerms = ledgerTrusted ? permEntryList(priorManifest.installedPermissions) : [];
  const trackedDeny = ledgerTrusted ? permEntryList(priorManifest.installedDeny) : [];
  const grantFiles = [settingsFile, settingsLocalFile];

  if (trackedPerms.length || trackedDeny.length) {
    // Manifest-tracked install with a trusted pin: remove exactly the
    // (file, entry) pairs tracked against EACH file, never the other one's.
    for (const gf of grantFiles) {
      if (!fs.existsSync(gf)) continue;
      const gfName = path.basename(gf);
      const settingsG = readJson(gf);
      let changed = false;
      const permsForFile = trackedPerms.filter((e) => e.file === gfName).map((e) => e.entry);
      const denyForFile = trackedDeny.filter((e) => e.file === gfName).map((e) => e.entry);
      if (permsForFile.length && settingsG.permissions && Array.isArray(settingsG.permissions.allow)) {
        const keptAllow = settingsG.permissions.allow.filter((p) => !permsForFile.includes(p));
        if (keptAllow.length !== settingsG.permissions.allow.length) {
          if (keptAllow.length > 0) settingsG.permissions.allow = keptAllow;
          else delete settingsG.permissions.allow;
          changed = true;
        }
      }
      if (denyForFile.length && settingsG.permissions && Array.isArray(settingsG.permissions.deny)) {
        const keptDeny = settingsG.permissions.deny.filter((p) => !denyForFile.includes(p));
        if (keptDeny.length !== settingsG.permissions.deny.length) {
          if (keptDeny.length > 0) settingsG.permissions.deny = keptDeny;
          else delete settingsG.permissions.deny;
          changed = true;
        }
      }
      if (changed) {
        if (settingsG.permissions && Object.keys(settingsG.permissions).length === 0) delete settingsG.permissions;
        writeJson(gf, settingsG);
        did('removed installer-added git permission grant(s) from .claude/' + gfName + ' (identical user-added entries — in this file or the other one — are preserved; ownership is tracked per file, item 3)');
      }
    }
  } else {
    // Untracked fallback (item 1: a plain legacy install never wrote a
    // manifest; item 2: a manifest exists but its pin does not vouch for
    // it) — remove the known Orchestra-authored strings by EXACT match
    // instead of trusting a ledger that might not be ours: the add/commit
    // pair (matching the pre-leg-3 installer byte-for-byte) plus the push
    // exact-match allowlist and its deny counterweight (item 2: the
    // Red Team's stranded-push-grant reproduction — installedPermissions
    // edited to `[]` used to leave every push allow/deny entry behind
    // forever). Documented limitation, sdc-012 Sonnet MINOR: an identical
    // string the user added independently is removed too.
    const fallbackAllow = GIT_PERMISSIONS.concat(GIT_PUSH_SAFE_ALLOW);
    const fallbackDeny = GIT_PUSH_DENY_PATTERNS;
    for (const gf of grantFiles) {
      if (!fs.existsSync(gf)) continue;
      const settingsG = readJson(gf);
      let changed = false;
      if (settingsG.permissions && Array.isArray(settingsG.permissions.allow)) {
        const keptAllow = settingsG.permissions.allow.filter((p) => !fallbackAllow.includes(p));
        if (keptAllow.length !== settingsG.permissions.allow.length) {
          if (keptAllow.length > 0) settingsG.permissions.allow = keptAllow;
          else delete settingsG.permissions.allow;
          changed = true;
        }
      }
      if (settingsG.permissions && Array.isArray(settingsG.permissions.deny)) {
        const keptDeny = settingsG.permissions.deny.filter((p) => !fallbackDeny.includes(p));
        if (keptDeny.length !== settingsG.permissions.deny.length) {
          if (keptDeny.length > 0) settingsG.permissions.deny = keptDeny;
          else delete settingsG.permissions.deny;
          changed = true;
        }
      }
      if (changed) {
        if (settingsG.permissions && Object.keys(settingsG.permissions).length === 0) delete settingsG.permissions;
        writeJson(gf, settingsG);
        did(
          'removed Bash(git add:*)/Bash(git commit:*)/the push allowlist+deny by exact string match from ' +
            '.claude/' + path.basename(gf) + ' (' +
            (manifestExistsForUninstall ? 'pin-untrusted fallback, item 2' : 'legacy install, untracked — sdc-012 Sonnet MINOR') +
            ')'
        );
      }
    }
  }
  if (ledgerTrusted && fs.existsSync(orchestraJsonFile) && (priorManifest.installedPermissions !== undefined || priorManifest.installedDeny !== undefined)) {
    const manifest = Object.assign({}, priorManifest);
    delete manifest.installedPermissions;
    delete manifest.installedDeny;
    if (JSON.stringify(manifest) !== JSON.stringify(priorManifest)) {
      writeJson(orchestraJsonFile, manifest);
      did('cleared installedPermissions/installedDeny bookkeeping from .claude/orchestra.json (roster/seats, if set, are left in place — user/owner-pinned)');
    }
  }

  // 2. Hook entries (settings.json PreToolUse guard + the four ticket-gate
  // events, leg 4c) and MCP registrations. The gate entries are removed
  // unconditionally by marker match here, exactly like the guard's own
  // entry — never gated on manifest/pin trust: an untrustworthy manifest is
  // still cleaned up on uninstall.
  if (fs.existsSync(settingsFile)) {
    const settings = readJson(settingsFile);
    let guardRemoved = false;
    if (settings.hooks && Array.isArray(settings.hooks.PreToolUse)) {
      const kept = settings.hooks.PreToolUse.filter((e) => !isOurHookEntry(e));
      if (kept.length !== settings.hooks.PreToolUse.length) {
        if (kept.length > 0) settings.hooks.PreToolUse = kept;
        else delete settings.hooks.PreToolUse;
        guardRemoved = true;
      }
    }
    const removedGateEvents = [];
    for (const eventName of GATE_HOOK_EVENTS) {
      if (!settings.hooks || !Array.isArray(settings.hooks[eventName])) continue;
      const keptList = settings.hooks[eventName].filter((e) => !isOurGateHookEntry(e));
      if (keptList.length !== settings.hooks[eventName].length) {
        if (keptList.length > 0) settings.hooks[eventName] = keptList;
        else delete settings.hooks[eventName];
        removedGateEvents.push(eventName);
      }
    }
    if (guardRemoved || removedGateEvents.length) {
      if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
      writeJson(settingsFile, settings);
      if (guardRemoved) did('removed guard entry from .claude/settings.json (other settings preserved)');
      if (removedGateEvents.length) {
        did(
          'removed ticket-gate hook entries from .claude/settings.json (' + removedGateEvents.join(', ') +
            ') (other settings preserved)'
        );
      }
    }
  }
  const packAgents = [];
  const packHooks = [];
  const packSkills = [];
  for (const name of availablePacks()) {
    const c = packContents(name);
    packAgents.push(...c.agents);
    packHooks.push(...c.hooks);
    packSkills.push(...c.skills);
  }
  if (fs.existsSync(mcpFile)) {
    const names = Object.keys(packMcpServers(availablePacks()));
    const mcp = readJson(mcpFile);
    if (names.length && mcp.mcpServers && typeof mcp.mcpServers === 'object') {
      let changed = false;
      for (const n of names) {
        if (n in mcp.mcpServers) { delete mcp.mcpServers[n]; changed = true; }
      }
      if (changed) {
        if (Object.keys(mcp.mcpServers).length === 0) delete mcp.mcpServers;
        if (Object.keys(mcp).length === 0) {
          fs.unlinkSync(mcpFile);
          did('removed .mcp.json (it held only Orchestra MCP registrations)');
        } else {
          writeJson(mcpFile, mcp);
          did('removed Orchestra MCP server registration(s) from .mcp.json (other entries preserved)');
        }
      }
    }
  }

  // 3. Files: core agents, specialists, pack files, hooks, skills, protocol,
  // state, pause file, .gitattributes, and the CLAUDE.md marker block.
  const agentFiles = AGENTS.concat(availableSpecialists().map((s) => s + '.md')).concat(packAgents);
  for (const a of agentFiles) {
    const f = path.join(agentsDir, a);
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed .claude/agents/' + a);
    }
  }
  const hookFiles = [GUARD, HOOKS_PACKAGE_JSON].concat(packHooks).map((h) => path.join(hooksDir, h));
  for (const f of hookFiles.concat([orchestraMd, pauseFile, stateFile])) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      did('removed ' + path.relative(target, f).replace(/\\/g, '/'));
    }
  }

  // roster:new files (role files, conductor file, runtime substrates, item
  // 4, containment-checked per item 1) — removed strictly by the manifest's
  // OWN record of what it installed (installedFiles), never by asking the
  // CURRENT master what a roster:new install would contain today. A plain
  // legacy install that never ran --roster new tracks no installedFiles, so
  // this section removes nothing, leaving any file that happens to share a
  // roster role name (e.g. a hand-authored .claude/agents/architect.md, or
  // .claude/orchestra/user-data.txt) untouched (Red Team MAJOR,
  // 2026-09-01). Directories are removed only once they are empty — never a
  // wholesale recursive delete of .claude/orchestra/ or .claude/agents/*.
  let removedRosterCount = 0;
  const touchedDirs = new Set();
  if (ledgerTrusted) {
    const trackedInstalledFiles = stringList(priorManifest.installedFiles);
    let skippedUnsafeCount = 0;
    for (const rel of trackedInstalledFiles) {
      // Item 1 (Red Team HIGH, 2026-09-01): installedFiles is an ordinary
      // manifest field an attacker (a hostile cloned repo, a compromised
      // subagent) can edit, so before deleting anything at the joined path
      // it must be proven to still resolve inside .claude/ — a `..`
      // sequence with no depth limit, or a Windows/POSIX absolute path,
      // reproduced deleting files entirely outside the project. Containment
      // is checked on the RESOLVED path, never on the raw string.
      const resolved = path.resolve(dotClaude, rel);
      const relToDot = path.relative(dotClaude, resolved);
      if (!relToDot || relToDot.startsWith('..') || path.isAbsolute(relToDot)) {
        skippedUnsafeCount++;
        console.error('  ! SKIPPED unsafe installedFiles entry (would resolve outside .claude/, never deleted): ' + rel);
        continue;
      }
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        fs.unlinkSync(resolved);
        removedRosterCount++;
        touchedDirs.add(path.dirname(resolved));
      }
    }
    if (skippedUnsafeCount) {
      did('SKIPPED ' + skippedUnsafeCount + ' unsafe installedFiles entr' + (skippedUnsafeCount === 1 ? 'y' : 'ies') + ' that would have resolved outside .claude/ — nothing outside the project was touched (item 1)');
    }
    if (removedRosterCount) {
      did('removed ' + removedRosterCount + " roster:new file(s) tracked in orchestra.json's installedFiles");
    }
  } else if (manifestExistsForUninstall) {
    // Untracked fallback (item 2): the ledger is not trusted, so remove
    // only the KNOWN Orchestra roster:new item names — the eleven roster
    // role files, ORCHESTRA-CONDUCTOR.md, and the named substrate
    // directories — never the manifest's own (possibly attacker-supplied)
    // installedFiles list.
    for (const f of rosterRoleFiles()) {
      if (f === ROSTER_CONDUCTOR_FILE) continue;
      const p = path.join(agentsDir, f);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        fs.unlinkSync(p);
        removedRosterCount++;
        touchedDirs.add(path.dirname(p));
      }
    }
    if (fs.existsSync(conductorFile) && fs.statSync(conductorFile).isFile()) {
      fs.unlinkSync(conductorFile);
      removedRosterCount++;
      touchedDirs.add(path.dirname(conductorFile));
    }
    for (const sub of ROSTER_SUBSTRATE_DIRS.concat([ROSTER_BRIDGE_DIRNAME])) {
      const d = path.join(orchestraRuntimeDir, sub);
      if (fs.existsSync(d)) {
        fs.rmSync(d, { recursive: true, force: true });
        removedRosterCount++;
      }
    }
    if (removedRosterCount) {
      did(
        'pin untrusted — removed ' + removedRosterCount + ' known Orchestra roster:new item(s) by ' +
          'canonical name/path (the eleven roster role files, ORCHESTRA-CONDUCTOR.md, the named ' +
          'substrate directories) instead of trusting installedFiles (item 2)'
      );
    }
  }
  const dirsToCheck = new Set();
  for (const d of touchedDirs) {
    let cur = d;
    while (cur === dotClaude || (cur + path.sep).startsWith(dotClaude + path.sep)) {
      dirsToCheck.add(cur);
      if (cur === dotClaude) break;
      cur = path.dirname(cur);
    }
  }
  for (const d of Array.from(dirsToCheck).sort((a, b) => b.length - a.length)) {
    if (d === dotClaude) continue;
    try {
      if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
    } catch (_) {
      /* not empty, or busy — leave it */
    }
  }

  // The stamped .gitattributes is removed only when it matches OUR shape —
  // any version we've ever written, not just today's GITATTRIBUTES_CONTENT
  // (see isOurGitattributes) — so a project stamped by an older installer
  // still gets cleaned up. A file the user edited (or wrote themselves) is
  // theirs to keep.
  try {
    if (
      fs.existsSync(gitattributesFile) &&
      isOurGitattributes(fs.readFileSync(gitattributesFile, 'utf8'))
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

  // Pin (item 9, extended by item 5): removed on uninstall even though
  // orchestra.json itself is left in place below — the guard is no longer
  // installed to honor it, and a stale pin would only cause a false
  // MISMATCH/NO-PIN/MOVED confusion later. Removes BOTH the path-keyed and
  // id-keyed copies; the manifest's own projectId (when readable) lets the
  // id-keyed copy be found even if the path-keyed one is already gone (a
  // moved project that was never --repin'd).
  const knownProjectId = manifestExistsForUninstall && typeof priorManifest.projectId === 'string' ? priorManifest.projectId : undefined;
  const removedPin = removePin(target, knownProjectId);
  if (removedPin) did('removed pin (' + removedPin + ')');

  if (fs.existsSync(orchestraJsonFile)) {
    console.log('  ! left in place (owner-pinned): .claude/orchestra.json — delete it yourself if unwanted (roster/seats survive an uninstall on purpose)');
  }

  if (actions.length === 0) console.log('  (nothing to remove — Orchestra was not installed here)');
  else console.log('\nDone. The project is back to a standard Claude Code setup.');
}
