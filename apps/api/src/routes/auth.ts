import { Router } from 'express';
import type { Request } from 'express';
import { LoginRequest, RegisterRequest, SessionResponse } from '@expensetracker/schema';
import type { PasswordHasher } from '../auth/password.js';
import type { RateLimiter } from '../auth/rate-limiter.js';
import { authenticatedSession, requireAuth } from '../auth/security.js';
import {
  clearSessionCookieHeader,
  extractSessionToken,
  sessionCookieHeader,
} from '../auth/session-service.js';
import type { SessionService } from '../auth/session-service.js';
import { conflict, tooManyRequests, unauthorized } from '../errors.js';
import type { UserRepository } from '../repositories/user-repository.js';
import { parseInput, sendParsed } from './http.js';

interface AuthRouterDeps {
  users: UserRepository;
  sessions: SessionService;
  hasher: PasswordHasher;
  loginEmailLimiter: RateLimiter;
  loginIpLimiter: RateLimiter;
  registerIpLimiter: RateLimiter;
  clock: () => Date;
  newId: () => string;
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function assertNotRateLimited(retryAfterSeconds: number, message: string): void {
  if (retryAfterSeconds > 0) {
    throw tooManyRequests(message, retryAfterSeconds);
  }
}

/**
 * `/api/auth`: registration, login, logout and current session (`GET /api/auth/me`).
 */
function authRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const ip = clientIp(req);
    assertNotRateLimited(
      deps.registerIpLimiter.retryAfterSeconds(ip),
      'Too many registration attempts; please try again later',
    );
    const body = parseInput(RegisterRequest, req.body);
    deps.registerIpLimiter.hit(ip);

    if (deps.users.findByEmail(body.email) !== undefined) {
      throw conflict('An account with this email already exists', [
        { path: 'email', message: 'email is already registered' },
      ]);
    }

    const passwordHash = await deps.hasher.hash(body.password);
    // Re-check after async scrypt in case a concurrent registration used the same email.
    if (deps.users.findByEmail(body.email) !== undefined) {
      throw conflict('An account with this email already exists', [
        { path: 'email', message: 'email is already registered' },
      ]);
    }

    const now = deps.clock();
    const user = deps.users.insert({
      id: deps.newId(),
      email: body.email,
      displayName: body.displayName,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    const previousToken = extractSessionToken(req.get('cookie'));
    const issued = deps.sessions.issue(user, previousToken);
    res.setHeader('Set-Cookie', sessionCookieHeader(issued.token, issued.maxAgeSeconds));
    sendParsed(res, 201, SessionResponse, issued.session);
  });

  router.post('/login', async (req, res) => {
    const ip = clientIp(req);
    const body = parseInput(LoginRequest, req.body);
    const emailKey = body.email;

    const retryAfter = Math.max(
      deps.loginEmailLimiter.retryAfterSeconds(emailKey),
      deps.loginIpLimiter.retryAfterSeconds(ip),
    );
    assertNotRateLimited(retryAfter, 'Too many login attempts; please try again later');

    deps.loginEmailLimiter.hit(emailKey);
    deps.loginIpLimiter.hit(ip);

    const found = deps.users.findByEmail(body.email);
    if (found === undefined) {
      await deps.hasher.verifyDummy(body.password);
      throw unauthorized('Invalid email or password');
    }

    const verification = await deps.hasher.verify(body.password, found.passwordHash);
    if (!verification.ok) {
      throw unauthorized('Invalid email or password');
    }

    deps.loginEmailLimiter.forgive(emailKey);
    deps.loginIpLimiter.forgive(ip);

    if (verification.needsRehash) {
      const upgradedHash = await deps.hasher.hash(body.password);
      deps.users.updatePasswordHash(found.user.id, upgradedHash, deps.clock());
    }

    const previousToken = extractSessionToken(req.get('cookie'));
    const issued = deps.sessions.issue(found.user, previousToken);
    res.setHeader('Set-Cookie', sessionCookieHeader(issued.token, issued.maxAgeSeconds));
    sendParsed(res, 200, SessionResponse, issued.session);
  });

  router.post('/logout', (req, res) => {
    deps.sessions.revoke(extractSessionToken(req.get('cookie')));
    res.setHeader('Set-Cookie', clearSessionCookieHeader());
    res.status(204).end();
  });

  router.get('/me', requireAuth(deps.sessions), (req, res) => {
    sendParsed(res, 200, SessionResponse, authenticatedSession(req));
  });

  return router;
}

export { authRouter };
export type { AuthRouterDeps };
