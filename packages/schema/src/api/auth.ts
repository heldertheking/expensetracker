import { z } from 'zod';
import { Timestamp } from '../domain/timestamp.js';
import {
  codePoints,
  DisplayName,
  Email,
  Password,
  PASSWORD_MAX,
  UserSchema,
} from '../domain/user.js';

/** `POST /api/auth/register`. The password may not be the email address itself. */
const RegisterRequest = z
  .strictObject({
    email: Email,
    displayName: DisplayName,
    password: Password,
  })
  .refine((r) => r.password.trim().toLowerCase() !== r.email, {
    error: 'password must not be the email address',
    path: ['password'],
  });
type RegisterRequest = z.infer<typeof RegisterRequest>;

/**
 * `POST /api/auth/login`. The password is only bounded, not checked against the policy: the
 * answer for a wrong password must not depend on whether it would be a valid new password.
 */
const LoginRequest = z.strictObject({
  email: Email,
  password: z
    .string()
    .min(1, { error: 'password is required' })
    .refine((value) => codePoints(value) <= PASSWORD_MAX, {
      error: `password must be at most ${PASSWORD_MAX} characters`,
    }),
});
type LoginRequest = z.infer<typeof LoginRequest>;

const UserResponse = UserSchema;
type UserResponse = z.infer<typeof UserResponse>;

/**
 * The signed-in user and when the session ends: `idleExpiresAt` moves forward with every
 * request, `expiresAt` is the absolute end. The session token itself is only ever sent in the
 * HttpOnly cookie, never in a body.
 */
const SessionResponse = z
  .object({
    user: UserSchema,
    expiresAt: Timestamp,
    idleExpiresAt: Timestamp,
  })
  .refine((s) => s.idleExpiresAt.getTime() <= s.expiresAt.getTime(), {
    error: 'idleExpiresAt must not be after expiresAt',
    path: ['idleExpiresAt'],
  });
type SessionResponse = z.infer<typeof SessionResponse>;

export { LoginRequest, RegisterRequest, SessionResponse, UserResponse };
