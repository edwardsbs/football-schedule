import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { FanStore } from '../core/services/fan-store';
import { MyGamesModalComponent } from '../shared/my-games-modal/my-games-modal.component';
import { GameDetailModalComponent } from '../shared/game-detail-modal/game-detail-modal.component';

interface NavLink {
  path: string;
  label: string;
  /** Exact match only (e.g. the merged views), otherwise prefix match. */
  exact?: boolean;
}

const MIN_THUMB_PX = 40;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * App shell: fixed top bar, scrollable content, and a custom-drawn overlay
 * scrollbar (not the native `::-webkit-scrollbar`, which turned out to be at
 * the mercy of the OS/browser's own scrollbar mode and never reliably widened
 * on this kiosk). It mirrors `.content`'s real scroll position/size via a
 * ResizeObserver + MutationObserver, so it works identically everywhere and
 * supports drag-to-scroll for touch.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MyGamesModalComponent, GameDetailModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements AfterViewInit, OnDestroy {
  readonly myGamesOpen = signal(false);

  private readonly contentEl = viewChild.required<ElementRef<HTMLDivElement>>('contentEl');
  private readonly trackEl = viewChild.required<ElementRef<HTMLDivElement>>('trackEl');

  readonly scrollable = signal(false);
  readonly thumbHeightPx = signal(MIN_THUMB_PX);
  readonly thumbTopPx = signal(0);

  /** Cached from the last size measurement, so scroll-driven updates stay cheap. */
  private viewportHeight = 0;
  private trackHeight = 0;
  private contentTotal = 0;

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private measurePending = false;

  private dragging = false;
  private dragStartY = 0;
  private dragStartScrollTop = 0;

  constructor() {
    inject(FanStore).load();

    /** Tapping into a game (e.g. from the My Games modal) should close it, not leave it stranded on top. */
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.myGamesOpen.set(false));
  }

  ngAfterViewInit(): void {
    const el = this.contentEl().nativeElement;

    this.measureSize();

    this.resizeObserver = new ResizeObserver(() => this.queueMeasure());
    this.resizeObserver.observe(el);
    this.resizeObserver.observe(this.trackEl().nativeElement);

    this.mutationObserver = new MutationObserver(() => this.queueMeasure());
    this.mutationObserver.observe(el, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  private queueMeasure(): void {
    if (this.measurePending) return;
    this.measurePending = true;
    requestAnimationFrame(() => {
      this.measurePending = false;
      this.measureSize();
    });
  }

  private measureSize(): void {
    const el = this.contentEl().nativeElement;
    this.viewportHeight = el.clientHeight;
    this.trackHeight = this.trackEl().nativeElement.clientHeight;
    this.contentTotal = el.scrollHeight;

    this.scrollable.set(this.contentTotal > this.viewportHeight + 1);
    const ratio = this.contentTotal > 0 ? this.viewportHeight / this.contentTotal : 1;
    const minimum = Math.min(MIN_THUMB_PX, this.trackHeight);
    this.thumbHeightPx.set(clamp(this.trackHeight * ratio, minimum, this.trackHeight));
    this.updateThumbPosition(el.scrollTop);
  }

  private updateThumbPosition(scrollTop: number): void {
    const maxScroll = this.contentTotal - this.viewportHeight;
    const maxTravel = this.trackHeight - this.thumbHeightPx();
    const progress = maxScroll > 0 ? clamp(scrollTop / maxScroll, 0, 1) : 0;
    this.thumbTopPx.set(progress * Math.max(0, maxTravel));
  }

  onScroll(): void {
    this.updateThumbPosition(this.contentEl().nativeElement.scrollTop);
  }

  /** Tap the track above/below the thumb to page up/down. */
  onTrackPointerDown(ev: PointerEvent): void {
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const clickY = ev.clientY - rect.top;
    const direction = clickY < this.thumbTopPx() ? -1 : 1;
    this.contentEl().nativeElement.scrollBy({ top: direction * this.viewportHeight * 0.8, behavior: 'smooth' });
  }

  onThumbPointerDown(ev: PointerEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    this.dragging = true;
    this.dragStartY = ev.clientY;
    this.dragStartScrollTop = this.contentEl().nativeElement.scrollTop;
  }

  onThumbPointerMove(ev: PointerEvent): void {
    if (!this.dragging) return;
    const maxScroll = this.contentTotal - this.viewportHeight;
    const maxTravel = this.trackHeight - this.thumbHeightPx();
    if (maxTravel <= 0 || maxScroll <= 0) return;

    const deltaY = ev.clientY - this.dragStartY;
    const scrollDelta = (deltaY / maxTravel) * maxScroll;
    this.contentEl().nativeElement.scrollTop = clamp(this.dragStartScrollTop + scrollDelta, 0, maxScroll);
  }

  onThumbPointerUp(ev: PointerEvent): void {
    this.dragging = false;
  }

  nudge(direction: 1 | -1): void {
    this.contentEl().nativeElement.scrollBy({ top: direction * 140, behavior: 'smooth' });
  }

  readonly links: NavLink[] = [
    { path: '/live', label: 'Live' },
    { path: '/week', label: 'Week' },
    { path: '/day', label: 'Day' },
    { path: '/season/ncaa', label: 'NCAA' },
    { path: '/season/nfl', label: 'NFL' },
    { path: '/conferences/ncaa', label: 'Conferences' },
    { path: '/upcoming', label: 'Upcoming' },
    { path: '/my-teams', label: 'My Teams' },
    { path: '/formations/offense', label: 'Formations' },
    { path: '/routes', label: 'Route Tree' },
    { path: '/playoffs/ncaa', label: 'CFP Bracket' },
    { path: '/playoffs/nfl', label: 'Super Bowl' },
  ];
}
