---
name: orchestra-review
description: Run an Orchestra-grade adversarial review of existing changes on demand — the working tree, staged changes, a branch, or a commit range. Routes a Claude-authored change to reviewer-codex (Sol) when the codex pack is installed, else to the fresh-context Opus reviewer; a Codex-authored change always goes to reviewer. Shows the §5 alarm on any Sol failure. Use when the user asks to review changes or a diff, wants a second opinion before merging, or when work reached the session without going through the harness's EXECUTE→REVIEW loop.
---

# Orchestra review (on demand)

Give arbitrary existing changes the same adversarial review the loop gives its own (ORCHESTRA.md §4 REVIEW, §5) — including changes the harness didn't author: a teammate's branch, pre-harness commits, the current working tree. Orchestration-class: authoring review orders and dispatching reviewers is Director work, and while the harness is active you never review-and-fix with your own hands. A NORMAL-mode or paused session follows the same procedure — subagents are available to every session.

## Procedure

1. **Fix the scope, then commit it.** Default: all uncommitted changes (staged + unstaged). The user may instead name a branch (review `<base>...<head>`), a commit range, or specific paths. Dispatch one scout for: `git status`, `git diff --stat` over the chosen scope, the merge-base if a branch was named, and the commit messages in scope — those messages are the claimed intent when no author report exists. Commit the change under review before dispatching, and pass `head_ref` (and `base_ref`) by default so the reviewer reads a pinned checkout, not a moving tree.
2. **Pick the engine (§5).** Claude-authored change → `reviewer-codex` (Sol) when the `codex` pack is installed, else `reviewer`. Codex-authored change → `reviewer` — author and reviewer stay cross-family either way. An in-conversation user instruction overrides this for the session. If `reviewer-codex` returns `REVIEW_UNAVAILABLE`, show ORCHESTRA.md §5's alarm line verbatim, then run `reviewer` in fresh context.
3. **Author the review order** — self-contained (§3), containing:
   - **INTENT** — what the change claims to do, from the user's description and/or the commit messages. If neither exists, say so: intent unknown; review for coherence, correctness, and unexplained changes.
   - **SCOPE** — `head_ref`/`base_ref`, or the exact diff command(s) if uncommitted, plus in-scope paths.
   - **AUTHOR REPORT** — the executor's report verbatim if one exists; otherwise exactly this framing: "No executor report — this change was authored outside the harness. The claims to check are the commit messages / description quoted above."
   - **TIER** — full by default. Declare `TIER: inert` only for a claimed docs/comments/formatting-only diff; the reviewer verifies that claim from the diff first either way.
   - **VERIFICATION** — the `verification` manifest from orchestra.json pasted in if present; else "no manifest — run the obviously relevant checks (affected tests, build, lint)".
   - The standard Orchestra verdict format (the reviewer agents already carry it).
4. **Dispatch.** `reviewer` takes the order directly. `reviewer-codex` takes its two blocks — the review order and the author report — pasted verbatim (its launcher needs both and relays the runner's verdict untouched). An `⚠ INTEGRITY WARNING` in a verdict → the tree is suspect until a scout confirms only the intended change remains.
5. **Report.** VERDICT first; then blocking findings verbatim (severity, path:line, concrete failure scenario); then nits; then what the reviewer actually ran. Never soften a REVISE into "looks mostly fine".
6. **On REVISE.** The natural next step is a fix: offer to dispatch the executor with the findings relayed verbatim (§3), then re-review the fix. Two REVISE cycles on the same change → stop and re-plan rather than send a third (§3). In a NORMAL-mode or paused session you may apply fixes yourself — but only after reporting the verdict.
