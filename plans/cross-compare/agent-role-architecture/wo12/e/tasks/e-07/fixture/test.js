'use strict';

var assert = require('assert');
var report = require('./src/report.js');

var INVOICE = {
  id: 'A-1',
  currency: 'EUR',
  taxRate: 0.195,
  items: [
    { name: 'widget', cents: 1250 },
    { name: 'freight', cents: 399 }
  ]
};

var cases = [];
function test(name, fn) { cases.push([name, fn]); }

test('items are totalled in cents', function () {
  assert.strictEqual(report.total(INVOICE), 1649);
});

test('the invoice renders line by line', function () {
  assert.strictEqual(report.renderInvoice(INVOICE), [
    'INVOICE A-1',
    'widget: EUR 12.50',
    'freight: EUR 3.99',
    'tax: 19.5%',
    'total: EUR 16.49'
  ].join('\n'));
});

test('an empty invoice still renders', function () {
  assert.strictEqual(
    report.renderInvoice({ id: 'B-2', currency: 'USD', taxRate: 0, items: [] }),
    ['INVOICE B-2', 'tax: 0%', 'total: USD 0.00'].join('\n'));
});

test('the vendored package reports its version', function () {
  assert.strictEqual(require('@fx/format/package.json').version, '1.4.0');
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
