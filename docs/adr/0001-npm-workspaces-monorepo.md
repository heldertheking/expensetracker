# 0001. npm workspaces monorepo

- Status: accepted
- Date: 2026-10-21

## Context

The project started with separate `backend/` and `frontend/` directories. Both sides need the same API types, and CI should build and test each part independently.

## Decision

Use a single npm workspaces monorepo with `apps/*` (`apps/api`, `apps/web`) and `packages/*` (`packages/schema`). Root scripts orchestrate the workspaces (`build:schema`, `dev`, `test`).

## Options considered

- Separate directories without workspaces: no shared package, types would be duplicated.
- A monorepo tool (Turborepo, Nx): more power than this project needs; npm workspaces are enough and add no tooling.

## Consequences

- One lockfile and one `npm install`.
- Shared code lives in `packages/schema` and is consumed by both apps.
- CI path filters can map directories to jobs ([0004](0004-path-filtered-ci-pipeline.md)).
- The README still describes the old `backend/` and `frontend/` layout and needs updating.
