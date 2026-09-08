import { DestroyRef, Signal, effect, inject, signal } from '@angular/core';
import { Game, Score } from './models/game.model';
import { SummaryPlay } from './models/game-summary.model';
import { KickoffApi } from './services/kickoff-api';
import { catchError, of, take } from 'rxjs';

export type ScorePulseKind = 'field-goal' | 'touchdown' | 'other' | null;
export type ScoreSide = 'home' | 'away';

export interface ScorePulseTracker {
  kind: Signal<ScorePulseKind>;
  scoringSide: Signal<ScoreSide | null>;
}

interface ScoreSnapshot {
  home: number;
  away: number;
}

const PULSE_CLEAR_MS = 3_000;
export const SCORE_HIGHLIGHT_MS = 3_400;

/**
 * Watches a rendered game's score without flashing on its initial value.
 * A normal ESPN poll usually reports a field goal as +3 and a touchdown
 * sequence as +6, +7, or +8. Larger jumps remain prominent because more than
 * one scoring play may land between polls.
 */
export function trackScorePulse(game: Signal<Game>): ScorePulseTracker {
  const destroyRef = inject(DestroyRef);
  const api = inject(KickoffApi);
  const pulse = signal<ScorePulseKind>(null);
  const scoringSide = signal<ScoreSide | null>(null);
  let previous: ScoreSnapshot | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;
  let scoreHighlightTimer: ReturnType<typeof setTimeout> | null = null;

  effect(() => {
    const current = scoreSnapshot(game().score);
    if (current && previous) {
      const kind = classifyScoreChange(previous, current);
      if (kind) {
        pulse.set(kind);
        scoringSide.set(scoreIncreaseSide(previous, current));
        if (clearTimer) clearTimeout(clearTimer);
        if (scoreHighlightTimer) clearTimeout(scoreHighlightTimer);
        clearTimer = setTimeout(() => {
          pulse.set(null);
          clearTimer = null;
        }, PULSE_CLEAR_MS);
        scoreHighlightTimer = setTimeout(() => {
          scoringSide.set(null);
          scoreHighlightTimer = null;
        }, SCORE_HIGHLIGHT_MS);

        // Confirm the precise scoring type from ESPN's cached summary. The
        // inferred pulse remains the fallback when rich data is unavailable.
        api.getGameSummary(game().id)
          .pipe(catchError(() => of(null)), take(1))
          .subscribe((summary) => {
            const exact = classifyScoringPlay(summary?.scoringPlays.at(-1) ?? null);
            if (exact) pulse.set(exact);
          });
      }
    }
    previous = current;
  });

  destroyRef.onDestroy(() => {
    if (clearTimer) clearTimeout(clearTimer);
    if (scoreHighlightTimer) clearTimeout(scoreHighlightTimer);
  });

  return {
    kind: pulse.asReadonly(),
    scoringSide: scoringSide.asReadonly(),
  };
}

export function classifyScoringPlay(play: SummaryPlay | null): Exclude<ScorePulseKind, null> | null {
  if (!play) return null;
  const description = `${play.type ?? ''} ${play.text ?? ''}`.toLowerCase();
  if (description.includes('touchdown') || (play.scoreValue ?? 0) >= 6) return 'touchdown';
  if (description.includes('field goal') || play.scoreValue === 3) return 'field-goal';
  return play.isScoringPlay ? 'other' : null;
}

export function classifyScoreChange(
  previous: ScoreSnapshot,
  current: ScoreSnapshot,
): Exclude<ScorePulseKind, null> | null {
  const increase = Math.max(current.home - previous.home, current.away - previous.away);
  if (increase <= 0) return null;
  if (increase === 3) return 'field-goal';
  if (increase >= 6) return 'touchdown';
  return 'other';
}

export function scoreIncreaseSide(previous: ScoreSnapshot, current: ScoreSnapshot): ScoreSide | null {
  const homeIncrease = current.home - previous.home;
  const awayIncrease = current.away - previous.away;
  if (homeIncrease <= 0 && awayIncrease <= 0) return null;
  return homeIncrease >= awayIncrease ? 'home' : 'away';
}

function scoreSnapshot(score: Score | null): ScoreSnapshot | null {
  return score ? { home: score.homeScore, away: score.awayScore } : null;
}
