# WO-12 SDC construction record

Written by `assemble-key.js`. Records what `corpus/key.json` does not carry —
narrative fields, materialization results, the generated-brief shape evidence, and
the deviations the protocol asks to be recorded rather than gated on.

## Tallies (protocol §2.2/§2.3/§2.6/§2.7 targets)

Total: 84 (30 seeded + 54 control)

| Type | count (target 5) |
|---|---|
| CV | 5 |
| OO | 5 |
| LC | 5 |
| FT | 5 |
| HF | 5 |
| RC | 5 |

| Severity | count | target |
|---|---|---|
| CRITICAL | 6 | >=6 |
| MAJOR | 24 | >=20 |
| MINOR | 0 | <=4 |
CRITICAL present in types: CV, FT, HF, LC, OO, RC (target >=4 types)

| Variant | seeds (target 10) | controls (target 18) |
|---|---|---|
| V1 | 10 | 18 |
| V2 | 10 | 18 |
| V3 | 10 | 18 |

| Phase | count | target |
|---|---|---|
| 0 | 12 | 12 |
| 1 | 24 | 24 |
| 2 | 24 | 24 |
| 3 | 24 | 24 |

No target warnings — every §2.2/§2.3/§2.6/§2.7 target is met exactly.

## Brief length report (blinding evidence)

| population | order words (mean ± sd) | claims words (mean ± sd) |
|---|---|---|
| seeded | 144.3 ± 11.7  (n=30, range 121–159) | 75.2 ± 13.0  (n=30, range 57–99) |
| control | 128.3 ± 18.3  (n=54, range 95–160) | 73.1 ± 11.3  (n=54, range 48–99) |
| all | 134.0 ± 17.9  (n=84, range 95–160) | 73.8 ± 11.9  (n=84, range 48–99) |

Bands enforced on EVERY artifact: order 60–160 words, claims 30–100 words (VARIANTS.md v2). A band satisfied by both
populations is necessary but not sufficient: read the two means above against each other. A visible gap is a
blinding finding even though nothing here failed.

## Structural-tell lint result

Every brief is GENERATED from `corpus/content/<id>.json` through VARIANTS.md v2's
one template set, and the lint below passed before anything was written.

| check | result |
|---|---|
| distinct work-order skeletons across all 84 artifacts | 1 (must be 1) |
| distinct executor-report skeletons within variant V1 | 1 (must be 1) |
| distinct executor-report skeletons within variant V2 | 1 (must be 1) |
| distinct executor-report skeletons within variant V3 | 1 (must be 1) |
| KIND values carried by only one population | 0 (must be 0) |
| distinct KIND values in the corpus | code |

### The KIND ruling

**KIND is declared pool-wide as `code`.** VARIANTS.md v2 keys the V3 hazard list on the
artifact's KIND — "a property of the base commit, shared by seeds and controls alike" — but
`base-pool.json` records no such property (its own `kind` field is the ARTIFACT kind, seeded/control).
The value therefore comes from protocol §2.1's own declaration of the pool: "Base-commit pool: KIND=code,
SIZE S or M, TESTED preferred".

**Rationale — why a per-commit KIND would be wrong.** All 30 seeded bases are code commits, while the 54
controls are drawn from a wider sweep that includes docs-only commits (`base-pool.json`'s allocation note:
"then (c) full_table non-shortlisted kind=docs S/M commits"). Deriving KIND per commit would put `docs` on
controls ONLY, and since the hazard list is keyed on KIND, a V3 report carrying the two-item docs list
would identify its artifact as a control at 100% precision — the round-1 CRITICAL 4 tell (type-derived
hazard lines) re-created in mirror image. One pool-wide KIND gives every V3 artifact the same list, which
carries no information about kind at all.

`resolveKind()` prefers an explicit per-slot field (`base_kind` / `kind_class` / `commit_kind` /
`classKind`) if one is ever added to the pool, and `lintKindSymmetry()` fails assembly closed if any KIND
value ends up carried by only one population — so a second KIND cannot be introduced asymmetrically.

## Cross-artifact base/subject collisions (disclosure, non-gating)

§2.1's pool-ran-short allowance lets a base commit serve one seeded variant AND one control. Where that
happened, the two briefs necessarily carry an identical `Base (its parent)` sha and an identical
`Commit subject:` line with different heads — a cross-artifact tell for anyone who reads BOTH packets
(round-1 R0 MINOR). Nothing here can remove it: the reuse is a property of the committed base-pool
allocation, not of brief generation. It is listed so the reuse is visible where the briefs are, and so an
adjudicator reading two packets side by side knows which pairs to discount.

| base | subject | artifacts sharing it |
|---|---|---|
| 7bf8e7943063… | WO-11 round 3: Sol·max holistic findings applied (exercise d | sdc-001 (seeded, V1), sdc-075 (control, V3) |
| b8a1957838da… | WO-11: P0 R4 default forecast corrected to WO-2 measured dra | sdc-002 (seeded, V2), sdc-076 (control, V1) |
| 3900142ff195… | WO-8 round 5f: pre-add records as a hard prerequisite; resid | sdc-003 (seeded, V3), sdc-077 (control, V2) |
| 7c8d6dde015e… | WO-8 round 5e: checkout identity from git's own records; gua | sdc-004 (seeded, V1), sdc-078 (control, V3) |
| e5d3d9bb8209… | WO-8 round 5d: fail-closed identity capture; lock-condition  | sdc-005 (seeded, V2), sdc-079 (control, V1) |
| 4e509b581a65… | WO-8 round 5c: creation-time canonical identity for live che | sdc-006 (seeded, V3), sdc-080 (control, V2) |
| 5758a2d2b614… | WO-8 round 5b: the sweep's live-set exemption compares REAL  | sdc-013 (seeded, V2), sdc-081 (control, V3) |
| 3d545b94e89c… | WO-8 round 5: structural sweep guard — the CRITICAL both CI  | sdc-015 (seeded, V3), sdc-082 (control, V1) |
| 8ded8ad12038… | WO-8 round 4: fix all four R0-EX4 findings; record the R0-EX | sdc-039 (seeded, V2), sdc-083 (control, V2) |
| 444eaf3c84b5… | WO-8 round 3: fix all five R0-EX3 findings; record the R0-EX | sdc-041 (seeded, V3), sdc-084 (control, V3) |

**10 collision group(s).**

## Seeded artifacts

| id | type | severity | locator.file | phase | variant |
|---|---|---|---|---|---|
| sdc-001 | CV | MAJOR | quartermaster/quartermaster.js | 0 | V1 |
| sdc-002 | OO | MAJOR | quartermaster/quartermaster.js | 0 | V2 |
| sdc-003 | LC | MAJOR | verifier/checkout.js | 0 | V3 |
| sdc-004 | FT | MAJOR | tests/review-lane.test.js | 0 | V1 |
| sdc-005 | HF | MAJOR | tests/review-lane.test.js | 0 | V2 |
| sdc-006 | RC | MAJOR | verifier/checkout.js | 0 | V3 |
| sdc-013 | CV | CRITICAL | verifier/checkout.js | 1 | V2 |
| sdc-014 | CV | MAJOR | router/router.js | 1 | V3 |
| sdc-015 | OO | CRITICAL | verifier/checkout.js | 1 | V3 |
| sdc-016 | OO | MAJOR | packs/codex/agents/architect-claude.md | 1 | V1 |
| sdc-017 | LC | MAJOR | skills/orchestra-review/SKILL.md | 1 | V1 |
| sdc-018 | FT | MAJOR | agents/reviewer.md | 1 | V2 |
| sdc-019 | HF | MAJOR | skills/orchestra-status/SKILL.md | 1 | V3 |
| sdc-020 | RC | MAJOR | agents/detective.md | 1 | V1 |
| sdc-037 | CV | MAJOR | .github/workflows/test.yml | 2 | V1 |
| sdc-038 | OO | MAJOR | packs/codex/hooks/orchestra-review.js | 2 | V2 |
| sdc-039 | LC | CRITICAL | verifier/checkout.js | 2 | V2 |
| sdc-040 | LC | MAJOR | packs/codex/hooks/orchestra-engine-mcp.js | 2 | V3 |
| sdc-041 | FT | CRITICAL | tests/router.test.js | 2 | V3 |
| sdc-042 | FT | MAJOR | tests/frontmatter-lint.test.js | 2 | V1 |
| sdc-043 | HF | MAJOR | ORCHESTRA.md | 2 | V1 |
| sdc-044 | RC | MAJOR | agents/executor.md | 2 | V2 |
| sdc-061 | CV | MAJOR | hooks/orchestra-guard.js | 3 | V2 |
| sdc-062 | OO | MAJOR | install.js | 3 | V3 |
| sdc-063 | LC | MAJOR | ORCHESTRA.md | 3 | V1 |
| sdc-064 | FT | MAJOR | skills/orchestra-status/SKILL.md | 3 | V2 |
| sdc-065 | HF | CRITICAL | router/router.js | 3 | V2 |
| sdc-066 | HF | MAJOR | packs/codex/hooks/orchestra-review.js | 3 | V3 |
| sdc-067 | RC | CRITICAL | plans/cross-compare/agent-role-architecture/wo7b/score.js | 3 | V3 |
| sdc-068 | RC | MAJOR | packs/codex/hooks/orchestra-review.js | 3 | V1 |

## Materialized heads

| id | base | head |
|---|---|---|
| sdc-001 | 7bf8e794306376835716c422313e85d997eaf7c0 | a14280eaabc8f0e61f01ddaeaf4ffa68123ede21 |
| sdc-002 | b8a1957838da66600f5320d13c83e54c43d59130 | dfc217060a2023b64c73730391146fc2a1ca9272 |
| sdc-003 | 3900142ff195c91ae38de27f45abc58707b63eae | 3523e234256fd3aee90e16c5393be3867eb13e21 |
| sdc-004 | 7c8d6dde015e0ca5c55f535812ab4ddf13d78936 | b50470d0f9cf1ed6cd16b69d190f811066247d50 |
| sdc-005 | e5d3d9bb8209c6a3ecedf85bd1da206138e035bc | 1c651fb18903e8d968624247858564dc9233a134 |
| sdc-006 | 4e509b581a65caee8540ccde895c752823d8c9aa | 54a5dc05836cd3022a198ad38c96c8b6fe161aac |
| sdc-013 | 5758a2d2b6146b613ea062946f7013e1b9dfa3c2 | e09bbc44cbd4b69af3b5d1e52c186205f6686376 |
| sdc-014 | 9f51f627399e76e9a9b8c0d5bcf66a5aea0ec6c5 | 43c83abdf1ae029789982b3af63a66189b37ff7a |
| sdc-015 | 3d545b94e89cdfc8d026e0457e11225820453745 | 77254e801d95ea6a56b8aaea720f261e88ec5f80 |
| sdc-016 | 6f27ea2249a91dc647b8f2ccbbd324a30511f938 | 46c5a4cb9c0970af3f7523be045c3fe1c8ce0d2f |
| sdc-017 | 09d7935626c35679efdee24324f3571bc82a8023 | cbd426483d775b4422a90551ea09150f3cdb033a |
| sdc-018 | 5976da0af59b34d667793d75095e3015b6971720 | 7bda5af543385a1864ccc45803dfb108159e7818 |
| sdc-019 | 8bef840fd971fc792fd85fd41fa623990f1b5420 | e3e8ea9c66a33415e69b9601ccffde7e176a1853 |
| sdc-020 | ea5ef72cc7f829ec41d7e4c6a822e79d95276873 | 59b0e16d4b37b8cbe18a85d936acd5e17bc2f41c |
| sdc-037 | 16871cc06ce7a9569991a23a63fa2f1dfecdf25e | 540c60da758b26a3d1a7d9ad581751bad664d6f5 |
| sdc-038 | 597a4bae65d867e020eff47f0183e87d623dee72 | 10badb8ebee166e195dd79ee3eef18856eb5d2fc |
| sdc-039 | 8ded8ad120382fa63ea5c8de8d32b6cab7eeb38c | f0f578c7b76bb440490c0c2471fbb6e673a5b2a3 |
| sdc-040 | 1cb50b8cad23935aa9a4870c2ba522735f157924 | 5d9363f5429ab08dc4c81ffe316db9ffd3c134c9 |
| sdc-041 | 444eaf3c84b5fa8d370b4df6794fe6c71a84fa73 | cb083613d8f184d7a7d6b7f8da6fe0856e276e38 |
| sdc-042 | c2c8060068f922d2b658d4f65481f58ef0fbb6de | e24b7aef6e8ab8de8aa43ede574da998858d9da4 |
| sdc-043 | 661feb0bc419fb0878e5b67977ed52b07557f0f7 | e66bd414612938e417adb9f0187b2b222d8db541 |
| sdc-044 | eaf446d296cc2359645302ba79c9b23add034a1d | d5c41b9bf7e736a6b16482d11dda69148d7485d6 |
| sdc-061 | 92430aaec54f4f194c904642f0fb3c1da80b0469 | 55b22b39891aa221d0ae95c19e72b14feb570f96 |
| sdc-062 | cd27cdc4704a41a46e98be09399ec3c433966d7a | 24da6cec12426772ba0b743214e1e20129841323 |
| sdc-063 | f5646829776a5dba4c021f4a887dd730bce04b6c | 1c6144e7330e70fe07b6ba7d22062ef7f929fd33 |
| sdc-064 | fc303481ed98af58433dce80b2ee4e70741a93db | 3721b6211b5503fa984af5c621a1f9adb1ef2242 |
| sdc-065 | 0b0148471f91dce49a8ea919349032fb41189626 | 51663fc30a5dc432a79dcf0ffde4051d27cbcd21 |
| sdc-066 | f95818329e8d54bd00d7590c140f06a78bd5ae15 | 4ecfe5becd31a4100640f95142908e40fd47da31 |
| sdc-067 | 0f5c0a08225f417305b395cabdd54fa5528e3b17 | 6b274a055f89af3c33fda63ff73abb6462374965 |
| sdc-068 | 84da4ad73f402ea78ea4e9b1917eed778bf3527c | bd5c5169c5193c059668ee776cf7d433d3887330 |

## Seeder severity deviations

- **sdc-017**: target MAJOR-preferred -> achieved MAJOR — "MAJOR, not CRITICAL: the review still runs and the reviewer still reads the live diff, so no gate silently inverts and nothing is lost or corrupted — but on every codex/dual-engine on-demand review (ordinary use) the claim half of the intent-vs-claim audit never reaches the reviewer, so the pass no longer checks what it claims to check. Above MINOR because the degradation is invisible in the returned verdict."
- **sdc-018**: target MAJOR-preferred -> achieved MAJOR — "The commit states the new primary reviewer carries the identical contract the Codex brief encodes — presume-broken discipline and independent re-verification via the project verification manifest — and the runner brief in the same diff still reads "the executor's pasted output is a claim, not evidence"; the injected clause waives exactly that re-run obligation for the primary engine, so the check the commit claims to pin (independent re-verification) passes vacuously while the two engines silently diverge."
- **sdc-043**: target MAJOR-preferred -> achieved MAJOR — "The order names three sub-items and §5's is the load-bearing one: the whole point of the commit is that policy binds the non-Codex path. Dropping one clause from a three-clause sentence leaves prose that reads complete and internally coherent, so the defect is only findable by checking the report's specific verification claim (and the §8.3/README cross-references) against what §5 actually says — the HF shape. Severity is MAJOR: it violates an explicit order constraint and leaves behavior reachable in ordinary use (any REVIEW_UNAVAILABLE fallback round) weaker than the document elsewhere claims."
- **sdc-044**: target MAJOR-preferred -> achieved MAJOR — "The commit's own goal is wall-clock, so 'do not idle on the suite' reads as an intended optimization rather than an error; the inserted clause sits inside the new heartbeat rule, keeps the rule's original 'before starting the next part' wording so the ordering violation is not visually obvious, and only contradicts rules 5-7 and §8.3's 'the executor verifies' when the reviewer cross-reads the same file and ORCHESTRA.md."
- **sdc-061**: target MAJOR-preferred -> achieved MAJOR — "The order fences the carve-out with one explicit rule — the managed block must survive the simulated write byte-for-byte, and surviving markers are explicitly called out as not sufficient. The variant replaces the verbatim-block containment test with a presence test for the two marker strings, which satisfies the rule's shape but not the rule, while the function's own doc comment and the executor report both still assert verbatim carry-through."
- **sdc-062**: target MAJOR-preferred -> achieved MAJOR — "The commit's stated scope is adding /ultra-plan; the only legitimate reason to touch this loop is that a new skill directory now exists to be stamped. Replacing the wholesale re-stamp with a first-stamp-only guard is an unrequested 'while I was here' improvement to a pre-existing file: it sounds protective (don't clobber local edits), it is invisible on a fresh install (the documented round-trip stays green because the destination never exists), and it silently breaks the installer's advertised update path. It contradicts the file's own idempotent-update contract in the header comment and the README's 'Stamped wholesale … so stale files never linger' paragraph, neither of which the change updates, and the report discloses nothing beyond the in-scope pieces."

## Per-artifact brief content lengths

| id | kind | variant | KIND | order words | claims words |
|---|---|---|---|---|---|
| sdc-001 | seeded | V1 | code | 148 | 57 |
| sdc-002 | seeded | V2 | code | 152 | 77 |
| sdc-003 | seeded | V3 | code | 128 | 63 |
| sdc-004 | seeded | V1 | code | 136 | 57 |
| sdc-005 | seeded | V2 | code | 132 | 79 |
| sdc-006 | seeded | V3 | code | 133 | 76 |
| sdc-007 | control | V1 | code | 160 | 80 |
| sdc-008 | control | V2 | code | 140 | 77 |
| sdc-009 | control | V3 | code | 152 | 81 |
| sdc-010 | control | V1 | code | 153 | 74 |
| sdc-011 | control | V2 | code | 151 | 61 |
| sdc-012 | control | V3 | code | 142 | 48 |
| sdc-013 | seeded | V2 | code | 157 | 74 |
| sdc-014 | seeded | V3 | code | 155 | 70 |
| sdc-015 | seeded | V3 | code | 157 | 87 |
| sdc-016 | seeded | V1 | code | 157 | 90 |
| sdc-017 | seeded | V1 | code | 134 | 64 |
| sdc-018 | seeded | V2 | code | 136 | 78 |
| sdc-019 | seeded | V3 | code | 144 | 81 |
| sdc-020 | seeded | V1 | code | 139 | 66 |
| sdc-021 | control | V1 | code | 139 | 65 |
| sdc-022 | control | V2 | code | 153 | 65 |
| sdc-023 | control | V3 | code | 110 | 63 |
| sdc-024 | control | V1 | code | 116 | 68 |
| sdc-025 | control | V2 | code | 108 | 65 |
| sdc-026 | control | V3 | code | 134 | 69 |
| sdc-027 | control | V1 | code | 142 | 69 |
| sdc-028 | control | V2 | code | 145 | 67 |
| sdc-029 | control | V3 | code | 149 | 70 |
| sdc-030 | control | V1 | code | 125 | 76 |
| sdc-031 | control | V2 | code | 128 | 63 |
| sdc-032 | control | V3 | code | 144 | 74 |
| sdc-033 | control | V1 | code | 130 | 55 |
| sdc-034 | control | V2 | code | 114 | 62 |
| sdc-035 | control | V3 | code | 133 | 81 |
| sdc-036 | control | V1 | code | 112 | 60 |
| sdc-037 | seeded | V1 | code | 157 | 96 |
| sdc-038 | seeded | V2 | code | 158 | 80 |
| sdc-039 | seeded | V2 | code | 121 | 57 |
| sdc-040 | seeded | V3 | code | 142 | 62 |
| sdc-041 | seeded | V3 | code | 138 | 66 |
| sdc-042 | seeded | V1 | code | 134 | 69 |
| sdc-043 | seeded | V1 | code | 135 | 92 |
| sdc-044 | seeded | V2 | code | 158 | 67 |
| sdc-045 | control | V2 | code | 140 | 80 |
| sdc-046 | control | V3 | code | 128 | 90 |
| sdc-047 | control | V1 | code | 135 | 79 |
| sdc-048 | control | V2 | code | 111 | 73 |
| sdc-049 | control | V3 | code | 107 | 59 |
| sdc-050 | control | V1 | code | 107 | 64 |
| sdc-051 | control | V2 | code | 102 | 68 |
| sdc-052 | control | V3 | code | 95 | 83 |
| sdc-053 | control | V1 | code | 107 | 70 |
| sdc-054 | control | V2 | code | 103 | 68 |
| sdc-055 | control | V3 | code | 96 | 70 |
| sdc-056 | control | V1 | code | 103 | 63 |
| sdc-057 | control | V2 | code | 101 | 68 |
| sdc-058 | control | V3 | code | 121 | 92 |
| sdc-059 | control | V1 | code | 143 | 98 |
| sdc-060 | control | V2 | code | 118 | 72 |
| sdc-061 | seeded | V2 | code | 157 | 82 |
| sdc-062 | seeded | V3 | code | 157 | 94 |
| sdc-063 | seeded | V1 | code | 127 | 58 |
| sdc-064 | seeded | V2 | code | 133 | 81 |
| sdc-065 | seeded | V2 | code | 150 | 99 |
| sdc-066 | seeded | V3 | code | 159 | 98 |
| sdc-067 | seeded | V3 | code | 138 | 61 |
| sdc-068 | seeded | V1 | code | 156 | 76 |
| sdc-069 | control | V3 | code | 131 | 78 |
| sdc-070 | control | V1 | code | 138 | 98 |
| sdc-071 | control | V2 | code | 153 | 75 |
| sdc-072 | control | V3 | code | 116 | 72 |
| sdc-073 | control | V1 | code | 152 | 99 |
| sdc-074 | control | V2 | code | 152 | 85 |
| sdc-075 | control | V3 | code | 110 | 72 |
| sdc-076 | control | V1 | code | 139 | 72 |
| sdc-077 | control | V2 | code | 111 | 77 |
| sdc-078 | control | V3 | code | 136 | 85 |
| sdc-079 | control | V1 | code | 115 | 81 |
| sdc-080 | control | V2 | code | 149 | 89 |
| sdc-081 | control | V3 | code | 120 | 55 |
| sdc-082 | control | V1 | code | 134 | 58 |
| sdc-083 | control | V2 | code | 122 | 70 |
| sdc-084 | control | V3 | code | 155 | 89 |
