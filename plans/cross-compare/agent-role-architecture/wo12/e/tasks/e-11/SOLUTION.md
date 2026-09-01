# e-11 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

`DiskCache`'s constructor starts a repeating refresh timer:

```js
this._timer = setInterval(this.refresh.bind(this), refreshMs || 500);
```

and `close()` clears the entry map but never clears that timer:

```js
close() {
  this.entries.clear();
}
```

An active `setInterval` handle is a **ref'd** libuv handle: it keeps the event
loop alive indefinitely. `scripts/prepare.js` finishes all its work, calls
`cache.close()`, prints its line and returns from `main()` — and the process
still has a live timer, so Node never exits. Nothing is wrong with the output;
the process is simply never allowed to run out of work.

The diagnostic an arm should reach for is `process.getActiveResourcesInfo()`
(shows a `Timeout`), `why-is-node-running`-style reasoning, or simply reading
`close()`.

## Minimal fix (in scope: `src/cache.js` only)

Release the handle in `close()`:

```js
close() {
  clearInterval(this._timer);
  this._timer = null;
  this.entries.clear();
}
```

Also acceptable: `this._timer.unref()` in the constructor, which lets the
process exit while leaving the timer running for as long as anything else keeps
the loop alive. Both satisfy the order's constraint that an open cache still
refreshes. Combining the two is fine.

What is **not** acceptable: calling `process.exit()` anywhere (explicitly
forbidden — it would mask the leak rather than fix it), deleting the timer
entirely, or editing `scripts/prepare.js`.

## Expected end state

```
node scripts/prepare.js -> exit 0, "prepare complete: 3 files", returns promptly
node test.js            -> exit 0, "# 3 cases, 0 failed"
```

Scope audit: `src/cache.js` modified; `out/` ignored as generated output.

## Note for the scorer

On the broken fixture, `check-task.js` reports
`TIMEOUT after 30000 ms` on check step 1 and
`RESULT: NOT_RESOLVED (check step 1 timed out after 30000 ms)`. That is the
expected red signal for this task — not an infrastructure fault.
