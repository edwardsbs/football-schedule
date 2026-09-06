import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * A team's logo. Renders the real image when a URL is supplied and it loads;
 * otherwise (no URL, or a load error) falls back to a colored monogram badge
 * derived from the team name — so a team never renders blank.
 */
@Component({
  selector: 'app-team-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rank() != null || reserveRankSpace()) {
      <span
        class="rank"
        [class.empty]="rank() == null"
        [attr.aria-label]="rank() == null ? null : 'Rank ' + rank()"
        [attr.aria-hidden]="rank() == null ? 'true' : null"
        [attr.title]="rank() == null ? null : 'Rank ' + rank()"
      >{{ rank() ?? '' }}</span>
    }
    @if (logoUrl() && !failed()) {
      <img
        class="logo"
        [class.needs-contrast]="needsContrast()"
        [src]="logoUrl()"
        [alt]="name()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        crossorigin="anonymous"
        loading="lazy"
        (load)="inspectLogo($event)"
        (error)="failed.set(true); needsContrast.set(false)"
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
        &.empty { visibility: hidden; }
      }
      .logo {
        object-fit: contain;
        &.needs-contrast {
          filter: drop-shadow(0 0 0.65px rgb(218 223 232 / 88%));
        }
      }
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
  readonly reserveRankSpace = input<boolean>(false);

  protected readonly failed = signal(false);
  protected readonly needsContrast = signal(false);

  /** ESPN serves its transparent logos with CORS enabled, so sample only the
   * visible pixels and outline marks that would disappear into the dark UI. */
  protected inspectLogo(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.needsContrast.set(false);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      this.needsContrast.set(needsLightLogoOutline(pixels));
    } catch {
      // Non-CORS custom logos still render normally; they simply skip analysis.
    }
  }

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

export function needsLightLogoOutline(pixels: ArrayLike<number>): boolean {
  let visible = 0;
  let dark = 0;
  let luminanceTotal = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 48) continue;
    const luminance = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
    visible++;
    luminanceTotal += luminance;
    if (luminance < 92) dark++;
  }

  return visible > 8 && (dark / visible >= 0.55 || luminanceTotal / visible < 105);
}
