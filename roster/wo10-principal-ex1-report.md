# PRINCIPAL (E3) — WO-10 EX1 report

Seat: Principal, class E3, Anthropic · Claude Opus 5 · high, in-harness.
Order: append-only event log — writer + reader + shared format spec, class E3, risk T1.
Workspace: `C:\Users\maxtl\AppData\Local\Temp\claude\C--Users-maxtl-Projects-Claude-Orchestra\5f934331-1de4-4027-be71-da2868fd7fd2\scratchpad\wo10-fixtures\principal` (git-init'd, 2 checkpoint commits).
`C:\Users\maxtl\Projects\Claude-Orchestra` was not touched (read-only: charter file only).

---

STATUS: DONE

---

CHANGES

- `src\record-format.js:1-339` — new. THE shared coupling invariant: canonical JSON serializer (`canonicalize`, recursive key sort, no insignificant whitespace, rejects non-finite/undefined/non-plain objects), `chainBody` (canonical JSON of `{seq,type,payload}`, i.e. the record minus its `chain`), `computeChain` (`sha256_hex(prevChain || chainBody)`), `GENESIS_CHAIN = "GENESIS"` (literal string, not a hash of it), `buildRecord`, `serializeRecord`/`serializeLine`, `parseRecord` (structural validation), `verifyRecord` (seq + chain verdict), `splitLines`, and `scanLog` — the single verification walk that both sides call. The full invariant is stated as a 5-clause spec in the module header.
- `src\log-writer.js:1-118` — new. `append(filePath, event)`: validates the event shape before touching disk; reads and fully verifies the existing log via `fmt.scanLog`; throws `CorruptLogError` (exported, carries `.line`/`.reason`) and writes nothing if verification fails; otherwise builds the next record from the verified tail's `lastChain`/`nextSeq`, writes one line to an `O_APPEND` handle and `fsyncSync`es it before returning; best-effort directory fsync on first create (no-op on Windows, wrapped). Returns `{seq, chain}`. Contains **zero** format or hash logic.
- `src\log-reader.js:1-63` — new. `readAll(filePath)`: delegates the whole walk to `fmt.scanLog`, maps the verified prefix to `{seq, type, payload}` and returns `{events, corrupt}` where `corrupt` is `null` or `{line, reason}` for the FIRST bad line, 1-based. Missing file = empty log. Contains **zero** format or hash logic.
- `acceptance.js:1-126` — new. The Director's four-step scenario verbatim, with per-check pass/fail lines; prints `ACCEPTANCE PASS` only when all four steps hold, and sets exit code accordingly.

---

VERIFICATION

**1. `node acceptance.js` → exit 0, ACCEPTANCE PASS.** Verbatim output:

```
log file: C:\Users\maxtl\AppData\Local\Temp\wo10-acceptance-4FYizk\events.log

(1) append 5 events, readAll -> 5 events, no corrupt
  [ok] readAll returned 5 events (expected 5)
  [ok] corrupt = null (expected null)
  [ok] seq 1..5 continuous and payloads intact

(2) flip one byte in line 3's payload, readAll -> 2 events + corrupt.line=3
  flipped byte at offset 384: 0x65 ('e') -> 0x64 ('d')
  [ok] readAll returned 2 valid events (expected 2)
  [ok] corrupt.line = 3 (expected 3)
  corrupt.reason = chain mismatch: expected 8366214bcf673a6fef2bee70c18f6904eaf670f7afde16421211801ea4a58fb6, found 47dfda1ff80860cfadd27450395d967e13a75f4fe160f95ba55505238972ae74

(3) after that corruption, append must throw
  [ok] append threw CorruptLogError: refusing to append to C:\Users\maxtl\AppData\Local\Temp\wo10-acceptance-4FYizk\events.log: log is corrupt at line 3 (chain mismatch: expected 8366214bcf673a6fef2bee70c18f6904eaf670f7afde16421211801ea4a58fb6, found 47dfda1ff80860cfadd27450395d967e13a75f4fe160f95ba55505238972ae74)
  [ok] file size unchanged (695 -> 695); nothing was written

(4) restore the file, append a 6th, readAll -> 6
  [ok] file restored to pristine bytes
  [ok] readAll returned 6 events (expected 6)
  [ok] corrupt = null (expected null)
  [ok] sixth event has seq 6 and the expected payload

steps: 1=pass 2=pass 3=pass 4=pass
ACCEPTANCE PASS
---exit=0
```

Note on step 2: the flipped byte is inside a payload **string value** (`'e'`→`'d'` in `"event-3"`), so the line remains syntactically valid JSON. The failure is therefore detected by the CHAIN, not by a parse error — which is the property under test. `corrupt.reason` confirms `chain mismatch`.

**2. Adversarial probes beyond the ordered scenario** (run inline via `node -e`, not added to the deliverable tree):

```
A genesis-literal: ok | body={"payload":{"k":1},"seq":1,"type":"t"}
B key-order-independent: ok
C truncated-tail: ok | truncated final record (no line terminator)
C append-refuses-torn-tail: ok
D record-deletion: ok | seq discontinuity: expected 3, found 4
E chain-tamper: ok
F missing-file: ok
```

- **A** — record 1's stored chain equals an independently computed `sha256("GENESIS" + body)`, confirming the genesis seed is the literal string as ordered, not a digest of it.
- **B** — the same payload written with keys in different insertion order verifies on read; the canonical sort actually holds.
- **C** — a file truncated mid-record (simulated crash during append) is reported as corruption at that line rather than silently accepted as a short record, and `append` refuses to extend it.
- **D** — deleting an entire record is caught by seq continuity (`expected 3, found 4`); the chain alone would not catch a clean whole-line deletion at the tail, so seq is load-bearing, not decorative.
- **E** — rewriting one record's `chain` field to an arbitrary digest is caught at that line; an attacker must recompute every subsequent link, not one.
- **F** — a missing file reads as an empty log rather than throwing.

**3. Coupling audit — the invariant is not duplicated.** With comments stripped, neither consumer contains any format or chain logic:

```
src/log-writer.js clean — no format/chain logic in code
src/log-reader.js clean — no format/chain logic in code
```

The only textual occurrences of `GENESIS` / `sha256` in either file are prose in doc comments (`log-writer.js:99`, `log-reader.js:23`). Their `require` sets are `fs`, `path`, `./record-format` (writer) and `fs`, `./record-format` (reader) — no writer↔reader dependency in either direction; they are coupled only through the shared spec.

**4. Tree and size:** `git ls-files` → `acceptance.js`, `src/log-reader.js`, `src/log-writer.js`, `src/record-format.js`. 646 lines total (339 spec / 118 writer / 63 reader / 126 acceptance). Commits `c2bd7a0` (modules), `6199b36` (acceptance).

---

THE COUPLING INVARIANT, NAMED

**Name: canonical-body chaining — "the bytes the reader re-derives must be the bytes the writer hashed."**

Stated in full (and stated once, in `src\record-format.js`'s header):

1. A record is `{seq, type, payload, chain}`, serialized as ONE line of canonical JSON terminated by a single `\n`.
2. **Canonical JSON** is deterministic: object keys sorted ascending by UTF-16 code unit, applied recursively; no insignificant whitespace; no non-finite numbers; no `undefined`; `-0` normalized to `0`. Structurally equal values always produce byte-identical output, and canonicalization is **idempotent under a parse round-trip**.
3. The **chain body** of a record is the canonical JSON of `{seq, type, payload}` — the record without its `chain` field.
4. `chain(n) = SHA-256_hex( chain(n-1) || chainBody(n) )`, `||` being UTF-8 string concatenation, with `chain(0)` = the literal string `"GENESIS"`.
5. `seq` starts at 1 and increases by exactly 1 per record.

Clause 2's idempotence is the load-bearing half and the reason this is one invariant rather than two conventions. The writer hashes bytes it *constructs*; the reader must hash bytes it *reconstructs from a parsed object*, after JSON.parse has already thrown away the original key order and number spelling. The recipe is only sound because canonicalization is a normal form that survives that round-trip. A writer that used plain `JSON.stringify` (insertion order) would pass every writer-only unit test and still fail against any independently written reader — the bug would be invisible from inside either module.

---

SPLIT-RESISTANCE — honest assessment

**Verdict: split-resistant at design time, decomposable at implementation time. The order's premise holds, but for a more specific reason than "two coupled modules."**

The two modules are *not* what resists splitting — they are ~118 and ~63 lines of straightforward I/O and mapping, and once `record-format.js` exists and is fully specified, handing them to two independent E2 Builders as pure consumers of that API would work fine. Conceding that plainly: **the implementation of the writer and reader is separable.**

What is genuinely not separable is *fixing the invariant in the first place*, because three of its clauses are only forced by holding both sides in view at once. Each was a live fork in this build:

1. **Canonical-vs-convenient serialization** (clause 2). Nothing on the writer's side demands a key sort — the writer could hash whatever bytes it wrote. The sort exists *only* because the reader must reproduce those bytes from a parsed object. A writer author, working to a spec that said "hash the record's JSON," would reasonably ship `JSON.stringify` and be correct by their own lights.
2. **Which fields the hash covers** (clause 3). "Chain over the record" is circular — the chain cannot cover itself. Deciding the hash covers the record *minus* `chain`, and that the reader therefore strips-then-recanonicalizes rather than hashing the raw line, is a joint decision. Hashing the raw line instead is a defensible alternative that produces a different, equally consistent system — but writer and reader must pick the *same* one, and neither has local grounds to prefer either.
3. **Where verification lives** (the requirement that `append` refuse a corrupt tail). This is stated in the writer's half of the order, but it is *the reader's* algorithm. Implemented naively, the writer imports the reader, giving the append path a dependency on the read path and two subtly different walks in practice. The resolution — hoist the whole verification walk (`scanLog`) into the shared module so it is neither side's, and have both call it — is only visible if you are holding the writer's "refuse" requirement and the reader's "report `{line, reason}`" requirement simultaneously. That hoist is why `record-format.js` is 339 lines and the two consumers together are 181: the shared module ended up owning materially more than a "format spec" would suggest, and that reallocation *was* the design work.

So the correct decomposition is not writer|reader — it is **spec-then-fan-out**: one seat fixes and writes `record-format.js` (including `scanLog`), after which writer, reader, and acceptance are three genuinely parallel E2 orders. The order as issued bundled the design and the implementation, and the design half is what earned the E3 routing. Per the charter's SPAWN grant I could have fanned out the implementation half to Runners after the spec was pinned; at 181 lines across two files I judged the fan-out overhead to exceed the work, and the order explicitly instructed no spawn for this small order.

---

DEVIATIONS

- **Acceptance scenario: none.** All four steps are implemented exactly as ordered, in order, with `ACCEPTANCE PASS` gated on all four.
- `readAll` returns events as `{seq, type, payload}` — `seq` included alongside the ordered `{type, payload}`. Rationale: `seq` is verified data the caller needs to reason about continuity, and suppressing it would discard information the format already guarantees. `chain` is deliberately NOT exposed; it is an integrity detail of the format, not part of the event.
- `append` verifies the **entire** log, not only the tail. The order says "refuse if the existing tail fails chain verification"; the chain is inductive, so a tail's chain is not verifiable without the prefix that produced it. Full verification is the faithful reading, and is strictly stronger. Cost is noted under CONCERNS.
- `append` returns `{seq, chain}` rather than nothing. Not ordered; not required by acceptance. Judged a zero-cost affordance for callers that must correlate a write with its record. Flagging it as unrequested scope.
- Added `CorruptLogError` as a named, exported error class rather than throwing a bare `Error`. The order requires only "throw"; a typed error lets callers distinguish corruption from a bad argument without string-matching. Flagging as unrequested scope.
- Probes A–F above are beyond the ordered acceptance. They were run inline (`node -e`) and deliberately **not** added as files, to keep the deliverable exactly the three modules plus `acceptance.js`.
- No spawn, per the order's instruction.

---

CONCERNS

- **`append` is O(n) in log length** — every append re-reads and re-verifies the whole file, so building a log of N records is O(N²). Fine at acceptance scale, unusable past a few thousand records. The fix is a persisted verified checkpoint (last verified `{seq, chain, byteOffset}`) so append verifies only the delta; that is a format-level addition and belongs in `record-format.js`, not bolted onto the writer. **Follow-up to weigh before this sees real volume.**
- **No concurrency control — the seam most likely to bite.** `append` is read-verify-build-write and is NOT atomic. Two processes (or two interleaved async callers) appending to the same file can both read the same tail and mint the same `seq` with divergent chains; `O_APPEND` makes each individual line-write atomic, so the result is a physically well-formed file that is permanently unverifiable from the first duplicate onward — and, because `append` refuses corrupt tails, the log becomes *append-dead*, not merely inconsistent. This needs an exclusive lock (lockfile or `O_EXCL` sidecar) around the whole read-verify-write sequence before any multi-writer use. Noting this explicitly per the charter's cross-subsystem-seam rule, and because the Sol mirror's documented concurrency blind spot makes it exactly the kind of gap that survives review.
- **`readAll` loads the entire file into memory** and returns all events at once. Acceptable for the ordered API shape; a streaming/iterator variant will be wanted at scale, and `scanLog` is already structured as a single forward walk, so the change is contained.
- **Cross-language interop seam.** Canonical JSON's number formatting relies on JavaScript's shortest-round-trip double serialization. A reader written in Python or Go must reproduce that spelling exactly or every chain will mismatch. If the log is ever read outside Node, clause 2 needs an explicit number-format rule (or payload numbers need restricting to integers). This is latent today and would surface as a total, baffling verification failure.
- **Corruption is fail-stop, by design, and the operational consequence should be a conscious choice.** One bad byte in record 3 of a 10,000-record log makes records 3–10,000 unreadable *and* blocks all further appends. That is the correct default for an integrity-bearing log — silently skipping a bad line would let deletion of history go unnoticed — but there is currently no repair or truncate-to-last-good tool. Someone will need one, and it should be a deliberate, audited operation rather than an ad-hoc script.
- **`fsync` durability is only as good as the storage stack.** `fsyncSync` on the file handle is called before `append` returns; on Windows the directory-entry fsync is a no-op (cannot open a directory as a file), so a first-ever file *create* is durable only to the filesystem's own metadata guarantees. Drives that lie about flush caches defeat this regardless of platform. Non-blocking, but not a guarantee to overstate.
- **A trailing-newline-only file convention is doing quiet work.** A record without its terminator is treated as a torn append and reported as corruption (probe C). This is deliberate and correct, but it means any tool that rewrites the log without a final newline will render it corrupt. Worth knowing before anyone edits one by hand.
