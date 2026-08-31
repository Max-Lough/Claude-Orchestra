'use strict';

// normalizePath(p) returns a POSIX-style normalized path.
//
// - Backslashes are treated as separators and rewritten to '/'.
// - Empty segments ('//') and '.' segments are dropped.
// - '..' pops the previous segment when there is one to pop.
// - On an absolute path (one that starts with a separator) a '..' that would
//   escape the root is dropped; on a relative path it is preserved.
// - A trailing separator is removed. An absolute path always keeps its
//   leading '/'. A relative path that normalizes to nothing becomes '.'.
function normalizePath(p) {
  if (typeof p !== 'string') throw new TypeError('path must be a string');

  var isAbsolute = /^[\\/]/.test(p);
  var parts = p.replace(/\\/g, '/').split('/');
  var out = [];

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else if (!isAbsolute) {
        out.push('..');
      }
      continue;
    }
    out.push(part);
  }

  var joined = out.join('/');
  if (isAbsolute) return '/' + joined;
  return joined === '' ? '.' : joined;
}

module.exports = { normalizePath: normalizePath };
