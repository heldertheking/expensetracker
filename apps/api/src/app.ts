import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Express } from 'express';
import type { Database } from 'better-sqlite3';
import { createEventBus } from './events/event-bus.js';
import type { EventBus } from './events/event-bus.js';
import { createHandlers } from './events/handlers/index.js';
import type { Subscriber } from './events/types.js';
import { createEventRepository } from './repositories/event-repository.js';
import { createProjectRepository } from './repositories/project-repository.js';
import { createTransactionRepository } from './repositories/transaction-repository.js';
import { errorHandler, unknownRoute } from './routes/http.js';
import { projectsRouter } from './routes/projects.js';
import { readRouter } from './routes/read-routes.js';
import { transactionsRouter } from './routes/transactions.js';
import {
  createAccountService,
  createEventService,
  createProjectService,
  createStatsService,
  createTransactionService,
} from './services/read-services.js';

interface AppDeps {
  /** An open, migrated database (see `openDatabase`). */
  db: Database;
  clock?: () => Date;
  newId?: () => string;
  subscribers?: Subscriber[];
  /** Where unexpected errors and failing subscribers are reported. Defaults to `console.error`. */
  log?: (message: string, error: unknown) => void;
}

/** Wires repositories, the event bus and the services. Shared by the app and the seed script. */
function createCore(deps: AppDeps) {
  const clock = deps.clock ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;
  const log = deps.log ?? ((message: string, error: unknown) => console.error(message, error));

  const projects = createProjectRepository(deps.db);
  const transactions = createTransactionRepository(deps.db);
  const events = createEventRepository(deps.db);

  const bus: EventBus = createEventBus({
    handlers: createHandlers({ projects, transactions, clock, newId }),
    transaction: (work) => deps.db.transaction(work)(),
    appendEvent: events.append,
    clock,
    newId,
    subscribers: deps.subscribers,
    onSubscriberError: (error, event) =>
      log(`subscriber failed for ${event.type} #${event.sequence}`, error),
  });

  return {
    clock,
    log,
    bus,
    repositories: { projects, transactions, events },
    services: {
      accounts: createAccountService({ transactions }),
      projects: createProjectService({ projects, transactions }),
      transactions: createTransactionService({ transactions }),
      events: createEventService({ events }),
      stats: createStatsService({ transactions, clock }),
    },
  };
}

type Core = ReturnType<typeof createCore>;

/** The Express app over the given database. Tests pass an in-memory one. */
function createApp(deps: AppDeps): Express {
  const core = createCore(deps);
  const { services } = core;
  const app = express();

  app.use(express.json());
  app.use('/api', readRouter({ ...services, clock: core.clock }));
  app.use('/api/projects', projectsRouter({ bus: core.bus, projects: services.projects }));
  app.use(
    '/api/transactions',
    transactionsRouter({ bus: core.bus, transactions: services.transactions }),
  );
  app.use('/api', unknownRoute);
  app.use(errorHandler(core.log));

  return app;
}

export { createApp, createCore };
export type { AppDeps, Core };
