# WO-14b scope-oracle verdict (third pass) — GPT-5.6 Sol · xhigh, read-only, 2026-09-01

Order: `roster/wo14b-oracle-order.md`. Draft audited: `roster/wo14b-activation-bridge-order.md` at `9bfc021`.
Launched 03:58:10Z, exit 0 at 04:07:31Z. Launcher preflight: `CODEX_BIN` pinned, sha256
`cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4`, `codex-cli 0.151.0`,
`ORCHESTRA_REVIEW_MODEL=gpt-5.6-sol` pre-set in the environment, no stub in scope.

**Conductor note on the tree audit:** the "HEAD moved 1c0012d → 9bfc021" line is the
Conductor's own retry commit of the draft + oracle order (the first attempt failed lint on
the `wo14b-` prefix) landing seconds after the engine started — not engine writes. The
engine reports CHANGES: none and the two listed paths are exactly those committed files.

---

EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol (flag), tier: standard, effort: xhigh, sandbox: workspace-write, timeout: 2400000ms (flag), attempts: 1 (execution is never auto-retried), tree: directed worktree)
RUN NONCE: 717f2cec79e75c34
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 5689ms

STATUS: DONE

VERDICT (on the draft order as written)

Do not dispatch the draft as written. The activation bridge is the correct next tranche: current records make it the gate between readiness repair and E8/E1/A0, then WO-15 (`plans/cross-compare/agent-role-architecture/STATUS.md:784-827`; `roster/wo12-scope-oracle-2-2026-08-31.md:33-66`). Ticketed dispatch is also the right basic mechanism because the live session reaches work through tools, not direct JavaScript. But this draft is an oversized mega-order, gates only one bypass route, has no enforceable completion lifecycle, and accepts synthetic evidence where a live installed traversal is required. The repository’s own law says multi-subsystem work must split into bounded orders, while ship-together atomicity belongs to the integration branch (`ORCHESTRA.md:99-105`). Dispatch the revised staged tranche below.

WHAT THE ORDER GETS WRONG / WHAT IT IS MISSING

- The order is too large for one executor context. It combines router policy, schema migration, twelve retirements, installer changes, guard security, two runtime tools, telemetry, reachability instrumentation, and an end-to-end canary across more than three subsystems. The standing sizing rule requires splitting that shape and says “ship-together ≠ execute-together” (`ORCHESTRA.md:101-105`). The draft nevertheless supplies neither the mandatory progress file nor the checkpoint/tool-budget cadence required for a deliberate bundle (`ORCHESTRA.md:109-114`; draft `roster/wo14b-activation-bridge-order.md:119-169`).

- Keep ticketing, but reject the Agent-only gate. Current HEAD exposes raw `orchestra_exec` and `orchestra_review` tools with no ticket parameter (`packs/codex/hooks/orchestra-engine-mcp.js:517-590`), while the guard’s default block set contains neither `Agent` nor MCP tools (`hooks/orchestra-guard.js:78-88`). Project policy only blocks mutating MCP calls when explicitly configured (`ORCHESTRA.md:90`). Therefore a Director or wrong subagent could bypass the proposed Agent gate by calling the raw engine tool. Under `roster:new`, the engine server itself must reject unticketed or role-mismatched execution and review calls.

- The draft has no authoritative ticket lifecycle. “Matching unexpired ticket” does not define persistence, one-use consumption, replay protection, Q0 parent state, report capture, reviewer state, roster generation, concurrent calls, or what happens to open tickets after rollback (`roster/wo14b-activation-bridge-order.md:91-112`). Those are the enforcement mechanism, not implementation detail.

- The new Agent gate must not inherit the current fail-open windows. Current HEAD allows malformed hook input, stands down when the session model is undetermined, and allows on any guard exception (`hooks/orchestra-guard.js:398-460`). Those semantics may remain for the legacy Director mutation guard, but an active `roster:new` ticket check must deny malformed state, missing state, first-turn/unknown-model Agent calls, and internal errors. Only the explicit user pause and `roster:legacy` may disable it.

- The proposed dispatch input contradicts current HEAD. The draft calls it “`order.schema.json` shape + `tier`” (`roster/wo14b-activation-bridge-order.md:91-94`), but the schema requires `requested_casting`, `author_family`, `review_policy`, and `integrity_nonce`, rejects undeclared properties, and presently has no `tier` (`registry/schemas/order.schema.json:7-18,64-70`). Meanwhile `dispatch()` deliberately mints the nonce and ignores a caller-supplied one (`router/router.js:835-839`). Define a separate pre-dispatch request schema; the routed canonical order is its output.

- A casting record cannot truthfully be written at dispatch time. The schema describes what actually served the turn and requires `served_model`, `status`, and `review_cross_family` (`registry/schemas/casting-record.schema.json:5-18,34-45`). Before an Agent or Codex turn runs, those facts do not exist. Dispatch should write an immutable routing/ticket event; final casting telemetry should be written only after the actual result is captured, using `UNKNOWN` only where the runtime genuinely exposes no served model.

- `orchestra_close` is underspecified in both review directions. `dispatch()` computes review from the served author family (`router/router.js:973-1001`), but the existing MCP review runner is OpenAI-only and returns a prose report (`packs/codex/hooks/orchestra-engine-mcp.js:517-555`; `packs/codex/hooks/orchestra-review.js:73-78,1847-1865`). An OpenAI-authored change requires an Anthropic Reviewer Agent, which the MCP server cannot synchronously spawn. Closure must therefore be multi-stage: verification mints a reviewer ticket, the Director launches the computed Reviewer through Agent, the result is bound to that ticket, and a later close call audits it.

- The current review output is not the structured artifact the draft promises to validate. The runner emits `VERDICT/FINDINGS/CLAIMS CHECKED/NITS` text (`packs/codex/hooks/orchestra-review.js:1847-1865`), while `verdict.schema.json` requires structured arrays and dispatcher-written `review.cross_family` (`registry/schemas/verdict.schema.json:7-45`), and `verdict-audit.schema.json` additionally requires citation replay and refutation-duty evidence (`registry/schemas/verdict-audit.schema.json:7-46`). The bridge must add a strict structured review artifact and deterministic audit construction; it must not infer an approval from loosely parsed prose.

- The canary is not sufficient. It drives CLI twins and synthetic `PreToolUse` JSON (`roster/wo14b-activation-bridge-order.md:166-169`) and tests Q0 only by showing a missing Q0 denial (`roster/wo14b-activation-bridge-order.md:179-180`). A system that blocks every new-roster spawn could pass. The acceptance artifact must include successful real Agent launches, a real Q0 launch, real authoring in both vendor directions, real computed reviewers in both directions, actual Verifier evidence, and real closure through installed MCP tools.

- The draft overstates the owner’s bundling ruling. Current HEAD binds the retirements, toggles, stale-family fix, and Builder ladder into the bridge so roster/install lint moves once (`plans/cross-compare/agent-role-architecture/STATUS.md:806-827`). The guard findings are assigned to the bridge, but not to that same atomic migration (`roster/readiness-repair-tranche-2026-09-01.md:69-72,91`). Keep them in this tranche because the installed gate depends on the guard, but execute and review them as a separate leg.

- Drop the cycle-2 MINOR unless the ladder implementation necessarily touches the same expression. The owner explicitly requires the stale-family MAJOR inside the bridge; the `??`/non-string issue remains a registered follow-on (`roster/readiness-repair-tranche-2026-09-01.md:79-86`).

- Do not build `roster/lint.js --canary` as another execution framework. Static reachability is required because current lint proves paper agreement, not installation (`roster/roster-adversarial-review-2026-09-01.md:81-83`), but the live canary belongs in the installed integration test and live acceptance artifact. Extend installer/roster validation only enough to prove every active route resolves to an installed adapter.

THE ORDER AS IT SHOULD BE DISPATCHED

Dispatch WO-14b as one gate-class integration tranche composed of bounded work orders on one integration branch. Authorize checkpoint commits. After every leg, append one line to `roster/wo14b-activation-bridge-progress.md` naming the leg, affected verification, review result, and next leg. Each leg has an 80-tool-call ceiling; exceeding it returns `STATUS: CHECKPOINT`.

1. Lifecycle proof, no repository writes. In a disposable installed target, prove the actual hook payloads and ordering for Agent `PreToolUse`, Agent result capture, and session stop. Prove that a random ticket identifier can be passed unchanged through the Agent invocation and bound to its result. If the installed host cannot expose enough lifecycle state to enforce spawn, result provenance, and open-ticket stop, stop to the owner before implementation.

2. Contracts and owner-ruled compatibility migration. Add a pre-dispatch request schema distinct from the canonical order. Define an atomic, append-audited ticket state machine with one-use random identifiers, expiry, parent/Q0/reviewer relationships, exact role/rung binding, roster generation/config hash, and terminal typed outcomes. In the same atomic router/roster migration, implement the served-family Q0 fix, the Architect/Sweeper toggles, the ruled Builder ladder, the twelve retirements, and all ruled class-to-merge-target mappings (`roster/roster-review-refutations-2026-09-01.md:68-96`). Preserve the legacy agent files.

3. Installer and guard security. Make `--roster legacy` remain the default; make explicit `--roster new` install the nine active seats, benched Sweeper, both substrates, shared runtime, and required Codex server while leaving the legacy roster installed. Preserve unrelated manifest/MCP/settings data and refuse malformed owner configuration before copying or deleting anything. Current uninstall deletes owned files before reading settings (`install.js:1459-1545`); reverse that dependency. Land the `.md`/real-path guard repair and opt-in bounded push grant before the live canary.

4. Activation state machine. Implement one shared runtime core used by thin MCP and CLI adapters. `orchestra_dispatch` validates the request, reads one fresh Quartermaster snapshot, invokes `dispatch()`, persists the routing event, and returns typed implementation/Q0 tickets. The Agent pre-hook atomically consumes only the exact role ticket; required implementation tickets remain unusable until their Q0 ticket has launched successfully. Raw `orchestra_exec` and `orchestra_review` calls require tickets bound to their role and phase. Agent result capture binds the actual report to the consumed ticket. A stop hook refuses an active new-roster session with unresolved tickets.

5. Verification and closure. The first close call validates the bound executor report and runs `runVerification()` with the manifest pinned outside the audited commit, as current HEAD requires (`verifier/verifier.js:664-810`). Only a passing result may mint the computed Reviewer ticket. The actual Reviewer then runs through Agent; OpenAI Reviewer launchers may invoke the ticket-gated Codex runner, while Anthropic reviewers return directly. The second close call validates the structured verdict, constructs and validates the verdict audit from replayed evidence and dispatcher-owned family facts, writes final casting/verdict telemetry, and returns `CLOSED` only for a genuinely closing verdict. `REVISE`, same-family, unavailable, malformed, unbound, or unauditable results remain open.

6. Deterministic installed acceptance. Install into fresh temporary repositories and test MCP initialization/tool listing, static route-to-adapter reachability, ticket expiry/replay/wrong-role failures, first-turn unknown-model denial, direct raw-engine denial, positive and negative Q0 paths, P0 failure, P15 author/reviewer gating, Verifier-before-review ordering, verdict refusal, roster-generation invalidation, toggles, ladder, retirements, stale-family correction, and rollback. CLI adapters may exercise shared logic but are not evidence of installed MCP or Agent reachability.

7. Live installed canary. From a fresh installed session—not a CLI twin, fixture engine, stub, or synthetic hook—run:

   - One T2 Anthropic-authored Builder order with a real OpenAI Q0, real change/report, deterministic Verifier pass, real OpenAI cross-family review, and `CLOSED`.
   - One bounded OpenAI-authored Builder order with a real Anthropic Reviewer and `CLOSED`.
   - One unticketed Agent attempt and one unticketed raw engine attempt, both denied.
   - One below-reserve author/reviewer refusal and one non-closing verdict, neither representable as completion.
   - A `roster:new → roster:legacy` flip without reinstall; open new-roster tickets are invalidated, the next dispatch and actual Agent launch use the legacy identity, and the ledger records the transition.

The live transcript, ticket ledger, casting records, verdict audits, Verifier artifacts, engine provenance, and installed-file census are acceptance artifacts. Then run the full declared verification and one gate-class cross-vendor review over the integrated range.

BRIGHT-LINE STOPPING RULES

- Failure of lifecycle leg 1 stops the tranche. Do not substitute prose discipline, polling, CLI-only state, or synthetic hook tests for unavailable host enforcement.
- Any `roster:new` path that permits an unticketed, expired, replayed, wrong-role, wrong-generation, malformed-state, or first-turn Agent/engine call is a MAJOR fail-open: stop, restore legacy, and do not continue to the canary.
- Any implementation spawn before required Q0 launch, any review ticket before Verifier PASS, or any `CLOSED` result without a bound closing review stops the tranche and restores legacy.
- If author/reviewer family cannot be derived from dispatcher- and runtime-owned evidence, the ticket remains unattributed and cannot close. Do not accept a model-authored family assertion.
- If the live canary cannot run because authentication, MCP approval, Agent lifecycle, or a provider is unavailable, report `BLOCKED`. Synthetic success does not satisfy the gate.
- A failed rollback, or a new-roster ticket remaining executable after the roster generation changes, stops immediately and leaves the disposable target on legacy.
- No reserve recalibration; parity was explicitly accepted (`roster/readiness-repair-tranche-2026-09-01.md:87-90`).
- No WO-12 tooling/corpus work, E8/E1/A0 exercise, shadow traffic, dashboard, per-role runner proliferation, registry taxonomy redesign, Verifier trust-model change, automatic allowance ingestion, new seat, or deletion beyond the twelve ruled files.
- At most two fix/re-review cycles over the integrated bridge. If cycle 2 still produces a new MAJOR/CRITICAL, stop to the owner.
- Any leg exceeding its tool budget or failing twice with the same signature returns `CHECKPOINT` with the exact branch, commits, open tickets, and remaining legs. Do not grind forward.
- No readiness, WO-15, or shipping credit may be recorded before the gate below passes.

GATE THAT ENDS THIS ORDER

- Every active and benched seat, substrate, merged class, and Builder tier resolves through the installed runtime; both legacy and new rosters remain installed.
- All deterministic acceptance cases pass, including positive liveness and every named fail-closed case.
- The two real installed orders traverse dispatch → real Agent author/Q0 → Verifier → computed opposite-family real Agent Reviewer → audited closure, covering both vendor directions.
- Rollback invalidates open new-roster capability and successfully launches the next legacy order without reinstall.
- Schema-valid routing, casting, and verdict records agree with the live transcript and contain no fabricated served-model or cross-family value.
- The declared suite is green in the executor run and independently green in the final reviewer run.
- Final gate-class cross-vendor review returns APPROVE with no unresolved MAJOR/CRITICAL.
- The progress file has a terminal line, no ticket remains active, and the disposable target is restored to legacy.
- Only then is WO-14b closed. E8/E1/A0 may then run once through this path; WO-15 remains unopened until those outcomes are recorded.

VERIFICATION

- `rg -n "^" roster/wo14b-activation-bridge-order.md roster/wo12-scope-oracle-2-2026-08-31.md` → read both orders completely; confirmed the six-leg draft, synthetic canary, blank stopping rules, and prior activation bright line.
- Numbered `Get-Content`/`rg -n -C` reads over `roster/readiness-repair-tranche-2026-09-01.md`, `roster/roster-review-refutations-2026-09-01.md`, and `roster/roster-adversarial-review-2026-09-01.md` → confirmed the owner rulings, bridge-only stale-family requirement, accepted reserve parity, launch roster, toggles, retirements, ladder, reachability gap, and guard disposition.
- Numbered reads over `plans/cross-compare/agent-role-architecture/STATUS.md:784-830`, `final-plan.md:1623-1777,1781-2079`, and `ORCHESTRA.md:95-124` → confirmed the binding sequence, transition/rollback gates, WO-15/16/17 boundaries, sizing law, and mandatory cadence.
- Numbered reads over `install.js:48-55,536-575,619-632,1173-1287,1317-1345,1459-1565` → confirmed legacy-only core installation, PreToolUse-only hook registration, MCP pack registration, malformed-settings handling, unconditional git grants, and uninstall-before-settings ordering.
- Numbered reads over `hooks/orchestra-guard.js:78-88,180-278,398-460` → confirmed Agent/MCP are not default-blocked, configured plan-pattern behavior, malformed-input and exception fail-open behavior, and unknown-model stand-down.
- `rg` and numbered reads over `router/router.js:819-1001`, `router/aliases.json`, and `router/castings.json:217-235` → confirmed nonce ownership, stale-family expression at line 895, Q0/review sequencing, legacy default, and current four-rung Builder/Principal split.
- Numbered reads over `quartermaster/quartermaster.js:755-786` and `verifier/verifier.js:664-810` → confirmed fail-closed bucket-state contract and pinned-manifest verification API.
- Full numbered reads of `order.schema.json`, `casting-record.schema.json`, `verdict.schema.json`, and `verdict-audit.schema.json` → confirmed the dispatch-input mismatch, casting-record timing problem, and structured closure/audit requirements.
- Numbered reads over `packs/codex/hooks/orchestra-engine-mcp.js:515-740`, `orchestra-review.js:73-78,1847-1865`, and `packs/codex/pack.json:20-24` → confirmed the four current tools, absence of ticket inputs, prose review contract, and installed MCP server entry.
- Repository searches for `createRouter`, `.dispatch(`, `casting-record`, `verdict-audit`, and `^engine: codex$` → found router consumers only in tests and WO-7b, schema load/validation but no telemetry writer, and ten current Codex launcher files.
- `git status -sb; git diff --name-only; git diff --stat` → branch is ahead 15 with no working-tree changes or diff.
- Tests/build/lint → not run, as explicitly prohibited by this read-only scope-oracle order.

DEVIATIONS

- none

CONCERNS

- The host lifecycle proof is genuinely gating: without authoritative Agent result and stop events, “only `orchestra_close` can complete” cannot be capability-enforced.
- The current text-only review runner and structured verdict/audit schemas are separate contracts; treating parsing glue as already available would manufacture closure evidence.
- The live canary spends real provider calls and requires project MCP approval. Those are acceptance prerequisites, not reasons to downgrade to synthetic evidence.

---

STATUS: DONE

CHANGES
- none

VERIFICATION
- Read the draft, prior oracle, owner rulings, plan/status, router, Quartermaster, Verifier, installer, guard, schemas, engine server, and review runner with numbered `Get-Content`/`rg` queries → produced the evidence-cited revised activation order and stopping gate above.
- Repository usage searches → confirmed no production `createRouter()`/`dispatch()` consumer and no casting/verdict telemetry writer.
- `git status -sb; git diff --name-only; git diff --stat` → no working-tree changes.
- Tests/build/lint → not run; the order explicitly required a read-only audit and prohibited test suites.

DEVIATIONS
- none

CONCERNS
- The draft must not be dispatched unchanged: its synthetic canary can pass without a successful real new-roster spawn, and its Agent-only ticket gate leaves raw engine and closure bypasses.

REPORT INTEGRITY: 717f2cec79e75c34

TREE AUDIT: 2 path(s) changed while the engine ran (2 shown):
  left the dirty set: roster/wo14b-activation-bridge-order.md
  left the dirty set: roster/wo14b-oracle-order.md
  HEAD moved: 1c0012d7938e → 9bfc02192bb7 — the engine made commit(s); paths those commits cleaned from the dirty set may show above as "left the dirty set".
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token 717f2cec79e75c34) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token 717f2cec79e75c34, and the report does not contradict the tree audit.
== exit 0 2026-09-01T04:07:31Z ==
