import { z } from 'zod';

const ValidationIssueSchema = z.object({
  path: z.string(), // dotted path of the offending field, empty for the whole request
  message: z.string(),
});
type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * `unprocessable` is a business rule failure, `validation_error` a malformed request,
 * `internal_error` an unexpected server failure (500) whose details stay in the server log.
 * `unauthorized` (401) means no valid session or wrong credentials, `forbidden` (403) a request
 * the server refuses outright (e.g. from a foreign origin), `too_many_requests` (429) a rate
 * limit, sent with a `Retry-After` header.
 */
const ApiErrorCode = z.enum([
  'validation_error',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'unprocessable',
  'too_many_requests',
  'internal_error',
]);
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
