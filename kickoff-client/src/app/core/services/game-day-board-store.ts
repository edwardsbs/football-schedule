import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, filter, fromEvent, merge, take } from 'rxjs';
import { DemoGameStore } from './demo-game-store';
import { GameDayBoard, KickoffApi } from './kickoff-api';

const STORAGE_KEY = 'kickoff.game-day.watched-games';
const AUTO_EXCLUDED_STORAGE_KEY = 'kickoff.game-day.auto-excluded-games';
const SERVER_MIGRATION_KEY = 'kickoff.game-day.server-migrated';

@Injectable({ providedIn: 'root' })
export class GameDayBoardStore {
  private readonly api = inject(KickoffApi);
  private readonly demo = inject(DemoGameStore);
  private readonly destroyRef = inject(DestroyRef);
  private mutationVersion = 0;

  readonly watchedGameIds = signal<ReadonlySet<number>>(readGameIds(STORAGE_KEY));
  private readonly autoExcludedGameIds = signal<ReadonlySet<number>>(readGameIds(AUTO_EXCLUDED_STORAGE_KEY));

  constructor() {
    this.reload();

    // An already-open tablet or laptop catches up when the user returns to it.
    merge(
      fromEvent(window, 'focus'),
      fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible')),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());
  }

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
    this.persistLocal();
    this.save(gameId, false, false);
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
    this.persistLocal();
    this.save(gameId, watching, suppressAutomatic);
  }

  private reload(): void {
    const version = this.mutationVersion;
    this.api.getGameDayBoard()
      .pipe(
        take(1),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((board) => {
        if (version !== this.mutationVersion) return;
        this.acceptServerBoard(board, version);
      });
  }

  private save(gameId: number, watching: boolean, suppressAutomatic: boolean): void {
    if (this.demo.isDemoGame(gameId)) return;

    const version = ++this.mutationVersion;
    this.api.setGameDayPreference(gameId, watching, suppressAutomatic)
      .pipe(
        take(1),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((board) => {
        if (version === this.mutationVersion) this.acceptServerBoard(board, version);
      });
  }

  private acceptServerBoard(board: GameDayBoard, version: number): void {
    const shouldMigrate = !hasServerMigrationCompleted()
      && (this.watchedGameIds().size > 0 || this.autoExcludedGameIds().size > 0);
    if (!shouldMigrate) {
      markServerMigrationCompleted();
      this.applyServerBoard(board);
      return;
    }

    this.api.importGameDayBoard([...this.watchedGameIds()], [...this.autoExcludedGameIds()])
      .pipe(
        take(1),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((imported) => {
        if (version !== this.mutationVersion) return;
        markServerMigrationCompleted();
        this.applyServerBoard(imported);
      });
  }

  private applyServerBoard(board: GameDayBoard): void {
    const localDemoWatched = [...this.watchedGameIds()].filter((id) => this.demo.isDemoGame(id));
    const localDemoExcluded = [...this.autoExcludedGameIds()].filter((id) => this.demo.isDemoGame(id));
    this.watchedGameIds.set(new Set([...validGameIds(board.watchedGameIds), ...localDemoWatched]));
    this.autoExcludedGameIds.set(new Set([...validGameIds(board.autoExcludedGameIds), ...localDemoExcluded]));
    this.persistLocal();
  }

  private persistLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.watchedGameIds()]));
      localStorage.setItem(AUTO_EXCLUDED_STORAGE_KEY, JSON.stringify([...this.autoExcludedGameIds()]));
    } catch {
      // The board still works for this session when persistence is unavailable.
    }
  }
}

function validGameIds(ids: readonly number[]): number[] {
  return ids.filter((id) => Number.isInteger(id) && id > 0);
}

function hasServerMigrationCompleted(): boolean {
  try {
    return localStorage.getItem(SERVER_MIGRATION_KEY) === 'true';
  } catch {
    return false;
  }
}

function markServerMigrationCompleted(): void {
  try {
    localStorage.setItem(SERVER_MIGRATION_KEY, 'true');
  } catch {
    // A server-backed board still works when browser storage is unavailable.
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
