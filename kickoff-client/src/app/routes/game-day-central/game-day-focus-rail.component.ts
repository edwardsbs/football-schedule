import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, startWith, switchMap, timer } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameSummary } from '../../core/models/game-summary.model';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
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
  readonly rotationProgress = model<number>(100);

  private readonly api = inject(KickoffApi);
  private readonly detail = inject(GameDetailOverlay);
  private readonly live = inject(LiveGameStore);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly records = inject(TeamRecordStore);
  protected readonly paused = signal(false);
  private readonly now = signal(Date.now());
  private readonly rotationStartedAt = signal(Date.now());
  private lastSelection: number | null = null;
  private lastSelectionWasActive = false;

  protected readonly rotationGames = computed(() => gameDayRotationGames(this.games()));

  protected readonly selectedGame = computed(() => {
    const games = this.games();
    return games.find((game) => game.id === this.selectedGameId())
      ?? this.rotationGames()[0]
      ?? games[0]
      ?? null;
  });

  protected readonly selectedRotationPosition = computed(() => {
    const selected = this.selectedGame();
    const index = selected ? this.rotationGames().findIndex((game) => game.id === selected.id) : -1;
    return index < 0 ? 0 : index + 1;
  });

  protected readonly selectedIsActive = computed(() => this.selectedRotationPosition() > 0);

  protected readonly autoRotationEnabled = computed(() => {
    const activeCount = this.rotationGames().length;
    return activeCount > 1 || (activeCount === 1 && !this.selectedIsActive());
  });

  protected readonly selectionLabel = computed(() => {
    const activeCount = this.rotationGames().length;
    if (this.selectedIsActive()) return `Active ${this.selectedRotationPosition()} of ${activeCount}`;
    return activeCount === 0 ? 'Manual view · no active games' : `Manual view · ${activeCount} active`;
  });

  protected readonly secondsRemaining = computed(() => {
    if (this.paused() || !this.autoRotationEnabled()) return 20;
    const elapsed = Math.max(0, this.now() - this.rotationStartedAt());
    return Math.max(0, Math.ceil((ROTATION_MS - elapsed) / 1_000));
  });

  protected readonly progress = computed(() => {
    if (this.paused() || !this.autoRotationEnabled()) return 0;
    return Math.min(100, Math.max(0, (this.now() - this.rotationStartedAt()) / ROTATION_MS * 100));
  });

  private readonly selectionProgress = computed(() =>
    this.paused() || !this.autoRotationEnabled() ? 100 : this.progress(),
  );

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

  protected readonly leaderTeams = computed(() => {
    const summary = this.summary();
    const game = this.selectedGame();
    if (!summary || !game) return [];

    return [game.away.abbreviation, game.home.abbreviation].flatMap((abbreviation) => {
      const team = summary.leaders.find((entry) =>
        entry.teamAbbreviation.toUpperCase() === abbreviation.toUpperCase());
      if (!team) return [];

      const offensiveCategories = ['passingYards', 'rushingYards', 'receivingYards'];
      const offense = offensiveCategories.flatMap((category) => {
        const leader = team.leaders.find((entry) => entry.category === category);
        if (!leader) return [];
        const label = category === 'passingYards' ? 'Pass' : category === 'rushingYards' ? 'Rush' : 'Rec';
        return [{ ...leader, label }];
      });
      const defense = team.leaders
        .filter((leader) => leader.category.startsWith('defensiveImpact:'))
        .slice(0, 2);

      return offense.length || defense.length
        ? [{ teamExternalId: team.teamExternalId, teamAbbreviation: team.teamAbbreviation, offense, defense }]
        : [];
    });
  });

  constructor() {
    effect(() => this.rotationProgress.set(this.selectionProgress()));

    effect(() => {
      const game = this.selectedGame();
      const summary = this.summary();
      if (!game || !summary) return;
      const correction = situationCorrectionFromSummary(game, summary);
      if (correction) {
        this.live.correctSituation(game.id, correction.possessionTeamId, correction.downDistance);
      }
    });

    effect(() => {
      const games = this.games();
      const rotationGames = this.rotationGames();
      const requested = this.selectedGameId();
      const resolved = games.some((game) => game.id === requested)
        ? requested
        : rotationGames[0]?.id ?? games[0]?.id ?? null;
      if (resolved !== requested) {
        this.selectedGameId.set(resolved);
        return;
      }

      const selectionIsActive = rotationGames.some((game) => game.id === resolved);
      if (resolved !== null
        && resolved === this.lastSelection
        && this.lastSelectionWasActive
        && !selectionIsActive
        && rotationGames.length > 0) {
        this.selectedGameId.set(rotationGames[0].id);
        return;
      }
      if (resolved !== this.lastSelection) {
        this.lastSelection = resolved;
        this.lastSelectionWasActive = selectionIsActive;
        this.restartRotation();
      } else {
        this.lastSelectionWasActive = selectionIsActive;
      }
    });

    timer(0, 1_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.now.set(Date.now());
      if (!this.paused() && this.autoRotationEnabled()
        && this.now() - this.rotationStartedAt() >= ROTATION_MS) {
        this.move(1);
      }
    });
  }

  protected move(offset: number): void {
    const games = this.rotationGames();
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

  /** "Brock Purdy" -> "B. Purdy" -- keeps everything after the first name
   * (so a suffix like "Jr." stays attached to the last name) to save width
   * in the two-column leaders grid. */
  protected shortName(athlete: string): string {
    const parts = athlete.trim().split(/\s+/);
    return parts.length < 2 ? athlete : `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
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

export function gameDayRotationGames(games: readonly Game[]): Game[] {
  return games.filter((game) => game.status === 'Live');
}

export interface GameSituationCorrection {
  possessionTeamId: number | null;
  downDistance: string | null;
}

export function situationCorrectionFromSummary(
  game: Game,
  summary: GameSummary,
): GameSituationCorrection | null {
  // The current drive is newer than the last completed drive. Immediately
  // after a score ESPN can retain that scoring play while already publishing
  // the next possession's drive, so prefer each current-drive field
  // independently instead of letting a stale end object mask newer data.
  const drivePosition = summary.currentDrive?.end ?? summary.currentDrive?.start;
  const lastPlayPosition = summary.lastPlay?.end ?? summary.lastPlay?.start;
  const downDistance = drivePosition?.downDistanceText?.trim()
    || lastPlayPosition?.downDistanceText?.trim()
    || null;
  const possessionExternalId = drivePosition?.teamExternalId
    ?? summary.currentDrive?.teamExternalId
    ?? lastPlayPosition?.teamExternalId
    ?? null;
  const team = possessionExternalId === null
    ? null
    : summary.teamStatistics.find((entry) => entry.teamExternalId === possessionExternalId)
      ?? summary.leaders.find((entry) => entry.teamExternalId === possessionExternalId)
      ?? summary.injuries.find((entry) => entry.teamExternalId === possessionExternalId)
      ?? null;
  const abbreviation = team?.teamAbbreviation.toUpperCase();
  const possessionTeamId = abbreviation === game.home.abbreviation.toUpperCase()
    ? game.home.id
    : abbreviation === game.away.abbreviation.toUpperCase()
      ? game.away.id
      : null;

  return downDistance !== null || possessionTeamId !== null
    ? { possessionTeamId, downDistance }
    : null;
}
