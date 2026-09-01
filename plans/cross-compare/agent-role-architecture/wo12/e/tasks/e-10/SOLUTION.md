# e-10 — SOLUTION (scorer only)

**Never hand this file, or any part of it, to an arm.**

## Cause

`config/app.ini` is UTF-8 **with a byte-order mark**. Its first three bytes are
`EF BB BF`, which decode to U+FEFF, so the first line of the decoded string is
`"\uFEFF[server]"` rather than `"[server]"`.

`src/ini.js` matches section headers with an anchored regex on the raw line
(`/^\[([^\]]+)\]$/`) — it trims values only, deliberately, so keys and section
names keep their exact spelling. `"\uFEFF[server]"` therefore matches neither
the section pattern nor a `key=value` line, and is silently skipped. The section
is never opened, so `host` and `port` land at the top level of the object, and
`src/config.js` reports `missing required setting: server.host`. `[limits]` is
on a later line, has no BOM in front of it, and parses normally — which is the
tell.

U+FEFF is invisible in every terminal and is stripped by `String.prototype.trim`
(it is in the WhiteSpace table), so it survives casual inspection and would have
been invisible to a parser that trimmed whole lines.

The evidence an arm should produce:

```
node -e "console.log(require('fs').readFileSync('config/app.ini').subarray(0,6))"
<Buffer ef bb bf 5b 73 65>
```

or `[...readFileSync(f,'utf8')].slice(0,4).map(c=>c.codePointAt(0).toString(16))`
showing `feff`.

## Minimal fix (in scope: `src/ini.js` only)

Strip a leading BOM before parsing:

```js
function parseIni(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  text = text.replace(/^\uFEFF/, '');
  ...
}
```

Doing it in `readIni` instead is equally acceptable, as is decoding through a
BOM-aware read. Trimming whole lines also happens to work, but it changes the
parser's documented contract about preserving key spelling, so prefer the
explicit BOM strip; note it if an arm takes that route.

What is **not** acceptable: re-saving `config/app.ini` without the BOM (out of
scope and explicitly forbidden — the exporter puts it back), or special-casing
`server`.

## Fixture bytes, for the record

`config/app.ini` is exactly these 55 bytes, all ASCII except the three-byte BOM,
with LF line endings (`init-task.js` sets `core.autocrlf false` so git does not
rewrite them):

```
ef bb bf 5b 73 65 72 76 65 72 5d 0a 68 6f 73 74
3d 31 32 37 2e 30 2e 30 2e 31 0a 70 6f 72 74 3d
38 30 38 30 0a 0a 5b 6c 69 6d 69 74 73 5d 0a 6d
61 78 3d 31 30 30 0a
```

i.e. `<BOM>[server]\nhost=127.0.0.1\nport=8080\n\n[limits]\nmax=100\n`.

## Expected end state

```
node test.js -> exit 0, "# 4 cases, 0 failed"
```

Scope audit: `src/ini.js` modified, nothing else. In particular
`config/app.ini` must be unmodified.
