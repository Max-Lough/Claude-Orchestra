# invoice-render

Renders an invoice object as plain text.

`@fx/format` is a first-party package that is **vendored in-tree** under
`node_modules/`. This repository has no registry access and no install step:
what is checked in is what runs. Both builds of the package ship (a CommonJS one
under `lib/` and an ESM one under `esm/`) because both are consumed elsewhere in
the fleet.

```
node test.js
```
