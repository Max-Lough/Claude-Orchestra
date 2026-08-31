#!/usr/bin/env node
/**
 * WO-12 seeded-defect corpus (SDC) materializer — protocol §2, §4
 * (`../wo12-protocol.md`), including §2.1's round-2 pre-run amendment.
 *
 * Given `corpus/key.json` (schema: `corpus/key.schema.md`) and, for a seeded
 * artifact, `corpus/<id>.patch` (a unified diff `base -> variant`), this
 * script produces the ONE thing the review runner actually needs: a real
 * commit, in a real git history, that `orchestra-review.js --base-ref
 * --head-ref` can pin to. It never invents a fake tree — the whole point of
 * the SDC is that a reviewer sees an ordinary commit, not a synthetic diff
 * blob.
 *
 *   node build-corpus.js --id <id> [--clone-root <dir>] [--key <path>]
 *                                  [--run-clone-root <dir>]
 *   node build-corpus.js --all     [--clone-root <dir>] [--key <path>]
 *
 * WHERE IT WORKS: a throwaway clone of THIS repository under
 * os.tmpdir()/orchestra-wo12-<random>/ (or --clone-root, which is created if
 * absent and REUSED if it already looks like a clone of the same source — so
 * --all and repeated --id calls in a phase do not re-clone history every
 * time). The clone is NEVER placed inside this repository — a worktree/clone
 * nested in the tree under review is itself session dirt, the same reasoning
 * `orchestra-review.js`'s pinned mode already applies to its own scratch
 * worktrees.
 *
 * WHAT IT DOES, per artifact:
 *   1. reset --hard + clean -fdx the build clone (leftover state from a prior
 *      artifact in a reused clone must not leak into this one);
 *   2. checkout --detach <base> (the seed's/control's parent commit);
 *   3. CONTROL (kind:"control", no patch): head = `commit` verbatim — the
 *      real historical commit, unmodified. Nothing is re-created.
 *   4. SEEDED (kind:"seeded"): `git apply --index corpus/<id>.patch`, verify
 *      the staged diff is non-empty (a patch that applies but changes
 *      nothing is a construction bug, not a variant — fails closed), then
 *      commit AS THE REAL COMMIT C: C's own author name/email/date, C's own
 *      committer name/email/date, and C's FULL message body, byte-for-byte
 *      (`git log -1 --format=…` + `%B`, committed with `-F <file>
 *      --cleanup=verbatim`).
 *
 *      *(Round-2 amendment, protocol §2.1(i), after the round-1 R0 review's
 *      CRITICAL 2: the round-1 fixed "WO-12 seeder <wo12@orchestra.local>"
 *      identity, its single constant future date, and its one-line message
 *      separated seeded from control at 100% precision and 100% recall in
 *      `git log -1` — four independent tells on all 30 seeds and zero
 *      controls. The reproducibility property the fixed identity existed for
 *      is satisfied by ANY fixed choice, and C's own metadata is fixed: it is
 *      read out of the history both populations are drawn from, so a seed's
 *      `git log -1` is now shaped exactly like a control's.)*
 *
 *      Every git invocation that touches the clone — the clone itself
 *      included — pins `commit.gpgsign=false`, `core.autocrlf=false`,
 *      `core.eol=lf` and `core.safecrlf=false`, and the commit runs
 *      `--no-verify`. A commit's sha is content-addressed from {tree, parent,
 *      author, committer, message}: the identity and message are now read
 *      from C itself, the parent is the pinned base, and the TREE is the one
 *      thing a machine's own git config could otherwise move — an
 *      `autocrlf=true` checkout writes different bytes for the same blob, and
 *      a `core.hooksPath` `commit-msg` hook can append a trailer. Both are
 *      pinned off here (round-2, R0 MAJOR 12), so the SAME (base, patch) pair
 *      re-materializes to the SAME head sha in any clone, on any machine,
 *      whatever the local config says. That is the reproducibility property
 *      run-lane.js and score.js rely on to talk about "the same artifact"
 *      across separate runs.
 *   5. SANITIZE (protocol §2.1(ii), round-2 amendment, after the round-1 R0
 *      review's CRITICAL 3): the directory handed to the review runner is
 *      NEVER the build clone. `prepareRunClone()` makes a fresh single-branch
 *      clone carrying only the pinned head's ancestry, then strips it: the
 *      remote is removed, every branch and tag is deleted, reflogs are
 *      expired and unreachable objects pruned. It then ASSERTS the result —
 *      no refs at all, nothing reachable beyond HEAD's own ancestry, HEAD
 *      still resolvable, and `key.json`'s blob (computed with `git
 *      hash-object` on the real file) NOT present in the object store. This
 *      runs for CONTROLS too, so both kinds present identically: §2.1's
 *      guarantee that the checkout "never sees wo12/" now holds for `.git`,
 *      not merely for the working tree.
 *
 * Prints one JSON line per artifact: {id, base, head, cloneDir, runCloneDir?}.
 * --all also writes corpus/materialized.json (array, same shape, corpus
 * order) next to key.json.
 *
 * House rules: zero dependencies, CommonJS, same voice as
 * probes/orchestra-probe-review.js. Nothing outside
 * plans/cross-compare/agent-role-architecture/wo12/ is touched.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;

// Config pinned on EVERY git invocation that touches a wo12 clone (round-2,
// R0 MAJOR 12 + CRITICAL 2). Each of these can otherwise move the head sha
// on one machine only:
//   commit.gpgsign   — a signature makes the sha depend on the signing key
//                      and the signing clock of whoever ran the seeder;
//   core.autocrlf    — a Windows clone with autocrlf=true writes CRLF into
//                      the working tree and can normalize differently on the
//                      way back in, so the same patch lands a different tree;
//   core.eol         — the same, for paths carrying a `.gitattributes`
//                      `text` declaration;
//   core.safecrlf    — an unrelated machine's `true`/`warn` turns a
//                      mixed-ending patch into a hard error rather than a
//                      byte-identical apply.
// `--no-verify` on the commit itself closes the last one: a global
// `core.hooksPath` with a `commit-msg` hook that appends a trailer
// (Change-Id, Signed-off-by) rewrites the message, and therefore the sha, on
// that machine alone.
// `i18n.commitEncoding` is the fifth, found by the cross-vendor R0 lane
// (`roster/wo12-r0-review-openai-2.md`, MAJOR at build-corpus.js:196): git
// stamps a non-UTF-8 value into the commit object as an `encoding` header and
// re-encodes the message bytes, so the SAME base and patch materialized to
// `15ff0b6…` under `UTF-8` and `12b8017…` under `ISO-8859-1`. Pinned, along
// with `i18n.logOutputEncoding` so the metadata this script READS back is the
// same bytes it wrote.
const GIT_PINS = [
  '-c', 'commit.gpgsign=false',
  '-c', 'core.autocrlf=false',
  '-c', 'core.eol=lf',
  '-c', 'core.safecrlf=false',
  '-c', 'i18n.commitEncoding=utf-8',
  '-c', 'i18n.logOutputEncoding=utf-8',
];

// The path whose blob must be absent from every sanitized run clone's object
// store — the sealed answer key. Asserted, not assumed (round 2, CRITICAL 3).
const KEY_REL_PATH = 'plans/cross-compare/agent-role-architecture/wo12/corpus/key.json';

// The temporary branch name prepareRunClone() uses to hand a specific commit
// to `git clone --single-branch --branch`. It exists only inside the build
// clone, for the duration of one clone call, and is deleted afterwards; it
// never reaches a run clone (which is stripped of every ref).
const RUN_BRANCH = 'wo12-run';

function fail(msg) {
  const e = new Error(msg);
  e.wo12BuildCorpus = true;
  throw e;
}

// -------------------------------------------------------------------- git

function git(dir, args) {
  return spawnSync('git', GIT_PINS.concat(['-C', dir]).concat(args), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function gitOrThrow(dir, args, desc) {
  const r = git(dir, args);
  // `r.error` is a spawn failure (git not on PATH, EACCES) — a different
  // failure from a non-zero exit, and one every caller wants surfaced, not
  // just gitOrThrow's (round-2 nit: `git()`'s bare callers used to swallow
  // it). Both arms fail closed here, and `git()` itself is now only ever
  // called by helpers that check `.status` explicitly.
  if (r.error) fail(desc + ': spawn failed: ' + r.error.message);
  if (r.status !== 0) {
    fail(desc + ' (git ' + args.join(' ') + ' in ' + dir + '):\n' + (r.stderr || r.stdout || '(no output)'));
  }
  return r.stdout || '';
}

// The repository this script lives in — the default clone source. Resolved
// via git itself rather than path arithmetic up from __dirname, so it is
// right even if wo12/ ever moves.
function detectRepoRoot() {
  const r = spawnSync('git', ['-C', HERE, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.status !== 0) fail('cannot detect the repository root from ' + HERE + ' (git rev-parse --show-toplevel failed): ' + (r.stderr || ''));
  return r.stdout.trim();
}

// -------------------------------------------------------------------- clone

// realpath where the path exists, plain resolve where it does not — a
// junction or symlink into the repository must not be able to walk past the
// nesting guard below (round-2 MINOR: `path.relative` alone compares the
// spelling, not the identity).
function realResolve(p) {
  const abs = path.resolve(p);
  try { return fs.realpathSync.native ? fs.realpathSync.native(abs) : fs.realpathSync(abs); }
  catch (e) { return abs; }
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Creates (or, if --clone-root already looks like a clone OF THIS SOURCE,
// REUSES) a throwaway clone of `sourceRepo` at `cloneDir`. Never called with
// a cloneDir inside `sourceRepo`.
function ensureClone(sourceRepo, cloneDir) {
  const resolvedSource = realResolve(sourceRepo);
  const resolvedClone = realResolve(cloneDir);
  if (isInside(resolvedSource, resolvedClone) || resolvedSource === resolvedClone) {
    fail('refusing to clone into ' + resolvedClone + ' — it is INSIDE the source repository ' + resolvedSource +
      '. The scratch clone must never be nested in the tree under review.');
  }
  if (fs.existsSync(path.join(resolvedClone, '.git'))) {
    // Round-2 MINOR: a reused directory used to be accepted on the mere
    // presence of `.git`. An unrelated repository passed as --clone-root, or
    // a clone made before the bases under test existed, would then either
    // fail cryptically deep inside materializeArtifact or (worse) silently
    // resolve a same-named sha from another history. Verify the origin and
    // refresh it instead.
    const originR = git(resolvedClone, ['remote', 'get-url', 'origin']);
    const origin = originR.status === 0 ? realResolve((originR.stdout || '').trim()) : null;
    if (!origin || origin !== resolvedSource) {
      fail('refusing to reuse the existing clone at ' + resolvedClone + ': its `origin` is ' +
        (origin ? origin : '(none/unreadable)') + ', not the source repository ' + resolvedSource +
        '. Point --clone-root at a fresh directory, or delete that one.');
    }
    gitOrThrow(resolvedClone, ['fetch', '--quiet', '--tags', '--force', 'origin'], 'refresh the reused clone at ' + resolvedClone);
    return { cloneDir: resolvedClone, reused: true };
  }
  fs.mkdirSync(path.dirname(resolvedClone), { recursive: true });
  const r = spawnSync('git', GIT_PINS.concat(['clone', '--quiet', resolvedSource, resolvedClone]), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) fail('git clone spawn failed: ' + r.error.message);
  if (r.status !== 0) fail('git clone ' + resolvedSource + ' -> ' + resolvedClone + ' failed:\n' + (r.stderr || ''));
  return { cloneDir: realResolve(resolvedClone), reused: false };
}

// ------------------------------------------------------- commit metadata

const META_FORMAT = '%an%n%ae%n%aI%n%cn%n%ce%n%cI';

/**
 * Reads the REAL commit C's identity fields and full message body out of the
 * clone. Round-2, protocol §2.1(i): the variant C' is committed as C, so
 * `git log -1` on a seeded head is shaped exactly like a control's.
 *
 * The body comes from `git cat-file commit` as RAW BYTES — everything after
 * the header block's terminating blank line — not from `--format=%B`, which
 * appends a record-terminating newline of its own. Committing THAT would land
 * a message one byte longer than C's: a different sha, and a visible trailing
 * blank line in `git log`, which is exactly the kind of shape difference this
 * whole change exists to remove. Carrying the buffer through unchanged also
 * reproduces a body with non-UTF-8 bytes byte-for-byte.
 */
function readCommitMetadata(cloneDir, sha) {
  const line = gitOrThrow(cloneDir, ['log', '-1', '--format=' + META_FORMAT, sha], 'read commit metadata for ' + sha);
  const parts = line.replace(/\r?\n$/, '').split(/\r?\n/);
  if (parts.length !== 6 || parts.some((p) => !p)) {
    fail('could not parse commit metadata for ' + sha + ' (got ' + JSON.stringify(line) + ')');
  }
  const raw = spawnSync('git', GIT_PINS.concat(['-C', cloneDir, 'cat-file', 'commit', sha]), { maxBuffer: 32 * 1024 * 1024 });
  if (raw.error) fail('read raw commit object for ' + sha + ': spawn failed: ' + raw.error.message);
  if (raw.status !== 0) fail('read raw commit object for ' + sha + ' failed: ' + String(raw.stderr || ''));
  const sep = raw.stdout.indexOf('\n\n');
  if (sep === -1) fail('commit object ' + sha + ' has no header/message separator — refusing to build a variant from it');
  const body = raw.stdout.slice(sep + 2);
  if (!body.toString('utf8').trim()) fail('commit ' + sha + ' has an empty message body — refusing to build a variant with no message');
  return {
    authorName: parts[0], authorEmail: parts[1], authorDate: parts[2],
    committerName: parts[3], committerEmail: parts[4], committerDate: parts[5],
    body,
  };
}

// ------------------------------------------------------------ sanitizing

function forEachRef(dir) {
  return gitOrThrow(dir, ['for-each-ref', '--format=%(refname)'], 'list refs in ' + dir)
    .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Strips a clone down to exactly one pinned head and its ancestry, then
 * PROVES it (protocol §2.1(ii), round-2, R0 CRITICAL 3). After this, a lane
 * with shell access in `dir` has no `origin/HEAD` to `git show`, no branch or
 * tag to walk, no reflog to recover from, and no unreachable object left in
 * the store — so `corpus/key.json`, the `.patch` files and the `.seed.json`
 * files are unreachable from `.git`, not merely absent from the worktree.
 *
 * `keyBlobSha` (optional) is the blob sha of the real `key.json`, computed by
 * the caller with `git hash-object` on the file itself; when supplied, its
 * ABSENCE from this clone's object store is asserted directly.
 */
function sanitizeClone(dir, head, keyBlobSha) {
  gitOrThrow(dir, ['checkout', '--quiet', '--detach', head], 'detach HEAD at ' + head + ' before sanitizing ' + dir);

  const remotes = gitOrThrow(dir, ['remote'], 'list remotes in ' + dir).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const remote of remotes) gitOrThrow(dir, ['remote', 'remove', remote], 'remove remote ' + remote + ' from ' + dir);

  for (const ref of forEachRef(dir)) {
    gitOrThrow(dir, ['update-ref', '-d', ref], 'delete ref ' + ref + ' in ' + dir);
  }

  // `git remote remove` leaves `refs/remotes/<name>/HEAD` behind as a
  // DANGLING SYMREF (it points at a ref that has just been deleted), and
  // `for-each-ref` does not list a dangling symref — so the loop above cannot
  // see it. It exposes no object, but every later git command in the clone
  // prints `warning: ignoring dangling symref refs/remotes/origin/HEAD`, and a
  // reviewer who sees that warning knows the repository was stripped, which is
  // itself a tell. Deleted explicitly, best-effort (nothing to do if absent).
  for (const remote of remotes) git(dir, ['symbolic-ref', '--delete', 'refs/remotes/' + remote + '/HEAD']);
  for (const remote of remotes) {
    const stray = path.join(dir, '.git', 'refs', 'remotes', remote);
    try { fs.rmSync(stray, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }

  gitOrThrow(dir, ['reflog', 'expire', '--expire=now', '--expire-unreachable=now', '--all'], 'expire reflogs in ' + dir);
  gitOrThrow(dir, ['gc', '--prune=now', '--quiet'], 'gc/prune unreachable objects in ' + dir);

  // --- assertions: this is the part that makes the guarantee testable.
  const leftoverRefs = forEachRef(dir);
  if (leftoverRefs.length) {
    fail('sanitize ' + dir + ': `git for-each-ref` is NOT empty after stripping — ' + leftoverRefs.join(', '));
  }
  const resolvedHead = gitOrThrow(dir, ['rev-parse', 'HEAD'], 'resolve HEAD in the sanitized clone ' + dir).trim();
  if (resolvedHead !== head) {
    fail('sanitize ' + dir + ': HEAD resolves to ' + resolvedHead + ', not the pinned head ' + head);
  }
  // `git rev-list --all` is documented as "all the refs in refs/, ALONG WITH
  // HEAD" — with every ref deleted and HEAD detached it therefore reports
  // exactly HEAD's own ancestry, never the empty set. The property that
  // matters (and that the round-2 ruling asked for under the "--all is
  // empty" wording) is that NOTHING is reachable beyond the pinned head's
  // ancestry, which is what is asserted: the two lists must be identical.
  const all = gitOrThrow(dir, ['rev-list', '--all'], 'rev-list --all in ' + dir).trim();
  const fromHead = gitOrThrow(dir, ['rev-list', 'HEAD'], 'rev-list HEAD in ' + dir).trim();
  if (all !== fromHead) {
    fail('sanitize ' + dir + ': objects are reachable beyond the pinned head\'s ancestry (rev-list --all has ' +
      all.split('\n').filter(Boolean).length + ' commit(s), rev-list HEAD has ' + fromHead.split('\n').filter(Boolean).length + ')');
  }
  if (keyBlobSha) {
    const present = git(dir, ['cat-file', '-e', keyBlobSha]);
    if (present.status === 0) {
      fail('sanitize ' + dir + ': the sealed answer key\'s blob (' + keyBlobSha + ', ' + KEY_REL_PATH +
        ') is STILL PRESENT in this clone\'s object store — the reviewer could `git cat-file -p` it.');
    }
  }
  return { dir, head, refs: leftoverRefs, keyBlobSha: keyBlobSha || null };
}

/**
 * Computes the blob sha of the real `key.json` in `sourceRepo`, for
 * sanitizeClone()'s absence assertion. Returns null when the file is not
 * there (a source tree that predates the corpus — nothing to assert).
 */
function keyBlobShaFor(sourceRepo, keyRelPath) {
  const rel = keyRelPath || KEY_REL_PATH;
  const abs = path.join(sourceRepo, rel);
  if (!fs.existsSync(abs)) return null;
  const r = spawnSync('git', ['hash-object', abs], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const sha = (r.stdout || '').trim();
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
}

/**
 * Builds the SANITIZED clone the review runner is actually pointed at: a
 * fresh single-branch clone of `buildClone` carrying only `head`'s ancestry,
 * stripped and asserted by sanitizeClone(). `--no-local` is deliberate — a
 * local clone hardlinks the WHOLE object directory, which would copy every
 * unreachable corpus object straight back in.
 */
function prepareRunClone(buildClone, head, runDir, keyBlobSha) {
  const resolvedRun = path.resolve(runDir);
  if (isInside(realResolve(buildClone), realResolve(resolvedRun))) {
    fail('refusing to build the run clone at ' + resolvedRun + ' — it is inside the build clone ' + buildClone);
  }
  if (fs.existsSync(resolvedRun)) fs.rmSync(resolvedRun, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(resolvedRun), { recursive: true });

  gitOrThrow(buildClone, ['branch', '--force', RUN_BRANCH, head], 'point ' + RUN_BRANCH + ' at ' + head + ' in the build clone');
  try {
    const r = spawnSync('git', GIT_PINS.concat([
      'clone', '--quiet', '--no-local', '--single-branch', '--branch', RUN_BRANCH, buildClone, resolvedRun,
    ]), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) fail('run-clone spawn failed: ' + r.error.message);
    if (r.status !== 0) fail('run clone ' + buildClone + ' -> ' + resolvedRun + ' failed:\n' + (r.stderr || ''));
  } finally {
    // Best effort: the temporary branch must not survive in the build clone
    // even if the clone above failed.
    git(buildClone, ['branch', '-D', RUN_BRANCH]);
  }
  sanitizeClone(resolvedRun, head, keyBlobSha);
  return resolvedRun;
}

// ------------------------------------------------------------ materialize

/**
 * Materializes ONE artifact in an already-cloned working tree. Returns
 * {id, base, head, cloneDir} — plus `runCloneDir` when `opts.runCloneDir` is
 * given, which is the SANITIZED directory a review runner may be pointed at
 * (never `cloneDir` itself). Throws (fail-closed) on anything that would
 * silently produce a wrong or empty variant, or a run clone that still
 * carries the corpus.
 */
function materializeArtifact(artifact, cloneDir, patchesDir, opts) {
  opts = opts || {};
  if (!artifact || !artifact.id) fail('materializeArtifact: artifact is missing an id');
  if (!artifact.base) fail(artifact.id + ': key.json entry has no `base` sha');

  // Leftover state from a prior artifact in a reused clone must never leak
  // into this one's tree or index.
  gitOrThrow(cloneDir, ['reset', '--hard', '--quiet'], artifact.id + ': reset working tree');
  gitOrThrow(cloneDir, ['clean', '-fdx', '--quiet'], artifact.id + ': clean untracked/ignored files');
  gitOrThrow(cloneDir, ['checkout', '--quiet', '--detach', artifact.base], artifact.id + ': checkout base ' + artifact.base);

  const keyBlobSha = opts.keyBlobSha === undefined ? null : opts.keyBlobSha;

  if (artifact.kind === 'control') {
    if (!artifact.commit) fail(artifact.id + ': control artifact has no `commit` sha');
    gitOrThrow(cloneDir, ['cat-file', '-e', artifact.commit + '^{commit}'], artifact.id + ': verify control commit ' + artifact.commit + ' exists');
    gitOrThrow(cloneDir, ['checkout', '--quiet', '--detach', artifact.commit], artifact.id + ': checkout control head ' + artifact.commit);
    const out = { id: artifact.id, base: artifact.base, head: artifact.commit, cloneDir };
    // Controls are sanitized on exactly the same path as seeds (round 2,
    // CRITICAL 3): if only seeded runs got a stripped clone, the STRIPPING
    // would itself be the tell.
    if (opts.runCloneDir) out.runCloneDir = prepareRunClone(cloneDir, artifact.commit, opts.runCloneDir, keyBlobSha);
    return out;
  }

  if (artifact.kind !== 'seeded') {
    fail(artifact.id + ': unknown kind ' + JSON.stringify(artifact.kind) + ' — expected "seeded" or "control"');
  }
  if (!artifact.commit) fail(artifact.id + ': seeded artifact has no `commit` sha (needed to copy the REAL commit\'s metadata)');

  const patchFile = path.join(patchesDir, artifact.id + '.patch');
  if (!fs.existsSync(patchFile)) {
    fail(artifact.id + ': seeded artifact has no patch file at ' + patchFile);
  }
  const apply = spawnSync('git', GIT_PINS.concat(['-C', cloneDir, 'apply', '--index', patchFile]), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (apply.error) fail(artifact.id + ': git apply spawn failed: ' + apply.error.message);
  if (apply.status !== 0) {
    fail(artifact.id + ': patch failed to apply (' + patchFile + '):\n' + (apply.stderr || apply.stdout || '(no output)'));
  }
  const staged = gitOrThrow(cloneDir, ['diff', '--cached', '--stat'], artifact.id + ': inspect staged diff');
  if (!staged.trim()) {
    fail(artifact.id + ': patch applied cleanly but the staged diff is EMPTY — fail closed rather than commit a ' +
      'no-op variant (the patch, ' + patchFile + ', is a construction bug: it likely already matches HEAD).');
  }

  // The variant commits AS THE REAL COMMIT C — C's author, C's committer,
  // C's dates, C's full message body. See the header: this is protocol
  // §2.1(i), and it is what makes `git log -1` on a seeded head
  // indistinguishable from a control's.
  const meta = readCommitMetadata(cloneDir, artifact.commit);
  const commitEnv = Object.assign({}, process.env, {
    GIT_AUTHOR_NAME: meta.authorName,
    GIT_AUTHOR_EMAIL: meta.authorEmail,
    GIT_AUTHOR_DATE: meta.authorDate,
    GIT_COMMITTER_NAME: meta.committerName,
    GIT_COMMITTER_EMAIL: meta.committerEmail,
    GIT_COMMITTER_DATE: meta.committerDate,
  });
  const msgFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-msg-')), 'message.txt');
  let head;
  try {
    fs.writeFileSync(msgFile, meta.body);
    const commit = spawnSync(
      'git',
      GIT_PINS.concat(['-C', cloneDir, 'commit', '--quiet', '--no-verify', '--cleanup=verbatim', '-F', msgFile]),
      { encoding: 'utf8', env: commitEnv, maxBuffer: 32 * 1024 * 1024 }
    );
    if (commit.error) fail(artifact.id + ': git commit spawn failed: ' + commit.error.message);
    if (commit.status !== 0) {
      fail(artifact.id + ': commit failed:\n' + (commit.stderr || commit.stdout || '(no output)'));
    }
    head = gitOrThrow(cloneDir, ['rev-parse', 'HEAD'], artifact.id + ': resolve new head').trim();
  } finally {
    try { fs.rmSync(path.dirname(msgFile), { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }

  const out = { id: artifact.id, base: artifact.base, head, cloneDir };
  if (opts.runCloneDir) out.runCloneDir = prepareRunClone(cloneDir, head, opts.runCloneDir, keyBlobSha);
  return out;
}

// ----------------------------------------------------------------- CLI

function usage() {
  return [
    'usage:',
    '  node build-corpus.js --id <id>   [--key <path>] [--corpus-dir <dir>] [--patches-dir <dir>]',
    '                                    [--source-repo <dir>] [--clone-root <dir>]',
    '                                    [--run-clone-root <dir>]',
    '  node build-corpus.js --all       [same flags] (writes corpus/materialized.json)',
    '',
    'Defaults: --key <wo12>/corpus/key.json, --corpus-dir/--patches-dir the key\'s own',
    'directory, --source-repo the repository this script lives in (auto-detected),',
    '--clone-root a fresh os.tmpdir()/orchestra-wo12-<random> directory (created and',
    'reused for the lifetime of this invocation; pass your own to reuse it ACROSS',
    'invocations too, e.g. one clone shared by every --id call in a phase).',
    '',
    '--run-clone-root <dir> additionally builds, per artifact, the SANITIZED clone a',
    '  review runner may be pointed at (<dir>/<id>): only the pinned head\'s ancestry,',
    '  no remote, no branch, no tag, no reflog, no unreachable object — asserted, and',
    '  the same for controls and seeds. Without it, only the build clone is produced,',
    '  and the build clone must NEVER be handed to a lane.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { id: null, all: false, key: null, corpusDir: null, patchesDir: null, sourceRepo: null, cloneRoot: null, runCloneRoot: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') out.id = argv[++i];
    else if (a === '--all') out.all = true;
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--corpus-dir') out.corpusDir = argv[++i];
    else if (a === '--patches-dir') out.patchesDir = argv[++i];
    else if (a === '--source-repo') out.sourceRepo = argv[++i];
    else if (a === '--clone-root') out.cloneRoot = argv[++i];
    else if (a === '--run-clone-root') out.runCloneRoot = argv[++i];
    else if (a === '--help' || a === '-h') { process.stdout.write(usage() + '\n'); process.exit(0); }
    else fail('unknown argument: ' + a + '\n\n' + usage());
  }
  if (!out.id && !out.all) fail('one of --id <id> or --all is required\n\n' + usage());
  if (out.id && out.all) fail('--id and --all are mutually exclusive\n\n' + usage());
  return out;
}

function loadKey(keyPath) {
  if (!fs.existsSync(keyPath)) fail('key.json not found: ' + keyPath);
  let key;
  try {
    key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch (e) {
    fail('key.json at ' + keyPath + ' is not valid JSON: ' + e.message);
  }
  if (!key || !Array.isArray(key.artifacts)) fail('key.json at ' + keyPath + ' has no `artifacts` array');
  return key;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const corpusDirDefault = args.key ? path.dirname(path.resolve(args.key)) : path.join(HERE, 'corpus');
  const keyPath = args.key ? path.resolve(args.key) : path.join(corpusDirDefault, 'key.json');
  const corpusDir = args.corpusDir ? path.resolve(args.corpusDir) : corpusDirDefault;
  const patchesDir = args.patchesDir ? path.resolve(args.patchesDir) : corpusDir;
  const sourceRepo = args.sourceRepo ? path.resolve(args.sourceRepo) : detectRepoRoot();

  const key = loadKey(keyPath);
  const keyBlobSha = keyBlobShaFor(sourceRepo);

  const cloneRootParent = args.cloneRoot ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-'));
  const cloneDirTarget = args.cloneRoot ? path.resolve(args.cloneRoot) : cloneRootParent;
  const { cloneDir } = ensureClone(sourceRepo, cloneDirTarget);
  const runCloneRoot = args.runCloneRoot ? path.resolve(args.runCloneRoot) : null;

  function optsFor(id) {
    return { keyBlobSha, runCloneDir: runCloneRoot ? path.join(runCloneRoot, id) : null };
  }

  if (args.id) {
    const artifact = key.artifacts.find((a) => a.id === args.id);
    if (!artifact) fail('no artifact with id ' + JSON.stringify(args.id) + ' in ' + keyPath);
    const result = materializeArtifact(artifact, cloneDir, patchesDir, optsFor(artifact.id));
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  // --all. Round-2 MINOR: a stale materialized.json from a previous run must
  // not survive a partial failure alongside a half-materialized clone — it is
  // removed up front and only rewritten on a complete pass.
  const outFile = path.join(corpusDir, 'materialized.json');
  if (fs.existsSync(outFile)) fs.rmSync(outFile, { force: true });
  const results = [];
  for (const artifact of key.artifacts) {
    const result = materializeArtifact(artifact, cloneDir, patchesDir, optsFor(artifact.id));
    results.push(result);
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2) + '\n', 'utf8');
  process.stderr.write('wrote ' + results.length + ' materialized artifact(s) to ' + outFile + '\n');
}

module.exports = {
  GIT_PINS,
  KEY_REL_PATH,
  detectRepoRoot,
  ensureClone,
  readCommitMetadata,
  sanitizeClone,
  prepareRunClone,
  keyBlobShaFor,
  materializeArtifact,
  loadKey,
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('build-corpus: ' + ((e && e.message) || e) + '\n');
    process.exit(1);
  }
}
