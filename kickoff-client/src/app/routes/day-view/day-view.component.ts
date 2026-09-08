import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, startOfLocalDay } from '../../core/timeline';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';
import { DayGameCardComponent } from './day-game-card.component';
import {
  DayPanelSizePreference,
  automaticDayPanelSize,
  isDayPanelSizePreference,
} from './day-panel-size';
import { DayLayout, groupDayGames } from './day-view-groups';
import { buildCalendarMonth, moveCalendarMonth, startOfCalendarMonth } from './day-calendar';
import { formatDaySelection, parseDaySelection } from './day-selection';

const PANEL_SIZE_STORAGE_KEY = 'kickoff.day.panel-size';
const SELECTED_DAY_STORAGE_KEY = 'kickoff.day.selected-date';

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

  readonly day = signal(readSelectedDay());
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

  readonly games = computed(() => this.live.overlayAll(this.loadedGames()));

  /** "My games" filter: only favorite-team or circled games (mixes NCAA + NFL). */
  readonly onlyMine = signal(false);
  readonly layout = signal<DayLayout>('kickoff');
  readonly followedCount = computed(() => filterFollowed(this.games()).length);
  readonly visible = computed(() => (this.onlyMine() ? filterFollowed(this.games()) : this.games()));
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
    this.day.set(startOfLocalDay(new Date()));
    try {
      localStorage.removeItem(SELECTED_DAY_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
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

  private selectDay(day: Date): void {
    const selected = startOfLocalDay(day);
    this.day.set(selected);
    try {
      localStorage.setItem(SELECTED_DAY_STORAGE_KEY, formatDaySelection(selected));
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }
}

function readSelectedDay(): Date {
  try {
    const selected = parseDaySelection(localStorage.getItem(SELECTED_DAY_STORAGE_KEY) ?? '');
    if (selected) return selected;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return startOfLocalDay(new Date());
}

function readPanelSizePreference(): DayPanelSizePreference {
  try {
    const saved = localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    return isDayPanelSizePreference(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}
