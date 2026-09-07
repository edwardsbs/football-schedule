import { DestroyRef, Signal, effect, inject, signal } from '@angular/core';
import { Game, Score } from './models/game.model';

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
      }
    }
    previous = current;
  });

  destroyRef.onDestroy(() => {
    if (clearTimer) clearTimeout(clearTimer);
  });

  return pulse.asReadonly();
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
