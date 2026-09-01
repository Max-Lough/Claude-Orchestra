'use strict';

var fs = require('fs');
var path = require('path');
var DiskCache = require('../src/cache.js').DiskCache;

var ROOT = path.join(__dirname, '..');
var CONTENT = path.join(ROOT, 'content');
var OUT = path.join(ROOT, 'out');

function main() {
  var cache = new DiskCache(CONTENT, 500);
  cache.refresh();

  var manifest = { count: cache.size, files: {} };
  fs.readdirSync(CONTENT).sort().forEach(function (name) {
    manifest.files[name] = cache.get(name);
  });

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n');

  cache.close();
  console.log('prepare complete: ' + manifest.count + ' files');
}

main();
