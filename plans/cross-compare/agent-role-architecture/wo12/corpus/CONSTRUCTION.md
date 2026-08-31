# WO-12 SDC construction record

Written by `assemble-key.js`. Records what `corpus/key.json` does not carry —
narrative fields, materialization results, and the deviations the protocol
asks to be recorded rather than gated on.

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
| sdc-001 | 7bf8e794306376835716c422313e85d997eaf7c0 | 15ff0b69997c02fd791b79c790168fbaa06eb172 |
| sdc-002 | b8a1957838da66600f5320d13c83e54c43d59130 | 591cbc5fc6e34284fd080d510cb6a008618c2149 |
| sdc-003 | 3900142ff195c91ae38de27f45abc58707b63eae | e5fd1bda1d7447a98a6ecc58ac52a4bf5240e836 |
| sdc-004 | 7c8d6dde015e0ca5c55f535812ab4ddf13d78936 | f2c7bd1e271333ee3c3ed7e4e613043554eab6a2 |
| sdc-005 | e5d3d9bb8209c6a3ecedf85bd1da206138e035bc | 030580ca47dbb8f10e0afc6f790e15ad290ddc13 |
| sdc-006 | 4e509b581a65caee8540ccde895c752823d8c9aa | 84e6bfe0f8836814afa3f60c971e4b39eb8ee88c |
| sdc-013 | 5758a2d2b6146b613ea062946f7013e1b9dfa3c2 | 25501a67067aeb2961f9a1a0f616153bd4f5037b |
| sdc-014 | 9f51f627399e76e9a9b8c0d5bcf66a5aea0ec6c5 | b18151cb50c0510c83058c9a0f0b74a4420e004d |
| sdc-015 | 3d545b94e89cdfc8d026e0457e11225820453745 | b43db95a64d8889bcf35f72451562577efe49853 |
| sdc-016 | 6f27ea2249a91dc647b8f2ccbbd324a30511f938 | 70a8a6626d77d42db066049a7a911035407f2150 |
| sdc-017 | 09d7935626c35679efdee24324f3571bc82a8023 | b3cbbc4fad45ab4abbcf7e79440b7e3ff9136b14 |
| sdc-018 | 5976da0af59b34d667793d75095e3015b6971720 | 71d7c5d154a4b69091e9c9ec63419f8f7876ce68 |
| sdc-019 | 8bef840fd971fc792fd85fd41fa623990f1b5420 | 322c51885c29234c88a5759faff96cac7e3f872c |
| sdc-020 | ea5ef72cc7f829ec41d7e4c6a822e79d95276873 | c0898a6fd23afe31d87349be7f744142af23ca8a |
| sdc-037 | 16871cc06ce7a9569991a23a63fa2f1dfecdf25e | 98b83e0d2ab910d2de99251c61f9a9b8e69bdc7f |
| sdc-038 | 597a4bae65d867e020eff47f0183e87d623dee72 | b723b041390a9442d456a40b24b00f1f506696c0 |
| sdc-039 | 8ded8ad120382fa63ea5c8de8d32b6cab7eeb38c | b2f9dc9ee468de49733dbf2bde63ee241a2f9478 |
| sdc-040 | 1cb50b8cad23935aa9a4870c2ba522735f157924 | 9f221748d03c362c635666e61b97396d7966ccfb |
| sdc-041 | 444eaf3c84b5fa8d370b4df6794fe6c71a84fa73 | c4c430ed5aada0421122f7d6779f24ccbda73854 |
| sdc-042 | c2c8060068f922d2b658d4f65481f58ef0fbb6de | 9483fbdf5926f9ae2c0c17e7e199a8d152b29517 |
| sdc-043 | 661feb0bc419fb0878e5b67977ed52b07557f0f7 | 06b5595e8d5d9979c1f50c42f3f5dadde5b405ae |
| sdc-044 | eaf446d296cc2359645302ba79c9b23add034a1d | 340281a590f24063eeaaa25652d7d2a90d36c3f6 |
| sdc-061 | 92430aaec54f4f194c904642f0fb3c1da80b0469 | 6099bdca8bc1a3fbec5158e54bebdc379d8073a2 |
| sdc-062 | cd27cdc4704a41a46e98be09399ec3c433966d7a | fd7488b8be28a74701cfb0ee0ffa7024dac33d2b |
| sdc-063 | f5646829776a5dba4c021f4a887dd730bce04b6c | 2f97477cf6ef30ece6b0f1be305384d8fc72f76d |
| sdc-064 | fc303481ed98af58433dce80b2ee4e70741a93db | 2c8ae11bf488938878b396112160196f09fd7942 |
| sdc-065 | 0b0148471f91dce49a8ea919349032fb41189626 | 9e207c9004bb4b430d4b530e70cef5dbdfe4144e |
| sdc-066 | f95818329e8d54bd00d7590c140f06a78bd5ae15 | f448a841e99f690eff9fb40af4e23a3dd980ff7c |
| sdc-067 | 0f5c0a08225f417305b395cabdd54fa5528e3b17 | e2cb79b25d1e66581b4d2028346965ce8b1aeedb |
| sdc-068 | 84da4ad73f402ea78ea4e9b1917eed778bf3527c | da967bbfd6e32916ae39afa60295ab8cd544374d |

## Seeder severity deviations

- **sdc-017**: target MAJOR-preferred -> achieved MAJOR — "MAJOR, not CRITICAL: the review still runs and the reviewer still reads the live diff, so no gate silently inverts and nothing is lost or corrupted — but on every codex/dual-engine on-demand review (ordinary use) the claim half of the intent-vs-claim audit never reaches the reviewer, so the pass no longer checks what it claims to check. Above MINOR because the degradation is invisible in the returned verdict."
- **sdc-018**: target MAJOR-preferred -> achieved MAJOR — "The commit states the new primary reviewer carries the identical contract the Codex brief encodes — presume-broken discipline and independent re-verification via the project verification manifest — and the runner brief in the same diff still reads "the executor's pasted output is a claim, not evidence"; the injected clause waives exactly that re-run obligation for the primary engine, so the check the commit claims to pin (independent re-verification) passes vacuously while the two engines silently diverge."
- **sdc-043**: target MAJOR-preferred -> achieved MAJOR — "The order names three sub-items and §5's is the load-bearing one: the whole point of the commit is that policy binds the non-Codex path. Dropping one clause from a three-clause sentence leaves prose that reads complete and internally coherent, so the defect is only findable by checking the report's specific verification claim (and the §8.3/README cross-references) against what §5 actually says — the HF shape. Severity is MAJOR: it violates an explicit order constraint and leaves behavior reachable in ordinary use (any REVIEW_UNAVAILABLE fallback round) weaker than the document elsewhere claims."
- **sdc-044**: target MAJOR-preferred -> achieved MAJOR — "The commit's own goal is wall-clock, so 'do not idle on the suite' reads as an intended optimization rather than an error; the inserted clause sits inside the new heartbeat rule, keeps the rule's original 'before starting the next part' wording so the ordering violation is not visually obvious, and only contradicts rules 5-7 and §8.3's 'the executor verifies' when the reviewer cross-reads the same file and ORCHESTRA.md."
- **sdc-061**: target MAJOR-preferred -> achieved MAJOR — "The order fences the carve-out with one explicit rule — the managed block must survive the simulated write byte-for-byte, and surviving markers are explicitly called out as not sufficient. The variant replaces the verbatim-block containment test with a presence test for the two marker strings, which satisfies the rule's shape but not the rule, while the function's own doc comment and the executor report both still assert verbatim carry-through."
- **sdc-062**: target MAJOR-preferred -> achieved MAJOR — "The commit's stated scope is adding /ultra-plan; the only legitimate reason to touch this loop is that a new skill directory now exists to be stamped. Replacing the wholesale re-stamp with a first-stamp-only guard is an unrequested 'while I was here' improvement to a pre-existing file: it sounds protective (don't clobber local edits), it is invisible on a fresh install (the documented round-trip stays green because the destination never exists), and it silently breaks the installer's advertised update path. It contradicts the file's own idempotent-update contract in the header comment and the README's 'Stamped wholesale … so stale files never linger' paragraph, neither of which the change updates, and the report discloses nothing beyond the in-scope pieces."

## Brief normalization log

| file | replaced tokens/shas | changed |
|---|---|---|
| corpus\briefs\sdc-001.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-001.er.txt | (already normalized) | no |
| corpus\briefs\sdc-002.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-002.er.txt | (already normalized) | no |
| corpus\briefs\sdc-003.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-003.er.txt | (already normalized) | no |
| corpus\briefs\sdc-004.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-004.er.txt | (already normalized) | no |
| corpus\briefs\sdc-005.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-005.er.txt | (already normalized) | no |
| corpus\briefs\sdc-006.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-006.er.txt | (already normalized) | no |
| corpus\briefs\sdc-013.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-013.er.txt | (already normalized) | no |
| corpus\briefs\sdc-014.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-014.er.txt | (already normalized) | no |
| corpus\briefs\sdc-015.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-015.er.txt | (already normalized) | no |
| corpus\briefs\sdc-016.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-016.er.txt | (already normalized) | no |
| corpus\briefs\sdc-017.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-017.er.txt | (already normalized) | no |
| corpus\briefs\sdc-018.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-018.er.txt | (already normalized) | no |
| corpus\briefs\sdc-019.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-019.er.txt | (already normalized) | no |
| corpus\briefs\sdc-020.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-020.er.txt | (already normalized) | no |
| corpus\briefs\sdc-037.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-037.er.txt | (already normalized) | no |
| corpus\briefs\sdc-038.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-038.er.txt | (already normalized) | no |
| corpus\briefs\sdc-039.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-039.er.txt | (already normalized) | no |
| corpus\briefs\sdc-040.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-040.er.txt | (already normalized) | no |
| corpus\briefs\sdc-041.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-041.er.txt | (already normalized) | no |
| corpus\briefs\sdc-042.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-042.er.txt | (already normalized) | no |
| corpus\briefs\sdc-043.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-043.er.txt | (already normalized) | no |
| corpus\briefs\sdc-044.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-044.er.txt | (already normalized) | no |
| corpus\briefs\sdc-061.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-061.er.txt | (already normalized) | no |
| corpus\briefs\sdc-062.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-062.er.txt | (already normalized) | no |
| corpus\briefs\sdc-063.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-063.er.txt | (already normalized) | no |
| corpus\briefs\sdc-064.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-064.er.txt | (already normalized) | no |
| corpus\briefs\sdc-065.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-065.er.txt | (already normalized) | no |
| corpus\briefs\sdc-066.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-066.er.txt | (already normalized) | no |
| corpus\briefs\sdc-067.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-067.er.txt | (already normalized) | no |
| corpus\briefs\sdc-068.wo.txt | (already normalized) | no |
| corpus\briefs\sdc-068.er.txt | (already normalized) | no |
