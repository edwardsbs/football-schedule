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
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { FanStore } from '../core/services/fan-store';
import { LiveGameStore } from '../core/services/live-game-store';
import { MyGamesModalComponent } from '../shared/my-games-modal/my-games-modal.component';
import { GameDetailModalComponent } from '../shared/game-detail-modal/game-detail-modal.component';

interface NavLink {
  path: string;
  label: string;
  /** Exact match only (e.g. the merged views), otherwise prefix match. */
  exact?: boolean;
  /** Keeps the league tab active for both its schedule and conference view. */
  leagueSection?: 'ncaa' | 'nfl';
  leagueLogo?: string;
  logoOnly?: boolean;
  startsGroup?: boolean;
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
  imports: [RouterOutlet, RouterLink, MyGamesModalComponent, GameDetailModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements AfterViewInit, OnDestroy {
  readonly myGamesOpen = signal(false);
  readonly wipeSeconds = signal(0);
  readonly currentUrl = signal('/');

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
  private wipeTimerId: number | null = null;

  constructor() {
    inject(FanStore).load();
    // Start the one shared live-score poll for every routed screen.
    inject(LiveGameStore);

    /** Tapping into a game (e.g. from the My Games modal) should close it, not leave it stranded on top. */
    const router = inject(Router);
    this.currentUrl.set(router.url);

    router
      .events.pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.myGamesOpen.set(false));

    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe((e) => this.currentUrl.set(e.urlAfterRedirects));
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
    this.stopWipeTimer();
  }

  startWipe(): void {
    if (this.wipeSeconds() > 0) return;

    const unlockAt = Date.now() + 10_000;
    this.wipeSeconds.set(10);
    this.wipeTimerId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1_000));
      this.wipeSeconds.set(remaining);
      if (remaining === 0) this.stopWipeTimer();
    }, 200);
  }

  private stopWipeTimer(): void {
    if (this.wipeTimerId === null) return;
    window.clearInterval(this.wipeTimerId);
    this.wipeTimerId = null;
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
    { path: '/season/nfl', label: 'NFL', leagueSection: 'nfl', leagueLogo: '/nfl-logo.png' },
    {
      path: '/season/ncaa',
      label: 'NCAA',
      leagueSection: 'ncaa',
      leagueLogo: '/ncaa-wordmark.png',
      logoOnly: true,
    },
    { path: '/live', label: 'Live', startsGroup: true },
    { path: '/day', label: 'Day' },
    { path: '/week', label: 'Week' },
    { path: '/upcoming', label: 'Upcoming' },
    { path: '/my-teams', label: 'My Teams' },
    { path: '/playoffs/nfl', label: 'Super Bowl' },
    { path: '/playoffs/ncaa', label: 'CFP Bracket' },
    { path: '/formations/offense', label: 'Formations' },
    { path: '/routes', label: 'Route Tree' },
  ];

  isLinkActive(link: NavLink): boolean {
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    if (link.leagueSection) {
      return path === `/season/${link.leagueSection}` || path === `/conferences/${link.leagueSection}`;
    }
    return link.exact ? path === link.path : path === link.path || path.startsWith(`${link.path}/`);
  }
}
