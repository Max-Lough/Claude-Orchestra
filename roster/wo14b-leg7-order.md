# WO-14b leg 7 — the live gate (per the finish plan; owner present)

- **Authority:** `roster/wo14b-finish-plan.md` § ASAP step 5 and § STOPPING RULES. Runs after
  leg 6 is green and the single integrated Sol review (≤40 calls, + one correction ≤40, + one
  recheck ≤15) has returned APPROVE on the exact installed commit.
- **Budget:** ≤10 setup calls, ≤40 workflow calls, ≤40 Opus-audit calls. **The Opus adversarial
  perspective is folded into this gate's final audit — no separate pre-live Opus cycle.**
- **Owner in the loop:** records the Quartermaster readings (`quartermaster.js --record`) into the
  disposable target, approves the engine server in that project's `.mcp.json`, and is present for
  the final accept-or-stop.
- **Target:** a disposable git repository installed with `node install.js <tmp> --roster new
  --packs codex` (legacy co-installed), a fresh `claude` session in it as the Conductor casting.
  Real Anthropic and OpenAI calls at the real castings.

## The runs (each run's transcript, envelope, ticket ledger, Verifier artefacts, casting records,
## verdict audit, and engine provenance are copied verbatim into `roster/wo14b-leg7-canary/`)

1. One real Anthropic-authored T2 order (a small real change with a declared verification
   command): dispatch → real OpenAI Q0 launch through Agent → real `builder` → SubagentStop →
   close #1 → Verifier PASS → real OpenAI reviewer through the ticket-gated codex runner → close #2
   → audited `CLOSED`.
2. One real bounded OpenAI-authored order (`builder-openai`, Luna) → real Anthropic reviewer through
   Agent → `CLOSED`.
3. One unticketed Agent attempt, one unticketed raw `orchestra_exec` attempt, and one ticket replay
   attempt — all denied before any engine invocation, visible in the transcript.
4. Rollback: `install.js --roster legacy` with an open ticket → INVALIDATED; the next dispatch
   returns the legacy identity; a real Agent launch of `executor` proceeds with no ticket; the
   ledger records the transition.

**Cut** (deferred to the shadow period as canaries): reserve-exhaustion and reviewer-unavailable
refusals, deliberate-REVISE traffic, exhaustive seat/tier runs.

`UNKNOWN` is acceptable only for an exact served-model field; the engine family and adapter
provenance used for cross-family closure must be authoritative. Authentication, MCP approval,
host lifecycle, or provider unavailability → `BLOCKED`, never a synthetic substitute.

## The final audit (Opus · high, read-only, ≤40 calls)

Over the preserved artefacts and the installed commit: rule APPROVE or STOP. **No live-gate fix
cycle is authorised** — any code-level MAJOR/CRITICAL returns the bridge to the owner as unable to
close under this tranche.

## Closed only when (verbatim from the plan)

- Green leg-6 installed acceptance in both vendor directions.
- A Sol integrated `APPROVE` with no unresolved MAJOR/CRITICAL after at most one correction.
- Two real live orders reaching audited `CLOSED`, with Q0 and Verifier ordering proven.
- Unticketed Agent/raw-engine and replay attempts denied before engine invocation.
- Rollback invalidating an open ticket and restoring legacy operation.
- A final Opus audit returning `APPROVE` with no MAJOR/CRITICAL.
- No active ticket, no fabricated base/model/family value, and the disposable target restored to
  legacy.

## Stop and hand to the owner if (verbatim from the plan)

The same installed-spine failure repeats after the one correction; a new MAJOR/CRITICAL appears
after correction or during the live audit; either repair required ticket/schema widening or another
production subsystem; an unticketed engine path remains callable; provider/authentication/MCP/host
lifecycle is unavailable; or authoritative base, engine family, or provenance requires trusting
model-authored text.

Record: `roster/wo14b-leg7-canary-record.md`.
