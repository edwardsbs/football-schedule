import { Game } from '../../core/models/game.model';
import { rotatedGameId } from './game-day-focus-rail.component';

describe('GameDayFocusRailComponent rotation', () => {
  const games = [game(10), game(20), game(30)];

  it('advances and wraps through Game Day selections', () => {
    expect(rotatedGameId(games, 10, 1)).toBe(20);
    expect(rotatedGameId(games, 30, 1)).toBe(10);
  });

  it('moves backward and wraps to the last game', () => {
    expect(rotatedGameId(games, 10, -1)).toBe(30);
  });

  it('returns null when there are no Game Day selections', () => {
    expect(rotatedGameId([], null, 1)).toBeNull();
  });
});

function game(id: number): Game {
  return {
    id,
    league: 'Ncaa',
    home: { id: id * 2, displayName: `Home ${id}`, abbreviation: `H${id}`, logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    away: { id: id * 2 + 1, displayName: `Away ${id}`, abbreviation: `A${id}`, logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: new Date(2026, 8, 9, 18).toISOString(),
    venue: null,
    broadcasts: [],
    status: 'Upcoming',
    isMuted: false,
    muteType: null,
    score: null,
    hasFavorite: false,
    hasInterest: false,
    isCircled: false,
    weekNumber: 2,
    weekLabel: 'Week 2',
  };
}
