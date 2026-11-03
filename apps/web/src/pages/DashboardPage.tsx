import { useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import type { AccountsResponse, StatsResponse } from '@expensetracker/schema';
import { getAccounts, getStats, listEvents, listProjects } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import { monthRange } from '../lib/dates';
import { formatChf, formatSignedChf } from '../lib/money';
import { StatTile } from '../components/StatTile';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { ChoiceField } from '../components/ChoiceField';
import { Page, PageHeader, ResponsiveGrid, SectionCard } from '../components/Layout';
import { BalanceChart } from '../components/charts/BalanceChart';
import { MonthlyFlowChart } from '../components/charts/MonthlyFlowChart';
import { ProjectSpendingChart } from '../components/charts/ProjectSpendingChart';
import { BudgetMeter } from '../components/BudgetMeter';
import { ActivityList } from '../components/ActivityList';

export const RANGE_OPTIONS = ['3', '6', '12'] as const;
export type RangeMonths = (typeof RANGE_OPTIONS)[number];

function accountBalance(accounts: AccountsResponse, account: 'main' | 'savings'): number {
  return accounts.accounts.find((a) => a.account === account)?.balanceCents ?? 0;
}

function StatTiles({ accounts, stats }: { accounts: AccountsResponse; stats?: StatsResponse }) {
  const thisMonth = stats?.monthly.at(-1);
  const net = thisMonth?.netCents;
  return (
    <ResponsiveGrid columns={4}>
      <StatTile
        hero
        label="Total balance"
        value={formatChf(accounts.total.balanceCents)}
        detail="Main and savings together"
      />
      <StatTile
        label="Main account"
        value={formatChf(accountBalance(accounts, 'main'))}
        detail="Everyday account"
      />
      <StatTile
        label="Savings account"
        value={formatChf(accountBalance(accounts, 'savings'))}
        detail="Savings account"
      />
      <StatTile
        label="Net this month"
        value={net === undefined ? '–' : formatSignedChf(net)}
        trend={net === undefined ? undefined : net > 0 ? 'up' : net < 0 ? 'down' : 'flat'}
        detail={
          thisMonth
            ? `${formatChf(thisMonth.incomeCents)} in · ${formatChf(thisMonth.expenseCents)} out`
            : undefined
        }
      />
    </ResponsiveGrid>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<RangeMonths>('6');
  const { from, to } = monthRange(Number(range));

  const accounts = useApi((signal) => getAccounts(signal), 'accounts');
  const stats = useApi((signal) => getStats({ from, to }, signal), `${from}:${to}`);
  const projects = useApi((signal) => listProjects(signal), 'projects');
  const events = useApi((signal) => listEvents({ limit: 6 }, signal), 'events');

  const isEmpty =
    accounts.data !== undefined &&
    accounts.data.total.incomeCents === 0 &&
    accounts.data.total.expenseCents === 0;
  const budgeted = (projects.data ?? []).filter((p) => p.budgetCents !== null);

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        subtitle="Your money across both accounts and all projects."
        actions={
          !isEmpty && (
            <ChoiceField
              label="Time range"
              hideLabel
              size="small"
              value={range}
              options={RANGE_OPTIONS.map((months) => ({
                value: months,
                label: `${months} months`,
              }))}
              onChange={setRange}
            />
          )
        }
      />

      {accounts.error !== undefined ? (
        <ErrorState
          error={accounts.error}
          title="Could not load balances"
          onRetry={accounts.reload}
        />
      ) : accounts.data === undefined ? (
        <Loading label="Loading balances" />
      ) : (
        <StatTiles accounts={accounts.data} stats={stats.data} />
      )}

      {isEmpty ? (
        <Card>
          <EmptyState
            title="No transactions yet"
            action={
              <Button variant="contained" href="/transactions">
                Add your first transaction
              </Button>
            }
          >
            Once you record income and expenses, your balances, monthly flows and project spending
            show up here.
          </EmptyState>
        </Card>
      ) : (
        <>
          {stats.error !== undefined ? (
            <ErrorState
              error={stats.error}
              title="Could not load statistics"
              onRetry={stats.reload}
            />
          ) : stats.data === undefined ? (
            <Loading label="Loading charts" rows={6} />
          ) : (
            <ResponsiveGrid>
              <BalanceChart balances={stats.data.balances} dimmed={stats.loading} />
              <MonthlyFlowChart monthly={stats.data.monthly} dimmed={stats.loading} />
              <ProjectSpendingChart items={stats.data.expenseByProject} dimmed={stats.loading} />
            </ResponsiveGrid>
          )}

          <ResponsiveGrid>
            <SectionCard title="Budget usage" link={{ href: '/projects', label: 'All projects' }}>
              {projects.error !== undefined ? (
                <ErrorState error={projects.error} onRetry={projects.reload} />
              ) : projects.data === undefined ? (
                <Loading />
              ) : budgeted.length === 0 ? (
                <EmptyState title="No projects with a budget">
                  Give a project a budget when you create it to track its usage here.
                </EmptyState>
              ) : (
                <Stack component="ul" spacing={2.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {budgeted.map((project) => (
                    <Stack component="li" key={project.id} spacing={0.75}>
                      <Link
                        href={`/projects/${project.id}`}
                        underline="hover"
                        color="text.primary"
                        sx={{ fontWeight: 600, alignSelf: 'flex-start' }}
                      >
                        {project.name}
                      </Link>
                      <BudgetMeter project={project} />
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard
              title="Recent activity"
              link={{ href: '/activity', label: 'All activity' }}
            >
              {events.error !== undefined ? (
                <ErrorState error={events.error} onRetry={events.reload} />
              ) : events.data === undefined ? (
                <Loading />
              ) : events.data.items.length === 0 ? (
                <EmptyState title="Nothing happened yet" />
              ) : (
                <ActivityList events={events.data.items} />
              )}
            </SectionCard>
          </ResponsiveGrid>
        </>
      )}
    </Page>
  );
}
