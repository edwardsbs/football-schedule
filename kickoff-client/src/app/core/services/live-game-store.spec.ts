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

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 17, awayScore: 7, period: 2, clock: '4:11', possessionTeamId: null, downDistance: null, homeWinProbability: 0.74 },
    })]);
    expect(store.overlay(original).score?.possessionTeamId).toBe(1);
    expect(store.overlay(original).score?.downDistance).toBe('Touchdown');

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 17, awayScore: 10, period: 2, clock: '2:02', possessionTeamId: null, downDistance: null, homeWinProbability: 0.66 },
    })]);
    expect(store.overlay(original).score?.possessionTeamId).toBe(2);
    expect(store.overlay(original).score?.downDistance).toBe('Field Goal');

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 17, awayScore: 10, period: 2, clock: '2:02', possessionTeamId: 1, downDistance: 'Kickoff', homeWinProbability: 0.66 },
    })]);
    expect(store.overlay(original).score?.possessionTeamId).toBe(2);
    expect(store.overlay(original).score?.downDistance).toBe('Kickoff');

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 17, awayScore: 10, period: 2, clock: '1:49', possessionTeamId: 1, downDistance: '1st & 10 at HOM 25', homeWinProbability: 0.66 },
    })]);
    expect(store.overlay(original).score?.possessionTeamId).toBe(1);
    expect(store.overlay(original).score?.downDistance).toBe('1st & 10 at HOM 25');
    discardPeriodicTasks();
  }));

  it('accepts a per-game summary correction until the scoreboard supplies a newer situation', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const original = game({
      status: 'Live',
      score: { homeScore: 13, awayScore: 10, period: 4, clock: '2:59', possessionTeamId: 1, downDistance: 'Field Goal', homeWinProbability: null },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([original]);

    store.correctSituation(1, 2, '3rd & 19 at AWY 43');
    expect(store.overlay(original).score?.possessionTeamId).toBe(2);
    expect(store.overlay(original).score?.downDistance).toBe('3rd & 19 at AWY 43');

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 13, awayScore: 10, period: 4, clock: '2:16', possessionTeamId: null, downDistance: null, homeWinProbability: null },
    })]);
    expect(store.overlay(original).score?.clock).toBe('2:16');
    expect(store.overlay(original).score?.downDistance).toBe('3rd & 19 at AWY 43');

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 13, awayScore: 10, period: 4, clock: '1:51', possessionTeamId: 2, downDistance: '1st & 10 at HOM 49', homeWinProbability: null },
    })]);
    expect(store.overlay(original).score?.downDistance).toBe('1st & 10 at HOM 49');
    discardPeriodicTasks();
  }));

  it('does not repeatedly infer a touchdown from an old page-load score', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const pageLoad = game({
      status: 'Live',
      score: { homeScore: 7, awayScore: 7, period: 2, clock: '8:00', possessionTeamId: 2, downDistance: '2nd & 5 at AWY 40', homeWinProbability: null },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([pageLoad]);

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 7, awayScore: 14, period: 2, clock: '7:42', possessionTeamId: 2, downDistance: null, homeWinProbability: null },
    })]);
    expect(store.overlay(pageLoad).score?.downDistance).toBe('Touchdown');

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 7, awayScore: 14, period: 2, clock: '7:30', possessionTeamId: 1, downDistance: '1st & 10 at HOM 25', homeWinProbability: null },
    })]);

    const afterRestart = store.overlay(pageLoad).score;
    expect(afterRestart?.clock).toBe('7:30');
    expect(afterRestart?.possessionTeamId).toBe(1);
    expect(afterRestart?.downDistance).toBe('1st & 10 at HOM 25');
    discardPeriodicTasks();
  }));

  it('clears an ephemeral highlight when the next poll has no situation', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const pageLoad = game({
      status: 'Live',
      score: { homeScore: 7, awayScore: 7, period: 2, clock: '8:00', possessionTeamId: 2, downDistance: '2nd & 5 at AWY 40', homeWinProbability: null },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([pageLoad]);

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 14, awayScore: 7, period: 2, clock: '7:42', possessionTeamId: null, downDistance: null, homeWinProbability: null },
    })]);
    expect(store.overlay(pageLoad).score?.downDistance).toBe('Touchdown');

    tick(10_000);
    http.expectOne('/api/games/live').flush([game({
      status: 'Live',
      score: { homeScore: 14, awayScore: 7, period: 2, clock: '7:31', possessionTeamId: null, downDistance: null, homeWinProbability: null },
    })]);
    expect(store.overlay(pageLoad).score?.downDistance).toBeNull();
    expect(store.overlay(pageLoad).score?.possessionTeamId).toBeNull();
    discardPeriodicTasks();
  }));

  it('reports the age of a quiet feed and hides stale situation fields', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const lastChange = new Date(Date.now() - 6 * 60_000).toISOString();
    const frozen = game({
      status: 'Live',
      lastUpdatedUtc: lastChange,
      score: {
        homeScore: 28,
        awayScore: 0,
        period: 2,
        clock: '11:33',
        possessionTeamId: 1,
        downDistance: '2nd & Goal at AWY 1',
        homeWinProbability: null,
      },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([frozen]);

    expect(store.health(frozen)?.level).toBe('stale');
    expect(store.health(frozen)?.label).toContain('6m');
    expect(store.overlay(frozen).score?.homeScore).toBe(28);
    expect(store.overlay(frozen).score?.clock).toBe('11:33');
    expect(store.overlay(frozen).score?.possessionTeamId).toBeNull();
    expect(store.overlay(frozen).score?.downDistance).toBeNull();
    discardPeriodicTasks();
  }));

  it('does not mark a normal halftime pause as a stale feed', fakeAsync(() => {
    store = TestBed.inject(LiveGameStore);
    const halftime = game({
      status: 'Live',
      lastUpdatedUtc: new Date(Date.now() - 12 * 60_000).toISOString(),
      score: {
        homeScore: 14,
        awayScore: 10,
        period: 2,
        clock: '0:00',
        possessionTeamId: null,
        downDistance: null,
        homeWinProbability: null,
      },
    });

    tick(0);
    http.expectOne('/api/games/live').flush([halftime]);

    expect(store.health(halftime)).toBeNull();
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
    hasInterest: false,
    isCircled: false,
    weekNumber: 1,
    weekLabel: 'Week 1',
    ...overrides,
  };
}
