import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FanStore } from '../../core/services/fan-store';
import { FavoriteTeam } from '../../core/models/game.model';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

interface LeagueGroup {
  label: string;
  teams: FavoriteTeam[];
}

@Component({
  selector: 'app-my-teams',
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h1>My Teams</h1>
      <p class="meta">Teams you follow across NCAA and NFL. Manage favorites from the Conferences page.</p>
    </header>

    @if (fan.favorites().length === 0) {
      <div class="empty">
        <p>You're not following any teams yet.</p>
        <p class="hint">Use the ☆ next to a team on the Conferences page to follow it.</p>
      </div>
    } @else {
      @for (group of groups(); track group.label) {
        @if (group.teams.length) {
          <section class="group">
            <h2>{{ group.label }}</h2>
            <ul class="teams">
              @for (team of group.teams; track team.teamId) {
                <li
                  class="team-highlight favorite-team"
                  [class.ranked-team]="team.currentRank !== null"
                >
                  <app-team-badge [name]="team.displayName" [logoUrl]="team.logoUrl" [abbreviation]="team.abbreviation" [rank]="team.currentRank" [reserveRankSpace]="true" [size]="28" />
                  <span class="name">{{ team.displayName }}</span>
                </li>
              }
            </ul>
          </section>
        }
      }
    }
  `,
  styles: [
    `
      :host { display: block; max-width: 720px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
      .head h1 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; }
      .head .meta { margin: 0.35rem 0 1.5rem; color: var(--muted, #8b93a1); font-size: 0.9rem; }
      .empty { text-align: center; padding: 3rem 1rem; color: var(--muted, #8b93a1); }
      .empty .hint { font-size: 0.85rem; }
      .group { margin-bottom: 1.5rem; }
      .group h2 {
        margin: 0 0 0.5rem;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted, #8b93a1);
      }
      .teams { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
      .teams li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.45rem 0.6rem;
        background: var(--surface, #161a22);
        border: 1px solid var(--border, #262c38);
        border-radius: 8px;
      }
      .teams .name { font-weight: 600; }
    `,
  ],
})
export class MyTeamsComponent {
  protected readonly fan = inject(FanStore);

  readonly groups = computed<LeagueGroup[]>(() => {
    const teams = this.fan.favorites();
    return [
      { label: 'NFL', teams: teams.filter((t) => t.league === 'Nfl') },
      { label: 'NCAA', teams: teams.filter((t) => t.league === 'Ncaa') },
    ];
  });

  constructor() {
    this.fan.reloadFavorites();
  }
}
