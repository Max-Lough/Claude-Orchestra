# Session ledger

## 2026-08-27 — `/cross-compare-plan`: next-generation agent role architecture

Slug: `agent-role-architecture` · effort `max` both lanes · `context=repo` · 4 ground-truth docs
Letter↔lane mapping (conversation-only, never written into any artifact): **A = Claude lane, B = GPT lane**

### Consultations

| # | Wave | Lane | Agent | Tool calls | Wall-clock | Outcome |
|---|---|---|---|---:|---:|---|
| — | draft (aborted) | A | `architect-claude-max` | — | ~15 min | killed — brief amended mid-flight |
| — | draft (aborted) | B | `architect-codex` | — | ~15 min | killed; engine outlived the kill and wrote to a stray path (quarantined) |
| 1 | draft | A | `architect-claude-max` | 67 | ~30 min | `plan-A-v1.md`, 2,581 lines, 24 roles |
| 2 | draft | B | `architect-codex` | 3 | ~21 min | `plan-B-v1.md`, 785 lines, 19 roles |
| 3 | critique | A→B | `architect-claude-max` | 25 | ~16 min | `critique-of-B.md`, 16 findings (2 BLOCKER / 10 MAJOR / 4 MINOR) |
| 4 | critique | B→A | `architect-codex` | 1 | ~10 min | `critique-of-A.md`, 11 findings (4 BLOCKER / 7 MAJOR / 0 MINOR); nonce verified |
| 5 | revise | A | `architect-claude-max` | 100 | ~33 min | `plan-A-v2.md`, 3,705 lines; 11/11 ADOPTED (4 partial rebuttals) |
| 6 | revise | B | `architect-codex` | 3 | ~21 min | `plan-B-v2.md`, 945 lines; 15 ADOPTED / 1 REBUTTED |
| 7 | synthesize | — | `plan-synthesizer` (blind) | 26 | ~17 min | `final-plan.md`, 1,715 lines; **0 open decisions** |

Support runs: 5 × `scout` (artifact shape/contract verification, ~1–2 min each), 1 × `executor` (quarantine of stale artifacts, 6 calls).

### Cadence notes for future sizing

- **Mid-flight brief amendments cost a full wave.** The subscription-access clarification arrived after
  dispatch; the GPT lane is a single blocking engine call and cannot be updated in flight, so the only
  symmetric option was to kill and restart both. Settle deployment/cost scope at INTAKE.
- **Killing the codex launcher does not kill the engine.** The aborted run completed and wrote a full
  document under a slug of its own choosing, contaminating the plans tree with a rival plan written
  against a superseded brief. Sweep `.claude/plans/cross-compare/` after any aborted lane.
- **Lane tool-call counts are not comparable.** The codex lane reports 1–3 calls because the work happens
  inside one MCP call; the Claude lane's 67–100 reflect actual recon. Use wall-clock to compare lanes.
- **Scout verification of architect artifacts is cheap and worth it** (~1–2 min each) — it caught the
  stale-directory contamination and confirmed every dispositions contract before the next consultation
  was spent. Verify shape, never content; content judgement belongs to the architects and synthesizer.
- **Provenance relay is inconsistent.** The codex lane echoed its `REPORT INTEGRITY` nonce on the critique
  run but summarized it away on both draft and revise runs. Treat a nonce-less relay as weaker evidence
  and fall back to verifying the artifact on disk.

## 2026-08-28 — follow-on rounds

| Round | Agent | Tool calls | Wall-clock | Outcome |
|---|---|---:|---:|---|
| Cross-vendor bias audit of final-plan | `architect-codex` (Sol · max) | 1 | ~17 min | `audit-of-final.md`; 2 BLOCKER / 8 MAJOR / 1 MINOR; nonce verified |
| mini-swe-agent recon | `scout` | 25 | ~3 min | external profile; several facts later corrected by the detective |
| mini-swe-agent comparison | `detective` | 48 | ~12 min | ledger-is-already-on-disk finding; WO-1 re-scope |
| Codex steering feasibility | `detective` | 31 | ~6 min | orphan root-caused; exec-lane risk identified |
| Web tools (base architect) | `executor` | 6 | ~30 s | 2 files |
| Web tools review | `reviewer` | 18 | ~3 min | APPROVE + 1 MINOR (master-pack inconsistency) |
| Web tools (master xhigh) | `executor` | 5 | ~18 s | 1 file; remediates the MINOR |
| Delta review | `reviewer` (warm) | 10 | ~2 min | CONFIRMED ×3 |
| Retire `/deep-plan` | `executor-heavy` | 53 | ~14 min | 6 deleted, ~20 edited; map was incomplete by 6 files |
| Retirement review | `reviewer` | 49 | ~10 min | REVISE — version stamps never bumped |
| Version remediation → 2.0.0 | `executor-heavy` (warm) | 11 | ~4 min | 6 stamps; installer deliberately NOT run |
| Delta review | `reviewer` (warm) | 18 | ~4 min | APPROVE, no findings |

### Cadence notes

- **Never run a tree-modifying order concurrently with a read-only cross-vendor consultation.** The bias
  audit returned `⚠ INTEGRITY WARNING: 32 source paths modified` because the retirement was executing
  alongside it. Not a sandbox breach — a sequencing error by the Director — but it means that audit read
  a tree in motion, and its repo-derived claims carry that caveat.
- **Recon maps are hypotheses, not inventories.** The retirement's scout map missed six files carrying live
  references, including both `orchestra-status` skill copies, which would have left `/orchestra-status`
  probing a deleted hook. The order's "any other hit is an incomplete removal — fix it" clause is what
  caught them; keep that clause in every removal order.
- **Executor rationales need checking even when the code is right.** The retirement's report claimed a naive
  deletion would have broken the crossplan lane; the reviewer refuted it against HEAD. The refactor was
  verified value-preserving across 150 combinations, so the code stood — but the Director relayed the wrong
  reason to the user before the review ran. Relay verdicts, not rationales, until they are checked.
- **Warm-resume works well for remediation.** Both REVISE→fix and both delta reviews went back to the agent
  that did the original work; each converged in one round with full context and no re-litigation.
- **bash `grep` silently aborts on at least one file in this tree**, returning empty output without failing
  the pipeline. Sweep-style verification here must use ripgrep or it can manufacture a false "clean."
