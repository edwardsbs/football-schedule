import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GameDayBoardStore } from './game-day-board-store';

describe('GameDayBoardStore', () => {
  let http: HttpTestingController;
  let store: GameDayBoardStore;

  const clearStorage = () => {
    localStorage.removeItem('kickoff.game-day.watched-games');
    localStorage.removeItem('kickoff.game-day.auto-excluded-games');
    localStorage.removeItem('kickoff.game-day.server-migrated');
  };

  beforeEach(() => {
    clearStorage();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    http.verify({ ignoreCancelled: true });
    clearStorage();
  });

  it('promotes and demotes games through the shared board', () => {
    store = TestBed.inject(GameDayBoardStore);
    http.expectOne('/api/game-day').flush({ watchedGameIds: [], autoExcludedGameIds: [] });

    store.promote(42);
    expect(store.isWatching(42)).toBeTrue();
    const promote = http.expectOne('/api/game-day/games/42');
    expect(promote.request.method).toBe('PUT');
    expect(promote.request.body).toEqual({ watching: true, suppressAutomatic: false });
    promote.flush({ watchedGameIds: [42], autoExcludedGameIds: [] });

    store.demote(42);
    expect(store.isWatching(42)).toBeFalse();
    const demote = http.expectOne('/api/game-day/games/42');
    expect(demote.request.body).toEqual({ watching: false, suppressAutomatic: false });
    demote.flush({ watchedGameIds: [], autoExcludedGameIds: [] });
  });

  it('loads selections saved by another device', () => {
    store = TestBed.inject(GameDayBoardStore);
    http.expectOne('/api/game-day').flush({ watchedGameIds: [77], autoExcludedGameIds: [] });

    expect(store.isWatching(77)).toBeTrue();
    expect(JSON.parse(localStorage.getItem('kickoff.game-day.watched-games') ?? '[]')).toEqual([77]);
  });

  it('refreshes from another device when this window regains focus', () => {
    store = TestBed.inject(GameDayBoardStore);
    http.expectOne('/api/game-day').flush({ watchedGameIds: [], autoExcludedGameIds: [] });

    window.dispatchEvent(new Event('focus'));
    http.expectOne('/api/game-day').flush({ watchedGameIds: [91], autoExcludedGameIds: [] });

    expect(store.isWatching(91)).toBeTrue();
  });

  it('migrates existing browser-local selections once', () => {
    localStorage.setItem('kickoff.game-day.watched-games', '[77]');
    store = TestBed.inject(GameDayBoardStore);
    http.expectOne('/api/game-day').flush({ watchedGameIds: [], autoExcludedGameIds: [] });

    const migration = http.expectOne('/api/game-day/import');
    expect(migration.request.body).toEqual({ watchedGameIds: [77], autoExcludedGameIds: [] });
    migration.flush({ watchedGameIds: [77], autoExcludedGameIds: [] });

    expect(store.isWatching(77)).toBeTrue();
    expect(localStorage.getItem('kickoff.game-day.server-migrated')).toBe('true');
  });

  it('automatically includes circled games but syncs an explicit removal', () => {
    store = TestBed.inject(GameDayBoardStore);
    http.expectOne('/api/game-day').flush({ watchedGameIds: [], autoExcludedGameIds: [] });
    expect(store.isWatching(88, true)).toBeTrue();

    store.demote(88, true);
    expect(store.isWatching(88, true)).toBeFalse();
    const exclude = http.expectOne('/api/game-day/games/88');
    expect(exclude.request.body).toEqual({ watching: false, suppressAutomatic: true });
    exclude.flush({ watchedGameIds: [], autoExcludedGameIds: [88] });

    store.allowAutomaticInclusion(88);
    expect(store.isWatching(88, true)).toBeTrue();
    const allow = http.expectOne('/api/game-day/games/88');
    expect(allow.request.body).toEqual({ watching: false, suppressAutomatic: false });
    allow.flush({ watchedGameIds: [], autoExcludedGameIds: [] });
  });
});
