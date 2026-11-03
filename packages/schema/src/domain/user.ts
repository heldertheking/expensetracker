import { z } from 'zod';
import { Id } from './id.js';
import { text } from './text.js';
import { Timestamp } from './timestamp.js';

const EMAIL_MAX = 254; // RFC 5321 path limit
const DISPLAY_NAME_MAX = 80;

/**
 * Password length per NIST SP 800-63B: at least 12 and at most 128 characters, counted as
 * Unicode code points, with no composition rules. The upper bound caps the hashing work a
 * request can cause.
 */
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

/** Number of Unicode code points, so an emoji counts as one character as NIST asks. */
const codePoints = (value: string) => Array.from(value).length;

/**
 * An email address, normalised: surrounding whitespace removed and lowercased, so
 * `Alex@Example.com ` and `alex@example.com` are the same account.
 */
const Email = z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX));

const DisplayName = text(DISPLAY_NAME_MAX);

/** A new password. Never trimmed or otherwise changed: every character counts. */
const Password = z
  .string()
  .refine((value) => codePoints(value) >= PASSWORD_MIN, {
    error: `password must be at least ${PASSWORD_MIN} characters`,
  })
  .refine((value) => codePoints(value) <= PASSWORD_MAX, {
    error: `password must be at most ${PASSWORD_MAX} characters`,
  });

/**
 * An account. The password hash is not part of the domain object, so it can never end up in a
 * response or an event: responses are built with this schema, which drops unknown keys.
 */
const UserSchema = z.object({
  id: Id,
  email: Email,
  displayName: DisplayName,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
type User = z.infer<typeof UserSchema>;

export {
  codePoints,
  DISPLAY_NAME_MAX,
  DisplayName,
  Email,
  EMAIL_MAX,
  Password,
  PASSWORD_MAX,
  PASSWORD_MIN,
  UserSchema,
};
export type { User };
