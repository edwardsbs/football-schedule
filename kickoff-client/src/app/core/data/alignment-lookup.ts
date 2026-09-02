import { LeagueAlignment, LeagueKey } from '../models/alignment.model';
import { NCAA_ALIGNMENT } from './ncaa-alignment.data';
import { NFL_ALIGNMENT } from './nfl-alignment.data';

const ALIGNMENTS: Record<LeagueKey, LeagueAlignment> = {
  ncaa: NCAA_ALIGNMENT,
  nfl: NFL_ALIGNMENT,
};

export const isLeagueKey = (value: string | null | undefined): value is LeagueKey =>
  value === 'ncaa' || value === 'nfl';

export const getAlignment = (league: string | null | undefined): LeagueAlignment | null =>
  isLeagueKey(league) ? ALIGNMENTS[league] : null;
