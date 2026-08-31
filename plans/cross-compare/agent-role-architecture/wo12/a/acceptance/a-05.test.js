'use strict';

// WO-12a hidden acceptance test for order a-05 (diff and maxVersion).

var assert = require('assert');
var api = require('./index.js');
var semver = require('./src/semver.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('diff and maxVersion are exported from index.js and src/semver.js', function () {
  ['diff', 'maxVersion'].forEach(function (name) {
    assert.strictEqual(typeof api[name], 'function', 'index.js is missing ' + name);
    assert.strictEqual(typeof semver[name], 'function', 'src/semver.js is missing ' + name);
  });
});

test('diff names the most significant differing component', function () {
  assert.strictEqual(api.diff('1.2.3', '2.0.0'), 'major');
  assert.strictEqual(api.diff('2.0.0', '1.9.9'), 'major');
  assert.strictEqual(api.diff('1.2.3', '1.3.0'), 'minor');
  assert.strictEqual(api.diff('1.10.0', '1.9.0'), 'minor');
  assert.strictEqual(api.diff('1.2.3', '1.2.4'), 'patch');
  assert.strictEqual(api.diff('1.2.10', '1.2.9'), 'patch');
});

test('diff is symmetric and returns null for equal versions', function () {
  assert.strictEqual(api.diff('1.2.3', '1.2.3'), null);
  assert.strictEqual(api.diff('0.0.0', '0.0.0'), null);
  assert.strictEqual(api.diff('1.2.3', '2.5.9'), api.diff('2.5.9', '1.2.3'));
  assert.strictEqual(api.diff('1.2.3', '1.5.3'), api.diff('1.5.3', '1.2.3'));
});

test('diff validates both arguments', function () {
  assert.throws(function () { api.diff('1.2', '1.2.3'); }, TypeError);
  assert.throws(function () { api.diff('1.2.3', 'v1.2.3'); }, TypeError);
  assert.throws(function () { api.diff('1.2.3', 3); }, TypeError);
});

test('maxVersion returns the greatest version', function () {
  assert.strictEqual(api.maxVersion(['1.2.3', '1.10.0', '1.9.9']), '1.10.0');
  assert.strictEqual(api.maxVersion(['0.0.1']), '0.0.1');
  assert.strictEqual(api.maxVersion(['2.0.0', '10.0.0', '9.99.99']), '10.0.0');
  assert.strictEqual(api.maxVersion(['1.0.0', '1.0.0']), '1.0.0');
});

test('maxVersion does not mutate its argument', function () {
  var list = ['1.2.3', '1.10.0', '0.9.0'];
  var copy = list.slice();
  assert.strictEqual(api.maxVersion(list), '1.10.0');
  assert.deepStrictEqual(list, copy);
});

test('maxVersion rejects bad input with the declared errors', function () {
  function expect(fn, ctor, message) {
    assert.throws(fn, function (err) {
      assert.ok(err instanceof ctor, 'expected ' + ctor.name + ', got ' + err);
      assert.strictEqual(err.message, message);
      return true;
    });
  }
  expect(function () { api.maxVersion('1.2.3'); }, TypeError, 'versions must be an array');
  expect(function () { api.maxVersion(null); }, TypeError, 'versions must be an array');
  expect(function () { api.maxVersion([]); }, RangeError, 'versions must not be empty');
  assert.throws(function () { api.maxVersion(['1.2.3', 'oops']); }, TypeError);
});

test('baseline behavior is intact', function () {
  assert.strictEqual(api.compareVersions('1.2.3', '1.2.4'), -1);
  assert.strictEqual(api.compareVersions('2.0.0', '2.0.0'), 0);
  assert.throws(function () { api.compareVersions('1.2', '1.2.3'); }, TypeError);
  assert.deepStrictEqual(semver.parseVersion('1.2.3'), [1, 2, 3]);
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
console.log('# a-05: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
