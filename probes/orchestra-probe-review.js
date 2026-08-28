#!/usr/bin/env node
/**
 * Orchestra review-throughput probe — WO-2 (probe; nothing is built on it).
 *
 * Answers the plan's question BEFORE any mandate activates: how many
 * cross-vendor reviews can the one review lane actually complete per
 * five-hour allowance window, on this machine, with this Codex install?
 *
 * What it does: takes the last N non-merge commits of a repo (default 5,
 * max 20 — the plan's ">=20 representative changes" is the full probe; start
 * small), and drives each one through the EXISTING review runner
 * (orchestra-review.js) in PINNED mode: `--base-ref <parent> --head-ref
 * <commit>`, so the runner checks the commit out in a throwaway worktree and
 * reviews exactly that change against its parent. Per review it records wall
 * clock and the VERDICT line (APPROVE / REVISE / REVIEW_UNAVAILABLE), then
 * prints the WO-2 metrics: reviews completed, mean and P95 wall clock,
 * projected reviews per 5-hour window, and the stop-condition check against
 * an operator-supplied expected peak arrival (--peak).
 *
 * Reviews run SEQUENTIALLY, on purpose. The probe measures the throughput of
 * ONE review lane; parallel codex runs would contend for the same install,
 * the same repo's worktree bookkeeping, and the same allowance pool, and the
 * number that came out would describe nothing deployable.
 *
 * Retries stay with the runner (its default: one extra attempt for failures
 * that could plausibly differ) — that is production behavior, so the probe
 * keeps it and the measured wall clock honestly includes it.
 *
 * COST: every non-dry review is a real Codex engine run and bills real
 * allowance — minutes of exploration per review even for tiny diffs. Hence:
 *   --dry-run  prints the commit list and the exact commands, spends nothing;
 *   --yes      is REQUIRED for a real run; without it the probe refuses.
 *
 * Usage:
 *   node probes/orchestra-probe-review.js [--count N] [--repo <dir>]
 *       [--peak <reviews-per-5h-window>] [--timeout-ms <n>] [--dry-run] [--yes]
 *
 * Runner resolution: <repo>/.claude/hooks/orchestra-review.js (an installed
 * codex pack) first, else packs/codex/hooks/orchestra-review.js relative to
 * this script. Exit code: 0 when every selected review produced a verdict
 * (dry runs always 0), 1 otherwise.
 *
 * House rules: zero dependencies, CommonJS, same voice as
 * hooks/orchestra-guard.js.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const DEFAULT_COUNT = 5;
const MAX_COUNT = 20;
const WINDOW_MS = 5 * 3600 * 1000; // the vendor's 5-hour allowance window

// Stop-condition thresholds, both from the plan:
//   1.30 — WO-2's explicit stop condition (capacity < 1.3x expected peak
//          arrival -> hold the mandate / provision a larger tier);
//   1.43 — the acceptance gate's utilization ceiling (<=70% reviewer
//          utilization implies capacity >= 1/0.7 = 1.43x arrival).
// Below 1.30 is a hard stop; between 1.30 and 1.43 passes the stop condition
// but would run the lane hotter than the acceptance gate allows.
const STOP_RATIO = 1.3;
const UTILIZATION_RATIO = 1.43;

// Per-review outer timeout: the runner's own default review budget is
// 600000ms and it may retry once, so the probe's kill-switch has to sit above
// the whole chain, not inside it. Overridable with --timeout-ms (passed to
// the runner; the outer cap scales with it).
const RUNNER_DEFAULT_TIMEOUT_MS = 600000;
const RUNNER_DEFAULT_RETRIES = 1;
const OUTER_MARGIN_MS = 180000;

function fail(msg) {
  process.stderr.write('orchestra-probe-review: ' + msg + '\n');
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    count: DEFAULT_COUNT,
    repo: process.cwd(),
    dryRun: false,
    yes: false,
    peak: null,
    timeoutMs: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count') {
      out.count = parseInt(argv[++i], 10);
      if (!Number.isFinite(out.count) || out.count < 1) fail('--count must be a positive integer');
      if (out.count > MAX_COUNT) fail('--count is capped at ' + MAX_COUNT + ' (each review bills real allowance)');
    } else if (a === '--repo') {
      out.repo = argv[++i];
      if (!out.repo) fail('--repo needs a directory');
    } else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--yes') out.yes = true;
    else if (a === '--peak') {
      out.peak = parseFloat(argv[++i]);
      if (!Number.isFinite(out.peak) || out.peak <= 0) fail('--peak must be a positive number (expected reviews per 5-hour window)');
    } else if (a === '--timeout-ms') {
      out.timeoutMs = parseInt(argv[++i], 10);
      if (!Number.isFinite(out.timeoutMs) || out.timeoutMs < 1) fail('--timeout-ms must be a positive integer');
    } else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: node probes/orchestra-probe-review.js [--count N] [--repo <dir>]\n' +
          '           [--peak <reviews-per-5h-window>] [--timeout-ms <n>] [--dry-run] [--yes]\n' +
          '\n' +
          '  Drives the last N non-merge commits (default ' + DEFAULT_COUNT + ', max ' + MAX_COUNT + ') through the\n' +
          '  cross-vendor review runner, one at a time, pinned to each commit against\n' +
          '  its parent, and reports WO-2 throughput metrics.\n' +
          '  --dry-run shows the commits and commands without running anything.\n' +
          '  Real runs bill Codex allowance and REQUIRE --yes.\n'
      );
      process.exit(0);
    } else fail('unknown argument: ' + a + ' (see --help)');
  }
  return out;
}

function git(repo, args) {
  try {
    return execFileSync('git', ['-C', repo].concat(args), {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch (e) {
    return null;
  }
}

// The last N non-merge commits, newest first, each with its parent resolved.
// A root commit (no parent) cannot be expressed as "ref against base" and is
// skipped with a note rather than faked against an empty tree.
function selectCommits(repo, count) {
  const raw = git(repo, ['log', '--no-merges', '--format=%H%x09%s', '-n', String(count)]);
  if (raw === null) fail(repo + ' is not a git repository (or git is unavailable)');
  const commits = [];
  const skipped = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf('\t');
    if (idx === -1) continue;
    const sha = line.slice(0, idx);
    const subject = line.slice(idx + 1);
    const parent = git(repo, ['rev-parse', '--verify', '--quiet', sha + '^']);
    if (!parent) {
      skipped.push({ sha, subject, why: 'root commit — no parent to diff against' });
      continue;
    }
    commits.push({ sha, subject, parent });
  }
  return { commits, skipped };
}

function resolveRunner(repo) {
  const installed = path.join(repo, '.claude', 'hooks', 'orchestra-review.js');
  if (fs.existsSync(installed)) return installed;
  const packed = path.resolve(__dirname, '..', 'packs', 'codex', 'hooks', 'orchestra-review.js');
  if (fs.existsSync(packed)) return packed;
  fail(
    'cannot find the review runner: neither ' + installed + ' nor ' + packed +
      ' exists. Install the codex pack, or run this probe from the Claude-Orchestra checkout.'
  );
}

// The runner requires at least one of --work-order / --executor-report to be
// non-empty text (it refuses with "no review input" otherwise). The probe
// writes an honest pair per commit: the intent is the commit message, the
// claim is "this commit is the change".
function writeBriefFiles(dir, c, i) {
  const wo = path.join(dir, 'wo-' + i + '-' + c.sha.slice(0, 12) + '.txt');
  const er = path.join(dir, 'er-' + i + '-' + c.sha.slice(0, 12) + '.txt');
  fs.writeFileSync(
    wo,
    'WO-2 THROUGHPUT PROBE — review a completed, already-merged change.\n\n' +
      'Change under review: commit ' + c.sha + '\n' +
      'Base (its parent):   ' + c.parent + '\n' +
      'Commit subject:      ' + c.subject + '\n\n' +
      'Intent: the commit message above is the work order this change claims to\n' +
      'implement. Audit the diff between base and head against that stated\n' +
      'intent: correctness, unexplained changes, and concrete failure scenarios.\n' +
      'This is a representative historical change selected for a throughput\n' +
      'probe; review it at normal full depth.\n',
    'utf8'
  );
  fs.writeFileSync(
    er,
    'EXECUTOR REPORT (probe-synthesized — no executor ran):\n' +
      'STATUS: DONE. The change is commit ' + c.sha + ', produced by normal\n' +
      'development and already in history. No fresh executor claims exist beyond\n' +
      'the commit message; verify the diff on its own merits.\n',
    'utf8'
  );
  return { wo, er };
}

function buildCommand(runner, briefs, c, timeoutMs) {
  const args = [
    runner,
    '--work-order', briefs.wo,
    '--executor-report', briefs.er,
    '--base-ref', c.parent,
    '--head-ref', c.sha,
  ];
  if (timeoutMs) args.push('--timeout-ms', String(timeoutMs));
  return args;
}

function quoteForDisplay(a) {
  return /[\s"]/.test(a) ? '"' + String(a).replace(/"/g, '\\"') + '"' : a;
}

function fmtMs(msVal) {
  if (msVal >= 60000) return (msVal / 60000).toFixed(1) + 'm';
  return (msVal / 1000).toFixed(1) + 's';
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = path.resolve(args.repo);
  const repoTop = git(repo, ['rev-parse', '--show-toplevel']);
  if (!repoTop) fail(repo + ' is not inside a git repository');

  const { commits, skipped } = selectCommits(repo, args.count);
  if (!commits.length) fail('no reviewable non-merge commits found in ' + repo);
  const runner = resolveRunner(repo);

  const runnerTimeout = args.timeoutMs || RUNNER_DEFAULT_TIMEOUT_MS;
  const outerTimeout = runnerTimeout * (1 + RUNNER_DEFAULT_RETRIES) + OUTER_MARGIN_MS;

  process.stdout.write('WO-2 review-throughput probe\n');
  process.stdout.write('  repo:    ' + repoTop + '\n');
  process.stdout.write('  runner:  ' + runner + '\n');
  process.stdout.write('  commits: ' + commits.length + ' (newest first, non-merge)' +
    (skipped.length ? ', ' + skipped.length + ' skipped' : '') + '\n\n');
  for (const s of skipped) {
    process.stdout.write('  SKIPPED ' + s.sha.slice(0, 12) + '  ' + s.why + '\n');
  }

  if (args.dryRun) {
    // Show exactly what a real run would execute — brief files land in a
    // scratch dir at run time; the dry run names placeholder paths.
    process.stdout.write('DRY RUN — nothing executed, nothing billed.\n\n');
    commits.forEach((c, i) => {
      process.stdout.write(
        '[' + (i + 1) + '/' + commits.length + '] ' + c.sha.slice(0, 12) + '  ' +
          c.subject.slice(0, 70) + '\n'
      );
      const fakeBriefs = {
        wo: '<scratch>/wo-' + (i + 1) + '-' + c.sha.slice(0, 12) + '.txt',
        er: '<scratch>/er-' + (i + 1) + '-' + c.sha.slice(0, 12) + '.txt',
      };
      const cmd = ['node'].concat(
        buildCommand(runner, fakeBriefs, c, args.timeoutMs).map(quoteForDisplay)
      );
      process.stdout.write('    ' + cmd.join(' ') + '\n');
      process.stdout.write('    (cwd + CLAUDE_PROJECT_DIR = ' + repoTop + ', sequential, outer cap ' +
        fmtMs(outerTimeout) + ')\n');
    });
    process.stdout.write(
      '\nEach command is one full Codex engine review (minutes each, real allowance).\n' +
        'Re-run with --yes to execute.\n'
    );
    return;
  }

  if (!args.yes) {
    fail(
      'refusing to run: ' + commits.length + ' real cross-vendor reviews bill real ' +
        'Codex allowance (roughly ' + fmtMs(runnerTimeout) + '+ of engine time EACH). ' +
        'Run with --dry-run first to inspect, then add --yes to spend it.'
    );
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-probe-'));
  const results = [];
  try {
    commits.forEach((c, i) => {
      const briefs = writeBriefFiles(scratch, c, i + 1);
      const cmdArgs = buildCommand(runner, briefs, c, args.timeoutMs);
      process.stdout.write(
        '[' + (i + 1) + '/' + commits.length + '] reviewing ' + c.sha.slice(0, 12) +
          '  ' + c.subject.slice(0, 60) + ' ...\n'
      );
      const t0 = Date.now();
      const r = spawnSync(process.execPath, cmdArgs, {
        cwd: repoTop,
        encoding: 'utf8',
        timeout: outerTimeout,
        maxBuffer: 64 * 1024 * 1024,
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: repoTop }),
      });
      const wallMs = Date.now() - t0;
      const out = (r.stdout || '') + '\n' + (r.stderr || '');
      const verdictMatch = /^VERDICT:\s*(.+)$/m.exec(r.stdout || '');
      const verdict = verdictMatch ? verdictMatch[1].trim() : null;
      let status;
      if (r.error) status = 'SPAWN_FAILED (' + r.error.message + ')';
      else if (r.signal) status = 'KILLED_AT_OUTER_TIMEOUT';
      else if (!verdict) status = 'NO_VERDICT_LINE';
      else if (/UNAVAILABLE/i.test(verdict)) status = 'UNAVAILABLE';
      else status = 'COMPLETED';
      const res = {
        sha: c.sha,
        subject: c.subject,
        wallMs,
        verdict: verdict || '(none)',
        status,
      };
      results.push(res);
      // Keep the full runner output on disk next to the briefs so a surprising
      // verdict can be audited after the run.
      fs.writeFileSync(path.join(scratch, 'out-' + (i + 1) + '-' + c.sha.slice(0, 12) + '.txt'), out, 'utf8');
      process.stdout.write('    -> ' + status + ' / ' + res.verdict + '  (' + fmtMs(wallMs) + ')\n');
    });
  } finally {
    // Briefs and captured outputs are the probe's evidence — keep them and say
    // where they are, rather than deleting the audit trail.
    process.stdout.write('\nBriefs + full runner outputs kept in: ' + scratch + '\n');
  }

  // ----------------------------------------------------------- WO-2 metrics
  const completed = results.filter((r) => r.status === 'COMPLETED');
  const wallsAll = results.map((r) => r.wallMs).sort((a, b) => a - b);
  const walls = completed.map((r) => r.wallMs).sort((a, b) => a - b);
  const mean = walls.length ? walls.reduce((a, b) => a + b, 0) / walls.length : null;
  const p95 = percentile(walls, 95);

  process.stdout.write('\nRESULTS\n');
  process.stdout.write(pad('  commit', 16) + pad('status', 24) + pad('verdict', 22) + 'wall\n');
  for (const r of results) {
    process.stdout.write(
      pad('  ' + r.sha.slice(0, 12), 16) + pad(r.status, 24) +
        pad(r.verdict.slice(0, 20), 22) + fmtMs(r.wallMs) + '\n'
    );
  }

  process.stdout.write('\nWO-2 METRICS\n');
  process.stdout.write('  reviews attempted:            ' + results.length + '\n');
  process.stdout.write('  reviews completed (verdict):  ' + completed.length + '\n');
  process.stdout.write('  unavailable / failed:         ' + (results.length - completed.length) + '\n');
  if (mean !== null) {
    const projected = WINDOW_MS / mean; // sequential lane: one review at a time
    process.stdout.write('  mean wall clock:              ' + fmtMs(mean) + '\n');
    process.stdout.write('  P95 wall clock:               ' + fmtMs(p95) + '\n');
    process.stdout.write(
      '  projected reviews / 5h window (sequential lane): ' + projected.toFixed(1) + '\n'
    );
    if (args.peak !== null) {
      const ratio = projected / args.peak;
      process.stdout.write(
        '  expected peak arrival:        ' + args.peak + ' / window  ->  capacity is ' +
          ratio.toFixed(2) + 'x peak\n'
      );
      if (ratio < STOP_RATIO) {
        process.stdout.write(
          '  STOP CONDITION TRIPPED: capacity < ' + STOP_RATIO + 'x expected peak. Per the\n' +
            '  plan: provision a larger tier, shrink expected gate-class volume, or hold\n' +
            '  the mandate\'s activation. Do not activate the mandatory-review path.\n'
        );
        process.exitCode = 1;
      } else if (ratio < UTILIZATION_RATIO) {
        process.stdout.write(
          '  MARGINAL: passes the ' + STOP_RATIO + 'x stop condition but sits under the\n' +
            '  acceptance gate\'s ' + UTILIZATION_RATIO + 'x (<=70% utilization) ceiling —\n' +
            '  the lane would run hot. Treat as a warning, not a pass.\n'
        );
      } else {
        process.stdout.write('  stop condition: OK (>= ' + UTILIZATION_RATIO + 'x peak)\n');
      }
    } else {
      process.stdout.write(
        '  (no --peak supplied: stop condition not evaluated. Re-run the numbers with\n' +
          '   --peak <expected gate-class reviews per 5h window> when the operator has\n' +
          '   an arrival estimate.)\n'
      );
    }
  } else {
    process.stdout.write('  no review completed — throughput cannot be projected. Check the\n');
    process.stdout.write('  captured outputs above, and run the runner\'s --doctor.\n');
    process.exitCode = 1;
  }
  if (results.length < 20) {
    process.stdout.write(
      '\nNOTE: the plan\'s full WO-2 probe wants >=20 representative changes; this run\n' +
        'covered ' + results.length + '. Scale up with --count once a small batch looks sane.\n'
    );
  }
  if (results.some((r) => r.status !== 'COMPLETED')) process.exitCode = 1;
}

main();
