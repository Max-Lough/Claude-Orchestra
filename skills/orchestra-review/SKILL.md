---
name: orchestra-review
description: Run an Orchestra-grade adversarial review of existing changes on demand — the working tree, staged changes, a branch, or a commit range — through the configured review engine (fresh-context Opus reviewer by default; Codex cross-vendor per orchestra.json or on request). Use when the user asks to review changes or a diff, wants a second opinion before merging, or when work reached the session without going through the harness's EXECUTE→REVIEW loop.
---

# Orchestra review (on demand)

Give arbitrary existing changes the same adversarial review the loop gives its own (ORCHESTRA.md §4 REVIEW) — including changes the harness didn't author: a teammate's branch, pre-harness commits, the current working tree. Orchestration-class: authoring review orders and dispatching reviewers is Director work, and while the harness is active you never review-and-fix with your own hands. Dormant and paused sessions follow the same procedure — subagents are available to every session.

## Procedure

1. **Fix the scope.** Default: all uncommitted changes (staged + unstaged). The user may instead name a branch (review `<base>...<head>`), a commit range, or specific paths. Dispatch one scout for: `git status`, `git diff --stat` over the chosen scope, the merge-base if a branch was named, and the commit messages in scope — those messages are the claimed intent when no author report exists.
2. **Pick the engine.** `reviewEngine` in `.claude/orchestra.json` (Reading that one file is permitted — §3.1): `opus` or absent → `reviewer`; `codex` → `reviewer-codex`, with `reviewer` as its unavailable-fallback; `dual` → both engines, and you arbitrate. An in-conversation user instruction overrides the config for this session.
3. **Author the review order** — self-contained (§3.3), containing:
   - **INTENT** — what the change claims to do, from the user's description and/or the commit messages. If neither exists, say so: intent unknown; review for coherence, correctness, and unexplained changes.
   - **SCOPE** — the exact diff command(s): `git diff`, `git diff --staged`, or `git diff <base>...<head>`, plus in-scope paths.
   - **AUTHOR REPORT** — the executor's report verbatim if one exists; otherwise exactly this framing: "No executor report — this change was authored outside the harness. The claims to check are the commit messages / description quoted above."
   - **TIER** — full by default. Declare `TIER: inert` only for a claimed docs/comments/formatting-only diff; the reviewer verifies that claim from the diff first either way.
   - **VERIFICATION** — the `verification` manifest from orchestra.json pasted in if present; else "no manifest — run the obviously relevant checks (affected tests, build, lint)".
   - The standard Orchestra verdict format (the reviewer agents already carry it).
4. **Dispatch.** `reviewer` takes the order directly. `reviewer-codex` takes its two blocks — the review order and the author report — pasted verbatim (its launcher needs both and relays the runner's verdict untouched). `VERDICT: REVIEW_UNAVAILABLE` is not an approval: route that review to `reviewer` and note the cross-vendor pass didn't run. An `⚠ INTEGRITY WARNING` in a verdict → the tree is suspect until a scout confirms only the intended change remains.
5. **Report.** VERDICT first; then blocking findings verbatim (severity, path:line, concrete failure scenario); then nits; then what the reviewer actually ran. Under `dual`, arbitrate disagreements explicitly — say which findings stand and why. Never soften a REVISE into "looks mostly fine".
6. **On REVISE.** The natural next step is a fix: offer to dispatch the executor with the findings relayed verbatim (§3.3), then re-review the fix. Two REVISE cycles on the same change → stop and re-plan rather than send a third (§3.5). In a dormant or paused session you may apply fixes yourself — but only after reporting the verdict.
