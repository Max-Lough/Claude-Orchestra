#!/usr/bin/env node
/**
 * Scan-lane tests for install.js --scan / --update.
 *
 *   node tests/scan-lane.test.js
 *
 * No dependencies, no test framework — plain node and the real installer, same
 * shape as the review- and exec-lane suites. Nothing is stubbed: each fixture
 * project is a genuine install produced by install.js, then aged by rewriting
 * the version it recorded. That matters, because the thing under test is
 * whether the scan reads what the installer actually wrote — a mocked layout
 * would only prove the mock and the test agree.
 *
 * The exit-code discipline is inherited verbatim: a failure sets the code the
 * moment it exists, an `exit` handler enforces it, and a suite that recorded
 * no checks fails on that basis alone.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const INSTALLER = path.join(MASTER, 'install.js');
const VERSION = fs.readFileSync(path.join(MASTER, 'VERSION'), 'utf8').trim();

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
process.on('uncaughtException', (e) => {
  check('no uncaught exception in the suite', false, (e && e.stack) || e);
  finish();
});

// ------------------------------------------------------------------ fixtures

function installer(args, opts) {
  return spawnSync(process.execPath, [INSTALLER].concat(args), {
    cwd: (opts && opts.cwd) || MASTER,
    encoding: 'utf8',
    timeout: 120000,
  });
}

function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-scan-test-'));
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

// A real install, then aged. `version: null` strips the record entirely and
// removes the header stamp — the shape of a pre-versioning install, which the
// scan must still find and classify rather than skip.
function makeProject(root, rel, opts) {
  const dir = path.join(root, rel);
  fs.mkdirSync(dir, { recursive: true });
  const args = [dir];
  if (opts && opts.packs) args.push('--packs', opts.packs);
  const r = installer(args);
  if (r.status !== 0) {
    throw new Error('fixture install failed for ' + rel + ':\n' + (r.stdout || '') + (r.stderr || ''));
  }
  const version = opts ? opts.version : undefined;
  if (version === null) {
    fs.unlinkSync(path.join(dir, '.claude', 'orchestra-install.json'));
    const md = path.join(dir, '.claude', 'ORCHESTRA.md');
    fs.writeFileSync(md, fs.readFileSync(md, 'utf8').replace(' (v' + VERSION + ')', ''), 'utf8');
  } else if (version) {
    const stateFile = path.join(dir, '.claude', 'orchestra-install.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    state.version = version;
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', 'utf8');
    const md = path.join(dir, '.claude', 'ORCHESTRA.md');
    fs.writeFileSync(
      md,
      fs.readFileSync(md, 'utf8').replace('(v' + VERSION + ')', '(v' + version + ')'),
      'utf8'
    );
  }
  return dir;
}

function installedVersion(dir) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dir, '.claude', 'orchestra-install.json'), 'utf8')
    ).version;
  } catch (_) {
    return '';
  }
}

function installedPacks(dir) {
  try {
    const s = JSON.parse(
      fs.readFileSync(path.join(dir, '.claude', 'orchestra-install.json'), 'utf8')
    );
    return Array.isArray(s.packs) ? s.packs : [];
  } catch (_) {
    return [];
  }
}

// ---------------------------------------------------------------- the tests

function case1() {
  section('1. Discovery: what counts as an install, and what does not');
  const root = makeTree();
  const current = makeProject(root, 'current');
  const stale = makeProject(root, 'nested/deep/stale', { version: '1.4.1' });

  // A .claude directory alone is NOT an install — every Claude Code project
  // has one. The protocol file is the marker.
  fs.mkdirSync(path.join(root, 'plain-project', '.claude'), { recursive: true });
  // Noise that must never be walked into: an "install" buried in node_modules
  // is a vendored copy, not a project of the user's.
  const buried = path.join(root, 'current', 'node_modules', 'pkg', '.claude');
  fs.mkdirSync(buried, { recursive: true });
  fs.writeFileSync(path.join(buried, 'ORCHESTRA.md'), '# vendored copy\n');

  const r = installer(['--scan', root]);
  const out = r.stdout || '';
  check('the up-to-date install is found', out.includes(current), out.slice(0, 600));
  check('a nested install is found', out.includes(stale), out.slice(0, 600));
  check(
    'a bare .claude directory is not reported as an install',
    !out.includes(path.join(root, 'plain-project')),
    out.slice(0, 600)
  );
  check('node_modules is not walked into', !out.includes('node_modules'), out.slice(0, 600));
  check('the count matches the rows', /2 install\(s\)/.test(out), out.slice(-400));
}

function case2() {
  section('2. Classification: behind, ahead, unversioned, current');
  const root = makeTree();
  makeProject(root, 'current');
  makeProject(root, 'old', { version: '1.4.1' });
  makeProject(root, 'ancient', { version: null });
  makeProject(root, 'newer', { version: '99.0.0' });

  const r = installer(['--scan', root]);
  const out = r.stdout || '';
  const row = (name) =>
    (out.split('\n').find((l) => l.includes(path.join(root, name))) || '').trim();

  check('a current install reads as up to date', /up to date/.test(row('current')), row('current'));
  check('an older install reads as BEHIND', /BEHIND/.test(row('old')), row('old'));
  check(
    'a pre-versioning install reads as unversioned AND behind',
    /unversioned/.test(row('ancient')) && /BEHIND/.test(row('ancient')),
    row('ancient')
  );
  check('a newer install reads as ahead', /ahead/.test(row('newer')), row('newer'));
  check(
    'the summary counts behind and ahead separately',
    /2 behind/.test(out) && /1 ahead/.test(out),
    out.slice(-500)
  );
  check(
    'scan-only exits 1 when something is behind (usable as a check)',
    r.status === 1,
    'exit ' + r.status
  );
}

function case3() {
  section('3. Update brings stale installs up — and preserves their selection');
  const root = makeTree();
  const withPack = makeProject(root, 'with-pack', { version: '1.4.1', packs: 'codex' });
  const plain = makeProject(root, 'plain', { version: '1.4.1' });
  const ahead = makeProject(root, 'ahead', { version: '99.0.0' });

  check('fixture really is stale before the update', installedVersion(withPack) === '1.4.1');
  check('fixture really recorded its pack', installedPacks(withPack).join() === 'codex');

  const r = installer(['--scan', root, '--update']);
  const out = r.stdout || '';
  check('the update reports success', r.status === 0, 'exit ' + r.status + '\n' + out.slice(-600));
  check('both stale installs were updated', /2 updated, 0 failed/.test(out), out.slice(-400));
  check('the stale install is now current', installedVersion(withPack) === VERSION,
    installedVersion(withPack));
  check('the other stale install is now current', installedVersion(plain) === VERSION,
    installedVersion(plain));

  // The whole reason updates spawn a plain re-run: the project's OWN selection
  // is what survives. A scan that reset every project to the core harness
  // would be a downgrade wearing an update's name.
  check(
    'the codex pack selection survived the update',
    installedPacks(withPack).join() === 'codex',
    installedPacks(withPack).join()
  );
  check(
    'and the pack files are actually present',
    fs.existsSync(path.join(withPack, '.claude', 'agents', 'executor-codex-heavy.md')) &&
      fs.existsSync(path.join(withPack, '.claude', 'hooks', 'orchestra-exec.js')),
    fs.readdirSync(path.join(withPack, '.claude', 'agents')).join(', ')
  );
  check(
    'a project that never asked for the pack did not gain one',
    installedPacks(plain).length === 0 &&
      !fs.existsSync(path.join(plain, '.claude', 'agents', 'executor-codex-heavy.md')),
    installedPacks(plain).join()
  );

  // Downgrading someone's newer install would be data loss, not an update.
  check(
    'an install ahead of the master is left untouched',
    installedVersion(ahead) === '99.0.0',
    installedVersion(ahead)
  );

  const again = installer(['--scan', root]);
  check(
    're-scanning after the update reports nothing behind, and exits 0',
    /0 behind/.test(again.stdout || '') && again.status === 0,
    'exit ' + again.status + '\n' + (again.stdout || '').slice(-300)
  );
}

function case4() {
  section('4. A pre-versioning install is updated, and its blind spot is stated');
  const root = makeTree();
  const ancient = makeProject(root, 'ancient', { version: null });
  const r = installer(['--scan', root, '--update']);
  const out = r.stdout || '';
  check('it was updated', installedVersion(ancient) === VERSION, installedVersion(ancient));
  // A plain re-run inherits the RECORDED selection; there isn't one here, so
  // packs that project may have had are not restored. Saying so is the
  // difference between an honest update and a silent downgrade.
  check(
    'the missing-record blind spot is called out before the run',
    /no install record/.test(out) && /NOT\s*\n?\s*restored automatically/.test(out),
    out.slice(0, 900)
  );
}

function case5() {
  section('5. Refusals: the combinations that would silently rewrite choices');
  const root = makeTree();
  makeProject(root, 'p', { version: '1.4.1', packs: 'codex' });

  // One selection applied across many projects is not an update — it is a
  // rewrite of decisions each project made separately.
  const withPacks = installer(['--scan', root, '--packs', 'codex']);
  check(
    '--scan with --packs is refused',
    withPacks.status === 1 && /cannot be combined with --packs/.test(withPacks.stderr || ''),
    'exit ' + withPacks.status + ' ' + (withPacks.stderr || '').slice(0, 200)
  );

  const withSpecialists = installer(['--scan', root, '--specialists', 'modeler']);
  check(
    '--scan with --specialists is refused',
    withSpecialists.status === 1 &&
      /cannot be combined with --packs\/--specialists/.test(withSpecialists.stderr || ''),
    'exit ' + withSpecialists.status
  );

  // Mass uninstall is deliberately not a convenience.
  const withUninstall = installer(['--scan', root, '--uninstall']);
  check(
    '--scan with --uninstall is refused',
    withUninstall.status === 1 &&
      /cannot be combined with --uninstall/.test(withUninstall.stderr || ''),
    'exit ' + withUninstall.status
  );
  check(
    'and the refusal left the project installed',
    fs.existsSync(path.join(root, 'p', '.claude', 'ORCHESTRA.md')),
    'the refusal removed files'
  );

  const withTarget = installer(['--scan', root, path.join(root, 'p')]);
  check(
    '--scan plus a target directory is refused as ambiguous',
    withTarget.status === 1 && /takes the directory to search and nothing else/.test(withTarget.stderr || ''),
    'exit ' + withTarget.status
  );

  const bare = installer(['--scan']);
  check(
    '--scan with no directory is refused',
    bare.status === 1 && /needs a directory to search/.test(bare.stderr || ''),
    'exit ' + bare.status
  );

  const orphanUpdate = installer(['--update']);
  check(
    '--update without --scan is refused rather than silently ignored',
    orphanUpdate.status === 1 && /only means something with --scan/.test(orphanUpdate.stderr || ''),
    'exit ' + orphanUpdate.status
  );

  const orphanDepth = installer(['--depth', '3']);
  check(
    '--depth without --scan is refused',
    orphanDepth.status === 1 && /only means something with --scan/.test(orphanDepth.stderr || ''),
    'exit ' + orphanDepth.status
  );

  const badDepth = installer(['--scan', root, '--depth', '0']);
  check(
    '--depth 0 is refused',
    badDepth.status === 1 && /positive whole number/.test(badDepth.stderr || ''),
    'exit ' + badDepth.status
  );

  const missing = installer(['--scan', path.join(root, 'no-such-dir')]);
  check(
    'a scan directory that does not exist fails honestly',
    missing.status === 1 && /Scan directory does not exist/.test(missing.stderr || ''),
    'exit ' + missing.status
  );
}

function case6() {
  section('6. Depth limit, empty results, and the master itself');
  const root = makeTree();
  makeProject(root, 'a/b/c/d/deep', { version: '1.4.1' });

  const shallow = installer(['--scan', root, '--depth', '2']);
  check(
    'a project below the depth limit is not found',
    /No Orchestra installs found/.test(shallow.stdout || ''),
    (shallow.stdout || '').slice(0, 400)
  );
  check(
    'and finding nothing is not an error',
    shallow.status === 0,
    'exit ' + shallow.status
  );
  check(
    'the empty report explains the depth limit rather than just saying none',
    /deeper than the depth limit/.test(shallow.stdout || ''),
    (shallow.stdout || '').slice(0, 500)
  );

  const deep = installer(['--scan', root, '--depth', '8']);
  check(
    'raising the depth finds it',
    /1 install\(s\)/.test(deep.stdout || ''),
    (deep.stdout || '').slice(-300)
  );

  // The master is not one of its own installs: it has ORCHESTRA.md at its
  // root, not under .claude/, and the walk skips it by path as well.
  const masterScan = installer(['--scan', MASTER, '--depth', '2']);
  check(
    'scanning the master does not report the master as an install',
    !new RegExp('^\\s+\\S+\\s+\\S+\\s+' + MASTER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm')
      .test(masterScan.stdout || ''),
    (masterScan.stdout || '').slice(0, 500)
  );
}

function case7() {
  section('7. A broken install record degrades to unversioned, not to a crash');
  const root = makeTree();
  const broken = makeProject(root, 'broken');
  fs.writeFileSync(
    path.join(broken, '.claude', 'orchestra-install.json'),
    '{ this is not json',
    'utf8'
  );
  const r = installer(['--scan', root]);
  const out = r.stdout || '';
  // The header stamp is still readable, so the row should fall back to it
  // rather than reporting unknown — and above all must not take the scan down.
  check('the scan still completes', /1 install\(s\)/.test(out), out.slice(0, 600));
  check(
    'the version falls back to the ORCHESTRA.md stamp',
    new RegExp(VERSION.replace(/\./g, '\\.') + '\\s+up to date').test(out),
    out.slice(0, 600)
  );
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

function main() {
  case1();
  case2();
  case3();
  case4();
  case5();
  case6();
  case7();
}

try {
  main();
  finish();
} catch (e) {
  check('the suite ran to completion', false, (e && e.stack) || e);
  finish();
}
