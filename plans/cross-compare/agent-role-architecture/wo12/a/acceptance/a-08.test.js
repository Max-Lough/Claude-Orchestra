'use strict';

// WO-12a hidden acceptance test for order a-08 (parseArgs).

var assert = require('assert');
var api = require('./index.js');
var args = require('./src/args.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

// Compare without depending on the prototype the implementation chose.
function shape(result) {
  assert.ok(result && typeof result === 'object', 'parseArgs must return an object');
  assert.ok(Array.isArray(result.positionals), 'positionals must be an array');
  assert.ok(result.flags && typeof result.flags === 'object', 'flags must be an object');
  return { flags: Object.assign({}, result.flags), positionals: result.positionals.slice() };
}

test('parseArgs is exported from both index.js and src/args.js', function () {
  assert.strictEqual(typeof api.parseArgs, 'function');
  assert.strictEqual(typeof args.parseArgs, 'function');
});

test('an empty argv gives empty results', function () {
  assert.deepStrictEqual(shape(api.parseArgs([])), { flags: {}, positionals: [] });
});

test('long flags without a value are true', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['--verbose'])),
    { flags: { verbose: true }, positionals: [] });
  assert.deepStrictEqual(shape(api.parseArgs(['--dry-run', '--v2'])),
    { flags: { 'dry-run': true, v2: true }, positionals: [] });
});

test('long flags with = take the string value', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['--out=dist'])),
    { flags: { out: 'dist' }, positionals: [] });
  assert.deepStrictEqual(shape(api.parseArgs(['--out='])),
    { flags: { out: '' }, positionals: [] });
  assert.deepStrictEqual(shape(api.parseArgs(['--expr=a=b=c'])),
    { flags: { expr: 'a=b=c' }, positionals: [] });
});

test('--no- prefixed flags are false', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['--no-cache'])),
    { flags: { cache: false }, positionals: [] });
});

test('the = form outranks the --no- form', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['--no-cache=1'])),
    { flags: { 'no-cache': '1' }, positionals: [] });
});

test('short clusters set each letter true', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['-abc'])),
    { flags: { a: true, b: true, c: true }, positionals: [] });
  assert.deepStrictEqual(shape(api.parseArgs(['-v'])),
    { flags: { v: true }, positionals: [] });
});

test('the last occurrence of a flag wins', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['--x', '--x=2'])),
    { flags: { x: '2' }, positionals: [] });
  assert.deepStrictEqual(shape(api.parseArgs(['--x=2', '--no-x'])),
    { flags: { x: false }, positionals: [] });
});

test('a bare -- ends flag parsing and is not kept', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['a', '--flag', '--', '--x', '-b', 'z'])),
    { flags: { flag: true }, positionals: ['a', '--x', '-b', 'z'] });
  assert.deepStrictEqual(shape(api.parseArgs(['--', '--'])),
    { flags: {}, positionals: ['--'] });
});

test('tokens matching no flag form are positionals', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['build', '-', '---x', '-1', '--=v', 'src/a.js'])),
    { flags: {}, positionals: ['build', '-', '---x', '-1', '--=v', 'src/a.js'] });
});

test('flags and positionals interleave and keep positional order', function () {
  assert.deepStrictEqual(shape(api.parseArgs(['build', '--out=dist', 'src', '-qz', 'lib', '--no-cache'])),
    { flags: { out: 'dist', q: true, z: true, cache: false }, positionals: ['build', 'src', 'lib'] });
});

test('invalid input throws TypeError with the declared messages', function () {
  function expect(fn, message) {
    assert.throws(fn, function (err) {
      assert.ok(err instanceof TypeError, 'expected TypeError, got ' + err);
      assert.strictEqual(err.message, message);
      return true;
    });
  }
  expect(function () { api.parseArgs('a'); }, 'argv must be an array');
  expect(function () { api.parseArgs(null); }, 'argv must be an array');
  expect(function () { api.parseArgs(undefined); }, 'argv must be an array');
  expect(function () { api.parseArgs([1]); }, 'argv entries must be strings');
  expect(function () { api.parseArgs(['--a', null]); }, 'argv entries must be strings');
});

test('baseline behavior is intact', function () {
  assert.strictEqual(api.normalizePath('a\\b\\c'), 'a/b/c');
  assert.deepStrictEqual(api.parseIni('[s]\nk=v'), { s: { k: 'v' } });
  assert.strictEqual(api.parseDuration('1y'), null);
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
console.log('# a-08: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
