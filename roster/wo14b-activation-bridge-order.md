# WO-14b — Activation bridge (DRAFT for oracle pass, 2026-09-01)

- **Status:** DRAFT — not dispatched. Goes to the scope oracle (Sol · xhigh, read-only)
  first; the oracle authors the stopping rules and may reshape or refuse this order.
- **Class:** mixed — E2 Builder legs (Sonnet/Luna by leg shape), one E7 Red Team pass
  on the guard/installer leg, gate-class R0 cross-vendor review (Sol · high) at the end.
- **Risk:** T2 (writes to `install.js`, `hooks/orchestra-guard.js`, `router/`, the
  roster; nothing irreversible; every write on a branch, proven on a disposable target).
- **Author family (planned):** anthropic for router/installer legs, openai (Luna) for
  bounded legs; review computed from the served family — every leg attributed.
- **Position in the binding path:** readiness-repair tranche (CLOSED 2026-09-01) →
  **this order** → E8/E1/A0 once through the working path → WO-15 shadow.

## Why this order exists

The scope oracle (`roster/wo12-scope-oracle-2-2026-08-31.md:33-44`) found the campaign's
largest gap is activation: the router, registry, Verifier, Quartermaster and roster are
libraries and records, not the installed harness. `install.js` installs the legacy
six-agent core (`install.js:48-55`); no production entry point calls
`createRouter()`/`dispatch()`; the alias layer resolves as a function but no launcher
consumes it. WO-15 cannot honestly begin by declaring both rosters live.

The adversarial roster review (`roster/roster-adversarial-review-2026-09-01.md` S1, S2,
S5, S6) and the owner rulings of 2026-09-01
(`roster/roster-review-refutations-2026-09-01.md` § Owner rulings;
`roster/readiness-repair-tranche-2026-09-01.md` § Owner rulings) assign these to the
bridge so lint moves once: the stale-family MAJOR, the seat toggles, the file
retirements, the Builder ladder, provenance recording, reachability lint, and the
`install.js` rebuild with the sdc-011/012 guard findings.

## Goal

An installed, disposable target on which a real order traverses the new-roster path
end to end — fresh Quartermaster evidence → `dispatch()` → Q0 launch-or-block →
deterministic verification → cross-family review → closure refused when the verdict
does not close — with telemetry written, and `roster:new → roster:legacy` rollback by a
flag flip with no reinstall. Nothing in this order claims readiness or shadow credit.

## Facts the builder inherits (verified 2026-09-01)

- `install.js`: `AGENTS` = scout/detective/executor/executor-heavy/executor-heavy-xhigh/
  reviewer → `.claude/agents/` (`install.js:48-55,1176-1179`); skills → `.claude/skills/`;
  packs (opt-in) copy agents/hooks/skills and register MCP servers in the target's
  `.mcp.json` (`install.js:1221-1287`); guard hook → `.claude/hooks/` + `PreToolUse`
  with empty matcher (`install.js:536-567,1317-1323`); git grants
  `Bash(git add|commit|push:*)` merged into `permissions.allow` (`install.js:558-562`);
  `--lint`; `--uninstall` is the only rollback and is a full uninstall.
- No Conductor is installed: the main session is the Director (`ORCHESTRA.md:5,19`) and
  dispatches by hardcoded legacy agent names through the Agent tool. The new roster's
  Conductor (`roster/conductor.md`) is by its own text "the interactive session model
  … the seat's standing contract, not a dispatchable subagent charter."
- `router.dispatch(order, buckets, opts)` → `{ok, class, role, casting, gate,
  review_policy, review, q0, order}` or typed `{ok:false, rejected|outcome:'GATED'|
  blocked:'Q0'}` (`router/router.js:819-1002`). `resolveSeat(name, {roster, buckets})`
  is the WO-14 kill switch; `router/aliases.json:5` `rosterDefault:"legacy"`.
  `normalizeBuckets` fails closed on any missing bucket (`router.js:379-390`).
- `quartermaster.bucketState(opts)` returns exactly the `buckets` shape `dispatch()`
  wants (`quartermaster/quartermaster.js:763-786`), fails closed with
  `err.failClosed` on unusable evidence; readings come from the gitignored, manually
  appended `.claude/orchestra-pool-readings.jsonl` (`quartermaster.js:44,91`).
- `verifier.runVerification({repoDir, commit, baseRef, order, report, manifestRef,
  manifestPath, mutations, …})` (`verifier/verifier.js:664-811`); manifest pinned
  outside the audited commit (Ruling 1a).
- Telemetry: `registry/schemas/casting-record.schema.json` and
  `verdict-audit.schema.json` exist; **no writer exists anywhere**.
- `packs/codex/hooks/orchestra-engine-mcp.js` registers `orchestra_review`,
  `orchestra_exec`, `orchestra_crossplan`, `orchestra_doctor`; the ten `engine: codex`
  roster files are thin launchers for those tools. `.mcp.json` is absent at this repo
  root (registered only into pack-install targets).
- Guard findings (S-Opus on sdc-011/012, `wo12/results-S-Opus-phase0.json`):
  `directorPlanPatterns` route drops the `.md` requirement (`hooks/orchestra-guard.js:
  224-229`; with `[".*"]` the Director can rewrite the guard itself); `permissions.allow`
  is session-wide while the guard stands down on non-director sessions, on a session's
  first turn (`model === null`), and under `.claude/orchestra.pause`/`ORCHESTRA_PAUSE=1`
  — so the git grants reach the main session unprompted in those windows;
  `Bash(git push:*)` is unbounded (no deny for `--force`, `--force-with-lease`,
  `--delete`, `-f`); installer merge silently drops malformed `permissions`; uninstall
  strands the grants if `settings.json` is unparseable; README:207/220 "undetermined
  model resolves to enforce" is false (guard:237-238 allows).
- CI (`.github/workflows/test.yml`, 3 OS × node 20/22/24): `install.js --lint`,
  frontmatter-lint, review-lane, scan-lane, exec-lane, registry, verifier, router,
  quartermaster, wo7b/score.js, `roster/lint.js`, `install.js --lint roster`, mcp-lane,
  wo12-tooling. Last counts: router 153, quartermaster 216, registry 31, verifier 101.

## Proposed mechanism — "ticketed dispatch" (the oracle is asked to question this)

The Director/Conductor cannot be made to call a JS function; it calls tools. So the
bridge puts `dispatch()` behind a tool and makes the Agent tool refuse anything that
did not come out of it:

1. **`orchestra_dispatch`** (new MCP tool in the codex pack's engine server, plus a CLI
   twin `node .claude/orchestra/dispatch.js` for tests): input = an order
   (`order.schema.json` shape + `tier`); it reads fresh P0 state via `bucketState()`
   (stale/missing evidence → typed `P0_UNAVAILABLE`, never Green), calls `dispatch()`,
   writes a schema-valid **casting record** (the WO-1 telemetry row) to
   `.claude/orchestra/ledger/`, and returns a **ticket**: role file to spawn, served
   casting, Q0 companion (already dispatched or the typed block), review policy, and
   the ticket id. In `roster:legacy` mode it returns the legacy agent name unchanged
   with a ledger line — the kill switch is the manifest flag, not a reinstall.
2. **Agent-tool gate** in `hooks/orchestra-guard.js`: a `PreToolUse` check on `Agent`
   that, under `roster:new`, denies any `subagent_type` without a matching unexpired
   ticket, and denies a spawn whose ticket carries a required-but-unlaunched Q0.
   Under `roster:legacy` the check is inert. This is the capability-enforced adapter
   S6 asked for, in the one place the harness already enforces policy.
3. **`orchestra_close`** (tool + CLI twin): input = ticket id + the executor report +
   commit range; it runs `runVerification` (deterministic evidence first — no review
   request is issued without a Verifier artifact), then requests the computed
   cross-family review through the existing review runner, validates the verdict
   against `verdict-audit.schema.json`, writes the audit row, and returns
   `CLOSED` only for a closing verdict. `GATED`, `UNAVAILABLE`, same-family, missing
   Q0, or a non-PASS verifier → typed `NOT_CLOSED` with the reason. There is no other
   way to mark a ticket complete.
4. **Owner-pinned manifest** `.claude/orchestra.json` gains `roster: legacy|new`,
   `seats: { "Architect": true, "Sweeper": false, … }` (a disabled seat's order →
   typed `DISABLED`, Conductor self-plans / Verifier census with the disclosure on the
   order), and the Builder ladder tables are read from `router/castings.json`, not the
   manifest.

## Scope — the legs

**L1 Router (Sonnet · med, dense → high).** (a) Stale-family MAJOR: record the SERVED
family on the Q0 order at dispatch, or re-derive `author_family` from the casting at
return (`router.js:895`); (b) `??` + non-string typed refusal on overrides (MINOR);
(c) Builder ladder: `tier` on `order.schema.json` (`bounded|standard|dense|deep`),
per-tier preferred casting + ordered cross-vendor substitute list in `castings.json`,
walked by `cast()` under the bucket ladder with `recastFrom` disclosed; guardrails
carried (Luna never under-specified; Opus behind P15 + Amber arming; `deep` defaults
Opus·high; Sol·high only as an explicit Conductor override that passes the
Quartermaster review-reserve check — never a degradation target); (d) seat enable
flags → typed `DISABLED` outcome from `dispatch()`/`resolveSeat()`; (e) file
retirements: delete the 12 ruled files, keep every class in the registry routing to
its merge target (N0/N1/N2/M0 → Investigator; E0/E1/E5/E6/E8/D0 → Builder; A1 →
documented workflow), absorb Principal's Opus rung into the ladder, update
`castings.json`/`aliases.json`/`roster/lint.js` so lint and `install.js --lint` are
green in one move. Tests pinned for every item.

**L2 Installer + manifest (Sonnet · med).** `install.js --roster new` installs the
active seat files (9 + benched Sweeper, disabled) and the substrates as a runtime
(`.claude/orchestra/`), registers the engine server in the target's `.mcp.json`,
writes the manifest keys above, and leaves the legacy agents installed alongside (both
rosters live is WO-15's precondition). `--roster legacy` is the default and today's
behavior. Rollback = manifest flag flip, proven without reinstall. Fix the installer
merge (fail loudly on malformed `permissions`) and the uninstall ordering (grants
removed before files; unparseable settings → refuse before deleting anything).

**L3 Dispatch/close tooling + telemetry (Sonnet · med).** `orchestra_dispatch`,
`orchestra_close`, CLI twins, the two schema-validated writers, the Agent-tool gate in
the guard. Provenance: every ticket records author family (and co-authors on
re-dispatch); an unattributed order cannot get a ticket.

**L4 Guard/installer security (Luna · xhigh, bounded; then E7 Red Team pass).**
sdc-011: pattern route requires `.md` and containment via real path; deny hint names
the configured plan directories. sdc-012: the push grant is no longer installed by
default — opt-in `--grant-push` installs `Bash(git push:*)` **with** a
`permissions.deny` counterweight for `--force`, `--force-with-lease`, `-f`, `--delete`,
`--mirror`; README documents that `permissions.allow` is session-wide and lists the
three stand-down windows; README:207/220 corrected to match guard:237-238. Red Team
attacks the finished leg (defensive, read-only, findings only).

**L5 Reachability lint (Luna · xhigh, bounded).** `roster/lint.js --reach`: every
active seat's selected rung resolves through an installed adapter (Anthropic model id
map for in-harness files; `engine: codex` → the engine server is registered and
`orchestra_doctor` answers) and, with `--canary`, executes a disposable no-op order
through `orchestra_dispatch` in legacy and new modes.

**L6 Acceptance canary (Sonnet · med).** `tests/bridge-canary.test.js`: installs into
a tmp git repo with `--roster new`, seeds readings, and proves each bullet below by
driving the CLI twins and the guard hook with synthetic `PreToolUse` JSON (the way the
guard tests already do). Runs in CI on all three OSes.

## Acceptance — the installed canary must show (oracle-2 list, verbatim in effect)

1. Fresh Quartermaster evidence enters the actual dispatcher; stale or missing evidence
   is a typed refusal, never Green.
2. Security touches cannot reach Fable (an order with `touches:["auth"]` and an
   explicit Fable rung → FORBIDDEN through the tool path).
3. P15 can prevent both author and reviewer dispatch (seeded below-reserve readings →
   author GATED; reviewer non-closing).
4. Required Q0 is launched or blocks work (a T3 order with no Q0 → the Agent-tool
   gate denies the spawn).
5. Deterministic evidence precedes review (`orchestra_close` without a Verifier PASS
   artifact issues no review request).
6. A non-closing review cannot be represented as completion (`NOT_CLOSED` is the only
   result for GATED/same-family/UNAVAILABLE verdicts; no `CLOSED` path bypasses it).
7. `roster:new → roster:legacy` rollback works without reinstalling (flag flip; the
   next `orchestra_dispatch` returns the legacy identity; the Agent-tool gate is
   inert; the ledger records the flip).
8. Plus: every seat toggle round-trips (`Architect:false` → typed `DISABLED`;
   `Sweeper:true` → castable); the retired files are gone and lint is green; the
   Builder ladder's `deep` resolves Opus·high at Green and refuses Sol without the
   reserve check; the stale-family reproducer from cycle 2 now records the served
   family; no `git push --force` is auto-approved on a default install.

## Out of scope — must not happen inside this order

- No WO-12 phase 1–3 work, scorer repair, corpus or blinding changes.
- No E8/E1/A0 exercises — they run *after* this order, once, through the working path.
- No shadow traffic, no WO-15 credit, no readiness claim in any record.
- No new seat files, no casting changes for seats not named above, no reserve
  recalibration (owner: leave at parity).
- No telemetry beyond the two schema writers and the ledger directory — no dashboards.
- No changes to `wo7b/score.js`, the registry taxonomy, or the Verifier's trust model.
- No automatic ingestion of vendor allowance readings — readings stay manual.

## Sequencing and review

L1 → L2 → L3 → (L4 ∥ L5) → L6. Each leg: Builder → Verifier (suite + lint) →
computed cross-family review at its tier. The whole order closes on one gate-class
R0 cross-vendor review (Sol · high) over the full range, with the oracle's two-cycle
cap: a second re-review that still yields a new MAJOR/CRITICAL stops to the owner.

## Declared verification (every leg; the final review re-runs all)

    node install.js --lint
    node tests/frontmatter-lint.test.js
    node tests/registry.test.js
    node tests/verifier.test.js
    node tests/router.test.js
    node tests/quartermaster.test.js
    node roster/lint.js && node install.js --lint roster
    node tests/exec-lane.test.js && node tests/mcp-lane.test.js
    node tests/bridge-canary.test.js          (new — L6)

## Stopping rules

Authored by the scope oracle, not by this order's author. Left blank on purpose.
