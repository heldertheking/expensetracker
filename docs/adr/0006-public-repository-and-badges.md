# 0006. Public repository and badges via shields endpoint JSON

- Status: accepted
- Date: 2026-10-21

## Context

We want coverage and validation results visible as badges in the README. The repository was private, where `raw.githubusercontent.com` URLs and shields.io cannot read files. CodeQL and secret scanning are also free for public repositories.

## Decision

The repository is public (after a scan of the tracked files and history for secrets). On pushes to `main`, the `validate` job writes shields.io endpoint JSON files (coverage for api and web, ESLint, Prettier, typecheck) and publishes them to a `badges` branch. The README can reference them with `https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/heldertheking/expensetracker/badges/<name>.json`. A coverage badge is only updated when that app's tests ran. The run summary also gets a validation report table.

## Options considered

- Self-generated SVG badges on a branch: works in private repositories but needs an SVG generator in CI.
- A gist with a token secret: extra secret to manage.
- Third-party coverage services: another account and integration.

## Consequences

- No external service or secret is needed.
- Everything in the repository is public, so secrets must never be committed ([0005](0005-security-tooling.md)).
- The `badges` branch only exists after the first push to `main`, and CI needs `contents: write` in the validate job.
