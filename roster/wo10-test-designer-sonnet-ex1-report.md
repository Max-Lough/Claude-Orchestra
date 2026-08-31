# WO-10 EX1 — Test Designer (vsOpenaiAuthor) — contrast.js pinning suite

Seat: Test Designer (class Q0), rung `vsOpenaiAuthor`
Implementation under test: `contrastRatio(hex1, hex2)` in `contrast.js`, authored by GPT-5.6 Sol (Interface Artisan seat, OpenAI family), copied read-only into this fixture. **Not edited.**

Fixture root (git repo, isolated from the main Claude-Orchestra repo):
`...\scratchpad\wo10-fixtures\test-designer-sonnet\`

Files:
- `contrast.js` — verbatim copy of the implementation under test (untouched).
- `test-core.js` — the oracle: an independently re-derived WCAG relative-luminance/contrast function (`oracleLuminance`/`oracleContrastRatio`, using the WCAG-quoted threshold constant `0.03928`, not read from `contrast.js`'s code), plus `runSuite(contrastRatio, assert)` holding all pinned assertions.
- `test.js` — suite entry point; requires `./contrast.js` and runs `runSuite`. Run with `node test.js`.
- `mutant1.js` — copy of `contrast.js` with R/B luminance coefficients swapped (`0.2126`↔`0.0722`).
- `mutant2.js` — copy of `contrast.js` with the `+0.05` offsets dropped from the final ratio (`lighter / darker` instead of `(lighter + 0.05) / (darker + 0.05)`).
- `mutation-check.js` — runs `runSuite` against any list of module paths and reports PASS/FAIL per target without throwing, so all three can be checked in one invocation.

---

## STATUS: DONE

## TESTS AUTHORED

All in `test-core.js::runSuite`, invoked from `test.js`:

- `contrastRatio('#000000','#ffffff') === 21` and reversed-argument form — pins the canonical WCAG max-contrast value, observed to be **exactly** 21 (verified with `Object.is`/`===`, not approximate).
- Symmetry `f(a,b) === f(b,a)` over 6 pairs spanning achromatic and chromatic colors.
- Identity `f(c,c) === 1` over 6 colors including black, white, gray, and a boundary gray (`#0a0a0a`).
- 5 mid-range pairs pinned to literal expected values I derived independently from the WCAG formula (own `oracleContrastRatio`, not by reading `contrast.js`'s code structure), each also cross-checked against my own oracle to catch transcription slips in the suite itself:
  - `('#777777','#0000ff') === 1.9187806423931342`
  - `('#336699','#ffcc00') === 3.96686374391581`
  - `('#767676','#ffffff') === 4.542224959605253` (the commonly-cited WCAG AA gray-on-white reference pair)
  - `('#ff0000','#00ff00') === 2.9139375476009137`
  - `('#ff0000','#0000ff') === 2.148936170212766`
- sRGB linearization threshold boundary: 4 grays straddling the branch point (`#090909`, `#0a0a0a` linear branch; `#0b0b0b`, `#0c0c0c` power-curve branch under both the spec-quoted `0.03928` threshold and the implementation's `0.04045`), each pinned to an independently-derived exact value.
- Input-format behavior — pinned to `TypeError` for: 3-digit hex shorthand (`#fff`), hex without leading `#` (`ffffff`), an invalid CSS keyword (`red`), `null`, `undefined`, a bare number, empty string, 8-digit hex with alpha, whitespace-padded hex, and non-hex letters (`#gggggg`).
- Input-format behavior — pinned to accept and normalize case: `#FFFFFF` and `#FfFfFf` both accepted, both giving `21` against black.

## MUTATION CHECK

Command: `node mutation-check.js ./contrast.js ./mutant1.js ./mutant2.js`

```
./contrast.js: SUITE PASSED (green)
./mutant1.js: SUITE FAILED (red) -- mid-range pin failed for (#777777, #0000ff): expected 1.9187806423931342
+ actual - expected

+ 1.1199488481041677
- 1.9187806423931342

./mutant2.js: SUITE FAILED (red) -- black vs white must be exactly 21 (WCAG max contrast)

Infinity !== 21
```

- mutant1 (R/B luminance coefficients swapped) → suite went **red**: yes (caught by the `#0000ff` mid-range pin — swapping R/B coefficients has no effect on achromatic pairs like black/white/gray-on-gray, so the suite's inclusion of pure-blue and asymmetric-channel pairs was necessary to catch it; confirmed non-vacuous).
- mutant2 (dropped `+0.05` offsets) → suite went **red**: yes (caught immediately by the primary black/white pin: `lighter/darker` degenerates to `1/0 = Infinity` when the darker color is pure black).
- original (`contrast.js`, unmodified) → suite stayed **green**: yes.

Suite is confirmed non-vacuous against both required mutants.

## VERIFICATION

- `node test.js` → `ALL TESTS PASSED (test.js against ./contrast.js)`
- `node mutation-check.js ./contrast.js ./mutant1.js ./mutant2.js` → output pasted above (1 green, 2 red, as required).
- `git log --oneline` in the fixture repo → `ad0a289 WO-10 EX1: independent pinning suite + mutants for contrast.js` (fixture repo initialized and committed locally; `Claude-Orchestra` main repo untouched).

## DEVIATIONS

- Split the suite into `test-core.js` (oracle + `runSuite`) and `test.js` (entry point requiring `./contrast.js`) rather than putting everything in one file, so `mutation-check.js` could run the identical assertion set against `contrast.js`/`mutant1.js`/`mutant2.js` without duplicating test logic three times. `test.js` itself is still the plain-node-assert suite entry point the order named, and running `node test.js` alone fully exercises the pinning suite against the original.
- Order asked for the sRGB threshold boundary pinned at "0.03928/12.92 vs power-curve branch" — I pinned it, but discovered the implementation actually branches at `0.04045`, not `0.03928` (see FINDING below). I pinned observed behavior (which happens to be numerically indistinguishable from the `0.03928`-branched spec formula for all 8-bit hex inputs) and documented the discrepancy rather than silently testing against the wrong constant.
- Added a `#767676`/`#ffffff` pair beyond the minimum "two known mid-range pairs" requested, since it's the pair most commonly cited in WCAG AA discussions and gives an extra independent cross-check.

## CONCERNS

None beyond the FINDING below. No flakiness expected: all inputs and expected outputs are exact IEEE-754 doubles, no timing/random/environment dependence, `node --version` v22.22.3 used throughout.

---

## FINDINGS on `contrast.js` (reported, not fixed)

1. **sRGB linearization threshold constant deviates from the WCAG-quoted spec text, but is behaviorally inert for hex-quantized inputs.** `contrast.js` branches at `channel <= 0.04045`; the WCAG 2.1 spec text (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) quotes `0.03928`. I enumerated all 256 possible 8-bit channel values (`n/255` for `n` in `0..255`) and confirmed **zero** values fall in the open interval `(0.03928, 0.04045]` where the two thresholds would disagree — so for every representable 6-digit hex color, the two constants produce bit-identical branch decisions and therefore identical output. Note for context, not a bug report: `0.04045` (≈`0.040449936`) is actually the mathematically self-consistent crossover point where the WCAG's two piecewise branches meet with equal output (the widely-known small discontinuity/erratum in the literally-quoted `0.03928` spec text), so the implementation's choice is arguably *more* correct than the literal spec text, just not textually matching it. Flagging because an order/spec that expects the literal `0.03928` constant to be pinned would find a textual mismatch, even though no observable-behavior test can distinguish the two at 8-bit hex precision.

2. **No support for 3-digit hex shorthand (`#fff`) or hex without a leading `#` (`ffffff`).** Both throw `TypeError`. This is a defensible strict-input design choice (not a spec violation — WCAG's formula doesn't govern input parsing), but it means callers passing CSS-shorthand hex values (a common real-world color representation) will get a hard throw rather than normalization. Worth confirming this is the intended contract for downstream callers.

3. **No support for 8-digit hex with an alpha channel (`#000000ff`)** — throws `TypeError` rather than ignoring/stripping the alpha bytes. Reasonable given WCAG contrast is undefined for translucent colors without a composited backdrop, but flagging since alpha-channel hex is common in modern CSS.

All three are informational; none block or require a fix from this seat (Q0 does not edit production logic per charter).
