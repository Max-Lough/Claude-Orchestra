# escape-kit

HTML escaping helpers.

- `src/sanitize.js`: `escapeHtml(text)`.
- `src/config.js`: runtime configuration.
- `docs/ENV.md`: the environment contract.
- `test.js`: the suite; `node test.js` exits 0 when it is green.

There is no build step: `node test.js` is the whole pipeline.
