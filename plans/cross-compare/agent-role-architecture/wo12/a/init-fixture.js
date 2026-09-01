#!/usr/bin/env node
'use strict';

// WO-12a fixture initializer.
//
//   node a/init-fixture.js [--dest <path>]
//
// Copies a/fixture/ (minus INIT.md) to a throwaway directory, makes it a git
// repository with a single `baseline` commit, and prints the directory path
// on stdout as the last line. Everything else it says goes to stderr, so the
// caller can read the path with a plain tail of stdout.

var fs = require('fs');
var os = require('os');
var path = require('path');
var child = require('child_process');

var SRC = path.join(__dirname, 'fixture');

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
  if (!fs.existsSync(SRC)) throw new Error('fixture directory not found: ' + SRC);

  var dest = arg('--dest');
  if (!dest) dest = fs.mkdtempSync(path.join(os.tmpdir(), 'wo12a-'));
  else fs.mkdirSync(dest, { recursive: true });
  dest = path.resolve(dest);

  fs.cpSync(SRC, dest, {
    recursive: true,
    filter: function (src) { return path.basename(src) !== 'INIT.md'; }
  });

  git(dest, ['init', '-q', '-b', 'main']);
  git(dest, ['config', 'core.autocrlf', 'false']);
  // Neutralize any global ignore file so the tree audit sees every path.
  var emptyExcludes = path.join(dest, '.git', 'empty-excludes');
  fs.writeFileSync(emptyExcludes, '');
  git(dest, ['config', 'core.excludesFile', emptyExcludes]);
  git(dest, ['config', 'user.name', 'WO-12 trial fixture']);
  git(dest, ['config', 'user.email', 'wo12@localhost']);
  git(dest, ['add', '-A', '-f']);
  git(dest, ['commit', '-q', '-m', 'baseline']);

  process.stderr.write('baseline commit ' + git(dest, ['rev-parse', '--short', 'HEAD']) + '\n');
  process.stdout.write(dest + '\n');
}

main();
