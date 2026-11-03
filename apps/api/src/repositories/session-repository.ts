import type { Database } from 'better-sqlite3';

interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

interface SessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

const toSession = (row: SessionRow): SessionRecord => ({
  tokenHash: row.token_hash,
  userId: row.user_id,
  createdAt: new Date(row.created_at),
  lastSeenAt: new Date(row.last_seen_at),
  expiresAt: new Date(row.expires_at),
});

/**
 * SQL access to the `sessions` table. Only SHA-256 token digests (`token_hash`) are stored.
 */
function createSessionRepository(db: Database) {
  const insert = db.prepare<[SessionRow]>(
    `INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at)
     VALUES (@token_hash, @user_id, @created_at, @last_seen_at, @expires_at)`,
  );
  const selectByHash = db.prepare<[string], SessionRow>(
    'SELECT * FROM sessions WHERE token_hash = ?',
  );
  const touchLastSeen = db.prepare<[{ token_hash: string; last_seen_at: string }]>(
    'UPDATE sessions SET last_seen_at = @last_seen_at WHERE token_hash = @token_hash',
  );
  const deleteByHash = db.prepare<[string]>('DELETE FROM sessions WHERE token_hash = ?');
  const deleteByUser = db.prepare<[string]>('DELETE FROM sessions WHERE user_id = ?');
  const deleteExpired = db.prepare<[{ now: string; idleCutoff: string }]>(
    'DELETE FROM sessions WHERE expires_at <= @now OR last_seen_at <= @idleCutoff',
  );

  return {
    insert: (session: SessionRecord): void => {
      insert.run({
        token_hash: session.tokenHash,
        user_id: session.userId,
        created_at: session.createdAt.toISOString(),
        last_seen_at: session.lastSeenAt.toISOString(),
        expires_at: session.expiresAt.toISOString(),
      });
    },
    findByTokenHash: (tokenHash: string): SessionRecord | undefined => {
      const row = selectByHash.get(tokenHash);
      return row && toSession(row);
    },
    touchLastSeen: (tokenHash: string, lastSeenAt: Date): void => {
      touchLastSeen.run({
        token_hash: tokenHash,
        last_seen_at: lastSeenAt.toISOString(),
      });
    },
    deleteByTokenHash: (tokenHash: string): void => {
      deleteByHash.run(tokenHash);
    },
    deleteByUserId: (userId: string): void => {
      deleteByUser.run(userId);
    },
    deleteExpired: (now: Date, idleCutoff: Date): number =>
      deleteExpired.run({
        now: now.toISOString(),
        idleCutoff: idleCutoff.toISOString(),
      }).changes,
  };
}

type SessionRepository = ReturnType<typeof createSessionRepository>;

export { createSessionRepository };
export type { SessionRecord, SessionRepository };
