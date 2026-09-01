# e-09 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

`scripts/index-files.js` builds each entry's key with `path.join`:

```js
var relPath = rel === '' ? entry.name : path.join(rel, entry.name);
```

`path.join` uses the **platform** separator, so on Windows the generated
`index.json` contains

```json
{ "path": "docs\\a.md", "bytes": 31 },
{ "path": "docs\\b.md", "bytes": 27 },
{ "path": "notes\\x.md", "bytes": 24 },
{ "path": "top.md", "bytes": 22 }
```

while `test.js` (and every other consumer of the index) asks for the
POSIX-shaped, content-relative key `docs/a.md`. `src/lookup.js` compares exactly,
so nested keys never match. `top.md` has no separator in it, which is why the
top-level case passes and the count is right — nothing is missing from the
index, only mis-keyed. On Linux `path.sep` is `/` and the same code happens to
produce the contracted keys, which is why the maintainer never saw it.

## Minimal fix (in scope: `scripts/index-files.js` only)

Normalize the separator when the key is built (or when it is written):

```js
var relPath = rel === '' ? entry.name : rel + '/' + entry.name;
```

or keep `path.join` and normalize:

```js
var relPath = (rel === '' ? entry.name : path.join(rel, entry.name))
  .split(path.sep).join('/');
```

`path.posix.join(rel, entry.name)` is equally acceptable. Any variant that emits
`/`-separated keys on every platform resolves the task.

What is **not** acceptable: loosening the comparison in `src/lookup.js`,
relaxing `test.js`, or hand-editing `index.json` — all out of scope and all
explicitly forbidden.

## Expected end state

```
node scripts/index-files.js -> exit 0, "indexed 4 files"
node test.js                -> exit 0, "# 4 cases, 0 failed"
```

Scope audit: `scripts/index-files.js` modified; `index.json` ignored as
generated output.

## Platform note

This task is red **on Windows only**; on a POSIX host the broken fixture already
passes because `path.sep` is `/` there. That is inherent to the protocol's
"path/encoding fault on Windows" category. The trial harness runs on Windows
(validated on Windows 11, Node v22.22.3); if a run is ever hosted on Linux this
task must be recorded as UNAVAILABLE, not as resolved.
