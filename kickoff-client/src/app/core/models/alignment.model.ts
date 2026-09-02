export type LeagueKey = 'ncaa' | 'nfl';

export interface AlignmentTeam {
  name: string;
  /** Optional short code; falls back to initials derived from the name. */
  abbreviation?: string;
  /** Real logo URL when available; otherwise a monogram badge is rendered. */
  logoUrl?: string;
}

export interface AlignmentDivision {
  name: string;
  teams: AlignmentTeam[];
}

export interface AlignmentConference {
  /** Full name, e.g. "Southeastern Conference". */
  name: string;
  /** Short label, e.g. "SEC". */
  shortName: string;
  /** Optional accent color (CSS value) for the conference header. */
  color?: string;
  /** Divisions within the conference. Empty when the conference runs no divisions. */
  divisions: AlignmentDivision[];
}

export interface AlignmentTier {
  /** Section heading, e.g. "Power 4 Conferences" or "AFC". */
  title: string;
  conferences: AlignmentConference[];
}

export interface LeagueAlignment {
  league: LeagueKey;
  title: string;
  subtitle: string;
  tiers: AlignmentTier[];
  /** Teams that belong to no conference (e.g. NCAA independents). */
  independents: AlignmentTeam[];
}
