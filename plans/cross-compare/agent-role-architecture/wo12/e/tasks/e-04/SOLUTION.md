# e-04 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

`src/sanitize.js` picks its escaping table from `config.MODE`, and
`src/config.js` reads that from the environment with a **wrong default**:

```js
var MODE = process.env.APP_MODE || 'legacy';
```

`APP_MODE` is not set when `node test.js` runs — the only thing that ever set it
was `scripts/dev.js`, which the test path does not go through — so the effective
mode is `legacy`, whose table covers `<` and `>` only. `docs/ENV.md` states that
`strict` is the supported configuration and that `legacy` exists solely for the
0.x compatibility shim, so the environment, not the tables, is what makes the
suite red.

`check-task.js` deletes `APP_MODE` from the environment before running the
check (`meta.json`: `"env_unset": ["APP_MODE"]`), so exporting the variable is
not a repair and cannot accidentally pass.

## Minimal fix (in scope: `src/config.js` only)

Make the supported profile the default, keeping the environment override:

```js
var MODE = process.env.APP_MODE || 'strict';
```

Equivalent acceptable variants: normalizing and validating the value, e.g.

```js
var MODE = process.env.APP_MODE === 'legacy' ? 'legacy' : 'strict';
```

What is **not** acceptable: hard-coding `MODE = 'strict'` with no way to select
`legacy` (violates the third constraint), editing `src/sanitize.js`, or setting
the variable in a shell or wrapper.

## Expected end state

```
node test.js -> exit 0, "# 5 cases, 0 failed"
```

Scope audit: `src/config.js` modified, nothing else.
