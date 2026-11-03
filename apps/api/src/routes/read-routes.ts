import { Router } from 'express';
import {
  AccountsResponse,
  EventListResponse,
  HealthSchema,
  ListEventsQuery,
  StatsQuery,
  StatsResponse,
} from '@expensetracker/schema';
import type { AccountService, EventService, StatsService } from '../services/read-services.js';
import { parseInput, sendParsed } from './http.js';

/** Read-only endpoints: health, account totals, statistics and the event log. */
function readRouter(deps: {
  accounts: AccountService;
  stats: StatsService;
  events: EventService;
  clock: () => Date;
}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    sendParsed(res, 200, HealthSchema, {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: deps.clock(),
    });
  });

  router.get('/accounts', (_req, res) => {
    sendParsed(res, 200, AccountsResponse, deps.accounts.summary());
  });

  router.get('/stats', (req, res) => {
    const query = parseInput(StatsQuery, req.query);
    sendParsed(res, 200, StatsResponse, deps.stats.stats(query));
  });

  router.get('/events', (req, res) => {
    const query = parseInput(ListEventsQuery, req.query);
    sendParsed(res, 200, EventListResponse, deps.events.list(query));
  });

  return router;
}

export { readRouter };
