export interface FieldPosition {
  down: number | null;
  distance: number | null;
  yardLine: number | null;
  yardsToEndzone: number | null;
  downDistanceText: string | null;
  possessionText: string | null;
  teamExternalId: string | null;
}

export interface SummaryPlay {
  id: string | null;
  text: string | null;
  type: string | null;
  teamExternalId: string | null;
  period: number | null;
  clock: string | null;
  isScoringPlay: boolean;
  isTurnover: boolean;
  isPenalty: boolean;
  scoreValue: number | null;
  homeScore: number | null;
  awayScore: number | null;
  statYardage: number | null;
  start: FieldPosition | null;
  end: FieldPosition | null;
}

export interface DriveSummary {
  teamExternalId: string | null;
  description: string | null;
  result: string | null;
  timeElapsed: string | null;
  plays: number | null;
  yards: number | null;
  isScore: boolean;
  start: FieldPosition | null;
  end: FieldPosition | null;
}

export interface WinProbabilityPoint {
  sequence: number;
  playId: string | null;
  homeWinPercentage: number;
}

export interface TeamStatistic {
  name: string;
  label: string;
  displayValue: string;
}

export interface TeamStatistics {
  teamExternalId: string;
  teamAbbreviation: string;
  statistics: TeamStatistic[];
}

export interface TeamLeader {
  category: string;
  categoryLabel: string;
  athlete: string;
  position: string | null;
  displayValue: string;
  headshotUrl: string | null;
}

export interface TeamLeaders {
  teamExternalId: string;
  teamAbbreviation: string;
  leaders: TeamLeader[];
}

export interface Injury {
  athlete: string;
  position: string | null;
  status: string;
  type: string | null;
  detail: string | null;
  side: string | null;
  updatedUtc: string | null;
  returnDate: string | null;
  headshotUrl: string | null;
}

export interface TeamInjuries {
  teamExternalId: string;
  teamAbbreviation: string;
  injuries: Injury[];
}

export interface GameContext {
  venue: string | null;
  city: string | null;
  state: string | null;
  grass: boolean | null;
  attendance: number | null;
  venueImageUrl: string | null;
}

export interface MarketContext {
  provider: string | null;
  details: string | null;
  spread: number | null;
  overUnder: number | null;
  homeMoneyLine: number | null;
  awayMoneyLine: number | null;
}

export interface StandingEntry {
  teamExternalId: string;
  teamName: string;
  record: string | null;
}

export interface StandingsGroup {
  name: string;
  shortName: string | null;
  entries: StandingEntry[];
}

export interface NewsItem {
  headline: string;
  description: string | null;
  publishedUtc: string | null;
  url: string | null;
  imageUrl: string | null;
}

export interface GameSummary {
  retrievedUtc: string;
  lastPlay: SummaryPlay | null;
  currentDrive: DriveSummary | null;
  scoringPlays: SummaryPlay[];
  homeWinProbability: number | null;
  winProbability: WinProbabilityPoint[];
  teamStatistics: TeamStatistics[];
  leaders: TeamLeaders[];
  injuries: TeamInjuries[];
  context: GameContext | null;
  market: MarketContext | null;
  standings: StandingsGroup[];
  news: NewsItem[];
}
