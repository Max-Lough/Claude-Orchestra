'use strict';

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var ROOT = path.join(__dirname, '..');
var LOCK = path.join(ROOT, '.build.lock');
var OUT = path.join(ROOT, 'out');
var DEADLINE_MS = 5000;

function stage2() {
  var stage1 = JSON.parse(fs.readFileSync(path.join(OUT, 'stage1.json'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'stage2.json'),
    JSON.stringify({ ok: true, from: stage1.rows }, null, 2) + '\n');
  console.log('pipeline complete');
}

function main() {
  // Start from a clean slate.
  if (fs.existsSync(LOCK)) fs.unlinkSync(LOCK);
  fs.rmSync(OUT, { recursive: true, force: true });

  // Stake the lock, then hand stage 1 to the background worker. From here the
  // worker owns the lock; its release is the signal that stage 1 is durable.
  fs.writeFileSync(LOCK, 'staked by pipeline ' + process.pid);

  var child = spawn(process.execPath, [path.join(__dirname, 'worker.js')], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  console.log('stage 1 handed to the background worker (pid ' + child.pid + ')');

  var deadline = Date.now() + DEADLINE_MS;
  (function poll() {
    if (!fs.existsSync(LOCK)) return stage2();
    if (Date.now() > deadline) {
      console.error('stage 2 aborted: build lock still held (' + path.basename(LOCK) + ')');
      process.exit(1);
    }
    setTimeout(poll, 100);
  })();
}

main();
