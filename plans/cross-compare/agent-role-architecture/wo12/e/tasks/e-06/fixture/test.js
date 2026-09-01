'use strict';

var assert = require('assert');
var session = require('./src/session.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

function pair() {
  var live = session.createSession('s1', new Date(0));
  return { live: live, snap: session.snapshot(live) };
}

test('the snapshot is a distinct object', function () {
  var p = pair();
  assert.notStrictEqual(p.snap, p.live);
  assert.strictEqual(p.snap.id, 's1');
});

test('the creation time survives as a Date', function () {
  var p = pair();
  assert.ok(p.snap.createdAt instanceof Date);
  assert.strictEqual(p.snap.createdAt.getTime(), 0);
});

test('tags survive as a Map', function () {
  var p = pair();
  assert.ok(p.snap.tags instanceof Map);
  assert.strictEqual(p.snap.tags.get('tier'), 'gold');
  assert.strictEqual(p.snap.tags.size, 2);
});

test('seen survives as a Set', function () {
  var p = pair();
  assert.ok(p.snap.seen instanceof Set);
  assert.strictEqual(p.snap.seen.has(2), true);
  assert.strictEqual(p.snap.seen.size, 3);
});

test('the snapshot is deep, not shared', function () {
  var p = pair();
  p.snap.counters.hits = 5;
  assert.strictEqual(p.live.counters.hits, 0);
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
