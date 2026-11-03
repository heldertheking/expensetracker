import { useState } from 'react';
import type { AccountsResponse, StatsResponse } from '@expensetracker/schema';
import { getAccounts, getStats, listEvents, listProjects } from '../api/endpoints';
import { useApi } from '../hooks/useApi';
import { monthRange } from '../lib/dates';
import { formatChf, formatSignedChf } from '../lib/money';
import { Link } from '../router';
import { StatTile } from '../components/StatTile';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { BalanceChart } from '../components/charts/BalanceChart';
import { MonthlyFlowChart } from '../components/charts/MonthlyFlowChart';
import { ProjectSpendingChart } from '../components/charts/ProjectSpendingChart';
import { BudgetMeter } from '../components/BudgetMeter';
import { ActivityList } from '../components/ActivityList';

export const RANGE_OPTIONS = [3, 6, 12] as const;
export type RangeMonths = (typeof RANGE_OPTIONS)[number];

function accountBalance(accounts: AccountsResponse, account: 'main' | 'savings'): number {
  return accounts.accounts.find((a) => a.account === account)?.balanceCents ?? 0;
}

function StatTiles({ accounts, stats }: { accounts: AccountsResponse; stats?: StatsResponse }) {
  const thisMonth = stats?.monthly.at(-1);
  const net = thisMonth?.netCents;
  return (
    <div className="tiles">
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
    </div>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: RangeMonths;
  onChange: (months: RangeMonths) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">Time range</legend>
      {RANGE_OPTIONS.map((months) => (
        <label key={months} className={value === months ? 'is-selected' : ''}>
          <input
            type="radio"
            name="range"
            value={months}
            checked={value === months}
            onChange={() => onChange(months)}
          />
          {months} months
        </label>
      ))}
    </fieldset>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<RangeMonths>(6);
  const { from, to } = monthRange(range);

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
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Your money across both accounts and all projects.</p>
        </div>
        {!isEmpty && <RangeSelector value={range} onChange={setRange} />}
      </header>

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
        <EmptyState
          title="No transactions yet"
          action={
            <Link to="/transactions" className="button primary">
              Add your first transaction
            </Link>
          }
        >
          Once you record income and expenses, your balances, monthly flows and project spending
          show up here.
        </EmptyState>
      ) : (
        <>
          {stats.error !== undefined ? (
            <ErrorState
              error={stats.error}
              title="Could not load statistics"
              onRetry={stats.reload}
            />
          ) : stats.data === undefined ? (
            <Loading label="Loading charts" />
          ) : (
            <div className="chart-grid">
              <BalanceChart balances={stats.data.balances} dimmed={stats.loading} />
              <MonthlyFlowChart monthly={stats.data.monthly} dimmed={stats.loading} />
              <ProjectSpendingChart items={stats.data.expenseByProject} dimmed={stats.loading} />
            </div>
          )}

          <div className="two-col">
            <section className="card" aria-labelledby="budget-title">
              <header className="card-header">
                <h2 id="budget-title" className="card-title">
                  Budget usage
                </h2>
                <Link to="/projects" className="text-link">
                  All projects
                </Link>
              </header>
              {projects.error !== undefined ? (
                <ErrorState error={projects.error} onRetry={projects.reload} />
              ) : projects.data === undefined ? (
                <Loading />
              ) : budgeted.length === 0 ? (
                <EmptyState title="No projects with a budget">
                  Give a project a budget when you create it to track its usage here.
                </EmptyState>
              ) : (
                <ul className="budget-list">
                  {budgeted.map((project) => (
                    <li key={project.id}>
                      <Link to={`/projects/${project.id}`} className="budget-name">
                        {project.name}
                      </Link>
                      <BudgetMeter project={project} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card" aria-labelledby="recent-title">
              <header className="card-header">
                <h2 id="recent-title" className="card-title">
                  Recent activity
                </h2>
                <Link to="/activity" className="text-link">
                  All activity
                </Link>
              </header>
              {events.error !== undefined ? (
                <ErrorState error={events.error} onRetry={events.reload} />
              ) : events.data === undefined ? (
                <Loading />
              ) : events.data.items.length === 0 ? (
                <EmptyState title="Nothing happened yet" />
              ) : (
                <ActivityList events={events.data.items} />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
