'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var lookup = require('./src/lookup.js');

var index = JSON.parse(fs.readFileSync(path.join(__dirname, 'index.json'), 'utf8'));

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('every content file is indexed', function () {
  assert.strictEqual(index.count, 4);
  assert.strictEqual(index.files.length, 4);
});

test('a top-level file is found by name', function () {
  assert.ok(lookup.get(index, 'top.md'), 'expected an entry for top.md');
});

test('a nested file is found by its content-relative key', function () {
  assert.ok(lookup.get(index, 'docs/a.md'), 'expected an entry for docs/a.md');
  assert.ok(lookup.get(index, 'docs/b.md'), 'expected an entry for docs/b.md');
  assert.ok(lookup.get(index, 'notes/x.md'), 'expected an entry for notes/x.md');
});

test('children lists the files in a directory', function () {
  assert.deepStrictEqual(lookup.children(index, 'docs'), ['docs/a.md', 'docs/b.md']);
  assert.deepStrictEqual(lookup.children(index, 'notes'), ['notes/x.md']);
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
