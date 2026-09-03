import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FanStore } from '../../core/services/fan-store';
import { TeamBadgeComponent } from '../team-badge/team-badge.component';

/**
 * "My Teams" strip — the favorited teams, pinned atop the schedule views.
 * Each chip can be removed inline; empty state nudges the user to star teams.
 * `inline` drops the standalone block's bottom margin and lets it shrink as a
 * flex item, for callers that fold it into an existing filter row instead of
 * giving it its own line.
 */
@Component({
  selector: 'app-my-teams-strip',
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.inline]': 'inline()' },
  template: `
    <div class="strip">
      @if (fan.favorites().length) {
        <span class="label">Mine</span>
        <div class="chips">
          @for (team of fan.favorites(); track team.teamId) {
            <span class="chip">
              <app-team-badge [name]="team.displayName" [logoUrl]="team.logoUrl" [abbreviation]="team.abbreviation" [size]="16" />
              <span class="abbr">{{ team.abbreviation }}</span>
              <button
                type="button"
                class="x"
                [attr.aria-label]="'Unfollow ' + team.displayName"
                (click)="fan.toggleFavorite(team.teamId)"
              >×</button>
            </span>
          }
        </div>
      } @else {
        <span class="hint">Tap ☆ on any team to pin it here.</span>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; margin-bottom: 1rem; }
      :host(.inline) { margin-bottom: 0; min-width: 0; flex: 1 1 200px; }
      .strip {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-width: 0;
        padding: 0.2rem 0.5rem;
        background: var(--surface, #161a22);
        border: 1px solid var(--border, #262c38);
        border-radius: 999px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        &::-webkit-scrollbar { display: none; }
      }
      .label {
        flex: none;
        font-size: 0.6rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted, #8b93a1);
      }
      .chips { display: flex; gap: 0.3rem; flex: none; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        min-height: 32px;
        padding: 0.1rem 0.1rem 0.1rem 0.4rem;
        background: var(--surface-2, #1c212b);
        border: 1px solid var(--border, #262c38);
        border-radius: 999px;
        white-space: nowrap;

        .abbr { font-size: 0.76rem; font-weight: 700; }
        .x {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          min-height: 30px;
          border: none;
          border-radius: 999px;
          background: transparent;
          color: var(--muted, #8b93a1);
          cursor: pointer;
          font-size: 1rem;
          line-height: 1;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          &:active { color: #e5484d; background: color-mix(in srgb, #e5484d 16%, transparent); }
        }
      }
      .hint { font-size: 0.8rem; color: var(--muted, #8b93a1); white-space: nowrap; }
    `,
  ],
})
export class MyTeamsStripComponent {
  protected readonly fan = inject(FanStore);
  readonly inline = input(false);
}
