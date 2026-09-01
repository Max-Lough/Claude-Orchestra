'use strict';

var fs = require('fs');
var path = require('path');

// A tiny disk-backed cache. It re-stats its directory on a timer so that files
// written by a parallel job are noticed while the cache is open.
class DiskCache {
  constructor(dir, refreshMs) {
    this.dir = dir;
    this.entries = new Map();
    this.refreshes = 0;
    this._timer = setInterval(this.refresh.bind(this), refreshMs || 500);
  }

  refresh() {
    this.refreshes++;
    var self = this;
    fs.readdirSync(this.dir).forEach(function (name) {
      var full = path.join(self.dir, name);
      var stat = fs.statSync(full);
      if (stat.isFile()) self.entries.set(name, stat.size);
    });
    return this.entries.size;
  }

  get(name) {
    return this.entries.get(name);
  }

  get size() {
    return this.entries.size;
  }

  // Release everything this cache is holding.
  close() {
    this.entries.clear();
  }
}

module.exports = { DiskCache: DiskCache };
