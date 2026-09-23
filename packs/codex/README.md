# Codex pack — the cross-vendor (OpenAI) interface

Everything in the Orchestra that talks to OpenAI, in one optional bundle.

```bash
node install.js /path/to/project --packs codex
```

Without it, the harness is Claude-only: reviews run on the fresh-context Opus
`reviewer`, and `/cross-compare-plan` does not exist.

**This pack is no longer purely additive.** Since 3.2.0 its
`executor-codex-principal` (GPT-6 Astra) is the top rung of the harness's
default executor ladder, so installing or removing the pack changes where
escalated work goes. Without the pack the ladder has no top rung: the Director
says so in one line, escalates to the Fable `executor-principal` instead, and
names the substitution in the REPORT — announced, never silent. Review and
cross-compare still degrade to Claude-only exactly as before.

## What it installs

| File | Role |
|---|---|
| `agents/reviewer-codex.md` | Thin Haiku launcher; calls the `orchestra_review` MCP tool once and relays the OpenAI verdict verbatim. The default independent reviewer for Claude-authored campaign work. Never reviews the code itself. |
| `agents/executor-codex-principal.md` | **The top rung of the harness's default executor ladder.** Thin Haiku launcher; calls the `orchestra_exec` MCP tool once with `profile: "principal"` (OpenAI GPT-6 Astra, xhigh reasoning effort by default) and relays the report + tree audit verbatim. Exceptional orders only — many coupled moving parts, an approach the plan cannot settle, or a second bounce at the Opus heavy tier. Never edits anything itself. |
| `agents/executor-codex-heavy.md` | The cheaper cross-vendor executor, **user request only** — no routing rule reaches it. Same launcher shape with `profile: "heavy"` (OpenAI GPT-6 Sol, high reasoning effort by default). Never edits anything itself. |
| `agents/executor-codex-luna.md` | A lighter cross-vendor executor, **user request only** — no routing rule reaches it, `executorEngine` does not select it, and nothing escalates or substitutes into it. Same launcher shape with `profile: "luna"` (OpenAI GPT-6 Luna, xhigh reasoning effort by default). Never edits anything itself. |
| `agents/architect-codex.md` | Thin Haiku launcher for the `/cross-compare-plan` GPT lane; calls `orchestra_crossplan` once per phase and relays the document's provenance verbatim. Never drafts, critiques, or revises itself. |
| `agents/architect-claude-xhigh.md` | The `/cross-compare-plan` Claude architect (Fable, fresh context, xhigh effort — the default tier) — drafts, critiques the rival plan, revises under critique, anonymously, within the brief's ground-truth scope. Both lanes always run one identical effort level. |
| `agents/architect-claude-max.md` | The same architect at max effort — the top rung both vendors expose — dispatched when the session runs `effort=max`. |
| `agents/plan-synthesizer.md` | The `/cross-compare-plan` blind synthesizer (Opus, fresh context) — merges the two revised plans into the final plan, adjudicates disputes against the tree, escalates only genuine ties. |
| `hooks/orchestra-engine-mcp.js` | **The MCP transport** — a zero-dependency stdio MCP server exposing the three runners plus the doctor as typed tools (`orchestra_review`, `orchestra_exec`, `orchestra_crossplan`, `orchestra_doctor`). Registered in the project's root `.mcp.json` by the installer. |
| `hooks/orchestra-review.js` | Review runner — builds the adversarial brief, drives `codex exec` in a sandbox (optionally in a clean worktree pinned to the commit under review), prints an Orchestra-format verdict. |
| `hooks/orchestra-exec.js` | Execution runner — builds the Orchestra executor-law brief, drives `codex exec` in a `workspace-write` sandbox in the LIVE tree, audits which paths actually changed, prints an Orchestra-format executor report. One attempt, never auto-retried. Three rungs behind one `--profile` flag (`heavy`, `principal`, `luna`); they differ only in model and effort. |
| `hooks/orchestra-jobrun.js` | **The process-tree supervisor** — the kill group every lane's engine invocation runs inside (a Windows Job object with `KILL_ON_JOB_CLOSE` and no `BREAKAWAY_OK`; a POSIX process group elsewhere), plus the per-run process census the runners print. Also a standalone CLI, so the guarantee can be demonstrated against a deliberate hang without Codex in the picture. |
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
blocking MCP call at the full 45-minute review default is measured to hold in
Claude Code, top-level and subagent-nested, with no timeout tuning.

The installer merges the registration into the project's root `.mcp.json`
(other entries preserved) and removes it on deselection or `--uninstall`.
**Approve the project MCP server on first launch** — until it is approved,
the launchers have no tool to call and every cross-vendor lane reports
unavailable. Headless drivers of long calls (`claude -p` in CI or cron)
should set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` or keep the call in the
foreground turn; interactive sessions need nothing.

## Setup

**Co-installed Codex-Orchestra.** Review, execution, and cross-compare planning
are external worker sessions, not new Codex-directed campaigns. All three
runners set an explicit external-worker `ORCHESTRA_ROLE` and hard-pin
`features.hooks=false` plus
`project_doc_max_bytes=0` after user-supplied extra arguments. This prevents a
target project's `.codex` hooks and `AGENTS.md` from inheriting the child
session, even when Codex-Orchestra is installed in the same repository.

**Review** (`reviewer-codex`): install the [Codex CLI](https://developers.openai.com/codex/)
and authenticate it — either `codex login` or export `OPENAI_API_KEY`. Once
this pack is installed, `reviewer-codex` is the default independent reviewer
for Claude-authored campaign work — no engine selection needed. Codex-authored
work goes to the fresh-context Opus `reviewer` instead, so author and reviewer
always sit on different vendors. Docs-only work (prose only — no code, config,
dependency, or agent/skill/protocol instruction file) is exempt from the
cross-family requirement and goes to `reviewer` either way. If the Sol lane
is unavailable, the runner reports `REVIEW_UNAVAILABLE` and the Director falls
back to Opus review with a loud cross-family-unavailable alarm.

Reviews of the same repository can run concurrently: each pins its own
throwaway worktree and LOCKS it, so no other review's teardown — or a user's
own `git worktree prune` — can unhook a live checkout. A run killed hard
leaves its lock behind by design; the next run releases it, because the lock
reason names the owning process.

**Execution** (`executor-codex-principal`, `executor-codex-heavy`,
`executor-codex-luna`): same Codex CLI + auth as review, three rungs behind one
runner, reached in very different ways:

| Launcher | `--profile` | Default engine | How an order reaches it |
|---|---|---|---|
| `executor-codex-principal` | `principal` | GPT-6 Astra, xhigh effort | **the default ladder's top rung** — `executor` → `executor-heavy` → here, one rung per double bounce. Exceptional orders only, declared at PLAN time |
| `executor-codex-heavy` | `heavy` (the runner's default) | GPT-6 Sol, high effort | **user request only** — the user names it, or `executorEngine: "codex"` makes the Codex lane this project's executor lane. No routing rule reaches it |
| `executor-codex-luna` | `luna` | GPT-6 Luna, xhigh effort | **user request only** — the user names it. `executorEngine: "codex"` does not select it (that means Sol), no routing rule reaches it, and nothing escalates or substitutes into it |

So the harness's escalation path crosses the vendor line at the top: a double
bounce at the Opus heavy tier goes straight to Astra, past Sol and Luna. No
launcher ever escalates itself, and none is for routine work. The Fable
principal profiles (`executor-principal`, `executor-principal-xhigh`) are
likewise user-request-only, and stand in — announced, never silently — when
this pack is absent and the ladder therefore has no top rung.

The rungs differ in model and effort and in nothing else: same sandbox,
same idle precheck, same tree audit, same one-attempt law, same report
contract. Each reads only its own env vars and config keys, so pinning one
never moves another, and a run that names no profile behaves exactly as the
lane did before the principal rung existed.

**Cross-compare** (`architect-codex` + `architect-claude-xhigh`/`-max` + `plan-synthesizer`):
same Codex CLI + auth as review — the GPT architect runs through `codex exec`
in a `read-only` sandbox (hard-pinned; the lane never writes the tree), with
web search enabled by default to match the Claude architects' web tools
(`ORCHESTRA_CROSSPLAN_WEB=0` or `"codex": { "crossplanWeb": false }` turns it
off; either way the brief's GROUND TRUTH grant governs actual use, identically
for both lanes). No engine selection needed: `/cross-compare-plan` dispatches
all three roles itself, including the default post-synthesis audit — one extra
GPT-lane critique of the finished `final-plan.md`.

The Sol reviewer and the heavy executor rung default to `gpt-6-sol` at
`high` effort. The principal executor rung and the GPT cross-compare architect
default to `gpt-6-astra` at `xhigh` effort — Astra's ladder is
`low|medium|high|xhigh|max` and has no `none` level. The user-request-only
Luna executor rung defaults to `gpt-6-luna` at `xhigh` effort.

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
    "reviewTimeoutMs": 5400000,
    "reviewModel": "gpt-6-sol",
    "reviewSandbox": "workspace-write",
    "helpersDir": "C:/tools/codex-helpers",
    "worktreeRoot": "C:/tmp/orchestra-review",
    "doNotRun": ["godot", "*.exe --headless"],
    "worktreeWarmupCmd": "godot --headless --import",
    "integrityIgnore": ["*.import", ".godot/"],
    "execKillSurvivors": true,
    "reviewKillSurvivors": true,
    "crossplanKillSurvivors": true
  }
}
```

| Key | Effect |
|---|---|
| `reviewTimeoutMs` | Wall-clock cap per attempt (default 90 minutes). See "Timeout budgets". |
| `reviewModel` / `reviewSandbox` | Same as `ORCHESTRA_REVIEW_MODEL` / `ORCHESTRA_REVIEW_SANDBOX`. |
| `helpersDir` | A directory of known-good files mirrored into the Codex install directory before each run (see "Helper restore"). |
| `doNotRun` | Commands the reviewer is forbidden to execute. Injected into the brief as a hard prohibition. |
| `worktreeRoot` | Where a pinned review materializes its throwaway worktree (default: the OS temp dir). Must be writable and outside the repository — and if you set it and it is not writable, the review **fails** rather than quietly using somewhere else. |
| `gitConfigIsolation` | `true` by default: the engine reads a scratch global config that carries a copy of your real one and overrides only the excludes/attributes probing; set `false` to hand it your real global config directly. |
| `engineMcp` | `strip` (default) disables every MCP server in the user's Codex config plus the apps connector for the engine child, in every lane; `inherit` leaves the engine's MCP config alone. |
| `reviewRetries` | Extra attempts after a failure that might go differently (default `1`, max `3`). Each retry gets a fresh checkout; the chain reports as one outcome. |
| `authProbe` / `probeTimeoutMs` | The stage-a `codex exec` echo run before the real attempt (default on, 90 s). A dead or unauthenticated install then costs seconds, not a review budget. |
| `worktreeWarmupCmd` / `worktreeWarmupTimeoutMs` | Command run inside the fresh checkout *before* the integrity baseline is taken (default none, 5-minute cap). For engines that import assets on first open. **Pinned reviews only** — it writes, and a live-tree review must not write into the tree it is reviewing. |
| `integrityIgnore` / `integrityIgnoreDefaults` | Paths that are expected build/engine churn, added to (or replacing) the built-in list of generated-artifact paths. |
| `execKillSurvivors` / `reviewKillSurvivors` / `crossplanKillSurvivors` | `true` by default: kill every process that outlived the engine in that lane (see "Process census"). `false` is the per-lane `--preserve-survivors` — the census still runs and the header says which mode was in force. |
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

**Process census and the kill group.** Every engine invocation runs inside a
kill group the *runner* owns — on Windows a Job object created with
`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` and without `BREAKAWAY_OK`, held open by a
tiny PowerShell holder process for the run's lifetime; elsewhere a POSIX process
group. The group is terminated on timeout, on cancellation, when the launcher
vanishes (a `TaskStop`, a `kill -9`, a closed terminal) and on any crash. On a
normal exit the runner enumerates the group **and** walks the parent/child table
down from the engine PID, and reaps whatever is still alive. What it found is
printed as a `PROCESS CENSUS` block beside the tree audit:

```
PROCESS CENSUS: kill group = Windows Job object, KILL_ON_JOB_CLOSE, no BREAKAWAY_OK; reaping = on
  pre-run descendants: none
  SURVIVORS: none — nothing the engine started outlived it.
```

Why it exists: Codex 0.154.0 on Windows calls `preserve_descendants()` on the
non-timeout root-exit branch of its command runner, and its PTY job helper
strips `KILL_ON_JOB_CLOSE` from the job it builds — so **any child still running
when a shell command returns outlives the run**. An order that launched
`Godot_v4.6.3-stable_win64_console.exe --headless` and returned left the engine
running forever under the sandbox identity, blocking every quiet-machine
benchmark gate on the project until somebody found it by hand. That is not an
administrator problem: the owner account can terminate those processes, and
`windows.sandbox = "elevated"` describes admin-approved sandbox *setup*, not the
orphan's privileges. So the fix lives in the runner, where the run is owned,
rather than in the project or in an order's prose.

The job is created and confirmed **before** the engine is launched, and the
engine is assigned to it before it can have spawned anything, so everything it
starts inherits membership. That costs a second or two of startup on Windows
(the holder compiles a P/Invoke shim) and buys an unconditional guarantee
instead of a race: an earlier version let the shim compile in parallel and a
fast engine was never assigned at all.

What the mechanism cannot do, stated rather than implied: a process that
deliberately leaves the group — `CREATE_BREAKAWAY_FROM_JOB` on Windows (which
needs `BREAKAWAY_OK` on our job, and we never set it), or `setsid()` on POSIX —
is outside it. Those are caught instead by the census's parent/child walk, the
documented fallback reaper. Know its limit: the walk goes *down* from the engine
PID, so it needs every intermediate process to still be listed. On Windows the
parent PID survives the parent's death, but `Win32_Process` lists only *running*
processes, so a chain whose middle has already exited (`cmd.exe` → `codex` →
an orphan) is invisible to it. That is precisely why the job must hold the
engine from its first instruction rather than catch up later. A survivor the
runner could not kill is reported as `STILL ALIVE after the kill sweep`, never
silently.

`--preserve-survivors` (or `codex.execKillSurvivors: false`, and its review /
cross-plan siblings) censuses without reaping, for an order that is deliberately
starting a long-lived service. `ORCHESTRA_JOBRUN=off` disables supervision
outright. Both are named in the report header and in the census block: a
guarantee that silently stopped applying is worse than one never claimed.

**What `--preserve-survivors` promises, and where.** On every platform it
promises that *this runner* will not kill what the engine started, and will say
in the census what it left behind. On POSIX that is the whole story and the
process keeps running. On Windows it is not: a process can belong to job objects
the runner never created — node's own runtime puts children in one with
`KILL_ON_JOB_CLOSE` — and those may reap the tree when the supervisor exits,
whatever this runner does. So on Windows treat the flag as "the runner stood
down", not as a guarantee the process survives. If an order genuinely needs a
service to outlive the run on Windows, start it detached from the run entirely
rather than relying on this flag.

**Inert timeout floor.** An inert tier narrows what must be *verified*, not how
long the engine takes to explore — a 9-line docs diff is still minutes. Inert
reviews are floored at `1800000` ms when the cap came from a launcher flag or
the default; a cap you set yourself is honoured and flagged.

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

**Timeout budgets.** The defaults are set from the field ledger
(`plans/field-evidence-tug-review-rounds-2026-09-05.md`), not from a guess about
how long work ought to take, and they are deliberately generous: a cross-vendor
run should hit its cap only when something is genuinely stuck, never because it
was a slow-but-normal run.

| Cap | Default | What the ledger measured |
|---|---|---|
| `execTimeoutMs` | `7200000` (2 h) | The comparable executor rungs averaged **29.5 min** (`executor-heavy`, 51 runs) and **31.1 min** (`executor-heavy-xhigh`, 8 runs). The old `1800000` sat at roughly the *mean* of that population. This lane is never auto-retried, so a cap that fires costs the whole order and leaves a half-edited tree. |
| `reviewTimeoutMs` | `5400000` (90 min) | 78 Sol review completions: **20.7 min average, 12–39 min observed**, of which **9–10 min per attempt** is the cold worktree import. The old `2700000` sat barely above the observed maximum. The lane retries once, so a visible timeout now needs two runs past 90 minutes. |
| `crossplanTimeoutMs` | `3600000` (1 h) | The lane's own tool description said a phase "routinely uses most of" the old `900000`, and this repository's `.claude/orchestra.json` already overrode it to exactly `3600000` by hand. |
| inert review floor | `1800000` (30 min) | "Inert" narrows what must be *verified*, not how long the engine spends looking — a 9-line docs review once burned a round at `300000`. The old `600000` floor barely covered the cold import. |
| `worktreeWarmupTimeoutMs` | `1800000` (30 min) | The old `300000` was **below the 9–10 minute cold import it was capping**, so an asset-heavy project had its warmup killed every round and reviewed a half-imported tree. |
| `probeTimeoutMs` | `180000` (3 min) | A stage-a echo. A probe that merely times out is a warning, not a refusal, so the cost of the raise is bounded to the pathological path. |

Agent wall-clock is long-tailed rather than normal, so each cap is a multiple of
the measured mean (~2–4×) rather than a computed percentile — the ledger is a
few dozen to a few hundred runs per lane, which is enough to place a mean and an
observed range but not a true p99. Raise any of them further for a project whose
suite is slower; they are all config.

Note the transport side: an `orchestra_*` MCP call blocks for the whole runner
chain, and the server emits `notifications/progress` every 30 s so a client that
resets its timeout on progress can hold arbitrarily long. Pre-release
measurement proved a 1800 s hold; the longer caps above have not been proven end
to end through a client, so if a long run comes back as a transport error rather
than a runner report, that seam is the first place to look.

**Timeout as a value, not prose.** A work order saying "use a 30-minute timeout"
does nothing; only the config does. Set `codex.reviewTimeoutMs`, or have the
launcher pass `--timeout-ms`. The header prints the cap that was actually
applied, so a prose-only instruction is visibly ignored instead of silently so.
The launchers are told never to pass a *smaller* cap to hurry a run along.

**Hard command prohibition.** "Skip the tests" in the brief gets overridden by
the reviewer's own judgment — it runs them anyway and burns the clock. `--no-tests`
and `doNotRun` emit a PROHIBITED COMMANDS block that forbids execution outright
and requires the affected claims to come back marked `UNVERIFIED (prohibited)`,
so a narrowed review reports itself as narrowed. `--allow <cmd>` (the tool's
`allow: [...]`) is the precise counterpart: an exact command the order permits
despite the blanket, exempt from `--no-tests` and from any restriction written
into the order — the field case was a Python self-test the brief allowed and
`--no-tests` then barred. The header reports `allowed commands: N`.

**MCP isolation.** The engine child runs with every MCP server Codex has
loaded disabled by name and the Codex apps connector off, in every lane
(`codex.engineMcp`, default `strip`; `inherit` leaves the config alone). The
names come from `codex mcp list --json` — Codex's own account of what it
loaded, from every config layer it applied — and only a Codex that lacks the
command falls back to the runner reading `config.toml` itself, which the
preflight says when it happens.
A Sol review once delegated itself to a Claude review MCP it found in the
config and came back same-family under a Sol header; an executor with a GitHub
connector can write past the workspace sandbox. The header's `mcp:` line says
what was disabled. Limits, stated: a server whose name needs TOML quoting cannot
be addressed through `-c`; and only in the fallback (no `codex mcp list`) is a
project-level `.codex/config.toml` named in preflight rather than touched —
Codex loads it only for a trusted project, and disabling a server it has not
loaded kills the run on config validation, which is exactly why the names are
asked of Codex, in the directory the engine runs in, rather than read from files.
A verdict that still names a Claude engine as its author is stamped
`⚠ CROSS-FAMILY BREACH` and never counts as the cross-family gate.

**The global git config carries across.** The scratch global config each
runner hands the engine now starts with a copy of the user's real global
config (read by the runner as the host user — the sandbox never opens the
user's file, so an unreadable one cannot make git fail) and copies
`filter.lfs.*` across explicitly, quoted and escaped. Replacing the config outright dropped the credential helper
(`git fetch` in the sandbox died on "could not read Username") and the LFS
filters (every LFS-tracked file read as modified; Astra refused a "clean tree"
precondition twice). The sandbox itself may still carry no GitHub credentials
— the exec brief tells the engine to report an auth failure and continue from
local refs, and the Director fetches before dispatch and pushes after.

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
| `ORCHESTRA_REVIEW_MODEL` | `gpt-6-sol` | Pin the OpenAI review model; hard default, not "Codex's own default". |
| `ORCHESTRA_REVIEW_SANDBOX` | `workspace-write` | Codex sandbox; `read-only` forbids writes but blocks most test runners. |
| `ORCHESTRA_REVIEW_TIMEOUT_MS` | `5400000` | Wall-clock cap per attempt (90 min). See "Timeout budgets". |
| `ORCHESTRA_REVIEW_IDLE_MS` | `1500` | Idle-precheck settle window; `0` disables. Live-tree reviews only. |
| `ORCHESTRA_REVIEW_WORKTREE_ROOT` | OS temp dir | Scratch root for a pinned review's worktree. Set-and-unwritable is a hard failure. |
| `ORCHESTRA_REVIEW_GIT_ISOLATION` | `1` | Isolate git's global config for the review; `0` disables. |
| `ORCHESTRA_REVIEW_RETRIES` | `1` | Extra attempts after a retryable failure (max 3). |
| `ORCHESTRA_REVIEW_PROBE` | `1` | Stage-a `codex exec` echo before the real attempt; `0` disables. |
| `ORCHESTRA_REVIEW_PROBE_TIMEOUT_MS` | `180000` | Cap for that probe. |
| `ORCHESTRA_REVIEW_WARMUP_CMD` | — | Command run in the checkout before the integrity baseline. |
| `ORCHESTRA_REVIEW_WARMUP_TIMEOUT_MS` | `1800000` | Cap for the warmup. The old `300000` was below the 9–10 minute cold import it was capping. |
| `ORCHESTRA_CODEX_HELPERS` | — | Helper-restore source directory. |
| `ORCHESTRA_CODEX_HELPER_SIBLINGS` | Windows: `codex-command-runner.exe,codex-resources,codex-windows-sandbox-setup.exe`; none elsewhere | Comma-separated files the install must carry next to its executable. Empty string expects none. Overrides `helperSiblings` in project config, so a machine whose install legitimately differs needs no committed-config edit. |
| `ORCHESTRA_REVIEW_ARGS` | — | Extra args appended to `codex exec`. |
| `ORCHESTRA_EXEC_HEAVY_MODEL` | `gpt-6-sol` | Heavy-rung execution model (`codex.execHeavyModel`). The key keeps the name it shipped with. |
| `ORCHESTRA_EXEC_HEAVY_EFFORT` | `high` | Heavy-rung reasoning effort (`codex.execHeavyEffort`), sent as `-c model_reasoning_effort=`. |
| `ORCHESTRA_EXEC_PRINCIPAL_MODEL` | `gpt-6-astra` | Principal-rung execution model (`codex.execPrincipalModel`). Read only when the run selects `--profile principal`. |
| `ORCHESTRA_EXEC_PRINCIPAL_EFFORT` | `xhigh` | Principal-rung reasoning effort (`codex.execPrincipalEffort`), sent as `-c model_reasoning_effort=`. |
| `ORCHESTRA_EXEC_LUNA_MODEL` | `gpt-6-luna` | Luna-rung execution model (`codex.execLunaModel`). Read only when the run selects `--profile luna`. |
| `ORCHESTRA_EXEC_LUNA_EFFORT` | `xhigh` | Luna-rung reasoning effort (`codex.execLunaEffort`), sent as `-c model_reasoning_effort=`. |
| `ORCHESTRA_EXEC_TIMEOUT_MS` | `7200000` | Wall-clock cap for an execution run (`codex.execTimeoutMs`; also `--timeout-ms`). It runs your verification — budget a build plus a suite. |
| `ORCHESTRA_EXEC_SANDBOX` | `workspace-write` | Codex sandbox for execution (`codex.execSandbox`). `read-only` = dry run; the runner warns that no edit can land. |
| `ORCHESTRA_EXEC_IDLE_MS` | `1500` | Idle-precheck settle window before executing; `0` disables. Shares `codex.idleMs` with review. |
| `ORCHESTRA_EXEC_GIT_ISOLATION` | `1` | Git-config isolation for the run, with the user's `user.name`/`user.email` copied into the scratch config so ordered commits still work. Shares `codex.gitConfigIsolation`. |
| `ORCHESTRA_EXEC_PROBE` | `1` | Stage-a echo before the real attempt (shares `codex.authProbe` / `probeTimeoutMs`); `ORCHESTRA_EXEC_PROBE_TIMEOUT_MS` caps it. |
| `ORCHESTRA_EXEC_ARGS` | — | Extra args appended to the execution `codex exec`. |
| `ORCHESTRA_EXEC_KILL_SURVIVORS` | `1` | Kill processes that outlived the engine (`codex.execKillSurvivors`; also `--kill-survivors` / `--preserve-survivors`). |
| `ORCHESTRA_REVIEW_KILL_SURVIVORS` | `1` | Same for the review lane (`codex.reviewKillSurvivors`). |
| `ORCHESTRA_CROSSPLAN_KILL_SURVIVORS` | `1` | Same for the cross-compare lane (`codex.crossplanKillSurvivors`). |
| `ORCHESTRA_JOBRUN` | — | `off` disables process supervision entirely in **all three lanes** — no kill group, no census. Every report header says so; it is never a default. |
| `CODEX_BIN` | `codex` | Codex executable path (shared by all runners). |
| `ORCHESTRA_CROSSPLAN_MODEL` | `gpt-6-astra` | Cross-compare GPT-architect model (`codex.crossplanModel`; also the skill's `model=`). |
| `ORCHESTRA_CROSSPLAN_EFFORT` | `xhigh` | Cross-compare GPT-architect reasoning effort (`codex.crossplanEffort`), sent as `-c model_reasoning_effort=`. The skill's `effort=` overrides per session and routes the Claude lane to the matching tier. |
| `ORCHESTRA_CROSSPLAN_TIMEOUT_MS` | `3600000` | Wall-clock cap per cross-compare phase (`codex.crossplanTimeoutMs`; also `--timeout-ms`). |
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
| A child still running when a shell command's root process exits is *preserved*, not reaped (`preserve_descendants()` on the non-timeout branch of `windows-sandbox-rs/src/bin/command_runner/win.rs`; `utils/pty/src/win/job.rs` strips `KILL_ON_JOB_CLOSE`). An order that launches a headless engine and returns orphans it permanently. | 2026-09-15, Codex 0.154.0, Windows. Godot 4.6.3 processes owned by the sandbox identity outliving every run, blocking quiet-machine benchmark gates. | The runner owns its own Job object (`KILL_ON_JOB_CLOSE`, no `BREAKAWAY_OK`) around the whole invocation, terminates it on timeout/cancel/crash, and censuses plus reaps survivors on normal exit — see "Process census". Upstream still preserves descendants inside its own job; ours encloses it. |
| The engine explores at length before concluding, so even a trivial diff costs minutes. | Every round. | Timeout floors and honest cap reporting; `doNotRun` / `--no-tests` as hard prohibitions. Not fixable here — it is how the engine works. |
| Model-side flakiness: an occasional run that produces no final message despite exiting 0. | Occasional. | Classified as a zero-output failure and retried once; reported in the `ATTEMPT LOG` either way, so the lane's real reliability stays visible. |

If you hit one of these, the useful action is an upstream issue with the
runner's report attached — it now contains the attribution, the elapsed time
against the cap, the install layout, and the engine's last output, which is most
of what such a report needs.
