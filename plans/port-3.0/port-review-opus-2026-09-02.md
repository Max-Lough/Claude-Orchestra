# Port review — independent (Opus 5, max effort), 2026-09-02

Scope: judge the Sol oracle's KEEP/PORT/DELETE table (`plans/port-3.0/harness-value-oracle-2026-09-02.md:37-51`),
design the minimum viable port against the owner's five requirements, and say what it costs.
Read-only review; the only file written is this one.

Three standing instructions from the owner shaped this:
1. "Strip it down as much as possible" is a **desire, not a mandate** — fight for keeps with evidence.
2. Weigh every piece against **where frontier models are heading over the next year**, not only
   today's ledger. Note explicitly where that trend changed a disposition and where it did not.
3. Telemetry for performance monitoring is the owner's stated priority.

---

## VERDICT

**Do the port. The oracle's table is directionally right and mechanically wrong in five places.**

The single most important fact in this review, and the one the oracle's table does not surface:

> **The cross-vendor runners have zero coupling to the 2.0 control plane.**
> `grep -c "ticket\|TICKET"` returns **0** for `packs/codex/hooks/orchestra-exec.js`,
> **0** for `packs/codex/hooks/orchestra-crossplan.js`, and **0 functional hits** for
> `packs/codex/hooks/orchestra-review.js` (its two hits are comments at
> `orchestra-review.js:291` and `:1864`).

The oracle's PORT row says to "remove ticket dispatch, close, pool, and class dependencies" from
those three files (`harness-value-oracle-2026-09-02.md:40`). There are none to remove. All of it
lives one layer up, in `packs/codex/hooks/orchestra-engine-mcp.js`, in a self-contained gate that
is **already inert under legacy** — `orchestra-engine-mcp.js:217` returns `{ok:true}` and skips
every ticket check whenever `manifest.roster !== 'new'`.

That changes the character of the whole job. This is not a port. It is a **delete**, plus about
120 lines of markdown. Every line of the surviving harness already exists, already ships, and
already runs green under `roster: "legacy"` today. Port 1 should contain **zero new logic** — that
constraint is the single best defence against repeating the last two weeks, and it decides several
rows below.

**Size:** 17,865 lines of 2.0 JavaScript → **~7,930 lines**, a 56% cut, of which ~5,900 is the
cross-vendor pack the owner explicitly wants. Add ~9,000 lines of deleted tests, ~600–900 lines out
of `install.js`, and 476 lines of `tools/`. Total repo reduction ≈ **20,000 lines**.

**Where I disagree with the Sol oracle** (detail in TABLE REVIEW):

| # | Oracle | Me | Core reason |
|---|---|---|---|
| 1 | PORT `verifier/*.js` | **DELETE** | 1,538 lines that silently drag `registry/load.js` (`verifier/verifier.js:65`) and duplicate four checks the review runner already performs in the lane that matters. |
| 2 | PORT `bridge/manifest.js` | **DELETE outright** | All 462 lines exist to defeat tamper of the `roster:new` activation flag (`bridge/manifest.js:1-40`). No gate → nothing to protect. The oracle's replacement is *new* code, not a port. |
| 3 | PORT `bridge/telemetry.js` + `tools/orchestra-ledger-report.js` | **DELETE both; ship no telemetry code in port 1** | `telemetry.js:46-48` is ticket-keyed by construction and `telemetry.js:30-31` requires 1,538 lines of verifier to write two JSON files. `orchestra-ledger-report.js:11-14` joins on a ticket store that will not exist. See TELEMETRY. |
| 4 | DELETE `packs/codex/hooks/orchestra-crossplan.js` | **KEEP unchanged** | Zero coupling to anything; deleting it breaks 4 of 9 waves of a skill the owner said stays as-is (`packs/codex/skills/cross-compare-plan/SKILL.md:29,31,32,38`). Carrying cost is literally zero. |
| 5 | KEEP the five legacy agents | **Six, not five** | `agents/executor-heavy-xhigh.md` is a real sixth file, installed by `install.js:80-87`. The oracle's KEEP row omits it. |

Two things the oracle's table is **silent on** that dominate the actual work:
`install.js` (3,613 lines, 383 of which touch roster/pin/substrate/store machinery) and
`tests/` (~9,000 deletable lines). Both are named in MINIMUM VIABLE PORT.

And one live defect against the owner's requirement #1 that neither the oracle nor the brief caught:
**the third GPT-5.6 model is Luna (`gpt-5.6-luna`), and it is unreachable from the Claude-side
harness today** — see the model paragraph in MINIMUM VIABLE PORT.

---

## TABLE REVIEW

Row by row against `harness-value-oracle-2026-09-02.md:37-51`.

### Row 1 — KEEP: `ORCHESTRA.md`, the legacy agents, `skills/`

**Agree on the files. Two corrections and one trend-driven addition.**

**Correction A — the agent list is short by one.** The oracle names five agent files. The installer
installs six (`install.js:80-87`): `scout.md`, `detective.md`, `executor.md`, `executor-heavy.md`,
**`executor-heavy-xhigh.md`**, `reviewer.md`. It is a genuine sixth: same law, differing only by
`effort: xhigh` in frontmatter (`agents/executor-heavy-xhigh.md:6-7` vs
`agents/executor-heavy.md:6-7`), and `ORCHESTRA.md:109` makes it a PLAN-time routing point rather
than an escalation rung. Owner requirement #2 asks for it explicitly; keep it. 58 lines, zero
carrying cost.

*Trend note:* the trend argues against three Claude execution tiers — Sonnet 5 / Opus 5·high /
Opus 5·xhigh is a distinction that flattens with each release, and `ORCHESTRA.md:109` already
concedes "if most orders are routing heavy, the sizing law is failing." I would **not** act on that
now (the owner asked for the file, and it costs nothing), but flag it as the first candidate for a
later trim.

**Correction B — "remove 2.0-only instructions when porting" is a four-line job, not a project.**
Grep of `ORCHESTRA.md` for every 2.0 token (`roster: "new"`, `TICKET=`, `orchestra_dispatch`,
`orchestra_close`, `ticket gate`, `Conductor`) hits exactly **lines 13, 14, 15 and 55**. Line 14 is
the whole `roster: "new"` mode bullet; line 15 is the `roster: "legacy"` dormancy bullet (which
survives, with the "legacy" qualifier dropped); line 55's clause is one parenthetical inside §3.4.
Nothing else in the file is 2.0.

The **six agent files are already clean** — grep for the same tokens across `agents/*.md` returns
one hit, and it is the substring "class" inside "outclass" at `agents/executor-heavy.md:10`. The
oracle's row implies work here; there is none.

**Skills are clean too.** `skills/orchestra-plan`, `orchestra-review`, `orchestra-status` and
`packs/codex/skills/cross-compare-plan` reference only `.claude/orchestra.json` `reviewEngine`
(`skills/orchestra-plan/SKILL.md:21`, `:58`) and the runner CLI. **One hard dependency exists**:
`cross-compare-plan/SKILL.md:11` names `node .claude/hooks/orchestra-crossplan.js --phase …`
literally, and waves at `:29`, `:31`, `:32`, `:38` dispatch `architect-codex` into that runner.
That is the reason row 11 below flips.

**Trend-driven addition the oracle does not make: `ORCHESTRA.md` itself should be trimmed.**
It is 127 lines but 37,677 bytes — roughly 5,900 words of dense prose. §8 alone (lines 97-127) is
~40% of it: seven sizing rules, four cadence rules, five verification-tax rules. Much of that is
handholding a 2026 frontier Director does unprompted — §8.1.4 "chain where links fan out",
§8.1.6 "tools refuse to emit garbage", §8.2.3 "checkpoints are externalized memory". Anthropic's
own guidance on trimming CLAUDE.md as models ship applies directly. **Trend changed this
disposition** from the oracle's flat KEEP to *keep, then cut §8 by roughly two-thirds in a
follow-up*. Three parts of §8 must survive verbatim because they are machine-read or are policy
rather than advice: §8.3.2 (TIER: inert — the review runner enforces it, `orchestra-review.js:228`,
`:1736-1754`), §8.3.3 (the `verification` manifest — injected into both briefs at
`orchestra-exec.js:645-668` and `orchestra-review.js:1832-1855`), and §8.3.5 (the `ledger.md`
duty, which becomes load-bearing under TELEMETRY below).

**Verdict: KEEP, six agents not five, strip 4 lines from `ORCHESTRA.md` now, trim §8 later.**

### Row 2 — PORT: `orchestra-review.js`, `orchestra-exec.js`, reduced `orchestra-engine-mcp.js`

**Agree with the disposition; the rationale is wrong and understates how easy this is.**

`orchestra-exec.js` (1,492 lines): **0 lines of 2.0 coupling.** Its `RUN_NONCE`
(`orchestra-exec.js:165`) is runner-local `crypto.randomBytes(8)`, never registered anywhere. The
only deletions are a doc comment at `:185-186`. **1,492 → 1,490.**

`orchestra-review.js` (3,134 lines): **54 lines of coupling**, all in one place — the verdict-JSON
dictation block that exists to feed `bridge/close.js`: `dictatedServedModel()` at `:1857-1868`,
`verdictJsonInstructionLines()` at `:1870-1901`, its splice at `:1975`, the `RUN_NONCE` const and
its `bridge/close.js` comment at `:286-293`, and the header line at `:2429`. **3,134 → ~3,080.**

`orchestra-engine-mcp.js` (1,265 lines): this is where all of it lives, and it comes out in whole
blocks — bridge loaders and the ticket gate `:57-241`, the dispatch-request schema loader
`:242-267`, `extractRunNonce`/`extractReportedModel` `:369-389`, `bindTicket()` `:597-670`, the
`orchestra_dispatch` tool `:1076-1103`, the `orchestra_close` tool `:1104-1141`, the doctor's bridge
branch `:1168-1179`, the roster refusals at `:1048-1051` and `:1162-1165`, and the `ticket`/`role`
schema params and call sites at `:900-901`, `:928`, `:942`, `:965-966`, `:993`, `:1014`.
≈412 lines. **1,265 → ~850**, with zero remaining reference to `bridge/`, `router/`, `registry/`
or `quartermaster/`.

**Is this beneficial for frontier models, or complexity a good prompt covers?** It is beneficial,
and the trend does **not** weaken it — this is the clearest case in the review of mechanism
supplying facts a model *cannot honestly attest about itself*:

- **TREE AUDIT** (`orchestra-exec.js:579-623`, `:1000-1051`, `:1367-1376`) measures which paths
  actually changed. A model reporting its own diff is self-attestation; a before/after fingerprint
  is measurement. No prompt substitutes.
- **REPORT INTEGRITY nonce echo** (`orchestra-exec.js:165`, `:737-744`, `:1419`) plus the
  report-vs-audit contradiction check (`:1445-1466`) catch a replayed or resumed report — the
  2026-08-19 field incident named at `orchestra-exec.js:50-53`. Smarter models do not make stale
  buffers impossible.
- **Pinned throwaway worktree** (`orchestra-review.js:1142-1164`, teardown `:1165-1210`) reviews a
  commit rather than a working tree carrying three orders' churn. This gets *more* valuable as
  sessions get longer, not less.
- **Vendor decorrelation** is the whole point of the pack, and correlated blind spots within a
  training lineage do not shrink as models improve — if anything, converging corpora make
  cross-family review more valuable over the next year, not less.

**Is there an even smaller thing?** For the runners, no: the subagent analysis puts the
"bare mechanism" residue at ~400 lines for each runner, but reaching it means deleting the Codex
install-repair section (`orchestra-review.js:1266-1640`, 375 lines), the auth probe, the git-config
LFS rescue (`:713-739`), and the retry chain. Those exist because of *recorded field failures* —
`packs/codex/pack.json` notes the Windows helper-sibling defect makes "BOTH lanes return nothing
while looking healthy." Deleting robustness that was bought with real incidents to satisfy a line
count is exactly the wrong trade. **Keep the runners byte-for-byte apart from the 56 lines named.**

**Verdict: KEEP (not "port"). Delete 56 lines across two runners, 412 from the MCP server.**

### Row 3 — PORT: `verifier/verifier.js`, `checkout.js`, `schema-check.js`

**DISAGREE. Delete all 1,538 lines in port 1.**

Four reasons, in descending weight:

1. **It is not self-contained, and the oracle's own table deletes its dependency.**
   `verifier/verifier.js:65` requires `registry/load.js` — a file the oracle DELETEs in row 8. So
   "port the verifier" quietly means porting `registry/load.js` (304 lines) plus the schema set,
   which is precisely the taxonomy machinery the oracle correctly wants gone.
2. **It duplicates checks the review runner already performs, in the lane where they matter.**
   Disposable pinned checkout: `verifier/checkout.js` ≡ `orchestra-review.js:1142-1210`. Before/after
   tree fingerprint with generated-artifact classification: `verifier/README.md:12` ≡
   `orchestra-review.js:1687-1732` / `orchestra-exec.js:579-623` (same allowlist,
   `orchestra-exec.js:41-44`). Manifest execution and exit-code capture: `verifier/README.md:16` ≡
   the manifest injection at `orchestra-exec.js:645-668`. Nonce echo: `verifier/README.md:16` ≡
   `orchestra-exec.js:1419`. A solo developer does not need two separately-maintained
   implementations of the same four facts, one of which must be invoked by hand.
3. **Its unique checks are its weakest.** What survives the overlap is the mutation check and the
   invariant comparison. Both require the developer to author invariants and oracle declarations
   up front — exactly the kind of ceremony the port exists to remove — and its own README concedes
   the escape hatch: `COVERAGE_GAP` "forces model review" (`verifier/README.md:24-26`). If the
   answer is "model review anyway", pay for model review directly.
4. **It was never cheap to keep honest.** The verifier/router tranche needed nine sequential
   cross-vendor verdict rounds before approval (`harness-value-oracle-2026-09-02.md:25`, citing
   `roster/r0-ex3-verdict.md` through `r0-ex11-verdict.md`). That is the maintenance signature of
   a subsystem, not a utility.

*Trend note:* **the trend reinforces this delete.** The deterministic-adjudication layer exists to
compensate for models that mis-report their own verification. That is the failure mode that has
improved fastest, and the cheapest verification for a frontier agent is running the suite — which
the executor and the reviewer already do twice by design (`ORCHESTRA.md:120`).

**Where I would fight, and lose on balance:** `verifier/checkout.js` (461 lines) has **no external
requires** and exports `guardTree`, which fingerprints the *real* tree across an agent's run. The
Claude executor lane has no equivalent — the codex lane gets TREE AUDIT in-process and the Sonnet
`executor` gets nothing. That is a genuine asymmetry and I want to name it honestly. But the same
fact is obtainable for free by a scout running `git status --porcelain` after the order, and the
Director already has that habit. **461 lines plus a new invocation path is not worth it. Note the
asymmetry in `ORCHESTRA.md` in one sentence instead.**

**Verdict: DELETE `verifier/` entirely. Recoverable from the `v2.5.0-final` tag if the owner
disagrees after a month of use; `checkout.js` is the piece to resurrect.**

### Row 4 — PORT: `bridge/telemetry.js`, `tools/orchestra-ledger-report.js`, four schemas

**DISAGREE. Delete both; ship no telemetry code in port 1.** Full argument in TELEMETRY below.
Summary: `bridge/telemetry.js:46-48` keys every record by ticket id; it is called only by
`bridge/close.js` (`telemetry.js:9-10`); and `telemetry.js:30-31` requires
`verifier/schema-check.js` **and** `verifier/verifier.js` to write two JSON files. Porting 115 lines
of writer therefore means porting 1,538 lines of verifier. `tools/orchestra-ledger-report.js:11-14`
joins on `orchestra/tickets/tickets.json`, which will not exist.

### Row 5 — PORT: `bridge/manifest.js` as a "small install receipt"

**DISAGREE with the framing, agree with the outcome being small.**

All 462 lines exist for one purpose, stated in the file's own header
(`bridge/manifest.js:1-40`): defeat tampering with `.claude/orchestra.json`'s `roster` field so the
ticket gate cannot be turned off. Three pin-key schemes (path, projectId, git root
— `manifest.js:210-240`), strict pin-shape validation (`:177-190`), and a trust table
(`bridge/README.md:405+`) all serve an activation state that is being deleted. **Nothing survives
the port; this is a DELETE, not a PORT.**

The oracle's proposed replacement — "a small install receipt containing harness version and content
hash, checked once by a doctor/session-start command" — is **new code**, which violates the
zero-new-logic rule for port 1. It is also unnecessary: `install.js` already writes
`installedFiles`/`installedPermissions`/`installedDeny` to `.claude/orchestra.json` for uninstall
bookkeeping (`install.js:2965-2968`), and `/orchestra-status` already reports harness state via a
scout (`skills/orchestra-status/SKILL.md:8,14`). If the owner wants a version stamp, it is **one
key** — `"version": "3.0.0"` — written by the installer and read by the status skill. Three lines,
not 462, and not a doctor.

**Verdict: DELETE. Add a `version` key to `.claude/orchestra.json`; delete `~/.claude/orchestra/pins/`
as a concept.**

### Row 6 — PORT: `hooks/orchestra-guard.js`, legacy rule only

**Agree, and I want to fight for it explicitly, because the oracle hedges ("if that guard has
proven reliable") and the trend argument cuts toward deleting it.**

**The guard earns its place, and the trend does not weaken it.** ORCHESTRA.md §3.1's
"You never touch the code" is a prompt-level rule, and prompt-level rules erode under pressure in
long sessions — precisely when a Director is closest to a fix and most tempted. Smarter models are
not *differently-permissioned* models; a more capable Director is, if anything, *more* likely to
helpfully do the edit itself because it can. The guard converts that from a regret into a denial
the model can route around correctly — `ORCHESTRA.md:52` already teaches "a hook denial is the
system working, not an obstacle."

It also carries two things the protocol *references as facts*, which become lies if the guard goes:
- the `<!-- ORCHESTRA:BEGIN/END -->` block protection (`orchestra-guard.js:1293-1328`,
  `:431-443`) that `ORCHESTRA.md:52` promises;
- the **user-only pause switch** (`orchestra-guard.js:1143-1234`, `:465-475`) that all of
  `ORCHESTRA.md:84` §6 depends on. Delete the guard and §6 describes a switch that switches nothing.

**Strip:** ~456 lines of 2.0 — `rosterFromArgv()` `:314-320`, `denyMalformedInput()` `:403-416`,
`denyGateNotRegistered()` `:500-513`, `denyNestedSpawn()` `:515-526`, the entire pin section
`:654-822`, the roster:new branch of `loadPolicy()` `:894-916`, the Agent gate `:1405-1461`, the
`main()` branches at `:1484-1487`, `:1531-1544`, `:1583-1589`, the fail-closed catch `:1622-1634`,
and the two header sections `:12-74` and `:173-196`. **1,637 → ~1,180.**

**Is ~1,180 lines "as small as possible"?** No, and I will say where the rest is: the
symlink/hardlink containment hardening (`:1036-1139`, `:450-461`), the Windows pause-name aliasing
(`:1172-1179`), and the corrupt-transcript grace window (`:390-401`, `:949-1034`). Those were
written under adversarial red-team review against a *hostile* threat model that a solo developer on
their own machine does not have. A ~400-line guard is achievable. **But that is a rewrite of
security-relevant code, and port 1 must contain zero new logic.** Recommend it as a scoped
follow-up work order, not part of the port.

**Verdict: KEEP. Delete 456 lines mechanically. Revisit the remaining 1,180 as a separate order.**

### Row 7 — DELETE: `bridge/runtime.js`, `close.js`, `cli.js`, `hooks/ticket-gate.js`

**Agree without reservation.** 2,248 lines implementing the dispatch/Agent/close state machine.
`bridge/runtime.js:39-45` and `bridge/close.js:54-61` are the two files that pull the entire
control plane into one graph — router, tickets, quartermaster, verifier, schema-check, checkout,
manifest, telemetry. They are the keystone; removing them makes everything else in rows 7-10 fall
out on its own. Add `bridge/manifest.js` (462) and `bridge/telemetry.js` (115) per rows 4-5:
**2,825 lines.**

### Row 8 — DELETE: `router/`, `registry/`

**Agree.** `router/router.js` (1,433) + `router/tickets.js` (1,549) + `registry/load.js` (304) =
3,286 lines plus the JSON. The evidence against the taxonomy is the oracle's strongest finding and
I have nothing to add: four blinded classification rounds at 31/40, 17/20, 16/20, 14/20 with every
formal gate failed (`harness-value-oracle-2026-09-02.md:17`), followed by twelve of twenty-three
roles being retired (`router/README.md:34-60`). *Trend note:* the trend makes this a landslide —
a 23-class taxonomy is exactly the scaffolding that a model choosing "investigate, build, or review"
from a short protocol renders obsolete.

**One correction the oracle misses:** the retained `verdict.schema.json` and `report.schema.json`
have no reader once `bridge/close.js` and `verifier.js` are gone. Delete **all eight** schemas in
`registry/schemas/`, not four. The verdict *format* survives as prose in
`packs/codex/agents/reviewer-codex.md` and the runner's own dictation, which is where it belongs.

### Row 9 — DELETE: `quartermaster/`

**Agree emphatically, and it is the easiest call in the table.** Its own README concedes the
telemetry cannot attribute usage by role/effort/vendor/bucket and does not capture OpenAI
consumption (`quartermaster/README.md:79-100`), the forecast can rest on two points
(`:347-370`), and readings are recorded manually (`:428-475`). Its only inbound edge is
`quartermaster/quartermaster.js:96` → `router/router.js`, which is also going. A manual number
that can fail closed at dispatch is strictly worse than a Director reading the platform's own usage
display. **1,359 lines.**

### Row 10 — DELETE: `packs/codex/hooks/orchestra-crossplan.js`

**DISAGREE. Keep it unchanged.**

1. **It has no coupling to anything.** The file requires only `fs`, `os`, `path`, `crypto`,
   `child_process` (`orchestra-crossplan.js:75-79`). No reference to bridge, runtime, tickets,
   roster, router, registry, quartermaster or dispatch exists anywhere in its 1,329 lines. Its
   *only* 2.0 touchpoint is a four-line refusal in the MCP wrapper
   (`orchestra-engine-mcp.js:1048-1051`), which is being deleted anyway. Run from a shell it works
   identically under both rosters today.
2. **Deleting it violates owner requirement #5.** The owner said the skills stay as they are.
   `packs/codex/skills/cross-compare-plan/SKILL.md` hard-depends on this runner in four of nine
   waves (`:29`, `:31`, `:32`, `:38`), names the script by literal path at `:11`, and keys its
   failure contract on the runner's own `STATUS: CROSSPLAN_UNAVAILABLE` sentinel (`:42`, emitted at
   `orchestra-crossplan.js:840-869`). Delete the runner and the skill loses its GPT lane, which is
   the entire reason it is a *cross*-compare.
3. **The oracle's rationale does not apply to this lane.** "A Director can explicitly ask two agents
   for competing plans" is true for the Claude lane and false for the GPT lane — the read-only
   `codex exec` sandbox, the anonymity contract (`orchestra-crossplan.js:500-522`), the nonce
   integrity check and the web-search symmetry exist only in this runner.
4. **Carrying cost is zero.** One file, invoked only by an explicit skill, referenced by nothing
   else. Deleting it costs a working feature; keeping it costs nothing.

*Trend note:* the trend is **neutral to positive** here. Two frontier models drafting independently
and cross-critiquing is a technique that gets better as the models get better, not one that
capability makes redundant.

**Verdict: KEEP unchanged (1,329 lines). Drop the 4-line roster refusal in the wrapper only.**

### Row 11 — DELETE: the twelve `roster/*.md` role profiles

**Agree, and the deletion is bigger than twelve files.**

`install.js` does not carry a hardcoded list — `rosterRoleFiles()` (`install.js:103-113`)
classifies *dynamically*: any `.md` in `roster/` that is not `README.md`/`EXERCISES.md` and does not
match the record-doc regex at `install.js:102` is treated as an installable agent profile. That
classifier is running right now and would install **thirteen** files, because
`plans/port-3.0/harness-value-oracle-2026-09-02.md` does not match the regex — it is a genuine (if benign)
latent bug, and this report's own filename has the same shape.

So the delete must also remove: `rosterRoleFiles()` and its constants (`install.js:92-119`), the
collision assertion (`:2358-2381`), the roster install block (`:2442-2491`), and
**`roster/lint.js` (229 lines)** — a runtime file the oracle's table omits entirely. Historical
records (`roster/wo*`, `roster/r0-*`, `roster/*-verdict.md`, this file) stay as project records,
which the oracle rightly says.

---

## DEPENDENCY MAP

Every `require()` edge among the candidate files (from a grep of all 2.0 JS, excluding stdlib):

```
bridge/runtime.js  ──►  router/tickets.js            (runtime.js:39)
                   ──►  router/router.js             (runtime.js:40)
                   ──►  quartermaster/quartermaster.js (runtime.js:41)
                   ──►  verifier/schema-check.js     (runtime.js:42)
                   ──►  bridge/manifest.js           (runtime.js:43)
                   ──►  bridge/close.js              (runtime.js:44)
                   ──►  bridge/telemetry.js          (runtime.js:45)

bridge/close.js    ──►  router/tickets.js, router/router.js,
                        quartermaster/quartermaster.js,
                        verifier/schema-check.js, verifier/verifier.js,
                        verifier/checkout.js, bridge/manifest.js,
                        bridge/telemetry.js          (close.js:54-61)

bridge/cli.js      ──►  bridge/runtime.js            (cli.js:29)
bridge/hooks/ticket-gate.js ──► bridge/runtime.js    (ticket-gate.js:69)

bridge/telemetry.js ─►  verifier/schema-check.js     (telemetry.js:30)
                    ─►  verifier/verifier.js         (telemetry.js:31)   ★
verifier/verifier.js ─► verifier/checkout.js, verifier/schema-check.js (verifier.js:63-64)
                     ─► registry/load.js             (verifier.js:65)    ★
router/router.js     ─► registry/load.js             (router.js:121)
router/tickets.js    ─► verifier/schema-check.js     (tickets.js:210)
quartermaster/…      ─► router/router.js             (quartermaster.js:96)

packs/codex/hooks/orchestra-engine-mcp.js
   ──► dynamic require: .claude/orchestra/bridge/runtime.js | bridge/runtime.js  (:64-74)
   ──► dynamic require: bridge/manifest.js                                        (:79-89)
   ──► reads registry/schemas/dispatch-request.schema.json                        (:248-258)

packs/codex/hooks/orchestra-exec.js       ── no non-stdlib requires
packs/codex/hooks/orchestra-review.js     ── no non-stdlib requires
packs/codex/hooks/orchestra-crossplan.js  ── no non-stdlib requires
hooks/orchestra-guard.js                  ── no non-stdlib requires
tools/orchestra-ledger-report.js          ── no non-stdlib requires (file-format coupling only)
```

★ = the two edges that make the oracle's PORT rows expensive.

**Cost of the two star edges, stated plainly:**
- Porting `bridge/telemetry.js` (115 lines) drags `verifier/schema-check.js` (170) +
  `verifier/verifier.js` (907) + `verifier/checkout.js` (461, via `verifier.js:63`) +
  `registry/load.js` (304, via `verifier.js:65`) + 4 schema files = **1,957 lines to write two
  JSON files**, and the JSON files are keyed by a ticket id that will not exist.
- Porting `verifier/*.js` drags `registry/load.js` and the schema set — a row the oracle deletes.

**Non-require coupling (config keys, file formats, ticket fields):**

| Consumer | Coupling | Cost of removal |
|---|---|---|
| `orchestra-engine-mcp.js:217` | `manifest.roster !== 'new'` short-circuit | none — it is the delete boundary; everything above it goes, everything below is legacy |
| `orchestra-engine-mcp.js:900-901`, `:965-966` | `ticket`/`role` MCP input-schema params | 4 lines; both marked "Ignored under legacy" in their own descriptions |
| `orchestra-engine-mcp.js:1003-1004` | model/effort sourced from ticket casting | reverts to `callerModel`/`callerEffort` already computed at `:980-981` — 2 lines |
| `orchestra-engine-mcp.js:391-421` | `CODEX_MODEL_IDS` / `CODEX_EFFORTS` normalisers | **keep** — they normalise caller-supplied `model`/`effort` and are the fix for the 2026-09-02 `med`→`medium` and display-name defects |
| `orchestra-review.js:1870-1901` | dictates `run_nonce`, `served_model`, `review.cross_family` into verdict JSON for `bridge/close.js` | 32 lines; the human-readable `VERDICT:` line and findings are unaffected |
| `orchestra-guard.js:852-878` | reads `.claude/orchestra.json` `seats`, `rosterGeneration`, `projectId` | 3 keys; `directorBlockedPatterns`/`AllowedTools`/`PlanPatterns`/`MemoryPatterns` at `:872,:886,:888,:893` all stay |
| `tools/orchestra-ledger-report.js:11-14` | reads `orchestra/tickets/tickets.json`, `tickets.events.jsonl`, `routing.events.jsonl`, `ledger/<id>/*.json` | total — no join key survives |
| `packs/codex/skills/cross-compare-plan/SKILL.md:11,29,31,32,38` | `orchestra-crossplan.js` | **do not remove** (row 10) |
| `install.js` | 383 lines mention roster/pin/substrate/store/conductor | see below |
| `tests/` | 8 suites test only deleted code | ~8,266 lines deleted outright |

**One stale-comment defect found while mapping** (worth a one-line fix, not a blocker):
`orchestra-engine-mcp.js:376-381` asserts that `orchestra-review.js` "deliberately prints NO run
nonce". That is false as of `orchestra-review.js:2429`. The regex at `:383` matches
`REVIEW RUN NONCE:` anyway, so behaviour is accidentally correct. Both lines are inside blocks
being deleted, so the port resolves it.

---

## MINIMUM VIABLE PORT

Guiding constraint: **port 1 contains zero new JavaScript.** Every JS line either survives byte-for-byte
or is deleted. The only additions are markdown and config defaults.

### Files that stay unchanged

| File | Lines | Why |
|---|---|---|
| `agents/scout.md` · `detective.md` · `executor.md` · `executor-heavy.md` · `executor-heavy-xhigh.md` · `reviewer.md` | 288 | Owner req #2. Already 2.0-clean. |
| `agents/specialists/*` | 122 | Referenced by `ORCHESTRA.md:88`; unrelated to 2.0. |
| `skills/` (3) + `packs/codex/skills/cross-compare-plan` | 231 | Owner req #5. No 2.0 dependency except row 10. |
| `packs/codex/agents/*.md` (8) | 498 | The cross-vendor launchers. Owner req #1 and #3. |
| `packs/codex/hooks/orchestra-crossplan.js` | 1,329 | Row 10. |
| `packs/codex/pack.json`, `README.md`, `FIELD-VALIDATION.md` | — | Minor edits only (model defaults). |

### Files edited by deletion only

| File | Now | After | Blocks removed |
|---|---|---|---|
| `packs/codex/hooks/orchestra-review.js` | 3,134 | ~3,080 | `:286-293`, `:1857-1868`, `:1870-1901`, `:1975`, `:2429` |
| `packs/codex/hooks/orchestra-exec.js` | 1,492 | ~1,490 | `:185-186` |
| `packs/codex/hooks/orchestra-engine-mcp.js` | 1,265 | ~850 | `:57-241`, `:242-267`, `:369-389`, `:597-670`, `:900-901`, `:928`, `:942`, `:965-966`, `:993`, `:1003-1004`, `:1014`, `:1048-1051`, `:1076-1141`, `:1162-1179` |
| `hooks/orchestra-guard.js` | 1,637 | ~1,180 | `:12-74`, `:173-196`, `:207-208`, `:292-320`, `:345-347`, `:353-357`, `:403-416`, `:500-526`, `:654-822`, `:894-916`, `:1405-1461`, `:1484-1487`, `:1531-1555`, `:1583-1589`, `:1622-1634` |
| `ORCHESTRA.md` | 127 | 124 | `:13-15` collapse to one dormancy bullet; `:55` parenthetical |
| `install.js` | 3,613 | ~2,800–3,000 | `:92-119`, `:696`, `:735`, `:818`, `:863`, `:917-1057` (pin), `:1313-1400` (gate hooks), `:2003-2051` + `:2325-2331` (`--roster`), `:2358-2381`, `:2442-2491`, `:2554-2620`, `:3470-3530` |
| `README.md` | 130 KB | — | Layout/Versioning/pin paragraphs (`:391`, `:436`, `:538`) |

### Files deleted

| Path | Lines |
|---|---|
| `bridge/` (runtime 998, close 1040, cli 110, manifest 462, telemetry 115, hooks/ticket-gate 100, README) | **2,825** |
| `router/` (router 1433, tickets 1549 + aliases/castings/charters JSON + README) | **2,982** |
| `registry/` (load 304 + classes.json + all 8 schemas + README) | **304** |
| `verifier/` (verifier 907, checkout 461, schema-check 170 + README) | **1,538** |
| `quartermaster/` (1359 + README) | **1,359** |
| `tools/orchestra-ledger-report.js` | **476** |
| `tools/shakedown/` (ppp-call 52, ppp-doctor 61) | **113** |
| `roster/lint.js` + 12 role profiles (`architect.md`, `builder.md`, `builder-openai.md`, `conductor.md`, `data-engineer.md`, `investigator.md`, `red-team.md`, `reviewer-anthropic.md`, `reviewer-openai.md`, `sweeper.md`, `test-designer-vs-anthropic.md`, `test-designer-vs-openai.md`) | **229** + md |
| `tests/`: `bridge.test.js` 1211, `bridge-acceptance` 903, `bridge-close` 1092, `router` 1359, `tickets` 1567, `quartermaster` 1098, `registry` 227, `verifier` 809 | **8,266** |
| `~/.claude/orchestra/pins/` (concept) | — |

### Line accounting

| | Lines |
|---|---|
| 2.0 JavaScript today (oracle's 18 files, reproduced exactly) | **17,865** |
| — deleted implementation (bridge 2,825 + router 2,982 + registry 304 + verifier 1,538 + quartermaster 1,359) | −9,008 |
| — deleted from surviving files (guard 457, mcp 412, review 54, exec 2) | −925 |
| **Harness JavaScript after the port** | **~7,932** |
| of which: the codex pack the owner wants (exec 1,490 + review 3,080 + crossplan 1,329 + mcp 850) | 6,749 |
| of which: the guard | ~1,180 |
| Additional: `tools/` deleted | −589 |
| Additional: `install.js` reduction (estimate) | −600 to −900 |
| Additional: tests deleted | −8,266 |
| Additional: `tests/guard.test.js` / `install.test.js` / `mcp-lane.test.js` shrink (estimate) | −800 to −1,200 |
| **Total repo reduction** | **≈ 20,000–20,900 lines** |

**56% cut to the harness JavaScript. 85% of what remains is the cross-vendor pack the owner
explicitly asked for; the rest is the guard.** Nothing else survives.

### `.claude/orchestra.json` after the port

```jsonc
{
  "version": "3.0.0",                 // NEW: 1 key, replaces bridge/manifest.js's 462 lines
  "reviewEngine": "codex",            // CHANGED default (was "opus") — owner req #4
  "executorEngine": "claude",         // owner req #3 — "claude" | "codex"
  "verification": { "full": "...", "lint": "...", "shards": [], "protected": [] },
  "codex": {
    "reviewModel": "gpt-5.6-sol",     // NEW default — see below
    "execModel": "gpt-5.6-terra",
    "execHeavyModel": "gpt-5.6-sol",
    "execLightModel": "gpt-5.6-luna", // NEW — owner req #1, third model
    "reviewTimeoutMs": 1800000, "execTimeoutMs": 1800000
    /* …the ~20 existing codex.* keys read at orchestra-review.js:2584-2664
       and orchestra-exec.js:1146-1215 are unchanged */
  },
  "directorBlockedPatterns": [], "directorAllowedTools": [],
  "directorPlanPatterns": [], "directorMemoryPatterns": [],
  "installedFiles": [], "installedPermissions": [], "installedDeny": []
}
```

**Keys deleted:** `roster`, `rosterGeneration`, `seats`, `projectId`, `installedHooks`,
`installedStore`. **Concept deleted:** the out-of-tree pin directory.

### Owner requirement #1 — the three GPT-5.6 models

**The third model is Luna, `gpt-5.6-luna`** — confirmed at `orchestra-engine-mcp.js:402`
(display-name→id map), researched in `plans/cross-compare/agent-role-architecture/final-plan.md:2161`
and `:1459`, and used today only by the *mirror* Codex-native harness
(`codex/ORCHESTRA.md:32`, `:36-37`).

**Requirement #1 is not met today, and neither the oracle nor the brief caught it:**

1. **Luna is unreachable from the Claude-side harness.** `TIER_DEFAULTS`
   (`orchestra-exec.js:187-190`) has exactly two rungs — `gpt-5.6-terra` standard,
   `gpt-5.6-sol` heavy. No agent profile routes to Luna. It exists only as a string in a lookup table.
2. **The reviewer has no pinned model at all.** `orchestra-review.js:298` reads
   `ORCHESTRA_REVIEW_MODEL`; unset, the header prints `"codex default"` (`:2332`, `:2366`) —
   whatever the CLI happens to pick that week. `packs/codex/README.md` calls
   `gpt-5.6-sol` merely "recommended". The reviewer half of requirement #1 currently runs unpinned.

**Both fixes are markdown and defaults — zero new JavaScript**, because the plumbing already exists:
the runner accepts `--model`/`--effort` (`orchestra-exec.js:236-237`, resolution chain
`:1140-1175`) and the MCP tool already exposes both (`orchestra-engine-mcp.js:960-961`).

- Add `packs/codex/agents/executor-codex-light.md` — a ~50-line copy of `executor-codex.md`
  passing `model: gpt-5.6-luna`. **Route it honestly:** the project's own research says Luna
  MRCR 41.3 vs Terra 89.6 and "Luna cannot be trusted to retrieve a fact from a large haystack"
  (`final-plan.md:2161`), and that "Luna never receives under-specified work"
  (`final-plan.md:574`). So Luna's lane is *bounded, fully-specified, mechanical* orders — the
  OpenAI mirror of a scripted batch — and the profile must say so and refuse anything else.
  Satisfying "use all three" by pointing Luna at hard work would be worse than not using it.
- Set `codex.reviewModel` default to `gpt-5.6-sol` in the runner's defaults table
  (`orchestra-review.js:298` region) — a one-line default, matching what `pack.json` already
  recommends.

### Owner requirement #3 — steering to OpenAI vs Anthropic executors

**Nothing to build. Both mechanisms already exist and both should stay.**

- **Durable, per project:** `"executorEngine": "claude" | "codex"` in `.claude/orchestra.json`,
  documented at `README.md:611` and read by the Director per `ORCHESTRA.md:40`.
- **Per session/order:** an in-conversation instruction overrides it — already the stated law at
  `ORCHESTRA.md:40` ("a user's in-conversation instruction … overrides it for the session").

**Config key *and* a line in ORCHESTRA.md — both, and both are already written.** Do **not** add a
per-order config key; the conversational override is strictly better and already exists. The one
change: `executorEngine: "codex"` now selects a *triple* (Luna light / Terra standard / Sol heavy)
rather than a pair.

### Owner requirement #4 — always prefer cross-family review

**A rule in `ORCHESTRA.md` plus a line in the two reviewer profiles is enough. No router is needed,
and I am confident about that** — the routing decision has exactly two inputs (who authored it, is
the pack installed) and one output. That is a two-row table, not a routing engine.

But prose in `ORCHESTRA.md` **alone** is not enough, for a specific reason: the Director is the only
reader of `ORCHESTRA.md`; the reviewer agents never see it. The rule must appear in both places.

Three concrete changes:

1. **Flip the default.** `README.md:610` and `ORCHESTRA.md:42` currently make cross-vendor review an
   *optional layer* added "at gate-class reviews and on `executor-heavy` orders". Requirement #4
   inverts that: `reviewEngine` defaults to `"codex"` whenever the pack is installed.
2. **Replace §2's cross-vendor paragraph and §4's REVIEW bullet with one table:**

   | Change authored by | Reviewed by | Family relationship |
   |---|---|---|
   | Any Claude executor (`executor`, `executor-heavy`, `executor-heavy-xhigh`, a specialist) | `reviewer-codex` → GPT-5.6 Sol | cross-family ✓ |
   | Any codex executor (`executor-codex`, `-heavy`, `-light`) | `reviewer` → Opus 5, fresh context | cross-family ✓ |
   | Either, when the other family's engine is unavailable | the same-family fresh-context reviewer | **cross-family ✗ — the Director must say so in the REPORT beat** |

   The second row is already correct law at `ORCHESTRA.md:40` ("the Opus `reviewer` is already
   cross-vendor relative to an OpenAI author") — it just needs promoting from a paragraph to a rule.
3. **State the author's family in both reviewer profiles.** `agents/reviewer.md:9-11` currently says
   "The change was made by a DIFFERENT agent (the executor)". Extend to "…by a different agent,
   normally from a different vendor family; the work order names which. If the order says the author
   was a Claude model and you are a Claude model, say so at the top of your verdict." Mirror in
   `packs/codex/agents/reviewer-codex.md`. That makes an accidental same-family review *visible*,
   which is the only enforcement a prose rule can offer — and it is enough.

**One caution.** Flipping to always-cross-vendor doubles Codex draw, and the prior review-protocol
oracle already found review over-deployed (`harness-value-oracle-2026-09-02.md:23`, citing
`roster/wo14b-review-protocol-oracle-2026-09-02.md:7-25`). Keep `ORCHESTRA.md:53`'s existing
non-substantive carve-out, and do **not** make `"dual"` the default — one cross-family review per
substantive change, not two reviews.

---

## TELEMETRY

**Ship no telemetry code in port 1.** I know this cuts against the owner's stated priority, so the
argument is in two parts: why the 2.0 carrier is the wrong one, and what to do instead — now, and
in the first follow-up.

### Why `bridge/telemetry.js` cannot be "converted to append-only telemetry"

1. **It is ticket-keyed at the filesystem level.** `telemetry.js:46-48`:
   `ledgerDir(projectDir, ticketId) → .claude/orchestra/ledger/<ticketId>/`. There is no other key.
2. **It is called from exactly one place** — `bridge/close.js`, stated in its own header at
   `telemetry.js:9-10` ("written ONLY by bridge/close.js"). Deleting `close.js` deletes every
   call site. What remains is a library with no caller.
3. **It drags 1,957 lines** to write two JSON files (`telemetry.js:30-31` → schema-check → verifier
   → checkout → registry/load), per the DEPENDENCY MAP. Two of its three fields are also
   control-plane artefacts: `requested_casting` (there are no castings) and
   `served_model_mismatch`, computed at `telemetry.js:62-69` against a casting that will not exist.

"Convert to append-only" is therefore a **rewrite**, not a port.

### Why `tools/orchestra-ledger-report.js` cannot be carried either

1. **Its join key is deleted.** It reads `orchestra/tickets/tickets.json`,
   `tickets.events.jsonl`, `routing.events.jsonl` (`orchestra-ledger-report.js:11-14`). No tickets,
   no rows.
2. **Its own header disclaims the two numbers the owner wants.** Codex engine usage "is not captured
   anywhere and is marked 'engine usage n/a'" (`:21-23`); dollar figures are "a proxy for bucket
   draw on a subscription, not a bill" (`:19-20`); active time is summed across overlapping tickets
   (`:386-401`). So the artefact being carried forward is a report that **cannot see OpenAI spend** —
   which, under requirement #4's always-cross-family review, becomes the *majority* of the harness's
   marginal cost.

### The honest limit, which must be stated before designing anything

**"Requested and served model" is not obtainable for the OpenAI lane at all.**
`orchestra-review.js:2416-2426` records the investigation: Codex CLI 0.151.0's `--json` stream and
rollout log carry only the *requested* model echoed back, which is why `served_model` is
deliberately not scraped and why `telemetry.js:62-69` has an `UNKNOWN` sentinel at all. Any
telemetry design that promises served-model verification across both vendors is promising something
the tooling cannot deliver today. For the **Claude** lane it *is* obtainable — the subagent
transcript carries per-turn `usage` and the served model (`orchestra-ledger-report.js:16-23`).

### What to do in port 1: use the channel that already exists and costs nothing

`ORCHESTRA.md:126` §8.3.5 already mandates a per-session ledger at `.claude/plans/ledger.md`:
"per agent run, record tool calls, parts completed, wall-clock, and verification runs." It is
Director-authored, needs no hook, no schema, no ticket, no gate; the Director may write it directly
under the §3.1 plan-file carve-out; and it is the **only** place where the OpenAI engine's behaviour
is observable at all, because the Director reads the runner header (engine, cap and its source,
model, `ATTEMPT CHAIN`, checkout mode — `orchestra-review.js:2332-2366`,
`orchestra-exec.js:964-973`).

**Strengthen it by three prose lines, not by code:** make the ledger row mandatory per agent run and
require it to carry `engine + model` from the runner header, wall-clock, verdict, and the commit
range. That converts an advisory habit into the harness's telemetry of record on day one, at a cost
of three lines.

*Trend note:* **the trend reinforces this.** A frontier Director writing a disciplined ledger is a
better instrument each year; a schema-validated writer wired to a state machine is not.

### The first follow-up, after the port has run for a week

Then add the smallest real thing — a `SubagentStop` hook, **~60–80 lines**, appending one JSON line
per subagent run to `.claude/orchestra/runs.jsonl`:

```jsonc
{ "ts_start", "ts_end", "agent_type", "requested_model", "served_model",
  "transcript_path",            // Claude lane: usage + served model live here
  "usage": { "input", "output", "cache_read", "cache_write" },
  "git_head_before", "git_head_after",
  "engine": "claude|codex", "engine_model", "verdict" }
```

Written by the hook, not by the runners — a runner writing telemetry would need to know the project
layout and would fail differently on each of three lanes. Failure mode is a **missing line and
nothing else**: no throw, no gate, no invalidated work. Plus a ~120-line reader reusing two things
worth salvaging from the doomed file before it is deleted: the price table
(`orchestra-ledger-report.js:31-43`) and the verdict extractor
(`findBalancedJson`/`extractVerdictBlock`, `:94-160`), which is battle-tested against three
observed fence shapes (`:82-93`).

**~200 lines of new code that runs, versus 591 ported lines that cannot.** But not in port 1:
instrumenting a harness the owner has not yet settled on measures noise, and every line of new code
in the port is a line that can produce the next shakedown.

---

## ORDER OF OPERATIONS

Two facts govern the sequence, and getting them backwards strands the live project.

**Fact 1 — `install.js` is the only thing that can clean up a `roster:new` project, and it is about
to be deleted.** The canonical-name removal of the roster role files, `ORCHESTRA-CONDUCTOR.md`, the
substrate directories and the ticket store lives at `install.js:3470-3530`. Delete the roster:new
code first and PPP is stranded with gate-hook entries in `.claude/settings.json` pointing at a
deleted `bridge/hooks/ticket-gate.js`. The guard fails **closed** under roster:new
(`orchestra-guard.js:1622-1634`), so every `Agent` call in that project denies.

**Fact 2 — `--roster legacy` is a flag flip, not a cleanup.** `install.js:2606-2608` states it
outright: "installedFiles is left exactly as it was: the rollback is a flag flip, never a reinstall
or a deletion." Only the gate hook entries are removed. **The twelve roster role profiles stay in
`.claude/agents/`, `ORCHESTRA-CONDUCTOR.md` stays, and the substrate directories stay.** A flip
therefore leaves the "stripped" harness showing eighteen agent profiles on day one. Use
`--uninstall` followed by a clean install, not a flip.

**Fact 3 — the 2.0 ledger survives, orphaned.** `.claude/orchestra/ledger/` is gitignored runtime
state (`install.js:1391-1394`) and appears in **neither** `ROSTER_SUBSTRATE_DIRS`
(`install.js:118` — router/registry/verifier/quartermaster) **nor** the ticket-store removal
(`install.js:3521-3529`). So the casting-records and verdict-audits stay on disk, while
`orchestra/tickets/tickets.json` — the only join key the report has
(`orchestra-ledger-report.js:11-14`) — is deleted. **Capture the report before touching anything.**

### The sequence

**0. Freeze and land 2.5.** Close out PR #33 on `claude/v2.5.0-shakedown-fixes` (merge or close) so
the port branches from a settled `main`. Do not open new 2.0 work.

**1. Tag the escape hatch.** `git tag v2.5.0-final` on `main` and push it. This is what makes every
delete below reversible; nothing needs to be kept "just in case."

**2. Capture PPP's 2.0 telemetry — before any install runs.** From the master checkout
(`orchestra-ledger-report.js:3-6` is read-only against the target):
`node tools/orchestra-ledger-report.js "<ppp>" --json > roster/ppp-final-2.0-ledger.json` and again
without `--json` for the human-readable roll-up. Then copy `<ppp>/.claude/orchestra/` wholesale to
an archive outside the project. This is the last moment the 93-ticket record is readable.

**3. Uninstall the 2.0 harness from PPP with the CURRENT installer, then reinstall legacy.**
`node install.js "<ppp>" --uninstall`, then `node install.js "<ppp>" --packs codex` (legacy is the
default). Verify by hand: `.claude/agents/` holds six profiles, not eighteen;
`.claude/ORCHESTRA-CONDUCTOR.md` is gone; `.claude/settings.json` has no `ticket-gate.js` entries;
`.claude/orchestra/` holds no `bridge/`, `router/`, `registry/`, `verifier/`, `quartermaster/` or
`tickets/`. Residual pin files under `~/.claude/orchestra/pins/` are harmless once the reader is
deleted (`--uninstall` removes the project's own at `install.js:3604`).

**4. Prove legacy works on PPP before touching harness code.** One real round: scout → executor →
`reviewer-codex`. This is the control. If legacy is broken on PPP, find out now, while the 2.0 code
still exists to bisect against.

**5. Branch `port/3.0-legacy` off `main` and delete, leaves first.** Dependency order matters so the
suite stays runnable between commits: `quartermaster/` → `registry/` → `router/` → `verifier/` →
`bridge/` → `tools/orchestra-ledger-report.js` → `tools/shakedown/` → `roster/lint.js` and the 12
role profiles → the eight dead test suites. Each is its own commit.

**6. Strip the survivors, one commit each,** in the order of the MINIMUM VIABLE PORT table:
`orchestra-engine-mcp.js` → `orchestra-review.js` → `orchestra-exec.js` → `orchestra-guard.js` →
`install.js` → `ORCHESTRA.md` → `README.md` → `CHANGELOG.md`. Run `tests/guard.test.js`,
`tests/mcp-lane.test.js`, `tests/review-lane.test.js`, `tests/exec-lane.test.js`,
`tests/install.test.js` after each.

**7. Only now, the four markdown/default additions:** `executor-codex-light.md`;
`codex.reviewModel` default `gpt-5.6-sol`; the cross-family review table in `ORCHESTRA.md` §2/§4;
the author-family line in both reviewer profiles. One commit, reviewed cross-family.

**8. `VERSION` → `3.0.0`,** with a `CHANGELOG.md` entry naming the breaking change: `--roster new`
is gone, `.claude/orchestra.json` loses six keys, pins are no longer read. Anyone on a `roster:new`
install must run `--uninstall` **with a v2.5.0 checkout** before installing 3.0.

**9. Reinstall PPP from the branch and run one real round** — a scout, a Claude executor, a
cross-family `reviewer-codex` review, and a `--roster`-free reinstall. Then merge.

**10. Follow-ups, in order, each its own work order:** (a) the `SubagentStop` telemetry hook;
(b) the §8 trim of `ORCHESTRA.md`; (c) the guard's second-pass reduction to ~400 lines.

---

## GAPS

Things the owner's five requirements do not cover that will bite in the first week.

1. **Cross-family review will silently degrade to same-family and nothing will notice.**
   `packs/codex/pack.json` records the Windows failure mode in its own words: the sandbox helper is
   resolved by name, so a mis-placed copy means "the sandbox is never set up and BOTH lanes (review
   and execution) return nothing while looking healthy." Add expired `codex login` and a network
   blip. Requirement #4 becomes aspirational the first time it happens, and the stripped harness has
   no telemetry to catch it. **Mitigation (prose):** `REVIEW_UNAVAILABLE` must appear in the
   Director's REPORT beat as "cross-family review did not run", and `/orchestra-status` should carry
   `orchestra_doctor`'s exit code. Cheap; do it in the port.

2. **Nothing binds a review to a commit range any more.** The 2.0 close protocol did that. Legacy
   hands the reviewer whatever is in the working tree. `--base-ref`/`--head-ref` exist
   (`orchestra-review.js:362-363`) and `skills/orchestra-plan/SKILL.md:21` mentions them, but only
   as the advanced path. A solo developer with three orders' churn in one tree will get a review of
   a diff nobody authored. **Mitigation:** make "commit before review, pass `head_ref`" the
   *default* in `ORCHESTRA.md` §4 REVIEW, not an option. `packs/codex/agents/reviewer-codex.md:32`
   already argues the case; promote it.

3. **Parallel executors on one tree lost their serializer.** The exec runner's IDLE PRECHECK
   (`orchestra-exec.js:1316-1334`) refuses when the tree moves mid-run, which under 2.0 was
   backstopped by the ticket gate. Under legacy it is purely Director discipline
   (`ORCHESTRA.md:55`). **Mitigation:** make "parallel executors require separate worktrees, no
   exceptions" a hard rule rather than a parenthetical.

4. **The Claude executor lane has no tree audit.** The codex lane measures what changed
   (`orchestra-exec.js:1367-1376`); the Sonnet `executor` self-reports. This is the one real thing
   lost by deleting `verifier/checkout.js`'s `guardTree`. **Mitigation:** one sentence in
   `ORCHESTRA.md` §4 EXECUTE — after a Claude executor's report, a scout confirms
   `git status --porcelain` against the claimed CHANGES. Free, and a scout is cheap by design.

5. **OpenAI spend is invisible, permanently, with today's tooling.** Not a harness defect — see
   TELEMETRY. The owner should know that "cost per accepted change" is not computable across both
   vendors until Codex exposes usage, and should read the Codex account display directly.

6. **`.claude/plans/ledger.md` is a duty with no enforcement, and it is the thing that will quietly
   stop happening** in week two, taking the port's only telemetry with it. This is the strongest
   practical argument for scheduling the `SubagentStop` hook as follow-up (a) rather than "someday."

7. **`install.js` has no test coverage for a legacy-only world yet.** `tests/install.test.js` (1,658
   lines) is written against an installer that knows both rosters. Stripping it is the highest-risk
   edit in the port and the one the oracle's table does not mention at all. Budget a real review
   round for that commit specifically.

8. **`README.md` is 130 KB and `CHANGELOG.md` is 90 KB.** Both are installed-adjacent
   documentation describing a system that will not exist. Not urgent, but a solo developer reading
   `README.md:391` about `rosterGeneration` a month from now will lose an hour.

---

## UNCERTAIN

- **The `install.js` reduction estimate (600–900 lines) is the softest number in this report.**
  383 lines *mention* roster/pin/substrate/store concepts, but many are comments and many sit inside
  functions with legacy responsibilities. Only doing the edit settles it.
- **The `~1,180`-line post-strip guard** comes from a careful block-by-block subagent analysis, not
  from an executed edit. Expect ±80 lines from collapsing now-dead `policy` fields.
- I did **not** run the test suite, `install.js`, or inspect PiratePartyPals, per the brief. Every
  claim about PPP's on-disk state is inferred from `install.js` code paths, not observed.
- **Whether `--roster legacy` (as opposed to `--uninstall`) removes the pin file** is unresolved:
  `removePin()` (`install.js:863`) has exactly one call site, at `:3604` in the uninstall path, and
  the flip block at `:2600-2620` calls `writeManifestAndPin()` instead. My recommended sequence uses
  `--uninstall`, which sidesteps the question — but a flip probably leaves a live pin behind.
- The claim that `orchestra-review.js`'s coupling is exactly 54 lines rests on a full read by a
  subagent plus my own zero-hit grep for ticket tokens. I am confident there is no *functional*
  coupling; I am less certain the 54 is exact to the line.
- **I have no measured evidence that the stripped harness outperforms 2.0**, and neither does anyone
  — the oracle's own first UNCERTAIN entry is that no matched legacy-run ledger exists
  (`harness-value-oracle-2026-09-02.md:78`). The case for the port rests on cost of carriage and
  demonstrated repair burden, not on a measured delta. That is a sufficient case, but it should be
  named for what it is.
- **The trend argument is a forecast, not evidence.** I applied it where a piece compensates for a
  *model capability gap* (the verifier's mechanical adjudication, `ORCHESTRA.md` §8's sizing
  handholding, the three-tier Claude executor ladder) and withheld it where a piece supplies a
  *fact a model cannot self-attest* (tree audit, nonce echo) or enforces a *role boundary* rather
  than compensating for incompetence (the guard). If that dividing line is wrong, the guard is the
  row that flips.
