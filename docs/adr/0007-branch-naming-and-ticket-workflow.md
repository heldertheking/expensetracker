# 0007. Branch naming and ticket workflow

- Status: accepted
- Date: 2026-10-21

## Context

Branches and PRs need a predictable name that links back to a ticket, so humans and AI agents can tell what a branch is for. Creating the branch by hand from each ticket is error prone.

## Decision

Every branch is named `<type>/EXTR-<ticket number>-<ticket-title-slug>`, with `type` one of `feature`, `hotfix`, `setup` or `release`, matching the regex `^(feature|hotfix|setup|release)/EXTR-[0-9]+-[A-Za-z0-9-]+$`. The slug may contain uppercase letters, so existing names such as `setup/EXTR-2-AI-agent-setup` are valid; the ticket workflow itself generates lowercase slugs.

- Tickets are GitHub issues created from the forms in `.github/ISSUE_TEMPLATE/` (`feature`, `hotfix`, `setup`, `release`; blank issues are disabled). Each form applies the label of its type.
- `.github/workflows/ticket-branch.yml` runs when an issue is opened. It reads the type from the label, builds `<type>/EXTR-<issue number>-<slug>` (title lowercased, non-alphanumerics to `-`, trimmed, at most 50 characters), creates the branch from the default branch through the REST API, and comments on the issue with the branch name and a `git fetch && git switch` command. Without a type label it only comments.
- `.github/workflows/branch-name.yml` runs on pull requests and fails when the head branch does not match the regex. `dependabot/*` branches are skipped.
- The four labels must exist before the forms can apply them. They are created once with the `gh label create` commands documented in `CLAUDE.md`.

## Options considered

- Free-form branch names: no link to tickets, inconsistent.
- Creating the branch by hand or with the "Create a branch" button: the button's naming is not configurable.
- A third-party action for branch creation: unnecessary, the REST API is enough.

## Consequences

- The issue number is the ticket number. EXTR-1 and EXTR-2 predate this workflow, and pull request #1 already took number 1, so those numbers may not line up with issue numbers.
- The EXTR-1 pull request is #2 (pull request #1 was closed by a branch rename) from branch `setup/EXTR-1-basic-setup-and-implementation`.
- Ticket titles should be short, since the slug is cut at 50 characters.
- The PR check only warns unless it is made required through branch protection on `main`.
- Branches created by the workflow are pushed under the repository token, so they do not trigger CI until they have a PR.
