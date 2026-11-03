import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

/** scrypt cost: CPU/memory cost `N` (a power of two), block size `r`, parallelism `p`. */
interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** OWASP Password Storage Cheat Sheet minimum for scrypt: about 128 MiB per hash. */
const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Upper bounds for parameters, so a tampered or corrupt hash in the database cannot make one
 * login burn gigabytes of memory.
 */
const MAX = { N: 2 ** 20, r: 32, p: 16 };

interface ParsedHash extends ScryptParams {
  salt: Buffer;
  key: Buffer;
}

interface VerifyResult {
  ok: boolean;
  /** The hash was made with other parameters than the current ones: store a new one. */
  needsRehash: boolean;
}

const FAILED: VerifyResult = { ok: false, needsRehash: false };

const HASH_FORMAT = /^scrypt\$(\d{1,8})\$(\d{1,3})\$(\d{1,3})\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function paramsProblem({ N, r, p }: ScryptParams): string | undefined {
  if (!Number.isInteger(N) || N < 2 || N > MAX.N || (N & (N - 1)) !== 0) {
    return `N must be a power of two between 2 and ${MAX.N}`;
  }
  if (!Number.isInteger(r) || r < 1 || r > MAX.r) return `r must be between 1 and ${MAX.r}`;
  if (!Number.isInteger(p) || p < 1 || p > MAX.p) return `p must be between 1 and ${MAX.p}`;
  return undefined;
}

/**
 * Reads `scrypt$N$r$p$salt$key` (salt and key in base64url). Anything malformed, or with
 * parameters outside the bounds, gives `undefined`.
 */
function parsePasswordHash(stored: string): ParsedHash | undefined {
  const match = HASH_FORMAT.exec(stored);
  if (match === null) return undefined;
  const [, n, r, p, salt, key] = match;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (paramsProblem(params) !== undefined) return undefined;
  const parsed = {
    ...params,
    salt: Buffer.from(salt!, 'base64url'),
    key: Buffer.from(key!, 'base64url'),
  };
  if (parsed.salt.length !== SALT_BYTES || parsed.key.length !== KEY_BYTES) return undefined;
  return parsed;
}

/** scrypt on the libuv thread pool, so hashing never blocks the event loop. */
function derive(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  // scrypt needs 128 * N * r bytes; allow twice that so Node's default limit (32 MiB) is no cap.
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r + 1024 * 1024 };
  // NFKC so the same password typed as composed or decomposed Unicode matches (NIST 800-63B).
  const input = Buffer.from(password.normalize('NFKC'), 'utf8');
  return new Promise((resolve, reject) => {
    scrypt(input, salt, KEY_BYTES, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

const format = ({ N, r, p }: ScryptParams, salt: Buffer, key: Buffer) =>
  `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;

/**
 * Hashes and verifies passwords with scrypt and a random 16-byte salt per hash. The parameters
 * are stored with each hash, so they can be raised later: old hashes still verify and are
 * reported as `needsRehash`.
 */
function createPasswordHasher(params: ScryptParams = DEFAULT_SCRYPT_PARAMS) {
  const problem = paramsProblem(params);
  if (problem !== undefined) throw new Error(`invalid scrypt parameters: ${problem}`);

  let dummy: Promise<string> | undefined;
  const dummyHash = () => (dummy ??= hash(randomBytes(32).toString('base64url')));

  async function hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    return format(params, salt, await derive(password, salt, params));
  }

  async function verify(password: string, stored: string): Promise<VerifyResult> {
    const parsed = parsePasswordHash(stored);
    if (parsed === undefined) {
      // Unusable hash (e.g. an account that cannot log in): spend the same time anyway.
      await verifyDummy(password);
      return FAILED;
    }
    const key = await derive(password, parsed.salt, parsed);
    if (!timingSafeEqual(key, parsed.key)) return FAILED;
    const outdated = parsed.N !== params.N || parsed.r !== params.r || parsed.p !== params.p;
    return { ok: true, needsRehash: outdated };
  }

  /**
   * Verifies against a hash of a random password, which never matches. Used when the account
   * does not exist, so an unknown email costs as much time as a wrong password.
   */
  async function verifyDummy(password: string): Promise<VerifyResult> {
    await verify(password, await dummyHash());
    return FAILED;
  }

  return { hash, verify, verifyDummy };
}

type PasswordHasher = ReturnType<typeof createPasswordHasher>;

export { createPasswordHasher, DEFAULT_SCRYPT_PARAMS, parsePasswordHash };
export type { PasswordHasher, ScryptParams, VerifyResult };
