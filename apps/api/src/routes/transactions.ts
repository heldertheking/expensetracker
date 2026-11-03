import { Router } from 'express';
import {
  CreateTransactionRequest,
  ListTransactionsQuery,
  TransactionListResponse,
  TransactionParams,
  TransactionResponse,
  UpdateTransactionRequest,
} from '@expensetracker/schema';
import { authenticatedUserId } from '../auth/security.js';
import type { EventBus } from '../events/event-bus.js';
import type { TransactionService } from '../services/read-services.js';
import { parseInput, sendParsed } from './http.js';

/** `/api/transactions`: reads through the service, writes as business events through the bus. */
function transactionsRouter(deps: { bus: EventBus; transactions: TransactionService }): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const userId = authenticatedUserId(req);
    const query = parseInput(ListTransactionsQuery, req.query);
    sendParsed(res, 200, TransactionListResponse, deps.transactions.list(userId, query));
  });

  router.post('/', (req, res) => {
    const userId = authenticatedUserId(req);
    const request = parseInput(CreateTransactionRequest, req.body);
    const created = deps.bus.dispatch(userId, 'CreateTransactionEvent', request);
    sendParsed(res, 201, TransactionResponse, created);
  });

  router.get('/:id', (req, res) => {
    const userId = authenticatedUserId(req);
    const { id } = parseInput(TransactionParams, req.params);
    sendParsed(res, 200, TransactionResponse, deps.transactions.get(userId, id));
  });

  router.patch('/:id', (req, res) => {
    const userId = authenticatedUserId(req);
    const { id } = parseInput(TransactionParams, req.params);
    const patch = parseInput(UpdateTransactionRequest, req.body);
    const updated = deps.bus.dispatch(userId, 'UpdateTransactionEvent', { id, patch });
    sendParsed(res, 200, TransactionResponse, updated);
  });

  router.delete('/:id', (req, res) => {
    const userId = authenticatedUserId(req);
    const { id } = parseInput(TransactionParams, req.params);
    deps.bus.dispatch(userId, 'DeleteTransactionEvent', { id });
    res.status(204).end();
  });

  return router;
}

export { transactionsRouter };
