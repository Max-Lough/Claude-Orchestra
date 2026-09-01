# e-07 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

`node_modules/@fx/format/package.json` declares an `exports` map with an
`"import"` condition and nothing else:

```json
"exports": {
  ".": { "import": "./esm/index.mjs" },
  "./package.json": "./package.json"
}
```

An `exports` field is an exhaustive allow-list: once it is present, `main` and
direct file paths stop being consulted, and any request that matches no
condition is refused. A CommonJS `require('@fx/format')` resolves with the
conditions `["node", "require"]`, matches neither `import` nor a `default`, and
Node raises `ERR_PACKAGE_PATH_NOT_EXPORTED`. The CommonJS build at
`lib/index.js` exists and is perfectly good — it is simply not reachable through
the map. `require('@fx/format/package.json')` keeps working because that subpath
*is* listed, which is why the version probe in the symptom succeeds.

## Minimal fix (in scope: `node_modules/@fx/format/package.json` only)

Add the missing condition:

```json
"exports": {
  ".": {
    "import": "./esm/index.mjs",
    "require": "./lib/index.js"
  },
  "./package.json": "./package.json"
}
```

Order matters to readers but not to resolution; `"default": "./lib/index.js"`
in place of `"require"` also works and is acceptable. Adding a top-level
`"main": "./lib/index.js"` **alone** is *not* a fix — `exports` still shadows it
— and an arm that does only that will still see the check fail.

Deleting the `exports` field entirely and relying on `main` would also make the
check pass, but it breaks the ESM entry point the order requires to stay
reachable; treat it as a defect for the reviewer even though the check is green.

## Expected end state

```
node test.js -> exit 0, "# 4 cases, 0 failed"
```

Scope audit: `node_modules/@fx/format/package.json` modified, nothing else.
