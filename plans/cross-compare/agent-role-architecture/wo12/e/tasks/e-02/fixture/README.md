# lookup-table

Generates `dist/bundle.js`, a static CommonJS module holding 20000 pre-computed
rows plus a linear `lookup(key)` helper, from the small vocabulary in
`src/entries.json`.

```
node build.js && node verify.js
```

`dist/` is generated and is not tracked. The generated module is deliberately
large: the table is meant to be loaded once at process start, not rebuilt.
