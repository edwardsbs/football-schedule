import { MatchLeague, MatchTile, matchTilePool } from '../division-match/division-match-data';
import { shuffle } from './quiz-game-data';

export interface StadiumEntry {
  name: string;
  team: MatchTile;
}

export interface StadiumQuestion {
  stadium: StadiumEntry;
  choices: MatchTile[];
}

/** Current venue names verified against NFL team info and NCAA's 2026 stadium
 * guide. Shared NFL venues are omitted so every prompt has exactly one valid
 * team answer. */
const NFL_STADIUMS: Readonly<Record<string, string>> = {
  'Arizona Cardinals': 'State Farm Stadium',
  'Atlanta Falcons': 'Mercedes-Benz Stadium',
  'Baltimore Ravens': 'M&T Bank Stadium',
  'Buffalo Bills': 'Highmark Stadium',
  'Carolina Panthers': 'Bank of America Stadium',
  'Chicago Bears': 'Soldier Field',
  'Cincinnati Bengals': 'Paycor Stadium',
  'Cleveland Browns': 'Huntington Bank Field',
  'Dallas Cowboys': 'AT&T Stadium',
  'Denver Broncos': 'Empower Field at Mile High',
  'Detroit Lions': 'Ford Field',
  'Green Bay Packers': 'Lambeau Field',
  'Houston Texans': 'NRG Stadium',
  'Indianapolis Colts': 'Lucas Oil Stadium',
  'Jacksonville Jaguars': 'EverBank Stadium',
  'Kansas City Chiefs': 'GEHA Field at Arrowhead Stadium',
  'Las Vegas Raiders': 'Allegiant Stadium',
  'Miami Dolphins': 'Hard Rock Stadium',
  'Minnesota Vikings': 'U.S. Bank Stadium',
  'New England Patriots': 'Gillette Stadium',
  'New Orleans Saints': 'Caesars Superdome',
  'Philadelphia Eagles': 'Lincoln Financial Field',
  'Pittsburgh Steelers': 'Acrisure Stadium',
  'San Francisco 49ers': 'Levi’s Stadium',
  'Seattle Seahawks': 'Lumen Field',
  'Tampa Bay Buccaneers': 'Raymond James Stadium',
  'Tennessee Titans': 'Nissan Stadium',
  'Washington Commanders': 'Northwest Stadium',
};

const NCAA_STADIUMS: Readonly<Record<string, string>> = {
  'Michigan Wolverines': 'Michigan Stadium',
  'Penn State Nittany Lions': 'Beaver Stadium',
  'Ohio State Buckeyes': 'Ohio Stadium',
  'Texas A&M Aggies': 'Kyle Field',
  'LSU Tigers': 'Tiger Stadium',
  'Tennessee Volunteers': 'Neyland Stadium',
  'Texas Longhorns': 'Darrell K Royal–Texas Memorial Stadium',
  'Alabama Crimson Tide': 'Bryant–Denny Stadium',
  'Georgia Bulldogs': 'Sanford Stadium',
  'UCLA Bruins': 'Rose Bowl',
  'Florida Gators': 'Ben Hill Griffin Stadium',
  'Auburn Tigers': 'Jordan–Hare Stadium',
  'Nebraska Cornhuskers': 'Memorial Stadium',
  'Clemson Tigers': 'Clemson Memorial Stadium',
  'Oklahoma Sooners': 'Gaylord Family Oklahoma Memorial Stadium',
  'Notre Dame Fighting Irish': 'Notre Dame Stadium',
  'Florida State Seminoles': 'Doak Campbell Stadium',
  'Wisconsin Badgers': 'Camp Randall Stadium',
  'South Carolina Gamecocks': 'Williams–Brice Stadium',
  'Arkansas Razorbacks': 'Donald W. Reynolds Razorback Stadium',
  'USC Trojans': 'Los Angeles Memorial Coliseum',
  'Michigan State Spartans': 'Spartan Stadium',
  'Washington Huskies': 'Husky Stadium',
  'Iowa Hawkeyes': 'Kinnick Stadium',
  'Oregon Ducks': 'Autzen Stadium',
};

export function stadiumPool(league: MatchLeague): StadiumEntry[] {
  const stadiums = league === 'nfl' ? NFL_STADIUMS : NCAA_STADIUMS;
  return matchTilePool(league)
    .filter((team) => stadiums[team.name])
    .map((team) => ({ name: stadiums[team.name], team }));
}

export function stadiumQuestion(
  league: MatchLeague,
  random: () => number = Math.random,
  previousStadiumName?: string,
): StadiumQuestion {
  const pool = stadiumPool(league);
  const eligible = pool.length > 1 ? pool.filter((entry) => entry.name !== previousStadiumName) : pool;
  const stadium = eligible[Math.floor(random() * eligible.length)];
  const distractors = shuffle(pool.filter((entry) => entry.team.key !== stadium.team.key), random)
    .slice(0, 3)
    .map((entry) => entry.team);
  return { stadium, choices: shuffle([stadium.team, ...distractors], random) };
}
