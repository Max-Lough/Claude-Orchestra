#!/usr/bin/env node
/**
 * Stub Codex CLI for the review-lane tests.
 *
 * Stands in for `codex exec`. It does not review anything — it REPORTS what the
 * real engine would have seen: the directory it was pointed at, how dirty that
 * tree is, which commit is checked out, whether a diff against the pinned base
 * resolves, and what git says on stderr (the `unable to access .../ignore`
 * class of warning). The tests assert on that report, so "what the engine sees"
 * becomes a checkable property instead of a belief.
 *
 * Behaviour knobs (env):
 *   STUB_CODEX_SLEEP_MS   busy-wait this long before writing anything (used to
 *                         kill the runner mid-review).
 *   STUB_CODEX_EXIT       exit with this status instead of 0.
 *   STUB_CODEX_TOUCH      relative path to create inside --cd (integrity test).
 *   STUB_CODEX_PROBE_PATH repo-relative path the stub tries to read out of the
 *                         checked-out commit — the live-tree failure mode
 *                         ("exists on disk, but not in <sha>").
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  return i === -1 ? '' : argv[i + 1] || '';
}

const cd = flag('--cd') || process.cwd();
const outFile = flag('--output-last-message');
const model = flag('--model');

// Read the brief off stdin so the runner's write side completes.
let brief = '';
try {
  brief = fs.readFileSync(0, 'utf8');
} catch (_) {
  brief = '';
}

const sleepMs = parseInt(process.env.STUB_CODEX_SLEEP_MS || '', 10);
if (Number.isFinite(sleepMs) && sleepMs > 0) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sleepMs);
}

function git(args) {
  const r = spawnSync('git', ['-C', cd].concat(args), { encoding: 'utf8' });
  return {
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

const status = git(['status', '--porcelain=v1', '--untracked-files=all']);
const dirtyLines = status.stdout ? status.stdout.split('\n').filter(Boolean) : [];
const head = git(['rev-parse', 'HEAD']);

// The live-tree failure mode from the field: a file that exists on disk but is
// not in the commit under review. In a pinned worktree there is no such file,
// so this resolves cleanly (or reports a plain "does not exist").
const probePath = process.env.STUB_CODEX_PROBE_PATH || '';
const probe = probePath ? git(['show', 'HEAD:' + probePath]) : null;

// Touches the global excludesFile / attributesFile resolution path — this is
// where the sandboxed `unable to access '<home>/.config/git/ignore'` fires.
const ignoreProbe = git(['check-ignore', '--no-index', '-q', 'some/probe/path.txt']);

const base = /BASE REF: (\S+)/.exec(brief);
const diff = base ? git(['diff', '--stat', base[1] + '..HEAD']) : null;

if (process.env.STUB_CODEX_TOUCH) {
  try {
    fs.writeFileSync(path.join(cd, process.env.STUB_CODEX_TOUCH), 'stub was here\n');
  } catch (_) {
    /* best effort */
  }
}

const report = [
  'VERDICT: APPROVE',
  '',
  'STUB REPORT',
  'CWD: ' + cd,
  'MODEL: ' + (model || '(none)'),
  'HEAD: ' + head.stdout,
  'DIRTY_COUNT: ' + dirtyLines.length,
  'DIRTY_PATHS: ' + (dirtyLines.join(' | ') || '(none)'),
  'GIT_CONFIG_GLOBAL: ' + (process.env.GIT_CONFIG_GLOBAL || '(unset)'),
  'GIT_CONFIG_NOSYSTEM: ' + (process.env.GIT_CONFIG_NOSYSTEM || '(unset)'),
  'PROBE_PATH: ' + (probePath || '(none)'),
  'PROBE_STATUS: ' + (probe ? probe.status : '(skipped)'),
  'PROBE_STDERR: ' + (probe ? probe.stderr.replace(/\n/g, ' ⏎ ') : '(skipped)'),
  'IGNORE_PROBE_STDERR: ' + (ignoreProbe.stderr.replace(/\n/g, ' ⏎ ') || '(clean)'),
  'STATUS_STDERR: ' + (status.stderr.replace(/\n/g, ' ⏎ ') || '(clean)'),
  'DIFF_STATUS: ' + (diff ? diff.status : '(skipped)'),
  'DIFF_STDOUT: ' + (diff ? diff.stdout.replace(/\n/g, ' ⏎ ') : '(skipped)'),
  '',
  'FINDINGS',
  '- none',
  '',
  'CLAIMS CHECKED',
  '- "stub ran" → CONFIRMED (it wrote this)',
  '',
  'NITS',
  '- none',
].join('\n');

if (outFile) {
  try {
    fs.writeFileSync(outFile, report + '\n', 'utf8');
  } catch (_) {
    /* fall through to stdout */
  }
}
process.stdout.write(report + '\n');

const exit = parseInt(process.env.STUB_CODEX_EXIT || '', 10);
process.exit(Number.isFinite(exit) ? exit : 0);
