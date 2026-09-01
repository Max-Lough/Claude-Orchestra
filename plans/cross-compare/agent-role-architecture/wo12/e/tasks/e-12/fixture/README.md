# two-stage-build

Stage 1 runs in a detached background worker so the launcher can return to the
scheduler immediately. Stage 2 must not start until stage 1's output is durable.

The handshake is a lock file:

1. `scripts/pipeline.js` stakes `.build.lock` and spawns `scripts/worker.js`
   detached.
2. From that moment the worker **owns** the lock. Releasing it is how the worker
   announces that its stage is finished.
3. The pipeline polls for the lock to disappear, up to a five-second deadline,
   and then runs stage 2.

```
node scripts/pipeline.js && node test.js
```

`out/` and `.build.lock` are runtime artifacts and are not tracked.
