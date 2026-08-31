# content-index

`scripts/index-files.js` walks `content/` and writes `index.json`: one entry per
file, holding the file's **content-relative key** and its size in bytes.

`src/lookup.js` resolves a key to its entry with an exact match, and lists the
keys under a directory. Consumers of `index.json` across the fleet use the same
key shape, so the index must be identical whatever machine generated it.

```
node scripts/index-files.js && node test.js
```

`index.json` is generated and is not tracked.
