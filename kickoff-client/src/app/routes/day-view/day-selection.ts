import { startOfLocalDay } from '../../core/timeline';

/** Format a local calendar date without the UTC shift produced by toISOString(). */
export function formatDaySelection(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

/** Parse the native date input as local midnight and reject normalized invalid dates. */
export function parseDaySelection(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const parsed = startOfLocalDay(new Date(year, month - 1, date));
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === date
    ? parsed
    : null;
}
