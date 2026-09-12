import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { LiveGameStore } from '../../core/services/live-game-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { Game, Score } from '../../core/models/game.model';
import { isAcrossMidfield, isInFieldGoalRange, isInRedZone } from '../../core/field-position';
import { SCORE_HIGHLIGHT_MS, ScorePulseKind, ScoreSide, classifyScoreChange, scoreEventLabel, scoreIncreaseSide } from '../../core/score-pulse';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { LiveUpcomingSummaryComponent } from './live-upcoming-summary.component';

@Component({
  selector: 'app-live-dashboard',
  imports: [DatePipe, TeamBadgeComponent, LiveUpcomingSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-dashboard.component.html',
  styleUrl: './live-dashboard.component.scss',
})
export class LiveDashboardComponent {
  private readonly api = inject(KickoffApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly overlay = inject(GameDetailOverlay);
  private readonly live = inject(LiveGameStore);
  protected readonly fan = inject(FanStore);
  protected readonly records = inject(TeamRecordStore);

  /** Tap a tile (not its controls) to open the game detail modal in place. */
  open(g: Game): void {
    this.overlay.open(g.id);
  }

  /** Temporary reveal ("peek") scores, keyed by game id, held while pressing. */
  private readonly peeked = signal(new Map<number, Score | null>());

  /** The same app-wide feed used to keep every other game view current. */
  private readonly liveGames = this.live.liveGames;
  private readonly previousScores = new Map<number, { home: number; away: number }>();
  private readonly scorePulseTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly scorePulses = signal<ReadonlyMap<number, ScorePulseKind>>(new Map());
  private readonly scoreHighlightTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly scoringSides = signal<ReadonlyMap<number, ScoreSide>>(new Map());
  private readonly scoreCelebrations = signal<ReadonlyMap<number, ScorePulseKind>>(new Map());

  /** Schedule context for the empty-live fallback. Refreshing once a minute is
   * enough for flexed kickoff times without tying the one-second countdown to
   * network traffic. */
  private readonly scheduledGames = toSignal(
    timer(0, 60_000).pipe(
      switchMap(() => {
        const from = startOfLocalDay(new Date());
        const to = new Date(from);
        to.setDate(to.getDate() + 31);
        return this.api.getRange(from.toISOString(), to.toISOString()).pipe(catchError(() => of<Game[]>([])));
      }),
    ),
    { initialValue: [] as Game[] },
  );

  private readonly now = signal(new Date());

  /** Live games win immediately. Otherwise show either today's remaining games
   * or every game on the next scheduled calendar day. */
  readonly upcomingGames = computed(() => selectUpcomingSlate(this.scheduledGames(), this.now()));
  readonly games = computed(() => this.liveGames().length > 0 ? [...this.liveGames()] : this.upcomingGames());

  readonly liveCount = computed(() => this.liveGames().filter((g) => g.status === 'Live').length);
  readonly showingUpcoming = computed(() => this.liveGames().length === 0 && this.upcomingGames().length > 0);
  readonly showingTodayUpcoming = computed(() => {
    const first = this.upcomingGames()[0];
    return first ? sameLocalDay(new Date(first.kickoffUtc), this.now()) : false;
  });
  readonly nextUpcoming = computed(() => this.upcomingGames()[0] ?? null);
  readonly kickoffCountdown = computed(() => {
    const next = this.showingTodayUpcoming() ? this.nextUpcoming() : null;
    return next ? formatKickoffCountdown(new Date(next.kickoffUtc), this.now()) : null;
  });

  /** "Best game right now": the tightest live, unmuted game. */
  readonly bestGameId = computed(() => selectBestGameId(this.liveGames()));

  trackById = (_: number, g: Game) => g.id;

  constructor() {
    effect(() => {
      for (const game of this.liveGames()) {
        if (!game.score) continue;
        const current = { home: game.score.homeScore, away: game.score.awayScore };
        const previous = this.previousScores.get(game.id);
        if (previous) {
          const pulse = classifyScoreChange(previous, current);
          const scoringSide = scoreIncreaseSide(previous, current);
          if (pulse) this.showScorePulse(game.id, pulse, scoringSide);
        }
        this.previousScores.set(game.id, current);
      }
    });

    this.destroyRef.onDestroy(() => {
      for (const timerId of this.scorePulseTimers.values()) clearTimeout(timerId);
      for (const timerId of this.scoreHighlightTimers.values()) clearTimeout(timerId);
    });

    timer(0, 1_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(new Date()));
  }

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
        if (s?.period === 2 && /^0{1,2}:00$/.test(s.clock?.trim() ?? '')) return 'HALFTIME';
        return s?.clock ? `Q${s.period} · ${s.clock}` : 'LIVE';
      case 'Final':
        return 'FINAL';
      case 'Delayed':
        return 'DELAYED';
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

  inFieldGoalRange(game: Game): boolean {
    return isInFieldGoalRange(game);
  }

  acrossMidfield(game: Game): boolean {
    return isAcrossMidfield(game);
  }

  inRedZone(game: Game): boolean {
    return isInRedZone(game);
  }

  hasPossession(game: Game, teamId: number): boolean {
    return game.status === 'Live' && this.shownScore(game)?.possessionTeamId === teamId;
  }

  possessionTeamAbbreviation(game: Game): string | null {
    const possessionTeamId = this.shownScore(game)?.possessionTeamId;
    if (possessionTeamId === game.away.id) return game.away.abbreviation;
    if (possessionTeamId === game.home.id) return game.home.abbreviation;
    return null;
  }

  scorePulseKind(gameId: number): ScorePulseKind {
    return this.scorePulses().get(gameId) ?? null;
  }

  scoreChanged(gameId: number, side: ScoreSide): boolean {
    return this.scoringSides().get(gameId) === side;
  }

  scoreCelebration(gameId: number): ScorePulseKind {
    return this.scoreCelebrations().get(gameId) ?? null;
  }

  situationLabel(game: Game): string | null {
    return scoreEventLabel(this.scoreCelebration(game.id), this.shownScore(game)?.downDistance)
      ?? this.shownScore(game)?.downDistance
      ?? null;
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

  private showScorePulse(
    gameId: number,
    pulse: Exclude<ScorePulseKind, null>,
    scoringSide: ScoreSide | null,
  ): void {
    const next = new Map(this.scorePulses());
    next.set(gameId, pulse);
    this.scorePulses.set(next);

    const existing = this.scorePulseTimers.get(gameId);
    if (existing) clearTimeout(existing);
    this.scorePulseTimers.set(gameId, setTimeout(() => {
      const cleared = new Map(this.scorePulses());
      cleared.delete(gameId);
      this.scorePulses.set(cleared);
      this.scorePulseTimers.delete(gameId);
    }, 3_000));

    if (scoringSide) {
      const highlighted = new Map(this.scoringSides());
      highlighted.set(gameId, scoringSide);
      this.scoringSides.set(highlighted);
      const celebrations = new Map(this.scoreCelebrations());
      celebrations.set(gameId, pulse);
      this.scoreCelebrations.set(celebrations);

      const highlightTimer = this.scoreHighlightTimers.get(gameId);
      if (highlightTimer) clearTimeout(highlightTimer);
      this.scoreHighlightTimers.set(gameId, setTimeout(() => {
        const cleared = new Map(this.scoringSides());
        cleared.delete(gameId);
        this.scoringSides.set(cleared);
        const clearedCelebrations = new Map(this.scoreCelebrations());
        clearedCelebrations.delete(gameId);
        this.scoreCelebrations.set(clearedCelebrations);
        this.scoreHighlightTimers.delete(gameId);
      }, SCORE_HIGHLIGHT_MS));
    }
  }
}

/** Pick the closest visible live game only when there is another live game to
 * compare it with. A lone game is live by default, not the "best" of a slate. */
export function selectBestGameId(games: readonly Game[]): number | null {
  const liveGames = games.filter((game) => game.status === 'Live');
  if (liveGames.length <= 1) return null;

  const contenders = liveGames.filter((game) => !game.isMuted && game.score);
  if (contenders.length === 0) return null;

  return contenders.reduce((best, game) =>
    margin(game) < margin(best) ? game : best,
  ).id;
}

export function selectUpcomingSlate(games: readonly Game[], now: Date): Game[] {
  const upcoming = games
    .filter((game) => game.status === 'Upcoming' && new Date(game.kickoffUtc).getTime() > now.getTime())
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
  if (upcoming.length === 0) return [];

  const today = upcoming.filter((game) => sameLocalDay(new Date(game.kickoffUtc), now));
  if (today.length > 0) return today;

  const nextGameDate = new Date(upcoming[0].kickoffUtc);
  return upcoming.filter((game) => sameLocalDay(new Date(game.kickoffUtc), nextGameDate));
}

export function formatKickoffCountdown(kickoff: Date, now: Date): string {
  const totalSeconds = Math.max(0, Math.ceil((kickoff.getTime() - now.getTime()) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function margin(g: Game): number {
  return g.score ? Math.abs(g.score.homeScore - g.score.awayScore) : Number.MAX_SAFE_INTEGER;
}
