EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol (flag), tier: standard, effort: max, sandbox: workspace-write, timeout: 2400000ms (flag), attempts: 1 (execution is never auto-retried), tree: live working tree)
RUN NONCE: b0e52afe5ff63d23
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 4665ms

## VERDICT

Yes: the current harness over-deploys reviewers. Reviewer-family selection is sensible once review is warranted, but the decision to dispatch one is not—the close path ignores the router’s `none/preferred/mandatory` result, defaults every implementation to mandatory review, and serially mints a reviewer after Verifier success. A cheaper method is to honor Verifier-only exemptions for tightly bounded inert/no-change work and batch ready, homogeneous T1 changes into one pinned review while retaining individual review for the mandatory band. The “slow and cumbersome” impression is a real operational regression, not merely an unrealized benefit: reviewers consumed about 35% of recorded active time, only 5 of 17 reviewer tickets reached `CLOSED`, and lifecycle delays reached hours. The system does show potentially useful REVISE verdicts, but the ledger cannot yet demonstrate that cross-family review’s incremental defect recall justifies universal deployment.

## FINDINGS

1. **MAJOR — Closure silently converts every review policy into mandatory review.** The router correctly returns `mandatory`, `none` for inert T0/T1, and `preferred` otherwise (`router/router.js:758-772`), and dispatch carries that policy (`router/router.js:1075`, `router/router.js:1219-1238`). Close #1 nevertheless calls `reviewer()` without a policy (`bridge/close.js:393-406`), whose default is `mandatory` (`router/router.js:781-786`); mandatory T1 is then promoted to the T2 model row (`router/router.js:839-845`). That contradicts both the legacy exemption/batching law (`ORCHESTRA.md:53`, `ORCHESTRA.md:95`) and the new design’s preferred/no-review rows (`plans/cross-compare/agent-role-architecture/final-plan.md:1096-1100`). The ledger reports 17 reviewer tickets among 76 total and 3h05m reviewer activity out of 8h48m total—about 22% of ticket count and 35% of active time (`.claude/scratch/oracle/ppp-ledger-report.txt:2`, `:231-237`).

2. **MAJOR — On small orders, the Reviewer repeats nearly all mechanical assurance already performed by the Verifier.** The Verifier executes the pinned manifest, validates schemas and nonce, checks claimed changes, mutation sensitivity, invariants, citations, and both trees (`verifier/verifier.js:11-35`, `verifier/verifier.js:736-845`). Both reviewer contracts then independently re-run verification (`roster/reviewer-anthropic.md:14-32`; `roster/reviewer-openai.md:15-29`). Semantic failure hunting remains valuable for substantive logic, but adds little to no-artifact or mechanically complete work. The Verifier even emits `deterministic_only_closure` (`verifier/verifier.js:839-845`; `verifier/README.md:25-31`), yet close #1 ignores it and always advances to review after PASS/COVERAGE_GAP (`bridge/close.js:364-406`). Concrete mismatches include a 32m39s review of a verification-only test run and reviewer tickets for another CI-only gate and a push operation (`.claude/scratch/oracle/ppp-ledger-report.txt:116-142`).

3. **MAJOR — The matrix is defensible at high risk, but its frontier rows become theatre when indiscriminately applied at T1.** No-self-family selection, fail-closed provenance, and non-degrading security/data/T3/integration rules are coherent (`router/castings.json:64-103`; `router/router.js:824-869`). Keeping Terra T1 disabled pending qualification is also honest (`router/castings.json:75-86`). What is disproportionate for a solo game project is full Sol/Opus treatment for routine T1 E2, test-only, routine internal docs, no-change operations, human-authored T1 work, and every bounded Sol-authored mutation merely because of model identity. The design itself classifies routine E2, passing test-only changes, and routine docs as preferred rather than mandatory (`plans/cross-compare/agent-role-architecture/final-plan.md:1096-1099`). Moreover, it explicitly admits that cross-family incremental recall—the load-bearing premise—has no direct measurement yet (`plans/cross-compare/agent-role-architecture/final-plan.md:2119-2123`). The ledger’s REVISE outcomes show that semantic review is not wholly ceremonial, but provide no defect-severity or downstream-escape data to establish marginal value (`.claude/scratch/oracle/ppp-ledger-report.txt:295-300`, `:332-346`).

4. **MAJOR — T1 Q0 is an expensive calibration experiment whose benefit is not recorded.** Policy samples 25% of T1 E2/E5/E6 and blocks when required Q0 is missing (`router/castings.json:105-111`; `router/router.js:1181-1204`). The three itemized Q0 runs consumed 26m26s and approximately $1.37; one took 23m49s and ~$1.12 while its two associated builder attempts together took 1m15s and ~$0.48 (`.claude/scratch/oracle/ppp-ledger-report.txt:20-28`, `:164-169`, `:221-226`). Two later Q0s finished in 1m23s and 1m14s, so the first is an outlier, not a stable unit cost. The ledger records no unique defects caught, mutation survivors, or prevented escapes. Mandatory Q0 for T2/T3, security, data, concurrency, and public APIs has a clear conflict-of-interest rationale; T1 sampling is justified only as a time-bounded measurement, not an indefinite blocking control (`plans/cross-compare/agent-role-architecture/final-plan.md:789-819`).

5. **MAJOR — Latency is chiefly serial active work and broken closure, not reviewer queueing.** Across the 11 reviewer tickets with activity, calculated mean active time was 16m53s, median 14m39s, while median wait was only 26s. The architecture is serial: implementation resolution → full Verifier → reviewer issuance (`bridge/close.js:264-442`) → reviewer audit → close both tickets (`bridge/close.js:482-726`). Only 5 of 17 reviewer tickets were closed; 4 were `NOT_CLOSED`, 2 remained resolved, 3 open, and 3 invalidated. One 13m54s review then sat 4h46m before non-closure, leaving its builder at 5h02m close latency (`.claude/scratch/oracle/ppp-ledger-report.txt:80-91`). The anomaly section contains 32 “RESOLVED but never CLOSED” entries—25 builders, one OpenAI builder, six investigators—so missing casting records also corrupt future policy calibration (`.claude/scratch/oracle/ppp-ledger-report.txt:250-350`).

6. **MINOR — The highlighted docs order was overpowered, but not genuinely non-substantive.** Legacy law treats changes to the meaning of documentation as substantive (`ORCHESTRA.md:53`), and the new design says documentation is substantive and not inert (`plans/cross-compare/agent-role-architecture/final-plan.md:834-844`). Prepending a status snapshot changes meaning, so skipping review entirely would be the wrong lesson. The defect is that routine documentation is supposed to be preferred and batchable, yet this E2-standard order received an individual Sol-high review (`.claude/scratch/oracle/ppp-ledger-report.txt:170-196`).

7. **MINOR — The ledger also exposes broader casting waste unrelated to review.** A read-only “check PR and branch status” lookup routed to I0/Opus, took 35 seconds, and cost approximately $1.18; the branch-deletion builder two minutes later cost ~$0.29 (`.claude/scratch/oracle/ppp-ledger-report.txt:155-160`). That request matches N0’s lookup charter and Haiku-bounded casting (`registry/classes.json:40-46`; `router/castings.json:139-147`, `:255`). This single row does not prove a systemic rate, but it confirms the owner’s cumbersome experience is not caused by review alone.

## ALTERNATIVE

Adopt one protocol: **Verifier-first microbatch close**, piloted for 30 eligible implementation close-outs.

- **Exemption rule:** Close on Verifier alone only when the dispatcher—not the executor—records `review_policy:none`; risk is T0/T1; no mandatory class, flag, or security touch applies; the actual diff is at most two files and 20 changed lines; it is either empty/patch-identical or exclusively whitespace, comments, formatting, or spelling; and Verifier returns PASS with `deterministic_only_closure:true`. Meaning-changing docs, tests, code, configuration, dependencies, data, and API text do not qualify. Record `close_mode:verifier-only`, the diff metrics, and the Verifier artifact in the casting record.

- **Batching rule:** Batch two to five already-ready `preferred` T1 orders—never hold completed work waiting for a future batch—only when they share one deliverable kind, class, author family, and linear branch; touch disjoint paths; and each independently passed the Verifier. Pin one range from the pre-batch base to the final head and give the reviewer a checklist mapping every task ID to commits, files, and acceptance criteria. Cast against the union of author families. One atomic verdict closes all; every implementation casting record points to the same reviewer ticket, `review_batch_id`, pinned range, verdict, and dispatcher-derived `review_cross_family`. Make issuance idempotent on `(base, head, task-set)`.

- **What breaks batching:** Any T2/T3 order; E3/E4/E7; security, persistent data, public API, concurrency, ceiling, unattributed, or destructive/external effects; Verifier COVERAGE_GAP/failure; mixed author families; overlapping or dependent diffs; heterogeneous deliverables; configuration-generation change; or any integration/chain-final gate. A shared-branch integration gate always receives its own individual mandatory review of the cumulative range.

- **Safety floor:** Retain individual cross-family review for the entire current mandatory band, plus all T2 work during the pilot. Keep mandatory Q0 triggers unchanged. Treat the 25% T1 Q0 sample as a 30-sample calibration campaign with a recorded “unique defect caught” field; it should not become permanent without measured yield.

- **Expected saving:** Target three reviewer launches avoided per ten implementation close-outs—one Verifier-only close plus replacing three compatible reviews with one batch. At the observed 16m53s mean, that removes about 50m39s of serial reviewer activity per ten close-outs and roughly 30% of reviewer-lane draw. The visible launcher saving is about $0.52 per ten; actual Sol savings are additional but presently unmeasured.

- **Stopping rule:** Stop the pilot immediately after one CRITICAL or two MAJOR defects are found at a later mandatory gate in untouched lines from exempted orders or interactions wholly inside a batch. Also stop after 30 eligible close-outs if fewer than nine reviews were avoided or median implementation-resolution-to-close latency fails to improve by 25%. Restore per-ticket review for the affected class; do not add a new review/fix loop.

## RULED OUT

- **Verifier-only for all T1:** rejected because deterministic checks cannot judge semantic omissions, ambiguous requirements, or failure scenarios.
- **Replace Sol with Terra everywhere:** rejected because Terra’s T1 qualification is explicitly incomplete and cheaper casting does not remove serial duplication.
- **One review for the whole branch:** rejected because heterogeneous mega-diffs collapse review depth and violate the legacy same-kind boundary.
- **Remove the cross-family mandatory band:** rejected because the evidence does not refute its security/data/integration rationale; it only refutes universal deployment.
- **Review after merge:** rejected because post-hoc review cannot serve as a closing safety gate.

## UNCERTAIN

- **True reviewer cost/draw:** Codex engine usage is absent; only Haiku-launcher tokens are counted (`.claude/scratch/oracle/ppp-ledger-report.txt:236-242`). Probe: record engine tokens, allowance bucket, checkout, verification, semantic-read, and report durations per ticket.
- **Incremental defect value:** REVISE exists, but findings are not linked to fix commits or later escapes. Probe: join verdict-audit findings to subsequent changed lines and production/test incidents.
- **Per-ticket risk/policy:** ledger rows omit risk, mandatory flags, and computed `review_policy`. Probe: join ticket IDs to routing envelopes and casting records before estimating an exact exemption count.
- **Ledger consistency:** the header and role roll-up report 76 tickets, but only 75 ticket headings are itemized; `test-designer-vs-anthropic` reports `n=3` while only two such rows appear and their durations exactly equal the reported aggregate (`.claude/scratch/oracle/ppp-ledger-report.txt:1-2`, `:164-165`, `:221-222`, `:231-237`). Probe: regenerate from unique raw ticket IDs.
- **Regression magnitude versus legacy:** current overhead is demonstrated, but there is no matched legacy ledger for the same work mix. Probe: replay ten representative T1 orders under both close policies without changing executors or verification.

STATUS: DONE

CHANGES
- none

VERIFICATION
- `Get-Content .claude/scratch/oracle/ppp-ledger-report.txt` with physical line numbering → `PHYSICAL_LINE_COUNT=353`; the evidence file was read in full.
- `rg -n` / numbered `Get-Content` over every named policy, router, closer, Verifier, registry, reviewer-contract, legacy-protocol, and design file → cited sections located and inspected; no test or executable policy path invoked.
- Read-only PowerShell ledger aggregation → `REVIEWER_TICKETS=17`, `ACTIVE_REVIEW_RUNS=11`, `ACTIVE_SUM_SECONDS=11143 (3h05m43s)`, `ACTIVE_MEAN_SECONDS=1013 (16m53s)`, `ACTIVE_MEDIAN_SECONDS=879 (14m39s)`, `WAIT_MEDIAN_SECONDS=26`; reviewer states `CLOSED:5, RESOLVED_NOT_CLOSED:4, RESOLVED_OPEN:2, OPEN:3, INVALIDATED:3`.
- Read-only anomaly aggregation → `RESOLVED_NEVER_CLOSED=32 (builder:25, builder-openai:1, investigator:6)`.
- Test suites → not run; explicitly forbidden by the work order.
- `git diff --exit-code -- .; git status --short` → `GIT_DIFF_EXIT=0`; only pre-existing untracked `.claude/scratch/` and `roster/wo14b-review-protocol-oracle-2026-09-02.md` remain.

DEVIATIONS
- none

CONCERNS
- The ledger omits actual Sol usage and has a 76-versus-75 ticket-count inconsistency, so exact monetary savings and Q0 frequency cannot be certified.
- No matched legacy run or linked review-finding/escape data exists; the latency regression is established, but incremental quality benefit remains unmeasured.
- The pre-existing untracked files were read only where explicitly named and were not modified.

REPORT INTEGRITY: b0e52afe5ff63d23

TREE AUDIT: no source paths changed while the engine ran.
  HEAD moved: ceeaeb5d1fb0 → c1cdabcaa80f — the engine made commit(s); paths those commits cleaned from the dirty set may show above as "left the dirty set".
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token b0e52afe5ff63d23) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token b0e52afe5ff63d23, and the report does not contradict the tree audit.
