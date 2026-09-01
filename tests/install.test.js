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
// Mirrors install.js's gitPinFilePath() for the third pin key (item 3).
function gitPinFilePathFor(rootCommitHash, pinDir) {
  const hash = crypto.createHash('sha256').update(String(rootCommitHash), 'utf8').digest('hex');
  return path.join(pinDir || DEFAULT_PIN_DIR, 'git-' + hash + '.json');
}
// Mirrors install.js's gitRootCommitHash() so tests can name the file
// without re-deriving the scheme inline. Returns null (never throws) when
// `dir` is not a git repo or has no commits.
function gitRootCommitHashFor(dir) {
  const r = spawnSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: dir, encoding: 'utf8', timeout: 5000 });
  if (r.status !== 0 || !r.stdout) return null;
  const first = r.stdout.split(/\r?\n/).find((l) => l.trim());
  return first ? first.trim() : null;
}
// Initializes a throwaway git repo at `dir` with exactly one commit, so a
// root commit hash (item 3's git pin key) is resolvable there.
function initGitRepoWithCommit(dir) {
  const run = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 15000 });
  run(['init', '-q']);
  fs.writeFileSync(path.join(dir, 'SEED.txt'), 'seed\n', 'utf8');
  run(['add', 'SEED.txt']);
  const c = run(['-c', 'user.email=orchestra-test@example.com', '-c', 'user.name=Orchestra Test', 'commit', '-q', '-m', 'seed']);
  if (c.status !== 0) throw new Error('git commit failed in test fixture: ' + (c.stderr || c.stdout));
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

  // WO-14b leg 3R, item 1: the guard's roster:new path is selected ONLY by
  // its own --roster new invocation argument — a legacy install must write
  // the argument-less command line.
  const legacySettings = readJson(path.join(plain, '.claude', 'settings.json'));
  const legacyGuardEntry = (legacySettings.hooks.PreToolUse || []).find((e) => /orchestra-guard\.js/.test(e.hooks[0].command));
  check(
    'legacy install writes the guard PreToolUse command WITHOUT --roster new',
    !!legacyGuardEntry && legacyGuardEntry.hooks[0].command === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-guard.js"',
    legacyGuardEntry && JSON.stringify(legacyGuardEntry)
  );

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

  // WO-14b leg 4 fix round CONTINUATION (install.js -> init-store): a fresh
  // --roster new install initialises the ticket store the same way
  // bridge/cli.js's `init-store` does, and records installedStore:true.
  const ticketStoreFile = path.join(target, '.claude', 'orchestra', 'tickets', 'tickets.json');
  check('census includes the initialised ticket store file', c.includes('.claude/orchestra/tickets/tickets.json'), c.join('\n'));
  check('the ticket store file is well-formed JSON (generation 1, no tickets yet)', (() => {
    try {
      const j = readJson(ticketStoreFile);
      return j && j.generation === 1 && j.tickets && typeof j.tickets === 'object' && Object.keys(j.tickets).length === 0;
    } catch (_) { return false; }
  })(), (() => { try { return fs.readFileSync(ticketStoreFile, 'utf8'); } catch (e) { return String(e); } })());

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('manifest roster === "new"', manifest.roster === 'new', JSON.stringify(manifest));
  check('manifest installedStore === true', manifest.installedStore === true, JSON.stringify(manifest));
  check('manifest seats === {Architect:true, Sweeper:false}', manifest.seats && manifest.seats.Architect === true && manifest.seats.Sweeper === false, JSON.stringify(manifest));
  check('manifest rosterGeneration starts at 1', manifest.rosterGeneration === 1, JSON.stringify(manifest));

  // leg 4c: the four bridge ticket-gate hook entries are registered into
  // settings.json under --roster new, tagged (isOurGateHookEntry) and
  // tracked in the manifest's installedHooks.
  const settings = readJson(path.join(target, '.claude', 'settings.json'));
  check('manifest installedHooks === the four gate events', JSON.stringify(manifest.installedHooks) === JSON.stringify(['PreToolUse', 'PostToolUse', 'SubagentStop', 'Stop']), JSON.stringify(manifest.installedHooks));

  check('settings.json PreToolUse still carries exactly one guard entry PLUS one gate entry',
    Array.isArray(settings.hooks.PreToolUse) && settings.hooks.PreToolUse.length === 2, JSON.stringify(settings.hooks.PreToolUse));
  const preGate = (settings.hooks.PreToolUse || []).find((e) => e.matcher === 'Agent');
  check('PreToolUse gate entry has matcher "Agent"', !!preGate, JSON.stringify(settings.hooks.PreToolUse));

  // WO-14b leg 3R, item 1: --roster new writes the guard's OWN PreToolUse
  // entry (matcher '') with the --roster new argument appended — this, and
  // only this, is what selects the guard's roster:new path at runtime.
  const guardEntryNew = (settings.hooks.PreToolUse || []).find((e) => e.matcher === '' && /orchestra-guard\.js/.test(e.hooks[0].command));
  check(
    '--roster new install writes the guard PreToolUse command WITH --roster new',
    !!guardEntryNew && guardEntryNew.hooks[0].command === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-guard.js" --roster new',
    guardEntryNew && JSON.stringify(guardEntryNew)
  );
  check('PreToolUse gate entry command runs ticket-gate.js PreToolUse',
    !!preGate && preGate.hooks[0].command.indexOf('ticket-gate.js') !== -1 && / PreToolUse$/.test(preGate.hooks[0].command),
    preGate && JSON.stringify(preGate));

  check('settings.json PostToolUse carries exactly one gate entry, matcher "Agent"',
    Array.isArray(settings.hooks.PostToolUse) && settings.hooks.PostToolUse.length === 1 && settings.hooks.PostToolUse[0].matcher === 'Agent',
    JSON.stringify(settings.hooks.PostToolUse));
  check('PostToolUse gate entry command runs ticket-gate.js PostToolUse',
    settings.hooks.PostToolUse && / PostToolUse$/.test(settings.hooks.PostToolUse[0].hooks[0].command),
    settings.hooks.PostToolUse && JSON.stringify(settings.hooks.PostToolUse));

  check('settings.json SubagentStop carries exactly one gate entry, NO matcher key',
    Array.isArray(settings.hooks.SubagentStop) && settings.hooks.SubagentStop.length === 1 && !('matcher' in settings.hooks.SubagentStop[0]),
    JSON.stringify(settings.hooks.SubagentStop));
  check('SubagentStop gate entry command runs ticket-gate.js SubagentStop',
    settings.hooks.SubagentStop && / SubagentStop$/.test(settings.hooks.SubagentStop[0].hooks[0].command),
    settings.hooks.SubagentStop && JSON.stringify(settings.hooks.SubagentStop));

  check('settings.json Stop carries exactly one gate entry, NO matcher key',
    Array.isArray(settings.hooks.Stop) && settings.hooks.Stop.length === 1 && !('matcher' in settings.hooks.Stop[0]),
    JSON.stringify(settings.hooks.Stop));
  check('Stop gate entry command runs ticket-gate.js Stop',
    settings.hooks.Stop && / Stop$/.test(settings.hooks.Stop[0].hooks[0].command),
    settings.hooks.Stop && JSON.stringify(settings.hooks.Stop));

  // A second --roster new run must replace, never duplicate, these entries.
  const storeMtimeBefore = fs.statSync(ticketStoreFile).mtimeMs;
  const r2 = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('re-running --roster new succeeds', ok(r2), out(r2));
  const settingsAgain = readJson(path.join(target, '.claude', 'settings.json'));
  check('re-running --roster new does not duplicate the gate hook entries',
    settingsAgain.hooks.PreToolUse.length === 2 && settingsAgain.hooks.PostToolUse.length === 1 &&
      settingsAgain.hooks.SubagentStop.length === 1 && settingsAgain.hooks.Stop.length === 1,
    JSON.stringify(settingsAgain.hooks));
  // Idempotent store init: a re-run over an EXISTING store must leave it
  // byte-untouched (never reinitialised/wiped) — install.js only calls
  // init-store when no store exists yet.
  check('re-running --roster new does not touch the already-initialised ticket store (mtime unchanged)',
    fs.statSync(ticketStoreFile).mtimeMs === storeMtimeBefore, 'before=' + storeMtimeBefore + ' after=' + fs.statSync(ticketStoreFile).mtimeMs);
  const manifestAgain = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('re-running --roster new keeps installedStore === true', manifestAgain.installedStore === true, JSON.stringify(manifestAgain));
}

function case3_flipBumpsGenerationLeavesFiles() {
  section('3. Flipping new -> legacy bumps rosterGeneration and LEAVES the new-roster files in place (rollback is a flag flip)');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const before = census(target);
  const genBefore = readJson(path.join(target, '.claude', 'orchestra.json')).rosterGeneration;
  const ticketStoreFile = path.join(target, '.claude', 'orchestra', 'tickets', 'tickets.json');
  const storeBytesBefore = fs.readFileSync(ticketStoreFile);

  const r = install(target, ['--roster', 'legacy', '--no-packs', '--no-specialists']);
  check('flip to --roster legacy succeeds', ok(r), out(r));

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('manifest roster flipped to "legacy"', manifest.roster === 'legacy', JSON.stringify(manifest));
  check('rosterGeneration bumped by exactly 1', manifest.rosterGeneration === genBefore + 1, 'before=' + genBefore + ' after=' + manifest.rosterGeneration);

  const after = census(target);
  check('every new-roster file installed before the flip is STILL present after it', before.every((f) => after.includes(f)), 'missing: ' + before.filter((f) => !after.includes(f)).join(', '));
  // WO-14b leg 4 fix round CONTINUATION: "a legacy flip leaves it" — the
  // ticket store is neither removed nor reinitialised by a flip to legacy.
  check('the ticket store SURVIVES the legacy flip (file present, byte-identical)',
    fs.existsSync(ticketStoreFile) && fs.readFileSync(ticketStoreFile).equals(storeBytesBefore), '');
  check('manifest.installedStore is left as-is (not cleared) by the legacy flip', manifest.installedStore === true, JSON.stringify(manifest));

  // leg 4c: the flip removes the four gate hook entries (the gate is inert
  // under legacy anyway — hygiene) but LEAVES the guard's own PreToolUse
  // entry in place, and clears installedHooks from the manifest.
  const settingsAfterFlip = readJson(path.join(target, '.claude', 'settings.json'));
  check('flip to legacy removes the gate PreToolUse(Agent) entry but keeps the guard entry',
    Array.isArray(settingsAfterFlip.hooks.PreToolUse) && settingsAfterFlip.hooks.PreToolUse.length === 1 &&
      settingsAfterFlip.hooks.PreToolUse[0].matcher === '',
    JSON.stringify(settingsAfterFlip.hooks.PreToolUse));
  // WO-14b leg 3R, item 1: the flip also rewrites the guard's OWN command
  // line to drop --roster new — mode selection must not lag the manifest
  // flip by even one stale argument.
  check(
    'flip to legacy rewrites the guard command WITHOUT --roster new',
    settingsAfterFlip.hooks.PreToolUse[0].hooks[0].command === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-guard.js"',
    JSON.stringify(settingsAfterFlip.hooks.PreToolUse[0])
  );
  check('flip to legacy removes PostToolUse/SubagentStop/Stop entirely (no user entries there)',
    !settingsAfterFlip.hooks.PostToolUse && !settingsAfterFlip.hooks.SubagentStop && !settingsAfterFlip.hooks.Stop,
    JSON.stringify(settingsAfterFlip.hooks));
  check('manifest installedHooks is cleared on the flip to legacy', manifest.installedHooks === undefined, JSON.stringify(manifest));

  // Flipping back to new again a second time is a no-op on generation (no
  // flip occurred: roster was already "new" going into a --roster new run).
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const genFlippedBack = readJson(path.join(target, '.claude', 'orchestra.json')).rosterGeneration;
  check('flipping back to new bumps generation again (new->legacy->new = two flips)', genFlippedBack === genBefore + 2, 'genBefore=' + genBefore + ' now=' + genFlippedBack);
  const settingsAfterReflip = readJson(path.join(target, '.claude', 'settings.json'));
  check('flipping back to new re-registers all four gate hook entries',
    settingsAfterReflip.hooks.PreToolUse.length === 2 && settingsAfterReflip.hooks.PostToolUse.length === 1 &&
      settingsAfterReflip.hooks.SubagentStop.length === 1 && settingsAfterReflip.hooks.Stop.length === 1,
    JSON.stringify(settingsAfterReflip.hooks));
  const guardEntryReflip = settingsAfterReflip.hooks.PreToolUse.find((e) => e.matcher === '');
  check(
    'flipping back to new restores --roster new on the guard command',
    !!guardEntryReflip && guardEntryReflip.hooks[0].command === 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-guard.js" --roster new',
    guardEntryReflip && JSON.stringify(guardEntryReflip)
  );
  const r2 = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const genIdempotent = readJson(path.join(target, '.claude', 'orchestra.json')).rosterGeneration;
  check('re-running --roster new with no flip does NOT bump generation again', ok(r2) && genIdempotent === genFlippedBack, 'before=' + genFlippedBack + ' after=' + genIdempotent);
  check('the ticket store is STILL byte-identical after flipping back to new (never reinitialised)',
    fs.existsSync(ticketStoreFile) && fs.readFileSync(ticketStoreFile).equals(storeBytesBefore), '');
  const manifestFlippedBack = readJson(path.join(target, '.claude', 'orchestra.json'));
  check('manifest.installedStore === true after flipping back to new', manifestFlippedBack.installedStore === true, JSON.stringify(manifestFlippedBack));
}

function case4_userKeysPreserved() {
  section('4. User keys in settings.json, .mcp.json, and orchestra.json survive install byte-for-byte');

  const target = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
  // leg 4c: a user's own hook entries for the same four events the gate
  // uses (PreToolUse/PostToolUse for a DIFFERENT tool matcher, plus
  // SubagentStop/Stop) must survive untouched alongside ours.
  fs.writeFileSync(path.join(target, '.claude', 'settings.json'), JSON.stringify({
    myCustomSetting: 'keep-me',
    permissions: { allow: ['Bash(npm test:*)'] },
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node my-own-bash-hook.js' }] }],
      PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'node my-own-write-hook.js' }] }],
      SubagentStop: [{ hooks: [{ type: 'command', command: 'node my-own-subagentstop-hook.js' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'node my-own-stop-hook.js' }] }],
    },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(target, '.mcp.json'), JSON.stringify({ mcpServers: { myOwnServer: { command: 'node', args: ['own.js'] } } }, null, 2), 'utf8');
  fs.writeFileSync(path.join(target, '.claude', 'orchestra.json'), JSON.stringify({ directorAllowedTools: ['Glob'], reviewEngine: 'opus' }, null, 2), 'utf8');

  const r = install(target, ['--roster', 'new', '--grant-push', '--no-packs', '--no-specialists']);
  check('install over an existing project with user keys succeeds', ok(r), out(r));

  const settingsHooks = readJson(path.join(target, '.claude', 'settings.json')).hooks;
  check("user's own PreToolUse(Bash) entry survives alongside the guard + gate entries",
    settingsHooks.PreToolUse.some((e) => e.matcher === 'Bash' && e.hooks[0].command === 'node my-own-bash-hook.js') &&
      settingsHooks.PreToolUse.length === 3,
    JSON.stringify(settingsHooks.PreToolUse));
  check("user's own PostToolUse(Write) entry survives alongside the gate entry",
    settingsHooks.PostToolUse.some((e) => e.matcher === 'Write' && e.hooks[0].command === 'node my-own-write-hook.js') &&
      settingsHooks.PostToolUse.length === 2,
    JSON.stringify(settingsHooks.PostToolUse));
  check("user's own SubagentStop entry survives alongside the gate entry",
    settingsHooks.SubagentStop.some((e) => e.hooks[0].command === 'node my-own-subagentstop-hook.js') &&
      settingsHooks.SubagentStop.length === 2,
    JSON.stringify(settingsHooks.SubagentStop));
  check("user's own Stop entry survives alongside the gate entry",
    settingsHooks.Stop.some((e) => e.hooks[0].command === 'node my-own-stop-hook.js') &&
      settingsHooks.Stop.length === 2,
    JSON.stringify(settingsHooks.Stop));

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

  // Item 4b/4c (WO-14b leg-3 fix round 2B, Red Team MEDIUM x2), re-pinned by
  // item B3 (fix round 3B, Red Team re-verification #2 MEDIUM): non-finite
  // exponent literals (type-destroying — they'd re-serialize as `null`) and
  // finite-but-lossy fractional/exponent literals must both be refused; a
  // VALUE-preserving exponent/fractional spelling must NOT be (the old
  // check compared spelling, not value, and refused those too).
  const unsafeFloatFixtures = [
    '9007199254740993', '1e400', '-1e400', '1E400', '2e308',
    '12345678901234567890.5', '1.00000000000000000001',
    // Item 10 (WO-14b leg-3 fix round 4, MEDIUM, red-team pass #3):
    // underflow — a NONZERO literal so far below the smallest representable
    // double that Number(tok) rounds to exactly 0 (still FINITE, so the
    // non-finite check alone doesn't catch it) must still be refused — the
    // value plainly changed.
    '1e-400', '-1e-400',
  ];
  for (const lit of unsafeFloatFixtures) {
    const t = tmpdir('orchestra-install-');
    fs.mkdirSync(path.join(t, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(t, '.claude', 'settings.json'), '{\n  "someKey": ' + lit + '\n}\n', 'utf8');
    const before = census(t);
    const r = install(t, ['--no-packs', '--no-specialists']);
    check('unsafe numeric literal ' + lit + ' -> install exits non-zero', r.status !== 0, out(r));
    check('unsafe numeric literal ' + lit + ' -> nothing touched', JSON.stringify(before) === JSON.stringify(census(t)), '');
  }
  const safeNumericFixtures = [
    '1e+10', '1e10', '1.5e3', '1e21', '1e-7', '1.0', '0.1', '3.14159', '-0',
    // Item 3/B3.2 (WO-14b leg-3 fix round 4, MAJOR, cross-vendor review #4):
    // 2^53 spelled with a cosmetic ".0" — exactly representable in a
    // double, so it must NOT be refused, even though its mantissa is 16
    // digits long (the old digit-count check refused it).
    '9007199254740992.0', '5.0',
  ];
  for (const lit of safeNumericFixtures) {
    const t = tmpdir('orchestra-install-');
    fs.mkdirSync(path.join(t, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(t, '.claude', 'settings.json'), '{\n  "someKey": ' + lit + '\n}\n', 'utf8');
    const r = install(t, ['--no-packs', '--no-specialists']);
    check('value-preserving numeric literal ' + lit + ' does NOT trigger a refusal', ok(r), out(r));
  }
  // A trailing ".0" that loses no information must NOT be refused.
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

  // WO-14b leg 3R, item 7: runtimeSha256 is removed from the pin — the
  // guard no longer require()s any project-tree runtime file, so a hash
  // pinning it to a trusted copy is no longer meaningful.
  const pinFiles = fs.readdirSync(pinDir).filter((f) => f.endsWith('.json'));
  for (const pf of pinFiles) {
    const pinObj = readJson(path.join(pinDir, pf));
    check('pin file ' + pf + ' carries no runtimeSha256 field', !('runtimeSha256' in pinObj), JSON.stringify(pinObj));
  }

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

function caseB1_junctionContainment() {
  section('B1. Uninstall containment survives a real directory junction inside .claude/ (Red Team re-verification #2 HIGH)');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);

  const victimDir = tmpdir('orchestra-junction-victim-');
  const victimFile = path.join(victimDir, 'precious.txt');
  fs.writeFileSync(victimFile, 'do not delete me via a junction', 'utf8');

  const linkPath = path.join(target, '.claude', 'escape');
  const mk = spawnSync('cmd', ['/c', 'mklink', '/J', linkPath, victimDir], { encoding: 'utf8', timeout: 15000 });
  if (mk.status !== 0) {
    console.log('  SKIPPED B1 (OS refused to create a directory junction: ' + (mk.stderr || mk.stdout || 'unknown reason').trim() + ')');
    return;
  }

  const manifestPath = path.join(target, '.claude', 'orchestra.json');
  const manifest = readJson(manifestPath);
  manifest.installedFiles = ['escape/precious.txt', 'agents/architect.md']; // one hostile entry, one legitimate
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  // Isolate item B1 from item 2's separate pin-mismatch fallback, same as
  // case 19 does for the string-level containment check.
  repinAfterHandEdit(target, manifestPath);
  const rVerify = install(target, ['--verify-pin']);
  check('(setup) pin re-matches the hand-edited manifest (isolating B1 from item 2)', /MATCH/.test(out(rVerify)) && ok(rVerify), out(rVerify));

  const r = install(target, ['--uninstall']);
  check('uninstall over a junction-escaping installedFiles entry still exits 0', ok(r), out(r));
  check('the victim file reached THROUGH the junction SURVIVES', fs.existsSync(victimFile), '');
  check('warnings name the skipped reparse-point entry', /SKIPPED/i.test(out(r)) && /reparse/i.test(out(r)), out(r));
  check('the one legitimate mixed-in entry (agents/architect.md) IS removed', !fs.existsSync(path.join(target, '.claude', 'agents', 'architect.md')), '');
}

function caseB1b_dotClaudeItselfJunctionRefused() {
  section('B1b. WO-14b leg 3R, item 7: --uninstall refuses outright when .claude itself is a reparse point (junction) rather than deleting through it');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);

  // Move the real .claude aside, then plant a junction AT .claude/ itself
  // pointing at a decoy copy outside the project — the class the prior
  // anchor (realish(.claude)) could not detect: it trusted .claude's OWN
  // resolved location as the anchor instead of the real project root, so if
  // .claude itself was the reparse point, that anchor was already outside
  // the project and everything "inside" it passed trivially.
  const realDotClaude = path.join(target, '.claude');
  const decoyDir = tmpdir('orchestra-dotclaude-decoy-');
  fs.rmSync(decoyDir, { recursive: true, force: true });
  fs.cpSync(realDotClaude, decoyDir, { recursive: true });
  fs.rmSync(realDotClaude, { recursive: true, force: true });

  const mk = spawnSync('cmd', ['/c', 'mklink', '/J', realDotClaude, decoyDir], { encoding: 'utf8', timeout: 15000 });
  if (mk.status !== 0) {
    console.log('  SKIPPED B1b (OS refused to create a directory junction: ' + (mk.stderr || mk.stdout || 'unknown reason').trim() + ')');
    return;
  }

  const r = install(target, ['--uninstall']);
  check('uninstall REFUSES (non-zero exit) when .claude itself is a junction', !ok(r), out(r));
  check('the refusal names .claude as a reparse point', /symlink\/junction \(reparse point\)/.test(out(r)), out(r));
  check('the decoy directory (the junction target) still has its files — nothing was deleted through it', fs.existsSync(path.join(decoyDir, 'agents', 'architect.md')), '');
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

  // (d) Review #3 MAJOR repro (install.js:2485): the MISMATCH/NO-PIN
  // fallback must never touch settings.local.json — a user independently
  // placed Bash(git commit:*) there; Orchestra's own copy went to
  // settings.json. When the pin goes untrusted, the fallback must remove
  // ONLY the settings.json copy and REPORT (never delete) the
  // settings.local.json one.
  const t4 = tmpdir('orchestra-install-');
  install(t4, ['--roster', 'new', '--no-packs', '--no-specialists']);
  fs.writeFileSync(path.join(t4, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { allow: ['Bash(git commit:*)'] } }), 'utf8');
  const m4path = path.join(t4, '.claude', 'orchestra.json');
  const m4 = readJson(m4path);
  m4.installedPermissions = []; // pin now MISMATCHes, same trigger as (a)
  fs.writeFileSync(m4path, JSON.stringify(m4, null, 2) + '\n', 'utf8');
  const r4 = install(t4, ['--uninstall']);
  check('(d) uninstall over a MISMATCHed pin still succeeds', ok(r4), out(r4));
  const s4 = readJson(path.join(t4, '.claude', 'settings.json'));
  const allow4 = (s4.permissions && s4.permissions.allow) || [];
  check('(d) Orchestra\'s own Bash(git commit:*) in settings.json IS removed', !allow4.includes('Bash(git commit:*)'), JSON.stringify(allow4));
  const local4 = readJson(path.join(t4, '.claude', 'settings.local.json'));
  const localAllow4 = (local4.permissions && local4.permissions.allow) || [];
  check('(d) the user-owned Bash(git commit:*) in settings.local.json SURVIVES the MISMATCH fallback', localAllow4.includes('Bash(git commit:*)'), JSON.stringify(localAllow4));
  check('(d) the report names the un-removed settings.local.json entry for manual review', /settings\.local\.json/.test(out(r4)) && /Bash\(git commit:\*\)/.test(out(r4)), out(r4));
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
  check('(setup) roster:new left architect.md, the conductor file, and a substrate dir in place', fs.existsSync(path.join(target, '.claude', 'agents', 'architect.md')) && fs.existsSync(path.join(target, '.claude', 'ORCHESTRA-CONDUCTOR.md')) && fs.existsSync(path.join(target, '.claude', 'orchestra', 'router')), '');
  fs.writeFileSync(path.join(target, '.claude', 'orchestra.json'), 'null', 'utf8');

  const rBlocked = install(target, ['--uninstall']);
  check('a malformed orchestra.json refuses a plain --uninstall', rBlocked.status !== 0, out(rBlocked));
  check('the refusal message names deletion / --ignore-manifest as the remedy', /--ignore-manifest|delete/i.test(out(rBlocked)), out(rBlocked));

  const rIgnored = install(target, ['--uninstall', '--ignore-manifest']);
  check('--uninstall --ignore-manifest succeeds despite the malformed manifest', ok(rIgnored), out(rIgnored));
  check('the guard hook is removed', !fs.existsSync(path.join(target, '.claude', 'hooks', 'orchestra-guard.js')), '');
  check('the malformed orchestra.json itself is left untouched (never read)', fs.readFileSync(path.join(target, '.claude', 'orchestra.json'), 'utf8').trim() === 'null', '');
  // Review #3 MAJOR repro (install.js:2626): --ignore-manifest used to skip
  // canonical roster cleanup entirely (exit 0, guard gone, but every
  // roster:new file left behind). Now the canonical-name fallback runs even
  // though the manifest was never read.
  check('--ignore-manifest still removes the eleven roster role files by name (architect.md)', !fs.existsSync(path.join(target, '.claude', 'agents', 'architect.md')), '');
  check('--ignore-manifest still removes ORCHESTRA-CONDUCTOR.md', !fs.existsSync(path.join(target, '.claude', 'ORCHESTRA-CONDUCTOR.md')), '');
  check('--ignore-manifest still removes the named runtime substrate directories (router)', !fs.existsSync(path.join(target, '.claude', 'orchestra', 'router')), '');
  check('--ignore-manifest prunes the now-empty .claude/orchestra/ directory', !fs.existsSync(path.join(target, '.claude', 'orchestra')), '');
  check('--ignore-manifest also removes the exact-string grant fallback (no Orchestra add/commit grant left)', (() => {
    const s = readJson(path.join(target, '.claude', 'settings.json'));
    const allow = (s.permissions && s.permissions.allow) || [];
    return !allow.includes('Bash(git add:*)') && !allow.includes('Bash(git commit:*)');
  })(), '');
  check('--ignore-manifest also removes the guard hook entry from settings.json', (() => {
    const s = readJson(path.join(target, '.claude', 'settings.json'));
    return !(s.hooks && s.hooks.PreToolUse && s.hooks.PreToolUse.length);
  })(), '');
  check('--ignore-manifest also removes the pin (path- and id-keyed) it can still compute', !fs.existsSync(pinFilePathFor(target)), '');

  // --ignore-manifest only means something with --uninstall.
  const target2 = tmpdir('orchestra-install-');
  const rNoUninstall = install(target2, ['--ignore-manifest', '--no-packs', '--no-specialists']);
  check('--ignore-manifest without --uninstall is refused', rNoUninstall.status !== 0, out(rNoUninstall));
}

function case24_uninstallRemovesGateHooks() {
  section('24. --uninstall removes the four ticket-gate hook entries (leg 4c), leaving a user\'s own entries for the same events untouched');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);

  // Plant a user's own entry on each of the four events AFTER the install,
  // the way a developer's hand-edit would.
  const settingsFile = path.join(target, '.claude', 'settings.json');
  const settings = readJson(settingsFile);
  settings.hooks.PostToolUse = (settings.hooks.PostToolUse || []).concat([
    { matcher: 'Write', hooks: [{ type: 'command', command: 'node my-own-write-hook.js' }] },
  ]);
  settings.hooks.SubagentStop = (settings.hooks.SubagentStop || []).concat([
    { hooks: [{ type: 'command', command: 'node my-own-subagentstop-hook.js' }] },
  ]);
  settings.hooks.Stop = (settings.hooks.Stop || []).concat([
    { hooks: [{ type: 'command', command: 'node my-own-stop-hook.js' }] },
  ]);
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');

  const r = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(r), out(r));

  const after = readJson(settingsFile);
  check('the guard PreToolUse entry is gone', !after.hooks || !Array.isArray(after.hooks.PreToolUse) || after.hooks.PreToolUse.length === 0, JSON.stringify(after.hooks));
  check('the gate PostToolUse entry is gone but the user\'s own PostToolUse(Write) entry survives',
    after.hooks.PostToolUse && after.hooks.PostToolUse.length === 1 && after.hooks.PostToolUse[0].hooks[0].command === 'node my-own-write-hook.js',
    JSON.stringify(after.hooks.PostToolUse));
  check('the gate SubagentStop entry is gone but the user\'s own entry survives',
    after.hooks.SubagentStop && after.hooks.SubagentStop.length === 1 && after.hooks.SubagentStop[0].hooks[0].command === 'node my-own-subagentstop-hook.js',
    JSON.stringify(after.hooks.SubagentStop));
  check('the gate Stop entry is gone but the user\'s own entry survives',
    after.hooks.Stop && after.hooks.Stop.length === 1 && after.hooks.Stop[0].hooks[0].command === 'node my-own-stop-hook.js',
    JSON.stringify(after.hooks.Stop));
}

function caseB2_deletedManifestStrandsNothing() {
  section('B2. A DELETED manifest (not only a malformed one) no longer strands a pinned roster:new install (Red Team re-verification #2 HIGH)');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('(setup) roster:new left architect.md, the conductor file, and a substrate dir in place', fs.existsSync(path.join(target, '.claude', 'agents', 'architect.md')) && fs.existsSync(path.join(target, '.claude', 'ORCHESTRA-CONDUCTOR.md')) && fs.existsSync(path.join(target, '.claude', 'orchestra', 'router')), '');

  fs.unlinkSync(path.join(target, '.claude', 'orchestra.json'));

  const r = install(target, ['--uninstall']);
  check('uninstall over a DELETED manifest still exits 0', ok(r), out(r));
  // Item 1 (WO-14b leg-3 fix round 4): a pin found (here, by the path key)
  // with the manifest gone is now its own status, NO-MANIFEST-WITH-PIN, not
  // MISMATCH — same untrusted-fallback behavior, more precise name.
  check('the report names NO-MANIFEST-WITH-PIN (manifest gone, pin still on record)', /NO-MANIFEST-WITH-PIN/.test(out(r)), out(r));
  check('the eleven roster role files are removed even with no manifest to read (architect.md)', !fs.existsSync(path.join(target, '.claude', 'agents', 'architect.md')), '');
  check('ORCHESTRA-CONDUCTOR.md is removed', !fs.existsSync(path.join(target, '.claude', 'ORCHESTRA-CONDUCTOR.md')), '');
  check('the runtime substrate directories are removed (router)', !fs.existsSync(path.join(target, '.claude', 'orchestra', 'router')), '');
  check('the guard hook file is removed', !fs.existsSync(path.join(target, '.claude', 'hooks', 'orchestra-guard.js')), '');
  const s = readJson(path.join(target, '.claude', 'settings.json'));
  const allow = (s.permissions && s.permissions.allow) || [];
  check('the Orchestra add/commit grant is removed', !allow.includes('Bash(git add:*)') && !allow.includes('Bash(git commit:*)'), JSON.stringify(allow));
  check('the guard hook entry is removed from settings.json', !(s.hooks && s.hooks.PreToolUse && s.hooks.PreToolUse.length), '');
}

function caseB4_userOwnedPermissionsHonoredByFallback() {
  section('B4. MISMATCH/NO-PIN fallback honors a readable manifest\'s userOwnedPermissions (Red Team re-verification #2 MEDIUM)');

  const target = tmpdir('orchestra-install-');
  install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const manifestPath = path.join(target, '.claude', 'orchestra.json');
  const manifest = readJson(manifestPath);
  manifest.userOwnedPermissions = ['Bash(git commit:*)'];
  manifest.installedPermissions = []; // pin now MISMATCHes, same trigger as case 20(a)
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const r = install(target, ['--uninstall']);
  check('uninstall over a MISMATCHed pin with userOwnedPermissions set still succeeds', ok(r), out(r));
  const s = readJson(path.join(target, '.claude', 'settings.json'));
  const allow = (s.permissions && s.permissions.allow) || [];
  check('the userOwnedPermissions entry (Bash(git commit:*)) SURVIVES the untrusted fallback', allow.includes('Bash(git commit:*)'), JSON.stringify(allow));
  check('the non-owned Orchestra entry (Bash(git add:*)) is still removed', !allow.includes('Bash(git add:*)'), JSON.stringify(allow));
  check('the report says the removal was on suspicion, not on record', /on suspicion/i.test(out(r)), out(r));
}

function caseB5_patternKeyValidation() {
  section('B5. directorPlanPatterns/directorMemoryPatterns/directorBlockedPatterns validated at install time (Red Team re-verification #2 MEDIUM)');

  const regexFixtures = [
    ['directorPlanPatterns', '^docs/plans/.*\\.md$'],
    ['directorMemoryPatterns', '.claude/rules/(a|b).md'],
    ['directorBlockedPatterns', 'mcp__blender__+'],
  ];
  for (const [key, entry] of regexFixtures) {
    const t = tmpdir('orchestra-install-');
    fs.mkdirSync(path.join(t, '.claude'), { recursive: true });
    const m = {};
    m[key] = [entry];
    fs.writeFileSync(path.join(t, '.claude', 'orchestra.json'), JSON.stringify(m, null, 2) + '\n', 'utf8');
    const before = census(t);
    const r = install(t, ['--no-packs', '--no-specialists']);
    check(key + ' regex-shaped entry (' + entry + ') -> install exits non-zero', r.status !== 0, out(r));
    check(key + ' -> error names the entry', out(r).indexOf(JSON.stringify(entry)) !== -1, out(r));
    check(key + ' -> nothing touched', JSON.stringify(before) === JSON.stringify(census(t)), '');
  }

  // Over the 64-entry limit.
  const tBig = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(tBig, '.claude'), { recursive: true });
  const bigList = [];
  for (let i = 0; i < 65; i++) bigList.push('docs/plans/' + i + '/**/*.md');
  fs.writeFileSync(path.join(tBig, '.claude', 'orchestra.json'), JSON.stringify({ directorPlanPatterns: bigList }, null, 2) + '\n', 'utf8');
  const rBig = install(tBig, ['--no-packs', '--no-specialists']);
  check('directorPlanPatterns with 65 entries -> install exits non-zero', rBig.status !== 0, out(rBig));

  // A well-formed glob list must NOT be refused.
  const tOk = tmpdir('orchestra-install-');
  fs.mkdirSync(path.join(tOk, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(tOk, '.claude', 'orchestra.json'),
    JSON.stringify({ directorPlanPatterns: ['docs/plans/**/*.md'], directorBlockedPatterns: ['mcp__blender__*', 'mcp__godot__*'] }, null, 2) + '\n',
    'utf8'
  );
  const rOk = install(tOk, ['--no-packs', '--no-specialists']);
  check('well-formed glob pattern keys do NOT trigger a refusal', ok(rOk), out(rOk));

  // --uninstall must stay reachable even over broken pattern keys (same
  // lock-out class as --ignore-manifest/item 7 exists to prevent).
  const tUninstall = tmpdir('orchestra-install-');
  install(tUninstall, ['--roster', 'new', '--no-packs', '--no-specialists']);
  const um = readJson(path.join(tUninstall, '.claude', 'orchestra.json'));
  um.directorBlockedPatterns = ['^bad(regex)$'];
  fs.writeFileSync(path.join(tUninstall, '.claude', 'orchestra.json'), JSON.stringify(um, null, 2) + '\n', 'utf8');
  const rUninstall = install(tUninstall, ['--uninstall']);
  check('--uninstall is NOT blocked by a broken pattern key', ok(rUninstall), out(rUninstall));
}

function case24_gitRootPinKey() {
  section('24. Third pin key — git root commit (item 3)');

  const target = tmpdir('orchestra-install-');
  initGitRepoWithCommit(target);
  const rootHash = gitRootCommitHashFor(target);
  check('(setup) git root commit hash is resolvable', typeof rootHash === 'string' && rootHash.length > 0, rootHash);

  const rNew = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('roster:new install in a git repo succeeds', ok(rNew), out(rNew));

  const manifest = readJson(path.join(target, '.claude', 'orchestra.json'));
  const pathPf = pinFilePathFor(target);
  const oldPathPf = pathPf; // captured BEFORE the move below, for item 4
  const idPf = idPinFilePathFor(manifest.projectId);
  const gitPf = gitPinFilePathFor(rootHash);
  check('pin written under the path-keyed name', fs.existsSync(pathPf), pathPf);
  check('pin written under the id-keyed name', fs.existsSync(idPf), idPf);
  check('pin written under the git-keyed name', fs.existsSync(gitPf), gitPf);
  const pathPin = readJson(pathPf);
  const gitPin = readJson(gitPf);
  const stripWrittenAt = (p) => JSON.stringify(Object.assign({}, p, { writtenAt: null }));
  check('the git-keyed pin has identical content to the path-keyed pin (writtenAt aside)', stripWrittenAt(pathPin) === stripWrittenAt(gitPin), '');

  // Move the project and replace the manifest WHOLESALE (no projectId
  // survives it) — the id-keyed lookup can no longer find anything, but the
  // git-keyed one still can: it depends only on the project's actual commit
  // history, never on any manifest field.
  const newTarget = tmpdir('orchestra-install-new-');
  fs.rmSync(newTarget, { recursive: true, force: true });
  fs.cpSync(target, newTarget, { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.writeFileSync(path.join(newTarget, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'legacy' }, null, 2) + '\n', 'utf8');

  const rVerify = install(newTarget, ['--verify-pin']);
  check('--verify-pin after move+manifest-replace reports MISMATCH (found by git key), not NO-PIN', /MISMATCH/.test(out(rVerify)), out(rVerify));
  check('MISMATCH exits non-zero', rVerify.status !== 0, out(rVerify));
  check('the report names the git-keyed pin file', out(rVerify).indexOf(path.basename(gitPf)) !== -1, out(rVerify));

  // Uninstall removes all three pin copies it can still find/compute.
  const rUninstall = install(newTarget, ['--uninstall']);
  check('uninstall of the moved, manifest-replaced project succeeds', ok(rUninstall), out(rUninstall));
  check('the path-keyed pin (new location) is removed', !fs.existsSync(pinFilePathFor(newTarget)), '');
  check('the id-keyed pin is removed', !fs.existsSync(idPf), '');
  check('the git-keyed pin is removed', !fs.existsSync(gitPf), '');
  // Item 4 (WO-14b leg-3 fix round 4, MINOR, cross-vendor review #4): the
  // OLD path-keyed pin — from before the move, recovered here purely
  // because the git-keyed pin's own `projectDir` field still names it — is
  // removed too, not left behind to misclassify a different project later
  // created at that old path.
  check('item 4: the OLD path-keyed pin (pre-move location) is removed too', !fs.existsSync(oldPathPf), oldPathPf);
}

function case25_userOwnHookBasenameCollisionSurvives() {
  section("25. WO-14b leg 4 fix round item 11: a user's own `node tools/ticket-gate.js` hook (same BASENAME as ours, different path) survives install/flip/uninstall");

  const target = tmpdir('orchestra-install-');
  const r1 = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('(setup) roster:new install succeeds', ok(r1), out(r1));

  // Plant the user's own entries AFTER install, the way a developer's
  // hand-edit would — command basename `ticket-gate.js` collides with ours,
  // but the path (`tools/ticket-gate.js`, not
  // `.claude/orchestra/bridge/hooks/ticket-gate.js`) does not. Before item
  // 11's fix, isOurGateHookEntry() matched on basename substring alone and
  // would have misclassified — and removed — every one of these.
  const settingsFile = path.join(target, '.claude', 'settings.json');
  function plantUserHooks() {
    const settings = readJson(settingsFile);
    settings.hooks.PreToolUse = (settings.hooks.PreToolUse || []).concat([
      { matcher: 'Agent', hooks: [{ type: 'command', command: 'node tools/ticket-gate.js PreToolUse' }] },
    ]);
    settings.hooks.PostToolUse = (settings.hooks.PostToolUse || []).concat([
      { matcher: 'Agent', hooks: [{ type: 'command', command: 'node tools/ticket-gate.js PostToolUse' }] },
    ]);
    settings.hooks.SubagentStop = (settings.hooks.SubagentStop || []).concat([
      { hooks: [{ type: 'command', command: 'node tools/ticket-gate.js SubagentStop' }] },
    ]);
    settings.hooks.Stop = (settings.hooks.Stop || []).concat([
      { hooks: [{ type: 'command', command: 'node tools/ticket-gate.js Stop' }] },
    ]);
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  }
  plantUserHooks();

  function userEntriesPresent(label) {
    const s = readJson(settingsFile);
    const has = (eventName) =>
      Array.isArray(s.hooks[eventName]) &&
      s.hooks[eventName].some((e) => e.hooks && e.hooks[0] && e.hooks[0].command === 'node tools/ticket-gate.js ' + eventName);
    for (const eventName of ['PreToolUse', 'PostToolUse', 'SubagentStop', 'Stop']) {
      check(label + ': user\'s own ' + eventName + ' entry (node tools/ticket-gate.js) survives', has(eventName), JSON.stringify(s.hooks[eventName]));
    }
  }

  // (a) a re-run of --roster new (our own entries merged in ALONGSIDE, never
  //     replacing/removing the user's colliding-basename ones).
  const r2 = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('re-run of --roster new succeeds', ok(r2), out(r2));
  userEntriesPresent('after a --roster new re-run');
  {
    const s = readJson(settingsFile);
    check('...and OUR gate entry is also present (both coexist)',
      Array.isArray(s.hooks.PreToolUse) && s.hooks.PreToolUse.some((e) => e.hooks[0].command.indexOf('.claude/orchestra/bridge/hooks/ticket-gate.js') !== -1),
      JSON.stringify(s.hooks.PreToolUse));
  }

  // (b) a legacy flip removes OUR gate entries (hygiene) but must not touch
  //     the user's colliding-basename ones.
  const r3 = install(target, ['--roster', 'legacy', '--no-packs', '--no-specialists']);
  check('flip to --roster legacy succeeds', ok(r3), out(r3));
  userEntriesPresent('after the legacy flip');
  {
    const s = readJson(settingsFile);
    check('...and OUR gate entry is gone (legacy hygiene)',
      !(Array.isArray(s.hooks.PreToolUse) && s.hooks.PreToolUse.some((e) => e.hooks[0].command.indexOf('.claude/orchestra/bridge/hooks/ticket-gate.js') !== -1)),
      JSON.stringify(s.hooks.PreToolUse));
  }

  // (c) flip back to new: our entries return, the user's still survive.
  const r4 = install(target, ['--roster', 'new', '--no-packs', '--no-specialists']);
  check('flip back to --roster new succeeds', ok(r4), out(r4));
  userEntriesPresent('after flipping back to new');

  // (d) --uninstall: our entries are removed, the user's own still survive.
  const r5 = install(target, ['--uninstall']);
  check('uninstall succeeds', ok(r5), out(r5));
  userEntriesPresent('after --uninstall');
  {
    const s = readJson(settingsFile);
    check('...and OUR gate entry is gone after uninstall',
      !(Array.isArray(s.hooks.PreToolUse) && s.hooks.PreToolUse.some((e) => e.hooks[0].command.indexOf('.claude/orchestra/bridge/hooks/ticket-gate.js') !== -1)),
      JSON.stringify(s.hooks.PreToolUse));
  }
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
  case24_uninstallRemovesGateHooks();
  caseB1_junctionContainment();
  caseB1b_dotClaudeItselfJunctionRefused();
  caseB2_deletedManifestStrandsNothing();
  caseB4_userOwnedPermissionsHonoredByFallback();
  caseB5_patternKeyValidation();
  case24_gitRootPinKey();
  case25_userOwnHookBasenameCollisionSurvives();
} catch (e) {
  check('the suite ran to completion', false, (e && e.stack) || e);
}
finish();
