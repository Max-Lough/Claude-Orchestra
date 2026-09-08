# Changelog

Versions follow the rule in the README's "Versioning" section: **patch** for
fixes and doc-only changes, **minor** for new capabilities, **major** for
breaking changes to the protocol or the `orchestra.json` format. The version
lives in [`VERSION`](VERSION) and is stamped into every project the installer
touches.

Entries name the failure that prompted the change. A harness that only records
*what* it changed teaches nobody why the old way looked reasonable.

## 3.3.4 — a path with a space in it was not a path claim

**Why.** 3.3.2 taught the exec lane's report-integrity check to hold only
*path-shaped* CHANGES claims against the tree audit, and drew the line at
whitespace: a head with a space in it is prose, not a path. That rule is right
about prose and wrong about filenames. Reviewing the 3.3.3 install, Sol found
that an executor claiming an edit under a spaced path — an art repo's
`assets/audio/music/Pirate Music Pack - free/ogg/Pirate 1.ogg` — had that claim
filtered out as prose, `pathedClaims` went empty, and a report contradicting a
measurably untouched tree was relayed as verified. The check was not failing
loudly; it was silently not running.

**Fixed.** `pathClaims` still classifies a single-token head on shape alone, and
a head containing whitespace now counts when it carries a signal prose cannot
fake: the engine delimited it (backticks or quotes) *and* it reads as a file
path — a separator plus an extension or a trailing separator — or it names
something the audited tree actually holds (`fs.existsSync`, which folds case on
Windows as the filesystem does). Because `claimHead` cuts at the first ` — ` /
` - ` / `: ` and a spaced path can contain one of those itself, the
tree-resolution test tries every longer cut point, longest first. Prose is
unchanged: `Updated src/foo.gd — added guard` and `Ran the test suite` carry
neither signal and stay excluded, so the "prefer relaying a valid report over
discarding one" default still holds. Eight exec-lane cases cover it, four of
which fail on 3.3.3 — including the false-claim mutation proof.

## 3.3.3 — repository cleanup: the 2.x archives and the stale Codex-side fork leave the tree

**Why.** Five days after the 3.0 reverse-port, three quarters of the checkout by
line count was still Orchestra 2.0 evidence or a copy of a project that has its
own repository. Nothing live linked to any of it, but every clone carried 7 MB
of corpus fixtures, and a reader landing on `codex/` found a Director protocol
that still cast the retired Luna and Terra models. Doc-only; no installed
behavior changes.

**Removed.**
- `codex/` and `install-codex.{js,sh,ps1}` — the 1.8.0 "Codex CLI as Director"
  tree. Since 3.0.1 that harness is the standalone Codex-Orchestra repository
  (see "Install beside Codex-Orchestra" in the README); the copy here had
  diverged on every functional file and had no test coverage.
- `roster/`, `research/`, and `plans/cross-compare/` — the 2.0 build and
  shakedown records, the model dossiers, and the 2026-08-27/28 role-architecture
  session with its WO-12 corpus. All of it remains at tag `v2.5.0-final` and in
  git history; `plans/port-3.0/` stays as the record of why 2.0 was retired.
- The repository's own `.claude/` (a 2.x WO-1 telemetry hook wired into every
  tool call in this checkout) and the `.gitignore` whose only entries covered
  that hook's ledger and the deleted quartermaster.

**Tidied.** `plans/orchestra-codex-issues.md` is marked closed (items 1–8 by 3.3.0, 9–12 by 3.3.2);
`plans/proposed-orchestra-improvements.md` notes that its `path:line` citations
predate the reverse-port; `packs/codex/FIELD-VALIDATION.md` no longer titles
itself as the 1.10.0 checklist.
## 3.3.2 — the doctor reads the install's manifest, and three launcher blind spots

**Why.** codex-cli 0.153.4 ships `codex-command-runner.exe`,
`codex-windows-sandbox-setup.exe` and `codex-resources` in the directory
`codex-package.json` declares (`resourcesDir`, a sibling of `bin\`), and
resolves them there with nothing in `bin\`. The helper-sibling check demanded
them in `bin\`, read every self-update as "the update stripped them", and its
recommended repair copied a 0.147.0-era runner into the new install — the
version skew behind the intermittent sandbox fault. `packagedResourceDirs()`
now reads the manifest, keeps the declared name beside the canonical
directory (a junction alias must still match a helper entry), resolves real
paths before the containment test, de-duplicates on the (dir, name) pair, and
never lets a directory satisfy an executable entry. Four Sol review rounds
through the lane; every finding fixed. The doctor fix alone left a hole:
`restoreHelpers()` in both runners still copied every configured `helpersDir`
entry into `bin\` before any manifest check, so a stale kit could re-inject
an old build behind the doctor's back — observed 2026-09-07 15:48, when a
sibling project's exec lane, `helpersDir` still pointed at a 0.147-era kit,
copied that kit's helpers (a `codex-resources\` subtree included) into a
live 0.153.4 install's `bin\` while a review ran here. `restoreHelpers()` in
both runners now skip any top-level `helpersDir` entry the install's
declared resources directory already carries, whatever their sizes, and the
codex pack's Windows note (`pack.json`) now states the manifest layout
rather than the old beside-the-binary rule. The doctor now names a helper
that sits beside the binary while the manifest carries it as a HAZARD and
exits non-zero, instead of reporting it present.

**Three more field failures, from the ADR-0005 campaign's second batch**
(`plans/orchestra-codex-issues.md` #9–12):

- **A branch creation is not a claimed edit.** WO-7A round 1: the engine
  reported "Created `wo7a` at HEAD daf549ba" (a `git checkout -B`, no tree
  change); the report-integrity check saw no tree change against the claim
  and declared `EXEC_UNAVAILABLE`, discarding a valid BLOCKED report that
  carried the real finding. The check now holds only path-shaped CHANGES
  claims against the audit, and the audit measures the current branch as
  well as HEAD, so a `checkout -B` is a measured change. Sol's review of the
  first cut found the predicate still took `feature/foo` (a `/` in prose)
  and `v1.2.3` (a digit "extension") for paths: a path claim's head is now
  a single token, an extension must contain a letter, and a token that
  names an existing ref is excluded unless a file of that name also exists.
  Three more rounds each found one more ref spelling the precomputed name
  set missed (`refs/heads/x`, `origin/HEAD`, `heads/x`, `tags/v9`), so the
  set is gone: a single-token head is asked of git itself
  (`rev-parse --verify`) and excluded when it resolves as a ref and no file
  of that name exists, a head beginning `refs/` is a ref by construction,
  and the helper-name compares in the doctor and the helpersDir skip fold
  case on Windows, declared alias and canonical basename alike.
- **A principal launch off its default model is said out loud.** WO-4A round
  7 ran Sol/high under a principal launcher that asked for Astra/xhigh —
  the same wording that had worked on fifteen prior launches. `PREFLIGHT`
  now names the pin and its source when a principal-profile run isn't
  Astra/xhigh, and the principal launcher relays and flags it unless the
  order itself named that pin.
- **A launcher started in a worktree passes it as `cd`.** WO-7A2: the Agent
  tool put the launcher in a worktree, but the runner cannot see a
  launcher's cwd — it ran Astra against the main checkout, which held
  another session's dirty files, and Astra correctly BLOCKED at Part 0. A
  `cd` equal to the live tree is now labelled `tree: live working tree` on a
  resolved-path compare, the MCP `cd` description says when to pass it, and
  both launcher definitions pass their own working directory as `cd` when
  the Agent tool put them in a worktree.
- **Orders to the Codex lane are self-contained.** Three WO-4A rounds were
  lost to orders that referenced a prior round's ruling by name only — the
  engine is stateless and never saw it. Both launcher definitions now say
  every `orchestra_exec` call is a fresh engine and flag an order that
  visibly names a prior round.

**Tests.** Exec case 22 (branch-only claims relayed for DONE and BLOCKED, a
mixed claim still failing on the path claim alone, a real `checkout -B`
named in the audit), case 18 (the principal off-default note fires on a pin
and stays silent on the defaults and on the heavy rung), and case 12 (a `cd`
that resolves to the project dir is the live tree); the stub engine grew a
`STUB_CODEX_BRANCH` knob. Review-lane coverage for the manifest reader landed
with the doctor fix.

## 3.3.1 — the cross-compare architects: Fable opposite Astra, and a revision that simplifies

**Why.** Two owner-directed changes to `/cross-compare-plan`. The GPT lane now runs
`gpt-6-astra` (defaults: `crossplanModel` `gpt-6-astra`, `crossplanEffort`
`xhigh`) instead of Sol — the architects are Fable and Astra, the two top
rungs, and `effort=` offers `xhigh` (default) or `max`, one level applied to
both lanes. The `high` tier is gone with the model that anchored it, and
`architect-claude.md` with it; `architect-claude-xhigh` is the default Claude
seat. And the revise phase in both charters — the Claude agent files and the
runner's embedded charter, kept in lockstep — now carries a fifth rule: reduce
all excess and KISS, so the plan that leaves revision is as simple as it can
be while still complete and correct, with heavily engineered approaches earned
rather than granted. Revision had been read as a correctness-and-completeness
pass only, which ratchets plans upward: every adopted finding adds, none
removes.

## 3.3.0 — the Astra/Codex lane after its first campaign: eight field issues, one root for three of them

**Why.** The ADR-0005 campaign (2026-09-06) was the first to run the 3.2.0
ladder end to end — Astra executing, Sol reviewing, a Godot/Blender project
with LFS assets — and its Director kept a running list of what broke
(`plans/orchestra-codex-issues.md`). Three of the eight items had the same
root: the scratch global git config each runner hands the engine used to
REPLACE the user's global config, and everything the global config carried
went with it — the credential helper (`git fetch origin` inside the sandbox
died on "could not read Username for 'https://github.com'"), the LFS filters
(15 untouched PNGs under `docs/art/**` read as modified, and Astra, correctly,
refused a "clean tree" precondition twice), URL rewrites. The scratch config
now starts with a copy of the real global config (read by the runner as the
host user, so the sandbox that motivated the isolation never opens the user's
file) and copies `filter.lfs.*` across explicitly as well.

**Cross-family review is the first goal, and now the runner enforces it.**
PR #435 round 3 came back with an inner `REVIEW ENGINE: Claude CLI (opus …)`
header under the Sol header: the engine had found a Claude review MCP in the
Codex config and delegated the whole review to it. "No MCP" in the brief did
not stop it. Every runner now launches the engine with every MCP server in
the user's Codex config disabled by name and the Codex apps connector off
(`codex.engineMcp`, default `strip`; verified against codex-cli 0.153.2 — the
engine reports no MCP tools at all), the header carries an `mcp:` line, and a
verdict that still names a Claude engine as its author is stamped
`⚠ CROSS-FAMILY BREACH` rather than relayed as OpenAI's own. Two limits are
stated rather than hidden: a server name that needs TOML quoting cannot be
addressed through `-c`, and a project-level `.codex/config.toml` is named in
preflight, not touched — Codex loads it only for a trusted project, and
disabling a server it has not loaded kills the run on config validation.
`ORCHESTRA.md` §5 and the README now say the rule in one sentence: the
reviewer never shares the author's vendor — Astra or Sol executed, Opus
reviews; Claude executed, Sol reviews. Sol reviewing is the means, not the goal.

**The rest, each a field failure:**

- **`profile` is required on `orchestra_exec`.** The first
  `executor-codex-principal` run of the campaign printed `profile: heavy,
  model: gpt-5.6-sol (default)` — the launcher's rung never landed and the
  runner's silent default ran a Sol order under an Astra launcher. A call
  without a rung is now refused at the transport, in the transport's own
  voice, before any runner launches; the launcher re-issues once with its
  rung. Both launcher definitions say so.
- **The engine is told what was dirty before it started.** The exec brief
  carries a bounded `TREE STATE BEFORE YOU STARTED` block from the runner's
  own fingerprint, and names harness-owned session files
  (`.claude/settings.local.json`, the ledger and readings) as never counting
  against a clean-tree precondition — a fresh Agent-tool worktree arrives
  with that file untracked.
- **The sandbox may carry no GitHub credentials, and the brief says so.**
  Rule 7 now tells the engine to paste an auth failure under VERIFICATION and
  continue from local refs, reserving BLOCKED for a ref that is not local.
  The launcher definitions state the protocol: the Director fetches before
  dispatch and pushes after.
- **`--allow <cmd>` / `allow: [...]` on the review lane.** `--no-tests` is a
  blanket, and a Python-only review was barred from the `--self-test` its
  brief explicitly allowed. An allowed command is exempt from `--no-tests`
  and from a restriction written into the order, and the header reports
  `allowed commands: N` beside `prohibited commands: N`.
- **Launchers relay a BLOCKED bare.** No "Option 1 / Option 2" from a
  launcher; choosing is the Director's work.
- **The 0.153.x install layout is known.** Codex now lives at
  `<home>/.codex/packages/standalone/releases/<version-target>/bin/`; the
  doctor names it `codex-standalone-releases`, and sibling release folders
  are searched for helper repairs.
- **An undeletable leftover worktree is reported once.** A directory the OS
  would not release was re-reported as freshly reclaimed on every run for a
  week; it now carries a marker and is retried quietly after the first report.
- **Blender/Godot verification in review worktrees** is helped only as far as
  the LFS fix reaches — assets now hydrate, so the project's own Python
  checkers can run; Godot itself stays a Claude-lane verification.

**Tests.** Exec case 21, review case 29, and the MCP suite's 4b cover every
item above against the stub engine; the stub now reports the credential
helper and LFS filter it sees. The suites point the runners at an empty
`CODEX_HOME` by default so a developer's real Codex config never leaks into
the exact override lists.

**Reviewed by Astra, through the lane it fixes.** The first cut was sent
through `orchestra-review.js` pinned to its own commit with `gpt-6-astra`
as the engine — the local proof that the lane runs: the new install layout
named, three MCP servers stripped, one verdict. It came back REVISE with
five findings, all real and all fixed before merge: the MCP reader saw only
`[mcp_servers.<name>]` headers and reported "0 server(s) disabled" for an
inline table, a `[mcp_servers]` table, or top-level dotted keys (every shape
is read now, and a config that mentions `mcp_servers` in a shape the reader
cannot parse is said so in preflight); the global-config include resolved
the home from `os.homedir()` (USERPROFILE on Windows) where git reads HOME
first; the breach detector matched the header text anywhere in the verdict —
and stamped Astra's own verdict, because a finding quoted it as evidence — so
it now matches only a header line; the tree-state block forbade staging a
pre-existing path even when the order said to finish and commit it; and the
cross-plan runner lacked the explicit LFS copy. The suites also stop
inheriting a running lane's `GIT_CONFIG_GLOBAL`, which had cost Astra two
environment-dependent failures while re-running them inside the review.
Round 2 found three more, also fixed: the explicit LFS copy wrote values
bare, so a filter command with a quoted Windows path became a "bad config
line" that broke every later git command (values are quoted and escaped now,
and a git round-trip is in the suite); a quoted root key
(`["mcp_servers".x]`) was missed; and a header inside a multi-line string
(an example in `developer_instructions`) was taken for a server and would
have been "disabled" into a transport-less half-entry. Round 3 found three
more: the `[include]` of the user's global config was not the silent skip
this entry first claimed — a locked or ACL-denied file made git exit 128
before any fallback applied — so the global config is now COPIED into the
scratch config by the runner and the sandbox never opens the user's file
(relative includes inside the copy are resolved against the file they came
from); `[mcp_servers."claude"]` decodes to the same key as `claude` and is
addressable after all; and a `"""` inside a `#` comment opened a phantom
multi-line string that hid the next server. Round 4 found five, and settled
the pattern: every round had found a TOML shape the hand-written reader
missed (this time a `'''` inside an ordinary string and an escaped key), so
the runners now ask Codex itself — `codex mcp list --json` names every server
it loaded, decoded, with its enabled state, from every config layer it
applied — and the TOML reader is only the fallback for a Codex that lacks the
command, said so in preflight. The copied-config rewrite also learned to stop
a quoted `path` at its closing quote instead of folding a trailing comment
into the filename, and to rebase a relative `[includeIf "gitdir:./…"]`
condition along with the paths. Round 5 retired that rewrite the same way
round 4 retired the TOML reader: the scratch config now carries the user's
global config as git itself resolves it (`git config --global --list --null`,
run in the tree the engine works in, re-serialised with git's own escaping),
so includes and includeIf conditions are evaluated by git and no include text
is ever copied. Two real holes closed with it: a user extra arg could re-enable
a server the runner had skipped as already disabled (every known server now
gets its override, after the user's args), and a pinned review discovered
servers in the live project but launched in the throwaway worktree (discovery
now runs where the engine runs, per attempt). Round 6 refined the git
rendering three ways: entries are written in git's reported order under
repeated headers rather than grouped by section (a credential-helper reset
between two generic helpers means something only in that order); the query
covers every scope in the engine's tree and keeps the system and global
entries, so a `hasconfig:remote.*.url:` condition sees the repository's own
remotes; and a pinned review re-resolves the scratch config for its detached
checkout, so an `onbranch:main` include no longer follows it there.

## 3.2.0 — the executor ladder rebuilt: Opus medium by default, Astra on top, Sonnet reserved for tight specs

**Why.** OpenAI shipped GPT-6 Astra on 2026-09-03. On Terminal-Bench 4.0 it
scores 57.7% against GPT-5.6 Sol's 37.3% and Claude Fable 5.1's 55.8% — and
long-horizon agentic work in a live terminal is precisely what an executor
does. 3.1.0 had just added a Fable principal tier above the Opus heavy profiles
on the strength of the Tug campaign, where the longest review→fix chains all
sat at the heavy tier with no rung above. Astra is a better answer to that same
problem, so it takes that rung.

**Sonnet was carrying orders it should never have seen.** This one is the
owner's read of the harness in use, not a measured result — no Tug number
isolates it, and it is recorded here as the judgment it is. The mechanism is
concrete enough to act on: `executor` was Sonnet and took everything not
specifically routed elsewhere, so any order whose spec turned out to be softer
than it looked at PLAN time got answered with a confident guess instead of a
BLOCKED question. The fix is to make the default rung a model with the judgment
to notice, and to reserve Sonnet for the orders where that judgment is
genuinely not needed. If the shakedown shows the old default was fine, the
change to revert is one line of frontmatter.

- **`executor` is now Opus at medium effort** — still the default, still the
  same name, so "the default executor" and `executor` stay the same thing.
- **`executor-mechanical` (Sonnet, high) is new**, and it is reserved by *spec
  tightness*, not task size: a rename ripple, a codemod, a spelled-out patch, a
  well-trodden test addition. Its name says the criterion out loud because
  `-light` would have invited exactly the size-based routing being corrected. It
  carries the executor law verbatim, including "Blocked beats guessed", plus one
  extra clause — an order that turns out to need judgment about its own meaning
  was mis-routed, and the answer is BLOCKED, never widening the order to keep
  moving.
- **The Opus rungs are now an effort ladder, not a model ladder.** `executor`
  (medium) → `executor-heavy` (high) → `executor-heavy-xhigh` (xhigh) are one
  model at three efforts, so the routing question is how hard the *thinking*
  is, not how big the diff will be. No executor inherits the session default
  effort any more; every rung is pinned.

**The ladder in full:**

| Route | Agent | Model |
|---|---|---|
| down | `executor-mechanical` | Sonnet, high |
| **default** | `executor` | **Opus, medium** |
| up (effort) | `executor-heavy` → `executor-heavy-xhigh` | Opus high → xhigh |
| up (vendor) | `executor-codex-principal` | GPT-6 Astra, xhigh |

**Migration note.** `executor` changes model under an existing name, so
reinstalling into a project moves its default executor from Sonnet to Opus
medium. That is the intended effect; projects that want the old behaviour for a
specific order route it to `executor-mechanical`.

**Astra takes the top rung.** A double bounce at the Opus heavy tier escalates
straight to Astra, crossing the vendor line — for long-winded or highly
detailed work where spinning up the Codex lane is worth it. The
principal charter is unchanged from 3.1.0 and moves with the rung: exceptional
orders only — many coupled moving parts that resist splitting, an approach or
outcome the plan cannot settle in advance, or a second bounce at the heavy tier
— plus the two principal duties (the order names any decision it delegates and
its bounds, the principal records what it chose under DECISIONS, and on
escalated orders it fixes the whole class of a reviewer finding rather than the
cited instance).

**Demoted to user request only:** the Fable principal profiles
(`executor-principal`, `executor-principal-xhigh`) and the Sol executor
(`executor-codex-heavy`). All three stay installed and fully functional; no
routing rule reaches them. They run when the user names them, or when
`executorEngine: "codex"` makes the Codex lane the project's executor lane —
which is now the durable form of that same user request, and the only
routing-free path to Sol. Sol's old criterion ("concrete prior evidence that
Anthropic models struggled with this problem") is gone as a rule: with Astra as
the escalation target, a Director following it would have reached the weaker
cross-vendor engine on the way to the stronger one.

**Two consequences worth stating plainly.**

*Installing the `codex` pack now changes where escalated Claude work goes.* It
is no longer a purely additive cross-vendor layer. Without the pack the ladder
has no top rung: the Director says so in one line, escalates to
`executor-principal` (Fable) instead, and names the substitution in the REPORT.
Announced, never silent — the same posture as the §5 review alarm.

*Escalating past Opus flips the review lane.* An Astra-executed order is
Codex-authored, so §5 routes its review to the fresh-context Opus `reviewer`
rather than to `reviewer-codex`. That is the cross-family rule working as
intended, not a fallback, and it carries no alarm.

**A stale line fixed on the way through.** `executor-heavy` and
`executor-heavy-xhigh` still told themselves "You are the top execution tier —
there is no higher tier to re-send the order to." That went stale when 3.1.0
added the principal tier above them and was never corrected; it now sits
directly below the escalation target and would suppress the exact escalation
this release is built on. Both profiles now name `executor-codex-principal` as
where a dead end goes, with the stop-grinding law itself unchanged.

**One runner, two profiles.** `orchestra-exec.js` gained `--profile
heavy|principal` and the MCP tool a matching typed `profile` enum. The rungs
differ in model and effort and in nothing else: same `workspace-write` sandbox,
same idle precheck, same tree audit, same report-integrity nonce, same
one-attempt-never-retried law, same report contract. Each reads only its own
settings — `ORCHESTRA_EXEC_PRINCIPAL_MODEL` / `_EFFORT` and
`codex.execPrincipalModel` / `execPrincipalEffort`, defaulting to `gpt-6-astra`
/ `xhigh` — so pinning one rung can never move the other. `heavy` stays the
runner's default and keeps the key names it shipped with, so a run that names
no profile behaves exactly as it did in 3.1.0, down to the config it reads.

This is not the `--tier` flag 3.0.0 removed. That selected *effort levels of
one model* and earned its deletion; a profile names a model and its effort
together, and there is still no effort ladder to select inside a rung.

**An unknown profile is an alarm, not a substitution.** `--profile astra` — the
near-miss a human would actually type — falls back to the heavy rung and says
so on a `PREFLIGHT` line naming what did not exist and what ran instead. The
principal launcher is told to check the header for `profile: heavy` and flag
it, because the one unrecoverable failure here is a Sol run relayed as Astra's
work. `codexModelId` also learned the `GPT-6 Astra` → `gpt-6-astra`
display-name mapping — the same shape defect that cost the lane a round on Sol
in the 2026-09-02 shakedown.

**A principal order is goal-shaped, and the engine is finally told so.**
Harvested from PR #37, an independent parallel design for a principal executor
that branched before 3.1.0 merged and was closed rather than merged (its
`executor-principal` was a *different* agent from the one 3.1.0 shipped, and it
predated this ladder). Its good idea survives here: the principal rung takes a
goal, its observable done-criteria, the intent behind it and boundaries —
**not a file list** — because the work reaching that rung is work that loses its
value when cut into narrow orders. What that changed:

- The exec runner's brief is now profile-aware. A `principal` run carries five
  extra clauses (goal-shaped scope, decide-the-routine/ask-about-the-material,
  recon-before-you-build, surface-the-coupling, minimal-coherent-change) and is
  asked for a `DECISIONS` section. **This closes a real gap**: the launcher had
  been telling the Director to expect DECISIONS from a model nothing had ever
  asked to write one. A `heavy` run is unchanged and must not receive the
  charter — a heavy order is step-shaped.
- `/orchestra-plan` gains the principal branch in its decomposition gate and an
  `Intent:` field in the order template, so a goal-shaped order can actually be
  written down. Difficulty alone stays a heavy-tier reason, never a principal
  one.
- §8.1 exempts a principal order from the kind and subsystem caps — it is sized
  by its done-criteria, always carries the cadence clauses, and still gets
  exactly one review. §3.5 adds that one legitimate re-plan after a coherence
  failure (each fragment passed alone, the seams failed) is a single principal
  order, never a third try at the same fragment.
- The Fable `executor-principal` carries the same charter, because it is the
  announced substitute when the Astra rung is unavailable and must be able to
  take the same order shape.

**Coverage.** Exec-lane case 18 pins profile selection, both directions of
env/config key isolation, the unknown-profile fallback and its PREFLIGHT line,
and that an explicit `--model` still outranks a profile default. Case 19 pins
the ladder itself, because it is prose the Director reads and nothing
mechanical stops it drifting back: the demoted profiles must declare
themselves user-request-only, the Astra launcher must claim the top rung and
know nothing is above it, the heavy profiles must not claim to be the top tier,
and ORCHESTRA.md must carry the three-rung ladder, the demotion, the §3.5
escalation path and the announced-substitution rule. Case 20 pins the principal charter to the rung that earns it and its
ABSENCE on the heavy rung, plus the clauses the brief must state. MCP-lane case
4b pins the enum, that `profile` stays optional, both rungs end to end, and the
display-name mapping. Case 17's structural launcher checks cover the new agent.

## 3.1.0 — a Fable principal-executor tier above the Opus heavy profiles

**The failure.** In the PiratePartyPals Tug of War campaign (2026-09-02 →
09-05) the longest review→fix chains all sat at the Opus heavy tier with
nowhere to go: the result-latch order took nine Sol rounds at
`executor-heavy`, the hit-query benchmark six, the grid benchmark four. §3.5
escalated `executor` → `executor-heavy` after two bounces and then said "two
bounces at the heavy tier is a plan problem", so the Director re-planned in
place through warm resumes, and every extra round bought a cold-import Sol
review (20–40 minutes) plus a fix round plus an audit. Where the owner
improvised a rung above — `executor-heavy-xhigh` launched with a `model:
fable` override on the grid benchmark's fourth round — it converged first
time. Over the whole campaign, code orders routed to the Opus xhigh tier
from the start averaged 1.5 review rounds; orders started at Opus high
averaged 3.1 and orders started at Sonnet 2.3 (the heavy population is the
harder one, so the comparison is directional, not controlled). Field record
with the per-order chains and method:
`plans/field-evidence-tug-review-rounds-2026-09-05.md`.

**What the chains showed.** The rejections were not reviewer harshness in
the calibration sense — 47 of 48 Sol REVISE verdicts carried at least one
MAJOR BREACH, the Director recorded one hallucinated finding in roughly 90
verdicts, and Sol reproduced its own numbers on the benchmark rounds. The
dominant shape was whack-a-mole: the reviewer surfaced one blocking instance
of a class per round (an unenforced guarantee stated only in a doc comment, a
fixture that proved less than it claimed, one more hand-enumerated list left
stale), the executor fixed exactly that instance under its own "nothing but
the order" law, and the next fresh-context review found the sibling. Nine
rounds of that on one order is a tier-and-order-shape problem, not a
reviewer problem.

**The tier.** `executor-principal` (Fable, high) and
`executor-principal-xhigh` (Fable, xhigh) join the core roster — eight
Claude agents now. Same executor law and report format as `executor-heavy`,
plus the two duties the grinding chains showed were missing at the top rung:
a principal may make a decision the order explicitly delegates, within the
bounds the order states, and must record it under `DECISIONS`; and it treats
every reviewer finding in its case file as one instance of a class —
enumerate the siblings in scope, fix them all, list the sweep under
`CLASS SWEEP` — so the next review checks rather than rediscovers. Routing is
a PLAN-time decision, never self-promotion, for exceptional orders only:
many coupled moving parts that resist splitting, an approach or outcome the
plan cannot settle in advance, or a second bounce at the heavy tier. §3.5's
ladder is now explicit — `executor` → `executor-heavy` → `executor-principal`,
one rung per double bounce; two bounces at the principal tier is a plan
problem. §8.3 pins the efforts; the installer, the install census test, and
`/orchestra-status` know the two files.

**What did not change.** `executor` is still the default and the Opus heavy
profiles are still the hard tier; the Sol executor stays exceptional-only.
Fable is priced above Opus per token, so the tier earns its place only where
it removes rounds — which is exactly the population the field record names.

## 3.0.3 — docs-only work skips the cross-family lane, and five review-lane field fixes

**The failure.** Review routing keyed on the author's vendor alone, so a
prose-only commit — a README rewording, a CHANGELOG entry, a stale comment —
bought the same full Sol review as a subsystem change: a cross-vendor
sub-process, a tree checkout, an exploration pass that does not shrink with the
diff, and up to the 45-minute cap. Worse, when the Sol lane was down that
commit raised `⚠ CROSS-FAMILY REVIEW UNAVAILABLE` and got a "fallback" banner
on its verdict, reporting a degraded gate for work whose gate was never at
risk. Cross-family review exists to de-correlate *error modes in behavior*; a
diff that changes no behavior has none to de-correlate.

**The rule (§5).** A campaign whose whole diff is prose — README, CHANGELOG,
comments, user docs, plans, with no code, config, dependency, or
agent/skill/protocol instruction file touched — routes to the fresh-context
Opus `reviewer`. The gate is untouched: every campaign is still reviewed
(§3.2), the inert verification tier is still a claim the reviewer proves from
the diff first (§8.4), and the reviewer verifies the docs-only claim the same
way before accepting it. Only the lane relaxes — no alarm, and `reviewer`
omits its fallback banner because this review is the design, not a degradation.

**Where the carve-out stops.** `ORCHESTRA.md`, agent files, and skill files are
markdown, but they are the harness's behavior: an edit there changes what
agents do, so it routes by author vendor like code. Same for anything that
touches config, dependencies, or data. When unsure, it is not docs-only.

**Five field failures from one campaign day (2026-09-03), fixed in the
cross-vendor lanes.**

- **A prohibition the order only wrote is now binding.** Four reviews timed out
  running a suite their order had told them not to run. The order said it in
  prose, and prose reaches the engine only inside the `WORK ORDER` block —
  which the brief frames as the AUTHOR's intent, not as instructions to the
  reviewer, so the reviewer read "do not run the full ci.sh" as a fact about
  someone else's task and obeyed RULE 1 instead. The brief now carries a
  standing rule that a restriction written into the work order binds the
  reviewer with the same force as a `--forbid` flag, overrides RULE 1, and is
  reported as `UNVERIFIED (prohibited: …)`. The flags remain the precise
  mechanism: `reviewer-codex` is now told to lift prohibitions out of the
  order's prose — wherever they appear, including inside the pasted work order
  — into `no_tests`/`forbid`, and the header states `prohibited commands: N`
  **always**, including `0`, so a prohibition that never became a flag is
  visible in the report instead of being discovered in the burnt clock. Same
  always-on count in the exec header.

- **A project setting that did not land says so.** `codex.reviewTimeoutMs` was
  always read (flag > env > `orchestra.json` > default), but the read was a
  silent `try/catch`: an unparseable file and a key written at the top level
  instead of under `"codex"` both looked exactly like "no config at all", and
  the review then spent a default-length clock with nothing in the report to
  explain why. Both now leave a `PREFLIGHT` note naming the file and what was
  ignored, in the exec runner as well as the review runner. The header already stated the cap and its source (`(default)` vs
  `(orchestra.json)`); that line plus the note is now enough to diagnose it
  from the verdict alone.

- **Concurrent reviews of one repository no longer sabotage each other.** Two
  Sol reviews pinned worktrees off the same repository; the second spent its
  whole budget on `fatal: not a git repository: .../.git/worktrees/<name>` from
  every git command and timed out. A linked worktree keeps its metadata in the
  SHARED repository, and `git worktree prune` deletes the entry of any worktree
  whose directory it cannot see — so one review's teardown, sweep, or a user's
  own tidy-up unhooks a live checkout, and a directory that is merely
  unreadable for a moment (a sandbox ACL, a slow mount) counts as "cannot see".
  The runner now LOCKS its pinned worktree for the life of the review, which is
  exactly what prune is documented to skip. Because a lock survives its owner,
  the reason names the owning pid and the startup sweep releases the locks
  whose process is gone; a lock the harness did not take is never released.

- **A Codex sandbox-helper failure is diagnosed instead of guessed at.** One
  run logged `Failed to create unified exec process: helper_unknown_error:
  apply deny-read ACLs`, after which the engine could not find lines in files
  it had just read. The classifier called that "codex chose to exit"
  (non-retryable) and offered a list of causes it had not tested. Both runners
  now recognise the failure, name it as an INSTALL fault rather than a fault in
  the work, point at `--doctor` and the Windows helper siblings, and — in the
  review lane — retry it, because a fresh sandbox setup often succeeds. Only
  phrases that ARE the failure are matched; the helper filenames deliberately
  are not, so a change that merely talks about them is never misdiagnosed.

- **A killed attempt keeps the findings it had already written.** A timed-out
  review had already streamed a real defect — the fallback reviewer later
  reproduced the same one from scratch — and the runner kept a ten-line tail
  and discarded the rest. Failed attempts now carry up to 80 lines / 6000
  characters of what the engine actually said, under a `PARTIAL ENGINE OUTPUT —
  NOT A VERDICT` heading that says what it is: a LEAD for the fallback reviewer
  to confirm or discard, never a result this lane produced. The `VERDICT:` line
  is untouched — a partial is never promoted to a verdict.

## 3.0.2 — private relay inputs and bounded, credential-safe diagnostics

**MCP relay hardening.** The Codex engine transport no longer serializes work
orders and executor reports below the predictable project directory
`.claude/scratch/mcp/`, where default POSIX permissions could expose them to
other local users. Every call now receives an unpredictable directory under the
OS temp root, explicitly mode `0700`, with exclusive `0600` input files; the
directory is removed as soon as the runner closes. The transport tests inspect
those permissions in the child process, prove the directory is outside the
project, and prove cleanup occurred.

**No stale process-group signal.** Cancellation and the MCP kill-backstop now
terminate the detached POSIX process group immediately with `SIGKILL`. The old
SIGTERM-then-timer escalation deliberately survived the runner's close, which
meant its numeric process-group target could be reused before the delayed
SIGKILL fired. Windows retains the measured `taskkill /T /F` path. The
cancellation regression still proves both runner and grandchild are gone, and
the server source is pinned against reintroducing a delayed kill timer.

**Credential-safe diagnostics.** One shared redactor now covers quoted JSON
credential keys, Basic and Bearer authorization, case variants of `sk-` tokens,
and credential-bearing URLs for any URI scheme. Diagnostic handling refuses to
scan inputs larger than 256 KiB and emits an omission marker instead, avoiding
the prior redact-before-truncate full-buffer cost while preserving the safe
ordering. The helper is used by the MCP transport, all three installed Codex
lane runners, and the retained legacy Claude relay runners. Tests cover every
credential shape and oversized diagnostics.

## 3.0.1 — coexistence with Codex-Orchestra, and a review cap that stops eating whole reviews

**Dual-install safety.** Codex-Orchestra now exists as a second harness, and the two are installed into the same project often enough that the boundary has to be enforced rather than assumed. A Codex child launched by the review, execution, or cross-compare runner would otherwise read the target project's `AGENTS.md` and fire its `.codex` hooks — meaning a co-installed Codex-Orchestra could recast a worker as its own Director and start a campaign inside a review. All three runners now set an external-worker `ORCHESTRA_ROLE` (`reviewer-codex-external`, `executor-codex-external`, `planner-codex-external`) and pin `features.hooks=false` with `project_doc_max_bytes=0` **after** any user-supplied extra args, on the auth probe as well as the real call. Ordering is the whole mechanism: Codex resolves repeated `-c` flags last-wins, so an override placed before `ORCHESTRA_REVIEW_ARGS` could be undone by it. Verified against codex 0.151.0 — with an `AGENTS.md` sentinel, `codex debug prompt-input` carries it at baseline, drops it under `project_doc_max_bytes=0`, still drops it under the runners' hostile-then-isolation ordering, and restores it when the order is reversed. The owned surfaces are disjoint by construction: Codex-Orchestra's installer hard-refuses any managed path under `.claude/` and never touches `CLAUDE.md` or `.mcp.json`; the protocol files are `.claude/ORCHESTRA.md` and `.codex/ORCHESTRA.md`. `ORCHESTRA_PAUSE=1` pauses both by design; the pause files stay harness-specific.

**Review timeout 1800000 → 2700000 ms.** A live campaign lost a Sol review to the 30-minute cap under machine load, and the fallback Opus reviewer had to re-do it. The cap is not a budget knob: a runner timeout is classified non-retryable on purpose, because a second full-length attempt spends the same clock to learn the same thing, so one timeout forfeits the entire review and the gate degrades to `REVIEW_UNAVAILABLE`. The engine also explores the tree before it concludes anything, and that pass does not shrink with the diff. Overshooting costs nothing on a review that finishes — the cap is invisible except to the run it kills — so the default now clears the observed 12–33 minute tail with room, rather than sitting inside it. The exec cap is unchanged. If hangs ever displace slow-but-working reviews as the dominant failure, the fix is an idle watchdog on time-since-output, not a shorter wall-clock cap.

## 3.0.0 — the reverse-port: Orchestra 2.0's control plane removed, the legacy loop restored, one Sol lane

**Breaking.** The 2.0 roster (`--roster new`) no longer exists. A project still carrying a 2.0 install must be uninstalled with the **v2.5.0-final** checkout (`git checkout v2.5.0-final && node install.js <project> --uninstall`) before 3.0 is installed; the 3.0 installer refuses a `roster: "new"` target before writing anything. Rollback anchor: tag `v2.5.0-final`.

**Why.** After two live weeks the ticketed control plane (ticket gate, router, class registry, two-call close, verifier, quartermaster) had cost far more than it returned: 116 tickets in PiratePartyPals produced more anomaly rows than casting records, bounded Haiku scouts were served by Opus, reviewer verdicts went unparsed, and the engine gate failed closed on the project after its own uninstall. Two independent reviews (a GPT-5.6 Sol oracle and an Opus second opinion, both under `plans/port-3.0/`) reached the same verdict: the useful parts are the cross-vendor runners and their evidence, not the machinery around them. The owner ruled: port those back onto the simple harness and delete the rest. Full record: `plans/port-3.0/reverse-port-3.0-plan.md`.

**Removed.** `bridge/`, `router/`, `registry/`, `verifier/`, `quartermaster/`, `probes/`, `tools/` (ledger report, shakedown helpers), the twelve active roster profiles and `roster/lint.js` (dated records under `roster/` stay as history), `orchestra_dispatch` / `orchestra_close`, pins, seats, `rosterGeneration`, `projectId`, `installedFiles`, `installedStore`, `installedHooks`, `ORCHESTRA-CONDUCTOR.md`, the ticket-gate hooks, the Terra executor launcher (`executor-codex`), the exec `--tier` flag, `codex.execModel` / `codex.execEffort`, `reviewEngine`, and eight test suites with their CI steps. About 30,000 lines.

**Kept, unchanged in law.** `ORCHESTRA.md` (now ~90 lines), the six Claude agents (`scout`, `detective`, `executor`, `executor-heavy`, `executor-heavy-xhigh`, `reviewer`), the specialists, the three bundled skills, the guard hook (now legacy-only: Director boundary, pause switch, managed markers, plan/memory paths, positive-evidence Fable/Opus activation), and the `codex` pack's runners (`orchestra-exec.js`, `orchestra-review.js`, `orchestra-crossplan.js`) behind a four-tool engine MCP server (`orchestra_review`, `orchestra_exec`, `orchestra_crossplan`, `orchestra_doctor`).

**Changed.**
- **Mode is session-model only.** Fable or Opus at the helm → Director mode. Sonnet, Haiku, anything else → a normal agent, with no dormancy notice and no denials. When Opus directs, its orders and explanations must be concise, basic, and clear without dropping context the executor or the owner needs.
- **One Codex lane, all Sol.** `reviewer-codex` (GPT-5.6 Sol) is the default reviewer for Claude-authored work; `executor-codex-heavy` (Sol/high) is the only Codex executor and is reserved for problems with prior evidence that Anthropic models struggled; the cross-compare GPT architect is Sol/high. Terra and Luna are gone from the Claude-side harness.
- **Review is per campaign, not per order.** A campaign is one contiguous user goal from INTAKE to its final REPORT. It must receive at least one independent review before any handoff, merge, release, deploy, or switch of goal; the Director may batch related completed goals into one cohesive, commit-pinned review.
- **The Sol lane fails loudly.** When the pack is installed but Sol cannot review, the Director shows `⚠ CROSS-FAMILY REVIEW UNAVAILABLE — …` immediately, falls back to the fresh-context Opus `reviewer`, repeats the alarm in the final REPORT, and never calls the campaign Sol-reviewed. Work continues. The Codex launcher relays `REVIEW_UNAVAILABLE` verbatim; `orchestra_doctor` runs once at INTAKE so the alarm surfaces early.
- **Defaults.** Review model `gpt-5.6-sol` (was the Codex default); review timeout 1800000 ms (was 600000 — Sol reviews at high effort ran 12–33 minutes in the field). `executorEngine` stays (`"claude"` default, `"codex"` selects the Sol executor; an in-conversation instruction overrides it).
- **Installer.** Legacy-only. New preflight: refuses a `roster: "new"` target; on any other target scrubs the deprecated keys listed above from `.claude/orchestra.json` (preserving everything else) and warns about, but never deletes, an orphaned `.claude/orchestra/` directory.
- **No telemetry code.** The plan ledger (`.claude/plans/ledger.md`, already mandated) is the record. A `SubagentStop` hook is the first follow-up if that proves insufficient.

## 2.5.0 — punch-list closures: engine model ids, Director-editable status files, a bounded Investigator rung, and two ORCHESTRA.md follow-ups

Four independent fixes landed together as one version bump.

`packs/codex/hooks/orchestra-engine-mcp.js` gained `codexModelId()`: under a ticket,
`orchestra_exec` had been forwarding the roster casting's display name (`GPT-5.6
Terra`) verbatim as `--model`, which Codex answers with an entitlement-shaped 400
("The 'GPT-5.6 Terra' model is not supported when using Codex with a ChatGPT
account"); the function now maps display names to runtime ids before the flag is
built. Regression check: `tests/mcp-lane.test.js` case 10b (PL-18).

`hooks/orchestra-guard.js` now honours the two PATH keys `directorPlanPatterns` and
`directorMemoryPatterns` under `roster:new` — only `directorAllowedTools` (a TOOL
key) stays ignored — so a project can name a status/plan file outside
`.claude/plans/` (e.g. `docs/current_status.md`) as Director-editable without
routing every edit through a builder ticket. Covered by `tests/guard.test.js` case
14(b′); README wording updated (PL-38).

Investigator gained a `bounded` rung (Anthropic · Haiku 4.5 · off) in
`router/castings.json`; the `mergedClasses.N0` entry and the `scout` alias now route
to it instead of the Opus·high primary casting, restoring a cheap path for
where/what/list lookups. `router/router.js` passes a merged class's `rung` into
`cast()` and validates it; `roster/investigator.md` documents the N0-mode contract;
`registry/classes.json`'s N0 casting text and `tests/router.test.js` were updated
(PL-36).

`ORCHESTRA.md` §3.4 gained the roster:new batching sentence (all independent
dispatches in one message, then all their `Agent` launches in the next), and §1
MODE B gained a note that Opus/Sonnet cannot read Fable 5.1 thinking blocks, so a
MODE A→B switch belongs in a fresh session (PL-37, items 2 and 3; item 1, an
effort re-sweep on Fable-cast rungs, remains open pending a measured exercise).

Also new, not yet installed anywhere: `tools/orchestra-ledger-report.js`, a
read-only ledger roll-up — per-ticket durations, token usage drawn from subagent
transcripts with an API-price equivalent, pool-reading draw, and anomalies.

`bridge/close.js` close #1 now honours the review policy the dispatcher already
computed. `router/router.js` has always returned `mandatory`/`preferred`/`none`
and dispatch has always recorded it on the envelope, but close #1 called
`reviewer()` with no `policy` at all — so the default won, every T1 was promoted
to the T2 frontier row, and a cross-family reviewer was minted for *every*
implementation, including no-change and verification-only work (a 2026-09-02
oracle measured reviewers at ~35% of recorded active time with 5 of 17 reviewer
tickets ever reaching `CLOSED`). The policy is now passed through; `reviewer()`
gained a `none` branch that casts nobody (and *throws* at T2/T3 rather than
silently downgrading a mandatory review) plus a `rowTier` field so the selected
row is assertable — the T1 and T2 anthropic rows both serve GPT-5.6 Sol · high,
so the model name alone could not tell the bands apart. On a dispatcher-recorded
`none`, close #1 closes on the Verifier alone — but only after re-proving
`PASS`, `deterministic_only_closure`, and a `git diff --numstat` range of at
most 2 files / 20 lines from its own evidence; anything short of that falls
through to the ordinary reviewed path with `close_mode_reason` naming the
condition that refused it. `registry/schemas/casting-record.schema.json` gained
required `review_policy` and `close_mode` (plus optional `close_mode_reason`,
`diff_files`, `diff_lines`), keeping `additionalProperties:false`, so the ledger
can finally answer which review band closed a ticket — the question the oracle
could not. Covered by `tests/router.test.js` §6b, `tests/bridge-close.test.js`
§11, and five new `tests/registry.test.js` tamper cases.

## 2.4.1 — WO-12 pre-trial work closed under an oracle-authored bound; 12f withdrawn

What prompted this release is a postmortem, not a finding. Rounds 4–8 of the
WO-12 blinding work had escalated a met reader standard (a fresh blind reader
at or below chance since round 3) into an arms race against a label-informed
style classifier — a threat outside the trial's model, since a per-packet
reviewer holds one clone and one brief, never 84 labels. The owner called the
creep, directed a hard turn to live pilot testing, and dropped Terra as a
reviewer candidate outright ("attempting to find cheaper reviewers is
unnecessary"), and a session scope oracle ratified a bounded close-out and
authored the stopping rule — worker-authored stopping rules being the round-7
lesson (amendment xii built its own treadmill).

Landed: protocol amendments xiv (the stopping rule: one completion pass on
the 20 residue ids plus at most one repair pass; blind test #4 once with one
bounded retry; the pre-registered rounds-8 delta review struck; every later
classifier finding a disclosure, never a gate) and xv (12f withdrawn, X-Terra
struck from every phase, the served-model identity follow-on moot; the
corpus's consumers are 12d and 12h). Content batch G5 cleared the three
residue findings; the corpus regenerated idempotently; blind test #4 — drawn
by `blind-draw.js`, read by a fresh-context evaluator, scored mechanically —
came in below chance, and `--check-only` now prints **SEAL: PASS** with the
transcript committed. A sub-chance disclosure (the evaluator's honesty
heuristics fired on real history, not the seeds) is recorded in
`BLIND-TEST-round8.md` and, per amendment xiv, gates nothing. The X-Sol
phase-0 dry-run is clean. The trial now waits on exactly two owner actions:
the codex helper repair and the P0 `/status` readings.

## 2.4.0 — WO-12 round 8: the stopping standard enforced, not described; the review runner made observable

What prompted this release is a verdict, not a feature request. The first
cross-vendor pair of delta reviews on the WO-12 tooling (Anthropic rounds 6–7,
OpenAI rounds 3–7 — the latter after two VOID attempts, see below) converged
blind on the same four defects and then each added its own. The Anthropic
lane applied the protocol's own stopping standard and found it unmet: a
style-only classifier at 85.7% precision under leave-one-out CV, and a
nine-rule list of absolute thresholds that labels 58 of 84 packets with zero
errors. Round 7 had gated every *mean* the previous review named; the tails
were untouched, and a floor of 8 words minted the rule "shortest sentence is
exactly 8 → control" on 15 packets.

- **New: arm (8), single-threshold purity.** `assemble-key.js` now scans 15
  derived features (sentence counts, mean/min/max/sd sentence length, commas,
  semicolons, colons, dashes, "and", connectives and digits per 100 words)
  at every observed value in both directions and fails any rule that fires on
  ≥5 artifacts of one population and 0 of the other, printing per failing rule
  the artifacts it fires on. This is the generic test that would have caught
  the round-3 length tails, the round-5 sentence shapes and every rule in the
  reviewer's list with one gate; it is the in-tool proxy for amendment
  (xii)'s classifier arm (protocol amendment xiii).
- **New: `SEAL:` verdict.** `--check-only` now prints the whole distribution
  report and exits 1 when briefs drift from generation, a purity rule fires,
  or `corpus/blind-read.json` — amendment (vi)'s acceptance evidence — is
  absent, stale against a content hash, or above the 65% ceiling. The
  standard was rendered before; it is enforced now. `--no-seal` for interim
  content work.
- **Fixed: the identity gate was writable by its subject.** `served_model`
  was parsed out of the reviewed model's own transcript, so the only reachable
  PASS for gate 5 was a line the model wrote; a contradicting line failed it.
  `run-lane.js` now honours the field only from the runner's header block
  before a literal `=== ENGINE OUTPUT ===` delimiter.
- **Fixed: the FINDINGS window terminator, from both directions.** The
  round-7 rule ended the window at any heading, any `---` and any `--flag`
  continuation, so a correctly cited CRITICAL under a `### CRITICAL` subhead
  scored MISS with no warning (Anthropic); it also did not end at a
  Title-case bare label such as `Verification rerun:`, so a re-run block could
  mint a hit (OpenAI). Now: same-or-higher headings, named sections, bare
  labels, and the literal runner delimiters end it; severity subheads,
  rules and flags do not.
- **Fixed: what the lane's checkout revealed.** Run clones were directories
  named `sdc-NNN`, and the seeded id blocks are published in this repository;
  `--run-clone-root` inside the repository let a clone reach the live key by
  relative path. Clones are now named by an opaque per-run token with an
  id↔token map beside the results, and a root inside the repository or any
  worktree is refused.
- **Fixed: the `Commit subject:` line.** Round 6 removed the sha half of the
  reused-base pair oracle and left the subject half — ten byte-identical
  lines, each pair one seed and one control. VARIANTS v4 prints no subject;
  the reviewer has `git log` in the clone.
- **Fixed, smaller:** unigram exclusivity now covers two-letter words,
  stopwords and bare numbers (`we` was 0 seeded / 13 control under the old
  exclusions); sentences split unconditionally with an abbreviation list and
  the shortest-sentence range is gated, not just its mean; resume keeps the
  absolute run index so gate 6's streak survives a crash; gate 3 is not
  ready while a run is dead; hex lint floor 6 with a `0x` boundary; label
  lint zero-tolerance; blind draws backtrack before reporting a shortfall and
  are stored verbatim; `.gitattributes` `-text` on the JSON evidence files.
  Suite 815 → 983 checks.
- **Found: a review runner can silently run the test stub.** An OpenAI-lane
  attempt returned `VERDICT: APPROVE` — the literal output of
  `tests/fixtures/stub-codex.js`, run because `CODEX_BIN` was set in the
  invoking environment; the runner logged no resolved engine, so nothing but
  the fixture's prose exposed it. The next attempt died under a 10-minute
  foreground cap the dispatch itself imposed. Both ruled VOID and charged.
  `orchestra-review.js` now prints `ENGINE BIN: <path> sha256=<hex>` in its
  header, ends the header with the `=== ENGINE OUTPUT ===` delimiter
  (occurrences inside engine output are neutralised, so the engine cannot
  forge a header), and refuses a fixture engine unless
  `ORCHESTRA_ALLOW_STUB_ENGINE=1`. It emits no `served_model:` because
  codex-cli 0.151.0 exposes none — gate 5 reads LIMITED on codex lanes
  honestly until the CLI reports one.
- **Content round 8** re-authors both populations against the purity gate's
  targets; blind test #4 and the rounds-8 delta reviews follow and are
  recorded in STATUS.md.

## 2.3.0 — WO-12 trial substrate: a pre-registered protocol, a sealed seeded-defect corpus, and the lanes to run it; the codex sandbox fault root-caused

The plan's paired-casting trials (WO-12) exist as runnable, pre-registered
instruments rather than intentions — but **no trial pass has run**: every
pass is gated on the Quartermaster showing a usable pool and on the codex
helper repair below. What prompted the shape of this release is the
review-qualification problem the plan names in § 3.4: no measurement of
GPT-5.6 Terra's review recall exists, so the T1 relief lane is neither
granted nor denied on evidence — it is qualification-gated, and a
qualification needs a corpus whose answer key was sealed before any reviewer
saw it.

- **New: `plans/cross-compare/agent-role-architecture/wo12/wo12-protocol.md`** —
  decision rules, corpus design, lanes, phases and scoring for trials 12a/12c/
  12d/12e/12f/12h committed before any model pass (the WO-7b precedent); 12b
  deferred to the shadow period with its rule fixed now; allowance governance
  bound to P0 bucket state. One pre-run amendment recorded in place (the 12h
  variant rotation, which the first draft skewed 18/6/6).
- **New: the seeded-defect corpus (`wo12/corpus/`)** — 84 review packets drawn
  from this repository's own history: 30 seeded variants (6 complementarity
  types × 5 — constraint violation, over-obedience, long-context miss,
  falsified test state, unsupported claim, race/lifetime; 6 CRITICAL, 24 MAJOR,
  0 MINOR) and 54 unmodified controls, packet variants 10/10/10 and 18/18/18
  for the blinding factor. Each seed was produced by a fresh-context seeder
  that saw only its own base commit, type definition and rubric — never the
  key — as a `P → C'` patch that re-applies in a fresh clone with the suite
  green (an escaped defect, not a red one). The key is sealed in
  `corpus/key.json`; `CONSTRUCTION.md` records every tally, head sha,
  deviation and brief normalization.
- **New: the lane tooling** — `build-corpus.js` (reproducible variant
  materialization in a throwaway clone; the variant's commit message is the
  real commit's subject, so the reviewer reads the intent the packet claims),
  `run-lane.js` (P0-gated, `--yes`/`--dry-run`, one retry on UNAVAILABLE,
  verbatim results; refuses unless the Quartermaster shows OU usable),
  `score.js` (mechanical hits with `exact-path` vs `basename-only` tiers and a
  `--strict-paths` mode, Wilson intervals, the 12f gate table, the 12d
  seed-level union table), `assemble-key.js` (all-or-nothing key assembly,
  brief sha normalization, leakage and template-conformance lints scoped to
  the author sentence and exempting transcribed commit subjects). Suite:
  `tests/wo12-tooling.test.js`, in CI.
- **New: the 12a, 12e and 12c corpora** — 8 bounded Builder orders with
  hidden acceptance tests (red on baseline, green on a private reference), 12
  hard-environment tasks with a scope-audited resolver check (`check-task.js`
  reports out-of-scope mutation as NOT_RESOLVED even when the check passes),
  and 6 static-component orders with a dependency-free markup/contrast checker
  reusing the WO-10 contrast algorithm.
- **Round 2 (pre-run), after two REVISE verdicts on the tooling commit** — the
  Anthropic fallback lane (4 CRITICAL / 12 MAJOR / 8 MINOR) and the cross-vendor
  lane (3 CRITICAL / 10 MAJOR) converged on the same lines. What they found is
  the kind of thing a sealed corpus exists to prevent: the P0 gate proceeded on
  any Quartermaster failure that was not the literal refusal string; the seeded
  variant's commit identity (`WO-12 seeder`, a one-line message, no ref)
  separated seeds from controls at 100%; the answer key was reachable from the
  reviewer's clone through `.git`; and 14 of 30 seeded briefs were structurally
  distinguishable from controls. All closed before any pass: the gate proceeds
  only on a positive Green (or confirmed Amber) reading parsed from
  `--state`'s JSON, with the projected-draw check and the phase-0 stop
  condition; variants commit with the real commit's author/committer/dates/body
  and every review runs in a **sanitized clone** (refs, remotes and reflogs
  removed, unreachable objects pruned, key blob asserted absent) for seeds and
  controls alike; briefs are **generated** from per-artifact content files under
  one structure, hazards from a closed kind-vocabulary, with structural-tell,
  leakage, vendor and word-band lints that run before `key.json` is written;
  hits require the locator's path (basename-only is a reported near-miss);
  identity, false-blocker, adjudication-promotion and phase-order rules follow
  the protocol text exactly. Two lessons recorded: a builder agent wiped 54
  untracked content files with its own `rm -rf` (now impossible in-tool:
  `O_EXCL` writes and a byte-level directory snapshot asserted before every
  exit), and shared directories are committed per batch from now on. CI then
  caught what no local run could: `build-corpus.js`'s nested-clone guard was
  inoperative on macOS and Windows runners — a clone destination does not exist
  yet, so a one-sided `realpath` left the two paths in different namespaces
  (`/var` vs `/private/var`; `RUNNER~1` vs `runneradmin`) and the guard would
  have created a clone inside the tree under review. Fixed by resolving the
  nearest existing ancestor on both sides and comparing segment-wise, case-folded
  on win32/darwin, with every source-spelling × destination-spelling pair pinned.
- **Round 3 (pre-run), after the round-2 delta verdicts** (Anthropic 0C/5M/6m,
  OpenAI 4C/2M — no CRITICAL reopened). The finding that mattered was measured,
  not argued: a fresh evaluator separated seeds from controls at 83% on ORDER
  prose alone, because seeds were drawn from single-invariant code commits and
  controls from softer chore/docs commits. The fix is content plus a lint: every
  control ORDER/CLAIMS was re-authored to the seeds' register from its own
  commit body (135–160 / 65–95 words, hard constraints the body supports), then
  calibrated against the seeds' measured hardness (2.3 whole-word
  must/never/exactly/… per ORDER) — first drafts overshot to 4–16 and would have
  flipped the tell — and a **population-balance lint** now fails assembly when the
  populations' mean lengths differ by more than 6 words or their hardness ratio
  leaves 0.80–1.25 (final: Δ3.2 / Δ1.8 / 1.00). Also closed: artifact ids are
  validated before any delete path; no-verdict runs are UNAVAILABLE, not 0-hit
  completions; false-blocker completeness is per finding; adjudication
  promotions require the lane, the id, and a quote that appears in that lane's
  verdict; interrupted phases resume and duplicates refuse; the phase-0 stop
  counter persists across invocations and lanes; the exact-path suffix tier is
  gone. One limit stated rather than papered over: the runner's model header
  echoes the request, so the 12f identity gate is labelled `echoed-request` until
  the runner surfaces a served model. Suite: 533 checks.
- **Round 4 (pre-run): the blind test, measured again.** A fresh evaluator over 24
  regenerated briefs scored 10/24 (41.7%) — at or below chance, against 83% in
  round 2 — and its only confident hits keyed on a literal `Constraint:` label
  that five seeded orders carried and no control did. A scan of all 84 content
  files found the pattern was general: 15 distinct sentence-initial labels, each
  present in exactly one population (`Verification:` in seeds, `Suites:` in
  controls, a dozen one-offs), because labels are bespoke to the change they
  describe and never balance. So the rule is zero tolerance — no inline
  label-plus-colon inside ORDER or CLAIMS prose, enforced by a lint that refuses
  assembly — and the 21 affected files were rewritten as plain prose with every
  fact, number and constraint preserved. Suite: 561 checks.
- **Round 5 (pre-run): what a reader cannot see, a classifier still could.** The
  round-3 delta reviews (Anthropic 0 CRITICAL / 5 MAJOR; cross-vendor pending)
  put a fresh reader at exactly chance (50%) and then showed, with corpus-level
  statistics, that the populations were still separable at 100% precision on
  25 artifacts: the controls had been authored into tight bands while the seeds
  kept their wider spread, so the tails were seed-only; backticks appeared in 10
  seeded orders and no control; two idioms in 15 controls and no seed. The fix is
  symmetric authoring plus measurement: both populations now sit in the same
  bands (ORDER 135–160, CLAIMS 65–95 — final means 150/148 and 80/78), backticks
  are forbidden in content prose, watched idioms are balanced or absent, and a
  **distribution lint** refuses assembly on range floors or ceilings more than 8
  words apart, sd ratios outside 0.6–1.6, digit density more than 1.5/100 words
  apart, any content 3-gram exclusive to one population in 4+ artifacts, or a
  watched idiom outside a 0.5–2.0 frequency ratio. Also closed: the identity gate
  reports `LIMITED` (never PASS) on echoed evidence; the substring fallback that
  re-admitted the suffix tier is gone and hits are minted only from the FINDINGS
  section; per-finding adjudication coverage needs an exact, length-bounded match;
  a truncated sibling results file refuses instead of disarming the phase-0 halt.
  Two things the n-gram lint taught, recorded rather than smoothed over: its first
  cut (any 3-gram, 4+ documents) flagged 133 phrases, almost all connective
  scaffolding, and had to be re-scoped to content-word 3-grams in 6+ documents;
  what survived was not subject matter but one author's sentence repeated across
  nine consecutive control files — a fingerprint the rule exists to catch, fixed
  by varying the prose. The genuine asymmetry — docs/records commits exist only
  among the controls, because every seeded base has to be a code commit — cannot
  be authored away and is disclosed in `CONSTRUCTION.md` with the exclusive
  n-grams as evidence: a whole-corpus classifier can see it; a per-packet reviewer
  in a sanitized clone cannot.
- **Round 6 (pre-run): the second blind test scored 24/24 — and taught the right
  lesson.** The signal was not review content but the commit shas the brief
  templates quoted: across many packets a control's head reappears as another
  packet's base, and the ten reused-base pairs show one subject under two heads,
  one per cohort. A single-packet reviewer in a sanitized clone sees only its own
  HEAD and cannot chain packets; the blind-test instrument, a many-packet reader,
  could. Shas now leave the brief text entirely (the runner is handed the refs out
  of band), a lint refuses any hex-sha token in a brief, and blind draws are
  pair-aware and seeded. Round 3's chance-level result stands as the content
  measure; a third blind test on the regenerated briefs confirms it.
- **Round 7 (pre-run): a stopping rule, stated.** The rounds-4–5 delta review put a
  fresh reader at 33% — below chance — and then built a style-only classifier at
  90% precision from two features no lint gated: seeds ended claims with clipped
  sentences ("Done."; shortest sentence 5.6 words vs 12.5) and controls alone used
  diff-stat vocabulary ("deletions", "insertions", "touching"). Both are now gated
  (a sentence floor; unigram exclusivity at 8+ artifacts) and the content re-authored
  once more. It also found a CRITICAL in the identity gate — a bare substring made
  "served_model not reported" read as independent evidence, and an explicit
  contradicting served model could still return MATCHED — fixed so that only an
  explicit served model equal to the lane's model counts as evidence, a contradiction
  fails the gate, and absence is `LIMITED`. The FINDINGS extractor now stops at any
  header, not two named ones. And the protocol now says when this ends: the corpus
  is accepted when every gated feature passes and the delta reviewer's best ungated
  style classifier no longer reaches 80% precision over 84 artifacts — an adversary
  with all 84 labels will always find *something*; the standard is that it is
  disclosed, not that it is zero. Round 7 landed: the 84 content files re-authored,
  every gate green on the sealed content (sentence floor 0 failures, shortest-sentence
  means Δ1.3 of a limit of 3, unigram exclusivity 0 at df≥8), 168 briefs regenerated
  idempotently with zero sha-like tokens, sanitized run clones re-verified, 815 checks
  in the suite. A third blind read and the rounds-6–7 delta reviews run against it.
- **Found: a review runner can silently run the test stub.** The OpenAI-lane delta's
  third attempt returned `VERDICT: APPROVE` — the literal output of
  `tests/fixtures/stub-codex.js`. `CODEX_BIN` (the runner's only engine override) was
  set in the invoking environment; the source is undetermined and the runner logs no
  resolved engine path, so nothing but the fixture's prose exposed it. Ruled VOID; the
  lane's delta stays outstanding and re-runs with the binary pinned and the environment
  quoted. Follow-on: the runner prints the resolved engine path and hash in every
  verdict header and refuses a fixture path outside an explicit test mode.
- **Found: the "intermittent codex sandbox fault" was never intermittent.**
  A fresh-context Investigator refuted the working-directory hypothesis and
  located the emitter by hash and binary search: the `codex-command-runner.exe`
  inside the 0.151.0 install is byte-identical to 0.147.0's and rejects the
  0.151.0 CLI's spawn protocol v6 on the unified-exec tool path; the legacy
  shell path works, so the discriminator was which exec tool the model picked
  on a turn (23 engine-reaching attempts, 18 faults; `-c
  features.unified_exec=false` refuted 3/3). Repairing the helper is an owner
  action on the install, outside this repository — recorded, not patched.
  `roster/wo11-codex-fault-investigation-2026-08-31.md`.
- **Records:** the owed Refactorer/Runner/Architect exercises re-attempted
  (5 attempts each, all BLOCKED on the fault, fixtures untouched; one Architect
  attempt charged to the Conductor as a dispatch staging error); WO-13 disposed
  as having no target (the metered planning lane was deleted in 2.0.0).

## 2.2.0 — the Quartermaster substrate; the next-generation roster staffed; freshness becomes the pool state's only routing gate

The agent-role-architecture plan (`plans/cross-compare/agent-role-architecture/`,
WO-8 through WO-11) lands as a running capability rather than a design
document: a deterministic pool-state substrate, and the roster of role files
it and every other new seat run under.

- **New: `quartermaster/`, class P0 of the plan's seat catalog** — the
  substrate that knows how much of each vendor's allowance remains, per
  bucket (`AU-all`, `AU-opus`, `AU-fable`, `OU`), predicts exhaustion, and
  publishes the degradation state `router/router.js`'s `normalizeBuckets`
  reads. It computes nothing it was not told: every fraction it publishes
  came from a reading a human (or a future scraper) recorded, with a
  mandatory provenance `source` string — never a number derived from the
  telemetry ledger or a burn model (§5.2's "inventing a denominator would
  fabricate a number"). A bucket with no usable evidence FAILS CLOSED,
  never defaulting to Green (fabricated capacity) or Red (fabricated
  scarcity) — the typed refusal names the bucket, its age where one exists,
  and the exact `--record` command that fixes it. Also ships: the §5.5
  Amber-arm confirmation protocol (a grant is evidence about the reading it
  was made against, re-validated live on every call, never a standing
  permission), two-point throttle prediction with typed confidence, a human
  `--report`, and a `--publish` snapshot — all zero-dependency CommonJS, the
  same conventions as `verifier/`. Proven by `tests/quartermaster.test.js`
  (195 checks, including a router-interop section that feeds P0-produced
  state through the real `router/router.js` end to end) and documented in
  `quartermaster/README.md`'s R1-R12 numbered rulings, each marked
  plan-cited or unstatedInPlan.
- **Freshness is the pool state's only routing gate — no disclosed-but-usable
  staleness band.** An early revision let a reading up to 48h old still
  publish (disclosed, undiscounted) and still arm the §5.5 gate, on the
  theory that disclosure was enough; a delta review demonstrated the gap
  directly: `router/router.js`'s `normalizeBuckets` rebuilds `bucket_state`
  from exactly four keys and drops any disclosure wrapper, so a
  stale-but-published reading reached the router indistinguishable from a
  fresh one at the one place the distinction needed to survive, and a
  confirmation granted near the edge of its evidence's freshness window
  could still be honored two days later. The rule now: a reading older than
  `maxFreshMs` (24h) is not routing evidence at all — it fails the whole
  bucket closed exactly like an absent reading, never published, never
  disclosed-but-routable. A human operator still sees a refused bucket's
  last reading and its age in `--report`, marked `REFUSED-FOR-ROUTING` —
  that is display, never a routing input. Go-live for the substrate
  therefore requires a `/status` reading per 24h window per bucket, matching
  the plan's own "before each scheduling window" cadence for the dynamic
  review reserve (`final-plan.md:1003`).
- **The next-generation roster is staffed: 24 role files across WO-8–11's
  four bands**, each carrying the plan's nine Part-2.0 fields, cross-checked
  against `router/castings.json` and `router/charters.json`, and dispositioned
  through committed review rounds rather than summarized into a single
  ledger row — see `roster/wo8-review-dispositions.md` and
  `roster/wo9-band-record.md` through `roster/wo11-band-record.md`.
- **`roster/lint.js` hardens the roster contract check.** The legacy-name
  collision check now scans `agents/specialists/*.md` in addition to
  `agents/*.md` (a live specialist can supersede an old one under a name
  that only collides one directory down) and runs case-insensitively; the
  mirror-or-declared-exception check accepts a declared `noMirrorFor` or
  `crossFamilyByConstruction` exception in place of a shipped mirror file,
  but only when it carries a non-empty `reason` — a truthy key alone does
  not satisfy the check.

## 2.1.0 — review findings carry a BREACH/GAP provenance bucket; the running-process rule reaches every Bash-granting role

The WO-2 throughput probe re-reviewed 20 already-merged commits through the
cross-vendor lane and 17 drew REVISE. A finding-by-finding calibration audit of
three of those reviews found the reviewer *accurate* — 10/12 findings real,
zero noise, every `path:line` citation resolving — but miscalibrated in one
specific way: its REVISE bar was "any gap versus the commit's stated intent,"
so edge-case hardening shortfalls (an empty-string name slipping a lint, an
exotic YAML escape) drew MAJOR labels alongside genuine contract violations,
and on a hardening-themed repository that made REVISE near-universal. The old
format looked reasonable because severity was doing double duty: it graded how
bad a defect was, but the verdict rule needed to know something else — whether
this change *caused* it.

- The reviewer brief (`orchestra-review.js`) now requires every finding to
  carry a provenance bucket alongside severity: `[BREACH]` — the change breaks
  what it itself set out to do (introduced defect, violated order requirement,
  failed claim in its own report or changelog, self-contradiction) — or
  `[GAP]` — a real weakness the diff exposes but never promised to fix. The
  verdict rule keys on the bucket: a CRITICAL or MAJOR BREACH forces REVISE;
  GAP findings of any severity, and MINOR BREACHes, permit APPROVE with the
  findings listed as dispatcher backlog. When torn, the brief says BREACH.
- The same probe's review of `98a5157` refuted `ORCHESTRA.md`'s claim that
  "every role that runs commands carries the rule" about never ending a turn
  on a still-running process: `scout` and `detective` granted Bash and carried
  no such rule, and the three `architect-claude*` launchers in the codex pack
  had lost it in the 1.13→2.0 rewrite. All five now carry it, phrased for
  their failure shape — a short read-only command promoted to a background
  task on timeout is still a running process the agent started. The claim in
  `ORCHESTRA.md` is true again. (The MCP-transport launchers run no commands
  and correctly carry nothing.)

## 2.0.0 — /deep-plan retired; /cross-compare-plan supersedes it

The plan roundabout was the harness's only lane that called a metered vendor
API directly. Every other cross-vendor role reaches OpenAI through the Codex
CLI, on the same subscription auth as the rest of the tooling, so `/deep-plan`
carried a second billing model, a second failure surface, and a second set of
credentials for one capability — and the capability itself was the weaker of
the two planning gestures: its counterpart worked blind, with no repository
access, so it critiqued the brief as much as the plan, and it could never
challenge the framing of the draft it was handed. 1.11.0 shipped the lane that
does both better. Keeping a superseded lane alive is not free — every protocol
document, roster, and troubleshooting table has to keep describing it.

- **Breaking, and the reason this is a major bump.** The `orchestra-engine`
  MCP server's published surface lost a tool: `tools/list` no longer
  advertises `orchestra_deepplan`, and a call to it is now an unknown-tool
  error. Anything pinned to that name breaks and must be repointed or
  retired — a custom agent whose `tools:` frontmatter grants
  `mcp__orchestra-engine__orchestra_deepplan`, a launcher profile of your
  own, or an external MCP client. `/deep-plan` likewise stops resolving as
  a slash command, and `planner-gpt` is gone from the protocol's roles
  table. Under this repo's versioning rule those are breaking protocol
  changes, not a capability removal that a minor could carry.
- **`/deep-plan` is gone**, along with everything that existed only to serve
  it: the `planner-gpt` launcher agent, the `orchestra-deepplan.js` runner,
  the `deep-plan` skill, the `orchestra_deepplan` MCP tool and its lane
  wiring in `orchestra-engine-mcp.js`, and the `ORCHESTRA_DEEPPLAN_*` /
  `OPENAI_BASE_URL` settings that had no other consumer.
- **`/cross-compare-plan` supersedes it.** Two architects from different
  vendors draft independently from one brief, cross-critique, revise under
  critique, and a blind synthesizer merges the result. Both architects read
  the repository, so neither critique is made blind. For a settled framing
  that only needs sizing discipline, `/orchestra-plan` remains the cheap pass.
- **No lane bills a metered API any more.** The `codex` pack now requires the
  Codex CLI alone (authenticated by `codex login` or `OPENAI_API_KEY`);
  `OPENAI_API_KEY` is no longer a hard requirement of any capability, only one
  of two ways to authenticate the CLI.
- **Coverage moved rather than shrank.** The MCP lane suite still pins the
  exact tool roster — now four tools — and the wedged-runner backstop check
  that ran against the deep-plan runner now runs against the cross-compare
  runner. The deleted lane's own case is gone with the lane; both behaviours
  it pinned (a runner's `*_UNAVAILABLE` relayed as a report rather than a
  transport error, and a missing attachment file refused before any spawn)
  are already covered on the cross-compare lane.
## 1.13.0 — cross-compare hardening from the first field run

`/cross-compare-plan`'s first full field test (2026-08-27/28) finished its
seven consultations and produced a merged plan — and then four distinct
failures surfaced around the finished artifact, each one a gap the session's
design had left open rather than a lane misbehaving. Each is closed here
structurally.

- **The blind merge shipped defects a cross-family reader caught in one
  pass — the AUDIT wave makes that reader official.** The field run ended
  with an ad-hoc eighth consultation: the GPT lane critiquing the finished
  `final-plan.md`. It found an internal arithmetic contradiction, a stale
  capability figure, and a dropped done-criterion — all real, all missed by
  the blind synthesis. The root cause is seat arithmetic: with two vendors
  and three seats, the synthesizer always shares a model family with one
  architect, so blind judging removes identity bias but not
  family-correlated blind spots. New argument `audit=<on|off>` (default
  `on`): after FINALIZE the Director dispatches one more consultation — the
  GPT lane in phase `critique`, own plan = its own v2, rival =
  `final-plan.md`, output `audit-of-final.md` — always the GPT lane, because
  the synthesizer is always a Claude model and the audit must come from the
  family the synthesizer is NOT. Findings go to the user; accepted
  mechanical/factual ones are applied by re-dispatching the same synthesizer
  with the rulings (the ESCALATE pattern), design-level ones are the user's
  decisions, and the Director applies nothing itself. The session is now
  **eight** frontier consultations by default, seven with `audit=off`; an
  unavailable audit lane does not un-finish the plan — it is reported
  complete but UNAUDITED, plainly.
- **One critique bought materially less adversarial pressure than the other
  — coverage is now a contract.** The field run's two critiques were 9KB/11
  findings versus 43KB/16 findings; the thinner one had simply skipped
  sections, and nothing in the charter called that a defect. Both lane
  charters (all three `architect-claude*` files and the runner's embedded
  critique charter, kept in lockstep) now require every top-level section of
  the rival plan to be either the subject of at least one finding or listed
  under a closing `## Sections examined and found sound` heading with one
  line saying what was checked — breadth forced without incentivizing
  padding, since "examined and sound" is a legitimate answer. A critique
  missing the coverage contract joins the malformed-document failure rule:
  re-dispatch once with the defect named.
- **The two lanes had unequal research capability — an information-symmetry
  defect in an exercise whose premise is identical inputs.** One lane had
  web search enabled through its engine config while the other's charter
  granted no web tools, so the comparison partly measured tooling. Both
  lanes now carry the capability by construction: the Claude charters gain
  `WebSearch, WebFetch`, and the runner passes `-c tools.web_search=true`
  by default (opt out: `--no-web`, `ORCHESTRA_CROSSPLAN_WEB=0`, or
  `"codex": { "crossplanWeb": false }`, flag > env > config > default). Use
  is charter-gated identically in both lanes — web research only when the
  brief's GROUND TRUTH section grants it; a silent brief grants nothing —
  and the brief must now state the grant explicitly. The provenance header
  prints a `web search:` line so every run records which way it ran.
- **The Director listed `docs=` files by path instead of inlining them —
  and the byte-identical brief quietly became a hope.** The field run's
  docs totaled ~113KB and the Director substituted references, degrading
  the guarantee to "both architects hopefully read the same files". The
  `docs=` rule now says inlining verbatim is mandatory regardless of size;
  listing paths instead of content is a brief defect. Past ~100KB the
  Director warns of the context cost in the INTAKE beat and may OFFER
  `context=` paths as the alternative — but never silently substitutes.

## 1.12.0 — the cross-compare effort ladder reaches `max`

`/cross-compare-plan` shipped with `effort=<high|xhigh>` and rejected every
other value. That rejection guards a real invariant — both lanes must run ONE
identical level, because unequal effort measures budgets rather than judgment
— but it also stopped the ladder a rung below where both vendors actually
stop. Asked for "both architects at max effort", the session had no way to say
yes: it could only run `xhigh` and present it as the ceiling. The invariant was
never the problem; the enumeration was.

Both vendors expose the same top rung. The Anthropic ladder is
`low|medium|high|xhigh|max` — agent frontmatter `effort:` and `claude --effort`
both take all five — and the OpenAI reasoning-effort enum is
`none|minimal|low|medium|high|xhigh|max`. The pack's own `/deep-plan` has
defaulted to `max` since it shipped, so the cap lived in exactly one place:
this skill's argument list.

- **`effort=max` accepted** by `/cross-compare-plan`, routing the Claude lane
  to the new `architect-claude-max` and passing `max` to the GPT lane. The
  equality invariant is untouched: one level, both lanes, any other value
  still an error.
- **New agent `architect-claude-max`** — the `architect-claude-xhigh` charter
  at `effort: max`, and nothing else changed. Depth changes how hard an
  architect thinks, never which rules bind it. `architect-claude-xhigh` no
  longer describes itself as the deepest tier, because it is not.
- **No transport change was needed**, which is why this is a one-line class of
  bug rather than a redesign: `orchestra_crossplan` types `effort` as a
  free-form string and the runner passes it straight through to
  `-c model_reasoning_effort=<v>`, so `max` already flowed end to end. Only
  the skill's own front door refused it.

## 1.11.0 — /cross-compare-plan: two independent architects, one blind merge

`/deep-plan` hardens a plan, but it cannot escape a bad framing: the
counterpart only ever critiques the Director's draft, so the one decision it
can never challenge is the shape of the first draft itself. And the deep-plan
counterpart works blind — no repository access — so its critique measures the
brief as much as the plan. This release adds the divergent complement: a
planning session where the framing itself is put in competition.

- **New skill: `/cross-compare-plan <goal>`** (codex pack). Two architects
  from different vendors — a fresh-context Claude architect
  (`architect-claude`, Fable at high effort; `architect-claude-xhigh` for
  `effort=xhigh`) and an OpenAI architect (GPT-5.6 Sol, read-only through the
  Codex CLI) — receive one byte-identical brief and draft complete plans
  without seeing each other. The drafts are swapped for cross-critique
  (steelman first, findings tagged [BLOCKER]/[MAJOR]/[MINOR], a comparative
  assessment both ways), each owner revises with an ADOPTED/REBUTTED
  disposition per finding, and a blind fresh-context Opus synthesizer
  (`plan-synthesizer`) merges the strongest final plan into the orchestra-plan
  template — adjudicating rebutted findings against the tree, flagging
  assumptions BOTH plans share as *verify during execution* (cross-vendor
  agreement decorrelates blind spots, it does not prove claims), and
  escalating at most four genuine ties to the user. Arguments: `effort=`
  (one level, both lanes — unequal effort would measure budgets, not
  judgment), `model=`, `context=<repo|none|paths>`, `docs=`.
- **Anonymity is enforced end to end, structurally where possible.** Both
  lane charters forbid naming or hinting at any model or vendor (an identity
  mention is defined as a defect); the lane↔letter mapping lives only in the
  Director's conversation, never in a file; the synthesizer judges blind and
  keeps the final plan model-free. Motivation: model-name mentions in
  planning documents demonstrably steer downstream models — the one reader a
  plan is guaranteed to have.
- **New runner: `hooks/orchestra-crossplan.js`** — the GPT lane, one
  consultation phase per invocation (`--phase draft|critique|revise`),
  read-only sandbox hard-pinned (a before/after tree fingerprint proves it —
  any delta is an `⚠ INTEGRITY WARNING`), attachments inlined into the brief
  so both lanes see identical bytes, and the exec lane's report-integrity
  nonce carried over verbatim (a document that cannot echo this run's token
  is refused and NOT saved — the 2026-08-19 stale-replay class, closed here
  before it is ever observed in this lane). Documents are saved by the
  runner to `--out` under `.claude/plans/cross-compare/<slug>/`, so nothing
  load-bearing rides a launcher relay. Header-attribution law throughout:
  a failure is `CROSSPLAN ENGINE: NONE`, never the engine's name.
- **New engine tool: `orchestra_crossplan`** on the `orchestra-engine` MCP
  server (now five tools), same transport contract as the rest: typed
  arguments, pre-spawn validation of attachment paths, runner stdout relayed
  verbatim, `MCP TRANSPORT` prefix on everything said in the server's own
  voice. `architect-codex` is the thin launcher — one call per phase, the
  transport-error-only relaunch exception, relay verbatim.
- **The Director stays out of the arbitration — a deliberate inversion of
  deep-plan.** In deep-plan the Director is the arbiter; here it writes the
  brief, dispatches waves, verifies artifacts exist, and never judges
  content, because a Director that reads both plans and knows the mapping
  would un-blind the merge with its own thumb on the scale. Escalated OPEN
  DECISIONS go user → Director → synthesizer as rulings, not opinions.
- **`tests/mcp-lane.test.js` grows a ninth case** (46 checks total): the
  draft phase end to end against the stub engine (document saved, integrity
  line stripped, read-only sandbox and effort override proven from the
  engine's own report), wrong-attachment orders degrading in the runner's
  grammar rather than the server's, missing files refused pre-spawn, and a
  token-less report refused and not saved.

## 1.10.0 — the launcher shell transport is retired: one typed MCP call replaces it


A forensics pass over this changelog and all seventeen codex-lane commits
(2026-08-26, written up in the Pi-Orchestra evaluation) classified every
recorded failure by layer: **~53% were the launcher shell transport** —
heredoc-to-scratch, run tokens, stale sentinels, background-and-poll, stdout
scraping, `mktemp` path drift, foreground launches dying at the tool's 120 s
default — against ~35% install/environment and ~12% the engine itself. Three
releases in a row (1.4.1, 1.9.0, and the unreleased `9ff2a53`) fixed fresh
instances of the same transport class, each time with more launcher prose;
`reviewer-codex.md` was 341 lines, ~61% of them launch-and-relay discipline,
enforced by asking a Haiku launcher to please follow it. Prose fails — that
was diagnosed in 1.3.0, and the remedy each round was more prose.

This release makes the class structurally unreachable instead. A caller that
passes a timeout as a typed argument cannot fail to pass it; a caller holding
a live call cannot poll a stale file; a caller that is code cannot invent a
cause. (Validated before building: Claude Code holds a blocking MCP tool call
for the full 1800 s review default, top-level and subagent-nested, measured.)

- **New: `orchestra-engine`, a zero-dependency stdio MCP server in the codex
  pack** (`hooks/orchestra-engine-mcp.js`), exposing the runners as four typed
  tools — `orchestra_review`, `orchestra_exec`, `orchestra_deepplan`,
  `orchestra_doctor`. Each call spawns the corresponding runner with real
  flags, relays its stdout **verbatim** as the result, and never rewrites or
  reinterprets a report. Everything the server says in its own voice is
  prefixed `MCP TRANSPORT` and flagged as an error, so a transport failure can
  never be read as engine output — the header-attribution law
  (`ENGINE: NONE`, never the engine's name, on a failure) extends down a
  layer. A runner that exits non-zero, writes nothing, or wedges past a
  generous kill-backstop is reported as the anomaly it is, with the captured
  output attached and labelled `NOT a runner report`. Emits MCP progress
  notifications when the client sends a `progressToken`.
- **The four launcher profiles collapse to thin tool-callers.** One blocking
  tool call, relay the result verbatim, one-call-per-order law intact
  (review's retries stay inside the runner; exec stays never-retried, with
  the transport-error-only relaunch exception spelled out). Their `tools:`
  frontmatter now grants **only the lane's MCP tool** — no Bash at all — so
  shelling out is not discouraged but impossible. `reviewer-codex.md` drops
  from 341 lines to ~80, and every retired line was launch discipline whose
  failure mode the transport no longer has.
- **`pack.json` can declare `mcpServers`, and the installer registers them.**
  The codex pack declares `orchestra-engine`; `node install.js <project>
  --packs codex` merges it into the project's root `.mcp.json` (other
  entries preserved, ours overwritten by name so a stale registration cannot
  linger), removes it when the pack is deselected, and `--uninstall` removes
  it too — deleting the file only when it held nothing but ours.
- **New suite: `tests/mcp-lane.test.js`** (34 checks, in CI on all three
  platforms) — speaks real JSON-RPC to the server over stdio and drives the
  real runners against the stub engine underneath: verbatim relay (live and
  pinned review, exec with tree audit + nonce round-trip, deep-plan's
  `DEEPPLAN_UNAVAILABLE` relayed as a report rather than a transport error,
  doctor's exit code surfaced as data), every transport anomaly speaking as
  `MCP TRANSPORT`, and progress notifications following the client's token —
  and only the client's token.
- **`tests/exec-lane.test.js` case 17 inverts.** It used to pin the shell
  transport's discipline (token-keyed sentinels, `rm -f` before launch); it
  now pins the transport's *absence* — no sentinel, no `$OUT`, no
  backgrounding may reappear in a profile — plus the structural tool grant.
- The `codex exec` engine underneath is unchanged, and so is every report
  grammar the Director reads. Install/environment failures (the six-day
  helper-sibling outage's class) are also unchanged — that bucket lives below
  the transport and keeps its existing mitigations (`--doctor`, helper
  restore, layout detection); what the typed contract changes is their
  *signature*: an empty result is now a loud first-call transport error, not
  six days of healthy-looking silence.

## 1.9.1 — hooks stop crashing under a "type": "module" target

All hook scripts — the core `orchestra-guard.js` and the codex pack's
`orchestra-review.js` / `orchestra-exec.js` / `orchestra-deepplan.js` — are
CommonJS (`require(...)`), and the installer copies them verbatim into a
target's `.claude/hooks/`. A target whose own root `package.json` declares
`"type": "module"` makes Node treat every `.js` file it loads by path as ESM
by default — including these — so `require` is undefined at module scope and
every one of them dies immediately: `ReferenceError: require is not defined
in ES module scope` (hit for real at `orchestra-review.js:208`). That kills
the pack self-check, `--doctor`, and every agent invocation of every hook —
a latent bomb in any project that adopts ESM at the root, silent until the
first hook actually runs.

- **The installer now stamps `.claude/hooks/package.json` with
  `{"type":"commonjs"}`** on every install, right after the core guard is
  copied — before any pack hooks land, since it applies to all of them
  alike. Node resolves a script's module type from the package.json nearest
  the *script*, so this one scoping file pins `.claude/hooks/` to CommonJS
  regardless of what the target's root declares. No hook renames, no
  reference updates. Idempotent: a re-run over unchanged content is silent;
  content that drifted (edited or replaced out of band) is restamped with a
  single one-line notice. `--uninstall` removes it along with the other hook
  files. The comparison is CRLF-tolerant — a byte-identical stamp checked out
  under `core.autocrlf=true` still parses to the same JSON and is left alone
  rather than "repaired" on every future run — and the stamped
  `.claude/.gitattributes` now pins `*.json text eol=lf` too, alongside
  `*.md`/`*.js`, so a fresh checkout doesn't need that tolerance in the first
  place. (Widened from `package.json` to `*.json` so `.claude/settings.json`
  and `.claude/orchestra-install.json` get the same protection.)
- **`--uninstall`'s `.claude/.gitattributes` removal is now a shape match, not
  a byte-exact compare against the current `GITATTRIBUTES_CONTENT`.** The
  `*.json` widening above is exactly the kind of edit that constant will keep
  taking, and a byte-exact compare would stop recognizing every
  `.gitattributes` a prior version had stamped — silently leaving it behind on
  every future `--uninstall`, forever, for every project already using the
  harness. `isOurGitattributes()` instead requires the installer's header
  comment line and that every other non-empty, non-comment line is a plain
  `<pattern> text eol=lf` rule, so it recognizes the file whichever version of
  the harness wrote it. A genuinely user-edited file still fails that shape
  and is left alone, exactly as before.
- New coverage in `tests/frontmatter-lint.test.js`: an install into a target
  whose `package.json` declares `"type": "module"`, asserting the scoping
  file is written, the installed `orchestra-guard.js` and
  `orchestra-review.js --doctor` no longer crash at module scope, the drift
  and creation notices never double up, and a CRLF-mangled stamp is left
  untouched — plus `--uninstall` removing a simulated pre-1.9.1, two-pattern
  `.gitattributes` (the shape-match regression this exists to prevent) while
  still leaving a user-edited one in place.

## 1.9.0 — two silent lies, made loud: unloadable frontmatter and replayed exec reports

Two field incidents from one downstream project (2026-08-19), both of the
worst species — failures that look exactly like success.

### A YAML-unsafe description silently unloads an agent (frontmatter lint)

Three codex-pack agents shipped with descriptions containing the sentence
"This agent is a thin launcher: it runs …". A bare `": "` inside an unquoted
YAML scalar makes the **whole frontmatter unparseable**, and Claude Code drops
such a file **silently** — no log, no telemetry: the parse failure yields an
empty frontmatter object, and the missing-name path returns null before any
logging runs. Claude Code does have a repair pass that would have quoted the
value, but its line regex cannot match lines with a trailing CR, so CRLF
worktrees (Windows autocrlf, no `.gitattributes`) defeat it — the same file
loads on LF platforms and vanishes on CRLF ones, which is how it shipped
unnoticed. Downstream, the three agents never registered in any session;
`planner-gpt` (the one codex agent without the sentence) loaded fine, which
misdirected diagnosis toward session and roster theories for days. 4ed7a03
reworded the three descriptions; this release makes the class unshippable:

- **The installer lints every `.md` it is about to stamp** — core agents,
  specialists, skills, pack agents and skills — with a strict parser for the
  YAML block-mapping subset frontmatter uses, **before copying anything**. A
  parse failure refuses the install with the file, the line, and the fix; a
  value that parses but loses text (`" #"` truncation) or leans on the
  repair pass warns loudly. Required files (agents, specialists, SKILL.md)
  must also carry a non-empty `name:` — the other silent-drop path.
- **`node install.js --lint [dir]`** runs the identical check standalone
  (strict: warnings fail it), and CI runs it over the whole repository on all
  three platforms, so a YAML-unsafe value can never merge again. There is a
  dedicated suite, `tests/frontmatter-lint.test.js` (23 checks).
- **Line endings are settled both ways, deliberately.** The installer now
  normalizes every installed `.md` to LF (the master's own `.gitattributes`
  already pins `*.md` to LF), AND stamps a scoped `.claude/.gitattributes`
  (`*.md`/`*.js text eol=lf`) into the target when none exists — because a
  project that commits `.claude/` and re-checks out under `autocrlf=true`
  would otherwise convert the files right back. An existing `.gitattributes`
  is never edited (a note suggests the line); `--uninstall` removes the
  stamped file only when it is byte-for-byte the installer's.

### The exec lane could relay a stale run's report — and its "audit" — as fresh

Two consecutive downstream `executor-codex` runs misreported reality: one
relayed "the scoped changes were already present; no additional edits were
necessary" over work the engine had in fact just authored, and the other
returned `STATUS: DONE` with a report, verification counts, and TREE AUDIT
describing a **weeks-old, already-merged order** while the actual tree was
verified untouched. The audit — the mechanism that exists to make reports
checkable — was stale along with the report, which pointed at the one place
both travel together: **the launcher protocol's output file.** The launcher
agents derived FIXED paths in `os.tmpdir()` (`orchestra-exec-out.txt`,
`…-heavy-out.txt`) and polled for a bare `ORCHESTRA_RUNNER_DONE` sentinel
carrying no run identity. Any launch that died before its `rm -f` (a mangled
heredoc, a failed background spawn, a permission denial) left the PREVIOUS
run's complete output — header, report, audit, `rc=0` sentinel — sitting at
exactly the path the poll then read and relayed wholesale; tmp files persist
for weeks on Windows, hence the weeks-old replay. The
"already present" shape is the same key colliding the other way: a second
launch (the launcher's retry-once rule, or a harness timeout promotion)
clobbering the first run's in-flight output file, then truthfully describing
the tree the first run had already edited. Fixed at every layer:

- **Per-run tokens end the collision.** All four launcher protocols
  (`executor-codex`, `executor-codex-heavy`, `reviewer-codex`, `planner-gpt`)
  now derive their tmp paths from a launcher-invented run token and write /
  poll a token-keyed sentinel (`ORCHESTRA_RUNNER_DONE <token> rc=…`). A stale
  file can no longer satisfy a poll, and a retry (now required to use a fresh
  token, after re-polling the first) can no longer clobber a live run. The
  retry rule itself now says: a sentinel with your token means the runner DID
  run — relay it, never relaunch.
- **The runner proves freshness with a nonce.** `orchestra-exec.js` generates
  a per-run token, prints it in the header (`RUN NONCE:`), injects it into
  the brief, and requires the engine to echo it on a final
  `REPORT INTEGRITY:` line (the brief never contains the composed line, so an
  engine echoing its prompt cannot false-pass). A report without the echo —
  the stale-session signature — is `STATUS: EXEC_UNAVAILABLE`, with the
  discarded text shown but labelled `UNVERIFIED ENGINE OUTPUT`, never DONE.
- **The audit is replay-proof by provenance.** It was always computed
  in-process from the runner's own before/after fingerprints; it now says so,
  stamped with the run nonce — and a report whose CHANGES claims edits
  against a tree the runner measured as byte-for-byte untouched (no source
  paths, no generated churn, HEAD unmoved) is an integrity failure too
  (skipped for read-only dry runs, where no claim could land by design).
- **Fresh sessions are enforced, not assumed.** Resume-prone
  `ORCHESTRA_EXEC_ARGS` tokens (`resume`, `--last`, `--continue`) are refused
  before anything launches.
- **The doctor knows the hazard.** `orchestra-review.js --doctor` now flags
  session-resuming tokens in `ORCHESTRA_EXEC_ARGS` / `ORCHESTRA_REVIEW_ARGS`,
  resume-prone lines in the Codex `config.toml`, and counts session
  artifacts under `CODEX_HOME` (informational — history is harmless until a
  resume-prone config appears). `--doctor --live` additionally runs a real
  no-op order through the sibling exec runner in a scratch directory
  (read-only sandbox) and verifies the nonce round-trip, at the cost of one
  model call.

Tested in `tests/exec-lane.test.js` (79 checks: nonce echo and refusal paths,
fresh-session enforcement, claim/audit contradiction, and a docs contract
pinning the token-keyed launcher protocol) and `tests/review-lane.test.js`
(doctor hazard detection and the `--live` round-trip, against the stub
engine). The doctor tests now pin `CODEX_HOME` to an empty fixture so a
developer's real `~/.codex` cannot flip a check.

## 1.8.0 — Codex CLI as Director: the harness's mirror image (retroactive entry)

*Recorded after the fact (during 1.9.0), from commit `1f6b1f3` — the release
shipped without a changelog entry.*

Until now the Codex CLI could only be a hired hand: the codex *pack* gives a
Claude-directed session OpenAI reviewers, executors, and a planning
counterpart, but a project that wanted Codex itself in the Director's chair
had nothing to install. The wiring existed only as a hand-built `.codex/`
directory proven out in one project (PiratePartyPals), which is exactly the
state the installer exists to abolish — a working setup nobody else can
reproduce.

`install-codex.js` makes it a master-repo capability: it stamps `.codex/` +
`AGENTS.md` the same way `install.js` stamps `.claude/` + `CLAUDE.md`, from a
new `codex/` tree (protocol, TOML agent roster — scout, detective, executor,
reviewer — `config.toml`, `hooks.json`, and a ported `orchestra-guard.js`).
One deliberate asymmetry: the protocol is **embedded whole** into `AGENTS.md`
rather than imported, because Codex does not expand `@imports`. The mirror
runs both ways — `codex/packs/claude/` (reviewer-claude, planner-claude)
gives a Codex-directed project cross-vendor Claude judgment, exactly as
`packs/codex/` does in the other direction — and the two installers are fully
independent: a project can run either, both, or neither. PowerShell and POSIX
wrappers included.

Verified by scratch-dir round trip against the hand-built original: a fresh
install matches the field `.codex/` byte-for-byte on every functional file,
re-installs are idempotent (no duplicate `hooks.json`/`AGENTS.md` entries),
`--no-packs` cleanly deselects, and `--uninstall` removes only
Orchestra-owned entries while preserving foreign `hooks.json` events and
surrounding `AGENTS.md` content.

## 1.7.0 — finding the installs that are behind

Updating one project was already easy: `node install.js <project>`, no flags,
idempotent, and it re-reads `orchestra-install.json` so the project's own pack
and specialist selection survives. What was missing was knowing *which*
projects needed it. Nothing recorded where the installs were, so the documented
upgrade path was: run `head -3 .claude/ORCHESTRA.md` in each project you
remember harnessing, compare it against the master's `VERSION` by eye, and
re-run the installer. A manual diff across a set nobody was tracking.

That gap has teeth. v1.5.0 fixed a Codex helper that had left the review lane
silently dead for six days — reviews that launched, ran, and returned nothing
under a preflight reporting a healthy install. A project still on v1.4.1
carries that bug and has no way to find out except by hitting it, and the
harness had no answer to "which of my projects are affected?"

`node install.js --scan <dir>` answers it, and `--update` acts on the answer.
A project counts as an install when it has `.claude/ORCHESTRA.md` — what the
installer writes and `--uninstall` removes — with the version read from
`orchestra-install.json`, falling back to the `ORCHESTRA.md` header stamp so
pre-packs installs are classified rather than skipped. Exit `1` when something
is behind makes it usable as a check rather than only as a report.

The restraint is the design:

- **An update spawns a plain per-project re-run**, the identical code path a
  person runs by hand. This mode adds discovery, not a second way to install —
  so each project keeps its own recorded selection, gets its own pack
  self-check, and a failure in one cannot corrupt the next.
- **`--scan` refuses `--packs`/`--specialists`.** A scan spans projects that
  made different choices; one selection applied across all of them would
  silently rewrite those choices — adding an OpenAI surface to projects that
  never asked for one, or dropping a specialist another depends on.
- **`--scan` refuses `--uninstall`.** Mass removal is not a convenience worth
  building; one project at a time is the honest interface.
- **An install ahead of the master is reported and skipped.** Downgrading a
  project stamped by a newer master would be data loss wearing an update's
  name.
- **A pre-versioning install is warned about before it is updated.** With no
  recorded selection, a plain re-run cannot restore packs it was never told
  about, so the scan says so — with the command to re-add them — instead of
  quietly shipping a downgraded harness.

The walk skips `node_modules`, VCS directories, build outputs and caches, never
follows symlinked directories (a Dirent reports a symlink as a symlink, so the
walk cannot loop), stops at a directory that is itself an install, and bounds
depth at 6 by default (`--depth <n>`). A malformed `orchestra-install.json`
degrades that one row to its header stamp rather than taking the scan down.

Tested in `tests/scan-lane.test.js` (41 checks, in CI on all three platforms)
against installs the installer itself produced and then aged — nothing is
stubbed, because the property under test is whether the scan reads what the
installer actually writes. `install.ps1` gained `-Scan`/`-Update`/`-Depth`;
`install.sh` already forwarded its arguments verbatim.

## 1.6.0 — cross-vendor execution: OpenAI executors (Sol / Terra) in the codex pack

Until now the codex pack's OpenAI surface covered judgment (review, deep-plan)
but never hands: every edit ran on a Claude executor, and a project that wanted
to offload workhorse implementation to OpenAI models had no route that kept the
harness's guarantees — no idle precheck, no standard report the Director can
parse, no automatic review pairing. The informal alternative (run Codex by hand,
then `/orchestra-review` the diff) works, but makes the user the transport and
takes the Director out of the loop it exists to run.

So the pack now carries an **execution lane**, mirroring the review lane's
shape exactly: two thin Haiku launchers — `executor-codex` (default tier,
GPT-5.6 **Terra**, OpenAI's everyday workhorse) and `executor-codex-heavy`
(hard tier, GPT-5.6 **Sol**, the flagship, at high reasoning effort) — driving
a new runner, `hooks/orchestra-exec.js`, that enforces the Orchestra executor
law in its brief, runs `codex exec` in a `workspace-write` sandbox in the live
tree, and relays the engine's report in the executor format the loop already
parses. Routing is opt-in and mirrors `reviewEngine`: `"executorEngine":
"codex"` in `.claude/orchestra.json`, or an in-conversation request; the
Claude executors stay the default, the fallback, and the escalation rung.

Three deliberate asymmetries with the review lane, each a property of
execution rather than an omission:

- **No auto-retry.** A review is idempotent — reading the same commit twice is
  the same review — so its runner retries a flaky engine. Execution is not: a
  half-dead engine may have half-edited the tree, and a blind second attempt
  starts from a state the work order never described. One attempt; on failure,
  `STATUS: EXEC_UNAVAILABLE` with the review lane's full attribution (who
  killed the engine, elapsed against the cap, last words) and the Director
  decides what a re-dispatch starts from.
- **A tree audit instead of an integrity warning.** The reviewer is read-only
  in intent, so any mutation is an alarm. The executor exists to mutate — the
  question is *what*. The runner fingerprints the tree before and after and
  appends a `TREE AUDIT`: every changed source path listed, generated
  build/engine churn counted separately (same allowlist as the integrity
  check), a moved HEAD called out. The report's CHANGES section becomes a
  checkable claim — on the failure path too, where the audit is precisely the
  debris inventory the Director needs.
- **Git isolation that carries identity.** The review lane's scratch git
  config silences the sandboxed `unable to access .../git/ignore` noise, but
  dropping the global config also drops `user.name`/`user.email` — and an
  executor whose order says "checkpoint-commit each part" would fail every
  commit with "Please tell me who you are". The exec runner copies the user's
  identity into the scratch config.

Review pairing inverts for codex-authored changes, and the protocol says so
(§2): the Opus `reviewer` is already cross-vendor relative to an OpenAI author,
so such changes take the default reviewer — the add-a-`reviewer-codex`-pass
convention on heavy orders exists precisely because author and reviewer would
otherwise share a vendor, which no longer holds there.

Tested like the review lane: `tests/exec-lane.test.js` (53 checks against the
same stub Codex, extended to report sandbox, config overrides, git identity,
and brief markers, and to model an engine that mutates the tree and then dies),
in CI on all three platforms.

**Carried over from 1.5.0's fix, because both lanes drive one Codex install.**
The helper that cost the review lane six days — `codex-windows-sandbox-setup.exe`,
resolved by NAME, so a copy one directory too deep is no copy at all — fails the
execution lane the same silent way: the sandbox is never established and the
engine runs, exits, and changes nothing. The exec runner therefore prepends the
resolved install directory to the engine's `PATH` exactly as the review runner
does (asserted in the suite, including that an already-leading directory is not
prepended twice), and its failure paths name
`node .claude/hooks/orchestra-review.js --doctor` — the one install check, shared
by both lanes — where an engine that produced nothing is the symptom. The doctor
itself stays in the review runner rather than being duplicated: two copies of an
install check are two things to drift.
## 1.5.0 — a helper file that is present, but one directory too deep

The cross-vendor review lane was dead from 2026-08-12 to 08-18 and said nothing.
Every runner-mediated review launched, ran, and returned no verdict; the
preflight reported the install as healthy each time. The cause was one file: an
earlier repair session had put `codex-windows-sandbox-setup.exe` **inside**
`codex-resources\` instead of directly beside `codex.exe`. Codex resolves that
helper by name, so a copy one directory down is not a copy at all — the sandbox
was never established, and the reviews no-opped. One file copy fixed it.

Three separate things had to be true for six days of silence:

1. The helper-sibling list did not name the file. It checked
   `codex-command-runner.exe` and `codex-resources`, found both, and said so.
2. The presence check asked `existsSync(installDir + name)` — the right
   question, asked only of names nobody had thought to add.
3. Nothing looked *inside* the install. A misplaced copy is the easiest repair
   there is (it is the right version, already on the machine), and it was the
   one place the search never went.

So: `codex-windows-sandbox-setup.exe` joins the Windows default sibling list;
the search for a known-good copy now covers the install's own subdirectories
first and reports a find there as `was MISPLACED inside the install at <dir>`
rather than as a restore; a *directory* named `something.exe` no longer counts
as the executable; the install directory is prepended to the engine's `PATH`,
because not every Codex helper resolves relative to the binary; and where an
absence has a specific known consequence, the report states it instead of
listing one more filename.

**`--doctor`.** All of that was already reachable only by running a whole
review. `node .claude/hooks/orchestra-review.js --doctor` runs the same
inspection alone — no work order, no engine launch — repairs what it can, prints
the exact copy command for what it cannot, and exits non-zero when a review
would not find a complete install. It shares one code path with the review
preflight on purpose: a doctor that checks something other than what the review
checks is a second opinion about the wrong install.

**Carried in with the install.** A pack may now declare a `selfCheck` in its
`pack.json`, which the installer runs and prints at the end of an install. The
`codex` pack declares `--doctor`, so a broken Codex install is reported at the
moment the person is already reading the output, next to the instructions for
fixing it — rather than days later, as a review that returns nothing.

Tests: 96 → 108 checks. The new case reproduces the failure first (a sibling
list that omits the sandbox helper calls the broken install healthy) before
proving the fix, per the suite's rule that a checker which cannot fail is
decoration.

## 1.4.1 — a subagent may not end its turn on a running process

Two rounds stalled the same way on 2026-08-16: an agent launched a run in the
background, then ended its turn saying it would report back when the run
finished. Nothing reported back. Subagents have no notification-based revival —
no timer, no background-task completion, no message restarts one — so a stopped
subagent stays stopped until a human notices the round never returned. Both
runs completed fine; their results reached nobody.

The defect is narrower than "backgrounding". Backgrounding plus polling in-turn
is correct, and above the shell tool's 600000 ms maximum it is the only method
that works for the review and deep-plan runners. Backgrounding plus *ending the
turn* is the trap — and a completion-notification affordance is what makes
ending the turn feel safe.

So the rule is drawn at the turn boundary, in every profile that runs commands
(`executor`, `executor-heavy`, `executor-heavy-xhigh`, `reviewer`, the
specialist template and `modeler`, and both cross-vendor launchers): never end
your turn while a process you started is still running — poll it in-turn until
it resolves, or kill it and report what ran. It is written to cover the case no
hook can catch, because the agent never chose it: a foreground command the
harness promotes to a background task on timeout is also a running process you
started.

The protocol (§2) states the underlying fact for the Director, which sees this
failure first and can act on it immediately: a report that promises a later
report is a finished round — re-dispatch the order rather than wait on it.

## 1.4.0 — cross-vendor review lane: attribution, retry, and honest signals

Prompted by a live gate on 2026-08-12 (Windows 11, codex-cli ≥ 0.147.0, harness
v1.3.0). The v1.3.0 fixes held — the pinned worktree materialized, the briefs
survived, the lane produced a high-quality verdict — but it took two attempts,
and everything the round exposed was about what the runner *said* rather than
what it did.

### A failure now names its own cause

Attempt 1 ended as `codex exec` exit **143** with no verdict, under a DETAIL
block listing generic causes (auth / flags / sandbox / missing install files),
none of which had ended the process. The one thing the runner could have known
for certain — whether its OWN timeout timer sent the kill — it never said.

On any exit without a verdict, the report now states who killed it (the runner's
own timer, an external signal, or codex choosing to exit — node reports its own
timeout, so this is never a guess), how long the child ran against the cap it
was given, and the tail of codex's stderr, stdout, and any session log written
during that attempt. The generic cause list survives in exactly one place: a
self-chosen non-zero exit, where it is a live hypothesis rather than a shrug.

### Retry is the runner's job, and the chain is one outcome

Attempt 2 succeeded — but as an *emergent launcher behavior*, so the Director
received two task reports for one review: a final-sounding `REVIEW_UNAVAILABLE`,
the books correctly closed on the lane per §5, and then a real verdict for the
same change.

The runner now retries internally: one extra attempt (`reviewRetries`, max 3) in
a fresh scratch directory and a fresh checkout, for failures that could
plausibly differ — a signal kill, a launch that produced nothing. A
runner-enforced timeout is deliberately *not* retried. The whole chain prints as
ONE report (`ATTEMPT CHAIN: 2 attempts, ONE outcome`), the failed attempt's
diagnostics are preserved under `ATTEMPT LOG` even when a later attempt
succeeded, and `REVIEW_UNAVAILABLE` is emitted only once the chain is exhausted
— carrying an explicit `FINALITY:` line. Launcher profiles now forbid
relaunching the runner at all, with one narrow exception for a Bash call that
never started it.

### Preflight: probe, layout, helper siblings

- **Stage-a auth/exec probe** (`authProbe`, on by default): a cheap `codex exec`
  echo under a short cap, before the real attempt. An unauthenticated install or
  an unusable model now costs seconds instead of a 30-minute budget, and the
  report says the review was never attempted. A probe that merely times out is a
  warning, not a refusal. This check previously lived in Director briefs and
  memory checklists — a checklist item every caller must remember is a runner
  feature that has not been written yet.
- **Install-layout detection.** Codex relocated itself from
  `~/.codex/packages/standalone/current/bin` to
  `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>`, which silently invalidated the
  documented repair recipe. Both layouts are detected and named in the
  preflight, so the next relocation is visible in the first report that hits it.
- **Helper-sibling verification.** The files that must sit next to the resolved
  binary are checked every run and repaired from any locatable known-good copy
  (`helpersDir`, a sibling version directory the self-update left behind, or the
  other known layout). When repair is impossible the report names the exact
  missing files and every directory searched. It stays a loud warning rather
  than a hard stop by default: whether the new layout needs those files at all
  is unverified upstream. `requireHelperSiblings: true` makes it fatal.

### The integrity warning means something again

The successful verdict carried `⚠ INTEGRITY WARNING` because Godot's first
import inside the fresh worktree rewrote 180+ `*.import` sidecars — engine
churn, indistinguishable from reviewer mutation to a whole-fingerprint
comparison, and guaranteed to fire on every Godot project's first run. A warning
that cries wolf teaches its reader to skip it.

The delta is now compared per path and split: generated build/engine artifacts
(built-in list, extended by `integrityIgnore`, dropped by
`integrityIgnoreDefaults: false`) become a counted `INTEGRITY NOTE`; anything
else is the `⚠ INTEGRITY WARNING`, listing the offending paths instead of
dumping two whole fingerprints. `worktreeWarmupCmd` fixes the class outright by
taking the baseline *after* an engine's first-open import — in the pinned
throwaway checkout only, because a warmup writes and a live-tree review must
not write into the tree it is reviewing.

### A configured scratch root is honoured or refused, never swapped

`makeScratchDir` used to fall back to the OS temp dir whenever the configured
root was unwritable — quietly undoing the setting, and resurrecting the
cross-run brief collisions that `worktreeRoot` exists to prevent. A root the
user set (flag, env, or `orchestra.json`) is now mandatory: unwritable means the
review fails, with the `mkdir` error attached. Only the built-in default may
walk the candidate list, and it says so loudly when it does.

### The test suite can no longer pass by not running

`tests/review-lane.test.js` exited 0 on Windows even with failing cases: its
verdict was printed from a callback deep inside an async chain, so a throw, a
rejection, or a step that never fired let node drain its event loop and exit 0.
The suite is now one linear `await` chain, a failure sets `process.exitCode`
immediately, an `exit` handler enforces it, and a run that recorded no cases at
all fails on that basis. 96 checks, including new coverage for every item above:
attribution wording for signal-class vs runner-enforced kills, the retry chain
(fail-then-succeed, and both-fail), the probe, layout detection and helper
repair from a sibling version, integrity classification, warmup ordering and its
refusal to run in a live tree, and the mandatory scratch root.

### CI

`.github/workflows/test.yml` runs the suite on Linux, Windows, and macOS across
Node 20/22/24, for every push and pull request. Windows is the reason it exists:
every field failure in this lane has happened there, the exit-code bug above hid
there, and no session working on this repo has a Windows machine. There is no
CD: the harness ships by `git pull` + `node install.js`.

**It found four runner defects in its first hour**, none of which any amount of
Linux testing would have surfaced:

1. **Windows could not launch the documented install at all.** Node has refused
   to spawn `.cmd`/`.bat` directly since the BatBadBut fix (CVE-2024-27980) —
   and on Windows a `codex` installed through npm IS a `.cmd` shim, which is
   exactly what this runner's own PATH resolution finds first (`whichSync`
   searches `PATHEXT`, and `PATHEXT` lists `.CMD`). Engine launches now route
   those through `cmd.exe` with each argument quoted individually — not
   `shell: true`, which does not quote and would split the first path
   containing a space.
2. **"Scratch must be outside the repository" did not hold wherever the repo
   path contains a symlink or a short name.** git reports resolved paths; the
   runner built its own from unresolved ones. macOS reports `/private/var/…`
   against a held `/var/…`; Windows reports the 8.3 `C:\Users\RUNNER~1\…`
   against a realpath'd `C:\Users\runneradmin\…`. A directory plainly inside
   the repository compared as outside, and the review would have materialized
   its worktree into the tree under review — the exact condition pinned mode
   exists to remove. The check now runs `rev-parse --show-toplevel` from BOTH
   locations and compares git's two answers, which are in the same form by
   construction.
3. **The refusal wrote first and objected afterwards.** A configured scratch
   root inside the repo was created, THEN refused, leaving the directory behind
   as precisely the session dirt it was objecting to. Configured roots are now
   validated before anything is created in them.
4. **The orphan sweep under-reported its own work.** It counted only successful
   directory deletions — but a killed runner's engine child outlives it with
   the worktree as its working directory, which on Windows locks that directory
   against deletion. The sweep cleaned up and reported `reclaimed 0`. It now
   counts what it found and acted on, and names separately anything the
   filesystem would not release.

Two platform truths the matrix also forced into the open, now asserted rather
than assumed: Windows cannot `CreateProcess` a `.js` file (so the tests hand the
runner a `.cmd` shim for the stub engine), and `kill('SIGTERM')` there is
`TerminateProcess`, which runs no handler — so on Windows the next run's sweep
is the *only* thing that ever reclaims an orphaned worktree, and the runner's
signal handlers are decorative. One test's negative control (git complaining
about an unreadable global config path with isolation off) does not reproduce
under Git for Windows; rather than fail the runner for its platform's
diagnostics, or let a silent pass imply a proof that did not happen, it reports
itself INCONCLUSIVE by name there and still proves itself on Linux and macOS.

`ORCHESTRA_CODEX_HELPER_SIBLINGS` was added alongside, for config symmetry —
every other `codex` setting already had an environment form, and a machine whose
Codex install legitimately differs should not need an edit to a project's
committed config.

### Scope

Codex-internal faults are not patched here — see "What this harness cannot fix"
in `packs/codex/README.md`, which pairs each upstream behaviour with the
harness's mitigation and says plainly what remains unverified.
`packs/codex/FIELD-VALIDATION.md` is the checklist the next gate-class review
runs to confirm this round landed.

## 1.3.0 — cross-vendor review lane hardening

Prompted by a live gate on 2026-08-11: a 2-file, 9-line docs diff, reviewed at
`--tier inert --no-tests --timeout-ms 300000` against codex-cli 0.146.0 on
Windows. Two attempts, no verdict. Everything below is one of the two root
causes or a consequence of them.

### The review runs in a clean checkout of the pinned commit

`packs/codex/hooks/orchestra-review.js` gains `--base-ref`, `--head-ref`, and
`--worktree-root`. With `--head-ref`, the runner materializes that commit as a
detached git worktree under a scratch root **outside the repository** and
points the engine there.

The failing attempt had the engine exploring the author's live tree: ~30
untracked `.claude/plans/` files and 10 modified tracked files sitting on top
of the commit it was told to review. Every lookup of a session-created file
returned `fatal: path '.claude/plans/toon-conversion-campaign.md' exists on
disk, but not in '97a5c05'`. That is not a discrepancy an agent can resolve or
dismiss — the commit and the filesystem are simply making incompatible claims —
and it spent the whole budget on it. A clean checkout removes the contradiction
instead of asking the model to tolerate it.

- The scratch root is never the repo: an earlier attempt at this fix (2026-08-08)
  died on `mkdir: Permission denied` in the repo cwd under the reviewer's
  sandbox, and a worktree inside the tree under review is itself session dirt.
  Default is the OS temp dir; `worktreeRoot` / `--worktree-root` overrides, and
  an unwritable root falls back rather than failing the review.
- Teardown is guaranteed on the normal, thrown, and signalled paths, and each
  run sweeps worktrees orphaned by a `SIGKILL` that ran no handler — identified
  by an owner-pid stamp, so a concurrent review's worktree is never touched.
- The idle precheck is skipped when pinned: a checked-out commit cannot move.
- An unresolvable `--head-ref` is `REVIEW_UNAVAILABLE`, never a silent fallback
  to the live tree.
- The verdict header records which tree produced it (`checkout: pinned worktree
  @ <sha>` / `checkout: live working tree`).

Uncommitted work still reviews live — there, the working tree *is* the artifact.

### Inert reviews carry a 600000 ms floor

"It's only docs, it'll take seconds" is a reasonable-sounding belief that is
false about this engine: it explores before it concludes, and that pass does
not shrink with the diff. The tier narrows what must be *verified*, not how long
looking takes. A cap below the floor is raised when it came from a launcher flag
or the built-in default, and the header says so; a cap set in `orchestra.json`
or the environment is the user's call and is honoured as written, with a warning.

### Git config isolation

The failing run also emitted `warning: unable to access
'C:\Users\maxtl/.config/git/ignore': Permission denied` on every git command —
the sandboxed user cannot read the host's global git config path. Noise, but an
agentic reviewer treats noise as a lead. Every git the review touches, the
runner's own and the engine's, now runs against a scratch global config
(`GIT_CONFIG_GLOBAL` + `GIT_CONFIG_NOSYSTEM`, with `core.excludesFile` and
`core.attributesFile` named explicitly, since leaving them unset is what makes
git probe `$HOME/.config/git/ignore` in the first place). Off via
`gitConfigIsolation: false`.

### A failed review no longer wears the engine's name

Both runners printed the same header on the success and failure paths, so a
`REVIEW_UNAVAILABLE` block arrived under `REVIEW ENGINE: OpenAI via Codex CLI
(…)`. Launchers relaying it read the header as provenance and reported fallback
verdicts as cross-vendor ones. Failure paths now read `REVIEW ENGINE: NONE` /
`DEEP-PLAN ENGINE: NONE`, with the settings preserved under `ATTEMPTED:` as
diagnostics rather than a byline.

### Launcher profiles carry mechanical launch tables

Attempt 1 never reached the engine at all: the profile said "background launch"
in prose, the Haiku launcher ran the runner in the foreground, and the shell
tool's 120-second default timeout killed it — with a 300-second runner cap that
never got a chance to apply. Prose fails. `reviewer-codex.md` and
`planner-gpt.md` now carry:

- a launch table keyed on the runner's cap — background launch with
  output-file polling above 500000 ms (which every inert review and every
  default cap now is), foreground with an explicitly-set tool `timeout`
  parameter below it;
- derived output paths (`node -p`, not `mktemp`) so the polling call can find
  the file the launch call wrote;
- instructions to pin `CODEX_BIN` to the real install path inline, since PATH
  resolution through the Windows junction shim is unreliable;
- a bounded-bet rule: two launches per gate, then report the failure and let
  the Director fall back — a third attempt spends a round to learn nothing.

### Tests

New `tests/review-lane.test.js` (master-only; never stamped into projects), run
with `node tests/review-lane.test.js`. It drives the real runner against a stub
Codex that reports what the engine *saw*, and checks each fix twice — once
showing the failure mode reproduces, once showing it is gone. Teardown is
proven after a successful review, after `SIGTERM`, and after `SIGKILL`.

## 1.2.0 and earlier

Not recorded here; this file starts at 1.3.0. `git log` is the record for
earlier versions.
