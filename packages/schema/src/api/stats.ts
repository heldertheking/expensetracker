import { z } from 'zod';
import { Id } from '../domain/id.js';
import { IsoDate } from '../domain/iso-date.js';

/** A calendar month, `YYYY-MM`. Sorts correctly as text. */
const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'expected YYYY-MM' });

const MAX_STATS_MONTHS = 60;

/**
 * `GET /api/stats`. Without `from`/`to` the server uses the 12 months up to and including the
 * current one. The range covers whole months: `from` and `to` select the months they fall in,
 * and a range of more than `MAX_STATS_MONTHS` months is rejected by the server.
 */
const StatsQuery = z
  .strictObject({ from: IsoDate.optional(), to: IsoDate.optional() })
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, {
    error: 'from must not be after to',
    path: ['from'],
  });
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

/** Expenses in the range per project tag; `projectId` null collects untagged expenses. */
const ProjectExpenseSchema = z.object({
  projectId: Id.nullable(),
  name: z.string(),
  expenseCents: cents.min(1),
});
type ProjectExpense = z.infer<typeof ProjectExpenseSchema>;

const ascendingMonths = (rows: { month: string }[]) =>
  rows.every((row, i) => i === 0 || rows[i - 1]!.month < row.month);

const StatsResponse = z
  .object({
    from: YearMonth,
    to: YearMonth,
    monthly: z.array(MonthlyFlowSchema).min(1).max(MAX_STATS_MONTHS), // every month of the range, gaps as 0
    balances: z.array(MonthlyBalanceSchema).max(MAX_STATS_MONTHS), // same months as `monthly`
    expenseByProject: z.array(ProjectExpenseSchema), // largest first
  })
  .refine((s) => s.from <= s.to, { error: 'from must not be after to', path: ['from'] })
  .refine((s) => ascendingMonths(s.monthly), {
    error: 'months must be ascending and unique',
    path: ['monthly'],
  })
  .refine(
    (s) =>
      s.monthly.length === s.balances.length &&
      s.monthly.every((m, i) => s.balances[i]!.month === m.month),
    { error: 'balances must cover the same months as monthly', path: ['balances'] },
  )
  .refine((s) => s.monthly[0]?.month === s.from && s.monthly.at(-1)?.month === s.to, {
    error: 'monthly must start at from and end at to',
    path: ['monthly'],
  })
  .refine(
    (s) =>
      s.expenseByProject.every(
        (p, i) => i === 0 || s.expenseByProject[i - 1]!.expenseCents >= p.expenseCents,
      ),
    { error: 'expenseByProject must be ordered largest first', path: ['expenseByProject'] },
  );
type StatsResponse = z.infer<typeof StatsResponse>;

export {
  MAX_STATS_MONTHS,
  MonthlyBalanceSchema,
  MonthlyFlowSchema,
  ProjectExpenseSchema,
  StatsQuery,
  StatsResponse,
  YearMonth,
};
export type { MonthlyBalance, MonthlyFlow, ProjectExpense };
