import { useState } from 'react';
import type { Account, TransactionType } from '@expensetracker/schema';
import { listProjects, listTransactions } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { Pagination } from '../components/Pagination';
import { TransactionTable } from '../components/TransactionTable';
import { TransactionDialogs } from '../components/TransactionEditor';
import type { TransactionDialog } from '../components/TransactionEditor';

export const PAGE_SIZE = 20;

interface Filters {
  account: Account | '';
  projectId: string;
  type: TransactionType | '';
}

const NO_FILTERS: Filters = { account: '', projectId: '', type: '' };

export function TransactionsPage() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<TransactionDialog>(null);

  const query = {
    account: filters.account || undefined,
    projectId: filters.projectId || undefined,
    type: filters.type || undefined,
    limit: PAGE_SIZE,
    offset,
  };
  const list = useApi((signal) => listTransactions(query, signal), JSON.stringify(query));
  const projects = useApi((signal) => listProjects(signal), 'projects');

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setOffset(0);
  };
  const filtered = filters.account !== '' || filters.projectId !== '' || filters.type !== '';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="muted">Income and expenses on the main and savings account.</p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => setDialog({ kind: 'create' })}
        >
          New transaction
        </button>
      </header>

      <div className="filters" role="group" aria-label="Filters">
        <fieldset className="segmented">
          <legend className="visually-hidden">Account</legend>
          {(
            [
              ['', 'All accounts'],
              ['main', 'Main'],
              ['savings', 'Savings'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={filters.account === value ? 'is-selected' : ''}>
              <input
                type="radio"
                name="account-filter"
                value={value}
                checked={filters.account === value}
                onChange={() => setFilter('account', value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="inline-field">
          <span>Project</span>
          <select
            value={filters.projectId}
            onChange={(e) => setFilter('projectId', e.target.value)}
          >
            <option value="">All projects</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>Type</span>
          <select
            value={filters.type}
            onChange={(e) => setFilter('type', e.target.value as Filters['type'])}
          >
            <option value="">Income and expenses</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              setFilters(NO_FILTERS);
              setOffset(0);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <section className={`card ${list.loading && list.data ? 'is-dimmed' : ''}`}>
        {list.error !== undefined ? (
          <ErrorState
            error={list.error}
            title="Could not load transactions"
            onRetry={list.reload}
          />
        ) : list.data === undefined ? (
          <Loading label="Loading transactions" />
        ) : list.data.items.length === 0 ? (
          offset > 0 ? (
            <EmptyState
              title="This page is empty"
              action={
                <button type="button" className="button" onClick={() => setOffset(0)}>
                  Back to the first page
                </button>
              }
            />
          ) : filtered ? (
            <EmptyState title="No matching transactions">Try other filters.</EmptyState>
          ) : (
            <EmptyState
              title="No transactions yet"
              action={
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setDialog({ kind: 'create' })}
                >
                  Add your first transaction
                </button>
              }
            >
              Record income and expenses on your main or savings account.
            </EmptyState>
          )
        ) : (
          <>
            <TransactionTable
              caption="Transactions, newest first"
              transactions={list.data.items}
              projects={projects.data ?? []}
              onEdit={(transaction) => setDialog({ kind: 'edit', transaction })}
              onDelete={(transaction) => setDialog({ kind: 'delete', transaction })}
            />
            <Pagination
              total={list.data.total}
              limit={list.data.limit}
              offset={list.data.offset}
              onChange={setOffset}
              label="Transaction pages"
            />
          </>
        )}
      </section>

      <TransactionDialogs
        dialog={dialog}
        projects={projects.data ?? []}
        onClose={() => setDialog(null)}
        onChanged={list.reload}
      />
    </div>
  );
}
