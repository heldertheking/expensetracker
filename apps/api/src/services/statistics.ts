import { NO_PROJECT_NAME } from '@expensetracker/schema';
import type {
  Account,
  MonthlyBalance,
  MonthlyFlow,
  ProjectExpense,
  StatsResponse,
} from '@expensetracker/schema';
import type { MonthlyTotal, ProjectExpenseTotal } from '../repositories/transaction-repository.js';

/** A range of whole months (`YYYY-MM`) and the first and last calendar day it covers. */
interface MonthRange {
  from: string;
  to: string;
  firstDay: string;
  lastDay: string;
}

const DEFAULT_MONTHS = 12;

/** Months counted from year 0, so ranges are simple integer arithmetic. */
const monthIndex = (month: string) =>
  Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

const monthAt = (index: number) =>
  `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;

const lastDayOf = (month: string) => {
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  return `${month}-${String(days.getUTCDate()).padStart(2, '0')}`;
};

/**
 * The months a stats query covers. `from`/`to` select the months they fall in; without them the
 * range is the 12 months up to and including the month of `today` (UTC).
 */
function statsRange(query: { from?: string; to?: string }, today: Date): MonthRange {
  let from: string;
  let to: string;
  if (query.from !== undefined && query.to !== undefined) {
    from = query.from.slice(0, 7);
    to = query.to.slice(0, 7);
  } else {
    to = today.toISOString().slice(0, 7);
    from = monthAt(monthIndex(to) - (DEFAULT_MONTHS - 1));
  }
  return { from, to, firstDay: `${from}-01`, lastDay: lastDayOf(to) };
}

/** Flows of one month and how much each account's balance changed in it. */
interface MonthBucket {
  incomeCents: number;
  expenseCents: number;
  change: Record<Account, number>;
}

const emptyBucket = (): MonthBucket => ({
  incomeCents: 0,
  expenseCents: 0,
  change: { main: 0, savings: 0 },
});

const byName = (a: ProjectExpense, b: ProjectExpense) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

/**
 * Builds the dashboard statistics: income and expense of every month in the range (gaps as 0),
 * the balance per account at the end of each month (counting everything before the range too)
 * and the expenses in the range per project tag, largest first, then by name.
 */
function buildStats(
  range: MonthRange,
  monthlyTotals: readonly MonthlyTotal[],
  expenses: readonly ProjectExpenseTotal[],
): StatsResponse {
  // Opening balance: everything booked before the range. Inside the range, one bucket per month.
  const balance = { main: 0, savings: 0 };
  const buckets = new Map<string, MonthBucket>();

  for (const row of monthlyTotals) {
    if (row.month > range.to) continue;
    const signed = row.type === 'income' ? row.totalCents : -row.totalCents;
    if (row.month < range.from) {
      balance[row.account] += signed;
      continue;
    }
    const bucket = buckets.get(row.month) ?? emptyBucket();
    bucket[row.type === 'income' ? 'incomeCents' : 'expenseCents'] += row.totalCents;
    bucket.change[row.account] += signed;
    buckets.set(row.month, bucket);
  }

  const monthly: MonthlyFlow[] = [];
  const balances: MonthlyBalance[] = [];
  for (let index = monthIndex(range.from); index <= monthIndex(range.to); index++) {
    const month = monthAt(index);
    const { incomeCents, expenseCents, change } = buckets.get(month) ?? emptyBucket();
    monthly.push({ month, incomeCents, expenseCents, netCents: incomeCents - expenseCents });

    balance.main += change.main;
    balance.savings += change.savings;
    balances.push({
      month,
      mainCents: balance.main,
      savingsCents: balance.savings,
      totalCents: balance.main + balance.savings,
    });
  }

  const expenseByProject: ProjectExpense[] = expenses
    .filter((row) => row.expenseCents > 0)
    .map((row) => ({
      projectId: row.projectId,
      name: row.projectId === null ? NO_PROJECT_NAME : (row.name ?? NO_PROJECT_NAME),
      expenseCents: row.expenseCents,
    }))
    .sort((a, b) => b.expenseCents - a.expenseCents || byName(a, b));

  return { from: range.from, to: range.to, monthly, balances, expenseByProject };
}

export { buildStats, statsRange };
export type { MonthRange };
