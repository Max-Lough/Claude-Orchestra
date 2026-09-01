#!/usr/bin/env node
/**
 * Orchestra director guard — PreToolUse hook.
 *
 * Enforces Director law: the main session (the Director) may not edit files,
 * run commands, or search the codebase — those belong to the scout, detective,
 * and executor subagents. Subagent tool calls are exempt.
 *
 * The settings.json matcher fires this hook on every main-session tool call;
 * this script is the single source of truth for what the Director may do.
 *
 * Model-aware: Director law binds only director models (ORCHESTRA.md §1).
 * Before denying, the guard reads the session transcript and applies a
 * LATCH (leg-3 fix round 2A, closing the red team's "append/last-entry-wins"
 * CRITICAL): it scans every parseable non-sidechain assistant entry in what
 * it read, not just the last one. If ANY entry anywhere names a director
 * model (Opus/Fable), the session is enforced for the rest of the read
 * window regardless of what appears after it — a subagent that appends a
 * forged Haiku entry to the transcript no longer stands the guard down.
 * Only when NO director entry exists anywhere does the latest non-director
 * model (Sonnet, Haiku) stand the guard down, same as before. Undetermined
 * (no assistant entry at all) -> stand down too under legacy: enforcement
 * requires positive evidence of a director model. Sonnet/Haiku sessions
 * must never see a denial (they can't cheaply delegate simple tasks),
 * whereas an unenforced first turn on a director session is harmless —
 * ORCHESTRA.md still instructs the Director to delegate, and the guard picks
 * up hard enforcement as soon as a director model reaches the transcript.
 * Known one-turn staleness windows (both now fail toward standing down
 * under legacy; roster:new denies instead, see below):
 *   - fresh session, first assistant turn: no assistant entry is flushed yet
 *     -> undetermined -> stand down (a director session's opening turn is
 *     covered by protocol instructions rather than the hook);
 *   - the current turn is flushed only after it completes, so a mid-session
 *     /model switch is picked up one turn late.
 * A THIRD, distinct transcript state — the file (or read window) has content
 * but not one complete/parseable JSONL entry — is never "stand down": it
 * denies under BOTH rosters (see latestMainModel()), UNLESS the file is
 * small (< 64 KB) and was modified in the last 10 seconds — a transcript
 * genuinely mid-first-write, not garbage (leg-3 fix round 2A closes a
 * regression the prior round introduced: that exact shape used to deny even
 * legacy Sonnet/Haiku sessions).
 *
 * Size: the transcript can grow past a sane whole-file-read size. Rather
 * than a blanket deny once it does, the guard reads a bounded TAIL (the last
 * TAIL_BYTES) once the file exceeds MAX_TRANSCRIPT_BYTES and applies the
 * same latch over that window. A director entry older than the tail window
 * is not seen by this read — document that limitation, don't paper over it.
 * Under roster:new, a tail window with no director marker still denies via
 * the ordinary 'undetermined' path (it is not positive evidence either way).
 *
 * Asymmetry under roster:new (`.claude/orchestra.json` "roster": "new",
 * only ever actually in effect when owner-pinned — see loadPolicy()/loadPin()
 * below): the two staleness windows above are exactly the gap leg 4's
 * ticket gate closes for good, and this guard must not paper over it with a
 * stand-down. So under roster:new only, an UNDETERMINED model (transcript
 * missing, unreadable, or no assistant turn flushed yet) DENIES instead of
 * standing down; a *determined* non-director model (Sonnet/Haiku) still
 * stands down exactly as under legacy. roster:new is off by default and is
 * never set by this file — only the owner-pinned manifest, via the
 * installer, flips it. Legacy projects (roster !== "new", including no
 * manifest or no pin at all) see no behaviour change here. Malformed
 * PreToolUse input (stdin that isn't parseable JSON) is *also* part of this
 * asymmetry: legacy fails open (unchanged), roster:new denies.
 *
 * The pause switch (.claude/orchestra.pause / ORCHESTRA_PAUSE=1, §6) is
 * OUT-OF-BAND ONLY (leg-3 fix round 2A, FIX FIRST — closes the red team's
 * self-pause CRITICAL). There is no tool-call carve-out that creates or
 * edits the pause file anymore. Any Write/Edit/MultiEdit whose target
 * resolves to <project>/.claude/orchestra.pause is DENIED
 * (classifyPauseWrite() / denySelfPause()), with a reason that says how to
 * pause properly. Previously, an ALLOWed Write to that exact path let a
 * compromised Director/subagent flip the switch itself and everything
 * downstream (including the manifest pin) stood down permanently — one
 * Write, unconditional shell forever after.
 *
 * Ordering (leg-3 fix round 3A, MAJOR — closes review #3's finding at
 * guard:1303): main() now runs classifyPauseWrite()'s deny check BEFORE the
 * pause-exists short-circuit that stands the rest of the guard down, not
 * after. Under the old ordering, a pre-existing file at the pause path —
 * including one an attacker hardlinked to something else — short-circuited
 * straight to allow() before classifyPauseWrite() ever ran, so a Write to
 * the pause path itself was ALLOWED whenever *anything* already sat there.
 * The self-pause denial is now unconditional in truth, not just in the
 * common case. The pause-exists short-circuit itself is also narrower now
 * (item 1b): it only honours a GENUINE pause file — a regular file with
 * exactly one hard link, not a symlink/junction (see pauseFileStatus()). A
 * hardlinked or linked file at the pause path is IGNORED as a pause
 * signal: it neither stands the guard down nor (since the deny above always
 * wins) can any tool call ever create it in the first place. When an
 * ignored pause file is the reason the guard did NOT stand down, whatever
 * denial follows names that reason (see withManifestNote()).
 *
 * Two classes of writes remain exempt from Director law (a third — the
 * pause file — was retired above):
 *   - plan files: Write/Edit/MultiEdit of markdown under .claude/plans/
 *     (ORCHESTRA.md §4 PLAN). Plans are Director thinking, not execution.
 *     The carve-out is deliberately narrow (that directory, .md only,
 *     traversal-checked) so it cannot become a general write loophole.
 *   - memory files: CLAUDE.md / CLAUDE.local.md anywhere in the project, plus
 *     user-level memory under Claude's config dir ($CLAUDE_CONFIG_DIR or
 *     ~/.claude): its CLAUDE.md and markdown inside memory/memories
 *     directories (Claude Code's auto-memory notebook). Memory distills the
 *     conversation, which only the Director holds — delegating a one-line
 *     append buys no independence (the executor would transcribe text the
 *     Director composed) and blocking it breaks Claude Code's own auto-memory.
 *     One fence: an edit may never alter or remove the managed
 *     <!-- ORCHESTRA:BEGIN/END --> block in CLAUDE.md — that block wires the
 *     harness into the project and §6 reserves disabling the harness for the
 *     user. The guard simulates the write's result and denies any memory edit
 *     that does not carry the block through verbatim.
 *
 * Both remaining carve-outs share the same hardening, applied to the REAL
 * (symlink/junction-resolved) target path:
 *   - containment: the resolved path must stay inside the project (or,
 *     for memory, inside Claude's config dir) — a symlink/junction planted
 *     along the way cannot escape it;
 *   - link safety: if the resolved target already exists with more than one
 *     hard link, or its {dev, ino} matches a protected harness/config file
 *     (this guard file, settings.json, settings.local.json, orchestra.json,
 *     .mcp.json, CLAUDE.md, anything under .claude/hooks/), the write is
 *     denied ("hardlinked target") regardless of which carve-out matched.
 *     realpath resolution alone does not catch this: a hardlink IS the
 *     target file (same inode under a second name), so it needs no
 *     privilege to create and passes every path-based check trivially.
 *
 * Optional per-project policy — .claude/orchestra.json:
 *   {
 *     "directorBlockedPatterns": ["mcp__blender__*", "mcp__godot__*"],
 *     "directorAllowedTools": ["Glob"],
 *     "directorPlanPatterns": ["docs/plans/**\/*.md"],
 *     "directorMemoryPatterns": [".claude/rules/**\/*.md"]
 *   }
 * All three pattern keys are GLOBS, not regexes (leg-3 fix round 2A, item 4
 * — closes the red team's regex-hang HIGH: `hasNestedQuantifier()` only
 * caught grouped quantifiers, and several no-paren shapes hung the hook
 * past its timeout). Matching now runs through the same non-backtracking
 * token-DP matcher `verifier/checkout.js` uses for its own classification
 * patterns (see compileGlob()/globMatch()) — strictly O(pattern × text),
 * so no crafted pattern or path can hang it. `*` matches within one path
 * segment; `**` crosses segments. A pattern SHAPED LIKE A REGEX is REJECTED
 * at load time instead of compiled: starting with `^`, ending with `$`, or
 * containing any of `( ) | + \ { }` (see isRegexShaped()) — those
 * characters have no meaning in this glob dialect and signal a pattern
 * authored for the old (removed) regex engine.
 * directorBlockedPatterns: globs tested against tool NAMES; matches are
 *   denied to the Director (use for MCP tools that mutate external state).
 *   A TIGHTENING key — it can only add restrictions — so it is honoured
 *   from the manifest regardless of the pin/trust state below. Unlike the
 *   two loosening keys, a REJECTED entry here does not just drop itself: it
 *   fails the whole guard CLOSED for every tool already in the standard
 *   write/execution set (BLOCKED, below — already covers Write/Edit/
 *   MultiEdit, so this includes what would otherwise qualify for the plan/
 *   memory carve-outs) until the entry is fixed or removed — because a
 *   tightening key the guard cannot validate cannot be trusted to tighten
 *   correctly. Tools outside BLOCKED (Read, SlashCommand, an MCP tool name)
 *   are unaffected. See denyBlockedPatternsInvalid().
 * directorAllowedTools: exact built-in names to REMOVE from the default
 *   blocklist below (loosen the law for this project without editing code).
 *   A LOOSENING key (see the manifest-pin section). Under roster:new, Bash,
 *   PowerShell, Write, Edit, MultiEdit, and NotebookEdit can never be
 *   removed from the blocklist this way (item 7 of the leg-3 fix round —
 *   the first two because leg 4's ticket gate assumes them always
 *   enforceable, the file-write tools because loosening any of them is
 *   equivalent to loosening Bash: it lets the Director rewrite its own
 *   guard/settings directly), no matter how the manifest is trusted. Every
 *   other name in directorAllowedTools may still be loosened, trusted-
 *   manifest or not — see stripUnloosenableUnderNewRoster().
 * directorPlanPatterns / directorMemoryPatterns: LOOSENING keys — globs
 *   tested against the REAL project-relative path (forward-slash form) of
 *   Write/Edit/MultiEdit targets; matches are treated as plan/memory files
 *   in addition to the defaults. Paths outside the project (or, for memory,
 *   outside Claude's config dir) never match, and a .md extension is
 *   required on every route, default and configured alike. A rejected
 *   pattern (isPatternSafe()) is simply dropped — it loses only itself.
 * roster: "new" | "legacy" (default). NEVER read directly from this file —
 *   see "Manifest pin" below. Absent a valid owner pin, the project is
 *   either legacy or — if the manifest itself claims "new" — untrusted-new
 *   (fail closed), never a silent legacy downgrade (item 5).
 * seats / rosterGeneration: read and returned for the leg-4 ticket gate to
 *   consume; this guard does not act on them itself.
 * projectId: an installer-minted stable identifier (item 6), used as a
 *   fallback pin lookup key when the project directory has moved since it
 *   was pinned — see "Manifest pin" below.
 *
 * Manifest pin (loadPin() / loadPolicy()): `.claude/orchestra.json` lives
 * inside the project and is not, by itself, a trust boundary — anything that
 * can write into the project (a hostile cloned repo, a compromised
 * subagent's sanctioned delegation channel, pre-placement before the guard
 * ever runs) can rewrite it. The pin itself is also only a SAME-USER file —
 * it is not a trust boundary against same-user code either, and the README
 * says so plainly. What the pin buys is narrower and still real: it turns
 * silent manifest tampering into a detectable, fail-closed state instead of
 * a silent downgrade. So the manifest alone can never grant roster:new or
 * loosen the blocklist; it can only do either when an OWNER PIN, written
 * outside the project by the installer, says so:
 *   PIN_DIR = $ORCHESTRA_PIN_DIR || ~/.claude/orchestra/pins   (item 5d:
 *     honoured only if this directory actually exists — an env var pointing
 *     at a nonexistent directory is "no pin dir", same as none configured)
 * Lookup order — path key, then id key, then git-root key (leg-3 fix round
 * 3A, item 3, adds the third):
 *   pin file, by resolved project path: <PIN_DIR>/<sha256 hex of the
 *     project's real path>.json
 *   pin file, by project id (item 6 — a project that has MOVED since it was
 *     pinned): <PIN_DIR>/id-<sha256 hex of manifest.projectId>.json, tried
 *     only when the path-keyed file is absent and the manifest carries a
 *     projectId
 *   pin file, by git root commit (item 3 — a moved project whose manifest
 *     was also replaced, so projectId is no longer readable from it):
 *     <PIN_DIR>/git-<sha256 hex of the first line of `git rev-list
 *     --max-parents=0 HEAD` run in the project>.json, tried only when
 *     neither of the above resolves. `git` is invoked via
 *     child_process.execFileSync with a 5s timeout, cwd = the project; ANY
 *     failure (no git repo, git not installed, timeout, non-zero exit)
 *     simply skips this key — see gitRootPinKey(). A pin found this way is
 *     treated exactly like an id-found pin for the moved-project note; it
 *     is exempt from the path key's projectDir-must-agree forgery check.
 *   { projectDir, manifestSha256, roster, rosterGeneration, seats,
 *     writtenAt, by: "install.js" }
 * Strict pin schema (leg-3 fix round 3A, item 2, closes review #3's finding
 * at guard:734): a pin file that parses as an object is valid only if EVERY
 * field below is well-shaped — anything less (missing, wrong type, or the
 * wrong shape) is INVALID, same as a corrupt/forged pin (case d below),
 * never silently accepted because it happens to carry a recognized
 * `roster`. See pinSchemaProblem().
 *   projectDir       non-empty string
 *   manifestSha256   exactly 64 lowercase hex characters
 *   roster           "new" | "legacy"
 *   rosterGeneration non-negative integer
 *   writtenAt        parses as a date (Date.parse/`new Date()` non-NaN)
 *   by               non-empty string
 *   projectId        string, IF PRESENT (optional key)
 * Four cases (loadPolicy()):
 *   (a) no pin resolves by either key (including "no pin dir") ->
 *       - if the manifest itself claims roster:"new": UNTRUSTED-NEW,
 *         fail closed — roster is forced "new" so an undetermined model
 *         denies, every loosening key is dropped, and the denial reason
 *         says "manifest claims new without a pin" (item 5a — this is what
 *         closes the red-team "delete the pin, the manifest's roster:new
 *         claim gets silently ignored and its loosening keys get silently
 *         honoured" CRITICAL: deleting the pin used to be *safer* for an
 *         attacker than editing the manifest; now it is not);
 *       - otherwise (no manifest, or manifest claims legacy): LEGACY as
 *         today — the manifest's loosening keys are honoured exactly as
 *         before the pin existed ("unpinned legacy install" — a
 *         default-on-request, not an enforcement boundary);
 *   (b) pin resolves and is well-formed, and (if found by the PATH key) its
 *       own projectDir agrees with the resolved project path, and the
 *       manifest's bytes hash to pin.manifestSha256 -> the manifest is
 *       trusted: honour it fully, but roster still comes from the pin. A
 *       pin found by the ID key (or, item 3, the GIT-ROOT key) needs no
 *       projectDir agreement (that disagreement IS the moved-project case,
 *       item 6) but still needs the hash match for trust; a moved-but-trusted
 *       project has "project moved since pinning" appended to any denial
 *       reason it produces, for visibility;
 *   (c) pin resolves and is well-formed, but the manifest is missing/
 *       unreadable/hash-mismatched -> the manifest is UNTRUSTED: every
 *       loosening key is ignored, roster/seats/rosterGeneration come from
 *       the pin instead, and denial messages append
 *       "manifest untrusted (<reason>)". directorBlockedPatterns still
 *       applies if the manifest at least parses (it can only add
 *       restrictions). Under roster:new (from the pin) an undetermined
 *       model still denies, same as case (b);
 *   (d) a pin FILE resolves (by either key) but is corrupt/unparseable, has
 *       an invalid roster value, or — found by the PATH key — its own
 *       projectDir disagrees with the resolved project path (a forged pin:
 *       the red team hand-wrote one with an attacker projectDir and it was
 *       accepted) -> UNTRUSTED, same shape as (c), but roster is forced to
 *       "new" (fail closed — there is no valid pin data to read a roster
 *       value from, and a pin file's mere existence signals this project
 *       was pinned at some point, so failing toward enforcement is the safe
 *       direction) and the reason names the specific defect. This case NEVER
 *       collapses to (a): a corrupt/forged pin used to be silently treated
 *       as "no pin" — the red team's "deleting the pin is strictly better
 *       than editing the manifest" and "a corrupt pin is the same as no
 *       pin" CRITICALs both lived here; both are closed by this case
 *       existing at all.
 *
 * Fail-open by design for anything not covered above: any unexpected input,
 * config error, or internal error allows the call rather than bricking the
 * session. A broken orchestra.json disables only itself — the default
 * blocklist still applies. Model detection follows the same rule for its
 * genuinely-ambiguous states: undetermined stands down under legacy rather
 * than enforcing (roster:new denies it instead, as above).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Tools the Director may not use (default law).
const BLOCKED = new Set([
  'Edit',
  'MultiEdit',
  'Write',
  'NotebookEdit',
  'Bash',
  'PowerShell',
  'Grep',
  'Glob',
]);

// Models allowed to direct (MODE A / MODE B). Anything else — Sonnet, Haiku,
// or unknown — means the Orchestra is dormant (ORCHESTRA.md §1) and the guard
// stands down so the session behaves like plain Claude Code. Matches bare ids
// ("claude-opus-4-8"), suffixed ("claude-opus-4-8[1m]"), and provider-prefixed
// ("us.anthropic.claude-opus-...") forms.
const DIRECTOR_MODEL = /opus|fable/i;

const PAUSE_BASENAME = 'orchestra.pause';
const CONFIG_BASENAME = 'orchestra.json';
const PLANS_DIRNAME = 'plans'; // .claude/plans — the Director's own notebook

// Memory files the Director may edit itself (ORCHESTRA.md §3.1).
const MEMORY_BASENAMES = new Set(['CLAUDE.md', 'CLAUDE.local.md']);
const MARKER_BEGIN = '<!-- ORCHESTRA:BEGIN'; // loose: matches older stamped variants
const MARKER_END = '<!-- ORCHESTRA:END -->';

// Tools whose calls can qualify for the plan-file and memory-file exceptions.
const FILE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

// Tools the self-pause write detector watches (item A8, red-team
// re-verification #2, adds NotebookEdit to FILE_WRITE_TOOLS' three — a
// NotebookEdit whose notebook_path resolves to the pause path was
// previously not even considered). Deliberately a separate set from
// FILE_WRITE_TOOLS: the plan/memory carve-outs stay scoped to Write/Edit/
// MultiEdit as before (a .md-extension requirement excludes .ipynb anyway),
// while the pause deny — an absolute rule, not a carve-out — covers one
// more write surface.
const PAUSE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

// Transcript reading (latestMainModel()): read the whole file rather than a
// fixed-size tail, up to this cap. Session transcripts are bounded by
// conversation length, not by attacker input, so a full read is cheap in the
// overwhelmingly common case. Past this size, read a bounded TAIL instead of
// denying outright — see TAIL_BYTES and the file header "Size" note.
const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;

// Bounded tail size once a transcript exceeds MAX_TRANSCRIPT_BYTES (item 3).
const TAIL_BYTES = 8 * 1024 * 1024;

// Bounded HEAD window read alongside the tail once a transcript exceeds
// MAX_TRANSCRIPT_BYTES (item A3, red-team re-verification #2). A oversized
// transcript with a genuine director entry on line 1 and enough forged
// non-director filler to push that line out of the tail window used to
// stand the guard down under BOTH rosters — the latch only ever saw the
// tail. The latch now applies over head UNION tail (see latestMainModel()):
// a director entry in EITHER window still wins.
const HEAD_BYTES = 2 * 1024 * 1024;

// Legacy corrupt-state regression grace window (item 3): a transcript this
// small AND this recently CREATED AND MODIFIED (item A4 adds birthtimeMs —
// see below) is treated as "mid first write", not garbage, when it has
// content but zero parseable entries.
const CORRUPT_GRACE_BYTES = 64 * 1024;
const CORRUPT_GRACE_MS = 10 * 1000;

// Regex safety (loadPolicy()/toGlobs()) — retained as a glob-length cap; the
// DP matcher below has no backtracking hazard, but an absurdly long pattern
// is still not a config authors have any legitimate reason to write.
const MAX_PATTERN_LEN = 200;

// Tools that may never be loosened out of the default blocklist under
// roster:new, no matter how trusted the manifest is (item 7). Bash/
// PowerShell: leg 4's ticket gate assumes both stay enforceable. The four
// file-write tools: loosening any of them is equivalent to loosening Bash —
// it lets the Director rewrite its own guard/settings/manifest directly,
// with none of the plan/memory carve-outs' containment or hardlink defense.
const UNLOOSENABLE_UNDER_NEW_ROSTER = new Set([
  'Bash',
  'PowerShell',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
]);

function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

// Claude's own config dir — where user-level memory (CLAUDE.md, auto-memory)
// lives. Empty string when it can't be determined (then only project-level
// memory files qualify).
function claudeConfigDir() {
  if (typeof process.env.CLAUDE_CONFIG_DIR === 'string' && process.env.CLAUDE_CONFIG_DIR !== '') {
    return process.env.CLAUDE_CONFIG_DIR;
  }
  try {
    const home = os.homedir();
    return home ? path.join(home, '.claude') : '';
  } catch (_) {
    return '';
  }
}

// Directory the installer writes owner pins into (see the file-header
// "Manifest pin" note). Outside the project on purpose.
function pinDir() {
  if (typeof process.env.ORCHESTRA_PIN_DIR === 'string' && process.env.ORCHESTRA_PIN_DIR !== '') {
    return process.env.ORCHESTRA_PIN_DIR;
  }
  try {
    const home = os.homedir();
    return home ? path.join(home, '.claude', 'orchestra', 'pins') : '';
  } catch (_) {
    return '';
  }
}

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

// Appends the "manifest untrusted" note (loadPolicy() cases c/d), the
// "project moved since pinning" note (item 6), and — item 1(b), leg-3 fix
// round 3A — the "pause file ignored as a pause signal" note, to a denial
// message. Independent flags, any combination may apply at once.
function withManifestNote(msg, policy) {
  let out = msg;
  if (policy && policy.manifestUntrusted && policy.manifestUntrustedReason) {
    out += ' [' + policy.manifestUntrustedReason + ']';
  }
  if (policy && policy.pinMoved) {
    out += ' [project moved since pinning]';
  }
  if (policy && policy.pauseIgnoredReason) {
    out +=
      ' [a file exists at .claude/' + PAUSE_BASENAME + ' but was not honoured as a pause ' +
      'signal: ' + policy.pauseIgnoredReason + ']';
  }
  return out;
}

function denyDefault(toolName, policy) {
  const planPatternsRaw = policy.planPatternsRaw;
  const configuredDirs =
    Array.isArray(planPatternsRaw) && planPatternsRaw.length
      ? ', plus this project\'s configured pattern(s): ' + planPatternsRaw.join(', ')
      : '';
  const planHint = FILE_WRITE_TOOLS.has(toolName)
    ? 'Exceptions: plan files (markdown under .claude/' + PLANS_DIRNAME + '/' + configuredDirs +
      ') and memory files (CLAUDE.md / CLAUDE.local.md, auto-memory) are Director-authored. '
    : '';
  deny(
    withManifestNote(
      'Orchestra: the Director does not use ' + toolName + '. Delegate instead — ' +
        'searches/reading the terrain -> scout agent (causal deep-dives -> detective); ' +
        'file edits and commands -> executor ' +
        'or a domain specialist agent; verification -> reviewer agent. ' + planHint +
        '(User-only pause switch, out-of-band only: set ORCHESTRA_PAUSE=1, or have the user ' +
        'create .claude/' + PAUSE_BASENAME + ' themselves — no tool call can create it.)',
      policy
    )
  );
}

// roster:new only (see the "Asymmetry under roster:new" file header note):
// an undetermined session model denies rather than standing down, because
// the fail-open window here is precisely what leg 4's ticket gate must not
// inherit. A genuinely non-director (Sonnet/Haiku) session's denial clears
// itself as soon as that model reaches the transcript on the next turn.
function denyUndeterminedModel(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: this project runs roster:new, where an undetermined session model ' +
        '(no assistant turn in the transcript yet, an unreadable transcript, or an ' +
        'unrecognized model string) denies ' + toolName + ' rather than standing down — ' +
        'unlike the legacy default. If this is genuinely a non-director (Sonnet/Haiku) ' +
        'session with no director entry anywhere in what the guard has read so far, this ' +
        'denial clears once that model reaches the transcript. It is NOT guaranteed to clear ' +
        'on a session where a director model already appears anywhere in the transcript ' +
        '(item A8) — the latch (see the file header "Model-aware" note) makes that entry win ' +
        'regardless of what appears after it, including a forged non-director marker. The ' +
        'reliable way out is the user-only pause switch, out-of-band only: ORCHESTRA_PAUSE=1 ' +
        'or a pre-existing .claude/' + PAUSE_BASENAME + ' file.',
      policy
    )
  );
}

// A transcript (or the tail window read of one) that has content but not one
// complete/parseable JSONL entry (see latestMainModel()) is never treated as
// "stand down" unless it also qualifies for the small-and-fresh grace
// window — under a tail read or a genuinely garbage file, this is exactly
// the eviction/regression hole; it signals a transcript that cannot vouch
// for anything. Denies under BOTH rosters.
function denyCorruptTranscript(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: the session transcript exists but contains no complete, parseable entry — ' +
        'distinct from simply having no assistant turn yet. That state denies ' + toolName +
        ' under both rosters rather than standing down, since a transcript that cannot be read ' +
        'is not positive evidence of anything. (User-only pause switch, out-of-band only: ' +
        '.claude/' + PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

// roster:new only: an unparseable PreToolUse payload is part of the same
// undetermined-state asymmetry as the model checks above — legacy still
// fails open (unchanged), roster:new denies instead of silently exiting 0.
function denyMalformedInput(policy) {
  deny(
    withManifestNote(
      'Orchestra: this project runs roster:new, where a PreToolUse payload the guard could not ' +
        'parse as JSON denies rather than standing down (legacy behaviour — failing open on ' +
        'unparseable input — is unchanged). (User-only pause switch, out-of-band only: ' +
        '.claude/' + PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

function denyByPolicy(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: ' + toolName + ' is blocked for the Director by project policy ' +
        '(.claude/' + CONFIG_BASENAME + '): tools that mutate external state count as ' +
        'execution. Delegate to the executor or a domain specialist agent — subagents ' +
        'inherit MCP tools. (User-only pause switch, out-of-band only: .claude/' +
        PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

function denyMarkerBlock(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: memory files are Director-editable, but this ' + toolName + ' would alter ' +
        'or remove the managed Orchestra block (' + MARKER_BEGIN + ' ... ' + MARKER_END +
        ') in CLAUDE.md. That block wires the harness and belongs to the installer and the ' +
        'user (ORCHESTRA.md §6): edit around it, carrying it through unchanged. If the user ' +
        'wants the harness disabled, they pause it themselves (.claude/' + PAUSE_BASENAME +
        ' / ORCHESTRA_PAUSE=1, out-of-band only) or run the installer with --uninstall.',
      policy
    )
  );
}

// One of the two remaining write carve-outs (plan/memory) matched by path,
// but the resolved target is already linked to something it shouldn't be —
// see linkSafety(). Deliberately the same message regardless of which
// carve-out matched: the hazard (a pre-placed hardlink) is identical either
// way.
function denyHardlinkedTarget(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: ' + toolName + ' targets a path that already exists as a hardlink (or the ' +
        'same file, by device+inode) to a protected harness/config file — reason: hardlinked ' +
        'target. A realpath check alone cannot catch this: a hardlink IS the target file under ' +
        'a second name. Delegate this write to the executor instead. (User-only pause switch, ' +
        'out-of-band only: .claude/' + PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

// Self-pause CRITICAL fix (item 1): no tool call may create or edit the
// pause file itself anymore. See classifyPauseWrite().
function denySelfPause(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: ' + toolName + ' may not create or edit .claude/' + PAUSE_BASENAME + ' — a ' +
        'tool call can no longer flip the pause switch (leg-3 fix round 2A closed the ' +
        'self-pause hole: one allowed Write used to stand the guard down permanently, before ' +
        'the pin or model check ever ran). Pause out-of-band instead: set ORCHESTRA_PAUSE=1 in ' +
        'the environment, or have the user create .claude/' + PAUSE_BASENAME + ' directly, ' +
        'outside the tool loop.',
      policy
    )
  );
}

// Tightening-key fail-closed (item 4): a directorBlockedPatterns entry that
// was rejected at load time (see toGlobsTightening()) means the guard
// cannot trust what the manifest wanted to add to the blocklist. Rather
// than silently drop the bad entry (the LOOSENING-key convention), the
// whole guard fails closed until it's fixed: every write is denied,
// including the plan/memory carve-outs and any manifest loosening.
function denyBlockedPatternsInvalid(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: .claude/' + CONFIG_BASENAME + '\'s directorBlockedPatterns contains an ' +
        'entry that was rejected at load (shaped like a regex, not a glob — see the guard\'s ' +
        'glob-only pattern rule: no leading ^, no trailing $, none of ( ) | + \\ { }). ' +
        'directorBlockedPatterns is a TIGHTENING key, so a broken entry fails the guard ' +
        'CLOSED rather than dropping itself: every write is denied — including plan/memory ' +
        'carve-outs and any manifest loosening — until the pattern is fixed or removed. ' +
        '(User-only pause switch, out-of-band only: ORCHESTRA_PAUSE=1 or a pre-existing ' +
        '.claude/' + PAUSE_BASENAME + ' file.)',
      policy
    )
  );
}

// ------------------------------------------------------------- glob engine
//
// Non-backtracking glob matcher (item 4), copied from verifier/checkout.js's
// classification-pattern matcher: `**` crosses path separators, `*` does
// not; text is matched in full (implicitly anchored both ends). Patterns
// are token-compiled once (cached) and matched with a linear dynamic
// program over tokens × characters — no backtracking to detonate, whatever
// an agent-editable pattern source feeds it. See that file for the fuller
// history (a compiled-regex predecessor of this matcher was detonated twice
// by adjacent and then separated star runs before the DP replaced it).

const GLOB_CACHE = new Map();
function compileGlob(pattern) {
  const norm = String(pattern).replace(/\\/g, '/');
  let tokens = GLOB_CACHE.get(norm);
  if (tokens) return tokens;
  tokens = [];
  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === '*') {
      let stars = 1;
      while (norm[i + 1] === '*') { stars++; i++; }
      if (stars >= 2) {
        if (norm[i + 1] === '/') i++; // `**/` also matches zero directories
        if (tokens[tokens.length - 1] !== 'globstar') tokens.push('globstar');
      } else if (tokens[tokens.length - 1] !== 'star') {
        tokens.push('star');
      }
    } else {
      tokens.push(norm[i]); // literal character (one-char tokens)
    }
  }
  GLOB_CACHE.set(norm, tokens);
  return tokens;
}

// dp[j] = "the tokens consumed so far can match text[0..j)". Each token
// updates the whole row in one linear pass. `**` matches anything except a
// line terminator (it does cross '/'); `*` matches anything except '/'.
const LINE_TERMINATORS = new Set(['\n', '\r', ' ', ' ']);
function globMatch(tokens, text) {
  const n = text.length;
  let prev = new Array(n + 1).fill(false);
  prev[0] = true;
  for (const tok of tokens) {
    const next = new Array(n + 1).fill(false);
    if (tok === 'globstar') {
      for (let j = 0; j <= n; j++) {
        if (prev[j]) next[j] = true;
        else if (j > 0 && next[j - 1] && !LINE_TERMINATORS.has(text[j - 1])) next[j] = true;
      }
    } else if (tok === 'star') {
      for (let j = 0; j <= n; j++) {
        if (prev[j]) next[j] = true;
        else if (j > 0 && next[j - 1] && text[j - 1] !== '/') next[j] = true;
      }
    } else {
      for (let j = n; j >= 1; j--) next[j] = prev[j - 1] && text[j - 1] === tok;
    }
    prev = next;
  }
  return prev[n];
}

function matchesAny(compiledPatterns, text) {
  const norm = String(text).replace(/\\/g, '/');
  return (compiledPatterns || []).some((tokens) => globMatch(tokens, norm));
}

// A pattern is rejected at load time (never compiled) if it is shaped like a
// regex rather than a glob: an anchor (^ at the start, $ at the end) or any
// of the regex-only metacharacters ( ) | + \ { } appearing anywhere. Globs
// never need these — ** and * cover the traversal shapes this guard's
// patterns exist for — so their presence signals a pattern authored for the
// old (removed) RegExp() engine. Backslash is banned outright (rather than
// only when it escapes something), so an "unescaped $" carve-out would be
// dead logic: any `\` at all already trips the metacharacter test below,
// which means a trailing `$` in a pattern that reaches this line is always
// unescaped by construction.
const REGEX_ONLY_CHARS = /[()|+\\{}]/;
function isRegexShaped(src) {
  if (typeof src !== 'string' || src.length === 0) return true;
  if (src.charAt(0) === '^') return true;
  if (src.charAt(src.length - 1) === '$') return true;
  if (REGEX_ONLY_CHARS.test(src)) return true;
  return false;
}

function isPatternSafe(src) {
  return typeof src === 'string' && src.length > 0 && src.length <= MAX_PATTERN_LEN && !isRegexShaped(src);
}

// Array-length cap on every pattern key (item A6, red-team re-verification
// #2): an oversized array (e.g. 100k entries) is rejected WITHOUT compiling
// a single glob — the check is on the RAW array length, before even
// filtering to strings, so it returns in O(1) regardless of what the array
// holds. A single grossly long pattern was already capped (MAX_PATTERN_LEN,
// isPatternSafe()); this caps the ARRAY, closing the same class of DoS one
// level up.
const MAX_PATTERN_ARRAY_LEN = 64;

// LOOSENING-key compilation (directorPlanPatterns / directorMemoryPatterns):
// a rejected entry silently drops itself, same fail-safe convention as the
// rest of loadPolicy() — a bad entry loses only itself, never the whole
// policy. An oversized array drops ENTIRELY (item A6) — not just its excess
// entries — same as any other rejected loosening-key entry.
function compileGlobsLoosening(arr) {
  if (Array.isArray(arr) && arr.length > MAX_PATTERN_ARRAY_LEN) return [];
  return arrOfStrings(arr)
    .filter((s) => isPatternSafe(s))
    .map((s) => compileGlob(s));
}

// TIGHTENING-key compilation (directorBlockedPatterns): callers also need to
// know whether ANY entry was rejected, because a rejected entry here fails
// the whole guard closed (see denyBlockedPatternsInvalid()) rather than
// dropping silently. An oversized array (item A6) is `invalid` the same way
// a single malformed entry is.
function compileGlobsTightening(arr) {
  if (Array.isArray(arr) && arr.length > MAX_PATTERN_ARRAY_LEN) {
    return { patterns: [], invalid: true };
  }
  const strings = arrOfStrings(arr);
  const patterns = [];
  let invalid = false;
  for (const s of strings) {
    if (isPatternSafe(s)) patterns.push(compileGlob(s));
    else invalid = true;
  }
  return { patterns, invalid };
}

function arrOfStrings(arr) {
  return (Array.isArray(arr) ? arr : []).filter((s) => typeof s === 'string');
}

function objOrNull(o) {
  return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
}

// Even a trusted manifest may never remove these from the block set once
// roster:new is in effect (item 7) — see UNLOOSENABLE_UNDER_NEW_ROSTER.
// Every other name in directorAllowedTools may still be loosened,
// trusted-manifest or not.
function stripUnloosenableUnderNewRoster(allowed, roster) {
  if (roster !== 'new') return allowed;
  return allowed.filter((t) => !UNLOOSENABLE_UNDER_NEW_ROSTER.has(t));
}

// Roster:new install fingerprints (item A2, red-team re-verification #2 —
// closes "delete the pin AND drop/omit the roster key" as a second, easier
// bypass of case (a)'s fail-closed branch: the manifest-level check above
// only fires when the manifest itself still SAYS roster:"new". An attacker
// who also rewrites the manifest to omit `roster` (or say "legacy") used to
// fall straight into "unpinned legacy install", which honours every
// loosening key — stripUnloosenableUnderNewRoster() only strips when
// roster === 'new', so it is a no-op on that path. These marks exist ONLY
// because some install wrote roster:new here at some point, independent of
// what the current (possibly attacker-edited) manifest claims: the ten
// roster agent files, the conductor file, the shared runtime substrate
// directory, or any manifest key only a roster:new install ever writes.
const ROSTER_NEW_AGENT_FILES = [
  'architect.md',
  'builder.md',
  'data-engineer.md',
  'investigator.md',
  'red-team.md',
  'reviewer-anthropic.md',
  'reviewer-openai.md',
  'sweeper.md',
  'test-designer-vs-anthropic.md',
  'test-designer-vs-openai.md',
];
const ROSTER_NEW_MANIFEST_KEYS = [
  'projectId',
  'installedFiles',
  'installedPermissions',
  'installedHooks',
  'rosterGeneration',
];

function hasRosterNewFingerprint(root, cfg) {
  try {
    if (fs.existsSync(path.join(root, '.claude', 'orchestra'))) return true;
  } catch (_) {
    /* ignore */
  }
  try {
    if (fs.existsSync(path.join(root, '.claude', 'ORCHESTRA-CONDUCTOR.md'))) return true;
  } catch (_) {
    /* ignore */
  }
  for (const f of ROSTER_NEW_AGENT_FILES) {
    try {
      if (fs.existsSync(path.join(root, '.claude', 'agents', f))) return true;
    } catch (_) {
      /* ignore */
    }
  }
  if (cfg && typeof cfg === 'object') {
    for (const k of ROSTER_NEW_MANIFEST_KEYS) {
      if (Object.prototype.hasOwnProperty.call(cfg, k)) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------- manifest pin

// Third pin lookup key (item 3, leg-3 fix round 3A): the project's git root
// commit, for a project that has both moved AND had its manifest replaced
// (so projectId — the id-key's source — is no longer readable from it
// either). rootCommitHash = the FIRST line of `git rev-list --max-parents=0
// HEAD`, run with cwd = the project. ANY failure (no git repo, git not on
// PATH, timeout, non-zero exit — e.g. a repo with no commits yet) simply
// skips this key: it returns null rather than throwing, same fail-open
// posture as every other pin lookup here. 5s timeout matches the installer
// side's contract for this same command.
function gitRootPinKey(real) {
  try {
    const out = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
      cwd: real,
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const firstLine = String(out).split(/\r?\n/)[0];
    if (!firstLine) return null;
    return 'git-' + crypto.createHash('sha256').update(firstLine, 'utf8').digest('hex') + '.json';
  } catch (_) {
    return null;
  }
}

// Strict pin schema (item 2, leg-3 fix round 3A) — see the file-header
// "Strict pin schema" note. Returns null when `obj` (already known to be a
// parsed, non-array object) satisfies every required field; otherwise a
// short reason string naming the first defect found, in the fixed order
// below. A pin missing a field entirely fails the same way as one that has
// it in the wrong shape — there is no partial credit for "the fields it did
// include look fine".
function pinSchemaProblem(obj) {
  if (typeof obj.projectDir !== 'string' || obj.projectDir === '') {
    return 'invalid pin (projectDir)';
  }
  if (typeof obj.manifestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(obj.manifestSha256)) {
    return 'invalid pin (manifestSha256)';
  }
  if (obj.roster !== 'new' && obj.roster !== 'legacy') {
    return 'invalid pin (roster)';
  }
  if (
    typeof obj.rosterGeneration !== 'number' ||
    !Number.isInteger(obj.rosterGeneration) ||
    obj.rosterGeneration < 0
  ) {
    return 'invalid pin (rosterGeneration)';
  }
  if (
    (typeof obj.writtenAt !== 'string' && typeof obj.writtenAt !== 'number') ||
    Number.isNaN(new Date(obj.writtenAt).getTime())
  ) {
    return 'invalid pin (writtenAt)';
  }
  if (typeof obj.by !== 'string' || obj.by === '') {
    return 'invalid pin (by)';
  }
  if (Object.prototype.hasOwnProperty.call(obj, 'projectId') && typeof obj.projectId !== 'string') {
    return 'invalid pin (projectId)';
  }
  return null;
}

// Resolves the owner pin for this project — see the file-header "Manifest
// pin" note for the (a)/(b)/(c)/(d) cases this feeds into loadPolicy().
// Three lookup keys, tried in order (item 6 / item 3, moved projects): the
// resolved-path hash first; then, only if that misses and the manifest
// carries a projectId, the id hash; then, only if BOTH of those miss, the
// git-root hash (skipped entirely when gitRootPinKey() can't determine one
// — no git repo, git not installed, etc.).
// Returns a discriminated result so loadPolicy() can tell "no pin anywhere"
// (case a) apart from "a pin file exists but is corrupt, forged, or
// schema-invalid" (case d) — that state NEVER silently collapses to "no
// pin"; that collapse is the red-team finding this closes ("a corrupt pin
// is the same as no pin", "deleting the pin is strictly better than editing
// the manifest").
//   { found: false }
//   { found: true, valid: false, reason }
//   { found: true, valid: true, foundBy: 'path'|'id'|'git', pin: {...} }
function loadPin(real, cfg) {
  const dir = pinDir();
  if (dir === '') return { found: false };
  let dirStat;
  try {
    dirStat = fs.statSync(dir);
  } catch (_) {
    dirStat = null;
  }
  // item 5(d): ORCHESTRA_PIN_DIR (or the default) pointing at a nonexistent
  // directory is "no pin dir" — same as none configured, not an error.
  if (!dirStat || !dirStat.isDirectory()) return { found: false };

  const pathHash = crypto.createHash('sha256').update(real, 'utf8').digest('hex');
  const byPath = path.join(dir, pathHash + '.json');
  let pinFilePath = null;
  let foundBy = null;
  if (fs.existsSync(byPath)) {
    pinFilePath = byPath;
    foundBy = 'path';
  } else if (cfg && typeof cfg.projectId === 'string' && cfg.projectId !== '') {
    const idHash = crypto.createHash('sha256').update(cfg.projectId, 'utf8').digest('hex');
    const byId = path.join(dir, 'id-' + idHash + '.json');
    if (fs.existsSync(byId)) {
      pinFilePath = byId;
      foundBy = 'id';
    }
  }
  if (pinFilePath === null) {
    // item 3: third key, tried only when both of the above miss. A project
    // that moved AND had its manifest replaced can no longer be found by
    // path (stale) or id (the replaced manifest carries no projectId, or a
    // different one) — its git history is the one thing that survives both.
    const gitKeyName = gitRootPinKey(real);
    if (gitKeyName !== null) {
      const byGit = path.join(dir, gitKeyName);
      if (fs.existsSync(byGit)) {
        pinFilePath = byGit;
        foundBy = 'git';
      }
    }
  }
  if (pinFilePath === null) return { found: false };

  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(pinFilePath, 'utf8'));
  } catch (_) {
    return { found: true, valid: false, reason: 'corrupt pin' };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { found: true, valid: false, reason: 'corrupt pin' };
  }
  const schemaProblem = pinSchemaProblem(obj);
  if (schemaProblem) {
    return { found: true, valid: false, reason: schemaProblem };
  }
  const pin = {
    projectDir: obj.projectDir,
    roster: obj.roster,
    seats: objOrNull(obj.seats),
    rosterGeneration: obj.rosterGeneration,
    manifestSha256: obj.manifestSha256,
  };
  // Forged-pin check (red team: a hand-written pin with a projectDir naming
  // a completely different path was accepted). When found by the PATH key,
  // the pin's own projectDir must agree with the path that produced the
  // hash — a mismatch means the pin file's *contents* were tampered with
  // independent of its filename. Found-by-ID pins are exempt from this (that
  // disagreement IS the moved-project case, item 6) but still require the
  // manifest hash to match for trust.
  if (foundBy === 'path' && pin.projectDir !== real) {
    return { found: true, valid: false, reason: 'pin projectDir does not match this project' };
  }
  return { found: true, valid: true, foundBy, pin };
}

// Per-project policy, gated by the owner pin — see the file-header
// "Manifest pin" note for the (a)/(b)/(c)/(d) cases this implements. Any
// unexpected error anywhere in here returns the fully-empty (legacy,
// unconfigured) policy — the default blocklist above is never weakened by a
// broken pin or manifest.
function loadPolicy() {
  const empty = {
    patterns: [],
    blockedPatternsInvalid: false,
    allowed: [],
    planPatterns: [],
    planPatternsRaw: [],
    memoryPatterns: [],
    roster: 'legacy',
    seats: null,
    rosterGeneration: null,
    manifestUntrusted: false,
    manifestUntrustedReason: '',
    pinMoved: false,
  };
  try {
    const root = projectDir();
    let real;
    try {
      real = fs.realpathSync(root);
    } catch (_) {
      real = path.resolve(root);
    }

    const manifestPath = path.join(root, '.claude', CONFIG_BASENAME);
    let manifestBytes = null;
    try {
      manifestBytes = fs.readFileSync(manifestPath);
    } catch (_) {
      manifestBytes = null;
    }
    let cfg = null;
    let manifestError = manifestBytes === null ? 'missing or unreadable' : null;
    if (manifestBytes !== null) {
      try {
        const parsed = JSON.parse(manifestBytes.toString('utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          cfg = parsed;
        } else {
          manifestError = 'not an object';
        }
      } catch (_) {
        manifestError = 'invalid JSON';
      }
    }

    const pinResult = loadPin(real, cfg);

    const fieldsFromManifest = (roster) => {
      const g = compileGlobsTightening(cfg ? cfg.directorBlockedPatterns : null);
      return {
        patterns: g.patterns,
        blockedPatternsInvalid: g.invalid,
        allowed: stripUnloosenableUnderNewRoster(cfg ? arrOfStrings(cfg.directorAllowedTools) : [], roster),
        // item A6: planPatternsRaw feeds straight into denyDefault()'s
        // user-facing hint (see withManifestNote() callers) — an oversized
        // array dropped everywhere else must not still get dumped verbatim
        // into a denial message.
        planPatternsRaw:
          cfg && !(Array.isArray(cfg.directorPlanPatterns) && cfg.directorPlanPatterns.length > MAX_PATTERN_ARRAY_LEN)
            ? arrOfStrings(cfg.directorPlanPatterns)
            : [],
        planPatterns: cfg ? compileGlobsLoosening(cfg.directorPlanPatterns) : [],
        memoryPatterns: cfg ? compileGlobsLoosening(cfg.directorMemoryPatterns) : [],
      };
    };

    if (!pinResult.found) {
      // (a) No pin resolves by either key.
      const claimsNew = cfg && cfg.roster === 'new';
      // item A2: even when the manifest DOESN'T claim roster:new (omitted,
      // or rewritten to "legacy"), on-disk/manifest fingerprints from a
      // real roster:new install still fail this closed — see
      // hasRosterNewFingerprint()'s doc comment.
      const fingerprint = !claimsNew && hasRosterNewFingerprint(root, cfg);
      if (claimsNew || fingerprint) {
        // Fail-closed sub-case (item 5a / item A2): nothing outside the
        // project backs a roster:new claim (explicit or fingerprinted).
        // Forcing this to LEGACY (the old behaviour) is exactly the "delete
        // the pin" bypass the red team found — force NEW instead and drop
        // every loosening key.
        const g = compileGlobsTightening(cfg ? cfg.directorBlockedPatterns : null);
        return Object.assign({}, empty, {
          patterns: g.patterns,
          blockedPatternsInvalid: g.invalid,
          roster: 'new',
          manifestUntrusted: true,
          manifestUntrustedReason: claimsNew
            ? 'manifest untrusted (manifest claims new without a pin)'
            : 'manifest untrusted (installed roster:new project without a pin)',
        });
      }
      if (!cfg) return empty;
      const f = fieldsFromManifest('legacy');
      return Object.assign({}, empty, f, {
        rosterGeneration: typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : null,
        seats: objOrNull(cfg.seats),
      });
    }

    if (!pinResult.valid) {
      // (d) A pin file exists but is corrupt, unparseable, or forged. Never
      // collapses to (a) — see loadPin()'s doc comment.
      const g = compileGlobsTightening(cfg ? cfg.directorBlockedPatterns : null);
      return Object.assign({}, empty, {
        patterns: g.patterns,
        blockedPatternsInvalid: g.invalid,
        roster: 'new',
        seats: null,
        rosterGeneration: null,
        manifestUntrusted: true,
        manifestUntrustedReason: 'manifest untrusted (' + pinResult.reason + ')',
      });
    }

    const pin = pinResult.pin;
    // item 3: a pin found by the git-root key is the same "moved project"
    // shape as one found by id — its own projectDir names wherever it was
    // pinned, which need not be here.
    const moved =
      (pinResult.foundBy === 'id' || pinResult.foundBy === 'git') && pin.projectDir !== real;

    const trusted =
      cfg !== null &&
      manifestBytes !== null &&
      typeof pin.manifestSha256 === 'string' &&
      crypto.createHash('sha256').update(manifestBytes).digest('hex') === pin.manifestSha256;

    if (trusted) {
      // (b) Pin present and valid, manifest bytes hash-match: honour the
      // manifest fully; roster still comes from the pin (it always does).
      const f = fieldsFromManifest(pin.roster);
      // item A7 (red-team re-verification #2): a pin found by the id or
      // git-root key with a projectDir that still differs from here is
      // "moved" — but a verbatim COPY of a pinned project's .claude/ (not
      // an actual move) is indistinguishable from a real move by this
      // check alone: the manifest hash matches byte-for-byte either way.
      // Enforcement (roster, seats, rosterGeneration, the tightening key)
      // is honoured regardless — it can only restrict, so trusting it here
      // is safe even for a copy. LOOSENING keys are not: a copy landing
      // anywhere would otherwise inherit the victim project's loosened
      // tools/plan/memory patterns wherever it's placed. Only a fresh
      // path-keyed pin (--repin, which asserts this specific path really
      // is the project that moved) restores loosening trust.
      const unloosened = moved
        ? { allowed: [], planPatternsRaw: [], planPatterns: [], memoryPatterns: [] }
        : {};
      return Object.assign({}, empty, f, unloosened, {
        roster: pin.roster,
        rosterGeneration: typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : pin.rosterGeneration,
        seats: objOrNull(cfg.seats) || pin.seats,
        pinMoved: moved,
      });
    }

    // (c) Pin present and valid, manifest missing/unreadable/hash-
    // mismatched: the manifest is UNTRUSTED. Every loosening key
    // (directorAllowedTools, directorPlanPatterns, directorMemoryPatterns)
    // is ignored outright; directorBlockedPatterns still applies if the
    // manifest at least parses (it can only add restrictions, never remove
    // one). roster/seats/rosterGeneration come from the pin, not the
    // manifest.
    const reason = manifestError || 'hash mismatch';
    const g = compileGlobsTightening(cfg ? cfg.directorBlockedPatterns : null);
    return Object.assign({}, empty, {
      patterns: g.patterns,
      blockedPatternsInvalid: g.invalid,
      roster: pin.roster,
      seats: pin.seats,
      rosterGeneration: pin.rosterGeneration,
      manifestUntrusted: true,
      manifestUntrustedReason: 'manifest untrusted (' + reason + ')',
      pinMoved: moved,
    });
  } catch (_) {
    return empty;
  }
}

// --------------------------------------------------------------- transcript

// Latest main-session assistant model from the session transcript, with the
// director-latch applied (see the file header "Model-aware" and "Size"
// notes). Reads the WHOLE file up to MAX_TRANSCRIPT_BYTES; past that, reads
// a bounded TAIL_BYTES window from the end instead of denying outright.
// Scans every line in what it read (not just until the first hit): if ANY
// non-sidechain assistant entry names a director model, that wins over
// every other entry in the window, including ones that appear after it.
//
// Returns one of:
//   { model: string }    — positive evidence of a session model (a director
//                          model always wins if one appears anywhere in the
//                          window; otherwise the latest non-director model).
//   { state: 'empty' }   — no transcript_path, missing/unreadable file, an
//                          empty file, a file with only non-assistant
//                          entries, OR a corrupt-looking file that is small
//                          and was modified in the last CORRUPT_GRACE_MS
//                          (genuinely mid-first-write, not garbage). Callers
//                          treat this as "undetermined": legacy stands
//                          down, roster:new denies.
//   { state: 'corrupt' } — content but not one complete, parseable JSONL
//                          entry anywhere in what was read, and it does not
//                          qualify for the grace window above. Denies under
//                          BOTH rosters (see denyCorruptTranscript()) rather
//                          than ever standing down.
function latestMainModel(input) {
  try {
    const tp = input.transcript_path;
    if (typeof tp !== 'string' || tp === '') return { state: 'empty' };
    let stat;
    try {
      stat = fs.statSync(tp);
    } catch (_) {
      return { state: 'empty' }; // missing/unreadable — "not written yet"
    }
    if (!stat.isFile()) return { state: 'empty' };
    if (stat.size === 0) return { state: 'empty' };

    let lines;
    if (stat.size > MAX_TRANSCRIPT_BYTES) {
      // Bounded tail + HEAD (item 3 / item A3 / file header "Size"): never
      // a blanket deny purely for size. The tail alone used to be an
      // attacker-sized gap — a director entry on line 1 of a 66 MB
      // transcript, followed by enough forged non-director filler to push
      // it out of an 8 MB tail window, stood the guard down under BOTH
      // rosters. Reading a bounded HEAD window too and applying the latch
      // over head UNION tail closes that: a director entry in EITHER
      // window still wins. A director entry older than BOTH windows is
      // still not seen — documented, not silently assumed away.
      const fd = fs.openSync(tp, 'r');
      try {
        const tailSize = Math.min(TAIL_BYTES, stat.size);
        const tailBuf = Buffer.alloc(tailSize);
        fs.readSync(fd, tailBuf, 0, tailSize, stat.size - tailSize);
        let headLines = [];
        const headSize = Math.min(HEAD_BYTES, stat.size - tailSize);
        if (headSize > 0) {
          const headBuf = Buffer.alloc(headSize);
          fs.readSync(fd, headBuf, 0, headSize, 0);
          headLines = headBuf.toString('utf8').split('\n');
        }
        lines = headLines.concat(tailBuf.toString('utf8').split('\n'));
      } finally {
        fs.closeSync(fd);
      }
    } else {
      lines = fs.readFileSync(tp, 'utf8').split('\n');
    }

    let sawValidEntry = false;
    let directorModel = null;
    let otherModel = null;
    // Latch (item 2): scan every line in the window, not just until the
    // first hit (and not stopping at the last one either — the old
    // backward scan's "last assistant entry wins" was exactly the
    // append/last-entry-wins hole). A director entry anywhere wins over any
    // non-director entry anywhere else in the window, including ones that
    // come after it.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue; // partial/corrupt line (e.g. a tail read's truncated first line) — keep scanning
      }
      sawValidEntry = true;
      // item A8: any TRUTHY isSidechain counts as a sidechain, not only the
      // literal boolean `true` — a forged/hand-appended entry carrying the
      // string "true" (JS truthy, but `!== true` under strict equality)
      // used to be read as a non-sidechain assistant entry.
      if (entry && entry.type === 'assistant' && !entry.isSidechain) {
        const model = entry.message && entry.message.model;
        if (typeof model === 'string' && model !== '' && model !== '<synthetic>') {
          if (DIRECTOR_MODEL.test(model)) {
            directorModel = model;
          } else {
            otherModel = model;
          }
        }
      }
    }
    if (directorModel) return { model: directorModel };
    if (otherModel) return { model: otherModel };
    if (sawValidEntry) return { state: 'no-assistant' };

    // No complete/parseable entry anywhere in what was read ("corrupt").
    // Legacy regression fix (item 3): a transcript genuinely mid-first-
    // write is small and was just touched — treat that shape as 'empty'
    // (stand down) instead of denying a Sonnet/Haiku session that hasn't
    // produced one complete flushed line yet. Item A4 (red-team
    // re-verification #2) gates this on birthtimeMs as well as mtimeMs: an
    // EXISTING transcript truncated to garbage (e.g. overwritten with a
    // single "x") gets a fresh mtime from the truncation but keeps its
    // original birth time, so mtime alone used to let a truncation-bypass
    // through the grace window. Requiring the file to have been CREATED
    // within the window too — not merely modified — closes that; a
    // genuinely new, still-being-written transcript satisfies both.
    // Anything else with content but no parseable entry denies under both
    // rosters, unchanged.
    if (
      stat.size < CORRUPT_GRACE_BYTES &&
      Date.now() - stat.mtimeMs < CORRUPT_GRACE_MS &&
      Date.now() - stat.birthtimeMs < CORRUPT_GRACE_MS
    ) {
      return { state: 'empty' };
    }
    return { state: 'corrupt' };
  } catch (_) {
    return { state: 'empty' };
  }
}

// Resolves symlinks/junctions along `p`, treating any non-existing tail
// literally. path.resolve() never touches the filesystem, so a pre-existing
// symlink or Windows junction somewhere inside the plans directory (or a
// directorPlanPatterns location) could point outside the project and still
// pass a plain path.relative() containment check. This walks up to the
// deepest existing ancestor, realpaths *that*, and rejoins the (necessarily
// non-existing, since a plan-file write's target usually doesn't exist yet)
// tail literally. A realpath failure anywhere leaves the input path
// unchanged, which the containment check below then fails closed on.
// NOTE: this resolves symlinks/junctions, not hardlinks — a hardlink IS the
// target file under a second name, so no path resolution can distinguish it.
// See linkSafety() for that check.
function realish(p) {
  let cur = p;
  const tail = [];
  for (;;) {
    try {
      const real = fs.realpathSync(cur);
      return tail.length ? path.join(real, ...tail) : real;
    } catch (_) {
      const parent = path.dirname(cur);
      if (parent === cur) return p; // exhausted the path — no existing ancestor
      tail.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

// Stats of every file a hardlink must never be allowed to alias into a
// carve-out route: this guard script itself, the settings/manifest files
// that hold Director law and grants, CLAUDE.md, and everything already
// under .claude/hooks/. Computed fresh on each carve-out match (cheap —
// this only runs when a Write/Edit/MultiEdit already matched a plan/memory
// route, not on every tool call).
// `excludeRealPath` (item A5, red-team re-verification #2): when given, a
// candidate whose OWN realpath equals it is left out of the returned set.
// Without this, editing the project's OWN root CLAUDE.md via the memory
// carve-out compared its target against the CLAUDE.md protected-candidate
// entry — which is the exact same file, trivially matching {dev, ino} — and
// denied a completely legitimate edit as "hardlinked target". The nlink > 1
// check in linkSafety() is untouched and still catches a genuine alias.
function protectedFileStats(excludeRealPath) {
  const root = projectDir();
  const candidates = [
    __filename,
    path.join(root, '.claude', 'settings.json'),
    path.join(root, '.claude', 'settings.local.json'),
    path.join(root, '.claude', CONFIG_BASENAME),
    path.join(root, '.mcp.json'),
    path.join(root, 'CLAUDE.md'),
  ];
  try {
    const hooksDir = path.join(root, '.claude', 'hooks');
    for (const f of fs.readdirSync(hooksDir)) {
      candidates.push(path.join(hooksDir, f));
    }
  } catch (_) {
    /* no .claude/hooks — nothing more to add */
  }
  const stats = [];
  for (const c of candidates) {
    try {
      const st = fs.statSync(c);
      if (excludeRealPath) {
        try {
          if (fs.realpathSync(c) === excludeRealPath) continue; // this candidate IS the write's own target
        } catch (_) {
          /* realpath failed even though stat succeeded — fall through, still protect it */
        }
      }
      stats.push({ dev: st.dev, ino: st.ino });
    } catch (_) {
      /* doesn't exist — nothing to protect */
    }
  }
  return stats;
}

// The hardlink defense shared by both remaining carve-outs (plan/memory).
// `realPath` must already be symlink/junction-resolved (realish()) and have
// passed its route's containment check. Two independent tests:
//   - nlink > 1: the target already exists with more than one hard link —
//     refused regardless of what it's linked to, since a legitimate
//     Director-authored plan/memory file is never pre-linked;
//   - {dev, ino} match against protectedFileStats(realPath), which excludes
//     realPath's own identity (item A5): catches the case even if nlink
//     reporting is unavailable/unreliable for some reason, without
//     self-matching a legitimate edit of the protected file itself (e.g.
//     the project's own root CLAUDE.md via the memory carve-out).
// A target that doesn't exist yet (the common case — most writes create a
// new file) is safe: there is nothing to have hardlinked.
function linkSafety(realPath) {
  try {
    const st = fs.statSync(realPath);
    if (st.nlink > 1) return { safe: false };
    const protectedSet = protectedFileStats(realPath);
    for (const p of protectedSet) {
      if (p.dev === st.dev && p.ino === st.ino) return { safe: false };
    }
    return { safe: true };
  } catch (_) {
    return { safe: true }; // doesn't exist yet — nothing to protect
  }
}

// NotebookEdit names its target under `notebook_path`, not `file_path` —
// every other PAUSE_WRITE_TOOLS member uses `file_path`.
function pauseWriteTargetPath(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;
  const field = toolName === 'NotebookEdit' ? 'notebook_path' : 'file_path';
  const v = toolInput[field];
  return typeof v === 'string' && v !== '' ? v : null;
}

// Self-pause write detector (item 1, CRITICAL fix — replaces the old
// classifyPauseOperation() carve-out entirely). No tool call may create or
// edit .claude/orchestra.pause anymore: the pause switch is out-of-band
// only (env var, or the user creating the file directly). A write whose
// target resolves to that exact path — OR is nested UNDER it, treating the
// pause path as a directory (item A1, red-team re-verification #2: `Write
// .claude/orchestra.pause/CLAUDE.md` matched the memory carve-out, and the
// Write tool creating the parent directory made a bare existsSync() check
// see "a pause file" that was really an attacker-created directory) — is
// flagged for denial here, unconditionally, before any model-dormancy
// check and before either remaining carve-out (plan/memory) is even
// consulted, since this is an absolute rule about the path, not part of
// Director law. linkSafety() is deliberately NOT consulted here: there is
// no more "allow" outcome on this route to protect, so calling it would be
// the same dead code the red team flagged against the old allow-carve-out.
// Returns 'none' | 'deny'.
function classifyPauseWrite(toolName, toolInput) {
  if (!PAUSE_WRITE_TOOLS.has(toolName)) return 'none';
  const targetPath = pauseWriteTargetPath(toolName, toolInput);
  if (targetPath === null) return 'none';
  const root = projectDir();
  const resolved = path.resolve(root, targetPath);
  const wantPath = path.join(root, '.claude', PAUSE_BASENAME);
  const realResolved = realish(resolved);
  const realWant = realish(wantPath);
  if (realResolved === realWant) return 'deny';
  // Nested under the pause path, treating it as a directory: containment
  // check on the REAL (symlink/junction-resolved) paths, same discipline
  // as the plan/memory carve-outs use.
  const rel = path.relative(realWant, realResolved);
  if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)) return 'deny';
  return 'none';
}

// Pause-file validity (item 1b, MAJOR fix round 3A — closes review #3's
// finding at guard:1303). The pause-exists short-circuit in main() must
// stand the guard down ONLY for a GENUINE pause file: one the user created
// directly, out-of-band. A hardlinked file at the pause path (e.g. the
// red team's `mklink /H .claude/orchestra.pause .claude/settings.json`) is
// the same file as whatever it's linked to under a second name — treating
// its mere existence as "the user paused this" would let that second name
// be edited (via the pause path itself, or the real name) with the guard
// standing down for everything else too. lstat (not stat) is used first so
// a symlink/junction at the exact pause path is detected as such rather
// than silently followed.
// Returns:
//   { state: 'absent' }             — nothing at the pause path.
//   { state: 'active' }             — a regular file, exactly one hard
//                                      link, not a symlink/junction: honour
//                                      it, stand the guard down.
//   { state: 'ignored', reason }    — something exists at the path but
//                                      isn't a genuine pause file; treated
//                                      the same as 'absent' for standing
//                                      down, but the reason is surfaced in
//                                      whatever denial follows (see
//                                      withManifestNote()).
function pauseFileStatus(root) {
  const wantPath = path.join(root, '.claude', PAUSE_BASENAME);
  let lst;
  try {
    lst = fs.lstatSync(wantPath);
  } catch (_) {
    return { state: 'absent' };
  }
  if (lst.isSymbolicLink()) return { state: 'ignored', reason: 'symlink or junction' };
  if (!lst.isFile()) return { state: 'ignored', reason: 'not a regular file' };
  if (lst.nlink > 1) return { state: 'ignored', reason: 'hardlinked (nlink > 1)' };
  return { state: 'active' };
}

// Plan-file carve-out (ORCHESTRA.md §4 PLAN): the Director may author plan
// files itself — markdown inside <project>/.claude/plans/ by default, plus
// any project-relative path matching directorPlanPatterns (globs — item 4).
// Containment is checked on the REAL (symlink-resolved) path so a
// pre-existing symlink/junction inside the plans dir cannot escape the
// project, and BOTH routes require a .md extension on the resolved path. A
// match that resolves to a link-unsafe target (linkSafety()) is refused,
// not silently downgraded to "not a plan file" — the caller gets a specific
// "hardlinked target" denial.
// Returns 'none' | 'allow' | 'hardlink'.
function classifyPlanOperation(toolName, toolInput, planPatterns) {
  if (!FILE_WRITE_TOOLS.has(toolName)) return 'none';
  if (!toolInput || typeof toolInput !== 'object') return 'none';
  if (typeof toolInput.file_path !== 'string' || toolInput.file_path === '') return 'none';
  const root = projectDir();
  const resolved = path.resolve(root, toolInput.file_path);

  const relToProject = path.relative(root, resolved);
  if (relToProject === '' || relToProject.startsWith('..') || path.isAbsolute(relToProject)) {
    return 'none'; // outside the project — never a plan file
  }
  if (!/\.md$/i.test(resolved)) return 'none'; // required on BOTH routes below

  const realRoot = realish(root);
  const realResolved = realish(resolved);
  const realRelToProject = path.relative(realRoot, realResolved);
  if (
    realRelToProject === '' ||
    realRelToProject.startsWith('..') ||
    path.isAbsolute(realRelToProject)
  ) {
    return 'none'; // a symlink/junction along the path escapes the project — deny
  }

  // Default carve-out: .claude/plans/**/*.md
  const plansRoot = path.join(root, '.claude', PLANS_DIRNAME);
  const realPlansRoot = realish(plansRoot);
  const relToPlans = path.relative(realPlansRoot, realResolved);
  const inPlansDir =
    relToPlans !== '' && !relToPlans.startsWith('..') && !path.isAbsolute(relToPlans);

  // Project-configured plan locations (globs over the forward-slash REAL
  // project-relative path — same containment guarantee as above).
  const posixRel = realRelToProject.split(path.sep).join('/');
  const matchesPattern = matchesAny(planPatterns, posixRel);

  if (!inPlansDir && !matchesPattern) return 'none';

  const safety = linkSafety(realResolved);
  return safety.safe ? 'allow' : 'hardlink';
}

// Predicted file content after the tool call, or null when the input can't be
// modeled. Mirrors the file tools' semantics: Write replaces wholesale; Edit
// replaces the first occurrence (all with replace_all); MultiEdit applies its
// edits in sequence. A no-match old_string is a no-op here — the real tool
// errors out without writing, so nothing needs protecting.
function simulateWrite(toolName, toolInput, pre) {
  if (toolName === 'Write') {
    return typeof toolInput.content === 'string' ? toolInput.content : null;
  }
  const applyOne = (text, e) => {
    if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') return null;
    if (e.old_string === '') return text;
    if (e.replace_all === true) return text.split(e.old_string).join(e.new_string);
    const idx = text.indexOf(e.old_string);
    if (idx === -1) return text;
    return text.slice(0, idx) + e.new_string + text.slice(idx + e.old_string.length);
  };
  if (toolName === 'Edit') return applyOne(pre, toolInput);
  if (toolName === 'MultiEdit') {
    if (!Array.isArray(toolInput.edits)) return null;
    let text = pre;
    for (const e of toolInput.edits) {
      text = applyOne(text, e);
      if (text === null) return null;
    }
    return text;
  }
  return null;
}

// The managed Orchestra block must ride through every memory edit verbatim.
// An unbalanced block (BEGIN without END — a hand-edited file) degrades to
// requiring the BEGIN marker itself to survive.
function markerBlockSurvives(pre, post) {
  const start = pre.indexOf(MARKER_BEGIN);
  if (start === -1) return true; // nothing managed in this file
  const endIdx = pre.indexOf(MARKER_END, start);
  if (endIdx === -1) return post.indexOf(MARKER_BEGIN) !== -1;
  const block = pre.slice(start, endIdx + MARKER_END.length);
  return post.indexOf(block) !== -1;
}

// Memory-file carve-out (ORCHESTRA.md §3.1): CLAUDE.md / CLAUDE.local.md
// anywhere inside the project, any project-relative path matching
// directorMemoryPatterns (globs — item 4), and — outside the project —
// user-level memory under Claude's config dir: its CLAUDE.md, or markdown
// inside a memory/memories directory (auto-memory). Routed through the same
// realish()+containment logic as the plan carve-out, and a .md extension is
// required on every route, including directorMemoryPatterns.
//
// Classifies a tool call against the memory exception:
//   'none'     — not a memory-file write; default law applies.
//   'allow'    — memory-file write that leaves any managed block intact.
//   'marker'   — memory-file write that would damage the managed block; deny
//                with the marker-specific message (still subject to model
//                dormancy, like every other denial).
//   'hardlink' — resolves to a link-unsafe target (linkSafety()); deny with
//                the "hardlinked target" reason regardless of model dormancy.
// Internal errors classify as 'none' — no exemption granted, default law and
// messaging apply, and the guard's global fail-open still backstops crashes.
function classifyMemoryOperation(toolName, toolInput, memoryPatterns) {
  try {
    if (!FILE_WRITE_TOOLS.has(toolName)) return 'none';
    if (!toolInput || typeof toolInput !== 'object') return 'none';
    if (typeof toolInput.file_path !== 'string' || toolInput.file_path === '') return 'none';
    const root = projectDir();
    const resolved = path.resolve(root, toolInput.file_path);

    const relToProject = path.relative(root, resolved);
    const rawInProject =
      relToProject !== '' && !relToProject.startsWith('..') && !path.isAbsolute(relToProject);

    let realTarget;

    if (rawInProject) {
      if (!/\.md$/i.test(resolved)) return 'none'; // required on every route now
      const realRoot = realish(root);
      const realResolved = realish(resolved);
      const realRel = path.relative(realRoot, realResolved);
      if (realRel === '' || realRel.startsWith('..') || path.isAbsolute(realRel)) return 'none';
      const basenameMatch = MEMORY_BASENAMES.has(path.basename(realResolved));
      const posixRel = realRel.split(path.sep).join('/');
      const patternMatch = matchesAny(memoryPatterns, posixRel);
      if (!basenameMatch && !patternMatch) return 'none';
      realTarget = realResolved;
    } else {
      const cfg = claudeConfigDir();
      if (cfg === '') return 'none';
      const realCfg = realish(cfg);
      const realResolved = realish(resolved);
      const relToCfg = path.relative(realCfg, realResolved);
      if (relToCfg === '' || relToCfg.startsWith('..') || path.isAbsolute(relToCfg)) return 'none';
      if (!/\.md$/i.test(realResolved)) return 'none';
      const segments = relToCfg.split(path.sep);
      const isBase = segments.length === 1 && MEMORY_BASENAMES.has(segments[0]);
      const inMemDir = segments.slice(0, -1).some((s) => s === 'memory' || s === 'memories');
      if (!isBase && !inMemDir) return 'none';
      realTarget = realResolved;
    }

    const safety = linkSafety(realTarget);
    if (!safety.safe) return 'hardlink';

    let pre;
    try {
      pre = fs.readFileSync(realTarget, 'utf8');
    } catch (_) {
      return 'allow'; // no existing file — nothing managed to protect
    }
    if (pre.indexOf(MARKER_BEGIN) === -1) return 'allow';
    const post = simulateWrite(toolName, toolInput, pre);
    if (post === null) return 'marker'; // unmodelable change to a managed file — protect it
    return markerBlockSurvives(pre, post) ? 'allow' : 'marker';
  } catch (_) {
    return 'none';
  }
}

function main(raw) {
  // Escape hatches (user-controlled). ORCHESTRA_PAUSE=1 is checked first,
  // independent of the (possibly unparseable) input payload, exactly as
  // before. The pause-FILE short-circuit used to run here too, before
  // parsing — but that let a pre-existing (or hardlinked) file at the pause
  // path short-circuit straight to allow() BEFORE classifyPauseWrite() ever
  // got a chance to deny a Write/Edit/MultiEdit targeting the pause path
  // itself (leg-3 fix round 3A, item 1a — review #3's finding at
  // guard:1303). It now runs further down, after the self-pause deny check,
  // once tool_name/tool_input are known — see below. Unparseable input
  // can't name the pause path either way, so it gets its own pause-file
  // check immediately below instead.
  if (process.env.ORCHESTRA_PAUSE === '1') return allow();

  let input;
  try {
    input = JSON.parse(raw);
  } catch (_) {
    // Unparseable PreToolUse payload — self-pause write detection needs a
    // parsed tool_name/tool_input and cannot apply here; a genuine
    // pre-existing pause file (item 1b — pauseFileStatus()) still stands
    // the guard down, same as always. Legacy then fails open (unchanged);
    // under roster:new this is the same undetermined-state asymmetry as
    // the model checks below, so it denies instead — see
    // denyMalformedInput().
    let status;
    try {
      status = pauseFileStatus(projectDir());
    } catch (_) {
      status = { state: 'absent' };
    }
    if (status.state === 'active') return allow();
    const policy = loadPolicy();
    if (status.state === 'ignored') policy.pauseIgnoredReason = status.reason;
    if (policy.roster === 'new') return denyMalformedInput(policy);
    return allow();
  }

  // Subagent calls are never restricted. Project-settings PreToolUse hooks
  // only fire for the main session in current Claude Code, but if this input
  // carries subagent identity (agent_id / agent_type), exempt it explicitly.
  if (input.agent_id || input.agent_type) return allow();

  const toolName = input.tool_name;
  if (typeof toolName !== 'string') return allow();

  const policy = loadPolicy();

  // Self-pause (item 1, MAJOR fix round 3A): absolute — checked before
  // every other carve-out, before model dormancy, and now (item 1a) before
  // the pause-exists short-circuit too, since the pause switch's whole
  // value is that it cannot be flipped by a tool call at all — not even
  // when a file already sits at that path (genuine pause file or not).
  if (classifyPauseWrite(toolName, input.tool_input) === 'deny') {
    return denySelfPause(toolName, policy);
  }

  // The pause-exists short-circuit itself, now second: only a GENUINE
  // pause file (item 1b — regular file, exactly one hard link, not a
  // symlink/junction; see pauseFileStatus()) stands the guard down for
  // every OTHER tool call. A hardlinked/linked file at the path is IGNORED
  // as a pause signal — the reason rides along on `policy` so whatever
  // denial follows can name it (see withManifestNote()).
  let pauseStatus;
  try {
    pauseStatus = pauseFileStatus(projectDir());
  } catch (_) {
    pauseStatus = { state: 'absent' };
  }
  if (pauseStatus.state === 'active') return allow();
  if (pauseStatus.state === 'ignored') policy.pauseIgnoredReason = pauseStatus.reason;

  // Tightening-key fail-closed (item 4): a malformed directorBlockedPatterns
  // entry means the guard cannot trust what it was told to add to the
  // blocklist, so every WRITE is denied — every tool in the standard
  // write/execution set (BLOCKED — this covers Write/Edit/MultiEdit, so it
  // already includes what would otherwise qualify for the plan/memory
  // carve-outs) — including any manifest loosening, until it's fixed. Tools
  // outside that set (Read, SlashCommand, an MCP tool name the broken
  // pattern might or might not have matched) are unaffected: they were
  // never part of "every write", and directorBlockedPatterns' only job is
  // adding restrictions on top of BLOCKED, never widening past it in a way
  // this guard can enforce without a valid pattern. Still gated by model
  // dormancy: a genuinely non-director session stands down exactly as it
  // always has.
  if (policy.blockedPatternsInvalid && BLOCKED.has(toolName)) {
    const t = latestMainModel(input);
    if (t.model) {
      if (!DIRECTOR_MODEL.test(t.model)) return allow();
      return denyBlockedPatternsInvalid(toolName, policy);
    }
    if (t.state === 'corrupt') return denyCorruptTranscript(toolName, policy);
    if (policy.roster !== 'new') return allow();
    return denyUndeterminedModel(toolName, policy);
  }

  // Exempt mutations: plan-file authorship (§4 PLAN — .claude/plans/*.md
  // plus any directorPlanPatterns matches) and memory-file authorship
  // (§3.1 — CLAUDE.md/CLAUDE.local.md, auto-memory, plus any
  // directorMemoryPatterns matches; marker block protected). Each can also
  // come back 'hardlink', which denies immediately regardless of model
  // dormancy — a pre-placed hardlink is a bypass of the carve-out itself,
  // not an ordinary Director action to weigh against the model.
  const planCheck = classifyPlanOperation(toolName, input.tool_input, policy.planPatterns);
  if (planCheck === 'allow') return allow();
  if (planCheck === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const memory = classifyMemoryOperation(toolName, input.tool_input, policy.memoryPatterns);
  if (memory === 'allow') return allow();
  if (memory === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const deniedByDefault = BLOCKED.has(toolName) && !policy.allowed.includes(toolName);
  const deniedByPolicy = matchesAny(policy.patterns, toolName);
  if (!deniedByDefault && !deniedByPolicy) return allow();

  // Model-aware dormancy (ORCHESTRA.md §1): only Opus/Fable direct. Enforce
  // only on positive evidence of a director model at the helm. Any other
  // model (Sonnet, Haiku) means the guard stands down so the session behaves
  // like plain Claude Code.
  const t = latestMainModel(input);

  if (t.model) {
    if (!DIRECTOR_MODEL.test(t.model)) return allow();
    if (memory === 'marker') return denyMarkerBlock(toolName, policy);
    return deniedByDefault ? denyDefault(toolName, policy) : denyByPolicy(toolName, policy);
  }

  if (t.state === 'corrupt') {
    // "No complete entry in what was read" — distinct from "no assistant
    // entry yet". Denies under BOTH rosters (see denyCorruptTranscript()).
    if (memory === 'marker') return denyMarkerBlock(toolName, policy);
    return denyCorruptTranscript(toolName, policy);
  }

  // t.state === 'empty': the classic undetermined-model staleness window
  // (no transcript, unreadable, no assistant turn flushed yet, or a
  // small/fresh corrupt-looking file — see latestMainModel()). Legacy's
  // stand-down case; roster:new denies instead (the file-header asymmetry).
  if (policy.roster !== 'new') return allow();
  if (memory === 'marker') return denyMarkerBlock(toolName, policy);
  return denyUndeterminedModel(toolName, policy);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch (_) {
    allow(); // never brick the session on a guard bug
  }
});
