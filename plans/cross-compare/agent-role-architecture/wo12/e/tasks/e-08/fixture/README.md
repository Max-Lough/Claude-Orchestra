# gatekeeper

`accept(subject)` mints a token through `@fx/issuer` and admits it only if it is
a genuine `@fx/token` instance. The `instanceof` test is the point of the
service: a lookalike object from anywhere else must be refused.

`@fx/token` and `@fx/issuer` are first-party packages **vendored in-tree** under
`node_modules/`. This repository has no registry access and no install step:
what is checked in is what runs.

```
node test.js
```
