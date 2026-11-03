import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { barClasses } from '@mui/x-charts/BarChart';
import { lineClasses } from '@mui/x-charts/LineChart';
import { monthRange } from '../src/lib/dates';
import * as f from './fixtures';
import { http, HttpResponse, recordGet, server } from './server';
import { renderApp } from './render';

function mockDashboard(
  overrides: { accounts?: unknown; stats?: unknown; projects?: unknown; events?: unknown } = {},
) {
  const stats = recordGet('/api/stats', overrides.stats ?? f.sampleStats());
  server.use(
    http.get('/api/accounts', () => HttpResponse.json(overrides.accounts ?? f.accounts())),
    stats.handler,
    http.get('/api/projects', () => HttpResponse.json(overrides.projects ?? f.projectList())),
    http.get('/api/events', () =>
      HttpResponse.json(overrides.events ?? f.page(f.sampleEvents(), { limit: 6 })),
    ),
  );
  return stats;
}

function tile(label: string) {
  return screen.getByRole('region', { name: label });
}

describe('Dashboard', () => {
  it('shows formatted totals in the stat tiles', async () => {
    mockDashboard();
    renderApp('/');
    expect(await screen.findByText("CHF 13'765.50")).toBeInTheDocument();
    expect(within(tile('Total balance')).getByText("CHF 13'765.50")).toBeInTheDocument();
    expect(within(tile('Main account')).getByText("CHF 3'765.50")).toBeInTheDocument();
    expect(within(tile('Savings account')).getByText("CHF 10'000.00")).toBeInTheDocument();
    // last month of the stats: 5'300 in, 4'500 out
    const net = tile('Net this month');
    expect(await within(net).findByText('+CHF 800.00')).toBeInTheDocument();
    expect(within(net).getByText("CHF 5'300.00 in · CHF 4'500.00 out")).toBeInTheDocument();
  });

  it('renders the charts with data and accessible summaries', async () => {
    mockDashboard();
    renderApp('/');
    const balance = await screen.findByRole('img', { name: 'Balance over time' });
    expect(balance).toHaveAccessibleDescription(
      "Total balance grew from CHF 8'100.00 at the end of Jun 2026 to CHF 11'300.00 at the end of Aug 2026.",
    );
    expect(screen.getByRole('img', { name: 'Income vs. expenses' })).toHaveAccessibleDescription(
      "Over 3 months: income CHF 15'700.00, expenses CHF 10'400.00, net +CHF 5'300.00.",
    );
    expect(screen.getByRole('img', { name: 'Spending per project' })).toHaveAccessibleDescription(
      "Expenses total CHF 10'400.00; the largest share is untagged expenses with CHF 8'600.00 (83%).",
    );
    // MUI X Charts drew SVG marks: lines for balances and net, bars for flows and projects
    await waitFor(() => expect(balance.querySelectorAll(`.${lineClasses.line}`)).toHaveLength(3));
    const flows = screen.getByRole('img', { name: 'Income vs. expenses' });
    expect(flows.querySelectorAll(`.${barClasses.element}`)).toHaveLength(6);
    expect(flows.querySelectorAll(`.${lineClasses.line}`)).toHaveLength(1);
    const spending = screen.getByRole('img', { name: 'Spending per project' });
    expect(spending.querySelectorAll(`.${barClasses.element}`)).toHaveLength(3);
    expect(screen.getAllByText('No project').length).toBeGreaterThan(0);
  });

  it('shows each chart as a table on request', async () => {
    mockDashboard();
    const { user } = renderApp('/');
    const card = (await screen.findByRole('img', { name: 'Income vs. expenses' })).closest(
      'section',
    )!;
    await user.click(within(card).getByRole('button', { name: 'Show table' }));
    const table = within(card).getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Aug 2026' })).toBeInTheDocument();
    expect(within(table).getByText("CHF 4'500.00")).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Show chart' }));
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
  });

  it('flags over-budget projects in the budget usage', async () => {
    mockDashboard();
    renderApp('/');
    const budget = (await screen.findByRole('heading', { name: 'Budget usage' })).closest(
      'section',
    )!;
    const meters = await within(budget).findAllByRole('progressbar');
    // the course has no budget, so it is not listed
    expect(meters).toHaveLength(2);
    expect(within(budget).getByText('Over budget')).toBeInTheDocument();
    expect(
      within(budget).getByText("Over budget by CHF 250.00 (CHF 1'250.00 of CHF 1'000.00)"),
    ).toBeInTheDocument();
    expect(
      within(budget).getByText("CHF 500.00 of CHF 2'000.00 used · CHF 1'500.00 left"),
    ).toBeInTheDocument();
  });

  it('lists recent activity', async () => {
    mockDashboard();
    renderApp('/');
    expect(await screen.findByText('Expense of CHF 45.50 added')).toBeInTheDocument();
    expect(screen.getByText('Project “Holiday” created')).toBeInTheDocument();
  });

  it('requests the selected range and refetches when it changes', async () => {
    const stats = mockDashboard();
    const { user } = renderApp('/');
    await screen.findByRole('img', { name: 'Balance over time' });
    expect(stats.urls.at(-1)!.searchParams.get('from')).toBe(monthRange(6).from);
    expect(stats.urls.at(-1)!.searchParams.get('to')).toBe(monthRange(6).to);

    await user.click(screen.getByRole('button', { name: '3 months' }));
    await waitFor(() =>
      expect(stats.urls.at(-1)!.searchParams.get('from')).toBe(monthRange(3).from),
    );
    await user.click(screen.getByRole('button', { name: '12 months' }));
    await waitFor(() =>
      expect(stats.urls.at(-1)!.searchParams.get('from')).toBe(monthRange(12).from),
    );
    expect(screen.getByRole('button', { name: '12 months' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows an empty state before the first transaction', async () => {
    mockDashboard({
      accounts: f.emptyAccounts(),
      stats: f.stats('2026-11', [{ income: 0, expense: 0 }], { startMain: 0, startSavings: 0 }),
      projects: f.projectList([]),
      events: f.page([]),
    });
    renderApp('/');
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first transaction' })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(screen.queryByRole('img', { name: 'Balance over time' })).not.toBeInTheDocument();
    expect(within(tile('Total balance')).getByText('CHF 0.00')).toBeInTheDocument();
  });

  it('shows empty states inside cards without matching data', async () => {
    mockDashboard({
      stats: f.stats('2026-09', [
        { income: 1000, expense: 0 },
        { income: 0, expense: 0 },
      ]),
      projects: f.projectList([f.projects.course]),
      events: f.page([]),
    });
    renderApp('/');
    expect(await screen.findByText('No expenses in this range')).toBeInTheDocument();
    expect(screen.getByText('No projects with a budget')).toBeInTheDocument();
    expect(screen.getByText('Nothing happened yet')).toBeInTheDocument();
    expect(within(tile('Net this month')).getByText('CHF 0.00')).toBeInTheDocument();
  });

  it('shows error states and retries', async () => {
    let fail = true;
    server.use(
      http.get('/api/accounts', () =>
        fail
          ? HttpResponse.json(f.apiError('unprocessable', 'Database is locked'), { status: 422 })
          : HttpResponse.json(f.accounts()),
      ),
      http.get('/api/stats', () => new HttpResponse(null, { status: 500 })),
      http.get('/api/projects', () => HttpResponse.json(f.projectList())),
      http.get('/api/events', () => HttpResponse.json(f.page([]))),
    );
    const { user } = renderApp('/');
    expect(await screen.findByText('Could not load balances')).toBeInTheDocument();
    expect(screen.getByText('Database is locked')).toBeInTheDocument();
    expect(await screen.findByText('Could not load statistics')).toBeInTheDocument();
    expect(screen.getByText('Request failed with status 500')).toBeInTheDocument();

    fail = false;
    const alert = screen
      .getByText('Could not load balances')
      .closest('[role="alert"]') as HTMLElement;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText("CHF 13'765.50")).toBeInTheDocument();
  });

  it('rejects statistics that violate the contract', async () => {
    mockDashboard({ stats: { ...f.sampleStats(), to: '2027-01' } });
    renderApp('/');
    expect(await screen.findByText('Could not load statistics')).toBeInTheDocument();
    expect(screen.getByText(/unexpected response/)).toBeInTheDocument();
  });
});
