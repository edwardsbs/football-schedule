import { Game } from '../../core/models/game.model';
import { isGettingInteresting } from './game-day-interest';

function game(status: Game['status'], homeScore: number, awayScore: number): Game {
  return {
    id: 1,
    league: 'Ncaa',
    home: { id: 1, displayName: 'Home', abbreviation: 'H', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    away: { id: 2, displayName: 'Away', abbreviation: 'A', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: '2026-09-12T17:00:00Z',
    venue: null,
    broadcasts: [],
    status,
    isMuted: false,
    muteType: null,
    score: { homeScore, awayScore, period: 4, clock: '5:00', possessionTeamId: null, downDistance: null, homeWinProbability: null },
    hasFavorite: false,
    hasInterest: false,
    isCircled: false,
    weekNumber: 2,
    weekLabel: 'Week 2',
  };
}

describe('Game Day interesting suggestions', () => {
  it('flags close or high-scoring live games', () => {
    expect(isGettingInteresting(game('Live', 24, 20))).toBeTrue();
    expect(isGettingInteresting(game('Live', 42, 10))).toBeTrue();
  });

  it('does not flag ordinary upcoming or final games', () => {
    expect(isGettingInteresting(game('Upcoming', 0, 0))).toBeFalse();
    expect(isGettingInteresting(game('Final', 24, 20))).toBeFalse();
  });
});
