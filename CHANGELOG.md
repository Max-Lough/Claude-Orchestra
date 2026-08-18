# Changelog

Versions follow the rule in the README's "Versioning" section: **patch** for
fixes and doc-only changes, **minor** for new capabilities, **major** for
breaking changes to the protocol or the `orchestra.json` format. The version
lives in [`VERSION`](VERSION) and is stamped into every project the installer
touches.

Entries name the failure that prompted the change. A harness that only records
*what* it changed teaches nobody why the old way looked reasonable.

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
