import type { Project, Transaction } from '@expensetracker/schema';
import { deleteTransaction } from '../api/endpoints';
import { formatChf } from '../lib/money';
import { formatDate } from '../lib/dates';
import { ConfirmDialog, Modal } from './Modal';
import { TransactionForm } from './TransactionForm';

export type TransactionDialog =
  | { kind: 'create' }
  | { kind: 'edit'; transaction: Transaction }
  | { kind: 'delete'; transaction: Transaction }
  | null;

interface TransactionDialogsProps {
  dialog: TransactionDialog;
  projects: Project[];
  defaultProjectId?: string | null;
  onClose: () => void;
  /** Called after a create, update or delete went through. */
  onChanged: () => void;
}

/** The create, edit and delete dialogs for transactions, shared by the list and project pages. */
export function TransactionDialogs({
  dialog,
  projects,
  defaultProjectId,
  onClose,
  onChanged,
}: TransactionDialogsProps) {
  if (dialog === null) return null;
  const done = () => {
    onClose();
    onChanged();
  };
  if (dialog.kind === 'delete') {
    const t = dialog.transaction;
    return (
      <ConfirmDialog
        title="Delete transaction?"
        message={`“${t.description}” (${t.type}, ${formatChf(t.amountCents)}, ${formatDate(t.date)}) will be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteTransaction(t.id);
          done();
        }}
        onClose={onClose}
      />
    );
  }
  return (
    <Modal
      title={dialog.kind === 'edit' ? 'Edit transaction' : 'New transaction'}
      onClose={onClose}
    >
      <TransactionForm
        transaction={dialog.kind === 'edit' ? dialog.transaction : undefined}
        projects={projects}
        defaultProjectId={defaultProjectId}
        onSaved={done}
        onCancel={onClose}
      />
    </Modal>
  );
}
