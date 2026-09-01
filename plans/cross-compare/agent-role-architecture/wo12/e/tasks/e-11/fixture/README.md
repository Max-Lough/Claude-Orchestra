# site-prepare

Stage one of the site pipeline: walk `content/`, record every file's size in
`out/manifest.json`, and hand off.

`src/cache.js` holds a small `DiskCache` that re-stats its directory on a timer,
so that files written by a parallel job are noticed while the cache is open.
`close()` is the release call: after it, the cache is holding nothing.

```
node scripts/prepare.js && node test.js
```

`out/` is generated and is not tracked.
