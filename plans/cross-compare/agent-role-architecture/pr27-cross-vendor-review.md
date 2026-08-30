# PR #27 cross-vendor review record

Run 2026-08-29 at the owner's directive, through the repo's review lane: `codex exec
--sandbox read-only --model gpt-5.6-sol -c model_reasoning_effort=xhigh`, fresh context,
this repo as cwd, pinned scope `main...998b978`. The review order followed the
orchestra-review skill format (INTENT from the six commit messages; SCOPE the six changed
markdown files; AUTHOR REPORT: none — authored outside the harness; TIER full;
VERIFICATION by cross-checking, no tests). The verdict is reproduced verbatim below;
dispositions follow it.

---

REVIEW ENGINE: OpenAI GPT-5.6 Sol via Codex CLI (fresh context, tier: full)

VERDICT: REVISE

FINDINGS
- [MAJOR] plans/cross-compare/agent-role-architecture/wo7a-ter-corpus.md:81 — The human passes are not immutably sealed before reveal. Model answers exist in earlier commits, but owner answers, scores, and redraws first appear together in the scoring commits. The ter SHA-256 is recorded only post-reveal, with no retained preimage or canonical serialization; bis has no fingerprint at all (lines 59–62). — An owner could alter classifications after opening the model file, recompute or merely assert a hash, and leave indistinguishable repository history.
- [MAJOR] plans/cross-compare/agent-role-architecture/final-plan.md:1236 — New discriminator W is not exclusive on its motivating case. “Replace hardcoded values on the Pulse screens with real numbers” is both data/computation consumed by an otherwise unchanged screen (E2 horn) and a changed rendered state whose acceptance requires exercising that screen (E5 horn). — A request such as “replace the placeholder account balance with the live balance on the dashboard” still routes to both E2 and E5, so redraw #3 does not determinately resolve item 16’s boundary.
- [MAJOR] plans/cross-compare/agent-role-architecture/final-plan.md:1238 — The standing merge/redraw trigger is defined for three residual ambiguities, but wo7a-ter-corpus.md:106 counts deterministic human/model disagreements despite all passes reporting zero ambiguities and says those entries trip the trigger. — Three confidently but differently classified requests could force a redraw or class merge even though Part 4 says only unresolved residual ambiguities count.
- [MINOR] plans/cross-compare/agent-role-architecture/wo7a-ter-corpus.md:90 — “Redraw #2 is therefore validated” overstates the 9/10 aggregate subset result: its only miss was a B-seeded item, and B was immediately redrawn again. Only G/V are separately shown as 6/6. — A later reader could incorrectly treat redraw-#2 B as validated evidence rather than a boundary that failed one seeded case.
- [MINOR] plans/cross-compare/agent-role-architecture/wo7a-ter-corpus.md:13 — Selection integrity is asserted but not auditable from the record: it lists included SHAs but not the class-hinted candidates excluded, their hints, the 58-candidate mining ledger, or a preserved transcript pointer. — A class-hinted source could enter the corpus without a reviewer being able to detect the contamination.
- [MINOR] plans/cross-compare/agent-role-architecture/STATUS.md:199 — The Related PRs entry says PR #27 contains only the bis corpus and sealed pass, omitting bis scoring, redraw #2, the ter cycle, and redraw #3. — A reader using the PR index receives an incorrect account of this PR’s scope.

CLAIMS CHECKED
- "No executable code changed" → CONFIRMED (`git diff --name-status main...998b978` contains exactly six Markdown files).
- "The six commits occurred in the claimed order" → CONFIRMED (corpus/seal commits 5fc9726 and 6327995 precede scoring commits 67d5c98 and 998b978 respectively).
- "WO-7a-bis scored 17/20 with disagreements 5, 16, and 17" → CONFIRMED (row-by-row comparison yields only I1/I0, N2/D0, and E3/E2).
- "WO-7a-ter scored 16/20 with misses 2, 10, 16, and 17" → CONFIRMED (row-by-row comparison against the primary Claude pass).
- "The sealed subset {1,5,6,8,11,12,13,15,17,20} scored 9/10, with 17 the only miss" → CONFIRMED (subset key was committed before scoring and independently recomputed).
- "Pair-ledger counts are I0/I1 2→4, E2/E3 2, D0/N2 1, I0/E2 1, and E2/E5 1" → CONFIRMED (recounted from the original, bis, and ter ledgers); "I0/I1 therefore trips Part 4's ambiguity trigger" → REFUTED (the two new entries are disagreements, not residual ambiguities).
- "Both score gates were pre-registered and applied as written" → CONFIRMED (bis ≥18/20 and ter full ≥18/20/subset ≥9/10 appear in earlier commits; the reported PASS/FAIL outcomes follow them).
- "Redraw #3 is scoped to the four ter findings" → CONFIRMED (B addresses 10/17, the cause-stated definition addresses 2, and W addresses 16; G, V, and K are unchanged), subject to W’s unresolved overlap above.
- "Item 17 deliberately sides with the owner against both sealed models" → CONFIRMED (the divergence is explicitly disclosed and the new B wording implements the owner’s runtime-observation rationale; the documents correctly require fresh validation).
- "The owner answers were fixed before the seals were opened" → UNVERIFIED (no pre-reveal commit or verifiable fingerprint preimage exists).
- "Fresh-context agents received only the stated inputs" → UNVERIFIED (the documents self-report isolation but retain no auditable prompts/transcripts).
- "Every class-hinted ter commit was excluded" → UNVERIFIED (no exclusion ledger is retained).
- "Bis uses 17 previously unused source commits" → CONFIRMED (17 unique SHAs, all resolving as commits and absent from the original corpus audit trail).
- "The bis and ter corpora are burned and WO-4 remains blocked" → CONFIRMED (all current status/outcome documents consistently declare both conditions).

NITS
- none

---

## Dispositions (2026-08-29)

- **MAJOR (seal protocol):** cannot be repaired retroactively for bis/ter — their
  UNVERIFIED status stands on the record. Protocol change from WO-7a-quater on: the owner
  commits and pushes the filled blind pass **before** opening the sealed file, so the
  pre-reveal state is fixed in public history rather than asserted by hash.
- **MAJOR (disc. W non-exclusive):** accepted. W amended in Part 4 before the quater
  validation probe — displayed values are data, not presentation; E5 requires the
  interface artifact itself (layout, structure, styling, interaction, or a new or
  redesigned surface) to be what acceptance inspects. The quater probe validates the
  amended text.
- **MAJOR (trigger semantics):** accepted as a documentation defect. The trigger as
  practiced since WO-7a-bis counts scored cross-pass class disagreements as well as
  residual ambiguities; only the ambiguity half was ever written. The residual rule in
  Part 4 now codifies both. Redraw #3 did not hang on the trigger alone — the
  pre-registered full-gate FAIL independently required it.
- **MINOR (validation overstatement):** accepted; the redraw-#2 claim in
  `wo7a-ter-corpus.md` now states the structure (G/V 6/6; B missed one of its four seeded
  items and was re-sharpened by redraw #3).
- **MINOR (selection auditability):** accepted going forward: the quater corpus records
  its exclusion/burn ledger and mining provenance in its sealed file. A retroactive ter
  exclusion ledger is being reconstructed from the preserved session and Codex CLI logs.
- **MINOR (Related PRs index):** fixed in STATUS.md.
