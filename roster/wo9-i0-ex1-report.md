Seat: Investigator (I0) · Casting used: Claude Opus 5 · high (primary rung, in-harness)
Date: 2026-08-30 · Dispatched in-harness via the Claude Code Agent tool at the charter's
casting. Order: causal account of the worktree lock mechanism.

VERDICT: CONFIRMED. Question: why a mid-flight kill of `git worktree add` leaves a
permanently locked worktree, why single `git worktree remove --force` cannot clear it, and
what `waitWorktreesUnlocked` waits for.

Mechanism (git 2.47.1.windows.1, 20,000-file fixture in scratchpad):
1. `git worktree add` writes `.git/worktrees/<id>/locked` (content `initializing`) during
   admin-dir setup and unlinks it only as its FINAL step on success. The entry is
   list-visible at +131 ms but stays `locked initializing` until add exit (+10,782 ms) —
   confirms tests/review-lane.test.js:186-189, 369-373.
2. The unlink is the parent's post-checkout step; a kill in the window strands the lock
   file forever (not pid/handle/lease-tied). Refinement: file population is done by a CHILD
   git process that survives the parent's death — the stranded worktree can be FULLY
   populated and still permanently locked. The lock, not the half-written tree, is the
   defect.
3. Single `remove --force` is DEFINED to refuse locked worktrees: `fatal: cannot remove a
   locked working tree, lock reason: initializing / use 'remove -f -f' to override or
   unlock first` (exit 128, byte-identical on retry). All five reclaim paths in the
   codebase use single --force (orchestra-review.js:1081,1126; verifier/checkout.js:297,
   383-384,418) — all no-ops against this state.
4. STRONGER THAN THE CODE COMMENTS RECORD: `git worktree prune` skips locked
   registrations even with the directory deleted — so the prune backstops
   (orchestra-review.js:1090,1136; verifier/checkout.js:301,419) cannot reclaim it either.
   The state is unrecoverable by every mechanism the repo ships; the test rightly refuses
   to enter it.
5. Controlled isolation: planting the 13-byte `locked` file by hand on a clean worktree
   reproduces the refusal exactly; `unlock` then single `--force` succeeds. The lock file
   is necessary and sufficient.

Guard semantics (tests/review-lane.test.js:190-199): polls `git worktree list --porcelain`
every 100 ms, drops the main-worktree block, returns true only when no linked block
carries a `locked` line — i.e. the real completion boundary (returned true +10,781 ms; add
exit +10,782 ms), false at deadline. State condition, not duration, because lock duration
scales with checkout size. blocks.slice(1) is safe: the main worktree cannot be locked
(`fatal: The main working tree cannot be locked or unlocked`).

Falsification: any porcelain sample mid-add without `locked`; any single-force exit 0 on a
locked worktree; any prune clearing a locked registration; guard true while add in flight.
None observed across 2 kill runs + planted stand-in. Discarded alternatives: OS
file-handle lock dying with the process (13-byte regular file survives, hand-planted copy
reproduces); half-populated-directory/Windows-handle explanation (full population reached
while locked; -f -f succeeds on the populated tree; deleted directory still un-prunable —
distinct from the cwd-deletion problem at orchestra-review.js:1070-1078).

INCIDENTAL FINDING (not acted on, follow-on): verifier/checkout.js:322-327 describes prune
as clearing registrations whose directory is gone — incomplete: prune skips LOCKED
registrations even with the directory gone.

Fixtures cleaned up; repository verified untouched (empty porcelain status, main worktree
only).

## Phase declaration and execution grant (restored round 2)

The exercise's original output DID carry the mandatory PHASE line; it was dropped in the
Director's condensation of this report. Restored here verbatim.

PHASE: execution — the causal question is about a timing window in an external tool's state
machine; no amount of reading `checkout.js` establishes what git does to
`.git/worktrees/<id>/locked` mid-add. All execution was confined to a throwaway fixture under
the scratchpad; the repository under examination was read only and is verified clean.

Dispatch-time grant (verbatim from the Conductor's order): "read-only with respect to the
repository; you may create throwaway fixture repos ONLY under the scratchpad directory ... if
reproduction needs one. You must not modify anything inside
C:\Users\maxtl\Projects\Claude-Orchestra."

Note: the grant was issued at dispatch but not recorded in the repo at the time — a process
gap now closed by recording it here.
