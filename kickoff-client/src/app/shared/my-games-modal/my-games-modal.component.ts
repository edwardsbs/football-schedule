import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, startOfLocalDay } from '../../core/timeline';
import { GameRowComponent } from '../game-row/game-row.component';
import { groupMyGames, myGameCountdown } from './my-games-groups';

/**
 * Global "My Games" quick-look: favorite-team + circled games (mixing NCAA and
 * NFL), reachable from any page via the shell topbar without navigating away.
 * Fetches a rolling window (3 days back, 21 ahead) each time it opens.
 */
@Component({
  selector: 'app-my-games-modal',
  imports: [DatePipe, GameRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-games-modal.component.html',
  styleUrl: './my-games-modal.component.scss',
})
export class MyGamesModalComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly games = signal<Game[]>([]);
  private readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), { initialValue: Date.now() });
  readonly loading = signal(false);

  readonly followed = computed(() => filterFollowed(this.live.overlayAll(this.games())));
  readonly groups = computed(() => groupMyGames(this.followed(), new Date(this.now())));

  constructor() {
    effect(() => {
      if (this.open()) this.fetch();
    });
  }

  private fetch(): void {
    this.loading.set(true);
    const from = startOfLocalDay(addDays(new Date(), -3));
    const to = addDays(from, 24);
    this.api.getRange(from.toISOString(), to.toISOString()).subscribe({
      next: (games) => {
        this.games.set(games);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.fetch();
  }

  countdown(game: Game): string {
    return myGameCountdown(game, this.now());
  }

  close(): void {
    this.closed.emit();
  }
}
