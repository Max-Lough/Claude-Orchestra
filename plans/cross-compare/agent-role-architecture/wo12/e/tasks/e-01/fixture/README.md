# clibundle

A dependency-free CLI helper library shipped as one concatenated file.

Every module in `src/` is a plain script fragment that attaches its exports to
a shared `CLI` object. `build.js` wraps them with a prelude (`var CLI = {};`)
and an epilogue (`module.exports = CLI;`) and writes the result to
`dist/bundle.js`. `verify.js` requires the built bundle and checks the rendered
report against a fixed expectation.

```
node build.js && node verify.js
```

`dist/` is generated and is not tracked.
