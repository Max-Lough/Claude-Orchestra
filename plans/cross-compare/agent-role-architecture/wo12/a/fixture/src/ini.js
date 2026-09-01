'use strict';

var SECTION = /^\[([^\]]+)\]$/;

// parseIni(text) returns a plain object.
//
// - Lines are split on '\n' or '\r\n' and trimmed.
// - Blank lines, and lines whose first character is ';' or '#', are ignored.
// - '[name]' opens a section; the trimmed name becomes an object-valued key
//   on the result, and following pairs land inside it. Reopening a section
//   name merges into the existing object.
// - 'key=value' assigns a string; key and value are trimmed; the first '='
//   is the separator, so values may contain '='.
// - Pairs before the first section land at the top level.
// - A line with no '=' and no section header is ignored. An empty key is
//   ignored.
function parseIni(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');

  var root = {};
  var current = root;

  text.split(/\r?\n/).forEach(function (rawLine) {
    var line = rawLine.trim();
    if (line === '' || line.charAt(0) === ';' || line.charAt(0) === '#') return;

    var section = SECTION.exec(line);
    if (section) {
      var name = section[1].trim();
      var existing = root[name];
      if (!existing || typeof existing !== 'object') root[name] = {};
      current = root[name];
      return;
    }

    var eq = line.indexOf('=');
    if (eq === -1) return;
    var key = line.slice(0, eq).trim();
    if (key === '') return;
    current[key] = line.slice(eq + 1).trim();
  });

  return root;
}

module.exports = { parseIni: parseIni };
