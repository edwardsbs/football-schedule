import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PLAYOFF_STATUS_LABEL, PlayoffStatus } from '../../core/nfl-playoff-picture';

/** One padlock glyph shared across every state: closed and gold once
 * something's decided, open and dashed grey while it's still live, or
 * struck-through red once a team is out. A badge dot on the lock says
 * exactly how decided -- see the component stylesheet for the palette. */
@Component({
  selector: 'app-playoff-status-icon',
  templateUrl: './playoff-status-icon.component.html',
  styleUrl: './playoff-status-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayoffStatusIconComponent {
  readonly status = input.required<PlayoffStatus>();
  readonly label = computed(() => PLAYOFF_STATUS_LABEL[this.status()]);
}
