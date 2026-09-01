# e-02 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

`build.js` streams roughly 1.2 MB into `dist/bundle.js` through an **asynchronous**
`fs.createWriteStream`, then calls `process.exit(0)` on the next line:

```js
var out = fs.createWriteStream(path.join(DIST, 'bundle.js'));
...
out.end();
console.log('built dist/bundle.js (' + ROWS + ' rows)');
process.exit(0);
```

Everything about that write is asynchronous. `createWriteStream` schedules an
`fs.open`; `stream.write()` only queues bytes into an internal buffer; `end()`
only marks the stream finished. `process.exit(0)` runs in the same tick as all
of it and tears the process down before the event loop ever gets to do the I/O.

On this machine the observed result is that **the file is never created at all**
(`Error: Cannot find module './dist/bundle.js'`) — the `open` had not even
completed. `dist/` exists because `fs.mkdirSync` is synchronous. Under different
timing the open can land and some prefix of the ~1.2 MB payload can flush, in
which case the file is present but truncated mid-line and `verify.js` dies with
a `SyntaxError` at a shifting line number instead. Both shapes are the same
defect: the build reports success because *queuing* a write and *completing* one
are different events and it never waits for the second.

The trailing `module.exports = ...` line never survives in either case, so even
a mostly-written bundle exports nothing.

## Minimal fix (in scope: `build.js` only)

Either wait for the flush before exiting:

```js
out.end();
out.on('finish', function () {
  console.log('built dist/bundle.js (' + ROWS + ' rows)');
});
```

(dropping the `process.exit(0)` entirely — the process exits on its own once the
stream closes), or build the text in memory and write it synchronously:

```js
fs.writeFileSync(path.join(DIST, 'bundle.js'), parts.join(''));
```

Any variant that guarantees every byte reaches disk before the process exits is
acceptable — including keeping `process.exit(0)` inside the `finish` handler.
What is **not** acceptable: reducing the row count so the payload fits in one
buffer (`verify.js` asserts 20000 rows and the order forbids it), or writing
`dist/` by hand.

## Expected end state

```
node build.js   -> exit 0, "built dist/bundle.js (20000 rows)"
node verify.js  -> exit 0, "verify ok"
```

repeatably, from a clean `dist/`. Scope audit: only `build.js` modified.
