# 0009. Domain model and validation rules live in the schema package

- Status: accepted
- Date: 2026-10-21

## Context

The app tracks transactions on two views (`main` shows every transaction, `savings` only the savings ones) and groups them into projects. A project can carry an initial budget that must never change and is a guide, not a hard ceiling. Validation rules like "this field cannot be updated" or "if this changes, that must be resent" are easy to scatter across routes, services and the client. [ADR 0003](0003-shared-zod-schema-package.md) already makes `packages/schema` the API contract, so the rules belong there too.

## Decision

Every validation rule that can be expressed without a database lives in `packages/schema`.

**Layout and placement** (`src/domain` holds the entities, `src/api` the contract built on them):

- An object that belongs to exactly one entity lives in that entity's file. A budget that only a project uses is part of `domain/project.ts`; `Account` and `TransactionType` live in `domain/transaction.ts`.
- An object used by more than one entity gets its own file (`money.ts`, `id.ts`, `iso-date.ts`, `timestamp.ts`, `text.ts`).
- API-only helpers (readonly fields, errors, update checks) live in `src/api`, never in `src/domain`. No catch-all `common.ts`.

**Rules:**

- Money is integer cents (`amountCents`, `budgetCents`), never floats.
- Dates are calendar dates (`YYYY-MM-DD`); timestamps use `z.coerce.date()`.
- Requests are strict (`z.strictObject`): unknown keys fail. Server-owned fields (`id`, totals, timestamps) and immutable fields (`budgetCents` after creation, `account` of a transaction) are declared with `readonlyFields` so a client gets a message saying why, not a generic error.
- Input is strict, output is tolerant: a request may not carry a future date, but a stored transaction with one is still a valid response.
- Rules that need the stored record but no database are pure functions taking `existing` and `patch` (`validateTransactionUpdate`, `validateProjectUpdate`): an update that changes nothing is rejected, and changing `type` requires `amountCents` to be sent again because it inverts the balance impact.
- Response schemas carry structural invariants (a remainder exists exactly when there is a budget; `overBudget` matches a negative remainder; a page never exceeds its limit).
- Errors share one shape (`ApiErrorSchema`) with `validation_error`, `not_found`, `conflict` and `unprocessable` codes.

**Deliberately outside the schema:**

- Arithmetic such as balances and remaining budget stays in the service layer, where it is the TDD target of the project plan.
- Rules needing data: unique project names, deleting a project that still has transactions, a referenced project existing.

## Options considered

- Validation only in API routes: the web client could not reuse it and would drift.
- Mutable budget with an audit trail: more flexible, but the requirement is an initial budget that cannot change.
- A hard budget ceiling that rejects overspending: the budget is meant to help the user track, not to block them.
- Floats or decimal strings for money: float rounding errors, or extra parsing on every consumer.
- One shared `common.ts`: it attracts everything and hides which entity owns an object.

## Consequences

- Routes, services and the web client reuse one set of rules and messages.
- Schema contract tests run in CI in the schema build job.
- Changing a rule is a schema change, so it rebuilds everything in CI ([0004](0004-path-filtered-ci-pipeline.md)).
- Services still have to run the stateful and database-backed checks.
