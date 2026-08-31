'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var OUT = path.join(ROOT, 'out');
var LOCK = path.join(ROOT, '.build.lock');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('stage 1 produced its output', function () {
  assert.ok(fs.existsSync(path.join(OUT, 'stage1.json')),
    'expected out/stage1.json to exist');
  var stage1 = JSON.parse(fs.readFileSync(path.join(OUT, 'stage1.json'), 'utf8'));
  assert.strictEqual(stage1.ok, true);
  assert.strictEqual(stage1.rows, 42);
});

test('stage 2 ran and consumed stage 1', function () {
  assert.ok(fs.existsSync(path.join(OUT, 'stage2.json')),
    'expected out/stage2.json to exist');
  var stage2 = JSON.parse(fs.readFileSync(path.join(OUT, 'stage2.json'), 'utf8'));
  assert.strictEqual(stage2.ok, true);
  assert.strictEqual(stage2.from, 42);
});

test('the build lock was released', function () {
  assert.strictEqual(fs.existsSync(LOCK), false,
    '.build.lock is still present after the pipeline finished');
});

test('no stray output was left behind', function () {
  assert.deepStrictEqual(fs.readdirSync(OUT).sort(), ['stage1.json', 'stage2.json']);
});

var failed = 0;
cases.forEach(function (entry, i) {
  try {
    entry[1]();
    console.log('ok ' + (i + 1) + ' - ' + entry[0]);
  } catch (err) {
    failed++;
    console.log('not ok ' + (i + 1) + ' - ' + entry[0]);
    console.log('  ' + (err && err.message ? err.message : String(err)));
  }
});
console.log('# ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
