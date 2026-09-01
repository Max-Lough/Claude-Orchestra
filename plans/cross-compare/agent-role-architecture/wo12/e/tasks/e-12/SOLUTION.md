# e-12 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

`scripts/worker.js` releases the build lock **only from its signal handlers**:

```js
process.on('SIGTERM', function () { releaseLock(); process.exit(0); });
process.on('SIGINT', function () { releaseLock(); process.exit(0); });
```

Nothing ever signals it. The pipeline spawns the worker `detached` and
`unref()`s it, then waits passively for the lock to disappear; the worker
finishes its stage-1 write, runs out of work and exits **normally**, which is
the one exit path with no `releaseLock()` on it. `.build.lock` therefore
outlives the process that owned it, the pipeline's five-second deadline expires,
and stage 2 is aborted — while `out/stage1.json` sits on disk, complete, which
is exactly the confusing shape the symptom describes. It is a classic
cleanup-only-on-shutdown-signal defect: the graceful path was written, the
normal path was not.

## Minimal fix (in scope: `scripts/worker.js` only)

Release the lock when the work completes, after the output is durable:

```js
setTimeout(function () {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'stage1.json'),
    JSON.stringify({ ok: true, rows: 42, pid: process.pid }, null, 2) + '\n');
  releaseLock();          // <-- added: normal completion releases too
}, 200);
```

`process.on('exit', function () { releaseLock(); })` is also acceptable —
`fs.unlinkSync` is synchronous and therefore safe inside an `exit` handler. An
asynchronous release (`fs.unlink` with a callback, `fs.promises.unlink`) inside
an `exit` handler is **not** a correct fix: the event loop is already shut down
and the operation may or may not land. If an arm does that and the check happens
to pass, note it as a latent defect for the reviewer.

The signal handlers stay: they are correct for their own case.

What is **not** acceptable: releasing the lock before `out/stage1.json` is
written (forbidden by the order, and it races stage 2 into an ENOENT), editing
`scripts/pipeline.js`, or having the pipeline break the lock itself.

## Expected end state

```
node scripts/pipeline.js -> exit 0
  stage 1 handed to the background worker (pid NNNNN)
  pipeline complete
node test.js             -> exit 0, "# 4 cases, 0 failed"
```

Scope audit: `scripts/worker.js` modified; `out/` and `.build.lock` ignored as
runtime artifacts.
