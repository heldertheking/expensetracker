# Server-side cookie sessions, scrypt password hashing and SQL-level user ownership

- **Status:** accepted
- **Date:** 2026-11-03

## Context and Problem Statement

The expense tracker stores personal financial records (accounts, transactions, project budgets and activity events). Multiple users must be able to register, sign in and manage their own data without any user being able to read or mutate another user's records (IDOR prevention). Authentication must use zero external auth libraries, rely on Node's built-in `node:crypto`, and follow OWASP Password Storage, Session Management and CSRF Cheat Sheet recommendations.

## Decision Drivers

- **No password material leaks:** `UserSchema` must never contain `passwordHash`, and login errors must not reveal whether an email address is registered.
- **Database leak resilience:** A leaked `sessions` table must not contain raw tokens that a client can replay.
- **No token in `localStorage`:** Session tokens must not be readable by JavaScript in the browser.
- **SQL-level tenant isolation:** Every query and mutation on `projects`, `transactions` and `events` must scope by `user_id` at the SQL level.

## Decision Outcome

1. **Password hashing (`apps/api/src/auth/password.ts`):**
   - Passwords are normalised with `NFKC` (NIST SP 800-63B), capped at 12–128 characters, and hashed asynchronously on the libuv thread pool using `crypto.scrypt` with a 16-byte random salt and 64-byte derived key (`N = 2^17`, `r = 8`, `p = 1`, ~128 MiB per hash, stored as `scrypt$N$r$p$salt$key`).
   - Verification uses `crypto.timingSafeEqual`. Unknown emails run `verifyDummy` against a random hash so unknown-email and wrong-password paths do the same scrypt work and return the identical `401 unauthorized` (`Invalid email or password`) response.
2. **Server-side sessions (`apps/api/src/auth/token.ts`, `apps/api/src/auth/session-service.ts`):**
   - Session tokens are 32 random bytes (`base64url`, 43 chars) sent only in the `__Host-session` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/`).
   - The `sessions` table stores only `token_hash = SHA-256(token)` (64 hex chars), `user_id`, `created_at`, `last_seen_at` and `expires_at`.
   - Sessions enforce both a 30-minute idle timeout (`last_seen_at`, throttled to 1-minute writes) and a 7-day absolute timeout (`expires_at`). Logging in or registering rotates any previous cookie session to prevent session fixation.
3. **CSRF, rate limiting and defensive headers (`apps/api/src/auth/security.ts`, `apps/api/src/auth/rate-limiter.ts`):**
   - State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) under `/api` require an `Origin` (or `Referer` origin fallback) matching `allowedOrigins`, returning `403 forbidden` otherwise.
   - Sliding-window rate limiters guard login (5 failed attempts / 15 min per email, 20 / 15 min per IP) and registration (10 / 15 min per IP), returning `429 too_many_requests` with `Retry-After`.
4. **Multi-user SQL ownership (`0004-create-users.ts`, `0005-create-sessions.ts`, `0006-add-user-ownership.ts`):**
   - `projects`, `transactions` and `events` carry `user_id NOT NULL REFERENCES users(id)`. Project names are unique per user (`UNIQUE (user_id, name_key)`), and composite foreign keys ensure a transaction can only tag a project owned by the same user (`FOREIGN KEY (project_id, user_id) REFERENCES projects (id, user_id)`).
   - Every repository method, read service and event bus dispatch takes `userId` as its first parameter.
