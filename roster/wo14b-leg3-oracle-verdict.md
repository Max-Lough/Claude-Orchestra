# WO-14b leg 3 — scope-oracle verdict (GPT-5.6 Sol · xhigh, read-only) — 2026-09-01

Order: `roster/wo14b-leg3-oracle-order.md` (open-ended: properties, trust-model architecture, disposition bins, rounds-vs-rewrite, stopping rule, the tool-call ceiling). Launched 12:55Z; `CODEX_BIN` pinned (sha256 `cf68265…`), codex-cli 0.151.0. Tree audit clean. Verdict verbatim below.

---

EXEC ENGINE: OpenAI via Codex CLI (model: gpt-5.6-sol (flag), tier: standard, effort: xhigh, sandbox: workspace-write, timeout: 2400000ms (flag), attempts: 1 (execution is never auto-retried), prohibited commands: 3, tree: directed worktree)
RUN NONCE: e8404417cf97efc5
CODEX BINARY: C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: resolved through a link: C:/Users/maxtl/.codex/packages/standalone/releases/0.151.0-x86_64-pc-windows-msvc/bin/codex.EXE -> C:\Users\maxtl\.codex\packages\standalone\releases\0.151.0-x86_64-pc-windows-msvc\bin\codex.EXE
PREFLIGHT: auth/exec probe: ok in 6299ms

STATUS: DONE

## VERDICT (on leg 3 as it stands)

Leg 3 is not ready for the live canary and must not continue as another sequence of local patch rounds. Current HEAD still dynamically loads project-controlled runtime code from the guard, including for untrusted-new states; the pin measures only the manifest, and roster detection depends on removable project artifacts (`hooks/orchestra-guard.js:458-488`; `install.js:784-795`; `hooks/orchestra-guard.js:804-859`). Four Red Team rounds repeatedly closed the supplied reproduction while exposing the adjacent class (`roster/wo14b-leg3-redteam-4.md:263-269`). Re-cut the `roster:new` path as the bounded rewrite below; preserve legacy behavior except where shared safety primitives require a correction.

## PROPERTIES THE GUARD AND INSTALLER MUST SATISFY

- **Explicit activation, monotonic enforcement.** Legacy remains the installer default. Only an explicit owner installation activates `roster:new`; once the host invokes that mode, missing, malformed, contradictory, or tampered project data cannot downgrade it to legacy or enable a loosening (`roster/wo14b-leg3-order.md:27-50`).

- **No project-controlled loosening under `roster:new`.** `directorAllowedTools`, `directorPlanPatterns`, and `directorMemoryPatterns` must not reduce the fixed new-roster denial set or add carve-outs. Keep only immutable built-in plan/memory exceptions and bounded tightening-only policy. Current HEAD still constructs trusted new-roster policy from those manifest fields (`hooks/orchestra-guard.js:1074-1090,1148-1178`).

- **No dynamic project-code execution by the guard.** Apart from the already-running guard itself, the new-roster decision path must not `require`, import, evaluate, or execute a project-tree file. Missing gate wiring, non-object/thenable results, exceptions, and timeouts deny within a fixed bound. Current HEAD violates this by requiring `.claude/orchestra/bridge/runtime.js` and serializing any returned value (`hooks/orchestra-guard.js:469-489`; `roster/wo14b-leg3-redteam-4.md:11-25,217-225`).

- **Host gate is authoritative for `Agent`.** Every `Agent` PreToolUse under `roster:new`, including nested spawns, must traverse the separately registered ticket gate; unticketed, replayed, expired, wrong-role, malformed-state, or internal-error calls deny before spawn. The lifecycle proof established that host `PreToolUse` denial prevents spawning and carries the needed ticket, role, and identity fields (`roster/wo14b-leg1-lifecycle-proof.md:20-26,49-60`). The guard may verify exact gate-hook registration and deny when absent; it must not invoke that gate’s project runtime itself.

- **New-roster enforcement does not trust transcript contents.** Under `roster:new`, main-session Director law is always active unless the user explicitly pauses it; a transcript can never stand it down. This removes the oversized-middle, forged `isSidechain`, truncation, and last-entry classes from the enforcement decision. Legacy may retain model-aware dormancy as documented compatibility behavior (`hooks/orchestra-guard.js:1205-1337`; `roster/wo14b-leg3-redteam-4.md:81-107,231-231`).

- **Pause is exclusively out-of-band.** No tool call from any identity can create, edit, alias, or create a child beneath the pause path under any case, separator, traversal, or NTFS-stream spelling. The genuine pause check runs before Agent gating and all subagent exemptions, and an active pause disables both Director law and ticket gating (`roster/wo14b-leg3-redteam-4.md:70-94,147-159`).

- **Every write exception preserves containment and harness wiring.** Resolved targets remain inside the real project/config root; hardlinks and unresolved reparse points deny; the managed `CLAUDE.md` block is checked before either plan or memory allowance. Current ordering permits a plan match to bypass the marker fence (`hooks/orchestra-guard.js:1812-1818`; `roster/wo14b-leg3-redteam-4.md:124-145`).

- **Installer mutation is atomic with respect to validation.** All relevant JSON, pattern, numeric, ownership, source, and target-path checks finish before the first copy, settings rewrite, grant removal, or deletion. Unrelated values survive semantically; a value-changing reserialization refuses before mutation (`roster/wo14b-leg3-order.md:40-57`; `roster/wo14b-leg3-redteam-4.md:177-203`).

- **Uninstall proves ownership and project containment.** Grants are removed before hooks, and hooks before files. No ledger entry may unlink outside `realpath(project root)`; missing or untrusted ownership evidence must not authorize guessed deletion of user files. Current containment is instead anchored to `realish(.claude)`, permitting `.claude` itself to redirect deletion outside the project (`install.js:2708-2763,2998-3035`; `roster/wo14b-leg3-redteam-4.md:109-122`).

- **Tests pin equivalence classes, not reported examples.** The corpus must vary all artifact subsets, trust states, path spellings, identity-field types, payload/result shapes, link states, transcript sizes, and numeric spellings around each invariant. Existing tests explicitly pin the unsafe truthy-`isSidechain` rule and deliberately exercise project-runtime delegation in untrusted-new state (`tests/guard.test.js:1017-1132,1463-1481`); the fourth Red Team pass records the repeated shape-versus-property failure (`roster/wo14b-leg3-redteam-4.md:265-268`).

## ARCHITECTURE RULING

Replace the current new-roster trust stack with a closed regime:

- The installer writes an exact host hook invocation that names `roster:new`; that invocation—not `.claude/orchestra.json`, pins, fingerprints, or transcript content—selects the guard’s new path. Current hook registration has no such mode input (`install.js:1120-1156,2406-2448`).

- Once selected, new-roster policy is static: fixed Director-law denials, built-in plan/memory exceptions, optional tightening-only entries, explicit user pause, and separate host execution of the ticket gate. No manifest field loosens it.

- Remove `delegateAgentGate()`’s dynamic `require`. The host already proved that a dedicated PreToolUse ticket gate can veto an Agent spawn (`roster/wo14b-leg1-lifecycle-proof.md:20-25`). Installed acceptance must additionally prove the exact guard-plus-gate hook composition used by the installer.

- Keep the manifest for seats, generation, installed-file ownership, and runtime configuration. Keep a pin only as tamper evidence and an uninstall/runtime receipt; it is not activation authority and must not be described as protection from same-user code. README already admits the same-user limit, while still overstating that deletion always fails closed (`README.md:371-394,423-437`).

The harness needs deterministic owner opt-in, fail-closed Agent gating, generation invalidation, safe installation/removal, and a guard that prevents ordinary Director drift. It does not need—and cannot obtain from more same-user files—a security boundary against arbitrary same-user code.

## DISPOSITION OF THE OPEN FINDINGS

### Fix before the live canary

- **Review #4’s three MAJORs:** manifest-independent Git-pin discovery, the legacy `installedPermissions` false fingerprint, and value-based numeric acceptance must close. The first two disappear from activation when fingerprints stop selecting mode; installer verification still must be corrected. The exact-value numeric defect remains an installer correctness failure (`roster/wo14b-leg3-review-4.md:21-24`).

- **Agent seam RCE and async/hang fail-open:** eliminate project-runtime loading and verbatim result passthrough; do not merely add another same-user hash (`roster/wo14b-leg3-redteam-4.md:11-25,217-225`).

- **Pin deletion plus artifact scrub:** activation must no longer depend on pins or the four removable fingerprint families. Adding further fingerprints is not closure of the class (`roster/wo14b-leg3-redteam-4.md:55-68`).

- **Pause spelling and ordering:** close NTFS ADS/case aliases, run pause classification before Agent dispatch and subagent exemption, and make the genuine user pause release the gate (`roster/wo14b-leg3-redteam-4.md:70-94,147-159`).

- **`isSidechain` and oversized transcript:** use `isSidechain === true` wherever legacy parsing remains, and remove transcript-based stand-down entirely from new mode. Head-plus-tail does not close an attacker-controlled middle (`roster/wo14b-leg3-redteam-4.md:81-107`).

- **Containment:** refuse `.claude` as a reparse point, anchor uninstall beneath the real project root, and deny unresolved links rather than treating them literally (`roster/wo14b-leg3-redteam-4.md:109-133`).

- **Marker ordering:** a plan match must never bypass the managed-memory block fence (`roster/wo14b-leg3-redteam-4.md:135-145`).

- **Manifest-plus-pin deletion uninstall:** removal must still identify and safely clean an installed roster without silently stranding it, while never guessing ownership of ambiguous user files (`roster/wo14b-leg3-redteam-4.md:161-175`).

- **Numeric underflow and validator divergence:** reject nonzero literals that serialize to zero, and make installer and guard use one pattern contract if tightening patterns remain (`roster/wo14b-leg3-redteam-4.md:177-203`).

- **Corrupt-pin disagreement:** if pins remain as receipts, guard, verifier, and uninstaller must classify corrupt pin files identically (`roster/wo14b-leg3-redteam-4.md:225-227`).

### Shadow-period canaries

- **Moved-project stale path pin:** verify that move/repin/uninstall retires the original path key; this is cleanup debt once pins cease to select enforcement (`roster/wo14b-leg3-review-4.md:25`).

- **Git-root restriction transfer:** monitor worktrees, sibling directories, and clones for false new-roster restriction inheritance; it is availability/restriction transfer, not a loosening bypass under the ruled architecture (`roster/wo14b-leg3-redteam-4.md:205-213`).

- **Protected-file self-exclusion:** retain hardlink and unexpected-resolved-target probes around the low-severity exclusion seam (`roster/wo14b-leg3-redteam-4.md:215-215`).

- **Legacy transcript edge cases:** large-middle blindness, POSIX birthtime recreation, and the one-way latch remain shadow cases only for legacy dormancy. They may not participate in new-roster enforcement (`roster/wo14b-leg3-redteam-3.md:210-212`; `roster/wo14b-leg3-redteam-4.md:231-231`).

### Accepted limits to document

- **Same-user boundary:** arbitrary same-user code can edit project settings, guards, manifests, pins, and ticket stores; this harness prevents model drift, not hostile-process filesystem access. More pin keys do not change that (`README.md:371-371,437-437`).

- **Explicit user pause:** a genuine out-of-band pause intentionally disables enforcement, and session-wide grants consequently reach the main session (`README.md:361-369`).

- **Shared grants:** default grants in `.claude/settings.json` propagate with committed project settings; `--grants-local` is the per-user alternative (`README.md:359-359`).

- **Git push residual:** the exact allowlist still trusts `pushurl`, `pushInsteadOf`, global Git configuration, and `pre-push`; this is already accurately documented and is not a guard problem (`README.md:355-357`).

## HOW LEG 3 PROCEEDS

Stop fix rounds. Dispatch one bounded rewrite order limited to `hooks/orchestra-guard.js`, the forced installer wiring in `install.js`, their two test files, and the corresponding README paragraphs. It must not refactor legacy policy, bridge runtime, tickets, router, or other legs.

Size it for one builder at a planned 55–60 tool calls, reserving the remainder for verification and reporting under the hard 80-call ceiling. Review the whole resulting new-roster path rather than only the delta: first a fresh OpenAI Sol cross-vendor property review, then an independent Anthropic Opus adversarial pass. A provider refusal is review-unavailable, not approval (`roster/wo14b-leg3-review-2-unavailable.md:3-11`).

Mechanical work already in fix round 4 may be reused only where it directly establishes a ruled property. It must not be merged as the architecture by default; the progress record says that round was deliberately limited to mechanical findings and excluded the architectural work (`roster/wo14b-activation-bridge-progress.md:38-40`).

What must not happen next: no fifth reproduction-shaped patch round; no additional fingerprint family or pin key presented as a same-user trust boundary; no runtime hash used to justify executing project code in untrusted state; no transcript-window enlargement; no legacy rewrite; no generic sandbox, Git-policy, or bridge-runtime redesign; and no test whose assertion merely mirrors the new branch structure.

## BRIGHT-LINE STOPPING RULE FOR LEG 3 AND THE GATE THAT ENDS IT

- Stop immediately to the owner if the installed host cannot prove that the separately registered Agent ticket gate vetoes every matching spawn, or if new-roster activation cannot be supplied independently of mutable manifest policy. Do not restore the dynamic `require` seam as a substitute.

- After the bounded rewrite, permit at most one correction pass for finite mechanical findings already expressible by the invariants above. If either independent reviewer then finds a new MAJOR/CRITICAL class, project-code execution, fail-open Agent path, or out-of-project deletion, stop to the owner. No further leg-3 fix round is authorized.

- Leg 3 is done only when every fix-before-canary item has a property-level regression, the declared deterministic suites pass in both executor and reviewer runs, an installed guard-plus-ticket-gate probe demonstrates allowed ticketed and denied unticketed Agent calls, new-to-legacy rollback bumps generation and invalidates capability, uninstall stays inside the real project, documentation states every accepted limit, and the cross-vendor review returns APPROVE with no unresolved MAJOR/CRITICAL. This is the leg-specific application of the bridge’s existing fail-closed and review gate (`roster/wo14b-oracle-verdict.md:79-102`).

- Until that gate passes, do not run or credit leg 7.

## RULING ON THE TOOL-CALL CEILING

- Keep the 80-call ceiling. It is a checkpoint boundary, not an aspirational average; the original leg-3 order already said exceeding it returns `CHECKPOINT` (`roster/wo14b-leg3-order.md:3-6`).

- The failures are both sizing and discipline. Orders estimated to consume more than 60 calls are oversized because they leave no verification/report reserve; a builder reaching 80 must be stopped externally and return `CHECKPOINT`. Recorded builders continued to 90–145 calls, while another did honor the boundary at 81 (`roster/wo14b-activation-bridge-progress.md:10,14,23,33,35-36`).

- Do not raise the ceiling to normalize the overruns. Make the bounded rewrite smaller, budget it explicitly, and enforce the stop.

## VERIFICATION / DEVIATIONS / CONCERNS

- Read `roster/wo14b-oracle-verdict.md`, every leg-3 progress entry, all four cross-vendor review records including the unavailable attempt, and all four Red Team records with numbered output.
- Read the original leg-3 order, current oracle order, relevant current sections of `install.js`, `hooks/orchestra-guard.js`, `README.md`, both affected tests, and the lifecycle proof.
- `git status -sb` → `## claude/wo14b-bridge`.
- `git diff --name-only` and `git diff --stat` → no output.
- Test suites were not run; this read-only oracle order explicitly prohibited them.
- Deviations: none.
- Concern: fix round 4 is in flight against the superseded incremental architecture. Freeze its integration until it is mapped against this ruling.

---

STATUS: DONE

CHANGES
- none

VERIFICATION
- Numbered `Get-Content` and `rg -n` reads over the prior oracle, every leg-3 progress/review/Red Team record, current installer, guard, README, affected tests, and lifecycle proof → completed the evidence-cited architecture and stopping ruling above.
- `git status -sb` → `## claude/wo14b-bridge`.
- `git diff --name-only` and `git diff --stat` → no output; working tree unchanged.
- Test suites → not run; explicitly prohibited by the read-only work order.

DEVIATIONS
- none

CONCERNS
- Current leg 3 must not proceed to the live canary or another reproduction-shaped patch round; its new-roster path requires a bounded property-driven rewrite and independent re-review.

REPORT INTEGRITY: e8404417cf97efc5

TREE AUDIT: no source paths changed while the engine ran.
  HEAD moved: 134bfed4dadf → 1c2a53fd3456 — the engine made commit(s); paths those commits cleaned from the dirty set may show above as "left the dirty set".
Hold the CHANGES section above against this list: an edit claimed but not
listed here did not happen; a listed path the report never mentions is
unexplained work.
Audit measured in-process by this runner (run token e8404417cf97efc5) from its own
before/after tree fingerprints — never from engine or session artifacts.
REPORT INTEGRITY: verified — the engine echoed run token e8404417cf97efc5, and the report does not contradict the tree audit.
== exit 0 2026-09-01T07:43:38Z ==
