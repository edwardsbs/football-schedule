import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { getAlignment } from '../../core/data/alignment-lookup';
import { AlignmentConference, AlignmentTeam } from '../../core/models/alignment.model';
import { TeamRecord, TeamSummary } from '../../core/models/game.model';
import { NcaaRankings, RankingRow } from '../../core/models/ranking.model';
import { mergeRankingPolls, rankingPoll } from '../../core/ranking-comparison';
import { RankingMovement, rankingMovement } from '../../core/ranking-movement';
import { FanStore } from '../../core/services/fan-store';
import { KickoffApi } from '../../core/services/kickoff-api';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

/**
 * Conference & division breakdown for a league. `league` is bound from the
 * `:league` route param via router component-input binding.
 */
@Component({
  selector: 'app-conference-alignment',
  imports: [RouterLink, TeamBadgeComponent],
  templateUrl: './conference-alignment.component.html',
  styleUrl: './conference-alignment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConferenceAlignmentComponent {
  private readonly api = inject(KickoffApi);
  private readonly records = inject(TeamRecordStore);
  readonly fan = inject(FanStore);

  readonly league = input.required<string>();
  readonly palette = signal<'original' | 'muted' | 'mono'>('mono');
  readonly rankingRailOpen = signal(true);

  readonly alignment = computed(() => getAlignment(this.league()));

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

  toggleRankingFavorite(row: RankingRow): void {
    this.fan.toggleFavorite(row.teamId);
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
}

/** Extracts the numeric ESPN team id from an `.../ncaa/500/{id}.png` logo URL. */
function ncaaEspnId(logoUrl: string | null | undefined): string | null {
  return logoUrl?.match(/\/ncaa\/500\/(\d+)\.png/)?.[1] ?? null;
}
