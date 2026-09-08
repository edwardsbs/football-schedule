import { Game } from '../../core/models/game.model';

/** A restrained suggestion only; games are never moved automatically. */
export function isGettingInteresting(game: Game): boolean {
  if (game.status !== 'Live' || !game.score || game.isMuted) return false;
  const margin = Math.abs(game.score.homeScore - game.score.awayScore);
  const total = game.score.homeScore + game.score.awayScore;
  return margin <= 8 || total >= 45;
}
