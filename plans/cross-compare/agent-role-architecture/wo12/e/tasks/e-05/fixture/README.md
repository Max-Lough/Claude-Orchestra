# legacy-toolkit

Reporting helpers that have shipped unchanged since the Node 8 era. The
supported runtime range is whatever `package.json` declares under `engines`;
`scripts/preflight.js` is the gate that enforces it before anything else runs.

```
node scripts/preflight.js && node test.js
```

The library itself is deliberately conservative ES5 so that the declared range
stays honest.
