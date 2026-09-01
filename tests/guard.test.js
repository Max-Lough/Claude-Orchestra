#!/usr/bin/env node
/**
 * Guard tests for hooks/orchestra-guard.js — WO-14b leg 3 (sdc-011/012).
 *
 *   node tests/guard.test.js
 *
 * Drives the real hook script with synthetic PreToolUse JSON on stdin, the
 * same way it is actually invoked by Claude Code, and reads its stdout
 * (empty = allow; a JSON hookSpecificOutput block = deny). Pins three fixes:
 *
 *   1. The plan-file carve-out requires a `.md` extension on BOTH routes
 *      (the default `.claude/plans/` branch and any `directorPlanPatterns`
 *      entry), and containment is checked on the REAL (symlink-resolved)
 *      path so a pre-existing symlink/junction inside the plans directory
 *      cannot point outside the project and still pass.
 *   2. The default-tool denial names every configured plan directory, not
 *      only the default location.
 *   3. Under `roster:new` (`.claude/orchestra.json`), an undetermined
 *      session model (no transcript, unreadable transcript, or a transcript
 *      with no assistant turn yet) DENIES instead of standing down — the
 *      legacy fail-open window this closes. Legacy behaviour (no manifest,
 *      or `roster` anything other than `"new"`) is unchanged: stand down.
 *
 * Same conventions as the other suites: no dependencies, exit-code
 * discipline enforced by an exit handler, a suite that ran no checks fails.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const GUARD = path.join(MASTER, 'hooks', 'orchestra-guard.js');

let failures = 0;
let passes = 0;
const cleanups = [];

function check(name, ok, detail) {
  if (ok) {
    passes++;
    console.log('  PASS  ' + name);
  } else {
    failures++;
    process.exitCode = 1;
    console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/\n/g, '\n        ') : ''));
  }
}

function section(title) {
  console.log('\n' + title);
}

process.on('exit', () => {
  if (failures > 0) process.exitCode = 1;
  else if (passes === 0) {
    console.log('\nFAILED — no checks ran at all (the suite did not execute)');
    process.exitCode = 1;
  }
});

function tmpdir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

// ------------------------------------------------------------- test rig

function assistantTurn(model) {
  return { type: 'assistant', isSidechain: false, message: { model } };
}

function writeTranscript(dir, lines) {
  const p = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(p, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n', 'utf8');
  return p;
}

function setManifest(projectDir, obj) {
  const dir = path.join(projectDir, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'orchestra.json'), JSON.stringify(obj), 'utf8');
}

// Runs the real guard script with `input` as the PreToolUse JSON on stdin,
// CLAUDE_PROJECT_DIR pointed at `projectDir` (exactly how Claude Code
// invokes it — see orchestra-guard.js's projectDir()).
function runGuard(projectDir, input) {
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: projectDir });
  delete env.ORCHESTRA_PAUSE; // a developer's own shell must not leak into the fixture
  return spawnSync(process.execPath, [GUARD], {
    encoding: 'utf8',
    timeout: 15000,
    input: JSON.stringify(input),
    env,
  });
}

function decisionOf(r) {
  const out = (r.stdout || '').trim();
  if (!out) return { decision: 'allow', reason: '' };
  let j;
  try {
    j = JSON.parse(out);
  } catch (e) {
    return { decision: 'unparseable-output', reason: out };
  }
  const hso = j.hookSpecificOutput || {};
  return { decision: hso.permissionDecision || 'unknown', reason: hso.permissionDecisionReason || '' };
}

function opusEdit(filePath, transcriptPath, extra) {
  return Object.assign(
    {
      tool_name: 'Edit',
      tool_input: { file_path: filePath, old_string: 'a', new_string: 'b' },
      transcript_path: transcriptPath,
    },
    extra || {}
  );
}

// ---------------------------------------------------------------- cases

function case1_mdRequiredBothRoutes() {
  section('1. Plan-file carve-out requires .md on BOTH routes (default dir + directorPlanPatterns)');

  const proj = tmpdir('orchestra-guard-');
  const transcript = writeTranscript(proj, [assistantTurn('claude-opus-4-8')]);
  fs.mkdirSync(path.join(proj, '.claude', 'plans'), { recursive: true });
  fs.mkdirSync(path.join(proj, 'docs', 'plans'), { recursive: true });
  setManifest(proj, { directorPlanPatterns: ['^docs/plans/.+$'] });

  const defaultMd = runGuard(proj, opusEdit('.claude/plans/foo.md', transcript));
  check('default plans/ + .md -> allow', decisionOf(defaultMd).decision === 'allow', JSON.stringify(decisionOf(defaultMd)));

  const defaultTxt = runGuard(proj, opusEdit('.claude/plans/foo.txt', transcript));
  check('default plans/ + non-.md -> deny', decisionOf(defaultTxt).decision === 'deny', JSON.stringify(decisionOf(defaultTxt)));

  const patternMd = runGuard(proj, opusEdit('docs/plans/bar.md', transcript));
  check('directorPlanPatterns match + .md -> allow', decisionOf(patternMd).decision === 'allow', JSON.stringify(decisionOf(patternMd)));

  const patternTxt = runGuard(proj, opusEdit('docs/plans/bar.txt', transcript));
  check(
    'directorPlanPatterns match + non-.md -> deny (pattern route requires .md too, exactly like the default route)',
    decisionOf(patternTxt).decision === 'deny',
    JSON.stringify(decisionOf(patternTxt))
  );
}

function case2_symlinkEscapeDenied() {
  section('2. A symlink/junction inside the plans dir cannot escape the project');

  const proj = tmpdir('orchestra-guard-');
  const outside = tmpdir('orchestra-guard-outside-');
  const transcript = writeTranscript(proj, [assistantTurn('claude-opus-4-8')]);
  fs.mkdirSync(path.join(proj, '.claude'), { recursive: true });

  const linkPath = path.join(proj, '.claude', 'plans');
  let linked = true;
  try {
    fs.symlinkSync(outside, linkPath, 'junction');
  } catch (e) {
    try {
      fs.symlinkSync(outside, linkPath, 'dir');
    } catch (e2) {
      linked = false;
      check('symlink/junction escape denied', true, 'SKIPPED — cannot create a symlink/junction on this OS/permission level (' + (e2 && e2.message) + ')');
    }
  }
  if (linked) {
    const r = runGuard(proj, opusEdit('.claude/plans/evil.md', transcript));
    check(
      'a plans/ directory that is really a symlink to OUTSIDE the project is NOT treated as a plan file',
      decisionOf(r).decision === 'deny',
      JSON.stringify(decisionOf(r))
    );
  }
}

function case3_hintNamesConfiguredDirs() {
  section('3. Denial hint names every configured plan directory, not only the default');

  const proj = tmpdir('orchestra-guard-');
  const transcript = writeTranscript(proj, [assistantTurn('claude-opus-4-8')]);
  setManifest(proj, { directorPlanPatterns: ['^docs/plans/.+\\.md$'] });

  // A plain, non-plan Edit anywhere in the project triggers the default
  // denial, whose hint should name both the default location and the
  // configured pattern.
  const r = runGuard(proj, opusEdit('src/index.js', transcript));
  const d = decisionOf(r);
  check('denial hint mentions the default .claude/plans/ location', d.decision === 'deny' && /\.claude\/plans\//.test(d.reason), d.reason);
  check(
    'denial hint mentions the configured directorPlanPatterns entry',
    d.decision === 'deny' && d.reason.indexOf('^docs/plans/.+\\.md$') !== -1,
    d.reason
  );
}

function case4_undeterminedModelRosterAsymmetry() {
  section('4. Undetermined model: legacy stands down, roster:new denies');

  // No transcript_path at all -> latestMainModel() returns null (undetermined).
  const legacyProj = tmpdir('orchestra-guard-');
  const rLegacy = runGuard(legacyProj, { tool_name: 'Edit', tool_input: { file_path: 'x.js', old_string: 'a', new_string: 'b' } });
  check('legacy (no manifest): undetermined model -> allow (stand down)', decisionOf(rLegacy).decision === 'allow', JSON.stringify(decisionOf(rLegacy)));

  const explicitLegacyProj = tmpdir('orchestra-guard-');
  setManifest(explicitLegacyProj, { roster: 'legacy' });
  const rExplicitLegacy = runGuard(explicitLegacyProj, { tool_name: 'Edit', tool_input: { file_path: 'x.js', old_string: 'a', new_string: 'b' } });
  check(
    'roster:"legacy" explicit: undetermined model -> allow (stand down, unchanged)',
    decisionOf(rExplicitLegacy).decision === 'allow',
    JSON.stringify(decisionOf(rExplicitLegacy))
  );

  const newProj = tmpdir('orchestra-guard-');
  setManifest(newProj, { roster: 'new' });
  const rNew = runGuard(newProj, { tool_name: 'Edit', tool_input: { file_path: 'x.js', old_string: 'a', new_string: 'b' } });
  const dNew = decisionOf(rNew);
  check('roster:"new": undetermined model -> deny', dNew.decision === 'deny', JSON.stringify(dNew));
  check('roster:"new" undetermined-model denial names the roster asymmetry', /roster:new/.test(dNew.reason), dNew.reason);

  // A DETERMINED non-director model (Sonnet) still stands down under
  // roster:new — only the undetermined case flips.
  const sonnetTranscript = writeTranscript(newProj, [assistantTurn('claude-sonnet-4-8')]);
  const rSonnet = runGuard(newProj, opusEdit('x.js', sonnetTranscript));
  check(
    'roster:"new": a DETERMINED non-director model (Sonnet) still stands down (only undetermined denies)',
    decisionOf(rSonnet).decision === 'allow',
    JSON.stringify(decisionOf(rSonnet))
  );

  // And a determined director model still enforces under roster:new, same
  // denial shape as legacy.
  const opusTranscript = writeTranscript(newProj, [assistantTurn('claude-opus-4-8')]);
  const rOpus = runGuard(newProj, opusEdit('x.js', opusTranscript));
  check('roster:"new": a determined director model (Opus) still enforces (denies)', decisionOf(rOpus).decision === 'deny', JSON.stringify(decisionOf(rOpus)));
}

function case5_malformedTranscriptRosterAsymmetry() {
  section('5. Malformed/unreadable transcript content -> undetermined -> same roster asymmetry');

  const garbage = 'not json at all\n{"broken\n';

  const legacyProj = tmpdir('orchestra-guard-');
  const legacyTranscript = path.join(legacyProj, 't.jsonl');
  fs.writeFileSync(legacyTranscript, garbage, 'utf8');
  const rLegacy = runGuard(legacyProj, opusEdit('x.js', legacyTranscript));
  check(
    'legacy: unparseable transcript content -> undetermined -> allow (stand down)',
    decisionOf(rLegacy).decision === 'allow',
    JSON.stringify(decisionOf(rLegacy))
  );

  const newProj = tmpdir('orchestra-guard-');
  setManifest(newProj, { roster: 'new' });
  const newTranscript = path.join(newProj, 't.jsonl');
  fs.writeFileSync(newTranscript, garbage, 'utf8');
  const rNew = runGuard(newProj, opusEdit('x.js', newTranscript));
  check('roster:"new": unparseable transcript content -> undetermined -> deny', decisionOf(rNew).decision === 'deny', JSON.stringify(decisionOf(rNew)));

  // A missing transcript file entirely is the same "undetermined" case.
  const newProj2 = tmpdir('orchestra-guard-');
  setManifest(newProj2, { roster: 'new' });
  const rMissing = runGuard(newProj2, opusEdit('x.js', path.join(newProj2, 'does-not-exist.jsonl')));
  check('roster:"new": missing transcript file -> undetermined -> deny', decisionOf(rMissing).decision === 'deny', JSON.stringify(decisionOf(rMissing)));
}

function case6_fixedShapeUnchanged() {
  section('6. Unrelated guard shape unaffected (subagents exempt, pause file, memory files)');

  const proj = tmpdir('orchestra-guard-');
  const transcript = writeTranscript(proj, [assistantTurn('claude-opus-4-8')]);

  const rSubagent = runGuard(proj, { tool_name: 'Edit', tool_input: { file_path: 'x.js', old_string: 'a', new_string: 'b' }, transcript_path: transcript, agent_id: 'sub-1' });
  check('subagent calls remain exempt', decisionOf(rSubagent).decision === 'allow', JSON.stringify(decisionOf(rSubagent)));

  const rPause = runGuard(proj, { tool_name: 'Write', tool_input: { file_path: '.claude/orchestra.pause', content: '' }, transcript_path: transcript });
  check('the pause-file write remains exempt', decisionOf(rPause).decision === 'allow', JSON.stringify(decisionOf(rPause)));

  const rRead = runGuard(proj, { tool_name: 'Read', tool_input: { file_path: 'x.js' }, transcript_path: transcript });
  check('Read remains unrestricted (not in the default blocklist)', decisionOf(rRead).decision === 'allow', JSON.stringify(decisionOf(rRead)));
}

// ------------------------------------------------------------------ driver

function finish() {
  for (const c of cleanups) {
    try {
      c();
    } catch (_) {
      /* best effort */
    }
  }
  console.log('\n' + (failures ? 'FAILED' : 'OK') + ' — ' + passes + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
}

try {
  case1_mdRequiredBothRoutes();
  case2_symlinkEscapeDenied();
  case3_hintNamesConfiguredDirs();
  case4_undeterminedModelRosterAsymmetry();
  case5_malformedTranscriptRosterAsymmetry();
  case6_fixedShapeUnchanged();
} catch (e) {
  check('the suite ran to completion', false, (e && e.stack) || e);
}
finish();
