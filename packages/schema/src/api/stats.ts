import { z } from 'zod';
import { Id } from '../domain/id.js';
import { IsoDate } from '../domain/iso-date.js';

/** A calendar month, `YYYY-MM`. Sorts correctly as text. */
const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'expected YYYY-MM' });

const MAX_STATS_MONTHS = 60;

/** Name of the `expenseByProject` row that collects expenses without a project tag. */
const NO_PROJECT_NAME = 'No project';

/** Number of calendar months from `from` to `to`, both included (`YYYY-MM` or `YYYY-MM-DD`). */
function monthsInRange(from: string, to: string): number {
  const index = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
  return index(to) - index(from) + 1;
}

/**
 * `GET /api/stats`. Send both `from` and `to`, or neither: without them the server uses the 12
 * months up to and including the current one. The range covers whole months (`from` and `to`
 * select the months they fall in) and may span at most `MAX_STATS_MONTHS` months.
 */
const StatsQuery = z
  .strictObject({ from: IsoDate.optional(), to: IsoDate.optional() })
  .refine((q) => (q.from === undefined) === (q.to === undefined), {
    error: 'send both from and to, or neither',
    path: ['from'],
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, {
    error: 'from must not be after to',
    path: ['from'],
  })
  .refine(
    (q) =>
      q.from === undefined || q.to === undefined || monthsInRange(q.from, q.to) <= MAX_STATS_MONTHS,
    { error: `the range must not span more than ${MAX_STATS_MONTHS} months`, path: ['to'] },
  );
type StatsQuery = z.infer<typeof StatsQuery>;

const cents = z.number().int().nonnegative();

/** Income and expense booked in one month, both accounts together. */
const MonthlyFlowSchema = z
  .object({ month: YearMonth, incomeCents: cents, expenseCents: cents, netCents: z.number().int() })
  .refine((m) => m.netCents === m.incomeCents - m.expenseCents, {
    error: 'netCents must equal incomeCents - expenseCents',
    path: ['netCents'],
  });
type MonthlyFlow = z.infer<typeof MonthlyFlowSchema>;

/** Balance at the end of a month, counting every transaction up to then (also before `from`). */
const MonthlyBalanceSchema = z
  .object({
    month: YearMonth,
    mainCents: z.number().int(),
    savingsCents: z.number().int(),
    totalCents: z.number().int(),
  })
  .refine((m) => m.totalCents === m.mainCents + m.savingsCents, {
    error: 'totalCents must equal mainCents + savingsCents',
    path: ['totalCents'],
  });
type MonthlyBalance = z.infer<typeof MonthlyBalanceSchema>;

/**
 * Expenses in the range per project tag; `projectId` null collects untagged expenses under
 * `NO_PROJECT_NAME`. Only rows with expenses are listed.
 */
const ProjectExpenseSchema = z.object({
  projectId: Id.nullable(),
  name: z.string(),
  expenseCents: cents.min(1),
});
type ProjectExpense = z.infer<typeof ProjectExpenseSchema>;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Every month from `from` to `to` appears exactly once in `monthly` and `balances`, ascending, with
 * gaps as 0. Consecutive balances differ by that month's net flow. `expenseByProject` is ordered
 * by expense, largest first, then by name, and adds up to the expenses in `monthly`.
 */
const StatsResponse = z
  .object({
    from: YearMonth,
    to: YearMonth,
    monthly: z.array(MonthlyFlowSchema).min(1).max(MAX_STATS_MONTHS),
    balances: z.array(MonthlyBalanceSchema).max(MAX_STATS_MONTHS),
    expenseByProject: z.array(ProjectExpenseSchema),
  })
  .refine((s) => s.from <= s.to, { error: 'from must not be after to', path: ['from'] })
  .refine(
    (s) =>
      s.monthly.length === monthsInRange(s.from, s.to) &&
      s.monthly.every((m, i) => i === 0 || monthsInRange(s.monthly[i - 1]!.month, m.month) === 2) &&
      s.monthly[0]!.month === s.from,
    { error: 'monthly must list every month from from to to once, ascending', path: ['monthly'] },
  )
  .refine(
    (s) =>
      s.monthly.length === s.balances.length &&
      s.monthly.every((m, i) => s.balances[i]!.month === m.month),
    { error: 'balances must cover the same months as monthly', path: ['balances'] },
  )
  .refine(
    (s) =>
      s.balances.every(
        (b, i) =>
          i === 0 || b.totalCents - s.balances[i - 1]!.totalCents === s.monthly[i]!.netCents,
      ),
    { error: 'consecutive balances must differ by the net flow of the month', path: ['balances'] },
  )
  .refine(
    (s) => new Set(s.expenseByProject.map((p) => p.projectId)).size === s.expenseByProject.length,
    {
      error: 'each project, and the untagged row, may appear only once',
      path: ['expenseByProject'],
    },
  )
  .refine(
    (s) =>
      sum(s.expenseByProject.map((p) => p.expenseCents)) ===
      sum(s.monthly.map((m) => m.expenseCents)),
    {
      error: 'expenseByProject must add up to the expenses in monthly',
      path: ['expenseByProject'],
    },
  )
  .refine(
    (s) =>
      s.expenseByProject.every((p, i) => {
        const prev = s.expenseByProject[i - 1];
        if (prev === undefined) return true;
        return (
          prev.expenseCents > p.expenseCents ||
          (prev.expenseCents === p.expenseCents && prev.name <= p.name)
        );
      }),
    {
      error: 'expenseByProject must be ordered largest first, then by name',
      path: ['expenseByProject'],
    },
  );
type StatsResponse = z.infer<typeof StatsResponse>;

export {
  MAX_STATS_MONTHS,
  MonthlyBalanceSchema,
  MonthlyFlowSchema,
  monthsInRange,
  NO_PROJECT_NAME,
  ProjectExpenseSchema,
  StatsQuery,
  StatsResponse,
  YearMonth,
};
export type { MonthlyBalance, MonthlyFlow, ProjectExpense };
