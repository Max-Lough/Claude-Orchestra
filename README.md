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
                                        cross-vendor (OpenAI) review layer
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
    "doNotRun": ["godot"]
  }
}
```

| Variable | `orchestra.json` (`codex` key) | Default | Meaning |
|---|---|---|---|
| `ORCHESTRA_REVIEW_MODEL` | `reviewModel` | Codex's own default | Pin a specific OpenAI model for review — recommended: `gpt-5.6-sol`. |
| `ORCHESTRA_REVIEW_SANDBOX` | `reviewSandbox` | `workspace-write` | Codex sandbox. `workspace-write` lets the reviewer run the test suite (most runners need to write caches/temp/coverage). Set `read-only` for a hard no-write guarantee — at the cost that many suites won't run under it. |
| `ORCHESTRA_REVIEW_TIMEOUT_MS` | `reviewTimeoutMs` | `600000` | Wall-clock cap for a review (it runs your tests). Also `--timeout-ms`. |
| `ORCHESTRA_REVIEW_IDLE_MS` | `idleMs` | `1500` | Idle-precheck settle window; `0` disables. |
| `ORCHESTRA_CODEX_HELPERS` | `helpersDir` | — | Directory of known-good files mirrored into the Codex install before each run. |
| — | `doNotRun` | — | Commands the reviewer is forbidden to run. Also `--forbid` / `--no-tests`. |
| `ORCHESTRA_REVIEW_ARGS` | — | — | Extra args appended to `codex exec` (escape hatch for flag drift / tuning). |
| `CODEX_BIN` | — | `codex` | Path to the Codex executable (resolved through symlinks/junctions automatically). |

**Configure with values, not prose.** A subagent's shell does not persist between tool calls, so an `export` in one call never reaches a runner launched in a later one — and a work order saying "use a 30-minute timeout" or "skip the tests" configures nothing at all. Both failure modes cost real review rounds before the runner was hardened against them. Put durable settings in `.claude/orchestra.json`; the launchers translate per-run instructions into flags on the runner's own command line. Every verdict header reports the value that was actually applied and where it came from — `timeout: 1800000ms (orchestra.json)` — so a setting that failed to land is visible instead of silent.

**Field-hardening.** Four failure modes the runner now handles mechanically: it **resolves `CODEX_BIN` to its real path** (a symlink or Windows junction breaks Codex's own sibling-file resolution); it **restores missing files** into the Codex install from `helpersDir` before each run (a Codex self-update can silently strip them); it **enforces command prohibitions as hard constraints** that explicitly outrank the brief's "re-run the tests" rule, requiring the affected claims to return as `UNVERIFIED (prohibited: …)` so a narrowed review reports itself as narrowed; and it **refuses to review a moving tree**, sampling the working tree twice and returning `REVIEW_UNAVAILABLE: working tree is not idle` if another executor, build, or watch task is still writing.

**Tiered review (`--tier`).** Every review runs at full depth by default — the reviewer re-runs the tests itself. For a round the Director declares **inert** (docs/comments/formatting with zero behavior impact), the review order states `TIER: inert` and the launcher appends `--tier inert`; the runner then instructs the reviewer to *verify the inertness claim from the diff first* — any behavior-bearing line is itself a critical finding and forces a full-depth review — and only a proven-inert diff skips the suite. Effectiveness is never traded for speed: the tier narrows verification only where narrowing provably cannot matter, and the prover is whoever reviews — the Opus `reviewer`, the Codex engine, or the protocol's last-resort fallback — never the author. The tier appears in the `REVIEW ENGINE` header of both engines so every verdict is auditable for the depth it ran at. The tier and the `verification` manifest are engine-agnostic review *policy* (`ORCHESTRA.md` §8.3); the Opus `reviewer` enforces them through its own rules, this runner implements them for the Codex engine, and the §5 fallback applies them by hand.

**Why `workspace-write` by default?** The reviewer's whole value is that it runs the real tests, and most test runners write (caches, coverage, build artifacts). This is the same trust model as before — the previous Opus reviewer also had unrestricted shell and was only *told* not to edit — but the runner adds a safety net the old design lacked: it fingerprints the working tree before and after, and if the reviewer mutated anything it appends a loud **`⚠ INTEGRITY WARNING`** to the verdict (it never auto-reverts, which could clobber the real change). For a hard guarantee, set `ORCHESTRA_REVIEW_SANDBOX=read-only`.

**Graceful degradation.** If Codex isn't installed, isn't authenticated, times out, or errors, `reviewer-codex` returns `VERDICT: REVIEW_UNAVAILABLE` with the reason — never a fake approval. The Director routes that review to the Opus `reviewer` and notes the cross-vendor pass didn't run. A harnessed project with no Codex simply has no cross-vendor option — it still gets full fresh-context adversarial review, and it never silently ships unreviewed work as reviewed.

## Layout

```
Orchestra/
├── README.md              ← you are here
├── VERSION                ← harness version, stamped into installed projects (see "Versioning")
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
└── packs/                  ← OPTIONAL modules, installed only when named (--packs)
    ├── README.md           ← the pack contract
    ├── _TEMPLATE/          ← copy this directory to mint a new pack
    └── codex/              ← the OpenAI surface: cross-vendor review + deep-plan
        ├── pack.json       ← pack metadata
        ├── agents/
        │   ├── reviewer-codex.md  ← Haiku launcher · cross-vendor (OpenAI/Codex) review
        │   └── planner-gpt.md     ← Haiku launcher · deep-plan counterpart (OpenAI API)
        ├── hooks/
        │   ├── orchestra-review.js    ← cross-vendor review runner (drives Codex CLI)
        │   └── orchestra-deepplan.js  ← plan-roundabout runner (calls the OpenAI API)
        └── skills/
            └── deep-plan/  ← /deep-plan · two-model plan roundabout (GPT-5.6 Sol)
```

This folder is the **master copy**. Projects get stamped copies; to change the system, edit here and re-run the installer per project.

Everything above `packs/` is the **core harness** and always installs. Everything under `packs/` is opt-in and installs only when named — so a project that never passes `--packs` has no OpenAI surface, no missing-dependency warnings, and no files it didn't ask for. See [`packs/README.md`](packs/README.md) for the contract, and "Packs" below.

## Versioning

The master's version lives in the `VERSION` file at the repo root. The installer stamps it into every project it touches — the header comment of `<project>/.claude/ORCHESTRA.md` reads `Installed by the Orchestra harness (vX.Y.Z)` — so any project can answer "what Orchestra version am I on":

```bash
head -3 .claude/ORCHESTRA.md     # or just ask the session: /orchestra-status
```

Compare that against the master's `VERSION` and re-run the installer to update (it's idempotent). Installs stamped before versioning existed carry no version — treat "unversioned" as "older than v1.0.0". The number bumps with any change to the stamped files (protocol, guard, hooks, agents, bundled skills): **patch** for fixes and doc-only changes, **minor** for new capabilities (carve-outs, skills, config knobs), **major** for breaking changes to the protocol or the `orchestra.json` format.

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
7. Merges git permission grants (`Bash(git add:*)`, `Bash(git commit:*)`, `Bash(git push:*)`) into `permissions.allow` in that same `settings.json`, so the executor can commit and push when a work order tells it to
8. Ensures the project's `CLAUDE.md` contains the Orchestra import line (added inside `<!-- ORCHESTRA:BEGIN/END -->` markers)
9. Records the pack and specialist selection in `<project>/.claude/orchestra-install.json`

**Your selection sticks.** That last file is why a later plain `node install.js` refreshes exactly the packs and specialists you chose rather than silently dropping them. Pass the flags again only to *change* the selection — `--packs codex,other` to add, `--no-packs` to remove (deselected packs have their files deleted), `--no-specialists` likewise.

**First launch after install:** Claude Code will ask you to approve the hook that project settings define — approve it once and it sticks. If teammates shouldn't inherit the harness, move the hook entry from `settings.json` to `settings.local.json` (git-ignored).

**Why the git grants are needed:** subagents don't see your conversation. When the Director relays "the user asked me to push" inside a work order, that quoted instruction is not a user turn in the executor's own transcript, so the permission classifier refuses `git commit`/`git push` — it only accepts authorization it can see natively, or a settings-level grant. The `permissions.allow` entries are that grant. Remove or narrow them (e.g. drop `git push`) if you'd rather approve pushes by hand each session; the Director itself is still barred from Bash entirely by the guard hook, so the grants empower only the agents.

### Uninstall

```powershell
node install.js "C:\path\to\your\project" --uninstall
```

Removes the copied files (agents, hooks, protocol, the core `orchestra-*` skills, and every pack's files), the install record, the hook entry, the git permission grants, and the CLAUDE.md marker block. Everything else — including skills you authored under other names — is left untouched. (If you had independently added identical `Bash(git …:*)` allow rules, re-add them after uninstalling.)

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

Four slash commands ship with the harness: `/orchestra-status` (live harness state), `/orchestra-plan` (a §8-sized plan written to `.claude/plans/`), `/orchestra-review` (on-demand adversarial review of any diff), and `/deep-plan` (a two-model planning roundabout with GPT-5.6 Sol) — see "Bundled skills".

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

The plan is the one artifact the Director authors itself — routing "write my own plan to disk" through an executor wastes a subagent and loses fidelity. So the guard carves out **`.claude/plans/`**: the Director may `Write`/`Edit` markdown files there directly (that directory, `.md` only, path-traversal checked — it can't become a general write loophole). Everything else remains delegated.

If your project keeps plans elsewhere (say `docs/plans/`), add `directorPlanPatterns` to `.claude/orchestra.json` — regexes over the project-relative path, additive to the default location:

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
| `codex` | `reviewer-codex` (cross-vendor review via the Codex CLI), `planner-gpt` + `/deep-plan` (two-model planning via the OpenAI API), and both runners | Codex CLI and/or `OPENAI_API_KEY` |

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
- `verification` — optional verification manifest: `{ "full": "<command>", "lint": "<command>", "shards": ["<command>", …], "protected": ["<suite>", …] }`. It is the canonical command set for every verifier: executors run it, the review runner injects it into the Codex brief, and a fallback review judges pasted verification against it. The Director uses it to declare review tiers, scope mid-chain verification to touched + protected shards, and brief executors on concurrent shard runs (`ORCHESTRA.md` §8.3). Typically written once by a verification-profile micro-order that times the tree and maps its seams.
- The file is optional, user-authored, and fail-open: a broken `orchestra.json` disables only itself — the default blocklist still applies. The uninstaller leaves it in place.

**Working rhythm for iterative pipelines** (also in §7): iteration loops live *inside* one work order ("iterate until it matches the ref or 4 rounds, report best"); long campaigns keep one specialist warm via SendMessage instead of respawning; renders/screenshots/logs are the review artifacts — both the Director and the reviewer can Read images; asset batches go to the reviewer as one checklist pass with one verdict.

## Bundled skills

The harness ships skills of its own and stamps them into `<project>/.claude/skills/` on every install — they ride the installer exactly like agents and hooks: installed automatically, updated by re-running the installer, removed by `--uninstall`. Claude Code discovers project skills from that directory, so they're live as slash commands (and as auto-triggered skills) with nothing else to configure. The first three below are core; `deep-plan` arrives only with the `codex` pack.

| Skill | Invoke | Does |
|---|---|---|
| `orchestra-status` | `/orchestra-status` — or ask "is the orchestra on?" | One compact report: mode, pause/enforcement state, review engine (+ Codex availability), company roster, installed packs, policy, verification manifest, plans/ledger — plus one-line fixes for any inconsistency it finds. |
| `orchestra-plan` | `/orchestra-plan` — or ask to plan before building | Walks the §8 sizing gate and writes a durable plan file — work orders with scope, acceptance criteria, verification tier, cadence clauses — to `.claude/plans/<slug>.md`, the one directory the Director may write itself. |
| `orchestra-review` | `/orchestra-review` — or ask for a review / second opinion | Runs the loop's REVIEW phase on demand against arbitrary existing changes — working tree, branch, commit range — through the configured engine, with the standard verdict format. Works on changes the harness never authored. |
| `deep-plan` *(codex pack)* | `/deep-plan <goal>` — or ask for maximum-rigor / cross-vendor planning | Two-model planning roundabout: the Director drafts a full plan, GPT-5.6 Sol (via API, `max` effort by default) critiques and counter-drafts, and the plan ping-pongs until either model approves it unchanged. See "Deep-plan" below; requires the `codex` pack and `OPENAI_API_KEY`. |

Design constraints (these are also the rules for bundling your own — see `skills/_TEMPLATE/SKILL.md`):

- **Orchestration-class only.** Bundled skills load into the main session — the Director, whom the guard blocks from editing, running commands, and searching. So their steps dispatch scouts, executors, and reviewers rather than assuming the session's own hands (ORCHESTRA.md §7). Hands-on playbooks belong to executors and specialists, never in the bundle.
- **All modes.** Each skill forks once at the top: under a director model it delegates; in a dormant or paused session the same procedure runs directly. The skills stay useful in plain sessions.
- **Stamped wholesale.** The installer replaces each stamped skill directory completely on update, so stale files never linger — edit the master and re-run the installer rather than editing stamped copies. The installer owns exactly the master-known skill names (the core `orchestra-*` set, plus any pack's skills such as `deep-plan`); skills under any other name are yours, and the installer never touches them.
- **To bundle a new skill:** copy `skills/_TEMPLATE/` to `skills/<name>/`, make the frontmatter `name` match the directory, re-run the installer per project. Supporting files beside `SKILL.md` are stamped too (the copy is recursive); underscore-prefixed directories are skipped. Fresh sessions pick up new skills at launch.

### Deep-plan: the two-model planning roundabout

`/deep-plan <goal>` puts the plan itself through cross-vendor adversarial review before any work order is cut. The Director drafts a complete plan (full `orchestra-plan` discipline: recon scouts, §8.1 sizing, tiers) into `.claude/plans/`, then hands it to an **OpenAI counterpart** — the `planner-gpt` launcher drives `.claude/hooks/orchestra-deepplan.js`, which calls the Responses API. The counterpart returns either `VERDICT: APPROVE` (proceed, no changes) or `VERDICT: REVISE` with a numbered critique plus a **complete counter-drafted plan**. The Director arbitrates — adopts, rebuts (with reasons the counterpart must respect next round), or merges — and the plan ping-pongs until **either model approves the standing plan without changes**: the counterpart answering APPROVE, or the Director adopting the counterpart's version verbatim. A round cap (default 4 consultations) ends stalemates by escalating the surviving disagreements to you; every run appends an `## Deep-plan log` to the plan file recording verdicts and dispositions.

Skill arguments: `effort=<none|low|medium|high|xhigh|max>` (counterpart reasoning effort — default `max`, GPT-5.6's tier above `xhigh`), `model=<id>` (default `gpt-5.6-sol`), `rounds=<n>` (consultation cap). Example: `/deep-plan effort=high rounds=3 migrate the auth layer to sessions v2`.

**Setup.** Install the `codex` pack (`--packs codex`) and export `OPENAI_API_KEY` in the environment where Claude Code runs — consultations bill to it (and `max` effort is deliberately the expensive, slow, thorough setting; dial `effort=` down for routine plans). If the key is missing or the call fails, the runner returns `VERDICT: DEEPPLAN_UNAVAILABLE` with the reason — never a fake approval — and the Director offers to proceed with the solo plan explicitly marked as not cross-examined.

| Variable | Flag | Default | Meaning |
|---|---|---|---|
| `ORCHESTRA_DEEPPLAN_MODEL` | `--model` | `gpt-5.6-sol` | Counterpart model id (`model=` argument overrides per run). |
| `ORCHESTRA_DEEPPLAN_EFFORT` | `--effort` | `max` | Reasoning effort (`effort=` argument overrides per run). |
| `ORCHESTRA_DEEPPLAN_TIMEOUT_MS` | `--timeout-ms` | `900000` | Wall-clock cap per consultation — max-effort reasoning is slow. |
| `ORCHESTRA_DEEPPLAN_MAX_TOKENS` | `--max-tokens` | `64000` | `max_output_tokens` (includes the model's reasoning budget). |
| `OPENAI_BASE_URL` | — | `https://api.openai.com` | Alternate endpoint (gateways); a `/v1` suffix is tolerated. |

Prefer the flags over the environment variables: a subagent's shell doesn't persist between tool calls, so a variable exported in one call never reaches a runner launched in a later one — the consultation just runs at the default instead.

Unlike the Codex review engine, the counterpart has **no repository access**: it judges coherence, completeness, sequencing, risk coverage, and testability from the brief and plan text alone, and is instructed to raise unverifiable assumptions as critique questions instead of inventing facts. Requests are sent with `store: false`.

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
- **`/deep-plan` consultations are likewise OpenAI-billed** — GPT-5.6 Sol at `max` effort by default, deliberate overkill for the one artifact where errors compound (the plan). Each roundabout is a handful of such calls at most (default cap 4); use `effort=high` or lower when that rigor isn't warranted.
- The Director's own turns are decision-dense and short; the expensive model at the top writes the least text.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Orchestra: the Director does not use X" denials | Working as intended on Fable/Opus — the session should delegate. On Sonnet/Haiku the guard stands down automatically, including on a fresh session's first turn (the guard enforces only on positive evidence of a director model). Any denial on Sonnet/Haiku means model detection failed — pause (above) and file a bug against the master. |
| "…would alter or remove the managed Orchestra block" denial | Working as intended — memory files are Director-editable, but the `<!-- ORCHESTRA:BEGIN/END -->` import block in `CLAUDE.md` is harness wiring and yours alone. The Director edits around it; removing the harness is `--uninstall`, pausing is `.claude/orchestra.pause`. |
| Hook seems inactive | Did you approve project hooks at first launch? Check `/hooks` in Claude Code; confirm `.claude/settings.json` has the `orchestra-guard` entry. |
| Executor/scout/detective getting blocked | Should never happen — project-settings PreToolUse hooks fire only for the main session, and the guard additionally exempts any call carrying subagent identity (`agent_id`/`agent_type`). If it does, pause the harness and re-run the installer to get the latest guard; failing that, file it as a bug against the master copy. |
| Executor denied on `git commit` / `git push` | The permission classifier won't accept user authorization relayed through a work order — it needs a settings-level grant. Re-run the installer: it now merges `Bash(git add:*)`, `Bash(git commit:*)`, `Bash(git push:*)` into `permissions.allow` in `.claude/settings.json`. Check those entries survived if you've hand-edited settings. |
| `node` not found when hook fires | Claude Code itself runs on Node, but the hook shell needs `node` on PATH. Install Node or add it to PATH. |
| Session model is Sonnet/Haiku | Orchestra goes dormant by design — protocol and guard both stand down, leaving a normal session. Relaunch as Fable, or `claude --model opus` for MODE B. |
| Skill/slash-command in a harnessed session wants to edit files | That's a hands-on skill in the Director's context — route it per ORCHESTRA.md §7: a specialist with the skill preloaded, or a work order telling the executor to invoke it. Pausing works too, but forfeits the harness for that stretch. |
| Director drives MCP tools (Blender, DBs, …) directly | Instruction rule §7 should stop it; to enforce, add the server's pattern to `directorBlockedPatterns` in `.claude/orchestra.json` (see "Specialists & hands-on skills"). |
| `reviewer-codex` / `/deep-plan` doesn't exist | The `codex` pack isn't installed in this project. Re-run the installer with `--packs codex`. `/orchestra-status` reports which packs are present. |
| Review comes back `REVIEW_UNAVAILABLE: Codex CLI not found` | (`reviewer-codex` only) Codex isn't installed / not on PATH in this environment. Install the [Codex CLI](https://developers.openai.com/codex/), or set `CODEX_BIN` to its full path. Until then the Director routes reviews to the default Opus `reviewer` (see "Review engines"). |
| `REVIEW_UNAVAILABLE: Codex exited with status …` | Usually auth — export `OPENAI_API_KEY` or run `codex login`. Can also be an unsupported flag on your Codex version (check `codex exec --help`, then adjust via `ORCHESTRA_REVIEW_ARGS`) or a sandbox restriction. The DETAIL block quotes Codex's stderr. If a Codex self-update stripped files the install needs, point `codex.helpersDir` at known-good copies — the runner restores them before each run. |
| `REVIEW_UNAVAILABLE: review timed out` despite setting a longer timeout | The setting didn't reach the runner. A subagent's shell doesn't persist between tool calls, so an `export` in an earlier call is gone by launch time — and a timeout named only in the work order's prose was never a setting at all. Put it in `.claude/orchestra.json` (`"codex": { "reviewTimeoutMs": 1800000 }`); the verdict header reports the cap actually applied and its source, so check for `(default)` there. |
| `REVIEW_UNAVAILABLE: working tree is not idle` | Working as intended — an executor, build, or watch task was still writing the tree, and a review of a moving tree reports on a state that no longer exists. Wait for the other work to finish and re-run. Disable with `ORCHESTRA_REVIEW_IDLE_MS=0` if your workflow makes the check impractical. |
| Reviewer burns the whole timeout running a suite it was told to skip | A polite "skip the tests" in the order gets overridden by the reviewer's own judgment. Forbid it outright instead: `--no-tests`, `--forbid "<command>"`, or `"codex": { "doNotRun": [...] }`. The affected claims come back as `UNVERIFIED (prohibited: …)` so the narrowed review reports itself as narrowed. |
| Reviewer runs but the tests don't execute | (`reviewer-codex`) Codex's `read-only` sandbox can't run commands that write. Leave `ORCHESTRA_REVIEW_SANDBOX` at its `workspace-write` default so the suite can run. |
| Verdict carries an `⚠ INTEGRITY WARNING` | The cross-vendor reviewer (`reviewer-codex`) modified the working tree while running. Have the scout diff the tree against the intended change; the reviewer isn't supposed to write. Set `ORCHESTRA_REVIEW_SANDBOX=read-only` if you need to forbid it outright. |
| `/deep-plan` returns `VERDICT: DEEPPLAN_UNAVAILABLE` | The DETAIL block states why: `OPENAI_API_KEY` not set, HTTP 401 (bad key), HTTP 400/404 (model or effort not available to your key — override with `model=`/`effort=` or the `ORCHESTRA_DEEPPLAN_*` env vars), a timeout (raise `ORCHESTRA_DEEPPLAN_TIMEOUT_MS` or lower the effort), or truncation (raise `ORCHESTRA_DEEPPLAN_MAX_TOKENS`). Until fixed, the Director proceeds solo and marks the plan as not cross-examined. |

## Design notes

- **Why a hook and not just instructions?** Under pressure ("just quickly fix the import"), models drift toward doing work themselves. The hook makes drift impossible instead of discouraged; the denial message itself re-points the Director at the right agent.
- **Why does the guard read the transcript for the model?** The protocol already tells non-director sessions to act normally, but instructions can't unblock a hook — without detection, a Sonnet session would be told "you're dormant" and then denied every Edit. So before denying, the guard tail-reads the session transcript (fixed cost, sub-millisecond, regardless of transcript size), takes the latest non-sidechain assistant turn's model, and stands down for non-directors. An undetermined model resolves to *enforce*: the harness can drop out only on positive evidence of a non-director model, never by accident on a director. Reading the *latest* turn (rather than trusting the session's static self-image) also means mid-session `/model` switches are honored.
- **Why can the Director write plans and memory itself?** Both are the Director's own thinking: a plan decomposes the work, a memory entry distills the conversation, and only the Director holds either. Delegating them buys no independence — the executor would transcribe text the Director composed — and costs a subagent round-trip per write; blocking memory even broke Claude Code's built-in auto-memory. The guard still fences the one dangerous inch of those files: the managed Orchestra block in `CLAUDE.md`, which stays user-only because it's the harness's own wiring (§6 reserves disabling the harness for you).
- **Why can the Director still Read?** Users hand the Director screenshots, specs, and reports that inform decisions. Decision-relevant reading is directing; exploratory reading is scouting — the protocol draws that line, and the scout and detective do all discovery.
- **Why a detective role instead of one smarter scout?** Recon quality is asymmetric. Most missions are mechanical retrieval, where Haiku is fast, cheap, and parallel — but the causal minority steers the plan, and recon is the one output no reviewer checks. Splitting the tiers keeps the fan-out economics of cheap scouts while giving *why/how* questions the same treatment as review verdicts: the most capable model, deliberately routed. The prompts genuinely differ too — the scout enumerates facts; the detective kills hypotheses — so this is two roles, not one role with a model knob.
- **Why is the default reviewer Opus, with cross-vendor as an option?** Self-review inside the planning context inherits the planner's blind spots — independence starts with a fresh context. The `reviewer` provides that: a fresh Opus context reviewing a Sonnet-authored change, re-running the tests itself, which captures most of what independent review buys. A different-vendor reviewer (OpenAI via Codex) decorrelates one layer further — same-vendor models share training lineage — so `reviewer-codex` exists for gate-class second opinions, or as a primary engine for projects that want it. It is optional rather than default because the residual decorrelation is incremental over fresh-context different-model review, while the dependency it adds (external CLI, auth, separate billing) can leave review unavailable exactly when you need it.
- **Why is `reviewer-codex` a Claude launcher instead of calling OpenAI directly?** The Director is guard-blocked from Bash, so it can't shell out to Codex itself, and there's no OpenAI tool in its toolbox. A thin subagent (exempt from the guard) runs Codex and relays the verdict — which keeps review delegated and keeps the judgment cross-vendor, without weakening the guard or handing the Director a new way to do work itself.
- **Why are packs opt-in rather than installed-and-idle?** The earlier design installed both review engines everywhere and made the *choice* a config value, on the reasoning that swapping engines shouldn't need a reinstall. That's still true once a pack is present — but it meant every project carried an OpenAI surface it might never use: two agents in the roster, two runners on disk, and a set of failure modes that only matter if you opted in. Packs move the decision to install time without giving up hot-swapping after it, and they generalize: anything with an external dependency (another vendor's CLI, a house toolchain) becomes a directory you drop in rather than a special case in the installer. The cost is honest — selecting an engine whose pack isn't installed is now a configuration error rather than a no-op — which is why the installer records your selection and `/orchestra-status` reports it.
- **Why does the runner enforce settings mechanically instead of trusting the launcher?** Because prose isn't configuration, and the field proved it twice. A work order asking for a longer timeout changes nothing unless something turns it into a value; a launcher that exports an environment variable in one tool call loses it before the next, since subagent shells don't persist. Both failures look identical from the outside — a review that dies at the default timeout while everyone believes the setting was applied. The fix is layered: durable settings live in a file that no shell can forget, per-run settings ride the runner's own command line, and the verdict header always names the value that was actually applied and where it came from. The same principle covers prohibitions (a hard constraint that outranks the brief's own rules, with an honest place to record what went unverified) and the install itself (resolve the real binary path, restore what a self-update stripped) — every one of them a thing that used to depend on someone remembering.

## License

[MIT](LICENSE) — use, modify, and distribute freely with attribution; no warranty.
