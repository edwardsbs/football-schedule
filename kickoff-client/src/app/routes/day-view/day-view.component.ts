import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { GameDayBoardStore } from '../../core/services/game-day-board-store';
import { FanStore } from '../../core/services/fan-store';
import { SelectedDayStore } from '../../core/services/selected-day-store';
import { TeamConferenceStore } from '../../core/services/team-conference-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { Game } from '../../core/models/game.model';
import { GameFilterContext, GameFilters, countActiveGameFilters, defaultGameFilters, matchesGameFilters } from '../../core/game-filters';
import { addDays, filterFollowed } from '../../core/timeline';
import { FindGamesFilterComponent } from '../../shared/find-games-filter/find-games-filter.component';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';
import { DayGameCardComponent } from './day-game-card.component';
import {
  DayPanelSizePreference,
  automaticDayPanelSize,
  isDayPanelSizePreference,
} from './day-panel-size';
import { DayLayout, groupDayGames } from './day-view-groups';
import { buildCalendarMonth, moveCalendarMonth, startOfCalendarMonth } from './day-calendar';

const PANEL_SIZE_STORAGE_KEY = 'kickoff.day.panel-size';

@Component({
  selector: 'app-day-view',
  imports: [DatePipe, DayGameCardComponent, FindGamesFilterComponent, ImportantGamesTickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  styleUrls: ['../shared/timeline.scss', './day-view.component.scss'],
})
export class DayViewComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  private readonly selectedDay = inject(SelectedDayStore);
  readonly gameDayBoard = inject(GameDayBoardStore);
  private readonly fan = inject(FanStore);
  private readonly conferences = inject(TeamConferenceStore);
  private readonly records = inject(TeamRecordStore);
  private readonly filterCtx: GameFilterContext = {
    groupOf: (id) => this.conferences.groupOf(id),
    recordOf: (id) => this.records.record(id),
  };

  readonly day = this.selectedDay.day;
  readonly calendarOpen = signal(false);
  readonly calendarMonth = signal(startOfCalendarMonth(this.day()));
  readonly calendarDays = computed(() => buildCalendarMonth(this.calendarMonth(), this.day()));

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

  readonly games = computed(() => {
    const range = this.range();
    return this.live.overlayRange(this.loadedGames(), range.from, range.to);
  });

  /** "My games" filter: only favorite-team or circled games (mixes NCAA + NFL). */
  readonly onlyMine = signal(false);
  readonly layout = signal<DayLayout>('kickoff');
  readonly followedCount = computed(() => filterFollowed(this.games()).length);

  readonly gameFiltersOpen = signal(false);
  readonly gameFilters = signal<GameFilters>(defaultGameFilters());
  readonly activeGameFilterCount = computed(() => countActiveGameFilters(this.gameFilters()));

  readonly visible = computed(() => {
    const base = this.onlyMine() ? filterFollowed(this.games()) : this.games();
    return base.filter((g) => matchesGameFilters(g, this.gameFilters(), this.filterCtx));
  });
  readonly groups = computed(() => groupDayGames(this.visible(), this.layout()));

  readonly total = computed(() => this.visible().length);
  readonly panelSize = signal<DayPanelSizePreference>(readPanelSizePreference());
  readonly automaticPanelSize = computed(() => automaticDayPanelSize(this.total()));
  readonly resolvedPanelSize = computed(() => {
    const preference = this.panelSize();
    return preference === 'auto' ? this.automaticPanelSize() : preference;
  });

  prev(): void {
    this.selectDay(addDays(this.day(), -1));
  }
  next(): void {
    this.selectDay(addDays(this.day(), 1));
  }
  today(): void {
    this.selectedDay.goToToday();
  }
  openCalendar(): void {
    this.calendarMonth.set(startOfCalendarMonth(this.day()));
    this.calendarOpen.set(true);
  }
  closeCalendar(): void {
    this.calendarOpen.set(false);
  }
  moveCalendar(offset: number): void {
    this.calendarMonth.update((month) => moveCalendarMonth(month, offset));
  }
  selectCalendarDay(day: Date): void {
    this.selectDay(day);
    this.closeCalendar();
  }

  @HostListener('document:keydown.escape')
  closeCalendarWithEscape(): void {
    this.closeCalendar();
  }
  toggleMine(): void {
    this.onlyMine.update((v) => !v);
  }
  setLayout(layout: DayLayout): void {
    this.layout.set(layout);
  }
  setPanelSize(size: DayPanelSizePreference): void {
    this.panelSize.set(size);
    try {
      localStorage.setItem(PANEL_SIZE_STORAGE_KEY, size);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }

  isOnGameDay(game: Game): boolean {
    return this.gameDayBoard.isWatching(game.id, this.fan.isCircled(game.id));
  }

  toggleGameDay(game: Game): void {
    this.gameDayBoard.toggle(game.id, this.fan.isCircled(game.id));
  }

  private selectDay(day: Date): void {
    this.selectedDay.select(day);
  }
}

function readPanelSizePreference(): DayPanelSizePreference {
  try {
    const saved = localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    return isDayPanelSizePreference(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}
