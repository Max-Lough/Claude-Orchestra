'use strict';

var assert = require('assert');
var gate = require('./src/gate.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('an issued token is accepted', function () {
  assert.strictEqual(gate.accept('alice'), 'alice');
  assert.strictEqual(gate.accept('bob'), 'bob');
});

test('a non-string subject is rejected', function () {
  assert.throws(function () { gate.accept(42); }, TypeError);
});

test('the issuer reports the token version it is wired to', function () {
  assert.strictEqual(require('@fx/issuer').tokenVersion, '2.0.0');
  assert.strictEqual(require('@fx/token').VERSION, '2.0.0');
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
