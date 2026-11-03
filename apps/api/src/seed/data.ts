import type { Account, TransactionType } from '@expensetracker/schema';

/** A project to create, as sent to `POST /api/projects`. */
interface SeedProject {
  name: string;
  description: string;
  budgetCents: number | null;
}

/** A transaction to create; `project` names the project to tag it with. */
interface SeedTransaction {
  account: Account;
  type: TransactionType;
  amountCents: number;
  date: string;
  description: string;
  project?: string;
}

interface SeedData {
  projects: SeedProject[];
  transactions: SeedTransaction[];
}

const SEED_MONTHS = 12;

const HOLIDAY = 'Summer holiday';
const BIKE = 'New bike';
const OFFICE = 'Home office';

const PROJECTS: SeedProject[] = [
  { name: HOLIDAY, description: 'Two weeks in Portugal', budgetCents: 300_000 },
  { name: BIKE, description: 'Replace the old commuter bike', budgetCents: 250_000 },
  { name: OFFICE, description: 'Desk, chair and screen for working from home', budgetCents: null },
];

/** Project spending, placed `monthsAgo` months before the current month. */
const PROJECT_TRANSACTIONS: (Omit<SeedTransaction, 'date'> & { monthsAgo: number; day: number })[] =
  [
    {
      monthsAgo: 6,
      day: 8,
      account: 'savings',
      type: 'expense',
      amountCents: 120_000,
      description: 'Flights to Lisbon',
      project: HOLIDAY,
    },
    {
      monthsAgo: 5,
      day: 14,
      account: 'main',
      type: 'expense',
      amountCents: 140_000,
      description: 'Hotel',
      project: HOLIDAY,
    },
    {
      monthsAgo: 4,
      day: 2,
      account: 'main',
      type: 'expense',
      amountCents: 92_500,
      description: 'Car rental and food',
      project: HOLIDAY,
    },
    {
      monthsAgo: 4,
      day: 9,
      account: 'main',
      type: 'income',
      amountCents: 12_000,
      description: 'Hotel deposit refund',
      project: HOLIDAY,
    },
    {
      monthsAgo: 3,
      day: 11,
      account: 'savings',
      type: 'expense',
      amountCents: 189_000,
      description: 'Gravel bike',
      project: BIKE,
    },
    {
      monthsAgo: 3,
      day: 18,
      account: 'main',
      type: 'expense',
      amountCents: 24_000,
      description: 'Helmet, lights and lock',
      project: BIKE,
    },
    {
      monthsAgo: 2,
      day: 6,
      account: 'main',
      type: 'income',
      amountCents: 35_000,
      description: 'Sold the old bike',
      project: BIKE,
    },
    {
      monthsAgo: 8,
      day: 20,
      account: 'main',
      type: 'expense',
      amountCents: 45_000,
      description: 'Standing desk',
      project: OFFICE,
    },
    {
      monthsAgo: 7,
      day: 3,
      account: 'main',
      type: 'expense',
      amountCents: 32_000,
      description: 'Office chair',
      project: OFFICE,
    },
    {
      monthsAgo: 1,
      day: 15,
      account: 'main',
      type: 'expense',
      amountCents: 28_000,
      description: 'Second monitor',
      project: OFFICE,
    },
  ];

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of `day` in the month `monthsAgo` months before `today` (UTC). */
function dateIn(today: Date, monthsAgo: number, day: number): string {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(day)}`;
}

/** Everyday transactions of one month. Amounts vary by month, but deterministically. */
function monthlyTransactions(today: Date, monthsAgo: number): SeedTransaction[] {
  const at = (day: number) => dateIn(today, monthsAgo, day);
  const vary = (base: number, spread: number, salt: number) =>
    base + (((monthsAgo + 3) * 7919 + salt * 104_729) % spread);
  const month = Number(at(1).slice(5, 7));

  const rows: SeedTransaction[] = [
    { account: 'main', type: 'expense', amountCents: 165_000, date: at(1), description: 'Rent' },
    {
      account: 'main',
      type: 'expense',
      amountCents: 38_250,
      date: at(5),
      description: 'Health insurance',
    },
    {
      account: 'main',
      type: 'expense',
      amountCents: 4_500,
      date: at(12),
      description: 'Phone plan',
    },
    { account: 'main', type: 'income', amountCents: 520_000, date: at(25), description: 'Salary' },
    {
      account: 'main',
      type: 'expense',
      amountCents: 80_000,
      date: at(26),
      description: 'Transfer to savings',
    },
    {
      account: 'savings',
      type: 'income',
      amountCents: 80_000,
      date: at(26),
      description: 'Monthly savings deposit',
    },
  ];
  [3, 10, 17, 24].forEach((day, week) => {
    rows.push({
      account: 'main',
      type: 'expense',
      amountCents: vary(9_000, 6_000, week),
      date: at(day),
      description: 'Groceries',
    });
  });
  if (monthsAgo % 2 === 0) {
    rows.push({
      account: 'main',
      type: 'expense',
      amountCents: vary(5_000, 4_000, 9),
      date: at(19),
      description: 'Dinner with friends',
    });
  }
  if (month % 3 === 0) {
    rows.push({
      account: 'savings',
      type: 'income',
      amountCents: 1_850,
      date: at(28),
      description: 'Interest',
    });
  }
  if (month === 12) {
    rows.push({
      account: 'main',
      type: 'income',
      amountCents: 260_000,
      date: at(20),
      description: 'Year-end bonus',
    });
  }
  return rows;
}

/**
 * Realistic demo data for the dashboard: three projects (one over budget, one without a budget)
 * and the 12 months up to `today` of main and savings transactions. Nothing is dated after
 * `today`. Deterministic, so the same day always gives the same data.
 */
function generateSeedData(today: Date): SeedData {
  const last = today.toISOString().slice(0, 10);
  const transactions: SeedTransaction[] = [];
  for (let monthsAgo = SEED_MONTHS - 1; monthsAgo >= 0; monthsAgo--) {
    transactions.push(...monthlyTransactions(today, monthsAgo));
  }
  for (const { monthsAgo, day, ...rest } of PROJECT_TRANSACTIONS) {
    transactions.push({ ...rest, date: dateIn(today, monthsAgo, day) });
  }
  return {
    projects: PROJECTS.map((p) => ({ ...p })),
    transactions: transactions
      .filter((t) => t.date <= last)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
  };
}

export { generateSeedData, SEED_MONTHS };
export type { SeedData, SeedProject, SeedTransaction };
