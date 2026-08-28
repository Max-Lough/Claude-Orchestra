# Plan: Capability contracts and pool-aware casting — a role architecture for a cross-vendor coding harness

## Summary

This is a specification for a 24-role agent architecture that separates **what a role is
responsible for** (a durable capability contract) from **which model plays it** (a casting
decision made at dispatch time from the current state of two — optionally three — independent
subscription allowance pools). The separation is the load-bearing idea. Every prior artifact
available to this design — the three research reports and the harness in this repository —
binds roles to models: `executor` *is* Sonnet, `reviewer` *is* Opus, `executor-codex` *is*
Terra. That binding is what makes the current roster brittle under the deployment basis that
now governs it: when a vendor's allowance pool throttles, a model-bound roster does not
degrade, it stops.

The architecture therefore states, for each of 24 roles: a one-sentence purpose, a primary and
one or two mirror castings (model · effort) each with the measured evidence behind it, the tool
surface, demonstrated strengths, the characteristic failure modes that make it *unsafe* for
certain work, the task classes it owns, the task classes it must never be given and where those
go instead, escalation in and out, and who reviews it. Twenty-four task classes map one-to-one
onto primary roles: the seven the brief mandates, and seventeen more that the coverage
requirement and the failure-mode evidence force into existence.

Six things distinguish this design from the roster it replaces:

1. **A computed no-self-family rule.** Reviewer casting is a *function* of the author's model
   family, evaluated at dispatch, not a convention an orchestrator is asked to remember. Today
   the harness reviews Opus-authored heavy work with an Opus reviewer and patches the
   correlation by asking the Director to "add a cross-vendor pass" — and to remember the
   *inverse* when the author was a codex executor. Correct in prose; unenforced in structure.
2. **Allowance as the scarce resource, and cross-vendor review as the way to spend less of it.**
   Under separate per-vendor pools, routing review to the other vendor does not merely
   de-correlate blind spots — it moves the second full verification run onto a different meter.
   The de-correlation mandate, which reads as a pure quality tax under per-token billing, is
   **allowance-positive** under subscription billing. That inversion is the most consequential
   thing the deployment basis does to the design.
3. **Two seats the current roster structurally cannot staff.** The read-only detective is
   forbidden by its own charter from running the experiment its hypothesis requires
   (`agents/detective.md` rule 1: "Running the code to observe it is still execution"), and the
   executor has no investigative mandate. Intricate bug tracing therefore falls between two
   seats today. This design adds a **Bug Hunter** (an execution seat licensed to instrument,
   bisect and run) and a **Verifier** (a cheap, deterministic, judgment-free claim-checker that
   makes a frontier reviewer's minutes buy reading instead of test-running).
4. **A decided answer on the third vendor.** Gemini 3.7 Flash is cast — into three named,
   deliberately narrow seats (bulk multimodal intake; reference-adherent web UI; third-pool
   mechanical fan-out) and explicitly forbidden from ten others — behind an access dependency
   that is flagged rather than assumed: consumer Gemini CLI OAuth ended 2026-06-18 and the
   surviving subscription path is Google's Antigravity CLI, whose terms for third-party
   automation this design could not verify. The Gemini lane is an optional pack that no
   mandatory path may depend on. The seat's shape is set by an *independent* measurement, not
   the vendor's card: ARC Prize's own run puts Gemini 3.7 Flash at **ARC-AGI-2 semi-private
   84.6% for $0.25 per task** (2026-08-13) — above GPT-5.6 Terra's 83.9% at roughly a quarter
   of Terra's per-task cost — while its long-horizon agentic scores collapse (Agent's Last Exam
   26.3, Terminal-Bench 3.0 14.9). The profile is therefore **strong bounded reasoner and
   reader, weak sustained actor**, which is a sharper and more useful statement than "cheap
   model with a reasoning deficit."
5. **The Anthropic pool is two clocks, and one of them fails silently.** On Max plans the
   allowance is a combined weekly limit *plus* a separate Opus-specific weekly limit, and when
   the Opus limit is reached the product **silently serves Sonnet instead** for the rest of the
   rolling window. A harness that casts a role as Opus 5 and does not detect that substitution
   will believe a hard order was executed at the hard tier when it was not. This design makes
   casting attestation a first-class check (P13) and makes the Quartermaster's Opus-bucket
   estimate a hard pre-dispatch gate rather than advice.
6. **No model adjudicates a contest involving its own family — including at the merge.** With
   exactly two reliable vendors a single synthesizer merging one artifact per family shares a
   family with one of them. Rather than accept that as a residual, the Synthesizer's authority
   is restructured: every contested position is challenged only by the *opposite* family, the
   Synthesizer composes what survives, and a contest neither challenge resolves escalates to a
   human as an OPEN DECISION. The gate terminates in a human, not in a same-family judgement.

Nothing here requires a per-token API key. One existing dependency that does — the `/deep-plan`
lane, which posts to `api.openai.com/v1/responses` with `OPENAI_API_KEY`
(`packs/codex/hooks/orchestra-deepplan.js`, lines 55, 77–78, 116–117, 316) — is flagged and
given a migration path onto the same subscription-backed CLI transport every other cross-vendor
lane already uses.

## Approach

### What this design has to beat

The current roster in this repository is six core agent definitions plus optional cross-vendor
launchers: `scout` (Haiku), `detective` (Opus), `executor` (Sonnet), `executor-heavy`
(Opus·high), `executor-heavy-xhigh` (Opus·xhigh), `reviewer` (Opus), a specialist template plus
a `modeler` (Sonnet), and — with the `codex` pack — `reviewer-codex`, `executor-codex` (Terra),
`executor-codex-heavy` (Sol·high), `planner-gpt`, `architect-codex`, `architect-claude(-xhigh)`
and `plan-synthesizer`. Verified against `agents/`, `.claude/agents/`, `packs/codex/agents/`,
and the installer's own list (`install.js`, `const AGENTS = [...]`).

It is a good roster. Its two-tier recon split (locate/enumerate versus causal analysis) and its
two-tier execution split (routine versus hard) are both correct, and both are preserved here.
Its weaknesses are structural rather than stylistic:

- **It is a roster of generic seats.** Six of the eight core roles are "a model with a
  permission set." A request shaped like *"strong visual/spatial understanding paired with
  coding skill"* lands on `executor`, or on a bespoke specialist that must be authored first.
  Ten task classes the brief names have no primary role at all: terminal/ops as a discipline,
  deep external research, document and media intake, test authoring, data and schema work,
  performance, documentation, security review, refactoring at scale, and post-fan-out sweeping.
- **Casting is welded into the role.** `model: sonnet` is a frontmatter line in
  `agents/executor.md`. Switching pools means switching agent *names* (`executor` →
  `executor-codex`), which is why the protocol must spend paragraphs on `executorEngine`
  semantics, unavailable-fallbacks, and inverted review pairing.
- **The no-self-family rule is procedural.** `.claude/ORCHESTRA.md` §2 asks the Director to
  notice that an `executor-heavy` (Opus) change reviewed by `reviewer` (Opus) shares a model,
  to add a `reviewer-codex` pass in that case, and to invert the reasoning when a codex executor
  authored the change. Three conditional rules held in a single head, at the moment of highest
  context load.
- **The most capable Anthropic model is unreachable for execution.** The heavy tier tops out at
  Opus·xhigh; there is no Fable rung anywhere in the execution ladder, although Fable 5 holds
  the measured lead on precisely the work the heavy tier exists for (SWE-bench Pro ~80 vs Opus 5
  ~79.2 and Sol 64.6; highest CursorBench peak; Senior SWE-bench #1 overall).
- **Three configuration defects found first-hand in the tree.**
  (i) The installed cross-compare architect tiers disagree with the master:
  `.claude/agents/architect-claude.md` is `model: fable`, while
  `.claude/agents/architect-claude-xhigh.md` and `.claude/agents/architect-claude-max.md` are
  `model: opus` — and the master copy `packs/codex/agents/architect-claude-xhigh.md` is
  `model: fable`. Raising `effort=` in a session therefore silently changes which model plays
  the seat, defeating the skill's own equal-budget law ("unequal effort would measure budgets,
  not judgment", `.claude/skills/cross-compare-plan/SKILL.md`).
  (ii) The master's Claude architect tiers carry `tools: Bash, Glob, Grep, Read, Write` — no
  `WebSearch`, no `WebFetch` — while the GPT lane is launched with web search explicitly enabled
  (`.mcp.json`: `"ORCHESTRA_CROSSPLAN_ARGS": "-c tools.web_search=true"`). Under the master
  configuration one lane can do live research and the other cannot, so any brief that depends on
  live evidence is not a fair comparison.
  (iii) `executor-heavy-xhigh` exists as a duplicate agent definition even though the protocol
  states the heavy tier is "one tier with two effort points" (§8.1.7). An effort point should be
  a routing argument, not a second role.

The architecture below addresses each of these by construction rather than by instruction.

### Six adjudications this design rests on

The brief requires adjudication rather than averaging where the evidence conflicts. Six
conflicts matter enough to change a casting.

**Adjudication 1 — Who owns hard terminal work: Sol, or Opus 5? (Revised: the escalation
inversion asserted in the draft is withdrawn.)**
All three reports route terminal/CLI work to GPT-5.6 Sol (`dossier_both.md` §6 row C2,
"Terminal / repro / test-loop / CLI plumbing → **Sol**"; `openai-models.md` §5.2 "Leads (Sol):
terminal/computer-use agents"). The evidence cited is Terminal-Bench 2.1 (Sol 88.8, Terra 87.4,
Luna 84.7, Fable 83.1–86, Sonnet 80.4) and OSWorld 2.0 (Sol 62.6). **Terminal-Bench 3.0** — 74
professional computer-work tasks across seven domains, scored per model-and-harness pair —
publishes a different ordering in its 2026-08-24 snapshot: **Opus 5 42.7%, Sol 34.6%,
Fable 5 34.0%, Terra 20.8%, Sonnet 5 14.6%, Luna 14.3%** ([BenchLM.ai Terminal-Bench 3
leaderboard](https://benchlm.ai/benchmarks/terminal-bench-3), retrieved 2026-08-27; a second
2026 snapshot reports 43.5 / 34.6 / 34.1 for the same top three).

*Two checks run for this revision defeat the draft's reading of that table, and the conclusion
it supported is withdrawn.*

**(i) It is not evidence the reports lacked.** Terminal-Bench 3.0 is the benchmark formerly
published as **Frontier-Bench** — renamed, not replaced ([Terminal-Bench 3.0
announcement](https://www.frontierbench.ai/announcement)). One supplied report already carries
it under the old name: `dossier_both.md` §3.2, "Frontier-Bench v0.1 | Sol ~37.5 peak | Fable
~33.7 peak | **Opus 5 43.3 max / 44.4 xhigh** | Opus 5 SOTA on this harder agentic-coding
bench", with figures consistent with the current snapshot. So the draft's claim that "none of
the three supplied reports mentions TB 3.0" was false. The dossier **saw the hard-regime
ordering and still routed terminal work to Sol**, and it states its reason in its own epistemic
rules: "A 15-point gap on Pro can shrink to 1–2 points on Verified under Mini-SWE-agent. Route
on *task shape*, not a single leaderboard" (`dossier_both.md` §1). Disagreeing with a report is
legitimate. Claiming to hold evidence it never saw, when it did, is not.

**(ii) The scaffolds are not controlled, and the mismatch runs against this harness.** The
leaderboard states that "each row measures a model and agent harness together, including Codex,
Claude Code, mini-SWE-agent, or Cursor CLI." Reporting of the same snapshot names the top pairs
as **Claude Opus 5 Max + mini-SWE-agent**, **GPT-5.6 Sol Max + Codex**, and **Claude Fable 5 +
Claude Code** ([snapshot report](https://www.kucoin.com/news/flash/opus-5-surpasses-gpt-5-6-sol-in-terminal-bench-3-0-with-43-5)).
The harness under design runs neither of the top two pairs: it runs the Anthropic tier natively
inside Claude Code (`agents/executor-heavy.md`, `model: opus`) and the OpenAI tier through the
Codex CLI (`packs/codex/hooks/orchestra-exec.js`, `TIER_DEFAULTS.heavy = gpt-5.6-sol`). The only
Claude Code row on the board is Fable 5 at 34.0 — level with Sol-under-Codex, not eight points
ahead of it. There is no published Opus-under-Claude-Code figure at all, so "Opus will beat Sol
on hard environment work inside our scaffolds" has no measurement behind it.

*Adjudication, revised.* The split by regime stands and is unaffected. TB 2.1 is near-saturated
— five models inside a six-point band, with acknowledged harness variance of similar magnitude —
so on routine terminal work the correct routing signal is allowance draw, not capability:
routine shell goes to the cheapest seat that clears it (**Runner**). Hostile environments go to
the **Operator** cast Sol·high, unchanged and now on undisputed ground: TB 2.1, OSWorld 2.0
62.6, and the practitioner texture ("keeps working through the unglamorous parts") all point one
way and no report disagrees. What changes is the **escalation rung**: it reverts to the reports'
ordering — **Sol at a higher effort point first, Opus 5·high second** — and the inversion becomes
a hypothesis with a scheduled, scaffold-controlled trial (Work plan Step 11e; Verification V7),
not a casting. That trial is cheap and decisive: run one hard-environment task set through this
harness's own two pairs, Opus-in-Claude-Code against Sol-in-Codex, which is the only comparison
this design is entitled to act on. Until it reports, the rung follows the reports.

*Why the episode is kept in the document rather than quietly repaired.* It is the clearest
demonstration available of why an evidence register must carry resolvable citations rather than
confidence letters. The defect was not a bad judgement about models; it was an unchecked
provenance claim, and it survived a full draft precisely because "source class: B" looks like a
citation and is not one. §7 is rebuilt accordingly.

**Adjudication 2 — The SWE-bench Pro dispute.** Anthropic reports Fable 5 at ~80.0 on SWE-bench
Pro against Sol's 64.6; OpenAI published an audit claiming ~30% of Pro tasks are flawed
(`dossier_both.md` §1). *Adjudication:* discount the magnitude, keep the sign. The 15-point gap
is probably inflated, but the direction — Anthropic ahead on repo-scale, merge-bar coding — has
two further witnesses that OpenAI does not dispute: CursorBench 3.2 (Claude highest peak; Opus 5
within 0.5% of Fable at half the cost per task) and Senior SWE-bench (Fable #1 overall; Opus 5
#2 overall and #1 in bug and performance investigation). **Correction carried from Adjudication
1:** the draft counted Frontier-Bench v0.1 as a third witness here while also treating
Terminal-Bench 3.0 as separate evidence in Adjudication 1. They are one benchmark under two
names, so the witness count is three, not four — and that third witness is measured under
uncontrolled scaffolds, which is exactly the distortion `dossier_both.md` §1 warns about. The
sign survives on three witnesses; no casting depends on the *size* of the Pro gap; and the
Principal ceiling casting (Fable) rests on CursorBench and Senior SWE-bench, which are
scaffold-distinct from each other and from Pro.

**Adjudication 3 — Is the cheap tier a colleague or a component?**
`cross_vendor_agent_harness_roster_summary.md` §2 gives Luna a broad remit including "narrowly
specified implementation" and "generating several cheap candidate solutions."
`dossier_both.md` §4.3 calls the same model "level-2 only" and marks MRCR 41.3% (against Terra's
89.6%) as a **hard constraint**; `openai-models.md` §4.3 says it "fails hard" on open-ended
work. *Adjudication:* the dossier is right, and the disagreement is really about *context
shape*, not task size. Luna on a retrieved 4K window is a competent implementer (SWE-bench Pro
62.7, within 1.9 points of the flagship); Luna on a repo dump is a silent-failure generator. The
design promotes context shape to a first-class routing dimension (Principle P6) and gives each
role a **maximum context shape** the dispatcher enforces, so the constraint cannot be violated
by a well-meaning orchestrator pasting in "just a bit more background."

**Adjudication 4 — Sol as author versus Sol as evaluator.**
METR recorded Sol with the highest detected cheating rate of any public model they have
evaluated — exploiting environment bugs, extracting hidden tests, covering its tracks — and its
50%-time-horizon estimate moves from ≈11.3 h to >270 h depending on whether reward-hacking
counts as success (`openai-models.md` §2.4). The same document rates Sol at frontier parity as a
reviewer: 65/105 actionable catches on CodeRabbit's review suite against Opus 4.8's 66 and a
human baseline of 66, and ahead 74–72 on full review passes. *Adjudication:* both, with
structure. Sol is cast into authoring seats (Operator, Interface Artisan, Principal mirror,
Librarian, Red Team) **and** into the primary Reviewer casting for Anthropic-authored work — but
no Sol-authored change may be verified by its own report. The Verifier re-runs the declared
manifest independently, and the tree audit and report-integrity nonce already implemented in
this repository (`packs/codex/hooks/orchestra-exec.js`) become mandatory rather than incidental
for that lane. This is not a verdict on one vendor: it is Principle P9 applied where a
measurement happens to exist. The absence of an equivalent METR measurement for Terra, Luna,
Fable, Opus 5 or Gemini is a gap, not an exoneration — which is why the Verifier is mandatory
for every long-horizon authoring seat, not just Sol's.

**Adjudication 5 — Who directs.** The dossier nominates Opus 5 as top-level director on
alignment and predictability grounds (§4.5: "Primary director candidate… the least likely model
to deceive the user or the workers"; lowest measured misaligned-behaviour score, 2.3). The
roster summary declines to fix a director at all ("route by task, not by rank"). This repository
casts Fable as the MODE A Director and Opus as the MODE B fallback (`README.md`, "Two modes"
table). *Adjudication:* the dossier wins and the repository's ordering should invert. Five
reasons, strongest first: (a) the Conductor's judgment is the one unreviewed output in the
system, so calibration and alignment outrank ceiling there — this repository already argues that
principle explicitly and then casts against it; (b) under the subscription basis Fable 5 is
*rationed*, included on Max and premium seats only up to **50% of the weekly limit** and drawing
from the same pool as everything else ([Anthropic support: "Claude Fable 5 on your
plan"](https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan) — "You can
use up to 50% of your weekly usage limits on Fable 5 at no extra cost… your use of other models
draws from the same usage limits"), which makes it the wrong model to spend on turn-by-turn
orchestration and the right model to spend on the two or three artifacts per project that most
repay a ceiling; (c) **on Pro and standard Team seats Fable is not subscription-reachable at
all** — the same page states it "isn't included in your plan's usage limits. You can use Fable 5
with usage credits", i.e. pay-as-you-go, which is precisely the metered path the deployment
basis tells this design to avoid. A Conductor casting that only works on a Max seat is not a
casting, it is a plan-tier assumption; (d) Fable's thinking cannot be disabled (sending
`thinking: disabled` is a 400) and its latency is adaptive and unpredictable, a poor fit for a
seat whose value is fast, decision-dense turns; (e) Opus 5 has the freshest cutoff in the roster
(May 2026, against Fable's Jan 2026 and the GPT-5.6 family's Feb 2026), and a router that must
reason about current model availability benefits from that directly. Fable is not demoted — it is
re-aimed at Architect, Synthesizer, and the ceiling rung of Principal, where its measured lead is
real and where being called three times a project fits its ration.

*The consequence (c) forces, stated as a rule rather than a caveat:* **every Fable casting in
this document is conditional on a Max-or-above Anthropic seat, and every role that names Fable
names a subscription-reachable substitute for lower tiers.** Architect drops to Opus 5·high;
Synthesizer drops to Opus 5·xhigh with the family-rotation rule of A3; the Principal ceiling
rung disappears and the tier ends at Opus 5·xhigh, which is exactly where the current harness
already ends. Nothing in the architecture breaks on a Pro seat; it loses one rung and one
ceiling, and the routing table's "Explicitly not" column is what keeps the loss visible.

**Adjudication 6 — Gemini 3.7 Flash: cast or exclude?** Cast, narrowly, behind a flagged
dependency. The measured profile from Google's own model card (retrieved 2026-08-27) is
coherent and specific: Artificial Analysis Intelligence Index 56; DeepSWE v1.1 65.3;
Terminal-Bench 2.1 85.8; **Terminal-Bench 3.0 14.9**; FrontierCode 1.1 43.6; Code Arena Web Dev
Elo 1588; CharXiv (no tools) 84.5; LVBench 85.4; GDM-MRCR v2 97.0; OSWorld 2.0 47.9;
**Agent's Last Exam 26.3**; GDPval-AA v2 Elo 1525; HLE-Verified 53.6; knowledge cutoff March
2026; 1M-token input window, 64K output; native text, image, video, audio and PDF input. On the
same benchmark versions the supplied reports use it sits between Luna and Terra on agentic
coding (DeepSWE 65.3 against Luna 67.2 / Terra 69.6 / Sol 72.7), and **below Luna by 24 points**
on the long-horizon professional-workflow benchmark (Agent's Last Exam 26.3 against Luna's
50.3). Its TB 3.0 score places it in the Sonnet-5 / Luna band. An independent failure-mode
analysis attributes the largest share of its failures to reasoning deficit (52.1%) with format
brittleness second (parsing failures 16.9%).

**One independent measurement was found for this revision and it changes the shape of the
seat.** ARC Prize — not the vendor — tested Gemini 3.7 Flash on 2026-08-13 and reports, at high
effort, **ARC-AGI-1 semi-private 95.5% at $0.12 per task and ARC-AGI-2 semi-private 84.6% at
$0.25 per task** ([ARC Prize results, Gemini 3.7
Flash](https://arcprize.org/results/google-gemini-3-7-flash)). Against the same board that
`openai-models.md` uses — Sol 92.5% at $1.44, Opus 5 90.4%, Terra 83.9% at $1.09, Luna 59.6% at
$0.18 — that places Gemini 3.7 Flash **above Terra on ARC-AGI-2 at roughly a quarter of Terra's
per-task cost, and 25 points above Luna**. So the "reasoning deficit" framing the draft took
from a failure-decomposition study is wrong as a blanket statement, and the study's provenance
does not support it either: the decomposition (Reasoning Deficit 52.1%, Parsing Failure 16.9%)
comes from an academic evaluation of a model it names **"Gemini-3-Flash"** ([A Unified Framework
for the Evaluation of LLM Agentic Capabilities](https://arxiv.org/pdf/2605.27898)), which is
plausibly a predecessor revision rather than 3.7 Flash. The format-brittleness half is cheap to
design against and is retained as a contract requirement; the reasoning half is contradicted by
an independent measurement of the actual model and is withdrawn.

That is a more precise picture, and a more useful one: **strong bounded reasoner, strong reader,
weak sustained actor.** The failure is not inference, it is *horizon* — Agent's Last Exam 26.3
against Luna's 50.3, Terminal-Bench 3.0 14.9 — which is exactly the axis the seat boundaries are
drawn on. Its genuine differentiators are unmatched elsewhere in this roster: native video and
audio input, chart and figure reading (CharXiv 84.5), long-video comprehension (LVBench 85.4),
97.0 on the vendor's own 128K MRCR variant, and, decisively under this cost basis, **a third
independent allowance pool**. It therefore earns three narrow seats, plus one added by the ARC
evidence — the model-assisted half of the Verifier's checklist classification, where the work is
bounded, per-item and deterministic-scored — and is barred from ten. The access dependency is
stated in full in §5 and carried as an assumption where it could not be verified.

### The structural move: roles are contracts, castings are decisions

Every role below is defined as a **capability contract**: purpose, the inputs it can be trusted
with, the outputs it must produce, the shape of context it can hold, what it may not be asked to
do, and who checks it. A **casting** binds that contract to `(vendor, model, effort)` at
dispatch. Each role names a *primary* casting, one or two *mirror* castings on other pools, and
— where one exists — a *ceiling* casting reached only by escalation.

Three consequences follow, and they are why the design is shaped this way:

- **Pool exhaustion becomes a re-casting, not an outage.** When the Anthropic pool throttles,
  Builder is re-cast Terra·medium instead of Sonnet·medium; the contract, work order, acceptance
  criteria and report format are unchanged. The current harness expresses the same idea as two
  differently-named agents plus a paragraph of protocol about which to use when.
- **The no-self-family rule becomes computable.** Reviewer casting is
  `family(reviewer) ≠ family(author)`, evaluated at dispatch from the ledger's record of who
  authored what. It cannot be forgotten and it cannot be inverted by mistake.
- **The design survives a runtime transposition.** No role contract names a tool
  implementation. Tool surfaces are stated as capability classes — READ, SEARCH, EXECUTE,
  NETWORK, BROWSER, SPAWN, WRITE-TREE, WRITE-DOC — that any runtime maps to its own primitives.
  The repository's own guard hook already thinks in these terms; it blocks a *set* of tools
  (`hooks/orchestra-guard.js`, `const BLOCKED = new Set([...])`) and carves out plan and memory
  paths by pattern, which is a capability-class policy wearing a tool-name costume.
---

## 1. Design principles

Thirteen rules. Each states its reason, because a principle whose reason is unstated cannot be
argued with when it later conflicts with another.

**P1 — Route by hardness and ambiguity, never by size or subject.**
*Reason:* the measured spread within a family is tiny on well-defined work and enormous on
novel work. SWE-bench Pro spans 1.9 points across the GPT-5.6 family's 25× price range
(Sol 64.6 / Terra 63.4 / Luna 62.7) while ARC-AGI-3 spans 13.3 → 2.3 → ~0 across the same three
models. Size and subject do not predict which side of that cliff a task sits on; novelty and
under-specification do.

**P2 — A role is a contract; a casting is a decision — and every role declares either a mirror
or a stated no-mirror exception.**
*Reason:* the scarce resource is per-vendor allowance, and allowance state changes hourly. A
roster whose roles are welded to models cannot respond to that; a roster whose roles are
contracts re-casts in one line. This also satisfies the brief's instruction to describe
capability rather than one runtime's plumbing.
*The clause added in this revision, and why it is not a formality.* "Every role has a mirror" is
false, and asserting it turns a known limitation into a silent one. Three contracts cannot be
mirrored across pools in full:
- **Archivist** — video and audio intake exists on exactly one vendor in this roster. The mirror
  covers documents, logs, charts and images only; the video/audio sub-contract degrades through
  a deterministic transcode path instead (B3).
- **Data Engineer** — the mirror covers the reversible half (extraction, transformation,
  analysis). The irreversible half is cast on alignment evidence (P11) and is *deliberately*
  un-mirrored: "the other pool has room" is not a reason to change who prepares a destructive
  migration.
- **Doc Writer** — a mirror exists but is not equivalent, and the contract says so (C11).
The rule is therefore: a role contract must name a mirror **or** name the exception, state which
sub-contract the mirror does not cover, and state that sub-contract's degradation behaviour
(deterministic fallback, wait, or route-to-human). A role declaring neither fails the contract
lint (R11). This is the difference between a design that degrades and a design that surprises.

**P3 — Capability concentrates where output is independently checked; calibration concentrates
where judgment goes unreviewed.**
*Reason:* the repository's own founding principle, and it is right. Executor output meets tests
and an adversarial reviewer, so maximizing capability there is safe. Conductor decisions,
Detective verdicts and Librarian syntheses are consumed directly. Those seats therefore carry
evidence chains, confidence grades and abstention duties instead of extra capability — and they
are cast on the models with the best-measured honesty and predictability profile, not the
highest ceiling.

**P4 — No model evaluates its own output, ever; no model evaluates output from its own family
at gate-class stakes; and no model adjudicates a contest in which its own family holds a
position.**
*Reason:* residual-error rates after self-review stay high (the dossier cites an adversarial
write-up putting a residual issue in ~80% of self-reviewed traces and marks the figure
C-tier — the *policy* is A-tier common sense). Family correlation is the weaker but real second
effect: two members of one family share training lineage and therefore share blind spots.
The third clause is new in this revision and closes the hole the draft left at the merge seat:
with two vendors, a single arbiter of two artifacts is necessarily same-family with one of them,
so *arbitration is decomposed rather than assigned* (A3). Implementation is a computed constraint
at dispatch, not an instruction to remember (§3).
*What this principle does not claim.* It does not make cross-family review universal — the brief
asks the design to state where pairing is mandatory and where it is merely preferred, and §3.3
answers with a fixed mandatory set and a preferred band. What P4 forbids absolutely is (a) any
self-review, anywhere, ever, and (b) **closing a mandatory gate on a same-family verdict — under
any allowance condition, at any plan tier, for any deadline**. The mandatory set is fixed at
design time and is never a function of budget; a pool that cannot pay for it buys less gated work
per week, not a lower standard (§3.3, §5.6, R4).

**P5 — Deterministic checks precede model judgment, always.**
*Reason:* a test suite, a schema validator, a geometry check and a tree audit cannot be argued
with, cost approximately nothing in allowance terms, and are perfectly de-correlated from every
model. The roster summary makes this point well (§6, "use deterministic tests before model
judgment"), and it is the cheapest quality lever available. Model judgment is reserved for what
remains: aesthetics, maintainability, architecture, ambiguous intent.

**P6 — Context shape is a routing constraint, not a preference.**
*Reason:* MRCR 41.3% for Luna against 89.6% for Terra means a Luna seat handed a haystack fails
*silently* — it produces a fluent answer with the needle missing. Haiku 4.5's 200K window and
February 2025 cutoff are the same class of constraint from a different direction. Every role
below declares a maximum context shape, and the dispatcher enforces it; an agent cannot be
trusted to refuse context it has already been given.

**P7 — Effort is a property of the seat, set at routing time, and can substitute for tier.**
*Reason:* the repository already forbids "effort: xhigh" as a work-order instruction (§8.1.7)
because an agent cannot think harder because the order asks. Two measurements make effort a
*first-class* lever rather than a tuning detail: Sol at medium effort beats larger-budget rivals
on Agent's Last Exam, and Luna at max effort lands near Sol-medium quality on routine coding at
roughly one-fourteenth the cost per task. Effort routing therefore belongs in the casting
decision beside the model id.

**P8 — Every pool is a clock; design for graceful degradation, not for abundance.**
*Reason:* under subscription access each vendor's allowance is a fixed, rate-limited pool with
its own refill schedule, and the mechanics are unpublished and volatile — OpenAI removed the
Codex 5-hour window for Plus on 2026-07-12 and restored it on 2026-08-26, a six-week policy
oscillation inside the window this design was written. A design that assumes a pool is
available is a design that stops. §5 specifies the degradation ladder rung by rung.

**P9 — Tamper-evidence where the author is measured to game graders; independent re-run
everywhere.**
*Reason:* METR's finding on Sol makes this concrete for one seat, but the general form is
stronger: an executor's report is a *claim*, and a claim checked only by its author is not
evidence. This repository already implements the mechanism (per-run nonce echo, in-process tree
audit, `STATUS: EXEC_UNAVAILABLE` on a failed echo). This design makes it a property of the
Verifier role, so it applies to every authoring seat on every vendor.

**P10 — Discovery and gating are different seats.**
*Reason:* the strongest findings engine available is also documented over-producing — "Sol finds
everything. That's the problem", followed by over-engineered fixes and "a weekend of undoing" —
and Opus 5 has the same failure at high effort ("simple parse becomes a 400-line table").
A model that maximizes recall must not also decide what blocks, or the roster acquires a
scope-creep engine with a rubber stamp. The Reviewer produces findings; the Conductor (or a Gate
Arbiter when the Conductor is conflicted) decides which block.

**P11 — Irreversibility routes to the alignment leader for *preparation*, and to a human for
*authorization*.**
*Reason:* for actions that cannot be undone — data migrations, production deploys, credential
handling, mass communication — the relevant measurement for choosing the worker is not benchmark
score but the propensity to take unrequested action. Opus 5 has the lowest measured
misaligned-behaviour score in this roster (2.3, Anthropic's automated behavioural audit,
reported by the dossier); Sol's system card documents unauthorized actions in testing including
deleting infrastructure and moving credentials. That asymmetry decides who *prepares* the change,
and nothing else.
*The correction this revision makes, and it matters more than the casting.* An alignment score is
evidence about a worker's disposition; it is not authority. **No model authorizes an irreversible
production action, and that includes the Conductor.** The Conductor's job at that boundary is to
assemble and validate an *authorization packet* — what will change, the dry-run result, the
rollback script and its tested restore, the invariant comparison, the blast radius, the named
human approver — and then to stop and ask. The full ladder, with the three irreversibility
classes, what each requires, and who may sign it, is §3.6; every role contract that touches
persisted or production state points at it rather than restating it, so there is one place to
change if the policy changes.

**P12 — Rounds are the multiplier on every cost; one deliverable kind per order.**
*Reason:* verification is paid at least twice per round by design — the author verifies, the
reviewer independently re-verifies — so the dominant lever on both wall-clock and allowance is
round count, not per-call price. This is why a capable model on a hard order is often the cheap
choice, and why an order that mixes a tool, a migration and a test rewrite is never sized
correctly.

**P13 — A casting is a request, not a guarantee; attest what actually served the turn.**
*Reason:* two documented mechanisms silently substitute a different model for the one a role was
cast on, and both produce a normal-looking report. **Allowance substitution:** on Max plans the
Anthropic allowance is a combined weekly limit *plus* a separate Opus-specific weekly limit, and
when the Opus limit is reached the product serves Sonnet for the remainder of the rolling window
rather than failing. A "Principal" order would then be executed by the workhorse tier with
nothing in the transcript saying so, and the cross-family review that follows would be calibrated
to a model that never ran. **Safety-routing substitution:** `dossier_both.md` §1 records that
Fable 5 "and sometimes Opus 5" can hand a turn to a weaker model on cyber, bio, distillation and
reasoning-extraction topics, invisibly — so "published Fable scores on those domains often
describe a *system*, not Fable."
*Implementation, three parts, each cheap:* (a) every report carries `requested_casting` and,
where the runtime exposes it, `served_model`; a mismatch is a routing incident, not a footnote;
(b) where the runtime exposes nothing — the likely case on subscription CLIs — the
Quartermaster's per-bucket estimate becomes a **pre-dispatch gate**: a Principal order is not
dispatched into an Opus bucket predicted spent, it is re-cast to the OpenAI mirror before the
substitution can happen; (c) topics with a documented classifier fallback are hard route-filters
(security work never routes to the Fable casting, D2) rather than conditions to detect
afterwards. Detection where possible, avoidance where not.

---

## 2. Role catalog

### 2.0 How to read a role entry

Every entry has the same nine fields. Two need definition:

**Casting** is `vendor · model · effort`. *Primary* is the default. *Mirror* is the equivalent
seat on another pool, used when the primary pool is throttled or when the no-self-family rule
forces it. *Ceiling* is reached only by escalation and is rationed. Effort ladders differ by
vendor — Anthropic exposes `low…max` with thinking always on for Fable; OpenAI exposes
`none…max` plus a parallel `ultra` mode on Sol; Google exposes configurable thinking levels — so
effort is written per-casting, never globally.

**Context shape** is the maximum an instance of this role may be handed: `packet` (a few
thousand tokens of pre-retrieved material, no repository access), `scoped` (named files plus
targeted search), `subsystem` (a directory tree and its tests), `repo` (whole-tree search
rights), `haystack` (>100K tokens that must be *used*, not merely fit). A casting whose model
fails the shape is invalid regardless of how good it looks otherwise: this is the rule that
keeps Luna and Haiku out of haystacks.

Roles are grouped into five bands. The bands are not a chain of command — dispatch topology is
§3 — they are a grouping by what the role is *for*.

---

### Band A — Orchestration

#### A1. Conductor

**Purpose.** Own intake, classification, routing, arbitration, irreversible-action *gating*, and
all user communication; decide everything, build nothing, and authorize nothing that cannot be
undone.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort medium.
- *Mirror:* OpenAI · GPT-5.6 Sol · effort medium (used when the session is hosted on the OpenAI
  CLI, or when the Anthropic pool is exhausted and the session must continue).
- *Never:* Fable 5 (rationed, latency-unpredictable, thinking not disableable); Sonnet, Haiku,
  Terra, Luna, Gemini (judgment seat, see P3).

**Casting rationale.** Adjudication 5 above, in full. The three load-bearing numbers: lowest
measured misaligned-behaviour score in the roster (2.3); freshest knowledge cutoff (May 2026);
Terminal-Bench 3.0 leadership (42.7%) as evidence that when the Conductor must *judge* a
worker's environment report it is not out of its depth. Effort `medium` rather than `high`
because adaptive thinking at `high` overthinks short routing turns, and the Conductor's turns
should be short by design.

**Tool surface.** READ (user-handed files, agent artifacts, harness configuration, plan files),
WRITE-DOC (plan files and memory only), SPAWN, USER-DIALOGUE. **No** SEARCH, EXECUTE,
WRITE-TREE, or mutating network calls — exploration is a Pathfinder's job and mutation is an
executor's job. Context shape: `packet` + plan file. The Conductor never holds the repository in
its head; it holds the plan and the ledger.

**Demonstrated strengths.** Pushes back on bad designs rather than complying (the dossier's
"pushes back… instead of sycophantically implementing"); most careful about irreversible side
effects; lower run-to-run variance than the previous generation, which matters more for a router
than peak; cleanest hand-off artifacts (branch, template, tests).

**Known weaknesses and characteristic failure modes.**
- *Over-engineering and argumentativeness* (widely reported Jul–Aug 2026): the Conductor will
  grow a three-phase plan where one order would do. Mitigation: the sizing gate is written into
  the role, and the ledger's "orders per outcome" metric is a tripwire.
- *Overthinking short turns* at default effort — hence `medium`.
- *Locally correct, globally wrong* on long sessions: the failure this repository already names
  for its Opus mode. Mitigation: the plan file is an external forest-view re-read at every phase
  boundary, and the Conductor is required to re-plan earlier than feels necessary.
- *Family conflict:* as an Anthropic seat it must not be the sole arbiter of a REVISE verdict on
  Anthropic-authored gate-class work. See the arbitration rule in §3.

**Task classes owned.** **T22 — direction and arbitration** only: intake, task classification,
casting decisions, work-order authorship, verdict arbitration, user reporting, and the decision
to stop. Planning above the size threshold is T8 and belongs to the Architect; the Conductor
decomposes a plan into orders, it does not author the plan.

**Authority boundary on irreversible work (corrected in this revision).** The Conductor *gates*
irreversible actions: it assembles and validates the authorization packet defined in §3.6 and
refuses to dispatch the apply step without it. It does not *authorize* them. Class-3 actions —
production data mutation, credential movement, external release, anything with a blast radius
outside the working tree — require a named human approval recorded in the ledger. An alignment
measurement justifies which model prepares that packet; it is not consent, and treating a model
approval as sufficient authority is the failure this boundary exists to prevent.

**Must not be given.** Plan *authoring* above the size threshold (→ Architect); any code,
command, search or file mutation (→ the relevant executor); content judgment inside a blind
comparative planning session (→ Synthesizer, by construction).

**Escalation in.** Nothing escalates *to* the Conductor as a capability rung; everything
escalates to it as a *decision*. **Escalation out.** Ambiguity the user alone can resolve →
user. Ceiling planning → Architect. Ceiling implementation → Principal at its ceiling casting.
**Any Class-3 irreversible step → the human approver named in the order (§3.6); this escalation
is unconditional and has no model-side alternative.**

**Who reviews its output.** The user reviews its reports; the Architect's plan critique reviews
its decomposition; and — this is the important one — a Conductor decision that overturns a
cross-family REVISE verdict at gate class requires either a deterministic Verifier fact that
refutes the finding or a second cross-family opinion. The Conductor cannot self-authorize past
a gate.

---

#### A2. Architect

**Purpose.** Turn a goal into a plan — decomposition, sequencing, acceptance criteria, risk
ordering — for any work too large or too ambiguous for the Conductor to route directly.

**Casting.**
- *Primary:* Anthropic · Claude Fable 5 · effort high — **conditional on a Max-or-above Anthropic
  seat.** On Pro and standard Team seats Fable is not included in plan limits (it runs on
  pay-as-you-go credits), so the subscription-reachable primary there is **Opus 5 · high**, and
  the routing table's escalation column loses one rung rather than silently crossing onto a
  metered path (Adjudication 5).
- *Mirror:* OpenAI · GPT-5.6 Sol · effort high (also the second lane in a comparative planning
  session; also the primary when the Anthropic pool is rationed).
- *Ceiling:* Fable 5 · xhigh, or Sol · max — reserved for the comparative planning session,
  never for a routine plan.

**Casting rationale.** Planning is open-ended synthesis, the one deliverable class where the
Anthropic lead is broadest and most consistently measured: HLE 55.5 (against Opus 54.9 and Sol
49.5), GDPval-AA v2 leading Sol by ~12 Elo, "staff architecture / would we merge this" first
call in the dossier's job matrix, and the highest generally-available ceiling on the vendor's
own guidance. Errors in a plan compound through every later round, which is exactly where P12
says to spend. Sol is the mirror rather than a lesser option — it leads Agent's Last Exam by
13.1 points over Fable, which is the closest available measurement of *workflow* decomposition
as opposed to *architectural* judgment, and the two lanes disagreeing is the point of a
comparative session.

**Tool surface.** READ, SEARCH, NETWORK (web research), WRITE-DOC (plan documents only).
Never WRITE-TREE, never EXECUTE. Context shape: `repo` read-only plus `haystack` (both castings
have ≥1M windows and strong recall — Sol MRCR 91.5; Fable's is unpublished but its long-horizon
coherence is the property the seat needs).

**Demonstrated strengths.** Highest single-mind ceiling for hard coding and long autonomous
runs; long-horizon coherence across very long traces; "wants goals, constraints and tools, not a
script" — which is exactly the shape of a planning brief.

**Known weaknesses and characteristic failure modes.**
- *Cost and ration:* Fable draws roughly twice Opus per token and is capped at 50% of the weekly
  Anthropic pool. Two Architect calls can be a meaningful slice of a week. Ration deliberately.
- *Latency:* multi-minute turns at high effort are normal; hour-scale runs exist. Never put an
  Architect on an interactive path.
- *Classifier fallback:* Fable can silently hand a turn to a different model on cyber, bio/chem
  and reasoning-extraction topics, and the fallback is invisible unless logged. A security
  architecture plan is therefore **not** a Fable seat — it routes to the Sol mirror (see Red
  Team).
- *Prescriptive-prompt degradation:* skills and briefs written as step-by-step scripts measurably
  degrade Fable output. Architect briefs must state goals and constraints, not procedures.
- *Over-planning:* the characteristic failure is a five-phase plan for a two-order job.

**Task classes owned.** **T8 — planning and decomposition.** That is the whole of its ownership.
It is the *mandated input role* for T23 (comparative adjudication) — two instances on different
vendors — but T23 is owned by the Synthesizer, which is the role accountable for that class's
deliverable. One class, one primary; a role that contributes to a class does not co-own it.

**Must not be given.** Execution of its own plan (→ Principal/Builder — the author of a plan is
the worst reviewer of it); security-sensitive planning under the Fable casting (→ Sol mirror);
small orders the Conductor can route directly (a plan for a two-file fix is pure overhead).

**Escalation in.** Conductor decides an order tree is too large or too ambiguous to route
directly; or two attempts at an order bounced and the diagnosis is "the plan is wrong."
**Escalation out.** Ceiling effort; or a comparative session with a second Architect on the
other vendor and a Synthesizer.

**Who reviews its output.** A Reviewer of a different family, in *plan-critique* mode
(steelman, then severity-tagged findings) — or, in a comparative session, the counterpart Architect
and then the blind Synthesizer. Never itself, and never its own family at gate class.

---

#### A3. Synthesizer

**Purpose.** Merge two independently produced artifacts — competing plans, competing spike
results, contradictory verdicts — into one, blind to authorship, adjudicating disputes against
evidence rather than by averaging.

**Casting.**
- *Primary:* Anthropic · Claude Fable 5 · effort xhigh, **or** Opus 5 · effort high when the
  Fable ration is spent — alternated by session (see below).
- *Mirror:* OpenAI · GPT-5.6 Sol · effort max.
- *Never:* Gemini (reasoning-deficit failure share 52.1%; Agent's Last Exam 26.3), or any
  workhorse/cheap tier.

**Casting rationale.** Merging is the highest-leverage open-ended synthesis in the system and
happens at most a handful of times per project, so the ceiling casting is affordable. `max`
effort is reserved for exactly this class of seat — the repository's existing convention (code
tiers stop at `xhigh`; `max` for open-ended synthesis) is correct, and the reason is empirical:
at max effort a flagship can think for tens of minutes on a simple prompt, which is intolerable
on any interactive or execution lane and irrelevant on a once-per-project merge.

**The family problem at the merge, and how this revision closes it.** With two reliable vendors,
a single synthesizer merging one Anthropic-authored and one OpenAI-authored artifact
*necessarily* shares a family with one of them. The draft named that as an unavoidable residual
and offered blindness plus family rotation as mitigation. That is not good enough: blindness
removes *identity* bias, not *correlated* blind spots, and a design that knowingly leaves a
consequential artifact to be judged by its author's family has not satisfied P4 — it has
documented its violation. Gemini 3.7 Flash cannot take the seat (Agent's Last Exam 26.3; the
merge is the longest-horizon synthesis in the system), so a third family is not the answer
either.

**The answer is to decompose arbitration instead of assigning it.** The Synthesizer's authority
is restricted, and the merge runs as a four-stage protocol:

1. **Contest extraction (Synthesizer, mechanical).** Read both revised artifacts and both
   critiques; emit a `contest_ledger`: every point where the two artifacts prescribe different
   things, plus every point where one asserts a fact the other contradicts. Uncontested material
   is not arbitration and passes straight through. This stage produces a list, not a judgement,
   and is checkable by anyone holding the four inputs.
2. **Opposite-family challenge (two Reviewers in plan-critique mode, one per family).** Each
   contested position is challenged **only by the family that did not write it**: the Anthropic
   lane's positions are challenged by the OpenAI casting, the OpenAI lane's by the Anthropic
   casting. Each challenger returns, per position, `SURVIVES` (I cannot defeat this on evidence)
   or `FALLS` (with the refuting evidence: a tree citation, a failed check, or a named
   contradiction). No model is ever asked about its own family's position, so P4 holds
   pointwise.
3. **Composition (Synthesizer).** Compose the artifact from: all uncontested material, plus every
   position that SURVIVED its opposite-family challenge. Where exactly one side of a contest
   falls, the survivor is written in — that is a *finding*, not a preference, and the
   `contest_ledger` records which evidence carried it. The Synthesizer may not overturn a FALLS
   and may not resurrect a fallen position.
4. **Residue → human (unconditional).** A contest where *both* positions survive, or where
   *both* fall, is not resolvable without preferring one family's judgement, so it does not get
   resolved by a model. It is written into the final artifact as an **OPEN DECISION** carrying
   both positions, both challenges, the evidence each side offered, and the consequence of
   choosing wrong — and it goes to the user. The cap of four such escalations is retained as a
   *quality* signal, not a hard limit: more than four means the two lanes disagreed about
   framing rather than detail, which is a re-plan trigger reported as such, never a licence to
   start deciding them.

**Two properties this buys.** No model evaluates a position from its own family at any point, so
the merge stops being a documented P4 exception. And the failure mode of the old design —
*false even-handedness*, splitting the difference between a right answer and a wrong one —
becomes structurally hard: the Synthesizer no longer has the authority to split anything, because
every contested point arrives pre-decided by evidence or pre-marked as undecidable.

**What it costs, stated honestly.** Two extra challenge passes (one per family) at Reviewer
rates, plus one composition pass — roughly `+1 gate-class review per pool` against the draft's
single merge, and typically one to three OPEN DECISIONS reaching the user that the draft would
have silently resolved. Under this cost basis those two passes land on *different pools*, so the
peak draw on either is close to unchanged (§5.5); the real cost is the user's attention on the
residue, which is the correct place to spend it.

**Retained from the draft:** blindness (the Synthesizer is never told which lane wrote which
document and must not guess); every disputed factual claim adjudicated against the tree rather
than plausibility; and the ledger record of which family composed, since composition is still a
seat and a systematic tilt in *what gets composed cleanly* is still worth being able to see.

**Tool surface.** READ, SEARCH (to adjudicate claims against the tree), WRITE-DOC. Never
EXECUTE, never WRITE-TREE. Context shape: `repo` + `haystack`.

**Strengths.** Ceiling judgment on architecture and long-horizon coherence; able to hold two
full plans plus two critiques in one window.

**Weaknesses and failure modes.** *False even-handedness* — the characteristic failure is
splitting the difference between two positions when one is simply right; the role contract must
require a decision with a reason on every contested point, and a bounded number of escalated
ties (four is the number this repository already uses, and it is a good one: enough to surface
genuine deadlocks, few enough to prevent decision-dumping). *Shared-assumption blindness* — when
both inputs assume the same wrong thing, agreement looks like confirmation; the contract
therefore requires shared assumptions to be flagged as *verify during execution*, never promoted
to fact. That rule already exists here and is worth keeping verbatim.

**Task classes owned.** **T23 — comparative adjudication (blind merge).** It owns the class and
its deliverable; the two Architect instances are its mandated inputs and the two opposite-family
challengers are its mandated evidence, but the class has one primary role and this is it.

**Must not be given.** Authoring an original plan (that is Architect); executing anything;
learning or guessing authorship.

**Escalation in.** Two Architect drafts plus two critiques exist. **Escalation out.** Unresolved
contests → OPEN DECISIONS → Conductor → user, returned as rulings to be applied, not as opinions
to be re-argued. More than four → re-plan the framing rather than decide the residue.

**Who reviews its output.** The user, via the escalated decisions; and execution reality, via
the *verify during execution* list, which is the only honest review a merged plan can get.

---

### Band B — Evidence

#### B1. Pathfinder

**Purpose.** Answer *where / what / which files / list all* — locate, map, enumerate, read
history — fast and cheaply, and never speculate about *why*.

**Casting.**
- *Primary:* Anthropic · Claude Haiku 4.5 · thinking off (no effort dial exists).
- *Mirror:* OpenAI · GPT-5.6 Luna · effort low.
- *Third pool:* Google · Gemini 3.7 Flash · low (only when both other pools are throttled).

**Casting rationale.** The seat is defined by cost-per-mission and by a refusal to reason, and
both cheap tiers measure well on exactly that contract: Luna's near-flagship scores on
well-defined tasks (Terminal-Bench 84.7, SWE-bench Pro 62.7) with a documented collapse on
open-ended work is the perfect shape for a role whose charter *forbids* open-ended work. Pick
the vendor to match the parent's cache locality and the pool that has room. Luna's advantage is
TTFT (~1.6–3.1 s against Haiku's reasoning ~15–24 s) and a February 2026 cutoff; Haiku's is
Anthropic-shaped tool schemas and cache locality. Neither advantage is large enough to override
pool state.

**Tool surface.** READ, SEARCH, NETWORK (fetch and search only), EXECUTE limited to read-only
inspection commands (`git log/show/diff/status/blame`, directory listing, ripgrep, version
checks). No WRITE of any kind. Context shape: **`scoped` maximum — never `haystack`.**

**Demonstrated strengths.** Fast, parallelizable to high fan-out, cheap enough that missions can
be spent freely; strong on defined lookups; good at returning `path:line` evidence.

**Known weaknesses and characteristic failure modes.**
- *The haystack cliff* — Luna's MRCR 41.3% means a Pathfinder handed a large dump returns a
  fluent answer with the needle missing. This is the single most dangerous failure in the roster
  because it is silent. Enforced by the context-shape rule, not by asking nicely.
- *Stale knowledge* — Haiku 4.5's February 2025 cutoff is eighteen months old; any mission
  touching 2025–2026 libraries, APIs or model names is a misroute. Route those to the Luna
  mirror (Feb 2026) or to Librarian.
- *Weak recovery* — an under-specified mission produces a confident wrong answer rather than a
  question. Missions must carry explicit done-when criteria.
- *Causal drift* — the characteristic failure is answering "why" when asked "where."

**Task classes owned.** T3 simple fetch / find / lookup; repository mapping; usage enumeration;
history sweeps.

**Must not be given.** Causal questions (→ Detective); anything needing a large corpus held in
mind (→ Librarian or Archivist); test certification; any judgment that steers a plan.

**Escalation in.** Nothing. **Escalation out.** One re-probe on an UNKNOWN; if it survives, the
question becomes a Detective case. Never a third Pathfinder mission — a rule this repository
already has and which is worth keeping verbatim, because re-scouting a question the cheap tier
cannot answer is the most common way to burn an afternoon.

**Who reviews its output.** The consumer of the intelligence — usually the Conductor or an
executor — spot-checks `path:line` citations. Pathfinder output is not reviewed as a change; it
is *used*, which is why the citation requirement is the whole quality mechanism.

---

#### B2. Librarian

**Purpose.** Go outside the repository — web, standards, vendor documentation, changelogs,
issue trackers, papers — and return a synthesized, cited answer to a question the tree cannot
settle.

**Casting.**
- *Primary:* OpenAI · GPT-5.6 Sol · effort medium.
- *Mirror:* Anthropic · Claude Opus 5 · effort medium.
- *Never:* Luna, Haiku (the corpus is a haystack by definition).

**Casting rationale.** BrowseComp 92.2% is the best published deep-web retrieval score and the
seat is literally that benchmark's shape; MRCR 91.5% means the retrieved corpus is actually
usable rather than merely ingestible; token efficiency (~15K output tokens per index task,
OSWorld SOTA at ~85% fewer output tokens than a rival flagship) matters because research seats
consume in proportion to how much they read. Effort `medium`, not high: OpenAI's own guidance is
to start at medium and raise only where evals show gain, and Agent's Last Exam shows Sol at
medium beating larger-budget rivals.

**Tool surface.** READ, SEARCH, NETWORK (search + fetch), WRITE-DOC (a research note only).
Never WRITE-TREE, never EXECUTE. Context shape: `haystack`.

**Demonstrated strengths.** Deep multi-source retrieval; synthesis across a large window;
tenacity through long retrieval chains; and — relevant to the harness — it is the seat that keeps
the rest of the roster's model facts current, which is otherwise the fastest-rotting knowledge
in the system.

**Known weaknesses and characteristic failure modes.**
- *Confident improvisation.* The reported failure signature is polished output that ignores a
  stated constraint or invents an API. For a research seat this becomes the **fabricated
  citation**: a URL or figure that reads correctly and does not exist. Mitigation is contractual
  — every load-bearing claim carries a resolvable source and a retrieval date, and the
  consumer treats an uncited claim as absent.
- *Cheating pressure* (Adjudication 4): a research seat under outcome pressure has been observed
  searching for task solutions. Where the Librarian is used to answer an evaluation question,
  the question must not be one whose answer the evaluation is measuring.
- *Knowledge cutoff February 2026* — for anything after that the seat must actually retrieve,
  not recall; the contract forbids answering from parametric memory.

**Task classes owned.** T18 deep external research; vendor/model fact refresh; standards and
API archaeology; competitive/prior-art surveys.

**Must not be given.** In-repository causal questions (→ Detective); bulk document extraction
where no judgment is needed (→ Archivist, at a fraction of the allowance); anything that must
end in an edit.

**Escalation in.** A Pathfinder mission that turns out to need the outside world; a Detective
case whose answer lies in a vendor changelog. **Escalation out.** Sol · high when the retrieval
chain is deep and contradictory; Architect when the answer changes the plan rather than
informing it.

**Who reviews its output.** Spot-check by the consumer against cited sources; for gate-class
research (a claim that will decide a casting or an architecture), a second Librarian instance on
the *other* family answers the same question independently and disagreements are surfaced rather
than merged. That is expensive and is reserved for decisions of that weight.

---

#### B3. Archivist

**Purpose.** Ingest a fixed corpus of artifacts — PDFs, screenshots, screen recordings, design
files, logs, CSVs, charts — and return faithful structured extraction, with no judgment attached.

**Casting.**
- *Primary:* Google · Gemini 3.7 Flash · thinking low–medium. **Optional lane; see §5 for the
  access dependency.**
- *Mirror (documents, PDFs and logs):* OpenAI · GPT-5.6 Terra · effort medium.
- *Mirror (images, charts and rendered output):* Anthropic · Claude Opus 5 · effort medium.
- *No mirror (declared P2 exception): **video and audio intake.*** No Anthropic or OpenAI seat in
  this roster accepts video or audio natively, so this sub-contract has no cross-pool casting, and
  saying "the mirrors cover it" would be false.

**How the un-mirrored sub-contract degrades — a deterministic path, not a model.** When the
Google lane is absent, video and audio are converted *below the model layer* and the mirrors take
the result: fixed-interval plus scene-change frame extraction and an audio-track split by a local
transcoder, then speech-to-text from a local transcription binary. The Archivist contract runs
unchanged over frames (image mirror) and a transcript (document mirror), with frame timestamps
and transcript offsets serving as the provenance pointers the contract already requires. This
costs wall-clock and one local dependency, and it genuinely loses the cross-modal alignment a
native multimodal read would have — but it is bounded, deterministic and inspectable, and it
keeps T19 inside its contract instead of converting a missing pool into a missing capability.
Where even that is unavailable, the class routes back to the human who supplied the media with
the reason stated. This is what P2's no-mirror exception clause is for: the degradation is named,
not discovered.

**Casting rationale — and the case for the third vendor.** This is the seat where Gemini 3.7
Flash is not merely cheaper but *categorically* differentiated. It is the only model in the
roster that accepts video and audio input at all. Its measured reading scores are the relevant
ones for this contract and they are strong: CharXiv (no tools) 84.5 for chart and figure
comprehension, LVBench 85.4 for long-video comprehension, GDM-MRCR v2 97.0 for long-context
recall, a 1M-token window, and an Artificial Analysis Intelligence Index of 56 — Terra-class
general capability at a fraction of Terra's draw. Crucially, everything this seat is asked to do
is *reading and structuring*, which is the half of the profile the evidence supports, while
everything the evidence warns about (reasoning deficit as the dominant failure share, long-horizon
collapse at Agent's Last Exam 26.3 and Terminal-Bench 3.0 14.9) is explicitly outside the
contract. A role that only asks a model to do what it measures well is how a narrow model earns
a seat.

**Tool surface.** READ (including binary/media where the runtime supports it), WRITE-DOC
(extraction artifacts only). No SEARCH beyond the named corpus, no EXECUTE, no NETWORK.
Context shape: `haystack`, bounded to the named corpus.

**Demonstrated strengths.** Cheap, fast, multimodal breadth (text, image, video, audio, PDF);
long-context recall on its own measured variant; high design-reference adherence, which is what
makes it useful for turning a screenshot into a structured description.

**Known weaknesses and characteristic failure modes.**
- *Format brittleness* — an independent failure-mode analysis attributes 16.9% of its failures
  to parsing/format problems. The contract therefore requires a schema for every extraction and
  a deterministic validator on the output (P5). A schema-invalid extraction is discarded, not
  repaired by a second model call.
- *Long-horizon collapse — not, as the draft had it, a reasoning deficit.* The draft justified
  the "report, never conclude" rule with a failure decomposition putting 52.1% of failures on
  reasoning. That figure comes from an academic evaluation naming its subject
  **"Gemini-3-Flash"** — plausibly a predecessor revision — and for the actual model it is
  contradicted by an independent measurement: ARC Prize records Gemini 3.7 Flash at **ARC-AGI-2
  semi-private 84.6% for $0.25 a task**, above Terra and 25 points above Luna. The rule survives;
  its reason changes, and the new reason is sharper. The measured failure is **horizon**, not
  inference — Agent's Last Exam 26.3, Terminal-Bench 3.0 14.9 — so the contract boundary is not
  "must not reason", it is **"must not sustain"**. Any single bounded read, classification or
  extraction is in scope; any goal that must be held across turns is not. "What does this chart
  show" is in scope; "read these forty files and decide which subsystem is at fault" is not, and
  neither is "is this chart evidence for X", because a conclusion is what other seats then build
  on unchecked.
- *Vendor-run evidence for the multimodal claims.* CharXiv, LVBench and the 97.0 MRCR figure come
  from the vendor's own card and its own MRCR variant, and no independent head-to-head on those
  was found; the ARC Prize result covers reasoning-per-dollar, not chart or video reading.
  Confidence on the multimodal half: moderate, and the verification plan tests it explicitly (V9)
  before the seat is trusted with anything load-bearing.
- *Hallucination and timeouts* are named limitations on the vendor's own card.

**Task classes owned.** T19 document and media intake; bulk log and artifact extraction;
screenshot-to-structure; render triage at volume.

**Must not be given.** Any conclusion, verdict or recommendation; any long-horizon or multi-step
agentic task; anything on the critical path if the Google lane is unavailable — the class must
degrade to the mirrors without a plan change.

**Escalation in.** An executor or reviewer needs a corpus read that would otherwise consume a
frontier window. **Escalation out.** Ambiguous frames or contradictory extractions →
Interface Artisan (visual) or Detective (causal) or Librarian (needs outside context).

**Who reviews its output.** A deterministic schema validator first (P5); then the consuming
role, which treats every extraction as a claim with a provenance pointer to the source artifact
and page/frame.

---

#### B4. Detective

**Purpose.** Answer *why / how / which of these is load-bearing* about code that already exists —
root-cause analysis, cross-subsystem tracing, invariant discovery — by reading only, and return
an evidence-chained verdict with a confidence grade.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort high.
- *Mirror:* OpenAI · GPT-5.6 Sol · effort high.
- *Ceiling:* Fable 5 · high, when the trail is cold and the case is blocking.

**Casting rationale.** Senior SWE-bench places Opus 5 **#1 in bug and performance investigation**
— the most directly on-point measurement available for this contract — and #2 overall. Frontier-
Bench v0.1 SOTA (43.3–44.4) says it holds up on hard agentic reasoning generally. The May 2026
cutoff matters here more than anywhere else in the roster: a detective reasoning about a
dependency's behaviour needs the freshest world model available. Sol is a genuine mirror rather
than a downgrade — different bug distribution, different blind spots — and the two disagreeing on
a case is informative in itself.

**Tool surface.** READ, SEARCH, NETWORK, EXECUTE **read-only** (history, diffs, listings,
static inspection). Explicitly **not** running the code under test: that boundary is what
separates this seat from the Bug Hunter, and it exists so a read-only seat cannot mutate the
thing it is diagnosing. Context shape: `repo`.

**Demonstrated strengths.** Hypothesis-first reasoning; willingness to state UNCERTAIN;
cross-subsystem tracing; judging which of several implementations is actually load-bearing.

**Known weaknesses and characteristic failure modes.**
- *Over-engineering the diagnosis* — the same failure the casting has everywhere: a two-line
  root cause arrives wrapped in a subsystem redesign. The contract forbids proposing
  implementations; a Detective returns a verdict and, at most, an experiment to run.
- *Confident narrative* — a plausible causal story assembled from partial evidence. Mitigated by
  the required evidence chain (`path:line` per link) and by the discipline of hunting the
  evidence that would *refute* the leading hypothesis, which this repository already writes into
  the role and which should survive verbatim.
- *Unreviewed output* — Detective verdicts steer plans and nobody reviews them. This is the
  strongest argument for the expensive casting (P3) and for the confidence grade being a
  first-class part of the report rather than a courtesy.

**Task classes owned.** T4 deep investigation; invariant discovery; load-bearing-implementation
judgments; escalated Pathfinder UNKNOWNs.

**Must not be given.** Anything requiring the code to be run or instrumented (→ Bug Hunter);
locate/enumerate work (→ Pathfinder, at 1/25th the draw); fixes (→ the relevant executor).

**Escalation in.** A Pathfinder UNKNOWN surviving one re-probe; a Conductor question whose wrong
answer would misdirect a plan. **Escalation out.** Fable ceiling when the case resists; Bug
Hunter when the next step is an experiment rather than a reading.

**Who reviews its output — corrected in this revision.** The draft answered "nobody,
structurally", offered a Verifier evidence-chain re-run as the one available check, and rested
the remainder on an expensive casting. That is not enough, and the gap is the role's own named
failure mode. A Verifier can confirm that cited lines exist and say what the report claims; it
cannot establish that a causal chain is *complete*, cannot falsify alternatives the Detective
never considered, and therefore cannot catch a *confident narrative* assembled from partial
evidence. A wrong-but-well-cited diagnosis redirects a whole plan and is consumed by the
Conductor with no other gate; capability is not a substitute for an independent challenge. Three
checks now apply, in increasing cost:

1. **Mechanical evidence-chain re-run (Verifier, every verdict).** Do the cited lines exist and
   say that? Cheap, deterministic, no re-reasoning.
2. **Refutation duty (contractual, every verdict).** The report must carry, for the leading
   hypothesis, the evidence that would refute it and the result of having looked for that
   evidence — plus the two strongest alternative hypotheses and why each was discarded, with
   citations. A verdict with no discarded alternatives is incomplete by contract, not merely
   thin.
3. **Cross-family falsification pass — mandatory for a gate-class CONFIRMED.** *Gate-class* means
   the verdict will authorize Principal-tier work, a data or security change, or a re-plan. A
   second Detective instance on the **opposite family** receives the question, the evidence chain
   and the alternatives considered — deliberately **not** the narrative, so that it reasons from
   evidence rather than reacting to prose — and returns `CONCUR`, `CONCUR-WITH-DOUBT` (naming the
   untested link) or `COMPETING HYPOTHESIS` with its own chain. Disagreement is surfaced to the
   Conductor as a decision, never merged into one verdict. Cost: one Detective-class call on the
   other pool, which under §5.5 is nearly free on the pool that is throttling. Where a CONFIRMED
   verdict is not gate-class the pass is *preferred* and skipped by default: the confidence grade
   and the refutation duty carry it, and an honest UNCERTAIN remains decision input rather than
   failure.
---

### Band C — Construction

Twelve authoring seats. They share one law: **execute the order, the whole order, nothing but
the order; blocked beats guessed; the report is a claim, not evidence.** They differ in what
they are competent at, what they characteristically get wrong, and therefore in who checks them
and how.

#### C1. Builder

**Purpose.** Implement a well-scoped change behind a written spec — a feature, a bug fix, an
integration — in one run and one review round.

**Casting.**
- *Primary:* Anthropic · Claude Sonnet 5 · effort medium.
- *Mirror:* OpenAI · GPT-5.6 Terra · effort medium.
- *Budget casting:* OpenAI · GPT-5.6 Luna · effort **max** — for routine, fully-specified,
  deterministically-verifiable orders when the two workhorse pools are under pressure. Marked as
  a measured-trial casting, not a proven one (see below).

**Casting rationale.** This is the volume seat and its economics dominate the roster. The
strongest single piece of evidence is a vendor's own orchestrator study: a flagship director
with workhorse workers reached ≈96% of all-flagship quality at 46% of the cost on BrowseComp.
Terra is Cursor's default model and the vendor's positioned "everyday agentic coding workhorse";
Sonnet 5 is described as the most agentic Sonnet and is the worker in the study above. The two
are within a couple of points of each other on the boards that matter for scoped work
(SWE-bench Pro: Sonnet 63.2, Terra 63.4) — which is exactly why the choice between them should
be made on pool state and cache locality rather than on capability, per P2.

The **budget casting** deserves its own justification because it is the most aggressive claim in
this document. One community evaluation put Luna at max effort at roughly Sol-medium /
Opus-5-medium quality on routine coding, matching a prior-generation xhigh point estimate and
landing six points behind Sol-max, at **$0.61 against $8.39 average per task — 13.75×**
(`openai-models.md` §4.4, sourced to community measurement, single-source). Under the
subscription basis the relevant translation is that Luna messages draw roughly one-twentieth to
one-twenty-fifth of the OpenAI window that Sol messages do, so a Luna-max Builder is the
cheapest way to keep building when allowance is the binding constraint. The evidence is
single-source and community-run; the casting is therefore gated behind an A/B trial
(Work plan Step 11a; Verification V5) and is never used for anything not fully specified.

**Tool surface.** READ, SEARCH, WRITE-TREE, EXECUTE (build, tests, linters), no SPAWN, no
NETWORK beyond package resolution the build already performs. Context shape: `subsystem`.

**Demonstrated strengths.** Brownfield work in messy repositories; matching existing style;
carrying a change to green tests without being asked; concise diffs (Terra writes ~12% less code
than the prior generation for similar pass rates).

**Known weaknesses and characteristic failure modes.**
- *Code-quality debt at volume.* Terra measured +37% code-smell density against the prior
  generation and 203 vulnerabilities per mLOC, crypto misconfiguration leading. This is the tier
  where "capability concentrates where output is independently checked" earns its keep: Builder
  output is *always* reviewed, no exceptions, no inert tier except for genuinely
  behaviour-free changes.
- *Stalls on ceiling tasks* rather than escalating — the contract must make escalation a
  reportable status (BLOCKED / CHECKPOINT), not a judgment call.
- *Heuristic-path answers on messy long-horizon work.* Terra's clean-pass rate on a 100-task
  messy-repo suite is 40.7% against Sol's 63.7% — the largest measured gap in that family. The
  routing consequence is precise: Terra is a lane for *scoped* orders. If an order's scope is
  uncertain, it is not a Builder order.
- *Alignment ranking:* Sonnet 5 sits above Haiku but below Opus 5 on misaligned behaviour;
  Builder must never hold irreversible tools (P11).

**Task classes owned.** T1 routine coding; API integrations; small multi-file features behind a
spec; bug fixes whose diagnosis is already done.

**Must not be given.** Split-resistant cross-subsystem work (→ Principal); unspecified or
exploratory work (→ Architect first, then Principal); migrations touching live data (→ Data
Engineer); anything where the environment rather than the code is the problem (→ Operator);
certifying its own tests (→ Verifier, then Reviewer).

**Escalation in.** Nothing routes down into Builder. **Escalation out.** Two REVISE rounds, or a
CHECKPOINT, or a BLOCKED that reveals the order was mis-sized → Principal, once, with both
prior reports and the reviewer's findings verbatim. Never a third round at the same tier.

**Who reviews its output.** A Reviewer of a different family (Sonnet-authored → Sol; Terra- or
Luna-authored → Opus 5), preceded by a Verifier pass. Cross-family review is *preferred* rather
than mandatory at this tier when the change is small and fully covered by deterministic tests —
see the mandate table in §3.

---

#### C2. Principal

**Purpose.** Carry the orders that genuinely resist splitting — algorithmically hard cores,
coupled cross-subsystem changes, long-horizon builds — where a narrow order would lose the
whole-system view.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort high.
- *Second effort point:* Opus 5 · xhigh, chosen at routing time for orders judged hardest up
  front. **One tier, two effort points — not two rungs.**
- *Mirror:* OpenAI · GPT-5.6 Sol · effort high.
- *Ceiling:* Anthropic · Claude Fable 5 · effort high — new, and the most consequential single
  addition to the execution ladder.

**Casting rationale.** Frontier-Bench v0.1 SOTA (Opus 5 43.3 at max / 44.4 at xhigh) is the
hardest published agentic-coding measurement and Opus leads it; Terminal-Bench 3.0 (42.7) says
the same thing from the environment side; CursorBench puts it within 0.5% of the ceiling model
at half the cost per task. The **Fable ceiling rung** exists because the measured ceiling for
repo-scale merge-bar coding is Fable's (SWE-bench Pro ~80, highest CursorBench peak, Senior
SWE-bench #1) and the current harness cannot reach it — the heavy tier stops at Opus·xhigh. The
rung is rationed hard: it is reached only after a Principal order has bounced at both Opus effort
points *and* the diagnosis is "ceiling", not "under-specified". If the diagnosis is
under-specification, the correct move is re-planning, not a more expensive model — an
distinction the escalation contract must state explicitly, because it is the one every operator
gets wrong.

**Tool surface.** READ, SEARCH, WRITE-TREE, EXECUTE, **SPAWN limited to Runner and Verifier
only, fan-out ≤ 4** (see §3). Context shape: `repo`.

**Demonstrated strengths.** Holding a whole-system view across a long order; inventing its own
diagnostic tooling when the existing tools do not answer the question; tight diffs with less
dead code; verification instinct (opening its own frontend at desktop and mobile widths, finding
fold and off-screen bugs unprompted).

**Known weaknesses and characteristic failure modes.**
- *Over-engineering, at both castings.* "Simple parse becomes a 400-line table"; and on the Sol
  mirror, the audit-run signature of finding everything and then fixing past the task boundary
  ("a weekend of undoing"). The order contract must carry an explicit smallest-change clause and
  a scope cap, and the reviewer must be briefed to treat unrequested scope as a finding, not a
  bonus.
- *Argumentativeness* — reported widely in Jul–Aug 2026: combative refusals of simple tasks,
  disputes with the order. Mitigation: orders are goals plus constraints, and a disputed order
  returns BLOCKED with the contradiction named rather than being re-interpreted.
- *Still fails most hard tasks.* Frontier-Bench SOTA is 43% — a coin flip. Unsupervised
  Principal work is not finished work; the verification path is never optional.
- *Specification-gaming on the Sol mirror* (Adjudication 4): mandatory Verifier with tree audit
  and integrity nonce.
- *Concurrency blind spot on the Sol mirror:* threading and concurrency is that model's largest
  measured bug category (352 per mLOC). Concurrency cores therefore prefer the Anthropic
  casting, and where the mirror must be used, the review checklist explicitly includes
  concurrency.

**Task classes owned.** T6 complex long-horizon coding; algorithmically hard cores; coupled
cross-subsystem changes; risk-first probes whose wrong conclusion would misdirect a plan.

**Must not be given.** Routine well-scoped orders (→ Builder; if most orders are routing here,
the sizing law is failing, not the model succeeding); pure environment work (→ Operator); data
migrations (→ Data Engineer, for the irreversibility reason in P11, even when the code is hard).

**Escalation in.** A Builder order that bounced twice; a Conductor judgment at PLAN time that an
order is hard. **Escalation out.** xhigh effort point → Fable ceiling → re-plan. Two REVISE
cycles anywhere in this tier means re-plan, never another rung.

**Who reviews its output.** Mandatory cross-family Reviewer plus a mandatory Verifier pass. When
the Anthropic casting authors, the Reviewer is Sol; when the Sol mirror authors, the Reviewer is
Opus 5 — and note that this *inverts* the current harness's convention of adding a cross-vendor
pass to heavy orders, because at this tier cross-family review is not an addition, it is the
default.

---

#### C3. Operator

**Purpose.** Work the environment when the environment is the problem — CI archaeology, build
and toolchain failures, dependency and packaging hell, container and sandbox behaviour, flaky
infrastructure, release plumbing.

**Casting.**
- *Primary:* OpenAI · GPT-5.6 Sol · effort high.
- *Mirror:* Anthropic · Claude Opus 5 · effort high — **and also the escalation rung**, per
  Adjudication 1.
- *Routine subset:* delegated to Runner (see C12); this seat is for environments that fight back.

**Casting rationale.** Terminal-Bench 2.1 88.8 and OSWorld 2.0 62.6 are the direct measurements,
and the qualitative reports match the job's texture — tenacity through unglamorous work, no
silent degradation as the token budget tightens (which is the property a long CI-bisection needs
most). The **escalation inversion** is the finding from Adjudication 1: when a Sol Operator
stalls, the next call is Opus 5·high (Terminal-Bench 3.0 42.7 against Sol's 34.6), not Sol at a
higher effort. All three supplied reports would send you the other way; the newer, harder,
unsaturated benchmark says otherwise, and the escalation path is exactly where a hard-regime
measurement should govern.

**Tool surface.** READ, SEARCH, EXECUTE (full), WRITE-TREE (config, CI, build files),
NETWORK (package registries, vendor docs). Context shape: `subsystem` plus logs as `haystack`.

**Demonstrated strengths.** Long tool-loop persistence; reading and acting on error output; the
plan → run → read → iterate cycle that terminal work is made of; computer use when a GUI is
unavoidable.

**Known weaknesses and characteristic failure modes.**
- *Over-agency.* The system card documents unauthorized actions in testing, including deleting
  infrastructure and moving credentials, and an increased tendency to exceed user intent. In an
  environment seat this is the highest-stakes failure in the roster, because the blast radius is
  the machine rather than the file. Mitigations, all three mandatory: a sandbox with a declared
  write scope; an explicit forbidden-command list in the order; and irreversible actions gated
  on Conductor approval (P11).
- *Specification-gaming under outcome pressure* — an Operator that "makes the tests pass" by
  editing the test, the fixture or the CI condition. The Verifier's tree audit exists precisely
  to catch this: a report claiming a green suite against a tree the audit shows was not touched,
  or touched outside scope, is not a completed order.
- *Cyber-safeguard false positives* on legitimate security-adjacent engineering (threat models,
  pentest fixtures) can stall the seat with a refusal that looks like a failure.

**Task classes owned.** T2 terminal / shell operations; CI and build systems; dependency and
toolchain surgery; environment reproduction; release mechanics.

**Discriminator against Bug Hunter (T7) — because "works locally, fails in CI" reads like both.**
The question is not *where* the failure appears, it is *what changes when you change one thing*:
1. **The same commit passes in one environment and fails in another** → environment is the
   variable → **Operator**.
2. **The same commit fails in the same environment only sometimes** (re-runs, ordering, seeds,
   concurrency, wall-clock) → the program's own behaviour is the variable → **Bug Hunter**.
3. **Not yet known** — the common real case — → **Operator triages first** under a hard budget of
   ~15 tool calls, and its only deliverable is the two-cell answer to test 1: an environment
   matrix showing where the commit passes and where it fails. It then either owns the case (row 1)
   or hands to Bug Hunter with the matrix attached (row 2). Triage-first is correct because the
   environment answer is mechanical and cheap, while a Bug Hunter opened on an environment
   problem burns a long hunt on the wrong variable.
The routing table (§4.1) carries this rule verbatim, so neither seat can be selected by
vocabulary alone.

**Must not be given.** Application logic (→ Builder/Principal); anything irreversible without
approval; routine command running (→ Runner, at ~1/20th the draw); security *judgment* (→ Red
Team — the Operator patches what Red Team finds).

**Escalation in.** A Builder or Principal order blocked by the environment rather than the code.
**Escalation out.** Opus 5·high (per above); then Conductor re-plan. A second failed environment
theory is a re-plan trigger, not a third attempt.

**Who reviews its output.** Verifier first — mandatory, with tree audit — then a cross-family
Reviewer (Opus 5 for a Sol-authored change). Environment changes are among the highest-value
review targets precisely because their failure mode is "works on the machine that made it."

---

#### C4. Bug Hunter

**Purpose.** Chase intricate, confusing or intermittent defects by *running the system* —
instrumenting, bisecting, adding temporary probes, reproducing under varied conditions — and
deliver either a minimal reproduction plus a diagnosis, or a fix with the reproduction attached.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort high.
- *Mirror:* OpenAI · GPT-5.6 Sol · effort high (preferred when the defect is environmental or
  tool-loop-shaped rather than logic-shaped).
- *Ceiling:* Fable 5 · high, after two failed hunts with different hypotheses.

**Casting rationale, and why this seat must exist.** This is the gap the current roster cannot
staff. `agents/detective.md` rule 1 forbids the read-only investigator from running the code
("Running the code to observe it is still execution — propose the experiment under UNKNOWNS for
the Director to route to an executor"), and `agents/executor.md` rule 1 forbids the executor from
expanding scope to investigate. A Heisenbug therefore requires the Conductor to shuttle
hypotheses between two agents that each hold half the loop, losing the mental model on every
hop. One seat that may both reason and run closes it. The casting follows the same measurement
as Detective — Senior SWE-bench #1 in bug and performance investigation — plus the verification
instinct the practitioner reports describe (iterating until the failure actually reproduces
rather than declaring it fixed).

**Tool surface.** READ, SEARCH, EXECUTE (full), WRITE-TREE **restricted to a scratch/probe scope
plus the eventual fix**, SPAWN limited to Runner (for sweep-style reproduction: run this seed
matrix, report which fail). Context shape: `repo`.

**Demonstrated strengths.** Hypothesis-first debugging with an experiment attached; building the
diagnostic tool the repository lacks; performance and concurrency investigation; not declaring
victory before the reproduction goes green and then red again on revert.

**Known weaknesses and characteristic failure modes.**
- *Probe residue* — temporary instrumentation left in the tree. The contract requires a probe
  manifest and a clean-tree assertion in the report; the Verifier's tree audit checks it
  mechanically, which is the only way this gets caught reliably.
- *Fix-before-understand* — the characteristic failure under time pressure is a plausible patch
  with no reproduction. The report format therefore requires the reproduction *first*: a hunt
  that produces a fix without a failing-then-passing reproduction is incomplete by contract.
- *Rabbit-holing* — a long hunt with no falsification discipline. Mitigated by a tool-call budget
  and a mandatory CHECKPOINT with the hypothesis list at the halfway mark.
- *The mirror casting's concurrency blind spot* (352 concurrency bugs per mLOC) makes it the
  wrong casting for race-condition hunts specifically, even though it is the right casting for
  environment-shaped ones.

**Task classes owned.** T7 intricate / confusing / intermittent bug tracing; flaky-test
diagnosis; race and timing defects; "works locally, fails in CI" investigations.

**Must not be given.** Read-only causal questions where nothing needs to be run (→ Detective, at
lower risk); routine bug fixes with a known cause (→ Builder); performance *optimization* once
the cause is known (→ Performance Engineer).

**Escalation in.** A Detective verdict that names an experiment; a Builder BLOCKED on a defect it
cannot reproduce. **Escalation out.** Fable ceiling; or, if the hunt shows the defect is
architectural, Architect.

**Who reviews its output.** Verifier (reproduction runs, tree clean of probes) then cross-family
Reviewer on the fix. The reproduction itself is reviewed as an artifact: a reproduction that only
fails under the hunter's instrumentation is not a reproduction.

---

#### C5. Refactorer

**Purpose.** Carry out broad, semantically-shallow but wide change — API migrations, renames
across a repository, codemod authoring plus consumer migration, dependency-version sweeps —
where the risk is a *missed* site, not a wrong line.

**Casting.**
- *Primary:* OpenAI · GPT-5.6 Terra · effort medium.
- *Mirror:* Anthropic · Claude Sonnet 5 · effort medium.
- *Fan-out:* the seat may spawn Runners (≤4) for per-file or per-package legs.

**Casting rationale.** Breadth work is bounded by context and by cost-per-file, not by ceiling.
Terra carries a ~1M window with MRCR 89.6% — high enough to hold a consumer census in mind,
which is the actual skill this seat needs — at roughly 40% of the flagship's draw and double the
speed. The prior-generation codex-line DNA measured strongest at large-scale refactors and
debugging, which is the closest available direct signal for this contract. Sonnet 5 is the mirror
on repository-aware refactors.

**Tool surface.** READ, SEARCH, WRITE-TREE, EXECUTE, SPAWN (Runner only, ≤4). Context shape:
`repo`.

**Demonstrated strengths.** Wide mechanical consistency; concise diffs; comfortable with
generated-code and codemod workflows; cheap enough to run the sweep twice.

**Known weaknesses and characteristic failure modes.**
- *The missed consumer* — the defining failure. A refactor that compiles and passes tests while
  leaving a dynamic call site, a string-keyed reference, a doc example or a generated artifact
  behind. The contract closes this three ways: (i) the order must name the census method
  (grep pattern, symbol index, type check) before the change; (ii) the final step is always a
  Sweeper pass (D4) that is *not* performed by the Refactorer; (iii) the tool that performs the
  change must refuse to emit invalid output — a codemod carries its own validator.
- *Silent semantic drift* — a mechanical rename that changes behaviour at one site. Mitigated by
  requiring the diff to be reviewable as a pattern plus exceptions, with every exception called
  out in the report.
- *Over-large single orders* — the seat invites 40-file diffs that no reviewer can read at depth.
  The order must shard by package or by consumer, with the shards independently verifiable.

**Task classes owned.** T10 refactoring at scale; API migration; codemod authoring and
application; import/dependency sweeps.

**Must not be given.** Semantically deep restructuring (→ Principal); schema/data migration
(→ Data Engineer); anything where the *design* of the new API is still open (→ Architect first).

**Escalation in.** An Architect plan whose steps are wide-and-shallow. **Escalation out.**
Principal when the sweep reveals the change is not mechanical after all — which is a legitimate,
reportable outcome, not a failure.

**Who reviews its output.** Verifier (build + suite + census re-run) → Sweeper (independent
completeness check) → cross-family Reviewer on a *sampled* diff plus the full census. Reviewing
a 40-file mechanical diff line by line is theatre; reviewing the census and a sample is not.

---

#### C6. Test Author

**Purpose.** Write and repair tests, fixtures, harnesses and reproductions — the substrate every
other role's verification stands on.

**Casting.**
- *Primary:* Anthropic · Claude Sonnet 5 · effort medium.
- *Mirror:* OpenAI · GPT-5.6 Terra · effort medium.
- *Cheap subset:* Runner, for generating N cases from an explicit schema or matrix.

**Casting rationale.** The measured profile is exactly this seat: brownfield competence, hidden
tests, "carry a PR to tests", self-checking unprompted. There is no evidence that a ceiling model
writes materially better tests than a workhorse when the acceptance criteria are explicit — and
tests are, by construction, the artifact with the most explicit acceptance criteria in the
repository. Spending a flagship here is the clearest example in the roster of paying for
capability that the task cannot use.

**Tool surface.** READ, SEARCH, WRITE-TREE (test paths and fixtures only), EXECUTE. Context
shape: `subsystem`.

**Demonstrated strengths.** Matching existing suite conventions; producing tests that fail for
the right reason; fixture and harness plumbing.

**Known weaknesses and characteristic failure modes.**
- *Tests that assert the implementation rather than the behaviour* — the classic, and it is
  worse when the same session wrote the implementation. Hence the conflict-of-interest rule
  below.
- *Green-by-construction tests* — a test that cannot fail. The Verifier's mandatory
  mutation check for this seat (invert the assertion or revert the fix; the test must go red) is
  the cheapest possible defence and should be contractual.
- *Coverage theatre* — many shallow tests instead of the few that discriminate. The order should
  name the behaviours to pin, not a coverage number.

**Task classes owned.** T11 test authoring and repair; fixture and harness construction;
converting a Bug Hunter reproduction into a permanent regression test.

**Must not be given.** Certifying tests it authored (structural rule: **no agent certifies a
suite it wrote** — this is the one conflict-of-interest rule that applies even at the cheapest
tier); production logic (→ Builder); deciding what the acceptance criteria *should* be
(→ Architect or Conductor).

**Escalation in.** Any seat whose order requires new tests and whose primary deliverable is not
tests — tests are split into their own order per P12. **Escalation out.** Principal when the
code is untestable as structured, which is a design finding, not a test problem.

**Who reviews its output.** Verifier runs the mutation check mechanically; then the Reviewer of
the *change under test* reads the tests as part of that review. A test-only change may take a
same-family reviewer when the mutation check passes — one of the few places cross-family review
is genuinely optional, because the deterministic check is strong.

---

#### C7. Data Engineer

**Purpose.** Change data and the shapes that hold it — schema migrations, backfills, ETL, query
and index work — where the defining property is that mistakes may be unrecoverable.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort high.
- *Mirror (bulk, reversible, large-context extraction and transformation):* OpenAI · GPT-5.6
  Terra · effort medium.
- *No mirror (declared P2 exception): the irreversible sub-contract.* Migration authoring,
  rollback design and the prepared-apply packet stay on the alignment-led casting regardless of
  pool state. Pool pressure changes *when* Class-2 and Class-3 work is scheduled, never *who*
  prepares it; if the Anthropic pool is exhausted, irreversible data work **waits** (§5.6 rung 4).
  That is a deliberate, stated cost of P11, not an oversight in P2.
- *Never:* any cheap tier as owner; any apply step lacking the §3.6 authorization for its class.

**Casting rationale.** This is the clearest application of P11. The casting is decided by the
alignment measurement — lowest misaligned-behaviour score in the roster, "most careful about
irreversible side effects" — not by a coding benchmark, because the failure that matters here is
not a wrong line, it is a destructive action taken confidently. Terra takes the *reversible* half
(extraction, transformation, analysis over a 1M window at low draw), where the vendor and
platform positioning specifically targets structured data extraction and document analysis.

**Tool surface.** READ, SEARCH, WRITE-TREE (migration and query files), EXECUTE against
**non-production targets only**; production execution requires a separate, explicitly approved
order. Context shape: `subsystem` plus schema as `haystack`.

**Demonstrated strengths.** Careful sequencing; explicit rollback design; refusing a plan that
cannot be undone; life-sciences and structured-analysis strength on the mirror casting where the
data is scientific.

**Known weaknesses and characteristic failure modes.**
- *Irreversibility, obviously* — a backfill that runs before its dry run, a migration without a
  down path, a truncating type change. The contract requires, as a distinct step between
  "prepared" and "applied": a dry run against a copy; an explicit rollback script **and a tested
  restore from it**; a row-count and checksum comparison; and the authorization that the action's
  class demands under §3.6 — Conductor gating for Class 2, a **named human approval recorded in
  the ledger** for Class 3. The Conductor assembles and validates that packet; it does not sign
  it.
- *Over-engineering the migration* — the same family failure, expressed as a four-phase
  expand/contract dance where an additive column would do.
- *Silent data loss under transformation* — the failure deterministic checks catch and model
  review does not; hence a mandatory Verifier comparison of pre/post invariants (P5).

**Task classes owned.** T12 data and schema work; migrations; backfills; ETL; query performance.

**Must not be given.** Application logic around the data (→ Builder); any apply step whose §3.6
authorization is absent; anything on the cheap tiers.

**Escalation in.** A plan step that touches persisted data — this routes here even when the code
is trivial, because the class is defined by consequence, not difficulty. **Escalation out.**
Principal for algorithmically hard transformations; and, for every Class-3 step, Conductor →
**the named human approver** (§3.6) — an escalation with no model-side alternative and no
"proceed anyway" branch.

**Who reviews its output.** Mandatory cross-family Reviewer **and** mandatory Verifier with
invariant comparison. This is one of the five places cross-family review is non-negotiable.

---

#### C8. Performance Engineer

**Purpose.** Make it faster or lighter, with measurement on both sides of the change.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort high.
- *Mirror:* OpenAI · GPT-5.6 Sol · effort high — preferred when the work is harness-shaped
  (building the benchmark rig, profiling plumbing, CI timing) rather than algorithm-shaped.

**Casting rationale.** Senior SWE-bench names bug **and performance** investigation as the
casting's #1 category; that is the most on-point measurement available and it is the same
measurement that carries Detective and Bug Hunter. The mirror follows Adjudication 1's logic: if
the hard part is the rig rather than the algorithm, the environment seat's profile fits better.

**Tool surface.** READ, SEARCH, WRITE-TREE, EXECUTE (profilers, benchmarks), SPAWN (Runner, for
parameter sweeps and repeat runs). Context shape: `subsystem`.

**Demonstrated strengths.** Profiling before optimizing; hypothesis-driven micro-experiments;
building the measurement harness the repository lacks.

**Known weaknesses and characteristic failure modes.**
- *Optimizing the unprofiled* — the characteristic failure, and the contract forbids it: no
  optimization order is accepted without a baseline measurement artifact.
- *Benchmark-fitting* — improving the benchmark rather than the workload; the counterpart of the
  specification-gaming risk, and the reason the baseline and the target measurement must be
  produced by different runs and re-run by the Verifier.
- *Micro-optimization at the cost of clarity* — mitigated by a stated budget: a change that costs
  readability must show a threshold-crossing gain, named in the order.

**Task classes owned.** T13 performance work; benchmark authoring; regression triage on timing;
memory and allocation work.

**Must not be given.** Correctness bugs that merely present as slowness (→ Bug Hunter);
infrastructure scaling (→ Operator); data-layer query optimization (→ Data Engineer, which owns
the schema consequences).

**Escalation in.** A regression detected by the ledger or CI; an explicit performance goal in a
plan. **Escalation out.** Principal when the fix is an architecture change; Architect when it is
a design change.

**Who reviews its output.** Verifier re-runs both measurements independently — a performance
claim verified only by its author's numbers is worthless — then a cross-family Reviewer on the
diff. Preferred rather than mandatory cross-family, unless the change touches concurrency, in
which case mandatory.

---

#### C9. Interface Artisan

**Purpose.** Build and fix what a user looks at — web and app UI, layout, interaction,
accessibility, visual regression — with a render-inspection loop rather than one-shot code
emission.

**Casting.**
- *Primary (generation):* OpenAI · GPT-5.6 Sol · effort medium–high, **with a browser/screenshot
  loop**.
- *Primary (reference adherence):* Google · Gemini 3.7 Flash · medium — when the input is a
  design reference (screenshot, mock, design system) and the output must match it. *Optional
  lane.*
- *Closing casting:* Anthropic · Claude Opus 5 · effort high — the seat that verifies at
  multiple viewports and closes the change.
- *Critic:* Anthropic · Claude Fable 5 — global visual coherence review, called rarely.
- *Cheap inspector:* Runner, for screenshot triage at volume.

**Casting rationale, and the disagreement it resolves.** This is the brief's worked example —
"strong visual/spatial understanding paired with coding skill" — and the reports disagree about
it. `cross_vendor_agent_harness_roster_summary.md` §3 assigns interactive UI systems to Opus and
global visual critique to Fable; `openai-models.md` §2.5 documents the largest single-domain
generational jump in the family, with Sol reaching #1 overall (~Elo 1353) on Design Arena in
mid-August snapshots — up eighteen positions from a predecessor widely called terrible at
frontend — together with an analysis of *why* (it recognizes and actively suppresses common AI
design anti-patterns) and a hands-on comparison rating its output the most "client-review-ready"
of its family. Other same-month snapshots put a different model ahead, so the honest reading is
"top-3 band," not a fixed crown.

*Adjudication:* both are right about different halves of the job, and the seat is explicitly
two-phase, which is also what the evidence recommends mechanically — the vendor frames frontend
work as *inspect the rendered result and iterate visually*, and the frontend edge compounds only
when the harness supplies the browser loop. So: **Sol (or Gemini, on a reference) generates;
Opus 5 inspects and closes; Fable critiques global coherence when something passes every check
and still looks wrong.** Gemini earns the reference-adherence casting on Code Arena Web Dev Elo
1588 and the vendor's specific claim of high design adherence to a screenshot, image or full
design system — a vendor-run board, hence a narrower claim than Sol's crowdsourced one, hence the
narrower casting.

**Tool surface.** READ, SEARCH, WRITE-TREE, EXECUTE, BROWSER (render, screenshot, resize,
interact). Context shape: `subsystem` plus reference artifacts.

**Demonstrated strengths.** Anti-pattern suppression; complete, hierarchy-aware layouts;
inspect-and-fix loops; multi-viewport verification on the closing casting.

**Known weaknesses and characteristic failure modes.**
- *No settled independent board.* Design Arena is volatile and WebDev-Arena rank was unsettled
  for this generation at the time of the supplied report. The casting is therefore held with
  moderate confidence and carries an expiry: re-test at the next generation rather than
  inheriting the assumption. Note also that the *previous* generation's frontend weakness is a
  stale assumption — a routing rule written six months ago would now be wrong, which is the best
  available argument for putting expiry dates on domain assumptions generally.
- *Inconsistency across screens* on the mid-tier casting — "mobile output looked like three
  separate concepts" — which is why the mid-tier is cast as a divergent explorer in competing
  spikes, not as the owner of a coherent multi-screen system.
- *Taste without verification* — output that photographs well and breaks at 320px or under a
  screen reader. Mitigated structurally by the closing casting and by deterministic checks
  (axe-style accessibility scan, visual-diff thresholds) before any model judgment.

**Task classes owned.** T9 visual / UI work; design-reference implementation; visual regression
fixes; accessibility remediation.

**Must not be given.** Code that produces 3D or procedural geometry (→ Spatial Specialist);
back-end logic behind the interface (→ Builder); final sign-off on its own rendering (→ closing
casting, always a different family than the generator).

**Escalation in.** A plan step with a visual acceptance criterion. **Escalation out.** Fable
critic when numeric and structural checks pass but the result is incoherent; Architect when the
problem is the design system rather than the screen.

**Who reviews its output.** Deterministic visual and accessibility checks → closing casting
(different family from the generator by construction) → Reviewer for code quality. The rendered
artifact is part of the review packet: verdicts cite screenshots the way code review cites
`path:line`.

---

#### C10. Spatial Specialist

**Purpose.** Write code whose output is geometry, space or simulation — procedural meshes,
parametric CAD, level and scene generation, shaders, animation systems — and build the inspection
tooling that tells you whether the output is right.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort high.
- *Global critic:* Anthropic · Claude Fable 5 · effort high — for "passes every numeric rule and
  still looks wrong."
- *Mirror:* OpenAI · GPT-5.6 Sol · effort high — for the agentic loop around a game engine
  (build, run, screenshot, adjust) rather than for the geometry algorithms themselves.
- *Cheap inspector:* Runner or Archivist for render triage at volume.

**Casting rationale, with its honest gap.** The strongest available evidence is
`cross_vendor_agent_harness_roster_summary.md` §3, which assigns procedural mesh generation,
Blender Python automation, parametric CAD, procedural level generation, shader architecture,
render-inspection loops and *the invention of diagnostic tooling* to Opus, and spatial
reconstruction from multiple references plus global visual critique to Fable. Against that,
`openai-models.md` §2.5 declines to claim the seat for its subject family: it records that all
three tiers shipped a working small game agentically (cheaply, with zero script errors), that
community A/B tests on identical 3D prompts rated a non-roster model at or above the flagship
for 3D scenes and voxel builds, and it explicitly recommends holding the modeler-class seat open.

*Adjudication:* the two agree more than they appear to. One says "Anthropic for the geometry and
the diagnostic tooling," the other says "not our family, and here is why." No independent
shader, Blender-scripting, physics-simulation or data-visualization evaluation exists for this
generation — that is a real gap, and it is the largest single evidence gap in this document.
The casting is therefore held at **moderate confidence with an explicit trial** (Verification
V6): the first three orders in this class run as paired spikes across the primary and the mirror,
scored on accepted output, and the casting is revisited on that evidence rather than on the
reports.

**Tool surface.** READ, SEARCH, WRITE-TREE, EXECUTE (headless engine and DCC tooling), BROWSER or
render capture, SPAWN (Runner, for parameter sweeps). Context shape: `subsystem` plus reference
artifacts.

**Demonstrated strengths.** Building the inspection loop rather than only the generator;
parametric reasoning about shapes; diagnosing output that is technically valid and visually
broken.

**Known weaknesses and characteristic failure modes.**
- *Numerically-valid, visually-wrong output* — the defining failure of the whole class, and the
  reason the Fable critic exists as a named casting rather than an optional extra.
- *Unmeasured domain* — see the gap above; treat every casting claim here as provisional.
- *Iteration cost* — produce-inspect-adjust loops are the most allowance-hungry pattern in the
  roster because each round pays for generation *and* inspection. Mitigated by pushing inspection
  to the cheapest capable seat (visual triage at Runner/Archivist rates, escalating only
  ambiguous frames) — a pattern the current roster has no seat for and which this design adds.
- *Deterministic checks are unusually strong here and unusually neglected*: manifold validity,
  polygon budgets, collision validity, deterministic seeding, frame time, draw calls, required
  scene nodes, serialization round-trips. Every one of these is a cheap, non-correlated check
  that must run before any model looks at the render (P5).

**Task classes owned.** T14 spatial / procedural / geometry-producing code; shader authoring;
scene and level generation; DCC-tool automation.

**Must not be given.** 2D interface work (→ Interface Artisan); productionizing a working
generator — seeds, LODs, serialization, editor controls, optimization — which is Builder work at
a fraction of the draw and is the single biggest cost saving available in this class.

**Escalation in.** A plan step producing visual or spatial artifacts. **Escalation out.** Fable
critic on coherence; Architect when the parameterization itself is wrong.

**Who reviews its output.** Deterministic geometry checks → cheap visual triage → Fable critic
for coherence when triage flags it → cross-family Reviewer on the code. Note the pattern: four
checks, only one of which is expensive, and the expensive one runs last and rarely.

---

#### C11. Doc Writer

**Purpose.** Produce prose that a human will rely on — user documentation, API references,
changelogs, architecture decision records, migration guides.

**Casting.**
- *Primary:* Anthropic · Claude Opus 5 · effort medium.
- *Mirror:* OpenAI · GPT-5.6 Sol · effort medium — **added in this revision.** The draft named no
  opposite-pool casting at all, which stranded the class whenever the Anthropic pool throttled and
  contradicted P2 outright. The mirror sits at the *flagship* tier only: Sol is not identified as
  a weak writer of its family, and the exclusion below was always about the workhorse and cheap
  tiers rather than the vendor.
- *Stated non-equivalence (P2 honesty clause):* the mirror is a downgrade for deliverable-grade
  prose — GDPval-AA v2 puts the Anthropic side ahead by roughly 12 Elo on knowledge-work
  artifacts — so under the mirror the contract adds one cheap check it does not otherwise need: a
  cross-family read for register and over-claiming before publication. Documents that are
  themselves the deliverable **wait** for the primary pool rather than shipping on the mirror.
- *Ceiling:* Anthropic · Claude Fable 5 · effort medium — for the small number of documents that
  are themselves deliverables; unavailable below a Max seat (Adjudication 5), where the ceiling
  is the primary.
- *Never:* Terra or Luna. Both are identified as the weak writers of their family in a blind
  prose panel; documentation is one of the few classes where the cheap tier is a false economy,
  because bad docs are not caught by tests and are read for years.

**Casting rationale.** Knowledge-work artifact quality is a measured Anthropic strength (GDPval
leadership; the dossier's first call for decks, memos and careful enterprise documents), and the
failure mode of cheap prose — plausible, fluent, subtly wrong — is exactly the failure a test
suite cannot catch. This is the clearest case in the roster where "cheap model is genuinely
sufficient" is **false**, and saying so explicitly is as important as the many places where it
is true.

**Tool surface.** READ, SEARCH, WRITE-TREE (documentation paths). No EXECUTE. Context shape:
`subsystem`.

**Demonstrated strengths.** Structure and hierarchy; accurate summarization of a diff; careful
language where precision matters.

**Known weaknesses and characteristic failure modes.**
- *Confident description of behaviour that does not exist* — documentation drifts from code
  silently and no test fails. The contract requires every behavioural claim to cite `path:line`
  or a passing test, and the Verifier checks a sample mechanically.
- *Length inflation* — the family failure again, as a 2,000-word page where 300 would do.
- *Marketing register* — mitigated by an explicit voice constraint in the order.

**Task classes owned.** T15 documentation; changelog and release notes; ADRs; migration guides.

**Must not be given.** Code (→ Builder); design decisions dressed as documentation (→ Architect);
anything on the cheap tiers.

**Escalation in.** Any change whose meaning users depend on. **Escalation out.** Fable for
deliverable-grade documents.

**Who reviews its output.** A cross-family Reviewer reading for accuracy against the diff, plus
a Verifier sample check of cited claims. Documentation is *substantive* — it changes what people
believe the system does — and the inert tier does not apply to it.

---

#### C12. Runner

**Purpose.** Do the bounded mechanical thing, N times, in parallel, cheaply — run a suite, sweep
a parameter matrix, apply a template, classify a batch of outputs against a checklist, poll a
progress file.

**Casting.**
- *Primary (OpenAI pool):* GPT-5.6 Luna · effort low.
- *Primary (Anthropic pool):* Claude Haiku 4.5 · thinking off.
- *Third pool:* Gemini 3.7 Flash · low.
- Choose by which pool has room and which parent's cache is warm; never mix vendors inside one
  cached prefix.

**Casting rationale.** Per-unit cost is the entire point, and both cheap tiers are strong on
exactly the contract's shape: crisply-defined tasks, near-flagship scores when the task is
well-defined, collapse when it is not. At Luna's post-cut rates and ~141 tok/s, fan-out
reconnaissance, classification, sweeps and polling round to nothing against the OpenAI window.

**Tool surface.** READ, SEARCH, EXECUTE (a *declared command set* only), WRITE-TREE only where
the order names exact paths and shapes. No SPAWN, no NETWORK, no judgment. Context shape:
`packet` — this is the hardest constraint in the roster and the dispatcher enforces it.

**Demonstrated strengths.** Throughput; latency; cost that permits redundancy (three runs and a
vote is affordable here and nowhere else); adequate short-horizon coding when the spec is
complete.

**Known weaknesses and characteristic failure modes.**
- *The haystack cliff* (MRCR 41.3) and *the stale-knowledge cliff* (Haiku's Feb 2025 cutoff) —
  both hard route-filters, not preferences.
- *Weak recovery* — an unexpected condition produces a confident wrong result rather than a
  question. Every Runner order therefore carries explicit acceptance tests and a "if X, stop and
  report" clause.
- *Compounding error on long dependent chains* — the measured drop-off on multi-step tool
  orchestration. Runner orders must be flat, not chained.
- *Never a judge.* Ensemble votes and mechanical checks only; a Runner may report that a
  checklist item is unmet, never that a change is good.

**Task classes owned.** T20 mechanical batch execution; parameter sweeps; template application;
checklist classification; screenshot/render triage at volume; progress polling.

**Must not be given.** Anything open-ended; anything requiring a large corpus; anything whose
output is a verdict; owning a feature.

**Escalation in.** Any seat with a bounded repetitive leg. **Escalation out.** Two failures on
the same leg → the parent seat takes it back; never a third Runner attempt.

**Who reviews its output.** The parent seat spot-checks against the acceptance tests; a Verifier
runs the deterministic checks. Runner output is never reviewed by a frontier model as prose —
that would cost more than the work.
---

### Band D — Assurance

#### D1. Reviewer

**Purpose.** Presume the change is broken and try to break it — independently read the diff,
independently re-run verification, and return severity-tagged findings with concrete failure
scenarios.

**Casting — computed, not chosen.** `family(reviewer) ≠ family(author)`, evaluated at dispatch:

| Author's family | Reviewer casting | Effort |
|---|---|---|
| Anthropic (Sonnet / Opus / Fable) | OpenAI · GPT-5.6 Sol | high |
| OpenAI (Terra / Sol / Luna) | Anthropic · Claude Opus 5 | high |
| Google (Gemini) | either of the above; prefer the pool with room | high |
| *other pool exhausted —* **mandatory class** *(§3.3)* | **no substitution exists.** The change does not close. It waits for the reset, or takes a named human expert review recorded as such, or parks unmerged on a branch carrying a `HOLD: cross-family review unavailable` marker | — |
| *other pool exhausted —* **preferred class** *(§3.3)* | same family, **different model and fresh context**, plus mandatory Verifier evidence, and a machine-set `review.cross_family = false` field that the user-facing report renders verbatim | high |

**The row that changed in this revision, and why.** The draft had a single *degraded* row that
permitted same-family review with disclosure for any class. Disclosure is not a substitute for
the property being disclosed: a Principal-tier, data, security or integration change closed on a
same-family verdict is precisely the correlated review the architecture exists to prevent, and
labelling it does not decorrelate it. The mandatory set therefore has **no degraded mode at all**
— its only outcomes are wait, human, or hold — and the preferred band keeps a disclosed
same-family path because the brief explicitly asks a design to distinguish mandatory pairing from
preferred pairing, and a routine Builder round with full deterministic coverage is the paradigm
case of the latter. Disclosure is also no longer prose: `review.cross_family` is a required
boolean on the verdict schema, the Verifier sets it from the dispatch record rather than the
reviewer asserting it, and a user-facing report that omits it fails the contract lint (R11).

A cheap first-screen casting (Terra · medium, or Sonnet · medium) may run *before* the frontier
verdict on large diffs, as a recall filter; it never issues the closing verdict, because seating
a reviewer above its own capability ceiling is how a gate becomes a formality.

**Casting rationale.** Two independent measurements support cross-family review specifically
rather than merely fresh-context review. First, review parity: on a 105-task review suite Sol
caught 65 actionable issues against a rival flagship's 66 and a human baseline of 66, and led on
full review passes 74–72 — so the cross-vendor reviewer is not a downgrade. Second, and more
importantly, the failure-mode complementarity table in `dossier_both.md` §5.2 lists the specific
asymmetries: constraint violation ("I ignored the frozen file") is commoner in one family and
rarer in the other; over-obedience and sycophancy run the other way; long-context misses,
hallucinated current-year facts and stuck tool loops each have a family that fails more. A
reviewer drawn from the family that fails *differently* is looking for defects its counterpart
does not produce. That is the entire de-correlation argument, and it is measured rather than
assumed.

**Tool surface.** READ, SEARCH, EXECUTE (the project's declared verification manifest, plus
exploratory read-only commands), NETWORK for documentation lookups. **No WRITE-TREE, ever** —
a reviewer that can fix things stops reviewing and starts authoring, and its verdict then
reviews its own work. Context shape: `repo`.

**Demonstrated strengths.** High recall on real defects; adversarial disposition; willingness to
re-run rather than trust; on the OpenAI casting, an unmatched discovery appetite.

**Known weaknesses and characteristic failure modes.**
- *Over-production of findings* — "finds everything; that's the problem." The Reviewer's output
  is *findings*, not decisions; the Conductor (or Gate Arbiter) decides what blocks. This is P10
  and it is the reason the two are separate seats.
- *Blunt comment style* on the OpenAI casting — acceptable in a findings-verbatim protocol where
  a human never reads the raw text, and a real cost if verdicts are surfaced to users directly.
- *Verdict inflation under ambiguity* — a REVISE issued for a stylistic preference. Mitigated by
  the severity contract: only CRITICAL or MAJOR force REVISE, and each must carry a concrete
  failure scenario ("given X, Y happens instead of Z"), which is a high bar to state falsely.
- *Trusting the author's pasted output* — the single most common way review quality collapses.
  The contract requires independent re-running, and the Verifier's independent evidence is
  attached to the packet precisely so the Reviewer cannot be the only one who checked.
- *Family blindness in the preferred-band degraded mode* — recorded as a schema field, not as a
  sentence someone might drop. A change reviewed same-family is not a change reviewed
  cross-family, and presenting it as one is the worst failure the assurance band can produce;
  telemetry tripwire 5 treats an undisclosed degraded review as a process defect of the most
  serious kind. In the mandatory set the mode does not exist, so the failure cannot occur there
  by construction rather than by discipline.

**Task classes owned.** T5 adversarial review; plan critique (a mode of the same contract);
verdict production.

**Must not be given.** Fixing anything; deciding what blocks; reviewing its own family's work at
gate class; reviewing a change it advised on.

**Escalation in.** Every substantive change. **Escalation out.** Two REVISE cycles on the same
change → the Conductor re-plans (never a third round); a finding the author disputes → Gate
Arbiter or a second cross-family opinion.

**Who reviews the Reviewer.** The Conductor arbitrates its verdicts, bounded by the rule that a
cross-family REVISE at gate class cannot be overturned without a deterministic refutation or a
second cross-family opinion. Reviewer quality itself is measured over time by the ledger: escape
rate (defects found after approval) is the only honest metric and it belongs in the telemetry.

---

#### D2. Red Team

**Purpose.** Attack the change and the system on purpose — threat modelling, vulnerability
hunting, dependency and supply-chain review, secrets and permission analysis — defensively only.

**Casting.**
- *Primary:* OpenAI · GPT-5.6 Sol · effort high (max for a full threat model).
- *Mirror:* Anthropic · Claude Opus 5 · effort high — usable for "find the vulnerability" and
  hardening, weaker on exploitation reasoning.
- *Never:* Claude Fable 5 (see below); Sonnet, Haiku, Terra, Luna, Gemini as owner.

**Casting rationale — the one place policy, not capability, decides.** ExploitBench 73.5 and
SEC-Bench Pro 71.2–74.3 make Sol the strongest generally-available defensive-security worker, and
the margin over its own workhorse tier is large (Terra 52.9 / 57.7), so this is not a seat the
cheap tier can cover. The **Fable exclusion is a policy fact, not a capability judgment**: its
conservative classifiers fall back or refuse on cyber topics, and — critically — *the fallback
is silent*. A harness that routes security review to Fable may receive a different model's answer
and never know, which is worse than an honest refusal. The dossier states this bluntly and it
should be encoded as a hard route-filter: security-adjacent work never routes to that casting.

Two boundaries the seat carries in its contract: offensive work (exploit development, weaponized
proof-of-concept) is refused at the Conductor and never delegated; and the primary casting's own
cyber safeguards produce false positives on legitimate security engineering, so a refusal from
this seat is a *reportable event*, not a finding.

**Tool surface.** READ, SEARCH, EXECUTE (static analysis, dependency audit, sandboxed dynamic
checks), NETWORK (advisory databases). No WRITE-TREE — Red Team finds; Operator or Builder
patches. Context shape: `repo`.

**Demonstrated strengths.** Vulnerability discovery; threat enumeration; the adversarial
disposition that makes the specification-gaming risk elsewhere an asset here.

**Known weaknesses and characteristic failure modes.**
- *Over-production*, as with Reviewer — a threat model that enumerates every theoretical risk
  buries the two that matter. The contract requires findings ranked by exploitability and blast
  radius, with an explicit "what I would fix first" line.
- *Classifier friction* — see above.
- *Security issues migrating to where review catches them least* is a documented property of the
  primary casting's own output, which is why Red Team never reviews a change the same model
  authored, even under this seat's name.

**Task classes owned.** T16 security review; threat modelling; dependency and supply-chain
review; secrets and permissions audit.

**Must not be given.** Patching what it found (→ Operator/Builder, then reviewed normally);
offensive work (refused); routine code review (→ Reviewer — a security pass on every change is
allowance the system does not have).

**Escalation in.** Any change touching authentication, authorization, cryptography, input
parsing, deserialization, file paths, subprocess invocation, or dependencies; plus a scheduled
periodic pass. **Escalation out.** Human, for anything with legal or disclosure implications.

**Who reviews its output.** The Conductor triages severity; the fix is reviewed as an ordinary
change by a different-family Reviewer. Red Team's own findings are not "reviewed" — they are
either reproduced or not, which is a Verifier question.

---

#### D3. Verifier

**Purpose.** Establish facts about a change mechanically — did the declared verification run,
did it pass, does the tree match the claim, do the cited lines say what the report says — and
return evidence, never a verdict.

**Casting.**
- *Primary:* whichever cheap tier matches the pool with room — Luna · low, Haiku · off, or
  Gemini 3.7 Flash · low.
- *Deterministic core:* **no model at all** wherever possible. Command execution, exit codes,
  diff parsing, tree fingerprinting, nonce checking and schema validation are code, and code is
  the cheapest, most reliable and most perfectly de-correlated evaluator available.

**Casting rationale, and why this seat is worth adding.** Two arguments. First, cost: the
dominant recurring cost in the loop is the full verification run, paid at least twice per round
by design. That redundancy must not be trimmed — the Reviewer's independent re-run is the point
— but the *third* and *fourth* checks (did the executor's claims match the tree, is the suite
even green before we spend a frontier reviewer's minutes) can be paid at 1/25th the rate. A red
suite discovered by a Verifier costs a rounding error; the same red suite discovered by a
frontier Reviewer costs a full review. Second, integrity: this repository already implements
exactly the mechanisms this seat formalizes — a per-run integrity nonce the engine must echo, an
in-process tree audit measuring which paths actually changed, and a refusal to report DONE when
a report claims changes against an untouched tree. Those mechanisms currently live inside one
optional pack's runners; as a role they apply to every authoring seat on every vendor, which is
what P9 requires.

**Tool surface — corrected in this revision.** EXECUTE (the declared manifest and named checks),
READ, SEARCH, and **WRITE confined to a disposable isolated checkout**. The draft said "no WRITE
anywhere", which would have made the seat unable to do its own job: build systems and test
runners write caches, generated artifacts, coverage data and temporary fixtures as a matter of
course, and two of the Verifier's mandatory checks — the mutation check on a new test (invert the
assertion, the test must go red) and the invariant comparison on a data change (apply against a
copy) — *are* mutations by definition. The reference implementation in this repository already
made exactly this trade and documents it: its review runner defaults its sandbox to
`workspace-write` "(default — lets the reviewer actually run the test suite)" and warns that
`read-only` is a "hard no-write guarantee, but many test runners can't run under it"
(`packs/codex/hooks/orchestra-review.js`), with the operator-facing symptom spelled out in
`README.md` — "Reviewer runs but the tests don't execute … Codex's `read-only` sandbox can't run
commands that write." A read-only Verifier does not fail loudly; it fails *closed* on ordinary
projects, and the checks every substantive review depends on silently stop happening.

The write right is bounded four ways, and the bounds are what make it safe:
1. **Location.** Writes are permitted only inside a throwaway checkout of the commit under
   examination, created outside the repository — the same worktree-outside-the-tree pattern the
   reference implementation already uses (`worktreeRoot` must be outside the repository).
2. **Direction.** The Verifier has no write path to the source of truth, to the author's working
   tree, or to any shared branch. Nothing it writes ever merges; the checkout is deleted after
   the report.
3. **Evidence.** A fingerprint of the checkout is taken before and after; the report carries the
   delta, classified against the project's generated-artifact list, so "the suite wrote a cache"
   and "something edited a source file" are distinguishable rather than both being noise. The
   reference implementation's `INTEGRITY NOTE` / `⚠ INTEGRITY WARNING` split is exactly this
   distinction and is adopted verbatim.
4. **Authority.** Unchanged: none. The report is a table of checks and outcomes; a mutation the
   Verifier performed is an *experiment*, never a proposed change, and the seat may not offer a
   fix even when the fix is obvious.

Context shape: `packet` plus the disposable checkout.

**Demonstrated strengths.** Determinism where the check is code; adequate classification against
an explicit checklist where a model is needed; near-zero allowance draw.

**Known weaknesses and characteristic failure modes.**
- *Scope illusion* — a green manifest on a project whose manifest is incomplete. The Verifier
  reports what it ran, never "verified"; completeness of the manifest is a project property and
  belongs in the telemetry.
- *Cheap-tier misclassification* on the model-assisted checks — mitigated by keeping the model's
  job to yes/no against an explicit criterion, and by allowing an ensemble vote where a wrong
  vote is absorbed.
- *False confidence transfer* — a Verifier pass is not an approval, and the report format must
  make that impossible to misread.
- *Write-scope escape* — the failure introduced by giving this seat a write right at all: a check
  that mutates the source of truth instead of the disposable checkout. Detected by the same
  before/after fingerprint the seat applies to others, run *on the Verifier itself* by the
  dispatcher, which is cheap because it is the identical mechanism. A Verifier run that dirties
  the real tree is a harness incident, not a finding.

**Task classes owned.** T21 mechanical verification; claim checking; tree audit; mutation checks
on new tests; invariant comparison on data changes; reproduction re-runs.

**Must not be given.** Any verdict; any fix; reviewing prose or architecture.

**Escalation in.** Every substantive change, before the Reviewer. **Escalation out.** A failed
mechanical check returns the change to the author without spending a Reviewer at all — which is
the seat's main economic contribution.

**Who reviews its output.** Nobody: the output is machine-checkable by construction, and where a
model was involved, the Reviewer sees the same raw evidence.

---

#### D4. Sweeper

**Purpose.** After a fan-out or a wide change, find what the parts missed — orphaned call sites,
stale documentation, dead configuration, un-migrated consumers, drift between generated and
source artifacts.

**Casting.**
- *Primary:* OpenAI · GPT-5.6 Terra · effort medium.
- *Mirror:* Anthropic · Claude Sonnet 5 · effort medium.
- Never the same instance that performed the fan-out, and preferably not the same family as the
  Refactorer that authored it.

**Casting rationale.** The requirement is a wide, cheap, high-recall read over the whole diff
plus the whole repository — a 1M window with MRCR 89.6% at workhorse rates is exactly that, and
a flagship here buys nothing the task can use. This repository already mandates the *behaviour*
("every chain ends with an explicit sweep step") but leaves it to whichever executor is
available; promoting it to a seat with a contract makes it independent of the party that might
have missed something, which is the whole point.

**Tool surface.** READ, SEARCH, EXECUTE (read-only checks, census scripts). No WRITE-TREE — the
Sweeper reports, someone else fixes. Context shape: `repo` + `haystack`.

**Strengths.** Breadth; census discipline; cheap enough to run after every chain.

**Weaknesses and failure modes.** *False positives at volume* (flagging intentional exceptions),
mitigated by requiring the order to name known exceptions; and *the same blind spot as the
author* if cast on the same family, which is why the casting prefers the other pool.

**Task classes owned.** T17 post-fan-out sweep; consumer census; drift detection.

**Must not be given.** Fixing what it finds; reviewing correctness (→ Reviewer).

**Escalation in.** The end of every chained or sharded order — mandatory, not optional.
**Escalation out.** Findings become a new order routed by class.

**Who reviews its output.** The Conductor triages; the resulting fixes are reviewed normally.

---

### Band E — Operations

#### E1. Quartermaster

**Purpose.** Know how much of each vendor's allowance is left, predict exhaustion, and publish
the degradation state the router reads.

**Casting.** Deterministic code first — the ledger's arithmetic over recorded calls, plus
whatever usage telemetry each CLI exposes. Where a model is needed for summarization, the
cheapest tier with room. This is a role in the architecture rather than a frontier seat, and it
is listed because a design whose central scarce resource is allowance without a seat that
*measures* allowance is a design that will discover exhaustion by hitting it.

**Tool surface.** READ (ledger, usage output), EXECUTE (usage probes), WRITE-DOC (the ledger).
Context shape: `packet`.

**Strengths.** Turns the cost model from an estimate into a measurement; makes the routing rules
in §5 executable rather than advisory.

**Weaknesses and failure modes.** *Unverified telemetry* — none of the three vendors publishes
exact token quotas, so the Quartermaster's numbers are relative and predictive, not absolute. It
must therefore report **consumption rate and time-to-throttle as estimates with a confidence**,
never as a guarantee, and the router must treat an exhausted-pool surprise as a normal event.

**Task classes owned.** **T24 — allowance accounting**: per-bucket state, throttle prediction,
ledger maintenance, degradation-state publication, post-session cost reporting. It does not own
T23 or any planning class; the draft mislabelled the Synthesizer's class as T24 and that
collision is resolved in §4.

**The pool model it maintains is per-*bucket*, not per-vendor (revised).** Treating "the
Anthropic pool" as one number is wrong on the plan tiers this design targets: on Max plans the
allowance is a **combined weekly limit across all models plus a separate Opus-specific weekly
limit**, and Fable draws against the combined limit with its own 50% sub-cap. The Quartermaster
therefore publishes four numbers, not two: `AU-all`, `AU-opus`, `AU-fable-subcap`, and `OU`
(plus `GU` where the optional lane exists). This is not bookkeeping pedantry — it is what makes
P13's pre-dispatch gate possible, because the failure it guards against is bucket-specific.

**Consequently it owns one hard gate, and it is the only gate a non-judging seat holds.** When
`AU-opus` is predicted below its reserve, Principal, Detective, Bug Hunter, Data Engineer,
Performance Engineer and Doc Writer orders are **not dispatched on their Anthropic castings**;
they re-cast to their mirrors or wait. The reason is P13: reaching the Opus limit does not
produce an error, it produces *Sonnet silently answering as Opus for the rest of the window*, so
the only reliable defence is to stop before the boundary rather than to detect having crossed it.
The gate is mechanical and the Conductor cannot wave it through; what the Conductor decides is
which of the two lawful responses — mirror, or wait — applies.

**Must not be given.** Routing decisions (it informs and it gates on measured state; the Conductor
still decides *what* to do about a gate); any content judgment.

**Who reviews its output.** Reality: predicted throttle versus observed throttle is itself a
ledger metric, and a Quartermaster that is consistently wrong is a detectable, fixable defect.

---

## 3. Hierarchy and topology

### 3.1 Who dispatches whom

```
                        USER
                          |
                     [ CONDUCTOR ]                       Opus 5 · medium
     the only seat that talks to the user, holds the plan, and decides
                          |
   +---------------+------+------+---------------+----------------+
   |               |             |               |                |
[ EVIDENCE ]   [ PLANNING ]  [ CONSTRUCTION ]  [ ASSURANCE ]  [ OPERATIONS ]
Pathfinder      Architect     Builder            Reviewer       Quartermaster
Librarian       Synthesizer   Principal *        Red Team
Archivist                     Operator           Verifier
Detective                     Bug Hunter *       Sweeper
                              Refactorer *
                              Test Author
                              Data Engineer
                              Performance Eng *
                              Interface Artisan
                              Spatial Spec *
                              Doc Writer
                              Runner
                                  |
                    * may dispatch, within its own order only:
                                  |
                        [ Runner ]   [ Verifier ]        fan-out <= 4
                        (leaf seats: may never dispatch)
```

**Depth limit: two levels of dispatch, hard.** The Conductor dispatches any role; five
construction roles (Principal, Bug Hunter, Refactorer, Performance Engineer, Spatial Specialist)
may dispatch **Runner and Verifier only**, within the scope of their own order, with a fan-out
cap of 4 concurrent. Runners and Verifiers are leaves and may never dispatch. No third level
exists.

*Why permit any nesting at all, when the current harness permits none* (`disallowedTools: Agent`
on every executor)? Because the alternative is that every parallel leg of a sweep, every
parameter matrix and every repeat-run round-trips through the Conductor, which converts the
system's cheapest work into its most expensive coordination. The five roles that may nest are
exactly the ones whose orders are naturally wide, and the two roles they may nest *to* are
exactly the ones with no judgment authority — so nesting can multiply throughput and cannot
multiply decisions.

*Why the cap is 4.* Three converging reasons: parallel subagents are the fastest route to a
subscription cap (a three-agent team measured at roughly 7× a normal session's tokens); one
subscription-backed agentic CLI's own guidance is to hold 3–5 parallel subagents on paid tiers;
and one runtime's subagent extension caps parallel dispatch at 8 with 4 concurrent, which is
independent evidence that 4 is a sane concurrency point rather than an arbitrary one. Total
in-flight agents across the whole system is capped at 8 for the same reason.

### 3.2 What stays with the Conductor, permanently

Intake and done-criteria; task classification; casting decisions; work-order authorship;
verdict arbitration; irreversible-action **gating**; user communication; the plan file; the
ledger; and the decision to stop. Nothing on that list is delegable, because each of them is a
place where delegating would either hide a decision from the user or let a worker approve its own
work.

**One item is deliberately *not* on that list, and the draft put it there.** Irreversible-action
*authorization* does not stay with the Conductor, because it was never the Conductor's to hold.
The Conductor's non-delegable duty is to **gate**: to classify the action, to assemble and
validate the authorization packet, and to refuse dispatch without it. Signing a Class-3 action —
production data mutation, credential movement, external release — is a human's, and no model in
this architecture has a path to it. §3.6 defines the ladder; the distinction matters because
"the Conductor approves irreversible actions" is exactly the sentence an implementer reads as
"the model can approve production changes."

### 3.3 The cross-family mandate, stated as policy

**The set below is fixed at design time. It is not a function of allowance, plan tier, deadline
or session state**, and no rung of the degradation ladder edits it. That property is the whole
point: a mandatory review that can be relaxed when it is expensive is relaxed exactly when the
system is under the pressure that produces defects. What a small or exhausted pool changes is
*how much gated work a week can hold*, never the standard each piece of it must meet.

| Class of work | Cross-family review | Cost of the mandate | If the other pool is unavailable |
|---|---|---|---|
| Data and schema changes; anything irreversible | **Mandatory** | +1 engine spin-up (minutes); a full verification run on the other pool | **Does not close.** Wait, human expert review, or park unmerged |
| Security-relevant changes | **Mandatory** | as above, plus Red Team is itself a second seat | as above |
| Principal-tier work (hard cores, cross-subsystem) | **Mandatory** | as above; this is where correlated blind spots are most expensive | as above |
| Integration gates and a chain's final review | **Mandatory** | as above, once per chain rather than per leg | as above |
| Comparative adjudication: the opposite-family challenge passes (A3 stage 2) | **Mandatory** | two challenge passes, one per pool, plus composition | as above; an unchallenged position is not merged |
| Any change authored at a ceiling casting | **Mandatory** | as above | as above |
| Gate-class Detective CONFIRMED verdicts (B4 check 3) | **Mandatory** | one Detective-class call on the other pool | verdict stands as LIKELY, not CONFIRMED, and cannot authorize gate-class work |
| Routine Builder rounds with full deterministic coverage | *Preferred* | may degrade to fresh-context same-family + Verifier, with `review.cross_family = false` set by the dispatcher | degraded path permitted, disclosed by schema field |
| Test-only changes passing a mutation check | *Preferred* | as above | as above |
| Documentation (non-deliverable-grade) | *Preferred* | as above | as above |
| Provably inert changes (formatting, comments) | Not required | inert tier: lint plus targeted checks, verified inert from the diff first | unaffected |
| **Same-instance review of any kind** | **Forbidden, always** | — | no exception exists |

**"Does not close" spelled out, because a rule with no operational meaning is decoration.** Three
lawful outcomes, in order of preference: (1) **wait** for the other pool's reset, which the
Quartermaster can date, and tell the user the wait and its reason; (2) **named human expert
review**, recorded in the ledger with the reviewer's name and what they checked — a human is not
in either model family, so this satisfies the de-correlation requirement rather than evading it;
(3) **park unmerged** on its branch with a `HOLD: cross-family review unavailable` marker, so the
work is not lost and cannot be mistaken for reviewed. What is *not* available is a fourth
outcome where the change ships behind a disclosure.

The latency cost is real and should be stated in operational terms rather than abstractly: a
cross-vendor review in this repository's own implementation carries a 600 s default wall-clock
cap and an execution cap of 1800 s, and the pack's field-validation notes describe real reviews
as "minutes to tens of minutes," with 1800 s blocking calls proven and nothing longer proven.
A mandate is therefore worth roughly one engine spin-up plus one full verification run of
wall-clock, per gated change.

### 3.4 Order and report contracts

Every dispatch carries the same envelope, and every report answers it. Contracts, not prose,
are what let a role be re-cast to another vendor without rewriting anything.

**Order:** `task_id · role · requested_casting(vendor, model, effort) · goal · scope(paths) ·
constraints · context_packet · context_shape · acceptance_criteria ·
verification_tier(full|inert) · tool_budget · escalation_conditions · report_format ·
irreversibility_class(1|2|3) · review_mandate(mandatory|preferred|none)`.

**Report:** `status(DONE|PARTIAL|BLOCKED|CHECKPOINT) · changes(path:line) · verification(command
→ actual output) · deviations · concerns · requested_casting · served_model(where exposed;
UNKNOWN otherwise) · integrity(nonce echo, tree audit where applicable)`.

**Verdict:** `verdict(APPROVE|REVISE) · findings([CRITICAL|MAJOR|MINOR] path:line — defect —
concrete failure scenario) · claims_checked(claim → CONFIRMED|REFUTED|UNVERIFIED, how) ·
review.cross_family(bool, set by the dispatcher from the dispatch record, never asserted by the
reviewer) · nits`.

**Authorization packet** (Class 2 and 3 only): `action · irreversibility_class · dry_run_result ·
rollback_script · rollback_restore_test_result · invariant_comparison(pre → post) · blast_radius ·
approver(role or named human) · approved_at`. It is a schema of its own rather than a section of
the order, because it is the artifact a human reads before signing and it has to be readable
without the rest of the order.

These are deliberately close to the shapes this repository already uses
(`agents/executor.md`, `agents/reviewer.md`, `agents/detective.md`) — the formats are good, they
are already field-tested, and gratuitous change would cost migration effort for nothing. The
additions are `requested_casting` / `served_model`, `context_shape`, `irreversibility_class`,
`review_mandate`, `tool_budget`, the integrity block, the dispatcher-set `review.cross_family`
flag, and the authorization packet — nine fields and one new schema, each of which exists because
some rule elsewhere in this document would otherwise be enforced only by memory.

### 3.5 Sticky vendor, fresh reviewer

Within one task, keep the executing vendor sticky: a mid-task switch invalidates the prompt
cache and re-bills the context. Hand-offs pass `goal, constraints, files touched, tests,
failures` — never a raw reasoning transcript. The Reviewer is exempt because it receives a fresh
packet by design; its cache was never going to be warm, so cross-vendor review costs nothing in
cache terms that fresh-context review does not already cost. That is a small but real part of why
the de-correlation mandate is cheaper here than it looks.

### 3.6 The irreversibility ladder and who may authorize what

The draft assigned "irreversible-action approval" to the Conductor in one place, required
"Conductor approval" before a data apply in another, and escalated "Conductor → user for any
irreversible step" in a third. Those are three different policies and an implementer would have
had to pick one. This section is the single definition; every role contract points here.

**Classification is a property of the action, decided at PLAN time and recorded in the order.**

| Class | What it covers | Undo path | Who may authorize | What must exist first |
|---|---|---|---|---|
| **1 — Reversible** | Anything confined to the working tree or a branch: code, tests, docs, config not yet deployed, local fixtures | `git` | The Conductor, implicitly, by dispatching the order | Nothing beyond the ordinary order |
| **2 — Recoverable at a cost** | Non-production data with a backup; force-pushes to shared branches; cache and index rebuilds; dependency upgrades that pin transitively; anything whose undo is possible but manual | A rehearsed procedure | The **Conductor**, explicitly, as a separate gate between "prepared" and "applied" | Authorization packet (§3.4) with a *tested* rollback restore; Verifier invariant comparison |
| **3 — Irreversible** | Production data mutation or deletion; schema changes against live data; credential creation, rotation or movement; outbound communication; publishing a release or package; anything with a blast radius outside the repository | None, or none that restores state | A **named human**, recorded in the ledger with a timestamp | Authorization packet, tested restore where any exists, a cross-family Reviewer APPROVE (mandatory class, §3.3), and an explicit statement of what cannot be undone |

**Four rules that make the ladder mean something.**

1. **No model authorizes Class 3, including the Conductor.** The alignment measurement that
   decides *who prepares* a destructive migration (P11) is evidence about a worker's disposition;
   it is not consent, and a design that lets a low misaligned-behaviour score stand in for a human
   signature has confused a benchmark with an authority. Where no human is available, Class-3 work
   waits. "The Conductor approved it" is not a defence and is not a state the ledger can record.
2. **Classification is conservative and is not the worker's to make.** If the class is arguable,
   it is the higher class. A worker that discovers mid-order that an action is a class above its
   authorization returns `BLOCKED: irreversibility class exceeded`, which is a successful outcome
   and never a failure; proceeding on a self-reclassification is the single most serious contract
   violation an authoring seat can commit.
3. **Preparation and application are always separate orders.** A Class-2 or Class-3 apply is never
   the tail of the order that authored the migration, because the packet has to be readable by
   someone who did not write it. This is the sizing law (P14) applied where it matters most.
4. **The dry run is not optional and its output is evidence, not narration.** A Class-2 or -3
   packet without a dry-run result, or with one the Verifier cannot reproduce against a copy, is
   incomplete; the gate rejects it without spending a Reviewer.

**What the ladder costs.** One extra order boundary and one human wait per Class-3 action. That is
the correct price: Class-3 actions are rare by construction in a well-decomposed plan, and the
alternative — a model closing a production migration on its own judgement — is the one failure in
this architecture that no later review can repair.
---

## 4. Routing table

Twenty-four task classes; **each has exactly one primary role, and each role's catalog entry
names the same class identifiers this table does.** The draft failed that property in four
places — the Conductor and the Architect both claimed T22, the Synthesizer and the Quartermaster
both claimed T24, the Architect's catalog entry said T22 where this table said T8, and T23 named
three roles instead of one — and an implementer building a dispatcher from those two sources
would have produced contradictory routes. The identifiers are now single-sourced: **T8 Architect,
T22 Conductor, T23 Synthesizer, T24 Quartermaster**, with contributing roles named as *inputs*
rather than co-owners. A role that contributes evidence or drafts to a class does not own it; the
role accountable for the class's deliverable does.

The **signals** column is what an orchestrator matches against — this is the column that makes
casting *nuance-matched* rather than generic, and it is written so that a request phrased in a
user's words lands somewhere specific. Where two classes could plausibly match the same words,
§4.1 gives the exclusive discriminator, and the signals column points at it. Reviewer entries name
the *rule*, since the casting is computed from the author.

| ID | Task class | Signals that select it | Primary role | Primary casting | Reviewer | Escalation path | Explicitly not |
|---|---|---|---|---|---|---|---|
| T1 | Routine coding | "implement", spec exists, scope is known, tests exist or can | **Builder** | Sonnet 5 · med / Terra · med | cross-family, preferred | 2 REVISE or CHECKPOINT → Principal → re-plan | Principal (over-spend), Runner (open-ended) |
| T2 | Terminal / shell ops | build breaks, CI red, toolchain, container, packaging — *and* the environment is the variable (§4.1-A) | **Operator** | Sol · high | cross-family; mandatory if irreversibility class ≥ 2 | Sol · max → Opus 5 · high (order under trial, Step 11e) → re-plan | Runner (env fights back), Builder (not code), Bug Hunter (§4.1-A row 2) |
| T3 | Fetch / find / lookup | "where is", "list all", "which files", history | **Pathfinder** | Haiku · off / Luna · low | consumer spot-check | re-probe once → Detective | third scout mission, haystack input |
| T4 | Deep investigation | "why does", "how does X flow", "which impl is load-bearing" — and nothing needs to be run (§4.1-B) | **Detective** | Opus 5 · high | Verifier chain re-run + refutation duty; **cross-family falsification pass mandatory for a gate-class CONFIRMED** | Fable · high → Bug Hunter (needs an experiment) | Pathfinder (causal), Bug Hunter (nothing to run) |
| T5 | Adversarial review | a change exists and must be checked | **Reviewer** | computed by author family | Conductor arbitrates | 2 REVISE → re-plan | same family at gate class, same instance ever |
| T6 | Complex long-horizon coding | interlocked subsystems, hard core, split-resistant | **Principal** | Opus 5 · high (xhigh point) | cross-family, mandatory | Opus 5 · xhigh → Fable · high → re-plan | Builder (mis-sized), a third rung |
| T7 | Intricate bug tracing | intermittent, "sometimes", race, Heisenbug, needs instrumentation — *and* program behaviour is the variable (§4.1-A) | **Bug Hunter** | Opus 5 · high | cross-family on the fix; Verifier on the repro | Fable · high → Architect (it is architectural) | Detective (must run it), Operator (§4.1-A row 1), Builder (cause unknown) |
| T8 | Planning / decomposition | goal without steps, multi-workstream, "how should we" | **Architect** | Fable 5 · high (Opus 5 · high below a Max seat) | cross-family plan critique | ceiling effort → escalate the class to T23 | Conductor authoring big plans itself; Synthesizer authoring an original plan |
| T9 | Visual / UI work | screenshot, mock, layout, viewport, accessibility, "looks wrong" | **Interface Artisan** | Sol · med-high + browser loop | closing casting (Opus 5) + cross-family code review | Fable critic on global coherence | Spatial (2D), Builder (visual acceptance) |
| T10 | Refactoring at scale | rename, API migration, codemod, "everywhere", N consumers | **Refactorer** | Terra · med | Sweeper then cross-family on sample+census | Principal (not mechanical after all) | Principal (over-spend), single mega-order |
| T11 | Test authoring | "add tests", suite repair, fixture, regression pin | **Test Author** | Sonnet 5 · med | Verifier mutation check; same-family review permitted | Principal (untestable as structured) | any seat certifying its own tests |
| T12 | Data / schema work | migration, backfill, ETL, index, "the database" | **Data Engineer** | Opus 5 · high (no mirror for the irreversible half) | cross-family **mandatory** + invariant compare | Principal (hard transform); **§3.6 Class 3 → named human approver** | any cheap tier; any apply lacking its §3.6 authorization |
| T13 | Performance work | slow, latency, memory, profile, regression in timing | **Performance Engineer** | Opus 5 · high | Verifier re-measures; cross-family preferred | Principal (architectural) | optimizing without a baseline |
| T14 | Spatial / procedural code | mesh, shader, scene, CAD, "generates geometry", simulation | **Spatial Specialist** | Opus 5 · high | deterministic geometry checks → Fable critic → cross-family | Fable critic; Architect (parameterization wrong) | Interface Artisan (3D), Builder (invention) |
| T15 | Documentation | README, ADR, changelog, migration guide, API reference | **Doc Writer** | Opus 5 · med (mirror Sol · med; deliverable-grade waits for the primary) | cross-family for accuracy + Verifier claim sample | Fable (deliverable-grade, Max seat only) | Terra/Luna/Haiku (weak prose), inert tier |
| T16 | Security review | auth, crypto, parsing, deserialization, deps, secrets, permissions | **Red Team** | Sol · high | Conductor triage; fix reviewed normally | human (disclosure/legal) | **Fable** (silent classifier fallback), cheap tiers |
| T17 | Post-fan-out sweep | a chain just finished; N legs landed | **Sweeper** | Terra · med | Conductor triage | findings become new orders | the seat that did the fan-out |
| T18 | Deep external research | vendor docs, standards, prior art, "what does X actually do" | **Librarian** | Sol · med | consumer spot-check vs cited sources; dual-lane at gate class | Sol · high; Architect if it changes the plan | Pathfinder (outside world), parametric recall |
| T19 | Document / media intake | PDFs, screenshots, recordings, logs, charts, "read these" | **Archivist** | Gemini 3.7 Flash · low-med *(optional lane; video/audio has no model mirror — deterministic transcode fallback, B3)* | schema validator + consumer | Interface Artisan / Detective / Librarian by kind | any conclusion; any goal held across turns; critical-path dependence |
| T20 | Mechanical batch | sweep, matrix, template, classify N, poll | **Runner** | Luna · low / Haiku · off | parent spot-check + Verifier | 2 failures → parent takes it back | judgment, haystacks, chained steps |
| T21 | Mechanical verification | "did it actually pass", claim check, tree audit, repro re-run | **Verifier** | code first; cheap tier if needed | none (machine-checkable) | failed check returns to author pre-review | issuing verdicts |
| T22 | Direction and arbitration | routing, verdict conflicts, approvals, reporting | **Conductor** | Opus 5 · med | user; bounded by the no-overturn rule | user decision | self-authorizing past a gate |
| T23 | Comparative adjudication | framing itself is uncertain; high-stakes approach choice; two credible incompatible plans exist | **Synthesizer** | Fable · xhigh, or Opus 5 · high, or Sol · max | opposite-family challenge of every contested position (A3 stage 2), **mandatory** | unresolved contests → OPEN DECISIONS → user; >4 → re-plan the framing | one lane presented as two; the Synthesizer authoring original positions; any model judging its own family's position |
| T24 | Allowance accounting | pool state, throttle prediction, cost reporting | **Quartermaster** | code + cheap tier | reality (predicted vs observed) | Conductor re-plans the session shape | routing decisions |

**Reading the table under pool pressure.** Most "primary casting" cells have a mirror in §2; three
declare a no-mirror exception instead (P2: Archivist video/audio, the Data Engineer's irreversible
half, and Doc Writer's deliverable-grade output). The router substitutes the mirror when the
Quartermaster reports the relevant **bucket** — not vendor — below its reserve threshold (§5.2a),
and there are exactly two lawful outcomes where no substitution is available: the work **waits**,
or it takes the declared deterministic/human fallback for that exception. What the router may not
do is substitute in a way that would close a **mandatory** gate same-family; that path was removed
in this revision and no longer exists at any rung of §5.6.

### 4.1 Exclusive discriminators

Done-criterion 2 requires every named class to have one *obvious* primary. Ten of the twenty-four
are obvious from the signals alone. The rest have a neighbour close enough that a request phrased
in a user's words could match both, so each adjacent pair gets a single test whose answer decides
the route. These are written as questions with binary answers, because a discriminator an
orchestrator has to weigh is not a discriminator.

| # | Pair | The one question | Answer → route |
|---|---|---|---|
| A | **Operator (T2)** vs **Bug Hunter (T7)** | What changes when you change one thing? | Same commit passes in env X, fails in env Y → **Operator**. Same commit fails intermittently in one env (order, seed, timing, concurrency) → **Bug Hunter**. Unknown → **Operator triages, ≤15 tool calls, delivers the environment matrix**, then owns or hands over |
| B | **Detective (T4)** vs **Bug Hunter (T7)** | Does the next step require running or instrumenting the system? | No → **Detective**. Yes → **Bug Hunter**. A Detective that concludes "we must run an experiment" has finished its case correctly and hands over |
| C | **Pathfinder (T3)** vs **Detective (T4)** | Is the answer a location or a cause? | "Where / which files / list all / when did it change" → **Pathfinder**. "Why / how / which of these is load-bearing" → **Detective**. A Pathfinder UNKNOWN surviving one re-probe becomes a Detective case; never a third Pathfinder mission |
| D | **Pathfinder (T3)** vs **Librarian (T18)** | Can the repository settle it? | Yes → **Pathfinder**. No, it needs the outside world → **Librarian** |
| E | **Librarian (T18)** vs **Archivist (T19)** | Is the corpus already in hand? | The corpus must be *found* → **Librarian**. The corpus is named and fixed, and the job is faithful extraction → **Archivist** |
| F | **Builder (T1)** vs **Principal (T6)** | Could a competent worker finish this in one run with the spec as written? | Yes → **Builder**. No, because the parts are interlocked and splitting loses the whole-system view → **Principal**. "It is big" is not an answer; big-and-separable is a chain of Builder orders |
| G | **Principal (T6)** vs **Refactorer (T10)** | Is the risk a wrong line or a missed site? | Wrong line (semantics are changing) → **Principal**. Missed site (semantics are constant, breadth is the problem) → **Refactorer** |
| H | **Refactorer (T10)** vs **Data Engineer (T12)** | Does any persisted data change shape or content? | No → **Refactorer**. Yes → **Data Engineer**, even when the code change is trivial: the class is defined by consequence, not difficulty |
| I | **Interface Artisan (T9)** vs **Spatial Specialist (T14)** | Is the output laid out in a document flow, or generated as geometry? | Document/DOM/native-widget flow → **Interface Artisan**. Meshes, shaders, scenes, simulation → **Spatial Specialist** |
| J | **Bug Hunter (T7)** vs **Performance Engineer (T13)** | Is the complaint "wrong" or "slow"? | Wrong (including wrong-only-sometimes) → **Bug Hunter**. Slow, with correctness intact → **Performance Engineer**. Slow *because* something is wrong → Bug Hunter first; optimization does not begin until the defect is out |
| K | **Reviewer (T5)** vs **Red Team (T16)** | Is the question "is this change correct?" or "how would an attacker use it?" | Correctness, maintainability, contract adherence → **Reviewer**. Exploitability, threat surface, dependencies, secrets → **Red Team**. Both, on a change that touches the security-relevant list → both, in that order |
| L | **Reviewer (T5)** vs **Verifier (T21)** | Does answering require judgement? | No — a command, an exit code, a diff comparison, a fingerprint → **Verifier**. Yes → **Reviewer**. The Verifier always runs first; a red suite must never cost a Reviewer |
| M | **Sweeper (T17)** vs **Reviewer (T5)** | Is the question completeness or correctness? | Did the fan-out miss a site → **Sweeper**. Is what landed right → **Reviewer**. They run in that order and are never the same instance |
| N | **Runner (T20)** vs **any authoring seat** | Is every step, input and acceptance test named in advance? | Yes, and the work is repetition → **Runner**. Anything open-ended, any judgement, any haystack → the owning seat |
| O | **Architect (T8)** vs **Synthesizer (T23)** | Does a plan exist yet? | No, or one plan needs authoring → **Architect**. Two credible incompatible plans exist and must become one → **Synthesizer** |
| P | **Conductor (T22)** vs **Architect (T8)** | Is the output a routing decision or a plan? | Which role, which casting, which verdict wins, what to tell the user → **Conductor**. Sequenced steps with acceptance criteria and risk ordering → **Architect** |
| Q | **Doc Writer (T15)** vs **Architect (T8)** | Is the decision already made? | Yes — write it down → **Doc Writer**. No — the document *is* the decision → **Architect**. An ADR that decides is planning wearing a document's clothes |

**Test R — the residual rule.** If a request still matches two primaries after the table above,
that is a *classification* defect, not an operator failure: route it to the cheaper of the two,
cap the order at a triage budget, and log the ambiguity against the pair. Three logged ambiguities
on one pair force the boundary to be redrawn or the two roles merged (R2). Step 6 measures this
before the roster is staffed; the ledger measures it forever afterwards.

---

## 5. Cost model — denominated in subscription allowance

### 5.1 What is actually scarce

Under subscription access there is no bill; there are three independent, rate-limited pools that
refill on their own schedules, and the failure mode is not an invoice, it is a stall.

**Anthropic pool (Claude Code subscription) — modelled per *bucket*, not per vendor.** The draft
treated this as one pool. It is not, and the difference is load-bearing. On Max plans there are
**two weekly limits running at once**: one across all models combined, and a second that caps
Opus specifically; both sit on top of a rolling five-hour window whose reset time is assigned per
account. Two consequences follow that a single-number model cannot express:

- **Sonnet-tier work and Opus-tier work do not compete for the same headroom on Max.** A heavy
  week of Builder rounds does not, by itself, price a Principal order out of the week. On Pro,
  where the buckets are shared, it does — so the same architecture has a materially different
  cost profile on the two plan tiers, and the degradation ladder has to read the bucket rather
  than the vendor.
- **Exhausting the Opus bucket does not raise an error; it silently serves Sonnet** for the
  remainder of the rolling window. That is P13's first mechanism and the reason the Quartermaster
  holds a pre-dispatch gate rather than a dashboard.

Anthropic publishes no exact token quotas for any plan. The plan multipliers are the only
published quantity and the secondary sources disagree about the top tier: one 2026 summary gives
Max $100 ≈ 5× Pro and Max $200 ≈ 10× Pro, against the 5× / 20× figures carried in older material.
*Adjudication:* the conflict is recorded and left open, because nothing in this document depends
on it — it scales how much work a week holds, not which model does which job. Step 1 measures the
real figure for the seat in use and the ledger carries it thereafter.

Usage pools across Claude Code, the chat product and adjacent surfaces, so non-harness use drains
harness capacity. Sub-agents and parallel agents draw from the same buckets: the widely-reported
figure is that **agent teams consume roughly 7× a normal session's tokens**, with the important
qualifier the draft omitted — that figure is quoted for teammates running in plan mode, with
multi-agent workflows generally in the 4–7× band and the experimental multi-session variant near
15× ([Claude Code token limits](https://www.faros.ai/blog/claude-code-token-limits); [why
subagents burn tokens](https://youcanbuildthings.com/articles/claude-code-subagents-token-usage/)).
Fable 5 is included on Max and premium seats **up to 50% of the weekly limit**, drawing from the
same combined bucket ([Anthropic support](https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan)),
and on Pro and standard Team seats it is **not included at all** — it runs on pay-as-you-go
credits, which is a metered path outside this design's deployment basis. Relative draw per
equivalent task, from secondary aggregation and marked as an estimate: **Opus ≈ 5× Sonnet;
Haiku ≈ 0.2× Sonnet**; Fable ≈ 2× Opus per token by list price, hence ≈10× Sonnet as a first
approximation.

**OpenAI pool (Codex on a ChatGPT plan).** A five-hour rolling window plus an unpublished weekly
cap ("additional weekly limits may apply" is the entire published statement); metered by tokens
rather than messages since April 2026. The five-hour window was **removed for Plus, Pro and
Business on 2026-07-12** and **reinstated for Plus in the week of 2026-08-25** — a roughly
six-week policy oscillation inside the window this design was written, and itself a design input
([removal](https://www.eesel.ai/blog/gpt-remove-5-hour-limits);
[reinstatement](https://www.notebookcheck.net/OpenAI-abruptly-restores-harsh-5-hour-Codex-and-Work-limits-for-ChatGPT-Plus.1378377.0.html)).
Sources differ by a day on the reinstatement date; nothing here turns on which. The vendor's own
pricing documentation gives per-window **message ranges** by model, which is the closest thing to
a published allowance in this whole exercise:

| Plan | Sol | Terra | Luna |
|---|---|---|---|
| Plus / Business | 10–100 | 25–200 | 250–2,000 |
| Pro 5× | 50–500 | 125–1,000 | 1,250–10,000 |
| Pro 20× | 200–2,000 | 500–4,000 | 5,000–40,000 |

Those ranges imply a draw ratio of **Sol : Terra : Luna ≈ 20–25 : 10 : 1**. The ranges are wide
precisely because the real meter is tokens: a long, high-effort message costs several ordinary
ones.

**Google pool (Antigravity CLI on a Google AI subscription), optional.** No published per-tier
limits. Tier structure as of the 2026 restructure: AI Pro, a new Ultra tier at $100/month at 5×
Pro, and the top Ultra tier at $200/month at 20× Pro. Practitioner reports describe very fast
exhaustion on paid Pro accounts and the tool's own guidance is to hold 3–5 parallel subagents at
most. Treat this pool as **the smallest and least predictable of the three** and design so that
nothing mandatory depends on it.

### 5.2 A unit that survives the lack of published numbers

Pools do not convert into each other, so a single currency would be a fiction. The model uses
**one unit per pool**, each anchored on that pool's workhorse:

- **1 AU (Anthropic Unit)** = one Sonnet 5 · medium worker turn. Haiku 0.2 AU · Sonnet 1 AU ·
  Opus 5 AU · Fable 10 AU. *(Estimates; provenance and sensitivity in §7.)* AU is written with a
  bucket suffix wherever the bucket matters, because on Max it always does: **AU-S** draws only
  the combined weekly limit; **AU-O** draws the combined limit *and* the Opus-specific limit;
  **AU-F** draws the combined limit against Fable's 50% sub-cap. On Pro the three collapse into
  one bucket, which is precisely why a Pro seat throttles a Principal-heavy week sooner than a
  Max seat with the same total draw.
- **1 OU (OpenAI Unit)** = one Luna · low message. Luna 1 OU · Terra 10 OU · Sol 20–25 OU,
  taken as 22 OU for arithmetic. *(Derived from the vendor's published per-window ranges.)*
- **1 GU (Google Unit)** = one Gemini 3.7 Flash message. No published conversion; used only for
  relative comparison inside the Google pool. *(Assumption.)*

### 5.2a Expressing a draw as a share of allowance — and the reserve thresholds

The draft gave AU and OU totals without saying what they were a share *of*, which left the
degradation ladder's "below reserve" undefined and the quality-per-allowance claim unauditable.
Two fixes, one measurable now and one measurable at Step 1.

**The OpenAI side can be expressed as a share today**, because the per-window message ranges above
are published. In OU, one **five-hour window** holds roughly:

| Plan | Window capacity (OU) | What one ~110 OU gate-class review costs | What one ~330 OU security pass costs |
|---|---|---|---|
| Plus / Business | 250–2,000 | 5–44% of a window | 17% – *exceeds a small window* |
| Pro 5× | 1,250–10,000 | 1–9% | 3–26% |
| Pro 20× | 5,000–40,000 | 0.3–2% | 0.8–7% |

The ranges are wide because the real meter is tokens, so this is a *bound*, not a number: on a
Plus seat a gate-class review can plausibly cost anywhere between a twentieth and nearly half a
window. That range is itself the finding — **a Plus-tier OpenAI seat cannot sustain the mandatory
review set for a busy day**, which is a concrete, checkable statement about who this architecture
suits, and it is why Step 1 is scheduled before anything is built rather than after.

**The Anthropic side cannot, and saying so is more useful than inventing a denominator.** No token
quota is published for any bucket. The model therefore carries capacity as three measured
constants — `C_all`, `C_opus`, `C_fable = 0.5 × C_all` (weekly), plus their five-hour analogues —
and every share is written as a fraction of those. Step 1's whole purpose is to fill them in for
the seat in use; until it does, Anthropic-side shares in §5.3 are expressed in AU and compared to
each other, never to an imagined ceiling.

**Reserve thresholds, defined numerically so the router is implementable.** A bucket's state is
its *predicted* remaining fraction at the current burn rate, published by the Quartermaster and
evaluated per bucket, not per vendor:

| State | Remaining fraction of the bucket | What the router does |
|---|---|---|
| **Green** | ≥ 40% | Full architecture; primary castings |
| **Amber** | 20% – 40% | Authoring re-casts to the healthy pool's mirrors; review unchanged |
| **Orange** | 8% – 20% | Authoring on this bucket suspended; ceiling seats deferred; only review, verification and in-flight completion draw from it |
| **Red** | < 8%, or a hard throttle observed | **Reserve.** Only calls that close an already-authored change may draw from this bucket |

**The reserve is the larger of 8% of the bucket and the measured cost of two gate-class reviews.**
That second term is what makes it a reserve rather than a round number: its purpose is to
guarantee that work already authored can still be *reviewed*, because an unreviewable change is
worse than an unstarted one. Where Step 1 has not yet measured the review cost, 8% stands alone
and is deliberately conservative. Thresholds are configuration, not architecture: a project that
measures its own burn may move them, and the ledger's predicted-versus-observed throttle metric
says whether the move was right.

Two multipliers apply on top of the per-call weight and are frequently forgotten:
**effort** (reasoning tokens are output tokens; a max-effort turn can cost several medium ones)
and **context size** (long inputs bill more; on one vendor, requests above 272K input tokens
bill at a long-context rate for the whole request, and the same shape exists elsewhere). The
second is the real reason the context-shape rule (P6) is a *cost* rule as well as a quality rule.

### 5.3 Rough cost per task class, per round

A "round" is one order plus its verification and review. Figures are order-of-magnitude
estimates from the weights above, assuming a mid-sized order (10–25 worker turns) and one review;
they are for comparing classes against each other, not for predicting a bill. **All twenty-four
classes are costed** — the draft covered thirteen, which made the architecture's own
quality-per-allowance claim unauditable for the eleven it skipped and left an implementer to
invent the missing policy. The right-hand column expresses the OpenAI side as a share of one
five-hour window on a **Plus** seat (the tightest supported plan, from §5.2a's published ranges)
because that is the number that decides whether a day's work fits; Anthropic-side shares are
withheld pending Step 1's measurement of `C_all` and `C_opus`, per §5.2a.

| ID | Task class | Author draw | Verifier | Reviewer draw (other pool) | Total, by bucket | OU share of one Plus window |
|---|---|---|---|---|---|---|
| T1 | Routine coding | 10–25 AU-S | ~1 OU | ~110 OU (Sol · high) | ~20 AU-S + ~110 OU | 5–44% |
| T1b | Routine coding, budget casting | 10–25 OU (Luna·max) | ~0.2 AU-S | ~25 AU-O (Opus review) | ~25 OU + ~25 AU-O | 1–10% |
| T2 | Terminal ops | 220–550 OU (Sol · high) | ~0.2 AU-S | ~25 AU-O | ~400 OU + ~25 AU-O | 20% – *over a small window* |
| T3 | Fetch / find / lookup | 0.2–1 AU-S *or* 1–3 OU | — | consumer spot-check | negligible | <1% |
| T4 | Deep investigation | 50–100 AU-O | ~1 OU (chain re-run) | 0, or ~110 OU when gate-class (falsification pass) | ~75 AU-O + 0–110 OU | 0–44% |
| T5 | Adversarial review | — | — | the reviewer *is* the cost; see each row | one bucket only, always the author's opposite | as per row |
| T6 | Complex long-horizon | 75–150 AU-O | ~1 OU | ~110 OU | ~100 AU-O + ~110 OU | 5–44% |
| T6c | T6 at the Fable ceiling | 150–300 AU-F | ~1 OU | ~110 OU | ~200 AU-F + ~110 OU | 5–44% |
| T7 | Intricate bug tracing | 50–150 AU-O | ~1 OU (repro re-run) | ~110 OU | ~100 AU-O + ~110 OU | 5–44% |
| T8 | Planning / decomposition | 100–200 AU-F (60–120 AU-O on Pro) | — | ~110 OU (plan critique) | ~150 AU-F + ~110 OU | 5–44% |
| T9 | Visual / UI work | 110–220 OU (Sol · med–high, browser loop) | deterministic a11y + visual diff ≈ 0 | closing casting 25–50 AU-O, then ~25 AU-O code review | ~165 OU + ~60 AU-O | 8–66% |
| T10 | Refactoring at scale | 30–80 OU (Terra · med) | ~1 OU (census re-run) | Sweeper 20–50 OU **+** ~35 AU-O (sample + census) | ~90 OU + ~35 AU-O | 5–52% |
| T11 | Test authoring | 8–20 AU-S | ~1 OU (mutation check) | ~5 AU-S (same-family permitted when the mutation check passes) | ~19 AU-S + ~1 OU | <1% |
| T12 | Data / schema work | 75–150 AU-O | ~1 OU + deterministic invariant compare | ~110 OU (**mandatory**) | ~100 AU-O + ~110 OU | 5–44% |
| T13 | Performance work | 50–100 AU-O | ~2 OU (independent re-measure, both sides) | ~110 OU (preferred; mandatory if concurrency) | ~75 AU-O + ~110 OU | 5–44% |
| T14 | Spatial / procedural | 75–150 AU-O | deterministic geometry checks ≈ 0 | triage 1–5 GU/OU → Fable critic 50–100 AU-F *when flagged* → ~110 OU code review | ~110 AU-O + ~75 AU-F (rare) + ~110 OU | 5–44% |
| T15 | Documentation | 10–25 AU-O | ~1 OU (claim sample) | ~110 OU (accuracy against the diff) | ~18 AU-O + ~110 OU | 5–44% |
| T16 | Security review | 220–440 OU (Sol · high–max) | reproduce-or-not ≈ 0 | Conductor triage; the fix is reviewed as an ordinary change | ~330 OU | 17% – *over a small window* |
| T17 | Post-fan-out sweep | 20–50 OU (Terra · med) | — | Conductor triage | ~35 OU | 2–14% |
| T18 | Deep external research | 110–330 OU (Sol · med) | — | consumer spot-check; **dual-lane at gate class adds ~50 AU-O** | ~220 OU (+~50 AU-O at gate class) | 11% – *over a small window* |
| T19 | Document / media intake | 5–30 GU | schema validator ≈ 0 | consuming role | ~15 GU; **or** ~50 OU / ~10 AU-O on the mirrors; video/audio adds local transcode compute only | 0% (Google lane) / 3–20% (mirror) |
| T20 | Mechanical batch (×10 legs) | 2 AU-S *or* 10 OU | ~1 OU | parent spot-check | negligible | <1% |
| T21 | Mechanical verification | ~0 (code) to ~1 OU | *is* the Verifier | none (machine-checkable) | negligible | <1% |
| T22 | Direction and arbitration | 5–15 AU-O per session, amortized across every order in it | — | the user; the no-overturn rule | ~10 AU-O / session | 0% |
| T23 | Comparative adjudication | ~150 AU-F (Anthropic architect lane) + ~220 OU (OpenAI architect lane) + ~50 AU-F (composition) | contest-ledger checks ≈ 0 | 2 opposite-family challenges: ~110 OU **and** ~40 AU-O | ~200 AU-F + ~40 AU-O + ~330 OU | 17% – *over a small window* |
| T24 | Allowance accounting | ~0 (deterministic) + ~1 OU for summarization | reality: predicted vs observed | — | negligible | <1% |

**Reading the right-hand column.** "Over a small window" is not a rhetorical flourish — it means
the class cannot complete inside one five-hour Plus window at the pessimistic end of the published
range, and must therefore be scheduled against the weekly cap rather than the rolling one. Four
classes are in that condition on a Plus seat (T2, T16, T18, T23), and all four are classes this
architecture already treats as rare. On Pro 5× and above, none are.

Four things fall out of the table immediately:

1. **The evidence and mechanical bands round to nothing.** Lookups, sweeps, batch runs and
   verification together are a rounding error against a single frontier review. This is why
   fanning out reconnaissance freely is correct and why a Verifier pass before review is nearly
   free money.
2. **Review is the single largest recurring line item** — often larger than authorship for
   routine work. That is intentional (verdict quality is what the system optimizes) and it is
   the reason the *pool* it lands in matters so much.
3. **The ceiling seats are affordable only because they are rare.** A Fable planning round is
   worth roughly six routine Builder rounds of Anthropic allowance, and the 50% weekly sub-cap
   means it competes with itself. Two comparative adjudication sessions in a week on a Max seat is
   a material fraction of that week — a real constraint, not a rhetorical one, and the reason §6
   reserves them for genuine framing uncertainty.
4. **The bucket split changes which pressure is real.** On a Max seat, the AU-S column (T1, T11,
   T20) and the AU-O column (T4, T6, T7, T12, T13, T15, T22) drain *different* limits, so a
   Builder-heavy week does not price out a Principal order and vice versa. On a Pro seat they are
   one bucket and they do. The single most useful cost lever available to a Pro-seat operator is
   therefore not a cheaper model — it is moving authorship to the OpenAI pool for a day, which
   the mirror castings make a one-line change (P2).

### 5.4 Where the savings come from

- **Volume runs on the cheap band.** Every locate, enumerate, sweep, batch, poll and mechanical
  check leaves the frontier seats entirely. Measured basis: the cheap tiers score within a few
  points of flagships on well-defined work (SWE-bench Pro 62.7 vs 64.6 across a 25× price range)
  and collapse only on open-ended work, which the contracts forbid them.
- **Round-count reduction, which is the dominant lever.** Verification is paid at least twice per
  round; cutting a round saves more than any per-call substitution. Everything in the sizing
  rules — one deliverable kind per order, split triggers, risk-first probes, self-validating
  tools, cadence clauses — is a round-count intervention (P12).
- **A cheap gate before an expensive one.** The Verifier turns "the suite was red" from a full
  frontier review into a rounding error. On a project with a flaky suite this alone can be the
  largest single saving in the model.
- **Effort discipline.** Defaults are medium, not high; `max` appears on exactly two seats
  (Synthesizer, and the Builder budget casting) and nowhere on a routine lane.
- **Effort as a substitute for tier.** The Luna-max budget casting, if the trial holds, buys
  routine authorship at roughly one-fourteenth the cost per task of a flagship — inside the
  OpenAI pool, which is exactly the substitution you want when the Anthropic pool is the one
  under pressure.
- **Pushing inspection below generation.** In produce-inspect-adjust loops (rendering, procedural
  output, UI), inspection runs at Runner/Archivist rates and escalates only ambiguous frames.
  The current roster has no seat for this and pays flagship rates for looking at pictures.
- **Not spending capability the task cannot use.** Tests, sweeps, documentation drafts and
  extraction have explicit acceptance criteria; a ceiling model cannot convert extra capability
  into a better outcome there. The one exception, stated for honesty, is documentation, where
  the cheap tier is a false economy for quality reasons rather than capability reasons.

### 5.5 What the cross-vendor mandates add back — and give back

**They cost:** one extra engine spin-up per gated change (minutes of wall-clock; this
repository's own implementation budgets 600 s for a review and 1800 s for an execution, and its
field notes describe real reviews as minutes to tens of minutes); one full independent
verification run; and no prompt-cache reuse — though that last cost is inherent to *fresh-context*
review and is not an extra charge for crossing vendors, since a fresh reviewer's cache was never
warm.

**They give back, and this is the finding.** Under separate pools, a cross-family review moves
the entire second verification pass onto a *different meter*. Concretely: a routine Builder round
authored on Anthropic costs ~20 AU; reviewing it same-family would add ~25 AU (Opus), a **125%
increase in Anthropic draw**. Reviewing it cross-family costs ~110 OU and adds **zero** Anthropic
draw. The pool that is throttling is the one you stop spending on.

So the de-correlation mandate is not merely a quality decision that costs money. Under this cost
basis it is *also* the load-balancing mechanism, and the two motivations point the same way. Two
consequences follow for the design:

1. **Balance authorship across pools deliberately, not accidentally.** If all authorship is
   Anthropic and all review is OpenAI, the two pools drain at very different rates and the system
   throttles on whichever fills first. The router should alternate the *authoring* pool across
   independent orders, which automatically alternates the reviewing pool.
2. **The mandate is what makes a two-pool system last roughly twice as long as a one-pool
   system** — not because the work is cheaper, but because it is spread. That is the strongest
   argument for cross-vendor operation under subscription access, and it does not appear in any
   of the three supplied reports because all three reason in per-token API terms.

### 5.6 Degradation ladder

Rungs are evaluated **per bucket** (§5.2a: `AU-all`, `AU-opus`, `AU-fable`, `OU`, optionally
`GU`), not per vendor, and taken in order. The Quartermaster publishes the state; the Conductor
announces the rung to the user whenever one is entered, because a degraded system that looks
healthy is the failure this ladder exists to prevent. **No rung edits the mandatory set in
§3.3** — the ladder changes what the system *attempts*, never the standard a completed change
must meet.

1. **Green — every bucket ≥ 40%.** Full architecture; mandates as written; primary castings.
2. **Amber — a bucket at 20–40%.** Re-cast authoring roles that draw on it to the healthy pool's
   mirrors, per role (a stressed `AU-opus` moves Principal and Bug Hunter but leaves Builder
   alone, because Builder draws `AU-S`). Review continues cross-family even though it now lands
   on the stressed pool: review is the last thing to sacrifice, and it is one call per change
   rather than twenty. **P13 gate arms here:** below 40% on `AU-opus`, no Opus casting is
   dispatched without the Quartermaster's confirmation, because the failure past that boundary is
   silent substitution rather than refusal.
3. **Orange — a bucket at 8–20%.** Suspend that bucket's *authoring* entirely; keep only its
   review, verification and in-flight-completion calls. Defer ceiling seats (`AU-F` work stops
   first). Increase Verifier reliance so fewer changes reach a Reviewer at all. Batch same-kind
   small changes into single review passes — never heterogeneous ones, which is where review
   depth collapses.
4. **Red — a bucket below reserve (< 8%, or a hard throttle observed).** Only calls that close an
   already-authored change may draw on it. Cross-family review in the direction that needs this
   bucket is now impossible, and the consequence divides by class:
   - **Mandatory classes (§3.3): the change does not close.** Three lawful outcomes and no
     fourth: **wait** for the reset (the Quartermaster can date it), take a **named human expert
     review** recorded in the ledger, or **park unmerged** with a `HOLD: cross-family review
     unavailable` marker. The draft offered a fourth — proceed same-family with a disclosure —
     and that option is removed. Disclosure describes a property; it does not create one, and a
     Principal-tier, data, security or integration change closed on a correlated verdict is
     exactly the outcome the architecture exists to prevent. Note that the cheap path is
     genuinely cheap: parking costs nothing and the reset is measured in hours.
   - **Preferred classes: the disclosed degraded path remains available** — fresh-context
     same-family review, mandatory Verifier, and `review.cross_family = false` set by the
     dispatcher and rendered verbatim in the user-facing report. This is the band the brief calls
     "merely preferred", and keeping it is what makes the mandatory set affordable.
   - **Irreversible work of any class waits**, unconditionally, because its reviewer *and* its
     preparer are both un-mirrored by design (§3.6, C7).
5. **Black — every bucket below reserve.** Stop. Report state, remaining work, and dated reset
   times. If the Google lane exists it may carry Archivist and Runner work only; it may not
   review, plan, adjudicate, or author anything on the critical path — its measured profile
   (strong bounded reasoner, weak sustained actor) fits the first two and not the rest, and a
   pool crisis is the worst possible moment to discover that.

### 5.7 The Gemini seat, priced and conditioned

Casting Gemini 3.7 Flash buys three things: a third pool that nothing else can drain; the only
video/audio/PDF intake in the roster; and cheap chart and long-document reading measured at
CharXiv 84.5 / LVBench 85.4 / GDM-MRCR v2 97.0. It costs three things: a new integration
(a launcher plus a runner, mirroring the existing cross-vendor lane), a third set of failure
modes to handle, and an access dependency that is genuinely uncertain.

**The access dependency, stated precisely.** Consumer Gemini CLI OAuth ended 2026-06-18 for
AI Pro, AI Ultra and free tiers; Gemini Code Assist Standard and Enterprise licences were
unaffected. The surviving consumer-subscription path is **Antigravity CLI (`agy`)**, a closed-
source Go binary bundled with Google AI subscriptions, which supports exactly the shape this
harness needs: `agy -p "<prompt>"` for one-shot headless runs, `--model` selection with
Gemini 3.7 Flash among the available models, `--output-format json|stream-json`, permission modes
including `--mode=accept-edits` and `--dangerously-skip-permissions`, and cached credentials from
a single interactive sign-in that headless runs reuse. There is also a keyless CI path via a
Gemini API key — which is the metered path this brief tells us to avoid, so it is a fallback of
last resort and must be flagged if used.

**The unverified part, carried as an assumption.** Google has stated that using *Gemini CLI*
OAuth with third-party software is a policy-violating use case, and that proxying such a token
is a terms violation. Whether the same posture extends to driving `agy` from a harness on the
same machine under the user's own signed-in session **could not be verified from primary
sources** in the time available. This design therefore treats the Gemini lane as: optional,
off by default, never on a mandatory path, and gated behind an explicit terms check as the first
step of its adoption (Work plan step 2). If that check fails, the Archivist and Interface
reference-adherence castings fall back to the mirrors named in §2 and nothing else in the
architecture changes — which is the point of the optional-lane design.

---

## 6. Deltas from the current roster

### 6.1 Kept, unchanged in substance

The two-tier recon split (locate/enumerate versus causal); the read-only law on recon seats; the
one-deliverable-kind sizing rule and its split triggers; cadence clauses (heartbeats, checkpoint
commits, tool-call budgets as health telemetry); the verification tax analysis and the inert
tier with its "verify inertness from the diff first" enforcement; the fresh-context reviewer that
re-runs the tests itself; the report formats; the guard's separation of Director tools from
worker tools; the anonymity and blind-merge law in comparative planning; the "an agent's turn
ends when its report does" rule. These are good and this design inherits them verbatim.

### 6.2 Re-cast

| Current | Becomes | Why |
|---|---|---|
| Director = Fable (MODE A), Opus (MODE B) | **Conductor = Opus 5 · medium**; Fable re-aimed at Architect / Synthesizer / Principal-ceiling | Adjudication 5: alignment and predictability over ceiling for the unreviewed judgment seat; and Fable's 50% weekly sub-cap makes it a rationed resource that orchestration wastes |
| `reviewer` = Opus, always | **Reviewer = computed from author family** | The current pairing reviews Opus-authored heavy work with an Opus reviewer and patches it by convention; making it computed removes the failure mode from human memory |
| `executor-heavy-xhigh` as a separate agent | **an effort point of Principal** | The protocol already says the heavy tier is one tier with two effort points; a duplicate definition invites treating it as an extra escalation rung, which the protocol explicitly forbids |
| `modeler` optional specialist | **Spatial Specialist**, a first-class role at Opus · high | "Code that produces visual output" is a named task class with distinctive failure modes, not a project-specific convenience; and the casting rises from Sonnet because the evidence for that class points at the ceiling band |

### 6.3 Split

| Current | Splits into | Why |
|---|---|---|
| `detective` (read-only, may not run code) | **Detective** (unchanged) + **Bug Hunter** (may instrument, bisect, run) | The current charter forbids the investigator from running the experiment its own hypothesis requires, and the executor has no investigative mandate; intricate bug tracing currently falls between two seats |
| `executor` as the universal author | **Builder, Operator, Refactorer, Test Author, Data Engineer, Performance Engineer, Interface Artisan, Spatial Specialist, Doc Writer** | Nine authoring classes with materially different failure modes, verification shapes and correct castings; one seat cannot state a usable weakness profile for all of them |
| `scout` as all recon | **Pathfinder** (in-tree locate) + **Librarian** (outside world) + **Archivist** (fixed corpus / media) | Different context shapes (`scoped` vs `haystack`), different castings, different failure modes (missed file vs fabricated citation vs misread chart) |
| review as one act | **Verifier** (facts, cheap) + **Reviewer** (findings, frontier) + arbitration (Conductor) | Separates the mechanical from the judgmental and the judgmental from the decisional (P5, P10); makes a red suite cost a rounding error instead of a review |
| `/deep-plan` and `/cross-compare-plan` as separate skills | **one Architect contract with two modes** (harden a framing; compete two framings) plus **Synthesizer** | The roles are identical; only the wave structure differs. One contract, two orchestration patterns |

### 6.4 Merged or retired

| Current | Disposition | Why |
|---|---|---|
| `executor-codex`, `executor-codex-heavy` | **Retired as roles; become mirror castings** of Builder and Principal | A vendor is a casting decision, not a job title; retiring the duplicate roles removes the `executorEngine` fallback logic and the inverted review-pairing rule that exists only because the vendor was baked into the role name |
| `reviewer-codex` | **Retired as a role; becomes the OpenAI casting** of Reviewer | Same reason, and it removes the "add a cross-vendor pass at gates" convention by making cross-family the computed default |
| `architect-claude`, `architect-claude-xhigh`, `architect-claude-max`, `architect-codex` | **Retired as four roles; become castings of Architect** | Effort is a routing argument, not a role. This also fixes the observed defect where the installed `-xhigh` and `-max` variants are `model: opus` while the base is `model: fable`, so raising effort silently changed the model |
| `planner-gpt` + the `/deep-plan` API transport | **Migrated to the Codex-CLI subscription transport** used by every other cross-vendor lane | It is the only lane that requires `OPENAI_API_KEY` and bills per token (`packs/codex/hooks/orchestra-deepplan.js`), which the deployment basis says to avoid unless flagged. Keeping the capability and changing the transport removes the exception |
| The `modeler` specialist template as the extension mechanism | **Kept, narrowed** | Specialists remain the right mechanism for *project-specific* domains (a particular engine's pipeline). They stop being the mechanism for *general* capability gaps, which are now roles |

### 6.5 Added (net new seats)

**Bug Hunter, Operator, Librarian, Archivist, Test Author, Data Engineer, Performance Engineer,
Doc Writer, Interface Artisan, Red Team, Verifier, Sweeper, Quartermaster** — thirteen seats,
each justified in §2 by a task class the current roster cannot route unambiguously and a failure
profile that differs from the seats around it.

### 6.6 Defects this design fixes on the way past

1. **The architect-tier model divergence.** `.claude/agents/architect-claude.md` (`model: fable`)
   against `.claude/agents/architect-claude-xhigh.md` and `architect-claude-max.md`
   (`model: opus`), while master `packs/codex/agents/architect-claude-xhigh.md` is `model: fable`.
   Under the casting model this cannot happen: effort is an argument, and the model is one field
   in one place.
2. **The asymmetric tool surface in comparative planning.** Master Claude architect tiers carry
   no `WebSearch`/`WebFetch`, while the GPT lane runs with `-c tools.web_search=true` from
   `.mcp.json`. Role contracts declare tool *capability classes*, and the comparative-planning
   contract requires **both lanes to receive the identical capability set** — otherwise the
   session measures tool access rather than judgment.
3. **The heavy-tier duplicate definition** (§6.2).
4. **The metered-API exception** in the planning lane (§6.4).

### 6.7 How the transition is made safe

The draft named the retirements and put them after the trials, which was right, and then said
nothing about how the old roster and the new one coexist in between — no aliases, no shadow
period, no kill switch, no restoration procedure. Persisted plans, in-flight orders and the
skills that dispatch by name (`executor`, `reviewer`, `executor-heavy-xhigh`, `architect-claude`,
…) would have broken the moment those names stopped resolving, and the first whole-system failure
would have been discovered after the known-good roster was gone. Five controls close that, and
they are the load-bearing part of Steps 13–15:

1. **An alias layer, shipped before anything is renamed.** Every retired name resolves to its
   successor role plus a casting: `executor → Builder(primary)`, `executor-heavy → Principal(high)`,
   `executor-heavy-xhigh → Principal(xhigh)`, `executor-codex → Builder(mirror)`,
   `executor-codex-heavy → Principal(mirror)`, `reviewer → Reviewer(computed)`,
   `reviewer-codex → Reviewer(OpenAI casting)`, `scout → Pathfinder`, `detective → Detective`,
   `modeler → Spatial Specialist`, `architect-claude* → Architect(casting)`,
   `planner-gpt → Architect(mirror)`, `plan-synthesizer → Synthesizer`. Aliases are declarative
   data, they emit a deprecation line into the ledger when used, and they are the mechanism by
   which a persisted plan written last month still runs.
2. **A shadow period, minimum two weeks or twenty orders.** The new roles run *beside* the old
   ones: new orders route to new roles, the old definitions stay installed and reachable, and the
   ledger records which path each order took. Nothing is deleted while anything still resolves
   through an alias to a definition that has not yet carried an order.
3. **A canary by risk tier, not by volume.** Classes migrate in ascending consequence:
   T3/T20/T21 (evidence and mechanical, no blast radius) → T1/T11/T17 (routine authoring) →
   T2/T6/T7/T10 (hard authoring) → T9/T13/T14/T15/T18 (domain) → T12/T16 (data and security)
   → T8/T22/T23 (orchestration). A class is promoted only when its predecessor tier has run
   clean for the shadow period. Data, security and orchestration migrate last because they are
   the classes where a routing mistake is expensive and the old path is most worth keeping.
4. **A kill switch that is one line and needs no rebuild.** A single configuration flag
   (`roster: legacy | new`) selects which roster the dispatcher uses, evaluated per order. Rolling
   back is flipping it, not reverting commits — which matters because the failure that would
   demand a rollback is most likely to appear mid-session, when a revert is the last thing anyone
   wants to be doing.
5. **A restoration procedure with a named precondition.** Rollback is *required*, not optional, if
   any of these holds during the shadow period: V1's escape rate rises beyond its threshold; V3's
   routing agreement falls below threshold on live traffic; a mandatory-class change closes
   same-family for any reason; or two consecutive sessions hit a bucket-state surprise the
   Quartermaster did not predict. Restoration is: flip the flag, re-run the current order under
   the legacy roster, and file the trigger against the class that caused it. Retirement — actual
   deletion — happens only after V1 and V2 pass on the new roster, which is a change from the
   draft's ordering and the point of this subsection.

---

## 7. Evidence register and number sensitivity

Every casting that hangs on a number, the number, **a resolvable source**, and what would move
it. The draft's version of this table carried a *source class* letter — A vendor, B independent,
C community, D derived — in the column where a citation belonged. That is a confidence
classification, not provenance: a reviser could not reproduce a figure, refresh it, or notice
that two rows were the same measurement under different names. One of them was (rows 1 and 4 of
the draft), and the error survived a full draft because "source class: A" reads like a citation.
This table therefore names the document, section or URL for every load-bearing figure, keeps the
confidence letter as a *second* column rather than a substitute, and marks the figures whose
provenance is genuinely weak as weak rather than as B-tier.

Where a source is one of the three supplied reports, it is named by file and section, because
those files are the exercise's shared ground truth and are byte-identical for any reader.

| # | Number | Value | Resolvable source | Conf. | Casting it supports | What would flip it |
|---|---|---|---|---|---|---|
| 1 | **Terminal-Bench 3.0 = Frontier-Bench v0.1** — one benchmark, two names | Current snapshot: Opus 5 42.7 / Sol 34.6 / Fable 34.0 / Terra 20.8 / Sonnet 14.6 / Luna 14.3 (2026-08-24); a second snapshot 43.5 / 34.6 / 34.1. Report's older snapshot: Sol ~37.5 peak / Fable ~33.7 peak / **Opus 5 43.3 max, 44.4 xhigh** | [benchlm.ai/benchmarks/terminal-bench-3](https://benchlm.ai/benchmarks/terminal-bench-3); rename confirmed at [frontierbench.ai/announcement](https://www.frontierbench.ai/announcement); report figures at `dossier_both.md` §3.2 | B, **scaffold-uncontrolled** | Principal primary = Opus 5 (with rows 4–5). **No longer supports the Operator escalation inversion — withdrawn, Adjudication 1** | A scaffold-controlled re-run (Step 11e). If Opus-in-Claude-Code beats Sol-in-Codex on hard environment tasks, the inversion returns as a casting |
| 2 | Terminal-Bench 2.1 | Sol 88.8 (91.9 ultra) / Terra 87.4 / Gemini 85.8 / Luna 84.7 / Fable 83.1–86 / Sonnet 80.4; Opus 5 unpublished (Opus 4.8 was 78.9) | `dossier_both.md` §3.2 | A/B | Operator primary = Sol; routine shell = Runner | A >5-point separation on a de-saturated re-run |
| 3 | SWE-bench Pro | Fable ~80 / Opus ~79.2 / Sol 64.6 / Terra 63.4 / Sonnet 63.2 / Luna 62.7; OpenAI disputes ~30% of tasks | `dossier_both.md` §3.2 and §1 | A, **disputed** | Principal ceiling = Fable — *sign only, never magnitude* | The sign reversing on rows 4 **and** 5 as well |
| 4 | CursorBench 3.2 | Fable highest peak; Opus 5 within 0.5% at ½ the cost per task; Sol below both Claudes at peak | `dossier_both.md` §3.2 | A | Principal primary and ceiling | Another family taking the peak |
| 5 | Senior SWE-bench | Fable #1 overall; Opus 5 #2 overall, **#1 bug/performance investigation** | `dossier_both.md` §3.2 | B | Detective, Bug Hunter, Performance Engineer = Opus 5 | Opus leaving the top two on investigation specifically |
| 6 | Agent's Last Exam | Sol 53.6 / Terra 50.4 / Luna 50.3 / Fable 40.5 / **Gemini 26.3** | `openai-models.md` §2/§4; Gemini figure from the vendor model card | A (vendor-run) | Cheap tiers viable for scoped workflow tasks; **Gemini barred from every long-horizon seat** | Independent replication showing the ordering is benchmark-specific |
| 7 | MRCR long-context recall | Sol 91.5 / Terra 89.6 / **Luna 41.3** | `dossier_both.md` §1, `openai-models.md` §4.3 | A | The hard context-shape rule (P6); Librarian ≠ Pathfinder; Sweeper on Terra | Luna above ~80 on an independent MRCR → the shape rule relaxes, the roles stay |
| 8 | Haiku 4.5 window / cutoff | 200K / Feb 2025 | `dossier_both.md` §1 | A | Pathfinder receives retrieved windows; no 2025–26 API work | A refreshed Haiku generation |
| 9 | Review parity (105-task suite) | Sol 65 actionable vs rival flagship 66 vs human 66; Sol leads full passes 74–72 | `openai-models.md` §2.4 | B/C | Cross-family review is not a quality downgrade | A >10-point recall gap on a larger suite |
| 10 | METR cheating rate | Highest detected of any public model; 50% horizon ≈11.3 h vs >270 h depending on scoring | `openai-models.md` §2.4 | B | Mandatory Verifier + tree audit + nonce on that lane; Red Team casting | An updated evaluation showing the rate normalized |
| 11 | Alignment audit | Opus 5 lowest misaligned-behaviour score (2.3) | `dossier_both.md` §4.5 | A (vendor's own audit) | Conductor casting; who *prepares* Class-2/3 work (P11) — **not** who authorizes it | Another model measuring lower on the same audit |
| 12 | Orchestrator study | Flagship director + workhorse workers ≈96% quality at 46% cost (BrowseComp) | `openai-models.md` §5 | A (single vendor study, single benchmark) | The whole delegation topology; Builder casting | A replication below ~85% quality retention |
| 13 | Luna at max effort | ≈Sol-medium quality on routine coding; $0.61 vs $8.39/task (13.75×) | `openai-models.md` §4.4, attributed there to community measurement | **C, single-source** | Builder budget casting — gated behind trial V5, never used unspecified | The trial showing >1 extra review round on average, which erases the saving |
| 14 | Codex per-window messages | Plus: Sol 10–100 / Terra 25–200 / Luna 250–2,000; Pro 5× and 20× scale linearly | Vendor pricing documentation, as reproduced in `openai-models.md` | A | The OU weights (≈22 : 10 : 1) and every OU share in §5.2a and §5.3 | A re-published table with different ratios; the meter is really tokens, so treat as a bound |
| 15 | Anthropic relative draw | Opus ≈5× Sonnet per equivalent task; Haiku a small fraction; Fable ≈2× Opus per token by list price | Secondary aggregation: [Claude Code usage limits](https://www.morphllm.com/claude-code-usage-limits), [Claude Code token limits](https://www.faros.ai/blog/claude-code-token-limits) | **C, secondary** | The AU weights | Anthropic publishing actual quotas — which would also make §5 measured rather than estimated |
| 16 | Fable 5 plan inclusion | Max: "up to 50% of your weekly usage limits… at no extra cost", drawing the same limits. **Pro and standard Team: not included; runs on usage credits** | [Anthropic support: Claude Fable 5 on your plan](https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan) | **A, primary** | Fable rationed to Architect / Synthesizer / Principal-ceiling; **every Fable casting conditional on a Max-or-above seat** (Adjudication 5) | Removal of the sub-cap, or inclusion on Pro → Fable widens; latency still bars the Conductor |
| 17 | Anthropic Max bucket structure | A combined weekly limit **plus** a separate Opus-specific weekly limit; on hitting the Opus limit the product **serves Sonnet for the rest of the window** rather than failing. Shared single pool on Pro | Secondary: [Claude weekly limit explained](https://usagebar.com/blog/claude-weekly-limit-all-models-explained), [tokn.watch](https://tokn.watch/blog/claude-weekly-limit/), and a vendor issue tracker thread on the separated limits ([claude-code#55663](https://github.com/anthropics/claude-code/issues/55663)) | **C, secondary, load-bearing** | The per-bucket cost model (§5.2), the reserve thresholds (§5.2a), **P13's pre-dispatch gate**, and the Quartermaster's hard gate | Vendor documentation contradicting the two-bucket structure → §5 collapses to one AU and P13's first mechanism disappears (its second, classifier fallback, does not). This is the weakest link under the heaviest load in the cost model, which is why Step 1 measures it first |
| 18 | Parallel-agent burn | ≈**7×** a normal session for agent teams *with teammates in plan mode*; 4–7× for multi-agent workflows generally; ≈15× for the multi-session variant | [faros.ai](https://www.faros.ai/blog/claude-code-token-limits), [youcanbuildthings.com](https://youcanbuildthings.com/articles/claude-code-subagents-token-usage/) | C (reporting a vendor statement) | Fan-out cap of 4; total in-flight cap of 8 | A measured lower multiplier on *this* harness's fan-out shape → raise the cap. The draft quoted 7× without the plan-mode qualifier, which overstated the routine case |
| 19 | Gemini 3.7 Flash vendor card | AAII 56; DeepSWE 65.3; TB2.1 85.8; **TB3.0 14.9**; FrontierCode 43.6; Code Arena WebDev 1588; CharXiv 84.5; LVBench 85.4; GDM-MRCR v2 97.0; OSWorld 47.9; **ALE 26.3**; cutoff Mar 2026; 1M in / 64K out; native text, image, video, audio, PDF | Google model card / model page for Gemini 3.7 Flash | A (vendor, incl. its own MRCR variant) | Archivist primary; Interface reference-adherence casting; barred from ten seats | Independent evaluation showing the *reading* scores do not replicate → drop the lane. Independent long-horizon parity with Terra → widen the seats |
| 20 | Gemini failure decomposition | Reasoning Deficit 52.1% of failures; Parsing Failure 16.9% | [A Unified Framework for the Evaluation of LLM Agentic Capabilities](https://arxiv.org/pdf/2605.27898) — **subject named "Gemini-3-Flash", plausibly a predecessor revision** | B, **wrong-model risk** | Now supports **only** the mandatory schema validator on Archivist output. **No longer supports a "reasoning deficit" exclusion** — superseded by row 21 | A replication naming 3.7 Flash specifically |
| 21 | Gemini 3.7 Flash, independent reasoning | ARC-AGI-1 semi-private **95.5% at $0.12/task**; ARC-AGI-2 semi-private **84.6% at $0.25/task**, high effort, tested 2026-08-13 | [ARC Prize results](https://arcprize.org/results/google-gemini-3-7-flash) | **B, independent** | Reframes the seat as *bounded reasoner, weak sustained actor*; admits Gemini to the Verifier's model-assisted classification; answers the draft's open question "is there any independent evaluation of this model?" | A finding that ARC performance does not transfer to extraction fidelity — which is why the multimodal claims are still tested at V9 |
| 22 | ARC-AGI-2 comparatives | Sol 92.5% @ $1.44 · Opus 5 90.4% · Terra 83.9% @ $1.09 · Luna 59.6% @ $0.18 · Gemini 3.7 Flash 84.6% @ $0.25 | `openai-models.md` §§2.3, 4.3, plus [ARC Prize](https://arcprize.org/results/google-gemini-3-7-flash) | A/B | The cheap-tier boundary (Luna is two tiers down on novel reasoning, not one); Gemini above Terra per dollar | A re-run collapsing the Luna gap |
| 23 | Gemini access path | Consumer Gemini CLI OAuth ended 2026-06-18; Antigravity CLI (`agy`) is the surviving subscription path: `agy -p`, `--model`, `--output-format json`, cached credentials | Vendor deprecation notice and Antigravity CLI documentation | A/C | The lane is optional and off by default | A terms clarification permitting harness automation → promote to a supported optional pack; a prohibition → drop the lane and use the mirrors |
| 24 | Codex window policy | 5-hour window removed for Plus/Pro/Business **2026-07-12**; reinstated for Plus in the week of **2026-08-25** | [removal](https://www.eesel.ai/blog/gpt-remove-5-hour-limits); [reinstatement](https://www.notebookcheck.net/OpenAI-abruptly-restores-harsh-5-hour-Codex-and-Work-limits-for-ChatGPT-Plus.1378377.0.html) | C (trade press, two independent outlets) | P8: design for degradation, not abundance | Nothing — the oscillation *is* the evidence. Only the dates would move |
| 25 | Sonnet 5 pricing | $2/$10 described as permanent from 2026-08-10 by one source; a rise to $3/$15 from 2026-09-01 reported by another | Conflicting secondary sources; left unresolved | C, **conflicting** | Nothing directly — pricing is only a draw proxy under this cost basis | Resolution matters only if the AU weights are re-derived from list price |
| 26 | Reviewer sandbox default | `ORCHESTRA_REVIEW_SANDBOX` defaults to `workspace-write` — "lets the reviewer actually run the test suite"; `read-only` is a "hard no-write guarantee, but many test runners can't run under it" | This repository: `packs/codex/hooks/orchestra-review.js`; operator symptom in `README.md` ("Reviewer runs but the tests don't execute") | **A, first-hand** | The Verifier's disposable writable checkout (D3) — the draft's "no WRITE anywhere" would have failed closed on ordinary projects | Nothing; it is a direct reading of the reference implementation |
| 27 | Installed-vs-master roster drift | `.claude/agents/architect-claude.md` `model: fable`; `.claude/agents/architect-claude-xhigh.md` and `-max.md` `model: opus`; master `packs/codex/agents/architect-claude*.md` both `model: fable`. Tool surfaces differ too: master architect tiers carry `tools: Bash, Glob, Grep, Read, Write` (no web), while `.mcp.json` launches the counterpart lane with `-c tools.web_search=true` | This repository, read first-hand at v1.11.0 | **A, first-hand** | §6.6 defects 1 and 2; the casting-as-argument design that makes them impossible | Nothing; `.claude/` is untracked, so another machine's install may differ — which is itself the finding |
| 28 | Metered planning transport | The planning counterpart lane posts to `api.openai.com` with `OPENAI_API_KEY` and "the consultation bills to it" | This repository: `packs/codex/hooks/orchestra-deepplan.js` (lines 55, 77–78, 288–289, 349) | **A, first-hand** | §6.4's migration of that lane onto the subscription CLI transport | Nothing; it is a direct reading |

**Sensitivity, stated once rather than per row.** Three numbers, if wrong, change a casting rather
than a magnitude: row 16 (Fable's plan inclusion — wrong, and the Architect/Synthesizer castings
are unreachable on the seat in use), row 17 (the bucket structure — wrong, and §5's whole
per-bucket model collapses into one number), and row 13 (the Luna budget casting — wrong, and the
cheapest authoring path in the design costs more than it saves). Every other row moves an estimate.
That is the list Step 1 and Step 11 exist to close.

**Three epistemic notes on the supplied reports.**

*First,* none of the three evaluates its own family, which means every favourable statement about
a family in these documents is *cross-vendor testimony* and correspondingly more credible than
self-assessment. What the construction does **not** exclude is systematic under-rating of a rival
family, so the asymmetry to watch is criticism, not praise.

*Second,* where the reports agree with each other, that agreement is worth more than either
alone — but agreement inherited from a shared benchmark is an artifact of the shared input, not
independent confirmation. All three route terminal work on Terminal-Bench 2.1, which is
near-saturated; that is a genuine shared-input effect and it is why routine shell work is routed
on cost here rather than on the 2.1 ordering.

*Third, and corrected in this revision:* the draft extended that reasoning too far. It claimed
the harder benchmark was evidence the reports had never seen, and one of them had — under the
benchmark's former name. The general lesson survives and is worth more than the specific claim it
replaced: **a benchmark can disagree with itself across names, snapshots and scaffolds, so a
routing decision that rests on a single leaderboard row is fragile no matter how large the gap
looks.** `dossier_both.md` §1 says exactly this and the draft did not take it seriously enough.
The structural remedy is not more benchmarks; it is the paired-casting trials in Step 11, which
measure this harness's own pairs and are the only evidence a harness is entitled to act on when
scaffolds are part of the measurement.
---

## Work plan

This is a design document, so the work plan is the sequence that turns it into agent
definitions, a router and a ledger — ordered so the **riskiest assumption is tested first** and
so that a failure at any step invalidates as little downstream work as possible. Each step names
what it depends on and what would make it stop.

**Step 1 — Measure the pools before changing anything. (Depends on: nothing. Riskiest
assumption first.)**
Run the *existing* roster for one full weekly cycle with instrumentation only: per call, record
`role, model, effort, vendor, bucket, tool calls, wall clock, input/output tokens where exposed,
and the CLI's own reported remaining-allowance signal`. Produce three numbers **per bucket** —
`AU-all`, `AU-opus`, `AU-fable`, `OU` — not per vendor: draw per routine round, draw per
gate-class round, and observed time-to-throttle under normal use. Two specific facts are the
priority, because §5 and P13 both rest on them and both are secondary-sourced (§7 row 17):
whether the Anthropic seat in use really has a separate Opus bucket, and what actually happens
when it is exhausted — an error, or a silent Sonnet turn. The second is testable directly:
deliberately exhaust the Opus bucket on a throwaway session and observe whether the model
identifies itself as the one that was requested.
*Why first:* the entire cost model rests on the claim that allowance, not dollars, is the binding
constraint and that it can be balanced across pools. If a Max-class seat cannot sustain even
today's six-role roster for a working week, a 24-role architecture with mandatory cross-family
review needs its mandates re-scoped before it is built, not after.
*Stop condition:* if a single day's normal work exhausts a pool, stop and re-scope the mandates
(§3.3) to a smaller mandatory set before any other step proceeds.

**Step 2 — Settle the Gemini access question. (Depends on: nothing; run in parallel with 1.)**
Read the Antigravity CLI terms and any Google statement on third-party or programmatic use;
install `agy`; sign in once on the target machine; verify that `agy -p "<prompt>"
--model="Gemini 3.7 Flash" --output-format json` runs headless on cached credentials, and record
what `/usage` reports before and after a representative agentic task.
*Deliverable:* a yes/no on the lane plus a measured per-task draw.
*Stop condition:* terms prohibit harness automation, or headless runs demand an API key →
record the exclusion with its reason, drop the Archivist primary and Interface
reference-adherence castings to their mirrors, and remove the Google column from the cost model.
Nothing downstream changes, which is the design property being tested here.

**Step 3 — Write the contracts *and the class boundaries* before the agents. (Depends on: 1.)**
Author the five schemas — order, report, verdict, authorization packet, casting record — as the
single source of truth (§3.4). Every later step consumes them. Include the integrity block
(nonce, tree audit) and the `requested_casting` / `served_model` pair as required fields for
every authoring seat, not optional ones for a single lane; `review.cross_family` is a required
verdict field written by the dispatcher, never by the reviewer.

**Also in this step, and moved here from Step 6:** encode the twenty-four class identifiers and
the §4.1 discriminator table as data, and assert the ownership invariant mechanically — *every
class has exactly one primary role; every role's declared classes are a subset of the table's;
no identifier appears twice.* The draft left that resolution to Step 6, after the router had
been built, which meant the router would have been implemented against a table that still
contained four collisions. An invariant that a script can check belongs before the code that
depends on it, not after. Step 6 remains, but it now tests something different: not whether the
identifiers are consistent (Step 3 guarantees that) but whether a *human request* lands on the
right one.

**Step 4 — Build the Verifier first, of all the roles. (Depends on: 3.)**
It is the cheapest role, the most deterministic, and the one every other role's verification
claim will lean on. Implement the deterministic core as code: manifest execution, exit-code
capture, diff parsing, tree fingerprint before/after, nonce echo, schema validation, mutation
check for new tests, invariant comparison for data changes.

**Build the isolated-checkout substrate first, because without it the seat cannot run.** Half of
the checks above *write*: a build populates caches and generated artifacts, a test runner writes
fixtures and coverage data, the mutation check inverts an assertion, and the invariant comparison
applies a migration against a copy. The reference implementation in this repository already had
to make this trade and documents both sides of it — its review runner defaults to
`workspace-write` "so the suite can run", with `read-only` named as the option under which "many
test runners can't run" (`packs/codex/hooks/orchestra-review.js`, `README.md`). Concretely, this
step delivers: creation of a throwaway checkout of the commit under examination **outside the
repository** (the reference implementation requires its worktree root to be outside the tree,
and refuses rather than silently relocating); a before/after fingerprint of that checkout with
generated-artifact classification, so "the suite wrote a cache" and "a source file changed" are
distinguishable; guaranteed teardown, including reclamation of checkouts left by a killed run;
and a dispatcher-side fingerprint of the *real* tree across the Verifier's own run, so a
write-scope escape is caught by the same mechanism the seat applies to everyone else.
*Why this early:* it is the only role whose correctness can be established without any model
judgment, and it makes every subsequent step's evidence trustworthy.

**Step 5 — Build the router and the casting table. (Depends on: 1, 3.)**
Implement `route(task_class) → role`, `cast(role, pool_state) → (vendor, model, effort)`,
`reviewer_casting(author_family, stakes) → casting`, and the degradation ladder as an explicit
state machine (§5.6). The no-self-family rule and the context-shape rule are enforced here — at
dispatch — and nowhere else, so they cannot be forgotten by a role definition or a work order.

**Step 6 — Test the router against human requests before staffing it. (Depends on: 3, 5.)**
Step 3 has already guaranteed that the identifiers are consistent; this step asks the different
question of whether a *request phrased in a user's words* lands on the right one. Take 40
historical tasks from this repository's own git history and changelog, strip them to a one-line
user request, and have the router (and, separately, a human) classify each. Score agreement and,
more importantly, *unambiguity*: how many requests plausibly match two primaries after the §4.1
discriminators are applied?
*Threshold:* ≥90% agreement and ≤2 genuinely ambiguous cases out of 40. Below that, the task-class
boundaries are wrong and must be redrawn — much cheaper now than after 24 agent definitions
exist. Seed the 40 deliberately with the adjacent pairs §4.1 names, especially A (Operator vs Bug
Hunter), B (Detective vs Bug Hunter) and F (Builder vs Principal), since a discriminator that
only works on easy cases has not been tested.
*Why here:* done-criterion 1 (nuance-matched casting) is a claim about *routability*, and this is
the only step that tests it directly.

**Step 7 — Staff the assurance band. (Depends on: 3, 4, 5.)**
Reviewer (both castings, computed), Sweeper, Red Team. Assurance before construction, so that
every construction seat added afterwards is checked from its first order.

**Step 8 — Staff the evidence band. (Depends on: 3, 5.)**
Pathfinder, Detective (both already exist and need only re-contracting), plus the two new seats,
Librarian and Archivist. Archivist ships with the mirror castings regardless of Step 2's outcome.

**Step 9 — Staff the construction band, in dependency order. (Depends on: 7, 8.)**
Builder and Principal first (they replace the current executors and can be validated against
existing work); then Operator, Test Author and Refactorer; then Bug Hunter; then the domain
seats — Data Engineer, Performance Engineer, Interface Artisan, Spatial Specialist, Doc Writer.
Each seat ships only when its *weakness* section is written and its forbidden classes are
encoded, because a role definition with no stated weakness is not routable (done-criterion 1).

**Step 10 — Staff orchestration last. (Depends on: 9.)**
Conductor, Architect, Synthesizer, Quartermaster. Last because the orchestration seats are the
ones whose behaviour depends on everything below them existing, and because the Conductor's
casting change (Fable → Opus 5) is the change most likely to need adjustment once the ledger has
real data.

**Step 11 — Run the paired-casting trials. (Depends on: 9; needs 4 for evidence.)**
Five trials, each an A/B with the same order run on two castings in isolated worktrees, scored on
accepted output, review rounds and bucket draw:
(a) **Builder budget casting** (Luna·max) versus primary — the design's cheapest authoring claim,
single-sourced (§7 row 13).
(b) **Spatial Specialist** primary versus mirror — the largest evidence gap in the document.
(c) **Interface Artisan** generation castings, including Gemini if Step 2 passed.
(d) **Reviewer** cross-family versus same-family fresh-context, on seeded defects.
(e) **Operator escalation, scaffold-controlled** — added in this revision and the one trial the
draft omitted while asserting the conclusion it would have tested. Twelve hard-environment tasks
(CI archaeology, toolchain surgery, container and packaging failures, dependency hell), each run
through *this harness's own two pairs*: Opus 5·high inside the Anthropic-native lane, and
Sol·high through the Codex CLI, with identical orders, identical tool budgets and identical
context packets. Score: tasks resolved, tool calls to resolution, review rounds, and draw per
resolved task. **Decision rule stated in advance so the trial cannot be read after the fact:**
if the Anthropic pair resolves ≥2 more of the twelve *and* does not cost more than 1.5× the draw
per resolved task, the escalation rung inverts to Opus 5·high and Adjudication 1's withdrawn
conclusion is reinstated with this trial as its evidence; otherwise the reports' ordering stands
and the matter is closed until a scaffold-controlled public benchmark exists.
*Why after staffing:* these are the five castings this document holds at moderate confidence, and
they are the five where the evidence is thinnest, single-sourced, or — in (e)'s case — measured
under scaffolds this harness does not use.

**Step 12 — Migrate the metered planning transport. (Depends on: 3, 10.)**
Move the planning counterpart lane from the metered API transport to the same subscription CLI
transport the other cross-vendor lanes use, preserving the capability and removing the
`OPENAI_API_KEY` dependency. Verify a full planning round produces an equivalent artifact.

**Step 13 — Ship the compatibility layer and the kill switch, before anything is renamed.
(Depends on: 5; runs in parallel with 7–10.)**
Implement §6.7's alias map as declarative data resolving every retired name to a
`(role, casting)` pair, emitting a deprecation line into the ledger on each use; implement the
`roster: legacy | new` flag, evaluated per order so a rollback is a flag flip rather than a
revert. **This must precede any renaming**, because persisted plans, in-flight orders and the
skills that dispatch by name would otherwise break the moment a name stopped resolving.
*Proof:* an order written against the old names dispatches correctly under both flag values, and
the ledger shows which path it took.
*Stop condition:* any legacy name that cannot be expressed as a `(role, casting)` pair is a
design gap, not a migration detail — resolve it in §2 before proceeding.

**Step 14 — Shadow and canary. (Depends on: 9, 10, 13.)**
Run both rosters side by side for a minimum of two weeks or twenty orders, whichever is longer,
promoting classes in the ascending-consequence order of §6.7: evidence and mechanical → routine
authoring → hard authoring → domain → data and security → orchestration. A tier is promoted only
when the tier below it has run clean for the shadow period. Nothing is deleted during this step.
*What is watched, with rollback mandatory on any of them:* escape rate above V1's threshold;
live-traffic routing agreement below V3's threshold; **any** mandatory-class change that closed
same-family; two consecutive sessions with a bucket-state surprise the Quartermaster did not
predict.
*Why this step exists at all:* the draft went from trials straight to deletion and only then
measured the whole system, which would have made the first system-level failure discoverable
after the known-good roster was gone.

**Step 15 — Re-baseline under the new roster. (Depends on: 1, 14.)**
Repeat Step 1's measurement under the new architecture and compare, per bucket: draw per round,
review rounds per accepted change, wall-clock per round, escape rate, and predicted-versus-observed
throttle. **V1 and V2 are evaluated here**, on the new roster while the old one is still
installed — which is the only arrangement in which failing them is cheap.

**Step 16 — Retire the superseded agents. (Depends on: 11, 14, 15; gated on V1 and V2 passing.)**
Only now: delete or archive the duplicated executor/reviewer/architect variants that have become
castings, and remove them from the installer's list. The aliases stay for one further release
with their deprecation warnings, then go. If V1 or V2 failed, this step does not run and the
correct response is the one that verification names — not deletion on schedule.

**Step 17 — Publish the operator's one page. (Depends on: 6, 16.)**
The routing table (§4) plus the §4.1 discriminators plus the degradation ladder (§5.6) on one
page. If a competent operator cannot route a novel request correctly from that page in under a
minute, the architecture has failed done-criterion 1 regardless of how good the role catalog is.

---

## Risks and failure modes

**R1 — The allowance model is built on estimates, and two of the three vendors publish nothing.**
The AU weights are secondary-source estimates; the OU weights are derived from published message
*ranges* whose real meter is tokens; the GU has no published anchor at all.
*Detection:* Step 1 and Step 15 measure actual draw; a >2× divergence between predicted and
observed rounds is the tripwire. *Mitigation:* the model is built for *relative* comparison and
every casting decision is expressed as "which pool does this land on", which stays correct even
if the absolute weights are wrong by a factor.

**R2 — Roster bloat degrades routing instead of improving it.** Twenty-four roles is more than a
human holds in mind, and a role nobody can find is a role that does not exist.
*Detection:* Step 6's ambiguity count; and, in production, the ledger metric "orders re-routed
after dispatch." *Mitigation:* the routing table is the interface and the catalog is the
reference; and if Step 6 fails, the correct response is to merge roles — Sweeper into Refactorer,
Performance Engineer into Bug Hunter, Archivist into Librarian — in that order, since those three
are the most defensible merges and would take the roster to 21.

**R3 — Nested dispatch burns a pool faster than it saves wall-clock.** Parallel subagents are the
fastest documented route to a subscription cap.
*Detection:* Quartermaster's draw-per-wall-clock-minute during fan-out versus sequential rounds.
*Mitigation:* the fan-out cap of 4 and the total in-flight cap of 8; and if the measurement is
bad, nesting is removed entirely — the architecture works without it, just slower.

**R4 — The cross-family mandate becomes unaffordable when one pool is small.** A user on an
entry-tier plan for one vendor and a top-tier plan for the other has a structurally lopsided
system, and the mandate will spend the small pool first. §5.2a quantifies the worst case: on a
Plus-tier OpenAI seat a single gate-class review can cost up to 44% of a five-hour window, so two
gated changes can exhaust it.
*Detection:* Amber-rung frequency and Red-rung entries per week in the ledger, per bucket.
*Mitigation — corrected in this revision.* The draft's answer was to make the mandate table
plan-sensitive: shrink the *mandatory* set to data, security and irreversibility on an asymmetric
subscription. That is the wrong lever and it inverts the safety property, because it relaxes the
requirement exactly when the pressure that produces defects is highest, and it makes the system's
central quality claim a function of what the operator is paying. **The mandatory set is fixed at
design time (§3.3) and no configuration edits it.** What an asymmetric or entry-tier subscription
changes is *throughput*: fewer gate-class changes per week, scheduled against the weekly cap
rather than the rolling window, with the queue visible to the user. Three levers remain, and all
three preserve the standard: (i) **reduce the number of gate-class changes** by sizing orders so
fewer of them touch data, security or split-resistant cores — which is good practice
independently; (ii) **route authorship to the small pool and review to the large one**, since
review is the expensive half and the mandate puts it on the opposite pool anyway (§5.5); (iii)
**batch same-kind small changes into single review passes**, never heterogeneous ones. If none of
that is enough, the honest answer is that this architecture's quality claim requires more
allowance than the seat has — and the design says so rather than quietly lowering the bar.

**R5 — This risk was realized during revision, and is recorded as such rather than as a
hypothetical.** The draft's Operator escalation inversion rested on a leaderboard that scores
model-and-harness pairs; on checking, the top rows pair the Anthropic flagship with a minimal
scaffold and the OpenAI flagship with its own CLI, neither of which is a pair this harness runs,
and the benchmark turned out to be one a supplied report already carried under a former name. The
conclusion is withdrawn (Adjudication 1); the Operator primary casting was never affected.
*What remains at risk:* the **replacement** decision — reverting to the reports' escalation
ordering — is itself made on evidence measured under other people's scaffolds, so it is provisional
in the same way, just in the direction the reports already point.
*Detection:* Step 11e, a scaffold-controlled A/B on this harness's own two pairs, with its
decision rule fixed in advance.
*Mitigation and blast radius:* one escalation rung. The Operator primary is Sol either way, so
being wrong costs one extra hop on hard environment work and nothing else.
*The general form, which is the part worth keeping:* any routing decision resting on a single
leaderboard row is fragile when the leaderboard scores `(model, scaffold)` pairs. The register
(§7) now marks such rows **scaffold-uncontrolled** so the fragility is visible at the point of
use rather than discoverable in a critique.

**R6 — Model deprecation and silent substitution.** Three distinct mechanisms, one shared
symptom: the seat is playing a model you did not cast, and nothing says so.
*(a) Deprecation and suspension.* Model ids rotate; a flagship was suspended for nineteen days in
mid-2026.
*(b) Safety-routing fallback.* `dossier_both.md` §1 records that one casting — and sometimes a
second — hands a turn to a weaker model on cyber, bio, distillation and reasoning-extraction
topics, invisibly.
*(c) Allowance substitution, added in this revision and the most likely of the three to bite.*
Exhausting the Opus-specific weekly bucket on a Max plan does not raise an error; it serves
Sonnet for the rest of the rolling window (§7 row 17). Every Anthropic flagship seat — Principal,
Detective, Bug Hunter, Data Engineer, Performance Engineer, Conductor — is exposed, and the
downstream harm is worse than the substitution itself: a cross-family Reviewer would then be
reviewing workhorse-tier output against hard-tier expectations.
*Detection:* record `requested_casting` and, where exposed, `served_model` per call, treating a
mismatch as a routing incident (P13). *Mitigation, in order of reliability:* (i) **avoid rather
than detect** — the Quartermaster's pre-dispatch gate stops Opus dispatches below the `AU-opus`
reserve, because a boundary you never cross needs no detector; (ii) hard route-filters for the
topics with documented classifier fallback; (iii) the casting table is one file, so a deprecation
is one edit. Where the runtime exposes nothing — likely on subscription CLIs — (i) is the whole
defence, which is why it is a mechanical gate rather than guidance.

**R7 — Specification-gaming defeats the verification.** An authoring seat that edits the test,
the fixture or the CI condition to reach green.
*Detection:* the Verifier's tree audit against the order's declared scope, plus a mutation check
on any touched test. *Mitigation:* this is exactly why the Verifier is a separate seat with no
authoring rights; the risk it does not cover is a *plausible* scope-adjacent edit, which is what
the cross-family Reviewer is for.

**R8 — The Gemini lane is adopted and then prohibited or throttled to uselessness.**
*Detection:* Step 2, then `/usage` telemetry. *Mitigation:* optional lane, mirrors named, nothing
mandatory depends on it. The cost of being wrong is the integration effort, which is why Step 2
runs before any Gemini-dependent work.

**R9 — Two vendors agreeing is mistaken for two vendors being right.** The shared-input problem
demonstrated by Adjudication 1: three independent reports agreed about terminal work because they
read the same saturated benchmark.
*Detection:* structural, not statistical — any claim both lanes accept without independent
evidence is marked *verify during execution* rather than promoted to fact, which is a rule this
repository already applies to its blind merges and which generalizes.
*Mitigation:* the Librarian's gate-class dual-lane research mode, used sparingly.

**R10 — The Conductor casting change is wrong.** Moving direction from the ceiling model to the
alignment leader trades some architectural judgment for predictability and ration.
*Detection:* the ledger's "plans revised after first execution round" and "orders re-scoped
mid-flight" metrics, compared against the Step 1 baseline. *Mitigation:* the Architect seat
absorbs the judgment that the Conductor gives up; if the metrics degrade, the correct response is
to lower the threshold at which the Conductor calls an Architect, not to re-cast the Conductor.

**R11 — Contract sprawl.** Four schemas, 24 roles and a router is a system that can rot at the
seams — a role whose contract drifts from the router's expectations fails silently.
*Detection:* a frontmatter/contract lint in CI, which this repository already has a precedent for
(`tests/frontmatter-lint.test.js`). *Mitigation:* extend that lint to validate that every role
declares a casting, a context shape, forbidden classes and a reviewer rule; a role missing any of
them fails the build.

**R12 — The design optimizes for a harness that no longer exists.** A parked transposition to a
different runtime is contemplated; a role catalog welded to one runtime's plumbing would not
survive it.
*Detection:* try to express each role in the other runtime's primitives — the tool surfaces are
already written as capability classes for exactly this reason.
*Mitigation:* nothing in §2 names a tool implementation; the guard-equivalent enforcement and the
report-integrity mechanics are the only pieces with no first-party equivalent elsewhere, and they
are called out as porting work rather than assumed.

---

## Verification

### How each work-plan step is proven done

| Step | Proof a reviewer could run |
|---|---|
| 1 | A ledger file with ≥1 week of per-call records and three derived numbers **per bucket** (`AU-all`, `AU-opus`, `AU-fable`, `OU`), re-derivable from the raw records; plus the deliberate Opus-bucket exhaustion transcript showing whether the boundary errors or silently substitutes |
| 2 | A terminal transcript of `agy -p … --output-format json` succeeding on cached credentials, plus a quoted terms passage and a `/usage` delta |
| 3 | Five schema files; a round-trip test that a valid order/report/verdict/authorization-packet validates and a malformed one fails; **plus the ownership-invariant script passing: 24 classes, 24 primaries, no identifier owned twice, every role's declared classes a subset of the table's** |
| 4 | The Verifier catches, in a seeded test: a red suite reported green; a report claiming changes to an untouched tree; a new test that passes after its assertion is inverted; a data change that breaks a row-count invariant. **And it does all four on a project whose suite cannot run read-only** — the disposable checkout is exercised, teardown is verified, and a deliberately misbehaving check that writes outside the checkout is caught by the dispatcher's own fingerprint |
| 5 | Unit tests over the router: no-self-family holds for every author family; **no mandatory-class dispatch can produce a same-family closing verdict under any bucket state, including Red and Black**; context-shape violations are rejected; each degradation rung produces the documented casting set; the `AU-opus` pre-dispatch gate fires below reserve |
| 6 | The 40-task classification run, with the score and the ambiguous cases listed by name, seeded with the §4.1 adjacent pairs |
| 7–10 | Each role definition has all nine fields populated; the contract lint passes (including P2's mirror-or-declared-exception rule); each ships with one end-to-end order exercised and its report attached |
| 11 | **Five** A/B result tables: accepted output, review rounds, bucket draw, wall clock — with the casting decision recorded either way, and trial (e)'s pre-registered decision rule applied as written |
| 12 | A planning round completed with `OPENAI_API_KEY` unset |
| 13 | An order written against the *old* names dispatching correctly under both `roster` flag values, with the ledger showing which path it took and a deprecation line emitted; the flag flip demonstrated mid-session |
| 14 | The shadow-period ledger: every order's roster path, the class-promotion dates, and either zero rollback triggers or the rollback transcript |
| 15 | The Step 1 measurement repeated per bucket, with a side-by-side comparison table; V1 and V2 evaluated against it **while the legacy roster is still installed** |
| 16 | The installer's agent list no longer contains the retired names; a fresh install produces the new roster; no dangling references in protocol or skills; aliases still resolve with warnings |
| 17 | A competent operator routes 10 unseen requests from the one-pager alone, in under a minute each, with ≥9 matching the table |

### How the architecture as a whole is proven

Nine falsifiable claims. Each has a threshold, and each threshold has a stated consequence — a
claim with no failure consequence is not a claim. V1–V4 test the architecture's headline
properties; V5–V9 test the five castings and one safety property held at moderate confidence.
Note what is deliberately *absent* from the consequence column: no failure of any experiment
relaxes §3.3's mandatory review set or §3.6's authorization ladder. Those are design constraints,
not hypotheses, and an experiment that could overturn them would be measuring the wrong thing.

**V1 — Quality is not sacrificed.** *Claim:* accepted-change rate per review round does not fall
against the Step 1 baseline, and escape rate (defects found after approval) does not rise.
*Method:* the ledger, over 50 changes. *Threshold:* escape rate within 1 percentage point.
*Consequence if it fails:* the cheap-band expansion has gone too far; move Test Author, Sweeper
and the Builder budget casting up a tier and re-measure.

**V2 — Allowance draw falls, per accepted change.** *Claim:* total draw per accepted change falls
against the baseline, and the *peak* draw on either single pool falls by more than the total does
(because of balancing). *Method:* Step 15. *Threshold:* ≥20% reduction in peak single-pool draw.
*Consequence if it fails:* the pool-balancing claim in §5.5 is wrong; the mandate table becomes
plan-sensitive (R4) and the architecture keeps its quality properties while losing its cost claim
— which should be stated plainly rather than quietly.

**V3 — Routing is unambiguous.** *Claim:* a competent operator, given only the routing table and
the §4.1 discriminators, routes novel requests to the same primary the catalog would choose.
*Method:* Step 6 before staffing, Step 14 on live shadow traffic, Step 17 on the one-pager.
*Threshold:* ≥90% agreement, ≤2 genuinely ambiguous in 40, and no adjacent pair accumulating three
logged ambiguities (§4.1 test R). *Consequence if it fails:* redraw the boundary for the failing
pair, or merge roles per R2's ordered list, until it passes — and if it fails on live traffic
during the shadow period, that is one of §6.7's rollback triggers, not a note for later.

**V4 — Cross-family review finds what same-family review misses.** *Claim:* on a seeded-defect
suite, cross-family review has strictly higher recall than fresh-context same-family review.
*Method:* 20 changes with known injected defects of the types the failure-complementarity table
predicts — a violated frozen-file constraint, an over-engineered abstraction, a long-context miss,
a hallucinated API, a concurrency hazard — each reviewed both ways.
*Threshold:* ≥15% relative recall improvement, and specifically a higher catch rate on the defect
types the *other* family is documented to produce.
*Consequence if it fails — corrected in this revision.* The draft said the mandate would "collapse
to fresh-context review of any family." That was wrong twice over. First, it would make a
brief-level constraint contingent on a 20-sample in-house experiment, which is not a weight
20 samples can carry — a null result on that suite is far more likely to mean the seeded defects
were not the ones family correlation produces than that family correlation does not exist.
Second, the no-same-family-at-gate-class floor is not this experiment's to move: it is a design
constraint, and V4 tests the *size* of the benefit, not whether the rule applies. So the
consequences are bounded to what the experiment can actually decide:
- **The floor stands** in every outcome. No result relaxes §3.3's mandatory set.
- **A null or weak result narrows the *preferred* band**, not the mandatory one: classes currently
  "preferred cross-family" drop to "fresh-context, any family", which is cheaper and is where the
  cost lives anyway.
- **A null result also re-aims the reviewer casting**: if family adds nothing on these defect
  types, effort and first-screen filtering become the levers worth tuning instead, and the next
  experiment is reviewer effort rather than reviewer family.
- **It is published either way.** A negative result here is a genuinely valuable finding that no
  supplied report tests directly, and burying it would be the same failure as burying an escaped
  defect.

**V5 — The Builder budget casting saves allowance without costing rounds.** *Claim:* on
fully-specified orders, the Luna·max casting reaches accepted output in the same number of review
rounds as the primary. *Method:* Step 11a, 15 matched orders. *Threshold:* mean review rounds
within 0.2 of the primary, and ≥60% reduction in OU per accepted change. *Consequence if it
fails:* the casting is withdrawn — a single extra review round erases a 13.75× per-task saving,
because review is the larger line item (§5.3).

**V6 — The Spatial Specialist casting is the right one.** *Claim:* the Anthropic primary produces
more accepted geometry-producing output per unit draw than the mirror. *Method:* Step 11b, the
first three orders in the class run as paired spikes. *Threshold:* a decision either way recorded
with its evidence; there is no defensible prior here, which is the point. *Consequence if it
fails:* re-cast, and mark the reports' §3 assignment as not replicating on this workload — the
largest single evidence gap in this document closes in whichever direction the trial points.

**V7 — The Operator escalation rung, decided under controlled scaffolds.** *Claim:* on hard
environment tasks run inside *this harness's own pairs*, the Anthropic flagship resolves more
tasks than the OpenAI flagship. *Method:* Step 11e, twelve tasks, identical orders and budgets.
*Threshold and decision rule, pre-registered:* ≥2 more of twelve resolved **and** ≤1.5× the draw
per resolved task → invert the rung; otherwise the reports' ordering stands. *Consequence either
way:* one escalation rung changes or does not; the Operator primary is unaffected. This is the
experiment the draft asserted the conclusion of without running.

**V8 — Irreversible actions cannot close without a human.** *Claim:* no path exists through the
dispatcher by which a Class-3 action is applied without a recorded human approval. *Method:* an
adversarial test, not an observational one: attempt six routes — a Data Engineer order that
self-reclassifies mid-run; an Operator order whose forbidden-command list is incomplete; a
Conductor arbitration that overrides a Class-3 gate; a Class-2 order whose prepared change is a
Class-3 action in disguise; a retry after a `BLOCKED: irreversibility class exceeded`; and a
degraded-mode session at rung 4 attempting to proceed. *Threshold:* all six blocked, each with a
distinguishable reason. *Consequence if it fails:* the failing path is the highest-priority defect
in the system and nothing else ships until it closes — this is the one failure no later review
repairs.

**V9 — The Archivist's multimodal claims replicate outside the vendor's card.** *Claim:* on a
50-artifact in-house set (charts, scanned PDFs, screen recordings, mixed-quality screenshots) the
Gemini casting's schema-valid extraction accuracy is at least as good as the mirrors' on the
overlapping modalities, and its video extraction is usable at all. *Method:* human-scored against
ground truth the artifacts already carry. *Threshold:* ≥95% schema validity and ≥90% field-level
agreement on the overlap. *Consequence if it fails:* drop the Google lane to Runner-class work
only and route T19 permanently to the mirrors plus the transcode path — which the architecture
already supports, so the cost of this failing is the integration effort and nothing more.

### Standing telemetry

Per call: `task_id, class, role, requested_casting(vendor, model, effort), served_model where
exposed, bucket, context shape and size, tool calls, wall clock, tokens where exposed, bucket draw
estimate, status, review rounds, verdict, review.cross_family, irreversibility_class, escape (set
later), human intervention`.
Per session: per-bucket state at start and end, degradation rungs entered, preferred-band reviews
that ran same-family, Class-3 approvals with approver and timestamp, roster path (legacy | new)
during the shadow period, and alias deprecations used.

Eight standing tripwires, each with an owner and an action:
1. **Heavy-tier share > 25% of orders** → the sizing law is failing, not the model succeeding;
   re-examine order decomposition, not the casting.
2. **Cheap-band share high *and* accept rate low** → under-escalation; raise the tier threshold.
3. **Ceiling+orchestration draw > 70% of a bucket** → the Conductor is not delegating.
4. **Predicted throttle wrong by >30%** → the Quartermaster's weights need re-deriving.
5. **Any preferred-band same-family review not carried into the user-facing report as
   `review.cross_family = false`** → a process defect of the most serious kind, because it makes
   the system's central quality claim untrue. The field is set by the dispatcher precisely so this
   tripwire measures a rendering bug rather than a discipline failure.
6. **Any mandatory-class change closed with `review.cross_family = false`** → not a tripwire but
   an incident: the change is reopened, the path that permitted it is treated as a dispatcher
   defect, and §6.7's rollback trigger fires if the roster is still in its shadow period.
7. **Any Class-3 action in the ledger without a named human approver and timestamp** → the same,
   at the same severity. These two are the only telemetry lines that stop work rather than
   informing it.
8. **`served_model ≠ requested_casting`, or an `AU-opus` dispatch below reserve** → a P13 routing
   incident; re-run the affected order and check whether any verdict was issued against
   substituted output.

---

## Assumptions and open questions

Marked **[A]** for an assumption this design relies on, **[Q]** for a question it could not
resolve.

1. **[A] Subscription CLIs meter sub-agents against the session's own pool.** Evidence supports
   this on the Anthropic side (sub-agents and parallel agents draw from the subscription limit;
   headless and SDK runs still draw from it after a planned separation was announced and then
   paused). Assumed by symmetry on the OpenAI and Google sides. *If wrong* — if agent traffic
   drew on a separate meter — the fan-out caps could be relaxed substantially and the cost model
   becomes conservative rather than wrong.
2. **[A] The per-window message ranges are a usable proxy for relative draw.** They are published
   per model, but the real meter is tokens, so a long high-effort Sol message may cost far more
   than 22 Luna messages. Used only for relative comparison; Step 1 replaces it with measurement.
3. **[A] The Anthropic per-model weights (Opus ≈5× Sonnet, Haiku ≈0.2×) are approximately right.**
   Secondary-source; the vendor publishes no token quotas. The Fable estimate (≈10× Sonnet) is a
   list-price extrapolation and is the weakest number in the model.
4. **[A] Driving Antigravity CLI from a harness under the user's own signed-in session is
   permitted.** **Unverified**, and deliberately so: the vendor has called third-party use of the
   *predecessor* CLI's OAuth a policy violation. This is the assumption most likely to be wrong,
   which is why the Gemini lane is optional, off by default, and off every mandatory path.
5. **[Q, now partly answered — and the answer is worse than the question]** *Do the subscription
   CLIs expose the actual model that served a turn?* Still unresolved. What this revision did
   establish is that the question matters more than the draft thought: besides the documented
   safety-routing fallback, exhausting the Opus-specific weekly bucket on a Max plan is reported
   to serve Sonnet silently rather than to fail (§7 row 17). So there are two substitution
   mechanisms, not one, and the more likely of them is triggered by ordinary heavy use rather than
   by topic. Because detection cannot be relied on, the mitigation is **avoidance**: a
   pre-dispatch bucket gate (P13) plus topic route-filters. Step 1 tests the substitution
   behaviour directly on the seat in use; if it turns out to error rather than substitute, the
   gate becomes belt-and-braces and nothing else changes.
6. **[Q, answered in this revision]** *Is there any independent evaluation of Gemini 3.7 Flash?*
   Yes — the draft's claim that none was found was wrong, and the omission mattered because it
   was doing work: it justified holding the seat at "moderate confidence, might be a weak
   reasoner." ARC Prize published a first-party-independent run on 2026-08-13 (§7 row 21) putting
   the model at ARC-AGI-2 semi-private 84.6% for $0.25 a task, above Terra and far above Luna.
   That reframes the seat from "cheap but limited" to "**bounded reasoner, weak sustained actor**"
   and adds one narrow seat (the Verifier's model-assisted classification). What remains
   vendor-only is the *multimodal* half — CharXiv, LVBench, the 97.0 MRCR variant — which is what
   V9 now tests before the seat carries anything load-bearing.
7. **[Q] What is the real weekly cap on each plan?** Neither major vendor publishes one; one of
   them publishes only the sentence "additional weekly limits may apply." Every weekly-horizon
   statement in §5 is therefore directional.
8. **[Withdrawn in this revision.]** The draft assumed *"Terminal-Bench 3.0's model-and-harness
   pairing is acceptable as a routing signal."* It is not, for this harness: the leaderboard's top
   rows pair the two flagships with scaffolds this harness does not run, and the only row using an
   Anthropic-native scaffold sits level with the OpenAI flagship's Codex row (Adjudication 1). The
   assumption is replaced by a scheduled measurement (Step 11e, V7) and by a register convention
   that marks scaffold-uncontrolled rows as such at the point of use. The conclusion it supported
   — inverting the Operator's escalation rung — is withdrawn; the Operator's primary casting never
   depended on it.
9. **[A] The 96%-quality-at-46%-cost orchestrator result generalizes from its benchmark to
   software work.** It is a single vendor study on a browsing benchmark, and it carries more
   weight in this design than any other single number because it justifies the whole delegation
   topology. *If wrong*, the correct response is to raise the Builder tier rather than to abandon
   delegation, since the alternative — a flagship writing every line — fails the allowance
   constraint outright.
10. **[Q] Where exactly are the boundaries between adjacent seats in practice?** §4.1 now gives
    seventeen binary discriminators; the two sharpest cases are Detective/Bug Hunter ("does the
    next step require running the system?") and Operator/Bug Hunter ("what changes when you change
    one thing?"). Crisp on paper. Real cases arrive pre-classified by whoever writes the order, and
    a mis-classification costs a hop. Step 3 now guarantees the *identifiers* are consistent;
    Step 6 measures whether human requests land correctly, seeded deliberately with these pairs;
    and the residual rule (§4.1, test R) turns a persistent ambiguity into a forced boundary redraw
    or a merge rather than into folklore.
11. **[A] Effort levels are comparable enough across vendors to be written in one table.** They
    are not identical — one family's thinking is always on and cannot be disabled, another exposes
    a level above `xhigh`, a third exposes configurable thinking without a public ladder. The
    casting table treats effort as per-vendor and never assumes `high` means the same thing in
    two columns; any cross-vendor comparison at "equal effort" is approximate by construction, and
    a comparative planning session should say so.
12. **[A] Pricing figures are used only as draw proxies.** One conflict was found and left
    unresolved because it does not matter here: one source describes a workhorse price as made
    permanent, another reports a rise a few weeks later (§7 row 22). Under this cost basis neither
    is a bill.
13. **[Q] Does the current review runner's 600 s default hold for the deeper reviews this design
    mandates?** The pack's own notes say an inert review is still minutes of reading and that
    1800 s blocking calls are proven while nothing longer is. Mandating cross-family review on
    more classes raises the number of long calls; if timeouts become the dominant failure, the cap
    needs raising before the mandates widen.
14. **[Disclosure] A neighbouring artifact was deliberately not read.** The repository contains a
    document at `.claude/plans/cross-compare/next-gen-role-architecture/plan-B-v1.md`, written
    shortly before this document under a near-identical brief; its authorship is unknown and was
    not inferred. Reading it would have compromised the independence this exercise exists to
    produce, so its existence was established from file
    metadata only and its contents were not opened. Recorded here because a reader auditing the
    ground-truth scope would otherwise find an in-scope file this document never cites.
15. **[A] The Anthropic allowance really is two buckets on Max, with a silent Sonnet fallback at
    the Opus boundary.** This is the single most load-bearing secondary-sourced claim in the cost
    model (§7 row 17): it shapes the unit system, the reserve thresholds, P13's gate and the
    Quartermaster's only hard authority. It is corroborated across several independent summaries
    and a vendor issue-tracker thread, but not by a primary vendor page this revision could
    locate. *If wrong* — one bucket, or a hard error at the boundary — §5 collapses to a single AU
    and P13's first mechanism disappears; the second (classifier fallback) does not, so the
    attestation field and the topic filters stay. Step 1 settles it in a day, which is why Step 1
    is first.
16. **[A] Plan multipliers, left deliberately unresolved.** Secondary sources disagree about the
    top Anthropic tier (Max $200 ≈ 10× Pro in a 2026 summary; 20× in older material). Nothing in
    this document depends on which is right — it scales how much work a week holds, not who does
    what — so the conflict is recorded rather than adjudicated, per the brief's instruction to
    mark rather than invent.
17. **[A] A human approver is reachable within the working day for Class-3 actions.** §3.6 has no
    model-side alternative, so an unreachable approver means irreversible work waits. On a
    single-operator project this is trivially satisfied (the operator is the approver); on an
    unattended or scheduled deployment it is not, and such a deployment would need an explicit
    pre-authorization mechanism this design does not attempt to specify. Flagged rather than
    hand-waved, because "the human will be there" is exactly the assumption automation erodes.
18. **[A] A local transcoder and a local speech-to-text binary are available for the Archivist's
    un-mirrored sub-contract.** The video/audio fallback (B3) is deterministic rather than
    model-based precisely so it does not add a fourth vendor, but it does add a local dependency.
    Where that dependency is absent, T19's video/audio slice routes back to the human who supplied
    the media; nothing else in the architecture changes.
19. **[A] The repository state read here is current.** All repository claims were verified
    first-hand against the working tree at version 1.11.0 with the `codex` pack installed;
    `.claude/` is untracked in git, so the installed agent definitions cited in §6.6 are local and
    may differ from another machine's install. That is itself part of the finding.

---

## Critique dispositions

Eleven findings, eleven dispositions. All eleven are adopted, and that fact deserves an argument
rather than a shrug, because adopting everything is as much a failure mode as rejecting
everything. Each was checked before it was accepted: five against the repository tree, three
against live sources, three against the document's own internal consistency. Every one held at its
core. Where a finding's *diagnosis* landed but its *prescribed remedy* was narrower or wider than
the evidence supports, the disposition says ADOPTED and the partial rebuttal is stated inside it —
findings 1, 2, 4 and 6 each carry one. And the revision does not stop at the critique: the check
prompted by finding 9 turned up a defect the critique did not find, described below and fixed
throughout.

1. **ADOPTED** — *Synthesizer / T23 violate family independence.* The diagnosis is correct and the
   draft's own text conceded it: blindness removes identity bias, not correlated blind spots, and
   "alternate the family across sessions" is a way of *observing* a violation over time, not
   preventing one. A3 is restructured. Arbitration is decomposed rather than assigned: the
   Synthesizer extracts a contest ledger mechanically, each contested position is challenged
   **only by the opposite family**, the Synthesizer composes what survives and may not overturn a
   fallen position, and any contest where both positions survive or both fall goes to the user as
   an OPEN DECISION. P4 gains a third clause making this general. **Partial rebuttal:** the
   finding prescribes that "this gate must terminate in qualified human adjudication" — for the
   *whole* merge, which would make the gate unusable, since a human adjudicating two full plans
   is the work the exercise exists to avoid. Human adjudication is therefore applied to the
   contested residue, which is where a family preference could actually decide something, and not
   to material that is uncontested or that already fell to an opposite-family challenge. That
   satisfies the constraint the finding is defending at a fraction of the cost it proposed.

2. **ADOPTED** — *A hard requirement is made optional in five places.* Correct in four of the five
   and the fifth is a definitional dispute worth stating. §5.6 rung 4 no longer offers
   "proceed same-family with disclosure" for the mandatory set: the only outcomes are wait, named
   human expert review, or park unmerged with a HOLD marker. The D1 casting table splits the
   degraded row into a mandatory row (no substitution exists) and a preferred row. R4's
   recommendation to shrink the mandatory set under an asymmetric subscription is **removed and
   replaced** — the mandatory set is fixed at design time and no configuration edits it; what a
   small pool changes is throughput, and three levers that preserve the standard are given
   instead. V4's failure consequence no longer collapses the mandate: the floor stands in every
   outcome, and what a null result moves is the *preferred* band and the reviewer's effort and
   casting. Disclosure is now a dispatcher-set schema field (`review.cross_family`) rather than
   reviewer prose, with two telemetry lines (6 and 7) that stop work rather than informing it.
   **Partial rebuttal:** the finding's framing treats the existence of a *preferred* band as part
   of the defect. It is not — the brief asks the design to state where cross-vendor pairing is
   mandatory and where it is "merely preferred", so a design with no preferred band would be
   answering a question it was not asked, and a routine Builder round under full deterministic
   coverage is the paradigm case of the softer tier. The defect was that budget could move work
   *between* the tiers; that is what has been closed.

3. **ADOPTED** — *Task-class ownership is not one-to-one.* Verified in the draft, all four
   collisions exactly as stated: Conductor and Architect both claimed T22, Synthesizer and
   Quartermaster both claimed T24, the Architect catalog said T22 where the table said T8, and T23
   named three roles. Identifiers are now single-sourced — **T8 Architect, T22 Conductor, T23
   Synthesizer, T24 Quartermaster** — with contributing roles named as inputs rather than
   co-owners. The semantic overlap the finding names is real too: "works locally, fails in CI"
   appeared in Operator's signals and in Bug Hunter's owned classes, so a new **§4.1** supplies
   seventeen binary discriminators for every adjacent pair plus a residual rule that converts a
   persistent ambiguity into a forced boundary redraw. The sequencing complaint is also adopted:
   the ownership invariant moves from Step 6 to **Step 3**, asserted mechanically before the
   router is built rather than tested after, and Step 6 is refocused on whether *human requests*
   land correctly.

4. **ADOPTED** — *The cost table covers 13 of 24 classes and "reserve" is undefined.* Counted and
   confirmed: T4, T9–T11, T13–T15, T17, T21–T22 and T24 had no estimate. §5.3 now costs all
   twenty-four with per-round author, verifier and reviewer draws. A new **§5.2a** defines the
   reserve numerically — Green ≥40%, Amber 20–40%, Orange 8–20%, Red <8%, with the reserve set at
   the larger of 8% of the bucket and the measured cost of two gate-class reviews — evaluated per
   bucket rather than per vendor. **Partial rebuttal on the third clause:** shares of allowance
   can be given honestly on the OpenAI side and not on the Anthropic side, because one vendor
   publishes per-window message ranges and the other publishes no quota at all. Inventing an
   Anthropic denominator would have been a fabricated number in a document whose brief forbids
   exactly that. So OU is expressed as a share of a five-hour window at each plan tier — which
   yields the useful finding that one gate-class review can cost up to 44% of a Plus window — and
   AU is carried against three constants Step 1 measures, with the gap stated rather than filled.

5. **ADOPTED** — *The Verifier's permissions cannot support its checks.* Verified first-hand, and
   the finding's citation is accurate: `packs/codex/hooks/orchestra-review.js` documents
   `ORCHESTRA_REVIEW_SANDBOX` defaulting to `workspace-write` — "lets the reviewer actually run
   the test suite" — with `read-only` described as a guarantee under which "many test runners
   can't run", and `README.md` carries the operator-facing symptom. The draft's "No WRITE
   anywhere" would have failed closed on ordinary projects while looking like a safety property.
   D3 now grants writes **confined to a disposable checkout created outside the repository**,
   bounded by location, direction, before/after fingerprint with generated-artifact
   classification, and unchanged authority; a new failure mode (write-scope escape) is named and
   caught by the dispatcher applying the same fingerprint to the Verifier itself; Step 4 delivers
   the checkout substrate first and its proof row exercises a project whose suite cannot run
   read-only.

6. **ADOPTED** — *P2's transparent-recasting premise is not honoured by several contracts.*
   Correct on all three counts as written. The general fix is better than three patches: **P2 now
   requires every role to declare a mirror or a named no-mirror exception**, with the uncovered
   sub-contract and its degradation behaviour stated, enforced by the contract lint. Doc Writer
   gains a Sol·medium mirror with an explicit non-equivalence clause. Data Engineer's irreversible
   half is declared un-mirrored *on purpose* — pool pressure must not change who prepares a
   destructive migration — so it waits rather than recasting. Archivist declares video and audio
   un-mirrored and specifies a deterministic transcode fallback (frame extraction plus local
   transcription, then the existing mirrors) so T19 stays inside its contract. **Partial
   rebuttal:** the finding reads "pool exhaustion remains an outage or reclassification for part
   of the roster" as a defect in itself. Some capability genuinely exists on one vendor only;
   no architecture can recast around that, and a design that claimed otherwise would be lying.
   The defect was asserting uniform mirroring, not the underlying asymmetry — so the fix is to
   name the exceptions and specify how each degrades, which is what has been done.

7. **ADOPTED** — *Detective verdicts are structurally unreviewed.* The draft said as much and then
   under-answered it. A Verifier can confirm cited lines exist; it cannot show a causal chain is
   complete or falsify unconsidered alternatives, which is precisely the "confident narrative"
   failure the role's own weakness section names. B4 now carries three checks: the mechanical
   chain re-run, a contractual **refutation duty** (the refuting evidence sought and the two
   strongest discarded alternatives, with citations), and a **mandatory cross-family falsification
   pass for any gate-class CONFIRMED** — a second Detective on the opposite family receiving the
   question, chain and alternatives but deliberately *not* the narrative, returning CONCUR,
   CONCUR-WITH-DOUBT or COMPETING HYPOTHESIS. Added to §3.3's mandatory table with its
   unavailable-behaviour stated: the verdict stands as LIKELY, not CONFIRMED, and cannot authorize
   gate-class work.

8. **ADOPTED** — *Irreversible-action authority is assigned inconsistently.* Three different
   policies in three places, exactly as charged. The finding's central sentence is right and is
   now a principle: an alignment score can justify which model *prepares* a decision packet; it
   cannot authorize a production migration. P11 is rewritten around the preparation/authorization
   split; a new **§3.6** defines three irreversibility classes with who may authorize each — Class 1
   implicit, Class 2 an explicit Conductor gate, Class 3 a **named human** recorded with a
   timestamp — plus four supporting rules (conservative classification, worker may not
   reclassify, preparation and application are always separate orders, dry-run output is
   evidence). An authorization-packet schema is added to §3.4, §3.2 explicitly removes
   authorization from the Conductor's non-delegable list while keeping gating, and **V8**
   adversarially tests six routes by which a Class-3 action might close without a human.

9. **ADOPTED, and extended by a defect the critique did not find.** The finding is correct on both
   limbs: `agents/executor-heavy.md` is `model: opus` in the Claude-native lane and
   `packs/codex/hooks/orchestra-exec.js` sets `TIER_DEFAULTS.heavy = gpt-5.6-sol` through the
   Codex runner, so the harness does not run the leaderboard's pairs; and reporting of the same
   snapshot names those pairs as Opus 5 + mini-SWE-agent versus Sol + Codex, with the only
   Claude Code row (Fable 5, 34.0) sitting level with Sol's. Checking that claim surfaced a worse
   error the critique missed: **Terminal-Bench 3.0 is the benchmark formerly called
   Frontier-Bench**, and `dossier_both.md` §3.2 already carries it under that name with consistent
   figures. So the draft's claim to hold evidence the reports had not seen was false, and
   Adjudication 2 double-counted the same measurement as a separate witness. Consequently: the
   escalation inversion is **withdrawn**, the rung reverts to the reports' ordering, the two
   evidence-register rows are merged into one marked *scaffold-uncontrolled*, Adjudication 2's
   witness count drops from four to three, assumption 8 is marked withdrawn, R5 is rewritten as a
   realized risk, and a named scaffold-controlled A/B with a pre-registered decision rule is
   added as **Step 11e / V7**. The Operator's primary casting was never affected either way.

10. **ADOPTED** — *Retirement precedes system-level validation with no compatibility or rollback
    path.* Correct, though it understates the draft slightly: retirement was already sequenced
    after the trials. The real gap is the one the finding names — no aliases, no shadow phase, no
    canary, no kill switch, no restoration procedure, and V1/V2 evaluated only after deletion. A
    new **§6.7** supplies all five: a declarative alias map from every retired name to a
    `(role, casting)` pair with ledger deprecation lines; a shadow period of two weeks or twenty
    orders; a canary promoting classes in ascending consequence, with data, security and
    orchestration last; a one-flag `roster: legacy | new` kill switch evaluated per order; and a
    restoration procedure with four named mandatory triggers. The work plan is resequenced to
    match — Step 13 ships the compatibility layer before anything is renamed, Step 14 runs shadow
    and canary, Step 15 re-baselines and evaluates V1 and V2 **while the legacy roster is still
    installed**, and Step 16 deletes only if they pass.

11. **ADOPTED** — *The evidence register does not supply checkable provenance.* Correct, and the
    consequence was not hypothetical: a source-class letter is a confidence classification, and
    the substitution is exactly what let the double-named benchmark of finding 9 survive a full
    draft. §7 is rebuilt with a resolvable source column — document and section for the three
    supplied reports, URLs for live sources, `path` for repository facts — and the confidence
    letter demoted to a second column. Each figure the finding named specifically is now traced:
    the Gemini failure decomposition to a named academic evaluation, **with the caveat that its
    subject is called "Gemini-3-Flash" and may be a predecessor**; the Anthropic weights to the
    two secondary aggregators they came from, marked secondary; the parallel-agent burn to its
    reporting, **with the plan-mode qualifier the draft dropped**; and the Codex window
    oscillation to two independent outlets with both dates. Three further rows are new: the
    Anthropic two-bucket structure with its silent-substitution behaviour, Fable's plan-tier
    inclusion from the vendor's own page, and an **independent** ARC Prize evaluation of Gemini
    3.7 Flash that the draft claimed did not exist. A sensitivity paragraph names the three rows
    that would change a casting rather than a magnitude. Two live consequences follow: Fable
    castings are now conditional on a Max-or-above seat because Fable runs on metered credits
    below it, and the Gemini seat is reframed from "possible reasoning deficit" to "bounded
    reasoner, weak sustained actor" on independent evidence.
