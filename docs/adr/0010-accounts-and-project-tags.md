# 0010. Every transaction belongs to an account, projects are tags

- Status: accepted
- Date: 2026-11-03

## Context

The first draft of the domain model modelled `main` and `savings` as _views_: `main` showed every transaction, `savings` only the savings ones, and a new transaction defaulted to `main`. That mixes two ideas (where the money is, and what the user is looking at) and makes the main balance include savings. The user's mental model is two real accounts, a normal one and a savings one, with projects cutting across both.

## Decision

- **Accounts.** Every transaction is booked on exactly one account: `main` (the normal, everyday account) or `savings`. The account is **required** when a transaction is created; there is no default. It cannot be changed later (delete and re-create instead), as before.
- **Overall totals** are the sum of both accounts. `GET /api/accounts` returns one summary per account plus the total; lists filter with an optional `account` query parameter (absent = both). The `view` parameter is removed.
- **Projects are tags.** A transaction can optionally be tagged with one project (`projectId`). Tagging does not move money between accounts: it only says what the money was for. Every tagged transaction counts towards its project, whichever account it was booked on.
- **Project budget.** Tagged expenses use up the project's initial budget and tagged income refills it: `remainingCents = budgetCents - expenseCents + incomeCents`. The budget stays a guide, not a ceiling, so the remainder can go negative (`overBudget`). The schema checks this equation on every project response.
- **Statistics** for the dashboard charts (`GET /api/stats`) are part of the contract: monthly income/expense, month-end balance per account and expenses per project tag.

## Options considered

- Keep `main` as an "everything" view: the main balance would double-count savings and the account picker would be ambiguous.
- Default the account to `main`: convenient, but silently books savings deposits on the wrong account. Being explicit costs one field.
- Projects as their own accounts (money moved into a project): closer to envelope budgeting, but needs transfers and makes "spent on the holiday from savings" impossible to express.
- Only expenses count towards a budget: refunds and project income (e.g. selling equipment) would then be invisible in the remainder.

## Consequences

- Clients must always send `account` on create; existing schema tests were updated.
- Balances per account and overall are well defined, which the charts rely on.
- A project's totals span both accounts; the project view shows which account each transaction came from.
