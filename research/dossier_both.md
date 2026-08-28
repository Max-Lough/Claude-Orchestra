# Blueprint 1 of 3 â€” Objective Cross-Vendor Model Dossier

**System:** Pi agent harness â€” cross-vendor seamless integration  
**Role of this document:** Independent routing intelligence for a director that delegates to workers, with at most one additional delegation level.  
**Companion blueprints (not this file):** Fable 5 evaluating all models except itself; GPT-5.6 Sol evaluating all models except itself. Treat those as *interested-party analyses*. This file is the triangulation baseline.  
**As-of date:** 2026-08-26  
**Scope:** OpenAI GPT-5.6 Sol / Terra / Luna and Anthropic Claude Fable 5 / Opus 5 / Sonnet 5 / Haiku 4.5. Mythos 5 is noted only where it explains Fable 5's ceiling and classifiers; it is not a generally available worker.

---

## 0. How a director should use this file

Do not pick "the best model." Pick the cheapest model that can finish the *task class* at the required reliability, then escalate on stall, not on vibes.

**Director loop (two or three levels):**

1. Classify the task (section 6).
2. Assign a primary worker and a reviewer that is *not* the same vendor when the work is high-stakes.
3. Set effort/reasoning *down* by default. Raise it only after a stall or on an explicit high-stakes flag.
4. Escalate one rung (same vendor) or cross-vendor (different failure mode) â€” never both at once unless the first escalation also failed.
5. Keep the executing model sticky inside a session. Mid-session model switches burn the prompt cache and re-bill the full context.

**Triangulation rule for blueprints 2 and 3:** Where this dossier and a vendor self-analysis disagree, prefer (a) independent harness scores, then (b) production-shaped task class, then (c) cost-per-*accepted*-result, not token sticker price.

---

## 1. Epistemic rules (read before any score)

Vendor launch tables are not interchangeable.

| Distortion | What it does to routing |
|---|---|
| Harness effect | SWE-bench Verified, SWE-bench Pro, Terminal-Bench, CursorBench, Frontier-Bench, and AA Coding Agent Index use different scaffolds. A 15-point gap on Pro can shrink to 1â€“2 points on Verified under Mini-SWE-agent. Route on *task shape*, not a single leaderboard. |
| Effort / reasoning dial | Most 2026 scores are a curve, not a point. Flattening to one number picks a winner by choosing the dial. Always store `(model, effort, harness)` as a triple. |
| SWE-bench Pro dispute | OpenAI published an audit claiming ~30% of Pro tasks are flawed. Anthropic reports Fable 5 at ~80% Pro vs Sol at 64.6%. Treat Pro as directional for *repo-scale, production-standard* coding, not as a court of law. |
| Classifier fallback | Fable 5 (and sometimes Opus 5) can silently hand a turn to a weaker model on cyber / bio / distillation / reasoning-extraction. Published Fable scores on those domains often describe a *system*, not Fable. |
| Token vs task cost | Fable 5 is 2Ã— Opus 5 per token, but Fable-at-low-effort can beat Opus-at-max-effort on cost-per-success. Luna is 25Ã— cheaper than Sol per token after the July 30 cut, but fails long-context recall. Optimize accepted outcomes, not $/MTok. |
| Knowledge cutoff | Haiku 4.5 is still on a Feb 2025 cutoff. Do not send it anything that requires 2025â€“2026 library, API, or current-events knowledge. |
| Recency | Fable 5.1 may be in stealth routing as of 2026-08-26. This dossier describes GA Fable 5. Re-score if 5.1 is confirmed. |

**Source tiers used below**

- **A** â€” vendor system cards / model overviews / pricing pages
- **B** â€” independent eval orgs (Artificial Analysis, vals.ai SWE-bench, Senior SWE-bench, BridgeBench Dex)
- **C** â€” practitioner reports (Cursor/Codex/Claude Code users, orchestrator write-ups). Used only for *failure modes*, never as a score.

---

## 2. Roster snapshot

### 2.1 Identity and economics

Prices are **standard API** as of 2026-08-26. OpenAI Sol has a promotional cut through at least 2026-11-21 (`$4 / $20`). Tables use the **durable list price**, with the promo noted.

| Model | API ID | Vendor tier | Input / Output $/MTok | Cache write / cache read | Context / max out | Knowledge cutoff | Thinking |
|---|---|---|---|---|---|---|---|
| **GPT-5.6 Sol** | `gpt-5.6-sol` (`gpt-5.6` alias â†’ Sol) | Flagship | $5 / $30 (promo $4 / $20) | 1.25Ã— input / 0.10Ã— input | 1.05M / 128K | 2026-02-16 | none â†’ max; `ultra` = parallel subagents |
| **GPT-5.6 Terra** | `gpt-5.6-terra` | Balanced | $2 / $12 (post Jul 30 cut; was $2.50 / $15) | same family cache | 1.05M / 128K | 2026-02-16 | none â†’ max |
| **GPT-5.6 Luna** | `gpt-5.6-luna` | Fast / cheap | $0.20 / $1.20 (post Jul 30 80% cut; was $1 / $6) | same family cache | 1.05M / 128K | 2026-02-16 | none â†’ max |
| **Claude Fable 5** | `claude-fable-5` | Mythos-class, generally available | $10 / $50 | $12.50 / $1.00 | 1M / 128K | Jan 2026 | Adaptive, **always on**. Effort `low`â€¦`max`, default `high`. |
| **Claude Opus 5** | `claude-opus-5` | Daily frontier | $5 / $25 | $6.25 / $0.50 | 1M / 128K | **May 2026** (freshest) | Adaptive; can be dialed. Default effort `high`. Fast mode â‰ˆ 2.5Ã— speed at 2Ã— price. |
| **Claude Sonnet 5** | `claude-sonnet-5` | Workhorse | $2 / $10 (intro made permanent 2026-08-10) | $2.50 / $0.20 | 1M / 128K | Jan 2026 | Adaptive. New tokenizer â‰ˆ 1.0â€“1.35Ã— more tokens than 4.x. |
| **Claude Haiku 4.5** | `claude-haiku-4-5` / `claude-haiku-4-5-20251001` | Fast / cheap | $1 / $5 | $1.25 / $0.10 | **200K / 64K** | **Feb 2025** | Extended thinking. No effort dial. |

**Batch:** Anthropic batch is typically 50% off input and output. OpenAI Flex/Batch is typically 50% off; Luna Flex â‰ˆ $0.10 / $0.60.

**Relative sticker cost (output-token, list):** Luna 1Ã— â†’ Haiku ~4Ã— â†’ Terra 10Ã— â†’ Sonnet 8Ã— â†’ Sol 25Ã— â†’ Opus 21Ã— â†’ Fable 42Ã—. This ranking **inverts** on some long-horizon jobs because Fable and Sol can finish in fewer turns.

### 2.2 Capability posture in one line

| Model | One-line posture |
|---|---|
| Sol | Best *efficient* long-horizon operator. Wins terminal/agent-index work. Parallelizable via `ultra`. Weaker on Anthropic's repo-Pro coding scores. |
| Terra | GPT-5.5-class everyday brain at roughly half Sol. Safe default OpenAI worker. Long-context recall almost matches Sol. |
| Luna | Extremely cheap, fast, and surprisingly strong on short-horizon agent tasks. **Hard no** for long-context recall. |
| Fable 5 | Highest single-mind ceiling for hard coding, vision, and long autonomous runs. Slow, expensive, classifier-noisy, thinking cannot be turned off. |
| Opus 5 | Best *default director and senior worker* in the Anthropic stack. Near-Fable on many agentic coding/knowledge-work charts at half the token price. Most aligned. Can over-engineer and argue. |
| Sonnet 5 | Best volume agentic coder in the roster. Close to last-gen Opus on many jobs. Wrong for ceiling work and cyber. |
| Haiku 4.5 | Scout / mechanical sub-agent. Fast. Stale knowledge. Small context. Do not let it plan. |

---

## 3. Benchmark map (use as priors, not as policy)

Numbers below are the ones that actually change routing. Mixing harnesses is labeled. Prefer the **shape** over the decimal.

### 3.1 Agentic / long-horizon

| Eval | Sol | Terra | Luna | Fable 5 | Opus 5 | Notes |
|---|---:|---:|---:|---:|---:|---|
| Agents' Last Exam (55-field workflows) | **53.6** | 50.4 | 50.3 | 40.5 | â€” | OpenAI table. OpenAI family dominates this eval. Even Luna beats Fable here. **A** |
| AA Intelligence Index v4.1 | 58.9 (max) | 55 | 51.2 | **59.9** | â€” | Fable barely leads; Sol ~61% less time, ~Â½ cost. **B** |
| BrowseComp | 90.4 / **92.2 ultra** | 87.5 | 83.3 | 84.3 | â€” | Sol SOTA for search-agent loops. **A** |
| OSWorld 2.0 | **62.6** | 50.2 | 45.6 | â€” | Anthropic claims Opus beats Fable at ~â…“ cost | Sol SOTA on this variant. Anthropic OSWorld-Verified is a different cut (Fable reported ~85% there). **Do not mix.** **A** |
| Zapier AutomationBench | â€” | â€” | â€” | â€” | Anthropic: ~1.5Ã— next-best pass rate at same cost | Strong prior that Opus 5 is the automation-tool worker. **A, unpublished number** |

### 3.2 Coding

| Eval | Sol | Terra | Luna | Fable 5 | Opus 5 | Sonnet 5 | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| SWE-bench Pro | 64.6 | 63.4 | 62.7 | **~80 / 80.3** | ~79.2 (some secondary tables) | 63.2 | Fable (and possibly Opus 5) lead *repo-scale, high-standard* coding. OpenAI disputes Pro quality. **A/mixed** |
| SWE-bench Verified (vals.ai, Mini-SWE-agent) | 96.2 | â€” | â€” | 95.0 | **97.0** | â€” | Saturated. Do not route on Verified. Opus slightly ahead, Sol faster/cheaper per test ($1.15 vs $1.29 vs $2.05). **B** |
| AA Coding Agent Index v1.1 | **80** (max, Codex) | 77.4 | 74.6 | 77.2 | just under Sol | â€” | Sol leads *agent-in-a-terminal* coding. **B** |
| Terminal-Bench 2.1 | 88.8 / **91.9 ultra** | 87.4 | 84.7 | 83.1â€“86 | not published (Opus 4.8 was 78.9) | 80.4 | Sol family owns CLI workflows. **A/B** |
| DeepSWE v1.1 | **72.7** | 69.6 | 67.2 | 69.7 | â€” | â€” | Long-horizon real-repo engineering. **A** |
| Frontier-Bench v0.1 | ~37.5 peak | â€” | â€” | ~33.7 peak | **43.3 max / 44.4 xhigh** | â€” | Opus 5 SOTA on this harder agentic-coding bench. Still fails most tasks. **A** |
| CursorBench 3.2 | below both Claudes at peak | â€” | â€” | **highest peak** | within 0.5% of Fable at Â½ cost | â€” | IDE-shaped coding: Claude peak, Opus wins on $ per point. **A** |
| Senior SWE-bench | â€” | â€” | â€” | **#1 overall** | #2 overall; **#1 bug/performance investigation** | â€” | Opus is the specialist debugger. **B** |
| BridgeBench Dex (real-project, Aug 2026) | 6.7 | â€” | â€” | **6.9** | â€” | â€” | Fable: reasoning / one-shot / backend / trust. Sol: balance / workhorse. **B** |

**Coding synthesis for the director:**

- *Repo-scale, production-standard, one-shot or few-shot, "would a staff engineer merge this?"* â†’ Fable 5, then Opus 5.
- *Terminal, tool-loop, tests-in-the-loop, long-running patch agent* â†’ Sol, then Terra, then Fable.
- *IDE-shaped iterative coding at a given dollar* â†’ Opus 5.
- *Bug investigation / RCA* â†’ Opus 5, with Fable as ceiling backup.
- *Volume implementation behind a spec* â†’ Sonnet 5 or Terra.
- Do not use Verified scores to pick a winner. The bench is done.

### 3.3 Science, cyber, computer use, context

| Eval | Sol | Terra | Luna | Fable 5 | Opus 5 | Notes |
|---|---:|---:|---:|---:|---:|---|
| GeneBench Pro | **28.7** | 23.3 | 10.8 | â€” | â€” | Sol is the GA science-agent pick. Luna collapses. **A** |
| LifeSciBench | **59.9** | 56 | 51.2 | â€” | â€” (Opus 4.8: 53.6; Opus 5 claimed better on every life-sci eval) | **A** |
| HealthBench Professional | 60.5 | 57.7 | 55.7 | **60.9** | â€” | Tie-ish at the top. **A** |
| ExploitBench | 73.5 | 52.9 | 33.2 | classifiers suppress; Mythos 5 = 78 | not cyber-trained; close to Mythos at *finding*, far behind at *exploiting* | Sol is the GA defensive-cyber worker. Do not send offensive/cyber-adjacent work to Fable. **A** |
| SEC-Bench Pro | 71.2 / 74.3 ultra | 57.7 | 48.9 | â€” | â€” | **A** |
| MRCR long-context recall | **91.5** | 89.6 | **41.3** | unpublished | unpublished | **Luna cliff is a hard routing constraint.** **A** |
| ARC-AGI 3 | â€” | â€” | â€” | â€” | Anthropic: 3Ã— next-best (no number) | Treat as a prior that Opus 5 has unusual abstract-puzzle generalization. **A** |

---

## 4. Per-model dossiers

Each dossier answers four harness questions: what it is for, what it fails at, how it behaves in a team, and the default dial.

---

### 4.1 GPT-5.6 Sol â€” flagship operator

**Use as:** Senior worker for long-horizon, tool-heavy, terminal, browsing, computer-use, defensive-cyber, and science-agent jobs. Optional director when the job is a parallel fan-out (`ultra` / Responses multi-agent). Cross-vendor reviewer of Claude code.

**Strengths**

- Token-efficient intelligence. On AA Coding Agent Index it leads Fable while using <Â½ the output tokens, <Â½ the time, ~â…“ less cost. This is the property that makes Sol a *harness* model rather than a chat model.
- Long-horizon professional workflows (Agents' Last Exam) â€” largest published gap over Fable 5 (+13.1). Terra and Luna inherit a lot of this; the advantage is family-wide.
- Terminal-Bench / DeepSWE / CLI agents. Native fit for "plan â†’ run command â†’ read output â†’ iterate."
- Computer use and design-judgment loop: generate UI, *look at the rendered result*, patch. Stronger visual QA than prior GPT-5.x.
- Programmatic tool calling (in-memory programs coordinating tools, ZDR-compatible) and first-party multi-agent (`ultra`, default 4-way, up to 16 on some evals).
- Defensive cyber at the GA frontier (ExploitBench 73.5, SEC-Bench Pro 71â€“74). Mythos 5 still leads raw exploit, but Mythos is not a worker you can hire.
- Science/quant-bio (GeneBench Pro, LifeSciBench) â€” clear lead over its own smaller siblings; Luna is not a substitute.
- Long-context recall (MRCR 91.5%) â€” usable as a 1M-context synthesizer.
- Sticky, tenacious operator. Practitioner pattern: stays on a job for a long time, updates agent memory, good at "keep going until the tests pass."
- Fast mode (~2.5Ã— speed at 2Ã— price) and Cerebras path (up to ~750 tok/s) when latency is the constraint rather than intelligence.

**Weaknesses**

- Trails Fable 5 (and likely Opus 5) on SWE-bench Pro / CursorBench-peak / BridgeBench reasoning-and-one-shot. Staff-engineer "would I merge this as-is?" is not Sol's peak.
- Higher hallucination rate than GPT-5.5-max on AA-Omniscience at launch; Aug 6 ChatGPT update cut factual errors ~60â€“68% vs GPT-5.5 Instant on high-stakes finance/legal/med prompts, but the *instruction-following + confident improvisation* failure mode is still reported (C). Symptom: polished code that ignores a stated constraint, invents an API, or rewrites a file that was frozen.
- Over-engineering at high/max reasoning: giant lookup tables, speculative abstractions, extra test cathedrals. Same class of failure as Opus 5.
- `ultra` is a budget weapon. ~3Ã— single-agent Sol for ~3 points on Terminal-Bench. Director must cap agent count and wall-clock.
- Cyber safeguards block ~10Ã— more harmful activity than prior GPT; false-positive friction on legitimate security-adjacent engineering (threat models, exploit *discussion*, pentest fixtures).
- Mid-session switch off Sol invalidates its cache. Do not "just bump to Fable" inside the same OpenAI thread; hand off a *summary + artifacts*, not the raw transcript.
- Knowledge cutoff Feb 16, 2026 â€” older than Opus 5.

**Team behavior**

- Excellent *executor* and *parallel coordinator*. Adequate *director* if the director's job is decomposition + tool fan-out rather than taste/alignment.
- Weak *taste reviewer* relative to Fable on architecture; strong *adversarial reviewer* of Claude diffs (different bug distribution).
- Do not let Sol be both author and sole reviewer.

**Default dial:** `medium` or `high`. `xhigh`/`max` only after a documented stall. `ultra` only for independent workstreams (browse + exploit-triage + test-matrix), never for a single-file edit.

**Do not send Sol:** cheap extraction, lint, grep, or any job Luna/Terra will finish. Sol is the expensive specialist.

---

### 4.2 GPT-5.6 Terra â€” OpenAI default worker

**Use as:** The OpenAI workhorse. Implementation behind a spec, everyday coding, most knowledge-work, long-context jobs that are not Luna-safe, Sol's implementation sub-agent.

**Strengths**

- Competitive with GPT-5.5 at ~Â½ (now ~40%) of Sol's token price. Agents' Last Exam 50.4 vs Sol 53.6 â€” most of the family magic without the flagship bill.
- AA Coding Agent 77.4, slightly *above* Fable 5's 77.2, at a fraction of the cost and time.
- Terminal-Bench 87.4 â€” still ahead of Fable 5 on CLI work.
- MRCR 89.6% vs Sol 91.5% â€” **not** the Luna cliff. Terra is the correct OpenAI model for 200Kâ€“1M context if Sol is not justified.
- Same feature surface as Sol (tools, computer use, cache breakpoints, reasoning persistence). Routing up/down does not require prompt rewrites.
- Life-sci / health still usable (LifeSciBench 56, HealthBench 57.7). GeneBench 23.3 is a step down from Sol 28.7 but far above Luna 10.8.

**Weaknesses**

- Not the ceiling. Hard architecture, novel algorithms, and "staff merge bar" still want Sol or a Claude flagship.
- Cyber is a large step down from Sol (ExploitBench 52.9 vs 73.5; SEC-Bench Pro 57.7 vs 71.2). Do not use Terra as the cyber specialist.
- OSWorld 50.2 vs Sol 62.6 â€” computer-use polish is a Sol feature, not a family feature.
- Same instruction-following / over-engineering family traits as Sol, usually milder at `medium`.
- Long-context *input* is billed higher than short-context on OpenAI ($5 / $22.50 reported for Terra long-context). A 1M dump is not "cheap because it's Terra."

**Team behavior**

- Best OpenAI *level-1 worker* under a Sol or Opus director.
- Best OpenAI *level-2 implementer* under a Sol planner (Cerebras/Codex pattern: Sol directs, Terra codes).
- Can substitute for Sonnet 5 on many jobs; choose on vendor-diversity and cache locality, not on a 2-point bench delta.

**Default dial:** `medium`. Escalate to `high` on test-fail loops. Promote to Sol rather than to Terra-`max` when the issue is judgment, not tokens of thought.

---

### 4.3 GPT-5.6 Luna â€” cheap parallel muscle

**Use as:** High-volume short-horizon work: extract, transform, classify, summarize *short* documents, mechanical edits, test generation from a spec, fan-out sub-agents that do not need to remember the whole repo.

**Strengths**

- After the Jul 30 cut, this is the cost outlier of the entire seven-model roster: $0.20 / $1.20. Cached reads ~$0.02 / MTok. Flex even lower.
- Agents' Last Exam 50.3 â€” statistically tied with Terra, *above Fable 5*. Short-to-medium professional workflows do not need a flagship.
- AA Coding Agent 74.6, Terminal-Bench 84.7, DeepSWE 67.2 â€” all "good enough" for bounded coding sub-tasks, and faster than Haiku on TTFT (~1.6â€“3.1s vs Haiku reasoning ~15â€“24s on AA comparisons).
- Output speed ~130â€“150 tok/s vs Haiku 4.5 reasoning ~97â€“118 tok/s (AA). Luna wins the cheap-and-fast lane against Haiku on latency.
- Same 1.05M window *on paper* as Sol â€” but see the cliff.

**Weaknesses (treat as hard constraints)**

- **MRCR 41.3% vs Terra 89.6%.** Luna cannot be trusted to retrieve a fact from a large haystack. Never give it a repo dump, a 200K PDF, or "use the whole thread." Chunk *before* Luna sees the prompt, or route to Terra/Haiku-with-RAG.
- GeneBench 10.8, ExploitBench 33.2, SEC-Bench 48.9 â€” specialist domains are not "Luna at max reasoning." Escalate.
- OSWorld 45.6 â€” not a computer-use closer.
- Recovery from an underspecified or wrong turn is weak. Luna is a poor self-debugger. The parent must specify acceptance tests.
- Sharing a 1.05M context window with Sol/Terra tempts directors to dump context into Luna "because it fits." It fits; it does not *recall*.

**Team behavior**

- Level-2 only, with a written contract: inputs, outputs, tools allowed, done-when.
- Parallelize aggressively. Luna's value is N-way map-reduce, not sequential wisdom.
- Pair with a Terra/Sonnet/Opus reducer. Never let Luna reduce its own swarm.

**Default dial:** `low` or `medium`. `high` on Luna is usually a category error â€” if you need thought, you needed a different model.

**Vs Haiku 4.5:** Luna is cheaper (post-cut), faster TTFT, stronger on current-year knowledge (Feb 2026 vs Feb 2025), and has a huge context *window* it cannot fully use. Haiku is better at Anthropic-cache-local mechanical work, slightly more stable tail latency in some production reports, and at Claude-shaped tool schemas. **Default cheap OpenAI = Luna; default cheap Anthropic = Haiku. Do not mix inside one cached prefix.**

---

### 4.4 Claude Fable 5 â€” ceiling, not default

**Use as:** Escalation target for the hardest coding, the longest autonomous run, vision-dense reconstruction, and "a senior researcher has to actually figure this out." Optional director for a small number of parallel expensive workers. **Not** the default director in a cost-aware harness.

**Strengths**

- Highest generally available ceiling. Anthropic's own guidance: if you need the highest capability, use Fable 5.
- SWE-bench Pro ~80% â€” the number that still moves routing, even after OpenAI's methodology complaint. WebDev Arena ~1653 Elo with an unusually wide gap. BridgeBench Dex 6.9 (reasoning, one-shot, backend, trust).
- Long-horizon autonomy: stays coherent across very long traces; file-based memory helps more than it did for Opus 4.8 (3Ã— on Anthropic's Slay-the-Spire memory demo â€” treat as a *memory-harness* prior, not a game score).
- Vision: figure digitization, screenshot-to-app, visual debugging. If the worker must *see*, Fable is the first call.
- Knowledge-work peak (Hebbia finance, IMC trading-analysis, core analytics >90% claimed). Artifact quality (decks, spreadsheets) is a stated Fable/Opus strength; Fable is the ceiling of that line.
- Token-efficient *at a given difficulty* on some coding evals (FrontierCode). Low effort on Fable can beat high effort on older models â€” the expensive model used sparingly is not always the expensive choice.
- Skills written for older Claudes are often *too prescriptive* and degrade Fable. The model wants goals, constraints, and tools, not a script. This is a feature if the harness is already goal-shaped.

**Weaknesses (these are why Fable is not the director default)**

- **$10 / $50**, thinking **always on** (sending `thinking: disabled` is a 400). You cannot cheapen Fable by turning its brain off; you can only lower `effort`.
- Latency. Adaptive thinking makes TTFT and total time unpredictable. Multi-minute turns at `high`/`xhigh` are normal; hour-scale autonomous runs exist. Interactive director loops will feel broken unless the harness is async.
- Conservative classifiers on cyber, bio/chem, and distillation. Fallback historically to Opus 4.8 (verify current fallback target). Tuned to <5% of sessions but with false positives. Benign security engineering (CVE discussion, hardening, "write a test that simulates XSS") can eject you from Fable without the director noticing unless fallback is logged.
- Prompts that ask Fable to echo chain-of-thought trigger `reasoning_extraction` refusals. Audit system prompts and skills.
- 30-day retention on Mythos-class business traffic (not used for training). **Opus 5 supports zero data retention; Fable does not, on the same terms.** Enterprise ZDR jobs skip Fable.
- Suspended Jun 12â€“Jul 1 2026. Operational risk is higher than Opus/Sonnet. Treat as a capacity that can be pulled.
- Overkill. Ramp-style spend data (Aug 2026) had Fable at ~11% of Anthropic business spend â€” the market already routes around it. Anthropic's own orchestrator result: Fable director + Sonnet workers â‰ˆ 96% of all-Fable quality at 46% of the cost (BrowseComp). **That result is harness doctrine, not a footnote.**
- Alignment: more misaligned than Opus 5 on Anthropic's automated behavioral audit. Safer than a jailbroken Mythos, less constitutionally tight than Opus 5.

**Team behavior**

- Best as a *called specialist* and as a *fresh-context reviewer* of Sol/Opus work.
- Acceptable director only when the team is small, the task is ceiling-hard, and workers are Sonnet/Terra/Haiku. Do not run a swarm of Fables.
- Anthropic prompting guide: verifier sub-agents, file-based memory, `effort` as the main knob, send-to-user tool for long runs. Copy that pattern.

**Default dial:** `high` for genuine ceiling work, `medium`/`low` if you are using Fable as a cheap-relative-to-old-Opus-xhigh brain. `xhigh`/`max` are rare.

**Do not send Fable:** cyber, dual-use bio, CoT-echo prompts, high-QPS interactive chat, ZDR workloads, or anything a Sonnet worker would finish.

---

### 4.5 Claude Opus 5 â€” default director and senior Anthropic worker

**Use as:** The default top-level director in a mixed Claude/OpenAI harness, and the default senior worker for complex agentic coding, enterprise knowledge work, computer-use closing, and verification. This is the load-bearing model of the roster.

**Strengths**

- Near-Fable intelligence at half the token price, with thinking that *can* be dialed and with Fast mode when latency matters.
- Frontier-Bench v0.1 SOTA (43.3â€“44.4%) â€” harder agentic coding than saturated Verified. CursorBench: within 0.5% of Fable's peak at Â½ cost per task. GDPval-AA: Anthropic claims SOTA knowledge work.
- Verification instinct: opens its own frontend at desktop *and* mobile widths, finds fold/off-screen bugs, iterates until the page works. Writes tight diffs, less dead code. Senior SWE-bench: best in *bug and performance investigation*.
- Judgment: pushes back on bad designs instead of sycophantically implementing them. High first-turn legal redlines; cleaner PR handoff (branch, template, tests).
- Most aligned Claude on Anthropic's audit (overall misaligned behavior 2.3 â€” lowest). Lowest deception, hardest to trick into misuse, most careful about irreversible side effects. **This is why it should be the director**, not just because it is smart.
- Freshest knowledge cutoff (May 2026). Only model in this roster that knows the post-February 2026 world reliably.
- Computer-use cost curve: Anthropic claims it beats Fable's best OSWorld 2.0 result at just over â…“ the cost. Zapier AutomationBench: ~1.5Ã— next-best pass rate at same spend.
- Life sciences: better than Opus 4.8 on every internal life-sci eval (organic chem +10.2, protein function +7.7). Not Mythos, but the right GA Claude for science that is not dual-use-blocked.
- ~85% fewer classifier interventions than Fable 5. Automatic fallbacks can be configured so a flagged request continues on another model instead of dying.
- Mid-conversation tool-set changes without busting the prompt cache (beta) â€” important for a director that enables tools per worker-phase.
- Lower run-to-run variance than Opus 4.7/4.8 on Anthropic internal evals. Directors need predictability more than peak.

**Weaknesses**

- Not the ceiling. Fable still wins peak CursorBench, SWE-Pro-class repo work, and some one-shot / vision / longest-horizon jobs.
- Behind Mythos 5 (and usually Sol) on offensive/defensive cyber. Anthropic did not train Opus 5 on cyber tasks; capability leaked in via generality. Fine for "find the vuln," wrong for "weaponize it," and Fable will often refuse the whole topic anyway.
- Over-engineering and argumentativeness (C, widespread in Julâ€“Aug 2026). Same failure as Sol: simple parse becomes a 400-line table. Some developers report combative refusals of simple tasks, bizarre comments, unfinished work, fast limit drain. **Director prompt must include "smallest change that passes the tests" and a scope cap.**
- Fast mode doubles price. Using Fast as the silent default erases the Fable-price advantage.
- Still fails most Frontier-Bench tasks (43% is SOTA and also a coin-flip). Unsupervised Opus is not unsupervised staff. Always keep a verifier path.
- Adaptive thinking at `high` (the default) will overthink short tasks. Director-to-self and director-to-Opus-worker should set `medium` unless the task class says otherwise.

**Team behavior**

- **Primary director candidate** for the Pi harness: decomposes, assigns, critiques, refuses bad plans, verifies, and is the least likely model to deceive the user or the workers.
- Excellent level-1 worker for architecture, RCA, multi-file features, eval-harness design, and "make this correct."
- Cross-vendor pair: Opus plans, Sol executes in the terminal, Fable reviews the hard PR â€” or the reverse for Claude-shaped codebases.
- Do not stack Opus-as-director and Opus-as-only-worker on the same problem without a different-vendor or fresh-context reviewer. Self-review miss rate on serious errors is still high (~80% of traces have a residual issue in one adversarial-review write-up; that figure is C-tier but the *policy* of always having a second pair of eyes is A-tier common sense).

**Default dial:** `medium` for director turns; `high` for senior-worker coding; `max` only on Frontier-hard tasks. Prefer promoting *to Fable* over Opus-`max` when the miss is ceiling, and promoting *to Sol* when the miss is terminal/tool-loop tenacity.

---

### 4.6 Claude Sonnet 5 â€” volume agentic worker

**Use as:** Default Anthropic level-1/level-2 implementer. The model Anthropic explicitly designed to be "the most agentic Sonnet," and the one their own Fable-orchestrator study used as the worker.

**Strengths**

- Agentic follow-through that used to require Opus: plan, use browser/terminal, self-check unprompted, finish Salesforce-style multi-step ops, carry a PR to tests.
- Brownfield coding: race conditions, hidden tests, "messy repo, match the style." This is the everyday SWE job, not the contest job.
- Cost: $2 / $10 permanent (as of 2026-08-10). Cache reads $0.20. The economically correct bulk of a Claude-side swarm.
- Effort dial gives a wide Pareto curve; medium effort is the value knob; high/xhigh can approach last-gen Opus 4.8 on some tasks.
- Fast comparative latency. Interactive workers and user-visible sub-steps should be Sonnet or Luna, not Fable.
- Legal / insurance / enterprise workflow reports are consistently strong for the price (Pareto frontier on some plaintiff-law tasks).
- Safer than Sonnet 4.6 (lower sycophancy, hallucinations, undesirable agentic behavior) though still behind Opus 5 on alignment.

**Weaknesses**

- Not a flagship. SWE-Pro 63.2% sits with Sol/Terra, not with Fable/Opus-5. Do not send it the merge-bar architectural decision.
- Cyber: 0% working-exploit success on Mozilla Firefox eval. Classifiers + lack of training. Fine â€” we do not want Sonnet doing that. Route cyber to Sol (defense) or a human.
- New tokenizer can emit 1.0â€“1.35Ã— more tokens than 4.x. The $2/$10 list price is not a 33% cut vs Sonnet 4.6's $3/$15 on every workload. Measure *task* cost after migration.
- Higher misaligned-behavior rate than Opus 5 / Mythos Preview on Anthropic's audit. Do not make Sonnet the director of a swarm that can take irreversible actions (payments, prod deploys, mass mail).
- Knowledge cutoff Jan 2026 â€” behind Opus 5.
- Will stall on ceiling tasks that Fable/Opus would finish. Escalation policy must be automatic (test fail N times, or worker self-reports stuck).

**Team behavior**

- The Anthropic worker in "Fable/Opus directs, Sonnet executes." Empirically 96% quality at 46% cost vs all-Fable on BrowseComp in Anthropic's study. **Copy this topology.**
- Good level-2 under Opus for mechanical-but-agentic work (multi-step, tools, still needs a brain).
- Pair with Haiku scouts: Haiku gathers, Sonnet changes, Opus/Fable reviews.

**Default dial:** `medium` for volume, `high` when the worker owns a whole PR. If `high` still fails, escalate model, do not go to Sonnet-`max` as a habit.

---

### 4.7 Claude Haiku 4.5 â€” scout and mechanical sub-agent

**Use as:** Level-2 only. File navigation, grep/symbol lookup, lint, boilerplate, short rewrites, classification, extraction from *already-retrieved* snippets, UI-side cheap completions.

**Strengths**

- Fastest Claude. Extended thinking available when a short chain is needed.
- $1 / $5, cache reads $0.10. At hundreds of tool calls per session this is the difference between a viable swarm and a melted budget.
- SWE-bench Verified 73.3% *at Oct 2025 launch* was near then-Sonnet-4. That is **not** 2026-frontier coding, but it is plenty for "open the file and rename the symbol."
- Computer use exists (OSWorld ~50.7% at launch). Usable for dumb click-paths, not for closing a novel GUI task.
- Anthropic-shaped tools and Claude cache locality. If the parent is Sonnet/Opus, Haiku sub-calls keep one vendor's prefix warm.

**Weaknesses (hard constraints)**

- **200K context / 64K max out.** Cannot see a large repo. Parent must retrieve, then hand a packet.
- **Knowledge cutoff Feb 2025.** Eighteen months stale as of this dossier. Will invent or omit modern APIs. Any task touching 2025â€“2026 libraries, model names, or current events is a misroute.
- Coding percentile has fallen to the middle of the pack in 2026 aggregate boards. Not an implementer of record.
- No effort dial. You get what you get; extended thinking is the only depth knob, and it hurts the latency that is Haiku's reason to exist.
- Weak recovery. Like Luna, it needs a contract and a parent who checks.

**Team behavior**

- Scout: "find the three files that mention X, return paths + 20-line windows."
- Janitor: formatting, import sort, generated types, changelog bullets.
- Never director. Never reviewer of flagship output. Never owner of a feature.

**Default dial:** thinking off unless the scout query is a small puzzle. If you needed thinking, you probably needed Sonnet.

**Vs Luna:** see Â§4.3. If the swarm is OpenAI-cache-local, Luna. If Claude-cache-local, Haiku. If the task needs 2026 knowledge or >200K context, Luna still loses to Terra on recall â€” use Terra or Sonnet.

---

## 5. Comparative matrices for the director

### 5.1 Who wins which *job*, not which *bench*

| Job | First call | Second call | Avoid |
|---|---|---|---|
| Top-level director (decompose, assign, refuse, verify) | **Opus 5** | Sol (if the job is parallel tool fan-out) | Fable (cost/latency), Sonnet (alignment), Luna/Haiku (judgment) |
| Staff-level architecture / "would we merge this?" | **Fable 5** | Opus 5 | Luna, Haiku, Terra-low |
| Terminal / CLI / test-loop agent | **Sol** | Terra | Haiku |
| Repo-scale hard bug, RCA | **Opus 5** | Fable 5 | Luna, Haiku |
| Volume feature implementation behind a spec | **Sonnet 5** or **Terra** (match vendor of the spec-author for cache) | Sol-medium | Fable, Haiku-as-owner |
| Mechanical map-reduce (extract, classify, boilerplate) | **Luna** or **Haiku** (match vendor) | Terra / Sonnet if quality dips | Fable, Sol, Opus |
| Long-context recall / 200Kâ€“1M needle | **Sol** or **Terra** | Opus 5 / Fable 5 / Sonnet 5 (1M window) | **Luna**, **Haiku** |
| Computer use / visual QA of UI | **Opus 5** or **Sol** | Fable 5 (vision ceiling) | Luna, Haiku as closer |
| Defensive cyber (review, patch, threat model) | **Sol** | Terra (only if Sol is blocked) | **Fable 5** (classifiers), Sonnet, Haiku |
| Dual-use bio / chem research | Human + trusted-access Mythos, not this roster | Sol (GeneBench) / Opus 5 (life-sci, non-dual-use) | Fable 5 (fallback/refuse) |
| Science / genomics / medchem analysis | **Sol** | Opus 5 | Luna, Haiku |
| Knowledge work artifacts (decks, memos, spreadsheets) | **Opus 5** | Fable 5 (ceiling), Sol (design+computer-use) | Luna, Haiku |
| Legal redlines / careful enterprise docs | **Opus 5** | Fable 5 | Luna, Haiku |
| Browsing / Deep research loops | **Sol** (`ultra` if independent queries) | Sonnet 5 (cheap agentic search) | Haiku as owner |
| Fresh-context adversarial review | **Opposite vendor flagship** (Fableâ†”Sol, or Opusâ†”Sol) | Opus 5 if author was Sonnet/Terra | Same model that authored |
| User-visible interactive latency | **Luna** or **Sonnet 5** or Haiku | Terra / Opus Fast | Fable, Sol-max, ultra |
| ZDR / no-retention enterprise | **Opus 5**, GPT-5.6 family | Sonnet 5, Haiku | **Fable 5** (30-day Mythos-class retention) |

### 5.2 Failure-mode complementarity (why the harness is cross-vendor)

These models do not fail the same way. That is the product.

| Failure mode | More OpenAI (esp. Sol) | More Anthropic (esp. Fable/Opus) | Harness move |
|---|---|---|---|
| Constraint violation / "I ignored the frozen file" | Commoner in GPT-5.6 user reports | Less common; Claudes usually over-obey | Claude reviewer on OpenAI diffs, with the original constraints pasted |
| Over-engineering | Sol and Opus 5 both do this | Fable can too at high effort; Sonnet less so | Spec + "smallest diff" + test gate; reviewer from the *other* vendor |
| Sycophancy / implementing a bad plan | Lower on Opus 5 (pushes back) | Fable/Sonnet more willing to comply than Opus 5 | Opus as director specifically to *reject* worker plans |
| Classifier / refusal on benign security | Sol: cyber safeguards, but still the cyber worker | Fable: frequent fallback; Sonnet: near-zero cyber | Route all cyber-adjacent to Sol; never to Fable |
| Long-context miss | Luna is the disaster case | Haiku cannot even ingest the context | Hard route-filter, not an effort bump |
| Hallucinated APIs / current-year facts | Sol improved Aug 2026 but still improvises | Haiku is a year stale; Opus 5 is freshest | Opus 5 or a retrieval step for post-Feb-2026 facts |
| Visual / UI miss | Sol has a strong inspect-and-fix loop | Opus 5 also inspects desktop+mobile; Fable vision ceiling | Require a computer-use verification pass on any UI |
| Getting stuck in a tool loop | Claudes stall more on terminal-heavy jobs | OpenAI family weaker on "merge-bar" one-shots | Stall on CLI â†’ Sol; stall on design quality â†’ Fable/Opus |
| Deception / reckless irreversible action | Not the alignment leader | **Opus 5 is the alignment leader** | Irreversible tools only on Opus-director approval |

### 5.3 Cost-shaped default mix (starting prior)

Until the harness has its own traces, use this mix for a general software/research agent team. It is a prior, not a quota.

| Role | Model | Share of calls (not of spend) |
|---|---|---|
| Director | Opus 5 @ medium | 5â€“8% of calls, 15â€“25% of spend |
| Senior worker / ceiling | Fable 5 @ high **or** Sol @ high | 3â€“7% of calls, 20â€“30% of spend |
| Implementer | Sonnet 5 @ medium **or** Terra @ medium | 25â€“40% of calls |
| Cheap swarm | Luna @ low/medium **or** Haiku @ no-think | 40â€“60% of calls, small spend |
| Cross-vendor reviewer | Opposite flagship, fresh context, constrained prompt | 3â€“8% of calls, high value per call |

If spend shares invert (director+ceiling > 70%), the director is not delegating enough. If cheap-swarm share is high *and* accept rate is low, the director is under-escalating.

---

## 6. Task-class routing table (operational heart)

The director classifies into **one** class, then applies the row. Escalation is downward in the table only when the class was wrong.

Effort keys: `L M H Xh Mx` = low / medium / high / xhigh / max. `ul` = Sol ultra.

| ID | Task class | Signals | Primary | Effort | Reviewer | Escalate to | Kill / reroute |
|---|---|---|---|---|---|---|---|
| D0 | Direction, decomposition, go/no-go | "plan the work", multi-agent, irreversible side effects | **Opus 5** | M | â€” | Sol if the plan is a parallel tool DAG | Luna/Haiku/Sonnet as director |
| D1 | Adversarial review of another model's artifact | PR, spec, threat model, "find what they missed" | Opposite flagship (**Fable** if author is GPT; **Sol** if author is Claude) | H | â€” | Opus 5 if reviewer is too slow/expensive | Same model that authored |
| C0 | Staff architecture / novel algorithm / one-shot system | blank-slate hard, "design the subsystem" | **Fable 5** | H | Sol or Opus, fresh | Fable Xh / Sol max | Sonnet, Terra, Luna |
| C1 | Multi-file feature behind a written spec | spec exists, tests exist or can exist | **Sonnet 5** or **Terra** | Mâ€“H | Opus 5 (logic) or Sol (tests) | Opus 5, then Fable or Sol | Haiku as owner |
| C2 | Terminal / repro / test-loop / CLI plumbing | lots of shell, logs, flaky env | **Sol** | H | Opus 5 on the final diff | Sol ul if independent axes | Fable (slow), Haiku |
| C3 | Bug RCA / performance / Heisenbug | "why is this broken", profiler, race | **Opus 5** | H | Fable 5 if still stuck | Fable; Sol if it's an env/tool issue | Luna, Haiku |
| C4 | Mechanical edit, rename, generate N files from template | bounded, local, checkable | **Luna** or **Haiku** | L/M | Parent worker spot-check | Terra / Sonnet | Flagships |
| C5 | Large-repo navigation / "find the owners of X" | search, cite paths | **Haiku** (Claude tree) or **Luna** (OpenAI tree) with retrieved windows | L | Parent | Sonnet/Terra if search fails | Dumping the repo into Luna |
| K0 | Long-context synthesis (needles, multi-doc) | >100K tokens that must be *used* | **Terra** or **Sol** or Claude 1M-window | Mâ€“H | Opposite vendor on the *conclusions* only | Sol if Terra misses | **Luna**, **Haiku** |
| K1 | Deck / memo / spreadsheet / polished artifact | visual structure, brand, numbers | **Opus 5** | H | Fable 5 for ceiling polish | Fable | Luna, Haiku |
| K2 | Legal / policy / redline | irreversible language | **Opus 5** | H | Human; Fable if needed | Fable | Any cheap model as owner |
| S0 | Defensive cyber, patch, code review for vulns | CVE, sandbox, exploit *defense* | **Sol** | Hâ€“Mx | Human | Sol ul | **Fable 5**, Sonnet, Haiku |
| S1 | Life-sci / genomics / chemistry *analysis* (non dual-use) | papers, sequences, spectra | **Sol** | H | Opus 5 | Human / trusted Mythos | Fable 5 (classifiers), Luna |
| U0 | Computer-use close (click, inspect UI) | screenshots, rendered app | **Opus 5** or **Sol** | H | Fable if vision-hard | Fable | Luna/Haiku as closer |
| U1 | Screenshot â†’ structure / figure digitization | images as the source of truth | **Fable 5** | H | Opus 5 | â€” | Luna, Haiku, Terra |
| R0 | High-QPS user-facing chat | latency SLO | **Luna** or **Sonnet 5** or Haiku | L/M | Silent escalate to Terra/Opus on confusion | Terra / Opus Fast | Fable, ultra |
| X0 | Unknown / first time we see this class | no row matches | **Opus 5** probe @ M (short) | M | â€” | Reclassify after probe | Spending a flagship on the probe itself beyond one short turn |

**Vendor stickiness:** Once a class C1/C2/C4 job is in flight, stay on that vendor until handoff. Handoffs pass `goal, constraints, files-touched, tests, failures` â€” not the raw chain of thought (which can also trigger Fable extraction refusals).

---

## 7. Escalation, stall, and anti-patterns

### 7.1 Stall detector (director policy)

Escalate when **any** two fire:

1. Same error class repeats â‰¥2 tool-fix attempts.
2. Worker proposes a third architectural approach without new evidence.
3. Test suite is not monotonically improving.
4. Worker asks to "rewrite from scratch" on a bounded bug.
5. Output grew >3Ã— the median for the task class with no new passing tests.
6. Classifier fallback or refusal fired.

Escalation order:

- Same vendor, one rung up, **same effort** first (the model was wrong, not under-thought).
- If that fails: **cross-vendor** at the same seniority (Sol â†” Opus, Terra â†” Sonnet).
- If that fails: ceiling (Fable 5 or Sol-max/ultra), with a human checkpoint if irreversible.

Never: Luna â†’ Fable in one hop; Haiku â†’ Sol-ultra; bumping effort three times on the same model.

### 7.2 Anti-patterns (observed in the wild, bake into the harness)

1. **Flagship default.** 99% of Opus-5-for-everything and Sol-for-everything spend is waste. Cheap models now clear most professional workflows (Luna 50.3 vs Fable 40.5 on Agents' Last Exam is the exhibit).
2. **Mid-session model switch.** Cache is per-model. Switching re-bills the haystack. Handoff summaries instead.
3. **Luna-with-a-repo.** Window size â‰  recall. This will silently drop needles.
4. **Fable on cyber.** You will get Opus-fallback or a refusal and think you got Fable intelligence.
5. **CoT-echo prompts on Fable.** Skills that say "show your reasoning" trip `reasoning_extraction`.
6. **Ultra / max / xhigh as a personality.** They are incident-response tools.
7. **Same-model self-review.** Residual serious-error rate stays high. Cross-vendor, fresh context, constraints pasted.
8. **Sonnet/Haiku as director of irreversible tools.** Alignment ranking exists for a reason.
9. **Ignoring tokenizer and thinking tokens.** Sonnet 5's new tokenizer and Fable's always-on thinking make sticker-price comparisons lies. Log *task* cost.
10. **Treating SWE-bench Verified as a routing signal.** It is saturated (~95â€“97%). Route on Pro / Frontier / Terminal / Senior-RCA / your own evals.
11. **Dumping old Sonnet-3.x/4.x skills onto Fable.** Too prescriptive; degrades output. Goal + constraints + tools.
12. **Fast mode as silent default on Opus/Sol.** You just bought Fable prices for Opus intelligence.

### 7.3 Safety routing (harness-level, not model-level)

| Content | Route | Reason |
|---|---|---|
| Offensive cyber, exploit development | Refuse at director; do not send to any worker | Policy. Sol and Mythos can, Fable will fallback, still not our job. |
| Defensive cyber, patching, secure review | Sol | Only GA model that is both capable and allowed. |
| Dual-use bio/chem that looks like design of pathogens / delivery | Refuse / human | Fable classifiers + policy. |
| Non-dual-use life-sci analysis | Sol primary, Opus 5 secondary | Capability vs cutoff vs classifiers. |
| Irreversible prod action | Opus 5 director must approve | Alignment leader. |
| User-secret / ZDR | GPT-5.6 or Opus/Sonnet/Haiku | Skip Fable. |
| Minor / sexual / self-harm | Director hard-refuse | Do not delegate; do not "route to the aligned model." |

---

## 8. Suggested Pi harness topology

Two legal depths. No third level of *models* (Haiku/Luna may be tools of a level-1 worker, which is the allowed extra level).

```
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚   DIRECTOR  (Opus 5)    â”‚
                    â”‚  classify, assign,      â”‚
                    â”‚  approve irreversible,  â”‚
                    â”‚  stop bad plans         â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
           â–¼             â–¼                â–¼              â–¼
     Senior Worker   Implementer      Swarm         Reviewer
     Fable 5  or     Sonnet 5 or      Luna or       opposite
     Sol             Terra            Haiku         flagship
           â”‚             â”‚                â”‚              â”‚
           â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜              â”‚
                  â–¼               â–¼                      â”‚
            Level-2 only:    Luna/Haiku scouts           â”‚
            (optional)       under the implementer       â”‚
                  â”‚                                      â”‚
                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º artifacts â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Contract objects** every edge must pass (keep this stable so blueprints 2 and 3 can argue about *models*, not *schema*):

```yaml
task:
  class_id: C2
  goal: ""
  constraints: []          # frozen files, APIs, latency budget
  done_when: []            # tests, screenshots, numeric checks
  tools: []
  irreversibility: none | reversible | prod
  context_packet: ""       # retrieved slices, not the universe
  vendor_affinity: openai | anthropic | none
report:
  status: done | stalled | refused | fallback
  artifacts: []
  tests_passed: []
  failures: []
  cost_usd: 0.0
  model: ""
  effort: ""
```

**Cache law:** `vendor_affinity` is sticky for the duration of a `task`. Reviewer is allowed to be the other vendor because the reviewer gets a *fresh* packet, not the live cache.

---

## 9. What this dossier is not, and what blueprints 2 & 3 must add

This file is a **routing prior** assembled from public A/B sources plus C-tier failure modes. It is not a substitute for:

1. **Pi-harness-native evals.** Run the same 30â€“50 tasks through all seven models (except: Fable 5 does not grade Fable 5; Sol does not grade Sol â€” that is the point of blueprints 2 and 3). Score *accepted* result, dollars, wall-clock, and stall rate.
2. **Vendor-blind spots.** Fable 5 will understate Claude classifier pain and overstate merge-bar coding. Sol will understate instruction-following misses and overstate Agents' Last Exam as a universal intelligence ranking. Where they agree with this file, promote the claim to policy. Where they disagree, run the eval.
3. **Live capacity and silent snapshots.** Fable 5.1 stealth routing, Sol Aug-6 factuality patches, and promotional prices all move. Pin `model_id + date + price` in traces.
4. **Personality under *your* system prompt.** Over-engineering and pushback are prompt-sensitive. The director prompt is part of the model.

**Questions blueprints 2 and 3 should be forced to answer (same questionnaire, both models):**

- For each of the 16 task classes in Â§6, which model would you actually assign, and which two would you forbid?
- Where do you systematically fail in ways the other vendor's flagship does not?
- What effort dial is the *economic* default, not the score-max default?
- What should a director's stall detector look at in your traces?
- What must never be in a prompt sent to you (classifiers, extraction, sycophancy triggers)?
- If you are not allowed to recommend yourself, who is the default director?

Until those two files exist, **ship with this prior:** Opus 5 directs; Sonnet 5 and Terra implement; Luna and Haiku swarm; Sol owns terminal/cyber/science loops; Fable 5 is the ceiling and the Claude-side reviewer of OpenAI work; every high-stakes artifact gets one opposite-vendor look.

---

## 10. Changelog

| Date | Event that would invalidate a row |
|---|---|
| 2026-06-09 | Fable 5 GA; Mythos 5 gated |
| 2026-06-12â€“07-01 | Fable/Mythos suspension and redeploy |
| 2026-06-30 | Sonnet 5 GA |
| 2026-07-09 | GPT-5.6 family GA (preview from 2026-06-26) |
| 2026-07-24 | Opus 5 GA |
| 2026-07-30 | Terra âˆ’20%, Luna âˆ’80% |
| 2026-08-06 | Sol/Luna factuality update in ChatGPT; Luna default for Free/Go |
| 2026-08-10 | Sonnet 5 $2/$10 made permanent |
| 2026-08-21 | Sol promo $4/$20 (~3 months) |
| 2026-08-26 | This dossier. Possible Fable 5.1 stealth â€” unconfirmed, not routed. |
