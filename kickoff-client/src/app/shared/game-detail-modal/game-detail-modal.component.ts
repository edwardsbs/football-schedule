import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { GameDetailComponent } from '../../routes/game-detail/game-detail.component';

/**
 * Global "tap a game, see its detail right here" overlay — the whole point is
 * NOT leaving the page you're on. Reads `GameDetailOverlay` directly (no
 * inputs/outputs needed), so any game row/tile anywhere can open it just by
 * injecting the service, and the shell only has to mount this once.
 */
@Component({
  selector: 'app-game-detail-modal',
  imports: [GameDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (overlay.gameId(); as id) {
      <div class="backdrop" (click)="overlay.close()">
        <div class="panel" (click)="$event.stopPropagation()">
          <app-game-detail [id]="id.toString()" [embedded]="true" (closeRequested)="overlay.close()" />
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(4, 6, 9, 0.65);
      }
      .panel {
        width: min(92vw, 860px);
        max-height: 90vh;
        overflow-y: auto;
        background: var(--bg, #0f1218);
        border: 1px solid var(--border, #262c38);
        border-radius: 14px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class GameDetailModalComponent {
  protected readonly overlay = inject(GameDetailOverlay);
}
