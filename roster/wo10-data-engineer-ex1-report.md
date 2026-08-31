# DATA ENGINEER (E4) — WO-10 EX1 — v1→v2 name-split migration fixture

Order: class E4, risk T1 REVERSIBLE. Workspace: `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\5f934331-1de4-4027-be71-da2868fd7fd2\scratchpad\wo10-fixtures\data-engineer` (git init'd, 8 commits, tree clean). `C:\Users\maxtl\Projects\Claude-Orchestra` never written.

```
STATUS: DONE
```

## CHANGES

- `scripts/lib.js:17` — `serialize()`: the single serialization point for every writer (2-space JSON, LF forced, trailing newline). Byte-exact rollback is only possible if generate/migrate/rollback all serialize identically; centralizing it makes that a structural property rather than a coincidence three files have to keep agreeing on.
- `scripts/lib.js:31` — `writeAtomic()`: temp file in the *same* directory (same filesystem, so `rename` is atomic), `fsync` before close, then `rename` over the target. A crash yields the whole old file or the whole new one, never a truncated one.
- `scripts/lib.js:43` — `sha256File()`: hashes raw bytes, not parsed JSON, so the proof measures the artifact rather than an equivalent structure.
- `.gitattributes:1` — pins `*.json` to `-text` so git cannot rewrite line endings underneath the hashes on a Windows checkout. Without this the committed baseline and the on-disk baseline could differ by CRLF and every hash claim in this report would be checkout-dependent.
- `scripts/generate.js:14` — deterministic 50-record v1 builder: no randomness, no clock. Key insertion order `(id, name, email, created)` *is* the v1 canonical key order.
- `scripts/validate.js:20` — `splitName()`: the splittability rule. Accepts exactly two non-empty parts joined by one space; rejects mononyms, multi-space, 3+ parts, leading/trailing whitespace, and tab/newline standing in for a space.
- `scripts/validate.js:32` — `validateRecords()`: structural pass over every record — exact v1 key set, positive unique integer ids, non-empty email, `YYYY-MM-DD` created, plus an already-migrated guard so a second run cannot double-migrate.
- `scripts/dry-run.js:18` — `toV2()`: the transform. Key insertion order `(id, first, last, email, created, schema_version)` *is* the v2 canonical key order.
- `scripts/dry-run.js:41` — `planMigration()`: validates and transforms wholly in memory, returns the projected text and its hash. Writes nothing. `migrate.js` imports it, so the dry run exercises the exact code the apply runs — a dry run over separate code would be worthless as evidence.
- `scripts/migrate.js:22` — apply path in fixed order: validate → transform in memory → atomic rename → **re-read from disk** and verify hash/count/schema_version/name-reconstructability. Verification reads the disk rather than trusting the in-memory plan.
- `scripts/rollback.js:24` — `validateV2()`: refuses anything that is not a clean v2 dataset (a v1 file, stray keys, whitespace inside `first`/`last` that would break the round-trip). Rollback aborts rather than "fixing" an unexpected shape.
- `scripts/rollback.js:52` — `toV1()`: rebuilds `name` as `first + " " + last`, the exact inverse of the enforced single-space split, and re-inserts keys in v1 order. A true mathematical inverse — no backup side file is needed or kept.
- `scripts/proof.js:16` — runs real migrate + real rollback in place against the real file, compares original vs restored hash, and leaves the file at v1.
- `scripts/poison-test.js:31` — subprocess-based test (`execFileSync`) so the asserted exit codes are the same ones an operator or CI would see.

Commits, one artifact each, in order:

```
16aa48d Fixture generator: deterministic 50-record v1 builder + canonical I/O lib
dfadab3 v1 baseline dataset: data/users.json, 50 records
3a95934 Pre-migration validation gate: structural + splittability over all records
7e2d6fc Dry-run planner: in-memory transform + diff summary, writes nothing
890a611 Migrate v1->v2: validate, transform in memory, atomic rename, verify from disk
dc40a9d Rollback v2->v1: true inverse, byte-exact, no side file
ebff076 PROOF: sha256(v1) === sha256(rollback(migrate(v1)))
1a0552c Poison test: one unsplittable name blocks the entire migration
```

## DRY RUN / INVARIANT COMPARISON

`node scripts/dry-run.js` — nothing written; `data/users.json` sha256 identical before and after the run, `git status` clean.

| Invariant | Before (v1) | After (v2) | Verdict |
|---|---|---|---|
| Record count | 50 | 50 | 0 dropped, 0 added |
| id sequence, in order | 1..50 | 1..50 | preserved (`true`) |
| email values | 50 | 50 | preserved (`true`) |
| created values | 50 | 50 | preserved (`true`) |
| `first + " " + last === name` | — | 50/50 | `true` |
| `schema_version === 2` | absent | every record | `true` |
| Key shape | `[id, name, email, created]` | `[id, first, last, email, created, schema_version]` | `name` replaced, nothing lost |
| File bytes | 6017 | 8067 | — |
| File sha256 | `34aa7c35…4816` | projected `5ea3a72e…7ce0` | projection matched the actual write exactly |

Projected-vs-actual: the dry run's projected v2 hash `5ea3a72e424cd324126e9b38f6eb7fd6545cbce0cc6f208007c42c17a6fb7ce0` equalled the post-write on-disk hash — the plan predicted the artifact byte-for-byte.

Sample transformation (first and last record):

```
[0] - {"id":1,"name":"First50-1 Last-1","email":"user1@example.test","created":"2026-01-02"}
[0] + {"id":1,"first":"First50-1","last":"Last-1","email":"user1@example.test","created":"2026-01-02","schema_version":2}
[49] - {"id":50,"name":"First50-50 Last-50","email":"user50@example.test","created":"2026-01-23"}
[49] + {"id":50,"first":"First50-50","last":"Last-50","email":"user50@example.test","created":"2026-01-23","schema_version":2}
```

Fixture spec boundaries confirmed against the `created = 2026-01-<(id%28)+1>` rule: id 1 → `2026-01-02`, id 27 → `2026-01-28` (upper edge), id 28 → `2026-01-01` (wrap), id 50 → `2026-01-23`.

Concurrency behavior: single-writer fixture, no locking layer. The atomic `rename` is the only concurrency guarantee claimed — a concurrent *reader* sees either the complete v1 or the complete v2 file and never a partial one. Concurrent *writers* are not defended against and are out of scope for a file fixture; see CONCERNS. Query plans: N/A, no database in this fixture.

## ROLLBACK

- `scripts/rollback.js` → **tested restore: yes** — executed for real (not simulated) as step 2 of `scripts/proof.js`, restoring the live `data/users.json` from v2 to a byte-identical v1. Verified by sha256, not by inspection.
- Guard also tested: running `node scripts/rollback.js data/users.json` against a **v1** file is refused with 350 findings, exit 1, and the file's sha256 unchanged at `34aa7c35…4816` — rollback will not touch a shape it does not recognize.
- No backup side file is required: rollback is a computed inverse. The v1 baseline is additionally recoverable two other independent ways — from commit `dfadab3`, and by re-running `node scripts/generate.js`, which reproduces the identical hash.

## AUTHORIZATION

- T1 REVERSIBLE, fixture data in an isolated scratch workspace, no production target — **not yet sought; this order is preparation only.** Nothing here has been applied to any real dataset. Per the charter, preparation and application are separate orders: applying this migration to any real target would be a fresh order carrying its own tier and its own gate.

## VERIFICATION

**(5) PROOF — `node scripts/proof.js` → exit 0. Verbatim verdict block:**

```
--- verdict ---
ORIGINAL  v1 sha256: 34aa7c35b66d50d00bb38b04091f1bf293594ad9ab0bda8ef7ce7c54e9674816
INTERIM   v2 sha256: 5ea3a72e424cd324126e9b38f6eb7fd6545cbce0cc6f208007c42c17a6fb7ce0
ROLLED BACK  sha256: 34aa7c35b66d50d00bb38b04091f1bf293594ad9ab0bda8ef7ce7c54e9674816
equal: true

RESULT: PROOF PASSED - rollback reconstructs v1 byte-for-byte. File left at v1.
```

Verbatim post-write verification from the migrate step inside that same run:

```
atomic write: wrote .users.json.tmp-26576-1788137309778 then renamed over users.json

-- post-write verification (re-read from disk) --
  hash matches projection : true (5ea3a72e424cd324126e9b38f6eb7fd6545cbce0cc6f208007c42c17a6fb7ce0)
  record count preserved  : true (50)
  schema_version===2 all  : true
  names reconstructable   : true

  v1 sha256: 34aa7c35b66d50d00bb38b04091f1bf293594ad9ab0bda8ef7ce7c54e9674816
  v2 sha256: 5ea3a72e424cd324126e9b38f6eb7fd6545cbce0cc6f208007c42c17a6fb7ce0

RESULT: MIGRATED v1 -> v2, verified on disk.
```

**(6) POISONED-RECORD TEST — `node scripts/poison-test.js` → exit 0, 11/11 assertions. Verbatim:**

```
=== POISONED-RECORD TEST ===
baseline data/users.json sha256: 34aa7c35b66d50d00bb38b04091f1bf293594ad9ab0bda8ef7ce7c54e9674816
poisoned copy: 51 records, record index 50 has name "Mononym"
poisoned copy sha256 (before): 148e4cfdb3f0792f199e9232b2f478a6f70e8b0aaf83839f0e06a03e4836e9de

--- validate on poisoned copy ---
VALIDATE ...\data\users.poisoned.json
records checked: 51
findings: 1
  [UNSPLITTABLE] record index 50: name splits into 1 part(s) on single space, expected exactly 2 (name="Mononym", id=51)
RESULT: FAIL - migration REFUSED, no records will be transformed

--- assertions ---
  [PASS] validate exits non-zero - exit=1
  [PASS] validate names the unsplittable record
  [PASS] validate reports index 50
  [PASS] validate refuses the whole dataset

--- migrate on poisoned copy ---
MIGRATE ...\data\users.poisoned.json

VALIDATE ...\data\users.poisoned.json
records checked: 51
findings: 1
  [UNSPLITTABLE] record index 50: name splits into 1 part(s) on single space, expected exactly 2 (name="Mononym", id=51)
RESULT: FAIL - migration REFUSED, no records will be transformed

RESULT: REFUSED - validation failed. No temp file created, target untouched.

--- assertions ---
  [PASS] migrate exits non-zero - exit=1
  [PASS] migrate reports REFUSED
  [PASS] migrate wrote nothing (hash unchanged) - 148e4cfdb3f0792f199e9232b2f478a6f70e8b0aaf83839f0e06a03e4836e9de
  [PASS] no v2 fields leaked into the file
  [PASS] the other 50 records were NOT partially migrated
  [PASS] no temp file left behind
  [PASS] v1 baseline untouched throughout - 34aa7c35b66d50d00bb38b04091f1bf293594ad9ab0bda8ef7ce7c54e9674816

11/11 assertions passed
poisoned copy deleted (test is self-contained and rerunnable)
RESULT: POISON TEST PASSED - an unsplittable record blocks the entire migration.
```

(Only the three absolute paths on the `VALIDATE`/`MIGRATE` header lines are elided to `...` for width; every other character is verbatim, including the two full-path lines' filenames.)

The load-bearing assertion is `migrate wrote nothing (hash unchanged)`: the poisoned copy's sha256 is identical before and after the migrate attempt, so the refusal is a genuine no-op, not a rollback of a partial write. One bad record in 51 stopped all 51 — no skip, no partial application.

**Other commands run:**

- `node scripts/generate.js` → 50 records, sha256 `34aa7c35…4816`. Re-run to a second path produced the identical hash — generator is deterministic.
- `node scripts/validate.js` (baseline) → `records checked: 50 / splittable names: 50/50 / RESULT: PASS`, exit 0.
- `node scripts/dry-run.js` → exit 0, `RESULT: DRY RUN COMPLETE - NOTHING WRITTEN. Disk is untouched.`; baseline hash unchanged afterward and `git status` clean.
- `node scripts/rollback.js data/users.json` (v1 input, guard test) → exit 1, 350 findings, `RESULT: REFUSED - not a well-formed v2 dataset. Target untouched.`
- Byte check: `data/users.json` contains no `0x0d` byte (LF-only, 6017 bytes).
- `git status --short` in the fixture repo → empty. `git -C C:\Users\maxtl\Projects\Claude-Orchestra status --short` → empty.
- Final state: `data/users.json` sha256 `34aa7c35b66d50d00bb38b04091f1bf293594ad9ab0bda8ef7ce7c54e9674816` — the v1 baseline, matching commit `dfadab3`. No temp or poisoned files remain in `data/`.

## DEVIATIONS

- **Dry-run and migrate are two scripts, not one script with a `--dry-run` flag.** The order listed them as separate artifacts (2) and (3) and required each be committed separately. `dry-run.js` holds the planner and `migrate.js` imports it, so they still share one transform — the intent (a dry run that predicts the real run) is met, and the projected hash matching the written hash demonstrates it. Flagging the shape difference in case a single-entry-point CLI was expected.
- **Added `scripts/lib.js` and `.gitattributes`, not named in the order.** Both are integrity requirements rather than scope growth: byte-exact rollback needs one serializer, and a Windows checkout needs CRLF pinned or every hash claim becomes checkout-dependent. Committed with artifact (1).
- **Poisoned record was appended as a 51st record (id 51)** rather than corrupting an existing one, so the test also proves the 50 good records survive untouched. The order said "inject one record with name 'Mononym'", which this satisfies.
- **The proof ran against the live `data/users.json` in place**, not a copy — deliberately, so the evidence covers the real apply path. The file ends at v1 and the tree is clean.
- **One stray file was briefly written outside the workspace**: a determinism cross-check wrote `C:\Users\maxtl\AppData\Local\Temp\regen-check.json` (Git Bash mapped `/tmp` to the system temp root, not the assigned scratchpad). Deleted immediately and confirmed gone. Nothing was written to `C:\Users\maxtl\Projects\Claude-Orchestra` at any point.

## CONCERNS

- **`git status` clean is not proof of no writes.** For the dry run I additionally compared the file's sha256 before and after, which is the real evidence; git would happily report clean if a file were rewritten to identical content. Worth noting because the same trap applies to any reviewer re-checking this work.
- **The atomic-write guarantee is narrower than "safe".** `rename` protects a concurrent *reader* from seeing a partial file. It does not protect against two concurrent *writers* — there is no lockfile, and last-rename-wins would silently discard the other's work. Fine for a single-operator fixture; if this pattern is lifted toward anything with concurrent writers, a lock or a CAS on the expected pre-image hash must be added first. `migrate.js` already reads the pre-image hash and could enforce that cheaply.
- **The splittability rule is deliberately strict and will reject real-world names.** "Ada Lovelace King" (3 parts), "van Gogh" as a surname, mononyms, and any suffixed name all refuse. That is correct for a T1 fixture — refusing beats guessing a wrong split — but on real user data the refusal rate would be material and the right answer is almost certainly a curated exceptions table plus a human pass, not a looser regex. Loosening the split rule silently would break the byte-exact inverse, since rollback's `first + " " + last` is only an inverse of a *single*-space split.
- **`schema_version` is per-record, per the order.** That is 50 copies of a value that describes the file, and it lets a file hold mixed versions — the shape that makes partial migrations possible in the first place. A file-level envelope (`{schema_version: 2, records: [...]}`) would make mixed state unrepresentable. Not changed, because the order specified per-record; raising it as a design note for whoever inherits the schema.
- **Rollback correctness depends on `first`/`last` staying whitespace-free after v2 is live.** `rollback.js` checks this and refuses otherwise, so the failure is loud rather than silent — but if any downstream writer ever puts a space into `last`, that record becomes non-rollbackable and rollback will refuse the *whole file*. A v2 write-path validator enforcing the same rule is the missing piece if this schema ever goes live.
- **No Verifier invariant comparison has been run by a second party.** The charter makes cross-family review (Sol · high) plus Verifier invariant comparison mandatory for this class. Everything above is my own claim about my own work — self-verified, and the report is a claim, not evidence. The hashes and the two test scripts are reproducible by any reviewer in under a minute (`node scripts/proof.js`, `node scripts/poison-test.js`), which is the intended check.
