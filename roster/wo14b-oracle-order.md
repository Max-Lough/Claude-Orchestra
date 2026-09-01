# Scope oracle — third pass: the activation-bridge order (2026-09-01)

You are the campaign's scope oracle: GPT-5.6 Sol at xhigh, **read-only**. Do not edit,
create, or delete any file; do not run test suites (the runner's tree audit will hold
you to this). Your verdict is the deliverable — it will be committed verbatim.

## The goal you audit against

Completing the harness: a working, installed orchestration layer that dispatches real
work through the new roster with the fail-closed properties the plan promises, so that
WO-15 shadow can start honestly and WO-16/17/18 can follow. Not polishing instruments,
not proving the plan right, not corpus statistics.

## Where the campaign is

Your second-pass verdict (`roster/wo12-scope-oracle-2-2026-08-31.md`) stopped WO-12 at
phase 0 and set the binding path: readiness-repair tranche → activation bridge →
E8/E1/A0 once through the working path → WO-15. Since then:

- The readiness-repair tranche ran and is CLOSED by owner ruling
  (`roster/readiness-repair-tranche-2026-09-01.md`, incl. § Owner rulings): 11 defects
  fixed and pinned; two cross-vendor cycles; the cycle-2 residual MAJOR (a human-authored
  Q0 re-dispatched under pool transition reports its creation-time family, not the
  served one — `router/router.js:895`) is accepted as a follow-on that must be fixed
  inside the bridge before any shadow. Reserve calibration left at parity by ruling.
- An adversarial roster review (Sol · max, `roster/roster-adversarial-review-2026-09-01.md`)
  and the Conductor's refutation pass (`roster/roster-review-refutations-2026-09-01.md`)
  were ruled on by the owner (§ Owner rulings in the refutations file): launch roster is
  9 active seats + Sweeper benched + 2 substrates; 12 role files retired; Architect and
  Sweeper behind an owner toggle; a Builder "ladder" (Luna/Terra/Sonnet/Sol/Opus by task
  tier and vendor availability, `deep` → Opus by default) adopted in shape.
- The Conductor drafted the bridge order: `roster/wo14b-activation-bridge-order.md`.
  Read it in full. It contains the verified facts about the installed surface
  (`install.js`, the guard hook, the router/Quartermaster/Verifier APIs, the absent
  telemetry writers, the codex engine server), a proposed mechanism ("ticketed
  dispatch": an `orchestra_dispatch` tool in front of `dispatch()`, an Agent-tool gate
  in the guard hook, an `orchestra_close` tool that is the only path to completion),
  six legs, an acceptance list, an out-of-scope list, and a blank stopping-rules section
  that is yours to write.
- STATUS: `plans/cross-compare/agent-role-architecture/STATUS.md` (the 2026-09-01
  entries near the end of the log). Plan: `final-plan.md` Part 6 (WO-1, WO-14, WO-15,
  WO-16 acceptance).

## What is asked of you

Audit this draft against the goal. It was written by the same worker whose instrument
polishing you had to stop once already, so treat its assumptions as suspect:

- Is this the right next order, and is it the right size? What in it does not serve
  completing the harness, and what does completing the harness need that is not in it?
- Question the mechanism. The draft assumes the only way to make the session honor
  `dispatch()` is a tool in front of it plus a hook that refuses unticketed spawns. Is
  that the harness activation the plan actually needs, or an elaborate substitute for
  something simpler — or is it not enforceable enough to count?
- Question the bundling. The owner asked for the roster retirements, the toggles, the
  Builder ladder, the stale-family fix, and the guard/installer repairs to land together
  so lint moves once. Say whether that bundling helps or endangers the bridge, and what
  should be split out, deferred, or dropped.
- Question the acceptance list. Is the installed canary, as specified, sufficient
  evidence that "an installed order traverses the actual new-roster path" — your own
  bright line for WO-15 credit? What would let the worker pass it without the harness
  actually working?
- Say what must not happen during this order, and where the worker will be tempted to
  drift.
- Author the stopping rules for this order and the gate that ends it. They are binding
  on the worker until the owner overrides.

Do not enumerate options for the owner to pick from; rule. Cite files and lines for
every factual claim. Where you refute a fact in the draft, say what the current HEAD
actually shows.

## Report format

Your final message is the deliverable, self-contained:

    STATUS: DONE | PARTIAL | BLOCKED

    VERDICT (on the draft order as written)
    <one paragraph>

    WHAT THE ORDER GETS WRONG / WHAT IT IS MISSING
    - ...

    THE ORDER AS IT SHOULD BE DISPATCHED
    <legs, sequencing, acceptance — edit the draft's structure freely>

    BRIGHT-LINE STOPPING RULES
    - ...

    GATE THAT ENDS THIS ORDER
    - ...

    VERIFICATION
    - <every command or read you relied on → what it showed>

    DEVIATIONS
    - <or "none">

    CONCERNS
    - <or "none">
