#!/usr/bin/env node
/**
 * Orchestra cross-vendor review runner (the OPTIONAL review engine).
 *
 * Drives an OpenAI model through the Codex CLI to review a change produced by
 * the Claude executor. The default Orchestra reviewer is the fresh-context
 * Opus `reviewer` agent; this engine adds a further layer of independence —
 * a DIFFERENT VENDOR, decorrelating training-lineage blind spots that Claude
 * models share — for gate-class second opinions or projects that prefer
 * cross-vendor primary review. Codex re-reads the diff, runs the tests
 * itself, and hunts for concrete failure scenarios.
 *
 * The `reviewer-codex` subagent (a thin Claude launcher) invokes this. The
 * Director itself cannot — the guard blocks its Bash — so review stays
 * delegated.
 *
 * Usage:
 *   node orchestra-review.js --work-order <file> --executor-report <file> \
 *     [--tier full|inert] [--timeout-ms <n>] [--no-tests] [--forbid <cmd>]... \
 *     [--base-ref <ref>] [--head-ref <ref>] [--worktree-root <dir>]
 *
 * Both files are plain text the launcher wrote from what the Director handed
 * it. The work order is the intent (what SHOULD have happened); the executor
 * report is the claim (what it SAYS happened). Codex gets both, plus a tree to
 * read, and audits the diff against them.
 *
 * ------------------------------------------------------- WHICH TREE IT READS
 *
 * Two modes, chosen by whether the change under review is committed:
 *
 *   LIVE mode (no --head-ref) — Codex reads the project working tree. This is
 *   the right mode for uncommitted work, and it is why the idle precheck
 *   exists: a tree another agent is still writing produces findings about a
 *   state that no longer exists.
 *
 *   PINNED mode (--head-ref <sha>) — the runner materializes a DETACHED GIT
 *   WORKTREE at that commit, under a known-writable scratch root, and points
 *   Codex there instead. The session's own dirt — untracked plan files, the
 *   Director's notes, half-finished edits that landed after the commit — does
 *   not exist in the engine's view at all.
 *
 *   Pinning fixes a specific, expensive failure: an agentic reviewer given a
 *   pinned SHA *and* a dirty checkout burns its whole clock reconciling the
 *   two, because `git show <sha>:<path>` keeps failing with "exists on disk,
 *   but not in <sha>" for every file the session created after the commit. It
 *   is not a diff mismatch it can resolve; it is a model of the world that
 *   cannot be made consistent. Reviewed in a clean worktree, the question
 *   never arises. Prefer pinned mode whenever the change is committed.
 *
 *   The scratch root is NEVER inside the repository: a sandboxed reviewer may
 *   not have permission to mkdir there (observed), and a worktree inside the
 *   tree under review is itself session dirt. Teardown is guaranteed on every
 *   exit path — normal, error, and signal — and a startup sweep reclaims
 *   worktrees orphaned by a hard kill that ran no handler.
 *
 * --tier inert (default: full) marks a round the Director declared as pure
 * docs/comments/formatting with zero behavior impact. The tier is a CLAIM the
 * reviewer must verify from the diff: any behavior-bearing line is itself a
 * critical finding ("tier violation") and forces a full-depth review. Only a
 * proven-inert diff may skip the full test suite — so tiering can narrow
 * verification only when narrowing provably cannot matter.
 *
 * If the project declares a verification manifest (.claude/orchestra.json →
 * "verification": { full, lint, shards[], protected[] }), it is injected into
 * the brief so the reviewer runs the canonical commands instead of guessing.
 *
 * Both the tier and the manifest are Orchestra review POLICY (ORCHESTRA.md
 * §8.3), engine-agnostic by design. This runner merely implements that policy
 * for the Codex engine; when review falls back per ORCHESTRA.md §5 (Codex
 * unavailable), the fallback reviewer applies the same rules by hand. Any
 * future review engine must implement them too.
 *
 * Output: a self-contained review report on stdout, already in the Orchestra
 * reviewer format (VERDICT / FINDINGS / CLAIMS CHECKED / NITS). The launcher
 * relays it verbatim. On any engine failure it prints a VERDICT:
 * REVIEW_UNAVAILABLE block instead of a fake verdict — a review that could not
 * run must never read as an approval. Exit code is always 0: the status lives
 * in the VERDICT line, which is what the launcher and Director read.
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
 *       "reviewTimeoutMs": 1800000,
 *       "reviewModel": "gpt-5.6-sol",
 *       "reviewSandbox": "workspace-write",
 *       "helpersDir": "/path/to/known-good-codex-helpers",
 *       "idleMs": 1500,
 *       "worktreeRoot": "/path/to/writable/scratch",
 *       "gitConfigIsolation": true,
 *       "doNotRun": ["godot"],
 *       "reviewRetries": 1,
 *       "authProbe": true,
 *       "probeTimeoutMs": 90000,
 *       "worktreeWarmupCmd": "godot --headless --import",
 *       "worktreeWarmupTimeoutMs": 300000,
 *       "integrityIgnore": ["*.import", ".godot/"],
 *       "integrityIgnoreDefaults": true,
 *       "requireHelperSiblings": false,
 *       "helperSiblings": ["codex-command-runner.exe", "codex-resources",
 *                          "codex-windows-sandbox-setup.exe"]
 *   } }
 *
 *   ORCHESTRA_REVIEW_MODEL      OpenAI model to pin (e.g. gpt-5-codex). Unset →
 *                               Codex uses its own configured default.
 *   ORCHESTRA_REVIEW_SANDBOX    Codex sandbox: workspace-write (default — lets
 *                               the reviewer actually run the test suite) or
 *                               read-only (hard no-write guarantee, but many
 *                               test runners can't run under it).
 *   ORCHESTRA_REVIEW_TIMEOUT_MS Max wall-clock for the review (default 600000).
 *                               This engine explores before it concludes, so
 *                               even a nine-line docs diff is MINUTES, not
 *                               seconds — an inert tier narrows what gets
 *                               VERIFIED, never how long the engine takes to
 *                               look. Inert reviews therefore carry a 600000ms
 *                               FLOOR (see INERT_FLOOR_MS): a shorter cap from
 *                               a launcher flag or the built-in default is
 *                               raised to it, and the header says so. A cap you
 *                               set yourself — env or orchestra.json — is
 *                               honoured as written and merely flagged.
 *   ORCHESTRA_REVIEW_IDLE_MS    Idle-precheck settle window (default 1500; 0
 *                               disables). Reviewing a tree another agent is
 *                               still writing produces garbage findings, so the
 *                               runner samples the tree twice and refuses if it
 *                               moved. LIVE mode only — a pinned worktree is
 *                               immutable, so there is nothing to settle.
 *   ORCHESTRA_REVIEW_WORKTREE_ROOT
 *                               Parent directory for the pinned-review scratch
 *                               worktree (default: the OS temp dir). Must be
 *                               writable by this process; never the repo. A root
 *                               you SET and this process cannot write is a hard
 *                               failure, not a silent fall back to the temp dir —
 *                               the fallback is what the setting exists to avoid.
 *   ORCHESTRA_REVIEW_RETRIES    Extra attempts after a failed one (default 1, max
 *                               3). A retry costs a fresh scratch directory and a
 *                               fresh checkout, and only happens when the failure
 *                               could plausibly differ next time (a signal kill,
 *                               an engine that produced nothing) — never after a
 *                               timeout the runner itself enforced, and never
 *                               after a missing binary. The whole chain reports
 *                               as ONE outcome; REVIEW_UNAVAILABLE is emitted
 *                               only when the chain is exhausted.
 *   ORCHESTRA_REVIEW_PROBE      1 (default) runs a cheap `codex exec` echo before
 *                               the real attempt, so an unauthenticated or
 *                               broken install fails in seconds instead of after
 *                               a full review budget. 0 disables.
 *   ORCHESTRA_REVIEW_PROBE_TIMEOUT_MS
 *                               Cap for that probe (default 90000). A probe that
 *                               merely times out is a warning, not a refusal — a
 *                               slow engine is still a working engine.
 *   ORCHESTRA_REVIEW_WARMUP_CMD Shell command run inside the review checkout
 *                               BEFORE the integrity baseline is taken (default
 *                               none). Engines that import assets on first open
 *                               (Godot writes 180+ `*.import` sidecars) otherwise
 *                               make every first review look like the reviewer
 *                               mutated the tree.
 *   ORCHESTRA_REVIEW_WARMUP_TIMEOUT_MS
 *                               Cap for the warmup (default 300000).
 *   ORCHESTRA_REVIEW_GIT_ISOLATION
 *                               1 (default) runs every git the review touches —
 *                               the runner's own and the engine's — against a
 *                               scratch global config instead of the user's.
 *                               A sandboxed process often cannot read the real
 *                               one, and git then warns on every single
 *                               invocation ("unable to access
 *                               '<home>/.config/git/ignore': Permission
 *                               denied"), which the engine spends its clock
 *                               investigating. 0 disables.
 *   ORCHESTRA_CODEX_HELPERS     Directory of known-good files mirrored into the
 *                               Codex install directory before each run. A
 *                               Codex self-update can silently drop files a
 *                               working install needs; this restores them.
 *   ORCHESTRA_CODEX_HELPER_SIBLINGS
 *                               Comma-separated names the Codex install must
 *                               carry DIRECTLY NEXT TO its executable (default
 *                               on Windows: codex-command-runner.exe,
 *                               codex-resources, codex-windows-sandbox-setup.exe;
 *                               none elsewhere). Empty string expects none.
 *                               Overrides the project config, so a machine whose
 *                               install legitimately differs does not need a
 *                               committed-config edit. "Directly" is the whole
 *                               point: a helper Codex resolves by name is not
 *                               found one directory down, and the review then
 *                               fails by producing nothing.
 *   ORCHESTRA_REVIEW_ARGS       Extra args appended to `codex exec`, space-split
 *                               (escape hatch for flag drift / tuning).
 *   CODEX_BIN                   Codex executable (default "codex"). Resolved to
 *                               its REAL path before launching: a symlink or
 *                               Windows junction breaks Codex's own sibling-file
 *                               resolution, because it looks for its helpers
 *                               next to the link rather than the install.
 *   CLAUDE_PROJECT_DIR          Project root Codex reviews (default: cwd).
 *
 *   --doctor runs the install check alone — no work order, no review, no engine
 *   launch. Same code path as the review preflight, so it cannot drift from what
 *   a review actually verifies; exit 1 means a review would not find a complete
 *   install. The installer runs it when the codex pack is selected.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ------------------------------------------------------------------ config

// The engine explores the tree before it concludes anything, and that explore
// pass does not shrink with the diff. An inert round narrows what must be
// VERIFIED — it does not make the engine faster — so a "this is only docs, give
// it thirty seconds" cap guarantees a timeout instead of a verdict. Reviews
// declared inert get raised to this floor when the cap came from a launcher
// flag or the built-in default.
const INERT_FLOOR_MS = 600000;

// A retry is a bet that the same configuration behaves differently the second
// time. That bet is worth one round — a signal kill, a launch that produced
// nothing — and is worthless past that: an install that is broken is broken
// every time, and each attempt costs a full review budget. Bounded here rather
// than left to a launcher, because a launcher improvising retries is how one
// gate produced two "final" reports for one review.
const MAX_RETRIES = 3;

// Files the reviewer is expected to churn while doing its job. A reviewer that
// runs the suite writes caches, build outputs, and coverage; an engine that
// opens a project imports its assets. None of that is the thing the integrity
// check exists to catch (a reviewer EDITING SOURCE), and flagging it makes the
// warning meaningless on exactly the projects that need it most — a Godot
// review rewrote 180+ `*.import` sidecars on first import and cried wolf.
// Extend per project with "integrityIgnore"; drop the list entirely with
// "integrityIgnoreDefaults": false.
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

// Files a Codex install needs NEXT TO its executable. A self-update can drop
// them, and the failure is far downstream of the cause: the binary launches,
// then dies without a verdict. Windows-only by observation — this is where the
// field failures happened, and naming files that do not exist on a platform
// would turn preflight into noise.
const DEFAULT_HELPER_SIBLINGS =
  process.platform === 'win32'
    ? ['codex-command-runner.exe', 'codex-resources', 'codex-windows-sandbox-setup.exe']
    : [];

// Helper siblings whose ABSENCE has a known, specific consequence — worth
// naming in the report rather than leaving as one more filename in a list.
//
// FIX (2026-08-18): `codex-windows-sandbox-setup.exe` cost a lane. An earlier
// repair session had copied it INTO `codex-resources\` instead of beside
// `codex.exe`. Codex resolves that helper by NAME, so a copy one directory down
// is not a copy at all: the sandbox was never established, and every
// runner-mediated review no-opped while the preflight cheerfully reported the
// two siblings it did check as present. Naming the file is half the fix; the
// other half is checking the right place and repairing a misplaced copy (see
// installSubdirs / verifyHelperSiblings below).
const HELPER_CONSEQUENCE = {
  'codex-windows-sandbox-setup.exe':
    'Codex resolves this helper BY NAME, so it must sit directly beside the codex ' +
    'executable — a copy nested one level down (inside codex-resources\\, where a hand ' +
    'repair naturally puts it) is never found, the sandbox is silently never set up, and ' +
    'reviews return nothing while looking healthy.',
};

// Seeded from env + defaults so the early-failure paths can already print a
// truthful header; main() layers project config and CLI flags over it.
const CONFIG = {
  model: (process.env.ORCHESTRA_REVIEW_MODEL || '').trim(),
  sandbox: (process.env.ORCHESTRA_REVIEW_SANDBOX || 'workspace-write').trim(),
  timeoutMs: parseInt(process.env.ORCHESTRA_REVIEW_TIMEOUT_MS || '', 10) || 600000,
  timeoutSource: process.env.ORCHESTRA_REVIEW_TIMEOUT_MS ? 'env' : 'default',
  idleMs: intOr(process.env.ORCHESTRA_REVIEW_IDLE_MS, 1500),
  helpersDir: (process.env.ORCHESTRA_CODEX_HELPERS || '').trim(),
  extraArgs: (process.env.ORCHESTRA_REVIEW_ARGS || '').trim(),
  bin: (process.env.CODEX_BIN || 'codex').trim(),
  resolvedBin: '',
  // Directory of the resolved binary. Filled in by the install inspection and
  // then prepended to the engine's PATH — some Codex helpers are resolved by
  // name, and an install directory that is not itself on PATH makes them
  // unfindable even when they sit exactly where they belong.
  installDir: '',
  projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  forbidden: [],
  baseRef: '',
  headRef: '',
  worktreeRoot: (process.env.ORCHESTRA_REVIEW_WORKTREE_ROOT || '').trim(),
  // Where the scratch root came from. A root the USER named and this process
  // cannot write is a hard failure; the built-in default falling back to $HOME
  // is merely a loud note. Silently swapping a configured root for the temp dir
  // resurrects the cross-run brief collisions worktreeRoot exists to prevent.
  worktreeRootSource: process.env.ORCHESTRA_REVIEW_WORKTREE_ROOT ? 'env' : 'default',
  gitIsolation: process.env.ORCHESTRA_REVIEW_GIT_ISOLATION !== '0',
  retries: Math.min(MAX_RETRIES, intOr(process.env.ORCHESTRA_REVIEW_RETRIES, 1)),
  probe: process.env.ORCHESTRA_REVIEW_PROBE !== '0',
  probeTimeoutMs: intOr(process.env.ORCHESTRA_REVIEW_PROBE_TIMEOUT_MS, 90000),
  warmupCmd: (process.env.ORCHESTRA_REVIEW_WARMUP_CMD || '').trim(),
  warmupTimeoutMs: intOr(process.env.ORCHESTRA_REVIEW_WARMUP_TIMEOUT_MS, 300000),
  integrityIgnore: [],
  integrityIgnoreDefaults: true,
  // Env override exists for the same reason every other setting here has one:
  // the machine, not the project, is what varies. A shared box or a CI image
  // whose Codex install legitimately ships different files should be fixable
  // without editing a project's committed config. Empty string = expect none.
  helperSiblings:
    process.env.ORCHESTRA_CODEX_HELPER_SIBLINGS != null
      ? process.env.ORCHESTRA_CODEX_HELPER_SIBLINGS.split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_HELPER_SIBLINGS.slice(),
  requireHelperSiblings: false,
  // The directory the engine is actually pointed at: the project itself in LIVE
  // mode, the pinned worktree in PINNED mode. Header-visible either way, so a
  // verdict always records which tree produced it.
  reviewDir: '',
  reviewDirLabel: '',
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
    else if (a === '--executor-report') out.executorReport = argv[++i];
    else if (a === '--tier') out.tier = argv[++i];
    else if (a === '--timeout-ms') out.timeoutMs = argv[++i];
    else if (a === '--no-tests') out.noTests = true;
    else if (a === '--forbid') out.forbid.push(argv[++i]);
    else if (a === '--base-ref') out.baseRef = argv[++i];
    else if (a === '--head-ref') out.headRef = argv[++i];
    else if (a === '--worktree-root') out.worktreeRoot = argv[++i];
    else if (a === '--retries') out.retries = argv[++i];
    else if (a === '--no-retry') out.retries = '0';
    else if (a === '--no-probe') out.noProbe = true;
    else if (a === '--warmup-cmd') out.warmupCmd = argv[++i];
    else if (a === '--doctor') out.doctor = true;
    else if (a === '--live') out.live = true;
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

// Tail the last N lines of a possibly-large string (for error excerpts).
function tail(text, n) {
  if (!text) return '';
  const lines = text.replace(/\s+$/, '').split('\n');
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [];
}

// Indent a block so it reads as detail under a heading rather than as prose
// competing with it.
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

// POSIX signal numbers we can meet in an exit status. Windows has no signals,
// but a process terminated there frequently still surfaces as 128+N, because
// the thing that died was a POSIX-shaped child (a shell, a node, a rust binary
// that re-raised) — which is exactly how the field's "status 143" arrived.
const SIGNAL_NAMES = {
  1: 'SIGHUP', 2: 'SIGINT', 3: 'SIGQUIT', 4: 'SIGILL', 6: 'SIGABRT', 8: 'SIGFPE',
  9: 'SIGKILL', 11: 'SIGSEGV', 13: 'SIGPIPE', 14: 'SIGALRM', 15: 'SIGTERM',
  24: 'SIGXCPU', 25: 'SIGXFSZ', 31: 'SIGSYS',
};

// A tiny glob: `*` matches within a segment, `**` across segments, a trailing
// `/` matches the directory and everything under it. Enough for the integrity
// allowlist, which names artifact paths, not arbitrary patterns — and small
// enough to be obviously correct, which a full glob implementation here would
// not be.
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
  // Anchored at either the whole path or any path segment boundary, so
  // `.godot/` matches `.godot/x` and `sub/.godot/x` alike.
  return new RegExp('(^|/)' + re + (dirOnly ? '(/|$)' : '$'));
}

function matchesAny(rel, patterns) {
  const norm = String(rel).replace(/\\/g, '/');
  for (const pat of patterns) {
    try {
      if (globToRegExp(pat).test(norm)) return true;
    } catch (_) {
      /* a pattern that will not compile simply matches nothing */
    }
  }
  return false;
}

// Resolve symlinks where we can, fall back to the path as given. Every
// path COMPARISON in this runner has to go through here, because git reports
// resolved paths and the caller's own paths usually are not: on macOS
// os.tmpdir() is `/var/folders/…`, a symlink to `/private/var/folders/…`, so
// `git rev-parse --show-toplevel` and a path we built ourselves describe the
// same directory with different strings. Comparing them raw makes "is this
// inside the repository?" answer NO for a directory that plainly is.
function realOrSelf(p) {
  const abs = path.resolve(p);
  try {
    return fs.realpathSync(abs);
  } catch (_) {
    /* does not exist yet — resolve as much of it as does */
  }
  // A path we are about to CREATE still has to be compared honestly, and
  // realpath refuses paths that do not exist. Resolve the deepest ancestor that
  // does exist and re-attach the rest: that is what makes it possible to answer
  // "would creating this write inside the repository?" BEFORE creating it.
  const parent = path.dirname(abs);
  if (parent === abs) return abs;
  return path.join(realOrSelf(parent), path.basename(abs));
}

// Is `child` the same directory as `parent`, or inside it? Symlink-resolved on
// both sides — see realOrSelf. Case-insensitive where the filesystem is.
function isInside(parent, child) {
  const norm = (p) => {
    const r = realOrSelf(p).replace(/\\/g, '/');
    return process.platform === 'win32' || process.platform === 'darwin' ? r.toLowerCase() : r;
  };
  const a = norm(parent);
  const b = norm(child);
  if (a === b) return false;
  return b.startsWith(a.endsWith('/') ? a : a + '/');
}

// The deepest ancestor of `p` that exists — the directory a `git -C` can
// actually run in when `p` itself has not been created yet.
function existingAncestor(p) {
  let dir = path.resolve(p);
  for (let i = 0; i < 64; i++) {
    if (fs.existsSync(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
  return dir;
}

// Would a scratch directory here land inside the repository under review?
//
// Asking GIT is what makes this reliable, and string comparison is only the
// backstop. Windows reports `C:\Users\RUNNER~1\…` (an 8.3 short name) where
// realpath gives `C:\Users\runneradmin\…`; macOS reports `/private/var/…` where
// the caller holds `/var/…`; separators and case differ on both. Every one of
// those made a directory that is plainly inside the repository compare as
// outside. Run `rev-parse --show-toplevel` from BOTH locations instead: two
// answers from the same tool, in the same form, comparable without guessing.
function scratchIsInsideRepo(projectTop, candidate) {
  if (!projectTop || !candidate) return false;
  const candidateTop = gitOut(['-C', existingAncestor(candidate), 'rev-parse', '--show-toplevel']);
  if (candidateTop) {
    const same = (x, y) => {
      const n = (p) => {
        const s = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
        return process.platform === 'win32' || process.platform === 'darwin' ? s.toLowerCase() : s;
      };
      return n(x) === n(y);
    };
    // Same work tree → inside it, whatever the two paths look like as strings.
    if (same(candidateTop, projectTop)) return true;
    // A DIFFERENT repository is genuinely outside this one, and saying so is
    // the point: someone keeping scratch in another checkout is fine.
    return false;
  }
  return isInside(projectTop, candidate);
}

// Launch the engine. Node refuses to spawn `.cmd`/`.bat` directly since the
// BatBadBut fix (CVE-2024-27980) — it throws EINVAL unless you opt into a
// shell — and on Windows a `codex` installed through npm IS a `.cmd` shim, the
// exact thing PATH resolution finds first (whichSync searches PATHEXT, which
// lists .CMD). So the documented install path was unlaunchable here.
//
// Route those through cmd.exe explicitly rather than passing `shell: true`:
// `shell: true` does not quote the arguments, so the first path containing a
// space (`C:\Program Files\…`, and this runner passes several paths) would be
// split into pieces. Quoting each argument ourselves and handing cmd.exe one
// verbatim command line is what npm's own shims do.
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

// Copy a file or a whole directory. Used by the helper repair, where the thing
// that went missing may be either (`codex-command-runner.exe` is a file,
// `codex-resources` a directory).
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

// Blocking sleep — this runner is synchronous end to end, and the idle
// precheck needs a settle window between two samples of the tree.
function sleepSync(ms) {
  if (!(ms > 0)) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Whole project config (.claude/orchestra.json). Fail-open like the guard's
// config: a missing or broken file simply means no project settings.
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

// ------------------------------------------------- scratch, git env, worktree
//
// Everything this section owns lives OUTSIDE the repository. A review must not
// write into the tree it is reviewing — that is session dirt of exactly the
// kind pinned mode exists to remove — and a sandboxed reviewer frequently
// cannot mkdir inside the project at all (a `mkdir: Permission denied` in the
// repo cwd killed an earlier attempt at this fix outright).

const SCRATCH_PREFIX = 'orchestra-review-';

// One scratch directory per run, holding the isolated git config and one
// subdirectory per ATTEMPT (its verdict file and, in pinned mode, its own
// worktree). Torn down on every exit. Attempts get separate directories so a
// retry is a genuinely fresh checkout — whatever the first attempt did to its
// tree, including whatever a half-dead engine left behind, is not inherited.
const SCRATCH = {
  dir: '',
  gitConfigFile: '',
  worktrees: [],
  repoTop: '',
  torndown: false,
};

// Candidate scratch roots, in order. The project directory is deliberately
// absent: it is neither reliably writable under a sandbox nor an acceptable
// place to put a worktree of itself.
function scratchRootCandidates(configured) {
  const roots = [];
  if (configured) roots.push(configured);
  roots.push(os.tmpdir());
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) roots.push(home);
  return roots.filter((r, i) => r && roots.indexOf(r) === i);
}

// Create the run's scratch directory in the first candidate root that actually
// accepts a mkdir. Probing by creating is the only honest test — a stat says
// nothing about whether this process may write there.
//
// FIX: the fallback used to be silent-ish and unconditional, which quietly
// undid the setting it fell back from. A project sets worktreeRoot for a
// REASON — most often that the OS temp dir is shared, small, or on another
// volume — and a review that ignores it lands its briefs and worktrees exactly
// where the configuration said not to. So: a root the user NAMED is mandatory
// (its failure is the review's failure, with the mkdir error attached), and
// only the built-in default is allowed to walk down the candidate list, loudly.
function makeScratchDir(configured, configuredSource) {
  const userSet = !!configured && configuredSource !== 'default';
  const tried = [];
  const roots = userSet ? [configured] : scratchRootCandidates(configured);
  for (const root of roots) {
    try {
      fs.mkdirSync(root, { recursive: true });
      const dir = fs.mkdtempSync(path.join(root, SCRATCH_PREFIX));
      return {
        dir,
        note: tried.length
          ? 'scratch root ' + tried[0].split(' (')[0] + ' was unusable — FELL BACK to ' + root +
            '. Pinned worktrees and briefs are landing somewhere other than configured.'
          : '',
      };
    } catch (e) {
      tried.push(root + ' (' + ((e && e.message) || e) + ')');
    }
  }
  return {
    dir: '',
    note: '',
    error:
      (userSet
        ? 'the configured scratch root (' + configuredSource + ') is not writable by this ' +
          'process, and a configured root is never silently swapped for another — ' +
          'tried: '
        : 'no writable scratch root — tried: ') + tried.join('; '),
  };
}

// One directory per attempt, under the run's scratch root.
function makeAttemptDir(n) {
  const dir = path.join(SCRATCH.dir, 'attempt-' + n);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Git's global config is read on EVERY invocation, and a sandboxed process
// often cannot reach the real one. The symptom is not a failure but noise —
// `warning: unable to access '<home>/.config/git/ignore': Permission denied`
// on every command — and an agentic reviewer treats noise as a lead worth
// chasing. Point git at a scratch config instead.
//
// The excludes/attributes files are set EXPLICITLY rather than left unset:
// with no value, git still probes $XDG_CONFIG_HOME/git/ignore and then
// $HOME/.config/git/ignore, which is the exact path that fails. Naming a
// readable empty file is what actually silences it.
//
// safe.directory is re-granted because dropping the user's global config also
// drops any ownership trust it carried, and a review that cannot run git at all
// is worse than one that trusts a repo the user already works in daily.
function setupGitIsolation() {
  if (!CONFIG.gitIsolation || !SCRATCH.dir) return;
  const empty = path.join(SCRATCH.dir, 'git-empty');
  const cfg = path.join(SCRATCH.dir, 'gitconfig');
  try {
    fs.writeFileSync(empty, '', 'utf8');
    fs.writeFileSync(
      cfg,
      '# Written by orchestra-review.js for this review only.\n' +
        '[core]\n' +
        '\texcludesFile = ' + empty.replace(/\\/g, '/') + '\n' +
        '\tattributesFile = ' + empty.replace(/\\/g, '/') + '\n' +
        '[safe]\n' +
        '\tdirectory = *\n',
      'utf8'
    );
    SCRATCH.gitConfigFile = cfg;
  } catch (e) {
    PREFLIGHT.push('git config isolation unavailable: ' + ((e && e.message) || e));
  }
}

// Stale-session hazards: the conditions under which a Codex run can hand back
// a PREVIOUS session's output as if it were fresh. Found the hard way
// (2026-08-19): an exec lane relayed a weeks-old report — with a matching
// stale tree audit — as STATUS: DONE for a brand-new order. The exec runner
// now refuses resume-prone args and verifies a per-run token, but the doctor
// still names the hazards so a machine that carries them is visibly primed.
function staleSessionHazards() {
  const notes = [];
  const attention = [];

  // 1. Resume-prone extra args. The exec runner refuses these outright; the
  //    review runner would silently review some other session's context.
  for (const name of ['ORCHESTRA_EXEC_ARGS', 'ORCHESTRA_REVIEW_ARGS']) {
    const raw = (process.env[name] || '').trim();
    if (!raw) continue;
    const bad = raw
      .split(/\s+/)
      .filter((t) => /resume/i.test(t) || t === '--last' || t === '--continue');
    if (bad.length) {
      attention.push(
        name + ' contains session-resuming token(s): ' + bad.join(', ') + ' — a run ' +
          'launched with these can hand back a PREVIOUS session\'s output as a fresh ' +
          'result. The exec runner refuses to launch with them; remove them.'
      );
    }
  }

  // 2. Resume-prone Codex config. Read-only inspection; comments are skipped.
  const codexHome = (process.env.CODEX_HOME || '').trim() || path.join(os.homedir(), '.codex');
  try {
    const cfg = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    const hits = cfg
      .split(/\r?\n/)
      .map((l, i) => ({ n: i + 1, text: l }))
      .filter((l) => /resume/i.test(l.text) && !/^\s*#/.test(l.text));
    for (const h of hits) {
      attention.push(
        path.join(codexHome, 'config.toml') + ':' + h.n + ' looks resume-prone: "' +
          h.text.trim() + '" — `codex exec` runs launched by the Orchestra runners ' +
          'must start fresh sessions; a config that resumes threads by default can ' +
          'replay a stale run\'s final message as a fresh report.'
      );
    }
  } catch (_) {
    /* no config to read — nothing resume-prone in it */
  }

  // 3. Session/rollout artifacts. Normal Codex history and harmless by
  //    themselves — the runners never resume — but worth counting so a reader
  //    knows the ammunition exists if a resume-prone config (above) appears.
  let artifacts = 0;
  for (const sub of ['sessions', 'threads', 'rollouts']) {
    const dir = path.join(codexHome, sub);
    const walk = (d, depth) => {
      if (depth > 4 || artifacts > 5000) return;
      let entries;
      try {
        entries = fs.readdirSync(d, { withFileTypes: true });
      } catch (_) {
        return;
      }
      for (const e of entries) {
        if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
        else artifacts++;
      }
    };
    walk(dir, 0);
  }
  if (artifacts > 0) {
    notes.push(
      artifacts + (artifacts > 5000 ? '+' : '') + ' session artifact file(s) under ' +
        codexHome + ' — normal Codex history, harmless by itself: the runners never ' +
        'pass resume flags, and the exec runner verifies a per-run token so a stale ' +
        'session cannot be replayed as a fresh run.'
    );
  }

  return { notes, attention };
}

// The exec lane's report-integrity self-test: launch the REAL engine through
// the sibling exec runner with a trivial no-op order in a scratch directory
// (read-only sandbox) and verify the nonce round-trip — brief in, echo out,
// `REPORT INTEGRITY: verified` printed. Costs one real model call, so it runs
// only under `--doctor --live`.
function runExecSelftest() {
  const execRunner = path.join(__dirname, 'orchestra-exec.js');
  if (!fs.existsSync(execRunner)) {
    return {
      ok: false,
      skipped: true,
      lines: ['exec-lane self-test: SKIPPED — ' + execRunner + ' is not installed beside this file.'],
    };
  }
  let dir = '';
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-selftest-'));
  } catch (e) {
    return { ok: false, lines: ['exec-lane self-test: could not create a scratch dir (' + ((e && e.message) || e) + ')'] };
  }
  try {
    // A git repo lets the runner produce a real (empty) tree audit.
    spawnSync('git', ['init', '-q', dir], { encoding: 'utf8' });
    const wo = path.join(dir, 'no-op-order.txt');
    fs.writeFileSync(
      wo,
      'SELF-TEST — a deliberate no-op. Do not read files, run commands, or edit\n' +
        'anything. Reply with the required report structure exactly: STATUS: DONE,\n' +
        'CHANGES - none, VERIFICATION - not run (no-op self-test), DEVIATIONS -\n' +
        'none, CONCERNS - none, and the mandatory final REPORT INTEGRITY line.\n',
      'utf8'
    );
    const r = spawnSync(
      process.execPath,
      [execRunner, '--work-order', wo, '--cd', dir, '--no-probe',
        '--timeout-ms', String(Math.max(CONFIG.probeTimeoutMs * 3, 180000))],
      {
        encoding: 'utf8',
        timeout: Math.max(CONFIG.probeTimeoutMs * 3, 180000) + 30000,
        maxBuffer: 16 * 1024 * 1024,
        env: Object.assign({}, process.env, {
          ORCHESTRA_EXEC_SANDBOX: 'read-only',
          ORCHESTRA_EXEC_IDLE_MS: '0',
          CLAUDE_PROJECT_DIR: dir,
        }),
      }
    );
    const out = (r.stdout || '') + (r.stderr || '');
    if (/REPORT INTEGRITY: verified/.test(out)) {
      const nonce = /RUN NONCE: ([0-9a-f]+)/.exec(out);
      return {
        ok: true,
        lines: [
          'exec-lane report-integrity self-test: ok — a no-op order round-tripped the ' +
            'run token' + (nonce ? ' (' + nonce[1] + ')' : '') + ' and the runner verified it.',
        ],
      };
    }
    return {
      ok: false,
      lines: [
        'exec-lane report-integrity self-test: FAILED — the no-op run did not produce a',
        'verified report. Runner output (last 30 lines):',
      ].concat(tail(out, 30).split('\n').map((l) => '  ' + l)),
    };
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      /* scratch leak is cosmetic */
    }
  }
}

// `--doctor`: the install check on its own, for a human, at a moment of their
// choosing — at install time (the installer runs it), or the first time a
// review comes back empty.
//
// It exists because the alternative is what actually happened: a helper file
// misplaced by one directory produced reviews that returned nothing, for days,
// with no line anywhere saying the install was wrong. The check was already in
// the runner; it was only reachable by running a whole review.
function runDoctor(live) {
  const install = inspectCodexInstall();
  const hazards = staleSessionHazards();
  const out = [];
  out.push('ORCHESTRA — Codex install check');
  out.push('');
  out.push('codex binary (CODEX_BIN=' + CONFIG.bin + '): ' +
    (install.resolved.real
      ? install.resolved.path
      : 'NOT FOUND on PATH — install the Codex CLI, or set CODEX_BIN to its full path'));
  for (const line of install.lines) out.push('  ' + line);
  if (!CONFIG.helperSiblings.length) {
    out.push('  helper siblings: none expected on this platform');
  } else if (!install.installDir) {
    out.push('  helper siblings: NOT CHECKED — the install directory is unknown until the ' +
      'binary resolves');
  }

  // A binary the runner cannot find is a failed check, not a clean bill of
  // health with a note attached: a review on this machine would end at
  // "the Codex CLI could not be launched".
  if (!install.installDir) {
    out.push('');
    out.push('NEEDS ATTENTION');
    out.push('  The Codex CLI could not be resolved, so no review can run and the install ' +
      'cannot be inspected. Install it (https://developers.openai.com/codex/cli), or set ' +
      'CODEX_BIN to the executable\'s full path — on Windows that is usually ' +
      '%LOCALAPPDATA%\\OpenAI\\Codex\\bin\\<hash>\\codex.exe.');
    for (const a of hazards.attention) out.push('  ' + a);
    process.stdout.write(out.join('\n') + '\n');
    process.exitCode = 1;
    return;
  }

  // Stale-session hazard report — informational notes always, resume-prone
  // findings under NEEDS ATTENTION below.
  for (const n of hazards.notes) out.push('  ' + n);

  if (install.missing.length || hazards.attention.length) {
    out.push('');
    out.push('NEEDS ATTENTION');
    for (const a of hazards.attention) out.push('  ' + a);
  }
  if (install.missing.length) {
    out.push('  ' + install.detail);
    out.push('');
    // installDir is known here — the unresolved-binary case returned above.
    out.push('  Fix it by putting each missing name DIRECTLY in ' + install.installDir + ':');
    for (const name of install.missing) {
      // Where a stray copy is somewhere on this machine, name it — the copy
      // command is then a fact rather than a template to fill in.
      const found = (install.siblings.searched || []).find((d) => {
        try {
          return fs.existsSync(path.join(d, name));
        } catch (_) {
          return false;
        }
      });
      out.push(
        process.platform === 'win32'
          ? '    copy "' + (found ? path.join(found, name) : '<known-good ' + name + '>') +
            '" "' + path.join(install.installDir, name) + '"'
          : '    cp -R "' + (found ? path.join(found, name) : '<known-good ' + name + '>') +
            '" "' + path.join(install.installDir, name) + '"'
      );
    }
    out.push('');
    out.push('  Then re-run this check. If your install legitimately does not carry these');
    out.push('  files, set ORCHESTRA_CODEX_HELPER_SIBLINGS (comma-separated, empty for none)');
    out.push('  or "codex": { "helperSiblings": [...] } in .claude/orchestra.json.');
  } else if (!hazards.attention.length) {
    out.push('');
    out.push('OK — a review would find this install complete.');
    out.push('  (Auth is not checked here: run `codex login`, or export OPENAI_API_KEY.');
    out.push('   The review runner probes auth itself before every review.)');
  }

  // The live self-test costs one real model call, so it runs only on request.
  let liveFailed = false;
  if (live) {
    const selftest = runExecSelftest();
    out.push('');
    for (const l of selftest.lines) out.push(l);
    liveFailed = !selftest.ok && !selftest.skipped;
  } else if (!install.missing.length) {
    out.push('');
    out.push('  (Add --live to also self-test the exec lane\'s report-integrity token with a');
    out.push('   real no-op engine run — proves a fresh session and the nonce round-trip,');
    out.push('   at the cost of one model call.)');
  }

  process.stdout.write(out.join('\n') + '\n');
  // A non-zero exit is what lets a wrapper — the installer, CI, a shell script —
  // act on the result without parsing prose.
  process.exitCode =
    install.missing.length || hazards.attention.length || liveFailed ? 1 : 0;
}

// Environment for every git the review touches — the runner's own calls and the
// engine's alike. Without both halves the isolation is decorative: the engine
// runs far more git than the runner does.
function childEnv(extra) {
  const env = Object.assign({}, process.env, extra || {});
  if (SCRATCH.gitConfigFile) {
    env.GIT_CONFIG_GLOBAL = SCRATCH.gitConfigFile;
    env.GIT_CONFIG_NOSYSTEM = '1';
  }
  // FIX: not every helper Codex needs is resolved relative to its own binary —
  // `codex-windows-sandbox-setup.exe` is resolved by NAME. Putting the install
  // directory FIRST on the engine's PATH makes a correctly-placed helper
  // findable regardless of how the user's PATH is arranged (a shim directory,
  // a package-manager wrapper, or nothing at all). It cannot mask a missing
  // file — an empty directory adds no names — so this is a cheap widening of
  // where a present helper can be found, not a substitute for the check.
  if (CONFIG.installDir) {
    // Windows environment blocks are case-insensitive and the real key is
    // usually `Path`; adding a second `PATH` key would be a coin flip over
    // which one the child sees.
    const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    const cur = String(env[key] || '');
    const same = (a, b) =>
      process.platform === 'win32'
        ? a.toLowerCase() === b.toLowerCase()
        : a === b;
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

function gitOut(args, cwd) {
  const r = runGit(args, cwd);
  return r.status === 0 ? (r.stdout || '').trim() : '';
}

// Reclaim scratch directories left by a run that died without running any
// handler — a SIGKILL, a power cut, a container reaped mid-review. Each run
// stamps its pid; a directory whose owner is gone is abandoned, and a directory
// whose owner is alive belongs to a concurrent review and is left strictly
// alone. (pid reuse could in principle make a live directory look abandoned;
// the loss in that case is one concurrent review, not any user data.)
function sweepStaleScratch(root, repoTop) {
  let entries;
  try {
    entries = fs.readdirSync(root);
  } catch (_) {
    return { reclaimed: 0, stuck: [] };
  }
  let reclaimed = 0;
  const stuck = [];
  for (const name of entries) {
    if (!name.startsWith(SCRATCH_PREFIX)) continue;
    const dir = path.join(root, name);
    if (dir === SCRATCH.dir) continue;
    let ownerPid = 0;
    try {
      ownerPid = parseInt(fs.readFileSync(path.join(dir, 'owner.pid'), 'utf8').trim(), 10);
    } catch (_) {
      ownerPid = 0;
    }
    if (ownerPid > 0) {
      try {
        process.kill(ownerPid, 0); // alive — a concurrent review owns this
        continue;
      } catch (e) {
        if (e && e.code === 'EPERM') continue; // exists, someone else's — leave it
      }
    }
    // Worktrees live at <scratch>/attempt-<n>/wt; older runs put a single one
    // at <scratch>/wt, and an orphan from either shape has to be reclaimable.
    const stale = [path.join(dir, 'wt')];
    try {
      for (const sub of fs.readdirSync(dir)) {
        if (sub.startsWith('attempt-')) stale.push(path.join(dir, sub, 'wt'));
      }
    } catch (_) {
      /* unreadable — the prune below still tidies git's records */
    }
    // FIX: this used to count only what the OS let us DELETE, so a sweep that
    // had done its job reported "reclaimed 0". A killed runner's engine child
    // outlives it, and on Windows that child's working directory IS the review
    // worktree — which locks the directory against deletion, so both the
    // `worktree remove` and the `rmSync` fail while `prune` still reconciles
    // git's records. Count what was FOUND and acted on: this directory's owner
    // is gone, so it is an abandoned review being reclaimed, whether or not the
    // filesystem lets go of it this second. What could not be deleted is
    // reported separately rather than folded into silence.
    reclaimed++;
    for (const wt of stale) {
      if (repoTop && fs.existsSync(wt)) runGit(['-C', repoTop, 'worktree', 'remove', '--force', wt]);
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      /* busy or not ours — the prune below still tidies git's records */
    }
    if (fs.existsSync(dir)) stuck.push(dir);
  }
  if (repoTop) runGit(['-C', repoTop, 'worktree', 'prune']);
  return { reclaimed, stuck };
}

// Materialize the pinned commit as a detached worktree. Worktrees share the
// repository's object database, so the base ref is reachable from inside it and
// `git diff <base>..HEAD` resolves exactly as it would in the main checkout —
// minus every file the session created after the commit.
function createPinnedWorktree(repoTop, headRef, attemptDir) {
  const resolved = gitOut(['-C', repoTop, 'rev-parse', '--verify', headRef + '^{commit}']);
  if (!resolved) {
    return { error: 'cannot resolve --head-ref "' + headRef + '" to a commit in ' + repoTop };
  }
  const dir = path.join(attemptDir, 'wt');
  const add = runGit(['-C', repoTop, 'worktree', 'add', '--detach', dir, resolved]);
  if (add.status !== 0) {
    return {
      error:
        'git worktree add failed (' + dir + '): ' +
        (tail(add.stderr || '', 10) || 'exit ' + add.status),
    };
  }
  SCRATCH.worktrees.push(dir);
  SCRATCH.repoTop = repoTop;
  return { dir, sha: resolved };
}

// Guaranteed teardown. Idempotent, synchronous (so it is legal from an `exit`
// handler), and it never lets a teardown failure become the review's outcome:
// if `worktree remove` balks, the directory goes anyway and `prune` reconciles
// git's records with reality.
function teardownScratch() {
  if (SCRATCH.torndown) return;
  SCRATCH.torndown = true;
  if (SCRATCH.repoTop) {
    for (const wt of SCRATCH.worktrees) {
      runGit(['-C', SCRATCH.repoTop, 'worktree', 'remove', '--force', wt]);
    }
  }
  if (SCRATCH.dir) {
    try {
      fs.rmSync(SCRATCH.dir, { recursive: true, force: true });
    } catch (_) {
      /* best effort — the prune below still clears the stale registration */
    }
  }
  if (SCRATCH.repoTop) runGit(['-C', SCRATCH.repoTop, 'worktree', 'prune']);
}

// A worktree registered in .git/worktrees but left on disk is a leak the user
// has to clean by hand, so cover every exit path a process can actually run
// code on. SIGKILL runs nothing, by definition — that case is covered by the
// next run's sweep, not by hope.
//
// WINDOWS: there are no POSIX signals there. `child.kill('SIGTERM')` becomes
// TerminateProcess, which is SIGKILL's semantics — no handler runs, whatever
// this registers. So on Windows EVERY kill is the SIGKILL case, and the next
// run's sweep is the only mechanism that reclaims the worktree. That is not a
// gap to fix here (nothing can run in a terminated process); it is a reason the
// sweep exists and must keep working.
let signalsArmed = false;
function armTeardown() {
  if (signalsArmed) return;
  signalsArmed = true;
  process.on('exit', teardownScratch);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    try {
      process.on(sig, () => {
        teardownScratch();
        process.exit(1);
      });
    } catch (_) {
      /* signal not supported on this platform */
    }
  }
}

// ------------------------------------------------- codex install resolution

// Resolve a bare command name against PATH (honouring PATHEXT on Windows), so
// we can realpath it. Returns '' when it isn't found — the spawn will then
// fail with ENOENT and the caller prints the friendly "not found" message.
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

// FIX: a CODEX_BIN pointing at a symlink or Windows junction (the usual
// AppData shim) breaks Codex's own sibling-file resolution — it resolves its
// helpers relative to the link, not the install. Hand it the real path.
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

// Codex has moved its install layout at least once, and the repair recipes
// written for one layout are not automatically right for the next. Naming the
// layout in the preflight is what makes a future move visible in the FIRST
// report that hits it, instead of discovered a round later from a puzzling
// failure.
//
// Known layouts:
//   appdata-versioned  <LOCALAPPDATA>/OpenAI/Codex/bin/<hash>/codex.exe
//                      (observed 2026-08-12, codex-cli >= 0.147.0)
//   codex-standalone   <home>/.codex/packages/standalone/<version|current>/bin/codex
//                      (the layout the documented helper repair was derived on)
// Anything else is 'unknown', which is a fact worth printing rather than an
// error: package managers, Homebrew, and hand-built installs are all legitimate.
function detectInstallLayout(binPath) {
  const p = String(binPath || '').replace(/\\/g, '/');
  const lower = p.toLowerCase();
  if (/\/openai\/codex\/bin\/[^/]+\/[^/]+$/.test(lower)) {
    return { id: 'appdata-versioned', binRoot: path.dirname(path.dirname(p)) };
  }
  if (/\/\.codex\/packages\/standalone\/[^/]+\/bin\/[^/]+$/.test(lower)) {
    return { id: 'codex-standalone', binRoot: path.dirname(path.dirname(path.dirname(p))) };
  }
  return { id: 'unknown', binRoot: '' };
}

// Directories INSIDE the install itself, which is where a hand repair puts a
// helper when it guesses wrong: the 2026-08-18 failure was
// `codex-windows-sandbox-setup.exe` sitting in `codex-resources\`, one level
// below the only place that resolves it. Bounded to two levels — deep enough
// for the observed case and anything shaped like it, shallow enough that a
// large resource bundle cannot turn preflight into a filesystem crawl.
function installSubdirs(installDir, depth) {
  const out = [];
  const walk = (dir, left) => {
    if (left <= 0) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return; // unreadable subtree: not a candidate, not an error
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const sub = path.join(dir, e.name);
      out.push(sub);
      walk(sub, left - 1);
    }
  };
  walk(installDir, depth);
  return out;
}

// Directories that might hold a known-good copy of a helper the install is
// missing: the user's repair kit, the install's own subdirectories (a misplaced
// copy of exactly the right version), sibling versions of the SAME layout (a
// self-update leaves the previous version's directory behind, complete), and
// the other known layout entirely.
function helperSourceCandidates(installDir, layout) {
  const dirs = [];
  if (CONFIG.helpersDir) dirs.push(CONFIG.helpersDir);
  // Before reaching for another install's copy, look inside this one: a helper
  // that is present but misplaced is the same version the binary shipped with,
  // and flattening it up is the whole repair.
  if (installDir) dirs.push(...installSubdirs(installDir, 2));
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const codexHome = (process.env.CODEX_HOME || '').trim() || (home ? path.join(home, '.codex') : '');

  // Sibling version directories under the same bin root, newest first — the
  // self-update case, where the previous install is still intact next door.
  if (layout.binRoot) {
    try {
      const subs = fs
        .readdirSync(layout.binRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(layout.binRoot, e.name))
        .filter((d) => path.resolve(d) !== path.resolve(installDir));
      subs.sort((a, b) => {
        try {
          return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
        } catch (_) {
          return 0;
        }
      });
      for (const d of subs) dirs.push(d, path.join(d, 'bin'));
    } catch (_) {
      /* no siblings readable — the list below still has candidates */
    }
  }

  // The other known layout, whichever one we are not in.
  if (codexHome) {
    const standalone = path.join(codexHome, 'packages', 'standalone');
    dirs.push(path.join(standalone, 'current', 'bin'));
    try {
      for (const e of fs.readdirSync(standalone, { withFileTypes: true })) {
        if (e.isDirectory()) dirs.push(path.join(standalone, e.name, 'bin'));
      }
    } catch (_) {
      /* not this layout */
    }
    dirs.push(path.join(codexHome, 'bin'));
  }
  return dirs.filter((d, i) => d && dirs.indexOf(d) === i);
}

// Is this sibling actually present, in a form that can serve? `fs.existsSync`
// alone answers a weaker question than the one that matters: a DIRECTORY named
// `codex-windows-sandbox-setup.exe` satisfies it and launches nothing. Names
// that are executables must be files; `codex-resources` is a directory and any
// entry of that name is accepted.
function siblingPresent(dir, name) {
  let st;
  try {
    st = fs.statSync(path.join(dir, name));
  } catch (_) {
    return false;
  }
  return /\.(exe|cmd|bat|com|dll)$/i.test(name) ? st.isFile() : true;
}

// FIX: the documented repair for a self-update that strips helper files was
// "copy them back next to the resolved binary" — a recipe a human had to
// remember, derived on a layout Codex has since abandoned, and verified by
// nothing. Verify it instead: check the files are actually there, repair from
// any locatable known-good copy, and when they cannot be found say exactly what
// is missing and exactly where we looked. The alternative is the observed
// failure: the binary launches, produces no verdict, and the report guesses.
//
// "Actually there" means BESIDE the binary and of the right kind — the two
// weaker questions (does the name exist anywhere in the install, does anything
// by that name exist here) each have a false-positive that reads as healthy.
function verifyHelperSiblings(installDir, layout) {
  const wanted = CONFIG.helperSiblings;
  if (!wanted.length || !installDir) {
    return { checked: false, missing: [], restored: [], searched: [] };
  }
  const missing = wanted.filter((name) => !siblingPresent(installDir, name));
  if (!missing.length) {
    return { checked: true, missing: [], restored: [], searched: [] };
  }

  const searched = helperSourceCandidates(installDir, layout);
  const restored = [];
  const problems = [];
  const stillMissing = [];
  const under = (parent, child) => {
    try {
      const rel = path.relative(path.resolve(parent), path.resolve(child));
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
    } catch (_) {
      return false;
    }
  };
  const insideInstall = (dir) => under(installDir, dir);
  for (const name of missing) {
    const dest = path.join(installDir, name);
    const srcDir = searched.find(
      // Never copy a directory into its own ancestor: `codex-resources` missing
      // at the top level while a `codex-resources/codex-resources` exists would
      // otherwise ask copyInto to walk into the tree it is writing.
      (d) => !under(dest, d) && siblingPresent(d, name)
    );
    if (!srcDir) {
      stillMissing.push(name);
      continue;
    }
    const src = path.join(srcDir, name);
    try {
      copyInto(src, dest);
      // A copy that came from INSIDE the install is a different story from a
      // copy pulled off another version, and the report should not blur them:
      // this one was never missing, only unreachable — which is precisely the
      // failure mode that reads as healthy right up until the review no-ops.
      if (insideInstall(srcDir)) {
        restored.push(
          name + ' (was MISPLACED inside the install at ' + srcDir + ' — copied up beside the binary)'
        );
      } else {
        restored.push(name + ' (from ' + srcDir + ')');
      }
    } catch (e) {
      stillMissing.push(name);
      problems.push(name + ': ' + ((e && e.message) || e));
    }
  }
  return { checked: true, missing: stillMissing, restored, searched, problems };
}

// FIX: a Codex self-update can silently remove files a working install needs.
// Mirror anything present in the helpers directory but missing (or a different
// size) from the Codex install directory. No filenames are hardcoded — the
// directory the user populates IS the repair kit. Never fatal: a failed
// restore is reported and the review proceeds.
function restoreHelpers(helpersDir, installDir) {
  if (!helpersDir) return { restored: [], note: '' };
  try {
    if (!fs.statSync(helpersDir).isDirectory()) {
      return { restored: [], note: 'helpers path is not a directory: ' + helpersDir };
    }
  } catch (e) {
    return {
      restored: [],
      note: 'helpers directory unreadable (' + helpersDir + '): ' + ((e && e.message) || e),
    };
  }
  if (!installDir) {
    return {
      restored: [],
      note:
        'helpers configured but the Codex install directory is unknown — set CODEX_BIN ' +
        'to the executable\'s path so its install directory can be resolved',
    };
  }

  const restored = [];
  const problems = [];
  const walk = (srcDir, destDir, rel) => {
    let list;
    try {
      list = fs.readdirSync(srcDir, { withFileTypes: true });
    } catch (e) {
      problems.push(rel + ': ' + ((e && e.message) || e));
      return;
    }
    for (const entry of list) {
      const src = path.join(srcDir, entry.name);
      const dest = path.join(destDir, entry.name);
      const relName = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        walk(src, dest, relName);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const srcStat = fs.statSync(src);
        let needs = true;
        try {
          needs = fs.statSync(dest).size !== srcStat.size;
        } catch (_) {
          needs = true; // missing entirely — the self-update case
        }
        if (!needs) continue;
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        try {
          fs.chmodSync(dest, srcStat.mode);
        } catch (_) {
          /* mode is best-effort (and meaningless on Windows) */
        }
        restored.push(relName);
      } catch (e) {
        problems.push(relName + ': ' + ((e && e.message) || e));
      }
    }
  };
  walk(helpersDir, installDir, '');

  return {
    restored,
    note: problems.length ? 'helper restore had problems — ' + problems.join('; ') : '',
  };
}

// Everything the runner knows how to learn about the local Codex install,
// gathered in one place so the review preflight and `--doctor` cannot drift
// apart: a doctor that checks something other than what the review checks is a
// second opinion about the wrong install.
//
// Returns the preflight lines to print, the siblings that are still missing
// after repair, and the detail paragraph that explains them. Nothing here
// prints, exits, or decides — the callers do that, differently.
function inspectCodexInstall() {
  const lines = [];
  const resolved = resolveCodexBin(CONFIG.bin);
  CONFIG.resolvedBin = resolved.path;
  if (resolved.note) lines.push(resolved.note);
  const installDir = resolved.real ? path.dirname(resolved.path) : '';
  // Every child process the review launches inherits this, so a helper Codex
  // resolves by name is findable wherever the user's PATH happens to point.
  CONFIG.installDir = installDir;

  // Which install layout are we looking at? Codex has relocated itself once
  // already (from <home>/.codex/packages/standalone/current/bin to
  // <LOCALAPPDATA>/OpenAI/Codex/bin/<hash>), and the repair recipe written for
  // the old one was never verified against the new one. Print the layout so the
  // NEXT relocation is visible immediately instead of inferred from a failure.
  const layout = detectInstallLayout(resolved.path);
  if (installDir) {
    lines.push(
      'codex install layout: ' + layout.id + ' (' + installDir + ')' +
        // The caveat only matters where helper files are actually expected;
        // on a platform that needs none, an unknown layout is just a package
        // manager doing its job, and saying more would be noise.
        (layout.id === 'unknown' && CONFIG.helperSiblings.length
          ? ' — not one of the two layouts this runner knows, so helper-sibling repair can ' +
            'only use a directory you name in helpersDir'
          : '')
    );
  }

  if (CONFIG.helpersDir) {
    const restore = restoreHelpers(CONFIG.helpersDir, installDir);
    if (restore.restored.length) {
      lines.push(
        'restored ' + restore.restored.length + ' file(s) into the Codex install from ' +
          CONFIG.helpersDir + ': ' + restore.restored.join(', ')
      );
    }
    if (restore.note) lines.push(restore.note);
  }

  // Helper siblings: the files a self-update strips — or a hand repair files in
  // the wrong place — verified next to the RESOLVED binary rather than assumed.
  const siblings = verifyHelperSiblings(installDir, layout);
  if (siblings.restored.length) {
    lines.push(
      'helper siblings repaired next to the resolved binary: ' + siblings.restored.join(', ')
    );
  }
  for (const p of siblings.problems || []) lines.push('helper repair problem — ' + p);

  let detail = '';
  if (siblings.missing.length) {
    detail =
      'MISSING FROM THE CODEX INSTALL: ' + siblings.missing.join(', ') + ' (expected in ' +
      (installDir || '(the Codex install directory, which could not be resolved)') +
      '). A Codex self-update removes these, and a hand repair can file them one ' +
      'directory too deep; either way the install launches and then dies without a ' +
      'verdict. Searched for known-good copies in: ' +
      (siblings.searched.length ? siblings.searched.join('; ') : '(nowhere — no candidates)') +
      '. Fix by copying them there by hand, or point "codex": { "helpersDir": "<dir>" } at ' +
      'a directory holding known-good copies.';
    // Where a specific absence has a specific, known consequence, say it. The
    // generic sentence above is true of every name in the list and therefore
    // tells a reader nothing about which one just cost them a review.
    for (const name of siblings.missing) {
      if (HELPER_CONSEQUENCE[name]) detail += ' ' + name + ': ' + HELPER_CONSEQUENCE[name];
    }
  } else if (siblings.checked) {
    lines.push('helper siblings present: ' + CONFIG.helperSiblings.join(', '));
  }

  return {
    lines,
    resolved,
    installDir,
    layout,
    siblings,
    missing: siblings.missing,
    detail,
  };
}

// Pull the path out of a porcelain v1 line ("XY path", or "R  old -> new").
// Quoted paths (non-ASCII / spaces with core.quotePath on) are left as-is;
// they simply won't stat, and the line alone still contributes to the
// fingerprint.
function porcelainPath(line) {
  let p = line.slice(3);
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + 4);
  if (p.startsWith('"') && p.endsWith('"')) return '';
  return p;
}

// Working-tree fingerprint, so we can tell whether the reviewer (which is
// meant to be read-only in intent) mutated anything while running the tests —
// and, before launching, whether anything ELSE is still writing the tree.
// Returns null when the dir isn't a git repo or git is unavailable — both
// checks are best-effort safety nets, never hard dependencies.
//
// Status letters alone are NOT enough: appending to a file that is already
// modified leaves `git status` byte-identical, so a tree being actively
// written would read as idle. Annotate each dirty path with its size and
// mtime, which moves on every write.
// Returns { text, map } — the same information twice: `text` for the idle
// precheck, which only asks "did anything move?", and `map` (path → annotated
// line) for the integrity comparison, which has to say WHICH paths moved so
// engine churn can be told from a reviewer editing source.
function treeFingerprint(dir) {
  const r = runGit(['-C', dir, 'status', '--porcelain=v1', '--untracked-files=all']);
  if (r.error || r.status !== 0) return null;
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
  return { text: annotated.join('\n'), map };
}

// Which paths differ between two fingerprints, split into the ones a project
// has declared expected churn and the ones it has not. The split is the whole
// point: an integrity warning that fires on 180 asset-import sidecars teaches
// the reader to ignore integrity warnings.
function fingerprintDelta(before, after, ignore) {
  const changed = [];
  const keys = new Set([...before.map.keys(), ...after.map.keys()]);
  for (const key of keys) {
    const b = before.map.get(key);
    const a = after.map.get(key);
    if (b === a) continue;
    changed.push({
      path: key,
      how: b === undefined ? 'appeared' : a === undefined ? 'reverted' : 'changed',
      line: (a || b || '').trim(),
    });
  }
  changed.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  return {
    suspect: changed.filter((c) => !matchesAny(c.path, ignore)),
    expected: changed.filter((c) => matchesAny(c.path, ignore)),
  };
}

// ------------------------------------------------------------------ brief
// The adversarial reviewer persona lives here, in one place, so every review
// gets the identical discipline regardless of how the launcher phrased things.
function tierLines(tier) {
  if (tier !== 'inert') return [];
  return [
    'TIER: INERT — declared by the Director, VERIFIED BY YOU.',
    'The Director declared this round inert: documentation, comments, or pure',
    'formatting with zero behavior impact. That declaration is a claim, and',
    'your FIRST task is to prove or refute it from the diff itself:',
    '- If ANY changed line can affect behavior, configuration, data, tests,',
    '  or the meaning of an API (including a doc change that alters a',
    '  documented contract), the tier declaration is itself a CRITICAL finding',
    '  ("tier violation") — then ignore the tier and review at FULL depth,',
    '  tests and all.',
    '- Only if the diff is proven inert: run the linter, check the changed',
    '  text against the code it describes, and skip the full test suite. This',
    '  narrows RULE 1\'s re-run obligation for a proven-inert diff only; on',
    '  any doubt, review at full depth.',
    '',
  ];
}

// FIX: a soft "you can skip the tests" in a work order gets overridden by the
// reviewer's own judgment — it runs them anyway and burns the whole clock. A
// prohibition has to be stated as an absolute that explicitly outranks RULE 1,
// and it has to come with somewhere honest to put the verification it could
// not do, or the model will route around it to satisfy the output contract.
function prohibitionLines(forbidden) {
  if (!forbidden.length) return [];
  return [
    'PROHIBITED COMMANDS — ABSOLUTE, AND THEY OVERRIDE RULE 1.',
    'You MUST NOT execute any of the following during this review, for any',
    'reason, including "just to confirm" or "only once":',
    ...forbidden.map((f) => '- ' + f),
    'This is a hard constraint from the project owner, not a preference, and',
    'no judgment of yours overrides it. Do not look for an equivalent command',
    'that evades the list, and do not run it in a subshell, a script, or a',
    'test harness that wraps it.',
    '',
    'If verifying a claim would require a prohibited command:',
    '- do not run it;',
    '- record that claim in CLAIMS CHECKED as',
    '  UNVERIFIED (prohibited: <what you would have had to run>);',
    '- and add one line under VERDICT stating that verification was narrowed.',
    'Review everything you CAN reach without those commands — read the diff,',
    'read the surrounding code it plugs into, and reason about failure',
    'scenarios statically. A narrowed review that REPORTS itself as narrowed',
    'is useful. A review that quietly ran the prohibited command is not, and',
    'neither is one that invents test results it never observed.',
    '',
  ];
}

// FIX: an agentic reviewer handed a pinned SHA in a tree that has moved on
// spends its whole budget trying to reconcile the two — every `git show
// <sha>:<path>` on a file the session created after the commit comes back
// "exists on disk, but not in <sha>", which reads like a repository problem
// worth investigating rather than the expected consequence of a dirty
// checkout. In pinned mode the runner has already removed the contradiction;
// say so plainly, and name the exact diff command, so the engine spends its
// clock on the change instead of on the checkout.
function scopeLines(baseRef, headRef, pinned) {
  if (!pinned) {
    if (!baseRef) return [];
    return [
      'REVIEW SCOPE',
      'BASE REF: ' + baseRef,
      'You are in the project working tree. Diff the change with',
      '`git diff ' + baseRef + '` (add `--staged` if the work is staged). The tree',
      'may also contain unrelated in-progress work by other agents; review the',
      'change described in the work order, not everything the tree happens to',
      'contain.',
      '',
    ];
  }
  const diffCmd = baseRef ? 'git diff ' + baseRef + '..HEAD' : 'git show HEAD';
  return [
    'REVIEW SCOPE — PINNED, CLEAN CHECKOUT',
    ...(baseRef ? ['BASE REF: ' + baseRef] : []),
    'HEAD REF: ' + headRef,
    'You are NOT in the author\'s working directory. You are in a dedicated,',
    'freshly checked-out worktree of this repository, detached at exactly the',
    'commit under review. It shares the repository\'s object database, so every',
    'ref, commit, and history command works normally.',
    '',
    'The change under review is `' + diffCmd + '`. Read that first.',
    '',
    'This checkout is CLEAN and is supposed to be: `git status` reporting',
    'nothing is the expected state, not a sign the change is missing. Files the',
    'author\'s session created after this commit do not exist here, by design —',
    'if a path appears in the work order or the executor report but not on disk,',
    'it was never part of this commit. Note it as a finding and move on. Do not',
    'go looking for the author\'s working directory, and do not spend review',
    'budget reconciling this checkout against anything outside it.',
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
  lines.push('Use these canonical commands when you re-verify; do not guess.');
  lines.push('');
  return lines;
}

function buildBrief(workOrder, executorReport, tier, verification, forbidden, scope) {
  const rule1 = forbidden.length
    ? [
        '1. Verify independently — trust nothing you were told. Read the actual diff',
        '   (REVIEW SCOPE below names the exact command; otherwise `git diff` or',
        '   `git diff --staged`). Read the surrounding code the diff plugs into, not',
        '   only the changed lines. Re-run whatever verification you are PERMITTED to run',
        '   (see PROHIBITED COMMANDS below); the executor\'s pasted output is a',
        '   claim, not evidence, and stays a claim when you cannot re-run it.',
      ]
    : [
        '1. Verify independently — trust nothing you were told. Read the actual diff',
        '   (REVIEW SCOPE below names the exact command; otherwise `git diff` or',
        '   `git diff --staged`). Read the surrounding code the diff plugs into, not',
        '   only the changed lines. Re-run the tests, build, and linters yourself; the',
        '   executor\'s pasted output is a claim, not evidence.',
      ];
  return [
    'You are an adversarial code reviewer working on a software change that a',
    'DIFFERENT engineer just made. Presume the change is broken until you fail',
    'to break it. Be independent and skeptical — you were brought in precisely',
    'because you do not share the author\'s blind spots.',
    '',
    'You are in the project root with shell access. USE IT to verify — do not',
    'review from the description alone.',
    '',
    'RULES',
    ...rule1,
    '2. Hunt for the failure scenario. For each change ask what input, state, or',
    '   sequence makes it wrong — empty/null/zero, error paths, boundaries,',
    '   concurrency, resource cleanup, security (injection, path traversal,',
    '   secrets), API-contract breaks, and silent behavior changes to untouched',
    '   callers.',
    '3. Audit against the order. Does the diff do everything the work order',
    '   required, and nothing it was not asked to? Unexplained changes are',
    '   findings even when they look harmless.',
    '4. NEVER fix, edit, stage, or commit anything. You review; the executor',
    '   fixes. Running tests/builds/linters is fine; changing source is not.',
    '5. Calibrate the verdict. REVISE requires a concrete defect: a failure',
    '   scenario you can articulate, a violated requirement, or a refuted claim.',
    '   Style and hypothetical purity are NITS, never blockers. When genuinely',
    '   unsure a finding is real, mark it UNVERIFIED rather than inflating or',
    '   hiding it.',
    '',
    'OUTPUT — emit EXACTLY this structure and nothing after it. Do not wrap it',
    'in code fences.',
    '',
    'VERDICT: APPROVE | REVISE',
    '',
    'FINDINGS',
    '- [CRITICAL|MAJOR|MINOR] <path:line> — <defect> — <concrete failure',
    '  scenario: given X, Y happens instead of Z>',
    '- ...or "none"',
    '',
    'CLAIMS CHECKED',
    '- "<executor claim>" → CONFIRMED | REFUTED | UNVERIFIED (<how you checked>)',
    '',
    'NITS',
    '- <non-blocking suggestions — or "none">',
    '',
    'Any CRITICAL or MAJOR finding forces VERDICT: REVISE. MINOR-only may be',
    'APPROVE with the findings listed.',
    '',
    ...scopeLines(scope.baseRef, scope.headRef, scope.pinned),
    ...prohibitionLines(forbidden),
    ...tierLines(tier),
    ...manifestLines(verification),
    '=== WORK ORDER (the intent — what should have happened) ===',
    workOrder.trim() || '(none provided)',
    '',
    '=== EXECUTOR REPORT (the claim — what the author says happened) ===',
    executorReport.trim() || '(none provided)',
    '',
  ].join('\n');
}

// --------------------------------------------------- engine attempts (A + B)
//
// Everything in this section exists because of one field report: `codex exec`
// exited 143 with no verdict, and the review said only that the cause might be
// auth, or flags, or the sandbox, or a missing install file. None of those was
// checkable from the report, and one of them — "the runner's own timeout killed
// it" — the runner could have answered with certainty and did not. A failure
// report that lists causes it did not test is not a diagnosis; it is a shrug
// with citations.

// Who ended the child, and may a second attempt plausibly go differently?
//
// The distinction that matters most is the cheapest one to get right: node
// sets error.code ETIMEDOUT when ITS OWN timer fired, so the runner never has
// to guess about its own kill. Everything else is either a signal from outside
// (someone else killed it) or codex deciding to stop (its own exit status),
// and those are very different bugs.
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
      retryable: false,
    };
  }
  if (run.error && run.error.code === 'ETIMEDOUT') {
    return {
      kind: 'runner-timeout',
      headline:
        'review timed out after ' + cap + 'ms (cap from: ' + CONFIG.timeoutSource + ')',
      killedBy:
        'THIS RUNNER — its own ' + cap + 'ms timer fired and terminated codex. ' +
        'Nothing about codex, your auth, or your flags is implicated by this exit.',
      ran,
      retryable: false, // a second full timeout costs the same clock to learn nothing
    };
  }
  if (run.signal) {
    return {
      kind: 'signal',
      headline: 'codex was killed by ' + run.signal + ' before producing a verdict',
      killedBy:
        'an EXTERNAL signal (' + run.signal + ') — NOT this runner: its ' + cap +
        'ms timer had not fired when the child died.',
      ran,
      retryable: true,
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
        'something inside the codex process tree was terminated by ' + name + ': an ' +
        'external kill (a task manager, an antivirus, a CI reaper, a parent shell ' +
        'timing out), or codex terminating one of its own children and propagating ' +
        'the status.',
      ran,
      retryable: true,
    };
  }
  if (run.error) {
    return {
      kind: 'spawn-error',
      headline: 'failed to launch Codex: ' + String(run.error.message || run.error),
      killedBy: 'the launch itself failed (' + (run.error.code || 'no code') + ')',
      ran,
      retryable: true,
    };
  }
  if (st == null) {
    // No status, no signal, no error: the child ended in a way this platform
    // did not describe. Say that plainly rather than inventing a status, and
    // treat it as retryable — an undescribed ending is exactly the shape a
    // second attempt sometimes resolves.
    return {
      kind: 'unknown',
      headline: 'codex ended without reporting an exit status',
      killedBy:
        'unknown — the platform reported no exit status, no signal, and no launch error. ' +
        'This runner\'s ' + cap + 'ms timer did not fire.',
      ran,
      retryable: true,
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
      retryable: false, // a deliberate non-zero exit reproduces; the probe covers auth
    };
  }
  return { kind: 'ok', headline: '', killedBy: '', ran, retryable: false };
}

// Last bytes of a file, for logs that may be enormous.
function tailFile(file, bytes, lines) {
  try {
    const size = fs.statSync(file).size;
    const start = Math.max(0, size - bytes);
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(Math.min(bytes, size));
      fs.readSync(fd, buf, 0, buf.length, start);
      return tail(buf.toString('utf8'), lines);
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) {
    return '';
  }
}

// Codex keeps its own session record, and after a kill it is often the only
// place the engine's last words survive — stderr may be empty precisely
// because the process never got to flush. Name the files it wrote during THIS
// attempt (mtime inside the attempt window), newest first.
function recentSessionLogs(sinceMs, limit) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const codexHome = (process.env.CODEX_HOME || '').trim() || (home ? path.join(home, '.codex') : '');
  if (!codexHome) return [];
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4 || found.length > 400) return;
    let list;
    try {
      list = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of list) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      try {
        const st = fs.statSync(p);
        if (st.mtimeMs >= sinceMs) found.push({ p, m: st.mtimeMs });
      } catch (_) {
        /* raced with a rotation — skip it */
      }
    }
  };
  for (const sub of ['sessions', 'log', 'logs']) walk(path.join(codexHome, sub), 0);
  found.sort((a, b) => b.m - a.m);
  return found.slice(0, limit || 2).map((f) => f.p);
}

// The per-attempt failure block. This is the thing the field report was missing:
// who killed it, how long it ran against the cap it was given, and what the
// engine actually said before it died.
function attemptDiagnostics(att) {
  const lines = [
    'ATTEMPT ' + att.n + ' of ' + att.of + ' — ' + att.class.headline,
    '  killed by:  ' + att.class.killedBy,
    '  elapsed:    ' + att.class.ran,
    '  checkout:   ' + att.reviewDirLabel + ' (' + att.reviewDir + ')',
  ];
  const err = tail(att.stderr || '', 25);
  lines.push('  codex stderr (last 25 lines):');
  lines.push(err ? indent(err, '    ') : '    (codex wrote nothing to stderr)');
  const out = tail(att.stdout || '', 10);
  if (out) {
    lines.push('  codex stdout (last 10 lines):');
    lines.push(indent(out, '    '));
  }
  for (const log of att.sessionLogs || []) {
    lines.push('  codex session log written during this attempt: ' + log);
    const t = tailFile(log, 8192, 6);
    if (t) lines.push(indent(t, '    '));
  }
  // A cause list is a legitimate thing to print ONLY when the runner genuinely
  // does not know. When the runner sent the kill itself, listing "maybe auth,
  // maybe flags, maybe the sandbox" is false: none of them ended this process.
  if (att.class.kind === 'exit') {
    lines.push(
      '  candidate causes for a self-chosen non-zero exit: not authenticated (set ' +
        'OPENAI_API_KEY or run `codex login`), an unsupported flag on this Codex ' +
        'version (check `codex exec --help`, adjust ORCHESTRA_REVIEW_ARGS), a sandbox ' +
        'restriction, or an install missing files a self-update removed (see the ' +
        'helper-sibling preflight above).'
    );
  }
  if (att.class.kind === 'runner-timeout') {
    lines.push(
      '  raise the cap where it takes effect — "codex": { "reviewTimeoutMs": <ms> } in ' +
        '.claude/orchestra.json, ORCHESTRA_REVIEW_TIMEOUT_MS, or --timeout-ms. A timeout ' +
        'named only in a work order\'s prose does nothing.'
    );
    if (CONFIG.forbidden.length === 0) {
      lines.push(
        '  if the reviewer burned the clock on a suite it did not need, pass --no-tests ' +
          'or list the commands under "codex": { "doNotRun": [...] } — a prohibition, ' +
          'not a request.'
      );
    }
    if (!CONFIG.headRef) {
      lines.push(
        '  if the change is committed, pass --head-ref <sha>: reviewing a DIRTY tree ' +
          'against a pinned SHA is a known clock-burner.'
      );
    }
    if (RESOLVED_TIER === 'inert') {
      lines.push(
        '  an inert tier does not make the engine faster — it still explores before it ' +
          'concludes. Budget minutes.'
      );
    }
  }
  return lines.join('\n');
}

// A project whose engine imports assets on first open rewrites hundreds of
// files the moment anything looks at a fresh checkout — and every one of them
// lands between the integrity baseline and the integrity check unless the
// warmup happens FIRST. Running it here, before the baseline, is what keeps
// the integrity warning about the reviewer rather than about the engine.
function runWarmup(dir) {
  if (!CONFIG.warmupCmd) return null;
  const started = Date.now();
  const r = spawnSync(CONFIG.warmupCmd, {
    cwd: dir,
    shell: true,
    encoding: 'utf8',
    timeout: CONFIG.warmupTimeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    env: childEnv(),
  });
  const elapsed = Date.now() - started;
  const timedOut = !!(r.error && r.error.code === 'ETIMEDOUT');
  return {
    ok: !r.error && r.status === 0,
    timedOut,
    status: r.status,
    elapsed,
    note:
      'warmup `' + CONFIG.warmupCmd + '` ' +
      (timedOut
        ? 'hit its ' + CONFIG.warmupTimeoutMs + 'ms cap'
        : r.error
        ? 'could not run (' + ((r.error && r.error.message) || r.error) + ')'
        : r.status === 0
        ? 'completed in ' + ms(elapsed)
        : 'exited ' + r.status + ' after ' + ms(elapsed)) +
      ' — integrity baseline taken after it' +
      (r.status === 0 || timedOut ? '' : '; its output: ' + (tail(r.stderr || r.stdout || '', 3) || '(none)')),
  };
}

// STAGE-A PROBE. Field evidence 7: this check lived in Director briefs and
// memory checklists — "before the real review, run a cheap `codex exec` echo to
// confirm auth works". A checklist item every caller must remember is a runner
// feature that has not been written yet. Here it is: a few seconds and a few
// tokens spent to find out whether the engine can run AT ALL, before committing
// a thirty-minute budget to finding out the hard way.
//
// Deliberately asymmetric: a probe that FAILS is decisive (the engine could not
// complete a trivial task, so it cannot complete a review), but a probe that
// merely times out is not — a slow engine is still a working engine, and
// refusing on that basis would turn the safety net into a new failure mode.
const PROBE_TOKEN = 'ORCHESTRA_PROBE_OK';
function runAuthProbe(dir) {
  const outFile = path.join(SCRATCH.dir, 'probe.txt');
  // The probe runs under the SAME sandbox the review will use, on purpose: a
  // sandbox setting the engine cannot start under is exactly the kind of
  // failure this check should surface, and a probe that passed under different
  // conditions from the review would be answering a different question.
  const args = ['exec', '--sandbox', CONFIG.sandbox, '--cd', dir, '--output-last-message', outFile];
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
    env: childEnv(),
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
  // A launch that never happened is not an engine that failed a task, and
  // saying "it failed an echo" for an EINVAL/EACCES would send the reader
  // looking at their auth instead of at their install.
  if (r.error) {
    return {
      ok: false,
      reason: 'the Codex CLI could not be launched (' + (r.error.code || 'spawn error') + ')',
      detail:
        'Launching ' + (CONFIG.resolvedBin || CONFIG.bin) + ' failed before any review was ' +
        'attempted:\n  ' + String(r.error.message || r.error) + '\n' +
        'This is the executable or the platform refusing the launch — not authentication, ' +
        'and not the model. Check that the path is the real executable (a .cmd/.bat shim is ' +
        'handled, a directory or a broken link is not) and that it is runnable by this user.',
    };
  }
  if (r.status !== 0 || !said) {
    const cls = classifyExit(r, elapsed);
    return {
      ok: false,
      reason: 'the Codex engine failed a trivial echo before the review was attempted',
      detail:
        'A ' + CONFIG.probeTimeoutMs + 'ms stage-a probe asked codex to echo one token and ' +
        'it did not.\n' +
        '  outcome:   ' + (cls.kind === 'ok' ? 'exited 0 but produced no output' : cls.headline) + '\n' +
        '  elapsed:   ' + ms(elapsed) + '\n' +
        '  model:     ' + (CONFIG.model || 'codex default') + '\n' +
        '  stderr:\n' + (indent(tail(r.stderr || '', 20), '    ') || '    (nothing)') + '\n' +
        'Most often this is authentication (set OPENAI_API_KEY or run `codex login`), a ' +
        'model id this account cannot use, or an install a self-update broke. The review ' +
        'was NOT attempted, so no review budget was spent finding this out. Disable the ' +
        'probe with "codex": { "authProbe": false } or ORCHESTRA_REVIEW_PROBE=0 if it is ' +
        'wrong about your setup.',
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
// Resolved review tier, stamped into the header so every verdict is auditable
// for the depth it was requested at. Set once in main(); 'full' before that
// so early-failure paths still print a truthful header.
let RESOLVED_TIER = 'full';
// Preflight notes (bin resolution, helper restore) — surfaced in the header so
// a silently-repaired install is visible rather than mysterious.
const PREFLIGHT = [];
// Every attempt this run made, in order. The chain is reported as ONE outcome:
// a retry is an implementation detail of "the review ran", not a second review.
const ATTEMPTS = [];

// The settings a run actually applied — the audit trail, identical on both the
// success and the failure path, because a failed run's settings are exactly
// what you need to see in order to fix it.
function settingsBits() {
  const bits = [
    'model: ' + (CONFIG.model || 'codex default'),
    'sandbox: ' + CONFIG.sandbox,
    'tier: ' + RESOLVED_TIER,
    'timeout: ' + CONFIG.timeoutMs + 'ms (' + CONFIG.timeoutSource + ')',
    // The launcher needs to know the retry policy to know that it has none:
    // attempts are the runner's business, and this line says how many it may
    // spend before the outcome it reports is final.
    'attempts: up to ' + (1 + Math.max(0, CONFIG.retries)),
  ];
  if (CONFIG.forbidden.length) bits.push('prohibited commands: ' + CONFIG.forbidden.length);
  if (CONFIG.reviewDirLabel) bits.push('checkout: ' + CONFIG.reviewDirLabel);
  return bits;
}

// FIX: the launcher retried by hand, and the Director received two reports for
// one review — a final-sounding REVIEW_UNAVAILABLE, then, later, a real verdict
// for the same change. Retries are the runner's business now, and the header
// states the whole chain in one line so a relayed report can never read as a
// second, separate review.
function attemptChainLine() {
  if (ATTEMPTS.length < 2) return '';
  const parts = ATTEMPTS.map((a) =>
    'attempt ' + a.n + ': ' + (a.body ? 'produced this verdict' : a.class.headline)
  );
  return (
    '\nATTEMPT CHAIN: ' + ATTEMPTS.length + ' attempts, ONE outcome — ' + parts.join('; ') +
    '. (This is a single review. Do not report it as more than one.)'
  );
}

function headerTail() {
  let out = '';
  if (CONFIG.resolvedBin && CONFIG.resolvedBin !== CONFIG.bin) {
    out += '\nCODEX BINARY: ' + CONFIG.resolvedBin;
  }
  for (const note of PREFLIGHT) out += '\nPREFLIGHT: ' + note;
  out += attemptChainLine();
  return out;
}

// Only ever printed above a verdict an OpenAI model actually produced.
function engineHeader() {
  return 'REVIEW ENGINE: OpenAI via Codex CLI (' + settingsBits().join(', ') + ')' + headerTail();
}

// FIX: this header used to be the SAME line — a REVIEW_UNAVAILABLE block sat
// under "REVIEW ENGINE: OpenAI via Codex CLI", and launchers relaying it read
// the header as provenance and reported a fallback verdict as the cross-vendor
// one. A header is an attribution, and attributing a review to an engine that
// produced nothing is the single most expensive lie this runner can tell: it
// converts "no review happened" into "OpenAI approved it". So the failure path
// names no engine at all. The settings still print — under ATTEMPTED, where
// they are diagnostics rather than a byline.
function unavailableHeader() {
  return (
    'REVIEW ENGINE: NONE — no cross-vendor review was produced.\n' +
    'ATTEMPTED: OpenAI via Codex CLI (' + settingsBits().join(', ') + ')' +
    headerTail()
  );
}

// The diagnostics of every attempt that failed, kept even when a later attempt
// succeeded: "it worked on the retry" is a fact about the lane's reliability
// that the next person debugging it needs, and dropping it is how a flaky
// engine looks healthy.
function attemptLog() {
  const failed = ATTEMPTS.filter((a) => !a.body);
  if (!failed.length) return '';
  return (
    '\n\n--- ATTEMPT LOG (diagnostics for the attempt(s) that produced nothing) ---\n' +
    failed.map(attemptDiagnostics).join('\n\n')
  );
}

function printReview(body) {
  process.stdout.write(
    engineHeader() + '\n\n' + body.replace(/\s+$/, '') + attemptLog() + '\n'
  );
}

function printUnavailable(reason, detail) {
  const tried = ATTEMPTS.length;
  const block = [
    'VERDICT: REVIEW_UNAVAILABLE',
    '',
    'REASON',
    '- ' + reason,
    '',
    'DETAIL',
    detail ? detail.split('\n').map((l) => '  ' + l).join('\n') : '  (none)',
    '',
    // FIX: a REVIEW_UNAVAILABLE that a launcher then retried into a real
    // verdict produced two "final" reports for one review, and the books were
    // closed on the lane in between. The runner owns retries now, so this block
    // is only ever printed when the chain is exhausted — and says so, in the
    // report, where the reader is.
    'FINALITY: this runner made ' + (tried || 'no') + ' engine attempt' +
      (tried === 1 ? '' : 's') + ' and will make no more. This is the ONE, FINAL',
    'outcome of this review; there is no later verdict coming from this run.',
    '',
    'The cross-vendor reviewer did not run, and nothing below this line came',
    'from an OpenAI model. Do NOT treat this change as reviewed, and do not',
    'attribute any later verdict to the cross-vendor engine on the strength of',
    'this report. The Director routes this review to the default Opus reviewer',
    'and notes the cross-vendor pass did not run (retry once conditions are',
    'fixed, if the user wants the cross-vendor opinion).',
  ].join('\n');
  process.stdout.write(unavailableHeader() + '\n\n' + block + attemptLog() + '\n');
}

// ------------------------------------------------------------------ main
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: node orchestra-review.js --work-order <file> --executor-report <file>\n' +
        '         [--tier full|inert] [--timeout-ms <n>] [--no-tests] [--forbid <cmd>]...\n' +
        '         [--base-ref <ref>] [--head-ref <ref>] [--worktree-root <dir>]\n' +
        '         [--retries <n>|--no-retry] [--no-probe] [--warmup-cmd <cmd>]\n' +
        '       node orchestra-review.js --doctor [--live]\n' +
        '\n' +
        '  --doctor checks the local Codex install the way a review does — real\n' +
        '  binary, install layout, the helper files that must sit BESIDE it —\n' +
        '  repairs what it can, and prints the exact command for what it cannot.\n' +
        '  It also names stale-session hazards: resume-prone tokens in\n' +
        '  ORCHESTRA_EXEC_ARGS / ORCHESTRA_REVIEW_ARGS, resume-prone lines in\n' +
        '  the Codex config, and leftover session artifacts. Exit 0 means a\n' +
        '  review would find a complete, hazard-free install. It reviews\n' +
        '  nothing and needs no work order.\n' +
        '\n' +
        '  --live (with --doctor) additionally runs a real no-op order through\n' +
        '  the sibling exec runner in a scratch directory (read-only sandbox)\n' +
        '  and verifies the report-integrity token round-trip — one model call.\n' +
        '\n' +
        '  --head-ref pins the review to a commit: the runner checks it out in a\n' +
        '  throwaway worktree outside the repo and reviews THAT, so the session\'s\n' +
        '  uncommitted files never enter the engine\'s view. Use it whenever the\n' +
        '  change under review is committed.\n' +
        '\n' +
        '  Retries are the RUNNER\'s job (default: 1 extra attempt, in a fresh\n' +
        '  checkout, only for failures that could plausibly differ next time).\n' +
        '  The whole chain reports as one outcome, and REVIEW_UNAVAILABLE is\n' +
        '  printed only when it is exhausted — so a launcher must never relaunch\n' +
        '  this runner to "try again".\n'
    );
    return;
  }

  // --- settings: project config, then env (already seeded), then flags.
  const projectCfg = loadProjectConfig(CONFIG.projectDir);
  const codexCfg =
    projectCfg.codex && typeof projectCfg.codex === 'object' && !Array.isArray(projectCfg.codex)
      ? projectCfg.codex
      : {};

  if (!process.env.ORCHESTRA_REVIEW_MODEL && typeof codexCfg.reviewModel === 'string') {
    CONFIG.model = codexCfg.reviewModel.trim();
  }
  if (!process.env.ORCHESTRA_REVIEW_SANDBOX && typeof codexCfg.reviewSandbox === 'string') {
    CONFIG.sandbox = codexCfg.reviewSandbox.trim();
  }
  if (!process.env.ORCHESTRA_REVIEW_TIMEOUT_MS && codexCfg.reviewTimeoutMs != null) {
    const t = intOr(codexCfg.reviewTimeoutMs, 0);
    if (t > 0) {
      CONFIG.timeoutMs = t;
      CONFIG.timeoutSource = 'orchestra.json';
    }
  }
  if (!process.env.ORCHESTRA_REVIEW_IDLE_MS && codexCfg.idleMs != null) {
    CONFIG.idleMs = intOr(codexCfg.idleMs, CONFIG.idleMs);
  }
  if (!process.env.ORCHESTRA_CODEX_HELPERS && typeof codexCfg.helpersDir === 'string') {
    CONFIG.helpersDir = codexCfg.helpersDir.trim();
  }
  if (!process.env.ORCHESTRA_REVIEW_WORKTREE_ROOT && typeof codexCfg.worktreeRoot === 'string') {
    if (codexCfg.worktreeRoot.trim()) {
      CONFIG.worktreeRoot = codexCfg.worktreeRoot.trim();
      CONFIG.worktreeRootSource = 'orchestra.json';
    }
  }
  if (!process.env.ORCHESTRA_REVIEW_GIT_ISOLATION && codexCfg.gitConfigIsolation != null) {
    CONFIG.gitIsolation = codexCfg.gitConfigIsolation !== false;
  }
  if (!process.env.ORCHESTRA_REVIEW_RETRIES && codexCfg.reviewRetries != null) {
    CONFIG.retries = Math.min(MAX_RETRIES, intOr(codexCfg.reviewRetries, CONFIG.retries));
  }
  if (!process.env.ORCHESTRA_REVIEW_PROBE && codexCfg.authProbe != null) {
    CONFIG.probe = codexCfg.authProbe !== false;
  }
  if (!process.env.ORCHESTRA_REVIEW_PROBE_TIMEOUT_MS && codexCfg.probeTimeoutMs != null) {
    CONFIG.probeTimeoutMs = intOr(codexCfg.probeTimeoutMs, CONFIG.probeTimeoutMs);
  }
  if (!process.env.ORCHESTRA_REVIEW_WARMUP_CMD && typeof codexCfg.worktreeWarmupCmd === 'string') {
    CONFIG.warmupCmd = codexCfg.worktreeWarmupCmd.trim();
  }
  if (
    !process.env.ORCHESTRA_REVIEW_WARMUP_TIMEOUT_MS &&
    codexCfg.worktreeWarmupTimeoutMs != null
  ) {
    CONFIG.warmupTimeoutMs = intOr(codexCfg.worktreeWarmupTimeoutMs, CONFIG.warmupTimeoutMs);
  }
  if (codexCfg.integrityIgnoreDefaults === false) CONFIG.integrityIgnoreDefaults = false;
  CONFIG.integrityIgnore = (CONFIG.integrityIgnoreDefaults ? DEFAULT_INTEGRITY_IGNORE : [])
    .concat(stringList(codexCfg.integrityIgnore).map((s) => s.trim()));
  if (
    process.env.ORCHESTRA_CODEX_HELPER_SIBLINGS == null &&
    Array.isArray(codexCfg.helperSiblings)
  ) {
    CONFIG.helperSiblings = stringList(codexCfg.helperSiblings).map((s) => s.trim());
  }
  if (codexCfg.requireHelperSiblings === true) CONFIG.requireHelperSiblings = true;

  // FIX: the timeout has to be a VALUE, not a sentence in a work order. The
  // launcher passes --timeout-ms; the header reports which layer supplied the
  // cap that was actually applied, so a prose-only instruction is visibly
  // ignored rather than silently so.
  if (args.timeoutMs != null) {
    const t = intOr(args.timeoutMs, 0);
    if (t > 0) {
      CONFIG.timeoutMs = t;
      CONFIG.timeoutSource = 'flag';
    }
  }
  if (args.worktreeRoot && args.worktreeRoot.trim()) {
    CONFIG.worktreeRoot = args.worktreeRoot.trim();
    CONFIG.worktreeRootSource = 'flag';
  }
  if (args.retries != null) CONFIG.retries = Math.min(MAX_RETRIES, intOr(args.retries, CONFIG.retries));
  if (args.noProbe) CONFIG.probe = false;
  if (args.warmupCmd && args.warmupCmd.trim()) CONFIG.warmupCmd = args.warmupCmd.trim();
  CONFIG.baseRef = (args.baseRef || '').trim();
  CONFIG.headRef = (args.headRef || '').trim();

  // Prohibitions: project config + explicit flags, deduped.
  const forbidden = [];
  for (const f of stringList(codexCfg.doNotRun)) forbidden.push(f.trim());
  for (const f of args.forbid) if (f && f.trim()) forbidden.push(f.trim());
  if (args.noTests) {
    forbidden.push(
      'the test suite, the build, and anything that launches the application ' +
        '(including engine/editor/binary launches and headless runs)'
    );
  }
  CONFIG.forbidden = forbidden.filter((f, i) => forbidden.indexOf(f) === i);

  // Anything other than an explicit, exact 'inert' reviews at full depth —
  // the safe direction for a typo'd or invented tier value.
  RESOLVED_TIER = (args.tier || '').trim().toLowerCase() === 'inert' ? 'inert' : 'full';

  // FIX: "it's only docs, it'll take seconds" is a reasonable-sounding belief
  // that is simply false about this engine. It explores the repository before
  // it concludes anything, and that pass costs minutes regardless of how small
  // the diff is; the inert tier narrows what must be VERIFIED, not how long
  // looking takes. A launcher that translates "inert" into a short cap
  // therefore guarantees a timeout — which is exactly how a 9-line docs review
  // burned a whole round at 300000ms.
  //
  // So a short cap on an inert review is raised, not obeyed — but only when it
  // came from the launcher's flag or the built-in default. A cap the USER set
  // (env, or orchestra.json) is their call and is left exactly as written; it
  // just gets said out loud. Either way the header shows what happened, so the
  // adjustment is auditable rather than magic.
  if (RESOLVED_TIER === 'inert' && CONFIG.timeoutMs < INERT_FLOOR_MS) {
    const wasFrom = CONFIG.timeoutSource;
    const wasMs = CONFIG.timeoutMs;
    if (wasFrom === 'flag' || wasFrom === 'default') {
      CONFIG.timeoutMs = INERT_FLOOR_MS;
      CONFIG.timeoutSource = wasFrom + ' ' + wasMs + 'ms → raised to the ' +
        INERT_FLOOR_MS + 'ms inert floor';
    } else {
      CONFIG.timeoutSource = wasFrom + ', below the ' + INERT_FLOOR_MS +
        'ms inert floor — expect a timeout';
    }
  }

  // The doctor runs AFTER project config and env are folded in, so it checks
  // the install with exactly the settings a review would use — a helperSiblings
  // list the project overrode is the list the doctor verifies.
  if (args.doctor) {
    runDoctor(args.live);
    return;
  }

  const workOrder = readFileOr(args.workOrder, '');
  const executorReport = readFileOr(args.executorReport, '');
  if (!workOrder.trim() && !executorReport.trim()) {
    printUnavailable(
      'no review input',
      'Neither --work-order nor --executor-report contained any text. The ' +
        'launcher must pass the Director\'s work order and the executor\'s report.'
    );
    return;
  }

  // --- preflight: resolve the real binary, then repair the install.
  const install = inspectCodexInstall();
  for (const line of install.lines) PREFLIGHT.push(line);
  if (install.missing.length) {
    if (CONFIG.requireHelperSiblings) {
      printUnavailable('the Codex install is missing required helper files', install.detail);
      return;
    }
    PREFLIGHT.push(
      install.detail +
        ' Proceeding anyway — whether this layout needs them is unverified upstream; set ' +
        '"requireHelperSiblings": true to make it a hard stop.'
    );
  }

  // A configured scratch root is validated BEFORE anything is created in it.
  // The post-creation check further down is the backstop for the roots we pick
  // ourselves; this one exists because "a review must not write into the tree
  // it is reviewing" is broken by the `mkdir` itself, not only by the worktree
  // that lands in it — the old order created `<repo>/scratch/…`, refused, and
  // left the directory behind as exactly the session dirt it was objecting to.
  // The cost is one git call outside the isolated config, whose stderr is
  // discarded here and never reaches the engine.
  if (CONFIG.worktreeRoot) {
    const earlyTop = gitOut(['-C', CONFIG.projectDir, 'rev-parse', '--show-toplevel']);
    if (scratchIsInsideRepo(earlyTop, CONFIG.worktreeRoot)) {
      printUnavailable(
        'scratch directory is inside the repository',
        CONFIG.worktreeRoot + ' is under ' + earlyTop + ' (' + CONFIG.worktreeRootSource +
          '). The review\'s scratch directory must live outside the repository — inside ' +
          'it, the review writes into the tree it is reviewing. Nothing was created. ' +
          'Point --worktree-root (or ORCHESTRA_REVIEW_WORKTREE_ROOT, or "codex": ' +
          '{ "worktreeRoot": "<dir>" }) somewhere outside the project.'
      );
      return;
    }
  }

  // --- scratch: one directory per run, outside the repo, holding the verdict
  // file, the isolated git config, and (pinned mode) the review worktree.
  // Created before anything else runs git, because the isolation has to be in
  // place for the FIRST git call, not the second.
  const scratch = makeScratchDir(CONFIG.worktreeRoot, CONFIG.worktreeRootSource);
  if (!scratch.dir) {
    printUnavailable(
      'no writable scratch directory',
      scratch.error + '\nSet a writable directory with --worktree-root, ' +
        'ORCHESTRA_REVIEW_WORKTREE_ROOT, or "codex": { "worktreeRoot": "<dir>" } in ' +
        '.claude/orchestra.json. It must be OUTSIDE the repository — a review must ' +
        'not write into the tree it is reviewing.'
    );
    return;
  }
  SCRATCH.dir = scratch.dir;
  armTeardown();
  // Owner stamp: lets a later run tell an abandoned scratch directory (its
  // owner is gone) from one a concurrent review is still using.
  try {
    fs.writeFileSync(path.join(SCRATCH.dir, 'owner.pid'), String(process.pid), 'utf8');
  } catch (_) {
    /* the sweep treats an unstamped directory as abandoned, which is correct */
  }
  if (scratch.note) PREFLIGHT.push(scratch.note);
  setupGitIsolation();

  const repoTop = gitOut(['-C', CONFIG.projectDir, 'rev-parse', '--show-toplevel']);

  // "Outside the repository" is the whole guarantee, so check it rather than
  // document it — a worktreeRoot pointed inside the repo would put the review's
  // own scratch files into the tree under review, which is precisely the
  // condition pinned mode exists to eliminate.
  if (repoTop) {
    if (scratchIsInsideRepo(repoTop, SCRATCH.dir)) {
      printUnavailable(
        'scratch directory is inside the repository',
        SCRATCH.dir + ' is under ' + repoTop + '. The review\'s scratch directory must ' +
          'live outside the repository — inside it, the review writes into the tree it ' +
          'is reviewing. Point --worktree-root (or ORCHESTRA_REVIEW_WORKTREE_ROOT, or ' +
          '"codex": { "worktreeRoot": "<dir>" }) somewhere outside the project.'
      );
      return;
    }
  }

  const sweep = sweepStaleScratch(path.dirname(SCRATCH.dir), repoTop);
  if (sweep.reclaimed) {
    PREFLIGHT.push(
      'reclaimed ' + sweep.reclaimed + ' abandoned review worktree(s) from a prior run' +
        (sweep.stuck.length
          ? ' — git\'s records are clean, but ' + sweep.stuck.length + ' directory(ies) could ' +
            'not be deleted (a process from the earlier run is probably still holding them; ' +
            'they are harmless leftovers): ' + sweep.stuck.join(', ')
          : '')
    );
  }

  // --- the brief is identical for every attempt: same intent, same claim, same
  // rules. A retry that changed the brief would be a different review wearing
  // the same report.
  const brief = buildBrief(
    workOrder,
    executorReport,
    RESOLVED_TIER,
    loadVerification(projectCfg),
    CONFIG.forbidden,
    { baseRef: CONFIG.baseRef, headRef: CONFIG.headRef, pinned: !!CONFIG.headRef }
  );

  // --- stage-a probe: can this install run codex at all? Cheap, and it runs
  // before any worktree is materialized, so a broken engine costs seconds
  // rather than the review budget. (Runs once for the whole chain — a retry
  // does not re-probe: the answer cannot have changed.)
  if (CONFIG.probe) {
    const probe = runAuthProbe(CONFIG.projectDir);
    if (!probe.ok) {
      printUnavailable(probe.reason, probe.detail);
      return;
    }
    if (probe.note) PREFLIGHT.push(probe.note);
    if (probe.warn) PREFLIGHT.push(probe.warn);
  }

  // --- ONE attempt: its own scratch directory, its own checkout, its own
  // engine run. Returns either a body (the verdict), a classification of why
  // there is none, or a `fatal` — a setup failure no retry can fix.
  function runAttempt(n, of) {
    const attemptDir = makeAttemptDir(n);
    const att = { n, of, reviewDir: CONFIG.projectDir, reviewDirLabel: 'live working tree' };

    // Which tree does the engine read? A retry gets a BRAND-NEW checkout, not
    // the previous attempt's: whatever a half-dead engine left behind in there
    // is exactly what a retry must not inherit.
    if (CONFIG.headRef) {
      if (!repoTop) {
        att.fatal = {
          reason: 'cannot pin the review to ' + CONFIG.headRef,
          detail:
            CONFIG.projectDir + ' is not inside a git repository (or git is unavailable), ' +
            'so there is no commit to check out. Drop --head-ref to review the working ' +
            'tree as-is.',
        };
        return att;
      }
      const wt = createPinnedWorktree(repoTop, CONFIG.headRef, attemptDir);
      if (wt.error) {
        att.fatal = { reason: 'cannot pin the review to ' + CONFIG.headRef, detail: wt.error };
        return att;
      }
      // Keep the engine at the same position within the repo the caller was in,
      // so relative paths in the work order still mean what they meant.
      const rel = path.relative(realOrSelf(repoTop), realOrSelf(CONFIG.projectDir));
      const target = rel && !rel.startsWith('..') ? path.join(wt.dir, rel) : wt.dir;
      att.reviewDir = fs.existsSync(target) ? target : wt.dir;
      att.reviewDirLabel = 'pinned worktree @ ' + wt.sha.slice(0, 12);
      PREFLIGHT.push(
        (n === 1 ? 'pinned review: checked out ' : 'attempt ' + n + ': re-checked out ') +
          wt.sha.slice(0, 12) + ' into a throwaway worktree (' + att.reviewDir +
          '); the session\'s uncommitted files are not visible to the engine'
      );
    }
    CONFIG.reviewDir = att.reviewDir;
    CONFIG.reviewDirLabel = att.reviewDirLabel;

    // Warmup BEFORE the baseline. An engine that imports assets on first open
    // rewrites hundreds of generated files; taking the baseline first turns all
    // of them into evidence that the reviewer mutated the tree.
    //
    // PINNED MODE ONLY, and not as a limitation: the warmup exists because a
    // FRESH CHECKOUT lacks the generated artifacts a long-lived tree already
    // has. Running it in LIVE mode would mean the review process writing into
    // the user's actual working tree — an engine import is not a read — which
    // is precisely what a review must never do.
    if (CONFIG.warmupCmd && !CONFIG.headRef) {
      PREFLIGHT.push(
        'warmup command NOT run: this is a live-tree review, and the warmup only runs in a ' +
          'throwaway pinned checkout (it writes, and a review must not write into the tree ' +
          'it is reviewing). Pass --head-ref to get it.'
      );
    } else {
      const warm = runWarmup(att.reviewDir);
      if (warm) PREFLIGHT.push((n > 1 ? 'attempt ' + n + ': ' : '') + warm.note);
    }

    // Is anything else still writing the tree? A review of a tree in motion
    // reports on a state that no longer exists. Pinned mode cannot have this
    // problem — the worktree is a fresh checkout of an immutable commit — so
    // the check (and its settle delay) is skipped there.
    const before = treeFingerprint(att.reviewDir);
    if (!CONFIG.headRef && CONFIG.idleMs > 0 && before !== null) {
      sleepSync(CONFIG.idleMs);
      const settled = treeFingerprint(att.reviewDir);
      if (settled !== null && settled.text !== before.text) {
        att.fatal = {
          reason: 'working tree is not idle',
          detail:
            'The tree changed during a ' + CONFIG.idleMs + 'ms settle window, so something ' +
            'else is still writing it (a running executor, a build, a watch task). A ' +
            'review of a moving tree reports on a state that no longer exists.\n' +
            'Wait for the other work to finish and re-run this review. If the change is ' +
            'already committed, pass --head-ref <sha> instead: the review then runs in a ' +
            'clean checkout of that commit and the live tree cannot affect it.\n' +
            'To disable the check, set ORCHESTRA_REVIEW_IDLE_MS=0 (or "codex": ' +
            '{ "idleMs": 0 } in .claude/orchestra.json).\n' +
            'git status delta:\n--- first sample ---\n' + before.text.trim() +
            '\n--- second sample ---\n' + settled.text.trim(),
        };
        return att;
      }
    }

    // Where Codex writes its final message. Read this rather than parsing the
    // streamed session on stdout.
    const lastMsgFile = path.join(attemptDir, 'verdict.txt');
    const codexArgs = ['exec', '--sandbox', CONFIG.sandbox, '--cd', att.reviewDir];
    if (CONFIG.model) codexArgs.push('--model', CONFIG.model);
    codexArgs.push('--output-last-message', lastMsgFile);
    if (CONFIG.extraArgs) codexArgs.push(...CONFIG.extraArgs.split(/\s+/).filter(Boolean));
    codexArgs.push('-'); // read the prompt from stdin

    const startedAt = Date.now();
    const run = spawnEngine(CONFIG.resolvedBin || CONFIG.bin, codexArgs, {
      cwd: att.reviewDir,
      input: brief,
      encoding: 'utf8',
      timeout: CONFIG.timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      // The engine runs far more git than this runner does, so the isolated
      // config has to reach IT, not just us — otherwise every command it issues
      // still warns about a global config path the sandbox cannot read.
      env: childEnv(),
    });
    const elapsed = Date.now() - startedAt;

    att.elapsed = elapsed;
    att.stderr = run.stderr || '';
    att.stdout = run.stdout || '';
    att.class = classifyExit(run, elapsed);

    // Prefer the clean final-message file; fall back to stdout if the flag was
    // a no-op on this version. A body is a verdict even when the exit status
    // was non-zero — the engine's output is the product, not its exit code.
    const verdict = readFileOr(lastMsgFile, '').trim();
    att.body = verdict || (att.class.kind === 'ok' ? tail(att.stdout, 400).trim() : '');
    if (att.body && att.class.kind !== 'ok') {
      // The engine's output is the product; a bad exit status after it has
      // already written a verdict is worth recording, not worth discarding a
      // real review over.
      PREFLIGHT.push(
        'attempt ' + n + ': ' + att.class.headline + ', but a verdict had already been ' +
          'written — using it (' + att.class.ran + ')'
      );
    }
    if (!att.body && att.class.kind === 'ok') {
      // Exited cleanly and said nothing: nothing to report and nothing to
      // explain, which is precisely the shape a retry sometimes fixes.
      att.class = {
        kind: 'empty',
        headline: 'codex exited 0 but produced no output',
        killedBy: 'nobody — codex exited cleanly, having written no final message',
        ran: att.class.ran,
        retryable: true,
      };
    }

    // Only a failed attempt needs the engine's own session record, and finding
    // it means walking the Codex home — not work a healthy review should pay
    // for.
    if (!att.body) att.sessionLogs = recentSessionLogs(startedAt - 1000, 1);

    // Integrity: did the reviewer, which is read-only in intent, change the
    // tree it was reading? Compare per PATH so engine churn can be told from
    // the thing this check exists to catch.
    if (att.body && before !== null) {
      const after = treeFingerprint(att.reviewDir);
      if (after !== null) att.integrity = fingerprintDelta(before, after, CONFIG.integrityIgnore);
    }
    return att;
  }

  const maxAttempts = 1 + Math.max(0, CONFIG.retries);
  let outcome = null;
  for (let n = 1; n <= maxAttempts; n++) {
    const att = runAttempt(n, maxAttempts);
    // A setup failure is not an engine attempt: it never reached codex, no
    // retry changes it, and it must not be counted in the chain.
    if (att.fatal) {
      printUnavailable(att.fatal.reason, att.fatal.detail);
      return;
    }
    ATTEMPTS.push(att);
    outcome = att;
    if (att.body) break;
    if (!att.class.retryable) break;
    if (n === maxAttempts) break;
    // The retry is announced where the reader will see it, so "it worked the
    // second time" is never mistaken for "it worked".
    PREFLIGHT.push(
      'attempt ' + n + ' produced no verdict (' + att.class.headline + ') — retrying once in ' +
        'a fresh scratch directory; this remains ONE review with ONE outcome'
    );
  }

  if (!outcome || !outcome.body) {
    // The chain is exhausted. Only NOW may a REVIEW_UNAVAILABLE be printed:
    // emitting one while an attempt is still possible is what handed a Director
    // two "final" reports for a single review.
    const last = outcome ? outcome.class : null;
    printUnavailable(
      last ? last.headline : 'the review engine produced nothing',
      'No attempt produced a verdict. Per-attempt attribution — who killed the engine, how ' +
        'long it ran against its cap, and what it last wrote — is in the ATTEMPT LOG below.' +
        (last && last.kind === 'runner-timeout' && CONFIG.retries > 0
          ? '\nThis failure was NOT retried: the runner\'s own timer ended it, and a second ' +
            'full-length timeout costs the same clock to learn the same thing.'
          : '') +
        (last && last.kind === 'not-found'
          ? '\nInstall the Codex CLI and put it on PATH, or set CODEX_BIN to its path. ' +
            'See https://developers.openai.com/codex/'
          : '')
    );
    return;
  }

  // Safety net the raw-prompt trust model lacks: did the "read-only in intent"
  // reviewer actually leave the tree alone? Report drift loudly; do not
  // auto-revert (that could clobber the executor's real change). In pinned mode
  // the drift is confined to a throwaway worktree — the project is untouched by
  // construction — but a reviewer that writes is still a reviewer that writes,
  // and the Director should hear about it.
  //
  // FIX: the check used to compare whole fingerprints, so a Godot project's
  // first import inside a fresh worktree — 180+ `*.import` sidecars rewritten
  // by the ENGINE, before the reviewer had done anything — raised the same
  // alarm as a reviewer editing source, and dumped both fingerprints into the
  // verdict. A warning that fires on every first run of a whole class of
  // project is a warning nobody reads.
  let body = outcome.body;
  if (outcome.integrity) {
    const { suspect, expected } = outcome.integrity;
    if (suspect.length) {
      const shown = suspect.slice(0, 40);
      body +=
        '\n\n⚠ INTEGRITY WARNING: the ' +
        (CONFIG.headRef ? 'pinned review worktree' : 'working tree') +
        ' changed while the reviewer ran, in ' + suspect.length + ' path(s) that are NOT ' +
        'expected build/engine churn. The reviewer is supposed to be read-only;' +
        (CONFIG.headRef
          ? ' the project itself was not exposed to this (the review ran in a throwaway ' +
            'checkout, now removed), but treat findings that depend on tree state with ' +
            'suspicion, and'
          : ' inspect the tree before trusting it, and') +
        ' consider ORCHESTRA_REVIEW_SANDBOX=read-only.\n' +
        'Changed paths (' + shown.length + ' of ' + suspect.length + '):\n' +
        shown.map((c) => '  ' + c.how + ': ' + c.path).join('\n') +
        (suspect.length > shown.length ? '\n  …and ' + (suspect.length - shown.length) + ' more' : '') +
        (expected.length
          ? '\n' + expected.length + ' further changed path(s) matched the expected-churn ' +
            'allowlist and are not counted above.'
          : '');
    } else if (expected.length) {
      body +=
        '\n\nINTEGRITY NOTE: ' + expected.length + ' path(s) changed while the reviewer ran, ' +
        'all of them matching the expected build/engine-churn allowlist (' +
        expected.slice(0, 6).map((c) => c.path).join(', ') +
        (expected.length > 6 ? ', …' : '') +
        ') — generated artifacts, not source. Not flagged as a reviewer mutation. Tune with ' +
        '"codex": { "integrityIgnore": [...] } / "integrityIgnoreDefaults": false.';
    }
  }

  printReview(body);
}

try {
  main();
} catch (e) {
  // Never throw an unhandled error back at the launcher — that would look like
  // a crash rather than a review. Degrade to REVIEW_UNAVAILABLE.
  try {
    printUnavailable('review runner error', String((e && e.stack) || e));
  } catch (_) {
    process.stdout.write('VERDICT: REVIEW_UNAVAILABLE\n');
  }
} finally {
  // Belt to the `exit` handler's braces. A worktree left registered in
  // .git/worktrees is a leak the user has to clear by hand, so the cleanup runs
  // on the normal path, the thrown path, and the signalled path alike — and is
  // idempotent, so running it three times costs nothing.
  teardownScratch();
}
