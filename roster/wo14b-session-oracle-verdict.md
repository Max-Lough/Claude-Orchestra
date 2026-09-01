# WO-14b — session scope-oracle verdict (GPT-5.6 Sol · max, read-only; owner-ordered) — 2026-09-01

Order: `roster/wo14b-session-oracle-order.md` (owner: "you are at risk of losing the big picture again"; "Finish the harness, KISS/YAGNI"). `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0. Tree audit clean at `b0e31a0`. Verdict verbatim below.

---

EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol (flag), tier: standard, effort: max, sandbox: workspace-write, timeout: 3000000ms (flag), attempts: 1 (execution is never auto-retried), prohibited commands: 3, tree: directed worktree)
RUN NONCE: 777ee5ea96937577
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 5359ms

STATUS: DONE

VERDICT (on the bridge as it stands)

The activation bridge remains the right work, but current HEAD is not gate-ready and WO-15 must remain unopened. The repository contains the right primitives—installed hooks, ticket capabilities, raw-engine gating, generation invalidation, and staged closure—but they do not compose into the ruled vertical path. Real dispatch records the router outcome before tickets exist, while closure searches that record for ticket IDs; the tests manufacture the missing correlation ([bridge/runtime.js:407](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/runtime.js:407), [bridge/runtime.js:445](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/runtime.js:445), [bridge/close.js:174](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:174), [tests/bridge-close.test.js:89](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/bridge-close.test.js:89)). Close #1 also gives an OpenAI reviewer only `TICKET=`, although the engine requires matching `ticket` and `role`, and its charter does not instruct the launcher to pass either field ([bridge/close.js:316](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:316), [packs/codex/hooks/orchestra-engine-mcp.js:811](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:811), [roster/reviewer-openai.md:27](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/reviewer-openai.md:27)). The now-completed reviews further reproduce false closure from a forged launcher relay and routing/model/expiry bypasses ([roster/wo14b-leg5-review-1.md:21](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg5-review-1.md:21), [roster/wo14b-leg4-review-2.md:23](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg4-review-2.md:23)). The Conductor must stop autonomous scoping and merging now. The owner should retain scope control and authorize only the bounded finish tranche ruled below.

WHAT SERVES THE GOAL / WHAT DOES NOT

- The ticket store’s one-use lifecycle, role binding, engine pass/result, invalidation, and generation bump serve the goal directly. Preserve and freeze that core; leg 2 is approved ([router/tickets.js:1128](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:1128), [router/tickets.js:1365](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:1365), [router/tickets.js:1446](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:1446), [roster/wo14b-activation-bridge-progress.md:30](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:30)).

- Leg 3R’s architecture serves the goal: installer-written `--roster new` selects a static guard path, the guard executes no project code, and it verifies exact host ticket-gate registration ([install.js:1304](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:1304), [hooks/orchestra-guard.js:17](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:17), [hooks/orchestra-guard.js:32](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:32), [hooks/orchestra-guard.js:1391](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:1391)). It remains unreviewed and therefore uncredited ([roster/wo14b-activation-bridge-progress.md:45](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:45)).

- Installer copying, store initialization, four host hooks, MCP dispatch, raw-engine ticket checks, Verifier-before-review, and two-stage closure are all necessary mechanisms ([install.js:2413](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:2413), [install.js:2670](/C:/Users/maxtl/Projects/Claude-Orchestra/install.js:2670), [packs/codex/hooks/orchestra-engine-mcp.js:787](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:787), [bridge/close.js:248](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:248)). Their present implementation is not accepted merely because the concepts are correct.

- The pin/fingerprint stack is instrument-polishing when described as protection from same-user code. `bridge/manifest.js` still presents an out-of-project pin as a trust mechanism, while the leg-3 ruling demoted it to a receipt and the current guard explicitly excludes pins and fingerprints from activation ([bridge/manifest.js:3](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/manifest.js:3), [roster/wo14b-leg3-oracle-verdict.md:51](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-oracle-verdict.md:51), [hooks/orchestra-guard.js:17](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:17)). Do not redesign it again; retain it only for configuration integrity, ownership receipts, and diagnostics, and correct the claims.

- The README’s assertion that only legs 6/7 remain is refuted by current HEAD: leg 4 review #2 and leg 5 review #1 both return `REVISE` with eight MAJOR findings ([bridge/README.md:52](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/README.md:52), [bridge/README.md:74](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/README.md:74), [roster/wo14b-leg4-review-2.md:20](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg4-review-2.md:20), [roster/wo14b-leg5-review-1.md:18](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg5-review-1.md:18)).

- The sixth-round ticket sidecar/torn-tail refinements are now sunk cost, not a reason for further work. Likewise, schema-rich telemetry has no gate value until its model, family, base, and verdict inputs are authoritative ([bridge/README.md:308](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/README.md:308), [roster/wo14b-leg5-review-1.md:21](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg5-review-1.md:21), [roster/wo14b-leg5-review-1.md:29](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg5-review-1.md:29)).

RULING ON THE PATTERN (sprawl, breaches, review cycles)

- The record reaches breach #11 after leg 2’s six reviews, leg 3’s four reviews and four Red-Team passes, and a rewrite that itself exceeded the ceiling ([roster/wo14b-activation-bridge-progress.md:7](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:7), [roster/wo14b-activation-bridge-progress.md:30](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:30), [roster/wo14b-activation-bridge-progress.md:38](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:38), [roster/wo14b-activation-bridge-progress.md:40](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:40), [roster/wo14b-activation-bridge-progress.md:45](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:45)).

- This is not evidence that the bridge is intrinsically infeasible. It is evidence that orders were cut around components and discovered edge cases, reviews were used as iterative design, and integration evidence was postponed. The bridge test stops after Agent resolution; closure tests issue tickets and routing events directly; the MCP closure case manually copies substrates and labels its approval synthetic ([tests/bridge.test.js:183](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/bridge.test.js:183), [tests/bridge.test.js:231](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/bridge.test.js:231), [tests/bridge-close.test.js:89](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/bridge-close.test.js:89), [tests/mcp-lane.test.js:974](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/mcp-lane.test.js:974), [tests/mcp-lane.test.js:1003](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/mcp-lane.test.js:1003)).

- The Conductor must no longer answer review findings with one fix order per leg. The completed leg-4 and leg-5 reviews are one finite defect inventory for two composition repairs, not invitations to cycles #3 and #2 respectively ([roster/wo14b-activation-bridge-progress.md:46](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:46), [roster/wo14b-activation-bridge-progress.md:47](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:47)).

- No further bridge change is merged on component-suite evidence. The installed vertical spine must be the acceptance boundary, and review must cover that spine rather than the latest local delta.

THE SECURITY PROPERTY THE BRIDGE MUST DELIVER — AND MUST NOT CLAIM

- For WO-15, the bridge must provide capability discipline inside a cooperative host: explicit owner activation; a static Director guard; exact host ticket-gate registration; one-use, unexpired, role/casting/generation-bound Agent and raw-engine capabilities; required Q0 ordering; Verifier-before-review; authoritative cross-family closure; and rollback invalidation ([roster/wo14b-leg3-oracle-verdict.md:21](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-oracle-verdict.md:21), [roster/wo14b-leg3-oracle-verdict.md:27](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-oracle-verdict.md:27), [roster/wo14b-activation-bridge-order.md:194](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-order.md:194), [roster/wo14b-activation-bridge-order.md:197](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-order.md:197), [roster/wo14b-activation-bridge-order.md:206](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-order.md:206)).

- It must state plainly that it prevents Director drift and catches accidental or cooperative-path violations. It is not a security boundary against arbitrary same-user processes that can rewrite settings, hooks, runtimes, tickets, pins, or ledgers. More same-user fingerprints, hashes, transcript rules, or files cannot create that boundary ([roster/wo14b-leg3-oracle-verdict.md:49](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-oracle-verdict.md:49), [roster/wo14b-leg3-oracle-verdict.md:53](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-oracle-verdict.md:53)).

- Two more standalone reviews of leg 3R are no longer proportionate. Preserve the required independent Sol and Opus perspectives, but fold them into the single integrated installed-path review cycle below. Another guard-only Red-Team pass would continue the file-shape loop the prior oracle stopped ([roster/wo14b-leg3-oracle-verdict.md:101](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-oracle-verdict.md:101), [roster/wo14b-leg3-oracle-verdict.md:103](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-oracle-verdict.md:103), [roster/wo14b-leg3-redteam-4.md:263](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg3-redteam-4.md:263)).

SHORTEST HONEST PATH TO THE GATE

1. **CUT — freeze the existing leg structure.** Cancel standalone 3R, leg-4, and leg-5 fix/review loops. Do not delete stable code. Treat the two current `REVISE` reports plus the composition defects below as the complete input to two owner-scoped repair orders.

2. **BUILD — one enforcement-composition repair.** Move ticket-gate runtime loading inside its denial wrapper; make trusted legacy authoritative after rollback; reject cross-project `cd` under `roster:new` and defer supporting it; validate arguments before consuming `enginePass`; enforce expiry; constrain model and effort to the ticket casting; and bind only engine-reported nonce/model or `UNKNOWN` ([bridge/hooks/ticket-gate.js:46](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/hooks/ticket-gate.js:46), [packs/codex/hooks/orchestra-engine-mcp.js:167](/C:/Users/maxtl/Projects/Claude-Orchestra/packs/codex/hooks/orchestra-engine-mcp.js:167), [bridge/runtime.js:741](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/runtime.js:741), [router/tickets.js:1376](/C:/Users/maxtl/Projects/Claude-Orchestra/router/tickets.js:1376), [roster/wo14b-leg4-review-2.md:23](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg4-review-2.md:23)). The 3R review inside the integrated cycle must also settle the process-level guard catch, which currently allows on any unexpected exception ([hooks/orchestra-guard.js:1591](/C:/Users/maxtl/Projects/Claude-Orchestra/hooks/orchestra-guard.js:1591)).

3. **BUILD — one dispatch-to-close repair.** Persist one dispatcher-owned envelope containing the canonical order, immutable audit base, risk, ticket IDs, requested/served casting evidence, and routing result; issue no executable capability if that envelope cannot be completed. Close must consume the authoritative Codex `engine_result`, derive family from dispatcher-owned casting, require all Band-C sections, bind each divergent citation to its matching reproduced finding, classify security touches correctly, and remain `NOT_CLOSED` without a real falsification run. Reviewer spawn instructions must carry `TICKET`, `MODEL`, `EFFORT`, and `ROLE`, and the OpenAI reviewer must pass the ticket and role to its sole tool ([bridge/runtime.js:407](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/runtime.js:407), [bridge/close.js:152](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:152), [bridge/close.js:372](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:372), [bridge/close.js:450](/C:/Users/maxtl/Projects/Claude-Orchestra/bridge/close.js:450), [registry/schemas/verdict-audit.schema.json:49](/C:/Users/maxtl/Projects/Claude-Orchestra/registry/schemas/verdict-audit.schema.json:49), [roster/wo14b-leg5-review-1.md:21](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg5-review-1.md:21)).

4. **BUILD — a reduced leg 6 installed vertical-spine suite.** Run the real installer into a fresh repository and drive the installed MCP server and registered hooks. It must cover census/tool listing, guard-plus-gate composition, dispatch and Q0 ordering, both vendor directions with stub engines, unticketed Agent/raw-engine denial, every reproduced repair above, Verifier-before-review, authoritative audited closure, and rollback invalidation. Keep existing unit suites required and green, but do not duplicate their full ladder/toggle/retirement matrices in a new 19-case framework. The ordered acceptance file does not yet exist, and current closure fixtures synthesize the state that production must create ([roster/wo14b-leg6-order.md:14](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg6-order.md:14), [roster/wo14b-leg6-order.md:25](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg6-order.md:25), [tests/mcp-lane.test.js:1014](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/mcp-lane.test.js:1014), [tests/mcp-lane.test.js:1051](/C:/Users/maxtl/Projects/Claude-Orchestra/tests/mcp-lane.test.js:1051)).

5. **DEFER-AS-CANARY — breadth that is not required to prove the spine.** Defer cross-project `cd`, automatic gate-class closure, reserve-exhaustion/reviewer-unavailable exercises, deliberate-REVISE traffic, and exhaustive installed permutations. Gate-class work must be correctly classified and fail closed until a real falsification run exists; initial WO-15 shadow traffic is restricted to non-security, non-Principal work. Pin/fingerprint simplification, dashboards, richer telemetry, and further ticket-log hardening are not bridge-closing work.

6. **BUILD — the irreducible live gate.** From a fresh installed session, run one real Anthropic-authored order through an OpenAI Q0/reviewer, one real OpenAI-authored order through an Anthropic reviewer, unticketed Agent/raw-engine denials, and rollback with an open ticket. Preserve transcripts, actual engine/host identities, routing envelopes, Verifier artifacts, verdict audits, and final ticket states; use `UNKNOWN` rather than inventing a value. Authentication, MCP approval, host lifecycle, or provider unavailability returns `BLOCKED`, never a synthetic substitute ([roster/wo14b-leg7-order.md:3](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:3), [roster/wo14b-leg7-order.md:19](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:19), [roster/wo14b-leg7-order.md:25](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:25), [roster/wo14b-leg7-order.md:28](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:28), [roster/wo14b-leg7-order.md:35](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:35), [roster/wo14b-leg7-order.md:47](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-leg7-order.md:47)).

BRIGHT-LINE STOPPING RULES FOR THE REST OF THE BRIDGE

- No new builder starts until the owner approves the two finite repair orders and their exact files. The Conductor may execute that scope; it may not enlarge it.

- Each repair order owns one composition property, plans at most 40 tool calls, ends implementation by call 60, and reserves calls 61–80 only for verification and reporting. Call 80 is an externally enforced `CHECKPOINT`. No finding discovered mid-round is folded into the active order.

- A repair may not add a trust layer, fingerprint family, pin key, transcript heuristic, generic transaction framework, new telemetry product, cross-project runner, seat, model lane, or schema unrelated to the authoritative vertical path.

- Exactly one integrated code-review cycle remains: one fresh Sol property review and one independent Opus adversarial review over the same post-repair installed-acceptance commit, including leg 3R. One finite correction and targeted recheck of already-listed findings is allowed. No second integrated correction cycle is authorized.

- Stop to the owner immediately if the same installed-spine failure repeats after one correction; either reviewer finds a new MAJOR/CRITICAL class after the correction; a repair needs a third production subsystem beyond its named envelope; or real engine identity/family cannot be established without trusting model-authored text.

- Tell the owner that the bridge cannot close in its current shape if the two bounded repairs cannot make one installed synthetic spine close lawfully in both directions, or if the subsequent live run requires a fabricated model/family/base value. Restore the disposable target to legacy and do not redesign in place.

- The final live-canary audit may approve or stop; it may not open another fix cycle. Any code-level MAJOR/CRITICAL found there returns the bridge to the owner as unable to close under this tranche.

- What must not happen next: no full leg-6 framework before the composition repairs; no standalone fifth guard hunt; no response to the reviews by polishing pins, JSONL, schemas, or telemetry first; no component-suite green reported as installed proof; no increased call ceiling; no synthetic live success; no same-user security-boundary claim; and no WO-15 credit before the reduced gate passes.

VERIFICATION / DEVIATIONS / CONCERNS

- Verification: read the ordered record and current bridge/runtime/install/router/test surfaces; no suites were run, as ordered. Final read-only checks show clean branch `claude/wo14b-bridge` at `b0e31a06f818`; both `tests/bridge-acceptance.test.js` and `roster/wo14b-leg7-canary-record.md` are absent.

- Deviation: the work order described leg-4 review #2 and leg-5 review #1 as running. Both completed and were committed during this audit, so the current verdict incorporates their latest `REVISE` records ([roster/wo14b-activation-bridge-progress.md:46](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:46), [roster/wo14b-activation-bridge-progress.md:47](/C:/Users/maxtl/Projects/Claude-Orchestra/roster/wo14b-activation-bridge-progress.md:47)).

- Concern: those reviews are pinned to the pre-3R integration commit. Current changes after that point affect guard/installer/tests and review records, not the central runtime/close/MCP/ticket defects; 3R itself still requires the integrated property and adversarial review.

STATUS: DONE

CHANGES
- none

VERIFICATION
- `git diff --name-only` → no output; no uncommitted changes
- `git status -sb` → `## claude/wo14b-bridge`
- `git rev-parse --short=12 HEAD` → `b0e31a06f818`
- `Test-Path tests\bridge-acceptance.test.js` → `False`
- `Test-Path roster\wo14b-leg7-canary-record.md` → `False`
- Test suites → not run (prohibited by the work order)

DEVIATIONS
- The two reviews described as running completed during the audit; their current committed verdicts were read and incorporated. No files were changed.

CONCERNS
- Current HEAD retains unresolved false-close, fail-closed startup, expiry, casting, provenance, and dispatch-to-close composition defects; leg 3R is unreviewed, and neither installed acceptance nor live-canary evidence exists.

REPORT INTEGRITY: 777ee5ea96937577

TREE AUDIT: 2 path(s) changed while the engine ran (2 shown):
  left the dirty set: roster/wo14b-session-oracle-order.md
  left the dirty set: tests/guard.test.js
  HEAD moved: da4ad3ee6f93 → b0e31a06f818 — the engine made commit(s); paths those commits cleaned from the dirty set may show above as "left the dirty set".
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token 777ee5ea96937577) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token 777ee5ea96937577, and the report does not contradict the tree audit.
== exit 0 2026-09-01T08:52:45Z ==
