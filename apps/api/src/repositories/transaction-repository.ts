import type { Database } from 'better-sqlite3';
import type { Account, Transaction, TransactionType } from '@expensetracker/schema';

interface TransactionRow {
  id: string;
  user_id: string;
  account: Account;
  type: TransactionType;
  amount_cents: number;
  date: string;
  description: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  account: row.account,
  type: row.type,
  amountCents: row.amount_cents,
  date: row.date,
  description: row.description,
  projectId: row.project_id,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const toRow = (userId: string, transaction: Transaction): TransactionRow => ({
  id: transaction.id,
  user_id: userId,
  account: transaction.account,
  type: transaction.type,
  amount_cents: transaction.amountCents,
  date: transaction.date,
  description: transaction.description,
  project_id: transaction.projectId,
  created_at: transaction.createdAt.toISOString(),
  updated_at: transaction.updatedAt.toISOString(),
});

/** Filters and page of `GET /api/transactions`; dates are inclusive. */
interface TransactionFilter {
  account?: Account;
  projectId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

interface TransactionPage {
  items: Transaction[];
  total: number;
}

/** Sum of the amounts of one account and type. */
interface AccountTypeTotal {
  account: Account;
  type: TransactionType;
  totalCents: number;
}

/** Sum of the amounts of one project tag and type. */
interface ProjectTypeTotal {
  projectId: string;
  type: TransactionType;
  totalCents: number;
}

/** Sum of the amounts of one month (`YYYY-MM`), account and type. */
interface MonthlyTotal extends AccountTypeTotal {
  month: string;
}

/** Expenses of one project tag; `projectId` and `name` are null for untagged expenses. */
interface ProjectExpenseTotal {
  projectId: string | null;
  name: string | null;
  expenseCents: number;
}

function whereClause(userId: string, filter: Omit<TransactionFilter, 'limit' | 'offset'>) {
  const conditions: string[] = ['user_id = @userId'];
  const params: Record<string, string> = { userId };
  if (filter.account !== undefined) {
    conditions.push('account = @account');
    params.account = filter.account;
  }
  if (filter.projectId !== undefined) {
    conditions.push('project_id = @projectId');
    params.projectId = filter.projectId;
  }
  if (filter.type !== undefined) {
    conditions.push('type = @type');
    params.type = filter.type;
  }
  if (filter.from !== undefined) {
    conditions.push('date >= @from');
    params.from = filter.from;
  }
  if (filter.to !== undefined) {
    conditions.push('date <= @to');
    params.to = filter.to;
  }
  return { sql: `WHERE ${conditions.join(' AND ')}`, params };
}

/**
 * SQL access to the `transactions` table, including the sums the read services build on.
 * Every statement scopes rows to `user_id`.
 */
function createTransactionRepository(db: Database) {
  const selectById = db.prepare<[string, string], TransactionRow>(
    'SELECT * FROM transactions WHERE user_id = ? AND id = ?',
  );
  const insert = db.prepare<[TransactionRow]>(
    `INSERT INTO transactions
       (id, user_id, account, type, amount_cents, date, description, project_id, created_at, updated_at)
     VALUES
       (@id, @user_id, @account, @type, @amount_cents, @date, @description, @project_id, @created_at, @updated_at)`,
  );
  const update = db.prepare<[TransactionRow]>(
    `UPDATE transactions
     SET type = @type, amount_cents = @amount_cents, date = @date, description = @description,
         project_id = @project_id, updated_at = @updated_at
     WHERE user_id = @user_id AND id = @id`,
  );
  const remove = db.prepare<[string, string]>(
    'DELETE FROM transactions WHERE user_id = ? AND id = ?',
  );
  const countByProject = db.prepare<[string, string], { n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE user_id = ? AND project_id = ?',
  );
  const count = db.prepare<[string], { n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?',
  );
  const totalsByAccount = db.prepare<[string], AccountTypeTotal>(
    `SELECT account, type, SUM(amount_cents) AS totalCents
     FROM transactions WHERE user_id = ? GROUP BY account, type ORDER BY account, type`,
  );
  const totalsByProject = db.prepare<[string], ProjectTypeTotal>(
    `SELECT project_id AS projectId, type, SUM(amount_cents) AS totalCents
     FROM transactions WHERE user_id = ? AND project_id IS NOT NULL
     GROUP BY project_id, type ORDER BY project_id, type`,
  );
  const monthlyTotals = db.prepare<[string, string], MonthlyTotal>(
    `SELECT substr(date, 1, 7) AS month, account, type, SUM(amount_cents) AS totalCents
     FROM transactions WHERE user_id = ? AND date <= ?
     GROUP BY month, account, type ORDER BY month, account, type`,
  );
  const expenseByProject = db.prepare<[string, string, string], ProjectExpenseTotal>(
    `SELECT t.project_id AS projectId, p.name AS name, SUM(t.amount_cents) AS expenseCents
     FROM transactions t LEFT JOIN projects p ON p.id = t.project_id AND p.user_id = t.user_id
     WHERE t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ?
     GROUP BY t.project_id ORDER BY expenseCents DESC, p.name`,
  );

  return {
    findById: (userId: string, id: string): Transaction | undefined => {
      const row = selectById.get(userId, id);
      return row && toTransaction(row);
    },
    /** Newest first: by date, then by creation. */
    list: (userId: string, filter: TransactionFilter): TransactionPage => {
      const where = whereClause(userId, filter);
      const total = db
        .prepare<[Record<string, string>], { n: number }>(
          `SELECT COUNT(*) AS n FROM transactions ${where.sql}`,
        )
        .get(where.params)!.n;
      const rows = db
        .prepare<[Record<string, string | number>], TransactionRow>(
          `SELECT * FROM transactions ${where.sql}
           ORDER BY date DESC, created_at DESC, rowid DESC LIMIT @limit OFFSET @offset`,
        )
        .all({ ...where.params, limit: filter.limit, offset: filter.offset });
      return { items: rows.map(toTransaction), total };
    },
    insert: (userId: string, transaction: Transaction): void => {
      insert.run(toRow(userId, transaction));
    },
    /** The account is fixed, so it is never written. */
    update: (userId: string, transaction: Transaction): void => {
      update.run(toRow(userId, transaction));
    },
    delete: (userId: string, id: string): void => {
      remove.run(userId, id);
    },
    count: (userId: string): number => count.get(userId)!.n,
    countByProject: (userId: string, projectId: string): number =>
      countByProject.get(userId, projectId)!.n,
    totalsByAccount: (userId: string): AccountTypeTotal[] => totalsByAccount.all(userId),
    totalsByProject: (userId: string): ProjectTypeTotal[] => totalsByProject.all(userId),
    /** Every month with transactions up to and including `toDate`, oldest first. */
    monthlyTotals: (userId: string, toDate: string): MonthlyTotal[] =>
      monthlyTotals.all(userId, toDate),
    /** Expenses between two dates (inclusive) per project tag, largest first. */
    expenseByProject: (userId: string, fromDate: string, toDate: string): ProjectExpenseTotal[] =>
      expenseByProject.all(userId, fromDate, toDate),
  };
}

type TransactionRepository = ReturnType<typeof createTransactionRepository>;

export { createTransactionRepository };
export type {
  AccountTypeTotal,
  MonthlyTotal,
  ProjectExpenseTotal,
  ProjectTypeTotal,
  TransactionFilter,
  TransactionPage,
  TransactionRepository,
};
