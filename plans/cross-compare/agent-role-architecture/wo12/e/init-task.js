#!/usr/bin/env node
'use strict';

// WO-12e task initializer.
//
//   node e/init-task.js --task e-07 [--dest <path>]
//
// Copies e/tasks/<id>/fixture/ to a throwaway directory, makes it a git
// repository with a single `baseline` commit, and prints the directory path on
// stdout as the last line. Progress goes to stderr.
//
// The task's `task.md` is NOT copied into the working tree: it is the order,
// handed to the arm by the trial driver. `SOLUTION.md` and `meta.json` are
// scorer-only and are never copied anywhere.

var fs = require('fs');
var os = require('os');
var path = require('path');
var child = require('child_process');

var TASKS = path.join(__dirname, 'tasks');

function arg(name) {
  var i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

function git(cwd, args) {
  var res = child.spawnSync('git', args, { cwd: cwd, encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error('git ' + args.join(' ') + ' failed (' + res.status + '):\n' + (res.stderr || ''));
  }
  return (res.stdout || '').trim();
}

function main() {
  var id = arg('--task');
  if (!id) throw new Error('usage: node init-task.js --task e-NN [--dest <path>]');
  var src = path.join(TASKS, id, 'fixture');
  if (!fs.existsSync(src)) throw new Error('no fixture for task ' + id + ' at ' + src);

  var dest = arg('--dest');
  if (!dest) dest = fs.mkdtempSync(path.join(os.tmpdir(), 'wo12e-' + id + '-'));
  else fs.mkdirSync(dest, { recursive: true });
  dest = path.resolve(dest);

  fs.cpSync(src, dest, { recursive: true });

  git(dest, ['init', '-q', '-b', 'main']);
  // The corpus stores fixture bytes verbatim (one task deliberately carries a
  // UTF-8 BOM); no end-of-line rewriting may happen on the way in or out.
  git(dest, ['config', 'core.autocrlf', 'false']);
  // Neutralize any global ignore file, so a user-level `node_modules` rule
  // cannot hide a vendored package or an out-of-scope mutation from the audit.
  var emptyExcludes = path.join(dest, '.git', 'empty-excludes');
  fs.writeFileSync(emptyExcludes, '');
  git(dest, ['config', 'core.excludesFile', emptyExcludes]);
  git(dest, ['config', 'user.name', 'WO-12 trial fixture']);
  git(dest, ['config', 'user.email', 'wo12@localhost']);
  git(dest, ['add', '-A', '-f']);
  git(dest, ['commit', '-q', '-m', 'baseline']);

  process.stderr.write(id + ' baseline commit ' + git(dest, ['rev-parse', '--short', 'HEAD']) + '\n');
  process.stdout.write(dest + '\n');
}

main();
