export type LeagueName = 'Nfl' | 'Ncaa';
export type GameSafeStatus = 'Upcoming' | 'Live' | 'Final' | 'Postponed' | 'Canceled';
export type MuteType = 'Muted' | 'WatchLater';

export interface TeamSummary {
  id: number;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  primaryColor: string | null;
  currentRank: number | null;
  previousRank?: number | null;
  isFcs: boolean;
}

export interface TeamRecord {
  teamId: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface Broadcast {
  network: string;
  isStreaming: boolean;
}

export interface Score {
  homeScore: number;
  awayScore: number;
  period: number | null;
  clock: string | null;
  possessionTeamId: number | null;
  downDistance: string | null;
  homeWinProbability: number | null;
}

/** Mirrors the API's GameDto. `score` is null when muted (or not started). */
export interface Game {
  id: number;
  league: LeagueName;
  home: TeamSummary;
  away: TeamSummary;
  kickoffUtc: string;
  venue: string | null;
  broadcasts: Broadcast[];
  status: GameSafeStatus;
  isMuted: boolean;
  muteType: MuteType | null;
  score: Score | null;
  hasFavorite: boolean;
  hasInterest: boolean;
  isCircled: boolean;
  weekNumber: number;
  weekLabel: string;
}

export interface FavoriteTeam {
  teamId: number;
  league: LeagueName;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  currentRank: number | null;
}

export interface TeamInterest {
  teamId: number;
  league: LeagueName;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  currentRank: number | null;
}
