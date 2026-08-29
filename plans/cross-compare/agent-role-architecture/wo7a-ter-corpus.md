# WO-7a-ter classification corpus — the human pass

This is the validation probe for **boundary redraw #2** (final-plan.md, WO-7a outcome), per
the owner's ruling of 2026-08-29: a cross-repo corpus. The in-repo unused-history pool was
exhausted, and this repo's history could never supply E5/E6 work — so these twenty real
historical tasks are drawn from two of the owner's other repositories (a Godot 4.6
multiplayer game and a TypeScript monorepo web/mobile app), each stripped back to the
one-line request a user would have typed **before the work existed**: no solution details,
no class hints, non-chronological order. Roughly half the source commits were authored by
AI agents, chosen deliberately — the owner is least likely to remember their solution
details, which brings the human pass closest to intake-only classification.

**Selection integrity.** The in-session mining summaries named several candidate commits
alongside their likely classes; **every commit so named was excluded from this corpus.** No
item below derives from a commit whose classification has been discussed with the
classifier.

**Seeding.** Ten of the twenty items sit on the rules redraw #2 touched (amended B and the
mirrored diagnosis chain, new V, amended G with the component unit and pairwise scoping,
including the shifted-G boundary the bis item-1 note flagged); their identities are
recorded in the sealed file, not here, so the subset can be scored after the blind pass
without steering it. The rest cover ground this exercise has never tested — E5, E6, and
discriminator K among them — plus clean anchors. E4 remains untested: the only clean E4
sources were class-hinted in session and burned; the caveat carries to WO-7b's synthetic
items.

**Your job.** For each request, assign exactly one task class from the Part-4 routing table
in `final-plan.md`, using the Part-4 preamble precedence and pairwise-scoping rules, the
4.1 exclusive discriminators (A–V), and the **4.2 phase rules** to break ties. Classify
against the tables **as written — the redraw-#2 text**, not what you think they should
say. Optionally note the risk tier (T0–T3, Part 2.0) and anything you found ambiguous.

**Rules.**

1. Do this pass **independently and completely** before opening
   `wo7a-ter-model-classification-SEALED.md`. That file holds both model passes and the
   subset key; reading any of it first voids the comparison.
2. Work only from the request text and the tables. Every discriminator must be answered
   from the intake text alone (§4.2 intake-decidability); a rationale that needs facts only
   the work would produce is void. Do not consult either source repository. If a request
   still matches two primaries after the discriminators and phase rules, mark it ambiguous
   — that is data, not an error.
3. When both passes are done, compare against the **primary (Claude) sealed pass**.
   **Full-corpus gate: ≥90% agreement (≥18 of 20), with ≤1 genuine ambiguity** — pass →
   WO-4 encodes Part-4.1 and §4.2 as data; fail → third redraw. **Subset gate,** scored
   after the blind pass from the sealed key: ≥9 of the 10 redraw-#2-seeded items — this is
   what specifically validates redraw #2; a full-corpus fail concentrated outside the
   subset indicts the newly probed boundaries (E5/E6/K and company), not the redraw.
   The **Sol pass is supplementary** cross-family data (the Conductor has a Sol depletion
   mirror): it gates nothing, but every Claude/Sol divergence is logged to the ambiguity
   ledger as a decidability finding.
4. Log every disagreement against its class pair. Cross-probe ledger standing at the start
   of this probe: I0/I1 and E2/E3 each at two entries, D0/N2 at one — a third on any of
   those pairs trips the merge/redraw trigger.

| # | Request | Your class |
|---|---------|------------|
| 1 | Produce the consolidated v0.11.0 release notes covering everything PRs #325 through #374 landed — art, ships, ocean, AI, input, HUD — and repoint the status index at them. | |
| 2 | The API fails at startup with Fastify's duplicate content-type-parser error ever since raw webhook-body support was added — fix it without breaking existing request parsing. | |
| 3 | CI fails with exit 126 invoking the ci script on the Linux runner ever since the script was last committed from a Windows machine — make the pipeline run again. | |
| 4 | Show world-space hull-health bars above every player and NPC ship — readable at distance, color-graded by damage, culled when they can't matter. | |
| 5 | Some users bounce in a redirect loop after signing in instead of landing in the app — find out why and break the loop. | |
| 6 | Record the decision in the roadmap: personalization is modeled per individual, not per couple. | |
| 7 | First-mate passive perks should stack with the captain's everywhere a captain bonus applies — bring every site that resolves those bonuses in line. | |
| 8 | On iOS cold launch an existing partner connection intermittently disappears until a manual refresh, then vanishes again after the next cold start — track it down and make it stick. | |
| 9 | ship_view.gd is at the lint line ceiling — carve out headroom without changing callers or cache behavior. | |
| 10 | Identical fracture runs in the asset pipeline keep producing different debris pieces from the same inputs — make the exports deterministic run to run. | |
| 11 | The mobile home screen fires five API calls on every mount, so it loads slowly and can paint half-updated state — cut the fan-out without changing what it shows. | |
| 12 | Pin the agreed Phase-A decisions into the campaign design doc — the opening, bootstrap, lifecycle, and save-barrier contracts, exactly as decided. | |
| 13 | The API crashes at startup with a Fastify plugin-version error right after the latest dependency bump — get it booting again. | |
| 14 | Add behavioral test coverage for the treasure-fleet brains: steering, refusal to moor, damage response, pirate targeting, and weighted galleon spawn selection. | |
| 15 | Implement the chase phase of the combat redesign: sail damage that regenerates and degrades speed, purchasable bow and stern chasers, and chain shot — landing together as one playable whole. | |
| 16 | Replace the hardcoded 4-day streak and sample week on the Pulse screens with real numbers computed from the couple's check-in history. | |
| 17 | The ship nameplates and captain icons that shipped weeks ago have never actually appeared in a single game — find out why. | |
| 18 | Implement the approved Home V3 design on both mobile and web — greeting with partner presence, the continue-session hero, pulse summary, quota card, crisis footer. | |
| 19 | Common gameplay paths feel heavy in busy scenes — make the hot paths faster. | |
| 20 | Captains should always see why an ability is unavailable — cooldown and spent states, rejection and ransom notices, a pardon chime — filtered to the seat that owns them. | |

## Comparison with the sealed pass

*(To be completed after the independent pass above is done and saved. Score against the
primary Claude pass; the Sol pass is logged, never gating. A sealed provisional class is
treated as that pass's class; an ambiguity flag does not erase a class disagreement.)*

<!--
Source commits (audit trail; repo + one short sha per item — the commit whose work the
request was reverse-derived from. PPP = PiratePartyPals (Godot), LC = LLM-Comm-V2
(Homonoia). No sha below appears in wo7a-corpus.md or wo7a-bis-corpus.md, and none was
named with a class hint in the session that drew this corpus):
 1: PPP 620ae222    2: LC b0272e9    3: PPP 49428149    4: PPP 914a352a
 5: LC a7bffab      6: LC e5a0cac    7: PPP 1708a650    8: LC 3734165
 9: PPP cdd9655a   10: PPP b422bcc1  11: LC c6d2a404   12: PPP e6e0d49a
13: LC 641782c     14: PPP 90ec4935  15: PPP dd00a9e4  16: LC afd4845
17: PPP e357e613   18: LC b2d66fb   19: PPP 317f6d21  20: PPP a8d3f32c
-->
