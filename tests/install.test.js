#!/usr/bin/env node
/**
 * Installer tests for install.js — legacy-only 3.0 installer (WO-1 commit 2
 * of 2, plans/port-3.0/reverse-port-3.0-plan.md). No --roster, no pins, no
 * gate hooks, no runtime substrates. Covers fresh install, idempotent
 * re-run, uninstall, user-settings preservation, pack selection and MCP
 * merge, specialists, permission ownership, the CLAUDE.md marker,
 * frontmatter refusal, and the Design Decision 8 config preflight (refuse
 * roster:new, scrub deprecated keys, warn on an orphaned runtime dir).
 *
 *   node tests/install.test.js
 *
 * Fresh temp dirs via fs.mkdtempSync, spawnSync against the real installer
 * (no stubbing), exit-code discipline enforced by an exit handler.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const INSTALLER = path.join(MASTER, 'install.js');

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

function install(target, extraArgs) {
  return spawnSync(process.execPath, [INSTALLER, target].concat(extraArgs || []), {
    encoding: 'utf8',
    timeout: 120000,
    cwd: MASTER,
  });
}

function census(target) {
  const out = [];
  const dot = path.join(target, '.claude');
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(target, p).replace(/\\/g, '/'));
    }
  };
  walk(dot);
  if (fs.existsSync(path.join(target, 'CLAUDE.md'))) out.push('CLAUDE.md');
  if (fs.existsSync(path.join(target, '.mcp.json'))) out.push('.mcp.json');
  return out.sort();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonFile(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function ok(r) {
  return r.status === 0;
}
function out(r) {
  return (r.stdout || '') + (r.stderr || '');
}

// ---------------------------------------------------------------- cases

// Checked-in expected legacy census — a plain `node install.js <target>
// --no-packs --no-specialists`. No roster generations exist any more, so
// this is simply THE fresh-install census.
const EXPECTED_LEGACY_CENSUS = [
  '.claude/.gitattributes',
  '.claude/ORCHESTRA.md',
  '.claude/agents/detective.md',
  '.claude/agents/executor-heavy-xhigh.md',
  '.claude/agents/executor-heavy.md',
  '.claude/agents/executor.md',
  '.claude/agents/reviewer.md',
  '.claude/agents/scout.md',
  '.claude/hooks/orchestra-guard.js',
  '.claude/hooks/package.json',
  '.claude/orchestra-install.json',
  '.claude/settings.json',
  '.claude/skills/orchestra-plan/SKILL.md',
  '.claude/skills/orchestra-review/SKILL.md',
  '.claude/skills/orchestra-status/SKILL.md',
  'CLAUDE.md',
].sort();

function case1_freshInstallCensus() {
  section('1. Fresh install: file census matches the checked-in expected legacy-only list');

  const target = tmpdir('orchestra-install-');
  const r = install(target, ['--no-packs', '--no-specialists']);
  check('fresh install succeeds', ok(r), out(r));

  const c = census(target);
  check(
    'census matches the checked-in expected list exactly',
    JSON.stringify(c) === JSON.stringify(EXPECTED_LEGACY_CENSUS),
    'actual:\n' + c.join('\n') + '\nexpected:\n' + EXPECTED_LEGACY_CENSUS.join('\n')
  );
  check('NO .claude/orchestra.json under a fresh install (no manifest until something needs one)', !c.includes('.claude/orchestra.json'), c.join('\n'));
  check('no .claude/ORCHESTRA-CONDUCTOR.md', !c.includes('.claude/ORCHESTRA-CONDUCTOR.md'), c.join('\n'));
  check('no .claude/orchestra/ runtime directory', !c.some((f) => f.startsWith('.claude/orchestra/')), c.join('\n'));

  const settings = readJson(path.join(target, '.claude', 'settings.json'));
  const guardEntry = (settings.hooks.PreToolUse || []).find((e) => /orchestra-guard\.js/.test(e.hooks[0].command));
  check(
    'settings.json carries exactly one guard PreToolUse entry, no arguments',
    !!guardEntry && settings.hooks.PreToolUse.length === 1 && guardEntry.hooks[0].command === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-guard.js"',
    guardEntry && JSON.stringify(guardEntry)
  );
  check('no other hook events (no ticket-gate) registered', !settings.hooks.PostToolUse && !settings.hooks.SubagentStop && !settings.hooks.Stop, JSON.stringify(settings.hooks));

  const state = readJson(path.join(target, '.claude', 'orchestra-install.json'));
  check('.claude/orchestra-install.json has no "roster" key', !('roster' in state), JSON.stringify(state));
  check('.claude/orchestra-install.json records version/packs/specialists', typeof state.version === 'string' && Array.isArray(state.packs) && Array.isArray(state.specialists), JSON.stringify(state));
}

function case2_idempotentReRun() {
  section('2. Idempotent re-run ("update"): a plain re-run changes nothing unexpected and keeps the recorded selection');

  const target = tmpdir('orchestra-install-');
  install(target, ['--packs', 'codex', '--no-specialists']);
  const before = census(target);
  const stateBefore = readJson(path.join(target, '.claude', 'orchestra-install.json'));

  const r = install(target, []); // no flags at all — must inherit packs from the state file
  check('plain re-run (no flags) succeeds', ok(r), out(r));

  const after = census(target);
  check('re-run produces an IDENTICAL file census', JSON.stringify(before) === JSON.stringify(after), 'before=' + before.join(',') + '\nafter=' + after.join(','));
  const stateAfter = readJson(path.join(target, '.claude', 'orchestra-install.json'));
  check('re-run keeps the recorded pack selection (codex) without re-passing --packs', JSON.stringify(stateAfter.packs) === JSON.stringify(stateBefore.packs) && stateAfter.packs.includes('codex'), JSON.stringify(stateAfter));

  // Explicitly dropping the pack on a later run removes it.
  const rDrop = install(target, ['--no-packs']);
  check('re-run with --no-packs succeeds', ok(rDrop), out(rDrop));
  const cDropped = census(target);
  check('dropping the pack removes its agents/hooks/skill', !cDropped.some((f) => f.includes('executor-codex')), cDropped.join('\n'));
}

function case3_uninstallLeavesStandardProject() {
  section('3. --uninstall removes everything Orchestra owns and leaves a standard project');

  const target = tmpdir('orchestra-install-');
  install(target, ['--packs', 'codex', '--no-specialists']);
  const r = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(r), out(r));

  check('no .claude/agents/*.md remain', !fs.existsSync(path.join(target, '.claude', 'agents')) || fs.readdirSync(path.join(target, '.claude', 'agents')).length === 0, '');
  check('the guard hook file is removed', !fs.existsSync(path.join(target, '.claude', 'hooks', 'orchestra-guard.js')), '');
  check('ORCHESTRA.md is removed', !fs.existsSync(path.join(target, '.claude', 'ORCHESTRA.md')), '');
  check('orchestra-install.json is removed', !fs.existsSync(path.join(target, '.claude', 'orchestra-install.json')), '');
  check('CLAUDE.md (Orchestra-only content) is removed', !fs.existsSync(path.join(target, 'CLAUDE.md')), '');
  check('.mcp.json (codex-only registration) is removed', !fs.existsSync(path.join(target, '.mcp.json')), '');
  check('no .claude/skills/* remain', !fs.existsSync(path.join(target, '.claude', 'skills')) || fs.readdirSync(path.join(target, '.claude', 'skills')).length === 0, '');

  // Uninstalling a project that was never installed is a harmless no-op.
  const untouched = tmpdir('orchestra-install-');
  const r2 = install(untouched, ['--uninstall']);
  check('uninstalling a never-installed project succeeds', ok(r2), out(r2));
  check('reports "nothing to remove"', /nothing to remove/i.test(out(r2)), out(r2));
}

function case4_userSettingsPreserved() {
  section('4. User keys in settings.json / .mcp.json / orchestra.json survive install byte-for-byte');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'settings.json'), JSON.stringify({
    myCustomSetting: 'keep-me',
    permissions: { allow: ['Bash(npm test:*)'] },
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node my-own-bash-hook.js' }] }],
    },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(target, '.mcp.json'), JSON.stringify({ mcpServers: { myOwnServer: { command: 'node', args: ['own.js'] } } }, null, 2), 'utf8');
  fs.writeFileSync(path.join(target, '.claude', 'orchestra.json'), JSON.stringify({ directorAllowedTools: ['Glob'] }, null, 2), 'utf8');

  const r = install(target, ['--no-packs', '--no-specialists']);
  check('install over an existing project with user keys succeeds', ok(r), out(r));

  const settings = readJson(path.join(target, '.claude', 'settings.json'));
  check("user's own PreToolUse(Bash) entry survives alongside the guard entry",
    settings.hooks.PreToolUse.some((e) => e.matcher === 'Bash' && e.hooks[0].command === 'node my-own-bash-hook.js') && settings.hooks.PreToolUse.length === 2,
    JSON.stringify(settings.hooks.PreToolUse));
  check('settings.json: unrelated top-level key preserved', settings.myCustomSetting === 'keep-me', JSON.stringify(settings));
  check('settings.json: pre-existing unrelated allow entry preserved', settings.permissions.allow.includes('Bash(npm test:*)'), JSON.stringify(settings.permissions));

  const mcp = readJson(path.join(target, '.mcp.json'));
  check('.mcp.json: pre-existing server entry preserved', mcp.mcpServers && mcp.mcpServers.myOwnServer && mcp.mcpServers.myOwnServer.command === 'node', JSON.stringify(mcp));

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('orchestra.json: pre-existing directorAllowedTools preserved', JSON.stringify(manifest.directorAllowedTools) === JSON.stringify(['Glob']), JSON.stringify(manifest));
}

function case5_packSelectionAndMcpMerge() {
  section('5. Pack selection installs its agents/hooks/skill and merges .mcp.json without clobbering unrelated entries');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.mcp.json'), JSON.stringify({ mcpServers: { unrelatedServer: { command: 'node', args: ['unrelated.js'] } } }, null, 2), 'utf8');

  const r = install(target, ['--packs', 'codex', '--no-specialists']);
  check('install with --packs codex succeeds', ok(r), out(r));

  const c = census(target);
  check('pack agents installed', c.includes('.claude/agents/reviewer-codex.md') && c.includes('.claude/agents/executor-codex-heavy.md'), c.join('\n'));
  check('pack hooks installed', c.includes('.claude/hooks/orchestra-review.js') && c.includes('.claude/hooks/orchestra-engine-mcp.js'), c.join('\n'));
  check('pack skill installed', c.includes('.claude/skills/cross-compare-plan/SKILL.md'), c.join('\n'));

  const mcp = readJson(path.join(target, '.mcp.json'));
  check('pack MCP server registered (orchestra-engine)', !!mcp.mcpServers && !!mcp.mcpServers['orchestra-engine'], JSON.stringify(mcp));
  check('pre-existing unrelated MCP server entry survives the merge', !!mcp.mcpServers && !!mcp.mcpServers.unrelatedServer, JSON.stringify(mcp));

  const state = readJson(path.join(target, '.claude', 'orchestra-install.json'));
  check('orchestra-install.json records the pack selection', Array.isArray(state.packs) && state.packs.includes('codex'), JSON.stringify(state));

  // Deselecting the pack removes exactly its own files and MCP registration.
  const rDrop = install(target, ['--no-packs']);
  check('deselecting the pack succeeds', ok(rDrop), out(rDrop));
  const cAfter = census(target);
  check('pack agents removed', !cAfter.includes('.claude/agents/reviewer-codex.md'), cAfter.join('\n'));
  check('pack skill removed', !cAfter.includes('.claude/skills/cross-compare-plan/SKILL.md'), cAfter.join('\n'));
  const mcpAfter = readJson(path.join(target, '.mcp.json'));
  check('pack MCP server removed on deselect', !mcpAfter.mcpServers || !mcpAfter.mcpServers['orchestra-engine'], JSON.stringify(mcpAfter));
  check('unrelated MCP server entry still survives after deselecting the pack', !!mcpAfter.mcpServers && !!mcpAfter.mcpServers.unrelatedServer, JSON.stringify(mcpAfter));

  // Unknown pack name is refused before anything is touched.
  const badTarget = tmpdir('orchestra-install-');
  const rBad = install(badTarget, ['--packs', 'not-a-real-pack']);
  check('unknown pack name refuses the install', rBad.status !== 0, out(rBad));
  check('unknown pack -> nothing copied', !fs.existsSync(path.join(badTarget, '.claude', 'agents')), '');
}

function case6_specialists() {
  section('6. Specialists install/uninstall alongside the core agents; unknown specialist name refused');

  const target = tmpdir('orchestra-install-');
  const r = install(target, ['--specialists', 'modeler', '--no-packs']);
  check('install with --specialists modeler succeeds', ok(r), out(r));
  check('specialist file installed alongside the core six', fs.existsSync(path.join(target, '.claude', 'agents', 'modeler.md')), '');

  const state = readJson(path.join(target, '.claude', 'orchestra-install.json'));
  check('orchestra-install.json records the specialist selection', Array.isArray(state.specialists) && state.specialists.includes('modeler'), JSON.stringify(state));

  const rUninstall = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(rUninstall), out(rUninstall));
  check('specialist file removed on uninstall', !fs.existsSync(path.join(target, '.claude', 'agents', 'modeler.md')), '');

  const badTarget = tmpdir('orchestra-install-');
  const rBad = install(badTarget, ['--specialists', 'not-a-real-specialist']);
  check('unknown specialist name refuses the install', rBad.status !== 0, out(rBad));
  check('unknown specialist -> nothing copied', !fs.existsSync(path.join(badTarget, '.claude', 'agents')), '');
}

const PUSH_SAFE_ALLOW = ['Bash(git push origin HEAD)', 'Bash(git push -u origin HEAD)'];
const PUSH_DENY_EXPECTED = [
  'Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git push --delete*)', 'Bash(git push --mirror*)',
  'Bash(git push * --force*)', 'Bash(git push -d*)', 'Bash(git push --del*)', 'Bash(git push --mir*)',
  'Bash(git push --prune*)', 'Bash(git push * +*)', 'Bash(git push * :*)', 'Bash(git push origin --delete*)',
];

function case7_permissionOwnership() {
  section('7. Permission ownership: installedPermissions/installedDeny track only what THIS installer added; --grants-local; userOwnedPermissions escape hatch');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git commit:*)'] } }), 'utf8');

  install(target, ['--grant-push', '--no-packs', '--no-specialists']);
  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  const expectedTracked = ['Bash(git add:*)', 'Bash(git checkout -b:*)', 'Bash(git switch -c:*)'].concat(PUSH_SAFE_ALLOW).sort();
  check(
    'installedPermissions entries are {file, entry} pairs, all against settings.json',
    Array.isArray(manifest.installedPermissions) && manifest.installedPermissions.every((e) => e && e.file === 'settings.json' && typeof e.entry === 'string'),
    JSON.stringify(manifest.installedPermissions)
  );
  check(
    'installedPermissions tracks only what THIS run added (not the pre-existing commit grant)',
    JSON.stringify(manifest.installedPermissions.map((e) => e.entry).slice().sort()) === JSON.stringify(expectedTracked),
    JSON.stringify(manifest.installedPermissions)
  );
  check(
    'installedDeny tracks the push deny counterweight',
    manifest.installedDeny.every((e) => e.file === 'settings.json') && JSON.stringify(manifest.installedDeny.map((e) => e.entry).slice().sort()) === JSON.stringify(PUSH_DENY_EXPECTED.slice().sort()),
    JSON.stringify(manifest.installedDeny)
  );
  check('roster/seats/rosterGeneration are NOT written by grant tracking', !('roster' in manifest) && !('seats' in manifest) && !('rosterGeneration' in manifest), JSON.stringify(manifest));

  const r = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(r), out(r));
  const settingsAfter = readJson(path.join(target, '.claude', 'settings.json'));
  const allowAfter = (settingsAfter.permissions && settingsAfter.permissions.allow) || [];
  check('uninstall removes the installer-added add grant', !allowAfter.includes('Bash(git add:*)'), JSON.stringify(allowAfter));
  check('uninstall PRESERVES the identical user-added commit grant (never tracked as ours)', allowAfter.includes('Bash(git commit:*)'), JSON.stringify(allowAfter));
  const denyAfter = (settingsAfter.permissions && settingsAfter.permissions.deny) || [];
  check('uninstall removes the deny counterweight', denyAfter.length === 0, JSON.stringify(denyAfter));

  // --grants-local writes to settings.local.json instead.
  const localTarget = tmpdir('orchestra-install-');
  const rLocal = install(localTarget, ['--grant-push', '--grants-local', '--no-packs', '--no-specialists']);
  check('--grants-local install succeeds', ok(rLocal), out(rLocal));
  const shared = readJson(path.join(localTarget, '.claude', 'settings.json'));
  check('settings.json carries NO git grants under --grants-local', !((shared.permissions && shared.permissions.allow) || []).some((p) => p.indexOf('git') !== -1), JSON.stringify(shared.permissions));
  const local = readJson(path.join(localTarget, '.claude', 'settings.local.json'));
  check('settings.local.json carries the git grants instead', local.permissions && local.permissions.allow.includes('Bash(git add:*)'), JSON.stringify(local.permissions));

  // userOwnedPermissions escape hatch protects a broad legacy push grant.
  const ownedTarget = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(ownedTarget, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(ownedTarget, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git push:*)'] } }), 'utf8');
  fs.writeFileSync(path.join(ownedTarget, '.claude', 'orchestra.json'), JSON.stringify({ userOwnedPermissions: ['Bash(git push:*)'] }), 'utf8');
  install(ownedTarget, ['--no-packs', '--no-specialists']);
  const ownedSettings = readJson(path.join(ownedTarget, '.claude', 'settings.json'));
  check('userOwnedPermissions protects the broad push grant from being stripped', ownedSettings.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(ownedSettings.permissions.allow));

  // An unmarked broad legacy grant IS stripped on every install (upgrade hygiene).
  const strippedTarget = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(strippedTarget, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(strippedTarget, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git add:*)', 'Bash(git push:*)'] } }), 'utf8');
  install(strippedTarget, ['--no-packs', '--no-specialists']);
  const strippedSettings = readJson(path.join(strippedTarget, '.claude', 'settings.json'));
  check('the broad Bash(git push:*) grant is stripped without --grant-push', !strippedSettings.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(strippedSettings.permissions.allow));
}

function case8_claudeMdMarker() {
  section('8. CLAUDE.md managed marker block: installed, survives re-run, protects surrounding user content, removed cleanly on uninstall');

  const target = tmpdir('orchestra-install-');
  fs.writeFileSync(path.join(target, 'CLAUDE.md'), '# My project notes\n\nSome user content.\n', 'utf8');

  const r = install(target, ['--no-packs', '--no-specialists']);
  check('install over an existing CLAUDE.md succeeds', ok(r), out(r));
  const md1 = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8');
  check('user content survives above the marker block', md1.includes('# My project notes') && md1.includes('Some user content.'), md1);
  check('managed marker block present', md1.includes('ORCHESTRA:BEGIN') && md1.includes('ORCHESTRA:END'), md1);

  // A re-run must not duplicate the block or disturb user content.
  install(target, ['--no-packs', '--no-specialists']);
  const md2 = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8');
  check('re-run does not duplicate the marker block', (md2.match(/ORCHESTRA:BEGIN/g) || []).length === 1, md2);
  check('re-run does not duplicate user content', (md2.match(/My project notes/g) || []).length === 1, md2);

  const rUninstall = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(rUninstall), out(rUninstall));
  const md3 = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8');
  check('uninstall removes the marker block but keeps user content', !md3.includes('ORCHESTRA:BEGIN') && md3.includes('My project notes'), md3);

  // A CLAUDE.md that held ONLY the marker block is deleted entirely.
  const target2 = tmpdir('orchestra-install-');
  install(target2, ['--no-packs', '--no-specialists']);
  const rUninstall2 = install(target2, ['--uninstall']);
  check('uninstall of an Orchestra-only CLAUDE.md removes the file', ok(rUninstall2) && !fs.existsSync(path.join(target2, 'CLAUDE.md')), out(rUninstall2));
}

function case9_frontmatterRefusal() {
  section('9. A core agent with unparseable frontmatter fails the install-time lint gate before anything is copied');

  // Work against a throwaway copy of the master so the real repo is never
  // touched, mirroring how the frontmatter-lint suite isolates its fixtures.
  const masterCopy = tmpdir('orchestra-master-');
  const files = spawnSync('git', ['-C', MASTER, 'ls-files'], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);
  for (const rel of files) {
    const src = path.join(MASTER, rel);
    const dest = path.join(masterCopy, rel);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue; // git ls-files can list a working-tree deletion not yet staged
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  const installerCopy = path.join(masterCopy, 'install.js');

  const badTarget = tmpdir('orchestra-install-');
  const scoutAgent = path.join(masterCopy, 'agents', 'scout.md');
  const original = fs.readFileSync(scoutAgent, 'utf8');
  // A bare ": " inside an unquoted scalar makes the whole frontmatter block
  // fail to parse — the class the lint gate exists to catch.
  fs.writeFileSync(scoutAgent, original.replace(/^description:.*$/m, 'description: launcher: it runs'), 'utf8');
  const rBad = spawnSync(process.execPath, [installerCopy, badTarget, '--no-packs', '--no-specialists'], { encoding: 'utf8', timeout: 60000 });
  check('a core agent with unparseable frontmatter fails the install-time lint gate', rBad.status !== 0, (rBad.stdout || '') + (rBad.stderr || ''));
  check('nothing was copied when the lint gate fails', !fs.existsSync(path.join(badTarget, '.claude', 'agents')), '');
  fs.writeFileSync(scoutAgent, original, 'utf8');

  // A plain --lint pass against an unmodified master still succeeds.
  const rLint = spawnSync(process.execPath, [INSTALLER, '--lint'], { encoding: 'utf8', timeout: 60000, cwd: MASTER });
  check('node install.js --lint (master) exits 0', rLint.status === 0, out(rLint));
}

function case10_malformedJsonRefusedNothingTouched() {
  section('10. Malformed JSON in settings.json / .mcp.json / orchestra.json refuses BEFORE touching anything');

  const cases = [
    ['settings.json', ['.claude', 'settings.json']],
    ['.mcp.json', ['.mcp.json']],
    ['orchestra.json', ['.claude', 'orchestra.json']],
  ];
  for (const [label, parts] of cases) {
    const target = tmpdir('orchestra-install-');
    const filePath = path.join(target, ...parts);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{ this is not json', 'utf8');
    const before = census(target);

    const r = install(target, ['--no-packs', '--no-specialists']);
    check('malformed ' + label + ' -> install exits non-zero', r.status !== 0, 'status=' + r.status);
    check('malformed ' + label + ' -> error names the file', new RegExp(label.replace('.', '\\.')).test(out(r)), out(r));
    const after = census(target);
    check('malformed ' + label + ' -> nothing else was copied (census unchanged)', JSON.stringify(before) === JSON.stringify(after), '');
  }
}

// --------------------------------------------------- config preflight (new)

function case11_preflightRefusesRosterNew() {
  section('11. Preflight refuses a roster:"new" target before writing anything (Design Decision 8)');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  writeJsonFile(path.join(target, '.claude', 'orchestra.json'), { roster: 'new', projectId: 'abc123' });
  const before = census(target);
  check('(setup) only orchestra.json exists before the attempt', before.join(',') === '.claude/orchestra.json', before.join(','));

  const r = install(target, ['--packs', 'codex']);
  check('install of a roster:new target exits non-zero', r.status !== 0, out(r));
  check(
    'refusal message is the exact plan text',
    out(r).indexOf(
      '3.0 cannot safely upgrade a 2.0 roster:new install in place. Check out v2.5.0-final, ' +
        'run its installer with <project> --uninstall, then retry this install.'
    ) !== -1,
    out(r)
  );
  const after = census(target);
  check('nothing was written — census unchanged', JSON.stringify(before) === JSON.stringify(after), 'before=' + before.join(',') + ' after=' + after.join(','));
  const manifestAfter = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('the roster:new manifest itself is untouched', manifestAfter.roster === 'new' && manifestAfter.projectId === 'abc123', JSON.stringify(manifestAfter));
}

function case12_scrubDeprecatedKeys() {
  section('12. Preflight scrubs exactly the named deprecated keys, preserving an unrelated custom key and codex minus its three');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  writeJsonFile(path.join(target, '.claude', 'orchestra.json'), {
    roster: 'legacy',
    rosterGeneration: 3,
    seats: { Architect: true },
    projectId: 'xyz',
    installedHooks: ['PreToolUse'],
    installedStore: true,
    installedFiles: ['agents/foo.md'],
    verifier: { foo: 'bar' },
    reviewEngine: 'codex',
    myCustomKey: 'keep-me',
    codex: {
      execModel: 'gpt-5.6-terra',
      execEffort: 'medium',
      execLightModel: 'gpt-5.6-mini',
      reviewModel: 'gpt-5.6-sol',
    },
  });

  const r = install(target, ['--no-packs', '--no-specialists']);
  check('install over a legacy target with deprecated keys succeeds', ok(r), out(r));

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  for (const key of ['roster', 'rosterGeneration', 'seats', 'projectId', 'installedHooks', 'installedStore', 'installedFiles', 'verifier', 'reviewEngine']) {
    check('deprecated top-level key "' + key + '" removed', !(key in manifest), JSON.stringify(manifest));
  }
  check('unrelated custom key preserved', manifest.myCustomKey === 'keep-me', JSON.stringify(manifest));
  check('codex block preserved minus its three deprecated keys', manifest.codex && manifest.codex.reviewModel === 'gpt-5.6-sol' && !('execModel' in manifest.codex) && !('execEffort' in manifest.codex) && !('execLightModel' in manifest.codex), JSON.stringify(manifest.codex));
  check('scrub is reported, one line per removed key', /scrubbed deprecated key "roster"/.test(out(r)) && /scrubbed deprecated key "codex\.execModel"/.test(out(r)), out(r));
}

function case13_orphanedRuntimeDirWarns() {
  section('13. An orphaned .claude/orchestra/ directory produces one warning and survives untouched');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude', 'orchestra', 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'orchestra', 'tickets', 'tickets.json'), '{"leftover":true}', 'utf8');

  const r = install(target, ['--no-packs', '--no-specialists']);
  check('install over an orphaned runtime dir succeeds', ok(r), out(r));
  check('the orphan warning names the directory', /\.claude\/orchestra\/ is orphaned 2\.0 runtime state/.test(out(r)), out(r));
  check('the orphaned directory survives untouched', fs.readFileSync(path.join(target, '.claude', 'orchestra', 'tickets', 'tickets.json'), 'utf8') === '{"leftover":true}', '');
}

function case14_noRosterKeyInInstallState() {
  section('14. .claude/orchestra-install.json has no "roster" key after install (fresh, re-run, or over a scrubbed legacy target)');

  const fresh = tmpdir('orchestra-install-');
  install(fresh, ['--packs', 'codex', '--specialists', 'modeler']);
  const stateFresh = readJson(path.join(fresh, '.claude', 'orchestra-install.json'));
  check('fresh install state has no roster key', !('roster' in stateFresh), JSON.stringify(stateFresh));

  install(fresh, []); // re-run
  const stateReRun = readJson(path.join(fresh, '.claude', 'orchestra-install.json'));
  check('re-run state still has no roster key', !('roster' in stateReRun), JSON.stringify(stateReRun));

  const legacyTarget = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(legacyTarget, '.claude'), { recursive: true });
  writeJsonFile(path.join(legacyTarget, '.claude', 'orchestra.json'), { roster: 'legacy', seats: { Architect: true } });
  install(legacyTarget, ['--no-packs', '--no-specialists']);
  const stateScrubbed = readJson(path.join(legacyTarget, '.claude', 'orchestra-install.json'));
  check('install state over a scrubbed legacy target has no roster key', !('roster' in stateScrubbed), JSON.stringify(stateScrubbed));
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
  case1_freshInstallCensus();
  case2_idempotentReRun();
  case3_uninstallLeavesStandardProject();
  case4_userSettingsPreserved();
  case5_packSelectionAndMcpMerge();
  case6_specialists();
  case7_permissionOwnership();
  case8_claudeMdMarker();
  case9_frontmatterRefusal();
  case10_malformedJsonRefusedNothingTouched();
  case11_preflightRefusesRosterNew();
  case12_scrubDeprecatedKeys();
  case13_orphanedRuntimeDirWarns();
  case14_noRosterKeyInInstallState();
} catch (e) {
  check('the suite ran to completion', false, (e && e.stack) || e);
}
finish();
