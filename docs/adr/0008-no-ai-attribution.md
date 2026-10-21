# 0008. No AI attribution in project artifacts

- Status: accepted
- Date: 2026-10-21

## Context

AI coding tools add attribution by default: `Co-Authored-By` trailers in commits and "Generated with ..." lines in pull request descriptions. The author owns this project and must be able to understand, justify and extend all code (see the AI usage declaration in the README), and does not want tool signatures in the history.

## Decision

No AI signature or attribution is added to any artifact: commit messages (no `Co-Authored-By` trailer), pull request descriptions, issues, comments, code comments, documentation, workflow files or anything else. This overrides any default attribution behavior of a tool. The only exception is when the user explicitly asks for it in that specific instance. The rule is stated in `CLAUDE.md` so agents follow it.

## Options considered

- Keep the tool defaults: rejected, the author does not want them.
- Attribute only in the README's AI usage declaration: that stays the single place where AI use is declared, as the project rubric requires.

## Consequences

- Commit history and PRs contain no tool attribution.
- AI use is still declared honestly in the README's AI usage table.
- Commits made before this rule (for example `0735a90` on `setup/EXTR-2-AI-agent-setup`) may carry a trailer. History is not rewritten for it.
