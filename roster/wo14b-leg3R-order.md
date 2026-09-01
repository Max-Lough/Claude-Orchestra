# WO-14b leg 3R — bounded rewrite of the guard's `roster:new` path (oracle-ruled)

- **Authority:** `roster/wo14b-leg3-oracle-verdict.md` (Sol · xhigh, 2026-09-01). This order
  implements its PROPERTIES and ARCHITECTURE RULING and nothing else. Fix rounds on leg 3 are
  over; this is the one rewrite, followed by at most one correction pass.
- **Class:** E2 Builder · risk T2 · casting Anthropic Sonnet 5 · high (dense).
  **Planned 55–60 tool calls; hard ceiling 80 → `CHECKPOINT`** (the oracle kept the ceiling and
  ruled overruns a sizing-and-discipline failure — plan the reserve for verification/report).
- **FILES (only):** `hooks/orchestra-guard.js`, `install.js` (the hook invocation + gate-hook
  registration verification only), `tests/guard.test.js`, `tests/install.test.js`,
  `README.md` (the guard / grants-reach / pin / pause paragraphs). **Not:** legacy policy
  refactors, `bridge/**`, `router/**`, `packs/**`, any other leg.
- **Branch:** its own worktree off `claude/wo14b-bridge` HEAD. Do not commit.
- **Review:** the whole resulting `roster:new` path, not the delta — first a fresh Sol · high
  cross-vendor property review, then an independent Opus · high adversarial pass. A provider
  refusal is review-unavailable, not approval.

## The closed regime (implement exactly)

1. **Activation by hook invocation.** `install.js --roster new` writes the guard's
   `PreToolUse` hook entry as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/orchestra-guard.js"
   --roster new` (legacy installs keep today's argument-less entry); the legacy flip rewrites the
   entry without the argument. The guard selects its `roster:new` path **only** from that
   argument (`process.argv`). `.claude/orchestra.json`, pins, fingerprints and transcript
   contents have **no role in selecting the mode**. The guard still reads the manifest for
   `seats`/`rosterGeneration` (informational) and verifies the pin as a **tamper receipt**
   (mismatch → a warning line in every deny reason; never a mode change).
2. **Static policy under `roster:new`.** Fixed Director-law denial set (`BLOCKED`), the built-in
   plan (`.claude/plans/**/*.md`) and memory (`CLAUDE.md` basenames inside the project)
   exceptions with their containment/hardlink/marker protections, optional **tightening-only**
   `directorBlockedPatterns` (glob, ≤ 64 entries, ≤ 200 chars, regex-shaped rejected — a broken
   entry fails closed for the BLOCKED set), the explicit user pause, and the separately
   registered ticket gate. `directorAllowedTools`, `directorPlanPatterns`,
   `directorMemoryPatterns` are **ignored** under `roster:new` (a warning names them). Legacy keeps
   them.
3. **No project code execution.** Delete `delegateAgentGate()` and the `require()` of
   `.claude/orchestra/bridge/runtime.js`. Under `roster:new` an `Agent` PreToolUse is handled by
   the guard as follows: verify that the four gate hook entries (`PreToolUse` matcher `Agent`,
   `PostToolUse` matcher `Agent`, `SubagentStop`, `Stop`, each with the exact installer command
   line) are registered in `.claude/settings.json`; if any is missing or altered → **DENY**
   (reason: gate not registered); if present → **ALLOW** and let the gate hook decide (the host
   runs both hooks; a deny from either blocks). Nested spawns (`agent_id` present) → DENY
   outright. Under legacy the guard does not touch `Agent`.
4. **Transcript never stands `roster:new` down.** Under `roster:new`, Director law is always
   active unless the user pause is active; `latestMainModel()` is not consulted on this path.
   Legacy keeps model-aware dormancy; on the legacy path the latch discounts an entry only when
   `isSidechain === true`.
5. **Pause exclusively out-of-band.** A genuine pause = `ORCHESTRA_PAUSE=1` in the hook env, or a
   regular file (`isFile()`, `nlink === 1`, not a reparse point) at exactly
   `<project>/.claude/orchestra.pause`. The pause check runs **first** in `main()` — before the
   subagent exemption, before mode selection, before `Agent` handling — and an active pause
   disables Director law and returns allow for `Agent` too. The pause-write deny runs next and
   covers every identity and every spelling: normalise the target (resolve, case-fold on win32,
   strip an NTFS `:stream` suffix and trailing dots/spaces) and deny when the normalised path
   equals the pause path or is beneath it, for Write/Edit/MultiEdit/NotebookEdit.
6. **Containment and wiring.** Every allowed write target resolves inside the real project root;
   unresolved reparse points anywhere in the path → deny (never treated literally); hardlinks
   (`nlink > 1`) → deny, with the write's own target excluded from the `{dev,ino}` protected-set
   comparison; the managed `CLAUDE.md` marker-block check runs on any memory-basename target
   before either exception can allow.
7. **Installer, roster:new side only:** write the hook entry of (1); on `--roster new` verify
   after writing that the gate hook entries of (3) exist (they are registered by the existing
   leg-4c code — verify, do not duplicate); pin writing unchanged except `runtimeSha256` is
   **removed** (no longer meaningful); `--uninstall` anchors every deletion beneath
   `realpath(project root)` and refuses to operate when `.claude` is a reparse point; the
   `--uninstall` ownership rules of fix rounds 3/4 stand.
8. **Tests pin equivalence classes.** For each property above, vary: artifact subsets (manifest
   present/absent/tampered; pins present/absent/corrupt), path spellings (case, ADS, trailing
   dots, `..`, absolute, nested), identity fields (`agent_id` present/absent), payload shapes
   (malformed stdin, non-string tool_name), link states (hardlink, junction, dangling junction),
   transcript sizes and contents (must not matter under new), and hook-entry states (missing,
   altered command, extra user entries). Delete tests that pin the removed behaviours (seam
   delegation; truthy `isSidechain`; fingerprint/pin-selected mode).
9. **README:** rewrite the guard's `roster:new` description to the closed regime; state the
   accepted limits verbatim from the oracle (same-user boundary; explicit pause; shared grants;
   git push residual); remove the claim that pin deletion fails closed.

## Declared verification (paste actual outputs)

    node tests/guard.test.js
    node tests/install.test.js
    node tests/frontmatter-lint.test.js
    node install.js --lint
    node tests/bridge.test.js   (must stay green — the gate hook is untouched)

Report: STATUS / CHANGES (path:line per item 1–9) / VERIFICATION / DEVIATIONS / CONCERNS.
Never end while a process you started is still running.
