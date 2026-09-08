import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { GameDayBoardStore } from '../../core/services/game-day-board-store';
import { FanStore } from '../../core/services/fan-store';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { SelectedDayStore } from '../../core/services/selected-day-store';
import { addDays } from '../../core/timeline';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';
import { DayGameCardComponent } from '../day-view/day-game-card.component';
import { automaticDayPanelSize } from '../day-view/day-panel-size';
import { buildCalendarMonth, moveCalendarMonth, startOfCalendarMonth } from '../day-view/day-calendar';
import { isGettingInteresting } from './game-day-interest';

@Component({
  selector: 'app-game-day-central',
  imports: [DatePipe, DayGameCardComponent, ImportantGamesTickerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-day-central.component.html',
})
export class GameDayCentralComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  private readonly selectedDay = inject(SelectedDayStore);
  readonly board = inject(GameDayBoardStore);
  private readonly fan = inject(FanStore);

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
  readonly otherGames = computed(() => this.games().filter((game) => !this.isOnGameDay(game)));
  readonly watchingSize = computed(() => automaticDayPanelSize(this.watching().length));
  readonly otherSize = computed(() => automaticDayPanelSize(this.otherGames().length));
  readonly interestingCount = computed(() => this.otherGames().filter(isGettingInteresting).length);

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

  addToGameDay(game: Game): void {
    this.board.promote(game.id);
  }

  removeFromGameDay(game: Game): void {
    this.board.demote(game.id, this.fan.isCircled(game.id));
  }

  private isOnGameDay(game: Game): boolean {
    return this.board.isWatching(game.id, this.fan.isCircled(game.id));
  }

  @HostListener('document:keydown.escape')
  closeCalendarWithEscape(): void {
    this.closeCalendar();
  }
}
