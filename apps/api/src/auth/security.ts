import type { Request, RequestHandler } from 'express';
import type { SessionResponse } from '@expensetracker/schema';
import { forbidden, unauthorized } from '../errors.js';
import { extractSessionToken } from './session-service.js';
import type { SessionService } from './session-service.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
] as const;

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parseAllowedOrigins(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.trim().length === 0) return DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function originFromReferer(referer: string | undefined): string | undefined {
  if (referer === undefined) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * Sets defensive HTTP headers on every API response:
 * - `X-Content-Type-Options: nosniff`
 * - `Referrer-Policy: no-referrer`
 * - `Cross-Origin-Opener-Policy: same-origin`
 * - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
 * - `Cache-Control: no-store`
 * - `Strict-Transport-Security` in production
 */
function securityHeaders(isProduction = process.env.NODE_ENV === 'production'): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

/**
 * Rejects state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) whose `Origin` (or
 * `Referer` origin fallback) is missing or not in `allowedOrigins` (OWASP CSRF Defense in Depth).
 */
function csrfOriginCheck(
  allowedOrigins: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }
    const origin = req.get('origin') ?? originFromReferer(req.get('referer'));
    if (origin === undefined || !allowed.has(origin)) {
      throw forbidden('Cross-origin write request rejected');
    }
    next();
  };
}

interface AuthenticatedRequest extends Request {
  auth?: SessionResponse;
}

/** Requires a valid `__Host-session` cookie and attaches `req.auth`. */
function requireAuth(sessions: SessionService): RequestHandler {
  return (req: AuthenticatedRequest, _res, next) => {
    const token = extractSessionToken(req.get('cookie'));
    const session = sessions.authenticate(token);
    if (session === undefined) {
      throw unauthorized('Authentication is required');
    }
    req.auth = session;
    next();
  };
}

/** Returns the authenticated user (`SessionResponse`) from `req`, or throws 401 if not authenticated. */
function authenticatedSession(req: Request): SessionResponse {
  const session = (req as AuthenticatedRequest).auth;
  if (session === undefined) {
    throw unauthorized('Authentication is required');
  }
  return session;
}

/** Returns the authenticated user's id from `req`, or throws 401 if not authenticated. */
function authenticatedUserId(req: Request): string {
  return authenticatedSession(req).user.id;
}

export {
  authenticatedSession,
  authenticatedUserId,
  csrfOriginCheck,
  DEFAULT_ALLOWED_ORIGINS,
  parseAllowedOrigins,
  requireAuth,
  securityHeaders,
};
