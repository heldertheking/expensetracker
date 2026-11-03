import type {
  AccountsResponse,
  BusinessEvent,
  ListEventsQuery,
  ListTransactionsQuery,
  Project,
  StatsQuery,
  StatsResponse,
  Transaction,
} from '@expensetracker/schema';
import { notFound } from '../errors.js';
import type { EventRepository } from '../repositories/event-repository.js';
import type { ProjectRepository } from '../repositories/project-repository.js';
import type {
  ProjectTypeTotal,
  TransactionRepository,
} from '../repositories/transaction-repository.js';
import { accountBalances } from './balance.js';
import { withProjectTotals } from './budget.js';
import type { ProjectSums } from './budget.js';
import { buildStats, statsRange } from './statistics.js';

/** A page of a list together with the paging it was read with. */
interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

function sumsOf(rows: readonly ProjectTypeTotal[], projectId: string): ProjectSums {
  const sums: ProjectSums = { incomeCents: 0, expenseCents: 0 };
  for (const row of rows) {
    if (row.projectId !== projectId) continue;
    if (row.type === 'income') sums.incomeCents += row.totalCents;
    else sums.expenseCents += row.totalCents;
  }
  return sums;
}

/** `GET /api/accounts`. */
function createAccountService(deps: {
  transactions: Pick<TransactionRepository, 'totalsByAccount'>;
}) {
  return {
    summary: (): AccountsResponse => accountBalances(deps.transactions.totalsByAccount()),
  };
}

/** Projects with their derived totals. */
function createProjectService(deps: {
  projects: Pick<ProjectRepository, 'list' | 'findById'>;
  transactions: Pick<TransactionRepository, 'totalsByProject'>;
}) {
  return {
    list: (): Project[] => {
      const totals = deps.transactions.totalsByProject();
      return deps.projects.list().map((p) => withProjectTotals(p, sumsOf(totals, p.id)));
    },
    /** Throws `not_found` for an unknown id. */
    get: (id: string): Project => {
      const project = deps.projects.findById(id);
      if (project === undefined) throw notFound('project', id);
      return withProjectTotals(project, sumsOf(deps.transactions.totalsByProject(), id));
    },
  };
}

/** Lists and single transactions. */
function createTransactionService(deps: {
  transactions: Pick<TransactionRepository, 'list' | 'findById'>;
}) {
  return {
    list: (query: ListTransactionsQuery): Page<Transaction> => ({
      ...deps.transactions.list(query),
      limit: query.limit,
      offset: query.offset,
    }),
    /** Throws `not_found` for an unknown id. */
    get: (id: string): Transaction => {
      const transaction = deps.transactions.findById(id);
      if (transaction === undefined) throw notFound('transaction', id);
      return transaction;
    },
  };
}

/** The activity feed. */
function createEventService(deps: { events: Pick<EventRepository, 'list'> }) {
  return {
    list: (query: ListEventsQuery): Page<BusinessEvent> => ({
      ...deps.events.list(query),
      limit: query.limit,
      offset: query.offset,
    }),
  };
}

/** `GET /api/stats`. The clock decides the default range. */
function createStatsService(deps: {
  transactions: Pick<TransactionRepository, 'monthlyTotals' | 'expenseByProject'>;
  clock: () => Date;
}) {
  return {
    stats: (query: StatsQuery): StatsResponse => {
      const range = statsRange(query, deps.clock());
      return buildStats(
        range,
        deps.transactions.monthlyTotals(range.lastDay),
        deps.transactions.expenseByProject(range.firstDay, range.lastDay),
      );
    },
  };
}

type AccountService = ReturnType<typeof createAccountService>;
type ProjectService = ReturnType<typeof createProjectService>;
type TransactionService = ReturnType<typeof createTransactionService>;
type EventService = ReturnType<typeof createEventService>;
type StatsService = ReturnType<typeof createStatsService>;

export {
  createAccountService,
  createEventService,
  createProjectService,
  createStatsService,
  createTransactionService,
  sumsOf,
};
export type {
  AccountService,
  EventService,
  Page,
  ProjectService,
  StatsService,
  TransactionService,
};
