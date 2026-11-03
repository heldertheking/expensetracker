import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NO_PROJECT_NAME } from '@expensetracker/schema';
import { Modal } from '../src/components/Modal';
import { spendingRows, spendingSummary } from '../src/components/charts/ProjectSpendingChart';
import { balanceSummary } from '../src/components/charts/BalanceChart';
import { flowSummary } from '../src/components/charts/MonthlyFlowChart';
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
