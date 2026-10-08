# Handoff: build the 3.9.0 team-leads trial (WO-1 → WO-4)

Date: 2026-10-08 · From: the session that ran WO-0 and amended the plan · Repo: `C:\Users\maxtl\projects\claude-orchestra`

## Where things stand

- **Branch:** `claude/beautiful-mayer-jcc4il` @ `011774a`, pushed. Only `plans/` differs from `origin/main`
  (3.8.0, PR #48, CI green). Local `main` is 7 commits behind `origin/main`, so diff against
  `origin/main`, not `main`.
- **Plan:** `plans/team-leads-trial.md`. WO-0 is done, and its results are in
  `plans/team-leads-probe-results.md`. The plan is amended for them (see its "WO-0 amendments"
  section). The owner approved the amendments, and they are recorded under "Resolved".
- **No open owner questions.** D13's unruled calls stand unless vetoed before WO-1b.
- **The scratch probe project is deleted.** The harness was uninstalled from it first.

## Next actions

1. Create the implementation branch from the current tip:
   `git checkout -b trial/3.9.0-team-leads` (D12: branch-only; no PR to `main`; `main` stays 3.8.0).
2. Build serially: **WO-1 → WO-1b → WO-2 → WO-3 → WO-4**. WO-1 and WO-1b share the
   `ORCHESTRA.md` company and steering tables, so they never run in parallel. WO-5 is deferred.
3. One batched cross-family review over WO-1 to WO-4, full tier, with commit-pinned base and head
   on the trial branch.
4. Install into PiratePartyPals from the trial branch (3.7.1 → 3.9.0), then run the trial protocol.

## Points that are easy to miss

These come from WO-0 and are already in the plan text, but they are the likeliest to be built wrong:

- **Lead spawns must set `run_in_background: false` explicitly.** An unset flag backgrounds the child.
  The guard denies a lead `Agent` call unless the value is exactly `false` (WO-2).
- **The budget clock never uses `SubagentStart`.** It also fires on every child-reply re-wake.
  - The state file is created on the lead's first counted call.
  - The segment restarts on a main-session `SendMessage` to the lead's agent id.
  - A lead's `SendMessage` counts as `resume`.
  - No `install.js` hook registration is needed, because the guard's empty-matcher `PreToolUse`
    already sees every call (WO-3).
- **WO-3 must first capture one real main-session `SendMessage` hook input** to pin the target
  field's name. The probe logger didn't record `tool_input`.
- **The leads' frontmatter sets `maxTurns: 60`.** A `maxTurns` stop gives no report turn, so the
  Director resumes the lead by agent id.
- **`hooks/orchestra-guard.js` has a stale comment** (around line 1039) saying PreToolUse only fires
  for the main session. WO-2 replaces it.
  - Note `if ((input.agent_id || input.agent_type) && toolName !== 'Agent') return allow();`. WO-2's
    lead rules must sit where subagent calls are still evaluated.
- **The complexity budget is ≤ ~300 lines of guard code in total** (plan, Risks).

## Verification

Each order is TIER: full. That means `node install.js --lint`, plus every suite in `tests/`:

```
node tests/frontmatter-lint.test.js
node tests/review-lane.test.js
node tests/scan-lane.test.js
node tests/exec-lane.test.js
node tests/jobrun.test.js
node tests/mcp-lane.test.js
node tests/install.test.js
node tests/guard.test.js
```

CI (`.github/workflows/test.yml`) gates on Windows × node 20/22/24. The one Ubuntu job is advisory.

## PiratePartyPals (owner is handling it now)

- `E:\Godot Projects\PiratePartyPals` is on `main`, 12 behind `origin/main`, with harness 3.7.1 and
  the codex pack.
- The owner is clearing the `project.godot` pull blocker. The local edit was only a Godot key
  reorder, and upstream #657 renamed the title.
- Uncommitted `.claude/plans/ledger.md` and the untracked plan files are the owner's work. Never
  stage them.
- At install time: pull `main`, then run `node install.js "E:\Godot Projects\PiratePartyPals" --packs codex`
  from the trial branch, then the doctor check. Commit the harness paths only, by pathspec. The
  push is the owner's call.
- One upstream PPP commit edits the harness skill `steam-build-prep`, which is why the pull comes
  before the install.
