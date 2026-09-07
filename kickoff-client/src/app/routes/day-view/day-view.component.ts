import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, startOfLocalDay } from '../../core/timeline';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';
import { DayGameCardComponent } from './day-game-card.component';
import { DayLayout, groupDayGames } from './day-view-groups';

@Component({
  selector: 'app-day-view',
  imports: [DatePipe, DayGameCardComponent, ImportantGamesTickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  styleUrls: ['../shared/timeline.scss', './day-view.component.scss'],
})
export class DayViewComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);

  readonly day = signal(startOfLocalDay(new Date()));

  private readonly range = computed(() => {
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
  readonly layout = signal<DayLayout>('status');
  readonly followedCount = computed(() => filterFollowed(this.games()).length);
  readonly visible = computed(() => (this.onlyMine() ? filterFollowed(this.games()) : this.games()));
  readonly groups = computed(() => groupDayGames(this.visible(), this.layout()));

  readonly total = computed(() => this.visible().length);

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
  setLayout(layout: DayLayout): void {
    this.layout.set(layout);
  }
}
