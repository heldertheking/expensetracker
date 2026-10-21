# 0003. Shared zod schema package as the API contract

- Status: accepted
- Date: 2026-10-21

## Context

The API and the web client exchange JSON. Hand-written types on each side can drift apart, as the web client's own `HealthData` interface did against the API's response.

## Decision

`packages/schema` (`@expensetracker/schema`) holds zod schemas and the types inferred from them. The API builds its responses with the schema (`HealthSchema.parse(...)` in the health endpoint) and the web client validates what it receives with the same schema. Timestamps use `z.coerce.date()`: the API passes a `Date` and `res.json` serializes it to an ISO string, and the client parses that string back into a `Date`.

The package is consumed through its built `dist` (`main`, `types` and `exports` point at `./dist`), built with `npm run build:schema`.

## Options considered

- Duplicate types in each app: simple, but they drift. Rejected.
- `z.date()` for timestamps: cannot parse the JSON string on the client. Rejected.
- `z.iso.datetime()` (keep a string): possible, but callers would convert to `Date` themselves.
- Consuming the schema source directly through path aliases: avoids a build step but needs bundler and tsconfig changes in every consumer.

## Consequences

- One definition of each contract, with runtime validation on both sides.
- The schema must be built before api/web typecheck and tests; CI builds it once and shares `dist` as an artifact.
- A malformed API response surfaces as a parse error in the client instead of bad UI state.
- Changes to the schema cause everything to rebuild in CI ([0004](0004-path-filtered-ci-pipeline.md)).
