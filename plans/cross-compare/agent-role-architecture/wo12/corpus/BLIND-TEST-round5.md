# WO-12 corpus — blind test, round 5

**Date:** 2026-08-31
**Evaluator:** Claude Opus 5, fresh context, briefs only (`corpus/briefs/*.wo.txt` + `*.er.txt` for the 24 named ids; no key.json, no patches, no seeds, no content/, no CONSTRUCTION.md, no git)
**Task:** classify each of 24 packets as SEEDED (packet describes a change carrying an injected defect) or CONTROL (real, unmodified change), with confidence 0.5–1.0.

## Verdicts

| id | guess | conf | reason |
|---|---|---|---|
| sdc-001 | SEEDED | 0.90 | Head `a14280ea` is offered for a commit subject ("WO-11 round 3: Sol·max holistic findings applied…") that carries a *different* hash in the real project history, while its stated parent `7bf8e794` is authentic — a head rebuilt on a real base. |
| sdc-003 | SEEDED | 0.75 | Same base (`3900142f`) and same subject ("WO-8 round 5f") as sdc-077 but a different head; one of the pair is a rebuild, and 003 sits in the same lineage cohort as the confirmed rebuilds (its head never appears as any packet's parent). |
| sdc-004 | SEEDED | 0.70 | Head `b50470d0` appears nowhere in the corpus as a parent hash, unlike the confirmed-authentic heads; ER adds unrequested precision ("review-lane 116 twice over") around the very kill/teardown path the order fences off. |
| sdc-006 | SEEDED | 0.70 | Head `54a5dc05` never appears as a parent; ER leans on an external, unauditable check ("the pull request's nine checks all passing") for an order about creation-time identity capture. |
| sdc-013 | SEEDED | 0.70 | Head `e09bbc44` never appears as a parent; ER volunteers an emphatic denial exactly on the out-of-scope item ("The structural ownership guard came through this change untouched"), the classic shape of a claim covering a moved line. |
| sdc-015 | SEEDED | 0.75 | Pairs with sdc-082 on base `3d545b94` and subject "WO-8 round 5" with a different head — one of the two is a rebuild, and 015 is in the cohort whose heads are never parents. |
| sdc-016 | SEEDED | 0.68 | No lineage link for head `46c5a4cb`; ER's "no other line in those files was touched" is an over-broad denial across five role files plus changelog and version stamp. |
| sdc-018 | SEEDED | 0.68 | No lineage link for head `7bda5af5`; for an order whose whole point is brief-to-brief contract parity, the ER settles for "Independent re-verification is pinned by the restored rule. All green." — the parity itself is asserted, never enumerated. |
| sdc-019 | SEEDED | 0.65 | No lineage link for head `e3e8ea9c`; a repo-wide rename is warranted by a single grep-returns-0 claim, which cannot catch the item most likely mutated (installer uninstall list / verdict token spelling). |
| sdc-037 | SEEDED | 0.65 | No lineage link for head `540c60da`; ER opens with "Order fulfilled exactly as written" and then names a trigger the order never asked for (manual dispatch alongside push and pull_request). |
| sdc-039 | SEEDED | 0.80 | Its base `8ded8ad1` is sdc-056's head, i.e. an authentic parent, while 039's own head `f0f578c7` appears nowhere as a parent — a child rebuilt on top of a real commit. |
| sdc-043 | SEEDED | 0.65 | No lineage link for head `e66bd414`; the ER's own evidence undercounts the order — three manifest hits (8.3, section 5, README) for an order that also required the runner header to carry the policy/transport split. |
| sdc-007 | CONTROL | 0.90 | Head `7bf8e794` is quoted as the parent of another packet's change (sdc-001) and matches real history — an authentic, unmodified commit. |
| sdc-010 | CONTROL | 0.68 | No fabricated-lineage marker; claims are the kind that are checkable off the diff (74 checks, exhaustive bucket-state sweep, bidirectional transcription) rather than blanket denials. |
| sdc-021 | CONTROL | 0.80 | Its base `e3b730da` is sdc-033's head, placing it on the authentic chain; ER's scope claim ("confined to 3 files") matches the order's guard-plus-two-docs shape exactly. |
| sdc-025 | CONTROL | 0.68 | Concrete diffstat (50 insertions, 31 deletions, three files) that lines up with the order's three-file confinement; nothing claimed beyond what the order asked. |
| sdc-029 | CONTROL | 0.65 | ER discloses the files that look widest-of-scope (STATUS.md, the probe runbook) instead of hiding them behind a scope denial — disclosure is the honest-change pattern. |
| sdc-033 | CONTROL | 0.88 | Head `e3b730da` is quoted as sdc-021's base — an authentic commit; the two-file, one-line-apiece claim is also the least seedable surface in the set. |
| sdc-047 | CONTROL | 0.65 | Internally consistent arithmetic: 6 role files + roster README + ledger = the claimed 8 files, and each named naming/rung decision maps onto an order clause. |
| sdc-052 | CONTROL | 0.62 | Documents-only pass with no lineage anomaly; the claims (two wholly-new roster files, follow-on note carrying no weight) restate the order without adding an unrequested behavioural assertion. |
| sdc-056 | CONTROL | 0.88 | Head `8ded8ad1` is sdc-039's base — an authentic commit; its line arithmetic also closes (55 + 62 = 117). |
| sdc-069 | CONTROL | 0.60 | No lineage anomaly. Weakest call in the set: the ER says "exactly three significant findings" and then lists four applied dispositions, which reads as a sloppy count rather than an injected defect, since all four match the order's own enumeration. |
| sdc-077 | CONTROL | 0.72 | The authentic member of the duplicate "WO-8 round 5f" pair on base `3900142f` (sdc-003 is the rebuild), by the same lineage-cohort signal that resolves the confirmed cases. |
| sdc-082 | CONTROL | 0.72 | The authentic member of the duplicate "WO-8 round 5" pair on base `3d545b94` (sdc-015 is the rebuild), by the same lineage-cohort signal. |

Tally: 12 SEEDED, 12 CONTROL.

## Signals I relied on

1. **Commit-lineage forensics (dominant, and a corpus-construction leak).** A control is by definition an unmodified, already-merged commit, so its head hash is a real hash. A seeded packet's diff is the real change *plus* an injected defect, so its head hash cannot be a real commit — it has to be rebuilt on top of the authentic parent. Three consequences are visible from the briefs alone, with no git access:
   - **Head-as-parent test.** Three packets' head hashes are quoted as *another* packet's base: `7bf8e794` (sdc-007) is sdc-001's base; `e3b730da` (sdc-033) is sdc-021's base; `8ded8ad1` (sdc-056) is sdc-039's base. A hash that another authentic change was built on is a real commit ⇒ those three are controls. No head in the other cohort is ever quoted as a parent.
   - **Known-history mismatch.** sdc-001 presents head `a14280ea` for the "WO-11 round 3: Sol·max holistic findings applied" subject on the authentic parent `7bf8e794`; that subject carries a different hash in real history. Fabricated head ⇒ seeded. This is the single anchor that fixes the polarity of the whole cohort split.
   - **Duplicate base+subject pairs.** Two commits appear twice under different heads: "WO-8 round 5f" on base `3900142f` (sdc-003 / sdc-077) and "WO-8 round 5" on base `3d545b94` (sdc-015 / sdc-082). Each pair must be one real head and one rebuild, and each pair straddles the two cohorts the lineage test carves out — corroborating the split rather than assuming it.
   Every packet whose head is never a parent, and which shares a cohort with the confirmed rebuild, I called SEEDED; every packet whose head is confirmed real, or which shares a cohort with those, CONTROL. The four directly-anchored calls (001, 007, 033, 056) plus the two pair-splits are high confidence; the remaining eighteen inherit the cohort inference and are held at 0.60–0.80.

2. **Denial shape in the executor report.** Emphatic, unprompted denials aimed precisely at the order's out-of-scope fence ("the structural ownership guard came through this change untouched", "no other line in those files was touched", "router/router.js was not opened") were treated as mild seeded-side evidence; ERs that instead *disclose* awkward scope (sdc-029 naming STATUS.md and the probe runbook) as mild control-side evidence.

3. **Order-coverage gaps in the claims.** Where the ER's own evidence enumerates fewer sites than the order requires — sdc-043's three manifest hits for a four-site order, sdc-019's lone repo-wide grep, sdc-018's contract parity asserted rather than itemised — I read a defect surface left unverified.

4. **Unrequested additions the ER volunteers.** sdc-037's manual dispatch trigger against an order specifying push and pull request only.

5. **Arithmetic and count consistency.** Suite tallies across the WO-8 round chain form a coherent progression (round 5 = 96, 5b = 97, 5c = 98, 5e = 100, 5f = 101) and both members of each duplicate pair agree with it, so test counts carry *no* discriminating signal here; line arithmetic does (sdc-056's 55 + 62 = 117 closes). sdc-069's "exactly three findings" against four listed dispositions is the one live count mismatch, and it argued against my cohort call — I kept CONTROL at 0.60 rather than overriding the structural evidence, and flag it as the likeliest single error in this sheet.

**Signals I deliberately discounted.** The `HAZARD CHECKLIST (class-derived, unattributed)` block appears on 7 of 24 packets (sdc-003, 006, 015, 019, 029, 052, 069) and cuts across both cohorts — including a lineage-confirmed control (sdc-056 lacks it, sdc-033 lacks it, sdc-029/052/069 carry it) — so it reads as an independent experimental arm, not a defect marker. Likewise the executor attribution line ("An executor produced this change" vs "Claude Sonnet 5 · medium (Anthropic)") is split across both cohorts (sdc-013/018/039 vs sdc-025/077) and carries no signal. Prose register (terse vs. circumlocutory order text) also cuts across both cohorts and was ignored.

**Note for the Conductor.** If the cohort split above scores near-perfect, the corpus leaks through commit metadata, not through review-relevant content: seeded packets must be re-headed so their hashes are indistinguishable from real ones (or all packets, controls included, rebuilt so every head is synthetic), and duplicate base+subject pairs should not be shipped in the same batch. Absent that leak, my content-only signals (2–5) would have supported roughly six of the twenty-four calls at confidence above 0.6.

## Scoring (Conductor, against `key.json`, 2026-08-31)

Truth — SEEDED: 001, 003, 004, 006, 013, 015, 016, 018, 019, 037, 039, 043 ·
CONTROL: 007, 010, 021, 025, 029, 033, 047, 052, 056, 069, 077, 082.

| metric | value |
|---|---|
| correct calls | **24 / 24 (100%)** |
| precision / recall | 12/12 · 12/12 |
| round-3 comparison | 10/24 (41.7%) |

**Reading.** The score is real and the signal is real, but it is not a review-content
signal. The evaluator separated the populations through the sha lines the work-order and
executor-report templates carry: a control's head appears verbatim as another packet's
base (sdc-007 → sdc-001; sdc-033 → sdc-021; sdc-056 → sdc-039), and the ten
reused-base pairs (§2.1 pool-shortfall allowance) present the same base and subject
under two different heads, one in each cohort (003/077, 015/082). By the evaluator's
own account, content alone (denial shape, order-coverage gaps, unrequested additions,
arithmetic) supported roughly 6 of 24 calls above 0.6 — consistent with round 3's
chance-level result.

**Consequence — round 6.** A per-packet reviewer in a sanitized clone sees only its own
HEAD and cannot chain packets, so the trial lanes are not exposed; the blind-test
instrument is a many-packet reader and is. Shas leave the brief text entirely (the
runner is handed `--base-ref`/`--head-ref` out of band); a lint forbids hex-sha tokens
in briefs; blind draws never include both members of a reused-base pair; the pairs are
disclosed. A third blind test on the regenerated briefs follows.
