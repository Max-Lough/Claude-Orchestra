# Codex pack — the cross-vendor (OpenAI) interface

Everything in the Orchestra that talks to OpenAI, in one optional bundle.

```bash
node install.js /path/to/project --packs codex
```

Without it, the harness is Claude-only: reviews run on the fresh-context Opus
`reviewer`, execution runs on the Claude executors, and `/cross-compare-plan`
does not exist. Nothing degrades — the cross-vendor
*layer* is simply absent.

## What it installs

| File | Role |
|---|---|
| `agents/reviewer-codex.md` | Thin Haiku launcher; calls the `orchestra_review` MCP tool once and relays the OpenAI verdict verbatim. The default independent reviewer for Claude-authored campaign work. Never reviews the code itself. |
| `agents/executor-codex-heavy.md` | Thin Haiku launcher; calls the `orchestra_exec` MCP tool once (OpenAI Sol, high reasoning effort by default) and relays the report + tree audit verbatim. Exceptional orders only — a problem with concrete prior evidence that Anthropic models struggled on it. Never edits anything itself. |
| `agents/architect-codex.md` | Thin Haiku launcher for the `/cross-compare-plan` GPT lane; calls `orchestra_crossplan` once per phase and relays the document's provenance verbatim. Never drafts, critiques, or revises itself. |
| `agents/architect-claude.md` | The `/cross-compare-plan` Claude architect (Fable, fresh context, high effort) — drafts, critiques the rival plan, revises under critique, anonymously, within the brief's ground-truth scope. |
| `agents/architect-claude-xhigh.md` | The same architect at xhigh effort, dispatched when the session runs `effort=xhigh` (both lanes always run one identical effort level). |
| `agents/architect-claude-max.md` | The same architect at max effort — the top rung both vendors expose — dispatched when the session runs `effort=max`. |
| `agents/plan-synthesizer.md` | The `/cross-compare-plan` blind synthesizer (Opus, fresh context) — merges the two revised plans into the final plan, adjudicates disputes against the tree, escalates only genuine ties. |
| `hooks/orchestra-engine-mcp.js` | **The MCP transport** — a zero-dependency stdio MCP server exposing the three runners plus the doctor as typed tools (`orchestra_review`, `orchestra_exec`, `orchestra_crossplan`, `orchestra_doctor`). Registered in the project's root `.mcp.json` by the installer. |
| `hooks/orchestra-review.js` | Review runner — builds the adversarial brief, drives `codex exec` in a sandbox (optionally in a clean worktree pinned to the commit under review), prints an Orchestra-format verdict. |
| `hooks/orchestra-exec.js` | Execution runner — builds the Orchestra executor-law brief, drives `codex exec` in a `workspace-write` sandbox in the LIVE tree, audits which paths actually changed, prints an Orchestra-format executor report. One attempt, never auto-retried. |
| `hooks/orchestra-crossplan.js` | Cross-compare architect runner — drives `codex exec` read-only for one phase (draft / critique / revise), with web search on by default for research symmetry with the Claude lane, saves the produced document under `.claude/plans/cross-compare/`, and enforces the report-integrity nonce and a read-only tree fingerprint. |
| `skills/cross-compare-plan/` | The `/cross-compare-plan` two-architect session — independent drafts, cross-critique, owner revision, blind merge, and (by default) a post-synthesis cross-family audit of the final plan by the GPT lane. |

## The MCP transport

The launchers do not shell out to the runners — they cannot: their `tools:`
frontmatter grants only the lane's MCP tool, no Bash. Each launcher makes
**one blocking tool call** against the `orchestra-engine` server and relays the
result verbatim. The server spawns the runner with real flags, waits out the
whole attempt chain, and returns the runner's stdout as the tool result —
unmodified. Anything the server itself has to say (the runner never launched,
exited non-zero, wrote nothing, or wedged past the kill-backstop) is prefixed
`MCP TRANSPORT ERROR` and flagged, so a transport failure can never be read as
an engine verdict.

This replaced the launcher shell pipeline — scratch files, run tokens,
sentinels, background-and-poll, stdout scraping — that produced the majority
of this pack's recorded field failures (see the 1.10.0 changelog entry). A
blocking MCP call at the full 30-minute review default is measured to hold in
Claude Code, top-level and subagent-nested, with no timeout tuning.

The installer merges the registration into the project's root `.mcp.json`
(other entries preserved) and removes it on deselection or `--uninstall`.
**Approve the project MCP server on first launch** — until it is approved,
the launchers have no tool to call and every cross-vendor lane reports
unavailable. Headless drivers of long calls (`claude -p` in CI or cron)
should set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` or keep the call in the
foreground turn; interactive sessions need nothing.

## Setup

**Review** (`reviewer-codex`): install the [Codex CLI](https://developers.openai.com/codex/)
and authenticate it — either `codex login` or export `OPENAI_API_KEY`. Once
this pack is installed, `reviewer-codex` is the default independent reviewer
for Claude-authored campaign work — no engine selection needed. Codex-authored
work goes to the fresh-context Opus `reviewer` instead, so author and reviewer
always sit on different vendors. If the Sol lane is unavailable, the runner
reports `REVIEW_UNAVAILABLE` and the Director falls back to Opus review with a
loud cross-family-unavailable alarm.

**Execution** (`executor-codex-heavy`): same Codex CLI + auth as review. This
is the exceptional-order executor only — a Director routing decision made at
PLAN time for a problem with concrete prior evidence that Anthropic models
struggled on it, never routine work. The Claude executors (`executor`,
`executor-heavy`) remain the default path for everything else.

**Cross-compare** (`architect-codex` + `architect-claude` + `plan-synthesizer`):
same Codex CLI + auth as review — the GPT architect runs through `codex exec`
in a `read-only` sandbox (hard-pinned; the lane never writes the tree), with
web search enabled by default to match the Claude architects' web tools
(`ORCHESTRA_CROSSPLAN_WEB=0` or `"codex": { "crossplanWeb": false }` turns it
off; either way the brief's GROUND TRUTH grant governs actual use, identically
for both lanes). No engine selection needed: `/cross-compare-plan` dispatches
all three roles itself, including the default post-synthesis audit — one extra
GPT-lane critique of the finished `final-plan.md`.

The Sol reviewer, the exceptional Sol executor, and the Sol cross-compare
architect all default to `gpt-5.6-sol`; review and cross-compare default to
`high` effort, and the exceptional executor defaults to `high` effort as well.

## Checking the install — `--doctor`

```bash
node .claude/hooks/orchestra-review.js --doctor
```

The installer runs this for you when the pack is selected, and it is worth
re-running after any Codex update, the first time a review comes back empty, or
the first time an ordered execution reports it changed nothing. It lives in the
review runner but checks the **install**, which both lanes drive — one check,
not two to keep in step.
It reviews nothing and needs no work order: it resolves the real `codex` binary,
names the install layout, verifies the helper files that must sit **directly
beside** that binary, repairs what it can (including a helper that is present
but one directory too deep), and prints the exact copy command for anything it
cannot. Exit `0` means a review would find a complete install; exit `1` means it
would not, and the output says why.

**Windows, specifically.** Three names must sit directly next to `codex.exe`:
`codex-command-runner.exe`, `codex-resources`, and
`codex-windows-sandbox-setup.exe`. The last one is resolved **by name**, not
relative to the binary, so a copy nested inside `codex-resources\` — the
natural place for a hand repair to put it — is never found. The sandbox is then
never established and reviews return nothing, while every other preflight line
reports a healthy install. That state cost a lane for six days (2026-08-12 →
08-18) and is exactly what `--doctor` exists to make a ten-second question. Both
runners also put the install directory first on the engine's `PATH`, so a
correctly-placed helper is findable however the user's `PATH` is arranged.

**It fails the execution lane the same silent way.** `orchestra-exec.js` drives
the same binary in the same sandbox, so an unestablished sandbox there means an
engine that runs, exits, and changes nothing — an order reported as attempted
with an empty `TREE AUDIT`. The exec runner names `--doctor` on exactly that
failure shape; the launchers relay the line and never run it themselves (it
repairs the install, which is the user's machine and the Director's call).

**Stale sessions are the other silent lie** (2026-08-19: a weeks-old report —
with a matching stale audit — was relayed as `STATUS: DONE` for a brand-new
order). Three defences, layered: every launcher keys its tmp paths and
`ORCHESTRA_RUNNER_DONE` sentinel by a per-launch run token, so a leftover
output file can never satisfy a poll; the exec runner injects a per-run nonce
into the brief and refuses any report that does not echo it on a
`REPORT INTEGRITY` line (or that claims CHANGES against a tree its own
in-process audit measured as untouched); and resume-prone `ORCHESTRA_EXEC_ARGS`
tokens are refused before launch. `--doctor` flags resume-prone env/config and
counts session artifacts; `--doctor --live` proves the nonce round-trip with a
real no-op engine run.

## Project configuration

Per-project settings live under a `codex` key in `.claude/orchestra.json`, so
they persist across sessions instead of being re-stated in every work order.
Environment variables override the file; explicit runner flags override both.

```json
{
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
| `reviewTimeoutMs` | Wall-clock cap. Reviews that run a real suite need far more than the 30-minute default. |
| `reviewModel` / `reviewSandbox` | Same as `ORCHESTRA_REVIEW_MODEL` / `ORCHESTRA_REVIEW_SANDBOX`. |
| `helpersDir` | A directory of known-good files mirrored into the Codex install directory before each run (see "Helper restore"). |
| `doNotRun` | Commands the reviewer is forbidden to execute. Injected into the brief as a hard prohibition. |
| `worktreeRoot` | Where a pinned review materializes its throwaway worktree (default: the OS temp dir). Must be writable and outside the repository — and if you set it and it is not writable, the review **fails** rather than quietly using somewhere else. |
| `gitConfigIsolation` | `true` by default; set `false` to let the review use your real global git config. |
| `reviewRetries` | Extra attempts after a failure that might go differently (default `1`, max `3`). Each retry gets a fresh checkout; the chain reports as one outcome. |
| `authProbe` / `probeTimeoutMs` | The stage-a `codex exec` echo run before the real attempt (default on, 90 s). A dead or unauthenticated install then costs seconds, not a review budget. |
| `worktreeWarmupCmd` / `worktreeWarmupTimeoutMs` | Command run inside the fresh checkout *before* the integrity baseline is taken (default none, 5-minute cap). For engines that import assets on first open. **Pinned reviews only** — it writes, and a live-tree review must not write into the tree it is reviewing. |
| `integrityIgnore` / `integrityIgnoreDefaults` | Paths that are expected build/engine churn, added to (or replacing) the built-in list of generated-artifact paths. |
| `helperSiblings` / `requireHelperSiblings` | Files the Codex install must carry next to its executable (default on Windows: `codex-command-runner.exe`, `codex-resources`, `codex-windows-sandbox-setup.exe`). Verified every run — as files where the name says executable, so a directory of the right name does not pass; repaired where a known-good copy is locatable, including one misplaced inside the install itself; `requireHelperSiblings: true` makes a missing one a hard stop. |

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
binary, repairs them from any locatable known-good copy (your `helpersDir`, the
install's own subdirectories, a sibling version directory left by the
self-update, or the other known layout), and — when it cannot — names exactly
which files are missing and exactly where it looked.

**Present, but misplaced.** The check asks whether the helper is *beside the
binary*, not whether it exists somewhere: a copy sitting one directory down is
not a copy at all for a helper Codex resolves by name. The runner searches the
install's own subdirectories first (a misplaced copy is the right version, and
flattening it up is the whole repair), reports it as `was MISPLACED inside the
install at <dir>` rather than as a restore, and refuses to count a *directory*
named `something.exe` as the executable. Where a specific absence has a specific
consequence — `codex-windows-sandbox-setup.exe` means the sandbox is silently
never set up — the report says so instead of listing one more filename. This is
the 2026-08-18 failure: one file, one directory too deep, six days of reviews
that no-opped while looking healthy.

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
| `ORCHESTRA_REVIEW_MODEL` | `gpt-5.6-sol` | Pin the OpenAI review model; hard default, not "Codex's own default". |
| `ORCHESTRA_REVIEW_SANDBOX` | `workspace-write` | Codex sandbox; `read-only` forbids writes but blocks most test runners. |
| `ORCHESTRA_REVIEW_TIMEOUT_MS` | `1800000` | Wall-clock cap. |
| `ORCHESTRA_REVIEW_IDLE_MS` | `1500` | Idle-precheck settle window; `0` disables. Live-tree reviews only. |
| `ORCHESTRA_REVIEW_WORKTREE_ROOT` | OS temp dir | Scratch root for a pinned review's worktree. Set-and-unwritable is a hard failure. |
| `ORCHESTRA_REVIEW_GIT_ISOLATION` | `1` | Isolate git's global config for the review; `0` disables. |
| `ORCHESTRA_REVIEW_RETRIES` | `1` | Extra attempts after a retryable failure (max 3). |
| `ORCHESTRA_REVIEW_PROBE` | `1` | Stage-a `codex exec` echo before the real attempt; `0` disables. |
| `ORCHESTRA_REVIEW_PROBE_TIMEOUT_MS` | `90000` | Cap for that probe. |
| `ORCHESTRA_REVIEW_WARMUP_CMD` | — | Command run in the checkout before the integrity baseline. |
| `ORCHESTRA_REVIEW_WARMUP_TIMEOUT_MS` | `300000` | Cap for the warmup. |
| `ORCHESTRA_CODEX_HELPERS` | — | Helper-restore source directory. |
| `ORCHESTRA_CODEX_HELPER_SIBLINGS` | Windows: `codex-command-runner.exe,codex-resources,codex-windows-sandbox-setup.exe`; none elsewhere | Comma-separated files the install must carry next to its executable. Empty string expects none. Overrides `helperSiblings` in project config, so a machine whose install legitimately differs needs no committed-config edit. |
| `ORCHESTRA_REVIEW_ARGS` | — | Extra args appended to `codex exec`. |
| `ORCHESTRA_EXEC_HEAVY_MODEL` | `gpt-5.6-sol` | Execution model (`codex.execHeavyModel`) — the sole, exceptional-order executor; the key keeps its existing name. |
| `ORCHESTRA_EXEC_HEAVY_EFFORT` | `high` | Execution reasoning effort (`codex.execHeavyEffort`), sent as `-c model_reasoning_effort=`. |
| `ORCHESTRA_EXEC_TIMEOUT_MS` | `1800000` | Wall-clock cap for an execution run (`codex.execTimeoutMs`; also `--timeout-ms`). It runs your verification — budget a build plus a suite. |
| `ORCHESTRA_EXEC_SANDBOX` | `workspace-write` | Codex sandbox for execution (`codex.execSandbox`). `read-only` = dry run; the runner warns that no edit can land. |
| `ORCHESTRA_EXEC_IDLE_MS` | `1500` | Idle-precheck settle window before executing; `0` disables. Shares `codex.idleMs` with review. |
| `ORCHESTRA_EXEC_GIT_ISOLATION` | `1` | Git-config isolation for the run, with the user's `user.name`/`user.email` copied into the scratch config so ordered commits still work. Shares `codex.gitConfigIsolation`. |
| `ORCHESTRA_EXEC_PROBE` | `1` | Stage-a echo before the real attempt (shares `codex.authProbe` / `probeTimeoutMs`); `ORCHESTRA_EXEC_PROBE_TIMEOUT_MS` caps it. |
| `ORCHESTRA_EXEC_ARGS` | — | Extra args appended to the execution `codex exec`. |
| `CODEX_BIN` | `codex` | Codex executable path (shared by all runners). |
| `ORCHESTRA_CROSSPLAN_MODEL` | `gpt-5.6-sol` | Cross-compare GPT-architect model (`codex.crossplanModel`; also the skill's `model=`). |
| `ORCHESTRA_CROSSPLAN_EFFORT` | `high` | Cross-compare GPT-architect reasoning effort (`codex.crossplanEffort`), sent as `-c model_reasoning_effort=`. The skill's `effort=` overrides per session and routes the Claude lane to the matching tier. |
| `ORCHESTRA_CROSSPLAN_TIMEOUT_MS` | `900000` | Wall-clock cap per cross-compare phase (`codex.crossplanTimeoutMs`; also `--timeout-ms`). |
| `ORCHESTRA_CROSSPLAN_WEB` | `1` | GPT-lane web search, sent as `-c tools.web_search=true` (`codex.crossplanWeb`; also `--no-web`; flag > env > config > default). On by default so both lanes carry the same research capability; whether either lane USES it is governed by the brief's GROUND TRUTH grant. The provenance header prints the setting. |
| `ORCHESTRA_CROSSPLAN_PROBE` | `1` | Stage-a echo before each phase (shares `codex.authProbe` / `probeTimeoutMs`); `ORCHESTRA_CROSSPLAN_PROBE_TIMEOUT_MS` caps it. |
| `ORCHESTRA_CROSSPLAN_ARGS` | — | Extra args appended to the cross-compare `codex exec`. Resume-prone tokens are refused. |
| `OPENAI_API_KEY` | — | One of two auth options for the Codex CLI (the other is `codex login`). |

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
| `codex-windows-sandbox-setup.exe` is resolved by name rather than relative to the binary, so an install whose directory is not on `PATH` cannot find its own sandbox helper — and fails silently rather than saying so. | 2026-08-12 → 08-18, Windows. | The name is in the default sibling list, verified beside the resolved binary, and repaired from a misplaced copy; the install directory is prepended to the engine's `PATH`; `--doctor` answers the question without running a review. The silence itself is upstream. |
| `codex exec` exiting 143 (SIGTERM-class) mid-review with no verdict and nothing on stderr. | 2026-08-12 gate, attempt 1. | Full attribution (the runner proves it was not its own timer), plus one automatic retry in a fresh checkout — which is what produced the verdict that round. If the kill originates *inside* codex, only upstream can fix the cause. |
| The engine explores at length before concluding, so even a trivial diff costs minutes. | Every round. | Timeout floors and honest cap reporting; `doNotRun` / `--no-tests` as hard prohibitions. Not fixable here — it is how the engine works. |
| Model-side flakiness: an occasional run that produces no final message despite exiting 0. | Occasional. | Classified as a zero-output failure and retried once; reported in the `ATTEMPT LOG` either way, so the lane's real reliability stays visible. |

If you hit one of these, the useful action is an upstream issue with the
runner's report attached — it now contains the attribution, the elapsed time
against the cap, the install layout, and the engine's last output, which is most
of what such a report needs.
