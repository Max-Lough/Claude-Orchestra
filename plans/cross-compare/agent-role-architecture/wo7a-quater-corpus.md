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
| 1 | Add server-authoritative broadside combat to the multiplayer game — cannon fire, hull damage, sinking, and respawn — with headless test coverage. | |
| 2 | A user who is already paired with a partner can still land on the Connect screen instead of their Home — figure out why and get them where they belong. | |
| 3 | The public health endpoint returns internal database error details to any caller — make it answer with a generic status instead. | |
| 4 | Port the approved water-look probe into the shipping game — wake trails and idle ripples on the live ocean — and bake in the ratified water and wake settings. | |
| 5 | Expand graphics quality from two tiers to three with the new medium tier's rendering knobs, migrating every player's saved settings from the old low-spec flag — existing callers keep working. | |
| 6 | Verification shows request bodies and session JWTs can reach Sentry — stop the leakage while keeping crash reports diagnosable. | |
| 7 | Stand up the new Godot project: standard input map, a global signal boundary, and the source/assets/tools directory layout. | |
| 8 | Find and attribute the source of the SpawnDirector stalls in a solo release-export run. | |
| 9 | Add test coverage where it counts — the deterministic aggregation logic and the security-critical resource-access checks — and inventory what gaps remain. | |
| 10 | CI keeps re-downloading the full Git LFS store — tune the cache policy so runs stop pulling assets they already had. | |
| 11 | On mobile browsers the web pages overflow horizontally, Profile shows up twice in the navigation, and the affected pages are unreadable in dark mode — fix all three. | |
| 12 | Add host FPS and frame-time to the periodic telemetry snapshots — emitted by the client, parsed by the worker, stored with the rest, and older snapshots without the new fields must keep loading. | |
| 13 | Players hit a long stall at spawn while the game searches for a free dock — eliminate the dock-search spawn stall. | |
| 14 | Retire the standalone inventory panel and its control binding — each seat's ship inventory should live in the ScoreScreen's My Ship section instead. | |
| 15 | The asset fracture and validation tools fail on Windows with Blender 5.1 — make the toolchain work there again. | |
| 16 | Establish the authoritative ship roster and dimension canon — record the approved brigantine proportions and the future-lineup decisions in one place. | |
| 17 | Gamepad confirm and back should work consistently everywhere — no double activations, no in-match side effects when closing menus. | |
| 18 | Add the bomb ketch to the playable ship roster — hull data, visual package, rigging, and its catalog registrations. | |
| 19 | ship_logic.gd is over the line and public-method ceilings — carve it back under without changing behavior. | |
| 20 | Write down how display-value clamping works at load — values are clamped in memory only, and a later save can persist them — so maintainers know why a large-monitor preference can get replaced. | |

## Comparison with the sealed pass

*(To be completed after the independent pass above is done, committed, and pushed. Score
against the primary Claude pass; the Sol pass is logged, never gating. A sealed
provisional class is treated as that pass's class; an ambiguity flag does not erase a
class disagreement.)*

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
