# WO-7a-bis classification corpus — the human pass

This is the blinded re-probe required by WO-7a's FAIL (final-plan.md, "WO-7a: Classification
corpus" → Outcome). Twenty real historical tasks from this repository's git history — drawn
**only from source commits the first corpus did not use** — each stripped back to the
one-line request a user would have typed **before the work existed**: no solution details,
no class hints, non-chronological order. The items are seeded on the redrawn boundaries
(the Part-4 signals-precedence rule, the §4.2 diagnosis chain and composite rule, and
discriminators A/B/G/I/S/T/U as amended 2026-08-29), because those are the rules this probe
exists to validate. The original 40 items are burned for blinding and prove nothing here.

**Your job.** For each request, assign exactly one task class from the Part-4 routing table
in `final-plan.md`, using the Part-4 preamble precedence rule, the 4.1 exclusive
discriminators, and the **4.2 phase rules** to break ties. Classify against the tables **as
written — the post-redraw text**, not what you think they should say. Optionally note the
risk tier (T0–T3, Part 2.0) and anything you found ambiguous.

**Rules.**

1. Do this pass **independently and completely** before opening
   `wo7a-bis-model-classification-SEALED.md`. That file holds the model's pass; reading any
   of it first voids the comparison.
2. Work only from the request text and the tables. Every discriminator must be answered
   from the intake text alone (§4.2 intake-decidability); a rationale that needs facts only
   the work would produce is void. If a request still matches two primaries after the
   discriminators and phase rules, mark it ambiguous — that is data, not an error.
3. When both passes are done, compare. **Threshold: ≥90% agreement (≥18 of 20), with ≤1
   genuine ambiguity.** Pass → WO-4 encodes Part-4.1 **and §4.2** as data. Fail → second
   boundary redraw before any schema exists. A disagreement traced to a badly written
   corpus line is a corpus defect, not a boundary defect; strike the item and note it.
4. Log every disagreement against its class pair (the ambiguity ledger from WO-7a
   continues here; three logged ambiguities on one pair force a redraw or merge).

| # | Request | Your class |
|---|---------|------------|
| 1 | Bundle the orchestra skills with the harness itself, so the installer stamps them into every project on install, removes exactly its own on uninstall, and never leaves stale copies behind. | |
| 2 | Shell scripts committed from a Windows machine check out with CRLF endings and break the POSIX installer's shebang on Unix — make checkouts come out right on every platform. | |
| 3 | The review-lane suite's check count changed recently — what is it now, and which commit moved it? | |
| 4 | Build a Codex-native install so the Codex CLI can serve as the Director — a new installer engine that embeds the full protocol, plus every agent, pack, and hook ported across to the Codex side. | |
| 5 | The scratch sweep keeps reporting it reclaimed nothing while abandoned review directories pile up on disk — work out why the count and the directories disagree. | |
| 6 | The scout and the detective are the only command-running agents still missing the running-process rule — add the same one-line rule to both files. | |
| 7 | Profile OpenAI's GPT-5.6 family — per-tier benchmarks, strengths and failure modes, and any evaluator-seating caveats — and write it up as a research report the roster planning can cite. | |
| 8 | The guard enforces against sessions whose model it cannot determine, so a brand-new session's first turn gets its tools denied — make it stand down unless it has positive evidence of a director model. | |
| 9 | Review runs occasionally die leaving no verdict, no error, and no exit status at all — find out what is happening to them and make the lane survive it. | |
| 10 | Work orders keep being mis-sized — one bundle ran opaque for over two hours and a midpoint regression surfaced only at completion — design a sizing and cadence protocol that keeps this from recurring. | |
| 11 | The codex-pack agents that launch the engine each drift on launch discipline in their own way — wrong working directory, output landing in the repo, warmups where they shouldn't be; bring every one of them in line. | |
| 12 | Install the dispatch telemetry hook into this repo's harness settings so every model dispatch gets logged for the weekly allowance report. | |
| 13 | Go through the logs of CI's first cross-platform hour and produce the complete list of distinct runner defects they surfaced. | |
| 14 | Switch substantive review to a cross-vendor judge: verdicts should come from an OpenAI model instead of a second Claude, with the review contract itself unchanged. | |
| 15 | Add tests proving a live-tree review refuses the warmup: the refusal must be reported, and the file the warmup would have created must not appear in the project. | |
| 16 | Bring the status record up to date: what the just-merged PR landed, and how a fresh session should pick the work back up. | |
| 17 | Reviewers grade residual hardening gaps as MAJOR right beside genuine contract violations — make every finding carry a claim-breach-or-hardening-gap label, and let only breaches force a REVISE. | |
| 18 | Confirm a fresh install into a scratch project produces files byte-identical to the reference project's live copies on every functional file. | |
| 19 | The inert review tier and the verification manifest only bind when the Codex driver runs the review — restate them as engine-agnostic review policy that holds for any judge, including the in-session fallback. | |
| 20 | Decide which engine should judge substantive reviews in this repo by default — Opus, the cross-vendor lane, or both with the Director arbitrating. | |

## Comparison with the sealed pass

*(To be completed after the independent pass above is done and saved. For scoring, a sealed
provisional class is treated as that pass's class; an ambiguity flag does not erase a class
disagreement.)*

<!--
Source commits (audit trail; one short sha per item — the commit whose work the request
was reverse-derived from; several commits source more than one item because they landed
more than one task. Every sha below is absent from wo7a-corpus.md's audit trail):
 1: cd27cdc    2: 00076a2    3: 73629f7    4: 1f6b1f3    5: 928e00c
 6: 946d158    7: aea48a7    8: e7545f6    9: 16871cc   10: 661feb0
11: 9ff2a53   12: 6f27ea2   13: 73629f7   14: 99835d5   15: 3754a98
16: 18590e3   17: 946d158   18: 1f6b1f3   19: 5976da0   20: 6f04360
-->
