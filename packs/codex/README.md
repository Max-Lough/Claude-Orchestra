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
| `hooks/orchestra-review.js` | Review runner — builds the adversarial brief, drives `codex exec` in a sandbox, prints an Orchestra-format verdict. |
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

## Reliability machinery

Four failure modes cost real review rounds in the field. Each is now handled by
the runner mechanically rather than by hoping the launcher remembers:

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
| `ORCHESTRA_REVIEW_IDLE_MS` | `1500` | Idle-precheck settle window; `0` disables. |
| `ORCHESTRA_CODEX_HELPERS` | — | Helper-restore source directory. |
| `ORCHESTRA_REVIEW_ARGS` | — | Extra args appended to `codex exec`. |
| `CODEX_BIN` | `codex` | Codex executable path. |
| `ORCHESTRA_DEEPPLAN_MODEL` | `gpt-5.6-sol` | Deep-plan counterpart model. |
| `ORCHESTRA_DEEPPLAN_EFFORT` | `max` | Deep-plan reasoning effort. |
| `ORCHESTRA_DEEPPLAN_TIMEOUT_MS` | `900000` | Deep-plan wall-clock cap. |
| `ORCHESTRA_DEEPPLAN_MAX_TOKENS` | `64000` | `max_output_tokens` (includes reasoning). |
| `OPENAI_API_KEY` | — | Required by deep-plan; one of two auth options for review. |
| `OPENAI_BASE_URL` | `https://api.openai.com` | Alternate endpoint for deep-plan. |
