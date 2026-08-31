'use strict';

var fs = require('fs');
var path = require('path');

var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

var required = String(pkg.engines.node).replace(/^[^0-9]*/, '');
var current = process.version.replace(/^v/, '');

// Put the declared minimum and the running version in order, then make sure
// the running one comes last.
var ordered = [required, current].sort();

if (ordered[ordered.length - 1] !== current) {
  console.error('legacy-toolkit requires Node ' + required + ' or newer; found v' + current);
  process.exit(1);
}

console.log('preflight ok: node v' + current + ' satisfies ' + pkg.engines.node);
