'use strict';

// Unit table, strictly descending by magnitude. Index order is the only
// order a duration string may use.
var UNITS = [
  { name: 'd', ms: 86400000 },
  { name: 'h', ms: 3600000 },
  { name: 'm', ms: 60000 },
  { name: 's', ms: 1000 },
  { name: 'ms', ms: 1 }
];

var SHAPE = /^(?:\d+(?:ms|[dhms]))+$/;
var TOKEN = /(\d+)(ms|d|h|m|s)/g;

function unitIndex(name) {
  for (var i = 0; i < UNITS.length; i++) {
    if (UNITS[i].name === name) return i;
  }
  return -1;
}

// parseDuration('1h30m') === 5400000. Returns null for anything malformed:
// non-strings, the empty string, signs, whitespace, non-integer counts, an
// unknown unit, a repeated unit, or units out of strictly descending order.
function parseDuration(input) {
  if (typeof input !== 'string') return null;
  if (input.length === 0) return null;
  if (!SHAPE.test(input)) return null;

  var total = 0;
  var last = -1;
  var consumed = 0;
  var m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(input)) !== null) {
    var idx = unitIndex(m[2]);
    if (idx <= last) return null;
    last = idx;
    total += Number(m[1]) * UNITS[idx].ms;
    consumed += m[0].length;
  }
  if (consumed !== input.length) return null;
  return total;
}

module.exports = { parseDuration: parseDuration, UNITS: UNITS };
