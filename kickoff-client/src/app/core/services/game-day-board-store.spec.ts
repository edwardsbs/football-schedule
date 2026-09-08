import { GameDayBoardStore } from './game-day-board-store';

describe('GameDayBoardStore', () => {
  const clearStorage = () => {
    localStorage.removeItem('kickoff.game-day.watched-games');
    localStorage.removeItem('kickoff.game-day.auto-excluded-games');
  };

  beforeEach(clearStorage);
  afterEach(clearStorage);

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

  it('automatically includes circled games but permits an explicit removal', () => {
    const store = new GameDayBoardStore();
    expect(store.isWatching(88, true)).toBeTrue();

    store.demote(88, true);
    expect(store.isWatching(88, true)).toBeFalse();
    expect(new GameDayBoardStore().isWatching(88, true)).toBeFalse();

    store.allowAutomaticInclusion(88);
    expect(store.isWatching(88, true)).toBeTrue();
  });
});
