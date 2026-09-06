import { ChangeDetectionStrategy, Component, Injectable, computed, inject, input, signal } from '@angular/core';
import { Game } from '../../core/models/game.model';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
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

  private readonly detail = inject(GameDetailOverlay);
  protected readonly visibility = inject(ImportantGamesTickerVisibility);

  protected readonly importantGames = computed(() =>
    sortImportantGames(this.games().filter(isImportantGame)),
  );

  protected open(game: Game): void {
    this.detail.open(game.id);
  }

  protected interestLabel(game: Game): string {
    const labels: string[] = [];
    if (game.hasFavorite) labels.push('Favorite');
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

  protected score(game: Game, side: 'home' | 'away'): string {
    if (!game.score) return '—';
    return String(side === 'home' ? game.score.homeScore : game.score.awayScore);
  }

  protected isCompleted(game: Game): boolean {
    return game.status === 'Final';
  }

  protected alertLevel(game: Game): WatchAlertLevel {
    return watchAlertLevel(game);
  }
}

export type WatchAlertLevel = 'none' | 'single' | 'double';

export function isImportantGame(game: Game): boolean {
  return game.hasFavorite
    || game.isCircled
    || game.home.currentRank != null
    || game.away.currentRank != null;
}

export function sortImportantGames(games: Game[]): Game[] {
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

    if (a.status === 'Final' && b.status === 'Final') {
      const interestDifference = completedInterestOrder(a) - completedInterestOrder(b);
      if (interestDifference !== 0) return interestDifference;
    }

    return new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime();
  });
}

function completedInterestOrder(game: Game): number {
  if (game.hasFavorite) return 0;
  if (game.isCircled) return 1;
  return 2;
}

export function watchAlertLevel(game: Game): WatchAlertLevel {
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
  }

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
