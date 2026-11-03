import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { BusinessEventSchema } from '@expensetracker/schema';
import { describeEvent } from '../src/lib/events';
import * as f from './fixtures';
import { recordGet, server } from './server';
import { renderApp } from './render';

describe('describeEvent', () => {
  it('describes every event type from its payload', () => {
    const described = f.sampleEvents().map((e) => describeEvent(BusinessEventSchema.parse(e)));
    expect(described).toEqual([
      {
        tone: 'create',
        title: 'Expense of CHF 45.50 added',
        detail: '“Groceries” on Main, 14.06.2026',
      },
      {
        tone: 'update',
        title: 'Transaction “Groceries” updated',
        detail: 'Amount CHF 45.50 → CHF 50.00',
      },
      {
        tone: 'delete',
        title: 'Expense of CHF 45.50 deleted',
        detail: '“Old bill” from Main, 14.06.2026',
      },
      { tone: 'create', title: 'Project “Holiday” created', detail: "Budget CHF 2'000.00" },
      {
        tone: 'update',
        title: 'Project “Kitchen renovation” updated',
        detail: 'Renamed from “Renovation”',
      },
      { tone: 'delete', title: 'Project “Language course” deleted', detail: '' },
    ]);
  });

  it('lists every changed transaction field', () => {
    const before = f.transaction({ projectId: f.PROJECT_IDS.holiday });
    const event = BusinessEventSchema.parse(
      f.updateTransactionEvent(before, {
        type: 'income',
        amountCents: 100,
        date: '2026-06-01',
        description: 'Refund',
        projectId: null,
      }),
    );
    expect(describeEvent(event).detail).toBe(
      'Type expense → income, amount CHF 45.50 → CHF 1.00, date 14.06.2026 → 01.06.2026, description “Groceries” → “Refund”, project tag removed',
    );
  });

  it('describes projects without a budget and description changes', () => {
    const created = BusinessEventSchema.parse(f.createProjectEvent(f.projects.course));
    expect(describeEvent(created).detail).toBe('Without a budget');
    const updated = BusinessEventSchema.parse(
      f.updateProjectEvent(f.projects.course, { description: 'Italian' }),
    );
    expect(describeEvent(updated).detail).toBe('Description changed');
  });
});

describe('Activity page', () => {
  it('shows readable events, filters by type and pages', async () => {
    const events = f.sampleEvents();
    const older = Array.from({ length: 20 }, (_, i) =>
      f.createTransactionEvent(
        f.transaction({ description: `Older ${i + 1}`, amountCents: 100 + i }),
      ),
    );
    const all = [...events, ...older]; // 26 events, newest first
    const feed = recordGet('/api/events', (url) => {
      const type = url.searchParams.get('type');
      const offset = Number(url.searchParams.get('offset'));
      if (type)
        return f.page(
          events.filter((e) => e.type === type),
          { limit: 20 },
        );
      return f.page(all.slice(offset, offset + 20), { total: all.length, limit: 20, offset });
    });
    server.use(feed.handler);
    const { user } = renderApp('/activity');

    expect(await screen.findByText('Expense of CHF 45.50 added')).toBeInTheDocument();
    expect(screen.getByText('Project “Kitchen renovation” updated')).toBeInTheDocument();
    const list = document.querySelector('.activity-list') as HTMLElement;
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);

    const nav = screen.getByRole('navigation', { name: 'Activity pages' });
    expect(within(nav).getByText('1–20 of 26 · page 1 of 2')).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('21–26 of 26 · page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('“Older 20” on Main, 14.06.2026')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Event type' }),
      'Project created',
    );
    await waitFor(() =>
      expect(feed.urls.at(-1)!.searchParams.get('type')).toBe('CreateProjectEvent'),
    );
    await waitFor(() =>
      expect(screen.queryByText('Expense of CHF 45.50 added')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Project “Holiday” created')).toBeInTheDocument();

    // a new filter starts again at the first page
    expect(feed.urls.at(-1)!.searchParams.get('offset')).toBe('0');
  });

  it('shows an empty state for a type without events', async () => {
    const feed = recordGet('/api/events', f.page([]));
    server.use(feed.handler);
    const { user } = renderApp('/activity');
    expect(await screen.findByText('Nothing happened yet')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Event type' }),
      'Project deleted',
    );
    expect(await screen.findByText('No events of this type')).toBeInTheDocument();
  });
});
