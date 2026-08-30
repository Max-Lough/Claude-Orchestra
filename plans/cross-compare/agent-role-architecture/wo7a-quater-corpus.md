# WO-7a-quater classification corpus — the human pass

This is the validation probe for **boundary redraw #3 as amended** (final-plan.md, WO-7a
outcome; amendment per the PR #27 cross-vendor review in `pr27-cross-vendor-review.md`).
Per the owner's 2026-08-29 direction it is drawn from the unburned remainder of the same
two cross-repo pools as WO-7a-ter — the Godot 4.6 multiplayer game and the TypeScript
monorepo web/mobile app — using the same Sol mining reports, with each source task
stripped back to the one-line request a user would have typed **before the work
existed**: no solution details, no class hints, non-chronological order.

**Selection integrity.** The Sol mining runs analyzed 64 candidates. Excluded from this
corpus: the 20 commits used by WO-7a-ter; the 14 commits burned by class-hinted mentions
in the drawing session; and 4 more excluded here by a stricter standard — commits never
sha-named but identified by description in owner-visible text either alongside a class
flavor or with their cause named. The full exclusion ledger, with quotes and provenance
(mining rollout files and transcript line numbers), is recorded in the sealed file — an
auditability fix the cross-vendor review demanded. Subject-level exposure without class
tokens (commit subjects visible in a terminal-rendered scout notification) is tolerated,
exactly the standard WO-7a-ter was drawn under; affected items are listed in the sealed
file's provenance notes.

**Seeding.** A pre-registered subset of the twenty items sits on the rules redraw #3
changed (discriminator B's evidence object, the §4.2 cause-stated threshold, and new
discriminator W as amended); their identities and count are recorded in the sealed file,
not here, so the subset can be scored after the blind pass without steering it. The rest
are anchors on validated or never-probed ground — including, for the first time, real E4
source material, which every prior corpus lacked.

**Your job.** For each request, assign exactly one task class from the Part-4 routing
table in `final-plan.md`, using the Part-4 preamble precedence and pairwise-scoping
rules, the 4.1 exclusive discriminators (A–W), and the **4.2 phase rules** to break ties.
Classify against the tables **as written — the redraw-#3 text as amended**, not what you
think they should say. Optionally note the risk tier (T0–T3, Part 2.0) and anything you
found ambiguous.

**Rules.**

1. Do this pass **independently and completely** before opening
   `wo7a-quater-model-classification-SEALED.md`. That file holds both model passes, the
   subset key, and the exclusion ledger; reading any of it first voids the comparison.
2. **Seal protocol (new, per the cross-vendor review):** when your column is filled,
   **commit and push this file before opening the sealed file**, so the pre-reveal state
   is fixed in public history rather than asserted by hash. Only then open the seal and
   score.
3. Work only from the request text and the tables. Every discriminator must be answered
   from the intake text alone (§4.2 intake-decidability); a rationale that needs facts
   only the work would produce is void. Do not consult either source repository. If a
   request still matches two primaries after the discriminators and phase rules, mark it
   ambiguous — that is data, not an error.
4. When done, compare against the **primary (Claude) sealed pass**. **Full-corpus gate:
   ≥90% agreement (≥18 of 20), with ≤1 genuine ambiguity** — pass → WO-4 encodes Part-4.1
   and §4.2 as data; fail → fourth redraw, scoped by the ledger. **Subset gate,** scored
   after the blind pass from the sealed key: **≥7 of the 8 redraw-#3-seeded items** —
   this is what specifically validates redraw #3; a full-corpus fail concentrated outside
   the subset indicts the other probed boundaries, not the redraw. The **Sol pass is
   supplementary** cross-family data: it gates nothing, but every Claude/Sol divergence
   is logged to the ambiguity ledger as a decidability finding.
5. Log every disagreement against its class pair. Cross-probe ledger standing at the
   start of this probe: I0/I1 at four entries (trigger already tripped and absorbed by
   redraw #3), E2/E3 at two, D0/N2, I0/E2, and E2/E5 at one each — a third entry on any
   standing pair trips the merge/redraw trigger (entries are ambiguities or scored
   cross-pass disagreements, per the codified residual rule).

| # | Request | Your class |
|---|---------|------------|
| 1 | Add server-authoritative broadside combat to the multiplayer game — cannon fire, hull damage, sinking, and respawn — with headless test coverage. | E3 |
| 2 | A user who is already paired with a partner can still land on the Connect screen instead of their Home — figure out why and get them where they belong. | I1 |
| 3 | The public health endpoint returns internal database error details to any caller — make it answer with a generic status instead. | E2 |
| 4 | Port the approved water-look probe into the shipping game — wake trails and idle ripples on the live ocean — and bake in the ratified water and wake settings. | E6 |
| 5 | Expand graphics quality from two tiers to three with the new medium tier's rendering knobs, migrating every player's saved settings from the old low-spec flag — existing callers keep working. | E4 |
| 6 | Verification shows request bodies and session JWTs can reach Sentry — stop the leakage while keeping crash reports diagnosable. | E2 |
| 7 | Stand up the new Godot project: standard input map, a global signal boundary, and the source/assets/tools directory layout. | E2 |
| 8 | Find and attribute the source of the SpawnDirector stalls in a solo release-export run. | I1 |
| 9 | Add test coverage where it counts — the deterministic aggregation logic and the security-critical resource-access checks — and inventory what gaps remain. | Q0 |
| 10 | CI keeps re-downloading the full Git LFS store — tune the cache policy so runs stop pulling assets they already had. | E0 |
| 11 | On mobile browsers the web pages overflow horizontally, Profile shows up twice in the navigation, and the affected pages are unreadable in dark mode — fix all three. | E0 |
| 12 | Add host FPS and frame-time to the periodic telemetry snapshots — emitted by the client, parsed by the worker, stored with the rest, and older snapshots without the new fields must keep loading. | E3 |
| 13 | Players hit a long stall at spawn while the game searches for a free dock — eliminate the dock-search spawn stall. | E2 |
| 14 | Retire the standalone inventory panel and its control binding — each seat's ship inventory should live in the ScoreScreen's My Ship section instead. | E5 |
| 15 | The asset fracture and validation tools fail on Windows with Blender 5.1 — make the toolchain work there again. | E0 |
| 16 | Establish the authoritative ship roster and dimension canon — record the approved brigantine proportions and the future-lineup decisions in one place. | D0 |
| 17 | Gamepad confirm and back should work consistently everywhere — no double activations, no in-match side effects when closing menus. | I1 |
| 18 | Add the bomb ketch to the playable ship roster — hull data, visual package, rigging, and its catalog registrations. | E6 |
| 19 | ship_logic.gd is over the line and public-method ceilings — carve it back under without changing behavior. | E2 |
| 20 | Write down how display-value clamping works at load — values are clamped in memory only, and a later save can persist them — so maintainers know why a large-monitor preference can get replaced. | D0 |

## Comparison with the sealed pass

The independent pass above was committed as `2965c04` and pushed to
`origin/claude/wo7a-bis-corpus` before
`wo7a-quater-model-classification-SEALED.md` was opened. This pass and the primary Claude
pass flagged zero ambiguities; the supplementary Sol pass flagged one (item 17), which is
logged below but does not gate.

**Full-corpus result: 14/20 agreement (70%) — FAIL.** The zero-ambiguity count satisfies
the ≤1 limb, but agreement is below the required 18/20. WO-4 remains blocked, and the
pre-registered rule requires a fourth boundary redraw scoped to the findings below.

**Redraw-#3 subset result: 4/8 agreement (50%) — FAIL.** The sealed subset is items 2, 3,
6, 8, 11, 13, 14, and 17. Items 3, 6, 8, and 14 agree; items 2, 11, 13, and 17 do not.
Redraw #3 is therefore **not validated** by its own gate.

### Primary disagreement ledger

| # | This pass | Primary Claude | Class pair | Boundary finding |
|---|-----------|----------------|------------|------------------|
| 2 | I1 | I0 | I0/I1 | This pass treated landing on the wrong screen as runtime-only interaction evidence under B; the primary treated the evidence location as unanswerable from intake and took B's I0 default. B does not say when the requested observation itself is enough to establish the live-run limb. |
| 11 | E0 | E5 | E0/E5 | This pass engaged the diagnosis chain at A because mobile browsers are the stated environment axis; the primary treated layout and styling as specified interface work under W. The supplementary I1 reading makes the missing order among environment diagnosis, live-symptom diagnosis, and interface acceptance explicit. |
| 12 | E3 | E4 | E3/E4 | This pass gave the coupled client/worker/storage contract to the E3 parent; the primary gave the persisted snapshot compatibility risk to E4. No rule says whether cross-component coupling or schema risk owns an order that has both. |
| 13 | E2 | I1 | E2/I1 | This pass read “dock-search spawn stall” as a stated mechanism and routed directly to the fix; the primary applied L because no profile or numeric target is present. The direct-fix corollary and L are not ordered, and “while” leaves the cause-stated threshold borderline. |
| 17 | I1 | E5 | E5/I1 | This pass diagnosed runtime-only interaction symptoms first; the primary routed specified interaction behavior through W. The supplementary pass also found E5/E8 ambiguous, exposing both diagnosis-vs-W precedence and the missing E5/E8 boundary. |
| 18 | E6 | E2 | E2/E6 | This pass treated the visual package and rigging as the spatial acceptance artifact; the primary treated one ship plus roster mirroring as a separable E2 component. Sol independently chose E6. Precedence and G do not resolve E2/E6. |

### Supplementary cross-family ledger

The primary Claude and supplementary Sol passes agree on 16/20. Their four divergences
are non-gating but remain required decidability findings:

| # | Primary Claude | Supplementary Sol | Class pair |
|---|----------------|-------------------|------------|
| 2 | I0 | I1 | I0/I1 |
| 11 | E5 | I1 | E5/I1 |
| 17 | E5 | AMBIGUOUS (E5/E8) | E5/E8 |
| 18 | E2 | E6 | E2/E6 |

Counting each corpus item once per implicated pair, I0/I1 advances from four standing
entries to five. E5/I1 gains two entries (items 11 and 17); E0/E5, E3/E4, E2/I1,
E5/E8, and E2/E6 gain one each. E2/E3 remains at two; D0/N2, I0/E2, and E2/E5 remain
at one. The I0/I1 recurrence survived the redraw intended to absorb it; together with the
failed seeded gate, that boundary must be addressed by redraw #4 or a merge.

**Coverage caveat.** The source pool supplied no persisted-generated-output I0 case for
B's other redraw-#3 clause and no values-only E2 case for W's data horn. This probe cannot
validate either edge; both remain explicitly deferred to WO-7b's synthetic cases.

## Ruling disposition (2026-08-29) — ledger closed

The owner ended the probe/redraw cycle and delegated the disposition to a final
end-to-end review whose conclusions were pre-committed; the ruling is applied in
`final-plan.md` (Part 4 preamble, §4.0 total decision procedure, Part 2 seat 7). This
was the last mined paper probe: the cross-probe pair ledger is **closed** and its
standing entries are dispositioned below. From here the ledger's successor is live
RECLASSIFY/ambiguity telemetry per pair (Part 4 residual rule), validated by WO-7b
through the implemented router.

| Pair (entries) | Disposition |
|---|---|
| I0/I1 (5) | **MERGED** — one Investigator seat, class I0; disc. B retired. Items 2, 8, 13 (and ter 5/10/17, bis 5, 7a-16) dissolve. |
| E5/I1 (2) | Resolved by §4.0 step 3(a): presentation/interaction defects route E5 directly (the render loop is the diagnosis); logic defects surfacing through a UI route I0 via 3(d). Items 11, 17 → E5. |
| E2/E3 (2) | No merge (castings and mandatory-review lanes differ). G survives as §4.0 step 6, entered only after steps 3–5 filter symptoms, data, and acceptance artifacts. |
| E0/E5 (1) | §4.0 orders 3(a) before 3(b): a browser/device/viewport where an interface misrenders is E5's multi-viewport charter, never an environment axis. Item 11 → E5. |
| E3/E4 (1) | §4.0 step 4 schema trump: persisted-data shape/content risk outranks coupling; both-in-one orders belong to E4 (or an E4 parent). Item 12 → E4. |
| E2/I1 (1) | Disc. L totally ordered above the cause-stated fall-through: performance-outcome acceptance without a profile → I0; a named suspect is not a profile. Item 13 → I0. |
| E2/E6 (1) | §4.0 step 5 spatial-acceptance clause: geometry/rig/visual-package deliverables accepted by inspecting spatial output → E6 even when mirroring a template; separable non-spatial tails split off as E2 children. Item 18 → E6 (with this pass and Sol, against the primary). |
| E5/E8 (1) | §4.0 step 5(b): interface work routes E5 before step 6 is reached, however many surfaces it spans; the census runs inside the E5 order. Sol's item-17 ambiguity is thereby decidable. |
| I0/E2 (1), D0/N2 (1), E2/E5 (1) | Standing rules retained (cause-stated definition; disc. V; disc. W) and now entered only through §4.0's fixed order. |

These dispositions are reasoned rulings, not a blind-validated answer key — the same
epistemic status the ruling assigns to intake classification generally, which is why the
class field is now a routing hypothesis with cheap RECLASSIFY recovery rather than a
correctness-gated contract.

<!--
Source commits (audit trail; repo + one short sha per item — the commit whose work the
request was reverse-derived from. PPP = PiratePartyPals (Godot), LC = LLM-Comm-V2
(Homonoia). No sha below appears in wo7a-corpus.md, wo7a-bis-corpus.md, or
wo7a-ter-corpus.md, and none is on the exclusion ledger in the sealed file):
 1: PPP ad6e1437    2: LC 5bcdd37    3: LC 9371354    4: PPP 67a68940
 5: PPP f1c9851     6: LC f902ab8    7: PPP 727b6d9a   8: PPP b334dbe8
 9: LC 3beafbd     10: PPP 26a95327 11: LC d76a402   12: PPP 95f8927b
13: PPP ff26e7ee   14: PPP a8aee5e2 15: PPP 85e2fe2e 16: PPP e945c0c2
17: PPP 480f4782   18: PPP cba3757a 19: PPP f2f760f1 20: PPP 538ae6cf
-->
