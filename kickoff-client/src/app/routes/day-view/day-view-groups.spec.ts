import { Game, GameSafeStatus, LeagueName } from '../../core/models/game.model';
import { groupDayGames } from './day-view-groups';

describe('Day view grouping', () => {
  it('defaults status-style grouping to live, upcoming, then completed order', () => {
    const games = [game(1, 'Final'), game(2, 'Upcoming'), game(3, 'Live')];

    const groups = groupDayGames(games, 'status');

    expect(groups.map((group) => group.key)).toEqual(['live', 'upcoming', 'completed']);
    expect(groups.map((group) => group.games[0].id)).toEqual([3, 2, 1]);
  });

  it('separates kickoff windows using local kickoff hour', () => {
    const games = [
      game(1, 'Upcoming', 'Ncaa', new Date(2026, 8, 5, 11, 0)),
      game(2, 'Upcoming', 'Ncaa', new Date(2026, 8, 5, 14, 30)),
      game(3, 'Upcoming', 'Ncaa', new Date(2026, 8, 5, 16, 0)),
      game(4, 'Upcoming', 'Ncaa', new Date(2026, 8, 5, 19, 0)),
    ];

    expect(groupDayGames(games, 'kickoff').map((group) => group.key)).toEqual([
      'morning',
      'early-afternoon',
      'late-afternoon',
      'prime-time',
    ]);
  });

  it('groups NFL games by the home team division', () => {
    const bills = game(1, 'Upcoming', 'Nfl');
    bills.home.abbreviation = 'BUF';
    bills.away.abbreviation = 'MIA';

    const groups = groupDayGames([bills], 'conference');

    expect(groups[0].label).toBe('AFC East');
  });
});

function game(
  id: number,
  status: GameSafeStatus,
  league: LeagueName = 'Ncaa',
  kickoff = new Date(2026, 8, 5, 12, 0),
): Game {
  return {
    id,
    league,
    home: { id: id * 2, displayName: `Home ${id}`, abbreviation: `H${id}`, logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    away: { id: id * 2 + 1, displayName: `Away ${id}`, abbreviation: `A${id}`, logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: kickoff.toISOString(),
    venue: null,
    broadcasts: [],
    status,
    isMuted: false,
    muteType: null,
    score: null,
    hasFavorite: false,
    isCircled: false,
    weekNumber: 1,
    weekLabel: 'Week 1',
  };
}
