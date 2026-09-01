'use strict';

// WO-12a hidden acceptance test for order a-06 (stringifyIni).

var assert = require('assert');
var api = require('./index.js');
var ini = require('./src/ini.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('stringifyIni is exported from both index.js and src/ini.js', function () {
  assert.strictEqual(typeof api.stringifyIni, 'function');
  assert.strictEqual(typeof ini.stringifyIni, 'function');
});

test('an empty object renders as the empty string', function () {
  assert.strictEqual(api.stringifyIni({}), '');
});

test('top-level scalars render in insertion order with a trailing newline', function () {
  assert.strictEqual(api.stringifyIni({ a: '1' }), 'a=1\n');
  assert.strictEqual(api.stringifyIni({ a: 1, b: true, c: false }), 'a=1\nb=true\nc=false\n');
  assert.strictEqual(api.stringifyIni({ b: '2', a: '1' }), 'b=2\na=1\n');
});

test('a lone section has no leading blank line', function () {
  assert.strictEqual(api.stringifyIni({ server: { host: 'h' } }), '[server]\nhost=h\n');
});

test('sections follow all top-level scalars, each after a blank line', function () {
  var out = api.stringifyIni({
    top: '1',
    server: { host: 'h', port: 8080 },
    flags: { debug: false }
  });
  assert.strictEqual(out, 'top=1\n\n[server]\nhost=h\nport=8080\n\n[flags]\ndebug=false\n');
});

test('scalars are hoisted above sections regardless of key order', function () {
  var out = api.stringifyIni({ server: { host: 'h' }, top: '1' });
  assert.strictEqual(out, 'top=1\n\n[server]\nhost=h\n');
});

test('an empty section renders as a bare header', function () {
  assert.strictEqual(api.stringifyIni({ empty: {} }), '[empty]\n');
  assert.strictEqual(api.stringifyIni({ a: '1', empty: {} }), 'a=1\n\n[empty]\n');
});

test('parseIni round-trips stringifyIni output', function () {
  var objects = [
    { a: '1' },
    { top: '1', server: { host: 'example.test', port: '8080' }, flags: { debug: 'true' } },
    { only: { x: 'y', z: '' } }
  ];
  objects.forEach(function (obj) {
    assert.deepStrictEqual(api.parseIni(api.stringifyIni(obj)), obj);
  });
  assert.deepStrictEqual(
    api.parseIni(api.stringifyIni({ n: 42, s: { flag: true } })),
    { n: '42', s: { flag: 'true' } }
  );
});

test('invalid input throws TypeError with the declared messages', function () {
  function expect(fn, message) {
    assert.throws(fn, function (err) {
      assert.ok(err instanceof TypeError, 'expected TypeError, got ' + err);
      assert.strictEqual(err.message, message);
      return true;
    });
  }
  expect(function () { api.stringifyIni(null); }, 'obj must be a plain object');
  expect(function () { api.stringifyIni([]); }, 'obj must be a plain object');
  expect(function () { api.stringifyIni('x'); }, 'obj must be a plain object');
  expect(function () { api.stringifyIni(42); }, 'obj must be a plain object');
  expect(function () { api.stringifyIni(undefined); }, 'obj must be a plain object');
  expect(function () { api.stringifyIni({ s: { t: { deep: '1' } } }); }, 'nested sections are not supported');
  expect(function () { api.stringifyIni({ s: { t: ['a'] } }); }, 'nested sections are not supported');
  expect(function () { api.stringifyIni({ a: null }); }, 'unsupported value for key: a');
  expect(function () { api.stringifyIni({ a: undefined }); }, 'unsupported value for key: a');
  expect(function () { api.stringifyIni({ a: [1] }); }, 'unsupported value for key: a');
  expect(function () { api.stringifyIni({ s: { t: null } }); }, 'unsupported value for key: t');
});

test('baseline behavior is intact', function () {
  assert.deepStrictEqual(
    api.parseIni('; c\ntop=1\n[server]\nhost = example.test\n'),
    { top: '1', server: { host: 'example.test' } }
  );
  assert.throws(function () { api.parseIni(5); }, TypeError);
  assert.strictEqual(api.compareVersions('1.2.3', '1.2.3'), 0);
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
console.log('# a-06: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
