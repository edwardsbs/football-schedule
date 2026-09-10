import { TeamRecord } from './models/game.model';

export type MinRecordFilter = 'any' | '500' | '750' | 'undefeated';

/** Find Teams filter state, scoped to the Conferences pages. Conference/division
 * isn't a filter option here on purpose -- the page already groups teams that
 * way, so this narrows *within* that layout instead. */
export interface TeamFilters {
  search: string;
  favoritesOnly: boolean;
  interestOnly: boolean;
  rankedOnly: boolean;
  minRecord: MinRecordFilter;
}

export function defaultTeamFilters(): TeamFilters {
  return {
    search: '',
    favoritesOnly: false,
    interestOnly: false,
    rankedOnly: false,
    minRecord: 'any',
  };
}

export function countActiveTeamFilters(f: TeamFilters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.favoritesOnly) n++;
  if (f.interestOnly) n++;
  if (f.rankedOnly) n++;
  if (f.minRecord !== 'any') n++;
  return n;
}

export interface TeamFilterEntry {
  name: string;
  isFavorite: boolean;
  isInterest: boolean;
  rank: number | null;
  record: TeamRecord | null;
}

function winPct(record: TeamRecord | null): number | null {
  if (!record) return null;
  const games = record.wins + record.losses + record.ties;
  return games === 0 ? null : record.wins / games;
}

function isUndefeated(record: TeamRecord | null): boolean {
  if (!record) return false;
  return record.losses === 0 && record.wins + record.ties > 0;
}

export function matchesTeamFilters(entry: TeamFilterEntry, filters: TeamFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search && !entry.name.toLowerCase().includes(search)) return false;

  if (filters.favoritesOnly || filters.interestOnly) {
    const matchesFavorite = filters.favoritesOnly && entry.isFavorite;
    const matchesInterest = filters.interestOnly && entry.isInterest;
    if (!matchesFavorite && !matchesInterest) return false;
  }

  if (filters.rankedOnly && entry.rank === null) return false;

  if (filters.minRecord === 'undefeated') {
    if (!isUndefeated(entry.record)) return false;
  } else if (filters.minRecord !== 'any') {
    const threshold = filters.minRecord === '750' ? 0.75 : 0.5;
    const pct = winPct(entry.record);
    if (pct === null || pct < threshold) return false;
  }

  return true;
}
