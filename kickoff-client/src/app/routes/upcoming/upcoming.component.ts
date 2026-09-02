import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';
import { FanStore } from '../../core/services/fan-store';
import { Game } from '../../core/models/game.model';
import { GameRowComponent } from '../../shared/game-row/game-row.component';

@Component({
  selector: 'app-upcoming',
  imports: [DatePipe, GameRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h1>Upcoming</h1>
      <p class="meta">Games you've circled, soonest first. Tap the circle on any game to add it here.</p>
    </header>

    @if (games().length === 0) {
      <div class="empty">
        <p>No circled games yet.</p>
        <p class="hint">Tap ○ on a game in Live, Day, or Week to circle it.</p>
      </div>
    } @else {
      <div class="list">
        @for (game of games(); track game.id) {
          <div class="item">
            <div class="cd" [class.soon]="isSoon(game)" [class.started]="game.status !== 'Upcoming'">
              <span class="big">{{ countdown(game) }}</span>
              <span class="when">{{ game.kickoffUtc | date: 'EEE, MMM d · h:mm a' }}</span>
            </div>
            <app-game-row [game]="game" (changed)="refresh()" />
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; max-width: 820px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
      .head h1 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; }
      .head .meta { margin: 0.35rem 0 1.25rem; color: var(--muted, #8b93a1); font-size: 0.9rem; }
      .empty { text-align: center; padding: 3rem 1rem; color: var(--muted, #8b93a1); }
      .empty .hint { font-size: 0.85rem; }
      .list { display: flex; flex-direction: column; gap: 0.6rem; }
      .item {
        background: var(--surface, #161a22);
        border: 1px solid var(--border, #262c38);
        border-radius: 10px;
        padding: 0.5rem 0.6rem;
      }
      .cd {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        padding: 0.1rem 0.3rem 0.35rem;
        .big {
          font-size: 1.05rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          color: var(--accent-gold, #c9a227);
        }
        .when { font-size: 0.78rem; color: var(--muted, #8b93a1); }
        &.soon .big { color: #e5484d; }
        &.started .big { color: #4c8dff; }
      }
    `,
  ],
})
export class UpcomingComponent {
  protected readonly fan = inject(FanStore);

  private readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  readonly games = computed(() => this.fan.circled());

  constructor() {
    this.fan.reloadCircled();
  }

  refresh(): void {
    this.fan.reloadCircled();
  }

  isSoon(g: Game): boolean {
    if (g.status !== 'Upcoming') return false;
    const diff = new Date(g.kickoffUtc).getTime() - this.now();
    return diff > 0 && diff < 3_600_000; // within the hour
  }

  countdown(g: Game): string {
    if (g.status === 'Live') return 'Live now';
    if (g.status === 'Final') return 'Final';
    if (g.status === 'Postponed') return 'Postponed';
    if (g.status === 'Canceled') return 'Canceled';

    const diff = new Date(g.kickoffUtc).getTime() - this.now();
    if (diff <= 0) return 'Kickoff!';

    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86_400);
    const h = Math.floor((s % 86_400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `in ${d}d ${h}h`;
    if (h > 0) return `in ${h}h ${m}m`;
    if (m > 0) return `in ${m}m ${sec}s`;
    return `in ${sec}s`;
  }
}
