import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, groupByKickoff, startOfLocalDay } from '../../core/timeline';
import { GameRowComponent } from '../../shared/game-row/game-row.component';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

@Component({
  selector: 'app-day-view',
  imports: [DatePipe, GameRowComponent, ImportantGamesTickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  styleUrls: ['../shared/timeline.scss'],
})
export class DayViewComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  private readonly reload = signal(0);

  readonly day = signal(startOfLocalDay(new Date()));

  private readonly range = computed(() => {
    this.reload();
    const from = this.day();
    return { from: from.toISOString(), to: addDays(from, 1).toISOString() };
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

  readonly slots = computed(() => groupByKickoff(this.visible()));
  readonly total = computed(() => this.visible().length);

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
