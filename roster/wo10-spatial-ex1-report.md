# SPATIAL SPECIALIST (E6) — WO-10 EX1 report

Order: deterministic closed-cylinder OBJ generator + mechanical mesh validator, risk T1,
no visual render available, no final artistic approval sought.
Workspace: `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\5f934331-1de4-4027-be71-da2868fd7fd2\scratchpad\wo10-fixtures\spatial` (fresh `git init`, branch `main`, 2 commits, tree clean).
`C:\Users\maxtl\Projects\Claude-Orchestra` was read only (charter) and never written.

```
STATUS: DONE
```

## CHANGES

- `...\wo10-fixtures\spatial\gen-cylinder.js:47` — `buildCylinder()` emits the fan-capped
  shared-ring topology: `(H+1)` rings of `R` vertices plus one centre vertex per cap.
- `...\wo10-fixtures\spatial\gen-cylinder.js:88` — side quads split as `(v00,v10,v11)` /
  `(v00,v11,v01)`, the order that puts `(B-A)x(C-A)` along `+radial`, i.e. outward.
- `...\wo10-fixtures\spatial\gen-cylinder.js:97` — bottom fan `(centre, ring0[j], ring0[j+1])`
  → normal `-Y`; top fan reversed `(centre, ringH[j+1], ringH[j])` → normal `+Y`. Both outward.
- `...\wo10-fixtures\spatial\gen-cylinder.js:31` — `fmt()` snaps `|v| < 1e-12` to hard zero and
  strips `-0.000000`, so output is byte-stable across runs and platforms.
- `...\wo10-fixtures\spatial\out\cylinder-12-3.obj` — the required artifact:
  radius=1, height=2, radialSegments=12, heightSegments=3 → 50 vertices, 96 triangles.
- `...\wo10-fixtures\spatial\validate-mesh.js:56` — OBJ parser (tolerates `v/vt/vn` face forms
  and negative indices; rejects non-triangular faces); checks (a)–(g) below.
- `...\wo10-fixtures\spatial\make-broken.js` — deterministically deletes one face line to build
  the broken variant (`faceIndex` parameter, default 0).
- `...\wo10-fixtures\spatial\out\cylinder-12-3-broken.obj` — valid mesh minus face #0 (`f 1 13 14`).
- `...\wo10-fixtures\spatial\runs.txt` — verbatim stdout of both validator runs, committed.

## TOPOLOGY AND FORMULAS (as required by the order)

**Cap style chosen: triangle fan from a single centre vertex per cap, fanning around the
shared end ring.** The cap reuses the side ring's vertices rather than duplicating them —
that is what makes the mesh watertight *by index*, not merely by coincident position, so
check (c) is a real topological test and not a floating-point proximity test.

Vertex layout: ring `i` (`0..H`) at `y = -height/2 + i*height/H`; ring vertex `j` (`0..R-1`)
at `theta = 2*pi*j/R`, `(r cos theta, y, r sin theta)`. Index `ring(i,j) = i*R + j`.
Then bottom centre `= (H+1)*R`, top centre `= (H+1)*R + 1`.

- (a) **V = (heightSegments + 1) * radialSegments + 2** = `4*12 + 2` = **50**
- (b) **T = 2*R*H (side) + R (bottom fan) + R (top fan) = 2 * radialSegments * (heightSegments + 1)**
  = `72 + 12 + 12` = **96**
- derived: **E = 3T/2 = 144**, and **V - E + T = 50 - 144 + 96 = 2** — closed genus-0 surface.

## DETERMINISTIC CHECKS

- manifold validity (undirected edge shared by exactly 2 triangles) → **pass** (144 edges, 0 boundary, 0 non-manifold)
- orientability (every *directed* edge occurs exactly once) → **pass** (0 duplicated directed edges)
- Euler characteristic V-E+F == 2 → **pass** (chi = 2)
- vertex-count formula (a) → **pass** (50 expected, 50 observed)
- triangle-count formula (b) → **pass** (96 expected, 96 observed)
- finiteness, no NaN/Inf (d) → **pass** (0 non-finite of 150 components)
- signed volume positive (e1a) → **pass** (5.999997202)
- signed volume vs closed form `(R/2) r^2 sin(2pi/R) h = 6.0` (e1b) → **pass** (|delta| = 2.798e-6, tol 1e-4;
  the residual is the 6-decimal OBJ quantisation, not a topology error)
- lateral faces outward from the Y axis, `dot(n_xz, c_xz) > 0` (e2a) → **pass** (72/72)
- cap faces normal parallel to Y with the sign of their own cap (e2b) → **pass** (24/24)
- convex-body cross-check, `dot(n, c_face - c_solid) > 0` (e3) → **pass** (0 inward)
- no orphan vertices / no zero-area triangles / indices in range (f1–f3) → **pass**
- polygon budget → 96 triangles for R=12,H=3; scales as `2R(H+1)`, no budget imposed by the order
- deterministic seeding → **pass**; no RNG, no clock. Two independent runs are byte-identical:
  `sha256 fd398d2eb60a284d5e2119307de928248db712bade624bedf881e3a44969a9a8` both times, `cmp` clean.
- serialization round-trip → **pass**; the validator re-parses the emitted OBJ and recovers
  exactly 50/96 with the geometry intact (that is the only path by which any check above ran).
- generality of the formulas → **pass**; `MESH VALID` also for (R=3,H=1), (R=5,H=2), (R=64,H=8).

**Negative control (checks are not vacuous).** With every face's winding reversed, the validator
fails exactly the winding checks and nothing else:
`e1a` (signed volume = -5.999997202), `e1b`, `e2a` (72/72 inward), `e2b` (24/24 mis-oriented),
`e3` (96 inward) → `MESH INVALID — failed check(s): e1a, e1b, e2a, e2b, e3`. Counts and
watertightness stay green, as they should — reversing winding does not change topology.
(Scratch file; not committed.)

## RENDER CAPTURE

- **none — no render was performed or available.** The order states no visual render is
  available and seeks no artistic approval, so this seat's Fable-critic escalation path for
  "numerically valid, visually wrong" output was deliberately not exercised. Every claim above
  is numeric. The nearest thing to visual evidence is the closed-form volume match (e1b), which
  would catch a mesh that is topologically clean but geometrically the wrong solid.

## VERIFICATION

Commands run, from the workspace root, `node v22.22.3`:

**1. Generate.** `node gen-cylinder.js`

```
wrote C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\5f934331-1de4-4027-be71-da2868fd7fd2\scratchpad\wo10-fixtures\spatial\out\cylinder-12-3.obj
  vertices  50
  triangles 96
```

**2. Determinism.** `node gen-cylinder.js --out=out/_det.obj && cmp out/cylinder-12-3.obj out/_det.obj`

```
fd398d2eb60a284d5e2119307de928248db712bade624bedf881e3a44969a9a8 *out/cylinder-12-3.obj
fd398d2eb60a284d5e2119307de928248db712bade624bedf881e3a44969a9a8 *out/_det.obj
DETERMINISM: byte-identical
```

**3. Validate the good mesh.**
`node validate-mesh.js out/cylinder-12-3.obj --radius=1 --height=2 --radialSegments=12 --heightSegments=3`

```
validate-mesh.js — out/cylinder-12-3.obj
  params: radius=1 height=2 radialSegments=12 heightSegments=3
  parsed: 50 vertices, 96 triangles

  [PASS] (0) OBJ parses cleanly (triangular faces only) — no parse problems
  [PASS] (a) vertex count == (heightSegments+1)*radialSegments + 2 — expected 50, got 50
  [PASS] (b) triangle count == 2*radialSegments*(heightSegments+1) — expected 96 (= 72 side + 12 bottom fan + 12 top fan), got 96
  [PASS] (f1) all face indices in range and distinct within a face — 0 out-of-range, 0 degenerate-index faces
  [PASS] (f2) no orphan vertices (every vertex used by some face) — 0 unreferenced vertex/vertices
  [PASS] (f3) no zero-area (degenerate) triangles — 0 degenerate
  [PASS] (d) no NaN / Inf coordinates — 0 non-finite coordinate component(s) of 150
  [PASS] (c1) watertight: every undirected edge shared by EXACTLY 2 triangles — 144 distinct edges; 0 boundary edge(s) (used once); 0 non-manifold edge(s)
  [PASS] (c2) orientable: every directed edge occurs exactly once (neighbours agree on outside) — 0 duplicated directed edge(s)
  [PASS] (g) Euler characteristic V - E + F == 2 (closed, genus 0) — V=50 E=144 F=96 -> chi=2
  [PASS] (e1a) signed volume is positive (outward winding overall) — signed volume = 5.999997202
  [PASS] (e1b) signed volume == closed form (R/2)*r^2*sin(2pi/R)*h for a regular R-gon prism — expected 6.000000000, got 5.999997202, |delta| = 2.798e-6 (tol 0.0001)
  [PASS] (e2a) lateral faces: normal points outward from the Y axis (dot(n_xz, c_xz) > 0) — 72 lateral face(s) (expected 72), 0 inward-facing
  [PASS] (e2b) cap faces: normal parallel to Y, sign matches its own cap (+Y top, -Y bottom) — 24 cap face(s) (expected 24), 0 mis-oriented/misplaced
  [PASS] (e3) every face normal points away from the solid centroid (convex-body cross-check) — 0 face(s) facing inward

MESH VALID
EXIT=0
```

**4. Build the broken variant.** `node make-broken.js out/cylinder-12-3.obj out/cylinder-12-3-broken.obj 0`

```
wrote out/cylinder-12-3-broken.obj — removed face #0: "f 1 13 14"
```

**5. Validate the broken mesh.**
`node validate-mesh.js out/cylinder-12-3-broken.obj --radius=1 --height=2 --radialSegments=12 --heightSegments=3`

```
validate-mesh.js — out/cylinder-12-3-broken.obj
  params: radius=1 height=2 radialSegments=12 heightSegments=3
  parsed: 50 vertices, 95 triangles

  [PASS] (0) OBJ parses cleanly (triangular faces only) — no parse problems
  [PASS] (a) vertex count == (heightSegments+1)*radialSegments + 2 — expected 50, got 50
  [FAIL] (b) triangle count == 2*radialSegments*(heightSegments+1) — expected 96 (= 72 side + 12 bottom fan + 12 top fan), got 95
  [PASS] (f1) all face indices in range and distinct within a face — 0 out-of-range, 0 degenerate-index faces
  [PASS] (f2) no orphan vertices (every vertex used by some face) — 0 unreferenced vertex/vertices
  [PASS] (f3) no zero-area (degenerate) triangles — 0 degenerate
  [PASS] (d) no NaN / Inf coordinates — 0 non-finite coordinate component(s) of 150
  [FAIL] (c1) watertight: every undirected edge shared by EXACTLY 2 triangles — 144 distinct edges; 3 boundary edge(s) (used once) [0,13 0,12 12,13]; 0 non-manifold edge(s)
  [PASS] (c2) orientable: every directed edge occurs exactly once (neighbours agree on outside) — 0 duplicated directed edge(s)
  [FAIL] (g) Euler characteristic V - E + F == 2 (closed, genus 0) — V=50 E=144 F=95 -> chi=1
  [PASS] (e1a) signed volume is positive (outward winding overall) — signed volume = 5.944441619
  [FAIL] (e1b) signed volume == closed form (R/2)*r^2*sin(2pi/R)*h for a regular R-gon prism — expected 6.000000000, got 5.944441619, |delta| = 5.556e-2 (tol 0.0001)
  [FAIL] (e2a) lateral faces: normal points outward from the Y axis (dot(n_xz, c_xz) > 0) — 71 lateral face(s) (expected 72), 0 inward-facing
  [PASS] (e2b) cap faces: normal parallel to Y, sign matches its own cap (+Y top, -Y bottom) — 24 cap face(s) (expected 24), 0 mis-oriented/misplaced
  [PASS] (e3) every face normal points away from the solid centroid (convex-body cross-check) — 0 face(s) facing inward

MESH INVALID — failed check(s): b, c1, g, e1b, e2a
EXIT=1
```

**Reading of run 5:** check (c) fails exactly as designed — the three edges of the deleted
triangle (`0-12`, `0-13`, `12-13`, 0-based) are each now used by only one triangle, i.e. a
literal hole in the lateral surface. The removed face is `f 1 13 14`, the first side triangle
`(ring0[0], ring1[0], ring1[1])`.

Note which checks correctly stay green: (a) vertex count is untouched, (c2) orientability still
holds (the 95 surviving faces still agree with each other), and (e2b)/(e3) still pass because
every *remaining* face is still wound outward — a hole does not flip any surviving normal.
Only the checks that actually depend on the missing face go red. That asymmetry is the point:
the check set localises the defect rather than reporting a uniform failure.

**6. Formula generality.** `for R,H in (3,1) (5,2) (64,8): generate + validate` → `MESH VALID` for all three.

**7. Commits.** `git log --oneline`

```
9dd5920 validate-mesh.js: mechanical mesh inspection + broken-variant runs
011d021 gen-cylinder.js: deterministic closed cylinder OBJ + out/cylinder-12-3.obj
```

`git status --short` → empty (clean).

## DEVIATIONS

- **Added checks beyond the order's (a)–(e).** The order asked for five; I also assert
  orientability (c2), Euler characteristic (g), index sanity, orphan vertices and degenerate
  triangles (f1–f3), and split (e) into three independent tests (e1/e2/e3). All of them gate
  `MESH VALID`. Rationale: the charter names deterministic-first inspection discipline as this
  seat's core strength, and (c) alone does not catch an inside-out but topologically perfect
  mesh. No check was omitted.
- **Added `make-broken.js`** rather than hand-editing the OBJ, so the broken fixture is
  reproducible from the good one. Committed with the validator (commit 2).
- **The broken variant fails five checks, not only (c).** Deleting a face necessarily also
  breaks the triangle count (b), the Euler characteristic (g), the volume (e1b) and the lateral
  face tally (e2a). I did not suppress those to make the demonstration look cleaner; the order
  asked to *show* it fails on (c), and it does, with the exact three boundary edges named.
- **Ran an extra inverted-winding negative control** (not requested, not committed) to prove
  the (e) family is not vacuously passing. Reported under DETERMINISTIC CHECKS.
- Everything else is exactly as ordered: two commits in the stated order, geometry-only OBJ
  (positions + triangular faces, no normals/UVs), no randomness anywhere.

## CONCERNS

- **Self-correction, disclosed:** my first pass at this report transcribed the broken run's
  `e3` row as `[FAIL]` and built a paragraph and a concern on top of that misreading. Re-running
  the validator and diffing against the committed `runs.txt` showed `e3` is `[PASS]`, and the
  `MESH INVALID` summary line (`b, c1, g, e1b, e2a`) had been telling me so all along. The
  report now quotes `runs.txt` verbatim. No code changed; the error was mine in the write-up,
  and the lesson is that the summary line is the authority over hand-copied rows.
- **`e3` is weaker than it looks on a non-watertight mesh.** It passes on the broken variant
  because every surviving face is still wound outward. That is correct behaviour, but it means
  `e3` is not evidence of closure — only `c1`/`g` are. Do not read a green `e3` as "the solid
  is sealed".
- **No visual confirmation exists.** Every claim is numeric. A mesh can pass all fifteen checks
  and still be visually wrong in ways this tooling cannot see (e.g. seam vertex duplication
  that a shading pass would reveal, or a cap fan that is planar but visually pinched). Per the
  charter this is precisely the class of defect reserved for the Fable global critic, and it
  was not run. Treat "MESH VALID" as *mechanically* valid only.
- **`e1b` tolerance is absolute (1e-4) and tuned for radius ~1.** For a large-radius cylinder
  the 6-decimal OBJ quantisation error grows with `r^2 h` and could exceed it; a relative
  tolerance would be more honest. Not hit by any parameter set run here (R=64 passed), but it
  is a latent scale dependence.
- **`e2b` classifies a face as a cap by "all three y equal".** That is exact for a cylinder but
  would misclassify a lateral face on a degenerate `heightSegments` layout or on any generator
  that emits flat side geometry. The check is topology-specific, not general-purpose.
- **Handoff, per charter:** productionizing this generator — seeds, LODs, UV/normal emission,
  serialization variants, editor controls — is Builder (E2) work at a fraction of this seat's
  draw and should not come back here. Final artistic approval remains with the human.
- Git emitted `LF will be replaced by CRLF` warnings on this Windows workspace. Committed
  content is LF; only the working copy would be converted on a fresh checkout. Harmless here,
  but a byte-identity check performed *after* a clone on Windows would compare CRLF files and
  must re-hash, not reuse the sha256 quoted above.
