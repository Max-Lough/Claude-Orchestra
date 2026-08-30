# WO-5 — Verifier substrate (class V0)

The deterministic core of the Verifier, per
`plans/cross-compare/agent-role-architecture/final-plan.md` (catalog entry 23)
and its WO-5 order. It establishes **facts** about a change mechanically and
returns **evidence, never a verdict** — every result carries
`evidence_not_approval: true`, and a Verifier PASS authorizes nothing.

## Layout

| File | What it is |
|---|---|
| `checkout.js` | The disposable-checkout substrate: throwaway writable `git worktree` of the commit under examination, created **outside** the repository, with before/after tree fingerprints, generated-artifact classification (expected churn = INTEGRITY NOTE, anything else = INTEGRITY WARNING), guaranteed teardown (explicit + process-exit sweep), and the dispatcher-side `guardTree` that fingerprints the **real** tree across the Verifier's own run |
| `schema-check.js` | Dependency-free JSON Schema validator covering exactly the keyword subset the WO-4 registry schemas use; unsupported keywords **fail closed** |
| `verifier.js` | The checks: manifest execution + exit-code capture, nonce echo, artifact validation against `registry/schemas/`, diff parsing + claimed-changes replay, mutation check, invariant comparison, citation replay, both tree audits, aggregation, CLI |

## Typed outcomes

`PASS` · `FAIL` · `UNAVAILABLE` · `COVERAGE_GAP` — plus commands, versions,
exit codes, durations, output tails, tree identity, and the manifest's
**declared** coverage. Scope illusion is the substrate's own failure mode, so
results report what *ran*, never "verified". Aggregation: FAIL dominates,
then UNAVAILABLE, then COVERAGE_GAP (which forces model review), then PASS.

A **deterministic-only closure** requires declared-complete oracle coverage
*and* an outcome untouched by model assistance. Every check records
model-assist provenance as schema fields (`model_assist.{used, family,
casting, influenced_outcome, absorbing_rule}`); this core always emits
`used: false` — the fields exist so the future model-assisted checklist path
(cheapest tier, ensemble votes, WO-6+) cannot omit them, and so an
assisted outcome can never satisfy a deterministic-only closure.

## Why the checkout is writable

Half the mandatory checks write: builds populate caches, test runners write
fixtures, the mutation check inverts an assertion, the invariant comparison
probes a copy. Writes are bounded four ways (all implemented in
`checkout.js`): confined to a throwaway checkout outside the repo; no write
path to the source of truth; before/after fingerprint with generated-artifact
classification; and the dispatcher fingerprints the real tree across the
Verifier's own run, so a write-scope escape is caught by the same mechanism
the substrate applies to everyone else. A mutation performed here is an
experiment, never a proposed change.

## Proof

`node tests/verifier.test.js` (63 checks) — including the order's proof
clause, on a fixture project whose suite **cannot run read-only** (it writes
`.test-cache/` on every run): the substrate catches a red suite reported
green, changes claimed against an untouched tree, an invertible test that
stays green, and a broken row-count invariant.

## CLI

```
node verifier/verifier.js --repo <dir> --commit <ref> --manifest <m.json>
     [--base <ref>] [--order <o.json>] [--report <r.json>]
     [--invariants <i.json>] [--citations <c.json>]
```

Exit codes: 0 PASS · 1 FAIL · 2 UNAVAILABLE · 3 COVERAGE_GAP.

Consumed by WO-6: the router dispatches every verification round through
`runVerification`, which validates orders and reports against the WO-4
registry schemas, replays the integrity nonce, and audits both trees. New or
changed verifier code is ordinary semantic source work (E2/E3 author,
opposite-vendor review); a changed checker fails closed until requalified.
