import { Injectable, signal } from '@angular/core';

/**
 * Global "which game's detail is open in the overlay modal" state. Any game
 * row/tile injects this to open a game without navigating away from its page;
 * the shell renders the one modal that reads it.
 */
@Injectable({ providedIn: 'root' })
export class GameDetailOverlay {
  readonly gameId = signal<number | null>(null);

  open(id: number): void {
    this.gameId.set(id);
  }

  close(): void {
    this.gameId.set(null);
  }
}
