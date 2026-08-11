# Packs — optional Codex-native Orchestra modules

The Codex-side counterpart to the repo-root [`packs/`](../../packs/README.md)
contract, kept in its own tree because pack names and file formats don't
overlap between the two installers (`.toml` Codex agents vs. `.md` Claude
agents) — see "Why a separate tree?" below.

A **pack** is a self-contained bundle of harness parts that a project may or
may not want: agents and hook runners that belong together and share a
dependency the core Codex-native harness does not have.

The core harness — Director law, scout/detective/executor/reviewer, the guard
— is always installed. Everything in `codex/packs/` is opt-in:

```bash
node install-codex.js /path/to/project --packs claude
```

Nothing here installs unless it is named. A project that never passes
`--packs` gets a harness with no Anthropic surface at all, no
missing-dependency warnings, and no files it did not ask for.

## Available packs

| Pack | What it adds | Needs |
|---|---|---|
| `claude` | Cross-vendor review (`reviewer-claude` → Claude CLI) and a Claude counterpart for the `ultra-plan` roundabout (`planner-claude`) | Claude CLI and/or `ANTHROPIC_API_KEY` |

## Layout contract

```
codex/packs/<name>/
├── pack.json          ← metadata (required)
├── agents/*.toml       ← subagents, copied to .codex/agents/
├── hooks/*.js           ← runners, copied to .codex/hooks/
└── README.md           ← optional, for humans reading the master
```

The installer **discovers files by walking those directories** — `pack.json`
never lists them. Add a file to `agents/`, and it installs; delete it, and the
next install stops stamping it. That means the master is always the single
source of truth for what a pack owns, which is also how `--uninstall` knows
what to remove.

`pack.json` carries only metadata — identical schema to the Claude-side packs:

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
   the reason, exactly as `orchestra-review.js` and `orchestra-ultraplan.js` do
   — a capability that could not run must never read as a success.
2. **Nothing outside the harness may hard-depend on a pack.** The protocol,
   the guard, and the core agents must all work with zero packs installed.
   Reference pack roles conditionally ("if the claude pack is installed").
3. **Name files distinctly.** Pack files land in the same `.codex/agents/` and
   `.codex/hooks/` directories as the core harness, so a colliding filename
   would overwrite core harness parts. The installer refuses to install a pack
   whose file names collide with the core set.

## Minting a new pack

Copy `_TEMPLATE/` to `codex/packs/<your-pack>/`, edit `pack.json`, drop your
agents and hooks into the matching subdirectories, and add a row to the table
above. No installer changes are needed — discovery is automatic.

## Why a separate tree?

`install.js` (Claude-side) and `install-codex.js` (Codex-side) each enumerate
their own pack directory independently. Nesting Codex-side packs under
`codex/packs/` rather than reusing the repo-root `packs/` keeps that
enumeration trivially correct: `install.js` never has to skip over `.toml`
agent files it can't install, and a pack name like `claude` — which would
collide with nothing on the Claude side but means something different there
(Claude *is* the Director, not the cross-vendor guest) — never appears in the
wrong installer's listing.
