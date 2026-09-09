import { Game, Score, TeamSummary } from '../../core/models/game.model';

export type GameInterestRating = 'interesting' | 'very-interesting' | 'stop-what-youre-doing';

export interface GameInterestMatch {
  rating: GameInterestRating;
  ratingLabel: string;
  scenarioId: string;
  scenarioLabel: string;
}

interface GameInterestContext {
  game: Game;
  score: Score;
  period: number;
  secondsRemaining: number | null;
  margin: number;
  total: number;
  trailing: TeamSummary | null;
  leading: TeamSummary | null;
}

export interface GameInterestScenario {
  id: string;
  label: string;
  rating: GameInterestRating;
  matches: (context: GameInterestContext) => boolean;
}

const RATING_LABELS: Record<GameInterestRating, string> = {
  interesting: 'Interesting',
  'very-interesting': 'Very Interesting',
  'stop-what-youre-doing': "Stop What You're Doing",
};

const RATING_PRIORITY: Record<GameInterestRating, number> = {
  interesting: 1,
  'very-interesting': 2,
  'stop-what-youre-doing': 3,
};

/**
 * The live interest registry. Add, remove, or re-rate scenarios here; when more
 * than one matches, the game receives the strongest rating.
 */
export const GAME_INTEREST_SCENARIOS: readonly GameInterestScenario[] = [
  {
    id: 'ranked-trailing-fcs',
    label: 'A ranked team is trailing an FCS team in the fourth quarter or overtime',
    rating: 'stop-what-youre-doing',
    matches: ({ period, trailing, leading }) =>
      period >= 4 && trailing !== null && isRanked(trailing) && leading?.isFcs === true,
  },
  {
    id: 'ranked-trailing-unranked',
    label: 'A ranked team is trailing an unranked FBS team in the fourth quarter or overtime',
    rating: 'stop-what-youre-doing',
    matches: ({ period, trailing, leading }) =>
      period >= 4
      && trailing !== null
      && isRanked(trailing)
      && leading !== null
      && leading.currentRank === null
      && !leading.isFcs,
  },
  {
    id: 'overtime-one-possession',
    label: 'The game is within one possession in overtime',
    rating: 'stop-what-youre-doing',
    matches: ({ period, margin }) => period > 4 && margin <= 8,
  },
  {
    id: 'higher-ranked-trailing',
    label: 'The higher-ranked team is trailing a lower-ranked team in the fourth quarter or overtime',
    rating: 'very-interesting',
    matches: ({ period, trailing, leading }) =>
      period >= 4 && isHigherRanked(trailing, leading),
  },
  {
    id: 'ranked-showdown-tied',
    label: 'Two ranked teams are tied in the fourth quarter or overtime',
    rating: 'very-interesting',
    matches: ({ period, margin, game }) =>
      period >= 4 && margin === 0 && isRanked(game.home) && isRanked(game.away),
  },
  {
    id: 'late-one-possession',
    label: 'The game is within one possession with four minutes or less in the fourth quarter',
    rating: 'very-interesting',
    matches: ({ period, secondsRemaining, margin }) =>
      period === 4 && secondsRemaining !== null && secondsRemaining <= 4 * 60 && margin <= 8,
  },
  {
    id: 'ranked-game-tied',
    label: 'A game involving a ranked team is tied in the fourth quarter or overtime',
    rating: 'interesting',
    matches: ({ period, margin, game }) =>
      period >= 4 && margin === 0 && (isRanked(game.home) || isRanked(game.away)),
  },
  {
    id: 'close-shootout',
    label: 'The teams have combined for at least 45 points and are within one possession',
    rating: 'interesting',
    matches: ({ period, total, margin }) => period >= 2 && total >= 45 && margin <= 8,
  },
];

/** Suggests noteworthy live games without moving them onto the priority board. */
export function gameInterest(game: Game): GameInterestMatch | null {
  const context = buildContext(game);
  if (!context) return null;

  let strongest: GameInterestScenario | null = null;
  for (const scenario of GAME_INTEREST_SCENARIOS) {
    if (!scenario.matches(context)) continue;
    if (!strongest || RATING_PRIORITY[scenario.rating] > RATING_PRIORITY[strongest.rating]) {
      strongest = scenario;
    }
  }

  return strongest ? {
    rating: strongest.rating,
    ratingLabel: RATING_LABELS[strongest.rating],
    scenarioId: strongest.id,
    scenarioLabel: strongest.label,
  } : null;
}

export function isGettingInteresting(game: Game): boolean {
  return gameInterest(game) !== null;
}

function buildContext(game: Game): GameInterestContext | null {
  if (game.status !== 'Live' || !game.score || game.isMuted || game.score.period === null) return null;
  const score = game.score;
  const period = score.period;
  if (period === null) return null;
  const tied = score.homeScore === score.awayScore;
  const trailing = tied ? null : score.homeScore < score.awayScore ? game.home : game.away;
  const leading = tied ? null : trailing === game.home ? game.away : game.home;
  return {
    game,
    score,
    period,
    secondsRemaining: clockSeconds(score.clock),
    margin: Math.abs(score.homeScore - score.awayScore),
    total: score.homeScore + score.awayScore,
    trailing,
    leading,
  };
}

function isRanked(team: TeamSummary): boolean {
  return team.currentRank !== null;
}

function isHigherRanked(team: TeamSummary | null, opponent: TeamSummary | null): boolean {
  if (!team || !opponent || team.currentRank === null || opponent.currentRank === null) return false;
  return team.currentRank < opponent.currentRank;
}

function clockSeconds(clock: string | null): number | null {
  if (!clock) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) return null;
  return minutes * 60 + seconds;
}
