'use strict';

var fmt = require('@fx/format');

function total(invoice) {
  return invoice.items.reduce(function (sum, item) { return sum + item.cents; }, 0);
}

function renderInvoice(invoice) {
  var lines = ['INVOICE ' + invoice.id];
  invoice.items.forEach(function (item) {
    lines.push(item.name + ': ' + fmt.money(item.cents, invoice.currency));
  });
  lines.push('tax: ' + fmt.pct(invoice.taxRate));
  lines.push('total: ' + fmt.money(total(invoice), invoice.currency));
  return lines.join('\n');
}

module.exports = { renderInvoice: renderInvoice, total: total };
