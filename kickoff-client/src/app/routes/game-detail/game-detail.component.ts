import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { FanStore } from '../../core/services/fan-store';
import { Game, Score, TeamSummary } from '../../core/models/game.model';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

type ViewModel =
  | { status: 'loading'; game: null }
  | { status: 'loaded'; game: Game }
  | { status: 'error'; game: null };

/**
 * Single-game detail — the spoiler-protection centerpiece. Renders the matchup
 * in the app's stacked-schedule style (team-colored accent bar, logo, name, and
 * a big score with a ▸ winner marker beside a divided FINAL / date column), then
 * mute / watch-later / hold-to-peek controls, favorites, circle, and box info.
 * Score/clock/win-prob stay structurally absent while the game is muted.
 */
@Component({
  selector: 'app-game-detail',
  imports: [DatePipe, TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-detail.component.html',
  styleUrl: './game-detail.component.scss',
})
export class GameDetailComponent {
  private readonly api = inject(KickoffApi);
  private readonly location = inject(Location);
  protected readonly fan = inject(FanStore);

  readonly id = input.required<string>();
  /** True when rendered inside the game-detail modal instead of as a routed page. */
  readonly embedded = input<boolean>(false);
  readonly closeRequested = output<void>();

  private readonly reload = signal(0);

  private readonly gameId = computed(() => {
    this.reload();
    return Number(this.id());
  });

  protected readonly vm = toSignal(
    toObservable(this.gameId).pipe(
      switchMap((id) =>
        this.api.getGame(id).pipe(
          map((game): ViewModel => ({ status: 'loaded', game })),
          startWith<ViewModel>({ status: 'loading', game: null }),
          catchError(() => of<ViewModel>({ status: 'error', game: null })),
        ),
      ),
    ),
    { initialValue: { status: 'loading', game: null } as ViewModel },
  );

  protected readonly game = computed(() => this.vm().game);

  /** Live-peek score, held only while the peek button is pressed. */
  protected readonly peek = signal<Score | null | undefined>(undefined);

  protected get peeking(): boolean {
    return this.peek() !== undefined;
  }

  protected shownScore(): Score | null {
    const g = this.game();
    if (!g) return null;
    if (g.score) return g.score;
    const p = this.peek();
    return p === undefined ? null : p;
  }

  protected statusLine(): string {
    const g = this.game();
    if (!g) return '';
    const s = this.shownScore();
    switch (g.status) {
      case 'Live':
        return s?.clock ? `Q${s.period} · ${s.clock}` : 'LIVE';
      case 'Final':
        return 'FINAL';
      case 'Upcoming':
        return 'UPCOMING';
      case 'Postponed':
        return 'POSTPONED';
      case 'Canceled':
        return 'CANCELED';
    }
  }

  /** The team-colored left accent, falling back to a neutral bar. */
  protected accent(team: TeamSummary): string {
    return team.primaryColor ?? '#3a4150';
  }

  /** True when this side is (currently) ahead — drives the ▸ winner marker. */
  protected leads(side: 'home' | 'away'): boolean {
    const s = this.shownScore();
    if (!s || s.homeScore === s.awayScore) return false;
    return side === 'home' ? s.homeScore > s.awayScore : s.awayScore > s.homeScore;
  }

  protected homeWinPct(): number | null {
    const p = this.shownScore()?.homeWinProbability;
    return p == null ? null : Math.round(p * 100);
  }

  back(): void {
    if (this.embedded()) {
      this.closeRequested.emit();
    } else {
      this.location.back();
    }
  }

  // --- spoiler controls (refetch after each, so the DTO's muted projection updates) ---

  mute(): void {
    this.withGame((g) => this.api.mute(g.id, 'Muted').subscribe(() => this.refresh()));
  }

  watchLater(): void {
    this.withGame((g) => this.api.mute(g.id, 'WatchLater').subscribe(() => this.refresh()));
  }

  unmute(): void {
    this.withGame((g) => this.api.unmute(g.id).subscribe(() => this.refresh()));
  }

  markWatched(): void {
    this.withGame((g) => this.api.markWatched(g.id).subscribe(() => this.refresh()));
  }

  peekStart(): void {
    const g = this.game();
    if (!g?.isMuted) return;
    this.api.reveal(g.id).subscribe((full) => this.peek.set(full.score));
  }

  peekEnd(): void {
    this.peek.set(undefined);
  }

  private refresh(): void {
    this.peek.set(undefined);
    this.reload.update((v) => v + 1);
  }

  private withGame(fn: (g: Game) => void): void {
    const g = this.game();
    if (g) fn(g);
  }
}
