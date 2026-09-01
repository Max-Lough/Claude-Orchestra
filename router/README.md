# WO-6 — router, casting tables, review matrix, degradation machine, Q0 triggers

The dispatch layer over the WO-4 registry, per
`plans/cross-compare/agent-role-architecture/final-plan.md` (Parts 2, 3.4,
5.5) and its WO-6 order. The registry owns the taxonomy; this directory owns
who runs each class at which rung under which pool state, and the gates that
run before any dispatch.

## Layout

| File | What it is |
|---|---|
| `castings.json` | The Part-2 casting tables (58 rungs across 23 roles, with the hard never-rules), the §3.4 computed R0 review matrix and mandatory set, the §5.5 pool-state ladder and exhaustion behavior, the seat-19 Q0 automatic triggers, and WO-2's measured liveness/reserve numbers |
| `router.js` | `route(class) → role` · `cast(role, bucket_state) → (vendor, model, effort)` · `reviewer(author_families, risk) → casting` · the pool-state machine · the pre-dispatch AU-O gate (P15) · automatic Q0 creation · the assembled `dispatch()` pipeline |
| `tickets.js` | WO-14b leg 2a — the ticket state machine + JSON-file store that is the only way work is reached under `roster:new` (`registry/schemas/ticket.schema.json`) |

`node router/router.js` loads and cross-checks everything (exit 0/1);
`node tests/router.test.js` is the proof suite — run it for the live check
count (a hardcoded number here went stale within a day; the S0 sweep caught
it).

## Fail-closed loading

`createRouter()` refuses to construct at all when: the registry violates the
WO-4 ownership invariant (loaded through `registry/load.js`); any active
class lacks a casting-table role, or a role claims a class the registry gives
someone else; a rung's vendor disagrees with its model's family, or its
effort is off the vendor's ladder; a role's own never-rule is violated by any
of its rungs (e.g. Red Team must carry never-Fable). A missing bucket in a
`bucket_state` is an error, never assumed Green.

## The structural guarantees (WO-6 unit proof)

- **No-self-family:** `reviewer()` computes `family(reviewer) ∉
  families(author + co-authors)` from the full recorded set; a same-family
  return is a thrown error, not a value. Unattributed or both-family
  authorship fails closed (both families concur, or a named human).
- **Mandatory never closes same-family:** under every bucket-state
  combination including Red/Exhausted, a mandatory-class review either
  returns a cross-family casting with pool room or a typed `DOES_NOT_CLOSE`
  (wait / named human / park `HOLD`). The preferred band alone may take the
  disclosed degraded path (`review_cross_family = false`, dispatcher-set).
- **Context shapes are dispatcher-enforced:** an order whose `context_shape`
  exceeds the seat's charter (Runner beyond `packet`, Scout handed
  `haystack`, …) is rejected at dispatch, not truncated.
- **Every rung yields its documented casting set:** the test suite carries an
  independent transcription of Part 2 and diffs `cast()` against it, both
  directions (no missing rung, no undocumented rung).
- **Every trigger-matching implementation spawns Q0:** class triggers
  (E3/E4/E7 at any tier), tier triggers (every T2/T3 source change), touch
  triggers (auth/authz/concurrency/persistent-data/public-API at any tier),
  and the deterministic 25% T1 calibration sample. The companion is
  Director-created, cast opposite the family that will author the
  implementation; a missing required Q0 blocks the dispatch.

## Semantics worth knowing

- **Pool-state machine (§5.5):** Green ≥40%, Amber 20–40%, Orange 8–20%, Red
  <8% — with reserve breach or an observed throttle forcing Red regardless of
  fraction, and `Exhausted` past that. Amber re-casts authoring to the
  healthy pool's mirror (review is the last thing to sacrifice); Orange
  suspends authoring on the bucket and defers ceiling rungs (AU-fable stops
  first); Red permits only closing calls. Declared no-mirror halves — E4's
  irreversible T2/T3 work, M0 raw video/audio — wait or return typed
  `UNAVAILABLE`; pool pressure changes *when*, never *who*.
- **Pre-dispatch AU-O gate (P15):** AU-opus predicted below reserve → no Opus
  casting dispatches; lawful responses are mirror or wait, and the Conductor
  only chooses between them. Below 40% AU-opus the gate arms: Opus dispatch
  needs Quartermaster confirmation. The AU-fable twin re-casts Conductor
  turns to the Sol mirror.
- **Mandatory review rides the frontier lane:** at mandatory class the matrix
  uses the T2/T3 row even for nominal-T1 work (a Sol-authored mutation is
  reviewed by Opus 5 · high, per Part 2); the qualified-Terra and Sonnet T1
  rows serve the preferred band. The Terra T1 relief lane stays behind
  `reviewMatrix.terraT1Qualified` (false until WO-12f).
- **Q0 vs a human-authored implementation** takes whichever pool is
  healthier, tie → the Anthropic lane (protects the OpenAI review reserve).
- **Dispatch owns risk and the nonce:** `dispatch()` normalizes the order's
  risk tier onto the order (whitespace/case only; anything unrecognizable is
  refused at the door) and MINTS `integrity_nonce` itself — the Q0
  calibration draw is keyed on it, so a caller-chosen nonce never decides the
  sample. The returned result carries the minted order; ledger from that.
- **`touches` lives on the order** (schema-typed enum, linted at load against
  the trigger lists); caller flags may only add areas, never remove one.
- **`resolveSeat()` buries its gate in the target:** for a new-roster alias
  the pre-dispatch gate outcome lives at `target.cast.ok` / `target.gate` —
  there is no top-level `ok` on a seat resolution. `dispatch()` surfaces
  gates at the top level; seat resolution intentionally does not.

## `tickets.js`: the lifecycle a dispatch actually spawns under

`dispatch()` computes a casting; `tickets.js` is the separate, later-consumed
record of the spawn itself, built from leg-1's measured host facts (the Agent
tool is async — `PostToolUse(Agent)` binds `agentId`/`resolvedModel` before
the subagent has run, the result arrives later at `SubagentStop`). States:
`OPEN → CONSUMED (PreToolUse) → LAUNCHED (PostToolUse) → RESOLVED
(SubagentStop) → CLOSED | NOT_CLOSED`, plus `EXPIRED` (past `expires_at`, e.g.
a killed subagent that never reached `SubagentStop`) and `INVALIDATED`
(`bumpGeneration()` — the `roster:new → legacy` rollback hook, which moves
every non-terminal ticket off the board at once). Every refused transition
throws a typed `TicketTransitionError` and is still logged to the ticket's
`attempts` (or the store's `unknown_attempts` for a forged id); the module
enforces one-use, role match, store-generation match, and — for an
implementation ticket carrying a `q0_ticket` — that Q0 has at least
`LAUNCHED` before the implementation may spawn. The store
(`createTicketStore({ dir })`) is a single `tickets.json` (materialised state)
plus an append-only `tickets.events.jsonl`; writes are atomic
(temp-file-then-rename) and a cross-process advisory lock (`tickets.lock`,
stale after 10s) serialises the real callers — separate
`PreToolUse`/`PostToolUse`/`SubagentStop`/`Stop` hook processes. Pure state
machine and store only: no hook or MCP wiring here (a later leg's job).

## WO-6 defaults where the plan is silent

Marked `unstatedInPlan` in `castings.json`: the E5 critic's effort (high,
matching the E6 critic), Refactorer context shapes (repo+haystack — the
census is the point of the 1M window), Doc Writer context shapes (repo).
Amend the plan to supersede any of these.

Consumed by WO-7b (synthetic corpus through `dispatch()`, scoring misroute
recovery per the restated 7.2 gate) and WO-8–11 (band staffing).
