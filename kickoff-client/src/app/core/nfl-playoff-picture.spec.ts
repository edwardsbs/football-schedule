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
