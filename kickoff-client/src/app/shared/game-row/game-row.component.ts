import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { KickoffApi } from '../../core/services/kickoff-api';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { Game, Score } from '../../core/models/game.model';
import { TeamBadgeComponent } from '../team-badge/team-badge.component';

/**
 * One dense timeline row for a game: logos, spoiler-safe score, status, network,
 * and inline mute / hold-to-peek. Emits `changed` after a mute toggle so the
 * hosting view can re-fetch.
 */
@Component({
  selector: 'app-game-row',
  imports: [DatePipe, TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-row.component.html',
  styleUrl: './game-row.component.scss',
})
export class GameRowComponent {
  private readonly api = inject(KickoffApi);
  private readonly overlay = inject(GameDetailOverlay);
  protected readonly fan = inject(FanStore);

  readonly game = input.required<Game>();
  /** Alternating-row shading, set by the hosting list from its index. */
  readonly alt = input<boolean>(false);
  readonly changed = output<void>();

  /** Tap the row (not its controls) to open the game detail modal in place. */
  open(): void {
    this.overlay.open(this.game().id);
  }

  protected readonly peek = signal<Score | null | undefined>(undefined);

  protected shownScore(): Score | null {
    const g = this.game();
    if (g.score) return g.score;
    const p = this.peek();
    return p === undefined ? null : p;
  }

  protected get peeking(): boolean {
    return this.peek() !== undefined;
  }

  protected statusLine(): string {
    const g = this.game();
    const s = this.shownScore();
    switch (g.status) {
      case 'Live':
        if (this.isHalftime()) return 'Halftime';
        return s?.clock ? `Q${s.period} · ${s.clock}` : 'LIVE';
      case 'Final':
        return 'FINAL';
      case 'Postponed':
        return 'PPD';
      case 'Canceled':
        return 'OFF';
      default:
        return '';
    }
  }

  protected isHalftime(): boolean {
    const s = this.shownScore();
    return this.game().status === 'Live'
      && s?.period === 2
      && /^0{1,2}:00$/.test(s.clock?.trim() ?? '');
  }

  mute(): void {
    this.api.mute(this.game().id, 'Muted').subscribe(() => this.changed.emit());
  }

  unmute(): void {
    this.api.unmute(this.game().id).subscribe(() => this.changed.emit());
  }

  peekStart(): void {
    if (!this.game().isMuted) return;
    this.api.reveal(this.game().id).subscribe((full) => this.peek.set(full.score));
  }

  peekEnd(): void {
    this.peek.set(undefined);
  }
}
