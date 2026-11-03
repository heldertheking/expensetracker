import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/; // 32 bytes in base64url without padding

/** A new session token: 256 bits from the CSPRNG, base64url. Only ever sent in the cookie. */
const newSessionToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

/**
 * What the database stores instead of the token. A plain SHA-256 is enough: the token has 256
 * bits of entropy, so it cannot be guessed from the hash, and a leaked database holds no usable
 * session.
 */
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Rejects anything that cannot be a token before it reaches the database. */
const isWellFormedToken = (value: string): boolean => TOKEN_FORMAT.test(value);

export { hashToken, isWellFormedToken, newSessionToken };
