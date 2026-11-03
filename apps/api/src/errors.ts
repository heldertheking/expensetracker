import type { ApiErrorCode, ValidationIssue } from '@expensetracker/schema';

/**
 * A failure the client caused, thrown anywhere below the routes and turned into an
 * `ApiErrorSchema` response by the error middleware.
 */
class ApiFailure extends Error {
  readonly code: ApiErrorCode;
  readonly issues: ValidationIssue[];
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    issues: ValidationIssue[] = [],
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
    this.issues = issues;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  too_many_requests: 429,
  internal_error: 500,
};

const invalid = (issues: ValidationIssue[], message = 'Request validation failed') =>
  new ApiFailure('validation_error', message, issues);

const unauthorized = (message = 'Authentication is required') =>
  new ApiFailure('unauthorized', message);

const forbidden = (message = 'Forbidden') => new ApiFailure('forbidden', message);

const notFound = (entity: string, id: string) =>
  new ApiFailure('not_found', `${entity} ${id} was not found`);

const conflict = (message: string, issues: ValidationIssue[] = []) =>
  new ApiFailure('conflict', message, issues);

const unprocessable = (message: string, issues: ValidationIssue[] = []) =>
  new ApiFailure('unprocessable', message, issues);

const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  new ApiFailure('too_many_requests', message, [], retryAfterSeconds);

export {
  ApiFailure,
  conflict,
  forbidden,
  invalid,
  notFound,
  STATUS_BY_CODE,
  tooManyRequests,
  unauthorized,
  unprocessable,
};
