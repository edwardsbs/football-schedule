import { DatePipe, DecimalPipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap, timer } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { FanStore } from '../../core/services/fan-store';
import { GameDayBoardStore } from '../../core/services/game-day-board-store';
import { LiveGameStore } from '../../core/services/live-game-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { Game, Score, TeamSummary } from '../../core/models/game.model';
import { GameSummary } from '../../core/models/game-summary.model';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { winProbabilityChartPoints, winProbabilityDisplay } from './win-probability';

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
  imports: [DatePipe, DecimalPipe, TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-detail.component.html',
  styleUrl: './game-detail.component.scss',
})
export class GameDetailComponent {
  private readonly api = inject(KickoffApi);
  private readonly location = inject(Location);
  private readonly live = inject(LiveGameStore);
  protected readonly fan = inject(FanStore);
  protected readonly gameDay = inject(GameDayBoardStore);
  protected readonly records = inject(TeamRecordStore);

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

  protected readonly summary = toSignal(
    toObservable(this.gameId).pipe(
      switchMap((id) => timer(0, 10_000).pipe(
        switchMap(() => this.api.getGameSummary(id).pipe(catchError(() => of(null)))),
      )),
    ),
    { initialValue: null as GameSummary | null },
  );

  protected readonly game = computed(() => {
    const game = this.vm().game;
    return game ? this.live.overlay(game) : null;
  });

  protected readonly statRows = computed(() => {
    const summary = this.summary();
    const game = this.game();
    if (!summary || !game) return [];
    const away = summary.teamStatistics.find((team) => team.teamAbbreviation === game.away.abbreviation);
    const home = summary.teamStatistics.find((team) => team.teamAbbreviation === game.home.abbreviation);
    if (!away || !home) return [];

    const preferred = ['totalYards', 'turnovers', 'thirdDownEff', 'passingYards', 'rushingYards', 'possessionTime'];
    return preferred.flatMap((name) => {
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

  protected readonly recentScoringPlays = computed(() =>
    [...(this.summary()?.scoringPlays ?? [])].slice(-4).reverse(),
  );

  protected readonly relevantStandings = computed(() => {
    const summary = this.summary();
    const game = this.game();
    if (!summary || !game) return [];
    const teamIds = new Set(
      summary.teamStatistics
        .filter((team) => team.teamAbbreviation === game.away.abbreviation || team.teamAbbreviation === game.home.abbreviation)
        .map((team) => team.teamExternalId),
    );
    return summary.standings.flatMap((group) =>
      group.entries
        .filter((entry) => teamIds.has(entry.teamExternalId))
        .map((entry) => ({ ...entry, group: group.shortName ?? group.name })),
    );
  });

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

  protected readonly liveWinProbability = computed(() => {
    const p = this.summary()?.homeWinProbability ?? this.shownScore()?.homeWinProbability;
    return winProbabilityDisplay(p);
  });

  protected homeWinPct(): number | null {
    return this.liveWinProbability()?.home ?? null;
  }

  protected winProbabilityPoints(): string {
    return winProbabilityChartPoints(this.summary()?.winProbability ?? []);
  }

  back(): void {
    if (this.embedded()) {
      this.closeRequested.emit();
    } else {
      this.location.back();
    }
  }

  isOnGameDay(game: Game): boolean {
    return this.gameDay.isWatching(game.id, this.fan.isCircled(game.id));
  }

  toggleGameDay(game: Game): void {
    this.gameDay.toggle(game.id, this.fan.isCircled(game.id));
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
