import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, groupByDay, startOfWeek } from '../../core/timeline';
import { GameRowComponent } from '../../shared/game-row/game-row.component';
import { MyTeamsStripComponent } from '../../shared/my-teams-strip/my-teams-strip.component';
import { WeekStripComponent, WeekStripItem } from '../../shared/week-strip/week-strip.component';

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "SEP 16 - 22" (same month) or "AUG 27 - SEP 2" (spanning months), ESPN-style. */
function rangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const from = start.toLocaleDateString([], opts);
  const to = sameMonth ? end.toLocaleDateString([], { day: 'numeric' }) : end.toLocaleDateString([], opts);
  return `${from} - ${to}`.toUpperCase();
}

/** Every Tuesday-start calendar week from Aug 1 of the season's start year
 * through Feb 15 of the following year -- this page merges both leagues, so
 * there's no single real "week number" to key off; these are just labeled
 * positionally (Week 1, 2, 3...) the way the strip visually implies. */
function seasonWeekStarts(): Date[] {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  let cursor = startOfWeek(new Date(startYear, 7, 1));
  const end = new Date(startYear + 1, 1, 15);
  const starts: Date[] = [];
  while (cursor < end) {
    starts.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return starts;
}

@Component({
  selector: 'app-week-view',
  imports: [DatePipe, GameRowComponent, MyTeamsStripComponent, WeekStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-view.component.html',
  styleUrls: ['../shared/timeline.scss'],
})
export class WeekViewComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  private readonly reload = signal(0);

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly weekEnd = computed(() => addDays(this.weekStart(), 6));

  private readonly range = computed(() => {
    this.reload();
    const from = this.weekStart();
    return { from: from.toISOString(), to: addDays(from, 7).toISOString() };
  });

  private readonly loadedGames = toSignal(
    toObservable(this.range).pipe(
      switchMap((r) => this.api.getRange(r.from, r.to).pipe(catchError(() => of<Game[]>([])))),
    ),
    { initialValue: [] as Game[] },
  );

  readonly games = computed(() => this.live.overlayAll(this.loadedGames()));

  /** "My games" filter: only favorite-team or circled games (mixes NCAA + NFL). */
  readonly onlyMine = signal(false);
  readonly followedCount = computed(() => filterFollowed(this.games()).length);
  readonly visible = computed(() => (this.onlyMine() ? filterFollowed(this.games()) : this.games()));

  readonly days = computed(() => groupByDay(this.visible()));
  readonly total = computed(() => this.visible().length);

  private readonly weekStarts = seasonWeekStarts();

  readonly weekStripItems = computed<WeekStripItem[]>(() => {
    const activeKey = this.weekStart().toISOString();
    return this.weekStarts.map((start, i) => ({
      key: start.toISOString(),
      label: `Week ${i + 1}`,
      range: rangeLabel(start, addDays(start, 6)),
      active: start.toISOString() === activeKey,
    }));
  });

  // Unlike season-schedule (clamped to real imported weeks), prev/next here
  // are intentionally unbounded -- the strip covers the season at a glance,
  // but you can still step arbitrarily far into the off-season if you want.

  slotLabel(iso: string): string {
    return timeLabel(iso);
  }

  pickWeek(key: string | number): void {
    this.weekStart.set(new Date(key));
  }

  prev(): void {
    this.weekStart.update((d) => addDays(d, -7));
  }
  next(): void {
    this.weekStart.update((d) => addDays(d, 7));
  }
  thisWeek(): void {
    this.weekStart.set(startOfWeek(new Date()));
  }
  toggleMine(): void {
    this.onlyMine.update((v) => !v);
  }
  refresh(): void {
    this.reload.update((v) => v + 1);
  }
}
