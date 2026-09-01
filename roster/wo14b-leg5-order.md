# WO-14b leg 5 — verification and closure (two-stage close, structured verdict, audit, telemetry)

- **Class:** E2 Builder · risk T2 · casting Anthropic Sonnet 5 · high (dense).
  **Tool budget: 80 calls** → `CHECKPOINT`. Runs after leg 4 is committed.
- **Branch:** `claude/wo14b-bridge`. **Do not commit.**
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 5 + mechanism section). The
  oracle's rulings that bind this leg (`roster/wo14b-oracle-verdict.md`): a casting
  record is written only after the actual result is captured; closure is multi-stage;
  the review artifact must be strict and structured — approval is never inferred from
  loosely parsed prose; the audit is constructed deterministically from replayed
  evidence and dispatcher-owned family facts.
- **Law (Band C):** execute the order, the whole order, nothing but the order; blocked
  beats guessed; the report is a claim, not evidence.

## Rider from leg-2 review #6 (APPROVE with 1 MINOR + 1 NIT — `roster/wo14b-leg2-review-6.md`)

Also in scope, in `router/tickets.js` + `tests/tickets.test.js` (public API unchanged): (a) the
anomaly-sidecar drain must never lose a record it could not parse — unparseable lines are written
back to the sidecar (same write-all discipline) instead of being truncated away, and a
`lock_anomaly` event with `data.torn:true` names them; (b) the `_fs` test hooks (incl.
`afterRename`) are honoured only when `process.env.ORCHESTRA_TICKETS_TEST_HOOKS === '1'`;
otherwise the constructor refuses `_fs` with a typed `TicketStoreError`. Pin both.

## FILES

`router/tickets.js` + `tests/tickets.test.js` (the rider above only),
`bridge/runtime.js` (replace the leg-4 `close` stub), `bridge/close.js` (new — the
closure logic), `bridge/telemetry.js` (new — the two schema-validated writers),
`bridge/cli.js` (add `close`), `bridge/README.md`, `packs/codex/hooks/
orchestra-engine-mcp.js` (add `orchestra_close`), `packs/codex/hooks/
orchestra-review.js` (emit the structured verdict block — additive, the prose stays),
`roster/reviewer-anthropic.md` + `roster/reviewer-openai.md` (Report format section
only: the structured block is now mandatory), `registry/schemas/verdict.schema.json`
(only if a field the runner cannot truthfully supply must become nullable — say which),
`tests/bridge-close.test.js` (new), `.github/workflows/test.yml`.
Forbidden: `router/router.js`, `router/castings.json`, `verifier/**` (call
`runVerification`; do not edit), `quartermaster/**`, `install.js`, `hooks/**`.

## 1. Close #1 — `close({ ticket })` on a RESOLVED implementation ticket

1. Refuse (typed `NOT_CLOSED`, reason) unless the ticket is `RESOLVED`, its `kind` is
   `implementation`, and its `q0_ticket` (when set) is `RESOLVED` too.
2. **Validate the bound executor report** — `resolved.last_assistant_message` must
   parse as the Band C report contract (`STATUS` / `CHANGES` / `VERIFICATION` /
   `DEVIATIONS` / `CONCERNS`; `registry/schemas/report.schema.json` is the shape —
   read it). `STATUS` ∉ {`DONE`,`PARTIAL`} → `NOT_CLOSED: executor status <X>`. Never
   accept a report passed in by the caller: the report is the one the host bound at
   `SubagentStop` (or the engine run log for codex tickets).
3. **Run `verifier.runVerification`** with `repoDir`, `commit` = the head the report
   names (it must name one; absent → `NOT_CLOSED: no commit named`), `baseRef` = the
   ticket's recorded base, the canonical order, the parsed report, `manifestRef` =
   the base ref (manifest pinned outside the audited commit — Ruling 1a; never pass
   `manifest` from the audited tree), and `mutations` when the order declares them.
   Persist the Verifier artifact under `.claude/orchestra/ledger/<ticket>/verifier.json`.
   Any outcome but `PASS` → `NOT_CLOSED: verifier <outcome>` with the failing checks
   named. **No review request is issued before this point** — pin it.
4. On PASS: compute the reviewer via `router.reviewer({authorFamilies: [ticket.
   author_family, …co-authors], class, risk, buckets})` with a **fresh** Quartermaster
   snapshot; a `closes:false`/`GATED` reviewer → `NOT_CLOSED: review unavailable
   (<reason>)` (the lawful responses — wait / named human / park — are the Conductor's
   to choose; record them in the reason). Otherwise issue a **reviewer ticket**
   (`kind:'reviewer'`, `reviewer_of: ticket.id`, `role: Reviewer`, casting = the
   computed one, `author_family` = the reviewer's family — dispatcher-owned) and return
   `{ ok:true, stage:'REVIEW_PENDING', reviewer_ticket, spawn:{ subagent_type:
   'reviewer-<family>', prompt_header:'TICKET=<id>\n…', pinned_range } }`. OpenAI
   reviewer launchers call the ticket-gated codex review runner (leg 4); Anthropic
   reviewers return directly through `SubagentStop`.

## 2. The structured verdict artifact

`packs/codex/hooks/orchestra-review.js` and both Reviewer role files' Report format
gain a mandatory trailing fenced block:

    ```verdict-json
    { "verdict": "APPROVE|REVISE|REJECT", "findings": [ { "severity": "CRITICAL|MAJOR|MINOR|NIT",
      "path": "...", "line": 0, "claim": "...", "reproduced": true|false, "evidence": "..." } ],
      "claims_checked": [ { "claim": "...", "result": "CONFIRMED|REFUTED|UNVERIFIED", "how": "..." } ],
      "refutation_duty": { "present": true|false, "what_was_tried": "..." },
      "citation_replay": [ { "citation": "...", "command": "...", "result": "MATCH|MISMATCH|UNREPLAYABLE" } ],
      "served_model": "<as reported by the host or engine>", "run_nonce": "<engine nonce or null>" }
    ```

Parsing is strict: exactly one such block, valid JSON, validated against
`verdict.schema.json` (extend it additively if needed — say what). Prose outside the
block is ignored for the decision. **No block, two blocks, invalid JSON, or schema
failure → the verdict is `MALFORMED` and the ticket stays open** (`NOT_CLOSED:
malformed verdict`). The runner's own `REPORT INTEGRITY`/nonce line must match
`run_nonce` for codex-lane verdicts.

## 3. Close #2 — `close({ ticket })` on a RESOLVED reviewer ticket

1. Parse the bound `last_assistant_message` per §2.
2. **Construct the verdict audit deterministically** (`verdict-audit.schema.json`):
   `cross_family` = `familyOf(reviewer ticket casting) !== implementation
   author_family` **computed from the two tickets**, never from the verdict text;
   `gate_class` from the order/class; `refutation_duty_present` from the block;
   `citation_replay` — **re-run** every citation in the block through the Verifier's
   citation replay (`verifier` exports; cite the function) and record MATCH/MISMATCH;
   `served_model_mismatch` = requested vs the host/engine-reported served model, computed;
   `falsification_run` when gate-class. Validate; a schema failure → `NOT_CLOSED:
   unauditable`.
3. **Decide:** `CLOSED` only when verdict is `APPROVE`, `cross_family` is true, the
   audit validates, every citation replay is MATCH or the mismatch is explained by a
   `reproduced:true` finding, and no CRITICAL/MAJOR finding exists. `REVISE`/`REJECT`
   → `NOT_CLOSED: <verdict>` with findings attached; same-family → `NOT_CLOSED:
   same-family review does not close` (a dispatch defect — say so); `UNAVAILABLE`
   (engine failure, refusal, classifier-fallback signal) → `NOT_CLOSED: review
   unavailable`.
4. Write **final telemetry** (`bridge/telemetry.js`): one `casting-record` for the
   implementation ticket and one for the reviewer ticket — `served_model` from the
   host/engine (`UNKNOWN` only when the runtime genuinely exposed none, and then
   `served_model_mismatch` is `null`, never `false`), `status` from the outcome,
   `review_cross_family` from the audit — and the `verdict-audit` row, all
   schema-validated before write, to `.claude/orchestra/ledger/<ticket>/`. Then
   `tickets.close(impl, 'CLOSED')` / `close(reviewer, 'CLOSED')`, or the typed
   `NOT_CLOSED` codes on both. There is no other path that writes a `CLOSED` outcome —
   grep-pin it in the test (the string `'CLOSED'` as a close code appears only in
   `bridge/close.js`).

## 4. Tests — `tests/bridge-close.test.js` (temp projects; no live models)

Pin with fixtures built from the leg-1 payload shapes and synthetic reviewer output:
close #1 refuses non-RESOLVED, non-implementation, Q0-not-resolved; caller-supplied
report ignored; executor `BLOCKED` → NOT_CLOSED; no commit named → NOT_CLOSED;
Verifier FAIL → NOT_CLOSED and **no reviewer ticket issued**; Verifier PASS →
reviewer ticket with the computed opposite family and the right `subagent_type`;
gated reviewer → NOT_CLOSED with lawful responses named; close #2: APPROVE
cross-family → CLOSED with both casting records + audit written and schema-valid;
REVISE → NOT_CLOSED with findings; same-family reviewer ticket (forged) → NOT_CLOSED;
malformed block (none / two / bad JSON / schema fail) → NOT_CLOSED malformed; MAJOR
finding under APPROVE → NOT_CLOSED; citation MISMATCH unexplained → NOT_CLOSED;
served_model absent → `UNKNOWN` + `served_model_mismatch:null`; run_nonce mismatch on
a codex-lane verdict → NOT_CLOSED; the grep-pin for `'CLOSED'`. Add to CI.

## Declared verification (run all; paste results)

    node tests/tickets.test.js
    node tests/bridge.test.js
    node tests/bridge-close.test.js
    node tests/verifier.test.js
    node tests/review-lane.test.js
    node tests/mcp-lane.test.js
    node tests/router.test.js
    node roster/lint.js && node install.js --lint

## Report format

    STATUS: DONE | PARTIAL | BLOCKED | CHECKPOINT
    CHANGES / VERIFICATION (actual outputs) / DEVIATIONS / CONCERNS

Never end while a process you started is still running. Do not run `git commit`.
