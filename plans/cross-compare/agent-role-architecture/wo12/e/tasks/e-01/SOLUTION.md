# e-01 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.** It is not copied into
the fixture by `init-task.js` and must not be pasted into a prompt.

## Cause

`build.js` decides concatenation order with

```js
var files = fs.readdirSync(SRC)
  .filter(function (f) { return f.slice(-3) === '.js'; })
  .sort();
```

which yields `aggregate.js, report.js, strings.js` — alphabetical order. But
`src/aggregate.js` evaluates `CLI.upper(...)` **at load time** to build
`CLI.HEADER`, and `CLI.upper` is defined by `src/strings.js`. Concatenated
alphabetically, `aggregate.js` runs before `strings.js` exists, so the bundle
throws `TypeError: CLI.upper is not a function` the moment `verify.js` requires
it. The build itself never evaluates the bundle, so it exits 0 and looks fine.

The correct order is recorded in `src/build-order.json`, which `build.js`
ignores entirely:

```json
{ "comment": "Concatenation order for build.js. A module may use symbols from any module listed before it, including at load time.",
  "order": ["strings.js", "aggregate.js", "report.js"] }
```

## Minimal fix (in scope: `build.js` only)

Replace the `readdirSync().sort()` order with the manifest's `order` array:

```js
var manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'build-order.json'), 'utf8'));
var files = manifest.order;
```

Anything equivalent is acceptable — e.g. reading the manifest and validating
that every listed file exists and that no `.js` file in `src/` is missing from
the list. What is **not** acceptable: renaming files in `src/` to make the
alphabetical sort come out right (out of scope), or hand-writing `dist/`.

## Expected end state

```
node build.js   -> exit 0, "built dist/bundle.js from 3 modules"
node verify.js  -> exit 0, "verify ok"
```

Scope audit: only `build.js` modified; `dist/` ignored as generated output.
