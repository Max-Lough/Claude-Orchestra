# WO-14b leg 2 — cross-vendor review #2 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `dfcfc9b..fa01a03` (the fix round answering review #1; throwaway worktree). Author family: anthropic (Sonnet 5 Builder; Fable 5 Conductor). Policy: mandatory, gate-class. Launched 05:10Z, exit 0 at 05:16:16Z; `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ fa01a0317b8e)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 37s
PREFLIGHT: pinned review: checked out fa01a0317b8e into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-B01Ajm\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] router/tickets.js:264 — lock ownership validation has a check-to-write race — given a holder is paused after reading its valid token, a stale-lock taker can acquire, update, and release before the holder writes; a deterministic two-process probe had both writers report success but produced generation 2 instead of 3, silently overwriting one update.
- [MAJOR] [BREACH] router/tickets.js:273 — store state commits before the corresponding event append, with no recovery or rollback — given the JSONL path becomes unwritable after lock acquisition, `tickets.json` records the operation and the caller receives an error while no audit event exists; reproduced with one persisted ticket and zero event records.
- [MAJOR] [BREACH] registry/schemas/dispatch-request.schema.json:50 — the restored M0 video/audio guard is unreachable through the public request contract — given a Conductor submits `medium:"videoAudio"`, validation rejects it as an additional property; without that field M0 dispatches successfully, rather than returning `UNAVAILABLE`, while only an internal `castOpts.medium` injection reaches the guard.
- [MINOR] [BREACH] router/tickets.js:427 — expiry-triggered launch/resolve refusals omit their denial event — given a late launch, the ticket records a `launch` attempt and transitions to `EXPIRED`, but JSONL contains only `expire`, not the required denial line; reproduced as events `[issue, consume, expire]` with attempts `[launch]`.

CLAIMS CHECKED
- "CAS stale-lock takeover prevents lost updates and silent overwrites" → REFUTED (forced process preemption after token validation; both writers succeeded, final generation was 2 instead of expected 3).
- "launch()/resolve() expire past expires_at while a RESOLVED ticket is never retroactively expired" → CONFIRMED (source inspection, focused expiry probe, and ticket suite).
- "direct-role resolveSeat returns typed DISABLED" → CONFIRMED (router probes and suite cover Sweeper, re-enabling, and disabled Architect).
- "registry/load.js reports 8 schemas and fails closed on drifted new-schema class enums" → CONFIRMED (independent loader and registry suite).
- "Q0 gate requires kind 'q0' and LAUNCHED-or-later" → CONFIRMED (source inspection and wrong-kind/missing/not-launched probes).
- "M0 videoAudio UNAVAILABLE boundary restored via castOpts.medium" → REFUTED (internal injection works, but dispatch-request validation makes the discriminator unrepresentable at the bridge boundary).
- "E1 contextShapesOnly:['packet'] restores the packet-only ceiling" → CONFIRMED (scoped, subsystem, and haystack reject; packet accepts).
- "12 retired charters removed and strict charter cross-check restored" → CONFIRMED (11 live entries and tampered-extra-charter test).
- "Declared verification is green" → CONFIRMED (independently ran all declared commands; registry 33, tickets 70, router 193, quartermaster 216, frontmatter 37, and both lint modes passed).
- "STATUS: DONE" → REFUTED (the lock still permits silent lost updates and the M0 public contract remains incomplete).
- "104 tool calls against an 80-call ceiling" → UNVERIFIED (self-reported, but no raw call telemetry exists in the pinned checkout).

NITS
- none
== exit 0 2026-09-01T05:16:16Z ==
