# WORK ORDER — Operator (E0) — WO-12e Task e-07

## SYMPTOM (what the operator was handed)

`invoice-render` cannot load its own vendored formatting package. The suite dies
before a single case runs:

```
$ node test.js
node:internal/modules/cjs/loader:...
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in
...\node_modules\@fx\format\package.json
    at ...
    at Object.<anonymous> (...\src\report.js:3:11)
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
```

The package is there. Its files are there. `node -e "console.log(require('@fx/format/package.json').version)"`
prints `1.4.0`. Diagnose it from the evidence by actually running the commands —
do not guess — and make `require('@fx/format')` work again.

**About this tree:** `@fx/format` is a **first-party package vendored in-tree**.
There is no registry and no network here; `node_modules/@fx/format/` is checked
in on purpose and is the only copy that exists. Editing it is the intended
repair path for this task, not a workaround.

## CHECK — the definition of done

```
node test.js
```

must exit 0 in this directory. Run it yourself and paste the output.

## SCOPE — the only path you may create, change or delete

- `node_modules/@fx/format/package.json`

Everything else in this tree is out of scope: a change to any other tracked path
fails the run even if the check passes.

## CONSTRAINTS — "do not", absolute

- **Do not** edit `src/report.js`. In particular, do not change its
  `require('@fx/format')` to a deep path such as `@fx/format/lib/index.js` — the
  package must be loadable by its own name.
- **Do not** edit `test.js`, and do not weaken any of its assertions.
- **Do not** move, rename, copy or delete any file under
  `node_modules/@fx/format/` other than the one in-scope file. Both the
  CommonJS build and the ESM build must remain reachable afterwards.
- **Do not** run `npm install`, `npm ci`, or reach the network. There is no
  registry to reach.
- **Do not** run `git commit`, `git push`, or any other git command.
- **Do not** touch any path outside this directory.

## BUDGET

20 minutes wall clock, one attempt.

## REPORT CONTRACT

State the verbatim error you observed, the root cause in one or two sentences,
the exact change you made to the in-scope file, and the verbatim output of the
check command. If you cannot reach a working end state, say so plainly
(BLOCKED).
