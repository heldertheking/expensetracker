# Testkonzept: expensetracker

Based on the M450 template.

## 1. Introduction

expensetracker is a multi-user web application to track personal finances (income and expenses) and group them by project, as well as in a general "main finances" (`main`) and `savings` account. Every transaction is booked on the main or the savings account and can be tagged with a project, which counts it against the project's budget. It consists of an Express/TypeScript REST backend with SQLite persistence (versioned migrations `0001`–`0006`), `scrypt` authentication with server-side `__Host-session` cookies, and a business event pipeline for all writes, a React/TypeScript frontend with a chart dashboard and selectable themes (including WCAG AAA high contrast), and a shared zod schema package.

## 2. Test Items

- **Schema** (`packages/schema`): domain objects, auth & API contracts and validation rules (contract tests).
- **Backend** (`apps/api`): auth (`scrypt` password hashing, token hashing, sliding-window rate limiter, session lifecycle, CSRF & security headers), routes (HTTP layer & IDOR isolation), event bus and handlers (business events), services (balance, budget and statistics calculation), repositories (SQLite access scoped by `user_id`), migration runner (`0001`–`0006`).
- **Frontend** (`apps/web`): dashboard and charts, transactions, projects, activity feed, authentication pages, theme switcher (`system`, `light`, `dark`, `high-contrast`), API client, hooks.

Architecture sketch: see [architecture.md](architecture.md).

## 3. Features to be tested

| Area     | Feature                                                                               | Level             |
| -------- | ------------------------------------------------------------------------------------- | ----------------- |
| Schema   | Contract rules (required account, budget equation, stats invariants, auth schemas)    | Contract (unit)   |
| Auth     | `scrypt` password hashing, SHA-256 session tokens, rate limiter (**TDD target**)      | Unit              |
| Auth/API | Register, login, logout, `/me`, session rotation, CSRF check, 401/403/429, IDOR suite | Integration       |
| Projects | Create, update, delete project per user; initial budget fixed                         | Unit, Integration |
| Finance  | Add, edit, delete income/expense on main or savings, tag with a project               | Unit, Integration |
| Finance  | Balance per account and overall, project budget remainder (**TDD target**)            | Unit              |
| Events   | Pipeline order, one transaction per event, event log scoped to user, subscribers      | Unit, Integration |
| Database | Migrations `0001`–`0006` apply in order, backfill ownership, roll back on failure     | Integration       |
| Stats    | Monthly flows, month-end balances, spending per project (**TDD target**)              | Unit, Integration |
| Frontend | Theme resolution & WCAG AAA contrast ratios (**TDD target**), theme switcher UI       | Unit, Component   |
| Frontend | Dashboard charts, transaction list and form, project view, activity feed, auth UI     | Component         |

## 4. Features not to be tested

- Load, stress and distributed multi-node performance testing: non-functional, out of scope.
- Visual/pixel layout across different physical monitors and browsers.
- Third-party library internals (Express, SQLite, React, MUI).

## 5. Approach

- **Unit tests** (Vitest): pure calculation services (`balance`, `budget`, `statistics`), auth primitives (`password`, `token`, `rate-limiter`, `session-service`), theme resolution, and event handlers tested in isolation with repositories mocked via `vi.fn`.
- **Integration tests** (Vitest + supertest): HTTP requests against the Express app with an in-memory SQLite database, including full multi-user IDOR isolation tests (`test/api/idor.test.ts`).
- **Component tests** (Vitest + Testing Library): components rendered in jsdom, backend mocked with MSW (`msw/node`).
- **Mocking**: interfaces to other components (repository, HTTP API) are mocked to test one component at a time.
- **TDD**: Red/Green/Refactor applied across multiple features with separate `TDD red` and `TDD green` commits:
  - Balance calculation (`a06ad7f` red -> `dbd437d` green)
  - Project budget remainder (`247a8c8` red -> `05c9ea2` green)
  - Monthly statistics & cumulative balances (`e9829e9` red -> `a581be4` green -> `51f4326` refactor)
  - Password hashing, session tokens & sliding-window rate limiter (`ea82fc7` red -> `34e7ae0` green)
  - Theme preference resolution & WCAG AAA contrast verification (`5251920` red -> `2bc63ee` green)
- **Coverage**: `@vitest/coverage-v8`, reported per module.

## 6. Item pass / fail criteria

A test run passes when all tests succeed and the typecheck is clean. The pipeline on `main` must be green.

Coverage target: the API (`apps/api`) enforces at least 90% lines, statements and functions and 85% branches in `vitest.config.ts`, so `npm test -w apps/api` fails below it. Only the process entry points `src/index.ts` and `src/seed.ts` are excluded; everything they wire together is tested.

**Fehlerklassifizierung:**

- **Geringfügiger Fehler:** cosmetic or wording issue, no effect on functionality.
- **Mittelschwerer Fehler:** a feature works partly or only with a workaround, no data loss.
- **Schwerwiegender Fehler:** wrong calculations (balance/budget), cross-user data leak (IDOR), data loss, or the app is unusable.

## 7. Test Deliverables

- Test code in `packages/schema/test`, `apps/api/test` and `apps/web/test`
- JUnit XML test reports and coverage reports (HTML, lcov), uploaded as CI artifacts
- This test concept
- TDD and code review reflection ([reflexion.md](reflexion.md))

## 8. Testing Tasks

1. Unit tests (services, auth primitives, theme resolution, event handlers)
2. Integration tests (API with database, migrations, authentication, IDOR suite)
3. Component tests (frontend pages, charts, forms, theme switcher, auth flows)
4. Manual exploratory test of the finished product with seeded demo users

## 9. Environmental Needs

- Node.js 24, npm workspaces
- SQLite (in-memory for tests, via better-sqlite3)
- GitHub Actions (`ubuntu-latest`) for the pipeline

## 10. Schedule

See [plan.md](plan.md).

## 11. Weitere Elemente

**Responsibilities:** The author writes and runs the tests.

**Staffing & Training:** Solo project, no additional training required.

**Approvals:** Pipeline green on `main`, coverage report available, all rubric points in the README checklist ticked.
