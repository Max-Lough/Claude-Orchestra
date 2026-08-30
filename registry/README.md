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
| `load.js` | Loader + the mechanical ownership-invariant assertion |

## The invariant, asserted at load

`node registry/load.js` (exit 0/1) checks: exactly **23 active classes and 23
primaries** (bijection — no identifier owned twice, no role owning two
classes); `I1` registered as an alias of I0 and colliding with nothing; the
§4.0 procedure **closed over the table** (every route target active, every
active class reachable, no clause citing a retired discriminator, no route to
a retired identifier); exactly two substrates (V0, P0); T3 human-authorized;
and the six schemas present with the mandated required fields and their
class/risk enums **byte-identical** to the registry's identifiers.

`node tests/registry.test.js` runs the same load plus fourteen tamper tests
proving each corruption is actually caught.

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
