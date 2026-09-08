import { buildCalendarMonth, moveCalendarMonth, startOfCalendarMonth } from './day-calendar';

describe('Day calendar', () => {
  it('builds a six-week Sunday-first calendar around the selected month', () => {
    const cells = buildCalendarMonth(new Date(2026, 8, 1), new Date(2026, 8, 12), new Date(2026, 8, 8));

    expect(cells.length).toBe(42);
    expect(cells[0].key).toBe('2026-08-30');
    expect(cells[41].key).toBe('2026-10-10');
    expect(cells.find((cell) => cell.selected)?.key).toBe('2026-09-12');
    expect(cells.find((cell) => cell.today)?.key).toBe('2026-09-08');
  });

  it('moves between months without carrying an invalid day number', () => {
    expect(startOfCalendarMonth(new Date(2026, 0, 31))).toEqual(new Date(2026, 0, 1));
    expect(moveCalendarMonth(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
  });
});
