import { Game, TeamSummary } from '../../core/models/game.model';

/** Every team that appears (home or away) anywhere across a set of games,
 * deduped by id. Used as the "full roster" byes are computed against, rather
 * than every team the API knows about -- which would include teams never
 * actually on this season's schedule and swamp the byes list with noise. */
export function rosterFromGames(games: Game[]): Map<number, TeamSummary> {
  const byId = new Map<number, TeamSummary>();
  for (const game of games) {
    byId.set(game.home.id, game.home);
    byId.set(game.away.id, game.away);
  }
  return byId;
}

/** Roster teams not playing in the given week, sorted by name. Deliberately
 * computed from the full season's games (not a filtered/visible subset), so
 * "My games"/Find Games never change who's on bye. */
export function byeTeamsForWeek(
  games: Game[],
  weekNumber: number,
  roster: Map<number, TeamSummary>,
): TeamSummary[] {
  const playing = new Set<number>();
  for (const game of games) {
    if (game.weekNumber !== weekNumber) continue;
    playing.add(game.home.id);
    playing.add(game.away.id);
  }

  const byes: TeamSummary[] = [];
  for (const [id, team] of roster) {
    if (!playing.has(id)) byes.push(team);
  }
  return byes.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
