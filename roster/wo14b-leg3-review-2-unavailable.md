# WO-14b leg 3 — cross-vendor review #2 attempt 1: REVIEW_UNAVAILABLE (reportable event) — 2026-09-01

Pinned `5ac3835..4bbc58b`, Sol · high via Codex CLI. Codex exited 1 after 426 s with `ERROR: This content was flagged for possible cybersecurity risk` (twice) — the second OpenAI cyber-classifier refusal on this leg (the E7 primary was the first). The runner produced no verdict and states: do NOT treat this change as reviewed. Leg 3 remains UNREVIEWED at mandatory policy until a cross-family verdict exists; the Anthropic lane is same-family (Sonnet-authored) and cannot close it.

## Salvaged from the aborted attempt (engine probes visible in the attempt log; not a verdict)

1. **Project move defeats the pin.** Probe: `install.js <old> --roster new` (pin written) → guard with undetermined model → DENY; `Move-Item <old> <new>` → guard → ALLOW (blank output); `--verify-pin` on the moved dir → `NO-PIN`. The pin is keyed by sha256(realpath); a moved or renamed project is unpinned and falls back to legacy stand-down. Disposition: leg-3 fix round 2 — a moved project must fail CLOSED under a manifest that says new (e.g. key the pin by a project id stored in the manifest, signed by the pin, rather than by path alone; or refuse when the manifest says new and no pin resolves).
2. **Regex rejection bypass.** `^(a|aa)+$` — 200-char cap and nested-quantifier check both pass — took 22.3 s on a 29-char input vs 186 ms on a shorter one. Disposition: leg-3 fix round 2 — alternation-inside-repetition must be rejected too, or matching must run under a hard time bound.

## Action
One retry of the cross-vendor review with the framing reworded to spec-conformance language (the adversarial half is covered by the E7 Anthropic mirror re-verification running in parallel). If the retry is refused as well, leg 3 takes the mandatory-review-unavailable path (wait / named human / park) and the gate does not close on it.

---

REVIEW ENGINE: NONE — no cross-vendor review was produced.
ATTEMPTED: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 4bbc58b4cb39)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5443ms
PREFLIGHT: pinned review: checked out 4bbc58b4cb39 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-UC6x1w\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVIEW_UNAVAILABLE

REASON
- Codex exited with status 1

DETAIL
  No attempt produced a verdict. Per-attempt attribution — who killed the engine, how long it ran against its cap, and what it last wrote — is in the ATTEMPT LOG below.

FINALITY: this runner made 1 engine attempt and will make no more. This is the ONE, FINAL
outcome of this review; there is no later verdict coming from this run.

The cross-vendor reviewer did not run, and nothing below this line came
from an OpenAI model. Do NOT treat this change as reviewed, and do not
attribute any later verdict to the cross-vendor engine on the strength of
this report. The Director routes this review to the default Opus reviewer
and notes the cross-vendor pass did not run (retry once conditions are
fixed, if the user wants the cross-vendor opinion).

--- ATTEMPT LOG (diagnostics for the attempt(s) that produced nothing) ---
(attempt-log tail omitted: contains the reviewer probe commands and codex session excerpts; see the scratch log)
