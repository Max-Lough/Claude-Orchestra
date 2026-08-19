# Field-validation checklist — cross-vendor review lane, v1.5.0

For the next **gate-class review** run by a project that installed this pack
(`node install.js <project> --packs codex`). The master's own suite
(`node tests/review-lane.test.js`, 108 checks) proves the mechanics against a
stub engine; this checklist proves the fixes against the real Codex CLI, on
Windows, where every field failure happened.

Run it as part of a real gate — do not stage a synthetic review. The failures
this round addresses only appear on real work.

## Before the gate

- [ ] Confirm the installed runner is v1.5.0, not a stale copy:
      `.claude/hooks/orchestra-review.js` contains `ATTEMPT CHAIN`,
      `attempts: up to`, and `--doctor`.
      (`node install.js <project> --packs codex` re-stamps it.)
- [ ] **`node .claude/hooks/orchestra-review.js --doctor` exits 0.** The
      installer runs it when the pack is selected; run it again here, and after
      any Codex update. A non-zero exit names exactly what to copy where — fix
      that before spending a review budget discovering it. On Windows this is
      the check that catches `codex-windows-sandbox-setup.exe` sitting anywhere
      other than directly beside `codex.exe`.
- [ ] Optional but recommended for engine projects (Godot, Unity, Unreal): set
      `"codex": { "worktreeWarmupCmd": "<engine headless import command>" }` in
      `.claude/orchestra.json`. It runs only in a **pinned** review (a warmup
      writes, and a live-tree review must not write into the tree it is
      reviewing), so this pairs with passing `--head-ref` — which a gate-class
      review of a committed change should be doing anyway.

## During the gate — read the header

The first lines of the relayed report are the evidence. Record them.

- [ ] **Preflight names the install layout.**
      `PREFLIGHT: codex install layout: appdata-versioned (C:\Users\…\OpenAI\Codex\bin\<hash>)`
      — if it says `unknown`, note the actual path: Codex has moved again and
      the master needs the new pattern.
- [ ] **Helper siblings are reported one way or the other.** Either
      `helper siblings present: codex-command-runner.exe, codex-resources,
      codex-windows-sandbox-setup.exe`, or a `MISSING FROM THE CODEX INSTALL:`
      line naming exactly what is absent and where the runner looked. **This is
      the open question of the round:** if the review then *succeeds* with those
      files missing, the new layout does not need them, and the repair recipe
      inherited from the old layout should be retired from the project's memory
      checklist. Report which.
- [ ] **A `was MISPLACED inside the install at <dir>` line, if it appears, is
      the 2026-08-18 failure being repaired in flight** — record the directory
      it names. That state (a helper present, but one level below where Codex
      resolves it) previously produced reviews that returned nothing for six
      days with no line anywhere saying the install was wrong.
- [ ] **The stage-a probe ran.** `PREFLIGHT: auth/exec probe: ok in <n>s`.
      Confirm it costs seconds, not minutes. (If it is routinely slow here,
      raise `codex.probeTimeoutMs` rather than disabling it.)
- [ ] **The cap and the checkout are what the order asked for.**
      `timeout: <ms> (<source>)` and `checkout: pinned worktree @ <sha>`. A
      `(default)` where the order named a cap means the setting did not land.
- [ ] **If `CODEX_BIN` points at a `.cmd`/`.bat` shim** (the usual shape of an
      npm-installed `codex` on Windows), confirm the engine actually launches.
      CI proved this path works; a real npm shim in a real user's `PATH` is the
      case CI cannot stage. A launch failure here reports as
      `the Codex CLI could not be launched (<code>)` — distinct from an auth
      failure, on purpose.

## During the gate — what happens on failure

- [ ] If any attempt produced no verdict, the report contains an `ATTEMPT LOG`
      with `killed by:` and `elapsed:` lines. Confirm the `killed by:` line is
      *specific* — `THIS RUNNER — its own <n>ms timer fired`, or
      `NOT this runner`. A generic cause list under a signal-class exit is a
      regression; report it.
- [ ] If a retry happened, the header carries
      `ATTEMPT CHAIN: 2 attempts, ONE outcome`, and the Director received
      **exactly one** report for the review. Two reports for one review is the
      exact defect this round closes.
- [ ] If the chain was exhausted, the block carries
      `FINALITY: this runner made N engine attempts and will make no more`.
- [ ] The launcher's own message states the attempt count and finality **and
      offers no theory of the cause.** A launcher sentence that diagnoses
      anything ("a known FUSE issue", "the API was down") is a profile
      regression — capture it verbatim and report it.

## During the gate — integrity

- [ ] On an engine project's first review in a fresh worktree, confirm the
      verdict carries an `INTEGRITY NOTE` with a count (or nothing at all, if a
      warmup command is configured) — **not** an `⚠ INTEGRITY WARNING`.
- [ ] If an `⚠ INTEGRITY WARNING` does appear, it must list specific paths and
      those paths must not be generated artifacts. That is a real finding: the
      reviewer wrote something it should not have.

## After the gate

- [ ] Note total wall-clock and whether the verdict landed on attempt 1 or 2.
- [ ] Note any preflight line that was wrong, missing, or unreadable.
- [ ] File anything upstream-caused (see "What this harness cannot fix" in
      `packs/codex/README.md`) as a Codex CLI issue, with the report attached.

A round is validated when: the header answered every question above without a
human inferring anything, exactly one report reached the Director, and any
failure named its own cause.
