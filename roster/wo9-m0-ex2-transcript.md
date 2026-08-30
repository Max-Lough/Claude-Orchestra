EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-terra (flag), tier: standard, effort: medium, sandbox: workspace-write, timeout: 1800000ms (default), attempts: 1 (execution is never auto-retried), tree: live working tree)
RUN NONCE: 6ddcc1ef0bb529ee
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:\Users\maxtl\AppData\Local\Programs\OpenAI\Codex\bin\codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 5095ms

STATUS: DONE

CHANGES
- none

EXTRACTION
[
  {
    "id_or_topic": "Ruling 1a — Verifier trust model",
    "ruling": "the manifest is pinned OUTSIDE the commit under audit. `runVerification` reads it from an owner ref (`manifestRef`, default the base ref) at `.claude/orchestra.json` via `git show` against the real repo — never from the head checkout; a caller-supplied manifest records `pinned:false` provenance (the dispatcher is then the trust boundary). Proven: a head commit that breaks the code AND rewrites its own manifest to a vacuous oracle still fails. Blast-radius reductions applied regardless: `runShell` env allowlist (no inherited secrets), credential redaction over recorded output tails, leading-dash ref rejection + `--` before git revs, and `confine()` is now real-path-based (a symlink/junction committed inside the checkout can no longer smuggle a read/write outside — the WO-14 re-review corollary). Documented residual under (a): artifact-sourced citation/invariant commands remain free-form shell strings behind the minimal env — the (c) argv-allowlist extension was considered and not taken.",
    "residual_accepted": true
  },
  {
    "id_or_topic": "Ruling 2a — AU-fable reserve",
    "ruling": "implemented as planned. The Conductor's turns re-cast to the Sol mirror at matched effort when the AU-F reserve gate fires — disclosed (`recastFrom`/`recastReason`), the mirror rung's restrictions carried on the casting; any other Fable seat stays GATED.",
    "residual_accepted": "na"
  },
  {
    "id_or_topic": "Ruling 3a — `touches` declared, not derived",
    "ruling": "pure derivation is temporally incoherent with the plan — Q0 fires at order creation, before a diff exists — and a diff-derived sole source would trust the artifact under audit (the 1a precedent). `touches` is now a typed enum on `order.schema.json` (union of `q0Triggers.touchAreas` ∪ `securityTriggerList`, linted at router load — drift refuses to construct); the order is the canonical carrier and caller flags may only ADD areas (union). Registered follow-on, not built: a verification-time diff-derived cross-check (union semantics, escalate on disagreement) in the Verifier/E7 lane.",
    "residual_accepted": true
  },
  {
    "id_or_topic": "Ruling 4 — schema semantic gates",
    "ruling": "verdict-audit gates are in-schema (a PASS with `refutation_duty_present:false` cannot exist; a gate-class PASS requires `cross_family:true` and falsification SURVIVED — the same facts stay expressible on a FAIL). `served_model_mismatch` is a COMPUTED detector: the Verifier's artifact validation recomputes it and refuses a record that contradicts or omits a computable mismatch; the schema documents this.",
    "residual_accepted": "na"
  },
  {
    "id_or_topic": "Ruling A",
    "ruling": "dispatch normalizes sloppy risk tiers onto the order (whitespace/case only) and refuses unrecognizable tiers at the door; the Q0 companion can no longer carry a schema-invalid risk.",
    "residual_accepted": "na"
  },
  {
    "id_or_topic": "Ruling B",
    "ruling": "dispatch MINTS `integrity_nonce` (caller value never keys the calibration draw); the minted order rides the result for the ledger. Direct `q0Required()` calls without a nonce stay sampled-closed.",
    "residual_accepted": "na"
  },
  {
    "id_or_topic": "Ruling C",
    "ruling": "`reviewer()` requires bucket_state on the exported API (the `|| allGreen()` fabricated-Green default is gone); resolveSeat's buried-gate shape got its README line.",
    "residual_accepted": "na"
  }
]

VERIFICATION
- `Get-Content -Raw -Encoding utf8 roster\wo8-review-dispositions.md | Select-String -Pattern '## Owner rulings' -Context 0,58` → completed successfully; read-only extraction of the specified section.

DEVIATIONS
- none

CONCERNS
- none

REPORT INTEGRITY: 6ddcc1ef0bb529ee

TREE AUDIT: no source paths changed while the engine ran.
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token 6ddcc1ef0bb529ee) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token 6ddcc1ef0bb529ee, and the report does not contradict the tree audit.
