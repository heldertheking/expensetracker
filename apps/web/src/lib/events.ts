import type { BusinessEvent, BusinessEventType, Transaction } from '@expensetracker/schema';
import { formatDate } from './dates';
import { formatChf } from './money';

export const EVENT_TYPE_LABELS: Record<BusinessEventType, string> = {
  CreateTransactionEvent: 'Transaction created',
  UpdateTransactionEvent: 'Transaction updated',
  DeleteTransactionEvent: 'Transaction deleted',
  CreateProjectEvent: 'Project created',
  UpdateProjectEvent: 'Project updated',
  DeleteProjectEvent: 'Project deleted',
};

export const ACCOUNT_LABELS = { main: 'Main', savings: 'Savings' } as const;

const kind = (t: Transaction) => (t.type === 'income' ? 'Income' : 'Expense');

function transactionChanges(before: Transaction, after: Transaction): string[] {
  const changes: string[] = [];
  if (before.type !== after.type) changes.push(`type ${before.type} → ${after.type}`);
  if (before.amountCents !== after.amountCents) {
    changes.push(`amount ${formatChf(before.amountCents)} → ${formatChf(after.amountCents)}`);
  }
  if (before.date !== after.date) {
    changes.push(`date ${formatDate(before.date)} → ${formatDate(after.date)}`);
  }
  if (before.description !== after.description) {
    changes.push(`description “${before.description}” → “${after.description}”`);
  }
  if (before.projectId !== after.projectId) {
    changes.push(after.projectId === null ? 'project tag removed' : 'project tag changed');
  }
  return changes;
}

export interface EventDescription {
  title: string;
  detail: string;
  tone: 'create' | 'update' | 'delete';
}

/** A readable sentence for each event type, built from the payload snapshots. */
export function describeEvent(event: BusinessEvent): EventDescription {
  switch (event.type) {
    case 'CreateTransactionEvent': {
      const t = event.payload.transaction;
      return {
        tone: 'create',
        title: `${kind(t)} of ${formatChf(t.amountCents)} added`,
        detail: `“${t.description}” on ${ACCOUNT_LABELS[t.account]}, ${formatDate(t.date)}`,
      };
    }
    case 'UpdateTransactionEvent': {
      const { before, after } = event.payload;
      const changes = transactionChanges(before, after);
      return {
        tone: 'update',
        title: `Transaction “${after.description}” updated`,
        detail: changes.length > 0 ? capitalize(changes.join(', ')) : 'No visible changes',
      };
    }
    case 'DeleteTransactionEvent': {
      const t = event.payload.transaction;
      return {
        tone: 'delete',
        title: `${kind(t)} of ${formatChf(t.amountCents)} deleted`,
        detail: `“${t.description}” from ${ACCOUNT_LABELS[t.account]}, ${formatDate(t.date)}`,
      };
    }
    case 'CreateProjectEvent': {
      const p = event.payload.project;
      return {
        tone: 'create',
        title: `Project “${p.name}” created`,
        detail: p.budgetCents === null ? 'Without a budget' : `Budget ${formatChf(p.budgetCents)}`,
      };
    }
    case 'UpdateProjectEvent': {
      const { before, after } = event.payload;
      const changes: string[] = [];
      if (before.name !== after.name) changes.push(`Renamed from “${before.name}”`);
      if (before.description !== after.description) changes.push('Description changed');
      return {
        tone: 'update',
        title: `Project “${after.name}” updated`,
        detail: changes.length > 0 ? changes.join(', ') : 'No visible changes',
      };
    }
    case 'DeleteProjectEvent': {
      const p = event.payload.project;
      return { tone: 'delete', title: `Project “${p.name}” deleted`, detail: p.description };
    }
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
