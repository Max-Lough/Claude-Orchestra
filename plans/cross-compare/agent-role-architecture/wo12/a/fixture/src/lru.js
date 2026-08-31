'use strict';

// A minimal least-recently-used cache built on Map insertion order.
// The first key in the Map is always the least recently used one.
class LRUCache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new TypeError('capacity must be a positive integer');
    }
    this.capacity = capacity;
    this._map = new Map();
  }

  get size() {
    return this._map.size;
  }

  // Returns the value and promotes the key to most-recently-used.
  // Returns undefined when the key is absent (and promotes nothing).
  get(key) {
    if (!this._map.has(key)) return undefined;
    var value = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  // Inserts or updates, promoting the key to most-recently-used, then
  // evicts least-recently-used entries until size <= capacity.
  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    this._map.set(key, value);
    while (this._map.size > this.capacity) {
      this._map.delete(this._map.keys().next().value);
    }
    return this;
  }
}

module.exports = { LRUCache: LRUCache };
