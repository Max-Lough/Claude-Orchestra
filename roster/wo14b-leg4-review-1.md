# WO-14b leg 4 (4 + 4b + 4c) — cross-vendor review #1 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Pinned `fca1853..0915a57`, confined to bridge/**, packs/codex/hooks/orchestra-engine-mcp.js, tests/bridge.test.js, tests/mcp-lane.test.js, and the leg-4c wiring in install.js / hooks/orchestra-guard.js. Author family: anthropic (Sonnet 5 Builders; Fable 5 Conductor). Policy: mandatory (the activation state machine). Exit 0 at 07:11:32Z (engine clock); `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0. Three suites UNVERIFIED in the reviewer sandbox for environmental reasons (taskkill access, global git identity, containment fixture outside the writable workspace) — green here.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 0915a577ca65)
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 5318ms
PREFLIGHT: pinned review: checked out 0915a577ca65 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-RwhMOa\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] bridge/runtime.js:155 — Builder launcher selection ignores the served casting — given a Green E1 bounded request, routing selects GPT-5.6 Luna and records `author_family:"openai"`, but dispatch returns `subagent_type:"builder"` whose installed agent is Anthropic Sonnet, so the wrong vendor authors the change and the review-family calculation is false.
- [MAJOR] [BREACH] bridge/runtime.js:581 — Codex launcher tickets are consumed twice — given a Q0 ticket for `test-designer-vs-anthropic`, Agent PreToolUse consumes it, then the launcher must pass that same ticket to `orchestra_exec`, whose second consume rejects it as a replay; no ticket issued by dispatch can traverse Agent → Codex successfully.
- [MAJOR] [BREACH] packs/codex/hooks/orchestra-engine-mcp.js:101 — an unavailable bridge manifest module silently resolves to legacy — given an installed roster:new project whose `bridge/manifest.js` is missing or unloadable, `requireEngineTicket()` skips enforcement and invokes Codex without a ticket instead of returning `TICKET_REQUIRED`.
- [MAJOR] [BREACH] packs/codex/hooks/orchestra-engine-mcp.js:786 — engine enforcement ignores the execution `cd` — given a server rooted in a legacy project and `orchestra_exec {cd:<roster:new project>}`, ticketing is checked against `ROOT`, so the new-roster target executes unticketed.
- [MAJOR] [BREACH] bridge/runtime.js:551 — engine tickets are not bound to a role or casting — given an Anthropic `builder` implementation ticket, a direct `orchestra_exec` call accepts it because only kind/phase is checked and the ticket’s own role is fed back into `consume()`, so Codex runs instead of returning `TICKET_MISMATCH`.
- [MAJOR] [BREACH] bridge/runtime.js:312 — validated `medium` is dropped while constructing the canonical order — given `{class:"M0", medium:"videoAudio"}`, the runtime probe returned `ok:true` with an Investigator ticket instead of the router’s required typed `UNAVAILABLE`.
- [MAJOR] [BREACH] packs/codex/hooks/orchestra-engine-mcp.js:860 — `orchestra_dispatch` does not expose the dispatch-request schema as its input — given a caller sends a schema-valid request directly as ordered, the handler looks only for `arguments.request` and validates `{}`, producing `INVALID_REQUEST`; only the undocumented wrapper shape works.
- [MAJOR] [BREACH] bridge/runtime.js:443 — ticket `config_hash` is never checked at consumption — given castings/aliases are updated by a roster:new reinstall without a generation bump, an old ticket remains executable under the changed configuration instead of being rejected or invalidated.
- [MAJOR] [BREACH] bridge/runtime.js:222 — every runtime silently initializes a missing ticket store — given an established store is deleted, the next dispatch creates a fresh generation-1 ledger and issues new capability rather than reporting unavailable state, violating the explicit first-install-only initialization rule.
- [MAJOR] [BREACH] bridge/runtime.js:177 — routing-event persistence is best-effort — given `routing.events.jsonl` is unwritable or is replaced by a directory, dispatch silently returns router outcomes and can issue tickets without the required immutable routing record.
- [MINOR] [BREACH] install.js:1182 — gate-hook ownership uses a basename substring — given a user hook command such as `node tools/ticket-gate.js`, install, legacy flip, or uninstall classifies it as Orchestra-owned and removes it instead of preserving the user entry.
- [MINOR] [BREACH] bridge/hooks/ticket-gate.js:46 — malformed input denies before roster state is read — given malformed PreToolUse stdin with no manifest or roster:legacy, the adapter emits a denial instead of the required inert `{}` response.
- [MINOR] [BREACH] bridge/manifest.js:272 — runtime and guard pin comparisons are not identical — given a well-formed pin containing the correct SHA-256 in uppercase, the runtime lowercases and trusts it while the guard’s case-sensitive comparison marks it untrusted.
- [MINOR] [BREACH] bridge/runtime.js:374 — request parentage is discarded when issuing the implementation ticket — given a valid dispatch request with `parent_ticket`, the resulting ticket records `parent_ticket:null` instead of the supplied relationship.

CLAIMS CHECKED
- "bridge 82, tickets 152, review-lane 126, guard 95, install.js --lint OK" → CONFIRMED (independent pinned-checkout runs exited 0; bridge reported 82/82, review 126/126, guard 95/95)
- "mcp-lane 79" → UNVERIFIED (independent run reached all ticket cases but exited 1 at 77/79 because sandboxed Windows `taskkill` returned Access denied)
- "exec-lane 79" → UNVERIFIED (independent run exited 1 on two global-Git-identity assertions affected by the managed environment)
- "install 242" → UNVERIFIED (the suite was stopped by the sandbox when its containment fixture attempted to create a victim outside the writable workspace)
- "spawn.subagent_type is the installed agent file name for the served casting" → REFUTED (a focused Green E1 probe selected OpenAI Luna but returned `builder`, the Sonnet agent)
- "manifest.js trust rules are aligned to hooks/orchestra-guard.js exactly" → REFUTED (the runtime case-folds `manifestSha256`; the guard does not)
- "under roster:new a missing or mismatched ticket never invokes codex" → REFUTED (missing/unloadable manifest support downgrades enforcement to legacy, `cd` is ignored, and wrong-role same-phase tickets are accepted)
- "a user's own hook entries for the same four events are always left untouched" → REFUTED (`isOurGateHookEntry()` matches any command containing `ticket-gate.js`)
- "nothing of leg 4 remains owed" → REFUTED (the failure scenarios above leave both Agent and raw-engine activation paths non-conformant)

NITS
- `.github/workflows/test.yml` still says an unpinned new manifest is forced to legacy, while the implemented and tested rule is untrusted-new/fail-closed.
== exit 0 2026-09-01T07:11:32Z ==
