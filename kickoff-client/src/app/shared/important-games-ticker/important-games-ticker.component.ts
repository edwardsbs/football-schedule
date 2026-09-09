import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, switchMap, timer } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameSummary } from '../../core/models/game-summary.model';
import { isAcrossMidfield, isInFieldGoalRange, isInRedZone } from '../../core/field-position';
import { SCORE_HIGHLIGHT_MS, ScorePulseKind, ScoreSide, classifyScoreChange, scoreEventLabel, scoreIncreaseSide } from '../../core/score-pulse';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { KickoffApi } from '../../core/services/kickoff-api';
import { TeamBadgeComponent } from '../team-badge/team-badge.component';

@Injectable({ providedIn: 'root' })
export class ImportantGamesTickerVisibility {
  readonly hidden = signal(false);
}

@Component({
  selector: 'app-important-games-ticker',
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './important-games-ticker.component.html',
  styleUrl: './important-games-ticker.component.scss',
})
export class ImportantGamesTickerComponent {
  readonly games = input.required<Game[]>();
  readonly showKickoffDay = input<boolean>(false);

  private readonly detail = inject(GameDetailOverlay);
  private readonly api = inject(KickoffApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly visibility = inject(ImportantGamesTickerVisibility);
  protected readonly summaries = signal<ReadonlyMap<number, GameSummary>>(new Map());
  private readonly previousScores = new Map<number, { home: number; away: number }>();
  private readonly pulseTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly highlightTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly scorePulses = signal<ReadonlyMap<number, ScorePulseKind>>(new Map());
  private readonly scoringSides = signal<ReadonlyMap<number, ScoreSide>>(new Map());
  private readonly scoreCelebrations = signal<ReadonlyMap<number, ScorePulseKind>>(new Map());

  private readonly liveImportantIds = computed(() =>
    this.games()
      .filter((game) => game.status === 'Live' && isImportantGame(game) && !game.isMuted)
      .slice(0, 6)
      .map((game) => game.id),
  );

  protected readonly importantGames = computed(() =>
    sortImportantGames(this.games().filter(isImportantGame), this.summaries()),
  );

  constructor() {
    effect(() => {
      for (const game of this.games()) {
        if (!game.score) continue;
        const current = { home: game.score.homeScore, away: game.score.awayScore };
        const previous = this.previousScores.get(game.id);
        if (previous) {
          const pulse = classifyScoreChange(previous, current);
          if (pulse) this.showScoreFeedback(game.id, pulse, scoreIncreaseSide(previous, current));
        }
        this.previousScores.set(game.id, current);
      }
    });

    this.destroyRef.onDestroy(() => {
      for (const timerId of this.pulseTimers.values()) clearTimeout(timerId);
      for (const timerId of this.highlightTimers.values()) clearTimeout(timerId);
    });

    toObservable(this.liveImportantIds).pipe(
      switchMap((ids) => ids.length === 0
        ? of([] as Array<[number, GameSummary | null]>)
        : timer(0, 15_000).pipe(
            switchMap(() => forkJoin(ids.map((id) =>
              this.api.getGameSummary(id).pipe(
                catchError(() => of(null)),
                switchMap((summary) => of([id, summary] as [number, GameSummary | null])),
              ),
            ))),
          )),
      takeUntilDestroyed(),
    ).subscribe((entries) => {
      this.summaries.set(new Map(
        entries.filter((entry): entry is [number, GameSummary] => entry[1] !== null),
      ));
    });
  }

  protected open(game: Game): void {
    this.detail.open(game.id);
  }

  protected interestLabel(game: Game): string {
    const labels: string[] = [];
    if (game.hasFavorite) labels.push('Favorite');
    if (game.hasInterest) labels.push('Interest');
    if (game.home.currentRank != null || game.away.currentRank != null) labels.push('Ranked');
    if (game.isCircled) labels.push('Circled');
    return labels.join(' · ');
  }

  protected statusLabel(game: Game): string {
    if (game.status === 'Live') {
      const score = game.score;
      if (!score) return 'Live';
      if (score.period === 2 && /^0{1,2}:00$/.test(score.clock?.trim() ?? '')) return 'Halftime';
      const period = score.period ? `Q${score.period}` : 'Live';
      return score.clock ? `${period} · ${score.clock}` : period;
    }
    if (game.status === 'Final') return 'Final';
    if (game.status === 'Postponed') return 'Postponed';
    if (game.status === 'Canceled') return 'Canceled';
    return new Date(game.kickoffUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  protected kickoffDayLabel(game: Game): string {
    return watchKickoffDayLabel(game.kickoffUtc);
  }

  protected score(game: Game, side: 'home' | 'away'): string {
    if (!game.score) return '—';
    return String(side === 'home' ? game.score.homeScore : game.score.awayScore);
  }

  protected scorePulseKind(gameId: number): ScorePulseKind {
    return this.scorePulses().get(gameId) ?? null;
  }

  protected scoreChanged(gameId: number, side: ScoreSide): boolean {
    return this.scoringSides().get(gameId) === side;
  }

  protected isCompleted(game: Game): boolean {
    return game.status === 'Final';
  }

  protected alertLevel(game: Game): WatchAlertLevel {
    return watchAlertLevel(game, this.summaries().get(game.id));
  }

  protected inFieldGoalRange(game: Game): boolean {
    return isInFieldGoalRange(game);
  }

  protected acrossMidfield(game: Game): boolean {
    return isAcrossMidfield(game);
  }

  protected inRedZone(game: Game): boolean {
    return isInRedZone(game);
  }

  protected summaryInsight(game: Game): string | null {
    const celebration = scoreEventLabel(
      this.scoreCelebrations().get(game.id) ?? null,
      game.score?.downDistance,
    );
    if (celebration) return celebration;
    const summary = this.summaries().get(game.id);
    if (!summary) return null;
    if (summary.lastPlay?.isTurnover) return `Turnover · ${summary.lastPlay.type ?? 'change of possession'}`;
    if (summary.lastPlay?.isScoringPlay) return summary.lastPlay.type ?? 'Scoring play';
    if (summary.currentDrive?.end?.yardsToEndzone != null && summary.currentDrive.end.yardsToEndzone <= 20) {
      return `Red zone · ${summary.currentDrive.end.possessionText ?? `${summary.currentDrive.end.yardsToEndzone} yards out`}`;
    }
    if (summary.currentDrive?.description) return summary.currentDrive.description;
    return summary.lastPlay?.type ?? null;
  }

  private showScoreFeedback(
    gameId: number,
    pulse: Exclude<ScorePulseKind, null>,
    scoringSide: ScoreSide | null,
  ): void {
    const pulses = new Map(this.scorePulses());
    pulses.set(gameId, pulse);
    this.scorePulses.set(pulses);

    const pulseTimer = this.pulseTimers.get(gameId);
    if (pulseTimer) clearTimeout(pulseTimer);
    this.pulseTimers.set(gameId, setTimeout(() => {
      const cleared = new Map(this.scorePulses());
      cleared.delete(gameId);
      this.scorePulses.set(cleared);
      this.pulseTimers.delete(gameId);
    }, 3_000));

    if (!scoringSide) return;
    const sides = new Map(this.scoringSides());
    sides.set(gameId, scoringSide);
    this.scoringSides.set(sides);
    const celebrations = new Map(this.scoreCelebrations());
    celebrations.set(gameId, pulse);
    this.scoreCelebrations.set(celebrations);

    const highlightTimer = this.highlightTimers.get(gameId);
    if (highlightTimer) clearTimeout(highlightTimer);
    this.highlightTimers.set(gameId, setTimeout(() => {
      const cleared = new Map(this.scoringSides());
      cleared.delete(gameId);
      this.scoringSides.set(cleared);
      const clearedCelebrations = new Map(this.scoreCelebrations());
      clearedCelebrations.delete(gameId);
      this.scoreCelebrations.set(clearedCelebrations);
      this.highlightTimers.delete(gameId);
    }, SCORE_HIGHLIGHT_MS));
  }
}

export function watchKickoffDayLabel(kickoffUtc: string): string {
  const kickoff = new Date(kickoffUtc);
  const weekday = kickoff.toLocaleDateString([], { weekday: 'short' });
  return `${weekday} ${kickoff.getMonth() + 1}/${kickoff.getDate()}`;
}

export type WatchAlertLevel = 'none' | 'single' | 'double';

export function isImportantGame(game: Game): boolean {
  return game.hasFavorite
    || game.hasInterest
    || game.isCircled
    || game.home.currentRank != null
    || game.away.currentRank != null;
}

export function sortImportantGames(
  games: Game[],
  summaries: ReadonlyMap<number, GameSummary> = new Map(),
): Game[] {
  const statusOrder: Record<Game['status'], number> = {
    Live: 0,
    Upcoming: 1,
    Postponed: 1,
    Final: 2,
    Canceled: 3,
  };
  return [...games].sort((a, b) => {
    const statusDifference = statusOrder[a.status] - statusOrder[b.status];
    if (statusDifference !== 0) return statusDifference;

    if (a.status === 'Live' && b.status === 'Live') {
      const urgencyDifference = richUrgency(b, summaries.get(b.id)) - richUrgency(a, summaries.get(a.id));
      if (urgencyDifference !== 0) return urgencyDifference;
    }

    if (a.status === 'Final' && b.status === 'Final') {
      const interestDifference = completedInterestOrder(a) - completedInterestOrder(b);
      if (interestDifference !== 0) return interestDifference;
    }

    return new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime();
  });
}

function richUrgency(game: Game, summary?: GameSummary): number {
  const alert = watchAlertLevel(game, summary);
  let urgency = alert === 'double' ? 200 : alert === 'single' ? 100 : 0;
  const probability = summary?.homeWinProbability;
  if (probability != null) urgency += Math.round((1 - Math.abs(0.5 - probability) * 2) * 30);
  if (summary?.lastPlay?.isTurnover) urgency += 25;
  if (summary?.currentDrive?.end?.yardsToEndzone != null && summary.currentDrive.end.yardsToEndzone <= 20) urgency += 18;
  urgency += game.score?.period ?? 0;
  return urgency;
}

function completedInterestOrder(game: Game): number {
  if (game.hasFavorite) return 0;
  if (game.isCircled) return 1;
  if (game.hasInterest) return 2;
  return 3;
}

export function watchAlertLevel(game: Game, summary?: GameSummary): WatchAlertLevel {
  const score = game.score;
  if (game.status !== 'Live' || !score) return 'none';

  const homeRanked = game.home.currentRank != null;
  const awayRanked = game.away.currentRank != null;
  const homeLosing = score.homeScore < score.awayScore;
  const awayLosing = score.awayScore < score.homeScore;

  if (score.period === 4) {
    const rankedLosingToFcs =
      (homeRanked && homeLosing && game.away.isFcs)
      || (awayRanked && awayLosing && game.home.isFcs);
    if (rankedLosingToFcs) return 'double';

    const rankedLosingToUnranked =
      (homeRanked && !awayRanked && homeLosing)
      || (awayRanked && !homeRanked && awayLosing);
    if (rankedLosingToUnranked) return 'single';

    const secondsRemaining = clockSeconds(score.clock);
    if (homeRanked && awayRanked && secondsRemaining != null && secondsRemaining <= 8 * 60
      && Math.abs(score.homeScore - score.awayScore) <= 6) {
      return 'single';
    }

    if (secondsRemaining != null && secondsRemaining <= 2 * 60 && isLateScoringThreat(game)) {
      return 'single';
    }

    if (Math.abs(score.homeScore - score.awayScore) <= 8
      && summary?.currentDrive?.end?.yardsToEndzone != null
      && summary.currentDrive.end.yardsToEndzone <= 20) {
      return 'single';
    }
  }

  if (summary?.lastPlay?.isTurnover && (score.period ?? 0) >= 3) return 'single';

  if (score.period === 3 && score.homeScore >= 28 && score.awayScore >= 28) return 'single';

  return 'none';
}

function clockSeconds(clock: string | null): number | null {
  const match = clock?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isLateScoringThreat(game: Game): boolean {
  const score = game.score;
  if (!score || !score.downDistance || score.possessionTeamId == null) return false;

  const homeMargin = score.awayScore - score.homeScore;
  const awayMargin = score.homeScore - score.awayScore;
  const losingTeam = homeMargin > 0 && homeMargin <= 3
    ? game.home
    : awayMargin > 0 && awayMargin <= 3
      ? game.away
      : null;
  if (!losingTeam || score.possessionTeamId !== losingTeam.id) return false;

  const opponent = losingTeam.id === game.home.id ? game.away : game.home;
  const fieldPosition = score.downDistance.match(/\bat\s+([A-Z0-9]+)\s+(\d{1,2})\b/i);
  if (!fieldPosition) return false;

  const fieldSide = fieldPosition[1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const opponentAbbreviation = opponent.abbreviation.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return fieldSide === opponentAbbreviation && Number(fieldPosition[2]) <= 40;
}
