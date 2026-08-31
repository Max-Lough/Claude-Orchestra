# Codex sandbox fault investigation — `unsupported protocol version 6`

- **Seat:** Investigator (I0)
- **Casting:** Claude Opus 5 · in-harness, read-only on the repo, dispatched
  with fresh context (no prior WO-9/10/11 session state)
- **Date:** 2026-08-31 (probe wall-clock times below are the local system
  clock, which reads `2026-08-30 21:5x–22:0x` for the same window)
- **Scope:** read-only investigation plus 6 authorized controlled engine
  probes. No tracked repo file was modified. Nothing under `C:\Users\maxtl\.codex`
  was written.

## Dispatching question

**Hypothesis H1, as posed by the coordinator:** the standing
`unsupported protocol version 6` codex sandbox fault correlates with the
engine's working directory being outside the repo / under `%TEMP%` — the
Windows sandbox setup may fail to map or trust such a path — rather than
with model, effort, or time.

**Verdict: H1 is REFUTED.** Not weakened — refuted, on two independent
lines of evidence (historical record and live controlled probe). The fault
is a **version-skewed `codex-command-runner.exe` inside the 0.151.0
install**, and it gates the *unified exec* tool path only.

---

## 0. Correction — `roster/wo11-a0-exercise-ex3.md` attempts 4 and 5

When I first read `roster/wo11-a0-exercise-ex3.md` it was 139 lines and
ended at attempt 3, stating explicitly that no retry was made because the
fault string did not appear. I reported at that time that the record
contained no attempt 4. **That is now superseded**: the file has since been
appended to 348 lines and carries two further attempts, both of which I have
now read in full and folded into the attempt table below as rows 22–23.

- **Attempt 4** — `--cd <scratchpad>\a0-ex3\fixture` (a freshly staged,
  git-committed fixture at commit `4c7bb55`), gpt-5.6-sol · xhigh, start
  21:54:16 → end 21:55:30. `STATUS: BLOCKED`; `unsupported protocol version 6`
  present twice in VERIFICATION.
- **Attempt 5** — bounded retry, identical command and fixture, start
  21:56:32 → end 21:57:26. `STATUS: BLOCKED`; fault present twice, on both
  the `Get-Content` path and the engine's own `cmd.exe /c type` fallback.

The record also documents that attempt 3's clean-but-BLOCKED result was a
**dispatcher staging error**, not a seat signal: no `reference/` fixture
existed at the repo root when it ran, so the engine's failure there was a
genuine `ItemNotFoundException` from PowerShell rather than a sandbox fault.

**These two rows do not change the verdict, and are consistent with the
refutation either way.** Read on their own they look mildly *pro*-H1 —
within `a0-ex3` alone, the no-`--cd` attempt 3 was clean and the two
`--cd`-to-scratchpad attempts faulted. But that reading is closed off by the
decisive control: my probe **A2** ran with **no `--cd`, from the repo root**,
at 21:59:40 — roughly two minutes after attempt 5 ended — and **faulted**.
Same window, same binaries, repo-root cwd, fault. Attempts 4 and 5 also
usefully tighten the timeline: they place the fault as continuously
reproducible from 21:54 through 22:01, spanning both cwd conditions.

One further point of note from attempt 3's record, which I rely on below:
its engine reached a genuine PowerShell `ItemNotFoundException`. That means
**PowerShell actually executed** on that run. It is direct evidence that a
working shell path exists on this install even while the fault is active.

---

## 1. Attempt table — every engine-reaching `orchestra-exec` attempt

The `tree:` field in each transcript's own `EXEC ENGINE` header settles cwd
unambiguously, without needing the dispatcher's prose:
`tree: live working tree` = no `--cd` (repo root); `tree: directed worktree`
= `--cd` used. **No entry has unknown cwd.** The only gap is that WO-11
Architect attempts 1–2 print `directed worktree` without quoting the path.

| # | Attempt | Model | Effort | cwd / `--cd` | Fault? |
|---|---|---|---|---|---|
| 1 | wo9 `m0-ex1` | terra | med | **repo root (no `--cd`)** | **Y** |
| 2 | wo9 `m0-ex2` | terra | med | **repo root (no `--cd`)** | N |
| 3 | wo9 `n1-ex1` | sol | med | **repo root (no `--cd`)** | **Y** (local shell channel) |
| 4 | wo9 `n1-ex2` | sol | med | **repo root (no `--cd`)** | **Y** (local shell channel) |
| 5 | wo9 `n2-ex1` | terra | med | **repo root (no `--cd`)** | N |
| 6 | wo10 Operator ex1 att2 | sol | high | `--cd <scratchpad>\wo10-fixtures\operator` | N |
| 7–9 | wo10 Refactorer att1–3 | terra | med | `--cd <scratchpad>\wo10-fixtures\refactorer` | **Y ×3** |
| 10–12 | wo10 Runner att1–3 | luna | low | `--cd <scratchpad>\wo10-fixtures\runner` | **Y ×3** |
| 13 | wo10 Interface Artisan ex1 | sol | med | `--cd <scratchpad>\wo10-fixtures\interface-artisan` | **Y** (mid-run, after writes landed) |
| 14 | wo10 Test Designer (terra) ex1 | terra | med | `--cd <scratchpad>\wo10-fixtures\test-designer-terra` | N |
| 15–16 | wo11 Architect att1, att2 | sol | xhigh | `--cd` (directed worktree; path not quoted — `config.toml` records `…\claude-orchestra\wo11-fixtures\architect` as trusted) | **Y ×2** |
| 17 | wo11 `a0-ex3` att3 (2026-08-31) | sol | xhigh | **repo root (no `--cd`)** | N — *dispatcher staging error; PowerShell ran and returned `ItemNotFoundException`* |
| 18–19 | wo10 `e8-ex3` att4, att5 (2026-08-31) | terra | med | `--cd <scratchpad>\e8-ex3\fixture` | **Y ×2** |
| 20–21 | wo10 `e1-ex3` att4, att5 (2026-08-31) | luna | low | `--cd <scratchpad>\e1-ex3\fixture` | **Y ×2** |
| **22** | **wo11 `a0-ex3` att4 (2026-08-31, 21:54:16→21:55:30)** | **sol** | **xhigh** | **`--cd <scratchpad>\a0-ex3\fixture`** | **Y** |
| **23** | **wo11 `a0-ex3` att5 (2026-08-31, 21:56:32→21:57:26)** | **sol** | **xhigh** | **`--cd <scratchpad>\a0-ex3\fixture`** | **Y** |

Rows 1–16 constitute the standing **12 of 16** tally. WO-10 Operator's
*first* attempt is excluded from the denominator: it was a codex
directory-trust refusal that never reached the engine, per the counting rule
in `roster/wo10-band-record.md` Incidents §1.

With rows 17–23 the running total is **23 engine-reaching attempts, 18
faults**.

**Rows 1, 3, and 4 refute H1 on the historical record alone** — three faults
with cwd = repo root and no `--cd` at all.

---

## 2. How `--cd` is used — and why it was never a plausible discriminator

From `packs/codex/hooks/orchestra-exec.js`, quoted verbatim with line
numbers:

```js
200:  sandbox: (process.env.ORCHESTRA_EXEC_SANDBOX || 'workspace-write').trim(),
240:    else if (a === '--cd') out.cd = argv[++i];
1221:  CONFIG.execDir = (args.cd && args.cd.trim()) || CONFIG.projectDir;
1340:  const codexArgs = ['exec', '--sandbox', CONFIG.sandbox, '--cd', CONFIG.execDir];
1349:    cwd: CONFIG.execDir,
```

The load-bearing observation is line 1340 read together with line 1221: the
runner **always** passes codex's own `--cd` flag, whether or not the
operator supplied one, because line 1221 falls back to `CONFIG.projectDir`.
The codex command line is therefore *structurally identical* in both
conditions — same flag, same position — and only the path value differs.
There is no "no-`--cd`" code path for the sandbox to behave differently on.
That alone made H1 a priori weak before any probe was run.

The sandbox is `workspace-write` in every recorded run (line 200 default;
no transcript shows an override).

`codex exec --help` for this install (`codex-cli 0.151.0`), verbatim
excerpt:

```
  -s, --sandbox <SANDBOX_MODE>
          Select the sandbox policy to use when executing model-generated shell commands
          [possible values: read-only, workspace-write, danger-full-access]

  -C, --cd <DIR>
          Tell the agent to use the specified directory as its working root

      --add-dir <DIR>
          Additional directories that should be writable alongside the primary workspace

      --skip-git-repo-check
          Allow running Codex outside a Git repository
```

`C:\Users\maxtl\.codex\config.toml` sets `[windows] sandbox = "elevated"`,
and every fixture path used across WO-10/11 and my own probes — including
`…\scratchpad\probe-b` and `c:\users\maxtl\projects\_wo12-fault-probe-c` —
is already registered with `trust_level = "trusted"`. Directory trust is
therefore not in play for any row in the table above except WO-10 Operator's
excluded first attempt.

---

## 3. Log evidence — which component emits the error

There is **no `~/.codex/log/` directory** on this install. The sandbox log
is `C:\Users\maxtl\.codex\.sandbox\sandbox.2026-08-31.log`. It records
helper resolution and command starts but **not** the failure itself — which
is why the fault has been opaque until now.

A useful discriminator in that log: `codex.EXE` (capital) is the
orchestra-exec-launched process, because the runner resolves the binary
through a link whose path ends `.EXE`; lowercase `codex.exe` is a concurrent
unrelated session (running against `F:\Projects\FantasyFootball2026-Sleeper`
during my probe window). Excerpt from my own probe window:

```
[2026-08-30 22:00:37.562 codex.EXE] helper copy: validating command-runner source=C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex-command-runner.exe destination=C:\Users\maxtl\.codex\.sandbox-bin\codex-command-runner-0.151.0.exe
[2026-08-30 22:00:37.563 codex.EXE] helper copy: reused command-runner source=…\0.151.0-…\bin\codex-command-runner.exe destination=…\.sandbox-bin\codex-command-runner-0.151.0.exe
[2026-08-30 22:00:37.563 codex.EXE] helper launch resolution: using copied command-runner path C:\Users\maxtl\.codex\.sandbox-bin\codex-command-runner-0.151.0.exe
```

The full error text, captured verbatim by probe **B2** — the most complete
rendering any run in this investigation has produced, and more complete than
any prior transcript:

```
- `Get-ChildItem` → `exec_command failed ... CreateProcess { message: "Rejected(\"Failed to create unified exec process: runner failed during ReadSpawnRequest: runner: unsupported protocol version 6\")" }`
```

**Emitter located by searching the binaries directly.** The literal string
`runner: unsupported protocol version ` lives in the *command-runner*
binary, not in the CLI:

```
$ grep -ao ".\{60\}unsupported protocol version.\{60\}" .sandbox-bin/codex-command-runner-0.151.0.exe
 process job$runner: expected spawn_request, got � %runner: unsupported protocol version � runner: pipe closed before spawn_request
```

So the sequence is: parent `codex.exe` writes a spawn_request at protocol
**v6**; the command-runner it launches reads that request and rejects the
version as unsupported. **The runner is older than the parent.**

---

## 4. The skew, proven by hash

```
3a70491d8d588afa459a42816f05b8c2fdd6bddb0ef318f3dfccc963a30b420a *packages/standalone/releases/0.147.0-.../bin/codex-command-runner.exe
3a70491d8d588afa459a42816f05b8c2fdd6bddb0ef318f3dfccc963a30b420a *packages/standalone/releases/0.151.0-.../bin/codex-command-runner.exe
3a70491d8d588afa459a42816f05b8c2fdd6bddb0ef318f3dfccc963a30b420a *.sandbox-bin/codex-command-runner-0.151.0.exe
8e47f597e8c0aeb7ceddf2d0082de55e602eb8b6e4bdab8e67357b7b02c2b9ea *.sandbox-bin/codex-command-runner-0.150.0-alpha.8.exe
8e47f597e8c0aeb7ceddf2d0082de55e602eb8b6e4bdab8e67357b7b02c2b9ea *plugins/.plugin-appserver/codex-command-runner.exe
```

The `codex-command-runner.exe` shipped **inside the 0.151.0 install
directory** is **byte-identical to the 0.147.0 one** — same sha256,
1,300,272 bytes, mtime Aug 6 — while its sibling `codex.exe` in the same
directory is genuinely `codex-cli 0.151.0` (313,958,192 bytes, mtime Aug 29;
confirmed by `codex.exe --version` → `codex-cli 0.151.0`).

Codex then copies that stale binary to
`.codex\.sandbox-bin\codex-command-runner-0.151.0.exe` — a 0.147-era binary
wearing a 0.151.0 filename — and launches it, exactly as the log excerpt
above shows. A genuinely newer 8.1 MB runner (`8e47f597…`) is present on
disk in two places but is never selected.

The install is internally inconsistent: a 0.151.0 CLI paired with a
0.147-era helper.

---

## 5. Controlled probes

Six engine attempts, `gpt-5.6-luna · low`, `--timeout-ms 240000` each.
Outputs saved to
`…\scratchpad\fault-probe\{A1,A2,B1,B2,C1,C2}.txt`.

**Protocol deviation, disclosed up front.** The prescribed order text
("Print the single word PONG in your CHANGES section. Make no changes.") is
a **null probe**, and probe A1 proved it: the engine answered in 6.5 s
**without ever spawning a shell**, so the fault — which occurs at
shell-spawn — could not surface, and its absence carried no information. I
amended the order for attempts 2–6 to force exactly one read-only shell
command (`Get-ChildItem`), which is the mechanism actually under test. A1 is
reported below as spent-but-uninformative. The resulting design is therefore
A×1 informative, B×2, C×2 rather than a clean 2/2/2. No 7th or 8th attempt
was taken: its authorizing condition — B faults while A and C do not — never
arose.

Conditions: **A** = no `--cd`, run from the repo root. **B** = `--cd` to a
fresh git-initialized dir with one commit under the session scratchpad
(`…\8a1084ac-…\scratchpad\probe-B`). **C** = `--cd` to a fresh
git-initialized dir with one commit outside `%TEMP%` and outside this repo
(`C:\Users\maxtl\Projects\_wo12-fault-probe-C`).

| Probe | Wall clock | Condition | `tree:` | STATUS | `unsupported protocol version`? |
|---|---|---|---|---|---|
| A1 | 21:57:50→21:58:03 (13 s) | no `--cd`, repo root, **original order** | live working tree | EXEC_UNAVAILABLE (integrity: report claimed "PONG" as an edit) | **No — no shell ever spawned; null result** |
| B1 | 21:58:39→21:59:05 (26 s) | `--cd …\scratchpad\probe-B` | directed worktree | BLOCKED | **YES** |
| C1 | 21:59:12→21:59:31 (19 s) | `--cd C:\Users\maxtl\Projects\_wo12-fault-probe-C` | directed worktree | BLOCKED | **YES** |
| A2 | 21:59:40→22:00:00 (20 s) | **no `--cd`, repo root** | live working tree | BLOCKED | **YES** |
| B2 | 22:00:21→22:00:43 (22 s) | `--cd …\scratchpad\probe-B` | directed worktree | BLOCKED | **YES** |
| C2 | 22:00:43→22:01:11 (28 s) | `--cd C:\Users\maxtl\Projects\_wo12-fault-probe-C` | directed worktree | PARTIAL | **YES** |

Every probe that actually spawned a shell faulted — **5 for 5, across all
three cwd conditions, inside a four-minute window**. `PREFLIGHT: auth/exec
probe: ok` on all six, so all six reached the engine.

---

## 6. Conclusions, bounded by the evidence

**H1: REFUTED**, on two independent lines:

1. **Historical.** WO-9 `m0-ex1`, `n1-ex1`, and `n1-ex2` (rows 1, 3, 4) all
   faulted with cwd = repo root and no `--cd`. H1 predicts these should be
   clean.
2. **Live.** Probe A2 faulted at the repo root with no `--cd`. Probe C
   faulted twice in a git-initialized directory under
   `C:\Users\maxtl\Projects\` — outside `%TEMP%` and outside this repo,
   which is precisely the condition H1 predicts should be clean. Neither
   "outside the repo" nor "under `%TEMP%`" is the discriminator.

**Why H1 looked plausible.** The apparent correlation is a **sampling
artifact**. WO-10's entire wave used `--cd`, so all seven of its faults
carry a `--cd` label by construction; and today's one genuinely clean run
(`a0-ex3` attempt 3) happened to be the single dispatch made without one —
and even that one is now known to have been a fixture-staging error rather
than a clean sandbox signal. Nothing in the design of those waves ever
varied cwd against a fixed everything-else, which is what my probes did.

**What the evidence does point to: a stale helper gating one tool path.**
The 0.151.0 install ships a hash-identical 0.147-era `codex-command-runner.exe`
(§4), and the 0.151.0 CLI speaks a spawn protocol at v6 that this runner
does not understand (§3). The error text scopes the damage precisely:
*"Failed to create **unified exec** process."* Only the **unified_exec**
tool path traverses this runner — `codex.exe` carries a `unified_exec_tool`
feature-flag string. The legacy shell path is unaffected, and the record
shows it working: `a0-ex3` attempt 3 got a genuine PowerShell
`ItemNotFoundException` (PowerShell *ran*), and WO-10 Operator's clean run
executed `cmd.exe /c type package.json`.

**This also explains the intermittency the band records call unexplained.**
The discriminator is **which exec tool the model happens to select on a
given turn**, not model, not effort, not time, not cwd. The decisive
observation is a pair of runs 30 seconds apart on 2026-08-31 — `e8-ex3`
(21:48:06, faulted) and `a0-ex3` attempt 3 (21:48:35, shell ran) — which
resolved the *same* helper path from the *same* log. No cwd-based or
time-based hypothesis accommodates that pair; a per-turn tool-selection
hypothesis does.

I state this as the explanation the evidence *points to*, not as a proven
mechanism: I have not instrumented codex to observe which tool each turn
selected, and that step would settle it.

---

## 7. Workarounds, with their support levels stated

- **Placing fixtures under `Projects\` instead of `%TEMP%` — NOT
  SUPPORTED. Do not adopt.** Probes C1 and C2 both faulted there. This is
  the workaround H1 would have implied, and the evidence is directly
  against it.
- **Repairing the version skew — SUPPORTED by the hash table (§4) and the
  log excerpt (§3), but UNTESTED end-to-end.** Replace
  `…\0.151.0-…\bin\codex-command-runner.exe` and
  `.codex\.sandbox-bin\codex-command-runner-0.151.0.exe` with the newer
  8.1 MB runner (`8e47f597…`), or reinstall codex 0.151.0 so its helper
  matches its CLI. I did not do this: `.codex` is outside my write scope
  and it is the owner's install. Supporting rows: the three
  `3a70491d…` hashes.
- **Disabling the unified-exec tool** (`--disable unified_exec_tool`, or
  `-c features.unified_exec_tool=false` passed via `ORCHESTRA_EXEC_ARGS`)
  to force the working legacy shell path — **PLAUSIBLE but UNTESTED.**
  Support: the `unified_exec_tool` feature-flag string in `codex.exe`, plus
  the working-legacy-path evidence in §6. The 6-attempt budget was
  exhausted and its extension condition did not trigger. **This is the
  cheapest next probe and I recommend it as the first follow-up** — one
  engine attempt settles it.

Both untested workarounds are cheap to falsify and should be tried before
any further seat exercises are dispatched through the codex lane, since
every such exercise currently risks burning a retry allowance on an
environment fault rather than a competency signal.

---

## 8. Housekeeping

- `C:\Users\maxtl\Projects\_wo12-fault-probe-C` was created for probe C and
  **deleted at the end of the investigation** (verified absent).
- **No tracked repo file was modified.** `git status --short` after the
  probes shows only pre-existing untracked paths (the `wo12/` tooling and
  the three `ex3` records), none of them mine. Every probe's own `TREE
  AUDIT` independently read `no source paths changed while the engine ran`.
- **Nothing under `C:\Users\maxtl\.codex` was written**, including the
  stale helper binaries, which are left in place as evidence.
- Probe artifacts retained at
  `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\8a1084ac-23e5-4029-97e1-455d7a8970ee\scratchpad\fault-probe\`
  (`order.md`, `order2.md`, and the six probe outputs).
- This file is the only file I created.
