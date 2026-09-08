import { SelectedDayStore } from './selected-day-store';

describe('SelectedDayStore', () => {
  beforeEach(() => localStorage.removeItem('kickoff.day.selected-date'));
  afterEach(() => localStorage.removeItem('kickoff.day.selected-date'));

  it('shares the sticky selected date across views', () => {
    const day = new Date(2026, 8, 12);
    const dayView = new SelectedDayStore();
    dayView.select(day);

    expect(new SelectedDayStore().day()).toEqual(day);
  });

  it('clears the sticky date when returning to today', () => {
    const store = new SelectedDayStore();
    store.select(new Date(2026, 8, 12));
    store.goToToday();

    expect(localStorage.getItem('kickoff.day.selected-date')).toBeNull();
  });
});
