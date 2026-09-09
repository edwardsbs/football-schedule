import { Game } from './models/game.model';

/** A snap from the opponent's 38 produces roughly a 55-yard field-goal try. */
export const DEFAULT_FIELD_GOAL_RANGE_YARD_LINE = 38;
export const RED_ZONE_YARD_LINE = 20;
export const OPPONENT_TERRITORY_YARD_LINE = 49;

/**
 * Returns true only when the live scoreboard explicitly places the possessing
 * team on the opponent's side at or inside the configured yard line.
 */
export function isInFieldGoalRange(
  game: Game,
  rangeYardLine = DEFAULT_FIELD_GOAL_RANGE_YARD_LINE,
): boolean {
  return isAtOrInsideOpponentYardLine(game, rangeYardLine);
}

export function isInRedZone(game: Game): boolean {
  return isAtOrInsideOpponentYardLine(game, RED_ZONE_YARD_LINE);
}

/** The offense has crossed midfield and is operating on the opponent's side. */
export function isAcrossMidfield(game: Game): boolean {
  return isAtOrInsideOpponentYardLine(game, OPPONENT_TERRITORY_YARD_LINE);
}

function isAtOrInsideOpponentYardLine(game: Game, rangeYardLine: number): boolean {
  const score = game.score;
  if (game.status !== 'Live' || game.isMuted || !score?.downDistance || score.possessionTeamId === null) {
    return false;
  }

  const offense = score.possessionTeamId === game.home.id
    ? game.home
    : score.possessionTeamId === game.away.id
      ? game.away
      : null;
  if (!offense) return false;

  const opponent = offense.id === game.home.id ? game.away : game.home;
  const spot = score.downDistance.match(/\bat\s+([A-Z0-9]+)\s+(\d{1,2})\b/i);
  if (!spot) return false;

  const fieldSide = normalizeAbbreviation(spot[1]);
  const opponentSide = normalizeAbbreviation(opponent.abbreviation);
  const yardLine = Number(spot[2]);
  return (fieldSide === opponentSide || fieldSide === 'OPP') && yardLine <= rangeYardLine;
}

function normalizeAbbreviation(value: string): string {
  return value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
