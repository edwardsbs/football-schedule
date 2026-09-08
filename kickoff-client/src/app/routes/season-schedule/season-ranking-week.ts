/**
 * ESPN labels the in-season poll released after a schedule week with the next
 * occurrence number. Week 1 still uses the preseason poll, while schedule
 * Week 2 is paired with poll occurrence 3, and so on.
 */
export function pollWeekForScheduleWeek(scheduleWeek: number): number {
  return scheduleWeek <= 1 ? 1 : scheduleWeek + 1;
}
