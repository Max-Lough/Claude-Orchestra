# e-06 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

The capability probe in `src/compat.js` is inverted:

```js
var HAS_STRUCTURED_CLONE = typeof structuredClone === 'undefined';
```

The constant is named for the presence of `structuredClone` but is `true`
exactly when it is **absent**. On Node 17 and newer `structuredClone` is a
global, so the flag is `false` and `deepCopy` takes the fallback branch — a
`JSON.parse(JSON.stringify(...))` round trip, which serializes a `Date` to a
string and a `Map`/`Set` to `{}`. The suite therefore fails on every runtime the
project actually supports, and would have "passed" only on Node 16 or older,
where the flag is `true` and the code then calls a `structuredClone` that does
not exist. Both branches are wired to the wrong runtime.

## Minimal fix (in scope: `src/compat.js` only)

```js
var HAS_STRUCTURED_CLONE = typeof structuredClone === 'function';
```

(`!== 'undefined'` is equivalent and equally acceptable.) The fallback branch
stays for old runtimes; it is simply no longer the branch a modern Node takes.

An arm that instead replaces `deepCopy` with a hand-written structural clone
that preserves `Date`, `Map`, `Set` and nested objects also resolves the task —
the check is the criterion — but the one-line probe fix is the minimal repair.

What is **not** acceptable: flattening the session shape in `src/session.js`
(out of scope), or weakening `test.js`.

## Expected end state

```
node test.js -> exit 0, "# 5 cases, 0 failed"
```

Scope audit: `src/compat.js` modified, nothing else.
