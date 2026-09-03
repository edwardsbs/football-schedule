import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

export interface WeekStripItem {
  key: string | number;
  label: string;
  range: string;
  active: boolean;
}

/**
 * ESPN-style horizontally scrollable week picker: one chip per week (label +
 * date range), the active one highlighted and auto-scrolled into view, arrows
 * at the ends. Purely presentational -- the caller decides what a "week" is
 * (a real provider week, a rolling calendar week, whatever) and which one is
 * active; this just renders the strip and reports taps.
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

  constructor() {
    effect(() => {
      const activeKey = this.items().find((i) => i.active)?.key;
      if (activeKey === undefined) return;
      queueMicrotask(() => {
        const container = this.chipsEl()?.nativeElement;
        const active = container?.querySelector('.week-chip.active');
        active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });
  }
}
