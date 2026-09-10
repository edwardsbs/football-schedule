import { Game, TeamSummary } from '../../core/models/game.model';
import { byeTeamsForWeek, rosterFromGames } from './bye-teams';

describe('Season schedule bye teams', () => {
  const alpha = team(1, 'Alpha');
  const bravo = team(2, 'Bravo');
  const charlie = team(3, 'Charlie');
  const delta = team(4, 'Delta');

  const games: Game[] = [
    matchup(alpha, bravo, 1),
    matchup(charlie, delta, 1),
    matchup(alpha, charlie, 2),
    // Bravo and Delta sit out week 2.
  ];

  it('builds the full roster from every team appearing in any game', () => {
    const roster = rosterFromGames(games);
    expect(roster.size).toBe(4);
    expect(roster.get(1)).toEqual(alpha);
  });

  it('returns no byes for a week where the whole roster plays', () => {
    const roster = rosterFromGames(games);
    expect(byeTeamsForWeek(games, 1, roster)).toEqual([]);
  });

  it('returns the teams not playing that week, sorted by name', () => {
    const roster = rosterFromGames(games);
    const byes = byeTeamsForWeek(games, 2, roster);
    expect(byes.map((t) => t.displayName)).toEqual(['Bravo', 'Delta']);
  });

  it('returns an empty list for a week with no games at all', () => {
    const roster = rosterFromGames(games);
    expect(byeTeamsForWeek(games, 9, roster)).toEqual([alpha, bravo, charlie, delta]);
  });
});

function team(id: number, displayName: string): TeamSummary {
  return {
    id,
    displayName,
    abbreviation: displayName.slice(0, 3).toUpperCase(),
    logoUrl: null,
    primaryColor: null,
    currentRank: null,
    isFcs: false,
  };
}

function matchup(home: TeamSummary, away: TeamSummary, weekNumber: number): Game {
  return {
    id: home.id * 100 + away.id,
    league: 'Ncaa',
    home,
    away,
    kickoffUtc: new Date(2026, 8, weekNumber * 7).toISOString(),
    venue: null,
    broadcasts: [],
    status: 'Upcoming',
    isMuted: false,
    muteType: null,
    score: null,
    hasFavorite: false,
    hasInterest: false,
    isCircled: false,
    weekNumber,
    weekLabel: `Week ${weekNumber}`,
  };
}
