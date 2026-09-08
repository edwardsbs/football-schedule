import { GameDayBoardStore } from './game-day-board-store';

describe('GameDayBoardStore', () => {
  beforeEach(() => localStorage.removeItem('kickoff.game-day.watched-games'));
  afterEach(() => localStorage.removeItem('kickoff.game-day.watched-games'));

  it('promotes and demotes games without moving them automatically', () => {
    const store = new GameDayBoardStore();
    store.promote(42);
    expect(store.isWatching(42)).toBeTrue();

    store.demote(42);
    expect(store.isWatching(42)).toBeFalse();
  });

  it('restores the board on a later visit', () => {
    const firstVisit = new GameDayBoardStore();
    firstVisit.promote(77);

    expect(new GameDayBoardStore().isWatching(77)).toBeTrue();
  });
});
