'use strict';

// structuredClone became a global in Node 17. On anything older we degrade to
// a JSON round trip, which is lossy (Date, Map and Set do not survive) but is
// the best a runtime without structuredClone can do.
var HAS_STRUCTURED_CLONE = typeof structuredClone === 'undefined';

function deepCopy(value) {
  return HAS_STRUCTURED_CLONE
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

module.exports = {
  HAS_STRUCTURED_CLONE: HAS_STRUCTURED_CLONE,
  deepCopy: deepCopy
};
