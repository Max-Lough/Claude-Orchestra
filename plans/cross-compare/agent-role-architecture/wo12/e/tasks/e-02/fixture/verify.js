'use strict';

var assert = require('assert');
var bundle = require('./dist/bundle.js');

assert.strictEqual(bundle.TABLE.length, 20000, 'expected exactly 20000 rows');
assert.ok(bundle.lookup('svc-0'), 'expected an entry for svc-0');
assert.strictEqual(bundle.TABLE[19999].id, 19999, 'last row id is wrong');
assert.strictEqual(bundle.lookup('nope-1'), null, 'lookup should return null for a miss');

console.log('verify ok');
