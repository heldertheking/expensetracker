import type { SessionResponse, User } from '@expensetracker/schema';
import type { SessionRepository } from '../repositories/session-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';
import { hashToken, isWellFormedToken, newSessionToken } from './token.js';

const SESSION_COOKIE_NAME = '__Host-session';
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_TOUCH_MS = 60 * 1000; // throttle last_seen_at writes to at most once per minute

/** Extracts the `__Host-session` cookie value from a raw `Cookie` header. */
function extractSessionToken(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined || cookieHeader.length === 0) return undefined;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    return part.slice(eq + 1).trim();
  }
  return undefined;
}

function sessionCookieHeader(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

interface SessionServiceOptions {
  sessions: SessionRepository;
  users: Pick<UserRepository, 'findById'>;
  clock: () => Date;
  generateToken?: () => string;
  idleTimeoutMs?: number;
  absoluteTimeoutMs?: number;
  touchIntervalMs?: number;
}

interface IssuedSession {
  token: string;
  session: SessionResponse;
  maxAgeSeconds: number;
}

/**
 * Manages server-side cookie sessions with idle and absolute lifetimes, token rotation on
 * login/register, and throttled `last_seen_at` updates.
 */
function createSessionService(options: SessionServiceOptions) {
  const { sessions, users, clock } = options;
  const generateToken = options.generateToken ?? newSessionToken;
  const idleTimeoutMs = options.idleTimeoutMs ?? SESSION_IDLE_MS;
  const absoluteTimeoutMs = options.absoluteTimeoutMs ?? SESSION_ABSOLUTE_MS;
  const touchIntervalMs = options.touchIntervalMs ?? SESSION_TOUCH_MS;

  return {
    /**
     * Issues a fresh session for `user`. If `previousToken` was sent on the request, its
     * stored session is revoked first to prevent session fixation.
     */
    issue(user: User, previousToken?: string): IssuedSession {
      const now = clock();
      if (previousToken !== undefined && isWellFormedToken(previousToken)) {
        sessions.deleteByTokenHash(hashToken(previousToken));
      }
      sessions.deleteExpired(now, new Date(now.getTime() - idleTimeoutMs));

      const token = generateToken();
      const expiresAt = new Date(now.getTime() + absoluteTimeoutMs);
      const idleExpiresAt = new Date(Math.min(expiresAt.getTime(), now.getTime() + idleTimeoutMs));
      sessions.insert({
        tokenHash: hashToken(token),
        userId: user.id,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
      });

      return {
        token,
        session: { user, expiresAt, idleExpiresAt },
        maxAgeSeconds: Math.floor(absoluteTimeoutMs / 1000),
      };
    },

    /**
     * Validates a raw session token from the cookie. Returns `undefined` when missing,
     * malformed, unknown, expired (idle or absolute), or when its user no longer exists.
     */
    authenticate(token: string | undefined): SessionResponse | undefined {
      if (token === undefined || !isWellFormedToken(token)) return undefined;
      const tokenHash = hashToken(token);
      const record = sessions.findByTokenHash(tokenHash);
      if (record === undefined) return undefined;

      const now = clock();
      const idleLimit = new Date(record.lastSeenAt.getTime() + idleTimeoutMs);
      if (now >= record.expiresAt || now >= idleLimit) {
        sessions.deleteByTokenHash(tokenHash);
        return undefined;
      }

      const user = users.findById(record.userId);
      if (user === undefined) {
        sessions.deleteByTokenHash(tokenHash);
        return undefined;
      }

      let effectiveLastSeen = record.lastSeenAt;
      if (now.getTime() - record.lastSeenAt.getTime() >= touchIntervalMs) {
        sessions.touchLastSeen(tokenHash, now);
        effectiveLastSeen = now;
      }

      const idleExpiresAt = new Date(
        Math.min(record.expiresAt.getTime(), effectiveLastSeen.getTime() + idleTimeoutMs),
      );
      return { user, expiresAt: record.expiresAt, idleExpiresAt };
    },

    /** Deletes the session matching `token` if well-formed. */
    revoke(token: string | undefined): void {
      if (token !== undefined && isWellFormedToken(token)) {
        sessions.deleteByTokenHash(hashToken(token));
      }
    },

    /** Deletes all sessions of a user (e.g. on credential change). */
    revokeAllForUser(userId: string): void {
      sessions.deleteByUserId(userId);
    },
  };
}

type SessionService = ReturnType<typeof createSessionService>;

export {
  clearSessionCookieHeader,
  createSessionService,
  extractSessionToken,
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_MS,
  SESSION_TOUCH_MS,
  sessionCookieHeader,
};
export type { IssuedSession, SessionService, SessionServiceOptions };
