'use strict';

// formatTable(rows) renders a rectangular text table.
//
// - rows is an array of arrays; every cell is coerced with String().
// - Short rows are padded with empty cells to the width of the longest row.
// - Every column is padded on the right to the width of its widest cell.
// - Columns are joined with two spaces; rows are joined with '\n'.
// - Trailing whitespace is stripped from every rendered line.
// - An empty or non-array input renders ''.
function formatTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  var ncols = 0;
  rows.forEach(function (row) {
    if (!Array.isArray(row)) throw new TypeError('each row must be an array');
    if (row.length > ncols) ncols = row.length;
  });

  var widths = new Array(ncols).fill(0);
  var cells = rows.map(function (row) {
    var out = [];
    for (var i = 0; i < ncols; i++) {
      var s = i < row.length ? String(row[i]) : '';
      out.push(s);
      if (s.length > widths[i]) widths[i] = s.length;
    }
    return out;
  });

  return cells.map(function (row) {
    return row
      .map(function (s, i) { return s + ' '.repeat(widths[i] - s.length); })
      .join('  ')
      .replace(/\s+$/, '');
  }).join('\n');
}

module.exports = { formatTable: formatTable };
