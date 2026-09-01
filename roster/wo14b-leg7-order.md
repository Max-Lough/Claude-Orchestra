# WO-14b leg 7 — live installed canary (the acceptance artefact)

- **Class:** O0 Conductor-driven, from a **fresh installed session** — not a CLI twin,
  fixture engine, stub, or synthetic hook. Real Anthropic and OpenAI calls at the real
  castings. Runs after leg 6 is green in CI.
- **Target:** a disposable git repository installed with `node install.js --roster new
  --packs codex` (legacy roster co-installed), with real Quartermaster readings recorded
  by the owner (`quartermaster.js --record`) before the run, and the codex engine server
  approved in that project's `.mcp.json`. The canary session is `claude -p` (or an
  interactive session the owner watches) whose main model is the Conductor casting.
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 7). The oracle's stopping
  rule binds: if authentication, MCP approval, Agent lifecycle, or a provider is
  unavailable, report `BLOCKED` — synthetic success does not satisfy the gate.

## The five runs (in order; each run's transcript, ticket ledger, casting records,
verdict audits, Verifier artefacts, engine provenance, and installed-file census are
the acceptance artefacts, copied verbatim into `roster/wo14b-leg7-canary/`)

1. **T2 Anthropic-authored Builder order** (a small real change in the disposable repo
   with a declared verification command): `orchestra_dispatch` → implementation +
   Q0 tickets → real `test-designer-vs-anthropic` (OpenAI Q0) launch through Agent →
   real `builder` launch → real change and report bound at SubagentStop → close #1
   → Verifier PASS → reviewer ticket → real OpenAI reviewer through the ticket-gated
   codex review runner → close #2 → `CLOSED`.
2. **Bounded OpenAI-authored Builder order** (`tier: bounded`, Luna via the codex
   launcher with its ticket) → real Anthropic Reviewer (`reviewer-anthropic`) through
   Agent → `CLOSED`.
3. **Denials:** one unticketed Agent attempt (the Conductor tries to spawn `builder`
   with no ticket) and one unticketed raw `orchestra_exec` attempt — both denied with
   the reason visible in the transcript; the stub-free engine was never invoked.
4. **Non-closing paths:** with owner-recorded below-reserve readings, one author
   refusal (GATED) and one reviewer refusal (NOT_CLOSED: review unavailable); and one
   REVISE verdict (seed a deliberate defect) that stays `NOT_CLOSED` — none of them
   representable as completion in the ledger.
5. **Rollback:** `install.js --roster legacy` (flag flip, no reinstall) with at least one
   open new-roster ticket → the ticket is INVALIDATED, the next `orchestra_dispatch`
   returns the legacy identity, a real Agent launch of `executor` proceeds with no
   ticket, and the ledger records the transition.

## Gate (oracle-authored; verbatim in effect)

Every active and benched seat, substrate, merged class, and Builder tier resolves
through the installed runtime; both rosters remain installed. All deterministic
acceptance cases pass (leg 6). The two real installed orders traverse dispatch → real
Agent author/Q0 → Verifier → computed opposite-family real Agent Reviewer → audited
closure in both vendor directions. Rollback invalidates open capability and launches
the next legacy order without reinstall. Schema-valid routing, casting, and verdict
records agree with the live transcript and contain no fabricated served-model or
cross-family value. The declared suite is green in the executor run and independently
green in the final reviewer run. The final gate-class cross-vendor review returns
APPROVE with no unresolved MAJOR/CRITICAL. The progress file has a terminal line, no
ticket remains active, and the disposable target is restored to legacy.

## Report

`roster/wo14b-leg7-canary-record.md`: per run — the request, every ticket's final
state, the served models as the host/engine reported them, the verdict block, the
audit row, and the transcript path. Then the full declared verification and the
final gate-class review order (Sol · high over the integrated range).
