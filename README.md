# expensetracker

Finance tracker that groups expenses by project (M450 project).

- `backend/`: Express + TypeScript + SQLite
- `frontend/`: React + Vite + TypeScript

## Setup

```
npm install
npm test
```

## Test strategy

Short version, details in [docs/testkonzept.md](docs/testkonzept.md).

- **Unit tests** (Vitest) for services, with repositories mocked
- **Integration tests** (Vitest + supertest) against the Express app and an in-memory SQLite database
- **Component tests** (Testing Library + MSW) for the frontend
- **Coverage** via `@vitest/coverage-v8`, JUnit XML + coverage uploaded as artifacts of the CI run
- **CI** (`.github/workflows/ci.yml`) runs tests on every push and pull request, and on `main`; test jobs run only when their module changed, lint always runs
- **TDD** is applied at least once (balance calculation service)

## AI usage declaration

| Role                                                  | Used                         |
| ----------------------------------------------------- | ---------------------------- |
| 1. Reference for detail questions                     | Yes, primarily               |
| 2. Writing code with assistance (autocomplete)        | No / minimal                 |
| 3. Agent generates code (e.g. Claude Code)            | Only the initial scaffolding and complex logic where noted |
| 4. Reviewing/optimizing existing code, bug tracking   | Yes                          |

Most code is written by the author. AI is used primarily for research, help with complex logic and bug tracking. The author must be able to understand, justify and extend all code.

## Documentation

- [Project plan](docs/plan.md)
- [Architecture](docs/architecture.md)
- [Test concept](docs/testkonzept.md)
- [Reflection on TDD and code reviews](docs/reflexion.md)

## Checklist (M450 rubric)

- [ ] Scope and time investment compared
- [x] AI usage declared
- [ ] Small, continuous commits
- [ ] Unit tests
- [ ] Integration tests
- [ ] Interfaces mocked
- [ ] Test results reported after a run
- [ ] Tests run automatically in the pipeline on `main`
- [ ] TDD used at least once
- [ ] At least 3 pull requests with comments
- [ ] Coverage report viewable
