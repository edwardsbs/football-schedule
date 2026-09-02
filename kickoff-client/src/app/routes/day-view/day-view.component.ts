import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, groupByKickoff, startOfLocalDay } from '../../core/timeline';
import { CongestionBar, CongestionComponent } from '../../shared/congestion/congestion.component';
import { GameRowComponent } from '../../shared/game-row/game-row.component';
import { MyTeamsStripComponent } from '../../shared/my-teams-strip/my-teams-strip.component';

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

@Component({
  selector: 'app-day-view',
  imports: [DatePipe, GameRowComponent, CongestionComponent, MyTeamsStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  styleUrls: ['../shared/timeline.scss'],
})
export class DayViewComponent {
  private readonly api = inject(KickoffApi);
  private readonly reload = signal(0);

  readonly day = signal(startOfLocalDay(new Date()));

  private readonly range = computed(() => {
    this.reload();
    const from = this.day();
    return { from: from.toISOString(), to: addDays(from, 1).toISOString() };
  });

  readonly games = toSignal(
    toObservable(this.range).pipe(
      switchMap((r) => this.api.getRange(r.from, r.to).pipe(catchError(() => of<Game[]>([])))),
    ),
    { initialValue: [] as Game[] },
  );

  /** "My games" filter: only favorite-team or circled games (mixes NCAA + NFL). */
  readonly onlyMine = signal(false);
  readonly followedCount = computed(() => filterFollowed(this.games()).length);
  readonly visible = computed(() => (this.onlyMine() ? filterFollowed(this.games()) : this.games()));

  readonly slots = computed(() => groupByKickoff(this.visible()));
  readonly total = computed(() => this.visible().length);

  readonly congestion = computed<CongestionBar[]>(() => {
    const slots = this.slots();
    const peak = Math.max(0, ...slots.map((s) => s.count));
    return slots.map((s) => ({ label: timeLabel(s.kickoff), count: s.count, highlight: s.count === peak && peak > 0 }));
  });

  slotLabel(iso: string): string {
    return timeLabel(iso);
  }

  prev(): void {
    this.day.update((d) => addDays(d, -1));
  }
  next(): void {
    this.day.update((d) => addDays(d, 1));
  }
  today(): void {
    this.day.set(startOfLocalDay(new Date()));
  }
  toggleMine(): void {
    this.onlyMine.update((v) => !v);
  }
  refresh(): void {
    this.reload.update((v) => v + 1);
  }
}
