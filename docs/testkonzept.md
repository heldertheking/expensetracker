# Testkonzept: expensetracker

Based on the M450 template. Entries marked _(TBD)_ are filled in as the project develops.

## 1. Introduction

expensetracker is a web application to track finances (income and expenses) and group them by project, as well as in a general "main finances" account. It consists of an Express/TypeScript REST backend with SQLite persistence and a React/TypeScript frontend.

## 2. Test Items

- **Backend** (`backend/`): routes (HTTP layer), services (business logic, e.g. budget/balance calculation), repositories (SQLite access).
- **Frontend** (`frontend/`): components, pages, API client, hooks.

Architecture sketch: see [architecture.md](architecture.md).

## 3. Features to be tested

_(TBD, refine as features are planned)_

| Area     | Feature                                                  | Level             |
| -------- | -------------------------------------------------------- | ----------------- |
| Projects | Create, update, delete project; set budget               | Unit, Integration |
| Finance  | Add, edit, delete income/expense, per project or general | Unit, Integration |
| Finance  | Balance and budget calculation (**TDD target**)          | Unit              |
| API      | Input validation (zod), error responses                  | Integration       |
| Frontend | Transaction list, project view, transaction form         | Component         |

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
- **TDD**: Red/Green/Refactor applied at least once, planned for the balance calculation service. Commits show the red and green steps.
- **Coverage**: `@vitest/coverage-v8`, reported per module.

## 6. Item pass / fail criteria

A test run passes when all tests succeed and the typecheck is clean. The pipeline on `main` must be green.

Coverage target: _(TBD, e.g. >= 80% lines for services)_.

**Fehlerklassifizierung:**

- **Geringfügiger Fehler:** cosmetic or wording issue, no effect on functionality.
- **Mittelschwerer Fehler:** a feature works partly or only with a workaround, no data loss.
- **Schwerwiegender Fehler:** wrong calculations (balance/budget), data loss, or the app is unusable.

## 7. Test Deliverables

- Test code in `backend/test` and `frontend/test`
- JUnit XML test reports and coverage reports (HTML, lcov), uploaded as CI artifacts
- This test concept
- TDD and code review reflection ([reflexion.md](reflexion.md))

## 8. Testing Tasks

1. Unit tests (services, utilities, hooks)
2. Integration tests (API with database)
3. Component tests (frontend)
4. Manual exploratory test of the finished product before the presentation

## 9. Environmental Needs

- Node.js 20, npm workspaces
- SQLite (in-memory for tests, via better-sqlite3)
- GitHub Actions (`ubuntu-latest`) for the pipeline

## 10. Schedule

_(TBD, see [plan.md](plan.md))_

## 11. Weitere Elemente

**Responsibilities:** The author writes and runs the tests. AI assists with research, complex logic and bug tracking only (see README).

**Staffing & Training:** Solo project, no additional training required.

**Approvals:** Pipeline green on `main`, coverage report available, all rubric points in the README checklist ticked.
