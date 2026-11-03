import { describe, expect, it } from 'vitest';
import {
  Email,
  LoginRequest,
  Password,
  PASSWORD_MAX,
  PASSWORD_MIN,
  RegisterRequest,
  SessionResponse,
  UserResponse,
  UserSchema,
} from '../src/index.js';

const now = '2026-06-15T12:00:00.000Z';

const user = {
  id: '3f2b8c1e-5a47-4d1b-9c63-0e8d2f6a7b10',
  email: 'alex@example.com',
  displayName: 'Alex',
  createdAt: now,
  updatedAt: now,
};

const registration = {
  email: 'alex@example.com',
  displayName: 'Alex',
  password: 'correct horse battery',
};

describe('Email', () => {
  it('trims and lowercases, so one address is one account', () => {
    expect(Email.parse('  Alex@Example.COM ')).toBe('alex@example.com');
  });

  it.each(['', 'alex', 'alex@', '@example.com', 'alex @example.com'])('rejects %j', (value) => {
    expect(Email.safeParse(value).success).toBe(false);
  });

  it('rejects an address longer than 254 characters', () => {
    expect(Email.safeParse(`${'a'.repeat(64)}@${'b'.repeat(186)}.com`).success).toBe(false);
  });
});

describe('Password', () => {
  it(`accepts ${PASSWORD_MIN} to ${PASSWORD_MAX} characters without composition rules`, () => {
    expect(Password.safeParse('a'.repeat(PASSWORD_MIN)).success).toBe(true);
    expect(Password.safeParse('a'.repeat(PASSWORD_MAX)).success).toBe(true);
  });

  it('rejects one character too few or too many', () => {
    expect(Password.safeParse('a'.repeat(PASSWORD_MIN - 1)).success).toBe(false);
    expect(Password.safeParse('a'.repeat(PASSWORD_MAX + 1)).success).toBe(false);
  });

  it('counts Unicode code points, not UTF-16 units', () => {
    // 12 emoji are 24 UTF-16 units but 12 characters.
    expect(Password.safeParse('😀'.repeat(PASSWORD_MIN)).success).toBe(true);
    expect(Password.safeParse('😀'.repeat(PASSWORD_MAX + 1)).success).toBe(false);
  });

  it('keeps spaces and does not trim', () => {
    expect(Password.parse('  spaces count  ')).toBe('  spaces count  ');
  });
});

describe('RegisterRequest', () => {
  it('accepts email, display name and password and normalises the email', () => {
    expect(RegisterRequest.parse({ ...registration, email: ' Alex@Example.com' })).toEqual(
      registration,
    );
  });

  it('rejects a password that is the email address', () => {
    const result = RegisterRequest.safeParse({
      ...registration,
      password: 'ALEX@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['password']);
  });

  it('rejects unknown fields, so no one can register with an id or a role', () => {
    expect(RegisterRequest.safeParse({ ...registration, role: 'admin' }).success).toBe(false);
    expect(RegisterRequest.safeParse({ ...registration, id: user.id }).success).toBe(false);
  });

  it('requires a display name', () => {
    expect(RegisterRequest.safeParse({ ...registration, displayName: '  ' }).success).toBe(false);
  });
});

describe('LoginRequest', () => {
  it('accepts a short password, so a wrong one is not told apart by the policy', () => {
    expect(LoginRequest.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true);
  });

  it('rejects an empty or overlong password and unknown fields', () => {
    const email = 'a@example.com';
    expect(LoginRequest.safeParse({ email, password: '' }).success).toBe(false);
    expect(LoginRequest.safeParse({ email, password: 'a'.repeat(129) }).success).toBe(false);
    expect(LoginRequest.safeParse({ email, password: 'x', remember: true }).success).toBe(false);
  });
});

describe('UserResponse', () => {
  it('drops a password hash or any other field that is not part of the contract', () => {
    const parsed = UserResponse.parse({ ...user, passwordHash: 'scrypt$1$2$3$4$5' });

    expect(parsed).not.toHaveProperty('passwordHash');
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(UserSchema.shape).sort());
  });
});

describe('SessionResponse', () => {
  it('accepts the user with both expiry times', () => {
    const session = { user, expiresAt: '2026-06-22T12:00:00.000Z', idleExpiresAt: now };
    expect(SessionResponse.parse(session).expiresAt).toBeInstanceOf(Date);
  });

  it('rejects an idle expiry after the absolute one', () => {
    const session = { user, expiresAt: now, idleExpiresAt: '2026-06-15T12:30:00.000Z' };
    expect(SessionResponse.safeParse(session).success).toBe(false);
  });

  it('never carries the token', () => {
    const session = { user, expiresAt: now, idleExpiresAt: now, token: 'secret' };
    expect(SessionResponse.parse(session)).not.toHaveProperty('token');
  });
});
