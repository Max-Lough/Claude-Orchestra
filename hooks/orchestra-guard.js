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
 * ---------------------------------------------------------------- roster:new
 *
 * WO-14b leg 3R (oracle-ruled bounded rewrite, 2026-09-01) replaces the prior
 * pin/fingerprint-selected trust stack with a CLOSED regime:
 *
 *   - Mode selection is by HOOK INVOCATION ARGUMENT ONLY. `install.js
 *     --roster new` writes this script's PreToolUse entry as
 *     `node ".../orchestra-guard.js" --roster new`; a legacy install (or the
 *     legacy flip) writes the same entry with no argument. See
 *     rosterFromArgv() below — `.claude/orchestra.json`, pins, fingerprints,
 *     and transcript contents have NO ROLE in selecting the mode, ever.
 *   - Once selected, roster:new policy is STATIC: the fixed Director-law
 *     denial set (BLOCKED), the built-in plan/memory exceptions (with their
 *     containment/hardlink/marker protections, unchanged), an optional
 *     TIGHTENING-ONLY directorBlockedPatterns key, the explicit out-of-band
 *     user pause, and the separately registered ticket gate for Agent. The
 *     TOOL-loosening key (directorAllowedTools) is ignored outright under
 *     roster:new — a warning names it in the denial reason — no manifest
 *     field can unblock a tool for the Director, trusted-looking or not.
 *     The two PATH keys (directorPlanPatterns, directorMemoryPatterns) are
 *     honoured in both rosters (owner ruling 2026-09-02): they only widen
 *     which markdown files count as plan/memory files, under the same
 *     containment, .md, hardlink and managed-block protections.
 *   - The guard NEVER requires/executes project code. There is no seam that
 *     delegates to `.claude/orchestra/bridge/runtime.js` any more. Under
 *     roster:new, an Agent PreToolUse is handled by verifying the four gate
 *     hook entries (PreToolUse/PostToolUse matcher "Agent", SubagentStop,
 *     Stop — each with the EXACT installer command line) are registered in
 *     `.claude/settings.json`: missing or altered -> DENY ("gate not
 *     registered"); present -> ALLOW, so the host itself runs the registered
 *     ticket-gate hooks (a deny from either blocks the spawn). Nested spawns
 *     (input.agent_id present) -> DENY outright, before the registration
 *     check even runs. Legacy: this guard has never blocked Agent.
 *   - Transcript contents never stand roster:new down. Under roster:new,
 *     Director law is always active for a BLOCKED tool unless the user pause
 *     is active — latestMainModel() (the transcript reader) is never called
 *     on this path at all. Legacy keeps model-aware dormancy exactly as
 *     before, including the isSidechain === true (strict boolean) latch
 *     discount.
 *   - Pause is exclusively out-of-band (ORCHESTRA_PAUSE=1, or a genuine
 *     regular, single-hardlink, non-reparse-point file at
 *     `<project>/.claude/orchestra.pause`). The pause check runs FIRST in
 *     main(), before mode selection is even consulted for anything but the
 *     self-pause write deny, and before Agent handling — an active pause
 *     disables Director law and releases Agent too. See "Pause" below.
 *   - The manifest (`.claude/orchestra.json`) is still read, under both
 *     rosters, for `seats`/`rosterGeneration` (informational passthrough for
 *     the ticket gate) and for the TIGHTENING key `directorBlockedPatterns`
 *     (which the manifest may always add, in either roster — it can only
 *     restrict). Under legacy only, the three LOOSENING keys are also
 *     honoured directly: the manifest is an ordinary same-user project file,
 *     never a security boundary, so there is nothing left to gate loosening
 *     behind — see the "Manifest pin" note below for why that gate is gone.
 *   - The owner PIN (`~/.claude/orchestra/pins/...json` by default, override
 *     with ORCHESTRA_PIN_DIR) is now purely a TAMPER RECEIPT: if a pin
 *     exists but is corrupt, forged, or its recorded manifestSha256 no
 *     longer matches the manifest on disk, a warning line is appended to
 *     every denial reason this guard produces. A pin mismatch (or absence)
 *     never changes the roster, never changes which keys are honoured, and
 *     never denies anything by itself — it is a same-user file, exactly as
 *     honest about its limits as the README says: it raises the cost of a
 *     silent same-user tamper from "edit one file" to "also touch a second
 *     one outside the project," nothing more. See pinTamperNote().
 *
 * ------------------------------------------------------------------ legacy
 *
 * Model-aware: Director law binds only director models (ORCHESTRA.md §1).
 * Before denying (legacy only — see above), the guard reads the session
 * transcript and applies a LATCH: it scans every parseable non-sidechain
 * assistant entry in what it read, not just the last one. If ANY entry
 * anywhere names a director model (Opus/Fable), the session is enforced for
 * the rest of the read window regardless of what appears after it. Only when
 * NO director entry exists anywhere does the latest non-director model
 * (Sonnet, Haiku) stand the guard down. Undetermined (no assistant entry at
 * all) -> stand down: enforcement requires positive evidence of a director
 * model. An entry is discounted as a sidechain ONLY when isSidechain is the
 * strict boolean `true` — every other value (absent, false, "true", 1, ...)
 * counts as a main-session entry.
 *
 * Size: the transcript can grow past a sane whole-file-read size. Rather
 * than a blanket deny once it does, the guard reads a bounded TAIL (the last
 * TAIL_BYTES) plus a bounded HEAD (HEAD_BYTES) once the file exceeds
 * MAX_TRANSCRIPT_BYTES, and applies the same latch over head UNION tail — a
 * director entry in EITHER window still wins. A director entry older than
 * both windows is not seen by this read — documented, not papered over.
 *
 * A transcript (or read window) that has content but not one complete/
 * parseable JSONL entry is never "stand down": it denies (unless it also
 * qualifies for the small-and-fresh grace window — genuinely mid-first-
 * write, not garbage — gated on both mtime and birthtime).
 *
 * Malformed PreToolUse input (stdin that isn't parseable JSON) fails open
 * under legacy, unchanged; under roster:new it denies instead — see
 * denyMalformedInput().
 *
 * -------------------------------------------------------------------- pause
 *
 * The pause switch (.claude/orchestra.pause / ORCHESTRA_PAUSE=1) is
 * OUT-OF-BAND ONLY. There is no tool-call carve-out that creates or edits
 * the pause file. Any Write/Edit/MultiEdit/NotebookEdit whose target
 * resolves to (or nests beneath, treating it as a directory) exactly
 * `<project>/.claude/orchestra.pause` is DENIED (classifyPauseWrite() /
 * denySelfPause()), checked before every other carve-out and exemption,
 * including the subagent exemption and Agent handling. Windows spelling
 * aliases (case, NTFS ADS suffix, trailing dots/spaces) are normalised
 * before comparison so none of them dodge the deny.
 *
 * The pause-exists short-circuit itself only honours a GENUINE pause file: a
 * regular file with exactly one hard link, not a symlink/junction (see
 * pauseFileStatus()). A hardlinked or linked file at the pause path is
 * IGNORED as a pause signal — it neither stands the guard down nor (since
 * the deny above always wins) can any tool call ever create it. When an
 * ignored pause file is the reason the guard did NOT stand down, whatever
 * denial follows names that reason.
 *
 * ---------------------------------------------------------------- carve-outs
 *
 * Two write carve-outs remain (the pause file is not a third — see above):
 *   - plan files: Write/Edit/MultiEdit of markdown under .claude/plans/
 *     (ORCHESTRA.md §4 PLAN). Plans are Director thinking, not execution.
 *   - memory files: CLAUDE.md / CLAUDE.local.md anywhere in the project, plus
 *     user-level memory under Claude's config dir ($CLAUDE_CONFIG_DIR or
 *     ~/.claude): its CLAUDE.md and markdown inside memory/memories
 *     directories. One fence: an edit may never alter or remove the managed
 *     <!-- ORCHESTRA:BEGIN/END --> block in CLAUDE.md.
 *
 * Both share the same hardening, applied to the REAL (symlink/junction-
 * resolved) target path: containment inside the project (or, for memory,
 * inside Claude's config dir) — an unresolved reparse point along the way
 * never escapes it; and link safety — a target that already exists with
 * more than one hard link, or whose {dev, ino} matches a protected harness/
 * config file (this guard, settings.json, settings.local.json,
 * orchestra.json, .mcp.json, CLAUDE.md, anything under .claude/hooks/), is
 * denied ("hardlinked target") regardless of which carve-out matched.
 *
 * Optional per-project policy — .claude/orchestra.json:
 *   {
 *     "directorBlockedPatterns": ["mcp__blender__*", "mcp__godot__*"],
 *     "directorAllowedTools": ["Glob"],
 *     "directorPlanPatterns": ["docs/plans/**\/*.md"],
 *     "directorMemoryPatterns": [".claude/rules/**\/*.md"]
 *   }
 * All three pattern keys are GLOBS, not regexes — `*` matches within one
 * path segment; `**` crosses segments — matched through a non-backtracking
 * token-DP matcher (compileGlob()/globMatch()), so no crafted pattern or
 * path can hang it. A pattern SHAPED LIKE A REGEX is REJECTED at load time
 * (isRegexShaped()): starting with `^`, ending with `$`, or containing any
 * of `( ) | + \ { }`.
 *   directorBlockedPatterns: globs tested against tool NAMES; matches are
 *     denied to the Director. A TIGHTENING key — honoured in BOTH rosters,
 *     unconditionally (it can only add restrictions). A REJECTED entry fails
 *     the whole guard CLOSED for every tool in BLOCKED until fixed or
 *     removed — see denyBlockedPatternsInvalid().
 *   directorAllowedTools: TOOL-loosening key. Honoured under LEGACY only,
 *     directly from the manifest (no pin/trust gate any more — the manifest
 *     was never a security boundary against same-user code); roster:new
 *     ignores it regardless of manifest state.
 *   directorPlanPatterns / directorMemoryPatterns: PATH keys, honoured in
 *     BOTH rosters. They add markdown locations to the built-in plan/memory
 *     carve-outs; a match still passes every protection above.
 *
 * ---------------------------------------------------------------- pin note
 *
 * `.claude/orchestra.json` lives inside the project and is not, by itself, a
 * trust boundary — anything that can write into the project can rewrite it.
 * That was always true; what changed in this rewrite is that the guard no
 * longer pretends a same-user pin outside the project turns the manifest
 * into a security boundary either (an owner pin was never a boundary
 * against same-user code — the README always said so). So the pin is kept
 * for exactly one purpose now: tamper EVIDENCE. If a pin exists (found by
 * project path, project id, or git root commit — see loadPin()) but is
 * corrupt, forged, or its recorded manifestSha256 no longer matches the
 * bytes on disk, pinTamperNote() appends a short warning to every denial
 * this guard produces. It never changes roster, never changes which policy
 * keys are honoured, and by itself never causes a denial — the fixed
 * roster:new policy already denies everything a loosened manifest would
 * have allowed, argv-selected mode is immune to manifest/pin tampering by
 * construction, and legacy was never gated on the pin's trust either.
 *
 * PIN_DIR = $ORCHESTRA_PIN_DIR || ~/.claude/orchestra/pins (honoured only if
 * this directory actually exists). Lookup order: path key, then id key
 * (a project that has moved since it was pinned), then git-root key (a
 * project that has moved AND had its manifest replaced, so projectId is no
 * longer readable from it either) — see loadPin() for the full shape.
 *
 * Fail-open by design for anything not covered above: any unexpected input,
 * config error, or internal error allows the call rather than bricking the
 * session. A broken orchestra.json disables only itself — the default
 * blocklist still applies.
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
// ("us.anthropic.claude-opus-...") forms. Legacy path only — see file header.
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

// Tools the self-pause write detector watches — a NotebookEdit whose
// notebook_path resolves to the pause path is covered too, even though the
// plan/memory carve-outs stay scoped to Write/Edit/MultiEdit (a .md
// extension requirement excludes .ipynb anyway).
const PAUSE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

// Transcript reading (latestMainModel(), legacy only — see file header):
// read the whole file rather than a fixed-size tail, up to this cap. Session
// transcripts are bounded by conversation length, not by attacker input, so
// a full read is cheap in the overwhelmingly common case. Past this size,
// read a bounded TAIL instead of denying outright — see TAIL_BYTES.
const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;

// Bounded tail size once a transcript exceeds MAX_TRANSCRIPT_BYTES.
const TAIL_BYTES = 8 * 1024 * 1024;

// Bounded HEAD window read alongside the tail once a transcript exceeds
// MAX_TRANSCRIPT_BYTES. The latch applies over head UNION tail (see
// latestMainModel()): a director entry in EITHER window still wins.
const HEAD_BYTES = 2 * 1024 * 1024;

// Legacy corrupt-state regression grace window: a transcript this small AND
// this recently CREATED AND MODIFIED is treated as "mid first write", not
// garbage, when it has content but zero parseable entries.
const CORRUPT_GRACE_BYTES = 64 * 1024;
const CORRUPT_GRACE_MS = 10 * 1000;

// Regex safety (loadPolicy()/toGlobs()) — retained as a glob-length cap; the
// DP matcher below has no backtracking hazard, but an absurdly long pattern
// is still not a config authors have any legitimate reason to write.
const MAX_PATTERN_LEN = 200;

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

// Directory the installer writes owner pins into (see the file-header "pin
// note" note). Outside the project on purpose.
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

// ------------------------------------------------------------ mode selection
//
// WO-14b leg 3R: the ONLY thing that selects roster:new is this script's own
// invocation argument, written by install.js (`--roster new` on a
// roster:new install; no argument on legacy). `.claude/orchestra.json`, the
// pin, on-disk fingerprints, and transcript contents have no say in this —
// they cannot, by construction: this reads only process.argv, before any
// file is touched.
function rosterFromArgv() {
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--roster' && argv[i + 1] === 'new') return 'new';
  }
  return 'legacy';
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

// Appends the pin-tamper note (see file-header "pin note"), the "pause file
// ignored as a pause signal" note, and the "roster:new ignored a loosening
// key" note to a denial message. Independent flags, any combination may
// apply at once.
function withNote(msg, policy) {
  let out = msg;
  if (policy && policy.pinNote) {
    out += ' [' + policy.pinNote + ']';
  }
  if (policy && policy.pauseIgnoredReason) {
    out +=
      ' [a file exists at .claude/' + PAUSE_BASENAME + ' but was not honoured as a pause ' +
      'signal: ' + policy.pauseIgnoredReason + ']';
  }
  if (policy && policy.ignoredLoosening && policy.ignoredLoosening.length) {
    out +=
      ' [.claude/' + CONFIG_BASENAME + ' sets ' + policy.ignoredLoosening.join(', ') +
      ', but roster:new ignores the tool-loosening key regardless of manifest or pin state]';
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
    withNote(
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

// A transcript (or the tail window read of one) that has content but not one
// complete/parseable JSONL entry (see latestMainModel()) is never treated as
// "stand down" unless it also qualifies for the small-and-fresh grace
// window. Legacy path only — under roster:new, latestMainModel() is never
// consulted (see the file header): a BLOCKED tool call there denies
// unconditionally, never reaching this function.
function denyCorruptTranscript(toolName, policy) {
  deny(
    withNote(
      'Orchestra: the session transcript exists but contains no complete, parseable entry — ' +
        'distinct from simply having no assistant turn yet. That state denies ' + toolName +
        ' under the legacy roster rather than standing down, since a transcript that cannot be ' +
        'read is not positive evidence of anything. (User-only pause switch, out-of-band only: ' +
        '.claude/' + PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

// roster:new only: an unparseable PreToolUse payload fails closed — legacy
// still fails open (unchanged) on the same input, since legacy has no fixed
// policy to fall back to and never has.
function denyMalformedInput(policy) {
  deny(
    withNote(
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
    withNote(
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
    withNote(
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
    withNote(
      'Orchestra: ' + toolName + ' targets a path that already exists as a hardlink (or the ' +
        'same file, by device+inode) to a protected harness/config file — reason: hardlinked ' +
        'target. A realpath check alone cannot catch this: a hardlink IS the target file under ' +
        'a second name. Delegate this write to the executor instead. (User-only pause switch, ' +
        'out-of-band only: .claude/' + PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

// Self-pause deny: no tool call may create or edit the pause file itself.
// See classifyPauseWrite().
function denySelfPause(toolName, policy) {
  deny(
    withNote(
      'Orchestra: ' + toolName + ' may not create or edit .claude/' + PAUSE_BASENAME + ' — a ' +
        'tool call can no longer flip the pause switch. Pause out-of-band instead: set ' +
        'ORCHESTRA_PAUSE=1 in the environment, or have the user create .claude/' +
        PAUSE_BASENAME + ' directly, outside the tool loop.',
      policy
    )
  );
}

// Tightening-key fail-closed: a directorBlockedPatterns entry that was
// rejected at load time (see compileGlobsTightening()) means the guard
// cannot trust what the manifest wanted to add to the blocklist. Rather than
// silently drop the bad entry (the LOOSENING-key convention), the whole
// guard fails closed until it's fixed: every write is denied, including the
// plan/memory carve-outs. Honoured identically under both rosters — this key
// is never gated by trust or roster.
function denyBlockedPatternsInvalid(toolName, policy) {
  deny(
    withNote(
      'Orchestra: .claude/' + CONFIG_BASENAME + '\'s directorBlockedPatterns contains an ' +
        'entry that was rejected at load (shaped like a regex, not a glob — see the guard\'s ' +
        'glob-only pattern rule: no leading ^, no trailing $, none of ( ) | + \\ { }). ' +
        'directorBlockedPatterns is a TIGHTENING key, so a broken entry fails the guard ' +
        'CLOSED rather than dropping itself: every write is denied — including plan/memory ' +
        'carve-outs — until the pattern is fixed or removed. (User-only pause switch, ' +
        'out-of-band only: ORCHESTRA_PAUSE=1 or a pre-existing .claude/' + PAUSE_BASENAME +
        ' file.)',
      policy
    )
  );
}

// roster:new only: the four ticket-gate hook entries this guard checked
// before letting Agent through are not fully present (or were altered) in
// .claude/settings.json. See verifyGateHooksRegistered().
function denyGateNotRegistered(reason, policy) {
  deny(
    withNote(
      'Orchestra: this project runs roster:new, but the separately registered ticket-gate ' +
        'hooks are not fully present in .claude/settings.json (' + reason + '). Fail closed ' +
        'rather than allow an ungated Agent spawn — reinstall with `node install.js <project> ' +
        '--roster new` to restore them.',
      policy
    )
  );
}

// roster:new only: a nested spawn (a subagent's own PreToolUse for Agent —
// input.agent_id is present) is denied outright, before the gate-hook
// registration check even runs — no ticket authorizes a nested spawn.
function denyNestedSpawn(policy) {
  deny(
    withNote(
      'Orchestra: this project runs roster:new — nested Agent spawns (a subagent spawning ' +
        'another Agent) are denied outright by this guard.',
      policy
    )
  );
}

// ------------------------------------------------------------- glob engine
//
// Non-backtracking glob matcher, copied from verifier/checkout.js's
// classification-pattern matcher: `**` crosses path separators, `*` does
// not; text is matched in full (implicitly anchored both ends). Patterns
// are token-compiled once (cached) and matched with a linear dynamic
// program over tokens × characters — no backtracking to detonate, whatever
// an agent-editable pattern source feeds it.

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
const LINE_TERMINATORS = new Set(['\n', '\r', ' ', ' ']);
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
// of the regex-only metacharacters ( ) | + \ { } appearing anywhere.
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

// Array-length cap on every pattern key: an oversized array (e.g. 100k
// entries) is rejected WITHOUT compiling a single glob — the check is on the
// RAW array length, before even filtering to strings, so it returns in O(1)
// regardless of what the array holds.
const MAX_PATTERN_ARRAY_LEN = 64;

// LOOSENING-key compilation (directorPlanPatterns / directorMemoryPatterns,
// legacy only): a rejected entry silently drops itself — a bad entry loses
// only itself, never the whole policy. An oversized array drops ENTIRELY —
// not just its excess entries.
function compileGlobsLoosening(arr) {
  if (Array.isArray(arr) && arr.length > MAX_PATTERN_ARRAY_LEN) return [];
  return arrOfStrings(arr)
    .filter((s) => isPatternSafe(s))
    .map((s) => compileGlob(s));
}

// TIGHTENING-key compilation (directorBlockedPatterns, both rosters):
// callers also need to know whether ANY entry was rejected, because a
// rejected entry here fails the whole guard closed (see
// denyBlockedPatternsInvalid()) rather than dropping silently. An oversized
// array is `invalid` the same way a single malformed entry is.
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

// ------------------------------------------------------------- manifest pin
//
// See the file-header "pin note" section: the pin is TAMPER EVIDENCE only,
// never activation authority and never a trust gate for policy any more.
// The lookup machinery below (three keys, strict schema) is unchanged from
// the pre-rewrite guard; what changed is how loadPolicy() USES the result —
// see pinTamperNote().

// Third pin lookup key: the project's git root commit, for a project that
// has both moved AND had its manifest replaced (so projectId — the id-key's
// source — is no longer readable from it either). rootCommitHash = the
// FIRST line of `git rev-list --max-parents=0 HEAD`, run with cwd = the
// project. ANY failure (no git repo, git not on PATH, timeout, non-zero
// exit) simply skips this key: it returns null rather than throwing.
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

// Strict pin schema — a pin file that parses as an object is valid only if
// EVERY field below is well-shaped — anything less (missing, wrong type, or
// the wrong shape) is INVALID, same as a corrupt/forged pin, never silently
// accepted because it happens to carry a recognized `roster`.
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

// Resolves the owner pin for this project — a discriminated result so
// pinTamperNote() can tell "no pin anywhere" apart from "a pin file exists
// but is corrupt, forged, or schema-invalid".
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
  // ORCHESTRA_PIN_DIR (or the default) pointing at a nonexistent directory
  // is "no pin dir" — same as none configured, not an error.
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
    manifestSha256: obj.manifestSha256,
  };
  // Forged-pin check: when found by the PATH key, the pin's own projectDir
  // must agree with the path that produced the hash — a mismatch means the
  // pin file's *contents* were tampered with independent of its filename.
  // Found-by-ID/git pins are exempt (that disagreement IS the moved-project
  // case).
  if (foundBy === 'path' && pin.projectDir !== real) {
    return { found: true, valid: false, reason: 'pin projectDir does not match this project' };
  }
  return { found: true, valid: true, foundBy, pin };
}

// Tamper-receipt note (see file-header "pin note"): summarizes the pin's
// relationship to the manifest currently on disk as a short string, or ''
// when there is nothing to warn about (no pin dir/no pin file at all is NOT
// a warning — an unpinned project is an ordinary, expected state, not
// evidence of tampering). Never affects roster or which policy keys apply.
function pinTamperNote(real, cfg, manifestBytes) {
  try {
    const pinResult = loadPin(real, cfg);
    if (!pinResult.found) return '';
    if (!pinResult.valid) {
      return 'pin present but ' + pinResult.reason;
    }
    const pin = pinResult.pin;
    const moved =
      (pinResult.foundBy === 'id' || pinResult.foundBy === 'git') && pin.projectDir !== real;
    const trusted =
      manifestBytes !== null &&
      typeof pin.manifestSha256 === 'string' &&
      crypto.createHash('sha256').update(manifestBytes).digest('hex') === pin.manifestSha256;
    if (!trusted) {
      return 'pin does not match the manifest on disk now (manifest tampered, replaced, or missing since the pin was written)';
    }
    if (moved) return 'project moved since pinning';
    return '';
  } catch (_) {
    return '';
  }
}

// --------------------------------------------------------------- policy
//
// Per-project policy for the given (argv-selected) roster. Any unexpected
// error anywhere in here returns the fully-empty policy for that roster —
// the default blocklist above is never weakened by a broken manifest.
function loadPolicy(roster) {
  const empty = {
    patterns: [],
    blockedPatternsInvalid: false,
    allowed: [],
    planPatterns: [],
    planPatternsRaw: [],
    memoryPatterns: [],
    roster: roster,
    seats: null,
    rosterGeneration: null,
    pinNote: '',
    ignoredLoosening: [],
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
    if (manifestBytes !== null) {
      try {
        const parsed = JSON.parse(manifestBytes.toString('utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          cfg = parsed;
        }
      } catch (_) {
        /* manifestError not tracked here — the pin note covers "manifest untrusted" */
      }
    }

    // Tightening key — honoured in BOTH rosters, unconditionally.
    const g = compileGlobsTightening(cfg ? cfg.directorBlockedPatterns : null);

    const out = Object.assign({}, empty, {
      patterns: g.patterns,
      blockedPatternsInvalid: g.invalid,
      seats: cfg ? objOrNull(cfg.seats) : null,
      rosterGeneration: cfg && typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : null,
    });

    if (roster === 'legacy') {
      // Loosening keys honoured directly from the manifest — no pin/trust
      // gate any more: the manifest is an ordinary same-user project file,
      // never a security boundary, so gating it behind a same-user pin
      // bought nothing real to begin with.
      out.allowed = cfg ? arrOfStrings(cfg.directorAllowedTools) : [];
      const rawPlanPatterns =
        cfg && Array.isArray(cfg.directorPlanPatterns) && cfg.directorPlanPatterns.length <= MAX_PATTERN_ARRAY_LEN
          ? arrOfStrings(cfg.directorPlanPatterns)
          : [];
      out.planPatternsRaw = rawPlanPatterns;
      out.planPatterns = cfg ? compileGlobsLoosening(cfg.directorPlanPatterns) : [];
      out.memoryPatterns = cfg ? compileGlobsLoosening(cfg.directorMemoryPatterns) : [];
    } else {
      // roster:new: static TOOL policy. directorAllowedTools is ignored
      // outright, no matter what the manifest or pin say — named so the
      // denial can warn about it. The two PATH keys (directorPlanPatterns /
      // directorMemoryPatterns) are honoured exactly as under legacy
      // (owner ruling 2026-09-02, shakedown: a project's status/plan file
      // outside .claude/plans/ is Director thinking, and routing every edit
      // of it through a builder ticket is cost without gain). They widen
      // only WHICH markdown files count as plans/memory; every containment,
      // .md, hardlink and managed-block protection still applies to a match.
      const ignored = [];
      if (cfg && cfg.directorAllowedTools !== undefined) ignored.push('directorAllowedTools');
      out.ignoredLoosening = ignored;
      const rawPlanPatterns =
        cfg && Array.isArray(cfg.directorPlanPatterns) && cfg.directorPlanPatterns.length <= MAX_PATTERN_ARRAY_LEN
          ? arrOfStrings(cfg.directorPlanPatterns)
          : [];
      out.planPatternsRaw = rawPlanPatterns;
      out.planPatterns = cfg ? compileGlobsLoosening(cfg.directorPlanPatterns) : [];
      out.memoryPatterns = cfg ? compileGlobsLoosening(cfg.directorMemoryPatterns) : [];
    }

    out.pinNote = pinTamperNote(real, cfg, manifestBytes);
    return out;
  } catch (_) {
    return Object.assign({}, empty);
  }
}

// --------------------------------------------------------------- transcript
//
// Legacy path only (see file header): under roster:new, this function is
// never called — Director law is always active for a BLOCKED tool call
// unless the user pause is active.
//
// Latest main-session assistant model from the session transcript, with the
// director-latch applied. Reads the WHOLE file up to MAX_TRANSCRIPT_BYTES;
// past that, reads a bounded TAIL_BYTES window from the end instead of
// denying outright. Scans every line in what it read (not just until the
// first hit): if ANY non-sidechain assistant entry names a director model,
// that wins over every other entry in the window, including ones that
// appear after it.
//
// Returns one of:
//   { model: string }    — positive evidence of a session model (a director
//                          model always wins if one appears anywhere in the
//                          window; otherwise the latest non-director model).
//   { state: 'empty' }   — no transcript_path, missing/unreadable file, an
//                          empty file, a file with only non-assistant
//                          entries, OR a corrupt-looking file that is small
//                          and was modified in the last CORRUPT_GRACE_MS
//                          (genuinely mid-first-write, not garbage).
//   { state: 'corrupt' } — content but not one complete, parseable JSONL
//                          entry anywhere in what was read, and it does not
//                          qualify for the grace window above.
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
      // An entry is discounted as a sidechain ONLY when isSidechain is the
      // STRICT boolean `true` — every other value (false, "true", "false",
      // 1, [], {}, or anything else) counts as a main-session entry, same
      // as if the key were absent.
      if (entry && entry.type === 'assistant' && entry.isSidechain !== true) {
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
    // Legacy regression fix: a transcript genuinely mid-first-write is
    // small and was just touched — treat that shape as 'empty' (stand
    // down). Gated on birthtimeMs as well as mtimeMs: an EXISTING
    // transcript truncated to garbage gets a fresh mtime from the
    // truncation but keeps its original birth time, so mtime alone would
    // let a truncation-bypass through the grace window.
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
// `excludeRealPath`: when given, a candidate whose OWN realpath equals it is
// left out of the returned set. Without this, editing the project's OWN
// root CLAUDE.md via the memory carve-out compared its target against the
// CLAUDE.md protected-candidate entry — which is the exact same file,
// trivially matching {dev, ino} — and denied a completely legitimate edit
// as "hardlinked target". The nlink > 1 check in linkSafety() is untouched
// and still catches a genuine alias.
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
//     realPath's own identity: catches the case even if nlink reporting is
//     unavailable/unreliable for some reason, without self-matching a
//     legitimate edit of the protected file itself (e.g. the project's own
//     root CLAUDE.md via the memory carve-out).
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

// Self-pause write detector. No tool call may create or edit
// .claude/orchestra.pause: the pause switch is out-of-band only (env var,
// or the user creating the file directly). A write whose target resolves to
// that exact path — OR is nested UNDER it, treating the pause path as a
// directory — is flagged for denial here, unconditionally, before any
// model-dormancy check and before either remaining carve-out (plan/memory)
// is even consulted, since this is an absolute rule about the path, not
// part of Director law. linkSafety() is deliberately NOT consulted here:
// there is no more "allow" outcome on this route to protect.
// Returns 'none' | 'deny'.
//
// Windows offers several ways to SPELL the same on-disk name that a plain
// path-string comparison does not treat as equal — the filesystem is
// case-insensitive by default (ORCHESTRA.PAUSE opens the same entry as
// orchestra.pause), a trailing `:<stream>` on a component names an NTFS
// Alternate Data Stream ON that same file/directory (`orchestra.pause:note.md`
// is a stream attached to `orchestra.pause`, not a sibling name), and Win32
// silently strips trailing dots and spaces off a component before it ever
// reaches the filesystem (`orchestra.pause.` and `orchestra.pause ` both
// resolve to `orchestra.pause`). Normalises the FIRST path component after
// `.claude/` the same way Windows itself would before comparing it to
// PAUSE_BASENAME.
function normalizePauseComponent(name) {
  let s = name;
  const colon = s.indexOf(':');
  if (colon !== -1) s = s.slice(0, colon); // strip an NTFS ADS suffix
  s = s.replace(/[. ]+$/, ''); // Win32 strips trailing dots/spaces off a component
  if (process.platform === 'win32') s = s.toLowerCase(); // case-insensitive filesystem
  return s;
}

function classifyPauseWrite(toolName, toolInput) {
  if (!PAUSE_WRITE_TOOLS.has(toolName)) return 'none';
  const targetPath = pauseWriteTargetPath(toolName, toolInput);
  if (targetPath === null) return 'none';
  const root = projectDir();
  const resolved = path.resolve(root, targetPath);
  const dotClaude = path.join(root, '.claude');
  const realResolved = realish(resolved);
  const realDotClaude = realish(dotClaude);
  const rel = path.relative(realDotClaude, realResolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return 'none'; // not under .claude/ at all
  // The pause write itself (exact path) and anything NESTED under it
  // (treating it as a directory) are the same check now: both share the
  // same first component past .claude/.
  const firstComponent = rel.split(/[\\/]/)[0];
  const normalized = normalizePauseComponent(firstComponent);
  const wantNormalized = normalizePauseComponent(PAUSE_BASENAME);
  if (normalized === wantNormalized) return 'deny';
  return 'none';
}

// Pause-file validity. The pause-exists short-circuit in main() must stand
// the guard down ONLY for a GENUINE pause file: one the user created
// directly, out-of-band. A hardlinked file at the pause path (e.g.
// `mklink /H .claude/orchestra.pause .claude/settings.json`) is the same
// file as whatever it's linked to under a second name — treating its mere
// existence as "the user paused this" would let that second name be edited
// (via the pause path itself, or the real name) with the guard standing
// down for everything else too. lstat (not stat) is used first so a
// symlink/junction at the exact pause path is detected as such rather than
// silently followed.
// Returns:
//   { state: 'absent' }             — nothing at the pause path.
//   { state: 'active' }             — a regular file, exactly one hard
//                                      link, not a symlink/junction: honour
//                                      it, stand the guard down.
//   { state: 'ignored', reason }    — something exists at the path but
//                                      isn't a genuine pause file; treated
//                                      the same as 'absent' for standing
//                                      down, but the reason is surfaced in
//                                      whatever denial follows.
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
// any project-relative path matching directorPlanPatterns (both rosters —
// see loadPolicy()). Containment is checked on the REAL (symlink-
// resolved) path so a pre-existing symlink/junction inside the plans dir
// cannot escape the project, and BOTH routes require a .md extension on the
// resolved path. A match that resolves to a link-unsafe target
// (linkSafety()) is refused, not silently downgraded to "not a plan file".
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

  // Project-configured plan locations (directorPlanPatterns, both rosters —
  // see loadPolicy()). Globs over the forward-slash REAL project-relative
  // path — same containment guarantee as above.
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
// anywhere inside the project, (legacy only) any project-relative path
// matching directorMemoryPatterns, and — outside the project — user-level
// memory under Claude's config dir: its CLAUDE.md, or markdown inside a
// memory/memories directory (auto-memory). Routed through the same
// realish()+containment logic as the plan carve-out, and a .md extension is
// required on every route, including directorMemoryPatterns.
//
// Classifies a tool call against the memory exception:
//   'none'     — not a memory-file write; default law applies.
//   'allow'    — memory-file write that leaves any managed block intact.
//   'marker'   — memory-file write that would damage the managed block; deny
//                with the marker-specific message.
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

// -------------------------------------------------------------- Agent (new)
//
// roster:new only. Verifies the four ticket-gate hook entries (installed by
// install.js under --roster new — see its gateHookEntry()) are registered,
// with the EXACT command line the installer writes, in
// .claude/settings.json: PreToolUse/PostToolUse matcher "Agent", plus
// SubagentStop and Stop (no matcher concept for non-tool events). Reads
// settings.json fresh off disk on every Agent call — this is intentionally
// not cached, since a stripped or altered entry must be caught the very
// next time Agent is called, not only at install time.
const GATE_HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'SubagentStop', 'Stop'];
// The one script every registered entry runs. PL-9 (shakedown finding #2,
// 2026-09-01): registration alone is not enough — with the script file
// swept away (a `git stash -u` took the untracked .claude/orchestra/), the
// host reported each gate hook as a NON-BLOCKING error (node
// MODULE_NOT_FOUND, exit 1) and the Agent launch proceeded unticketed. So
// the guard also requires the script to exist on disk, and denies when it
// does not: a registered-but-missing gate is the composition failing open.
const GATE_SCRIPT_REL = ['.claude', 'orchestra', 'bridge', 'hooks', 'ticket-gate.js'];
function expectedGateCommand(eventName) {
  return 'node "$CLAUDE_PROJECT_DIR/.claude/orchestra/bridge/hooks/ticket-gate.js" ' + eventName;
}
function verifyGateHooksRegistered() {
  const settingsPath = path.join(projectDir(), '.claude', 'settings.json');
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: '.claude/settings.json missing or unreadable (' + (e && e.message ? e.message : String(e)) + ')' };
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) || !settings.hooks || typeof settings.hooks !== 'object') {
    return { ok: false, reason: 'no hooks registered in .claude/settings.json' };
  }
  for (const eventName of GATE_HOOK_EVENTS) {
    const list = settings.hooks[eventName];
    if (!Array.isArray(list)) {
      return { ok: false, reason: eventName + ' hook entry missing' };
    }
    const expectedCmd = expectedGateCommand(eventName);
    const requiresMatcher = eventName === 'PreToolUse' || eventName === 'PostToolUse';
    const found = list.some((entry) => {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.hooks)) return false;
      if (requiresMatcher && entry.matcher !== 'Agent') return false;
      return entry.hooks.some((h) => h && typeof h.command === 'string' && h.command === expectedCmd);
    });
    if (!found) {
      return { ok: false, reason: eventName + ' hook entry missing or altered (expected command: ' + expectedCmd + ')' };
    }
  }
  // PL-9: the registered script must exist — a missing file is a non-blocking
  // hook error to the host (fail-open), so it is a deny here.
  const gateScript = path.join(projectDir(), ...GATE_SCRIPT_REL);
  if (!fs.existsSync(gateScript)) {
    return { ok: false, reason: 'registered gate script missing on disk (' + GATE_SCRIPT_REL.join('/') + ') — a missing script is a non-blocking hook error to the host, so Agent would launch unticketed' };
  }
  return { ok: true };
}

function main(raw) {
  // Escape hatches (user-controlled). ORCHESTRA_PAUSE=1 is checked first,
  // independent of the (possibly unparseable) input payload or the roster.
  if (process.env.ORCHESTRA_PAUSE === '1') return allow();

  let input;
  try {
    input = JSON.parse(raw);
  } catch (_) {
    // Unparseable PreToolUse payload — self-pause write detection needs a
    // parsed tool_name/tool_input and cannot apply here; a genuine
    // pre-existing pause file still stands the guard down, same as always.
    // Legacy then fails open (unchanged); roster:new denies instead — see
    // denyMalformedInput().
    let status;
    try {
      status = pauseFileStatus(projectDir());
    } catch (_) {
      status = { state: 'absent' };
    }
    if (status.state === 'active') return allow();
    const roster = rosterFromArgv();
    const policy = loadPolicy(roster);
    if (status.state === 'ignored') policy.pauseIgnoredReason = status.reason;
    if (roster === 'new') return denyMalformedInput(policy);
    return allow();
  }

  const toolName = input.tool_name;
  const roster = rosterFromArgv();
  const policy = loadPolicy(roster);

  // Self-pause: absolute — checked before EVERY other carve-out and
  // exemption, before the subagent exemption, before Agent handling, before
  // model dormancy. classifyPauseWrite() tolerates a non-string toolName
  // (Set.has() on anything just returns false), so this is safe to run
  // before the `typeof toolName !== 'string'` check further down too.
  if (classifyPauseWrite(toolName, input.tool_input) === 'deny') {
    return denySelfPause(toolName, policy);
  }

  // The pause-exists short-circuit itself, next: only a GENUINE pause file
  // (regular file, exactly one hard link, not a symlink/junction; see
  // pauseFileStatus()) stands the guard down. This runs ahead of BOTH the
  // subagent exemption and Agent handling below: a genuine user-created
  // pause file releases Agent too. A hardlinked/linked file at the path is
  // IGNORED as a pause signal — the reason rides along on `policy` so
  // whatever denial follows can name it.
  let pauseStatus;
  try {
    pauseStatus = pauseFileStatus(projectDir());
  } catch (_) {
    pauseStatus = { state: 'absent' };
  }
  if (pauseStatus.state === 'active') return allow();
  if (pauseStatus.state === 'ignored') policy.pauseIgnoredReason = pauseStatus.reason;

  // Subagent calls are never restricted for Director-law purposes. Project-
  // settings PreToolUse hooks only fire for the main session in current
  // Claude Code, but if this input carries subagent identity (agent_id /
  // agent_type), exempt it explicitly — EXCEPT for tool Agent under
  // roster:new: a subagent's own nested Agent call must still be denied
  // outright (see denyNestedSpawn()). Every other tool keeps the original
  // unconditional exemption.
  if ((input.agent_id || input.agent_type) && toolName !== 'Agent') return allow();

  if (typeof toolName !== 'string') return allow();

  // Agent handling. Legacy: unchanged — this guard has never blocked Agent.
  // roster:new: no project code is required or executed here. A nested
  // spawn denies outright; otherwise the guard verifies the four gate hook
  // entries are registered with the exact installer command line and, if
  // so, ALLOWs — the host then runs the registered ticket-gate hooks, which
  // decide (a deny from either PreToolUse/PostToolUse hook blocks the
  // spawn). If the registration is missing or altered, DENY.
  if (toolName === 'Agent') {
    if (roster !== 'new') return allow();
    if (input.agent_id) return denyNestedSpawn(policy);
    const gateStatus = verifyGateHooksRegistered();
    if (!gateStatus.ok) return denyGateNotRegistered(gateStatus.reason, policy);
    return allow();
  }

  // Tightening-key fail-closed: a malformed directorBlockedPatterns entry
  // means the guard cannot trust what it was told to add to the blocklist,
  // so every WRITE is denied — every tool in the standard write/execution
  // set (BLOCKED) — until it's fixed. Tools outside that set (Read,
  // SlashCommand, an MCP tool name the broken pattern might or might not
  // have matched) are unaffected. Honoured under BOTH rosters, but the
  // roster still decides HOW: roster:new denies unconditionally (Director
  // law is always active there); legacy is still gated by model dormancy.
  if (policy.blockedPatternsInvalid && BLOCKED.has(toolName)) {
    if (roster === 'new') return denyBlockedPatternsInvalid(toolName, policy);
    const t = latestMainModel(input);
    if (t.model) {
      if (!DIRECTOR_MODEL.test(t.model)) return allow();
      return denyBlockedPatternsInvalid(toolName, policy);
    }
    if (t.state === 'corrupt') return denyCorruptTranscript(toolName, policy);
    return allow(); // t.state === 'empty': legacy stands down
  }

  // Exempt mutations: plan-file authorship (§4 PLAN — .claude/plans/*.md
  // plus, under legacy, any directorPlanPatterns matches) and memory-file
  // authorship (§3.1 — CLAUDE.md/CLAUDE.local.md, auto-memory, plus, under
  // legacy, any directorMemoryPatterns matches; marker block protected).
  // Each can also come back 'hardlink', which denies immediately regardless
  // of roster or model dormancy — a pre-placed hardlink is a bypass of the
  // carve-out itself, not an ordinary Director action to weigh.
  const planCheck = classifyPlanOperation(toolName, input.tool_input, policy.planPatterns);
  if (planCheck === 'allow') return allow();
  if (planCheck === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const memory = classifyMemoryOperation(toolName, input.tool_input, policy.memoryPatterns);
  if (memory === 'allow') return allow();
  if (memory === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const deniedByDefault = BLOCKED.has(toolName) && !policy.allowed.includes(toolName);
  const deniedByPolicy = matchesAny(policy.patterns, toolName);
  if (!deniedByDefault && !deniedByPolicy) return allow();

  // roster:new: Director law is always active for a matched tool — the
  // session transcript is never consulted on this path (see file header).
  if (roster === 'new') {
    if (memory === 'marker') return denyMarkerBlock(toolName, policy);
    return deniedByDefault ? denyDefault(toolName, policy) : denyByPolicy(toolName, policy);
  }

  // Legacy: model-aware dormancy (ORCHESTRA.md §1) — only Opus/Fable
  // direct. Enforce only on positive evidence of a director model at the
  // helm. Any other model (Sonnet, Haiku) means the guard stands down so
  // the session behaves like plain Claude Code.
  const t = latestMainModel(input);

  if (t.model) {
    if (!DIRECTOR_MODEL.test(t.model)) return allow();
    if (memory === 'marker') return denyMarkerBlock(toolName, policy);
    return deniedByDefault ? denyDefault(toolName, policy) : denyByPolicy(toolName, policy);
  }

  if (t.state === 'corrupt') {
    if (memory === 'marker') return denyMarkerBlock(toolName, policy);
    return denyCorruptTranscript(toolName, policy);
  }

  // t.state === 'empty': the classic undetermined-model staleness window
  // (no transcript, unreadable, no assistant turn flushed yet, or a
  // small/fresh corrupt-looking file — see latestMainModel()). Legacy
  // stands down.
  return allow();
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch (e) {
    // WO-14b repair A item 9: a guard bug must not silently stand the
    // guard down under roster:new, where Director law is supposed to be
    // ALWAYS active (see the file header) — the old unconditional allow()
    // here opened the gate on every internal error regardless of roster.
    // Legacy has no fixed policy to fall back to and never has (see
    // denyMalformedInput()'s own comment on the same asymmetry), so it
    // still fails open here, exactly as documented.
    if (rosterFromArgv() === 'new') {
      return deny(
        'Orchestra: the guard hit an internal error under roster:new — failing closed rather than ' +
          'standing down: ' + (e && e.message ? e.message : String(e))
      );
    }
    allow(); // legacy: never brick the session on a guard bug
  }
});
