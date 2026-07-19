# Orchestra

A transferable multi-agent harness for Claude Code. It casts the session model as a **Director** who never touches the code, and routes all actual work through a fixed company of specialist subagents:

```
                    ┌─────────────────────────────┐
                    │   DIRECTOR  (Fable / Opus)  │
                    │  decides · arbitrates ·     │
                    │  synthesizes · talks to you │
                    └──────┬──────┬──────┬────────┘
              missions     │      │      │     verdicts
           ┌───────────────┘      │      └───────────────┐
           ▼                      ▼                      ▼
   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
   │ SCOUT (Haiku) │     │EXECUTOR       │     │REVIEWER (Opus)│
   │ search · map  │     │(Sonnet)       │     │ fresh-context │
   │ read-only     │     │ all edits &   │     │ adversarial · │
   │ recon         │     │ commands      │     │ +Codex option │
   └───────────────┘     └───────────────┘     └───────────────┘
```

The Director is **hard-blocked by a PreToolUse hook** from editing files, running commands, or searching the codebase — delegation is enforced by the harness, not promised by a prompt. Subagents are unaffected by the block. The guard is model-aware: it enforces only when a director model (Fable/Opus) is at the helm — Sonnet/Haiku sessions run as plain Claude Code. One authoring carve-out: the Director may write **plan files** — markdown under `.claude/plans/` — itself; plans are Director thinking, not execution (see "Plan files" below).

## Two modes, selected automatically

| | MODE A | MODE B (fallback) |
|---|---|---|
| Session launched as | Fable | Opus (`claude --model opus`) |
| Director | Fable | Opus |
| Review | `reviewer` agent → **Opus, fresh context** (re-runs the tests); optional `reviewer-codex` (OpenAI via Codex CLI) second opinion at gates | same `reviewer` (fresh context — the change's author is Sonnet, not the Director); Opus arbitrates verdicts critically, same optional `reviewer-codex` layer |
| Scout / Executor | Haiku / Sonnet | Haiku / Sonnet |

Mode detection is automatic and two-layered: the protocol tells the session to identify its own model, and the guard hook independently reads the live model from the session transcript, enforcing only on positive evidence of a director model. Launched with Sonnet or Haiku, the Orchestra goes dormant and says so — the guard stands down too, so a Sonnet/Haiku session is a plain Claude Code session with no denials and no pause file (even on the first turn, before the model reaches the transcript). A mid-session `/model` switch is picked up one turn later; on a director's opening turn, delegation is carried by the protocol instructions until enforcement engages on turn two.

Every **substantive** change (logic, config, dependencies, data, API surface) gets adversarial review before the Director reports it done. Two failed review cycles force a re-plan instead of a third retry.

## Review engines

Review has two engines, both under one identical contract — adversarial brief, tier verification, the `verification` manifest, and the Orchestra verdict format:

- **`reviewer` (Opus, fresh context) — the default, both modes.** A different model from the Sonnet executor that authored the change, sharing none of the author's context, re-running the tests itself. Fresh eyes plus independent verification is where most of review's value lives.
- **`reviewer-codex` (OpenAI via Codex CLI) — the optional cross-vendor layer.** Models from one vendor share training lineage and some error modes; a different-vendor reviewer breaks that residual correlation. It is deliberately optional rather than default: the marginal independence is real but incremental over a fresh-context Opus review, and it adds an external dependency (Codex CLI installed and authenticated, separate billing, its own failure modes). Recommended as a second-opinion pass at gate-class reviews (integration gates, a chain's final review) — or as a project's primary engine if you prefer; tell the Director. Mechanically it's a thin Claude launcher (Haiku) driving Codex, which is agentic: it reads the actual diff and the surrounding code, **re-runs the tests itself** in a sandbox, and returns a verdict the launcher relays verbatim — the launcher never reviews the code itself, and the Director (blocked from Bash) can't invoke Codex directly, so review stays delegated.

**Setup (only needed for `reviewer-codex`).** In the environment where Orchestra runs, install the [Codex CLI](https://developers.openai.com/codex/) and authenticate it — either export `OPENAI_API_KEY` or run `codex login`. Nothing else is required; the runner ships with the harness (`.claude/hooks/orchestra-review.js`).

**Configuration** (all optional, via environment):

| Variable | Default | Meaning |
|---|---|---|
| `ORCHESTRA_REVIEW_MODEL` | Codex's own default | Pin a specific OpenAI model for review. |
| `ORCHESTRA_REVIEW_SANDBOX` | `workspace-write` | Codex sandbox. `workspace-write` lets the reviewer run the test suite (most runners need to write caches/temp/coverage). Set `read-only` for a hard no-write guarantee — at the cost that many suites won't run under it. |
| `ORCHESTRA_REVIEW_TIMEOUT_MS` | `600000` | Wall-clock cap for a review (it runs your tests). |
| `ORCHESTRA_REVIEW_ARGS` | — | Extra args appended to `codex exec` (escape hatch for flag drift / tuning). |
| `CODEX_BIN` | `codex` | Path to the Codex executable. |

**Tiered review (`--tier`).** Every review runs at full depth by default — the reviewer re-runs the tests itself. For a round the Director declares **inert** (docs/comments/formatting with zero behavior impact), the review order states `TIER: inert` and the launcher appends `--tier inert`; the runner then instructs the reviewer to *verify the inertness claim from the diff first* — any behavior-bearing line is itself a critical finding and forces a full-depth review — and only a proven-inert diff skips the suite. Effectiveness is never traded for speed: the tier narrows verification only where narrowing provably cannot matter, and the prover is whoever reviews — the Opus `reviewer`, the Codex engine, or the protocol's last-resort fallback — never the author. The tier appears in the `REVIEW ENGINE` header of both engines so every verdict is auditable for the depth it ran at. The tier and the `verification` manifest are engine-agnostic review *policy* (`ORCHESTRA.md` §8.3); the Opus `reviewer` enforces them through its own rules, this runner implements them for the Codex engine, and the §5 fallback applies them by hand.

**Why `workspace-write` by default?** The reviewer's whole value is that it runs the real tests, and most test runners write (caches, coverage, build artifacts). This is the same trust model as before — the previous Opus reviewer also had unrestricted shell and was only *told* not to edit — but the runner adds a safety net the old design lacked: it fingerprints the working tree before and after, and if the reviewer mutated anything it appends a loud **`⚠ INTEGRITY WARNING`** to the verdict (it never auto-reverts, which could clobber the real change). For a hard guarantee, set `ORCHESTRA_REVIEW_SANDBOX=read-only`.

**Graceful degradation.** If Codex isn't installed, isn't authenticated, times out, or errors, `reviewer-codex` returns `VERDICT: REVIEW_UNAVAILABLE` with the reason — never a fake approval. The Director routes that review to the Opus `reviewer` and notes the cross-vendor pass didn't run. A harnessed project with no Codex simply has no cross-vendor option — it still gets full fresh-context adversarial review, and it never silently ships unreviewed work as reviewed.

## Layout

```
Orchestra/
├── README.md              ← you are here
├── ORCHESTRA.md           ← the Director protocol (imported into the project's CLAUDE.md)
├── install.js             ← idempotent installer/uninstaller (Node)
├── install.ps1            ← thin PowerShell wrapper
├── install.sh             ← thin POSIX wrapper
├── agents/
│   ├── scout.md           ← Haiku · read-only recon
│   ├── executor.md        ← Sonnet · all edits and commands
│   ├── reviewer.md        ← Opus · fresh-context adversarial review (default engine)
│   ├── reviewer-codex.md  ← Haiku launcher · optional cross-vendor (OpenAI/Codex) engine
│   └── specialists/       ← domain executors, installed on request (--specialists)
│       ├── _TEMPLATE.md   ← copy this to mint a new specialist
│       └── modeler.md     ← Sonnet · Blender/Godot 3D asset pipeline
└── hooks/
    ├── orchestra-guard.js  ← PreToolUse hook enforcing Director law
    └── orchestra-review.js ← cross-vendor review runner (drives Codex CLI)
```

This folder is the **master copy**. Projects get stamped copies; to change the system, edit here and re-run the installer per project.

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
```

```bash
# POSIX (macOS/Linux):
git clone https://github.com/Max-Lough/Claude-Orchestra.git && cd Claude-Orchestra
./install.sh /path/to/your/project
```

The installer is **idempotent** — run it again anytime to update a project to the latest master. It:

1. Copies `agents/*.md` → `<project>/.claude/agents/`
2. Copies `hooks/orchestra-guard.js` and `hooks/orchestra-review.js` → `<project>/.claude/hooks/`
3. Copies `ORCHESTRA.md` → `<project>/.claude/ORCHESTRA.md`
4. Merges the PreToolUse hook entry into `<project>/.claude/settings.json` (preserving whatever else is there)
5. Merges git permission grants (`Bash(git add:*)`, `Bash(git commit:*)`, `Bash(git push:*)`) into `permissions.allow` in that same `settings.json`, so the executor can commit and push when a work order tells it to
6. Ensures the project's `CLAUDE.md` contains the Orchestra import line (added inside `<!-- ORCHESTRA:BEGIN/END -->` markers)

**First launch after install:** Claude Code will ask you to approve the hook that project settings define — approve it once and it sticks. If teammates shouldn't inherit the harness, move the hook entry from `settings.json` to `settings.local.json` (git-ignored).

**Why the git grants are needed:** subagents don't see your conversation. When the Director relays "the user asked me to push" inside a work order, that quoted instruction is not a user turn in the executor's own transcript, so the permission classifier refuses `git commit`/`git push` — it only accepts authorization it can see natively, or a settings-level grant. The `permissions.allow` entries are that grant. Remove or narrow them (e.g. drop `git push`) if you'd rather approve pushes by hand each session; the Director itself is still barred from Bash entirely by the guard hook, so the grants empower only the agents.

### Uninstall

```powershell
node install.js "C:\path\to\your\project" --uninstall
```

Removes the copied files, the hook entry, the git permission grants, and the CLAUDE.md marker block. Everything else in your settings and CLAUDE.md is left untouched. (If you had independently added identical `Bash(git …:*)` allow rules, re-add them after uninstalling.)

## Using it

Nothing to invoke — just start Claude Code in the project. The protocol loads with CLAUDE.md, the session detects its mode, and requests flow through the loop:

**INTAKE → RECON → PLAN → EXECUTE → REVIEW → REPORT**

You'll see the Director narrate phase transitions and spawn agents; the agents' raw reports stay behind the curtain, and the Director gives you the synthesized picture with evidence (tests run, review verdicts).

## Pausing the harness

Sometimes you want a plain session in an Orchestra project (quick one-liner fix, debugging the harness itself):

```powershell
# In YOUR terminal, at the project root — pause:
New-Item -ItemType File .claude\orchestra.pause
# resume:
Remove-Item .claude\orchestra.pause
```

Or launch with the env var: `ORCHESTRA_PAUSE=1 claude`. You can also ask the Director to pause — creating that file is permitted by the hook (its only write exception besides plan files), and only at your explicit request. The Director is instructed never to pause on its own initiative.

## Plan files

The plan is the one artifact the Director authors itself — routing "write my own plan to disk" through an executor wastes a subagent and loses fidelity. So the guard carves out **`.claude/plans/`**: the Director may `Write`/`Edit` markdown files there directly (that directory, `.md` only, path-traversal checked — it can't become a general write loophole). Everything else remains delegated.

If your project keeps plans elsewhere (say `docs/plans/`), add `directorPlanPatterns` to `.claude/orchestra.json` — regexes over the project-relative path, additive to the default location:

```json
{
  "directorPlanPatterns": ["^docs/plans/.+\\.md$"]
}
```

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
- `verification` — optional verification manifest: `{ "full": "<command>", "lint": "<command>", "shards": ["<command>", …], "protected": ["<suite>", …] }`. It is the canonical command set for every verifier: executors run it, the review runner injects it into the Codex brief, and a fallback review judges pasted verification against it. The Director uses it to declare review tiers, scope mid-chain verification to touched + protected shards, and brief executors on concurrent shard runs (`ORCHESTRA.md` §8.3). Typically written once by a verification-profile micro-order that times the tree and maps its seams.
- The file is optional, user-authored, and fail-open: a broken `orchestra.json` disables only itself — the default blocklist still applies. The uninstaller leaves it in place.

**Working rhythm for iterative pipelines** (also in §7): iteration loops live *inside* one work order ("iterate until it matches the ref or 4 rounds, report best"); long campaigns keep one specialist warm via SendMessage instead of respawning; renders/screenshots/logs are the review artifacts — both the Director and the reviewer can Read images; asset batches go to the reviewer as one checklist pass with one verdict.

## Sizing, cadence, and the verification tax

`ORCHESTRA.md` §8 governs how big a work order gets and what a long one owes the Director while it runs. The short version:

- **Sizing gate at PLAN.** One deliverable kind per order; "author a tool" + "migrate its consumers" always splits; >~3 subsystems or >~5 report sections → split. A well-sized order is one executor run (~≤80 tool calls) and one review round. Shipping atomicity lives at the branch and its integration gate — never inside one context window.
- **Cadence inside long orders.** Any deliberately-bundled order carries heartbeats (per-part checkpoint commit + one-line progress append the Director can poll), a tool-call budget as health telemetry, and the `CHECKPOINT` status — a *successful* stop at a part boundary when the order outgrows its budget or the context compacts. Checkpoints are externalized memory: they survive compaction and turn a late failure into "resume from part N".
- **The verification tax.** The full test tree is the dominant recurring wall-clock cost, paid at least twice per round by design (executor verifies, reviewer independently re-verifies — that redundancy is never trimmed). The levers: cut *round count*, tier only provably-inert rounds (verified by the reviewer, above), profile the tree once into the `verification` manifest, and commission a verification-speed work order (shard/parallelize/cache the suite) when the ledger shows the tree dominating round latency — per-run duration is a project property, and fixing it pays back on every future round in every future session.

These rules optimize **effectiveness and wall-clock**, not cost — the harness's cost savings are already structural (see below), and effectiveness is never traded away for either.

## Cost expectations

This trades tokens for quality and control, deliberately:

- **Recon is cheap** (Haiku) and **execution is mid-priced** (Sonnet) — the volume work runs on the economical models.
- **Review runs on Opus** by default — deliberately the most capable regular call in the company, because verdict quality is what the harness optimizes for. The optional `reviewer-codex` engine is billed to your **OpenAI** account (a separate meter); its Claude side is just a negligible Haiku launcher. Pick the OpenAI review model with `ORCHESTRA_REVIEW_MODEL`.
- The Director's own turns are decision-dense and short; the expensive model at the top writes the least text.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Orchestra: the Director does not use X" denials | Working as intended on Fable/Opus — the session should delegate. On Sonnet/Haiku the guard stands down automatically, including on a fresh session's first turn (the guard enforces only on positive evidence of a director model). Any denial on Sonnet/Haiku means model detection failed — pause (above) and file a bug against the master. |
| Hook seems inactive | Did you approve project hooks at first launch? Check `/hooks` in Claude Code; confirm `.claude/settings.json` has the `orchestra-guard` entry. |
| Executor/scout getting blocked | Should never happen — project-settings PreToolUse hooks fire only for the main session, and the guard additionally exempts any call carrying subagent identity (`agent_id`/`agent_type`). If it does, pause the harness and re-run the installer to get the latest guard; failing that, file it as a bug against the master copy. |
| Executor denied on `git commit` / `git push` | The permission classifier won't accept user authorization relayed through a work order — it needs a settings-level grant. Re-run the installer: it now merges `Bash(git add:*)`, `Bash(git commit:*)`, `Bash(git push:*)` into `permissions.allow` in `.claude/settings.json`. Check those entries survived if you've hand-edited settings. |
| `node` not found when hook fires | Claude Code itself runs on Node, but the hook shell needs `node` on PATH. Install Node or add it to PATH. |
| Session model is Sonnet/Haiku | Orchestra goes dormant by design — protocol and guard both stand down, leaving a normal session. Relaunch as Fable, or `claude --model opus` for MODE B. |
| Skill/slash-command in a harnessed session wants to edit files | That's a hands-on skill in the Director's context — route it per ORCHESTRA.md §7: a specialist with the skill preloaded, or a work order telling the executor to invoke it. Pausing works too, but forfeits the harness for that stretch. |
| Director drives MCP tools (Blender, DBs, …) directly | Instruction rule §7 should stop it; to enforce, add the server's pattern to `directorBlockedPatterns` in `.claude/orchestra.json` (see "Specialists & hands-on skills"). |
| Review comes back `REVIEW_UNAVAILABLE: Codex CLI not found` | (`reviewer-codex` only) Codex isn't installed / not on PATH in this environment. Install the [Codex CLI](https://developers.openai.com/codex/), or set `CODEX_BIN` to its full path. Until then the Director routes reviews to the default Opus `reviewer` (see "Review engines"). |
| `REVIEW_UNAVAILABLE: Codex exited with status …` | Usually auth — export `OPENAI_API_KEY` or run `codex login`. Can also be an unsupported flag on your Codex version (check `codex exec --help`, then adjust via `ORCHESTRA_REVIEW_ARGS`) or a sandbox restriction. The DETAIL block quotes Codex's stderr. |
| Reviewer runs but the tests don't execute | (`reviewer-codex`) Codex's `read-only` sandbox can't run commands that write. Leave `ORCHESTRA_REVIEW_SANDBOX` at its `workspace-write` default so the suite can run. |
| Verdict carries an `⚠ INTEGRITY WARNING` | The cross-vendor reviewer (`reviewer-codex`) modified the working tree while running. Have the scout diff the tree against the intended change; the reviewer isn't supposed to write. Set `ORCHESTRA_REVIEW_SANDBOX=read-only` if you need to forbid it outright. |

## Design notes

- **Why a hook and not just instructions?** Under pressure ("just quickly fix the import"), models drift toward doing work themselves. The hook makes drift impossible instead of discouraged; the denial message itself re-points the Director at the right agent.
- **Why does the guard read the transcript for the model?** The protocol already tells non-director sessions to act normally, but instructions can't unblock a hook — without detection, a Sonnet session would be told "you're dormant" and then denied every Edit. So before denying, the guard tail-reads the session transcript (fixed cost, sub-millisecond, regardless of transcript size), takes the latest non-sidechain assistant turn's model, and stands down for non-directors. An undetermined model resolves to *enforce*: the harness can drop out only on positive evidence of a non-director model, never by accident on a director. Reading the *latest* turn (rather than trusting the session's static self-image) also means mid-session `/model` switches are honored.
- **Why can the Director still Read?** Users hand the Director screenshots, specs, and reports that inform decisions. Decision-relevant reading is directing; exploratory reading is scouting — the protocol draws that line, and the scout does all discovery.
- **Why is the default reviewer Opus, with cross-vendor as an option?** Self-review inside the planning context inherits the planner's blind spots — independence starts with a fresh context. The `reviewer` provides that: a fresh Opus context reviewing a Sonnet-authored change, re-running the tests itself, which captures most of what independent review buys. A different-vendor reviewer (OpenAI via Codex) decorrelates one layer further — same-vendor models share training lineage — so `reviewer-codex` exists for gate-class second opinions, or as a primary engine for projects that want it. It is optional rather than default because the residual decorrelation is incremental over fresh-context different-model review, while the dependency it adds (external CLI, auth, separate billing) can leave review unavailable exactly when you need it.
- **Why is `reviewer-codex` a Claude launcher instead of calling OpenAI directly?** The Director is guard-blocked from Bash, so it can't shell out to Codex itself, and there's no OpenAI tool in its toolbox. A thin subagent (exempt from the guard) runs Codex and relays the verdict — which keeps review delegated and keeps the judgment cross-vendor, without weakening the guard or handing the Director a new way to do work itself.

## License

[MIT](LICENSE) — use, modify, and distribute freely with attribution; no warranty.
