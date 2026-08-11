# Pack template (Codex-native harness)

Copy this directory to `codex/packs/<your-pack>/` and edit `pack.json`.
Underscore-prefixed directories are skipped by the installer, so this template
is never installable itself.

Then create whichever of these you need — the installer discovers files by
walking the directories, so nothing needs registering anywhere:

```
codex/packs/<your-pack>/
├── pack.json          ← required; `name` must match the directory name
├── agents/*.toml       ← subagents      → .codex/agents/
└── hooks/*.js          ← runners        → .codex/hooks/
```

Install it with:

```bash
node install-codex.js /path/to/project --packs <your-pack>
```

Read `codex/packs/README.md` for the rules a pack must follow — chiefly:
degrade to an explicit `*_UNAVAILABLE` result when your dependency is missing,
and never make the core harness depend on you. This directory is deliberately
separate from the Claude-side `packs/` at the repo root — pack names and file
formats (`.toml` agents vs. `.md` agents) don't overlap between the two
installers, so keeping them in separate trees avoids any collision or
cross-installer confusion.
