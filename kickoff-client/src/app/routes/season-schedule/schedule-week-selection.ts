import { addDays, startOfLocalDay, WeekGroup } from '../../core/timeline';

/**
 * Pick the first provider week whose final game day has not fully passed.
 * A week ending on Monday remains current through Monday, then rolls to the
 * next provider week at local midnight on Tuesday.
 */
export function defaultScheduleWeek(weeks: readonly WeekGroup[], now = new Date()): number | null {
  if (weeks.length === 0) return null;

  const today = startOfLocalDay(now).getTime();
  for (const week of weeks) {
    const finalDay = startOfLocalDay(new Date(week.days[week.days.length - 1].date));
    const rollover = addDays(finalDay, 1).getTime();
    if (today < rollover) return week.number;
  }

  return weeks[weeks.length - 1].number;
}
