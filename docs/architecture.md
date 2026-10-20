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

| Layer        | Responsibility                                   | Tested with                     |
| ------------ | ------------------------------------------------ | ------------------------------- |
| Routes       | HTTP, input validation, status codes             | Integration (supertest)         |
| Services     | Business rules, budget/balance calculation       | Unit (repositories mocked)      |
| Repositories | SQL access, mapped to domain types               | Integration (in-memory SQLite)  |
| Frontend     | Components, pages, API client                    | Component (Testing Library, MSW) |

## Domain (draft)

- **Project**: name, optional budget
- **Transaction**: amount, income/expense, date, description, optional project (none = main finances)
