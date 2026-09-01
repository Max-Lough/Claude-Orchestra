# Finish oracle — the fastest defensible close of the activation bridge (owner-ordered, 2026-09-01)

You are the campaign's scope oracle: GPT-5.6 Sol at **max**, **read-only**. Do not edit, create or
delete any file; do not run test suites. Your verdict is the deliverable and will be committed
verbatim. The owner's instruction for this pass, verbatim: *"Use another sol max agent as our
oracle to get us finished asap/kiss/yangi/dry."* Treat every part of the worker's framing —
including this order and the previous oracle's path — as open to being cut.

## The goal

An installed harness on which real orders traverse the new-roster path end to end with the
fail-closed properties that matter (owner activation; one-use, bound Agent and engine capabilities;
Q0 ordering; Verifier before review; authoritative cross-family closure; rollback), so WO-15 shadow
can start. **Nothing else is the goal.**

## The record (read in this order)

1. `roster/wo14b-session-oracle-verdict.md` — the previous Sol·max pass, ~1 hour ago: it ruled two
   composition repairs (now running, owner-approved: `roster/wo14b-repair-A-order.md`,
   `roster/wo14b-repair-B-order.md`), a reduced leg 6 (`roster/wo14b-leg6-order.md`, rewritten
   since), one integrated review cycle, then the live gate (`roster/wo14b-leg7-order.md`).
2. `roster/wo14b-activation-bridge-progress.md` — the full event record.
3. The code at HEAD (`140c5cd` + records): `bridge/` (runtime, manifest, close, telemetry,
   hooks/ticket-gate, cli), `hooks/orchestra-guard.js`, `install.js`,
   `packs/codex/hooks/orchestra-engine-mcp.js`, `router/tickets.js`, `router/router.js`,
   the roster launcher files, the test suites and their sizes.

## What is asked — answer with cuts, not with more work

- **YAGNI.** List every mechanism in the bridge that is NOT on the vertical path the goal names and
  can be deleted or stubbed to a typed `UNSUPPORTED` before the gate without weakening a needed
  property: candidates the worker suspects — the pin store and its three keys, fingerprints,
  `--verify-pin`/`--repin`, the git-root key, the numeric round-trip guard's exotic branches, the
  ticket store's anomaly sidecar and torn-tail reconciliation, `bridge/cli.js` twins, telemetry
  beyond the two records the gate needs, `--grants-local`, the moved-project machinery, the seat
  toggles' fallbacks, the Builder ladder's override-only rungs. Rule per item: delete now / keep /
  defer as a documented limit. Be ruthless; say what the deletion costs.
- **DRY.** Name every duplicated implementation (the guard and `bridge/manifest.js` both implement
  pin lookup and fingerprints; the guard copies the glob matcher from `verifier/checkout.js`; two
  installers' worth of settings-merge logic; CLI vs MCP adapters; the test suites' fixture
  builders) and rule which single implementation survives and where it lives — or whether the
  duplication is cheaper to leave than to unify before the gate.
- **KISS.** Is the two-hook design (guard + separate ticket gate) the simplest thing that meets the
  goal, or should one hook do both? Is `bridge/manifest.js`'s trust logic needed at all once the
  guard selects mode from its hook argument — or can the runtime take mode from the same argument on
  its own gate hook entries and drop the pin/fingerprint logic entirely? Rule.
- **ASAP.** Given repairs A and B land in the next hour, give the shortest sequence to a closed
  bridge with the fewest human checkpoints: what leg 6 must contain at minimum, whether the
  integrated review cycle can be one Sol pass only (with the Opus pass folded into the live gate's
  audit), what the live gate must show, and where the owner must be in the loop. Give time-boxed
  budgets per step in tool calls.
- **Stopping rules** for this finish: the exact condition to declare the bridge closed, and the
  exact condition to stop and hand it to the owner instead.

Do not enumerate options; rule. Cite files and lines for every claim.

## Report format

    STATUS: DONE | PARTIAL | BLOCKED
    VERDICT
    YAGNI — DELETE NOW / KEEP / DEFER (per item, one line each, with the cost)
    DRY — CONSOLIDATIONS (per duplication: survivor + location, or "leave it")
    KISS — ARCHITECTURE RULING
    ASAP — THE FINISH SEQUENCE (ordered, budgets, owner checkpoints)
    STOPPING RULES
    VERIFICATION / DEVIATIONS / CONCERNS
