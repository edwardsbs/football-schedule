import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { KickoffApi } from '../../core/services/kickoff-api';
import { Game } from '../../core/models/game.model';
import { addDays, filterFollowed, groupByDay, startOfLocalDay } from '../../core/timeline';
import { GameRowComponent } from '../game-row/game-row.component';

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

  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly games = signal<Game[]>([]);
  readonly loading = signal(false);

  readonly followed = signal<Game[]>([]);
  readonly groups = signal<ReturnType<typeof groupByDay>>([]);

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
        const mine = filterFollowed(games);
        this.followed.set(mine);
        this.groups.set(groupByDay(mine));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.fetch();
  }

  close(): void {
    this.closed.emit();
  }
}
