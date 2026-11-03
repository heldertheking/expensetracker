import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMonth, monthRange, toIsoDate } from '../src/lib/dates';

describe('dates', () => {
  it('formats local dates as ISO', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('computes whole-month ranges up to today', () => {
    const today = new Date(2026, 10, 3);
    expect(monthRange(3, today)).toEqual({ from: '2026-09-01', to: '2026-11-03' });
    expect(monthRange(12, today)).toEqual({ from: '2025-12-01', to: '2026-11-03' });
    expect(monthRange(1, today)).toEqual({ from: '2026-11-01', to: '2026-11-03' });
  });

  it('crosses year boundaries', () => {
    expect(monthRange(6, new Date(2026, 1, 28))).toEqual({ from: '2025-09-01', to: '2026-02-28' });
  });

  it('formats months and dates for display', () => {
    expect(formatMonth('2026-03')).toBe('Mar 26');
    expect(formatMonth('2026-12', true)).toBe('Dec 2026');
    expect(formatDate('2026-03-07')).toBe('07.03.2026');
    expect(formatDateTime(new Date(2026, 2, 7, 9, 5))).toBe('07.03.2026 09:05');
  });
});
