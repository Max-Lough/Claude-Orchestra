# Packs — optional Orchestra modules

A **pack** is a self-contained bundle of harness parts that a project may or may
not want: agents, hook runners, and skills that belong together and share a
dependency the core harness does not have.

The core harness — Director law, scout/detective/executor/reviewer, the guard,
and the `orchestra-*` skills — is always installed. Everything in `packs/` is
opt-in:

```bash
node install.js /path/to/project --packs codex
```

Nothing here installs unless it is named. A project that never passes `--packs`
gets a harness with no OpenAI surface at all, no missing-dependency warnings,
and no files it did not ask for.

## Available packs

| Pack | What it adds | Needs |
|---|---|---|
| `codex` | Cross-vendor review (`reviewer-codex` → Codex CLI) and the two-model `/deep-plan` roundabout (`planner-gpt` → OpenAI API) | Codex CLI and/or `OPENAI_API_KEY` |

## Layout contract

```
packs/<name>/
├── pack.json          ← metadata (required)
├── agents/*.md        ← subagents, copied to .claude/agents/
├── hooks/*.js         ← runners, copied to .claude/hooks/
├── skills/<skill>/    ← skills, copied to .claude/skills/<skill>/
└── README.md          ← optional, for humans reading the master
```

The installer **discovers files by walking those directories** — `pack.json`
never lists them. Add a file to `agents/`, and it installs; delete it, and the
next install stops stamping it. That means the master is always the single
source of truth for what a pack owns, which is also how `--uninstall` knows
what to remove.

`pack.json` carries only metadata:

```json
{
  "name": "<must match the directory name>",
  "title": "Short human-readable name",
  "summary": "One or two sentences shown by the installer.",
  "requires": { "bin": ["..."], "env": ["..."] },
  "notes": ["Printed after a successful install — setup the user still owes."]
}
```

Everything except `name` is optional.

## Rules a pack must follow

1. **Degrade, never fail.** A pack's runner must never crash the harness when
   its dependency is absent. Return an explicit `*_UNAVAILABLE` verdict with
   the reason, exactly as `orchestra-review.js` and `orchestra-deepplan.js` do
   — a capability that could not run must never read as a success.
2. **Nothing outside the harness may hard-depend on a pack.** The protocol,
   the guard, and the core agents must all work with zero packs installed.
   Reference pack roles conditionally ("if the codex pack is installed").
3. **Skills stay orchestration-class.** Pack skills load into the Director's
   context like any other, so their steps dispatch agents rather than assuming
   the session's own hands (ORCHESTRA.md §7).
4. **Name files distinctly.** Pack files land in the same `.claude/agents/`,
   `.claude/hooks/`, and `.claude/skills/` directories as the core harness, so
   a colliding filename would overwrite core harness parts. The installer
   refuses to install a pack whose file names collide with the core set.

## Minting a new pack

Copy `_TEMPLATE/` to `packs/<your-pack>/`, edit `pack.json`, drop your agents,
hooks, and skills into the matching subdirectories, and add a row to the table
above. No installer changes are needed — discovery is automatic.
