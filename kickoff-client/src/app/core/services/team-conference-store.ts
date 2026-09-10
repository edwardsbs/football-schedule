import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { NCAA_ALIGNMENT } from '../data/ncaa-alignment.data';
import { NFL_ALIGNMENT } from '../data/nfl-alignment.data';
import { AlignmentTeam, LeagueAlignment } from '../models/alignment.model';
import { TeamSummary } from '../models/game.model';
import { ncaaEspnId } from '../team-key';
import { KickoffApi } from './kickoff-api';

export type GameLeague = 'nfl' | 'ncaa';

/**
 * Resolves a real backend team id to the conference (NCAA) or division (NFL) it
 * plays in, by joining the same static alignment data the Conferences page
 * already uses against the real team list -- via the same ESPN-id/abbreviation
 * keys `ConferenceAlignmentComponent.teamId()` uses. Coverage is exactly the
 * Conferences page's coverage: all 32 NFL teams, but only the curated FBS set
 * for NCAA -- most FCS/small-school games simply have no group, which is an
 * honest limit of the underlying data, not a bug.
 */
@Injectable({ providedIn: 'root' })
export class TeamConferenceStore {
  private readonly api = inject(KickoffApi);

  private readonly nflTeams = toSignal(
    this.api.getTeams('Nfl').pipe(catchError(() => of([] as TeamSummary[]))),
    { initialValue: [] as TeamSummary[] },
  );
  private readonly ncaaTeams = toSignal(
    this.api.getTeams('Ncaa').pipe(catchError(() => of([] as TeamSummary[]))),
    { initialValue: [] as TeamSummary[] },
  );

  private readonly groupByTeamId = computed(() => {
    const map = new Map<number, string>();
    indexAlignment(NFL_ALIGNMENT, this.nflTeams(), 'nfl', map);
    indexAlignment(NCAA_ALIGNMENT, this.ncaaTeams(), 'ncaa', map);
    return map;
  });

  /** The conference (NCAA) or division (NFL) label for a real team id, or null
   * when that team isn't in the curated alignment data. */
  groupOf(teamId: number): string | null {
    return this.groupByTeamId().get(teamId) ?? null;
  }

  /** Every selectable group label for a league, in the alignment page's own order. */
  groupOptions(league: GameLeague): string[] {
    return league === 'nfl' ? divisionNames(NFL_ALIGNMENT) : conferenceNames(NCAA_ALIGNMENT);
  }
}

function indexAlignment(
  alignment: LeagueAlignment,
  teams: TeamSummary[],
  league: GameLeague,
  out: Map<number, string>,
): void {
  const idByKey = new Map<string, number>();
  for (const team of teams) {
    const key = league === 'ncaa' ? ncaaEspnId(team.logoUrl) : team.abbreviation.toLowerCase();
    if (key) idByKey.set(key, team.id);
  }

  const assign = (entries: AlignmentTeam[], label: string) => {
    for (const entry of entries) {
      const key = league === 'ncaa' ? ncaaEspnId(entry.logoUrl ?? null) : (entry.abbreviation?.toLowerCase() ?? null);
      const id = key ? idByKey.get(key) : undefined;
      if (id !== undefined) out.set(id, label);
    }
  };

  for (const tier of alignment.tiers) {
    for (const conference of tier.conferences) {
      // NFL divisions are real; NCAA's "divisions" here are a stylized split
      // within one conference -- group at the conference level instead, which
      // is what a fan would actually filter by (e.g. "SEC", not "SEC East").
      for (const division of conference.divisions) {
        assign(division.teams, league === 'nfl' ? division.name : conference.shortName);
      }
    }
  }
  assign(alignment.independents, 'Independents');
}

function divisionNames(alignment: LeagueAlignment): string[] {
  const names: string[] = [];
  for (const tier of alignment.tiers) {
    for (const conference of tier.conferences) {
      for (const division of conference.divisions) names.push(division.name);
    }
  }
  return names;
}

function conferenceNames(alignment: LeagueAlignment): string[] {
  const names: string[] = [];
  for (const tier of alignment.tiers) {
    for (const conference of tier.conferences) {
      if (!names.includes(conference.shortName)) names.push(conference.shortName);
    }
  }
  if (alignment.independents.length) names.push('Independents');
  return names;
}
