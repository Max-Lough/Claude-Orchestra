# Plan: Capability-Routed Cross-Vendor Agent Company

## Summary

The proposed architecture is a bounded, capability-routed company of nineteen roles. Claude Opus 5 at medium effort serves as Director; cheap specialists handle retrieval and mechanical work; workhorse models perform routine implementation; premium specialists own ambiguity, difficult debugging, terminal work, visual systems, security, and long-horizon engineering. Anthropic and OpenAI are the required execution pools. Gemini 3.7 Flash receives one conditional multimodal seat through Google Antigravity, activated only after its exact subscription availability and internal performance are proven.

Every canonical task class has one primary role. Model choice is a property of the role, not a generic “smartness” ladder. Risk, context length, tool requirements, and remaining vendor allowance adjust effort or trigger a documented fallback, but do not silently change the task class.

The governing quality rule is:

1. deterministic evidence first;
2. a fresh-context reviewer for every semantic source change;
3. an opposite-vendor reviewer for every consequential artifact;
4. human approval for irreversible actions and unresolved two-vendor disagreements.

No model judges its own output. No same-family review may satisfy a consequential gate. When an opposite-vendor allowance is exhausted, the gate waits, uses a qualified third vendor, or escalates to a human; it never silently weakens to correlated review.

The design preserves the current harness’s strongest mechanics—Director isolation, bounded delegation, structured work orders, independent verification, pinned reviews, tree audits, integrity nonces, heartbeats, and typed cross-vendor transport—while replacing its fixed, effort-named roster and optional cross-vendor review policy with capability roles, an author-aware review matrix, and explicit allowance scheduling.

## Approach

### Evidence base and adjudications

The design incorporates all four repository documents required by the brief:

- `research/openai-models.md`
- `research/cross_vendor_agent_harness_roster_summary.md`
- `research/dossier_both.md`
- `CROSSPLAN-GOAL.md`

Repository reconnaissance covered the master and installed protocols, core and optional agent rosters, Codex-native mirror, skills, configuration, guard hooks, installers, tests, README, changelog, and relevant history. Material historical milestones include the optional OpenAI execution lane, report-integrity enforcement, typed MCP transport, and blind cross-plan workflow.

The reports are evidence rather than a voting system. Their important disagreements are resolved as follows.

| Question | Evidence and disagreement | Decision | Reversal condition |
|---|---|---|---|
| Permanent Director | The dossier selects Opus 5; the roster summary warns that Fable should not automatically direct and instead emphasizes poorly understood or spatially global problems. | Opus 5 medium directs. Fable 5 is an architecture and ceiling specialist. | Recast only if a harness-native director evaluation shows another model improves accepted outcomes by at least 5 percentage points, does not worsen irreversible-action behavior, and consumes no more than 1.5× normalized allowance. These are proposed acceptance thresholds, not published measurements. |
| Long-horizon repository work | `openai-models.md` reports Fable 5 at about 80.0% on SWE-bench Pro versus Sol at 64.6%. The dossier cautions that SWE-bench Pro itself may contain substantial task defects. | Fable 5 high owns architecture and long-horizon coding, but only behind an internal repository-scale evaluation. | Move the primary cast to Opus or Sol if Fable’s internal accepted-result advantage is below 3 points or its normalized allowance per accepted task exceeds the alternative by more than 2×. |
| Routine coding | The dossier places Sonnet 5 and Terra near one another—approximately 63.2% and 63.4% on SWE-bench Pro—and treats both as workhorses. | Sonnet 5 medium is the steady-state routine implementation primary. It preserves continuity with the current harness and leaves OpenAI capacity available for mandatory reviews. Terra is the declared depletion fallback, not a co-primary. | Prefer Terra if a project-specific trial is within 2 points of Sonnet’s accepted-result rate and materially improves the two-pool allowance balance. |
| Luna effort | `openai-models.md` treats Luna-at-max as a promising inexpensive experiment. The dossier calls routinely raising Luna’s effort a category error and reports an MRCR long-context result of 41.3 versus Terra’s 89.6. | Luna owns bounded retrieval and mechanical work at low or medium effort. Max is excluded from the default roster. | Add a Luna-max cast only if a blinded trial proves non-inferiority on the intended bounded class and a lower allowance draw than Terra. |
| Sol’s role | Reports agree that Sol is unusually strong in terminals, browsing, defensive security, and interface work. `openai-models.md` gives Terminal-Bench results of 88.8% vendor-reported and 85.77% independently measured, BrowseComp 92.2%, OSWorld 62.6%, and a top-band Design Arena result. The same report and dossier flag over-agency, constraint violations, concurrency defects, and integrity concerns. | Sol owns terminal, deep-research, UI, security, and Claude-side review work, with narrow permissions, a tree audit, an integrity nonce, and Anthropic review of Sol-authored changes. | Recast a class if its internal success trails another cast by over 3 points or its major-defect rate is materially worse at equivalent review cost. |
| Sol versus Terra for review | The reported CodeRabbit clean-pass rates are 63.7% for Sol and 40.7% for Terra. | Sol, not Terra, is the OpenAI flagship reviewer. Terra may screen structured or low-risk material but cannot close a consequential gate. | Terra may close routine gates only if an internal seeded-defect evaluation narrows the major-defect recall gap to under 5 points. |
| Long-context work | The dossier reports Terra at 89.6 and Luna at 41.3 on MRCR. | Terra medium owns long-context synthesis; Luna is hard-filtered out regardless of effort. | Reconsider only after a harness-native long-context test shows Luna within 3 points with no unsupported conclusions. |
| Cross-vendor review | The current harness makes OpenAI review optional and normally reviews Sonnet work with fresh Opus context. That improves context independence but does not remove family-level correlation. | Opposite-vendor review is mandatory for semantic code changes and all consequential artifacts. | This invariant has no allowance-based downgrade. Only a human-authorized policy change may relax it. |
| Gemini 3.7 Flash | The supplied reports contain no Gemini evidence. Google reports FrontierCode 1.1 at 43.6, DeepSWE 1.1 at 65.3, WebDev Arena at 1588, improved automation, multimodal input, and up to a 1,048,576-token context. These are primarily vendor claims. | Add a conditional Multimodal Reference Analyst seat, disabled until a live subscription-path and internal-quality gate passes. Do not make Gemini the general coding primary. | Disable the seat if the exact model is unavailable in Antigravity, its multimodal acceptance rate is more than 3 points below the best two-vendor alternative, or its opaque allowance proves operationally unreliable. |

OpenAI’s current model guidance describes Sol as the complex-task flagship, Terra as the cost/capability balance, Luna as the high-volume model, and exposes the `none` through `max` effort ladder. This supports specialization rather than a single-model hierarchy. [OpenAI model-selection guidance](https://developers.openai.com/api/docs/guides/latest-model)

The standard OpenAI path is Codex CLI authentication with a ChatGPT subscription, not an API key. API-key use would create a separately billed dependency outside this design. [Codex authentication](https://developers.openai.com/codex/auth)

Anthropic documents Claude Code usage as shared with the associated Claude subscription, with rolling and weekly limits; it explicitly recommends Sonnet for most coding, Opus for difficult architecture/debugging, and Haiku for quick work. [Claude Code model usage and limits](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code) Fable access is materially different: its included path is tied to Max or premium seats and may consume up to half the weekly allowance. [Fable subscription availability](https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan)

Google’s official transition places the subscription coding path in Antigravity CLI rather than the retired consumer Gemini CLI. [Gemini CLI transition](https://developers.googleblog.com/en/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) The exact appearance of `gemini-3.7-flash` in a Google AI Pro or Ultra Antigravity account remains an activation-time assumption because the public Antigravity pricing page does not publish a model-specific quota table. [Antigravity pricing](https://antigravity.google/pricing?app=cli)

### Design principles

1. **Classify before casting.** A task first receives one canonical class based on its acceptance artifact and dominant difficulty. The model is then selected from the class’s role contract. This prevents “use the biggest model” from becoming the routing algorithm.

2. **Roles describe capabilities, not transports.** “Terminal Operator” and “Runtime Investigator” remain meaningful across runtimes. Provider adapters, launchers, and MCP calls are implementation details.

3. **The cheapest proven cast owns the volume.** Luna, Haiku, Sonnet, and Terra handle bounded work. Opus, Sol, and Fable spend allowance only where ambiguity, environment interaction, review quality, or long-horizon coherence makes their use load-bearing.

4. **Weaknesses are routing constraints.** A model’s known context cliff, review miss pattern, over-agency, refusal behavior, or tendency to over-engineer is encoded in `must_not_receive` and escalation rules, not left as prose for a Director to remember.

5. **Verification and evaluation are separate.** Tests, linters, schema checks, renders, query plans, and tree hashes establish observable facts. A reviewer interprets those facts and looks for missing requirements. Neither substitutes for the other.

6. **Independence is mechanical.** Reviewer selection uses recorded author family. The reviewer gets a fresh, model-identity-blinded packet. A same-family result cannot satisfy a consequential gate.

7. **Risk outranks allowance.** Allowance pressure may change the author cast, defer work, or invoke a third vendor. It may not eliminate required review, bypass a human gate, or widen tool permissions.

8. **Control and execution are separated.** The Director owns routing, budget, permissions, arbitration, and communication. Specialists inspect or mutate. Reviewers evaluate. No role closes its own loop.

9. **Delegation is shallow and visible.** There are at most two model levels below the Director. Every child receives a structured packet and returns a durable artifact. Raw hidden reasoning is neither requested nor relayed.

10. **Failure is an explicit state.** `BLOCKED`, `UNAVAILABLE`, `PARTIAL`, and `ESCALATE` are valid outcomes. A missing reviewer or exhausted pool must never be represented as approval.

11. **Subscription pools are independent but operationally coupled.** Using one vendor to review another can balance load when both pools are healthy, but it also means exhausting one pool can block work authored by the other. Review reserves are therefore maintained in each pool.

12. **Irreversible authority stays human-controlled.** Production deployment, destructive data operations, credential changes, payments, external messages, legal acceptance, and equivalent side effects require explicit human approval regardless of model.

### Canonical task and risk taxonomy

Each intake receives exactly one task class. Risk and context are modifiers, not additional classes.

| Code | Canonical class | Deciding discriminator |
|---|---|---|
| O0 | Direction and decomposition | The output is a work graph, routing decision, integration decision, or go/no-go decision. |
| A0 | System architecture and novel algorithm design | The output is a technical design whose cross-system coherence is the primary challenge. |
| N0 | Simple fetch, find, and repository lookup | The answer is a bounded set of facts directly supported by paths, lines, symbols, or one source. |
| N1 | Deep external research | Multiple external sources must be found, reconciled, and cited. |
| N2 | Long-context synthesis | Correct use of more than roughly 100,000 relevant tokens or many dispersed documents is central. |
| I0 | Causal evidence investigation | The output is an evidence-backed explanation or hypothesis ranking; executing a live reproduction is not dominant. |
| I1 | Runtime, performance, race, or complex bug tracing | Reproduction, logs, profiling, timing, or stateful experimentation is required to find the cause. |
| E0 | Terminal, shell, CI, build, and environment operations | Correctly manipulating or diagnosing the execution environment is the primary artifact. |
| E1 | Mechanical code maintenance | The transformation is uniform, fully enumerable, reversible, and deterministically checkable. |
| E2 | Routine feature and fix implementation | A bounded specification exists and work fits within three subsystems without architectural invention. |
| E3 | Long-horizon implementation and repository-scale refactoring | The implementation crosses more than three subsystems, requires persistent coherence, or is expected to exceed one ordinary work order. |
| E4 | Data, schema, query, and migration engineering | Data shape, integrity, transactional behavior, or migration safety dominates. |
| E5 | Frontend and interactive UI engineering | The acceptance artifact is a rendered, interactive two-dimensional interface. |
| E6 | Spatial, 3D, procedural, and engine-integrated engineering | Geometry, scenes, assets, transforms, spatial systems, or procedural generation dominate. |
| E7 | Defensive security engineering | Threat modeling, vulnerability detection, hardening, or defensive patching dominates. |
| Q0 | Independent test design | The primary artifact is an independent oracle, test suite, fixture strategy, or mutation plan. |
| D0 | Documentation and contract engineering | The primary artifact is developer documentation, an interface contract, migration guide, or operational runbook. |
| M0 | Multimodal reference extraction | Images, video, audio, or PDFs are the source of truth and the output is a structured evidence specification. |
| R0 | Adversarial evaluation | The primary artifact is an independent verdict on another artifact. |

Risk is assigned separately:

- **T0 — inert evidence:** read-only lookup with no consequential inference.
- **T1 — bounded and reversible:** local changes with deterministic checks and no persistent data or public-contract implications.
- **T2 — consequential:** multi-subsystem behavior, public APIs, user-visible interactions, concurrency, security, persistent schemas, or material ambiguity.
- **T3 — gate-critical or irreversible:** production effects, deletion, secrets, legal or policy acceptance, releases, external communications, or high-impact security decisions.

All semantic source changes require opposite-vendor review. T2 and T3 conclusions, plans, tests, and non-code artifacts also require it. T3 additionally requires a human decision before the side effect.

### Role catalog

#### 1. Director

- **Purpose:** Convert intake into one canonical class, a bounded work graph, explicit permissions, an allowance budget, and an auditable final integration decision.
- **Casting:** Claude Opus 5 at medium effort; high only when classifying genuinely ambiguous or irreversible work. The dossier’s alignment, pushback, architecture, and difficult-debugging evidence outweighs Fable’s higher ceiling for continuous coordination.
- **Tool surface:** Agent dispatch, plan and blackboard writes, status/allowance reads, artifact reads, and user communication. No repository search, shell, source edit, browser operation, deployment, or direct production tool.
- **Demonstrated strengths:** Decomposition, rejecting unsound premises, technical judgment under ambiguity, and restrained irreversible-action behavior.
- **Weaknesses and failure modes:** Expensive as a volume worker; can over-design; can stall in terminal-heavy loops; shares family blind spots with Anthropic authors; may turn integration into another implementation pass.
- **Owns:** O0.
- **Must not receive:** Source changes, repository reconnaissance, terminal operations, direct review, detailed visual construction, or test execution. Those route to the corresponding specialist.
- **Escalation in/out:** Receives all new intake and all reclassification requests. Escalates unresolved architecture to the Systems Architect, environment-heavy uncertainty to the Terminal Operator, and T3 decisions to a human.
- **Review:** Routing records receive deterministic schema and policy validation. Any material plan or go/no-go decision is reviewed by R0 cast as Sol high. The Director may consume a signed verdict but may not replace it with same-family judgment.

#### 2. Systems Architect

- **Purpose:** Produce coherent technical architecture and novel-algorithm designs without implementing them.
- **Casting:** Claude Fable 5 at high effort. Its reported repository-scale, global-coherence, and visual/spatial ceiling justifies the expensive seat. If Fable is not included in the active Max/premium subscription, the declared fallback is Opus 5 high.
- **Tool surface:** Read-only repository access, documentation search, diagrams, design artifacts, and bounded experimental calculations. No source edit or production operation.
- **Demonstrated strengths:** Global representation, poorly understood systems, long-horizon coherence, architectural tradeoffs, and detecting locally attractive but systemically harmful designs.
- **Weaknesses and failure modes:** Slow, allowance-hungry, always-thinking, prone to unnecessary abstraction, classifier or fallback behavior in security-adjacent work, and unsuitable for repetitive implementation.
- **Owns:** A0.
- **Must not receive:** Routine code, terminal work, defensive security, mechanical edits, or high-volume review. Those go to E2, E0, E7, E1, or R0.
- **Escalation in/out:** Receives architecture questions from the Director or an executor whose scope changed materially. Escalates disputed assumptions to an evidence role and irreducible tradeoffs to a human.
- **Review:** Sol high in fresh context. A gate-critical blind dual-plan exercise may use Fable and Sol as independent authors only if a human or activated third-vendor arbiter performs synthesis; neither author may synthesize its own comparison.

#### 3. Repository Scout

- **Purpose:** Return a small, cited set of repository facts without causal interpretation.
- **Casting:** GPT-5.6 Luna low; medium only for a bounded multi-hop symbol trace.
- **Tool surface:** File listing, search, read, symbol lookup, version-control history reads, and read-only metadata commands.
- **Demonstrated strengths:** Very low allowance draw, fast bounded retrieval, high performance on crisply specified tasks, and useful image triage.
- **Weaknesses and failure modes:** Long-context recall cliff, premature conclusions, weak ambiguity handling, and failure on complex tool chains.
- **Owns:** N0.
- **Must not receive:** Root-cause analysis, more than approximately 100,000 relevant tokens, implementation, shell mutation, or architectural judgment. Route those to I0, N2, an executor, E0, or A0.
- **Escalation in/out:** Escalates after one incomplete search pass, conflicting evidence, or a request for “why.” Reclassifies to N2 for context volume or I0 for causality.
- **Review:** No model verdict is required for T0 facts. A machine checker verifies that every cited path, line, symbol, commit, or URL exists. Decision-bearing conclusions must be reissued through I0 or R0.

#### 4. Deep Researcher

- **Purpose:** Find, reconcile, and cite external evidence for technical decisions.
- **Casting:** GPT-5.6 Sol medium; high for safety-, architecture-, or procurement-relevant research. BrowseComp 92.2% and the reported long-context/tool profile make this spending load-bearing.
- **Tool surface:** Web search, browser, document/PDF retrieval, citation capture, read-only repository context, and structured evidence storage.
- **Demonstrated strengths:** Persistent browsing, source discovery, tool use, current information, and wide research loops.
- **Weaknesses and failure modes:** Can over-search, infer beyond cited evidence, prefer novel findings over representative ones, or confuse vendor claims with independent validation.
- **Owns:** N1.
- **Must not receive:** Repository edits, final architecture, legal acceptance, or simple one-source lookup.
- **Escalation in/out:** Raises effort once when independent research branches remain unresolved; escalates domain interpretation to A0, I0, E7, or a human.
- **Review:** Citation existence and quotation limits are checked mechanically. Decision-bearing synthesis is reviewed by Opus 5 high.

#### 5. Long-Context Analyst

- **Purpose:** Extract and reconcile facts from large or highly dispersed context without mutating the source.
- **Casting:** GPT-5.6 Terra medium, high only for dense cross-document inference. The reported MRCR difference—Terra 89.6 versus Luna 41.3—is the load-bearing evidence.
- **Tool surface:** Large document ingestion, repository and history reads, search, structured extraction, and evidence tables.
- **Demonstrated strengths:** Strong recall at large context, lower allowance draw than Sol, and disciplined structured output.
- **Weaknesses and failure modes:** Lower clean-pass performance on messy repositories, shallow causal interpretation, code-smell and security misses, and possible false synthesis when sources conflict.
- **Owns:** N2.
- **Must not receive:** Implementation, final architectural judgment, security approval, or complex runtime investigation.
- **Escalation in/out:** Escalates to Sol high when recall evidence is incomplete, and to I0 or A0 when the remaining problem is causal or architectural.
- **Review:** Opus 5 high reviews decision-bearing conclusions; extraction completeness is also checked against a seeded-document oracle.

#### 6. Evidence Detective

- **Purpose:** Establish why a system behaves as observed through explicit hypotheses and repository evidence.
- **Casting:** Claude Opus 5 high.
- **Tool surface:** Read-only repository and history access, dependency inspection, static-analysis results, logs supplied by other roles, and non-mutating diagnostic commands.
- **Demonstrated strengths:** Difficult root-cause reasoning, bug localization, performance interpretation, rejection of weak hypotheses, and understanding cross-subsystem consequences.
- **Weaknesses and failure modes:** Can overthink simple defects, anchor on an elegant explanation, consume substantial allowance, and stall when direct environment manipulation is required.
- **Owns:** I0.
- **Must not receive:** Source edits, prolonged shell reproduction, general lookup, or final review.
- **Escalation in/out:** Reclassifies to I1 when a live experiment becomes necessary, E0 when environment state dominates, or A0 when the defect exposes an architectural gap. Fable high is the ceiling for unresolved conceptual causes.
- **Review:** Sol high checks the evidence chain, attempts to falsify the leading hypothesis, and verifies that proposed fixes follow from the cause.

#### 7. Runtime and Performance Investigator

- **Purpose:** Reproduce and isolate complex bugs, races, performance regressions, and state-dependent failures.
- **Casting:** Claude Opus 5 high.
- **Tool surface:** Sandboxed test execution, profilers, traces, debuggers, logs, benchmarks, temporary instrumentation, read-only source access, and generated diagnostic artifacts. No permanent source edits.
- **Demonstrated strengths:** Difficult debugging, profiler interpretation, concurrency reasoning, and connecting runtime evidence to repository structure.
- **Weaknesses and failure modes:** Expensive; may perturb Heisenbugs with instrumentation; weaker than Sol in hostile shell environments; may propose a broad rewrite before the cause is experimentally isolated.
- **Owns:** I1.
- **Must not receive:** Permanent fixes, general terminal administration, simple static investigation, or review.
- **Escalation in/out:** Routes shell-dominated failures to E0, architecture failures to A0, and confirmed fixes to the appropriate executor. After two non-improving experiments, a Sol high environment probe is mandatory.
- **Review:** Sol high independently reproduces the failure or validates the trace and checks for alternative causes.

#### 8. Terminal and Environment Operator

- **Purpose:** Own terminal-heavy diagnosis and controlled shell, build, CI, dependency, and environment operations.
- **Casting:** GPT-5.6 Sol high; max only after a documented high-effort stall and never merely because a command failed once.
- **Tool surface:** Shell, package managers, build systems, CI clients, non-destructive version-control operations, container and sandbox tools, and environment inspection. Destructive or external operations remain approval-gated.
- **Demonstrated strengths:** Terminal-Bench leadership, persistence through tool failures, OS interaction, test loops, and environment repair.
- **Weaknesses and failure modes:** Over-agency, constraint violations, accidental scope expansion, concurrency mistakes, and possible mutation beyond the requested environment.
- **Owns:** E0.
- **Must not receive:** Repository-scale architecture, long prose, unbounded production administration, or self-review.
- **Escalation in/out:** One fresh Sol-max attempt is allowed when additional reasoning—not missing permission or specification—is the bottleneck. Otherwise escalate to I1, A0, or a human.
- **Review:** Opus 5 high reviews semantic effects. Every run receives an allow/deny command policy, before/after tree audit, process ledger, and integrity nonce.

#### 9. Mechanical Maintainer

- **Purpose:** Apply uniform, enumerable, deterministically verifiable repository transformations.
- **Casting:** GPT-5.6 Luna medium.
- **Tool surface:** Scoped source edits, formatters, codemods, generators, and specified tests. No package installation or architecture changes.
- **Demonstrated strengths:** High throughput, low allowance consumption, repetitive edits, structured generation, and bounded local fixes.
- **Weaknesses and failure modes:** Misses semantic exceptions, follows a flawed pattern consistently, loses orientation across dispersed files, and overreaches when the transformation is not truly uniform.
- **Owns:** E1.
- **Must not receive:** Feature ownership, ambiguous fixes, migrations, long-context work, or multi-subsystem design.
- **Escalation in/out:** Any exception to the transformation rule, non-local test failure, or scope growth reclassifies to E2 or E3. A failed deterministic pass may retry once as Terra medium before reclassification.
- **Review:** R0 cast as Haiku 4.5 with thinking off performs a cross-vendor constraint and diff check; deterministic transformation checks remain authoritative.

#### 10. Routine Product Engineer

- **Purpose:** Implement bounded features and fixes from a written specification and acceptance criteria.
- **Casting:** Claude Sonnet 5 medium; high only when the same bounded task contains unusually dense logic.
- **Tool surface:** Workspace source edits, local tests, linters, generators, non-destructive version control, and approved project tools.
- **Demonstrated strengths:** Production-oriented implementation, maintainability, responsiveness, and efficient execution behind a specification.
- **Weaknesses and failure modes:** Not a merge-bar architect; can accept a bad plan too readily; may stall on ceiling problems; tokenization and long outputs can erode apparent savings.
- **Owns:** E2.
- **Must not receive:** Architecture invention, more than three coupled subsystems, defensive security ownership, schema-critical migration, or prolonged runtime investigation.
- **Escalation in/out:** Escalates to Opus high after the stall detector fires and to E3 if scope becomes long-horizon. Environment failures reclassify to E0.
- **Review:** Sol medium for ordinary T1 changes and Sol high for T2 changes, always in fresh context with independent test execution.

#### 11. Long-Horizon Engineer

- **Purpose:** Implement repository-scale features and refactors while preserving coherence across many subsystems and checkpoints.
- **Casting:** Claude Fable 5 high; fallback Opus 5 high if the Fable subscription seat is unavailable.
- **Tool surface:** Full workspace editing within an explicit scope, tests, build tools, checkpoint commits, architectural artifacts, and delegation to at most three bounded N0, Q0, or E1 children.
- **Demonstrated strengths:** Reported SWE-bench Pro lead, global repository coherence, long autonomous trajectories, and handling incompletely understood systems.
- **Weaknesses and failure modes:** Expensive, slow, over-architectural, classifier-sensitive, and wasteful on work that could be decomposed into E2 tasks.
- **Owns:** E3.
- **Must not receive:** Routine edits, terminal-only repair, security work, or repetitive verification.
- **Escalation in/out:** Must checkpoint at each subsystem boundary. A scope change returns to the Director rather than silently growing. Terminal or runtime hard cores are delegated to E0 or I1; unresolved design returns to A0.
- **Review:** Sol high performs staged cross-vendor review at risk boundaries and final review over the complete pinned artifact.

#### 12. Data and Schema Engineer

- **Purpose:** Design and implement schemas, queries, data transformations, and reversible migrations with explicit integrity properties.
- **Casting:** GPT-5.6 Terra high.
- **Tool surface:** Source editing, local or isolated database instances, query planners, schema diff tools, fixtures, backups, migration dry runs, and data-integrity checks. No live production mutation.
- **Demonstrated strengths:** Structured reasoning, long-context handling, workhorse economics, and bounded implementation.
- **Weaknesses and failure modes:** Reported code-smell and vulnerability misses; may under-model rollback, locking, partial failure, or real data skew.
- **Owns:** E4.
- **Must not receive:** Production execution, broad system architecture, unrelated application features, or final security approval.
- **Escalation in/out:** Locking, performance, or race uncertainty goes to I1; architectural data redesign goes to A0; production execution requires T3 human approval and E0.
- **Review:** Opus 5 high reviews semantics and rollback. Deterministic verification must include forward migration, rollback or documented irreversibility, representative data, constraints, and query-plan checks.

#### 13. UI and Interaction Engineer

- **Purpose:** Build and verify rendered, interactive frontend experiences from behavioral and visual requirements.
- **Casting:** GPT-5.6 Sol high.
- **Tool surface:** Source editing, browser automation, screenshots, responsive viewports, accessibility tooling, component tests, and render-inspect-adjust loops.
- **Demonstrated strengths:** Top-band Design Arena evidence, strong browser/computer use, attention to interface anti-patterns, and persistent visual iteration.
- **Weaknesses and failure modes:** Can polish the wrong interaction model, overbuild frontend infrastructure, introduce non-visual logic defects, or satisfy one viewport while regressing another.
- **Owns:** E5.
- **Must not receive:** Backend architecture, spatial/3D systems, pure reference extraction, or unsupervised production release.
- **Escalation in/out:** Global visual ambiguity goes to M0 for evidence and A0 for system decisions; interaction-runtime bugs go to I1; backend work is split into E2 or E3.
- **Review:** Opus 5 high reviews behavior and code. The reviewer must inspect desktop, mobile, keyboard, loading, empty, and error states. If activated, M0 supplies independent Gemini visual-conformance evidence but does not replace R0.

#### 14. Spatial and Procedural Systems Engineer

- **Purpose:** Build spatial, 3D, engine-integrated, and procedural systems using code plus render inspection.
- **Casting:** Claude Opus 5 high.
- **Tool surface:** Source editing, engine or DCC tools, scene and asset inspection, renders, geometry statistics, import validation, runtime previews, and approved specialist skills.
- **Demonstrated strengths:** Visual-systems construction, technical debugging, multi-object reasoning, and integrating procedural logic with engine constraints.
- **Weaknesses and failure modes:** High allowance use, tendency to over-engineer pipelines, possible local correctness without global composition quality, and weaker terminal persistence than Sol.
- **Owns:** E6.
- **Must not receive:** Ordinary frontend work, raw reference extraction, repetitive asset edits, or final artistic approval.
- **Escalation in/out:** Reference ambiguity goes to M0; global composition or novel system design goes to A0; toolchain failures go to E0.
- **Review:** Sol high reviews code, imports, geometry statistics, render evidence, and runtime behavior. A human remains the final judge when aesthetic taste is an acceptance criterion.

#### 15. Defensive Security Engineer

- **Purpose:** Threat-model, find, and defensively patch security weaknesses within an explicitly authorized scope.
- **Casting:** GPT-5.6 Sol high; max for unusually difficult defensive analysis with a human-approved scope.
- **Tool surface:** Read-only scanners, isolated test environments, dependency auditing, fuzzing, static/dynamic analysis, and scoped source edits. No offensive deployment, persistence, credential use, or external targeting.
- **Demonstrated strengths:** The dossier’s strongest defensive-cyber recommendation, terminal/tool competence, and adversarial discovery.
- **Weaknesses and failure modes:** Over-agency, unsafe proof-of-concept expansion, false positives, and an incentive to demonstrate exploitability beyond what remediation requires.
- **Owns:** E7.
- **Must not receive:** Offensive exploitation, real-world intrusion, dual-use work outside policy, production secret handling, or sole release authority.
- **Escalation in/out:** T3 findings require a human security owner. Architecture flaws route to A0; runtime confirmation stays isolated and approval-gated.
- **Review:** Opus 5 high performs cross-vendor defensive review. Critical findings and production remediation also require a human security sign-off.

#### 16. Independent Test Designer

- **Purpose:** Construct an oracle independent of the implementation author, including tests, fixtures, invariants, and mutation targets.
- **Casting:** Author-aware at medium effort: Terra for Anthropic-authored implementation; Sonnet 5 for OpenAI-authored implementation; Sonnet 5 for Gemini-authored artifacts. The role is singular even though its cast is selected by the independence rule.
- **Tool surface:** Test and fixture edits, generators, property testing, mutation tools, coverage, isolated execution, and requirements access. The implementation diff is withheld until black-box tests are drafted when practical.
- **Demonstrated strengths:** Workhorse-level code generation, structured acceptance translation, and inexpensive parallel test construction.
- **Weaknesses and failure modes:** May mirror specification defects, encode current behavior rather than intended behavior, overfit visible implementation, or produce flaky and low-value coverage.
- **Owns:** Q0.
- **Must not receive:** Certification of tests it authored, architecture ownership, feature implementation, or release approval.
- **Escalation in/out:** Ambiguous expected behavior returns to O0 or A0. Mutation survivors route to the appropriate investigator or executor.
- **Review:** Deterministic mutation and flake testing are mandatory. R0 uses a model from a different family than the test author; for T3, human review is also required.

#### 17. Documentation and Contract Engineer

- **Purpose:** Produce accurate developer documentation, interface contracts, migration guides, and operational runbooks tied to verified behavior.
- **Casting:** Claude Sonnet 5 medium.
- **Tool surface:** Repository and history reads, documentation edits, example execution, link checking, API/schema extraction, and documentation builds.
- **Demonstrated strengths:** Maintainable production prose, implementation feasibility, and efficient translation from verified code to operational guidance.
- **Weaknesses and failure modes:** Can smooth over uncertainty, repeat stale comments, document intended rather than actual behavior, or omit destructive edge cases.
- **Owns:** D0.
- **Must not receive:** Legal acceptance, unverified current facts, system architecture, or implementation hidden inside a documentation order.
- **Escalation in/out:** Current external facts route to N1, public-contract disputes to A0, and legal or policy wording to a human.
- **Review:** Sol medium for semantic documentation and Sol high for public contracts or migration instructions. Pure spelling or generated-reference changes may use deterministic checks only.

#### 18. Multimodal Reference Analyst

- **Purpose:** Convert image, video, audio, and PDF source material into a cited, implementation-ready evidence specification.
- **Casting:** Gemini 3.7 Flash at high thinking through an authenticated Google AI Pro or Ultra Antigravity CLI seat, conditional on activation. The exact model id is `gemini-3.7-flash`. If activation fails, the role remains but falls back to Fable 5 high.
- **Tool surface:** Multimodal file input, frame extraction, screenshots, PDFs, structured measurements, evidence annotations, and read-only comparison tools. No repository mutation by default.
- **Demonstrated strengths:** Google reports native text/image/video/audio/PDF handling, a 1,048,576-token input window, improved reference adherence, WebDev Arena 1588, and DeepSWE 65.3. [Gemini 3.7 Flash announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-3-7-flash/) [Gemini 3.7 Flash model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)
- **Weaknesses and failure modes:** Evidence is largely vendor-reported; subscription availability and quota mechanics are opaque; its coding evidence does not justify replacing Sol, Opus, or Fable; a new model may regress or route silently.
- **Owns:** M0.
- **Must not receive:** General coding, final UI implementation, final architectural judgment, or review of Gemini-authored work.
- **Escalation in/out:** Ambiguous global visual interpretation goes to A0; implementation goes to E5 or E6. If the exact model cannot be pinned, the seat is disabled rather than silently accepting another Gemini model.
- **Review:** Opus 5 high reviews Gemini output. If Fable is used as fallback author, Sol high reviews it.

#### 19. Independent Adversarial Reviewer

- **Purpose:** Attempt to disprove correctness, completeness, safety, and scope compliance of another role’s artifact.
- **Casting:** Selected solely from the recorded author family and risk:

  - Anthropic author: Luna medium for purely mechanical T1 evidence; Sol medium for ordinary T1; Sol high for T2/T3.
  - OpenAI author: Haiku 4.5 without thinking for purely mechanical T1 evidence; Opus 5 high for code and T2/T3; Fable 5 high for architecture or global visual coherence when available.
  - Google author: Opus 5 high.
  - Unattributed or human artifact: Opus 5 high by default; Sol high supplies a second opinion at T3.

- **Tool surface:** Fresh read-only context, pinned checkout, diff and surrounding source, test execution in isolated writable build space, static analysis, browser/render inspection, and evidence capture. It may not edit the reviewed source.
- **Demonstrated strengths:** Cross-family error discovery, fresh-context skepticism, independent reruns, and explicit severity classification.
- **Weaknesses and failure modes:** Review hallucinations, preference bias, excessive blocking, failure to inspect enough surrounding code, Sol’s terse remediation comments, Fable’s cost and latency, and reviewer mutation.
- **Owns:** R0.
- **Must not receive:** Implementation, repair, same-family artifacts at T2/T3, or its own prior verdict as the sole basis for a repeated review.
- **Escalation in/out:** A contested blocker goes to an activated third vendor or a human. There are at most three review rounds; unresolved disagreement then becomes a human decision.
- **Review:** Verdicts are not recursively model-reviewed. Their cited evidence, executed commands, checkout identity, tree mutation audit, and nonce are machine-verified. A contested verdict is independently adjudicated rather than “reviewed by the reviewer.”

### Hierarchy and topology

```text
Human authority
└── Director: classifies, budgets, dispatches, integrates
    ├── Level 1 author/investigator/architect
    │   └── Level 2 bounded child: N0, E1, Q0, or M0 only
    ├── Deterministic verifier sidecar
    └── Fresh R0 reviewer chosen from the opposite vendor
```

The topology obeys these limits:

- The Director may have four active children by default and six at the hard cap.
- No more than two allowance-hungry calls—Fable, Opus high/max, or Sol high/max—run concurrently.
- A Level 1 lead may dispatch at most three Level 2 children.
- Level 2 agents cannot delegate.
- Reviewers cannot delegate and cannot repair.
- Authors cannot summon or select their own reviewer.
- Only A0, E3, I0, I1, E5, E6, and E7 leads may delegate. All other roles return to the Director if they need another role.
- Parallel mutation requires disjoint worktrees or explicitly disjoint path ownership. T2/T3 changes have one writer at a time.
- A task receives at most two solver handoffs and three review rounds before human escalation.
- Fan-out above six requires a separate human-approved batch policy and may contain only independent T0/T1 work.

The Director retains:

- canonical classification and risk;
- permission and destructive-action decisions;
- author and reviewer family selection;
- allowance reserves and degradation state;
- acceptance criteria and scope;
- work-graph ownership;
- final user communication;
- integration sequencing;
- decision to reclassify after evidence;
- human escalation.

The Director does not retain:

- repository exploration;
- coding;
- shell work;
- test execution;
- review;
- production operation;
- visual inspection;
- database mutation.

Every dispatch uses a task packet containing at least:

```yaml
task_id:
parent_id:
class:
risk:
objective:
acceptance_criteria:
scope_allow:
scope_deny:
source_refs:
known_state:
tool_capabilities:
destructive_actions:
author_family:
model_id:
effort:
allowance_budget:
deadline_or_timeout:
verification_commands:
review_policy:
escalation_triggers:
artifact_location:
integrity_nonce:
```

`author_family` is scheduler metadata and is omitted from the reviewer’s prompt. The reviewer sees the artifact, requirements, permitted scope, and evidence, but not vendor, model, effort, or price.

Every result packet contains:

```yaml
status: complete | partial | blocked | unavailable | escalate
summary:
artifact_refs:
paths_read:
paths_changed:
commands_run:
verification_results:
evidence:
assumptions:
residual_risks:
scope_variance:
recommended_next_class:
tree_identity:
integrity_nonce:
```

The shared blackboard stores packets, artifacts, test results, model ids, allowance observations, and decisions. It does not store hidden reasoning or ask workers to reveal it.

### Routing table

“AR” below means the Independent Adversarial Reviewer with its author-aware cast.

| Class | Primary role and default cast | Reviewer | Escalation path |
|---|---|---|---|
| O0 | Director — Opus 5 medium | AR — Sol high for material plans; schema audit otherwise | Opus high → Systems Architect → human |
| A0 | Systems Architect — Fable 5 high | AR — Sol high | Opus high fallback → human or blind dual-plan with neutral adjudicator |
| N0 | Repository Scout — Luna low | Machine citation checker | Luna medium → reclassify N2 or I0 |
| N1 | Deep Researcher — Sol medium | Citation checker; AR — Opus high when decision-bearing | Sol high → domain role → human |
| N2 | Long-Context Analyst — Terra medium | AR — Opus high | Terra high → Sol high → Opus high |
| I0 | Evidence Detective — Opus 5 high | AR — Sol high | Fable high; reclassify I1/E0 if live environment dominates |
| I1 | Runtime and Performance Investigator — Opus 5 high | AR — Sol high | Sol high environment probe → Fable architecture probe → human |
| E0 | Terminal and Environment Operator — Sol high | AR — Opus high | Sol max once → I1/A0 → human |
| E1 | Mechanical Maintainer — Luna medium | AR — Haiku no-think plus deterministic checks | Terra medium → reclassify E2/E3 |
| E2 | Routine Product Engineer — Sonnet 5 medium | AR — Sol medium/high | Sonnet high → Opus high → reclassify E3 |
| E3 | Long-Horizon Engineer — Fable 5 high | AR — Sol high at checkpoints and completion | Opus high fallback; split E0/I1 hard cores; then human |
| E4 | Data and Schema Engineer — Terra high | AR — Opus high | Sol high for tooling → A0/I1 → human production gate |
| E5 | UI and Interaction Engineer — Sol high | AR — Opus high; M0 may supply visual evidence | M0/A0 for ambiguity → I1 for runtime → human aesthetic gate |
| E6 | Spatial and Procedural Systems Engineer — Opus 5 high | AR — Sol high | M0 → Fable high architecture → E0 for toolchain |
| E7 | Defensive Security Engineer — Sol high | AR — Opus high and human for critical findings | Sol max → human security owner |
| Q0 | Independent Test Designer — Terra or Sonnet medium, opposite implementation author | AR opposite the test author; mutation oracle | Other-vendor workhorse → requirements owner/human |
| D0 | Documentation and Contract Engineer — Sonnet 5 medium | AR — Sol medium/high | N1 for current facts → Opus high → human legal owner |
| M0 | Multimodal Reference Analyst — Gemini 3.7 Flash high, conditionally active | AR — Opus high | Fable high fallback → human |
| R0 | Independent Adversarial Reviewer — author-aware cast | Machine evidence audit; third vendor/human if contested | Third vendor once → human |

### Review and escalation protocol

#### Mandatory versus preferred independence

Cross-vendor review is mandatory for:

- every semantic source change;
- A0 and E3 artifacts;
- T2 and T3 findings, plans, tests, migrations, and documentation;
- security, authentication, authorization, privacy, concurrency, public APIs, persistent data, release, and destructive-operation decisions;
- every Sol-authored mutation, due to the reported integrity and over-agency risks;
- final integration of independently authored subsystems.

Cross-vendor review is preferred but not mandatory for:

- T0 research;
- pure formatting, spelling, generated reference, or manifest-order changes with a complete deterministic oracle;
- interim hypotheses that cannot authorize work.

In the preferred category, omitting model review is acceptable only when a deterministic check proves the entire acceptance condition. If model review is requested anyway, it must use a different model; the default remains the opposite vendor.

#### Stall detector

Escalation fires when any two of the following are true, or immediately for a safety boundary:

- the same material error appears twice;
- a third architectural approach is proposed without new evidence;
- relevant tests are not improving;
- the worker requests a rewrite or reports loss of orientation;
- output exceeds three times the class median without new verification;
- the worker refuses, falls back, or cannot access a required tool;
- scope grows beyond three subsystems or the packet’s path boundary;
- the predicted allowance budget is exceeded by 50%;
- evidence conflicts with the current leading hypothesis;
- the exact requested model cannot be proven from the trace.

The escalation sequence is:

1. repair the packet if requirements or permissions were defective;
2. try one declared next rung at the same effort where a stronger model exists;
3. try one effort increase only when insufficient reasoning budget is evidenced;
4. move to the cross-vendor or ceiling specialist stated in the routing row;
5. request human resolution.

There is no repeated low→medium→high→max cycling on the same model.

#### Pool-exhaustion behavior

Each vendor has four scheduler states:

- **Green:** more than an estimated 40% of the current allowance window remains.
- **Amber:** 20–40%; stop using that vendor for optional authorship when an evaluated alternative exists.
- **Red:** below 20% or provider throttling begins; reserve remaining capacity for mandatory reviews and active-call completion.
- **Exhausted:** no new calls. Queue work requiring that vendor, use an activated third vendor or human where policy permits, and never substitute a same-family reviewer.

At least 25% of each premium vendor pool is reserved for reviews and incident work. Fable’s separately constrained weekly allowance is not used for routine tasks.

If OpenAI is exhausted, Anthropic-authored consequential work cannot close without Gemini or human review. If Anthropic is exhausted, OpenAI-authored consequential work faces the symmetric restriction. This coupling is intentional and must appear as `WAITING_FOR_INDEPENDENT_REVIEW`, not as task failure or approval.

### Cost model

#### Subscription basis

OpenAI work runs through Codex CLI signed into ChatGPT. The official Codex pricing page currently estimates, per rolling five-hour window:

- Sol: approximately 10–100 local messages on the entry subscription tier;
- Terra: approximately 25–200;
- Luna: approximately 250–2,000;
- higher-capacity 5× and 20× subscription tiers scale the available ranges.

Local and cloud use may share a window, task complexity changes consumption, and weekly caps may apply. These figures are therefore capacity estimates, not guaranteed calls. [Codex subscription pricing and limits](https://developers.openai.com/codex/pricing)

Anthropic Pro and Max usage is shared between Claude and Claude Code. Max has documented 5× and 20× capacity variants, with rolling and weekly limits, but no stable public per-model task count suitable for a precise scheduler. [Claude Code with Pro or Max](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) [Claude Max plan](https://support.claude.com/en/articles/11049741-what-is-the-max-plan)

Google Antigravity has a distinct Google allowance pool. Published material does not establish the exact number of Gemini 3.7 Flash agent actions available under each subscription. That pool must be learned empirically before activation.

#### Normalized allowance units

The pools cannot be converted into one dollar total. They are recorded separately:

- **OAU:** one bounded Luna-medium local work-order turn. Official local-message ranges and credit weights imply approximate equal-volume weights of Luna 1, Terra 8–10, and Sol 17–25 OAU. This is a proxy for draw on the OpenAI pool, not billing.
- **AAU:** one bounded Haiku no-thinking work-order turn. Reported API price ratios supply only a provisional proxy: Haiku 1, Sonnet 2–4, Opus 5–8, and Fable 10–16 AAU for comparable context. Always-on thinking and task length can move these materially.
- **GAU:** one Gemini 3.7 Flash high-thinking Antigravity work-order turn. No cross-model or cross-vendor conversion is claimed.

Task length multiplies these weights. The estimates below are starting budgets to be replaced by observed allowance movement from the first fifty accepted tasks.

| Class | Estimated author draw | Mandatory independent add-back | Main economy |
|---|---:|---:|---|
| O0 | 4–10 AAU | 8–20 OAU for a material plan | Medium-effort Director; trivial routing is schema-checked |
| A0 | 15–35 AAU | 12–30 OAU | Fable only where architecture is the artifact |
| N0 | 1–2 OAU | None | Luna plus deterministic citations |
| N1 | 8–20 OAU | 3–8 AAU when decision-bearing | Sol medium; review only the conclusions |
| N2 | 6–15 OAU | 4–10 AAU | Terra instead of Sol; extracted evidence reused |
| I0 | 6–15 AAU | 8–20 OAU | One strong hypothesis pass instead of repeated cheap guesses |
| I1 | 10–25 AAU | 10–25 OAU | Premium spend is load-bearing on causal isolation |
| E0 | 10–30 OAU | 4–12 AAU | Sol’s terminal completion rate avoids repeated lower-tier loops |
| E1 | 1–4 OAU | 1–2 AAU | Cheapest author and reviewer plus full deterministic oracle |
| E2 | 4–10 AAU | 5–15 OAU | Sonnet volume author; diff-focused Sol review |
| E3 | 18–45 AAU | 12–30 OAU | Checkpoints prevent paying for one failed monolithic run |
| E4 | 8–20 OAU | 5–12 AAU | Terra authors; Opus concentrates on integrity and rollback |
| E5 | 10–25 OAU | 5–12 AAU; optional 2–6 GAU evidence | One render-inspect loop, reused screenshots |
| E6 | 12–30 AAU | 8–20 OAU; optional 2–6 GAU evidence | Separate reference analysis from expensive engine implementation |
| E7 | 15–35 OAU | 8–18 AAU plus human time | No cheap substitution for defensive-security gates |
| Q0 | 5–12 OAU or 3–8 AAU | Usually absorbed by the implementation gate | Opposite-author workhorse plus mutation testing |
| D0 | 3–8 AAU | 3–8 OAU when semantic | Deterministic-only path for inert documentation |
| M0 | 2–8 GAU | 4–10 AAU | Separate third pool; Fable fallback costs 12–30 AAU plus Sol review |
| R0 | No author draw | 1–2 cheap units for mechanical work; 5–20 flagship units otherwise | Reviewer receives a compressed diff and acceptance packet |

These are estimates, not provider quotas. The scheduler logs actual provider window state, messages, wall-clock time, retries, context size, and accepted-result status.

#### Where savings come from

- N0 and E1 consume Luna rather than premium capacity.
- Routine implementation remains on Sonnet; Terra is reserved for long context and data work.
- Fable is not the permanent Director or default executor.
- The Director receives summaries and artifact references rather than repeated repository dumps.
- Reviewer packets contain the exact diff, acceptance criteria, surrounding dependency slice, and verification manifest rather than the author’s full transcript.
- Deterministic checks eliminate model review only where they prove the entire T0 or inert-document acceptance condition.
- Vendor stickiness is maintained during authorship so cached context is not repeatedly reconstructed.
- Checkpointed E3 work allows review and rollback at subsystem boundaries.
- The stall detector stops unproductive cheap-model loops before their accumulated allowance exceeds a correct premium attempt.
- The existing transport integrity, pinned-checkout, and process-completion rules are retained because a silent or stale result wastes an entire expensive round.

The dossier proposes 40–60% cheap-swarm calls, 25–40% workhorse calls, 5–8% Director calls, 3–7% ceiling calls, and 3–8% cross-vendor review calls. The stricter review mandate will likely raise review to an estimated 8–15% of calls. That increase is intentional. If Director plus ceiling work exceeds 70% of normalized consumption, routing is considered unhealthy. If review exceeds 20% of calls, review packets and batching should be optimized before weakening the mandate.

#### Cost of de-correlation

A mandatory opposite-vendor review adds:

- one sequential model run after the artifact stabilizes;
- an estimated 20–60% of the author’s context-equivalent allowance in the other vendor’s pool;
- approximately 5–20 minutes for a routine change and 20–90 minutes for a gate-class artifact, as an operational estimate to be measured;
- a possible third-vendor or human round for contested blockers.

The cost helps when the reviewer pool is otherwise underused and hurts when it is already near exhaustion. The 25% review reserve prevents authorship from consuming the capacity needed to close the other vendor’s work.

### Deltas from the current roster

| Current system | Proposed delta | Reason |
|---|---|---|
| `scout` is Haiku and broadly owns cheap reconnaissance. | Replace its public contract with N0 Repository Scout on Luna low; retain Haiku as the cheap opposite-vendor mechanical reviewer. | Luna’s allowance economics are strongest for bounded retrieval, while explicit hard filters keep it away from long context and causality. |
| `detective` is one Opus read-only causal role. | Split it into Evidence Detective and Runtime/Performance Investigator. | Static causal reasoning and experiment-heavy bug tracing need different tools, scope rules, and escalation triggers. |
| `executor` is Sonnet and covers most implementation. | Retain Sonnet’s routine role but split mechanical, shell, long-horizon, data, UI, spatial, security, tests, and documentation into distinct contracts. | A generic executor cannot express the nuanced strengths and failure modes required for reliable routing. |
| `executor-heavy` and `executor-heavy-xhigh` are separate effort-named roles. | Retire both names. Use Systems Architect, Long-Horizon Engineer, Runtime Investigator, and other capability roles with explicit effort policies. | Effort is a cast property, not a task purpose. |
| `reviewer` is Opus by default, including review of Anthropic-authored work. | Replace it with author-aware R0. Same-family review cannot close consequential gates. | Fresh context alone does not remove vendor-family correlation. |
| OpenAI reviewer and executor roles are optional `packs/codex` additions named after their engine. | Keep the transport adapter but expose capability roles rather than `executor-codex`, `executor-codex-heavy`, or `reviewer-codex` as routing concepts. | Runtime names leak plumbing into task classification and encourage model-first routing. |
| `specialists/modeler` combines reference interpretation, procedural modeling, engine integration, and visual judgment. | Split it into M0 Multimodal Reference Analyst and E6 Spatial/Procedural Systems Engineer. | Reference understanding and code/tool construction require different evidence, models, and reviewers. |
| `architect-claude`, `architect-codex`, and `plan-synthesizer` implement blind cross-plan machinery. | Retain blind independence, but forbid a synthesizer that shares a family with either high-stakes author from acting as neutral adjudicator. Use a third vendor or human. | A two-author comparison does not satisfy de-correlation if one author’s family evaluates the merge. |
| Cross-vendor review is optional at gates. | Make it mandatory for semantic code and T2/T3 artifacts. | This is required by the new architecture’s quality invariant. |
| `.claude/orchestra.json` primarily exposes Codex transport settings such as timeouts and engine selection. | Add a declarative capability registry, task taxonomy, author-review matrix, risk policy, fan-out caps, allowance reserves, fallback casts, and activation state. | The present configuration cannot express the new routing or cost policy. |
| The guard recognizes Fable/Opus Director sessions and blocks direct work. | Preserve mechanical Director isolation, but derive Director identity and tool policy from the active capability registry. | A fixed model-name check cannot safely support recasting or another runtime. |
| Master Claude and Codex-native rosters are separately materialized. | Generate both from one runtime-neutral role registry with provider adapters. | Prevent responsibility, effort, and review-policy drift between runtimes. |
| The installer already lints frontmatter and installs optional packs. | Extend validation to role uniqueness, model availability, family metadata, review invariants, and fallback completeness. | Silent agent unloads and invalid cross-vendor paths must fail installation. |
| Typed MCP transport, pinned reviews, report integrity, tree audits, process ledgers, and doctor checks were added through recent releases. | Preserve and generalize these mechanics to every provider adapter, including conditional Google support. | They address observed silent failure, stale report, moving-tree, and unfinished-process defects. |
| Current plan/review/status skills describe the fixed company. | Rewrite their contracts around canonical class, risk, author family, allowance state, and signed review verdict. | Skills must expose the same architecture as the protocol and registry. |

No repository files are changed by this design exercise.

## Work plan

1. **Freeze live access and capability facts.**  
   **Depends on:** nothing.  
   Record the exact model ids exposed by Claude Code, Codex CLI, and Antigravity; subscription seat type; rolling/weekly allowance visibility; effort controls; context limits; tools; and whether each CLI permits the intended non-interactive subagent workload. Test Fable and Gemini paths first because they are the riskiest availability assumptions. Produce an immutable capability ledger with observation date and evidence.

2. **Build the canonical routing corpus.**  
   **Depends on:** Step 1.  
   Assemble 30–50 representative tasks covering every canonical class and all four risk tiers, plus deliberately ambiguous boundaries such as N0/I0, I0/I1, E1/E2, E2/E3, E5/E6, and M0/E5. Give each task one human-approved primary class and acceptance oracle.

3. **Encode the role registry and exclusive routing rules.**  
   **Depends on:** Steps 1–2.  
   Translate every role above into a runtime-neutral schema containing purpose, primary class, cast, effort, tools, strengths, weaknesses, forbidden classes, escalation, reviewer policy, and fallback. Reject duplicate primaries and missing classes at schema-validation time.

4. **Specify the review and risk policy as enforceable data.**  
   **Depends on:** Step 3.  
   Encode author family, reviewer-family selection, review tier, T3 human gates, blinded reviewer packets, maximum rounds, severity semantics, and forbidden same-family fallbacks. Define how third-vendor and human adjudication are represented.

5. **Specify topology, work packets, blackboard state, and allowance scheduling.**  
   **Depends on:** Steps 3–4.  
   Encode two-level delegation, fan-out and premium-concurrency caps, single-writer rules, packet schemas, checkpoint requirements, pool states, review reserves, and honest unavailable states.

6. **Map the architecture onto the reference harness.**  
   **Depends on:** Steps 3–5.  
   Produce an implementation map for `ORCHESTRA.md`, `agents/`, `.claude/agents/`, `codex/agents/`, optional packs, hooks, skills, configuration, installers, and tests. Preserve current integrity and transport behavior. Define a migration alias for every retired role so outstanding work orders fail clearly rather than silently.

7. **Run model and effort trials before changing defaults.**  
   **Depends on:** Steps 1–5.  
   Evaluate the primary and declared fallback cast on each corpus slice. Use deterministic or human gold results; never let a tested model or same-family evaluator score a consequential output. Measure accepted result, major-defect escape, stalls, retries, wall time, and separate OAU/AAU/GAU draw.

8. **Shadow the router and review matrix against the current harness.**  
   **Depends on:** Steps 6–7.  
   For real tasks, let the current harness execute while the new policy independently predicts class, cast, review path, allowance draw, and escalation. Compare predicted and observed outcomes without granting new roles mutation authority.

9. **Canary the new company by risk tier.**  
   **Depends on:** Step 8 passing its gates.  
   Enable T0 and E1 first, then bounded T1 implementation, then T2 specialists. Keep T3 human-gated throughout. Gemini remains disabled until its separate activation test passes.

10. **Promote, govern, and recalibrate.**  
    **Depends on:** Step 9 satisfying whole-system acceptance gates.  
    Make the capability registry the source of truth, retain old-role aliases for one release, publish rollback instructions, and schedule monthly capability/allowance audits plus immediate audits when a provider changes a model snapshot, plan limit, or CLI transport.

## Risks and failure modes

| Risk | Failure mode | Detection and response |
|---|---|---|
| Benchmark mismatch | Public scores fail to predict this harness, repository, or prompt. | Use the routing corpus and accepted-result metrics. Public numbers establish priors only. |
| SWE-bench Pro defects | Fable is over-cast because a disputed benchmark drives the decision. | Require internal E3 advantage before enabling Fable as primary; otherwise use Opus fallback. |
| Subscription quota opacity | Estimated AU weights do not match actual per-seat depletion. | Record status before and after every trial, use broad bands, and replace estimates after fifty tasks. |
| Shared-product usage | Human chat activity consumes the same pool and invalidates scheduler estimates. | Treat status as live state, not a calendar budget; reserve capacity and log non-harness activity when observable. |
| Fable access mismatch | A Pro seat unexpectedly incurs credits or cannot invoke Fable. | Fail the Step 1 gate and cast A0/E3 as Opus high. Do not use metered credits implicitly. |
| Gemini availability mismatch | Antigravity does not expose the exact model, silently routes another model, or has unusable limits. | Pin and log the exact model id; disable M0’s Gemini cast on any ambiguity. |
| Third-vendor immaturity | Gemini’s vendor-reported gains do not survive independent testing. | Require the activation gate; keep Fable fallback and do not assign general coding. |
| Role proliferation | Similar tasks route inconsistently or incur needless handoffs. | Enforce one primary per class and test boundary cases. Merge roles only if their class, tools, weaknesses, and review paths converge empirically. |
| Misclassification | Cheap roles receive ambiguous or high-context work. | Hard context/tool filters, routing-confidence logging, and Director reclassification after one failed pass. |
| Review bottleneck | Mandatory review exhausts the other vendor pool or dominates latency. | Maintain 25% reserves, compress packets, batch only independent artifacts, and queue rather than weaken the gate. |
| Correlated fallback | A transport failure quietly sends work to a same-family reviewer. | Validate actual model family in the signed trace. Treat mismatch as `REVIEW_UNAVAILABLE`. |
| Reviewer authority creep | A reviewer edits code, chooses its successor, or becomes the de facto implementer. | Read-only source policy, tree audit, no delegation, and a mandatory new author round for repairs. |
| Review recursion | Every verdict triggers another reviewer indefinitely. | Machine-audit reviewer evidence; use one third-vendor or human adjudication only when contested. |
| Sol over-agency | Terminal or security work mutates outside scope. | Path and command allowlists, sandboxing, one writer, tree audit, process ledger, nonce, and human approval for external effects. |
| Fable or Opus over-engineering | A bounded problem becomes an architecture project. | Diff, subsystem, and allowance budgets; route E2 to Sonnet; return scope growth to the Director. |
| Luna context failure | Cheap retrieval confidently omits distant evidence. | Hard N2 threshold, citation completeness tests, and no effort-only workaround. |
| Test correlation | Tests encode the implementation author’s assumptions and miss the same defect. | Opposite-family test author, black-box-first drafting, mutation testing, and independent review. |
| Long-horizon state loss | E3 loses orientation across checkpoints or parallel children. | Durable blackboard, subsystem checkpoints, single integration owner, and maximum three bounded children. |
| Moving review target | Review covers a different tree than the artifact eventually shipped. | Pinned commit or immutable tree identity, dirty-tree detection, and final integration review. |
| Stale or fabricated reports | A launcher relays prior output or claims work absent from the tree. | Preserve nonce round-trip, tree audit, artifact existence checks, and explicit transport attribution. |
| Hidden model routing | Provider-side aliases or fallbacks invalidate family and capability assumptions. | Log resolved model id and date per call; fail closed where identity cannot be established. |
| Unsafe degradation | Allowance exhaustion causes an unreviewed release. | Exhausted states block the gate; only a human or qualified third vendor can unblock it. |
| Human bottleneck | T3 and two-vendor disagreements wait indefinitely. | Surface a concise decision packet with evidence, alternatives, and consequence of delay; never invent approval. |
| Runtime coupling | Role definitions depend on one CLI’s flags or filesystem layout. | Keep capability schema transport-neutral and test provider adapters independently. |

## Verification

### Step-level proof

1. **Step 1 — access ledger:** A reviewer can invoke each provider’s model selector and a no-op agent turn, capture the resolved model id, effort, subscription identity, status before/after, and exit behavior. Fable and Gemini are marked enabled only when the exact subscription path succeeds without an API key.

2. **Step 2 — routing corpus:** The corpus contains at least two cases for every class and every ambiguous boundary. Two human reviewers agree on the primary class or record an adjudication rule. No task has two primaries or none.

3. **Step 3 — registry:** A new schema test loads every role, asserts all nineteen classes occur exactly once as primary ownership, validates model and effort values against the capability ledger, and rejects incomplete weakness, prohibition, escalation, or reviewer fields.

4. **Step 4 — review policy:** A matrix test enumerates every author family × risk tier × artifact type. It must find zero self-review routes and zero same-family T2/T3 routes. Seeded artifacts containing correctness, security, scope, and test defects measure major-defect recall.

5. **Step 5 — topology and scheduler:** Simulation rejects a third model depth, fan-out above policy, more than two concurrent premium calls, reviewer delegation, and parallel writers to overlapping paths. Chaos cases exhaust each pool independently and must produce a qualified third-vendor route, human gate, or explicit wait state.

6. **Step 6 — harness mapping:** After implementation, run the existing suites:

   - `node tests/frontmatter-lint.test.js`
   - `node tests/review-lane.test.js`
   - `node tests/exec-lane.test.js`
   - `node tests/mcp-lane.test.js`
   - `node tests/scan-lane.test.js`

   Add routing-registry, review-invariant, provider-identity, topology, and allowance-degradation suites. Install into clean fixtures for each supported runtime and compare generated role semantics against the single registry.

7. **Step 7 — casting trials:** Each cast completes the same blinded task set. Scoring uses deterministic acceptance, independent human judgment, or a different-vendor evaluator. Report acceptance rate, 95% confidence intervals where sample size permits, major defects, stalls, retries, wall time, and separate pool draw.

8. **Step 8 — shadow mode:** At least fifty real tasks produce both current and proposed routing records. Investigate every class disagreement and every case where the proposed cast would have increased severity or allowance. No mutation authority is granted from shadow predictions.

9. **Step 9 — canary:** T0/E1 canary must have no scope escapes and no accepted-result regression. T1/T2 promotion requires the quality and review gates below. A kill switch restores the previous roster without altering the working tree’s user changes.

10. **Step 10 — governance:** Monthly reports show model ids, class volumes, primary/fallback usage, pool depletion, review catches, false blockers, stalls, and policy violations. Any provider model or allowance change invalidates the relevant capability-ledger entry until rechecked.

### Whole-system acceptance gates

The architecture is proven ready only when all of the following hold:

- 100% of canonical tasks route to exactly one primary role.
- Zero audited cases use the author model to evaluate itself.
- Zero T2/T3 cases use a same-family reviewer.
- 100% of semantic source changes have deterministic verification plus a signed independent verdict.
- 100% of T3 side effects have recorded human approval.
- Routine accepted-result rate is no more than 2 percentage points below the best unrestricted cast on the internal corpus.
- T2/T3 major-defect escape is no worse than the current harness; statistical uncertainty is reported rather than rounded into a claim of parity.
- Seeded major-defect recall is at least 90%, and false blocker rate is at most 10%. These are proposed operational thresholds.
- Cheap roles account for 40–60% of calls unless the measured project mix justifies another band.
- Director plus ceiling roles remain below 70% of normalized consumption.
- Premium allowance per accepted T1 task is at least 35% below an all-frontier baseline without violating the quality gates.
- Pool-exhaustion tests never yield false approval or same-family substitution.
- Pinned reviews attest to the shipped tree identity.
- Integrity-nonce, tree-audit, transport-failure, unfinished-process, and stale-report tests all fail closed.
- Gemini activates only after at least twenty multimodal tasks show acceptance within 3 points of the best two-vendor alternative, exact model pinning, and operationally usable quota. Otherwise the role uses its declared fallback.

## Assumptions and open questions

### Assumptions

- Anthropic and OpenAI subscription terms permit the intended multi-agent CLI use from one authorized seat. This must be confirmed during Step 1; it is not inferred from API availability.
- The active Anthropic seat may be Max or premium. If it is only Pro, included Fable access is not assumed.
- Codex CLI exposes Sol, Terra, and Luna under the subscription account and records a resolvable model id.
- Provider status information is sufficiently observable to derive coarse Green/Amber/Red/Exhausted states. Exact percentage estimates may require empirical inference.
- OpenAI’s local-message ranges and provider credit ratios are useful relative allowance proxies, not guarantees or monetary charges.
- Anthropic API price ratios are only provisional relative weights for subscription consumption.
- Google AI Pro or Ultra can authenticate Antigravity CLI, but exact included access to Gemini 3.7 Flash and its multi-agent allowance are unverified assumptions until the activation probe.
- A human authority is available for T3 approval and unresolved two-vendor disagreements.
- The runtime can record actual author family and resolved model id outside the blinded reviewer prompt.
- No API-only models, provider API keys, or metered per-token paths are required by the default design.
- Existing integrity and transport mechanisms can be generalized without weakening their fail-closed behavior.

### Open questions

- Which Claude, ChatGPT, and Google subscription tiers are actually installed on the target machine?
- Are provider status readings available in a machine-readable form, or must the scheduler use conservative user-supplied bands?
- Which project-specific operations are T3 beyond the default list?
- Do confidentiality, retention, regional, or zero-data-retention requirements prohibit any vendor for particular repositories?
- Is Google’s separate seat worth its fixed subscription cost after the M0 trial, even if its allowance consumption is low?
- Which internal repositories and task histories should seed the 30–50-task evaluation corpus?
- What human response-time objective applies to blocked T3 and contested-review decisions?
- Should pure documentation and generated-reference changes remain eligible for deterministic-only closure, or should local policy require a cross-vendor pass on every repository mutation?
- What retention period is required for packets, model identities, usage observations, and review evidence?
- Is the current Director guard expected to support mid-session model switching, or should a model change terminate and restart the orchestration session?
