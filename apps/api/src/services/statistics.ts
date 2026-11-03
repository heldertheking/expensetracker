import type { StatsResponse } from '@expensetracker/schema';
import type { MonthlyTotal, ProjectExpenseTotal } from '../repositories/transaction-repository.js';

/** A range of whole months (`YYYY-MM`) and the first and last calendar day it covers. */
interface MonthRange {
  from: string;
  to: string;
  firstDay: string;
  lastDay: string;
}

/**
 * The months a stats query covers. `from`/`to` select the months they fall in; without them the
 * range is the 12 months up to and including the month of `today`.
 */
function statsRange(query: { from?: string; to?: string }, today: Date): MonthRange {
  void query;
  void today;
  throw new Error('not implemented');
}

/**
 * Builds the dashboard statistics: income and expense of every month in the range (gaps as 0),
 * the balance per account at the end of each month (counting everything before the range too)
 * and the expenses in the range per project tag, largest first.
 */
function buildStats(
  range: MonthRange,
  monthlyTotals: readonly MonthlyTotal[],
  expenses: readonly ProjectExpenseTotal[],
): StatsResponse {
  void range;
  void monthlyTotals;
  void expenses;
  throw new Error('not implemented');
}

export { buildStats, statsRange };
export type { MonthRange };
