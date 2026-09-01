# WO-14b leg 4c — wiring: hook registration, guard Agent seam, runtime pin rules aligned

- **Class:** E2 Builder · risk T2 · casting Anthropic Sonnet 5 · med. **Tool budget: 80 calls** →
  `CHECKPOINT` (the leg-4b builder ran 145 calls without one — a recorded breach; a checkpoint is
  the lawful outcome for a leg this size). Runs after leg-3 fix round 2 (A guard, B installer) is
  merged, so `install.js`/`hooks/orchestra-guard.js` are stable.
- **Branch:** `claude/wo14b-bridge`. **Do not commit.**
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 4). Authorities for the pin rules:
  `roster/wo14b-leg3-redteam-2.md` (E7 re-verification) and the fix-2A/2B designs recorded in
  `roster/wo14b-activation-bridge-progress.md`.

## FILES

`install.js` (only: register/remove the four gate hook entries on `--roster new`/legacy flip;
extend the census test), `hooks/orchestra-guard.js` (only: the `Agent` seam calling the bridge gate
under `roster:new`), `bridge/manifest.js`, `bridge/runtime.js` (pin-rule alignment only),
`tests/install.test.js` (census cases), `tests/guard.test.js` (seam cases), `tests/bridge.test.js`
(pin-rule cases), `bridge/README.md`.

## 1. Hook registration (`install.js`)

On `--roster new`: add to `.claude/settings.json` four entries tagged like the guard's
(`isOurHookEntry`): `PreToolUse` matcher `Agent` → `node .claude/orchestra/bridge/hooks/
ticket-gate.js PreToolUse`; `PostToolUse` matcher `Agent` → `… PostToolUse`; `SubagentStop` →
`… SubagentStop`; `Stop` → `… Stop`. Record them in the manifest's `installedHooks`. On the
legacy flip (`--roster legacy`) remove exactly those entries (the gate is inert under legacy
anyway — removal is hygiene). Uninstall removes them. Pin: census of `settings.json` hooks before/
after each transition; a user's own hook entries untouched.

## 2. Guard `Agent` seam (`hooks/orchestra-guard.js`)

Under a trusted or untrusted-but-new policy, a `PreToolUse` for tool `Agent` is delegated to the
bridge gate (`require('<project>/.claude/orchestra/bridge/runtime.js').createRuntime({projectDir})
.gate(event)`) and its decision returned verbatim; if the runtime cannot be loaded (missing,
throws) → DENY (fail closed) with the reason. Under legacy → no change (the guard does not block
`Agent`). This is defence in depth: the installed gate hook runs anyway; the seam makes the guard
alone sufficient if the settings entries are stripped. Pin both directions.

## 3. Runtime pin rules aligned (`bridge/manifest.js`, `bridge/runtime.js`)

Match the guard's fix-2A rules exactly: manifest present claiming `new` + no pin → `trusted:false,
roster:'new', reason:'manifest claims new without a pin'` (fail closed: gate denies, dispatch
returns `MANIFEST_UNTRUSTED`); corrupt pin → untrusted (never "unpinned"); pin `projectDir` must
equal the resolved path OR the pin was found by `id-<sha256(projectId)>.json` (moved project:
trusted iff the manifest hash matches; reason carries 'project moved since pinning');
`ORCHESTRA_PIN_DIR` honoured only if the directory exists. Pin every branch; keep the existing 62.

## 4. Records

`bridge/README.md` "What is NOT here yet" updated (nothing of leg 4 should remain owed after this
leg; say what leg 5 owns). Progress line by the Conductor.

## Declared verification (paste results)

    node tests/install.test.js
    node tests/guard.test.js
    node tests/bridge.test.js
    node tests/mcp-lane.test.js
    node tests/tickets.test.js
    node install.js --lint

Report: STATUS / CHANGES / VERIFICATION / DEVIATIONS / CONCERNS. Never end while a process you
started is still running. Do not run `git commit`.
