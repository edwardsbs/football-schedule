import { Injectable, computed, inject, signal } from '@angular/core';
import { KickoffApi } from './kickoff-api';
import { FavoriteTeam, Game } from '../models/game.model';

/**
 * App-wide favorites + circled state. Loaded once at startup and updated
 * optimistically on toggle, so the My Teams strip, the Upcoming list, and the
 * per-team / per-game highlights across every view stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class FanStore {
  private readonly api = inject(KickoffApi);

  readonly favorites = signal<FavoriteTeam[]>([]);
  readonly circled = signal<Game[]>([]);

  readonly favoriteIds = computed(() => new Set(this.favorites().map((f) => f.teamId)));
  readonly circledIds = computed(() => new Set(this.circled().map((g) => g.id)));

  load(): void {
    this.reloadFavorites();
    this.reloadCircled();
  }

  reloadFavorites(): void {
    this.api.getFavorites().subscribe((f) => this.favorites.set(f));
  }

  reloadCircled(): void {
    this.api.getCircled().subscribe((g) => this.circled.set(g));
  }

  isFavorite(teamId: number): boolean {
    return this.favoriteIds().has(teamId);
  }

  isCircled(gameId: number): boolean {
    return this.circledIds().has(gameId);
  }

  toggleFavorite(teamId: number): void {
    const op = this.isFavorite(teamId)
      ? this.api.removeFavorite(teamId)
      : this.api.addFavorite(teamId);
    op.subscribe(() => this.reloadFavorites());
  }

  toggleCircle(gameId: number): void {
    const op = this.isCircled(gameId) ? this.api.uncircle(gameId) : this.api.circle(gameId);
    op.subscribe(() => this.reloadCircled());
  }
}
