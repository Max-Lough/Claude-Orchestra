'use strict';

var compat = require('./compat.js');

function createSession(id, createdAt) {
  return {
    id: id,
    createdAt: createdAt,
    tags: new Map([['tier', 'gold'], ['region', 'emea']]),
    seen: new Set([1, 2, 3]),
    counters: { hits: 0 }
  };
}

// A deep, structural copy: the caller may mutate it freely.
function snapshot(session) {
  return compat.deepCopy(session);
}

module.exports = { createSession: createSession, snapshot: snapshot };
