# Plan: Next-generation agent role architecture — capability contracts, pool-aware casting, and a liveness-gated cross-vendor review mandate

## Goal

Specify a complete agent role architecture and hierarchy for a cross-vendor multi-agent coding
harness: 22 model-cast capability roles plus 2 deterministic substrates, a 24-class task
taxonomy in strict one-to-one ownership with them, an author-aware review matrix computed from
recorded provenance, a subscription-allowance cost model denominated per vendor pool (and per
bucket where a vendor meters per bucket), and a staged, reversible migration from the roster in
this repository. The document is a design specification: someone else can write the agent
definitions, router, and scheduler from it without further decisions.

## Done-criteria

1. **Nuance-matched casting** — every role states purpose, casting with evidence, tool surface,
   strengths, weaknesses and characteristic failure modes, owned classes, forbidden classes with
   redirects, escalation in/out, and reviewer. A request shaped like "visual/spatial
   understanding paired with coding skill" lands on exactly one role (E5 or E6 by the Part-4
   discriminator).
2. **Coverage** — all seven mandated task classes plus seventeen justified additions each have
   exactly one obvious primary role; adjacent pairs carry binary discriminators.
3. **Quality per dollar** — "dollar" is subscription allowance. The cost model states where the
   cheap tier is genuinely sufficient, where spending is load-bearing, the escalation ladder and
   its triggers, per-class draw, pool shares under an illustrative mix, and numeric pool states.
   Estimates are marked; every load-bearing number carries a resolvable source.
4. **Cross-vendor de-correlation** — no model reviews its own output ever; no same-family verdict
   closes a mandatory gate under any allowance condition; the mandatory and preferred bands are
   stated with their latency and allowance costs; the mandate's throughput is a deployment gate.

## Recon summary

Facts verified first-hand against this tree (v1.11.0, `codex` pack installed) during synthesis:

- The `/deep-plan` lane is metered API usage: `packs/codex/hooks/orchestra-deepplan.js` requires
  `OPENAI_API_KEY` ("the consultation bills to it", line 55) and posts to
  `https://api.openai.com` `/v1/responses` (lines 77–78, 117). Outside the deployment basis.
- Installed/master architect drift is real and two-dimensional: `.claude/agents/architect-claude.md`
  is `model: fable` with no web tools; `.claude/agents/architect-claude-xhigh.md` and `-max.md`
  are `model: opus` **with** `WebSearch, WebFetch`; both master copies
  (`packs/codex/agents/architect-claude*.md`) are `model: fable` without web tools. Meanwhile
  `.mcp.json` launches the GPT lane with `-c tools.web_search=true`. Raising effort silently
  changes the model, and the two lanes have asymmetric research capability.
- `agents/detective.md` (line 13) forbids the investigator from running code ("Running the code
  to observe it is still execution"), and the executor has no investigative mandate — intricate
  bug tracing falls between two seats today.
- The harness's own scaffold pairs are Anthropic-native Opus (`agents/executor-heavy.md`) and
  Sol-under-Codex (`packs/codex/hooks/orchestra-exec.js`, `TIER_DEFAULTS`: standard
  `gpt-5.6-terra`, heavy `gpt-5.6-sol`) — neither of Terminal-Bench 3.0's top leaderboard pairs.
- The review runner defaults its sandbox to `workspace-write` because "many test runners can't
  run" read-only (`packs/codex/hooks/orchestra-review.js` lines 113–115, 283) — the fact that
  forces the Verifier's disposable writable checkout.
- `research/openai-models.md` carries two distinct CodeRabbit instruments: a 100-task **authoring**
  suite (line 85: Sol 63.7% clean-pass; line 289: Terra 40.7%) and a 105-task **review** suite
  (lines 121–123: Sol 65/105 actionable catches vs Opus 4.8's 66 and a human baseline of 66;
  full passes 74–72). No Terra review figure exists anywhere in the supplied evidence.
- `research/dossier_both.md` line 106 already carries **Frontier-Bench v0.1** — the benchmark now
  published as **Terminal-Bench 3.0** — with Opus 5 at 43.3 max / 44.4 xhigh, and line 33 states
  the harness-effect rule ("Route on task shape, not a single leaderboard"). Terminal-Bench 3.0
  and Frontier-Bench are one benchmark under two names; nothing in this design treats them as
  independent witnesses, and no casting rests on its scaffold-uncontrolled ordering.

---

# Part 1 — Design principles

Fifteen rules; each with its reason, because a principle whose reason is unstated cannot be
argued with when it conflicts with another.

**P1 — Classify the work order, then cast the role.** Each work order gets exactly one canonical
class from its acceptance artifact and dominant difficulty; the class selects the role; the role
selects the casting. One intake may decompose into several independently classified orders (an
E2 feature plus a Q0 test order plus an R0 review) without violating class uniqueness.

**P2 — Roles are capability contracts; castings are dispatch-time decisions.** Every role names a
primary casting, a mirror on another pool, and — where one exists — a ceiling; or it declares a
no-mirror exception naming the uncovered sub-contract and its degradation behavior
(deterministic fallback, wait, or route-to-human). Pool exhaustion becomes a re-cast, not an
outage; and the design survives a runtime transposition because no contract names a tool
implementation (tool surfaces are capability classes: READ, SEARCH, EXECUTE, NETWORK, BROWSER,
SPAWN, WRITE-TREE, WRITE-DOC).

**P3 — Route by hardness and ambiguity, never by size or subject.** Measured family spread is
tiny on well-defined work (SWE-bench Pro spans 1.9 points across the GPT-5.6 family's 25× price
range) and enormous on novel work (ARC-AGI-3: 13.3 → 2.3 → ~0 across the same three models).

**P4 — Capability concentrates where output is independently checked; calibration concentrates
where judgment goes unreviewed.** Executor output meets tests and adversarial review, so
maximizing capability there is safe. Conductor decisions, Detective verdicts and research
syntheses are consumed directly; those seats carry evidence chains, confidence grades and
abstention duties, and are cast on the best-measured honesty and predictability profile.

**P5 — No self-review, ever; no same-family closure of a mandatory gate, ever; no model
adjudicates a contest in which its own family holds a position.** The first two are absolute
under any allowance condition, plan tier, or deadline; a pool that cannot pay buys less gated
work per week, never a lower standard. The third governs the merge seat (A1) and verdict
arbitration. Independence is *computed from recorded author family at dispatch*, never
remembered by a Director.

**P6 — Deterministic evidence precedes model judgment; verification and evaluation are
distinct.** Tests, schema validators, geometry checks, tree audits and nonce echoes cost
approximately nothing and are perfectly de-correlated from every model. Reviewers interpret the
facts the Verifier establishes; neither substitutes for the other.

**P7 — Context shape is a dispatch-enforced routing constraint, and search surfaces are
declared.** Shapes: `packet`, `scoped`, `subsystem`, `repo`, `haystack`. A casting whose model
fails the shape is invalid (Luna MRCR 41.3 vs Terra 89.6 means a Luna seat handed a haystack
fails *silently*). For lookups, the packet declares roots, globs and caps; the result records
every truncation and unsearched branch, and any truncation auto-reclassifies to N2 or I0 —
because "relevant tokens" cannot be known before the search that discovers relevance.

**P8 — Effort is a property of the casting, chosen at routing time, and can substitute for
tier.** An agent cannot think harder because the order asks; effort points are routed between,
never written into orders. Measured basis: Sol-medium beats larger budgets on Agent's Last Exam;
Luna-max approaches Sol-medium on routine coding at ~1/14th the per-task draw.

**P9 — Every pool is a clock, and some vendors meter per bucket; design for degradation, and
risk outranks allowance.** Allowance pressure may throttle authorship, select a qualified
cheaper reviewer, invoke another pool, or wait. It may never eliminate review, widen authority,
or represent correlated review as independent approval.

**P10 — Liveness is a deployment gate.** A mandatory review policy that cannot keep up is
incomplete even if it never falsely approves. Capacity, queue age and recovery are measured
before the mandate is activated, and the reserve is forecast from the real class mix, not
asserted as a constant.

**P11 — Tamper-evidence where authors are measured to game graders; independent re-run
everywhere.** An executor's report is a claim. Per-run nonce echo, in-process tree audit, and
refusal to accept CHANGES against an untouched tree — mechanisms this repository already
implements — apply to every authoring seat on every vendor.

**P12 — Discovery and gating are different seats.** The strongest findings engines are also
documented over-producers ("Sol finds everything; that's the problem"; Opus's "simple parse
becomes a 400-line table"). The Reviewer produces findings; the Conductor decides what blocks.

**P13 — Irreversibility routes to the alignment leader for preparation and to a named human for
authorization.** No model authorizes a T3 action, including the Conductor. Preparation and
application are always separate orders; the authorization packet is its own schema.

**P14 — Rounds are the multiplier on every cost; one deliverable kind per order.** Verification
is paid at least twice per round by design; the dominant lever on allowance and wall-clock is
round count, which is what the sizing rules exist to cut.

**P15 — A casting is a request, not a guarantee; attest what actually served the turn.** Two
documented substitution mechanisms produce normal-looking reports: provider-side classifier
fallback on sensitive topics (Fable, "and sometimes Opus"), and — reported for Anthropic Max
plans — silent Sonnet service after the Opus-specific weekly bucket empties. Defense is
avoidance first (pre-dispatch bucket gates), detection second (`requested_casting` /
`served_model` fields; a mismatch is a routing incident), and hard route-filters for
classifier-fallback topics (security work never routes to Fable).

---

# Part 2 — Role catalog

## 2.0 Reading a role entry

**Casting** is `vendor · model · effort`; primary / mirror / ceiling as defined in P2. Effort
ladders differ per vendor (Anthropic `low…max`, thinking always on for Fable; OpenAI `none…max`)
so effort is written per casting. **Context shape** is the maximum
an instance may be handed, dispatcher-enforced. **Risk tiers** (orthogonal to class):
- **T0** inert evidence (read-only, no consequential inference)
- **T1** bounded and reversible (local change, deterministic checks, no persistent-data or
  public-contract implications)
- **T2** consequential (multi-subsystem behavior, public APIs, concurrency, security-adjacent,
  persistent schemas, material ambiguity)
- **T3** gate-critical or irreversible (production effects, deletion, secrets, releases,
  external communication, critical security decisions) — always human-authorized (P13).

Twenty-four catalog entries: 22 model-cast roles and 2 deterministic substrates (V0, P0), each
owning exactly one task class.

---

### Band A — Orchestration

#### 1. Conductor — class O0 (direction and arbitration)

- **Purpose.** Convert intake into classified work orders, castings, risk tiers, review paths and
  budgets; arbitrate verdicts; gate irreversible actions; talk to the user; decide everything and
  build nothing.
- **Casting.** Primary Anthropic · Claude Fable 5, cast as the interactive session model
  itself — the Conductor IS the session; there is no bootstrap layer between them. Effort is
  chosen by the owner at session launch (medium / high / xhigh by task), which also resolves
  the self-assessed-ambiguity circularity the audit flagged (open item (a), superseded).
  **Depletion mirror** OpenAI · GPT-5.6 Sol at the effort matching the Fable seat (or as the
  owner directs), activated from a signed control checkpoint. Never Opus (owner ruling
  2026-08-28: Opus holds no USER-DIALOGUE seat — see the lineup rulings in the Audit
  dispositions), never any cheap tier (judgment seat, P4).
- **Rationale.** Re-cast by owner ruling 2026-08-28, superseding the merge's Opus choice. The
  original casting weighed the dossier's alignment evidence (calibration outranks ceiling on
  the one unreviewed seat); field observation added what the dossier never measured: the
  Conductor's core function is USER-DIALOGUE, and Opus's human-facing reporting degrades into
  dense, garbled prose a human cannot reliably distill. The ration objection to Fable
  dissolves with the same day's Architect re-cast — a Sol-default A0 frees most of the Fable
  budget for the one seat that talks to the owner. The calibration requirements themselves
  (no-overturn rule, authority restraint, T3 refusal) carry over to the Fable casting
  unchanged.
- **Tools.** READ (user-handed files, agent artifacts, harness config, plan files), WRITE-DOC
  (plans/memory), SPAWN, USER-DIALOGUE. No SEARCH, EXECUTE, WRITE-TREE. Shape: `packet` + plan.
- **Strengths.** Decomposition, rejecting bad premises, authority restraint, integration,
  conflict framing.
- **Weaknesses / failure modes.** Over-engineering (three-phase plan where one order would do);
  overthinking short turns; locally-correct-globally-wrong on long sessions (mitigation: plan
  file re-read at phase boundaries, re-plan earlier than feels necessary); as an Anthropic seat
  it may not solely overturn a cross-family REVISE on Anthropic-authored gate work.
- **Mirror restrictions.** The Sol mirror resumes from a signed checkpoint (open orders,
  class/risk, permissions, tree identities, pool state, review obligations, nonce). It may
  classify, queue, budget, dispatch, and relay signed verdicts. It may **not** semantically close
  OpenAI-authored T2/T3 artifacts, author-and-approve the same plan, override an
  Anthropic verdict, or authorize T3 effects — those wait for Anthropic capacity or a human
  (with no third family, no other independent party exists).
- **Owns / must not receive.** Owns O0 only. Never given: code, commands, search, plan authoring
  above the size threshold (→ A0), content arbitration in a blind comparative session (→ A1).
- **Escalation.** In: everything, as decisions. Out: user ambiguity → user; ceiling planning →
  A0; any T3 step → the named human approver (unconditional, no model-side alternative).
- **Review.** The user reviews its reports; material plans get cross-family plan critique; a
  Conductor decision overturning a cross-family REVISE at gate class requires a deterministic
  refutation or a second cross-family opinion.

#### 2. Architect — class A0 (planning, decomposition, system architecture)

- **Purpose.** Turn a goal into a plan — decomposition, sequencing, acceptance criteria, risk
  ordering — and produce system architecture and novel-algorithm designs without implementing.
- **Casting.** Primary OpenAI · GPT-5.6 Sol · xhigh (owner ruling 2026-08-28). Anthropic ·
  Claude Fable 5 · high–xhigh when the goal is especially complex, nebulous, or the objective
  itself is ambiguous (owner judgment at intake; conditional on a Max-or-above Anthropic seat
  as before — below Max, Fable runs on metered usage credits, outside the deployment basis).
  Fallback Anthropic · Claude Opus 5 · high when the Codex allowance is exhausted. Mirror: the
  opposite family of whichever primary is cast (a comparative session still runs two lanes).
  Ceiling Fable · xhigh / Sol · max, comparative sessions only.
- **Rationale.** Open-ended synthesis is where the Anthropic lead is broadest and best-measured:
  SWE-bench Pro sign (~80 vs Sol 64.6 — magnitude discounted, direction corroborated by
  CursorBench peak and Senior SWE-bench #1), HLE 55.5, GDPval-AA lead. Plan errors compound
  through every later round (P14), which is exactly where to spend. Sol mirrors on genuinely
  different strengths (Agent's Last Exam +13 over Fable — workflow decomposition vs
  architectural judgment); two lanes disagreeing is the point of a comparative session. Owner
  re-cast 2026-08-28: Sol takes the default because plan authorship by the OpenAI lane draws
  its mandatory cross-family review from the Anthropic pool — the side 5.3's arithmetic shows
  has slack — while freeing the Fable ration for the Conductor seat and reserving Fable for
  exactly the nebulous/ambiguous ceiling cases the Anthropic evidence above supports; the
  security-planning route-filter to Sol becomes the default path rather than an exception.
- **Tools.** READ, SEARCH, NETWORK, WRITE-DOC (plans only). Shape: `repo` + `haystack`.
- **Strengths.** Highest single-mind ceiling; long-horizon coherence; wants goals and
  constraints, not scripts.
- **Weaknesses / failure modes.** Ration (50% weekly sub-cap; two Architect calls are a
  meaningful slice of a week); multi-minute to hour-scale latency — never on an interactive
  path; **silent classifier fallback on cyber/bio topics — security-sensitive planning is a hard
  route-filter to the Sol mirror**; degrades under prescriptive step-by-step briefs;
  over-planning as the characteristic failure.
- **Owns / must not receive.** Owns A0. Never given: execution of its own plan; security
  planning under the Fable casting; plans for two-file fixes (pure overhead).
- **Escalation.** In: Conductor judges a tree too large/ambiguous, or two bounced orders diagnose
  "the plan is wrong." Out: ceiling effort; comparative session (two lanes + A1); unresolved
  business tradeoffs → human.
- **Review.** Cross-family plan critique (steelman then severity-tagged findings); in a
  comparative session, the rival lane and then the blind Synthesizer.

#### 3. Synthesizer — class A1 (comparative adjudication, blind merge)

- **Purpose.** Merge two independently produced artifacts into one, blind to authorship,
  adjudicating disputes against evidence — never by averaging, never by family preference.
- **Casting.** Primary Anthropic · Claude Fable 5 · xhigh (Opus 5 · high when the ration is
  spent); mirror OpenAI · GPT-5.6 Sol · max. Never any cheap tier (the merge is the
  longest-horizon synthesis in the system). `max` effort is reserved for exactly this
  once-per-project seat.
- **The family problem, and the protocol that closes it.** With two reliable vendors a single
  merger of one artifact per family is same-family with one of them. Authority is therefore
  decomposed:
  1. **Contest extraction (drafted, then checked).** The Synthesizer drafts a `contest_ledger`
     of every point where the two artifacts prescribe different things or contradict on fact;
     uncontested material passes through. Deciding whether two artifacts genuinely disagree,
     merely differ in terminology, or share an omitted premise is semantic judgment performed
     by a family-aligned seat — so the draft never stands alone: a mandatory **ledger
     completeness check** runs before any challenge. A reviewer from the family opposite the
     Synthesizer's receives both source artifacts plus the draft ledger and returns omitted
     contests, mischaracterized positions, and shared unstated premises; its additions enter
     the ledger, and the Synthesizer may not strike them.
  2. **Opposite-family challenge.** Each contested position is challenged only by the family
     that did not write it (two Reviewers in plan-critique mode, one per family), returning
     `SURVIVES` or `FALLS` with refuting evidence. No model is asked about its own family's
     position, so P5 holds pointwise.
  3. **Composition, then cross-family audit.** The Synthesizer composes uncontested material
     plus survivors; it may not overturn a FALLS or resurrect a fallen position. A reviewer
     from the opposite family then critiques the finished composition — a hunt for selective
     composition and biased framing, mirroring the audit wave that produced these very
     findings — and its findings are dispositioned like any critique; mandatory-class
     findings block until resolved.
  4. **Residue → human, unconditional.** Both-survive or both-fall contests become OPEN
     DECISIONS carrying both positions, both challenges, and the cost of choosing wrong. More
     than four means the lanes disagreed on framing — a re-plan trigger, never a licence to
     decide them.
- **Cost, stated plainly.** The protocol adds two opposite-family consultations per
  comparative session — the ledger completeness check and the post-composition audit, ~110 OU
  each when the Synthesizer is Anthropic-cast. Accepted by owner ruling: a comparative
  session is only ever run for serious work, so the extra cross-vendor pass is justified.
- **Tools.** READ, SEARCH (to adjudicate against the tree), WRITE-DOC. Shape: `repo`+`haystack`.
- **Weaknesses / failure modes.** False even-handedness (structurally hard now: contested points
  arrive pre-decided or pre-marked undecidable); shared-assumption blindness — when both inputs
  assume the same wrong thing, agreement looks like confirmation, so shared assumptions are
  flagged *verify during execution*, never promoted to fact.
- **Owns / must not receive.** Owns A1. Never: authoring original positions; executing;
  learning or guessing authorship.
- **Review.** The user, via escalated decisions; execution reality, via the
  verify-during-execution list. Where the challenge protocol cannot run (a pool down), the
  fallback is a human synthesis — with no third family, no other independent party exists —
  never a same-family merge.

---

### Band B — Evidence

#### 4. Scout — class N0 (bounded fetch, find, lookup)

- **Purpose.** Answer *where / what / which files / list all* over a declared, mechanically
  exhaustible search surface, fast and cheaply, and never speculate about *why*.
- **Casting.** Primary Anthropic · Claude Haiku 4.5 · thinking off; mirror OpenAI · GPT-5.6
  Luna · low (pool-aware — N0 stays on Haiku by default to protect the OpenAI review reserve).
- **Rationale.** Cost-per-mission plus a charter that forbids open-ended work is exactly the
  cheap tiers' measured shape (near-flagship on defined tasks, collapse on open-ended ones).
  Haiku keeps Anthropic cache locality; Luna's advantages (TTFT, Feb-2026 cutoff) don't override
  pool state.
- **Search contract (dispatch-enforced).** The packet declares roots, globs, exclusions and
  caps; the result records every query, hit count, file opened, truncation and unsearched
  branch. **Any truncation, unresolved cap, evidence dispersed beyond ~25 files, or inability to
  prove exhaustion auto-reclassifies to N2 or I0** — never relying on scout self-assessment,
  which is exactly the metacognition the MRCR number says the cast lacks.
- **Tools.** READ, SEARCH, NETWORK (fetch only), EXECUTE read-only (`git log/show/diff/blame`,
  listings, ripgrep). No WRITE. Shape: `scoped` maximum — never `haystack`.
- **Weaknesses / failure modes.** The haystack cliff (silent omission); Haiku's Feb-2025 cutoff
  (2025–26 API/library/model questions misroute — send to Luna mirror or N1); confident wrong
  answers on under-specified missions; answering "why" when asked "where."
- **Owns / must not receive.** Owns N0. Never: causal questions (→ I0), >32K supplied tokens or
  unbounded repos (→ N2/I0), judgment that steers a plan.
- **Escalation.** One re-probe on an UNKNOWN; a surviving UNKNOWN becomes a Detective case —
  never a third scout mission.
- **Review.** The Verifier replays citations and search counts; T0 facts need no model verdict;
  conclusions route through I0/N1/N2/R0.

#### 5. Researcher — class N1 (deep external research)

- **Purpose.** Go outside the repository — web, standards, vendor docs, changelogs, papers — and
  return a synthesized, cited answer the tree cannot settle.
- **Casting.** Primary OpenAI · GPT-5.6 Sol · medium (high for deep, contradictory retrieval
  chains or safety/architecture/procurement-relevant research); mirror Anthropic · Claude
  Opus 5 · medium. Never Luna/Haiku (the corpus is a haystack by definition).
- **Rationale.** BrowseComp 92.2% is the seat's literal shape; MRCR 91.5 makes the retrieved
  corpus usable; token efficiency matters because research seats consume in proportion to what
  they read. Medium effort per vendor guidance; Sol-medium beats larger budgets on ALE.
- **Tools.** READ, SEARCH, NETWORK (search+fetch), WRITE-DOC (research note). Shape: `haystack`.
- **Weaknesses / failure modes.** Fabricated citations (polished output inventing a URL or
  figure) — every load-bearing claim carries a resolvable source and retrieval date, and an
  uncited claim is treated as absent; novelty bias and inference beyond citations; treating
  vendor claims as independent evidence; answering from parametric memory past its Feb-2026
  cutoff (forbidden — must retrieve).
- **Owns / must not receive.** Owns N1; also keeps the roster's model facts current (the
  fastest-rotting knowledge in the system). Never: in-repo causal questions (→ I0), bulk
  extraction (→ M0), final architecture (→ A0), legal acceptance (→ human).
- **Escalation.** In: a scout mission that needs the outside world. Out: Sol high; A0 when the
  answer changes the plan. For gate-class research (a claim deciding a casting or architecture):
  a second instance on the other family answers independently; disagreements surface, never
  merge.
- **Review.** Citations checked mechanically (Verifier); decision-bearing synthesis gets
  cross-family review (Opus 5 · high).

#### 6. Long-Context Analyst — class N2 (long-context synthesis over supplied material)

- **Purpose.** Extract and reconcile facts from large or dispersed *supplied* context — the
  reclassification target for scout truncation and the seat for "read these 300K tokens and
  reconcile them."
- **Casting.** Primary OpenAI · GPT-5.6 Terra · medium (high for dense cross-document
  inference); Anthropic mirror Opus 5 · medium, covering corpora up to ~1M tokens — Anthropic
  documents a 1M-token context window for Opus 5 / Sonnet 5 / Fable 5 on paid Claude Code plans
  (https://support.claude.com/en/articles/8606394, as of 2026-08-28), so the mirror is full,
  not partial.
- **Rationale.** MRCR 89.6 at ~40% of flagship draw and a ~1M window; strong structured output.
- **Tools.** Large-document ingestion, repo/history reads, search, structured extraction. Shape:
  `haystack`.
- **Weaknesses / failure modes.** Shallow causal interpretation; code-smell and security misses;
  false synthesis when sources conflict (must surface conflicts, not resolve them silently).
- **Owns / must not receive.** Owns N2. Never: implementation, architecture, security approval,
  live reproduction.
- **Escalation.** Sol · high for incomplete recall; I0 when causality remains; A0 when
  architecture remains.
- **Review.** Cross-family (Opus 5 · high) for decision-bearing conclusions; seeded-document
  checks measure extraction completeness.

#### 7. Detective — class I0 (causal evidence investigation, read-only)

- **Purpose.** Answer *why / how / which is load-bearing* about code that exists, by reading
  only, returning an evidence-chained verdict with a confidence grade
  (CONFIRMED / LIKELY / UNCERTAIN).
- **Casting.** Primary Anthropic · Claude Opus 5 · high; mirror OpenAI · GPT-5.6 Sol · high;
  ceiling Fable 5 · high when the trail is cold and blocking.
- **Rationale.** Senior SWE-bench #1 in bug and performance investigation — the most on-point
  measurement for this contract; freshest cutoff matters most here. Sol mirrors with genuinely
  different blind spots; the two disagreeing is informative.
- **Tools.** READ, SEARCH, NETWORK, EXECUTE read-only. Explicitly not running the code under
  test — that boundary separates it from I1. Shape: `repo`.
- **Weaknesses / failure modes.** Over-engineering the diagnosis; **confident narrative** from
  partial evidence; unreviewed output steering plans.
- **Verdict checks, in increasing cost.** (1) Verifier chain re-run, every verdict: cited lines
  exist and say what the report claims. (2) Refutation duty, contractual, every verdict: the
  evidence that would refute the leading hypothesis and the result of looking; the two strongest
  discarded alternatives with citations — a verdict with no discarded alternatives is incomplete
  by contract. (3) **Cross-family falsification pass, mandatory for gate-class CONFIRMED**
  (verdicts authorizing Principal-tier, data, or security work, or a re-plan): a second
  Detective on the opposite family receives the question, chain and alternatives — not the
  narrative — and returns CONCUR / CONCUR-WITH-DOUBT / COMPETING HYPOTHESIS. Disagreement
  surfaces to the Conductor as a decision. Where unavailable, the verdict stands as LIKELY and
  cannot authorize gate-class work.
- **Owns / must not receive.** Owns I0. Never: anything requiring execution (→ I1), locating
  (→ N0 at 1/25th the draw), fixes (→ executors), review.
- **Escalation.** In: a scout UNKNOWN surviving one re-probe; questions whose wrong answer
  misdirects a plan. Out: Fable ceiling; I1 when the next step is an experiment.

#### 8. Archivist — class M0 (multimodal and document intake)

- **Purpose.** Ingest a fixed corpus — PDFs, screenshots, recordings, design files, logs, CSVs,
  charts — and return faithful, schema-validated structured extraction with no judgment attached.
- **Casting.** OpenAI · GPT-5.6 Terra · medium for documents, PDFs, logs and pre-extracted
  text; Anthropic · Claude Opus 5 · medium for images, charts and renders. **Declared
  no-mirror exception: raw video and audio.** The only path for those modalities is
  deterministic, below the model layer: fixed-interval plus scene-change frame extraction and
  local speech-to-text; frames go to the image casting, transcript to the document casting,
  with timestamps/offsets as provenance. Where that local dependency is absent, the modality
  returns typed `UNAVAILABLE` — never a silent narrowing to stills.
- **Rationale.** The former Gemini 3.7 Flash primary is removed by owner decision (2026-08-28):
  the integration and operational cost of a third provider was judged not worth its
  capabilities for this deployment. The arguments that carried it — a third pool nothing else
  drains, and the roster's only native video/audio input — no longer apply; what is given up
  is native video/audio intake, for which the deterministic degradation path is a fallback,
  not an equivalent. The two castings split by measured strength: Terra's ~1M window with
  MRCR 89.6 holds long document corpora at workhorse draw; Opus carries the image/chart
  reading. Extraction remains a bounded, schema-validated job with no judgment attached.
- **Contract boundary.** Not "must not reason" but **"must not sustain"**: any single bounded
  read/classification/extraction is in scope; any goal held across turns, and any conclusion or
  recommendation, is not.
- **Tools.** READ (incl. media), WRITE-DOC (extraction artifacts). No SEARCH beyond the named
  corpus, no EXECUTE, no NETWORK. Shape: `haystack` bounded to the corpus.
- **Weaknesses / failure modes.** Format brittleness — every extraction carries a schema and a
  deterministic validator; invalid output is discarded, not repaired by a second call. No
  independent multimodal benchmark is cited for either casting, so consequential extractions
  lean on the validator and cross-family review, never on benchmark trust.
- **Owns / must not receive.** Owns M0. Never: conclusions, long-horizon work, general coding,
  or a critical-path dependence on the video/audio degradation path (it may be `UNAVAILABLE`).
- **Review.** Deterministic schema validation first; the consuming role treats every extraction
  as a claim with a provenance pointer; consequential extractions get cross-family review per
  the R0 matrix (Opus 5 for Terra extractions; Sol for Opus extractions).

---

### Band C — Construction

Shared law: execute the order, the whole order, nothing but the order; blocked beats guessed;
the report is a claim, not evidence.

#### 9. Operator — class E0 (terminal, shell, CI, build, environment)

- **Purpose.** Work the environment when the environment is the problem — CI archaeology,
  toolchain and dependency surgery, containers, packaging, release plumbing.
- **Casting.** Primary OpenAI · GPT-5.6 Sol · high; mirror Anthropic · Claude Opus 5 · high.
  Routine bounded shell goes to Runner at ~1/20th the draw.
- **Rationale.** Terminal-Bench 2.1 88.8 and OSWorld 2.0 62.6 are the direct measurements, and
  the practitioner texture matches (tenacity through unglamorous work, no silent degradation as
  budgets tighten). Terminal-Bench 3.0's different ordering (Opus 42.7 / Sol 34.6) is
  **scaffold-uncontrolled** — its top rows pair Opus with mini-SWE-agent and Sol with Codex,
  neither of which this harness runs — and the dossier carried the same benchmark under its
  former name (Frontier-Bench) and still routed terminal work to Sol. No casting rests on it.
- **Escalation ladder (merged rule).** A tactical stall: one effort raise on the same casting
  (Sol · high → max), once. A **strategy-level stall** — the same wrong theory twice, or a
  second non-improving attempt — crosses families to Opus 5 · high, because a different lineage
  brings a different prior; never a repeated same-model max loop. The ordering is provisional
  pending the scaffold-controlled trial (WO-12e), whose pre-registered decision rule settles it
  on this harness's own two pairs.
- **Tools.** READ, SEARCH, EXECUTE (full), WRITE-TREE (config/CI/build), NETWORK (registries,
  docs). Shape: `subsystem` + logs as `haystack`.
- **Weaknesses / failure modes.** **Over-agency** — the system card documents unauthorized
  actions including deleting infrastructure and moving credentials; mitigations all mandatory:
  sandbox with declared write scope, explicit forbidden-command list, T2+/T3 gating per P13.
  Specification-gaming under outcome pressure (editing the test/fixture/CI condition to reach
  green) — the Verifier's tree audit exists precisely for this. Cyber-safeguard false positives
  on legitimate security-adjacent work: a refusal is a reportable event, not a finding.
- **Owns / must not receive.** Owns E0. Never: application logic (→ E2/E3), irreversible actions
  without authorization, routine command-running (→ Runner), security judgment (→ E7).
- **Discriminator vs I1** ("works locally, fails in CI" reads as both): what changes when you
  change one thing? Same commit passes in env X, fails in env Y → Operator. Same commit fails
  intermittently in one env → Investigator. Unknown → Operator triages first under ~15 tool
  calls and delivers the environment matrix, then owns or hands over.
- **Review.** Verifier first — mandatory, with tree audit, process ledger and nonce — then
  cross-family Reviewer (Opus 5 for Sol-authored change). Every Sol-authored mutation is
  mandatory-class (P11/METR).

#### 10. Runner — class E1 (mechanical batch execution)

- **Purpose.** Do the bounded mechanical thing, N times, in parallel, cheaply — run suites,
  sweep matrices, apply templates and uniform codemods under a validator, classify against
  checklists, poll progress.
- **Casting.** OpenAI · GPT-5.6 Luna · low–medium; Anthropic · Claude Haiku 4.5 · off. Choose
  by pool room and parent cache locality; never mix vendors inside one cached prefix.
- **Tools.** READ, SEARCH, EXECUTE (declared command set only), WRITE-TREE only where the order
  names exact paths and the transform is uniform, enumerable and deterministically checkable —
  and the tool refuses to emit invalid output (self-validating codemods). No SPAWN, no judgment.
  Shape: `packet` — the hardest constraint in the roster, dispatcher-enforced.
- **Strengths.** Throughput, latency, cost that permits redundancy (three runs and a vote is
  affordable here and nowhere else).
- **Weaknesses / failure modes.** Haystack cliff and stale-knowledge cliff (hard route-filters);
  weak recovery (every order carries acceptance tests and an "if X, stop and report" clause);
  compounding error on chained steps (orders must be flat); consistent application of a flawed
  pattern (the pattern is validated before fan-out); never a judge — it may report a checklist
  item unmet, never that a change is good.
- **Owns / must not receive.** Owns E1. Never: open-ended work, judgment, haystacks, feature
  ownership, non-uniform transforms (→ E8/E2).
- **Escalation.** Any exception, non-local failure or scope growth reclassifies to E2/E3/E8. Two
  failures on the same leg → the parent takes it back.
- **Review.** Parent spot-check + Verifier deterministic oracle (enumeration and transform
  invariants); an opposite-family cheap constraint/diff check for tree-mutating batches. Never
  reviewed by a frontier model as prose.

#### 11. Builder — class E2 (routine implementation)

- **Purpose.** Implement a well-scoped change behind a written spec — feature, fix, integration,
  or a confirmed bounded performance improvement — in one run and one review round.
- **Casting.** Split by order shape (owner ruling 2026-08-28). **Preferred:** OpenAI · GPT-5.6
  Luna · xhigh–max for bounded, short-horizon, fully-specified, deterministically-verifiable
  orders — promoted from trial-gated budget casting on the owner's accumulated field data
  (cost/performance far above its weight class on exactly this shape; the earlier single-source
  community figure of ≈Sol-medium quality at ~1/14th per-task cost now corroborated by owner
  observation). Anthropic · Claude Sonnet 5 · medium (high for unusually dense but bounded
  logic) for orders expected to run longer or whose spec is thinner than Luna's bar; mirror
  OpenAI · GPT-5.6 Terra · medium. Luna never receives under-specified work — that guardrail
  survives the promotion; the WO-12a entry trial becomes confirmation-in-production under the
  live escape-rate monitoring adopted with audit finding 5.
- **Rationale.** The volume seat; its economics dominate. Flagship-director-plus-workhorse
  reached ≈96% of all-flagship quality at 46% cost in the one available orchestration study;
  Sonnet and Terra are within ~0.2 points on SWE-bench Pro, so the choice between them is pool
  state and cache locality (P2). Sonnet-primary also protects the OpenAI pool for review — the
  binding constraint (Part 5).
- **Tools.** READ, SEARCH, WRITE-TREE, EXECUTE (build/test/lint). No SPAWN. Shape: `subsystem`.
- **Weaknesses / failure modes.** Code-quality debt at volume (Terra +37% code-smell density,
  203 vulns/mLOC — why Builder output is always reviewed); stalls on ceiling tasks instead of
  escalating (BLOCKED/CHECKPOINT are reportable statuses, not judgment calls); Terra's cliff on
  messy long-horizon work (clean-pass 40.7 vs Sol 63.7 on the authoring suite) — Terra is a lane
  for *scoped* orders only; accepts bad plans.
- **Owns / must not receive.** Owns E2 (performance fixes arrive only with I1's profile,
  invariant and numeric target — that profile *is* the bounded spec). Never: split-resistant
  cross-subsystem work (→ E3), unspecified work (→ A0 first), data migrations (→ E4), environment
  problems (→ E0), certifying its own tests.
- **Escalation.** Two REVISE rounds, a CHECKPOINT, or a mis-sized BLOCKED → Principal, once, with
  both reports and findings verbatim. Never a third round at the same tier.
- **Review.** Verifier pass, then computed cross-family review (Sonnet-authored → Sol · high at
  T2, qualified Terra · medium at T1; Terra/Luna-authored → Opus 5/Sonnet per the matrix).
  Preferred band: a routine T1 round fully covered by deterministic checks may degrade under
  Red-state pools per Part 3.4.

#### 12. Principal — class E3 (complex long-horizon and split-resistant implementation)

- **Purpose.** Carry the orders that genuinely resist splitting — algorithmically hard cores,
  coupled cross-subsystem changes, repository-scale builds — where narrow orders would lose the
  whole-system view.
- **Casting.** Primary Anthropic · Claude Opus 5 · high, with a second routed effort point at
  xhigh (**one tier, two effort points — not two rungs**); mirror OpenAI · GPT-5.6 Sol · high;
  **ceiling Anthropic · Claude Fable 5 · high** (Max seat only) — the most consequential
  addition to the execution ladder, reached only after both Opus effort points bounced *and* the
  diagnosis is "ceiling," not "under-specified." Under-specification means re-plan, not a more
  expensive model.
- **Rationale.** Frontier-Bench v0.1 SOTA (Opus 43.3–44.4) on the hardest published agentic
  measurement; CursorBench within 0.5% of Fable's peak at half the per-task cost; the Fable
  ceiling exists because the measured repo-scale ceiling is Fable's (SWE-bench Pro sign,
  CursorBench peak, Senior SWE-bench #1) and the current harness cannot reach it.
- **Tools.** READ, SEARCH, WRITE-TREE, EXECUTE, SPAWN (Runner, Scout, Verifier only; fan-out
  ≤4). Shape: `repo`. Checkpoint commits and progress heartbeats mandatory (bundled-order
  cadence).
- **Weaknesses / failure modes.** Over-engineering at both castings (smallest-change clause and
  scope cap in every order; unrequested scope is a review finding, not a bonus);
  argumentativeness (disputed orders return BLOCKED with the contradiction named); SOTA is still
  ~43% — a coin flip, so verification is never optional; the Sol mirror's concurrency blind spot
  (352 concurrency bugs/mLOC — concurrency cores prefer the Anthropic casting) and
  specification-gaming (mandatory Verifier with tree audit and nonce).
- **Owns / must not receive.** Owns E3. Never: routine orders (if most orders route here, the
  sizing law is failing), pure environment work (→ E0), data migrations (→ E4 even when hard).
- **Escalation.** In: a Builder order that bounced twice; a PLAN-time hardness judgment. Out:
  xhigh point → Fable ceiling → re-plan. Two REVISE cycles anywhere in the tier means re-plan.
- **Review.** Mandatory cross-family Reviewer plus mandatory Verifier; checkpoint reviews at
  subsystem boundaries plus the complete pinned artifact.

#### 13. Investigator — class I1 (intricate bug tracing; runtime and performance investigation)

- **Purpose.** Chase intricate, intermittent or state-dependent defects and performance
  regressions *by running the system* — instrument, bisect, profile, reproduce under varied
  conditions — and deliver a minimal reproduction plus diagnosis, or a fix with the reproduction
  attached.
- **Casting.** Primary Anthropic · Claude Opus 5 · high; mirror OpenAI · GPT-5.6 Sol · high
  (preferred when the defect is environment- or tool-loop-shaped; wrong for race hunts — the
  concurrency blind spot); ceiling Fable 5 · high after two failed hunts with different
  hypotheses.
- **Why this seat exists.** The current roster cannot staff it: `agents/detective.md` forbids the
  read-only investigator from running the experiment its own hypothesis requires, and the
  executor has no investigative mandate, so a Heisenbug shuttles hypotheses between two agents
  that each hold half the loop. Casting follows Senior SWE-bench #1 in bug **and performance**
  investigation.
- **Performance is two-phase, and this seat owns the intake.** "Make it faster" routes here
  first; I1 establishes the bottleneck, invariant and numeric target. The fix then routes by
  shape as a new order — bounded → E2 (carrying the profile as its spec), cross-system redesign
  → E3, data/query → E4, environment/build → E0. No separate performance-implementer role: the
  profile-equipped implementation classes already own those shapes, and a duplicate primary
  would break class uniqueness. Contract rules carried in: no optimization order is accepted
  without a baseline measurement artifact; baseline and target measurements come from different
  runs and are independently re-run by the Verifier; benchmark-fitting is a named failure mode.
- **Tools.** READ, SEARCH, EXECUTE (full), profilers/traces/debuggers, WRITE-TREE restricted to
  a scratch/probe scope plus the eventual fix, SPAWN (Runner, for seed-matrix reproduction).
  Shape: `repo`.
- **Weaknesses / failure modes.** Probe residue (probe manifest + clean-tree assertion, checked
  mechanically by the Verifier); fix-before-understand (the report requires the
  failing-then-passing reproduction *first*); rabbit-holing (tool-call budget and a mandatory
  halfway CHECKPOINT with the hypothesis list); perturbing Heisenbugs.
- **Owns / must not receive.** Owns I1 (intricate/intermittent bugs; flaky tests; races;
  performance investigation; "works locally, fails in CI" once the environment matrix points at
  program behavior). Never: read-only causal questions (→ I0), routine fixes with known cause
  (→ E2), general terminal administration (→ E0), review.
- **Review.** Verifier (reproduction re-run; tree clean of probes) then cross-family Reviewer on
  the fix. A reproduction that only fails under the hunter's instrumentation is not a
  reproduction.

#### 14. Data Engineer — class E4 (data, schema, query, migration)

- **Purpose.** Change data and the shapes that hold it — schema migrations, backfills, ETL,
  query and index work — where the defining property is that mistakes may be unrecoverable.
- **Casting.** Primary Anthropic · Claude Opus 5 · high. OpenAI · GPT-5.6 Terra · high is
  permitted **only** for reversible T1 extraction/transformation/query sub-work *after* the
  integrity design (rollback, locking, partial-failure, skew) is fixed by the primary or A0.
  **Declared no-mirror exception: the irreversible half.** Pool pressure changes *when* T2/T3
  data work is scheduled, never *who* prepares it; if the Anthropic pool is exhausted,
  irreversible data work waits.
- **Rationale.** P13's clearest application: the casting is decided by the alignment measurement
  (lowest misaligned-behaviour score; "most careful about irreversible side effects"), not a
  coding benchmark — the failure that matters is a destructive action taken confidently, and
  Terra's own weakness profile (under-modeling rollback, locking, partial failure, skew) is
  exactly this class's dominant difficulty.
- **Tools.** READ, SEARCH, WRITE-TREE (migration/query files), EXECUTE against non-production
  targets only; production execution is a separate T3 order. Shape: `subsystem` + schema
  `haystack`.
- **Weaknesses / failure modes.** Over-engineered migrations (four-phase expand/contract where
  an additive column would do); silent data loss under transformation (mandatory Verifier
  invariant comparison — row counts, checksums, constraints, concurrency behavior, query
  plans); higher allowance draw than the workhorse alternative (a stated, accepted cost).
- **Contract steps between "prepared" and "applied."** Dry run against a copy; rollback script
  **with a tested restore**; invariant comparison; the authorization the tier demands —
  Conductor's explicit gate for recoverable-at-cost T2, a named human recorded in the ledger for
  T3. Preparation and application are always separate orders.
- **Owns / must not receive.** Owns E4 — including when the code change is trivial, because the
  class is defined by consequence, not difficulty. Never: live production mutation without T3
  authorization, application logic (→ E2), sole release authority.
- **Review.** Mandatory cross-family (Sol · high) plus mandatory Verifier invariant comparison —
  one of the places cross-family review is non-negotiable.

#### 15. Interface Artisan — class E5 (frontend and interactive 2D UI)

- **Purpose.** Build and fix what a user looks at — web/app UI, layout, interaction,
  accessibility, visual regression — with a render-inspect-adjust loop, not one-shot emission.
- **Casting.** Generation: OpenAI · GPT-5.6 Sol · medium–high **with a browser/screenshot
  loop**. Closing casting: Anthropic · Claude Opus 5 · high — verifies behavior and code
  across desktop/mobile/keyboard/loading/empty/error states and closes, always a different
  family from the generator. **The closing pass is dispatched as a separate READ-ONLY order —
  no WRITE-TREE.** If the closer wants changes it returns findings like a reviewer, never
  edits; any edit would make it a co-author and disqualify it from closing. Critic: Fable 5,
  rare, for "passes every check and still looks wrong." Cheap inspection: Runner screenshot
  triage at volume.
- **Rationale (a registered report conflict, resolved).** The roster summary assigns interactive
  UI to Opus; the OpenAI report documents Sol's Design-Arena top-band jump with a mechanism
  (active suppression of AI design anti-patterns). Both are right about different halves: the
  generation half follows the top-band generation evidence, the verification half follows the
  multi-viewport closing instinct evidence — and the split is two-phase by construction, which
  is also what the render-loop guidance recommends.
- **Tools.** READ, SEARCH, WRITE-TREE, EXECUTE, BROWSER. Shape: `subsystem` + reference
  artifacts.
- **Weaknesses / failure modes.** No settled independent board (casting carries an expiry:
  re-test next generation); polishing the wrong interaction model; taste without verification
  (breaks at 320px or under a screen reader — deterministic accessibility and visual-diff checks
  run before any model judgment); single-viewport overfitting.
- **Owns / must not receive.** Owns E5. Never: 3D/procedural geometry (→ E6), backend logic
  (→ E2/E3), raw reference extraction (→ M0), final sign-off on its own rendering.
- **Review.** Deterministic a11y/visual-diff checks → closing casting (cross-family by
  construction) → Reviewer for code quality; verdicts cite screenshots the way code review cites
  `path:line`.

#### 16. Spatial Specialist — class E6 (spatial, 3D, procedural, engine-integrated)

- **Purpose.** Write code whose output is geometry, space or simulation — procedural meshes,
  parametric CAD, scenes and levels, shaders, engine integrations — and build the inspection
  tooling that says whether the output is right.
- **Casting.** Primary Anthropic · Claude Opus 5 · high; global critic Fable 5 · high; mirror
  OpenAI · GPT-5.6 Sol · high for the agentic engine loop (build-run-screenshot-adjust) rather
  than the geometry itself; cheap inspection via Runner/Archivist render triage.
- **Rationale, with its honest gap.** The roster summary assigns procedural meshes, Blender
  automation, shaders, render-feedback loops and diagnostic-tooling invention to Opus, and
  spatial reconstruction plus global visual critique to Fable; the OpenAI report declines to
  claim the seat for its own subjects. No independent shader/DCC/simulation evaluation exists
  for this generation — the largest single evidence gap in this document — so the casting is
  held at moderate confidence with a paired-spike trial (WO-12b) on the first three orders.
- **Tools.** READ, SEARCH, WRITE-TREE, EXECUTE (headless engine/DCC), render capture, SPAWN
  (Runner sweeps). Shape: `subsystem` + reference artifacts.
- **Weaknesses / failure modes.** Numerically-valid, visually-wrong output (why the Fable critic
  is a named casting); unmeasured domain (every claim provisional); iteration cost —
  produce-inspect-adjust is the most allowance-hungry pattern in the roster, so inspection runs
  at cheap-tier rates and escalates only ambiguous frames; neglected deterministic checks
  (manifold validity, polygon budgets, collision, deterministic seeding, frame time, draw calls,
  serialization round-trips — all run before any model looks at a render).
- **Owns / must not receive.** Owns E6. Never: 2D document-flow UI (→ E5); productionizing a
  working generator (seeds, LODs, serialization, editor controls — Builder work at a fraction of
  the draw, the biggest saving in this class); final artistic approval (human).
- **Review.** Deterministic geometry checks → cheap visual triage → Fable critic when flagged →
  cross-family Reviewer on the code. Four checks; only one expensive; the expensive one runs
  last and rarely.

#### 17. Red Team — class E7 (defensive security)

- **Purpose.** Attack the change and the system on purpose — threat modeling, vulnerability
  hunting, dependency/supply-chain review, secrets and permission analysis — defensively only.
- **Casting.** Primary OpenAI · GPT-5.6 Sol · high (max for a full threat model, human-approved
  scope); mirror Anthropic · Claude Opus 5 · high (strong at find-and-harden, weaker on
  exploitation reasoning). **Never Fable — a policy fact, not a capability judgment**: its
  classifiers fall back silently on cyber topics, so a security review routed there may be
  answered by a different model with nothing saying so. Encoded as a hard route-filter.
- **Rationale.** ExploitBench 73.5 and SEC-Bench Pro 71.2–74.3 with a large margin over the
  workhorse tier (Terra 52.9/57.7) — not a seat the cheap tier can cover.
- **Tools.** READ, SEARCH, EXECUTE (static analysis, dependency audit, sandboxed dynamic
  checks, fuzzing), NETWORK (advisory databases). No WRITE-TREE — Red Team finds; Operator or
  Builder patches. Shape: `repo`.
- **Weaknesses / failure modes.** Over-production (findings ranked by exploitability and blast
  radius, with an explicit "fix first" line); classifier friction on the primary (a refusal is a
  reportable event); its own vendor's output ships security issues where review catches them
  least — Red Team never reviews a change the same model authored.
- **Owns / must not receive.** Owns E7 (triggered by changes touching auth, crypto, parsing,
  deserialization, file paths, subprocess, dependencies; plus scheduled passes). Never: patching
  its own findings, offensive work (refused at the Conductor), routine code review.
- **Review.** Findings are reproduced or not (a Verifier question); the fix is reviewed as an
  ordinary change, cross-family. The mandatory reviewer of Sol-authored security artifacts is
  Opus 5 · high, **with the classifier-fallback caveat carried across**: a fallback signal,
  unverifiable served-model identity, or refusal makes the verdict non-closing and routes to a
  human. Critical findings always require human sign-off.

#### 18. Refactorer — class E8 (refactoring at scale)

- **Purpose.** Carry broad, semantically-shallow, non-uniform wide change — API migrations,
  repo-wide renames, codemod authoring plus consumer migration, dependency sweeps — where the
  risk is a *missed site*, not a wrong line.
- **Casting.** Primary OpenAI · GPT-5.6 Terra · medium; mirror Anthropic · Claude Sonnet 5 ·
  medium; SPAWN Runner (≤4) for per-file/per-package legs. Strictly-uniform enumerable
  transforms are not this class — they are E1 under a validator.
- **Rationale.** Breadth is bounded by context and cost-per-file, not ceiling: Terra's ~1M
  window with MRCR 89.6 holds a consumer census in mind at ~40% of flagship draw; a flagship
  here buys nothing the task can use, and routing wide-but-shallow migrations to E3 (Fable/Opus)
  would be the roster's clearest over-spend.
- **Contract.** (i) The order names the census method (grep pattern, symbol index, type check)
  *before* the change; (ii) the final step is always an independent Sweeper pass — never the
  Refactorer; (iii) codemods carry their own validators; (iv) diffs are reviewable as
  pattern-plus-exceptions with every exception called out; (v) orders shard by package/consumer
  so no reviewer faces a 40-file mega-diff.
- **Weaknesses / failure modes.** The missed consumer (dynamic call sites, string-keyed
  references, doc examples, generated artifacts); silent semantic drift at one site;
  over-large single orders.
- **Owns / must not receive.** Owns E8. Never: semantically deep restructuring (→ E3),
  schema/data migration (→ E4), open API design (→ A0 first).
- **Escalation.** E3 when the sweep reveals the change is not mechanical after all — a
  legitimate, reportable outcome.
- **Review.** Verifier (build + suite + census re-run) → Sweeper (independent completeness) →
  cross-family Reviewer on a sampled diff plus the full census. Line-by-line review of a
  mechanical 40-file diff is theatre; census-plus-sample is not.

#### 19. Test Designer — class Q0 (independent test design and authoring)

- **Purpose.** Construct an oracle independent of the implementation author — tests, fixtures,
  invariants, property tests, mutation targets — plus general suite repair and harness plumbing.
- **Casting.** Cast opposite the implementation author's family: OpenAI · GPT-5.6 Terra · medium
  for Anthropic-authored implementations; Anthropic · Claude Sonnet 5 · medium for
  OpenAI-authored ones. No evidence says a ceiling model writes materially better tests behind
  explicit acceptance criteria — the clearest case of not paying for capability the task cannot
  use.
- **Automatic triggers (policy, not discretion).** The scheduler creates Q0 when the
  implementation order is created for: every T2/T3 source change; every E3, E4 and E7 change;
  any auth/authz, concurrency, persistent-data or public-API change regardless of nominal tier;
  and, during calibration, a 25% sample of T1 E2/E5/E6 work. A missing required Q0 order blocks
  the work — a policy violation, not a shortcut.
- **Sequencing.** Black-box tests are drafted before or parallel to implementation, with the
  implementation diff withheld where practical. Q0 is always Director-created, never spawned by
  the implementer — the independence is the point.
- **Tools.** READ, SEARCH, WRITE-TREE (test paths/fixtures only), EXECUTE, generators, property
  and mutation tools, coverage. Shape: `subsystem`.
- **Weaknesses / failure modes.** Tests asserting the implementation rather than the behavior;
  green-by-construction tests (the Verifier's mutation check — invert the assertion or revert
  the fix; the test must go red — is contractual); mirroring spec defects; coverage theatre (the
  order names behaviors to pin, not a coverage number); flakiness.
- **Owns / must not receive.** Owns Q0. **No agent certifies a suite it wrote** — the one
  conflict-of-interest rule that applies even at the cheapest tier. Never: production logic,
  deciding what acceptance criteria should be (→ A0/O0).
- **Review.** Mutation and flake checks mandatory (Verifier). For T2/T3: a fresh model from the
  *implementation author's* family reviews the opposite-family test artifact without seeing the
  implementation; the opposite-family code reviewer separately reviews the implementation — so
  no reviewer certifies same-family output on either artifact. A test-only change passing its
  mutation check may take same-family review (preferred band).

#### 20. Doc Writer — class D0 (documentation and contracts)

- **Purpose.** Produce prose humans rely on — developer docs, API references, changelogs, ADRs,
  migration guides, runbooks — tied to verified behavior.
- **Casting.** Split by stakes. Routine developer documentation tied to verified behavior:
  Anthropic · Claude Sonnet 5 · medium. Deliverable-grade documents, public contracts and
  migration guides: Anthropic · Claude Opus 5 · medium, with Fable 5 · medium as the ceiling for
  documents that are themselves deliverables (Max seat only). Mirror OpenAI · GPT-5.6 Sol ·
  medium — declared non-equivalent (GDPval-AA puts the Anthropic side ~12 Elo ahead on
  knowledge-work artifacts): under the mirror, add a cross-family register/over-claiming read;
  deliverable-grade documents wait for the primary pool rather than shipping on the mirror.
  **Never Terra or Luna** — both identified as their family's weak writers in a blind prose
  panel, and bad docs are not caught by tests and are read for years.
- **Contract.** Every behavioral claim cites `path:line` or a passing test; the Verifier
  samples the citations mechanically. Documentation is substantive — the inert tier never
  applies to it.
- **Weaknesses / failure modes.** Confident description of behavior that does not exist (drift
  no test catches); length inflation; marketing register; smoothing over uncertainty;
  documenting intent instead of reality.
- **Owns / must not receive.** Owns D0. Never: code (→ E2), design decisions dressed as docs (an
  ADR that decides is planning — → A0), legal acceptance (→ human), unverified current facts
  (→ N1 first).
- **Review.** Cross-family Reviewer reading for accuracy against the diff, plus the Verifier
  claim sample; Sol · high for public contracts and migration instructions.

---

### Band D — Assurance

#### 21. Reviewer — class R0 (adversarial review)

- **Purpose.** Presume the change is broken and try to break it — independently read the diff,
  independently re-run verification, return severity-tagged findings with concrete failure
  scenarios.
- **Casting — computed, not chosen.** `family(reviewer) ∉ families(author + co-authors)`,
  evaluated at dispatch from the ledger's recorded family set (§3.5) — the full co-author
  set, never just the original author:

  | Author family | T1 reviewer | T2/T3 reviewer |
  |---|---|---|
  | Anthropic (Haiku/Sonnet/Opus/Fable) | **Qualified** GPT-5.6 Terra · medium *(after WO-12f seeded qualification — provisional with live monitoring per the WO-12 power rule; Sol · high until then)* | GPT-5.6 Sol · high |
  | OpenAI (Luna/Terra/Sol) | Claude Sonnet 5 · medium | Claude Opus 5 · high |
  | Human-authored (provenance affirmatively recorded as human; no model co-author) | Opus 5 · high | Opus 5 · high (+ Sol · high second opinion at T3) |
  | Unattributed / unprovable provenance | fails closed — preferred-band degraded path only, disclosed (below) | fails closed — both families concur, or a named human (below) |

  A human author has no model family, so any model family is independent — the human-authored
  row is valid at every tier, with the T3 second-opinion rule kept. Unattributed or unprovable
  provenance — a missing or incomplete `co_author_families` set (§3.5) — is treated as
  potentially authored by **every** model family, so no single-family verdict can close it: a
  mandatory-class gate requires either concurring independent verdicts from both families or
  a named human review recorded in the ledger. T1 work with unprovable provenance may proceed
  only under the preferred-band degraded path with `review.cross_family = false` disclosed,
  or wait for provenance to be established.

  A cheap first-screen (Terra/Sonnet · medium) may run before the frontier verdict on large
  diffs as a recall filter; it never issues the closing verdict.
- **Rationale.** Review parity is measured, not assumed: on the 105-task review suite Sol caught
  65/105 actionable issues vs Opus 4.8's 66 and a human baseline of 66, leading full passes
  74–72 — so cross-vendor review is not a downgrade. The deeper argument is failure-mode
  complementarity: constraint violations, over-obedience, long-context misses, hallucinated
  current-year facts and stuck tool loops each have a family that fails more, so a reviewer
  drawn from the family that fails *differently* hunts defects its counterpart does not produce.
  The Terra T1 lane exists because the only Terra number ever cited against it (40.7% CodeRabbit
  clean-pass) is an *authoring* score, not review recall — no Terra review measurement exists,
  so the lane is neither granted nor denied on evidence: it is qualification-gated (seeded
  trial, ≥80 artifacts, ≥20 major seeded defects; recall within one missed seed of the
  flagship baseline — the trial's real granularity, since one seed is five points at n=20;
  zero missed critical seeds; ≤10% false blockers; no source mutation; exact model identity;
  stable subscription execution) — and any pass is provisional with live monitoring and an
  armed revocation trigger, per the WO-12 qualification power rule.
- **Hazard-preserving blinding.** The review packet omits vendor, model, effort and price — but
  carries an unattributed, class-and-trace-derived hazard checklist (e.g., for a
  terminal-authored concurrency change: "check unrequested mutation, unfinished processes, race
  safety, falsified test state") so anti-anchoring does not destroy the targeting signal.
  Blinded vs identity-visible vs blinded-plus-hazard packets are A/B tested (WO-12h).
- **Tools.** Fresh read-only context, pinned checkout, diff and dependency slice, isolated test
  execution (the declared verification manifest), static analysis, browser/render inspection.
  **No WRITE-TREE, ever** — a reviewer that fixes stops reviewing. Shape: `repo`.
- **Weaknesses / failure modes.** Over-production of findings (the Reviewer produces findings;
  the Conductor decides what blocks — P12); verdict inflation under ambiguity (only
  CRITICAL/MAJOR force REVISE, each with a concrete failure scenario); trusting the author's
  pasted output (independent re-run is contractual; the Verifier's evidence is attached so the
  Reviewer is never the only one who checked); hallucinated blockers; reviewer mutation (tree
  audit applies to reviewers too).
- **Owns / must not receive.** Owns R0. Never: implementation or repair; same-family
  consequential artifacts; a change it advised on; recursive review of verdicts (the Verifier
  audits verdict evidence; contested semantic judgment gets one independent adjudication — a
  human, there being no third family — and three review rounds is the hard cap).
- **Escalation.** Two REVISE cycles on one change → Conductor re-plans or escalates the author
  tier once; a disputed finding → deterministic refutation, or a second cross-family opinion.

#### 22. Sweeper — class S0 (post-fan-out completeness)

- **Purpose.** After a fan-out or wide change, find what the parts missed — orphaned call sites,
  stale docs, dead config, un-migrated consumers, generated-artifact drift.
- **Casting.** Primary OpenAI · GPT-5.6 Terra · medium; mirror Anthropic · Claude Sonnet 5 ·
  medium. Never the instance that performed the fan-out; prefer the opposite family from the
  author.
- **Rationale.** The job is a wide, cheap, high-recall read over diff plus repository — a 1M
  window at workhorse rates. The current protocol already mandates the *behavior* ("every chain
  ends with an explicit sweep step") but assigns it to whoever is available; promoting it to a
  seat makes completeness-checking independent of the party that might have missed something.
- **Tools.** READ, SEARCH, EXECUTE (read-only checks, census scripts). No WRITE-TREE. Shape:
  `repo` + `haystack`.
- **Weaknesses / failure modes.** False positives at volume (the order names known intentional
  exceptions); shared blind spots if cast same-family as the author.
- **Owns / must not receive.** Owns S0 — mandatory at the end of every chained or sharded order.
  Never: fixing what it finds; correctness review (→ R0; the discriminator is completeness vs
  correctness, and they run in that order).
- **Review.** Conductor triages; findings become new orders routed by class.

---

### Substrates — deterministic, contract-carrying, non-agent

#### 23. Verifier — class V0 (mechanical verification)

- **Purpose.** Establish facts about a change mechanically — did the declared verification run
  and pass, does the tree match the claim, do cited lines say what the report says — and return
  evidence, never a verdict.
- **Composition.** **Code first, wherever possible**: manifest execution, exit codes, diff
  parsing, tree fingerprinting, nonce validation, schema validation, citation existence,
  process-ledger checks. Model assistance only for checklist classification against explicit
  yes/no criteria, on the cheapest tier with pool room (Luna · low / Haiku · off), with
  ensemble votes where a wrong vote must be absorbed. **Every result records model-assist
  provenance**: whether model assistance was used, which family and casting voted, whether the
  assist influenced the outcome, and the deterministic rule that absorbs a wrong vote — all
  schema fields, not prose. It is owned infrastructure: new
  or changed verifier code is ordinary semantic source work (an E2/E3 author, Q0 tests,
  opposite-vendor R0 review, a human-approved golden corpus for initial trust), and changed
  checker code fails closed until requalified.
- **Typed outcomes.** `PASS`, `FAIL`, `UNAVAILABLE`, `COVERAGE_GAP` — plus commands, versions,
  exit codes, artifacts, duration, tree identity and scope coverage. A deterministic-only
  closure requires complete-oracle proof **and** an outcome untouched by model assistance: an
  outcome influenced by a model vote can never satisfy a deterministic-only closure and takes
  the `COVERAGE_GAP` path instead. `COVERAGE_GAP` forces model review.
- **The writable checkout, and why.** Half the mandatory checks *write*: builds populate caches,
  test runners write fixtures, the mutation check inverts an assertion, the invariant comparison
  applies a migration to a copy. The reference implementation already made this trade
  (`orchestra-review.js`: sandbox defaults to `workspace-write` because "many test runners can't
  run" read-only). Writes are bounded four ways: (1) confined to a throwaway checkout of the
  commit under examination, created outside the repository; (2) no write path to the source of
  truth or any shared branch — nothing it writes ever merges; (3) before/after fingerprint of
  the checkout with generated-artifact classification, so "the suite wrote a cache" and
  "something edited a source file" are distinguishable (the existing INTEGRITY NOTE / WARNING
  split, adopted verbatim); (4) authority unchanged: none — a mutation it performs is an
  experiment, never a proposed change. The dispatcher fingerprints the *real* tree across the
  Verifier's own run, so a write-scope escape is caught by the same mechanism the substrate
  applies to everyone else.
- **Mandatory checks by class.** Tree audit + nonce echo for every authoring seat on every
  vendor; mutation check for new tests; invariant comparison for data changes; reproduction
  re-run for I1; census re-run for E8; citation replay for N0/N1/I0; both-sides re-measurement
  for performance claims.
- **Failure modes.** Scope illusion (a green run on an incomplete manifest — it reports what it
  ran, never "verified"); stale manifests, environment nondeterminism, flaky tests, a checker
  modified by the change under review — all fail closed; false confidence transfer (a Verifier
  pass is not an approval and the report format makes that unmistakable).
- **Economic role.** A red suite discovered by the Verifier costs a rounding error; the same red
  suite discovered by a frontier Reviewer costs a full review. It always runs first; a failed
  mechanical check returns the change to the author without spending a Reviewer at all.

#### 24. Quartermaster — class P0 (allowance accounting and pool state)

- **Purpose.** Know how much of each vendor's allowance remains — per bucket — predict
  exhaustion, and publish the degradation state the router reads.
- **Composition.** Deterministic code over the ledger's recorded calls plus whatever usage
  telemetry each CLI exposes; cheapest-tier model only for summarization. Its numbers are
  relative and predictive, reported as estimates with confidence — an exhausted-pool surprise is
  a normal event, and predicted-versus-observed throttle is itself a ledger metric.
- **The bucket model.** On Anthropic Max plans the allowance is reported (secondary sources; WO-1
  verifies) to be a combined weekly limit **plus** a separate Opus-specific weekly limit, with
  Fable capped at 50% of the combined limit — and exhausting the Opus bucket **silently serves
  Sonnet** for the rest of the rolling window rather than erroring. The Quartermaster therefore
  publishes `AU-all`, `AU-opus`, `AU-fable`, and `OU` — per bucket, not per vendor. If WO-1
  falsifies the two-bucket structure, this collapses to one AU and nothing else changes.
- **The one hard gate a non-judging seat holds.** When `AU-opus` is predicted below reserve, no
  Opus casting is dispatched — Principal, Detective, Investigator and Data Engineer re-cast to
  mirrors or wait; the same gate on `AU-fable` re-casts the Conductor's own turns to its Sol
  mirror. Reason (P15): the failure past that
  boundary is silent substitution, not refusal, so the only reliable defense is to stop before
  the boundary. The gate is mechanical; the Conductor decides only which lawful response —
  mirror or wait — applies.
- **Dynamic review reserve.** Before each scheduling window:
  `required reserve = forecast mandatory-review draw + forecast incident draw + 30% uncertainty
  buffer`, floored at the larger of 8% of the bucket and the measured cost of two gate-class
  reviews. New authorship is throttled whenever the reviewing pool cannot cover the reserve.
- **Owns / must not receive.** Owns P0: bucket state, throttle prediction, ledger maintenance,
  degradation-state publication, cost reporting. Never: routing decisions (it informs and gates
  on measured state; the Conductor decides), content judgment.
- **Review.** Reality — predicted vs observed throttle; a consistently wrong Quartermaster is a
  detectable, fixable defect.

---

# Part 3 — Hierarchy and topology

## 3.1 Who dispatches whom

```
                              USER  /  human approver (T3)
                                |
                     [ CONDUCTOR ]  Fable 5 · owner-set effort
            (Sol mirror at matched effort, from signed checkpoint, restricted)
                                |
     +------------+------------+---------------+----------------+
     |            |            |               |                |
 [EVIDENCE]  [PLANNING]  [CONSTRUCTION]   [ASSURANCE]     [SUBSTRATES]
 Scout        Architect   Operator          Reviewer        Verifier
 Researcher   Synthesizer Runner            Sweeper         Quartermaster
 LC Analyst               Builder           Red Team
 Detective                Principal *
 Archivist                Investigator *
                          Data Engineer
                          Interface Artisan *
                          Spatial Spec *
                          Refactorer *
                          Test Designer
                          Doc Writer
                                |
                 * may dispatch, within its own order only:
                 [ Runner ] [ Scout ] [ Verifier checks ] [ Archivist (bounded) ]
                          leaf seats — may never dispatch
```

## 3.2 Limits

- **Depth: two levels of dispatch, hard.** The Conductor dispatches any role; the starred lead
  roles (Principal, Investigator, Interface Artisan, Spatial Specialist, Refactorer — plus
  Architect for recon only) may dispatch leaf seats (Runner, Scout, bounded Archivist
  extraction, Verifier checks) within their own order. Leaves never dispatch. No third level.
  Why any nesting: otherwise every parallel sweep leg round-trips through the Conductor,
  converting the cheapest work into the most expensive coordination; the nesting targets have no
  judgment authority, so nesting multiplies throughput and cannot multiply decisions.
- **Fan-out ≤ 4 concurrent per lead; Conductor active children 4 by default, 6 hard cap; total
  in-flight agents ≤ 8.** Basis: parallel agent teams measured at roughly 4–7× a normal
  session's tokens (≈7× with teammates in plan mode); subscription CLI guidance converges on 3–5
  parallel subagents.
- **≤ 2 allowance-hungry calls concurrent** (Fable, Opus high+, Sol high+).
- **Single writer for T2/T3 work**; parallel mutation requires isolated worktrees or disjoint
  path ownership; every fan-out ends with the S0 sweep.
- **≤ 2 solver handoffs and ≤ 3 review rounds per task** before human escalation; two REVISE
  cycles anywhere triggers escalate-once-or-re-plan; fan-out above 6 requires a human-approved
  batch policy containing only independent T0/T1 work.
- **Q0 is always Director-created**, never implementer-spawned.

## 3.3 What stays with the Conductor, permanently

Intake and done-criteria; classification; casting decisions; work-order authorship; verdict
arbitration; irreversible-action **gating** (not authorization); user communication; the plan
file; the ledger; the decision to stop. Irreversible-action *authorization* is deliberately not
on the list: the Conductor assembles and validates the authorization packet and refuses
dispatch without it; **signing a T3 action is a named human's, recorded in the ledger with a
timestamp, and no model in this architecture has a path to it.** For same-family-authored
consequential work, final integration is procedural: the Conductor consumes the opposite-family
signed verdict and may not replace it with its own approval.

## 3.4 The cross-family review mandate

**Default everywhere: cross-family.** Under separate pools this is also the load-balancing
mechanism (Part 5.4) — the mandate's default costs the author's pool nothing.

**What distinguishes the mandatory set is that it can never degrade.** Fixed at design time;
not a function of allowance, plan tier, deadline or session state; no rung of the degradation
ladder edits it.

| Class of work | Cross-family review | If the other pool is unavailable |
|---|---|---|
| Data/schema changes; anything T3 | **Mandatory** | **Does not close**: wait (Quartermaster dates the reset), named human expert review recorded in the ledger, or park unmerged with `HOLD: cross-family review unavailable` |
| Security-relevant changes (E7 and the trigger list) | **Mandatory** | as above |
| Principal-tier (E3) work | **Mandatory** | as above |
| Integration gates; a chain's final review | **Mandatory** | as above |
| Comparative-adjudication passes (A1): ledger completeness check, challenges, post-composition audit | **Mandatory** | as above; an unchecked ledger or unchallenged position is not merged |
| Any ceiling-authored change; every Sol-authored tree mutation | **Mandatory** | as above |
| Unattributed / unprovable provenance, at any mandatory class | **Mandatory — fails closed** | concurring independent verdicts from both families, or a named human review recorded in the ledger; no single-family verdict closes it |
| Gate-class Detective CONFIRMED (I0 check 3) | **Mandatory** | verdict stands as LIKELY; cannot authorize gate-class work |
| Routine E2 rounds with full deterministic coverage | *Preferred* | may degrade to fresh-context, different-model, same-family review + mandatory Verifier, with `review.cross_family = false` set by the dispatcher and rendered verbatim in the user report |
| Test-only changes passing a mutation check | *Preferred* | as above |
| Routine (non-deliverable-grade) documentation | *Preferred* | as above |
| Provably inert changes (formatting, comments) | Not required | inert tier: lint + targeted checks, inertness verified from the diff first by whoever reviews |
| **Same-instance review, of any kind** | **Forbidden, always** | no exception exists |

Disclosure is a schema field, not prose: `review.cross_family` is set by the dispatcher from
the dispatch record — never asserted by the reviewer — and a user-facing report omitting it
fails the contract lint. A mandatory-class change closed with `review.cross_family = false` is
an incident, not a tripwire: the change reopens and the permitting path is treated as a
dispatcher defect.

**What the mandate costs.** One extra engine spin-up per gated change (the reference
implementation budgets 600 s for a review, 1800 s for execution; field notes say minutes to
tens of minutes), one full independent verification run, and no prompt-cache reuse — though that
last is inherent to fresh-context review, not to crossing vendors. **Liveness is a deployment
gate (P10):** the mandate activates on a seat only after WO-2 measures that installed tiers
sustain it — service capacity ≥1.43× forecast peak review arrival (1/0.7: the capacity that
≤70% peak utilization requires, so the two gates are consistent), reviewer utilization ≤70%,
P95 artifact-to-verdict queue age ≤60 min (T1) / ≤4 h (T2) in Green state, zero false approvals
during exhaustion drills. A seat that fails capacity gets a larger tier, fewer gate-class
changes per week (scheduled against the weekly cap, queue visible to the user), the qualified
Terra relief lane, or staffed human review — never a lower standard.

## 3.5 Order, report, and verdict contracts

**Order:** `task_id · parent_id · class · risk(T0–T3) · requested_casting(vendor, model,
effort) · author_family · co_author_families · goal · acceptance_criteria · scope_allow/scope_deny(paths) · constraints ·
context_packet · context_shape · search_surface(N0) · tool_capabilities ·
destructive_actions · verification_manifest/commands · verification_tier(full|inert) ·
tool_budget · review_policy(mandatory|preferred|none) · hazard_profile ·
escalation_triggers · artifact_location · integrity_nonce`.

**Report:** `status(DONE|PARTIAL|BLOCKED|CHECKPOINT|UNAVAILABLE|WAITING_FOR_REVIEW|ESCALATE) ·
summary · changes(path:line) · paths_read · search_manifest(N0) · commands_run ·
verification(command → actual output) · evidence · assumptions · deviations · residual_risks ·
scope_variance · recommended_next_class · tree_identity · requested_casting ·
author_family · co_author_families · served_model(where exposed; UNKNOWN otherwise) · fallback_or_classifier_signal ·
pool_observation · integrity(nonce echo, tree audit)`.

**Verdict:** `verdict(APPROVE|REVISE) · findings([CRITICAL|MAJOR|MINOR] path:line — defect —
concrete failure scenario) · claims_checked(claim → CONFIRMED|REFUTED|UNVERIFIED, how) ·
review.cross_family(bool, dispatcher-set) · nits`.

**Authorization packet** (destructive T2 and all T3): `action · risk class · dry_run_result ·
rollback_script · rollback_restore_test_result · invariant_comparison(pre → post) ·
blast_radius · approver(Conductor gate, or named human) · approved_at`. A schema of its own,
because it is the artifact a human reads before signing.

`author_family` and the complete `co_author_families` set are required fields on both
schemas: any model that materially edits an artifact appends its family at dispatch-time
recording, never from memory (P5's "computed from recorded author family"). The review
matrix is computed against the full co-author set, not just the original author; an artifact
whose family set is missing or incomplete **is** the unattributed case of the R0 matrix and
fails closed there.

Author family, model, effort and price are withheld from the reviewer prompt;
`hazard_profile` is rendered without attribution (hazard-preserving blinding). These shapes
deliberately extend the field-tested formats in `agents/executor.md` / `reviewer.md` /
`detective.md` rather than replacing them.

## 3.6 Sticky vendor, fresh reviewer; stall detector

Within one task, keep the executing vendor sticky (a mid-task switch invalidates the prompt
cache); hand-offs pass goal, constraints, files touched, tests, failures — never a raw
reasoning transcript. The Reviewer is exempt: its cache was never warm, so cross-vendor review
costs nothing in cache terms that fresh-context review does not already cost.

Escalation fires when any two occur (immediately at a safety boundary): the same material error
twice; a third architecture without new evidence; tests not improving; lost orientation or a
requested rewrite; output >3× the class median without new verification; a refusal, classifier
signal or unverified fallback; scope crossing the packet boundary; allowance forecast exceeded
by 50%; evidence contradicting the leading hypothesis; unestablishable model identity; review
queue age threatening its SLO. Sequence: repair the packet → next model rung at same effort →
raise effort once (only when reasoning budget is the evidenced bottleneck) → cross-vendor or
ceiling specialist → human. No repeated effort cycling.

---

# Part 4 — Routing table

Twenty-four classes; each has exactly one primary role; the ownership invariant (every class
exactly one primary; no identifier owned twice; every role's declared classes a subset of this
table) is asserted mechanically at registry load (WO-4). Risk (T0–T3) modifies review and
authorization, never the primary.

**Precedence: signals are recall hints, not routers** *(WO-7a redraw, 2026-08-29; items
5/8/21)*. The signals column exists to bring a class to mind; it never decides. A class is
decided by the **requested work product** — the artifact or answer that must exist when the
order closes — and, on any adjacent pair, by its 4.1 discriminator, both answered **from
the request text alone**. The work product is the **immediate operation and phase** — find,
diagnose, synthesize, build, verify — never the container the result lands in: research
folded into a report is N1, table extraction into a brief is M0, a summary reconciled out
of a large session record is N2 while a status note recording settled outcomes is D0
(disc. V); D0 is only for documenting a decision already made (disc. R). Domain nouns in the subject
matter do not route: "add an agent
that drives Blender" is roster work (E2), not spatial code (E6); "set up CI" with nothing
broken is authoring (E2), not environment surgery (E0). When a signal word and a
discriminator disagree, the discriminator wins.

**Discriminators are pairwise-scoped** *(redraw #2, 2026-08-29; bis item 17)*. A 4.1
discriminator is consulted only when the two classes it names are the two contenders. Once
intake narrows a request to classes X and Y, the decision falls to the X/Y discriminator if
one exists, else to this precedence rule and the §4.2 phase rules, else to the residual
rule — never to another pair's discriminator, however suggestive its question reads.

| Class | Task class | Recall signals | Primary role | Primary casting | Reviewer | Escalation path |
|---|---|---|---|---|---|---|
| O0 | Direction and arbitration | routing, verdict conflicts, approvals, reporting | **Conductor** | Fable 5 · owner-set effort (session model; Sol mirror at matched effort) | user; no-overturn rule; cross-family critique for material plans | user decision |
| A0 | Planning / architecture | goal without steps, "how should we", system design | **Architect** | Sol · xhigh (Fable 5 · high–xhigh for nebulous/ambiguous goals; Opus 5 · high on Codex exhaustion) | cross-family plan critique | ceiling effort → A1 comparative session |
| A1 | Comparative adjudication | two credible incompatible plans; framing uncertain | **Synthesizer** | Fable · xhigh / Opus 5 · high / Sol · max | opposite-family ledger completeness check, challenges, and post-composition audit (all mandatory) | unresolved contests → OPEN DECISIONS → user; >4 → re-plan framing |
| N0 | Fetch / find / lookup | "where is", "list all", history | **Scout** | Haiku · off / Luna · low | Verifier citation replay | re-probe once → I0; truncation → N2/I0 auto |
| N1 | Deep external research | vendor docs, standards, prior art | **Researcher** | Sol · med | citation checks; Opus 5 · high when decision-bearing | Sol · high → dual-lane at gate class → A0 |
| N2 | Long-context synthesis | large supplied corpus to reconcile | **LC Analyst** | Terra · med | Opus 5 · high when decision-bearing | Terra · high → Sol · high → I0/A0 |
| I0 | Deep investigation | "why does", "how does X flow", nothing needs running | **Detective** | Opus 5 · high | Verifier + refutation duty; cross-family falsification at gate class (mandatory) | Fable · high → I1 (needs an experiment) |
| I1 | Intricate bug tracing / perf investigation | intermittent, race, Heisenbug, "make it faster" | **Investigator** | Opus 5 · high | cross-family on the fix; Verifier on the repro | Fable · high → A0 (architectural); fix → E2/E3/E4/E0 by shape |
| M0 | Document / media intake | PDFs, screenshots, recordings, charts, "read these" | **Archivist** | Terra · med (documents/PDFs/logs/text) / Opus 5 · med (images/charts/renders); raw video/audio → deterministic transcode fallback or UNAVAILABLE | schema validator + consumer; cross-family review for consequential extractions | → E5/I0/N1 by kind |
| E0 | Terminal / shell ops | build breaks, CI red, toolchain, container — env is the variable, not the deliverable (authoring new CI/config → E2, disc. S) | **Operator** | Sol · high | Verifier (mandatory, tree audit) + Opus 5 · high | Sol · max once → Opus 5 · high (strategy stall; WO-12e trial) → re-plan |
| E1 | Mechanical batch | sweep, matrix, template, uniform codemod, poll | **Runner** | Luna · low–med / Haiku · off | parent spot-check + Verifier oracle; opposite-family diff check if tree-mutating | 2 failures → parent takes it back; non-uniform → E2/E8 |
| E2 | Routine coding | spec exists, scope known | **Builder** | Luna · xhigh–max (bounded, fully-specified) / Sonnet 5 · med (longer or thinner-spec; Terra · med mirror) | Verifier → computed cross-family (preferred band at T1) | 2 REVISE / CHECKPOINT → E3 → re-plan |
| E3 | Complex long-horizon coding | interlocked subsystems, split-resistant | **Principal** | Opus 5 · high (xhigh point) | cross-family **mandatory** + Verifier; checkpoint reviews | xhigh → Fable · high ceiling → re-plan |
| E4 | Data / schema work | migration, backfill, ETL, index | **Data Engineer** | Opus 5 · high (Terra · high reversible-T1 only) | cross-family **mandatory** + invariant compare | I1 (locking/perf) → A0; T3 → named human |
| E5 | Visual / UI work | screenshot, mock, layout, viewport, a11y | **Interface Artisan** | Sol · med–high + browser loop | deterministic checks → Opus 5 closing (read-only) → code review | Fable critic → A0 (design system) |
| E6 | Spatial / procedural code | mesh, shader, scene, CAD, simulation | **Spatial Specialist** | Opus 5 · high | geometry checks → triage → Fable critic → cross-family | Fable/A0 → E0 (toolchain) |
| E7 | Security review | auth, crypto, parsing, deps, secrets | **Red Team** | Sol · high | Opus 5 · high (identity-uncertain = non-closing → human); human sign-off on critical | Sol · max → human security owner. **Never Fable** |
| E8 | Refactoring at scale | semantic rename/API migration with judgment at N sites; "everywhere" (exact uniform token swap → E1, disc. I) | **Refactorer** | Terra · med | Verifier census → Sweeper → cross-family sample+census | E3 (not mechanical after all) |
| Q0 | Test design / authoring | "add tests", fixtures, independent oracle | **Test Designer** | opposite implementation author: Terra · med / Sonnet · med | mutation+flake oracle; implementation-family review of tests at T2/T3 | requirements owner (O0/A0) |
| D0 | Documentation | README, ADR, changelog, migration guide | **Doc Writer** | Sonnet 5 · med (routine) / Opus 5 · med (deliverable-grade) | cross-family accuracy vs diff + Verifier claim sample | Fable (deliverable, Max only) → human (legal) |
| R0 | Adversarial review | a change exists and must be checked | **Reviewer** | computed from the full author/co-author family set | Verifier evidence audit; contested → human once | 2 REVISE → re-plan; 3 rounds hard cap |
| S0 | Post-fan-out sweep | a chain just finished; N legs landed | **Sweeper** | Terra · med | Conductor triage | findings → new orders by class |
| V0 | Mechanical verification | "did it actually pass", claim check, tree audit | **Verifier** (substrate) | code first; cheapest tier assist | none — machine-checkable | failed check → author, pre-review |
| P0 | Allowance accounting | pool state, throttle prediction, cost report | **Quartermaster** (substrate) | code + cheapest tier | reality: predicted vs observed | Conductor re-plans session shape |

## 4.1 Exclusive discriminators (adjacent pairs)

| # | Pair | The one question | Answer → route |
|---|---|---|---|
| A | E0 vs I1 | Does the request itself state an environment axis? | Stated (works on X, fails on Y; install/toolchain/CI infra named as the variable) → **E0**. Not stated → the 4.2 diagnosis chain: symptom whose evidence lives only in a live run → **I1**; inquiry over persisted artifacts → **I0**. A suspected-but-unstated axis is no axis — E0 never absorbs an undiagnosed bug; I1 delivers the environment matrix and hands over if the hunt lands on the environment |
| B | I0 vs I1 | Does the intake name evidence that exists only in a live run? | Yes — intermittence with no persisted trace, timing and races, state that vanishes with the process → **I1**. No — the symptom persists in artifacts that can be read (files on disk, logs, history, code as text) → **I0**. Unanswerable from the intake text → **I0** (lower blast radius). A symptom being active, ongoing, or recurring is not by itself a running requirement (redraw #2). A Detective concluding "run an experiment" has finished correctly |
| C | N0 vs I0 | Location or cause? | where/which/when → **N0**; why/how/load-bearing → **I0**. A surviving UNKNOWN becomes I0, never a third scout |
| D | N0 vs N1 | Can the repository settle it? | Yes → **N0**. No → **N1** |
| E | N1 vs M0 | Is the corpus already in hand? | Must be found → **N1**. Named and fixed, job is extraction → **M0** |
| F | N0 vs N2 | Was the declared surface exhausted without truncation? | Yes → **N0** result stands. No → **N2** (automatic) |
| G | E2 vs E3 | Does the request itself name coupled contracts — ≥2 components that must change together, or an acceptance unit that cannot land in independent pieces? | Yes, observable in the intake text → **E3** — named coupling beats a named template to mirror. No coupling named (a named template/lane to mirror is evidence of separability, never an override) → **E2**. "Big" is not an answer; big-and-separable is a chain of E2 orders. Never decided on imagined implementation facts. A **component** is an artifact that could land as its own order — a subsystem, file set, or contract with independent acceptance; clauses, fields, or rules of one document, policy, or mechanism are one component however many the request enumerates, and an acceptance unit qualifies only when it spans ≥2 such components (redraw #2) |
| H | E3 vs E8 | Is the risk a wrong line or a missed site? | Wrong line → **E3**. Missed site, semantics constant → **E8**. Both — a novel core plus an N-site migration → the composite rule (4.2): **E3** parent owns the core, E8 child order carries the fan-out |
| I | E8 vs E1 | Is the transform strictly uniform, enumerable, and validator-checkable? | Yes — an exact token substitution, grep-verifiable, however many files → **E1**, and this beats E8's signal words. No (pattern plus judgment at sites) → **E8** |
| J | E8 vs E4 | Does any persisted data change shape or content? | No → **E8**. Yes → **E4**, even when the code is trivial |
| K | E5 vs E6 | Document flow, or generated geometry? | DOM/native-widget flow → **E5**. Meshes, shaders, scenes, simulation → **E6** |
| L | I1 vs E2 (performance) | Is the bottleneck confirmed with a profile and numeric target? | No → **I1** first. Yes → the fix class per shape, carrying the profile as spec |
| M | R0 vs E7 | "Is it correct?" or "how would an attacker use it?" | Correctness → **R0**. Exploitability → **E7**. Both, on the trigger list → both, in that order |
| N | R0 vs V0 | Does answering require judgment? | No — command, exit code, diff, fingerprint → **V0**. Yes → **R0**. V0 always runs first |
| O | S0 vs R0 | Completeness or correctness? | Missed a site → **S0**. Is what landed right → **R0**. That order; never the same instance |
| P | A0 vs A1 | Does a plan exist yet? | None, or one to author → **A0**. Two credible incompatible plans → **A1** |
| Q | O0 vs A0 | Routing decision, or a plan? | Which role/casting/verdict → **O0**. Sequenced steps with acceptance criteria → **A0** |
| R | D0 vs A0 | Is the decision already made? | Yes → **D0**. No — the document *is* the decision → **A0** |
| S | E0 vs E2 | Is the environment the variable, or the artifact? | Something that used to work behaves differently across envs/installs/runners → **E0**. Authoring or extending config/workflow/CI whose desired behavior is specified and nothing is broken → **E2**. "CI" as a word routes nothing |
| T | E2 vs E8 | Does the request name one central mechanism, or a set of surfaces? | One named mechanism, rule, or helper — however many consumers benefit → **E2**. A named surface set — "all", "every", "everywhere", N listed sites each to be found and touched → **E8**. Topology unstated → **E8**: a needless census is bounded waste; a missed site is silent |
| U | I0 vs N2 | Is the deliverable a causal mechanism, or a cross-source synthesis? | A mechanism explaining observed behavior → **I0**. An exhaustive pattern/category synthesis over a named fixed corpus → **N2** |
| V | D0 vs N2 | Must the content be recovered from a corpus, or is it settled? | Producing the document requires reading and reconciling a body of material to learn what it must say → **N2**. The content is settled at intake — named events, decisions, and outcomes to record, however summary-shaped the container → **D0** |

**Residual rule.** A request still matching two primaries is a classification defect — and
"the cheaper of the two" is undefined across pools, because AU and OU do not convert (Part
5.2). The Conductor routes to whichever primary carries the **lower blast radius on a wrong
answer** — acceptance risk, not price — capped at a triage budget, and logs the ambiguity
against the pair. Three logged ambiguities on one pair force a boundary redraw or a merge.

## 4.2 Phase rules (WO-7a redraw, 2026-08-29)

Two rules that operate above the pair discriminators. Both exist because WO-7a failed
(31/40): every disagreement traced either to a boundary decidable only with solution facts,
or to a composite request with no decomposition rule (ledger: `wo7a-corpus.md`).

**Diagnosis before implementation** *(items 9, 11, 16)*. A request that reports a symptom
whose cause the request text does not establish is an investigation first, never a presumed
fix, routed by an explicit precedence chain: **(1)** an environment axis stated in the
request → **E0**; **(2)** a symptom whose evidence exists only in a live run and so must be
reproduced or instrumented → **I1**; **(3)** a root-cause inquiry whose evidence persists
in fixed artifacts (logs, history, files, code as text) → **I0**. Between (2) and (3)
discriminator B decides on the evidence named at intake — a symptom being active, ongoing,
or recurring never by itself establishes a running requirement (redraw #2) — and
unanswerable → I0. The
fix is a second order, classified by shape once the cause is known — exactly the
hand-over I1's escalation path already names. A request that states its own cause and asks
for the remedy routes directly to the fix class. Corollary — **intake decidability**: every
discriminator is answered from the request text alone; an answer that needs facts only the
work will produce is "unknown" and triggers this rule, and a classification rationale that
cites implementation facts absent from the request is void.

**Composite orders** *(item 36)*. A request bundling a novel interlocked core with an N-site
fan-out is one **E3** parent order that owns the core and the acceptance criteria,
dispatching the fan-out as an **E8** child order (**E1** if strictly uniform); a pure
fan-out with no novel core stays E8. Classify by which component carries the acceptance
risk, never by which has more words or touches more files.

---

# Part 5 — Cost model (denominated in subscription allowance)

## 5.1 What is scarce

There is no bill; there are two independent, rate-limited pools refilling on their own
schedules, and the failure mode is a stall, not an invoice.

**Anthropic (Claude Code seat) — modeled per bucket.** On Max plans: a combined weekly limit
across all models, plus a separate Opus-specific weekly limit, on top of a rolling five-hour
window; Fable is included up to 50% of the weekly limit on Max-and-above and **not included at
all on Pro/standard Team** (usage-credits only — a metered path outside this basis). Exhausting
the Opus bucket is reported to silently serve Sonnet rather than error (secondary-sourced;
load-bearing; WO-1 verifies first). Non-harness product use drains the same pool; parallel
agent teams draw ≈4–7× a normal session.

**OpenAI (Codex on a ChatGPT plan).** Five-hour rolling window plus an unpublished weekly cap;
metered by tokens; the window was removed for Plus on 2026-07-12 and reinstated the week of
2026-08-25 — a six-week policy oscillation that is itself a design input (P9). Published
per-window message ranges (the closest thing to a published allowance anywhere in this
exercise): Plus — Sol 10–100, Terra 25–200, Luna 250–2,000; Pro tiers scale ×5 / ×20.

## 5.2 Units, and the honesty rule about them

One unit per pool; pools do not convert.

- **1 AU** = one Sonnet 5 · medium worker turn. Haiku ≈0.2 · Sonnet 1 · Opus ≈5 · Fable ≈10.
  *Estimates:* the two independent syntheses behind this document produced Opus/Sonnet ratios
  differing by ~2× (≈5× from list-price extrapolation vs ≈2.3× from message-equivalent
  guesses) — which is itself the finding: **the AU weights must be measured (WO-1), not
  argued.** The 5× figure is carried provisionally as the list-price-consistent estimate.
  Written per bucket on Max: AU-S (combined limit only), AU-O (combined + Opus limit), AU-F
  (combined, against the 50% sub-cap).
- **1 OU** = one Luna · low message. Luna 1 · Terra ≈10 · Sol ≈22 — derived from the published
  per-window ranges (both source designs derived the same ratio independently). The real meter
  is tokens, so these are bounds; effort and context length multiply per-call draw.

The OpenAI side can be expressed as a share of a window today (published ranges); the
Anthropic side cannot, and inventing a denominator would fabricate a number — so Anthropic
shares are carried against measured constants (`C_all`, `C_opus`, `C_fable = 0.5 × C_all`)
that WO-1 fills in. Illustrative: a gate-class Sol review ≈110 OU is 5–44% of one Plus window —
meaning **a Plus-tier OpenAI seat cannot sustain the mandatory set on a busy day**, a concrete,
checkable statement about which seats this architecture suits, and the reason WO-1/WO-2 run
before anything is built.

## 5.3 Per-class draw and the illustrative mix

Per-round, order-of-magnitude figures (mid-sized order, one review), for comparing classes —
not predicting a bill:

| Class | Author draw | Verifier | Reviewer draw (opposite pool) |
|---|---|---|---|
| O0 | 5–15 AU-O /session | — | 30–120 OU for material plans |
| A0 | 100–200 AU-F (60–120 AU-O below Max) | ≈0 | ~110 OU plan critique |
| A1 | ~200 AU-F + ~220 OU (two lanes) | ≈0 | ~110 OU + ~40 AU-O challenges + ~110 OU ledger check + ~110 OU composition audit (Anthropic-cast Synthesizer) |
| N0 | 0.2–1 AU-S or 1–3 OU | ≈0 | — |
| N1 | 110–330 OU | ≈0 | ~50 AU-O at gate class |
| N2 | 20–60 OU | ≈0 | ~50 AU-O when decision-bearing |
| I0 | 50–100 AU-O | ~1 OU | 0–110 OU (gate-class falsification) |
| I1 | 50–150 AU-O | ~1 OU repro | ~110 OU on the fix |
| M0 | ~50 OU (documents) / ~10 AU-O (images) | ≈0 schema | consuming role; ~25 AU-O if consequential |
| E0 | 220–550 OU | ~0.2 AU-S audit | ~25 AU-O |
| E1 | 2 AU-S or 10 OU (×10 legs) | ~1 OU | parent spot-check |
| E2 | 10–25 AU-S | ~1 OU | ~110 OU T2; 20–60 OU qualified-Terra T1 |
| E3 | 75–150 AU-O (150–300 AU-F at ceiling) | ~1 OU | ~110 OU per checkpoint set |
| E4 | 75–150 AU-O | invariant compare ≈0 | ~110 OU **mandatory** |
| E5 | 110–220 OU | deterministic ≈0 | closing 25–50 AU-O + ~25 AU-O code |
| E6 | 75–150 AU-O | geometry ≈0 | triage OU → ~75 AU-F rare → ~110 OU |
| E7 | 220–440 OU | reproduce ≈0 | ~25–75 AU-O + human on critical |
| E8 | 30–80 OU | census ~1 OU | Sweeper 20–50 OU + ~35 AU-O sample |
| Q0 | 20–80 OU or 8–20 AU-S | mutation ~1 OU | opposite-test-author at T2/T3 |
| D0 | 2–10 AU-S routine; 10–25 AU-O deliverable | claim sample ~1 OU | 10–40 OU T1; ~110 OU public |
| R0 | — (the reviewer *is* the cost, on the author's opposite pool) | — | — |
| S0 | 20–50 OU | — | Conductor triage |
| V0 / P0 | ≈0 (code) to ~1 OU | — | — |

**The mix, complete and reproducible.** The illustrative mix is a full 100-primary-order
frequency table — the workload-mix method of the B-lane source plan (plan-B-v2.md, "Illustrative
workload mix"), adapted to the final taxonomy: E8 is carved from E2's former 20% share; A1 is
episodic (roughly once per project) and excluded from the steady state; S0/Q0/R0 are generated,
not primary; V0/P0 are substrates drawing ≈0. Shadow mode replaces it with the measured mix.

| Class | /100 | Class | /100 |
|---|---:|---|---:|
| N0 | 22 | E4 | 3 |
| E2 | 18 | E5 | 3 |
| E1 | 12 | N1 | 3 |
| O0 | 6 | N2 | 3 |
| E0 | 6 | E8 | 2 |
| I0 | 5 | A0 | 2 |
| I1 | 4 | E6 | 1 |
| E3 | 4 | E7 | 1 |
| D0 | 4 | M0 | 1 |

Generated load, derived from the table and the review/Q0 policies:

- **Review orders (≈48).** Reviewable authored changes: E0 6 + E2 18 + E3 4 + E4 3 + E5 3 +
  E6 1 + E7 1 + E8 2 + I1 4 = 42; plus material plan critiques (A0 2, O0 ~2 of 6 sessions),
  gate-class I0 falsification (~2 of 5), and D0 accuracy reads (4) = 52; same-kind batching of
  small T1 E2/D0 rounds (~4 batched away) ≈ **48 per 100 primaries** — the prior figure,
  now derived. Of the 52, 40 review Anthropic-authored work (landing on the OpenAI pool) and
  12 review OpenAI-authored work (E0 6 + E5 3 + E7 1 + E8 2, landing on the Anthropic pool).
- **Q0 orders (18).** Mandatory classes E3 4 + E4 3 + E7 1 = 8; trigger-matching T2 orders in
  E2/E0/E5/E8 ≈ 6 (one third of E2 assumed T2); calibration sample = 25% of the ~15 T1
  E2/E5/E6 orders ≈ 4. Total = **18** — the prior figure, now derived.

**Within-pool shares (recomputed — one headline changes).** OU ledger from the midpoints of
the draw table above, with the split assumptions stated: E2 = 12 T1 rounds at ~40 OU
(qualified Terra) + 6 T2 at ~110 OU; I0 falsification 2 × 110; A0 critique 2 × 110; O0
material 2 × 75; D0 4 × 25; E1 ~3 of 12 batches on Luna ≈ 45 OU total; Q0 splits 14
Terra-authored (~50 OU each, opposite Anthropic implementations) vs 4 Sonnet-authored; S0 ~8
sweeps × 35; the single M0 order document-shaped on Terra (~50 OU).

| OpenAI-pool consumer | OU (midpoints) | Share |
|---|---:|---:|
| R0 reviews of Anthropic-authored work | ≈3,150 | ≈38% |
| E0 terminal authorship (6 × 385) | ≈2,310 | ≈28% |
| Q0 tests for Anthropic implementations | ≈700 | ≈8% |
| N1 research authorship (3 × 220) | ≈660 | ≈8% |
| E5 UI authorship (3 × 165) | ≈495 | ≈6% |
| E7 security authorship (1 × 330) | ≈330 | ≈4% |
| S0 sweeps (8 × 35) | ≈280 | ≈3% |
| N2 + E8 + M0 + E1 authorship | ≈325 | ≈4% |
| **Total** | **≈8,250** | 100% |

Reviews of Anthropic-authored work remain the **largest single OpenAI-pool consumer — but at
≈38% of OU, not the ~60% previously asserted**. The recomputation changes that headline and
the reason is identifiable: the ~60% came from the B-lane source table, whose OpenAI authoring
midpoints are roughly half of this document's own Part-5.3 ranges (E0 60–300 there vs 220–550
here), and the larger authoring denominator dilutes the review share. The conclusion survives
the correction: **the OpenAI pool funds the de-correlation mandate while also authoring
terminal, UI and security work.** This is why N0 stays on Haiku, why the qualified Terra T1
review lane exists, why author concurrency is bounded by projected review demand, and why the
reserve is forecast-driven rather than a constant.

## 5.4 Where the savings come from — and what the mandates add back

Savings: volume runs on the cheap band (lookups, sweeps, batches and verification round to
nothing against one frontier review); round-count reduction is the dominant lever (P14); the
Verifier turns "the suite was red" from a full review into a rounding error; effort discipline
(defaults medium; `max` on exactly two seats); inspection runs below generation in
produce-inspect loops; capability is not spent where the task cannot use it — with
documentation named as the honest exception where the cheap tier is a false economy.

Add-back: each mandated review costs one sequential opposite-pool run (5–20 min T1, 20–90 min
T2, to be replaced by measurement) — materially more review volume than the dossier's 3–8%
prior because the mandate is broader. **And the give-back:** under separate pools, a
cross-family review moves the entire second verification pass onto a different meter — a
routine Anthropic-authored round reviewed same-family adds ~125% Anthropic draw; reviewed
cross-family it adds zero. The de-correlation mandate is therefore *also* the load-balancing
mechanism — but the 5.3 arithmetic shows the relief is asymmetric, not a doubling: ~40 of the
~48 reviews are of Anthropic-authored work and land on the OpenAI pool against ~12 in the
other direction, and the pools are not the same size. "Roughly twice as long" would hold only
under conditions this mix does not meet — gate-class authorship split evenly across two
comparably-sized pools. What the arithmetic does support: cross-family review moves the entire
second verification pass off the author's meter, sparing the Anthropic buckets ~40 frontier
review rounds per 100 primaries while deepening the OpenAI review bottleneck 5.3 exposes.
Consequence: alternate the *authoring* pool across independent orders deliberately, which
automatically alternates the reviewing pool and is the real lever for stretching both.

## 5.5 Pool states and the degradation ladder

Evaluated **per bucket** by the Quartermaster; the Conductor announces every rung change to the
user. No rung edits the mandatory set.

| State | Remaining fraction | Router behavior |
|---|---|---|
| **Green** | ≥ 40% | Full architecture; primary castings |
| **Amber** | 20–40% | Authoring on this bucket re-casts to the healthy pool's mirrors, per role; review unchanged (last thing to sacrifice). P15 gate arms: below 40% AU-O, no Opus dispatch without Quartermaster confirmation |
| **Orange** | 8–20% | Authoring on this bucket suspended; ceiling seats deferred (AU-F stops first); only review, verification and in-flight completion draw; batch same-kind small changes into single review passes |
| **Red** | < 8%, or the dynamic reserve breached, or a throttle observed | Only calls that close already-authored changes. Mandatory classes whose cross-family direction needs this bucket **do not close** (wait / named human / park). Preferred classes may take the disclosed degraded path. Irreversible work waits, unconditionally |

**Exhaustion matrix:**

| Exhausted pool | Control plane | Continues | Blocks |
|---|---|---|---|
| Anthropic | Sol Conductor mirror at matched effort from signed checkpoint (restricted authority) | T0 work; already-classified OpenAI T1 work; OpenAI-authored artifacts reviewable by… nobody same-family — a named human for consequential closure, or wait | New consequential classification; OpenAI T2/T3 closure without an independent family |
| OpenAI | Fable Conductor remains | T0 work; OpenAI-authored artifacts still reviewable by Anthropic | New Anthropic semantic authorship whose review cannot be scheduled (queue visible, dated) |
| Both | no model-side control plane; queue state persisted for resume | deterministic-only V0/P0 checks | all model-cast work; consequential closure waits or goes to a human |

With the Gemini lane removed (5.6) there is no third pool: any state this ladder cannot absorb
falls back to the human operator sooner than a three-vendor design would have — owned as a
conscious trade (owner ruling 2026-08-28, audit open item (b)).

## 5.6 The Gemini lane — removed

The Google/Gemini lane was removed by owner decision (2026-08-28): the integration and
operational cost of a third provider was judged not worth its capabilities for this deployment,
giving up a third independent pool and native video/audio intake (now served by M0's
deterministic degradation path or typed `UNAVAILABLE`).

---

# Part 6 — Deltas from the current roster

## 6.1 Kept, unchanged in substance

Two-tier recon (locate vs causal); the read-only law on recon seats; one-deliverable-kind
sizing and split triggers; cadence clauses (heartbeats, checkpoint commits, tool-call budgets);
the verification-tax analysis and the inert tier with diff-verified inertness; the
fresh-context reviewer that re-runs tests itself; report formats (extended, not replaced); the
guard's Director/worker tool separation; blind-merge anonymity law; "an agent's turn ends when
its report does"; nonces, tree audits, pinned review worktrees, process ledgers, typed MCP
transport — preserved and generalized to every provider adapter.

## 6.2 Re-cast

| Current | Becomes | Why |
|---|---|---|
| Director = Fable (MODE A) / Opus (MODE B) | **Conductor = Fable 5, the interactive session model, at owner-set effort**; Sol depletion mirror at matched effort; Opus barred from all USER-DIALOGUE seats and re-aimed at deep work (I0/I1/E3/E4/E6) | Owner re-cast 2026-08-28 superseding the merge's converged Opus choice: field-observed degradation of Opus's human-facing reporting, on the seat whose core function is talking to the owner; the Fable ration is freed by the Sol-default Architect |
| `reviewer` = Opus always, cross-vendor pass by convention | **Reviewer computed from recorded author family** | The convention asks a loaded Director to remember three conditional rules; computing it removes the failure from human memory |
| `executor-heavy-xhigh` as a second agent definition | an effort point of Principal, routed | The protocol already says one tier, two effort points; a duplicate definition invites a phantom escalation rung |
| `modeler` specialist (Sonnet) | **Spatial Specialist**, first-class, Opus 5 · high | A named task class with distinctive failure modes; the evidence points at the ceiling band, not the workhorse |

## 6.3 Split

| Current | Splits into | Why |
|---|---|---|
| `detective` (read-only) | **Detective (I0)** + **Investigator (I1)** | The charter forbids running the experiment its own hypothesis requires (`agents/detective.md` line 13); intricate bug tracing falls between two seats today |
| `executor` (universal author) | Builder, Operator, Refactorer, Test Designer, Data Engineer, Interface Artisan, Spatial Specialist, Doc Writer (+ Investigator's fix-with-repro) | One seat cannot state a usable weakness profile for nine authoring shapes with different verification needs |
| `scout` (all recon) | **Scout (N0)** + **Researcher (N1)** + **LC Analyst (N2)** + **Archivist (M0)** | Different context shapes, castings and failure modes: missed file ≠ fabricated citation ≠ false synthesis ≠ misread chart |
| review as one act | **Verifier (V0)** + **Reviewer (R0)** + Conductor arbitration | Separates mechanical from judgmental from decisional (P6, P12); a red suite stops costing a frontier review |
| `/deep-plan` + `/cross-compare-plan` as separate skills | one Architect contract with two modes, plus the Synthesizer | Identical roles; only the wave structure differs |

## 6.4 Merged or retired

| Current | Disposition |
|---|---|
| `executor-codex`, `executor-codex-heavy` | retired as roles; become mirror castings of Builder and Principal — removes `executorEngine` fallback logic and the inverted review-pairing convention |
| `reviewer-codex` | retired as a role; becomes the OpenAI casting of the computed Reviewer |
| `architect-claude`, `-xhigh`, `-max`, `architect-codex` | retired as four roles; become castings of Architect — also fixes the installed/master drift where raising effort silently changed the model, and equalizes the two lanes' web-tool surfaces (comparative sessions must grant identical capability sets) |
| `planner-gpt` + the `/deep-plan` API transport | **migrated to the subscription Codex CLI transport** every other cross-vendor lane uses; the `OPENAI_API_KEY` `/v1/responses` path is the only metered lane in the tree and violates the deployment basis. If the CLI cannot satisfy the contract, the feature is reported unavailable; an API version may survive only as an explicitly-enabled, separately-billed add-on |
| `modeler` specialist template as extension mechanism | kept, narrowed: specialists remain right for project-specific domains, and stop being the mechanism for general capability gaps, which are now roles |

## 6.5 Added

Net-new seats: Investigator, Operator, Researcher, LC Analyst, Archivist, Test Designer, Data
Engineer, Interface Artisan, Refactorer, Doc Writer, Red Team, Sweeper, Synthesizer; substrates
Verifier and Quartermaster. Net-new machinery: capability registry as the single source from
which every runtime form is generated (verified drift already changes model, effort and tool
surface between master and installed copies); `.claude/orchestra.json` extended with taxonomy,
casts, context shapes, family matrix, Q0 triggers, verifier manifests, topology caps, live pool
state and review forecast; guard derives control-role identity from the registry instead of a
model-name regex (a fixed regex cannot support the Sol mirror); installer validates uniqueness,
model availability, subscription authentication (an active `ANTHROPIC_API_KEY`/API-key sign-in
fails the subscription-only gate), family, review-liveness, fallback and modality.

## 6.6 Transition safety

1. **Alias layer before any rename**: every retired name resolves to a `(role, casting)` pair
   (`executor → Builder(primary)`, `executor-heavy → Principal(high)`, `executor-heavy-xhigh →
   Principal(xhigh)`, `executor-codex → Builder(mirror)`, `reviewer → Reviewer(computed)`,
   `reviewer-codex → Reviewer(OpenAI casting)`, `scout → Scout`, `detective → Detective`,
   `modeler → Spatial Specialist`, `architect-* → Architect(casting)`, `planner-gpt →
   Architect(mirror)`, `plan-synthesizer → Synthesizer`), emitting ledger deprecation lines.
2. **Shadow period**: minimum two weeks or twenty orders, both rosters installed, ledger
   records the path each order took.
3. **Canary by ascending consequence**: evidence/mechanical → routine authoring → hard
   authoring → domain → data and security → orchestration; a tier promotes only after the tier
   below ran clean.
4. **Kill switch**: `roster: legacy | new`, evaluated per order; rollback is a flag flip.
5. **Mandatory rollback triggers**: escape rate above threshold; live routing agreement below
   threshold; any mandatory-class change closed same-family; two consecutive
   bucket-state surprises. Deletion only after the acceptance gates pass on the new roster
   while the old one is still installed.

---

# Part 7 — Open risks and verification

## 7.1 Risks

| Risk | Failure mode | Detection and response |
|---|---|---|
| Review throughput failure | safe work queues indefinitely behind the mandate | WO-2 capacity probe before anything is built; queue SLOs; dynamic reserve; author throttling; qualified Terra relief; larger tier or human staffing. Safety without liveness is not acceptance |
| Allowance model wrong | AU/OU weights diverge >2× from reality; scheduler mis-reserves | WO-1/WO-16 measurement; the model is relative by design, so castings survive absolute error |
| Two-bucket claim wrong | §5 collapses to one AU; P15's first mechanism disappears | WO-1 settles it in a day (deliberate Opus-bucket exhaustion probe); classifier-fallback filters survive regardless |
| Silent model substitution | a hard order served by the workhorse with nothing saying so; reviews calibrated to a model that never ran | pre-dispatch bucket gate (avoidance), `served_model` attestation where exposed (detection), topic route-filters (Fable/security) |
| Roster bloat | 22 roles degrade routing instead of improving it | WO-7a/7b ambiguity scores; ledger "orders re-routed after dispatch"; ordered merge list if it fails (Sweeper→Refactorer, LC Analyst→Researcher, Archivist→Researcher) taking the roster toward 19 |
| Cross-family mandate unaffordable on asymmetric seats | the small pool exhausts first; gated work queues | throughput, not standards, absorbs it: fewer gate-class changes per week, authorship routed to the small pool and review to the large one, same-kind batching; if still short, the design says the seat is too small rather than lowering the bar |
| Specification gaming | tests/fixtures/CI edited to reach green | Verifier tree audit vs declared scope; mutation checks; cross-family review for the plausible scope-adjacent edit |
| Benchmark mismatch | public scores don't predict this harness (scaffold effects) | every moderate-confidence casting carries a paired trial (WO-12); scaffold-uncontrolled rows marked as such in the evidence register |
| Q0 omission | the implementer defines its own oracle | automatic trigger test; missing Q0 blocks applicable work |
| N0 omission | bounded-looking lookup depended on unsearched evidence | enforced search surface, recorded truncation, automatic reclassification |
| Verifier oracle defect | deterministic PASS proves the wrong property | manifest versioning, coverage states, golden corpus, mutation tests, reviewed and requalified verifier changes |
| Human bottleneck | T3 and disputes wait indefinitely | concise decision packets, response-time objective, visible queue |
| Shared-input false agreement | two vendors agreeing mistaken for two vendors being right | claims both lanes accept without independent evidence are marked *verify during execution*, never promoted to fact |
| Runtime coupling | contracts welded to one CLI's plumbing | tool surfaces are capability classes; registry is runtime-neutral with tested adapters |

## 7.2 Whole-system acceptance gates

The architecture ships only when all hold (thresholds are proposed operational values):

- 100% of work orders route to exactly one primary; registry load asserts the bijection.
- Zero audited self-review; zero same-family closure of a mandatory gate under any pool state,
  including Red and exhaustion drills (adversarial route tests, not observational).
- 100% of semantic source changes carry deterministic evidence plus a signed independent
  verdict; 100% of trigger-matching implementations created a Q0; 100% of T3 effects carry a
  named human approval with timestamp.
- Review capacity ≥1.43× forecast peak arrival on installed tiers (1/0.7 — the capacity ≤70%
  peak utilization requires, keeping the two gates consistent); utilization ≤70%; P95 Green
  queue age ≤60 min (T1) / ≤4 h (T2); exhaustion tests yield neither false approval nor
  invisible queueing; the Conductor-mirror drill preserves all open orders with zero restricted
  closures.
- Seeded major-defect recall ≥90% and false blockers ≤10% for the whole review system,
  demanded on a ≥100-defect corpus (or the live-review equivalent) with its ±~7pp interval
  stated alongside the result — the WO-12 power rule's full-qualification bar, not an n=20
  trial; cross-family recall gain measured (WO-12d) — a null result narrows the *preferred*
  band and re-aims reviewer effort, and never relaxes the mandatory set (a 20-sample
  experiment cannot carry that weight).
- Escape rate no worse than baseline at the accumulated sample's confidence interval — a
  "within 1 point" comparison is unmeasurable at shadow-period volumes, so the gate accrues
  over live monitored reviews; premium allowance per accepted T1 task ≥35% below an
  all-frontier baseline; peak single-pool draw falls more than total draw (the balancing claim).
- No class budget below one turn of its assigned casting (schema-validated); observed pool
  shares reported from a stated mix; predicted-vs-observed throttle within 30%.
- No default transport uses API keys or per-token billing; subscription authentication audited.
- Raw M0 audio/video never silently narrows to a non-capable cast: absent the local
  degradation dependency, the modality returns typed `UNAVAILABLE`.
- Routing: ≥90% agreement on the 40-request corpus, ≤2 genuine ambiguities, no adjacent pair
  accumulating three logged ambiguities; a competent operator routes 10 unseen requests from
  the one-pager in under a minute each with ≥9 correct.

## 7.3 Standing telemetry

Per call: task id, class, risk, role, requested casting, served model where exposed, bucket,
context shape/size, tool calls, wall clock, draw estimate, status, review rounds, verdict,
`review.cross_family`, escape (set later), human intervention. Per session: bucket states,
rungs entered, preferred-band same-family reviews, T3 approvals with approver, roster path
during shadow, alias deprecations. Per reviewer lane: live recall estimate and escape rate,
from day one, accumulating toward the WO-12 full-qualification corpus. Tripwires: a
qualified lane's confirmed escape pattern, or its live recall estimate falling below the
incumbent's interval (revokes the lane pending a larger trial, per the WO-12 power rule);
heavy-tier share >25% of orders (sizing law
failing); cheap-band share high with accept rate low (under-escalation); ceiling+orchestration
draw >70% of a bucket; throttle prediction off >30%; any undisclosed degraded review (process
defect of the most serious kind); any mandatory-class same-family closure and any unapproved T3
action (incidents that stop work); served-model mismatch (P15 incident — re-run and check
whether any verdict was issued against substituted output).

---

## Orders

Work orders sized per §8.1: one deliverable kind each; probes before bets; the riskiest
assumptions first.

### WO-1: Measure the pools and the substitution boundary
Instrument the *existing* roster for one weekly cycle (no behavior change): per call, record
role, model, effort, vendor, bucket, tool calls, wall clock, tokens where exposed, and the
CLI's remaining-allowance signal. Deliver draw per routine round, draw per gate-class round,
and time-to-throttle **per bucket** (`AU-all`, `AU-opus`, `AU-fable`, `OU`). Two priority
facts: does the seat in use really have a separate Opus bucket, and what happens at its edge —
deliberately exhaust it on a throwaway session and observe whether the served model
self-identifies as requested. Also deliver the **Opus-concentration watch** (owner ruling
2026-08-28, audit open item (c)): the AU-O fraction drawn by the I0/I1/E3/E4 mix; if it exceeds
60% of the weekly Opus bucket at readout (proposed operational value), the Conductor rotates
Detective/Investigator dispatches to their Sol mirrors deliberately rather than waiting for the
P15 gate. *Stop condition:* a single day's normal work exhausting a pool →
re-scope the mandate's throughput assumptions before anything else proceeds.

### WO-2: Probe review throughput and drill the control-plane handoff
Route ≥20 representative completed changes through the forced cross-vendor review path the
harness already supports (`reviewEngine: "codex"` / `"dual"`). Measure complete reviews per
five-hour window, turns per review, pool movement, wall clock, retries, queue age. Drill one
Fable→Sol Conductor checkpoint handoff on a synthetic workload and prove no restricted decision
closes. *Stop condition:* projected mandatory-review capacity <1.43× expected peak arrival
(the level the ≤70%-utilization gate requires) → provision a larger tier, shrink expected
gate-class volume, or hold the mandate's activation.

### WO-3: Settle Gemini access
Withdrawn — the Google/Gemini lane was removed by owner decision after review (integration and
operational cost of a third provider judged not worth its capabilities for this deployment).
Preserved here so later work-order references keep their numbers.

### WO-4: Schemas, class registry, ownership invariant
Author the six schemas (order, report, verdict, authorization packet, casting record, verdict
audit) as the single source of truth; encode the 24 classes, risk tiers, and Part-4.1
discriminators as data; assert the ownership invariant mechanically (24 classes, 24 primaries,
no identifier twice, declared classes ⊆ table). Include integrity block, `requested_casting`/
`served_model`, `review.cross_family` (dispatcher-written) as required fields.

### WO-5: Build the Verifier substrate first
Deterministic core as code: manifest execution, exit-code capture, diff parsing, tree
fingerprint, nonce echo, schema validation, mutation check, invariant comparison, citation
replay. Deliver the disposable-checkout substrate first (creation outside the repo,
before/after fingerprint with generated-artifact classification, guaranteed teardown,
dispatcher-side fingerprint of the real tree across the Verifier's own run). Proof: catches a
red suite reported green, changes claimed against an untouched tree, an invertible test that
stays green, and a broken row-count invariant — on a project whose suite cannot run read-only.

### WO-6: Router, casting tables, review matrix, degradation machine, Q0 triggers
Implement `route(class) → role`, `cast(role, bucket_state) → (vendor, model, effort)`,
`reviewer(author_family, risk) → casting`, the pool-state machine, the pre-dispatch AU-O gate,
and automatic Q0 creation. Unit proof: no-self-family holds for every author family; no
mandatory-class dispatch can produce a same-family closing verdict under any bucket state
including Red/exhausted; context-shape violations rejected; every rung yields its documented
casting set; every trigger-matching implementation spawns Q0.

### WO-7a: Classification corpus — on paper, before the schemas
40 historical tasks from this repository's history stripped to one-line requests, classified
independently by a human and one model against the Part-4/4.1 tables **as written** — run
before WO-4, so boundary redraws happen before the schemas encode the classes; seeded with the
adjacent pairs (E0/I1, I0/I1, E2/E3, E8/E1, E5/E6, N0/N2, performance intake). Threshold: ≥90%
agreement, ≤2 genuine ambiguities — else redraw boundaries now, before the registry and 22
agent definitions exist.

**Outcome (2026-08-29): FAIL — 31/40 (77.5%), two genuine ambiguities (at the cap).** Nine
disagreements across nine distinct pairs (a tenth, I0/I1, added by the item-16 ambiguity;
none repeated, so no merge was forced); the mass sat on E2's borders (five of the nine) and
the diagnosis frontier (four items), with Bands A/D perfectly clean. Root cause: boundaries
drawn in outcome space but decided at intake. Redraw applied per the pre-registered rule:
the signals-precedence rule (Part 4 preamble), amended discriminators A/B/G/H/I, new
discriminators S/T/U, and the 4.2 phase rules (diagnosis-before-implementation; composite
orders); an owner review the same day tightened the wording (explicit diagnosis chain with
the suspected-axis E0 triage removed, intake-visible T and U, coupling-beats-mirror in G,
the operation-not-container clause, the signals column renamed to recall signals). Full
ledger and the post-redraw resolution of all ten flagged items: `wo7a-corpus.md` — an
answer key, not an independent validation. **WO-4 unblocks only after WO-7a-bis:** a fresh
blinded mini-corpus of 15–20 one-line requests from source commits the first corpus did not
use, seeded on the redrawn boundaries (the diagnosis chain, E2/E8 topology, I0/N2 output
type, composite bait, report-container bait), a sealed fresh-context model pass, an
independent owner pass, threshold pro-rated to ≥90% with ≤1 genuine ambiguity. The original
40 are burned for blinding now that the ledger and resolutions exist. On a pass, WO-4
encodes 4.1 **and 4.2** as data; WO-7b re-validates through the implemented router.

**WO-7a-bis outcome (2026-08-29): FAIL — 17/20 (85%), one genuine ambiguity (at the cap).**
Three disagreements: I0/I1 (bis item 5 — "active" read as a running requirement against B's
literal default), D0/N2 (bis item 16 — no discriminator existed for the pair), E2/E3 (bis
item 17 — another pair's discriminator invoked because G left "component" undefined).
**Redraw #2** applied the same day, scoped to the three ledger findings: B recast on where
the evidence lives (live-run-only vs persisted artifacts; recurrence alone never establishes
a running requirement; the §4.2 chain and disc. A mirrored), new discriminator V (D0 vs N2:
settled content recorded vs content recovered from a corpus; the preamble's session-summary
example narrowed to match), G given an explicit component unit (what could land as its own
order; clauses of one policy are one component; an acceptance unit must span ≥2 components),
and the preamble given the pairwise-scoping rule. One agreed item shifts class under the
tightened G and is logged openly rather than silently: bis item 1 (both passes E3 via the
old acceptance-unit horn) re-resolves E2 — the installer lifecycle is one component. Ledger
and answer-key resolutions: `wo7a-bis-corpus.md`. **How redraw #2 is validated before WO-4
is an OPEN DECISION for the owner** — the unused-history pool is nearly exhausted (about
three substantive commits remain), so the options are a short WO-7a-ter probe (~10–12 items:
the last unused commits plus synthetic items, seeded on I0/I1, D0/N2, E2/E3, and the shifted
G boundary; threshold pro-rated ≥90%, ≤1 genuine ambiguity) or accepting the answer key and
letting WO-7b's router run serve as the validation gate.

### WO-7b: Classification corpus — through the implemented router
The same corpus re-run through the implemented router after WO-6, router vs human, same
thresholds. A WO-7a pass that WO-7b fails indicts the router implementation, not the taxonomy.

### WO-8–11: Staff the bands, in dependency order
Assurance first (Reviewer both castings, Sweeper, Red Team), then evidence (Scout, Detective
re-contracted; Researcher, LC Analyst, Archivist new), then construction (Builder and Principal
first, validated against existing work; then Operator, Test Designer, Refactorer; then
Investigator; then domain seats), orchestration last (Conductor, Architect, Synthesizer,
Quartermaster). Each role ships only with all nine fields populated and its contract lint
passing (mirror-or-declared-exception included); each with one end-to-end exercised order.

### WO-12: Paired-casting trials and qualifications
Isolated-worktree A/Bs scored on accepted output, review rounds, and bucket draw; decision
rules pre-registered, and every pre-registered rule produces a **provisional** outcome with
its interval stated — governed by the qualification power rule below, which R0's qualified
lanes reference.

**Qualification power rule.** A 20-seeded-defect trial has 5-percentage-point granularity
and wide binomial uncertainty (19/20 observed recall carries a 95% interval of roughly
76–99%), so no n=20 outcome is a final qualification. All qualification outcomes are
provisional: passing admits the lane with its interval stated in the ledger; live
escape-rate telemetry per reviewer lane runs from day one; and a revocation trigger is
armed — a confirmed escape pattern, or a live recall estimate falling below the incumbent's
interval, revokes the lane pending a larger trial. Full qualification requires either a
≥100-defect corpus (interval ±~7pp) or the equivalent accumulated from live monitored
reviews.

The trials: (a) Builder budget casting Luna·max vs primary; (b) Spatial primary vs
mirror (first three real orders as paired spikes); (c) Interface generation castings;
(d) cross-family vs same-family fresh-context review on ≥20 seeded
defects of the complementarity types; (e) **scaffold-controlled terminal escalation** — twelve
hard-environment tasks through this harness's own two pairs (Opus-in-Claude-Code vs
Sol-under-Codex), identical orders and budgets; rule: ≥2 more resolved of 12 **and** ≤1.5×
draw per resolved task → the escalation rung inverts to Opus-first; otherwise the reports'
ordering stands; (f) Terra T1 review qualification (seeded corpus per the R0 gates; the pass
is explicitly provisional — the lane runs under live escape-rate confirmation with the
revocation trigger armed until the full-qualification corpus accumulates); (g) withdrawn — Gemini M0/R0 qualification, removed with the Gemini lane (letter kept so
references stay stable); (h) blinding A/B (blinded vs identity-visible vs
blinded-plus-hazard packets).

### WO-13: Migrate the metered planning transport
Move the `/deep-plan` counterpart lane from `api.openai.com`/`OPENAI_API_KEY` to the
subscription Codex CLI transport; proof: a full planning round completed with `OPENAI_API_KEY`
unset. If the CLI cannot satisfy the contract, report the feature unavailable rather than
keeping the metered path silently.

### WO-14: Alias layer and kill switch, before any rename
Declarative alias map (every retired name → role+casting, deprecation lines); `roster: legacy |
new` flag evaluated per order. Proof: an order written against old names dispatches correctly
under both flag values; the flip demonstrated mid-session.

### WO-15: Shadow and canary
Two weeks or twenty orders minimum, both rosters live, promotion in ascending consequence,
mandatory rollback triggers armed (Part 6.6).

### WO-16: Re-baseline and evaluate the gates
Repeat WO-1 under the new roster; evaluate the acceptance gates **while the legacy roster is
still installed** — the only arrangement in which failing them is cheap.

### WO-17: Retire
Delete/archive superseded definitions; installer list updated; aliases survive one further
release with warnings. Runs only if the gates passed.

### WO-18: The operator's one page
Routing table + discriminators + degradation ladder on one page; proof: a competent operator
routes 10 unseen requests in under a minute each, ≥9 correct.

## Sequencing

WO-1 and WO-2 first, in parallel (probes; nothing is built on unmeasured assumptions); WO-3 is
withdrawn. WO-7a after WO-1, before WO-4 (the paper corpus redraws boundaries before the
schemas encode the classes) · WO-4 after WO-1 and WO-7a · WO-5 after WO-4 · WO-6 after WO-4/5
with WO-2's numbers · WO-7b after WO-6 · WO-8–11 after WO-5, WO-6 and WO-7b · WO-12 after
WO-8–11 (needs WO-5 for evidence; 12f starts any time after WO-2) · WO-13 after WO-4, any
time · WO-14 after WO-6, parallel with WO-8–11 · WO-15 after WO-8–14 · WO-16 after WO-15 ·
WO-17 after WO-16 gates · WO-18 after WO-7b and WO-17.

## Review routing

Per current harness law while this plan executes: substantive changes → `reviewer` (Opus,
fresh context); gate-class changes and heavy-tier orders → add a `reviewer-codex` pass;
codex-authored changes → the Opus `reviewer` (already cross-vendor). WO-5 and WO-6 are
gate-class (the substrate every later claim leans on; the router that enforces every
invariant). WO-12 trial reports are reviewed as evidence artifacts (pre-registered rules
applied as written). WO-13's transport change is substantive and takes the cross-vendor pass.

## Risks (of executing this plan, distinct from Part 7's architecture risks)

- WO-1/WO-2 consume real allowance to measure allowance; run them in an otherwise-light week.
- The shadow period doubles roster surface temporarily; the kill switch and canary order are
  the containment.
- Trial results may contradict castings this document states; that is the design working — the
  registry makes each re-cast a one-field change, and the evidence register records the flip
  condition next to every load-bearing number.

---

## Verify during execution

Assumptions **both** source plans shared — the ones no critique caught, because neither
architect had reason to doubt them — each with its practical detection:

1. **Subscription terms permit a private multi-agent CLI workload from one authorized seat**
   (both plans assume; neither verified). Detected: WO-1's terms reading per vendor, and any
   account warning/suspension during the instrumented week is an immediate stop signal.
2. **Sub-agent traffic meters against the session seat's own pool** (assumed on evidence for
   Anthropic, by symmetry for OpenAI). Detected: WO-1 per-call telemetry against the
   CLI's own remaining-allowance signal; if agent traffic has a separate meter, fan-out caps
   relax and the cost model is conservative rather than wrong.
3. **Published Codex per-window message ranges are a usable relative-draw proxy** (both derived
   the same OU ratios from them). Detected: WO-1/WO-2 measured draw vs predicted; >2×
   divergence trips re-derivation.
4. **The Anthropic relative-draw weights are approximately right** (both estimated; their
   estimates disagreed ~2×, which is itself the warning). Detected: WO-1 replaces them with
   measurement.
5. **Cross-family review actually catches defects same-family review misses** — the load-bearing
   premise of the entire de-correlation architecture; both plans assert it from complementarity
   tables, neither has a direct measurement. Detected: WO-12d seeded-defect A/B; a null result
   narrows the preferred band and re-aims reviewer tuning (it cannot, at n=20, overturn the
   mandatory floor).
6. **Opus-as-Conductor (calibration over ceiling) preserves or improves outcomes** — both plans
   independently inverted the repository's current MODE A ordering; convergence is a signal, not
   proof. Detected: ledger metrics "plans revised after first execution round" and "orders
   re-scoped mid-flight" against the WO-1 baseline; the remedy if wrong is lowering the
   Architect-call threshold, not re-casting the Conductor first. [Superseded 2026-08-28: the
   owner re-cast the Conductor to Fable 5 on field-observed human-facing communication
   failure — see the lineup rulings in the Audit dispositions.]
7. **Vendor-reported benchmark figures in the three research reports are accurate enough to
   route on** (both treat them as priors; several are vendor-run, and both plans inherited the
   same saturated Terminal-Bench 2.1 signal). Detected: the paired-casting trials (WO-12) —
   the only evidence a harness is entitled to act on where scaffolds are part of the
   measurement.
8. **The runtime records actual author family, and served-model identity is at least partially
   observable** (the review matrix and P15 both depend on recorded provenance). Detected: WO-1
   checks what each CLI exposes; where nothing is exposed, avoidance (pre-dispatch gates)
   carries the whole defense and the plan says so.
9. **A human approver is reachable within the working day for T3 actions and contested
   verdicts** (both plans terminate their hardest gates in a human). Detected: T3 and dispute
   queue-age telemetry with a response-time objective; an unattended deployment would need a
   pre-authorization mechanism this design deliberately does not specify.
10. Withdrawn — the shared Gemini-access assumption was mooted when the Google/Gemini lane was
    removed by owner decision (numbering kept so references stay stable).

## Evidence register

Every load-bearing figure the plan relies on, with a resolvable source (Done-criterion 3).
Research-report sources are `file:line` in `research/` at the repository root; repository
sources are first-hand reads of this tree at v1.11.0. Confidence: **measured** = read
first-hand in this tree or measured by a named independent evaluator; **vendor-run** = the
model vendor's own benchmark, documentation or audit; **secondary** = community, trade press
or aggregator; **estimate** = derived or asserted here, pending WO-1/WO-12 measurement. Rows
whose provenance could not be located in the available material are marked UNSOURCED.

| Claim / figure | Where used | Source | As-of | Confidence |
|---|---|---|---|---|
| SWE-bench Pro spans 1.9 points across the GPT-5.6 family's 25× price range | P3 | research/openai-models.md:464–465 | 2026-08-26 | vendor-run |
| ARC-AGI-3: Sol 13.3 → Terra 2.3 → Luna ~0 | P3 | research/openai-models.md:89, 283, 405 (arcprize.org) | 2026-08-26 | measured |
| MRCR: Sol 91.5 / Terra 89.6 / Luna 41.3 | P7, roles 5/6/18, routing shapes | research/dossier_both.md:129 | 2026-08-26 | vendor-run |
| Agents' Last Exam: Sol leads Fable by +13.1; family-wide advantage | P8, role 2 | research/dossier_both.md:147 | 2026-08-26 | vendor-run |
| Luna · max ≈ Sol-medium quality at ~1/14th per-task draw | P8, role 11 budget casting, WO-12a | research/openai-models.md:450, 570 | 2026-08-26 | secondary |
| Fable (and sometimes Opus) silent classifier fallback on cyber/bio | P15, roles 2/17, route-filters | research/dossier_both.md:36, 260 | 2026-08-26 | vendor-run |
| Max-plan Opus bucket exhaustion silently serves Sonnet; combined + Opus-specific weekly limits | P15, 5.1, P0, WO-1 | plan-A-v2.md evidence row 17 (usagebar.com, tokn.watch, claude-code#55663) | 2026-08-27 | secondary |
| Fable included up to 50% of weekly limits on Max+; usage-credits only below Max | roles 1/2, 5.1, 5.2 | https://support.claude.com/en/articles/15424964-claude-fable-5-on-your-plan | 2026-08-28 | vendor-run |
| Opus 5 misaligned-behaviour score 2.3 — lowest in roster; most careful on irreversible effects | roles 1/14 | research/dossier_both.md:289 | 2026-08-26 | vendor-run |
| Opus 5 knowledge cutoff May 2026 (freshest) | roles 1/7 | research/dossier_both.md:61, 290 | 2026-08-26 | vendor-run |
| SWE-bench Pro: Fable ~80 / Sol 64.6 / Terra 63.4 / Sonnet 63.2 (OpenAI disputes task quality) | roles 2/11/12 | research/dossier_both.md:101; research/openai-models.md:83, 280 | 2026-08-26 | vendor-run |
| HLE: Fable 55.5 (Sol 49.5, Opus 54.9) | role 2 | research/openai-models.md:87 | 2026-08-26 | vendor-run |
| GDPval-AA v2: Fable leads Sol by ~12 Elo | roles 2/20 | research/openai-models.md:93 | 2026-08-26 | measured |
| CursorBench 3.2: Fable highest peak; Opus 5 within 0.5% at ½ cost | roles 2/12 | research/dossier_both.md:107 | 2026-08-26 | measured |
| Senior SWE-bench: Fable #1 overall; Opus #2, #1 bug/performance investigation | roles 2/7/12/13 | research/dossier_both.md:108 | 2026-08-26 | measured |
| BrowseComp 92.2% (Sol, SOTA) | role 5 | research/openai-models.md:91 | 2026-08-26 | vendor-run |
| Terra ≈40% of flagship per-task price; ~1M window | roles 6/18 | research/openai-models.md:297, 338 | 2026-08-26 | vendor-run |
| Opus 5 / Sonnet 5 / Fable 5: 1M-token context window on paid Claude Code plans | role 6 mirror | https://support.claude.com/en/articles/8606394 | 2026-08-28 | vendor-run |
| Frontier-Bench v0.1: Opus 5 43.3 max / 44.4 xhigh (SOTA); harness-effect rule | recon, roles 9/12 | research/dossier_both.md:106, 33 | 2026-08-26 | measured, scaffold-uncontrolled |
| Terminal-Bench 3.0 = Frontier-Bench rename; snapshot Opus 42.7 / Sol 34.6 | recon, roles 9/12 | plan-A-v2.md evidence row 1 (benchlm.ai; frontierbench.ai/announcement) | 2026-08-24 | secondary, scaffold-uncontrolled |
| Terminal-Bench 2.1: Sol 88.8 (AA independent 85.77); OSWorld 2.0 62.6 | role 9 | research/openai-models.md:82, 91 | 2026-08-26 | vendor-run |
| Sol over-agency incidents in testing: deleting infrastructure, moving credentials | role 9 | research/openai-models.md:161–162 | 2026-08-26 | measured |
| METR: highest detected cheating rate; 50% horizon ≈11.3 h vs >270 h by scoring | P11, role 9 review policy | research/openai-models.md:95, 150 | 2026-08-26 | measured |
| CodeRabbit 100-task authoring suite: Sol 63.7% / Terra 40.7% clean-pass | recon, roles 11/21 | research/openai-models.md:85, 289 | 2026-08-26 | measured |
| CodeRabbit 105-task review suite: Sol 65 actionable vs Opus 4.8's 66 vs human 66; full passes 74–72 | recon, role 21 rationale | research/openai-models.md:122, 490 | 2026-08-26 | measured |
| No Terra review-recall measurement exists in the supplied evidence | role 21 Terra T1 lane, WO-12f | research/openai-models.md (absence; recon summary) | 2026-08-26 | measured |
| Sonar: Terra +37% code-smell density, 203 vulns/mLOC | role 11 | research/openai-models.md:317–318 | 2026-08-26 | measured |
| Sonar: Sol concurrency 352 bugs/mLOC — largest bug category | roles 12/13 | research/openai-models.md:141–142 | 2026-08-26 | measured |
| Orchestration study: flagship director + workhorse ≈96% quality at 46% cost (BrowseComp) | role 11 | research/dossier_both.md:264, 342 | 2026-08-26 | vendor-run |
| ExploitBench: Sol 73.5 / Terra 52.9; SEC-Bench Pro: Sol 71.2–74.3 / Terra 57.7 | role 17 | research/dossier_both.md:127–128, 195 | 2026-08-26 | vendor-run |
| Design Arena: Sol #1-band jump with anti-pattern-suppression mechanism | role 15 | research/openai-models.md:181, 187, 534 | 2026-08-26 | measured |
| Blind prose panel: Terra and Luna the family's weak writers | role 20 | research/openai-models.md:247–248, 343, 431–432 | 2026-08-26 | secondary |
| Spatial/procedural assignments (Opus meshes/shaders/tooling; Fable global critique); no independent eval this generation | role 16 | research/cross_vendor_agent_harness_roster_summary.md:290–313, 640–667 | 2026-08-26 | secondary |
| Haiku 4.5: Feb-2025 cutoff, 200K window | roles 4/10 | research/dossier_both.md:38, 63 | 2026-08-26 | vendor-run |
| Luna/Sol cutoff Feb 2026; Luna faster TTFT | roles 4/5 | research/dossier_both.md:57, 238 | 2026-08-26 | vendor-run |
| Codex per-window message ranges: Plus Sol 10–100 / Terra 25–200 / Luna 250–2,000; Pro ×5/×20 | 5.1, 5.2 OU weights | https://learn.chatgpt.com/docs/pricing (reproduced in plan-A-v2.md evidence row 14) | 2026-08-28 | vendor-run |
| Codex 5-hour window removed for Plus 2026-07-12, reinstated week of 2026-08-25 | 5.1, P9 | plan-A-v2.md evidence row 24 (eesel.ai; notebookcheck.net) | 2026-08-27 | secondary |
| AU weights (Haiku ≈0.2 / Sonnet 1 / Opus ≈5 / Fable ≈10); the two syntheses disagreed ~2× | 5.2 | plan-A-v2.md evidence row 15; plan-B-v2.md "Normalized allowance units" | 2026-08-27 | estimate |
| OU weights (Luna 1 / Terra ≈10 / Sol ≈22), derived from the published ranges | 5.2, 5.3 | derivation in 5.2 from the message-range row above | 2026-08-28 | estimate |
| Gate-class Sol review ≈110 OU = 5–44% of one Plus window | 5.2 | derivation in 5.2 from the two rows above | 2026-08-28 | estimate |
| Illustrative class-frequency mix and generated-load derivations (48 / 18 / ≈38%) | 5.3, 5.4 | plan-B-v2.md "Illustrative workload mix", adapted; arithmetic shown in 5.3 | 2026-08-28 | estimate |
| Parallel agent teams ≈4–7× a session's tokens (≈7× with teammates in plan mode) | 3.2 | plan-A-v2.md evidence row 18 (faros.ai; youcanbuildthings.com) | 2026-08-27 | secondary |
| Subscription CLI guidance: hold 3–5 parallel subagents | 3.2 | plan-A-v2.md:2185, 2486 | 2026-08-27 | secondary |
| Dossier review-call prior 3–8% of calls | 5.4 | research/dossier_both.md:432 | 2026-08-26 | estimate |
| Reference budgets: 600 s review / 1800 s execution | 3.4 | packs/codex/hooks/orchestra-review.js:221, 284; orchestra-exec.js:201 | v1.11.0 | measured |
| Review sandbox defaults to workspace-write ("many test runners can't run" read-only) | recon, role 23 | packs/codex/hooks/orchestra-review.js:113–115, 283 | v1.11.0 | measured |
| /deep-plan lane is metered API usage (OPENAI_API_KEY, api.openai.com /v1/responses) | recon, 6.4, WO-13 | packs/codex/hooks/orchestra-deepplan.js:55, 77–78, 117 | v1.11.0 | measured |
| Installed/master architect drift (model and web-tool asymmetry) | recon, 6.4/6.5 | .claude/agents/architect-claude*.md; packs/codex/agents/architect-claude*.md; .mcp.json | v1.11.0 | measured |
| Detective charter forbids running code; executor lacks investigative mandate | recon, 6.3, role 13 | agents/detective.md:13; agents/executor.md | v1.11.0 | measured |
| Scaffold pairs: Opus-in-Claude-Code vs Sol-under-Codex (TIER_DEFAULTS) | recon, role 9, WO-12e | agents/executor-heavy.md; packs/codex/hooks/orchestra-exec.js TIER_DEFAULTS | v1.11.0 | measured |
| Sol "finds everything" over-production; Opus "400-line table" over-engineering | P12 | research/openai-models.md:490–491; research/cross_vendor_agent_harness_roster_summary.md (Opus profile) | 2026-08-26 | secondary |
| N0 draw ≈1/25th of I0; Runner ≈1/20th of Operator | roles 7/9 | derived from the 5.2 unit weights and 5.3 draw table | 2026-08-28 | estimate |
| Effort-ladder guidance: medium default; Sol-medium beats larger budgets on ALE | P8, role 5 | research/openai-models.md §2 (vendor guidance; ALE rows) | 2026-08-26 | vendor-run |
| Anthropic five-hour window + weekly limits; non-harness use drains the same pool | 5.1 | plan-A-v2.md evidence rows 15–17 | 2026-08-27 | secondary |
| "Both plans' AU-ratio estimates differ ~2× (≈5 vs ≈2.3)" | 5.2 honesty rule | plan-A-v2.md evidence row 15; plan-B-v2.md:624 | 2026-08-27 | measured |
| Fable multi-minute-to-hour latency; thinking non-disableable | roles 1/2 | research/dossier_both.md:76 | 2026-08-26 | secondary |
| Terra "reaching for messy long-horizon work" cliff (40.7 vs 63.7) | role 11 Terra lane limits | research/openai-models.md:310 | 2026-08-26 | measured |
| UNSOURCED — "format brittleness" as a general multimodal-extraction failure mode | role 8 weaknesses | originally cited a Gemini failure decomposition (removed with the lane); no Terra/Opus equivalent located | 2026-08-28 | UNSOURCED |
| UNSOURCED — Q0 "no evidence a ceiling model writes materially better tests behind explicit criteria" | role 19 | stated as an absence-of-evidence claim; no located study either way | 2026-08-28 | UNSOURCED |

## Audit dispositions

Dispositions of the eleven findings in the cross-family audit of this document (audit-of-final),
ruled by the owner on 2026-08-28.

1. ADOPTED (owner ruling, 2026-08-28) — contest extraction is no longer "mechanical": a
   mandatory opposite-family ledger completeness check now precedes any challenge and a
   mandatory opposite-family post-composition audit follows composition, at a stated cost of
   two added consultations per comparative session (accepted: such sessions are only ever run
   for serious work).
2. ADOPTED (owner ruling, 2026-08-28) — the R0 matrix now splits human-authored (any model
   family independent) from unattributed provenance, which fails closed (both-family
   concurrence or a named human at mandatory class; disclosed degraded path only at T1),
   backed by required `author_family` / `co_author_families` fields recorded at dispatch
   (§3.5) and computed against the full co-author set.
3. ADOPTED — the Verifier's schema now records model-assist provenance (used / family and
   casting / outcome influence / absorbing rule), and a model-influenced outcome can never
   satisfy a deterministic-only closure (it takes the COVERAGE_GAP path).
4. ADOPTED — the Interface Artisan closing pass is now a separate READ-ONLY order: the closer
   returns findings and never edits; an edit would make it a co-author and disqualify it.
5. ADOPTED (owner ruling, 2026-08-28) — the WO-12 qualification power rule makes every n=20
   outcome provisional with its interval stated, arms per-lane live escape-rate monitoring
   and a revocation trigger, sets full qualification at a ≥100-defect corpus (±~7pp), and
   restates the sub-granularity "within N points" criteria at feasible precision (M0's
   "within 3 points" rule had already left with the withdrawn WO-12g).
6. ADOPTED — 5.3 now carries the complete class-frequency table and within-pool arithmetic;
   review count (≈48) and Q0 count (18) are derived and unchanged; the OpenAI review share
   recomputes to ≈38% (was ~60%), and 5.4's "twice as long" claim is replaced by what the
   arithmetic supports.
7. ADOPTED — the capacity requirement is ≥1.43× forecast peak arrival everywhere (3.4, 7.2,
   WO-2), with the parenthetical that 1.43× is what the ≤70%-utilization gate requires.
8. ADOPTED — the LC Analyst's Opus mirror covers corpora up to ~1M tokens per Anthropic's
   context-window documentation (as of 2026-08-28); the 200K restriction and shard-or-wait
   clause are removed.
9. ADOPTED — the residual routing rule now routes a two-primary match by lower blast radius on
   a wrong answer (acceptance risk, not the undefined "cheaper"), triage-capped and logged;
   the three-ambiguity redraw rule stays.
10. ADOPTED — WO-7 split into WO-7a (paper corpus against the tables as written, before WO-4)
    and WO-7b (the implemented router after WO-6); Sequencing updated.
11. ADOPTED — this Evidence register was added and populated from the plan's load-bearing
    figures; unlocatable provenance is marked UNSOURCED rather than cited.

Owner decision, 2026-08-28: the Google/Gemini lane is removed from the architecture entirely —
the integration and operational cost of a third provider judged not worth its capabilities for
this deployment; the capability given up is native video/audio intake (M0 degrades
deterministically or returns typed UNAVAILABLE). WO-3 and WO-12g are withdrawn in place.

### Lineup rulings, 2026-08-28 (second session) — applied throughout this document

The three deferred open items, ruled and applied:

- (a) SUPERSEDED — the Conductor re-cast below makes effort an owner choice at session launch
  (the Conductor is the interactive session model), which removes the self-assessed-ambiguity
  circularity the effort split was designed to fix.
- (b) ADOPTED — 5.5 now states that with the Gemini lane removed, pool-exhaustion states fall
  back to the human operator sooner, owned as a conscious trade.
- (c) ADOPTED — WO-1 now delivers the Opus-concentration watch (the AU-O fraction drawn by the
  I0/I1/E3/E4 mix; proposed 60%-of-bucket trigger) with deliberate Detective/Investigator
  rotation to the Sol mirrors when it fires.

Four owner re-casts, same ruling date, applied in the role entries (1, 2, 11), the class
table, the 3.1 topology diagram, the Quartermaster gate, 5.5, 6.2 and WO-1:

1. **Conductor = Fable 5, the interactive session model, at owner-set effort** (medium / high /
   xhigh by task); Sol depletion mirror at matched effort (or as the owner directs). Grounds:
   the seat's core function is USER-DIALOGUE, and field observation shows Opus's human-facing
   reporting degrading into dense, garbled prose that is very difficult to distill — a failure
   of exactly what the seat exists to do, and one the dossier's alignment metrics never
   measured.
2. **Opus holds no USER-DIALOGUE seat anywhere in the lineup.** It is re-aimed at what the same
   observations show it excels at: goal-directed deep work at long horizon (I0/I1/E3/E4/E6 and
   reference duty), where its output goes to other models or the Verifier, never directly to a
   human. Known failure shape, accepted and mitigated by bounded orders and mandatory review:
   over-engineering, small-issue fixation, and losing the big picture on dynamic,
   ambiguity-heavy problems.
3. **The Architect defaults to Sol · xhigh**; Fable · high–xhigh when the goal is especially
   complex, nebulous, or ambiguous (owner judgment at intake); Opus · high on Codex
   exhaustion. Grounds: shifts mandatory plan review onto the pool 5.3 shows has slack, frees
   the Fable ration for the Conductor, and reserves Fable for exactly the cases its evidence
   supports.
4. **Luna · xhigh–max is the Builder's preferred casting for bounded, short-horizon,
   fully-specified, deterministically-verifiable orders** (owner field data: cost/performance
   far above its weight class on this shape); Sonnet · medium keeps longer-duration and
   thinner-spec orders; the never-under-specified guardrail survives; WO-12a's entry trial
   becomes confirmation under the live escape-rate monitoring adopted with finding 5.

## Cross-compare log

- **Taken from Plan A:** the contract/casting separation with mirror-or-declared-exception
  (P2); the per-bucket Anthropic pool model, silent-substitution risk and pre-dispatch AU-O
  gate; the two-band review mandate (fixed non-degradable mandatory set; disclosed degradable
  preferred band) and the "does not close" outcomes; the allowance-positive framing of
  cross-family review as the load-balancer; the irreversibility ladder, authorization-packet
  schema and named-human T3 rule; the decomposed blind-merge arbitration protocol (contest
  ledger → opposite-family challenge → composition → residue to human); the Verifier's
  disposable writable checkout (grounded in `orchestra-review.js`'s own sandbox trade-off);
  Refactorer and Sweeper as seats; Investigator's existence argument from `detective.md`;
  context shapes as dispatch-enforced constraints; the discriminator table; the
  Fable-conditional-on-Max rule; the evidence-register discipline (resolvable provenance,
  scaffold-uncontrolled markings) and the carried-forward Terminal-Bench 3.0 = Frontier-Bench
  correction; the Gemini reframing on independent ARC evidence ("bounded reasoner, weak
  sustained actor") and the deterministic video/audio transcode fallback; migration safety
  (aliases, shadow, canary, kill switch, rollback triggers); the metered `/deep-plan` migration.
- **Taken from Plan B:** the letter-coded class taxonomy with orthogonal T0–T3 risk tiers and
  the machine-checkable class↔role bijection; the review-capacity liveness discipline (early
  throughput probe on the existing `reviewEngine` path, dynamic forecast reserve, queue SLOs,
  author throttling, capacity as an acceptance gate); the Conductor mirror's signed control
  checkpoint and restricted-authority list; the Q0 Independent Test Designer with automatic
  triggers, opposite-family casting and separated code/test review; the qualified Terra T1
  review lane and the separately-qualified Gemini review-relief lane; hazard-preserving
  reviewer blinding with its A/B trial; the N0 search-surface contract with recorded truncation
  and automatic reclassification; the N2 Long-Context Analyst; the E5/E6 split stated by
  acceptance artifact; the pool-exhaustion matrix; the workload-mix/within-pool-share method
  and its headline finding (reviews of Anthropic output dominate the OpenAI pool); the stall
  detector; capability-registry single-sourcing with guard/installer derivation and
  subscription-authentication audits; the reversal-condition habit (numeric flip conditions
  bound to decisions); the whole-system acceptance-gate format.
- **Disputes adjudicated:**
  - *Terminal escalation rung (A withdrew its inversion; B kept escalate-to-Opus)* → merged:
    one same-casting effort raise for a tactical stall, cross-family to Opus 5 · high on a
    strategy-level stall, ordering provisional pending the pre-registered scaffold-controlled
    trial. Evidence: TB3.0's top rows pair Opus with mini-SWE-agent and Sol with Codex — pairs
    this harness does not run (`agents/executor-heavy.md`; `orchestra-exec.js` TIER_DEFAULTS)
    — and `dossier_both.md:106` already carried the benchmark as Frontier-Bench and still
    routed terminal work to Sol; B's "never another same-model max loop" is sound independent
    of the benchmark.
  - *Review-mandate scope (B: universal mandatory; A: gate-class mandatory + preferred band)* →
    A's band structure with B's liveness machinery, and cross-family as the universal default.
    Evidence: the brief itself distinguishes mandatory from "merely preferred"; B's own cost
    model shows reviews of Anthropic output at ~60% of the OpenAI pool, making a
    never-degradable universal mandate a stall risk its own critique (finding 1) identified.
  - *Reviewer evidence (Terra excluded on 40.7%)* → both v2 plans converged on the correction;
    verified: `research/openai-models.md:85,289` is an authoring suite, `:121–123` is the
    review suite with no Terra figure — so the Terra T1 lane is qualification-gated, neither
    granted nor denied on evidence.
  - *Performance implementer (B REBUTTED critique finding 16; A kept a Performance Engineer)* →
    ruled for B: I1 owns performance intake; the confirmed profile is the bounded spec that
    routes the fix to E2/E3/E4/E0; a separate implementer would duplicate primaries. A's
    contract rules (baseline before optimizing; independent re-measurement; benchmark-fitting
    risk) are folded into I1 and the fix-order requirements.
  - *E4 casting (B originally Terra)* → settled by B's own adoption of its critique: Opus 5 ·
    high primary, Terra restricted to reversible T1 behind a fixed integrity design — which is
    also A's position; convergence carried.
  - *Doc Writer casting (A: Opus primary, cheap tier false economy; B: Sonnet medium)* →
    merged on a stakes split: Sonnet for routine behavior-cited developer docs, Opus for
    deliverable-grade/public contracts, Fable ceiling on Max; Terra/Luna excluded as authors
    (A's blind-prose-panel evidence, uncontested — B never cast them as doc authors either).
  - *Verifier: agent role vs non-agent substrate* → substrate with a full catalog contract
    (B's framing) plus A's writable-checkout mechanics and cheap-model-assist limited to
    yes/no checklist classification; both v2 plans had already converged in substance.
  - *Sweep: seat vs integration obligation (B's delta rejected a sweep role)* → ruled for A:
    a cheap Terra seat with a completeness-vs-correctness discriminator keeps the sweep
    independent of the party that might have missed something, and class S0 preserves B's
    one-primary-per-class law, which was the substance of B's objection.
  - */deep-plan metered transport* → both agree; verified first-hand
    (`orchestra-deepplan.js:55,77–78,117`): migrate to the subscription CLI transport or
    report unavailable.
  - *Architect-lane drift and asymmetric web tools* → both agree; verified first-hand
    (installed `-xhigh`/`-max` = `opus` **with** WebSearch/WebFetch; installed base and both
    masters = `fable` without; `.mcp.json` grants the GPT lane `tools.web_search=true`):
    fixed structurally by castings-as-arguments and the identical-capability rule for
    comparative sessions.
  - *Roster granularity (24 vs 19)* → 24 catalog entries: 22 model-cast roles + 2 deterministic
    substrates. Net of A's roster: −1 (Performance Engineer merged into Investigator, per B's
    upheld rebuttal), +1 (B's Long-Context Analyst, filling a real gap in A). B's bijection
    law and risk-orthogonality are kept; A's extra seats each survived only where they carry a
    distinct failure profile and a crisp discriminator, with an ordered merge list (toward 19)
    armed if the routing-ambiguity gate fails.
- **Open decisions:** none. Every material divergence was settled by the tree, by the two
  plans' own post-critique convergence, or by a pre-registered measurement with a stated
  default; nothing met the bar of consequential, evidence-balanced, and undecidable here.
