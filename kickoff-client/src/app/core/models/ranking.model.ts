export interface RankedTeam {
  teamId: number;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  rank: number;
  previousRank: number | null;
}

export interface RankingPoll {
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
