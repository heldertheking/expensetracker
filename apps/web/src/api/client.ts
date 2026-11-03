import { ApiErrorSchema } from '@expensetracker/schema';
import type { ApiErrorCode, ValidationIssue } from '@expensetracker/schema';
import { issuesToFieldErrors } from '../lib/issues';

/** Anything with a zod-like `parse`, so the client does not depend on zod itself. */
export interface Parser<T> {
  parse(data: unknown): T;
}

/** `network` = no response at all, `unknown` = an error body that does not match the contract. */
export type ClientErrorCode = ApiErrorCode | 'network' | 'unknown';

/** A request that failed: carries the HTTP status, the error code and per-field issues. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly issues: ValidationIssue[];

  constructor(status: number, code: ClientErrorCode, message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** Issue messages keyed by form field (see `issuesToFieldErrors`); `''` is request-wide. */
  fieldErrors(rename: Record<string, string> = {}): Record<string, string> {
    return issuesToFieldErrors(this.issues, rename);
  }
}

/** A response with a success status whose body violates the shared schema. */
export class ContractError extends Error {
  readonly path: string;

  constructor(path: string, cause: unknown) {
    super(`The server sent an unexpected response for ${path}`, { cause });
    this.name = 'ContractError';
    this.path = path;
  }
}

export type QueryValue = string | number | undefined | null;

export function withQuery(path: string, query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function toRequestError(response: Response): Promise<ApiRequestError> {
  const body = await readJson(response);
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success) {
    const { code, message, issues } = parsed.data.error;
    return new ApiRequestError(response.status, code, message, issues);
  }
  return new ApiRequestError(
    response.status,
    'unknown',
    `Request failed with status ${response.status}`,
    [],
  );
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const init: RequestInit = { method: options.method ?? 'GET', signal: options.signal };
  if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(0, 'network', 'The server could not be reached', []);
  }
  if (!response.ok) throw await toRequestError(response);
  return response;
}

/** Sends a request and parses the JSON body with `schema`, so callers only see valid data. */
export async function request<T>(
  schema: Parser<T>,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await send(path, options);
  const body = await readJson(response);
  try {
    return schema.parse(body);
  } catch (error) {
    throw new ContractError(path, error);
  }
}

/** For endpoints that answer 204 without a body. */
export async function requestNoContent(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options);
}

/** A message for any error the client can throw, for error states in the UI. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError || error instanceof ContractError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
