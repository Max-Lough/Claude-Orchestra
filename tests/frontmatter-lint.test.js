#!/usr/bin/env node
/**
 * Frontmatter-lint tests for install.js.
 *
 *   node tests/frontmatter-lint.test.js
 *
 * The failure under test is the worst kind: Claude Code drops a file with
 * unparseable frontmatter SILENTLY — no log, no telemetry, the agent simply
 * never registers in any session. That shipped for real (packs/codex agents
 * whose descriptions carried an unquoted "launcher: it runs"; a bare ": "
 * makes the whole YAML block unparseable, and Claude Code's repair pass is
 * defeated by CRLF checkouts, so the bug was invisible on LF platforms).
 * These tests pin four layers of defence:
 *
 *   1. `node install.js --lint` — the standalone check CI runs over the repo.
 *   2. The installer's refusal to copy anything when a source file fails.
 *   3. LF normalization of installed .md files plus the stamped
 *      .claude/.gitattributes, so a downstream re-checkout cannot re-arm the
 *      CRLF interaction.
 *   4. .claude/hooks/package.json ({"type":"commonjs"}), stamped so every
 *      hook script keeps CJS semantics even when a target's own root
 *      package.json declares "type": "module" — without it Node treats every
 *      .js file under .claude/hooks/ as ESM and `require` throws at module
 *      scope, killing the guard and every pack hook outright.
 *
 * Same conventions as the other suites: no dependencies, exit-code discipline
 * enforced by an exit handler, and a suite that ran no checks fails.
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

function lint(dir) {
  return spawnSync(process.execPath, [INSTALLER, '--lint', dir], {
    encoding: 'utf8',
    timeout: 60000,
  });
}

function install(target, extraArgs) {
  return spawnSync(process.execPath, [INSTALLER, target].concat(extraArgs || []), {
    encoding: 'utf8',
    timeout: 120000,
    cwd: MASTER,
  });
}

function writeAgent(dir, name, frontmatterLines, eol) {
  const text = ['---'].concat(frontmatterLines, ['---', '', 'Body.', '']).join(eol || '\n');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), text, 'utf8');
}

// ---------------------------------------------------------------- the tests

function case1() {
  section('1. The whole repository lints clean (the CI gate)');
  const r = lint(MASTER);
  check(
    'node install.js --lint over the master exits 0',
    r.status === 0 && /0 error\(s\) · 0 warning\(s\)/.test(r.stdout || ''),
    'status=' + r.status + '\n' + (r.stdout || '') + (r.stderr || '')
  );
}

function case2() {
  section('2. The exact field failure is an ERROR with file, line, and remedy');
  const dir = tmpdir('orchestra-lint-');
  writeAgent(path.join(dir, 'agents'), 'bad.md', [
    'name: bad',
    'description: Cross-vendor executor. This agent is a thin launcher: it runs the exec runner and relays the report.',
    'model: haiku',
  ]);
  const r = lint(dir);
  const all = (r.stdout || '') + (r.stderr || '');
  check('the lint fails', r.status === 1, 'status=' + r.status + '\n' + all);
  check(
    'the error names the file and the line',
    /agents\/bad\.md:3/.test(all),
    all
  );
  check(
    'the error explains the silent-drop consequence and the fix',
    /contains ": "/.test(all) && /silently/i.test(all) && /Quote the value/.test(all),
    all
  );
}

function case3() {
  section('3. The rest of the unparseable class is caught too');
  const dir = tmpdir('orchestra-lint-');
  writeAgent(path.join(dir, 'agents'), 'indicator.md', [
    'name: indicator',
    'description: *starts with an alias indicator',
  ]);
  writeAgent(path.join(dir, 'agents'), 'unterminated.md', ['name: unterminated']);
  // Overwrite: strip the closing --- to model an unterminated block.
  fs.writeFileSync(
    path.join(dir, 'agents', 'unterminated.md'),
    '---\nname: unterminated\ndescription: never closed\n\nBody.\n',
    'utf8'
  );
  writeAgent(path.join(dir, 'agents'), 'noname.md', ['description: has no name key']);
  writeAgent(path.join(dir, 'agents'), 'nofm.md', []);
  fs.writeFileSync(path.join(dir, 'agents', 'nofm.md'), '# just a doc\n', 'utf8');
  const r = lint(dir);
  const all = (r.stdout || '') + (r.stderr || '');
  check('lint fails', r.status === 1, 'status=' + r.status);
  check('a leading YAML indicator in a value is an error', /indicator\.md:3 — description: unquoted value begins with the YAML indicator/.test(all), all);
  check('an unterminated frontmatter block is an error', /unterminated\.md:1 — frontmatter never closes/.test(all), all);
  check('a missing name in an agent file is an error', /noname\.md:1 — no top-level "name:"/.test(all), all);
  check('an agent file without frontmatter at all is an error', /nofm\.md:1 — no frontmatter block/.test(all), all);
}

function case4() {
  section('4. Repair-pass-dependent and lossy values are warnings (fatal in lint mode)');
  const dir = tmpdir('orchestra-lint-');
  writeAgent(path.join(dir, 'agents'), 'comment.md', [
    'name: comment',
    'description: everything after this #vanishes into a comment',
  ]);
  writeAgent(path.join(dir, 'agents'), 'crlf.md', [
    'name: crlf',
    'description: fine text but carriage returns',
  ], '\r\n');
  const r = lint(dir);
  const all = (r.stdout || '') + (r.stderr || '');
  check('lint fails on warnings (strict mode)', r.status === 1, 'status=' + r.status);
  check('a " #" value warns about silent truncation', /comment\.md:3 — description: everything from " #" onward/.test(all), all);
  check('CRLF line endings are called out', /crlf\.md:1 — CRLF line endings/.test(all), all);

  // ...and the clean shape passes, including quoted values that CONTAIN the
  // dangerous characters — quoting is the recommended fix, so it must pass.
  const ok = tmpdir('orchestra-lint-');
  writeAgent(path.join(ok, 'agents'), 'good.md', [
    'name: good',
    'description: "A launcher: it quotes the risky value, so [everything] is fine — #s and all."',
    'tools: Bash, Read',
    'model: haiku',
  ]);
  const r2 = lint(ok);
  check(
    'a quoted value carrying ": ", "#", and brackets passes clean',
    r2.status === 0,
    'status=' + r2.status + '\n' + (r2.stdout || '') + (r2.stderr || '')
  );
}

function case5() {
  section('5. The installer refuses to stamp a source that fails the lint');
  // A throwaway specialist is written INTO the master for the duration of the
  // check — the only way to exercise the real install path end-to-end — and
  // removed again whatever happens.
  const canary = path.join(MASTER, 'agents', 'specialists', 'zz-lint-canary.md');
  cleanups.push(() => { try { fs.unlinkSync(canary); } catch (_) {} });
  fs.writeFileSync(
    canary,
    '---\nname: zz-lint-canary\ndescription: A canary: it must never install.\n---\n\nBody.\n',
    'utf8'
  );
  const target = tmpdir('orchestra-lint-target-');
  const r = install(target, ['--specialists', 'zz-lint-canary', '--no-packs']);
  const all = (r.stdout || '') + (r.stderr || '');
  check('the install fails', r.status === 1, 'status=' + r.status + '\n' + all);
  check(
    'the refusal names the file, the line, and the consequence',
    /zz-lint-canary\.md:3/.test(all) && /refusing to install/.test(all) && /SILENTLY/.test(all),
    all
  );
  check(
    'nothing was copied before the refusal',
    !fs.existsSync(path.join(target, '.claude')) && !fs.existsSync(path.join(target, 'CLAUDE.md')),
    fs.existsSync(path.join(target, '.claude')) ? 'target .claude exists' : 'CLAUDE.md exists'
  );
  fs.unlinkSync(canary);
}

function case6() {
  section('6. Installed markdown is LF on disk, and .gitattributes pins it');
  const target = tmpdir('orchestra-lint-target-');
  const r = install(target, ['--no-packs', '--no-specialists']);
  check('the install succeeds', r.status === 0, 'status=' + r.status + '\n' + (r.stdout || '') + (r.stderr || ''));
  const agent = fs.readFileSync(path.join(target, '.claude', 'agents', 'executor.md'), 'utf8');
  const protocol = fs.readFileSync(path.join(target, '.claude', 'ORCHESTRA.md'), 'utf8');
  check('an installed agent carries no CR bytes', !/\r/.test(agent), 'CR found in executor.md');
  check('the installed protocol carries no CR bytes', !/\r/.test(protocol), 'CR found in ORCHESTRA.md');
  const ga = path.join(target, '.claude', '.gitattributes');
  const gaContent = fs.existsSync(ga) ? fs.readFileSync(ga, 'utf8') : '';
  check(
    '.claude/.gitattributes is stamped with LF rules',
    fs.existsSync(ga) && /\*\.md text eol=lf/.test(gaContent) && /\*\.js text eol=lf/.test(gaContent),
    gaContent || '(missing)'
  );
  check(
    '.claude/.gitattributes pins *.json too (covers settings.json / orchestra-install.json, not just the hooks stamp)',
    /\*\.json text eol=lf/.test(gaContent),
    gaContent || '(missing)'
  );

  // A user-owned .gitattributes is never replaced...
  const target2 = tmpdir('orchestra-lint-target-');
  fs.mkdirSync(path.join(target2, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(target2, '.claude', '.gitattributes'), '# mine\n', 'utf8');
  const r2 = install(target2, ['--no-packs', '--no-specialists']);
  check(
    'an existing .gitattributes is left untouched, with a note',
    r2.status === 0 &&
      fs.readFileSync(path.join(target2, '.claude', '.gitattributes'), 'utf8') === '# mine\n' &&
      /pins no LF endings/.test(r2.stdout || ''),
    (r2.stdout || '').slice(-600)
  );

  // ...and uninstall removes only the installer's own shape (isOurGitattributes:
  // our header line + every other non-empty, non-comment line a plain
  // "<pattern> text eol=lf" rule) — not a byte-exact match against today's
  // GITATTRIBUTES_CONTENT specifically. See the two regression checks below.
  const u1 = install(target, ['--uninstall']);
  check(
    'uninstall removes the installer-stamped .gitattributes',
    u1.status === 0 && !fs.existsSync(ga),
    'status=' + u1.status + ', exists=' + fs.existsSync(ga)
  );
  const u2 = install(target2, ['--uninstall']);
  check(
    'uninstall leaves the user-owned .gitattributes alone',
    u2.status === 0 && fs.existsSync(path.join(target2, '.claude', '.gitattributes')),
    'status=' + u2.status
  );

  // Regression: a byte-exact compare against GITATTRIBUTES_CONTENT stops
  // recognizing anything the moment that constant's pattern list changes —
  // exactly what just happened (package.json -> *.json) — silently orphaning
  // every pre-1.9.1 project's stamped file on every future --uninstall,
  // forever. Simulate the file a 1.9.0 installer actually wrote: our header,
  // but only the two-pattern *.md/*.js body (no *.json line).
  const legacyTarget = tmpdir('orchestra-lint-target-');
  fs.mkdirSync(path.join(legacyTarget, '.claude'), { recursive: true });
  const legacyGa = path.join(legacyTarget, '.claude', '.gitattributes');
  fs.writeFileSync(
    legacyGa,
    [
      '# Written by the Orchestra installer. Keep installed files LF on disk:',
      "# Claude Code's frontmatter repair pass cannot match lines with a trailing",
      '# CR, so a CRLF re-checkout (core.autocrlf) can silently drop agents whose',
      '# YAML would need that repair. Delete only if you manage line endings here.',
      '*.md text eol=lf',
      '*.js text eol=lf',
      '',
    ].join('\n'),
    'utf8'
  );
  const legacyUninstall = install(legacyTarget, ['--uninstall']);
  check(
    '--uninstall recognizes and removes a pre-1.9.1, two-pattern .gitattributes',
    legacyUninstall.status === 0 && !fs.existsSync(legacyGa),
    'status=' + legacyUninstall.status + ', exists=' + fs.existsSync(legacyGa)
  );

  // ...but a file that is ours PLUS one hand-added line still fails the shape
  // (an extra non-"pattern text eol=lf" line breaks the every() check) and is
  // correctly left alone — the shape match is not a rubber stamp.
  const editedTarget = tmpdir('orchestra-lint-target-');
  const rEdited = install(editedTarget, ['--no-packs', '--no-specialists']);
  check(
    'fixture install for the edited-file case succeeds',
    rEdited.status === 0,
    (rEdited.stdout || '') + (rEdited.stderr || '')
  );
  const editedGa = path.join(editedTarget, '.claude', '.gitattributes');
  const originalGa = fs.readFileSync(editedGa, 'utf8');
  const editedContent = originalGa + '*.png binary\n';
  fs.writeFileSync(editedGa, editedContent, 'utf8');
  const editedUninstall = install(editedTarget, ['--uninstall']);
  check(
    '--uninstall leaves a genuinely user-edited .gitattributes (extra custom line) in place',
    editedUninstall.status === 0 &&
      fs.existsSync(editedGa) &&
      fs.readFileSync(editedGa, 'utf8') === editedContent,
    'exists=' + fs.existsSync(editedGa)
  );
}

function case7() {
  section('7. Hooks stay CommonJS even under a "type": "module" target (.claude/hooks/package.json)');

  // The field failure: a target whose ROOT package.json declares ESM makes
  // Node treat every copied .js hook the same way, and `require(...)` blows
  // up at module scope before the hook's own logic ever runs.
  const target = tmpdir('orchestra-lint-target-');
  fs.writeFileSync(
    path.join(target, 'package.json'),
    JSON.stringify({ name: 'esm-target', type: 'module' }, null, 2) + '\n',
    'utf8'
  );
  const r = install(target, ['--packs', 'codex']);
  check('the install succeeds', r.status === 0, 'status=' + r.status + '\n' + (r.stdout || '') + (r.stderr || ''));

  const scoping = path.join(target, '.claude', 'hooks', 'package.json');
  check(
    '.claude/hooks/package.json is stamped with {"type":"commonjs"}',
    fs.existsSync(scoping) && fs.readFileSync(scoping, 'utf8') === '{"type":"commonjs"}\n',
    fs.existsSync(scoping) ? fs.readFileSync(scoping, 'utf8') : '(missing)'
  );
  check(
    'the install log reports the stamp',
    /\.claude\/hooks\/package\.json stamped/.test(r.stdout || ''),
    (r.stdout || '').slice(-800)
  );

  // The actual regression: spawning the installed hooks as plain `node
  // <file>` must not crash at module scope. `--doctor` may legitimately
  // report a missing/unauthenticated Codex CLI (this CI has none) — that is
  // a normal doctor finding, not the bug under test.
  const guardRun = spawnSync(
    process.execPath,
    [path.join(target, '.claude', 'hooks', 'orchestra-guard.js')],
    { encoding: 'utf8', timeout: 30000, input: '{}' }
  );
  const guardAll = (guardRun.stdout || '') + (guardRun.stderr || '');
  check(
    'orchestra-guard.js does not crash with "require is not defined"',
    !/ReferenceError: require is not defined/.test(guardAll),
    'status=' + guardRun.status + '\n' + guardAll
  );

  const doctorRun = spawnSync(
    process.execPath,
    [path.join(target, '.claude', 'hooks', 'orchestra-review.js'), '--doctor'],
    { encoding: 'utf8', timeout: 60000, cwd: target }
  );
  const doctorAll = (doctorRun.stdout || '') + (doctorRun.stderr || '');
  check(
    'orchestra-review.js --doctor does not crash with "require is not defined"',
    !/ReferenceError: require is not defined/.test(doctorAll),
    'status=' + doctorRun.status + '\n' + doctorAll
  );

  // Idempotency + drift repair: a plain re-run over unmodified content is
  // silent; content someone else changed is overwritten with exactly ONE
  // notice line (not the notice PLUS a separate "stamped" line — that line is
  // for first creation only).
  const again = install(target, ['--packs', 'codex']);
  check(
    'a plain re-run over unmodified content prints no stamp notice',
    again.status === 0 && !/\.claude\/hooks\/package\.json (stamped|existed with different content)/.test(again.stdout || ''),
    (again.stdout || '').slice(-800)
  );
  fs.writeFileSync(scoping, '{"type":"module"}\n', 'utf8');
  const repaired = install(target, ['--packs', 'codex']);
  const repairedOut = repaired.stdout || '';
  check(
    'content changed out-of-band is overwritten, with a notice',
    repaired.status === 0 &&
      fs.readFileSync(scoping, 'utf8') === '{"type":"commonjs"}\n' &&
      /existed with different content — overwritten/.test(repairedOut),
    repairedOut.slice(-1000)
  );
  check(
    'the drift repair logs exactly ONE line, not the notice plus a separate "stamped" line',
    (repairedOut.match(/\.claude\/hooks\/package\.json (stamped|existed with different content)/g) || []).length === 1,
    repairedOut.slice(-1000)
  );

  // A CRLF-mangled copy of the SAME JSON (e.g. a core.autocrlf=true
  // re-checkout from before package.json also carried eol=lf) parses
  // identically to Node — it must be left alone, silently, not "repaired"
  // into a false-alarm notice on every single future run.
  fs.writeFileSync(scoping, '{"type":"commonjs"}\r\n', 'utf8');
  const crlfRun = install(target, ['--packs', 'codex']);
  check(
    'a CRLF-mangled but byte-equivalent stamp triggers no notice and is not rewritten',
    crlfRun.status === 0 &&
      !/\.claude\/hooks\/package\.json (stamped|existed with different content)/.test(crlfRun.stdout || '') &&
      // still \r\n, byte for byte: a rewrite (even to the "correct" LF form)
      // would prove the comparison is NOT treating this as unchanged.
      fs.readFileSync(scoping, 'utf8') === '{"type":"commonjs"}\r\n',
    (crlfRun.stdout || '').slice(-800) + '\ncontent now: ' + JSON.stringify(fs.readFileSync(scoping, 'utf8'))
  );
  // Restore the canonical LF stamp so the uninstall check below is unaffected.
  fs.writeFileSync(scoping, '{"type":"commonjs"}\n', 'utf8');

  // --uninstall removes the scoping file along with the other hook files.
  const u = install(target, ['--uninstall']);
  check(
    'uninstall removes .claude/hooks/package.json',
    u.status === 0 && !fs.existsSync(scoping),
    'status=' + u.status + ', exists=' + fs.existsSync(scoping)
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

try {
  case1();
  case2();
  case3();
  case4();
  case5();
  case6();
  case7();
} catch (e) {
  check('the suite ran to completion', false, (e && e.stack) || e);
}
finish();
