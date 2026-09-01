# session-store

Sessions are plain objects that carry a `Date`, a `Map` of tags, a `Set` of seen
ids and a nested counters object. `snapshot(session)` returns a deep, structural
copy: mutating the snapshot must never touch the original, and every value must
come back as the same kind of thing it went in as.

`src/compat.js` exists because the project still supports runtimes older than
the ones that ship `structuredClone`, and has to degrade on those.

```
node test.js
```
