'use strict';

var assert = require('assert');
var config = require('./src/config.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('the config loads', function () {
  assert.ok(config.load());
});

test('server settings are read', function () {
  var cfg = config.load();
  assert.strictEqual(cfg.server.host, '127.0.0.1');
  assert.strictEqual(cfg.server.port, '8080');
});

test('limits are read', function () {
  var cfg = config.load();
  assert.strictEqual(cfg.limits.max, '100');
});

test('settings do not leak to the top level', function () {
  var cfg = config.load();
  assert.strictEqual(cfg.host, undefined);
  assert.strictEqual(cfg.port, undefined);
  assert.strictEqual(cfg.nope, undefined);
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
