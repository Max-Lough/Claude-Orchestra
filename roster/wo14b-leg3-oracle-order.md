# Scope oracle — leg 3 of the activation bridge: the guard/installer after four adversarial rounds (2026-09-01)

You are the campaign's scope oracle: GPT-5.6 Sol at xhigh, **read-only**. Do not edit, create or
delete any file; do not run test suites (the runner's tree audit holds you to this). Your verdict
is the deliverable and will be committed verbatim. The Conductor's own record of this leg is in
`roster/wo14b-activation-bridge-progress.md` (read every leg-3 line) and the files below.

## The goal you audit against

Completing the harness (`roster/wo14b-oracle-verdict.md` — your third pass — ruled the seven-leg
bridge and its stopping rules). Leg 3 is the installer (`install.js`) and the Director-law guard
(`hooks/orchestra-guard.js`): `--roster new` installs the roster and substrates; the guard is the
capability layer that keeps the main session inside Director law and, under `roster:new`, refuses
an undetermined session model and delegates `Agent` spawns to the ticket gate.

## What happened on leg 3 — read these in order

- Cross-vendor reviews (Sol · high): `roster/wo14b-leg3-review-1.md` (8 MAJOR/3 MINOR) →
  `-2-unavailable.md` (classifier refusal) → `-2.md` (6/3) → `-3.md` (5) → `-4.md` (3/1).
- Red Team passes (Sol primary refused by the OpenAI cyber classifier twice; Anthropic Opus mirror
  ran): `roster/wo14b-leg3-redteam-1.md` (3 CRITICAL) → `-2.md` (2 new CRITICAL) → `-3.md` (2 new
  CRITICAL) → the fourth pass, delivered 2026-09-01 ~12:40Z and quoted in full in
  `roster/wo14b-leg3-redteam-4.md`: one NEW CRITICAL introduced by the leg-4c Agent seam
  (the guard `require()`s a runtime file inside the project in exactly the untrusted states —
  hostile-clone code execution), the pin-deletion CRITICAL STILL OPEN (every fingerprint the guard
  checks is a removable in-project artifact while the unremovable ones — the guard's own path, the
  settings hook entry — are not consulted), and the reviewer's diagnosis, repeated for the fourth
  time: *the fix is correct for the instance and open for the class; the suite certifies the shape
  of the fix*.
- Fix rounds (Conductor-specified designs, Sonnet builders): 1 → 2A/2B → 3A/3B → 4 (in flight now:
  the R0 #4 items plus the mechanical Red Team #3 items — seam fail-closed unless trusted with the
  runtime hash in the pin; `isSidechain === true` only; pause-name normalisation; ordering;
  underflow). The Conductor has NOT dispatched a round for the architectural items and is asking
  you instead.
- The pin design as it stands: `roster/wo14b-leg3-redteam-3.md` and `-4.md` describe it and its
  standing ("a same-user file is not a trust boundary against same-user code"; "roster:new is a
  default-on-request, not an enforcement boundary, while four in-project files decide whether the
  guard notices"). README.md's "Owner pin" and "What these grants reach" sections are the shipped
  description.

## What is asked of you

The worker has been patching for four rounds and each round's Red Team found the neighbourhood.
Treat the worker's framing as suspect, including this order's.

- What are the **properties** the guard and installer must satisfy for the bridge's purpose —
  stated as invariants a test corpus can pin, not as fixes? The Red Team offered candidates in
  `-3.md` and `-4.md`; adopt, reject or replace them.
- Is the guard's trust model — an in-project manifest, a same-user pin file outside the project,
  fingerprints, loosening keys under a trusted manifest, an `Agent` seam that loads project code —
  the right architecture for what the bridge needs, or should `roster:new` be a simpler regime
  (for example: no loosening keys at all; no project-supplied code executed by the guard; trust
  bound to something the host supplies rather than to files)? Say what the harness actually
  needs here and what it does not.
- Which of the open findings must be closed **before** the bridge's live canary (leg 7), which
  are shadow-period canaries, and which are accepted limits to be written down (the same three
  bins your third pass used)? Be specific per finding.
- Should leg 3 continue as fix rounds at all, or should it be re-cut as one bounded rewrite of
  the guard's `roster:new` path against the properties above? If the latter, size it and say who
  reviews it.
- Author the **stopping rule for leg 3** within the bridge — the condition under which the
  Conductor stops working on the guard and either proceeds or stops to the owner — and the gate
  for calling leg 3 done. Also rule on the 80-tool-call ceiling: seven of nine builders exceeded it
  (90–145 calls) and two checkpointed; say whether the ceiling, the leg sizing, or the discipline
  is wrong.
- Say what must not happen next, and where the worker will be tempted to drift.

Do not enumerate options for the owner to pick from; rule. Cite files and lines for every factual
claim. Where you refute a fact in a record, say what the current HEAD shows.

## Report format

    STATUS: DONE | PARTIAL | BLOCKED

    VERDICT (on leg 3 as it stands)
    <one paragraph>

    PROPERTIES THE GUARD AND INSTALLER MUST SATISFY
    - ...

    ARCHITECTURE RULING
    <what changes, what stays, why>

    DISPOSITION OF THE OPEN FINDINGS (per finding: fix-before-canary / shadow canary / accepted limit)
    - ...

    HOW LEG 3 PROCEEDS
    <fix rounds vs bounded rewrite; sizing; reviewer>

    BRIGHT-LINE STOPPING RULE FOR LEG 3 AND THE GATE THAT ENDS IT
    - ...

    RULING ON THE TOOL-CALL CEILING
    - ...

    VERIFICATION / DEVIATIONS / CONCERNS
