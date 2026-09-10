import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { MatchLeague, MatchTile, pickRound } from '../division-match/division-match-data';
import { locationTilePool, StateTarget, US_STATE_TARGETS } from './match-location-data';

export type LocationRoundSize = 'quick' | 'standard' | 'full';

const FIXED_ROUND_SIZES: Record<MatchLeague, Record<'quick' | 'standard', number>> = {
  nfl: { quick: 8, standard: 16 },
  ncaa: { quick: 16, standard: 32 },
};
const DRAG_THRESHOLD_PX = 6;
const FLASH_MS = 550;
const HINT_HOLD_MS = 3000;

interface DragStart {
  pointerId: number;
  x: number;
  y: number;
  tile: MatchTile;
  el: HTMLElement;
}

/** Touch-first geography game using the same team pool as Division Match. */
@Component({
  selector: 'app-match-location',
  imports: [RouterLink, TeamBadgeComponent],
  templateUrl: './match-location.component.html',
  styleUrl: './match-location.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchLocationComponent {
  readonly league = input.required<string>();
  readonly matchLeague = computed<MatchLeague>(() => (this.league() === 'nfl' ? 'nfl' : 'ncaa'));
  readonly leagueLabel = computed(() => (this.matchLeague() === 'nfl' ? 'NFL' : 'NCAA'));
  readonly states = US_STATE_TARGETS;
  private readonly pool = computed(() => locationTilePool(this.matchLeague()));
  readonly poolSize = computed(() => this.pool().length);
  readonly quickSize = computed(() => Math.min(FIXED_ROUND_SIZES[this.matchLeague()].quick, this.poolSize()));
  readonly standardSize = computed(() => Math.min(FIXED_ROUND_SIZES[this.matchLeague()].standard, this.poolSize()));

  readonly roundSize = signal<LocationRoundSize>('standard');
  readonly round = signal<MatchTile[]>([]);
  readonly placed = signal<Map<string, MatchTile[]>>(new Map());
  readonly mistakes = signal(0);
  readonly totalTiles = signal(0);
  readonly selectedTileKey = signal<string | null>(null);
  readonly flashStateCode = signal<string | null>(null);
  readonly dragTileKey = signal<string | null>(null);
  private readonly dragDx = signal(0);
  private readonly dragDy = signal(0);
  readonly dragTransform = computed(() => `translate(${this.dragDx()}px, ${this.dragDy()}px)`);

  readonly hintArmedTileKey = signal<string | null>(null);
  readonly hintTileKey = signal<string | null>(null);
  readonly hintStateCode = computed(() => {
    const key = this.hintTileKey();
    return key ? this.round().find((tile) => tile.key === key)?.targetKey ?? null : null;
  });

  readonly placedCount = computed(() => {
    let count = 0;
    for (const tiles of this.placed().values()) count += tiles.length;
    return count;
  });
  readonly isComplete = computed(() => this.totalTiles() > 0 && this.round().length === 0);

  private dragStart: DragStart | null = null;
  private suppressNextTileClick = false;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.matchLeague();
      untracked(() => this.newRound(this.roundSize()));
    });
    this.destroyRef.onDestroy(() => this.clearHintTimer());
  }

  newRound(size: LocationRoundSize = this.roundSize()): void {
    this.roundSize.set(size);
    const pool = this.pool();
    const count = size === 'full' ? pool.length : FIXED_ROUND_SIZES[this.matchLeague()][size];
    const tiles = pickRound(pool, count);

    this.round.set(tiles);
    this.totalTiles.set(tiles.length);
    this.placed.set(new Map());
    this.mistakes.set(0);
    this.selectedTileKey.set(null);
    this.dragTileKey.set(null);
    this.dragDx.set(0);
    this.dragDy.set(0);
    this.clearHint();
  }

  onTilePointerDown(tile: MatchTile, event: PointerEvent): void {
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    this.dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, tile, el };
    this.dragDx.set(0);
    this.dragDy.set(0);
    this.hintArmedTileKey.set(tile.key);
    this.clearHintTimer();
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      this.hintTileKey.set(tile.key);
    }, HINT_HOLD_MS);
  }

  onTilePointerMove(event: PointerEvent): void {
    const start = this.dragStart;
    if (!start || event.pointerId !== start.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    this.dragDx.set(dx);
    this.dragDy.set(dy);
    if (this.dragTileKey() !== start.tile.key && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      this.dragTileKey.set(start.tile.key);
      this.selectedTileKey.set(null);
      this.clearHint();
      start.el.style.pointerEvents = 'none';
    }
  }

  onTilePointerUp(event: PointerEvent): void {
    const start = this.dragStart;
    if (!start || event.pointerId !== start.pointerId) return;
    start.el.releasePointerCapture(event.pointerId);
    this.clearHint();

    const wasDragging = this.dragTileKey() === start.tile.key;
    this.dragTileKey.set(null);
    this.dragDx.set(0);
    this.dragDy.set(0);
    this.dragStart = null;
    if (!wasDragging) return;

    this.suppressNextTileClick = true;
    const stateCode = this.stateCodeAtPoint(event.clientX, event.clientY);
    start.el.style.pointerEvents = '';
    if (stateCode) this.attemptMatch(start.tile, stateCode);
  }

  onTilePointerCancel(event: PointerEvent): void {
    const start = this.dragStart;
    if (start?.pointerId !== event.pointerId) return;
    start.el.style.pointerEvents = '';
    this.dragStart = null;
    this.dragTileKey.set(null);
    this.dragDx.set(0);
    this.dragDy.set(0);
    this.clearHint();
  }

  onTileClick(tile: MatchTile): void {
    if (this.suppressNextTileClick) {
      this.suppressNextTileClick = false;
      return;
    }
    this.selectedTileKey.set(this.selectedTileKey() === tile.key ? null : tile.key);
  }

  onStateTap(target: StateTarget): void {
    const key = this.selectedTileKey();
    if (!key) return;
    const tile = this.round().find((candidate) => candidate.key === key);
    if (tile) this.attemptMatch(tile, target.code);
  }

  stateName(code: string): string {
    return this.states.find((state) => state.code === code)?.name ?? code;
  }

  private stateCodeAtPoint(x: number, y: number): string | null {
    return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-state-code]')?.dataset['stateCode'] ?? null;
  }

  private attemptMatch(tile: MatchTile, stateCode: string): void {
    this.selectedTileKey.set(null);
    if (tile.targetKey === stateCode) {
      this.round.update((tiles) => tiles.filter((candidate) => candidate.key !== tile.key));
      this.placed.update((map) => {
        const next = new Map(map);
        next.set(stateCode, [...(next.get(stateCode) ?? []), tile]);
        return next;
      });
      return;
    }

    this.mistakes.update((count) => count + 1);
    this.flashStateCode.set(stateCode);
    setTimeout(() => {
      if (this.flashStateCode() === stateCode) this.flashStateCode.set(null);
    }, FLASH_MS);
  }

  private clearHint(): void {
    this.clearHintTimer();
    this.hintArmedTileKey.set(null);
    this.hintTileKey.set(null);
  }

  private clearHintTimer(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
  }
}
