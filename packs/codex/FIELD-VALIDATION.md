# Field-validation checklist — cross-vendor review lane, v1.4.0

For the next **gate-class review** run by a project that installed this pack
(`node install.js <project> --packs codex`). The master's own suite
(`node tests/review-lane.test.js`, 92 checks) proves the mechanics against a
stub engine; this checklist proves the round-2 fixes against the real Codex CLI,
on Windows, where every field failure happened.

Run it as part of a real gate — do not stage a synthetic review. The failures
this round addresses only appear on real work.

## Before the gate

- [ ] Confirm the installed runner is v1.4.0, not a stale copy:
      `.claude/hooks/orchestra-review.js` contains `ATTEMPT CHAIN` and
      `attempts: up to`.
      (`node install.js <project> --packs codex` re-stamps it.)
- [ ] Optional but recommended for engine projects (Godot, Unity, Unreal): set
      `"codex": { "worktreeWarmupCmd": "<engine headless import command>" }` in
      `.claude/orchestra.json`.

## During the gate — read the header

The first lines of the relayed report are the evidence. Record them.

- [ ] **Preflight names the install layout.**
      `PREFLIGHT: codex install layout: appdata-versioned (C:\Users\…\OpenAI\Codex\bin\<hash>)`
      — if it says `unknown`, note the actual path: Codex has moved again and
      the master needs the new pattern.
- [ ] **Helper siblings are reported one way or the other.** Either
      `helper siblings present: codex-command-runner.exe, codex-resources`, or a
      `MISSING FROM THE CODEX INSTALL:` line naming exactly what is absent and
      where the runner looked. **This is the open question of the round:** if
      the review then *succeeds* with those files missing, the new layout does
      not need them, and the repair recipe inherited from the old layout should
      be retired from the project's memory checklist. Report which.
- [ ] **The stage-a probe ran.** `PREFLIGHT: auth/exec probe: ok in <n>s`.
      Confirm it costs seconds, not minutes. (If it is routinely slow here,
      raise `codex.probeTimeoutMs` rather than disabling it.)
- [ ] **The cap and the checkout are what the order asked for.**
      `timeout: <ms> (<source>)` and `checkout: pinned worktree @ <sha>`. A
      `(default)` where the order named a cap means the setting did not land.

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
