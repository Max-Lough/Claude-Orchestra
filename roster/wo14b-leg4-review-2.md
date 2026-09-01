# WO-14b leg 4 — cross-vendor review #2 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Delta re-review, pinned `0915a57..469e75e` (the leg-4 fix round + 4-fix-b + the merge), confined to the bridge/engine/wiring files. Author family: anthropic (Sonnet 5 Builders; merge agent). Policy: mandatory. `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0. Sandbox-environmental: mcp-lane 97/99 (taskkill), install stopped at the containment fixture, exec-lane 2 global-git failures — all green here.

Leg 4 review history: #1 10 MAJOR/4 MINOR/1 NIT → #2 8 MAJOR/2 MINOR (one of the eight — manifest/guard fingerprint alignment — is superseded by the leg-3R closed regime, where the guard no longer selects mode from fingerprints).

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 469e75e7d4f4)
REVIEW RUN NONCE: 23118dc0fa840343
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 7843ms
PREFLIGHT: pinned review: checked out 469e75e7d4f4 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-KXkbCG\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] bridge/hooks/ticket-gate.js:46 — runtime loading happens outside the fail-closed wrapper — given a roster:new installation with a missing or unloadable runtime, the hook exits 1 without decision JSON instead of exiting 0 with a denial; reproduced with `MODULE_NOT_FOUND`.
- [MAJOR] [BREACH] packs/codex/hooks/orchestra-engine-mcp.js:170 — trusted legacy flips are incorrectly reclassified as roster:new — given a successful new-to-legacy flip, the retained runtime directory triggers the fingerprint check and `orchestra_exec` returns `TICKET_REQUIRED` instead of ignoring tickets under legacy.
- [MAJOR] [BREACH] packs/codex/hooks/orchestra-engine-mcp.js:139 — cd-scoped module loading remains rooted at the server project — given a plain legacy server and a separate trusted roster:new `cd` target with a fresh LAUNCHED ticket, the server cannot load the target’s manifest/runtime modules and returns `TICKET_REQUIRED` instead of executing the valid ticket.
- [MAJOR] [BREACH] packs/codex/hooks/orchestra-engine-mcp.js:880 — the ticket does not constrain the model or effort passed to Codex — given a Luna/medium ticket, a caller can submit `model:gpt-5.6-sol, effort:xhigh`; the probe invoked Sol/xhigh successfully instead of rejecting the casting mismatch, bypassing routing and Sol-reserve policy.
- [MAJOR] [BREACH] bridge/runtime.js:743 — engine identity bookkeeping records invented or launcher identities — given that same run, the runner reported nonce `02f927554d2e8f58` and Sol, while `engine_pass` stored unrelated nonce `d71d53186c8d7b6a` and `launched.served_model` remained `claude-haiku` instead of recording the actual engine identity required by the order.
- [MAJOR] [BREACH] packs/codex/hooks/orchestra-engine-mcp.js:873 — enginePass is committed before argument validation — given a valid LAUNCHED ticket with missing `work_order`, the server returns the parameter error but permanently records `engine_pass`; a corrected second call returns `TICKET_REPLAY` although Codex was never invoked.
- [MAJOR] [BREACH] router/tickets.js:1376 — enginePass accepts expired capabilities — given a ticket launched before expiry and used after `expires_at`, `enginePass()` succeeds and leaves it LAUNCHED instead of refusing or expiring it.
- [MAJOR] [BREACH] bridge/manifest.js:155 — manifest trust still disagrees with the guard — given an unpinned project containing only `.claude/orchestra/tickets/`, `readTrustedManifest()` returns inert legacy while the guard treats the same state as untrusted roster:new and denies Agent, violating the required exact rule alignment.
- [MINOR] [BREACH] install.js:1596 — gate-hook ownership remains substring-based — given a user hook command containing `.claude/orchestra/bridge/hooks/ticket-gate.js` as an argument or backup-path prefix, installer transitions remove it instead of removing exactly Orchestra’s entries.
- [MINOR] [BREACH] roster/wo14b-activation-bridge-progress.md:44 — the mandatory 80-call checkpoint ceiling was exceeded — given the explicit `80 calls → CHECKPOINT` order, the continuation ran 119 calls before ending instead of checkpointing at the ceiling.

CLAIMS CHECKED
- "Green E1 selects Luna, builder-openai, and author_family openai" → CONFIRMED (`node tests/bridge.test.js` independently passed the served-casting assertion).
- "Agent Pre/Post → enginePass → one stub invocation → second call TICKET_REPLAY with zero additional invocations" → CONFIRMED (`node tests/mcp-lane.test.js` reached and passed every two-pass assertion).
- "bridge/manifest.js unavailable with a roster:new fingerprint → TICKET_REQUIRED, zero invocations" → CONFIRMED (`node tests/mcp-lane.test.js` case 12 passed).
- "cd-scoped enforcement" → REFUTED (a focused probe supplied a fresh valid LAUNCHED ticket for the trusted cd target and still received `TICKET_REQUIRED` because module lookup stayed rooted at the legacy server).
- "role/vendor binding" → CONFIRMED (independent MCP tests refused wrong-role and Anthropic tickets without invoking the stub).
- "medium → UNAVAILABLE, CONFIG_CHANGED, STORE_UNAVAILABLE, ROUTING_LOG_UNAVAILABLE, malformed-legacy inertness, case-sensitive hash, and parent_ticket" → CONFIRMED (`node tests/bridge.test.js` passed all corresponding sections).
- "orchestra_dispatch exposes the request schema at top level" → CONFIRMED (`node tests/mcp-lane.test.js` accepted the top-level request and rejected the wrapper).
- "the installer initializes the store and preserves the specifically tested node tools/ticket-gate.js user hook" → CONFIRMED (`node tests/install.test.js` passed those sections before the sandbox-only containment fixture stopped the suite).
- "bridge/README.md engine-ticket lifecycle rewritten for the two-pass model" → REFUTED (the implementation records an unrelated random nonce and the Haiku launcher model, while allowing the caller to run a different engine casting).
- "one reconciled manifest implementation remains with no dead code and exact guard agreement" → REFUTED (the no-pin fingerprint branch is duplicated and unreachable at bridge/manifest.js:381, and a tickets-only probe produced opposite runtime/guard roster decisions).
- "merged tree: bridge 121, mcp-lane 99, guard 153, install 348, tickets 160; declared verification green" → UNVERIFIED (bridge 121, guard 153, tickets, and lints passed; MCP had 97 passes plus two sandbox taskkill failures, install stopped at the sandbox containment fixture, and exec had two managed-global-Git failures).
- "115 and 119 calls were recorded breaches against the 80-call ceiling" → CONFIRMED (the committed progress record and executor report both record the overrun).

NITS
- bridge/manifest.js:381 duplicates the immediately preceding fingerprint branch and can never execute; remove it and the now-unused engine identity extractors/comments during the fix.

```verdict-json
{
  "verdict": "REVISE",
  "findings": [
    {
      "severity": "MAJOR",
      "path": "bridge/hooks/ticket-gate.js",
      "line": 46,
      "claim": "runtime loading happens outside the fail-closed wrapper",
      "reproduced": true,
      "evidence": "A copied roster:new hook with runtime.js absent exited 1 with MODULE_NOT_FOUND and emitted no decision JSON."
    },
    {
      "severity": "MAJOR",
      "path": "packs/codex/hooks/orchestra-engine-mcp.js",
      "line": 170,
      "claim": "trusted legacy flips are incorrectly reclassified as roster:new",
      "reproduced": true,
      "evidence": "After successful --roster new then --roster legacy installs, orchestra_exec returned TICKET_REQUIRED because the retained runtime directory matched the fingerprint."
    },
    {
      "severity": "MAJOR",
      "path": "packs/codex/hooks/orchestra-engine-mcp.js",
      "line": 139,
      "claim": "cd-scoped module loading remains rooted at the server project",
      "reproduced": true,
      "evidence": "A legacy-rooted server rejected a fresh LAUNCHED ticket from a trusted roster:new cd target before ticket validation because target bridge modules were not loaded."
    },
    {
      "severity": "MAJOR",
      "path": "packs/codex/hooks/orchestra-engine-mcp.js",
      "line": 880,
      "claim": "the ticket does not constrain the model or effort passed to Codex",
      "reproduced": true,
      "evidence": "A GPT-5.6 Luna/medium ticket successfully ran the stub with gpt-5.6-sol/xhigh supplied by the caller."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/runtime.js",
      "line": 743,
      "claim": "engine identity bookkeeping records invented or launcher identities",
      "reproduced": true,
      "evidence": "Runner nonce 02f927554d2e8f58 differed from engine_pass nonce d71d53186c8d7b6a, and launched.served_model remained claude-haiku while Sol ran."
    },
    {
      "severity": "MAJOR",
      "path": "packs/codex/hooks/orchestra-engine-mcp.js",
      "line": 873,
      "claim": "enginePass is committed before argument validation",
      "reproduced": true,
      "evidence": "A missing-work_order call recorded engine_pass; the corrected retry returned TICKET_REPLAY despite zero engine invocation."
    },
    {
      "severity": "MAJOR",
      "path": "router/tickets.js",
      "line": 1376,
      "claim": "enginePass accepts expired capabilities",
      "reproduced": true,
      "evidence": "A 500ms ticket was consumed and launched, then enginePass succeeded after expires_at and left status LAUNCHED."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/manifest.js",
      "line": 155,
      "claim": "manifest trust still disagrees with the guard",
      "reproduced": true,
      "evidence": "With only .claude/orchestra/tickets and no pin, the bridge returned roster legacy/unpinned while the guard returned a roster:new Agent denial."
    },
    {
      "severity": "MINOR",
      "path": "install.js",
      "line": 1596,
      "claim": "gate-hook ownership remains substring-based",
      "reproduced": false,
      "evidence": "The classifier uses command.includes(GATE_HOOK_MARK), so user commands containing the managed path as an argument or longer backup path are classified as Orchestra-owned."
    },
    {
      "severity": "MINOR",
      "path": "roster/wo14b-activation-bridge-progress.md",
      "line": 44,
      "claim": "the mandatory 80-call checkpoint ceiling was exceeded",
      "reproduced": true,
      "evidence": "The committed record reports 115 and 119 calls and labels both as process breaches."
    },
    {
      "severity": "NIT",
      "path": "bridge/manifest.js",
      "line": 381,
      "claim": "duplicate unreachable fingerprint branch remains after merge",
      "reproduced": false,
      "evidence": "The same hasRosterNewFingerprint condition and return appear immediately at line 366, making the second branch dead."
    }
  ],
  "claims_checked": [
    {
      "claim": "Green E1 selects Luna, builder-openai, and author_family openai",
      "result": "CONFIRMED",
      "how": "node tests/bridge.test.js independently passed the served-casting assertion."
    },
    {
      "claim": "Agent Pre/Post → enginePass → one stub invocation → second call TICKET_REPLAY with zero additional invocations",
      "result": "CONFIRMED",
      "how": "node tests/mcp-lane.test.js reached and passed every two-pass assertion."
    },
    {
      "claim": "bridge/manifest.js unavailable with a roster:new fingerprint → TICKET_REQUIRED, zero invocations",
      "result": "CONFIRMED",
      "how": "node tests/mcp-lane.test.js case 12 passed."
    },
    {
      "claim": "cd-scoped enforcement",
      "result": "REFUTED",
      "how": "A focused probe supplied a fresh valid LAUNCHED ticket for the trusted cd target and still received TICKET_REQUIRED because module lookup stayed rooted at the legacy server."
    },
    {
      "claim": "role/vendor binding",
      "result": "CONFIRMED",
      "how": "Independent MCP tests refused wrong-role and Anthropic tickets without invoking the stub."
    },
    {
      "claim": "medium → UNAVAILABLE, CONFIG_CHANGED, STORE_UNAVAILABLE, ROUTING_LOG_UNAVAILABLE, malformed-legacy inertness, case-sensitive hash, and parent_ticket",
      "result": "CONFIRMED",
      "how": "node tests/bridge.test.js passed all corresponding sections."
    },
    {
      "claim": "orchestra_dispatch exposes the request schema at top level",
      "result": "CONFIRMED",
      "how": "node tests/mcp-lane.test.js accepted the top-level request and rejected the wrapper."
    },
    {
      "claim": "the installer initializes the store and preserves the specifically tested node tools/ticket-gate.js user hook",
      "result": "CONFIRMED",
      "how": "node tests/install.test.js passed those sections before the sandbox-only containment fixture stopped the suite."
    },
    {
      "claim": "bridge/README.md engine-ticket lifecycle rewritten for the two-pass model",
      "result": "REFUTED",
      "how": "The implementation records an unrelated random nonce and the Haiku launcher model while allowing the caller to run a different engine casting."
    },
    {
      "claim": "one reconciled manifest implementation remains with no dead code and exact guard agreement",
      "result": "REFUTED",
      "how": "The fingerprint branch is duplicated and a tickets-only probe produced opposite runtime and guard roster decisions."
    },
    {
      "claim": "merged tree: bridge 121, mcp-lane 99, guard 153, install 348, tickets 160; declared verification green",
      "result": "UNVERIFIED",
      "how": "Bridge 121, guard 153, tickets, and lints passed; MCP, install, and exec encountered the documented sandbox/process-environment failures."
    },
    {
      "claim": "115 and 119 calls were recorded breaches against the 80-call ceiling",
      "result": "CONFIRMED",
      "how": "The committed progress record and executor report both record the overrun."
    }
  ],
  "refutation_duty": {
    "present": true,
    "what_was_tried": "Read the pinned diff and surrounding contracts; ran every declared suite/lint; probed missing-runtime hook startup, real new→legacy installation, valid cross-project cd ticketing, tickets-only manifest/guard alignment, expired enginePass, malformed-call replay, and a live MCP Luna-ticket→Sol/xhigh override with nonce/model comparison."
  },
  "citation_replay": [
    {
      "citation": "0915a57..HEAD",
      "command": "git diff --check 0915a57..HEAD",
      "result": "MATCH"
    },
    {
      "citation": "bridge/runtime.js and bridge/manifest.js",
      "command": "node tests/bridge.test.js",
      "result": "MATCH"
    },
    {
      "citation": "packs/codex/hooks/orchestra-engine-mcp.js",
      "command": "node tests/mcp-lane.test.js",
      "result": "UNREPLAYABLE"
    },
    {
      "citation": "router/tickets.js",
      "command": "node tests/tickets.test.js",
      "result": "MATCH"
    },
    {
      "citation": "hooks/orchestra-guard.js",
      "command": "node tests/guard.test.js",
      "result": "MATCH"
    },
    {
      "citation": "install.js",
      "command": "node tests/install.test.js",
      "result": "UNREPLAYABLE"
    },
    {
      "citation": "packs/codex/hooks/orchestra-exec.js",
      "command": "node tests/exec-lane.test.js",
      "result": "UNREPLAYABLE"
    },
    {
      "citation": "roster role files",
      "command": "node roster/lint.js && node install.js --lint roster",
      "result": "MATCH"
    },
    {
      "citation": "repository frontmatter",
      "command": "node install.js --lint",
      "result": "MATCH"
    },
    {
      "citation": "bridge/hooks/ticket-gate.js:46",
      "command": "copy ticket-gate.js without runtime.js and pipe a roster:new PreToolUse payload",
      "result": "MATCH"
    },
    {
      "citation": "packs/codex/hooks/orchestra-engine-mcp.js:170",
      "command": "install --roster new, flip --roster legacy, then call orchestra_exec over stdio",
      "result": "MATCH"
    },
    {
      "citation": "packs/codex/hooks/orchestra-engine-mcp.js:880",
      "command": "issue Luna/medium ticket, launch it, then call orchestra_exec with Sol/xhigh and compare runner/ticket records",
      "result": "MATCH"
    },
    {
      "citation": "router/tickets.js:1376",
      "command": "issue 500ms ticket, consume and launch, wait past expires_at, then call enginePass",
      "result": "MATCH"
    },
    {
      "citation": "bridge/manifest.js:155",
      "command": "compare readTrustedManifest and guard Agent output for an unpinned tickets-only project",
      "result": "MATCH"
    }
  ],
  "served_model": "gpt-5.6-sol",
  "run_nonce": "23118dc0fa840343",
  "review": {
    "cross_family": null
  }
}
```
== exit 0 2026-09-01T08:36:31Z ==
