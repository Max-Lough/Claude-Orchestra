# Field-validation checklist — the MCP transport, v1.10.0

For the next **gate-class review** and the next **ordered execution** run by a
project that installed this pack (`node install.js <project> --packs codex`).
The master's suites (`node tests/mcp-lane.test.js` plus the review/exec lanes,
~270 checks) prove the mechanics against a stub engine; this checklist proves
the new transport against the real Codex CLI on real work.

The 1.10.0 change is that launchers no longer shell out — each makes one
blocking `orchestra_*` MCP tool call and relays the result. What needs field
proof is exactly the seam the stub cannot stage: a real engine, running
minutes-long, under a real Director's round.

## Before the round

- [ ] The install is v1.10.0: the project's root `.mcp.json` carries
      `orchestra-engine`, `.claude/hooks/orchestra-engine-mcp.js` exists, and
      the three launcher profiles' `tools:` lines name MCP tools, not Bash.
- [ ] The project MCP server has been **approved** in Claude Code (first
      launch prompts once). Until then every lane reports unavailable —
      that state should be loud, not confusing; note how it presented.
- [ ] `orchestra_doctor` (or `node .claude/hooks/orchestra-review.js
      --doctor`) exits 0.

## During the round — read what the launcher relays

- [ ] **The relay is the runner's report, verbatim.** Header first
      (`REVIEW ENGINE:` / `EXEC ENGINE:`), settings with their sources, the
      checkout line on a review, `TREE AUDIT` + `REPORT INTEGRITY` on an
      exec. A relay that paraphrases, drops the header, or adds a diagnosis
      in the launcher's own voice is a profile regression — capture it
      verbatim and report it.
- [ ] **The blocking call held for the full runner duration.** A real review
      is minutes to tens of minutes. Record the wall clock. If the tool call
      itself was cut short (a result that is neither a runner report nor an
      `MCP TRANSPORT ERROR`, or the subagent reporting a tool timeout), that
      is the one operational risk this transport carries — record the exact
      duration and how it presented. Measured pre-release: 1800 s holds,
      top-level and nested; nothing longer has been proven.
- [ ] **On any failure, the voice identifies the layer.** Engine/runner
      failures arrive as the runner's own grammar (`REVIEW_UNAVAILABLE` under
      `REVIEW ENGINE: NONE`, with `FINALITY:`); transport failures arrive as
      `MCP TRANSPORT ERROR (orchestra-engine server, not the engine)` with
      the captured output labelled `NOT a runner report`. A failure wearing
      the wrong voice is the exact class this release exists to kill.
- [ ] **One call, one outcome.** The review runner may chain attempts
      internally (`ATTEMPT CHAIN:` in the header) — but the Director must
      receive exactly one report per order, and no launcher may have called a
      tool twice outside the documented transport-error exception.

## After the round

- [ ] Note total wall clock, and whether any `MCP TRANSPORT` line appeared.
- [ ] The retired failure modes must not resurface in new clothes: no scratch
      output files under `.claude/scratch/` written by a *launcher* (the
      server's own `mcp/` run dirs are expected), no sentinel strings, no
      launcher polling. If a launcher improvised shell access it does not
      have, report how.
- [ ] File anything engine-caused upstream as before (see "What this harness
      cannot fix" in `packs/codex/README.md`).

A round is validated when: the launcher's relay was the runner's report
verbatim, the blocking call outlived the runner on every order, every failure
spoke in its own layer's voice, and exactly one report reached the Director
per order.
