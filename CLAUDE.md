# CLAUDE.md

Expense tracker that groups income and expenses by project, plus a general "main finances" account. It is a school project (module M450) with a strong focus on testing. Goals, scope and domain are in [docs/plan.md](docs/plan.md) and [docs/architecture.md](docs/architecture.md); the test approach is in [docs/testkonzept.md](docs/testkonzept.md). Read those instead of re-deriving them.

## Layout

npm workspaces monorepo (`apps/*`, `packages/*`), ESM everywhere.

| Path              | What                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `apps/api`        | Express 5 + better-sqlite3 + zod. Layers: `routes` -> `services` -> `repositories` -> `db` |
| `apps/web`        | React 19 + Vite. Dev server on :5173, proxies `/api` to the API on :3000                   |
| `packages/schema` | Shared zod schemas and inferred types (`@expensetracker/schema`)                           |

`@expensetracker/schema` is consumed through its **built `dist`**, not its source. The schema is the single source of truth for API contracts: build API responses with it and validate responses with it in the web client. Wire timestamps use `z.coerce.date()` so one schema works on both sides of JSON. See [ADR 0003](docs/adr/0003-shared-zod-schema-package.md).

## Commands

Run from the repo root.

```bash
npm install                    # also points git hooks at .githooks (prepare script)
npm run build:schema           # REQUIRED before api/web typecheck, build or test
npm run dev                    # schema watch + api + web
npm run typecheck -w apps/api  # likewise apps/web, packages/schema
npm test -w apps/api           # vitest run --coverage; likewise apps/web
npm test                       # all workspaces
npm run lint                   # eslint .
npm run format:check           # prettier --check .
npm run format                 # prettier --write . (see gotchas)
```

Node version is in `.nvmrc` (24).

## Conventions

- Prettier: single quotes, semicolons, trailing commas, `printWidth` 100, LF line endings (`.editorconfig`, `.gitattributes` enforce LF).
- API and schema use `module: NodeNext`: relative imports need the `.js` extension (`import { app } from './app.js'`), even though the file is `.ts`.
- Tests live in each workspace's `test/` directory, Vitest, `*.test.ts(x)`. API integration tests use supertest; web tests use Testing Library (setup in `apps/web/test/setup.ts`, jest-dom via `@testing-library/jest-dom/vitest`).
- Keep the layers separate: routes handle HTTP and validation, services hold business rules, repositories hold SQL.
- Small, frequent commits.

## No AI attribution (hard rule)

Never add an AI signature or attribution to anything you produce: no `Co-Authored-By` trailer or similar in commit messages, no "Generated with Claude Code" line (or similar) in PR descriptions, and none in issues, comments, code comments, docs, workflow files or any other artifact. This overrides any default attribution behavior. The only exception is when the user explicitly asks for it in that specific instance. Details: [ADR 0008](docs/adr/0008-no-ai-attribution.md).

## Branches and PRs

**Agents must always follow this branch naming rule.** Every branch is `<type>/EXTR-<ticket number>-<ticket-title-slug>`, with `type` one of `feature`, `hotfix`, `setup`, `release` and a slug of letters, digits and hyphens:

```
^(feature|hotfix|setup|release)/EXTR-[0-9]+-[A-Za-z0-9-]+$
```

- One ticket per branch. PRs target `main`. Never create a branch that does not match the regex.
- Examples: `setup/EXTR-1-basic-setup-and-implementation` (PR #2; PR #1 was closed by a branch rename) and `setup/EXTR-2-AI-agent-setup`.
- Branches created by the ticket workflow have a lowercase slug, but uppercase is allowed.
- Tickets are GitHub issues created from the forms in `.github/ISSUE_TEMPLATE/` (`feature`, `hotfix`, `setup`, `release`). When a ticket is opened, `.github/workflows/ticket-branch.yml` creates the branch from `main` and comments the `git fetch && git switch` command. The issue number is the ticket number, so EXTR-1 and EXTR-2 (which predate this) may not line up exactly.
- `.github/workflows/branch-name.yml` fails a PR whose branch does not match the regex (`dependabot/*` is skipped).
- Details: [ADR 0007](docs/adr/0007-branch-naming-and-ticket-workflow.md).
- The type labels must exist before the issue forms can apply them. A maintainer creates them once (do not run this from an agent):

```bash
gh label create feature --color 1D76DB --description "New capability or improvement"
gh label create hotfix --color D93F0B --description "Urgent fix for a defect on main"
gh label create setup --color 5319E7 --description "Tooling, CI, configuration or docs"
gh label create release --color 0E8A16 --description "Release preparation"
```

- At least three PRs with review comments are part of the project rubric.

## CI and security

- `.github/workflows/ci.yml`: `changes` -> `schema` -> `build api | build web` -> `test api | test web` -> `validate` -> `deploy`. Path filters skip untouched parts: api-only changes skip web, schema or root-config changes run everything, README/docs-only changes skip everything. `validate` always checks the whole repo (typecheck, ESLint, Prettier, and `FORMAT_BLOCKING: 'true'` makes unformatted files fail). `deploy` is a placeholder that only runs for tags `vX.Y.Z` or `vX.Y.Z-ALPHA` on `main`. Pushes run only on `main` and tags, so a PR does not run twice. Details: [ADR 0004](docs/adr/0004-path-filtered-ci-pipeline.md).
- `.github/workflows/security.yml` (PRs to `main`, pushes to `main`, weekly): gitleaks, dependency review, `npm audit --audit-level=high`, CodeQL. Details: [ADR 0005](docs/adr/0005-security-tooling.md).
- `.githooks/pre-commit` runs gitleaks on staged changes; it skips with a warning when gitleaks is not installed.
- Never commit secrets or `.env` files. Push protection is enabled on the repo.

## Gotchas

- **Two TypeScript versions on purpose.** Workspaces use TypeScript 7 for typecheck and build; the root pins `typescript ~6.0.3` only because `typescript-eslint` rejects 7 (peer range `<6.1.0`). Do not "fix" this by unifying versions or overriding peers. See [ADR 0002](docs/adr/0002-typescript-7-with-ts6-for-eslint.md). Check which copy runs with `npx tsc -v` inside a workspace.
- **Build the schema first.** A fresh checkout fails api/web typecheck and tests until `npm run build:schema` has produced `packages/schema/dist`.
- **`allowScripts`** in the root `package.json` lists the dependencies allowed to run install scripts (`esbuild`, `better-sqlite3`). The entries are pinned to versions; a version bump shows up as unreviewed. Use `npm approve-scripts <pkg>`.
- **Do not bulk-reformat unrelated files.** The repo is Prettier-clean, so format only what you change (`npx prettier --write <files>`).
- ESLint is syntax-based, not type-aware, so it never needs TypeScript 7's compiler API.
- `README.md` is partly stale: it still mentions `backend/` and `frontend/` directories (now `apps/api` and `apps/web`) and an older CI description. Fix it when touching the README, but it is not a source of truth for layout.

## Architecture decisions

Significant decisions are recorded as ADRs in [docs/adr/](docs/adr/README.md) (MADR style, copy `0000-template.md`). Add a new numbered ADR when you make or reverse a decision that affects structure, tooling or conventions, and never rewrite an accepted ADR: supersede it with a new one.
