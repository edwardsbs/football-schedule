import { formatDaySelection, parseDaySelection } from './day-selection';

describe('Day calendar selection', () => {
  it('round-trips a date in local time', () => {
    const selected = new Date(2026, 8, 12);
    expect(formatDaySelection(selected)).toBe('2026-09-12');
    expect(parseDaySelection('2026-09-12')).toEqual(selected);
  });

  it('rejects invalid or normalized dates', () => {
    expect(parseDaySelection('2026-02-30')).toBeNull();
    expect(parseDaySelection('September 12')).toBeNull();
  });
});
