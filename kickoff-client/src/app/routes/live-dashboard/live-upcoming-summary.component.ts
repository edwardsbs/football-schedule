import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Game } from '../../core/models/game.model';

@Component({
  selector: 'app-live-upcoming-summary',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-upcoming-summary.component.html',
  styleUrl: './live-upcoming-summary.component.scss',
})
export class LiveUpcomingSummaryComponent {
  readonly game = input.required<Game>();
  readonly today = input(false);
  readonly countdown = input<string | null>(null);
}
