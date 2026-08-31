# WO-12e — scaffold-controlled terminal escalation corpus

Corpus only. **No trial pass has run**; nothing here records a result. Built to
`../wo12-protocol.md` §1, §3.4 and §4, before any model pass.

## Layout

```
e/
  README.md            this file
  init-task.js         copy a task fixture -> temp, git init + baseline commit, print path
  check-task.js        the mechanical "resolved" test: scope audit + check steps
  tasks/e-NN/
    meta.json          scorer-only: check steps, declared scope, ignores, budget, timeout
    task.md            THE ORDER handed to the arm (symptom, scope, check, budget, do-nots)
    SOLUTION.md        scorer-only: the real cause and the minimal fix
    fixture/           the deliberately broken repository, as plain files (no .git)
```

**`SOLUTION.md` and `meta.json` are scorer-only.** `init-task.js` copies
`fixture/` and nothing else, so neither can reach an arm's working tree by
accident. The trial driver hands an arm `task.md` and the prepared directory —
never `SOLUTION.md`, never any part of it, never a paraphrase of it.

## Drivers

```
node e/init-task.js  --task e-07 [--dest <path>]
node e/check-task.js --task e-07 --dir <path>
```

`init-task.js` copies the fixture to a throwaway directory, runs `git init -q -b
main`, `git config core.autocrlf false`, points `core.excludesFile` at an empty
file inside `.git/` (so a user-level global gitignore cannot hide a vendored
`node_modules` path from the audit), sets a local identity, `git add -A -f`,
`git commit -q -m baseline`, and prints the directory path as the last stdout
line. Progress goes to stderr.

`check-task.js` runs **two independent gates** and exits 0 only if both hold:

1. **Scope audit**, against the tree **as delivered**, before anything is run:
   `git status --porcelain -uall` (`-uall` so files inside a new directory are
   listed individually; renames contribute both paths). Every reported path is
   classified against the task's declared `scope`; paths on the task's
   `audit_ignore` list (generated artifacts such as `dist/`, `out/`,
   `index.json`, `.build.lock`) are excluded. Anything left is an out-of-scope
   mutation. Auditing first means artifacts the check itself produces can
   neither mask nor manufacture a violation.
2. **Check**, the task's pre-registered command steps run in order in that tree,
   each within the task's timeout, with the task's `env_unset` variables deleted
   from the environment. Every step must exit 0.

The last line is machine-readable: `RESULT: RESOLVED` or
`RESULT: NOT_RESOLVED (<reason>)`.

## The twelve tasks

Two per category, exactly as protocol §3.4 lists them.

| id | category | symptom the operator sees | declared scope | check | budget |
|---|---|---|---|---|---|
| e-01 | broken build script | the build exits 0, then the bundle throws `TypeError: CLI.upper is not a function` on load | `build.js` | `node build.js && node verify.js` | 20 min |
| e-02 | broken build script | the build reports "20000 rows" and exits 0, but `dist/bundle.js` is missing (or truncated mid-line) | `build.js` | `node build.js && node verify.js` | 20 min |
| e-03 | red test from an environment cause | the validator silently accepts records missing a required field; nobody edited the validator or the suite | `src/fields.gen.js` | `node test.js` | 20 min |
| e-04 | red test from an environment cause | `<` and `>` are escaped, `&`, `"` and `'` are not, although the escaping table lists all five | `src/config.js` | `node test.js` | 20 min |
| e-05 | toolchain / version mismatch | the engines preflight refuses Node v22.22.3 for being older than 8.0.0 | `scripts/preflight.js` | `node scripts/preflight.js && node test.js` | 20 min |
| e-06 | toolchain / version mismatch | a snapshot loses types: a `Date` returns as a string, a `Map`/`Set` as `{}` | `src/compat.js` | `node test.js` | 20 min |
| e-07 | missing / wrong dependency wiring | `ERR_PACKAGE_PATH_NOT_EXPORTED` on a vendored package whose files are all present | `node_modules/@fx/format/package.json` | `node test.js` | 20 min |
| e-08 | missing / wrong dependency wiring | the gate rejects its own issuer's token: `issuer returned a foreign token: Token(alice)` | `node_modules/@fx/issuer/node_modules/` | `node test.js` | 20 min |
| e-09 | path / encoding fault on Windows | every file is indexed and counted, but only top-level keys resolve; nested ones do not | `scripts/index-files.js` | `node scripts/index-files.js && node test.js` | 20 min |
| e-10 | path / encoding fault on Windows | `missing required setting: server.host` while `[server]`/`host=` are plainly in the file, and `[limits]` parses fine | `src/ini.js` | `node test.js` | 20 min |
| e-11 | process-lifetime fault | the prepare step does all its work, prints "prepare complete", and never returns | `src/cache.js` | `node scripts/prepare.js && node test.js` | 20 min |
| e-12 | process-lifetime fault | stage 1's output is on disk and the worker is gone, yet the pipeline aborts on a lock that is still held | `scripts/worker.js` | `node scripts/pipeline.js && node test.js` | 20 min |

Every fixture is Node-only: **Node >= 20 and git, nothing else**. No `npm
install`, no network, no Python, no Docker, no browser. The two tasks that need
a package have it vendored in-tree under `node_modules/` and committed by
`init-task.js`. Every `task.md` states the symptom an operator would see and
**never the cause**, declares its scope, names its check command, sets a 20-minute
one-attempt budget, and carries an explicit "do not" block that closes the cheap
non-repairs (weakening the suite, editing the file that is the requirement,
`process.exit`-ing out of a lifetime bug, and so on).

## Arms and casting (from protocol §3.4)

| | Arm O | Arm C |
|---|---|---|
| Casting | Claude Opus 5 · high | GPT-5.6 Sol · high |
| Transport | in-harness Agent with full tools, scope-fenced by the order | `orchestra-exec.js --model gpt-5.6-sol --effort high` |
| Budget | 20 min wall clock, one attempt | same |
| Order | identical `task.md`, verbatim | identical `task.md`, verbatim |

Resolved is §1's definition, mechanized by `check-task.js`: the check exits 0 in
a fresh checkout of the run's result **and** the tree audit finds no path
touched outside the declared scope.

**Pre-registered rule (protocol §3.4, restated, not amended).**

```
resolved(O) >= resolved(C) + 2   of 12
        AND
draw per resolved task(O) <= 1.5 x draw per resolved task(C)
```

→ the E0 escalation rung inverts to Opus-first (`router/castings.json` Operator
`mirror` becomes the strategy-stall target *first*), recorded as a ruling with
the numbers. Otherwise the reports' ordering stands (Sol·high → Sol·max once →
Opus·high). Draw is the §0 proxy (engine wall clock plus the bucket reading
delta), never a token count. A task on which **both** arms score zero is marked
**construction-suspect**. 12/12 is 76–100% at 95% (Wilson); every rate is
reported with its interval.

Allowance governance is unchanged: no pass to the OpenAI pool while P0 fails
closed for `OU`, none Anthropic-side while it fails closed for the drawn AU
bucket.

## Spec ambiguities resolved, and how

1. **"Red test from an environment cause" is not defined in the protocol.** Read
   as: a red suite whose cause is the *state of the environment or checkout*
   rather than a hand-written logic error in the code under test. e-03 is a
   stale checked-in generated artifact that no build step regenerates; e-04 is an
   unset environment variable selecting a legacy code path through a wrong
   default. Both are deterministic on any machine.
2. **e-09 is red on Windows only.** On a POSIX host `path.sep` is `/` and the
   broken fixture already passes. That is inherent to the protocol's
   "path/encoding fault **on Windows**" category. The corpus is authored and
   validated on Windows 11 / Node v22.22.3; if a run is ever hosted on Linux,
   e-09 must be recorded UNAVAILABLE, not resolved. Noted in its `SOLUTION.md`.
3. **Where the `check` command lives.** The protocol says each task "declares a
   `check` command". Stored twice: `check_display` (the human string, quoted in
   `task.md`) and `check_steps` (argv arrays), so the driver never goes through a
   shell and `&&` semantics are explicit rather than platform-dependent.
4. **Generated artifacts vs. the tree audit.** A check that builds something
   (`dist/`, `out/`, `index.json`, `.build.lock`) would otherwise register as an
   untracked out-of-scope path. Resolved with a per-task `audit_ignore` list,
   committed with the corpus, plus the audit-before-check ordering. The
   generated paths are named in each `task.md` so an arm knows they are not
   scored.
5. **A timeout is a failure, not an error.** e-11's broken state is a process
   that never exits, so `check-task.js` needs a per-task `timeout_ms`
   (30 s for e-11, 40 s for e-12, 60 s elsewhere) and reports a timeout as
   `NOT_RESOLVED`, not as infrastructure trouble. Recorded in e-11's
   `SOLUTION.md` so a scorer does not mistake it for a harness fault.
6. **`node_modules` and global ignores.** Two tasks need vendored packages
   committed. A user-level `core.excludesFile` with a `node_modules` rule would
   have hidden them from `git status`, silently disabling the audit on exactly
   the two tasks whose scope is inside `node_modules`. `init-task.js` neutralizes
   it by pointing `core.excludesFile` at an empty file in the new repo, and adds
   with `-f`.
7. **ASCII.** Every byte of every **fixture** file — everything an arm's working
   tree ever contains — is ASCII, with exactly one deliberate exception:
   `tasks/e-10/fixture/config/app.ini`, which *is* the encoding fault. That was
   enforced deliberately, so an arm chasing e-10 finds one non-ASCII byte
   sequence in its tree and no decoys. Its exact bytes are documented below and
   in `tasks/e-10/SOLUTION.md`. The corpus **documentation** (`task.md`,
   `SOLUTION.md`, this file) uses U+2014 em dashes, as `../wo12-protocol.md` and
   the rest of the repository do; no documentation file reaches a fixture tree.

## The one non-ASCII file, byte for byte

`tasks/e-10/fixture/config/app.ini` — 55 bytes, UTF-8 with a byte-order mark,
LF line endings:

```
ef bb bf 5b 73 65 72 76 65 72 5d 0a 68 6f 73 74
3d 31 32 37 2e 30 2e 30 2e 31 0a 70 6f 72 74 3d
38 30 38 30 0a 0a 5b 6c 69 6d 69 74 73 5d 0a 6d
61 78 3d 31 30 30 0a
```

i.e. `EF BB BF` (U+FEFF) followed by ASCII
`[server]\nhost=127.0.0.1\nport=8080\n\n[limits]\nmax=100\n`. Decoding the first
line yields the code points
`["feff","5b","73","65","72","76","65","72","5d"]`. `init-task.js` sets
`core.autocrlf false` so git never rewrites these bytes in either direction.

# Validation

Every task was validated twice, mechanically:

1. **RED** -- `init-task.js` into a fresh temp directory, then `check-task.js`
   against the untouched broken fixture. Must exit non-zero.
2. **GREEN** -- `init-task.js` into a second fresh temp directory, the minimal
   fix from that task's `SOLUTION.md` applied, then `check-task.js`. Must exit 0
   **and** report `out-of-scope changes: none`.

Environment: Windows 11 Home 10.0.26200, Node v22.22.3, git 2.47.1.windows.1.
Workdir of the recorded run: `C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy`.

## Summary

```
==================== SUMMARY ====================
e-01  red=1  green=0  PASS  broken build script
e-02  red=1  green=0  PASS  broken build script
e-03  red=1  green=0  PASS  red test from an environment cause
e-04  red=1  green=0  PASS  red test from an environment cause
e-05  red=1  green=0  PASS  toolchain / version mismatch
e-06  red=1  green=0  PASS  toolchain / version mismatch
e-07  red=1  green=0  PASS  missing or wrong dependency wiring
e-08  red=1  green=0  PASS  missing or wrong dependency wiring
e-09  red=1  green=0  PASS  path / encoding fault on Windows
e-10  red=1  green=0  PASS  path / encoding fault on Windows
e-11  red=1  green=0  PASS  process-lifetime fault
e-12  red=1  green=0  PASS  process-lifetime fault
all ok: true
workdir: C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy
```

## Full transcript, verbatim

```
================================================================
TASK e-01  [broken build script]  the built bundle throws before verification can run
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-01 --dest <tmp>/e-01-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-01-broken
e-01 baseline commit 3fcfd2b
$ node e/check-task.js --task e-01 --dir <tmp>/e-01-broken
task:  e-01  (broken build script)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-01-broken

--- scope audit (tree as delivered) ---
declared scope:
  build.js
generated artifacts ignored by the audit:
  dist/
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node build.js && node verify.js ---
(timeout 60000 ms per step)
$ node build.js
built dist/bundle.js from 3 modules
exit=0
$ node verify.js
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-01-broken\dist\bundle.js:11
CLI.HEADER = CLI.upper('name') + '|' + CLI.upper('count');
                 ^

TypeError: CLI.upper is not a function
    at Object.<anonymous> (C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-01-broken\dist\bundle.js:11:18)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)
    at Object..js (node:internal/modules/cjs/loader:1913:10)
    at Module.load (node:internal/modules/cjs/loader:1505:32)
    at Function._load (node:internal/modules/cjs/loader:1309:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    at Module.require (node:internal/modules/cjs/loader:1527:12)
    at require (node:internal/modules/helpers:147:16)
    at Object.<anonymous> (C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-01-broken\verify.js:4:11)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)

Node.js v22.22.3
exit=1

RESULT: NOT_RESOLVED (check step 2 (node verify.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-01 --dest <tmp>/e-01-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-01-fixed
e-01 baseline commit 07201b6
$ node e/check-task.js --task e-01 --dir <tmp>/e-01-fixed
task:  e-01  (broken build script)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-01-fixed

--- scope audit (tree as delivered) ---
declared scope:
  build.js
generated artifacts ignored by the audit:
  dist/
git status --porcelain -uall:
   M build.js
out-of-scope changes: none

--- check: node build.js && node verify.js ---
(timeout 60000 ms per step)
$ node build.js
built dist/bundle.js from 3 modules
exit=0
$ node verify.js
verify ok
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-02  [broken build script]  the generated bundle is truncated and will not parse
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-02 --dest <tmp>/e-02-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-02-broken
e-02 baseline commit 79d7316
$ node e/check-task.js --task e-02 --dir <tmp>/e-02-broken
task:  e-02  (broken build script)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-02-broken

--- scope audit (tree as delivered) ---
declared scope:
  build.js
generated artifacts ignored by the audit:
  dist/
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node build.js && node verify.js ---
(timeout 60000 ms per step)
$ node build.js
built dist/bundle.js (20000 rows)
exit=0
$ node verify.js
node:internal/modules/cjs/loader:1433
  throw err;
  ^

Error: Cannot find module './dist/bundle.js'
Require stack:
- C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-02-broken\verify.js
    at Function._resolveFilename (node:internal/modules/cjs/loader:1430:15)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1040:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1045:22)
    at Function._load (node:internal/modules/cjs/loader:1216:25)
    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    at Module.require (node:internal/modules/cjs/loader:1527:12)
    at require (node:internal/modules/helpers:147:16)
    at Object.<anonymous> (C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-02-broken\verify.js:4:14)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)
    at Object..js (node:internal/modules/cjs/loader:1913:10) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    'C:\\Users\\maxtl\\AppData\\Local\\Temp\\wo12e-val-SSqtNy\\e-02-broken\\verify.js'
  ]
}

Node.js v22.22.3
exit=1

RESULT: NOT_RESOLVED (check step 2 (node verify.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-02 --dest <tmp>/e-02-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-02-fixed
e-02 baseline commit addfe1a
$ node e/check-task.js --task e-02 --dir <tmp>/e-02-fixed
task:  e-02  (broken build script)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-02-fixed

--- scope audit (tree as delivered) ---
declared scope:
  build.js
generated artifacts ignored by the audit:
  dist/
git status --porcelain -uall:
   M build.js
out-of-scope changes: none

--- check: node build.js && node verify.js ---
(timeout 60000 ms per step)
$ node build.js
built dist/bundle.js (20000 rows)
exit=0
$ node verify.js
verify ok
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-03  [red test from an environment cause]  a stale generated artifact in the checkout makes the suite red
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-03 --dest <tmp>/e-03-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-03-broken
e-03 baseline commit 012d917
$ node e/check-task.js --task e-03 --dir <tmp>/e-03-broken
task:  e-03  (red test from an environment cause)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-03-broken

--- scope audit (tree as delivered) ---
declared scope:
  src/fields.gen.js
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
not ok 1 - a record missing a required field is reported
  Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'region'
- ]

not ok 2 - an empty required field counts as missing
  Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'region'
- ]

ok 3 - a complete record has nothing missing
not ok 4 - an incomplete record is invalid
  Expected values to be strictly equal:

true !== false

ok 5 - optional fields are never reported
# 5 cases, 3 failed
exit=1

RESULT: NOT_RESOLVED (check step 1 (node test.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-03 --dest <tmp>/e-03-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-03-fixed
e-03 baseline commit 146e08c
(fix step output) wrote src/fields.gen.js (3 required, 1 optional)
$ node e/check-task.js --task e-03 --dir <tmp>/e-03-fixed
task:  e-03  (red test from an environment cause)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-03-fixed

--- scope audit (tree as delivered) ---
declared scope:
  src/fields.gen.js
git status --porcelain -uall:
   M src/fields.gen.js
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
ok 1 - a record missing a required field is reported
ok 2 - an empty required field counts as missing
ok 3 - a complete record has nothing missing
ok 4 - an incomplete record is invalid
ok 5 - optional fields are never reported
# 5 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-04  [red test from an environment cause]  an unset environment variable selects the wrong code path
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-04 --dest <tmp>/e-04-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-04-broken
e-04 baseline commit 533e1f2
$ node e/check-task.js --task e-04 --dir <tmp>/e-04-broken
task:  e-04  (red test from an environment cause)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-04-broken

--- scope audit (tree as delivered) ---
declared scope:
  src/config.js
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step; unset: APP_MODE)
$ node test.js
ok 1 - angle brackets are escaped
not ok 2 - ampersands are escaped
  Expected values to be strictly equal:
+ actual - expected

+ 'a & b'
- 'a &amp; b'
      ^

not ok 3 - double quotes are escaped
  Expected values to be strictly equal:
+ actual - expected

+ 'say "hi"'
- 'say &quot;hi&quot;'
       ^

not ok 4 - apostrophes are escaped
  Expected values to be strictly equal:
+ actual - expected

+ "it's fine"
- 'it&#39;s fine'

not ok 5 - an attribute payload is fully neutralised
  Expected values to be strictly equal:
+ actual - expected

+ `" onerror='boom' & &lt;img&gt;`
- '&quot; onerror=&#39;boom&#39; &amp; &lt;img&gt;'

# 5 cases, 4 failed
exit=1

RESULT: NOT_RESOLVED (check step 1 (node test.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-04 --dest <tmp>/e-04-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-04-fixed
e-04 baseline commit 2c191e3
$ node e/check-task.js --task e-04 --dir <tmp>/e-04-fixed
task:  e-04  (red test from an environment cause)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-04-fixed

--- scope audit (tree as delivered) ---
declared scope:
  src/config.js
git status --porcelain -uall:
   M src/config.js
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step; unset: APP_MODE)
$ node test.js
ok 1 - angle brackets are escaped
ok 2 - ampersands are escaped
ok 3 - double quotes are escaped
ok 4 - apostrophes are escaped
ok 5 - an attribute payload is fully neutralised
# 5 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-05  [toolchain / version mismatch]  the engines preflight rejects a Node that satisfies the range
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-05 --dest <tmp>/e-05-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-05-broken
e-05 baseline commit f7e9f2f
$ node e/check-task.js --task e-05 --dir <tmp>/e-05-broken
task:  e-05  (toolchain / version mismatch)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-05-broken

--- scope audit (tree as delivered) ---
declared scope:
  scripts/preflight.js
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node scripts/preflight.js && node test.js ---
(timeout 60000 ms per step)
$ node scripts/preflight.js
legacy-toolkit requires Node 8.0.0 or newer; found v22.22.3
exit=1

RESULT: NOT_RESOLVED (check step 1 (node scripts/preflight.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-05 --dest <tmp>/e-05-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-05-fixed
e-05 baseline commit 57db967
$ node e/check-task.js --task e-05 --dir <tmp>/e-05-fixed
task:  e-05  (toolchain / version mismatch)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-05-fixed

--- scope audit (tree as delivered) ---
declared scope:
  scripts/preflight.js
git status --porcelain -uall:
   M scripts/preflight.js
out-of-scope changes: none

--- check: node scripts/preflight.js && node test.js ---
(timeout 60000 ms per step)
$ node scripts/preflight.js
preflight ok: node v22.22.3 satisfies >=8.0.0
exit=0
$ node test.js
ok 1 - an empty input summarizes to zero
ok 2 - rows are counted and totalled
ok 3 - totals are grouped by kind
ok 4 - a non-array input is rejected
# 4 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-06  [toolchain / version mismatch]  an inverted capability probe selects the legacy runtime path
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-06 --dest <tmp>/e-06-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-06-broken
e-06 baseline commit 2906fde
$ node e/check-task.js --task e-06 --dir <tmp>/e-06-broken
task:  e-06  (toolchain / version mismatch)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-06-broken

--- scope audit (tree as delivered) ---
declared scope:
  src/compat.js
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
ok 1 - the snapshot is a distinct object
not ok 2 - the creation time survives as a Date
  The expression evaluated to a falsy value:

  assert.ok(p.snap.createdAt instanceof Date)

not ok 3 - tags survive as a Map
  The expression evaluated to a falsy value:

  assert.ok(p.snap.tags instanceof Map)

not ok 4 - seen survives as a Set
  The expression evaluated to a falsy value:

  assert.ok(p.snap.seen instanceof Set)

ok 5 - the snapshot is deep, not shared
# 5 cases, 3 failed
exit=1

RESULT: NOT_RESOLVED (check step 1 (node test.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-06 --dest <tmp>/e-06-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-06-fixed
e-06 baseline commit cefd204
$ node e/check-task.js --task e-06 --dir <tmp>/e-06-fixed
task:  e-06  (toolchain / version mismatch)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-06-fixed

--- scope audit (tree as delivered) ---
declared scope:
  src/compat.js
git status --porcelain -uall:
   M src/compat.js
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
ok 1 - the snapshot is a distinct object
ok 2 - the creation time survives as a Date
ok 3 - tags survive as a Map
ok 4 - seen survives as a Set
ok 5 - the snapshot is deep, not shared
# 5 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-07  [missing or wrong dependency wiring]  a vendored package cannot be required at all
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-07 --dest <tmp>/e-07-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-07-broken
e-07 baseline commit 7160176
$ node e/check-task.js --task e-07 --dir <tmp>/e-07-broken
task:  e-07  (missing or wrong dependency wiring)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-07-broken

--- scope audit (tree as delivered) ---
declared scope:
  node_modules/@fx/format/package.json
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
node:internal/modules/cjs/loader:671
      throw e;
      ^

Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-07-broken\node_modules\@fx\format\package.json
    at exportsNotFound (node:internal/modules/esm/resolve:314:10)
    at packageExportsResolve (node:internal/modules/esm/resolve:604:13)
    at resolveExports (node:internal/modules/cjs/loader:664:36)
    at Function._findPath (node:internal/modules/cjs/loader:731:31)
    at Function._resolveFilename (node:internal/modules/cjs/loader:1415:27)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1040:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1045:22)
    at Function._load (node:internal/modules/cjs/loader:1216:25)
    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    at Module.require (node:internal/modules/cjs/loader:1527:12) {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'
}

Node.js v22.22.3
exit=1

RESULT: NOT_RESOLVED (check step 1 (node test.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-07 --dest <tmp>/e-07-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-07-fixed
e-07 baseline commit 7160176
$ node e/check-task.js --task e-07 --dir <tmp>/e-07-fixed
task:  e-07  (missing or wrong dependency wiring)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-07-fixed

--- scope audit (tree as delivered) ---
declared scope:
  node_modules/@fx/format/package.json
git status --porcelain -uall:
   M node_modules/@fx/format/package.json
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
ok 1 - items are totalled in cents
ok 2 - the invoice renders line by line
ok 3 - an empty invoice still renders
ok 4 - the vendored package reports its version
# 4 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-08  [missing or wrong dependency wiring]  two copies of one package break an instanceof gate
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-08 --dest <tmp>/e-08-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-08-broken
e-08 baseline commit 6dc0e53
$ node e/check-task.js --task e-08 --dir <tmp>/e-08-broken
task:  e-08  (missing or wrong dependency wiring)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-08-broken

--- scope audit (tree as delivered) ---
declared scope:
  node_modules/@fx/issuer/node_modules/
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
not ok 1 - an issued token is accepted
  issuer returned a foreign token: Token(alice)
ok 2 - a non-string subject is rejected
ok 3 - the issuer reports the token version it is wired to
# 3 cases, 1 failed
exit=1

RESULT: NOT_RESOLVED (check step 1 (node test.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-08 --dest <tmp>/e-08-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-08-fixed
e-08 baseline commit ea621a6
$ node e/check-task.js --task e-08 --dir <tmp>/e-08-fixed
task:  e-08  (missing or wrong dependency wiring)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-08-fixed

--- scope audit (tree as delivered) ---
declared scope:
  node_modules/@fx/issuer/node_modules/
git status --porcelain -uall:
   D node_modules/@fx/issuer/node_modules/@fx/token/index.js
   D node_modules/@fx/issuer/node_modules/@fx/token/package.json
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
ok 1 - an issued token is accepted
ok 2 - a non-string subject is rejected
ok 3 - the issuer reports the token version it is wired to
# 3 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-09  [path / encoding fault on Windows]  the generated index keys nested files with the platform separator
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-09 --dest <tmp>/e-09-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-09-broken
e-09 baseline commit 3a76b98
$ node e/check-task.js --task e-09 --dir <tmp>/e-09-broken
task:  e-09  (path / encoding fault on Windows)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-09-broken

--- scope audit (tree as delivered) ---
declared scope:
  scripts/index-files.js
generated artifacts ignored by the audit:
  index.json
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node scripts/index-files.js && node test.js ---
(timeout 60000 ms per step)
$ node scripts/index-files.js
indexed 4 files
exit=0
$ node test.js
ok 1 - every content file is indexed
ok 2 - a top-level file is found by name
not ok 3 - a nested file is found by its content-relative key
  expected an entry for docs/a.md
not ok 4 - children lists the files in a directory
  Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'docs/a.md',
-   'docs/b.md'
- ]

# 4 cases, 2 failed
exit=1

RESULT: NOT_RESOLVED (check step 2 (node test.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-09 --dest <tmp>/e-09-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-09-fixed
e-09 baseline commit 5446ff1
$ node e/check-task.js --task e-09 --dir <tmp>/e-09-fixed
task:  e-09  (path / encoding fault on Windows)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-09-fixed

--- scope audit (tree as delivered) ---
declared scope:
  scripts/index-files.js
generated artifacts ignored by the audit:
  index.json
git status --porcelain -uall:
   M scripts/index-files.js
out-of-scope changes: none

--- check: node scripts/index-files.js && node test.js ---
(timeout 60000 ms per step)
$ node scripts/index-files.js
indexed 4 files
exit=0
$ node test.js
ok 1 - every content file is indexed
ok 2 - a top-level file is found by name
ok 3 - a nested file is found by its content-relative key
ok 4 - children lists the files in a directory
# 4 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-10  [path / encoding fault on Windows]  a byte-order mark hides the first section of a config file
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-10 --dest <tmp>/e-10-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-10-broken
e-10 baseline commit 4e486ec
$ node e/check-task.js --task e-10 --dir <tmp>/e-10-broken
task:  e-10  (path / encoding fault on Windows)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-10-broken

--- scope audit (tree as delivered) ---
declared scope:
  src/ini.js
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
not ok 1 - the config loads
  missing required setting: server.host
not ok 2 - server settings are read
  missing required setting: server.host
not ok 3 - limits are read
  missing required setting: server.host
not ok 4 - settings do not leak to the top level
  missing required setting: server.host
# 4 cases, 4 failed
exit=1

RESULT: NOT_RESOLVED (check step 1 (node test.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-10 --dest <tmp>/e-10-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-10-fixed
e-10 baseline commit 4e486ec
$ node e/check-task.js --task e-10 --dir <tmp>/e-10-fixed
task:  e-10  (path / encoding fault on Windows)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-10-fixed

--- scope audit (tree as delivered) ---
declared scope:
  src/ini.js
git status --porcelain -uall:
   M src/ini.js
out-of-scope changes: none

--- check: node test.js ---
(timeout 60000 ms per step)
$ node test.js
ok 1 - the config loads
ok 2 - server settings are read
ok 3 - limits are read
ok 4 - settings do not leak to the top level
# 4 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-11  [process-lifetime fault]  the prepare step never exits
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-11 --dest <tmp>/e-11-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-11-broken
e-11 baseline commit d844596
$ node e/check-task.js --task e-11 --dir <tmp>/e-11-broken
task:  e-11  (process-lifetime fault)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-11-broken

--- scope audit (tree as delivered) ---
declared scope:
  src/cache.js
generated artifacts ignored by the audit:
  out/
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node scripts/prepare.js && node test.js ---
(timeout 30000 ms per step)
$ node scripts/prepare.js
prepare complete: 3 files
TIMEOUT after 30000 ms (killed with SIGTERM)

RESULT: NOT_RESOLVED (check step 1 timed out after 30000 ms)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-11 --dest <tmp>/e-11-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-11-fixed
e-11 baseline commit d154c5b
$ node e/check-task.js --task e-11 --dir <tmp>/e-11-fixed
task:  e-11  (process-lifetime fault)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-11-fixed

--- scope audit (tree as delivered) ---
declared scope:
  src/cache.js
generated artifacts ignored by the audit:
  out/
git status --porcelain -uall:
   M src/cache.js
out-of-scope changes: none

--- check: node scripts/prepare.js && node test.js ---
(timeout 30000 ms per step)
$ node scripts/prepare.js
prepare complete: 3 files
exit=0
$ node test.js
ok 1 - the prepare step wrote a manifest
ok 2 - every content file is in the manifest
ok 3 - every recorded size is a positive integer
# 3 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0

================================================================
TASK e-12  [process-lifetime fault]  the background worker never releases the build lock
================================================================

--- RED: broken fixture as shipped ---
$ node e/init-task.js --task e-12 --dest <tmp>/e-12-broken
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-12-broken
e-12 baseline commit abebe13
$ node e/check-task.js --task e-12 --dir <tmp>/e-12-broken
task:  e-12  (process-lifetime fault)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-12-broken

--- scope audit (tree as delivered) ---
declared scope:
  scripts/worker.js
generated artifacts ignored by the audit:
  out/
  .build.lock
git status --porcelain -uall:
  (clean)
out-of-scope changes: none

--- check: node scripts/pipeline.js && node test.js ---
(timeout 40000 ms per step)
$ node scripts/pipeline.js
stage 1 handed to the background worker (pid 16812)
stage 2 aborted: build lock still held (.build.lock)
exit=1

RESULT: NOT_RESOLVED (check step 1 (node scripts/pipeline.js) exited 1)
exit=1

--- GREEN: fresh copy, SOLUTION.md fix applied ---
$ node e/init-task.js --task e-12 --dest <tmp>/e-12-fixed
C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-12-fixed
e-12 baseline commit e4cf1f3
$ node e/check-task.js --task e-12 --dir <tmp>/e-12-fixed
task:  e-12  (process-lifetime fault)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-val-SSqtNy\e-12-fixed

--- scope audit (tree as delivered) ---
declared scope:
  scripts/worker.js
generated artifacts ignored by the audit:
  out/
  .build.lock
git status --porcelain -uall:
   M scripts/worker.js
out-of-scope changes: none

--- check: node scripts/pipeline.js && node test.js ---
(timeout 40000 ms per step)
$ node scripts/pipeline.js
stage 1 handed to the background worker (pid 36132)
pipeline complete
exit=0
$ node test.js
ok 1 - stage 1 produced its output
ok 2 - stage 2 ran and consumed stage 1
ok 3 - the build lock was released
ok 4 - no stray output was left behind
# 4 cases, 0 failed
exit=0

RESULT: RESOLVED
exit=0
```

## Negative control -- the scope audit actually bites

A green check must not be enough. This run applies the correct in-scope repair
to e-04 **and** an out-of-scope edit (`docs/ENV.md`) plus a stray new file
(`NOTES.txt`). The check passes; the run is still `NOT_RESOLVED`:

```
$ node e/check-task.js --task e-04 --dir <tmp>/e-04-cheat
task:  e-04  (red test from an environment cause)
dir:   C:\Users\maxtl\AppData\Local\Temp\wo12e-audit-4s49lB\e-04-cheat

--- scope audit (tree as delivered) ---
declared scope:
  src/config.js
git status --porcelain -uall:
   M docs/ENV.md
   M src/config.js
  ?? NOTES.txt
out-of-scope changes (2):
  docs/ENV.md
  NOTES.txt

--- check: node test.js ---
(timeout 60000 ms per step; unset: APP_MODE)
$ node test.js
ok 1 - angle brackets are escaped
ok 2 - ampersands are escaped
ok 3 - double quotes are escaped
ok 4 - apostrophes are escaped
ok 5 - an attribute payload is fully neutralised
# 5 cases, 0 failed
exit=0

RESULT: NOT_RESOLVED (out-of-scope mutation: docs/ENV.md, NOTES.txt)
exit=1

negative control passes: true
```

## Notes for the scorer

- **e-02's red shape varies by timing.** On this machine `dist/bundle.js` is
  never created at all (`MODULE_NOT_FOUND`), because `process.exit(0)` beats the
  stream's asynchronous `open`. On a slower host the file can appear truncated
  mid-line and fail with a `SyntaxError` at a shifting line number instead. Both
  are the same defect and both are `NOT_RESOLVED`; the task text says so.
- **e-11's red signal is a TIMEOUT**, reported as
  `RESULT: NOT_RESOLVED (check step 1 timed out after 30000 ms)`. That is the
  expected outcome on the broken fixture, not a harness fault.
- **e-08's correct repair is a deletion**, which the audit sees as ` D` entries
  under the declared scope prefix. That is in scope and clean, as the transcript
  shows.
- Several tasks have partially green suites at baseline by design (e-04 case 1,
  e-06 cases 1 and 5, e-08 cases 2 and 3, e-09 cases 1 and 2, e-03 cases 3 and
  5). Those passing cases are what make the symptom puzzling; they are not slack
  in the check, because the check gates on the whole suite exiting 0.
- Each `SOLUTION.md` also names the *non*-repairs that would make a check pass
  while violating the order (weakening an `instanceof` gate, deleting an
  `exports` field, an async unlink in an `exit` handler). Those are notes for the
  reviewer, not additional mechanical gates: `check-task.js` scores exactly the
  two gates above and nothing else.
