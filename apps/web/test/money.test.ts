import { describe, expect, it } from 'vitest';
import {
  centsToFrancsInput,
  formatChf,
  formatCompactChf,
  formatSignedChf,
  parseFrancsToCents,
} from '../src/lib/money';

describe('formatChf', () => {
  it.each([
    [0, 'CHF 0.00'],
    [5, 'CHF 0.05'],
    [123450, "CHF 1'234.50"],
    [123456789, "CHF 1'234'567.89"],
    [-1200, 'CHF -12.00'],
    [-123450, "CHF -1'234.50"],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatChf(cents)).toBe(expected);
  });
});

describe('formatSignedChf', () => {
  it('adds a sign for changes', () => {
    expect(formatSignedChf(1250)).toBe('+CHF 12.50');
    expect(formatSignedChf(-123450)).toBe("-CHF 1'234.50");
    expect(formatSignedChf(0)).toBe('CHF 0.00');
  });
});

describe('formatCompactChf', () => {
  it.each([
    [0, '0'],
    [95000, '950'],
    [120000, '1.2k'],
    [1500000, '15k'],
    [150000000, '1.5M'],
    [-250000, '-2.5k'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCompactChf(cents)).toBe(expected);
  });
});

describe('parseFrancsToCents', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['12,50', 1250],
    ["1'234.50", 123450],
    ['1 234.50', 123450],
    ['  7.05 ', 705],
    ['0.01', 1],
    ['12.', 1200],
  ])('parses %s as %i cents', (input, cents) => {
    expect(parseFrancsToCents(input)).toEqual({ ok: true, cents });
  });

  it('has no float drift', () => {
    // 0.29 * 100 is 28.999999999999996 in floating point
    expect(parseFrancsToCents('0.29')).toEqual({ ok: true, cents: 29 });
    expect(parseFrancsToCents('1.15')).toEqual({ ok: true, cents: 115 });
    expect(parseFrancsToCents('4.35')).toEqual({ ok: true, cents: 435 });
  });

  it.each([
    ['', 'Enter an amount'],
    ['   ', 'Enter an amount'],
    ['abc', 'Enter a positive amount, e.g. 12.50'],
    ['-5', 'Enter a positive amount, e.g. 12.50'],
    ['1e3', 'Enter a positive amount, e.g. 12.50'],
    ['12.345', 'Use at most two decimal places'],
    ['0', 'Amount must be greater than zero'],
    ['0.00', 'Amount must be greater than zero'],
    ['1000000001', 'Amount is too large'],
    ['9999999999999', 'Amount is too large'],
  ])('rejects %j', (input, error) => {
    expect(parseFrancsToCents(input)).toEqual({ ok: false, error });
  });

  it('accepts the largest amount the schema allows', () => {
    expect(parseFrancsToCents('1000000000')).toEqual({ ok: true, cents: 100_000_000_000 });
  });
});

describe('centsToFrancsInput', () => {
  it('round-trips with the parser', () => {
    for (const cents of [1, 5, 99, 100, 1250, 123456]) {
      expect(parseFrancsToCents(centsToFrancsInput(cents))).toEqual({ ok: true, cents });
    }
    expect(centsToFrancsInput(123450)).toBe('1234.50');
  });
});
