import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { MinRecordFilter, TeamFilters } from '../../core/team-filters';

/** The Find Teams bottom sheet, used on the Conferences pages (NFL & NCAA). */
@Component({
  selector: 'app-find-teams-filter',
  templateUrl: './find-teams-filter.component.html',
  styleUrl: './find-teams-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindTeamsFilterComponent {
  readonly open = input(false);
  readonly filters = model.required<TeamFilters>();
  /** Rankings only exist for NCAA (AP/CFP polls don't cover the NFL). */
  readonly league = input<'nfl' | 'ncaa'>('ncaa');
  readonly totalCount = input(0);
  readonly matchCount = input(0);
  readonly closed = output<void>();

  readonly showRankings = computed(() => this.league() === 'ncaa');

  close(): void {
    this.closed.emit();
  }

  setSearch(value: string): void {
    this.filters.update((f) => ({ ...f, search: value }));
  }

  toggleFavoritesOnly(): void {
    this.filters.update((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }));
  }

  toggleInterestOnly(): void {
    this.filters.update((f) => ({ ...f, interestOnly: !f.interestOnly }));
  }

  toggleRankedOnly(): void {
    this.filters.update((f) => ({ ...f, rankedOnly: !f.rankedOnly }));
  }

  setMinRecord(minRecord: MinRecordFilter): void {
    this.filters.update((f) => ({ ...f, minRecord }));
  }

  reset(): void {
    this.filters.set({ search: '', favoritesOnly: false, interestOnly: false, rankedOnly: false, minRecord: 'any' });
  }
}
