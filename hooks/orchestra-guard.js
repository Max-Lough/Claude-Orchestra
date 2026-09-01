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
 * Before denying, the guard reads the latest main-session assistant turn from
 * the session transcript (whole-file scan, backwards, sidechain-filtered —
 * see latestMainModel() for why a full read replaces the old fixed-size tail
 * read): Opus/Fable -> enforce; anything else (Sonnet, Haiku) -> the
 * Orchestra is dormant and the guard stands down entirely. Undetermined ->
 * stand down too: enforcement requires positive evidence of a director
 * model. Sonnet/Haiku sessions must never see a denial (they can't cheaply
 * delegate simple tasks), whereas an unenforced first turn on a director
 * session is harmless — ORCHESTRA.md still instructs the Director to
 * delegate, and the guard picks up hard enforcement as soon as the model
 * reaches the transcript. Known one-turn staleness windows (both now fail
 * toward standing down under legacy; roster:new denies instead, see below):
 *   - fresh session, first assistant turn: no assistant entry is flushed yet
 *     -> undetermined -> stand down (a director session's opening turn is
 *     covered by protocol instructions rather than the hook);
 *   - the current turn is flushed only after it completes, so a mid-session
 *     /model switch is picked up one turn late.
 * A THIRD, distinct transcript state — the file has content but not one
 * complete/parseable JSONL entry — is never "stand down": it denies under
 * BOTH rosters (see latestMainModel()). This is what used to be reachable by
 * evicting the real assistant entry out of a truncated tail read; reading
 * the whole file removes the eviction path, and this state now exists only
 * for a transcript that is genuinely corrupt/garbage.
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
 * Three classes of writes are exempt from Director law:
 *   - the pause file (.claude/orchestra.pause) — a pure file-EXISTENCE
 *     toggle, at the user's request (§6). Only a Write/Edit whose target
 *     resolves to exactly <project>/.claude/orchestra.pause qualifies —
 *     there is deliberately no Bash/PowerShell carve-out (a prior version
 *     matched any shell command *containing* the string "orchestra.pause",
 *     which bought unconditional shell via a trailing comment; the file
 *     already gets created through the Write branch, so the command branch
 *     was never load-bearing).
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
 * All three carve-outs share the same hardening, applied to the REAL
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
 *     "directorBlockedPatterns": ["^mcp__blender__", "^mcp__godot__"],
 *     "directorAllowedTools": ["Glob"],
 *     "directorPlanPatterns": ["^docs/plans/.+\\.md$"],
 *     "directorMemoryPatterns": ["^\\.claude/rules/.+\\.md$"]
 *   }
 * directorBlockedPatterns: regexes tested against tool names; matches are
 *   denied to the Director (use for MCP tools that mutate external state).
 *   A tightening key — it can only add restrictions — so it is honoured
 *   from the manifest regardless of the pin/trust state below.
 * directorAllowedTools: exact built-in names to REMOVE from the default
 *   blocklist below (loosen the law for this project without editing code).
 *   A LOOSENING key (see the manifest-pin section). Under roster:new, Bash
 *   and PowerShell can never be removed from the blocklist this way, no
 *   matter how the manifest is trusted (see stripUnloosenableUnderNewRoster()).
 * directorPlanPatterns / directorMemoryPatterns: LOOSENING keys — regexes
 *   tested against the REAL project-relative path (forward-slash form) of
 *   Write/Edit/MultiEdit targets; matches are treated as plan/memory files
 *   in addition to the defaults. Paths outside the project (or, for memory,
 *   outside Claude's config dir) never match, and a .md extension is
 *   required on every route, default and configured alike. Patterns longer
 *   than 200 chars, or shaped like a nested-quantifier catastrophic-
 *   backtracking hazard (e.g. `(a+)+`), are rejected at load time rather
 *   than compiled — see hasNestedQuantifier().
 * roster: "new" | "legacy" (default). NEVER read directly from this file —
 *   see "Manifest pin" below. Absent any owner pin, the project is always
 *   legacy regardless of what this file claims.
 * seats / rosterGeneration: read and returned for the leg-4 ticket gate to
 *   consume; this guard does not act on them itself.
 *
 * Manifest pin (loadPin() / loadPolicy()): `.claude/orchestra.json` lives
 * inside the project and is not, by itself, a trust boundary — anything that
 * can write into the project (a hostile cloned repo, a compromised
 * subagent's sanctioned delegation channel, pre-placement before the guard
 * ever runs) can rewrite it. So the manifest alone can never grant roster:new
 * or loosen the blocklist; it can only do either when an OWNER PIN, written
 * outside the project by the installer, says so:
 *   PIN_DIR = $ORCHESTRA_PIN_DIR || ~/.claude/orchestra/pins
 *   pin file = <PIN_DIR>/<sha256 hex of the project's real path>.json
 *   { projectDir, manifestSha256, roster, rosterGeneration, seats,
 *     writtenAt, by: "install.js" }
 * Three cases:
 *   (a) no pin file -> roster is LEGACY regardless of the manifest, and the
 *       manifest's loosening keys are honoured exactly as before the pin
 *       existed ("unpinned legacy install" — a default-on-request, not an
 *       enforcement boundary);
 *   (b) pin present and the manifest's bytes hash to pin.manifestSha256 ->
 *       the manifest is trusted: honour it fully, but roster still comes
 *       from the pin (it always does);
 *   (c) pin present and the manifest is missing/unreadable/hash-mismatched
 *       -> the manifest is UNTRUSTED: every loosening key is ignored,
 *       roster/seats/rosterGeneration come from the pin instead, and denial
 *       messages append "manifest untrusted (<reason>)". directorBlockedPatterns
 *       still applies if the manifest at least parses (it can only add
 *       restrictions). Under roster:new (from the pin) an undetermined model
 *       still denies, same as case (b).
 * A malformed pin file (unreadable, not an object, or roster not exactly
 * "new"/"legacy") is treated as case (a) — no pin. The pin directory sits
 * outside the project on purpose; nothing under source control can write it.
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

// Transcript reading (latestMainModel()): read the whole file rather than a
// fixed-size tail. Session transcripts are bounded by conversation length,
// not by attacker input, so a full read is cheap in the overwhelmingly
// common case and — unlike a tail read — cannot be evicted by one oversized
// entry. This cap is a last-resort circuit breaker, not the normal path.
const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;

// Regex safety (loadPolicy()/toRegexes()).
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

// Appends the "manifest untrusted" note (loadPolicy() case (c)) to a denial
// message when applicable, so a denial under an untrusted manifest is
// distinguishable from an ordinary one.
function withManifestNote(msg, policy) {
  if (policy && policy.manifestUntrusted && policy.manifestUntrustedReason) {
    return msg + ' [' + policy.manifestUntrustedReason + ']';
  }
  return msg;
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
        '(User-only pause switch: create .claude/' + PAUSE_BASENAME + ' or set ORCHESTRA_PAUSE=1.)',
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
        'session, the denial clears itself once that model reaches the transcript on your ' +
        'next turn. (User-only pause switch: .claude/' + PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

// A transcript that has content but not one complete/parseable JSONL entry
// (see latestMainModel()) is never treated as "stand down" — under a tail
// read this was exactly the eviction hole; even under a whole-file read it
// signals a genuinely corrupt/garbage transcript. Denies under BOTH rosters.
function denyCorruptTranscript(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: the session transcript exists but contains no complete, parseable entry — ' +
        'distinct from simply having no assistant turn yet. That state denies ' + toolName +
        ' under both rosters rather than standing down, since a transcript that cannot be read ' +
        'is not positive evidence of anything. (User-only pause switch: .claude/' + PAUSE_BASENAME +
        ' or ORCHESTRA_PAUSE=1.)',
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
        'unparseable input — is unchanged). (User-only pause switch: .claude/' + PAUSE_BASENAME +
        ' or ORCHESTRA_PAUSE=1.)',
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
        'inherit MCP tools. (User-only pause switch: .claude/' + PAUSE_BASENAME +
        ' or ORCHESTRA_PAUSE=1.)',
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
        'wants the harness disabled, they pause it (.claude/' + PAUSE_BASENAME + ' / ' +
        'ORCHESTRA_PAUSE=1) or run the installer with --uninstall.',
      policy
    )
  );
}

// One of the three write carve-outs (pause/plan/memory) matched by path, but
// the resolved target is already linked to something it shouldn't be — see
// linkSafety(). Deliberately the same message regardless of which carve-out
// matched: the hazard (a pre-placed hardlink) is identical in every route.
function denyHardlinkedTarget(toolName, policy) {
  deny(
    withManifestNote(
      'Orchestra: ' + toolName + ' targets a path that already exists as a hardlink (or the ' +
        'same file, by device+inode) to a protected harness/config file — reason: hardlinked ' +
        'target. A realpath check alone cannot catch this: a hardlink IS the target file under ' +
        'a second name. Delegate this write to the executor instead. (User-only pause switch: ' +
        '.claude/' + PAUSE_BASENAME + ' or ORCHESTRA_PAUSE=1.)',
      policy
    )
  );
}

// Conservative catastrophic-backtracking guard for directorBlockedPatterns /
// directorPlanPatterns / directorMemoryPatterns: reject any parenthesized
// group that is itself repeated (`)+`, `)*`, `){n,}` / `{n,m}`) and whose
// interior contains another repetition — the classic nested-quantifier shape
// (`(a+)+`, `((a+).)+`, `(\w*)*`, …) that can hang the regex engine on an
// adversarial input, and which a PreToolUse hook timeout turns into a
// SILENT ALLOW rather than a safe failure. Matches parens by depth, not a
// single flat regex, so it catches multi-level nesting too.
function hasNestedQuantifier(src) {
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== ')') continue;
    const rest = src.slice(i + 1);
    const quantified = /^[+*]/.test(rest) || /^\{\d*,?\d*\}/.test(rest);
    if (!quantified) continue;
    let depth = 0;
    let open = -1;
    for (let j = i; j >= 0; j--) {
      if (src[j] === ')' && src[j - 1] !== '\\') {
        depth++;
      } else if (src[j] === '(' && src[j - 1] !== '\\') {
        depth--;
        if (depth === 0) {
          open = j;
          break;
        }
      }
    }
    if (open === -1) continue; // unbalanced — let RegExp() itself reject it
    const interior = src.slice(open + 1, i);
    if (/[+*]|\{\d*,/.test(interior)) return true;
  }
  return false;
}

function isPatternSafe(src) {
  return typeof src === 'string' && src.length <= MAX_PATTERN_LEN && !hasNestedQuantifier(src);
}

// Compiles a config array of pattern strings to RegExp objects, silently
// dropping anything unsafe (isPatternSafe) or syntactically invalid — same
// fail-safe convention as the rest of loadPolicy(): a bad entry loses only
// itself, never the whole policy.
function toRegexes(arr) {
  return (Array.isArray(arr) ? arr : [])
    .filter((s) => isPatternSafe(s))
    .map((s) => {
      try {
        return new RegExp(s);
      } catch (_) {
        return null; // invalid regex syntax — skip it, keep the rest
      }
    })
    .filter(Boolean);
}

function arrOfStrings(arr) {
  return (Array.isArray(arr) ? arr : []).filter((s) => typeof s === 'string');
}

function objOrNull(o) {
  return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
}

// Even a trusted manifest may never remove Bash/PowerShell from the block
// set once roster:new is in effect (item 8) — leg 4's ticket gate assumes
// those two are always enforceable under roster:new. Every other name in
// directorAllowedTools may still be loosened, trusted-manifest or not.
function stripUnloosenableUnderNewRoster(allowed, roster) {
  if (roster !== 'new') return allowed;
  return allowed.filter((t) => t !== 'Bash' && t !== 'PowerShell');
}

// The owner pin for this project (see the file-header "Manifest pin" note).
// Returns null for "no pin" — missing pin directory, missing pin file,
// unreadable/non-object JSON, or a roster value that isn't exactly "new" or
// "legacy". A malformed pin is treated identically to no pin at all: the
// pin, not the manifest, is the trust boundary, so a corrupt pin can only
// ever fail toward the unpinned-legacy case, never toward silently trusting
// a manifest it couldn't validate.
function loadPin(root) {
  try {
    const dir = pinDir();
    if (dir === '') return null;
    let real;
    try {
      real = fs.realpathSync(root);
    } catch (_) {
      real = path.resolve(root);
    }
    const hash = crypto.createHash('sha256').update(real, 'utf8').digest('hex');
    const p = path.join(dir, hash + '.json');
    if (!fs.existsSync(p)) return null;
    const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    if (obj.roster !== 'new' && obj.roster !== 'legacy') return null;
    return {
      roster: obj.roster,
      seats: objOrNull(obj.seats),
      rosterGeneration: typeof obj.rosterGeneration === 'number' ? obj.rosterGeneration : null,
      manifestSha256: typeof obj.manifestSha256 === 'string' ? obj.manifestSha256 : null,
    };
  } catch (_) {
    return null;
  }
}

// Per-project policy, gated by the owner pin — see the file-header "Manifest
// pin" note for the (a)/(b)/(c) cases this implements. Any unexpected error
// anywhere in here returns the fully-empty (legacy, unconfigured) policy —
// the default blocklist above is never weakened by a broken pin or manifest.
function loadPolicy() {
  const empty = {
    patterns: [],
    allowed: [],
    planPatterns: [],
    planPatternsRaw: [],
    memoryPatterns: [],
    roster: 'legacy',
    seats: null,
    rosterGeneration: null,
    manifestUntrusted: false,
    manifestUntrustedReason: '',
  };
  try {
    const root = projectDir();
    const pin = loadPin(root);

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

    const fieldsFromManifest = (roster) => ({
      patterns: cfg ? toRegexes(cfg.directorBlockedPatterns) : [],
      allowed: stripUnloosenableUnderNewRoster(cfg ? arrOfStrings(cfg.directorAllowedTools) : [], roster),
      planPatternsRaw: cfg ? arrOfStrings(cfg.directorPlanPatterns) : [],
      planPatterns: cfg ? toRegexes(cfg.directorPlanPatterns) : [],
      memoryPatterns: cfg ? toRegexes(cfg.directorMemoryPatterns) : [],
    });

    if (!pin) {
      // (a) Unpinned legacy install: roster is forced legacy regardless of
      // what the manifest claims, and the manifest's loosening keys are
      // honoured exactly as they always have been ("unpinned legacy
      // install" — a default-on-request, not an enforcement boundary).
      if (!cfg) return empty;
      const f = fieldsFromManifest('legacy');
      return Object.assign({}, empty, f, {
        rosterGeneration: typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : null,
        seats: objOrNull(cfg.seats),
      });
    }

    const trusted =
      cfg !== null &&
      manifestBytes !== null &&
      typeof pin.manifestSha256 === 'string' &&
      crypto.createHash('sha256').update(manifestBytes).digest('hex') === pin.manifestSha256;

    if (trusted) {
      // (b) Pin present, manifest bytes hash-match: honour the manifest
      // fully; roster still comes from the pin (it always does).
      const f = fieldsFromManifest(pin.roster);
      return Object.assign({}, empty, f, {
        roster: pin.roster,
        rosterGeneration: typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : pin.rosterGeneration,
        seats: objOrNull(cfg.seats) || pin.seats,
      });
    }

    // (c) Pin present, manifest missing/unreadable/hash-mismatched: the
    // manifest is UNTRUSTED. Every loosening key (directorAllowedTools,
    // directorPlanPatterns, directorMemoryPatterns) is ignored outright;
    // directorBlockedPatterns still applies if the manifest at least parses
    // (it can only add restrictions, never remove one). roster/seats/
    // rosterGeneration come from the pin, not the manifest.
    const reason = manifestError || 'hash mismatch';
    return Object.assign({}, empty, {
      patterns: cfg ? toRegexes(cfg.directorBlockedPatterns) : [],
      roster: pin.roster,
      seats: pin.seats,
      rosterGeneration: pin.rosterGeneration,
      manifestUntrusted: true,
      manifestUntrustedReason: 'manifest untrusted (' + reason + ')',
    });
  } catch (_) {
    return empty;
  }
}

// Latest main-session assistant model from the session transcript. Reads the
// WHOLE file (see MAX_TRANSCRIPT_BYTES) and scans backwards, skipping
// sidechain (subagent) entries so a recently finished Haiku scout cannot
// masquerade as the session model. A prior version read only a fixed-size
// tail, which meant one oversized entry (e.g. a large tool_result) could
// evict the real assistant entry out of the read window entirely —
// discovered as a fourth, attacker-chosen stand-down window. Reading the
// whole file removes that eviction path outright.
//
// Returns one of:
//   { model: string }   — positive evidence of a session model.
//   { state: 'empty' }  — no transcript_path, missing/unreadable file, an
//                         empty file, or a file with only non-assistant
//                         entries. Callers treat this as "undetermined":
//                         legacy stands down, roster:new denies (unchanged
//                         from before this fix).
//   { state: 'corrupt' } — the file has content but not one complete,
//                         parseable JSONL entry (or is too large to safely
//                         vouch for a complete read). Distinct from 'empty':
//                         this denies under BOTH rosters (see
//                         denyCorruptTranscript()) rather than ever
//                         standing down.
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
    if (stat.size > MAX_TRANSCRIPT_BYTES) return { state: 'corrupt' }; // can't safely vouch for a complete read
    const content = fs.readFileSync(tp, 'utf8');
    const lines = content.split('\n');
    let sawValidEntry = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue; // partial/corrupt line — keep scanning backwards
      }
      sawValidEntry = true;
      if (entry && entry.type === 'assistant' && entry.isSidechain !== true) {
        const model = entry.message && entry.message.model;
        if (typeof model === 'string' && model !== '' && model !== '<synthetic>') {
          return { model };
        }
      }
    }
    return { state: sawValidEntry ? 'no-assistant' : 'corrupt' };
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
// this only runs when a Write/Edit/MultiEdit already matched a pause/plan/
// memory route, not on every tool call).
function protectedFileStats() {
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
      stats.push({ dev: st.dev, ino: st.ino });
    } catch (_) {
      /* doesn't exist — nothing to protect */
    }
  }
  return stats;
}

// The hardlink defense shared by all three carve-outs (pause/plan/memory).
// `realPath` must already be symlink/junction-resolved (realish()) and have
// passed its route's containment check. Two independent tests:
//   - nlink > 1: the target already exists with more than one hard link —
//     refused regardless of what it's linked to, since a legitimate
//     Director-authored plan/memory/pause file is never pre-linked;
//   - {dev, ino} match against protectedFileStats(): catches the case even
//     if nlink reporting is unavailable/unreliable for some reason.
// A target that doesn't exist yet (the common case — most writes create a
// new file) is safe: there is nothing to have hardlinked.
function linkSafety(realPath) {
  try {
    const st = fs.statSync(realPath);
    if (st.nlink > 1) return { safe: false };
    const protectedSet = protectedFileStats();
    for (const p of protectedSet) {
      if (p.dev === st.dev && p.ino === st.ino) return { safe: false };
    }
    return { safe: true };
  } catch (_) {
    return { safe: true }; // doesn't exist yet — nothing to protect
  }
}

// Pause-file carve-out (§6): a pure file-existence toggle. Only Write/Edit
// qualify, and only when the target resolves to exactly
// <project>/.claude/orchestra.pause — no Bash/PowerShell branch (see the
// file header), and no basename-only match (a prior version matched any
// path ending in that basename, anywhere on disk).
// Returns 'none' | 'allow' | 'hardlink'.
function classifyPauseOperation(toolName, toolInput) {
  if (toolName !== 'Write' && toolName !== 'Edit') return 'none';
  if (!toolInput || typeof toolInput !== 'object') return 'none';
  if (typeof toolInput.file_path !== 'string' || toolInput.file_path === '') return 'none';
  const root = projectDir();
  const resolved = path.resolve(root, toolInput.file_path);
  const wantPath = path.join(root, '.claude', PAUSE_BASENAME);
  const realResolved = realish(resolved);
  const realWant = realish(wantPath);
  if (realResolved !== realWant) return 'none';
  const safety = linkSafety(realResolved);
  return safety.safe ? 'allow' : 'hardlink';
}

// Plan-file carve-out (ORCHESTRA.md §4 PLAN): the Director may author plan
// files itself — markdown inside <project>/.claude/plans/ by default, plus
// any project-relative path matching directorPlanPatterns. Containment is
// checked on the REAL (symlink-resolved) path so a pre-existing symlink/
// junction inside the plans dir cannot escape the project, and BOTH routes
// require a .md extension on the resolved path. A match that resolves to an
// link-unsafe target (linkSafety()) is refused, not silently downgraded to
// "not a plan file" — the caller gets a specific "hardlinked target" denial.
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

  // Project-configured plan locations (regexes over the forward-slash
  // REAL project-relative path — same containment guarantee as above).
  const posixRel = realRelToProject.split(path.sep).join('/');
  const matchesPattern = planPatterns.some((re) => re.test(posixRel));

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
// directorMemoryPatterns, and — outside the project — user-level memory
// under Claude's config dir: its CLAUDE.md, or markdown inside a
// memory/memories directory (auto-memory). Routed through the same
// realish()+containment logic as the plan carve-out (a prior version used
// plain path.resolve() with no realpath containment check at all for the
// in-project route), and a .md extension is now required on every route,
// including directorMemoryPatterns (a prior version had no such requirement
// on that one route, unlike every other carve-out).
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
      const patternMatch = memoryPatterns.some((re) => re.test(posixRel));
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
  // Escape hatches (user-controlled) — checked first and independent of the
  // (possibly unparseable) input payload, so the pause switch always works.
  if (process.env.ORCHESTRA_PAUSE === '1') return allow();
  try {
    if (fs.existsSync(path.join(projectDir(), '.claude', PAUSE_BASENAME))) return allow();
  } catch (_) {
    /* fall through — treat as no pause file */
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (_) {
    // Unparseable PreToolUse payload. Legacy fails open (unchanged); under
    // roster:new this is the same undetermined-state asymmetry as the model
    // checks below, so it denies instead — see denyMalformedInput().
    const policy = loadPolicy();
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

  // Exempt mutations: the pause-file toggle (§6), plan-file authorship
  // (§4 PLAN — .claude/plans/*.md plus any directorPlanPatterns matches), and
  // memory-file authorship (§3.1 — CLAUDE.md/CLAUDE.local.md, auto-memory,
  // plus any directorMemoryPatterns matches; marker block protected). Each
  // can also come back 'hardlink', which denies immediately regardless of
  // model dormancy — a pre-placed hardlink is a bypass of the carve-out
  // itself, not an ordinary Director action to weigh against the model.
  const pauseCheck = classifyPauseOperation(toolName, input.tool_input);
  if (pauseCheck === 'allow') return allow();
  if (pauseCheck === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const planCheck = classifyPlanOperation(toolName, input.tool_input, policy.planPatterns);
  if (planCheck === 'allow') return allow();
  if (planCheck === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const memory = classifyMemoryOperation(toolName, input.tool_input, policy.memoryPatterns);
  if (memory === 'allow') return allow();
  if (memory === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const deniedByDefault = BLOCKED.has(toolName) && !policy.allowed.includes(toolName);
  const deniedByPolicy = policy.patterns.some((re) => re.test(toolName));
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
  // (no transcript, unreadable, or no assistant turn flushed yet). Legacy's
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
