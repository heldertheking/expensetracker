import { useState } from 'react';
import { getProject, listProjects, listTransactions } from '../api/endpoints';
import { ApiRequestError } from '../api/client';
import { useApi } from '../hooks/useApi';
import { formatChf } from '../lib/money';
import { Link } from '../router';
import { BudgetMeter } from '../components/BudgetMeter';
import { Pagination } from '../components/Pagination';
import { StatTile } from '../components/StatTile';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { TransactionTable } from '../components/TransactionTable';
import { TransactionDialogs } from '../components/TransactionEditor';
import type { TransactionDialog } from '../components/TransactionEditor';
import { PAGE_SIZE } from './TransactionsPage';

export function ProjectDetailPage({ id }: { id: string }) {
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<TransactionDialog>(null);
  const project = useApi((signal) => getProject(id, signal), id);
  const projects = useApi((signal) => listProjects(signal), 'projects');
  const transactions = useApi(
    (signal) => listTransactions({ projectId: id, limit: PAGE_SIZE, offset }, signal),
    `${id}:${offset}`,
  );

  const changed = () => {
    project.reload();
    projects.reload();
    transactions.reload();
  };

  if (project.error !== undefined) {
    const notFound = project.error instanceof ApiRequestError && project.error.code === 'not_found';
    return (
      <div className="page">
        <Link to="/projects" className="text-link back-link">
          ← All projects
        </Link>
        {notFound ? (
          <EmptyState title="Project not found">It may have been deleted.</EmptyState>
        ) : (
          <ErrorState
            error={project.error}
            title="Could not load the project"
            onRetry={project.reload}
          />
        )}
      </div>
    );
  }
  if (project.data === undefined) return <Loading label="Loading project" />;
  const p = project.data;

  return (
    <div className="page">
      <Link to="/projects" className="text-link back-link">
        ← All projects
      </Link>
      <header className="page-header">
        <div>
          <h1>{p.name}</h1>
          {p.description && <p className="muted">{p.description}</p>}
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => setDialog({ kind: 'create' })}
        >
          New tagged transaction
        </button>
      </header>

      <div className="tiles">
        <StatTile
          label="Budget"
          value={p.budgetCents === null ? 'No budget' : formatChf(p.budgetCents)}
          detail="Fixed at creation"
        />
        <StatTile label="Spent" value={formatChf(p.expenseCents)} detail="Tagged expenses" />
        <StatTile label="Refilled" value={formatChf(p.incomeCents)} detail="Tagged income" />
        <StatTile
          label="Remaining"
          value={p.remainingCents === null ? '–' : formatChf(p.remainingCents)}
          trend={p.overBudget ? 'down' : undefined}
          detail={p.overBudget ? 'Over budget' : 'Budget − spent + refilled'}
        />
      </div>

      {p.budgetCents !== null && (
        <section className="card" aria-label="Budget usage">
          <BudgetMeter project={p} />
        </section>
      )}

      <section className="card" aria-labelledby="tagged-title">
        <header className="card-header">
          <div>
            <h2 id="tagged-title" className="card-title">
              Tagged transactions
            </h2>
            <p className="card-summary">From the main and the savings account.</p>
          </div>
        </header>
        {transactions.error !== undefined ? (
          <ErrorState error={transactions.error} onRetry={transactions.reload} />
        ) : transactions.data === undefined ? (
          <Loading label="Loading transactions" />
        ) : transactions.data.items.length === 0 ? (
          <EmptyState title="No tagged transactions yet">
            Tag a transaction with this project to count it against the budget.
          </EmptyState>
        ) : (
          <>
            <TransactionTable
              caption={`Transactions tagged with ${p.name}`}
              transactions={transactions.data.items}
              projects={projects.data ?? [p]}
              onEdit={(transaction) => setDialog({ kind: 'edit', transaction })}
              onDelete={(transaction) => setDialog({ kind: 'delete', transaction })}
            />
            <Pagination
              total={transactions.data.total}
              limit={transactions.data.limit}
              offset={transactions.data.offset}
              onChange={setOffset}
            />
          </>
        )}
      </section>

      <TransactionDialogs
        dialog={dialog}
        projects={projects.data ?? [p]}
        defaultProjectId={p.id}
        onClose={() => setDialog(null)}
        onChanged={changed}
      />
    </div>
  );
}
