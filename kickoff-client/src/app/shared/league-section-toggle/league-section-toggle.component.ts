import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type LeagueSection = 'schedule' | 'conference';

/** Switches between the two primary views that belong to an NCAA or NFL tab. */
@Component({
  selector: 'app-league-section-toggle',
  imports: [RouterLink],
  template: `
    <nav class="league-section-toggle" [attr.aria-label]="league().toUpperCase() + ' view'">
      <a
        [routerLink]="['/season', league()]"
        [class.active]="activeSection() === 'schedule'"
        [attr.aria-current]="activeSection() === 'schedule' ? 'page' : null"
      >Schedule</a>
      <a
        [routerLink]="['/conferences', league()]"
        [class.active]="activeSection() === 'conference'"
        [attr.aria-current]="activeSection() === 'conference' ? 'page' : null"
      >Conferences</a>
    </nav>
  `,
  styleUrl: './league-section-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueSectionToggleComponent {
  readonly league = input.required<string>();
  readonly activeSection = input.required<LeagueSection>();
}
