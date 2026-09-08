import { WeekGroup } from '../../core/timeline';
import { defaultScheduleWeek } from './schedule-week-selection';

describe('Season schedule default week', () => {
  const weeks = [
    week(1, new Date(2026, 8, 3), new Date(2026, 8, 7)),
    week(2, new Date(2026, 8, 10), new Date(2026, 8, 14)),
    week(3, new Date(2026, 8, 17), new Date(2026, 8, 21)),
  ];

  it('keeps the current provider week through its final game day', () => {
    expect(defaultScheduleWeek(weeks, new Date(2026, 8, 7, 23, 59))).toBe(1);
  });

  it('rolls to the upcoming provider week the next calendar day', () => {
    expect(defaultScheduleWeek(weeks, new Date(2026, 8, 8))).toBe(2);
  });

  it('uses the first or last scheduled week outside the season', () => {
    expect(defaultScheduleWeek(weeks, new Date(2026, 7, 1))).toBe(1);
    expect(defaultScheduleWeek(weeks, new Date(2027, 0, 1))).toBe(3);
  });

  it('returns null when no schedule is available', () => {
    expect(defaultScheduleWeek([], new Date(2026, 8, 8))).toBeNull();
  });
});

function week(number: number, first: Date, last: Date): WeekGroup {
  return {
    key: number,
    number,
    label: `Week ${number}`,
    count: 2,
    days: [first, last].map((date) => ({
      key: date.toISOString(),
      date: date.toISOString(),
      count: 1,
      slots: [],
    })),
  };
}
