import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'kickoff.game-day.watched-games';
const AUTO_EXCLUDED_STORAGE_KEY = 'kickoff.game-day.auto-excluded-games';

@Injectable({ providedIn: 'root' })
export class GameDayBoardStore {
  readonly watchedGameIds = signal<ReadonlySet<number>>(readGameIds(STORAGE_KEY));
  private readonly autoExcludedGameIds = signal<ReadonlySet<number>>(readGameIds(AUTO_EXCLUDED_STORAGE_KEY));

  isWatching(gameId: number, automaticallyIncluded = false): boolean {
    return this.watchedGameIds().has(gameId)
      || (automaticallyIncluded && !this.autoExcludedGameIds().has(gameId));
  }

  promote(gameId: number): void {
    this.update(gameId, true);
  }

  demote(gameId: number, automaticallyIncluded = false): void {
    this.update(gameId, false, automaticallyIncluded);
  }

  toggle(gameId: number, automaticallyIncluded = false): void {
    const watching = this.isWatching(gameId, automaticallyIncluded);
    this.update(gameId, !watching, watching && automaticallyIncluded);
  }

  allowAutomaticInclusion(gameId: number): void {
    const excluded = new Set(this.autoExcludedGameIds());
    if (!excluded.delete(gameId)) return;
    this.autoExcludedGameIds.set(excluded);
    try {
      localStorage.setItem(AUTO_EXCLUDED_STORAGE_KEY, JSON.stringify([...excluded]));
    } catch {
      // The board still works for this session when persistence is unavailable.
    }
  }

  private update(gameId: number, watching: boolean, suppressAutomatic = false): void {
    const watched = new Set(this.watchedGameIds());
    const excluded = new Set(this.autoExcludedGameIds());
    if (watching) watched.add(gameId);
    else watched.delete(gameId);
    if (suppressAutomatic) excluded.add(gameId);
    else excluded.delete(gameId);

    this.watchedGameIds.set(watched);
    this.autoExcludedGameIds.set(excluded);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...watched]));
      localStorage.setItem(AUTO_EXCLUDED_STORAGE_KEY, JSON.stringify([...excluded]));
    } catch {
      // The board still works for this session when persistence is unavailable.
    }
  }
}

function readGameIds(storageKey: string): ReadonlySet<number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is number => Number.isInteger(id) && id > 0));
    }
  } catch {
    // Ignore malformed or unavailable browser storage.
  }
  return new Set<number>();
}
