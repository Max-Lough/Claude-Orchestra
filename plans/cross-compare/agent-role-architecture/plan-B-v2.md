# Plan: Capability-Routed Cross-Vendor Agent Company

## Summary

The proposed architecture is a bounded, capability-routed company of nineteen model roles plus one explicitly non-agent deterministic verification substrate. Claude Opus 5 at medium effort is the standing Director, with a constrained GPT-5.6 Sol medium control-plane mirror for Anthropic-pool exhaustion. Cheap specialists handle bounded reconnaissance and mechanical changes; workhorse models perform routine implementation and independent test design; premium specialists own architecture, difficult investigation, terminal work, visual systems, security, consequential data migrations, and long-horizon engineering.

Every work order has exactly one canonical task class and one primary role. An intake may decompose into several work orders—for example, an E2 implementation plus a companion Q0 test-design order and an R0 review order—without violating class uniqueness. Risk, supplied-context shape, tool requirements, and allowance state modify effort, review, or fallback policy but do not create competing primaries.

The governing quality rules are:

1. deterministic evidence precedes model judgment;
2. every semantic source change receives a fresh-context review;
3. consequential artifacts receive an opposite-vendor reviewer selected from recorded author family;
4. independent test design is mandatory for specified risk and task classes;
5. irreversible actions and unresolved cross-vendor disputes require human approval;
6. a safety gate is deployable only after its throughput and recovery path are proven live.

No model judges its own output. No same-family verdict may close a consequential gate. The rule does not weaken under allowance pressure: the scheduler may throttle authorship, use a qualified cheaper reviewer, invoke a separately qualified third-vendor reviewer, wait, or escalate to a human. It may not represent correlated review as independent approval.

Anthropic and OpenAI are the required subscription pools. Gemini 3.7 Flash receives a conditional multimodal role through Google Antigravity and may become a review-capacity relief lane only after a separate code-review qualification; multimodal qualification alone is insufficient. Google now documents `gemini-3.7-flash` in Antigravity across Free/AI Plus, AI Pro, AI Ultra, and Enterprise plans, but exact per-seat task throughput still requires measurement. [Antigravity model availability](https://antigravity.google/docs/models/)

The architecture preserves the current harness’s strongest mechanics—Director isolation, shallow delegation, structured work orders, pinned reviews, tree audits, integrity nonces, process ledgers, heartbeats, typed cross-vendor transport, and explicit sweep steps—while replacing effort-named roles, optional vendor de-correlation, the API-billed deep-plan path, and duplicated runtime rosters with capability contracts, an author-aware review matrix, a subscription-only transport policy, and measured allowance scheduling.

## Approach

### Evidence base and adjudications

The following ground-truth documents were read in full:

- `research/openai-models.md`
- `research/cross_vendor_agent_harness_roster_summary.md`
- `research/dossier_both.md`
- `CROSSPLAN-GOAL.md`

Repository reconnaissance covered the master and installed protocols, the core and optional agent rosters, the Codex-native mirror, skills, configuration, guard hooks, installer, tests, README, changelog, and relevant history. Confirmed current-tree facts include:

- the core roster is `scout`/Haiku, `detective`/Opus, `executor`/Sonnet, two effort-named Opus heavy executors, and an Opus reviewer;
- cross-vendor review and execution are optional through `packs/codex`;
- `planner-gpt`, `/deep-plan`, and `orchestra-deepplan.js` directly call `/v1/responses` using `OPENAI_API_KEY`, so that lane is metered API usage outside the deployment basis;
- `ORCHESTRA.md` already requires a terminal sweep after parallel fan-out;
- report nonces, tree audits, pinned review worktrees, and typed MCP transport are implemented and tested;
- separately materialized copies have already drifted: the master `packs/codex/agents/architect-claude-xhigh.md` uses Fable without web tools, while the installed `.claude/agents/architect-claude-xhigh.md` uses Opus with web tools; the plan-synthesizer copies also differ in model and effort.

Current official OpenAI guidance positions Sol for frontier work, Terra for balanced production work, and Luna for high-volume bounded work; all expose the `none` through `max` effort ladder. [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model) Codex supports ChatGPT sign-in for subscription access and API-key sign-in for usage-based access; the default architecture permits only the former. [Codex authentication](https://learn.chatgpt.com/docs/auth)

Official Codex estimates currently range from 10–100 Sol, 25–200 Terra, and 250–2,000 Luna local messages per five-hour window on Plus or Business-style entry allowances, with 5× and 20× subscription tiers scaling those bands. The ranges are not complete-review counts: context, effort, tools, retrieval, caching, and task complexity all affect usage. [Codex pricing and plan limits](https://learn.chatgpt.com/docs/pricing)

Anthropic documents shared Claude/Claude Code limits, five-hour session resets, weekly limits, and 5×/20× Max tiers. It recommends Sonnet for most coding, Opus for hard refactors, debugging, and architecture, and Haiku for quick lookup and high-volume work. [Claude Code model usage](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code) Fable is included only on Max or premium seats and may consume up to half the weekly allowance; Pro and standard seats use separately billed credits, which are outside this default design. [Fable subscription availability](https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan)

The evidence disagreements are adjudicated as follows.

| Question | Evidence and disagreement | Decision | Reversal condition |
|---|---|---|---|
| Permanent Director | The dossier favors Opus 5 for alignment, pushback, architecture, and irreversible-action restraint. Fable has the higher ceiling but greater latency, allowance draw, and classifier risk. | Opus 5 medium directs; high is reserved for ambiguous or irreversible classification. | Recast if a harness-native Director trial improves accepted outcomes by at least 5 points, does not worsen authority behavior, and uses no more than 1.5× normalized allowance. These are proposed thresholds. |
| Director depletion | The first design had no fallback, although every degradation decision depends on a live Director. | Add a Sol-medium control mirror with a durable handoff checkpoint and restricted semantic authority. | Remove the mirror if it cannot resume without policy drift or if an independent audit finds same-family gate closure. |
| Long-horizon engineering | `research/openai-models.md` reports Fable near 80.0% on SWE-bench Pro versus Sol at 64.6%; `research/dossier_both.md` warns that the benchmark contains disputed tasks. | Fable high owns A0/E3 only after an internal repository-scale trial; Opus high is the subscription-safe fallback. | Move primary ownership if Fable’s accepted-result advantage is below 3 points or normalized allowance per accepted task exceeds 2× the alternative. |
| Routine coding | Sonnet 5 and Terra are reported near 63.2% and 63.4% on SWE-bench Pro. Anthropic recommends Sonnet for most coding. | Sonnet medium remains E2 primary, preserving OpenAI capacity for review. Terra is the evaluated depletion mirror. | Prefer Terra when project trials are within 2 points of Sonnet and the pool forecast materially improves. |
| Cheap reconnaissance | Luna has excellent bounded-work economics, but cross-vendor pool units are not convertible and OpenAI capacity is the review bottleneck. The current roster already uses Haiku for scouting. | Haiku no-thinking is N0 primary; Luna low is a pool-aware mirror. Neither receives an unbounded haystack. | Prefer Luna if measured omission, latency, and pool-liveness results beat Haiku without threatening OpenAI review reserve. |
| Sol versus Terra for review | The 63.7% Sol and 40.7% Terra CodeRabbit figures are authoring clean-pass scores (`research/openai-models.md:85,289`), not review recall. The actual 105-task review suite reports Sol at 65 actionable catches versus 66 for Opus 4.8/humans, and 74 versus 72 full passes (`research/openai-models.md:122–123`). No Terra review score is supplied. | Sol remains the evidenced flagship reviewer. Terra medium may close T1 Anthropic-authored gates only after a seeded-defect qualification; it is not excluded on the authoring score. | Qualify Terra if major-defect recall is within 5 points of the Sol-medium internal baseline, no critical seed is missed, and false blockers are at most 10%. |
| Review throughput | Official message ranges do not establish reviews per window, and a fixed 25% reserve cannot guarantee liveness. | Make an early review-capacity probe and a final liveness SLO mandatory. Reserve is forecast-driven, with 25% only a floor. | Universal semantic review is not activated on a seat that fails capacity; provision a larger tier, reduce author arrival, qualify Terra/Gemini, or staff human review. |
| Terminal work | Supplied reports use saturated Terminal-Bench 2.1 and favor Sol. Current Terminal-Bench 3.0 reports Opus 5 max at 42.7%, Sol max at 34.6%, Fable max at 34.1%, Terra max at 20.8%, while Sol remains cheaper and action-efficient. [Terminal-Bench 3.0](https://www.frontierbench.ai/) | Sol high remains the default terminal operator; a strategy-level stall escalates to Opus high/max rather than another Sol-max loop. | Recast primary ownership if harness-native terminal acceptance favors Opus by more than 5 points at no more than 2× allowance per accepted task. |
| Long context | The dossier reports Terra at 89.6 and Luna at 41.3 on MRCR. | Terra medium owns N2. Luna is filtered by supplied context and search coverage, not by a guessed count of “relevant” tokens. | Reconsider only if a harness-native haystack test puts Luna within 3 points with no unsupported conclusion. |
| Data and migration work | Terra has direct structured-data and long-context evidence, but the original role itself identified rollback, locking, partial failure, and skew as its failure modes. Opus is reported most careful with irreversible effects and strongest at bug/performance investigation. | Opus high owns E4. Terra high may mirror only reversible T1 query or transformation work after an explicit risk-first design. | Restore Terra as general primary only if migration trials match Opus within 3 points on rollback, locking, skew, and partial-failure oracles while materially reducing allowance. |
| UI versus visual systems | `research/openai-models.md:181–187` supports Sol’s top-band generated-UI performance. `research/cross_vendor_agent_harness_roster_summary.md:269,287–302` assigns Opus interactive UI, procedural mesh, engine, shader, and render-feedback work. | Split by acceptance artifact: Sol owns rendered 2D interaction (E5); Opus owns geometry, engine-integrated spatial systems, and procedural render loops (E6). | Move either class only after domain-specific render-and-behavior trials show a greater than 3-point accepted-result advantage. |
| Cross-vendor review | The current harness makes vendor de-correlation optional; fresh Opus review of Sonnet work remains same-family. | Opposite-vendor review is mandatory for semantic code and consequential artifacts. Capacity changes scheduling, not independence. | Only a human-authorized policy change may weaken the invariant. |
| Gemini 3.7 Flash | Google documents text/image/video/audio/PDF input, 1,048,576 input tokens, high thinking, FrontierCode 43.6%, DeepSWE 65.3%, and WebDev Elo 1588. Evidence is vendor-reported, and the model card says it can complete individual coding tasks but lacks end-to-end research independence. [Gemini model card](https://deepmind.google/models/model-cards/gemini-3-7-flash/) | Conditionally cast Gemini into M0. Separately qualify it for T1/T2 review relief; do not infer review skill from multimodal or authoring scores. | Disable each capability independently if exact pinning, acceptance, quota, or liveness gates fail. |
| M0 fallback | No supplied evidence proves native audio/video input for Fable, Opus, or Terra. | Use Terra medium only for still images, rendered PDF pages, and pre-extracted text. Raw audio/video becomes `UNAVAILABLE` unless Gemini or an approved preprocessing path is available. | Add another fallback only after its exact modality and subscription path are verified. |

### Design principles

1. **Classify work orders before casting.** Each work order receives one canonical class based on its acceptance artifact and dominant difficulty. The class selects the role; the role selects the cast.

2. **One intake may create several independently classified orders.** An E2 feature can require Q0 tests and R0 review. The one-class rule applies to each order, not to the entire task graph.

3. **Roles describe capabilities, not transport.** “Terminal Operator” and “Runtime Investigator” remain meaningful across runtimes. CLI flags and MCP methods belong in adapters.

4. **The cheapest proven cast owns volume.** Cheap models handle bounded work only after context, search, permissions, and verification are bounded mechanically.

5. **Weaknesses are executable routing constraints.** Context cliffs, over-agency, rollback omissions, classifier fallback, and review miss patterns appear in prohibitions, triggers, and fail-closed states.

6. **Verification and evaluation are distinct.** Tests and checks establish observable facts. Reviewers interpret those facts and search for missing requirements. Neither substitutes for the other.

7. **The verifier is infrastructure, not an agent.** It executes declared deterministic checks without semantic discretion and cannot dispatch, author, or approve beyond its proven oracle.

8. **Independence is computed from recorded provenance.** Reviewer family is selected from actual author family. Consequential same-family review cannot satisfy the gate.

9. **Reviewer blinding preserves hazards.** Review prompts omit vendor, model, effort, and price, but include an unattributed class-specific hazard checklist derived from artifact type and execution trace.

10. **Risk outranks allowance.** Allowance pressure may throttle or defer authorship, select a qualified cheaper reviewer, or invoke another pool. It may not eliminate review or widen authority.

11. **Liveness is a deployment gate.** A mandatory review policy that cannot keep up is incomplete even if it never falsely approves. Capacity, queue age, and recovery must pass before rollout.

12. **Control, execution, verification, and review remain separate.** Directors route and integrate signed outcomes; specialists author; the verifier measures; reviewers evaluate. No participant closes its own semantic loop.

13. **Delegation is shallow and visible.** There are at most two model levels below the Director. Every edge carries a structured packet and durable artifact.

14. **Failure is explicit.** `BLOCKED`, `PARTIAL`, `UNAVAILABLE`, `WAITING_FOR_REVIEW`, and `ESCALATE` are valid outcomes. Missing capacity never becomes approval.

15. **Subscription pools are separate but operationally coupled.** Cross-vendor review may balance an idle pool or exhaust a constrained one. Scheduling uses live pool state and forecast demand.

16. **Irreversible authority remains human-controlled.** Production deployment, deletion, credential changes, payments, external messages, legal acceptance, and equivalent side effects require explicit human approval.

### Canonical task and risk taxonomy

Each work order receives exactly one class.

| Code | Canonical class | Deciding discriminator |
|---|---|---|
| O0 | Direction and decomposition | The artifact is a work graph, routing decision, integration decision, or go/no-go decision. |
| A0 | System architecture and novel algorithm design | Cross-system design coherence is the primary challenge. |
| N0 | Bounded fetch, find, and repository lookup | The answer is a small fact set over a declared, mechanically exhaustible search surface and bounded supplied context. |
| N1 | Deep external research | Multiple external sources must be found, reconciled, and cited. |
| N2 | Long-context synthesis | Large or dispersed supplied material must be recalled and reconciled. |
| I0 | Causal evidence investigation | The artifact is an evidence-backed explanation or hypothesis ranking; live reproduction is not dominant. |
| I1 | Runtime, performance, race, or complex bug tracing | Reproduction, profiling, timing, logs, or stateful experiments are required to establish cause. |
| E0 | Terminal, shell, CI, build, and environment operations | Manipulating or diagnosing the execution environment is the primary artifact. |
| E1 | Mechanical code maintenance | The transformation is uniform, enumerable, reversible, and deterministically checkable. |
| E2 | Routine feature, fix, or bounded performance implementation | A written behavior or confirmed performance hypothesis exists and the change fits within three subsystems. |
| E3 | Long-horizon implementation and repository-scale refactoring | Work crosses more than three subsystems, requires persistent coherence, or resists decomposition. |
| E4 | Data, schema, query, and migration engineering | Data integrity, transactional behavior, locking, rollback, or migration safety dominates. |
| E5 | Frontend and interactive UI engineering | The acceptance artifact is a rendered interactive two-dimensional interface. |
| E6 | Spatial, 3D, procedural, and engine-integrated engineering | Geometry, scenes, assets, transforms, spatial systems, or procedural generation dominate. |
| E7 | Defensive security engineering | Threat modeling, vulnerability discovery, hardening, or defensive patching dominates. |
| Q0 | Independent test design | The artifact is an independent oracle, test suite, fixture strategy, or mutation plan. |
| D0 | Documentation and contract engineering | The artifact is developer documentation, a contract, migration guide, or runbook. |
| M0 | Multimodal reference extraction | Images, video, audio, or PDFs are the source of truth and the output is structured evidence. |
| R0 | Adversarial evaluation | The artifact is an independent verdict on another artifact. |

Performance work routes in two phases: I1 establishes the bottleneck and evidence; E2 implements a bounded confirmed fix, E3 implements a cross-system redesign, E4 handles data/query performance, and E0 handles environment or build configuration. This is a discriminator, not a separate generic performance role.

Risk is orthogonal:

- **T0 — inert evidence:** read-only lookup with no consequential inference.
- **T1 — bounded and reversible:** local changes with deterministic checks and no persistent-data or public-contract implications.
- **T2 — consequential:** multi-subsystem behavior, public APIs, user-visible interaction, concurrency, security, persistent schemas, or material ambiguity.
- **T3 — gate-critical or irreversible:** production effects, deletion, secrets, legal/policy acceptance, releases, external communications, or critical security decisions.

### Deterministic verification substrate

The Deterministic Verification Substrate is a non-model service owned by the harness maintainers.

- **Purpose:** Execute declared, reproducible checks and return evidence without semantic judgment.
- **Inputs:** Pinned tree identity, verification-manifest version, command allowlist, expected artifacts, citation/search manifest, integrity nonce, timeout, and scope.
- **Tool surface:** Tests, linters, type checkers, schema validators, query plans, migration dry runs, mutation tests, flake detection, browser assertions, render metrics, path/symbol/citation existence checks, git tree hashes, process ledgers, and nonce validation.
- **Outputs:** `PASS`, `FAIL`, `UNAVAILABLE`, or `COVERAGE_GAP`, plus commands, versions, exit codes, artifacts, duration, tree identity, and scope coverage.
- **Authority:** It may close T0 or provably inert work only when its manifest covers the entire acceptance condition. It never approves architecture, causality, maintainability, security judgment, aesthetics, or behavior outside its oracle.
- **Failure modes:** Incorrect oracle, stale manifest, environment nondeterminism, hidden truncation, false completeness, flaky tests, or a checker modified by the change under review.
- **Controls:** Fail closed on missing tools, changed verifier code, stale manifests, truncated search, dirty checkout, or mismatched tree identity.
- **Bootstrap rule:** New or changed verifier code is ordinary semantic source work: E2 or E3 authors it, Q0 supplies independent tests, an opposite-vendor R0 reviews it, and a human-approved golden corpus establishes initial trust.

### Role catalog

#### 1. Director

- **Purpose:** Convert intake into canonical work orders, risk levels, permissions, allowance budgets, review paths, and an auditable integration decision.
- **Casting:** Primary Claude Opus 5 medium; high for ambiguous or irreversible classification. Depletion mirror GPT-5.6 Sol medium.
- **Rationale:** Opus has the strongest supplied evidence for alignment, pushback, architecture, difficult debugging, and irreversible-action restraint. Sol is a capable parallel coordinator and preserves control-plane liveness across vendor exhaustion.
- **Tool surface:** Dispatch, plan/blackboard writes, pool-state reads, artifact reads, signed-verdict reads, and user communication. No repository exploration, shell, source mutation, deployment, or direct review.
- **Strengths:** Decomposition, rejecting unsound premises, authority restraint, integration, and conflict framing. The mirror adds strong tool-DAG coordination.
- **Weaknesses and failure modes:** Opus can over-design and consume substantial Anthropic allowance. Sol can overreach, over-engineer, or share blind spots with OpenAI authors.
- **Owns:** O0.
- **Must not receive:** Coding, reconnaissance, shell work, test execution, or semantic self-review.
- **Escalation in/out:** Receives all intake and reclassification. Escalates architecture to A0, environmental ambiguity to E0/I1, and T3 decisions to a human.
- **Mirror handoff:** The primary writes a signed control checkpoint containing open orders, class/risk, permissions, tree identities, pool state, review obligations, unresolved decisions, and nonce. The mirror may classify, queue, budget, dispatch, and relay signed verdicts.
- **Mirror restrictions:** A Sol mirror cannot semantically close OpenAI-authored T2/T3 artifacts, author and approve the same material plan, override an Anthropic/Google verdict, or authorize T3 effects. Those wait for Anthropic, a qualified Gemini reviewer, or a human.
- **Review:** Material Opus-authored O0 artifacts receive Sol high review. Sol-mirror-authored O0 artifacts receive Opus high when available; otherwise qualified Gemini or human review.

#### 2. Systems Architect

- **Purpose:** Produce coherent system architecture and novel-algorithm designs without implementing them.
- **Casting:** Claude Fable 5 high; Opus 5 high fallback when Fable is not included in the active subscription.
- **Rationale:** The reports support Fable’s repository-scale, global-coherence, and spatial ceiling. Fable use requires Max or a premium seat; pay-as-you-go credits are excluded.
- **Tool surface:** Read-only repository access, documentation research, diagrams, design artifacts, and bounded calculations.
- **Strengths:** Global representation, poorly understood systems, long-horizon coherence, and system-level tradeoffs.
- **Weaknesses and failure modes:** Slow, weekly-allowance hungry, always-thinking, abstraction-prone, classifier-sensitive, and unsuitable for repetitive work.
- **Owns:** A0.
- **Must not receive:** Routine implementation, terminal work, defensive security, or high-volume review.
- **Escalation in/out:** Receives design questions from the Director or executors whose scope changed materially. Returns unresolved business tradeoffs to a human.
- **Review:** Sol high in fresh context. Blind dual-plan exercises require a third-vendor or human synthesizer when both author families would otherwise participate in arbitration.

#### 3. Repository Scout

- **Purpose:** Return a small, cited set of repository or one-source facts over a declared search surface without causal interpretation.
- **Casting:** Haiku 4.5 with thinking off; Luna low is the pool-aware mirror.
- **Tool surface:** File listing, search, read, symbol lookup, read-only history, URL retrieval, and metadata commands.
- **Strengths:** Fast bounded retrieval, low allowance draw, cache locality with Anthropic parents, and structured evidence.
- **Weaknesses and failure modes:** Haiku has stale external knowledge and a 200K window; Luna has a severe long-context recall cliff. Both can omit dispersed evidence or conclude too early.
- **Owns:** N0.
- **Must not receive:** Causal “why,” an unbounded repository, more than 32K supplied tokens, unresolved truncation, implementation, or architectural judgment.
- **Search contract:** The packet declares roots, globs, exclusions, byte/line caps, and required symbols. The result records every query, hit count, file opened, truncated result, skipped binary/generated path, and unsearched branch.
- **Automatic reclassification:** Any tool truncation, unresolved search cap, evidence dispersed beyond 25 files, or inability to prove the declared surface was exhausted routes to N2 or I0 without relying on scout confidence.
- **Review:** The verifier replays citations and search counts. T0 facts need no model verdict; conclusions route through I0, N1, N2, or R0.

#### 4. Deep Researcher

- **Purpose:** Find, reconcile, and cite external evidence for technical decisions.
- **Casting:** GPT-5.6 Sol medium; high for safety-, architecture-, or procurement-relevant research.
- **Tool surface:** Web search, browser, PDF retrieval, citation capture, read-only repository context, and evidence storage.
- **Strengths:** BrowseComp 92.2%, persistent browsing, source discovery, and broad tool use.
- **Weaknesses and failure modes:** Over-searching, novelty bias, inference beyond citations, and treating vendor claims as independent evidence.
- **Owns:** N1.
- **Must not receive:** Repository mutation, final architecture, legal acceptance, or bounded single-source lookup.
- **Escalation in/out:** Raises effort once for unresolved evidence branches; domain interpretation routes to A0, I0, E7, or a human.
- **Review:** Citations and quotation limits are checked mechanically. Decision-bearing synthesis receives Opus high review.

#### 5. Long-Context Analyst

- **Purpose:** Extract and reconcile facts from large or dispersed supplied context.
- **Casting:** GPT-5.6 Terra medium; high only for dense cross-document inference.
- **Tool surface:** Large-document ingestion, repository/history reads, search, structured extraction, and evidence tables.
- **Strengths:** Reported MRCR 89.6, strong structured output, and lower allowance draw than Sol.
- **Weaknesses and failure modes:** Shallow causal interpretation, code-smell/security misses, and false synthesis when sources conflict.
- **Owns:** N2.
- **Must not receive:** Implementation, final architecture, security approval, or live bug reproduction.
- **Escalation in/out:** Sol high for incomplete recall; I0 or A0 when causality or architecture remains.
- **Review:** Opus high reviews decision-bearing conclusions; seeded-document checks measure extraction completeness.

#### 6. Evidence Detective

- **Purpose:** Establish why a system behaves as observed through explicit hypotheses and repository evidence.
- **Casting:** Claude Opus 5 high.
- **Tool surface:** Read-only repository/history, dependency inspection, static-analysis results, supplied logs, and non-mutating diagnostics.
- **Strengths:** Root-cause reasoning, bug localization, hypothesis rejection, and cross-subsystem consequence analysis.
- **Weaknesses and failure modes:** Overthinking simple defects, anchoring on elegant explanations, high allowance use, and stalling when live manipulation is required.
- **Owns:** I0.
- **Must not receive:** Permanent edits, prolonged shell reproduction, simple lookup, or final review.
- **Escalation in/out:** Reclassifies to I1 for experiments, E0 for environment state, or A0 for architectural gaps. Fable is the conceptual ceiling.
- **Review:** Sol high attempts to falsify the evidence chain and verifies that proposed fixes follow from the cause.

#### 7. Runtime and Performance Investigator

- **Purpose:** Reproduce and isolate complex bugs, races, performance regressions, and state-dependent failures.
- **Casting:** Claude Opus 5 high.
- **Tool surface:** Sandboxed execution, profilers, traces, debuggers, logs, benchmarks, temporary instrumentation, and read-only source.
- **Strengths:** The dossier identifies Opus as the leading bug/performance investigator; current Terminal-Bench 3.0 strengthens the environment-work prior.
- **Weaknesses and failure modes:** Expensive, capable of perturbing Heisenbugs, prone to broad rewrites before isolation, and sometimes weaker than Sol in repetitive shell loops.
- **Owns:** I1.
- **Must not receive:** Permanent fixes, general terminal administration, simple static investigation, or review.
- **Escalation in/out:** Shell-dominated failures go to E0; architecture failures to A0. Confirmed bounded code fixes become E2, broad redesigns E3, query/data fixes E4, and environment tuning E0.
- **Review:** Sol high independently reproduces the failure or validates the trace and checks alternative causes.

#### 8. Terminal and Environment Operator

- **Purpose:** Own terminal-heavy diagnosis and controlled shell, build, CI, dependency, and environment operations.
- **Casting:** GPT-5.6 Sol high.
- **Tool surface:** Shell, package managers, build systems, CI clients, non-destructive version control, containers, sandboxes, and environment inspection.
- **Strengths:** Strong Terminal-Bench 2.1, OSWorld, persistence, and tool-loop evidence; lower observed token/cost footprint than some frontier alternatives.
- **Weaknesses and failure modes:** Over-agency, scope expansion, concurrency mistakes, unintended mutation, and specification gaming.
- **Owns:** E0.
- **Must not receive:** Architecture, long prose, unbounded production administration, or self-review.
- **Escalation in/out:** A strategy-level or second non-improving stall goes to Opus high/max, reflecting the Terminal-Bench 3.0 result. Missing permission or specification returns to the Director; runtime causality routes to I1.
- **Review:** Opus high reviews semantic effects. Every run receives command/path policy, before/after tree audit, process ledger, and integrity nonce.

#### 9. Mechanical Maintainer

- **Purpose:** Apply uniform, enumerable, deterministically verifiable repository transformations.
- **Casting:** GPT-5.6 Luna medium.
- **Tool surface:** Scoped edits, formatters, codemods, generators, and specified tests.
- **Strengths:** High throughput, low allowance use, repetitive edits, and structured generation.
- **Weaknesses and failure modes:** Consistent application of a flawed pattern, missed exceptions, dispersed-file orientation loss, and overreach when the transform is not uniform.
- **Owns:** E1.
- **Must not receive:** Feature ownership, ambiguous fixes, migrations, long-context work, or multi-subsystem design.
- **Escalation in/out:** Any exception, non-local failure, or scope growth reclassifies to E2/E3. One Terra-medium retry is permitted only for a still-uniform rule.
- **Review:** Haiku no-thinking performs an opposite-vendor constraint/diff check; the verification substrate proves enumeration and transformation invariants.

#### 10. Routine Product Engineer

- **Purpose:** Implement bounded features, fixes, and confirmed local performance improvements from written acceptance criteria.
- **Casting:** Claude Sonnet 5 medium; high for unusually dense but still bounded logic. Terra medium is the evaluated depletion mirror.
- **Tool surface:** Workspace edits, tests, linters, generators, non-destructive version control, and approved tools.
- **Strengths:** Production implementation, maintainability, responsive iteration, and efficient execution behind a specification.
- **Weaknesses and failure modes:** Can accept a bad plan, stall on ceiling work, miss architecture, or consume more tokens than sticker ratios imply.
- **Owns:** E2.
- **Must not receive:** Architecture invention, more than three coupled subsystems, defensive-security ownership, critical migrations, or unisolated runtime investigation.
- **Escalation in/out:** Opus high after a stall; E3 if scope becomes long-horizon; E0 for environment failure. Performance work must arrive with I1’s profile, invariant, and numeric target.
- **Review:** Qualified Terra medium for ordinary T1 changes; Sol high for T2. Review always uses fresh context and independent verification.

#### 11. Long-Horizon Engineer

- **Purpose:** Implement repository-scale features and refactors while preserving coherence across subsystems and checkpoints.
- **Casting:** Claude Fable 5 high; Opus 5 high fallback.
- **Tool surface:** Full scoped workspace editing, tests, builds, checkpoint commits, architecture artifacts, and up to three bounded N0, Q0, or E1 children.
- **Strengths:** Reported SWE-bench Pro lead, global coherence, and long autonomous trajectories.
- **Weaknesses and failure modes:** Slow, costly, abstraction-prone, classifier-sensitive, and wasteful on decomposable work.
- **Owns:** E3.
- **Must not receive:** Routine edits, terminal-only repair, security work, or repetitive validation.
- **Escalation in/out:** Checkpoint at subsystem boundaries; scope changes return to the Director. E0/I1 handle terminal/runtime hard cores; A0 handles unresolved design.
- **Review:** Sol high reviews risk-boundary checkpoints and the complete pinned artifact.

#### 12. Data and Schema Engineer

- **Purpose:** Design and implement schemas, queries, transformations, and migrations with explicit integrity, locking, rollback, and partial-failure properties.
- **Casting:** Claude Opus 5 high. Terra high is permitted only for reversible T1 work after Opus or A0 has fixed the integrity design.
- **Tool surface:** Source editing, isolated databases, query planners, schema diffs, fixtures, backups, dry runs, and integrity checks.
- **Strengths:** Opus’s supplied evidence favors careful irreversible-action reasoning, bug/performance investigation, and large integration work.
- **Weaknesses and failure modes:** Higher allowance use, less direct volume-ETL evidence than Terra, and a tendency to over-design migrations.
- **Owns:** E4.
- **Must not receive:** Live production mutation, unrelated product features, or sole release authority.
- **Escalation in/out:** Locking/performance uncertainty goes to I1; architectural redesign to A0; production execution requires T3 human approval and E0.
- **Review:** Sol high reviews semantics, rollback, and skew. Verification includes forward migration, rollback or documented irreversibility, representative data, constraints, concurrency behavior, and query plans.

#### 13. UI and Interaction Engineer

- **Purpose:** Build and verify rendered, interactive two-dimensional frontend experiences.
- **Casting:** GPT-5.6 Sol high.
- **Tool surface:** Source editing, browser automation, screenshots, responsive viewports, accessibility tools, component tests, and render-inspect-adjust loops.
- **Strengths:** Top-band Design Arena evidence, browser/computer use, visual anti-pattern suppression, and persistent iteration.
- **Weaknesses and failure modes:** Polishing the wrong interaction model, overbuilding infrastructure, non-visual logic defects, and single-viewport overfitting.
- **Owns:** E5.
- **Must not receive:** Backend architecture, spatial/3D systems, raw reference extraction, or release authority.
- **Escalation in/out:** M0 supplies visual evidence; A0 resolves interaction-system ambiguity; I1 handles runtime bugs; backend changes split into E2/E3.
- **Review:** Opus high reviews behavior and code across desktop, mobile, keyboard, loading, empty, and error states.

#### 14. Spatial and Procedural Systems Engineer

- **Purpose:** Build spatial, 3D, engine-integrated, and procedural systems using code plus render inspection.
- **Casting:** Claude Opus 5 high.
- **Tool surface:** Source editing, engine/DCC tools, scene and asset inspection, renders, geometry statistics, import validation, and runtime previews.
- **Strengths:** `research/cross_vendor_agent_harness_roster_summary.md:287–302` directly supports procedural meshes, Blender, Godot, shaders, interactive visual systems, and render-feedback loops.
- **Weaknesses and failure modes:** High allowance use, pipeline over-engineering, local geometric correctness without global composition, and weaker repetitive terminal persistence than Sol.
- **Owns:** E6.
- **Must not receive:** Ordinary frontend work, raw reference extraction, repetitive asset edits, or final artistic approval.
- **Escalation in/out:** M0 for references, A0/Fable for global composition or novel design, and E0 for toolchain failures.
- **Review:** Sol high reviews code, imports, geometry, renders, and runtime behavior. Human judgment remains final for subjective aesthetics.

#### 15. Defensive Security Engineer

- **Purpose:** Threat-model, find, and defensively patch security weaknesses within an authorized scope.
- **Casting:** GPT-5.6 Sol high; max only for difficult defensive analysis with human-approved scope.
- **Tool surface:** Scanners, isolated tests, dependency auditing, fuzzing, static/dynamic analysis, and scoped edits.
- **Strengths:** Strongest supplied general-availability defensive-cyber evidence and strong terminal/tool competence.
- **Weaknesses and failure modes:** Over-agency, unsafe proof-of-concept expansion, false positives, and unnecessary exploit demonstration.
- **Owns:** E7.
- **Must not receive:** Offensive exploitation, external targeting, production credentials, or sole release authority.
- **Escalation in/out:** Critical findings go to a human security owner; architecture flaws to A0; runtime confirmation remains isolated.
- **Review:** Opus high performs cross-vendor review, but the dossier’s “sometimes Opus” classifier-fallback warning is recorded. A fallback/intervention signal, unverifiable resolved identity, or refusal makes the verdict non-closing and routes to qualified Gemini or a human. Critical findings always require human sign-off.

#### 16. Independent Test Designer

- **Purpose:** Construct an oracle independent of the implementation author, including tests, fixtures, invariants, and mutation targets.
- **Casting:** Terra medium for Anthropic-authored implementation; Sonnet 5 medium for OpenAI- or Google-authored implementation.
- **Tool surface:** Test/fixture edits, generators, property tests, mutation tools, coverage, isolated execution, and requirements.
- **Strengths:** Workhorse code generation, structured acceptance translation, and inexpensive independent test construction.
- **Weaknesses and failure modes:** Mirroring specification defects, encoding current rather than intended behavior, implementation leakage, flakiness, and low-value coverage.
- **Owns:** Q0.
- **Must not receive:** Certification of its own tests, architecture, feature implementation, or release approval.
- **Mandatory triggers:** Every T2/T3 source change; every E3, E4, and E7 change; authentication, authorization, concurrency, persistent-data, and public-API changes regardless of nominal tier. During calibration, 25% of eligible T1 E2/E5/E6 work is also sampled.
- **Sequencing:** Q0 is created by policy when the implementation order is created. Black-box tests are drafted before or parallel to implementation, with the implementation diff withheld where practical.
- **Escalation in/out:** Ambiguous expected behavior returns to O0/A0. Mutation survivors route to I1 or the relevant executor.
- **Review:** Mutation and flake checks are mandatory. For T2/T3, a fresh model from the implementation author’s family reviews the opposite-family test artifact without seeing the implementation; the opposite-family code reviewer separately reviews the implementation. No reviewer certifies same-family output.

#### 17. Documentation and Contract Engineer

- **Purpose:** Produce accurate developer documentation, contracts, migration guides, and runbooks tied to verified behavior.
- **Casting:** Claude Sonnet 5 medium.
- **Tool surface:** Repository/history reads, documentation edits, example execution, link checking, API/schema extraction, and documentation builds.
- **Strengths:** Maintainable prose, implementation feasibility, and efficient translation from verified behavior.
- **Weaknesses and failure modes:** Smoothing over uncertainty, repeating stale comments, documenting intent instead of reality, and omitting destructive edge cases.
- **Owns:** D0.
- **Must not receive:** Legal acceptance, unverified current facts, architecture, or hidden implementation work.
- **Escalation in/out:** N1 for current facts, A0 for public-contract disputes, and humans for legal/policy wording.
- **Review:** Qualified Terra medium for ordinary semantic T1 documentation; Sol high for public contracts or migration instructions. Inert spelling/generated-reference work may close deterministically.

#### 18. Multimodal Reference Analyst

- **Purpose:** Convert image, video, audio, and PDF source material into a cited implementation-ready evidence specification.
- **Casting:** Gemini 3.7 Flash high through an authenticated Antigravity subscription, conditional on activation.
- **Tool surface:** Multimodal input, frame extraction, screenshots, PDFs, structured measurements, annotations, and read-only comparisons.
- **Strengths:** Google documents native text/image/video/audio/PDF input, a 1,048,576-token input limit, long-video performance, PDF comprehension, and strong coding/UI-reference results. [Gemini 3.7 Flash capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)
- **Weaknesses and failure modes:** Vendor-dominated evidence, hallucination, timeout risk, uncertain per-seat throughput, and limited end-to-end independence.
- **Owns:** M0.
- **Must not receive:** General coding, final UI implementation, architecture, or review of Google-authored work.
- **Escalation in/out:** A0 resolves global interpretation; E5/E6 implement. If exact model identity is unavailable, the seat fails closed.
- **Fallback:** Terra medium handles still images, rendered PDF pages, and pre-extracted text. Raw audio/video is `UNAVAILABLE` without Gemini or an explicitly validated preprocessing route.
- **Review:** Opus high reviews Gemini output. Terra fallback output is reviewed by Opus high only when the artifact remains T1; consequential OpenAI-authored evidence requires Anthropic review plus deterministic source tracing.

#### 19. Independent Adversarial Reviewer

- **Purpose:** Attempt to disprove correctness, completeness, safety, and scope compliance of another artifact.
- **Casting:** Selected from recorded author family and risk:

  - Anthropic author: qualified Terra medium for T1; Sol high for T2/T3.
  - OpenAI author: Sonnet medium for T1; Opus high for T2/T3.
  - Google author: Sonnet medium for T1; Opus high for T2/T3.
  - Human/unattributed artifact: Opus high by default; Sol high adds a T3 second opinion.
  - Capacity relief: Gemini 3.7 Flash high may review Anthropic- or OpenAI-authored T1/T2 work only after its independent review qualification. It never reviews Google output.

- **Tool surface:** Fresh read-only context, pinned checkout, diff and dependency slice, isolated test execution, static analysis, browser/render inspection, and evidence capture.
- **Strengths:** Cross-family error discovery, fresh-context skepticism, independent reruns, and severity classification.
- **Weaknesses and failure modes:** Hallucinated blockers, excessive blocking, inadequate surrounding-code inspection, Sol’s over-discovery, Opus classifier fallback, and reviewer mutation.
- **Owns:** R0.
- **Must not receive:** Implementation, repair, same-family consequential artifacts, or its prior verdict as the sole basis for another review.
- **Hazard packet:** The reviewer sees artifact-class hazards such as concurrency, rollback, scope expansion, or unsupported APIs without seeing vendor, model, effort, or price. Blinding is treated as a hypothesis and A/B tested.
- **Escalation in/out:** A contested blocker goes once to a qualified third vendor or human. Three review rounds is the hard cap.
- **Review:** Verdicts are not recursively reviewed. The verification substrate audits evidence, commands, checkout identity, mutation, model trace, and nonce. Contested semantic judgment is independently adjudicated.

### Hierarchy and topology

```text
Human authority
├── Primary Director: Opus 5 medium
│   └── signed control checkpoint
└── Depletion mirror: Sol medium, restricted authority
    ├── Level 1 author / investigator / architect
    │   └── Level 2 bounded child: N0, E1, Q0, or M0 only
    ├── Deterministic Verification Substrate [non-agent service]
    └── Fresh R0 reviewer selected from recorded author family
```

Limits:

- Four active Director children by default; six is the hard cap.
- No more than two allowance-hungry calls—Fable, Opus high/max, Sol high/max—run concurrently.
- A Level 1 lead may dispatch at most three Level 2 children.
- Level 2 agents cannot delegate.
- Reviewers cannot delegate or repair.
- Authors cannot select their reviewer.
- Only A0, E3, I0, I1, E5, E6, and E7 leads may delegate.
- Parallel mutation requires isolated worktrees or disjoint path ownership.
- T2/T3 work has one writer at a time.
- Every fan-out ends with the existing explicit sweep step to find missed consumers; the integration owner performs it or dispatches N0/I0 as appropriate.
- A task receives at most two solver handoffs and three review rounds before human escalation.
- Fan-out above six requires a human-approved batch policy containing only independent T0/T1 work.

The Director retains classification, risk, permissions, reviewer selection, allowance forecasts, work-graph ownership, integration sequencing, and communication. It does not retain exploration, coding, shell work, test execution, review, production operation, or visual inspection. For same-family authored consequential work, final integration is procedural: the Director consumes the opposite-vendor signed verdict and may not replace it with its own semantic approval.

Every dispatch contains:

```yaml
task_id:
parent_id:
class:
risk:
objective:
acceptance_criteria:
scope_allow:
scope_deny:
context_shape: packet | scoped | subsystem | repo | haystack
search_surface:
source_refs:
known_state:
tool_capabilities:
destructive_actions:
author_family:
resolved_model_required:
model_id:
effort:
pool_state:
allowance_budget:
verification_manifest:
verification_commands:
review_policy:
hazard_profile:
escalation_triggers:
artifact_location:
integrity_nonce:
```

Every result contains:

```yaml
status: complete | partial | blocked | unavailable | waiting_for_review | escalate
summary:
artifact_refs:
paths_read:
paths_changed:
search_manifest:
commands_run:
verification_results:
evidence:
assumptions:
residual_risks:
scope_variance:
recommended_next_class:
tree_identity:
resolved_model_id:
fallback_or_classifier_signal:
pool_observation:
integrity_nonce:
```

`author_family`, model, effort, price, and vendor-specific prose are withheld from the reviewer prompt. `hazard_profile` is retained but rendered without author attribution.

### Routing table

“AR” means the Independent Adversarial Reviewer with its author-aware cast.

| Class | Primary role and default cast | Reviewer | Escalation path |
|---|---|---|---|
| O0 | Director — Opus medium; Sol mirror | AR opposite actual Director author for material plans | Opus high/Fable → qualified third vendor/human |
| A0 | Systems Architect — Fable high | AR — Sol high | Opus high fallback → blind dual-plan/human |
| N0 | Repository Scout — Haiku no-think | Verification substrate | Luna low mirror → N2/I0 |
| N1 | Deep Researcher — Sol medium | Citation checks; AR — Opus high when decision-bearing | Sol high → domain role → human |
| N2 | Long-Context Analyst — Terra medium | AR — Opus high | Terra high → Sol high → Opus high |
| I0 | Evidence Detective — Opus high | AR — Sol high | Fable high; reclassify I1/E0 |
| I1 | Runtime/Performance Investigator — Opus high | AR — Sol high | Sol environment probe → Fable/A0 → human |
| E0 | Terminal Operator — Sol high | AR — Opus high | Opus high/max → I1/A0 → human |
| E1 | Mechanical Maintainer — Luna medium | AR — Haiku no-think plus full deterministic oracle | Terra medium → E2/E3 |
| E2 | Routine Product Engineer — Sonnet medium | Qualified Terra medium T1; Sol high T2 | Sonnet high → Opus high → E3 |
| E3 | Long-Horizon Engineer — Fable high | AR — Sol high at checkpoints and completion | Opus high fallback → human |
| E4 | Data and Schema Engineer — Opus high | AR — Sol high | Terra high for reversible T1 only → A0/I1 → human |
| E5 | UI Engineer — Sol high | AR — Opus high | M0/A0 → I1 → human aesthetic gate |
| E6 | Spatial Systems Engineer — Opus high | AR — Sol high | M0 → Fable/A0 → E0 |
| E7 | Defensive Security Engineer — Sol high | AR — Opus high; qualified Gemini/human on identity failure | Sol max → human security owner |
| Q0 | Test Designer — Terra or Sonnet opposite implementation author | Fresh reviewer opposite the test author; mutation/flake oracle | Other-vendor workhorse → requirements owner |
| D0 | Documentation Engineer — Sonnet medium | Qualified Terra T1; Sol high public/T2 | N1 → Opus high → human legal owner |
| M0 | Multimodal Analyst — Gemini 3.7 Flash high | AR — Opus high | Terra for still/PDF/text subset; raw audio/video unavailable |
| R0 | Adversarial Reviewer — author-aware | Machine evidence audit; qualified third vendor/human if contested | Third vendor once → human |

### Review and escalation protocol

#### Mandatory versus preferred independence

Opposite-vendor review is mandatory for:

- every semantic source change;
- all A0 and E3 artifacts;
- T2/T3 findings, plans, tests, migrations, and documentation;
- authentication, authorization, privacy, concurrency, public APIs, persistent data, release, security, and destructive-operation decisions;
- every Sol-authored mutation;
- final integration of independently authored subsystems.

Model review is preferred but not mandatory for:

- T0 research;
- pure formatting, spelling, generated-reference, or manifest-order changes whose complete acceptance condition is deterministic;
- interim hypotheses that cannot authorize work.

A deterministic-only closure requires complete-oracle proof. `COVERAGE_GAP` forces model review.

#### Independent test trigger

The scheduler creates Q0 automatically when the implementation order is created if any trigger in Role 16 applies. Failure to create the required Q0 order is a policy violation, not a discretionary shortcut.

#### Reviewer qualification

Terra T1 and Gemini relief lanes require a blinded review trial containing at least 80 artifacts, at least 20 major seeded defects, and representative correctness, scope, security, data-loss, test, and documentation failures. Qualification requires:

- major-defect recall within 5 points of the appropriate flagship baseline;
- zero missed critical seeds;
- false blocker rate at most 10%;
- no source mutation;
- exact model identity;
- stable subscription-path execution;
- 95% confidence intervals reported.

Gemini’s M0 qualification does not qualify R0.

#### Hazard-preserving blinding

The scheduler maps class, risk, changed artifact type, tool trace, and deterministic results to an unattributed hazard checklist. For example, a terminal-authored concurrency change may carry “check unrequested mutation, unfinished processes, race safety, and falsified test state” without naming Sol. This preserves targeted scrutiny while reducing vendor/tier anchoring. Blinded, identity-visible, and blinded-plus-hazard packets are compared during Step 8.

#### Stall detector

Escalation fires when any two occur, or immediately at a safety boundary:

- the same material error appears twice;
- a third architecture is proposed without new evidence;
- tests are not improving;
- the worker reports lost orientation or requests a rewrite;
- output exceeds three times the class median without new verification;
- a refusal, classifier signal, or unverified fallback occurs;
- scope crosses the packet boundary;
- allowance forecast is exceeded by 50%;
- evidence contradicts the leading hypothesis;
- exact model identity cannot be established;
- review queue age threatens its SLO.

Sequence:

1. repair the packet if requirements or permissions were defective;
2. try the declared next model rung at the same effort;
3. increase effort once only when reasoning budget is the evidenced bottleneck;
4. move to the cross-vendor or ceiling specialist;
5. request human resolution.

There is no repeated effort cycling.

#### Review-capacity and reserve policy

A fixed 25% reserve is only a floor. Before each scheduling window:

```text
required reserve =
  forecast mandatory review draw
  + forecast incident draw
  + 30% uncertainty buffer
```

New authorship is throttled whenever the remaining reviewer pool cannot cover that reserve. The production liveness targets are proposed as:

- service capacity at least 1.3× forecast peak review arrival;
- reviewer utilization at most 70% over the measurement window;
- P95 artifact-to-verdict queue age at most 60 minutes for T1 and four hours for T2 while pools are Green;
- zero false approvals during exhaustion or recovery.

#### Pool states and degradation

- **Green:** More than 40% estimated allowance remains and forecast review reserve is covered.
- **Amber:** 20–40% remains, or capacity falls below the 1.3× buffer. Stop optional authorship in that pool.
- **Red:** Below 20%, throttling begins, or queue SLO is threatened. Reserve the pool for mandatory review and active-call completion.
- **Exhausted:** No new calls. Activate the table below.

| Exhausted pool | Control plane | Work that may continue | Required review | Work that blocks |
|---|---|---|---|---|
| Anthropic | Sol-medium Director mirror from signed checkpoint | T0 OpenAI/Google work; already-classified OpenAI T1 work | Qualified Gemini or human for Sol-mirror plans and consequential OpenAI artifacts | New consequential classification or OpenAI T2/T3 closure without independent reviewer |
| OpenAI | Opus Director remains | T0 Anthropic/Google work; OpenAI-authored artifacts can still be reviewed by Anthropic | Qualified Gemini or human for Anthropic-authored semantic work | New Anthropic semantic authorship whose review cannot be scheduled |
| Google | Opus Director remains | Anthropic/OpenAI work | Normal two-vendor matrix | Raw M0 audio/video and Gemini review relief |
| Any two pools | Remaining Director may queue and report status | T0 and deterministic-only work | Human reviewer | Consequential closure lacking another family |

### Cost model

#### Subscription basis

OpenAI runs through Codex signed into ChatGPT. API-key authentication is usage-based and prohibited by default. Anthropic runs through Claude Code signed into the applicable subscription; `ANTHROPIC_API_KEY` must not silently override it. Google runs through Antigravity subscription authentication.

The architecture assumes no specific tier until Step 1 records it. Official OpenAI ranges demonstrate why tier discovery is load-bearing, while Anthropic publishes multipliers and reset mechanics rather than stable task counts. Google publishes Pro/Ultra plan multipliers and a shared Gemini quota but not complete per-task counts. [Antigravity plan mechanics](https://antigravity.google/blog/changes-to-antigravity-plans)

#### Normalized allowance units

Pools remain non-convertible:

- **OAU:** One Luna-medium local-message equivalent. Official five-hour ranges imply Terra medium ≈10 OAU and Sol medium ≈20–25 OAU for equal-volume messages.
- **AAU:** One Haiku no-thinking work-order-turn equivalent. Provisional API-price and provider-guidance proxies set Sonnet medium ≈2–3 AAU, Opus medium ≈5–7 AAU, and Fable medium ≈10–14 AAU. These are not subscription charges.
- **GAU:** One Gemini 3.7 Flash high-thinking Antigravity turn.

Provisional effort multipliers are 0.75× low, 1× medium, 1.5× high, 2× xhigh, and 3× max until observed pool movement replaces them. Every class budget is expressed as model-turn count multiplied by model weight; no task estimate may be below one turn of its assigned cast.

#### Illustrative workload mix and per-class budget

The starting scenario is 100 primary work orders, excluding generated Q0/R0 orders:

| Class | Estimated primary frequency | Estimated author draw per task | Independent add-back |
|---|---:|---:|---:|
| O0 | 6% | 5–20 AAU | 30–120 OAU when material |
| A0 | 2% | 30–100 AAU | 60–190 OAU |
| N0 | 22% | 1–3 AAU | None |
| N1 | 3% | 20–100 OAU | 15–50 AAU when decision-bearing |
| N2 | 3% | 20–60 OAU | 15–50 AAU |
| I0 | 5% | 15–50 AAU | 60–190 OAU |
| I1 | 4% | 20–75 AAU | 60–190 OAU |
| E0 | 6% | 60–300 OAU | 15–60 AAU |
| E1 | 12% | 1–6 OAU | 1–3 AAU plus verifier |
| E2 | 20% | 4–16 AAU | 20–60 OAU T1 or 60–190 OAU T2 |
| E3 | 4% | 45–150 AAU | 120–400 OAU across checkpoints |
| E4 | 3% | 25–90 AAU | 60–190 OAU |
| E5 | 3% | 60–225 OAU | 15–60 AAU |
| E6 | 1% | 25–90 AAU | 60–190 OAU |
| E7 | 1% | 60–300 OAU | 20–75 AAU plus human time when critical |
| Q0 | Generated: about 18 per 100 primary | 20–80 OAU or 4–20 AAU | Separate opposite-test-author review at T2/T3 |
| D0 | 4% | 2–10 AAU | 10–40 OAU T1 or 60–190 OAU public/T2 |
| M0 | 1% | 2–8 GAU | 15–50 AAU |
| R0 | Generated: about 48 per 100 primary after safe batching | Terra T1 20–60 OAU; Sol 30–190 OAU; Sonnet 2–20 AAU; Opus 15–75 AAU | No recursive review |

All figures are estimates. Actual project frequency is recorded during shadow mode and replaces this mix.

Under representative midpoint assumptions, this mix produces the following within-pool shares:

| OpenAI pool consumer | Estimated OAU share |
|---|---:|
| R0 reviews of Anthropic output | 60.0% |
| E0 terminal authorship | 17.3% |
| E5 UI authorship | 8.7% |
| Q0 tests for Anthropic implementations | 5.8% |
| E7 security authorship | 3.5% |
| N1 research authorship | 2.9% |
| N2 long-context authorship | 1.2% |
| E1 mechanical authorship | 0.7% |

| Anthropic pool consumer | Estimated AAU share |
|---|---:|
| R0 reviews of OpenAI/Google output | 24.3% |
| E3 long-horizon authorship | 18.0% |
| E2 routine implementation | 12.0% |
| I0 evidence investigation | 9.4% |
| I1 runtime/performance investigation | 9.0% |
| E4 data/migration authorship | 7.9% |
| A0 architecture | 6.7% |
| O0 direction | 4.5% |
| E6 spatial systems | 2.6% |
| N0 reconnaissance | 2.5% |
| D0 documentation | 1.8% |
| Q0 tests for OpenAI/Google implementations | 1.3% |

Google initially spends entirely on M0. Review relief receives no budget until separately qualified.

This scenario exposes, rather than hides, the likely bottleneck: OpenAI review consumes more allowance than OpenAI authorship. N0 therefore remains on Haiku by default, Terra receives a measured T1 review path, and author concurrency is bounded by projected Sol/Terra review demand.

#### Where savings come from

- N0 remains on Haiku and E1 on Luna instead of premium models.
- Terra may absorb qualified T1 review instead of forcing every gate onto Sol.
- Routine implementation stays on Sonnet; Fable is not the Director or default executor.
- Reviewer packets contain the pinned diff, dependency slice, acceptance criteria, hazard profile, and verification manifest rather than full transcripts.
- Deterministic checks replace model judgment only for complete T0/inert oracles.
- Vendor stickiness preserves cached context during authorship.
- E3 checkpoint review prevents one failed monolithic run.
- The stall detector stops accumulated cheap failures before they exceed a correct premium attempt.
- Review reserves are forecast from the actual class mix instead of being asserted as a constant.
- Existing nonce, tree-audit, pinned-checkout, and process-completion controls prevent stale or fabricated expensive rounds.

#### Cost of de-correlation

In the illustrative mix, mandatory review creates roughly 48 review orders per 100 primary work orders after permissible same-kind batching, plus about 18 independent test-design orders. This is materially higher than the dossier’s 3–8% review-call prior because the mandate is broader.

Each mandatory review adds:

- one sequential model run after the artifact stabilizes;
- allowance draw from a different pool;
- an estimated 5–20 minutes for T1 and 20–90 minutes for T2, to be replaced by measurement;
- possible separate Q0 review;
- possible third-vendor or human adjudication for contested findings.

This helps when the reviewer pool is underused and hurts when it is already constrained. The early throughput probe decides whether the installed seats can sustain the mandate; safety without liveness is not acceptance.

### Deltas from the current roster

| Current system | Proposed delta | Reason |
|---|---|---|
| `scout` is Haiku and broadly owns cheap recon. | Retain Haiku as N0 primary, add an enforceable supplied-context/search manifest, and use Luna only as a pool-aware mirror. | Cross-pool price comparisons are invalid; omission and review-reserve effects must be measured. |
| `detective` is one read-only Opus role. | Split Evidence Detective from Runtime/Performance Investigator. | Static causality and stateful experimentation require different tools and outputs. |
| `executor` covers most implementation. | Retain Sonnet for E2 and split mechanical, shell, long-horizon, data, UI, spatial, security, tests, and documentation. | The generic contract cannot express nuanced strengths and failure modes. |
| `executor-heavy` and `executor-heavy-xhigh` are effort-named roles. | Retire both names; effort becomes a cast property of capability roles. | Effort is not a purpose. |
| `reviewer` is Opus, including same-family review. | Replace it with author-aware R0 and a review-capacity scheduler. | Fresh context does not remove vendor-family correlation. |
| Cross-vendor review is optional. | Make it mandatory for semantic source and consequential artifacts, but require throughput qualification before activation. | Quality and liveness are both hard requirements. |
| `reviewer-codex` defaults to the flagship. | Add a qualified Terra T1 lane and optional separately qualified Gemini relief. | The supplied Terra exclusion was based on an authoring benchmark, while Sol’s true review evidence remains strong. |
| No Director fallback exists. | Add a restricted Sol-medium control mirror and signed control checkpoint. | Anthropic exhaustion must not eliminate classification, queueing, or human escalation. |
| Deterministic checks are scattered through hooks, tests, and prose. | Specify one non-agent Verification Substrate with typed inputs, outputs, authority, and failure modes. | Cheap closure paths require an owned and testable oracle. |
| Independent tests are a convention, not a trigger. | Encode automatic Q0 creation for T2/T3 and named task classes. | Prevent the implementation author from silently defining its own oracle. |
| `planner-gpt`, `/deep-plan`, and `orchestra-deepplan.js` call `/v1/responses` using `OPENAI_API_KEY`. | Retire the direct API runner and port the skill contract to the existing typed Codex CLI/subscription transport. If the CLI cannot satisfy the contract, report the feature unavailable. | The direct path violates the subscription-only cost basis. An API version may survive only as an explicitly enabled, separately billed out-of-scope add-on. |
| Codex CLI lanes accept either ChatGPT login or API key. | Require and audit ChatGPT subscription authentication for the default architecture. | API-key usage changes the billing basis. |
| Claude Code may use `ANTHROPIC_API_KEY` if present. | Audit active authentication and fail the subscription-only deployment gate when an API key overrides the seat. | Anthropic documents that the environment variable causes API billing. |
| `specialists/modeler` combines reference interpretation and construction. | Split M0 Multimodal Reference Analyst from E6 Spatial/Procedural Systems Engineer. | Evidence extraction and engine implementation need different models and reviews. |
| M0 has no current general role. | Add conditional Gemini with modality-specific fallback and explicit raw audio/video unavailability. | A fallback must support the modality it claims. |
| Current protocols already require a fan-out sweep. | Preserve the sweep as an integration obligation rather than create a new generic role. | N0/I0/E3 already provide the needed capability; another primary would break class uniqueness. |
| `architect-claude`, `architect-codex`, and `plan-synthesizer` provide blind cross-planning. | Retain blind independence; require third-vendor or human synthesis when either author family would otherwise judge its own consequential contribution. | Blindness alone does not guarantee family de-correlation. |
| Master and installed agent copies drift. | Generate all runtime forms from one capability registry. | Verified drift already changes model, effort, and tool surface. |
| `.claude/orchestra.json` mainly carries transport settings. | Add taxonomy, casts, context shapes, family matrix, Q0 triggers, verifier manifests, topology caps, live pool state, review forecast, and fallback activation. | Current configuration cannot express the architecture. |
| Guard enforcement recognizes Fable/Opus by model name. | Derive control-role identity and allowed tools from the capability registry. | A fixed regex cannot safely support the Sol mirror or future runtime changes. |
| Installer validates frontmatter and optional packs. | Add uniqueness, model availability, subscription-auth, family, review-liveness, fallback, verifier-version, and modality checks. | Invalid routing must fail installation or activation. |
| Typed MCP transport, pinned review, nonces, tree audits, process ledgers, and doctor checks exist. | Preserve and generalize them to every provider adapter. | They address observed silent failure and stale-output defects. |
| Current skills describe the fixed company. | Rewrite them around class, risk, context shape, provenance, Q0 triggers, review capacity, and signed verdicts. | Protocol, registry, and skills must expose one architecture. |

No repository files are changed by this design exercise.

## Work plan

1. **Freeze access, authentication, and capability facts.**  
   **Depends on:** nothing.  
   Record exact models exposed by Claude Code, Codex CLI, and Antigravity; subscription tier; resolved authentication method; effort controls; quota/status visibility; context and modality support; headless behavior; and whether each path supports intended subagent use. Fail the default deployment if an API key or usage-credit path is active. Test Fable inclusion and Gemini pinning first.

2. **Probe review throughput and control-plane degradation.**  
   **Depends on:** Step 1.  
   Before encoding the architecture, route at least twenty representative completed changes through the current forced cross-vendor review path. Measure complete reviews per five-hour window, turns, pool movement, wall time, retries, throttle behavior, and queue age. Drill an Opus-to-Sol Director checkpoint handoff. Stop if projected mandatory review capacity is below 1.3× expected peak arrival or the mirror violates its authority restrictions.

3. **Build routing, review, and boundary corpora.**  
   **Depends on:** Steps 1–2.  
   Assemble 30–50 representative primary tasks across all classes and risks, plus at least 80 seeded review artifacts. Include N0/N2 truncation, I0/I1, E1/E2, E2/E3, E5/E6, M0/E5, performance investigation/implementation, and data-migration boundaries. Assign human-approved classes and acceptance oracles.

4. **Specify the capability registry and Verification Substrate.**  
   **Depends on:** Step 3.  
   Encode every role, class, cast, context shape, tool surface, weakness, prohibition, escalation, reviewer, fallback, and modality. Separately specify verifier manifests, typed outcomes, coverage rules, versioning, and bootstrap trust. Reject duplicate primaries or an unowned class.

5. **Encode risk, independence, Q0, and reviewer-qualification policy.**  
   **Depends on:** Step 4.  
   Encode author-family selection, T0–T3 gates, automatic Q0 triggers, separate code/test review, hazard-preserving blinding, Terra/Gemini qualification, maximum rounds, and prohibited same-family fallback.

6. **Specify topology, packets, control checkpoints, and allowance scheduling.**  
   **Depends on:** Steps 2, 4, and 5.  
   Encode depth/fan-out caps, single-writer rules, sweep obligations, packet schemas, pool states, dynamic reserves, liveness SLOs, restricted Director mirror authority, and honest unavailable states.

7. **Map the design onto the reference harness.**  
   **Depends on:** Steps 4–6.  
   Produce the implementation map for `ORCHESTRA.md`, agent directories, packs, hooks, skills, configuration, installers, and tests. Preserve current integrity controls. Port or retire the direct API deep-plan lane and define a migration alias for every retired role.

8. **Run cast, effort, reviewer, and blinding trials.**  
   **Depends on:** Steps 1–7.  
   Test primaries and fallbacks on the corpus. Evaluate Terra T1 review, Gemini M0, Gemini review relief, Sol/Opus terminal routing, E4 casting, and blinded versus hazard-preserving reviewer packets. Use deterministic or human gold and never same-family scoring for consequential artifacts.

9. **Shadow and canary the complete scheduler.**  
   **Depends on:** Step 8 passing its component gates.  
   Shadow at least fifty real tasks, then canary T0/E1, bounded T1, and T2 specialists in sequence. Track class prediction, generated Q0/R0 orders, pool shares, review queue, fallback use, and accepted outcomes. Keep T3 human-gated.

10. **Promote, govern, and recalibrate.**  
    **Depends on:** Step 9 satisfying whole-system gates.  
    Make the capability registry authoritative, retain aliases for one release, publish rollback and pool-exhaustion runbooks, and schedule monthly audits plus immediate requalification after provider model, quota, transport, or classifier changes.

## Risks and failure modes

| Risk | Failure mode | Detection and response |
|---|---|---|
| Review throughput failure | Safe work accumulates indefinitely behind the opposite-vendor gate. | Early capacity probe, queue SLO, dynamic reserve, author throttling, qualified Terra/Gemini, tier provisioning, or human staffing. |
| Director depletion | Anthropic exhaustion removes classification and escalation. | Signed checkpoint and Sol-mirror drill; restrict semantic closure and fail to human/third vendor where independence is unavailable. |
| Mirror correlation | Sol mirror semantically approves OpenAI output. | Policy matrix and audit reject same-family closure; signed verdict family is mandatory. |
| Benchmark mismatch | Public scores do not predict this harness. | Internal corpus and accepted-result metrics; public results remain priors. |
| SWE-bench defects | Fable is over-cast. | Internal E3 gate; use Opus if advantage is not demonstrated. |
| Terminal benchmark drift | TB2.1 and TB3.0 imply different routing. | Test Sol primary and Opus escalation on project-shaped tasks. |
| Reviewer evidence confusion | Authoring scores are reused as review recall. | Evidence registry labels benchmark purpose; Terra qualification uses review-specific data. |
| Cost-unit contradiction | Class budgets fall below one model turn. | Schema validates model weight × turn count; observed usage replaces estimates. |
| Task-mix drift | The illustrative pool share stops matching real work. | Rolling 50-task mix; recompute reserves and cast balance. |
| Subscription opacity | AU weights do not match actual depletion. | Log pre/post status, use wide bands, and recalibrate after fifty accepted tasks. |
| API billing leak | Deep-plan or CLI authentication silently uses API keys/credits. | Authentication audit, forbidden-environment checks, subscription-only activation gate. |
| Shared product usage | Human chats consume the same pool. | Use live state and queue forecast rather than calendar quotas. |
| Fable access mismatch | Fable invokes separately billed credits. | Require Max/premium inclusion; otherwise use Opus. |
| Gemini quota or identity mismatch | Exact model cannot be pinned or quota is unusable. | Disable affected M0/R0 capability independently. |
| Unsupported modality fallback | Audio/video is silently narrowed to still images. | Typed modality capability; return `UNAVAILABLE` for unsupported raw input. |
| Role proliferation | Similar tasks route inconsistently. | One primary per class and boundary corpus. |
| Q0 omission | Implementer defines its own oracle. | Automatic trigger test; missing Q0 blocks applicable work. |
| Test-review correlation | Code reviewer also certifies same-family tests. | Separate code and test review packets at T2/T3. |
| N0 omission | Bounded-looking lookup depends on unsearched distant evidence. | Enforced context/search surface, recorded truncation, automatic N2/I0 reclassification. |
| Verifier oracle defect | A deterministic PASS proves the wrong property. | Manifest versioning, coverage states, golden corpus, mutation tests, and reviewed verifier changes. |
| Reviewer authority creep | Reviewer edits or becomes implementer. | Read-only source, tree audit, no delegation, new author round for repairs. |
| Review recursion | Verdicts trigger infinite review. | Machine evidence audit; one independent adjudication only when contested. |
| Sol over-agency | Shell/security role mutates outside scope. | Sandbox, allowlists, tree audit, process ledger, nonce, one writer, human external-effect gate. |
| Opus/Fable over-engineering | Bounded work becomes architecture. | Scope, subsystem, diff, and allowance budgets. |
| Data-migration over-design or omission | Opus creates unnecessary machinery or misses operational skew. | Representative data, rollback, locking, partial-failure, and query-plan oracles plus Sol review. |
| Classifier fallback | Fable or Opus security-related turns silently degrade. | Model/fallback trace; identity uncertainty makes the verdict non-closing; human or qualified Gemini. |
| Long-horizon state loss | E3 loses orientation across checkpoints. | Durable blackboard, checkpoints, progress artifacts, and one integration owner. |
| Fan-out omission | Parallel narrow orders miss a consumer. | Mandatory terminal sweep step and integration review. |
| Moving target | Review covers a different tree from shipping. | Pinned identity, dirty-tree rejection, final integration review. |
| Stale/fabricated output | Old report or claimed work is accepted. | Nonce, tree audit, artifact checks, and transport attribution. |
| Unsafe degradation | Pool exhaustion yields unreviewed release. | Explicit wait/unavailable states; only qualified other family or human unblocks. |
| Human bottleneck | T3 and disputes wait indefinitely. | Concise decision packets, response-time objective, and visible queue state. |
| Runtime coupling | Role contracts depend on one CLI. | Runtime-neutral registry with independently tested adapters. |

## Verification

### Step-level proof

1. **Step 1 — capability ledger:** Invoke each subscription model selector and a no-op turn; capture resolved model, effort, authentication method, seat, status before/after, and exit behavior. Fable and Gemini activate only through included subscription paths. Detecting an API key or usage-credit path fails the default gate.

2. **Step 2 — throughput/degradation:** Complete at least twenty cross-vendor reviews. Report reviews per window, turns per review, pool movement, queue age, throttle point, and confidence intervals. Resume a synthetic workload from an Opus checkpoint under the Sol mirror and prove that no restricted decision closes.

3. **Step 3 — corpora:** Include at least two cases per class and boundary, plus review seeds across correctness, scope, security, data loss, tests, and documentation. Human adjudication produces exactly one primary class per work order.

4. **Step 4 — registry/verifier:** Load every role and assert all nineteen classes occur exactly once. Validate weakness, prohibition, context, escalation, review, fallback, and modality fields. Verifier tests must distinguish `PASS`, `FAIL`, `UNAVAILABLE`, and `COVERAGE_GAP`, reject stale manifests, and fail on changed checker code.

5. **Step 5 — policy:** Enumerate author family × risk × artifact type × test-author family. Find zero self-review routes and zero same-family T2/T3 routes. Automatically create every required Q0 order. Terra/Gemini remain non-closing until qualification passes.

6. **Step 6 — scheduler/topology:** Simulations reject third model depth, excessive fan-out, premium over-concurrency, reviewer delegation, overlapping writers, reserve deficit, illegal Sol-mirror closure, and pool-exhaustion false approval.

7. **Step 7 — harness mapping:** After implementation, retain and run:

   - `node tests/frontmatter-lint.test.js`
   - `node tests/review-lane.test.js`
   - `node tests/exec-lane.test.js`
   - `node tests/mcp-lane.test.js`
   - `node tests/scan-lane.test.js`

   Add registry, role-drift, subscription-auth, deep-plan transport, reviewer-family, Q0-trigger, verifier, modality, context-shape, topology, capacity, and exhaustion suites. Clean installs for each runtime must produce semantically identical role contracts.

8. **Step 8 — trials:** Score identical blinded tasks using deterministic acceptance, independent humans, or different-vendor evaluators. Report acceptance, 95% intervals, major defects, false blockers, stalls, retries, wall time, and separate OAU/AAU/GAU draw.

9. **Step 9 — shadow/canary:** At least fifty real tasks produce current and proposed routing records. Investigate every class disagreement, missing Q0, review-queue SLO breach, scope escape, and increased-severity outcome. Canary promotion proceeds by risk tier.

10. **Step 10 — governance:** Monthly reports show model ids, authentication, class mix, primary/fallback use, pool shares, queue age, review catches, false blockers, Q0 triggers, stalls, and policy violations. Provider changes invalidate relevant qualifications.

### Whole-system acceptance gates

The architecture is ready only when all hold:

- 100% of work orders route to exactly one primary role.
- Zero audited cases let a model evaluate its own output.
- Zero T2/T3 cases use a same-family closing reviewer.
- 100% of semantic source changes have deterministic evidence and a signed independent verdict.
- 100% of policy-triggering implementations create Q0.
- 100% of T3 side effects have human approval.
- Review capacity is at least 1.3× forecast peak arrival on the installed tiers.
- Review utilization remains at most 70% and P95 Green-state queue age meets the T1/T2 SLO.
- Pool-exhaustion tests yield neither false approval nor indefinite invisible queueing.
- Director-mirror tests preserve all open orders and produce zero restricted semantic closures.
- No class budget is below one turn of its assigned model.
- Observed vendor allowance shares are reported from a stated task mix.
- Routine accepted-result rate is no more than 2 points below the best unrestricted cast.
- T2/T3 major-defect escape is no worse than the current harness; uncertainty is reported.
- Seeded major-defect recall is at least 90% and false blockers at most 10% for the complete review system. These are proposed operational thresholds.
- Terra/Gemini reviewer qualification meets its stricter role-specific gates before use.
- N0 accepts no result containing hidden truncation or incomplete declared search coverage.
- Verifier mutations fail closed until independently requalified.
- Premium allowance per accepted T1 task is at least 35% below an all-frontier baseline without violating quality or liveness.
- Pinned verdicts attest to the shipped tree.
- Nonce, tree-audit, unfinished-process, stale-report, and model-identity tests fail closed.
- No default transport uses API keys, usage credits, or per-token billing.
- Gemini M0 activates only after at least twenty representative multimodal tasks are within 3 points of the best available alternative, exact pinning succeeds, and quota is usable.
- Raw audio/video never silently falls back to a non-capable cast.
- Performance cases route I1 → E2/E3/E4/E0 without an unowned boundary.

## Assumptions and open questions

### Assumptions

- Anthropic and OpenAI subscription terms permit the intended private multi-agent CLI workload from one authorized seat; Step 1 must confirm applicable terms.
- The installed ChatGPT and Claude tiers are unknown and cannot be inferred from model visibility.
- OpenAI’s local-message ranges are relative capacity evidence, not complete-review counts.
- OAU and AAU ratios are provisional scheduling proxies, not money.
- Provider status is observable enough to estimate coarse pool state; exact percentages may require empirical inference.
- Fable is available only when the active Max/premium seat includes it; separately billed credits are excluded.
- Google’s documentation establishes Antigravity access to Gemini 3.7 Flash, but exact headless multi-agent throughput remains to be measured.
- A qualified Gemini review lane is possible but not presumed from coding or multimodal benchmarks.
- Raw audio/video has no validated two-vendor fallback at present.
- A human authority is available for T3 approval, capacity emergencies, and unresolved disputes.
- The runtime can record actual author family and resolved model outside the blinded reviewer prompt.
- Provider-side classifier fallback may not be fully observable. Until proven otherwise, identity-uncertain security review requires another qualified family or human.
- Existing integrity and transport controls can be generalized without weakening fail-closed behavior.
- The illustrative 100-order workload mix is a starting estimate only.
- The direct API deep-plan lane can be ported to Codex CLI; otherwise that capability will be unavailable under the default architecture.

### Open questions

- Which Claude, ChatGPT, and Google subscription tiers are installed?
- How many complete T1 and T2 reviews does each installed tier sustain per five-hour and weekly window?
- Are pool-status readings machine-readable?
- What project-specific arrival rate and review-latency SLO apply?
- Which repositories and historical tasks should seed the corpora?
- Which operations are T3 beyond the defaults?
- Do confidentiality, retention, or regional constraints prohibit any vendor for particular repositories?
- Can Antigravity expose a pinned model id and trustworthy usage state in headless mode?
- Can provider traces distinguish classifier intervention from ordinary refusal?
- Is a validated subscription-compatible audio/video preprocessing path available?
- What human response-time objective applies to T3 and contested reviews?
- Should local policy require review even for complete-oracle inert mutations?
- What retention period applies to packets, provenance, usage observations, and verdict evidence?
- Should the Sol Director mirror be pre-warmed continuously or launched only from a checkpoint?
- Does the observed task mix justify retaining N0 on Haiku or switching some bounded work to Luna?
- If the subscription-only Codex transport cannot reproduce `/deep-plan` semantics, should the skill be retired or retained as an explicitly billed optional add-on?

## Critique dispositions

1. ADOPTED — Added an early review-throughput probe, dynamic reserve, queue SLO, capacity acceptance gate, and separately qualified Gemini review lane; M0 activation alone no longer authorizes code review.
2. ADOPTED — Added a Sol-medium Director mirror, signed control checkpoint, and explicit restrictions preventing same-family consequential closure.
3. ADOPTED — Corrected the CodeRabbit evidence: 63.7/40.7 are authoring scores, while Sol’s review evidence is 65/105 actionable catches and 74 full passes; Terra now receives a review-specific qualification path.
4. ADOPTED — Rebuilt per-class budgets as model-turn weight multiplied by turn count, with validation forbidding estimates below one assigned-model turn.
5. ADOPTED — Added an explicit workload mix and within-pool consumption shares, retained N0 on Haiku by default, and exposed OpenAI review as the expected bottleneck.
6. ADOPTED — Specified the deterministic verifier as owned non-agent infrastructure with typed inputs, outputs, authority, failure modes, bootstrap rules, work-plan placement, and verification.
7. ADOPTED — Added automatic Q0 triggers, sequencing, separate code/test review responsibilities, and measurable enforcement.
8. ADOPTED — Moved review-capacity and Director-degradation probes ahead of registry and policy construction, with stop conditions before expensive specification work.
9. ADOPTED — Replaced the unknowable “relevant token” threshold with enforceable supplied-context and search-surface limits, recorded truncation, and automatic N2/I0 reclassification.
10. ADOPTED — Recast E4 to Opus high, limited Terra to reversible T1 work behind a fixed integrity design, and made the allowance-versus-safety tradeoff explicit.
11. ADOPTED — Replaced Fable’s unsupported universal M0 fallback with a still-image/PDF/text-only Terra fallback and explicit raw audio/video unavailability.
12. ADOPTED — Added the verified `planner-gpt`/`deep-plan` API-key lane to the deltas and requires porting it to subscription-authenticated Codex transport or retiring it.
13. ADOPTED — Stated the blinding tradeoff and added unattributed hazard profiles plus an A/B verification trial.
14. ADOPTED — Registered the Opus-versus-Sol visual/UI evidence disagreement, cited both report locations, and justified the E5/E6 split by acceptance artifact.
15. ADOPTED — Added Opus classifier fallback to the security-review failure model and made identity uncertainty non-closing.
16. REBUTTED — I1 already establishes the missing specification: its confirmed profile and fix hypothesis route bounded code changes to E2, broad changes to E3, data/query changes to E4, and environment tuning to E0; the revision makes that existing handoff explicit and tests it, but a separate performance implementer would duplicate those primaries.
