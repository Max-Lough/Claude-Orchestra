'use strict';

var fs = require('fs');

var SECTION = /^\[([^\]]+)\]$/;

// Minimal INI reader. Lines are taken exactly as they come off the file and
// only values are trimmed, so that key names and section names keep the
// spelling the exporter gave them.
function parseIni(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');

  var root = {};
  var current = root;

  text.split(/\r?\n/).forEach(function (line) {
    if (line === '' || line.charAt(0) === ';' || line.charAt(0) === '#') return;

    var section = SECTION.exec(line);
    if (section) {
      var name = section[1];
      if (!root[name] || typeof root[name] !== 'object') root[name] = {};
      current = root[name];
      return;
    }

    var eq = line.indexOf('=');
    if (eq === -1) return;
    var key = line.slice(0, eq);
    if (key === '') return;
    current[key] = line.slice(eq + 1).trim();
  });

  return root;
}

function readIni(file) {
  return parseIni(fs.readFileSync(file, 'utf8'));
}

module.exports = { parseIni: parseIni, readIni: readIni };
