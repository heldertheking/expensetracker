import { describe, expect, it } from 'vitest';
import {
  createPasswordHasher,
  DEFAULT_SCRYPT_PARAMS,
  parsePasswordHash,
} from '../../src/auth/password.js';

/** Cheap parameters keep the unit tests fast; production uses `DEFAULT_SCRYPT_PARAMS`. */
const CHEAP = { N: 2 ** 10, r: 8, p: 1 };
const hasher = createPasswordHasher(CHEAP);

describe('DEFAULT_SCRYPT_PARAMS', () => {
  it('meets the OWASP minimum for scrypt (N=2^17, r=8, p=1)', () => {
    expect(DEFAULT_SCRYPT_PARAMS).toEqual({ N: 2 ** 17, r: 8, p: 1 });
  });
});

describe('hash', () => {
  it('stores the parameters, a 16-byte salt and a 64-byte key', async () => {
    const stored = await hasher.hash('correct horse battery');

    expect(stored).toMatch(/^scrypt\$1024\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/);
    expect(stored).not.toContain('correct horse battery');
  });

  it('uses a fresh salt every time, so equal passwords give different hashes', async () => {
    const [a, b] = await Promise.all([hasher.hash('same password'), hasher.hash('same password')]);

    expect(a).not.toBe(b);
    expect(parsePasswordHash(a)!.salt.equals(parsePasswordHash(b)!.salt)).toBe(false);
  });

  it('does not block the event loop while hashing', async () => {
    let ticked = false;
    const pending = hasher.hash('correct horse battery').then(() => ticked);
    setImmediate(() => (ticked = true));

    expect(await pending).toBe(true);
  });
});

describe('verify', () => {
  it('accepts the right password', async () => {
    const stored = await hasher.hash('correct horse battery');

    expect(await hasher.verify('correct horse battery', stored)).toEqual({
      ok: true,
      needsRehash: false,
    });
  });

  it('rejects a wrong password, also one that differs only in case or by a space', async () => {
    const stored = await hasher.hash('correct horse battery');

    for (const wrong of [
      'wrong horse battery',
      'Correct horse battery',
      'correct horse battery ',
    ]) {
      expect((await hasher.verify(wrong, stored)).ok).toBe(false);
    }
  });

  it('treats Unicode compositions of the same password as equal (NFKC)', async () => {
    const stored = await hasher.hash('café au lait 1234');

    expect((await hasher.verify('café au lait 1234', stored)).ok).toBe(true);
  });

  it('rejects a tampered hash instead of throwing', async () => {
    const stored = await hasher.hash('correct horse battery');
    const parts = stored.split('$');
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    const tampered = [
      [...parts.slice(0, 5), flip(parts[5]!)].join('$'), // other key
      [...parts.slice(0, 4), flip(parts[4]!), parts[5]].join('$'), // other salt
      stored.replace('scrypt$', 'bcrypt$'),
      stored.replace('$1024$', '$1000$'), // N not a power of two
      stored.replace('$1024$', `$${2 ** 25}$`), // cost beyond the allowed bound
      stored.slice(0, -10), // truncated key
      '!',
      '',
    ];

    for (const hash of tampered) {
      expect(await hasher.verify('correct horse battery', hash)).toEqual({
        ok: false,
        needsRehash: false,
      });
    }
  });

  it('verifies an old hash with its own parameters and asks for a rehash', async () => {
    const older = createPasswordHasher({ N: 2 ** 9, r: 8, p: 1 });
    const stored = await older.hash('correct horse battery');

    expect(await hasher.verify('correct horse battery', stored)).toEqual({
      ok: true,
      needsRehash: true,
    });
    expect(await hasher.verify('wrong horse battery', stored)).toEqual({
      ok: false,
      needsRehash: false,
    });
  });
});

describe('verifyDummy', () => {
  it('does the same work as a real verification and always fails', async () => {
    expect(await hasher.verifyDummy('anything at all')).toEqual({ ok: false, needsRehash: false });
  });
});

describe('parsePasswordHash', () => {
  it('reads the parameters back', async () => {
    const parsed = parsePasswordHash(await hasher.hash('correct horse battery'));

    expect(parsed).toMatchObject({ N: 1024, r: 8, p: 1 });
    expect(parsed!.salt).toHaveLength(16);
    expect(parsed!.key).toHaveLength(64);
  });

  it('returns undefined for anything malformed', () => {
    expect(parsePasswordHash('scrypt$x$8$1$a$b')).toBeUndefined();
    expect(parsePasswordHash('scrypt$1024$0$1$a$b')).toBeUndefined();
  });
});

describe('createPasswordHasher', () => {
  it('refuses parameters outside the supported bounds', () => {
    expect(() => createPasswordHasher({ N: 1000, r: 8, p: 1 })).toThrow(/power of two/);
    expect(() => createPasswordHasher({ N: 2 ** 10, r: 0, p: 1 })).toThrow(/r/);
  });
});
