# Plan: team leads, a Haiku mechanical rung, and the company law behind them (3.9.0 trial)

Date: 2026-10-08 · Status: DRAFT — owner sign-off needed before EXECUTE

## Goal

Let the Director take a basic plan with clear goals and run it to completion over a much longer
horizon, without its own context filling up with every executor report, scout audit and review
verdict. The Director hands each large sub-goal to a **lead**. A lead runs on the heavy-tier
model and acts as a mini-director for that sub-goal: it plans the work orders, routes executors,
runs scouts and cross-family reviews, and drives fix rounds. It reports back in a few lines. The
Director keeps the end goal and spends its context on goal drift, runaway work, integration, and
the user.

Two smaller pieces ride along:

- a **Haiku 5.5 mechanical executor** (`executor-mechanical-haiku`), trialled beside the Sonnet
  mechanical rung for fully spelled-out orders;
- **guard-enforced company law for subagents**: who may spawn whom, what a lead may write, and a
  budget clock that forces leads to check in.

## Decisions (design discussion, 2026-10-07/08)

**D1. Leads coordinate; they never edit code.** A lead gets `Agent`, `Read`, `SendMessage`, and
`Write`/`Edit` restricted by the guard to its own plan directory (`.claude/plans/leads/<name>/`).
It gets no Bash, Grep or Glob. Letting it edit "when it wants to" would undo the design:

- Claude Code requires a `Read` before an `Edit`. A lead that edits pulls source files into its
  own context, which is the pollution this trial removes.
- A lead-made change skips the executor report, the scout tree audit and the class sweep. The
  lead would also judge its own work.
- The field ledger's dominant failure was grinding. A lead that can "just fix it" will do that
  instead of routing or escalating.
- "Never edits" is one guard rule. "Edits only small things" cannot be enforced or audited.

The cost is one spawn per trivial fix. The Haiku mechanical rung (D8) makes that spawn take
minutes and cost cents.

**D2. The Director reads lead status when it chooses.** Every message that lands in the
Director's context is pollution, so leads never send periodic updates. Each lead overwrites one
small status file at every milestone (schema below). The Director reads it on its scheduled
check-in (D3) or when the user asks. The lead's return — done, checkpoint or escalation — is the
only message the Director receives.

**D3. Runaway safeguards: four layers, each covering what the one above can miss.**

| Layer | Mechanism | Catches | Misses |
|---|---|---|---|
| 1. Lead self-report | Return triggers in the lead's law (below) | scope or done-criteria change, double REVISE, disagreement, a rung it may not use | a lead that doesn't notice its own drift |
| 2. Segment budget clock | Guard: a `SubagentStart` hook records when a lead starts or resumes. The lead's `Agent` calls are denied once `leads.maxMinutes` or `leads.maxDispatches` is crossed, with an instruction to write status and return `STATUS: CHECKPOINT` | runaway work. It also turns the clock into the periodic mini-report: a lead must check in every segment | a lead hung inside one long child (no tool calls, so the clock never fires) |
| 3. `maxTurns` | Platform hard stop in the lead's frontmatter. The run is marked partial and can be resumed | a looping lead that somehow slips layer 2 | the same hung-child case |
| 4. Director check-in | One recurring `CronCreate` task while any lead runs (default every 45 min). The Director reads each running lead's status file, flags a `seq` that hasn't moved across two check-ins, and checks drift against the charter. It acts only on a problem (`TaskStop`, then resume with a question, or a scout on the lead's worktree) and deletes the task when no lead runs | hung leads, slow drift inside budget | a Director session that is closed (cron needs an open interactive session) |

The user remains the safeguard over the Director, as today. Layer 2 overruns by at most one
child's duration, because it fires at the lead's next dispatch.

**D4. Leads run their own cross-family reviews; the Director keeps an integration review.** A
lead batches review per charter (§4 REVIEW) and routes the lane by author vendor (§5). A lead
never arbitrates past a REVISE: when its reviewer and executor disagree, it returns
`ESCALATION`. A campaign with two or more leads ends with one Director review over the full
campaign diff. The reviewer gets the leads' verdicts and is pointed at the seams between them,
the "each fragment passed alone, the seams failed" failure that `ORCHESTRA.md` §3.5 already
names. A single-lead campaign doesn't need it.

**D5. The guard enforces who may spawn whom.** An `Agent(type)` allowlist is ignored in subagent
definitions. Frontmatter hooks are skipped in untrusted folders. Settings-level hooks do fire
inside subagents and carry `agent_type`. So `hooks/orchestra-guard.js` is the enforcement point
(rule table below). These are small invariants about facts a model cannot attest to itself, not
a control plane.

**D6. Sizing: one lead charter is one review batch.** Here "orders" means work orders: the
`WO-n` units of `skills/orchestra-plan` (about one executor run of ≤80 tool calls, plus one
review round). A charter should be one cohesive sub-goal whose diff gets one batched review. The
soft cap is about 8 work orders. Past that the review diff and the lead's context both get
large, so the Director splits the goal into sequential leads. The 8 is a starting guess, to be
calibrated in the trial.

**D7. Lead reports carry ASSUMPTIONS and CLARIFY.** These guard against context lost at each
handoff:

- **ASSUMPTIONS:** what the lead assumed where the charter was silent.
- **CLARIFY:** non-blocking questions for the Director. A blocking question is an `ESCALATION`
  instead.

The charter carries the intent behind the goal (the why), as principal orders do.

**D8. The Haiku mechanical rung allows one strike.** `executor-mechanical-haiku` (Haiku 5.5
pinned, high effort) takes only fully spelled-out orders (conditions below). Any BLOCKED,
PARTIAL or REVISE sends the next round to `executor-mechanical` (Sonnet) with both reports. It
is never an escalation target and sits beside the §3.5 chain, like `executor-bounded`. Its law
is deliberately short: launcher field evidence (`plans/orchestra-codex-issues.md` #11,
`CHANGELOG.md` 1.10.0, "Prose fails") says long prose fails on Haiku, so structure carries the
weight.

**D9. Executor-spawned Haiku scouts are a deferred arm (WO-5).** They compose with leads at
depth 3 (Director → lead → executor → scout), but trialling them in the same build would make
the readout unattributable. Build them after the leads readout.

**D10. Agent teams are not used.** They are experimental and off by default. `/resume` doesn't
restore in-process teammates, teammates get no worktree isolation, and enabling teams turns
named subagents into teammates. Revisit once teams are GA.

## Platform facts this plan relies on

Taken from current Claude Code docs (sub-agents, hooks, scheduled-tasks, tools-reference,
agent-teams) on 2026-10-08. Quotes came through a fetch tool, so WO-0 confirms every row that
matters in the owner's real environment.

- Subagents nest up to three layers below the main session by default
  (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; `1` turns nesting off). Director → lead → executor →
  scout fits exactly.
- A subagent can resume a completed child with `SendMessage`; the child reports back to that
  subagent. The main session can `TaskStop` a subagent and later resume it with its full
  history.
- Settings hooks fire inside subagents. The input carries `agent_id`, plus `agent_type` equal to
  the frontmatter `name`. `SubagentStart` fires on both spawn and resume.
- In interactive sessions, a subagent waits for its background children before finishing. In
  headless runs it does not, and background waits end after 10 minutes. **Leads are interactive
  only**, and they dispatch their children in the foreground (several `Agent` calls in one
  message for parallel work).
- `isolation: "worktree"` branches from the default branch, not from the parent's HEAD. Leads
  never use it for executors that must see the lead's commits.
- `CronCreate` tasks are session-scoped, have a 1-minute minimum interval, fire only while the
  session is idle (a fire that comes due while busy waits for the turn to end), expire after 7
  days, and are restored on `--resume` if unexpired.
- The concurrent-subagent cap is 20. With three leads each fanning out, that is the ceiling to
  respect.
- The `haiku` alias resolves to Haiku 5.5 on the Anthropic API and to Haiku 4.5 on Bedrock,
  Vertex and Foundry. Haiku 5.5 bills $0.10/$0.50 per MTok up to 100K-token prompts and
  $0.50/$2.50 beyond.

Not documented, so WO-0 probes them:
- whether a session waiting on background subagents counts as idle for cron;
- what `maxTurns` counts and whether it resets on resume;
- whether `TaskStop` on a lead also stops its children;
- whether the `Agent` call's `PreToolUse` input carries the *calling* subagent's `agent_type`;
- MCP access at depth 2;
- whether a `SubagentStart` matcher can target one agent type.

## Specs

### Guard rule table (WO-2, WO-3)

These rules are keyed on positive identification of an Orchestra agent type, independent of the
Director-model check. A genuine pause file stands all of them down, as today. Agent types the
harness doesn't ship are untouched.

| Caller `agent_type` | Tool | Rule |
|---|---|---|
| `lead` | `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | allow only `.md` files under `.claude/plans/leads/**`, with the plan carve-out's existing realpath/symlink/hardlink containment. Deny everything else |
| `lead` | `Bash`, `PowerShell`, `Grep`, `Glob` | deny (also absent from its `tools:`, so this is belt and braces) |
| `lead` | `Agent` | allow `subagent_type` ∈ LEAD_TEAM ∪ `leadAllowedAgents`; deny a `model` override; deny once the segment budget is crossed (WO-3) |
| any Orchestra executor, `scout`, `detective`, `reviewer`, Codex launchers | `Agent` | deny (WO-5 later opens `scout`-only for the heavy and principal executors) |

LEAD_TEAM: `scout`, `detective`, `executor-mechanical-haiku`, `executor-mechanical`,
`executor-bounded`, `executor`, `executor-heavy`, `executor-heavy-xhigh`, `reviewer`,
`reviewer-codex`, `executor-codex-principal`.

Never on it: `lead`, so leads can't nest. Also excluded are the user-request-only profiles
(`executor-principal`, `executor-principal-xhigh`, `executor-codex-heavy`,
`executor-codex-luna`) and the planning lanes. When a lead needs one of those, including the
Fable substitute for a missing Astra rung, it returns `ESCALATION` and the Director decides.
`leadAllowedAgents` in `.claude/orchestra.json` adds project specialists.

### Segment budget clock (WO-3)

- **Start.** On `SubagentStart` with `agent_type` `lead`, write
  `{ "segmentStart": <epoch ms>, "dispatches": 0 }` to `.claude/orchestra-leads/<agent_id>.json`
  (atomic temp-and-rename). Resume fires `SubagentStart` again, so each resumed segment gets a
  fresh budget.
- **Check.** On a `lead`'s `PreToolUse` `Agent` call, increment `dispatches`. If minutes since
  `segmentStart` exceed `leads.maxMinutes` (default 120) or `dispatches` exceed
  `leads.maxDispatches` (default 20), deny with:
  `Orchestra: lead budget crossed (<which>). Write your status file and return STATUS: CHECKPOINT now.`
- **Failure modes.**
  - Unreadable or missing state fails open; layers 3 and 4 still hold.
  - Parallel dispatches may race and undercount. It is a tripwire, not an accountant.
- **Scope.** No other state, no ledger, nothing for the Director to keep in sync. The directory
  sits outside `.claude/plans/leads/`, so a lead cannot write it.

### Lead charter (Director → lead; added to `skills/orchestra-plan`)

```
LEAD CHARTER: <lead name>
Goal:            <one paragraph>
Intent:          <why this matters; what a good trade-off looks like>
Done-criteria:   - [ ] <observable criterion> ...
Scope:           <paths/globs the sub-campaign may touch>
Must not change: <files, contracts, behaviors>
Branch:          <lead branch> in worktree <path> (created by the Director's setup order)
Context:         <pasted findings, decisions, constraints — leads share no memory>
Size:            <planned work orders, soft cap ~8>
Delegated:       <decisions the lead may make, with bounds — or none>
Extra triggers:  <charter-specific return triggers — or none>
Status file:     .claude/plans/leads/<name>/status.md
Ledger:          .claude/plans/leads/<name>/ledger.md
```

### Status file (lead overwrites at every milestone; Director reads)

```
lead: <name> · seq: <n, +1 per write> · state: RUNNING | CHECKPOINT | ESCALATION | DONE
orders: <done>/<planned> · in flight: <WO-id → agent | none>
reviews: <verdicts so far, e.g. 2 APPROVE / 1 REVISE> · open findings: <n>
branch: <branch> @ <short sha, from the last executor report>
blockers: <none | one line>
next: <one line>
```

A milestone is: an order closed, a review verdict received, or a checkpoint or return. The lead
has no clock (no Bash), so staleness comes from `seq` not moving across two Director check-ins.

### Lead report format (its final message; ≤ ~25 lines; detail lives in its ledger)

```
STATUS: DONE | CHECKPOINT | ESCALATION | BLOCKED
TRIGGER: <budget clock | maxTurns | scope change | done-criteria change | double REVISE |
          reviewer–executor disagreement | rung outside LEAD_TEAM needed | needs the user | n/a>
DONE-CRITERIA
- [x] / [ ] <each charter criterion> — <evidence: commit, verdict, check>
ORDERS: <done>/<planned> — <WO-id · rung · verdict · rounds>, one per line
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
- one change takes two REVISE cycles;
- an order needs a rung outside LEAD_TEAM;
- its reviewer and executor disagree;
- a merge or worktree conflict blocks it;
- anything needs the user;
- the budget clock or `maxTurns` stops it.

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

- [ ] WO-0 probe results recorded, and every design assumption confirmed or the plan amended
      before WO-1 starts.
- [ ] `executor-mechanical-haiku`, `lead`, the guard rules and the budget clock ship as 3.9.0 on
      the trial branch. All eight CI suites are green on the Windows matrix.
      `node install.js --lint` is clean.
- [ ] `ORCHESTRA.md` gains a tight Leads section (~25 lines) without restating rules that
      already exist.
- [ ] The installed tree in a scratch project shows the new agents. The `SubagentStart`
      registration is in `.claude/settings.json`. Uninstall removes all of it.
- [ ] The trial protocol below has been run, and the readout is recorded in
      `plans/team-leads-trial-readout.md`.

## Orders

### WO-0: Platform probes (owner-run, interactive)
- **Kind:** measurement
- **Scope:** a scratch project with this branch installed; no harness edits
- **Probes:**
  1. A logging `PreToolUse` and `SubagentStart` hook. Spawn Director → test lead → executor →
     scout. Record `agent_type`/`agent_id` on each level's tool calls, including the `Agent`
     call's caller identity, `tool_input.subagent_type` and `tool_input.model`. Check whether a
     `SubagentStart` matcher can target `lead`.
  2. `maxTurns: 5` on a test agent. What counts as a turn? Does a long foreground child count
     as one turn? What does the parent receive at the cap? Does a resume reset the count?
  3. A background lead with foreground parallel children:
     - Does the Director wake on its completion notification?
     - Does `TaskStop` on the lead stop its children?
     - Can the lead `SendMessage`-resume its own child?
  4. `CronCreate` every 2 min while the Director waits on a background lead. Does it fire?
  5. `reviewer-codex` spawned by the test lead (depth 2) calls `orchestra_review` successfully.
  6. `model: claude-haiku-5-5` is served as Haiku 5.5 (check the transcript's model field).
- **Acceptance:** `plans/team-leads-probe-results.md` lists each probe with the observed
  behavior. Every "no" names the design change it forces.
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
  - `CHANGELOG.md` (opens the 3.9.0 trial entry); `VERSION` → 3.9.0
- **Constraints:** `executor-mechanical` is unchanged. The §3.5 escalation chain is unchanged.
- **Acceptance:**
  - The tests pin: name, `disallowedTools: Agent`, `model: claude-haiku-5-5`, `effort: high`,
    the four routing conditions in the description, the UNVERIFIED section, the one-strike
    rule, and that the rung is absent from the §3.5 chain.
  - The install suite sees the new agent installed and removed.
- **Verification:** TIER: full. Run all eight suites plus `node install.js --lint`.
- **Depends on:** WO-0 probe 6

### WO-2: Guard — company law for subagents
- **Kind:** hook behavior
- **Scope:** `hooks/orchestra-guard.js`, `tests/guard.test.js`, the README guard section
- **Constraints:**
  - Reuse the plan-file containment helpers; no new path logic.
  - Main-session (Director) behavior is byte-for-byte unchanged.
  - Agent types the harness doesn't ship are untouched.
  - Replace the stale comment at `hooks/orchestra-guard.js:1039` ("PreToolUse hooks only fire
    for the main session") with what the docs now say.
- **Acceptance:** guard tests cover every row of the rule table:
  - allowed and denied lead writes, including `.md`-only and symlink/hardlink escapes;
  - lead Bash/Grep/Glob denied;
  - lead `Agent` allowlist hit and miss; `lead` → `lead` denied; model override denied;
  - `leadAllowedAgents` extending the list;
  - Orchestra executors' `Agent` denied; non-Orchestra types untouched;
  - pause file standing everything down.
- **Verification:** TIER: full — the guard suite plus all others.
- **Depends on:** WO-0 probe 1 (caller identity on `Agent` calls)

### WO-3: Lead budget clock
- **Kind:** hook behavior + installer registration
- **Scope:**
  - `hooks/orchestra-guard.js` (a `SubagentStart` branch and the lead `Agent` budget check)
  - `install.js` (register and unregister the `SubagentStart` entry, alongside the existing
    `PreToolUse` merge)
  - `tests/guard.test.js`, `tests/install.test.js`, the README
- **Constraints:**
  - State is only `.claude/orchestra-leads/<agent_id>.json`.
  - Fail open on any state error.
  - The `leads.maxMinutes` and `leads.maxDispatches` defaults are 120 and 20, read from
    `.claude/orchestra.json`.
- **Acceptance:** tests cover:
  - start, resume reset, the minutes trip, the dispatch trip, the exact denial text;
  - corrupt state failing open;
  - two concurrent dispatches not crashing;
  - install registering the entry, re-install staying idempotent, uninstall removing it while
    preserving user hooks.
- **Verification:** TIER: full
- **Depends on:** WO-2; WO-0 probes 1–2

### WO-4: The lead role and the Director's side of it
- **Kind:** new agent profile + protocol
- **Scope:**
  - `agents/lead.md` (new): frontmatter with `tools: Agent, Read, Write, Edit, SendMessage`,
    `model: opus`, `effort: high`, `maxTurns` from WO-0; law; report format; status schema;
    triggers
  - `install.js` (`AGENTS`)
  - `ORCHESTRA.md`:
    - §2: a company row and a "Leads" paragraph covering when a sub-goal gets a lead (≥3 work
      orders, or its own review cycle), the charter, background launch, status pull, the
      `CronCreate` check-in, the return triggers, and that leads never edit
    - §4: the Director's loop with leads, plus integration and merge orders
    - §5: the integration-review rule for ≥2 leads
  - `skills/orchestra-plan/SKILL.md`: when to charter a lead, and the charter template
  - `skills/orchestra-status/SKILL.md`: list leads and point at their status files
  - `README.md`, `tests/exec-lane.test.js` (lead doctrine pins), `CHANGELOG.md`
- **Constraints:**
  - The new `ORCHESTRA.md` text is ≤ ~25 lines and cross-references the existing rules
    instead of restating them.
  - Flat direction stays the default for anything below the lead threshold.
  - Leads are documented as interactive-only.
- **Acceptance:** the tests pin:
  - the lead's frontmatter (tool list excludes Bash/Grep/Glob, `opus`, `high`, `maxTurns`
    present);
  - the report sections, including ASSUMPTIONS and CLARIFY;
  - the status schema's `seq`;
  - the `ORCHESTRA.md` clauses: integration review, check-in, never edits, the threshold.
- **Verification:** TIER: full
- **Depends on:** WO-1, WO-2, WO-3

### WO-5 (deferred until the leads readout): executor-spawned Haiku scouts
- **Kind:** profile + guard rule
- **Scope:**
  - drop `disallowedTools: Agent` from `executor-heavy`, `executor-heavy-xhigh`,
    `executor-principal`, `executor-principal-xhigh`
  - a law clause in each: scouts only for files the executor will not edit and for searchable
    enumeration; scout output is pointers, not facts; a DELEGATED RECON report section
  - a guard row opening `Agent` → `scout` only, no model override
  - tests
- **Depends on:** the trial readout

## Sequencing

- Serial: WO-0 → WO-1 → WO-2 → WO-3 → WO-4. WO-1 and WO-2 touch disjoint files and could run in
  parallel worktrees, but WO-1 is small. Serial keeps the review batch simple.
- Gate: WO-0 must come back before any order is cut. A failed probe amends this plan first.

## Review checkpoints

- One batched cross-family review over WO-1..WO-4 (commit-pinned base/head). Agent, skill,
  `ORCHESTRA.md` and hook changes are behavior, so this is a full-tier review.
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

**Haiku arm:** at least 15 orders that meet the four conditions, compared with
`executor-mechanical` on the same order class.

| Measure | Pass | Kill (stop the arm early) |
|---|---|---|
| First-round DONE rate | within 10 points of Sonnet's | — |
| Scout-audit mismatches (CHANGES vs `git status`) | zero | any out-of-scope edit |
| False claims stated as fact that reach review | zero | two |
| Wall-clock and cost per accepted order | recorded | — |

## Risks

- **The probes may disagree with the docs.** WO-0 runs first, and the plan is amended before
  any build.
- **Context lost at each handoff.** Charter intent, plus the ASSUMPTIONS/CLARIFY sections; the
  owner watches for it in the trial.
- **Parallel leads collide.** The Director gives parallel leads disjoint scopes and separate
  branches, merges them in charter order, and a conflict comes back BLOCKED. At most 3
  concurrent leads, which also stays well inside the 20-subagent cap.
- **Codex allowance burns faster** when leads review in parallel. The runner already isolates
  concurrent reviews (`packs/codex/hooks/orchestra-review.js:1686`). Watch the pool readings.
- **Interactive only.** Headless runs drop background work after 10 minutes, and cron needs an
  open session. The protocol says so; leads are not for `-p` runs.
- **Complexity creep, the 3.0 lesson.** The new code is the guard rules plus one state file.
  Budget: ≤ ~250 lines of guard code, including the clock. No ledger machinery, no new state
  machine, and no edits during the trial.
- **Haiku prose-following.** Short law, structural checks (scout audit, review), one strike.

## Open questions for the owner

1. Lead model: Opus high only (recommended), or also a Fable lead variant reached only on user
   request?
2. Should 3.9.0 stay branch-only until its trial passes? The 3.8.0 entry said branch-only, but
   PR #48 merged it to `main`.
3. Budget defaults: 120 min / 20 dispatches per segment, and a check-in every 45 min. Accept, or
   tune?
