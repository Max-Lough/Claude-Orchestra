EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol (flag), tier: standard, effort: xhigh, sandbox: workspace-write, timeout: 600000ms (flag), attempts: 1 (execution is never auto-retried), tree: live working tree)
RUN NONCE: 3d7a21387df766cb
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 5541ms

## Second-pass scope verdict

The campaign should stop WO-12 at phase 0. Its critical path is now control-plane repair and real harness activation, not corpus completion.

### What phase 0 established

The pilot has bought all the information presently needed:

- The review paths execute reliably enough to continue: current raw files show S-Sonnet and S-Opus completed 12/12; X-Sol completed 11/12 with one UNAVAILABLE.
- Both same-family lanes found all six seeds. X-Sol found five.
- X-Sol showed no pilot-only complementarity: the falsified-test seed it missed was found by both same-family lanes.
- The same-family control reviews exposed apparently real defects in the live router and Quartermaster. That is more operationally important than narrowing a recall confidence interval.
- OU moved only from 0.78 to 0.74, so allowance exhaustion is not forcing this ruling.

Completing phases 1–3 would improve statistical confidence in 12d, but it would not unlock a deployment decision. Terra qualification is withdrawn, 12d cannot alter the mandatory review floor, and preferred-lane tuning can be measured during shadow. The remaining corpus is now an optional research asset, not a harness-completion gate.

The current scorer must not be mistaken for a valid phase-0 readout. It applies the withdrawn 12f identity exclusion to 12d, removes `sdc-002`, and evaluates the pilot over 29 corpus seeds—including 24 that were never run—producing 4/29 versus 5/29. The actual pilot comparison is 5/6 versus 6/6. Repairing that scorer would reopen the WO-12 instrumentation treadmill prohibited by amendment xiv; preserve the discrepancy and close the experiment.

### What the first verdict got wrong

It was right to stop before phase 1 and to preserve the pilot. It was wrong to classify live router and Quartermaster findings as registration-only follow-ons.

Once independent reviewers find plausible fail-open defects in the substrates that choose models and enforce allowance gates, those findings become readiness blockers. A direct probe confirms one: an A0 order carrying the canonical `touches:["auth"]`, explicitly selecting the Fable “nebulous” rung, dispatches successfully to Fable. The hard security filter reads `castOpts.securitySensitive`, but `dispatch()` does not derive that value from its canonical security touches.

The P15/Quartermaster findings also need a bounded adversarial disposition. The shipped default computes `requiredReserve = 0.08`, exactly equal to the ladder’s `redBelow = 0.08`. Consequently, its supposedly predictive reserve does not lead the ordinary Red transition under the default forecast. Whether every claimed reviewer-path failure reproduces or not, the readiness claim is invalid until each finding has a current-HEAD reproducer or a documented refutation.

### The missing work order

The largest unacknowledged gap is activation.

The new router, registry, Verifier, Quartermaster, and roster are currently libraries and repository records, not the installed harness:

- `install.js` still installs the legacy six-agent core and does not package the new roster or deterministic substrates.
- Repository-wide usage search found no production entry point calling `createRouter()`/`dispatch()`; consumers are tests, WO-7b, and the Quartermaster demonstration.
- The alias layer proves resolution as a function, but no live launcher consumes its result.
- Therefore WO-15 cannot honestly begin merely by declaring both rosters live.

The next new order should be a bounded activation bridge before WO-15. It must install the new roster and substrates, obtain fresh P0 state, call `dispatch()` for real orders, honor Q0 and review results, invoke deterministic verification, refuse non-closing verdicts, record telemetry, and prove rollback to legacy in an installed disposable target.

### Binding path to completion

1. Preserve the three raw phase-0 result files and one immutable, explicitly NON-GATING pilot note. Record the scorer discrepancy; make no WO-12 tooling or corpus changes.

2. Open one gate-class readiness-repair tranche covering every live router/Quartermaster finding from both S lanes. Each finding receives a minimal current-HEAD reproducer or a precise refutation. Fix every confirmed authorization, security, provenance, review-closure, or allowance-gate defect, then take one scoped cross-vendor review.

3. Build the activation bridge. Its acceptance artifact is an installed end-to-end canary showing:

   - fresh Quartermaster evidence enters the actual dispatcher;
   - security touches cannot reach Fable;
   - P15 can prevent both author and reviewer dispatch;
   - required Q0 is launched or blocks work;
   - deterministic evidence precedes review;
   - a non-closing review cannot be represented as completion;
   - `roster:new → roster:legacy` rollback works without reinstalling.

4. Run exactly one correctly staged E8, E1, and A0 exercise through the working path. Their environment blocker is gone; record the real seat outcome without rewriting the preserved orders to obtain a pass.

5. Treat A1, the E5 render loop, and the M0 image lane as named shadow canaries or explicitly unavailable capability limits. They must not disappear from the debt ledger, but synthetic exercises should not delay activation.

6. Start WO-15 only after the above gate passes. Use its real orders to finish WO-1 telemetry, exercise remaining applicable capability lanes, and collect the evidence WO-16 actually needs. Then proceed to WO-16 acceptance, WO-17 retirement, and WO-18’s operator page.

The deferred backlog and the remaining WO-12 trials should not run while this path is open.

### Bright-line stopping rules

- No WO-12 phases 1–3, false-blocker adjudication, corpus refinement, scorer repair, blinding work, 12a/12c/12e trial, or new analysis layer without an owner order naming the operational decision it will unlock.
- No shadow while any confirmed MAJOR/CRITICAL fail-open remains in routing, review closure, Q0, provenance, P15, or security filtering.
- The readiness-repair tranche gets at most two fix/re-review cycles. A second cycle that still produces a new MAJOR/CRITICAL stops to the owner; it does not start a historical nine-round burn-down.
- No claim that WO-9/10/11 are complete until E8/E1/A0 have real outcomes and the remaining debt is exercised, deliberately limited, or removed from the shipping claim.
- No WO-15 credit for calling router functions in tests. Credit begins only when an installed order traverses the actual new-roster path.
- During shadow, any same-family mandatory closure, omitted required Q0, security-sensitive Fable dispatch, accepted stale/missing P0 evidence, unapproved T3 action, source mutation, or failed kill-switch rollback stops the canary immediately and restores legacy.
- WO-17 cannot begin until WO-16 passes while legacy remains installed. Statistical gates that lack enough shadow volume remain open; they are not converted into narrative passes.

STATUS: DONE

CHANGES
- none

VERIFICATION
- `Get-Content` on `STATUS.md`, `final-plan.md` Orders/acceptance sections, `wo12-protocol.md`, `roster/wo11-band-record.md`, and the first oracle verdict → confirmed WO-12 is non-gating at phase boundaries, 12f is withdrawn, E8/E1/A0 remain owed, and WO-15 requires both rosters live.
- Parsed `results-S-Sonnet-phase0.json`, `results-S-Opus-phase0.json`, and `results-X-Sol-phase0.json` → 12 records in every file; both S lanes show 12 COMPLETED, while X-Sol shows 11 COMPLETED and `sdc-004` UNAVAILABLE after two attempts.
- Read `corpus/score-output.json` and `score.js:1391-1468` → scorer excludes `sdc-002` under withdrawn identity logic and uses all 29 non-excluded corpus seeds as the phase-0 denominator, reporting 4/29 versus 5/29 instead of the six-seed pilot.
- `node -e "<A0 auth-touch dispatch probe; reserve probe>"` → `{"ok":true,"role":"Architect","model":"Fable 5","policy":"mandatory","q0":true}` and `{"requiredReserve":0.08,"redBelow":0.08}`.
- Repository usage/installer searches with `rg` → no production consumer of `createRouter()`/`dispatch()` outside tests, WO-7b, and demonstration code; `install.js` still defines and installs only the legacy core agent list.
- `node quartermaster\quartermaster.js --state` → AU-all/AU-opus/AU-fable all 1.00, OU 0.74, every bucket `belowReserve:false`.
- `git status -sb; git diff --name-only` → no tracked diff; five pre-existing WO-12 result/score artifacts remain untracked.
- Tests/build/lint → not run; this was a read-only scope verdict with no implementation changes.

DEVIATIONS
- none

CONCERNS
- The new architecture is not yet a live, installable dispatch path; proceeding directly to WO-15 would shadow library tests rather than a working harness.
- Pilot artifacts are untracked and therefore not durable; preserve them before further work.
- Campaign records are materially stale or contradictory: the protocol header still says no trial ran, STATUS still contains superseded quick-start language, and the scorer still enforces withdrawn 12f assumptions.
- Confirmed and claimed control-plane defects invalidate readiness until dispositioned; unit-suite coverage does not substitute for the missing installed end-to-end path.

REPORT INTEGRITY: 3d7a21387df766cb

TREE AUDIT: 3 path(s) changed while the engine ran (3 shown):
  changed: plans/cross-compare/agent-role-architecture/wo12/corpus/score-output.json
  appeared: plans/cross-compare/agent-role-architecture/wo12/results-S-Opus-phase0.json
  appeared: plans/cross-compare/agent-role-architecture/wo12/results-S-Sonnet-phase0.json
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token 3d7a21387df766cb) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token 3d7a21387df766cb, and the report does not contradict the tree audit.

[exited with code 0]
