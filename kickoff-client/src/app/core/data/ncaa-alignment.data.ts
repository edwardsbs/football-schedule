import { LeagueAlignment } from '../models/alignment.model';
import { ncaaLogoUrl } from './ncaa-logos';

/** Athletic nicknames used to render the complete team name in alignment cards. */
const NCAA_MASCOTS: Readonly<Record<string, string>> = {
  Alabama: 'Crimson Tide',
  Florida: 'Gators',
  Georgia: 'Bulldogs',
  Kentucky: 'Wildcats',
  'Mississippi State': 'Bulldogs',
  Missouri: 'Tigers',
  'South Carolina': 'Gamecocks',
  Tennessee: 'Volunteers',
  Arkansas: 'Razorbacks',
  Auburn: 'Tigers',
  LSU: 'Tigers',
  Oklahoma: 'Sooners',
  'Ole Miss': 'Rebels',
  'Texas A&M': 'Aggies',
  Vanderbilt: 'Commodores',
  Texas: 'Longhorns',
  Illinois: 'Fighting Illini',
  Indiana: 'Hoosiers',
  Michigan: 'Wolverines',
  'Michigan State': 'Spartans',
  'Ohio State': 'Buckeyes',
  'Penn State': 'Nittany Lions',
  Rutgers: 'Scarlet Knights',
  Wisconsin: 'Badgers',
  Iowa: 'Hawkeyes',
  Maryland: 'Terrapins',
  Minnesota: 'Golden Gophers',
  Nebraska: 'Cornhuskers',
  Northwestern: 'Wildcats',
  Oregon: 'Ducks',
  Purdue: 'Boilermakers',
  UCLA: 'Bruins',
  USC: 'Trojans',
  Washington: 'Huskies',
  Arizona: 'Wildcats',
  'Arizona State': 'Sun Devils',
  BYU: 'Cougars',
  Colorado: 'Buffaloes',
  Kansas: 'Jayhawks',
  'Kansas State': 'Wildcats',
  Utah: 'Utes',
  Baylor: 'Bears',
  Cincinnati: 'Bearcats',
  Houston: 'Cougars',
  'Iowa State': 'Cyclones',
  'Oklahoma State': 'Cowboys',
  TCU: 'Horned Frogs',
  'Texas Tech': 'Red Raiders',
  'West Virginia': 'Mountaineers',
  'Boston College': 'Eagles',
  Clemson: 'Tigers',
  'Florida State': 'Seminoles',
  Louisville: 'Cardinals',
  'NC State': 'Wolfpack',
  Syracuse: 'Orange',
  'Wake Forest': 'Demon Deacons',
  Cal: 'Golden Bears',
  Duke: 'Blue Devils',
  'Georgia Tech': 'Yellow Jackets',
  Miami: 'Hurricanes',
  'North Carolina': 'Tar Heels',
  Pittsburgh: 'Panthers',
  Virginia: 'Cavaliers',
  'Virginia Tech': 'Hokies',
  SMU: 'Mustangs',
  'Boise State': 'Broncos',
  'Oregon State': 'Beavers',
  'Washington State': 'Cougars',
  Stanford: 'Cardinal',
  'Colorado State': 'Rams',
  'San Diego State': 'Aztecs',
  Charlotte: '49ers',
  'East Carolina': 'Pirates',
  'Florida Atlantic': 'Owls',
  Memphis: 'Tigers',
  Navy: 'Midshipmen',
  Rice: 'Owls',
  Temple: 'Owls',
  Tulane: 'Green Wave',
  'North Texas': 'Mean Green',
  'South Florida': 'Bulls',
  Tulsa: 'Golden Hurricane',
  UTSA: 'Roadrunners',
  UAB: 'Blazers',
  UConn: 'Huskies',
  'Air Force': 'Falcons',
  Hawaii: 'Rainbow Warriors',
  'New Mexico': 'Lobos',
  'Utah State': 'Aggies',
  Wyoming: 'Cowboys',
  Idaho: 'Vandals',
  Nevada: 'Wolf Pack',
  'New Mexico State': 'Aggies',
  UNLV: 'Rebels',
  'North Dakota State': 'Bison',
  'Appalachian State': 'Mountaineers',
  'Coastal Carolina': 'Chanticleers',
  'Georgia Southern': 'Eagles',
  'James Madison': 'Dukes',
  Marshall: 'Thundering Herd',
  'Old Dominion': 'Monarchs',
  'Southern Miss': 'Golden Eagles',
  Louisiana: "Ragin' Cajuns",
  'Louisiana Tech': 'Bulldogs',
  'South Alabama': 'Jaguars',
  Troy: 'Trojans',
  'Texas State': 'Bobcats',
  'UL Monroe': 'Warhawks',
  Akron: 'Zips',
  'Ball State': 'Cardinals',
  'Bowling Green': 'Falcons',
  Buffalo: 'Bulls',
  'Central Michigan': 'Chippewas',
  'Eastern Michigan': 'Eagles',
  'Kent State': 'Golden Flashes',
  'Miami (OH)': 'RedHawks',
  'Northern Illinois': 'Huskies',
  Ohio: 'Bobcats',
  Toledo: 'Rockets',
  'Western Michigan': 'Broncos',
  Delaware: "Fightin' Blue Hens",
  FIU: 'Panthers',
  'Kennesaw State': 'Owls',
  Liberty: 'Flames',
  'Middle Tennessee': 'Blue Raiders',
  'Sam Houston': 'Bearkats',
  UTEP: 'Miners',
  'Western Kentucky': 'Hilltoppers',
  'Notre Dame': 'Fighting Irish',
};

// Team-name list → AlignmentTeam[], adding the mascot while preserving the base name for logo lookup.
const t = (...names: string[]) =>
  names.map((name) => ({
    name: NCAA_MASCOTS[name] ? `${name} ${NCAA_MASCOTS[name]}` : name,
    logoUrl: ncaaLogoUrl(name),
  }));

/**
 * 2026 NCAA Division I FBS conference alignment.
 *
 * Transcribed directly from the reference infographic (membership as of May
 * 2026), including its quirks — this is a stylized/fictional alignment, so a
 * few schools appear in more than one conference. It is a stand-in for a real
 * `/api/conferences/ncaa` feed and will be replaced once the backend serves
 * conference data.
 */
export const NCAA_ALIGNMENT: LeagueAlignment = {
  league: 'ncaa',
  title: '2026 NCAA Division I FBS',
  subtitle: 'Conference Alignment',
  independents: t('Notre Dame'),
  tiers: [
    {
      title: 'Power 4 Conferences',
      conferences: [
        {
          name: 'Southeastern Conference',
          shortName: 'SEC',
          color: '#4d1979',
          divisions: [
            {
              name: 'Eastern Division',
              teams: t('Alabama', 'Florida', 'Georgia', 'Kentucky', 'Mississippi State', 'Missouri', 'South Carolina', 'Tennessee'),
            },
            {
              name: 'Western Division',
              teams: t('Arkansas', 'Auburn', 'LSU', 'Oklahoma', 'Ole Miss', 'Texas A&M', 'Vanderbilt'),
            },
          ],
        },
        {
          name: 'Big Ten Conference',
          shortName: 'B1G',
          color: '#0b3d91',
          divisions: [
            {
              name: 'East Division',
              teams: t('Illinois', 'Indiana', 'Michigan', 'Michigan State', 'Ohio State', 'Penn State', 'Rutgers', 'Wisconsin'),
            },
            {
              name: 'West Division',
              teams: t('Iowa', 'Maryland', 'Minnesota', 'Nebraska', 'Northwestern', 'Oregon', 'Purdue', 'UCLA', 'USC', 'Washington'),
            },
          ],
        },
        {
          name: 'Big 12 Conference',
          shortName: 'XII',
          color: '#b30838',
          divisions: [
            {
              name: 'Arizona Division',
              teams: t('Arizona', 'Arizona State', 'BYU', 'Colorado', 'Kansas', 'Kansas State', 'Utah'),
            },
            {
              name: 'Utah Division',
              teams: t('Baylor', 'Cincinnati', 'Houston', 'Iowa State', 'Oklahoma State', 'TCU', 'Texas Tech', 'West Virginia'),
            },
          ],
        },
        {
          name: 'Atlantic Coast Conference',
          shortName: 'ACC',
          color: '#013ca6',
          divisions: [
            {
              name: 'Atlantic Division',
              teams: t('Boston College', 'Clemson', 'Florida State', 'Louisville', 'NC State', 'Syracuse', 'Wake Forest'),
            },
            {
              name: 'Coastal Division',
              teams: t('Cal', 'Duke', 'Georgia Tech', 'Miami', 'North Carolina', 'Pittsburgh', 'Virginia', 'Virginia Tech', 'SMU'),
            },
          ],
        },
      ],
    },
    {
      title: 'Other FBS Conferences',
      conferences: [
        {
          name: 'Pac-12 Conference',
          shortName: 'PAC-12',
          color: '#1b4b8a',
          divisions: [
            {
              name: 'North Division',
              teams: t('Boise State', 'Oregon State', 'Washington State', 'Cal', 'Stanford', 'Washington'),
            },
            {
              name: 'South Division',
              teams: t('Arizona State', 'Colorado State', 'Utah', 'UCLA', 'USC', 'San Diego State'),
            },
          ],
        },
        {
          name: 'American Athletic Conference',
          shortName: 'American',
          color: '#00538c',
          divisions: [
            {
              name: 'East Division',
              teams: t('Charlotte', 'East Carolina', 'Florida Atlantic', 'Memphis', 'Navy', 'Rice', 'Temple', 'Tulane'),
            },
            {
              name: 'West Division',
              teams: t('North Texas', 'South Florida', 'Tulsa', 'UTSA', 'UAB', 'UConn'),
            },
          ],
        },
        {
          name: 'Mountain West Conference',
          shortName: 'Mountain West',
          color: '#6a3fa0',
          divisions: [
            {
              name: 'Mountain Division',
              teams: t('Air Force', 'Colorado State', 'Hawaii', 'New Mexico', 'Utah State', 'Wyoming'),
            },
            {
              name: 'West Division',
              teams: t('Idaho', 'Nevada', 'New Mexico State', 'San Diego State', 'UNLV', 'North Dakota State'),
            },
          ],
        },
        {
          name: 'Sun Belt Conference',
          shortName: 'Sun Belt',
          color: '#a07800',
          divisions: [
            {
              name: 'East Division',
              teams: t('Appalachian State', 'Coastal Carolina', 'Georgia Southern', 'James Madison', 'Marshall', 'Old Dominion', 'Southern Miss'),
            },
            {
              name: 'West Division',
              teams: t('Louisiana', 'Louisiana Tech', 'South Alabama', 'Troy', 'Texas State', 'UL Monroe'),
            },
          ],
        },
        {
          name: 'Mid-American Conference',
          shortName: 'MAC',
          color: '#0a6640',
          divisions: [
            {
              name: 'East Division',
              teams: t('Akron', 'Ball State', 'Bowling Green', 'Buffalo', 'Central Michigan', 'Eastern Michigan'),
            },
            {
              name: 'West Division',
              teams: t('Kent State', 'Miami (OH)', 'Northern Illinois', 'Ohio', 'Toledo', 'Western Michigan'),
            },
          ],
        },
        {
          name: 'Conference USA',
          shortName: 'C-USA',
          color: '#00263a',
          divisions: [
            {
              name: 'East Division',
              teams: t('Delaware', 'FIU', 'Kennesaw State', 'Liberty', 'Middle Tennessee', 'New Mexico State'),
            },
            {
              name: 'West Division',
              teams: t('Sam Houston', 'UTEP', 'Western Kentucky'),
            },
          ],
        },
      ],
    },
  ],
};
