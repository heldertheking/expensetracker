import type { ApiErrorCode, ValidationIssue } from '@expensetracker/schema';

/**
 * A failure the client caused, thrown anywhere below the routes and turned into an
 * `ApiErrorSchema` response by the error middleware.
 */
class ApiFailure extends Error {
  readonly code: ApiErrorCode;
  readonly issues: ValidationIssue[];

  constructor(code: ApiErrorCode, message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
    this.issues = issues;
  }
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  validation_error: 400,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
};

const invalid = (issues: ValidationIssue[], message = 'Request validation failed') =>
  new ApiFailure('validation_error', message, issues);

const notFound = (entity: string, id: string) =>
  new ApiFailure('not_found', `${entity} ${id} was not found`);

const conflict = (message: string, issues: ValidationIssue[] = []) =>
  new ApiFailure('conflict', message, issues);

const unprocessable = (message: string, issues: ValidationIssue[] = []) =>
  new ApiFailure('unprocessable', message, issues);

export { ApiFailure, conflict, invalid, notFound, STATUS_BY_CODE, unprocessable };
