# 0002. TypeScript 7 everywhere, TypeScript 6 only for ESLint

- Status: accepted
- Date: 2026-10-21

## Context

The goal is the newest TypeScript in every part of the project. TypeScript 7 is the native compiler port. `typescript-eslint` (8.72.x, including the canary) declares the peer dependency `typescript: ">=4.8.4 <6.1.0"`, so installing TypeScript 7 at the root failed with `ERESOLVE`. The peer cap protects a real incompatibility: `typescript-eslint` parses through the old JavaScript compiler API.

## Decision

Each workspace (`apps/api`, `apps/web`, `packages/schema`) depends on `typescript ^7.0.2` and uses it for typecheck and build. The root `package.json` pins `typescript ~6.0.3` and `typescript-eslint ^8.72.0` (stable), used only by ESLint. npm installs the TypeScript 7 copy inside each workspace, so `tsc` there is version 7.

## Options considered

- Override the peer dependency (`overrides` or `legacy-peer-deps`): satisfies npm but not the code, and risks crashes or wrong lint results. Rejected.
- Replace typescript-eslint with Biome or oxlint: removes the conflict but replaces the lint setup and loses rules; type-aware linting is limited there. Rejected for now.
- Pin TypeScript 6 everywhere: simplest and most stable, but against the goal. Kept only as a fallback.

## Consequences

- Compilation, typechecking and emitted output use TypeScript 7.
- ESLint uses only syntax-based rules. Type-aware rules would take type information from TypeScript 6, which could differ from TypeScript 7 diagnostics.
- Two TypeScript versions are installed; `npm ls typescript` shows which copy each part resolves.
- TypeScript 7 changed some defaults, for example `rootDir` must be set explicitly in `packages/schema/tsconfig.build.json`.
- Revisit when `typescript-eslint` supports TypeScript 7: drop the TypeScript 6 pin and this split, and supersede this ADR.
