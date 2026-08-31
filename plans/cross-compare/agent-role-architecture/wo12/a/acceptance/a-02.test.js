'use strict';

// WO-12a hidden acceptance test for order a-02 (formatTable options).

var assert = require('assert');
var api = require('./index.js');

var ROWS = [['id', 'name'], ['1', 'alpha'], ['22', 'b']];

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('default rendering is unchanged', function () {
  var expected = 'id  name\n1   alpha\n22  b';
  assert.strictEqual(api.formatTable(ROWS), expected);
  assert.strictEqual(api.formatTable(ROWS, undefined), expected);
  assert.strictEqual(api.formatTable(ROWS, null), expected);
  assert.strictEqual(api.formatTable(ROWS, {}), expected);
  assert.strictEqual(api.formatTable([]), '');
  assert.strictEqual(api.formatTable([], { separator: ' | ' }), '');
});

test('a custom separator is used between columns', function () {
  assert.strictEqual(
    api.formatTable(ROWS, { separator: ' | ' }),
    'id | name\n1  | alpha\n22 | b'
  );
  assert.strictEqual(
    api.formatTable(ROWS, { separator: '' }),
    'idname\n1 alpha\n22b'
  );
});

test('right alignment pads on the left', function () {
  assert.strictEqual(
    api.formatTable(ROWS, { align: ['right', 'right'] }),
    'id   name\n 1  alpha\n22      b'
  );
});

test('missing align entries default to left', function () {
  assert.strictEqual(
    api.formatTable(ROWS, { align: ['right'] }),
    'id  name\n 1  alpha\n22  b'
  );
  assert.strictEqual(
    api.formatTable(ROWS, { align: [] }),
    'id  name\n1   alpha\n22  b'
  );
  assert.strictEqual(
    api.formatTable(ROWS, { align: [undefined, 'right'] }),
    'id   name\n1   alpha\n22      b'
  );
});

test('align and separator combine', function () {
  assert.strictEqual(
    api.formatTable(ROWS, { align: ['right', 'right'], separator: '|' }),
    'id| name\n 1|alpha\n22|    b'
  );
});

test('trailing whitespace is still stripped from every line', function () {
  var out = api.formatTable([['aa', 'bb'], ['c', '']], { align: ['left', 'left'] });
  assert.strictEqual(out, 'aa  bb\nc');
  out.split('\n').forEach(function (line) {
    assert.strictEqual(line, line.replace(/\s+$/, ''), 'line has trailing whitespace: ' + JSON.stringify(line));
  });
});

test('short rows are still padded to the widest row', function () {
  assert.strictEqual(
    api.formatTable([['a', 'b'], ['c']], { align: ['right'] }),
    'a  b\nc');
});

test('invalid options throw TypeError with the declared messages', function () {
  function expect(fn, message) {
    assert.throws(fn, function (err) {
      assert.ok(err instanceof TypeError, 'expected TypeError, got ' + err);
      assert.strictEqual(err.message, message);
      return true;
    });
  }
  expect(function () { api.formatTable(ROWS, 'left'); }, 'options must be an object');
  expect(function () { api.formatTable(ROWS, 7); }, 'options must be an object');
  expect(function () { api.formatTable(ROWS, { separator: 3 }); }, 'separator must be a string');
  expect(function () { api.formatTable(ROWS, { align: 'right' }); }, 'align must be an array');
  expect(function () { api.formatTable(ROWS, { align: ['center'] }); }, 'invalid alignment: center');
  expect(function () { api.formatTable(ROWS, { align: [null] }); }, 'invalid alignment: null');
});

test('baseline behavior is intact', function () {
  assert.strictEqual(api.parseDuration('1h30m'), 5400000);
  assert.strictEqual(api.normalizePath('a//b/./c/'), 'a/b/c');
  assert.strictEqual(api.compareVersions('1.10.0', '1.9.9'), 1);
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
console.log('# a-02: ' + cases.length + ' cases, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
