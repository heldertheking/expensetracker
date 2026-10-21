import { z } from 'zod';

const ValidationIssueSchema = z.object({
  path: z.string(), // dotted path of the offending field, empty for the whole request
  message: z.string(),
});
type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/** `unprocessable` is a business rule failure, `validation_error` a malformed request. */
const ApiErrorCode = z.enum(['validation_error', 'not_found', 'conflict', 'unprocessable']);
type ApiErrorCode = z.infer<typeof ApiErrorCode>;

const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    issues: z.array(ValidationIssueSchema),
  }),
});
type ApiError = z.infer<typeof ApiErrorSchema>;

function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

function apiError(code: ApiErrorCode, message: string, issues: ValidationIssue[] = []): ApiError {
  return { error: { code, message, issues } };
}

export { ApiErrorCode, ApiErrorSchema, ValidationIssueSchema, apiError, toValidationIssues };
export type { ApiError, ValidationIssue };
