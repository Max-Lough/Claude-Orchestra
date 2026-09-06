#!/usr/bin/env node
/**
 * Cross-vendor ultra-plan counterpart for a Codex Director.
 *
 * The Director drafts in GPT-5.6 Sol. This runner sends the standing plan and
 * round brief to an isolated Claude CLI session and relays its verdict.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { boundedDiagnostic } = require('./orchestra-redact');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : '';
}

function readRequired(file, label) {
  if (!file) throw new Error('missing ' + label + ' path');
  return fs.readFileSync(path.resolve(file), 'utf8');
}

function unavailable(detail, next) {
  detail = boundedDiagnostic(detail, 4000);
  process.stdout.write(
    'ULTRA-PLAN ENGINE: Claude CLI (cross-vendor)\n\n' +
      'VERDICT: ULTRAPLAN_UNAVAILABLE\n\n' +
      'DETAIL\n- ' +
      detail +
      '\n\nNEXT\n- ' +
      next +
      '\n'
  );
  process.exit(0);
}

function buildPrompt(plan, brief, round) {
  return `You are the independent cross-vendor planning counterpart in an
Orchestra roundabout. The standing plan was drafted by an OpenAI GPT-5.6 Sol
Director. You have no repository access and must treat the supplied brief as
ground truth.

ROUND: ${round}

ROUND BRIEF
---
${brief}
---

STANDING PLAN
---
${plan}
---

Review the plan adversarially for missing requirements, incorrect sequencing,
unsafe parallelism, hidden coupling, unverifiable acceptance criteria, weak
rollback/recovery, and work orders that are too large or mix deliverable kinds.
Do not invent repository facts. Separate factual conflicts from judgment calls.

If the standing plan is ready unchanged, return exactly:

VERDICT: APPROVE

RATIONALE
<why no changes are required>

If any change is required, return exactly:

VERDICT: REVISE

CRITIQUE
1. <specific issue and consequence>

UPDATED PLAN
<a complete replacement plan, not a patch or sketch>

An APPROVE means no edits at all are needed. Do not approve merely because the
plan is promising. A REVISE must include the complete updated plan.
`;
}

function main() {
  let plan;
  let brief;
  try {
    plan = readRequired(argValue('--plan'), '--plan');
    brief = readRequired(argValue('--brief'), '--brief');
  } catch (error) {
    return unavailable(
      error.message,
      'Provide readable --plan and --brief files.'
    );
  }

  const round = parseInt(argValue('--round') || '1', 10);
  if (!Number.isInteger(round) || round < 1) {
    return unavailable('invalid --round value', 'Use a positive round number.');
  }

  const model = (
    argValue('--model') ||
    process.env.ORCHESTRA_CLAUDE_PLAN_MODEL ||
    'fable'
  ).trim();
  const effort = (
    argValue('--effort') ||
    process.env.ORCHESTRA_CLAUDE_PLAN_EFFORT ||
    'max'
  ).trim();
  const timeoutMs =
    parseInt(process.env.ORCHESTRA_CLAUDE_PLAN_TIMEOUT_MS || '', 10) ||
    900000;
  const binary = (process.env.CLAUDE_BIN || 'claude').trim();

  const run = spawnSync(
    binary,
    [
      '--print',
      '--safe-mode',
      '--no-session-persistence',
      '--output-format',
      'text',
      '--model',
      model,
      '--effort',
      effort,
      '--permission-mode',
      'dontAsk',
      '--tools',
      '',
    ],
    {
      cwd: process.cwd(),
      input: buildPrompt(plan, brief, round),
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    }
  );

  if (run.error) {
    return unavailable(
      'failed to launch Claude CLI: ' + run.error.message,
      'Install/authenticate Claude CLI or set CLAUDE_BIN, then retry.'
    );
  }
  if (run.status !== 0) {
    return unavailable(
      'Claude CLI exited with status ' +
        run.status +
        ': ' +
        (run.stderr || ''),
      'Run `claude auth` or adjust ORCHESTRA_CLAUDE_PLAN_* settings.'
    );
  }

  const response = (run.stdout || '').trim();
  if (!/VERDICT:\s*(APPROVE|REVISE)\b/.test(response)) {
    return unavailable(
      'Claude returned no parseable APPROVE/REVISE verdict.',
      'Inspect Claude CLI availability and retry the same round.'
    );
  }
  if (/VERDICT:\s*REVISE\b/.test(response) && !/UPDATED PLAN\b/.test(response)) {
    return unavailable(
      'Claude requested revision without a complete UPDATED PLAN.',
      'Retry the same round; do not treat this response as convergence.'
    );
  }

  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'orchestra-claude-plan-')
  );
  if (process.platform !== 'win32') fs.chmodSync(outputDir, 0o700);
  const responseFile = path.join(outputDir, 'round-' + round + '.md');
  fs.writeFileSync(responseFile, response + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(responseFile, 0o600);

  process.stdout.write(
    'ULTRA-PLAN ENGINE: Claude CLI (model: ' +
      model +
      ', effort: ' +
      effort +
      ', round: ' +
      round +
      ')\n' +
      'RESPONSE SAVED: ' +
      responseFile +
      '\n\n' +
      response +
      '\n'
  );
}

try {
  main();
} catch (error) {
  unavailable(
    'ultra-plan runner failed: ' + error.message,
    'Inspect the runner and retry the same round.'
  );
}
