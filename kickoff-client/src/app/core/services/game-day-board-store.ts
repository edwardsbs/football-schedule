import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'kickoff.game-day.watched-games';

@Injectable({ providedIn: 'root' })
export class GameDayBoardStore {
  readonly watchedGameIds = signal<ReadonlySet<number>>(readWatchedGameIds());

  isWatching(gameId: number): boolean {
    return this.watchedGameIds().has(gameId);
  }

  promote(gameId: number): void {
    this.update(gameId, true);
  }

  demote(gameId: number): void {
    this.update(gameId, false);
  }

  toggle(gameId: number): void {
    this.update(gameId, !this.isWatching(gameId));
  }

  private update(gameId: number, watching: boolean): void {
    const next = new Set(this.watchedGameIds());
    if (watching) next.add(gameId);
    else next.delete(gameId);
    this.watchedGameIds.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // The board still works for this session when persistence is unavailable.
    }
  }
}

function readWatchedGameIds(): ReadonlySet<number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is number => Number.isInteger(id) && id > 0));
    }
  } catch {
    // Ignore malformed or unavailable browser storage.
  }
  return new Set<number>();
}
