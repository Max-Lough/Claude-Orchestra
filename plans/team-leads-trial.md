# Plan: team leads, a Haiku mechanical rung, and the company law behind them (3.9.0 trial)

Date: 2026-10-08 · Status: APPROVED IN PRINCIPLE (owner, 2026-10-08). WO-0 is done
(`plans/team-leads-probe-results.md`), and this plan is amended for its results (see "WO-0
amendments" at the end). WO-1 is next. Implementation is local, on a branch-only 3.9.0.

## Goal

Let the Director take a basic plan with clear goals and run it to completion over a much longer
horizon, without its own context filling up with every executor report, scout audit and review
verdict. The Director hands each large sub-goal to a **lead**: an Opus mini-director that plans
the work orders, routes executors, runs scouts and cross-family reviews, drives fix rounds, and
reports back in a few lines. The Director keeps the end goal and spends its context on goal
drift, runaway work, integration, and the user.

Three smaller pieces ride along:

- a **Haiku 5.5 mechanical executor** (`executor-mechanical-haiku`), trialled beside the Sonnet
  mechanical rung for fully spelled-out orders;
- **company law for subagents**: who may spawn whom (frontmatter for non-leads, the guard for leads),
  what a lead may write, and a budget clock that forces leads to check in;
- **the Anthropic principal rung moves to Opus 5.5** at xhigh and max (D13). The Fable
  substitute rule is retired, and the Fable profiles become user-request-only `executor-fable`
  and `executor-fable-xhigh`.

## Decisions

Settled in the design discussion of 2026-10-07/08. Owner rulings are marked.

**D1. Leads coordinate; they never edit code. Two tiers, both Opus (owner).**

| Profile | Model | Chosen when |
|---|---|---|
| `lead` | Opus, high | the default for a chartered sub-goal |
| `lead-xhigh` | Opus, xhigh | the Director judges the goal hardest at charter time: coupled subsystems, a risky migration, an approach the charter can't settle |

The Director picks the tier at charter time by goal complexity. A lead never changes its own
tier; only the Director re-charters (D6).

A lead gets `Agent`, `Read`, `SendMessage`, and `Write`/`Edit` restricted by the guard to its own
plan directory. It gets no Bash, Grep or Glob. Letting it edit "when it wants to" would undo the
design:

- Claude Code requires a `Read` before an `Edit`. A lead that edits pulls source into its own
  context.
- A lead-made change skips the executor report, the scout tree audit and the class sweep. The
  lead would also judge its own work.
- The field ledger's dominant failure was grinding. A lead that can "just fix it" will do that
  instead of routing or escalating.
- "Never edits" is one guard rule. "Edits only small things" can't be enforced or audited.

A trivial fix costs one spawn. The Haiku mechanical rung (D8) makes that spawn take minutes and
cost cents.

**D2. The Director reads lead status when it chooses.** Every message that lands in the
Director's context is pollution, so leads never send periodic updates. Each lead overwrites one
small status file at every milestone (schema below). The Director reads it on its scheduled
check-in (D3) or when the user asks. The lead's return — done, checkpoint or escalation — is the
only message the Director receives.

**D3. Runaway safeguards: four layers, each covering what the one above can miss.**

| Layer | Mechanism | Catches | Misses |
|---|---|---|---|
| 1. Lead self-report | The lead's return triggers (below), including the D6 consumption caps | scope or done-criteria change, plan growth, rework over budget, double REVISE, disagreement, a rung it may not use | a lead that doesn't notice, or under-reports |
| 2. Segment budget clock | Guard: a segment starts at the lead's first dispatch and restarts each time the Director messages (resumes) the lead. It does not restart on `SubagentStart`, which also fires whenever a child's reply re-wakes the lead (WO-0 3a, 3c). The lead's `Agent` and `SendMessage` calls are denied once `leads.maxMinutes` or `leads.maxDispatches` is crossed, with an instruction to write status and return `STATUS: CHECKPOINT`. The same state file counts dispatches by agent type, which the lead can't write | runaway work. It also makes check-ins periodic: every segment ends in a short report. The counts catch an under-reporting lead (D6) | a lead hung inside one long child (no tool calls, so the clock never fires) |
| 3. `maxTurns` | Platform hard stop in the lead's frontmatter, set above what one segment needs so layer 2 fires first. The run is marked partial, with no report turn (WO-0 2a). The Director reads the status file and resumes the lead by agent id for its `CHECKPOINT` report; a resume gets a fresh count (2b) | a looping lead that somehow slips layer 2 | the hung-child case |
| 4. Director check-in | One recurring `CronCreate` task while any lead runs (default every 45 min). It fires while the Director waits on a background lead, and a fire that comes due during a busy turn runs once afterwards (WO-0 4a, 4b). The Director reads each running lead's status file, flags a `seq` that hasn't moved across two check-ins, and checks drift against the charter. It acts only on a problem (`TaskStop`, which also stops the lead's children, then resume with a question; or a scout on the lead's worktree) and deletes the task when no lead runs | hung leads, slow drift inside budget | a closed Director session (cron needs an open interactive session) |

The user remains the safeguard over the Director, as today. Layer 2 overruns by at most one
child's duration, because it fires at the lead's next dispatch.

**D4. Leads run their own cross-family reviews; the Director keeps an integration review.** A
lead batches review per charter (§4 REVIEW) and routes the lane by author vendor (§5). A lead
never arbitrates past a REVISE: when its reviewer and executor disagree, it returns
`ESCALATION`. A campaign with two or more leads ends with one Director review over the full
campaign diff. The reviewer gets the leads' verdicts and is pointed at the seams between them,
the "each fragment passed alone, the seams failed" failure that `ORCHESTRA.md` §3.5 names. A
single-lead campaign doesn't need it.

**D5. The guard enforces who may spawn whom.** An `Agent(type)` allowlist is ignored in subagent
definitions. Frontmatter hooks are skipped in untrusted folders. Settings-level hooks fire inside
subagents and carry `agent_type`, so `hooks/orchestra-guard.js` enforces what frontmatter cannot:
a lead's write scope and team (rule table below). Non-lead agents are kept from `Agent` by their own
frontmatter (guard trim, owner 2026-10-08). These are small invariants about facts a model cannot attest to itself, not a
control plane.

**D6. Sizing: cap what a charter consumes, not only what it plans (owner: 8 stays as a simple
hard cap).** Order count is a weak proxy on its own. Eight small orders that sail through can cost
less than one order that balloons into 1a–1d, each with its own REVISE rounds. The cap has three
parts.

1. **At charter time (Director): shape plus a hard ceiling.**
   - The charter is one cohesive sub-goal whose diff makes sense as one review.
   - The tier follows goal complexity (D1).
   - Hard ceiling: 8 chartered work orders (`WO-n` units of `skills/orchestra-plan`). A bigger
     goal becomes sequential charters.

2. **At run time (lead): two counters that measure consumption.** Both appear in the status file
   and in every report.
   - **Plan growth** = work orders planned now − work orders chartered. A split counts:
     WO-1 → 1a, 1b, 1c, 1d is +3. Growth above +2 is an `ESCALATION`. So is splitting a piece
     that was already split, because the order isn't understood yet.
   - **Rework** = every executor run on an order after its first, plus every re-review after a
     REVISE. That covers a fix round after REVISE, a bounce, and a retry after BLOCKED or
     PARTIAL. The budget defaults to half the chartered orders rounded up (minimum 2); the
     charter may set another number. Going over it is an `ESCALATION`.
   - The existing per-change rule still applies: two REVISE cycles on one change is an
     `ESCALATION`.
   - In the ballooning example, the split to 1a–1d trips growth (+3) before any sub-order runs.
     A smaller split (+1) whose pieces each take REVISE rounds trips the rework budget instead.

3. **Cross-check the lead can't forge (guard).** The clock's state file counts the lead's
   dispatches by agent type, per segment and over the lead's lifetime. At each checkpoint the
   Director compares the executor and reviewer counts with the lead's reported closed orders and
   rework. A gap is a question for the lead. The clock forces a checkpoint every segment, so a
   balloon can't run unseen for longer than one segment.

**On a growth or rework escalation, the Director chooses one:**
- amend the charter (scope or done-criteria);
- split the remaining work into a new charter;
- re-charter at `lead-xhigh` (a fresh lead given the old lead's status, ledger and branch);
- grant one extension, with the reason recorded in the ledger;
- ask the user.

Continuing silently is not an option.

**D7. Lead reports carry ASSUMPTIONS and CLARIFY (owner).** These guard against context lost at
each handoff:

- **ASSUMPTIONS:** what the lead assumed where the charter was silent.
- **CLARIFY:** non-blocking questions for the Director. A blocking question is an `ESCALATION`
  instead.

The charter carries the intent behind the goal (the why), as principal orders do.

**D8. The Haiku mechanical rung allows one strike (owner: agreed).** `executor-mechanical-haiku`
(Haiku 5.5 pinned, high effort) takes only fully spelled-out orders (conditions below). Any
BLOCKED, PARTIAL or REVISE sends the next round to `executor-mechanical` (Sonnet) with both
reports. It is never an escalation target and sits beside the §3.5 chain, like
`executor-bounded`. Its law is deliberately short: launcher field evidence
(`plans/orchestra-codex-issues.md` #11; `CHANGELOG.md` 1.10.0, "Prose fails") says long prose
fails on Haiku, so structure carries the weight.

**D9. Executor-spawned Haiku scouts are a deferred arm (WO-5).** They compose with leads at
depth 3 (Director → lead → executor → scout), but trialling them in the same build would make
the readout unattributable.

**D10. Agent teams are not used.** They are experimental and off by default. `/resume` doesn't
restore in-process teammates, teammates get no worktree isolation, and enabling teams turns named
subagents into teammates.

**D11. Fable runs only at the user's request (owner).** Fable reaches a session three ways
only, all user-initiated:

1. the user starts the Director on Fable;
2. the user names a Fable executor;
3. the user runs `/cross-compare-plan`. Its Claude architects (`architect-claude-xhigh` and
   `-max`, codex pack) are Fable by design, and the skill runs only when the user asks for it.
   This lane is unchanged.

Nothing else reaches Fable.

- The two Fable profiles are renamed `executor-fable` (high) and `executor-fable-xhigh`, and are
  USER REQUEST ONLY.
- The rule that let the Director substitute a Fable principal for an unavailable Astra rung is
  **retired (owner)**. D13 takes its place.
- No lead is Fable, and the Fable profiles are outside every lead's team.

**D12. 3.9.0 is branch-only (owner).** Implement on a trial branch (suggested
`trial/3.9.0-team-leads`). `main` stays on 3.8.0 until the trial readout passes, and there is no
PR to `main` before then. The 3.9.0 `CHANGELOG.md` entry opens with that line.

**D13. The Anthropic principal rung is Opus 5.5 at xhigh and max (owner: it scores close to Astra
on most coding tasks).** Both profiles keep the principal charter and duties unchanged:
goal-shaped orders, delegated decisions, class-wide fixes, and the exemption from the kind and
subsystem caps.

| Profile | Model | Effort | Use |
|---|---|---|---|
| `executor-principal` | `claude-opus-5-5` (pinned) | xhigh | principal-shaped orders at PLAN time, when the Astra rung is unavailable |
| `executor-principal-max` | `claude-opus-5-5` (pinned) | max | the hardest principal orders; the escalation target after a double bounce at `executor-heavy-xhigh` when Astra is unavailable |

Calls made here without an explicit owner ruling (veto before WO-1b):

- **Astra stays the default top rung** while the `codex` pack is installed and runnable. The
  Opus principal rung is the top whenever Astra is unavailable, and also when the user names it.
  The Director still says in one line that Astra did not run, but this is no longer a
  substitution of a user-only profile.
- **Escalation adds effort.** `executor-heavy-xhigh` is already Opus xhigh, so a double bounce
  there escalates to `executor-principal-max`, not to `executor-principal` (same model and
  effort).
- **The model is pinned** to `claude-opus-5-5`, because the case for this rung is about that
  model. The pin moves only by an explicit edit, not silently with the `opus` alias.
- **Naming.** `executor-principal` keeps its file name with new content. `executor-principal-max`
  is new. `executor-principal-xhigh` is retired, and the installer prunes it (WO-1b).
- **Review lane.** Opus-principal work is Claude-authored, so it goes to Sol review. Only
  escalation to Astra flips the lane to the Opus `reviewer`.

## Platform facts this plan relies on

Taken from current Claude Code docs (sub-agents, hooks, scheduled-tasks, tools-reference,
agent-teams) on 2026-10-08, then confirmed or corrected by WO-0 in the owner's environment
(Claude Code 2.1.294, Windows 11, first-party API; `plans/team-leads-probe-results.md`). Probe
ids are in parentheses.

- Subagents nest up to three layers below the main session by default
  (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; `1` turns nesting off). Director → lead → executor →
  scout fits exactly.
- **An `Agent` call that leaves `run_in_background` unset starts the child in the background**,
  from the main session and from subagents alike (3a, 3c). The parent's turn then ends, and each
  child's completion re-wakes it. Interactively, the parent still collects every result before
  its final handback. Headless, it does not, and background waits end after 10 minutes.
  **Leads are interactive only**, and they dispatch every child with `run_in_background: false`
  set explicitly. Several such `Agent` calls in one message run concurrently (3b).
- A subagent can resume a completed child with `SendMessage`. The call returns at once, and the
  child's reply arrives later by re-waking the subagent (3c). The main session can `TaskStop` a
  subagent, which interactively also stops its children within about 10 to 13 s (3b), and later
  resume it by agent id with its full history (3d).
- Settings hooks fire inside subagents. The input carries `agent_id`, plus `agent_type` equal to
  the frontmatter `name` (1a). On an `Agent` call it identifies the *calling* subagent (1c), and
  a settings hook can deny a subagent's spawn (1d). No event carries a parent-agent id (1f).
  A `SubagentStart` matcher can target one agent type (1b).
- `SubagentStart` fires on spawn, on resume (3d), and every time a child's completion or reply
  re-wakes the subagent (3a, 3c). `SubagentStop` does not fire on a `maxTurns` stop or a
  `TaskStop` kill (2a, 3b), so nothing in this plan hangs off it.
- `maxTurns` counts tool-calling turns: one per message, however long its children run (2a, 2c).
  At the cap the run is marked partial ("stopped at its N-turn limit … had produced no report"),
  with no report turn. A resume gets a fresh count (2b).
- `isolation: "worktree"` branches from the default branch, not from the parent's HEAD. Leads
  never use it for executors that must see the lead's commits.
- `CronCreate` tasks are session-scoped, have a 1-minute minimum interval, expire after 7 days,
  and are restored on `--resume` if unexpired. They fire only while the session is idle, and a
  session waiting on a background lead counts as idle (4a). A fire that comes due while busy runs
  once when the turn ends (4b). Observed fires landed up to about a minute after the scheduled
  minute.
- An MCP tool works at depth 2 when the agent's `tools:` names it (5a). `reviewer-codex` does.
- The concurrent-subagent cap is 20.
- The `haiku` alias resolves to Haiku 5.5 on the Anthropic API (6b; `claude-haiku-5-5` served as
  pinned, 6a) and, per the docs, to Haiku 4.5 on Bedrock, Vertex and Foundry (untested). Haiku 5.5
  bills $0.10/$0.50 per MTok up to 100K-token prompts and $0.50/$2.50 beyond.
- Subagent frontmatter accepts `model: claude-opus-5-5` with `effort: max`, and that model serves
  it (7a, 7b). The `/agents` wizard was removed in 2.1.294.

## Specs

### Guard rule table (WO-2, WO-3)

These rules are keyed on positive identification of an Orchestra agent type, independent of the
Director-model check. A genuine pause file stands all of them down, as today. Agent types the
harness doesn't ship are untouched.

| Caller `agent_type` | Tool | Rule |
|---|---|---|
| `lead`, `lead-xhigh` | `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | allow only `.md` files under `.claude/plans/leads/**`, with the plan carve-out's existing realpath/symlink/hardlink containment. Deny everything else |
| `lead`, `lead-xhigh` | `Bash`, `PowerShell`, `Grep`, `Glob` | no guard rule: absent from their `tools:` (guard trim, owner 2026-10-08) |
| `lead`, `lead-xhigh` | `Agent` | allow `subagent_type` ∈ LEAD_TEAM; deny a `model` override; deny unless `run_in_background` is exactly `false` (an unset flag backgrounds the child, WO-0 3a); deny once the segment budget is crossed (WO-3) |
| `lead`, `lead-xhigh` | `SendMessage` | allow; counted as a `resume` dispatch; deny once the segment budget is crossed (WO-3) |
| main session (no `agent_id`) | `SendMessage` to a lead's agent id | allow, unchanged; restarts that lead's segment (WO-3) |
| any Orchestra executor, `scout`, `detective`, `reviewer`, Codex launchers | `Agent` | no guard rule: their frontmatter disallows `Agent`, pinned by an exec-lane test (guard trim, owner 2026-10-08). WO-5 adds a guard rule opening `scout`-only for the heavy and principal executors |

LEAD_TEAM: `scout`, `detective`, `executor-mechanical-haiku`, `executor-mechanical`,
`executor-bounded`, `executor`, `executor-heavy`, `executor-heavy-xhigh`,
`executor-codex-principal`, `executor-principal`, `executor-principal-max`, `reviewer`,
`reviewer-codex`. Leads use the principal rungs under the same ladder rules as the Director
(D13).

Never on it:
- `lead` and `lead-xhigh`, so leads can't nest;
- `executor-fable` and `executor-fable-xhigh` (D11);
- the user-request-only Codex executors (`executor-codex-heavy`, `executor-codex-luna`);
- the planning lanes.

When a lead's order needs any of those, the lead returns `ESCALATION` and the Director decides.
`leadAllowedAgents` was built and then dropped in the guard trim (owner, 2026-10-08): no project
uses a specialist under a lead yet.

### Segment budget clock and dispatch counts (WO-3)

- **State.** One file per lead, `.claude/orchestra-leads/<agent_id>.json`:
  `{ "segmentStart": <epoch ms>, "segment": { "<agent type>": n }, "lifetime": { "<agent type>": n } }`.
  It is written with an atomic temp-and-rename and sits outside the lead's writable
  `.claude/plans/leads/`. The guard's existing `PreToolUse` entry (empty matcher, every tool)
  sees every call involved, so no new hook registration is needed.
- **Start.** On a lead's first counted call (`PreToolUse` `Agent` or `SendMessage` from
  `agent_type` `lead` or `lead-xhigh`) with no state file, create it with `segmentStart` = now.
  The clock therefore starts at the first dispatch, not at spawn. The lead's opening reads cost
  minutes at most.
- **Restart.** On a main-session `PreToolUse` `SendMessage` (no `agent_id`) whose target is an
  agent id with a state file, set `segmentStart` to now and clear `segment`. Keep `lifetime`. So
  each Director resume gets a fresh budget. `SubagentStart` is not used. It also fires each
  time a child's reply re-wakes the lead (WO-0 3a, 3c), so it can't tell a Director resume from
  a child wake.
- **Check.** On a lead's `Agent` call, increment `segment` and `lifetime` for the requested
  `subagent_type`. On a lead's `SendMessage`, increment them under `resume`, because a resumed
  executor is rework (D6) that never passes through `Agent`. If minutes since `segmentStart`
  exceed `leads.maxMinutes` (default 120), or the segment total exceeds `leads.maxDispatches`
  (default 20), deny with:
  `Orchestra: lead budget crossed (<which>). Write your status file and return STATUS: CHECKPOINT now.`
- **Director reads.** At each checkpoint the Director reads this file (an artifact its agent
  points to; the lead's report names its `agent_id`) and compares `lifetime` with the lead's
  reported closed orders and rework (D6.3).
- **Failure modes.**
  - Unreadable or missing state fails open; layers 3 and 4 still hold.
  - Parallel dispatches may race and undercount. It is a tripwire, not an accountant.
  - A Director that resumes a lead by name instead of agent id doesn't restart the clock. The
    lead trips on its next dispatch and returns `CHECKPOINT` at once, which is visible and safe.
    The Director law says to resume leads by their `AGENT ID`.

### Lead charter (Director → lead; added to `skills/orchestra-plan`)

```
LEAD CHARTER: <lead name>
Lead tier:        lead | lead-xhigh — <why this tier>
Goal:             <one paragraph>
Intent:           <why this matters; what a good trade-off looks like>
Done-criteria:    - [ ] <observable criterion> ...
Scope:            <paths/globs the sub-campaign may touch>
Must not change:  <files, contracts, behaviors>
Branch:           <lead branch> in worktree <path> (created by the Director's setup order)
Context:          <pasted findings, decisions, constraints — leads share no memory>
Chartered orders: <n> (hard cap 8) — <one line per planned WO>
Rework budget:    <n> (default: half of chartered orders rounded up, minimum 2)
Delegated:        <decisions the lead may make, with bounds — or none>
Extra triggers:   <charter-specific return triggers — or none>
Status file:      .claude/plans/leads/<name>/status.md
Ledger:           .claude/plans/leads/<name>/ledger.md
```

### Status file (lead overwrites at every milestone; Director reads)

```
lead: <name> · tier: high | xhigh · seq: <n, +1 per write> · state: RUNNING | CHECKPOINT | ESCALATION | DONE
orders: closed <c> / planned <p> (chartered <n>, growth <p−n> of +2) · in flight: <WO-id → agent | none>
rework: <r> of <budget> · reviews: <verdicts so far, e.g. 2 APPROVE / 1 REVISE> · open findings: <n>
branch: <branch> @ <short sha, from the last executor report>
blockers: <none | one line>
next: <one line>
```

A milestone is: an order closed, a split, a rework round, a review verdict, or a checkpoint or
return. The lead has no clock (no Bash), so staleness comes from `seq` not moving across two
Director check-ins.

### Lead report format (its final message; ≤ ~25 lines; detail lives in its ledger)

```
STATUS: DONE | CHECKPOINT | ESCALATION | BLOCKED
TRIGGER: <budget clock | maxTurns | plan growth | second split | rework budget | double REVISE |
          scope change | done-criteria change | reviewer–executor disagreement |
          rung outside the team | needs the user | n/a>
AGENT ID: <this lead's agent_id, for the Director's dispatch-count check>
DONE-CRITERIA
- [x] / [ ] <each charter criterion> — <evidence: commit, verdict, check>
ORDERS: closed <c> / planned <p> (chartered <n>) · GROWTH <p−n> of +2 · REWORK <r> of <budget>
- <WO-id · rung · verdict · runs>, one per line
REVIEW: <lane · verdict · base..head | not yet>
BRANCH: <branch> @ <sha>
DECISIONS: <taken inside the charter's delegated bounds — or none>
ASSUMPTIONS: <what it assumed where the charter was silent — or none>
CLARIFY: <non-blocking questions for the Director — or none>
NEXT: <what a resume continues with — or none>
```

### Lead return triggers (layer 1)

The lead writes its status file and returns when:
- a done-criterion or the scope would have to change;
- plan growth would exceed +2, or a piece that was already split would be split again;
- rework would exceed its budget;
- one change takes two REVISE cycles;
- an order needs a rung outside its team;
- its reviewer and executor disagree;
- a merge or worktree conflict blocks it;
- anything needs the user;
- the budget clock denies a dispatch.

A `maxTurns` stop leaves the lead no turn to report (WO-0 2a). The Director reads its status
file and resumes it by agent id. The lead then reports `CHECKPOINT` with `TRIGGER: maxTurns`.

After `SendMessage` to a child, the lead does not report until that child's reply has arrived. The
reply comes back as a later wake, not as the call's result (WO-0 3c).

### `executor-mechanical-haiku` routing conditions (all required)

1. The order spells out the change itself: the exact files and the exact edit (a patch,
   before/after text, a rename map, a codemod command). Nothing is left to design or choose.
2. The order names checks that exercise the change and can observe whether it is right.
3. It touches one subsystem and is small enough to stay well under ~100K tokens of context.
   Rough guide: ≤10 files. Above that Haiku 5.5 bills 5×, and quality is unproven.
4. It is not an escalation, not a fix order carrying reviewer findings, and not a class sweep.

When any condition is in doubt, the order goes to `executor-mechanical`.

Its law is `executor-mechanical`'s, cut to the load-bearing rules: scope; blocked beats guessed
(strict, with only the forced-import exception); verify with a check that exercises the change;
never claim untested success; every claim carries its evidence (`executor-bounded` rule 6,
UNVERIFIED section); stop grinding; never end a turn with a process running; report format. It
drops heartbeat, budget and class-sweep rules, because orders that need them never reach it.

## Done-criteria

- [x] WO-0 probe results are recorded in `plans/team-leads-probe-results.md`, and every design
      assumption is confirmed or the plan amended before WO-1 starts (2026-10-08).
- [ ] On the 3.9.0 trial branch, the following ship:
  - `executor-mechanical-haiku`, `lead`, `lead-xhigh`;
  - `executor-principal` (Opus 5.5 xhigh) and `executor-principal-max` (Opus 5.5 max);
  - `executor-fable` and `executor-fable-xhigh`, user-request-only, with the Fable substitute
    rule gone;
  - the guard rules, the budget clock and the dispatch counts.

  All eight CI suites are green on the Windows matrix, and `node install.js --lint` is clean.
  `main` is untouched.
- [ ] `ORCHESTRA.md` gains a tight Leads section (~25 lines) without restating rules that already
      exist.
- [ ] The installed tree in a scratch project shows the new agents, with no new hook
      registration in `.claude/settings.json`. Uninstall removes all of it.
- [ ] The trial protocol below has been run, and the readout is recorded in
      `plans/team-leads-trial-readout.md`.

## Orders

### WO-0: Platform probes (owner-run, interactive) — DONE 2026-10-08
- **Result:** headless runs, with the interactive-only rows (3a, 3b, 3c, 4a, 4b, 7a) re-run by
  the owner. Everything held except two assumptions about background children and resume wakes.
  This plan is amended for those (see "WO-0 amendments").
- **Kind:** measurement
- **Scope:** a throwaway project with the current harness and `plans/team-leads-probe-kit/`
  installed per its README; no harness edits
- **Probes:** the kit's probes 1–7 cover:
  - identity, matcher scoping and deny on a subagent spawn;
  - `maxTurns` semantics;
  - background lead mechanics: completion wake, `TaskStop` reach, child resume, `SubagentStart`
    on resume;
  - cron while waiting;
  - MCP at depth 2;
  - the Haiku model actually served;
  - the pinned Opus 5.5 at `effort: max` accepted and served.
- **Acceptance:** `plans/team-leads-probe-results.md` is filled in from the kit's template. Every
  "no" names the design change it forces, and this plan is amended before WO-1.
- **Depends on:** none

### WO-1: Haiku mechanical rung
- **Kind:** new agent profile + protocol ripple
- **Scope:**
  - `agents/executor-mechanical-haiku.md` (new)
  - `install.js` (`AGENTS`)
  - `ORCHESTRA.md`: §2 company row and steering row `down (haiku)`; the §3.5 side-entry and
    one-strike sentence; the §8.3 effort pin
  - `README.md` (company table, steering)
  - every description or skill that enumerates the executor rungs: `executor`,
    `executor-mechanical`, `executor-bounded`, `executor-heavy`, `executor-heavy-xhigh`, the
    Codex launchers, `skills/orchestra-status`
  - `tests/exec-lane.test.js` (new doctrine section modelled on the §19 `executor-bounded` pins)
  - `CHANGELOG.md` (opens the 3.9.0 entry with the branch-only line); `VERSION` → 3.9.0
- **Constraints:** `executor-mechanical` is unchanged. The §3.5 escalation chain is unchanged.
- **Acceptance:**
  - The tests pin: name, `disallowedTools: Agent`, `model: claude-haiku-5-5`, `effort: high`,
    the four routing conditions in the description, the UNVERIFIED section, the one-strike rule,
    and that the rung is absent from the §3.5 chain.
  - The install suite sees the new agent installed and removed.
- **Verification:** TIER: full. Run all eight suites plus `node install.js --lint`.
- **Depends on:** WO-0 probe 6

### WO-1b: Anthropic principal rung on Opus 5.5; Fable user-only; substitute rule retired
- **Kind:** agent profiles + protocol + installer pruning
- **Scope:**
  - **Agents.**
    - `agents/executor-principal.md`: new content; `model: claude-opus-5-5`, `effort: xhigh`.
    - `agents/executor-principal-max.md`: new file; same law; `effort: max`.
    - `agents/executor-fable.md` and `agents/executor-fable-xhigh.md`: the old Fable principal
      profiles, renamed and USER REQUEST ONLY, with the substitute clause removed.
    - Delete `agents/executor-principal-xhigh.md`.
  - **Installer.** `install.js`: update `AGENTS`, and add `RETIRED_AGENTS` (starting with
    `executor-principal-xhigh.md`). Install, update and uninstall remove a retired file only when
    its frontmatter `name` matches the retired name and its description starts with
    `Orchestra`, so a user's own file of that name is never touched. This closes the
    leftover-file class from the 3.0 port's finding F6 for this rename.
  - **Protocol, `ORCHESTRA.md`.**
    - §2 company rows and footnote ‡.
    - The "When the Astra rung is unavailable" paragraph: the Opus principal rung replaces the
      Fable substitute.
    - The "Everything else on the bench is user request only" list.
    - §3.5: with Astra unavailable, the chain's top is `executor-heavy-xhigh` →
      `executor-principal-max`.
    - §8.1 and the §8.3 effort pins.
  - **Skills, README and pack.**
    - `skills/orchestra-plan/SKILL.md` (principal-order text), `skills/orchestra-status/SKILL.md`.
    - `README.md`.
    - `packs/codex/pack.json` notes and `packs/codex/README.md`: "the Director substitutes the
      Fable executor-principal" becomes the Opus principal rung.
    - The descriptions of `executor-heavy`, `executor-heavy-xhigh` and the Codex launchers,
      wherever they name the principal rung.
  - **Tests.**
    - `tests/exec-lane.test.js` §19. Today it pins `executor-principal(-xhigh)` as USER REQUEST
      ONLY. It now pins:
      - `executor-fable(-xhigh)` as USER REQUEST ONLY;
      - `executor-principal(-max)` as pinned `claude-opus-5-5` at xhigh/max, not user-only,
        and not claiming the default ladder's top while Astra is available;
      - no Fable-substitute clause anywhere in `ORCHESTRA.md`.
    - `tests/install.test.js`: the agent file list, plus a retired-agent prune case (pruned when
      it is ours, left alone when it isn't).
  - `CHANGELOG.md`.
- **Constraints:**
  - The principal charter and duties are unchanged.
  - Astra stays the default top rung while the `codex` pack runs.
  - No Fable executor is reachable by any routing rule.
  - The cross-compare architects stay Fable. That lane is user-invoked (D11), and WO-1b does not
    touch it.
- **Acceptance:**
  - A repository-wide grep finds no routing text that sends work to Fable, outside the
    user-invoked `/cross-compare-plan` lane.
  - An update install over a 3.8.0 project leaves no `executor-principal-xhigh.md` and keeps a
    user-authored one.
  - All suites are green.
- **Verification:** TIER: full
- **Depends on:** WO-1 (same protocol tables); WO-0 probe 7

### WO-2: Guard — company law for subagents
- **Kind:** hook behavior
- **Scope:** `hooks/orchestra-guard.js`, `tests/guard.test.js`, the README guard section
- **Constraints:**
  - Reuse the plan-file containment helpers; no new path logic.
  - Main-session (Director) behavior is byte-for-byte unchanged.
  - Agent types the harness doesn't ship are untouched.
  - Replace the stale comment at `hooks/orchestra-guard.js:1039` ("PreToolUse hooks only fire
    for the main session") with what the docs now say.
- **Acceptance:** guard tests cover every row of the rule table, for both lead types:
  - allowed and denied lead writes, including `.md`-only and symlink/hardlink escapes;
  - lead Bash/Grep/Glob denied (moved to frontmatter by the guard trim; pinned in exec-lane);
  - lead `Agent` allowlist hit and miss; lead → lead and lead → any Fable profile denied; model
    override denied; `run_in_background` unset or `true` denied, exactly `false` allowed;
  - `leadAllowedAgents` extending the list (dropped by the guard trim);
  - Orchestra executors' `Agent` denied (moved to frontmatter by the guard trim; pinned in exec-lane);
    non-Orchestra types untouched;
  - pause file standing everything down.
- **Verification:** TIER: full — the guard suite plus all others.
- **Depends on:** WO-0 probes 1c, 1d

### WO-3: Lead budget clock and dispatch counts
- **Kind:** hook behavior + installer registration
- **Scope:**
  - `hooks/orchestra-guard.js`: the lead `Agent`/`SendMessage` budget check, the counts, and the
    main-session `SendMessage` restart. There is no `SubagentStart` branch, and no `install.js`
    change, because the existing empty-matcher `PreToolUse` entry already sees every call.
  - `tests/guard.test.js`, the README
- **Constraints:**
  - State is only `.claude/orchestra-leads/<agent_id>.json`.
  - Fail open on any state error.
  - The `leads.maxMinutes` and `leads.maxDispatches` defaults are 120 and 20, read from
    `.claude/orchestra.json`.
  - Main-session decisions are unchanged. The only main-session effect is the restart on
    `SendMessage` to a lead.
  - First, capture one real main-session `SendMessage` hook input to pin the target field's name
    (the probe kit's logger didn't record `tool_input`). The test fixture uses that capture.
- **Acceptance:** tests cover:
  - creation on the first counted call; a main-session `SendMessage` to the lead restarting
    `segment` while keeping `lifetime`; a `SendMessage` to an unknown id changing nothing;
  - per-type counts, with a lead `SendMessage` counted as `resume`;
  - the minutes trip, the dispatch trip, the exact denial text, for both `Agent` and `SendMessage`;
  - corrupt state failing open;
  - two concurrent dispatches not crashing.
- **Verification:** TIER: full
- **Depends on:** WO-2; WO-0 probes 1c, 2b, 3a, 3c, 3d

### WO-4: The leads and the Director's side of them
- **Kind:** new agent profiles + protocol
- **Scope:**
  - `agents/lead.md` and `agents/lead-xhigh.md` (new, one law): frontmatter with
    `tools: Agent, Read, Write, Edit, SendMessage`, `model: opus`, `effort: high` / `xhigh`, and
    `maxTurns: 60`. WO-0 2a found one turn per tool-calling message. A 20-dispatch segment plus
    its status writes, reads and report fits well under 60, so the clock fires first. The law
    covers:
    - the status schema, report format, and return triggers including the D6 counters;
    - "never edits";
    - every `Agent` call sets `run_in_background: false`, with parallel work as several calls in
      one message;
    - no report while a resumed child's reply is outstanding.
  - `install.js` (`AGENTS`)
  - `ORCHESTRA.md`:
    - §2: company rows and a "Leads" paragraph covering when a sub-goal gets a lead (≥3 work
      orders, or its own review cycle), the tier choice, the charter, background launch, status
      pull, the `CronCreate` check-in, the dispatch-count cross-check, the Director's options on
      escalation, interactive-only, resuming a lead by its `AGENT ID`, and the `maxTurns`-stop
      resume (read status, resume for `CHECKPOINT`)
    - §4: the Director's loop with leads, plus integration and merge orders
    - §5: the integration-review rule for ≥2 leads
  - `skills/orchestra-plan/SKILL.md`: when to charter a lead, and the charter template
  - `skills/orchestra-status/SKILL.md`: list leads and point at their status files
  - `README.md`, `tests/exec-lane.test.js` (lead doctrine pins), `CHANGELOG.md`
- **Constraints:**
  - The new `ORCHESTRA.md` text is ≤ ~25 lines and cross-references the existing rules instead
    of restating them.
  - Flat direction stays the default below the lead threshold.
- **Acceptance:** the tests pin:
  - both leads' frontmatter (tool list excludes Bash/Grep/Glob, `opus`, the two efforts,
    `maxTurns: 60`);
  - the law's `run_in_background: false` and outstanding-reply clauses;
  - the report sections, including ASSUMPTIONS, CLARIFY, GROWTH and REWORK;
  - the status schema's `seq`;
  - the `ORCHESTRA.md` clauses: integration review, check-in, never edits, the threshold, the
    8-order cap.
- **Verification:** TIER: full
- **Depends on:** WO-1, WO-1b, WO-2, WO-3

### WO-5 (deferred until the leads readout): executor-spawned Haiku scouts
- **Kind:** profile + guard rule
- **Scope:**
  - drop `disallowedTools: Agent` from `executor-heavy`, `executor-heavy-xhigh`,
    `executor-principal` and `executor-principal-max` (the Fable profiles stay closed, D11)
  - a law clause: scouts only for files the executor will not edit and for searchable
    enumeration; scout output is pointers, not facts; a DELEGATED RECON report section
  - a guard row opening `Agent` → `scout` only, no model override
  - tests
- **Depends on:** the trial readout

## Sequencing

- Serial: WO-0 → WO-1 → WO-1b → WO-2 → WO-3 → WO-4. WO-1 and WO-1b both edit the protocol's
  company and steering tables, so they never run in parallel.
- Gate: WO-0 results must be in before any order is cut. A failed probe amends this plan first.
  Met 2026-10-08.

## Review checkpoints

- One batched cross-family review over WO-1, WO-1b, WO-2, WO-3 and WO-4 (commit-pinned base/head
  on the trial branch).
  Agent, skill, `ORCHESTRA.md` and hook changes are behavior, so this is a full-tier review.
- An earlier checkpoint after WO-2/WO-3 only if WO-4's text ends up depending on guard behavior
  that changed under review.

## Trial protocol (frozen build; nothing is edited during the trial)

**Leads arm vs. flat control**, on matched campaigns. Each campaign has at least 2 sub-goals that
would each get a lead. Use at least 3 campaigns per arm, or replay one past campaign in both
arms.

| Measure | Source | Pass |
|---|---|---|
| Director orchestration actions per campaign | Director transcript (Agent/SendMessage calls) | ≥30% fewer than control (the 3.0 oracle's bar) |
| Director context at final REPORT | transcript usage | ≥40% smaller than control |
| Cost per accepted change | billing (Anthropic + Codex), not ledger proxies | no worse than +10% |
| Wall-clock INTAKE → REPORT | ledger | no worse than +10% |
| REVISE rate; integration-review findings at seams; escapes | verdicts, later bugs | REVISE no worse than +10%; seam findings recorded either way |
| Runaway incidents, and which layer caught each | ledger notes | every incident caught by layers 1–4; zero lead edits; zero guard bypasses |
| Cap triggers (growth, rework, second split) and the Director's call on each | lead reports, ledger | recorded. At readout, judge whether each trigger fired on a real balloon and whether the call helped, then tune the +2 / half-of-orders defaults |
| Lead self-report vs. guard dispatch counts | status files, state files | gaps recorded; any unexplained gap is a finding |

**Haiku arm:** at least 15 orders that meet the four conditions, compared with
`executor-mechanical` on the same order class.

| Measure | Pass | Kill (stop the arm early) |
|---|---|---|
| First-round DONE rate | within 10 points of Sonnet's | — |
| Scout-audit mismatches (CHANGES vs `git status`) | zero | any out-of-scope edit |
| False claims stated as fact that reach review | zero | two |
| Wall-clock and cost per accepted order | recorded | — |

**Principal rung (D13), observed rather than gated.** This is a doctrine change, not a trial
arm. Log every Opus principal run (xhigh or max): its order shape, review rounds to APPROVE, and
wall-clock. Compare them at readout with the Astra rows in the field ledger. Revisit the
Astra-first default if Opus matches or beats it on comparable orders.

## Risks

- **Platform drift.** WO-0 measured Claude Code 2.1.294. The lead rules lean on two
  undocumented behaviors: an unset `run_in_background` backgrounds the child, and a reply
  re-wakes the parent. Re-run the probe kit after any Claude Code update that touches subagents.
  Both rules fail safe: the guard denies, or the lead checkpoints early.
- **Context lost at each handoff.** Charter intent, plus the ASSUMPTIONS/CLARIFY sections; the
  owner watches for it in the trial.
- **Parallel leads collide.** The Director gives parallel leads disjoint scopes and separate
  branches, merges them in charter order, and a conflict comes back BLOCKED. At most 3
  concurrent leads, which also stays well inside the 20-subagent cap.
- **Codex allowance burns faster** when leads review in parallel. The runner already isolates
  concurrent reviews (`packs/codex/hooks/orchestra-review.js:1686`). Watch the pool readings.
- **Interactive only.** Headless runs drop background work after 10 minutes, and cron needs an
  open session. The protocol says so; leads are not for `-p` runs.
- **Complexity creep, the 3.0 lesson.** The new code is the guard rules plus one state file per
  lead. Budget: ≤ ~300 lines of guard code, including the clock and counts. No ledger machinery,
  no new state machine, and no edits during the trial.
- **Haiku prose-following.** Short law, structural checks (scout audit, review), one strike.

## Open questions for the owner

None blocking. D13 lists the calls made without an explicit ruling (Astra stays the default top,
escalation from `executor-heavy-xhigh` goes to `executor-principal-max`, the model pin, and
naming). Veto any of them before WO-1b.
## WO-0 amendments (2026-10-08)

The probes confirmed everything except two assumptions. The plan is amended as follows:

- **Background children and wakes (3a, 3c).** An unset `run_in_background` backgrounds the child.
  The parent's turn then ends, and every child completion or `SendMessage` reply re-wakes it with
  a fresh `SubagentStart`.
  - Leads must set `run_in_background: false` on every `Agent` call, and the guard enforces it
    (rule table).
  - The budget clock restarts only on a Director `SendMessage` to the lead, never on
    `SubagentStart`. It needs no new hook registration (budget clock spec, WO-3).
- **`SendMessage` replies are asynchronous (3c).** A lead doesn't report while a reply is
  outstanding (return triggers, WO-4 law). A lead's `SendMessage` counts as a `resume` dispatch.
- **`maxTurns` stops leave no report (2a)**, and `SubagentStop` doesn't fire on a `maxTurns` stop
  or a `TaskStop` kill (2a, 3b). `maxTurns: 60` sits above one segment's need. The Director
  resumes a stopped lead by agent id for its report (D3 layer 3, WO-4).
- **Confirmed and now relied on:** `TaskStop` stops a lead's children (3b), cron fires while the
  Director waits (4a/4b), and there is no parent-agent id (1f), so counts key on the caller.

## Resolved (owner, 2026-10-08)

- Leads: Opus high and Opus xhigh only, picked by the Director by goal complexity. Never Fable.
- Fable: user request only (the Director model the user starts with, or a Fable profile the user
  names). The Fable substitute for an unavailable Astra rung is retired.
- `/cross-compare-plan` keeps its Fable architects. It runs only when the user invokes it, so it
  counts as user-requested.
- The Anthropic principal rung is Opus 5.5 at xhigh and max.
- The 8-work-order cap stays as a hard ceiling. D6's consumption counters do the real capping.
- Haiku mechanical rung: details as specified.
- Budget defaults stand for the trial: 120 min / 20 dispatches per lead segment, and a 45-min
  Director check-in.
- 3.9.0 is branch-only.
- WO-0 amendments approved: the clock restarts on a Director `SendMessage`, not on
  `SubagentStart`; leads get `maxTurns: 60`; and the guard enforces `run_in_background: false`
  on lead spawns.
- Guard trim approved (after review round 3): the guard rules only on leads. Rules frontmatter
  already enforces (non-leads never spawn; leads have no Bash/Grep/Glob) and `leadAllowedAgents`
  are removed, taking the guard's additions from 308 to ~190 lines.
