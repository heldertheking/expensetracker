# 0004. Path-filtered CI pipeline

- Status: accepted
- Date: 2026-10-21

## Context

CI should show a clear pipeline in GitHub, avoid building untouched parts, and not run twice for the same commit. The original `ci.yml` was an unfinished draft.

## Decision

`.github/workflows/ci.yml` runs this shape:

`changes` -> `build schema` -> `build api` | `build web` -> `test api` | `test web` (unit tests plus a `test:e2e` step if the workspace defines one) -> `validate` -> `deploy`

- `changes` uses `dorny/paths-filter`. API-only changes skip web, web-only changes skip api, `packages/schema/**` or root config changes run everything, and changes only to `README.md` or `docs/**` skip everything. Release tags build everything.
- `build schema` runs when api or web runs and uploads `dist` as an artifact that later jobs download.
- `validate` runs after the tests over the whole repository whatever changed: typecheck, ESLint, Prettier (`FORMAT_BLOCKING: 'true'`), and a report with coverage per app. It is skipped when nothing code-related changed.
- `deploy` only logs a warning for now and runs for tags `vX.Y.Z` or `vX.Y.Z-ALPHA` whose commit is on `main`.
- Triggers: pushes to `main` and release tags, plus pull requests. Branch pushes are covered by their PR, so a push to an open PR runs once.
- Shared setup (Node from `.nvmrc`, `npm ci`) lives in `.github/actions/setup`.

## Options considered

- Push on every branch plus pull requests: ran everything twice for PR branches. Rejected.
- Build everything every time: simpler but wasteful.
- A matrix over api and web: shorter file, but a less readable graph than separate jobs.

## Consequences

- Fast feedback and a readable job graph; skipped jobs do not fail the run.
- Branches without a PR get no CI.
- The path filters must be updated when new directories or shared root files are added.
- Deploy is a placeholder and needs real steps before use.
