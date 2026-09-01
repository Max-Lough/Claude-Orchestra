# WO-12 R0 Delta Review — OpenAI Lane (Attempt 6)

**Lane:** Reviewer, OpenAI casting, GPT-5.6 Sol via Codex CLI
**Model requested:** gpt-5.6-sol (via ambient `ORCHESTRA_REVIEW_MODEL`; see pre-flight below)
**Pinned Range:** efe9977..fb20e44 (WO-12 corpus tooling rounds 3–7, delta)
**Date:** 2026-08-31
**Attempt Count:** 1 invocation, launched via `run_in_background` per the openai-5 Conductor ruling — **COMPLETED, verdict produced**
**Launch timestamps (pre-flight, UTC and local):** `Mon Aug 31 11:59:23 UTC 2026` / `Mon Aug 31 04:59:23 PDT 2026`
**Background task:** id `b3lu44j25`, exit code 0, notified complete

---

## Pre-flight (verbatim, single Git Bash invocation, foreground)

Command run:

```
set -x
date -u
date
env | grep -iE 'CODEX|ORCHESTRA' || true
echo "---export CODEX_BIN---"
export CODEX_BIN="C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe"
ls -la "$CODEX_BIN"
sha256sum "$CODEX_BIN"
"$CODEX_BIN" --version
```

Output:

```
++ date -u
Mon Aug 31 11:59:23 UTC 2026
++ date
Mon Aug 31 04:59:23 PDT 2026
++ env
++ grep -iE 'CODEX|ORCHESTRA'
ORCHESTRA_REVIEW_MODEL=gpt-5.6-sol
PWD=/c/Users/maxtl/Projects/Claude-Orchestra
PATH=/c/Users/maxtl/bin:/mingw64/bin:/usr/local/bin:/usr/bin:/bin:...(PATH contents omitted here for length; PATH itself matched the grep only because it printed among the env block, not because it names CODEX/ORCHESTRA; full PATH included the Codex bin directory /c/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin)...
++ echo '---export CODEX_BIN---'
---export CODEX_BIN---
++ export CODEX_BIN=C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe
++ CODEX_BIN=C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe
++ ls -la C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe
-rwxr-xr-x 1 maxtl 197609 313958192 Aug 29 02:47 C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe
++ sha256sum C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe
cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4 *C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe
++ C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe --version
codex-cli 0.151.0
```

**Key pre-flight fact:** identical to openai-5 — only `ORCHESTRA_REVIEW_MODEL=gpt-5.6-sol` was present among `CODEX*`/`ORCHESTRA*` variables before `CODEX_BIN` was set explicitly in this shell. Resolved engine:
- Path (as set): `C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`
- SHA-256: `cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4`
- Version: `codex-cli 0.151.0`
- The runner's own preflight (below) further resolved this path through a symlink to `C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.exe` — same version, same install the runner actually invoked.

---

## Exact command line (launched via `run_in_background: true`, per Conductor ruling)

Work order and executor report reused verbatim from attempt 5 (still present on disk, unmodified):
- `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\8a1084ac-23e5-4029-97e1-455d7a8970ee\scratchpad\wo12-r0-openai5-work-order.txt`
- `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\8a1084ac-23e5-4029-97e1-455d7a8970ee\scratchpad\wo12-r0-openai5-executor-report.txt`

```
export CODEX_BIN="C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe"; cd "/c/Users/maxtl/Projects/Claude-Orchestra"; WO="/c/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/8a1084ac-23e5-4029-97e1-455d7a8970ee/scratchpad/wo12-r0-openai5-work-order.txt"; ER="/c/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/8a1084ac-23e5-4029-97e1-455d7a8970ee/scratchpad/wo12-r0-openai5-executor-report.txt"; node packs/codex/hooks/orchestra-review.js --work-order "$WO" --executor-report "$ER" --base-ref efe9977 --head-ref fb20e44 --timeout-ms 3600000 > "/c/Users/maxtl/AppData/Local/Temp/claude/C--Users-maxtl-Projects-Claude-Orchestra/8a1084ac-23e5-4029-97e1-455d7a8970ee/scratchpad/openai6/openai6-runner.out" 2>&1
```

Launched as a single Bash tool call with `run_in_background: true` (task id `b3lu44j25`). No polling was performed; the launcher waited for the completion notification, which arrived reporting exit code 0.

---

## Runner's full output (verbatim, from `openai6-runner.out`)

```
REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ fb20e4401c78)
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.exe
PREFLIGHT: resolved through a link: C:/Users/maxtl/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.exe
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: reclaimed 1 abandoned review worktree(s) from a prior run — git's records are clean, but 1 directory(ies) could not be deleted (a process from the earlier run is probably still holding them; they are harmless leftovers): C:\Users\maxtl\AppData\Local\Temp\orchestra-review-wXYXAI
PREFLIGHT: auth/exec probe: ok in 5649ms
PREFLIGHT: pinned review: checked out fb20e4401c78 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-LInY11\attempt-1\wt); the session's uncommitted files are not visible to the engine

VERDICT: REVISE

FINDINGS
- [CRITICAL] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:1079 — the sanitized clone's root is unchecked and its directory exposes the artifact ID — given `--run-clone-root <source-repo>/runs`, the reviewer can traverse to the live `corpus/key.json`; even outside the repo, `pwd` reveals `sdc-NNN`, whose phase-local ranges identify seeded versus control artifacts.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/assemble-key.js:1623 — the rendered stopping standard is descriptive but unenforced and omits protocol §2.1(xii)'s required sub-80% classifier result — given this round-7 corpus with no `blind-read.json`, `--check-only` exits 0 and reports every lint passing even though CONSTRUCTION.md:339 says the required fresh blind-read evidence is "NOT RECORDED."
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:794 — any line-shaped `served_model:` prose anywhere in reviewer stdout is treated as vendor identity evidence — given an echoed Terra engine header plus a wrapped FINDINGS line `served_model: gpt-5.6-terra`, `classifyIdentity` returns MATCHED with `independent` evidence, so a silently substituted model can pass gate 5.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/score.js:143 — the FINDINGS window does not end at title-case bare headers despite claiming to end at any header — given `FINDINGS / - none / Verification rerun: / - [MAJOR] src/app.js:10`, the latter bullet remains inside FINDINGS and `evaluateSeedHit` mints a hit instead of scoring a miss.
- [MAJOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/run-lane.js:1073 — resumed execution restarts `runIndex` at zero over `resume.todo` — given a crash after several records, resumed records overlap earlier indexes; score.js reorders tied records by corpus position, so three consecutive UNAVAILABLE executions can become separated and gate 6 can PASS instead of failing the streak limit.
- [MINOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/assemble-key.js:209 — the zero-tolerance label regex misses valid capitalized labels containing one character or digits — given seed-only `A:` or `Risk 2:`, `extractLabels` returns empty and assembly passes instead of rejecting the label tell.
- [MINOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/assemble-key.js:1121 — sentence splitting requires the following sentence to begin with an uppercase letter — given `Done. continue with enough filler words to make the combined token count exceed eight.`, the one-word sentence is merged into a 14-word sentence and passes the eight-word floor.
- [MINOR] [BREACH] plans/cross-compare/agent-role-architecture/wo12/blind-draw.js:165 — greedy seeded-first selection can report a shortfall despite a feasible balanced draw — given three seeds, two controls, only `s1` linked to `c1`, size 2, and seed `"0"`, it selects `s1,s3` then only `c2`, returning a control shortfall instead of choosing feasible `s2,s3,c1,c2`.

CLAIMS CHECKED
- "node --test tests/wo12-tooling.test.js -> 815 passed, 0 failed" → CONFIRMED (ran the permitted test file once: 815 passed, 0 failed in 66.6 seconds).
- "809 checks at 54b6eeb; later commits made no check-count change" → REFUTED (`git diff 54b6eeb..HEAD` shows six tests added by 9af9320; HEAD runs 815).
- "briefs regenerated from sealed content; every brief matches generation exactly" → CONFIRMED (`assemble-key.js --check-only` exited 0 for all 84 slots and reported zero drift).
- "all gates pass; stopping standard met" → REFUTED (mechanical lints pass, but the required fresh blind-read record is absent and the classifier threshold is not evaluated).
- "no sha-like tokens appear in the 168 briefs" → CONFIRMED (the focused suite scanned every brief and found none).
- "identity parses served_model first; contradiction fails; absence is LIMITED" → REFUTED (well-formed direct cases behave as stated, but a prose field outside the engine header is accepted as independent served-model evidence).
- "the FINDINGS window ends at any subsequent header" → REFUTED (a title-case `Verification rerun:` header remained in the window and produced a mechanical hit).
- "blind-draw is deterministic and never returns both members of a linked component" → CONFIRMED (exported-function probes and the focused suite reproduced deterministic, pair-safe draws).
- "population-balance, distribution, hex-token, sentence-floor, and unigram gates pass the sealed corpus" → CONFIRMED (`--check-only` passed; independent packet scanning found no current sub-eight-word sentence, while the implementation bypasses above remain).
- "the cleanliness guard fires only on additions, not pre-existing status entries" → CONFIRMED (tests/wo12-tooling.test.js:3907 compares only newly added porcelain lines; the test run left the checkout clean).
- "CI 9/9 green including macOS at 5c65946" → UNVERIFIED (only the committed claim was available; no CI run was independently queried).
- "round-3 blind test was 41.7% and blind test #2 was 24/24" → UNVERIFIED (record files state those results, but the evaluator runs were not reproducible from this checkout).

NITS
- none
```

No `STUB REPORT` or `"stub ran"` text appears anywhere in the output. This is a genuine engine run: the preflight resolved the real Codex binary through its symlink to the standalone 0.151.0 release, completed an auth/exec probe (5649ms), checked out the pinned head `fb20e4401c78` into a fresh worktree, and returned a substantive `VERDICT: REVISE` with 8 findings and 12 claims checked.

---

## Verdict

**VERDICT: REVISE.** Not VOID — the runner completed, produced a full findings/claims/nits report, and contains no stub markers.

**Findings by severity:**
- **CRITICAL (1):** `run-lane.js:1079` — sanitized-clone root path is unchecked and its directory name leaks the artifact ID (`sdc-NNN`), letting a reviewer infer seeded-vs-control status or traverse to the live `corpus/key.json` via `--run-clone-root`.
- **MAJOR (4):**
  - `assemble-key.js:1623` — stopping standard is rendered but not enforced; `--check-only` exits 0 even when the required fresh blind-read (protocol §2.1(xii) sub-80% classifier result) is absent/"NOT RECORDED."
  - `run-lane.js:794` — any `served_model:` line anywhere in reviewer stdout (not just the engine header) is accepted as independent identity evidence, so an echoed foreign-engine header plus a crafted FINDINGS line can spoof gate 5's identity check.
  - `score.js:143` — the FINDINGS-window terminator misses title-case bare headers (e.g. `Verification rerun:`), so trailing bullets after such a header are still scored as findings inside the window, producing false seed hits.
  - `run-lane.js:1073` — resumed execution restarts `runIndex` at 0 instead of continuing from `resume.todo`, letting `score.js`'s tie-reordering separate consecutive UNAVAILABLE executions so gate 6's streak-limit check can be evaded.
- **MINOR (3):**
  - `assemble-key.js:209` — zero-tolerance label regex misses short/digit-containing capitalized labels (`A:`, `Risk 2:`), so those label tells pass assembly instead of being rejected.
  - `assemble-key.js:1121` — sentence-splitting requires the next sentence to start uppercase, so a lowercase-starting short sentence gets merged into a longer one and passes the eight-word floor it should fail.
  - `blind-draw.js:165` — greedy seeded-first selection can report an infeasible-shortfall false negative when a feasible balanced draw exists.
- **NITS:** none.

**Claims checked:** 12 total — 6 CONFIRMED, 4 REFUTED (check-count parity, "all gates pass"/stopping-standard-met, identity-parsing-is-safe, FINDINGS-window-termination), 2 UNVERIFIED (CI green claim, historical blind-test percentages — not independently reproducible from this checkout).

---

## Assessment

This attempt succeeded where openai-5 failed: launching the identical runner invocation via `run_in_background: true` instead of holding it in the Bash tool's 10-minute-capped foreground let the review run to completion inside its own 60-minute budget (engine execution plus the 815-test permitted suite run, ~66.6s of that total), and the launcher received a clean exit-0 notification with no manual polling. The pre-flight reproduces openai-5's environment and binary identity exactly (same SHA-256, same `codex-cli 0.151.0`), and the runner's own preflight additionally confirms it resolved and ran that same binary through its install symlink, so there is no fixture-substitution or stub concern for this record. The review itself is substantive and internally consistent: it reproduces and extends the round-2 CRITICAL/MAJOR findings the work order asked it to re-check (the artifact-ID-leak path from `--run-clone-root`, the spoofable identity gate, and a still-partial blinding channel), while also confirming that six of the specific mechanical claims in the executor report hold (regenerated-briefs drift-free, no SHA leakage in briefs, deterministic pair-safe blind draws, cleanliness guard scoped correctly) and flagging two claims as unverifiable from a static checkout (CI status, historical blind-test percentages) rather than guessing. Net effect: the OpenAI-lane R0 delta review of WO-12 tooling rounds 3–7 is no longer OUTSTANDING — it returned a REVISE verdict with one CRITICAL and four MAJOR findings that should be weighed against the Anthropic-lane review before any trial pass is authorized.

---

## Record path

`C:\Users\maxtl\Projects\Claude-Orchestra\roster\wo12-r0-review-openai-6.md` (this file). Not committed, per instructions.

---

## Conductor rulings (2026-08-31)

First substantive cross-vendor verdict on WO-12 tooling rounds 3–7 (attempts 1–3
REVIEW_UNAVAILABLE at the 30-min cap; 4 VOID stub engine; 5 VOID foreground cap).
Engine verified by pre-flight: `codex-cli 0.151.0`, sha256 `cf682658…`. REVISE accepted
in full; folded into round 8 (opened on `wo12-r0-review-anthropic-5.md`).

**Cross-vendor convergence.** Four findings coincide with the Anthropic lane's,
reached independently and blind to it: the identity gate is spoofable from engine text
(= anthropic CRITICAL 1), the FINDINGS window terminator is wrong (= CRITICAL 2, from
the opposite direction — under-termination at Title-case labels vs over-termination at
severity subheads; both are true and the round-8 rule reconciles them), the run clone
directory names the artifact id (= MAJOR 5a), and the sentence splitter is evadable by a
lowercase-initial sentence (= MAJOR 3). That is the §3.4 cross-family mandate doing
what it is for.

| # | Ruling | Disposition |
|---|---|---|
| CRITICAL (run-lane.js:1079) | ACCEPTED | Beyond the id-named directory (already ruled), the `--run-clone-root` path is unchecked: a root inside the repository lets a clone reach the live `corpus/key.json` by relative path. run-lane.js refuses any root inside the repository or its worktrees (build-corpus.js's nested-clone resolution reused). |
| MAJOR (assemble-key.js:1623) | ACCEPTED | The stopping standard is rendered, not enforced. `--check-only` gains a `SEAL:` line and exits 1 when `blind-read.json` is absent, stale (content hash mismatch) or above the ≤65% target; the arm-(8) purity gate is the in-tool proxy for the classifier arm. `--no-seal` for interim content work. |
| MAJOR (run-lane.js:794) | ACCEPTED — same fix as anthropic CRITICAL 1 | `served_model` honoured only from the runner's pre-delimiter header block. |
| MAJOR (score.js:143) | ACCEPTED, reconciled | Title-case/ALL-CAPS bare labels ending in `:` terminate the window unless the word is a severity/bucket word. |
| MAJOR (run-lane.js:1073) | ACCEPTED | `runIndex` becomes the absolute position in the deterministic run order, persisted per record; gate 6's streak survives a resume. |
| MINOR ×3 | ACCEPTED | Label regex widened (`A:`, `Risk 2:`); splitter fix as anthropic MAJOR 3; blind-draw backtracks before reporting a shortfall. |

Claims the lane REFUTED (check-count parity, "all gates pass", identity-parsing safety,
FINDINGS-window termination) are accepted as refuted; "all gates pass" was true of the
gates that existed and false of the standard — which is the point of MAJOR 1/anthropic
and this lane's assemble-key.js:1623.
