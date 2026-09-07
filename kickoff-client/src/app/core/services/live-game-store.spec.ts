import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { Game } from '../models/game.model';
import { LiveGameStore } from './live-game-store';

describe('LiveGameStore', () => {
  let http: HttpTestingController;
  let store: LiveGameStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Destroy the root-scoped store first so its repeating poll unsubscribes.
    TestBed.resetTestingModule();
    http.verify({ ignoreCancelled: true });
  });

  it('overlays live updates and captures the final result when a game leaves the live feed', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const original = game({ status: 'Upcoming', score: null });
    const live = game({
      status: 'Live',
      score: { homeScore: 24, awayScore: 7, period: 3, clock: '9:42', possessionTeamId: null, downDistance: null, homeWinProbability: null },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([live]);
    expect(store.overlay(original).status).toBe('Live');
    expect(store.overlay(original).score?.homeScore).toBe(24);

    tick(10_000);
    http.expectOne('/api/games/live').flush([]);

    const final = game({
      status: 'Final',
      score: { homeScore: 31, awayScore: 14, period: 4, clock: '0:00', possessionTeamId: null, downDistance: null, homeWinProbability: null },
    });
    http.expectOne('/api/games/1').flush(final);

    expect(store.overlay(original).status).toBe('Final');
    expect(store.overlay(original).score?.homeScore).toBe(31);
    discardPeriodicTasks();
  }));

  it('does not reveal an updated score for a muted base game', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const muted = game({ isMuted: true, muteType: 'Muted', score: null });
    const live = game({
      status: 'Live',
      score: { homeScore: 24, awayScore: 7, period: 3, clock: '9:42', possessionTeamId: null, downDistance: null, homeWinProbability: null },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([live]);

    expect(store.overlay(muted).status).toBe('Live');
    expect(store.overlay(muted).score).toBeNull();
    discardPeriodicTasks();
  }));

  it('retains the last live situation when a poll temporarily omits it', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const original = game({
      status: 'Live',
      score: { homeScore: 10, awayScore: 7, period: 2, clock: '4:31', possessionTeamId: 2, downDistance: '2nd & 6 at AWY 44', homeWinProbability: 0.58 },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([original]);

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 10, awayScore: 7, period: 2, clock: '4:18', possessionTeamId: null, downDistance: null, homeWinProbability: 0.61 },
    })]);

    const overlaid = store.overlay(original);
    expect(overlaid.score?.clock).toBe('4:18');
    expect(overlaid.score?.homeWinProbability).toBe(0.61);
    expect(overlaid.score?.possessionTeamId).toBe(2);
    expect(overlaid.score?.downDistance).toBe('2nd & 6 at AWY 44');
    discardPeriodicTasks();
  }));
});

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    league: 'Ncaa',
    home: { id: 1, displayName: 'Home', abbreviation: 'HOM', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    away: { id: 2, displayName: 'Away', abbreviation: 'AWY', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: '2026-09-03T22:00:00Z',
    venue: null,
    broadcasts: [],
    status: 'Upcoming',
    isMuted: false,
    muteType: null,
    score: null,
    hasFavorite: false,
    isCircled: false,
    weekNumber: 1,
    weekLabel: 'Week 1',
    ...overrides,
  };
}
