# 12a fixture -- initialization

This directory is stored as **plain files**, not as a git repository. A nested
`.git/` inside the Orchestra repository would break the outer repository's
working tree, so the baseline commit is created at trial time, in a throwaway
copy, instead of being committed here.

## What the trial driver does

Copy this directory (excluding this file) to a scratch location and create the
baseline commit there:

```
git init -q -b main
git config core.autocrlf false
git config user.name  "WO-12 trial fixture"
git config user.email "wo12@localhost"
git add -A -f
git commit -q -m baseline
```

`../init-fixture.js` performs exactly those steps and prints the path of the
prepared copy on stdout. Use it rather than doing this by hand:

```
node plans/cross-compare/agent-role-architecture/wo12/a/init-fixture.js
```

## Baseline invariant

In a fresh copy, before any order is executed:

```
node test.js      ->  exit code 0
```

`INIT.md` is corpus metadata and is **excluded** from the copy, so an executor
never sees it.
