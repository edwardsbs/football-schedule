import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { Game, TeamSummary } from '../../core/models/game.model';
import { PlayoffTeamEntry, buildPlayoffPicture } from '../../core/nfl-playoff-picture';
import { NcaaRankings, RankingPoll, RankingRow } from '../../core/models/ranking.model';
import { mergeRankingPolls, rankingPoll } from '../../core/ranking-comparison';
import { RankingMovement, rankingMovement } from '../../core/ranking-movement';
import { FanStore } from '../../core/services/fan-store';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { TeamConferenceStore } from '../../core/services/team-conference-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { GameFilterContext, GameFilters, countActiveGameFilters, defaultGameFilters, matchesGameFilters } from '../../core/game-filters';
import { filterFollowed, groupByWeek } from '../../core/timeline';
import { byeTeamsForWeek, rosterFromGames } from './bye-teams';
import { FindGamesFilterComponent } from '../../shared/find-games-filter/find-games-filter.component';
import { GameRowComponent } from '../../shared/game-row/game-row.component';
import { ImportantGamesTickerComponent } from '../../shared/important-games-ticker/important-games-ticker.component';
import { LeagueSectionToggleComponent } from '../../shared/league-section-toggle/league-section-toggle.component';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { WeekStripComponent, WeekStripItem } from '../../shared/week-strip/week-strip.component';
import { defaultScheduleWeek } from './schedule-week-selection';
import { pollWeekForScheduleWeek } from './season-ranking-week';

type ViewMode = 'byWeek' | 'full';

/** Aug 1 of the season's start year through Feb 15 of the following year --
 * wide enough to cover both leagues' full regular season + a little slack. */
function seasonRange(): { from: string; to: string } {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: new Date(startYear, 7, 1).toISOString(),
    to: new Date(startYear + 1, 1, 15).toISOString(),
  };
}

/** "SEP 16 - 22" (same month) or "AUG 27 - SEP 2" (spanning months), ESPN-style. */
function rangeLabel(first: Date, last: Date): string {
  const sameMonth = first.getMonth() === last.getMonth();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const from = first.toLocaleDateString([], opts);
  const to = sameMonth ? last.toLocaleDateString([], { day: 'numeric' }) : last.toLocaleDateString([], opts);
  return `${from} - ${to}`.toUpperCase();
}

@Component({
  selector: 'app-season-schedule',
  imports: [
    DatePipe,
    FindGamesFilterComponent,
    GameRowComponent,
    ImportantGamesTickerComponent,
    LeagueSectionToggleComponent,
    TeamBadgeComponent,
    WeekStripComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './season-schedule.component.html',
  styleUrls: ['../shared/timeline.scss', './season-schedule.component.scss'],
})
export class SeasonScheduleComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  private readonly records = inject(TeamRecordStore);
  private readonly conferences = inject(TeamConferenceStore);
  private readonly filterCtx: GameFilterContext = {
    groupOf: (id) => this.conferences.groupOf(id),
    recordOf: (id) => this.records.record(id),
  };
  readonly fan = inject(FanStore);
  private readonly reload = signal(0);
  private readonly scheduleRange = seasonRange();

  readonly league = input.required<string>();

  private readonly backendLeague = computed<'Nfl' | 'Ncaa' | null>(() => {
    this.reload();
    return this.league() === 'nfl' ? 'Nfl' : this.league() === 'ncaa' ? 'Ncaa' : null;
  });

  private readonly loadedGames = toSignal(
    toObservable(this.backendLeague).pipe(
      switchMap((league) => {
        if (!league) return of<Game[]>([]);
        const { from, to } = this.scheduleRange;
        return this.api.getRange(from, to, league).pipe(catchError(() => of<Game[]>([])));
      }),
    ),
    { initialValue: [] as Game[] },
  );

  readonly games = computed(() => {
    const league = this.backendLeague();
    return league
      ? this.live.overlayRange(this.loadedGames(), this.scheduleRange.from, this.scheduleRange.to, league)
      : [];
  });

  /** "My games" filter: only favorite-team or circled games. */
  readonly onlyMine = signal(false);

  readonly gameFiltersOpen = signal(false);
  readonly gameFilters = signal<GameFilters>(defaultGameFilters());
  readonly activeGameFilterCount = computed(() => countActiveGameFilters(this.gameFilters()));

  readonly visible = computed(() => {
    const base = this.onlyMine() ? filterFollowed(this.games()) : this.games();
    return base.filter((g) => matchesGameFilters(g, this.gameFilters(), this.filterCtx));
  });

  readonly weeks = computed(() => groupByWeek(this.visible()));
  readonly total = computed(() => this.visible().length);

  readonly leagueLabel = computed(() => (this.league() === 'nfl' ? 'NFL' : 'NCAA'));

  /** Defaults on (week-by-week), per the ask. */
  readonly viewMode = signal<ViewMode>('byWeek');

  /** Each league advances independently at local midnight after the final
   * scheduled game day in its provider week. */
  private readonly currentWeekNumber = computed<number | null>(() => defaultScheduleWeek(this.weeks()));

  /** Null until the user manually picks a week -- until then, tracks whatever
   * week is "current" as the season's data changes. */
  private readonly selectedWeek = signal<number | null>(null);

  readonly weekNumber = computed(() => this.selectedWeek() ?? this.currentWeekNumber());
  readonly activeWeek = computed(() => this.weeks().find((w) => w.number === this.weekNumber()) ?? null);
  readonly activeWeekGames = computed(() => {
    const weekNumber = this.weekNumber();
    return this.games().filter((game) => game.weekNumber === weekNumber);
  });

  /** Deliberately built from the unfiltered games list so "My games"/Find
   * Games never change who's on bye. */
  private readonly leagueRosterTeams = computed(() => rosterFromGames(this.games()));

  byeTeams(weekNumber: number): TeamSummary[] {
    return byeTeamsForWeek(this.games(), weekNumber, this.leagueRosterTeams());
  }

  readonly rankingRailOpen = signal(true);
  readonly playoffRailOpen = signal(true);
  readonly seasonYear = new Date(this.scheduleRange.from).getFullYear();

  /** Real teams (all 32, independent of whichever league route is active --
   * the rail only renders under the NFL route, but this is cheap to fetch
   * either way and keeps the computation self-contained). */
  private readonly nflTeams = toSignal(
    this.api.getTeams('Nfl').pipe(catchError(() => of([] as TeamSummary[]))),
    { initialValue: [] as TeamSummary[] },
  );

  /** Every NFL game across the full season, regardless of the active league
   * route or any "My games"/Find Games filtering -- head-to-head tiebreaking
   * needs the complete real schedule, not whatever's currently visible. */
  private readonly nflSeasonGames = toSignal(
    this.api.getRange(seasonRange().from, seasonRange().to, 'Nfl').pipe(catchError(() => of([] as Game[]))),
    { initialValue: [] as Game[] },
  );

  readonly playoffPicture = computed(() => {
    const entries: PlayoffTeamEntry[] = [];
    for (const team of this.nflTeams()) {
      const division = this.conferences.groupOf(team.id);
      if (!division) continue;
      entries.push({
        teamId: team.id,
        displayName: team.displayName,
        abbreviation: team.abbreviation,
        logoUrl: team.logoUrl,
        division,
        record: this.records.record(team.id) ?? { teamId: team.id, wins: 0, losses: 0, ties: 0 },
      });
    }
    return buildPlayoffPicture(entries, this.nflSeasonGames());
  });

  private readonly rankingSelection = computed(() => {
    const week = this.weekNumber();
    return this.league() === 'ncaa' && this.viewMode() === 'byWeek' && week !== null
      ? { seasonYear: this.seasonYear, scheduleWeek: week, pollWeek: pollWeekForScheduleWeek(week) }
      : null;
  });

  readonly rankingSet = toSignal(
    toObservable(this.rankingSelection).pipe(
      switchMap((selection) => selection
        ? this.api.getNcaaRankings(selection.seasonYear, selection.pollWeek).pipe(catchError(() => of(null)))
        : of(null)),
    ),
    { initialValue: null as NcaaRankings | null },
  );

  readonly showRankingRail = computed(() => this.rankingSelection() !== null && this.rankingRailOpen());
  readonly apRankingPoll = computed(() => rankingPoll(this.rankingSet(), 'ap'));
  readonly cfpRankingPoll = computed(() => rankingPoll(this.rankingSet(), 'cfp'));
  readonly rankingRows = computed(() => mergeRankingPolls(this.rankingSet()));
  private readonly primaryRankingPoll = computed(() => this.cfpRankingPoll() ?? this.apRankingPoll());
  private readonly rankingPollHasHistory = computed(() =>
    this.primaryRankingPoll()?.rankings.some((team) => team.previousRank !== null) ?? false,
  );

  /** The badge describes only what the current schedule view can reveal: the
   * selected week in Week by Week mode, or the entire league season in Full Season. */
  readonly followedCount = computed(() => {
    const games = this.games();
    if (this.viewMode() === 'full') return filterFollowed(games).length;
    const weekNumber = this.weekNumber();
    return filterFollowed(games.filter((game) => game.weekNumber === weekNumber)).length;
  });

  private readonly weekIndex = computed(() => this.weeks().findIndex((w) => w.number === this.weekNumber()));

  readonly canPrevWeek = computed(() => this.weekIndex() > 0);
  readonly canNextWeek = computed(() => {
    const idx = this.weekIndex();
    return idx >= 0 && idx < this.weeks().length - 1;
  });

  readonly weekStripItems = computed<WeekStripItem[]>(() =>
    this.weeks().map((w) => ({
      key: w.number,
      label: w.label,
      range: rangeLabel(new Date(w.days[0].date), new Date(w.days[w.days.length - 1].date)),
      active: w.number === this.weekNumber(),
    })),
  );

  slotLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  rankingMovement(row: RankingRow): RankingMovement {
    const team = row.cfp ?? row.ap!;
    return rankingMovement(team.rank, team.previousRank, this.rankingPollHasHistory());
  }

  rankingMovementAriaLabel(row: RankingRow): string {
    const movement = this.rankingMovement(row);
    switch (movement.kind) {
      case 'up': return `Up ${movement.places} places from the previous poll`;
      case 'down': return `Down ${movement.places} places from the previous poll`;
      case 'same': return 'Unchanged from the previous poll';
      case 'new': return 'New to the Top 25';
      case 'unavailable': return 'Previous poll comparison unavailable';
    }
  }

  rankingPollContext(poll: RankingPoll): string {
    const scheduleWeek = this.rankingSelection()?.scheduleWeek;
    if (scheduleWeek !== undefined) {
      return poll.isExactWeek
        ? `For schedule Week ${scheduleWeek} · ${poll.seasonYear}`
        : `${poll.label} · latest available for schedule Week ${scheduleWeek}`;
    }
    return poll.isExactWeek
      ? `${poll.label} · ${poll.seasonYear}`
      : `${poll.label} · latest available for Week ${poll.requestedWeek}`;
  }

  rankingRecord(row: RankingRow): string {
    return this.records.label(row.teamId);
  }

  rankingRecordAriaLabel(row: RankingRow): string {
    return this.records.ariaLabel(row.teamId);
  }

  isRankingFavorite(row: RankingRow): boolean {
    return this.fan.isFavorite(row.teamId);
  }

  isRankingInterest(row: RankingRow): boolean {
    return this.fan.isInterest(row.teamId);
  }

  toggleRankingFavorite(row: RankingRow): void {
    this.fan.toggleFavorite(row.teamId);
  }

  toggleRankingInterest(row: RankingRow): void {
    this.fan.toggleInterest(row.teamId);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  selectWeek(key: string | number): void {
    this.selectedWeek.set(Number(key));
  }

  prevWeek(): void {
    const ws = this.weeks();
    const idx = this.weekIndex();
    if (idx > 0) this.selectedWeek.set(ws[idx - 1].number);
  }
  nextWeek(): void {
    const ws = this.weeks();
    const idx = this.weekIndex();
    if (idx >= 0 && idx < ws.length - 1) this.selectedWeek.set(ws[idx + 1].number);
  }
  jumpToCurrentWeek(): void {
    this.selectedWeek.set(null);
  }

  toggleMine(): void {
    this.onlyMine.update((v) => !v);
  }
  refresh(): void {
    this.reload.update((v) => v + 1);
  }
}
