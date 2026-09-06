import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { getAlignment } from '../../core/data/alignment-lookup';
import { AlignmentConference, AlignmentTeam } from '../../core/models/alignment.model';
import { TeamRecord, TeamSummary } from '../../core/models/game.model';
import { FanStore } from '../../core/services/fan-store';
import { KickoffApi } from '../../core/services/kickoff-api';
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
  readonly fan = inject(FanStore);

  readonly league = input.required<string>();
  readonly palette = signal<'original' | 'muted' | 'mono'>('mono');

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

  /** Records are inexpensive to calculate and refresh shortly after a game is
   * marked final, without requiring the user to reload the conference page. */
  private readonly backendRecords = toSignal(
    toObservable(this.league).pipe(
      switchMap((l) =>
        timer(0, 30_000).pipe(
          switchMap(() =>
            l === 'ncaa'
              ? this.api.getTeamRecords('Ncaa').pipe(catchError(() => of([] as TeamRecord[])))
              : l === 'nfl'
                ? this.api.getTeamRecords('Nfl').pipe(catchError(() => of([] as TeamRecord[])))
                : of([] as TeamRecord[]),
          ),
        ),
      ),
    ),
    { initialValue: [] as TeamRecord[] },
  );

  private readonly recordByTeamId = computed(() =>
    new Map(this.backendRecords().map((record) => [record.teamId, record])),
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
    return this.recordByTeamId().get(id) ?? { teamId: id, wins: 0, losses: 0, ties: 0 };
  }

  teamRank(team: AlignmentTeam): number | null {
    const key = this.league() === 'ncaa'
      ? ncaaEspnId(team.logoUrl ?? null)
      : (team.abbreviation?.toLowerCase() ?? null);
    return key ? (this.teamRankByKey().get(key) ?? null) : null;
  }

  isFavorite(team: AlignmentTeam): boolean {
    const id = this.teamId(team);
    return id !== null && this.fan.isFavorite(id);
  }

  toggleFavorite(team: AlignmentTeam, event: Event): void {
    event.stopPropagation();
    const id = this.teamId(team);
    if (id !== null) this.fan.toggleFavorite(id);
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
