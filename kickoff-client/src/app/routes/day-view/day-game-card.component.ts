import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Game } from '../../core/models/game.model';
import { trackScorePulse } from '../../core/score-pulse';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

@Component({
  selector: 'app-day-game-card',
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-game-card.component.html',
  styleUrl: './day-game-card.component.scss',
})
export class DayGameCardComponent {
  readonly game = input.required<Game>();
  readonly dense = input(false);
  readonly compactFinal = input(false);
  protected readonly scorePulse = trackScorePulse(this.game);

  protected readonly fan = inject(FanStore);
  protected readonly records = inject(TeamRecordStore);
  private readonly detail = inject(GameDetailOverlay);

  protected open(): void {
    this.detail.open(this.game().id);
  }

  protected statusLabel(): string {
    const game = this.game();
    const score = game.score;
    if (game.status === 'Live') {
      if (score?.period === 2 && /^0{1,2}:00$/.test(score.clock?.trim() ?? '')) return 'Halftime';
      return score?.clock ? `Q${score.period} · ${score.clock}` : 'Live';
    }
    if (game.status === 'Final') return 'Final';
    if (game.status === 'Postponed') return 'PPD';
    if (game.status === 'Canceled') return 'Off';
    return new Date(game.kickoffUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  protected score(side: 'home' | 'away'): string {
    const score = this.game().score;
    if (!score || this.game().isMuted) return '—';
    return String(side === 'home' ? score.homeScore : score.awayScore);
  }

  protected possessionDirection(): 'left' | 'right' | null {
    const game = this.game();
    const possessionTeamId = game.score?.possessionTeamId;
    if (possessionTeamId === game.away.id) return 'left';
    if (possessionTeamId === game.home.id) return 'right';
    return null;
  }

  protected isWinner(side: 'home' | 'away'): boolean {
    const game = this.game();
    const score = game.score;
    if (game.status !== 'Final' || !score) return false;
    return side === 'home' ? score.homeScore > score.awayScore : score.awayScore > score.homeScore;
  }

  protected isLoser(side: 'home' | 'away'): boolean {
    const game = this.game();
    const score = game.score;
    if (game.status !== 'Final' || !score) return false;
    return side === 'home' ? score.homeScore < score.awayScore : score.awayScore < score.homeScore;
  }
}
