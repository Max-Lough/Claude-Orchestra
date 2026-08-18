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
 *   STUB_CODEX_TOUCH      relative path(s) to create inside --cd, comma-split
 *                         (integrity test).
 *   STUB_CODEX_PROBE_PATH repo-relative path the stub tries to read out of the
 *                         checked-out commit — the live-tree failure mode
 *                         ("exists on disk, but not in <sha>").
 *   STUB_CODEX_SILENT     write no report at all (the zero-output failure).
 *   STUB_CODEX_STDERR     text to emit on stderr before exiting.
 *   STUB_CODEX_FAIL_UNTIL_ATTEMPT
 *                         with STUB_CODEX_ATTEMPT_FILE: fail (per the knobs
 *                         above) on every invocation up to and including this
 *                         attempt number, then succeed. This is how the retry
 *                         chain is tested — the same binary, failing once.
 *   STUB_CODEX_ATTEMPT_FILE
 *                         counter file backing the above.
 *   STUB_CODEX_PROBE_EXIT exit status for a PROBE invocation only (the runner's
 *                         stage-a echo), leaving real reviews unaffected.
 *
 * A probe invocation is recognised by its prompt: the runner asks for a single
 * token echo. The stub answers it without pretending to review anything.
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

// ------------------------------------------------------------ probe mode
// The runner's stage-a probe asks for one token and nothing else. Answer it
// cheaply — a probe that had to run the whole reporting path below would not be
// testing what the real probe tests.
if (/ORCHESTRA_PROBE_OK/.test(brief)) {
  const probeExit = parseInt(process.env.STUB_CODEX_PROBE_EXIT || '', 10);
  if (Number.isFinite(probeExit) && probeExit !== 0) {
    process.stderr.write('stub: simulated probe failure\n');
    process.exit(probeExit);
  }
  if (outFile) {
    try {
      fs.writeFileSync(outFile, 'ORCHESTRA_PROBE_OK\n', 'utf8');
    } catch (_) {
      /* fall through to stdout */
    }
  }
  process.stdout.write('ORCHESTRA_PROBE_OK\n');
  process.exit(0);
}

const sleepMs = parseInt(process.env.STUB_CODEX_SLEEP_MS || '', 10);
if (Number.isFinite(sleepMs) && sleepMs > 0) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sleepMs);
}

// ------------------------------------------------------- attempt bookkeeping
// Which attempt is this? The runner gives each attempt its own scratch
// directory but the same executable, so the stub counts invocations itself.
let attempt = 1;
const counterFile = process.env.STUB_CODEX_ATTEMPT_FILE || '';
if (counterFile) {
  try {
    attempt = (parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10) || 0) + 1;
  } catch (_) {
    attempt = 1;
  }
  try {
    fs.writeFileSync(counterFile, String(attempt), 'utf8');
  } catch (_) {
    /* best effort — the test asserts on the report, which still says which */
  }
}

const failUntil = parseInt(process.env.STUB_CODEX_FAIL_UNTIL_ATTEMPT || '', 10);
const failingThisAttempt = Number.isFinite(failUntil) && attempt <= failUntil;

if (process.env.STUB_CODEX_STDERR) {
  process.stderr.write(process.env.STUB_CODEX_STDERR + '\n');
}

// A failure that produces NOTHING — the field's exit-143 shape — is the case
// the retry chain exists for.
if (failingThisAttempt || process.env.STUB_CODEX_SILENT) {
  process.stderr.write('stub: attempt ' + attempt + ' producing no verdict\n');
  const failExit = parseInt(process.env.STUB_CODEX_EXIT || '', 10);
  process.exit(Number.isFinite(failExit) ? failExit : 143);
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

for (const rel of (process.env.STUB_CODEX_TOUCH || '').split(',').map((s) => s.trim()).filter(Boolean)) {
  try {
    const dest = path.join(cd, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, 'stub was here\n');
  } catch (_) {
    /* best effort */
  }
}

const report = [
  'VERDICT: APPROVE',
  '',
  'STUB REPORT',
  'CWD: ' + cd,
  'ATTEMPT: ' + attempt,
  'MODEL: ' + (model || '(none)'),
  'HEAD: ' + head.stdout,
  'DIRTY_COUNT: ' + dirtyLines.length,
  'DIRTY_PATHS: ' + (dirtyLines.join(' | ') || '(none)'),
  // First PATH entry the engine was launched with. Some Codex helpers are
  // resolved by NAME rather than relative to the binary, so "the install
  // directory is on PATH" is part of what the engine sees.
  'PATH_FIRST: ' +
    ((process.env.PATH || process.env.Path || '').split(path.delimiter)[0] || '(empty)'),
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
