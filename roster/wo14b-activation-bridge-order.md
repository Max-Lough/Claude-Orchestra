# WO-14b — Activation bridge (v2, reshaped by the scope oracle 2026-09-01)

- **Status:** RULED. The oracle (`roster/wo14b-oracle-verdict.md`) refused the v1 draft as
  written and dispatched this shape instead: one gate-class integration tranche composed
  of bounded work orders on one integration branch. Leg 1 is a host lifecycle proof that
  can stop the whole tranche. **v1 is preserved in git at `9bfc021` for the record.**
- **Class:** gate-class integration tranche. Legs are bounded E2 Builder orders (Sonnet
  for router/runtime, Luna for bounded legs), one E7 Red Team pass on the guard leg, one
  gate-class R0 cross-vendor review (Sol · high) over the integrated range at the end.
- **Risk:** T2 (branch writes to `install.js`, `hooks/orchestra-guard.js`, `router/`,
  `registry/schemas/`, `packs/codex/`, the roster; proven on disposable installed
  targets; nothing irreversible).
- **Author family:** attributed per leg from the served casting; review computed from it.
- **Position in the binding path:** readiness-repair tranche (CLOSED) → **this order** →
  E8/E1/A0 once through the working path → WO-15 shadow.
- **Branch:** `claude/wo14b-bridge` off `claude/wo12-trials`. Checkpoint commits
  authorized. **Progress file:** `roster/wo14b-activation-bridge-progress.md` — one line
  appended after every leg naming the leg, affected verification, review result, and next
  leg. **Per-leg ceiling: 80 tool calls**; exceeding it returns `STATUS: CHECKPOINT`.

## Why this order exists

The scope oracle's second pass (`roster/wo12-scope-oracle-2-2026-08-31.md:33-44`) found
the campaign's largest gap is activation: the router, registry, Verifier, Quartermaster
and roster are libraries and records, not the installed harness. `install.js` installs
the legacy six-agent core; no production entry point calls `dispatch()`; the alias layer
resolves but no launcher consumes it. WO-15 cannot honestly begin by declaring both
rosters live. The owner rulings of 2026-09-01 assign to the bridge: the stale-family
MAJOR, the seat toggles, the twelve retirements, the Builder ladder, provenance
recording, reachability, and the `install.js`/guard repairs (sdc-011/012).

## Goal

An installed target on which real orders traverse the new-roster path end to end —
fresh Quartermaster evidence → `dispatch()` → real Agent author and Q0 launches →
deterministic verification → computed opposite-family real Reviewer → audited closure —
in both vendor directions, with every fail-closed property enforced by capability, not
prose, and `roster:new → roster:legacy` rollback by a flag flip with no reinstall.
Nothing in this order claims readiness or shadow credit.

## Facts the builder inherits (verified 2026-09-01; the oracle re-verified and extended)

- `install.js`: `AGENTS` = the six legacy files → `.claude/agents/` (`install.js:48-55,
  1176-1179`); packs register MCP servers in the target's `.mcp.json`
  (`install.js:1221-1287`); guard hook → `PreToolUse`, empty matcher
  (`install.js:536-567,1317-1323`); unconditional git grants incl. `Bash(git push:*)`
  (`install.js:558-562`); uninstall deletes owned files before reading settings
  (`install.js:1459-1545`); `--uninstall` is the only rollback.
- The main session is the Director (`ORCHESTRA.md:5,19`) and reaches work only through
  tools. `roster/conductor.md` is "the interactive session model … the seat's standing
  contract, not a dispatchable subagent charter."
- Guard: `Agent` and MCP tools are not in the default block set
  (`hooks/orchestra-guard.js:78-88`); malformed input, undetermined model, and any
  exception fail OPEN (`orchestra-guard.js:398-460`); `directorPlanPatterns` drops the
  `.md` requirement (`:224-229`).
- Engine server: `orchestra_review`, `orchestra_exec`, `orchestra_crossplan`,
  `orchestra_doctor` — **no ticket parameter on any** (`packs/codex/hooks/
  orchestra-engine-mcp.js:517-590`); the review runner is OpenAI-only and returns
  prose `VERDICT/FINDINGS/CLAIMS CHECKED/NITS` (`orchestra-review.js:73-78,1847-1865`).
- `router.dispatch(order, buckets, opts)` (`router/router.js:819-1002`) mints
  `integrity_nonce` itself and ignores a caller-supplied one (`:835-839`); computes review
  from the served author family (`:973-1001`); stale-family expression at `:895`.
  `resolveSeat` is the WO-14 kill switch; `aliases.json:5` `rosterDefault:"legacy"`.
- `order.schema.json` requires `requested_casting`, `author_family`, `review_policy`,
  `integrity_nonce`, rejects undeclared properties, has no `tier` (`registry/schemas/
  order.schema.json:7-18,64-70`) — **the dispatch input must be a separate pre-dispatch
  request schema; the routed canonical order is its output.**
- `casting-record.schema.json` requires `served_model`, `status`,
  `review_cross_family` (`:5-18,34-45`) — **cannot be truthfully written at dispatch
  time**; dispatch writes an immutable routing/ticket event, final casting telemetry is
  written after the actual result is captured (`UNKNOWN` only where the runtime exposes
  no served model). `verdict.schema.json` (`:7-45`) and `verdict-audit.schema.json`
  (`:7-46`) require structured arrays, citation replay and refutation-duty evidence —
  **a strict structured review artifact must be added; approval is never inferred from
  loosely parsed prose.** No telemetry writer exists for any schema.
- `quartermaster.bucketState(opts)` returns the `buckets` shape `dispatch()` wants and
  fails closed (`quartermaster.js:755-786`); readings are manual, gitignored.
- `verifier.runVerification(...)` with the manifest pinned outside the audited commit
  (`verifier/verifier.js:664-810`).
- Sizing law: multi-subsystem work splits into bounded orders; ship-together ≠
  execute-together; deliberate bundles carry a progress file and checkpoint cadence
  (`ORCHESTRA.md:99-114`).

## Mechanism — ticketed dispatch with an authoritative lifecycle (oracle-ruled)

Ticketing is the right basic mechanism because the session reaches work through tools.
But the gate must sit **everywhere work can be reached**, not only on `Agent`:

- **`orchestra_dispatch`** validates a pre-dispatch request, reads one fresh Quartermaster
  snapshot, invokes `dispatch()`, persists an append-audited routing event, and returns
  typed implementation/Q0 tickets.
- **Tickets** are one-use random identifiers with expiry, parent/Q0/reviewer
  relationships, exact role/rung binding, roster generation + config hash, and terminal
  typed outcomes, held in an atomic, append-audited state machine.
- **The Agent pre-hook** atomically consumes only the exact role ticket; a required
  implementation ticket is unusable until its Q0 ticket has launched successfully. Under
  `roster:new` it denies malformed state, missing state, first-turn/unknown-model Agent
  calls, and internal errors — the legacy guard's fail-open windows do not carry over.
  Only the explicit user pause and `roster:legacy` disable it.
- **Raw `orchestra_exec` and `orchestra_review`** require tickets bound to their role and
  phase under `roster:new` — the engine server itself rejects unticketed or
  role-mismatched calls.
- **Agent result capture** binds the actual report to the consumed ticket; a **stop hook**
  refuses an active new-roster session with unresolved tickets.
- **Closure is multi-stage:** close #1 validates the bound executor report and runs
  `runVerification()`; only a PASS mints the computed Reviewer ticket; the Director
  launches the Reviewer through `Agent` (OpenAI Reviewer launchers may call the
  ticket-gated Codex runner; Anthropic reviewers return directly); close #2 validates the
  structured verdict, constructs and validates the verdict audit from replayed evidence
  and dispatcher-owned family facts, writes final casting/verdict telemetry, and returns
  `CLOSED` only for a genuinely closing verdict. `REVISE`, same-family, unavailable,
  malformed, unbound, or unauditable results remain open.
- One shared runtime core; MCP and CLI are thin adapters. **CLI adapters may exercise
  shared logic but are not evidence of installed MCP or Agent reachability.**

## The legs (oracle's order; dispatch strictly in sequence)

**Leg 1 — Lifecycle proof, no repository writes.** In a disposable installed target,
prove the actual hook payloads and ordering for Agent `PreToolUse`, Agent result capture,
and session stop. Prove that a random ticket identifier can be passed unchanged through
the Agent invocation and bound to its result. **If the installed host cannot expose
enough lifecycle state to enforce spawn, result provenance, and open-ticket stop, stop to
the owner before implementation.** Deliverable: `roster/wo14b-leg1-lifecycle-proof.md`
with the captured payloads verbatim.

**Leg 2 — Contracts and the owner-ruled compatibility migration.** Add the pre-dispatch
request schema (distinct from the canonical order). Define the ticket state machine
(above). In the same atomic router/roster migration: the served-family Q0 fix
(`router.js:895`), the Architect/Sweeper toggles (typed `DISABLED`), the ruled Builder
ladder (`tier` bounded/standard/dense/deep; `deep` → Opus·high; Sol·high only as an
explicit Conductor override that passes the review-reserve check), the twelve
retirements, and every ruled class-to-merge-target mapping
(`roster/roster-review-refutations-2026-09-01.md` § Owner rulings). Preserve the legacy
agent files. The cycle-2 `??` MINOR is **dropped** from this order unless the ladder
necessarily touches the same expression — it stays a registered follow-on.

**Leg 3 — Installer and guard security.** `--roster legacy` remains the default;
explicit `--roster new` installs the nine active seats, benched Sweeper, both
substrates, the shared runtime, and the required Codex server, leaving the legacy roster
installed. Preserve unrelated manifest/MCP/settings data; refuse malformed owner
configuration before copying or deleting anything; reverse the uninstall
delete-before-read dependency. Land the `.md`/real-path guard repair (sdc-011) and the
opt-in bounded push grant (sdc-012: push not installed by default; `--grant-push` adds
`Bash(git push:*)` with a `permissions.deny` counterweight for `--force`,
`--force-with-lease`, `-f`, `--delete`, `--mirror`; README documents the session-wide
grant and the stand-down windows; README:207/220 corrected). Executed and reviewed as its
own leg; Red Team pass on the finished leg.

**Leg 4 — Activation state machine.** One shared runtime core with thin MCP and CLI
adapters: `orchestra_dispatch`, the ticket store, the Agent pre-hook consumption, the
ticket requirement on raw `orchestra_exec`/`orchestra_review`, Agent result capture
binding the report to the ticket, and the stop hook.

**Leg 5 — Verification and closure.** The two-stage close described above, the strict
structured review artifact, deterministic verdict-audit construction, and the final
casting/verdict telemetry writers.

**Leg 6 — Deterministic installed acceptance.** Install into fresh temporary
repositories and test: MCP initialization/tool listing, static route-to-adapter
reachability, ticket expiry/replay/wrong-role failures, first-turn unknown-model denial,
direct raw-engine denial, positive and negative Q0 paths, P0 failure, P15 author/reviewer
gating, Verifier-before-review ordering, verdict refusal, roster-generation
invalidation, toggles, ladder, retirements, stale-family correction, and rollback.
Runs in CI on all three OSes.

**Leg 7 — Live installed canary.** From a fresh installed session — not a CLI twin,
fixture engine, stub, or synthetic hook — run:
- one T2 Anthropic-authored Builder order with a real OpenAI Q0, real change/report,
  deterministic Verifier pass, real OpenAI cross-family review, and `CLOSED`;
- one bounded OpenAI-authored Builder order with a real Anthropic Reviewer and `CLOSED`;
- one unticketed Agent attempt and one unticketed raw engine attempt, both denied;
- one below-reserve author/reviewer refusal and one non-closing verdict, neither
  representable as completion;
- a `roster:new → roster:legacy` flip without reinstall: open new-roster tickets are
  invalidated, the next dispatch and actual Agent launch use the legacy identity, and the
  ledger records the transition.

The live transcript, ticket ledger, casting records, verdict audits, Verifier artifacts,
engine provenance, and installed-file census are the acceptance artifacts. Then the full
declared verification and one gate-class cross-vendor review over the integrated range.

## Out of scope — must not happen inside this order

No WO-12 tooling/corpus work; no E8/E1/A0 exercise; no shadow traffic; no dashboard;
no per-role runner proliferation; no registry taxonomy redesign; no Verifier trust-model
change; no automatic allowance ingestion; no new seat; no deletion beyond the twelve
ruled files; no reserve recalibration (parity accepted); no `roster/lint.js --canary`
execution framework (static reachability only — the live canary is leg 7).

## Bright-line stopping rules (oracle-authored; binding until the owner overrides)

- Failure of lifecycle leg 1 stops the tranche. Do not substitute prose discipline,
  polling, CLI-only state, or synthetic hook tests for unavailable host enforcement.
- Any `roster:new` path that permits an unticketed, expired, replayed, wrong-role,
  wrong-generation, malformed-state, or first-turn Agent/engine call is a MAJOR
  fail-open: stop, restore legacy, and do not continue to the canary.
- Any implementation spawn before required Q0 launch, any review ticket before Verifier
  PASS, or any `CLOSED` result without a bound closing review stops the tranche and
  restores legacy.
- If author/reviewer family cannot be derived from dispatcher- and runtime-owned
  evidence, the ticket remains unattributed and cannot close. Do not accept a
  model-authored family assertion.
- If the live canary cannot run because authentication, MCP approval, Agent lifecycle,
  or a provider is unavailable, report `BLOCKED`. Synthetic success does not satisfy the
  gate.
- A failed rollback, or a new-roster ticket remaining executable after the roster
  generation changes, stops immediately and leaves the disposable target on legacy.
- No reserve recalibration; parity was explicitly accepted.
- No WO-12 tooling/corpus work, E8/E1/A0 exercise, shadow traffic, dashboard, per-role
  runner proliferation, registry taxonomy redesign, Verifier trust-model change,
  automatic allowance ingestion, new seat, or deletion beyond the twelve ruled files.
- At most two fix/re-review cycles over the integrated bridge. If cycle 2 still produces
  a new MAJOR/CRITICAL, stop to the owner.
- Any leg exceeding its tool budget or failing twice with the same signature returns
  `CHECKPOINT` with the exact branch, commits, open tickets, and remaining legs. Do not
  grind forward.
- No readiness, WO-15, or shipping credit may be recorded before the gate below passes.

## Gate that ends this order (oracle-authored)

- Every active and benched seat, substrate, merged class, and Builder tier resolves
  through the installed runtime; both legacy and new rosters remain installed.
- All deterministic acceptance cases pass, including positive liveness and every named
  fail-closed case.
- The two real installed orders traverse dispatch → real Agent author/Q0 → Verifier →
  computed opposite-family real Agent Reviewer → audited closure, covering both vendor
  directions.
- Rollback invalidates open new-roster capability and successfully launches the next
  legacy order without reinstall.
- Schema-valid routing, casting, and verdict records agree with the live transcript and
  contain no fabricated served-model or cross-family value.
- The declared suite is green in the executor run and independently green in the final
  reviewer run.
- Final gate-class cross-vendor review returns APPROVE with no unresolved MAJOR/CRITICAL.
- The progress file has a terminal line, no ticket remains active, and the disposable
  target is restored to legacy.
- Only then is WO-14b closed. E8/E1/A0 may then run once through this path; WO-15 remains
  unopened until those outcomes are recorded.

## Declared verification (every leg; the final review re-runs all)

    node install.js --lint
    node tests/frontmatter-lint.test.js
    node tests/registry.test.js
    node tests/verifier.test.js
    node tests/router.test.js
    node tests/quartermaster.test.js
    node roster/lint.js && node install.js --lint roster
    node tests/exec-lane.test.js && node tests/mcp-lane.test.js && node tests/review-lane.test.js
    node tests/bridge-acceptance.test.js       (new — leg 6)
