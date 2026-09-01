'use strict';

var assert = require('assert');
var summarize = require('./src/summarize.js').summarize;

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

var ROWS = [
  { kind: 'read', n: 3 },
  { kind: 'write', n: 4 },
  { kind: 'read', n: 5 }
];

test('an empty input summarizes to zero', function () {
  assert.deepStrictEqual(summarize([]), { count: 0, total: 0, byKind: {} });
});

test('rows are counted and totalled', function () {
  var s = summarize(ROWS);
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.total, 12);
});

test('totals are grouped by kind', function () {
  assert.deepStrictEqual(summarize(ROWS).byKind, { read: 8, write: 4 });
});

test('a non-array input is rejected', function () {
  assert.throws(function () { summarize('rows'); }, TypeError);
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
