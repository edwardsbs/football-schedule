import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isLeagueKey } from '../../core/data/alignment-lookup';

@Component({
  selector: 'app-season-schedule',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stub">
      <h1>{{ leagueLabel() }} Season</h1>
      <p>Full season schedule by week, filterable by {{ filterLabel() }} / team.</p>
      <ul>
        <li>"My Teams" strip pinned to the top.</li>
        <li>
          Filter groups come from the
          <a [routerLink]="['/conferences', league()]">{{ leagueLabel() }} conference alignment</a>.
        </li>
      </ul>
      <p class="tag">Placeholder — schedule data arrives with the SportsRadar sync.</p>
    </section>
  `,
  styleUrl: '../shared/stub.scss',
})
export class SeasonScheduleComponent {
  readonly league = input.required<string>();

  readonly leagueLabel = computed(() =>
    isLeagueKey(this.league()) ? this.league().toUpperCase() : 'Unknown',
  );

  readonly filterLabel = computed(() => (this.league() === 'nfl' ? 'division' : 'conference'));
}
