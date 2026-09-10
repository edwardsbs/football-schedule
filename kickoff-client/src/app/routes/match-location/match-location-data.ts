import { NCAA_ALIGNMENT } from '../../core/data/ncaa-alignment.data';
import { NFL_ALIGNMENT } from '../../core/data/nfl-alignment.data';
import { AlignmentTeam, LeagueAlignment } from '../../core/models/alignment.model';
import { MatchLeague, MatchTile } from '../division-match/division-match-data';

export interface StateTarget {
  code: string;
  name: string;
  row: number;
  column: number;
}

/** A touch-sized, geographically arranged state tile map. The gaps preserve
 * the familiar U.S. silhouette while keeping every state a dependable target. */
export const US_STATE_TARGETS: readonly StateTarget[] = [
  state('WA', 'Washington', 1, 1), state('MT', 'Montana', 1, 3), state('ND', 'North Dakota', 1, 5),
  state('MN', 'Minnesota', 1, 6), state('WI', 'Wisconsin', 1, 7), state('MI', 'Michigan', 1, 8),
  state('NY', 'New York', 1, 10), state('VT', 'Vermont', 1, 11), state('NH', 'New Hampshire', 1, 12),
  state('ME', 'Maine', 1, 13),

  state('OR', 'Oregon', 2, 1), state('ID', 'Idaho', 2, 2), state('WY', 'Wyoming', 2, 4),
  state('SD', 'South Dakota', 2, 5), state('IA', 'Iowa', 2, 6), state('IL', 'Illinois', 2, 7),
  state('IN', 'Indiana', 2, 8), state('OH', 'Ohio', 2, 9), state('PA', 'Pennsylvania', 2, 10),
  state('NJ', 'New Jersey', 2, 11), state('CT', 'Connecticut', 2, 12), state('MA', 'Massachusetts', 2, 13),

  state('CA', 'California', 3, 1), state('NV', 'Nevada', 3, 2), state('UT', 'Utah', 3, 3),
  state('CO', 'Colorado', 3, 4), state('NE', 'Nebraska', 3, 5), state('MO', 'Missouri', 3, 6),
  state('KY', 'Kentucky', 3, 7), state('WV', 'West Virginia', 3, 8), state('VA', 'Virginia', 3, 9),
  state('MD', 'Maryland', 3, 10), state('DE', 'Delaware', 3, 11), state('RI', 'Rhode Island', 3, 12),

  state('AZ', 'Arizona', 4, 2), state('NM', 'New Mexico', 4, 3), state('KS', 'Kansas', 4, 5),
  state('AR', 'Arkansas', 4, 6), state('TN', 'Tennessee', 4, 7), state('NC', 'North Carolina', 4, 9),
  state('SC', 'South Carolina', 4, 10),

  state('OK', 'Oklahoma', 5, 5), state('LA', 'Louisiana', 5, 6), state('MS', 'Mississippi', 5, 7),
  state('AL', 'Alabama', 5, 8), state('GA', 'Georgia', 5, 9),

  state('TX', 'Texas', 6, 4), state('FL', 'Florida', 6, 10),
  state('AK', 'Alaska', 7, 1), state('HI', 'Hawaii', 7, 2),
];

export function locationTilePool(league: MatchLeague): MatchTile[] {
  const alignment = alignmentFor(league);
  const byName = new Map<string, MatchTile>();

  const record = (team: AlignmentTeam) => {
    if (!team.stateCode) return;
    byName.set(team.name, {
      key: team.name,
      name: team.name,
      abbreviation: team.abbreviation ?? null,
      logoUrl: team.logoUrl ?? null,
      targetKey: team.stateCode,
    });
  };

  for (const tier of alignment.tiers) {
    for (const conference of tier.conferences) {
      for (const division of conference.divisions) {
        for (const team of division.teams) record(team);
      }
    }
  }
  for (const team of alignment.independents) record(team);

  return [...byName.values()];
}

function alignmentFor(league: MatchLeague): LeagueAlignment {
  return league === 'nfl' ? NFL_ALIGNMENT : NCAA_ALIGNMENT;
}

function state(code: string, name: string, row: number, column: number): StateTarget {
  return { code, name, row, column };
}
