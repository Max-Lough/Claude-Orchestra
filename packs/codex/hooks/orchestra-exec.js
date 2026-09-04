#!/usr/bin/env node
/**
 * Orchestra cross-vendor EXECUTION runner (the OPTIONAL executor engine).
 *
 * Drives an OpenAI model through the Codex CLI to CARRY OUT a work order —
 * edits, commands, builds, tests — in the project working tree. The default
 * Orchestra executors are the Claude `executor` (Sonnet) and `executor-heavy`
 * (Opus); this engine is the exceptional-case cross-vendor executor for a
 * problem with concrete prior evidence that Anthropic models struggled on it
 * — never routine work. One model: gpt-5.6-sol, high reasoning effort by
 * default.
 *
 * The `executor-codex-heavy` subagent (a thin Claude launcher) invokes this.
 * The Director itself cannot — the guard blocks its Bash — so execution
 * stays delegated.
 *
 * Usage:
 *   node orchestra-exec.js --work-order <file> \
 *     [--model <id>] [--effort <level>] [--timeout-ms <n>] \
 *     [--forbid <cmd>]... [--cd <dir>] [--no-probe]
 *
 * The work-order file is plain text the launcher wrote verbatim from what the
 * Director handed it: goal, exact scope, constraints, context, and the report
 * format. The engine gets the order, the Orchestra executor law, and the live
 * tree, and its edits ARE the deliverable.
 *
 * ------------------------------------------------------- WHICH TREE IT WRITES
 *
 * The LIVE working tree (CLAUDE_PROJECT_DIR, or --cd for a Director-prepared
 * isolated worktree). Unlike the review runner there is no pinned mode: an
 * executor's whole purpose is to mutate the tree the session is working in.
 * Two consequences the runner enforces mechanically:
 *
 *   IDLE PRECHECK — the tree is sampled twice before launch and the run is
 *   refused if it moved in between. Two agents writing one tree interleave
 *   into a state neither of them produced.
 *
 *   TREE AUDIT — the tree is fingerprinted before and after, and every path
 *   that changed during the run is listed in the report (generated build/
 *   engine churn counted separately, same allowlist as the review runner's
 *   integrity check). The engine's CHANGES section is a claim; the audit is
 *   the measurement the Director and the reviewer can hold it against. It is
 *   computed IN-PROCESS from the runner's own snapshots — never from session
 *   artifacts — and stamped with the run nonce, so it cannot be replayed.
 *
 *   REPORT INTEGRITY — every run generates a fresh nonce, injects it into the
 *   brief, and requires the engine to echo it on a final REPORT INTEGRITY
 *   line. A report without the echo (a resumed session, a replayed artifact,
 *   a stale buffer — the 2026-08-19 field incident), or a report whose
 *   CHANGES claims contradict an untouched-tree audit, is surfaced as
 *   STATUS: EXEC_UNAVAILABLE with the suspect text shown but labelled
 *   untrusted — never as STATUS: DONE. Resume-prone ORCHESTRA_EXEC_ARGS
 *   tokens (resume, --last, --continue) are refused before launch: every
 *   exec run is a fresh session by construction.
 *
 * ------------------------------------------------------------------ NO RETRY
 *
 * The review runner retries a flaky engine in a fresh checkout because a
 * review is idempotent — reading the same commit twice is the same review.
 * EXECUTION IS NOT: a half-dead engine may have half-edited the tree, and a
 * blind second attempt starts from a state the work order never described.
 * So this runner makes exactly ONE attempt. On failure it prints
 * STATUS: EXEC_UNAVAILABLE with full attribution (who killed the engine, how
 * long it ran against its cap, what it last wrote) plus the tree audit of
 * whatever the dead attempt left behind — and the Director decides: clean up
 * and re-dispatch, or route the order to a Claude executor.
 *
 * Output: a self-contained report on stdout — the engine's own final message,
 * which the brief requires in the Orchestra executor format (STATUS / CHANGES
 * / VERIFICATION / DEVIATIONS / CONCERNS), plus the runner's TREE AUDIT. The
 * launcher relays it verbatim. On any engine failure it prints a
 * STATUS: EXEC_UNAVAILABLE block instead of a fake report — an order that was
 * not carried out must never read as done. Exit code is always 0: the status
 * lives in the STATUS line, which is what the launcher and Director read.
 *
 * ---------------------------------------------------------------- ENVIRONMENT
 *
 * Settings resolve in this order, most specific first:
 *   explicit CLI flag  >  environment variable  >  .claude/orchestra.json
 *   ("codex" key)  >  built-in default.
 *
 * Project config (.claude/orchestra.json) is the durable place for these — a
 * work order saying "use a 30-minute timeout" is prose, and prose configures
 * nothing:
 *
 *   { "codex": {
 *       "execHeavyModel": "gpt-5.6-sol",
 *       "execHeavyEffort": "high",
 *       "execTimeoutMs": 1800000,
 *       "execSandbox": "workspace-write",
 *       "idleMs": 1500,
 *       "gitConfigIsolation": true,
 *       "doNotRun": ["godot"],
 *       "authProbe": true,
 *       "probeTimeoutMs": 90000,
 *       "helpersDir": "/path/to/known-good-codex-helpers",
 *       "integrityIgnore": ["*.import", ".godot/"],
 *       "integrityIgnoreDefaults": true
 *   } }
 *
 * (idleMs, gitConfigIsolation, doNotRun, authProbe, probeTimeoutMs,
 * helpersDir, and the integrity-ignore keys are SHARED with the review
 * runner — one Codex install, one set of machine facts.)
 *
 *   ORCHESTRA_EXEC_HEAVY_MODEL  Executor model (default gpt-5.6-sol).
 *   ORCHESTRA_EXEC_HEAVY_EFFORT Reasoning effort (default high — the
 *                               exceptional-order executor exists to
 *                               converge in one round; passed to codex as
 *                               `-c model_reasoning_effort=<v>`).
 *   ORCHESTRA_EXEC_TIMEOUT_MS   Max wall-clock for the run (default 1800000).
 *                               Execution runs the project's verification, so
 *                               budget it like a build+suite, not like a chat.
 *   ORCHESTRA_EXEC_SANDBOX      Codex sandbox: workspace-write (default — an
 *                               executor that cannot write is not an executor)
 *                               or read-only (dry-run; the runner warns that
 *                               no edit can land).
 *   ORCHESTRA_EXEC_IDLE_MS      Idle-precheck settle window (default 1500; 0
 *                               disables). Executing into a tree another agent
 *                               is still writing interleaves two changes.
 *   ORCHESTRA_EXEC_GIT_ISOLATION
 *                               1 (default) runs every git the run touches
 *                               against a scratch global config (a sandboxed
 *                               process often cannot read the real one, and
 *                               git then warns on every command). The user's
 *                               global user.name/user.email are copied into
 *                               the scratch config so an order that says
 *                               "commit" still can. 0 disables.
 *   ORCHESTRA_EXEC_PROBE        1 (default) runs a cheap `codex exec` echo
 *                               before the real attempt. 0 disables.
 *   ORCHESTRA_EXEC_PROBE_TIMEOUT_MS
 *                               Cap for that probe (default 90000).
 *   ORCHESTRA_EXEC_ARGS         Extra args appended to `codex exec`,
 *                               space-split (escape hatch for flag drift).
 *   ORCHESTRA_CODEX_HELPERS     Directory of known-good files mirrored into
 *                               the Codex install before the run (shared with
 *                               the review runner).
 *   CODEX_BIN                   Codex executable (default "codex"). Resolved
 *                               to its REAL path before launching — a symlink
 *                               or Windows junction breaks Codex's own
 *                               sibling-file resolution.
 *   CLAUDE_PROJECT_DIR          Project root the engine executes in
 *                               (default: cwd).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { boundedDiagnostic, boundedDiagnosticLines } = require('./orchestra-redact');

// Per-run report-integrity token, generated before anything else so every
// output path — success, failure, early refusal — can carry it. The brief
// requires the engine to echo it on a REPORT INTEGRITY line; a report that
// does not carry it did not come from the session this runner just launched
// (a resumed thread, a replayed artifact, a stale buffer — the 2026-08-19
// field incident relayed a weeks-old report, with matching stale audit, as a
// fresh STATUS: DONE), and the runner refuses to relay it as one.
const RUN_NONCE = crypto.randomBytes(8).toString('hex');

// ------------------------------------------------------------------ config

// Same allowlist as the review runner's integrity check: the churn a run that
// builds and tests is EXPECTED to produce, kept out of the audit's headline so
// the paths that matter — the actual edits — stay readable.
const DEFAULT_INTEGRITY_IGNORE = [
  // engines / asset importers
  '.godot/', '*.import', '.import/', '.mono/', '.godot-*/', 'Library/', 'Temp/',
  // language + package caches
  'node_modules/', '.venv/', 'venv/', '__pycache__/', '*.pyc', '.pytest_cache/',
  '.mypy_cache/', '.ruff_cache/', '.tox/', '.gradle/', '.m2/', '.cargo/',
  // build outputs and test artifacts
  'target/', 'build/', 'dist/', 'out/', 'obj/', '.next/', '.nuxt/', '.turbo/',
  '.cache/', 'coverage/', '.coverage', '.nyc_output/', '*.log', '*.tmp',
];

// The one Codex executor: Sol, OpenAI's flagship model, at high reasoning
// effort by default — overridable per project (codex.execHeavyModel /
// codex.execHeavyEffort, the config keys keep their existing names).
const EXEC_DEFAULTS = { model: 'gpt-5.6-sol', effort: 'high' };

// Seeded from env + defaults so the early-failure paths can already print a
// truthful header; main() layers project config and CLI flags over it.
const CONFIG = {
  model: '',
  modelSource: 'default',
  effort: '',
  effortSource: 'default',
  sandbox: (process.env.ORCHESTRA_EXEC_SANDBOX || 'workspace-write').trim(),
  timeoutMs: parseInt(process.env.ORCHESTRA_EXEC_TIMEOUT_MS || '', 10) || 1800000,
  timeoutSource: process.env.ORCHESTRA_EXEC_TIMEOUT_MS ? 'env' : 'default',
  idleMs: intOr(process.env.ORCHESTRA_EXEC_IDLE_MS, 1500),
  helpersDir: (process.env.ORCHESTRA_CODEX_HELPERS || '').trim(),
  extraArgs: (process.env.ORCHESTRA_EXEC_ARGS || '').trim(),
  bin: (process.env.CODEX_BIN || 'codex').trim(),
  resolvedBin: '',
  // Directory the resolved binary lives in, prepended to the engine's PATH —
  // some Codex helpers are resolved by NAME rather than relative to the
  // binary. See childEnv().
  installDir: '',
  projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  execDir: '',
  execDirLabel: '',
  forbidden: [],
  gitIsolation: process.env.ORCHESTRA_EXEC_GIT_ISOLATION !== '0',
  probe: process.env.ORCHESTRA_EXEC_PROBE !== '0',
  probeTimeoutMs: intOr(process.env.ORCHESTRA_EXEC_PROBE_TIMEOUT_MS, 90000),
  integrityIgnore: [],
  integrityIgnoreDefaults: true,
};

function intOr(raw, fallback) {
  const n = parseInt(raw == null ? '' : String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// ------------------------------------------------------------------ helpers

function parseArgs(argv) {
  const out = { forbid: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--work-order') out.workOrder = argv[++i];
    else if (a === '--model') out.model = argv[++i];
    else if (a === '--effort') out.effort = argv[++i];
    else if (a === '--timeout-ms') out.timeoutMs = argv[++i];
    else if (a === '--forbid') out.forbid.push(argv[++i]);
    else if (a === '--cd') out.cd = argv[++i];
    else if (a === '--no-probe') out.noProbe = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function readFileOr(file, fallback) {
  if (!file) return fallback;
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (_) {
    return fallback;
  }
}

function tail(text, n) {
  return boundedDiagnosticLines(text, n);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [];
}

function indent(text, pad) {
  if (!text) return '';
  return String(text)
    .replace(/\s+$/, '')
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}

function ms(n) {
  return n >= 10000 ? Math.round(n / 1000) + 's' : n + 'ms';
}

const SIGNAL_NAMES = {
  1: 'SIGHUP', 2: 'SIGINT', 3: 'SIGQUIT', 4: 'SIGILL', 6: 'SIGABRT', 8: 'SIGFPE',
  9: 'SIGKILL', 11: 'SIGSEGV', 13: 'SIGPIPE', 14: 'SIGALRM', 15: 'SIGTERM',
  24: 'SIGXCPU', 25: 'SIGXFSZ', 31: 'SIGSYS',
};

// Same tiny glob as the review runner's integrity allowlist.
function globToRegExp(pattern) {
  const dirOnly = pattern.endsWith('/');
  const p = dirOnly ? pattern.slice(0, -1) : pattern;
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        re += '.*';
        i++;
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('(^|/)' + re + (dirOnly ? '(/|$)' : '$'));
}

function matchesAny(rel, patterns) {
  const norm = String(rel).replace(/\\/g, '/');
  for (const pat of patterns) {
    try {
      if (globToRegExp(pat).test(norm)) return true;
    } catch (_) {
      /* a broken pattern never matches */
    }
  }
  return false;
}

// Launch the engine — same cmd.exe routing as the review runner: node refuses
// to spawn `.cmd`/`.bat` directly (BatBadBut, CVE-2024-27980), and on Windows
// a `codex` installed through npm IS a `.cmd` shim.
function spawnEngine(bin, args, opts) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(String(bin))) {
    const line = [bin]
      .concat(args)
      .map((a) => '"' + String(a).replace(/"/g, '""') + '"')
      .join(' ');
    return spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', '"' + line + '"'],
      Object.assign({}, opts, { windowsVerbatimArguments: true })
    );
  }
  return spawnSync(bin, args, opts);
}

function copyInto(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copyInto(path.join(src, entry), path.join(dest, entry));
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  try {
    fs.chmodSync(dest, st.mode);
  } catch (_) {
    /* mode is best-effort (and meaningless on Windows) */
  }
}

function sleepSync(msec) {
  if (!(msec > 0)) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, msec);
}

function loadProjectConfig(projectDir) {
  try {
    const raw = fs.readFileSync(path.join(projectDir, '.claude', 'orchestra.json'), 'utf8');
    const cfg = JSON.parse(raw);
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  } catch (_) {
    return {};
  }
}

function loadVerification(projectCfg) {
  const v = projectCfg && projectCfg.verification;
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

// ------------------------------------------------------ scratch and git env
//
// A small scratch directory per run — the isolated git config, the probe's
// output file, and the engine's final-message file. No worktrees: execution
// happens in the live tree by design.

const SCRATCH = { dir: '', gitConfigFile: '', torndown: false };

function makeScratchDir() {
  const roots = [os.tmpdir()];
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) roots.push(home);
  const tried = [];
  for (const root of roots) {
    try {
      return { dir: fs.mkdtempSync(path.join(root, 'orchestra-exec-')), error: '' };
    } catch (e) {
      tried.push(root + ' (' + boundedDiagnostic((e && e.message) || e, 2000) + ')');
    }
  }
  return { dir: '', error: 'no writable scratch root — tried: ' + tried.join('; ') };
}

function teardownScratch() {
  if (SCRATCH.torndown || !SCRATCH.dir) return;
  SCRATCH.torndown = true;
  try {
    fs.rmSync(SCRATCH.dir, { recursive: true, force: true });
  } catch (_) {
    /* a leaked temp dir is a cosmetic loss, not a correctness one */
  }
}

// Same isolation as the review runner, with one executor-specific addition:
// the user's global identity is COPIED IN. Dropping the global config also
// drops user.name/user.email, and an executor whose order says "commit" would
// then fail every commit with "Please tell me who you are" — so the scratch
// config carries the identity forward while still silencing the unreadable
// excludes/attributes probing that sandboxed reviewers and executors hit.
function setupGitIsolation() {
  if (!CONFIG.gitIsolation || !SCRATCH.dir) return;
  const identity = (key) => {
    // Read with the REAL environment — the point is to rescue values from the
    // config the isolation is about to hide.
    const r = spawnSync('git', ['config', '--global', '--get', key], { encoding: 'utf8' });
    return r.status === 0 ? (r.stdout || '').trim() : '';
  };
  const name = identity('user.name');
  const email = identity('user.email');
  const empty = path.join(SCRATCH.dir, 'git-empty');
  const cfg = path.join(SCRATCH.dir, 'gitconfig');
  try {
    fs.writeFileSync(empty, '', 'utf8');
    fs.writeFileSync(
      cfg,
      '# Written by orchestra-exec.js for this run only.\n' +
        '[core]\n' +
        '\texcludesFile = ' + empty.replace(/\\/g, '/') + '\n' +
        '\tattributesFile = ' + empty.replace(/\\/g, '/') + '\n' +
        '[safe]\n' +
        '\tdirectory = *\n' +
        (name || email
          ? '[user]\n' +
            (name ? '\tname = ' + name + '\n' : '') +
            (email ? '\temail = ' + email + '\n' : '')
          : ''),
      'utf8'
    );
    SCRATCH.gitConfigFile = cfg;
  } catch (e) {
    PREFLIGHT.push('git config isolation unavailable: ' + boundedDiagnostic((e && e.message) || e, 2000));
  }
}

function childEnv(extra) {
  const env = Object.assign({}, process.env, extra || {});
  if (SCRATCH.gitConfigFile) {
    env.GIT_CONFIG_GLOBAL = SCRATCH.gitConfigFile;
    env.GIT_CONFIG_NOSYSTEM = '1';
  }
  // Carried from the review runner (v1.5.0), because both lanes drive the SAME
  // Codex install and the failure it fixes is silent in both: not every helper
  // Codex needs is resolved relative to its own binary —
  // `codex-windows-sandbox-setup.exe` is resolved by NAME, and without it the
  // sandbox is never established, so the engine runs and produces nothing while
  // every other preflight line reports a healthy install. That cost the review
  // lane six days (2026-08-12 → 08-18); an execution lane failing the same way
  // would report an order as attempted and changed nothing. Putting the install
  // directory FIRST on the engine's PATH makes a correctly-placed helper
  // findable however the user's PATH is arranged. It cannot mask a missing file
  // — an empty directory adds no names — so this widens where a present helper
  // is found, never substituting for the check (`--doctor` on the review
  // runner is that check, and it covers this install for both lanes).
  if (CONFIG.installDir) {
    // Windows environment blocks are case-insensitive and the real key is
    // usually `Path`; adding a second `PATH` key would be a coin flip over
    // which one the child sees.
    const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    const cur = String(env[key] || '');
    const same = (a, b) =>
      process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
    let already = false;
    for (const part of cur.split(path.delimiter)) {
      if (!part) continue;
      try {
        if (same(path.resolve(part), path.resolve(CONFIG.installDir))) already = true;
      } catch (_) {
        /* an unresolvable PATH entry is simply not a match */
      }
    }
    if (!already) env[key] = CONFIG.installDir + (cur ? path.delimiter + cur : '');
  }
  return env;
}

function runGit(args, cwd) {
  return spawnSync('git', args, {
    cwd: cwd || undefined,
    encoding: 'utf8',
    env: childEnv(),
    maxBuffer: 64 * 1024 * 1024,
  });
}

// --------------------------------------------------------- binary resolution

function whichSync(cmd) {
  const isWin = process.platform === 'win32';
  const exts = isWin
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : [''];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch (_) {
        /* keep looking */
      }
    }
  }
  return '';
}

// A CODEX_BIN pointing at a symlink or Windows junction breaks Codex's own
// sibling-file resolution — hand it the real path. (The full install-layout
// detection and helper-sibling repair live in the review runner, which runs
// far more often; a machine whose install a self-update stripped is repaired
// by pointing helpersDir here too, or by any review run.)
function resolveCodexBin(bin) {
  const located = bin.includes('/') || bin.includes('\\') ? bin : whichSync(bin);
  if (!located) return { path: bin, real: false, note: '' };
  try {
    const real = fs.realpathSync(located);
    return {
      path: real,
      real: true,
      note: real !== located ? 'resolved through a link: ' + located + ' -> ' + real : '',
    };
  } catch (_) {
    return { path: located, real: false, note: '' };
  }
}

function restoreHelpers(helpersDir, installDir) {
  if (!helpersDir || !installDir) return { restored: [], note: '' };
  let entries;
  try {
    entries = fs.readdirSync(helpersDir);
  } catch (e) {
    return { restored: [], note: 'helpersDir unreadable (' + boundedDiagnostic((e && e.message) || e, 2000) + ')' };
  }
  const restored = [];
  for (const entry of entries) {
    const dest = path.join(installDir, entry);
    if (fs.existsSync(dest)) continue;
    try {
      copyInto(path.join(helpersDir, entry), dest);
      restored.push(entry);
    } catch (e) {
      return {
        restored,
        note: 'helper restore failed on ' + entry + ' (' + boundedDiagnostic((e && e.message) || e, 2000) + ')',
      };
    }
  }
  return { restored, note: '' };
}

// --------------------------------------------------------- tree fingerprint

function porcelainPath(line) {
  let p = line.slice(3);
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + 4);
  if (p.startsWith('"') && p.endsWith('"')) return '';
  return p;
}

// Same annotated fingerprint as the review runner: status letters alone miss
// an append to an already-modified file, so each dirty path carries its size
// and mtime. Also captures HEAD, so a run that commits (as some orders
// instruct) shows up as a moved HEAD rather than as paths silently leaving
// the dirty set.
function treeFingerprint(dir) {
  const r = runGit(['-C', dir, 'status', '--porcelain=v1', '--untracked-files=all']);
  if (r.error || r.status !== 0) return null;
  const head = runGit(['-C', dir, 'rev-parse', 'HEAD']);
  const lines = (r.stdout || '').split('\n').filter((l) => l.trim());
  const map = new Map();
  const annotated = lines.map((line) => {
    const rel = porcelainPath(line);
    let out = line;
    if (rel) {
      try {
        const st = fs.statSync(path.join(dir, rel));
        out = line + ' [' + st.size + '@' + st.mtimeMs + ']';
      } catch (_) {
        /* deleted, unreadable, or quoted — the line still counts */
      }
    }
    map.set(rel || line, out);
    return out;
  });
  return {
    text: annotated.join('\n'),
    map,
    head: head.status === 0 ? (head.stdout || '').trim() : '',
  };
}

function fingerprintDelta(before, after, ignore) {
  const changed = [];
  const keys = new Set([...before.map.keys(), ...after.map.keys()]);
  for (const key of keys) {
    const b = before.map.get(key);
    const a = after.map.get(key);
    if (b === a) continue;
    changed.push({
      path: key,
      how: b === undefined ? 'appeared' : a === undefined ? 'left the dirty set' : 'changed',
    });
  }
  changed.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  return {
    source: changed.filter((c) => !matchesAny(c.path, ignore)),
    generated: changed.filter((c) => matchesAny(c.path, ignore)),
  };
}

// ------------------------------------------------------------------ brief
// The Orchestra executor law, in one place, so every cross-vendor execution
// carries the identical discipline the Claude executors carry — same scope
// rules, same honesty rules, same report format the Director and reviewer
// already parse.

function prohibitionLines(forbidden) {
  if (!forbidden.length) return [];
  return [
    'PROHIBITED COMMANDS — ABSOLUTE, OUTRANKS EVERYTHING BELOW',
    'You must NOT execute the following, in any form, wrapper, or variation:',
    ...forbidden.map((f) => '- ' + f),
    'If the work order\'s verification depends on a prohibited command, do not',
    'run it: report the affected verification as "not run (prohibited: <cmd>)"',
    'in VERIFICATION, and say what you ran instead. A prohibition is a hard',
    'constraint from the project, not a suggestion to overrule.',
    '',
  ];
}

function manifestLines(verification) {
  if (!verification) return [];
  const lines = ['PROJECT VERIFICATION MANIFEST (from .claude/orchestra.json)'];
  if (typeof verification.full === 'string' && verification.full.trim()) {
    lines.push('- full verification: ' + verification.full.trim());
  }
  if (typeof verification.lint === 'string' && verification.lint.trim()) {
    lines.push('- lint: ' + verification.lint.trim());
  }
  const shards = stringList(verification.shards);
  if (shards.length) {
    lines.push('- shards (independently runnable; all of them together = full):');
    for (const s of shards) lines.push('  - ' + s.trim());
  }
  const protectedSuites = stringList(verification.protected);
  if (protectedSuites.length) {
    lines.push('- protected suites (must pass, unmodified by the change):');
    for (const p of protectedSuites) lines.push('  - ' + p.trim());
  }
  if (lines.length === 1) return [];
  lines.push('Use these canonical commands when you verify; do not guess.');
  lines.push('');
  return lines;
}

function buildBrief(workOrder, verification, forbidden) {
  return [
    'You are the EXECUTOR in a multi-agent engineering harness. A Director',
    '(who never touches the code) wrote the work order below; your edits and',
    'commands are the deliverable. You are in the project working tree with',
    'shell access. An independent adversarial reviewer will audit the diff',
    'against this order and re-run the verification — your report is evidence',
    'for that review, never approval of your own work.',
    '',
    'RULES',
    '1. Execute the order, the whole order, nothing but the order. Touch only',
    '   in-scope files. No drive-by refactors, no "while I\'m here" cleanups,',
    '   no scope expansion — even obvious ones. Something worth fixing outside',
    '   scope goes in CONCERNS, not in the diff. Exception: trivially forced',
    '   adjustments (an import the change obviously requires, a rename ripple',
    '   in the same file) — make them and list them under DEVIATIONS.',
    '2. Blocked beats guessed. If the order turns out ambiguous, contradictory,',
    '   or wrong once you are in the code (a named file does not exist, the',
    '   described function has a different signature, the approach cannot',
    '   work), STOP and report STATUS: BLOCKED with the precise question or',
    '   contradiction — leave the tree untouched or clearly note any partial',
    '   changes. A sharp question outranks a confident wrong implementation.',
    '3. Match the house style. Your code should read like the surrounding code',
    '   wrote it: same naming, idiom, comment density, error handling.',
    '4. Verify your own work. Run what the order specifies; if it specifies',
    '   nothing, run the obviously relevant checks (affected tests, build,',
    '   linter — the VERIFICATION MANIFEST below is canonical where present).',
    '   Paste real output. Never run less than the order\'s declared',
    '   verification tier; running more is allowed and noted under DEVIATIONS.',
    '5. Never claim untested success. If you did not run it, write "not run" —',
    '   plainly. A failing test reported honestly is a good report; "should',
    '   work" is not a status.',
    '6. Stop grinding, report state. If the same check fails twice with',
    '   substantively the same signature despite two different fixes, or you',
    '   complete 3 fix-verify cycles without converging, stop and report',
    '   STATUS: PARTIAL or BLOCKED with each attempt, its pasted failure',
    '   output, what you ruled out, and the exact tree state (what remains vs.',
    '   was reverted). A documented dead end is a deliverable; a fourth guess',
    '   is not.',
    '7. Git is scoped like everything else: stage, commit, or push ONLY when',
    '   the work order explicitly says to (checkpoint-commit clauses included),',
    '   and never rewrite history. No order = leave the changes uncommitted in',
    '   the working tree.',
    '8. Follow the order\'s cadence clauses. If it numbers parts and names a',
    '   progress file, append one status line there after each part, before',
    '   starting the next.',
    '',
    'OUTPUT — end your final message with EXACTLY this structure (it is the',
    'report the Director will read; make it self-contained, no "see above").',
    'Do not wrap it in code fences.',
    '',
    'STATUS: DONE | PARTIAL | BLOCKED | CHECKPOINT',
    '',
    'CHANGES',
    '- <path:line> — <what changed and why, one line each — or "none">',
    '',
    'VERIFICATION',
    '- <command run> → <actual result; paste the key output lines, especially',
    '  failures — or "not run", stated plainly>',
    '',
    'DEVIATIONS',
    '- <anything done beyond, short of, or differently than the order — or',
    '  "none">',
    '',
    'CONCERNS',
    '- <risks, smells, or follow-ups the Director should weigh — or "none">',
    '',
    'REPORT INTEGRITY: <run token>',
    '',
    'On the REPORT INTEGRITY line, replace <run token> with exactly this',
    'run\'s token: ' + RUN_NONCE + ' — typed verbatim, alone on that final',
    'line. The line is mandatory: it is how the runner proves your report',
    'came from THIS run rather than from a resumed or replayed session, and',
    'it refuses any report that does not carry the token on that line. Do',
    'not repeat the token anywhere else in your report.',
    '',
    ...prohibitionLines(forbidden),
    ...manifestLines(verification),
    '=== WORK ORDER (from the Director — execute exactly this) ===',
    workOrder.trim() || '(none provided)',
    '',
  ].join('\n');
}

// ----------------------------------------------------------- exit forensics
// Same attribution discipline as the review runner: a failure report that
// lists causes it did not test is a shrug with citations. Node sets
// error.code ETIMEDOUT when ITS OWN timer fired, so the runner never guesses
// about its own kill.

function classifyExit(run, elapsedMs) {
  const cap = CONFIG.timeoutMs;
  const ran =
    'ran for ' + ms(elapsedMs) + ' of the ' + cap + 'ms cap' +
    (cap > 0 ? ' (' + Math.round((elapsedMs / cap) * 100) + '%)' : '');

  if (run.error && run.error.code === 'ENOENT') {
    return {
      kind: 'not-found',
      headline: "Codex CLI not found (tried '" + (CONFIG.resolvedBin || CONFIG.bin) + "')",
      killedBy: 'nothing ran — the executable could not be launched',
      ran,
    };
  }
  if (run.error && run.error.code === 'ETIMEDOUT') {
    return {
      kind: 'runner-timeout',
      headline: 'execution timed out after ' + cap + 'ms (cap from: ' + CONFIG.timeoutSource + ')',
      killedBy:
        'THIS RUNNER — its own ' + cap + 'ms timer fired and terminated codex. ' +
        'Nothing about codex, your auth, or your flags is implicated by this exit.',
      ran,
    };
  }
  if (run.signal) {
    return {
      kind: 'signal',
      headline: 'codex was killed by ' + run.signal + ' before reporting',
      killedBy:
        'an EXTERNAL signal (' + run.signal + ') — NOT this runner: its ' + cap +
        'ms timer had not fired when the child died.',
      ran,
    };
  }
  const st = run.status;
  if (typeof st === 'number' && st > 128 && st < 192) {
    const num = st - 128;
    const name = SIGNAL_NAMES[num] || 'signal ' + num;
    return {
      kind: 'signal-status',
      headline: 'codex exited with status ' + st + ' (' + name + '-class: 128+' + num + ')',
      killedBy:
        'NOT this runner — its ' + cap + 'ms timer had not fired. A 128+N status means ' +
        'something inside the codex process tree was terminated by ' + name + '.',
      ran,
    };
  }
  if (run.error) {
    return {
      kind: 'spawn-error',
      headline: 'failed to launch Codex: ' + boundedDiagnostic(run.error.message || run.error, 2000),
      killedBy: 'the launch itself failed (' + (run.error.code || 'no code') + ')',
      ran,
    };
  }
  if (st == null) {
    return {
      kind: 'unknown',
      headline: 'codex ended without reporting an exit status',
      killedBy:
        'unknown — the platform reported no exit status, no signal, and no launch error. ' +
        'This runner\'s ' + cap + 'ms timer did not fire.',
      ran,
    };
  }
  if (st !== 0) {
    return {
      kind: 'exit',
      headline: 'Codex exited with status ' + st,
      killedBy:
        'nobody — codex chose to exit with status ' + st + ' while this runner\'s ' + cap +
        'ms timer was still running.',
      ran,
    };
  }
  return { kind: 'ok', headline: '', killedBy: '', ran };
}

function failureDiagnostics(att) {
  const lines = [
    'ATTEMPT 1 of 1 — ' + att.class.headline,
    '  killed by:  ' + att.class.killedBy,
    '  elapsed:    ' + att.class.ran,
    '  tree:       ' + CONFIG.execDirLabel + ' (' + CONFIG.execDir + ')',
  ];
  const err = tail(att.stderr || '', 25);
  lines.push('  codex stderr (last 25 lines):');
  lines.push(err ? indent(err, '    ') : '    (codex wrote nothing to stderr)');
  const out = tail(att.stdout || '', 10);
  if (out) {
    lines.push('  codex stdout (last 10 lines):');
    lines.push(indent(out, '    '));
  }
  if (att.class.kind === 'exit') {
    lines.push(
      '  candidate causes for a self-chosen non-zero exit: not authenticated (set ' +
        'OPENAI_API_KEY or run `codex login`), a model id this account cannot use ' +
        '(model: ' + (CONFIG.model || 'codex default') + '), an unsupported flag on this ' +
        'Codex version (check `codex exec --help`, adjust ORCHESTRA_EXEC_ARGS), or a ' +
        'sandbox restriction — including an install missing a helper the sandbox ' +
        'needs. Both lanes share one Codex install; inspect and repair it with ' +
        '`node .claude/hooks/orchestra-review.js --doctor`.'
    );
  }
  if (att.class.kind === 'runner-timeout') {
    lines.push(
      '  raise the cap where it takes effect — "codex": { "execTimeoutMs": <ms> } in ' +
        '.claude/orchestra.json, ORCHESTRA_EXEC_TIMEOUT_MS, or --timeout-ms. A timeout ' +
        'named only in a work order\'s prose does nothing. Execution runs the project\'s ' +
        'verification, so budget it like a build plus a suite.'
    );
  }
  return lines.join('\n');
}

// ------------------------------------------------------------- stage-a probe
// Same asymmetry as the review runner's: a probe that FAILS is decisive, a
// probe that merely times out is a warning — a slow engine still works.

const PROBE_TOKEN = 'ORCHESTRA_PROBE_OK';
function runAuthProbe(dir) {
  const outFile = path.join(SCRATCH.dir, 'probe.txt');
  const args = ['exec', '--sandbox', CONFIG.sandbox, '--cd', dir, '--output-last-message', outFile];
  args.push('-c', 'features.hooks=false', '-c', 'project_doc_max_bytes=0');
  if (CONFIG.model) args.push('--model', CONFIG.model);
  args.push('-');
  const started = Date.now();
  const r = spawnEngine(CONFIG.resolvedBin || CONFIG.bin, args, {
    cwd: dir,
    input:
      'Reply with exactly this token and nothing else: ' + PROBE_TOKEN + '\n' +
      'Do not read files, run commands, or explain.',
    encoding: 'utf8',
    timeout: CONFIG.probeTimeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    env: childEnv({ ORCHESTRA_ROLE: 'executor-codex-external' }),
  });
  const elapsed = Date.now() - started;
  const said = (readFileOr(outFile, '') || r.stdout || '').trim();
  if (r.error && r.error.code === 'ETIMEDOUT') {
    return {
      ok: true,
      warn:
        'auth/exec probe did not finish inside ' + CONFIG.probeTimeoutMs + 'ms — proceeding ' +
        'anyway (a slow engine is still a working engine; raise probeTimeoutMs, or set ' +
        '"authProbe": false, if this is normal here)',
    };
  }
  if (r.error && r.error.code === 'ENOENT') {
    return {
      ok: false,
      reason: "Codex CLI not found (tried '" + (CONFIG.resolvedBin || CONFIG.bin) + "')",
      detail:
        'Install the Codex CLI and put it on PATH, or set CODEX_BIN to its path. ' +
        'See https://developers.openai.com/codex/',
    };
  }
  if (r.error) {
    return {
      ok: false,
      reason: 'the Codex CLI could not be launched (' + (r.error.code || 'spawn error') + ')',
      detail:
        'Launching ' + (CONFIG.resolvedBin || CONFIG.bin) + ' failed before any execution ' +
        'was attempted:\n  ' + boundedDiagnostic(r.error.message || r.error, 2000) + '\n' +
        'This is the executable or the platform refusing the launch — not authentication, ' +
        'and not the model.',
    };
  }
  if (r.status !== 0 || !said) {
    const cls = classifyExit(r, elapsed);
    return {
      ok: false,
      reason: 'the Codex engine failed a trivial echo before the order was attempted',
      detail:
        'A ' + CONFIG.probeTimeoutMs + 'ms stage-a probe asked codex to echo one token and ' +
        'it did not.\n' +
        '  outcome:   ' + (cls.kind === 'ok' ? 'exited 0 but produced no output' : cls.headline) + '\n' +
        '  elapsed:   ' + ms(elapsed) + '\n' +
        '  model:     ' + (CONFIG.model || 'codex default') + '\n' +
        '  stderr:\n' + (indent(tail(r.stderr || '', 20), '    ') || '    (nothing)') + '\n' +
        'Most often this is authentication (set OPENAI_API_KEY or run `codex login`), a ' +
        'model id this account cannot use, or a broken install. The order was NOT ' +
        'attempted and the tree was NOT touched. Disable the probe with "codex": ' +
        '{ "authProbe": false } or ORCHESTRA_EXEC_PROBE=0 if it is wrong about your setup.',
    };
  }
  return {
    ok: true,
    note:
      'auth/exec probe: ok in ' + ms(elapsed) +
      (said.includes(PROBE_TOKEN) ? '' : ' (engine answered, though not with the exact token)'),
  };
}

// ------------------------------------------------------------------ output

const PREFLIGHT = [];

function settingsBits() {
  return [
    'model: ' + (CONFIG.model || 'codex default') + ' (' + CONFIG.modelSource + ')',
    'effort: ' + (CONFIG.effort || 'codex default'),
    'sandbox: ' + CONFIG.sandbox,
    'timeout: ' + CONFIG.timeoutMs + 'ms (' + CONFIG.timeoutSource + ')',
    'attempts: 1 (execution is never auto-retried)',
  ].concat(CONFIG.forbidden.length ? ['prohibited commands: ' + CONFIG.forbidden.length] : [])
    .concat(CONFIG.execDirLabel ? ['tree: ' + CONFIG.execDirLabel] : []);
}

function headerTail() {
  // The nonce is part of the header on EVERY path, so any two runs' outputs
  // are distinguishable at a glance — a relayed report whose nonce does not
  // match the launch it claims to answer is a replay, whatever it says.
  let out = '\nRUN NONCE: ' + RUN_NONCE;
  if (CONFIG.resolvedBin && CONFIG.resolvedBin !== CONFIG.bin) {
    out += '\nCODEX BINARY: ' + CONFIG.resolvedBin;
  }
  for (const note of PREFLIGHT) out += '\nPREFLIGHT: ' + note;
  return out;
}

// Only ever printed above a report an OpenAI model actually produced.
function engineHeader() {
  return 'EXEC ENGINE: OpenAI via Codex CLI (' + settingsBits().join(', ') + ')' + headerTail();
}

// A header is an attribution — the failure path names no engine, exactly as
// the review runner's does, so a failed run can never be relayed as
// cross-vendor work that happened.
function unavailableHeader() {
  return (
    'EXEC ENGINE: NONE — no cross-vendor execution was produced.\n' +
    'ATTEMPTED: OpenAI via Codex CLI (' + settingsBits().join(', ') + ')' +
    headerTail()
  );
}

// The audit the engine cannot write for itself: which paths actually moved
// while it ran. Source paths are the headline; generated build/engine churn
// is counted so a suite run does not bury the edits.
function auditLines(delta, headBefore, headAfter) {
  // Every audit ends with its provenance: it is measured IN-PROCESS by this
  // runner, from fingerprints it took itself around the engine invocation.
  // It never comes from session artifacts, engine output, or files a prior
  // run could have left behind — so an audit carrying this run's nonce
  // cannot be a replay of an earlier run's audit.
  const provenance =
    'Audit measured in-process by this runner (run token ' + RUN_NONCE + ') from its own\n' +
    'before/after tree fingerprints — never from engine or session artifacts.';
  if (!delta) {
    return [
      'TREE AUDIT: unavailable — the directory is not a git work tree (or git is',
      'unavailable), so the runner could not fingerprint it. The CHANGES section',
      'above is the engine\'s own claim, unverified by the runner.',
      provenance,
    ].join('\n');
  }
  const lines = [];
  const shown = delta.source.slice(0, 60);
  if (delta.source.length) {
    lines.push(
      'TREE AUDIT: ' + delta.source.length + ' path(s) changed while the engine ran' +
        ' (' + shown.length + ' shown):'
    );
    lines.push(...shown.map((c) => '  ' + c.how + ': ' + c.path));
    if (delta.source.length > shown.length) {
      lines.push('  …and ' + (delta.source.length - shown.length) + ' more');
    }
  } else {
    lines.push('TREE AUDIT: no source paths changed while the engine ran.');
  }
  if (delta.generated.length) {
    lines.push(
      '  (+' + delta.generated.length + ' further path(s) matching the generated build/engine-' +
        'churn allowlist — caches, build outputs — not listed above.)'
    );
  }
  if (headBefore !== headAfter) {
    lines.push(
      '  HEAD moved: ' + (headBefore || '(none)').slice(0, 12) + ' → ' +
        (headAfter || '(none)').slice(0, 12) + ' — the engine made commit(s); paths those ' +
        'commits cleaned from the dirty set may show above as "left the dirty set".'
    );
  }
  lines.push(
    'Hold the CHANGES section above against this list: an edit claimed but not',
    'listed here did not happen; a listed path the report never mentions is',
    'unexplained work.'
  );
  lines.push(provenance);
  return lines.join('\n');
}

function printReport(body, audit) {
  process.stdout.write(
    engineHeader() + '\n\n' + body.replace(/\s+$/, '') + '\n\n' + audit +
      '\nREPORT INTEGRITY: verified — the engine echoed run token ' + RUN_NONCE +
      ', and the report does not contradict the tree audit.\n'
  );
}

function printUnavailable(reason, detail, att, audit, suspectBody) {
  const safeReason = boundedDiagnostic(reason, 4000);
  const safeDetail = boundedDiagnostic(detail, 16000);
  const block = [
    'STATUS: EXEC_UNAVAILABLE',
    '',
    'REASON',
    '- ' + safeReason,
    '',
    'DETAIL',
    safeDetail ? safeDetail.split('\n').map((l) => '  ' + l).join('\n') : '  (none)',
    '',
    'FINALITY: this runner made ' + (att ? 'one' : 'no') + ' engine attempt and will make no',
    'more. Execution is deliberately never auto-retried: a half-dead engine may',
    'have half-edited the tree, and a blind second attempt would start from a',
    'state the work order never described. The TREE AUDIT below is what this run',
    'left behind; the Director decides — clean up and re-dispatch, or route the',
    'order to a Claude executor (`executor` / `executor-heavy`).',
    '',
    'The cross-vendor executor did not complete, and nothing below this line',
    'came from an OpenAI model. Do NOT treat this order as executed.',
  ].join('\n');
  const diag = att ? '\n\n--- ATTEMPT LOG ---\n' + failureDiagnostics(att) : '';
  // When an integrity check discarded an engine report, the Director still
  // needs to SEE what was discarded — labelled as untrusted, never as the
  // report of this run.
  const suspect = suspectBody
    ? '\n\n--- UNVERIFIED ENGINE OUTPUT (integrity check failed — possibly a replay of a\n' +
      '--- previous session; do not act on it as this run\'s report) ---\n' +
      indent(boundedDiagnostic(suspectBody, 16000), '  ')
    : '';
  process.stdout.write(
    unavailableHeader() + '\n\n' + block + (audit ? '\n\n' + audit : '') + suspect + diag + '\n'
  );
}

// The CHANGES section of an executor report, parsed just far enough to know
// whether the engine CLAIMED concrete edits. Returns null when no CHANGES
// section is found (the missing-STATUS note already covers malformed shapes),
// otherwise the list of claim lines that are not "none".
function changesClaims(body) {
  const m = /^CHANGES\s*$/m.exec(body);
  if (!m) return null;
  const lines = body.slice(m.index).split('\n').slice(1);
  const items = [];
  for (const line of lines) {
    if (/^[A-Z][A-Z ]{2,}\s*$/.test(line)) break; // next section header
    const im = /^\s*[-*]\s*(.+)$/.exec(line);
    if (im) items.push(im[1].trim());
    else if (line.trim() !== '' && items.length) break;
  }
  return items.filter((t) => !/^["'(]?\s*none\b/i.test(t) && !/^n\/a\b/i.test(t));
}

// ------------------------------------------------------------------ main

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: node orchestra-exec.js --work-order <file>\n' +
        '         [--model <id>] [--effort <level>] [--timeout-ms <n>]\n' +
        '         [--forbid <cmd>]... [--cd <dir>] [--no-probe]\n' +
        '\n' +
        '  Carries out an Orchestra work order via an OpenAI model driven by the\n' +
        '  Codex CLI, in the LIVE working tree. One attempt, never auto-retried —\n' +
        '  a failed execution may have mutated the tree, and only the Director\n' +
        '  can decide what a second attempt should start from.\n'
    );
    return;
  }

  // --- settings: project config, then env (already seeded), then flags.
  const projectCfg = loadProjectConfig(CONFIG.projectDir);
  const codexCfg =
    projectCfg.codex && typeof projectCfg.codex === 'object' && !Array.isArray(projectCfg.codex)
      ? projectCfg.codex
      : {};

  // Resolution: flag > env > orchestra.json (codex.execHeavyModel /
  // codex.execHeavyEffort) > default (gpt-5.6-sol / high). One model, one
  // effort — there is no selectable tier.
  if (args.model && args.model.trim()) {
    CONFIG.model = args.model.trim();
    CONFIG.modelSource = 'flag';
  } else if (process.env.ORCHESTRA_EXEC_HEAVY_MODEL && process.env.ORCHESTRA_EXEC_HEAVY_MODEL.trim()) {
    CONFIG.model = process.env.ORCHESTRA_EXEC_HEAVY_MODEL.trim();
    CONFIG.modelSource = 'env';
  } else if (typeof codexCfg.execHeavyModel === 'string' && codexCfg.execHeavyModel.trim()) {
    CONFIG.model = codexCfg.execHeavyModel.trim();
    CONFIG.modelSource = 'orchestra.json';
  } else {
    CONFIG.model = EXEC_DEFAULTS.model;
    CONFIG.modelSource = 'default';
  }

  if (args.effort && args.effort.trim()) {
    CONFIG.effort = args.effort.trim();
    CONFIG.effortSource = 'flag';
  } else if (process.env.ORCHESTRA_EXEC_HEAVY_EFFORT && String(process.env.ORCHESTRA_EXEC_HEAVY_EFFORT).trim() !== '') {
    CONFIG.effort = String(process.env.ORCHESTRA_EXEC_HEAVY_EFFORT).trim();
    CONFIG.effortSource = 'env';
  } else if (typeof codexCfg.execHeavyEffort === 'string' && codexCfg.execHeavyEffort.trim()) {
    CONFIG.effort = codexCfg.execHeavyEffort.trim();
    CONFIG.effortSource = 'orchestra.json';
  } else {
    CONFIG.effort = EXEC_DEFAULTS.effort;
    CONFIG.effortSource = 'default';
  }

  if (!process.env.ORCHESTRA_EXEC_SANDBOX && typeof codexCfg.execSandbox === 'string') {
    CONFIG.sandbox = codexCfg.execSandbox.trim();
  }
  if (!process.env.ORCHESTRA_EXEC_TIMEOUT_MS && codexCfg.execTimeoutMs != null) {
    const t = intOr(codexCfg.execTimeoutMs, 0);
    if (t > 0) {
      CONFIG.timeoutMs = t;
      CONFIG.timeoutSource = 'orchestra.json';
    }
  }
  if (args.timeoutMs != null) {
    const t = intOr(args.timeoutMs, 0);
    if (t > 0) {
      CONFIG.timeoutMs = t;
      CONFIG.timeoutSource = 'flag';
    }
  }
  if (!process.env.ORCHESTRA_EXEC_IDLE_MS && codexCfg.idleMs != null) {
    CONFIG.idleMs = intOr(codexCfg.idleMs, CONFIG.idleMs);
  }
  if (!process.env.ORCHESTRA_EXEC_GIT_ISOLATION && codexCfg.gitConfigIsolation != null) {
    CONFIG.gitIsolation = codexCfg.gitConfigIsolation !== false;
  }
  if (!process.env.ORCHESTRA_EXEC_PROBE && codexCfg.authProbe != null) {
    CONFIG.probe = codexCfg.authProbe !== false;
  }
  if (!process.env.ORCHESTRA_EXEC_PROBE_TIMEOUT_MS && codexCfg.probeTimeoutMs != null) {
    CONFIG.probeTimeoutMs = intOr(codexCfg.probeTimeoutMs, CONFIG.probeTimeoutMs);
  }
  if (!process.env.ORCHESTRA_CODEX_HELPERS && typeof codexCfg.helpersDir === 'string') {
    CONFIG.helpersDir = codexCfg.helpersDir.trim();
  }
  if (args.noProbe) CONFIG.probe = false;
  if (codexCfg.integrityIgnoreDefaults === false) CONFIG.integrityIgnoreDefaults = false;
  CONFIG.integrityIgnore = (CONFIG.integrityIgnoreDefaults ? DEFAULT_INTEGRITY_IGNORE : [])
    .concat(stringList(codexCfg.integrityIgnore).map((s) => s.trim()));

  const forbidden = [];
  for (const f of stringList(codexCfg.doNotRun)) forbidden.push(f.trim());
  for (const f of args.forbid) if (f && f.trim()) forbidden.push(f.trim());
  CONFIG.forbidden = forbidden.filter((f, i) => forbidden.indexOf(f) === i);

  // Which tree does the engine write? The project by default; --cd for a
  // Director-prepared isolated worktree (parallel disjoint orders).
  CONFIG.execDir = (args.cd && args.cd.trim()) || CONFIG.projectDir;
  CONFIG.execDirLabel =
    CONFIG.execDir === CONFIG.projectDir ? 'live working tree' : 'directed worktree';

  // Fresh-session enforcement: this runner's guarantees — the idle precheck,
  // the tree audit, the report-integrity token — are all statements about ONE
  // freshly launched engine session. An extra arg that resumes a previous
  // Codex session/thread ("resume", "--last", experimental_resume=...) makes
  // the engine's final message a message from some OTHER run, which is
  // exactly the stale-replay failure the integrity token exists to catch.
  // Refuse up front rather than launching a run whose report is disqualified
  // by construction.
  const resumeTokens = CONFIG.extraArgs
    ? CONFIG.extraArgs.split(/\s+/).filter(
        (t) => /resume/i.test(t) || t === '--last' || t === '--continue'
      )
    : [];
  if (resumeTokens.length) {
    printUnavailable(
      'ORCHESTRA_EXEC_ARGS would resume a previous Codex session',
      'These token(s) in ORCHESTRA_EXEC_ARGS resume or continue an earlier session: ' +
        resumeTokens.join(', ') + '\n' +
        'Every exec run must be a FRESH session: a resumed thread can hand back a\n' +
        'previous run\'s final message as if it were this run\'s report (observed in\n' +
        'the field as a weeks-old report relayed as STATUS: DONE for a brand-new\n' +
        'order). Remove the flag(s) from ORCHESTRA_EXEC_ARGS and re-dispatch.\n' +
        'Nothing was attempted and the tree was not touched.'
    );
    return;
  }

  const workOrder = readFileOr(args.workOrder, '');
  if (!workOrder.trim()) {
    printUnavailable(
      'no work order',
      '--work-order was missing, unreadable, or empty. The launcher must pass the ' +
        'Director\'s work order verbatim in a file.'
    );
    return;
  }
  if (!fs.existsSync(CONFIG.execDir) || !fs.statSync(CONFIG.execDir).isDirectory()) {
    printUnavailable(
      'execution directory does not exist',
      CONFIG.execDir + ' is not a directory. Nothing was attempted.'
    );
    return;
  }
  if (CONFIG.sandbox === 'read-only') {
    PREFLIGHT.push(
      'sandbox is read-only: the engine can analyze and report but NO edit can land — ' +
        'this is a dry run, not an execution. Set execSandbox to workspace-write for real orders.'
    );
  }

  // --- scratch + git isolation, before the first git call.
  const scratch = makeScratchDir();
  if (!scratch.dir) {
    printUnavailable('no writable scratch directory', scratch.error);
    return;
  }
  SCRATCH.dir = scratch.dir;
  setupGitIsolation();

  // --- preflight: resolve the real binary, mirror the repair kit.
  const resolved = resolveCodexBin(CONFIG.bin);
  CONFIG.resolvedBin = resolved.path;
  // Set before the probe: childEnv() puts this first on the engine's PATH, and
  // the probe must run under the same conditions the real attempt will.
  CONFIG.installDir = resolved.real ? path.dirname(resolved.path) : '';
  if (resolved.note) PREFLIGHT.push(resolved.note);
  if (CONFIG.helpersDir) {
    const restore = restoreHelpers(CONFIG.helpersDir, CONFIG.installDir);
    if (restore.restored.length) {
      PREFLIGHT.push(
        'restored ' + restore.restored.length + ' file(s) into the Codex install from ' +
          CONFIG.helpersDir + ': ' + restore.restored.join(', ')
      );
    }
    if (restore.note) PREFLIGHT.push(restore.note);
  }

  // --- stage-a probe: can this install run codex at all? Costs seconds,
  // runs before the tree is touched.
  if (CONFIG.probe) {
    const probe = runAuthProbe(CONFIG.execDir);
    if (!probe.ok) {
      printUnavailable(probe.reason, probe.detail);
      return;
    }
    if (probe.note) PREFLIGHT.push(probe.note);
    if (probe.warn) PREFLIGHT.push(probe.warn);
  }

  // --- idle precheck + baseline. Executing into a tree another agent is
  // still writing interleaves two changes into a state neither produced.
  let before = treeFingerprint(CONFIG.execDir);
  if (CONFIG.idleMs > 0 && before !== null) {
    sleepSync(CONFIG.idleMs);
    const settled = treeFingerprint(CONFIG.execDir);
    if (settled !== null && settled.text !== before.text) {
      printUnavailable(
        'working tree is not idle',
        'The tree changed during a ' + CONFIG.idleMs + 'ms settle window, so something ' +
          'else is still writing it (a running executor, a build, a watch task). ' +
          'Executing into a moving tree interleaves two changes. Wait for the other ' +
          'work to finish and re-dispatch. To disable the check, set ' +
          'ORCHESTRA_EXEC_IDLE_MS=0 (or "codex": { "idleMs": 0 }).\n' +
          'git status delta:\n--- first sample ---\n' + before.text.trim() +
          '\n--- second sample ---\n' + settled.text.trim()
      );
      return;
    }
    if (settled !== null) before = settled;
  }

  const brief = buildBrief(workOrder, loadVerification(projectCfg), CONFIG.forbidden);

  // --- the one attempt.
  const lastMsgFile = path.join(SCRATCH.dir, 'report.txt');
  const codexArgs = ['exec', '--sandbox', CONFIG.sandbox, '--cd', CONFIG.execDir];
  if (CONFIG.model) codexArgs.push('--model', CONFIG.model);
  if (CONFIG.effort) codexArgs.push('-c', 'model_reasoning_effort=' + CONFIG.effort);
  codexArgs.push('--output-last-message', lastMsgFile);
  if (CONFIG.extraArgs) codexArgs.push(...CONFIG.extraArgs.split(/\s+/).filter(Boolean));
  // Keep the coexistence boundary last: Codex resolves repeated -c values in
  // order, so ORCHESTRA_EXEC_ARGS must not be able to re-enable a co-installed
  // Codex-Orchestra's project instructions or hooks.
  codexArgs.push('-c', 'features.hooks=false', '-c', 'project_doc_max_bytes=0');
  codexArgs.push('-'); // read the brief from stdin

  const startedAt = Date.now();
  const run = spawnEngine(CONFIG.resolvedBin || CONFIG.bin, codexArgs, {
    cwd: CONFIG.execDir,
    input: brief,
    encoding: 'utf8',
    timeout: CONFIG.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: childEnv({ ORCHESTRA_ROLE: 'executor-codex-external' }),
  });
  const elapsed = Date.now() - startedAt;

  const att = {
    elapsed,
    stderr: run.stderr || '',
    stdout: run.stdout || '',
    class: classifyExit(run, elapsed),
  };

  // The audit runs on EVERY path — a dead engine's debris is exactly what the
  // Director needs to see before deciding what happens next.
  const after = treeFingerprint(CONFIG.execDir);
  const delta =
    before !== null && after !== null
      ? fingerprintDelta(before, after, CONFIG.integrityIgnore)
      : null;
  const audit = auditLines(
    delta,
    before !== null ? before.head : '',
    after !== null ? after.head : ''
  );

  // Prefer the clean final-message file; fall back to stdout if the flag was
  // a no-op on this version. A report is a report even when the exit status
  // was non-zero — the engine's output is the product, not its exit code.
  const report = readFileOr(lastMsgFile, '').trim();
  let body = report || (att.class.kind === 'ok' ? tail(att.stdout, 400).trim() : '');
  if (body && att.class.kind !== 'ok') {
    PREFLIGHT.push(
      att.class.headline + ', but a final report had already been written — using it (' +
        att.class.ran + ')'
    );
  }

  if (!body) {
    printUnavailable(
      att.class.headline || 'the engine produced nothing',
      'The engine died (or said nothing) before reporting. Attribution — who killed ' +
        'it, how long it ran against its cap, and what it last wrote — is in the ' +
        'ATTEMPT LOG below. The TREE AUDIT records what the attempt left behind.' +
        (att.class.kind === 'ok' || att.class.kind === 'exit'
          ? '\nAn engine that runs, exits, and changes nothing is also the signature of ' +
            'an incomplete Codex install: the sandbox helper is resolved by NAME, so a ' +
            'copy that is missing — or merely one directory too deep — leaves the sandbox ' +
            'unestablished and the run a no-op. Both lanes share one install; check and ' +
            'repair it with `node .claude/hooks/orchestra-review.js --doctor` before ' +
            're-dispatching.'
          : ''),
      att,
      audit
    );
    return;
  }

  // --- report integrity, check 1: the nonce echo. The brief requires the
  // engine to end its report with `REPORT INTEGRITY: <this run's token>`. A
  // resumed session, a replayed rollout, or a stale buffer cannot know the
  // token, so a body without it is treated as NO report from this run — the
  // discarded text is still shown, labelled untrusted, because the Director
  // must see what almost got relayed. The token must sit on the REPORT
  // INTEGRITY line itself: codex may echo the brief (where the token appears
  // on an instruction line, never in that composed form) into stdout, and an
  // echo must not count as an answer.
  if (!new RegExp('^REPORT INTEGRITY:\\s*' + RUN_NONCE + '\\s*$', 'm').test(body)) {
    printUnavailable(
      'report integrity check failed — the engine\'s report does not echo this run\'s token',
      'This run\'s token is ' + RUN_NONCE + '. The brief required the engine to end its\n' +
        'report with a `REPORT INTEGRITY: ' + RUN_NONCE + '` line, and the report the\n' +
        'runner captured carries no such line (or a different token). That is the\n' +
        'signature of a STALE report — a resumed Codex session or a replayed artifact\n' +
        'handing back some earlier run\'s final message — or of an engine that ignored\n' +
        'a mandatory output rule; either way the report cannot be attributed to this\n' +
        'run. The TREE AUDIT below is trustworthy regardless: the runner measured it\n' +
        'itself, in-process, around this launch. Use it to see what this attempt\n' +
        'actually did to the tree before deciding what happens next.',
      att,
      audit,
      body
    );
    return;
  }

  // --- report integrity, check 2: the report must not contradict the audit.
  // An engine that claims concrete CHANGES while the runner measured a
  // byte-for-byte untouched tree (no source paths, no generated churn, HEAD
  // unmoved) is describing some other tree — a stale report that happens to
  // carry the right token cannot exist, but an engine hallucinating work, or
  // reporting "already present" edits it never made, can. Skipped for
  // read-only dry runs, where no claim could have landed by design.
  const claims = changesClaims(body);
  const treeUntouched =
    delta !== null &&
    delta.source.length === 0 &&
    delta.generated.length === 0 &&
    before !== null && after !== null && before.head === after.head;
  if (CONFIG.sandbox !== 'read-only' && claims && claims.length && treeUntouched) {
    printUnavailable(
      'report integrity check failed — the report claims edits the runner measured as never happening',
      'The report\'s CHANGES section claims ' + claims.length + ' edit(s):\n' +
        indent(claims.slice(0, 10).map((c) => '- ' + c).join('\n'), '  ') +
        (claims.length > 10 ? '\n  …and ' + (claims.length - 10) + ' more' : '') + '\n' +
        'but the runner\'s own before/after fingerprints show a tree that did not\n' +
        'change at all while the engine ran: no source paths, no generated churn,\n' +
        'HEAD unmoved. A report and an audit that contradict each other must never\n' +
        'be relayed as a completed order. Treat the order as NOT executed.',
      att,
      audit,
      body
    );
    return;
  }

  // The Director parses the STATUS line; a report without one is a report the
  // loop cannot route. Never invent a status — flag it instead.
  if (!/^STATUS:\s*(DONE|PARTIAL|BLOCKED|CHECKPOINT)\b/m.test(body)) {
    body +=
      '\n\nRUNNER NOTE: the engine\'s report carries no STATUS: DONE | PARTIAL | ' +
      'BLOCKED | CHECKPOINT line. Treat this order as PARTIAL until the Director ' +
      'has read the report and the tree audit — do not assume DONE.';
  }

  printReport(body, audit);
}

try {
  main();
} catch (e) {
  // Never throw an unhandled error back at the launcher — degrade to
  // EXEC_UNAVAILABLE so a crash cannot read as anything else.
  try {
    printUnavailable('exec runner error', boundedDiagnostic((e && e.stack) || e, 16000));
  } catch (_) {
    process.stdout.write('STATUS: EXEC_UNAVAILABLE\n');
  }
} finally {
  teardownScratch();
}
