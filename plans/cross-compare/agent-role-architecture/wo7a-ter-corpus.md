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
| 1 | Produce the consolidated v0.11.0 release notes covering everything PRs #325 through #374 landed — art, ships, ocean, AI, input, HUD — and repoint the status index at them. | N2 |
| 2 | The API fails at startup with Fastify's duplicate content-type-parser error ever since raw webhook-body support was added — fix it without breaking existing request parsing. | I0 |
| 3 | CI fails with exit 126 invoking the ci script on the Linux runner ever since the script was last committed from a Windows machine — make the pipeline run again. | E0 |
| 4 | Show world-space hull-health bars above every player and NPC ship — readable at distance, color-graded by damage, culled when they can't matter. | E6 |
| 5 | Some users bounce in a redirect loop after signing in instead of landing in the app — find out why and break the loop. | I0 |
| 6 | Record the decision in the roadmap: personalization is modeled per individual, not per couple. | D0 |
| 7 | First-mate passive perks should stack with the captain's everywhere a captain bonus applies — bring every site that resolves those bonuses in line. | E8 |
| 8 | On iOS cold launch an existing partner connection intermittently disappears until a manual refresh, then vanishes again after the next cold start — track it down and make it stick. | I1 |
| 9 | ship_view.gd is at the lint line ceiling — carve out headroom without changing callers or cache behavior. | E2 |
| 10 | Identical fracture runs in the asset pipeline keep producing different debris pieces from the same inputs — make the exports deterministic run to run. | I1 |
| 11 | The mobile home screen fires five API calls on every mount, so it loads slowly and can paint half-updated state — cut the fan-out without changing what it shows. | E2 |
| 12 | Pin the agreed Phase-A decisions into the campaign design doc — the opening, bootstrap, lifecycle, and save-barrier contracts, exactly as decided. | D0 |
| 13 | The API crashes at startup with a Fastify plugin-version error right after the latest dependency bump — get it booting again. | E0 |
| 14 | Add behavioral test coverage for the treasure-fleet brains: steering, refusal to moor, damage response, pirate targeting, and weighted galleon spawn selection. | Q0 |
| 15 | Implement the chase phase of the combat redesign: sail damage that regenerates and degrades speed, purchasable bow and stern chasers, and chain shot — landing together as one playable whole. | E3 |
| 16 | Replace the hardcoded 4-day streak and sample week on the Pulse screens with real numbers computed from the couple's check-in history. | E5 |
| 17 | The ship nameplates and captain icons that shipped weeks ago have never actually appeared in a single game — find out why. | I1 |
| 18 | Implement the approved Home V3 design on both mobile and web — greeting with partner presence, the continue-session hero, pulse summary, quota card, crisis footer. | E5 |
| 19 | Common gameplay paths feel heavy in busy scenes — make the hot paths faster. | I1 |
| 20 | Captains should always see why an ability is unavailable — cooldown and spent states, rejection and ransom notices, a pardon chime — filtered to the seat that owns them. | E5 |

## Comparison with the sealed pass

The independent pass above was completed and saved before
`wo7a-ter-model-classification-SEALED.md` was opened. Its saved pre-reveal SHA-256 was
`679FDD45DB529E1CE686366764F427682397F12A16AAD4DE9317ABA180FEC39D`. Neither this pass nor
the sealed Claude or Sol pass flagged an ambiguity.

**Full-corpus result: 16/20 agreement (80%) — FAIL.** The zero-ambiguity count satisfies
the ≤1 limb, but agreement is below the required 18/20. WO-4 remains blocked and the
pre-registered rule requires a third boundary redraw.

**Redraw-#2 subset result: 9/10 agreement (90%) — PASS.** The sealed subset is items
1, 5, 6, 8, 11, 12, 13, 15, 17, and 20; item 17 is the only miss. Redraw #2 is therefore
validated by its own gate — precisely scoped (per the PR #27 cross-vendor review): its
G/V-seeded items went 6/6, while amended B missed one of its four seeded items (17) and
was re-sharpened by redraw #3; the gate passed, but B's redraw-#2 wording did not survive
unchanged. Three of the four full-corpus misses are outside the subset, so
the full FAIL does not invalidate redraw #2 as a unit; it scopes the next work to the new
boundary findings below. The sealed Claude and Sol passes agree on all 20 classes, so
there is no supplementary cross-family class divergence to add.

### Disagreement ledger

| # | This pass | Sealed Claude | Class pair | Boundary finding |
|---|-----------|---------------|------------|------------------|
| 2 | I0 | E2 | I0/E2 | The two passes read the cause-established corollary differently. The sealed pass treated the self-describing duplicate-parser error plus the implicated webhook-body addition as a stated causal mechanism; this pass treated “ever since” as temporal evidence and diagnosed first. The direct-fix threshold needs an intake-visible definition. |
| 10 | I1 | I0 | I0/I1 | This pass treated repeated fracture runs as live-only evidence; the sealed pass treated the differing exports as persisted artifacts. B should say explicitly that generated/exported outputs remain persisted evidence even when comparing executions. |
| 16 | E5 | E2 | E2/E5 | The work changes values shown by a native UI but does not change presentation or interaction. Part 4 has no E2/E5 discriminator, so “UI work” and bounded computation overlap. Add a pair rule based on the acceptance artifact, not the screen container. |
| 17 | I1 | I0 | I0/I1 | The intake names a negative render observation (“never ... appeared in a single game”). This pass treated proof of that symptom as live-run-only; the sealed pass treated the shipped code/history as persisted evidence. B needs to distinguish evidence of runtime behavior from merely persisted implementation context. |

The I0/I1 ledger therefore advances from two entries to four and trips the standing
three-entry merge/redraw trigger. I0/E2 and E2/E5 each gain their first recorded entry;
E2/E3 remains at two and D0/N2 at one.

## Boundary redraw #3 (applied 2026-08-29)

The full gate failed but redraw #2's own subset passed, so redraw #3 is deliberately
narrow rather than a reversal of the validated G/V work:

- **Sharpen B's evidence object.** A generated output that survives the process (including
  an exported asset) is persisted evidence and routes I0. A missing render, interaction,
  timing effect, or other behavior whose truth can only be observed while the system runs
  is live-run evidence and routes I1; committed source or history related to that behavior
  is context, not evidence that the runtime symptom occurred.
- **Define “cause stated” for the diagnosis corollary.** A request routes directly to a fix
  only when it names an intake-visible causal mechanism and the implicated operation or
  change; temporal proximity to a generic symptom alone does not qualify. A diagnostic
  that itself names the mechanism (such as duplicate registration) can qualify.
- **Add E2/E5 discrimination.** Presentation, layout, visual state, or interaction whose
  acceptance requires rendering routes E5. Computation, data selection, transport, or
  business logic merely consumed by an unchanged screen routes by implementation shape,
  ordinarily E2.

No redraw is indicated for G or V: their six seeded items were 6/6. K's world-space case
(item 4) also agreed, so E5/E6 itself is not changed by this evidence. The applied
post-redraw resolutions are item 2 → E2, item 10 → I0, item 16 → E2, and item 17 →
I1; item 17 is an intentional clarification away from the sealed pass's reading. The ter
corpus is now an answer key rather than independent validation; redraw #3 still requires a
fresh blinded gate before WO-4.

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
