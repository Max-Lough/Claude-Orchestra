#!/usr/bin/env node
/**
 * Installer tests for install.js — WO-14b leg 3 (--roster legacy|new, git
 * grants, refuse-before-touch, uninstall ordering, installedPermissions).
 *
 *   node tests/install.test.js
 *
 * Same conventions as tests/frontmatter-lint.test.js: fresh temp dirs via
 * fs.mkdtempSync, spawnSync against the real installer (no stubbing), and
 * exit-code discipline enforced by an exit handler.
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

function ok(r) {
  return r.status === 0;
}
function out(r) {
  return (r.stdout || '') + (r.stderr || '');
}

// ---------------------------------------------------------------- cases

function case1_legacyCensusUnchanged() {
  section('1. --roster legacy (default) is byte-for-byte today\'s behaviour — file census');

  const plain = tmpdir('orchestra-install-');
  const rPlain = install(plain, ['--no-packs', '--no-specialists']);
  check('plain install (no --roster flag) succeeds', ok(rPlain), out(rPlain));

  const explicit = tmpdir('orchestra-install-');
  const rExplicit = install(explicit, ['--roster', 'legacy', '--no-packs', '--no-specialists']);
  check('--roster legacy (explicit) succeeds', ok(rExplicit), out(rExplicit));

  const cPlain = census(plain);
  const cExplicit = census(explicit);
  check('plain install and explicit --roster legacy install produce an IDENTICAL file census', JSON.stringify(cPlain) === JSON.stringify(cExplicit), cPlain.join('\n') + '\n---\n' + cExplicit.join('\n'));

  // None of the eleven roster role files, the conductor file, or the
  // .claude/orchestra/ runtime directory appear in a legacy install.
  const hasRosterFile = cPlain.some((f) => /\/(architect|builder|red-team|reviewer-anthropic|reviewer-openai|sweeper)\.md$/.test(f));
  check('no new-roster agent files under a legacy install', !hasRosterFile, cPlain.join('\n'));
  check('no .claude/ORCHESTRA-CONDUCTOR.md under a legacy install', !cPlain.includes('.claude/ORCHESTRA-CONDUCTOR.md'), cPlain.join('\n'));
  check('no .claude/orchestra/ runtime directory under a legacy install', !cPlain.some((f) => f.startsWith('.claude/orchestra/')), cPlain.join('\n'));
}

function case2_newRosterCensus() {
  section('2. --roster new: full file census (roster agents, conductor file, substrates, bridge/ absence handled silently)');

  const target = tmpdir('orchestra-install-');
  const r = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('--roster new install succeeds', ok(r), out(r));

  const c = census(target);
  const expectRoleFiles = [
    '.claude/agents/architect.md',
    '.claude/agents/builder.md',
    '.claude/agents/data-engineer.md',
    '.claude/agents/investigator.md',
    '.claude/agents/red-team.md',
    '.claude/agents/reviewer-anthropic.md',
    '.claude/agents/reviewer-openai.md',
    '.claude/agents/sweeper.md',
    '.claude/agents/test-designer-vs-anthropic.md',
    '.claude/agents/test-designer-vs-openai.md',
  ];
  for (const f of expectRoleFiles) {
    check('census includes ' + f, c.includes(f), c.join('\n'));
  }
  check('conductor.md is NOT installed as a spawnable agent (.claude/agents/conductor.md absent)', !c.includes('.claude/agents/conductor.md'), c.join('\n'));
  check('conductor.md instead lands at .claude/ORCHESTRA-CONDUCTOR.md', c.includes('.claude/ORCHESTRA-CONDUCTOR.md'), c.join('\n'));
  check('the legacy six agents are ALSO installed (both rosters co-install)', c.includes('.claude/agents/scout.md') && c.includes('.claude/agents/executor.md'), c.join('\n'));

  for (const sub of ['router', 'registry', 'verifier', 'quartermaster']) {
    const hasReadme = c.includes('.claude/orchestra/' + sub + '/README.md');
    check('substrate ' + sub + '/ is installed with its README.md', hasReadme, c.join('\n'));
  }
  // bridge/ does not exist in this master today — its absence must be
  // handled silently: no file, and no error/warning line about it.
  const hasBridgeSrc = fs.existsSync(path.join(MASTER, 'bridge'));
  const hasBridgeDest = c.some((f) => f.startsWith('.claude/orchestra/bridge/'));
  check(
    'bridge/ census matches source-tree presence (today: absent both places, handled silently)',
    hasBridgeSrc === hasBridgeDest,
    'source has bridge/: ' + hasBridgeSrc + ', installed bridge/: ' + hasBridgeDest
  );
  check('no warning/error text about bridge/ when it is simply absent', !/bridge/i.test(out(r)) || hasBridgeSrc, out(r));

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('manifest roster === "new"', manifest.roster === 'new', JSON.stringify(manifest));
  check('manifest seats === {Architect:true, Sweeper:false}', manifest.seats && manifest.seats.Architect === true && manifest.seats.Sweeper === false, JSON.stringify(manifest));
  check('manifest rosterGeneration starts at 1', manifest.rosterGeneration === 1, JSON.stringify(manifest));
}

function case3_flipBumpsGenerationLeavesFiles() {
  section('3. Flipping new -> legacy bumps rosterGeneration and LEAVES the new-roster files in place (rollback is a flag flip)');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const before = census(target);
  const genBefore = readJson(path.join(target, '.claude', 'orchestra.json')).rosterGeneration;

  const r = install(target, ['--roster', 'legacy', '--no-packs', '--no-specialists']);
  check('flip to --roster legacy succeeds', ok(r), out(r));

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('manifest roster flipped to "legacy"', manifest.roster === 'legacy', JSON.stringify(manifest));
  check('rosterGeneration bumped by exactly 1', manifest.rosterGeneration === genBefore + 1, 'before=' + genBefore + ' after=' + manifest.rosterGeneration);

  const after = census(target);
  check('every new-roster file installed before the flip is STILL present after it', before.every((f) => after.includes(f)), 'missing: ' + before.filter((f) => !after.includes(f)).join(', '));

  // Flipping back to new again a second time is a no-op on generation (no
  // flip occurred: roster was already "new" going into a --roster new run).
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const genFlippedBack = readJson(path.join(target, '.claude', 'orchestra.json')).rosterGeneration;
  check('flipping back to new bumps generation again (new->legacy->new = two flips)', genFlippedBack === genBefore + 2, 'genBefore=' + genBefore + ' now=' + genFlippedBack);
  const r2 = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const genIdempotent = readJson(path.join(target, '.claude', 'orchestra.json')).rosterGeneration;
  check('re-running --roster new with no flip does NOT bump generation again', ok(r2) && genIdempotent === genFlippedBack, 'before=' + genFlippedBack + ' after=' + genIdempotent);
}

function case4_userKeysPreserved() {
  section('4. User keys in settings.json, .mcp.json, and orchestra.json survive install byte-for-byte');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'settings.json'), JSON.stringify({ myCustomSetting: 'keep-me', permissions: { allow: ['Bash(npm test:*)'] } }, null, 2), 'utf8');
  fs.writeFileSync(path.join(target, '.mcp.json'), JSON.stringify({ mcpServers: { myOwnServer: { command: 'node', args: ['own.js'] } } }, null, 2), 'utf8');
  fs.writeFileSync(path.join(target, '.claude', 'orchestra.json'), JSON.stringify({ directorAllowedTools: ['Glob'], reviewEngine: 'opus' }, null, 2), 'utf8');

  const r = install(target, ['--roster', 'new', '--grant-push', '--no-packs', '--no-specialists']);
  check('install over an existing project with user keys succeeds', ok(r), out(r));

  const settings = readJson(path.join(target, '.claude', 'settings.json'));
  check('settings.json: unrelated top-level key preserved', settings.myCustomSetting === 'keep-me', JSON.stringify(settings));
  check('settings.json: pre-existing unrelated allow entry preserved', settings.permissions.allow.includes('Bash(npm test:*)'), JSON.stringify(settings.permissions));

  const mcp = readJson(path.join(target, '.mcp.json'));
  check('.mcp.json: pre-existing server entry preserved', mcp.mcpServers && mcp.mcpServers.myOwnServer && mcp.mcpServers.myOwnServer.command === 'node', JSON.stringify(mcp));

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('orchestra.json: pre-existing directorAllowedTools preserved', JSON.stringify(manifest.directorAllowedTools) === JSON.stringify(['Glob']), JSON.stringify(manifest));
  check('orchestra.json: pre-existing reviewEngine preserved', manifest.reviewEngine === 'opus', JSON.stringify(manifest));
  check('orchestra.json: roster/seats/rosterGeneration/installedPermissions also present', manifest.roster === 'new' && manifest.seats && typeof manifest.rosterGeneration === 'number' && Array.isArray(manifest.installedPermissions), JSON.stringify(manifest));
}

function case5_malformedJsonRefusedNothingTouched() {
  section('5. Malformed JSON in settings.json / .mcp.json / orchestra.json refuses BEFORE touching anything');

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

    const r = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
    check('malformed ' + label + ' -> install exits non-zero', r.status !== 0, 'status=' + r.status);
    check('malformed ' + label + ' -> error names the file', new RegExp(label.replace('.', '\\.')).test(out(r)), out(r));
    const after = census(target);
    check('malformed ' + label + ' -> nothing else was copied (census unchanged)', JSON.stringify(before) === JSON.stringify(after), 'before=' + before.join(',') + ' after=' + after.join(','));
  }
}

function case6_malformedPermissionsRefused() {
  section('6. Malformed "permissions" (a string, an array) refused — never silently replaced');

  for (const bad of ['"not-an-object"', '["also","bad"]']) {
    const target = tmpdir('orchestra-install-');
    fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude', 'settings.json'), '{"permissions":' + bad + '}', 'utf8');
    const r = install(target, ['--no-packs', '--no-specialists']);
    check('permissions=' + bad + ' -> exits non-zero', r.status !== 0, 'status=' + r.status);
    check('permissions=' + bad + ' -> names the offending value', out(r).indexOf(bad.replace(/"/g, '')) !== -1 || out(r).indexOf(bad) !== -1, out(r));
    check('permissions=' + bad + ' -> nothing copied (no agents dir)', !fs.existsSync(path.join(target, '.claude', 'agents')), '');
  }

  // A malformed permissions.allow (not an array) is refused the same way.
  const target2 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target2, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target2, '.claude', 'settings.json'), '{"permissions":{"allow":"nope"}}', 'utf8');
  const r2 = install(target2, ['--no-packs', '--no-specialists']);
  check('permissions.allow as a string -> exits non-zero, nothing copied', r2.status !== 0 && !fs.existsSync(path.join(target2, '.claude', 'agents')), out(r2));
}

function case7_uninstallOrderSettingsFirst() {
  section('7. --uninstall reads/validates settings FIRST; malformed -> nothing deleted');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--grant-push', '--no-packs', '--no-specialists']);
  const before = census(target);
  check('fixture install for the uninstall-order case succeeded', before.length > 0, before.join(','));

  // Corrupt settings.json AFTER a real install exists, then attempt uninstall.
  fs.writeFileSync(path.join(target, '.claude', 'settings.json'), '{ broken', 'utf8');
  const r = install(target, ['--uninstall']);
  check('--uninstall over malformed settings.json exits non-zero', r.status !== 0, 'status=' + r.status);

  const afterAttempt = census(target);
  const onlySettingsChanged = afterAttempt.length === before.length; // nothing removed
  check('--uninstall over malformed settings.json deletes NOTHING (file count unchanged)', onlySettingsChanged, 'before=' + before.length + ' after=' + afterAttempt.length);
}

function case8_grantsDefaultVsGrantPush() {
  section('8. Grants: add+commit by default; push (with deny counterweight) only behind --grant-push');

  const defTarget = tmpdir('orchestra-install-');
  install(defTarget, ['--no-packs', '--no-specialists']);
  const defSettings = readJson(path.join(defTarget, '.claude', 'settings.json'));
  check('default install grants Bash(git add:*)', defSettings.permissions.allow.includes('Bash(git add:*)'), JSON.stringify(defSettings.permissions));
  check('default install grants Bash(git commit:*)', defSettings.permissions.allow.includes('Bash(git commit:*)'), JSON.stringify(defSettings.permissions));
  check('default install does NOT grant Bash(git push:*)', !defSettings.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(defSettings.permissions));
  check('default install writes no permissions.deny', !defSettings.permissions.deny, JSON.stringify(defSettings.permissions));

  const pushTarget = tmpdir('orchestra-install-');
  install(pushTarget, ['--grant-push', '--no-packs', '--no-specialists']);
  const pushSettings = readJson(path.join(pushTarget, '.claude', 'settings.json'));
  check('--grant-push grants Bash(git push:*)', pushSettings.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(pushSettings.permissions));
  const expectedDeny = [
    'Bash(git push --force*)',
    'Bash(git push -f*)',
    'Bash(git push --delete*)',
    'Bash(git push --mirror*)',
    'Bash(git push * --force*)',
  ];
  for (const d of expectedDeny) {
    check('--grant-push deny counterweight includes ' + d, (pushSettings.permissions.deny || []).includes(d), JSON.stringify(pushSettings.permissions.deny));
  }
}

function case9_installedPermissionsTracking() {
  section('9. installedPermissions tracks only what THIS installer added — uninstall removes exactly that');

  const target = tmpdir('orchestra-install-');
  // A user-added grant that happens to be identical to one Orchestra also
  // manages, added BEFORE Orchestra ever touches the project.
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git commit:*)'] } }), 'utf8');

  install(target, ['--grant-push', '--no-packs', '--no-specialists']);
  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  check(
    'installedPermissions tracks only the entries THIS run actually added (not the pre-existing git commit grant)',
    JSON.stringify(manifest.installedPermissions.slice().sort()) === JSON.stringify(['Bash(git add:*)', 'Bash(git push:*)'].sort()),
    JSON.stringify(manifest.installedPermissions)
  );

  const r = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(r), out(r));
  const settingsAfter = readJson(path.join(target, '.claude', 'settings.json'));
  const allowAfter = (settingsAfter.permissions && settingsAfter.permissions.allow) || [];
  check('uninstall removes the installer-added push grant', !allowAfter.includes('Bash(git push:*)'), JSON.stringify(allowAfter));
  check('uninstall removes the installer-added add grant', !allowAfter.includes('Bash(git add:*)'), JSON.stringify(allowAfter));
  check('uninstall PRESERVES the identical user-added commit grant (it was never tracked as ours)', allowAfter.includes('Bash(git commit:*)'), JSON.stringify(allowAfter));
  const denyAfter = (settingsAfter.permissions && settingsAfter.permissions.deny) || [];
  check('uninstall removes the deny counterweight that rode along with the tracked push grant', denyAfter.length === 0, JSON.stringify(denyAfter));
}

function case10_lintGreenOnElevenFileRoster() {
  section('10. --lint is unchanged in behaviour and passes on the eleven-file roster');

  const r = spawnSync(process.execPath, [INSTALLER, '--lint', path.join(MASTER, 'roster')], { encoding: 'utf8', timeout: 60000 });
  check('node install.js --lint roster exits 0', r.status === 0, out(r));

  const rMaster = spawnSync(process.execPath, [INSTALLER, '--lint'], { encoding: 'utf8', timeout: 60000, cwd: MASTER });
  check('node install.js --lint (whole master) exits 0', rMaster.status === 0, out(rMaster));
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
  case1_legacyCensusUnchanged();
  case2_newRosterCensus();
  case3_flipBumpsGenerationLeavesFiles();
  case4_userKeysPreserved();
  case5_malformedJsonRefusedNothingTouched();
  case6_malformedPermissionsRefused();
  case7_uninstallOrderSettingsFirst();
  case8_grantsDefaultVsGrantPush();
  case9_installedPermissionsTracking();
  case10_lintGreenOnElevenFileRoster();
} catch (e) {
  check('the suite ran to completion', false, (e && e.stack) || e);
}
finish();
