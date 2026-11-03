import type { Database } from 'better-sqlite3';
import { UserSchema } from '@expensetracker/schema';
import type { User } from '@expensetracker/schema';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

interface NewUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserCredentials {
  user: User;
  passwordHash: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toUser = (row: UserRow): User =>
  UserSchema.parse({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

/**
 * SQL access to the `users` table. `User` responses are parsed with `UserSchema` so
 * `password_hash` can never leak into a domain or API object.
 */
function createUserRepository(db: Database) {
  const selectById = db.prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?');
  const selectByEmail = db.prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?');
  const insert = db.prepare<[UserRow]>(
    `INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
     VALUES (@id, @email, @display_name, @password_hash, @created_at, @updated_at)`,
  );
  const updateHash = db.prepare<[{ id: string; password_hash: string; updated_at: string }]>(
    'UPDATE users SET password_hash = @password_hash, updated_at = @updated_at WHERE id = @id',
  );
  const count = db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users');

  return {
    findById: (id: string): User | undefined => {
      const row = selectById.get(id);
      return row && toUser(row);
    },
    /** Looks up a user by normalised email, including the stored `passwordHash` for verification. */
    findByEmail: (email: string): UserCredentials | undefined => {
      const row = selectByEmail.get(normalizeEmail(email));
      return row && { user: toUser(row), passwordHash: row.password_hash };
    },
    insert: (user: NewUser): User => {
      const row: UserRow = {
        id: user.id,
        email: normalizeEmail(user.email),
        display_name: user.displayName,
        password_hash: user.passwordHash,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      };
      insert.run(row);
      return toUser(row);
    },
    updatePasswordHash: (id: string, passwordHash: string, updatedAt: Date): void => {
      updateHash.run({
        id,
        password_hash: passwordHash,
        updated_at: updatedAt.toISOString(),
      });
    },
    count: (): number => count.get()!.n,
  };
}

type UserRepository = ReturnType<typeof createUserRepository>;

export { createUserRepository, normalizeEmail };
export type { NewUser, UserCredentials, UserRepository };
