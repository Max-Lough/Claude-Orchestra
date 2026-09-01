# WO-4 — class registry, schemas, ownership invariant

The machine-readable source of truth for the next-generation agent role
architecture's task taxonomy and dispatch contracts, per
`plans/cross-compare/agent-role-architecture/final-plan.md` (Part 4 as ruled
final on 2026-08-29) and its WO-4 order.

## Layout

| File | What it is |
|---|---|
| `classes.json` | The 23 active classes (each with its primary role, casting, reviewer, escalation), the `I1 → I0` alias, risk tiers T0–T3, the **§4.0 total decision procedure as ordered data** (steps → clauses → route targets + cited discriminators), the §4.1 pair discriminators (B retired), the §4.2 phase rules, the residual rule, and the classification-error stance (RECLASSIFY, hop budget, E4 mid-order trump) |
| `schemas/order.schema.json` | The dispatch contract (§3.5) — requires class, risk, `requested_casting`, author families, `integrity_nonce` |
| `schemas/report.schema.json` | The executor's return contract — requires `served_model` (or `UNKNOWN`), the integrity block, and carries the first-class `RECLASSIFY` status with its conditional `reclassify.{recommended_class, evidence}` |
| `schemas/verdict.schema.json` | The reviewer's return contract — `review.cross_family` is required and dispatcher-written, never reviewer-asserted (§3.4) |
| `schemas/authorization-packet.schema.json` | Destructive T2 / all T3 — the artifact a human reads before signing; T3 forces a named-human approver (P13) |
| `schemas/casting-record.schema.json` | The per-dispatch attestation row (P15 + §7.3): requested vs served, bucket, draw, review disclosure |
| `schemas/verdict-audit.schema.json` | The Verifier's mechanical audit of a verdict: citation replay, refutation duty, gate-class falsification, substitution check |
| `schemas/dispatch-request.schema.json` | WO-14b leg 2a — what the Conductor hands `orchestra_dispatch`, before routing happens |
| `schemas/ticket.schema.json` | WO-14b leg 2a — the authoritative per-spawn lifecycle record consumed by `router/tickets.js` |
| `load.js` | Loader + the mechanical ownership-invariant assertion |

## WO-14b leg 2a: the dispatch-request / ticket split

`schemas/order.schema.json` is the **routed canonical order** — `dispatch()`'s
output, not its input. It requires `requested_casting`, `author_family`,
`review_policy`, and `integrity_nonce`, all of which `dispatch()` computes or
mints itself; a caller that could set them could pick its own casting or forge
a review policy. `schemas/dispatch-request.schema.json` is the actual input
side of that boundary — `class`, `risk`, `goal`, `acceptance_criteria`, and a
handful of declared-by-the-Conductor optionals (`tier`, a reasoned `override`,
`touches`, `context_shape`, `human_authored`, `under_specified`, …) — with
`additionalProperties: false` making the four dispatcher-owned order fields
structurally unrepresentable in a request, not just discouraged by convention.
Once a request is routed, the only way work is actually reached under
`roster:new` is a **ticket** (`schemas/ticket.schema.json`,
`router/tickets.js`): a per-spawn record whose lawful states follow the host's
own async Agent-tool lifecycle proved in
`roster/wo14b-leg1-lifecycle-proof.md` — `OPEN → CONSUMED` (`PreToolUse`) `→
LAUNCHED` (`PostToolUse`, `agentId`/`resolvedModel` bound) `→ RESOLVED`
(`SubagentStop`, `last_assistant_message`/`agent_transcript_path` bound) `→
CLOSED` (or a disclosed `NOT_CLOSED`) — plus `EXPIRED`/`INVALIDATED` for a
ticket that never reaches a subagent result or a roster generation bump.
`router/tickets.js` is a pure state machine and JSON-file store; wiring it
into the actual `PreToolUse`/`PostToolUse`/`SubagentStop`/`Stop` hooks is a
later leg.

## The invariant, asserted at load

`node registry/load.js` (exit 0/1) checks: exactly **23 active classes and 23
primaries** (bijection — no identifier owned twice, no role owning two
classes); `I1` registered as an alias of I0 and colliding with nothing; the
§4.0 procedure **closed over the table** (every route target active, every
active class reachable, no clause citing a retired discriminator, no route to
a retired identifier); exactly two substrates (V0, P0); T3 human-authorized;
and the eight schemas present with the mandated required fields and their
class/risk enums **byte-identical** to the registry's identifiers — WO-14b leg
2 fix round (finding 4): `dispatch-request.schema.json` and `ticket.schema.json`
are enumerated and class-enum-checked here too, alongside the original six;
before the fix a drifted class enum on either schema was invisible to the
loader (still "6 schemas in sync", zero problems).

`node tests/registry.test.js` runs the same load plus tamper tests (including
the two new drift-tamper cases) proving each corruption is actually caught.

## Editing rules

The plan document rules; this directory encodes it. Change
`final-plan.md` first, then mirror here — the loader and tests are what keep
the two from drifting. `class` on an order is a **routing hypothesis** (final
ruling, 2026-08-29): risk tier and author family carry the review and
authorization gates; a misroute comes back as `RECLASSIFY`, one hop routine,
two hops a classification defect. The alias `I1` is accepted at intake and in
historical ledgers only; orders, reports, and casting records carry active
identifiers.

Consumed by WO-5 (Verifier substrate validates artifacts against these
schemas) and WO-6 (router/casting tables load `classes.json` at startup;
loading fails closed on any invariant violation).
