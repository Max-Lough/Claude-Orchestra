'use strict';

var assert = require('assert');
var escapeHtml = require('./src/sanitize.js').escapeHtml;

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('angle brackets are escaped', function () {
  assert.strictEqual(escapeHtml('<b>hi</b>'), '&lt;b&gt;hi&lt;/b&gt;');
});

test('ampersands are escaped', function () {
  assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
});

test('double quotes are escaped', function () {
  assert.strictEqual(escapeHtml('say "hi"'), 'say &quot;hi&quot;');
});

test('apostrophes are escaped', function () {
  assert.strictEqual(escapeHtml("it's fine"), 'it&#39;s fine');
});

test('an attribute payload is fully neutralised', function () {
  assert.strictEqual(
    escapeHtml('" onerror=\'boom\' & <img>'),
    '&quot; onerror=&#39;boom&#39; &amp; &lt;img&gt;');
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
