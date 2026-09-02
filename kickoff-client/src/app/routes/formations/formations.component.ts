import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEFENSE_FORMATIONS, OFFENSE_FORMATIONS } from '../../core/data/formations.data';

/**
 * Common offensive and defensive formations — where each position lines up
 * relative to the line of scrimmage, and a one-line "why" for each.
 */
@Component({
  selector: 'app-formations',
  imports: [RouterLink],
  templateUrl: './formations.component.html',
  styleUrl: './formations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormationsComponent {
  readonly side = input.required<string>();

  readonly isDefense = computed(() => this.side() === 'defense');
  readonly formations = computed(() => (this.isDefense() ? DEFENSE_FORMATIONS : OFFENSE_FORMATIONS));
}
