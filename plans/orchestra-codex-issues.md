# Astra / Codex lane issues to address in the Orchestra master repo

Running list kept by the Director during the ADR-0005 campaign (2026-09-06). Each entry:
what happened, evidence, and the fix the master repo should carry. Harness in use: v3.2.0,
Codex CLI 0.153.2, `.claude/orchestra.json` with `codex.worktreeRoot` + `helpersDir`.

## Exec lane (orchestra_exec / executor-codex-principal)

1. **No GitHub credentials inside the exec sandbox.** `git fetch origin` → `could not read
   Username for 'https://github.com'`; `gh auth status` → token invalid; `ssh -T
   git@github.com` → publickey denied. Any order with a fetch/push Part 0 dies at PART 0.
   Workaround used: forbid `git fetch`/`git push`/`gh` in the order, rely on refs already
   local in the worktree, push from a Claude executor afterwards.
   Fix: runner passes the host credential helper / `GH_TOKEN` through to the engine child, or
   performs fetch-before / push-after itself outside the sandbox and reports the SHAs.

2. **Principal launcher defaulted to Sol/high.** First `executor-codex-principal` run printed
   `profile: heavy, model: gpt-5.6-sol (default), effort: high` — the agent definition or the
   runner does not pin Astra/xhigh; the launcher had to pass `model`/`effort` flags explicitly
   on the retry (then: `model: gpt-6-astra (flag), effort: xhigh`).
   Fix: the principal agent definition passes the model/effort flags itself, or the runner
   maps `profile: principal` → Astra/xhigh by default.

3. **Fresh Agent-tool worktrees show LFS-tracked PNGs as modified** (15 files under
   `docs/art/**` — smudge/pointer state), plus an untracked `.claude/settings.local.json`
   the harness drops in. Astra correctly refuses a "clean tree" precondition → BLOCKED twice.
   Fix: exec preflight hydrates LFS in the directed worktree (or classifies pointer-only diffs
   as artifacts in the TREE AUDIT) and keeps harness files out of the worktree or lists them
   as known artifacts in the report header.

4. **Launcher narrates options back to the Director** ("Which approach do you prefer? …
   Option 1 / Option 2") on BLOCKED instead of a bare relay. Harmless but it is not the
   launcher's job; the launcher prompt should forbid proposing remedies.

## Review lane (orchestra_review / reviewer-codex)

5. **Sol delegated a review to the Claude CLI despite "no MCP" in the brief.** PR #435 round 3
   returned an inner header `REVIEW ENGINE: Claude CLI (opus, effort: high …)` under the Sol
   outer header — the cross-family review silently became same-family. Known pattern
   ([[sol-review-delegates-to-claude-mcp]]); the fix belongs in the runner: strip the
   project-scoped review MCP from the engine child's config, not in every brief.

6. **`no_tests` is too coarse.** Round 1 of PR #435 (Python-only) was prohibited from running
   the `--self-test` the brief explicitly allowed, so verification was "narrowed" for no
   reason. Need an allowlist flag (`--allow <cmd>`) alongside `--forbid`, or `no_tests` scoped
   to the manifest's engine commands only.

7. **Preflight noise every run:** `codex install layout: unknown` for the 0.153.2 release
   folder (helper repair only via `helpersDir`), and an undeletable abandoned review worktree
   `orchestra-review-51hO4I` reported on every run. Add the release-folder layout to the known
   list; skip re-reporting a leftover already reported once.

## Cross-cutting

8. **Reviews cannot run Godot/Blender in the sandbox** (unhydrated LFS, no Blender) so every
   engine verdict on GDScript/asset work is static-only and marks executor evidence
   UNVERIFIED. Pre-hydrated LFS in review worktrees (already noted in memory) would let the
   Python checkers run; Godot remains Claude-lane.
