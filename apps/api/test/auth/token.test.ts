import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashToken, isWellFormedToken, newSessionToken } from '../../src/auth/token.js';

describe('newSessionToken', () => {
  it('is 32 random bytes in base64url (43 characters, 256 bits)', () => {
    const token = newSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 1000 }, newSessionToken));

    expect(tokens.size).toBe(1000);
  });
});

describe('hashToken', () => {
  it('is the SHA-256 of the token in hex, so the database never holds the token', () => {
    const token = newSessionToken();

    expect(hashToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hashToken(token)).not.toContain(token);
  });
});

describe('isWellFormedToken', () => {
  it('accepts only the shape newSessionToken produces', () => {
    expect(isWellFormedToken(newSessionToken())).toBe(true);
    expect(isWellFormedToken('')).toBe(false);
    expect(isWellFormedToken('a'.repeat(42))).toBe(false);
    expect(isWellFormedToken('a'.repeat(44))).toBe(false);
    expect(isWellFormedToken(`${'a'.repeat(42)}=`)).toBe(false);
    expect(isWellFormedToken(`${'a'.repeat(42)};`)).toBe(false);
  });
});
