# `corpus/key.json` schema

The sealed key for the WO-12 seeded-defect corpus (SDC — protocol §2). Committed
**before any review pass**. `build-corpus.js`, `run-lane.js` and `score.js` all read
this file and nothing else for corpus structure; the `<id>.patch` files and
`briefs/<id>.wo.txt` / `briefs/<id>.er.txt` are the only other corpus inputs.

```
{
  "version": 1,
  "artifacts": [
    {
      "id": "sdc-001",
      "kind": "seeded" | "control",
      "phase": 0 | 1 | 2 | 3,
      "variant": "V1" | "V2" | "V3",
      "base": "<parent sha>",
      "commit": "<real commit sha>",
      "subject": "...",
      "seed": {
        "type": "CV" | "OO" | "LC" | "FT" | "HF" | "RC",
        "severity": "CRITICAL" | "MAJOR" | "MINOR",
        "locator": { "file": "...", "lines": [a, b], "symbol": "..." },
        "consequence": "...",
        "rationale": "...",
        "hazard_terms": ["..."]
      } | null
    }
  ]
}
```

## Field notes

- **`version`** — schema version of this file. `1` for everything this protocol
  describes; a future incompatible change bumps it, and every reader of this file
  should refuse an unrecognized version rather than guess.

- **`artifacts`** — the corpus, in **corpus order** (protocol §2.6: "the committed
  corpus order; artifacts are never reordered after a phase runs"). Every tool that
  reads this file in phase-grouped fashion (`run-lane.js`) relies on array order
  being the authoritative order — there is no separate ordering field.

- **`id`** — unique across the whole corpus. Used as the `<id>.patch` and
  `briefs/<id>.{wo,er}.txt` filename stem, and as the results-file join key.

- **`kind`** — `"seeded"` (a variant with exactly one injected defect) or
  `"control"` (the real, unmodified commit — protocol §2.1). Determines whether
  `build-corpus.js` applies a patch (`seeded`) or simply checks out the real
  `commit` (`control`).

- **`phase`** — which of the four allowance-gated phases (protocol §2.6) this
  artifact is drawn in. `run-lane.js --phase <n>` selects exactly the artifacts
  whose `phase` equals `<n>`, in corpus order. Phase 0 is the 12-artifact pilot;
  phases 1–3 add 24 each, completing 84.

- **`variant`** — the 12h blinding packet variant (protocol §2.7) baked into the
  corresponding `briefs/<id>.wo.txt` / `briefs/<id>.er.txt` pair at corpus
  construction time. `run-lane.js` never chooses or alters the variant — it only
  records this field alongside each result so `score.js` can break recall out by
  variant.

- **`base`** — the parent commit sha `P`: for a seeded artifact, the commit
  `build-corpus.js` checks out and applies `<id>.patch` on top of; for a control,
  the commit the review is diffed against (`--base-ref`).

- **`commit`** — the REAL historical commit sha `C` this artifact is drawn from.
  For a control, this is also the review's `--head-ref` (materialized verbatim, no
  re-commit). For a seeded artifact, `commit` identifies which real commit's
  parent/subject/shape the variant `C'` is built from — `C'` itself is not `commit`
  and is not stored in `key.json` at all: it is *computed* by `build-corpus.js`
  (reproducibly, from `base` + `<id>.patch` + the fixed seeder identity) and only
  ever appears as the `head` in that tool's output.

- **`subject`** — the real commit `C`'s subject line, kept in the key for human
  readability and audit; `build-corpus.js` uses THIS field directly as the
  seeded variant's own commit message (the REAL commit C's subject, never
  derived from `base`/parent `P`'s own subject — see that script's header
  comment for why: `P` describes a different, unrelated change, and using it
  would hand the reviewer the wrong stated intent entirely).

- **`seed`** — `null` for a control. For a seeded artifact, the sealed defect
  record (protocol §2.2–§2.3):
  - **`type`** — one of the six complementarity-set codes (CV/OO/LC/FT/HF/RC,
    protocol §2.2 table).
  - **`severity`** — `CRITICAL` | `MAJOR` | `MINOR` (protocol §2.3 rubric).
  - **`locator`** — where the defect lives in `C'`: `file` (repo-relative path, as
    it appears in the `base -> C'` diff), `lines` (`[startLine, endLine]` in that
    file at `C'`, inclusive), and `symbol` (the enclosing function/symbol name).
    `score.js`'s hit rule reads this: a finding is a mechanical hit when it cites
    `locator.file` **and** either its own cited line(s) overlap `locator.lines`
    within ±3, **or** its text names `locator.symbol`.
  - **`consequence`** — one sentence: what actually goes wrong.
  - **`rationale`** — why this severity was assigned.
  - **`hazard_terms`** — vendor-free terms available to the 12h V3 (blind +
    hazard) packet variant's TYPE-FAMILY-generic hint (never the seed's own
    locator or verbatim text — protocol §2.7).

## Invariants a loader should check (not all enforced by the tools in this
directory — recorded here so a future validator has one place to look)

- Every `id` is unique.
- Every `base` and `commit` (and, for controls, `base` again as the diff parent)
  resolves to a real commit in this repository's history.
- Each base commit is used for at most one seeded variant and at most one control
  (protocol §2.1) — recorded as an exception in the corpus notes if the pool ran
  short.
- `kind: "seeded"` implies `seed` is a non-null object with all fields present and
  a `<id>.patch` file exists alongside `key.json`; `kind: "control"` implies
  `seed` is `null` and no patch file exists for that id.
- Allocation totals match protocol §2.1/§2.2: 84 artifacts total (30 seeded + 54
  controls), 5 seeds per `type` (30), severity distribution ≥20 MAJOR, ≥6
  CRITICAL, ≤4 MINOR overall, ≥1 CRITICAL in at least four types.
- `phase` totals match protocol §2.6: phase 0 has 12 artifacts (6 seeded + 6
  controls), phases 1–3 have 24 each (8 seeded + 16 controls).
