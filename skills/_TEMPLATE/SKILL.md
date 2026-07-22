---
# ── Orchestra bundled-skill template ──────────────────────────────────────
# Bundled skills ship with the harness: the installer stamps every
# skills/<name>/ directory into <project>/.claude/skills/<name>/ on every
# install (this template is skipped — the underscore prefix excludes it).
# To mint one: copy this directory to skills/<your-name>/, make `name`
# match the directory, fill every <slot>, and re-run the installer per
# project. Supporting files placed beside SKILL.md (references, checklists)
# are stamped too — the copy is recursive.
# ───────────────────────────────────────────────────────────────────────────
name: <skill-name>
description: <What it does, one sentence. Then the trigger — "Use when …" with concrete conditions; this line is how the session decides to load the skill, so make it specific.>
---

# <Skill title>

<One paragraph: what invoking this skill accomplishes.>

Bundled skills load into the MAIN session. Under the Orchestra that is the **Director**, whom the guard blocks from editing files, running commands, and searching — so a bundled skill must be **orchestration-class** (ORCHESTRA.md §7): its steps advise, decide, and dispatch. They never assume the session's own hands.

## Authoring rules

1. **Delegation-shaped steps.** Filesystem facts → "dispatch a scout for …". Causal analysis → "open a detective case on …". Mutations → "send the executor a work order that …". Verdicts → the reviewer. The only direct file access a step may assume: Writes of markdown under `.claude/plans/`, and the Reads §3.1 explicitly permits (user-handed files, agent artifacts, `.claude/orchestra.json`).
2. **Fork on mode once, at the top.** State that under a director model the steps run delegated, and that a dormant or paused session runs the same steps directly with its own tools. One procedure, written delegation-shaped — never two procedures.
3. **Self-contained, like a work order.** Name exact paths, commands, formats, and the report shape; assume no conversation memory.
4. **Hands-on playbooks don't belong here.** Step-by-step tool playbooks (builds, asset pipelines, deploys) are executor material: make them project skills the executor invokes by name inside a work order, or preload them into a specialist (`agents/specialists/`) — §7's routing rule. Bundling one would land it in the one context that can't use it.

## Procedure

1. <step>
2. <step>

## Report

<The exact block or shape the skill renders back to the user.>
