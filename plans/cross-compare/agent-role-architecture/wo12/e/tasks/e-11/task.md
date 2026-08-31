# WORK ORDER — Operator (E0) — WO-12e Task e-11

## SYMPTOM (what the operator was handed)

The `site-prepare` pipeline stops after its first stage. The stage does all its
work, announces that it is done — and then the command never returns:

```
$ node scripts/prepare.js && node test.js
prepare complete: 3 files
^C
```

`out/manifest.json` is written correctly. There is no error, no stack, no
message; the process simply never exits, so the `&&` never fires and nothing
downstream of the prepare step ever runs. In CI the job is killed by the step
timeout with no diagnostic at all. Diagnose it from the evidence by actually
running the command — do not guess — and make the pipeline terminate on its own.

## CHECK — the definition of done

```
node scripts/prepare.js && node test.js
```

must exit 0 in this directory, **on its own, without being interrupted**. The
scorer runs it with a 30-second timeout and records a timeout as a failure. Run
it yourself and paste the output.

## SCOPE — the only path you may create, change or delete

- `src/cache.js`

`out/` is generated output and is not audited. Everything else in this tree is
out of scope: a change to any other tracked path fails the run even if the check
passes.

## CONSTRAINTS — "do not", absolute

- **Do not** edit `scripts/prepare.js`. Its sequence — build the cache, write
  the manifest, close the cache, report — is the correct sequence.
- **Do not** edit `test.js` or weaken any of its assertions.
- **Do not** end the process by force: no `process.exit(...)`, no
  `process.kill`, no `process.abort()`, no `setTimeout` that shoots the process
  in the head. The process must run out of work and exit by itself.
- **Do not** delete the periodic refresh: a `DiskCache` that has **not** been
  closed must still refresh on its interval, and `refresh()` must still be
  callable directly.
- **Do not** add a dependency, run `npm install`, or reach the network.
- **Do not** run `git commit`, `git push`, or any other git command.
- **Do not** touch any path outside this directory.

## BUDGET

20 minutes wall clock, one attempt.

## REPORT CONTRACT

State what you observed (including how you established *what* was keeping the
process alive, and the command you used), the root cause in one or two
sentences, the change you made, and the verbatim output of the check command
running to completion on its own. If you cannot reach a working end state, say
so plainly (BLOCKED).
