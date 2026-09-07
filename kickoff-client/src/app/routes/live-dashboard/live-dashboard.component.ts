import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { LiveGameStore } from '../../core/services/live-game-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { Game, Score } from '../../core/models/game.model';
import { isInFieldGoalRange, isInRedZone } from '../../core/field-position';
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
  readonly bestGameId = computed(() => {
    const contenders = this.liveGames().filter((g) => g.status === 'Live' && !g.isMuted && g.score);
    if (contenders.length === 0) return null;
    return contenders.reduce((best, g) =>
      margin(g) < margin(best) ? g : best,
    ).id;
  });

  trackById = (_: number, g: Game) => g.id;

  constructor() {
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

  inFieldGoalRange(game: Game): boolean {
    return isInFieldGoalRange(game);
  }

  inRedZone(game: Game): boolean {
    return isInRedZone(game);
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
