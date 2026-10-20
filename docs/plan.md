# Project plan

Short plan, no Gantt chart. Dates and effort estimates are _(TBD)_ and must be matched with the actual available time before development starts (see "Scope check").

## Goal

A finance tracker that groups expenses and income by project, with a general "main finances" account, built with a strong focus on testing (unit, integration, component, mocking, CI reports).

## Scope check

Rather less functionality with solid tests than much functionality with thin tests.

- **Must:** projects, transactions (CRUD), balance/budget calculation per project and overall, tests, CI reports
- **Should:** frontend views for all of the above
- **Could:** filters/statistics, export

## Milestones

| #   | Milestone                                           | Target |
| --- | --------------------------------------------------- | ------ |
| 1   | Skeleton, CI, lint (done)                           |        |
| 2   | Backend: balance service via TDD, then CRUD         |        |
| 3   | Backend integration tests                           |        |
| 4   | Frontend with component tests                       |        |
| 5   | Coverage and reports visible, docs complete         |        |
| 6   | Presentation (10 min)                               |        |

## Working method

- Feature branches and pull requests into `main`, at least 3 PRs with review comments
- Small, frequent commits
- `main` is protected by the CI pipeline
