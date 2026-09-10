import { Game } from './models/game.model';
import { PlayoffTeamEntry, buildPlayoffPicture } from './nfl-playoff-picture';

describe('NFL playoff picture', () => {
  // AFC East: Buffalo (best) beats the rest. AFC North/South/West: one clear
  // winner each. Two extra AFC teams (non-winners) compete for wild cards.
  const entries: PlayoffTeamEntry[] = [
    team(1, 'Buffalo Bills', 'BUF', 'AFC East', 10, 2),
    team(2, 'Miami Dolphins', 'MIA', 'AFC East', 6, 6),
    team(3, 'Baltimore Ravens', 'BAL', 'AFC North', 9, 3),
    team(4, 'Cincinnati Bengals', 'CIN', 'AFC North', 5, 7),
    team(5, 'Houston Texans', 'HOU', 'AFC South', 8, 4),
    team(6, 'Indianapolis Colts', 'IND', 'AFC South', 4, 8),
    team(7, 'Kansas City Chiefs', 'KC', 'AFC West', 11, 1),
    team(8, 'Denver Broncos', 'DEN', 'AFC West', 3, 9),
    // Wild card contenders, not division winners.
    team(9, 'Los Angeles Chargers', 'LAC', 'AFC West', 9, 3),
    team(10, 'Pittsburgh Steelers', 'PIT', 'AFC North', 8, 4),
    team(11, 'New York Jets', 'NYJ', 'AFC East', 7, 5),
    team(12, 'Jacksonville Jaguars', 'JAX', 'AFC South', 6, 6),

    // A minimal NFC side so the conference split itself is exercised too.
    team(20, 'San Francisco 49ers', 'SF', 'NFC West', 9, 3),
    team(21, 'Seattle Seahawks', 'SEA', 'NFC West', 6, 6),
    team(22, 'Dallas Cowboys', 'DAL', 'NFC East', 8, 4),
    team(23, 'Green Bay Packers', 'GB', 'NFC North', 8, 4),
    team(24, 'Tampa Bay Buccaneers', 'TB', 'NFC South', 7, 5),
  ];

  it('defaults every seeded and next-in team to "hunt" status -- real clinch detection is not built yet', () => {
    const [afc] = buildPlayoffPicture(entries, []);
    expect([...afc.seeds, ...afc.nextIn].every((s) => s.status === 'hunt')).toBeTrue();
  });

  it('marks every eliminated team with "eliminated" status', () => {
    const [afc] = buildPlayoffPicture(entries, []);
    expect(afc.eliminated.length).toBeGreaterThan(0);
    expect(afc.eliminated.every((s) => s.status === 'eliminated')).toBeTrue();
  });

  it('splits entries by conference using the division label prefix', () => {
    const [afc, nfc] = buildPlayoffPicture(entries, []);
    expect(afc.name).toBe('AFC');
    expect(nfc.name).toBe('NFC');
    expect(nfc.seeds.every((s) => ['SF', 'DAL', 'GB', 'TB', 'SEA'].includes(s.abbreviation))).toBeTrue();
  });

  it('seeds the four division winners 1-4 in record order', () => {
    const [afc] = buildPlayoffPicture(entries, []);
    const divisionWinners = afc.seeds.slice(0, 4);
    expect(divisionWinners.map((s) => s.abbreviation)).toEqual(['KC', 'BUF', 'BAL', 'HOU']);
    expect(divisionWinners.every((s) => s.isDivisionWinner)).toBeTrue();
  });

  it('fills wild card seeds 5-7 from the best non-winning records', () => {
    const [afc] = buildPlayoffPicture(entries, []);
    const wildcards = afc.seeds.slice(4, 7);
    // LAC (9-3) and PIT (8-4) beat every other non-winner; NYJ (7-5) is next.
    expect(wildcards.map((s) => s.abbreviation)).toEqual(['LAC', 'PIT', 'NYJ']);
    expect(wildcards.every((s) => !s.isDivisionWinner)).toBeTrue();
  });

  it('marks only the #1 seed as a bye', () => {
    const [afc] = buildPlayoffPicture(entries, []);
    expect(afc.seeds[0].isBye).toBeTrue();
    expect(afc.seeds.slice(1).every((s) => !s.isBye)).toBeTrue();
  });

  it('lists the next two best records outside the field as "next in"', () => {
    const [afc] = buildPlayoffPicture(entries, []);
    expect(afc.nextIn.map((s) => s.abbreviation)).toEqual(['JAX', 'MIA']);
    expect(afc.nextIn.map((s) => s.seed)).toEqual([8, 9]);
  });

  it('breaks a tied division record using this season\'s head-to-head result', () => {
    const tied: PlayoffTeamEntry[] = [
      team(30, 'Denver Broncos', 'DEN', 'AFC West', 9, 5),
      team(31, 'Kansas City Chiefs', 'KC', 'AFC West', 9, 5),
      team(32, 'Buffalo Bills', 'BUF', 'AFC East', 6, 8),
      team(33, 'Baltimore Ravens', 'BAL', 'AFC North', 6, 8),
      team(34, 'Houston Texans', 'HOU', 'AFC South', 6, 8),
    ];
    const splitSeries: Game[] = [game(30, 31, 24, 20), game(31, 30, 27, 24)];
    // A split season series (1-1) falls through to total wins (also tied), then name -- DEN wins alphabetically.
    expect(buildPlayoffPicture(tied, splitSeries)[0].seeds[0].abbreviation).toBe('DEN');

    // Give Denver a second win over KC, making the season series 2-1 -- now decisive.
    const decisiveGames: Game[] = [...splitSeries, game(30, 31, 17, 10)];
    const decided = buildPlayoffPicture(tied, decisiveGames)[0];
    expect(decided.seeds[0].abbreviation).toBe('DEN');

    // KC lost the head-to-head tiebreak for the division, so despite a far
    // better record than the other (uncontested) division winners, it can
    // only reach a wild card seed -- a real division winner always outranks
    // a non-division-winner in seeds 1-4, regardless of record.
    const kc = decided.seeds.find((s) => s.abbreviation === 'KC');
    expect(kc?.isDivisionWinner).toBeFalse();
    expect(kc?.seed).toBeGreaterThan(4);
  });

  it('flags teams with no remaining games who already trail both bars as eliminated', () => {
    // With zero games in the fixture, every team's "ceiling" is just its
    // current wins -- no more room to climb.
    const [afc] = buildPlayoffPicture(entries, []);
    expect(afc.eliminated.map((s) => s.abbreviation)).toEqual(['CIN', 'IND', 'DEN']);
  });

  it('does not eliminate a division winner, wild card, or "next in" team', () => {
    const [afc] = buildPlayoffPicture(entries, []);
    const eliminatedAbbrs = new Set(afc.eliminated.map((s) => s.abbreviation));
    const stillShownAbbrs = [...afc.seeds, ...afc.nextIn].map((s) => s.abbreviation);
    for (const abbr of stillShownAbbrs) expect(eliminatedAbbrs.has(abbr)).toBeFalse();
  });

  it('does not eliminate a team whose remaining games could still reach the wild card bar', () => {
    const teams: PlayoffTeamEntry[] = [
      team(60, 'Buffalo Bills', 'BUF', 'AFC East', 11, 1),
      team(61, 'Baltimore Ravens', 'BAL', 'AFC North', 11, 1),
      team(62, 'Houston Texans', 'HOU', 'AFC South', 11, 1),
      team(63, 'Kansas City Chiefs', 'KC', 'AFC West', 11, 1),
      team(64, 'Los Angeles Chargers', 'LAC', 'AFC West', 9, 3),
      team(65, 'Pittsburgh Steelers', 'PIT', 'AFC North', 9, 3),
      team(66, 'Jacksonville Jaguars', 'JAX', 'AFC South', 9, 3),
      // Miami has played fewer games and has plenty left to make up ground.
      team(67, 'Miami Dolphins', 'MIA', 'AFC East', 4, 2),
    ];
    const remaining: Game[] = Array.from({ length: 6 }, (_, i) => upcomingGame(67, 900 + i));
    const [afc] = buildPlayoffPicture(teams, remaining);
    expect(afc.eliminated.some((s) => s.abbreviation === 'MIA')).toBeFalse();
  });

  it('does not eliminate a team that could still catch its own (weak) division leader', () => {
    // A full 16-team AFC so the wild card bar (8) sits well above anything
    // West's teams can reach -- isolating the division path as KC's only hope.
    const base: PlayoffTeamEntry[] = [
      team(70, 'Buffalo Bills', 'BUF', 'AFC East', 12, 2),
      team(71, 'Miami Dolphins', 'MIA', 'AFC East', 10, 4),
      team(72, 'New York Jets', 'NYJ', 'AFC East', 8, 6),
      team(73, 'New England Patriots', 'NE', 'AFC East', 6, 8),
      team(74, 'Baltimore Ravens', 'BAL', 'AFC North', 12, 2),
      team(75, 'Pittsburgh Steelers', 'PIT', 'AFC North', 10, 4),
      team(76, 'Cincinnati Bengals', 'CIN', 'AFC North', 8, 6),
      team(77, 'Cleveland Browns', 'CLE', 'AFC North', 6, 8),
      team(78, 'Houston Texans', 'HOU', 'AFC South', 12, 2),
      team(79, 'Indianapolis Colts', 'IND', 'AFC South', 10, 4),
      team(80, 'Jacksonville Jaguars', 'JAX', 'AFC South', 8, 6),
      team(81, 'Tennessee Titans', 'TEN', 'AFC South', 6, 8),
      team(82, 'Denver Broncos', 'DEN', 'AFC West', 3, 11), // weak division "leader"
      team(83, 'Kansas City Chiefs', 'KC', 'AFC West', 2, 10),
      team(84, 'Los Angeles Chargers', 'LAC', 'AFC West', 1, 13),
      team(85, 'Las Vegas Raiders', 'LV', 'AFC West', 0, 14),
    ];
    const noGamesLeft = buildPlayoffPicture(base, [])[0];
    expect(noGamesLeft.eliminated.some((s) => s.abbreviation === 'KC')).toBeTrue();

    const withTwoGamesLeft = buildPlayoffPicture(base, [upcomingGame(83, 901), upcomingGame(83, 902)])[0];
    expect(withTwoGamesLeft.eliminated.some((s) => s.abbreviation === 'KC')).toBeFalse();
  });

  it('returns an empty conference field when no teams resolve to it', () => {
    const [, nfc] = buildPlayoffPicture([team(1, 'Buffalo Bills', 'BUF', 'AFC East', 10, 2)], []);
    expect(nfc.seeds).toEqual([]);
    expect(nfc.nextIn).toEqual([]);
  });
});

function team(id: number, name: string, abbr: string, division: string, wins: number, losses: number): PlayoffTeamEntry {
  return {
    teamId: id,
    displayName: name,
    abbreviation: abbr,
    logoUrl: null,
    division,
    record: { teamId: id, wins, losses, ties: 0 },
  };
}

function game(homeId: number, awayId: number, homeScore: number, awayScore: number): Game {
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

/** An unplayed game counting toward `teamId`'s remaining-games total; the
 * opponent id just needs to be distinct from every real team in the fixture. */
function upcomingGame(teamId: number, opponentId: number): Game {
  return { ...game(teamId, opponentId, 0, 0), status: 'Upcoming', score: null };
}
