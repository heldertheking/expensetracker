/** Local calendar date as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The `months` whole months up to and including the month of `today`. */
export function monthRange(months: number, today: Date = new Date()): { from: string; to: string } {
  const first = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
  return { from: toIsoDate(first), to: toIsoDate(today) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-03` as `Mar 26` (axis) or `Mar 2026` (long). */
export function formatMonth(yearMonth: string, long = false): string {
  const [year = '', month = ''] = yearMonth.split('-');
  const name = MONTHS[Number(month) - 1] ?? month;
  return long ? `${name} ${year}` : `${name} ${year.slice(2)}`;
}

/** `2026-03-07` as `07.03.2026`, the Swiss date format. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

/** A timestamp as `07.03.2026 14:05` in local time. */
export function formatDateTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(toIsoDate(date))} ${hours}:${minutes}`;
}
