import { Game } from '../../core/models/game.model';
import { gameInterest, isGettingInteresting } from './game-day-interest';

interface GameOptions {
  status?: Game['status'];
  homeScore?: number;
  awayScore?: number;
  period?: number | null;
  clock?: string | null;
  homeRank?: number | null;
  awayRank?: number | null;
  homeFcs?: boolean;
  awayFcs?: boolean;
  muted?: boolean;
}

function game(options: GameOptions = {}): Game {
  return {
    id: 1,
    league: 'Ncaa',
    home: {
      id: 1,
      displayName: 'Home',
      abbreviation: 'H',
      logoUrl: null,
      primaryColor: null,
      currentRank: options.homeRank ?? null,
      isFcs: options.homeFcs ?? false,
    },
    away: {
      id: 2,
      displayName: 'Away',
      abbreviation: 'A',
      logoUrl: null,
      primaryColor: null,
      currentRank: options.awayRank ?? null,
      isFcs: options.awayFcs ?? false,
    },
    kickoffUtc: '2026-09-12T17:00:00Z',
    venue: null,
    broadcasts: [],
    status: options.status ?? 'Live',
    isMuted: options.muted ?? false,
    muteType: null,
    score: {
      homeScore: options.homeScore ?? 0,
      awayScore: options.awayScore ?? 0,
      period: options.period === undefined ? 2 : options.period,
      clock: options.clock === undefined ? '8:00' : options.clock,
      possessionTeamId: null,
      downDistance: null,
      homeWinProbability: null,
    },
    hasFavorite: false,
    hasInterest: false,
    isCircled: false,
    weekNumber: 2,
    weekLabel: 'Week 2',
  };
}

describe('Game Day interesting suggestions', () => {
  it('requires both 45 total points and a one-possession margin from the second quarter onward', () => {
    expect(gameInterest(game({ homeScore: 24, awayScore: 21, period: 2 }))?.rating).toBe('interesting');
    expect(gameInterest(game({ homeScore: 42, awayScore: 10, period: 2 }))).toBeNull();
    expect(gameInterest(game({ homeScore: 7, awayScore: 3, period: 2 }))).toBeNull();
    expect(gameInterest(game({ homeScore: 24, awayScore: 21, period: 1 }))).toBeNull();
  });

  it('flags a one-possession game at four minutes or less in the fourth regardless of total', () => {
    expect(gameInterest(game({ homeScore: 7, awayScore: 3, period: 4, clock: '4:00' }))?.rating).toBe('very-interesting');
    expect(gameInterest(game({ homeScore: 7, awayScore: 3, period: 4, clock: '4:01' }))).toBeNull();
  });

  it('escalates fourth-quarter ties involving ranked teams', () => {
    expect(gameInterest(game({ homeScore: 21, awayScore: 21, period: 4, clock: '12:00', homeRank: 12 }))?.rating).toBe('interesting');
    expect(gameInterest(game({ homeScore: 21, awayScore: 21, period: 4, clock: '12:00', homeRank: 12, awayRank: 7 }))?.rating).toBe('very-interesting');
  });

  it('escalates a ranked team trailing a lower-ranked, unranked, or FCS opponent', () => {
    expect(gameInterest(game({ homeScore: 17, awayScore: 21, period: 4, homeRank: 5, awayRank: 18 }))?.rating).toBe('very-interesting');
    expect(gameInterest(game({ homeScore: 17, awayScore: 21, period: 4, homeRank: 5 }))?.rating).toBe('stop-what-youre-doing');

    const fcsUpset = gameInterest(game({ homeScore: 17, awayScore: 21, period: 4, homeRank: 5, awayFcs: true }));
    expect(fcsUpset?.rating).toBe('stop-what-youre-doing');
    expect(fcsUpset?.scenarioId).toBe('ranked-trailing-fcs');
  });

  it('does not flag upcoming, final, or muted games', () => {
    expect(isGettingInteresting(game({ status: 'Upcoming', homeScore: 24, awayScore: 21 }))).toBeFalse();
    expect(isGettingInteresting(game({ status: 'Final', homeScore: 24, awayScore: 21 }))).toBeFalse();
    expect(isGettingInteresting(game({ muted: true, homeScore: 24, awayScore: 21 }))).toBeFalse();
  });
});
