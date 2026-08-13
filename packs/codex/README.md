# Codex pack — the cross-vendor (OpenAI) interface

Everything in the Orchestra that talks to OpenAI, in one optional bundle.

```bash
node install.js /path/to/project --packs codex
```

Without it, the harness is Claude-only: reviews run on the fresh-context Opus
`reviewer`, and `/deep-plan` does not exist. Nothing degrades — the cross-vendor
*layer* is simply absent.

## What it installs

| File | Role |
|---|---|
| `agents/reviewer-codex.md` | Thin Haiku launcher; drives the review runner and relays the OpenAI verdict verbatim. Never reviews the code itself. |
| `agents/planner-gpt.md` | Thin Haiku launcher for the `/deep-plan` roundabout; relays the counterpart's critique verbatim. |
| `hooks/orchestra-review.js` | Review runner — builds the adversarial brief, drives `codex exec` in a sandbox (optionally in a clean worktree pinned to the commit under review), prints an Orchestra-format verdict. |
| `hooks/orchestra-deepplan.js` | Deep-plan runner — sends plan + brief to the OpenAI Responses API. |
| `skills/deep-plan/` | The `/deep-plan` two-model planning roundabout. |

## Setup

**Review** (`reviewer-codex`): install the [Codex CLI](https://developers.openai.com/codex/)
and authenticate it — either `codex login` or export `OPENAI_API_KEY`. Then
select the engine in `.claude/orchestra.json`:

```json
{ "reviewEngine": "codex" }
```

`"opus"` (default) · `"codex"` (cross-vendor primary, Opus as fallback) ·
`"dual"` (both, Director arbitrates).

**Deep-plan** (`planner-gpt`): export `OPENAI_API_KEY`. The Responses API is
called directly — the Codex CLI is not involved.

Recommended pin for review: `ORCHESTRA_REVIEW_MODEL=gpt-5.6-sol`.

## Project configuration

Per-project settings live under a `codex` key in `.claude/orchestra.json`, so
they persist across sessions instead of being re-stated in every work order.
Environment variables override the file; explicit runner flags override both.

```json
{
  "reviewEngine": "codex",
  "codex": {
    "reviewTimeoutMs": 1800000,
    "reviewModel": "gpt-5.6-sol",
    "reviewSandbox": "workspace-write",
    "helpersDir": "C:/tools/codex-helpers",
    "worktreeRoot": "C:/tmp/orchestra-review",
    "doNotRun": ["godot", "*.exe --headless"],
    "worktreeWarmupCmd": "godot --headless --import",
    "integrityIgnore": ["*.import", ".godot/"]
  }
}
```

| Key | Effect |
|---|---|
| `reviewTimeoutMs` | Wall-clock cap. Reviews that run a real suite need far more than the 10-minute default. |
| `reviewModel` / `reviewSandbox` | Same as `ORCHESTRA_REVIEW_MODEL` / `ORCHESTRA_REVIEW_SANDBOX`. |
| `helpersDir` | A directory of known-good files mirrored into the Codex install directory before each run (see "Helper restore"). |
| `doNotRun` | Commands the reviewer is forbidden to execute. Injected into the brief as a hard prohibition. |
| `worktreeRoot` | Where a pinned review materializes its throwaway worktree (default: the OS temp dir). Must be writable and outside the repository — and if you set it and it is not writable, the review **fails** rather than quietly using somewhere else. |
| `gitConfigIsolation` | `true` by default; set `false` to let the review use your real global git config. |
| `reviewRetries` | Extra attempts after a failure that might go differently (default `1`, max `3`). Each retry gets a fresh checkout; the chain reports as one outcome. |
| `authProbe` / `probeTimeoutMs` | The stage-a `codex exec` echo run before the real attempt (default on, 90 s). A dead or unauthenticated install then costs seconds, not a review budget. |
| `worktreeWarmupCmd` / `worktreeWarmupTimeoutMs` | Command run inside the fresh checkout *before* the integrity baseline is taken (default none, 5-minute cap). For engines that import assets on first open. |
| `integrityIgnore` / `integrityIgnoreDefaults` | Paths that are expected build/engine churn, added to (or replacing) the built-in list of generated-artifact paths. |
| `helperSiblings` / `requireHelperSiblings` | Files the Codex install must carry next to its executable (default on Windows: `codex-command-runner.exe`, `codex-resources`). Verified every run; repaired where a known-good copy is locatable; `requireHelperSiblings: true` makes a missing one a hard stop. |

## Reliability machinery

Every item here cost a real review round in the field. Each is now handled
mechanically rather than by hoping the launcher remembers:

**Pinned, clean-checkout review.** When the change is committed, the launcher
passes `--base-ref`/`--head-ref` and the runner checks that commit out into a
throwaway worktree **outside the repository**, pointing the engine there. A
Claude session leaves its own debris in the tree, and an engine handed a pinned
SHA plus a tree that moved past it spends the whole budget on
`fatal: path '…' exists on disk, but not in <sha>` — a contradiction it cannot
resolve. Teardown is guaranteed on every exit path, and each run sweeps
worktrees orphaned by a hard kill. The header names the checkout that produced
the verdict. Uncommitted work still reviews live.

**Inert timeout floor.** An inert tier narrows what must be *verified*, not how
long the engine takes to explore — a 9-line docs diff is still minutes. Inert
reviews are floored at `600000` ms when the cap came from a launcher flag or the
default; a cap you set yourself is honoured and flagged.

**Git config isolation.** A sandboxed process often cannot read the user's
global git config, and git then complains on *every* invocation. The runner
points its own git and the engine's at a scratch config instead.

**Honest failure headers.** `REVIEW_UNAVAILABLE` prints under
`REVIEW ENGINE: NONE`, never under the engine's name — a header is an
attribution, and launchers have misreported fallback verdicts as cross-vendor
ones on the strength of the old one.

**Real-path resolution.** `CODEX_BIN` pointing at a symlink or Windows junction
(the usual `AppData` shim) breaks Codex's own sibling-file resolution — it looks
for its helpers next to the *link*, not the install. The runner resolves the
binary to its real path before spawning, so a junction works like the real
thing. The resolved path is stamped into the review header.

**Helper restore.** A Codex self-update can silently remove files a working
install needs. Point `helpersDir` (or `ORCHESTRA_CODEX_HELPERS`) at a directory
holding known-good copies; before each run the runner mirrors anything missing
from the Codex install directory and reports what it restored. No filenames are
hardcoded — the directory you populate defines the repair kit.

**Timeout as a value, not prose.** A work order saying "use a 30-minute timeout"
does nothing; only the config does. Set `codex.reviewTimeoutMs`, or have the
launcher pass `--timeout-ms`. The header prints the cap that was actually
applied, so a prose-only instruction is visibly ignored instead of silently so.

**Hard command prohibition.** "Skip the tests" in the brief gets overridden by
the reviewer's own judgment — it runs them anyway and burns the clock. `--no-tests`
and `doNotRun` emit a PROHIBITED COMMANDS block that forbids execution outright
and requires the affected claims to come back marked `UNVERIFIED (prohibited)`,
so a narrowed review reports itself as narrowed.

**Idle precheck.** A review of a tree that another agent is still writing is
garbage. The runner samples the working tree twice before launching and refuses
with `REVIEW_UNAVAILABLE` if it moved in between. Disable with
`ORCHESTRA_REVIEW_IDLE_MS=0`.

**Failure attribution.** When the engine dies without a verdict, the report says
*who killed it* — the runner's own timer (node reports its own timeout, so this
is never a guess), an external signal, or codex choosing to exit — plus how long
it ran against the cap it was given, and the tail of codex's stderr, stdout, and
whatever session log it wrote during the attempt. A generic "maybe auth, maybe
flags, maybe the sandbox" list is printed only for a self-chosen non-zero exit,
where it is actually a live hypothesis. The field failure it replaces was a bare
`status 143` under a cause list none of which had ended the process.

**Bounded internal retry.** A signal kill or a zero-output launch gets one
automatic retry, in a *fresh* scratch directory and a fresh checkout — and the
whole chain prints as ONE report, headed `ATTEMPT CHAIN: 2 attempts, ONE
outcome`, with the failed attempt's diagnostics preserved under `ATTEMPT LOG`.
`REVIEW_UNAVAILABLE` is emitted only when the chain is exhausted, and carries an
explicit `FINALITY:` line. A runner-enforced timeout is deliberately *not*
retried: a second full-length timeout costs the same clock to learn the same
thing. This replaces launcher-improvised retries, which once delivered a
Director a final-sounding `REVIEW_UNAVAILABLE` and then, later, a real verdict
for the same review.

**Stage-a auth/exec probe.** Before the real attempt, the runner asks codex to
echo a single token under a short cap. An unauthenticated install, an
unavailable model, or a broken binary then fails in seconds instead of after a
30-minute budget — and the report says the review was never attempted. A probe
that merely *times out* is a warning, not a refusal: a slow engine is still a
working engine.

**Install-layout detection and helper-sibling verification.** Codex relocated
itself from `~/.codex/packages/standalone/current/bin` to
`%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>`, which silently invalidated a repair
recipe written for the old layout. The runner now names the layout it found in
the preflight, verifies the helper files that must sit next to the *resolved*
binary, repairs them from any locatable known-good copy (your `helpersDir`, a
sibling version directory left by the self-update, or the other known layout),
and — when it cannot — names exactly which files are missing and exactly where
it looked.

**Integrity warnings that mean something.** The check exists to catch a reviewer
editing source. It used to fire on any tree change at all, so a Godot project's
first import inside a fresh worktree — 180+ `*.import` sidecars rewritten by the
*engine* — raised the same alarm and dumped two whole fingerprints into the
verdict. Now the delta is compared per path and split: generated-artifact churn
(built-in list, extensible via `integrityIgnore`) becomes a counted
`INTEGRITY NOTE`, and anything else is the `⚠ INTEGRITY WARNING`, listing the
offending paths. `worktreeWarmupCmd` fixes the class outright by taking the
baseline *after* the engine's first-open import.

**A configured scratch root is honoured or refused, never swapped.** An
unwritable `worktreeRoot` that you set fails the review, with the mkdir error
attached. Falling back to the temp dir would undo the very setting — and
resurrect the cross-run collisions that setting exists to prevent. Only the
built-in default is allowed to walk down the candidate list, and it says so
loudly when it does.

## Environment reference

| Variable | Default | Purpose |
|---|---|---|
| `ORCHESTRA_REVIEW_MODEL` | Codex's default | Pin the OpenAI review model. |
| `ORCHESTRA_REVIEW_SANDBOX` | `workspace-write` | Codex sandbox; `read-only` forbids writes but blocks most test runners. |
| `ORCHESTRA_REVIEW_TIMEOUT_MS` | `600000` | Wall-clock cap. |
| `ORCHESTRA_REVIEW_IDLE_MS` | `1500` | Idle-precheck settle window; `0` disables. Live-tree reviews only. |
| `ORCHESTRA_REVIEW_WORKTREE_ROOT` | OS temp dir | Scratch root for a pinned review's worktree. Set-and-unwritable is a hard failure. |
| `ORCHESTRA_REVIEW_GIT_ISOLATION` | `1` | Isolate git's global config for the review; `0` disables. |
| `ORCHESTRA_REVIEW_RETRIES` | `1` | Extra attempts after a retryable failure (max 3). |
| `ORCHESTRA_REVIEW_PROBE` | `1` | Stage-a `codex exec` echo before the real attempt; `0` disables. |
| `ORCHESTRA_REVIEW_PROBE_TIMEOUT_MS` | `90000` | Cap for that probe. |
| `ORCHESTRA_REVIEW_WARMUP_CMD` | — | Command run in the checkout before the integrity baseline. |
| `ORCHESTRA_REVIEW_WARMUP_TIMEOUT_MS` | `300000` | Cap for the warmup. |
| `ORCHESTRA_CODEX_HELPERS` | — | Helper-restore source directory. |
| `ORCHESTRA_REVIEW_ARGS` | — | Extra args appended to `codex exec`. |
| `CODEX_BIN` | `codex` | Codex executable path. |
| `ORCHESTRA_DEEPPLAN_MODEL` | `gpt-5.6-sol` | Deep-plan counterpart model. |
| `ORCHESTRA_DEEPPLAN_EFFORT` | `max` | Deep-plan reasoning effort. |
| `ORCHESTRA_DEEPPLAN_TIMEOUT_MS` | `900000` | Deep-plan wall-clock cap. |
| `ORCHESTRA_DEEPPLAN_MAX_TOKENS` | `64000` | `max_output_tokens` (includes reasoning). |
| `OPENAI_API_KEY` | — | Required by deep-plan; one of two auth options for review. |
| `OPENAI_BASE_URL` | `https://api.openai.com` | Alternate endpoint for deep-plan. |

## What this harness cannot fix (upstream, with mitigations)

Some of what the field reports record is not ours. This pack drives `codex-cli`;
it does not patch it, and pretending otherwise would mean shipping workarounds
that quietly rot when upstream changes. Each item below is a fault whose *cause*
lives in the Codex CLI or the model behind it, paired with what the harness does
about the symptom.

| Upstream behaviour | Observed | Harness mitigation |
|---|---|---|
| A self-update can leave the install without files it needs next to the binary. | 2026-08-08 onward, Windows. | Helper-sibling verification + auto-repair from a locatable known-good copy; `helpersDir` as the user-owned repair kit; the exact missing filenames named when repair is impossible. |
| The install relocated to a new layout (`%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>`), invalidating layout-specific advice. | 2026-08-12, codex-cli ≥ 0.147.0. | Both layouts detected and named in the preflight; repair searches sibling version directories and the other layout. **Unverified upstream:** whether the new layout ships or needs `codex-command-runner.exe` / `codex-resources` at all. The check is therefore a loud warning, not a hard stop, unless you set `requireHelperSiblings`. |
| `codex exec` exiting 143 (SIGTERM-class) mid-review with no verdict and nothing on stderr. | 2026-08-12 gate, attempt 1. | Full attribution (the runner proves it was not its own timer), plus one automatic retry in a fresh checkout — which is what produced the verdict that round. If the kill originates *inside* codex, only upstream can fix the cause. |
| The engine explores at length before concluding, so even a trivial diff costs minutes. | Every round. | Timeout floors and honest cap reporting; `doNotRun` / `--no-tests` as hard prohibitions. Not fixable here — it is how the engine works. |
| Model-side flakiness: an occasional run that produces no final message despite exiting 0. | Occasional. | Classified as a zero-output failure and retried once; reported in the `ATTEMPT LOG` either way, so the lane's real reliability stays visible. |

If you hit one of these, the useful action is an upstream issue with the
runner's report attached — it now contains the attribution, the elapsed time
against the cap, the install layout, and the engine's last output, which is most
of what such a report needs.
