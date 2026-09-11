import { Game } from '../../core/models/game.model';
import { GameSummary } from '../../core/models/game-summary.model';
import { rotatedGameId, situationCorrectionFromSummary } from './game-day-focus-rail.component';

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

  it('prefers the current drive over a retained scoring play when repairing the live situation', () => {
    const selected = game(10);
    const summary = {
      currentDrive: {
        teamExternalId: 'home-external',
        start: null,
        end: {
          downDistanceText: '2nd & 7 at H10 32',
          teamExternalId: 'home-external',
        },
      },
      lastPlay: {
        start: null,
        end: {
          downDistanceText: 'Touchdown',
          teamExternalId: 'away-external',
        },
      },
      teamStatistics: [
        { teamExternalId: 'home-external', teamAbbreviation: 'H10', statistics: [] },
        { teamExternalId: 'away-external', teamAbbreviation: 'A10', statistics: [] },
      ],
      leaders: [],
      injuries: [],
    } as unknown as GameSummary;

    expect(situationCorrectionFromSummary(selected, summary)).toEqual({
      possessionTeamId: selected.home.id,
      downDistance: '2nd & 7 at H10 32',
    });
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
