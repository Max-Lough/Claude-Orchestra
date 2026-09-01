'use strict';

// The project's own suite. Zero dependencies, plain node:assert.
// `node test.js` exits 0 when every case passes, 1 otherwise.

var assert = require('assert');
var api = require('./index.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('parseDuration reads a single unit', function () {
  assert.strictEqual(api.parseDuration('500ms'), 500);
  assert.strictEqual(api.parseDuration('90s'), 90000);
  assert.strictEqual(api.parseDuration('2d'), 172800000);
});

test('parseDuration reads descending compound units', function () {
  assert.strictEqual(api.parseDuration('1h30m'), 5400000);
  assert.strictEqual(api.parseDuration('1d1h1m1s1ms'), 90061001);
});

test('parseDuration rejects malformed input', function () {
  assert.strictEqual(api.parseDuration(''), null);
  assert.strictEqual(api.parseDuration('30m1h'), null);
  assert.strictEqual(api.parseDuration('1h1h'), null);
  assert.strictEqual(api.parseDuration('1 h'), null);
  assert.strictEqual(api.parseDuration('-1h'), null);
  assert.strictEqual(api.parseDuration('1.5h'), null);
  assert.strictEqual(api.parseDuration('1y'), null);
  assert.strictEqual(api.parseDuration(90), null);
});

test('formatTable pads columns and trims line ends', function () {
  var out = api.formatTable([['name', 'size'], ['a', '1'], ['bbbb', '22']]);
  assert.strictEqual(out, 'name  size\na     1\nbbbb  22');
});

test('formatTable pads short rows and renders empty input as empty', function () {
  assert.strictEqual(api.formatTable([]), '');
  assert.strictEqual(api.formatTable([['a', 'b'], ['c']]), 'a  b\nc');
});

test('normalizePath collapses separators and dot segments', function () {
  assert.strictEqual(api.normalizePath('a//b/./c/'), 'a/b/c');
  assert.strictEqual(api.normalizePath('a\\b\\c'), 'a/b/c');
  assert.strictEqual(api.normalizePath('/a/b/../c'), '/a/c');
  assert.strictEqual(api.normalizePath('/../a'), '/a');
  assert.strictEqual(api.normalizePath('../a/../b'), '../b');
  assert.strictEqual(api.normalizePath(''), '.');
  assert.strictEqual(api.normalizePath('/'), '/');
});

test('LRUCache evicts the least recently used entry', function () {
  var c = new api.LRUCache(2);
  c.set('a', 1).set('b', 2);
  assert.strictEqual(c.get('a'), 1);
  c.set('c', 3);
  assert.strictEqual(c.get('b'), undefined);
  assert.strictEqual(c.get('a'), 1);
  assert.strictEqual(c.get('c'), 3);
  assert.strictEqual(c.size, 2);
});

test('LRUCache rejects a bad capacity', function () {
  assert.throws(function () { return new api.LRUCache(0); }, TypeError);
});

test('compareVersions orders strict semver triples', function () {
  assert.strictEqual(api.compareVersions('1.2.3', '1.2.4'), -1);
  assert.strictEqual(api.compareVersions('1.10.0', '1.9.9'), 1);
  assert.strictEqual(api.compareVersions('2.0.0', '2.0.0'), 0);
  assert.throws(function () { api.compareVersions('1.2', '1.2.3'); }, TypeError);
});

test('parseIni reads sections, pairs and comments', function () {
  var text = [
    '; a comment',
    'top=1',
    '',
    '[server]',
    'host = example.test',
    'port=8080',
    '# another comment',
    '[flags]',
    'debug=true'
  ].join('\n');
  assert.deepStrictEqual(api.parseIni(text), {
    top: '1',
    server: { host: 'example.test', port: '8080' },
    flags: { debug: 'true' }
  });
});

var failed = 0;
cases.forEach(function (entry, i) {
  var name = entry[0];
  try {
    entry[1]();
    console.log('ok ' + (i + 1) + ' - ' + name);
  } catch (err) {
    failed++;
    console.log('not ok ' + (i + 1) + ' - ' + name);
    console.log('  ' + (err && err.message ? err.message : String(err)));
  }
});
console.log('# ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
