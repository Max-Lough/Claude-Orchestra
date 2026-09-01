# Environment contract

| variable | values | meaning |
|---|---|---|
| `APP_MODE` | `strict`, `legacy` | selects the escaping profile used by `src/sanitize.js` |

`strict` is the supported configuration and the only profile that escapes `&`,
`"` and `'` in addition to `<` and `>`.

`legacy` exists only for the 0.x compatibility shim, which double-escaped
ampersands downstream and therefore needed them left alone. That shim was
removed in 1.8.0. `legacy` is scheduled for deletion in 2.0 and must never be
the effective profile for anything but a 0.x replay.
