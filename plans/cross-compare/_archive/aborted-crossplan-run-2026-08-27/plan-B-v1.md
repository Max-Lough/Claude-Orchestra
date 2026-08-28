# Plan: Capability Contracts with Author-Aware Gates
## Summary

The proposed architecture replaces a fixed model hierarchy with nineteen stable, runtime-neutral role contracts and a versioned casting registry. Tasks are routed first by dominant risk and work shape, then by capability, cost, context, and provider availability. The hierarchy is shallow: an Operations Director dispatches primary roles; only four lead roles may create bounded level-two scout, test, or verification shards; reviewers are always dispatched independently of authors.

Three vendors are used deliberately rather than symmetrically. Anthropic models carry calibrated dispatch, repository judgment, difficult diagnosis, and the highest-coherence coding seats. OpenAI models carry cheap lookup, deep research, terminal/operations, and defensive-security seats. Google Gemini supplies a cost-effective visual/UI implementation lane and a third-family arbitration lane. These are initial casts, not permanent ranks: every cast has an expiry date, a fallback, and a harness-native evaluation gate.

The non-negotiable invariant is artifact lineage. Every model-produced artifact records its actual provider family, model id, snapshot, and effort. A model never reviews its own artifact. Every substantive artifact receives a fresh-context reviewer from another provider family; critical artifacts receive both non-author families in parallel, with deterministic evidence first and human adjudication for unresolved disagreement. Low-risk lookups and raw test relays may omit model review only because paths, hashes, exit codes, or other deterministic checks establish the result.

Current prices and availability are volatile. Cost estimates below are dated **2026-08-27**, use current standard API rates (including declared promotions), and expose the token envelopes and post-promotion sensitivity. They exclude tool-call fees, test infrastructure, and human review.

## Approach

### 1. Design principles

1. **Roles describe responsibility; casts describe replaceable supply.** A role owns a disjoint task class, tool policy, result contract, escalation law, and review rule. Provider, model id, snapshot, effort, price, context limits, and fallback belong in a separately versioned casting registry. This keeps the architecture portable to another runtime and makes model refreshes data changes rather than organizational redesigns.

2. **Classify by the dominant failure risk, not by file count or prestige.** Security overrides language, data-loss risk overrides “routine migration,” causal investigation overrides implementation, and image/geometry-as-source-of-truth overrides generic coding. Mixed requests are decomposed until every work packet has one class and one primary role. This makes assignment deterministic.

3. **The cheapest model is used only after the task is made cheap-model-shaped.** Cheap seats receive bounded context, explicit deliverables, deterministic done conditions, and no authority to recover from ambiguity by redesigning. Premium spend is load-bearing for unresolved architecture, causal tracing, cross-subsystem coherence, visual-spatial reconstruction, data risk, security, and closing review.

4. **Effort is a measured rung, not an adjective in a prompt.** Start at the role’s stated effort. Raise effort only when a representative evaluation or an objective stall signal justifies it. A context miss, wrong task class, missing tool, or provider refusal is rerouted, not “thought through harder.” OpenAI’s current guidance likewise recommends medium as a balanced start and high/xhigh only where measured gains justify them ([official model guidance](https://developers.openai.com/api/docs/guides/latest-model)).

5. **Authorship and evaluation are separate trust domains.** The routing ledger checks both requested and actual provider family, including silent fallbacks. Review prompts are blind to model name and price, but the router retains lineage so it can select an eligible reviewer. A reviewer never fixes the artifact it judges.

6. **Deterministic evidence precedes model judgment.** Builds, tests, schema validation, migration dry-runs, profilers, security scanners, geometry checks, screenshots at named viewports, and artifact hashes run before a model reviewer. Model judgment is reserved for semantics, architecture, maintainability, visual coherence, and ambiguous intent.

7. **Escalate by failure signature and stop grinding.** Two materially similar failed fix/verify cycles, non-improving tests, an unplanned third subsystem, a repeated invented API, or a classifier fallback ends the rung. The next route is selected by the observed failure shape; a third materially identical attempt is forbidden.

8. **Telemetry changes policy; benchmarks only seed it.** The harness records accepted-result cost, wall time, attempts, tool calls, deterministic results, reviewer findings, human intervention, actual model/snapshot, and prompt version. A cast remains primary only while project traces support it.

#### Evidence baseline and adjudication

The evidence hierarchy is: current first-party availability and pricing; independent task-shaped evaluations; repository behavior and history; then practitioner reports for failure-mode hypotheses. Vendor launch scores are not compared across different harnesses as though they were one leaderboard.

- OpenAI’s current catalog verifies `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`, their 1.05M context windows, their effort range, and current prices of $4/$20, $2/$12, and $0.20/$1.20 per input/output MTok ([official comparison](https://developers.openai.com/api/docs/models/compare)). The Sol price is promotional through at least 2026-11-21; the durable list price is $5/$30. The OpenAI report’s terminal, research, overreach, and integrity findings remain useful (`research/openai-models.md:82-175`, `:231-269`), but its own source note says direct official fetches were unavailable (`:17-25`, `:618-619`), so current first-party pages govern price and availability.
- Anthropic’s current documentation verifies `claude-fable-5`, `claude-opus-5`, `claude-sonnet-5`, and `claude-haiku-4-5-20251001`; prices of $10/$50, $5/$25, $2/$10, and $1/$5; and context/effort limits ([official model overview](https://platform.claude.com/docs/en/models/overview), [official selection guidance](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)). The dossier’s task-shaped distinction—Opus for diagnosis and orchestration, Fable for ceiling work, Sonnet for volume implementation—is adopted (`research/dossier_both.md:242-346`).
- The reports disagree on OpenAI long-context evidence: the dossier gives MRCR point estimates and a Luna cliff (`research/dossier_both.md:122-130`, `:222-238`), while the OpenAI report lists MRCR among unavailable GPT-5.6 measurements (`research/openai-models.md:610-615`). The exact scores are therefore rejected. A conservative Luna packet cap is retained as an **assumption to test**, not as a proven benchmark fact.
- The reports disagree on a universal flagship: Fable leads the cited repo-scale/merge-bar work, Sol leads terminal and tool-loop work, and Opus leads the cited bug/performance investigation (`research/dossier_both.md:97-118`). The proposal does not average those scores; it assigns different primary roles by task shape.
- The reports contain no completed Gemini study. Live evidence fills that gap: Google documents the GA `gemini-3.7-flash` as a coding/agentic model with spatial/multimodal reasoning and design adherence, at $0.75/$3.75 through 2026-12-31 and $1.50/$7.50 afterward ([official Gemini 3.7 guide](https://ai.google.dev/gemini-api/docs/latest-model)). Artificial Analysis independently reports high effort at index 56, about 338 output tokens/s, and $0.40 per index task at the promotional rate ([independent evaluation](https://artificialanalysis.ai/articles/gemini-3-7-time-frontier)). This supports a canary UI/visual seat and third-family arbitration, not a claim that Gemini is universally superior.
- The current tree is a fixed company with Haiku scout, Opus detective/reviewer/heavy executor, Sonnet executor, and optional OpenAI launchers (`ORCHESTRA.md:15-47`). The installed project has the `codex` pack but no specialist (`.claude/orchestra-install.json:1-7`). The new architecture preserves the proven integrity, checkpoint, and verification mechanics while replacing fixed role-to-provider coupling.

### 2. Role catalog

The task-class ids referenced below are defined uniquely in the routing table. “Opposition Reviewer” always means the author-aware cast matrix in Role 18, not a fixed model.

#### Role 1 — Operations Director

- **Purpose:** Own intake, classification, budgets, DAG state, approval boundaries, and user communication without producing or reviewing project artifacts.
- **Casting:** `claude-opus-5`, **medium effort**. Official guidance positions Opus 5 for complex agentic coding and enterprise work; the dossier identifies predictable judgment and lower irreversible-action risk as its director advantage (`research/dossier_both.md:279-313`). Medium is deliberately below the provider default of high because this seat routes more than it solves.
- **Tool surface:** task ledger, provider/cost registry, agent dispatch and cancellation, result ingestion, approval requests, and user communication. No repository search, shell, editor, deployment, or review tools.
- **Demonstrated strengths:** decomposition, calibrated pushback, multi-agent coordination, and evidence-aware decisions.
- **Weaknesses and characteristic failure modes:** over-engineering, argumentativeness, excessive thinking on short tasks, same-family blind spots, and a tendency to turn procedural arbitration into substantive judgment.
- **Owns:** P0 intake/dispatch and Q0 unknown-class triage.
- **Must not receive:** architecture (Role 2), recon (Roles 3–4), implementation (Roles 5–17), review (Role 18), or contested technical arbitration (Role 19).
- **Escalation in/out:** receives user goals and all result packets; routes ambiguity to Role 2, missing facts to Roles 3–4, observed failures to the task-shaped specialist, and irreversible decisions to a human.
- **Review:** high-risk DAGs and director-authored execution plans are reviewed by Role 18 using `gpt-5.6-sol` high; final reports are mechanically checked against accepted artifacts and verification records.

#### Role 2 — Systems Architect

- **Purpose:** Convert ambiguous, cross-subsystem goals into architecture, invariants, interfaces, acceptance criteria, and a reviewable work DAG.
- **Casting:** `claude-fable-5`, **high effort**. Anthropic identifies Fable as its highest-capability long-running/deep-reasoning model, while the independent dossier reserves it for the hardest coding and “senior researcher must figure it out” work (`research/dossier_both.md:242-275`).
- **Tool surface:** read-only repository and document retrieval, diagram/spec authoring, dependency graphing, and cost-estimation tools. No source edits, builds, deployments, or child implementation.
- **Strengths:** global coherence, long-horizon reasoning, hard architecture, visual understanding, and few-shot synthesis across large contexts.
- **Weaknesses/failure modes:** $10/$50 pricing, slower and variable latency, always-on adaptive thinking, overkill on bounded work, safety-classifier fallback in some dual-use domains, and 30-day-retention constraints for Fable traffic.
- **Owns:** P1 architecture and decomposition.
- **Must not receive:** routine edits (Role 5), terminal execution (Role 6), defensive security implementation (Role 14), or closing review (Role 18).
- **Escalation in/out:** receives Q0 tasks whose framing remains ambiguous after one short director probe; emits separate task packets. If two viable architectures remain evidence-balanced, requests independent spikes or Role 19 rather than choosing by rhetoric.
- **Review:** Role 18 cast as `gpt-5.6-sol` high. Critical architecture also receives `gemini-3.7-flash` high; unresolved disagreement is human-owned.

#### Role 3 — Scout / Locator

- **Purpose:** Answer bounded where/what/list/fetch/find questions with dense path, line, URL, or commit evidence.
- **Casting:** `gpt-5.6-luna`, **low effort**; `claude-haiku-4-5-20251001` is the cache-local fallback. Luna’s official $0.20/$1.20 price makes it the cheapest available high-volume seat, and the reports consistently restrict it to explicit, verifiable work (`research/openai-models.md:385-454`).
- **Tool surface:** read, glob, grep, symbol index, read-only git history, safe HTTP GET/search, and token counter. No edits, builds, package installs, or causal debugger.
- **Strengths:** speed, low cost, parallel enumeration, structured extraction, and current-enough knowledge when paired with retrieval.
- **Weaknesses/failure modes:** ambiguity collapse, weak recovery, plausible causal guesses, and unverified long-context recall. Input packets are capped at **64K tokens initially**; this cap is an assumption pending harness evaluation.
- **Owns:** R0 simple fetch/find/lookup and repository mapping.
- **Must not receive:** RCA (Role 7), long-document synthesis (Role 4), architectural judgment (Role 2), or implementation.
- **Escalation in/out:** one re-probe is allowed for a missing fact; a surviving material unknown goes to Role 4 for external evidence or Role 7 for causal code investigation.
- **Review:** low-risk output is validated by opening the cited path/URL or checking the enumerated count. Decision-critical maps are independently sampled by the receiving role; the Scout never validates its own enumeration.

#### Role 4 — Deep Researcher

- **Purpose:** Conduct multi-source web/document investigation and return a cited evidence map, contradiction analysis, and bounded conclusions.
- **Casting:** `gpt-5.6-sol`, **medium effort**. The report’s BrowseComp and token-efficiency evidence supports research-agent use (`research/openai-models.md:105-128`, `:263-265`); medium is used before high because current OpenAI guidance says it is a balanced starting point.
- **Tool surface:** web search/fetch/browser, PDF/document readers, read-only repository access when relevant, citation capture, and structured note reduction. No edits or external writes.
- **Strengths:** persistent browsing, broad source discovery, long tool loops, and synthesis over large retrieved sets.
- **Weaknesses/failure modes:** fabricated research, specification gaming, over-collection, unrequested expansion, and confident synthesis across incompatible evidence. Every material claim must cite a retrieved source; source absence is `UNKNOWN`.
- **Owns:** R1 deep external research and multi-document evidence synthesis.
- **Must not receive:** simple lookup (Role 3), causal runtime debugging (Role 7), architecture (Role 2), or implementation.
- **Escalation in/out:** Scout maps sources first when discovery is separable; high effort is allowed only after a documented source conflict or failed medium pass. Domain-critical conclusions route to the matching specialist or a human.
- **Review:** decision-critical reports receive Role 18 cast as `claude-opus-5` high; ordinary evidence collections are sampled against citations by the consumer.

#### Role 5 — Routine Engineer

- **Purpose:** Implement well-specified, reversible, convention-following changes that fit one subsystem and have objective tests.
- **Casting:** `claude-sonnet-5`, **medium effort**. Official pricing is $2/$10; provider guidance positions it for code generation and agentic tool use, and the dossier calls it the volume brownfield worker (`research/dossier_both.md:317-346`).
- **Tool surface:** repository read/write, patching, shell, build/test/lint, and one warm follow-up context. No delegation, deployment, or self-approval.
- **Strengths:** brownfield style matching, multi-file follow-through, test repair, and productionizing a clear design.
- **Weaknesses/failure modes:** stalls on ceiling tasks, may encode a flawed specification faithfully, lacks strategic authority, and its tokenizer can raise task cost despite lower list rates.
- **Owns:** C0 routine coding.
- **Must not receive:** unresolved architecture (Role 2), split-resistant multi-subsystem work or novel algorithms (Role 8), data-risky migration (Role 11), or security-critical changes (Role 14).
- **Escalation in/out:** accepts only packets with named acceptance tests. Two similar failures, a third subsystem, or an interface contradiction routes to Role 7 for diagnosis or Role 8 for hard implementation.
- **Review:** Role 18 cast as `gpt-5.6-sol` high for substantive code; inert-only changes may use the low-risk OpenAI reviewer cast.

#### Role 6 — Terminal / Operations Engineer

- **Purpose:** Own shell-heavy environment diagnosis, CI archaeology, build systems, package/toolchain operations, and reversible release mechanics.
- **Casting:** `gpt-5.6-sol`, **high effort**. The three reports consistently place Sol first for terminal/test-loop work; cited Terminal-Bench results are the most directly shaped evidence (`research/openai-models.md:80-112`; `research/dossier_both.md:99-118`).
- **Tool surface:** terminal, process control, package managers, containers, CI logs, filesystem inspection, and repository patching when the task requires it. Network writes, credentials, destructive commands, and production actions require explicit human approval.
- **Strengths:** long command loops, environment persistence, build/test iteration, and recovery from messy tool output.
- **Weaknesses/failure modes:** over-agency, scope creep, reward hacking, unauthorized cleanup, concurrency defects, and cyber-safeguard false positives. Tamper-evident command logs and tree audits are mandatory.
- **Owns:** C1 terminal/shell/CI/environment work.
- **Must not receive:** business architecture (Role 2), visual judgment (Roles 9–10), data migration design (Role 11), or its own review.
- **Escalation in/out:** receives shell-shaped failures from any role; novel code cores go to Role 8, causal application bugs to Role 7, and production irreversibility to a human.
- **Review:** Role 18 cast as `claude-opus-5` high; external-state changes also require human approval and an independently observed postcondition.

#### Role 7 — Diagnostic Engineer

- **Purpose:** Establish a causal, evidence-chained root cause for intricate, confusing, intermittent, or cross-subsystem failures before a fix is authorized.
- **Casting:** `claude-opus-5`, **high effort**. The dossier identifies Opus as the repo-scale RCA and bug/performance-investigation specialist (`research/dossier_both.md:101-118`, `:281-313`).
- **Tool surface:** read/search, debugger, profiler, trace/log capture, test runner, and ephemeral instrumentation in an isolated worktree. It may not commit a production fix; its deliverable is the RCA, discriminating experiment, and minimal fix contract.
- **Strengths:** hypothesis discrimination, invariant discovery, performance/bug investigation, and pushback on superficial fixes.
- **Weaknesses/failure modes:** compelling but unproven narratives, over-engineered diagnostic tooling, argumentativeness, and spending too long on one theory.
- **Owns:** C3 intricate/confusing bug tracing.
- **Must not receive:** broad enumeration (Role 3), external research (Role 4), permanent implementation (Role 5 or 8), or final performance optimization (Role 13).
- **Escalation in/out:** receives one scoped question plus the Scout map. It must state `CONFIRMED`, `LIKELY`, or `UNCERTAIN`; an unresolved experiment becomes a Role 6 or Role 16 probe, and the proven fix routes by implementation class.
- **Review:** decision-bearing RCA is reviewed by Role 18 cast as `gpt-5.6-sol` high against raw traces; deterministic repro results are rerun independently.

#### Role 8 — Principal Engineer

- **Purpose:** Implement algorithmically novel, split-resistant, long-horizon, or repository-scale work where global coherence is worth frontier cost.
- **Casting:** `claude-fable-5`, **high effort**, with xhigh allowed only by a predeclared ceiling gate. Repo-scale and one-shot evidence favors the Fable/Opus line over Sol in the supplied studies (`research/openai-models.md:132-147`; `research/dossier_both.md:97-118`).
- **Tool surface:** full repository edit/build/test tools, isolated worktrees, checkpoint commits, and up to four level-two Scout/Test/Verification children. No deployment or self-review.
- **Strengths:** long-run coherence, hard coding, large refactors, novel algorithms, and interface preservation across subsystems.
- **Weaknesses/failure modes:** high cost/latency, over-engineering, classifier disruption, excessive autonomy, and a tendency to absorb work that should have been decomposed.
- **Owns:** C2 complex long-horizon coding and C4 refactoring at scale.
- **Must not receive:** routine implementation (Role 5), shell-only work (Role 6), security work (Role 14), or visual reconstruction whose acceptance is primarily spatial (Role 9).
- **Escalation in/out:** entered directly when risk is visible at plan time or after two default-tier failures with the case file attached. A second failed premium cycle stops for re-architecture or human decision; it never escalates by silently adding more scope.
- **Review:** Role 18 cast as `gpt-5.6-sol` high; critical concurrency/public-API work adds `gemini-3.7-flash` high and human arbitration on disagreement.

#### Role 9 — Visual-Spatial Engineer

- **Purpose:** Solve tasks where constructing a coherent spatial/visual model from images, renders, diagrams, or geometry and implementing code from that model are both load-bearing.
- **Casting:** `claude-fable-5`, **high effort**. The supplied reports single out Fable for global spatial reconstruction and visual coherence (`research/cross_vendor_agent_harness_roster_summary.md:215-261`), while official guidance confirms vision input and highest-capability positioning.
- **Tool surface:** image/video/PDF input, browser/render capture, Blender/CAD/game-engine scripting, repository edits, geometry/statistics validators, and up to four visual-triage or verification shards.
- **Strengths:** multi-reference spatial reconstruction, global proportions, visual debugging, and code that embodies a geometric model.
- **Weaknesses/failure modes:** subjective overconfidence, visually plausible but mechanically invalid output, slow iteration, high cost, and architecture expansion beyond the requested asset/system.
- **Owns:** V0 visual/spatial interpretation paired with coding, including 3D/procedural visual systems when geometry is the source of truth.
- **Must not receive:** mock-to-UI implementation with a defined layout (Role 10), batch render classification (Role 16), or generic code lacking a spatial acceptance criterion (Roles 5/8).
- **Escalation in/out:** ambiguous frames are resolved through explicit additional views or human reference choice, not invented detail. Productionization may hand off to Role 5 after the spatial contract is frozen.
- **Review:** Role 18 cast as `gemini-3.7-flash` high for independent spatial/design inspection plus deterministic geometry/import checks; consequential historical or brand judgments require a human.

#### Role 10 — UI Systems Engineer

- **Purpose:** Implement frontend/UI systems from explicit mocks or product constraints through a code→render→inspect→repair loop.
- **Casting:** `gemini-3.7-flash`, **high effort** for the initial canary; medium becomes the default only if project evals show non-inferiority. Google names coding, spatial/multimodal reasoning, multi-step workflows, and design adherence as primary uses, and the independent evaluation places the model on cost/time frontiers.
- **Tool surface:** repository edits, browser/computer use, screenshots at named desktop/mobile widths, accessibility scanners, visual-diff tools, and frontend tests. No backend architecture or production deployment.
- **Strengths:** rapid visual coding loops, mock adherence, multimodal input, high speed, and very low current cost.
- **Weaknesses/failure modes:** the model is new, provider claims may not transfer to this harness, promotional economics expire, output is capped at 64K, computer use remains tool-dependent, and appearance can outrun accessibility or state correctness.
- **Owns:** V1 frontend/UI/mock-to-code and interactive visual-system implementation.
- **Must not receive:** open-ended spatial reconstruction (Role 9), backend/data architecture (Roles 2/11), or brand sign-off.
- **Escalation in/out:** unclear visual intent goes to Role 9 or a human; repeated logic failures go to Role 7/8; promo expiry triggers a recost, not an automatic recast.
- **Review:** Role 18 cast as `claude-opus-5` high, with deterministic accessibility, responsive screenshot, and interaction tests.

#### Role 11 — Data and Migration Engineer

- **Purpose:** Own schema evolution, ETL/data-shape work, migration safety, compatibility windows, backfill design, and rollback evidence.
- **Casting:** `claude-opus-5`, **high effort**. This is intentional premium spend: migration failures are often irreversible, cross-subsystem, and expensive to discover in review. Opus is used for its complex-systems judgment, not token price.
- **Tool surface:** schema/database readers, migration and query tools against disposable copies, repository edits, data validators, backup/restore rehearsal, and performance measurement. Production credentials/actions remain human-gated.
- **Strengths:** invariant reasoning, careful side-effect handling, multi-system compatibility, and rollback planning.
- **Weaknesses/failure modes:** over-designed abstractions, migration plans that assume production distributions, excessive confidence after a toy dry-run, and slower throughput.
- **Owns:** D0 data/schema/ETL and D1 data-risky migration.
- **Must not receive:** generic feature code (Role 5), shell plumbing without data semantics (Role 6), or security review (Role 14).
- **Escalation in/out:** D1 is critical on entry. Missing production-shape data blocks the task; it does not guess. Irreversible cutover requires backup proof, rollback rehearsal, two cross-vendor reviews, and human approval.
- **Review:** Role 18 primary `gpt-5.6-sol` high and secondary `gemini-3.7-flash` high; deterministic row counts, checksums, compatibility tests, and restore timing precede both.

#### Role 12 — Independent Test Engineer

- **Purpose:** Design tests from requirements, risks, and externally observable behavior without inheriting the implementation author’s provider-family blind spots.
- **Casting:** author-aware: Anthropic-authored implementation → `gpt-5.6-terra` medium; OpenAI-authored → `claude-sonnet-5` medium; Google-authored or unknown → `claude-sonnet-5` medium. Terra and Sonnet are similarly priced workhorses; the provider switch is more important than a small benchmark delta.
- **Tool surface:** read-only implementation access until test design is fixed, test-file edits, test runner, coverage/mutation tools, fixtures, and hidden-test store. It may not edit production code.
- **Strengths:** independent failure hypotheses, boundary/error-path coverage, scalable test authoring, and executable acceptance criteria.
- **Weaknesses/failure modes:** tests can mirror specification omissions, overfit current behavior, assert implementation details, or create brittle fixture cathedrals. A different vendor is not independence from a bad requirement.
- **Owns:** T0 test authoring.
- **Must not receive:** implementation, final review, or raw test execution-only work (Role 16).
- **Escalation in/out:** missing observable behavior goes to Role 2 or a human; inability to kill seeded mutants triggers higher effort once, then Role 18 review of the test design.
- **Review:** tests are reviewed as part of the artifact gate by a provider different from both implementation and test author when possible; mutation results and hidden tests provide deterministic evidence.

#### Role 13 — Performance Engineer

- **Purpose:** Measure, explain, and improve latency, throughput, memory, or resource cost against a reproducible baseline and regression budget.
- **Casting:** `claude-opus-5`, **high effort**, based on the supplied Senior SWE-bench bug/performance-investigation evidence (`research/dossier_both.md:106-118`, `:285-304`).
- **Tool surface:** profilers, tracing, benchmarks, load generators in safe environments, repository edits, statistical comparison, and system metrics. No production load test without human approval.
- **Strengths:** cross-layer diagnosis, instrumentation design, and resistance to cosmetic micro-optimizations.
- **Weaknesses/failure modes:** benchmark gaming, optimizing noise, trading maintainability for an unimportant percentile, and overbuilding observability.
- **Owns:** P2 performance/profiling/optimization.
- **Must not receive:** generic debugging without a measured performance symptom (Role 7), infrastructure-only tuning (Role 6), or architecture without baseline evidence (Role 2).
- **Escalation in/out:** no baseline or noisy variance blocks optimization. Algorithmically novel kernels may route to Role 8; environment bottlenecks route to Role 6.
- **Review:** Role 18 cast as `gpt-5.6-sol` high; reviewer reruns the benchmark and checks correctness before accepting speedup.

#### Role 14 — Defensive Security Engineer

- **Purpose:** Perform authorized threat modeling, vulnerability review, secure patching, dependency/security configuration, and defensive validation.
- **Casting:** `gpt-5.6-sol`, **high effort**. The supplied evidence identifies Sol as the strongest generally available defensive-cyber seat and warns that smaller tiers fall sharply (`research/dossier_both.md:122-130`, `:156-175`).
- **Tool surface:** read/write repository, SAST/DAST/dependency scanners, sandboxed exploit reproduction only when authorized, tests, secret scanning, and threat-model templates. No offensive targeting, credential use, external exploitation, or production action.
- **Strengths:** adversarial discovery, terminal persistence, secure repair loops, and broad attack-surface search.
- **Weaknesses/failure modes:** overreach, policy refusals/false positives, exploit-shaped tunnel vision, speculative findings, reward hacking, and the family’s documented concurrency weakness.
- **Owns:** S0 defensive security review and patching.
- **Must not receive:** offensive operations, unrelated routine code, compliance/legal sign-off, or its own security review.
- **Escalation in/out:** uncertainty about authorization blocks and goes to a human. Critical auth, cryptography, sandbox escape, or secret-exposure findings are critical on entry and cannot be downgraded by model consensus.
- **Review:** Role 18 primary `claude-opus-5` high, secondary `gemini-3.7-flash` high, plus human adjudication for critical findings; deterministic scanners and reproductions are rerun independently.

#### Role 15 — Documentation Engineer

- **Purpose:** Produce source-grounded technical documentation, migration guides, API references, changelogs, and decision records aligned with actual behavior.
- **Casting:** `claude-sonnet-5`, **medium effort**. It is the affordable Anthropic workhorse with stronger prose/task follow-through than the cheap locator tiers; $2/$10 makes documentation volume economical.
- **Tool surface:** read/search, docs editor, link/API-schema checker, examples/tests, and screenshot capture. No source behavior changes.
- **Strengths:** coherent explanatory structure, repository style matching, and turning accepted design into maintainable guidance.
- **Weaknesses/failure modes:** polished unsupported claims, stale examples, documenting intent rather than behavior, and accidental API commitments.
- **Owns:** W0 documentation and knowledge artifacts.
- **Must not receive:** architecture decisions (Role 2), behavior-bearing code changes (Role 5), or legal/compliance approval.
- **Escalation in/out:** every factual claim must point to source, test, or accepted decision. Missing truth becomes an open question, not invented prose.
- **Review:** inert docs use Role 18’s cheap OpenAI cast (`gpt-5.6-luna` low) plus link/example checks; meaning-bearing API/security/migration docs use `gpt-5.6-sol` high.

#### Role 16 — Verification Runner

- **Purpose:** Execute declared deterministic checks and relay raw, tamper-evident results without semantic approval.
- **Casting:** `gpt-5.6-luna`, **low effort**, because the role is a command orchestrator and evidence relay, not a judge.
- **Tool surface:** allowlisted test/build/lint/scanner commands, process polling, log capture, hashes, timing, and artifact upload. No source edits, command substitution outside the allowlist, or verdict language.
- **Strengths:** very low cost, high parallelism, repetitive execution, and structured evidence capture.
- **Weaknesses/failure modes:** cannot judge whether tests are sufficient, may mis-summarize logs, and can hide a nonzero exit if allowed prose authority. Therefore raw exit status, command, environment fingerprint, and log hash are mandatory fields.
- **Owns:** T1 deterministic verification and batch validation.
- **Must not receive:** test design (Role 12), causal interpretation (Role 7), or review (Role 18).
- **Escalation in/out:** infrastructure failure goes to Role 6; semantic test failure goes to the artifact author via the Director; flaky evidence goes to Role 7.
- **Review:** no model review is needed for a valid signed/raw relay; the independent reviewer reruns the checks. Any interpreted conclusion is a misroute.

#### Role 17 — Integration and Release Engineer

- **Purpose:** Integrate independently accepted work, perform missed-consumer sweeps, validate cross-subsystem seams, and prepare reversible releases.
- **Casting:** `claude-opus-5`, **high effort**. Integration is where locally correct work becomes globally wrong; premium cross-system judgment is load-bearing.
- **Tool surface:** repository/worktree merge tools, full verification manifest, dependency/API diffing, release packaging, rollback rehearsal, and deployment-plan authoring. Production deployment remains human-gated.
- **Strengths:** seam analysis, global verification, compatibility reasoning, and detecting omissions after parallel fan-out.
- **Weaknesses/failure modes:** integration mega-diffs, late redesign, masking a failing child behind glue code, and over-engineering release machinery.
- **Owns:** I0 integration/release readiness.
- **Must not receive:** unreviewed child artifacts, primary feature implementation, or production approval.
- **Escalation in/out:** rejects any unaccepted dependency. Seam failures route back to the owning role; cross-role contradictions go to Role 19; irreversible release goes to a human.
- **Review:** standard integration uses Role 18 `gpt-5.6-sol` high; critical release readiness adds `gemini-3.7-flash` high and human approval.

#### Role 18 — Opposition Reviewer

- **Purpose:** Adversarially evaluate a model-authored artifact in a fresh context using a provider family different from the author, rerunning deterministic evidence and never fixing the artifact.
- **Casting:** deterministic by actual author and risk:
  - Anthropic author: low-risk → `gpt-5.6-luna` low; standard/critical primary → `gpt-5.6-sol` high; critical secondary → `gemini-3.7-flash` high.
  - OpenAI author: low-risk → `claude-sonnet-5` medium; standard/critical primary → `claude-opus-5` high; critical secondary → `gemini-3.7-flash` high.
  - Google author: low-risk → `gpt-5.6-luna` low; standard/critical primary → `claude-opus-5` high; critical secondary → `gpt-5.6-sol` high.
  - Unknown author: `claude-opus-5` high and `gpt-5.6-sol` high; acceptance requires provenance recovery or human disposition.
- **Tool surface:** read-only diff/artifact access, declared verification tools, scanners, screenshots, and verdict output. No edit, stage, commit, deploy, or author conversation history.
- **Strengths:** fresh-context defect hunting, family de-correlation, independent verification, and concrete failure scenarios.
- **Weaknesses/failure modes:** false positives, preference for its own style, capability gradient against a stronger author, over-engineering findings, and shared training/data blind spots despite different vendors.
- **Owns:** A0 adversarial review.
- **Must not receive:** artifacts from its own provider family, fixes, ambiguous conflict arbitration (Role 19), or user approval decisions.
- **Escalation in/out:** CRITICAL/MAJOR deterministically returns `REVISE`; a disputed material finding goes to Role 19. Two review/fix cycles stop for re-plan or human decision.
- **Review:** it never reviews itself. Its verdict is consumed procedurally; disputed substance is evaluated by the third-family Role 19 or a human.

#### Role 19 — Conflict Arbiter

- **Purpose:** Resolve a material author–reviewer disagreement from evidence without belonging to either party’s provider family.
- **Casting:** the unused third family at high effort: Anthropic↔OpenAI dispute → `gemini-3.7-flash` high; Anthropic↔Google → `gpt-5.6-sol` high; OpenAI↔Google → `claude-opus-5` high. If no unused family exists, actual fallback obscures lineage, or the risk is critical, the arbiter is human.
- **Tool surface:** read-only intent, artifact, raw deterministic evidence, author response, and reviewer findings. It may request one discriminating experiment through Role 16 but cannot edit.
- **Strengths:** breaks two-family deadlocks and focuses the decision on falsifiable evidence.
- **Weaknesses/failure modes:** becoming a prestige vote, inventing a compromise, judging outside domain competence, or being falsely neutral while sharing hidden provider lineage.
- **Owns:** A1 technical conflict arbitration.
- **Must not receive:** first-pass review, implementation, or disputes already settled by deterministic failure.
- **Escalation in/out:** only material disputes enter. A verdict unsupported by a reproducible check is advisory; critical or still-balanced disputes go to a human.
- **Review:** low/standard verdicts must cite the deciding evidence and are audited in telemetry; critical verdicts are human-owned, so the arbiter never becomes an unreviewed machine authority.

### 3. Hierarchy and topology

#### Topology

```text
Human authority
  └─ Operations Director (depth 0: route, budget, communicate)
      ├─ Systems Architect / primary specialist / implementer (depth 1)
      │   └─ Scout, Test Engineer, or Verification Runner shards (depth 2 only)
      ├─ Opposition Reviewer(s) (depth 1, fresh and isolated from author)
      └─ Conflict Arbiter (depth 1, only after a material dispute)
```

- **Delegation depth:** two model levels below the Director. Only Systems Architect, Deep Researcher, Principal Engineer, Visual-Spatial Engineer, and Integration Engineer may dispatch depth-two children, and only Roles 3, 12, or 16. Depth-two roles cannot delegate. Reviewers and arbiters cannot delegate except that Role 19 may request one Role 16 experiment through the Director.
- **Fan-out:** initial cap of six concurrent depth-one agents, at most three mutation-capable agents, four children per authorized lead, and twelve active agents globally. Mutation agents require disjoint paths or isolated worktrees. These are operational assumptions to calibrate, not model capability claims.
- **Single-writer rule:** one active author per artifact/path. Execute and review of the same artifact never overlap. Multiple reviewers may run in parallel only after authorship stops and the artifact/ref is pinned.
- **What stays with the Director:** user intent, risk/class assignment, budget, task DAG, provider availability, approval boundaries, artifact lineage, acceptance state, and final evidence-grounded reporting. Architecture, recon, implementation, tests, review judgment, and technical dispute resolution leave the Director.
- **Context contract:** every edge passes a compact task packet: `task_id`, `class_id`, `risk`, `goal`, `deliverable`, `constraints/frozen_paths`, `known_facts+sources`, `acceptance_tests`, `tools`, `context_manifest`, `budget`, `author_lineage`, `review_requirement`, and `escalation_triggers`. Result packets contain `status`, `artifacts/changes`, `evidence`, `tests`, `unknowns`, `requested_escalation`, `actual_provider/model/snapshot/effort`, `tokens/cost`, `wall_time`, `tool_calls`, and `fallback_events`.
- **State:** task packets, decisions, artifacts, test evidence, and lineage live in an external blackboard; raw chains of thought do not. Resume is warm inside one work order and fresh across independent orders and every review.
- **Risk tiers:** L0 = reversible lookup/inert relay; L1 = substantive code, tests, RCA, UI, or meaning-bearing docs; L2 = security, auth, cryptography, data loss/migration, concurrency, public contracts, production external state, or irreversible action.
- **Review mandate:** cross-vendor review is **mandatory** for every L1 artifact and requires one non-author family; it is **mandatory twice** for every L2 artifact and requires both non-author families. Cross-vendor review is merely **preferred** for L0 model-authored prose/checklists and may be replaced by direct deterministic validation. A raw exit-code/hash relay is not model evaluation. A waiver never happens silently: only a human may accept degraded L1/L2 review, with the missing family, reason, and residual risk recorded.
- **Fallback law:** a provider fallback changes `actual_provider`; the router recomputes reviewer eligibility. A silent or unverifiable fallback invalidates approval. A provider outage may use the next cast only if review independence remains satisfiable; otherwise work pauses or is explicitly accepted as degraded by a human.

#### Escalation ladder

1. **Rung 0 — bounded cheap:** Scout/Locator, Verification Runner, or a low-risk reviewer cast. Enter only with explicit context and deterministic completion. One re-probe maximum.
2. **Rung 1 — workhorse:** Routine Engineer, Independent Test Engineer, or UI Systems Engineer. Enter for well-specified, reversible work. Exit on two similar failures, task-class change, or scope crossing three subsystems.
3. **Rung 2 — specialist frontier:** Systems Architect, Terminal/Ops, Diagnostic, Principal, Visual-Spatial, Data/Migration, Performance, Security, Integration, or standard Opposition Reviewer. Route by failure signature, never by “bigger model” alone.
4. **Rung 3 — ceiling compute:** xhigh/max is allowed only for a predeclared, quality-first experiment: Fable xhigh for architecture/repo coherence; Sol xhigh/max for novel algorithm, research, or terminal-heavy deadlock; Opus xhigh for an unresolved diagnostic case. The Director must state the hypothesis, incremental budget, and stopping test. No code role uses max by default.
5. **Rung 4 — human:** irreversible action, unclear authorization, critical three-vendor disagreement, two failed premium cycles, or estimated incremental inference above the configured approval threshold (initially **$5 or 15 minutes**, an assumption).

### 4. Routing table

Every named class has one primary role. If more than one row appears applicable, apply these precedence rules before dispatch: S0/D1/L2 safety first; investigation before fix; V0 when spatial interpretation itself is uncertain, V1 when the mock/layout is specified; C1 when shell/environment interaction dominates; otherwise decompose the request.

The classes added beyond the goal’s minimum are necessary for distinct acceptance surfaces: P1 because planning errors multiply across all child work; R1 because source research uses different tools and evidence law from repository lookup; V0/V1 because spatial reconstruction and mock-defined UI require different visual judgment; D0/D1 because schema and data-loss risk require rollback evidence; T0/T1 because independent test design is not raw command execution; P2 because optimization is invalid without a measured baseline; S0 because authorization and adversarial failure modes are domain-specific; W0 because documentation can create public/API commitments without changing code; I0 because parallel local successes still need a global seam sweep; and A1 because a substantive author–reviewer dispute cannot safely return to the authoring Director.

| ID | Task class and discriminator | Primary role | Reviewer | Escalation path |
|---|---|---|---|---|
| P0 | Intake, routing, budget, and acceptance state | Operations Director | Sol/high for high-risk DAGs | Systems Architect → human |
| Q0 | Unknown class; one short classification probe | Operations Director | None; classification logged | Systems Architect or matching investigator |
| P1 | Planning/decomposition, interfaces, architecture | Systems Architect | Opposition Reviewer: Sol/high | Independent spike → Conflict Arbiter → human |
| R0 | Simple fetch/find/lookup/map with cited evidence | Scout / Locator | Deterministic citation/count check | Re-probe once → Researcher or Diagnostic Engineer |
| R1 | Deep web/document research and contradiction analysis | Deep Researcher | Opus/high if decision-bearing | Sol/high once → domain specialist/human |
| C0 | Routine coding: clear spec, one subsystem, objective tests | Routine Engineer | Sol/high | Diagnostic Engineer or Principal Engineer |
| C1 | Terminal/shell/CI/toolchain/environment-heavy work | Terminal / Operations Engineer | Opus/high | Diagnostic Engineer for causal app bug → human for external state |
| C2 | Complex long-horizon coding or novel algorithm | Principal Engineer | Sol/high; Gemini/high if L2 | Re-architecture → human |
| C3 | Deep investigation/detective work, including intricate/confusing/intermittent bug tracing | Diagnostic Engineer | Sol/high on RCA | One discriminating probe → Principal/Terminal → human |
| C4 | Refactoring at scale with global invariants | Principal Engineer | Sol/high | Split + Integration Engineer → human |
| V0 | Visual/spatial reconstruction paired with coding | Visual-Spatial Engineer | Gemini/high + deterministic visual/geometry checks | More evidence views → human reference decision |
| V1 | Frontend/UI/mock-to-code with visual inspection loop | UI Systems Engineer | Opus/high | Visual-Spatial for unclear geometry; Diagnostic/Principal for logic |
| D0 | Schema, data model, ETL, reversible backfill | Data and Migration Engineer | Sol/high | Dry-run gap → Researcher/Diagnostic → human |
| D1 | Data-risky migration/cutover/rollback | Data and Migration Engineer | Sol/high + Gemini/high + human on disagreement | Block until restore/cutover evidence |
| T0 | Test design/authoring independent of implementation family | Independent Test Engineer | Artifact gate; third family when possible | Architect for missing behavior → human |
| T1 | Deterministic test/build/lint/scanner execution | Verification Runner | Raw exit/log/hash; reviewer reruns | Terminal Engineer or Diagnostic Engineer |
| P2 | Performance profiling and measured optimization | Performance Engineer | Sol/high | Principal for novel core; Terminal for environment bottleneck |
| S0 | Authorized defensive security review/patching | Defensive Security Engineer | Opus/high + Gemini/high + human for critical | Block on authorization; human/security owner |
| W0 | Technical docs, API guides, changelogs, decisions | Documentation Engineer | Luna/low inert; Sol/high meaning-bearing | Architect/domain owner for missing truth |
| I0 | Integration sweep, seam validation, release readiness | Integration and Release Engineer | Sol/high; Gemini/high if L2 | Owning role → Conflict Arbiter → human |
| A0 | Adversarial review of a model artifact | Opposition Reviewer | Never self-reviewed; Role 19 on dispute | Conflict Arbiter → human |
| A1 | Material author–reviewer technical disagreement | Conflict Arbiter | Human if critical or still balanced | Human |

### 5. Cost model

#### Price registry and formula

All rates are USD per 1M input/output tokens as of 2026-08-27: Luna $0.20/$1.20, Terra $2/$12, Sol $4/$20 promotional (durable $5/$30); Sonnet 5 $2/$10, Opus 5 $5/$25, Fable 5 $10/$50; Gemini 3.7 Flash $0.75/$3.75 promotional through 2026-12-31 (then $1.50/$7.50). Sources are the official pages cited in section 1.

`estimated inference cost = Σ(input_tokens/1M × input_rate + output_tokens/1M × output_rate)`.

The estimates below include one Operations Director turn (4K input + 0.5K output ≈ **$0.033**) and the listed producer/reviewer envelopes. They assume uncached input, so cache reuse should improve them. Search/browser charges, compute, storage, CI, and human time are excluded. Token envelopes and latency are **planning estimates**, not observed repository telemetry.

| Class | Producer envelope and cost | Cross-vendor mandate added | Estimated total now |
|---|---:|---:|---:|
| P0/Q0 routing only | Director turn $0.033 | none | **$0.03** |
| P1 architecture | Fable 150K/20K = $2.50 | Sol 100K/10K = $0.60 | **$3.13** |
| R0 lookup | Luna 10K/1K = $0.003 | deterministic check | **$0.04** |
| R1 deep research | Sol 150K/15K = $0.90 | Opus 40K/5K = $0.325 | **$1.26** + search fees |
| C0 routine coding | Sonnet 80K/12K = $0.28 | Sol 60K/8K = $0.40 | **$0.71** |
| C1 terminal/ops | Sol 100K/12K = $0.64 | Opus 60K/8K = $0.50 | **$1.17** |
| C2 complex coding | Fable 250K/35K = $4.25 | Sol 150K/15K = $0.90 | **$5.18** |
| C3 intricate RCA | Opus 140K/15K = $1.075 | Sol 80K/8K = $0.48 | **$1.59** |
| C4 scale refactor | Fable 220K/30K = $3.70 | Sol 120K/12K = $0.72 | **$4.45** |
| V0 visual-spatial code | Fable 140K/18K = $2.30 | Gemini 80K/8K = $0.09 promo | **$2.42** |
| V1 UI system | Gemini 120K/15K = $0.146 promo | Opus 70K/8K = $0.55 | **$0.73** |
| D0 schema/ETL | Opus 120K/15K = $0.975 | Sol 80K/8K = $0.48 | **$1.49** |
| D1 risky migration | Opus 180K/25K = $1.525 | Sol 100K/10K $0.60 + Gemini 80K/8K $0.09 | **$2.25** + human |
| T0 test authoring | Sonnet or Terra 80K/10K = $0.26–0.28 | gate share estimated $0.15–0.40 | **$0.44–0.71** |
| T1 raw verification | Luna 30K/2K = $0.008 | reviewer rerun accounted at artifact gate | **$0.04** + compute |
| P2 performance | Opus 160K/20K = $1.30 | Sol 100K/10K = $0.60 | **$1.93** |
| S0 defensive security | Sol 180K/20K = $1.12 | Opus 120K/12K $0.90 + Gemini 100K/10K $0.113 | **$2.17** + human for critical |
| W0 documentation | Sonnet 50K/8K = $0.18 | Luna low $0.009 inert; Sol ≈$0.40 substantive | **$0.22–0.61** |
| I0 integration/release | Opus 160K/20K = $1.30 | Sol $0.60 + Gemini $0.09 if L2 | **$1.93–2.02** |
| A0 review-only | no producer in this task | low $0.009; standard $0.40–0.55; critical adds $0.09–0.11 | **$0.04–0.69** |
| A1 arbitration | third-family 70K/8K ≈$0.083–0.55 | human if L2 | **$0.12–0.58** + human |

#### Where savings come from

- Lookup and raw verification volume moves from Haiku’s $1/$5 to Luna’s $0.20/$1.20 and is prevented from consuming large contexts.
- Routine coding stays on Sonnet rather than Fable/Opus. Under the table envelope, Fable would cost about $1.40 for the same 80K/12K producer tokens versus Sonnet’s $0.28, before considering different completion lengths.
- Gemini UI authoring makes the cross-vendor reviewer—not the producer—the dominant model cost. This is desirable only if the canary shows equivalent accepted quality.
- Premium models are invoked at plan time for known-hard work, avoiding multiple full verification/review rounds. This saving is a hypothesis to validate with accepted-result telemetry.
- Cached stable system/role packets, batch/flex for noninteractive shards, compact context manifests, and keeping one provider warm inside a work order reduce input re-billing.

#### Cost of de-correlation

- Standard cross-vendor review adds roughly **$0.40** to a routine coding task: more than the $0.28 author cost, but it protects the acceptance boundary. It adds about **$0.90** to a complex Fable task, only about 21% of its producer cost.
- Critical dual review adds the third-family pass. At current Gemini promotion prices this is often only **$0.09–0.11** in model inference, but duplicate deterministic verification and human dispute handling may dominate money and latency.
- Review is serial after authorship. Estimated added model latency is **1–5 minutes** for low/standard review and **3–15 minutes** for frontier review, plus a full independent verification run. Critical reviewers run in parallel, so their model latency adds approximately the slower pass, not their sum. These are estimates pending telemetry.
- On Sol’s promo expiry, a standard 60K/8K Sol review rises from $0.40 to $0.54 (**+35%**). On Gemini’s promo expiry, Gemini inference doubles; the V1 producer rises from about $0.146 to $0.293, but the current cast remains cheaper than its Opus reviewer. Recast only if accepted-result cost, not sticker price, loses its gate.

#### Promotion and escalation gates

- A cheap cast becomes primary only if, on at least 30 representative tasks, its acceptance rate is no more than **2 percentage points below** the incumbent and its median accepted-result cost is at least **30% lower**; otherwise it remains a canary/fallback.
- A premium cast is justified when it raises acceptance by at least **5 points** on the target class, reduces mean review/fix rounds by at least **20%**, or eliminates a critical escape seen at the lower rung. Critical classes prioritize zero known critical escapes over cost.
- An effort increase survives only if it improves acceptance or reduces retries enough to offset at least **20%** higher estimated cost/latency on that class. These are architecture policy thresholds and should be changed only from telemetry.

### 6. Deltas from the current roster

The current protocol has a fixed six-role core plus transport/workflow roles (`ORCHESTRA.md:15-47`); the installed tree adds the Codex pack and has no installed specialist. History shows the roster grew reactively—Detective, heavy tiers, optional executors, then cross-compare workflows—rather than from one task taxonomy (`git log` commits `6d6df88`, `f564682`, `09ec342`, `e9e9338`). The proposed deltas are:

| Current element | Delta | Reason |
|---|---|---|
| Director = Fable/Opus with broad decide/arbitrate/synthesize authority | Narrow to Operations Director; move architecture to Role 2 and substantive disputes to Role 19 | Prevents an unreviewed director from designing and later accepting its own plan; preserves user/state authority |
| `scout` = Haiku (`agents/scout.md:1-18`) | Retain contract, recast primary to Luna/low, add 64K packet cap and Haiku fallback | Much lower current token price; context weakness made explicit and testable |
| Read-only Opus `detective` (`agents/detective.md:1-20`) | Split external research to Role 4; evolve causal diagnosis to Role 7 with sandboxed experiments but no production fix | Deep web research and runtime RCA have different tools and failure modes; intricate bugs often require experiments |
| Sonnet `executor` (`agents/executor.md:1-22`) | Retain as Routine Engineer with explicit C0 boundary and Sonnet 5/medium | Preserves a proven workhorse contract while preventing hard/risky misroutes |
| Generic `executor-heavy` and `executor-heavy-xhigh` (`agents/executor-heavy.md:1-27`) | Retire as user-visible task classes; replace with Principal, Data/Migration, Performance, Security, Visual-Spatial, and Integration roles | “Hard” is an escalation property, not enough nuance for capability matching; xhigh remains a cast/effort point |
| `reviewer` plus `reviewer-codex` and project-global `reviewEngine` | Merge responsibility into author-aware Opposition Reviewer; keep provider launchers as adapters | Review eligibility depends on artifact author and risk, not one project-wide engine; prevents same-family heavy review |
| `executor-codex` and `executor-codex-heavy` | Retire as roles; retain OpenAI runner, tree audit, nonce, and integrity mechanics as provider adapter features | Transport/vendor is not a responsibility; any role can be cast through an eligible adapter |
| `planner-gpt`, architect lanes, and plan synthesizer | Retain as optional workflow implementations mapped to Systems Architect, Opposition Reviewer, and Conflict Arbiter contracts; do not count launchers as capability roles | Separates workflow topology from the production roster while preserving cross-compare value |
| Master `modeler` specialist exists but is not installed (`agents/specialists/modeler.md:1-35`; install record has `specialists: []`) | Replace the one broad visual specialist with V0 Visual-Spatial and V1 UI Systems; allow domain packs to preload Blender/Godot/CAD skills | Distinguishes spatial inference from mock-to-code/UI and supports the goal’s nuanced visual+coding route |
| Fixed company table in protocol | Generate/describe company from role registry + active cast registry + provider health | Makes runtime transposition and model refreshes possible without changing role law |
| Current config only sets cross-plan timeout (`.claude/orchestra.json`) | Specify future registry fields for casts, prices/effective dates, provider family, effort maps, context caps, risk-review matrix, budgets, and fallback policy | Routing and decorrelation cannot be reliably inferred from prose or a global engine toggle |

Mechanics to preserve unchanged in concept: read-only recon boundaries, self-contained work orders, two-failure stop law, warm resume within an order, fresh review context, pinned review refs, full verification twice, tree audits, report-integrity nonce, checkpoint/heartbeat state, and specialist skill preloading (`ORCHESTRA.md:35-45`, `:49-67`, `:96-125`).

### 7. Open risks and verification

The architecture is a falsifiable routing prior. Its highest-risk unverified claim is that Gemini 3.7 Flash can own V1 in this harness at materially lower accepted-result cost without losing interaction correctness or accessibility. The first implementation work is therefore a blind V1 canary against the best incumbent, not registry scaffolding. The second riskiest claim is that Luna’s packet cap prevents long-context misses without eliminating its cost advantage.

Every accepted artifact must make these invariants queryable: exactly one primary role; actual author provider known; reviewer provider differs; critical artifact has both non-author providers or a recorded human waiver; deterministic evidence rerun; no reviewer edits; no depth-three delegation; no overlapping writers; and price version/effective date captured. Section `## Verification` gives runnable proof for each implementation step and the whole system.

## Work plan

1. **Build the task corpus and validate the riskiest casts.** **Depends on:** none. Create a versioned, vendor-blind corpus with at least 30 tasks each for V1 UI, C0 routine coding, R0 lookup, C1 terminal, C3 RCA, and A0 review; at least 15 each for lower-volume classes; seeded defects and deterministic acceptance where possible. Run Gemini V1 against the incumbent visual coder, Luna R0 under 16K/64K/128K packets, Sonnet vs Terra C0, and the proposed reviewer pairings. Record accepted result, critical escapes, dollars, wall time, retries, and human preference. Do not promote a cast that fails the section 5 gates.

2. **Specify the provider-neutral role, task, result, lineage, and price schemas.** **Depends on:** Step 1’s finalized taxonomy and measured fields. Define required enums, risk tiers, author lineage, fallback events, tool classes, acceptance state, effective-dated prices, and effort maps. Make unknown provider/model and expired prices fail closed for review eligibility and cost reporting.

3. **Specify provider adapters and health/fallback contracts.** **Depends on:** Step 2. Define adapters for the current native/Claude path, existing OpenAI MCP/CLI path, and a new Google path. Normalize model id/snapshot, effort, token use, tool capability, context, timeout, cancellation, and fallback reporting. Retain current OpenAI tree-audit and integrity-nonce behavior. No adapter may hide an actual-provider change.

4. **Specify the deterministic task classifier and precedence rules.** **Depends on:** Steps 1–2. Encode the routing table, safety precedence, mixed-task decomposition, ambiguity response, and unique-primary invariant. Produce a human-readable explanation for every route: matched signals, rejected alternatives, cast, cost envelope, risk tier, and required reviewer.

5. **Specify all nineteen role definitions and tool policies.** **Depends on:** Steps 1–4. Translate the catalog without provider mechanics in role prose; bind casts through registry references. Define hard tool allow/deny sets, mutation scopes, context caps, result contracts, and role-specific stall signals. Preserve existing skill preloading for domain roles.

6. **Specify hierarchy, blackboard, concurrency, and cancellation enforcement.** **Depends on:** Steps 2, 4, and 5. Enforce depth, fan-out, single-writer worktrees, pinned artifacts, warm/fresh context rules, progress checkpoints, global budgets, and safe cancellation. Treat a stopped agent with a live process as an incomplete result, matching current protocol law.

7. **Specify author-aware review and arbitration gates.** **Depends on:** Steps 2–6. Implement requested-versus-actual lineage checks, risk-based reviewer matrix, blind review packets, independent reruns, no-fix enforcement, critical dual review, deterministic severity disposition, third-family arbitration, and human fallback. Replace global review-engine routing with per-artifact eligibility while keeping a project policy for “single/dual/critical-only.”

8. **Specify telemetry, cost accounting, and escalation policy.** **Depends on:** Steps 2–7. Capture token/cache/tool/compute cost, price version, latency, retries, acceptance, findings, and human intervention. Implement the two-failure stop law, task-shaped reroutes, cost/time approvals, cast expiry, shadow evaluation, and automatic rollback to the last qualified registry.

9. **Plan repository migration and compatibility.** **Depends on:** Steps 3–8. Map existing agent names and pack launchers to the new contracts, add deprecation aliases for one release, preserve installer state and specialist selection, update the protocol/status/plan/review skills, and expand installer lint/tests. A dry-run must report exact additions, replacements, retained user config, and any degraded provider path before writing.

10. **Roll out shadow → canary → default.** **Depends on:** Steps 1–9. Shadow-route at least 100 real tasks without changing execution; canary 10% of eligible L0/L1 tasks with automatic fallback; advance to 50% and then default only if quality gates hold for two consecutive evaluation windows. L2 tasks remain opt-in until they have zero known critical escapes and security/data owners approve. Preserve a one-command registry rollback.

## Risks and failure modes

| Risk/failure mode | Consequence | Detection and mitigation |
|---|---|---|
| Benchmarks do not transfer to this harness | Expensive miscasts or quality regression | Step 1 blind corpus; promote only on accepted-result thresholds; expire casts quarterly |
| Google V1 evidence is too new/vendor-shaped | UI appears polished but breaks behavior/accessibility | Canary only; interaction, responsive, a11y, and visual-diff checks; Opus review; rollback cast |
| Luna silently misses context | Incomplete maps misdirect plans | 64K initial cap, count/citation sampling, packet-size sweep, reroute to Terra/Researcher on miss |
| Role catalog becomes bureaucratic | Router spends more than workers; users cannot predict assignment | Unique task ids, precedence tests, explanation output, merge roles only after telemetry shows indistinguishable routes |
| Mixed tasks evade single-primary rule | Two agents both own or neither owns work | Mandatory decomposition; classifier fails closed on multiple matches; Q0 only classifies |
| Silent provider fallback defeats de-correlation | Artifact is reviewed by its own family | Required actual lineage, fallback event, provider-attested response metadata; unknown fails closed |
| Different vendors still share blind spots | Cross-vendor review gives false assurance | Deterministic checks first, seeded-defect reviewer evals, critical two-family review, human dispute gate |
| Reviewer false positives create loops | Cost and latency balloon; good changes churn | Concrete failure scenario required; mutation/repro evidence; two-cycle stop; third-family arbiter |
| Director becomes a covert architect/reviewer | Same-family self-approval returns | Tool and output contract, high-risk plan review, audit logs of Director-authored content |
| Promotions expire or prices change | Cost model and role economics invert | Effective-dated registry, stale-price failure, sensitivity recalc, accepted-result recast rather than automatic downgrade |
| Context caching rewards same-vendor overuse | Cost optimization erodes diversity | Cache affects producer selection only after review eligibility; reviewer always fresh and cross-family |
| Critical dual review creates human bottleneck | Releases queue on disagreements | Parallel reviewers, deterministic severity rules, reserve human for material unresolved L2 disputes |
| Fable retention/classifier constraints conflict with project policy | Sensitive or security tasks are mishandled | Registry capability flags (`zdr`, classifier domains); route ZDR away from Fable; security to Sol; log refusals/fallbacks |
| Fan-out causes overlapping edits or rate-limit storms | Corrupted tree, lost work, unpredictable spend | Single-writer leases, worktree isolation, global semaphore, provider rate budgets, cancellation tests |
| Telemetry stores secrets or proprietary prompts | Observability creates a data leak | Store hashes/metrics and redacted packets; role-based access; retention policy; never log raw reasoning |
| Human acceptance is inconsistent | Eval gates become preference contests | Blind rubrics, pairwise randomization, adjudication notes, deterministic criteria where possible, confidence intervals |
| Current pack transport is mistaken for a role | Runtime transposition hard-codes vendor mechanics | Provider adapters below stable contracts; contract tests shared across runtimes |

## Verification

### Step-by-step proof

1. **Corpus/casts:** publish task ids, fixtures, rubrics, raw model/snapshot/effort, deterministic outputs, human-blind judgments, cost, and confidence intervals. Re-run a stratified 10% sample. Verify each promoted cheap cast meets the ≤2-point quality / ≥30% cost gate and each premium cast meets its stated quality/round gate.
2. **Schemas:** validate golden and malformed task/result packets. Required negative cases: missing actual provider, expired price, unknown effort, provider fallback without event, L2 without review policy, and reviewer family equal to author. All must fail before dispatch/acceptance.
3. **Adapters:** run the same conformance suite against Anthropic, OpenAI, and Google stubs plus one live smoke call per enabled provider. Assert normalized lineage, effort, token/cost fields, cancellation, timeout, and fallback. OpenAI adapter additionally proves tree audit and fresh nonce rejection.
4. **Router:** table-drive every routing row with positive, boundary, and adversarial mixed-task examples. Assert exactly one primary role, stated precedence, and deterministic decomposition. Target ≥95% macro-F1 on the blind corpus and **100% correct safety override** for S0/D1/L2 fixtures.
5. **Roles/tools:** lint every role definition; launch each in a sandbox and attempt one allowed and one forbidden tool action. Assert all catalog fields exist, context caps land, forbidden mutation is blocked, and no role claims a task id owned elsewhere.
6. **Hierarchy:** simulate depth-three delegation, seventh depth-one child, fifth lead child, fourth concurrent writer, overlapping path leases, stopped agent with live process, and cancellation during a checkpoint. Each must block or leave a resumable, audited state.
7. **Review/de-correlation:** enumerate every author vendor × risk tier × provider-health/fallback combination. Assert reviewer family differs from actual author; L2 obtains both non-author families or an explicit human waiver; unknown lineage cannot approve; reviewer writes are detected; disputed L1 routes to the unused third family; disputed L2 routes to a human.
8. **Telemetry/cost/escalation:** recompute the section 5 examples from registry rates; change Sol and Gemini effective dates and verify cost changes; replay two identical failures and verify the third attempt is refused; verify secrets are redacted and registry rollback restores the prior cast atomically.
9. **Repository migration:** on disposable fixtures, install core-only, current Codex pack, no-pack, and specialist selections; then upgrade, downgrade, and uninstall. Assert user-authored config survives, aliases warn once, deselected packs leave no stale roles, and status reports actual capabilities.
10. **Rollout:** compare shadow recommendations with actual outcomes; during canary, watch critical escapes, acceptance, review cycles, cost, latency, fallbacks, and human interventions. Any critical regression or >2-point acceptance drop automatically reverts the cast registry.

### Repository-level commands after implementation

The current repository already exposes frontmatter, installer, review, execution, MCP, and scan suites. The implementation should add `tests/role-routing.test.js`, `tests/provider-casting.test.js`, `tests/review-decorrelation.test.js`, `tests/hierarchy-policy.test.js`, and `tests/cost-ledger.test.js`, then make this review sequence pass from the repository root:

```powershell
node install.js --lint .
node tests/frontmatter-lint.test.js
node tests/role-routing.test.js
node tests/provider-casting.test.js
node tests/review-decorrelation.test.js
node tests/hierarchy-policy.test.js
node tests/cost-ledger.test.js
node tests/scan-lane.test.js
node tests/review-lane.test.js
node tests/exec-lane.test.js
node tests/mcp-lane.test.js
```

### Whole-system acceptance

The architecture is proven done only when all of the following hold on a pinned release candidate:

- every routing-table id has exactly one primary role and every role lists a weakness, forbidden work, both escalation directions, and a reviewer;
- 100% of substantive evaluation artifacts have known actual lineage and a different-family reviewer; 100% of L2 artifacts have two eligible non-author families or an explicit human waiver;
- no self/same-family review acceptance is possible under fallback, outage, unknown-author, retry, or resume tests;
- deterministic verification is independently rerun and reviewer mutation is detected;
- the blind corpus meets the role promotion gates, has zero known critical escapes in L2, and shows at least **20% lower median accepted-result cost** than the current fixed roster without a >2-point acceptance loss overall;
- p95 routing overhead is below **5% of end-to-end task latency** and Director inference is below **10% of total model spend** on the evaluation mix;
- depth, fan-out, single-writer, budget, stop-grinding, and human-approval policies survive adversarial tests;
- current core-only and Codex-pack installations upgrade and roll back without losing user configuration or weakening the existing integrity/verification guarantees.

## Assumptions and open questions

### Assumptions

- The target runtime can call Anthropic, OpenAI, and Google models and can expose actual provider/model/snapshot metadata. The current repository directly implements Claude plus an optional OpenAI pack; a Google adapter does not yet exist.
- Current first-party model ids and rates are available to the deployment account and region. Model presence in public documentation does not prove quota, enterprise retention eligibility, or CLI support in this project.
- The 64K Luna packet cap, fan-out limits, $5/15-minute approval threshold, token envelopes, latency ranges, and corpus thresholds are initial policy assumptions and must be replaced by telemetry.
- Fable’s retention restrictions are acceptable only for non-ZDR work; ZDR tasks must be routed to eligible alternatives.
- Deterministic test infrastructure is available or can be built for each substantive task class. Where it is not, the risk tier rises and human review becomes more important.
- Human security/data/release owners are available for critical authorization and unresolved three-vendor disputes.

### Open questions

1. Is three-provider availability a deployment requirement, or must the harness offer a formally degraded two-provider mode? If degraded mode is required, which L2 classes must pause rather than accept weaker de-correlation?
2. May Fable process project data under the organization’s retention policy, and can classifier fallback metadata be observed reliably on every platform used?
3. Which incumbent should the V1 Gemini canary face in the actual runtime: the current Sonnet modeler path, Opus visual coding, or Fable visual-spatial work? The answer changes evaluation cost but not the promotion gate.
4. What is the representative workload weighting for overall savings: repository coding, UI/game work, research, or operations? Per-class gates remain fixed, but the claimed overall 20% saving depends on this mix.
5. Should critical dual review require human sign-off on every APPROVE, or only on disagreement/irreversibility? Security and data owners must set this policy.
6. What provider-attested field is authoritative for actual-model lineage when a CLI, cloud partner, or managed agent silently changes a snapshot?
7. Should role/cast changes ship with the harness or through an independently signed registry channel? Independent updates improve agility but expand supply-chain risk.
8. What maximum context and cache-retention policy is acceptable for proprietary repositories across all three providers?
