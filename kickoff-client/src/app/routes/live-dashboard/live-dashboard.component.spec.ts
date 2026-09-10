import { Game } from '../../core/models/game.model';
import { formatKickoffCountdown, selectBestGameId, selectUpcomingSlate } from './live-dashboard.component';

describe('LiveDashboardComponent upcoming fallback', () => {
  const now = new Date(2026, 8, 4, 10, 0, 0);

  it('shows all remaining games today when there are later kickoffs', () => {
    const games = [
      game(1, new Date(2026, 8, 4, 18, 0, 0)),
      game(2, new Date(2026, 8, 5, 12, 0, 0)),
      game(3, new Date(2026, 8, 4, 20, 0, 0)),
    ];

    expect(selectUpcomingSlate(games, now).map((g) => g.id)).toEqual([1, 3]);
  });

  it('shows the entire next scheduled day when today has no games', () => {
    const games = [
      game(1, new Date(2026, 8, 6, 18, 0, 0)),
      game(2, new Date(2026, 8, 5, 19, 0, 0)),
      game(3, new Date(2026, 8, 5, 12, 0, 0)),
    ];

    expect(selectUpcomingSlate(games, now).map((g) => g.id)).toEqual([3, 2]);
  });

  it('formats the next kickoff countdown as hours, minutes, and seconds', () => {
    const kickoff = new Date(2026, 8, 4, 12, 3, 4);

    expect(formatKickoffCountdown(kickoff, now)).toBe('02:03:04');
  });
});

describe('LiveDashboardComponent best game', () => {
  it('does not call the only live game the best game', () => {
    expect(selectBestGameId([liveGame(1, 21, 17)])).toBeNull();
  });

  it('selects the tightest game when multiple games are live', () => {
    const games = [liveGame(1, 28, 14), liveGame(2, 24, 21), liveGame(3, 10, 3)];

    expect(selectBestGameId(games)).toBe(2);
  });
});

function game(id: number, kickoff: Date): Game {
  return {
    id,
    league: 'Ncaa',
    home: { id: id * 2, displayName: `Home ${id}`, abbreviation: `H${id}`, logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    away: { id: id * 2 + 1, displayName: `Away ${id}`, abbreviation: `A${id}`, logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: kickoff.toISOString(),
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
  };
}

function liveGame(id: number, homeScore: number, awayScore: number): Game {
  return {
    ...game(id, new Date(2026, 8, 4, 18, 0, 0)),
    status: 'Live',
    score: {
      homeScore,
      awayScore,
      period: 4,
      clock: '08:15',
      possessionTeamId: null,
      downDistance: null,
      homeWinProbability: null,
    },
  };
}
