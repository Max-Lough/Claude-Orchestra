# Reverse-port 3.0: Orchestra 2.0 back to the legacy harness

Date: 2026-09-02 (late)
Status: EDITED BY FABLE 2026-09-02 — awaiting the owner's go

## FABLE EDITS (applied to the Sol draft below)

1. **Opus Director directive** added to the mode-detection draft text (owner instruction 2026-09-02): concise, basic, clear orders and explanations without dropping context the executor or the owner needs.
2. **Alarm scope clarified.** The ⚠ alarm fires when the Codex pack is installed and the Sol lane fails. A project with no Codex pack gets one plain REPORT sentence, not an alarm on every campaign. Added an INTAKE availability check (`orchestra_doctor`, one MCP call the guard already permits) so the alarm surfaces at the start of a campaign rather than at its review.
3. **Review timeout default raised** from the runner's built-in 600000 ms to 1800000 ms. Tonight's ledger shows Sol reviews running 12–33 minutes and 4 of 25 reviewer tickets returning REVIEW_UNAVAILABLE; a 10-minute default would make the alarm fire on healthy reviews.
4. **WO-1 executes as two commits** (guard first, installer second). The Opus review named the installer edit the highest-risk change in the port; the guard edit is independent and should not share its blast radius.
5. **Scope ruling on the root `codex/` mirror:** out of scope and untouched. "Ditch Terra and Luna" applies to the Claude-side harness and `packs/codex`. The owner can widen this with a separate order.
6. Executor round estimate updated for the WO-1 split (six repository rounds, not five).
7. **WO-0 finding (2026-09-02, control round):** after the v2.5 uninstall + `--roster legacy` reinstall, `reviewer-codex` was REFUSED by the engine MCP gate (`packs/codex/hooks/orchestra-engine-mcp.js:104-116`, `:217-221`): an unpinned project that still carries any 2.0 fingerprint fails closed. Two fingerprints survived the uninstall by design — the orphaned `.claude/orchestra/ledger/` directory and the preserved keys `projectId` / `installedFiles` / `rosterGeneration` in `orchestra.json`. The Opus review's "gate is already inert under legacy" claim is wrong for this stranded state. Consequences for the plan: (a) WO-2 deletes the fingerprint heuristic together with the gate; (b) Design Decision 8's installer scrub must also remove the keys `seats`, `installedStore`, `verifier` and warn about (not delete) a leftover `.claude/orchestra/` directory; (c) the migration section's step 5 census must include "no `.claude/orchestra/` directory at all" and "no 2.0 keys in `orchestra.json`". Interim fix applied by hand to PiratePartyPals: ledger dir moved to the archive, config reduced to `codex`, `roster`, `reviewEngine: "codex"`, `directorPlanPatterns`.


This plan starts from the Opus dependency map, minimum viable port, and ordering analysis (`plans/port-3.0/port-review-opus-2026-09-02.md:361-425`, `plans/port-3.0/port-review-opus-2026-09-02.md:435-492`, `plans/port-3.0/port-review-opus-2026-09-02.md:695-769`). It accepts the review's six-agent correction and its recommendation to delete the verifier, manifest, telemetry, and 2.0 control plane while keeping crossplan (`plans/port-3.0/port-review-opus-2026-09-02.md:43-55`, `plans/port-3.0/port-review-opus-2026-09-02.md:67-116`, `plans/port-3.0/port-review-opus-2026-09-02.md:168-242`, `plans/port-3.0/port-review-opus-2026-09-02.md:313-340`). It deliberately changes the review's model proposal because the owner's later ruling removes Luna, Terra, the standard Codex executor, and configurable Opus-first review. It also adds one small legacy-only install preflight rather than adopting the review's literal “zero new JavaScript” constraint; the reason is under Design Decision 8.

## GOAL AND NON-GOALS

**Goal.** Return the Claude-side harness to one compact, understandable control surface: `ORCHESTRA.md`, six core Claude agents, the existing skills and optional specialists, a session-model guard, and the optional Codex pack. Fable and Opus sessions direct; Sonnet and Haiku sessions are ordinary agents. Claude executors perform routine work. The only Codex execution profile is an exceptional-case Sol executor, and the normal independent review is a Sol reviewer that may be batched across related completed goals but must run at least once before a campaign can end. Remove the ticket/bridge/router/class/verifier/quartermaster/roster machinery without losing the useful cross-vendor runners or cross-compare planning.

**Non-goals.** Do not redesign agent roles, add enforcement, replace the Codex runners, add review/fix loops, add telemetry, preserve 2.0 compatibility inside 3.0, or change the standalone Codex-native mirror. In particular, do not implement the Opus review's proposed Luna profile or Terra default (`plans/port-3.0/port-review-opus-2026-09-02.md:523-567`); the late owner ruling supersedes them. Do not clean up historical plans, exercise records, or review artifacts. Do not migrate PiratePartyPals until the explicit live-project gate in this plan.

## END STATE

### Repository tree

The active repository surface is:

```text
ORCHESTRA.md
README.md
CHANGELOG.md
VERSION
install.js
install-codex.js
agents/
  scout.md
  detective.md
  executor.md
  executor-heavy.md
  executor-heavy-xhigh.md
  reviewer.md
  specialists/
skills/
  orchestra-plan/SKILL.md
  orchestra-review/SKILL.md
  orchestra-status/SKILL.md
hooks/
  orchestra-guard.js
packs/codex/
  pack.json
  README.md
  FIELD-VALIDATION.md
  agents/
    architect-claude.md
    architect-claude-xhigh.md
    architect-claude-max.md
    architect-codex.md
    executor-codex-heavy.md
    plan-synthesizer.md
    reviewer-codex.md
  hooks/
    orchestra-engine-mcp.js
    orchestra-exec.js
    orchestra-review.js
    orchestra-crossplan.js
  skills/cross-compare-plan/SKILL.md
roster/
  README.md                       # historical archive index only
  *.md                            # dated plans/reports/exercises only
tests/
  exec-lane.test.js
  frontmatter-lint.test.js
  guard.test.js
  install.test.js
  mcp-lane.test.js
  review-lane.test.js
  scan.test.js
```

The core six already exist as the legacy agent set (`install.js:78-87`), and the Opus review correctly identifies all six rather than the oracle's five (`plans/port-3.0/port-review-opus-2026-09-02.md:67-116`). The Codex pack currently has both a Terra launcher and a Sol launcher (`packs/codex/agents/executor-codex.md:1-50`, `packs/codex/agents/executor-codex-heavy.md:1-37`); only the latter remains and becomes self-contained. `orchestra-crossplan.js` remains because it is independent of the bridge and already defaults its GPT architect to Sol/high (`packs/codex/hooks/orchestra-crossplan.js:1019-1042`), matching the late ruling without a new model tier.

Delete the active implementations under `bridge/`, `router/`, `registry/`, `verifier/`, and `quartermaster/`; their current dependency edges and deletion rationale are already mapped in the Opus review (`plans/port-3.0/port-review-opus-2026-09-02.md:361-425`, `plans/port-3.0/port-review-opus-2026-09-02.md:463-476`). Also delete `tools/orchestra-ledger-report.js`, `tools/shakedown/`, the 2.0 probe/telemetry files `probes/RUNBOOK.md`, `probes/orchestra-probe-review.js`, and `probes/orchestra-telemetry.js` (`probes/RUNBOOK.md:1-202`, `probes/orchestra-probe-review.js:1-406`, `probes/orchestra-telemetry.js:1-302`), the twelve active role profiles plus `roster/lint.js`, and the tests dedicated to those systems. Keep dated `roster/` evidence as history, but replace the present “next-generation roster” README—which still advertises eleven shipping profiles and router-backed castings (`roster/README.md:1-24`)—with a short archive index.

The root `codex/` tree is out of scope. It is a separate Codex-native mirror, while this reverse-port changes the Claude-side harness and its optional `packs/codex` interface; the Opus review likewise identifies its Luna references as belonging to that mirror (`plans/port-3.0/port-review-opus-2026-09-02.md:523-528`). The late “ditch Terra and Luna” note names `executor-codex`, `execLightModel`, and the cross-vendor execution tiers. **Fable ruling:** the root `codex/` mirror is out of scope for this port and stays untouched; widening that needs a separate owner order.

### Installed project tree

A clean 3.0 install with `--packs codex` has this managed shape:

```text
<project>/
  CLAUDE.md                       # managed import block only
  .mcp.json                      # orchestra-engine registration merged with user entries
  .claude/
    ORCHESTRA.md
    orchestra-install.json       # version, packs, specialists
    orchestra.json               # optional; only written when policy/config bookkeeping needs it
    settings.json                # one Orchestra PreToolUse guard plus preserved user settings
    agents/
      scout.md
      detective.md
      executor.md
      executor-heavy.md
      executor-heavy-xhigh.md
      reviewer.md
      architect-claude.md
      architect-claude-xhigh.md
      architect-claude-max.md
      architect-codex.md
      executor-codex-heavy.md
      plan-synthesizer.md
      reviewer-codex.md
      <selected specialists>.md
    hooks/
      orchestra-guard.js
      orchestra-engine-mcp.js
      orchestra-exec.js
      orchestra-review.js
      orchestra-crossplan.js
    skills/
      orchestra-plan/
      orchestra-review/
      orchestra-status/
      cross-compare-plan/
```

There is no `.claude/ORCHESTRA-CONDUCTOR.md`, `.claude/orchestra/`, ticket store, bridge hook, roster profile, pin, or 2.0 runtime. The installer keeps the pack-declared MCP registration because it currently merges without clobbering unrelated servers (`install.js:2689-2732`). The installed protocol continues to receive its version stamp from `VERSION` (`install.js:2735-2755`), and install selection remains in `.claude/orchestra-install.json` (`install.js:2992-2999`).

### `.claude/orchestra.json` schema

Absence of the file means all defaults. The installer removes the named 2.0/model-routing keys listed below after refusing an unmigrated `roster: "new"` project; every other unknown key is preserved but ignored so project-owned extensions survive. Arrays default to fresh empty arrays. `null` command defaults mean “not configured.” The canonical schema is:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `executorEngine` | `"claude" \| "codex"` | `"claude"` | Durable executor choice. `codex` selects the one Sol executor; a user instruction can override it for the session/order. |
| `verification` | object | absent | Optional verification manifest consumed by the runners. |
| `verification.full` | string or `null` | `null` | Full-suite command. |
| `verification.lint` | string or `null` | `null` | Lint command. |
| `verification.shards` | string[] | `[]` | Independent suite commands. |
| `verification.protected` | string[] | `[]` | Suites that may not be weakened or skipped. |
| `directorBlockedPatterns` | string[] | `[]` | Additional tools blocked while a Director is active. |
| `directorAllowedTools` | string[] | `[]` | Explicit exceptions to the Director block list. |
| `directorPlanPatterns` | string[] | `[]` | Additional Director-owned plan paths. |
| `directorMemoryPatterns` | string[] | `[]` | Additional Director-owned memory paths. |
| `installedPermissions` | `{file,entry}[]` | `[]` | Installer-owned allow entries, present only when tracking is active. |
| `installedDeny` | `{file,entry}[]` | `[]` | Installer-owned deny entries, present only when tracking is active. |
| `userOwnedPermissions` | string[] | `[]` | User claims that exempt an exact permission from installer cleanup. |
| `codex` | object | `{}` | Optional runner overrides below. |
| `codex.reviewModel` | string | `"gpt-5.6-sol"` | Sol review model; hard default, not “Codex default.” |
| `codex.reviewSandbox` | string | `"workspace-write"` | Review sandbox. |
| `codex.reviewTimeoutMs` | integer | `1800000` | Per-attempt review wall-clock limit. Raised from the runner's 600000 default: Sol reviews at high effort ran 12–33 minutes in the 2026-09-02 ledger. |
| `codex.execHeavyModel` | string | `"gpt-5.6-sol"` | The only Codex executor model. The key keeps its existing name to avoid needless project-config churn. |
| `codex.execHeavyEffort` | string | `"high"` | Default reasoning effort for the Sol executor. |
| `codex.execSandbox` | string | `"workspace-write"` | Execution sandbox. |
| `codex.execTimeoutMs` | integer | `1800000` | Execution wall-clock limit. |
| `codex.idleMs` | integer | `1500` | Live-tree settle window shared by runner lanes. |
| `codex.helpersDir` | string | `""` | Optional known-good Codex helper source. |
| `codex.worktreeRoot` | string | OS temporary directory | Root for pinned-review worktrees. |
| `codex.gitConfigIsolation` | boolean | `true` | Use scratch global Git config for reviews/execution. |
| `codex.reviewRetries` | integer | `1` | Extra retryable review attempts, capped at three. |
| `codex.authProbe` | boolean | `true` | Run the fast Codex availability probe. |
| `codex.probeTimeoutMs` | integer | `90000` | Availability-probe limit. |
| `codex.worktreeWarmupCmd` | string | `""` | Optional pinned-worktree warmup command. |
| `codex.worktreeWarmupTimeoutMs` | integer | `300000` | Warmup wall-clock limit. |
| `codex.integrityIgnoreDefaults` | boolean | `true` | Include built-in generated-artifact ignores. |
| `codex.integrityIgnore` | string[] | `[]` | Additional tree-audit ignore patterns. |
| `codex.helperSiblings` | string[] | Windows: `codex-command-runner.exe`, `codex-resources`, `codex-windows-sandbox-setup.exe`; other OS: `[]` | Expected direct siblings of `codex`. |
| `codex.requireHelperSiblings` | boolean | `false` | Fail availability checks if configured siblings remain missing. |
| `codex.doNotRun` | string[] | `[]` | Commands forbidden to review and execution runners. |
| `codex.crossplanModel` | string | `"gpt-5.6-sol"` | GPT architect model. |
| `codex.crossplanEffort` | string | `"high"` | GPT architect effort. |
| `codex.crossplanTimeoutMs` | integer | `900000` | Crossplan phase limit. |
| `codex.crossplanWeb` | boolean | `true` | Permit web research in the GPT architect lane. |

These are not invented capabilities: the review runner currently consumes its reliability/worktree settings together (`packs/codex/hooks/orchestra-review.js:2577-2676`), the executor consumes the verification object and shared runner settings (`packs/codex/hooks/orchestra-exec.js:370-389`, `packs/codex/hooks/orchestra-exec.js:1140-1215`), and crossplan consumes its four lane settings plus shared probe/integrity settings (`packs/codex/hooks/orchestra-crossplan.js:1004-1079`). The present docs enumerate the same review defaults (`README.md:91-105`).

Delete `reviewEngine`, `codex.execModel`, `codex.execEffort`, and any `codex.execLightModel`; there is no selectable routine/standard/light Codex lane. Delete the 2.0 keys `roster`, `rosterGeneration`, `seats`, `projectId`, `installedHooks`, `installedStore`, and `installedFiles`. This partly disagrees with the Opus schema (`plans/port-3.0/port-review-opus-2026-09-02.md:497-521`): do not add `version` to this file because the installer already records version in `orchestra-install.json` and stamps it into the protocol (`install.js:2735-2755`, `install.js:2992-2999`), and do not retain `installedFiles` after its sole roster/runtime cleanup use disappears (`install.js:3415-3510`).

### Agent roster

| Agent name | Model | Purpose |
|---|---|---|
| session Director | Fable or Opus | Decompose, arbitrate, synthesize, and communicate; never implement. |
| `scout` | Haiku | Cheap read-only where/what mapping. |
| `detective` | Opus | Read-only causal investigation. |
| `executor` | Sonnet | Default routine implementation. |
| `executor-heavy` | Opus, high | Hard Claude execution. |
| `executor-heavy-xhigh` | Opus, xhigh | Hardest Claude execution selected at plan time. |
| `reviewer` | Opus, fresh context | Fallback if Sol review is unavailable; primary review for Codex-authored changes. |
| `reviewer-codex` | Haiku launcher → GPT-5.6 Sol | Default independent reviewer for Claude-authored campaign work. |
| `executor-codex-heavy` | Haiku launcher → GPT-5.6 Sol, high | Exceptional execution only for a problem known to have caused Anthropic models trouble. |
| `architect-codex` | Haiku launcher → GPT-5.6 Sol, high | Read-only GPT side of cross-compare planning. |
| `architect-claude`, `-xhigh`, `-max` | Fable, named effort | Independent Claude side of cross-compare planning. |
| `plan-synthesizer` | Opus, fresh/blind | Adjudicate the two revised plans without lane identity. |

The first six names/models already appear in the company table (`ORCHESTRA.md:21-26`). The current Codex table exposes Terra standard and Sol heavy launchers separately (`ORCHESTRA.md:27-32`); 3.0 removes only the Terra launcher. The Opus fallback remains essential because current `REVIEW_UNAVAILABLE` output already says the cross-vendor pass did not run and directs fallback to Opus (`packs/codex/hooks/orchestra-review.js:2503-2536`).

### `ORCHESTRA.md` shape and campaign rule

Target: **at most 100 physical lines and about 3,000 words**, down from 126 lines. Keep this section list:

1. Determine your mode
2. The company
3. Director law
4. The operating loop
5. Review, campaigns, and fallback
6. Pause switch
7. Specialists, skills, and MCP
8. Sizing, cadence, and verification

Fold the current long execution/review essays (`ORCHESTRA.md:36-46`) into the company, loop, and review sections. Keep the existing Director law and operational safety rules, but remove all `roster:new`, ticket, dispatch/close, verifier, `reviewEngine`, Terra, and Luna language. The current loop says a review follows each execution and can only defer adjacent changes of the same kind (`ORCHESTRA.md:59-68`); replace it with this exact operational definition:

> A campaign is one contiguous user goal from INTAKE through its final REPORT. It may contain several related executor goals, orders, or commits. It ends before any final done/handoff statement, merge, release, deploy, or switch to an unrelated user goal. Every campaign must receive at least one independent review. The Director may batch related completed executor goals into one cross-family review, but must run it before the earliest campaign-ending event. A batch must be one cohesive diff, identify each included goal, and use exact base/head refs when committed. A fallback Anthropic review satisfies the safety gate but must carry the cross-family-unavailable alarm; it does not count as a Sol review.

## DESIGN DECISIONS

### 1. Sol review is the default, with no `reviewEngine` switch

**Decision.** Claude-authored substantive work goes to `reviewer-codex`; Codex-authored work goes to fresh-context `reviewer` so author and reviewer remain cross-family. If the Codex pack is absent, `reviewer` is the declared path and the final report says so in one plain sentence; the ⚠ alarm below is reserved for a pack that is installed but whose Sol lane failed. Remove `reviewEngine` rather than changing its default.

**Alternatives rejected.** Keeping `reviewEngine: opus|codex|dual` would permit a quiet project-level opt-out from the owner's chosen default; the current protocol explicitly makes Opus default and Codex optional (`ORCHESTRA.md:42`). Always running dual spends twice and conflicts with “at least once per campaign,” not once per order. Making Sol review a hard blocker contradicts the late instruction that alarms must not halt work.

### 2. Fail loudly in the runner header and two mandatory Director beats

**Decision.** Reuse the runner's existing unmistakable `VERDICT: REVIEW_UNAVAILABLE` and `FINALITY` output (`packs/codex/hooks/orchestra-review.js:2503-2536`). Add one exact alarm sentence to `ORCHESTRA.md`: the Director must display it immediately when the Sol lane fails and repeat it in the campaign's final REPORT. Add a matching first-line requirement to the fallback Opus reviewer and a preserve-verbatim requirement to the Codex launcher. No new hook or JavaScript.

Required alarm:

> ⚠ CROSS-FAMILY REVIEW UNAVAILABLE — Sol did not review this campaign: `<reason>`. Falling back to fresh-context Anthropic review; work continues.

The final REPORT must also name the fallback verdict and the commands it actually ran. Because the failure is emitted by the runner, repeated by the Director before fallback, repeated again at campaign close, and marked in the fallback verdict, a Director cannot quietly convert it into approval without violating four visible protocol points.

**Alternatives rejected.** A guard hook can halt or deny at exactly the moment the owner says work must continue and would add state. `/orchestra-status` is on demand, so it cannot guarantee visibility; its current procedure only checks Codex availability when a config routes there (`skills/orchestra-status/SKILL.md:22-23`). A REPORT-only note arrives too late and can be buried. Telemetry was rejected because it duplicates the runner's signals and has no meaningful cost source (`plans/port-3.0/port-review-opus-2026-09-02.md:608-691`).

### 3. Review may batch, but the campaign boundary is a hard fence

**Decision.** Use the campaign definition above. The Director may defer review while related goals accumulate, but no final report, handoff, merge/release/deploy, or unrelated goal can begin before review. Require a goal checklist and exact commit range in a batch. This adopts the Opus report's concern that unbound working-tree review can cover a diff nobody authored (`plans/port-3.0/port-review-opus-2026-09-02.md:786-792`) without reinstating tickets.

**Alternatives rejected.** Review per order is unnecessarily expensive and is stricter than the owner's new cadence. An unbounded “review sometime” rule does not force review at all. A numeric order limit is arbitrary: campaign-ending events and cohesive-diff scope are the meaningful bounds.

### 4. Keep a much smaller session-model guard

**Decision.** Keep `hooks/orchestra-guard.js` for the Director's no-code/no-search boundary, pause switch, managed-marker protection, and allowed plan/memory paths. Delete all roster/pin/gate logic. Preserve its current positive-evidence activation: it already enforces only when it identifies Fable/Opus and allows Sonnet/Haiku or unknown sessions (`hooks/orchestra-guard.js:1591-1612`). Under 3.0, Sonnet/Haiku produce no denial and no dormant-mode warning.

**Alternatives rejected.** Prose alone cannot enforce the defining Director restriction. Keeping the current guard unchanged preserves 457+ lines of dead 2.0 behavior; the Opus review identifies the exact removable regions (`plans/port-3.0/port-review-opus-2026-09-02.md:451-460`). Dropping the guard would make the harness rely on the same long protocol the owner wants shortened.

### 5. Keep a thin engine MCP server

**Decision.** Retain `orchestra-engine-mcp.js`, but reduce it to four typed, blocking tools: `orchestra_review`, `orchestra_exec`, `orchestra_crossplan`, and `orchestra_doctor`. Remove bridge imports, ticket/casting binding, `orchestra_dispatch`, and `orchestra_close`. The current review and execution tools already translate structured inputs to runner arguments (`packs/codex/hooks/orchestra-engine-mcp.js:876-1017`), while dispatch/close are the 2.0-only tools (`packs/codex/hooks/orchestra-engine-mcp.js:1076-1141`).

**Alternatives rejected.** Direct launcher calls would require Bash access plus scratch-file, quoting, blocking, and output-relay instructions in every launcher. The present launcher profiles deliberately expose only the MCP tool (`packs/codex/agents/reviewer-codex.md:2-5`, `packs/codex/agents/executor-codex-heavy.md:2-5`), and the pack already registers the server (`packs/codex/pack.json:20-24`). A thin MCP adapter is less code and less protocol than rebuilding shell transport in markdown.

### 6. Crossplan stays; its OpenAI architect is Sol/high

**Decision.** Keep `orchestra-crossplan.js`, `architect-codex.md`, all three Claude architect effort profiles, `plan-synthesizer.md`, and `cross-compare-plan/SKILL.md`. The GPT lane remains `gpt-5.6-sol` at high effort. Crossplan is an optional planning workflow, not a third executor tier; removing Terra does not remove the value of independent cross-family architecture.

**Alternatives rejected.** Deleting crossplan because it has “router” in its conceptual workflow repeats the oracle's mistaken dependency inference; the Opus review demonstrates that it is independent (`plans/port-3.0/port-review-opus-2026-09-02.md:313-340`). Repointing it to Terra conflicts with the late model ruling. Rebuilding it as in-conversation prose loses the existing anonymous draft/critique/revision transport.

### 7. Rewrite `README.md`; append, do not rewrite, `CHANGELOG.md`

**Decision.** Replace the 722-line/approximately 130 KB README with a concise 3.0 guide of at most 400 lines: concept, install/update/uninstall, activation, six-agent roster, Sol review/campaign semantics, exceptional Sol execution, cross-compare, config schema, troubleshooting, and migration warning. Preserve only details that describe surviving behavior. Prepend one 3.0 entry to `CHANGELOG.md`; preserve all historical entries verbatim.

**Alternatives rejected.** Surgical edits would leave many stale anchors: the current README describes selectable review engines (`README.md:51-109`), Terra/Sol execution tiers (`README.md:139-184`), roster/pin config (`README.md:590-613`), and 2.0 migration concepts. Deleting the changelog erases provenance; rewriting its 1,372 historical lines creates risk without user value. The Opus review flags both documents as a first-week trap (`plans/port-3.0/port-review-opus-2026-09-02.md:819-821`).

### 8. Add one bounded config migration for legacy installs

**Decision.** Before any 3.0 install writes target files, read an existing `.claude/orchestra.json`; if `roster === "new"`, exit nonzero with: “3.0 cannot safely upgrade a 2.0 roster:new install in place. Check out v2.5.0-final, run its installer with `<project> --uninstall`, then retry this install.” Otherwise remove only the named deprecated keys: top-level `roster`, `rosterGeneration`, `seats`, `projectId`, `installedHooks`, `installedStore`, `installedFiles`, `verifier`, and `reviewEngine`; nested `codex.execModel`, `codex.execEffort`, and `codex.execLightModel`. Preserve every other key. If a `.claude/orchestra/` directory still exists, print one warning naming it as orphaned 2.0 runtime state (never delete it). This refusal-plus-scrub is the only new migration logic. After it, delete all roster support.

**Alternatives rejected.** The Opus report's zero-new-JavaScript rule (`plans/port-3.0/port-review-opus-2026-09-02.md:435-438`) assumes the operational migration always happens first. In reality, an in-place 3.0 install would remove the only cleanup implementation while leaving copied agents, gate hooks, and runtime; current cleanup exists only in the v2.5 uninstaller (`install.js:3415-3530`), and `--roster legacy` is only a flag flip (`install.js:2603-2623`). A small fail-before-write check plus exact-key cleanup is cheaper than silent stranding or permanently stale config and does not preserve 2.0 compatibility.

### 9. No new review→fix machinery, verifier, or telemetry

**Decision.** Executors run requested verification; reviewers independently inspect and rerun it. REVISE is relayed as a new bounded executor order under the existing two-bounce stopping rule. Delete verifier/manifest/telemetry and do not replace them.

**Alternatives rejected.** The verifier duplicates reviewer work and creates a second truth source (`plans/port-3.0/port-review-opus-2026-09-02.md:168-210`). The 2.0 manifest duplicates Git and installer state (`plans/port-3.0/port-review-opus-2026-09-02.md:221-242`). Telemetry cannot measure OpenAI cost and is not a product requirement (`plans/port-3.0/port-review-opus-2026-09-02.md:608-691`). The oracle's contrary PORT calls (`plans/port-3.0/harness-value-oracle-2026-09-02.md:37-50`) are therefore not followed.

## WORK BREAKDOWN

### Shared execution contract

Each work order below is one commit after its checks pass. Do not parallelize these orders: they overlap installer, tests, docs, or CI. Use Sonnet for pure deletion and routine edits; use Opus only if the installer/guard order proves split-resistant. “Needs Sol review” means it must be included in the next campaign review, not necessarily reviewed immediately. The current CI enumerates the existing lane tests and 2.0 suites (`.github/workflows/test.yml:80-251`); every order must update the workflow in the same commit when its runnable set changes.

This intentionally reverses the Opus review's leaves-first sequence (`plans/port-3.0/port-review-opus-2026-09-02.md:746-755`). Detach the installer, guard, and MCP dependencies first while the old modules still exist; then delete implementations, their direct tests, and their CI steps atomically. Leaves-first would make the surviving MCP and install paths reference missing modules between commits, contrary to this order's green-after-every-commit requirement. One atomic pure-deletion commit is safer here than the review's subsystem-by-subsystem commits because no active consumer remains after WO-2.

The surviving full check set after WO-4 is:

```text
node install.js --lint
node tests/frontmatter-lint.test.js
node tests/review-lane.test.js
node tests/scan-lane.test.js
node tests/exec-lane.test.js
node tests/mcp-lane.test.js
node tests/install.test.js
node tests/guard.test.js
```

Do not introduce a package-level test wrapper. A work order may add targeted arguments already supported by a test file, but its report must show the exact commands and output.

### WO-0 — Freeze 2.5 and evacuate the live project

- **Kind:** operational migration checkpoint; no repository edits except the explicit tag/capture artifacts authorized by the owner at execution time.
- **Files/state:** settled `main`, tag `v2.5.0-final`, PiratePartyPals install, archived ledger.
- **Actions:** perform steps 1–5 of “Migration of live projects” below before deleting any cleanup code. The dependency is hard: the v2.5 uninstaller owns canonical roster/runtime cleanup (`install.js:3415-3530`), and the ledger loses its ticket join key after uninstall (`plans/port-3.0/port-review-opus-2026-09-02.md:713-718`).
- **Verification:** the manual census and one control round in the migration section.
- **Expected line delta:** 0 in the port branch; two ledger snapshots are historical artifacts only if the owner chooses to add them.
- **Class/review:** operational behavior; owner checkpoint. Do not start WO-1 until it passes.

### WO-1 — Make install and activation legacy-only

- **Kind:** behavior change; **needs Sol review**.
- **Files:** `install.js`, `hooks/orchestra-guard.js`, `ORCHESTRA.md`, `tests/install.test.js`, `tests/guard.test.js`, delete `tests/bridge-acceptance.test.js`, edit `.github/workflows/test.yml`.
- **`install.js` edits:**
  - Delete roster classification/constants and role discovery at `install.js:92-123`.
  - Delete the pin hash/read/write/verify/repin implementation at `install.js:685-1065` and its CLI modes at `install.js:1992-2238`.
  - Delete gate-hook builders/runtime gitignore support at `install.js:1309-1420`.
  - Delete `--roster` parse/validation/inheritance at `install.js:2003-2051` and `install.js:2320-2332`.
  - Add the fail-before-write `roster:new` preflight immediately after target path resolution and before collision/copy work. After the refusal check, strip only the deprecated keys named in Design Decision 8 and preserve all other config.
  - Delete roster collision/copy/substrate install at `install.js:2358-2530` and roster manifest mutation at `install.js:2545-2624`.
  - Keep pack copying/MCP registration at `install.js:2630-2732`; delete only the conductor stamp at `install.js:2742-2753`.
  - Make `guardHookEntry()` unconditional and delete gate event registration/verification at `install.js:2774-2816` and `install.js:2894-2914`.
  - Preserve permission-grant merge and uninstall bookkeeping at `install.js:2818-2983` and `install.js:3103-3325`, but replace calls to the deleted pin writer with ordinary `writeJson` and remove roster-only tracking conditions.
  - Remove `roster` from state written at `install.js:2992-2999`.
  - Delete roster/runtime/ticket-store uninstall and out-of-tree pin removal at `install.js:3415-3530` and `install.js:3596-3608`; retain core/pack/specialist/hook/permission uninstall.
- **`orchestra-guard.js` edits:** delete roster argv/detection (`hooks/orchestra-guard.js:292-320`), roster denial prose (`hooks/orchestra-guard.js:339-416`), pin support (`hooks/orchestra-guard.js:654-822`), seats/generation policy (`hooks/orchestra-guard.js:826-916`), and ticket-gate Agent branch (`hooks/orchestra-guard.js:1405-1461`). Retain pause, path containment, managed-marker, plan/memory, and model detection. Collapse `loadPolicy()` to the four Director policy arrays. Preserve the positive-evidence Fable/Opus activation at `hooks/orchestra-guard.js:1591-1612`; remove new-roster fail-closed handling at `hooks/orchestra-guard.js:1622-1634`.
- **`ORCHESTRA.md` edit:** install the “Mode detection” draft below now so the installed behavior and master protocol agree in this commit; remove the roster parenthetical from parallelization at `ORCHESTRA.md:55`.
- **Tests:** rewrite installer cases around legacy-only fresh install/update/uninstall, preservation of user settings, pack selection, permission ownership, exact deprecated-key cleanup, and explicit refusal-before-any-write of an existing `roster:new` manifest. Remove roster/pin/gate/substrate cases. In guard tests, retain Fable/Opus deny, Sonnet/Haiku/unknown allow, pause, plan/memory, marker, and fail-open parse cases; remove roster/pin/ticket cases. Delete bridge acceptance because its sole purpose is the installed 2.0 lifecycle. Remove its CI step at `.github/workflows/test.yml:186-194`.
- **Verification:** `node tests/install.test.js`; `node tests/guard.test.js`; `node tests/frontmatter-lint.test.js`; `node install.js --lint`.
- **Expected line delta:** approximately −2,400 to −3,200 lines, dominated by installer/guard/tests and the 903-line bridge acceptance suite.
- **Commits (two, in this order):** `port: make guard legacy-only` (guard edits + guard tests) then `port: make installer legacy-only` (installer edits, installer tests, bridge-acceptance deletion, CI step, ORCHESTRA.md mode text). The guard commit must pass its tests while the installer still writes 2.0 manifests; the guard already fails open on unknown policy fields.

### WO-2 — Decouple the Codex interface from the control plane

- **Kind:** behavior change; **needs Sol review**.
- **Files:** `packs/codex/hooks/orchestra-engine-mcp.js`, `packs/codex/hooks/orchestra-review.js`, `tests/mcp-lane.test.js`, `tests/review-lane.test.js`.
- **MCP edits:**
  - Delete bridge/runtime/schema loaders and ticket helpers at `packs/codex/hooks/orchestra-engine-mcp.js:57-267`, `packs/codex/hooks/orchestra-engine-mcp.js:369-421`, and `packs/codex/hooks/orchestra-engine-mcp.js:597-670`.
  - From `orchestra_review`, delete `ticket`/`role` schema and `requireEngineTicket`/binding at `packs/codex/hooks/orchestra-engine-mcp.js:900-943`; pass the validated inputs straight to `runRunner`.
  - From `orchestra_exec`, delete `ticket`/`role`, casting comparison, and ticket-derived model selection at `packs/codex/hooks/orchestra-engine-mcp.js:965-1017`; pass optional caller model/effort directly until WO-4 removes unnecessary overrides.
  - Delete the roster refusal in crossplan at `packs/codex/hooks/orchestra-engine-mcp.js:1045-1051`.
  - Delete `orchestra_dispatch` and `orchestra_close` at `packs/codex/hooks/orchestra-engine-mcp.js:1076-1141`.
  - Strip bridge diagnostics from `orchestra_doctor` at `packs/codex/hooks/orchestra-engine-mcp.js:1143-1180`; keep Codex/helper diagnostics. Bump the server's own reported protocol version at `packs/codex/hooks/orchestra-engine-mcp.js:1213` to `3.0.0`.
- **Review-runner edits:** delete the bridge-only verdict nonce/JSON envelope and header fields at `packs/codex/hooks/orchestra-review.js:286-293`, `packs/codex/hooks/orchestra-review.js:1857-1901`, `packs/codex/hooks/orchestra-review.js:1975`, and `packs/codex/hooks/orchestra-review.js:2429`. Preserve the existing human-readable unavailable verdict at `packs/codex/hooks/orchestra-review.js:2503-2536`.
- **Tests:** delete ticket/casting/dispatch/close/bridge-doctor assertions from MCP tests; retain schema validation, blocking progress, argument translation, crossplan, doctor, timeout, and unavailable propagation. Delete review-runner assertions solely about bridge result JSON/nonce; retain availability, pinned checkout, integrity, prohibition, retry, and verdict tests.
- **Verification:** `node tests/mcp-lane.test.js`; `node tests/review-lane.test.js`; `node tests/exec-lane.test.js`.
- **Expected line delta:** approximately −850 to −1,150 lines.
- **Commit:** `port: reduce codex MCP to runner transport`.

### WO-3 — Delete the retired 2.0 substrate

- **Kind:** **pure deletion; safe for Sonnet; no separate review beyond tests**. The replacement archive README is inert documentation.
- **Delete implementation:** `bridge/**`, `router/**`, `registry/**`, `verifier/**`, `quartermaster/**`, `tools/orchestra-ledger-report.js`, `tools/shakedown/**`, and `probes/**`.
- **Delete active roster:** `roster/architect.md`, `builder.md`, `builder-openai.md`, `conductor.md`, `data-engineer.md`, `investigator.md`, `red-team.md`, `reviewer-anthropic.md`, `reviewer-openai.md`, `sweeper.md`, `test-designer-vs-anthropic.md`, `test-designer-vs-openai.md`, and `roster/lint.js`. Do not delete any dated plan/report/exercise.
- **Replace `roster/README.md:1-102`:** a short archive notice saying active agents live in `agents/` and `packs/codex/agents/`; all remaining files are historical evidence and are not installed or linted.
- **Delete tests:** `tests/bridge.test.js`, `tests/bridge-close.test.js`, `tests/router.test.js`, `tests/tickets.test.js`, `tests/quartermaster.test.js`, `tests/registry.test.js`, `tests/verifier.test.js`, and `tests/wo12-tooling.test.js`. The first seven directly test deleted subsystems; WO12 tooling is a closed 2.0 construction harness and is not part of the end-state suite.
- **CI edit:** delete the corresponding steps at `.github/workflows/test.yml:113-184`, `.github/workflows/test.yml:197-215`, and `.github/workflows/test.yml:224-231`; keep every surviving lane/install/guard step. **Fable addition (after WO-1):** also delete the `WO-7b misroute-recovery gates` step (it runs `plans/.../wo7b/score.js` through the live router, which WO-3 deletes; the script stays as history) and the `Roster contract lint` step (`roster/lint.js` is deleted here), and rename `Install suite (--roster legacy|new)` to `Install suite`. Note the surviving scan suite is `tests/scan-lane.test.js`, not `scan.test.js`.
- **Verification:** run the entire surviving full check set listed above.
- **Expected line delta:** approximately −27,000 to −29,000 lines including docs, tests, profiles, and probes. The Opus review's −20,000 estimate excludes several docs/schemas/probes and the 4,843-line WO12 tooling suite (`plans/port-3.0/port-review-opus-2026-09-02.md:463-492`).
- **Difference from the Opus list:** it did not list `probes/**` or `tests/wo12-tooling.test.js`. Delete them because the probes are explicitly a 2.0 telemetry/pre-build runbook (`probes/RUNBOOK.md:1-202`, `probes/orchestra-telemetry.js:1-302`) and the test identifies itself as a standalone WO12 corpus-tooling suite with only stubbed runners (`tests/wo12-tooling.test.js:1-45`), not an end-state harness test. Keep the corresponding historical plans and review records.
- **Commit:** `port: delete orchestra 2 control plane`.

### WO-4 — Collapse Codex execution and review to Sol

- **Kind:** behavior change; **needs Sol review**.
- **Files:** delete `packs/codex/agents/executor-codex.md`; edit `packs/codex/agents/executor-codex-heavy.md`, `packs/codex/agents/reviewer-codex.md`, `packs/codex/hooks/orchestra-exec.js`, `packs/codex/hooks/orchestra-review.js`, `packs/codex/hooks/orchestra-engine-mcp.js`, `packs/codex/pack.json`, `packs/codex/README.md`, `packs/codex/FIELD-VALIDATION.md`, `tests/exec-lane.test.js`, `tests/review-lane.test.js`, and `tests/mcp-lane.test.js`.
- **Launcher edits:** turn the 37-line heavy launcher into the sole standalone executor launcher; remove its dependency on the Terra base profile (`packs/codex/agents/executor-codex-heavy.md:13-25`), always invoke the MCP exec tool once, and identify it as exceptional-only. Install the reviewer one-line addition from Draft Text in `reviewer-codex.md`.
- **Exec-runner edits:** remove the `tier` CLI/input/header, `TIER_DEFAULTS`, standard model/effort docs, and `execModel`/`execEffort` resolution at `packs/codex/hooks/orchestra-exec.js:7-20`, `packs/codex/hooks/orchestra-exec.js:89-116`, `packs/codex/hooks/orchestra-exec.js:183-235`, `packs/codex/hooks/orchestra-exec.js:960`, `packs/codex/hooks/orchestra-exec.js:1119`, and `packs/codex/hooks/orchestra-exec.js:1138-1175`. Resolve model as flag → environment → `codex.execHeavyModel` → `gpt-5.6-sol`, and effort as flag → environment → `codex.execHeavyEffort` → `high`. Do not add a light key.
- **Review-runner edit:** change the empty/default-dependent review model at `packs/codex/hooks/orchestra-review.js:295-300` to `gpt-5.6-sol`, and the built-in timeout default at `packs/codex/hooks/orchestra-review.js:300` from 600000 to 1800000, while preserving explicit flag/environment/config precedence.
- **MCP edit:** remove exec `tier` from its description/schema/arguments at `packs/codex/hooks/orchestra-engine-mcp.js:947-1017`; keep optional model/effort only for explicit exceptional overrides.
- **Pack docs:** remove Terra/standard/light/reviewEngine language from `packs/codex/pack.json:3-14`, the role/setup/tier sections of `packs/codex/README.md:14-98`, and matching field-validation claims. Document Sol reviewer default, Sol exceptional executor, and Sol/high crossplan.
- **Tests:** replace tier matrices with one default Sol/high path plus explicit override precedence. Assert that the MCP surface has no `tier`; assert default review model is Sol and unavailable output remains loud.
- **Verification:** `node tests/exec-lane.test.js`; `node tests/review-lane.test.js`; `node tests/mcp-lane.test.js`; `node tests/frontmatter-lint.test.js`.
- **Expected line delta:** approximately −250 to −450 lines.
- **Commit:** `port: use one sol executor and one sol reviewer`.

### WO-5 — Publish the compact 3.0 protocol and documentation

- **Kind:** behavior-defining documentation/config release; **needs Sol review as the campaign gate**.
- **Files:** `ORCHESTRA.md`, `agents/reviewer.md`, `packs/codex/agents/reviewer-codex.md`, `skills/orchestra-plan/SKILL.md`, `skills/orchestra-review/SKILL.md`, `skills/orchestra-status/SKILL.md`, `README.md`, `CHANGELOG.md`, `VERSION`, and any pack docs not completed in WO-4.
- **Protocol:** replace the company, executor-steering, review, cadence, and failure blocks with Draft Text. Preserve the Director no-code law, two-bounce stopping rule, pause switch, worktree isolation, and verification/report requirements. Target ≤100 lines/~3,000 words.
- **Reviewer profiles:** add exactly the two one-line rules below. Do not otherwise expand the profiles.
- **Skills:** remove `reviewEngine`, Terra/standard executor, dormant-warning, roster, ticket, verifier, and per-order-review assumptions. `orchestra-review` routes Claude-authored work to Sol, Codex-authored work to Opus, and uses the alarm on fallback. `orchestra-plan` plans at least one review per campaign and requires base/head for committed batches. `orchestra-status` reports `DIRECTOR` for Fable/Opus and `NORMAL` for Sonnet/Haiku; it reports Sol lane availability and no longer treats absence as a silent expected fallback. Current stale fields are concentrated at `skills/orchestra-status/SKILL.md:12-23`, `skills/orchestra-status/SKILL.md:30-55`, `skills/orchestra-review/SKILL.md:12-23`, `skills/orchestra-plan/SKILL.md:21`, and `skills/orchestra-plan/SKILL.md:57-58`.
- **README:** replace with the ≤400-line outline in Design Decision 7 and include the v2.5 uninstall warning before the install command.
- **Changelog/version:** prepend a concise 3.0 breaking-change entry; preserve older text byte-for-byte. Set `VERSION` to `3.0.0`.
- **Verification:** run the entire surviving full check set; then `rg -n -i 'roster:new|rosterGeneration|projectId|ticket-gate|orchestra_dispatch|orchestra_close|reviewEngine|execLightModel|gpt-5\.6-terra|gpt-5\.6-luna|executor-codex\.md' ORCHESTRA.md README.md agents skills hooks packs install.js tests .github/workflows/test.yml` and explain every remaining hit. Historical `CHANGELOG.md`, `plans/`, and `roster/` are intentionally excluded from this stale-reference gate.
- **Expected line delta:** approximately −500 to −850 lines, primarily the README/protocol trim.
- **Commit:** `docs: publish orchestra 3 legacy protocol`.

### WO-6 — Reinstall and prove 3.0 on PiratePartyPals

- **Kind:** live operational validation; **needs Sol review of the proving change**.
- **Scope:** PiratePartyPals only after WO-5 is green and reviewed. No harness-source edits unless a failure becomes a separately approved order.
- **Actions/verification:** execute steps 6–10 in “Migration of live projects.” One real Claude-authored change, one Sol campaign review, one clean reinstall. Record exact versions, SHAs, commands, verdict, and manual census.
- **Expected line delta:** no planned harness delta; the proving change must be independently scoped in PiratePartyPals.
- **Gate:** merge 3.0 only after the proving round and reinstall are clean.

## MIGRATION OF LIVE PROJECTS

PiratePartyPals is currently known from the owner note to be v2.5.0 with `roster: "new"`; do not inspect or touch it while planning. Execute this sequence later with explicit owner authorization:

1. **Settle and tag.** Land or close outstanding 2.5 work, verify `main` is the intended v2.5.0 source, and record its SHA. From that settled checkout run `git tag -a v2.5.0-final -m "Final Orchestra 2.5 rollback point"`, then `git push origin v2.5.0-final`. Record the tag SHA. The Opus review makes this the recovery anchor (`plans/port-3.0/port-review-opus-2026-09-02.md:722-726`).
2. **Capture before any uninstall.** From the `v2.5.0-final` checkout, run `node tools/orchestra-ledger-report.js "<PiratePartyPals>" --json > "<external-archive>/ppp-final-2.0-ledger.json"` and `node tools/orchestra-ledger-report.js "<PiratePartyPals>" > "<external-archive>/ppp-final-2.0-ledger.txt"`. Copy PiratePartyPals' entire `.claude/orchestra/` directory to `<external-archive>/ppp-orchestra-runtime/`. The report must precede uninstall because ticket data is its join key (`plans/port-3.0/port-review-opus-2026-09-02.md:713-718`, `plans/port-3.0/port-review-opus-2026-09-02.md:728-732`).
3. **Uninstall with v2.5, never 3.0.** Still at tag `v2.5.0-final`, run `node install.js "<PiratePartyPals>" --uninstall`. Do not substitute `--roster legacy`: current code explicitly leaves installed roster files on that flip (`install.js:2603-2623`).
4. **Install the legacy control explicitly.** Still with the v2.5 installer, run `node install.js "<PiratePartyPals>" --roster legacy --packs codex`. This deliberately corrects the Opus review's no-flag command (`plans/port-3.0/port-review-opus-2026-09-02.md:734-736`): v2.5 uninstall leaves the owner-pinned `orchestra.json` in place (`install.js:3600-3608`), while a no-flag reinstall inherits its recorded roster (`install.js:2325-2331`) and could silently reinstall `roster:new`. Explicit legacy is safe only after the preceding full uninstall has removed the copied files/runtime.
5. **Verify the control by hand.** Confirm exactly six core legacy agent profiles plus pack profiles and selected specialists; no `.claude/ORCHESTRA-CONDUCTOR.md`; no Orchestra `ticket-gate.js` entries in `.claude/settings.json`; **no `.claude/orchestra/` directory at all** (move the orphaned ledger to the archive); and **no `projectId`, `installedFiles`, `rosterGeneration`, `seats`, `installedStore`, or `verifier` key in `orchestra.json`** — the 2.5 engine gate fails closed on any of these (WO-0 finding, Fable edit 7). Confirm a Fable/Opus session is guarded and a Sonnet/Haiku session can work normally without a pause file. Run a read-only scout → tiny Claude executor → `reviewer-codex` control round. Stop the port if this baseline is broken.
6. **Build 3.0 only after the control passes.** Execute WO-1 through WO-5 on `port/3.0-legacy`, maintaining a green commit after each order.
7. **Install 3.0.** From the reviewed WO-5 head, run `node install.js "<PiratePartyPals>" --packs codex` with no roster flag. Re-run the exact command once to prove idempotence. The existing MCP merge must preserve unrelated entries (`install.js:2689-2732`), and the config migration must remove the deprecated keys without touching project-owned extensions.
8. **Verify 3.0 by hand.** Confirm the installed tree matches End State; `executor-codex.md`, conductor, runtime directories, tickets, and gate hooks are absent; `.claude/orchestra.json` has no deleted key or Terra/Luna model; the MCP server advertises only review, exec, crossplan, and doctor; Fable/Opus activate Director enforcement; Sonnet/Haiku are silent normal sessions.
9. **Run one proving campaign.** In a fresh Fable or Opus session, take one small real PiratePartyPals goal through scout → Claude executor → scout tree-audit → Sol `reviewer-codex` → final REPORT. Commit before review and pass exact base/head refs. The goal should be real but low-risk. Do not manufacture a Sol executor use: its purpose is only a future order with evidence that Anthropic models have struggled.
10. **Record and merge.** Save installer output, manual census, campaign base/head SHAs, runner header, verdict, and any fail-loud alarm. Merge only if the control and proving campaign pass.

**Rollback.** Stop activity and run `git switch --detach v2.5.0-final`, `node install.js "<PiratePartyPals>" --uninstall`, then `node install.js "<PiratePartyPals>" --roster legacy --packs codex`. If the owner explicitly wants the abandoned 2.0 roster restored, run the tagged installer as `node install.js "<PiratePartyPals>" --roster new --packs codex`, restore the archived `.claude/orchestra/` data, and verify gate entries and tickets before launching an agent. Never try to reconstruct 2.0 from the 3.0 branch.

## DRAFT TEXT

The following is replacement text, not guidance for an executor to paraphrase.

### `ORCHESTRA.md` — mode detection

```markdown
## 1. Determine your mode (do this first, silently)

Read the session model from the system prompt/environment details.

- **Fable or Opus → DIRECTOR MODE.** Run the Orchestra: you decompose, decide, delegate, review, and report; you do not edit, search, or run commands yourself.
  - **If you are Opus:** keep every order and every explanation concise, basic, and clear. Do not drop context the executor needs to do the work or the owner needs to follow it.
- **Sonnet, Haiku, or anything else → NORMAL MODE.** Act as a normal agent. Do not announce dormancy, deny tools, ask for Fable/Opus, or require a pause file.

The guard follows the same positive-evidence rule: it enforces Director law only when it identifies Fable or Opus. Unknown model evidence fails open to NORMAL MODE.
```

### `ORCHESTRA.md` — company table

```markdown
## 2. The company

| Role | Agent | Model | Purpose |
|---|---|---|---|
| Director | this session | Fable / Opus | decompose, decide, arbitrate, synthesize, talk to the user; never implement |
| Scout | `scout` | Haiku | read-only where/what mapping |
| Detective | `detective` | Opus | read-only causal investigation |
| Executor | `executor` | Sonnet | routine edits, commands, builds, and tests |
| Heavy executor | `executor-heavy` / `executor-heavy-xhigh` | Opus high / xhigh | hard, split-resistant, or escalated Claude work |
| Reviewer | `reviewer` | Opus, fresh context | fallback review; primary review of Codex-authored work |
| Sol reviewer † | `reviewer-codex` | GPT-5.6 Sol | default independent review of Claude-authored campaign work |
| Sol executor † | `executor-codex-heavy` | GPT-5.6 Sol, high | exceptional work that has given Anthropic models trouble; never routine work |
| Cross-compare architects † | `architect-claude*` / `architect-codex` | Fable / GPT-5.6 Sol | independent plans, cross-critique, revision |
| Plan synthesizer † | `plan-synthesizer` | Opus, fresh/blind | adjudicate revised plans without lane identity |

† Installed only with the optional `codex` pack. Without it, Claude execution and fresh-context Opus review remain available; report the missing cross-family lane plainly.
```

### `ORCHESTRA.md` — executor steering

```markdown
**Executor steering.** Claude is the default. Use `executor` for routine orders and the Opus heavy profiles only for hard or escalated orders. The optional Codex lane has one executor: `executor-codex-heavy` (Sol/high). Route an order there only when concrete prior evidence says Anthropic models have struggled with that problem. `executorEngine: "codex"` in `.claude/orchestra.json` is the durable choice; an in-conversation instruction overrides it for the named session or order. If the pack or Codex lane is unavailable, inspect its TREE AUDIT, then route the order to the appropriate Claude executor and say so.
```

### `ORCHESTRA.md` — review rule, cadence, and fail-loud fallback

```markdown
## 5. Review, campaigns, and fallback

A **campaign** is one contiguous user goal from INTAKE through its final REPORT. It may contain several related executor goals, orders, or commits. It ends before any final done/handoff statement, merge, release, deploy, or switch to an unrelated user goal.

Every campaign must receive at least one independent review. The Director may batch related completed executor goals into one cross-family review, but must run it before the earliest campaign-ending event. A batch must be one cohesive diff, identify every included goal, and use exact base/head refs when committed. Never review a moving tree. Parallel executors always use separate worktrees.

For Claude-authored work, `reviewer-codex` (Sol) is the default. For Codex-authored work, use the fresh-context Opus `reviewer`. A reviewer returns PASS, REVISE, or REVIEW_UNAVAILABLE and never fixes the change. Relay REVISE findings verbatim in a bounded executor order; do not add a review→fix loop or self-approve.

At INTAKE, when the `codex` pack is installed, call `orchestra_doctor` once. If it reports the Sol lane unavailable, raise the alarm below then, not at review time. If the pack is not installed, say so once in the REPORT and use `reviewer`; no alarm.

If the Sol lane is installed but cannot run for any reason, immediately show this user-visible line:

⚠ CROSS-FAMILY REVIEW UNAVAILABLE — Sol did not review this campaign: `<reason>`. Falling back to fresh-context Anthropic review; work continues.

Then run `reviewer` in fresh context. Repeat the alarm in the campaign's final REPORT with the fallback verdict and commands actually run. The fallback may satisfy the safety gate, but never describe the campaign as Sol-reviewed.
```

### `ORCHESTRA.md` — operating-loop beats that change

```markdown
- **EXECUTE** — dispatch a self-contained order. After a Claude executor reports, have a scout compare `git status --porcelain` with its CHANGES claim. A Codex executor's TREE AUDIT supplies that check.
- **REVIEW** — review at least once per campaign under §5. Review may follow one order or a cohesive batch; it may not cross a campaign boundary.
- **REPORT** — state what changed, what verification and review actually ran, and any unavailable lane. Do not call the campaign done before its review gate.
```

### One-line addition to `agents/reviewer.md`

Add after the fresh-context independence rule (`agents/reviewer.md:9`):

```markdown
When you are the fallback for an unavailable Sol review, make the first verdict line `⚠ CROSS-FAMILY REVIEW FALLBACK — Sol did not review this campaign; this is a fresh-context Anthropic fallback.`
```

### One-line addition to `packs/codex/agents/reviewer-codex.md`

Add after the single-call rule (`packs/codex/agents/reviewer-codex.md:13-16`):

```markdown
If the tool returns `REVIEW_UNAVAILABLE`, relay its `REVIEW_ENGINE`, `VERDICT`, reason, and `FINALITY` lines verbatim and unsoftened so the Director must raise the cross-family-unavailable alarm.
```

## RISKS AND STOPPING RULES

- **Live-project stranding.** If PiratePartyPals has not been ledger-captured, uninstalled by the tagged v2.5 installer, and manually shown free of gates/runtime, stop before WO-1. The current cleaner is about to be deleted (`install.js:3415-3530`).
- **Activation regression.** If any Sonnet/Haiku/unknown session is denied or warned after WO-1, or a positively identified Fable/Opus session can edit/search/run commands, stop. Do not patch around it with a pause file.
- **Installer ownership regression.** If install/uninstall overwrites user MCP/settings entries, cannot remove its own permission grants, or a fresh legacy install creates roster/runtime state, revert WO-1 and split it. Permission ownership is current retained behavior (`install.js:2818-2983`, `install.js:3103-3325`).
- **MCP transport regression.** If review/exec/crossplan/doctor no longer block to final output, lose timeout/prohibition arguments, or expose dispatch/close after WO-2, stop. Do not replace MCP with shell transport inside the same order.
- **Silent review degradation.** If any Codex failure reaches a final campaign report without the exact alarm, the port is not shippable even if fallback Opus passes.
- **Review batching abuse.** If a proposed review diff cannot be described as one cohesive campaign or cannot name base/head, split it. Do not use batching to review unrelated accumulated work.
- **Model leakage.** Any live (nonhistorical) Terra/Luna, `executor-codex`, standard/light tier, or `reviewEngine` reference after WO-5 blocks release. Historical changelog/roster/plans may retain truthful references.
- **Crossplan damage.** If reducing the MCP server breaks anonymous cross-compare or forces architect writes into the product tree, stop and restore the prior MCP boundary; crossplan is an explicit keep.
- **Scope.** The standalone root `codex/` mirror is excluded from this port by ruling. If an executor finds it must edit `codex/` to keep the suite green, stop and report; do not expand WO-4.
- **Verification non-convergence.** Apply the executor harness rule: the same failure twice after two different fixes, or three fix/verify cycles without convergence, ends the order as PARTIAL/BLOCKED. Do not take a fourth guess.
- **Line budget miss.** A survivor growing above its current size, `ORCHESTRA.md` over 100 lines, README over 400 lines, or a total reduction below 25,000 lines requires a Fable review before merge; size is not a reason to delete required safety behavior blindly.

## ESTIMATE

Current measured active surfaces are: `ORCHESTRA.md` 126 lines (`ORCHESTRA.md:1-126`); README 722 lines/~130 KB (`README.md:1-722`); changelog 1,372 lines/~90 KB (`CHANGELOG.md:1-1372`); installer 3,613 lines (`install.js:1-3613`); guard 1,637 (`hooks/orchestra-guard.js:1-1637`); engine MCP 1,265 (`packs/codex/hooks/orchestra-engine-mcp.js:1-1265`); review runner 3,134 (`packs/codex/hooks/orchestra-review.js:1-3134`); exec runner 1,492 (`packs/codex/hooks/orchestra-exec.js:1-1492`); crossplan runner 1,329 (`packs/codex/hooks/orchestra-crossplan.js:1-1329`). The Opus review independently measured the central JavaScript/test cuts and estimated about 20,000–20,900 removed lines before accounting for several documentation/schema/probe and WO12-test deletions (`plans/port-3.0/port-review-opus-2026-09-02.md:478-495`).

| Surface | Before | Target after |
|---|---:|---:|
| `ORCHESTRA.md` | 126 | ≤100 |
| `README.md` | 722 | ≤400 |
| `CHANGELOG.md` | 1,372 | 1,372 + a concise 3.0 entry |
| `install.js` | 3,613 | ~2,650–2,850 |
| `hooks/orchestra-guard.js` | 1,637 | ~1,150–1,200 |
| `orchestra-engine-mcp.js` | 1,265 | ~800–850 |
| `orchestra-review.js` | 3,134 | ~3,075–3,085 |
| `orchestra-exec.js` | 1,492 | ~1,390–1,430 |
| `orchestra-crossplan.js` | 1,329 | 1,329 |
| retired implementation/docs/tests/profiles/probes | ~27,000–29,000 | 0 active lines |
| **net repository delta** | — | **approximately −31,000 to −34,000 lines** |

Plan for **six repository executor rounds** after the live baseline (WO-1 as two commits, WO-2 through WO-5), plus **one live-project proving round** (WO-6). WO-3 is pure deletion. WO-1, WO-2, and WO-4 change behavior and may be batched into one Sol review only if they remain one cohesive reverse-port campaign with exact commit ranges; WO-5 is the mandatory final campaign review gate. Practical expectation: six Sonnet/Opus executor rounds, two Sol review passes (behavior batch plus release/docs gate), and one PiratePartyPals proving campaign. No review→fix cycle is pre-planned; a REVISE creates a bounded repair order or triggers a stopping rule.

## CAMPAIGN REVIEW AND FOLLOW-UPS (Fable, 2026-09-02 late)

Sol (gpt-5.6-sol, pinned worktree @ df4346d) reviewed main..port/3.0-legacy: **REVISE**, 6 MAJOR + 1 MINOR + 1 NIT. All eight suites confirmed by the reviewer. Disposition:

| Finding | Disposition |
|---|---|
| MCP backstop still uses the 600000 ms review default | FIXED in the fix round |
| Guard denies on a corrupt transcript without identifying Fable/Opus | FIXED — corrupt transcript now fails open |
| ORCHESTRA.md let a speed request skip the campaign review | FIXED — "a user request for speed changes the batch, never the gate" |
| INTAKE `orchestra_doctor` could mutate the Codex install (helper restore) | FIXED — doctor is read-only unless `repair=true`; runner gains `--no-repair` |
| `agents/reviewer.md` description advertised per-change Opus review | FIXED |
| README "byte-for-byte" wording; permission-grant claim | FIXED to match the code |
| Uninstall removes a pre-existing user grant identical to an installer grant | **FOLLOW-UP F1** — reproduced identically on v2.5.0-final; pre-existing legacy behaviour, not a port regression |
| Uninstall deletes a user-authored `.claude/agents/reviewer.md` in a never-installed project (deletion by name, no ownership evidence) | **FOLLOW-UP F2** — reproduced identically on v2.5.0-final; pre-existing legacy behaviour |

**Follow-ups after merge, each its own small order:** F1 protect pre-existing identical grants (record what the installer *added* vs found); F2 uninstall removes only files carrying the installer's managed marker or listed in `orchestra-install.json`; F3 (from the Opus review) a `SubagentStop` telemetry hook if the plan ledger proves insufficient after a week; F4 the guard's second-pass reduction toward ~400 lines; F5 delete the stale pre-2.0 leftovers in PiratePartyPals (`orchestra-deepplan.js`, `orchestra-ultraplan.js`, `deep-plan`, `clean-slate`) on owner say-so.

**Re-review (pinned @ c507248): REVISE again, 5 MAJOR + 1 MINOR, all new (none of the first round's findings bounced).** `--no-repair` missed the `verifyHelperSiblings` copy path; `--uninstall --ignore-manifest` had been removed while the README still offered it; README:42 falsely promised same-named hand-authored files survive uninstall (that is F2); the pause-file denial fired before the model check in Sonnet sessions; ORCHESTRA.md §3.2 let a formatting campaign skip review; the MCP schema text still said 600000 ms. **Fable decision:** one final bounded fix round for all six (each a few lines), then a Sol delta review of that commit only. A third REVISE stops the port and goes to the owner.

**Delta review (pinned @ 8e7d3dd): APPROVE** (1 MINOR README wording + 2 comment nits, fixed in b24de6f). **WO-6 install (2026-09-02 late):** `node install.js <ppp> --packs codex` from b24de6f — preflight scrubbed `roster` and `reviewEngine`, second run idempotent; census: 6 core + 7 pack agents (+ owner's planner-gpt.md), no conductor, no `.claude/orchestra/`, guard entry present, no ticket-gate, MCP advertises exactly review/exec/crossplan/doctor, protocol stamped v3.0.0 at 91 lines, doctor `--no-repair` OK. **Finding F6:** the 3.0 installer does not prune agents dropped from a pack between versions — `executor-codex.md` (Terra, installed by the 2.5 legacy reinstall) survived the 3.0 update and had to be removed by hand; the 3.0 uninstaller no longer knows that name either. Follow-up: keep a list of retired pack filenames to prune on update/uninstall. **Owed:** the owner's proving campaign in a fresh Fable/Opus PPP session (scout → Claude executor → scout tree check → Sol review → REPORT), then merge.
