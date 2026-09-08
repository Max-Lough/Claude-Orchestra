'use strict';

// Shared between orchestra-review.js and orchestra-exec.js: reading the
// install's own manifest for where Codex ships its Windows helpers, and
// deciding whether a helpersDir repair-kit entry duplicates what that
// manifest already carries. Moved out of orchestra-review.js (2026-09-07) so
// both runners' restoreHelpers() read the same manifest the doctor does,
// rather than the review runner alone knowing about it — see
// carriedByPackage below for why that mattered.

const fs = require('fs');
const path = require('path');

// Is `child` inside `parent`? Hoisted out of verifyHelperSiblings so the
// manifest reader below can share the one containment test rather than grow a
// second, subtly different copy.
function pathUnder(parent, child) {
  try {
    const rel = path.relative(path.resolve(parent), path.resolve(child));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch (_) {
    return false;
  }
}

// FIX (2026-09-07, codex-cli 0.153.4): the helper-sibling check demanded these
// files sit in `bin\` beside `codex.exe`, and every self-update was read as
// "the update stripped them". It never did. Codex ships them in a resources
// directory declared by the install's own manifest — `codex-package.json`
// (`layoutVersion: 1`, present unchanged in every release on this machine back
// to 0.145.0) carries `resourcesDir: "codex-resources"`, a SIBLING of `bin\`,
// and 0.153.4 resolves them from there with nothing in `bin\` at all (verified:
// a sandboxed `codex exec` established the workspace-write sandbox and ran its
// command on a stock install whose `bin\` held only the two shipped exes).
//
// The stale expectation was not merely noisy, it was harmful. Every release
// dir here whose `bin\` DOES hold these files got them from a past repair, and
// those copies are byte-identical across 0.151.0/0.153.0/0.153.2 — frozen at
// the 0.147.0-era build. So the repair the doctor recommended would have copied
// a 0.147.0 `codex-command-runner.exe` into a 0.153.4 install: precisely the
// version skew the WO-11 investigation traced to the "intermittent codex
// sandbox fault" (that helper rejects the newer CLI's spawn protocol v6). The
// check was manufacturing the bug it existed to catch.
//
// Read the manifest instead of assuming a location, so the NEXT relayout is
// followed rather than fought. Returns `{ dir, name }` for each declared
// resources directory that actually exists — `dir` canonical (what to read
// files out of), `name` the DECLARED last segment (what the directory is called
// inside the package). An install without a manifest yields none and the caller
// falls back to the beside-the-binary rule unchanged.
//
// FIX (Sol review, round 2): an earlier version returned only the canonical
// path, which silently renames the directory whenever it is reached through an
// in-package link. A valid `codex-resources -> assets` junction canonicalises to
// `assets`, the `codex-resources` helper entry then matched nothing, and the
// doctor called a healthy install broken — worse, a repairing run copied the
// whole resources tree into `bin\codex-resources` and reported a repair it had
// no business making. Both names are load-bearing, so both are kept.
function packagedResourceDirs(installDir) {
  const out = [];
  // The manifest sits at the package root: one level above `bin\`. Check the
  // install dir itself too, for a layout that does not nest the binary.
  for (const root of [path.dirname(installDir), installDir]) {
    if (!root) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'codex-package.json'), 'utf8'));
    } catch (_) {
      continue; // no manifest here, or unreadable/not JSON: not an error
    }
    const rel = manifest && typeof manifest.resourcesDir === 'string' ? manifest.resourcesDir.trim() : '';
    if (!rel) continue;
    const dir = path.resolve(root, rel);
    // A manifest is a hint, not authority over the filesystem: only accept a
    // path that stays inside the package and is really a directory.
    //
    // FIX (Sol review): `pathUnder` is LEXICAL, and a lexical test is not a
    // containment test on a filesystem that has links. A `codex-resources`
    // junction sitting inside the package can point anywhere on the disk —
    // `path.resolve` never leaves the package, `statSync` follows the junction,
    // and helpers from an arbitrary directory were accepted as the install's
    // own. Resolve BOTH sides to their real paths first, so the check
    // constrains where the files actually are rather than how they are named.
    let realDir;
    let realRoot;
    try {
      realDir = fs.realpathSync(dir);
      realRoot = fs.realpathSync(root);
    } catch (_) {
      continue; // does not exist, or unreadable: not a candidate, not an error
    }
    if (!pathUnder(realRoot, realDir)) continue;
    try {
      if (!fs.statSync(realDir).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    // `name` comes from the DECLARED path, not the canonical one: it is what
    // the directory is called inside the package, which is the name a
    // helperSiblings entry like `codex-resources` refers to.
    //
    // FIX (Sol review, round 3): de-duplicate on the PAIR, not the directory.
    // Two manifests (package root and install dir) may declare different
    // aliases that resolve to the same canonical directory; keying on the
    // directory alone kept whichever was seen first and silently dropped the
    // other alias — the very name a helper entry might refer to, which the
    // doctor then called missing and the repairing path copied into `bin\`.
    const declaredName = path.basename(dir);
    if (!out.some((e) => e.dir === realDir && e.name === declaredName)) {
      out.push({ dir: realDir, name: declaredName });
    }
  }
  return out;
}

// FIX (field, 2026-09-07): restoreHelpers() in both runners copied every
// helpersDir entry that was missing (or size-differed) from `bin\`, even one
// the install's own manifest (packagedResourceDirs, above) already carries in
// its declared resources directory — a SIBLING of `bin\`, never something to
// copy into it. That is exactly the version-skew route the manifest-based
// doctor fix exists to close, left open: a stale helpersDir kit re-injects an
// old build into `bin\` where Codex loads it ahead of (or beside) the
// packaged, current one. Observed 2026-09-07 15:48: a sibling project's exec
// lane, with helpersDir pointing at a 0.147-era kit, copied the whole kit —
// including a `bin\codex-resources\` subtree and a stray
// `codex-command-runner.exe.bak-0147era` — into a live 0.153.4 install's
// `bin\` while a review ran here.
//
// FIX (Sol review round 2, 2026-09-07): declared-name comparisons were exact
// (`===`), so a helpersDir entry spelled in a different case than the
// manifest's declared name — `CODEX-RESOURCES` against a declared
// `codex-resources` — matched nothing and was treated as a genuinely new
// file to copy in, precisely the stale-kit reinjection this whole check
// exists to stop. `fs.existsSync` is already case-insensitive on Windows (the
// filesystem resolves it that way), so only the declared-name compare needed
// this; a single shared helper keeps orchestra-review.js's copy of the same
// compare (the `shadowed` detection and the packaged match) from drifting
// from this one.
function sameName(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return a === b;
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// A helpersDir entry is carried by the package when either: the package
// declares a resources directory called exactly this (nothing to copy — the
// directory named `codex-resources` in helpersDir is the same thing the
// manifest's `codex-resources` already resolves to, whatever their contents),
// or a file of this name exists inside any packaged directory (the packaged
// file is the one Codex ships and resolves; a size difference against
// helpersDir is not a reason to prefer the older kit — a byte-identical stale
// copy would be exactly as wrong). Size is therefore not part of this check.
function carriedByPackage(name, packaged) {
  return (packaged || []).some(
    (d) => sameName(d.name, name) || fs.existsSync(path.join(d.dir, name))
  );
}

module.exports = { pathUnder, packagedResourceDirs, carriedByPackage, sameName };
