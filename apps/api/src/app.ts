import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Express } from 'express';
import type { Database } from 'better-sqlite3';
import { createPasswordHasher } from './auth/password.js';
import type { ScryptParams } from './auth/password.js';
import { createRateLimiter } from './auth/rate-limiter.js';
import {
  csrfOriginCheck,
  parseAllowedOrigins,
  requireAuth,
  securityHeaders,
} from './auth/security.js';
import { createSessionService } from './auth/session-service.js';
import { createEventBus } from './events/event-bus.js';
import type { EventBus } from './events/event-bus.js';
import { createHandlers } from './events/handlers/index.js';
import type { Subscriber } from './events/types.js';
import { createEventRepository } from './repositories/event-repository.js';
import { createProjectRepository } from './repositories/project-repository.js';
import { createSessionRepository } from './repositories/session-repository.js';
import { createTransactionRepository } from './repositories/transaction-repository.js';
import { createUserRepository } from './repositories/user-repository.js';
import { authRouter } from './routes/auth.js';
import { errorHandler, unknownRoute } from './routes/http.js';
import { projectsRouter } from './routes/projects.js';
import { healthRouter, readRouter } from './routes/read-routes.js';
import { transactionsRouter } from './routes/transactions.js';
import {
  createAccountService,
  createEventService,
  createProjectService,
  createStatsService,
  createTransactionService,
} from './services/read-services.js';

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_EMAIL_LIMIT = 5;
const LOGIN_IP_LIMIT = 20;
const REGISTER_IP_LIMIT = 10;

interface AppDeps {
  /** An open, migrated database (see `openDatabase`). */
  db: Database;
  clock?: () => Date;
  /** Optional separate clock for session/rate-limit checks in tests with a stepping domain clock. */
  authClock?: () => Date;
  newId?: () => string;
  subscribers?: Subscriber[];
  /** Where unexpected errors and failing subscribers are reported. Defaults to `console.error`. */
  log?: (message: string, error: unknown) => void;
  /** Override scrypt cost parameters (e.g. `{ N: 1024, r: 8, p: 1 }` in fast unit/API tests). */
  scryptParams?: ScryptParams;
  /** Allowed `Origin` values for state-changing requests. Defaults to `ALLOWED_ORIGINS` or localhost. */
  allowedOrigins?: readonly string[];
  /** Whether to emit `Strict-Transport-Security`. Defaults to `NODE_ENV === 'production'`. */
  isProduction?: boolean;
  /** Override session idle timeout (ms). */
  sessionIdleTimeoutMs?: number;
  /** Override session absolute timeout (ms). */
  sessionAbsoluteTimeoutMs?: number;
  /** Override session `last_seen_at` write throttle (ms). */
  sessionTouchIntervalMs?: number;
  /** Override session token generator (for deterministic tests). */
  generateSessionToken?: () => string;
}

/** Wires repositories, the event bus, auth and the services. Shared by the app and the seed script. */
function createCore(deps: AppDeps) {
  const clock = deps.clock ?? (() => new Date());
  const authClock = deps.authClock ?? clock;
  const newId = deps.newId ?? randomUUID;
  const log = deps.log ?? ((message: string, error: unknown) => console.error(message, error));

  const users = createUserRepository(deps.db);
  const sessionsRepo = createSessionRepository(deps.db);
  const projects = createProjectRepository(deps.db);
  const transactions = createTransactionRepository(deps.db);
  const events = createEventRepository(deps.db);

  const hasher = createPasswordHasher(deps.scryptParams);
  const sessions = createSessionService({
    sessions: sessionsRepo,
    users,
    clock: authClock,
    generateToken: deps.generateSessionToken,
    idleTimeoutMs: deps.sessionIdleTimeoutMs,
    absoluteTimeoutMs: deps.sessionAbsoluteTimeoutMs,
    touchIntervalMs: deps.sessionTouchIntervalMs,
  });

  const loginEmailLimiter = createRateLimiter({
    limit: LOGIN_EMAIL_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
    clock: authClock,
  });
  const loginIpLimiter = createRateLimiter({
    limit: LOGIN_IP_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
    clock: authClock,
  });
  const registerIpLimiter = createRateLimiter({
    limit: REGISTER_IP_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
    clock: authClock,
  });

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
    newId,
    log,
    bus,
    hasher,
    sessions,
    limiters: {
      loginEmail: loginEmailLimiter,
      loginIp: loginIpLimiter,
      registerIp: registerIpLimiter,
    },
    /** Runs `work` in one SQLite transaction; the bus's own transactions nest as savepoints. */
    inTransaction: <T>(work: () => T): T => deps.db.transaction(work)(),
    repositories: { users, sessions: sessionsRepo, projects, transactions, events },
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
  const allowedOrigins = deps.allowedOrigins ?? parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders(deps.isProduction));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', csrfOriginCheck(allowedOrigins));

  app.use('/api', healthRouter({ clock: core.clock }));
  app.use(
    '/api/auth',
    authRouter({
      users: core.repositories.users,
      sessions: core.sessions,
      hasher: core.hasher,
      loginEmailLimiter: core.limiters.loginEmail,
      loginIpLimiter: core.limiters.loginIp,
      registerIpLimiter: core.limiters.registerIp,
      clock: core.clock,
      newId: core.newId,
    }),
  );

  const authenticated = requireAuth(core.sessions);
  app.use('/api', authenticated, readRouter(services));
  app.use(
    '/api/projects',
    authenticated,
    projectsRouter({ bus: core.bus, projects: services.projects }),
  );
  app.use(
    '/api/transactions',
    authenticated,
    transactionsRouter({ bus: core.bus, transactions: services.transactions }),
  );
  app.use('/api', unknownRoute);
  app.use(errorHandler(core.log));

  return app;
}

export { createApp, createCore };
export type { AppDeps, Core };
