# Changelog

Versions follow the rule in the README's "Versioning" section: **patch** for
fixes and doc-only changes, **minor** for new capabilities, **major** for
breaking changes to the protocol or the `orchestra.json` format. The version
lives in [`VERSION`](VERSION) and is stamped into every project the installer
touches.

Entries name the failure that prompted the change. A harness that only records
*what* it changed teaches nobody why the old way looked reasonable.

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
