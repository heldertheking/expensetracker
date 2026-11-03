import { validateTransactionUpdate } from '@expensetracker/schema';
import type { Transaction } from '@expensetracker/schema';
import { invalid, notFound, unprocessable } from '../../errors.js';
import type { EventHandler } from '../types.js';
import type { HandlerDeps } from './deps.js';

/** A transaction may only be tagged with a project that exists (422 otherwise). */
function assertProjectExists(deps: HandlerDeps, projectId: string | null | undefined): void {
  if (projectId === null || projectId === undefined) return;
  if (deps.projects.findById(projectId) === undefined) {
    throw unprocessable(`project ${projectId} does not exist`, [
      { path: 'projectId', message: 'the tagged project does not exist' },
    ]);
  }
}

function existingTransaction(deps: HandlerDeps, id: string): Transaction {
  const transaction = deps.transactions.findById(id);
  if (transaction === undefined) throw notFound('transaction', id);
  return transaction;
}

function createTransactionHandler(deps: HandlerDeps): EventHandler<'CreateTransactionEvent', void> {
  return {
    validate: (data) => assertProjectExists(deps, data.projectId),
    handle: (data) => {
      const now = deps.clock();
      const transaction: Transaction = {
        id: deps.newId(),
        account: data.account,
        type: data.type,
        amountCents: data.amountCents,
        date: data.date,
        description: data.description,
        projectId: data.projectId,
        createdAt: now,
        updatedAt: now,
      };
      deps.transactions.insert(transaction);
      return { result: transaction, payload: { transaction } };
    },
  };
}

function updateTransactionHandler(
  deps: HandlerDeps,
): EventHandler<'UpdateTransactionEvent', Transaction> {
  return {
    validate: ({ id, patch }) => {
      const existing = existingTransaction(deps, id);
      const issues = validateTransactionUpdate(existing, patch);
      if (issues.length > 0) throw invalid(issues);
      if (patch.projectId !== existing.projectId) assertProjectExists(deps, patch.projectId);
      return existing;
    },
    handle: ({ patch }, before) => {
      const after: Transaction = {
        ...before,
        type: patch.type ?? before.type,
        amountCents: patch.amountCents ?? before.amountCents,
        date: patch.date ?? before.date,
        description: patch.description ?? before.description,
        projectId: patch.projectId === undefined ? before.projectId : patch.projectId,
        updatedAt: deps.clock(),
      };
      deps.transactions.update(after);
      return { result: after, payload: { before, after } };
    },
  };
}

function deleteTransactionHandler(
  deps: HandlerDeps,
): EventHandler<'DeleteTransactionEvent', Transaction> {
  return {
    validate: ({ id }) => existingTransaction(deps, id),
    handle: (_data, transaction) => {
      deps.transactions.delete(transaction.id);
      return { result: transaction, payload: { transaction } };
    },
  };
}

export { createTransactionHandler, deleteTransactionHandler, updateTransactionHandler };
