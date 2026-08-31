STATUS: DONE

CHANGES
- src/parse-duration.js:1 — new module implementing `parseDuration(input)`; supports units d/h/m/s/ms, integer counts only, units required in strictly descending order (d > h > m > s > ms), each unit at most once, no sign, no whitespace; returns total milliseconds or `null` for any malformed input, including the empty string.

VERIFICATION
- `node test.js` → `all pass` (exact, full stdout; no other output, exit code 0)

DEVIATIONS
- none — test.js was saved verbatim from the order and committed unmodified as the baseline (commit 45c9020) before the implementation commit (commit cda8569), as instructed.

CONCERNS
- I did not certify these tests per my charter — I ran the Director's provided suite and am reporting the observed output only (`all pass`); I make no claim beyond that literal result.
- The provided suite does not exercise every edge case implied by the spec (e.g. leading zeros like `007d`, very large counts, non-string input types, a bare unit with no digits like `d5`, trailing garbage after a valid token like `1h5m x`). My implementation handles these per my own reading of the spec, but that reading is untested by the acceptance artifact — flagging for the dispatcher/reviewer's awareness, not requesting rework.
- Fixture repo is a standalone git repo at the scratchpad path (2 commits: baseline test, then implementation); working tree is clean.
