# 0005. Security tooling

- Status: accepted
- Date: 2026-10-21

## Context

We want to be told before merging if a PR leaks a secret or introduces a vulnerable dependency, and to avoid API keys leaking by accident.

## Decision

- `.github/workflows/security.yml` runs on PRs to `main`, pushes to `main`, and weekly, without path filtering (a key in a README is still a leak). Jobs: gitleaks over the full history, dependency review (PRs only, fails on high severity), `npm audit --audit-level=high`, and CodeQL for JavaScript and TypeScript.
- GitHub secret scanning, push protection and Dependabot security updates are enabled on the repository.
- `.githooks/pre-commit` runs `gitleaks git --pre-commit --staged`, wired up by the root `prepare` script (`core.hooksPath`). It warns and skips when gitleaks is not installed.

## Options considered

- Only the GitHub built-ins: no history scan and no PR feedback from our own rules.
- Making the hook mandatory: would block contributors who have not installed gitleaks; CI still scans.
- `gitleaks-action` needs a license for organization-owned repositories; this one is user-owned.

## Consequences

- PRs show security results before merge, but the checks only warn unless they are made required through branch protection on `main`.
- The weekly run catches new advisories.
- Some noise is possible from `npm audit` and CodeQL.
