import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

export interface WeekStripItem {
  key: string | number;
  label: string;
  range: string;
  active: boolean;
}

/** Pointer movement below this (px) still counts as a tap, not a drag. */
const DRAG_THRESHOLD_PX = 6;

/**
 * ESPN-style horizontally scrollable week picker: one chip per week (label +
 * date range), the active one highlighted and auto-scrolled into view, arrows
 * at the ends. Purely presentational -- the caller decides what a "week" is
 * (a real provider week, a rolling calendar week, whatever) and which one is
 * active; this just renders the strip and reports taps.
 *
 * The chip strip also supports click-and-drag / touch-drag panning (this is a
 * kiosk touch app, and mice have no native way to pan an overflow container
 * short of a visible scrollbar). Pointer capture is only engaged once the
 * pointer has actually moved past a small threshold, so a plain tap still
 * reaches the chip's own click handler untouched.
 */
@Component({
  selector: 'app-week-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-strip.component.html',
  styleUrl: './week-strip.component.scss',
})
export class WeekStripComponent {
  readonly items = input.required<WeekStripItem[]>();
  readonly canPrev = input(true);
  readonly canNext = input(true);

  readonly pick = output<string | number>();
  readonly prev = output<void>();
  readonly next = output<void>();

  private readonly chipsEl = viewChild<ElementRef<HTMLElement>>('chipsEl');

  private activePointerId: number | null = null;
  private dragStartX = 0;
  private dragStartScrollLeft = 0;
  private dragMoved = false;
  private lastCenteredKey: string | number | undefined;

  constructor() {
    effect(() => {
      const activeKey = this.items().find((i) => i.active)?.key;
      // Live-score overlays replace the input array on every poll. Centering the
      // same active chip again makes scrollIntoView move the outer schedule back
      // toward the top while somebody is reading games farther down the page.
      if (activeKey === undefined || activeKey === this.lastCenteredKey) return;
      this.lastCenteredKey = activeKey;
      queueMicrotask(() => {
        const container = this.chipsEl()?.nativeElement;
        const active = container?.querySelector('.week-chip.active');
        active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });
  }

  onChipsPointerDown(ev: PointerEvent): void {
    this.activePointerId = ev.pointerId;
    this.dragStartX = ev.clientX;
    this.dragStartScrollLeft = this.chipsEl()!.nativeElement.scrollLeft;
    this.dragMoved = false;
  }

  onChipsPointerMove(ev: PointerEvent): void {
    if (ev.pointerId !== this.activePointerId) return;
    const el = this.chipsEl()!.nativeElement;
    const delta = ev.clientX - this.dragStartX;

    // Only claim the gesture (and pointer capture) once it's clearly a drag --
    // capturing on every pointerdown would swallow plain taps on the chips.
    if (!this.dragMoved && Math.abs(delta) > DRAG_THRESHOLD_PX) {
      this.dragMoved = true;
      el.setPointerCapture(ev.pointerId);
    }
    if (this.dragMoved) {
      el.scrollLeft = this.dragStartScrollLeft - delta;
    }
  }

  onChipsPointerUp(ev: PointerEvent): void {
    if (ev.pointerId !== this.activePointerId) return;
    const el = this.chipsEl()!.nativeElement;
    if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    this.activePointerId = null;
  }

  /** Suppresses the tap that would otherwise fire right after a drag. */
  onChipClick(key: string | number, ev: MouseEvent): void {
    if (this.dragMoved) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    this.pick.emit(key);
  }
}
