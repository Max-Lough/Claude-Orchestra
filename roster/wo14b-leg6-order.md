# WO-14b leg 6 — deterministic installed acceptance (`tests/bridge-acceptance.test.js`)

- **Class:** E2 Builder · risk T1 · casting Anthropic Sonnet 5 · med.
  **Tool budget: 80 calls** → `CHECKPOINT`. Runs after leg 5 is committed.
- **Branch:** `claude/wo14b-bridge`. **Do not commit.**
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 6). The oracle's rule that
  binds this leg: "CLI adapters may exercise shared logic but are not evidence of
  installed MCP or Agent reachability" — this suite drives the **installed** artefacts
  (the copied runtime, the registered MCP server over stdio, the hook scripts with
  synthetic host payloads) in fresh temporary repositories, never the source tree.
- **Law (Band C):** execute the order, the whole order, nothing but the order; blocked
  beats guessed; the report is a claim, not evidence.

## FILES

`tests/bridge-acceptance.test.js` (new), `tests/fixtures/bridge/**` (new — synthetic
host payloads built from `roster/wo14b-leg1-lifecycle-proof-appendix.md`, seeded
Quartermaster readings, a stub `CODEX_BIN` that records invocations and returns a
canned structured verdict), `.github/workflows/test.yml`, `bridge/README.md`
(acceptance section). Forbidden: everything else — a defect found here is reported,
not fixed (it goes back to the owning leg as a fix round).

## Cases (each a named check; every fail-closed case asserts the typed outcome AND
that nothing was written to the ledger/store beyond the denial record)

1. **Install + census.** `node install.js --roster new --packs codex` into a fresh temp
   git repo → the installed-file census matches an expected list (agents ×10,
   `ORCHESTRA-CONDUCTOR.md`, `.claude/orchestra/{router,registry,verifier,quartermaster,
   bridge}`, hooks incl. the four gate entries, `.mcp.json` engine server, manifest keys).
   Legacy roster files still present.
2. **MCP initialisation and tool listing** over stdio against the installed server
   (as `tests/mcp-lane.test.js` does): `orchestra_dispatch`, `orchestra_close`,
   `orchestra_exec`, `orchestra_review`, `orchestra_doctor` listed; `orchestra_doctor`
   reports `roster:new`, generation 1, store healthy, 0 open tickets.
3. **Static route-to-adapter reachability.** For every active seat, the benched seat,
   every merged class, and every Builder tier: the runtime resolves the installed
   `subagent_type` file (exists under `.claude/agents/`) or the codex launcher, and the
   casting's model maps to a known adapter id. Sweeper: resolves but DISABLED.
4. **Ticket failures at the installed hook:** expiry, replay, wrong role, wrong
   generation, malformed stdin, missing store, nested spawn → deny with the reason.
5. **First-turn unknown-model denial** under `roster:new` (guard, `model === null`).
6. **Direct raw-engine denial:** `orchestra_exec` and `orchestra_review` without a ticket
   → `TICKET_REQUIRED`, and the stub `CODEX_BIN` records zero invocations.
7. **Positive Q0 path:** a T3 request → two tickets; implementation consume refused
   until the Q0 ticket is LAUNCHED (synthetic PostToolUse), then allowed.
   **Negative Q0 path:** a T1 request with no trigger → one ticket, no Q0.
8. **P0 failure:** readings absent/stale → `P0_UNAVAILABLE`, nothing written.
9. **P15 author gating:** seeded below-reserve `AU-opus` → a `deep` request is GATED;
   **reviewer gating:** below-reserve OpenAI bucket → close #1 on an anthropic-authored
   ticket returns `NOT_CLOSED: review unavailable`.
10. **Security touch cannot reach Fable:** `touches:["auth"]` + Architect override to the
    Fable rung → FORBIDDEN through `orchestra_dispatch`.
11. **Verifier-before-review ordering:** close #1 with a failing Verifier → no reviewer
    ticket exists afterwards; with PASS → reviewer ticket of the opposite family.
12. **Verdict refusal:** close #2 with REVISE / same-family / malformed / MAJOR-under-
    APPROVE / citation MISMATCH → `NOT_CLOSED`; with a clean APPROVE → `CLOSED`, two
    casting records + one audit written, schema-valid, `served_model` from the payload.
13. **Roster-generation invalidation:** flip the manifest to `legacy` (via
    `install.js --roster legacy`) with two open tickets → next runtime call INVALIDATES
    both; the gate is inert; `orchestra_dispatch` returns the legacy identity with a
    ledger line. Flip back → generation 3, fresh store state, nothing resurrected.
14. **Toggles:** `seats.Sweeper:true` in the manifest → castable; `seats.Architect:false`
    → DISABLED with `conductor-self-plan`.
15. **Ladder:** `deep` at Green → Opus·high; `deep` + Sol override without reserve → FORBIDDEN;
    with the Quartermaster reserve predicate passing → Sol·high; `bounded` +
    `under_specified` → FORBIDDEN.
16. **Retirements + merged classes:** E3 → Builder/deep/mode E3 with mandatory review;
    A1 → RETIRED_WORKFLOW; M0 videoAudio → UNAVAILABLE; E1 scoped → rejected.
17. **Stale-family correction:** the cycle-2 reproducer through `orchestra_dispatch` (human
    author, Green then Amber) → the Q0 ticket's `author_family` equals the served family.
18. **Rollback leaves the target usable:** after case 13, a legacy-mode dispatch and a
    synthetic Agent PreToolUse for `executor` are allowed with no ticket.
19. **Host/store disagreement:** a LAUNCHED ticket whose `agent_id` is absent from the
    Stop payload's `background_tasks` → EXPIRED with reason, Stop not blocked.

Runs on all three CI OSes; Windows path handling is part of the acceptance (junction
cases skip with a named reason only when the OS refuses to create one).

## Declared verification (run all; paste results)

    node tests/bridge-acceptance.test.js
    node tests/bridge.test.js
    node tests/bridge-close.test.js
    node tests/install.test.js
    node tests/guard.test.js
    node tests/tickets.test.js
    node tests/mcp-lane.test.js

## Report format

    STATUS / CHANGES / VERIFICATION (actual outputs) / DEVIATIONS / CONCERNS
    plus a DEFECTS FOUND section: every case that fails, with the owning leg named.

Never end while a process you started is still running. Do not run `git commit`.
