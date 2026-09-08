export interface MockPlayoffTeam {
  readonly seed: number | null;
  readonly displayName: string;
  readonly abbreviation: string;
  readonly logoUrl: string;
  readonly record: string;
}

export interface MockPlayoffConference {
  readonly name: 'AFC' | 'NFC';
  readonly teams: readonly MockPlayoffTeam[];
  readonly bubble: readonly MockPlayoffTeam[];
}

const team = (
  seed: number | null,
  displayName: string,
  abbreviation: string,
  espnCode: string,
  record: string,
): MockPlayoffTeam => ({
  seed,
  displayName,
  abbreviation,
  logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${espnCode}.png`,
  record,
});

/** Final 2025 postseason field plus the two teams eliminated in the Week 18
 * games that decided the last AFC and NFC berths. Temporary presentation data
 * for evaluating the rail before current-season projections are introduced. */
export const MOCK_2025_PLAYOFF_PICTURE: readonly MockPlayoffConference[] = [
  {
    name: 'AFC',
    teams: [
      team(1, 'Denver Broncos', 'DEN', 'den', '14–3'),
      team(2, 'New England Patriots', 'NE', 'ne', '14–3'),
      team(3, 'Jacksonville Jaguars', 'JAX', 'jax', '13–4'),
      team(4, 'Pittsburgh Steelers', 'PIT', 'pit', '10–7'),
      team(5, 'Houston Texans', 'HOU', 'hou', '12–5'),
      team(6, 'Buffalo Bills', 'BUF', 'buf', '12–5'),
      team(7, 'Los Angeles Chargers', 'LAC', 'lac', '11–6'),
    ],
    bubble: [team(null, 'Baltimore Ravens', 'BAL', 'bal', '8–9')],
  },
  {
    name: 'NFC',
    teams: [
      team(1, 'Seattle Seahawks', 'SEA', 'sea', '14–3'),
      team(2, 'Chicago Bears', 'CHI', 'chi', '11–6'),
      team(3, 'Philadelphia Eagles', 'PHI', 'phi', '11–6'),
      team(4, 'Carolina Panthers', 'CAR', 'car', '8–9'),
      team(5, 'Los Angeles Rams', 'LAR', 'lar', '12–5'),
      team(6, 'San Francisco 49ers', 'SF', 'sf', '12–5'),
      team(7, 'Green Bay Packers', 'GB', 'gb', '9–7–1'),
    ],
    bubble: [team(null, 'Tampa Bay Buccaneers', 'TB', 'tb', '8–9')],
  },
] as const;
