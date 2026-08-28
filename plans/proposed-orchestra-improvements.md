# Proposed Orchestra improvements — deferred backlog

**Status:** proposed, not scheduled. Written 2026-08-28.
**Provenance:** findings from a comparative investigation of `mini-swe-agent`
(https://github.com/SWE-agent/mini-swe-agent) against this harness, plus a root-cause
investigation into an orphaned Codex run during the 2026-08-27 `/cross-compare-plan` session.
Both investigations were read-only; every `path:line` below was verified against the tree at
the time of writing and should be re-verified before work starts.

**What is NOT in this document:** the MCP cancellation fix (honor `notifications/cancelled`,
kill the child process). That was judged the one item with a live safety consequence and was
scheduled immediately. Everything here was deliberately deferred.

---

## Why these three, and the principle that selected them

`mini-swe-agent` scores >74% on SWE-bench Verified from a 169-line agent with a bash-only action
space, no multi-agent structure, and no review stage. That is strong evidence for a claim that
applies to us: **a capable model with shell access and a long step budget solves a great deal on
its own, and scaffolding added on top is neutral-to-harmful unless it earns its place.**

The comparison is mostly unfair — mini has an *oracle*. SWE-bench hands it a hidden test suite
that decides correctness, which removes the need for a reviewer, a tree audit, an integrity
nonce, and a verification manifest all at once. We work where nobody knows the answer, on a live
tree, across sessions, with irreversible side effects. Review is not gold-plating in that
setting; it is the only oracle available.

But the comparison yields a usable test:

> **Our harness's value must live in the two things mini is exempt from — supplying a missing
> oracle, and maintaining coherence past one context window. Any component serving neither is
> presumptively overhead.**

Applied honestly: review, the tree audit, checkpoints, warm resume, and the plan file all pass.
The **hand-maintained ledger fails** — it consumes the scarcest resource in the system (Director
context) to produce data that is strictly worse than what is already written to disk for free.
Two of the three proposals below exist to retire that chore. The third closes a mandated step
that was never performed.

---

## P1 — Harvest the ledger instead of hand-writing it

**Impact: HIGH · Cost: LOW (~100-line read-only script) · Confidence: CONFIRMED**

### The finding

Every field `.claude/plans/ledger.md` records by hand already exists on disk in structured,
machine-readable form. This was not inferred — the investigation reconstructed the ledger's
table from logs and matched it exactly, including rows recorded as approximations:

| Ledger (hand-written) | Extracted from logs |
|---|---|
| `architect-claude-max` draft, 67 calls, ~30 min | 67 calls, 04:01:01–04:30:36 (**29.6 min**) |
| `architect-claude-max` revise, 100 calls, ~33 min | 100 calls, 04:52:55–05:25:41 (**32.8 min**) |
| `architect-claude-max` critique, 25 calls, ~16 min | 25 calls, 04:34:54–04:51:04 (**16.2 min**) |
| `plan-synthesizer`, 26 calls, ~17 min | 26 calls, 05:28:47–05:46:09 (**17.4 min**) |
| `architect-codex` draft, 3 calls, ~21 min | 3 calls, 04:02:01–04:23:19 (**21.3 min**) |

### Where the data lives

**Claude lane.** Claude Code writes a per-subagent transcript plus a metadata sidecar under
`~/.claude/projects/<project-slug>/<session-id>/subagents/`:

- `agent-*.meta.json` → `agentType`, `description`, `toolUseId`, `spawnDepth`
- `agent-*.jsonl` → per-turn `message.model`, `effort`, `timestamp`, `gitBranch`, and a full
  `message.usage` block (`input_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`, `output_tokens`, `output_tokens_details.thinking_tokens`,
  `server_tool_use.web_search_requests`)

**Cost** is in the main session transcript as a `cost-state` entry — `totalCostUSD`,
`totalAPIDuration`, plus per-model `modelUsage[model].costUSD`. The 2026-08-27 session cost
**$7.56**, already computed, never read.

**Codex lane.** `codex exec` persists a full rollout for *every* run at
`~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl` (821 present on this machine as of
writing). Each carries `session_meta` (`cwd`, `originator`, `cli_version`, `model_provider`),
`turn_context` (`model`, `sandbox_policy`, `approval_policy`), and repeated `token_count`
events including:

```json
"rate_limits": { "primary": { "used_percent": 4.0, "window_minutes": 10080,
                              "resets_at": 1788464534 },
                 "credits": { "balance": "0" }, "plan_type": "prolite" }
```

### Two consequences worth acting on

1. **This re-scopes WO-1 of the adopted role-architecture plan.** WO-1
   (`.claude/plans/cross-compare/agent-role-architecture/final-plan.md:1454-1462`) is written as
   "instrument the existing roster for one weekly cycle" and asks for role, model, effort,
   vendor, tool calls, wall clock, tokens, cost, and a remaining-allowance signal. Every one of
   those already exists in the sources above — `rate_limits` *is* the allowance signal it wants
   to go and build. **WO-1 is mostly a parsing project, and several of its questions can be
   answered retroactively from data already on disk, without spending a single new run.**
   Re-scope it before dispatching.

2. **It dissolves a limitation recorded in the ledger itself.** `ledger.md:32-34` states that
   lane tool-call counts are not comparable because the codex lane reports 1–3 calls. The
   orphaned run's rollout contains **35 `custom_tool_call` events, 9 web searches, 66 reasoning
   items**. The lanes become comparable the moment the rollout is read.

### Implementation sketch

Add `.claude/hooks/orchestra-ledger.js` — read-only, no dependencies, matching the house style of
the existing runners. Expose it either as an additional `orchestra-engine` MCP tool or as a plain
script a `scout` runs. Output the ledger table, per run, joined across both lanes. This turns
`ORCHESTRA.md`'s "keep the ledger" from a Director chore into a command.

### Risk

These are **vendor-internal log formats, not public contracts**. `subagents/*.meta.json` and the
Codex rollout schema can change without notice. Mitigate by writing the parser defensively
(tolerate missing fields, never crash a session) and by pairing it with **P2**, which gives us a
format we own.

### Open questions to settle first

- Are `cost-state` entries present in every session, or only some? Observed in one of two.
- Which Claude Code `version` values are present across existing transcripts?

---

## P2 — Name the Codex rollout on every runner report, especially failures

**Impact: HIGH (diagnosis) · Cost: LOW–MEDIUM · Confidence: CONFIRMED**

### The finding

When a Codex run fails today, the report gives a tree audit and a stderr tail — and nothing about
what the engine actually did:

- `orchestra-exec.js:1348-1355` — `spawnSync`, one blocking call, nothing streamed
- `orchestra-exec.js:1381-1382` — the report is read from `report.txt` only *after* the process exits
- `orchestra-exec.js:1390-1408` — if the engine died first, the report says "the engine produced nothing"
- `orchestra-exec.js:397-405, 1490-1492` — `finally { teardownScratch(); }` then **deletes** the
  scratch directory, including `report.txt`

Meanwhile the complete trajectory of that "nothing" — every command, every output, every token
count — is sitting in `~/.codex/sessions/`, untouched.

**This was proven by the orphan incident.** The run that could not be explained has a rollout at
`~/.codex/sessions/2026/08/27/rollout-2026-08-27T20-38-54-01a04672-*.jsonl`, event window
`03:38:55.500Z → 04:02:29.088Z`, matching the stray artifact's mtime (21:02:29.937 local) **to the
second**. It even shows the engine running its own mid-run compaction. Nothing in the harness knew
the file existed.

### Two implementations

**Cheap.** After the run, match the newest rollout whose `session_meta.cwd` equals the run's
directory and whose window contains `startedAt`. Print `ENGINE TRAJECTORY: <path>` in the report
header. Fragile under concurrency.

**Robust.** Add `--json` to the `codex exec` invocation (verified present on 0.147.0:
`--json  Print events to stdout as JSONL`). The runner then knows the session id exactly, can
count tool calls and tokens in-process, and can salvage the last `agent_message` when the engine
is killed mid-run. Stdout becomes JSONL — tolerable, since the runner already prefers
`--output-last-message` over stdout (`orchestra-exec.js:1343, 1381`) — but the
`tail(att.stdout, 400)` fallback at `:1382` and the stderr-tail diagnostics need adjusting, and
`tests/fixtures/stub-codex.js` needs a JSONL mode.

### Why this also hardens the integrity story

`ledger.md:37-39` records that the codex lane echoed its `REPORT INTEGRITY` nonce on one run and
summarized it away on two others. **A nonce whose enforcement depends on an LLM launcher relaying
verbatim is weaker than it reads.** A rollout path is ground truth the launcher cannot paraphrase
away. This does not replace the nonce; it gives the nonce a fallback.

### Open question to settle first

Does `codex exec --json` compose cleanly with `--output-last-message` on 0.147.0, and what does
the JSONL event stream look like on stdout? One throwaway `codex exec --json -o <file>
--sandbox read-only --cd <tmpdir> -` run with a trivial prompt settles it. This decides cheap
versus robust.

---

## P3 — Commission the missing verification manifest

**Impact: HIGH · Cost: LOW (one profiling order) · Confidence: CONFIRMED**

### The finding

`ORCHESTRA.md` §8.3.3 mandates commissioning a verification manifest early in a project's life —
profile the tree, map suites and their independence, identify protected suites and shard seams,
and record the result in `.claude/orchestra.json` under `verification`. **On this repository it
was never done.**

`.claude/orchestra.json` currently contains only:

```json
{ "codex": { "crossplanTimeoutMs": 3600000 } }
```

Consequently `loadVerification()` (`orchestra-exec.js:369-372`) returns null and `manifestLines()`
(`orchestra-exec.js:645-668`) contributes nothing to every Codex executor brief. **Every
cross-vendor executor on this repo is verifying by guesswork** — while 236 test checks sit in
`tests/` unnamed.

The manifest is described in the protocol as the canonical command set for *every* verifier:
executors run it, the Opus reviewer runs it, the review runner injects it into the Codex brief,
and a fallback review judges pasted output against it. Its absence degrades all four.

### What the order looks like

A verification-profile micro-order (executor tier; **no source edits**):

1. Time the full tree. The CI commands are in `.github/workflows/test.yml`; there is no
   `package.json`, so the canonical invocations are the five `node tests/*.test.js` calls plus
   `node install.js --lint`.
2. Map the suites and their independence — which can run concurrently, which share fixtures.
3. Identify protected suites and shard seams.
4. Record the result in `.claude/orchestra.json` under `verification`.

### Known trap to carry into that order

`tests/review-lane.test.js` currently shows **5 environment-dependent failures** on this machine
that are *not* regressions: the fixtures expect no known-good Codex helper siblings to be
findable, but a real Codex install supplies them. Verified by control runs in a clean worktree at
unmodified HEAD. The manifest must record this so future verifiers do not read a red suite as a
break — or, better, the order should fix the fixtures so the suite is genuinely green.

---

## Related findings, recorded but not proposed as work

- **Budgets are prose, not mechanism.** `mini-swe-agent` refuses to make the model call when a
  limit is crossed (`cost_limit` defaults to $3, checked before every query). Our tool-call
  budgets are instructions in `agents/executor.md` that an LLM is asked to honor, and
  `ORCHESTRA.md` frames them as "health telemetry." **We cannot close this gap** — `install.js:566`
  notes that subagent tool calls never trigger project `PreToolUse` hooks, so there is no
  interception point. The actionable part is honesty: the protocol's register should not present
  norms and `if` statements in the same voice.
- **No default spend or step ceiling exists anywhere.** The only caps are wall-clock, and the sole
  project override *raises* one to 60 minutes.
- **We delete trajectories; mini saves them every step.** `orchestra-exec.js:1490-1492` tears down
  the scratch directory in a `finally`. Meanwhile `orchestra-engine-mcp.js:121-126` already creates
  a persistent run directory but writes only *inputs* to it. Writing the runner's stdout/stderr
  into that same directory is a ~2-line change that makes every failed lane post-mortem-able.
- **Our exit classifier computes a typed taxonomy and then throws it away.** `classifyExit()`
  (`orchestra-exec.js:760-836`) produces a clean `kind` — `not-found`, `runner-timeout`, `signal`,
  `spawn-error`, `exit`, `ok` — which is only ever rendered into English prose. Emitting it in a
  structured record would give failure-mode statistics we currently cannot compute.
- **Operational note for any future verification work on this machine:** bash `grep` silently
  aborts on at least one file in this tree and returns empty output without a non-zero exit inside
  a pipeline. Sweep-style verification must use ripgrep, or a false "clean" is trivially
  manufactured.

---

## Suggested order of work, if resumed

1. **P3** first — it is the cheapest, it closes a mandated gap, and every future review and
   execution round benefits immediately.
2. **P2 cheap variant** next — small, and it makes the next failure diagnosable.
3. **P1** — highest value, but its parser depends on formats worth understanding properly first;
   P2's structured record is the natural join key.
4. Revisit **P2 robust variant** only if the cheap one proves insufficient under concurrency.
