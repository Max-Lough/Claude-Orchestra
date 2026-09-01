# WO-14b leg 3 — installer (`--roster new`) and guard security (sdc-011/012)

- **Class:** E2 Builder · risk T2 · casting Anthropic Sonnet 5 · med, followed by an E7
  Red Team pass (defensive, read-only, findings only) over the finished leg.
  **Tool budget: 80 calls** → `CHECKPOINT`.
- **Branch:** `claude/wo14b-bridge`. **Do not commit** — the Conductor commits after
  review. Runs after leg 2 is committed (it needs the eleven-file roster and
  `mergedClasses`).
- **Parent:** `roster/wo14b-activation-bridge-order.md` (leg 3). Guard findings:
  `roster/wo14b-activation-bridge-order.md` § Facts (sdc-011/012 bullets, from
  `wo12/results-S-Opus-phase0.json`).
- **Law (Band C):** execute the order, the whole order, nothing but the order; blocked
  beats guessed; the report is a claim, not evidence.

## FILES

`install.js`, `hooks/orchestra-guard.js`, `README.md` (installer + guard sections
only), `ORCHESTRA.md` (§3.1 plan-file bullet only), `tests/install.test.js` (new),
`tests/guard.test.js` (new or extend the existing guard test if one exists — check
`tests/` first), `.github/workflows/test.yml` (add the new suites).
Forbidden: `router/**`, `registry/**`, `roster/*.md` role files, `packs/**`
(leg 4 adds the runtime and MCP wiring — this leg only *installs* what exists and
leaves a documented seam for `.claude/orchestra/`), `quartermaster/**`, `verifier/**`.

## A. `install.js --roster legacy|new`

1. `--roster legacy` (default) is byte-for-byte today's behaviour (the six legacy
   agents, skills, guard hook, packs). Pin it: the installed-file census of a legacy
   install before and after this leg is identical.
2. `--roster new` installs, **in addition to** the legacy roster (both stay installed —
   WO-15's precondition): the eleven roster files under `roster/*.md` into
   `.claude/agents/` **except `conductor.md`** (it is the session's standing contract,
   not a spawnable agent — install it to `.claude/ORCHESTRA-CONDUCTOR.md` and reference
   it from `ORCHESTRA.md`); `sweeper.md` installs but the manifest marks it disabled;
   the substrates as a runtime directory `.claude/orchestra/` containing `router/`,
   `registry/`, `verifier/`, `quartermaster/` (copied, with their `README.md`s — leg 4
   adds `dispatch.js`/`close.js` and the MCP wiring here); the codex pack's engine server
   registered in the target's `.mcp.json` when the pack is selected (the existing pack
   path — do not add a new one).
3. The owner-pinned manifest `.claude/orchestra.json` gains, on `--roster new`, exactly:
   `"roster": "new"`, `"seats": { "Architect": true, "Sweeper": false }`,
   `"rosterGeneration": <int, starts at 1, incremented on every roster flip>`. On
   `--roster legacy` over an existing new install: set `"roster": "legacy"`, bump
   `rosterGeneration`, leave the new files in place (rollback is the flag flip, not a
   reinstall — leg 4's runtime reads the flag and invalidates open tickets on a
   generation change). Preserve every unrelated key in the manifest, `.mcp.json`, and
   `.claude/settings.json` byte-for-byte (pin with a fixture containing user keys).
4. Refuse before touching anything: malformed JSON in `.claude/settings.json`,
   `.mcp.json`, or `.claude/orchestra.json` → typed error, exit 1, nothing copied or
   deleted. Malformed `permissions` (a string, an array) → refuse with the offending
   value named, never silently replace (sdc-012 MINOR).
5. `--uninstall`: read and validate all three settings files **first**; refuse on
   malformed JSON before deleting any file; then remove grants, hook entries, and
   files in that order (sdc-012 MINOR — today files go before settings are read,
   stranding grants in a project with no guard). Installer-added grants are tracked by
   an `orchestra.installedPermissions` array in the manifest so uninstall removes only
   what it added (sdc-012 Sonnet MINOR: identical user-added strings survive).
6. `--lint` unchanged in behaviour; it must pass on the eleven-file roster.

## B. Git grants (sdc-012 MAJOR ×2)

1. Default install grants **only** `Bash(git add:*)` and `Bash(git commit:*)`. The push
   grant moves behind `--grant-push`, which adds `Bash(git push:*)` **together with**
   `permissions.deny` entries for `Bash(git push --force*)`, `Bash(git push -f*)`,
   `Bash(git push --delete*)`, `Bash(git push --mirror*)`, `Bash(git push * --force*)`
   (deny wins in Claude Code's permission evaluation — state that in the README and pin
   the shape). Uninstall removes exactly what it added (A.5).
2. README: a "What these grants reach" paragraph stating plainly that
   `permissions.allow` is **session-wide** and names the three windows in which the
   guard stands down and the grants therefore apply to the main session unprompted:
   a non-director model (`claude --model sonnet`), a session's first turn
   (`model === null`), and `.claude/orchestra.pause` / `ORCHESTRA_PAUSE=1`. Correct
   README lines ~207 and ~220 ("an undetermined model resolves to enforce" is false —
   `orchestra-guard.js:237-238` allows) to match the code, or change the code and say
   which — **choose the code**: see C.3.

## C. Guard (sdc-011)

1. `directorPlanPatterns` route: require `/\.md$/i` on the resolved path exactly as the
   default `.claude/plans` branch does (`orchestra-guard.js:224-229`); containment via
   `fs.realpathSync` on the deepest existing ancestor (a pre-existing symlink/junction
   inside the plans dir may not escape the project); both routes use the same
   case-handling (fail closed on mismatch, as today).
2. Deny hint names the configured plan directories (default + every
   `directorPlanPatterns` entry), not only `.claude/plans/`.
3. **Under `roster:new`** (manifest `roster === "new"`): the guard's stand-down
   windows do not apply to the *ticket gate* that leg 4 adds — this leg prepares the
   seam: factor `loadPolicy()` so it returns `{ roster, rosterGeneration, seats }` from
   the manifest, and make an undetermined model **deny** (not allow) when
   `roster === "new"`; legacy behaviour unchanged when `roster !== "new"`. Document the
   asymmetry in-code and in README.
4. Docs: `ORCHESTRA.md` §3.1 read/edit contradiction (the Director may Read its own
   plan file; MultiEdit is covered); README "Plan files" names `MultiEdit`.

## D. Tests

`tests/install.test.js`: installs into fresh temp dirs (`fs.mkdtempSync`) — legacy
census unchanged; new install file census (list every path); manifest keys; flip
new→legacy bumps generation and leaves files; user keys preserved in all three files;
malformed JSON refused with nothing touched; malformed `permissions` refused; uninstall
order (settings read first; malformed → nothing deleted); grants default vs
`--grant-push` incl. the deny set; installedPermissions tracking; `--lint` green.
`tests/guard.test.js`: drive `hooks/orchestra-guard.js` with synthetic PreToolUse JSON
as the existing guard tests do — pattern route requires `.md`; symlink/junction
escape denied (skip with a named reason if the OS cannot create one); hint text names
configured dirs; undetermined model under `roster:new` denies, under legacy allows;
malformed input under `roster:new` denies. All added to CI.

## Red Team pass (E7, after the builder's report)

Read-only, defensive. Attack the installer and guard as changed: a Director rewriting
the guard through any carve-out; grant reach in each stand-down window; uninstall
ordering under adversarial settings files; manifest tampering to flip `roster` or
`seats` from inside the project (which the guard/runtime must treat as owner-pinned —
say whether that pin is enforceable today or is a leg-4 requirement). Findings ranked,
one FIX-FIRST line, report format per `roster/red-team.md`.

## Declared verification (run all; paste results)

    node install.js --lint
    node tests/install.test.js
    node tests/guard.test.js
    node tests/frontmatter-lint.test.js
    node roster/lint.js && node install.js --lint roster
    node tests/router.test.js

## Report format

    STATUS: DONE | PARTIAL | BLOCKED | CHECKPOINT
    CHANGES        - <path:line> — one line each
    VERIFICATION   - <command> → <actual output lines, especially failures>
    DEVIATIONS     - <or "none">
    CONCERNS       - <or "none">

Never end while a process you started is still running. Do not run `git commit`.
