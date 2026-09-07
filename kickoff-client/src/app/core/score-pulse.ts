import { DestroyRef, Signal, effect, inject, signal } from '@angular/core';
import { Game, Score } from './models/game.model';
import { SummaryPlay } from './models/game-summary.model';
import { KickoffApi } from './services/kickoff-api';
import { catchError, of, take } from 'rxjs';

export type ScorePulseKind = 'field-goal' | 'touchdown' | 'other' | null;

interface ScoreSnapshot {
  home: number;
  away: number;
}

const PULSE_CLEAR_MS = 3_000;

/**
 * Watches a rendered game's score without flashing on its initial value.
 * A normal ESPN poll usually reports a field goal as +3 and a touchdown
 * sequence as +6, +7, or +8. Larger jumps remain prominent because more than
 * one scoring play may land between polls.
 */
export function trackScorePulse(game: Signal<Game>): Signal<ScorePulseKind> {
  const destroyRef = inject(DestroyRef);
  const api = inject(KickoffApi);
  const pulse = signal<ScorePulseKind>(null);
  let previous: ScoreSnapshot | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  effect(() => {
    const current = scoreSnapshot(game().score);
    if (current && previous) {
      const kind = classifyScoreChange(previous, current);
      if (kind) {
        pulse.set(kind);
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
          pulse.set(null);
          clearTimer = null;
        }, PULSE_CLEAR_MS);

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
  });

  return pulse.asReadonly();
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

function scoreSnapshot(score: Score | null): ScoreSnapshot | null {
  return score ? { home: score.homeScore, away: score.awayScore } : null;
}
