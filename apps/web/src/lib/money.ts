import { MAX_CENTS } from '@expensetracker/schema';

/** Groups the integer part with apostrophes, as in de-CH (`1'234'567`). */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/**
 * Formats integer cents as Swiss francs, e.g. `CHF 1'234.50` or `CHF -12.00`. Works on the
 * integer directly, so there is no float rounding on the way.
 */
export function formatChf(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  const francs = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `CHF ${sign}${groupThousands(String(francs))}.${rest}`;
}

/** Like `formatChf`, but always with a sign, for changes (`+CHF 12.00`, `-CHF 3.50`). */
export function formatSignedChf(cents: number): string {
  if (cents === 0) return formatChf(0);
  const body = formatChf(Math.abs(cents)).slice('CHF '.length);
  return `${cents > 0 ? '+' : '-'}CHF ${body}`;
}

/** Short axis label in francs: `0`, `950`, `1.2k`, `15k`, `1.5M`. */
export function formatCompactChf(cents: number): string {
  const francs = cents / 100;
  const abs = Math.abs(francs);
  const sign = francs < 0 ? '-' : '';
  const trim = (value: number) => String(Number(value.toFixed(1)));
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

export type ParseMoneyResult = { ok: true; cents: number } | { ok: false; error: string };

/**
 * Parses an amount in francs typed by a user into positive integer cents. Accepts `12`, `12.5`,
 * `12.50`, `12,50` and apostrophes or spaces as thousands separators (`1'234.50`). The string is
 * split into francs and cents, so float drift (`0.1 + 0.2`) cannot happen.
 */
export function parseFrancsToCents(input: string): ParseMoneyResult {
  const cleaned = input.trim().replace(/['’\s]/g, '');
  if (cleaned === '') return { ok: false, error: 'Enter an amount' };
  const match = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(cleaned);
  if (!match) {
    return /^\d+[.,]\d{3,}$/.test(cleaned)
      ? { ok: false, error: 'Use at most two decimal places' }
      : { ok: false, error: 'Enter a positive amount, e.g. 12.50' };
  }
  const francs = match[1]!;
  const fraction = (match[2] ?? '').padEnd(2, '0');
  if (francs.length > 12) return { ok: false, error: 'Amount is too large' };
  const cents = Number(francs) * 100 + Number(fraction);
  if (cents <= 0) return { ok: false, error: 'Amount must be greater than zero' };
  if (cents > MAX_CENTS) return { ok: false, error: 'Amount is too large' };
  return { ok: true, cents };
}

/** Cents as a plain input value in francs, `1234.50`, for prefilling a form. */
export function centsToFrancsInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
