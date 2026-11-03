import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { apiError, toValidationIssues } from '@expensetracker/schema';
import type { z } from 'zod';
import { ApiFailure, invalid, STATUS_BY_CODE } from '../errors.js';

/** Parses request input with a schema; a failure becomes a 400 `validation_error`. */
function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw invalid(toValidationIssues(result.error));
  return result.data;
}

/** Builds the response body with its schema, so nothing outside the contract is ever sent. */
function sendParsed<T extends z.ZodType>(
  res: Response,
  status: number,
  schema: T,
  body: z.input<T>,
): void {
  res.status(status).json(schema.parse(body));
}

/** Any request under `/api` that no route matched. */
const unknownRoute: RequestHandler = (req, res) => {
  res
    .status(404)
    .json(apiError('not_found', `no route for ${req.method} ${req.baseUrl}${req.path}`));
};

/** Body-parser errors carry an HTTP status and a `type`. */
interface HttpError {
  status?: number;
  type?: string;
  message?: string;
}

const isHttpError = (error: unknown): error is HttpError =>
  typeof error === 'object' && error !== null && 'status' in error;

/**
 * Turns every error into an `ApiErrorSchema` body: domain failures by their code, malformed or
 * unacceptable bodies as `validation_error` with the parser's status, anything else as 500.
 */
function errorHandler(log: (message: string, error: unknown) => void): ErrorRequestHandler {
  return (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof ApiFailure) {
      res
        .status(STATUS_BY_CODE[error.code])
        .json(apiError(error.code, error.message, error.issues));
      return;
    }
    if (isHttpError(error) && error.status !== undefined && error.status < 500) {
      const message =
        error.type === 'entity.parse.failed'
          ? 'request body is not valid JSON'
          : (error.message ?? 'invalid request');
      res.status(error.status).json(apiError('validation_error', message));
      return;
    }
    log('unexpected error', error);
    res
      .status(500)
      .json({ error: { code: 'internal_error', message: 'internal server error', issues: [] } });
  };
}

export { errorHandler, parseInput, sendParsed, unknownRoute };
