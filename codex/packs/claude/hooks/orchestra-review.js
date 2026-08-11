#!/usr/bin/env node
/**
 * Cross-vendor Orchestra review runner for a Codex Director.
 *
 * It launches an isolated Claude CLI print session with project customizations
 * disabled, gives it the work order and author report, and relays the verdict.
 * The native GPT-5.6 Sol reviewer remains the default review engine.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : '';
}

function hasArg(name) {
  return process.argv.includes(name);
}

function readRequired(file, label) {
  if (!file) throw new Error('missing ' + label + ' path');
  return fs.readFileSync(path.resolve(file), 'utf8');
}

function projectRoot() {
  return path.resolve(process.env.CODEX_PROJECT_DIR || process.cwd());
}

function verificationBlock(root) {
  try {
    const file = path.join(root, '.codex', 'orchestra.json');
    if (!fs.existsSync(file)) return 'No verification manifest is configured.';
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!config.verification) return 'No verification manifest is configured.';
    return (
      'PROJECT VERIFICATION MANIFEST (.codex/orchestra.json)\n' +
      JSON.stringify(config.verification, null, 2)
    );
  } catch (error) {
    return 'Verification manifest could not be read: ' + error.message;
  }
}

function gitStatus(root) {
  const result = spawnSync(
    'git',
    ['-C', root, 'status', '--porcelain=v1', '--untracked-files=all'],
    { encoding: 'utf8', timeout: 30000, windowsHide: true }
  );
  return result.status === 0 ? result.stdout : null;
}

function printUnavailable(detail, next) {
  process.stdout.write(
    'REVIEW ENGINE: NONE — no verdict produced ' +
      '(attempted: Claude CLI, cross-vendor)\n\n' +
      'VERDICT: REVIEW_UNAVAILABLE\n\n' +
      'DETAIL\n- ' +
      detail +
      '\n\nNEXT\n- ' +
      next +
      '\n'
  );
  process.exit(0);
}

function buildPrompt(root, workOrder, authorReport, tier) {
  return `You are the independent cross-vendor Reviewer in the Orchestra
harness. The author and Director are OpenAI Codex agents. Review the live
repository at ${root}. Presume the change is broken until you fail to break it.

RULES
1. Read the actual diff and the surrounding code. Treat the author report as a
   claim, not evidence.
2. Independently run the declared verification. If none is declared, run the
   relevant tests, build, and lint. You may use Bash and read/search tools, but
   never edit, stage, commit, or intentionally alter source files.
3. Hunt concrete failure scenarios: boundaries, empty state, error paths,
   concurrency, cleanup, security, API contracts, and untouched callers.
4. Audit scope: missing requested behavior and unexplained extra changes are
   findings.
5. Review tier is ${tier}. If it is inert, first prove every changed line is
   behavior-neutral. Any behavior-bearing line is a CRITICAL tier violation and
   forces full-depth review.
6. CRITICAL or MAJOR findings force REVISE. MINOR-only may approve. Style-only
   preferences are NITS. Do not fix anything.

${verificationBlock(root)}

WORK ORDER / INTENT
---
${workOrder}
---

AUTHOR REPORT / CLAIM
---
${authorReport}
---

Return exactly this structure:

REVIEW ENGINE: Claude CLI (<actual model if known>, fresh context, tier: ${tier})

VERDICT: APPROVE | REVISE

FINDINGS
- [CRITICAL|MAJOR|MINOR] path:line - defect - concrete failure scenario
- or "none"

CLAIMS CHECKED
- "author claim" -> CONFIRMED | REFUTED | UNVERIFIED (how checked)

VERIFICATION
- command -> actual result

NITS
- non-blocking suggestions or "none"
`;
}

function main() {
  const root = projectRoot();
  let workOrder;
  let authorReport;
  try {
    workOrder = readRequired(argValue('--work-order'), '--work-order');
    authorReport = readRequired(
      argValue('--executor-report'),
      '--executor-report'
    );
  } catch (error) {
    return printUnavailable(
      error.message,
      'Provide readable --work-order and --executor-report files.'
    );
  }

  const tier = hasArg('--tier')
    ? (argValue('--tier') || 'full').toLowerCase()
    : 'full';
  if (tier !== 'full' && tier !== 'inert') {
    return printUnavailable(
      'unsupported tier: ' + tier,
      'Use --tier full or --tier inert.'
    );
  }

  const model = (
    process.env.ORCHESTRA_CLAUDE_REVIEW_MODEL || 'opus'
  ).trim();
  const effort = (
    process.env.ORCHESTRA_CLAUDE_REVIEW_EFFORT || 'high'
  ).trim();
  const timeoutMs =
    parseInt(process.env.ORCHESTRA_CLAUDE_REVIEW_TIMEOUT_MS || '', 10) ||
    900000;
  const binary = (process.env.CLAUDE_BIN || 'claude').trim();
  const prompt = buildPrompt(root, workOrder, authorReport, tier);
  const before = gitStatus(root);

  const args = [
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
    'Bash,Read,Grep,Glob',
    '--allowedTools',
    'Bash,Read,Grep,Glob',
  ];

  const run = spawnSync(binary, args, {
    cwd: root,
    input: prompt,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });

  if (run.error) {
    return printUnavailable(
      'failed to launch Claude CLI: ' + run.error.message,
      'Install/authenticate Claude CLI or set CLAUDE_BIN, then retry; ' +
        'otherwise use the native GPT-5.6 Sol reviewer.'
    );
  }
  if (run.status !== 0) {
    return printUnavailable(
      'Claude CLI exited with status ' +
        run.status +
        ': ' +
        (run.stderr || '').trim().slice(0, 3000),
      'Run `claude auth` or adjust ORCHESTRA_CLAUDE_REVIEW_* settings; ' +
        'otherwise use the native GPT-5.6 Sol reviewer.'
    );
  }

  const response = (run.stdout || '').trim();
  if (!/VERDICT:\s*(APPROVE|REVISE)\b/.test(response)) {
    return printUnavailable(
      'Claude returned no parseable APPROVE/REVISE verdict.',
      'Inspect Claude CLI output and retry, or use the native reviewer.'
    );
  }

  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'orchestra-claude-review-')
  );
  const responseFile = path.join(outputDir, 'response.md');
  fs.writeFileSync(responseFile, response + '\n', 'utf8');

  const after = gitStatus(root);
  if (before !== null && after !== null && before !== after) {
    process.stdout.write(
      '⚠ INTEGRITY WARNING: the working tree changed during the external ' +
        'review. Confirm the delta before trusting it.\n\n'
    );
  }
  process.stdout.write(
    'RESPONSE SAVED: ' + responseFile + '\n\n' + response + '\n'
  );
}

try {
  main();
} catch (error) {
  printUnavailable(
    'review runner failed: ' + error.message,
    'Use the native GPT-5.6 Sol reviewer and inspect this runner.'
  );
}

