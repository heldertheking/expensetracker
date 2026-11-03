# Testkonzept: expensetracker

Based on the M450 template. Entries marked _(TBD)_ are filled in as the project develops.

## 1. Introduction

expensetracker is a web application to track finances (income and expenses) and group them by project, as well as in a general "main finances" account. Every transaction is booked on the main or the savings account and can be tagged with a project, which counts it against the project's budget. It consists of an Express/TypeScript REST backend with SQLite persistence (versioned migrations) and a business event pipeline for all writes, a React/TypeScript frontend with a chart dashboard, and a shared zod schema package.

## 2. Test Items

- **Schema** (`packages/schema`): domain objects, API contract and validation rules (contract tests).
- **Backend** (`apps/api`): routes (HTTP layer), event bus and handlers (business events), services (balance, budget and statistics calculation), repositories (SQLite access), migration runner.
- **Frontend** (`apps/web`): dashboard and charts, pages, components, API client, hooks.

Architecture sketch: see [architecture.md](architecture.md).

## 3. Features to be tested

_(TBD, refine as features are planned)_

| Area     | Feature                                                                    | Level             |
| -------- | -------------------------------------------------------------------------- | ----------------- |
| Schema   | Contract rules (required account, budget equation, stats invariants)       | Contract (unit)   |
| Projects | Create, update, delete project; initial budget fixed                       | Unit, Integration |
| Finance  | Add, edit, delete income/expense on main or savings, tag with a project    | Unit, Integration |
| Finance  | Balance per account and overall, project budget remainder (**TDD target**) | Unit              |
| Events   | Pipeline order, one transaction per event, event log, subscribers          | Unit, Integration |
| Database | Migrations apply in order, idempotent, roll back on failure                | Integration       |
| Stats    | Monthly flows, month-end balances, spending per project                    | Unit, Integration |
| API      | Input validation (zod), error responses                                    | Integration       |
| Frontend | Dashboard charts, transaction list and form, project view, activity feed   | Component         |

## 4. Features not to be tested

- Authentication/authorization: out of scope for this project.
- Performance, load and security testing: non-functional, out of scope.
- Visual/pixel layout and cross-browser compatibility.
- Third-party library internals (Express, SQLite, React).

## 5. Approach

- **Unit tests** (Vitest): services tested in isolation, repositories mocked with `vi.mock`/`vi.fn`.
- **Integration tests** (Vitest + supertest): HTTP requests against the Express app with an in-memory SQLite database.
- **Component tests** (Vitest + Testing Library): components rendered in jsdom, backend mocked with MSW.
- **Mocking**: interfaces to other components (repository, HTTP API) are mocked to test one component at a time.
- **TDD**: Red/Green/Refactor applied to the calculation services (budget remainder, balances, statistics). The commits show the red and green steps with measured results: see [ci-cd-and-tdd.md](ci-cd-and-tdd.md).
- **Coverage**: `@vitest/coverage-v8`, reported per module.

## 6. Item pass / fail criteria

A test run passes when all tests succeed and the typecheck is clean. The pipeline on `main` must be green.

Coverage target: the API (`apps/api`) enforces at least 90% lines, statements and functions and 85% branches in `vitest.config.ts`, so `npm test -w apps/api` fails below it. Only the process entry points `src/index.ts` and `src/seed.ts` are excluded; everything they wire together is tested.

**Fehlerklassifizierung:**

- **Geringfügiger Fehler:** cosmetic or wording issue, no effect on functionality.
- **Mittelschwerer Fehler:** a feature works partly or only with a workaround, no data loss.
- **Schwerwiegender Fehler:** wrong calculations (balance/budget), data loss, or the app is unusable.

## 7. Test Deliverables

- Test code in `packages/schema/test`, `apps/api/test` and `apps/web/test`
- Coverage reports (HTML and JSON) per workspace, uploaded as CI artifacts; test results are in the job log and the Checks tab (JUnit XML is not produced yet, see [ci-cd-and-tdd.md](ci-cd-and-tdd.md))
- This test concept
- TDD and code review reflection ([reflexion.md](reflexion.md))

## 8. Testing Tasks

1. Unit tests (services, utilities, hooks)
2. Integration tests (API with database)
3. Component tests (frontend)
4. Manual exploratory test of the finished product before the presentation

## 9. Environmental Needs

- Node.js 24, npm workspaces
- SQLite (in-memory for tests, via better-sqlite3)
- GitHub Actions (`ubuntu-latest`) for the pipeline

## 10. Schedule

_(TBD, see [plan.md](plan.md))_

## 11. Weitere Elemente

**Responsibilities:** The author writes and runs the tests. AI assists with research, complex logic and bug tracking only (see README).

**Staffing & Training:** Solo project, no additional training required.

**Approvals:** Pipeline green on `main`, coverage report available, all rubric points in the README checklist ticked.
