import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, startWith, switchMap, timer } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameSummary } from '../../core/models/game-summary.model';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { KickoffApi } from '../../core/services/kickoff-api';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

const ROTATION_MS = 20_000;

@Component({
  selector: 'app-game-day-focus-rail',
  imports: [DatePipe, DecimalPipe, TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-day-focus-rail.component.html',
})
export class GameDayFocusRailComponent {
  readonly games = input.required<readonly Game[]>();
  readonly selectedGameId = model<number | null>(null);

  private readonly api = inject(KickoffApi);
  private readonly detail = inject(GameDetailOverlay);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly records = inject(TeamRecordStore);
  protected readonly paused = signal(false);
  private readonly now = signal(Date.now());
  private readonly rotationStartedAt = signal(Date.now());
  private lastSelection: number | null = null;

  protected readonly selectedGame = computed(() => {
    const games = this.games();
    return games.find((game) => game.id === this.selectedGameId()) ?? games[0] ?? null;
  });

  protected readonly selectedPosition = computed(() => {
    const selected = this.selectedGame();
    const index = selected ? this.games().findIndex((game) => game.id === selected.id) : -1;
    return index < 0 ? 0 : index + 1;
  });

  protected readonly secondsRemaining = computed(() => {
    if (this.paused() || this.games().length <= 1) return 20;
    const elapsed = Math.max(0, this.now() - this.rotationStartedAt());
    return Math.max(0, Math.ceil((ROTATION_MS - elapsed) / 1_000));
  });

  protected readonly progress = computed(() => {
    if (this.paused() || this.games().length <= 1) return 0;
    return Math.min(100, Math.max(0, (this.now() - this.rotationStartedAt()) / ROTATION_MS * 100));
  });

  protected readonly summary = toSignal(
    toObservable(this.selectedGameId).pipe(
      switchMap((id) => id == null
        ? of(null)
        : timer(0, 10_000).pipe(
            switchMap(() => this.api.getGameSummary(id).pipe(catchError(() => of(null)))),
            startWith(null),
          )),
    ),
    { initialValue: null as GameSummary | null },
  );

  protected readonly statRows = computed(() => {
    const summary = this.summary();
    const game = this.selectedGame();
    if (!summary || !game) return [];
    const away = summary.teamStatistics.find((team) => team.teamAbbreviation === game.away.abbreviation);
    const home = summary.teamStatistics.find((team) => team.teamAbbreviation === game.home.abbreviation);
    if (!away || !home) return [];

    return ['totalYards', 'turnovers', 'thirdDownEff', 'possessionTime'].flatMap((name) => {
      const awayStat = away.statistics.find((stat) => stat.name === name);
      const homeStat = home.statistics.find((stat) => stat.name === name);
      if (!awayStat && !homeStat) return [];
      return [{
        name,
        label: awayStat?.label ?? homeStat?.label ?? name,
        away: awayStat?.displayValue ?? '—',
        home: homeStat?.displayValue ?? '—',
      }];
    });
  });

  protected readonly injuryReports = computed(() => this.summary()?.injuries ?? []);

  constructor() {
    effect(() => {
      const games = this.games();
      const requested = this.selectedGameId();
      const resolved = games.some((game) => game.id === requested) ? requested : games[0]?.id ?? null;
      if (resolved !== requested) {
        this.selectedGameId.set(resolved);
        return;
      }
      if (resolved !== this.lastSelection) {
        this.lastSelection = resolved;
        this.restartRotation();
      }
    });

    timer(0, 1_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.now.set(Date.now());
      if (!this.paused() && this.games().length > 1
        && this.now() - this.rotationStartedAt() >= ROTATION_MS) {
        this.move(1);
      }
    });
  }

  protected move(offset: number): void {
    const games = this.games();
    const nextId = rotatedGameId(games, this.selectedGameId(), offset);
    if (nextId === null) return;
    this.selectedGameId.set(nextId);
    this.restartRotation();
  }

  protected togglePause(): void {
    this.paused.update((value) => !value);
    this.restartRotation();
  }

  protected openFullDetails(): void {
    const game = this.selectedGame();
    if (game) this.detail.open(game.id);
  }

  protected score(game: Game, side: 'home' | 'away'): string {
    if (!game.score || game.isMuted) return '—';
    return String(side === 'home' ? game.score.homeScore : game.score.awayScore);
  }

  protected statusLabel(game: Game): string {
    if (game.status === 'Live') {
      const period = game.score?.period ? `Q${game.score.period}` : 'Live';
      return game.score?.clock ? `${period} · ${game.score.clock}` : period;
    }
    if (game.status === 'Final') return 'Final';
    if (game.status === 'Postponed') return 'Postponed';
    if (game.status === 'Canceled') return 'Canceled';
    return new Date(game.kickoffUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  private restartRotation(): void {
    const time = Date.now();
    this.rotationStartedAt.set(time);
    this.now.set(time);
  }
}

export function rotatedGameId(games: readonly Game[], selectedId: number | null, offset: number): number | null {
  if (games.length === 0) return null;
  const selectedIndex = games.findIndex((game) => game.id === selectedId);
  const currentIndex = selectedIndex < 0 ? 0 : selectedIndex;
  return games[(currentIndex + offset + games.length) % games.length].id;
}
