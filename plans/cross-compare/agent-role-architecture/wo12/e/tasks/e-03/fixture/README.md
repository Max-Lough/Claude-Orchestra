# record-validator

Rejects inbound records that are missing a required field.

- `schema/fields.json`: the field schema, the single source of truth.
- `src/validate.js`: `missingFields(record)` and `isValid(record)`.
- `test.js`: the suite; `node test.js` exits 0 when it is green.

There is no build step in front of the suite: `node test.js` is the whole
pipeline.
