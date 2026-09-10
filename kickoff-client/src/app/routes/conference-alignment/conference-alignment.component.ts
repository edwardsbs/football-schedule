import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { getAlignment } from '../../core/data/alignment-lookup';
import { conferenceRecord, conferenceRecordLabel, divisionRecord, divisionRecordLabel } from '../../core/division-record';
import { AlignmentConference, AlignmentDivision, AlignmentTeam } from '../../core/models/alignment.model';
import { Game, TeamRecord, TeamSummary } from '../../core/models/game.model';
import { PlayoffStatus, PlayoffTeamEntry, buildPlayoffPicture } from '../../core/nfl-playoff-picture';
import { NcaaRankings, RankingRow } from '../../core/models/ranking.model';
import { mergeRankingPolls, rankingPoll } from '../../core/ranking-comparison';
import { RankingMovement, rankingMovement } from '../../core/ranking-movement';
import { ncaaEspnId } from '../../core/team-key';
import { TeamFilterEntry, TeamFilters, countActiveTeamFilters, defaultTeamFilters, matchesTeamFilters } from '../../core/team-filters';
import { FanStore } from '../../core/services/fan-store';
import { KickoffApi } from '../../core/services/kickoff-api';
import { TeamConferenceStore } from '../../core/services/team-conference-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { FindTeamsFilterComponent } from '../../shared/find-teams-filter/find-teams-filter.component';
import { LeagueSectionToggleComponent } from '../../shared/league-section-toggle/league-section-toggle.component';
import { PlayoffStatusIconComponent } from '../../shared/playoff-status-icon/playoff-status-icon.component';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

/** Aug 1 of the season's start year through Feb 15 of the following year --
 * wide enough to cover the full NFL regular season plus a little slack. */
function footballSeasonRange(): { from: string; to: string } {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: new Date(startYear, 7, 1).toISOString(),
    to: new Date(startYear + 1, 1, 15).toISOString(),
  };
}

/**
 * Conference & division breakdown for a league. `league` is bound from the
 * `:league` route param via router component-input binding.
 */
@Component({
  selector: 'app-conference-alignment',
  imports: [RouterLink, FindTeamsFilterComponent, LeagueSectionToggleComponent, PlayoffStatusIconComponent, TeamBadgeComponent],
  templateUrl: './conference-alignment.component.html',
  styleUrl: './conference-alignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConferenceAlignmentComponent {
  private readonly api = inject(KickoffApi);
  private readonly records = inject(TeamRecordStore);
  private readonly conferences = inject(TeamConferenceStore);
  readonly fan = inject(FanStore);

  readonly league = input.required<string>();
  readonly palette = signal<'original' | 'muted' | 'mono'>('mono');
  readonly rankingRailOpen = signal(true);

  /** Completed-game source for the current league's division/conference split. */
  private readonly seasonGames = toSignal(
    toObservable(this.league).pipe(
      switchMap((l) => {
        const apiLeague = l === 'nfl' ? 'Nfl' : l === 'ncaa' ? 'Ncaa' : null;
        if (!apiLeague) return of<Game[]>([]);
        const { from, to } = footballSeasonRange();
        return this.api.getRange(from, to, apiLeague).pipe(catchError(() => of<Game[]>([])));
      }),
    ),
    { initialValue: [] as Game[] },
  );

  readonly alignment = computed(() => getAlignment(this.league()));

  readonly ncaaTitleParts = computed(() => {
    const title = this.alignment()?.title ?? '';
    const marker = ' NCAA ';
    const markerIndex = title.indexOf(marker);
    return markerIndex < 0
      ? { before: '', after: title }
      : {
          before: title.slice(0, markerIndex),
          after: title.slice(markerIndex + marker.length),
        };
  });

  /**
   * Real backend teams for the current league, so alignment-page entries (still
   * placeholder data) can resolve a favorite-able id. NCAA teams are matched by
   * the numeric ESPN id embedded in the logo URL; NFL teams by abbreviation --
   * both are already how the static alignment data builds its own logo URLs, so
   * no separate name-matching table is needed.
   */
  private readonly backendTeams = toSignal(
    toObservable(this.league).pipe(
      switchMap((l) =>
        l === 'ncaa' ? this.api.getTeams('Ncaa') : l === 'nfl' ? this.api.getTeams('Nfl') : of([]),
      ),
    ),
    { initialValue: [] as TeamSummary[] },
  );

  private readonly currentRankingSet = toSignal(
    toObservable(this.league).pipe(
      switchMap((league) => league === 'ncaa'
        ? this.api.getCurrentNcaaRankings().pipe(catchError(() => of(null)))
        : of(null)),
    ),
    { initialValue: null as NcaaRankings | null },
  );

  private readonly teamIdByKey = computed(() => {
    const isNcaa = this.league() === 'ncaa';
    const map = new Map<string, number>();
    for (const t of this.backendTeams()) {
      const key = isNcaa ? ncaaEspnId(t.logoUrl) : t.abbreviation.toLowerCase();
      if (key) map.set(key, t.id);
    }
    return map;
  });

  private readonly teamRankByKey = computed(() => {
    const isNcaa = this.league() === 'ncaa';
    const map = new Map<string, number>();
    for (const team of this.backendTeams()) {
      const key = isNcaa ? ncaaEspnId(team.logoUrl) : team.abbreviation.toLowerCase();
      if (key && team.currentRank !== null) map.set(key, team.currentRank);
    }
    return map;
  });

  readonly apRankingPoll = computed(() => rankingPoll(this.currentRankingSet(), 'ap'));
  readonly cfpRankingPoll = computed(() => rankingPoll(this.currentRankingSet(), 'cfp'));
  readonly ncaaRankingRows = computed<RankingRow[]>(() => {
    const current = mergeRankingPolls(this.currentRankingSet());
    if (current.length) return current;

    return this.backendTeams()
      .filter((team) => team.currentRank !== null)
      .sort((left, right) => left.currentRank! - right.currentRank!)
      .map((team) => ({
        teamId: team.id,
        displayName: team.displayName,
        abbreviation: team.abbreviation,
        logoUrl: team.logoUrl,
        ap: {
          teamId: team.id,
          displayName: team.displayName,
          abbreviation: team.abbreviation,
          logoUrl: team.logoUrl,
          rank: team.currentRank!,
          previousRank: team.previousRank ?? null,
        },
        cfp: null,
      }));
  });

  /** A preseason poll has no prior positions at all; suppress a misleading
   * wall of NEW labels until at least one team has real week-over-week data. */
  private readonly pollHasHistory = computed(() =>
    this.ncaaRankingRows().some((row) => (row.cfp ?? row.ap)?.previousRank != null),
  );

  /** The real backend team id for an alignment entry, or null if that team
   * hasn't been imported yet (not yet favorite-able). */
  teamId(team: AlignmentTeam): number | null {
    const isNcaa = this.league() === 'ncaa';
    const key = isNcaa ? ncaaEspnId(team.logoUrl ?? null) : (team.abbreviation?.toLowerCase() ?? null);
    return key ? (this.teamIdByKey().get(key) ?? null) : null;
  }

  record(team: AlignmentTeam): TeamRecord | null {
    const id = this.teamId(team);
    if (id === null) return null;
    return this.records.record(id) ?? { teamId: id, wins: 0, losses: 0, ties: 0 };
  }

  /** NFL only: this team's W-L-T restricted to games against its own division
   * rivals, shown alongside the overall record on the NFL Divisions page. */
  divisionRecordLabelFor(team: AlignmentTeam): string {
    const id = this.teamId(team);
    if (id === null) return '—';
    const division = this.conferences.groupOf(id);
    if (!division) return '—';
    return divisionRecordLabel(divisionRecord(id, division, this.seasonGames(), (teamId) => this.conferences.groupOf(teamId)));
  }

  /** NCAA only: W-L-T against opponents in the same real conference. */
  conferenceRecordLabelFor(team: AlignmentTeam): string {
    const id = this.teamId(team);
    if (id === null) return '—';
    const conference = this.conferences.groupOf(id);
    if (!conference || conference === 'Independents') return '—';
    return conferenceRecordLabel(conferenceRecord(id, conference, this.seasonGames(), (teamId) => this.conferences.groupOf(teamId)));
  }

  /** NFL only: the same playoff picture the Season Schedule rail computes,
   * over every real NFL team rather than just the top of each conference --
   * used here only to know who's Eliminated (the one real, computed status);
   * everyone else defaults to "In The Hunt" until real clinch detection exists. */
  private readonly nflPlayoffPicture = computed(() => {
    if (this.league() !== 'nfl') return [];
    const entries: PlayoffTeamEntry[] = [];
    for (const team of this.backendTeams()) {
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
    return buildPlayoffPicture(entries, this.seasonGames());
  });

  private readonly eliminatedTeamIds = computed(() => {
    const ids = new Set<number>();
    for (const conference of this.nflPlayoffPicture()) {
      for (const seed of conference.eliminated) ids.add(seed.teamId);
    }
    return ids;
  });

  playoffStatusFor(team: AlignmentTeam): PlayoffStatus {
    const id = this.teamId(team);
    if (id === null) return 'hunt';
    return this.eliminatedTeamIds().has(id) ? 'eliminated' : 'hunt';
  }

  teamRank(team: AlignmentTeam): number | null {
    const key = this.league() === 'ncaa'
      ? ncaaEspnId(team.logoUrl ?? null)
      : (team.abbreviation?.toLowerCase() ?? null);
    return key ? (this.teamRankByKey().get(key) ?? null) : null;
  }

  rankingMovement(row: RankingRow): RankingMovement {
    const team = row.cfp ?? row.ap!;
    return rankingMovement(team.rank, team.previousRank, this.pollHasHistory());
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

  isFavorite(team: AlignmentTeam): boolean {
    const id = this.teamId(team);
    return id !== null && this.fan.isFavorite(id);
  }

  isInterest(team: AlignmentTeam): boolean {
    const id = this.teamId(team);
    return id !== null && this.fan.isInterest(id);
  }

  toggleFavorite(team: AlignmentTeam, event: Event): void {
    event.stopPropagation();
    const id = this.teamId(team);
    if (id !== null) this.fan.toggleFavorite(id);
  }

  toggleInterest(team: AlignmentTeam, event: Event): void {
    event.stopPropagation();
    const id = this.teamId(team);
    if (id !== null) this.fan.toggleInterest(id);
  }

  /** The NFL presentation is intentionally NFC-first to match the familiar two-conference layout. */
  readonly nflConferences = computed<AlignmentConference[]>(() => {
    const alignment = this.alignment();
    if (alignment?.league !== 'nfl') return [];

    const conferences = alignment.tiers.flatMap((tier) => tier.conferences);
    return ['NFC', 'AFC'].flatMap((shortName) =>
      conferences.filter((conference) => conference.shortName === shortName),
    );
  });

  readonly teamCount = computed(() => {
    const a = this.alignment();
    if (!a) return 0;
    const inConferences = a.tiers
      .flatMap((tier) => tier.conferences)
      .flatMap((conf) => conf.divisions)
      .reduce((sum, div) => sum + div.teams.length, 0);
    return inConferences + a.independents.length;
  });

  setPalette(palette: 'original' | 'muted' | 'mono'): void {
    this.palette.set(palette);
  }

  // --- Find Teams ---

  readonly teamFiltersOpen = signal(false);
  readonly teamFilters = signal<TeamFilters>(defaultTeamFilters());
  readonly activeTeamFilterCount = computed(() => countActiveTeamFilters(this.teamFilters()));

  private teamFilterEntry(team: AlignmentTeam): TeamFilterEntry {
    return {
      name: team.name,
      isFavorite: this.isFavorite(team),
      isInterest: this.isInterest(team),
      rank: this.teamRank(team),
      record: this.record(team),
    };
  }

  matchesTeamFilter(team: AlignmentTeam): boolean {
    return matchesTeamFilters(this.teamFilterEntry(team), this.teamFilters());
  }

  divisionHasMatch(division: AlignmentDivision): boolean {
    return division.teams.some((team) => this.matchesTeamFilter(team));
  }

  anyMatch(teams: AlignmentTeam[]): boolean {
    return teams.some((team) => this.matchesTeamFilter(team));
  }

  readonly visibleTeamCount = computed(() => {
    const a = this.alignment();
    if (!a) return 0;
    const teams = a.tiers
      .flatMap((tier) => tier.conferences)
      .flatMap((conf) => conf.divisions)
      .flatMap((div) => div.teams)
      .concat(a.independents);
    return teams.filter((team) => this.matchesTeamFilter(team)).length;
  });
}
