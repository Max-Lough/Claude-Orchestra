'use strict';

var STRICT = /^(\d+)\.(\d+)\.(\d+)$/;

// parseVersion('1.2.3') === [1, 2, 3]. Only strict MAJOR.MINOR.PATCH with
// decimal digits is accepted; no leading 'v', no prerelease, no build
// metadata. Anything else throws a TypeError.
function parseVersion(version) {
  if (typeof version !== 'string') throw new TypeError('version must be a string');
  var m = STRICT.exec(version);
  if (!m) throw new TypeError('invalid version: ' + version);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Returns -1 when a < b, 0 when equal, 1 when a > b.
function compareVersions(a, b) {
  var pa = parseVersion(a);
  var pb = parseVersion(b);
  for (var i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

module.exports = { parseVersion: parseVersion, compareVersions: compareVersions };
