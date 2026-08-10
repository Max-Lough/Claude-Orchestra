# Pack template

Copy this directory to `packs/<your-pack>/` and edit `pack.json`. Underscore-
prefixed directories are skipped by the installer, so this template is never
installable itself.

Then create whichever of these you need — the installer discovers files by
walking the directories, so nothing needs registering anywhere:

```
packs/<your-pack>/
├── pack.json          ← required; `name` must match the directory name
├── agents/*.md        ← subagents      → .claude/agents/
├── hooks/*.js         ← runners        → .claude/hooks/
└── skills/<skill>/    ← skills         → .claude/skills/<skill>/
                          (each skill directory needs a SKILL.md)
```

Install it with:

```bash
node install.js /path/to/project --packs <your-pack>
```

Read `packs/README.md` for the four rules a pack must follow — chiefly: degrade
to an explicit `UNAVAILABLE` result when your dependency is missing, and never
make the core harness depend on you.
