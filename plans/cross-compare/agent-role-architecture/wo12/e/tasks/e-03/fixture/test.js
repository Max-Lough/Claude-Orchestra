'use strict';

var assert = require('assert');
var v = require('./src/validate.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('a record missing a required field is reported', function () {
  assert.deepStrictEqual(v.missingFields({ id: '1', email: 'a@b.test' }), ['region']);
});

test('an empty required field counts as missing', function () {
  assert.deepStrictEqual(
    v.missingFields({ id: '1', email: 'a@b.test', region: '' }), ['region']);
});

test('a complete record has nothing missing', function () {
  assert.deepStrictEqual(
    v.missingFields({ id: '1', email: 'a@b.test', region: 'emea' }), []);
  assert.strictEqual(v.isValid({ id: '1', email: 'a@b.test', region: 'emea' }), true);
});

test('an incomplete record is invalid', function () {
  assert.strictEqual(v.isValid({ id: '1', email: 'a@b.test' }), false);
});

test('optional fields are never reported', function () {
  assert.deepStrictEqual(
    v.missingFields({ id: '1', email: 'a@b.test', region: 'emea', nickname: '' }), []);
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
