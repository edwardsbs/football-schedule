import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FanStore } from '../../core/services/fan-store';
import { TeamBadgeComponent } from '../team-badge/team-badge.component';

/**
 * "My Teams" strip — the favorited teams, pinned atop the schedule views.
 * Each chip can be removed inline; empty state nudges the user to star teams.
 */
@Component({
  selector: 'app-my-teams-strip',
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip">
      <span class="label">My Teams</span>
      @if (fan.favorites().length) {
        <div class="chips">
          @for (team of fan.favorites(); track team.teamId) {
            <span class="chip">
              <app-team-badge [name]="team.displayName" [logoUrl]="team.logoUrl" [abbreviation]="team.abbreviation" [size]="20" />
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
      :host { display: block; }
      .strip {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.7rem;
        margin-bottom: 1rem;
        background: var(--surface, #161a22);
        border: 1px solid var(--border, #262c38);
        border-radius: 10px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
      }
      .label {
        flex: none;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted, #8b93a1);
      }
      .chips { display: flex; gap: 0.4rem; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 40px;
        padding: 0.2rem 0.25rem 0.2rem 0.55rem;
        background: var(--surface-2, #1c212b);
        border: 1px solid var(--border, #262c38);
        border-radius: 999px;
        white-space: nowrap;

        .abbr { font-size: 0.85rem; font-weight: 700; }
        .x {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          min-height: 36px;
          border: none;
          border-radius: 999px;
          background: transparent;
          color: var(--muted, #8b93a1);
          cursor: pointer;
          font-size: 1.15rem;
          line-height: 1;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          &:active { color: #e5484d; background: color-mix(in srgb, #e5484d 16%, transparent); }
        }
      }
      .hint { font-size: 0.88rem; color: var(--muted, #8b93a1); }
    `,
  ],
})
export class MyTeamsStripComponent {
  protected readonly fan = inject(FanStore);
}
