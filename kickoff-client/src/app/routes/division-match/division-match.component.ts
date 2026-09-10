import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import {
  MatchLeague,
  MatchTarget,
  MatchTile,
  matchTargets,
  matchTilePool,
  pickRound,
} from './division-match-data';

export type RoundSize = 'quick' | 'standard' | 'full';

/** NCAA's much larger pool (dozens of conferences worth of teams vs. the
 * NFL's fixed 32) earns its own, bigger fixed round sizes. */
const FIXED_ROUND_SIZES: Record<MatchLeague, Record<'quick' | 'standard', number>> = {
  nfl: { quick: 8, standard: 12 },
  ncaa: { quick: 32, standard: 64 },
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

/** A touch-first drag-and-drop mini-game: place each team into its real
 * conference or division. Built entirely from the same static alignment data
 * the Conferences page uses -- no backend calls, so it's playable offline. */
@Component({
  selector: 'app-division-match',
  imports: [RouterLink, TeamBadgeComponent],
  templateUrl: './division-match.component.html',
  styleUrl: './division-match.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DivisionMatchComponent {
  readonly league = input.required<string>();
  readonly matchLeague = computed<MatchLeague>(() => (this.league() === 'nfl' ? 'nfl' : 'ncaa'));
  readonly leagueLabel = computed(() => (this.matchLeague() === 'nfl' ? 'NFL' : 'NCAA'));
  readonly groupWord = computed(() => (this.matchLeague() === 'nfl' ? 'division' : 'conference'));

  readonly targets = computed(() => matchTargets(this.matchLeague()));
  private readonly pool = computed(() => matchTilePool(this.matchLeague()));
  readonly poolSize = computed(() => this.pool().length);
  readonly quickSize = computed(() => Math.min(FIXED_ROUND_SIZES[this.matchLeague()].quick, this.poolSize()));
  readonly standardSize = computed(() => Math.min(FIXED_ROUND_SIZES[this.matchLeague()].standard, this.poolSize()));

  readonly roundSize = signal<RoundSize>('standard');
  readonly round = signal<MatchTile[]>([]);
  /** A target can rightfully hold several teams (e.g. 4 per NFL division), so
   * this holds every correctly-placed tile per target, not just the latest. */
  readonly placed = signal<Map<string, MatchTile[]>>(new Map());
  readonly mistakes = signal(0);
  readonly totalTiles = signal(0);

  readonly selectedTileKey = signal<string | null>(null);
  readonly flashTargetKey = signal<string | null>(null);
  readonly dragTileKey = signal<string | null>(null);
  private readonly dragDx = signal(0);
  private readonly dragDy = signal(0);
  readonly dragTransform = computed(() => `translate(${this.dragDx()}px, ${this.dragDy()}px)`);

  /** "Hold to peek" (same convention as the live dashboard's muted-score
   * reveal): holding a tile builds a progress glow, and past HINT_HOLD_MS
   * reveals its correct target by highlighting that target box. Releasing
   * hides it again immediately, same as the existing peek pattern. */
  readonly hintArmedTileKey = signal<string | null>(null);
  readonly hintTileKey = signal<string | null>(null);
  readonly hintTargetKey = computed(() => {
    const key = this.hintTileKey();
    if (!key) return null;
    return this.round().find((t) => t.key === key)?.targetKey ?? null;
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
    // Reruns whenever the :league route param changes -- the router reuses
    // this component instance when only the param changes (e.g. switching
    // leagues via the in-page nav), so without this the board would keep
    // showing the previous league's tiles under the new one's targets.
    effect(() => {
      this.matchLeague();
      untracked(() => this.newRound(this.roundSize()));
    });
    this.destroyRef.onDestroy(() => this.clearHintTimer());
  }

  newRound(size: RoundSize = this.roundSize()): void {
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
      this.clearHint(); // A real drag isn't a hold -- don't also reveal the hint.
      // Set synchronously via the DOM, not just the [class.dragging] binding:
      // Angular applies class bindings on its own change-detection schedule,
      // and elementFromPoint() at drop time needs this to already be in
      // effect the instant it runs, or it hits the dragged tile (now sitting
      // right under the pointer) instead of the target underneath it.
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

    if (!wasDragging) return; // A plain tap falls through to the (click) handler.

    this.suppressNextTileClick = true;
    // Hit-test BEFORE restoring pointer-events, or elementFromPoint hits the
    // tile itself again instead of whatever is underneath it.
    const targetKey = this.targetKeyAtPoint(event.clientX, event.clientY);
    start.el.style.pointerEvents = '';
    if (targetKey) this.attemptMatch(start.tile, targetKey);
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

  private clearHint(): void {
    this.clearHintTimer();
    this.hintArmedTileKey.set(null);
    this.hintTileKey.set(null);
  }

  private clearHintTimer(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
  }

  /** Tap-to-select fallback (and free keyboard support, since it fires on
   * Enter/Space too) -- ignored right after a real drag-release so a drag
   * doesn't also toggle selection via its trailing synthetic click. */
  onTileClick(tile: MatchTile): void {
    if (this.suppressNextTileClick) {
      this.suppressNextTileClick = false;
      return;
    }
    this.selectedTileKey.set(this.selectedTileKey() === tile.key ? null : tile.key);
  }

  onTargetTap(target: MatchTarget): void {
    const key = this.selectedTileKey();
    if (!key) return;
    const tile = this.round().find((t) => t.key === key);
    if (tile) this.attemptMatch(tile, target.key);
  }

  private targetKeyAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const target = el?.closest<HTMLElement>('[data-target-key]');
    return target?.dataset['targetKey'] ?? null;
  }

  private attemptMatch(tile: MatchTile, targetKey: string): void {
    this.selectedTileKey.set(null);

    if (tile.targetKey === targetKey) {
      this.round.update((tiles) => tiles.filter((t) => t.key !== tile.key));
      this.placed.update((map) => {
        const next = new Map(map);
        next.set(targetKey, [...(next.get(targetKey) ?? []), tile]);
        return next;
      });
      return;
    }

    this.mistakes.update((n) => n + 1);
    this.flashTargetKey.set(targetKey);
    setTimeout(() => {
      if (this.flashTargetKey() === targetKey) this.flashTargetKey.set(null);
    }, FLASH_MS);
  }
}
