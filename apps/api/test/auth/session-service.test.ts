import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { parseAllowedOrigins } from '../../src/auth/security.js';
import {
  clearSessionCookieHeader,
  createSessionService,
  extractSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieHeader,
} from '../../src/auth/session-service.js';
import { hashToken } from '../../src/auth/token.js';
import { openDatabase } from '../../src/db/database.js';
import { createSessionRepository } from '../../src/repositories/session-repository.js';
import { createUserRepository } from '../../src/repositories/user-repository.js';
import { uuid } from '../fixtures.js';

describe('cookie and origin helpers', () => {
  it('extracts __Host-session from a Cookie header', () => {
    expect(extractSessionToken(undefined)).toBeUndefined();
    expect(extractSessionToken('')).toBeUndefined();
    expect(extractSessionToken('theme=dark; malformed')).toBeUndefined();
    expect(extractSessionToken(`other=1; ${SESSION_COOKIE_NAME}=abc123; theme=dark`)).toBe(
      'abc123',
    );
  });

  it('formats hardened Set-Cookie headers for issue and logout', () => {
    expect(sessionCookieHeader('tok', 3600)).toBe(
      '__Host-session=tok; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600',
    );
    expect(clearSessionCookieHeader()).toBe(
      '__Host-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    );
  });

  it('parses comma-separated allowed origins or falls back to defaults', () => {
    expect(parseAllowedOrigins(undefined)).toContain('http://localhost:5173');
    expect(parseAllowedOrigins('   ')).toContain('http://localhost:5173');
    expect(parseAllowedOrigins('https://a.example.com, https://b.example.com ')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });
});

describe('createSessionService', () => {
  let db: Database;
  let now: Date;

  beforeEach(() => {
    db = openDatabase();
    now = new Date('2026-11-03T10:00:00.000Z');
  });

  afterEach(() => db.close());

  function setup() {
    const users = createUserRepository(db);
    const sessions = createSessionRepository(db);
    const user = users.insert({
      id: uuid(1),
      email: 'alice@example.com',
      displayName: 'Alice',
      passwordHash: 'scrypt$1024$8$1$aaaa$bbbb',
      createdAt: now,
      updatedAt: now,
    });
    const service = createSessionService({
      sessions,
      users,
      clock: () => now,
      idleTimeoutMs: 30 * 60 * 1000,
      absoluteTimeoutMs: 2 * 60 * 60 * 1000,
      touchIntervalMs: 60 * 1000,
    });
    return { users, sessions, user, service };
  }

  it('issues a session, stores only the token hash, and authenticates the token', () => {
    const { sessions, user, service } = setup();

    const issued = service.issue(user);
    expect(sessions.findByTokenHash(issued.token)).toBeUndefined();
    expect(sessions.findByTokenHash(hashToken(issued.token))?.userId).toBe(user.id);

    const auth = service.authenticate(issued.token);
    expect(auth?.user).toEqual(user);
    expect(auth?.idleExpiresAt).toEqual(new Date('2026-11-03T10:30:00.000Z'));
    expect(auth?.expiresAt).toEqual(new Date('2026-11-03T12:00:00.000Z'));
  });

  it('rotates an existing session when previousToken is provided', () => {
    const { user, service } = setup();

    const first = service.issue(user);
    const second = service.issue(user, first.token);

    expect(service.authenticate(first.token)).toBeUndefined();
    expect(service.authenticate(second.token)?.user.id).toBe(user.id);
  });

  it('throttles last_seen_at updates until touchIntervalMs has elapsed', () => {
    const { sessions, user, service } = setup();
    const { token } = service.issue(user);

    now = new Date('2026-11-03T10:00:30.000Z');
    service.authenticate(token);
    expect(sessions.findByTokenHash(hashToken(token))?.lastSeenAt).toEqual(
      new Date('2026-11-03T10:00:00.000Z'),
    );

    now = new Date('2026-11-03T10:01:05.000Z');
    const refreshed = service.authenticate(token);
    expect(sessions.findByTokenHash(hashToken(token))?.lastSeenAt).toEqual(now);
    expect(refreshed?.idleExpiresAt).toEqual(new Date('2026-11-03T10:31:05.000Z'));
  });

  it('expires a session after the idle timeout and deletes the row', () => {
    const { sessions, user, service } = setup();
    const { token } = service.issue(user);

    now = new Date('2026-11-03T10:30:00.000Z');
    expect(service.authenticate(token)).toBeUndefined();
    expect(sessions.findByTokenHash(hashToken(token))).toBeUndefined();
  });

  it('expires a session at the absolute timeout even when kept active', () => {
    const { user, service } = setup();
    const { token } = service.issue(user);

    for (const minute of [20, 40, 60, 80, 100]) {
      now = new Date(Date.UTC(2026, 10, 3, 10, minute, 0));
      expect(service.authenticate(token)).toBeDefined();
    }

    now = new Date('2026-11-03T12:00:00.000Z');
    expect(service.authenticate(token)).toBeUndefined();
  });

  it('rejects missing, malformed or unknown tokens and cleans up sessions of deleted users', () => {
    const { sessions, user, service } = setup();
    expect(service.authenticate(undefined)).toBeUndefined();
    expect(service.authenticate('not-a-valid-token')).toBeUndefined();
    expect(service.authenticate('z'.repeat(43))).toBeUndefined();

    const { token } = service.issue(user);
    // Simulate a session pointing to a user that does not exist
    const orphanHash = hashToken('y'.repeat(43));
    db.pragma('foreign_keys = OFF');
    sessions.insert({
      tokenHash: orphanHash,
      userId: uuid(999),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date('2026-11-03T12:00:00.000Z'),
    });
    db.pragma('foreign_keys = ON');
    expect(service.authenticate('y'.repeat(43))).toBeUndefined();
    expect(sessions.findByTokenHash(orphanHash)).toBeUndefined();

    service.revokeAllForUser(user.id);
    expect(service.authenticate(token)).toBeUndefined();
  });
});
