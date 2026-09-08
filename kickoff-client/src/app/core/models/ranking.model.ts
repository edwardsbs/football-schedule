export interface RankedTeam {
  teamId: number;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  rank: number;
  previousRank: number | null;
}

export interface RankingPoll {
  type: 'ap' | 'cfp';
  source: string;
  name: string;
  label: string;
  seasonYear: number;
  requestedWeek: number;
  pollWeek: number;
  isExactWeek: boolean;
  publishedAt: string | null;
  rankings: RankedTeam[];
}

export interface NcaaRankings {
  seasonYear: number;
  requestedWeek: number | null;
  polls: RankingPoll[];
}

export interface RankingRow {
  teamId: number;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  ap: RankedTeam | null;
  cfp: RankedTeam | null;
}
