import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { filterFollowed, groupByWeek, startOfLocalDay, WeekGroup } from '../../core/timeline';
import { GameRowComponent } from '../../shared/game-row/game-row.component';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';
import { WeekStripComponent, WeekStripItem } from '../../shared/week-strip/week-strip.component';

type ViewMode = 'byWeek' | 'full';

/** Aug 1 of the season's start year through Feb 15 of the following year --
 * wide enough to cover both leagues' full regular season + a little slack. */
function seasonRange(): { from: string; to: string } {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: new Date(startYear, 7, 1).toISOString(),
    to: new Date(startYear + 1, 1, 15).toISOString(),
  };
}

/** "SEP 16 - 22" (same month) or "AUG 27 - SEP 2" (spanning months), ESPN-style. */
function rangeLabel(first: Date, last: Date): string {
  const sameMonth = first.getMonth() === last.getMonth();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const from = first.toLocaleDateString([], opts);
  const to = sameMonth ? last.toLocaleDateString([], { day: 'numeric' }) : last.toLocaleDateString([], opts);
  return `${from} - ${to}`.toUpperCase();
}

@Component({
  selector: 'app-season-schedule',
  imports: [DatePipe, GameRowComponent, ImportantGamesTickerComponent, WeekStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-schedule.component.html',
  styleUrls: ['../shared/timeline.scss', './season-schedule.component.scss'],
})
export class SeasonScheduleComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  private readonly reload = signal(0);

  readonly league = input.required<string>();

  private readonly backendLeague = computed<'Nfl' | 'Ncaa' | null>(() => {
    this.reload();
    return this.league() === 'nfl' ? 'Nfl' : this.league() === 'ncaa' ? 'Ncaa' : null;
  });

  private readonly loadedGames = toSignal(
    toObservable(this.backendLeague).pipe(
      switchMap((league) => {
        if (!league) return of<Game[]>([]);
        const { from, to } = seasonRange();
        return this.api.getRange(from, to, league).pipe(catchError(() => of<Game[]>([])));
      }),
    ),
    { initialValue: [] as Game[] },
  );

  readonly games = computed(() => this.live.overlayAll(this.loadedGames()));

  /** "My games" filter: only favorite-team or circled games. */
  readonly onlyMine = signal(false);
  readonly visible = computed(() => (this.onlyMine() ? filterFollowed(this.games()) : this.games()));

  readonly weeks = computed(() => groupByWeek(this.visible()));
  readonly total = computed(() => this.visible().length);

  readonly leagueLabel = computed(() => (this.league() === 'nfl' ? 'NFL' : 'NCAA'));

  /** Defaults on (week-by-week), per the ask. */
  readonly viewMode = signal<ViewMode>('byWeek');

  /** Whichever real week's date range today falls in, or the closest one if
   * today lands in a gap between weeks (a bye/off day). Null once the season
   * has no games at all. */
  private readonly currentWeekNumber = computed<number | null>(() => {
    const ws = this.weeks();
    if (ws.length === 0) return null;
    const today = startOfLocalDay(new Date()).getTime();

    let best: WeekGroup = ws[0];
    let bestDist = Infinity;
    for (const w of ws) {
      const first = new Date(w.days[0].date).getTime();
      const last = new Date(w.days[w.days.length - 1].date).getTime();
      if (today >= first && today <= last) return w.number;
      const dist = today < first ? first - today : today - last;
      if (dist < bestDist) {
        bestDist = dist;
        best = w;
      }
    }
    return best.number;
  });

  /** Null until the user manually picks a week -- until then, tracks whatever
   * week is "current" as the season's data changes. */
  private readonly selectedWeek = signal<number | null>(null);

  readonly weekNumber = computed(() => this.selectedWeek() ?? this.currentWeekNumber());
  readonly activeWeek = computed(() => this.weeks().find((w) => w.number === this.weekNumber()) ?? null);
  readonly activeWeekGames = computed(() => {
    const weekNumber = this.weekNumber();
    return this.games().filter((game) => game.weekNumber === weekNumber);
  });

  /** The badge describes only what the current schedule view can reveal: the
   * selected week in Week by Week mode, or the entire league season in Full Season. */
  readonly followedCount = computed(() => {
    const games = this.games();
    if (this.viewMode() === 'full') return filterFollowed(games).length;
    const weekNumber = this.weekNumber();
    return filterFollowed(games.filter((game) => game.weekNumber === weekNumber)).length;
  });

  private readonly weekIndex = computed(() => this.weeks().findIndex((w) => w.number === this.weekNumber()));

  readonly canPrevWeek = computed(() => this.weekIndex() > 0);
  readonly canNextWeek = computed(() => {
    const idx = this.weekIndex();
    return idx >= 0 && idx < this.weeks().length - 1;
  });

  readonly weekStripItems = computed<WeekStripItem[]>(() =>
    this.weeks().map((w) => ({
      key: w.number,
      label: w.label,
      range: rangeLabel(new Date(w.days[0].date), new Date(w.days[w.days.length - 1].date)),
      active: w.number === this.weekNumber(),
    })),
  );

  slotLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  selectWeek(key: string | number): void {
    this.selectedWeek.set(Number(key));
  }

  prevWeek(): void {
    const ws = this.weeks();
    const idx = this.weekIndex();
    if (idx > 0) this.selectedWeek.set(ws[idx - 1].number);
  }
  nextWeek(): void {
    const ws = this.weeks();
    const idx = this.weekIndex();
    if (idx >= 0 && idx < ws.length - 1) this.selectedWeek.set(ws[idx + 1].number);
  }
  jumpToCurrentWeek(): void {
    this.selectedWeek.set(null);
  }

  toggleMine(): void {
    this.onlyMine.update((v) => !v);
  }
  refresh(): void {
    this.reload.update((v) => v + 1);
  }
}
