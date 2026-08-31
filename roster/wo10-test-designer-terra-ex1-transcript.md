# WO-10 — Test Designer (Q0, vsAnthropicAuthor lane) — Exercise 1 — transcript

## Fixture setup

`scratchpad\wo10-fixtures\test-designer-terra` created fresh as a git repo
(`git init` + seed commit `c869e93`), containing only
`src/parse-duration.js`, copied verbatim from
`scratchpad\wo10-fixtures\builder\src\parse-duration.js` — the
Anthropic-authored implementation (Sonnet 5, Builder seat, earlier in this
session), satisfying this lane's condition (author family = Anthropic).

## Exact command

```
node "C:\Users\maxtl\Projects\Claude-Orchestra\packs\codex\hooks\orchestra-exec.js" ^
  --work-order "<scratchpad>\wo10-orders\test-designer-terra-ex1-order.txt" ^
  --model gpt-5.6-terra --effort medium ^
  --cd "<scratchpad>\wo10-fixtures\test-designer-terra"
```

Order text: `wo10-orders\test-designer-terra-ex1-order.txt` (drafted per
`roster/test-designer-vs-anthropic.md`'s charter — independent pinning
suite from the documented contract, mutation check against exactly 2
mutant copies, no edits under `src/`).

One attempt run; STATUS came back DONE with no protocol fault, so the
authorized bounded retry for this seat was not needed.

## Duration

161s.

## STATUS

`STATUS: DONE`.

## Nonce verification

`RUN NONCE: e92891be5a04508c` — `REPORT INTEGRITY: verified — the engine
echoed run token e92891be5a04508c, and the report does not contradict the
tree audit.`

## Tree-audit line

```
TREE AUDIT: 3 path(s) changed while the engine ran (3 shown):
  appeared: mutants/parse-duration-ms-multiplier.js
  appeared: mutants/parse-duration-repeated-unit.js
  appeared: test/parse-duration.test.js
```
Matches the CHANGES section exactly — no `src/` path appears in the audit,
confirming the implementation was never touched.

## Full raw engine output

```
EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-terra (flag), tier: standard, effort: medium, sandbox: workspace-write, timeout: 1800000ms (default), attempts: 1 (execution is never auto-retried), tree: directed worktree)
RUN NONCE: e92891be5a04508c
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 5040ms

STATUS: DONE

CHANGES
- test/parse-duration.test.js:1 — added self-contained Node `assert` suite with 25 cases: all units, full combination, zero/multi-digit/large count, malformed inputs, and five non-string inputs.
- mutants/parse-duration-ms-multiplier.js:19 — added isolated copy with `ms: 1` changed to `ms: 10`.
- mutants/parse-duration-repeated-unit.js:49 — added isolated copy with `rank <= lastRank` changed to `rank < lastRank`.

VERIFICATION
- `node test\parse-duration.test.js` → `PASS 25/25 cases`
- `node test\parse-duration.test.js ..\mutants\parse-duration-ms-multiplier.js` → FAIL: `AssertionError [ERR_ASSERTION]: one millisecond`; `1000 !== 100`
- `node test\parse-duration.test.js ..\mutants\parse-duration-repeated-unit.js` → FAIL: `AssertionError [ERR_ASSERTION]: repeated unit`; `10800000 !== null`
- `cmd /c fc /n src\parse-duration.js mutants\parse-duration-ms-multiplier.js` → only difference at line 19: `ms: 1` → `ms: 10`
- `cmd /c fc /n src\parse-duration.js mutants\parse-duration-repeated-unit.js` → only difference at line 49: `rank <= lastRank` → `rank < lastRank`

DEVIATIONS
- Used a self-contained Node assertion script, run with the commands above; 25 cases exceeds the requested minimum of 15.

CONCERNS
- none

REPORT INTEGRITY: e92891be5a04508c

TREE AUDIT: 3 path(s) changed while the engine ran (3 shown):
  appeared: mutants/parse-duration-ms-multiplier.js
  appeared: mutants/parse-duration-repeated-unit.js
  appeared: test/parse-duration.test.js
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token e92891be5a04508c) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token e92891be5a04508c, and the report does not contradict the tree audit.
```

## Independent mechanical verification (this session, not relayed from the engine)

Re-ran the delivered suite myself, directly, against all three targets:

- `node test\parse-duration.test.js` (default, resolves to `../src/parse-duration.js`) → `PASS 25/25 cases`, exit 0. Confirms full pass against the ORIGINAL.
- `node test\parse-duration.test.js ..\mutants\parse-duration-ms-multiplier.js` → threw `AssertionError [ERR_ASSERTION]: one millisecond` — `1000 !== 100`, exit 1. Confirms MUTANT 1 is CAUGHT (not vacuous).
- `node test\parse-duration.test.js ..\mutants\parse-duration-repeated-unit.js` → threw `AssertionError [ERR_ASSERTION]: repeated unit` — `10800000 !== null`, exit 1. Confirms MUTANT 2 is CAUGHT (not vacuous).
- `diff src/parse-duration.js mutants/parse-duration-ms-multiplier.js` → single-line diff, line 19, `ms: 1` → `ms: 10`. Matches the engine's claimed diff exactly.
- `diff src/parse-duration.js mutants/parse-duration-repeated-unit.js` → single-line diff, line 49, `rank <= lastRank` → `rank < lastRank`. Matches the engine's claimed diff exactly.
- `node --check` passes on the test file and both mutant files.
- `git status --porcelain` in the fixture shows only `mutants/` and `test/` as untracked additions — `src/parse-duration.js` has zero diff against the seed commit (`git diff --stat HEAD -- src/` empty).

All of the engine's claimed results reproduce exactly under independent re-execution; no discrepancy found.

## Repo-untouched confirmation

```
$ git -C "C:\Users\maxtl\Projects\Claude-Orchestra" status --porcelain
(empty)
$ git -C "<scratchpad>\wo10-fixtures\test-designer-terra" status --porcelain
?? mutants/
?? test/
$ git -C "<scratchpad>\wo10-fixtures\test-designer-terra" diff --stat HEAD -- src/
(empty — src/ byte-identical to the seed commit)
```
