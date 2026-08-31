#!/usr/bin/env node
/**
 * WO-12 lane driver — protocol §2.4 (lanes), §2.6 (phases), §4 (evidence layout).
 *
 *   node run-lane.js --lane <X-Sol|X-Terra> --phase <0|1|2|3>
 *       [--dry-run] [--yes] [--timeout-ms <n>] [--override-p0 "<reason>"]
 *       [--draw-per-review <fraction>]
 *       [--key <path>] [--briefs-dir <dir>] [--patches-dir <dir>]
 *       [--source-repo <dir>] [--clone-root <dir>] [--run-clone-root <dir>]
 *       [--results-dir <dir>] [--runner <path>]
 *
 * Drives one X-lane (`orchestra-review.js`, i.e. the Codex/OpenAI engine) over
 * one phase's worth of SDC artifacts (protocol §2.6), SEQUENTIALLY, on
 * purpose — same reasoning as probes/orchestra-probe-review.js: this measures
 * one lane's own draw and throughput, and parallel runs would contend for the
 * same install and the same allowance pool.
 *
 * Artifacts assigned to `--phase` are dispatched in an INTERLEAVED run order —
 * sorted by `sha256(phase + ':' + id)` — not in corpus order (round-2,
 * Anthropic R0 MINOR 2: `base-pool.json` lays every phase out seeds-first, so
 * corpus order ran all of a phase's seeds before any of its controls). The
 * order is deterministic, identical on both X-lanes, and independent of
 * seeded/control; it is printed in full before anything runs, `--dry-run`
 * included. Every record still carries its `id`, from which score.js recovers
 * the corpus position, plus a `runIndex` for the streak rule. See
 * phaseRunOrder().
 *
 * For each artifact in that order:
 *   1. read the GENERATED brief pair `corpus/briefs/<id>.wo.txt` /
 *      `<id>.er.txt` verbatim — the 12h packet variant is already baked into
 *      those files by `assemble-key.js`; this script reads them, never edits
 *      or generates them;
 *   2. materialize the artifact via build-corpus.js's `materializeArtifact`
 *      (one shared BUILD clone for the whole phase, see --clone-root) and
 *      take the per-artifact SANITIZED RUN CLONE it returns (--run-clone-root)
 *      — protocol §2.1(ii): the runner's cwd is a repository stripped of every
 *      ref, remote, reflog and unreachable object, so `wo12/` and `key.json`
 *      are unreachable from `.git` and not merely absent from the worktree.
 *      The build clone is never handed to a lane;
 *   3. run `orchestra-review.js --work-order .. --executor-report ..
 *      --base-ref <base> --head-ref <head> --timeout-ms <n>` with cwd = the
 *      SANITIZED clone and the lane's env (protocol §2.4 table, LANES below) —
 *      REAL COST: every non-dry, non-override run bills real OpenAI
 *      allowance, so this refuses without BOTH a POSITIVE Quartermaster
 *      signal for OU and --yes.
 *
 * Retries: exactly one, on a REVIEW_UNAVAILABLE verdict (the runner's own
 * production default already retries internally; this is run-lane's OWN
 * retry on top, matching the protocol's "each UNAVAILABLE is retried once,
 * the retry recorded" — §2.5 Stability). Both attempts are kept, verbatim.
 *
 * Phase 0 stop condition (§2.6, table row "0 — pilot"): more than 2 final
 * UNAVAILABLE results halts the phase and escalates. It is enforced here, in
 * the loop, so a fault storm cannot masquerade as a lane result.
 *
 * Output: appends one record per artifact to
 * `results-<lane>-phase<n>.json` (default: this directory) — an array of
 *   { id, base, head, lane, phase, variant, expectedModel,
 *     attempts: [ { wallMs, verdict, status, engineHeader, integrityWarning, stdout } ] }
 * written after EVERY artifact (not just at the end), via a temp file and an
 * atomic rename, so a crash mid-phase loses at most the artifact in flight and
 * never the ones already reviewed. An existing results file that does not
 * parse as a JSON array is a REFUSAL, never an overwrite (round-2, R0 MAJOR 2:
 * the round-1 code reset a truncated file to `[]` and silently destroyed every
 * prior billed review). `stdout` is the runner's combined stdout+stderr, kept
 * VERBATIM — nothing here summarizes or elides a real verdict.
 *
 * ------------------------------------------------------------------ P0 gate
 *
 * Before a REAL run (never for --dry-run — nothing is spent there), this runs
 * `node quartermaster/quartermaster.js --state`, prints its output (both
 * streams, exit code) VERBATIM regardless of outcome, and then PROCEEDS ONLY
 * ON A POSITIVE SIGNAL (round 2, R0 CRITICAL 1 — the round-1 gate proceeded
 * unless it could prove an OU refusal by string match, so a Quartermaster that
 * could not even be loaded read as OU-clear and the lane billed the review).
 * Every one of these must hold, or the lane refuses with the Quartermaster's
 * own output quoted:
 *
 *   - the command spawned at all (no `r.error`);
 *   - it exited 0 — not non-zero, and not `null` (a signal death);
 *   - its stdout parses as JSON — `--state` prints exactly
 *     `JSON.stringify(bucketState())`, and anything else is not evidence;
 *   - that JSON carries an `OU` bucket whose `state.remainingFraction` is a
 *     number in [0,1] (the four-key contract `bucketState()` publishes:
 *     `{state:{remainingFraction, reserveBreached?, throttleObserved?,
 *     exhausted?}, belowReserve, quartermasterConfirmation?}`);
 *   - the ladder state of that bucket — computed with the ROUTER's own
 *     `poolState()` and `castings.poolStateLadder`, never a copy of the
 *     thresholds — is `Green`; or it is `Amber` AND the same JSON carries
 *     `quartermasterConfirmation: true` for OU, which is exactly the
 *     currently-valid Amber-arm confirmation of §5.5/§2.6 (the Quartermaster
 *     re-validates that flag against live evidence on every call and omits it
 *     the moment the confirmation is void, so its presence in this JSON IS
 *     the "owner confirmation" the protocol asks for). Orange, Red, Exhausted,
 *     an Amber without the flag, or a router that cannot be loaded: refuse.
 *
 * §2.6's projected-draw arm: `--draw-per-review <fraction>` is REQUIRED for
 * every phase ≥ 1 (phase 0 is the run that MEASURES it). The phase refuses
 * unless `remainingFraction − (projected reviews × draw) ≥ requiredReserve`.
 * Projected reviews are counted for the WHOLE PHASE across both X-lanes
 * (artifacts × 2), not for this lane alone — §2.6's "the phase's projected
 * draw ... leaving OU above the P15 reserve" is a statement about the phase,
 * and the conservative reading is the only fail-closed one. `requiredReserve`
 * is read from the state JSON (top level, or on the OU bucket); if it is not
 * there, the phase REFUSES and says so rather than inventing a floor.
 *
 * `--override-p0 "<reason>"` (OWNER USE ONLY) is the only way past any of the
 * above. It prints a loud banner, stamps the reason and a timestamp onto every
 * results record, AND appends a line to `wo12/p0-overrides.log` — a durable
 * ledger that survives a lost or truncated results file (round-2 MINOR).
 *
 * `WO12_QM_CMD` (env, whitespace-split into argv) replaces the quartermaster
 * command entirely — for tests only, so a stub can stand in for the real
 * substrate without touching real pool-reading files.
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
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const buildCorpus = require(path.join(HERE, 'build-corpus.js'));

// Protocol §2.4 lane table, verbatim.
const LANES = {
  'X-Sol': { model: 'gpt-5.6-sol', args: '-c model_reasoning_effort=high' },
  'X-Terra': { model: 'gpt-5.6-terra', args: '-c model_reasoning_effort=medium' },
};

const DEFAULT_TIMEOUT_MS = 600000; // matches orchestra-review.js's own default
// NOTE (round-2 nit): these two mirror `orchestra-review.js`'s OWN internal
// defaults in a second file, so a change there silently desynchronizes the
// outer timeout computed in runOneAttempt(). They are deliberately generous —
// the outer kill exists only to stop a wedged process, never to cut a review
// short — but if orchestra-review.js's retry count or default timeout ever
// moves, these move with it.
const RUNNER_OWN_RETRIES = 1;
const OUTER_MARGIN_MS = 180000;

// §2.6, phase 0 row: "Stop condition: >2 UNAVAILABLE in either lane → halt,
// escalate the fault, do not proceed".
const PHASE0_MAX_UNAVAILABLE = 2;

/**
 * The RUN ORDER within one phase (round-2, Anthropic R0 MINOR 2).
 *
 * `base-pool.json`'s allocation lays every phase out with its seeded slots
 * FIRST and its controls after (phase 0: seeds at 0-5, controls 6-11; phases
 * 1-3: seeds 0-7, controls 8-23), and §2.6 fixes run order as corpus order —
 * so every phase used to run all of its seeds before any of its controls. The
 * ordering is visible to an adjudicator, to the owner reading results in file
 * order, and to any lane ever run with carry-over context. The review asked for
 * the two populations to be interleaved.
 *
 * The corpus itself is sealed and is not this script's to reorder, so the
 * interleaving happens HERE, at dispatch: artifacts are sorted by
 * `sha256(phase + ':' + id)`. That is
 *   - DETERMINISTIC — the same phase always produces the same order, on every
 *     machine, on a re-run, and after a crash-resume;
 *   - IDENTICAL ACROSS LANES — the key is the phase and the id, never the lane,
 *     so X-Sol and X-Terra review the same artifacts in the same sequence and
 *     any order effect lands on both arms equally;
 *   - INDEPENDENT OF KIND — the digest knows nothing about seeded/control, so
 *     the two populations interleave rather than block.
 * Ties (impossible in practice, but a total order must be total) break on the
 * id, so the sort never depends on the input array's own order.
 *
 * Nothing downstream depends on dispatch order: every results record carries
 * its `id`, and score.js resolves each id back to its CORPUS position from
 * key.json. `runIndex` is recorded alongside so §3.1 item 6's UNAVAILABLE
 * STREAK is computed over the sequence actually executed rather than over a
 * corpus order the lane never ran in.
 */
function phaseRunOrder(artifacts, phase) {
  return artifacts
    .map((a) => ({ a, k: crypto.createHash('sha256').update(String(phase) + ':' + a.id).digest('hex') }))
    .sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : 0)))
    .map((e) => e.a);
}

/**
 * §2.6 orders the phases: 0 is the pilot that measures the per-review draw
 * every later phase's projected-draw check depends on, and "artifacts are never
 * reordered after a phase runs". The cross-vendor R0 lane
 * (`roster/wo12-r0-review-openai-2.md`, MAJOR at run-lane.js:382) found that
 * "arbitrary later phases can also run first" — phase 3 could be dispatched
 * before phase 0 existed, spending the allowance on a pipeline nothing had
 * validated and with no measured draw to project from.
 *
 * Refuses unless every EARLIER phase has a complete results file for this lane.
 * Returns {ok, refusal}.
 */
function checkPhaseOrder(lane, phase, key, resultsDir) {
  for (let prior = 0; prior < phase; prior++) {
    const expected = key.artifacts.filter((a) => a.phase === prior);
    if (!expected.length) continue;
    const file = path.join(resultsDir, 'results-' + lane + '-phase' + prior + '.json');
    if (!fs.existsSync(file)) {
      return { ok: false, refusal: 'phase ' + phase + ' cannot run before phase ' + prior + ' on lane ' + lane + ': ' + file + ' does not exist. §2.6 runs the phases in order — phase 0 is the pilot that measures the per-review draw every later phase\'s projected-draw check needs.' };
    }
    let recs;
    try { recs = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { return { ok: false, refusal: 'phase ' + prior + '\'s results file (' + file + ') does not parse: ' + e.message + '. Repair it before running phase ' + phase + '.' }; }
    if (!Array.isArray(recs)) return { ok: false, refusal: 'phase ' + prior + '\'s results file (' + file + ') is not a JSON array.' };
    const seen = new Set(recs.map((r) => r && r.id));
    const missing = expected.filter((a) => !seen.has(a.id)).map((a) => a.id);
    if (missing.length) {
      return { ok: false, refusal: 'phase ' + prior + ' is INCOMPLETE on lane ' + lane + ' (' + missing.length + ' of ' + expected.length + ' artifact(s) unrecorded: ' + missing.slice(0, 6).join(', ') + (missing.length > 6 ? ', …' : '') + '). §2.6 runs the phases in order; finish phase ' + prior + ' first.' };
    }
  }
  return { ok: true, refusal: null };
}

const OVERRIDE_LOG_BASENAME = 'p0-overrides.log';

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
    '      [--draw-per-review <fraction>]',
    '      [--key <path>] [--briefs-dir <dir>] [--patches-dir <dir>]',
    '      [--source-repo <dir>] [--clone-root <dir>] [--run-clone-root <dir>]',
    '      [--results-dir <dir>] [--runner <path>]',
    '',
    'lanes: ' + Object.keys(LANES).join(' | '),
    '--override-p0 is OWNER USE ONLY: it records the given reason into the',
    '  results file AND into wo12/p0-overrides.log INSTEAD OF refusing on a P0',
    '  gate that did not return a positive OU signal. It never bypasses --yes.',
    '--draw-per-review <fraction> is REQUIRED for phases 1-3 (§2.6): the phase',
    '  refuses unless remainingFraction - (projected reviews x draw) is still at',
    '  or above the Quartermaster\'s requiredReserve. Measure it in phase 0.',
    '--dry-run prints every command that WOULD run, with the right per-lane',
    '  env, and touches nothing — no Quartermaster check, no clone, no spend.',
    '  It still enforces §2.6 PHASE ORDER: a dry-run of phase N refuses, exactly',
    '  as the real run would, unless every earlier phase is completely recorded.',
    '--yes is REQUIRED for a real run (each artifact bills real OpenAI',
    '  allowance).',
  ].join('\n');
}

function parseArgs(argv) {
  const out = {
    lane: null, phase: null, dryRun: false, yes: false, timeoutMs: null,
    overrideP0: null, drawPerReview: null, key: null, briefsDir: null, patchesDir: null,
    sourceRepo: null, cloneRoot: null, runCloneRoot: null, resultsDir: null, runner: null,
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
    } else if (a === '--draw-per-review') {
      const raw = argv[++i];
      out.drawPerReview = Number(raw);
      if (!Number.isFinite(out.drawPerReview) || out.drawPerReview < 0 || out.drawPerReview > 1) {
        fail('--draw-per-review must be a fraction in [0,1] (got ' + JSON.stringify(raw) + ')');
      }
    } else if (a === '--override-p0') out.overrideP0 = argv[++i];
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--briefs-dir') out.briefsDir = argv[++i];
    else if (a === '--patches-dir') out.patchesDir = argv[++i];
    else if (a === '--source-repo') out.sourceRepo = argv[++i];
    else if (a === '--clone-root') out.cloneRoot = argv[++i];
    else if (a === '--run-clone-root') out.runCloneRoot = argv[++i];
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
 * Loads the ROUTER's own ladder classifier. The router owns the ladder and
 * the thresholds (`castings.poolStateLadder`), the Quartermaster defers to it,
 * and so does this file — a second copy of `amberBelow: 0.4` in a third module
 * is exactly how a gate drifts out from under the protocol it enforces.
 * Returns null (and the gate then REFUSES) if it cannot be loaded.
 */
function loadLadder(ladderRoot) {
  try {
    const router = require(path.join(ladderRoot, 'router', 'router.js'));
    const castings = require(path.join(ladderRoot, 'router', 'castings.json'));
    if (typeof router.poolState !== 'function' || !castings || !castings.poolStateLadder) return null;
    return { poolState: router.poolState, ladder: castings.poolStateLadder };
  } catch (e) {
    return null;
  }
}

// The ladder belongs to the HARNESS running the lane, not to the repository
// being cloned for the corpus: `--source-repo` can legitimately point at a
// different checkout (or, in the suite, at a synthetic fixture repo with no
// router/ at all), while `router/castings.json` is part of this tooling's own
// tree. Resolved from where these scripts actually live.
function toolingRepoRoot() {
  try { return buildCorpus.detectRepoRoot(); } catch (e) { return null; }
}

/**
 * Reads `requiredReserve` out of a `--state` JSON. `bucketState()` publishes
 * the router's four-key contract and nothing else, so this looks in the two
 * places a reserve figure could honestly appear — the top level of the
 * document, or the OU bucket itself — and reports its ABSENCE rather than
 * substituting a default. Inventing a floor here would be inventing the P15
 * reserve, which is the one number §2.6's projected-draw arm exists to respect.
 */
function readRequiredReserve(parsed) {
  const candidates = [parsed && parsed.requiredReserve, parsed && parsed.OU && parsed.OU.requiredReserve];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= 1) return c;
  }
  return null;
}

/**
 * Runs `quartermaster --state`, prints it VERBATIM (both streams + exit code),
 * and answers ONE question with a POSITIVE signal or a refusal: may this lane
 * spend on OU right now (protocol §2.6)? See the module header for the full
 * list of conditions. Returns
 *   { ok, refusal, quoted, exitCode, parsed, ouLadderState, remainingFraction,
 *     requiredReserve, confirmed }
 * where `ok === true` means, and only means, that every condition held.
 */
function checkQuartermaster(repoRoot, opts) {
  opts = opts || {};
  const { cmd, args } = resolveQmCommand(repoRoot);
  const fullArgs = args.concat(['--state']);
  const r = spawnSync(cmd, fullArgs, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  const quoted = [
    '--- quartermaster --state (verbatim) ---',
    '$ ' + [cmd].concat(fullArgs).join(' '),
    stdout ? stdout.replace(/\s+$/, '') : '',
    stderr ? stderr.replace(/\s+$/, '') : '',
    'exit code: ' + (r.error ? '(never ran: ' + r.error.message + ')' : (r.status === null ? 'null (signal ' + r.signal + ')' : r.status)),
    '--- end quartermaster output ---',
  ].filter((l) => l !== '').join('\n');

  if (!opts.quiet) process.stdout.write(quoted + '\n\n');

  const refuse = (why) => ({
    ok: false, refusal: why, quoted, exitCode: r.status, parsed: null,
    ouLadderState: null, remainingFraction: null, requiredReserve: null, confirmed: false,
  });

  if (r.error) return refuse('the quartermaster command (' + cmd + ') could not be run at all: ' + r.error.message);
  if (r.status === null) return refuse('the quartermaster command died on signal ' + r.signal + ' — no state was produced');
  if (r.status !== 0) return refuse('`quartermaster --state` exited ' + r.status + ' (it fails the WHOLE call closed on ANY bucket\'s problem; a non-zero exit is never evidence that OU is clear)');

  let parsed;
  try { parsed = JSON.parse(stdout); }
  catch (e) { return refuse('`quartermaster --state` exited 0 but its stdout is not JSON (' + e.message + ') — an exit code alone is not evidence'); }
  if (!parsed || typeof parsed !== 'object') return refuse('`quartermaster --state` printed JSON that is not an object');
  const ou = parsed.OU;
  if (!ou || typeof ou !== 'object' || !ou.state || typeof ou.state !== 'object') {
    return refuse('the `--state` JSON carries no usable `OU` bucket (expected {state:{remainingFraction,...}, belowReserve, quartermasterConfirmation?})');
  }
  const remainingFraction = ou.state.remainingFraction;
  if (typeof remainingFraction !== 'number' || !Number.isFinite(remainingFraction) || remainingFraction < 0 || remainingFraction > 1) {
    return refuse('OU.state.remainingFraction is not a number in [0,1] (got ' + JSON.stringify(remainingFraction) + ')');
  }

  const ladderRoot = opts.ladderRoot || toolingRepoRoot() || repoRoot;
  const ladder = loadLadder(ladderRoot);
  if (!ladder) {
    return refuse('cannot load the router\'s own ladder (' + path.join(ladderRoot, 'router', 'router.js') +
      ' / castings.json) to classify OU\'s state — the gate refuses rather than classifying it with a private copy of the thresholds');
  }
  let ouLadderState;
  try { ouLadderState = ladder.poolState(ou.state, ladder.ladder); }
  catch (e) { return refuse('the router refused to classify OU\'s published state: ' + e.message); }

  const confirmed = ou.quartermasterConfirmation === true;
  const base = {
    quoted, exitCode: r.status, parsed, ouLadderState, remainingFraction,
    requiredReserve: readRequiredReserve(parsed), confirmed,
  };

  if (ouLadderState === 'Green') return Object.assign({ ok: true, refusal: null }, base);
  if (ouLadderState === 'Amber') {
    if (confirmed) return Object.assign({ ok: true, refusal: null }, base);
    return Object.assign({
      ok: false,
      refusal: 'OU is Amber (' + (remainingFraction * 100).toFixed(1) + '% remaining) and the `--state` JSON carries no ' +
        '`quartermasterConfirmation: true` for OU. §2.6: "Amber requires the owner\'s confirmation per §5.5". Record one ' +
        '(node quartermaster/quartermaster.js --confirm OU --dispatch-ref "WO-12 phase <n>") and re-run; the Quartermaster ' +
        're-validates a confirmation against live evidence on every call, so a confirmation that has been superseded, ' +
        'outlived its reading, or been overtaken by a throttle will not appear here.',
    }, base);
  }
  return Object.assign({
    ok: false,
    refusal: 'OU\'s ladder state is ' + ouLadderState + ' (' + (remainingFraction * 100).toFixed(1) + '% remaining). §2.6 starts a phase only on Green, or on Amber with the owner\'s confirmation.',
  }, base);
}

/**
 * §2.6's projected-draw arm. Returns {ok, refusal, projectedReviews,
 * projectedRemaining}. `drawPerReview` must already have been required by the
 * caller for phases >= 1.
 */
function checkProjectedDraw(qm, phase, artifactCount, drawPerReview, laneCount) {
  const projectedReviews = artifactCount * laneCount;
  if (phase === 0) {
    return { ok: true, refusal: null, projectedReviews, projectedRemaining: null, skipped: 'phase 0 is the run that MEASURES the per-review draw (§2.6)' };
  }
  if (typeof drawPerReview !== 'number') {
    return {
      ok: false, projectedReviews, projectedRemaining: null,
      refusal: '--draw-per-review <fraction> is REQUIRED for phase ' + phase + ' (§2.6: "the phase\'s projected draw — ' +
        'per-review draw from phase 0 x reviews — leaving OU above the P15 reserve"). Take it from phase 0\'s measured ' +
        'bucket-reading delta and pass it.',
    };
  }
  if (qm.requiredReserve === null) {
    return {
      ok: false, projectedReviews, projectedRemaining: null,
      refusal: 'the `--state` JSON carries no `requiredReserve` figure (neither at the top level nor on the OU bucket), so ' +
        'the projected-draw check CANNOT be computed. `bucketState()` publishes the router\'s four-key contract — ' +
        '{remainingFraction, reserveBreached?, throttleObserved?, exhausted?} plus belowReserve — which says WHETHER the ' +
        'reserve is breached but never what it IS. This refuses rather than inventing a P15 floor: either have ' +
        '`--state` publish `requiredReserve` (analyze() already computes it), or run this phase under ' +
        '--override-p0 "<reason>" with the owner\'s own arithmetic recorded in the reason.',
    };
  }
  const projectedRemaining = qm.remainingFraction - projectedReviews * drawPerReview;
  if (projectedRemaining < qm.requiredReserve) {
    return {
      ok: false, projectedReviews, projectedRemaining,
      refusal: 'projected draw breaches the reserve: OU is at ' + qm.remainingFraction.toFixed(4) + ', this phase projects ' +
        projectedReviews + ' review(s) x ' + drawPerReview + ' = ' + (projectedReviews * drawPerReview).toFixed(4) +
        ', leaving ' + projectedRemaining.toFixed(4) + ' — below the required reserve ' + qm.requiredReserve.toFixed(4) +
        '. §2.6: a pass that would push a bucket under the P15 reserve is not run.',
    };
  }
  return { ok: true, refusal: null, projectedReviews, projectedRemaining };
}

// ------------------------------------------------------------------- I/O

function loadKey(keyPath) {
  return buildCorpus.loadKey(keyPath);
}

function readBrief(file, label, id) {
  if (!fs.existsSync(file)) {
    fail('missing generated ' + label + ' for artifact ' + id + ': ' + file +
      ' (run-lane.js never generates briefs — assemble-key.js must generate and commit them first)');
  }
  return file;
}

/**
 * Appends one record, durably. Round-2, R0 MAJOR 2: the round-1 version reset
 * an unparseable results file to `[]`, so a crash during `writeFileSync`
 * converted a partial write into the silent loss of every review already billed
 * in that phase — and of the `p0Override` stamps that were the only record an
 * owner override happened. Now:
 *   - an existing file that does not parse as a JSON array is a REFUSAL
 *     (exit 1, nothing written, the operator told exactly which file to look
 *     at and where the side-file is);
 *   - the write itself goes to `<file>.tmp` and is renamed over the target,
 *     so the target is never observed half-written in the first place.
 * Throws (rather than fail()ing) so callers and the suite can both see it.
 */
function appendResult(resultsFile, record) {
  let arr = [];
  if (fs.existsSync(resultsFile)) {
    let raw;
    try { raw = fs.readFileSync(resultsFile, 'utf8'); }
    catch (e) {
      const err = new Error('cannot read the existing results file ' + resultsFile + ': ' + e.message + ' — REFUSING to overwrite it.');
      err.wo12ResultsCorrupt = true;
      throw err;
    }
    let parsedOk = false;
    try { arr = JSON.parse(raw); parsedOk = Array.isArray(arr); }
    catch (e) { parsedOk = false; }
    if (!parsedOk) {
      const sideFile = resultsFile + '.corrupt-' + new Date().toISOString().replace(/[:.]/g, '-');
      try { fs.copyFileSync(resultsFile, sideFile); } catch (e) { /* best effort */ }
      const err = new Error(
        'the existing results file ' + resultsFile + ' does not parse as a JSON array — REFUSING to overwrite it, because ' +
        'that file is the only record of the reviews already billed in this phase (a truncated file is what a crash ' +
        'mid-write looks like, not a reason to start over). A copy was side-filed at ' + sideFile + '. Repair or move the ' +
        'original, then re-run; the artifacts already recorded in it must not be re-billed.'
      );
      err.wo12ResultsCorrupt = true;
      throw err;
    }
  }
  arr.push(record);
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  const tmp = resultsFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(arr, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, resultsFile);
  return arr.length;
}

/**
 * The durable half of an owner override (round-2 MINOR): one append-only line
 * per overridden phase, next to the scripts, independent of any results file.
 */
function appendOverrideLog(logFile, entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, line, 'utf8');
  return logFile;
}

function fmtMs(msVal) {
  if (msVal >= 60000) return (msVal / 60000).toFixed(1) + 'm';
  return (msVal / 1000).toFixed(1) + 's';
}

function quoteForDisplay(a) {
  return /[\s"]/.test(a) ? '"' + String(a).replace(/"/g, '\\"') + '"' : a;
}

// ---------------------------------------------------------------- one run

/**
 * Classifies the runner's outcome. Round-2, R0 MAJOR 10: UNAVAILABLE is read
 * from the VERDICT line's LEADING TOKEN only. The round-1 code matched
 * /UNAVAILABLE/i anywhere in the line, so a legitimate
 * `VERDICT: APPROVE — the cache path is correct when the engine is unavailable`
 * was classified UNAVAILABLE, billed a second review, and counted against
 * §3.1 gate 6's budget and streak rule. The runner's own token is
 * `REVIEW_UNAVAILABLE` (orchestra-review.js:2303); a bare leading
 * `UNAVAILABLE` is accepted too for a hand-transcribed lane.
 */
function classifyVerdict(verdict) {
  if (!verdict) return null;
  const token = String(verdict).trim().split(/[\s,;:—–-]+/)[0] || '';
  return /^(REVIEW_UNAVAILABLE|UNAVAILABLE)$/i.test(token) ? 'UNAVAILABLE' : 'COMPLETED';
}

/**
 * Extracts the served-engine header. Round-2, R0 MAJOR 1: the round-1 fallback
 * was /^.*\bmodel:\s*\S.*$/im, which matched ANY line containing "model:"
 * anywhere — including reviewer prose about the diff — and so fabricated an
 * identity that score.js then counted as "identity known". The fallback is now
 * anchored: a line that IS a `model:` / `served_model:` field, nothing else.
 */
function extractEngineHeader(text) {
  const engineLine = /^REVIEW ENGINE:.*$/m.exec(text);
  if (engineLine) return engineLine[0].trim();
  const fieldLine = /^[ \t]*(?:served[_ ]model|model)[ \t]*:[ \t]*\S[^\n]*$/im.exec(text);
  return fieldLine ? fieldLine[0].trim() : null;
}

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

  const engineHeader = extractEngineHeader(stdout);

  // Round-2, R0 MAJOR 9: scanned across BOTH streams and the verdict body.
  // The runner writes its tree audit to whichever stream is at hand, and
  // `stdoutVerbatim` already concatenates them for the record — the detector
  // has to read the same thing the record keeps, or §3.1 gate 4 ("no source
  // mutation") reads clean on a stderr-borne warning.
  const integrityWarning = /INTEGRITY WARNING/.test(stdoutVerbatim) || /INTEGRITY WARNING/.test(verdict || '');

  let status;
  if (r.error) status = 'SPAWN_FAILED (' + r.error.message + ')';
  else if (r.signal) status = 'KILLED_AT_OUTER_TIMEOUT (' + r.signal + ')';
  else if (!verdict) status = 'NO_VERDICT_LINE';
  else status = classifyVerdict(verdict);

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
  const corpusOrder = key.artifacts.filter((a) => a.phase === args.phase);
  if (!corpusOrder.length) fail('no artifacts in ' + keyPath + ' with phase ' + args.phase);
  // Interleaved, deterministic, lane-independent dispatch order — see
  // phaseRunOrder() above (round-2, Anthropic R0 MINOR 2).
  const artifacts = phaseRunOrder(corpusOrder, args.phase);

  const resultsFile = path.join(resultsDir, 'results-' + args.lane + '-phase' + args.phase + '.json');

  process.stdout.write('WO-12 lane driver\n');
  process.stdout.write('  lane:     ' + args.lane + '  (model=' + laneCfg.model + ', args="' + laneCfg.args + '")\n');
  process.stdout.write('  phase:    ' + args.phase + '\n');
  process.stdout.write('  key:      ' + keyPath + '\n');
  process.stdout.write('  briefs:   ' + briefsDir + '\n');
  process.stdout.write('  runner:   ' + runner + '\n');
  process.stdout.write('  results:  ' + resultsFile + '\n');
  process.stdout.write('  artifacts: ' + artifacts.length + ' (dispatched in the interleaved run order below, not corpus order)\n');
  process.stdout.write('  run order: sha256(phase + ":" + id) — deterministic, identical on both X-lanes, independent of seeded/control\n\n');
  {
    const seededPositions = artifacts.map((a, i) => (a.kind === 'seeded' ? i : -1)).filter((i) => i >= 0);
    const controlPositions = artifacts.map((a, i) => (a.kind === 'control' ? i : -1)).filter((i) => i >= 0);
    process.stdout.write('RUN ORDER (phase ' + args.phase + '):\n');
    artifacts.forEach((a, i) => {
      process.stdout.write('  ' + String(i + 1).padStart(3, ' ') + '. ' + a.id + '  ' + a.kind +
        (a.variant ? ' ' + a.variant : '') + '   [corpus position ' + (corpusOrder.indexOf(a) + 1) + '/' + corpusOrder.length + ']\n');
    });
    process.stdout.write('  seeded at run positions: ' + (seededPositions.map((i) => i + 1).join(', ') || '(none)') + '\n');
    process.stdout.write('  controls at run positions: ' + (controlPositions.map((i) => i + 1).join(', ') || '(none)') + '\n\n');
  }

  // Phase ORDER is checked BEFORE the dry-run branch, on purpose. It is not an
  // allowance question — it is whether this phase may run at all (§2.6), and
  // the answer is the same whether or not anything is about to be spent. A
  // dry-run that printed a full, plausible plan for phase 3 while phase 0 had
  // never run would be telling the operator to do something the real run is
  // going to refuse, which is exactly the wrong way round for a rehearsal.
  const order = checkPhaseOrder(args.lane, args.phase, key, resultsDir);
  if (!order.ok) fail('refusing (phase order, protocol §2.6):\n  ' + order.refusal);

  if (args.dryRun) {
    process.stdout.write('DRY RUN — nothing executed, no Quartermaster check, nothing billed.\n');
    process.stdout.write('(§2.6 phase order was checked and passed — a dry-run refuses out-of-order phases like a real run.)\n');
    if (args.overrideP0) {
      process.stdout.write('NOTE: --override-p0 is INERT under --dry-run — the P0 gate is not reached, nothing is spent,\n' +
        '      and no override is recorded in the results file or in ' + OVERRIDE_LOG_BASENAME + '.\n');
    }
    process.stdout.write('\n');
    artifacts.forEach((a, i) => {
      const wo = path.join(briefsDir, a.id + '.wo.txt');
      const er = path.join(briefsDir, a.id + '.er.txt');
      process.stdout.write('[' + (i + 1) + '/' + artifacts.length + '] ' + a.id + '  (' + a.kind +
        (a.variant ? ', variant ' + a.variant : '') + ')\n');
      if (a.kind === 'control') {
        const cmd = ['node'].concat(
          [runner, '--work-order', wo, '--executor-report', er, '--base-ref', a.base, '--head-ref', a.commit, '--timeout-ms', String(timeoutMs)]
            .map(quoteForDisplay)
        );
        process.stdout.write('    ' + cmd.join(' ') + '\n');
      } else {
        // Round-2 nit: a `<materialized at run time>` placeholder made the one
        // case an owner most wants to reproduce by hand the one case that could
        // not be copy-pasted. Print the two real commands instead.
        const mat = ['node', quoteForDisplay(path.join(HERE, 'build-corpus.js')), '--id', a.id,
          '--clone-root', '<build-clone>', '--run-clone-root', '<run-clone-root>'];
        process.stdout.write('    ' + mat.join(' ') + '        # prints {"head": "<HEAD>", "runCloneDir": "<CWD>"}\n');
        const cmd = ['node'].concat(
          [runner, '--work-order', wo, '--executor-report', er, '--base-ref', a.base, '--head-ref', '<HEAD>', '--timeout-ms', String(timeoutMs)]
            .map(quoteForDisplay)
        );
        process.stdout.write('    ' + cmd.join(' ') + '\n');
      }
      process.stdout.write('    env: ORCHESTRA_REVIEW_MODEL=' + laneCfg.model + ' ORCHESTRA_REVIEW_ARGS="' + laneCfg.args + '"\n');
      process.stdout.write('    cwd: <sanitized run clone of ' + repoRoot + ' — no refs, no remote, no reflog>\n');
    });
    process.stdout.write('\nRe-run with a Green-for-OU (or confirmed-Amber) Quartermaster read and --yes to execute.\n');
    return;
  }

  // Phase order was already checked above, ahead of the --dry-run branch, and
  // it is not overridable: running phase 3 first is not an allowance judgement
  // the owner can make on the spot, it is a protocol violation that would
  // invalidate the phase's own projected-draw arithmetic (§2.6).
  const qm = checkQuartermaster(repoRoot);
  const draw = checkProjectedDraw(qm, args.phase, artifacts.length, args.drawPerReview, Object.keys(LANES).length);

  if ((!qm.ok || !draw.ok) && !args.overrideP0) {
    fail(
      'refusing (P0 gate, protocol §2.6):\n  ' + (qm.ok ? draw.refusal : qm.refusal) +
      '\n\nThe Quartermaster output above is quoted verbatim. Record a fresh OU reading ' +
      '(node quartermaster/quartermaster.js --record OU <fraction> --source "...") or pass ' +
      '--override-p0 "<reason>" (OWNER USE ONLY) to proceed anyway.'
    );
  }
  // Printed BEFORE the --yes check so a `--dry-run`-then-`--yes` operator sees
  // the gate's own reading of OU on the run that refuses for want of --yes,
  // not only on the run that spends.
  process.stdout.write('P0: OU ' + (qm.ouLadderState || '(unclassified)') +
    (qm.remainingFraction === null ? '' : ' at ' + (qm.remainingFraction * 100).toFixed(1) + '%') +
    (qm.confirmed ? ', owner confirmation live' : '') +
    '; projected reviews this phase: ' + draw.projectedReviews +
    (draw.projectedRemaining === null ? (draw.skipped ? ' (' + draw.skipped + ')' : '') : ', projected remaining ' + draw.projectedRemaining.toFixed(4)) +
    '\n\n');

  if (!args.yes) {
    fail(
      'refusing to run: ' + artifacts.length + ' real cross-vendor review(s) on lane ' + args.lane +
      ' phase ' + args.phase + ' bill real OpenAI allowance. Run with --dry-run first, then add --yes to spend it.'
    );
  }

  let overrideStamp = null;
  if (args.overrideP0 && (!qm.ok || !draw.ok)) {
    const at = new Date().toISOString();
    overrideStamp = {
      reason: args.overrideP0, at, lane: args.lane, phase: args.phase,
      gateRefusal: qm.ok ? draw.refusal : qm.refusal,
      ouLadderState: qm.ouLadderState, remainingFraction: qm.remainingFraction,
      requiredReserve: qm.requiredReserve, drawPerReview: args.drawPerReview,
      projectedReviews: draw.projectedReviews,
    };
    const banner = '='.repeat(78);
    process.stdout.write(
      banner + '\n' +
      '  P0 GATE OVERRIDDEN — OWNER USE ONLY. REAL ALLOWANCE WILL BE SPENT.\n' +
      '  lane ' + args.lane + ', phase ' + args.phase + ', ' + artifacts.length + ' artifact(s)\n' +
      '  the gate said: ' + (qm.ok ? draw.refusal : qm.refusal) + '\n' +
      '  the owner\'s reason: ' + args.overrideP0 + '\n' +
      '  recorded at: ' + at + '\n' +
      banner + '\n\n'
    );
    const logFile = path.join(HERE, OVERRIDE_LOG_BASENAME);
    appendOverrideLog(logFile, overrideStamp);
    process.stdout.write('  ledgered in ' + logFile + '\n\n');
  } else if (args.overrideP0) {
    process.stdout.write('NOTE: --override-p0 was passed but the P0 gate PASSED on its own — nothing was overridden,\n' +
      '      and nothing is recorded as an override.\n\n');
  }

  const cloneParent = args.cloneRoot ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-lane-'));
  const cloneTarget = args.cloneRoot ? path.resolve(args.cloneRoot) : cloneParent;
  const { cloneDir } = buildCorpus.ensureClone(repoRoot, cloneTarget);
  const runCloneRoot = args.runCloneRoot
    ? path.resolve(args.runCloneRoot)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-run-'));
  const keyBlobSha = buildCorpus.keyBlobShaFor(repoRoot);

  let unavailableCount = 0;
  for (let i = 0; i < artifacts.length; i++) {
    const a = artifacts[i];
    process.stdout.write('[' + (i + 1) + '/' + artifacts.length + '] ' + a.id + ' ...\n');
    const wo = readBrief(path.join(briefsDir, a.id + '.wo.txt'), 'work order', a.id);
    const er = readBrief(path.join(briefsDir, a.id + '.er.txt'), 'executor report', a.id);
    const mat = buildCorpus.materializeArtifact(a, cloneDir, patchesDir, {
      keyBlobSha, runCloneDir: path.join(runCloneRoot, a.id),
    });
    if (!mat.runCloneDir) fail(a.id + ': build-corpus produced no sanitized run clone — refusing to hand a lane the build clone.');

    const attempts = [];
    let attempt = runOneAttempt(runner, wo, er, mat.base, mat.head, mat.runCloneDir, timeoutMs, laneCfg);
    attempts.push(attempt);
    process.stdout.write('    attempt 1: ' + attempt.status + ' / ' + attempt.verdict + '  (' + fmtMs(attempt.wallMs) + ')\n');
    if (attempt.status === 'UNAVAILABLE') {
      const retryAttempt = runOneAttempt(runner, wo, er, mat.base, mat.head, mat.runCloneDir, timeoutMs, laneCfg);
      attempts.push(retryAttempt);
      process.stdout.write('    attempt 2 (retry): ' + retryAttempt.status + ' / ' + retryAttempt.verdict + '  (' + fmtMs(retryAttempt.wallMs) + ')\n');
    }

    const record = {
      id: a.id, base: mat.base, head: mat.head, lane: args.lane, phase: args.phase,
      variant: a.variant || null, expectedModel: laneCfg.model,
      // The CORPUS position is recovered from `id` against key.json, so
      // nothing is lost by dispatching out of corpus order. `runIndex` is the
      // sequence actually executed — what §3.1 item 6's UNAVAILABLE streak has
      // to be measured over.
      runIndex: i, attempts,
    };
    if (overrideStamp) record.p0Override = overrideStamp;
    const total = appendResult(resultsFile, record);
    process.stdout.write('    -> appended (' + total + ' record(s) now in ' + path.basename(resultsFile) + ')\n');

    if (attempts[attempts.length - 1].status === 'UNAVAILABLE') unavailableCount++;
    if (args.phase === 0 && unavailableCount > PHASE0_MAX_UNAVAILABLE) {
      fail(
        'HALTING phase 0 (§2.6 stop condition): ' + unavailableCount + ' final UNAVAILABLE result(s) on lane ' + args.lane +
        ', more than the 2 the pilot tolerates. Escalate the fault (roster/codex-fault-investigation-*.md) before ' +
        'proceeding; ' + (i + 1) + ' of ' + artifacts.length + ' artifact(s) are recorded in ' + resultsFile + ' and must not be re-billed.'
      );
    }
  }

  process.stdout.write('\ndone: ' + artifacts.length + ' artifact(s), results in ' + resultsFile + '\n');
}

module.exports = {
  LANES, PHASE0_MAX_UNAVAILABLE, OVERRIDE_LOG_BASENAME,
  parseArgs, phaseRunOrder, checkQuartermaster, checkProjectedDraw, checkPhaseOrder, readRequiredReserve, loadLadder, toolingRepoRoot,
  resolveQmCommand, resolveRunner, runOneAttempt, classifyVerdict, extractEngineHeader,
  appendResult, appendOverrideLog,
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    fail((e && e.message) || String(e));
  }
}
