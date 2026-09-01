# WO-6 — router, casting tables, review matrix, degradation machine, Q0 triggers

The dispatch layer over the WO-4 registry, per
`plans/cross-compare/agent-role-architecture/final-plan.md` (Parts 2, 3.4,
5.5) and its WO-6 order. The registry owns the taxonomy; this directory owns
who runs each class at which rung under which pool state, and the gates that
run before any dispatch.

## Layout

| File | What it is |
|---|---|
| `castings.json` | The Part-2 casting tables (28 rungs across 11 live roles, with the hard never-rules) plus the WO-14b `mergedClasses` table (twelve retired-role classes routed through a surviving role at a default tier/mode, or — A1 — a documented workflow with no role), the §3.4 computed R0 review matrix and mandatory set, the §5.5 pool-state ladder and exhaustion behavior, the seat-19 Q0 automatic triggers, WO-2's measured liveness/reserve numbers, and per-role `defaultEnabled` seat toggles (Architect/Sweeper toggleable; `createRouter({ seats })` overrides) |
| `router.js` | `route(class) → role` · `cast(role, bucket_state) → (vendor, model, effort)` · `reviewer(author_families, risk) → casting` · the pool-state machine · the pre-dispatch AU-O gate (P15) · automatic Q0 creation · the assembled `dispatch()` pipeline |
| `tickets.js` | WO-14b leg 2a — the ticket state machine + JSON-file store that is the only way work is reached under `roster:new` (`registry/schemas/ticket.schema.json`) |

`node router/router.js` loads and cross-checks everything (exit 0/1);
`node tests/router.test.js` is the proof suite — run it for the live check
count (a hardcoded number here went stale within a day; the S0 sweep caught
it).

## Fail-closed loading

`createRouter()` refuses to construct at all when: the registry violates the
WO-4 ownership invariant (loaded through `registry/load.js`); any active
class lacks a casting-table role AND lacks a `mergedClasses` entry, or a
class is claimed by both (drift still fails closed either way); a
`mergedClasses` entry names a role that does not exist, or a tier the role
does not have; a rung's vendor disagrees with its model's family, or its effort is off
the vendor's ladder; a role's own never-rule is violated by any of its rungs
(e.g. Red Team must carry never-Fable). A missing bucket in a `bucket_state`
is an error, never assumed Green.

## WO-14b: merged classes and the Builder ladder

Twelve roles retired 2026-09-01 (readiness-repair tranche, owner rulings) —
their classes stay routing labels, resolved through `castings.json`'s
`mergedClasses` table: `N0/N1/N2/M0 → Investigator` (mode = the former class
id; N0 keeps its read-only pin), `E0/E1/E3/E5/E6/E8/D0 → Builder` at a
default tier (mode = the former class id; E8 additionally widens Builder's
context shapes to repo/haystack), `A1 → no role` — `dispatch()` returns a
typed `RETIRED_WORKFLOW` naming the documented workflow. `dispatch()` on a
merged class returns `class` unchanged, `role` = the target, `tier` = the
default unless the order set one, and `mode` = the former class id.

Builder itself gained a four-tier ladder (`bounded`/`standard`/`dense`/
`deep`) on `cast()`: each tier picks a preferred casting and walks an ordered
cross-vendor substitute list under the bucket ladder (`recastFrom`
disclosed); `deep` absorbs the retired Principal seat's Opus 5 · high
primary rung. Override-only entries (Sol at `dense`/`deep`) are reachable
only through `castOpts.override = {rung|model, reason}`, never walked; a Sol
override additionally requires `castOpts.reserveCheck === 'passed'` — absent,
a typed `FORBIDDEN`.

Seat toggles: `castings.json` roles carry `defaultEnabled` (`Architect: true`,
`Sweeper: false`, everything else `true`); `createRouter({ seats })` accepts
an override map. `cast()`/`dispatch()`/`resolveSeat()` on a disabled seat
return a typed `DISABLED` outcome, never a recast — dispatch of a disabled
Sweeper (S0) carries `fallback: 'verifier-census'`, a disabled Architect (A0)
carries `fallback: 'conductor-self-plan'`, both disclosed.

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
  exceeds the seat's charter (E1 beyond `packet` — `mergedClasses.E1.
  contextShapesOnly`, an exact override that survived the Runner merge —
  N0 handed `haystack`, …) is rejected at dispatch, not truncated. A merged
  class may also carry a declared capability boundary the merge would
  otherwise silently drop: M0's raw video/audio `unavailable` reason
  (`order.medium === 'videoAudio'` OR `castOpts.medium === 'videoAudio'` —
  either triggers; WO-14b leg 2 fix round 2 finding 3 added the
  schema-validated `order.medium`/dispatch-request `medium` field after
  review #2 found the guard unreachable through the public contract with
  only the internal `castOpts.medium` path live), inherited from the retired
  Archivist's `noMirrorFor.videoAudio`.
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
(`createTicketStore({ dir })`) is a single `tickets.json` (materialised state,
carrying an integer `seq` incremented once per committed write) plus an
append-only `tickets.events.jsonl`, and a cross-process advisory lock
DIRECTORY (`tickets.lock/`, `fs.mkdirSync` — atomic AND exclusive on every
platform Node supports, including Windows — carrying an `owner.json`
`{pid, token, at, host}` sidecar, stale after 30s — configurable per store
via `lockStaleMs`) serialises the real callers — separate
`PreToolUse`/`PostToolUse`/`SubagentStop`/`Stop` hook processes. Pure state
machine and store only: no hook or MCP wiring here (a later leg's job).

**Lock takeover is liveness-gated (WO-14b leg 2 fix round 2, finding 1) and
the lock itself is now a directory (fix round 3, review #3, MAJOR:
tickets.js:192).** A stale lock is takeable ONLY when its recorded pid is
provably dead (`process.kill(pid, 0)` throws `ESRCH`, or the pid isn't even a
number) AND the lock is older than `lockStaleMs`; the CAS mechanics (atomic
rename to a tombstone before a fresh acquire) are unchanged in spirit, but a
live holder — however slow — is NEVER displaced. Fix round 3 replaced the
O_EXCL lock FILE with a lock DIRECTORY: exclusivity is now the `mkdirSync`
itself succeeding, and never depends on `owner.json` being present or
parseable. On contention, a missing/unreadable/half-written `owner.json`
folds into a single "unknown holder" case, aged off the lock directory's own
mtime/birthtime instead of a pid — stale by age alone takes it over,
otherwise wait. Review #3's reproducer was exactly this: a holder crashing
mid-way through writing its lock metadata used to make every waiter spin at
the parse-retry forever, never sleeping or checking the budget; every
contention path now funnels through one choke point that always sleeps
(~25ms) and always checks `lockBudgetMs` before looping again, so nothing
can spin. A waiter that exhausts its budget fails closed with a typed
`TicketStoreError` naming which case it hit (live pid *N* / unknown holder).
Because a live holder can never be preempted, the check-to-write race (a
taker writing between a live holder's read and its own write) cannot recur —
only a dead (or provably absent) holder could ever be displaced, and neither
can write. The pre-write lock-token re-check and the pre-commit `seq`
re-check exist only as belt-and-braces assertions now, not the primary
defense.

**Writes are write-ahead; reconciliation is a writer-only, under-lock
operation (finding 2 / fix round 3, review #3, MAJOR: tickets.js:273).**
Every mutation appends its event line(s) to `tickets.events.jsonl` FIRST
(fsync'd, each line carrying the write's new `seq`), then commits
`tickets.json` (temp-file-then-rename). If the append itself fails, nothing
changes and the caller sees a typed `TicketStoreError`. If the process dies
between the append and the commit, the log is left with a seq ahead of the
committed state — but reconciling that gap is now exclusively `withStore()`'s
job, done immediately after it acquires the lock (at which point no other
writer can possibly be in flight, so a logged seq ahead of state.seq is a
genuine crash-orphan, never a race). Fix round 3 moved this out of the
unlocked read path (`readStore()`, used by `get`/`list`/`openTickets`): the
old code reconciled on every load, so a reader racing a genuinely in-flight
writer could misfile that writer's own not-yet-committed event as "dropped"
even though the writer went on to commit it normally — review #3's exact
repro. `readStore()` now only reads and validates; it never writes, and at
most attaches a non-enumerable `pendingEventSeqs` diagnostic (mirrored onto
the caller's `store` object by `get`/`list`/`openTickets`) so an in-flight
tail is observable without ever being misdiagnosed as dropped. When
`withStore()` does find a genuine orphan, it appends ONE `reconcile` line
(naming the dropped seq(s)) BEFORE this write's own event line(s), in the
same fsync'd append, and commits at
`newSeq = max(state.seq, maxOrphanSeq) + 1` — so the log always reads
`[orphan(s)…, reconcile, this-event]` and an orphan seq is never reused by a
real commit. If the lock can't be acquired at all, no reconciliation
happens. **Invariant: the events log is always newline-terminated at the
start of a locked write; a torn tail is closed and recorded as a reconcile
with torn_tail.** Committed seq is monotonic; every seq in the log appears
at most once as a non-orphan; orphans are always followed by a reconcile
marker written under the lock. Typed refusals are logged the same way as
successful transitions, including a `denied` event alongside the `expire`
transition for a launch/resolve that arrives after `expires_at` (finding 3)
— `events [issue, consume, expire, denied]` with `attempts [launch]`, not
just the bare `expire`.

**Fix round 4 (review #4).** A torn JSONL tail (`tickets.js:396`, MAJOR) — a
partial last line left by a writer that crashed or short-wrote mid-append,
no trailing `\n` — used to be silently concatenated onto by the next
append, undocumented. `withStore()` now detects it right after acquiring
the lock and, as part of its own fsync'd append, closes the boundary (a
leading `\n`) and names the fragment on that write's reconcile line as
`data.torn_tail = { bytes, sha256 }`; an unlocked reader sees the same
detection mirrored onto `store.tornTail` (via `get`/`list`/`openTickets`)
without ever repairing it itself. Post-commit lock-ownership loss
(`tickets.js:600`, MINOR) — a confirmed token mismatch discovered at
release, after the mutation already committed — is no longer silently
swallowed: it's recorded on `store.lastLockAnomaly`, and the *next* locked
write logs it as a `lock_anomaly` event (before its own event line) and
clears the flag only once that write itself commits; a caller never sees an
already-committed mutation reported as a failure. The release path also
now best-effort removes a confirmed-foreign lock via the same CAS
tombstone-rename mechanic `acquireLock()` uses, but only when that foreign
owner's pid is provably dead — never while it's alive. Tombstone
accumulation (`tickets.js:318`, MINOR) — a takeover's own best-effort
`rmSync` could leave a `.tomb-*` dir behind forever if it failed — is now
swept on every successful acquisition (best-effort, `.tomb-*` siblings
older than `lockStaleMs`; a fresh tombstone is left alone). NIT: the
unknown-holder timeout message no longer duplicates "for > budget".

## WO-6 defaults where the plan is silent

Marked `unstatedInPlan` in `castings.json`: the E5 critic's effort (high,
matching the E6 critic), Refactorer context shapes (repo+haystack — the
census is the point of the 1M window), Doc Writer context shapes (repo).
Amend the plan to supersede any of these.

Consumed by WO-7b (synthetic corpus through `dispatch()`, scoring misroute
recovery per the restated 7.2 gate) and WO-8–11 (band staffing).
