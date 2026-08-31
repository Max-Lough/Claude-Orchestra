# WO-12 seeded-defect corpus (SDC) — how the pool was drawn

Mechanical allocation only, per `wo12-protocol.md` §2 and the corpus-assembler order. No
defect seeding happened here — this directory fixes *which* 84 real commits the corpus
uses and *where* each lands (id, phase, variant), plus the review-packet briefs for the
54 control artifacts. The 30 seeded artifacts' `.patch` + `key.json` entries are written
separately by the seeder agents, one per `seed_slot`.

## Provenance

- Protocol: `plans/cross-compare/agent-role-architecture/wo12/wo12-protocol.md` §2.
- Scout shortlist (40 candidates, KIND=code, SIZE S/M/L, drawn from this repo's real
  history): `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\8a1084ac-23e5-4029-97e1-455d7a8970ee\scratchpad\best_candidates.json`.
- Scout full table (102 commits, all KIND/SIZE/TESTED): `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\8a1084ac-23e5-4029-97e1-455d7a8970ee\scratchpad\full_table.txt`.
- Control brief shape adapted from the WO-2 probe: `probes/orchestra-probe-review.js`
  § `writeBriefFiles` (lines 173-198), with `WO-2 THROUGHPUT PROBE` → `REVIEW PACKET`, the
  throughput-probe sentence removed, and the intent/audit paragraph kept.

## Commands used to resolve every commit

For each of the 102 `full_table.txt` rows (short sha `S`):

```
git rev-parse S            # -> commit (full 40-hex)
git rev-parse S^            # -> base/parent (full 40-hex; fails only for the repo root commit)
git log -1 --format=%s S    # -> subject (re-fetched; the table's subject column is
                             #    truncated for display and is not used verbatim)
git log -1 --format=%ct S   # -> committer-date epoch, for newest-first sorting
git show --name-only --pretty=format: S   # -> changed files, for the *-SEALED.md check
git cat-file -t <sha>       # -> verification only: confirms every base/commit sha is a
                             #    real commit object
```

## Exclusion check (across all 102 `full_table.txt` rows)

- Subject starts with `WO-2 ` or `WO-7a`: **0 matches**.
- Touches a `*-SEALED.md` path: **4 matches**, all WO-7a corpus-sealing commits, none of
  them in the 40-entry shortlist — `68d8171`, `6327995`, `5fc9726`, `6f27ea2`.
- Repo root commit (no parent to diff against, same rule the WO-2 probe applies):
  `bbbd983` — 1 match.
- Net: 97 of 102 rows eligible; all 40 shortlisted commits are eligible (matches the
  scout's finding of zero shortlist exclusions).

## Allocation summary

See `base-pool.json`'s own `"allocation"` field for the full deterministic rule text.
Short version:

- **Seeded bases (30)**: the 36 S/M shortlist entries, sorted newest-first by committer
  timestamp, assigned round-robin across the 6 types (CV, OO, LC, FT, HF, RC — type =
  position mod 6). Each type's first 5 round-robin picks (already spanning newest to
  oldest within the type, since it draws every 6th position) become its 5 seed bases;
  the 6th (oldest) pick per type is unused as a seed and falls into the control pool.
  The 4 L-size shortlist entries are never seed bases.
- **Severity per type**: 1 CRITICAL, 3 MAJOR, 1 MAJOR-preferred (MAJOR preferred, MINOR
  allowed only when the type genuinely cannot carry MAJOR on that base — protocol target
  MINOR ≤ 4 overall; seeders should default to MAJOR unless the base truly cannot carry
  it). Newest base of the 5 → phase-0 plain MAJOR (the pilot); next-newest → the type's
  CRITICAL, placed in whichever of phases 1-3 that type is assigned (spread 2 types per
  phase: CV/OO → phase 1, LC/FT → phase 2, HF/RC → phase 3); next → an extra plain MAJOR
  in that same phase; next → a plain MAJOR in the following phase; oldest → the
  MAJOR-preferred seed in the third phase — so every type appears in every phase at
  least once.
- **Controls (54)**: priority order (a) the 6 SM + 4 L shortlist entries left over from
  the seeded round-robin, newest-first; (b) `full_table.txt` non-shortlisted, non-L,
  KIND ∈ {code, mixed} commits, newest-first; (c) `full_table.txt` non-shortlisted,
  KIND=docs, SIZE ∈ {S, M} commits, newest-first; (d) — protocol §2.1's "pool runs short"
  allowance — the 30 used seed bases, newest-first, reviewed unmodified as a control
  against the same parent already used for their seeded variant. The candidate sequence
  (a)+(b)+(c)+(d) is walked greedily, skipping any candidate whose parent sha was already
  claimed by a higher-priority control (see **Reuse and collision notes** below), until
  54 are taken. They are laid into phases 0/1/2/3 at 6/16/16/16 in that same priority
  order.
- **Variant (V1/V2/V3)**: controls rotate per protocol §2.7 as a single stratum across
  all 54, in corpus order, V1/V2/V3/V1/…. Seeds use an **amended rule (coordinator
  ruling, supersedes the original per-(type,target_severity)-stratum rotation)**: the
  original rule always landed V1 on every 1-member severity stratum (CRITICAL,
  MAJOR-preferred), skewing the 30-seed total to 18/6/6. The amended rule rotates
  **within type** instead — each type's 5 seeds, taken in corpus order, cycle
  V1,V2,V3,V1,V2 — with the starting variant staggered per type so the total comes out
  10/10/10 despite 5 not being a multiple of 3: offsets 0,1,2,0,1,2 by type order
  CV,OO,LC,FT,HF,RC (CV starts V1, OO starts V2, LC starts V3, FT starts V1, HF starts
  V2, RC starts V3).

## Counts

**Overall**: 84 slots — 30 seeded, 54 control.

**By phase**: phase 0: 12 (6 seeded + 6 control); phase 1: 24 (8 + 16); phase 2: 24
(8 + 16); phase 3: 24 (8 + 16).

**Seeded, by type** (each = 5): CV 5, OO 5, LC 5, FT 5, HF 5, RC 5.

**Seeded, by target severity**: CRITICAL 6, MAJOR 18, MAJOR-preferred 6.

**Seeded, by variant** (amended within-type staggered rotation): V1 10, V2 10, V3 10
overall. Per type (each within ±1, as expected from cycling 5 through 3):

| Type | V1 | V2 | V3 |
|---|---|---|---|
| CV | 2 | 2 | 1 |
| OO | 1 | 2 | 2 |
| LC | 2 | 1 | 2 |
| FT | 2 | 2 | 1 |
| HF | 1 | 2 | 2 |
| RC | 2 | 1 | 2 |
| **Total** | **10** | **10** | **10** |

**Control, by variant**: V1 18, V2 18, V3 18.

**Control, by KIND** (of the real underlying commit): code 19, docs 24, mixed 11.

**Control, by SIZE**: S 24, M 26, L 4 (the 4 L entries are all from the shortlist's
leftover, per protocol §2.1's instruction to include and record them).

**Control, by source tier**: leftover-shortlist 9, non-shortlisted code/mixed 11,
non-shortlisted docs S/M 24, reused seed base 10.

## Reuse and collision notes

- **Base collision** (not a shortage — a genuine git history fork): `e7545f6` and
  `99835d5` are siblings, both children of `e3b730d` (`guard: stand down on undetermined
  model instead of enforcing` and `Add cross-family (OpenAI/Codex) reviewer, replacing
  same-family review`). Both were in the leftover-shortlist control-source tier. Taking
  both would have produced two control slots with the same `base` (parent sha), which
  fails the "no duplicate (base, kind) pair" check. The higher-priority (newer) one,
  `e7545f6`, was kept (`sdc-021`); `99835d5` was skipped and the next candidate in the
  priority sequence was taken instead — which, because the non-reuse tiers were already
  fully consumed, pulled one additional entry from the reuse-fallback tier.
- **Pool-ran-short reuse** (protocol §2.1, "prefer not" — recorded as required): the
  non-reuse control-source tiers supplied 9 (leftover-shortlist, after the collision
  skip) + 11 (non-shortlisted code/mixed) + 24 (non-shortlisted docs S/M) = 44 usable
  commits, 10 short of the 54 needed. The remaining 10 controls reuse a seeded base —
  i.e. the same real commit `C` that seeds a `seeded` slot is *also* reviewed unmodified
  (against the same parent `P`) as a `control` slot elsewhere in the corpus. This is
  explicitly permitted only under a pool shortfall and is recorded here per the
  protocol's requirement; it does not violate "no duplicate (base, kind) pair" because
  the pair's `kind` differs between the two slots (one `seeded`, one `control`) even
  though the `base` (parent sha) is identical. The 10 reused-seed-base commits (short
  sha, both slot ids): `772a688` (sdc-001 seeded / sdc-075 control), `acbf8f2` (sdc-002 /
  sdc-076), `e04005b` (sdc-003 / sdc-077), `2c24df7` (sdc-004 / sdc-078), `5fb5142`
  (sdc-005 / sdc-079), `3a9cc73` (sdc-006 / sdc-080), `09a824e` (sdc-013 / sdc-081),
  `ceeaabc` (sdc-014 / sdc-082), `e7a5e31` (sdc-015 / sdc-083), `7e90c67` (sdc-016 /
  sdc-084) — all land at the tail of phase 3's control block (sdc-075..sdc-084) since
  the reuse tier is last in priority order.

## Files in this directory

- `base-pool.json` — the 84-slot corpus, its `allocation` rule documentation, and
  summary `counts`.
- `briefs/VARIANTS.md` — the three brief templates (verbatim), for seeders to reuse when
  writing the 30 seeded artifacts' briefs.
- `briefs/<id>.wo.txt` and `briefs/<id>.er.txt` — work-order and executor-report briefs
  for every one of the 54 `control` slots (108 files). Seeded-slot briefs (30 × 2) are
  written by the seeder agents alongside each seed's `.patch` and `key.json` entry, not
  here.
- `README.md` — this file.

## Verification

Run from the repo root (Node 22, git on PATH):

```
node <verify-script>   # checks: 84 unique sequential ids; 30 seeded / 54 control split;
                        # per-type seeded counts = 5; per-phase counts 12/24/24/24;
                        # per-severity seeded counts 6/18/6; every base/commit sha is
                        # 40-hex and `git cat-file -t` = commit; short sha is a prefix of
                        # the full commit sha; no duplicate (base, kind) pair within
                        # either kind; seed variant rotation within +-1 per TYPE and
                        # exactly 10/10/10 overall (amended rule); control variant
                        # rotation within +-1 for the control stratum; every control has
                        # both brief files and no seeded slot does.
```

All checks passed on this draw — see the assembler's final report for the quoted output.
