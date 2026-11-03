import { NO_PROJECT_NAME } from '@expensetracker/schema';

/**
 * Wire fixtures (JSON as the API sends it). Every builder's output is checked against the shared
 * schema in `fixtures.test.ts`, so the mocks cannot drift from the contract.
 */

export const PROJECT_IDS = {
  holiday: '11111111-1111-4111-8111-111111111111',
  renovation: '22222222-2222-4222-8222-222222222222',
  course: '33333333-3333-4333-8333-333333333333',
} as const;

const CREATED = '2026-06-15T12:00:00.000Z';
const UPDATED = '2026-07-01T08:30:00.000Z';

let idCounter = 0;
export function uuid(n = ++idCounter): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export interface WireTransaction {
  id: string;
  account: 'main' | 'savings';
  type: 'income' | 'expense';
  amountCents: number;
  date: string;
  description: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function transaction(overrides: Partial<WireTransaction> = {}): WireTransaction {
  return {
    id: uuid(),
    account: 'main',
    type: 'expense',
    amountCents: 4550,
    date: '2026-06-14',
    description: 'Groceries',
    projectId: null,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

export interface WireProject {
  id: string;
  name: string;
  description: string;
  budgetCents: number | null;
  createdAt: string;
  updatedAt: string;
  incomeCents: number;
  expenseCents: number;
  remainingCents: number | null;
  overBudget: boolean;
}

/** A project with derived totals computed the way the server does. */
export function project(
  overrides: Partial<Omit<WireProject, 'remainingCents' | 'overBudget'>> = {},
): WireProject {
  const base = {
    id: PROJECT_IDS.holiday,
    name: 'Holiday',
    description: 'Summer in Ticino',
    budgetCents: 200000 as number | null,
    createdAt: CREATED,
    updatedAt: CREATED,
    incomeCents: 0,
    expenseCents: 50000,
    ...overrides,
  };
  const remainingCents =
    base.budgetCents === null ? null : base.budgetCents - base.expenseCents + base.incomeCents;
  return { ...base, remainingCents, overBudget: remainingCents !== null && remainingCents < 0 };
}

export const projects = {
  holiday: project(),
  renovation: project({
    id: PROJECT_IDS.renovation,
    name: 'Renovation',
    description: 'Kitchen',
    budgetCents: 100000,
    expenseCents: 130000,
    incomeCents: 5000,
  }),
  course: project({
    id: PROJECT_IDS.course,
    name: 'Language course',
    description: '',
    budgetCents: null,
    expenseCents: 30000,
  }),
};

export function projectList(items: WireProject[] = Object.values(projects)) {
  return { items };
}

export function accounts(
  mainCents = { income: 500000, expense: 123450 },
  savings = { income: 1000000, expense: 0 },
) {
  const summary = (account: 'main' | 'savings', t: { income: number; expense: number }) => ({
    account,
    incomeCents: t.income,
    expenseCents: t.expense,
    balanceCents: t.income - t.expense,
  });
  const main = summary('main', mainCents);
  const sav = summary('savings', savings);
  return {
    accounts: [main, sav],
    total: {
      incomeCents: main.incomeCents + sav.incomeCents,
      expenseCents: main.expenseCents + sav.expenseCents,
      balanceCents: main.balanceCents + sav.balanceCents,
    },
  };
}

export const emptyAccounts = () => accounts({ income: 0, expense: 0 }, { income: 0, expense: 0 });

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

interface Flow {
  income: number;
  expense: number;
  /** Part of the month's net that went to the savings account. */
  toSavings?: number;
}

/**
 * A consistent stats response: one row per month from `from`, balances that change by each
 * month's net, and expenses per project (the untagged rest goes to the "No project" row).
 */
export function stats(
  from: string,
  flows: Flow[],
  options: {
    startMain?: number;
    startSavings?: number;
    tagged?: { projectId: string; name: string; expenseCents: number }[];
  } = {},
) {
  let month = from;
  let main = options.startMain ?? 100000;
  let savings = options.startSavings ?? 500000;
  const monthly = [];
  const balances = [];
  for (const flow of flows) {
    const net = flow.income - flow.expense;
    const toSavings = flow.toSavings ?? 0;
    main += net - toSavings;
    savings += toSavings;
    monthly.push({
      month,
      incomeCents: flow.income,
      expenseCents: flow.expense,
      netCents: net,
    });
    balances.push({ month, mainCents: main, savingsCents: savings, totalCents: main + savings });
    month = nextMonth(month);
  }
  const totalExpense = flows.reduce((sum, f) => sum + f.expense, 0);
  const tagged = options.tagged ?? [];
  const untagged = totalExpense - tagged.reduce((sum, t) => sum + t.expenseCents, 0);
  const rows: { projectId: string | null; name: string; expenseCents: number }[] = [...tagged];
  if (untagged > 0) rows.push({ projectId: null, name: NO_PROJECT_NAME, expenseCents: untagged });
  rows.sort((a, b) => b.expenseCents - a.expenseCents || a.name.localeCompare(b.name));
  return {
    from,
    to: monthly.at(-1)!.month,
    monthly,
    balances,
    expenseByProject: rows,
  };
}

export const sampleStats = () =>
  stats(
    '2026-06',
    [
      { income: 520000, expense: 310000, toSavings: 50000 },
      { income: 520000, expense: 280000, toSavings: 50000 },
      { income: 530000, expense: 450000 },
    ],
    {
      tagged: [
        { projectId: PROJECT_IDS.holiday, name: 'Holiday', expenseCents: 50000 },
        { projectId: PROJECT_IDS.renovation, name: 'Renovation', expenseCents: 130000 },
      ],
    },
  );

export function page<T>(items: T[], { total = items.length, limit = 20, offset = 0 } = {}) {
  return { items, total, limit, offset };
}

let sequence = 100;

export function createTransactionEvent(t: WireTransaction = transaction()) {
  return {
    id: uuid(),
    sequence: sequence--,
    occurredAt: t.createdAt,
    type: 'CreateTransactionEvent' as const,
    payload: { transaction: t },
  };
}

export function updateTransactionEvent(
  before: WireTransaction,
  changes: Partial<Omit<WireTransaction, 'id' | 'account' | 'createdAt'>>,
) {
  return {
    id: uuid(),
    sequence: sequence--,
    occurredAt: UPDATED,
    type: 'UpdateTransactionEvent' as const,
    payload: { before, after: { ...before, ...changes, updatedAt: UPDATED } },
  };
}

export function deleteTransactionEvent(t: WireTransaction) {
  return {
    id: uuid(),
    sequence: sequence--,
    occurredAt: UPDATED,
    type: 'DeleteTransactionEvent' as const,
    payload: { transaction: t },
  };
}

const record = (p: WireProject) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  budgetCents: p.budgetCents,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export function createProjectEvent(p: WireProject = projects.holiday) {
  return {
    id: uuid(),
    sequence: sequence--,
    occurredAt: p.createdAt,
    type: 'CreateProjectEvent' as const,
    payload: { project: record(p) },
  };
}

export function updateProjectEvent(
  p: WireProject,
  changes: { name?: string; description?: string },
) {
  return {
    id: uuid(),
    sequence: sequence--,
    occurredAt: UPDATED,
    type: 'UpdateProjectEvent' as const,
    payload: { before: record(p), after: { ...record(p), ...changes, updatedAt: UPDATED } },
  };
}

export function deleteProjectEvent(p: WireProject) {
  return {
    id: uuid(),
    sequence: sequence--,
    occurredAt: UPDATED,
    type: 'DeleteProjectEvent' as const,
    payload: { project: record(p) },
  };
}

/** One event of each type, newest first. */
export function sampleEvents() {
  sequence = 100;
  const groceries = transaction({ description: 'Groceries', amountCents: 4550 });
  return [
    createTransactionEvent(groceries),
    updateTransactionEvent(groceries, { amountCents: 5000 }),
    deleteTransactionEvent(transaction({ description: 'Old bill', type: 'expense' })),
    createProjectEvent(projects.holiday),
    updateProjectEvent(projects.renovation, { name: 'Kitchen renovation' }),
    deleteProjectEvent(projects.course),
  ];
}

export function apiError(
  code: 'validation_error' | 'not_found' | 'conflict' | 'unprocessable',
  message: string,
  issues: { path: string; message: string }[] = [],
) {
  return { error: { code, message, issues } };
}
