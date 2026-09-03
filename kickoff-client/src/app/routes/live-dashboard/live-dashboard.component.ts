import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { KickoffApi } from '../../core/services/kickoff-api';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { LiveGameStore } from '../../core/services/live-game-store';
import { Game, Score } from '../../core/models/game.model';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { MyTeamsStripComponent } from '../../shared/my-teams-strip/my-teams-strip.component';

@Component({
  selector: 'app-live-dashboard',
  imports: [DatePipe, TeamBadgeComponent, MyTeamsStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-dashboard.component.html',
  styleUrl: './live-dashboard.component.scss',
})
export class LiveDashboardComponent {
  private readonly api = inject(KickoffApi);
  private readonly overlay = inject(GameDetailOverlay);
  private readonly live = inject(LiveGameStore);
  protected readonly fan = inject(FanStore);

  /** Tap a tile (not its controls) to open the game detail modal in place. */
  open(g: Game): void {
    this.overlay.open(g.id);
  }

  /** Temporary reveal ("peek") scores, keyed by game id, held while pressing. */
  private readonly peeked = signal(new Map<number, Score | null>());

  /** The same app-wide feed used to keep every other game view current. */
  readonly games = this.live.liveGames;

  readonly liveCount = computed(() => this.games().filter((g) => g.status === 'Live').length);

  /** "Best game right now": the tightest live, unmuted game. */
  readonly bestGameId = computed(() => {
    const contenders = this.games().filter((g) => g.status === 'Live' && !g.isMuted && g.score);
    if (contenders.length === 0) return null;
    return contenders.reduce((best, g) =>
      margin(g) < margin(best) ? g : best,
    ).id;
  });

  trackById = (_: number, g: Game) => g.id;

  /** Score to display: the real one, or a temporary peek, or null when hidden. */
  shownScore(g: Game): Score | null {
    return g.score ?? this.peeked().get(g.id) ?? null;
  }

  isPeeking(g: Game): boolean {
    return this.peeked().has(g.id);
  }

  statusLine(g: Game): string {
    const s = this.shownScore(g);
    switch (g.status) {
      case 'Live':
        return s?.clock ? `Q${s.period} · ${s.clock}` : 'LIVE';
      case 'Final':
        return 'FINAL';
      case 'Postponed':
        return 'PPD';
      case 'Canceled':
        return 'CANCELED';
      default:
        return '';
    }
  }

  homeWinPct(g: Game): number | null {
    const p = this.shownScore(g)?.homeWinProbability;
    return p == null ? null : Math.round(p * 100);
  }

  // --- actions ---

  mute(g: Game): void {
    this.api.mute(g.id, 'Muted').subscribe(() => this.live.refresh());
  }

  unmute(g: Game): void {
    this.api.unmute(g.id).subscribe(() => this.live.refresh());
  }

  /** Press-and-hold: fetch the true score and show it only while held. */
  peekStart(g: Game): void {
    if (!g.isMuted) return;
    this.api.reveal(g.id).subscribe((full) => this.setPeek(g.id, full.score));
  }

  peekEnd(g: Game): void {
    if (!this.peeked().has(g.id)) return;
    const next = new Map(this.peeked());
    next.delete(g.id);
    this.peeked.set(next);
  }

  private setPeek(id: number, score: Score | null): void {
    const next = new Map(this.peeked());
    next.set(id, score);
    this.peeked.set(next);
  }
}

function margin(g: Game): number {
  return g.score ? Math.abs(g.score.homeScore - g.score.awayScore) : Number.MAX_SAFE_INTEGER;
}
