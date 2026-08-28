# Probe runbook — WO-1 (allowance draw) and WO-2 (review throughput)

These two probes run BEFORE anything in the architecture plan is built:
nothing downstream proceeds on unmeasured assumptions. Both are self-contained
under `probes/`; neither modifies the harness.

WO-3 (Gemini access) is withdrawn — the Google lane was removed by the owner.
Nothing Gemini-related exists here.

---

## WO-1 — measure real subscription-allowance draw

**Instrument:** `probes/orchestra-telemetry.js`, a PostToolUse + SubagentStop
hook that appends one JSON line per event to `.claude/orchestra-ledger.jsonl`
in the instrumented project.

### Setup (in the project you actually work in, for one weekly cycle)

1. Copy the script into the working project (or reference it in place with an
   absolute path — copying is safer if this checkout moves):

   ```
   copy probes\orchestra-telemetry.js <project>\.claude\hooks\orchestra-telemetry.js
   ```

2. Add BOTH hook blocks to the project's `.claude/settings.json` (merge into
   any existing `hooks` object; the PostToolUse matcher `""` fires on every
   tool call):

   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "",
           "hooks": [
             {
               "type": "command",
               "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-telemetry.js\""
             }
           ]
         }
       ],
       "SubagentStop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-telemetry.js\""
             }
           ]
         }
       ]
     }
   }
   ```

3. Work normally for one weekly cycle. The hook is silent, always exits 0,
   and cannot block or brick a session; failures degrade to
   `{"telemetry_error": ...}` ledger lines.

4. At week's end, produce the WO-1 table:

   ```
   node .claude/hooks/orchestra-telemetry.js --report
   # or, against an explicit ledger:
   node probes/orchestra-telemetry.js --report <project>/.claude/orchestra-ledger.jsonl
   ```

### What must be recorded MANUALLY alongside the ledger

Hook events cannot see the vendor side. Keep a plain note file (or a row in
the ledger's directory) with, each day and at every notable moment:

- the vendor UIs' remaining-allowance signals (Claude usage panel / `/status`,
  Codex CLI's remaining-allowance line) — with a timestamp, so ledger call
  counts can be lined up against pool movement;
- every observed throttle or rate-limit event: timestamp, what was throttled,
  what message appeared;
- any served-model surprise: a session that answered as a different model than
  requested, or degraded mid-session (note the requested model, the apparent
  served model, and the time).

### The plan's two priority questions for WO-1

1. **Does the seat in use really have a separate Opus weekly bucket** (an
   `AU-opus` distinct from `AU-all`), or is it one pool?
2. **What actually happens at that bucket's edge** — hard refusal, silent
   substitution to a cheaper model, or throttling?

**Safe way to observe the edge:** watch for it during normal heavy use at the
end of the weekly cycle, when the pool is naturally low — note the exact
behavior and timestamps when it happens. Do NOT deliberately exhaust the pool:
the plan's "deliberately exhaust it on a throwaway session" step spends real
weekly allowance and is the owner's call to schedule, not something to run
casually. If the edge never arrives naturally, report that too — "not reached
in a normal week" is itself a WO-1 data point.

### WO-1 stop condition (from the plan)

If a single day's normal work exhausts a pool, stop and re-scope the mandate's
throughput assumptions before anything else proceeds.

---

## WO-2 — probe cross-vendor review throughput

**Instrument:** `probes/orchestra-probe-review.js`. It selects the last N
non-merge commits and drives each through the existing review runner
(`orchestra-review.js`) in pinned mode (`--base-ref <parent> --head-ref
<commit>`), sequentially, measuring wall clock and verdicts.

### Prerequisites

- Codex CLI installed and authenticated (`codex login`, or `OPENAI_API_KEY`).
  Verify first, for free:

  ```
  node packs/codex/hooks/orchestra-review.js --doctor
  ```

- The codex pack installed in the target repo (`.claude/hooks/
  orchestra-review.js`), OR run the probe from this checkout — it falls back
  to `packs/codex/hooks/orchestra-review.js` automatically.

### Procedure

1. **Dry run first** — free; prints the commit list and the exact commands:

   ```
   node probes/orchestra-probe-review.js --dry-run --repo <target-repo>
   ```

2. **Initial real probe — 5 reviews** (the default). Each review is a full
   Codex engine run: minutes of wall clock and real allowance each. The probe
   refuses without `--yes`.

   ```
   node probes/orchestra-probe-review.js --repo <target-repo> --yes --peak <n>
   ```

   `--peak <n>` is the operator's expected peak gate-class review arrivals per
   5-hour window; without it the stop condition is reported as not evaluated.

3. **Scale to 20** only if the first batch looks sane (verdicts real, wall
   clocks plausible, no UNAVAILABLE streak):

   ```
   node probes/orchestra-probe-review.js --count 20 --repo <target-repo> --yes --peak <n>
   ```

   The plan's full probe wants >= 20 representative changes.

Briefs and full runner outputs for every review are kept in the scratch
directory the probe prints, for post-hoc audit of any surprising verdict.

### Reading the stop condition

The probe projects sequential-lane capacity as `5h / mean wall clock` and
compares it to `--peak`:

- **capacity < 1.3x peak** — the plan's WO-2 stop condition trips: provision a
  larger tier, shrink expected gate-class volume, or hold the mandate's
  activation. Exit code 1.
- **1.3x <= capacity < 1.43x** — passes the stop condition but violates the
  acceptance gate's <= 70% reviewer-utilization ceiling (1/0.7 = 1.43x). The
  lane would run hot; treat as a warning.
- **capacity >= 1.43x peak** — OK.

---

## Coverage — what this scaffolding delivers, and what it cannot

Covered by these scripts:

- WO-1: per-day, per-model/agent-type **call counts and wall clock** from hook
  events; the weekly report table.
- WO-2: **reviews completed, mean/P95 wall clock, projected reviews per
  5-hour window, stop-condition check** for the sequential cross-vendor lane;
  per-review verdict/UNAVAILABLE capture with a kept audit trail.

Still needs a human, or a later instrumented run (not scaffoldable without
touching existing files or vendor internals):

- **Token-level draw** and per-call allowance-unit costs — not exposed by hook
  events; needs vendor usage exports or API-side metering.
- **Bucket ratios and remaining-bucket state** (`AU-all` / `AU-opus` /
  `AU-fable` / `OU`) — manual vendor-UI readings, recorded alongside the
  ledger as described above.
- **Time-to-throttle per bucket** and the Opus-bucket edge behavior — manual
  observation (see the safe-edge note); a deliberate exhaustion run is the
  owner's decision.
- **Served-model verification** (does the served model self-identify as
  requested near the edge) — manual.
- WO-2's **turns per review and pool movement** — the runner does not emit a
  turn count, and pool movement is a vendor-UI reading taken before/after the
  probe run; record both manually. Wall clock and verdict are what the probe
  captures.
- WO-2's **Fable -> Sol Conductor checkpoint handoff drill** (Conductor re-cast
  to Fable 5 by owner ruling 2026-08-28) — a synthetic control-plane exercise
  involving live sessions, not scriptable here.
