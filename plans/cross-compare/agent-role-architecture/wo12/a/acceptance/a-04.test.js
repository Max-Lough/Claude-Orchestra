'use strict';

// WO-12a hidden acceptance test for order a-04 (LRUCache inspection API).

var assert = require('assert');
var api = require('./index.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

function seeded() {
  var c = new api.LRUCache(3);
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  return c;
}

test('the four methods exist on the prototype', function () {
  var proto = api.LRUCache.prototype;
  ['peek', 'has', 'delete', 'keys'].forEach(function (name) {
    assert.strictEqual(typeof proto[name], 'function', 'missing method: ' + name);
  });
});

test('keys() lists least-recently-used first', function () {
  assert.deepStrictEqual(seeded().keys(), ['a', 'b', 'c']);
});

test('keys() returns a fresh array each call', function () {
  var c = seeded();
  var first = c.keys();
  var second = c.keys();
  assert.deepStrictEqual(first, second);
  assert.notStrictEqual(first, second);
  first.push('zzz');
  assert.deepStrictEqual(c.keys(), ['a', 'b', 'c']);
});

test('peek returns the value without promoting', function () {
  var c = seeded();
  assert.strictEqual(c.peek('a'), 1);
  assert.deepStrictEqual(c.keys(), ['a', 'b', 'c']);
  assert.strictEqual(c.peek('missing'), undefined);
  assert.deepStrictEqual(c.keys(), ['a', 'b', 'c']);
  assert.strictEqual(c.size, 3);
});

test('has reports membership without promoting', function () {
  var c = seeded();
  assert.strictEqual(c.has('a'), true);
  assert.strictEqual(c.has('zzz'), false);
  assert.deepStrictEqual(c.keys(), ['a', 'b', 'c']);
});

test('get still promotes', function () {
  var c = seeded();
  assert.strictEqual(c.get('a'), 1);
  assert.deepStrictEqual(c.keys(), ['b', 'c', 'a']);
});

test('delete removes and reports whether it removed', function () {
  var c = seeded();
  assert.strictEqual(c.delete('b'), true);
  assert.strictEqual(c.delete('b'), false);
  assert.strictEqual(c.delete('zzz'), false);
  assert.strictEqual(c.size, 2);
  assert.strictEqual(c.has('b'), false);
  assert.deepStrictEqual(c.keys(), ['a', 'c']);
});

test('eviction still drops the least recently used key', function () {
  var c = seeded();
  assert.strictEqual(c.get('a'), 1);
  c.set('d', 4);
  assert.deepStrictEqual(c.keys(), ['c', 'a', 'd']);
  c.set('e', 5);
  assert.deepStrictEqual(c.keys(), ['a', 'd', 'e']);
  assert.strictEqual(c.has('b'), false);
  assert.strictEqual(c.has('c'), false);
  assert.strictEqual(c.size, 3);
});

test('peek and has do not resurrect evicted keys', function () {
  var c = new api.LRUCache(1);
  c.set('a', 1);
  c.set('b', 2);
  assert.strictEqual(c.peek('a'), undefined);
  assert.strictEqual(c.has('a'), false);
  assert.deepStrictEqual(c.keys(), ['b']);
});

test('baseline behavior is intact', function () {
  assert.throws(function () { return new api.LRUCache(0); }, TypeError);
  assert.strictEqual(new api.LRUCache(2).get('nope'), undefined);
  assert.strictEqual(api.parseDuration('500ms'), 500);
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
console.log('# a-04: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
