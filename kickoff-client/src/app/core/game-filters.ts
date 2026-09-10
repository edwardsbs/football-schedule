import { Game, TeamRecord } from './models/game.model';
import { isFollowedGame } from './timeline';

export type GameLeagueFilter = 'all' | 'nfl' | 'ncaa';
export type RankScope = 'any' | 'top25' | 'vs';

/** Find Games filter state, reused across Day, Week, Season Schedule and Game
 * Day Central. Each page owns its own instance (page-local, not persisted),
 * matching how "My games" already works on those pages. */
export interface GameFilters {
  league: GameLeagueFilter;
  /** Conference (NCAA) / division (NFL) labels; empty = no restriction. */
  groups: string[];
  rankScope: RankScope;
  /** "Rivalry" proxy: both teams resolve to the same conference/division. */
  sameGroupOnly: boolean;
  /** Local hour (0-23) a game must kick off at or after, or null for any time. */
  kickoffAfterHour: number | null;
  hideCompleted: boolean;
  keepMineWhenHidden: boolean;
  eliteRecordsOnly: boolean;
  undefeatedOnly: boolean;
  hideFcsOpponent: boolean;
}

export function defaultGameFilters(): GameFilters {
  return {
    league: 'all',
    groups: [],
    rankScope: 'any',
    sameGroupOnly: false,
    kickoffAfterHour: null,
    hideCompleted: false,
    keepMineWhenHidden: true,
    eliteRecordsOnly: false,
    undefeatedOnly: false,
    hideFcsOpponent: false,
  };
}

export function countActiveGameFilters(f: GameFilters): number {
  let n = 0;
  if (f.league !== 'all') n++;
  if (f.groups.length) n++;
  if (f.rankScope !== 'any') n++;
  if (f.sameGroupOnly) n++;
  if (f.kickoffAfterHour !== null) n++;
  if (f.hideCompleted) n++;
  if (f.eliteRecordsOnly) n++;
  if (f.undefeatedOnly) n++;
  if (f.hideFcsOpponent) n++;
  return n;
}

export interface GameFilterContext {
  groupOf(teamId: number): string | null;
  recordOf(teamId: number): TeamRecord | null;
}

function isElite(record: TeamRecord | null): boolean {
  if (!record) return false;
  const games = record.wins + record.losses + record.ties;
  return games > 0 && record.wins / games >= 0.75;
}

function isUndefeated(record: TeamRecord | null): boolean {
  if (!record) return false;
  return record.losses === 0 && record.wins + record.ties > 0;
}

export function matchesGameFilters(game: Game, filters: GameFilters, ctx: GameFilterContext): boolean {
  const league: GameLeague = game.league === 'Nfl' ? 'nfl' : 'ncaa';
  if (filters.league !== 'all' && filters.league !== league) return false;

  const homeGroup = ctx.groupOf(game.home.id);
  const awayGroup = ctx.groupOf(game.away.id);

  if (filters.groups.length) {
    const inGroup = (g: string | null) => g !== null && filters.groups.includes(g);
    if (!inGroup(homeGroup) && !inGroup(awayGroup)) return false;
  }

  if (filters.sameGroupOnly && (!homeGroup || homeGroup !== awayGroup)) return false;

  if (filters.rankScope === 'top25') {
    if (game.home.currentRank === null && game.away.currentRank === null) return false;
  } else if (filters.rankScope === 'vs') {
    if (game.home.currentRank === null || game.away.currentRank === null) return false;
  }

  if (filters.kickoffAfterHour !== null) {
    if (new Date(game.kickoffUtc).getHours() < filters.kickoffAfterHour) return false;
  }

  if (filters.hideCompleted && game.status === 'Final') {
    if (!(filters.keepMineWhenHidden && isFollowedGame(game))) return false;
  }

  if (filters.eliteRecordsOnly) {
    if (!isElite(ctx.recordOf(game.home.id)) || !isElite(ctx.recordOf(game.away.id))) return false;
  }

  if (filters.undefeatedOnly) {
    if (!isUndefeated(ctx.recordOf(game.home.id)) || !isUndefeated(ctx.recordOf(game.away.id))) return false;
  }

  if (filters.hideFcsOpponent && league === 'ncaa' && (game.home.isFcs || game.away.isFcs)) return false;

  return true;
}

type GameLeague = 'nfl' | 'ncaa';
