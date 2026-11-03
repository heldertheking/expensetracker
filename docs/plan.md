# Project plan

Short plan, no Gantt chart. Dates and effort estimates are _(TBD)_ and must be matched with the actual available time before development starts (see "Scope check").

## Goal

A finance tracker that groups expenses and income by project, with a general "main finances" account, built with a strong focus on testing (unit, integration, component, mocking, CI reports).

## Scope check

Rather less functionality with solid tests than much functionality with thin tests.

- **Must:** projects, transactions (CRUD) on the main or savings account, project tags with budget calculation, balances per account and overall, business event pipeline, database migrations, tests, CI reports
- **Should:** frontend dashboard with meaningful charts (balance over time, monthly income vs. expense, spending per project, budget usage), transaction and project pages, activity feed
- **Could:** export

## Milestones

| #   | Milestone                                                                                | Target |
| --- | ---------------------------------------------------------------------------------------- | ------ |
| 1   | Skeleton, CI, lint (done)                                                                |        |
| 2   | Domain schema and API contract (EXTR-7)                                                  |        |
| 3   | Backend: migrations, event pipeline, balance service via TDD, CRUD and integration tests |        |
| 4   | Frontend dashboard with charts and component tests                                       |        |
| 5   | Coverage and reports visible, docs complete                                              |        |
| 6   | Presentation (10 min)                                                                    |        |

## Working method

- Feature branches and pull requests into `main`, at least 3 PRs with review comments
- Small, frequent commits
- `main` is protected by the CI pipeline
