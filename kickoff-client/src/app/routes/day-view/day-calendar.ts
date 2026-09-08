import { addDays, startOfLocalDay } from '../../core/timeline';
import { formatDaySelection } from './day-selection';

export interface DayCalendarCell {
  readonly date: Date;
  readonly key: string;
  readonly dayNumber: number;
  readonly inMonth: boolean;
  readonly selected: boolean;
  readonly today: boolean;
}

export function startOfCalendarMonth(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), 1);
}

export function moveCalendarMonth(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1);
}

export function buildCalendarMonth(
  month: Date,
  selectedDay: Date,
  today = new Date(),
): DayCalendarCell[] {
  const firstOfMonth = startOfCalendarMonth(month);
  const firstCell = addDays(firstOfMonth, -firstOfMonth.getDay());
  const selectedKey = formatDaySelection(startOfLocalDay(selectedDay));
  const todayKey = formatDaySelection(startOfLocalDay(today));

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstCell, index);
    const key = formatDaySelection(date);
    return {
      date,
      key,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === firstOfMonth.getMonth(),
      selected: key === selectedKey,
      today: key === todayKey,
    };
  });
}
