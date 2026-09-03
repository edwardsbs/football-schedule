import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, groupByDay, startOfWeek } from '../../core/timeline';
import { GameRowComponent } from '../../shared/game-row/game-row.component';
import { MyTeamsStripComponent } from '../../shared/my-teams-strip/my-teams-strip.component';

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

@Component({
  selector: 'app-week-view',
  imports: [DatePipe, GameRowComponent, MyTeamsStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-view.component.html',
  styleUrls: ['../shared/timeline.scss'],
})
export class WeekViewComponent {
  private readonly api = inject(KickoffApi);
  private readonly reload = signal(0);

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly weekEnd = computed(() => addDays(this.weekStart(), 6));

  private readonly range = computed(() => {
    this.reload();
    const from = this.weekStart();
    return { from: from.toISOString(), to: addDays(from, 7).toISOString() };
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

  readonly days = computed(() => groupByDay(this.visible()));
  readonly total = computed(() => this.visible().length);

  slotLabel(iso: string): string {
    return timeLabel(iso);
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
