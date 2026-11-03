import type { ValidationIssue } from '@expensetracker/schema';

/**
 * The first issue message per form field. The field is the top-level segment of the issue path,
 * optionally renamed (`amountCents` -> `amount`); `''` holds issues about the whole request.
 */
export function issuesToFieldErrors(
  issues: ValidationIssue[],
  rename: Record<string, string> = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const top = issue.path.split('.')[0] ?? '';
    const field = rename[top] ?? top;
    errors[field] ??= issue.message;
  }
  return errors;
}
