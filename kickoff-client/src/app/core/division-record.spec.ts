import { Game } from './models/game.model';
import { conferenceRecord, divisionRecord, divisionRecordLabel } from './division-record';

describe('Division record', () => {
  const divisionOf = (teamId: number): string | null => {
    if ([1, 2, 3, 4].includes(teamId)) return 'AFC East';
    if (teamId === 5) return 'AFC North';
    return null;
  };

  it('counts only games against same-division opponents', () => {
    const games: Game[] = [
      finalGame(1, 2, 24, 17), // Buffalo beats Miami (division)
      finalGame(1, 3, 10, 20), // Buffalo loses to Jets (division)
      finalGame(1, 5, 30, 10), // Buffalo beats Ravens (NOT division -- ignored)
    ];
    const record = divisionRecord(1, 'AFC East', games, divisionOf);
    expect(record).toEqual({ teamId: 1, wins: 1, losses: 1, ties: 0 });
  });

  it('ignores games that have not finished yet', () => {
    const games: Game[] = [
      { ...finalGame(1, 2, 24, 17), status: 'Upcoming', score: null },
    ];
    expect(divisionRecord(1, 'AFC East', games, divisionOf)).toEqual({ teamId: 1, wins: 0, losses: 0, ties: 0 });
  });

  it('counts a tie correctly', () => {
    const games: Game[] = [finalGame(1, 4, 20, 20)];
    expect(divisionRecord(1, 'AFC East', games, divisionOf)).toEqual({ teamId: 1, wins: 0, losses: 0, ties: 1 });
  });

  it('works whether the team was home or away', () => {
    const games: Game[] = [finalGame(2, 1, 14, 21)]; // Buffalo (1) won on the road
    expect(divisionRecord(1, 'AFC East', games, divisionOf)).toEqual({ teamId: 1, wins: 1, losses: 0, ties: 0 });
  });

  it('also calculates an NCAA record against teams in the same conference', () => {
    const conferenceOf = (teamId: number): string | null => teamId <= 4 ? 'SEC' : 'Big Ten';
    const games = [
      { ...finalGame(1, 2, 28, 17), league: 'Ncaa' as const },
      { ...finalGame(1, 5, 21, 24), league: 'Ncaa' as const },
    ];

    expect(conferenceRecord(1, 'SEC', games, conferenceOf))
      .toEqual({ teamId: 1, wins: 1, losses: 0, ties: 0 });
  });

  it('formats the label with ties only when there are any', () => {
    expect(divisionRecordLabel({ teamId: 1, wins: 3, losses: 1, ties: 0 })).toBe('3-1');
    expect(divisionRecordLabel({ teamId: 1, wins: 2, losses: 1, ties: 1 })).toBe('2-1-1');
  });
});

function finalGame(homeId: number, awayId: number, homeScore: number, awayScore: number): Game {
  return {
    id: homeId * 1000 + awayId,
    league: 'Nfl',
    home: { id: homeId, displayName: '', abbreviation: '', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    away: { id: awayId, displayName: '', abbreviation: '', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: new Date(2026, 8, 1).toISOString(),
    venue: null,
    broadcasts: [],
    status: 'Final',
    isMuted: false,
    muteType: null,
    score: { homeScore, awayScore, period: null, clock: null, possessionTeamId: null, downDistance: null, homeWinProbability: null },
    hasFavorite: false,
    hasInterest: false,
    isCircled: false,
    weekNumber: 1,
    weekLabel: 'Week 1',
  };
}
