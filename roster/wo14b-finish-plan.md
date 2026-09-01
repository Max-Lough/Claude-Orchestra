# WO-14b FINISH PLAN — the plan of record (GPT-5.6 Sol · max, read-only; owner-ordered "asap/KISS/YAGNI/DRY") — 2026-09-01

Order: `roster/wo14b-finish-oracle-order.md`. Tree audit clean at `60a9241`. **This is the plan a fresh session executes**: three cuts applied to the running repairs (owner-notified, revertible), then leg 6 at its four-scenario minimum, one Sol integrated review (+ one correction), then the live gate with the Opus adversarial audit folded into it. Stopping rules at the end are binding. Verdict verbatim below.

---

EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol (flag), tier: standard, effort: max, sandbox: workspace-write, timeout: 3000000ms (flag), attempts: 1 (execution is never auto-retried), prohibited commands: 3, tree: directed worktree)
RUN NONCE: ec5482b072bf8154
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 5919ms

STATUS: DONE

VERDICT

The bridge is not closed. The fastest defensible finish is: correct two scope defects in the running repairs, build one minimal installed-spine test, perform one Sol review, then run the live gate with the Opus adversarial pass folded into its final audit. Do not insert a pin-store, ticket-store, or fixture-framework refactor.

YAGNI — DELETE NOW

- Repair B’s `envelope.tickets` field and per-ticket envelope pointer. The ticket store mints IDs internally and accepts no `envelope` property, so a complete envelope containing ticket IDs cannot exist before issuance as ordered. Write an immutable, exclusively-created `ledger/<task_id>/envelope.json` without ticket IDs; closure derives it from the ticket’s existing `task_id`. Cost: the envelope does not independently enumerate tickets; the routing event remains the ticket census. [repair B](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-repair-B-order.md:20), [ticket issuance](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:1128), [closed schema](/C:/Users/maxtl/Projects/Claude-Orchestra/registry/schemas/ticket.schema.json:158), [runtime task ID](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/runtime.js:372).

- `orchestra_crossplan` under `roster:new`, and `orchestra_doctor live=true`: omit or return typed `UNSUPPORTED`. Both can invoke an engine without ticket binding, contradicting the literal bound-engine property; leg 6 already expects only the five vertical tools. Cost: cross-compare planning and live nonce diagnosis require legacy mode until separately ticketed. [ungated lanes](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:522), [crossplan handler](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:888), [live doctor](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:1003), [leg-6 tool census](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg6-order.md:22).

- Automatic gate-class closure and `falsification_run` mutation: return `NOT_CLOSED: UNSUPPORTED_GATE_CLASS`. An immutable dispatch envelope cannot contain a future falsification run, and initial WO-15 shadow already excludes security and Principal traffic. Cost: gate-class work cannot close through the bridge during initial shadow. [repair B requirement](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-repair-B-order.md:40), [existing canary deferral](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-session-oracle-verdict.md:61).

YAGNI — KEEP

- The numeric round-trip guard, including exponent/fraction handling. It prevents the installer from silently corrupting unrelated settings values; replacing it with broad `UNSUPPORTED` refusals could block ordinary installs. Freeze it. [risk and implementation](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:1079), [exotic branch](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:1216).

- Ticket-store torn-tail reconciliation and the anomaly sidecar. They protect the write-ahead audit and monotonic sequence around crashes and cross-process hooks; deleting them reopens the already-approved one-use core. Freeze them and add no further hardening. [WAL invariant](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:41), [torn-tail behavior](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:84), [sidecar purpose](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:160).

- Telemetry’s two record types only: casting record and verdict audit. The module is already the minimum gate surface; forbid dashboards or additional products. [telemetry contract](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/telemetry.js:3), [exports](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/telemetry.js:112).

YAGNI — DEFER AS DOCUMENTED LIMIT

- Pin store, path/project-ID/git-root keys, fingerprints, `--verify-pin`, and `--repin`: retain frozen through this gate, claim only receipt/configuration value, and give them no acceptance cases. Physical deletion now would reopen installer, guard, runtime, MCP, uninstall, and large fixture suites. Deletion later costs tamper diagnostics, moved-project discovery, and ownership evidence—not a security boundary. [pin trust stack](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/manifest.js:20), [guard’s receipt-only claim](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:62), [installer commands](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:1927).

- Moved projects and cross-project execution: support only a fixed fresh project root; repair A’s typed `CD_NOT_SUPPORTED` is final for this tranche. Cost: relocate by reinstalling and restarting the host, not `--repin` or cross-project `cd`. [repair A](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-repair-A-order.md:28), [current moved logic](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/manifest.js:68).

- `bridge/cli.js`: MCP and registered hooks are authoritative; do not use or test CLI twins in acceptance. Delete after closure, because removing it now buys no property and causes unit/documentation churn. The installer already calls `createRuntime().initStore()` directly. Cost: eventual loss of the manual offline adapter. [CLI purpose](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/cli.js:3), [installer direct call](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:2428).

- `--grants-local`: exclude it from gate and shadow support; do not repair it. Cost: shared `settings.json` remains the only supported grants destination during shadow. [option](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:21), [branch](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:2751).

- Architect/Sweeper fallback behavior: gate only the typed `DISABLED` result; do not test or rely on `conductor-self-plan` or `verifier-census`. Cost: the owner must explicitly reclassify work for a disabled seat. [dispatch fallbacks](/C:/Users/maxtl/Projects/Claude-Orchestra/router/router.js:1016), [seat-resolution fallbacks](/C:/Users/maxtl/Projects/Claude-Orchestra/router/router.js:1284).

- Builder override-only Sol rungs: exclude `override` orders from initial shadow and return typed `UNSUPPORTED` at intake. Bounded, standard, dense, and deep preferred/substitute behavior remains; only explicit Sol override authoring is deferred. [override schema](/C:/Users/maxtl/Projects/Claude-Orchestra/registry/schemas/dispatch-request.schema.json:19), [override ladder](/C:/Users/maxtl/Projects/Claude-Orchestra/router/router.js:557).

DRY — CONSOLIDATIONS

- Pin/fingerprint implementations: leave them duplicated through this gate. Unifying them would make the static guard require installed project substrate, while removing them is a separate post-close simplification. [guard independence](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:32), [manifest implementation](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/manifest.js:245), [MCP fallback](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:91).

- Glob matcher: leave both copies. The guard must remain a standalone static hook; sharing the verifier copy introduces an installed-project dependency for negligible savings. [guard copy](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:523), [verifier implementation](/C:/Users/maxtl/Projects/Claude-Orchestra/verifier/checkout.js:63).

- Claude and Codex installer merges: leave them. They merge different configuration protocols—Claude event hooks versus Codex-native hooks—and a generic abstraction before the gate adds risk without reducing the vertical path. [Claude merge](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:2670), [Codex merge](/C:/Users/maxtl/Projects/Claude-Orchestra/install-codex.js:358).

- CLI versus MCP: MCP survives as the production adapter; the CLI is deferred deletion and receives no gate credit. [runtime adapter contract](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/runtime.js:5).

- Test fixture builders: leave them independent. Refactoring the 1,027-line bridge suite, 386-line close suite, and 1,287-line MCP suite before creating installed acceptance is worse than localized fixture repetition. [bridge suite end](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/bridge.test.js:1027), [close suite end](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/bridge-close.test.js:386), [MCP suite end](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/mcp-lane.test.js:1287).

- `ledgerDir` and `atomicWriteJson`: repair B should use `bridge/telemetry.js` as the single bridge implementation and delete the copies in `close.js`. The ticket store’s fsynced transactional writer remains separate. [telemetry helpers](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/telemetry.js:45), [close duplicates](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:190).

- Model-family classification: `router.createRouter().familyOf` is the sole implementation; repair B must call it rather than add another model-name classifier. [definition](/C:/Users/maxtl/Projects/Claude-Orchestra/router/router.js:148), [export](/C:/Users/maxtl/Projects/Claude-Orchestra/router/router.js:1366).

KISS — ARCHITECTURE RULING

Keep the two scripts. The guard owns static Director law and verifies exact ticket-gate registration without executing project code; the ticket gate owns mutable ticket/runtime state. Combining them either makes the guard load project substrate or duplicates the ticket state machine. [guard boundary](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:32), [exact registration check](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:1393), [gate adapter](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/hooks/ticket-gate.js:3).

Do not replace runtime activation with hook arguments in this finish tranche. Only the guard currently receives `--roster new`; ticket-gate derives state from the runtime, and the long-lived MCP registration has no roster argument. Changing that now creates a new activation and rollback protocol, particularly for an already-running MCP process. Keep `bridge/manifest.js` through the gate, with its same-user limitation stated plainly. [guard argument](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:1304), [ticket-gate state](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/hooks/ticket-gate.js:46), [MCP registration](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:23).

Repair B’s deterministic task envelope is the KISS closure correlation: write once before issuance, derive by `task_id`, and never search routing JSONL for closure. The existing ticket already carries `task_id`; no ticket/schema widening is necessary. [ticket field](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:1138), [current search to remove](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:150).

ASAP — THE FINISH SEQUENCE

1. Owner checkpoint now—at most 5 coordination/tool calls. Amend the already-approved repair orders only as follows: repair B uses the task-derived envelope without ticket IDs; repair A makes crossplan and live doctor unavailable under `roster:new`; gate-class closure is typed unsupported. Nothing else changes. Owner control is required because A/B were approved with exact files and no mid-round folding. [approval record](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:49), [repair budget law](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-repair-A-order.md:8).

2. Finish repairs A and B under their existing hard 80-call ceilings; no third repair. Merge only if their declared targeted suites are green and B’s production-dispatch tests prove envelope creation precedes issuance. No human checkpoint unless a stopping rule fires.

3. Build leg 6 in at most 30 planning calls, implementation by call 55, verification/report by call 80. Its minimum is four installed scenarios:

   - Fresh real install; exact registered guard/gate commands, installed MCP, initialized store, and the five supported tools.
   - One Anthropic T2 order: Q0 ordering, implementation, Verifier before reviewer, ticketed OpenAI review, replay refusal, authoritative engine result, audited `CLOSED`.
   - One bounded OpenAI implementation followed by an Anthropic reviewer; wrong role/casting/expiry denial; one forged-relay/engine-REVISE case remains durably `NOT_CLOSED`.
   - Rollback with an open ticket: generation bump, invalidation, gate release, and legacy execution.

   Do not duplicate pause/transcript/pin/moved/toggle/ladder matrices already owned by unit suites. [installed spine](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg6-order.md:15), [two directions](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg6-order.md:31), [denials and rollback](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg6-order.md:43).

4. One integrated Sol property review only, at most 40 calls, over the exact post-leg-6 commit including 3R. Permit one correction of at most 40 calls and one targeted recheck of at most 15. Fold the independent Opus perspective into the live gate; do not run a separate pre-live Opus cycle.

5. Live gate with the owner present: at most 10 setup calls, 40 workflow calls, and 40 Opus-audit calls. Run two real installed orders in opposite vendor directions, one unticketed Agent denial, one unticketed raw-engine denial, one ticket replay denial, and rollback with an open ticket. Cut the reserve-exhaustion, reviewer-unavailable, deliberate-REVISE, exhaustive-seat, and exhaustive-tier runs. Preserve transcripts, envelope, ticket ledger, Verifier artifacts, casting records, verdict audit, and engine provenance. `UNKNOWN` is acceptable only for an exact served-model field; the engine family and adapter provenance used for cross-family closure must remain authoritative. [live success paths](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:19), [denials and rollback](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:28), [artefacts](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:15).

The owner has only two planned checkpoints: the immediate three-cut authorization and the live session for readings/MCP approval/final accept-or-stop.

STOPPING RULES

Declare the bridge closed only when the exact installed commit has:

- Green leg-6 installed acceptance in both vendor directions.
- A Sol integrated `APPROVE` with no unresolved MAJOR/CRITICAL after at most one correction.
- Two real live orders reaching audited `CLOSED`, with Q0 and Verifier ordering proven.
- Unticketed Agent/raw-engine and replay attempts denied before engine invocation.
- Rollback invalidating an open ticket and restoring legacy operation.
- A final Opus audit returning `APPROVE` with no MAJOR/CRITICAL.
- No active ticket, no fabricated base/model/family value, and the disposable target restored to legacy. [current gate conditions](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:40).

Stop immediately and hand the tranche to the owner if the same installed-spine failure repeats after the one correction; a new MAJOR/CRITICAL appears after correction or during live audit; either repair requires ticket/schema widening or another production subsystem; an unticketed engine path remains callable; provider/authentication/MCP/host lifecycle is unavailable; or authoritative base, engine family, or provenance requires trusting model-authored text. No live-gate fix cycle is authorized. [existing stop law](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-session-oracle-verdict.md:73).

VERIFICATION / DEVIATIONS / CONCERNS

- Verification: read the ordered records, repair orders, rewritten leg 6, live gate, and the named runtime/install/router/launcher/test surfaces. No suite was run, as ordered.
- Deviation: none.
- Concern: repair B as written is structurally impossible because it demands ticket IDs inside an envelope completed before the fixed ticket API mints those IDs.
- Concern: current MCP tools still expose `orchestra_crossplan` and live doctor without ticket binding.
- Concern: neither the installed acceptance file nor live-canary record exists yet.

STATUS: DONE

CHANGES
- none

VERIFICATION
- `git status -sb` → `## claude/wo14b-bridge`
- `git diff --name-only` → no output; no uncommitted changes
- `git rev-parse --short=12 HEAD` → `60a92416d065`
- `Test-Path tests\bridge-acceptance.test.js; Test-Path roster\wo14b-leg7-canary-record.md` → `False`, `False`
- Test suites → not run (prohibited by the work order)

DEVIATIONS
- none

CONCERNS
- Repair B must replace its impossible pre-issuance ticket-ID envelope with task-derived correlation; new-roster crossplan/live-doctor engine access must be disabled before installed acceptance.

REPORT INTEGRITY: ec5482b072bf8154

TREE AUDIT: no source paths changed while the engine ran.
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token ec5482b072bf8154) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token ec5482b072bf8154, and the report does not contradict the tree audit.
== exit 0 2026-09-01T09:31:07Z ==
