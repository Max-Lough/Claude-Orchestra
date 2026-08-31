CLI.total = function (rows) {
  return rows.reduce(function (sum, row) { return sum + row.n; }, 0);
};

// Computed once, when the bundle loads, from the string helpers.
CLI.HEADER = CLI.upper('name') + '|' + CLI.upper('count');
