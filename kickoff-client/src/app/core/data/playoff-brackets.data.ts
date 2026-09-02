export interface BracketSlot {
  seed?: string;
  rule: string;
  team?: string;
}

export interface BracketGame {
  label: string;
  slots: readonly [BracketSlot, BracketSlot];
  note?: string;
}

export interface BracketRound {
  name: string;
  detail: string;
  games: readonly BracketGame[];
}

export interface BracketSection {
  name: string;
  accent: 'college' | 'afc' | 'nfc';
  rounds: readonly BracketRound[];
}

export interface PlayoffBracket {
  league: 'ncaa' | 'nfl';
  eyebrow: string;
  title: string;
  subtitle: string;
  edition: string;
  rules: readonly string[];
  sections: readonly BracketSection[];
  championship?: BracketGame;
}

const slot = (seed: string | undefined, rule: string, team?: string): BracketSlot => ({ seed, rule, team });

export const CFP_BRACKET: PlayoffBracket = {
  league: 'ncaa',
  eyebrow: 'NCAA Division I FBS',
  title: 'College Football Playoff',
  subtitle: 'The 12-team road to the national championship',
  edition: '2026–27 format',
  rules: [
    'Five conference champions receive automatic bids; seven teams receive at-large bids.',
    'The four highest-ranked teams receive first-round byes. Seeds 5–8 host the opening round.',
    'The bracket is fixed after Selection Day—teams are not reseeded between rounds.',
  ],
  sections: [
    {
      name: 'National bracket',
      accent: 'college',
      rounds: [
        {
          name: 'First Round',
          detail: 'Campus sites',
          games: [
            {
              label: 'Game 1',
              slots: [slot('8', 'No. 8 CFP seed · hosts'), slot('9', 'No. 9 CFP seed')],
            },
            {
              label: 'Game 2',
              slots: [slot('5', 'No. 5 CFP seed · hosts'), slot('12', 'No. 12 CFP seed')],
            },
            {
              label: 'Game 3',
              slots: [slot('7', 'No. 7 CFP seed · hosts'), slot('10', 'No. 10 CFP seed')],
            },
            {
              label: 'Game 4',
              slots: [slot('6', 'No. 6 CFP seed · hosts'), slot('11', 'No. 11 CFP seed')],
            },
          ],
        },
        {
          name: 'Quarterfinals',
          detail: 'New Year’s bowls',
          games: [
            {
              label: 'Quarterfinal 1',
              slots: [slot('1', 'No. 1 CFP seed · first-round bye'), slot(undefined, 'Winner of No. 8 vs No. 9')],
            },
            {
              label: 'Quarterfinal 2',
              slots: [slot('4', 'No. 4 CFP seed · first-round bye'), slot(undefined, 'Winner of No. 5 vs No. 12')],
            },
            {
              label: 'Quarterfinal 3',
              slots: [slot('2', 'No. 2 CFP seed · first-round bye'), slot(undefined, 'Winner of No. 7 vs No. 10')],
            },
            {
              label: 'Quarterfinal 4',
              slots: [slot('3', 'No. 3 CFP seed · first-round bye'), slot(undefined, 'Winner of No. 6 vs No. 11')],
            },
          ],
        },
        {
          name: 'Semifinals',
          detail: 'Orange & Sugar bowls',
          games: [
            {
              label: 'Semifinal 1',
              slots: [slot(undefined, 'Winner of Quarterfinal 1'), slot(undefined, 'Winner of Quarterfinal 2')],
            },
            {
              label: 'Semifinal 2',
              slots: [slot(undefined, 'Winner of Quarterfinal 3'), slot(undefined, 'Winner of Quarterfinal 4')],
            },
          ],
        },
        {
          name: 'Championship',
          detail: 'Las Vegas',
          games: [
            {
              label: 'National Championship',
              slots: [slot(undefined, 'Winner of Semifinal 1'), slot(undefined, 'Winner of Semifinal 2')],
              note: 'National champion',
            },
          ],
        },
      ],
    },
  ],
};

function nflConference(name: 'AFC' | 'NFC', accent: 'afc' | 'nfc'): BracketSection {
  return {
    name,
    accent,
    rounds: [
      {
        name: 'Wild Card',
        detail: `${name} No. 1 seed has a bye`,
        games: [
          {
            label: `${name} Wild Card 1`,
            slots: [slot('2', `${name} No. 2 seed · hosts`), slot('7', `${name} No. 7 seed`)],
          },
          {
            label: `${name} Wild Card 2`,
            slots: [slot('3', `${name} No. 3 seed · hosts`), slot('6', `${name} No. 6 seed`)],
          },
          {
            label: `${name} Wild Card 3`,
            slots: [slot('4', `${name} No. 4 seed · hosts`), slot('5', `${name} No. 5 seed`)],
          },
        ],
      },
      {
        name: 'Divisional',
        detail: 'Conference is reseeded',
        games: [
          {
            label: `${name} Divisional 1`,
            slots: [slot('1', `${name} No. 1 seed · hosts`), slot(undefined, 'Lowest remaining seed')],
          },
          {
            label: `${name} Divisional 2`,
            slots: [slot(undefined, 'Higher of the other two remaining seeds · hosts'), slot(undefined, 'Lower of the other two remaining seeds')],
          },
        ],
      },
      {
        name: `${name} Championship`,
        detail: 'Higher remaining seed hosts',
        games: [
          {
            label: `${name} Championship`,
            slots: [slot(undefined, 'Higher-seeded Divisional winner'), slot(undefined, 'Lower-seeded Divisional winner')],
            note: `Winner advances to the Super Bowl`,
          },
        ],
      },
    ],
  };
}

export const NFL_BRACKET: PlayoffBracket = {
  league: 'nfl',
  eyebrow: 'NFL postseason',
  title: 'Road to the Super Bowl',
  subtitle: 'AFC and NFC playoff brackets',
  edition: '14-team format',
  rules: [
    'Seven teams qualify in each conference: four division champions and three wild cards.',
    'The No. 1 seed in each conference receives the only first-round bye.',
    'Each conference is reseeded for the Divisional Round; the No. 1 seed hosts the lowest remaining seed.',
  ],
  sections: [nflConference('AFC', 'afc'), nflConference('NFC', 'nfc')],
  championship: {
    label: 'Super Bowl',
    slots: [slot(undefined, 'AFC champion'), slot(undefined, 'NFC champion')],
    note: 'NFL champion',
  },
};

export function getPlayoffBracket(league: string): PlayoffBracket {
  return league.toLowerCase() === 'nfl' ? NFL_BRACKET : CFP_BRACKET;
}
