# expensetracker

[![CI](https://github.com/heldertheking/expensetracker/actions/workflows/ci.yml/badge.svg)](https://github.com/heldertheking/expensetracker/actions/workflows/ci.yml)
[![Security](https://github.com/heldertheking/expensetracker/actions/workflows/security.yml/badge.svg)](https://github.com/heldertheking/expensetracker/actions/workflows/security.yml)
[![API coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/heldertheking/expensetracker/badges/coverage-api.json)](https://github.com/heldertheking/expensetracker/actions/workflows/ci.yml)
[![Web coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/heldertheking/expensetracker/badges/coverage-web.json)](https://github.com/heldertheking/expensetracker/actions/workflows/ci.yml)
[![Typecheck](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/heldertheking/expensetracker/badges/typecheck.json)](https://github.com/heldertheking/expensetracker/actions/workflows/ci.yml)
[![ESLint](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/heldertheking/expensetracker/badges/lint.json)](https://github.com/heldertheking/expensetracker/actions/workflows/ci.yml)
[![Prettier](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/heldertheking/expensetracker/badges/format.json)](https://github.com/heldertheking/expensetracker/actions/workflows/ci.yml)

Finance tracker with a main and a savings account, where transactions can be tagged with projects that track a budget (M450 project). Every write runs through a business event pipeline, the database evolves through migrations, and the dashboard shows the finances as charts.

- `apps/api/`: Express + TypeScript + SQLite
- `apps/web/`: React + Vite + TypeScript, Material UI and MUI X Charts
- `packages/schema/`: shared zod schemas (the API contract)

## Setup

```
npm install
npm run build:schema
npm run dev     # web on http://localhost:5173, API on :3000
npm test
```

## Test strategy

Short version, details in [docs/testkonzept.md](docs/testkonzept.md).

- **Unit tests** (Vitest) for services, with repositories mocked
- **Integration tests** (Vitest + supertest) against the Express app and an in-memory SQLite database
- **Component tests** (Testing Library + MSW) for the frontend
- **Coverage** via `@vitest/coverage-v8`, JUnit XML + coverage uploaded as artifacts of the CI run
- **CI** (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`; build and test jobs run only when their module (or the shared schema) changed, then a validation job checks types, lint and formatting across the whole repo
- **TDD** is applied at least once (balance calculation service)

## AI usage declaration

| Role                                                | Used                                                       |
| --------------------------------------------------- | ---------------------------------------------------------- |
| 1. Reference for detail questions                   | Yes, primarily                                             |
| 2. Writing code with assistance (autocomplete)      | No / minimal                                               |
| 3. Agent generates code (e.g. Claude Code)          | Only the initial scaffolding and complex logic where noted |
| 4. Reviewing/optimizing existing code, bug tracking | Yes                                                        |

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
