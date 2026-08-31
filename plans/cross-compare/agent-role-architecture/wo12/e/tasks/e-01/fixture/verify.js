'use strict';

var assert = require('assert');
var CLI = require('./dist/bundle.js');

var rows = [{ name: 'alpha', n: 3 }, { name: 'beta', n: 4 }];

var expected = [
  'NAME|COUNT',
  'alpha |3',
  'beta  |4',
  'total |7'
].join('\n');

assert.strictEqual(CLI.render(rows), expected, 'rendered report does not match');
assert.strictEqual(CLI.total(rows), 7, 'total is wrong');
assert.strictEqual(CLI.pad('x', 3), 'x  ', 'pad is wrong');

console.log('verify ok');
