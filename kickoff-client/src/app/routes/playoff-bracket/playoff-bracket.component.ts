import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getPlayoffBracket } from '../../core/data/playoff-brackets.data';

@Component({
  selector: 'app-playoff-bracket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './playoff-bracket.component.html',
  styleUrl: './playoff-bracket.component.scss',
})
export class PlayoffBracketComponent {
  readonly league = input.required<string>();
  protected readonly bracket = computed(() => getPlayoffBracket(this.league()));
}
