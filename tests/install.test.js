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
const crypto = require('crypto');
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

// Every spawned installer run in this suite must write its manifest pin
// (item 9) somewhere disposable — never a developer's or CI runner's real
// ~/.claude/orchestra/pins/. One shared temp dir for the whole suite run,
// cleaned up with everything else.
const DEFAULT_PIN_DIR = tmpdir('orchestra-pins-default-');
const DEFAULT_ENV = Object.assign({}, process.env, { ORCHESTRA_PIN_DIR: DEFAULT_PIN_DIR });

function install(target, extraArgs) {
  return spawnSync(process.execPath, [INSTALLER, target].concat(extraArgs || []), {
    encoding: 'utf8',
    timeout: 120000,
    cwd: MASTER,
    env: DEFAULT_ENV,
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

// After a test hand-edits a manifest in place (to plant a hostile
// installedFiles/installedPermissions ledger), the pin the installer wrote
// no longer hash-matches. Some tests (item 1's containment check) want to
// exercise the LEDGER-TRUSTED path specifically, isolated from item 2's
// pin-mismatch fallback — so this recomputes the pin's manifestSha256 (and
// its id-keyed twin, if any) against the edited bytes, the way a real
// install's writePin() would, without going through the installer CLI.
function repinAfterHandEdit(target, manifestPath) {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
  const realDir = fs.realpathSync(target);
  const hash = crypto.createHash('sha256').update(realDir, 'utf8').digest('hex');
  const pf = path.join(DEFAULT_PIN_DIR, hash + '.json');
  if (!fs.existsSync(pf)) return;
  const pin = JSON.parse(fs.readFileSync(pf, 'utf8'));
  pin.manifestSha256 = sha;
  const body = JSON.stringify(pin, null, 2) + '\n';
  fs.writeFileSync(pf, body, 'utf8');
  if (pin.projectId) {
    const idHash = crypto.createHash('sha256').update(String(pin.projectId), 'utf8').digest('hex');
    const idPf = path.join(DEFAULT_PIN_DIR, 'id-' + idHash + '.json');
    if (fs.existsSync(idPf)) fs.writeFileSync(idPf, body, 'utf8');
  }
}

// Mirror install.js's pinFilePath()/idPinFilePath() hashing so tests can name
// the exact files a pin dir should (or shouldn't) hold, without re-deriving
// the scheme inline at every call site.
function pinFilePathFor(target, pinDir) {
  const hash = crypto.createHash('sha256').update(fs.realpathSync(target), 'utf8').digest('hex');
  return path.join(pinDir || DEFAULT_PIN_DIR, hash + '.json');
}
function idPinFilePathFor(projectId, pinDir) {
  const hash = crypto.createHash('sha256').update(String(projectId), 'utf8').digest('hex');
  return path.join(pinDir || DEFAULT_PIN_DIR, 'id-' + hash + '.json');
}

function ok(r) {
  return r.status === 0;
}
function out(r) {
  return (r.stdout || '') + (r.stderr || '');
}

// ---------------------------------------------------------------- cases

// Checked-in expected legacy census (item 1) — exactly what the dfcfc9b
// installer created for a plain `node install.js <target>` with no
// --roster/--grant-push, no packs, no specialists. CRUCIALLY: no
// .claude/orchestra.json — WO-14b leg-3 fix round B's whole point is that a
// byte-for-byte legacy install creates none.
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

  // Pin against the checked-in expected list — not just "matches itself".
  // Skills carry more than SKILL.md in the master (README.md etc are
  // reference docs beside the skill and are NOT installed), so filter the
  // actual census down to what the checked-in list claims before comparing,
  // and separately assert nothing UNEXPECTED crept in.
  check(
    'legacy census matches the checked-in expected list exactly',
    JSON.stringify(cPlain) === JSON.stringify(EXPECTED_LEGACY_CENSUS),
    'actual:\n' + cPlain.join('\n') + '\nexpected:\n' + EXPECTED_LEGACY_CENSUS.join('\n')
  );

  // The MAJOR bug this item fixes: a fresh legacy install must create NO
  // .claude/orchestra.json at all.
  check('NO .claude/orchestra.json under a legacy install (item 1 MAJOR)', !cPlain.includes('.claude/orchestra.json'), cPlain.join('\n'));

  // None of the eleven roster role files, the conductor file, or the
  // .claude/orchestra/ runtime directory appear in a legacy install.
  const hasRosterFile = cPlain.some((f) => /\/(architect|builder|red-team|reviewer-anthropic|reviewer-openai|sweeper)\.md$/.test(f));
  check('no new-roster agent files under a legacy install', !hasRosterFile, cPlain.join('\n'));
  check('no .claude/ORCHESTRA-CONDUCTOR.md under a legacy install', !cPlain.includes('.claude/ORCHESTRA-CONDUCTOR.md'), cPlain.join('\n'));
  check('no .claude/orchestra/ runtime directory under a legacy install', !cPlain.some((f) => f.startsWith('.claude/orchestra/')), cPlain.join('\n'));

  // A second re-run (idempotent update) must ALSO create no orchestra.json —
  // the census guarantee isn't just a first-run fluke.
  const rAgain = install(plain, ['--no-packs', '--no-specialists']);
  check('re-running the plain installer succeeds', ok(rAgain), out(rAgain));
  check('re-running the plain installer STILL creates no orchestra.json', !fs.existsSync(path.join(plain, '.claude', 'orchestra.json')), '');
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

// The exact push allowlist item 3 grants — no `:*` prefix, so anything
// outside this literal list must prompt instead of matching an allow.
// WO-14b leg-3 fix round 2B item 6: narrowed from four to these two —
// `Bash(git push)` and `Bash(git push --set-upstream origin HEAD)` both omit
// an explicit refspec, so what they push depends on `.git/config` rather
// than the matched string.
const PUSH_SAFE_ALLOW = [
  'Bash(git push origin HEAD)',
  'Bash(git push -u origin HEAD)',
];
const PUSH_DENY_EXPECTED = [
  'Bash(git push --force*)',
  'Bash(git push -f*)',
  'Bash(git push --delete*)',
  'Bash(git push --mirror*)',
  'Bash(git push * --force*)',
  'Bash(git push -d*)',
  'Bash(git push --del*)',
  'Bash(git push --mir*)',
  'Bash(git push --prune*)',
  'Bash(git push * +*)',
  'Bash(git push * :*)',
  'Bash(git push origin --delete*)',
];

function case8_grantsDefaultVsGrantPush() {
  section('8. Grants: add+commit by default; push (exact-match allowlist + extended deny) only behind --grant-push');

  const defTarget = tmpdir('orchestra-install-');
  install(defTarget, ['--no-packs', '--no-specialists']);
  const defSettings = readJson(path.join(defTarget, '.claude', 'settings.json'));
  check('default install grants Bash(git add:*)', defSettings.permissions.allow.includes('Bash(git add:*)'), JSON.stringify(defSettings.permissions));
  check('default install grants Bash(git commit:*)', defSettings.permissions.allow.includes('Bash(git commit:*)'), JSON.stringify(defSettings.permissions));
  check('default install does NOT grant any git-push string', !defSettings.permissions.allow.some((p) => p.indexOf('git push') !== -1), JSON.stringify(defSettings.permissions));
  check('default install writes no permissions.deny', !defSettings.permissions.deny, JSON.stringify(defSettings.permissions));
  check('no .claude/orchestra.json for a plain default install (item 1)', !fs.existsSync(path.join(defTarget, '.claude', 'orchestra.json')), '');

  const pushTarget = tmpdir('orchestra-install-');
  install(pushTarget, ['--grant-push', '--no-packs', '--no-specialists']);
  const pushSettings = readJson(path.join(pushTarget, '.claude', 'settings.json'));
  check('--grant-push does NOT grant the broad Bash(git push:*) prefix (item 3)', !pushSettings.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(pushSettings.permissions.allow));
  for (const p of PUSH_SAFE_ALLOW) {
    check('--grant-push allowlist includes exact ' + p, pushSettings.permissions.allow.includes(p), JSON.stringify(pushSettings.permissions.allow));
  }
  for (const d of PUSH_DENY_EXPECTED) {
    check('--grant-push deny counterweight includes ' + d, (pushSettings.permissions.deny || []).includes(d), JSON.stringify(pushSettings.permissions.deny));
  }

  // Every destructive form the Red Team reproduced escaping the original
  // five deny patterns must now be caught by the extended set (item 3).
  const dangerousForms = [
    'Bash(git push origin +main)',
    'Bash(git push origin :doomed)',
    'Bash(git push -d origin doomed)',
    'Bash(git push --del origin doomed)',
    'Bash(git push --mir origin)',
    'Bash(git push origin --delete doomed)',
  ];
  function globToRegExp(pattern) {
    return new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  }
  for (const form of dangerousForms) {
    const deniedBySomePattern = (pushSettings.permissions.deny || []).some((pat) => globToRegExp(pat).test(form));
    check('deny set catches dangerous form ' + form, deniedBySomePattern, JSON.stringify(pushSettings.permissions.deny));
  }
}

function case9_installedPermissionsTracking() {
  section('9. installedPermissions/installedDeny track only what THIS installer added — uninstall removes exactly that');

  const target = tmpdir('orchestra-install-');
  // A user-added grant that happens to be identical to one Orchestra also
  // manages, added BEFORE Orchestra ever touches the project.
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git commit:*)'] } }), 'utf8');

  install(target, ['--grant-push', '--no-packs', '--no-specialists']);
  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  const expectedTracked = ['Bash(git add:*)'].concat(PUSH_SAFE_ALLOW).sort();
  // Item 3 (WO-14b leg-3 fix round 2B): installedPermissions/installedDeny
  // are now {file, entry} pairs, not bare strings.
  check(
    'installedPermissions entries are {file, entry} pairs, all against settings.json (default, no --grants-local)',
    Array.isArray(manifest.installedPermissions) && manifest.installedPermissions.every((e) => e && e.file === 'settings.json' && typeof e.entry === 'string'),
    JSON.stringify(manifest.installedPermissions)
  );
  check(
    'installedPermissions tracks only the entries THIS run actually added (not the pre-existing git commit grant)',
    JSON.stringify(manifest.installedPermissions.map((e) => e.entry).slice().sort()) === JSON.stringify(expectedTracked),
    JSON.stringify(manifest.installedPermissions)
  );
  check(
    'installedDeny tracks the full extended deny set, all against settings.json',
    manifest.installedDeny.every((e) => e.file === 'settings.json') &&
      JSON.stringify(manifest.installedDeny.map((e) => e.entry).slice().sort()) === JSON.stringify(PUSH_DENY_EXPECTED.slice().sort()),
    JSON.stringify(manifest.installedDeny)
  );

  const r = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(r), out(r));
  const settingsAfter = readJson(path.join(target, '.claude', 'settings.json'));
  const allowAfter = (settingsAfter.permissions && settingsAfter.permissions.allow) || [];
  for (const p of PUSH_SAFE_ALLOW) {
    check('uninstall removes installer-added push allow entry ' + p, !allowAfter.includes(p), JSON.stringify(allowAfter));
  }
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

function case11_upgradeStripsStaleBroadPush() {
  section('11. Upgrade: a pre-existing broad Bash(git push:*) (an older installer\'s artifact) is stripped without --grant-push');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(target, '.claude', 'settings.json'),
    JSON.stringify({ permissions: { allow: ['Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git push:*)'] } }),
    'utf8'
  );

  const r = install(target, ['--no-packs', '--no-specialists']);
  check('plain upgrade install succeeds', ok(r), out(r));
  const settings = readJson(path.join(target, '.claude', 'settings.json'));
  check('the broad Bash(git push:*) grant is stripped', !settings.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(settings.permissions.allow));
  check('add/commit grants survive the strip', settings.permissions.allow.includes('Bash(git add:*)') && settings.permissions.allow.includes('Bash(git commit:*)'), JSON.stringify(settings.permissions.allow));
  check('stripping a plain-legacy upgrade STILL creates no orchestra.json (item 1)', !fs.existsSync(path.join(target, '.claude', 'orchestra.json')), '');

  // Escape hatch: a manifest that marks the push grant user-owned protects it.
  const target2 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target2, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target2, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git push:*)'] } }), 'utf8');
  fs.writeFileSync(path.join(target2, '.claude', 'orchestra.json'), JSON.stringify({ userOwnedPermissions: ['Bash(git push:*)'] }), 'utf8');
  install(target2, ['--no-packs', '--no-specialists']);
  const settings2 = readJson(path.join(target2, '.claude', 'settings.json'));
  check('userOwnedPermissions protects the broad push grant from being stripped', settings2.permissions.allow.includes('Bash(git push:*)'), JSON.stringify(settings2.permissions.allow));
}

function case12_uninstallScopingPreservesUserFiles() {
  section('12. Uninstall scoping (item 4): only installedFiles are removed — user-owned roster-named files and non-empty dirs survive');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);

  // User-owned files that happen to collide in NAME/location with things a
  // roster:new install writes, added AFTER install (never tracked).
  fs.writeFileSync(path.join(target, '.claude', 'orchestra', 'user-data.txt'), 'mine', 'utf8');
  fs.writeFileSync(path.join(target, '.claude', 'agents', 'hand-written.md'), '---\nname: x\n---\nmine', 'utf8');

  const r = install(target, ['--uninstall']);
  check('uninstall of a --roster new install succeeds', ok(r), out(r));

  check('user file under .claude/orchestra/ survives uninstall', fs.existsSync(path.join(target, '.claude', 'orchestra', 'user-data.txt')), '');
  check('.claude/orchestra/ itself survives (non-empty — never wholesale-deleted)', fs.existsSync(path.join(target, '.claude', 'orchestra')), '');
  check('unrelated hand-written .claude/agents/ file survives', fs.existsSync(path.join(target, '.claude', 'agents', 'hand-written.md')), '');
  check('a tracked roster role file (architect.md) IS removed', !fs.existsSync(path.join(target, '.claude', 'agents', 'architect.md')), '');
  check('the conductor file IS removed', !fs.existsSync(path.join(target, '.claude', 'ORCHESTRA-CONDUCTOR.md')), '');

  // A plain LEGACY install (never ran --roster new) must not touch roster
  // paths on uninstall even if a user happens to have files with the same
  // names (Red Team MAJOR reproduction).
  const legacyTarget = tmpdir('orchestra-install-');
  install(legacyTarget, ['--no-packs', '--no-specialists']);
  fs.mkdirSync(path.join(legacyTarget, '.claude', 'orchestra'), { recursive: true });
  fs.writeFileSync(path.join(legacyTarget, '.claude', 'orchestra', 'user-data.txt'), 'mine', 'utf8');
  fs.writeFileSync(path.join(legacyTarget, '.claude', 'agents', 'architect.md'), '---\nname: mine-not-orchestras\n---\nmine', 'utf8');
  install(legacyTarget, ['--uninstall']);
  check('legacy uninstall never touches .claude/orchestra/ (never installed it)', fs.existsSync(path.join(legacyTarget, '.claude', 'orchestra', 'user-data.txt')), '');
  check('legacy uninstall never removes a user file merely named like a roster role', fs.existsSync(path.join(legacyTarget, '.claude', 'agents', 'architect.md')), '');
}

function case13_numericRoundTripRefused() {
  section('13. JSON numeric round-trip guard (item 5): a literal that would lose precision is refused before anything is touched');

  for (const file of ['settings.json', '.mcp.json']) {
    const target = tmpdir('orchestra-install-');
    const parts = file === '.mcp.json' ? [file] : ['.claude', file];
    const filePath = path.join(target, ...parts);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{\n  "someToolsOwnBigId": 9007199254740993\n}\n', 'utf8');
    const before = census(target);
    const r = install(target, ['--no-packs', '--no-specialists']);
    check(file + ' with an unsafe 9007199254740993 literal -> install exits non-zero', r.status !== 0, out(r));
    check(file + ' -> error names the unsafe value', out(r).indexOf('9007199254740993') !== -1, out(r));
    const after = census(target);
    check(file + ' -> nothing touched (census unchanged)', JSON.stringify(before) === JSON.stringify(after), '');
  }

  // orchestra.json itself, same guard.
  const target2 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target2, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target2, '.claude', 'orchestra.json'), '{\n  "someKey": 9007199254740993\n}\n', 'utf8');
  const r2 = install(target2, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('orchestra.json with an unsafe literal -> install exits non-zero', r2.status !== 0, out(r2));
  check('orchestra.json -> nothing copied', !fs.existsSync(path.join(target2, '.claude', 'agents')), '');

  // A safe large integer (within Number.isSafeInteger) must NOT be refused.
  const target3 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target3, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target3, '.claude', 'settings.json'), '{\n  "safeBigId": 12345678901234\n}\n', 'utf8');
  const r3 = install(target3, ['--no-packs', '--no-specialists']);
  check('a safe integer literal does NOT trigger a refusal', ok(r3), out(r3));
  const settings3 = readJson(path.join(target3, '.claude', 'settings.json'));
  check('the safe integer value survives byte-for-byte', settings3.safeBigId === 12345678901234, JSON.stringify(settings3.safeBigId));

  // Item 4b/4c (WO-14b leg-3 fix round 2B, Red Team MEDIUM x2): non-finite
  // exponent literals (type-destroying — they'd re-serialize as `null`) and
  // finite-but-lossy fractional/exponent literals must both be refused —
  // the old code exempted every token containing `.`/`e`/`E` outright.
  const unsafeFloatFixtures = [
    '1e400', '-1e400', '1E400', '1.7976931348623159e308',
    '12345678901234567890.5', '1.00000000000000000001',
  ];
  for (const lit of unsafeFloatFixtures) {
    const t = tmpdir('orchestra-install-');
    fs.mkdirSync(path.join(t, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(t, '.claude', 'settings.json'), '{\n  "someKey": ' + lit + '\n}\n', 'utf8');
    const before = census(t);
    const r = install(t, ['--no-packs', '--no-specialists']);
    check('unsafe float literal ' + lit + ' -> install exits non-zero', r.status !== 0, out(r));
    check('unsafe float literal ' + lit + ' -> nothing touched', JSON.stringify(before) === JSON.stringify(census(t)), '');
  }
  // A trailing ".0" that loses no information must NOT be refused (item 4c's
  // canonicalization exists precisely so this stays legal).
  const cosmeticTarget = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(cosmeticTarget, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(cosmeticTarget, '.claude', 'settings.json'), '{\n  "someKey": 5.0\n}\n', 'utf8');
  const rCosmetic = install(cosmeticTarget, ['--no-packs', '--no-specialists']);
  check('a cosmetic trailing ".0" (5.0) does NOT trigger a refusal', ok(rCosmetic), out(rCosmetic));

  // Escaped-quote masking bug (item 4a, Red Team HIGH): the pinned unsafe
  // integer must still be caught when it follows a string containing an
  // escaped quote — the old state machine mis-tracked string state past the
  // `\"` and masked the literal itself out of consideration.
  const escTarget = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(escTarget, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(escTarget, '.claude', 'settings.json'), '{"a":"z\\"", "big": 9007199254740993}', 'utf8');
  const rEsc = install(escTarget, ['--no-packs', '--no-specialists']);
  check('escaped-quote fixture {"a":"z\\"", "big": 9007199254740993} -> install exits non-zero', rEsc.status !== 0, out(rEsc));
  check('escaped-quote fixture -> error names the unsafe value', out(rEsc).indexOf('9007199254740993') !== -1, out(rEsc));

  // Indentation preservation: a 4-space settings.json stays 4-space.
  const target4 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target4, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target4, '.claude', 'settings.json'), '{\n    "myKey": "v"\n}\n', 'utf8');
  install(target4, ['--no-packs', '--no-specialists']);
  const raw4 = fs.readFileSync(path.join(target4, '.claude', 'settings.json'), 'utf8');
  check('4-space indentation is preserved on rewrite (item 5)', /\n {4}"/.test(raw4) && !/\n {2}"(?! )/.test(raw4.split('\n')[1] || ''), raw4);
}

function case14_nonObjectTargetsRefused() {
  section('14. refuseIfTargetMalformed rejects non-object top level (item 6): null, "str", 42, []');

  const shapes = [['null', 'null'], ['a string', '"str"'], ['a number', '42'], ['an array', '[]']];
  for (const [label, literal] of shapes) {
    const target = tmpdir('orchestra-install-');
    fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude', 'orchestra.json'), literal, 'utf8');
    const before = census(target);
    const r = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
    check('orchestra.json = ' + label + ' -> install exits non-zero', r.status !== 0, out(r));
    const after = census(target);
    check('orchestra.json = ' + label + ' -> nothing copied (refused before touching anything)', JSON.stringify(before) === JSON.stringify(after), 'before=' + before.join(',') + ' after=' + after.join(','));

    const r2 = install(target, ['--uninstall']);
    check('orchestra.json = ' + label + ' -> uninstall also refused, nothing deleted', r2.status !== 0 && JSON.stringify(census(target)) === JSON.stringify(before), out(r2));
  }
}

function case15_rosterGenerationMustBeInteger() {
  section('15. rosterGeneration must be a non-negative integer (item 7) — refused with the value named');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 0.5 }), 'utf8');
  const r = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('rosterGeneration=0.5 -> install exits non-zero', r.status !== 0, out(r));
  check('rosterGeneration=0.5 -> error names the value', out(r).indexOf('0.5') !== -1, out(r));
  check('rosterGeneration=0.5 -> nothing copied', !fs.existsSync(path.join(target, '.claude', 'agents')), '');

  const target2 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target2, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target2, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: -1 }), 'utf8');
  const r2 = install(target2, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('rosterGeneration=-1 -> install exits non-zero', r2.status !== 0, out(r2));
}

function case16_rosterLintGateAndCollision() {
  section('16. Roster role files go through the frontmatter gate and the collision assertion (item 8)');

  const masterCopy = tmpdir('orchestra-master-');
  const files = spawnSync('git', ['-C', MASTER, 'ls-files'], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);
  for (const rel of files) {
    const src = path.join(MASTER, rel);
    const dest = path.join(masterCopy, rel);
    if (!fs.statSync(src).isFile()) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  const installerCopy = path.join(masterCopy, 'install.js');

  // (a) bad frontmatter in a roster role file is caught at install time.
  const badFmTarget = tmpdir('orchestra-install-');
  const rosterArchitect = path.join(masterCopy, 'roster', 'architect.md');
  const original = fs.readFileSync(rosterArchitect, 'utf8');
  fs.writeFileSync(rosterArchitect, original.replace(/^description:.*$/m, 'description: launcher: it runs'), 'utf8');
  const rBad = spawnSync(process.execPath, [installerCopy, badFmTarget, '--roster', 'new', '--no-packs', '--no-specialists'], { encoding: 'utf8', timeout: 60000, env: DEFAULT_ENV });
  check('a roster role file with unparseable frontmatter fails the install-time lint gate', rBad.status !== 0, (rBad.stdout || '') + (rBad.stderr || ''));
  check('nothing was copied when the roster lint gate fails', !fs.existsSync(path.join(badFmTarget, '.claude', 'agents')), '');
  fs.writeFileSync(rosterArchitect, original, 'utf8'); // restore

  // (b) a roster file colliding with a core agent name is refused.
  fs.writeFileSync(path.join(masterCopy, 'roster', 'scout.md'), '---\nname: red-team\ndescription: collision test\n---\nbody\n', 'utf8');
  const collideTarget = tmpdir('orchestra-install-');
  const rCollide = spawnSync(process.execPath, [installerCopy, collideTarget, '--roster', 'new', '--no-packs', '--no-specialists'], { encoding: 'utf8', timeout: 60000, env: DEFAULT_ENV });
  check('a roster role file colliding with a core agent name is refused', rCollide.status !== 0, (rCollide.stdout || '') + (rCollide.stderr || ''));
  check('nothing was copied when the roster collision check fails', !fs.existsSync(path.join(collideTarget, '.claude', 'agents')), '');
}

function case17_manifestPin() {
  section('17. Manifest pin (item 9): written on roster:new, verified by --verify-pin, removed on uninstall');

  const pinDir = tmpdir('orchestra-pins-');
  const env = Object.assign({}, process.env, { ORCHESTRA_PIN_DIR: pinDir });
  const target = tmpdir('orchestra-install-');

  const rNoPin = spawnSync(process.execPath, [INSTALLER, target, '--verify-pin'], { encoding: 'utf8', timeout: 60000, env });
  check('--verify-pin before any install reports NO-PIN', /NO-PIN/.test(out(rNoPin)) && rNoPin.status !== 0, out(rNoPin));

  const rLegacy = spawnSync(process.execPath, [INSTALLER, target, '--no-packs', '--no-specialists'], { encoding: 'utf8', timeout: 60000, env });
  check('plain legacy install succeeds', ok(rLegacy), out(rLegacy));
  check('a plain legacy install writes NO pin file (no manifest to pin)', fs.readdirSync(pinDir).length === 0, fs.readdirSync(pinDir).join(','));

  const rNew = spawnSync(process.execPath, [INSTALLER, target, '--roster', 'new', '--no-packs', '--no-specialists'], { encoding: 'utf8', timeout: 60000, env });
  check('--roster new install succeeds', ok(rNew), out(rNew));
  // Item 5 (WO-14b leg-3 fix round 2B): a path-keyed pin AND an id-keyed pin
  // (keyed on the manifest's minted projectId), identical content.
  check('--roster new install writes exactly two pin files (path-keyed + id-keyed, item 5)', fs.readdirSync(pinDir).length === 2, fs.readdirSync(pinDir).join(','));

  const rMatch = spawnSync(process.execPath, [INSTALLER, target, '--verify-pin'], { encoding: 'utf8', timeout: 60000, env });
  check('--verify-pin reports MATCH right after install', /MATCH/.test(out(rMatch)) && ok(rMatch), out(rMatch));

  const manifestPath = path.join(target, '.claude', 'orchestra.json');
  const manifest = readJson(manifestPath);
  manifest.seats.Architect = false;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const rMismatch = spawnSync(process.execPath, [INSTALLER, target, '--verify-pin'], { encoding: 'utf8', timeout: 60000, env });
  check('--verify-pin reports MISMATCH after the manifest is hand-edited', /MISMATCH/.test(out(rMismatch)) && rMismatch.status !== 0, out(rMismatch));

  const rUninstall = spawnSync(process.execPath, [INSTALLER, target, '--uninstall'], { encoding: 'utf8', timeout: 60000, env });
  check('uninstall succeeds', ok(rUninstall), out(rUninstall));
  check('--uninstall removes the pin file', fs.readdirSync(pinDir).length === 0, fs.readdirSync(pinDir).join(','));
}

function case18_grantsLocal() {
  section('18. --grants-local writes grants to settings.local.json instead of settings.json (item 10)');

  const target = tmpdir('orchestra-install-');
  const r = install(target, ['--grant-push', '--grants-local', '--no-packs', '--no-specialists']);
  check('--grants-local install succeeds', ok(r), out(r));

  const settings = readJson(path.join(target, '.claude', 'settings.json'));
  const allowInShared = (settings.permissions && settings.permissions.allow) || [];
  check('settings.json (shared) carries NO git grants under --grants-local', !allowInShared.some((p) => p.indexOf('git') !== -1), JSON.stringify(allowInShared));
  check('settings.json still carries the PreToolUse hook entry', settings.hooks && Array.isArray(settings.hooks.PreToolUse) && settings.hooks.PreToolUse.length === 1, JSON.stringify(settings.hooks));

  const local = readJson(path.join(target, '.claude', 'settings.local.json'));
  check('settings.local.json carries the git grants', local.permissions && local.permissions.allow.includes('Bash(git add:*)') && local.permissions.allow.includes('Bash(git push origin HEAD)'), JSON.stringify(local.permissions));
  check('settings.local.json carries the push deny counterweight', local.permissions.deny && local.permissions.deny.includes('Bash(git push --force*)'), JSON.stringify(local.permissions.deny));

  const rUninstall = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(rUninstall), out(rUninstall));
  const localAfter = fs.existsSync(path.join(target, '.claude', 'settings.local.json'))
    ? readJson(path.join(target, '.claude', 'settings.local.json'))
    : { permissions: {} };
  const allowAfter = (localAfter.permissions && localAfter.permissions.allow) || [];
  check('uninstall removes the grants from settings.local.json', !allowAfter.includes('Bash(git add:*)'), JSON.stringify(allowAfter));
}

function case19_uninstallContainment() {
  section('19. Uninstall containment (item 1): a hostile installedFiles never deletes outside .claude/');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);

  // Victims OUTSIDE the project entirely, and one inside the project but
  // outside .claude/ — the Red Team's fixture.
  const victimOutside1 = path.join(path.dirname(target), 'VICTIM-outside-project-' + path.basename(target) + '.txt');
  const victimOutside2 = path.join(path.dirname(path.dirname(target)), 'VICTIM-two-levels-up.txt');
  const victimInProject = path.join(target, 'src-file.js');
  fs.writeFileSync(victimOutside1, 'do not delete me', 'utf8');
  fs.writeFileSync(victimOutside2, 'do not delete me either', 'utf8');
  fs.writeFileSync(victimInProject, 'unrelated user source', 'utf8');
  cleanups.push(() => { try { fs.unlinkSync(victimOutside1); } catch (_) {} });
  cleanups.push(() => { try { fs.unlinkSync(victimOutside2); } catch (_) {} });

  const relToProjectDotClaude = (p) => path.relative(path.join(target, '.claude'), p).replace(/\\/g, '/');
  const manifestPath = path.join(target, '.claude', 'orchestra.json');
  const manifest = readJson(manifestPath);
  manifest.installedFiles = [
    relToProjectDotClaude(victimOutside1),
    relToProjectDotClaude(victimOutside2),
    relToProjectDotClaude(victimInProject),
    'C:/Windows/System32/VICTIM-windows-absolute.txt',
    '/etc/VICTIM-posix-absolute.txt',
    'agents/architect.md', // one legitimate, safe entry mixed in
  ];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  // Refresh the pin so this exercises item 1's containment check specifically
  // (ledger TRUSTED, hostile entries present) rather than item 2's separate
  // pin-mismatch fallback, which case 20 covers.
  repinAfterHandEdit(target, manifestPath);
  const rVerify = install(target, ['--verify-pin']);
  check('(setup) pin re-matches the hand-edited manifest (isolating item 1 from item 2)', /MATCH/.test(out(rVerify)) && ok(rVerify), out(rVerify));

  const r = install(target, ['--uninstall']);
  check('uninstall over a hostile installedFiles list still exits 0', ok(r), out(r));
  check('victim outside the project (one level up) SURVIVES', fs.existsSync(victimOutside1), '');
  check('victim outside the project (two levels up) SURVIVES', fs.existsSync(victimOutside2), '');
  check('victim inside the project but outside .claude/ SURVIVES', fs.existsSync(victimInProject), '');
  check('warnings name the skipped unsafe entries', /SKIPPED/i.test(out(r)), out(r));
  check('the one legitimate mixed-in entry (agents/architect.md) IS removed', !fs.existsSync(path.join(target, '.claude', 'agents', 'architect.md')), '');
}

function case20_uninstallPinUntrustedFallback() {
  section('20. Uninstall verifies its own pin before trusting the ledger (item 2): MISMATCH -> untracked/canonical fallback, nothing stranded');

  // (a) installedPermissions edited to [] must not strand the push grants.
  const t1 = tmpdir('orchestra-install-');
  install(t1, ['--roster', 'new', '--grant-push', '--no-packs', '--no-specialists']);
  const m1path = path.join(t1, '.claude', 'orchestra.json');
  const m1 = readJson(m1path);
  m1.installedPermissions = [];
  fs.writeFileSync(m1path, JSON.stringify(m1, null, 2) + '\n', 'utf8'); // pin now MISMATCHes
  const r1 = install(t1, ['--uninstall']);
  check('(a) uninstall over installedPermissions=[] still succeeds', ok(r1), out(r1));
  check('(a) pin-untrusted report printed', /MISMATCH/.test(out(r1)) || /pin/i.test(out(r1)), out(r1));
  const s1 = readJson(path.join(t1, '.claude', 'settings.json'));
  const allow1 = (s1.permissions && s1.permissions.allow) || [];
  const deny1 = (s1.permissions && s1.permissions.deny) || [];
  check('(a) no Orchestra push allow grant is stranded', !allow1.some((p) => p.indexOf('git push') !== -1), JSON.stringify(allow1));
  check('(a) no Orchestra push deny entry is stranded', deny1.length === 0, JSON.stringify(deny1));
  check('(a) roster role file removed by canonical fallback', !fs.existsSync(path.join(t1, '.claude', 'agents', 'architect.md')), '');
  check('(a) conductor file removed by canonical fallback', !fs.existsSync(path.join(t1, '.claude', 'ORCHESTRA-CONDUCTOR.md')), '');

  // (b) installedPermissions substituted with the user's own grants must not
  // cost the user those grants, and must still remove Orchestra's real ones.
  const t2 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(t2, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(t2, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test:*)', 'Read(//home/**)'] } }), 'utf8');
  install(t2, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const m2path = path.join(t2, '.claude', 'orchestra.json');
  const m2 = readJson(m2path);
  m2.installedPermissions = [{ file: 'settings.json', entry: 'Bash(npm test:*)' }, { file: 'settings.json', entry: 'Read(//home/**)' }];
  fs.writeFileSync(m2path, JSON.stringify(m2, null, 2) + '\n', 'utf8');
  const r2 = install(t2, ['--uninstall']);
  check('(b) uninstall over a substituted ledger succeeds', ok(r2), out(r2));
  const s2 = readJson(path.join(t2, '.claude', 'settings.json'));
  const allow2 = (s2.permissions && s2.permissions.allow) || [];
  check('(b) the user\'s own grants survive (the ledger naming them is not trusted)', allow2.includes('Bash(npm test:*)') && allow2.includes('Read(//home/**)'), JSON.stringify(allow2));
  check('(b) Orchestra\'s real add/commit grants are still removed (untracked fallback)', !allow2.includes('Bash(git add:*)') && !allow2.includes('Bash(git commit:*)'), JSON.stringify(allow2));

  // (c) manifest deleted entirely before uninstall: NO-PIN-with-manifest is
  // not reachable this way (deleting the manifest means it no longer
  // exists), but a manifest present with no pin ever written (simulated by
  // pointing ORCHESTRA_PIN_DIR elsewhere for the uninstall call) must also
  // fall back rather than trust installedFiles blindly.
  const t3 = tmpdir('orchestra-install-');
  install(t3, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const otherPinDir = tmpdir('orchestra-pins-other-');
  const r3 = spawnSync(process.execPath, [INSTALLER, t3, '--uninstall'], { encoding: 'utf8', timeout: 60000, env: Object.assign({}, process.env, { ORCHESTRA_PIN_DIR: otherPinDir }) });
  check('(c) uninstall with no pin recorded at this PIN_DIR still succeeds', ok(r3), out(r3));
  check('(c) roster role file removed by canonical fallback (NO-PIN path)', !fs.existsSync(path.join(t3, '.claude', 'agents', 'architect.md')), '');
}

function case21_permissionOwnershipCrossFile() {
  section('21. Permission ownership per file (item 3): a cross-file user-owned copy survives; broad legacy push grant stripped from BOTH files on every install');

  // A user-owned Bash(git commit:*) sits in settings.local.json; Orchestra
  // tracks its OWN copy of the same string against settings.json only.
  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { allow: ['Bash(git commit:*)'] } }), 'utf8');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const r = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(r), out(r));
  const settingsAfter = readJson(path.join(target, '.claude', 'settings.json'));
  const allowAfter = (settingsAfter.permissions && settingsAfter.permissions.allow) || [];
  check('settings.json copy of Bash(git commit:*) (Orchestra-tracked) is removed', !allowAfter.includes('Bash(git commit:*)'), JSON.stringify(allowAfter));
  const localAfter = readJson(path.join(target, '.claude', 'settings.local.json'));
  const localAllowAfter = (localAfter.permissions && localAfter.permissions.allow) || [];
  check('settings.local.json copy of Bash(git commit:*) (user-owned) SURVIVES', localAllowAfter.includes('Bash(git commit:*)'), JSON.stringify(localAllowAfter));

  // Cross-vendor review #2 MAJOR repro: a broad legacy grant in settings.json
  // must be stripped even when this run's grants go to settings.local.json.
  const target2 = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target2, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target2, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git push:*)'] } }), 'utf8');
  const r2 = install(target2, ['--grants-local', '--no-packs', '--no-specialists']);
  check('--grants-local install succeeds', ok(r2), out(r2));
  const settings2 = readJson(path.join(target2, '.claude', 'settings.json'));
  const allow2 = (settings2.permissions && settings2.permissions.allow) || [];
  check('the broad Bash(git push:*) grant is stripped from settings.json even though grants went to settings.local.json', !allow2.includes('Bash(git push:*)'), JSON.stringify(allow2));
}

function case22_projectIdMovePinRepin() {
  section('22. projectId + dual pin + MOVED + --repin (item 5)');

  const pinDir = tmpdir('orchestra-pins-');
  const env = Object.assign({}, process.env, { ORCHESTRA_PIN_DIR: pinDir });
  const oldTarget = tmpdir('orchestra-install-old-');

  const rNew = spawnSync(process.execPath, [INSTALLER, oldTarget, '--roster', 'new', '--no-packs', '--no-specialists'], { encoding: 'utf8', timeout: 60000, env });
  check('--roster new install succeeds', ok(rNew), out(rNew));
  const manifest = readJson(path.join(oldTarget, '.claude', 'orchestra.json'));
  check('manifest carries a projectId', typeof manifest.projectId === 'string' && manifest.projectId.length > 0, JSON.stringify(manifest.projectId));
  check('exactly two pin files were written (path-keyed + id-keyed)', fs.readdirSync(pinDir).length === 2, fs.readdirSync(pinDir).join(','));

  // Simulate a move: copy the whole project to a new directory (so the
  // path-keyed pin, which hashes the OLD real path, no longer applies),
  // remove the old directory, and check the new one.
  const newTarget = tmpdir('orchestra-install-new-');
  fs.rmSync(newTarget, { recursive: true, force: true });
  fs.cpSync(oldTarget, newTarget, { recursive: true });
  fs.rmSync(oldTarget, { recursive: true, force: true });

  const rMoved = spawnSync(process.execPath, [INSTALLER, newTarget, '--verify-pin'], { encoding: 'utf8', timeout: 60000, env });
  check('--verify-pin at the new location reports MOVED', /MOVED/.test(out(rMoved)), out(rMoved));
  check('MOVED exits 0 (trusted: found by id, hash matches)', ok(rMoved), out(rMoved));

  const rRepin = spawnSync(process.execPath, [INSTALLER, newTarget, '--repin'], { encoding: 'utf8', timeout: 60000, env });
  check('--repin succeeds on a MOVED project', ok(rRepin) && /REPINNED/.test(out(rRepin)), out(rRepin));

  const rMatchAfterRepin = spawnSync(process.execPath, [INSTALLER, newTarget, '--verify-pin'], { encoding: 'utf8', timeout: 60000, env });
  check('--verify-pin at the new location now reports MATCH', /MATCH/.test(out(rMatchAfterRepin)) && ok(rMatchAfterRepin), out(rMatchAfterRepin));

  // --repin refuses when there is nothing to repin (status is not MOVED).
  const freshTarget = tmpdir('orchestra-install-');
  const rRepinRefused = spawnSync(process.execPath, [INSTALLER, freshTarget, '--repin'], { encoding: 'utf8', timeout: 60000, env });
  check('--repin on an unpinned project refuses (status is NO-PIN, not MOVED)', rRepinRefused.status !== 0, out(rRepinRefused));

  // Uninstall removes the id-keyed pin and the (repinned) path-keyed pin for
  // the CURRENT location. It cannot know about a path-keyed pin left behind
  // at the old location, which the move already orphaned before uninstall
  // ever ran (nothing removed the old directory's pin when the directory
  // itself was deleted out from under it) — that orphan is a pre-existing
  // property of path-keyed pins, not something item 5 introduces or claims
  // to sweep.
  const pinsBeforeUninstall = fs.readdirSync(pinDir);
  const newPathPin = path.basename(pinFilePathFor(newTarget, pinDir));
  const idPin = path.basename(idPinFilePathFor(manifest.projectId, pinDir));
  const rUninstall = spawnSync(process.execPath, [INSTALLER, newTarget, '--uninstall'], { encoding: 'utf8', timeout: 60000, env });
  check('uninstall of the moved+repinned project succeeds', ok(rUninstall), out(rUninstall));
  const pinsAfterUninstall = fs.readdirSync(pinDir);
  check('uninstall removed the current-location path-keyed pin', pinsBeforeUninstall.includes(newPathPin) && !pinsAfterUninstall.includes(newPathPin), pinsAfterUninstall.join(','));
  check('uninstall removed the id-keyed pin', pinsBeforeUninstall.includes(idPin) && !pinsAfterUninstall.includes(idPin), pinsAfterUninstall.join(','));
}

function case23_ignoreManifest() {
  section('23. --uninstall --ignore-manifest (item 7): a malformed manifest no longer locks the owner out');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  fs.writeFileSync(path.join(target, '.claude', 'orchestra.json'), 'null', 'utf8');

  const rBlocked = install(target, ['--uninstall']);
  check('a malformed orchestra.json refuses a plain --uninstall', rBlocked.status !== 0, out(rBlocked));
  check('the refusal message names deletion / --ignore-manifest as the remedy', /--ignore-manifest|delete/i.test(out(rBlocked)), out(rBlocked));

  const rIgnored = install(target, ['--uninstall', '--ignore-manifest']);
  check('--uninstall --ignore-manifest succeeds despite the malformed manifest', ok(rIgnored), out(rIgnored));
  check('the guard hook is removed', !fs.existsSync(path.join(target, '.claude', 'hooks', 'orchestra-guard.js')), '');
  check('the malformed orchestra.json itself is left untouched (never read)', fs.readFileSync(path.join(target, '.claude', 'orchestra.json'), 'utf8').trim() === 'null', '');

  // --ignore-manifest only means something with --uninstall.
  const target2 = tmpdir('orchestra-install-');
  const rNoUninstall = install(target2, ['--ignore-manifest', '--no-packs', '--no-specialists']);
  check('--ignore-manifest without --uninstall is refused', rNoUninstall.status !== 0, out(rNoUninstall));
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
  case11_upgradeStripsStaleBroadPush();
  case12_uninstallScopingPreservesUserFiles();
  case13_numericRoundTripRefused();
  case14_nonObjectTargetsRefused();
  case15_rosterGenerationMustBeInteger();
  case16_rosterLintGateAndCollision();
  case17_manifestPin();
  case18_grantsLocal();
  case19_uninstallContainment();
  case20_uninstallPinUntrustedFallback();
  case21_permissionOwnershipCrossFile();
  case22_projectIdMovePinRepin();
  case23_ignoreManifest();
} catch (e) {
  check('the suite ran to completion', false, (e && e.stack) || e);
}
finish();
