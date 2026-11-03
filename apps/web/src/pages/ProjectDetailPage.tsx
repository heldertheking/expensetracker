import { useState } from 'react';
import { getProject, listProjects, listTransactions } from '../api/endpoints';
import { ApiRequestError } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useRouteAccessibility';
import { formatChf } from '../lib/money';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import AddIcon from '@mui/icons-material/Add';
import { Page, PageHeader, ResponsiveGrid, SectionCard } from '../components/Layout';
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
  useDocumentTitle(project.data?.name);
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
      <Page>
        <Link href="/projects" underline="hover" sx={{ alignSelf: 'flex-start' }}>
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
      </Page>
    );
  }
  if (project.data === undefined) return <Loading label="Loading project" />;
  const p = project.data;

  return (
    <Page>
      <Link href="/projects" underline="hover" sx={{ alignSelf: 'flex-start' }}>
        ← All projects
      </Link>
      <PageHeader
        title={p.name}
        subtitle={p.description || undefined}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ kind: 'create' })}
          >
            New tagged transaction
          </Button>
        }
      />

      <ResponsiveGrid columns={4}>
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
      </ResponsiveGrid>

      {p.budgetCents !== null && (
        <SectionCard title="Budget usage">
          <BudgetMeter project={p} />
        </SectionCard>
      )}

      <SectionCard
        title="Tagged transactions"
        subtitle="From the main and the savings account."
        dimmed={transactions.loading && transactions.data !== undefined}
      >
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
      </SectionCard>

      <TransactionDialogs
        dialog={dialog}
        projects={projects.data ?? [p]}
        defaultProjectId={p.id}
        onClose={() => setDialog(null)}
        onChanged={changed}
      />
    </Page>
  );
}
