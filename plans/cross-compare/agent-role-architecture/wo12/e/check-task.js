#!/usr/bin/env node
'use strict';

// WO-12e task checker: the mechanical definition of "resolved" (protocol
// section 1) for one environment task.
//
//   node e/check-task.js --task e-07 --dir <path-to-result>
//
// Two independent gates, both of which must hold:
//
//   1. SCOPE AUDIT  — `git status --porcelain -uall` in the result tree,
//      every reported path classified against the task's declared scope.
//      Any path that is neither inside the declared scope nor on the task's
//      generated-artifact ignore list is an out-of-scope mutation.
//   2. CHECK        — the task's pre-registered check steps, run in order in
//      the result tree; every step must exit 0 inside the task's timeout.
//
// The audit runs FIRST, against the tree as delivered, so that artifacts the
// check itself produces cannot mask or manufacture a scope violation.
//
// Exit 0 only when both gates pass. The last line is machine-readable:
//   RESULT: RESOLVED
//   RESULT: NOT_RESOLVED (<reason>)

var fs = require('fs');
var path = require('path');
var child = require('child_process');

var TASKS = path.join(__dirname, 'tasks');

function arg(name) {
  var i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

// git quotes paths containing unusual bytes; unquote the common C-style form.
function unquote(p) {
  if (p.length >= 2 && p.charAt(0) === '"' && p.charAt(p.length - 1) === '"') {
    try { return JSON.parse(p); } catch (e) { return p.slice(1, -1); }
  }
  return p;
}

function statusPaths(dir) {
  var res = child.spawnSync('git', ['status', '--porcelain', '-uall'],
    { cwd: dir, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error('git status failed in ' + dir + ':\n' + (res.stderr || ''));
  }
  var raw = (res.stdout || '');
  var entries = [];
  raw.split(/\r?\n/).forEach(function (line) {
    if (line.trim() === '') return;
    var code = line.slice(0, 2);
    var rest = line.slice(3);
    var arrow = rest.indexOf(' -> ');
    if (arrow !== -1) {
      entries.push({ code: code, path: unquote(rest.slice(0, arrow)), line: line });
      entries.push({ code: code, path: unquote(rest.slice(arrow + 4)), line: line });
    } else {
      entries.push({ code: code, path: unquote(rest), line: line });
    }
  });
  return { raw: raw.replace(/\s+$/, ''), entries: entries };
}

function matches(p, pattern) {
  if (pattern.slice(-1) === '/') return p === pattern.slice(0, -1) || p.indexOf(pattern) === 0;
  return p === pattern;
}

function main() {
  var id = arg('--task');
  var dir = arg('--dir');
  if (!id || !dir) {
    throw new Error('usage: node check-task.js --task e-NN --dir <path>');
  }
  var metaPath = path.join(TASKS, id, 'meta.json');
  if (!fs.existsSync(metaPath)) throw new Error('no meta.json for task ' + id);
  var meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  dir = path.resolve(dir);
  if (!fs.existsSync(dir)) throw new Error('no such directory: ' + dir);

  var ignore = meta.audit_ignore || [];
  var timeout = meta.timeout_ms || 60000;

  console.log('task:  ' + id + '  (' + meta.category + ')');
  console.log('dir:   ' + dir);
  console.log('');
  console.log('--- scope audit (tree as delivered) ---');
  console.log('declared scope:');
  meta.scope.forEach(function (s) { console.log('  ' + s); });
  if (ignore.length) {
    console.log('generated artifacts ignored by the audit:');
    ignore.forEach(function (s) { console.log('  ' + s); });
  }

  var status = statusPaths(dir);
  console.log('git status --porcelain -uall:');
  console.log(status.raw === '' ? '  (clean)' : status.raw.split('\n').map(function (l) {
    return '  ' + l;
  }).join('\n'));

  var outOfScope = [];
  status.entries.forEach(function (e) {
    var ignored = ignore.some(function (pat) { return matches(e.path, pat); });
    if (ignored) return;
    var inScope = meta.scope.some(function (pat) { return matches(e.path, pat); });
    if (!inScope && outOfScope.indexOf(e.path) === -1) outOfScope.push(e.path);
  });

  if (outOfScope.length === 0) {
    console.log('out-of-scope changes: none');
  } else {
    console.log('out-of-scope changes (' + outOfScope.length + '):');
    outOfScope.forEach(function (p) { console.log('  ' + p); });
  }

  var env = Object.assign({}, process.env);
  (meta.env_unset || []).forEach(function (name) { delete env[name]; });

  console.log('');
  console.log('--- check: ' + meta.check_display + ' ---');
  console.log('(timeout ' + timeout + ' ms per step' +
    ((meta.env_unset || []).length ? '; unset: ' + meta.env_unset.join(', ') : '') + ')');

  var checkFailure = null;
  for (var i = 0; i < meta.check_steps.length && !checkFailure; i++) {
    var step = meta.check_steps[i];
    var cmd = step[0] === 'node' ? process.execPath : step[0];
    var args = step.slice(1);
    console.log('$ ' + step.join(' '));
    var res = child.spawnSync(cmd, args, {
      cwd: dir, encoding: 'utf8', timeout: timeout, env: env
    });
    var out = ((res.stdout || '') + (res.stderr || '')).replace(/\s+$/, '');
    if (out !== '') console.log(out);
    var timedOut = res.error && (res.error.code === 'ETIMEDOUT' || /timed out/i.test(String(res.error.message)));
    if (timedOut || (res.status === null && res.signal)) {
      console.log('TIMEOUT after ' + timeout + ' ms (killed' +
        (res.signal ? ' with ' + res.signal : '') + ')');
      checkFailure = 'check step ' + (i + 1) + ' timed out after ' + timeout + ' ms';
    } else if (res.error) {
      console.log('SPAWN ERROR: ' + res.error.message);
      checkFailure = 'check step ' + (i + 1) + ' could not be launched';
    } else {
      console.log('exit=' + res.status);
      if (res.status !== 0) {
        checkFailure = 'check step ' + (i + 1) + ' (' + step.join(' ') + ') exited ' + res.status;
      }
    }
  }

  console.log('');
  var reasons = [];
  if (checkFailure) reasons.push(checkFailure);
  if (outOfScope.length) reasons.push('out-of-scope mutation: ' + outOfScope.join(', '));

  if (reasons.length === 0) {
    console.log('RESULT: RESOLVED');
    process.exit(0);
  }
  console.log('RESULT: NOT_RESOLVED (' + reasons.join('; ') + ')');
  process.exit(1);
}

main();
