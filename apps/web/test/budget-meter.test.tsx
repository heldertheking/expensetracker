import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectSchema } from '@expensetracker/schema';
import { BudgetMeter } from '../src/components/BudgetMeter';
import * as f from './fixtures';

function meter(overrides: Parameters<typeof f.project>[0]) {
  render(<BudgetMeter project={ProjectSchema.parse(f.project(overrides))} />);
  return screen.getByRole('progressbar');
}

describe('BudgetMeter', () => {
  it('never shows a negative percent when tagged income exceeds the spending', () => {
    // budget 100.00, 20.00 refilled, nothing spent: net usage is -20%
    const bar = meter({ budgetCents: 10000, expenseCents: 0, incomeCents: 2000 });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringMatching(/^0% used\./));
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('-20%')).not.toBeInTheDocument();
  });

  it('keeps showing the real percent above 100% for an over-budget project', () => {
    const bar = meter({ budgetCents: 10000, expenseCents: 15000, incomeCents: 0 });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringMatching(/^150% used\./));
    expect(screen.getByText('150%')).toBeInTheDocument();
    expect(screen.getByText('Over budget')).toBeInTheDocument();
  });
});
