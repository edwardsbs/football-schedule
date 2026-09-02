import { AlignmentTeam, LeagueAlignment } from '../models/alignment.model';

// name + ESPN abbreviation → AlignmentTeam with a real logo URL.
const t = (name: string, abbr: string): AlignmentTeam => ({
  name,
  abbreviation: abbr,
  logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`,
});

/**
 * NFL conference & division alignment (32 teams, current structure).
 * Logos come from ESPN's public CDN, keyed by team abbreviation.
 * Stand-in for a real `/api/conferences/nfl` feed.
 */
export const NFL_ALIGNMENT: LeagueAlignment = {
  league: 'nfl',
  title: 'National Football League',
  subtitle: 'Conference & Division Alignment',
  independents: [],
  tiers: [
    {
      title: 'American Football Conference',
      conferences: [
        {
          name: 'American Football Conference',
          shortName: 'AFC',
          color: '#c8102e',
          divisions: [
            {
              name: 'AFC East',
              teams: [t('Buffalo Bills', 'buf'), t('Miami Dolphins', 'mia'), t('New England Patriots', 'ne'), t('New York Jets', 'nyj')],
            },
            {
              name: 'AFC North',
              teams: [t('Baltimore Ravens', 'bal'), t('Cincinnati Bengals', 'cin'), t('Cleveland Browns', 'cle'), t('Pittsburgh Steelers', 'pit')],
            },
            {
              name: 'AFC South',
              teams: [t('Houston Texans', 'hou'), t('Indianapolis Colts', 'ind'), t('Jacksonville Jaguars', 'jax'), t('Tennessee Titans', 'ten')],
            },
            {
              name: 'AFC West',
              teams: [t('Denver Broncos', 'den'), t('Kansas City Chiefs', 'kc'), t('Las Vegas Raiders', 'lv'), t('Los Angeles Chargers', 'lac')],
            },
          ],
        },
      ],
    },
    {
      title: 'National Football Conference',
      conferences: [
        {
          name: 'National Football Conference',
          shortName: 'NFC',
          color: '#013369',
          divisions: [
            {
              name: 'NFC East',
              teams: [t('Dallas Cowboys', 'dal'), t('New York Giants', 'nyg'), t('Philadelphia Eagles', 'phi'), t('Washington Commanders', 'wsh')],
            },
            {
              name: 'NFC North',
              teams: [t('Chicago Bears', 'chi'), t('Detroit Lions', 'det'), t('Green Bay Packers', 'gb'), t('Minnesota Vikings', 'min')],
            },
            {
              name: 'NFC South',
              teams: [t('Atlanta Falcons', 'atl'), t('Carolina Panthers', 'car'), t('New Orleans Saints', 'no'), t('Tampa Bay Buccaneers', 'tb')],
            },
            {
              name: 'NFC West',
              teams: [t('Arizona Cardinals', 'ari'), t('Los Angeles Rams', 'lar'), t('San Francisco 49ers', 'sf'), t('Seattle Seahawks', 'sea')],
            },
          ],
        },
      ],
    },
  ],
};
