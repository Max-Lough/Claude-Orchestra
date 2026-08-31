# WO-12c — interface generation castings (reduced form)

This directory is the SDC-adjacent corpus for `wo12-protocol.md` §3.5: six
static-component orders with mechanical acceptance only (markup validity,
the WCAG contrast computation the WO-10 exercise already proved, no
browser). Nothing in this directory dispatches a model pass — it is the
pre-registered corpus, the mechanical checker, and the checker's own
validation evidence.

## File tree

```
wo12/c/
  README.md            this file
  contrast.js           WCAG 2.x contrast-ratio function, reused verbatim from WO-10 (E5)
  check.js              node c/check.js --order c-0N --file <output.html>
  orders/
    c-01.md              accessible sortable data table (markup-only sort affordance)
    c-02.md              responsive 1/2/3-column card grid
    c-03.md              labeled form with inline validation messages
    c-04.md              tabbed panel with correct ARIA roles
    c-05.md              notification banner set (info/warn/error), WCAG-AA
    c-06.md              pricing table with a featured-row highlight
  checks/
    c-01.json .. c-06.json   per-order requiredStructure + contrastPairs specs consumed by check.js
```

No reference output files (correct or wrong) are committed here — per
instruction they were built and run from a temp directory outside the repo
and are not part of this corpus. `check.js`'s exact commands and outputs
against both are quoted verbatim below under Validation.

## The six orders

| Order | File | Component | Distinguishing mechanical checks |
|---|---|---|---|
| `c-01` | `table.html` | Accessible data table, sortable-header affordance | 5× `aria-sort="none"` + labeled sort buttons; 4 fixed data rows by id; header/body contrast |
| `c-02` | `cards.html` | Responsive card grid (1/2/3 columns) | `role="list"`/`role="listitem"`; base + 2 `@media` breakpoint rules for `grid-template-columns`; title/body contrast |
| `c-03` | `form.html` | Labeled form, inline validation messages | 3× label/input/`aria-describedby`/error-message quads; label + error-message contrast |
| `c-04` | `tabs.html` | Tabbed panel, ARIA roles | `tablist`/`tab`×3/`tabpanel`×3 wiring, `aria-selected`, `tabindex`, `hidden` state; active-tab + panel contrast |
| `c-05` | `banners.html` | Notification banners (info/warn/error) | `role="status"`×2 + `role="alert"`×1, fixed copy; 3 independent contrast pairs |
| `c-06` | `pricing.html` | Pricing table, featured-row highlight | `scope="col"`×4, `scope="row"`×3, per-row ids/prices; base + inverted featured-row contrast |

Every order is fully specified: a fixed hex palette, fixed copy text, and a
fixed markup structure (attribute order included), so acceptance is
deterministic — the same output either passes or fails `check.js`
identically on every run, with no model judgment in the loop.

## Arms (from `wo12-protocol.md` §3.5 — reduced form; not run here)

§3.5 is prose, not a table in the source; the arms it names are reproduced
here as a table for reference. **No arm was dispatched in this task** — no
codex/engine invocation and no model trial pass was run; this is corpus
construction only.

| Arm | Casting | Role |
|---|---|---|
| Sol · medium | GPT-5.6 Sol, medium effort | primary rung, low end of the stated range |
| Sol · high | GPT-5.6 Sol, high effort | primary rung, high end of the stated range |
| Opus · high | Claude Opus 5, high effort | cross-family reference only (no rule promotes it — the plan gives E5 no Anthropic authoring mirror, `castings.json` `noMirrorFor.primary`) |

Each output additionally gets the Opus·high **closing** read-only review
(the E5 closing rung) on top of the mechanical checks — not exercised here
either, for the same reason.

**Rule (verbatim intent, §3.5):** within the Sol range, medium is adopted
as the default effort iff `accepted(Sol·med) ≥ accepted(Sol·high) − 1` of 6;
else high. Opus results are reported as reference only. The render-loop
half of 12c (E5's normal browser/screenshot loop) is **not run**; its rule
is pre-registered for when an environment exists, per §3.5's closing
paragraph — until then E5's casting stays as shipped.

## Mechanical checks (`check.js`)

```
node c/check.js --order c-0N --file <output.html>
```

Runs, in this order, and exits 0 iff every check passes:

1. **well-formedness** — a tolerant tag-balance parser (no dependencies):
   every opened non-void element must be closed; no void element
   (`br`, `img`, `input`, `hr`, `meta`, …) may be explicitly closed.
2. **forbidden-content** — the constraints every order states: no
   `<script src`, no `<link rel="stylesheet">`, no `on*=` event-handler
   attributes, no literal `http://`/`https://`.
3. **required-structure** — the per-order `requiredStructure` entries in
   `c/checks/c-0N.json` (ids, roles, labels, fixed copy, exact counts).
4. **contrast** — WCAG-AA ≥ 4.5:1 for every text/background pair the
   order's palette declares (`contrastPairs` in the same JSON), computed by
   `c/contrast.js`.

`contrast.js` is **not a reimplementation** — it is the WO-10 Interface
Artisan exercise's own `contrastRatio(hex1, hex2)` function
(`roster/wo10-interface-artisan-ex1-transcript.md`, "contrast.js
implementation (full, for the record)"), copied verbatim and cited in its
header comment. Sanity-checked here against that record's own numbers:

```
> node -e "console.log(require('./contrast.js').contrastRatio('#000000','#ffffff'))"
21
> node -e "console.log(require('./contrast.js').contrastRatio('#172554','#ffffff'))"
14.694794518800467
```

Both match the WO-10 record exactly (`roster/wo10-band-record.md` line 342;
the transcript's independent `require()` cross-check).

## Validation

For each order, a minimal **CORRECT** reference output and a deliberately
**WRONG** one were built in a temp directory (outside this repository, not
committed) and run through `check.js`. Outputs below are quoted verbatim.

Each wrong variant carries exactly one injected defect, chosen to spread
across all four check categories:

| Order | Injected defect | Category exercised |
|---|---|---|
| c-01 | dropped a closing `</td>` in the North row | well-formedness |
| c-02 | added `onclick="alert(1)"` to a card button | forbidden-content |
| c-03 | dropped `aria-describedby="email-error"` from the email input | required-structure |
| c-04 | dropped `role="tab"` from the Billing tab button | required-structure |
| c-05 | swapped the error banner's text color from `#7f1d1d` to `#fca5a5` | contrast |
| c-06 | added a stray `http://example.com/pricing` URL in the caption | forbidden-content |

### c-01 — table.html

**Correct:**

```
$ node c/check.js --order c-01 --file <correct>/table.html
PASS — well-formedness (tag-balance) — 89 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — table has id=revenue-table — matched: "<table id="revenue-table""
PASS — caption fixed copy present — matched: "<caption>Quarterly Revenue by Region</caption>"
PASS — 5 column headers carry aria-sort="none" — found 5 occurrence(s), expected 5
PASS — 5 sort-affordance button aria-labels present — found 5 occurrence(s), expected 5
PASS — row-north id present — matched: "<tr id="row-north""
PASS — row-south id present — matched: "<tr id="row-south""
PASS — row-east id present — matched: "<tr id="row-east""
PASS — row-west id present — matched: "<tr id="row-west""
PASS — North Q4 value $142,000 present — matched: "$142,000"
PASS — South Q4 value $115,000 present — matched: "$115,000"
PASS — East Q4 value $99,750 present — matched: "$99,750"
PASS — West Q4 value $160,400 present — matched: "$160,400"
PASS — contrast: table header text on header background — fg=#ffffff bg=#1d4ed8 ratio=6.702 (min 4.5)
PASS — contrast: table body text on body background — fg=#111827 bg=#ffffff ratio=17.740 (min 4.5)

ALL CHECKS PASSED (19 checks)
$ echo $?
0
```

**Wrong** (dropped `</td>`):

```
$ node c/check.js --order c-01 --file <wrong>/table.html
FAIL — well-formedness (tag-balance) — 88 tags scanned; expected </td>, found </tr>; expected </td>, found </tbody>; expected </td>, found </table>; expected </td>, found </body>; expected </td>, found </html>; unclosed element(s): <html>, <body>, <table>, <tbody>, <tr>, <td>
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — table has id=revenue-table — matched: "<table id="revenue-table""
[... 14 more PASS lines identical to the correct run, structure and contrast unaffected ...]

CHECKS FAILED (1/19 failed)
$ echo $?
1
```

Named failed check: `well-formedness (tag-balance)`.

### c-02 — cards.html

**Correct:**

```
$ node c/check.js --order c-02 --file <correct>/cards.html
PASS — well-formedness (tag-balance) — 37 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — grid container id=card-grid role=list — matched: "<div class="card-grid" id="card-grid" role="list">"
PASS — exactly 3 article.card elements — found 3 occurrence(s), expected 3
PASS — card-1 present with fixed h2 copy — matched: "<article class="card" id="card-1" role="listitem"> <h2>Starter Plan Overview</h2…"
PASS — card-2 present with fixed h2 copy — matched: "<article class="card" id="card-2" role="listitem"> <h2>Growth Plan Overview</h2>"
PASS — card-3 present with fixed h2 copy — matched: "<article class="card" id="card-3" role="listitem"> <h2>Scale Plan Overview</h2>"
PASS — card-1 Learn-more button aria-label — matched: "aria-label="Learn more about the Starter plan""
PASS — card-2 Learn-more button aria-label — matched: "aria-label="Learn more about the Growth plan""
PASS — card-3 Learn-more button aria-label — matched: "aria-label="Learn more about the Scale plan""
PASS — base layout is single-column (grid-template-columns: 1fr) — matched: ".card-grid { display: grid; grid-template-columns: 1fr"
PASS — 2-column breakpoint declared (min-width: 640px) — matched: "@media (min-width: 640px) { .card-grid { grid-template-columns: repeat(2"
PASS — 3-column breakpoint declared (min-width: 1024px) — matched: "@media (min-width: 1024px) { .card-grid { grid-template-columns: repeat(3"
PASS — contrast: card title text on card background — fg=#111827 bg=#f3f4f6 ratio=16.119 (min 4.5)
PASS — contrast: card body text on card background — fg=#374151 bg=#f3f4f6 ratio=9.366 (min 4.5)

ALL CHECKS PASSED (18 checks)
$ echo $?
0
```

**Wrong** (inline `onclick=` on card-1's button):

```
$ node c/check.js --order c-02 --file <wrong>/cards.html
PASS — well-formedness (tag-balance) — 37 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
FAIL — no inline event-handler attributes (on*=) — found: "onclick="
PASS — no http(s):// literal URLs — not found
[... remaining 13 PASS lines identical to the correct run ...]

CHECKS FAILED (1/18 failed)
$ echo $?
1
```

Named failed check: `no inline event-handler attributes (on*=)`.

### c-03 — form.html

**Correct:**

```
$ node c/check.js --order c-03 --file <correct>/form.html
PASS — well-formedness (tag-balance) — 36 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — form has id=signup-form — matched: "<form id="signup-form""
PASS — full-name label+input pair, wired by aria-describedby — matched: "<label for="full-name">Full name</label> <input type="text" id="full-name" name=…"
PASS — full-name-error message, fixed copy — matched: "<p id="full-name-error" class="error-message">Please enter your full name.</p>"
PASS — email label+input pair, wired by aria-describedby — matched: "<label for="email">Email address</label> <input type="email" id="email" name="em…"
PASS — email-error message, fixed copy — matched: "<p id="email-error" class="error-message">Please enter a valid email address.</p…"
PASS — password label+input pair, wired by aria-describedby — matched: "<label for="password">Password</label> <input type="password" id="password" name…"
PASS — password-error message, fixed copy — matched: "<p id="password-error" class="error-message">Password must be at least 8 charact…"
PASS — submit button, fixed copy — matched: "<button type="submit">Create account</button>"
PASS — contrast: label text on form background — fg=#111827 bg=#ffffff ratio=17.740 (min 4.5)
PASS — contrast: error-message text on error-message background — fg=#7f1d1d bg=#fee2e2 ratio=8.202 (min 4.5)

ALL CHECKS PASSED (15 checks)
$ echo $?
0
```

**Wrong** (dropped `aria-describedby` on the email input):

```
$ node c/check.js --order c-03 --file <wrong>/form.html
PASS — well-formedness (tag-balance) — 36 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — form has id=signup-form — matched: "<form id="signup-form""
PASS — full-name label+input pair, wired by aria-describedby — matched: "<label for="full-name">Full name</label> <input type="text" id="full-name" name=…"
PASS — full-name-error message, fixed copy — matched: "<p id="full-name-error" class="error-message">Please enter your full name.</p>"
FAIL — email label+input pair, wired by aria-describedby — no match found
PASS — email-error message, fixed copy — matched: "<p id="email-error" class="error-message">Please enter a valid email address.</p…"
[... remaining PASS lines identical to the correct run ...]

CHECKS FAILED (1/15 failed)
$ echo $?
1
```

Named failed check: `email label+input pair, wired by aria-describedby`.

### c-04 — tabs.html

**Correct:**

```
$ node c/check.js --order c-04 --file <correct>/tabs.html
PASS — well-formedness (tag-balance) — 33 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — tablist with aria-label — matched: "<div role="tablist" aria-label="Settings sections">"
PASS — tab-profile: role=tab, selected, controls panel-profile — matched: "<button type="button" role="tab" id="tab-profile" aria-selected="true" aria-cont…"
PASS — tab-billing: role=tab, unselected, tabindex=-1 — matched: "<button type="button" role="tab" id="tab-billing" aria-selected="false" aria-con…"
PASS — tab-security: role=tab, unselected, tabindex=-1 — matched: "<button type="button" role="tab" id="tab-security" aria-selected="false" aria-co…"
PASS — panel-profile: role=tabpanel, labelledby, not hidden — matched: "<div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">"
PASS — panel-billing: role=tabpanel, labelledby, hidden — matched: "<div role="tabpanel" id="panel-billing" aria-labelledby="tab-billing" hidden>"
PASS — panel-security: role=tabpanel, labelledby, hidden — matched: "<div role="tabpanel" id="panel-security" aria-labelledby="tab-security" hidden>"
PASS — exactly 3 role="tab" elements — found 3 occurrence(s), expected 3
PASS — exactly 3 role="tabpanel" elements — found 3 occurrence(s), expected 3
PASS — contrast: selected-tab text on selected-tab background — fg=#ffffff bg=#1d4ed8 ratio=6.702 (min 4.5)
PASS — contrast: tabpanel body text on tabpanel background — fg=#111827 bg=#ffffff ratio=17.740 (min 4.5)

ALL CHECKS PASSED (16 checks)
$ echo $?
0
```

**Wrong** (dropped `role="tab"` from the Billing button):

```
$ node c/check.js --order c-04 --file <wrong>/tabs.html
PASS — well-formedness (tag-balance) — 33 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — tablist with aria-label — matched: "<div role="tablist" aria-label="Settings sections">"
PASS — tab-profile: role=tab, selected, controls panel-profile — matched: "<button type="button" role="tab" id="tab-profile" aria-selected="true" aria-cont…"
FAIL — tab-billing: role=tab, unselected, tabindex=-1 — no match found
PASS — tab-security: role=tab, unselected, tabindex=-1 — matched: "<button type="button" role="tab" id="tab-security" aria-selected="false" aria-co…"
PASS — panel-profile: role=tabpanel, labelledby, not hidden — matched: "<div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">"
PASS — panel-billing: role=tabpanel, labelledby, hidden — matched: "<div role="tabpanel" id="panel-billing" aria-labelledby="tab-billing" hidden>"
PASS — panel-security: role=tabpanel, labelledby, hidden — matched: "<div role="tabpanel" id="panel-security" aria-labelledby="tab-security" hidden>"
FAIL — exactly 3 role="tab" elements — found 2 occurrence(s), expected 3
PASS — exactly 3 role="tabpanel" elements — found 3 occurrence(s), expected 3
PASS — contrast: selected-tab text on selected-tab background — fg=#ffffff bg=#1d4ed8 ratio=6.702 (min 4.5)
PASS — contrast: tabpanel body text on tabpanel background — fg=#111827 bg=#ffffff ratio=17.740 (min 4.5)

CHECKS FAILED (2/16 failed)
$ echo $?
1
```

Named failed checks: `tab-billing: role=tab, unselected, tabindex=-1` and
`exactly 3 role="tab" elements` — one defect (a dropped attribute) correctly
tripped both the specific-element check and the aggregate count check, which
is the intended redundancy, not double-counting a different defect.

### c-05 — banners.html

**Correct:**

```
$ node c/check.js --order c-05 --file <correct>/banners.html
PASS — well-formedness (tag-balance) — 23 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — banner-info: id, class, role=status — matched: "<div class="banner banner-info" id="banner-info" role="status">"
PASS — banner-info fixed copy — matched: "<p>Your changes have been saved successfully.</p>"
PASS — banner-warn: id, class, role=status — matched: "<div class="banner banner-warn" id="banner-warn" role="status">"
PASS — banner-warn fixed copy — matched: "<p>Your session will expire in 5 minutes.</p>"
PASS — banner-error: id, class, role=alert — matched: "<div class="banner banner-error" id="banner-error" role="alert">"
PASS — banner-error fixed copy — matched: "<p>Unable to save changes. Please try again.</p>"
PASS — contrast: info banner text on info background — fg=#14532d bg=#f0fdf4 ratio=8.704 (min 4.5)
PASS — contrast: warn banner text on warn background — fg=#92400e bg=#fffbeb ratio=6.837 (min 4.5)
PASS — contrast: error banner text on error background — fg=#7f1d1d bg=#fee2e2 ratio=8.202 (min 4.5)

ALL CHECKS PASSED (14 checks)
$ echo $?
0
```

**Wrong** (error banner text lightened from `#7f1d1d` to `#fca5a5`):

```
$ node c/check.js --order c-05 --file <wrong>/banners.html
PASS — well-formedness (tag-balance) — 23 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — banner-info: id, class, role=status — matched: "<div class="banner banner-info" id="banner-info" role="status">"
PASS — banner-info fixed copy — matched: "<p>Your changes have been saved successfully.</p>"
PASS — banner-warn: id, class, role=status — matched: "<div class="banner banner-warn" id="banner-warn" role="status">"
PASS — banner-warn fixed copy — matched: "<p>Your session will expire in 5 minutes.</p>"
PASS — banner-error: id, class, role=alert — matched: "<div class="banner banner-error" id="banner-error" role="alert">"
PASS — banner-error fixed copy — matched: "<p>Unable to save changes. Please try again.</p>"
PASS — contrast: info banner text on info background — fg=#14532d bg=#f0fdf4 ratio=8.704 (min 4.5)
PASS — contrast: warn banner text on warn background — fg=#92400e bg=#fffbeb ratio=6.837 (min 4.5)
FAIL — contrast: error banner text on error background — fg=#fca5a5 bg=#fee2e2 ratio=1.554 (min 4.5)

CHECKS FAILED (1/14 failed)
$ echo $?
1
```

Named failed check: `contrast: error banner text on error background`
(1.554 < 4.5).

### c-06 — pricing.html

**Correct:**

```
$ node c/check.js --order c-06 --file <correct>/pricing.html
PASS — well-formedness (tag-balance) — 59 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
PASS — no http(s):// literal URLs — not found
PASS — table has id=pricing-table — matched: "<table id="pricing-table""
PASS — caption fixed copy present — matched: "<caption>Plan Pricing Comparison</caption>"
PASS — 4 column headers with scope="col" — found 4 occurrence(s), expected 4
PASS — 3 row headers with scope="row" — found 3 occurrence(s), expected 3
PASS — plan-starter row, fixed price — matched: "<tr id="plan-starter"> <th scope="row">Starter</th> <td>$9</td>"
PASS — plan-growth row, featured class, fixed price — matched: "<tr id="plan-growth" class="featured"> <th scope="row">Growth</th> <td>$29</td>"
PASS — plan-scale row, fixed price — matched: "<tr id="plan-scale"> <th scope="row">Scale</th> <td>$79</td>"
PASS — contrast: base table text on table background — fg=#111827 bg=#ffffff ratio=17.740 (min 4.5)
PASS — contrast: featured row text on featured row background — fg=#ffffff bg=#111827 ratio=17.740 (min 4.5)

ALL CHECKS PASSED (14 checks)
$ echo $?
0
```

**Wrong** (added `http://example.com/pricing` inside the caption text):

```
$ node c/check.js --order c-06 --file <wrong>/pricing.html
PASS — well-formedness (tag-balance) — 59 tags scanned, tag stack balanced, no void misuse
PASS — no external <script src> — not found
PASS — no external <link rel="stylesheet"> — not found
PASS — no inline event-handler attributes (on*=) — not found
FAIL — no http(s):// literal URLs — found: "http://"
PASS — table has id=pricing-table — matched: "<table id="pricing-table""
FAIL — caption fixed copy present — no match found
PASS — 4 column headers with scope="col" — found 4 occurrence(s), expected 4
PASS — 3 row headers with scope="row" — found 3 occurrence(s), expected 3
PASS — plan-starter row, fixed price — matched: "<tr id="plan-starter"> <th scope="row">Starter</th> <td>$9</td>"
PASS — plan-growth row, featured class, fixed price — matched: "<tr id="plan-growth" class="featured"> <th scope="row">Growth</th> <td>$29</td>"
PASS — plan-scale row, fixed price — matched: "<tr id="plan-scale"> <th scope="row">Scale</th> <td>$79</td>"
PASS — contrast: base table text on table background — fg=#111827 bg=#ffffff ratio=17.740 (min 4.5)
PASS — contrast: featured row text on featured row background — fg=#ffffff bg=#111827 ratio=17.740 (min 4.5)

CHECKS FAILED (2/14 failed)
$ echo $?
1
```

Named failed checks: `no http(s):// literal URLs` (the injected defect
itself) and, as a correct side effect, `caption fixed copy present` — the
literal URL was inserted inside the caption text, so the exact-copy check
correctly stopped matching too. Both failures trace to the same single
edit; this is not a second independent defect.

## Ambiguities resolved

The task and `wo12-protocol.md` §3.5 specify the corpus's *shape*
(mechanical acceptance only, markup validity, the WO-10 contrast
computation, six orders drawn from named example component types) but not
every construction detail. Choices made, and why:

1. **§3.5's "arm table" doesn't exist as a table in the source.** §3.5 is
   prose (Sol·medium, Sol·high, Opus·high named inline, plus the adoption
   rule). Rendered it as a table here for the README's own readability,
   labeled as such, rather than inventing table cells not in the source.

2. **Forbidden-content constraints are identical across all six orders**
   (no external CSS/JS, no inline handlers, no `http(s)://`) rather than
   varying per order. The task's own example phrasing ("no external
   CSS/JS, no inline event handlers") reads as the standing constraint set
   for this whole reduced-form trial, not a per-order menu — so `check.js`
   applies one fixed forbidden-content set to every order, and each order
   file states the same four "do not"s in the same words for consistency
   an executor can rely on.

3. **Required-structure checks are regex-based against literal, fixed
   markup, not a DOM/CSS-selector engine.** Since every order fixes exact
   structure and attribute order (a design choice made *to* achieve
   determinism, not one that narrows an otherwise-open order), a small
   tolerant regex layer is sufficient and keeps `check.js` dependency-free.
   One collision surfaced during validation: c-04's CSS declares the
   attribute selector `[role="tab"]`, which the first draft of its
   `role="tab"` count-check also matched inside the `<style>` block,
   over-counting by one. Fixed by anchoring the two count patterns on a
   preceding whitespace character (`\srole="tab"`), which only ever
   precedes a real HTML attribute in this markup, not a CSS selector's
   `[`. Documented here rather than silently patched, since it's exactly
   the kind of mechanical-checker bug the validation step exists to catch.

4. **Contrast pairs are extracted from the CSS actually present, not
   asserted from the order text.** Each `contrastPairs` entry in
   `c/checks/c-0N.json` locates a specific CSS rule block by selector, then
   pulls whatever `color`/`background-color` hex values are declared *in
   that block* and computes their ratio — it does not simply check that
   the order's stated hex values appear somewhere in the file. This means
   a submission that used a different (but still-passing) palette would
   pass the contrast check while presumably failing a required-structure
   or human-review check for not matching the fixed spec, and a
   submission that kept the right selectors but changed only the color
   values (as the c-05 wrong variant does) is caught exactly where it
   should be — by the contrast check itself, computed from what's really
   in the file, not from a hardcoded expectation.

5. **c-01's "markup-only sort affordance"** was read as: no working sort
   is required or checked (there is no browser to exercise one), but the
   `aria-sort="none"` + labeled `<button>` per column must exist as the
   affordance. The order text says this explicitly and forbids claiming a
   working sort was verified, mirroring the WO-10 Interface Artisan
   order's own "state the harness gap plainly" instruction for the
   equivalent no-browser situation.

6. **Six wrong variants each carry exactly one injected defect**, chosen
   to spread across all four check categories (well-formedness ×1,
   forbidden-content ×2, required-structure ×2, contrast ×1) rather than
   stacking multiple defect types into fewer variants — the task's example
   list ("missing a role, a bad-contrast color, an inline handler") reads
   as illustrative of the defect *kinds* `check.js` must catch, not as a
   requirement that every wrong variant contain all three at once.
