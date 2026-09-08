import { NcaaRankings, RankedTeam } from './models/ranking.model';
import { mergeRankingPolls } from './ranking-comparison';

function team(teamId: number, rank: number): RankedTeam {
  return { teamId, rank, previousRank: null, displayName: `Team ${teamId}`, abbreviation: `T${teamId}`, logoUrl: null };
}

describe('mergeRankingPolls', () => {
  it('orders by CFP while retaining AP-only and CFP-only teams', () => {
    const rankings: NcaaRankings = {
      seasonYear: 2025,
      requestedWeek: 11,
      polls: [
        { type: 'ap', source: 'Associated Press', name: 'AP Top 25', label: 'Week 11', seasonYear: 2025, requestedWeek: 11, pollWeek: 11, isExactWeek: true, publishedAt: null, rankings: [team(1, 1), team(2, 2)] },
        { type: 'cfp', source: 'College Football Playoff', name: 'CFP Rankings', label: 'Week 11', seasonYear: 2025, requestedWeek: 11, pollWeek: 11, isExactWeek: true, publishedAt: null, rankings: [team(2, 1), team(3, 2)] },
      ],
    };

    const rows = mergeRankingPolls(rankings);

    expect(rows.map((row) => row.teamId)).toEqual([2, 3, 1]);
    expect(rows[0].ap?.rank).toBe(2);
    expect(rows[0].cfp?.rank).toBe(1);
    expect(rows[1].ap).toBeNull();
    expect(rows[2].cfp).toBeNull();
  });
});
