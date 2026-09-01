# WO-14b leg 2b — the owner-ruled router/roster migration (atomic)

- **Class:** E2 Builder · risk T2 · casting Anthropic Sonnet 5 · high (dense rung — the
  router is dense code with 154 pinned checks). **Tool budget: 80 calls** → `CHECKPOINT`.
- **Branch:** `claude/wo14b-bridge` (already checked out). **Do not commit** — the
  Conductor commits after review. Leg 2a runs in parallel on a disjoint file set; do not
  touch its files.
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 2). Rulings:
  `roster/roster-review-refutations-2026-09-01.md` § Owner rulings;
  `roster/readiness-repair-tranche-2026-09-01.md` § Owner rulings.
- **Law (Band C):** execute the order, the whole order, nothing but the order; blocked
  beats guessed; the report is a claim, not evidence.

## FILES (the only paths you may create, edit or delete)

`router/router.js`, `router/castings.json`, `router/aliases.json`, `router/README.md`,
`registry/schemas/order.schema.json` (add `tier` only), `registry/classes.json` (only
if a class needs a `mergedInto` annotation to satisfy the load cross-check),
`registry/load.js` (only for that cross-check), `roster/lint.js`, `roster/README.md`,
`tests/router.test.js`, `tests/registry.test.js`, and the thirteen roster files listed
in §4 (delete only).

Forbidden: `registry/schemas/dispatch-request.schema.json`, `registry/schemas/
ticket.schema.json`, `router/tickets.js`, `tests/tickets.test.js` (leg 2a); `install.js`,
`hooks/**`, `packs/**`, `quartermaster/**`, `verifier/**` (later legs). Do not change
`reserve.floorFractionOfBucket` (owner: parity accepted). Do not touch the WO-12
tooling or `wo7b/score.js`.

## 1. Stale-family MAJOR (`router/router.js:895`, cycle-2 finding)

A Q0 order created while pools are Green for a human-authored implementation records
`author_family:"anthropic"`; re-dispatched after `AU-all` turns Amber it serves Terra
but still reports `anthropic`. Fix: the Q0 order's `author_family` is the family of
the **served** Q0 casting at every dispatch (after any recast), and
`implementation_author_family` stays the parent's. Pin the exact cycle-2 reproducer
(human author, Green at creation, Amber `AU-all` at re-dispatch → `author_family:
"openai"` with the Terra casting) and the mirror case (anthropic served → `anthropic`).
The `??`/non-string override MINOR is **out of scope** unless the ladder work below
necessarily rewrites the same expression — say so in DEVIATIONS either way.

## 2. Builder ladder (`castings.json` Builder + `cast()`)

Add `tier` to `order.schema.json` (`bounded|standard|dense|deep`, optional) and a
`tiers` table on the Builder role:

    bounded:  preferred Luna · xhigh–max (existing preferredBounded)  → substitutes: Terra · med, Sonnet · med
    standard: preferred Sonnet · med (existing primary)                 → substitutes: Terra · med
    dense:    preferred Sonnet · high (existing dense)                  → substitutes: Terra · high;   override-only: Sol · med
    deep:     preferred Opus 5 · high (absorbs Principal's primary)     → substitutes: none;          override-only: Sol · high

`cast()` for Builder: pick the tier (order `tier`; default by class — see §3 — else
`standard`), start at the preferred casting, walk the substitute list under the bucket
ladder exactly as the mirror walk does today (`recastFrom`/`recastReason` disclosed,
`requested` = the preferred casting), and stop at the first lawful entry. **Override-only
entries are never walked**: they are reachable solely through `castOpts.override =
{rung|model, reason}` from the Conductor, and a Sol override additionally requires
`castOpts.reserveCheck === 'passed'` (a dispatcher-owned flag the Quartermaster sets in
leg 4; absent → typed `FORBIDDEN: Sol override requires the review-reserve check`).
Guardrails carried: `bounded` + `underSpecified` → existing FORBIDDEN; Opus stays behind
`reserveGate`/`preDispatchGate` (P15 + Amber arming) — `deep` at Opus below reserve is
GATED, never silently walked to anything; `deep` with Opus gated and no override →
`WAIT` (as Principal behaves today). Sol-authored mutation keeps its mandatory-review
flag. Keep the existing four rungs resolvable by name for aliases.

## 3. Retirements → merged classes (every class stays a routing label)

Remove these roles from `castings.json`/`charters.json` consumers as **roles** and add a
`mergedClasses` table mapping each class id to its target with a default tier/mode:

    A1 → { workflow: "A1 comparative-plan synthesis under Conductor + both Reviewer lanes + owner" }  — no role; dispatch returns typed RETIRED_WORKFLOW
    N0, N1, N2, M0 → Investigator (mode = the former class id; N0 keeps the read-only pin behavior)
    E0 → Builder · standard      E1 → Builder · bounded     E3 → Builder · deep
    E5 → Builder · standard      E6 → Builder · standard    E8 → Builder · standard (context_shape repo/haystack allowed)
    D0 → Builder · bounded

`dispatch()` on a merged class returns `class` = the requested class id (unchanged —
the class carries its own review row: E3/E4 mandatory etc.), `role` = the target,
`tier` = the default unless the request set one, and `mode` = the former class id.
`registry/load.js`'s castings↔registry cross-check must accept a class that is merged
rather than owned by a role, and refuse a class that is neither (drift still fails
closed). `mandatoryReview.classes` is unchanged (E3, A1, E4, E7 stay mandatory; A1's
row is unreachable and stays as documentation).

`aliases.json`: retarget `executor-heavy` → Builder `deep`; `executor-heavy-xhigh` →
Builder `deep` with a ledgered downgrade note (xhigh point lands on Opus·high);
`executor-codex-heavy` → Builder `deep` with `override: Sol · high` (subject to the
reserve check — resolves to `FORBIDDEN` until leg 4 supplies it; say so in the alias
note); `scout` → Investigator `primary` mode N0; `modeler` → Builder `standard` mode E6;
`plan-synthesizer` → typed `retired-workflow` target with the A1 note. Others unchanged.
Every alias still resolves in both `roster:legacy` and `roster:new`.

## 4. Seat toggles

Add `defaultEnabled` to `castings.json` roles: `Architect: true`, `Sweeper: false`,
everything else `true`. `createRouter({ seats })` accepts an override map (the manifest
supplies it in leg 4). `cast()`/`dispatch()`/`resolveSeat()` on a disabled seat return
`{ ok:false, outcome:'DISABLED', role, reason }` — never a recast. S0 with Sweeper
disabled: the dispatch result carries `fallback: 'verifier-census'` with the
disclosure text (the Conductor's chain-final step falls to the Verifier's census
re-run). A0 with Architect disabled: `fallback: 'conductor-self-plan'`. Pin both.

## 5. File retirements (delete exactly these thirteen — 12 seats, Archivist has two lanes)

    roster/synthesizer.md  roster/scout-anthropic.md  roster/researcher.md  roster/lc-analyst.md
    roster/archivist-documents.md  roster/archivist-images.md  roster/operator.md  roster/runner.md
    roster/principal.md  roster/interface-artisan.md  roster/spatial-specialist.md  roster/refactorer.md
    roster/doc-writer.md

Keep: `conductor.md`, `architect.md`, `builder.md`, `data-engineer.md`,
`investigator.md`, `red-team.md`, `reviewer-anthropic.md`, `reviewer-openai.md`,
`test-designer-vs-anthropic.md`, `test-designer-vs-openai.md`, `sweeper.md` (benched).
`roster/lint.js`: the role-file set is the eleven above; the castings cross-check runs
over roles that exist; merged classes must be declared in `mergedClasses` (lint fails on
a class that is neither owned nor merged); the mirror-or-declared-exception check is
unchanged for surviving roles. Update `builder.md` § Casting to describe the four tiers
and the Sol override rule in one paragraph (the file's own casting line stays Sonnet ·
med, `rung: primary`); update `roster/README.md` and `router/README.md` counts and the
merged-class table. Do not create any new role file.

## 6. Tests

`tests/router.test.js`: every item above pinned — the two stale-family cases; each
tier's preferred casting at Green; each substitute walk at Amber on the preferred
bucket (disclosed); override-only entries never reached by the walk; Sol override
without `reserveCheck` → FORBIDDEN, with it → Sol; `deep` at Opus below reserve →
GATED, no override → WAIT; merged-class dispatch (class preserved, role/tier/mode set,
review row from the class); A1 → RETIRED_WORKFLOW; every alias resolving under both
rosters incl. the downgrade ledger lines; toggles (DISABLED + fallback text; override
map re-enables Sweeper); registry cross-check refusing an unmapped class. Remove or
retarget tests that pinned retired roles' castings (say which in CHANGES). Keep the
existing 154 checks' intent — a removed check must be named and justified.

## Declared verification (run all; paste results)

    node registry/load.js
    node router/router.js
    node tests/registry.test.js
    node tests/router.test.js
    node tests/quartermaster.test.js
    node roster/lint.js && node install.js --lint roster
    node install.js --lint
    node tests/frontmatter-lint.test.js

## Report format

    STATUS: DONE | PARTIAL | BLOCKED | CHECKPOINT
    CHANGES        - <path:line> — one line each (deletions listed explicitly)
    VERIFICATION   - <command> → <actual output lines, especially failures>
    DEVIATIONS     - <or "none">
    CONCERNS       - <or "none">

Never end while a process you started is still running. Do not run `git commit`.
