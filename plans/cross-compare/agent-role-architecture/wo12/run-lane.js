#!/usr/bin/env node
/**
 * WO-12 lane driver — protocol §2.4 (lanes), §2.6 (phases), §4 (evidence layout).
 *
 *   node run-lane.js --lane <X-Sol|X-Terra> --phase <0|1|2|3>
 *       [--dry-run] [--yes] [--timeout-ms <n>] [--override-p0 "<reason>"]
 *       [--key <path>] [--briefs-dir <dir>] [--patches-dir <dir>]
 *       [--source-repo <dir>] [--clone-root <dir>] [--results-dir <dir>]
 *       [--runner <path>]
 *
 * Drives one X-lane (`orchestra-review.js`, i.e. the Codex/OpenAI engine) over
 * one phase's worth of SDC artifacts (protocol §2.6), SEQUENTIALLY, on
 * purpose — same reasoning as probes/orchestra-probe-review.js: this measures
 * one lane's own draw and throughput, and parallel runs would contend for the
 * same install and the same allowance pool.
 *
 * For each artifact assigned to `--phase` (key.json `phase` field, in corpus
 * order):
 *   1. read the PRE-AUTHORED brief pair `corpus/briefs/<id>.wo.txt` /
 *      `<id>.er.txt` verbatim — the 12h packet variant is already baked into
 *      those files by the corpus construction step; this script reads them,
 *      never edits them;
 *   2. materialize the artifact via build-corpus.js's `materializeArtifact`
 *      (one shared throwaway clone for the whole phase, see --clone-root);
 *   3. run `orchestra-review.js --work-order .. --executor-report ..
 *      --base-ref <base> --head-ref <head> --timeout-ms <n>` with cwd = the
 *      clone dir and the lane's env (protocol §2.4 table, LANES below) —
 *      REAL COST: every non-dry, non-override run bills real OpenAI
 *      allowance, so this refuses without BOTH a Green-for-OU Quartermaster
 *      read and --yes.
 *
 * Retries: exactly one, on a REVIEW_UNAVAILABLE verdict (the runner's own
 * production default already retries internally; this is run-lane's OWN
 * retry on top, matching the protocol's "each UNAVAILABLE is retried once,
 * the retry recorded" — §2.5 Stability). Both attempts are kept, verbatim.
 *
 * Output: appends one record per artifact to
 * `results-<lane>-phase<n>.json` (default: this directory) — an array of
 *   { id, base, head, lane, phase, variant,
 *     attempts: [ { wallMs, verdict, status, engineHeader, integrityWarning, stdout } ] }
 * written after EVERY artifact (not just at the end), so a crash mid-phase
 * loses at most the artifact in flight, never the ones already reviewed.
 * `stdout` is the runner's combined stdout+stderr, kept VERBATIM — nothing
 * here summarizes or elides a real verdict.
 *
 * P0 gate: before a REAL run (never for --dry-run — nothing is spent there),
 * runs `node quartermaster/quartermaster.js --state` and prints its output
 * (both streams, exit code) VERBATIM regardless of outcome. `--state`
 * (quartermaster.js's own CLI) throws — and this refuses — the instant ANY
 * bucket fails closed; since the protocol's P0 gate for THIS lane is
 * specifically "Green for OU" (§2.6), a refusal whose text does not mention
 * OU (i.e. some OTHER bucket, e.g. an AU-* one, is the one that's fail-
 * closed) is read as OU-clear and does not block an OU-only lane run — see
 * the wo12 report's ambiguity note for why. `--override-p0 "<reason>"`
 * (OWNER USE ONLY) records the reason into the results file instead of
 * refusing. `WO12_QM_CMD` (env, whitespace-split into argv) replaces the
 * quartermaster command entirely — for tests only, so a stub can stand in
 * for the real substrate without touching real pool-reading files.
 *
 * DOES NOT invoke codex/the review engine itself except through the real
 * `orchestra-review.js` runner path described above — this file never talks
 * to an engine directly.
 *
 * House rules: zero dependencies, CommonJS, same voice as
 * probes/orchestra-probe-review.js and build-corpus.js.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const buildCorpus = require(path.join(HERE, 'build-corpus.js'));

// Protocol §2.4 lane table, verbatim.
const LANES = {
  'X-Sol': { model: 'gpt-5.6-sol', args: '-c model_reasoning_effort=high' },
  'X-Terra': { model: 'gpt-5.6-terra', args: '-c model_reasoning_effort=medium' },
};

const DEFAULT_TIMEOUT_MS = 600000; // matches orchestra-review.js's own default
const RUNNER_OWN_RETRIES = 1; // orchestra-review.js's own internal retry default
const OUTER_MARGIN_MS = 180000;

function fail(msg) {
  process.stderr.write('run-lane: ' + msg + '\n');
  process.exit(1);
}

// ------------------------------------------------------------------- args

function usage() {
  return [
    'usage:',
    '  node run-lane.js --lane <X-Sol|X-Terra> --phase <0|1|2|3>',
    '      [--dry-run] [--yes] [--timeout-ms <n>] [--override-p0 "<reason>"]',
    '      [--key <path>] [--briefs-dir <dir>] [--patches-dir <dir>]',
    '      [--source-repo <dir>] [--clone-root <dir>] [--results-dir <dir>]',
    '      [--runner <path>]',
    '',
    'lanes: ' + Object.keys(LANES).join(' | '),
    '--override-p0 is OWNER USE ONLY: it records the given reason into the',
    '  results file INSTEAD OF refusing on a fail-closed OU bucket. It never',
    '  bypasses --yes.',
    '--dry-run prints every command that WOULD run, with the right per-lane',
    '  env, and touches nothing — no Quartermaster check, no clone, no spend.',
    '--yes is REQUIRED for a real run (each artifact bills real OpenAI',
    '  allowance).',
  ].join('\n');
}

function parseArgs(argv) {
  const out = {
    lane: null, phase: null, dryRun: false, yes: false, timeoutMs: null,
    overrideP0: null, key: null, briefsDir: null, patchesDir: null,
    sourceRepo: null, cloneRoot: null, resultsDir: null, runner: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lane') out.lane = argv[++i];
    else if (a === '--phase') out.phase = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--yes') out.yes = true;
    else if (a === '--timeout-ms') {
      out.timeoutMs = parseInt(argv[++i], 10);
      if (!Number.isFinite(out.timeoutMs) || out.timeoutMs < 1) fail('--timeout-ms must be a positive integer');
    } else if (a === '--override-p0') out.overrideP0 = argv[++i];
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--briefs-dir') out.briefsDir = argv[++i];
    else if (a === '--patches-dir') out.patchesDir = argv[++i];
    else if (a === '--source-repo') out.sourceRepo = argv[++i];
    else if (a === '--clone-root') out.cloneRoot = argv[++i];
    else if (a === '--results-dir') out.resultsDir = argv[++i];
    else if (a === '--runner') out.runner = argv[++i];
    else if (a === '--help' || a === '-h') { process.stdout.write(usage() + '\n'); process.exit(0); }
    else fail('unknown argument: ' + a + '\n\n' + usage());
  }
  if (!out.lane || !LANES[out.lane]) fail('--lane must be one of: ' + Object.keys(LANES).join(', ') + '\n\n' + usage());
  if (out.phase === null) fail('--phase is required (0|1|2|3)\n\n' + usage());
  out.phase = parseInt(out.phase, 10);
  if (![0, 1, 2, 3].includes(out.phase)) fail('--phase must be 0, 1, 2 or 3 (got ' + out.phase + ')');
  if (out.overrideP0 !== null && !out.overrideP0.trim()) fail('--override-p0 needs a non-empty reason string (owner use only)');
  return out;
}

// -------------------------------------------------------------- resolution

// Same two-location search as probes/orchestra-probe-review.js: an installed
// pack first, then this checkout's own packs/ copy.
function resolveRunner(repoRoot) {
  const installed = path.join(repoRoot, '.claude', 'hooks', 'orchestra-review.js');
  if (fs.existsSync(installed)) return installed;
  const packed = path.join(repoRoot, 'packs', 'codex', 'hooks', 'orchestra-review.js');
  if (fs.existsSync(packed)) return packed;
  fail('cannot find the review runner: neither ' + installed + ' nor ' + packed + ' exists.');
}

// Whitespace-splits a command string into argv, honoring double-quoted
// segments — WO12_QM_CMD needs this because process.execPath itself can
// contain spaces (a "Program Files" node install), so a naive split(/\s+/)
// would break the exe path apart.
function splitCommand(s) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

function resolveQmCommand(repoRoot) {
  if (process.env.WO12_QM_CMD) {
    const parts = splitCommand(process.env.WO12_QM_CMD);
    if (!parts.length) fail('WO12_QM_CMD is set but empty after splitting');
    return { cmd: parts[0], args: parts.slice(1) };
  }
  return { cmd: process.execPath, args: [path.join(repoRoot, 'quartermaster', 'quartermaster.js')] };
}

// -------------------------------------------------------------- P0 gate

/**
 * Runs `quartermaster --state`, prints it VERBATIM (both streams + exit
 * code), and answers the one question the protocol's P0 gate needs for THIS
 * lane: is OU specifically fail-closed/REFUSED? `bucketState()` — what
 * `--state` prints — fails the WHOLE call closed on ANY bucket's problem (it
 * has no per-bucket success mode), so on a non-zero exit we search its error
 * text for OU's own "REFUSED for OU" line rather than treating every non-
 * zero exit as an OU refusal — a fail-closed AU-* bucket is a real problem,
 * just not the one gating an OU-only lane run. See the wo12 report.
 */
function checkQuartermaster(repoRoot) {
  const { cmd, args } = resolveQmCommand(repoRoot);
  const fullArgs = args.concat(['--state']);
  const r = spawnSync(cmd, fullArgs, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';

  process.stdout.write('--- quartermaster --state (verbatim) ---\n');
  process.stdout.write('$ ' + [cmd].concat(fullArgs).join(' ') + '\n');
  if (stdout) process.stdout.write(stdout.replace(/\s+$/, '') + '\n');
  if (stderr) process.stdout.write(stderr.replace(/\s+$/, '') + '\n');
  process.stdout.write('exit code: ' + (r.status === null ? 'null (signal ' + r.signal + ')' : r.status) + '\n');
  process.stdout.write('--- end quartermaster output ---\n\n');

  if (r.error) fail('failed to invoke the quartermaster command (' + cmd + '): ' + r.error.message);

  const combined = stdout + '\n' + stderr;
  let ouFailClosed;
  if (r.status === 0) {
    // bucketState() returns only when EVERY bucket has usable evidence —
    // OU included. Belt-and-suspenders: also confirm the printed JSON
    // actually carries an OU key.
    ouFailClosed = false;
    try {
      const parsed = JSON.parse(stdout);
      if (!parsed || !parsed.OU) {
        ouFailClosed = true; // a "success" with no OU key is not evidence of OU health
      }
    } catch (e) {
      ouFailClosed = true; // a "success" exit with unparseable output is not evidence either
    }
  } else {
    ouFailClosed = /REFUSED for OU\b/.test(combined);
  }
  return { exitCode: r.status, combined, ouFailClosed };
}

// ------------------------------------------------------------------- I/O

function loadKey(keyPath) {
  return buildCorpus.loadKey(keyPath);
}

function readBrief(file, label, id) {
  if (!fs.existsSync(file)) {
    fail('missing pre-authored ' + label + ' for artifact ' + id + ': ' + file +
      ' (run-lane.js never generates briefs — the corpus construction step must commit them first)');
  }
  return file;
}

function appendResult(resultsFile, record) {
  let arr = [];
  if (fs.existsSync(resultsFile)) {
    try {
      arr = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      if (!Array.isArray(arr)) arr = [];
    } catch (e) {
      arr = [];
    }
  }
  arr.push(record);
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  fs.writeFileSync(resultsFile, JSON.stringify(arr, null, 2) + '\n', 'utf8');
  return arr.length;
}

function fmtMs(msVal) {
  if (msVal >= 60000) return (msVal / 60000).toFixed(1) + 'm';
  return (msVal / 1000).toFixed(1) + 's';
}

function quoteForDisplay(a) {
  return /[\s"]/.test(a) ? '"' + String(a).replace(/"/g, '\\"') + '"' : a;
}

// ---------------------------------------------------------------- one run

function runOneAttempt(runner, wo, er, base, head, cwd, timeoutMs, laneCfg) {
  const outerTimeout = timeoutMs * (1 + RUNNER_OWN_RETRIES) + OUTER_MARGIN_MS;
  const t0 = Date.now();
  const r = spawnSync(
    process.execPath,
    [runner, '--work-order', wo, '--executor-report', er, '--base-ref', base, '--head-ref', head, '--timeout-ms', String(timeoutMs)],
    {
      cwd,
      encoding: 'utf8',
      timeout: outerTimeout,
      maxBuffer: 64 * 1024 * 1024,
      env: Object.assign({}, process.env, {
        CLAUDE_PROJECT_DIR: cwd,
        ORCHESTRA_REVIEW_MODEL: laneCfg.model,
        ORCHESTRA_REVIEW_ARGS: laneCfg.args,
      }),
    }
  );
  const wallMs = Date.now() - t0;
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  const stdoutVerbatim = stdout + (stderr ? '\n--- stderr ---\n' + stderr : '');

  const verdictMatch = /^VERDICT:\s*(.+)$/m.exec(stdout);
  const verdict = verdictMatch ? verdictMatch[1].trim() : null;

  const engineLine = /^REVIEW ENGINE:.*$/m.exec(stdout);
  const modelLine = /^.*\bmodel:\s*\S.*$/im.exec(stdout);
  const engineHeader = engineLine ? engineLine[0].trim() : (modelLine ? modelLine[0].trim() : null);

  const integrityWarning = /INTEGRITY WARNING/.test(stdout);

  let status;
  if (r.error) status = 'SPAWN_FAILED (' + r.error.message + ')';
  else if (r.signal) status = 'KILLED_AT_OUTER_TIMEOUT (' + r.signal + ')';
  else if (!verdict) status = 'NO_VERDICT_LINE';
  else if (/UNAVAILABLE/i.test(verdict)) status = 'UNAVAILABLE';
  else status = 'COMPLETED';

  return { wallMs, verdict: verdict || '(none)', status, engineHeader, integrityWarning, stdout: stdoutVerbatim };
}

// ---------------------------------------------------------------------- main

function main() {
  const args = parseArgs(process.argv.slice(2));
  const laneCfg = LANES[args.lane];
  const repoRoot = args.sourceRepo ? path.resolve(args.sourceRepo) : buildCorpus.detectRepoRoot();

  const corpusDirDefault = args.key ? path.dirname(path.resolve(args.key)) : path.join(HERE, 'corpus');
  const keyPath = args.key ? path.resolve(args.key) : path.join(corpusDirDefault, 'key.json');
  const briefsDir = args.briefsDir ? path.resolve(args.briefsDir) : path.join(corpusDirDefault, 'briefs');
  const patchesDir = args.patchesDir ? path.resolve(args.patchesDir) : corpusDirDefault;
  const resultsDir = args.resultsDir ? path.resolve(args.resultsDir) : HERE;
  const runner = args.runner ? path.resolve(args.runner) : resolveRunner(repoRoot);
  const timeoutMs = args.timeoutMs || DEFAULT_TIMEOUT_MS;

  const key = loadKey(keyPath);
  const artifacts = key.artifacts.filter((a) => a.phase === args.phase);
  if (!artifacts.length) fail('no artifacts in ' + keyPath + ' with phase ' + args.phase);

  const resultsFile = path.join(resultsDir, 'results-' + args.lane + '-phase' + args.phase + '.json');

  process.stdout.write('WO-12 lane driver\n');
  process.stdout.write('  lane:     ' + args.lane + '  (model=' + laneCfg.model + ', args="' + laneCfg.args + '")\n');
  process.stdout.write('  phase:    ' + args.phase + '\n');
  process.stdout.write('  key:      ' + keyPath + '\n');
  process.stdout.write('  briefs:   ' + briefsDir + '\n');
  process.stdout.write('  runner:   ' + runner + '\n');
  process.stdout.write('  results:  ' + resultsFile + '\n');
  process.stdout.write('  artifacts: ' + artifacts.length + ' (corpus order)\n\n');

  if (args.dryRun) {
    process.stdout.write('DRY RUN — nothing executed, no Quartermaster check, nothing billed.\n\n');
    artifacts.forEach((a, i) => {
      const wo = path.join(briefsDir, a.id + '.wo.txt');
      const er = path.join(briefsDir, a.id + '.er.txt');
      const head = a.kind === 'control' ? a.commit : '<materialized at run time (seeded, reproducible from base+patch)>';
      process.stdout.write('[' + (i + 1) + '/' + artifacts.length + '] ' + a.id + '  (' + a.kind +
        (a.variant ? ', variant ' + a.variant : '') + ')\n');
      const cmd = ['node'].concat(
        [runner, '--work-order', wo, '--executor-report', er, '--base-ref', a.base, '--head-ref', head, '--timeout-ms', String(timeoutMs)]
          .map(quoteForDisplay)
      );
      process.stdout.write('    ' + cmd.join(' ') + '\n');
      process.stdout.write('    env: ORCHESTRA_REVIEW_MODEL=' + laneCfg.model + ' ORCHESTRA_REVIEW_ARGS="' + laneCfg.args + '"\n');
      process.stdout.write('    cwd: <throwaway clone of ' + repoRoot + '>\n');
    });
    process.stdout.write('\nRe-run with a Green-for-OU Quartermaster read and --yes to execute.\n');
    return;
  }

  const qm = checkQuartermaster(repoRoot);
  if (qm.ouFailClosed && !args.overrideP0) {
    fail(
      'refusing: Quartermaster --state shows OU fail-closed/REFUSED (see output above). Record a fresh OU ' +
      'reading (node quartermaster/quartermaster.js --record OU <fraction> --source "...") or pass ' +
      '--override-p0 "<reason>" (OWNER USE ONLY) to proceed anyway.'
    );
  }
  if (!args.yes) {
    fail(
      'refusing to run: ' + artifacts.length + ' real cross-vendor review(s) on lane ' + args.lane +
      ' phase ' + args.phase + ' bill real OpenAI allowance. Run with --dry-run first, then add --yes to spend it.'
    );
  }

  const cloneParent = args.cloneRoot ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-lane-'));
  const cloneTarget = args.cloneRoot ? path.resolve(args.cloneRoot) : cloneParent;
  const { cloneDir } = buildCorpus.ensureClone(repoRoot, cloneTarget);

  artifacts.forEach((a, i) => {
    process.stdout.write('[' + (i + 1) + '/' + artifacts.length + '] ' + a.id + ' ...\n');
    const wo = readBrief(path.join(briefsDir, a.id + '.wo.txt'), 'work order', a.id);
    const er = readBrief(path.join(briefsDir, a.id + '.er.txt'), 'executor report', a.id);
    const mat = buildCorpus.materializeArtifact(a, cloneDir, patchesDir);

    const attempts = [];
    let attempt = runOneAttempt(runner, wo, er, mat.base, mat.head, mat.cloneDir, timeoutMs, laneCfg);
    attempts.push(attempt);
    process.stdout.write('    attempt 1: ' + attempt.status + ' / ' + attempt.verdict + '  (' + fmtMs(attempt.wallMs) + ')\n');
    if (attempt.status === 'UNAVAILABLE') {
      const retryAttempt = runOneAttempt(runner, wo, er, mat.base, mat.head, mat.cloneDir, timeoutMs, laneCfg);
      attempts.push(retryAttempt);
      process.stdout.write('    attempt 2 (retry): ' + retryAttempt.status + ' / ' + retryAttempt.verdict + '  (' + fmtMs(retryAttempt.wallMs) + ')\n');
    }

    const record = {
      id: a.id, base: mat.base, head: mat.head, lane: args.lane, phase: args.phase,
      variant: a.variant || null, attempts,
    };
    if (args.overrideP0) record.p0Override = args.overrideP0;
    const total = appendResult(resultsFile, record);
    process.stdout.write('    -> appended (' + total + ' record(s) now in ' + path.basename(resultsFile) + ')\n');
  });

  process.stdout.write('\ndone: ' + artifacts.length + ' artifact(s), results in ' + resultsFile + '\n');
}

module.exports = { LANES, parseArgs, checkQuartermaster, resolveQmCommand, resolveRunner, runOneAttempt, appendResult };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    fail((e && e.message) || String(e));
  }
}
