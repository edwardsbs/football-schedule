import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * A team's logo. Renders the real image when a URL is supplied and it loads;
 * otherwise (no URL, or a load error) falls back to a colored monogram badge
 * derived from the team name — so a team never renders blank.
 */
@Component({
  selector: 'app-team-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ranked-glow]': 'rank() != null',
    '[class.favorite-glow]': 'glow()',
  },
  template: `
    @if (rank(); as currentRank) {
      <span class="rank" [attr.aria-label]="'Rank ' + currentRank" [attr.title]="'Rank ' + currentRank">{{ currentRank }}</span>
    }
    @if (logoUrl() && !failed()) {
      <img
        class="logo"
        [src]="logoUrl()"
        [alt]="name()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        loading="lazy"
        (error)="failed.set(true)"
      />
    } @else {
      <span
        class="monogram"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.background]="color()"
        [style.font-size.px]="size() * 0.42"
        [attr.title]="name()"
        aria-hidden="true"
      >{{ monogram() }}</span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; align-items: center; gap: 0.3rem; flex: none; }
      .rank {
        min-width: 1.25rem;
        color: var(--muted-strong, #aab2c0);
        font-size: 0.72rem;
        font-weight: 800;
        line-height: 1;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .logo { object-fit: contain; transition: filter 0.18s ease; }
      .monogram {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color: #fff;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
        transition: box-shadow 0.18s ease;
      }
      :host(.ranked-glow) .logo {
        filter: drop-shadow(0 0 2px rgb(76 141 255 / 31%));
      }
      :host(.ranked-glow) .monogram {
        box-shadow: 0 0 4px rgb(76 141 255 / 24%);
      }
      :host(.ranked-glow) .rank {
        color: #77a9ff;
        text-shadow: 0 0 2.5px rgb(76 141 255 / 28%);
      }
      :host(.favorite-glow) .logo {
        filter: drop-shadow(0 0 2px rgb(255 255 255 / 34%));
      }
      :host(.favorite-glow) .monogram {
        box-shadow: 0 0 4px rgb(255 255 255 / 27%);
      }
    `,
  ],
})
export class TeamBadgeComponent {
  readonly name = input.required<string>();
  readonly logoUrl = input<string | null | undefined>(undefined);
  readonly abbreviation = input<string | null | undefined>(undefined);
  readonly size = input<number>(26);
  readonly rank = input<number | null | undefined>(undefined);
  readonly glow = input<boolean>(false);

  protected readonly failed = signal(false);

  protected readonly monogram = computed(() => {
    const abbr = this.abbreviation();
    if (abbr) return abbr.slice(0, 3).toUpperCase();

    const words = this.name().split(/\s+/).filter(Boolean);
    const letters = words.length >= 2 ? words[0][0] + words[1][0] : this.name().slice(0, 2);
    return letters.toUpperCase();
  });

  /** Stable hue from the team name → a consistent, distinct badge color. */
  protected readonly color = computed(() => {
    const name = this.name();
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 52% 40%)`;
  });
}
