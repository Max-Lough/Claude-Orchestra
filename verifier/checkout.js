#!/usr/bin/env node
/**
 * WO-5 disposable-checkout substrate — the writable sandbox every mandatory
 * Verifier check runs inside (final-plan.md catalog entry 23, "The writable
 * checkout, and why").
 *
 * Half the mandatory checks WRITE: builds populate caches, test runners write
 * fixtures, the mutation check inverts an assertion, the invariant comparison
 * applies a change to a copy. The reference lane (`orchestra-review.js`)
 * already made this trade — many suites simply cannot run read-only. Writes
 * are bounded four ways, and this module implements all four:
 *
 *   1. Confined to a throwaway checkout of the commit under examination,
 *      created OUTSIDE the repository (os tmpdir; creation refuses a path
 *      under the repo's toplevel).
 *   2. No write path to the source of truth: the checkout is a detached
 *      `git worktree` — nothing in it is ever committed, merged, or pushed.
 *   3. Before/after fingerprint with generated-artifact classification, so
 *      "the suite wrote a cache" (expected churn, an INTEGRITY NOTE) and
 *      "something edited a source file" (suspect, an INTEGRITY WARNING) are
 *      distinguishable.
 *   4. Authority unchanged: a mutation performed here is an experiment, never
 *      a proposed change. The dispatcher fingerprints the REAL tree across
 *      the Verifier's own run (`guardTree`), so a write-scope escape is
 *      caught by the same mechanism the substrate applies to everyone else.
 *
 * Teardown is guaranteed: explicit `teardown()` is idempotent, and a process
 * exit handler sweeps anything still registered — a crashed check may leave a
 * red result, never a stray writable copy of the tree.
 *
 * Same conventions as the rest of the repo: no dependencies, plain node,
 * plain git.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Churn a verification run is EXPECTED to produce. Callers add their
// project-declared patterns on top; the split is the whole point — an
// integrity warning that fires on every cache write teaches the reader to
// ignore integrity warnings (the reference lane learned this on 180
// asset-import sidecars).
const DEFAULT_GENERATED_PATTERNS = [
  'node_modules/**',
  '.test-cache/**',
  'coverage/**',
  'dist/**',
  'build/**',
  '.cache/**',
  'tmp/**',
  '__pycache__/**',
  '**/*.log',
  '*.log',
];

function runGit(args, opts) {
  return spawnSync('git', args, Object.assign({ encoding: 'utf8', windowsHide: true }, opts || {}));
}

// ---------------------------------------------------------------- patterns

// Minimal glob matcher for the classification patterns: `**` crosses path
// separators, `*` does not; paths are normalized to forward slashes first.
//
// NOT a regex. The first ReDoS fix collapsed only ADJACENT star runs; the
// R0-EX3 re-review detonated the compiled regex with SEPARATED runs
// (`**a**a**a…` — 5.4 s on 32 characters), because stacked `.*` groups
// backtrack combinatorially no matter how each run is collapsed. Patterns
// are token-compiled once (cached) and matched with a small dynamic program
// over tokens × characters — strictly O(pattern × path), no backtracking to
// detonate, whatever an agent-editable pattern source someday feeds it.
const GLOB_CACHE = new Map();
function compileGlob(pattern) {
  const norm = String(pattern).replace(/\\/g, '/');
  let tokens = GLOB_CACHE.get(norm);
  if (tokens) return tokens;
  tokens = [];
  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === '*') {
      let stars = 1;
      while (norm[i + 1] === '*') { stars++; i++; }
      if (stars >= 2) {
        if (norm[i + 1] === '/') i++; // `**/` also matches zero directories
        if (tokens[tokens.length - 1] !== 'globstar') tokens.push('globstar');
      } else if (tokens[tokens.length - 1] !== 'star') {
        tokens.push('star');
      }
    } else {
      tokens.push(norm[i]); // literal character (one-char tokens)
    }
  }
  GLOB_CACHE.set(norm, tokens);
  return tokens;
}

// dp[j] = "the tokens consumed so far can match text[0..j)". Each token
// updates the whole row in one linear pass.
//
// Wildcard character classes replicate the retired regex EXACTLY (R0-EX4
// MINOR: the first DP draft let `**` span line terminators, which regex `.`
// never did): `**` matches anything except a line terminator (it does cross
// '/'); `*` matches anything except '/'. Git-quoted paths keep terminators
// out of real inputs, but the matcher must not drift just because the
// engine changed.
const LINE_TERMINATORS = new Set(['\n', '\r', '\u2028', '\u2029']);
function globMatch(tokens, text) {
  const n = text.length;
  let prev = new Array(n + 1).fill(false);
  prev[0] = true;
  for (const tok of tokens) {
    const next = new Array(n + 1).fill(false);
    if (tok === 'globstar') {
      for (let j = 0; j <= n; j++) {
        if (prev[j]) next[j] = true;
        else if (j > 0 && next[j - 1] && !LINE_TERMINATORS.has(text[j - 1])) next[j] = true;
      }
    } else if (tok === 'star') {
      for (let j = 0; j <= n; j++) {
        if (prev[j]) next[j] = true;
        else if (j > 0 && next[j - 1] && text[j - 1] !== '/') next[j] = true;
      }
    } else {
      for (let j = n; j >= 1; j--) next[j] = prev[j - 1] && text[j - 1] === tok;
    }
    prev = next;
  }
  return prev[n];
}

function matchesAny(p, patterns) {
  const norm = String(p).replace(/\\/g, '/');
  return (patterns || []).some((pat) => globMatch(compileGlob(pat), norm));
}

// ------------------------------------------------------------- fingerprint

// Pull the path out of a porcelain v1 line ("XY path", or "R  old -> new").
// Quoted paths (non-ASCII / spaces with core.quotePath on) are left as-is;
// they simply won't stat, and the line alone still contributes.
function porcelainPath(line) {
  let p = line.slice(3);
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + 4);
  if (p.startsWith('"') && p.endsWith('"')) return '';
  return p;
}

// Working-tree fingerprint. Status letters alone are NOT enough: appending to
// a file that is already modified leaves `git status` byte-identical, so each
// dirty path is annotated with its size and mtime, which move on every write.
// Returns { text, map } or null when the dir isn't a git repo / git is
// unavailable — fingerprinting is a safety net, never a hard dependency.
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

// Which paths differ between two fingerprints, split into declared-expected
// churn (`expected` — the INTEGRITY NOTE bucket) and everything else
// (`suspect` — the INTEGRITY WARNING bucket).
function fingerprintDelta(before, after, generatedPatterns) {
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
    suspect: changed.filter((c) => !matchesAny(c.path, generatedPatterns)),
    expected: changed.filter((c) => matchesAny(c.path, generatedPatterns)),
  };
}

// ---------------------------------------------------------------- checkout

// Every live checkout, so the exit handler can sweep whatever an aborted run
// left behind. Teardown removes entries; the handler is installed once.
const ACTIVE = new Set();
let exitHandlerInstalled = false;

function sweepActive() {
  for (const entry of [...ACTIVE]) {
    try { entry.teardown(); } catch (_) { /* best effort — see below */ }
    // Even if git refused, the parent tmpdir must not survive the process.
    try { fs.rmSync(entry.parent, { recursive: true, force: true }); } catch (_) { /* gone */ }
  }
}

function installExitHandler() {
  if (exitHandlerInstalled) return;
  exitHandlerInstalled = true;
  process.on('exit', sweepActive);
  // SIGINT/SIGTERM do not fire 'exit' unless something handles them — the
  // E7 LOW finding: an interrupted run left writable checkouts and stale
  // worktree registrations behind (observed on this machine). Sweep, then
  // re-raise the signal so the exit status stays honest; if re-raising is
  // unsupported, fall back to a plain non-zero exit.
  //
  // Windows honesty (R0-EX3): SIGTERM is NOT deliverable to a Node handler
  // on Windows — TerminateProcess kills without running anything, so no
  // userland listener can help there. What IS trappable on Windows: SIGINT
  // (Ctrl+C), SIGBREAK (Ctrl+Break), SIGHUP (console close, ~5 s grace).
  // The startup `git worktree prune` in createCheckout() is the recovery
  // path for the untrappable kills; these handlers cover the trappable rest.
  const sigs = process.platform === 'win32'
    ? ['SIGINT', 'SIGBREAK', 'SIGHUP']
    : ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const sig of sigs) {
    try {
      process.on(sig, () => {
        sweepActive();
        process.removeAllListeners(sig);
        try { process.kill(process.pid, sig); } catch (_) { process.exit(1); }
      });
    } catch (_) { /* signal not supported on this platform */ }
  }
}

// The mkdtemp prefix every checkout parent carries — the sweep recognizes
// its own leftovers by it and touches nothing else.
const PARENT_PREFIX = 'orchestra-verifier-';

function normPath(p) {
  const r = path.resolve(String(p)).replace(/\\/g, '/');
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

// Remove registered worktrees under this module's own tmp prefix that no
// LIVE checkout in this process owns (runVerification legitimately holds
// two at once — head + base — and mutationCheck a third; those are in
// ACTIVE and skipped). A concurrent verifier PROCESS on the same repo could
// in principle be swept — the same trade the reference lane makes; runs on
// one repo are serialized by the dispatcher.
function sweepAbandoned(repoDir) {
  const list = runGit(['-C', repoDir, 'worktree', 'list', '--porcelain']);
  if (!list.error && list.status === 0) {
    const live = new Set([...ACTIVE].map((e) => normPath(e.dir)));
    for (const line of (list.stdout || '').split('\n')) {
      if (!line.startsWith('worktree ')) continue;
      const wt = line.slice('worktree '.length).trim();
      const norm = normPath(wt);
      if (!norm.includes(PARENT_PREFIX) || live.has(norm)) continue;
      runGit(['-C', repoDir, 'worktree', 'remove', '--force', wt]);
      try { fs.rmSync(path.dirname(wt), { recursive: true, force: true }); } catch (_) { /* best effort */ }
    }
  }
  runGit(['-C', repoDir, 'worktree', 'prune']);
}

/**
 * Create a throwaway writable checkout of `commitish`, outside the repo.
 * Returns { dir, commit, parent, fingerprintBefore, delta, teardown } or
 * { error } when the checkout cannot be established (the caller maps that to
 * UNAVAILABLE — never to a silent pass).
 */
function createCheckout(repoDir, commitish, opts) {
  const options = opts || {};
  // A commitish beginning with '-' could be read by git as an option; refs
  // may be artifact-adjacent one day, so reject at the door.
  if (typeof commitish !== 'string' || commitish === '' || commitish.startsWith('-')) {
    return { error: 'commitish rejected (empty, non-string, or leading dash): ' + String(commitish) };
  }
  const top = runGit(['-C', repoDir, 'rev-parse', '--show-toplevel']);
  if (top.error || top.status !== 0) {
    return { error: 'not a git repository (or git unavailable): ' + repoDir };
  }
  const toplevel = path.resolve(top.stdout.trim());
  // Reclaim leftovers from previously interrupted runs (E7 + R0-EX4): a
  // `worktree prune` alone clears only registrations whose DIRECTORY is
  // gone — an untrappable kill (TerminateProcess) leaves both the directory
  // and the registration, which prune happily keeps. Sweep any registered
  // worktree living under this module's own mkdtemp prefix that no live
  // checkout in this process owns, then prune the rest.
  sweepAbandoned(repoDir);
  const resolved = runGit(['-C', repoDir, 'rev-parse', '--verify', String(commitish) + '^{commit}']);
  if (resolved.error || resolved.status !== 0) {
    return { error: 'cannot resolve commit ' + commitish + ': ' + ((resolved.stderr || '').trim() || 'git error') };
  }
  const commit = resolved.stdout.trim();

  const parent = fs.mkdtempSync(path.join(options.tmpRoot || os.tmpdir(), PARENT_PREFIX));
  // Bound (1): the checkout lives OUTSIDE the repository. If a caller pointed
  // tmpRoot inside the repo, refuse rather than sandbox the tree inside itself.
  const rel = path.relative(toplevel, parent);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    fs.rmSync(parent, { recursive: true, force: true });
    return { error: 'refusing a checkout inside the repository under examination: ' + parent };
  }

  const dir = path.join(parent, 'checkout');
  const added = runGit(['-C', repoDir, 'worktree', 'add', '--detach', dir, commit]);
  if (added.error || added.status !== 0) {
    fs.rmSync(parent, { recursive: true, force: true });
    return { error: 'worktree add failed: ' + ((added.stderr || '').trim() || 'git error') };
  }

  const fingerprintBefore = treeFingerprint(dir);
  let torndown = false;

  const entry = {
    dir,
    commit,
    parent,
    fingerprintBefore,
    // The before/after comparison, classified. Callers pass project-declared
    // churn patterns; the defaults cover the common generated artifacts.
    delta(generatedPatterns) {
      const after = treeFingerprint(dir);
      if (!fingerprintBefore || !after) return null;
      const patterns = DEFAULT_GENERATED_PATTERNS.concat(generatedPatterns || []);
      return fingerprintDelta(fingerprintBefore, after, patterns);
    },
    teardown() {
      if (torndown) return;
      torndown = true;
      ACTIVE.delete(entry);
      // `worktree remove` also unregisters the checkout from the real repo's
      // metadata; --force because the whole point is that the copy is dirty.
      runGit(['-C', repoDir, 'worktree', 'remove', '--force', dir]);
      runGit(['-C', repoDir, 'worktree', 'prune']);
      fs.rmSync(parent, { recursive: true, force: true });
    },
  };
  ACTIVE.add(entry);
  installExitHandler();
  return entry;
}

// ------------------------------------------------------------------- guard

/**
 * Bound (4): the dispatcher-side fingerprint of the REAL tree across the
 * Verifier's own run. `check()` returns the classified delta ({ suspect,
 * expected }) or null when fingerprinting is unavailable; any suspect entry
 * is a write-scope escape.
 */
function guardTree(repoDir, generatedPatterns) {
  const before = treeFingerprint(repoDir);
  return {
    available: before !== null,
    check() {
      if (!before) return null;
      const after = treeFingerprint(repoDir);
      if (!after) return null;
      const patterns = DEFAULT_GENERATED_PATTERNS.concat(generatedPatterns || []);
      return fingerprintDelta(before, after, patterns);
    },
  };
}

module.exports = {
  DEFAULT_GENERATED_PATTERNS,
  matchesAny,
  treeFingerprint,
  fingerprintDelta,
  createCheckout,
  guardTree,
};
