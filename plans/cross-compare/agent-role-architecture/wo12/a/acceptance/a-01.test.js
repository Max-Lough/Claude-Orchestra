'use strict';

// WO-12a hidden acceptance test for order a-01 (formatDuration).
// Copied to the delivered repository root as `a-01.test.js` and run with
// `node a-01.test.js`. Exit 0 = accepted on the mechanical check.

var assert = require('assert');
var api = require('./index.js');
var duration = require('./src/duration.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('formatDuration is exported from both index.js and src/duration.js', function () {
  assert.strictEqual(typeof api.formatDuration, 'function');
  assert.strictEqual(typeof duration.formatDuration, 'function');
});

test('zero renders as 0ms', function () {
  assert.strictEqual(api.formatDuration(0), '0ms');
});

test('single components render without a separator', function () {
  assert.strictEqual(api.formatDuration(1), '1ms');
  assert.strictEqual(api.formatDuration(1000), '1s');
  assert.strictEqual(api.formatDuration(60000), '1m');
  assert.strictEqual(api.formatDuration(3600000), '1h');
  assert.strictEqual(api.formatDuration(86400000), '1d');
});

test('compound values omit zero components', function () {
  assert.strictEqual(api.formatDuration(5400000), '1h30m');
  assert.strictEqual(api.formatDuration(90061001), '1d1h1m1s1ms');
  assert.strictEqual(api.formatDuration(172800001), '2d1ms');
  assert.strictEqual(api.formatDuration(90000), '1m30s');
  assert.strictEqual(api.formatDuration(3601000), '1h1s');
});

test('large counts stay on the largest unit', function () {
  assert.strictEqual(api.formatDuration(864000000), '10d');
  assert.strictEqual(api.formatDuration(999), '999ms');
});

test('formatDuration round-trips through parseDuration', function () {
  var values = [0, 1, 999, 1000, 1001, 60000, 90000, 3600000, 3601000, 5400000,
    86400000, 90061001, 172800001, 864000000, 123456789];
  values.forEach(function (ms) {
    var text = api.formatDuration(ms);
    assert.strictEqual(api.parseDuration(text), ms, 'round trip failed for ' + ms + ' -> ' + text);
  });
});

test('invalid input throws TypeError with the declared message', function () {
  var bad = [-1, 1.5, NaN, Infinity, '1000', null, undefined, {}, [], true];
  bad.forEach(function (value) {
    assert.throws(
      function () { api.formatDuration(value); },
      function (err) {
        assert.ok(err instanceof TypeError, 'expected TypeError for ' + String(value));
        assert.strictEqual(err.message, 'ms must be a non-negative integer');
        return true;
      },
      'expected a throw for ' + String(value)
    );
  });
});

test('baseline behavior is intact', function () {
  assert.strictEqual(api.parseDuration('1h30m'), 5400000);
  assert.strictEqual(api.parseDuration('30m1h'), null);
  assert.strictEqual(api.formatTable([['a', 'b'], ['c']]), 'a  b\nc');
  assert.strictEqual(api.normalizePath('/a/b/../c'), '/a/c');
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
console.log('# a-01: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
