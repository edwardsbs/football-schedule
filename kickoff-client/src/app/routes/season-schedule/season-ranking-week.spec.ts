import { pollWeekForScheduleWeek } from './season-ranking-week';

describe('season ranking week selection', () => {
  it('uses the preseason poll for schedule Weeks 0 and 1', () => {
    expect(pollWeekForScheduleWeek(0)).toBe(1);
    expect(pollWeekForScheduleWeek(1)).toBe(1);
  });

  it('uses the poll released for the selected in-season schedule week', () => {
    expect(pollWeekForScheduleWeek(2)).toBe(3);
    expect(pollWeekForScheduleWeek(9)).toBe(10);
  });
});
