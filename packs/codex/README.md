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
    "doNotRun": ["godot", "*.exe --headless"]
  }
}
```

| Key | Effect |
|---|---|
| `reviewTimeoutMs` | Wall-clock cap. Reviews that run a real suite need far more than the 10-minute default. |
| `reviewModel` / `reviewSandbox` | Same as `ORCHESTRA_REVIEW_MODEL` / `ORCHESTRA_REVIEW_SANDBOX`. |
| `helpersDir` | A directory of known-good files mirrored into the Codex install directory before each run (see "Helper restore"). |
| `doNotRun` | Commands the reviewer is forbidden to execute. Injected into the brief as a hard prohibition. |
| `worktreeRoot` | Where a pinned review materializes its throwaway worktree (default: the OS temp dir). Must be writable and outside the repository. |
| `gitConfigIsolation` | `true` by default; set `false` to let the review use your real global git config. |

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

## Environment reference

| Variable | Default | Purpose |
|---|---|---|
| `ORCHESTRA_REVIEW_MODEL` | Codex's default | Pin the OpenAI review model. |
| `ORCHESTRA_REVIEW_SANDBOX` | `workspace-write` | Codex sandbox; `read-only` forbids writes but blocks most test runners. |
| `ORCHESTRA_REVIEW_TIMEOUT_MS` | `600000` | Wall-clock cap. |
| `ORCHESTRA_REVIEW_IDLE_MS` | `1500` | Idle-precheck settle window; `0` disables. Live-tree reviews only. |
| `ORCHESTRA_REVIEW_WORKTREE_ROOT` | OS temp dir | Scratch root for a pinned review's worktree. |
| `ORCHESTRA_REVIEW_GIT_ISOLATION` | `1` | Isolate git's global config for the review; `0` disables. |
| `ORCHESTRA_CODEX_HELPERS` | — | Helper-restore source directory. |
| `ORCHESTRA_REVIEW_ARGS` | — | Extra args appended to `codex exec`. |
| `CODEX_BIN` | `codex` | Codex executable path. |
| `ORCHESTRA_DEEPPLAN_MODEL` | `gpt-5.6-sol` | Deep-plan counterpart model. |
| `ORCHESTRA_DEEPPLAN_EFFORT` | `max` | Deep-plan reasoning effort. |
| `ORCHESTRA_DEEPPLAN_TIMEOUT_MS` | `900000` | Deep-plan wall-clock cap. |
| `ORCHESTRA_DEEPPLAN_MAX_TOKENS` | `64000` | `max_output_tokens` (includes reasoning). |
| `OPENAI_API_KEY` | — | Required by deep-plan; one of two auth options for review. |
| `OPENAI_BASE_URL` | `https://api.openai.com` | Alternate endpoint for deep-plan. |
