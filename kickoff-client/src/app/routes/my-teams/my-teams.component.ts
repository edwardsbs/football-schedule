import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FanStore } from '../../core/services/fan-store';
import { FavoriteTeam, TeamInterest } from '../../core/models/game.model';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

interface TeamCollection {
  label: string;
  kind: 'favorite' | 'interest';
  teams: Array<FavoriteTeam | TeamInterest>;
}

@Component({
  selector: 'app-my-teams',
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h1>My Teams</h1>
      <p class="meta">Favorites and teams you want to monitor across NCAA and NFL. Manage both from Conferences.</p>
    </header>

    @if (fan.favorites().length === 0 && fan.interests().length === 0) {
      <div class="empty">
        <p>You haven't marked any teams yet.</p>
        <p class="hint">Use ☆ for a favorite or ◇ for a team of interest on Conferences.</p>
      </div>
    } @else {
      @for (collection of collections(); track collection.kind) {
        @if (collection.teams.length) {
          <section class="group">
            <h2>
              <span [class.interest-symbol]="collection.kind === 'interest'">{{ collection.kind === 'favorite' ? '★' : '◆' }}</span>
              {{ collection.label }}
            </h2>
            <ul class="teams">
              @for (team of collection.teams; track team.teamId) {
                <li
                  class="team-highlight"
                  [class.favorite-team]="collection.kind === 'favorite'"
                  [class.interest-team]="collection.kind === 'interest'"
                  [class.ranked-team]="team.currentRank !== null"
                >
                  <app-team-badge [name]="team.displayName" [logoUrl]="team.logoUrl" [abbreviation]="team.abbreviation" [rank]="team.currentRank" [reserveRankSpace]="true" [size]="28" />
                  <span class="name">{{ team.displayName }}</span>
                  <span class="league">{{ team.league === 'Nfl' ? 'NFL' : 'NCAA' }}</span>
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
      .group h2 span { color: #c9a227; }
      .group h2 .interest-symbol { color: #49b8b8; }
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
      .teams .league {
        margin-left: auto;
        color: var(--muted, #8b93a1);
        font-size: 0.62rem;
        font-weight: 800;
      }
    `,
  ],
})
export class MyTeamsComponent {
  protected readonly fan = inject(FanStore);

  readonly collections = computed<TeamCollection[]>(() => {
    return [
      { label: 'Favorites', kind: 'favorite', teams: this.fan.favorites() },
      { label: 'Teams of Interest', kind: 'interest', teams: this.fan.interests() },
    ];
  });

  constructor() {
    this.fan.reloadFavorites();
    this.fan.reloadInterests();
  }
}
