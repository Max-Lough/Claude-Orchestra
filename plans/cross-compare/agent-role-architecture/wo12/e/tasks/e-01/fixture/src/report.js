CLI.render = function (rows) {
  var lines = [CLI.HEADER];
  rows.forEach(function (row) {
    lines.push(CLI.pad(row.name, 6) + '|' + row.n);
  });
  lines.push(CLI.pad('total', 6) + '|' + CLI.total(rows));
  return lines.join('\n');
};
