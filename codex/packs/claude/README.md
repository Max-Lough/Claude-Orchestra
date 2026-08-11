# Claude pack (Codex-native harness) — the cross-vendor (Anthropic) interface

The Codex-side mirror of the [`packs/codex`](../../../packs/codex/) pack: when
**Codex CLI is the Director**, this bundle adds the Claude-backed half —
cross-vendor code review through the Claude CLI, and a Claude counterpart for
the `ultra-plan` two-model planning roundabout.

```bash
node install-codex.js /path/to/project --packs claude
```

Without it, the Codex-native harness is OpenAI-only: reviews run on the
fresh-context GPT-5.6 Sol `reviewer`, and there is no planning counterpart.
Nothing degrades — the cross-vendor *layer* is simply absent.

## What it installs

| File | Role |
|---|---|
| `agents/reviewer-claude.toml` | Thin GPT-5.6 Luna launcher; drives the review runner and relays the Claude verdict verbatim. Never reviews the code itself. |
| `agents/planner-claude.toml` | Thin GPT-5.6 Luna launcher for the `ultra-plan` roundabout; relays the counterpart's critique verbatim. |
| `hooks/orchestra-review.js` | Review runner — builds the adversarial brief, drives an isolated `claude --print` session, prints an Orchestra-format verdict. |
| `hooks/orchestra-ultraplan.js` | Ultra-plan runner — sends the standing plan + round brief to an isolated `claude --print` session (no repository access). |

## Setup

Install the [Claude CLI](https://docs.claude.com/en/docs/claude-code) and
authenticate it (`claude auth`, or export `ANTHROPIC_API_KEY`). Then select the
engine in `.codex/orchestra.json`:

```json
{ "reviewEngine": "claude" }
```

`"codex"` (default) · `"claude"` (cross-vendor primary, native `reviewer` as
fallback) · `"dual"` (both, Director arbitrates).

Recommended pin for review: `ORCHESTRA_CLAUDE_REVIEW_MODEL=opus`.

## Environment reference

| Variable | Default | Purpose |
|---|---|---|
| `ORCHESTRA_CLAUDE_REVIEW_MODEL` | `opus` | Claude model for `reviewer-claude`. |
| `ORCHESTRA_CLAUDE_REVIEW_EFFORT` | `high` | Reasoning effort for review. |
| `ORCHESTRA_CLAUDE_REVIEW_TIMEOUT_MS` | `900000` | Wall-clock cap for a review (it runs your tests). |
| `ORCHESTRA_CLAUDE_PLAN_MODEL` | `fable` | Claude model for the `ultra-plan` counterpart (`--model` overrides per call). |
| `ORCHESTRA_CLAUDE_PLAN_EFFORT` | `max` | Reasoning effort for planning (`--effort` overrides per call). |
| `ORCHESTRA_CLAUDE_PLAN_TIMEOUT_MS` | `900000` | Wall-clock cap per planning consultation. |
| `CLAUDE_BIN` | `claude` | Claude executable path. |

## How it works

Both runners launch the Claude CLI as an isolated `--print --safe-mode
--no-session-persistence` session — no project config, no memory, no
persisted history — and relay its stdout. The review runner (`reviewer-claude`)
grants `Bash,Read,Grep,Glob` so it can independently read the diff and re-run
verification; the plan runner (`planner-claude`) grants no tools at all — the
counterpart judges the brief and plan text alone, with no repository access.

`orchestra-review.js` samples `git status` before and after the run; if the
tree moved, the verdict is prefixed with an `⚠ INTEGRITY WARNING` rather than
silently trusted.

## Graceful degradation

If the Claude CLI is missing, unauthenticated, times out, or returns no
parseable `VERDICT: APPROVE|REVISE`, the runners print `VERDICT:
REVIEW_UNAVAILABLE` / `VERDICT: ULTRAPLAN_UNAVAILABLE` with a `DETAIL` and
`NEXT` block — never a fake approval. Route review to the native `reviewer`;
ultra-plan proceeds solo, marked as not cross-examined.

## Known gap vs. the `codex` pack

This runner is an earlier, simpler generation than
[`packs/codex/hooks/orchestra-review.js`](../../../packs/codex/hooks/orchestra-review.js)
on the Claude-Director side — it does not yet have that runner's `doNotRun`
command prohibitions, idle-precheck, helper-restore, or a `.codex/orchestra.json`
`claude` config block (only environment variables). Porting that hardening is
tracked as follow-up work, not done in this initial port.
