#!/usr/bin/env node
/**
 * WO-12 seeded-defect corpus (SDC) materializer — protocol §2, §4
 * (`../wo12-protocol.md`).
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
 *   node build-corpus.js --all      [--clone-root <dir>] [--key <path>]
 *
 * WHERE IT WORKS: a throwaway clone of THIS repository under
 * os.tmpdir()/orchestra-wo12-<random>/ (or --clone-root, which is created if
 * absent and REUSED if it already looks like a clone — so --all and repeated
 * --id calls in a phase do not re-clone history every time). The clone is
 * NEVER placed inside this repository — a worktree/clone nested in the tree
 * under review is itself session dirt, the same reasoning
 * `orchestra-review.js`'s pinned mode already applies to its own scratch
 * worktrees.
 *
 * WHAT IT DOES, per artifact:
 *   1. reset --hard + clean -fdx the clone (leftover state from a prior
 *      artifact in a reused clone must not leak into this one);
 *   2. checkout --detach <base> (the seed's/control's parent commit);
 *   3. CONTROL (kind:"control", no patch): head = `commit` verbatim — the
 *      real historical commit, unmodified. Nothing is re-created.
 *   4. SEEDED (kind:"seeded"): `git apply --index corpus/<id>.patch`, verify
 *      the staged diff is non-empty (a patch that applies but changes
 *      nothing is a construction bug, not a variant — fails closed), then
 *      commit with a FIXED author/committer/date and a message equal to
 *      key.json's own `subject` field for this artifact — the REAL commit
 *      C's subject, which is what a reviewer actually reads as the stated
 *      intent (Director correction: the protocol's original "the base
 *      commit's original subject" wording was ambiguous, and read literally
 *      would have handed the reviewer the PARENT P's unrelated subject
 *      instead of C's — the base's own subject is never used as the
 *      variant's message). Fixed identity: "WO-12 seeder
 *      <wo12@orchestra.local>", date 2026-08-31T00:00:00Z, gpgsign forced off
 *      for THIS throwaway clone's commits only (a signature would make the
 *      commit sha depend on the signing key/clock of whoever ran the
 *      seeder, defeating reproducibility). A commit's sha is content-
 *      addressed from {tree, parent, author, committer, message} — nothing
 *      here depends on the clone's filesystem path — so the SAME (base,
 *      patch) pair always re-materializes to the SAME head sha, in any
 *      clone, on any machine. That is the reproducibility property
 *      run-lane.js and score.js rely on to talk about "the same artifact"
 *      across separate runs.
 *
 * Prints one JSON line per artifact: {id, base, head, cloneDir}. --all also
 * writes corpus/materialized.json (array, same shape, corpus order) next to
 * key.json.
 *
 * House rules: zero dependencies, CommonJS, same voice as
 * probes/orchestra-probe-review.js. Nothing outside
 * plans/cross-compare/agent-role-architecture/wo12/ is touched.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const HERE = __dirname;

// Fixed seeder identity (protocol §4, order-of-operations step 2 / the task
// brief). Deliberately NOT the real seeder agent's identity — the whole point
// is that every re-materialization of the same (base, patch) pair produces
// byte-identical commit metadata, and therefore the same sha.
const SEEDER_NAME = 'WO-12 seeder';
const SEEDER_EMAIL = 'wo12@orchestra.local';
const SEED_DATE = '2026-08-31T00:00:00Z';

function fail(msg) {
  const e = new Error(msg);
  e.wo12BuildCorpus = true;
  throw e;
}

// -------------------------------------------------------------------- git

function git(dir, args) {
  return spawnSync('git', ['-C', dir].concat(args), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function gitOrThrow(dir, args, desc) {
  const r = git(dir, args);
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

// Creates (or, if --clone-root already looks like a git repo, REUSES) a
// throwaway clone of `sourceRepo` at `cloneDir`. Never called with a
// cloneDir inside `sourceRepo`.
function ensureClone(sourceRepo, cloneDir) {
  const resolvedSource = path.resolve(sourceRepo);
  const resolvedClone = path.resolve(cloneDir);
  const rel = path.relative(resolvedSource, resolvedClone);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    fail('refusing to clone into ' + resolvedClone + ' — it is INSIDE the source repository ' + resolvedSource +
      '. The scratch clone must never be nested in the tree under review.');
  }
  if (fs.existsSync(path.join(resolvedClone, '.git'))) {
    return { cloneDir: resolvedClone, reused: true };
  }
  fs.mkdirSync(path.dirname(resolvedClone), { recursive: true });
  const r = spawnSync('git', ['clone', '--quiet', resolvedSource, resolvedClone], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) fail('git clone ' + resolvedSource + ' -> ' + resolvedClone + ' failed:\n' + (r.stderr || ''));
  return { cloneDir: resolvedClone, reused: false };
}

// ------------------------------------------------------------ materialize

/**
 * Materializes ONE artifact in an already-cloned working tree. Returns
 * {id, base, head, cloneDir}. Throws (fail-closed) on anything that would
 * silently produce a wrong or empty variant.
 */
function materializeArtifact(artifact, cloneDir, patchesDir) {
  if (!artifact || !artifact.id) fail('materializeArtifact: artifact is missing an id');
  if (!artifact.base) fail(artifact.id + ': key.json entry has no `base` sha');

  // Leftover state from a prior artifact in a reused clone must never leak
  // into this one's tree or index.
  gitOrThrow(cloneDir, ['reset', '--hard', '--quiet'], artifact.id + ': reset working tree');
  gitOrThrow(cloneDir, ['clean', '-fdx', '--quiet'], artifact.id + ': clean untracked/ignored files');
  gitOrThrow(cloneDir, ['checkout', '--quiet', '--detach', artifact.base], artifact.id + ': checkout base ' + artifact.base);

  if (artifact.kind === 'control') {
    if (!artifact.commit) fail(artifact.id + ': control artifact has no `commit` sha');
    gitOrThrow(cloneDir, ['cat-file', '-e', artifact.commit + '^{commit}'], artifact.id + ': verify control commit ' + artifact.commit + ' exists');
    gitOrThrow(cloneDir, ['checkout', '--quiet', '--detach', artifact.commit], artifact.id + ': checkout control head ' + artifact.commit);
    return { id: artifact.id, base: artifact.base, head: artifact.commit, cloneDir };
  }

  if (artifact.kind !== 'seeded') {
    fail(artifact.id + ': unknown kind ' + JSON.stringify(artifact.kind) + ' — expected "seeded" or "control"');
  }

  const patchFile = path.join(patchesDir, artifact.id + '.patch');
  if (!fs.existsSync(patchFile)) {
    fail(artifact.id + ': seeded artifact has no patch file at ' + patchFile);
  }
  const apply = spawnSync('git', ['-C', cloneDir, 'apply', '--index', patchFile], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (apply.status !== 0) {
    fail(artifact.id + ': patch failed to apply (' + patchFile + '):\n' + (apply.stderr || apply.stdout || '(no output)'));
  }
  const staged = gitOrThrow(cloneDir, ['diff', '--cached', '--stat'], artifact.id + ': inspect staged diff');
  if (!staged.trim()) {
    fail(artifact.id + ': patch applied cleanly but the staged diff is EMPTY — fail closed rather than commit a ' +
      'no-op variant (the patch, ' + patchFile + ', is a construction bug: it likely already matches HEAD).');
  }

  // Message = key.json's own `subject` field for this artifact — the REAL
  // commit C's subject, the stated intent a reviewer actually reads
  // (Director correction: NOT the base P's subject — P describes a
  // different, unrelated change, and using it would hand the reviewer the
  // wrong intent entirely).
  const subject = (artifact.subject || '').trim();
  if (!subject) {
    fail(artifact.id + ': key.json has no (or an empty) `subject` field for this seeded artifact — needed as the variant\'s commit message');
  }

  const commitEnv = Object.assign({}, process.env, {
    GIT_AUTHOR_NAME: SEEDER_NAME,
    GIT_AUTHOR_EMAIL: SEEDER_EMAIL,
    GIT_AUTHOR_DATE: SEED_DATE,
    GIT_COMMITTER_NAME: SEEDER_NAME,
    GIT_COMMITTER_EMAIL: SEEDER_EMAIL,
    GIT_COMMITTER_DATE: SEED_DATE,
  });
  // gpgsign forced off for this clone's own commit only: a signature would
  // make the resulting sha depend on the signing key/clock of whoever ran
  // this script, which breaks the reproducibility property the whole
  // materializer exists to provide. This never touches the user's global
  // git config — it is a one-shot `-c` on a throwaway clone's own commit.
  const commit = spawnSync(
    'git', ['-C', cloneDir, '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', subject],
    { encoding: 'utf8', env: commitEnv, maxBuffer: 32 * 1024 * 1024 }
  );
  if (commit.status !== 0) {
    fail(artifact.id + ': commit failed:\n' + (commit.stderr || commit.stdout || '(no output)'));
  }
  const head = gitOrThrow(cloneDir, ['rev-parse', 'HEAD'], artifact.id + ': resolve new head').trim();
  return { id: artifact.id, base: artifact.base, head, cloneDir };
}

// ----------------------------------------------------------------- CLI

function usage() {
  return [
    'usage:',
    '  node build-corpus.js --id <id>   [--key <path>] [--corpus-dir <dir>] [--patches-dir <dir>]',
    '                                    [--source-repo <dir>] [--clone-root <dir>]',
    '  node build-corpus.js --all       [same flags] (writes corpus/materialized.json)',
    '',
    'Defaults: --key <wo12>/corpus/key.json, --corpus-dir/--patches-dir the key\'s own',
    'directory, --source-repo the repository this script lives in (auto-detected),',
    '--clone-root a fresh os.tmpdir()/orchestra-wo12-<random> directory (created and',
    'reused for the lifetime of this invocation; pass your own to reuse it ACROSS',
    'invocations too, e.g. one clone shared by every --id call in a phase).',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { id: null, all: false, key: null, corpusDir: null, patchesDir: null, sourceRepo: null, cloneRoot: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') out.id = argv[++i];
    else if (a === '--all') out.all = true;
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--corpus-dir') out.corpusDir = argv[++i];
    else if (a === '--patches-dir') out.patchesDir = argv[++i];
    else if (a === '--source-repo') out.sourceRepo = argv[++i];
    else if (a === '--clone-root') out.cloneRoot = argv[++i];
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

  const cloneRootParent = args.cloneRoot ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-'));
  const cloneDirTarget = args.cloneRoot ? path.resolve(args.cloneRoot) : cloneRootParent;
  const { cloneDir } = ensureClone(sourceRepo, cloneDirTarget);

  if (args.id) {
    const artifact = key.artifacts.find((a) => a.id === args.id);
    if (!artifact) fail('no artifact with id ' + JSON.stringify(args.id) + ' in ' + keyPath);
    const result = materializeArtifact(artifact, cloneDir, patchesDir);
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  // --all
  const results = [];
  for (const artifact of key.artifacts) {
    const result = materializeArtifact(artifact, cloneDir, patchesDir);
    results.push(result);
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  const outFile = path.join(corpusDir, 'materialized.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2) + '\n', 'utf8');
  process.stderr.write('wrote ' + results.length + ' materialized artifact(s) to ' + outFile + '\n');
}

module.exports = {
  SEEDER_NAME,
  SEEDER_EMAIL,
  SEED_DATE,
  detectRepoRoot,
  ensureClone,
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
