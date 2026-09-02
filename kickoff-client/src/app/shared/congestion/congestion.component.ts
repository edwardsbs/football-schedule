import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface CongestionBar {
  label: string;
  count: number;
  highlight?: boolean;
}

/**
 * Kickoff-congestion strip: one bar per slot, height ∝ game count. Shows how
 * many games overlap at each kickoff (e.g. "12 games at 1:00").
 */
@Component({
  selector: 'app-congestion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="congestion" role="img" [attr.aria-label]="'Games per kickoff slot'">
      @for (bar of bars(); track bar.label) {
        <div class="col" [class.hot]="bar.highlight" [title]="bar.count + ' games · ' + bar.label">
          <span class="count">{{ bar.count }}</span>
          <span class="bar" [style.height.px]="barPx(bar.count)"></span>
          <span class="label">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .congestion {
        display: flex;
        align-items: flex-end;
        gap: 0.4rem;
        overflow-x: auto;
        padding: 0.5rem 0.25rem 0;
        min-height: 96px;
      }
      .col {
        flex: 1 0 34px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        min-width: 34px;
      }
      .count {
        font-size: 0.72rem;
        font-weight: 800;
        color: var(--muted-strong, #aab2c0);
        font-variant-numeric: tabular-nums;
      }
      .bar {
        width: 70%;
        min-height: 3px;
        border-radius: 3px 3px 0 0;
        background: linear-gradient(var(--accent-gold, #c9a227), color-mix(in srgb, var(--accent-gold, #c9a227) 55%, transparent));
      }
      .col.hot .bar { background: linear-gradient(#e5484d, #a5343a); }
      .label {
        font-size: 0.62rem;
        color: var(--muted, #8b93a1);
        white-space: nowrap;
        text-align: center;
      }
    `,
  ],
})
export class CongestionComponent {
  readonly bars = input.required<CongestionBar[]>();
  /** Bar area height in px that the busiest slot fills. */
  readonly maxHeight = input<number>(64);

  private readonly peak = computed(() => Math.max(1, ...this.bars().map((b) => b.count)));

  protected barPx(count: number): number {
    return Math.max(3, Math.round((count / this.peak()) * this.maxHeight()));
  }
}
