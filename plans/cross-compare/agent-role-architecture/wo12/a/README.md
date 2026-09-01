# WO-12a — Builder budget casting corpus

Corpus only. **No trial pass has run**; nothing here records a result. Built to
`../wo12-protocol.md` §1, §3.3 and §4, before any model pass, on the same
pre-registration rule as the rest of WO-12.

## Layout

```
a/
  README.md            this file
  init-fixture.js      copy fixture -> temp, git init + baseline commit, print path
  fixture/             the clikit library, green at baseline (plain files, no .git)
    INIT.md            how the baseline commit is made; excluded from the copy
    package.json  index.js  test.js
    src/duration.js  src/table.js  src/pathnorm.js
    src/lru.js       src/semver.js  src/ini.js
  orders/a-01.md .. a-08.md    the eight order texts (dispatched verbatim)
  acceptance/a-0N.test.js      the eight HIDDEN acceptance tests
```

**`acceptance/` is scorer-only.** An arm never receives it, never sees it in its
worktree, and is told by its order only that a hidden test will be dropped at
the repository root as `a-0N.test.js` and run. The scorer copies
`acceptance/a-0N.test.js` to `<result>/a-0N.test.js` and runs `node a-0N.test.js`.

## Fixture

`clikit` — a dependency-free CommonJS CLI utility library, Node >= 20, no
framework. Six modules (`parseDuration`, `formatTable`, `normalizePath`,
`LRUCache`, `compareVersions`, `parseIni`), one aggregating `index.js`, one
assert-based suite in `test.js` (10 cases) that exits 0 at baseline.

Proof of a green baseline in a fresh copy:

```
$ node plans/cross-compare/agent-role-architecture/wo12/a/init-fixture.js
baseline commit 1b6210c
C:\Users\maxtl\AppData\Local\Temp\wo12a-55WBbM

$ cd C:\Users\maxtl\AppData\Local\Temp\wo12a-55WBbM
$ node test.js
ok 1 - parseDuration reads a single unit
ok 2 - parseDuration reads descending compound units
ok 3 - parseDuration rejects malformed input
ok 4 - formatTable pads columns and trims line ends
ok 5 - formatTable pads short rows and renders empty input as empty
ok 6 - normalizePath collapses separators and dot segments
ok 7 - LRUCache evicts the least recently used entry
ok 8 - LRUCache rejects a bad capacity
ok 9 - compareVersions orders strict semver triples
ok 10 - parseIni reads sections, pairs and comments
# 10 cases, 0 failed
EXIT=0

$ git status --porcelain
(no output)
```

`init-fixture.js` sets `core.autocrlf false` and points `core.excludesFile` at
an empty file inside `.git/`, so a global gitignore cannot hide a path from the
tree audit.

## The eight orders

| id | one line | new surface | scope |
|---|---|---|---|
| a-01 | `formatDuration(ms)` — the exact inverse of `parseDuration`, round-trip guaranteed | `src/duration.js` | `src/duration.js`, `index.js`, `test.js` |
| a-02 | `formatTable(rows, options)` — per-column `align` and a custom `separator`, byte-identical default output | `src/table.js` | `src/table.js`, `test.js` |
| a-03 | `relativePath(from, to)` — relative path between two absolute POSIX paths | `src/pathnorm.js` | `src/pathnorm.js`, `index.js`, `test.js` |
| a-04 | `LRUCache` gains `has`, `peek`, `delete`, `keys` — none of which disturb recency | `src/lru.js` | `src/lru.js`, `test.js` |
| a-05 | `diff(a, b)` and `maxVersion(versions)` over strict semver triples | `src/semver.js` | `src/semver.js`, `index.js`, `test.js` |
| a-06 | `stringifyIni(obj)` — the writer `parseIni` round-trips | `src/ini.js` | `src/ini.js`, `index.js`, `test.js` |
| a-07 | `wrapText(text, width)` — greedy word wrap with hard-split long words | new `src/wrap.js` | `src/wrap.js`, `index.js`, `test.js` |
| a-08 | `parseArgs(argv)` — long/short/negated flags, `=` values, `--` terminator | new `src/args.js` | `src/args.js`, `index.js`, `test.js` |

Every order states: mission, an exhaustive behavior contract with a worked
example table (every case the hidden test asserts appears in the order), the
required export names, the scope list, an explicit "do not" block (at minimum:
do not weaken existing assertions in `test.js`; do not add a dependency; no git
commands; do not create the reserved `a-0N.test.js` path), the two-part
acceptance, a 15-minute budget, and a report contract.

**Luna eligibility.** These are bounded by construction, per the guardrail that
Luna never receives under-specified work: no design latitude, no naming
choices, no ambiguity about error type or message, every boundary case
enumerated, and a mechanical accept/reject. Nothing in the eight requires a
judgment the order does not already make.

## Arms and casting (from protocol §3.3)

| | Arm L | Arm S |
|---|---|---|
| Casting | GPT-5.6 Luna · xhigh | Claude Sonnet 5 · medium |
| Transport | `orchestra-exec.js --model gpt-5.6-luna --effort xhigh` | in-harness Agent |
| Worktree | its own throwaway worktree, one per order | same |
| Cross-family R0 review | **Opus 5 · high** | **Sol · high** |

Each of the 8 orders runs **once per arm**. Each result gets the Verifier-style
mechanical replay (§1 accepted output) and one cross-family R0 review under the
computed matrix above.

**Pre-registered rule (protocol §3.3, restated, not amended).** Luna keeps the
`preferredBounded` rung iff

1. `accepted(L) >= accepted(S) - 1` of 8, **and**
2. `mean review rounds(L) <= mean review rounds(S) + 0.5`.

Otherwise the rung is demoted to *optional* (Sonnet · medium becomes the default
for bounded orders) pending a >= 30-order trial. Draw proxy (§0: engine wall
clock plus the bucket reading delta) is reported per arm; a Luna draw > 1.5x
Sonnet's per accepted order is a **flag, not a gate**. n=8, so 8/8 is 68-100%
at 95% (Wilson) — the outcome is provisional by construction and the real WO-12a
gate is the live escape-rate confirmation during shadow.

## Validation — red on the baseline, green on a correct implementation

Each hidden test was checked twice: run against the untouched baseline fixture
(must fail), then against a **private reference implementation** written in a
throwaway temp directory. The reference implementation is deliberately **not
committed** — committing it would leak the answer to any arm with repository
read access. Only its red/green result is recorded here.

Harness: for each order, `init-fixture.js --dest <temp>/a-0N` produced a fresh
baseline repo; `acceptance/a-0N.test.js` was copied to that repo's root;
`node a-0N.test.js` was run (RED); the reference implementation was applied;
then `node test.js` and `node a-0N.test.js` were run again (GREEN). Workdir of
the recorded run: `C:\Users\maxtl\AppData\Local\Temp\wo12a-val-iIsKRB`.

### Summary

```
==================== SUMMARY ====================
a-01  red=1  test.js=0  green=0  PASS
a-02  red=1  test.js=0  green=0  PASS
a-03  red=1  test.js=0  green=0  PASS
a-04  red=1  test.js=0  green=0  PASS
a-05  red=1  test.js=0  green=0  PASS
a-06  red=1  test.js=0  green=0  PASS
a-07  red=1  test.js=0  green=0  PASS
a-08  red=1  test.js=0  green=0  PASS
all ok: true
```

`red` = exit code of `node a-0N.test.js` on the untouched baseline (must be
non-zero); `test.js` = exit code of the project suite after the reference
implementation (must be 0); `green` = exit code of `node a-0N.test.js` after the
reference implementation (must be 0).

### Per-order red/green detail

**a-01** — RED `exit=1`, `# a-01: 8 cases, 7 failed`; first failure
`not ok 1 - formatDuration is exported from both index.js and src/duration.js`
/ `api.formatDuration is not a function`. GREEN `# 10 cases, 0 failed` (exit 0)
and `# a-01: 8 cases, 0 failed` (exit 0). Changed paths: `index.js`,
`src/duration.js`.

**a-02** — RED `exit=1`, `# a-02: 9 cases, 5 failed`; the four options cases and
the error-message case fail, e.g.
`not ok 2 - a custom separator is used between columns` with
`+ 'id  name\n1   alpha\n22  b'` against `- 'id | name\n1  | alpha\n22 | b'`,
and `not ok 8 - invalid options throw TypeError with the declared messages` /
`Missing expected exception.`. Case 1 (`default rendering is unchanged`) and
cases 6, 7, 9 pass at baseline **by design** — they are the
backward-compatibility half of the contract. GREEN `# 10 cases, 0 failed` and
`# a-02: 9 cases, 0 failed`. Changed path: `src/table.js`.

**a-03** — RED `exit=1`, `# a-03: 9 cases, 8 failed`;
`api.relativePath is not a function`. GREEN `# 10 cases, 0 failed` and
`# a-03: 9 cases, 0 failed`. Changed paths: `index.js`, `src/pathnorm.js`.

**a-04** — RED `exit=1`, `# a-04: 10 cases, 9 failed`;
`not ok 1 - the four methods exist on the prototype` / `missing method: peek`.
GREEN `# 10 cases, 0 failed` and `# a-04: 10 cases, 0 failed`. Changed path:
`src/lru.js`.

**a-05** — RED `exit=1`, `# a-05: 8 cases, 6 failed`;
`index.js is missing diff`. Case 4 (`diff validates both arguments`) passes at
baseline because `api.diff` is `undefined` and calling it throws a `TypeError`
of its own — the case is retained as a contract statement, and cases 1, 2, 3, 5,
6 and 7 carry the red. GREEN `# 10 cases, 0 failed` and
`# a-05: 8 cases, 0 failed`. Changed paths: `index.js`, `src/semver.js`.

**a-06** — RED `exit=1`, `# a-06: 10 cases, 9 failed`;
`api.stringifyIni is not a function`. GREEN `# 10 cases, 0 failed` and
`# a-06: 10 cases, 0 failed`. Changed paths: `index.js`, `src/ini.js`.

**a-07** — RED `exit=1`, the test cannot even load:
`Error: Cannot find module './src/wrap.js'` (`code: 'MODULE_NOT_FOUND'`) —
`src/wrap.js` does not exist at baseline, which is exactly the order's
deliverable. GREEN `# 10 cases, 0 failed` and `# a-07: 10 cases, 0 failed`.
Changed paths: `index.js`, new `src/wrap.js`.

**a-08** — RED `exit=1`, `Error: Cannot find module './src/args.js'`
(`code: 'MODULE_NOT_FOUND'`), same construction as a-07. GREEN
`# 10 cases, 0 failed` and `# a-08: 13 cases, 0 failed`. Changed paths:
`index.js`, new `src/args.js`.

### Fairness note on the hidden tests

Every assertion in every hidden test corresponds to a line of the matching
order: the worked-example tables are the test's expectations verbatim, the
`TypeError`/`RangeError` types and their exact `message` strings are quoted in
the orders, and each test's last case only re-checks baseline behaviors the
order forbids changing. `a-08`'s test compares `flags` and `positionals` by own
enumerable contents rather than by prototype, so a null-prototype `flags` object
is accepted; the order says so.
