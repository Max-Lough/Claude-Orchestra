'use strict';

// Deliberately conservative ES5 so the declared engines range stays honest.
function summarize(rows) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');

  var total = 0;
  var byKind = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var n = Number(row.n) || 0;
    total += n;
    if (!Object.prototype.hasOwnProperty.call(byKind, row.kind)) byKind[row.kind] = 0;
    byKind[row.kind] += n;
  }

  return { count: rows.length, total: total, byKind: byKind };
}

module.exports = { summarize: summarize };
