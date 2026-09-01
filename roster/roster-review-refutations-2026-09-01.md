# Conductor's refutation pass over the Sol·max adversarial roster review — 2026-09-01

Companion to `roster/roster-adversarial-review-2026-09-01.md` (the verdict, verbatim).
Owner instruction: present EVERY criticism with the refutation attempt, successful or
not, so the owner reads all of it and rules seat by seat. Strength labels:
**STRONG** = the criticism's factual premise is wrong; **PARTIAL** = facts right, the
verdict over-reaches or mis-weights; **FAILED** = I concede. I built half this
roster and am not disinterested — weigh accordingly.

One disclosure up front: my order told the reviewer to read the WO-9/10/11 band
records. Red Team (E7) and Sweeper (S0) were exercised in **WO-8**
(`roster/wo8-review-dispositions.md`), which it therefore never weighed. Two of its
sixteen non-KEEP verdicts rest on "no exercise outcome to credit" — a premise my
scoping made false. That is a framing error of mine, not the reviewer's.

## Seat-by-seat

| # | Seat | Verdict | Refutation | Strength |
|---|---|---|---|---|
| 1 | Architect A0 | DEMOTE to on-demand | The zero-competency-signal premise is 100% environmental: all five attempts hit the sandbox protocol-v6 fault, cleared today; the staged A0 exercise is queued and its deliverable (the telemetry-extension design) is needed regardless. Ruling before running a free, already-staged data point discards evidence. The cost-row staleness is true. On-demand casting vs standing file is near-cosmetic for a class the Conductor only routes on A0 orders. | PARTIAL — run the staged exercise first, then rule |
| 2 | Synthesizer A1 | DITCH | Cannot refute. Once-per-project, deferred by design; the contest-ledger protocol survives as a documented workflow under Conductor + both Reviewer lanes + owner. | FAILED |
| 3 | Scout N0 | MERGE → Investigator | The two inventories were substantively correct and cheap; the self-miscounts (39/40, 44/47) are real and the mechanical-count follow-on was already registered. The merge keeps an N0 casting, so the function is preserved and only the file goes. | FAILED |
| 4 | Researcher N1 | DEMOTE | Ex1's defects were status-typing and missing retrieval dates (corrected); the retry independently corroborated 3 of 4 sources — the capability is real. But the reviewer's bar is recurring live traffic, which does not exist. | PARTIAL, concede the demote |
| 5 | LC Analyst N2 | MERGE → Investigator | One clean pass proves the prompt shape, not a seat. Mode-under-Investigator preserves it. | FAILED |
| 6 | Archivist M0 | MERGE → Investigator | Images lane never received an order; documents lane passed only on retry. | FAILED |
| 7 | Operator E0 | MERGE → Builder | The E0 exercise passed cleanly (root cause from observed error, minimal fix, re-proven from a clean reinstall). But the reviewer's boundary — unknown cause → Investigator, specified change → Builder — is the plan's own §4.2 diagnosis chain, so the merge is consistent with the plan; E0 remains a routing label. | FAILED as a seat; class stays |
| 8 | Runner E1 | DITCH as a model seat | The evidence cited (five attempts, zero signal) is unfair — every attempt died in the environment fault, not on competence. The design criticism stands on its own though: the E1 exercise (three-file exact substitution) is literally a script, and deterministic tooling under V0 does it with fewer failure modes. | PARTIAL — reject the evidence framing, concede the design |
| 9 | Principal E3 | DEMOTE to strong Builder casting | The undisclosed scope deviation (acceptance-log path) and the report's own decomposability admission are on record. Cannot refute. | FAILED |
| 10 | Data Engineer E4 | DEMOTE to on-demand gated mode | The strongest exercise in WO-10: byte-exact rollback round-trip, poisoned record refused as a verified no-op, and — the honesty contrast with E3 — a genuinely self-disclosed deviation. The "cost" is one static file that rarely changes; the risk asymmetry (irreversible data) is where an improvised casting is least welcome. The reviewer's mode keeps the protocol mandatory, so it is functionally close — but I argue the standing charter is cheap insurance exactly here. | PARTIAL — contested, owner's call |
| 11 | Interface Artisan E5 | DEMOTE | The defining render-inspect-adjust loop is unreachable in this harness and the closing rung has no file. Cannot refute. | FAILED |
| 12 | Spatial Specialist E6 | DEMOTE | 1/100 traffic; visual/critic path unexercised; the pre-registered paired trial is the only refutation route. | FAILED |
| 13 | Red Team E7 | MERGE → Reviewer | **Premise false.** E7-EX1 (WO-8) found the Verifier trust-boundary CRITICAL (mutation-path traversal → arbitrary write), two HIGHs (citation-replay read oracle; red-reported-green via the UNAVAILABLE downgrade), and three MEDIUMs (schema-check prototype-chain bypass, risk-tier oracle fail-open, Q0 calibration sample grindable via caller task_id) — all confirmed and fixed. The cross-vendor R0 review of the same code independently matched only the CRITICAL and the prototype-chain family; the read oracle, the red-reported-green, the fail-open tier, and the grindable sample were Red-Team-only. That is the reviewer's own refutation bar met: "the separate seat repeatedly finds exploitable paths the Reviewer misses." Whether it lives as a seat or as a Reviewer exploitability mode is a structure question; "delivered nothing" is not. | STRONG |
| 14 | Refactorer E8 | MERGE → Builder | Same environmental-evidence objection as Runner. The design point (census-first Builder order with Verifier re-running the census) is sound and loses nothing. | PARTIAL — concede the design |
| 15 | Doc Writer D0 | MERGE → Builder | One good fixture result (28 citations, fail-closed checker) validates the checker, not a permanent identity; Verifier can run the citation check. | FAILED |
| 16 | Sweeper S0 | MERGE → Reviewer | **Premise false.** S0-EX1 (WO-8) found three real gaps — a stale count in router/README, `roster/` never committed, `wo7b/score.js` missing from CI — all fixed. Note what kind of findings those are: wiring and completeness defects **outside any diff**, which a diff-scoped review phase structurally cannot see. That is the argument for a census that is not a review phase. Merging it into Reviewer as a "first phase" narrows it back to the diff. | STRONG on premise; PARTIAL on structure |

## Structural criticisms

| # | Criticism | Refutation | Strength |
|---|---|---|---|
| S1 | The roster is unreachable (no production caller; install.js installs the legacy core) | True; already the activation-bridge order in the standing oracle path. | FAILED (adopted) |
| S2 | Lint success is paperwork success; needs reachability lint | True and useful — a reachability check (every selected rung resolves through an installed adapter and executes a canary) belongs in the bridge's acceptance. | FAILED (adopt into bridge) |
| S3 | Taxonomy was mistaken for staffing (1–4/100 classes each got a file) | Largely true. Note the classes remain routing labels regardless of file count; the real saving is exercise debt and lint/casting surface, not model calls. | FAILED, with the caveat that "24→7" overstates the operational delta |
| S4 | Phase-0 does not demonstrate cross-family review superiority | True at n=6. The reviewer itself grants the mandatory floor is policy-based (authorship independence, silent-substitution defense), not recall-based — so this bounds the *preferred* band only. | FAILED on the claim as stated |
| S5 | Several casting/review paths cannot fire today; unattributed work deadlocks | True; the bridge must record author/co-author provenance or the fail-closed row deadlocks everything. | FAILED (bridge requirement) |
| S6 | Tool grants contradict charters (no read-only runner; E5 loop unreachable; Conductor self-imposed) | True; all are registered gaps. Capability-enforced adapters are the fix, not prose. | FAILED (registered) |
| S7 | Cost model stale; reserve == redBelow | True; parity is documented + pinned in the repair tranche and the calibration decision is queued for the owner. | FAILED (in flight) |
| S8 | Exercise gate open (E8/E1/A0 zero signal; A1/E5/M0 debt) | True; the standing sequence runs E8/E1/A0 after the bridge and declares the rest as canaries or limits. | FAILED (in path) |

## What I would tell the owner

- The reviewer's minimum roster (Conductor, Investigator+modes, Builder+modes, Q0×2,
  Reviewer×2, plus V0 and P0) is a sound launch set for the activation bridge.
- Two verdicts should be re-ruled on corrected facts: **Red Team** and **Sweeper**
  both delivered the campaign's highest-value non-review findings, and both did so
  precisely because they operate outside a diff's scope.
- **Data Engineer** is the one demote I contest on merits, not facts.
- **Architect/Runner/Refactorer** verdicts rest on environmental failures; the
  staged exercises are queued and cheap — rule after them, not before.
- Everything else I concede.

## Owner rulings (2026-09-01, recorded verbatim in effect)

Ruled seat by seat after the Conductor's per-seat pitch (what each seat buys over a
general Builder/Reviewer casting), which ranked them Red Team > Sweeper > Data Engineer
> Architect > Runner ≈ Refactorer.

| Seat | Ruling | Effect |
|---|---|---|
| Red Team E7 | **KEEP** (seat) | Stands as a seat: no WRITE-TREE, never-Fable route-filter, never same-vendor as author. The WO-8 evidence (four Red-Team-only findings the cross-vendor review missed) is the basis. |
| Sweeper S0 | **BENCHED** (amended same day from DITCH) | Owner: "I've literally never encountered that issue personally" — then, on the Conductor's note that wide changes lose their completeness pass: "keep sweeper on the bench then if we find we are missing the role after our first few live tests." File stays; seat disabled behind the same owner-settable enable flag as the Architect toggle (typed `DISABLED` when off; the Conductor's chain-final step falls to the Verifier's deterministic census re-run, disclosed on the order). Re-enable trigger: a missed-site escape (orphaned call site, stale count, un-migrated consumer) surfacing after a wide change in the first live tests. |
| Data Engineer E4 | **KEEP** (seat) | Stands as a seat: the `noMirrorFor.irreversible` route-filter and the consequence-trump ("any persisted data changing shape, even when the code is trivial") are the argument; both need a standing file to be lintable. |
| Architect A0 | **KEEP, toggleable** | Stands as a seat behind an owner-settable switch. Mechanism (to build in the activation bridge, not yet shipped): a per-seat enable flag in the owner-pinned manifest; when off, an A0 order returns a typed `DISABLED` outcome (never a silent recast) and the Conductor plans in its own voice with the disclosure recorded on the order. The staged A0 exercise still runs (its telemetry-extension design is owed regardless). |
| Everything else non-KEEP | **DITCH** | Files retired: Synthesizer A1, Scout N0, Researcher N1, LC Analyst N2, Archivist M0 (both lanes), Operator E0, Runner E1, Principal E3, Interface Artisan E5, Spatial Specialist E6, Refactorer E8, Doc Writer D0. Their classes remain routing labels in the registry and route to the reviewer's merge targets with no dedicated casting: N0/N1/N2/M0 → Investigator; E0/E1/E5/E6/E8/D0 → Builder (E1 uniform transforms → deterministic tooling under V0); A1 → documented workflow under Conductor + both Reviewer lanes + owner. **Principal's Opus rung is not lost — it is absorbed into the Builder ladder question below.** |

Reviewer KEEPs stand unchanged: Conductor, Investigator, Builder, Test Designer ×2,
Reviewer ×2, plus the Verifier and Quartermaster substrates. Launch roster is therefore
**9 active seats + 1 benched + 2 substrates**: the reviewer's seven plus Red Team, Data
Engineer, and Architect (toggleable, default ON); Sweeper benched (toggleable, default
OFF). One mechanism serves both toggles.

**Opened by the same ruling — the Builder ladder.** The owner asked whether Builder will
have "levels": the Conductor should be able to select Luna, Terra, Sol, Sonnet, or Opus
by task and by each vendor's availability. Today `router/castings.json`'s Builder has four
rungs (`preferredBounded` Luna, `primary` Sonnet·med, `dense` Sonnet·high, `mirror`
Terra·med), the Conductor picks a rung by name or gets `primary`, and pool state can only
step to `mirror`. No Opus or Sol implementation rung exists on Builder (Opus was Principal's,
now ditched; Sol has never been an implementation casting on E2). The ladder design is
registered as an activation-bridge design item in STATUS.md with the Conductor's proposed
shape. **Owner ruled the shape the same day: adopted as proposed** — a `tier` on the order
(`bounded` / `standard` / `dense` / `deep`), each tier a preferred casting plus an ordered
cross-vendor lawful-substitute list walked under the bucket ladder with `recastFrom`
disclosed; guardrails carried (Luna never under-specified; Opus behind P15 + Amber arming;
review computed from the served author family); **`deep` defaults to Opus·high**, with a
Conductor override to Sol·high that passes the Quartermaster's review-reserve check first —
Sol is a deliberate choice, never a degradation target.
