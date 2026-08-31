'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var MANIFEST = path.join(__dirname, 'out', 'manifest.json');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('the prepare step wrote a manifest', function () {
  assert.ok(fs.existsSync(MANIFEST), 'expected out/manifest.json to exist');
});

test('every content file is in the manifest', function () {
  var manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  assert.strictEqual(manifest.count, 3);
  assert.deepStrictEqual(
    Object.keys(manifest.files).sort(),
    ['changelog.txt', 'guide.txt', 'intro.txt']);
});

test('every recorded size is a positive integer', function () {
  var manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  Object.keys(manifest.files).forEach(function (name) {
    var bytes = manifest.files[name];
    assert.ok(Number.isInteger(bytes) && bytes > 0, name + ' has a bad size: ' + bytes);
  });
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
