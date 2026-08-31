'use strict';

// WO-12a hidden acceptance test for order a-07 (wrapText).

var assert = require('assert');
var api = require('./index.js');
var wrap = require('./src/wrap.js');

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('wrapText is exported from both index.js and src/wrap.js', function () {
  assert.strictEqual(typeof api.wrapText, 'function');
  assert.strictEqual(typeof wrap.wrapText, 'function');
});

test('empty and whitespace-only text give an empty array', function () {
  assert.deepStrictEqual(api.wrapText('', 5), []);
  assert.deepStrictEqual(api.wrapText('   ', 5), []);
  assert.deepStrictEqual(api.wrapText('\t\n  \r\n ', 5), []);
});

test('text shorter than the width stays on one line', function () {
  assert.deepStrictEqual(api.wrapText('a b c', 5), ['a b c']);
  assert.deepStrictEqual(api.wrapText('x', 1), ['x']);
});

test('greedy packing breaks at the last word that fits', function () {
  assert.deepStrictEqual(api.wrapText('a b c', 3), ['a b', 'c']);
  assert.deepStrictEqual(api.wrapText('the quick brown fox', 10), ['the quick', 'brown fox']);
  assert.deepStrictEqual(api.wrapText('aa bb cc dd', 5), ['aa bb', 'cc dd']);
});

test('runs of whitespace are collapsed and the text is trimmed', function () {
  assert.deepStrictEqual(api.wrapText('  one   two\nthree\t four  ', 20), ['one two three four']);
  assert.deepStrictEqual(api.wrapText('a\n\nb', 3), ['a b']);
});

test('words longer than the width are hard-split before packing', function () {
  assert.deepStrictEqual(api.wrapText('abcdefgh', 3), ['abc', 'def', 'gh']);
  assert.deepStrictEqual(api.wrapText('aaaa bb', 3), ['aaa', 'a', 'bb']);
  assert.deepStrictEqual(api.wrapText('xx abcdef yy', 2), ['xx', 'ab', 'cd', 'ef', 'yy']);
  assert.deepStrictEqual(api.wrapText('abcdefgh', 8), ['abcdefgh']);
});

test('no returned line exceeds the width or carries edge whitespace', function () {
  var text = 'alpha beta gammagammagamma delta epsilon zeta eta theta';
  [1, 2, 3, 5, 7, 11, 26, 40].forEach(function (width) {
    api.wrapText(text, width).forEach(function (line) {
      assert.ok(line.length <= width, 'line too long at width ' + width + ': ' + JSON.stringify(line));
      assert.ok(line.length > 0, 'empty line at width ' + width);
      assert.strictEqual(line, line.trim(), 'edge whitespace at width ' + width + ': ' + JSON.stringify(line));
    });
  });
});

test('joining the lines with a single space restores the normalized text', function () {
  // Every word here is at most 5 characters, so no hard split can occur at
  // these widths and the join must reproduce the input exactly.
  var text = 'the quick brown fox jumps over the lazy dog';
  [5, 9, 12, 20].forEach(function (width) {
    assert.strictEqual(api.wrapText(text, width).join(' '), text, 'width ' + width);
  });
});

test('invalid input throws TypeError with the declared messages', function () {
  function expect(fn, message) {
    assert.throws(fn, function (err) {
      assert.ok(err instanceof TypeError, 'expected TypeError, got ' + err);
      assert.strictEqual(err.message, message);
      return true;
    });
  }
  expect(function () { api.wrapText(5, 3); }, 'text must be a string');
  expect(function () { api.wrapText(null, 3); }, 'text must be a string');
  expect(function () { api.wrapText('a', 0); }, 'width must be a positive integer');
  expect(function () { api.wrapText('a', -2); }, 'width must be a positive integer');
  expect(function () { api.wrapText('a', 1.5); }, 'width must be a positive integer');
  expect(function () { api.wrapText('a', '3'); }, 'width must be a positive integer');
  expect(function () { api.wrapText('a', NaN); }, 'width must be a positive integer');
  expect(function () { api.wrapText('a', Infinity); }, 'width must be a positive integer');
});

test('baseline behavior is intact', function () {
  assert.strictEqual(api.parseDuration('1d1h1m1s1ms'), 90061001);
  assert.strictEqual(api.formatTable([['name', 'size'], ['a', '1'], ['bbbb', '22']]),
    'name  size\na     1\nbbbb  22');
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
console.log('# a-07: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
