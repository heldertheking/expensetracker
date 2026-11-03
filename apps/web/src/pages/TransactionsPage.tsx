import { useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import type { Account, TransactionType } from '@expensetracker/schema';
import { ChoiceField } from '../components/ChoiceField';
import { Page, PageHeader } from '../components/Layout';
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

  const create = () => setDialog({ kind: 'create' });

  return (
    <Page>
      <PageHeader
        title="Transactions"
        subtitle="Income and expenses on the main and savings account."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={create}>
            New transaction
          </Button>
        }
      />

      <Stack
        role="group"
        aria-label="Filters"
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ flexWrap: 'wrap', alignItems: 'center' }}
      >
        <ChoiceField
          label="Account"
          hideLabel
          size="small"
          value={filters.account}
          options={[
            { value: '', label: 'All accounts' },
            { value: 'main', label: 'Main' },
            { value: 'savings', label: 'Savings' },
          ]}
          onChange={(account) => setFilter('account', account)}
        />
        <TextField
          select
          size="small"
          label="Project"
          value={filters.projectId}
          onChange={(e) => setFilter('projectId', e.target.value)}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 180 }}
        >
          <option value="">All projects</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Type"
          value={filters.type}
          onChange={(e) => setFilter('type', e.target.value as Filters['type'])}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 180 }}
        >
          <option value="">Income and expenses</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
        </TextField>
        {filtered && (
          <Button
            size="small"
            startIcon={<FilterAltOffOutlinedIcon />}
            onClick={() => {
              setFilters(NO_FILTERS);
              setOffset(0);
            }}
          >
            Clear filters
          </Button>
        )}
      </Stack>

      <Card sx={{ opacity: list.loading && list.data ? 0.55 : 1, transition: 'opacity 150ms' }}>
        <CardContent>
          {list.error !== undefined ? (
            <ErrorState
              error={list.error}
              title="Could not load transactions"
              onRetry={list.reload}
            />
          ) : list.data === undefined ? (
            <Loading label="Loading transactions" rows={6} />
          ) : list.data.items.length === 0 ? (
            offset > 0 ? (
              <EmptyState
                title="This page is empty"
                action={<Button onClick={() => setOffset(0)}>Back to the first page</Button>}
              />
            ) : filtered ? (
              <EmptyState title="No matching transactions">Try other filters.</EmptyState>
            ) : (
              <EmptyState
                title="No transactions yet"
                action={
                  <Button variant="contained" onClick={create}>
                    Add your first transaction
                  </Button>
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
        </CardContent>
      </Card>

      <TransactionDialogs
        dialog={dialog}
        projects={projects.data ?? []}
        onClose={() => setDialog(null)}
        onChanged={list.reload}
      />
    </Page>
  );
}
