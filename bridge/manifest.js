#!/usr/bin/env node
/**
 * WO-14b leg 4b — owner-pinned manifest trust.
 *
 * bridge/runtime.js (and the engine server's readOrchestraManifest()) must
 * never take `.claude/orchestra.json`'s word for its own roster/generation/
 * seats: roster/wo14b-leg3-redteam-1.md's [HIGH] finding ("in-project
 * manifest tampering / owner-pinning ... not owner-pinned today; the pin is
 * a leg-4 requirement") showed an unpinned manifest can be silently
 * tampered with (or simply corrupted) to change a project's activation
 * state with nothing to detect it. install.js (leg 4c) writes a PIN — a
 * file OUTSIDE the project tree, named by a hash of the project's own real
 * path, recording the manifest bytes' own hash plus the values the
 * installer wrote — the moment it sets roster:new; the guard and this
 * runtime verify the live manifest against it before trusting anything the
 * manifest says. This module is the one place that reconciles the two.
 *
 * Pin file:    <PIN_DIR>/<sha256(realpath(projectDir)), lowercase hex>.json
 * PIN_DIR:     process.env.ORCHESTRA_PIN_DIR ||
 *              path.join(os.homedir(), '.claude', 'orchestra', 'pins')
 * Pin content: { projectDir, manifestSha256, roster, rosterGeneration,
 *                seats, writtenAt, by }
 *              (manifestSha256 is the sha256, lowercase hex, of the
 *              manifest FILE'S BYTES at the moment the pin was written.)
 *
 * Trust rules (readTrustedManifest()):
 *   - no pin file at all             -> roster forced 'legacy' regardless of
 *                                        what the manifest says (the gate is
 *                                        inert), trusted:false,
 *                                        reason:'unpinned'.
 *   - pin present, hash matches      -> trusted:true; roster/rosterGeneration/
 *                                        seats come from the manifest.
 *   - pin present, manifest missing/
 *     unreadable/hash mismatch       -> trusted:false; roster/rosterGeneration/
 *                                        seats come from the PIN instead (the
 *                                        manifest is not trusted enough to
 *                                        read even its OWN roster field from),
 *                                        reason:'manifest untrusted (hash
 *                                        mismatch)'. Callers (bridge/runtime.js)
 *                                        fail every gate/dispatch/ticket
 *                                        decision closed whenever this leaves
 *                                        roster:'new'.
 *
 * This module only READS the pin and the manifest. Writing the pin is
 * install.js's job (leg 4c) — not this leg's FILES list.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_REL = ['.claude', 'orchestra.json'];

function pinDir() {
  return process.env.ORCHESTRA_PIN_DIR || path.join(os.homedir(), '.claude', 'orchestra', 'pins');
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

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return undefined; // absent, unreadable, or invalid JSON alike
  }
}

function unpinned() {
  return { manifest: {}, trusted: false, roster: 'legacy', rosterGeneration: null, seats: {}, reason: 'unpinned' };
}

function readTrustedManifest({ projectDir } = {}) {
  if (!projectDir || typeof projectDir !== 'string') return unpinned();

  const pinPath = pinFileFor(projectDir);
  let pinExists = false;
  try {
    pinExists = fs.existsSync(pinPath);
  } catch (_) {
    pinExists = false;
  }
  if (!pinExists) return unpinned();

  // A pin file exists but is unreadable/corrupt JSON: treated as a PRESENT
  // pin (never silently downgraded to "unpinned", which would re-open the
  // exact inert-gate hole the pin exists to close) whose own manifestSha256
  // is simply absent — the hash-compare below then always misses, landing
  // on the untrusted branch.
  const pin = readJsonSafe(pinPath) || {};

  let manifestRaw = null;
  try {
    manifestRaw = fs.readFileSync(path.join(projectDir, ...MANIFEST_REL));
  } catch (_) {
    manifestRaw = null; // missing/unreadable manifest — falls through to the untrusted branch below
  }
  let manifest = {};
  if (manifestRaw) {
    try {
      const parsed = JSON.parse(manifestRaw.toString('utf8'));
      manifest = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      manifest = {};
    }
  }

  const manifestSha256 = manifestRaw ? crypto.createHash('sha256').update(manifestRaw).digest('hex') : null;
  const hashMatches =
    !!manifestSha256 && typeof pin.manifestSha256 === 'string' && pin.manifestSha256.toLowerCase() === manifestSha256;

  if (hashMatches) {
    return {
      manifest,
      trusted: true,
      roster: manifest.roster === 'new' ? 'new' : 'legacy',
      rosterGeneration: typeof manifest.rosterGeneration === 'number' ? manifest.rosterGeneration : null,
      seats: manifest.seats && typeof manifest.seats === 'object' && !Array.isArray(manifest.seats) ? manifest.seats : {},
      reason: null,
    };
  }

  return {
    manifest,
    trusted: false,
    roster: pin.roster === 'new' ? 'new' : 'legacy',
    rosterGeneration: typeof pin.rosterGeneration === 'number' ? pin.rosterGeneration : null,
    seats: pin.seats && typeof pin.seats === 'object' && !Array.isArray(pin.seats) ? pin.seats : {},
    reason: 'manifest untrusted (hash mismatch)',
  };
}

module.exports = { readTrustedManifest, pinFileFor, pinDir };
