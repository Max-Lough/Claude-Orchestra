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
 *     [--tier full|inert] [--timeout-ms <n>] [--no-tests] [--forbid <cmd>]...
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
 *       "doNotRun": ["godot"]
 *   } }
 *
 *   ORCHESTRA_REVIEW_MODEL      OpenAI model to pin (e.g. gpt-5-codex). Unset →
 *                               Codex uses its own configured default.
 *   ORCHESTRA_REVIEW_SANDBOX    Codex sandbox: workspace-write (default — lets
 *                               the reviewer actually run the test suite) or
 *                               read-only (hard no-write guarantee, but many
 *                               test runners can't run under it).
 *   ORCHESTRA_REVIEW_TIMEOUT_MS Max wall-clock for the review (default 600000).
 *   ORCHESTRA_REVIEW_IDLE_MS    Idle-precheck settle window (default 1500; 0
 *                               disables). Reviewing a tree another agent is
 *                               still writing produces garbage findings, so the
 *                               runner samples the tree twice and refuses if it
 *                               moved.
 *   ORCHESTRA_CODEX_HELPERS     Directory of known-good files mirrored into the
 *                               Codex install directory before each run. A
 *                               Codex self-update can silently drop files a
 *                               working install needs; this restores them.
 *   ORCHESTRA_REVIEW_ARGS       Extra args appended to `codex exec`, space-split
 *                               (escape hatch for flag drift / tuning).
 *   CODEX_BIN                   Codex executable (default "codex"). Resolved to
 *                               its REAL path before launching: a symlink or
 *                               Windows junction breaks Codex's own sibling-file
 *                               resolution, because it looks for its helpers
 *                               next to the link rather than the install.
 *   CLAUDE_PROJECT_DIR          Project root Codex reviews (default: cwd).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ------------------------------------------------------------------ config
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
  projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  forbidden: [],
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
function treeFingerprint(dir) {
  const r = spawnSync('git', ['-C', dir, 'status', '--porcelain=v1', '--untracked-files=all'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return null;
  const lines = (r.stdout || '').split('\n').filter((l) => l.trim());
  return lines
    .map((line) => {
      const rel = porcelainPath(line);
      if (!rel) return line;
      try {
        const st = fs.statSync(path.join(dir, rel));
        return line + ' [' + st.size + '@' + st.mtimeMs + ']';
      } catch (_) {
        return line; // deleted, unreadable, or quoted — the line still counts
      }
    })
    .join('\n');
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

function buildBrief(workOrder, executorReport, tier, verification, forbidden) {
  const rule1 = forbidden.length
    ? [
        '1. Verify independently — trust nothing you were told. Read the actual diff',
        '   (`git diff`, `git diff --staged`, or against the base ref named in the',
        '   work order). Read the surrounding code the diff plugs into, not only the',
        '   changed lines. Re-run whatever verification you are PERMITTED to run',
        '   (see PROHIBITED COMMANDS below); the executor\'s pasted output is a',
        '   claim, not evidence, and stays a claim when you cannot re-run it.',
      ]
    : [
        '1. Verify independently — trust nothing you were told. Read the actual diff',
        '   (`git diff`, `git diff --staged`, or against the base ref named in the',
        '   work order). Read the surrounding code the diff plugs into, not only the',
        '   changed lines. Re-run the tests, build, and linters yourself; the',
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

// ------------------------------------------------------------------ output
// Resolved review tier, stamped into the header so every verdict is auditable
// for the depth it was requested at. Set once in main(); 'full' before that
// so early-failure paths still print a truthful header.
let RESOLVED_TIER = 'full';
// Preflight notes (bin resolution, helper restore) — surfaced in the header so
// a silently-repaired install is visible rather than mysterious.
const PREFLIGHT = [];

function engineHeader() {
  const bits = [
    'model: ' + (CONFIG.model || 'codex default'),
    'sandbox: ' + CONFIG.sandbox,
    'tier: ' + RESOLVED_TIER,
    'timeout: ' + CONFIG.timeoutMs + 'ms (' + CONFIG.timeoutSource + ')',
  ];
  if (CONFIG.forbidden.length) bits.push('prohibited commands: ' + CONFIG.forbidden.length);
  let head = 'REVIEW ENGINE: OpenAI via Codex CLI (' + bits.join(', ') + ')';
  if (CONFIG.resolvedBin && CONFIG.resolvedBin !== CONFIG.bin) {
    head += '\nCODEX BINARY: ' + CONFIG.resolvedBin;
  }
  for (const note of PREFLIGHT) head += '\nPREFLIGHT: ' + note;
  return head;
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
    'The cross-vendor reviewer did not run. Do NOT treat this change as',
    'reviewed. The Director routes this review to the default Opus reviewer',
    'and notes the cross-vendor pass did not run (retry once conditions are',
    'fixed, if the user wants the cross-vendor opinion).',
  ].join('\n');
  process.stdout.write(engineHeader() + '\n\n' + block + '\n');
}

// ------------------------------------------------------------------ main
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: node orchestra-review.js --work-order <file> --executor-report <file>\n' +
        '         [--tier full|inert] [--timeout-ms <n>] [--no-tests] [--forbid <cmd>]...\n'
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
  const resolved = resolveCodexBin(CONFIG.bin);
  CONFIG.resolvedBin = resolved.path;
  if (resolved.note) PREFLIGHT.push(resolved.note);
  const installDir = resolved.real ? path.dirname(resolved.path) : '';
  if (CONFIG.helpersDir) {
    const restore = restoreHelpers(CONFIG.helpersDir, installDir);
    if (restore.restored.length) {
      PREFLIGHT.push(
        'restored ' + restore.restored.length + ' file(s) into the Codex install from ' +
          CONFIG.helpersDir + ': ' + restore.restored.join(', ')
      );
    }
    if (restore.note) PREFLIGHT.push(restore.note);
  }

  // --- preflight: is anything else still writing the tree? A review of a tree
  // in motion produces findings about a state that no longer exists.
  const before = treeFingerprint(CONFIG.projectDir);
  if (CONFIG.idleMs > 0 && before !== null) {
    sleepSync(CONFIG.idleMs);
    const settled = treeFingerprint(CONFIG.projectDir);
    if (settled !== null && settled !== before) {
      printUnavailable(
        'working tree is not idle',
        'The tree changed during a ' + CONFIG.idleMs + 'ms settle window, so something ' +
          'else is still writing it (a running executor, a build, a watch task). A ' +
          'review of a moving tree reports on a state that no longer exists.\n' +
          'Wait for the other work to finish and re-run this review. To disable the ' +
          'check, set ORCHESTRA_REVIEW_IDLE_MS=0 (or "codex": { "idleMs": 0 } in ' +
          '.claude/orchestra.json).\n' +
          'git status delta:\n--- first sample ---\n' + before.trim() +
          '\n--- second sample ---\n' + settled.trim()
      );
      return;
    }
  }

  const brief = buildBrief(
    workOrder,
    executorReport,
    RESOLVED_TIER,
    loadVerification(projectCfg),
    CONFIG.forbidden
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

  const run = spawnSync(CONFIG.resolvedBin || CONFIG.bin, codexArgs, {
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
      "Codex CLI not found (tried '" + (CONFIG.resolvedBin || CONFIG.bin) + "')",
      'Install the Codex CLI and put it on PATH, or set CODEX_BIN to its path. ' +
        'See https://developers.openai.com/codex/'
    );
    return;
  }
  if (run.error && (run.error.code === 'ETIMEDOUT' || run.signal === 'SIGTERM')) {
    printUnavailable(
      'review timed out after ' + CONFIG.timeoutMs + 'ms (cap from: ' + CONFIG.timeoutSource + ')',
      'Raise the cap where it actually takes effect — "codex": { "reviewTimeoutMs": ' +
        '<ms> } in .claude/orchestra.json, ORCHESTRA_REVIEW_TIMEOUT_MS, or --timeout-ms. ' +
        'A timeout named only in the work order\'s prose does nothing.\n' +
        'If the reviewer is burning the clock running a suite it did not need to run, ' +
        'pass --no-tests (or list the offending commands under "codex": { "doNotRun": ' +
        '[...] }), which forbids it outright instead of asking politely.\n' +
        tail(run.stderr || '', 20)
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
        '--help` and adjust ORCHESTRA_REVIEW_ARGS), a sandbox restriction, or an ' +
        'install missing files a self-update removed (see ORCHESTRA_CODEX_HELPERS).\n' +
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
