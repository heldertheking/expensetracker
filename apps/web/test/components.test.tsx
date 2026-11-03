import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { barClasses } from '@mui/x-charts/BarChart';
import userEvent from '@testing-library/user-event';
import { NO_PROJECT_NAME } from '@expensetracker/schema';
import { Modal } from '../src/components/Modal';
import { spendingRows, spendingSummary } from '../src/components/charts/ProjectSpendingChart';
import { balanceSummary } from '../src/components/charts/BalanceChart';
import { flowSummary } from '../src/components/charts/MonthlyFlowChart';
import { ProjectSpendingChart } from '../src/components/charts/ProjectSpendingChart';
import { AppThemeProvider } from '../src/theme-context';
import { uuid } from './fixtures';

describe('Modal', () => {
  it('is a named dialog that keeps focus inside and closes with Escape or the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <button type="button">Outside</button>
        <Modal title="Edit" onClose={onClose}>
          <input aria-label="First" />
          <button type="button">Last</button>
        </Modal>
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('chart data helpers', () => {
  it('folds the tail of many projects into "Other projects"', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      projectId: uuid(500 + i),
      name: `P${i + 1}`,
      expenseCents: 1000 - i * 10,
    }));
    const rows = spendingRows(items);
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toEqual({
      key: 'other',
      name: 'Other projects',
      expenseCents: 940 + 930 + 920,
      untagged: false,
    });
  });

  it('keeps the untagged row out of the fold even when it ranks low', () => {
    const tagged = Array.from({ length: 9 }, (_, i) => ({
      projectId: uuid(600 + i),
      name: `P${i + 1}`,
      expenseCents: 1000 - i * 10,
    }));
    const items = [...tagged, { projectId: null, name: NO_PROJECT_NAME, expenseCents: 5 }];
    const rows = spendingRows(items);
    expect(rows).toHaveLength(7);
    expect(rows.filter((r) => r.untagged)).toEqual([
      { key: 'none', name: 'No project', expenseCents: 5, untagged: true },
    ]);
    // only real projects are folded: P6..P9, not the untagged row
    expect(rows.find((r) => r.key === 'other')?.expenseCents).toBe(950 + 940 + 930 + 920);
    expect(rows.reduce((sum, r) => sum + r.expenseCents, 0)).toBe(
      items.reduce((sum, r) => sum + r.expenseCents, 0),
    );
  });

  it('keys rows by id, so projects named like the synthetic rows do not collide', () => {
    const items = [
      { projectId: uuid(700), name: 'Other projects', expenseCents: 900 },
      { projectId: uuid(701), name: NO_PROJECT_NAME, expenseCents: 800 },
      ...Array.from({ length: 7 }, (_, i) => ({
        projectId: uuid(710 + i),
        name: `P${i + 1}`,
        expenseCents: 100 - i,
      })),
      { projectId: null, name: NO_PROJECT_NAME, expenseCents: 50 },
    ];
    const rows = spendingRows(items);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(rows.filter((r) => r.untagged)).toHaveLength(1);
    expect(rows.filter((r) => r.key === 'other')).toHaveLength(1);
    expect(rows.find((r) => r.name === 'Other projects' && r.key !== 'other')).toBeDefined();
  });

  it('draws one bar per row when real projects share names with the synthetic rows', () => {
    const items = [
      { projectId: uuid(800), name: 'Other projects', expenseCents: 900 },
      { projectId: uuid(801), name: NO_PROJECT_NAME, expenseCents: 800 },
      { projectId: null, name: NO_PROJECT_NAME, expenseCents: 700 },
      ...Array.from({ length: 5 }, (_, i) => ({
        projectId: uuid(810 + i),
        name: `P${i + 1}`,
        expenseCents: 100 - i,
      })),
    ];
    const { container } = render(
      <AppThemeProvider>
        <ProjectSpendingChart items={items} />
      </AppThemeProvider>,
    );
    expect(container.querySelectorAll(`.${barClasses.element}`)).toHaveLength(
      spendingRows(items).length,
    );
  });

  it('names untagged spending and handles empty data in summaries', () => {
    expect(spendingSummary([])).toBe('No expenses in this range.');
    expect(
      spendingRows([{ projectId: null, name: NO_PROJECT_NAME, expenseCents: 5 }])[0],
    ).toMatchObject({ name: 'No project', untagged: true });
    expect(balanceSummary([])).toBe('No balances in this range.');
    expect(
      balanceSummary([
        { month: '2026-01', mainCents: 500, savingsCents: 0, totalCents: 500 },
        { month: '2026-02', mainCents: 100, savingsCents: 0, totalCents: 100 },
      ]),
    ).toMatch(/^Total balance fell/);
    expect(
      flowSummary([{ month: '2026-01', incomeCents: 0, expenseCents: 100, netCents: -100 }]),
    ).toBe('Over 1 month: income CHF 0.00, expenses CHF 1.00, net -CHF 1.00.');
  });
});
