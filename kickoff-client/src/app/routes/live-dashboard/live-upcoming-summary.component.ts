import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Game } from '../../core/models/game.model';
import { FanStore } from '../../core/services/fan-store';

@Component({
  selector: 'app-live-upcoming-summary',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-upcoming-summary.component.html',
  styleUrl: './live-upcoming-summary.component.scss',
})
export class LiveUpcomingSummaryComponent {
  protected readonly fan = inject(FanStore);
  readonly game = input.required<Game>();
  readonly today = input(false);
  readonly countdown = input<string | null>(null);
}
