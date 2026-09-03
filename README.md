# Orchestra

A transferable multi-agent harness for Claude Code. It casts the session model as a **Director** who never touches the code, and routes all actual work through a fixed company of specialist subagents — Claude models by default, plus an optional cross-vendor (OpenAI/Codex) lane for independent review and exceptional-case execution.

The Director is **hard-blocked by a PreToolUse hook** from editing files, running commands, or searching the codebase — delegation is enforced by the harness, not promised by a prompt. Subagents are unaffected by the block. The guard is model-aware: Director law binds only when it identifies a director model (Fable or Opus) at the helm; any other session model runs as plain Claude Code, with no denials. Two authoring carve-outs let the Director write **plan files** (markdown under `.claude/plans/`) and **memory files** (`CLAUDE.md`/`CLAUDE.local.md`, auto-memory) itself — both are Director thinking, not execution — but the managed `<!-- ORCHESTRA:BEGIN/END -->` block inside `CLAUDE.md` stays off-limits even there.

This is the **3.0 protocol**: a compact, legacy-only harness. The 2.0 control plane (tickets, a router, class registry, verifier, quartermaster, the `roster: "new"` project mode) is gone — see [`CHANGELOG.md`](CHANGELOG.md) and "Migrating from 2.x" below. What's left is `ORCHESTRA.md` (the protocol, ~90 lines), six Claude agents, three bundled skills, a session-model guard, and the optional `codex` pack.

## Install, update, uninstall

**A project still carrying a 2.0 `roster: "new"` install must be uninstalled first, from a pinned checkout.** The 3.0 installer refuses outright rather than writing into a ticketed 2.0 project it can't safely migrate:

```bash
git checkout v2.5.0-final
node install.js "<project>" --uninstall
git checkout main   # or your branch — back to the 3.0 installer
```

Only after that clean uninstall does 3.0 install normally. (A plain legacy 2.x project — no `roster` key, or `roster: "legacy"` — upgrades in place; see below.)

```bash
git clone https://github.com/Max-Lough/Claude-Orchestra.git
cd Claude-Orchestra
node install.js /path/to/your/project                    # core harness only
node install.js /path/to/your/project --packs codex       # with the OpenAI/Codex pack
```

PowerShell: `.\install.ps1 "C:\path\to\project"` (`-Packs codex`, `-Specialists <names>`, `-Uninstall`). POSIX: `./install.sh /path/to/project`.

The installer is **idempotent** — re-run it anytime to update a project to the latest master. It copies `agents/*.md`, the bundled skills, `hooks/orchestra-guard.js`, and any named pack's files into `.claude/`; stamps `ORCHESTRA.md` with the harness version; merges its PreToolUse hook entry and git permission grants into `.claude/settings.json`; ensures `CLAUDE.md` imports the protocol inside `<!-- ORCHESTRA:BEGIN/END -->` markers; and records the pack/specialist selection in `.claude/orchestra-install.json` so a later plain re-run refreshes exactly that selection rather than dropping it. Pass `--packs`/`--specialists` again only to *change* the selection (`--no-packs` removes a pack's files; a pack no longer named is deselected the same way).

**Before writing or copying anything**, an existing `.claude/orchestra.json` is preflighted: `roster: "new"` refuses the install with the message above; otherwise the installer scrubs exactly the deprecated 2.0/model-routing keys (`roster`, `rosterGeneration`, `seats`, `projectId`, `installedHooks`, `installedStore`, `installedFiles`, `verifier`, `reviewEngine`, and `codex.execModel`/`codex.execEffort`/`codex.execLightModel`) and leaves every other key byte-for-byte. An orphaned `.claude/orchestra/` runtime directory (2.0's ticket store/ledger) is reported, never deleted.

**Permission grants.** The installer merges `Bash(git add:*)`/`Bash(git commit:*)` into `permissions.allow` — subagents don't see your conversation, so a work order relaying "the user asked me to commit" isn't authorization the permission classifier can see natively; it needs a settings-level grant. `git push` stays opt-in: `node install.js <project> --grant-push` adds exactly two exact-match invocations (`Bash(git push origin HEAD)`, `Bash(git push -u origin HEAD)`) together with a `permissions.deny` counterweight covering `--force`/`-f`/`--delete`/`--mirror`/`--prune` and refspec forms — an allowlist of exact strings, never a `:*` prefix. `--grants-local` writes the same grants to `.claude/settings.local.json` (git-ignored, per-developer) instead of the shared `settings.json`. `--uninstall` removes exactly the grant(s) this installer tracked, from the file it tracked each one in (`installedPermissions`/`installedDeny` in `.claude/orchestra.json`); an identical string you added yourself, or that you've marked in `userOwnedPermissions`, is never touched. These grants are **session-wide**, not scoped to whichever agent is running — they also reach the main session whenever the guard is not actively enforcing (a non-director model, an undetermined first turn, or a paused session).

**Uninstall:**

```bash
node install.js "<project>" --uninstall
```

Validates `settings.json`, `settings.local.json`, `.mcp.json`, and `orchestra.json` first — malformed JSON refuses the whole uninstall before anything is deleted (`--ignore-manifest` skips reading `orchestra.json` specifically, for a manifest too broken to parse). Removes, in order: the tracked git permission grants, the guard hook entry and any pack's MCP registration, then the copied files — agents, hooks, protocol, the core `orchestra-*` skills, every pack's files. `.claude/orchestra.json` itself is left in place (delete it yourself if you don't want it); anything not tracked as Orchestra's own — a hand-authored file that happens to share a name — is left alone.

**Finding and updating installs across repos — `--scan`.** Run from the master (it needs the current `VERSION` and the files to stamp):

```bash
node install.js --scan ~/code             # report: which installs are behind?
node install.js --scan ~/code --update    # ...and bring the stale ones up
```

A project counts as an install when it has `.claude/ORCHESTRA.md`. Each stale project is updated by spawning `node install.js <project>` against it — the identical path you'd run by hand — so its own recorded pack/specialist selection survives; `--scan` refuses `--packs`/`--specialists`/`--uninstall` for that reason (one selection applied across many projects would silently rewrite choices they made separately). An install stamped by a *newer* master than the one you're scanning from is reported and skipped, never downgraded. Exit codes: `0` when nothing reachable is behind, `1` otherwise — usable as a check. `--depth <n>` bounds the walk (default 6).

**Frontmatter lint — `--lint`.** Claude Code drops an agent/skill `.md` whose YAML frontmatter fails to parse **silently** — no error, the agent simply never registers:

```bash
node install.js --lint            # lint every .md with frontmatter in this master
node install.js --lint <dir>      # ...or in any directory
```

Every install runs this over everything it's about to copy and refuses before copying anything on an error. Installed `.md` files are normalized to LF and a scoped `.claude/.gitattributes` is stamped when the project has none, so a later `autocrlf` re-checkout can't re-break what the lint approved.

**Specialists.** A specialist is a domain-tuned executor — identical law to `executor`, plus preloaded playbooks via `skills:` frontmatter. Mint one from `agents/specialists/_TEMPLATE.md`; install per project with `--specialists <name>[,<name>]` (`modeler.md` ships as a worked Blender/Godot example). `--no-specialists` removes them.

## Activation (ORCHESTRA.md §1)

Mode is session-model only, determined silently on the session's first beat:

- **Fable or Opus → DIRECTOR MODE.** The session decomposes, decides, delegates, reviews, and reports; it never edits, searches, or runs commands itself. (Opus specifically: keep every order and explanation concise, basic, and clear without dropping context the executor or the owner needs.)
- **Sonnet, Haiku, or anything else → NORMAL MODE.** An ordinary Claude Code session — no denials, no dormancy announcement, no pause file required.

The guard applies the same positive-evidence rule independently: it reads the session transcript and enforces Director law only once it identifies Fable or Opus; an undetermined model (no assistant turn yet, an unreadable transcript) fails open to NORMAL MODE. A mid-session `/model` switch is picked up one turn later.

## The company (ORCHESTRA.md §2)

| Role | Agent | Model | Purpose |
|---|---|---|---|
| Director | this session | Fable / Opus | decompose, decide, arbitrate, synthesize, talk to the user; never implement |
| Scout | `scout` | Haiku | read-only *where/what* mapping; cheap, fan out freely |
| Detective | `detective` | Opus | read-only *why/how* investigation; one question per case, evidence chains, confidence grade |
| Executor | `executor` | Sonnet | routine edits, commands, builds, and tests |
| Heavy executor | `executor-heavy` / `executor-heavy-xhigh` | Opus high / xhigh | hard, split-resistant, or escalated Claude work; chosen at PLAN time |
| Reviewer | `reviewer` | Opus, fresh context | fallback review; primary review of Codex-authored work |
| Sol reviewer † | `reviewer-codex` | GPT-5.6 Sol | default independent review of Claude-authored campaign work |
| Sol executor † | `executor-codex-heavy` | GPT-5.6 Sol, high | exceptional work that has given Anthropic models trouble; never routine work |
| Cross-compare architects † | `architect-claude` (+`-xhigh`/`-max`) / `architect-codex` | Fable / GPT-5.6 Sol | independent plans, cross-critique, revision (`/cross-compare-plan`) |
| Plan synthesizer † | `plan-synthesizer` | Opus, fresh/blind | adjudicate revised plans without lane identity |

† Installed only with the optional `codex` pack. Without it, Claude execution and fresh-context Opus review remain fully available; the harness reports the missing cross-family lane plainly rather than degrading silently. Projects may add **specialist executors** (see "Specialists" above) — route only to agents that actually exist in the project (`/orchestra-status` lists them).

Recon has two deliberately-routed tiers: `scout` (Haiku) for cheap *where/what* fan-out, `detective` (Opus) for *why/how* questions where fact-gathering can't be separated from reasoning. A scout `UNKNOWN` that survives one re-probe becomes a detective case, never a third scout mission.

## The `codex` pack — Sol review and exceptional Sol execution

The `codex` pack (`--packs codex`) is the harness's optional cross-vendor surface — everything that talks to OpenAI, in one bundle:

- **`reviewer-codex` (Sol) is the default reviewer for Claude-authored campaign work.** Codex-authored work goes to the fresh-context Opus `reviewer` instead, so author and reviewer always sit on different vendors — there is no `reviewEngine` switch to configure.
- **`executor-codex-heavy` (Sol, high effort) is the one Codex executor, and it's exceptional-only** — a Director routing decision made at PLAN time for a problem with concrete prior evidence that Anthropic models struggled on it, never routine work. The Claude executors remain the default path for everything else.
- **`/cross-compare-plan`** runs a two-architect planning session — a fresh-context Claude architect and the GPT lane (Sol, high effort, read-only) draft independently from one shared brief, cross-critique, revise, and a blind Opus synthesizer merges the strongest final plan, with a default post-synthesis cross-family audit. See [`packs/codex/skills/cross-compare-plan/SKILL.md`](packs/codex/skills/cross-compare-plan/SKILL.md).

**Prerequisites.** Install the [Codex CLI](https://developers.openai.com/codex/) and authenticate it (`codex login` or `OPENAI_API_KEY`). Approve the project's `orchestra-engine` MCP server on first launch — until then every cross-vendor lane reports unavailable. Check the install any time, without running a review:

```bash
node .claude/hooks/orchestra-review.js --doctor
```

It resolves the real `codex` binary, names the install layout, verifies the helper files that must sit directly beside it (three names on Windows: `codex-command-runner.exe`, `codex-resources`, `codex-windows-sandbox-setup.exe`), repairs what it can, and prints the exact fix for what it cannot. `orchestra-review.js` implements the check but it covers the install both lanes (review and the Sol executor) share — one check, not two. The installer runs it once when the `codex` pack is selected.

**Reliability, briefly.** A committed change under review is checked out into a throwaway git worktree outside the repository (`--base-ref`/`--head-ref`, passed whenever the change is committed) — a live tree that has moved past the reviewed commit sends an agentic reviewer into an unresolvable `fatal: path exists on disk, but not in <sha>` loop that burns the whole budget. Parallel executors always use separate worktrees for the same reason. A failed run never wears the engine's name (`REVIEW ENGINE: NONE` / `EXEC ENGINE: NONE`, not the vendor's); one bounded internal retry in a fresh checkout reports as ONE outcome with `FINALITY:`; and `codex.doNotRun`/`--no-tests` are hard prohibitions, not polite requests. Full detail: [`packs/codex/README.md`](packs/codex/README.md).

## Review, campaigns, and fail-loud fallback (ORCHESTRA.md §5)

A **campaign** is one contiguous user goal from INTAKE through its final REPORT — it may span several related executor orders or commits, and ends before any handoff, merge, release, deploy, or switch to an unrelated goal. Every campaign must receive **at least one** independent review; the Director may batch related completed goals into one cross-family review, but must run it before the earliest campaign-ending event. A batch is one cohesive diff, names every included goal, and uses exact base/head refs when committed — commit before review, pass `head_ref` by default, never review a moving tree.

Routing follows the author's vendor: Claude-authored work goes to `reviewer-codex` (Sol) when the `codex` pack is installed; Codex-authored work goes to the fresh-context Opus `reviewer`. A reviewer returns `APPROVE`, `REVISE`, or `REVIEW_UNAVAILABLE` and never fixes the change itself.

**If the pack isn't installed**, the Director says so once in the final REPORT and uses `reviewer` — no alarm, this is the expected shape for a Claude-only install. **If the Sol lane is installed but can't run for any reason**, the Director shows this line immediately, not just at review time:

> ⚠ CROSS-FAMILY REVIEW UNAVAILABLE — Sol did not review this campaign: `<reason>`. Falling back to fresh-context Anthropic review; work continues.

Then it runs `reviewer` in fresh context, repeats the alarm in the campaign's final REPORT with the fallback verdict and commands actually run, and never describes the campaign as Sol-reviewed. `reviewer`'s own fallback verdict opens with `⚠ CROSS-FAMILY REVIEW FALLBACK — Sol did not review this campaign; this is a fresh-context Anthropic fallback.` This is why `orchestra_doctor` runs once at INTAKE when the pack is installed — so an unavailable Sol lane surfaces at the start of a campaign, not its end. Full text: `ORCHESTRA.md` §5.

## Executor steering

Claude is the default. `executor` handles routine orders; the Opus heavy profiles (`executor-heavy`, `executor-heavy-xhigh`) are for hard or already-escalated work, chosen at PLAN time, never self-promoted. The optional Codex lane has exactly one executor, `executor-codex-heavy` (Sol, high) — route to it only when concrete prior evidence says Anthropic models have struggled with that specific problem.

`executorEngine: "codex"` in `.claude/orchestra.json` is the durable, project-level choice; an in-conversation instruction ("run this order through codex") overrides it for the named session or order without a reinstall. A Codex executor's `STATUS: EXEC_UNAVAILABLE` is not a completed order — read its `TREE AUDIT`, have a scout confirm the tree, then route the order to the appropriate Claude executor and say so.

## `.claude/orchestra.json` schema

Absence of the file means all defaults; unknown keys are preserved and ignored, so project-owned extensions survive an update. A broken `orchestra.json` disables only itself — the default guard blocklist still applies.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `executorEngine` | `"claude"` \| `"codex"` | `"claude"` | Durable executor choice; `codex` selects the one Sol executor. |
| `verification` | object | absent | Optional canonical verification manifest (below). |
| `verification.full` / `.lint` | string \| `null` | `null` | Full-suite / lint command. |
| `verification.shards` | string[] | `[]` | Independent suite commands. |
| `verification.protected` | string[] | `[]` | Suites that may not be weakened or skipped. |
| `directorBlockedPatterns` | string[] (globs) | `[]` | Additional tools blocked while a Director is active; a rejected entry fails the guard closed. |
| `directorAllowedTools` | string[] | `[]` | Exact built-in tool names removed from the default Director blocklist. |
| `directorPlanPatterns` | string[] (globs) | `[]` | Additional Director-owned plan paths (beyond `.claude/plans/*.md`). |
| `directorMemoryPatterns` | string[] (globs) | `[]` | Additional Director-owned memory paths (beyond `CLAUDE.md`/`CLAUDE.local.md`/auto-memory). |
| `installedPermissions` | `{file,entry}[]` | `[]` | Installer-owned `permissions.allow` entries; present only when tracking is active. |
| `installedDeny` | `{file,entry}[]` | `[]` | Installer-owned `permissions.deny` entries. |
| `userOwnedPermissions` | string[] | `[]` | User claims exempting an exact permission string from installer cleanup. |
| `codex` | object | `{}` | Runner overrides below (requires the `codex` pack). |
| `codex.reviewModel` | string | `"gpt-5.6-sol"` | Sol review model. |
| `codex.reviewSandbox` | string | `"workspace-write"` | Codex sandbox for review. |
| `codex.reviewTimeoutMs` | integer | `1800000` | Per-attempt review wall-clock cap — Sol reviews at high effort commonly run 12–33 minutes. |
| `codex.execHeavyModel` | string | `"gpt-5.6-sol"` | The sole Codex executor model. |
| `codex.execHeavyEffort` | string | `"high"` | Sol executor reasoning effort. |
| `codex.execSandbox` | string | `"workspace-write"` | Codex sandbox for execution. |
| `codex.execTimeoutMs` | integer | `1800000` | Execution wall-clock cap. |
| `codex.idleMs` | integer | `1500` | Live-tree settle window shared by both lanes; `0` disables. |
| `codex.helpersDir` | string | `""` | Known-good Codex helper files, mirrored in before each run. |
| `codex.worktreeRoot` | string | OS temp dir | Root for a pinned review's throwaway worktree; must be outside the repo. |
| `codex.gitConfigIsolation` | boolean | `true` | Use a scratch global git config for the review/execution process. |
| `codex.reviewRetries` | integer | `1` | Extra retryable review attempts (max 3). |
| `codex.authProbe` | boolean | `true` | Run the fast Codex availability probe before the real attempt. |
| `codex.probeTimeoutMs` | integer | `90000` | Cap for that probe. |
| `codex.worktreeWarmupCmd` | string | `""` | Optional command run in a pinned worktree before the integrity baseline. |
| `codex.worktreeWarmupTimeoutMs` | integer | `300000` | Cap for the warmup command. |
| `codex.integrityIgnoreDefaults` | boolean | `true` | Include the built-in generated-artifact ignore list. |
| `codex.integrityIgnore` | string[] | `[]` | Additional tree-audit ignore patterns. |
| `codex.helperSiblings` | string[] | Windows: the three names above; else `[]` | Files the Codex install must carry directly beside its executable. |
| `codex.requireHelperSiblings` | boolean | `false` | Fail availability checks if a configured sibling is still missing. |
| `codex.doNotRun` | string[] | `[]` | Commands forbidden to the review and execution runners. |
| `codex.crossplanModel` | string | `"gpt-5.6-sol"` | GPT cross-compare architect model. |
| `codex.crossplanEffort` | string | `"high"` | GPT architect reasoning effort. |
| `codex.crossplanTimeoutMs` | integer | `900000` | Wall-clock cap per cross-compare phase. |
| `codex.crossplanWeb` | boolean | `true` | Permit web research in the GPT architect lane. |

Settings resolve **flag > environment > `.claude/orchestra.json` > default**; every verdict header names the value actually applied and where it came from.

### The `verification` manifest

Executors run it, the review runners inject it into their briefs, and a fallback review judges pasted verification against it — the canonical command set for every verifier in the project, written once by a verification-profile micro-order and reused thereafter:

```json
{
  "verification": {
    "full": "npm test",
    "lint": "npm run lint",
    "shards": ["npm test -- unit", "npm test -- integration"],
    "protected": ["npm test -- integration"]
  }
}
```

Verification is deliberately paid twice — the executor verifies, the reviewer independently re-verifies — and that redundancy is never trimmed (ORCHESTRA.md §8). Only a provably inert round (docs/comments/formatting, zero behavior impact) may narrow to lint plus targeted checks; whoever reviews it verifies inertness from the diff first.

### Plan and memory files, and the pause switch

The Director may `Write`/`Edit` markdown directly under `.claude/plans/` (the plan is its own artifact — routing it through an executor loses fidelity) and edit `CLAUDE.md`/`CLAUDE.local.md`/auto-memory directly (a memory entry distills the current conversation, which only the Director holds) — both fenced by symlink-resolved containment and hardlink checks, and the managed `<!-- ORCHESTRA:BEGIN/END -->` block always survives an edit intact. `directorPlanPatterns`/`directorMemoryPatterns` add further glob-matched locations.

Pause the harness for a plain session (a quick one-liner, debugging the harness itself) with `.claude/orchestra.pause` or `ORCHESTRA_PAUSE=1` — **out-of-band only**: no tool call, not even a Write from the Director itself, can create or edit that file; the guard denies it unconditionally. Create it yourself, in your own terminal.

## Ledger and plans

Keep a visible task list for multi-step work, and keep `.claude/plans/ledger.md` across the session: per agent run, tool calls, wall-clock, verification runs, review verdict (ORCHESTRA.md §4). `/orchestra-plan` writes work orders to `.claude/plans/<slug>.md`; `/orchestra-review` runs an on-demand review of arbitrary existing changes; `/orchestra-status` reports the harness's live state — mode, enforcement, company, packs, config, Sol lane availability, plans/ledger.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Orchestra: the Director does not use X" denial | Working as intended on Fable/Opus — delegate instead. On Sonnet/Haiku the guard stands down automatically; a denial there means model detection failed. |
| Guard denies a tool in a Sonnet/Haiku session | Model detection failed — this should never happen. Pause the harness (`.claude/orchestra.pause`) and file a bug against the master. |
| Hook seems inactive | Approve project hooks at first launch (`/hooks` in Claude Code); confirm `.claude/settings.json` has the `orchestra-guard` entry. |
| Executor denied on `git commit` | Re-run the installer — it merges the git grants into `permissions.allow`. Check they survived a hand-edit of settings. |
| Executor denied on `git push` | Push is opt-in: `node install.js <project> --grant-push`. |
| `reviewer-codex` / `executor-codex-heavy` / `/cross-compare-plan` don't exist | The `codex` pack isn't installed — `node install.js <project> --packs codex`. `/orchestra-status` reports which packs are present. |
| Sol lane reports `UNAVAILABLE` | This is an **alarm condition under §5**, not a silent expected fallback — the Director shows the `⚠ CROSS-FAMILY REVIEW UNAVAILABLE` line and falls back to `reviewer`. Run `node .claude/hooks/orchestra-review.js --doctor` to check the Codex install; common cause on Windows is a helper file one directory too deep. |
| Review times out exploring the tree | The change was committed but reviewed in a live (dirty) checkout. Name base/head SHAs in the review order so `--base-ref`/`--head-ref` land; check the verdict header for `checkout: live working tree`. |
| Install refuses with "3.0 cannot safely upgrade a 2.0 roster:new install" | See "Migrating from 2.x" below — uninstall from the `v2.5.0-final` checkout first. |

## Versioning

The master's version lives in `VERSION` at the repo root; the installer stamps it into every project's `.claude/ORCHESTRA.md` header. **Patch** for fixes and doc-only changes, **minor** for new capabilities, **major** for breaking changes to the protocol or the `orchestra.json` format. [`CHANGELOG.md`](CHANGELOG.md) records what each version changed and why.

## Migrating from 2.x

3.0 is **breaking** for any project installed with `roster: "new"` — the 2.0 ticketed control plane (bridge, router, class registry, verifier, quartermaster) no longer exists on the Claude side. A project on that roster must be uninstalled with the **`v2.5.0-final`** checkout before 3.0 touches it:

```bash
git checkout v2.5.0-final
node install.js "<project>" --uninstall
git checkout main
node install.js "<project>" --packs codex   # normal 3.0 install
```

The 3.0 installer refuses a `roster: "new"` target outright rather than attempting an in-place migration — its ticket store, gate hooks, and pinned manifest keys have no 3.0 owner. A plain **legacy** 2.x project (no `roster` key, or `roster: "legacy"`) upgrades in place with an ordinary re-run: the config preflight scrubs the small set of deprecated keys (`reviewEngine`, `codex.execModel`/`codex.execEffort`/`codex.execLightModel`, and the roster/ticket-era keys) and leaves everything else untouched. See `CHANGELOG.md`'s `3.0.0` entry for the full list of what was removed and why.

## Layout

```
Orchestra/
├── README.md, CHANGELOG.md, VERSION, ORCHESTRA.md
├── install.js / install.ps1 / install.sh   ← idempotent installer/uninstaller
├── agents/            ← the six core Claude agents + specialists/
├── hooks/orchestra-guard.js  ← PreToolUse hook enforcing Director law
├── skills/             ← orchestra-status, orchestra-plan, orchestra-review
├── tests/               ← harness tests (master-only; never stamped into projects)
└── packs/
    ├── README.md        ← the pack contract
    └── codex/            ← the OpenAI/Codex surface (optional, --packs codex)
        ├── pack.json, README.md, FIELD-VALIDATION.md
        ├── agents/       ← reviewer-codex, executor-codex-heavy, architect-claude(+xhigh/max),
        │                    architect-codex, plan-synthesizer
        ├── hooks/        ← orchestra-engine-mcp.js (MCP transport) + the three runners
        └── skills/cross-compare-plan/
```

Everything above `packs/` is the core harness and always installs. This folder is the **master copy** — edit here and re-run the installer per project to change the installed system.

## License

[MIT](LICENSE) — use, modify, and distribute freely with attribution; no warranty.
