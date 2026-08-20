# Changelog

Versions follow the rule in the README's "Versioning" section: **patch** for
fixes and doc-only changes, **minor** for new capabilities, **major** for
breaking changes to the protocol or the `orchestra.json` format. The version
lives in [`VERSION`](VERSION) and is stamped into every project the installer
touches.

Entries name the failure that prompted the change. A harness that only records
*what* it changed teaches nobody why the old way looked reasonable.

## 1.9.0 — two silent lies, made loud: unloadable frontmatter and replayed exec reports

Two field incidents from one downstream project (2026-08-19), both of the
worst species — failures that look exactly like success.

### A YAML-unsafe description silently unloads an agent (frontmatter lint)

Three codex-pack agents shipped with descriptions containing the sentence
"This agent is a thin launcher: it runs …". A bare `": "` inside an unquoted
YAML scalar makes the **whole frontmatter unparseable**, and Claude Code drops
such a file **silently** — no log, no telemetry: the parse failure yields an
empty frontmatter object, and the missing-name path returns null before any
logging runs. Claude Code does have a repair pass that would have quoted the
value, but its line regex cannot match lines with a trailing CR, so CRLF
worktrees (Windows autocrlf, no `.gitattributes`) defeat it — the same file
loads on LF platforms and vanishes on CRLF ones, which is how it shipped
unnoticed. Downstream, the three agents never registered in any session;
`planner-gpt` (the one codex agent without the sentence) loaded fine, which
misdirected diagnosis toward session and roster theories for days. 4ed7a03
reworded the three descriptions; this release makes the class unshippable:

- **The installer lints every `.md` it is about to stamp** — core agents,
  specialists, skills, pack agents and skills — with a strict parser for the
  YAML block-mapping subset frontmatter uses, **before copying anything**. A
  parse failure refuses the install with the file, the line, and the fix; a
  value that parses but loses text (`" #"` truncation) or leans on the
  repair pass warns loudly. Required files (agents, specialists, SKILL.md)
  must also carry a non-empty `name:` — the other silent-drop path.
- **`node install.js --lint [dir]`** runs the identical check standalone
  (strict: warnings fail it), and CI runs it over the whole repository on all
  three platforms, so a YAML-unsafe value can never merge again. There is a
  dedicated suite, `tests/frontmatter-lint.test.js` (23 checks).
- **Line endings are settled both ways, deliberately.** The installer now
  normalizes every installed `.md` to LF (the master's own `.gitattributes`
  already pins `*.md` to LF), AND stamps a scoped `.claude/.gitattributes`
  (`*.md`/`*.js text eol=lf`) into the target when none exists — because a
  project that commits `.claude/` and re-checks out under `autocrlf=true`
  would otherwise convert the files right back. An existing `.gitattributes`
  is never edited (a note suggests the line); `--uninstall` removes the
  stamped file only when it is byte-for-byte the installer's.

### The exec lane could relay a stale run's report — and its "audit" — as fresh

Two consecutive downstream `executor-codex` runs misreported reality: one
relayed "the scoped changes were already present; no additional edits were
necessary" over work the engine had in fact just authored, and the other
returned `STATUS: DONE` with a report, verification counts, and TREE AUDIT
describing a **weeks-old, already-merged order** while the actual tree was
verified untouched. The audit — the mechanism that exists to make reports
checkable — was stale along with the report, which pointed at the one place
both travel together: **the launcher protocol's output file.** The launcher
agents derived FIXED paths in `os.tmpdir()` (`orchestra-exec-out.txt`,
`…-heavy-out.txt`) and polled for a bare `ORCHESTRA_RUNNER_DONE` sentinel
carrying no run identity. Any launch that died before its `rm -f` (a mangled
heredoc, a failed background spawn, a permission denial) left the PREVIOUS
run's complete output — header, report, audit, `rc=0` sentinel — sitting at
exactly the path the poll then read and relayed wholesale; tmp files persist
for weeks on Windows, hence the weeks-old replay. The
"already present" shape is the same key colliding the other way: a second
launch (the launcher's retry-once rule, or a harness timeout promotion)
clobbering the first run's in-flight output file, then truthfully describing
the tree the first run had already edited. Fixed at every layer:

- **Per-run tokens end the collision.** All four launcher protocols
  (`executor-codex`, `executor-codex-heavy`, `reviewer-codex`, `planner-gpt`)
  now derive their tmp paths from a launcher-invented run token and write /
  poll a token-keyed sentinel (`ORCHESTRA_RUNNER_DONE <token> rc=…`). A stale
  file can no longer satisfy a poll, and a retry (now required to use a fresh
  token, after re-polling the first) can no longer clobber a live run. The
  retry rule itself now says: a sentinel with your token means the runner DID
  run — relay it, never relaunch.
- **The runner proves freshness with a nonce.** `orchestra-exec.js` generates
  a per-run token, prints it in the header (`RUN NONCE:`), injects it into
  the brief, and requires the engine to echo it on a final
  `REPORT INTEGRITY:` line (the brief never contains the composed line, so an
  engine echoing its prompt cannot false-pass). A report without the echo —
  the stale-session signature — is `STATUS: EXEC_UNAVAILABLE`, with the
  discarded text shown but labelled `UNVERIFIED ENGINE OUTPUT`, never DONE.
- **The audit is replay-proof by provenance.** It was always computed
  in-process from the runner's own before/after fingerprints; it now says so,
  stamped with the run nonce — and a report whose CHANGES claims edits
  against a tree the runner measured as byte-for-byte untouched (no source
  paths, no generated churn, HEAD unmoved) is an integrity failure too
  (skipped for read-only dry runs, where no claim could land by design).
- **Fresh sessions are enforced, not assumed.** Resume-prone
  `ORCHESTRA_EXEC_ARGS` tokens (`resume`, `--last`, `--continue`) are refused
  before anything launches.
- **The doctor knows the hazard.** `orchestra-review.js --doctor` now flags
  session-resuming tokens in `ORCHESTRA_EXEC_ARGS` / `ORCHESTRA_REVIEW_ARGS`,
  resume-prone lines in the Codex `config.toml`, and counts session
  artifacts under `CODEX_HOME` (informational — history is harmless until a
  resume-prone config appears). `--doctor --live` additionally runs a real
  no-op order through the sibling exec runner in a scratch directory
  (read-only sandbox) and verifies the nonce round-trip, at the cost of one
  model call.

Tested in `tests/exec-lane.test.js` (79 checks: nonce echo and refusal paths,
fresh-session enforcement, claim/audit contradiction, and a docs contract
pinning the token-keyed launcher protocol) and `tests/review-lane.test.js`
(doctor hazard detection and the `--live` round-trip, against the stub
engine). The doctor tests now pin `CODEX_HOME` to an empty fixture so a
developer's real `~/.codex` cannot flip a check.

## 1.7.0 — finding the installs that are behind

Updating one project was already easy: `node install.js <project>`, no flags,
idempotent, and it re-reads `orchestra-install.json` so the project's own pack
and specialist selection survives. What was missing was knowing *which*
projects needed it. Nothing recorded where the installs were, so the documented
upgrade path was: run `head -3 .claude/ORCHESTRA.md` in each project you
remember harnessing, compare it against the master's `VERSION` by eye, and
re-run the installer. A manual diff across a set nobody was tracking.

That gap has teeth. v1.5.0 fixed a Codex helper that had left the review lane
silently dead for six days — reviews that launched, ran, and returned nothing
under a preflight reporting a healthy install. A project still on v1.4.1
carries that bug and has no way to find out except by hitting it, and the
harness had no answer to "which of my projects are affected?"

`node install.js --scan <dir>` answers it, and `--update` acts on the answer.
A project counts as an install when it has `.claude/ORCHESTRA.md` — what the
installer writes and `--uninstall` removes — with the version read from
`orchestra-install.json`, falling back to the `ORCHESTRA.md` header stamp so
pre-packs installs are classified rather than skipped. Exit `1` when something
is behind makes it usable as a check rather than only as a report.

The restraint is the design:

- **An update spawns a plain per-project re-run**, the identical code path a
  person runs by hand. This mode adds discovery, not a second way to install —
  so each project keeps its own recorded selection, gets its own pack
  self-check, and a failure in one cannot corrupt the next.
- **`--scan` refuses `--packs`/`--specialists`.** A scan spans projects that
  made different choices; one selection applied across all of them would
  silently rewrite those choices — adding an OpenAI surface to projects that
  never asked for one, or dropping a specialist another depends on.
- **`--scan` refuses `--uninstall`.** Mass removal is not a convenience worth
  building; one project at a time is the honest interface.
- **An install ahead of the master is reported and skipped.** Downgrading a
  project stamped by a newer master would be data loss wearing an update's
  name.
- **A pre-versioning install is warned about before it is updated.** With no
  recorded selection, a plain re-run cannot restore packs it was never told
  about, so the scan says so — with the command to re-add them — instead of
  quietly shipping a downgraded harness.

The walk skips `node_modules`, VCS directories, build outputs and caches, never
follows symlinked directories (a Dirent reports a symlink as a symlink, so the
walk cannot loop), stops at a directory that is itself an install, and bounds
depth at 6 by default (`--depth <n>`). A malformed `orchestra-install.json`
degrades that one row to its header stamp rather than taking the scan down.

Tested in `tests/scan-lane.test.js` (41 checks, in CI on all three platforms)
against installs the installer itself produced and then aged — nothing is
stubbed, because the property under test is whether the scan reads what the
installer actually writes. `install.ps1` gained `-Scan`/`-Update`/`-Depth`;
`install.sh` already forwarded its arguments verbatim.

## 1.6.0 — cross-vendor execution: OpenAI executors (Sol / Terra) in the codex pack

Until now the codex pack's OpenAI surface covered judgment (review, deep-plan)
but never hands: every edit ran on a Claude executor, and a project that wanted
to offload workhorse implementation to OpenAI models had no route that kept the
harness's guarantees — no idle precheck, no standard report the Director can
parse, no automatic review pairing. The informal alternative (run Codex by hand,
then `/orchestra-review` the diff) works, but makes the user the transport and
takes the Director out of the loop it exists to run.

So the pack now carries an **execution lane**, mirroring the review lane's
shape exactly: two thin Haiku launchers — `executor-codex` (default tier,
GPT-5.6 **Terra**, OpenAI's everyday workhorse) and `executor-codex-heavy`
(hard tier, GPT-5.6 **Sol**, the flagship, at high reasoning effort) — driving
a new runner, `hooks/orchestra-exec.js`, that enforces the Orchestra executor
law in its brief, runs `codex exec` in a `workspace-write` sandbox in the live
tree, and relays the engine's report in the executor format the loop already
parses. Routing is opt-in and mirrors `reviewEngine`: `"executorEngine":
"codex"` in `.claude/orchestra.json`, or an in-conversation request; the
Claude executors stay the default, the fallback, and the escalation rung.

Three deliberate asymmetries with the review lane, each a property of
execution rather than an omission:

- **No auto-retry.** A review is idempotent — reading the same commit twice is
  the same review — so its runner retries a flaky engine. Execution is not: a
  half-dead engine may have half-edited the tree, and a blind second attempt
  starts from a state the work order never described. One attempt; on failure,
  `STATUS: EXEC_UNAVAILABLE` with the review lane's full attribution (who
  killed the engine, elapsed against the cap, last words) and the Director
  decides what a re-dispatch starts from.
- **A tree audit instead of an integrity warning.** The reviewer is read-only
  in intent, so any mutation is an alarm. The executor exists to mutate — the
  question is *what*. The runner fingerprints the tree before and after and
  appends a `TREE AUDIT`: every changed source path listed, generated
  build/engine churn counted separately (same allowlist as the integrity
  check), a moved HEAD called out. The report's CHANGES section becomes a
  checkable claim — on the failure path too, where the audit is precisely the
  debris inventory the Director needs.
- **Git isolation that carries identity.** The review lane's scratch git
  config silences the sandboxed `unable to access .../git/ignore` noise, but
  dropping the global config also drops `user.name`/`user.email` — and an
  executor whose order says "checkpoint-commit each part" would fail every
  commit with "Please tell me who you are". The exec runner copies the user's
  identity into the scratch config.

Review pairing inverts for codex-authored changes, and the protocol says so
(§2): the Opus `reviewer` is already cross-vendor relative to an OpenAI author,
so such changes take the default reviewer — the add-a-`reviewer-codex`-pass
convention on heavy orders exists precisely because author and reviewer would
otherwise share a vendor, which no longer holds there.

Tested like the review lane: `tests/exec-lane.test.js` (53 checks against the
same stub Codex, extended to report sandbox, config overrides, git identity,
and brief markers, and to model an engine that mutates the tree and then dies),
in CI on all three platforms.

**Carried over from 1.5.0's fix, because both lanes drive one Codex install.**
The helper that cost the review lane six days — `codex-windows-sandbox-setup.exe`,
resolved by NAME, so a copy one directory too deep is no copy at all — fails the
execution lane the same silent way: the sandbox is never established and the
engine runs, exits, and changes nothing. The exec runner therefore prepends the
resolved install directory to the engine's `PATH` exactly as the review runner
does (asserted in the suite, including that an already-leading directory is not
prepended twice), and its failure paths name
`node .claude/hooks/orchestra-review.js --doctor` — the one install check, shared
by both lanes — where an engine that produced nothing is the symptom. The doctor
itself stays in the review runner rather than being duplicated: two copies of an
install check are two things to drift.
## 1.5.0 — a helper file that is present, but one directory too deep

The cross-vendor review lane was dead from 2026-08-12 to 08-18 and said nothing.
Every runner-mediated review launched, ran, and returned no verdict; the
preflight reported the install as healthy each time. The cause was one file: an
earlier repair session had put `codex-windows-sandbox-setup.exe` **inside**
`codex-resources\` instead of directly beside `codex.exe`. Codex resolves that
helper by name, so a copy one directory down is not a copy at all — the sandbox
was never established, and the reviews no-opped. One file copy fixed it.

Three separate things had to be true for six days of silence:

1. The helper-sibling list did not name the file. It checked
   `codex-command-runner.exe` and `codex-resources`, found both, and said so.
2. The presence check asked `existsSync(installDir + name)` — the right
   question, asked only of names nobody had thought to add.
3. Nothing looked *inside* the install. A misplaced copy is the easiest repair
   there is (it is the right version, already on the machine), and it was the
   one place the search never went.

So: `codex-windows-sandbox-setup.exe` joins the Windows default sibling list;
the search for a known-good copy now covers the install's own subdirectories
first and reports a find there as `was MISPLACED inside the install at <dir>`
rather than as a restore; a *directory* named `something.exe` no longer counts
as the executable; the install directory is prepended to the engine's `PATH`,
because not every Codex helper resolves relative to the binary; and where an
absence has a specific known consequence, the report states it instead of
listing one more filename.

**`--doctor`.** All of that was already reachable only by running a whole
review. `node .claude/hooks/orchestra-review.js --doctor` runs the same
inspection alone — no work order, no engine launch — repairs what it can, prints
the exact copy command for what it cannot, and exits non-zero when a review
would not find a complete install. It shares one code path with the review
preflight on purpose: a doctor that checks something other than what the review
checks is a second opinion about the wrong install.

**Carried in with the install.** A pack may now declare a `selfCheck` in its
`pack.json`, which the installer runs and prints at the end of an install. The
`codex` pack declares `--doctor`, so a broken Codex install is reported at the
moment the person is already reading the output, next to the instructions for
fixing it — rather than days later, as a review that returns nothing.

Tests: 96 → 108 checks. The new case reproduces the failure first (a sibling
list that omits the sandbox helper calls the broken install healthy) before
proving the fix, per the suite's rule that a checker which cannot fail is
decoration.

## 1.4.1 — a subagent may not end its turn on a running process

Two rounds stalled the same way on 2026-08-16: an agent launched a run in the
background, then ended its turn saying it would report back when the run
finished. Nothing reported back. Subagents have no notification-based revival —
no timer, no background-task completion, no message restarts one — so a stopped
subagent stays stopped until a human notices the round never returned. Both
runs completed fine; their results reached nobody.

The defect is narrower than "backgrounding". Backgrounding plus polling in-turn
is correct, and above the shell tool's 600000 ms maximum it is the only method
that works for the review and deep-plan runners. Backgrounding plus *ending the
turn* is the trap — and a completion-notification affordance is what makes
ending the turn feel safe.

So the rule is drawn at the turn boundary, in every profile that runs commands
(`executor`, `executor-heavy`, `executor-heavy-xhigh`, `reviewer`, the
specialist template and `modeler`, and both cross-vendor launchers): never end
your turn while a process you started is still running — poll it in-turn until
it resolves, or kill it and report what ran. It is written to cover the case no
hook can catch, because the agent never chose it: a foreground command the
harness promotes to a background task on timeout is also a running process you
started.

The protocol (§2) states the underlying fact for the Director, which sees this
failure first and can act on it immediately: a report that promises a later
report is a finished round — re-dispatch the order rather than wait on it.

## 1.4.0 — cross-vendor review lane: attribution, retry, and honest signals

Prompted by a live gate on 2026-08-12 (Windows 11, codex-cli ≥ 0.147.0, harness
v1.3.0). The v1.3.0 fixes held — the pinned worktree materialized, the briefs
survived, the lane produced a high-quality verdict — but it took two attempts,
and everything the round exposed was about what the runner *said* rather than
what it did.

### A failure now names its own cause

Attempt 1 ended as `codex exec` exit **143** with no verdict, under a DETAIL
block listing generic causes (auth / flags / sandbox / missing install files),
none of which had ended the process. The one thing the runner could have known
for certain — whether its OWN timeout timer sent the kill — it never said.

On any exit without a verdict, the report now states who killed it (the runner's
own timer, an external signal, or codex choosing to exit — node reports its own
timeout, so this is never a guess), how long the child ran against the cap it
was given, and the tail of codex's stderr, stdout, and any session log written
during that attempt. The generic cause list survives in exactly one place: a
self-chosen non-zero exit, where it is a live hypothesis rather than a shrug.

### Retry is the runner's job, and the chain is one outcome

Attempt 2 succeeded — but as an *emergent launcher behavior*, so the Director
received two task reports for one review: a final-sounding `REVIEW_UNAVAILABLE`,
the books correctly closed on the lane per §5, and then a real verdict for the
same change.

The runner now retries internally: one extra attempt (`reviewRetries`, max 3) in
a fresh scratch directory and a fresh checkout, for failures that could
plausibly differ — a signal kill, a launch that produced nothing. A
runner-enforced timeout is deliberately *not* retried. The whole chain prints as
ONE report (`ATTEMPT CHAIN: 2 attempts, ONE outcome`), the failed attempt's
diagnostics are preserved under `ATTEMPT LOG` even when a later attempt
succeeded, and `REVIEW_UNAVAILABLE` is emitted only once the chain is exhausted
— carrying an explicit `FINALITY:` line. Launcher profiles now forbid
relaunching the runner at all, with one narrow exception for a Bash call that
never started it.

### Preflight: probe, layout, helper siblings

- **Stage-a auth/exec probe** (`authProbe`, on by default): a cheap `codex exec`
  echo under a short cap, before the real attempt. An unauthenticated install or
  an unusable model now costs seconds instead of a 30-minute budget, and the
  report says the review was never attempted. A probe that merely times out is a
  warning, not a refusal. This check previously lived in Director briefs and
  memory checklists — a checklist item every caller must remember is a runner
  feature that has not been written yet.
- **Install-layout detection.** Codex relocated itself from
  `~/.codex/packages/standalone/current/bin` to
  `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>`, which silently invalidated the
  documented repair recipe. Both layouts are detected and named in the
  preflight, so the next relocation is visible in the first report that hits it.
- **Helper-sibling verification.** The files that must sit next to the resolved
  binary are checked every run and repaired from any locatable known-good copy
  (`helpersDir`, a sibling version directory the self-update left behind, or the
  other known layout). When repair is impossible the report names the exact
  missing files and every directory searched. It stays a loud warning rather
  than a hard stop by default: whether the new layout needs those files at all
  is unverified upstream. `requireHelperSiblings: true` makes it fatal.

### The integrity warning means something again

The successful verdict carried `⚠ INTEGRITY WARNING` because Godot's first
import inside the fresh worktree rewrote 180+ `*.import` sidecars — engine
churn, indistinguishable from reviewer mutation to a whole-fingerprint
comparison, and guaranteed to fire on every Godot project's first run. A warning
that cries wolf teaches its reader to skip it.

The delta is now compared per path and split: generated build/engine artifacts
(built-in list, extended by `integrityIgnore`, dropped by
`integrityIgnoreDefaults: false`) become a counted `INTEGRITY NOTE`; anything
else is the `⚠ INTEGRITY WARNING`, listing the offending paths instead of
dumping two whole fingerprints. `worktreeWarmupCmd` fixes the class outright by
taking the baseline *after* an engine's first-open import — in the pinned
throwaway checkout only, because a warmup writes and a live-tree review must
not write into the tree it is reviewing.

### A configured scratch root is honoured or refused, never swapped

`makeScratchDir` used to fall back to the OS temp dir whenever the configured
root was unwritable — quietly undoing the setting, and resurrecting the
cross-run brief collisions that `worktreeRoot` exists to prevent. A root the
user set (flag, env, or `orchestra.json`) is now mandatory: unwritable means the
review fails, with the `mkdir` error attached. Only the built-in default may
walk the candidate list, and it says so loudly when it does.

### The test suite can no longer pass by not running

`tests/review-lane.test.js` exited 0 on Windows even with failing cases: its
verdict was printed from a callback deep inside an async chain, so a throw, a
rejection, or a step that never fired let node drain its event loop and exit 0.
The suite is now one linear `await` chain, a failure sets `process.exitCode`
immediately, an `exit` handler enforces it, and a run that recorded no cases at
all fails on that basis. 96 checks, including new coverage for every item above:
attribution wording for signal-class vs runner-enforced kills, the retry chain
(fail-then-succeed, and both-fail), the probe, layout detection and helper
repair from a sibling version, integrity classification, warmup ordering and its
refusal to run in a live tree, and the mandatory scratch root.

### CI

`.github/workflows/test.yml` runs the suite on Linux, Windows, and macOS across
Node 20/22/24, for every push and pull request. Windows is the reason it exists:
every field failure in this lane has happened there, the exit-code bug above hid
there, and no session working on this repo has a Windows machine. There is no
CD: the harness ships by `git pull` + `node install.js`.

**It found four runner defects in its first hour**, none of which any amount of
Linux testing would have surfaced:

1. **Windows could not launch the documented install at all.** Node has refused
   to spawn `.cmd`/`.bat` directly since the BatBadBut fix (CVE-2024-27980) —
   and on Windows a `codex` installed through npm IS a `.cmd` shim, which is
   exactly what this runner's own PATH resolution finds first (`whichSync`
   searches `PATHEXT`, and `PATHEXT` lists `.CMD`). Engine launches now route
   those through `cmd.exe` with each argument quoted individually — not
   `shell: true`, which does not quote and would split the first path
   containing a space.
2. **"Scratch must be outside the repository" did not hold wherever the repo
   path contains a symlink or a short name.** git reports resolved paths; the
   runner built its own from unresolved ones. macOS reports `/private/var/…`
   against a held `/var/…`; Windows reports the 8.3 `C:\Users\RUNNER~1\…`
   against a realpath'd `C:\Users\runneradmin\…`. A directory plainly inside
   the repository compared as outside, and the review would have materialized
   its worktree into the tree under review — the exact condition pinned mode
   exists to remove. The check now runs `rev-parse --show-toplevel` from BOTH
   locations and compares git's two answers, which are in the same form by
   construction.
3. **The refusal wrote first and objected afterwards.** A configured scratch
   root inside the repo was created, THEN refused, leaving the directory behind
   as precisely the session dirt it was objecting to. Configured roots are now
   validated before anything is created in them.
4. **The orphan sweep under-reported its own work.** It counted only successful
   directory deletions — but a killed runner's engine child outlives it with
   the worktree as its working directory, which on Windows locks that directory
   against deletion. The sweep cleaned up and reported `reclaimed 0`. It now
   counts what it found and acted on, and names separately anything the
   filesystem would not release.

Two platform truths the matrix also forced into the open, now asserted rather
than assumed: Windows cannot `CreateProcess` a `.js` file (so the tests hand the
runner a `.cmd` shim for the stub engine), and `kill('SIGTERM')` there is
`TerminateProcess`, which runs no handler — so on Windows the next run's sweep
is the *only* thing that ever reclaims an orphaned worktree, and the runner's
signal handlers are decorative. One test's negative control (git complaining
about an unreadable global config path with isolation off) does not reproduce
under Git for Windows; rather than fail the runner for its platform's
diagnostics, or let a silent pass imply a proof that did not happen, it reports
itself INCONCLUSIVE by name there and still proves itself on Linux and macOS.

`ORCHESTRA_CODEX_HELPER_SIBLINGS` was added alongside, for config symmetry —
every other `codex` setting already had an environment form, and a machine whose
Codex install legitimately differs should not need an edit to a project's
committed config.

### Scope

Codex-internal faults are not patched here — see "What this harness cannot fix"
in `packs/codex/README.md`, which pairs each upstream behaviour with the
harness's mitigation and says plainly what remains unverified.
`packs/codex/FIELD-VALIDATION.md` is the checklist the next gate-class review
runs to confirm this round landed.

## 1.3.0 — cross-vendor review lane hardening

Prompted by a live gate on 2026-08-11: a 2-file, 9-line docs diff, reviewed at
`--tier inert --no-tests --timeout-ms 300000` against codex-cli 0.146.0 on
Windows. Two attempts, no verdict. Everything below is one of the two root
causes or a consequence of them.

### The review runs in a clean checkout of the pinned commit

`packs/codex/hooks/orchestra-review.js` gains `--base-ref`, `--head-ref`, and
`--worktree-root`. With `--head-ref`, the runner materializes that commit as a
detached git worktree under a scratch root **outside the repository** and
points the engine there.

The failing attempt had the engine exploring the author's live tree: ~30
untracked `.claude/plans/` files and 10 modified tracked files sitting on top
of the commit it was told to review. Every lookup of a session-created file
returned `fatal: path '.claude/plans/toon-conversion-campaign.md' exists on
disk, but not in '97a5c05'`. That is not a discrepancy an agent can resolve or
dismiss — the commit and the filesystem are simply making incompatible claims —
and it spent the whole budget on it. A clean checkout removes the contradiction
instead of asking the model to tolerate it.

- The scratch root is never the repo: an earlier attempt at this fix (2026-08-08)
  died on `mkdir: Permission denied` in the repo cwd under the reviewer's
  sandbox, and a worktree inside the tree under review is itself session dirt.
  Default is the OS temp dir; `worktreeRoot` / `--worktree-root` overrides, and
  an unwritable root falls back rather than failing the review.
- Teardown is guaranteed on the normal, thrown, and signalled paths, and each
  run sweeps worktrees orphaned by a `SIGKILL` that ran no handler — identified
  by an owner-pid stamp, so a concurrent review's worktree is never touched.
- The idle precheck is skipped when pinned: a checked-out commit cannot move.
- An unresolvable `--head-ref` is `REVIEW_UNAVAILABLE`, never a silent fallback
  to the live tree.
- The verdict header records which tree produced it (`checkout: pinned worktree
  @ <sha>` / `checkout: live working tree`).

Uncommitted work still reviews live — there, the working tree *is* the artifact.

### Inert reviews carry a 600000 ms floor

"It's only docs, it'll take seconds" is a reasonable-sounding belief that is
false about this engine: it explores before it concludes, and that pass does
not shrink with the diff. The tier narrows what must be *verified*, not how long
looking takes. A cap below the floor is raised when it came from a launcher flag
or the built-in default, and the header says so; a cap set in `orchestra.json`
or the environment is the user's call and is honoured as written, with a warning.

### Git config isolation

The failing run also emitted `warning: unable to access
'C:\Users\maxtl/.config/git/ignore': Permission denied` on every git command —
the sandboxed user cannot read the host's global git config path. Noise, but an
agentic reviewer treats noise as a lead. Every git the review touches, the
runner's own and the engine's, now runs against a scratch global config
(`GIT_CONFIG_GLOBAL` + `GIT_CONFIG_NOSYSTEM`, with `core.excludesFile` and
`core.attributesFile` named explicitly, since leaving them unset is what makes
git probe `$HOME/.config/git/ignore` in the first place). Off via
`gitConfigIsolation: false`.

### A failed review no longer wears the engine's name

Both runners printed the same header on the success and failure paths, so a
`REVIEW_UNAVAILABLE` block arrived under `REVIEW ENGINE: OpenAI via Codex CLI
(…)`. Launchers relaying it read the header as provenance and reported fallback
verdicts as cross-vendor ones. Failure paths now read `REVIEW ENGINE: NONE` /
`DEEP-PLAN ENGINE: NONE`, with the settings preserved under `ATTEMPTED:` as
diagnostics rather than a byline.

### Launcher profiles carry mechanical launch tables

Attempt 1 never reached the engine at all: the profile said "background launch"
in prose, the Haiku launcher ran the runner in the foreground, and the shell
tool's 120-second default timeout killed it — with a 300-second runner cap that
never got a chance to apply. Prose fails. `reviewer-codex.md` and
`planner-gpt.md` now carry:

- a launch table keyed on the runner's cap — background launch with
  output-file polling above 500000 ms (which every inert review and every
  default cap now is), foreground with an explicitly-set tool `timeout`
  parameter below it;
- derived output paths (`node -p`, not `mktemp`) so the polling call can find
  the file the launch call wrote;
- instructions to pin `CODEX_BIN` to the real install path inline, since PATH
  resolution through the Windows junction shim is unreliable;
- a bounded-bet rule: two launches per gate, then report the failure and let
  the Director fall back — a third attempt spends a round to learn nothing.

### Tests

New `tests/review-lane.test.js` (master-only; never stamped into projects), run
with `node tests/review-lane.test.js`. It drives the real runner against a stub
Codex that reports what the engine *saw*, and checks each fix twice — once
showing the failure mode reproduces, once showing it is gone. Teardown is
proven after a successful review, after `SIGTERM`, and after `SIGKILL`.

## 1.2.0 and earlier

Not recorded here; this file starts at 1.3.0. `git log` is the record for
earlier versions.
