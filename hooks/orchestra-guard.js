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
 * -------------------------------------------------------------- model-aware
 *
 * Model-aware: Director law binds only director models (ORCHESTRA.md §1).
 * Before denying, the guard reads the session transcript and applies a LATCH:
 * it scans every parseable non-sidechain assistant entry in what it read, not
 * just the last one. If ANY entry anywhere names a director model
 * (Opus/Fable), the session is enforced for the rest of the read window
 * regardless of what appears after it. Only when NO director entry exists
 * anywhere does the latest non-director model (Sonnet, Haiku) stand the guard
 * down. Undetermined (no assistant entry at all) -> stand down: enforcement
 * requires positive evidence of a director model. An entry is discounted as a
 * sidechain ONLY when isSidechain is the strict boolean `true` — every other
 * value (absent, false, "true", 1, ...) counts as a main-session entry.
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
 * Malformed PreToolUse input (stdin that isn't parseable JSON) fails open.
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
 * All four keys are read from an ordinary project file — .claude/orchestra.json
 * is not, by itself, a trust boundary; anything that can write into the
 * project can rewrite it. All three pattern keys are GLOBS, not regexes —
 * `*` matches within one path segment; `**` crosses segments — matched
 * through a non-backtracking token-DP matcher (compileGlob()/globMatch()),
 * so no crafted pattern or path can hang it. A pattern SHAPED LIKE A REGEX is
 * REJECTED at load time (isRegexShaped()): starting with `^`, ending with
 * `$`, or containing any of `( ) | + \ { }`.
 *   directorBlockedPatterns: globs tested against tool NAMES; matches are
 *     denied to the Director. A rejected entry fails the whole guard CLOSED
 *     for every tool in BLOCKED until fixed or removed — see
 *     denyBlockedPatternsInvalid().
 *   directorAllowedTools: names of tools in BLOCKED that the Director is
 *     nonetheless permitted to use for this project.
 *   directorPlanPatterns / directorMemoryPatterns: PATH keys. They add
 *     markdown locations to the built-in plan/memory carve-outs; a match
 *     still passes every protection above.
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

// Models allowed to direct (ORCHESTRA.md §1: Fable or Opus). Anything else —
// Sonnet, Haiku, or unknown — puts the session in NORMAL mode, and the guard
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

// Tools the self-pause write detector watches — a NotebookEdit whose
// notebook_path resolves to the pause path is covered too, even though the
// plan/memory carve-outs stay scoped to Write/Edit/MultiEdit (a .md
// extension requirement excludes .ipynb anyway).
const PAUSE_WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

// Transcript reading (latestMainModel()): read the whole file rather than a
// fixed-size tail, up to this cap. Session transcripts are bounded by
// conversation length, not by attacker input, so a full read is cheap in the
// overwhelmingly common case. Past this size, read a bounded TAIL instead of
// denying outright — see TAIL_BYTES.
const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;

// Bounded tail size once a transcript exceeds MAX_TRANSCRIPT_BYTES.
const TAIL_BYTES = 8 * 1024 * 1024;

// Bounded HEAD window read alongside the tail once a transcript exceeds
// MAX_TRANSCRIPT_BYTES. The latch applies over head UNION tail (see
// latestMainModel()): a director entry in EITHER window still wins.
const HEAD_BYTES = 2 * 1024 * 1024;

// Corrupt-state regression grace window: a transcript this small AND this
// recently CREATED AND MODIFIED is treated as "mid first write", not
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

// Appends the "pause file ignored as a pause signal" note to a denial
// message, when applicable.
function withNote(msg, policy) {
  if (policy && policy.pauseIgnoredReason) {
    return (
      msg +
      ' [a file exists at .claude/' + PAUSE_BASENAME + ' but was not honoured as a pause ' +
      'signal: ' + policy.pauseIgnoredReason + ']'
    );
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
// window.
function denyCorruptTranscript(toolName, policy) {
  deny(
    withNote(
      'Orchestra: the session transcript exists but contains no complete, parseable entry — ' +
        'distinct from simply having no assistant turn yet. That state denies ' + toolName +
        ' rather than standing down, since a transcript that cannot be read is not positive ' +
        'evidence of anything. (User-only pause switch, out-of-band only: ' +
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

// directorBlockedPatterns fail-closed: an entry that was rejected at load
// time (see compileGlobsTightening()) means the guard cannot trust what the
// manifest wanted to add to the blocklist. Rather than silently drop the bad
// entry (the directorPlanPatterns/directorMemoryPatterns convention), the
// whole guard fails closed until it's fixed: every write is denied,
// including the plan/memory carve-outs.
function denyBlockedPatternsInvalid(toolName, policy) {
  deny(
    withNote(
      'Orchestra: .claude/' + CONFIG_BASENAME + '\'s directorBlockedPatterns contains an ' +
        'entry that was rejected at load (shaped like a regex, not a glob — see the guard\'s ' +
        'glob-only pattern rule: no leading ^, no trailing $, none of ( ) | + \\ { }). ' +
        'directorBlockedPatterns tightens the blocklist, so a broken entry fails the guard ' +
        'CLOSED rather than dropping itself: every write is denied — including plan/memory ' +
        'carve-outs — until the pattern is fixed or removed. (User-only pause switch, ' +
        'out-of-band only: ORCHESTRA_PAUSE=1 or a pre-existing .claude/' + PAUSE_BASENAME +
        ' file.)',
      policy
    )
  );
}

// ------------------------------------------------------------- glob engine
//
// Non-backtracking glob matcher (originally shared with the now-deleted
// verifier's classification-pattern matcher): `**` crosses path separators,
// `*` does not; text is matched in full (implicitly anchored both ends). Patterns
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

// directorPlanPatterns / directorMemoryPatterns compilation: a rejected
// entry silently drops itself — a bad entry loses only itself, never the
// whole policy. An oversized array drops ENTIRELY — not just its excess
// entries.
function compileGlobsLoosening(arr) {
  if (Array.isArray(arr) && arr.length > MAX_PATTERN_ARRAY_LEN) return [];
  return arrOfStrings(arr)
    .filter((s) => isPatternSafe(s))
    .map((s) => compileGlob(s));
}

// directorBlockedPatterns compilation: callers also need to know whether ANY
// entry was rejected, because a rejected entry here fails the whole guard
// closed (see denyBlockedPatternsInvalid()) rather than dropping silently.
// An oversized array is `invalid` the same way a single malformed entry is.
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

// --------------------------------------------------------------- policy
//
// Per-project policy, read from .claude/orchestra.json. Any unexpected error
// anywhere in here returns the fully-empty policy — the default blocklist
// above is never weakened by a broken manifest.
function loadPolicy() {
  const empty = {
    patterns: [],
    blockedPatternsInvalid: false,
    allowed: [],
    planPatterns: [],
    planPatternsRaw: [],
    memoryPatterns: [],
  };
  try {
    const manifestPath = path.join(projectDir(), '.claude', CONFIG_BASENAME);
    let cfg = null;
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        cfg = parsed;
      }
    } catch (_) {
      cfg = null;
    }

    const g = compileGlobsTightening(cfg ? cfg.directorBlockedPatterns : null);
    const rawPlanPatterns =
      cfg && Array.isArray(cfg.directorPlanPatterns) && cfg.directorPlanPatterns.length <= MAX_PATTERN_ARRAY_LEN
        ? arrOfStrings(cfg.directorPlanPatterns)
        : [];

    return Object.assign({}, empty, {
      patterns: g.patterns,
      blockedPatternsInvalid: g.invalid,
      allowed: cfg ? arrOfStrings(cfg.directorAllowedTools) : [],
      planPatternsRaw: rawPlanPatterns,
      planPatterns: cfg ? compileGlobsLoosening(cfg.directorPlanPatterns) : [],
      memoryPatterns: cfg ? compileGlobsLoosening(cfg.directorMemoryPatterns) : [],
    });
  } catch (_) {
    return Object.assign({}, empty);
  }
}

// --------------------------------------------------------------- transcript
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
// any project-relative path matching directorPlanPatterns (see loadPolicy()).
// Containment is checked on the REAL (symlink-resolved) path so a
// pre-existing symlink/junction inside the plans dir cannot escape the
// project, and BOTH routes require a .md extension on the resolved path. A
// match that resolves to a link-unsafe target (linkSafety()) is refused, not
// silently downgraded to "not a plan file".
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

  // Project-configured plan locations (directorPlanPatterns — see
  // loadPolicy()). Globs over the forward-slash REAL project-relative path —
  // same containment guarantee as above.
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
// directorMemoryPatterns, and — outside the project — user-level memory
// under Claude's config dir: its CLAUDE.md, or markdown inside a
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

function main(raw) {
  // Escape hatch (user-controlled). ORCHESTRA_PAUSE=1 is checked first,
  // independent of the (possibly unparseable) input payload.
  if (process.env.ORCHESTRA_PAUSE === '1') return allow();

  let input;
  try {
    input = JSON.parse(raw);
  } catch (_) {
    // Unparseable PreToolUse payload — fail open. There is no fixed policy
    // to fall back to, and a genuine pre-existing pause file still stands
    // the guard down on every subsequent call anyway.
    return allow();
  }

  const toolName = input.tool_name;
  const policy = loadPolicy();

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
  // agent_type), exempt it explicitly.
  if ((input.agent_id || input.agent_type) && toolName !== 'Agent') return allow();

  if (typeof toolName !== 'string') return allow();

  // Agent handling: this guard has never blocked Agent.
  if (toolName === 'Agent') return allow();

  // directorBlockedPatterns fail-closed: a malformed entry means the guard
  // cannot trust what it was told to add to the blocklist, so every WRITE is
  // denied — every tool in the standard write/execution set (BLOCKED) —
  // until it's fixed. Tools outside that set (Read, SlashCommand, an MCP
  // tool name the broken pattern might or might not have matched) are
  // unaffected. Still gated by model dormancy, same as any other denial.
  if (policy.blockedPatternsInvalid && BLOCKED.has(toolName)) {
    const t = latestMainModel(input);
    if (t.model) {
      if (!DIRECTOR_MODEL.test(t.model)) return allow();
      return denyBlockedPatternsInvalid(toolName, policy);
    }
    if (t.state === 'corrupt') return denyCorruptTranscript(toolName, policy);
    return allow(); // t.state === 'empty': stands down
  }

  // Exempt mutations: plan-file authorship (§4 PLAN — .claude/plans/*.md
  // plus any directorPlanPatterns matches) and memory-file authorship
  // (§3.1 — CLAUDE.md/CLAUDE.local.md, auto-memory, plus any
  // directorMemoryPatterns matches; marker block protected). Each can also
  // come back 'hardlink', which denies immediately regardless of model
  // dormancy — a pre-placed hardlink is a bypass of the carve-out itself,
  // not an ordinary Director action to weigh.
  const planCheck = classifyPlanOperation(toolName, input.tool_input, policy.planPatterns);
  if (planCheck === 'allow') return allow();
  if (planCheck === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const memory = classifyMemoryOperation(toolName, input.tool_input, policy.memoryPatterns);
  if (memory === 'allow') return allow();
  if (memory === 'hardlink') return denyHardlinkedTarget(toolName, policy);

  const deniedByDefault = BLOCKED.has(toolName) && !policy.allowed.includes(toolName);
  const deniedByPolicy = matchesAny(policy.patterns, toolName);
  if (!deniedByDefault && !deniedByPolicy) return allow();

  // Model-aware dormancy (ORCHESTRA.md §1) — only Opus/Fable direct.
  // Enforce only on positive evidence of a director model at the helm. Any
  // other model (Sonnet, Haiku) means the guard stands down so the session
  // behaves like plain Claude Code.
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
  // small/fresh corrupt-looking file — see latestMainModel()). Stands down.
  return allow();
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch (e) {
    allow(); // never brick the session on a guard bug
  }
});
