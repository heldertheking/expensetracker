# Architecture decision records

Decisions that affect structure, tooling or conventions are recorded here in MADR style. Copy [0000-template.md](0000-template.md), use the next number, and never rewrite an accepted ADR: supersede it with a new one.

| ADR                                                   | Decision                                                     | Status   |
| ----------------------------------------------------- | ------------------------------------------------------------ | -------- |
| [0001](0001-npm-workspaces-monorepo.md)               | npm workspaces monorepo                                      | accepted |
| [0002](0002-typescript-7-with-ts6-for-eslint.md)      | TypeScript 7 everywhere, TypeScript 6 only for ESLint        | accepted |
| [0003](0003-shared-zod-schema-package.md)             | Shared zod schema package as the API contract                | accepted |
| [0004](0004-path-filtered-ci-pipeline.md)             | Path-filtered CI pipeline                                    | accepted |
| [0005](0005-security-tooling.md)                      | Security tooling                                             | accepted |
| [0006](0006-public-repository-and-badges.md)          | Public repository and badges                                 | accepted |
| [0007](0007-branch-naming-and-ticket-workflow.md)     | Branch naming and ticket workflow                            | accepted |
| [0008](0008-no-ai-attribution.md)                     | No AI attribution in project artifacts                       | accepted |
| [0009](0009-domain-model-and-validation-in-schema.md) | Domain model and validation rules live in the schema package | accepted |
| [0010](0010-accounts-and-project-tags.md)             | Every transaction belongs to an account, projects are tags   | accepted |
| [0011](0011-database-migrations.md)                   | Versioned, forward-only database migrations                  | accepted |
| [0012](0012-business-event-pipeline.md)               | Writes go through a business event pipeline                  | accepted |
| [0013](0013-frontend-charts-and-structure.md)         | Web client: MUI, MUI X Charts, small router, fetch hooks     | accepted |
| [0015](0015-themes-and-high-contrast.md)              | Selectable Light, Dark, and WCAG AAA High-Contrast themes    | accepted |
