import { ChangeDetectionStrategy, Component, computed, inject, input, model, output } from '@angular/core';
import { GameFilters, GameLeagueFilter, RankScope } from '../../core/game-filters';
import { TeamConferenceStore } from '../../core/services/team-conference-store';

/**
 * The Find Games bottom sheet. Each page (Day, Week, Season Schedule, Game Day
 * Central) owns its own `GameFilters` signal and its own "Filters" trigger
 * chip -- this component is just the sheet, matching how the existing "My
 * games" chip is already duplicated per page rather than centralized.
 */
@Component({
  selector: 'app-find-games-filter',
  templateUrl: './find-games-filter.component.html',
  styleUrl: './find-games-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindGamesFilterComponent {
  private readonly conferences = inject(TeamConferenceStore);

  readonly open = input(false);
  readonly filters = model.required<GameFilters>();
  /** Set on Season Schedule, where the route already fixes the league -- hides
   * the League row and scopes the conference/division chips to that league. */
  readonly fixedLeague = input<GameLeagueFilter | null>(null);
  readonly totalCount = input(0);
  readonly matchCount = input(0);
  readonly closed = output<void>();

  readonly effectiveLeague = computed(() => this.fixedLeague() ?? this.filters().league);
  readonly groupOptions = computed(() => {
    const league = this.effectiveLeague();
    return league === 'all' ? [] : this.conferences.groupOptions(league);
  });

  close(): void {
    this.closed.emit();
  }

  setLeague(league: GameLeagueFilter): void {
    this.filters.update((f) => ({ ...f, league, groups: [] }));
  }

  toggleGroup(group: string): void {
    this.filters.update((f) => ({
      ...f,
      groups: f.groups.includes(group) ? f.groups.filter((g) => g !== group) : [...f.groups, group],
    }));
  }

  setRankScope(rankScope: RankScope): void {
    this.filters.update((f) => ({ ...f, rankScope }));
  }

  toggleSameGroup(): void {
    this.filters.update((f) => ({ ...f, sameGroupOnly: !f.sameGroupOnly }));
  }

  setKickoffAfter(hour: number | null): void {
    this.filters.update((f) => ({ ...f, kickoffAfterHour: hour }));
  }

  toggleHideCompleted(): void {
    this.filters.update((f) => ({ ...f, hideCompleted: !f.hideCompleted }));
  }

  toggleKeepMine(): void {
    this.filters.update((f) => ({ ...f, keepMineWhenHidden: !f.keepMineWhenHidden }));
  }

  toggleElite(): void {
    this.filters.update((f) => ({ ...f, eliteRecordsOnly: !f.eliteRecordsOnly }));
  }

  toggleUndefeated(): void {
    this.filters.update((f) => ({ ...f, undefeatedOnly: !f.undefeatedOnly }));
  }

  toggleHideFcs(): void {
    this.filters.update((f) => ({ ...f, hideFcsOpponent: !f.hideFcsOpponent }));
  }

  reset(): void {
    const league = this.fixedLeague();
    this.filters.update((f) => ({
      league: league ?? 'all',
      groups: [],
      rankScope: 'any',
      sameGroupOnly: false,
      kickoffAfterHour: null,
      hideCompleted: false,
      keepMineWhenHidden: true,
      eliteRecordsOnly: false,
      undefeatedOnly: false,
      hideFcsOpponent: false,
    }));
  }
}
