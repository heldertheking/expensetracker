# Architecture (rough)

```mermaid
flowchart LR
    User([User]) --> FE[Frontend<br/>React + Vite]
    FE -- REST / JSON --> BE

    subgraph BE[Backend - Express]
        R[Routes<br/>validation with zod] --> S[Services<br/>business logic]
        S --> Repo[Repositories]
    end

    Repo --> DB[(SQLite)]
```

## Layers

| Layer        | Responsibility                             | Tested with                      |
| ------------ | ------------------------------------------ | -------------------------------- |
| Routes       | HTTP, input validation, status codes       | Integration (supertest)          |
| Services     | Business rules, budget/balance calculation | Unit (repositories mocked)       |
| Repositories | SQL access, mapped to domain types         | Integration (in-memory SQLite)   |
| Frontend     | Components, pages, API client              | Component (Testing Library, MSW) |

## Domain

Defined with its validation rules in `packages/schema` ([ADR 0009](adr/0009-domain-model-and-validation-in-schema.md)).

- **Views**: `main` shows every transaction, `savings` only the savings ones
- **Project**: name, description and an optional initial budget (fixed at creation, a guide rather than a hard ceiling). Income, expense and remaining budget are derived by the server
- **Transaction**: account (`main` or `savings`), income/expense, amount in cents, date, description, optional project (none = not part of a project)
