#!/usr/bin/env node
/**
 * Orchestra cross-family review runner.
 *
 * Drives an OpenAI model through the Codex CLI to review a change produced by
 * the Claude executor. Review lives in a DIFFERENT model family from the
 * Director and executor on purpose: same-family reviewers share blind spots,
 * so a Claude change reviewed only by Claude tends to miss the same bugs the
 * Claude that wrote it missed. Codex re-reads the diff, runs the tests itself,
 * and hunts for concrete failure scenarios — independent in the ways that
 * matter and independent in model, too.
 *
 * The `reviewer` subagent (a thin Claude launcher) invokes this. The Director
 * itself cannot — the guard blocks its Bash — so review stays delegated.
 *
 * Usage:
 *   node orchestra-review.js --work-order <file> --executor-report <file> \
 *     [--tier full|inert]
 *
 * Both files are plain text the launcher wrote from what the Director handed
 * it. The work order is the intent (what SHOULD have happened); the executor
 * report is the claim (what it SAYS happened). Codex gets both, plus the live
 * tree, and audits the diff against them.
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
 * Output: a self-contained review report on stdout, already in the Orchestra
 * reviewer format (VERDICT / FINDINGS / CLAIMS CHECKED / NITS). The launcher
 * relays it verbatim. On any engine failure it prints a VERDICT:
 * REVIEW_UNAVAILABLE block instead of a fake verdict — a review that could not
 * run must never read as an approval. Exit code is always 0: the status lives
 * in the VERDICT line, which is what the launcher and Director read.
 *
 * Configuration (all optional, via environment):
 *   ORCHESTRA_REVIEW_MODEL      OpenAI model to pin (e.g. gpt-5-codex). Unset →
 *                               Codex uses its own configured default.
 *   ORCHESTRA_REVIEW_SANDBOX    Codex sandbox: workspace-write (default — lets
 *                               the reviewer actually run the test suite) or
 *                               read-only (hard no-write guarantee, but many
 *                               test runners can't run under it).
 *   ORCHESTRA_REVIEW_TIMEOUT_MS Max wall-clock for the review (default 600000).
 *   ORCHESTRA_REVIEW_ARGS       Extra args appended to `codex exec`, space-split
 *                               (escape hatch for flag drift / tuning).
 *   CODEX_BIN                   Codex executable (default "codex").
 *   CLAUDE_PROJECT_DIR          Project root Codex reviews (default: cwd).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ------------------------------------------------------------------ config
const CONFIG = {
  model: (process.env.ORCHESTRA_REVIEW_MODEL || '').trim(),
  sandbox: (process.env.ORCHESTRA_REVIEW_SANDBOX || 'workspace-write').trim(),
  timeoutMs: parseInt(process.env.ORCHESTRA_REVIEW_TIMEOUT_MS || '', 10) || 600000,
  extraArgs: (process.env.ORCHESTRA_REVIEW_ARGS || '').trim(),
  bin: (process.env.CODEX_BIN || 'codex').trim(),
  projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
};

// ------------------------------------------------------------------ helpers
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--work-order') out.workOrder = argv[++i];
    else if (a === '--executor-report') out.executorReport = argv[++i];
    else if (a === '--tier') out.tier = argv[++i];
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

// Optional per-project verification manifest (.claude/orchestra.json →
// "verification"). Fail-open like the guard's config: a missing or broken
// file simply means the brief carries no manifest. Strings only — a malformed
// entry is dropped, never crashed on.
function loadVerification(projectDir) {
  try {
    const raw = fs.readFileSync(path.join(projectDir, '.claude', 'orchestra.json'), 'utf8');
    const cfg = JSON.parse(raw);
    const v = cfg && cfg.verification;
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch (_) {
    return null;
  }
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((s) => typeof s === 'string' && s.trim()) : [];
}

// Working-tree fingerprint, so we can tell whether the reviewer (which is
// meant to be read-only in intent) mutated anything while running the tests.
// Returns null when the dir isn't a git repo or git is unavailable — mutation
// detection is a best-effort safety net, never a hard dependency.
function treeFingerprint(dir) {
  const r = spawnSync('git', ['-C', dir, 'status', '--porcelain=v1', '--untracked-files=all'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return null;
  return r.stdout || '';
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

function buildBrief(workOrder, executorReport, tier, verification) {
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
    '1. Verify independently — trust nothing you were told. Read the actual diff',
    '   (`git diff`, `git diff --staged`, or against the base ref named in the',
    '   work order). Read the surrounding code the diff plugs into, not only the',
    '   changed lines. Re-run the tests, build, and linters yourself; the',
    '   executor\'s pasted output is a claim, not evidence.',
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

// ------------------------------------------------------------------ output
// Resolved review tier, stamped into the header so every verdict is auditable
// for the depth it was requested at. Set once in main(); 'full' before that
// so early-failure paths still print a truthful header.
let RESOLVED_TIER = 'full';

function engineHeader() {
  return (
    'REVIEW ENGINE: OpenAI via Codex CLI (model: ' +
    (CONFIG.model || 'codex default') +
    ', sandbox: ' +
    CONFIG.sandbox +
    ', tier: ' +
    RESOLVED_TIER +
    ')'
  );
}

function printReview(body) {
  process.stdout.write(engineHeader() + '\n\n' + body.replace(/\s+$/, '') + '\n');
}

function printUnavailable(reason, detail) {
  const block = [
    'VERDICT: REVIEW_UNAVAILABLE',
    '',
    'REASON',
    '- ' + reason,
    '',
    'DETAIL',
    detail ? detail.split('\n').map((l) => '  ' + l).join('\n') : '  (none)',
    '',
    'The cross-family reviewer did not run. Do NOT treat this change as',
    'reviewed. The Director decides: retry once conditions are fixed, fall back',
    'to in-context review for a small low-risk change, or hold and ask the user.',
  ].join('\n');
  process.stdout.write(engineHeader() + '\n\n' + block + '\n');
}

// ------------------------------------------------------------------ main
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: node orchestra-review.js --work-order <file> --executor-report <file> ' +
        '[--tier full|inert]\n'
    );
    return;
  }

  // Anything other than an explicit, exact 'inert' reviews at full depth —
  // the safe direction for a typo'd or invented tier value.
  RESOLVED_TIER = (args.tier || '').trim().toLowerCase() === 'inert' ? 'inert' : 'full';

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

  const brief = buildBrief(
    workOrder,
    executorReport,
    RESOLVED_TIER,
    loadVerification(CONFIG.projectDir)
  );

  // Where Codex writes its final message. Read this rather than parsing the
  // streamed session on stdout.
  let lastMsgFile;
  try {
    lastMsgFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-review-')),
      'verdict.txt'
    );
  } catch (e) {
    printUnavailable('cannot create temp file', String((e && e.message) || e));
    return;
  }

  const codexArgs = ['exec', '--sandbox', CONFIG.sandbox, '--cd', CONFIG.projectDir];
  if (CONFIG.model) codexArgs.push('--model', CONFIG.model);
  codexArgs.push('--output-last-message', lastMsgFile);
  if (CONFIG.extraArgs) codexArgs.push(...CONFIG.extraArgs.split(/\s+/).filter(Boolean));
  codexArgs.push('-'); // read the prompt from stdin

  const before = treeFingerprint(CONFIG.projectDir);

  const run = spawnSync(CONFIG.bin, codexArgs, {
    cwd: CONFIG.projectDir,
    input: brief,
    encoding: 'utf8',
    timeout: CONFIG.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });

  // Engine could not be launched at all (usually: codex not installed / not on
  // PATH). This is the "you chose the OpenAI reviewer but Codex isn't here" case.
  if (run.error && run.error.code === 'ENOENT') {
    printUnavailable(
      "Codex CLI not found (tried '" + CONFIG.bin + "')",
      'Install the Codex CLI and put it on PATH, or set CODEX_BIN to its path. ' +
        'See https://developers.openai.com/codex/'
    );
    return;
  }
  if (run.error && (run.error.code === 'ETIMEDOUT' || run.signal === 'SIGTERM')) {
    printUnavailable(
      'review timed out after ' + CONFIG.timeoutMs + 'ms',
      'Raise ORCHESTRA_REVIEW_TIMEOUT_MS, or the test suite the reviewer runs ' +
        'is hanging.\n' + tail(run.stderr || '', 20)
    );
    return;
  }
  if (run.error) {
    printUnavailable('failed to launch Codex', String(run.error.message || run.error));
    return;
  }

  const verdict = readFileOr(lastMsgFile, '').trim();

  if (run.status !== 0 && !verdict) {
    // Non-zero exit with nothing usable — most often auth (no OPENAI_API_KEY
    // and no stored `codex login`) or a rejected flag on this Codex version.
    printUnavailable(
      'Codex exited with status ' + run.status,
      'Common causes: not authenticated (set OPENAI_API_KEY or run `codex ' +
        'login`), an unsupported flag on this Codex version (check `codex exec ' +
        '--help` and adjust ORCHESTRA_REVIEW_ARGS), or a sandbox restriction.\n' +
        'stderr:\n' + tail(run.stderr || '', 25)
    );
    return;
  }

  // Prefer the clean final-message file; fall back to stdout if the flag was a
  // no-op on this version.
  let body = verdict || tail(run.stdout || '', 400).trim();
  if (!body) {
    printUnavailable(
      'Codex produced no output',
      'Exit status ' + run.status + '. stderr:\n' + tail(run.stderr || '', 25)
    );
    return;
  }

  // Safety net the raw-prompt trust model lacks: did the "read-only in intent"
  // reviewer actually leave the tree alone? Report drift loudly; do not
  // auto-revert (that could clobber the executor's real change).
  const after = treeFingerprint(CONFIG.projectDir);
  if (before !== null && after !== null && before !== after) {
    body +=
      '\n\n⚠ INTEGRITY WARNING: the working tree changed while the reviewer ran. ' +
      'The reviewer is supposed to be read-only; inspect the tree before trusting ' +
      'it, and consider ORCHESTRA_REVIEW_SANDBOX=read-only.\n' +
      'git status delta (before → after):\n--- before ---\n' +
      before.trim() +
      '\n--- after ---\n' +
      after.trim();
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
}
