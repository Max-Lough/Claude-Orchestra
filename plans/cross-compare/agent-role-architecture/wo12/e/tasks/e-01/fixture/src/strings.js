CLI.pad = function (value, width) {
  var s = String(value);
  return s + ' '.repeat(Math.max(0, width - s.length));
};

CLI.upper = function (value) {
  return String(value).toUpperCase();
};
