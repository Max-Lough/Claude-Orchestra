'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var CONTENT = path.join(ROOT, 'content');

function byName(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

function walk(dir, rel, out) {
  fs.readdirSync(dir, { withFileTypes: true }).sort(byName).forEach(function (entry) {
    var full = path.join(dir, entry.name);
    var relPath = rel === '' ? entry.name : path.join(rel, entry.name);
    if (entry.isDirectory()) {
      walk(full, relPath, out);
      return;
    }
    out.push({ path: relPath, bytes: fs.statSync(full).size });
  });
  return out;
}

function main() {
  var files = walk(CONTENT, '', []);
  var index = { generated: true, count: files.length, files: files };
  fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log('indexed ' + files.length + ' files');
}

main();
