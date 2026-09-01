#!/usr/bin/env node
/**
 * WO-14b leg 4b/4c — owner-pinned manifest trust.
 *
 * bridge/runtime.js (and the engine server's readOrchestraManifest()) must
 * never take `.claude/orchestra.json`'s word for its own roster/generation/
 * seats: roster/wo14b-leg3-redteam-1.md's [HIGH] finding ("in-project
 * manifest tampering / owner-pinning ... not owner-pinned today; the pin is
 * a leg-4 requirement") showed an unpinned manifest can be silently
 * tampered with (or simply corrupted) to change a project's activation
 * state with nothing to detect it. install.js writes a PIN — a file OUTSIDE
 * the project tree, named by a hash of the project's own real path (or, for
 * a project that has moved since it was pinned, its stable projectId),
 * recording the manifest bytes' own hash plus the values the installer
 * wrote — the moment it sets roster:new; the guard (hooks/orchestra-
 * guard.js's loadPin()/loadPolicy()) and this runtime verify the live
 * manifest against it before trusting anything the manifest says. This
 * module is the one place that reconciles the two for bridge/runtime.js and
 * the engine server; hooks/orchestra-guard.js implements the identical
 * rules independently (it cannot require() a project file before it knows
 * one exists) — the two are pinned to agree by tests/guard.test.js and
 * tests/bridge.test.js alike. WO-14b leg 4c aligns this module to the
 * guard's fix-2A pin rules exactly (see below); the two MUST never diverge
 * again — a manifest a request the guard denies but the bridge would honour
 * (or vice versa) reopens exactly the tampering hole the pin exists to
 * close.
 *
 * Pin file, by resolved project path:
 *   <PIN_DIR>/<sha256(realpath(projectDir)), lowercase hex>.json
 * Pin file, by project id (a project that has MOVED since it was pinned):
 *   <PIN_DIR>/id-<sha256(manifest.projectId), lowercase hex>.json — tried
 *   only when the path-keyed file is absent and the manifest carries a
 *   projectId.
 * PIN_DIR: process.env.ORCHESTRA_PIN_DIR, honoured ONLY if that directory
 *   actually exists — an env var pointing at a nonexistent directory is "no
 *   pin dir", same as none configured — else
 *   path.join(os.homedir(), '.claude', 'orchestra', 'pins').
 * Pin content: { projectDir, manifestSha256, roster, rosterGeneration,
 *                seats, writtenAt, by }
 *              (manifestSha256 is the sha256, lowercase hex, of the
 *              manifest FILE'S BYTES at the moment the pin was written.)
 *
 * Trust rules (readTrustedManifest()) — mirrors hooks/orchestra-guard.js's
 * loadPin()/loadPolicy() cases (a)/(b)/(c)/(d) exactly:
 *   (a) no pin resolves by either key (including "no pin dir"):
 *       - manifest present and claims roster:"new" -> UNTRUSTED-NEW, fail
 *         closed: trusted:false, roster:'new' (never a silent legacy
 *         downgrade — that used to be the "delete the pin" bypass),
 *         reason:'manifest claims new without a pin'.
 *       - otherwise (no manifest, or manifest claims legacy) ->
 *         trusted:false, roster:'legacy', reason:'unpinned' — inert, not
 *         fail-closed (an unpinned "legacy" install is the default-on-
 *         request posture, not an enforcement boundary).
 *   (b) pin resolves, is well-formed, and (if found by the PATH key) its own
 *       projectDir agrees with the resolved project path, and the
 *       manifest's bytes hash to pin.manifestSha256 -> trusted:true;
 *       roster/rosterGeneration/seats come from the manifest (rosterGeneration/
 *       seats fall back to the pin's own copy if the manifest omits them);
 *       roster always the PIN's roster (matches by construction once
 *       trusted, since the hash-match means the manifest is byte-identical
 *       to what was pinned). A pin found by the ID key needs no projectDir
 *       agreement (that disagreement IS the moved-project case) but still
 *       needs the hash match for trust; reason carries
 *       'project moved since pinning' when moved (informational, not an
 *       error).
 *   (c) pin resolves and is well-formed, but the manifest is missing/
 *       unreadable/hash-mismatched -> UNTRUSTED: trusted:false,
 *       roster/rosterGeneration/seats come from the PIN instead (the
 *       manifest is not trusted enough to read even its own roster field
 *       from), reason:'manifest untrusted (hash mismatch)'.
 *   (d) a pin FILE resolves (by either key) but is corrupt/unparseable, has
 *       an invalid roster value, or — found by the PATH key — its own
 *       projectDir disagrees with the resolved project path (a forged pin)
 *       -> UNTRUSTED, roster forced to 'new' (fail closed — a pin file's
 *       mere existence signals this project was pinned at some point, so
 *       failing toward enforcement is the safe direction), reason names the
 *       specific defect ('corrupt pin' / 'pin projectDir does not match
 *       this project') and is NEVER 'unpinned' — a corrupt/forged pin is
 *       never silently treated as "no pin" (that collapse used to make
 *       deleting the pin strictly better, for an attacker, than editing the
 *       manifest).
 *
 * This module only READS the pin and the manifest. Writing the pin is
 * install.js's job (writePin()/writeManifestAndPin()).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_REL = ['.claude', 'orchestra.json'];

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
  if (obj.roster !== 'new' && obj.roster !== 'legacy') {
    return { found: true, valid: false, reason: 'corrupt pin' };
  }
  const pin = {
    projectDir: typeof obj.projectDir === 'string' ? obj.projectDir : null,
    roster: obj.roster,
    seats: objOrNull(obj.seats),
    rosterGeneration: typeof obj.rosterGeneration === 'number' ? obj.rosterGeneration : null,
    manifestSha256: typeof obj.manifestSha256 === 'string' ? obj.manifestSha256 : null,
  };
  // Forged-pin check: when found by the PATH key, the pin's own projectDir
  // must agree with the path that produced the hash — a mismatch means the
  // pin file's *contents* were tampered with independent of its filename.
  // Found-by-ID pins are exempt (that disagreement IS the moved-project
  // case) but still require the manifest hash to match for trust.
  if (foundBy === 'path' && pin.projectDir !== real) {
    return { found: true, valid: false, reason: 'pin projectDir does not match this project' };
  }
  return { found: true, valid: true, foundBy, pin };
}

function readTrustedManifest({ projectDir } = {}) {
  const empty = () => ({ manifest: {}, trusted: false, roster: 'legacy', rosterGeneration: null, seats: {}, reason: 'unpinned' });
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
    // (a) No pin resolves by either key.
    if (cfg && cfg.roster === 'new') {
      // Fail-closed sub-case: the manifest itself claims roster:new but
      // nothing outside the project backs that claim. Forcing this to
      // LEGACY would be exactly the "delete the pin" bypass the guard's
      // fix-2A closes — force NEW instead, untrusted.
      return {
        manifest: cfg,
        trusted: false,
        roster: 'new',
        rosterGeneration: typeof cfg.rosterGeneration === 'number' ? cfg.rosterGeneration : null,
        seats: objOrNull(cfg.seats) || {},
        reason: 'manifest claims new without a pin',
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
    };
  }

  if (!pinResult.valid) {
    // (d) A pin file exists but is corrupt, unparseable, or forged. Never
    // collapses to (a) — see loadPin()'s doc comment. NEVER reason:'unpinned'.
    return {
      manifest: cfg || {},
      trusted: false,
      roster: 'new',
      rosterGeneration: null,
      seats: {},
      reason: pinResult.reason,
    };
  }

  const pin = pinResult.pin;
  const moved = pinResult.foundBy === 'id' && pin.projectDir !== real;

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
  };
}

module.exports = { readTrustedManifest, pinFileFor, pinDir };
