# WO-14b leg 5 (closure) — cross-vendor review #1 (R0, OpenAI lane: GPT-5.6 Sol · high via Codex CLI) — 2026-09-01

Pinned `44b8ff6..469e75e`, confined to the leg-5 files (close.js, telemetry.js, cli close, the verdict-json block in the review runner, orchestra_close, both Reviewer role files, the verdict/casting-record schemas, the two riders). Author family: anthropic (Sonnet 5 Builders; Fable 5 Conductor). Policy: mandatory (the only path to CLOSED). `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0. mcp-lane 97/99 in the reviewer sandbox (Windows taskkill access denied) — 99 here. The runner now emits the leg-5 verdict-json block itself (visible below) — the first review to do so.

---

REVIEW ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol, sandbox: workspace-write, tier: full, timeout: 3600000ms (flag), attempts: up to 2, checkout: pinned worktree @ 469e75e7d4f4)
REVIEW RUN NONCE: 23bc2f6a6c7e56bd
ENGINE BIN: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE sha256=cf68265897197ac5f3bff6a10c168eec159842b353129726da5e3ed6b91ef0f4
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: codex install layout: unknown (C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin) — not one of the two layouts this runner knows, so helper-sibling repair can only use a directory you name in helpersDir
PREFLIGHT: helper siblings present: codex-command-runner.exe, codex-resources, codex-windows-sandbox-setup.exe
PREFLIGHT: auth/exec probe: ok in 6714ms
PREFLIGHT: pinned review: checked out 469e75e7d4f4 into a throwaway worktree (C:\Users\maxtl\AppData\Local\Temp\orchestra-review-8EqPuc\attempt-1\wt); the session's uncommitted files are not visible to the engine

=== ENGINE OUTPUT ===
VERDICT: REVISE

FINDINGS
- [MAJOR] [BREACH] bridge/close.js:372 — Codex closure ignores the authoritative `ticket.engine_result.report` and instead trusts the outer launcher's relay. — Given an engine-bound REVISE with nonce `actual-engine-nonce` and a forged launcher relay containing APPROVE with another nonce, the probe closed both tickets instead of returning `NOT_CLOSED: REVISE`.
- [MAJOR] [BREACH] bridge/close.js:394 — Cross-family status is derived from `ticket.author_family`, not `familyOf(ticket.casting)`. — Given a forged reviewer ticket whose Anthropic casting matches the implementation family but whose `author_family` says OpenAI, closure treats the same-family review as cross-family instead of refusing it.
- [MAJOR] [BREACH] bridge/close.js:236 — Close #1 derives the audit base from `<reported commit>^` instead of the ticket's recorded base. — Given a multi-commit implementation, only the final commit is diffed and its parent supplies the manifest, so earlier implementation commits can alter code or the verification oracle without being audited against the true base.
- [MAJOR] [BREACH] bridge/close.js:245 — Ordinary routing records can never become the canonical order passed to the Verifier. — Given a schema-valid dispatch request, order validation reports five missing dispatcher-owned fields, so `order` is omitted and nonce/order validation is skipped instead of running against the canonical routed order.
- [MAJOR] [BREACH] bridge/close.js:104 — The Band-C parser accepts reports missing all four mandatory sections. — Given only `STATUS: DONE` and `COMMIT: 1234567`, parsing produced null sections and `buildVerifierReport` still passed `report.schema.json`, allowing an incomplete report into verification instead of returning `NOT_CLOSED`.
- [MAJOR] [BREACH] bridge/close.js:457 — Gate-class derivation cannot recognize schema-valid security work and never supplies a falsification run. — Given a valid security touch such as `auth`, the code compares against nonexistent touch values `security`/`data` and records `gate_class:false`; forcing its `principal` branch instead produced `NOT_CLOSED: unauditable` because no `falsification_run` is ever constructed.
- [MAJOR] [BREACH] bridge/close.js:474 — Any unrelated reproduced finding excuses every divergent citation. — Given a replayed command that exits 1 plus an unrelated reproduced MINOR typo finding, the probe created an audit with `citation_replay.result:"DIVERGES"` and `outcome:"PASS"`, then closed both tickets instead of refusing the unexplained mismatch.
- [MINOR] [BREACH] bridge/close.js:494 — Non-closing review outcomes return before writing required telemetry or persisting NOT_CLOSED on either ticket. — Given REVISE or REJECT, execution returns before both casting records, the verdict audit, and the ticket close calls, so the captured result has no required final telemetry or durable NOT_CLOSED outcome.
- [MAJOR] [BREACH] bridge/close.js:512 — Reviewer telemetry records the Haiku launcher model instead of the Codex engine's served identity. — Given the shipped `reviewer-openai` launcher (`model: haiku`), `ticket.launched.served_model` describes the outer launcher while the reviewed result came from Codex; the casting record therefore reports the wrong serving model instead of the engine-reported value or `UNKNOWN`.

CLAIMS CHECKED
- "Close #2 uses the bound engine run log for codex tickets and closes only for a genuinely closing verdict" → REFUTED (a temporary-repository probe bound an authentic engine REVISE and forged relay APPROVE; both tickets became CLOSED).
- "baseRef derived as the named commit's parent; risk/order/mutations recovered from routing.events.jsonl" → CONFIRMED (inspected `resolveParentRef` and `findRoutingEvent`; a schema probe confirmed a normal routing request cannot validate as an order).
- "exactly one structured verdict block is valid, schema-checked, and nonce-matched" → CONFIRMED (`node tests/bridge-close.test.js` passed malformed-block cases and `node tests/review-lane.test.js` passed 132 checks).
- "the tickets sidecar drain preserves torn records and `_fs` is test-gated" → CONFIRMED (`node tests/tickets.test.js`: 160 passed).
- "manifest round-3 fingerprint, strict-pin, git-root, and moved rules are pinned" → CONFIRMED (`node tests/bridge.test.js`: 121 passed).
- "bridge-close, verifier, review-lane, registry, roster lint, and install lint are green" → CONFIRMED (reran each; bridge-close passed, verifier 101, review-lane 132, registry 33, roster lint 12 files, install lint 31 files).
- "mcp-lane 99" → REFUTED (`node tests/mcp-lane.test.js`: 97 passed, 2 failed because Windows `taskkill /T /F` returned access denied and the cancellation report could not confirm the tree kill).

NITS
- `bridge/close.js:465` maps REJECT to REVISE because the audit schema lacks REJECT. This currently does not alter the refusal decision, but the schema should gain REJECT when non-closing audits are persisted rather than recording a different verdict.

```verdict-json
{
  "verdict": "REVISE",
  "findings": [
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 372,
      "claim": "Codex closure ignores the authoritative `ticket.engine_result.report` and instead trusts the outer launcher's relay.",
      "reproduced": true,
      "evidence": "A temporary-repository probe bound engine_result.report=REVISE with actual-engine-nonce and resolved.last_assistant_message=APPROVE with forged-relay-nonce; close() returned CLOSED and both tickets transitioned to CLOSED."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 394,
      "claim": "Cross-family status is derived from `ticket.author_family`, not `familyOf(ticket.casting)`.",
      "reproduced": false,
      "evidence": "Direct inspection shows crossFamily compares the two author_family fields although the order requires the reviewer casting family; ticket schema validation does not enforce equality between casting.vendor and author_family."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 236,
      "claim": "Close #1 derives the audit base from `<reported commit>^` instead of the ticket's recorded base.",
      "reproduced": false,
      "evidence": "resolveParentRef(repoDir, parsed.commit) is passed as both baseRef and manifestRef, limiting a multi-commit implementation audit to the last commit and permitting an earlier implementation commit to supply the oracle."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 245,
      "claim": "Ordinary routing records can never become the canonical order passed to the Verifier.",
      "reproduced": true,
      "evidence": "Validating a normal dispatch request against order.schema.json returned missing requested_casting, author_family, co_author_families, review_policy, and integrity_nonce; close.js consequently omits order and nonceEcho."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 104,
      "claim": "The Band-C parser accepts reports missing all four mandatory sections.",
      "reproduced": true,
      "evidence": "parseBandCReport on only STATUS: DONE and COMMIT: 1234567 returned null verification/deviation/concern sections, while buildVerifierReport validated with zero report-schema problems."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 457,
      "claim": "Gate-class derivation cannot recognize schema-valid security work and never supplies a falsification run.",
      "reproduced": true,
      "evidence": "The implementation checks touches for security/data although securityTriggerList uses auth/authz/etc.; a principal-branch probe returned unauditable because falsification_run was missing."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 474,
      "claim": "Any unrelated reproduced finding excuses every divergent citation.",
      "reproduced": true,
      "evidence": "A probe replayed a command exiting 1 and supplied an unrelated reproduced MINOR typo; the resulting audit contained DIVERGES plus outcome PASS and close() returned CLOSED."
    },
    {
      "severity": "MINOR",
      "path": "bridge/close.js",
      "line": 494,
      "claim": "Non-closing review outcomes return before writing required telemetry or persisting NOT_CLOSED on either ticket.",
      "reproduced": false,
      "evidence": "The REVISE/REJECT return precedes both telemetry writers and both tickets.close calls at lines 521-550."
    },
    {
      "severity": "MAJOR",
      "path": "bridge/close.js",
      "line": 512,
      "claim": "Reviewer telemetry records the Haiku launcher model instead of the Codex engine's served identity.",
      "reproduced": false,
      "evidence": "reviewer-openai.md declares model: haiku, while close.js sources reviewerServed exclusively from the outer ticket's launched.served_model and ignores the engine-bound verdict identity."
    }
  ],
  "claims_checked": [
    {
      "claim": "Close #2 uses the bound engine run log for codex tickets and closes only for a genuinely closing verdict",
      "result": "REFUTED",
      "how": "A temporary-repository probe bound an authentic engine REVISE and forged relay APPROVE; both tickets became CLOSED."
    },
    {
      "claim": "baseRef derived as the named commit's parent; risk/order/mutations recovered from routing.events.jsonl",
      "result": "CONFIRMED",
      "how": "Inspected resolveParentRef and findRoutingEvent; a schema probe confirmed a normal routing request cannot validate as an order."
    },
    {
      "claim": "exactly one structured verdict block is valid, schema-checked, and nonce-matched",
      "result": "CONFIRMED",
      "how": "node tests/bridge-close.test.js passed malformed-block cases and node tests/review-lane.test.js passed 132 checks."
    },
    {
      "claim": "the tickets sidecar drain preserves torn records and `_fs` is test-gated",
      "result": "CONFIRMED",
      "how": "node tests/tickets.test.js completed with 160 passed."
    },
    {
      "claim": "manifest round-3 fingerprint, strict-pin, git-root, and moved rules are pinned",
      "result": "CONFIRMED",
      "how": "node tests/bridge.test.js completed with 121 passed."
    },
    {
      "claim": "bridge-close, verifier, review-lane, registry, roster lint, and install lint are green",
      "result": "CONFIRMED",
      "how": "Reran each suite: bridge-close passed, verifier 101, review-lane 132, registry 33, roster lint 12 files, and install lint 31 files."
    },
    {
      "claim": "mcp-lane 99",
      "result": "REFUTED",
      "how": "node tests/mcp-lane.test.js completed with 97 passed and 2 failed because taskkill /T /F returned access denied and the cancellation report could not confirm the tree kill."
    }
  ],
  "refutation_duty": {
    "present": true,
    "what_was_tried": "Replayed all declared suites, inspected surrounding ticket/engine/verifier contracts, tested authoritative engine output versus launcher relay, malformed Band-C input, raw-request order validation, gate-class audit construction, and divergent-citation handling."
  },
  "citation_replay": [
    {
      "citation": "bridge/close.js:372",
      "command": "Numbered Get-Content inspection plus temporary authoritative-engine-result closure probe",
      "result": "MATCH"
    },
    {
      "citation": "bridge/close.js:236",
      "command": "rg -n \"resolveParentRef|candidateOrder|baseRef|manifestRef\" bridge/close.js verifier/verifier.js",
      "result": "MATCH"
    },
    {
      "citation": "bridge/close.js:104",
      "command": "PowerShell here-string piped to node for parseBandCReport/buildVerifierReport schema probe",
      "result": "MATCH"
    },
    {
      "citation": "bridge/close.js:457",
      "command": "rg -n \"gate_class|falsification_run|securityTriggerList\" bridge registry router roster",
      "result": "MATCH"
    },
    {
      "citation": "bridge/close.js:474",
      "command": "Temporary repository probe with a failing citation and unrelated reproduced MINOR finding",
      "result": "MATCH"
    },
    {
      "citation": "declared verification",
      "command": "node tests/bridge-close.test.js; node tests/bridge.test.js; node tests/tickets.test.js; node tests/verifier.test.js; node tests/review-lane.test.js; node tests/mcp-lane.test.js; node tests/registry.test.js; node roster/lint.js; node install.js --lint",
      "result": "MISMATCH"
    }
  ],
  "served_model": "gpt-5.6-sol",
  "run_nonce": "23bc2f6a6c7e56bd",
  "review": {
    "cross_family": null
  }
}
```
== exit 0 2026-09-01T08:34:08Z ==
