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
   │ search · map  │     │(Sonnet)       │     │ adversarial   │
   │ read-only     │     │ all edits &   │     │ review, runs  │
   │ recon         │     │ commands      │     │ tests itself  │
   └───────────────┘     └───────────────┘     └───────────────┘
```

The Director is **hard-blocked by a PreToolUse hook** from editing files, running commands, or searching the codebase — delegation is enforced by the harness, not promised by a prompt. Subagents are unaffected by the block. The guard is model-aware: it enforces only when a director model (Fable/Opus) is at the helm — Sonnet/Haiku sessions run as plain Claude Code.

## Two modes, selected automatically

| | MODE A | MODE B (fallback) |
|---|---|---|
| Session launched as | Fable | Opus (`claude --model opus`) |
| Director | Fable | Opus |
| Review | `reviewer` agent (Opus, fresh context) | Opus owns review judgment; still spawns `reviewer` for substantive changes, may self-review small low-risk ones |
| Scout / Executor | Haiku / Sonnet | Haiku / Sonnet |

Mode detection is automatic and two-layered: the protocol tells the session to identify its own model, and the guard hook independently reads the live model from the session transcript. Launched with Sonnet or Haiku, the Orchestra goes dormant and says so — the guard stands down too, so a Sonnet/Haiku session is a plain Claude Code session with no denials and no pause file. A mid-session `/model` switch is picked up one turn later.

Every **substantive** change (logic, config, dependencies, data, API surface) gets adversarial review before the Director reports it done. Two failed review cycles force a re-plan instead of a third retry.

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
│   ├── reviewer.md        ← Opus · adversarial verification
│   └── specialists/       ← domain executors, installed on request (--specialists)
│       ├── _TEMPLATE.md   ← copy this to mint a new specialist
│       └── modeler.md     ← Sonnet · Blender/Godot 3D asset pipeline
└── hooks/
    └── orchestra-guard.js ← PreToolUse hook enforcing Director law
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
2. Copies `hooks/orchestra-guard.js` → `<project>/.claude/hooks/`
3. Copies `ORCHESTRA.md` → `<project>/.claude/ORCHESTRA.md`
4. Merges the PreToolUse hook entry into `<project>/.claude/settings.json` (preserving whatever else is there)
5. Ensures the project's `CLAUDE.md` contains the Orchestra import line (added inside `<!-- ORCHESTRA:BEGIN/END -->` markers)

**First launch after install:** Claude Code will ask you to approve the hook that project settings define — approve it once and it sticks. If teammates shouldn't inherit the harness, move the hook entry from `settings.json` to `settings.local.json` (git-ignored).

### Uninstall

```powershell
node install.js "C:\path\to\your\project" --uninstall
```

Removes the copied files, the hook entry, and the CLAUDE.md marker block. Everything else in your settings and CLAUDE.md is left untouched.

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

Or launch with the env var: `ORCHESTRA_PAUSE=1 claude`. You can also ask the Director to pause — creating that one file is the only write the hook permits it, and only at your explicit request. The Director is instructed never to pause on its own initiative.

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
- The file is optional, user-authored, and fail-open: a broken `orchestra.json` disables only itself — the default blocklist still applies. The uninstaller leaves it in place.

**Working rhythm for iterative pipelines** (also in §7): iteration loops live *inside* one work order ("iterate until it matches the ref or 4 rounds, report best"); long campaigns keep one specialist warm via SendMessage instead of respawning; renders/screenshots/logs are the review artifacts — both the Director and the reviewer can Read images; asset batches go to the reviewer as one checklist pass with one verdict.

## Cost expectations

This trades tokens for quality and control, deliberately:

- **Recon is cheap** (Haiku) and **execution is mid-priced** (Sonnet) — the volume work runs on the economical models.
- **Review is premium** (Opus on every substantive change). That's the point of the design — but for a long session of tiny changes, expect review to dominate spend.
- The Director's own turns are decision-dense and short; the expensive model at the top writes the least text.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Orchestra: the Director does not use X" denials | Working as intended on Fable/Opus — the session should delegate. On Sonnet/Haiku the guard stands down automatically (one denial is possible on the very first turn of a fresh session, before the model reaches the transcript; it clears next turn). Persistent denials on Sonnet/Haiku mean model detection failed — pause (above) and file a bug against the master. |
| Hook seems inactive | Did you approve project hooks at first launch? Check `/hooks` in Claude Code; confirm `.claude/settings.json` has the `orchestra-guard` entry. |
| Executor/scout getting blocked | Should never happen — project-settings PreToolUse hooks fire only for the main session, and the guard additionally exempts any call carrying subagent identity (`agent_id`/`agent_type`). If it does, pause the harness and re-run the installer to get the latest guard; failing that, file it as a bug against the master copy. |
| `node` not found when hook fires | Claude Code itself runs on Node, but the hook shell needs `node` on PATH. Install Node or add it to PATH. |
| Session model is Sonnet/Haiku | Orchestra goes dormant by design — protocol and guard both stand down, leaving a normal session. Relaunch as Fable, or `claude --model opus` for MODE B. |
| Skill/slash-command in a harnessed session wants to edit files | That's a hands-on skill in the Director's context — route it per ORCHESTRA.md §7: a specialist with the skill preloaded, or a work order telling the executor to invoke it. Pausing works too, but forfeits the harness for that stretch. |
| Director drives MCP tools (Blender, DBs, …) directly | Instruction rule §7 should stop it; to enforce, add the server's pattern to `directorBlockedPatterns` in `.claude/orchestra.json` (see "Specialists & hands-on skills"). |

## Design notes

- **Why a hook and not just instructions?** Under pressure ("just quickly fix the import"), models drift toward doing work themselves. The hook makes drift impossible instead of discouraged; the denial message itself re-points the Director at the right agent.
- **Why does the guard read the transcript for the model?** The protocol already tells non-director sessions to act normally, but instructions can't unblock a hook — without detection, a Sonnet session would be told "you're dormant" and then denied every Edit. So before denying, the guard tail-reads the session transcript (fixed cost, sub-millisecond, regardless of transcript size), takes the latest non-sidechain assistant turn's model, and stands down for non-directors. An undetermined model resolves to *enforce*: the harness can drop out only on positive evidence of a non-director model, never by accident on a director. Reading the *latest* turn (rather than trusting the session's static self-image) also means mid-session `/model` switches are honored.
- **Why can the Director still Read?** Users hand the Director screenshots, specs, and reports that inform decisions. Decision-relevant reading is directing; exploratory reading is scouting — the protocol draws that line, and the scout does all discovery.
- **Why does MODE B still spawn a reviewer?** Self-review inside the planning context inherits the planner's blind spots. A fresh-context Opus reviewer that re-runs the tests is independent in the ways that matter, even though it's the same model family.

## License

[MIT](LICENSE) — use, modify, and distribute freely with attribution; no warranty.
