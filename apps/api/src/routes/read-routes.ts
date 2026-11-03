import { Router } from 'express';
import {
  AccountsResponse,
  EventListResponse,
  HealthSchema,
  ListEventsQuery,
  StatsQuery,
  StatsResponse,
} from '@expensetracker/schema';
import { authenticatedUserId } from '../auth/security.js';
import type { AccountService, EventService, StatsService } from '../services/read-services.js';
import { parseInput, sendParsed } from './http.js';

/** Unauthenticated `/api/health` probe. */
function healthRouter(deps: { clock: () => Date }): Router {
  const router = Router();
  router.get('/health', (_req, res) => {
    sendParsed(res, 200, HealthSchema, {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: deps.clock(),
    });
  });
  return router;
}

/** Authenticated read-only endpoints: account totals, statistics and the event log. */
function readRouter(deps: {
  accounts: AccountService;
  stats: StatsService;
  events: EventService;
}): Router {
  const router = Router();

  router.get('/accounts', (req, res) => {
    const userId = authenticatedUserId(req);
    sendParsed(res, 200, AccountsResponse, deps.accounts.summary(userId));
  });

  router.get('/stats', (req, res) => {
    const userId = authenticatedUserId(req);
    const query = parseInput(StatsQuery, req.query);
    sendParsed(res, 200, StatsResponse, deps.stats.stats(userId, query));
  });

  router.get('/events', (req, res) => {
    const userId = authenticatedUserId(req);
    const query = parseInput(ListEventsQuery, req.query);
    sendParsed(res, 200, EventListResponse, deps.events.list(userId, query));
  });

  return router;
}

export { healthRouter, readRouter };
