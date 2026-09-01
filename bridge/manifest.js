#!/usr/bin/env node
/**
 * WO-14b leg 4b/4c/5 (Rider 2, "round-3" pin rules) — owner-pinned manifest
 * trust.
 *
 * bridge/runtime.js (and the engine server's readOrchestraManifest()) must
 * never take `.claude/orchestra.json`'s word for its own roster/generation/
 * seats: roster/wo14b-leg3-redteam-1.md's [HIGH] finding ("in-project
 * manifest tampering / owner-pinning ... not owner-pinned today; the pin is
 * a leg-4 requirement") showed an unpinned manifest can be silently
 * tampered with (or simply corrupted) to change a project's activation
 * state with nothing to detect it. install.js writes a PIN — a file OUTSIDE
 * the project tree, named by a hash of the project's own real path (or, for
 * a project that has moved since it was pinned, its stable projectId, or —
 * leg 5 — its git history root), recording the manifest bytes' own hash
 * plus the values the installer wrote — the moment it sets roster:new; this
 * runtime verifies the live manifest against it before trusting anything
 * the manifest says.
 *
 * Pin file, by resolved project path:
 *   <PIN_DIR>/<sha256(realpath(projectDir)), lowercase hex>.json
 * Pin file, by project id (a project that has MOVED since it was pinned):
 *   <PIN_DIR>/id-<sha256(manifest.projectId), lowercase hex>.json — tried
 *   only when the path-keyed file is absent and the manifest carries a
 *   projectId.
 * Pin file, by git history root (leg 5 item iii) — tried only when neither
 *   of the above resolves: <PIN_DIR>/git-<sha256(first line of
 *   `git rev-list --max-parents=0 HEAD` run inside the project), lowercase
 *   hex>.json. Never throws: a non-git project, a missing git binary, or
 *   any other failure just means "no file at this key".
 * PIN_DIR: process.env.ORCHESTRA_PIN_DIR, honoured ONLY if that directory
 *   actually exists — an env var pointing at a nonexistent directory is "no
 *   pin dir", same as none configured — else
 *   path.join(os.homedir(), '.claude', 'orchestra', 'pins').
 * Pin content: { projectDir, manifestSha256, roster, rosterGeneration,
 *                seats, writtenAt, by }
 *              (manifestSha256 is the sha256, lowercase hex, of the
 *              manifest FILE'S BYTES at the moment the pin was written.)
 *
 * Trust rules (readTrustedManifest()), leg 5 (Rider 2) tightening:
 *   (i) roster:new FINGERPRINT — see hasRosterNewFingerprint() below: a
 *       project carries one when it has `.claude/orchestra/` populated with
 *       anything beyond the runtime's own `tickets/` subdirectory,
 *       `.claude/ORCHESTRA-CONDUCTOR.md`, any of the eleven roster role
 *       files under `.claude/agents/` (ROSTER_ROLE_FILES), a manifest whose
 *       `roster` field is itself `"new"`, or a manifest carrying any of
 *       projectId / installedFiles / installedHooks / rosterGeneration
 *       (MANIFEST_FINGERPRINT_KEYS — deliberately NOT
 *       installedPermissions/installedDeny, which a plain legacy install
 *       also writes). A fingerprinted project with no pin resolving by ANY
 *       of the three keys -> UNTRUSTED-NEW, fail closed: trusted:false,
 *       roster:'new', reason:'installed roster:new project without a pin'
 *       — used for every fingerprint-triggered untrusted-new outcome, NEVER
 *       'unpinned'. A project with no fingerprint and no pin is the
 *       original inert case: trusted:false, roster:'legacy',
 *       reason:'unpinned'.
 *   (ii) STRICT PIN SCHEMA — see isValidPinShape() below: a pin object
 *       found by any key must have projectDir a string; manifestSha256
 *       exactly 64 lowercase hex characters (case-SENSITIVE); roster
 *       exactly 'new' or 'legacy'; rosterGeneration a non-negative integer;
 *       writtenAt a valid date (Date.parse()); by a string. Anything short
 *       of the full shape is an INVALID pin: trusted:false, roster forced
 *       'new', reason:'corrupt pin' (grouped with the JSON-parse-failure
 *       case — see loadPin()) — NEVER 'unpinned'.
 *   (iii) THIRD LOOKUP KEY — the git-root key (see "Pin file, by git
 *       history root" above), tried only when neither the path key nor the
 *       id key resolves a file.
 *   (iv) MOVED — a pin found by the id OR git-root key whose own projectDir
 *       differs from the resolved project directory is NOT forged (that
 *       disagreement IS the moved-project case) — it still enforces its
 *       recorded roster, and is trusted iff the manifest hash matches,
 *       exactly like a same-directory pin. The returned state additionally
 *       carries `moved:true` in that case (this runtime has no loosening
 *       keys of its own to withhold — `moved` is carried purely for
 *       visibility, e.g. via doctor()). Every other return path sets
 *       `moved:false` explicitly.
 *
 * Case (b) (pin resolves, well-formed, and — if found by the PATH key — its
 *   own projectDir agrees with the resolved project path, and the
 *   manifest's bytes hash to pin.manifestSha256) -> trusted:true; roster
 *   always the PIN's roster; rosterGeneration/seats fall back to the pin's
 *   own copy if the manifest omits them; reason carries
 *   'project moved since pinning' when moved (informational).
 * Case (c) (pin resolves and is well-formed, but the manifest is missing/
 *   unreadable/hash-mismatched) -> UNTRUSTED: trusted:false,
 *   roster/rosterGeneration/seats come from the PIN instead,
 *   reason:'manifest untrusted (hash mismatch)' (+ the moved note).
 * Case (d) (a pin FILE resolves by any key but is corrupt/unparseable, or —
 *   found by the PATH key — its own projectDir disagrees with the resolved
 *   project path (a forged pin)) -> UNTRUSTED, roster forced 'new' (fail
 *   closed), reason names the specific defect ('corrupt pin' /
 *   'pin projectDir does not match this project') and is NEVER 'unpinned'.
 *
 * This module only READS the pin and the manifest. Writing the pin is
 * install.js's job (writePin()/writeManifestAndPin()).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const MANIFEST_REL = ['.claude', 'orchestra.json'];

// WO-14b leg 5 Rider 2 (round-3 pin rules, mirroring the guard's tightened
// fix): a "roster:new fingerprint" is evidence a project was installed with
// the new roster that does NOT depend on the manifest's own (contested)
// `roster` field alone — files/dirs install.js writes independent of that
// field, or manifest KEYS that are install-only byproducts. `roster:'new'`
// itself is kept as a trigger too (the pre-existing leg-4c rule) — this is a
// strict widening, never a narrowing, of what counts as "this project claims
// roster:new". installedPermissions/installedDeny are deliberately EXCLUDED:
// legacy (non-roster) installs write those two keys as well, so their mere
// presence must never be read as roster:new evidence.
const MANIFEST_FINGERPRINT_KEYS = ['projectId', 'installedFiles', 'installedHooks', 'rosterGeneration'];

// The eleven roster/*.md role files (mirrors install.js's rosterRoleFiles()
// output as of this writing — duplicated rather than required-in:
// install.js has no exported classifier and has execution side effects on
// require(), and this module runs inside an INSTALLED project, which never
// carries the source roster/ directory to read from dynamically in the
// first place. Same convention install.js itself uses for roster/lint.js's
// isRoleFile — the lists are kept in sync by hand across the
// source/installed boundary.
const ROSTER_ROLE_FILES = new Set([
  'architect.md',
  'builder.md',
  'conductor.md',
  'data-engineer.md',
  'investigator.md',
  'red-team.md',
  'reviewer-anthropic.md',
  'reviewer-openai.md',
  'sweeper.md',
  'test-designer-vs-anthropic.md',
  'test-designer-vs-openai.md',
]);

function hasRosterNewFingerprint(projectDir, cfg) {
  if (cfg && cfg.roster === 'new') return true;
  // .claude/orchestra/ as an INSTALL marker: install.js populates it with
  // substrate directories (router/, registry/, verifier/, quartermaster/,
  // bridge/). The ticket bridge runtime itself lazily creates only its own
  // `tickets/` subdirectory there as an operational side effect (doctor()/
  // dispatch() calling getStore()) — that side effect must never itself
  // BECOME the fingerprint, or a plain LEGACY project whose doctor()/gate()
  // merely got called once would flip to roster:new, untrusted, on its very
  // next read (self-poisoning). So this counts only when the directory
  // holds something OTHER than `tickets`.
  try {
    const entries = fs.readdirSync(path.join(projectDir, '.claude', 'orchestra'));
    if (entries.some((e) => e !== 'tickets')) return true;
  } catch (_) { /* absent */ }
  try {
    if (fs.statSync(path.join(projectDir, '.claude', 'ORCHESTRA-CONDUCTOR.md')).isFile()) return true;
  } catch (_) { /* absent */ }
  for (const roleFile of ROSTER_ROLE_FILES) {
    try {
      if (fs.statSync(path.join(projectDir, '.claude', 'agents', roleFile)).isFile()) return true;
    } catch (_) { /* absent */ }
  }
  if (cfg && typeof cfg === 'object') {
    for (const k of MANIFEST_FINGERPRINT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(cfg, k)) return true;
    }
  }
  return false;
}

// The strict pin schema (round-3): anything short of this exact shape is an
// INVALID pin — never partially trusted, never silently coerced (the old
// behaviour defaulted a malformed rosterGeneration/writtenAt/by to null/
// skipped fields rather than refusing the pin outright).
function isValidPinShape(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (typeof obj.projectDir !== 'string') return false;
  if (typeof obj.manifestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(obj.manifestSha256)) return false;
  if (obj.roster !== 'new' && obj.roster !== 'legacy') return false;
  if (!Number.isInteger(obj.rosterGeneration) || obj.rosterGeneration < 0) return false;
  if (typeof obj.writtenAt !== 'string' || Number.isNaN(Date.parse(obj.writtenAt))) return false;
  if (typeof obj.by !== 'string') return false;
  return true;
}

// Third pin lookup key (round-3), tried only after the path and id keys both
// miss: the project's own git root commit. Covers a project that has moved
// AND carries no projectId (or whose id-keyed pin was lost) but is still the
// same git history. `real` is already the resolved project directory.
function gitRootPinFileFor(real, dir) {
  let r;
  try {
    r = spawnSync('git', ['-C', real, 'rev-list', '--max-parents=0', 'HEAD'], { encoding: 'utf8' });
  } catch (_) {
    return null;
  }
  if (!r || r.error || r.status !== 0) return null;
  const firstLine = String(r.stdout || '').split('\n')[0].trim();
  if (!/^[0-9a-f]{7,40}$/i.test(firstLine)) return null;
  const hash = crypto.createHash('sha256').update(firstLine, 'utf8').digest('hex');
  return path.join(dir, 'git-' + hash + '.json');
}

// Candidate pin directory — env var verbatim if set, else the default.
// Existence is checked separately (loadPin()), never here: a nonexistent
// ORCHESTRA_PIN_DIR must read as "no pin dir", not silently fall back to the
// default (mirrors hooks/orchestra-guard.js's pinDir()/loadPin() split).
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

// sha256 of the project's REAL path (resolves symlinks/junctions), so the
// same project reached by two different paths shares one pin. Falls back to
// path.resolve() only when the directory cannot be stat'd (e.g. a runtime
// constructed against a not-yet-created project dir) — such a project could
// never have a real pin written for it anyway, so this only ever affects
// the "no pin found" branch below.
function realDir(projectDir) {
  try {
    return fs.realpathSync(projectDir);
  } catch (_) {
    return path.resolve(projectDir);
  }
}

function pinFileFor(projectDir) {
  const hash = crypto.createHash('sha256').update(realDir(projectDir)).digest('hex');
  return path.join(pinDir(), hash + '.json');
}

function objOrNull(o) {
  return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
}

// Resolves the owner pin for `real` (the project's resolved path), trying
// the path key first and — only if that misses, and `cfg` carries a
// projectId — the id key. Returns a discriminated result exactly like
// hooks/orchestra-guard.js's loadPin():
//   { found: false }
//   { found: true, valid: false, reason }
//   { found: true, valid: true, foundBy: 'path'|'id', pin: {...} }
// A corrupt/forged pin NEVER collapses to `{ found: false }` — that
// collapse is the exact hole this mirrors the guard in closing.
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
    // Third lookup key (round-3), tried only once path and id both miss.
    const gitPinPath = gitRootPinFileFor(real, dir);
    if (gitPinPath && fs.existsSync(gitPinPath)) {
      pinFilePath = gitPinPath;
      foundBy = 'git';
    }
  }
  if (pinFilePath === null) return { found: false };

  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(pinFilePath, 'utf8'));
  } catch (_) {
    return { found: true, valid: false, reason: 'corrupt pin' };
  }
  // Strict schema (round-3): anything short of the full shape is an invalid
  // pin — never partially trusted via defaulted/coerced fields.
  if (!isValidPinShape(obj)) {
    return { found: true, valid: false, reason: 'corrupt pin' };
  }
  const pin = {
    projectDir: obj.projectDir,
    roster: obj.roster,
    seats: objOrNull(obj.seats),
    rosterGeneration: obj.rosterGeneration,
    manifestSha256: obj.manifestSha256,
  };
  // Forged-pin check: when found by the PATH key, the pin's own projectDir
  // must agree with the path that produced the hash — a mismatch means the
  // pin file's *contents* were tampered with independent of its filename.
  // Found-by-ID or found-by-GIT-ROOT pins are exempt (that disagreement IS
  // the moved-project case) but still require the manifest hash to match
  // for trust.
  if (foundBy === 'path' && pin.projectDir !== real) {
    return { found: true, valid: false, reason: 'pin projectDir does not match this project' };
  }
  return { found: true, valid: true, foundBy, pin };
}

function readTrustedManifest({ projectDir } = {}) {
  const empty = () => ({ manifest: {}, trusted: false, roster: 'legacy', rosterGeneration: null, seats: {}, reason: 'unpinned', moved: false });
  if (!projectDir || typeof projectDir !== 'string') return empty();

  const real = realDir(projectDir);

  let manifestBytes = null;
  try {
    manifestBytes = fs.readFileSync(path.join(projectDir, ...MANIFEST_REL));
  } catch (_) {
    manifestBytes = null; // missing/unreadable manifest
  }
  let cfg = null;
  if (manifestBytes !== null) {
    try {
      const parsed = JSON.parse(manifestBytes.toString('utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) cfg = parsed;
    } catch (_) {
      cfg = null; // invalid JSON — treated as "no manifest" for reading purposes below
    }
  }

  const pinResult = loadPin(real, cfg);

  if (!pinResult.found) {
    // (a) No pin resolves by any key. Round-3: the trigger for "this project
    // claims roster:new" is the fingerprint (hasRosterNewFingerprint), not
    // just the manifest's own contested `roster` field — see that function's
    // doc comment. Forcing this to LEGACY would be exactly the "delete the
    // pin" bypass the guard's fix-2A closes — force NEW instead, untrusted.
    if (hasRosterNewFingerprint(projectDir, cfg)) {
      return {
        manifest: cfg || {},
        trusted: false,
        roster: 'new',
        rosterGeneration: cfg && typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : null,
        seats: (cfg && objOrNull(cfg.seats)) || {},
        reason: 'installed roster:new project without a pin',
        moved: false,
      };
    }
    if (!cfg) return empty();
    return {
      manifest: cfg,
      trusted: false,
      roster: 'legacy',
      rosterGeneration: typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : null,
      seats: objOrNull(cfg.seats) || {},
      reason: 'unpinned',
      moved: false,
    };
  }

  if (!pinResult.valid) {
    // (d) A pin file exists but is corrupt, unparseable, forged, or fails the
    // round-3 strict schema. Never collapses to (a) — see loadPin()'s doc
    // comment. NEVER reason:'unpinned'. Unconditionally fail-closed
    // (roster:'new') regardless of fingerprint: a pin file's mere existence
    // signals this project was pinned at some point, so failing toward
    // enforcement is the safe direction (round-3 rule (ii): an invalid pin
    // is always untrusted-new).
    return {
      manifest: cfg || {},
      trusted: false,
      roster: 'new',
      rosterGeneration: null,
      seats: {},
      reason: pinResult.reason,
      moved: false,
    };
  }

  const pin = pinResult.pin;
  const moved = (pinResult.foundBy === 'id' || pinResult.foundBy === 'git') && pin.projectDir !== real;

  const manifestSha256 = manifestBytes ? crypto.createHash('sha256').update(manifestBytes).digest('hex') : null;
  const hashMatches =
    !!manifestSha256 && typeof pin.manifestSha256 === 'string' && pin.manifestSha256.toLowerCase() === manifestSha256;

  if (hashMatches) {
    // (b) Pin present and valid, manifest bytes hash-match: honour the
    // manifest fully; roster always comes from the pin (by construction
    // this equals the manifest's own roster once the hash matches).
    return {
      manifest: cfg,
      trusted: true,
      roster: pin.roster,
      rosterGeneration: typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : pin.rosterGeneration,
      seats: objOrNull(cfg.seats) || pin.seats || {},
      reason: moved ? 'project moved since pinning' : null,
      moved,
    };
  }

  // (c) Pin present and valid, manifest missing/unreadable/hash-mismatched:
  // the manifest is UNTRUSTED. roster/seats/rosterGeneration come from the
  // pin, not the manifest.
  return {
    manifest: cfg || {},
    trusted: false,
    roster: pin.roster,
    rosterGeneration: pin.rosterGeneration,
    seats: pin.seats || {},
    reason: 'manifest untrusted (hash mismatch)' + (moved ? ' [project moved since pinning]' : ''),
    moved,
  };
}

module.exports = { readTrustedManifest, pinFileFor, pinDir };
