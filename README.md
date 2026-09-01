# Orchestra

A transferable multi-agent harness for Claude Code. It casts the session model as a **Director** who never touches the code, and routes all actual work through a fixed company of specialist subagents. *A separate, self-contained installer (`install-codex.js`) stamps the same operating loop for **Codex CLI** as Director instead — see ["Codex-native harness"](#codex-native-harness-codex-cli-as-director) below; the two installers never touch each other's files, so a project can run either, both, or neither.*

```
                    ┌─────────────────────────────┐
                    │   DIRECTOR  (Fable / Opus)  │
                    │  decides · arbitrates ·     │
                    │  synthesizes · talks to you │
                    └──────────────┬──────────────┘
                        missions   │   verdicts
        ┌─────────────────┬────────┴────────┬─────────────────┐
        ▼                 ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ SCOUT (Haiku) │ │DETECTIVE(Opus)│ │EXECUTOR       │ │REVIEWER (Opus)│
│ where / what: │ │ why / how:    │ │(Sonnet)       │ │ fresh-context │
│ locate · map  │ │ root-cause ·  │ │ all edits &   │ │ adversarial · │
│ · enumerate   │ │ deep tracing  │ │ commands      │ │ re-runs tests │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
                                        the optional `codex` pack adds a
                                        cross-vendor (OpenAI) review layer —
                                        and opt-in OpenAI executors (Sol/Terra)
```

The Director is **hard-blocked by a PreToolUse hook** from editing files, running commands, or searching the codebase — delegation is enforced by the harness, not promised by a prompt. Subagents are unaffected by the block. The guard is model-aware: it enforces only when a director model (Fable/Opus) is at the helm — Sonnet/Haiku sessions run as plain Claude Code. Two authoring carve-outs: the Director may write **plan files** (markdown under `.claude/plans/`) and **memory files** (`CLAUDE.md` / `CLAUDE.local.md`, auto-memory) itself — both are Director thinking, not execution (see "Plan files" and "Memory files" below). The managed Orchestra block inside `CLAUDE.md` stays off-limits.

## Two modes, selected automatically

| | MODE A | MODE B (fallback) |
|---|---|---|
| Session launched as | Fable | Opus (`claude --model opus`) |
| Director | Fable | Opus |
| Review | `reviewer` agent → **Opus, fresh context** (re-runs the tests); with the `codex` pack installed, an optional `reviewer-codex` (OpenAI via Codex CLI) second opinion at gates | same `reviewer` (fresh context — the change's author is Sonnet, not the Director); Opus arbitrates verdicts critically, same optional `reviewer-codex` layer |
| Scout / Detective / Executor / Executor-heavy (+ xhigh variant) | Haiku / Opus / Sonnet / Opus | Haiku / Opus / Sonnet / Opus |

Mode detection is automatic and two-layered: the protocol tells the session to identify its own model, and the guard hook independently reads the live model from the session transcript, enforcing only on positive evidence of a director model. Launched with Sonnet or Haiku, the Orchestra goes dormant and says so — the guard stands down too, so a Sonnet/Haiku session is a plain Claude Code session with no denials and no pause file (even on the first turn, before the model reaches the transcript). A mid-session `/model` switch is picked up one turn later; on a director's opening turn, delegation is carried by the protocol instructions until enforcement engages on turn two.

Every **substantive** change (logic, config, dependencies, data, API surface) gets adversarial review before the Director reports it done. Two failed review cycles force an escalation — one retry at the heavy execution tier with the findings attached, or a re-plan — never a third identical retry.

## Recon tiers: scout and detective

Recon has two tiers, routed by the shape of the question — the same logic that makes review Opus-first:

- **`scout` (Haiku) — the default, for *where/what* questions.** Locating files and symbols, mapping structure, enumerating usages, git history, web lookups. Mechanical retrieval is high-recall work with self-checkable output (`path:line` citations), and it's deliberately cheap: the Director fans scout missions out in parallel without weighing cost.
- **`detective` (Opus) — deliberate routing, for *why/how* questions.** Root-cause analysis, tracing a value across subsystems, invariant discovery, judging which of several implementations is load-bearing. These are the missions where fact-gathering can't be separated from reasoning — knowing what to read next depends on understanding what you just read — and where a confidently wrong report misdirects the whole plan. Recon is also the one unreviewed output in the harness (review checks execution, not intelligence), so the recon that steers decisions gets the most capable model, exactly as verdicts do.

The tiers pipeline rather than compete: scouts map the terrain cheaply, then the detective takes one scoped question plus the map, spending its context on reading depth instead of directory walking. Escalation is built in: a scout UNKNOWN that survives one re-probe becomes a detective case — never a third scout mission. The detective is bound by the same read-only law as the scout, chains every conclusion to `path:line` evidence, and grades its own verdict `CONFIRMED / LIKELY / UNCERTAIN` so the Director plans on calibrated intelligence.

Prefer a mid-priced detective? Change `model: opus` to `model: sonnet` in the master's `agents/detective.md` and re-run the installer — the role's prompt is model-agnostic.

## Review engines

Review has two engines, both under one identical contract — adversarial brief, tier verification, the `verification` manifest, and the Orchestra verdict format:

- **`reviewer` (Opus, fresh context) — the default, both modes.** A different model from the Sonnet executor that authored the change, sharing none of the author's context, re-running the tests itself. Fresh eyes plus independent verification is where most of review's value lives.
- **`reviewer-codex` (OpenAI via Codex CLI) — the optional cross-vendor layer, from the [`codex` pack](packs/codex/).** Models from one vendor share training lineage and some error modes; a different-vendor reviewer breaks that residual correlation. It is deliberately optional rather than default: the marginal independence is real but incremental over a fresh-context Opus review, and it adds an external dependency (Codex CLI installed and authenticated, separate billing, its own failure modes). Recommended as a second-opinion pass at gate-class reviews (integration gates, a chain's final review) — or as a project's primary engine if you prefer; tell the Director. Mechanically it's a thin Claude launcher (Haiku) driving Codex, which is agentic: it reads the actual diff and the surrounding code, **re-runs the tests itself** in a sandbox, and returns a verdict the launcher relays verbatim — the launcher never reviews the code itself, and the Director (blocked from Bash) can't invoke Codex directly, so review stays delegated.

**Install the pack first.** The second engine is an opt-in module, so a project that never asks for it has no OpenAI surface at all:

```bash
node install.js /path/to/project --packs codex
```

**Then swap engines freely.** With the pack installed, the engine is a config value — both engines run under the same contract, so swapping changes who judges, never what gets checked. Set `reviewEngine` in `.claude/orchestra.json`:

```json
{ "reviewEngine": "codex" }
```

`"opus"` (default) — fresh-context Opus `reviewer`; `"codex"` — cross-vendor primary via `reviewer-codex`, with the Opus `reviewer` as its automatic fallback when Codex is unavailable; `"dual"` — both engines review every substantive change and the Director arbitrates. The next review routes accordingly; no reinstall. Ad-hoc, just tell the Director ("run this review through codex") — an in-conversation instruction overrides the config for the session. Setting `reviewEngine` to `codex` *without* the pack installed can't take effect: the Director reviews on Opus and tells you the pack is missing.

**Setup (only needed for `reviewer-codex`).** Install the [Codex CLI](https://developers.openai.com/codex/) and authenticate it — either export `OPENAI_API_KEY` or run `codex login`. The runner ships with the pack (`.claude/hooks/orchestra-review.js`).

**Recommended pin.** Set `ORCHESTRA_REVIEW_MODEL=gpt-5.6-sol` — it works with either `codex login` (subscription auth, plan-dependent) or an `OPENAI_API_KEY`. `executor-heavy` orders (Opus, high effort) default to adding this cross-vendor pass — a Director-applied convention, not harness automation: the author and the default `reviewer` are both Opus, so without it review would share a model with the change it's checking.

**Configuration.** Settings resolve **flag > environment > `.claude/orchestra.json` > default**. Prefer the config file — it is the one layer a forgetful shell can't lose:

```json
{
  "reviewEngine": "codex",
  "codex": {
    "reviewTimeoutMs": 1800000,
    "reviewModel": "gpt-5.6-sol",
    "helpersDir": "/path/to/known-good-codex-files",
    "worktreeRoot": "/path/to/writable/scratch",
    "doNotRun": ["godot"]
  }
}
```

| Variable | `orchestra.json` (`codex` key) | Default | Meaning |
|---|---|---|---|
| `ORCHESTRA_REVIEW_MODEL` | `reviewModel` | Codex's own default | Pin a specific OpenAI model for review — recommended: `gpt-5.6-sol`. |
| `ORCHESTRA_REVIEW_SANDBOX` | `reviewSandbox` | `workspace-write` | Codex sandbox. `workspace-write` lets the reviewer run the test suite (most runners need to write caches/temp/coverage). Set `read-only` for a hard no-write guarantee — at the cost that many suites won't run under it. |
| `ORCHESTRA_REVIEW_TIMEOUT_MS` | `reviewTimeoutMs` | `600000` | Wall-clock cap for a review (it runs your tests). Also `--timeout-ms`. Reviews declared `TIER: inert` carry a **600000 ms floor** — see "An inert review is not a fast review" below. |
| `ORCHESTRA_REVIEW_IDLE_MS` | `idleMs` | `1500` | Idle-precheck settle window; `0` disables. Live-tree reviews only — a pinned review has nothing to settle. |
| `ORCHESTRA_CODEX_HELPERS` | `helpersDir` | — | Directory of known-good files mirrored into the Codex install before each run. |
| `ORCHESTRA_REVIEW_WORKTREE_ROOT` | `worktreeRoot` | OS temp dir | Where a pinned review materializes its throwaway worktree. Never the repo. Also `--worktree-root`. |
| `ORCHESTRA_REVIEW_GIT_ISOLATION` | `gitConfigIsolation` | `1` / `true` | Run every git the review touches against a scratch global config, so a sandbox that can't read yours doesn't warn on every command. |
| `ORCHESTRA_REVIEW_RETRIES` | `reviewRetries` | `1` | Extra attempts after a failure that could go differently (max 3), each in a fresh checkout. The chain reports as one outcome. |
| `ORCHESTRA_REVIEW_PROBE` | `authProbe` | `1` / `true` | Stage-a `codex exec` echo before the real attempt, so a dead or unauthenticated install fails in seconds. `probeTimeoutMs` caps it (90 s). |
| `ORCHESTRA_REVIEW_WARMUP_CMD` | `worktreeWarmupCmd` | — | Command run inside the fresh checkout *before* the integrity baseline — for engines that import assets on first open. Pinned reviews only (it writes). `worktreeWarmupTimeoutMs` caps it. |
| — | `integrityIgnore` | built-in list | Paths counted as expected build/engine churn rather than reviewer mutation. `integrityIgnoreDefaults: false` drops the built-ins. |
| `ORCHESTRA_CODEX_HELPER_SIBLINGS` | `helperSiblings` / `requireHelperSiblings` | Windows: `codex-command-runner.exe`, `codex-resources`, `codex-windows-sandbox-setup.exe` | Files the Codex install must carry **directly** next to its executable; verified and repaired each run, including a copy that exists but sits one directory too deep. The env form is comma-separated and wins over project config — for a machine whose install legitimately differs. Check the install any time with `node .claude/hooks/orchestra-review.js --doctor`. |
| — | `doNotRun` | — | Commands the reviewer is forbidden to run. Also `--forbid` / `--no-tests`. |
| `ORCHESTRA_REVIEW_ARGS` | — | — | Extra args appended to `codex exec` (escape hatch for flag drift / tuning). |
| `CODEX_BIN` | — | `codex` | Path to the Codex executable (resolved through symlinks/junctions automatically). |

**Configure with values, not prose.** A subagent's shell does not persist between tool calls, so an `export` in one call never reaches a runner launched in a later one — and a work order saying "use a 30-minute timeout" or "skip the tests" configures nothing at all. Both failure modes cost real review rounds before the runner was hardened against them. Put durable settings in `.claude/orchestra.json`; the launchers translate per-run instructions into flags on the runner's own command line. Every verdict header reports the value that was actually applied and where it came from — `timeout: 1800000ms (orchestra.json)` — so a setting that failed to land is visible instead of silent.

**Reviewing a committed change: pin it.** When the change under review is already committed, the review order names the base and head SHAs and the launcher passes `--base-ref`/`--head-ref`. The runner then checks that commit out into a **throwaway git worktree outside the repository** and points the engine at *that*, so the review reads a clean tree containing exactly the commit under review.

This exists because of a specific, expensive failure. A Claude session leaves its own debris in the working tree — plan files, notes, edits made after the commit — and an agentic reviewer handed a pinned SHA *plus* a tree that has moved past it cannot reconcile the two: every lookup of a session-created file returns `fatal: path '…' exists on disk, but not in <sha>`. It reads as a repository problem worth investigating, and the engine keeps investigating until the clock runs out. On 2026-08-11 a nine-line docs diff consumed a full review budget this way and returned no verdict. In a pinned checkout the contradiction does not exist.

The worktree root is deliberately outside the repo (OS temp dir by default; `worktreeRoot` to override): a sandboxed reviewer often cannot `mkdir` inside the project, and a worktree inside the tree under review is itself the dirt we're removing. Teardown runs on every exit path — normal, error, and signal — and each run sweeps worktrees orphaned by a hard kill that ran no handler, so `git worktree list` stays clean. The verdict header records which tree produced it: `checkout: pinned worktree @ <sha>` or `checkout: live working tree`. Uncommitted work still reviews live, which is what the idle precheck is for.

**An inert review is not a fast review.** The tier narrows what must be *verified*; it does not make the engine faster, because it explores the repository before it concludes anything and that pass costs minutes regardless of diff size. A launcher that translates "inert" into a short cap buys a guaranteed timeout — this happened at 300000 ms on a nine-line diff. Inert reviews therefore carry a **600000 ms floor**: a shorter cap from a launcher flag or the built-in default is raised to it and the header says so (`timeout: 600000ms (flag 300000ms → raised to the 600000ms inert floor)`), while a cap *you* set in `orchestra.json` or the environment is honoured as written and merely flagged. Budget minutes for a probe, not seconds.

**A failed review never wears the engine's name.** A real verdict is headed `REVIEW ENGINE: OpenAI via Codex CLI (…)`. A `REVIEW_UNAVAILABLE` report is headed `REVIEW ENGINE: NONE`, with the same settings listed under `ATTEMPTED:` as diagnostics. The header used to be identical on both paths, and launchers relaying it read it as provenance — reporting a fallback verdict as the cross-vendor one. A header is an attribution, and attributing a review to an engine that produced nothing turns "no review happened" into "OpenAI approved it".

**One review, one report — the runner owns retries.** When the engine dies without a verdict in a way that could plausibly go differently (killed by a signal, or exiting with nothing to show), the runner makes one more attempt in a *fresh* checkout and prints **a single report** for the whole chain, headed `ATTEMPT CHAIN: 2 attempts, ONE outcome` with the failed attempt's diagnostics preserved under `ATTEMPT LOG`. `REVIEW_UNAVAILABLE` is emitted only once the chain is exhausted, and says so (`FINALITY: this runner made 2 engine attempts and will make no more`). A runner-enforced timeout is deliberately not retried — a second full-length timeout costs the same clock to learn the same thing. Before this, retry was an emergent launcher behavior: on 2026-08-12 a gate delivered the Director a final-sounding `REVIEW_UNAVAILABLE`, the books were closed on the lane, and a real verdict for the same review arrived afterwards.

**A failure that names its own cause.** When the engine produces nothing, the report says **who killed it** — the runner's own timer (node reports its own timeout, so this is never a guess), an external signal, or codex choosing to exit — how long it ran against the cap it was given, and the tail of codex's stderr, stdout, and any session log written during the attempt. A generic "maybe auth, maybe flags, maybe the sandbox" list is printed *only* for a self-chosen non-zero exit, where it is a live hypothesis rather than a shrug. The failure this replaces was a bare `status 143` under a cause list, none of whose entries had ended the process.

**A cheap probe before an expensive review.** A stage-a `codex exec` echo runs before the real attempt: an unauthenticated install, an unavailable model, or a binary a self-update broke then costs seconds instead of a 30-minute budget, and the report states the review was never attempted. A probe that merely times out is a warning, not a refusal — a slow engine is still a working engine.

**Integrity warnings that still mean something.** The tree fingerprint is compared per path and split in two: generated build/engine artifacts (a built-in list, extensible with `integrityIgnore`) are reported as a counted `INTEGRITY NOTE`, and anything else raises the `⚠ INTEGRITY WARNING` with the offending paths listed. Before this, a Godot project's first import inside a fresh worktree — 180+ `*.import` sidecars rewritten by the *engine*, not the reviewer — raised the same alarm as a reviewer editing source, and dumped two whole fingerprints into the verdict. `worktreeWarmupCmd` fixes the class outright by taking the baseline after the engine's first-open import.

**Field-hardening.** Six further failure modes the runner handles mechanically: it **resolves `CODEX_BIN` to its real path** (a symlink or Windows junction breaks Codex's own sibling-file resolution); it **restores missing files** into the Codex install from `helpersDir` before each run (a Codex self-update can silently strip them); it **enforces command prohibitions as hard constraints** that explicitly outrank the brief's "re-run the tests" rule, requiring the affected claims to return as `UNVERIFIED (prohibited: …)` so a narrowed review reports itself as narrowed; it **refuses to review a moving tree**, sampling the working tree twice and returning `REVIEW_UNAVAILABLE: working tree is not idle` if another executor, build, or watch task is still writing; it **isolates git's global config** for every git the review touches, its own and the engine's, because a sandboxed process often cannot read the user's real one and git then complains on *every* invocation (`unable to access '<home>/.config/git/ignore'`) — noise an agentic reviewer treats as a lead; and it **fails honestly on a bad ref** rather than silently falling back to the live tree. Two more since: it **names the Codex install layout** it found and **verifies the helper files that must sit next to the resolved binary**, repairing them from any locatable known-good copy and naming exactly what is missing when it cannot (Codex relocated its install once already, which silently invalidated a repair recipe written for the old layout); it **checks a helper is beside the binary rather than merely present somewhere**, repairing a copy misplaced inside the install (`codex-windows-sandbox-setup.exe` nested in `codex-resources\` is resolved by nothing, and cost six days of reviews that returned nothing while every preflight line looked healthy) and putting the install directory first on the engine's `PATH`, since not every Codex helper resolves relative to the binary; and a **`worktreeRoot` you set is honoured or refused, never swapped** — an unwritable configured root fails the review with the `mkdir` error attached, because falling back to the temp dir would undo the very setting that exists to prevent cross-run collisions.

**Tested, not asserted.** `node tests/review-lane.test.js` in the master exercises the lane end to end against a stub Codex that reports what the engine actually saw — 108 checks. Each fix is checked twice — once showing the failure mode reproduces, once showing it's gone — including worktree teardown after a successful run, after `SIGTERM`, and after `SIGKILL` (where the next run's sweep is what reclaims the orphan). The suite's own exit code is pinned three ways (a failure sets it immediately, an `exit` handler enforces it, and a suite that recorded no cases fails on that basis), because it previously exited 0 on Windows even with failing cases: the verdict was printed from deep inside an async chain that a throw or a hang simply skipped, and a green run that proves nothing is worse than no suite at all. The execution lane has its own suite, `node tests/exec-lane.test.js` — 53 checks against the same stub, covering settings resolution (flag > env > config > default, with the header crediting the layer that supplied each value), the tree audit on both the success and the failure path, the no-auto-retry law, identity-carrying git isolation, install-directory PATH precedence, and honest `EXEC ENGINE: NONE` attribution. CI runs both on **Linux, Windows, and macOS** across Node 20/22/24 for every push and pull request (`.github/workflows/test.yml`) — Windows above all, because that is where every field failure in these lanes has happened and where the exit-code bug hid, and no session working on this repo has a Windows machine to check by hand.

**Tiered review (`--tier`).** Every review runs at full depth by default — the reviewer re-runs the tests itself. For a round the Director declares **inert** (docs/comments/formatting with zero behavior impact), the review order states `TIER: inert` and the launcher appends `--tier inert`; the runner then instructs the reviewer to *verify the inertness claim from the diff first* — any behavior-bearing line is itself a critical finding and forces a full-depth review — and only a proven-inert diff skips the suite. Effectiveness is never traded for speed: the tier narrows verification only where narrowing provably cannot matter, and the prover is whoever reviews — the Opus `reviewer`, the Codex engine, or the protocol's last-resort fallback — never the author. The tier appears in the `REVIEW ENGINE` header of both engines so every verdict is auditable for the depth it ran at. The tier and the `verification` manifest are engine-agnostic review *policy* (`ORCHESTRA.md` §8.3); the Opus `reviewer` enforces them through its own rules, this runner implements them for the Codex engine, and the §5 fallback applies them by hand.

**Why `workspace-write` by default?** The reviewer's whole value is that it runs the real tests, and most test runners write (caches, coverage, build artifacts). This is the same trust model as before — the previous Opus reviewer also had unrestricted shell and was only *told* not to edit — but the runner adds a safety net the old design lacked: it fingerprints the working tree before and after, and if the reviewer mutated anything it appends a loud **`⚠ INTEGRITY WARNING`** to the verdict (it never auto-reverts, which could clobber the real change). For a hard guarantee, set `ORCHESTRA_REVIEW_SANDBOX=read-only`.

**Graceful degradation.** If Codex isn't installed, isn't authenticated, times out, or errors, `reviewer-codex` returns `VERDICT: REVIEW_UNAVAILABLE` with the reason — never a fake approval. The Director routes that review to the Opus `reviewer` and notes the cross-vendor pass didn't run. A harnessed project with no Codex simply has no cross-vendor option — it still gets full fresh-context adversarial review, and it never silently ships unreviewed work as reviewed.

## OpenAI executors

The `codex` pack also carries an **execution lane**: two opt-in executors that offload workhorse implementation to OpenAI models while Claude keeps directing, scouting, and reviewing. They mirror the Claude execution tiers exactly — same law, same report format, same PLAN-time routing by hardness:

| Agent | Default model | Mirrors | For |
|---|---|---|---|
| `executor-codex` | `gpt-5.6-terra` (Terra — OpenAI's everyday workhorse tier) | `executor` (Sonnet) | well-scoped default-tier orders |
| `executor-codex-heavy` | `gpt-5.6-sol` (Sol — the flagship tier), reasoning effort `high` | `executor-heavy` (Opus) | hard-tier orders: algorithmically hard cores, split-resistant cross-subsystem changes, risk-first probes |

Each is a thin Haiku launcher driving `.claude/hooks/orchestra-exec.js`, which enforces the Orchestra executor law in its brief, runs `codex exec` in a `workspace-write` sandbox **in the live working tree** (the edits are the deliverable), and relays the engine's report verbatim. The Director — blocked from Bash — cannot invoke Codex directly, so execution stays delegated.

**Selecting the engine.** The default is Claude. Route per order by asking ("run this order through the OpenAI executor"), or durably via `.claude/orchestra.json`:

```json
{ "executorEngine": "codex" }
```

`"claude"` (default) — the Sonnet/Opus executors; `"codex"` — both tiers route to the OpenAI executors, with the Claude tiers as their unavailable-fallback and escalation rung. Setting it without the pack installed can't take effect: the Director executes on Claude and tells you the pack is missing.

**What the runner adds beyond a bare `codex exec`:**

- **Idle precheck.** The tree is sampled twice before launch and the run is refused (`EXEC_UNAVAILABLE: working tree is not idle`) if anything else is still writing it — two agents interleaving edits into one tree produces a state neither of them made.
- **Tree audit.** The tree is fingerprinted before and after, and every path that changed while the engine ran is listed in a `TREE AUDIT` section under the report (generated build/engine churn counted separately, same allowlist as the review lane's integrity check; a moved `HEAD` is called out when the order had the engine commit). The engine's `CHANGES` section is a claim; the audit is the measurement the Director and the reviewer hold it against. The audit is computed **in-process** from the runner's own snapshots — never from session artifacts — and stamped with the run nonce, so it cannot be a replay of an earlier run's audit.
- **Report integrity (v1.9.0).** Every run generates a fresh nonce, prints it in the header (`RUN NONCE:`), injects it into the brief, and requires the engine to echo it on a final `REPORT INTEGRITY:` line. A report without the echo — the signature of a resumed session or a replayed artifact — or one whose `CHANGES` claims contradict a byte-for-byte untouched tree, is surfaced as `STATUS: EXEC_UNAVAILABLE` with the suspect text shown but labelled `UNVERIFIED ENGINE OUTPUT`, never as DONE. Resume-prone `ORCHESTRA_EXEC_ARGS` tokens (`resume`, `--last`, `--continue`) are refused before launch, and the launcher protocols key every tmp path and sentinel by a per-launch run token, so a stale output file can never satisfy a poll. Verify the round-trip on any machine with `node .claude/hooks/orchestra-review.js --doctor --live` (one real no-op model call).
- **No auto-retry — by design.** The review runner retries a flaky engine because reviews are idempotent; execution is not. A half-dead engine may have half-edited the tree, so the exec runner makes exactly **one** attempt and, on failure, prints `STATUS: EXEC_UNAVAILABLE` with full attribution (who killed the engine, how long it ran against its cap, what it last wrote) *plus* the tree audit of whatever the attempt left behind. The Director then decides: clean up and re-dispatch, or route the order to a Claude executor.
- **Git identity that survives isolation.** The same git-config isolation as the review lane (a sandboxed process often can't read the real global config, and git then warns on every command), with the user's `user.name`/`user.email` copied into the scratch config — so an order that says "commit" still can.
- **The shared reliability net.** Real-path `CODEX_BIN` resolution, the stage-a auth/exec probe, `helpersDir` restore, honest headers (`EXEC ENGINE: OpenAI via Codex CLI (…)` on success, `EXEC ENGINE: NONE` + `ATTEMPTED:` on failure — a failed run never wears the engine's name), and hard command prohibitions (`--forbid` / `doNotRun`). The install directory also leads the engine's `PATH`, for the same reason the review runner does it: `codex-windows-sandbox-setup.exe` is resolved by *name*, and without it the sandbox is never established — which in this lane means an engine that runs, exits, and changes nothing. Both lanes drive one Codex install, so one check covers them: `node .claude/hooks/orchestra-review.js --doctor`, which the exec runner names on exactly that failure shape.

**Review pairing inverts.** A codex-authored change is reviewed by the Opus `reviewer` by default — author and reviewer already sit on different vendors, so the decorrelation that the "add a `reviewer-codex` pass on heavy orders" convention exists to buy is already present. Adding a same-vendor `reviewer-codex` pass on top needs a stated reason; `reviewEngine: "dual"` still runs both.

**Configuration** (`.claude/orchestra.json` `codex` key; flag > env > config > default — `idleMs`, `gitConfigIsolation`, `doNotRun`, `authProbe`, `probeTimeoutMs`, `helpersDir`, and the integrity-ignore keys are shared with the review lane):

| Variable | `orchestra.json` (`codex` key) | Default | Meaning |
|---|---|---|---|
| `ORCHESTRA_EXEC_MODEL` | `execModel` | `gpt-5.6-terra` | Standard-tier model. |
| `ORCHESTRA_EXEC_HEAVY_MODEL` | `execHeavyModel` | `gpt-5.6-sol` | Heavy-tier model. |
| `ORCHESTRA_EXEC_EFFORT` | `execEffort` | Codex's own default | Standard-tier reasoning effort (`-c model_reasoning_effort=`). |
| `ORCHESTRA_EXEC_HEAVY_EFFORT` | `execHeavyEffort` | `high` | Heavy-tier reasoning effort. |
| `ORCHESTRA_EXEC_TIMEOUT_MS` | `execTimeoutMs` | `1800000` | Wall-clock cap — execution runs the project's verification, so budget a build plus a suite. Also `--timeout-ms`. |
| `ORCHESTRA_EXEC_SANDBOX` | `execSandbox` | `workspace-write` | Codex sandbox. `read-only` turns the run into a dry run (the runner warns that no edit can land). |
| `ORCHESTRA_EXEC_IDLE_MS` | `idleMs` | `1500` | Idle-precheck settle window; `0` disables. |
| `ORCHESTRA_EXEC_GIT_ISOLATION` | `gitConfigIsolation` | `1` / `true` | Git-config isolation, with the user's identity carried into the scratch config. |
| `ORCHESTRA_EXEC_PROBE` | `authProbe` | `1` / `true` | Stage-a `codex exec` echo before the real attempt. |
| `ORCHESTRA_EXEC_ARGS` | — | — | Extra args appended to `codex exec`. |

**Graceful degradation, same shape as review.** No Codex, no auth, a dead engine, a moving tree — the lane returns `STATUS: EXEC_UNAVAILABLE` with the reason and the audit, never a fake `DONE`, and the Claude executors carry the order instead.

## Layout

```
Orchestra/
├── README.md              ← you are here
├── VERSION                ← harness version, stamped into installed projects (see "Versioning")
├── CHANGELOG.md           ← what changed in each version, and why
├── ORCHESTRA.md           ← the Director protocol (imported into the project's CLAUDE.md)
├── install.js             ← idempotent installer/uninstaller (Node)
├── install.ps1            ← thin PowerShell wrapper
├── install.sh             ← thin POSIX wrapper
├── agents/
│   ├── scout.md           ← Haiku · read-only where/what recon
│   ├── detective.md       ← Opus · read-only why/how deep investigation
│   ├── executor.md        ← Sonnet · all edits and commands
│   ├── executor-heavy.md  ← Opus · high effort · hard-tier work orders
│   ├── executor-heavy-xhigh.md  ← Opus · xhigh effort · the hardest orders, routed at PLAN time
│   ├── reviewer.md        ← Opus · fresh-context adversarial review (default engine)
│   └── specialists/       ← domain executors, installed on request (--specialists)
│       ├── _TEMPLATE.md   ← copy this to mint a new specialist
│       └── modeler.md     ← Sonnet · Blender/Godot 3D asset pipeline
├── hooks/
│   └── orchestra-guard.js ← PreToolUse hook enforcing Director law
├── skills/                 ← core skills, always stamped into .claude/skills/
│   ├── _TEMPLATE/          ← copy this directory to mint a new bundled skill
│   ├── orchestra-status/   ← /orchestra-status · live harness state report
│   ├── orchestra-plan/     ← /orchestra-plan · §8-sized plans into .claude/plans/
│   └── orchestra-review/   ← /orchestra-review · on-demand adversarial review
├── tests/                  ← harness tests (master-only; never stamped into projects)
│   ├── review-lane.test.js ← the cross-vendor review lane, end to end
│   ├── exec-lane.test.js   ← the cross-vendor execution lane, end to end
│   ├── scan-lane.test.js   ← install.js --scan / --update, against real installs
│   ├── frontmatter-lint.test.js ← install.js --lint + LF stamping + .gitattributes + hooks CJS scoping
│   └── fixtures/           ← a stub Codex CLI that reports what the engine saw
└── packs/                  ← OPTIONAL modules, installed only when named (--packs)
    ├── README.md           ← the pack contract
    ├── _TEMPLATE/          ← copy this directory to mint a new pack
    └── codex/              ← the OpenAI surface: cross-vendor review + planning
        ├── pack.json       ← pack metadata
        ├── agents/
        │   ├── reviewer-codex.md       ← Haiku launcher · cross-vendor (OpenAI/Codex) review, via MCP
        │   ├── executor-codex.md       ← Haiku launcher · OpenAI executor (Terra, default tier), via MCP
        │   ├── executor-codex-heavy.md ← Haiku launcher · OpenAI heavy executor (Sol, high effort), via MCP
        │   ├── architect-codex.md      ← Haiku launcher · cross-compare GPT architect (Codex CLI, read-only), via MCP
        │   ├── architect-claude.md     ← Fable architect · cross-compare Claude lane (fresh context, high effort)
        │   ├── architect-claude-xhigh.md ← same lane at xhigh effort (effort=xhigh routing)
        │   ├── architect-claude-max.md ← same lane at max effort (effort=max routing)
        │   └── plan-synthesizer.md     ← Opus synthesizer · blind merge of the two revised plans
        ├── hooks/
        │   ├── orchestra-engine-mcp.js ← MCP server exposing the runners as typed tools (registered in .mcp.json)
        │   ├── orchestra-review.js    ← cross-vendor review runner (drives Codex CLI)
        │   ├── orchestra-exec.js      ← cross-vendor execution runner (drives Codex CLI)
        │   └── orchestra-crossplan.js ← cross-compare architect runner (drives Codex CLI, read-only)
        └── skills/
            └── cross-compare-plan/ ← /cross-compare-plan · two architects, blind merge
```

This folder is the **master copy**. Projects get stamped copies; to change the system, edit here and re-run the installer per project.

Everything above `packs/` is the **core harness** and always installs. Everything under `packs/` is opt-in and installs only when named — so a project that never passes `--packs` has no OpenAI surface, no missing-dependency warnings, and no files it didn't ask for. See [`packs/README.md`](packs/README.md) for the contract, and "Packs" below.

## Versioning

The master's version lives in the `VERSION` file at the repo root. The installer stamps it into every project it touches — the header comment of `<project>/.claude/ORCHESTRA.md` reads `Installed by the Orchestra harness (vX.Y.Z)` — so any project can answer "what Orchestra version am I on":

```bash
head -3 .claude/ORCHESTRA.md     # or just ask the session: /orchestra-status
```

Compare that against the master's `VERSION` and re-run the installer to update (it's idempotent). Installs stamped before versioning existed carry no version — treat "unversioned" as "older than v1.0.0". The number bumps with any change to the stamped files (protocol, guard, hooks, agents, bundled skills): **patch** for fixes and doc-only changes, **minor** for new capabilities (carve-outs, skills, config knobs), **major** for breaking changes to the protocol or the `orchestra.json` format. [`CHANGELOG.md`](CHANGELOG.md) records what each version changed and which field failure prompted it.

### Finding and updating installs across repos — `--scan`

Updating one project was always easy; knowing *which* projects needed it was not. Nothing recorded where the installs were, so the upgrade path above had to be walked by hand, per project, from memory of which repos you'd harnessed. That gap has teeth: v1.5.0 fixed a Codex helper that had left the review lane silently dead for six days, and a project still on v1.4.1 carries that bug with no way to find out except by hitting it.

Run the scan **from the master**, which is the only place that knows the current `VERSION` and holds the files to stamp — so it's where you already are after a `git pull`:

```bash
node install.js --scan ~/code             # report: which installs are behind?
node install.js --scan ~/code --update    # ...and bring the stale ones up
```

```
Orchestra 1.7.0 — master: /home/you/Claude-Orchestra
Scanning /home/you/code (max depth 6)

  1.7.0       up to date  /home/you/code/project-a
                          packs: codex
  1.4.1       BEHIND      /home/you/code/project-b
                          packs: codex · specialists: modeler
  unversioned BEHIND      /home/you/code/project-c
                          no install record — a pre-packs install

3 install(s) · 2 behind · 0 ahead of this master

  Update them: node install.js --scan /home/you/code --update
```

A project counts as an install when it has `.claude/ORCHESTRA.md` — the file the installer writes and `--uninstall` removes. The version comes from `.claude/orchestra-install.json`, falling back to the `ORCHESTRA.md` header stamp, so pre-packs installs are still found and classified rather than skipped.

### Frontmatter lint — `--lint`

Claude Code drops an agent/skill `.md` whose YAML frontmatter fails to parse **silently** — no log, no error, the agent simply never registers in any session. A bare `": "` inside an unquoted `description:` is enough, and Claude Code's own repair pass (which would quote such values) cannot match CRLF lines, so the failure is invisible on LF platforms and fatal on Windows checkouts. That exact combination shipped once (v1.9.0's changelog tells the story), so the class is now mechanically unshippable:

```bash
node install.js --lint            # lint every .md with frontmatter in this master
node install.js --lint <dir>      # ...or in any directory
```

Errors are frontmatter a strict YAML parse rejects (the silent-drop class, including a missing `name:` in agents/specialists/SKILL.md); warnings are values that parse today but lose text (`" #"` comment truncation) or lean on the CRLF-fragile repair pass. Lint mode is strict — warnings fail it too — and CI runs it over the whole repository on every platform. Every install runs the same check over everything it is about to copy and **refuses before copying anything** on an error. Installed `.md` files are additionally normalized to LF, and a scoped `.claude/.gitattributes` (`*.md`/`*.js`/`*.json text eol=lf`) is stamped when the project has none, so a downstream `autocrlf` re-checkout cannot re-break what the lint approved. The install also stamps `.claude/hooks/package.json` (`{"type":"commonjs"}`) so every hook script keeps CommonJS semantics even when the project's own root `package.json` declares `"type": "module"` — without it Node treats the hooks as ESM and `require` throws before the guard ever runs.

What it does *not* do is as deliberate as what it does:

- **Each project updates to its own recorded selection.** An update spawns a plain `node install.js <project>` per project — the identical code path you'd run by hand — so packs and specialists survive. That's also why `--scan` **refuses** `--packs`/`--specialists`: one selection applied across many projects would silently rewrite choices they made separately, adding an OpenAI surface to projects that never asked for one. Change a project's selection by installing into it directly.
- **An install ahead of the master is never touched.** If a project was stamped by a newer master than the one you're scanning from, it's reported and skipped — downgrading it would be data loss wearing an update's name. `git pull` the master first.
- **`--scan` refuses `--uninstall`.** Removing the harness stays per project on purpose; mass uninstall isn't a convenience worth building.
- **A pre-versioning install warns before it's updated.** With no recorded selection, a plain re-run can't restore packs it was never told about — the scan says so, with the command to re-add them, rather than quietly shipping a downgraded harness.

Exit codes make it usable as a check: **0** when nothing reachable is behind, **1** when something is (or when an update failed). `--depth <n>` bounds the walk (default 6); `node_modules`, `.git`, build outputs and caches are skipped, symlinked directories are never followed, and a directory that is itself an install is not descended into.

PowerShell users get the same modes through the wrapper: `.\install.ps1 -Scan "C:\code"` and `-Scan "C:\code" -Update`.

## Install into a project

Clone the master once, then point the installer at any project. `ORCHESTRA_HOME` below is wherever you cloned it.

```powershell
# Get the master (once):
git clone https://github.com/Max-Lough/Claude-Orchestra.git
cd Claude-Orchestra

# From the master folder (PowerShell):
.\install.ps1 "C:\path\to\your\project"

# or by absolute path from anywhere:
node "$ORCHESTRA_HOME\install.js" "C:\path\to\your\project"

# or from inside the target project (installs into the current dir):
node "$ORCHESTRA_HOME\install.js"

# with the optional cross-vendor (OpenAI) pack:
.\install.ps1 "C:\path\to\your\project" -Packs codex
```

```bash
# POSIX (macOS/Linux):
git clone https://github.com/Max-Lough/Claude-Orchestra.git && cd Claude-Orchestra
./install.sh /path/to/your/project
./install.sh /path/to/your/project --packs codex     # with the OpenAI pack
```

The installer is **idempotent** — run it again anytime to update a project to the latest master. It:

1. Copies the core `agents/*.md` → `<project>/.claude/agents/`
2. Copies each core skill `skills/<name>/` → `<project>/.claude/skills/<name>/` (stamped wholesale — local edits to those directories are overwritten on update; see "Bundled skills")
3. Copies `hooks/orchestra-guard.js` → `<project>/.claude/hooks/`
4. Copies the agents, hooks, and skills of any pack named with `--packs` into those same directories
5. Copies `ORCHESTRA.md` → `<project>/.claude/ORCHESTRA.md`, stamping the harness version into its header
6. Merges the PreToolUse hook entry into `<project>/.claude/settings.json` (preserving whatever else is there)
7. Merges git permission grants (`Bash(git add:*)`, `Bash(git commit:*)` — push is opt-in, see below) into `permissions.allow` in that same `settings.json` (or `settings.local.json` with `--grants-local`, see below), so the executor can commit when a work order tells it to
8. Ensures the project's `CLAUDE.md` contains the Orchestra import line (added inside `<!-- ORCHESTRA:BEGIN/END -->` markers)
9. Records the pack and specialist selection in `<project>/.claude/orchestra-install.json`

**Your selection sticks.** That last file is why a later plain `node install.js` refreshes exactly the packs and specialists you chose rather than silently dropping them. Pass the flags again only to *change* the selection — `--packs codex,other` to add, `--no-packs` to remove (deselected packs have their files deleted), `--no-specialists` likewise.

**First launch after install:** Claude Code will ask you to approve the hook that project settings define — approve it once and it sticks. If teammates shouldn't inherit the harness, move the hook entry from `settings.json` to `settings.local.json` (git-ignored).

**Why the git grants are needed:** subagents don't see your conversation. When the Director relays "the user asked me to push" inside a work order, that quoted instruction is not a user turn in the executor's own transcript, so the permission classifier refuses `git commit`/`git push` — it only accepts authorization it can see natively, or a settings-level grant. The `permissions.allow` entries are that grant. Remove or narrow them if you'd rather approve commits by hand each session; the Director itself is still barred from Bash entirely by the guard hook, so the grants empower only the agents.

**Push is opt-in — `--grant-push`, and it is an exact-match allowlist, never a prefix.** The default install grants only `Bash(git add:*)` and `Bash(git commit:*)`. `node install.js <project> --grant-push` additionally adds exactly four literal invocations to `permissions.allow` — `Bash(git push)`, `Bash(git push origin HEAD)`, `Bash(git push -u origin HEAD)`, `Bash(git push --set-upstream origin HEAD)` — **together with** a `permissions.deny` counterweight for the dangerous forms (`--force`/`-f`, `--delete`/`-d`, `--mirror`, `--prune`, a `+`-refspec, a `:`-refspec, `origin --delete`, and their `git`-recognized abbreviations). Earlier versions of this installer granted the broad prefix `Bash(git push:*)` instead, guarded only by a deny blacklist over free-form shell — that blacklist could never be complete (`git push -d origin x`, `--del`, `--mir`, `origin :x`, and `origin +x` all matched the allow while escaping the deny patterns meant to stop them). An allowlist of exact strings has no such gap: nothing outside the four literal invocations matches, so anything else — including every one of those forms — falls through to a permission prompt instead of an automatic allow. Upgrading a project that has the old broad grant strips it automatically on the next `node install.js <project>` — with or without `--grant-push` — unless `.claude/orchestra.json` marks it `userOwnedPermissions` (a hand-edited escape hatch for a grant you added yourself, independent of Orchestra). `--uninstall` removes exactly the grant(s) this installer itself added (tracked in `.claude/orchestra.json`'s `installedPermissions`/`installedDeny`) — an identical string you added independently survives.

**Grants stay local — `--grants-local`.** By default, grants land in `.claude/settings.json`, which is Claude Code's *shared* project settings file — if you commit `.claude/` (which this installer's own `.gitattributes` and skills layout encourage), those grants propagate to every collaborator on `git clone`, including through every guard stand-down window below on their machine. `node install.js <project> --grants-local` writes the same grants to `.claude/settings.local.json` instead (git-ignored by Claude Code convention; add it to `.gitignore` yourself if this project doesn't already), so they stay per-developer. The `--grant-push` deny counterweight travels with the grants to whichever file they land in. `--uninstall` checks both files and removes exactly what it tracked from wherever it is.

**What these grants reach.** `permissions.allow`, wherever it lives, is **session-wide** — it is not scoped to the executor agent, and it applies in every window where the guard hook is not actively enforcing Director law, not only when an executor is running. Three such windows exist today:

- a non-director model at the helm (`claude --model sonnet`) — the guard stands down entirely, so the grants apply to the plain main session too;
- a session's first turn, before any assistant model reaches the transcript (`model === null`) — same stand-down, for one turn, under the **legacy** roster only. Under a pinned `roster: "new"` this window does not stand down — it **denies** instead (see "Owner pin" below), which is the whole reason roster:new exists;
- the pause switch, `.claude/orchestra.pause` or `ORCHESTRA_PAUSE=1` — the guard stands down for the whole session by design.

A **fourth window existed and is now closed**: `latestMainModel()` used to read only the last 256 KB of the session transcript, so one oversized entry (e.g. a large tool result) could evict the real assistant turn out of that tail and land back on "undetermined" — an attacker-chosen stand-down rather than a user-chosen one. The guard now reads the whole transcript (bounded — see the code comment on `MAX_TRANSCRIPT_BYTES`) instead of a fixed-size tail, so an oversized entry can no longer evict the model marker.

None of these are exotic: a quick `claude --model sonnet` for an unrelated one-liner, or a paused session for harness debugging, both carry the same `git add`/`git commit` (and, if granted, `git push`) authorization the executor has. This is not a defect to work around — it is what a session-wide `permissions.allow` grant means — but it is why `--grant-push` is opt-in rather than default, and why the deny counterweight travels with it unconditionally rather than being left to the reader's judgment.

**Owner pin — `roster: "new"` only takes effect when pinned.** `.claude/orchestra.json` lives inside the project, so anything that can write into the project (a hostile cloned repo, pre-placement before the guard ever runs) can rewrite it. The manifest alone can therefore never grant `roster:new` or loosen the default blocklist — it can only do either when an **owner pin**, written outside the project, says so:

```
PIN_DIR = $ORCHESTRA_PIN_DIR || ~/.claude/orchestra/pins
pin file = <PIN_DIR>/<sha256 hex of the project's real path>.json
{ "projectDir": <real path>, "manifestSha256": <sha256 of the manifest's bytes>,
  "roster": "new"|"legacy", "rosterGeneration": <int>, "seats": {...},
  "writtenAt": <ISO>, "by": "install.js" }
```

The guard resolves policy from this pin, not the raw manifest:

- **no pin file** → the project is **legacy** regardless of what the manifest claims, and the manifest's loosening keys (`directorAllowedTools`, `directorPlanPatterns`, `directorMemoryPatterns`) are honoured exactly as before the pin existed — an "unpinned legacy install" is a default-on-request, not an enforcement boundary;
- **pin present, manifest bytes hash-match** the pin's `manifestSha256` → the manifest is trusted and honoured in full, but `roster` still comes from the pin;
- **pin present, manifest missing/unreadable/hash-mismatched** → the manifest is **untrusted**: every loosening key is ignored, `roster`/`seats`/`rosterGeneration` come from the pin instead, and denial messages append `manifest untrusted (<reason>)`. Under a pinned `roster:new`, an undetermined session model still denies in this state.

Even a trusted manifest can never remove `Bash`/`PowerShell` from the block set while `roster:new` is in effect — leg 4's ticket gate assumes those two are always enforceable once pinned. Everything else `directorAllowedTools` names can still be loosened.

### Uninstall

```powershell
node install.js "C:\path\to\your\project" --uninstall
```

Reads and validates `settings.json`, `settings.local.json` (if present), `.mcp.json`, and `.claude/orchestra.json` first — malformed JSON, a non-object top level, or a numeric value that can't survive a JSON round trip in any of them refuses the whole uninstall before anything is deleted. Then removes, in order: the git permission grants this installer itself added (tracked in `orchestra.json`'s `installedPermissions`/`installedDeny`, checked in both `settings.json` and `settings.local.json` — an identical string you added independently is left alone; a project installed before this tracking existed falls back to removing exactly `Bash(git add:*)`/`Bash(git commit:*)` by string match, same as the original installer), the hook entry and any pack's MCP registrations, and finally the copied files — agents, hooks, protocol, the core `orchestra-*` skills, every pack's files, and, if `--roster new` was ever run, the roster role files, `ORCHESTRA-CONDUCTOR.md`, and the `.claude/orchestra/` substrate files — **using the exact list `.claude/orchestra.json`'s `installedFiles` recorded at install time**, never a wholesale delete of `.claude/orchestra/` or `.claude/agents/*`: a file that merely shares a name with something Orchestra installs (a hand-authored `.claude/agents/architect.md`, a `.claude/orchestra/notes.txt` you dropped in yourself) is left alone, and a directory is only removed once it's empty. Also removed: the install record, the CLAUDE.md marker block, and this project's manifest pin (see "Manifest pin" below) — `.claude/orchestra.json` itself is left in place (its `roster`/`seats` are owner-pinned and survive an uninstall on purpose) — delete it yourself if you don't want it. Everything else — including skills you authored under other names — is left untouched.

### Manifest pin

`.claude/orchestra.json` is an ordinary project file — nothing stops an edit to it (by a Director, a hostile cloned repo, or your own hand) from loosening the guard's policy. Every install or roster flip that writes the manifest also writes (or refreshes) a copy of its load-bearing fields — `projectDir`, a SHA-256 of the manifest bytes, `roster`, `rosterGeneration`, `seats` — to a pin file **outside the project**, under `~/.claude/orchestra/pins/<sha256 of the project's real path>.json` by default (override with `ORCHESTRA_PIN_DIR`). A plain legacy install writes no manifest and therefore no pin. `node install.js <project> --verify-pin` recomputes the manifest's hash and reports `MATCH`, `MISMATCH` (the file on disk was edited since the pin was written), or `NO-PIN` (nothing was ever pinned here). `--uninstall` removes the pin. The pin is a detection mechanism, not a lock — pairing it with an enforcement check on the guard side is a later leg's work.

## Codex-native harness (Codex CLI as Director)

Everything above installs the **Claude-side** harness — Claude Code as Director, `.claude/` + `CLAUDE.md`. A separate, self-contained installer stamps the same operating loop for **Codex CLI as Director** instead: `install-codex.js` writes `.codex/` + the project's `AGENTS.md`. Codex doesn't expand Claude-style `@file` imports, so the protocol is embedded **verbatim** inside a matching `<!-- ORCHESTRA:BEGIN/END -->` block rather than imported by reference.

The two installers never touch each other's files. Run either one, both, or neither — a project with both installed is dual-drivable: Claude Code and Codex CLI can each act as Director under their own copy of the protocol, their own company (GPT-5.6 Sol/Luna/Terra instead of Fable/Opus/Haiku/Sonnet), and their own guard hook.

```
Orchestra/
└── codex/
    ├── ORCHESTRA.md            ← the Codex-side Director protocol
    ├── config.toml             ← recommended Codex CLI project defaults (scaffold, not managed)
    ├── hooks.json              ← SessionStart/PreToolUse guard wiring template
    ├── agents/
    │   ├── scout.toml          ← GPT-5.6 Luna · read-only where/what recon
    │   ├── detective.toml      ← GPT-5.6 Sol · read-only why/how investigation
    │   ├── executor.toml       ← GPT-5.6 Terra · all edits and commands
    │   └── reviewer.toml       ← GPT-5.6 Sol · fresh-context adversarial review
    ├── hooks/
    │   └── orchestra-guard.js  ← Codex hook implementing Director law
    └── packs/                  ← OPTIONAL modules, installed only when named (--packs)
        ├── README.md
        ├── _TEMPLATE/
        └── claude/             ← the Anthropic surface: cross-vendor review + ultra-plan
            ├── pack.json
            ├── agents/
            │   ├── reviewer-claude.toml  ← launcher · cross-vendor (Claude CLI) review
            │   └── planner-claude.toml   ← launcher · ultra-plan counterpart (Claude CLI)
            └── hooks/
                ├── orchestra-review.js      ← review runner (drives an isolated `claude --print` session)
                └── orchestra-ultraplan.js   ← ultra-plan runner (drives an isolated `claude --print` session, no repo access)
```

```bash
# Install (idempotent, same conventions as install.js):
node install-codex.js /path/to/your/project
node install-codex.js /path/to/your/project --packs claude   # with the Claude CLI cross-vendor pack

# Uninstall:
node install-codex.js /path/to/your/project --uninstall
```

```powershell
.\install-codex.ps1 "C:\path\to\your\project"
.\install-codex.ps1 "C:\path\to\your\project" -Packs claude
.\install-codex.ps1 "C:\path\to\your\project" -Uninstall
```

Notable differences from the Claude-side installer, each driven by a real difference between the two products rather than an oversight:

- **No `executor-heavy` tier yet.** The Codex-native company currently mirrors the pre-1.2.0 Claude-side roster (scout/detective/executor/reviewer only). Porting the two-tier execution split is open follow-up work.
- **No specialists or bundled skills yet.** Neither existed in the hand-built wiring this installer was ported from; both are open follow-ups, not intentional omissions.
- **`.codex/config.toml` is a one-time scaffold, not a managed file.** It's Codex CLI's own per-project config surface and may hold unrelated settings, and there is no safe generic TOML merge available here — so the installer writes it once on first install and never touches it again. Hand-edit it freely.
- **`.codex/hooks.json` is merged, not overwritten.** It's likewise Codex CLI's real hook-config surface. The installer only replaces the `SessionStart`/`PreToolUse` entries it owns (matched by `orchestra-guard.js` appearing in the command string), preserving any other event or command a project has added.
- **`AGENTS.md` carries the full protocol text, not a pointer.** Re-running the installer keeps it in sync with `codex/ORCHESTRA.md`, the same way `CLAUDE.md`'s one-line import stays in sync with `.claude/ORCHESTRA.md` on the Claude side.

See [`codex/packs/README.md`](codex/packs/README.md) for the Codex-side pack contract and [`codex/packs/claude/README.md`](codex/packs/claude/README.md) for the `claude` pack's setup and environment variables — the mirror image of the Claude-side `codex` pack.

## Using it

Nothing to invoke — just start Claude Code in the project. The protocol loads with CLAUDE.md, the session detects its mode, and requests flow through the loop:

**INTAKE → RECON → PLAN → EXECUTE → REVIEW → REPORT**

You'll see the Director narrate phase transitions and spawn agents; the agents' raw reports stay behind the curtain, and the Director gives you the synthesized picture with evidence (tests run, review verdicts).

Four slash commands ship with the harness: `/orchestra-status` (live harness state), `/orchestra-plan` (a §8-sized plan written to `.claude/plans/`), `/orchestra-review` (on-demand adversarial review of any diff), and `/cross-compare-plan` (two independent architects, cross-critique, blind merge) — see "Bundled skills".

## Pausing the harness

Sometimes you want a plain session in an Orchestra project (quick one-liner fix, debugging the harness itself):

```powershell
# In YOUR terminal, at the project root — pause:
New-Item -ItemType File .claude\orchestra.pause
# resume:
Remove-Item .claude\orchestra.pause
```

Or launch with the env var: `ORCHESTRA_PAUSE=1 claude`. You can also ask the Director to pause — creating that file is permitted by the hook (its only write exception besides plan and memory files), and only at your explicit request. The Director is instructed never to pause on its own initiative.

## Plan files

The plan is the one artifact the Director authors itself — routing "write my own plan to disk" through an executor wastes a subagent and loses fidelity. So the guard carves out **`.claude/plans/`**: the Director may `Write`/`Edit`/`MultiEdit` markdown files there directly, and `Read` its own plan file back (§3.1's "re-read it at phase boundaries" instruction depends on that) — that directory, `.md` only, containment checked on the **real** (symlink-resolved) path so a pre-existing symlink or junction inside it can't point outside the project. Everything else remains delegated.

If your project keeps plans elsewhere (say `docs/plans/`), add `directorPlanPatterns` to `.claude/orchestra.json` — regexes over the project-relative path, additive to the default location (both routes require the same `.md` extension and the same real-path containment check; a denial names every configured plan directory, not just the default):

```json
{
  "directorPlanPatterns": ["^docs/plans/.+\\.md$"]
}
```

## Memory files

Memory is the other artifact the Director authors itself. A memory entry distills the *current conversation* — which only the Director holds — so routing "append one line to CLAUDE.md" through an executor adds a subagent round-trip and zero judgment: the work order would have to contain the exact text anyway, and the executor would just transcribe it. Blocking it also breaks Claude Code's own auto-memory, which writes from the main session. So the guard treats these as Director-editable:

- `CLAUDE.md` and `CLAUDE.local.md` anywhere inside the project (root, `.claude/`, subdirectories);
- user-level memory under Claude's config dir (`~/.claude`, or `$CLAUDE_CONFIG_DIR`): its `CLAUDE.md`, and markdown inside `memory`/`memories` directories — Claude Code's auto-memory notebook.

**The one fence:** the `<!-- ORCHESTRA:BEGIN/END -->` block the installer stamps into `CLAUDE.md` is not memory — it's the harness's own wiring, and disabling the harness belongs to you (ORCHESTRA.md §6). The guard simulates each memory write and denies any edit whose result doesn't carry that block through verbatim, whatever else the edit does. Everything around the block is fair game.

If your project keeps memory elsewhere (say `.claude/rules/`), add `directorMemoryPatterns` to `.claude/orchestra.json` — regexes over the project-relative path, additive to the defaults (marker-block protection applies to matched files too):

```json
{
  "directorMemoryPatterns": ["^\\.claude/rules/.+\\.md$"]
}
```

## Packs — optional modules

Some capabilities are worth having but not worth imposing: they carry an external dependency, cost money on someone else's meter, or simply don't fit every project. Those live in `packs/`, and **nothing in `packs/` installs unless you name it**:

```bash
node install.js /path/to/project --packs codex
```

| Pack | Adds | Needs |
|---|---|---|
| `codex` | `reviewer-codex` (cross-vendor review via the Codex CLI), `executor-codex` / `executor-codex-heavy` (opt-in OpenAI executors — Terra / Sol via the Codex CLI), `architect-codex` / `architect-claude(-xhigh)` / `plan-synthesizer` + `/cross-compare-plan` (two-architect planning with a blind merge; GPT lane via the Codex CLI, read-only), the three runners, and the `orchestra-engine` MCP server the launchers call them through (registered in `.mcp.json`; approve it on first launch) | Codex CLI (`codex login` or `OPENAI_API_KEY`) |

A harness with no packs is Claude-only and complete: full fresh-context adversarial Opus review, the whole operating loop, every core skill. The `codex` pack adds a *layer* — vendor decorrelation — not a missing floor.

**The selection is remembered.** `.claude/orchestra-install.json` records it, so a later `node install.js` (no flags) refreshes the same packs and specialists instead of dropping them. `--no-packs` removes them; deselected packs have their installed files deleted, not merely skipped.

**Rolling your own.** Copy `packs/_TEMPLATE/` and drop your agents, hooks, and skills into `agents/`, `hooks/`, and `skills/`. The installer discovers files by walking those directories, so nothing needs registering — which is also how `--uninstall` knows what to remove. Four rules apply (full text in [`packs/README.md`](packs/README.md)):

1. **Degrade, never fail** — a missing dependency yields an explicit `*_UNAVAILABLE` verdict, never a crash and never a silent success.
2. **Nothing outside the pack may hard-depend on it** — the protocol, guard, and core agents must all work with zero packs installed.
3. **Skills stay orchestration-class** — they load into the Director's context, so they dispatch agents rather than assuming their own hands.
4. **Names must not collide** with core harness files; the installer refuses rather than clobbering.

## Specialists & hands-on skills

Complex skills (say, a Blender→Godot asset pipeline) are prompt playbooks: whoever invokes them is expected to execute their steps with their own tools. If the *Director* invokes one, the knowledge lands in the one head the guard forbids from using it. The extension closes that gap.

**Specialist executors.** A specialist is a domain-tuned executor — same law, plus preloaded playbooks via the `skills:` frontmatter field (skills load into the subagent's context at startup). Mint one from `agents/specialists/_TEMPLATE.md`, then install per project:

```powershell
.\install.ps1 "C:\path\to\project" -Specialists modeler
# or: node install.js "C:\path\to\project" --specialists modeler,other
```

`modeler.md` ships as a worked example for Blender + Godot: scripts everything through headless bpy, iterates internally (render → *look at its own render* → adjust, capped rounds), exports glTF/GLB, verifies the Godot import, and reports renders + tri/material stats as artifacts. If your project has real pipeline skills, uncomment its `skills:` block and point it at them.

**Skill routing rule (ORCHESTRA.md §7).** The Director classifies before invoking: advisory/orchestration skills (research, planning) are fine in the Director's context; hands-on skills get routed — preferably to a specialist with the skill preloaded, else a work order telling the executor to invoke the skill itself, else translated into work orders manually.

**MCP tools.** Subagents inherit MCP tools, so delegated pipelines (e.g. a Blender MCP server) work out of the box. But MCP tool names aren't in the guard's built-in blocklist — a Director *could* drive Blender directly. Rule §7 forbids it by instruction; to **enforce** it, drop a `.claude/orchestra.json` next to the project's settings:

```json
{
  "directorBlockedPatterns": ["^mcp__blender__", "^mcp__godot__"],
  "directorAllowedTools": []
}
```

- `directorBlockedPatterns` — regexes over tool names, denied to the Director (subagents unaffected). Pattern-match whole servers, or just mutating verbs: `"^mcp__blender__(create|set|modify|delete|execute)"`.
- `directorAllowedTools` — exact built-in names to *remove* from the default blocklist (e.g. `["Glob"]` if you want the Director to glob), so you can loosen the law per project without editing the guard.
- `directorPlanPatterns` — regexes over project-relative file paths (forward-slash form) that count as plan files the Director may write directly, in addition to the built-in `.claude/plans/*.md` (see "Plan files").
- `directorMemoryPatterns` — same shape: paths that count as memory files the Director may edit directly, in addition to the built-in `CLAUDE.md` / `CLAUDE.local.md` and auto-memory locations; the CLAUDE.md marker block stays protected either way (see "Memory files").
- `reviewEngine` — review engine selection: `"opus"` (default — the fresh-context Opus `reviewer`), `"codex"` (cross-vendor primary via `reviewer-codex`; the Opus `reviewer` is its unavailable-fallback), or `"dual"` (both engines on every substantive review, Director arbitrates). Hot-swappable — edit the value and the next review routes accordingly (see "Review engines").
- `executorEngine` — execution engine selection (requires the `codex` pack): `"claude"` (default — the Sonnet `executor` / Opus `executor-heavy`) or `"codex"` (both execution tiers route to the OpenAI executors, `executor-codex` on Terra and `executor-codex-heavy` on Sol, with the Claude tiers as their unavailable-fallback and escalation rung). Hot-swappable, and an in-conversation instruction ("run this order through codex") overrides it for the session (see "OpenAI executors").
- `verification` — optional verification manifest: `{ "full": "<command>", "lint": "<command>", "shards": ["<command>", …], "protected": ["<suite>", …] }`. It is the canonical command set for every verifier: executors run it, the review runner injects it into the Codex brief, and a fallback review judges pasted verification against it. The Director uses it to declare review tiers, scope mid-chain verification to touched + protected shards, and brief executors on concurrent shard runs (`ORCHESTRA.md` §8.3). Typically written once by a verification-profile micro-order that times the tree and maps its seams.
- The file is optional, user-authored, and fail-open: a broken `orchestra.json` disables only itself — the default blocklist still applies. The uninstaller leaves it in place.

**Working rhythm for iterative pipelines** (also in §7): iteration loops live *inside* one work order ("iterate until it matches the ref or 4 rounds, report best"); long campaigns keep one specialist warm via SendMessage instead of respawning; renders/screenshots/logs are the review artifacts — both the Director and the reviewer can Read images; asset batches go to the reviewer as one checklist pass with one verdict.

## Bundled skills

The harness ships skills of its own and stamps them into `<project>/.claude/skills/` on every install — they ride the installer exactly like agents and hooks: installed automatically, updated by re-running the installer, removed by `--uninstall`. Claude Code discovers project skills from that directory, so they're live as slash commands (and as auto-triggered skills) with nothing else to configure. The first three below are core; `cross-compare-plan` arrives only with the `codex` pack.

| Skill | Invoke | Does |
|---|---|---|
| `orchestra-status` | `/orchestra-status` — or ask "is the orchestra on?" | One compact report: mode, pause/enforcement state, review engine (+ Codex availability), company roster, installed packs, policy, verification manifest, plans/ledger — plus one-line fixes for any inconsistency it finds. |
| `orchestra-plan` | `/orchestra-plan` — or ask to plan before building | Walks the §8 sizing gate and writes a durable plan file — work orders with scope, acceptance criteria, verification tier, cadence clauses — to `.claude/plans/<slug>.md`, the one directory the Director may write itself. |
| `orchestra-review` | `/orchestra-review` — or ask for a review / second opinion | Runs the loop's REVIEW phase on demand against arbitrary existing changes — working tree, branch, commit range — through the configured engine, with the standard verdict format. Works on changes the harness never authored. |
| `cross-compare-plan` *(codex pack)* | `/cross-compare-plan <goal>` — or ask for two independent plans compared and merged | Two-architect session: a fresh-context Claude architect and GPT-5.6 Sol (Codex CLI, read-only) draft from one shared brief independently, cross-critique, revise with a disposition per finding, and a blind Opus synthesizer merges the strongest final plan — escalating only genuine ties to you. See "Cross-compare-plan" below; requires the `codex` pack and the Codex CLI. |

Design constraints (these are also the rules for bundling your own — see `skills/_TEMPLATE/SKILL.md`):

- **Orchestration-class only.** Bundled skills load into the main session — the Director, whom the guard blocks from editing, running commands, and searching. So their steps dispatch scouts, executors, and reviewers rather than assuming the session's own hands (ORCHESTRA.md §7). Hands-on playbooks belong to executors and specialists, never in the bundle.
- **All modes.** Each skill forks once at the top: under a director model it delegates; in a dormant or paused session the same procedure runs directly. The skills stay useful in plain sessions.
- **Stamped wholesale.** The installer replaces each stamped skill directory completely on update, so stale files never linger — edit the master and re-run the installer rather than editing stamped copies. The installer owns exactly the master-known skill names (the core `orchestra-*` set, plus any pack's skills such as `cross-compare-plan`); skills under any other name are yours, and the installer never touches them.
- **To bundle a new skill:** copy `skills/_TEMPLATE/` to `skills/<name>/`, make the frontmatter `name` match the directory, re-run the installer per project. Supporting files beside `SKILL.md` are stamped too (the copy is recursive); underscore-prefixed directories are skipped. Fresh sessions pick up new skills at launch.

### Cross-compare-plan: two architects, one blind merge

`/cross-compare-plan <goal>` explores two independent framings of the same problem: a fresh-context Claude architect (`architect-claude`, Fable) and an OpenAI architect (GPT-5.6 Sol driven read-only through the Codex CLI by `.claude/hooks/orchestra-crossplan.js`) receive one byte-identical brief and draft **without seeing each other**. The drafts are then swapped for cross-critique (steelman first, findings tagged [BLOCKER]/[MAJOR]/[MINOR], comparative assessment), each owner revises under critique with an ADOPTED/REBUTTED disposition per finding, and a **blind synthesizer** (`plan-synthesizer`, fresh-context Opus) merges the strongest final plan — adjudicating rebutted findings against the tree, flagging assumptions both plans share under a *verify during execution* list, and escalating at most four genuine ties (material, evidence-balanced, consequential) to you before finalizing. By default the finished plan then gets a **cross-family audit** (`audit=on`): one more GPT-lane critique of `final-plan.md` itself — the synthesizer is always a Claude model, so with two vendors and three seats it always shares a family with one architect, and blind judging removes identity bias but not family-correlated blind spots; accepted mechanical/factual findings are applied by the same synthesizer under your rulings, design-level ones are your decisions. Reach for the skill when the right approach is itself uncertain.

**Both architects have repository access** — read-only, and identical by construction: the brief's GROUND TRUTH section states one scope (`context=repo`, a path list, or `context=none` for brief-only problems, plus any `docs=` documents inlined verbatim — mandatory regardless of size, with a warning past ~100KB), so the plans diverge on judgment, never on information. The same symmetry covers research: both lanes carry web capability by default (the Claude charters' `WebSearch`/`WebFetch`, the GPT lane's `tools.web_search`), and both are charter-bound to use it only when the brief's GROUND TRUTH section explicitly grants it — one grant, identical for both by construction. The whole exchange is **anonymous end to end**: documents carry no model or vendor names, the lane↔letter mapping lives only in the Director's conversation, and the synthesizer judges blind — model-name mentions in planning documents cause exactly the downstream steering the blind merge exists to avoid. Every artifact lands in `.claude/plans/cross-compare/<slug>/` (`brief.md`, `plan-{a,b}-v{1,2}.md`, `critique-of-{a,b}.md`, `final-plan.md`, `audit-of-final.md`), so the full exchange is auditable afterward.

Skill arguments: `effort=<high|xhigh|max>` (ONE level, applied identically to both lanes — default `high`; `max` is the top rung both vendors expose), `model=<id>` (GPT architect, default `gpt-5.6-sol`), `context=<repo|none|paths>` (ground-truth scope, default `repo`), `docs=<paths>` (documents inlined into the brief), `audit=<on|off>` (post-synthesis cross-family audit, default `on`). Runner settings: `ORCHESTRA_CROSSPLAN_MODEL` / `ORCHESTRA_CROSSPLAN_EFFORT` / `ORCHESTRA_CROSSPLAN_TIMEOUT_MS` (default 900000) / `ORCHESTRA_CROSSPLAN_WEB` (`0` disables the GPT lane's web search; also `--no-web`), or `"codex": { crossplanModel, crossplanEffort, crossplanTimeoutMs, crossplanWeb }` in `.claude/orchestra.json`. A session is **eight frontier consultations** with the default audit (2 drafts + 2 critiques + 2 revisions + 1 synthesis + 1 audit) and **seven** with `audit=off`; the GPT lane bills to your Codex CLI account. On any GPT-lane failure the runner returns `STATUS: CROSSPLAN_UNAVAILABLE` with the reason — never a substitute document — and, because the lane is read-only, the same phase re-dispatches safely once the condition is fixed.

## Sizing, cadence, and the verification tax

`ORCHESTRA.md` §8 governs how big a work order gets and what a long one owes the Director while it runs. The short version:

- **Sizing gate at PLAN.** One deliverable kind per order; "author a tool" + "migrate its consumers" always splits; >~3 subsystems or >~5 report sections → split. A well-sized order is one executor run (~≤80 tool calls) and one review round. Shipping atomicity lives at the branch and its integration gate — never inside one context window.
- **Cadence inside long orders.** Any deliberately-bundled order carries heartbeats (per-part checkpoint commit + one-line progress append the Director can poll), a tool-call budget as health telemetry, and the `CHECKPOINT` status — a *successful* stop at a part boundary when the order outgrows its budget or the context compacts. Checkpoints are externalized memory: they survive compaction and turn a late failure into "resume from part N".
- **The verification tax.** The full test tree is the dominant recurring wall-clock cost, paid at least twice per round by design (executor verifies, reviewer independently re-verifies — that redundancy is never trimmed). The levers: cut *round count*, tier only provably-inert rounds (verified by the reviewer, above), profile the tree once into the `verification` manifest, and commission a verification-speed work order (shard/parallelize/cache the suite) when the ledger shows the tree dominating round latency — per-run duration is a project property, and fixing it pays back on every future round in every future session.

These rules optimize **effectiveness and wall-clock**, not cost — the harness's cost savings are already structural (see below), and effectiveness is never traded away for either.

## Cost expectations

This trades tokens for quality and control, deliberately:

- **Recon is cheap** (Haiku) and **execution is mid-priced** (Sonnet) — the volume work runs on the economical models. The **detective** (Opus) is the deliberate exception: routed only to the causal questions where analysis quality steers the plan, and pointed at pre-scouted terrain so its tokens buy reading depth, not directory walking.
- **Review runs on Opus** by default — deliberately the most capable regular call in the company, because verdict quality is what the harness optimizes for. The optional `reviewer-codex` engine is billed to your **OpenAI** account (a separate meter); its Claude side is just a negligible Haiku launcher. Pick the OpenAI review model with `ORCHESTRA_REVIEW_MODEL`.
- **`executor-heavy` is Opus-billed too, by design** — it's routed only to hard cores (concurrency, numerical code, data-risky migrations), coupled cross-subsystem changes, risk-first probes, and orders that already bounced twice at the default tier. The economics are cost per *task*, not per token: verification is paid per review round, so an order that converges in one round on the capable model is cheaper end-to-end than the same order bouncing through two or three rounds on the cheap one.
- **`/cross-compare-plan` is the most expensive planning gesture in the harness, on purpose** — eight frontier consultations per session with the default post-synthesis audit (four of them GPT-5.6 Sol through your Codex account, three Fable, one Opus), seven with `audit=off`. It buys something no single-lane pass can: two independently-derived framings and a blind merge. Use it for the decisions where the approach itself is in question.
- The Director's own turns are decision-dense and short; the expensive model at the top writes the least text.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Orchestra: the Director does not use X" denials | Working as intended on Fable/Opus — the session should delegate. On Sonnet/Haiku the guard stands down automatically, including on a fresh session's first turn under the legacy roster (the guard enforces only on positive evidence of a director model). Any denial on Sonnet/Haiku means model detection failed — pause (above) and file a bug against the master. |
| "…undetermined session model … denies … rather than standing down" on a fresh session's first turn | Working as intended under a pinned `roster: "new"` — see "Owner pin" above. Legacy projects never see this; it clears itself on your next turn once the model reaches the transcript. |
| "…would alter or remove the managed Orchestra block" denial | Working as intended — memory files are Director-editable, but the `<!-- ORCHESTRA:BEGIN/END -->` import block in `CLAUDE.md` is harness wiring and yours alone. The Director edits around it; removing the harness is `--uninstall`, pausing is `.claude/orchestra.pause`. |
| Hook seems inactive | Did you approve project hooks at first launch? Check `/hooks` in Claude Code; confirm `.claude/settings.json` has the `orchestra-guard` entry. |
| Executor/scout/detective getting blocked | Should never happen — project-settings PreToolUse hooks fire only for the main session, and the guard additionally exempts any call carrying subagent identity (`agent_id`/`agent_type`). If it does, pause the harness and re-run the installer to get the latest guard; failing that, file it as a bug against the master copy. |
| Executor denied on `git commit` | The permission classifier won't accept user authorization relayed through a work order — it needs a settings-level grant. Re-run the installer: it merges `Bash(git add:*)`/`Bash(git commit:*)` into `permissions.allow` in `.claude/settings.json` (or `settings.local.json` with `--grants-local`). Check those entries survived if you've hand-edited settings. |
| Executor denied on `git push` | Push is opt-in and NOT added by a plain re-run — pass `--grant-push` explicitly (`node install.js <project> --grant-push`) to add the exact-match push allowlist and its deny counterweight; see "Push is opt-in" above. If a push grant WAS present before (an older installer version, or a hand-edit) and vanished, that is the fix for sdc-012: an installer version predating `--grant-push` granted push unconditionally, and re-running this installer strips that stray grant unless it's marked `userOwnedPermissions` in `.claude/orchestra.json`. |
| `node` not found when hook fires | Claude Code itself runs on Node, but the hook shell needs `node` on PATH. Install Node or add it to PATH. |
| Session model is Sonnet/Haiku | Orchestra goes dormant by design — protocol and guard both stand down, leaving a normal session. Relaunch as Fable, or `claude --model opus` for MODE B. |
| Skill/slash-command in a harnessed session wants to edit files | That's a hands-on skill in the Director's context — route it per ORCHESTRA.md §7: a specialist with the skill preloaded, or a work order telling the executor to invoke it. Pausing works too, but forfeits the harness for that stretch. |
| Director drives MCP tools (Blender, DBs, …) directly | Instruction rule §7 should stop it; to enforce, add the server's pattern to `directorBlockedPatterns` in `.claude/orchestra.json` (see "Specialists & hands-on skills"). |
| `reviewer-codex` / `/cross-compare-plan` doesn't exist | The `codex` pack isn't installed in this project. Re-run the installer with `--packs codex`. `/orchestra-status` reports which packs are present. |
| Review comes back `REVIEW_UNAVAILABLE: Codex CLI not found` | (`reviewer-codex` only) Codex isn't installed / not on PATH in this environment. Install the [Codex CLI](https://developers.openai.com/codex/), or set `CODEX_BIN` to its full path. Until then the Director routes reviews to the default Opus `reviewer` (see "Review engines"). |
| `REVIEW_UNAVAILABLE: Codex exited with status …` | Usually auth — export `OPENAI_API_KEY` or run `codex login`. Can also be an unsupported flag on your Codex version (check `codex exec --help`, then adjust via `ORCHESTRA_REVIEW_ARGS`) or a sandbox restriction. The DETAIL block quotes Codex's stderr. If a Codex self-update stripped files the install needs, point `codex.helpersDir` at known-good copies — the runner restores them before each run. |
| `REVIEW_UNAVAILABLE: review timed out` despite setting a longer timeout | The setting didn't reach the runner. A subagent's shell doesn't persist between tool calls, so an `export` in an earlier call is gone by launch time — and a timeout named only in the work order's prose was never a setting at all. Put it in `.claude/orchestra.json` (`"codex": { "reviewTimeoutMs": 1800000 }`); the verdict header reports the cap actually applied and its source, so check for `(default)` there. |
| Review times out exploring the tree instead of the diff | The change is committed but the review ran in the live (dirty) checkout, so the engine kept hitting `path '…' exists on disk, but not in <sha>` and tried to reconcile it. Name the base and head SHAs in the review order so the launcher passes `--base-ref`/`--head-ref`; the review then runs in a clean worktree of that commit. Check the header: `checkout: live working tree` means the pin didn't land. |
| Inert review times out in a few minutes | Something capped it below the engine's own explore time. An inert tier narrows what gets *verified*, not how long looking takes — budget minutes. The runner floors inert reviews at `600000` ms and reports the raise in the header; a cap you set yourself in `orchestra.json`/env is honoured as written, so raise it there. |
| `REVIEW_UNAVAILABLE: no writable scratch directory` | The pinned review couldn't create its worktree anywhere it tried. Point `"codex": { "worktreeRoot": "<dir>" }` (or `--worktree-root`) at a directory this process can write. It must be outside the repository. |
| `REVIEW_UNAVAILABLE: cannot pin the review to <ref>` | The SHA doesn't resolve in this repository (wrong ref, or a commit that was never pushed to the clone being reviewed), or the project directory isn't a git repo. The runner refuses rather than quietly reviewing the live tree instead. |
| Stray `orchestra-review-*` worktrees in `git worktree list` | Left by a run killed with `SIGKILL`, which runs no cleanup handler. The next review sweeps them automatically and reports `reclaimed N abandoned review worktree(s)`. To clear by hand: `git worktree prune` after deleting the directories. |
| git warns `unable to access '<home>/.config/git/ignore'` during review | The sandbox can't read the real global git config. Isolation is on by default and should prevent it; if you disabled it, re-enable with `"codex": { "gitConfigIsolation": true }`. |
| `REVIEW_UNAVAILABLE: working tree is not idle` | Working as intended — an executor, build, or watch task was still writing the tree, and a review of a moving tree reports on a state that no longer exists. Wait for the other work to finish and re-run. Disable with `ORCHESTRA_REVIEW_IDLE_MS=0` if your workflow makes the check impractical. |
| Reviewer burns the whole timeout running a suite it was told to skip | A polite "skip the tests" in the order gets overridden by the reviewer's own judgment. Forbid it outright instead: `--no-tests`, `--forbid "<command>"`, or `"codex": { "doNotRun": [...] }`. The affected claims come back as `UNVERIFIED (prohibited: …)` so the narrowed review reports itself as narrowed. |
| Reviewer runs but the tests don't execute | (`reviewer-codex`) Codex's `read-only` sandbox can't run commands that write. Leave `ORCHESTRA_REVIEW_SANDBOX` at its `workspace-write` default so the suite can run. |
| Verdict carries an `⚠ INTEGRITY WARNING` | The cross-vendor reviewer (`reviewer-codex`) modified paths that are not generated artifacts. The warning lists them. Have the scout diff the tree against the intended change; the reviewer isn't supposed to write. Set `ORCHESTRA_REVIEW_SANDBOX=read-only` if you need to forbid it outright. |
| Verdict carries an `INTEGRITY NOTE` instead | Build/engine churn only (caches, build outputs, asset-import sidecars) — expected, counted, and not attributed to the reviewer. If your project's generated paths aren't on the built-in list, add them to `codex.integrityIgnore`, or configure `codex.worktreeWarmupCmd` so the first-open import happens before the baseline is taken. |
| Report shows `ATTEMPT CHAIN: 2 attempts, ONE outcome` | The engine failed once and the runner retried in a fresh checkout, as designed. It is **one** review with one verdict; the `ATTEMPT LOG` at the bottom diagnoses the failed attempt. Nothing to do unless it happens every round — then it's an engine-side reliability problem worth an upstream issue. |
| `REVIEW_UNAVAILABLE: the Codex engine failed a trivial echo` | The stage-a probe. Codex could not complete a one-token task, so the review was not attempted and no budget was spent. Almost always auth (`codex login` / `OPENAI_API_KEY`), a model id your account can't use, or an install a self-update broke. Disable with `codex.authProbe: false` if it's wrong about your setup. |
| Preflight says `MISSING FROM THE CODEX INSTALL: …` | The Codex install lacks files that must sit next to its executable, and no known-good copy was locatable. The line names the files and every directory searched. Run `node .claude/hooks/orchestra-review.js --doctor` — it prints the exact copy command — or point `codex.helpersDir` at known-good copies. Set `codex.requireHelperSiblings: true` to make it a hard stop rather than a warning. |
| Reviews run, cost their whole budget, and return nothing — on Windows | Check the install: `node .claude/hooks/orchestra-review.js --doctor`. The known cause is `codex-windows-sandbox-setup.exe` not sitting **directly** beside `codex.exe` — Codex resolves it by name, so a copy one directory down (inside `codex-resources\`, where a hand repair naturally puts it) is never found and the sandbox is never established. The doctor repairs that case itself and reports it as `was MISPLACED inside the install`. |
| Want to check the Codex install without running a review | `node .claude/hooks/orchestra-review.js --doctor`. Resolves the real binary, names the layout, verifies and repairs the helper files, flags stale-session hazards (resume-prone `ORCHESTRA_*_ARGS` / `config.toml` lines, leftover session artifacts), prints the exact fix for what it cannot repair. Exit 0 = a review would find a complete, hazard-free install. The installer runs it for you when the `codex` pack is selected. Add `--live` to also self-test the exec lane's report-integrity nonce with a real no-op engine run (one model call). |
| An exec report is suspected stale — `REPORT INTEGRITY` failed, or a relay describes work that doesn't match the tree | The runner already refused it: an integrity failure is `STATUS: EXEC_UNAVAILABLE`, with the discarded text under `UNVERIFIED ENGINE OUTPUT`. Trust the `TREE AUDIT` (measured in-process, nonce-stamped, impossible to replay) over any report text. Then run `node .claude/hooks/orchestra-review.js --doctor --live` to verify the nonce round-trip, and check `ORCHESTRA_EXEC_ARGS` and `~/.codex/config.toml` for resume-prone settings — the doctor names both. |
| `REVIEW_UNAVAILABLE: no writable scratch directory` after setting `worktreeRoot` | Deliberate: a scratch root you configured is never silently swapped for another. The DETAIL block carries the `mkdir` error. Fix the directory (or its permissions), or point the setting somewhere this process can write. |
| Review or `/cross-compare-plan` dies at ~2 minutes with no output | The launcher ran the runner in the foreground under the shell tool's 120-second default timeout. Both runners' default caps (600000 / 900000 ms) exceed it, and the tool's own maximum is 600000 ms — so a default-cap run must be launched in the background and polled. The launcher profiles carry the exact commands; re-run the installer if yours predate v1.3.0. |
| An agent ends its report with "the run is still going, I'll report back when it finishes" | That report is the end of the round: subagents have no notification-based revival, so nothing wakes the agent when the process completes — the result reaches nobody even though the command succeeded. Every command-running profile now forbids ending a turn on a live process (poll in-turn to completion, or kill it and report what ran); re-run the installer if yours predate v1.4.1. Meanwhile, treat such a report as a failed round and re-dispatch the order. |
| `/cross-compare-plan` returns `STATUS: CROSSPLAN_UNAVAILABLE` | The DETAIL block states why — usually the same Codex CLI conditions as review (auth via `codex login`/`OPENAI_API_KEY`, a broken install the doctor can inspect, a timeout worth raising via `crossplanTimeoutMs`). The lane is read-only, so once fixed the same phase re-dispatches safely. The Director never continues single-architect on its own: a one-architect run is not a cross-compare. |
| A cross-compare document names a model or vendor | The charters forbid it and the synthesizer excludes identity hints from the final plan, but an architect can still slip. Treat it as a contract defect: re-dispatch that phase once with the defect named (the skill's failure rules) — never hand-edit an architect's document. |

## Design notes

- **Why a hook and not just instructions?** Under pressure ("just quickly fix the import"), models drift toward doing work themselves. The hook makes drift impossible instead of discouraged; the denial message itself re-points the Director at the right agent.
- **Why does the guard read the transcript for the model?** The protocol already tells non-director sessions to act normally, but instructions can't unblock a hook — without detection, a Sonnet session would be told "you're dormant" and then denied every Edit. So before denying, the guard tail-reads the session transcript (fixed cost, sub-millisecond, regardless of transcript size), takes the latest non-sidechain assistant turn's model, and stands down for non-directors. Under the default roster (`roster` unset or `"legacy"` in `.claude/orchestra.json`), an undetermined model resolves to *stand down*, matching `orchestra-guard.js`: the harness enforces only on positive evidence of a director model, never by accident on a fresh session's opening turn or an unreadable transcript. Reading the *latest* turn (rather than trusting the session's static self-image) also means mid-session `/model` switches are honored. **Under `"roster": "new"`, this one case flips**: an undetermined model *denies* instead of standing down, because that exact fail-open window is what the leg-4 ticket gate must close for good — a determined non-director model (Sonnet/Haiku) still stands down identically to legacy. `roster` is owner-pinned by the installer (`--roster new|legacy`), never by the guard itself.
- **Why can the Director write plans and memory itself?** Both are the Director's own thinking: a plan decomposes the work, a memory entry distills the conversation, and only the Director holds either. Delegating them buys no independence — the executor would transcribe text the Director composed — and costs a subagent round-trip per write; blocking memory even broke Claude Code's built-in auto-memory. The guard still fences the one dangerous inch of those files: the managed Orchestra block in `CLAUDE.md`, which stays user-only because it's the harness's own wiring (§6 reserves disabling the harness for you).
- **Why can the Director still Read?** Users hand the Director screenshots, specs, and reports that inform decisions. Decision-relevant reading is directing; exploratory reading is scouting — the protocol draws that line, and the scout and detective do all discovery.
- **Why a detective role instead of one smarter scout?** Recon quality is asymmetric. Most missions are mechanical retrieval, where Haiku is fast, cheap, and parallel — but the causal minority steers the plan, and recon is the one output no reviewer checks. Splitting the tiers keeps the fan-out economics of cheap scouts while giving *why/how* questions the same treatment as review verdicts: the most capable model, deliberately routed. The prompts genuinely differ too — the scout enumerates facts; the detective kills hypotheses — so this is two roles, not one role with a model knob.
- **Why is the default reviewer Opus, with cross-vendor as an option?** Self-review inside the planning context inherits the planner's blind spots — independence starts with a fresh context. The `reviewer` provides that: a fresh Opus context reviewing a Sonnet-authored change, re-running the tests itself, which captures most of what independent review buys. A different-vendor reviewer (OpenAI via Codex) decorrelates one layer further — same-vendor models share training lineage — so `reviewer-codex` exists for gate-class second opinions, or as a primary engine for projects that want it. It is optional rather than default because the residual decorrelation is incremental over fresh-context different-model review, while the dependency it adds (external CLI, auth, separate billing) can leave review unavailable exactly when you need it.
- **Why do the launcher profiles carry command tables instead of advice?** Both cross-vendor launchers are Haiku, and both have failed in the field by following prose correctly and still doing the wrong thing: a profile that said "launch it in the background" produced a foreground call that the shell tool killed at its 120-second default, with the runner's own 300-second cap never reaching the engine at all. The instruction wasn't ignored — it just wasn't mechanical. A launch method that depends on a value (the runner's cap) has to be *derived* from that value, so the profiles now carry a table keyed on the cap, the literal commands, and the parameter names to set. The same reasoning turns `mktemp` into a derived path: a launcher that must poll an output file across two tool calls cannot use a name that changes between them.
- **Why forbid ending a turn on a running process, rather than forbidding backgrounding?** Backgrounding is not the defect — an agent that backgrounds a fifteen-minute runner and polls it in-turn is doing exactly the right thing, and for caps above the shell tool's 600000 ms maximum it is the only thing that works. The two field stalls both had the narrower shape: the agent backgrounded a run and then *ended its turn* to wait for a completion notification. A main session gets woken by one; a subagent does not — it stops, and stays stopped, until a human notices the round never returned. So the rule is drawn at the turn boundary, where the harm is, and it covers the case no hook can catch: a foreground command the harness itself promotes to a background task on timeout, which an agent never chose to background at all.
- **Why is `reviewer-codex` a Claude launcher instead of calling OpenAI directly?** The Director is guard-blocked from Bash, so it can't shell out to Codex itself, and there's no OpenAI tool in its toolbox. A thin subagent (exempt from the guard) runs Codex and relays the verdict — which keeps review delegated and keeps the judgment cross-vendor, without weakening the guard or handing the Director a new way to do work itself.
- **Why are packs opt-in rather than installed-and-idle?** The earlier design installed both review engines everywhere and made the *choice* a config value, on the reasoning that swapping engines shouldn't need a reinstall. That's still true once a pack is present — but it meant every project carried an OpenAI surface it might never use: two agents in the roster, two runners on disk, and a set of failure modes that only matter if you opted in. Packs move the decision to install time without giving up hot-swapping after it, and they generalize: anything with an external dependency (another vendor's CLI, a house toolchain) becomes a directory you drop in rather than a special case in the installer. The cost is honest — selecting an engine whose pack isn't installed is now a configuration error rather than a no-op — which is why the installer records your selection and `/orchestra-status` reports it.
- **Why does a pinned review get its own worktree instead of just reading the diff?** Because the reviewer is agentic, not a diff viewer — its value is that it reads the surrounding code and runs things, which means it needs a checkout, and *which* checkout it gets is a correctness property. Handed a pinned SHA and the author's live tree, it is holding two mutually inconsistent descriptions of the repository: the commit says a file doesn't exist, the filesystem says it does. That is not a discrepancy it can resolve or ignore, and it will spend the entire budget trying, which is precisely what a review timeout looks like from the outside. Giving it a clean checkout of the commit removes the contradiction rather than instructing the model to tolerate it — the same reason the timeout is a value and not a sentence. The cost is one `git worktree add` and a guaranteed teardown; the alternative cost is a review round. Uncommitted work still reviews live, because there the working tree *is* the artifact.
- **Why does the runner enforce settings mechanically instead of trusting the launcher?** Because prose isn't configuration, and the field proved it twice. A work order asking for a longer timeout changes nothing unless something turns it into a value; a launcher that exports an environment variable in one tool call loses it before the next, since subagent shells don't persist. Both failures look identical from the outside — a review that dies at the default timeout while everyone believes the setting was applied. The fix is layered: durable settings live in a file that no shell can forget, per-run settings ride the runner's own command line, and the verdict header always names the value that was actually applied and where it came from. The same principle covers prohibitions (a hard constraint that outranks the brief's own rules, with an honest place to record what went unverified) and the install itself (resolve the real binary path, restore what a self-update stripped) — every one of them a thing that used to depend on someone remembering.

## License

[MIT](LICENSE) — use, modify, and distribute freely with attribution; no warranty.
