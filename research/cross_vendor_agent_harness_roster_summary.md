# Cross-Vendor Agent Harness Roster — Working Summary

## Purpose

This document condenses the current design discussion and Anthropic/OpenAI research into a practical working roster for a Pi-based multi-agent harness.

The goal is **not** to preserve a rigid hierarchy. The harness should select models by task type, ambiguity, required autonomy, visual/spatial demands, context size, cost, latency, ease of verification, and historical performance on similar tasks.

Models should be evaluated against each other by task class, with **no model judging its own output**.

---

# 1. Core Harness Design Principles

## Route by task, not by rank

Do not assume:

> biggest model → director → smaller models → workers

Instead ask:

> Which model is most cost-effective and reliable for this specific kind of work?

A model may be a director for one task class and a specialist worker for another.

## Expensive models should resolve uncertainty

High-cost frontier models should spend most of their tokens on:

- architecture and decomposition;
- ambiguous or consequential decisions;
- difficult debugging;
- strategic review and adversarial critique;
- integration and recovery from repeated failures.

Cheaper models should perform work that is well specified, mechanically verifiable, repetitive, parallelizable, or easily reversible.

## Separate orchestration from execution

A good top-level agent should usually understand the objective, identify uncertainty, decompose the work, assign specialists, inspect evidence and failures, intervene where needed, integrate results, and verify final quality. It should not automatically write every line of code or personally inspect every file.

## Use structured agent contracts

Agents should communicate through compact task/result packets rather than forwarding full conversation histories.

### Task packet

```text
TASK_ID
OBJECTIVE
DELIVERABLE
CONSTRAINTS
RELEVANT_ARTIFACTS
KNOWN_FACTS
ACCEPTANCE_TESTS
AVAILABLE_TOOLS
TOKEN/COST BUDGET
ESCALATION_CONDITIONS
```

### Result packet

```text
STATUS
RESULT / ARTIFACT
CHANGES_MADE
EVIDENCE
TEST_RESULTS
UNRESOLVED_ISSUES
REQUESTED_ESCALATION
```

The parent generally needs the result and evidence, not the child agent's entire reasoning transcript.

## Maintain shared external state

Use a project blackboard rather than accumulating giant conversational contexts:

```text
/project_state
/artifacts
/decisions
/tasks
/test_results
/context_index
```

Agents receive only the context relevant to their assigned work. Large context windows are useful, but filling them unnecessarily increases cost, latency, noise, and the chance of irrelevant information affecting decisions.

---

# 2. OpenAI Roster

## GPT-5.6 Sol

### Primary role

**Director, architect, adjudicator, and difficult-problem resolver**

Treat Sol as scarce executive attention.

### Strong uses

Use Sol for:

- high-level architecture;
- decomposing poorly specified projects;
- choosing between competing technical approaches;
- deciding whether a bug needs a local fix or subsystem redesign;
- resolving conflicts between worker agents;
- difficult root-cause debugging;
- integrating results from several teams;
- final review of consequential technical decisions;
- designing acceptance criteria;
- identifying hidden dependencies;
- reasoning across several subsystems at once;
- cross-vendor adjudication when other strong models disagree.

### Example tasks

- Determine the architecture for a procedural ship-generation system.
- Decide whether a Godot navigation problem should be patched or redesigned.
- Review competing multiplayer architectures and choose one.
- Interpret a vague feature request and convert it into a task DAG.
- Adjudicate conflicting recommendations from Claude and Gemini models.

### Avoid using Sol for

Simple repository searches, repetitive edits, basic test generation, routine extraction, mechanical refactors, or straightforward implementation from a strong specification.

---

## GPT-5.6 Terra

### Primary role

**Senior engineer, subsystem lead, and large-context workhorse**

Terra is appropriate when a worker must understand a system rather than simply execute instructions.

### Strong uses

Use Terra for:

- subsystem-level debugging;
- large repository comprehension;
- substantial multi-file implementation;
- understanding interactions among several components;
- medium-to-large refactors;
- reviewing Luna output;
- managing a small worker subtree;
- research synthesis over substantial context;
- tasks where long-context performance matters.

### Example tasks

- Understand a boarding-AI subsystem and determine why several states interact incorrectly.
- Modify a gameplay system touching controller, animation, and navigation code.
- Analyze a large codebase and propose a bounded refactor.
- Review Luna-generated implementation and determine whether adjacent behavior is at risk.

### Terra vs. Luna

Prefer Terra when requirements are fuzzy, many files or subsystems are involved, context is very large, diagnosis matters more than execution, or Luna has already failed.

---

## GPT-5.6 Luna

### Primary role

**High-volume worker, scout, verifier, and semantic control-plane model**

Luna is cheap enough to carry a large share of total token volume.

### Strong uses

Use Luna for:

- repository reconnaissance;
- locating files, symbols, references, and dependencies;
- narrowly specified implementation;
- test generation and execution;
- log inspection;
- extraction and classification;
- formatting and normalization;
- comparing files;
- summarizing tool output;
- generating several cheap candidate solutions;
- checking artifact completeness;
- routing/classifying incoming tasks;
- compressing worker reports;
- semantic checks that do not require frontier reasoning.

### Example tasks

- Find every call site of a ship-damage function.
- Add a field to several clearly identified data structures.
- Generate tests from explicit acceptance criteria.
- Run a parameter sweep and summarize failures.
- Compare a generated artifact against a checklist.
- Classify an incoming task as coding, research, visual, debugging, or architecture.

### Avoid giving Luna sole responsibility for

High-impact architecture, deeply ambiguous requirements, very large-context synthesis, long autonomous projects, or strategic judgment.

Try Luna first when a task is narrow, well specified, reversible, and objectively verifiable. Escalate using observable failure conditions rather than self-reported confidence.

---

# 3. Anthropic Roster

## Claude Fable 5

### Primary role

**Frontier explorer, spatial-reasoning specialist, adversarial architect, and difficult-project escalation model**

Fable should not automatically be the permanent Anthropic director. Its strongest role is where the problem itself remains poorly understood.

### Strong uses

Use Fable for:

- highly ambiguous frontier problems;
- long-running research programs;
- difficult scientific or engineering exploration;
- problems requiring several interacting workstreams;
- spatial reconstruction from multiple references;
- interpreting dense visual or geometric information;
- global visual critique;
- architectural rescue after other frontier models stall;
- adversarial review of Sol, Opus, or Gemini plans;
- finding systemic problems that local implementation agents may miss.

### Particularly strong visual/spatial tasks

Fable appears especially promising when the task requires constructing a coherent global representation from several visual inputs.

Examples:

- infer ship geometry from several reference images;
- detect why a hull looks globally wrong despite valid component dimensions;
- reconstruct approximate scene or floor-plan layout from screenshots;
- compare rigging proportions across historical references;
- reason about deck arrangement, mast hierarchy, sail placement, and silhouette simultaneously;
- critique procedural content that passes numerical rules but still looks visually incoherent.

### Example harness assignment

> Review 20 procedural frigate renders and identify which dimensional rules are producing historically implausible silhouettes. Return revised constraints, not implementation code.

### Best evaluation role

Fable is well suited to judging long-horizon coherence, strategic direction, systemic architecture, global visual consistency, whether a research program is pursuing the wrong approach, and whether a solution creates downstream problems outside its local scope.

### Avoid using Fable for

Routine implementation, repetitive validation, high-volume swarms, mechanical edits, basic code review, or cheap tasks with deterministic verification.

---

## Claude Opus 5

### Primary role

**Principal autonomous engineer, default premium Anthropic director, technical adjudicator, and visual-systems builder**

Opus currently looks like the strongest default high-end Anthropic model for general technical work.

### Strong uses

Use Opus for:

- difficult software architecture;
- large refactors;
- root-cause debugging;
- autonomous coding with heavy tool use;
- multi-agent coordination;
- final technical integration;
- cross-agent adjudication;
- complex browser/computer workflows;
- code review requiring deep judgment;
- tasks where the model may need to invent its own diagnostic tools.

### Visual and procedural coding strengths

Opus has particularly relevant evidence for tasks where **code produces visual or spatial output**.

Strong candidate assignments include:

- procedural mesh generation;
- Blender Python automation;
- FreeCAD or parametric CAD generation;
- Godot procedural level generation;
- Unity procedural systems;
- Unreal procedural-generation architecture;
- complex shader generation;
- animation systems;
- interactive UI systems;
- rendering-feedback loops;
- writing inspection tools that evaluate generated visual output.

### Example harness assignments

- Build a procedural ship-hull generator from parametric cross-sections.
- Create a Blender script that converts hull measurements into editable geometry.
- Generate procedural mast and yard placement based on ship class.
- Build a screenshot/render inspection loop and automatically revise malformed results.
- Diagnose why procedural geometry is technically valid but visually broken.
- Design a reusable shader architecture and representative implementations.

### Distinctive value

Opus appears strong when the model must do more than implement an algorithm—it can also invent tooling required to inspect and validate visual output.

This makes it a strong candidate for loops such as:

```text
write code
→ run game/tool
→ capture output
→ inspect result
→ diagnose defect
→ modify implementation
→ repeat
```

### Best evaluation role

Opus should judge technical correctness under ambiguity, architecture, difficult debugging conclusions, implementation quality, integration risk, unnecessary complexity, and consequential Sonnet or Haiku work.

### Avoid using Opus for

Large numbers of trivial workers, basic extraction, simple formatting, or repetitive tests that a cheaper model can run.

---

## Claude Sonnet 5

### Primary role

**Default senior executor, production engineer, and subteam lead**

Sonnet should likely handle the largest share of serious Anthropic implementation work.

### Strong uses

Use Sonnet for:

- substantial feature implementation;
- brownfield coding;
- multi-file debugging;
- repository-aware refactors;
- browser and terminal workflows;
- test creation and repair;
- API integrations;
- build/deployment tasks;
- productionizing prototypes;
- leading small groups of Haiku workers;
- converting an Opus/Fable architecture into maintainable code;
- reviewing Haiku implementations before escalation.

### Visual and procedural coding uses

Sonnet is a strong choice once the architecture and visual goal are reasonably clear.

Examples:

- convert an Opus prototype ship generator into production Godot code;
- add deterministic seeds to a procedural generator;
- implement LOD generation;
- build editor controls;
- create serialization and save/load support;
- add collision meshes;
- integrate navigation;
- optimize geometry generation;
- extend an existing generator to additional ship classes;
- implement shader variants from an established visual specification;
- fix visual regressions identified by screenshots or tests.

### Best evaluation role

Sonnet is especially useful for implementation-feasibility review. Have it ask:

- Can this architecture be implemented cleanly?
- Are interfaces sufficiently specified?
- Are dependencies missing?
- Are acceptance tests practical?
- Does the design fit repository conventions?
- Is the director proposing unnecessary abstractions?
- Does the change create migration or maintenance problems?

### Avoid giving Sonnet sole authority over

Unresolved strategic architecture, highly ambiguous cross-project decisions, frontier scientific reasoning, or subjective final visual direction when evidence is incomplete.

---

## Claude Haiku 4.5

### Primary role

**Tactical parallel worker, fast scout, bounded implementer, and validator**

Haiku should provide cheap, responsive Anthropic execution around stronger planners.

### Strong uses

Use Haiku for:

- repository reconnaissance;
- symbol searches;
- extracting facts;
- classifying logs;
- formatting;
- schema conversion;
- bounded code edits;
- simple test generation;
- running tests;
- parameter sweeps;
- high-volume experiments;
- comparing configurations;
- checking explicit constraints;
- summarizing worker artifacts;
- real-time tool loops;
- generating many inexpensive candidate configurations.

### Visual/procedural uses

Haiku is useful around visual systems when the work can be tightly bounded.

Examples:

- generate 100 procedural ship seeds;
- record mesh validity and generation time;
- flag geometry outside dimension constraints;
- classify screenshots into failure categories;
- identify blank materials or missing assets;
- check whether required nodes exist in a scene tree;
- modify isolated shader parameters;
- reproduce a visual bug across many configurations;
- compare render metadata to a checklist;
- create parameter presets from a fixed schema.

### Example assignment

Instead of:

> Design a procedural ship generator.

Give Haiku:

> Generate 40 frigate parameter sets from this schema, run them, reject any with invalid geometry or frame time above the threshold, and return the best five surviving candidates.

### Best evaluation role

Haiku is appropriate for checking schema compliance, required files or fields, checklist completeness, explicit constraint violations, unsupported claims in structured reports, prohibited dependencies, test output, and scope violations.

### Avoid giving Haiku sole responsibility for

Architecture, ambiguous judgment, long autonomous tasks, broad visual-quality decisions, or certifying tests that Haiku itself created. Prefer hidden or independent validation.

---

# 4. Cross-Vendor Capability Roster

The strongest emerging design is not a fixed organization chart. Maintain a **capability roster**.

```text
Architecture / difficult adjudication
    Sol
    Opus
    Fable when unusually ambiguous

Large-system engineering
    Opus
    Terra
    Sonnet

Production implementation
    Sonnet
    Terra
    Luna-high where tightly specified

Cheap bounded execution
    Luna
    Haiku

Visual-spatial interpretation
    Fable

Procedural / interactive visual coding
    Opus

Productionization of visual systems
    Sonnet

Batch visual testing / parameter sweeps
    Haiku
    Luna
```

Future Gemini research should be inserted into this same task-class matrix rather than creating a separate vendor hierarchy.

---

# 5. Cross-Vendor Collaboration Pattern

Vendor diversity is most useful when models have **different jobs**, not when several expensive models independently solve everything.

### Wasteful pattern

```text
Sol solves
Fable solves
Opus solves
Gemini solves
→ majority vote
```

### Better pattern

```text
Sol or Opus
    → architecture

Sonnet / Terra
    → implementation

Luna / Haiku
    → tests, reconnaissance, batch validation

Fable
    → adversarial or spatial review when needed

Different-vendor frontier model
    → adjudication if major disagreement remains
```

Use full independent parallel solutions only when the value of diversity justifies the extra cost.

---

# 6. Evaluator Policy

## Never let a model evaluate itself

At minimum enforce:

```text
requested_model_id != evaluator_model_id
actual_model_id    != evaluator_model_id
```

The second check matters when provider fallback behavior is possible.

## Blind evaluators where practical

Hide model identity, vendor identity, model tier, price, and unnecessary provider-specific formatting.

## Assign evaluators by criterion

| Evaluation criterion | Strong Anthropic candidate |
|---|---|
| Schema / formatting / checklist compliance | Haiku |
| Tests / implementation feasibility | Sonnet |
| Difficult technical correctness | Opus |
| Long-horizon strategy / global coherence | Fable |

Equivalent OpenAI and Gemini specialists should eventually be added.

## Use deterministic tests before model judgment

For coding and procedural generation, automatically measure whatever can be measured:

- build success;
- unit and hidden tests;
- runtime errors;
- geometry validity;
- non-manifold geometry;
- collision validity;
- deterministic generation;
- polygon count;
- draw calls;
- frame time;
- memory use;
- required scene nodes;
- serialization correctness;
- API contract compliance.

Use model judges for what remains difficult to quantify:

- aesthetics;
- historical plausibility;
- global visual coherence;
- maintainability;
- architecture;
- usability;
- interpretation of ambiguous intent.

---

# 7. Escalation Policy

Prefer observable escalation rules over model confidence scores.

```text
Luna / Haiku task
    ↓
passes deterministic checks
    → done

fails twice / scope grows / ambiguity appears
    → Terra or Sonnet

subsystem conflict / architecture required
    → Sol or Opus

frontier ambiguity / repeated premium-model failure /
major spatial or global-coherence problem
    → Fable

frontier models materially disagree
    → independent cross-vendor adjudicator
```

---

# 8. Example: Procedural 18th-Century Ship Generator

Suppose the task is:

> Build a procedural ship-generation system in Godot or Blender that produces historically coherent 18th-century ship classes from configurable parameters and visual references.

A strong initial assignment pattern is:

## Fable — visual/spatial research

Use Fable to infer:

- hull proportion ranges;
- sheer and tumblehome rules;
- mast hierarchy;
- yard hierarchy;
- sail-plan constraints;
- deck proportions;
- gunport relationships;
- visual signatures of each ship class;
- global coherence rules.

Use it again when outputs satisfy numeric constraints but still **look wrong**.

## Opus — procedural architecture and visual implementation

Use Opus for:

- procedural hull geometry;
- spline and cross-section algorithms;
- rigging generation;
- parametric masts and yards;
- mesh construction;
- scene generation;
- shader logic;
- Blender/Godot tooling;
- automated render inspection;
- iterative visual debugging;
- creation of custom diagnostic tools.

## Sonnet — productionization

Use Sonnet for:

- deterministic seeds;
- editor tooling;
- serialization;
- asset management;
- LOD generation;
- collision;
- navigation;
- optimization;
- extending the system to new ship classes;
- regression testing;
- maintainability refactors.

## Haiku / Luna — experiment and validation swarm

Use cheap workers for:

- parameter sweeps;
- build execution;
- generation of large seed sets;
- performance collection;
- screenshot classification;
- geometry checks;
- constraint validation;
- log inspection;
- isolated fixes;
- compact reports.

This should be treated as an **initial hypothesis to evaluate**, not permanent doctrine.

---

# 9. Performance Telemetry

Every task should generate structured telemetry so future routing becomes empirical.

Record:

```text
model
exact model version
vendor
task type
reasoning / effort level
system prompt version
agent scaffold version
context supplied
tools available
input tokens
output tokens
cached tokens
wall-clock time
tool calls
retries
subagents created
deterministic test results
reviewer scores
human intervention
human final rating
total cost
accepted / rejected outcome
```

Over time, the harness should learn relationships such as:

```text
Godot scoped feature
    → which model produces the cheapest accepted implementation?

Repository reconnaissance
    → which cheap model has the best success/latency ratio?

Spatial reference reconstruction
    → does Fable retain its apparent advantage internally?

Procedural visual system
    → does Opus produce the best accepted-output rate?
```

The evaluation project should replace intuition with actual harness data.

---

# 10. Evaluation Methodology

Do not rely on one global benchmark score.

Compare models using:

- equal-dollar trials;
- equal-time trials;
- equal-token trials;
- cost to reach a target quality;
- retries required;
- human correction required;
- tool-use success;
- reviewer agreement;
- deterministic acceptance rate.

For some task types, compare:

```text
1 × expensive-model attempt
```

against:

```text
several cheaper parallel attempts
+ independent selection/review
```

The winner should be whichever approach yields the best **accepted result per dollar and unit time**.

---

# 11. Current Working Roster

## OpenAI

### Sol
**Use when:** deciding, architecting, adjudicating, integrating, or solving genuinely difficult ambiguity.

### Terra
**Use when:** understanding or modifying substantial systems, especially with large context.

### Luna
**Use when:** performing cheap, bounded, parallel, verifiable work or semantic control-plane tasks.

## Anthropic

### Fable 5
**Use when:** the problem is frontier-level, spatially complex, globally incoherent, highly ambiguous, or resistant to other premium models.

### Opus 5
**Use when:** difficult technical work, autonomous coding, visual/procedural system generation, multi-agent coordination, or premium adjudication is required.

### Sonnet 5
**Use when:** substantial production engineering must be done efficiently and reliably.

### Haiku 4.5
**Use when:** work is narrow, fast, high-volume, parallelizable, and easy to verify externally.

---

# 12. Current Design Direction

The most promising architecture is a **dynamic capability market**, not a fixed hierarchy.

A routing layer should decide:

```text
Who should solve this?
Who should review it?
Who should verify it?
When should it be escalated?
Is parallel cheap execution better than one premium attempt?
```

The eventual roster should be built from empirical task-level performance across OpenAI, Anthropic, Gemini, and potentially other vendors.

The harness itself becomes the evaluation system that continuously improves those routing decisions.
