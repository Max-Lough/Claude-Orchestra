'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var LOCK = path.join(ROOT, '.build.lock');
var OUT = path.join(ROOT, 'out');

function releaseLock() {
  try {
    fs.unlinkSync(LOCK);
  } catch (err) {
    // already released
  }
}

// Graceful shutdown: never leave the pipeline waiting on a lock we hold.
process.on('SIGTERM', function () { releaseLock(); process.exit(0); });
process.on('SIGINT', function () { releaseLock(); process.exit(0); });

// Take ownership of the lock the pipeline staked for us.
fs.writeFileSync(LOCK, 'held by worker ' + process.pid);

// Stage 1: the real work would read the source tree here.
setTimeout(function () {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'stage1.json'),
    JSON.stringify({ ok: true, rows: 42, pid: process.pid }, null, 2) + '\n');
}, 200);
