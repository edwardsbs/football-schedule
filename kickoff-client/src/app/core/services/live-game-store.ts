import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, exhaustMap, merge, take, timer } from 'rxjs';
import { Game } from '../models/game.model';
import { KickoffApi } from './kickoff-api';

const POLL_MS = 10_000;

/**
 * One app-wide live-game feed. Schedule pages load their normal date range once,
 * then overlay the changing score/status fields from this small shared poll.
 * This avoids re-downloading an entire week or season every ten seconds.
 */
@Injectable({ providedIn: 'root' })
export class LiveGameStore {
  private readonly api = inject(KickoffApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequested = new Subject<void>();
  private readonly updatesById = signal<ReadonlyMap<number, Game>>(new Map());
  private currentLiveIds = new Set<number>();

  readonly liveGames = signal<readonly Game[]>([]);

  constructor() {
    merge(timer(0, POLL_MS), this.refreshRequested)
      .pipe(
        exhaustMap(() => this.api.getLive().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((games) => this.acceptLiveSnapshot(games));
  }

  refresh(): void {
    this.refreshRequested.next();
  }

  overlay(game: Game): Game {
    const update = this.updatesById().get(game.id);
    if (!update) return game;

    return {
      ...game,
      kickoffUtc: update.kickoffUtc,
      venue: update.venue,
      broadcasts: update.broadcasts,
      status: update.status,
      score: game.isMuted ? null : update.score,
    };
  }

  overlayAll(games: readonly Game[]): Game[] {
    // Read once so Angular tracks this cache when overlayAll is called inside a computed.
    this.updatesById();
    return games.map((game) => this.overlay(game));
  }

  private acceptLiveSnapshot(games: Game[]): void {
    const nextLiveIds = new Set(games.map((game) => game.id));
    const finishedIds = [...this.currentLiveIds].filter((id) => !nextLiveIds.has(id));

    this.currentLiveIds = nextLiveIds;
    this.liveGames.set(games);
    this.cache(games);

    // Once a game becomes final it drops out of /games/live. Fetch it once more
    // so every open view receives the final score instead of reverting to its
    // original page-load snapshot.
    for (const id of finishedIds) {
      this.api
        .getGame(id)
        .pipe(
          take(1),
          catchError(() => EMPTY),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((game) => this.cache([game]));
    }
  }

  private cache(games: readonly Game[]): void {
    if (games.length === 0) return;
    const next = new Map(this.updatesById());
    for (const game of games) next.set(game.id, game);
    this.updatesById.set(next);
  }
}
