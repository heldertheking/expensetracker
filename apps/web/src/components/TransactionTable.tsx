import type { Project, Transaction } from '@expensetracker/schema';
import { formatDate } from '../lib/dates';
import { formatChf } from '../lib/money';
import { ACCOUNT_LABELS } from '../lib/events';
import { Link } from '../router';

interface TransactionTableProps {
  transactions: Transaction[];
  projects: Project[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  caption: string;
}

export function signedAmount(transaction: Transaction): string {
  const sign = transaction.type === 'income' ? '+' : '-';
  return `${sign}${formatChf(transaction.amountCents)}`;
}

export function TransactionTable({
  transactions,
  projects,
  onEdit,
  onDelete,
  caption,
}: TransactionTableProps) {
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  return (
    <div className="table-wrap">
      <table className="data-table transactions-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Project</th>
            <th scope="col">Account</th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const projectName = t.projectId ? projectNames.get(t.projectId) : undefined;
            return (
              <tr key={t.id}>
                <td data-label="Date">{formatDate(t.date)}</td>
                <td data-label="Description">{t.description}</td>
                <td data-label="Project">
                  {t.projectId ? (
                    <Link to={`/projects/${t.projectId}`} className="tag">
                      {projectName ?? 'Unknown project'}
                    </Link>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td data-label="Account">
                  <span className={`account-pill account-${t.account}`}>
                    {ACCOUNT_LABELS[t.account]}
                  </span>
                </td>
                <td data-label="Amount" className={`num amount amount-${t.type}`}>
                  <span className="visually-hidden">
                    {t.type === 'income' ? 'Income' : 'Expense'}{' '}
                  </span>
                  {signedAmount(t)}
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => onEdit(t)}
                    aria-label={`Edit ${t.description}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button ghost small danger-text"
                    onClick={() => onDelete(t)}
                    aria-label={`Delete ${t.description}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
