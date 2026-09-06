#!/usr/bin/env node
/**
 * Orchestra cross-vendor EXECUTION runner (the OPTIONAL executor engine).
 *
 * Drives an OpenAI model through the Codex CLI to CARRY OUT a work order —
 * edits, commands, builds, tests — in the project working tree. The default
 * Orchestra executors are the Claude `executor` (Sonnet), `executor-heavy`
 * (Opus) and `executor-principal` (Fable); this engine is the exceptional-case
 * cross-vendor executor for a problem with concrete prior evidence that
 * Anthropic models struggled on it — never routine work.
 *
 * Two rungs, selected by `--profile` and nothing else:
 *
 *   heavy      (default)   GPT-5.6 Sol at high effort
 *   principal              GPT-6 Astra at xhigh effort
 *
 * The rungs differ ONLY in model and effort — same sandbox, same idle
 * precheck, same tree audit, same one-attempt law, same report contract, and
 * each reads its own env vars and config keys. A run that names no profile
 * behaves exactly as this file did before the principal rung existed.
 *
 * The `executor-codex-heavy` and `executor-codex-principal` subagents (thin
 * Claude launchers) invoke this. The Director itself cannot — the guard
 * blocks its Bash — so execution stays delegated.
 *
 * Usage:
 *   node orchestra-exec.js --work-order <file> \
 *     [--profile heavy|principal] [--model <id>] [--effort <level>] \
 *     [--timeout-ms <n>] [--forbid <cmd>]... [--cd <dir>] [--no-probe]
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
 *       "execPrincipalModel": "gpt-6-astra",
 *       "execPrincipalEffort": "xhigh",
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
 *   ORCHESTRA_EXEC_HEAVY_MODEL  Heavy-rung model (default gpt-5.6-sol).
 *   ORCHESTRA_EXEC_HEAVY_EFFORT Heavy-rung reasoning effort (default high —
 *                               the exceptional-order executor exists to
 *                               converge in one round; passed to codex as
 *                               `-c model_reasoning_effort=<v>`).
 *   ORCHESTRA_EXEC_PRINCIPAL_MODEL
 *                               Principal-rung model (default gpt-6-astra).
 *   ORCHESTRA_EXEC_PRINCIPAL_EFFORT
 *                               Principal-rung reasoning effort (default
 *                               xhigh; Astra's ladder is
 *                               low|medium|high|xhigh|max, with no `none`).
 *                               Only the SELECTED profile reads its own pair;
 *                               the other rung's vars are ignored entirely.
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
 *                               git then warns on every command). The scratch
 *                               config INCLUDES the user's real global config
 *                               (credential helpers, LFS filters, URL
 *                               rewrites — git skips the include silently
 *                               where the sandbox cannot read it) and carries
 *                               user.name/user.email and filter.lfs.* across
 *                               explicitly, so an order that says "commit"
 *                               still can and an LFS-tracked tree does not
 *                               read as modified. 0 disables.
 *   ORCHESTRA_EXEC_MCP          strip (default) disables every MCP server the
 *                               user's Codex config declares, plus the Codex
 *                               apps connector, for the engine child — an
 *                               executor that can delegate to a same-vendor
 *                               MCP or push through a GitHub connector is
 *                               neither cross-vendor nor sandboxed. inherit
 *                               leaves the engine's MCP config alone.
 *                               ("codex": { "engineMcp": "strip"|"inherit" })
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

// The Codex executor rungs. Two named PROFILES, each with its own model,
// effort, env vars and config keys — nothing else about the run differs, and
// there is no effort ladder to select inside a profile (the removed `--tier`
// flag was exactly that, and is not coming back).
//
//   heavy     GPT-5.6 Sol at high     — the exceptional-order rung
//   principal GPT-6 Astra at xhigh    — the rung above it
//
// `heavy` is the default, so a run that names no profile behaves exactly as
// it did before the principal rung existed, down to the config keys it reads.
const EXEC_PROFILES = {
  heavy: {
    model: 'gpt-5.6-sol',
    effort: 'high',
    modelEnv: 'ORCHESTRA_EXEC_HEAVY_MODEL',
    effortEnv: 'ORCHESTRA_EXEC_HEAVY_EFFORT',
    modelKey: 'execHeavyModel',
    effortKey: 'execHeavyEffort',
  },
  principal: {
    model: 'gpt-6-astra',
    effort: 'xhigh',
    modelEnv: 'ORCHESTRA_EXEC_PRINCIPAL_MODEL',
    effortEnv: 'ORCHESTRA_EXEC_PRINCIPAL_EFFORT',
    modelKey: 'execPrincipalModel',
    effortKey: 'execPrincipalEffort',
  },
};
const DEFAULT_PROFILE = 'heavy';

// Seeded from env + defaults so the early-failure paths can already print a
// truthful header; main() layers project config and CLI flags over it.
const CONFIG = {
  profile: DEFAULT_PROFILE,
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
  engineMcp: (process.env.ORCHESTRA_EXEC_MCP || '').trim().toLowerCase(),
  mcpLabel: '',
  mcpArgs: [],
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
    else if (a === '--profile') out.profile = argv[++i];
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

// Notes about the SETTINGS themselves, surfaced in the header's PREFLIGHT.
// Same reason as the review runner: a file that exists and did not apply — bad
// JSON, or a codex key written one level too high — used to be indistinguishable
// from no config at all, and the run then used a default nobody chose.
const CONFIG_NOTES = [];

const CODEX_ONLY_KEYS = [
  'execTimeoutMs', 'execHeavyModel', 'execHeavyEffort',
  'execPrincipalModel', 'execPrincipalEffort', 'execSandbox', 'doNotRun',
  'reviewModel', 'reviewTimeoutMs', 'reviewSandbox', 'helpersDir', 'gitConfigIsolation',
  'crossplanModel', 'crossplanEffort', 'engineMcp',
];

// Still fail-open — a missing or broken file means no project settings, never a
// dead run — but a setting that did not land now says so.
function loadProjectConfig(projectDir) {
  const file = path.join(projectDir, '.claude', 'orchestra.json');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code !== 'ENOENT') {
      CONFIG_NOTES.push(
        file + ' could not be read (' + (e.code || e.message) + ') — every project setting ' +
          'in it was IGNORED and built-in defaults applied'
      );
    }
    return {};
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    CONFIG_NOTES.push(
      file + ' is not valid JSON (' + ((e && e.message) || 'parse error') + ') — every ' +
        'project setting in it was IGNORED and built-in defaults applied'
    );
    return {};
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    CONFIG_NOTES.push(file + ' is not a JSON object — every project setting in it was IGNORED');
    return {};
  }
  const misplaced = CODEX_ONLY_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(cfg, k));
  if (misplaced.length) {
    CONFIG_NOTES.push(
      file + ': ' + misplaced.join(', ') + ' ' + (misplaced.length === 1 ? 'is' : 'are') +
        ' at the TOP LEVEL and therefore ignored — these belong under "codex": { ... }'
    );
  }
  return cfg;
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

// The files git itself reads as the "global" config, in git's own order:
// $XDG_CONFIG_HOME/git/config (or ~/.config/git/config) and then ~/.gitconfig.
// Resolved from the REAL environment, before GIT_CONFIG_GLOBAL is pointed at
// the scratch file. Only files that exist are returned.
function globalGitConfigFiles() {
  // Git's own precedence, not os.homedir()'s: HOME first (on Windows too —
  // Git for Windows honours a set HOME over USERPROFILE), then
  // HOMEDRIVE+HOMEPATH, then the OS profile.
  const home =
    (process.env.HOME || '').trim() ||
    ((process.env.HOMEDRIVE || '') && (process.env.HOMEPATH || '') ? process.env.HOMEDRIVE + process.env.HOMEPATH : '') ||
    os.homedir();
  const xdg = (process.env.XDG_CONFIG_HOME || '').trim() || (home ? path.join(home, '.config') : '');
  const candidates = [];
  if ((process.env.GIT_CONFIG_GLOBAL || '').trim()) candidates.push(process.env.GIT_CONFIG_GLOBAL.trim());
  else {
    if (xdg) candidates.push(path.join(xdg, 'git', 'config'));
    if (home) candidates.push(path.join(home, '.gitconfig'));
  }
  return candidates.filter((f) => {
    try {
      return fs.statSync(f).isFile();
    } catch (_) {
      return false;
    }
  });
}

// `[include] path = …` lines for the real global config. Git resolves an
// include it cannot read (ENOENT or EACCES) by skipping it SILENTLY — so in a
// sandbox that can read the user's home this carries credential helpers, LFS
// filters, URL rewrites and identity across untouched, and in one that cannot
// it costs nothing and warns nothing. Overrides written after the include win.
function gitIncludeSection(files) {
  if (!files.length) return '';
  const quote = (p) => '"' + p.replace(/\\/g, '/').replace(/"/g, '\\"') + '"';
  return '[include]\n' + files.map((f) => '\tpath = ' + quote(f) + '\n').join('');
}

// Git LFS registers its clean/smudge filters in the user's GLOBAL config
// (`git lfs install`). The include above carries them where the sandbox can
// read that file; this explicit copy is for where it cannot. Without the
// filters, every LFS-tracked file compares against its pointer and reads as
// MODIFIED — 15 untouched PNGs under docs/art/** looked dirty to Astra
// (field, 2026-09-06), which correctly refused a "clean tree" precondition.
function lfsFilterSection() {
  const lfs = spawnSync('git', ['config', '--global', '--get-regexp', '^filter\\.lfs\\.'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (lfs.status !== 0 || !lfs.stdout) return '';
  const entries = lfs.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const sp = l.indexOf(' ');
      const key = sp === -1 ? l : l.slice(0, sp);
      const val = sp === -1 ? '' : l.slice(sp + 1);
      const m = /^filter\.lfs\.([A-Za-z]+)$/.exec(key);
      // Quoted, with backslashes and quotes escaped: a value such as
      // "C:\Program Files\Git LFS\git-lfs.exe" clean -- %f written bare is a
      // "bad config line" that breaks every later git command (Astra, round 2).
      return m ? '\t' + m[1] + ' = "' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"\n' : '';
    })
    .join('');
  return entries ? '[filter "lfs"]\n' + entries : '';
}

// Same isolation as the review runner, with one executor-specific addition:
// the user's global identity is COPIED IN. Dropping the global config also
// drops user.name/user.email, and an executor whose order says "commit" would
// then fail every commit with "Please tell me who you are" — so the scratch
// config carries the identity forward while still silencing the unreadable
// excludes/attributes probing that sandboxed reviewers and executors hit.
//
// FIX (field, 2026-09-06): the scratch config used to REPLACE the global one
// outright, and that dropped everything else it carried — the credential
// helper (`git fetch origin` inside the sandbox died with "could not read
// Username for 'https://github.com'"), the LFS filters (see lfsFilterSection),
// URL rewrites. The scratch config now includes the real global config first
// and only overrides the probing that produced the noise.
function setupGitIsolation() {
  if (!CONFIG.gitIsolation || !SCRATCH.dir) return;
  // Read with the REAL environment — the point is to rescue values from the
  // config the isolation is about to hide.
  const identity = (key) => {
    const r = spawnSync('git', ['config', '--global', '--get', key], { encoding: 'utf8' });
    return r.status === 0 ? (r.stdout || '').trim() : '';
  };
  const name = identity('user.name');
  const email = identity('user.email');
  const includes = gitIncludeSection(globalGitConfigFiles());
  const lfs = lfsFilterSection();
  const empty = path.join(SCRATCH.dir, 'git-empty');
  const cfg = path.join(SCRATCH.dir, 'gitconfig');
  try {
    fs.writeFileSync(empty, '', 'utf8');
    fs.writeFileSync(
      cfg,
      '# Written by orchestra-exec.js for this run only.\n' +
        includes +
        '[core]\n' +
        '\texcludesFile = ' + empty.replace(/\\/g, '/') + '\n' +
        '\tattributesFile = ' + empty.replace(/\\/g, '/') + '\n' +
        '[safe]\n' +
        '\tdirectory = *\n' +
        lfs +
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

// ------------------------------------------------------------ MCP isolation
// FIX (field, 2026-09-06): a Sol review came back wearing an inner header
// `REVIEW ENGINE: Claude CLI (opus …)` — the engine had found a Claude review
// MCP in the Codex config and delegated to it, so the cross-family review
// silently became same-family. The same config hands an executor a GitHub
// connector that writes past the workspace sandbox. Codex applies
// `-c mcp_servers.<name>.enabled=false` to a server it has loaded, so every
// server the user config declares is disabled by name, and the apps connector
// is switched off. Verified against codex-cli 0.153.2: with these overrides
// the engine reports no MCP tools at all.
//
// Limits, stated rather than hidden: a name that needs TOML quoting cannot be
// addressed through -c (Codex splits the key on dots without unquoting), and
// a name that Codex has NOT loaded cannot be disabled either — the override
// would create a half-entry that fails config validation and kills the run.
// So only the user-level config is acted on; a project-level
// .codex/config.toml that declares servers is named in the header instead.
// Every TOML shape a server declaration can take: `[mcp_servers.<name>]`
// headers (and `[mcp_servers.<name>.env]` sub-headers), a `[mcp_servers]`
// table with `<name> = { … }` or `<name>.command = …` lines, top-level dotted
// keys `mcp_servers.<name>.command = …`, and an inline table
// `mcp_servers = { <name> = { … }, … }` (Astra's review of 3.3.0 found the
// first cut read only the header form and reported "0 server(s) disabled"
// for the rest). `opaque` is set when the file mentions mcp_servers in a
// shape none of these readers understood, so the header can say so instead
// of claiming a clean strip.
function mcpServerNames(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (_) {
    return { bare: [], quoted: [], opaque: false };
  }
  const bare = [];
  const quoted = [];
  const KEY = '("(?:[^"\\\\]|\\\\.)*"|\'[^\']*\'|[A-Za-z0-9_-]+)';
  const add = (raw) => {
    const k = String(raw || '').trim();
    if (!k) return;
    if (k[0] === '"' || k[0] === "'") {
      const q = k.slice(1, -1);
      if (!quoted.includes(q)) quoted.push(q);
    } else if (/^[A-Za-z0-9_-]+$/.test(k) && !bare.includes(k)) bare.push(k);
  };
  // Keys at depth 1 of an inline table. Returns whether the table closed, so
  // a table spread over several lines can be accumulated and re-scanned.
  const scanInline = (src) => {
    let depth = 0;
    let str = '';
    let key = '';
    let skip = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (str) {
        if (depth === 1) key += ch;
        if (ch === '\\' && str === '"') {
          i++;
          if (depth === 1 && i < src.length) key += src[i];
        } else if (ch === str) str = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        str = ch;
        if (depth === 1) key += ch;
        continue;
      }
      if (ch === '{') {
        depth++;
        if (depth === 1) {
          key = '';
          skip = false;
        }
        continue;
      }
      if (ch === '}') {
        depth--;
        if (depth === 0) return true;
        continue;
      }
      if (depth !== 1) continue;
      if (ch === '=' || ch === '.') {
        // `a.b = …` names server `a`; the rest of the dotted key is not a name.
        if (!skip) add(key);
        skip = true;
        key = '';
      } else if (ch === ',') {
        skip = false;
        key = '';
      } else key += ch;
    }
    return false;
  };
  // The root key may itself be quoted: `["mcp_servers".claude]` is valid TOML
  // (Astra, round 2). And a multi-line string (`"""…"""` / `'''…'''`, e.g.
  // developer_instructions carrying an example header) is skipped wholesale
  // — a header-shaped line inside it is prose, not a declaration.
  const ROOT = '(?:"mcp_servers"|\'mcp_servers\'|mcp_servers)';
  let section = '';
  let pending = '';
  let multi = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (multi) {
      if (line.includes(multi)) multi = '';
      continue;
    }
    if (pending) {
      pending += '\n' + line;
      if (scanInline(pending)) pending = '';
      continue;
    }
    const t = line.trim();
    if (!t || t[0] === '#') continue;
    for (const d of ['"""', "'''"]) {
      const n = t.split(d).length - 1;
      if (n % 2 === 1) multi = d;
    }
    let m;
    if ((m = new RegExp('^\\[\\s*' + ROOT + '\\s*\\.\\s*' + KEY + '\\s*[\\].]').exec(t))) {
      add(m[1]);
      section = 'mcp_servers.x';
      continue;
    }
    if (new RegExp('^\\[\\s*' + ROOT + '\\s*\\]').test(t)) {
      section = 'mcp_servers';
      continue;
    }
    if (t[0] === '[') {
      section = 'other';
      continue;
    }
    if (section === '' && (m = new RegExp('^' + ROOT + '\\s*\\.\\s*' + KEY + '\\s*[.=]').exec(t))) {
      add(m[1]);
      continue;
    }
    if (section === '' && (m = new RegExp('^' + ROOT + '\\s*=\\s*(\\{[\\s\\S]*)$').exec(t))) {
      if (!scanInline(m[1])) pending = m[1];
      continue;
    }
    if (section === 'mcp_servers' && (m = new RegExp('^' + KEY + '\\s*[.=]').exec(t))) {
      add(m[1]);
      continue;
    }
  }
  const opaque =
    new RegExp('^\\s*\\[?\\s*' + ROOT + '\\b', 'm').test(text.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, '')) &&
    !bare.length && !quoted.length;
  return { bare, quoted, opaque };
}

function mcpIsolation(dir) {
  if (CONFIG.engineMcp === 'inherit') return { args: [], label: 'inherited (engineMcp: inherit)', notes: [] };
  const home = os.homedir();
  const codexHome = (process.env.CODEX_HOME || '').trim() || (home ? path.join(home, '.codex') : '');
  const user = codexHome ? mcpServerNames(path.join(codexHome, 'config.toml')) : { bare: [], quoted: [] };
  const args = ['-c', 'features.apps=false'];
  for (const name of user.bare) args.push('-c', 'mcp_servers.' + name + '.enabled=false');
  const notes = [];
  if (user.opaque) {
    notes.push(
      'mcp: the Codex config declares mcp_servers in a shape this runner could not read — nothing was ' +
        'disabled by name; check ' + path.join(codexHome, 'config.toml') + ' by hand before trusting this run as cross-vendor'
    );
  }
  if (user.quoted.length) {
    notes.push(
      'mcp: ' + user.quoted.length + ' server(s) in the Codex config could not be disabled — a quoted ' +
        'name cannot be addressed through -c: ' + user.quoted.map((n) => JSON.stringify(n)).join(', ')
    );
  }
  const project = dir ? mcpServerNames(path.join(dir, '.codex', 'config.toml')) : { bare: [], quoted: [] };
  const projectNames = project.bare.concat(project.quoted);
  if (projectNames.length) {
    notes.push(
      'mcp: the project\'s own .codex/config.toml declares ' + projectNames.length + ' MCP server(s) ' +
        '(' + projectNames.join(', ') + ') — not disabled; Codex loads that file only for a trusted ' +
        'project, and disabling a server it has not loaded would kill the run'
    );
  }
  const label =
    'stripped (' + user.bare.length + ' server(s) disabled, apps connector off' +
    (user.quoted.length ? ', ' + user.quoted.length + ' not addressable' : '') + ')';
  return { args, label, notes };
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

// The PRINCIPAL rung takes a different SHAPE of order, not merely a harder
// one. A principal order names a goal, its done-criteria, the intent behind
// it and the boundaries — not a file list — because the work reaching this
// rung is work that loses its value when cut into narrow orders: many coupled
// seams that only stay correct if one mind holds them at once, or territory
// that cannot be planned before it is explored. These lines say so to the
// engine. Without them the launcher promises the Director a DECISIONS section
// that nothing ever asked the engine to write.
function principalLines(profile) {
  if (profile !== 'principal') return [];
  return [
    'THIS IS A PRINCIPAL ORDER — read these before the rules above bite.',
    'P1. The order is goal-shaped, not step-shaped. It names a goal, its',
    '    done-criteria, the intent behind it, and boundaries — not a file',
    '    list. Inside those boundaries you decide which files change; outside',
    '    them you change nothing. Rule 1 still binds: the boundary is the',
    '    scope. Latitude inside the goal is not licence to redesign it — if',
    '    you believe the goal or a stated constraint is itself wrong, that is',
    '    a BLOCKED report, never a silent substitution.',
    'P2. Decide the routine, ask about the material. Make the ordinary calls',
    '    yourself (a name, a default, which of two equivalent approaches) and',
    '    record each under DECISIONS. Reserve BLOCKED for where different',
    '    readings of the goal would lead to materially different work, a',
    '    stated constraint cannot be met, or a done-criterion cannot be made',
    '    observable. First do everything that does not depend on the answer.',
    'P3. Recon before you build. You are expected to map the territory',
    '    yourself: the code the goal touches, the tests protecting it, the',
    '    conventions around it, and any case file this order carries (prior',
    '    reports, reviewer findings). Absorb that history first and never',
    '    repeat an approach it already rules out; say which dead ends you',
    '    avoided and why.',
    'P4. Surface the coupling. Orders reach this rung precisely because seams',
    '    interact. Where your change touches one — an invariant another',
    '    subsystem relies on, an ordering assumption, a data-shape contract —',
    '    name it in CONCERNS even when everything passes, so the reviewer',
    '    knows where to press.',
    'P5. Prefer the minimal coherent change. Capability is not licence for',
    '    cleverness: edit surgically rather than rewriting a file when the',
    '    result is the same.',
    '',
  ];
}

// Paths the Claude Code harness itself writes into a project — session
// state, not project files. A fresh Agent-tool worktree arrives with
// .claude/settings.local.json already untracked, and an engine holding a
// "clean tree" precondition against it has been handed a false failure
// (field, 2026-09-06: two BLOCKED rounds on exactly this).
const HARNESS_OWNED = [
  '.claude/settings.local.json',
  '.claude/orchestra-ledger.jsonl',
  '.claude/orchestra-pool-readings.jsonl',
  '.claude/orchestra-manual-readings.md',
  '.claude/orchestra/',
];

function isHarnessOwned(rel) {
  const p = String(rel || '').replace(/\\/g, '/');
  return HARNESS_OWNED.some((h) => (h.endsWith('/') ? p.startsWith(h) : p === h));
}

// What the tree looked like BEFORE the engine started, measured by the runner.
// An engine that cannot tell pre-existing dirt from its own edits either
// refuses a precondition the Director did not intend or reports someone
// else's changes as its own; the list settles both. Bounded, like the audit.
function treeStateLines(before) {
  if (!before) return [];
  // The fingerprint annotates each porcelain line with " [size@mtime]" for
  // its own comparison; the engine gets the plain porcelain line.
  const lines = (before.text || '')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.replace(/ \[\d+@[\d.]+\]$/, ''));
  if (!lines.length) {
    return ['TREE STATE BEFORE YOU STARTED: clean (git status was empty).', ''];
  }
  const shown = lines.slice(0, 40);
  const harness = lines.map((l) => porcelainPath(l)).filter(isHarnessOwned);
  return [
    'TREE STATE BEFORE YOU STARTED (measured by the runner, not by you):',
    lines.length + ' path(s) were already dirty. The work order governs them: where',
    'it names one of these paths (finish it, commit it, build on it), do as it',
    'says. Where it does not, they are not yours — never revert, stage, or',
    '"clean up" an unnamed one, and never report it as your change.',
    ...shown.map((l) => '  ' + l),
    ...(lines.length > shown.length ? ['  …and ' + (lines.length - shown.length) + ' more'] : []),
    ...(harness.length
      ? [
          'Of these, ' + harness.length + ' are harness-owned session files (' +
            harness.slice(0, 5).join(', ') + (harness.length > 5 ? ', …' : '') + ') — the',
          'Director\'s tooling writes them; they never count against a "clean tree"',
          'precondition and are never project files.',
        ]
      : []),
    '',
  ];
}

function buildBrief(workOrder, verification, forbidden, profile, treeBefore) {
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
    '   the working tree. This sandbox may carry no GitHub credentials: if a',
    '   fetch, push, or `gh` call fails on authentication, do not retry it or',
    '   work around it — paste the exact error under VERIFICATION, finish what',
    '   the refs already local allow, and leave the push to the Director. Only',
    '   when the order cannot proceed without a ref that is not local is that',
    '   a BLOCKED, and then name the ref.',
    '8. Follow the order\'s cadence clauses. If it numbers parts and names a',
    '   progress file, append one status line there after each part, before',
    '   starting the next.',
    '',
    ...principalLines(profile),
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
    ...(profile === 'principal'
      ? [
          'DECISIONS',
          '- <each judgment call the goal left to you, and why you chose it —',
          '  or "none">',
          '',
        ]
      : []),
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
    ...treeStateLines(treeBefore),
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

// The Codex sandbox is set up by helper executables beside the binary, and when
// that setup fails on Windows codex says so in one recognisable breath. Field
// evidence (2026-09-03): after "Failed to create unified exec process:
// helper_unknown_error: apply deny-read ACLs", the engine kept going with a
// half-applied sandbox and apply_patch could no longer find lines it had just
// read — an EXECUTION that reported failure for a reason that had nothing to do
// with the order. Only phrases that are themselves the failure are matched: the
// helper filenames are deliberately absent, so an order that talks about them
// is never mistaken for one that hit this.
const SANDBOX_HELPER_RE =
  /helper_unknown_error|apply deny-read ACLs|Failed to create unified exec process/i;

function sandboxHelperFailed(run) {
  return SANDBOX_HELPER_RE.test((run && run.stderr) || '') ||
    SANDBOX_HELPER_RE.test(tail((run && run.stdout) || '', 40));
}

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
  if (st !== 0 && sandboxHelperFailed(run)) {
    return {
      kind: 'sandbox-helper',
      headline: 'the Codex sandbox helper failed to set the sandbox up (codex exited ' + st + ')',
      killedBy:
        'codex itself — its sandbox setup step failed. This is an INSTALL fault, not a ' +
        'fault in the order: anything the engine did after that line ran against a ' +
        'half-applied sandbox, so read the TREE AUDIT before trusting any of it.',
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
  if (att.class.kind === 'sandbox-helper' || sandboxHelperFailed(att)) {
    lines.push(
      '  the Codex sandbox helper failed here — an install fault, not an order fault. Run ' +
        '`node .claude/hooks/orchestra-review.js --doctor`: on Windows ' +
        'codex-command-runner.exe, codex-resources AND codex-windows-sandbox-setup.exe ' +
        'must sit DIRECTLY beside codex.exe, and a codex self-update is the usual way one ' +
        'of them goes missing. Re-dispatch after the doctor is clean.'
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
  args.push(...CONFIG.mcpArgs);
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
    'profile: ' + CONFIG.profile,
    'model: ' + (CONFIG.model || 'codex default') + ' (' + CONFIG.modelSource + ')',
    'effort: ' + (CONFIG.effort || 'codex default'),
    'sandbox: ' + CONFIG.sandbox,
    'timeout: ' + CONFIG.timeoutMs + 'ms (' + CONFIG.timeoutSource + ')',
    'attempts: 1 (execution is never auto-retried)',
    'mcp: ' + (CONFIG.mcpLabel || 'not resolved'),
  ]
    // Always, including zero — "prohibited commands: 0" is how a Director sees
    // that an order's prose prohibition never became a flag.
    .concat(['prohibited commands: ' + CONFIG.forbidden.length])
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
        '         [--profile heavy|principal] [--model <id>] [--effort <level>]\n' +
        '         [--timeout-ms <n>] [--forbid <cmd>]... [--cd <dir>] [--no-probe]\n' +
        '\n' +
        '  --profile heavy      GPT-5.6 Sol at high effort (default)\n' +
        '  --profile principal  GPT-6 Astra at xhigh effort\n' +
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
  // A setting that did not land is a header fact, not a silence.
  for (const note of CONFIG_NOTES) PREFLIGHT.push(note);
  const codexCfg =
    projectCfg.codex && typeof projectCfg.codex === 'object' && !Array.isArray(projectCfg.codex)
      ? projectCfg.codex
      : {};

  // Which rung is running. An unrecognised --profile is a header fact, not a
  // silent substitution: the run still happens on the default rung, and the
  // PREFLIGHT line tells the launcher its order named something that did not
  // exist, so a Sol run can never be relayed as an Astra one.
  if (args.profile != null && String(args.profile).trim()) {
    const want = String(args.profile).trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(EXEC_PROFILES, want)) {
      CONFIG.profile = want;
    } else {
      PREFLIGHT.push(
        'unknown --profile "' + boundedDiagnostic(want, 200) + '" — the run used the ' +
          DEFAULT_PROFILE + ' profile (' + EXEC_PROFILES[DEFAULT_PROFILE].model + '); ' +
          'known profiles: ' + Object.keys(EXEC_PROFILES).join(', ')
      );
    }
  }
  const profile = EXEC_PROFILES[CONFIG.profile];

  // Resolution, per profile: flag > env > orchestra.json > profile default.
  // Each rung reads its OWN env var and config key, so pinning the principal
  // rung never moves the heavy one. The heavy rung's keys keep the names they
  // shipped with (codex.execHeavyModel / execHeavyEffort) — projects have them
  // written down. Within a profile there is still one model and one effort;
  // the removed `--tier` flag selected efforts inside a rung and is not back.
  if (args.model && args.model.trim()) {
    CONFIG.model = args.model.trim();
    CONFIG.modelSource = 'flag';
  } else if (process.env[profile.modelEnv] && process.env[profile.modelEnv].trim()) {
    CONFIG.model = process.env[profile.modelEnv].trim();
    CONFIG.modelSource = 'env';
  } else if (typeof codexCfg[profile.modelKey] === 'string' && codexCfg[profile.modelKey].trim()) {
    CONFIG.model = codexCfg[profile.modelKey].trim();
    CONFIG.modelSource = 'orchestra.json';
  } else {
    CONFIG.model = profile.model;
    CONFIG.modelSource = 'default';
  }

  if (args.effort && args.effort.trim()) {
    CONFIG.effort = args.effort.trim();
    CONFIG.effortSource = 'flag';
  } else if (process.env[profile.effortEnv] && String(process.env[profile.effortEnv]).trim() !== '') {
    CONFIG.effort = String(process.env[profile.effortEnv]).trim();
    CONFIG.effortSource = 'env';
  } else if (typeof codexCfg[profile.effortKey] === 'string' && codexCfg[profile.effortKey].trim()) {
    CONFIG.effort = codexCfg[profile.effortKey].trim();
    CONFIG.effortSource = 'orchestra.json';
  } else {
    CONFIG.effort = profile.effort;
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
  // MCP isolation: env > orchestra.json > strip. Anything but an explicit
  // "inherit" strips — the safe direction for a typo.
  if (!CONFIG.engineMcp && typeof codexCfg.engineMcp === 'string') {
    CONFIG.engineMcp = codexCfg.engineMcp.trim().toLowerCase();
  }
  if (CONFIG.engineMcp !== 'inherit') CONFIG.engineMcp = 'strip';
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

  // --- MCP isolation, resolved once and applied to the probe and the run
  // alike: the probe must launch under the same overrides the run will.
  const mcp = mcpIsolation(CONFIG.execDir);
  CONFIG.mcpArgs = mcp.args;
  CONFIG.mcpLabel = mcp.label;
  for (const n of mcp.notes) PREFLIGHT.push(n);

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

  const brief = buildBrief(workOrder, loadVerification(projectCfg), CONFIG.forbidden, CONFIG.profile, before);

  // --- the one attempt.
  const lastMsgFile = path.join(SCRATCH.dir, 'report.txt');
  const codexArgs = ['exec', '--sandbox', CONFIG.sandbox, '--cd', CONFIG.execDir];
  if (CONFIG.model) codexArgs.push('--model', CONFIG.model);
  if (CONFIG.effort) codexArgs.push('-c', 'model_reasoning_effort=' + CONFIG.effort);
  codexArgs.push('--output-last-message', lastMsgFile);
  if (CONFIG.extraArgs) codexArgs.push(...CONFIG.extraArgs.split(/\s+/).filter(Boolean));
  // Keep the coexistence boundary last: Codex resolves repeated -c values in
  // order, so ORCHESTRA_EXEC_ARGS must not be able to re-enable a co-installed
  // Codex-Orchestra's project instructions, hooks, or MCP servers.
  codexArgs.push('-c', 'features.hooks=false', '-c', 'project_doc_max_bytes=0');
  codexArgs.push(...CONFIG.mcpArgs);
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
