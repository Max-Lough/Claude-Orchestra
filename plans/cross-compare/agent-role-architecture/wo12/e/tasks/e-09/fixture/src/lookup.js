'use strict';

// Keys are exact. An index that is keyed differently is a broken index, not a
// lookup problem, so nothing here normalizes its input.
function get(index, key) {
  if (!index || !Array.isArray(index.files)) {
    throw new TypeError('index must have a files array');
  }
  for (var i = 0; i < index.files.length; i++) {
    if (index.files[i].path === key) return index.files[i];
  }
  return undefined;
}

function children(index, dirKey) {
  var prefix = dirKey === '' ? '' : dirKey + '/';
  return index.files
    .filter(function (f) { return f.path.indexOf(prefix) === 0; })
    .map(function (f) { return f.path; });
}

module.exports = { get: get, children: children };
