# WORK ORDER — Operator (E0) — WO-12e Task e-04

## SYMPTOM (what the operator was handed)

The `escape-kit` suite is red in this checkout. Angle brackets are escaped, but
ampersands and quotes come back through untouched:

```
$ node test.js
ok 1 - angle brackets are escaped
not ok 2 - ampersands are escaped
  Expected values to be strictly equal:
+ actual - expected
+ 'a & b'
- 'a &amp; b'
not ok 3 - double quotes are escaped
not ok 4 - apostrophes are escaped
not ok 5 - an attribute payload is fully neutralised
# 5 cases, 4 failed
```

The escaping tables in `src/sanitize.js` are complete and correct — the strict
table lists `&`, `"` and `'` — yet only two characters are ever replaced.
Diagnose it from the evidence by actually running the commands — do not guess —
and get the suite green without weakening it.

## CHECK — the definition of done

```
node test.js
```

must exit 0 in this directory. **The check is run in a fresh process with a
clean environment**, so a repair that depends on variables you set in your own
shell, or on a wrapper script you invoke by hand, will not survive it. Run the
bare command yourself and paste the output.

## SCOPE — the only path you may create, change or delete

- `src/config.js`

Everything else in this tree is out of scope: a change to any other tracked path
fails the run even if the check passes.

## CONSTRAINTS — "do not", absolute

- **Do not** edit `test.js`, and do not weaken, delete, skip or rewrite any of
  its assertions.
- **Do not** edit `src/sanitize.js`. Its two escaping tables are correct as
  written and must keep both profiles intact — the defect is not that a table is
  missing an entry.
- **Do not** delete or bypass the ability to select a profile: whatever you
  change must still honour an explicitly supplied value.
- **Do not** add a dependency, run `npm install`, or reach the network.
- **Do not** run `git commit`, `git push`, or any other git command.
- **Do not** touch any path outside this directory.

## BUDGET

20 minutes wall clock, one attempt.

## REPORT CONTRACT

State the verbatim failures you observed, the root cause in one or two
sentences, the change you made and why it survives a clean environment, and the
verbatim output of the bare check command. If you cannot reach a working end
state, say so plainly (BLOCKED).
