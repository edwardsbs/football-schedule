import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameFilterContext, GameFilters, countActiveGameFilters, defaultGameFilters, matchesGameFilters } from '../../core/game-filters';
import { GameDayBoardStore } from '../../core/services/game-day-board-store';
import { FanStore } from '../../core/services/fan-store';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { SelectedDayStore } from '../../core/services/selected-day-store';
import { TeamConferenceStore } from '../../core/services/team-conference-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { addDays } from '../../core/timeline';
import { FindGamesFilterComponent } from '../../shared/find-games-filter/find-games-filter.component';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';
import { DayGameCardComponent } from '../day-view/day-game-card.component';
import { automaticDayPanelSize } from '../day-view/day-panel-size';
import { buildCalendarMonth, moveCalendarMonth, startOfCalendarMonth } from '../day-view/day-calendar';
import { GameInterestRating, gameInterest, isGettingInteresting } from './game-day-interest';
import { GameDayFocusRailComponent } from './game-day-focus-rail.component';

@Component({
  selector: 'app-game-day-central',
  host: { class: 'game-day-central-shell' },
  imports: [DatePipe, DayGameCardComponent, FindGamesFilterComponent, GameDayFocusRailComponent, ImportantGamesTickerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-day-central.component.html',
  styleUrls: ['../shared/timeline.scss'],
})
export class GameDayCentralComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  private readonly selectedDay = inject(SelectedDayStore);
  readonly board = inject(GameDayBoardStore);
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

  private readonly range = computed(() => ({
    from: this.day().toISOString(),
    to: addDays(this.day(), 1).toISOString(),
  }));

  private readonly loadedGames = toSignal(
    toObservable(this.range).pipe(
      switchMap(({ from, to }) => this.api.getRange(from, to).pipe(catchError(() => of<Game[]>([])))),
    ),
    { initialValue: [] as Game[] },
  );

  readonly games = computed(() => {
    const range = this.range();
    return this.live.overlayRange(this.loadedGames(), range.from, range.to);
  });
  readonly watching = computed(() => this.games().filter((game) => this.isOnGameDay(game)));
  readonly activeWatching = computed(() => this.watching().filter((game) => game.status === 'Live'));
  readonly inactiveWatching = computed(() => this.watching().filter((game) => game.status !== 'Live'));
  readonly otherGames = computed(() => this.games().filter((game) => !this.isOnGameDay(game)));
  readonly activeWatchingSize = computed(() => automaticDayPanelSize(this.activeWatching().length));
  readonly inactiveWatchingSize = computed(() => automaticDayPanelSize(this.inactiveWatching().length));
  readonly focusedGameId = signal<number | null>(null);
  readonly focusRotationProgress = signal(100);

  readonly gameFiltersOpen = signal(false);
  readonly gameFilters = signal<GameFilters>(defaultGameFilters());
  readonly activeGameFilterCount = computed(() => countActiveGameFilters(this.gameFilters()));

  readonly visibleOtherGames = computed(() =>
    this.otherGames().filter((g) => matchesGameFilters(g, this.gameFilters(), this.filterCtx)),
  );
  readonly otherSize = computed(() => automaticDayPanelSize(this.visibleOtherGames().length));
  readonly interestingCount = computed(() => this.visibleOtherGames().filter(isGettingInteresting).length);

  prev(): void {
    this.selectedDay.select(addDays(this.day(), -1));
  }

  next(): void {
    this.selectedDay.select(addDays(this.day(), 1));
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
    this.selectedDay.select(day);
    this.closeCalendar();
  }

  interesting(game: Game): boolean {
    return isGettingInteresting(game);
  }

  interestRating(game: Game): GameInterestRating | null {
    return gameInterest(game)?.rating ?? null;
  }

  interestLabel(game: Game): string {
    return gameInterest(game)?.ratingLabel ?? '';
  }

  interestDescription(game: Game): string {
    const match = gameInterest(game);
    if (!match) return '';
    const rating = match.rating === 'stop-what-youre-doing'
      ? 'Stop what you are doing and check out this game'
      : match.ratingLabel;
    return `${rating}: ${match.scenarioLabel}`;
  }

  addToGameDay(game: Game): void {
    this.board.promote(game.id);
  }

  removeFromGameDay(game: Game): void {
    this.board.demote(game.id, this.fan.isCircled(game.id));
  }

  focusGame(game: Game): void {
    this.focusRotationProgress.set(0);
    this.focusedGameId.set(game.id);
  }

  private isOnGameDay(game: Game): boolean {
    return this.board.isWatching(game.id, this.fan.isCircled(game.id));
  }

  @HostListener('document:keydown.escape')
  closeCalendarWithEscape(): void {
    this.closeCalendar();
  }
}
