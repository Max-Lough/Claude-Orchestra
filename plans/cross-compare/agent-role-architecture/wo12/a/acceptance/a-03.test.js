'use strict';

// WO-12a hidden acceptance test for order a-03 (relativePath).

var assert = require('assert');
var api = require('./index.js');
var pathnorm = require('./src/pathnorm.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('relativePath is exported from both index.js and src/pathnorm.js', function () {
  assert.strictEqual(typeof api.relativePath, 'function');
  assert.strictEqual(typeof pathnorm.relativePath, 'function');
});

test('identical paths give a single dot', function () {
  assert.strictEqual(api.relativePath('/a/b/c', '/a/b/c'), '.');
  assert.strictEqual(api.relativePath('/', '/'), '.');
});

test('descending gives the remaining segments', function () {
  assert.strictEqual(api.relativePath('/a/b', '/a/b/c/d'), 'c/d');
  assert.strictEqual(api.relativePath('/', '/a/b'), 'a/b');
});

test('ascending gives dot-dot segments', function () {
  assert.strictEqual(api.relativePath('/a/b/c', '/a/b'), '..');
  assert.strictEqual(api.relativePath('/a/b', '/'), '../..');
});

test('divergent paths combine ascent and descent', function () {
  assert.strictEqual(api.relativePath('/a/b/c', '/a/d'), '../../d');
  assert.strictEqual(api.relativePath('/x/y', '/p/q'), '../../p/q');
});

test('both arguments are normalized first', function () {
  assert.strictEqual(api.relativePath('/a//b/./c/', '/a/x'), '../../x');
  assert.strictEqual(api.relativePath('\\a\\b', '/a/c'), '../c');
  assert.strictEqual(api.relativePath('/a/b/../b', '/a/b/z'), 'z');
  assert.strictEqual(api.relativePath('/../a', '/a/b'), 'b');
});

test('a shared prefix is only stripped on whole segments', function () {
  assert.strictEqual(api.relativePath('/ab', '/abc'), '../abc');
});

test('invalid input throws TypeError with the declared messages', function () {
  function expect(fn, message) {
    assert.throws(fn, function (err) {
      assert.ok(err instanceof TypeError, 'expected TypeError, got ' + err);
      assert.strictEqual(err.message, message);
      return true;
    });
  }
  expect(function () { api.relativePath(1, '/a'); }, 'paths must be strings');
  expect(function () { api.relativePath('/a', null); }, 'paths must be strings');
  expect(function () { api.relativePath('a/b', '/a'); }, 'paths must be absolute');
  expect(function () { api.relativePath('/a', 'b'); }, 'paths must be absolute');
  expect(function () { api.relativePath('', '/a'); }, 'paths must be absolute');
});

test('baseline behavior is intact', function () {
  assert.strictEqual(api.normalizePath('/a/b/../c'), '/a/c');
  assert.strictEqual(api.normalizePath(''), '.');
  assert.strictEqual(api.normalizePath('/'), '/');
  assert.throws(function () { api.normalizePath(5); }, TypeError);
  assert.strictEqual(api.parseDuration('2d'), 172800000);
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
console.log('# a-03: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
