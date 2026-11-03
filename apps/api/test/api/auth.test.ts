import { ApiErrorSchema, SessionResponse } from '@expensetracker/schema';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE_NAME } from '../../src/auth/session-service.js';
import { createUserRepository } from '../../src/repositories/user-repository.js';
import { DEFAULT_ORIGIN, setupApi, transactionBody } from './helpers.js';

function extractCookieToken(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
  const match = new RegExp(`${SESSION_COOKIE_NAME}=([^;]*)`).exec(header);
  return match?.[1] ?? '';
}

describe('authentication and session lifecycle', () => {
  it('registers a new user, sets a hardened __Host-session cookie and never returns passwordHash', async () => {
    const { rawApi } = setupApi();

    const res = await rawApi.post('/api/auth/register').set('Origin', DEFAULT_ORIGIN).send({
      email: '  Ada@Example.com ',
      displayName: '  Ada Lovelace ',
      password: 'correct-horse-battery',
    });

    expect(res.status).toBe(201);
    const parsed = SessionResponse.parse(res.body);
    expect(parsed.user).toMatchObject({
      email: 'ada@example.com',
      displayName: 'Ada Lovelace',
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(JSON.stringify(res.body)).not.toContain('scrypt');

    const setCookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie[0]! : setCookie!;
    expect(cookieStr).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toContain('Secure');
    expect(cookieStr).toContain('SameSite=Strict');
    expect(cookieStr).toContain('Path=/');

    const token = extractCookieToken(setCookie);
    const me = await rawApi.get('/api/auth/me').set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);
    expect(me.status).toBe(200);
    expect(SessionResponse.parse(me.body).user.id).toBe(parsed.user.id);
  });

  it('rejects duplicate email registration (case-insensitive) with 409 conflict', async () => {
    const { rawApi } = setupApi();
    await rawApi.post('/api/auth/register').set('Origin', DEFAULT_ORIGIN).send({
      email: 'ada@example.com',
      displayName: 'Ada',
      password: 'correct-horse-battery',
    });

    const dup = await rawApi.post('/api/auth/register').set('Origin', DEFAULT_ORIGIN).send({
      email: 'ADA@EXAMPLE.COM',
      displayName: 'Ada 2',
      password: 'another-valid-password',
    });

    expect(dup.status).toBe(409);
    expect(ApiErrorSchema.parse(dup.body).error).toMatchObject({
      code: 'conflict',
      issues: [{ path: 'email' }],
    });
  });

  it('logs in with valid credentials, rotates any previous session token and logs out cleanly', async () => {
    const { rawApi } = setupApi();

    const reg = await rawApi.post('/api/auth/register').set('Origin', DEFAULT_ORIGIN).send({
      email: 'grace@example.com',
      displayName: 'Grace Hopper',
      password: 'compile-all-the-things',
    });
    const firstToken = extractCookieToken(reg.headers['set-cookie']);

    const login = await rawApi
      .post('/api/auth/login')
      .set('Origin', DEFAULT_ORIGIN)
      .set('Cookie', `${SESSION_COOKIE_NAME}=${firstToken}`)
      .send({
        email: 'GRACE@example.com',
        password: 'compile-all-the-things',
      });
    expect(login.status).toBe(200);
    const secondToken = extractCookieToken(login.headers['set-cookie']);
    expect(secondToken).not.toBe(firstToken);

    // Previous session token was revoked on rotation
    const oldMe = await rawApi
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${firstToken}`);
    expect(oldMe.status).toBe(401);

    // New session token works
    const newMe = await rawApi
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${secondToken}`);
    expect(newMe.status).toBe(200);

    // Logout revokes the session and clears the cookie
    const logout = await rawApi
      .post('/api/auth/logout')
      .set('Origin', DEFAULT_ORIGIN)
      .set('Cookie', `${SESSION_COOKIE_NAME}=${secondToken}`);
    expect(logout.status).toBe(204);
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0');

    const afterLogout = await rawApi
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${secondToken}`);
    expect(afterLogout.status).toBe(401);
  });

  it('returns the exact same 401 unauthorized response for unknown email and wrong password', async () => {
    const { rawApi } = setupApi();
    await rawApi.post('/api/auth/register').set('Origin', DEFAULT_ORIGIN).send({
      email: 'known@example.com',
      displayName: 'Known',
      password: 'correct-horse-battery',
    });

    const unknownRes = await rawApi
      .post('/api/auth/login')
      .set('Origin', DEFAULT_ORIGIN)
      .send({ email: 'unknown@example.com', password: 'wrong-password-123' });

    const wrongPassRes = await rawApi
      .post('/api/auth/login')
      .set('Origin', DEFAULT_ORIGIN)
      .send({ email: 'known@example.com', password: 'wrong-password-123' });

    expect(unknownRes.status).toBe(401);
    expect(wrongPassRes.status).toBe(401);
    expect(unknownRes.body).toEqual(wrongPassRes.body);
    expect(ApiErrorSchema.parse(unknownRes.body).error).toEqual({
      code: 'unauthorized',
      message: 'Invalid email or password',
      issues: [],
    });
  });

  it('upgrades an outdated password hash on successful login when scrypt parameters change', async () => {
    const { db, rawApi } = setupApi({ scryptParams: { N: 2048, r: 8, p: 1 } });
    const users = createUserRepository(db);

    // Register with N=1024 on a separate app sharing the same DB, then log in on the N=2048 app
    const { rawApi: oldCostApi } = setupApi({ db, scryptParams: { N: 1024, r: 8, p: 1 } });
    await oldCostApi.post('/api/auth/register').set('Origin', DEFAULT_ORIGIN).send({
      email: 'upgrade@example.com',
      displayName: 'Upgrade',
      password: 'upgrade-this-password',
    });
    expect(users.findByEmail('upgrade@example.com')?.passwordHash).toMatch(/^scrypt\$1024\$/);

    const login = await rawApi.post('/api/auth/login').set('Origin', DEFAULT_ORIGIN).send({
      email: 'upgrade@example.com',
      password: 'upgrade-this-password',
    });
    expect(login.status).toBe(200);
    expect(users.findByEmail('upgrade@example.com')?.passwordHash).toMatch(/^scrypt\$2048\$/);
  });

  it('rate-limits repeated failed logins for the same email with 429 and Retry-After', async () => {
    const { rawApi } = setupApi();
    await rawApi.post('/api/auth/register').set('Origin', DEFAULT_ORIGIN).send({
      email: 'target@example.com',
      displayName: 'Target',
      password: 'correct-horse-battery',
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await rawApi
        .post('/api/auth/login')
        .set('Origin', DEFAULT_ORIGIN)
        .send({ email: 'target@example.com', password: 'wrong-password-123' });
      expect(res.status).toBe(401);
    }

    const blocked = await rawApi
      .post('/api/auth/login')
      .set('Origin', DEFAULT_ORIGIN)
      .send({ email: 'target@example.com', password: 'correct-horse-battery' });

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(ApiErrorSchema.parse(blocked.body).error.code).toBe('too_many_requests');
  });
});

describe('CSRF Origin check, security headers and unauthenticated route protection', () => {
  it('rejects state-changing requests without an allowed Origin or Referer with 403 forbidden', async () => {
    const { rawApi } = setupApi();

    const noOrigin = await rawApi.post('/api/projects').send({ name: 'Holiday' });
    expect(noOrigin.status).toBe(403);
    expect(ApiErrorSchema.parse(noOrigin.body).error.code).toBe('forbidden');

    const evilOrigin = await rawApi
      .post('/api/projects')
      .set('Origin', 'https://evil.example.com')
      .send({ name: 'Holiday' });
    expect(evilOrigin.status).toBe(403);

    // Allowed Referer fallback works when Origin is omitted (passes CSRF, then hits 401 auth)
    const refererFallback = await rawApi
      .post('/api/projects')
      .set('Referer', 'http://localhost:5173/projects')
      .send({ name: 'Holiday' });
    expect(refererFallback.status).toBe(401);
  });

  it('sets defensive security headers and omits X-Powered-By', async () => {
    const { rawApi } = setupApi({ isProduction: true });

    const res = await rawApi.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  });

  it.each([
    ['GET', '/api/auth/me'],
    ['GET', '/api/accounts'],
    ['GET', '/api/stats'],
    ['GET', '/api/events'],
    ['GET', '/api/projects'],
    ['POST', '/api/projects'],
    ['GET', '/api/projects/00000000-0000-4000-8000-000000000001'],
    ['PATCH', '/api/projects/00000000-0000-4000-8000-000000000001'],
    ['DELETE', '/api/projects/00000000-0000-4000-8000-000000000001'],
    ['GET', '/api/transactions'],
    ['POST', '/api/transactions'],
    ['GET', '/api/transactions/00000000-0000-4000-8000-000000000001'],
    ['PATCH', '/api/transactions/00000000-0000-4000-8000-000000000001'],
    ['DELETE', '/api/transactions/00000000-0000-4000-8000-000000000001'],
  ])('returns 401 unauthorized for unauthenticated %s %s', async (method, path) => {
    const { rawApi } = setupApi();
    const m = method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
    const req = rawApi[m](path).set('Origin', DEFAULT_ORIGIN);
    const res = m === 'post' || m === 'patch' ? await req.send(transactionBody()) : await req;

    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('unauthorized');
  });
});
