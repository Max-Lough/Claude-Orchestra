# Session scope oracle — the activation bridge after ~12 hours (owner-ordered, 2026-09-01)

You are the campaign's scope oracle: GPT-5.6 Sol at **max**, **read-only**. Do not edit, create
or delete any file; do not run test suites. Your verdict is the deliverable and will be committed
verbatim. The owner ordered this pass with the words: "you are at risk of losing the big picture
again." Treat the Conductor's framing — including this order — as suspect.

## The goal you audit against

Completing the harness: an installed orchestration layer that dispatches real work through the new
roster with the fail-closed properties the plan promises, so that WO-15 shadow can start honestly.
Your third pass (`roster/wo14b-oracle-verdict.md`) ruled the seven-leg activation bridge, its
stopping rules, and its gate. A fourth pass (`roster/wo14b-leg3-oracle-verdict.md`) re-cut leg 3.

## The record — read it in this order, all of it

1. `roster/wo14b-activation-bridge-progress.md` — one line per event since the bridge opened.
   Count the fix rounds, the reviews, the breaches. This is the trajectory you are auditing.
2. `roster/wo14b-oracle-verdict.md` (your ruling) and `roster/wo14b-activation-bridge-order.md`
   (v2, the order as dispatched).
3. Per leg, the latest verdicts only: leg 2 `roster/wo14b-leg2-review-6.md` (APPROVE); leg 3
   `roster/wo14b-leg3-review-4.md`, `roster/wo14b-leg3-redteam-4.md`,
   `roster/wo14b-leg3-oracle-verdict.md`, and the rewrite `roster/wo14b-leg3R-order.md` (merged at
   HEAD — its own reviews have not run yet); leg 4 `roster/wo14b-leg4-review-1.md` (review #2 is
   running); leg 5 (review running); legs 6/7 `roster/wo14b-leg6-order.md`, `wo14b-leg7-order.md`.
4. The code as it stands: `bridge/` (runtime, manifest, close, telemetry, hooks/ticket-gate),
   `hooks/orchestra-guard.js`, `install.js`, `packs/codex/hooks/orchestra-engine-mcp.js`,
   `router/tickets.js`, and the test files — enough to judge whether what exists is the harness the
   bridge was ordered to build, or an ever-larger substitute for it.

## What is asked of you

- Is the bridge still the right work, and is what has been built the bridge you ruled — or has the
  worker built something larger, more fragile, and further from an installed working path than the
  gate requires? Say which parts serve the goal and which are instrument-polishing under a new name.
- The sprawl: eleven builders exceeded the 80-call ceiling; leg 2 took six review cycles on a ticket
  store's concurrency edges; leg 3 took four fix rounds and four Red Team passes before a rewrite;
  leg 4's own tests certified the path built rather than the path used. Rule on what this pattern
  means and what the Conductor must change in how orders are cut, reviewed and merged — or whether
  the Conductor should stop and hand the bridge to the owner.
- The threat model: the Red Team has repeatedly said a same-user file cannot be a trust boundary
  against same-user code, and the leg-3 oracle ruled the harness "prevents Director drift, not
  hostile-process filesystem access." Say plainly what security property the bridge must deliver for
  WO-15 and what it must stop pretending to deliver — and whether the remaining review/Red-Team
  cadence on leg 3 is proportionate to that.
- What is the shortest honest path from HEAD to the gate you ruled (installed canary, both vendor
  directions, rollback, no fabricated records)? Name what to cut, what to defer to the shadow period
  as canaries, and what must still be built. Legs 6 and 7 have not started.
- Author the stopping rules for the rest of the bridge, binding on the worker: when the Conductor
  stops to the owner, what a leg may not do, how many review cycles remain on the integrated
  bridge, and the condition under which the owner should be told the bridge cannot close in its
  current shape.
- Say what must not happen next, and where the worker will be tempted to drift.

Do not enumerate options for the owner to pick from; rule. Cite files and lines for every factual
claim. Where you refute a fact in a record, say what the current HEAD shows.

## Report format

    STATUS: DONE | PARTIAL | BLOCKED

    VERDICT (on the bridge as it stands)
    <one paragraph>

    WHAT SERVES THE GOAL / WHAT DOES NOT
    - ...

    RULING ON THE PATTERN (sprawl, breaches, review cycles)
    - ...

    THE SECURITY PROPERTY THE BRIDGE MUST DELIVER — AND MUST NOT CLAIM
    - ...

    SHORTEST HONEST PATH TO THE GATE
    <ordered; per item: build / cut / defer-as-canary>

    BRIGHT-LINE STOPPING RULES FOR THE REST OF THE BRIDGE
    - ...

    VERIFICATION / DEVIATIONS / CONCERNS
