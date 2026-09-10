import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-mini-games',
  imports: [RouterLink],
  templateUrl: './mini-games.component.html',
  styleUrl: './mini-games.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniGamesComponent {}
